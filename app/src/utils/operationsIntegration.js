import { buildApiUrl } from './apiClient.js';

function safeString(value, fallback = 'Insufficient Data') {
  if (value === null || value === undefined || value === '') return fallback;
  return typeof value === 'string' ? value : String(value);
}

function safeNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function dedupeAlerts(alerts = []) {
  const seen = new Set();
  return normalizeArray(alerts).reduce((accumulator, alert) => {
    const key = `${alert?.title || 'alert'}::${alert?.source || 'unknown'}::${alert?.timestamp || 'unknown'}`;
    if (seen.has(key)) return accumulator;
    seen.add(key);
    accumulator.push({
      severity: safeString(alert?.severity, 'Info').toUpperCase(),
      title: safeString(alert?.title, 'Operational Alert'),
      summary: safeString(alert?.summary, 'No additional details available.'),
      source: safeString(alert?.source, 'RSOS'),
      timestamp: safeString(alert?.timestamp, 'Unknown'),
      recommendedAction: safeString(alert?.recommendedAction, 'Review the latest signal'),
      acknowledgmentStatus: safeString(alert?.acknowledgmentStatus || alert?.acknowledged || 'Pending', 'Pending'),
    });
    return accumulator;
  }, []);
}

function resolveBackendHealthStatus(backendHealth = {}) {
  if (!backendHealth || typeof backendHealth !== 'object') return 'Unknown';
  if (backendHealth?.healthy === true || backendHealth?.status === 'ok' || backendHealth?.server === true) return 'Healthy';
  if (backendHealth?.healthy === false || backendHealth?.status === 'degraded' || backendHealth?.status === 'warning' || backendHealth?.status === 'offline' || backendHealth?.status === 'unhealthy') return 'Offline';
  return 'Unknown';
}

function normalizeLabel(value, fallback = 'Unknown') {
  const normalized = safeString(value, '').trim();
  if (!normalized) return fallback;
  const lower = normalized.toLowerCase();
  if (lower === 'unknown' || lower === 'pending' || lower === 'n/a' || lower === 'na') return fallback;
  return normalized;
}

export function normalizeOperationsError(error) {
  if (!error) return 'Unknown error';
  if (typeof error === 'string') return error;
  return error.message || safeString(error, 'Unknown error');
}

export function createOperationsService() {
  const inflight = new Map();

  return {
    async load(key, loader) {
      if (inflight.has(key)) return inflight.get(key);
      const promise = Promise.resolve()
        .then(loader)
        .catch((error) => ({ error: normalizeOperationsError(error) }))
        .finally(() => inflight.delete(key));
      inflight.set(key, promise);
      return promise;
    },
    async post(key, loader) {
      return this.load(key, loader);
    },
  };
}

export function buildOperationsStatusSummary(viewModel = {}, backendHealth = {}, options = {}) {
  const backendState = resolveBackendHealthStatus(backendHealth);
  const workflowStatus = normalizeLabel(viewModel?.workflow?.status, backendState === 'Healthy' ? 'Healthy' : 'Pending');
  const workflowStage = normalizeLabel(viewModel?.workflow?.currentStage, backendState === 'Healthy' ? 'Active' : 'Pending');
  const alertCount = Array.isArray(viewModel?.alerts) ? viewModel.alerts.length : 0;
  const recoveryCount = Array.isArray(viewModel?.recoveries) ? viewModel.recoveries.length : 0;
  const monitoringStatus = normalizeLabel(viewModel?.monitoring?.backendStatus, backendState);
  const healthLabel = monitoringStatus === 'Healthy' ? 'Healthy' : monitoringStatus === 'Warning' ? 'Warning' : monitoringStatus === 'Offline' ? 'Offline' : 'Unknown';
  const backendOnline = backendState === 'Healthy';
  const alertsStatus = alertCount > 0 ? 'Active' : 'Clean';
  const recoveryStatus = recoveryCount > 0 ? 'Recovering' : 'Healthy';
  const operationsStatus = backendOnline ? 'Healthy' : 'Offline';
  const lastSuccessfulCheck = safeString(backendHealth?.timestamp || viewModel?.monitoring?.lastSuccessfulExecution || viewModel?.workflow?.lastUpdatedAt, 'Unknown');
  const lastWorkflowExecution = safeString(viewModel?.workflow?.lastUpdatedAt || viewModel?.monitoring?.lastSuccessfulExecution, 'Unknown');
  const lastMonitoringUpdate = safeString(viewModel?.monitoring?.lastVerificationTime || lastSuccessfulCheck, 'Unknown');
  const lastRecoveryEvent = safeString(Array.isArray(viewModel?.recoveries) && viewModel.recoveries[0]?.timestamp ? viewModel.recoveries[0].timestamp : 'Unknown', 'Unknown');
  const workflowCount = workflowStatus === 'Healthy' || workflowStatus === 'Running' ? 1 : 0;
  const failedWorkflowCount = workflowStatus === 'Failed' ? 1 : 0;

  return {
    backendStatus: backendState,
    backendOnline,
    apiStatus: backendState,
    operationsStatus,
    workflowStatus,
    monitoringStatus,
    recoveryStatus,
    alertsStatus,
    activeAlertCount: alertCount,
    activeWorkflowCount: workflowCount,
    failedWorkflowCount,
    queueDepth: safeNumber(viewModel?.monitoring?.queueDepth, 0),
    uptimeSeconds: 0,
    responseLatencyMs: safeNumber(viewModel?.monitoring?.processingLatency, 0),
    lastSuccessfulCheck,
    lastWorkflowExecution,
    lastMonitoringUpdate,
    lastRecoveryEvent,
    backendVersion: safeString(backendHealth?.schemaVersion || backendHealth?.version || backendHealth?.backendVersion, 'Unknown'),
    applicationVersion: safeString(options?.applicationVersion || '1.0.0', '1.0.0'),
    fallbackActive: !backendOnline,
    fallbackReason: backendOnline ? 'None' : 'Backend unreachable',
    dataFreshness: backendOnline ? 'Fresh' : 'Stale',
    overallHealth: backendOnline ? 'Healthy' : 'Offline',
    overallHealthScore: backendOnline ? 100 : 20,
    healthLabel,
    workflowLabel: `${workflowStatus} · ${workflowStage}`,
    recoveryCount,
    alertCount,
  };
}

export function buildOperationsViewModel(payload = {}) {
  const workflow = normalizeObject(payload.workflow);
  const recoveries = normalizeArray(payload.recoveries).map((entry) => normalizeObject(entry));
  const auditEvents = normalizeArray(payload.auditEvents).map((entry) => normalizeObject(entry));
  const monitoring = normalizeObject(payload.monitoring);
  const alerts = dedupeAlerts(payload.alerts);

  return {
    workflow: {
      workflowId: safeString(workflow.workflowId || workflow.id, 'workflow-unknown'),
      name: safeString(workflow.name, 'Workflow'),
      currentStage: safeString(workflow.currentStage || workflow.stage, 'Pending'),
      status: safeString(workflow.status, 'Pending'),
      sourceModule: safeString(workflow.sourceModule, 'RSOS'),
      startedAt: safeString(workflow.startedAt, 'Not started'),
      lastUpdatedAt: safeString(workflow.lastUpdatedAt || workflow.updatedAt || workflow.startedAt, 'Not updated'),
      runtime: safeNumber(workflow.runtime, 0),
      completedStages: normalizeArray(workflow.completedStages),
      pendingStages: normalizeArray(workflow.pendingStages),
      failedStage: safeString(workflow.failedStage, 'None'),
      retryCount: safeNumber(workflow.retryCount, 0),
      manualOverrideStatus: safeString(workflow.manualOverrideStatus, 'Not Applied'),
      finalResult: safeString(workflow.finalResult, 'In progress'),
    },
    recoveries: recoveries.map((entry) => ({
      recoveryId: safeString(entry.recoveryId || entry.id, 'recovery-unknown'),
      failureSource: safeString(entry.failureSource, 'Unknown'),
      recoveryStrategy: safeString(entry.recoveryStrategy, 'Unknown'),
      recoveryStatus: safeString(entry.recoveryStatus || entry.status, 'Pending'),
      recoveryDuration: safeNumber(entry.recoveryDuration, 0),
      retryCount: safeNumber(entry.retryCount, 0),
      restoredCheckpoint: safeString(entry.restoredCheckpoint || entry.checkpointId, 'None'),
      result: safeString(entry.result, 'Pending'),
      timestamp: safeString(entry.timestamp, 'Unknown'),
    })),
    auditEvents: auditEvents.map((entry) => ({
      id: safeString(entry.id, 'audit-unknown'),
      timestamp: safeString(entry.timestamp, 'Unknown'),
      actor: safeString(entry.actor || entry.user || entry.actorName || 'System', 'System'),
      module: safeString(entry.module, 'System'),
      action: safeString(entry.action, 'Unknown'),
      target: safeString(entry.target, 'Unknown'),
      priorState: safeString(entry.priorState, 'Unknown'),
      newState: safeString(entry.newState, 'Unknown'),
      result: safeString(entry.result, 'Unknown'),
      manualOverrideIndicator: safeString(entry.manualOverrideIndicator || entry.manualOverride, 'No'),
      correlationId: safeString(entry.correlationId, 'None'),
      workflowId: safeString(entry.workflowId, 'None'),
    })),
    monitoring: {
      healthScore: safeNumber(monitoring.healthScore, 0),
      backendStatus: safeString(monitoring.backendStatus, 'Unknown'),
      apiStatus: safeString(monitoring.apiStatus, 'Unknown'),
      eventBusStatus: safeString(monitoring.eventBusStatus, 'Unknown'),
      schedulerStatus: safeString(monitoring.schedulerStatus, 'Unknown'),
      workflowEngineStatus: safeString(monitoring.workflowEngineStatus, 'Unknown'),
      recoveryEngineStatus: safeString(monitoring.recoveryEngineStatus, 'Unknown'),
      telemetryStatus: safeString(monitoring.telemetryStatus, 'Unknown'),
      queueDepth: safeNumber(monitoring.queueDepth, 0),
      successRate: safeNumber(monitoring.successRate, 0),
      failureRate: safeNumber(monitoring.failureRate, 0),
      averageRuntime: safeNumber(monitoring.averageRuntime, 0),
      processingLatency: safeNumber(monitoring.processingLatency, 0),
      recoveryFrequency: safeNumber(monitoring.recoveryFrequency, 0),
      lastSuccessfulExecution: safeString(monitoring.lastSuccessfulExecution, 'None'),
      lastFailedExecution: safeString(monitoring.lastFailedExecution, 'None'),
      lastVerificationTime: safeString(monitoring.lastVerificationTime, 'Unknown'),
    },
    alerts,
  };
}

export async function fetchOperationsJson(path, options = {}) {
  const response = await fetch(buildApiUrl(path), options);
  if (!response.ok) {
    throw new Error(`Request failed with ${response.status}`);
  }
  return response.json();
}
