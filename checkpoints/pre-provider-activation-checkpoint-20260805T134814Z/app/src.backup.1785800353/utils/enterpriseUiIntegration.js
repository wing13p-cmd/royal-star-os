import { buildApiUrl } from './apiClient.js';

function safeText(value, fallback = 'Insufficient Data') {
  if (value === null || value === undefined || value === '') return fallback;
  return String(value);
}

function safeNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeHealthPayload(payload = {}) {
  return {
    healthy: Boolean(payload?.healthy || payload?.status === 'ok' || payload?.server),
    status: payload?.status === 'ok' ? 'ok' : payload?.status || 'unknown',
    timestamp: payload?.timestamp || null,
    dataFiles: payload?.dataFiles || {},
  };
}

export function createRequestCache() {
  const inflight = new Map();
  return {
    async getOrCreate(key, loader) {
      if (inflight.has(key)) return inflight.get(key);
      const promise = Promise.resolve().then(loader).finally(() => inflight.delete(key));
      inflight.set(key, promise);
      return promise;
    },
  };
}

export function buildDealIntelligenceViewModel({ deal = {}, backendRecord = {}, fallback = {} }) {
  const source = backendRecord && typeof backendRecord === 'object' ? backendRecord : {};
  const base = fallback && typeof fallback === 'object' ? fallback : {};
  return {
    dealId: deal?.id || null,
    propertyAddress: safeText(deal?.propertyAddress || deal?.address, 'Untitled Deal'),
    dealScore: safeNumber(source.dealScore ?? base.dealScore, 0),
    recommendation: safeText(source.recommendation ?? base.recommendation, 'Insufficient Data'),
    riskLevel: safeText(source.riskLevel ?? base.riskLevel, 'Insufficient Data'),
    confidenceScore: safeNumber(source.confidenceScore ?? base.confidenceScore, 0),
    underwritingSummary: safeText(source.underwritingSummary ?? base.underwritingSummary, 'Insufficient Data'),
    arvOutput: safeNumber(source.arvOutput ?? base.arvOutput, 0),
    offerGuidance: safeText(source.offerGuidance ?? base.offerGuidance, 'Insufficient Data'),
    exitStrategyComparison: safeText(source.exitStrategyComparison ?? base.exitStrategyComparison, 'Insufficient Data'),
    capitalRequired: safeNumber(source.capitalRequired ?? base.capitalRequired, 0),
    estimatedProfit: safeNumber(source.estimatedProfit ?? base.estimatedProfit, 0),
    estimatedCashFlow: safeNumber(source.estimatedCashFlow ?? base.estimatedCashFlow, 0),
    majorRiskFlags: Array.isArray(source.majorRiskFlags) ? source.majorRiskFlags : Array.isArray(base.majorRiskFlags) ? base.majorRiskFlags : [],
    requiredFollowUpItems: Array.isArray(source.requiredFollowUpItems) ? source.requiredFollowUpItems : Array.isArray(base.requiredFollowUpItems) ? base.requiredFollowUpItems : [],
    manualOverrideStatus: safeText(source.manualOverrideStatus ?? base.manualOverrideStatus, 'Not Applied'),
  };
}

export function buildExecutiveViewModel({ deals = [], portfolioIntelligence = {}, backendHealth = {} }) {
  const health = normalizeHealthPayload(backendHealth);
  const summary = portfolioIntelligence?.summary || {};
  const priorityScore = safeNumber(summary.healthScore, 0);
  const topRecommendation = safeText(summary.recommendedPortfolioAction || (deals.length ? 'Advance best opportunity' : 'No active deal'), 'No active recommendation');
  const recommendedStrategy = safeText(summary.recommendedPortfolioAction || 'Balanced Growth', 'Balanced Growth');
  const highestPriorityAction = safeText(summary.recommendedPortfolioAction || 'Confirm next best action', 'Confirm next best action');
  const confidenceLevel = health.healthy ? 'High' : 'Low';
  return {
    topRecommendation,
    priorityScore,
    recommendedStrategy,
    highestPriorityAction,
    capitalPreservationAlert: priorityScore < 75 ? 'Preserve liquidity' : 'Capital position is healthy',
    liquidityAlert: priorityScore < 80 ? 'Liquidity is under pressure' : 'Liquidity remains healthy',
    riskReductionAlert: priorityScore < 70 ? 'Reduce concentration risk' : 'Risk is controlled',
    topOpportunity: safeText(deals[0]?.propertyAddress || deals[0]?.address || 'No active deal', 'No active deal'),
    confidenceLevel,
    immediateActionItems: [
      'Review the top deal opportunity',
      health.healthy ? 'Monitor backend health' : 'Restore live backend connectivity',
      'Validate active capital constraints',
    ],
  };
}

export function buildPortfolioViewModel({ portfolioEntries = [], portfolioIntelligence = {} }) {
  const summary = portfolioIntelligence?.summary || {};
  const healthScore = safeNumber(summary.healthScore, 0);
  const portfolioHealthSummary = healthScore >= 85 ? 'Healthy' : healthScore >= 70 ? 'Watch' : 'Risk';
  return {
    portfolioHealthScore: healthScore,
    portfolioHealthSummary,
    diversificationScore: safeNumber(summary.diversificationScore, 0),
    liquidityScore: safeNumber(summary.liquidityScore, 0),
    capitalEfficiency: safeNumber(summary.capitalEfficiency, 0),
    equityPosition: safeNumber(summary.equityPosition, 0),
    cashFlowPerformance: safeNumber(summary.cashFlowPerformance, 0),
    concentrationRisk: safeText(summary.concentrationRisk, 'Insufficient Data'),
    highestRiskAsset: safeText(summary.highestRiskAsset, 'Insufficient Data'),
    highestOpportunityAsset: safeText(summary.highestOpportunityAsset, 'Insufficient Data'),
    portfolioOpportunity: safeText(summary.highestOpportunityAsset, 'No active opportunity'),
    recommendedPortfolioAction: safeText(summary.recommendedPortfolioAction, 'Review portfolio allocation'),
    portfolioFocus: safeText(summary.recommendedPortfolioAction, 'Review portfolio allocation'),
    forecastConfidence: safeText(summary.forecastConfidence, 'Insufficient Data'),
    assetCount: Array.isArray(portfolioEntries) ? portfolioEntries.length : 0,
  };
}

export function buildSystemHealthViewModel({ backendHealth = {}, version = '', configReady = false }) {
  const health = normalizeHealthPayload(backendHealth);
  const healthScore = health.healthy ? 90 : 35;
  return {
    backendStatus: health.healthy ? 'Healthy' : 'Offline',
    apiHealth: health.healthy ? 'Healthy' : 'Offline',
    eventBusStatus: health.healthy ? 'Healthy' : 'Offline',
    schedulerStatus: health.healthy ? 'Healthy' : 'Offline',
    workflowStatus: health.healthy ? 'Healthy' : 'Offline',
    monitoringStatus: health.healthy ? 'Healthy' : 'Offline',
    recoveryReadiness: health.healthy ? 'Ready' : 'Deferred',
    telemetryReadiness: health.healthy ? 'Ready' : 'Deferred',
    lastSuccessfulVerificationTime: health.timestamp || 'Not available',
    currentBuildVersion: safeText(version, 'Unknown'),
    configurationReadiness: configReady ? 'Ready' : 'Pending',
    overallSystemHealthScore: healthScore,
  };
}

export function buildAutomationViewModel({ orchestrator = {} } = {}) {
  const summary = orchestrator?.enterprisePayload?.orchestrationSummary || {};
  const analyticsPayload = orchestrator?.analytics?.getTelemetryPayload?.() || {};
  const telemetrySummary = analyticsPayload.performanceSummary || {};
  const workflowStatus = safeText(summary.workflowStatus, 'Pending');
  const monitoringStatus = safeText(summary.monitoringStatus, 'Pending');
  const recoveryStatus = safeText(summary.recoveryStatus, 'Pending');
  const analyticsHealthScore = safeNumber(telemetrySummary.enterpriseHealthScore, 0);
  return {
    workflowStatus,
    monitoringStatus,
    recoveryStatus,
    analyticsStatus: safeText(summary.analyticsStatus, 'Pending'),
    analyticsHealthScore,
    summaryLabel: `${workflowStatus} · ${monitoringStatus}`,
    recoveryLabel: recoveryStatus,
    telemetryReady: analyticsHealthScore >= 70,
  };
}

export function buildReleaseReadinessViewModel({
  backendHealth = {},
  operationsSummary = {},
  automationSummary = {},
  portfolioIntelligence = {},
  systemHealth = {},
} = {}) {
  const backendHealthy = Boolean(backendHealth?.healthy || systemHealth?.backendStatus === 'Healthy' || systemHealth?.apiHealth === 'Healthy');
  const operationsHealthy = Boolean(
    operationsSummary?.overallHealth === 'Healthy' ||
    operationsSummary?.operationsStatus === 'Healthy' ||
    operationsSummary?.healthLabel === 'Healthy' ||
    operationsSummary?.healthLabel?.toLowerCase?.().includes('healthy')
  );
  const automationReady = Boolean(automationSummary?.telemetryReady || automationSummary?.analyticsHealthScore >= 70);
  const portfolioScore = safeNumber(portfolioIntelligence?.summary?.healthScore, 0);
  const analyticsHealthScore = safeNumber(automationSummary?.analyticsHealthScore, 0);

  const readinessScore = Math.min(100, Math.round(
    (backendHealthy ? 30 : 0) +
    (operationsHealthy ? 20 : 0) +
    (automationReady ? 20 : 0) +
    (portfolioScore >= 70 ? 15 : portfolioScore >= 50 ? 10 : 0) +
    (analyticsHealthScore >= 70 ? 10 : 0) +
    (systemHealth?.backendStatus === 'Healthy' || systemHealth?.apiHealth === 'Healthy' ? 5 : 0)
  ));

  const releaseReady = readinessScore >= 80 && backendHealthy && operationsHealthy && automationReady;

  return {
    statusLabel: releaseReady ? 'Release Ready' : 'Release Review',
    summaryLabel: releaseReady ? 'Release Ready' : 'Release Review',
    readinessScore,
    releaseReady,
    backendHealthy,
    operationsHealthy,
    automationReady,
    portfolioHealthScore: portfolioScore,
  };
}

export async function fetchJsonWithFallback(url, options = {}) {
  const response = await fetch(buildApiUrl(url), options);
  if (!response.ok) {
    throw new Error(`Request failed with ${response.status}`);
  }
  return response.json();
}
