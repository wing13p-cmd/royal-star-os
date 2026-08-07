import { buildEnterpriseMonitoringEngine } from './enterpriseMonitoringEngine.js';
import { buildEnterpriseRecoveryEngine } from './enterpriseRecoveryEngine.js';
import { buildEnterpriseForecastingEngine } from './enterpriseForecastingEngine.js';

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

function deriveHealthScore(moduleMetrics = {}) {
  const values = Object.values(moduleMetrics);
  if (!values.length) return 100;
  const averageSuccess = values.reduce((sum, item) => sum + safeNumber(item.successRate), 0) / values.length;
  return Math.max(0, Math.min(100, Math.round(averageSuccess * 100)));
}

export function buildEnterpriseAnalyticsEngine(options = {}) {
  const monitoringEngine = buildEnterpriseMonitoringEngine();
  const recoveryEngine = buildEnterpriseRecoveryEngine();
  const analyticsContext = normalizeObject(options);
  const forecastingEngine = buildEnterpriseForecastingEngine({
    deals: normalizeArray(analyticsContext.deals),
    properties: normalizeArray(analyticsContext.properties),
    portfolioIntelligence: normalizeObject(analyticsContext.portfolioIntelligence),
    rehabProjects: normalizeArray(analyticsContext.rehabProjects),
    dealIntelligence: normalizeArray(analyticsContext.dealIntelligence),
  });
  const telemetryModules = new Map();
  const historicalMetrics = [];

  const defaultModules = [
    'Executive Intelligence',
    'Portfolio Intelligence',
    'Forecast Engine',
    'Opportunity Engine',
    'Market Risk Engine',
    'Workflow Engine',
    'Enterprise Scheduler',
    'Enterprise Event Bus',
    'Monitoring Engine',
    'Recovery Engine',
  ];

  defaultModules.forEach((name) => {
    telemetryModules.set(name, {
      name,
      executionCount: 0,
      averageRuntime: 0,
      successRate: 1,
      failureRate: 0,
      queueUtilization: 0,
      workflowThroughput: 0,
      recoveryFrequency: 0,
      forecastAccuracy: 0,
      recommendationAcceptanceRate: 0,
    });
  });

  function recordMetric(name, payload = {}) {
    const normalized = normalizeObject(payload);
    const moduleMetric = telemetryModules.get(name) || {
      name,
      executionCount: 0,
      averageRuntime: 0,
      successRate: 1,
      failureRate: 0,
      queueUtilization: 0,
      workflowThroughput: 0,
      recoveryFrequency: 0,
      forecastAccuracy: 0,
      recommendationAcceptanceRate: 0,
    };

    moduleMetric.executionCount = safeNumber(moduleMetric.executionCount) + safeNumber(normalized.executionCount);
    moduleMetric.averageRuntime = safeNumber(normalized.averageRuntime || moduleMetric.averageRuntime);
    moduleMetric.successRate = safeNumber(normalized.successRate || moduleMetric.successRate);
    moduleMetric.failureRate = safeNumber(normalized.failureRate || moduleMetric.failureRate);
    moduleMetric.queueUtilization = safeNumber(normalized.queueUtilization || moduleMetric.queueUtilization);
    moduleMetric.workflowThroughput = safeNumber(normalized.workflowThroughput || moduleMetric.workflowThroughput);
    moduleMetric.recoveryFrequency = safeNumber(normalized.recoveryFrequency || moduleMetric.recoveryFrequency);
    moduleMetric.forecastAccuracy = safeNumber(normalized.forecastAccuracy || moduleMetric.forecastAccuracy);
    moduleMetric.recommendationAcceptanceRate = safeNumber(normalized.recommendationAcceptanceRate || moduleMetric.recommendationAcceptanceRate);

    telemetryModules.set(name, moduleMetric);
    historicalMetrics.push({
      timestamp: new Date().toISOString(),
      module: name,
      metrics: { ...moduleMetric },
    });
    return moduleMetric;
  }

  function getTelemetryPayload(options = {}) {
    const context = normalizeObject(options.context);
    const moduleMetrics = Array.from(telemetryModules.entries()).reduce((accumulator, [name, metric]) => {
      accumulator[name] = { ...metric };
      return accumulator;
    }, {});

    const performanceSummary = {
      enterpriseHealthScore: deriveHealthScore(moduleMetrics),
      totalExecutions: Object.values(moduleMetrics).reduce((sum, item) => sum + safeNumber(item.executionCount), 0),
      averageRuntime: Object.values(moduleMetrics).reduce((sum, item) => sum + safeNumber(item.averageRuntime), 0) / Math.max(1, Object.keys(moduleMetrics).length),
      averageSuccessRate: Object.values(moduleMetrics).reduce((sum, item) => sum + safeNumber(item.successRate), 0) / Math.max(1, Object.keys(moduleMetrics).length),
      averageRecoveryFrequency: Object.values(moduleMetrics).reduce((sum, item) => sum + safeNumber(item.recoveryFrequency), 0) / Math.max(1, Object.keys(moduleMetrics).length),
    };

    return {
      modules: moduleMetrics,
      historicalMetrics: normalizeArray(historicalMetrics),
      performanceSummary,
      context: {
        manualOverrideStrategy: safeString(context.manualOverrideStrategy, null),
      },
      timestamp: new Date().toISOString(),
    };
  }

  return {
    recordMetric,
    getTelemetryPayload,
    monitoringEngine,
    recoveryEngine,
    forecastingEngine,
    forecastingSummary: forecastingEngine.executiveForecastSummary,
  };
}
