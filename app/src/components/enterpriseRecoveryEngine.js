import { buildEnterpriseEventBus } from './enterpriseEventBus.js';
import { buildEnterpriseTaskScheduler } from './enterpriseTaskScheduler.js';
import { buildEnterpriseMonitoringEngine } from './enterpriseMonitoringEngine.js';
import { buildEnterpriseWorkflowEngine } from './enterpriseWorkflowEngine.js';

function safeString(value, fallback = 'Insufficient Data') {
  if (value === null || value === undefined || value === '') return fallback;
  return typeof value === 'string' ? value : String(value);
}

function safeNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function createRecoveryMetrics(options = {}) {
  return {
    recoveryId: safeString(options.recoveryId || `recovery-${Date.now()}`, `recovery-${Date.now()}`),
    failureSource: safeString(options.failureSource, 'Unknown'),
    recoveryStrategy: safeString(options.recoveryStrategy, 'Unknown'),
    recoveryDuration: safeNumber(options.recoveryDuration),
    success: Boolean(options.success),
    timestamp: new Date().toISOString(),
  };
}

export function buildEnterpriseRecoveryEngine() {
  const eventBus = buildEnterpriseEventBus({ retryLimit: 2 });
  const scheduler = buildEnterpriseTaskScheduler({ retryBaseMs: 20 });
  const monitoringEngine = buildEnterpriseMonitoringEngine();
  const workflowEngine = buildEnterpriseWorkflowEngine();
  const recoveryHistory = [];

  async function recoverWorkflow(input = {}) {
    const workflow = normalizeObject(input.workflow);
    const recoveryHandler = input.recoveryHandler || null;
    const startedAt = Date.now();
    const recoveryResult = recoveryHandler ? await recoveryHandler({ workflow }) : { status: 'Recovered' };
    const metrics = createRecoveryMetrics({
      failureSource: workflow.workflowId || 'Workflow',
      recoveryStrategy: 'Restart failed workflow stages',
      recoveryDuration: Date.now() - startedAt,
      success: recoveryResult?.status === 'Recovered' || recoveryResult?.status === 'Completed',
    });
    recoveryHistory.push({ workflowId: workflow.workflowId, metrics, recoveryResult });
    monitoringEngine.recordModuleExecution('Workflow Engine', {
      status: metrics.success ? 'Healthy' : 'Critical',
      runtime: metrics.recoveryDuration,
      errorCount: metrics.success ? 0 : 1,
      success: metrics.success,
      queueDepth: 0,
      memoryUsage: 50,
      processingLatency: metrics.recoveryDuration,
    });
    return { success: metrics.success, metrics, recoveryResult };
  }

  async function recoverScheduledJobs(input = {}) {
    const job = normalizeObject(input.job);
    const recoveryHandler = input.recoveryHandler || null;
    const startedAt = Date.now();
    const recoveryResult = recoveryHandler ? await recoveryHandler({ job }) : { status: 'Recovered' };
    const metrics = createRecoveryMetrics({
      failureSource: job.id || 'Scheduler',
      recoveryStrategy: 'Reschedule failed job',
      recoveryDuration: Date.now() - startedAt,
      success: recoveryResult?.status === 'Recovered' || recoveryResult?.status === 'Completed',
    });
    recoveryHistory.push({ jobId: job.id, metrics, recoveryResult });
    monitoringEngine.recordModuleExecution('Enterprise Scheduler', {
      status: metrics.success ? 'Healthy' : 'Critical',
      runtime: metrics.recoveryDuration,
      errorCount: metrics.success ? 0 : 1,
      success: metrics.success,
      queueDepth: 1,
      memoryUsage: 60,
      processingLatency: metrics.recoveryDuration,
    });
    return { success: metrics.success, metrics, recoveryResult };
  }

  async function replayMissedEvents(input = {}) {
    const eventName = safeString(input.eventName, 'Unknown Event');
    const recoveryHandler = input.recoveryHandler || null;
    const startedAt = Date.now();
    const recoveryResult = recoveryHandler ? await recoveryHandler({ eventName, payload: input.payload }) : { status: 'Replayed' };
    const metrics = createRecoveryMetrics({
      failureSource: eventName,
      recoveryStrategy: 'Replay missed events',
      recoveryDuration: Date.now() - startedAt,
      success: recoveryResult?.status === 'Replayed' || recoveryResult?.status === 'Completed',
    });
    recoveryHistory.push({ eventName, metrics, recoveryResult });
    monitoringEngine.recordModuleExecution('Enterprise Event Bus', {
      status: metrics.success ? 'Healthy' : 'Critical',
      runtime: metrics.recoveryDuration,
      errorCount: metrics.success ? 0 : 1,
      success: metrics.success,
      queueDepth: 1,
      memoryUsage: 50,
      processingLatency: metrics.recoveryDuration,
    });
    return { success: metrics.success, metrics, recoveryResult };
  }

  async function recoverDependencies(input = {}) {
    const dependencyName = safeString(input.dependencyName, 'Dependency');
    const startedAt = Date.now();
    const recoveryResult = input.recoveryHandler ? await input.recoveryHandler({ dependencyName }) : { status: 'Recovered' };
    const metrics = createRecoveryMetrics({
      failureSource: dependencyName,
      recoveryStrategy: 'Recover dependency failure',
      recoveryDuration: Date.now() - startedAt,
      success: recoveryResult?.status === 'Recovered' || recoveryResult?.status === 'Completed',
    });
    recoveryHistory.push({ dependencyName, metrics, recoveryResult });
    return { success: metrics.success, metrics, recoveryResult };
  }

  async function clearDeadlocks(input = {}) {
    const lockName = safeString(input.lockName, 'Unknown lock');
    const startedAt = Date.now();
    const recoveryResult = input.recoveryHandler ? await input.recoveryHandler({ lockName }) : { status: 'Cleared' };
    const metrics = createRecoveryMetrics({
      failureSource: lockName,
      recoveryStrategy: 'Clear deadlock safely',
      recoveryDuration: Date.now() - startedAt,
      success: recoveryResult?.status === 'Cleared' || recoveryResult?.status === 'Completed',
    });
    recoveryHistory.push({ lockName, metrics, recoveryResult });
    return { success: metrics.success, metrics, recoveryResult };
  }

  async function restoreFromCheckpoint(input = {}) {
    const checkpoint = normalizeObject(input.checkpoint);
    const startedAt = Date.now();
    const recoveryResult = { status: 'Restored', state: checkpoint.state || {} };
    const metrics = createRecoveryMetrics({
      failureSource: safeString(checkpoint.id, 'Checkpoint'),
      recoveryStrategy: 'Restore from rollback checkpoint',
      recoveryDuration: Date.now() - startedAt,
      success: true,
    });
    recoveryHistory.push({ checkpointId: checkpoint.id, metrics, recoveryResult });
    monitoringEngine.recordModuleExecution('Workflow Engine', {
      status: 'Healthy',
      runtime: metrics.recoveryDuration,
      errorCount: 0,
      success: true,
      queueDepth: 0,
      memoryUsage: 50,
      processingLatency: metrics.recoveryDuration,
    });
    return { success: true, metrics, recoveryResult, state: recoveryResult.state };
  }

  function getRecoveryHistory() {
    return recoveryHistory;
  }

  return {
    recoverWorkflow,
    recoverScheduledJobs,
    replayMissedEvents,
    recoverDependencies,
    clearDeadlocks,
    restoreFromCheckpoint,
    getRecoveryHistory,
    eventBus,
    scheduler,
    monitoringEngine,
    workflowEngine,
  };
}
