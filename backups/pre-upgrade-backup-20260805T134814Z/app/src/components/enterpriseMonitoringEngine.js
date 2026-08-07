import { buildEnterpriseEventBus, enterpriseEventTypes } from './enterpriseEventBus.js';
import { buildEnterpriseTaskScheduler } from './enterpriseTaskScheduler.js';
import { buildEnterpriseWorkflowEngine } from './enterpriseWorkflowEngine.js';

function safeNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function safeString(value, fallback = 'Insufficient Data') {
  if (value === null || value === undefined || value === '') return fallback;
  return typeof value === 'string' ? value : String(value);
}

function normalizeObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function normalizeArray(value) {
  return Array.isArray(value) ? value : [];
}

function deriveStatus(errorCount, success, runtime, queueDepth, memoryUsage) {
  if (errorCount >= 3 || !success) return 'Critical';
  if (errorCount >= 1 || runtime > 50 || queueDepth > 3 || memoryUsage > 150) return 'Warning';
  return 'Healthy';
}

function deriveHealthScore(modules = {}) {
  const values = Object.values(modules);
  if (!values.length) return 100;
  const score = values.reduce((total, module) => {
    switch (module.status) {
      case 'Healthy':
        return total + 100;
      case 'Warning':
        return total + 70;
      case 'Critical':
        return total + 30;
      default:
        return total + 50;
    }
  }, 0) / values.length;
  return Math.max(0, Math.min(100, Math.round(score)));
}

export function buildEnterpriseMonitoringEngine(options = {}) {
  const eventBus = buildEnterpriseEventBus({ retryLimit: 2 });
  const scheduler = buildEnterpriseTaskScheduler({ retryBaseMs: 20 });
  const workflowEngine = buildEnterpriseWorkflowEngine();
  const modules = new Map();
  const healthEvents = [];
  const workflows = new Map();

  const defaultModules = [
    'Executive Intelligence',
    'Forecast Engine',
    'Opportunity Engine',
    'Market Risk Engine',
    'Portfolio Intelligence',
    'Workflow Engine',
    'Enterprise Scheduler',
    'Enterprise Event Bus',
  ];

  defaultModules.forEach((name) => {
    modules.set(name, {
      name,
      status: 'Healthy',
      lastExecution: null,
      runtime: 0,
      errorCount: 0,
      successRate: 100,
      queueDepth: 0,
      memoryUsage: 0,
      processingLatency: 0,
      healthScore: 100,
    });
  });

  function recordModuleExecution(name, payload = {}) {
    const normalized = normalizeObject(payload);
    const moduleState = modules.get(name) || {
      name, status: 'Healthy', lastExecution: null, runtime: 0, errorCount: 0, successRate: 100, queueDepth: 0, memoryUsage: 0, processingLatency: 0, healthScore: 100,
    };

    const success = normalized.success !== false;
    const errorCount = safeNumber(normalized.errorCount);
    const runtime = safeNumber(normalized.runtime);
    const queueDepth = safeNumber(normalized.queueDepth);
    const memoryUsage = safeNumber(normalized.memoryUsage);
    const processingLatency = safeNumber(normalized.processingLatency);
    const status = normalizeObject(payload).status || deriveStatus(errorCount, success, runtime, queueDepth, memoryUsage);

    moduleState.status = status;
    moduleState.lastExecution = new Date().toISOString();
    moduleState.runtime = runtime;
    moduleState.errorCount = errorCount;
    moduleState.successRate = success ? 100 : Math.max(0, 100 - errorCount * 20);
    moduleState.queueDepth = queueDepth;
    moduleState.memoryUsage = memoryUsage;
    moduleState.processingLatency = processingLatency;
    moduleState.healthScore = Math.max(0, Math.min(100, status === 'Healthy' ? 100 : status === 'Warning' ? 70 : 30));

    modules.set(name, moduleState);
    healthEvents.push({
      timestamp: new Date().toISOString(),
      sourceModule: name,
      status,
      runtime,
      errorCount,
      queueDepth,
      memoryUsage,
      processingLatency,
    });

    eventBus.publish(enterpriseEventTypes.DASHBOARD_REFRESH_REQUESTED, { source: name, module: name, status });
    return moduleState;
  }

  function registerWorkflow(workflow = {}, recoveryHandler = null) {
    const normalized = normalizeObject(workflow);
    const workflowId = safeString(normalized.workflowId, `workflow-${Date.now()}`);
    workflows.set(workflowId, {
      workflowId,
      workflow: normalized,
      recoveryHandler,
      lastUpdatedAt: normalized.lastUpdatedAt || new Date().toISOString(),
    });
    return workflowId;
  }

  async function detectAndRecoverStalledWorkflows(options = {}) {
    const stallThresholdMs = safeNumber(options.stallThresholdMs || 1000 * 60 * 3);
    const recovered = [];

    for (const [workflowId, trackedWorkflow] of workflows.entries()) {
      const workflow = trackedWorkflow.workflow || {};
      const lastUpdatedAt = new Date(workflow.lastUpdatedAt || trackedWorkflow.lastUpdatedAt || new Date().toISOString());
      const now = Date.now();
      const isStalled = workflow.status === 'Running' && now - lastUpdatedAt.getTime() > stallThresholdMs;
      if (!isStalled) continue;

      const handler = trackedWorkflow.recoveryHandler;
      const recoveryResult = handler ? await handler({ workflowId, workflow }) : { status: 'Recovered' };
      recovered.push({ workflowId, result: recoveryResult });
      healthEvents.push({
        timestamp: new Date().toISOString(),
        sourceModule: 'Workflow Engine',
        status: 'Recovered',
        workflowId,
        recoveryResult,
      });
      trackedWorkflow.workflow.status = 'Recovered';
      trackedWorkflow.lastUpdatedAt = new Date().toISOString();
    }

    return { recovered, recoveredCount: recovered.length };
  }

  function getMonitoringPayload(options = {}) {
    const context = normalizeObject(options.context);
    const moduleEntries = Array.from(modules.entries()).reduce((accumulator, [name, moduleState]) => {
      accumulator[name] = {
        ...moduleState,
        healthScore: moduleState.healthScore,
      };
      return accumulator;
    }, {});

    return {
      modules: moduleEntries,
      healthScore: deriveHealthScore(moduleEntries),
      events: healthEvents,
      workflows: Array.from(workflows.values()),
      context: {
        manualOverrideStrategy: safeString(context.manualOverrideStrategy, null),
        moduleSnapshot: normalizeObject(context.moduleSnapshot),
      },
      timestamp: new Date().toISOString(),
    };
  }

  return {
    recordModuleExecution,
    registerWorkflow,
    detectAndRecoverStalledWorkflows,
    getMonitoringPayload,
    eventBus,
    scheduler,
    workflowEngine,
  };
}
