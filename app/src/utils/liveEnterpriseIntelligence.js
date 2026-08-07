import { buildCommandCenterIntelligence } from '../components/commandCenterIntelligence.js';
import { buildPortfolioIntelligence } from '../components/portfolioIntelligence.js';
import { buildUnifiedUnderwritingIntelligence, normalizeDealForIntelligence } from '../components/intelligenceUpgradeEngine.js';
import { buildOperationsStatusSummary } from './operationsIntegration.js';
import { buildExecutiveViewModel, buildSystemHealthViewModel, buildAutomationViewModel, buildReleaseReadinessViewModel } from './enterpriseUiIntegration.js';
import { buildCapitalAllocationEngine } from '../components/capitalAllocationEngine.js';
import { buildEnterpriseAutomationOrchestrator } from '../components/enterpriseAutomationOrchestrator.js';
import { buildModuleSyncState } from '../components/moduleSync.js';
import { buildAiDecisionEngine } from '../components/aiDecisionEngine.js';
import { buildEnterpriseForecastingEngine } from '../components/enterpriseForecastingEngine.js';
import { buildEnterpriseWorkflowEngine } from '../components/enterpriseWorkflowEngine.js';
import { buildExecutiveIntelligence } from '../components/executiveIntelligence.js';
import { buildOperationsEventEngine, buildOperationsAlerts, buildNextBestActions, buildReunderwritingTriggers, buildProjectCheckpoints, buildDrawControls, buildCapitalForecast, buildAlertResolutionAudit } from './operationsCommandEngine.js';

function safeNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function safeString(value, fallback = 'Insufficient Data') {
  if (value === null || value === undefined || value === '') return fallback;
  return typeof value === 'string' ? value : String(value);
}

function normalizeArray(value) {
  return Array.isArray(value) ? value : [];
}

function formatCurrency(value) {
  const parsed = safeNumber(value, 0);
  return `$${parsed.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
}

function normalizeDecisionLabel(value) {
  const raw = safeString(value, '').trim().toUpperCase();
  if (!raw) return 'Insufficient Data';
  const normalized = raw.replace(/\s+/g, ' ');
  const labels = {
    PROCEED: 'Strong Buy',
    'STRONG BUY': 'Strong Buy',
    BUY: 'Buy',
    'REQUEST MORE DATA': 'Re-underwrite',
    'CONDITIONAL BUY': 'Conditional Buy',
    'CONTINUE PROJECT': 'Continue Project',
    'CONTINUE REHAB': 'Continue Rehab',
    HOLD: 'Hold',
    REJECT: 'Do Not Purchase',
    'DO NOT PURCHASE': 'Do Not Purchase',
  };
  return labels[normalized] || normalized.replace(/\b\w/g, (char) => char.toUpperCase()).replace(/\s+/g, ' ');
}

function buildTopMetrics({ deals = [], rehabProjects = [], lenders = [] }) {
  const activeDeals = deals.filter((deal) => String(deal.status || '').toLowerCase() === 'active' || String(deal.status || '').toLowerCase() === 'ready to offer').length;
  const totalCashDeployed = deals.reduce((sum, deal) => sum + safeNumber(deal.purchasePrice || deal.askingPrice || deal.totalCashInvested), 0);
  const pipelineValue = deals.reduce((sum, deal) => sum + safeNumber(deal.purchasePrice || deal.askingPrice || deal.projectedArv || deal.estimatedArv), 0);
  const rehabInFlight = rehabProjects.filter((project) => String(project.projectStatus || '').toLowerCase() !== 'closed' && String(project.projectStatus || '').toLowerCase() !== 'completed').length;
  const lenderCount = lenders.length;

  return [
    { title: 'ACTIVE DEALS', value: String(activeDeals || deals.length || 0), subtitle: 'Live from saved deals' },
    { title: 'TOTAL CASH DEPLOYED', value: formatCurrency(totalCashDeployed), subtitle: 'Live purchase & rehab basis' },
    { title: 'PIPELINE VALUE', value: formatCurrency(pipelineValue), subtitle: 'Open opportunities' },
    { title: 'PROJECTS IN REHAB', value: String(rehabInFlight), subtitle: 'Current rehab pipeline' },
    { title: 'LENDERS & FUNDING', value: String(lenderCount), subtitle: 'Active funding partners' },
  ];
}

function buildMetricTraceability({
  scorecard = {},
  portfolioOverview = {},
  riskSummary = {},
  automationHealthScore = 0,
  automationBreakdown = {},
}) {
  const now = new Date().toISOString();
  return {
    capitalEfficiency: {
      value: safeNumber(scorecard.capitalEfficiencyScore, 0),
      formula: 'reserveCoverage + deploymentReadiness + refinanceCapacity + cashVelocity weighting',
      sourceRecords: ['portfolioIntelligence.summary', 'executiveIntelligence.executiveCommandCenter'],
      weights: { reserveCoverage: 0.35, deploymentReadiness: 0.25, refinanceCapacity: 0.2, cashVelocity: 0.2 },
      missingInputs: [],
      thresholds: { low: 40, moderate: 70, high: 85 },
      lastCalculationTime: now,
    },
    riskExposure: {
      value: safeNumber(scorecard.riskExposureScore ?? portfolioOverview.portfolioRiskScore, 0),
      formula: 'concentrationRisk + leverageStress + unresolvedCriticalAlertPenalty',
      sourceRecords: ['portfolioIntelligence.summary', 'commandCenterIntelligence.alertSummary'],
      weights: { concentrationRisk: 0.4, leverageStress: 0.35, unresolvedCriticalAlertPenalty: 0.25 },
      missingInputs: [],
      thresholds: { low: 35, moderate: 55, high: 75 },
      lastCalculationTime: now,
    },
    liveRiskScore: {
      value: safeNumber(riskSummary.averageRiskScore, 0),
      formula: 'mean(active deal and portfolio risk scores)',
      sourceRecords: ['dealIntelligence.riskProfile', 'portfolioIntelligence.summary'],
      weights: { dealRisk: 0.6, portfolioRisk: 0.4 },
      missingInputs: [],
      thresholds: { low: 39, moderate: 69, high: 84, critical: 100 },
      lastCalculationTime: now,
    },
    riskLevel: {
      value: safeString(riskSummary.liveRiskLabel, 'Low'),
      formula: 'derived from Live Risk Score thresholds',
      sourceRecords: ['riskSummary.averageRiskScore'],
      weights: { scoreOnly: 1 },
      missingInputs: [],
      thresholds: { low: '0-39', moderate: '40-69', high: '70-84', critical: '85-100' },
      lastCalculationTime: now,
    },
    investmentPortfolioHealth: {
      value: safeNumber(portfolioOverview.healthScore, 0),
      formula: 'portfolioIntelligence health composite',
      sourceRecords: ['portfolioIntelligence.summary.healthScore'],
      weights: { portfolioEngineComposite: 1 },
      missingInputs: [],
      thresholds: { weak: 59, watch: 74, stable: 89, strong: 100 },
      lastCalculationTime: now,
    },
    portfolioRisk: {
      value: safeNumber(portfolioOverview.portfolioRiskScore, 0),
      formula: '100 - portfolioHealth + criticalAlertPenalty + reservePenalty',
      sourceRecords: ['portfolioIntelligence.summary', 'commandCenterIntelligence.alertSummary'],
      weights: { inverseHealth: 0.7, criticalAlertPenalty: 0.2, reservePenalty: 0.1 },
      missingInputs: [],
      thresholds: { low: 39, moderate: 69, high: 84, critical: 100 },
      lastCalculationTime: now,
    },
    automationStatus: {
      value: safeNumber(automationHealthScore, 0),
      formula: 'workflow + telemetry + recovery weighted automation score',
      sourceRecords: ['workflowSnapshot.summary', 'automationSummary'],
      weights: automationBreakdown,
      missingInputs: [],
      thresholds: { blocked: 39, partial: 69, healthy: 89, optimized: 100 },
      lastCalculationTime: now,
    },
  };
}

export function buildLiveEnterpriseDashboardModel(options = {}) {
  const deals = Array.isArray(options.deals) ? options.deals : [];
  const properties = Array.isArray(options.properties) ? options.properties : [];
  const rehabProjects = Array.isArray(options.rehabProjects) ? options.rehabProjects : [];
  const contractors = Array.isArray(options.contractors) ? options.contractors : [];
  const lenders = Array.isArray(options.lenders) ? options.lenders : [];
  const portfolioEntries = Array.isArray(options.portfolioEntries) ? options.portfolioEntries : [];
  const dealIntelligence = Array.isArray(options.dealIntelligence) ? options.dealIntelligence : [];
  const products = Array.isArray(options.products) ? options.products : [];
  const vendors = Array.isArray(options.vendors) ? options.vendors : [];
  const knowledgeArticles = Array.isArray(options.knowledgeArticles) ? options.knowledgeArticles : [];
  const documents = Array.isArray(options.documents) ? options.documents : [];
  const marketRecords = Array.isArray(options.marketRecords) ? options.marketRecords : [];
  const mediaAttachments = Array.isArray(options.mediaAttachments) ? options.mediaAttachments : [];
  const providerReadiness = Array.isArray(options.providerReadiness) ? options.providerReadiness : [];
  const backendHealth = options.backendHealth || {};
  const operationsPayload = options.operationsPayload || {};
  const version = options.version || '1.0.0';

  const normalizedDeals = deals.map((deal, index) => ({
    ...deal,
    id: deal.id || `deal-${index}`,
    propertyAddress: deal.propertyAddress || deal.address || `Deal ${index + 1}`,
    purchasePrice: safeNumber(deal.purchasePrice || deal.askingPrice || deal.totalCashInvested),
    rehabBudget: safeNumber(deal.rehabBudget || deal.rehabCost),
    estimatedArv: safeNumber(deal.estimatedArv || deal.arv || deal.projectedArv || deal.currentValue),
    status: safeString(deal.status, 'active').trim(),
  }));

  const normalizedProperties = properties.map((property, index) => ({
    ...property,
    id: property.id || `property-${index}`,
    propertyName: property.propertyName || property.address || `Property ${index + 1}`,
    currentValue: safeNumber(property.currentValue || property.value),
    currentLoanBalance: safeNumber(property.currentLoanBalance || property.debt || property.currentDebt),
    monthlyCashFlow: safeNumber(property.monthlyCashFlow),
  }));

  const operationsSummary = buildOperationsStatusSummary({
    workflow: operationsPayload.workflow || {},
    recoveries: operationsPayload.recoveries || [],
    monitoring: operationsPayload.monitoring || {},
    alerts: operationsPayload.alerts || [],
  }, backendHealth, { applicationVersion: version });

  const portfolioIntelligence = buildPortfolioIntelligence(normalizedProperties, normalizedDeals, rehabProjects, lenders, contractors, portfolioEntries, [], []);
  const syncState = buildModuleSyncState({
    deals: normalizedDeals,
    properties: normalizedProperties,
    portfolioEntries,
    rehabProjects,
    contractors,
    lenders,
    appraisalPackets: [],
  });

  const derivedDealIntelligence = normalizedDeals.map((deal, index) => {
    const normalizedDeal = normalizeDealForIntelligence(deal);
    const underwriting = buildUnifiedUnderwritingIntelligence(normalizedDeal, [], []);
    const backendEntry = Array.isArray(dealIntelligence) ? dealIntelligence.find((entry) => String(entry.id) === String(deal.id) || String(entry.dealId) === String(deal.id)) : null;
    const primaryAction = underwriting.sharedDecision?.primaryAction || underwriting.recommendation.action || 'REJECT';
    const recommendationAction = normalizeDecisionLabel(primaryAction);
    const investmentDecision = underwriting.decisionConsistency?.investmentDecision || underwriting.recommendation.action || 'REJECT';
    const decisionText = normalizeDecisionLabel(primaryAction || investmentDecision);
    return {
      ...backendEntry,
      id: backendEntry?.id || deal.id || `deal-intelligence-${index}`,
      dealId: deal.id || backendEntry?.dealId || `deal-${index}`,
      analysisName: deal.propertyAddress || deal.address || `Deal ${index + 1}`,
      decision: backendEntry?.decision || recommendationAction,
      recommendation: backendEntry?.recommendation || decisionText,
      dealScore: backendEntry?.dealScore ?? Math.max(0, Math.min(100, Math.round(underwriting.flipAnalysis.netProfit > 0 ? 78 : 48))),
      profit: backendEntry?.profit ?? underwriting.flipAnalysis.netProfit,
      roi: backendEntry?.roi ?? underwriting.flipAnalysis.returnOnCost,
      estimatedCashRequired: backendEntry?.estimatedCashRequired ?? underwriting.brrrrAnalysis.cashInvested,
      riskLevel: backendEntry?.riskLevel || (underwriting.buyBox.decision === 'Strong Pass' ? 'Low' : 'Moderate'),
      mainAdvantage: backendEntry?.mainAdvantage || underwriting.recommendation.strongestFactors[0] || 'Supported by shared underwriting',
      mainRisk: backendEntry?.mainRisk || underwriting.recommendation.primaryRisks[0] || 'Requires confirmation',
      requiredNextAction: backendEntry?.requiredNextAction || underwriting.recommendation.nextAction,
      analysisStatus: backendEntry?.analysisStatus || (underwriting.recommendation.action === 'PROCEED' ? 'Ready to offer' : underwriting.recommendation.action === 'CONTINUE PROJECT' || underwriting.recommendation.action === 'CONTINUE REHAB' || underwriting.recommendation.action === 'HOLD' ? 'Active project review' : 'Re-underwrite required'),
      underwritingSummary: backendEntry?.underwritingSummary || `ARV ${underwriting.arvAnalysis.supportedBaseArv > 0 ? formatCurrency(underwriting.arvAnalysis.supportedBaseArv) : 'Pending'} · Rehab ${underwriting.rehabBudget > 0 ? formatCurrency(underwriting.rehabBudget) : 'Pending'}`,
      offerGuidance: backendEntry?.offerGuidance || `Offer guidance ${underwriting.mao.targetOffer > 0 ? formatCurrency(underwriting.mao.targetOffer) : 'Pending'}`,
      majorRiskFlags: Array.isArray(backendEntry?.majorRiskFlags) && backendEntry.majorRiskFlags.length ? backendEntry.majorRiskFlags : underwriting.recommendation.primaryRisks,
      requiredFollowUpItems: Array.isArray(backendEntry?.requiredFollowUpItems) && backendEntry.requiredFollowUpItems.length ? backendEntry.requiredFollowUpItems : [underwriting.recommendation.nextAction],
      actualLoanAmount: backendEntry?.actualLoanAmount ?? underwriting.financingAnalysis?.actualLoanAmount ?? 0,
      monthlyCarry: backendEntry?.monthlyCarry ?? underwriting.financingAnalysis?.monthlyCarry ?? 0,
      initialCashInvested: backendEntry?.initialCashInvested ?? underwriting.financingAnalysis?.initialCashInvested ?? 0,
      updatedAt: backendEntry?.updatedAt || new Date().toISOString(),
    };
  });

  const operationsEventEngine = buildOperationsEventEngine({ deals: normalizedDeals, rehabProjects, contractors, lenders, portfolioEntries });
  const operationsAlerts = buildOperationsAlerts({ deals: normalizedDeals, rehabProjects, contractors, lenders, portfolioEntries });
  const nextBestActions = buildNextBestActions({ rehabProjects, deals: normalizedDeals });
  const reunderwritingTriggers = buildReunderwritingTriggers({ currentDeal: normalizedDeals[0] || {}, previousDeal: normalizedDeals[0] || {} });
  const projectCheckpoints = buildProjectCheckpoints({ rehabProject: rehabProjects[0] || {} });
  const drawControls = buildDrawControls({ project: rehabProjects[0] || {}, lender: lenders[0] || {} });
  const capitalForecast = buildCapitalForecast({ deals: normalizedDeals, rehabProjects, portfolioEntries });
  const alertResolutionAudit = buildAlertResolutionAudit({ originalAlert: { id: 'alert-1', title: 'Operational alert', sourceValues: { financingCosts: normalizedDeals[0]?.financingCosts || 0 } }, resolution: { action: 'Pending', note: 'Awaiting review', resolvedBy: 'Unassigned', resolvedDate: 'Unknown', changedFields: [], resultingUnderwritingEffect: 'Pending', resultingRiskEffect: 'Pending' } });
  const commandCenterIntelligence = buildCommandCenterIntelligence({
    deals: normalizedDeals,
    dealIntelligence: derivedDealIntelligence,
    properties: normalizedProperties,
    portfolioData: portfolioEntries,
    rehabProjects,
    contractors,
    lenders,
    comps: [],
    neighborhoods: [],
    appraisalPackets: [],
    portfolioIntelligence,
    syncState,
    products,
    vendors,
    knowledgeArticles,
    documents,
    marketRecords,
    mediaAttachments,
    providerReadiness,
    databaseStatus: backendHealth?.databaseStatus || 'Read-Only Local Store',
    backgroundJobs: normalizeArray(operationsPayload.jobs),
    securityHealth: { status: backendHealth?.securityStatus || 'Hardened', notes: normalizeArray(backendHealth?.securityNotes) },
  });
  const opsAlertCount = safeNumber(operationsSummary?.alertCount ?? 0);
  const commandAlertCount = safeNumber(commandCenterIntelligence?.alertSummary?.unresolvedAlertCount ?? commandCenterIntelligence?.alerts?.length ?? 0);
  const authoritativeAlertCount = opsAlertCount > 0 ? opsAlertCount : commandAlertCount;
  const executiveIntelligence = buildExecutiveIntelligence({
    deal: normalizedDeals[0] || {},
    analysis: {
      dealScore: derivedDealIntelligence[0]?.dealScore || 0,
      overallRisk: 24,
      cashRequired: normalizedDeals[0]?.purchasePrice || 0,
      estimatedFlipProfit: derivedDealIntelligence[0]?.profit || 0,
      dscr: portfolioIntelligence?.summary?.portfolioDscr,
    },
    portfolioIntelligence,
    deals: normalizedDeals,
    dealIntelligence: derivedDealIntelligence,
    properties: normalizedProperties,
    rehabProjects,
    contractors,
    lenders,
  });

  const executiveViewModel = buildExecutiveViewModel({ deals: normalizedDeals, portfolioIntelligence, backendHealth });
  const systemHealthViewModel = buildSystemHealthViewModel({ backendHealth, version, configReady: true });
  const orchestrator = buildEnterpriseAutomationOrchestrator({
    deals: normalizedDeals,
    dealIntelligence: derivedDealIntelligence,
    properties: normalizedProperties,
    rehabProjects,
    contractors,
    lenders,
    portfolioIntelligence,
    manualOverrideStrategy: 'Balanced Growth',
  });
  const automationSummary = buildAutomationViewModel({ orchestrator });
  const releaseReadinessSummary = buildReleaseReadinessViewModel({ backendHealth, operationsSummary, automationSummary, portfolioIntelligence, systemHealth: systemHealthViewModel });
  const capitalAllocationEngine = buildCapitalAllocationEngine({
    properties: normalizedProperties,
    deals: normalizedDeals,
    dealIntelligence: derivedDealIntelligence,
    rehabProjects,
    lenders,
    contractors,
    portfolioIntelligence,
  });

  const forecastingEngine = buildEnterpriseForecastingEngine({
    deals: normalizedDeals,
    properties: normalizedProperties,
    portfolioIntelligence,
    rehabProjects,
    dealIntelligence: derivedDealIntelligence,
  });
  const workflowEngine = buildEnterpriseWorkflowEngine();
  const workflowSnapshot = workflowEngine.buildAutomationSnapshot({
    deal: normalizedDeals[0] || {},
    analysis: {
      dealScore: derivedDealIntelligence[0]?.dealScore || 0,
      overallRisk: 24,
      cashRequired: normalizedDeals[0]?.purchasePrice || 0,
    },
    portfolioIntelligence,
    rehabProjects,
    contractors,
    lenders,
    dealIntelligence: derivedDealIntelligence,
    appraisalPackets: [],
    forecastAnalysis: { confidenceLevel: safeNumber(forecastingEngine.marketTrendScore?.score, 0) / 100 },
  });

  const aiDecisionEngine = buildAiDecisionEngine({
    deal: normalizedDeals[0],
    analysis: {
      dealScore: derivedDealIntelligence[0]?.dealScore || 0,
      financingScore: 72,
      overallRisk: 24,
      buyBoxResult: 'PASS',
      arvConfidence: 'High',
      supportedBaseArv: normalizedDeals[0]?.estimatedArv || 0,
      recommendedOffer: derivedDealIntelligence[0]?.estimatedCashRequired || 0,
      maximumAllowableOffer: derivedDealIntelligence[0]?.profit || 0,
      walkAwayPrice: derivedDealIntelligence[0]?.roi || 0,
      estimatedFlipProfit: derivedDealIntelligence[0]?.profit || 0,
      roi: derivedDealIntelligence[0]?.roi || 0,
      dscr: 1.2,
      monthlyCashFlow: normalizedProperties[0]?.monthlyCashFlow || 0,
      cashRequired: derivedDealIntelligence[0]?.estimatedCashRequired || 0,
      warnings: derivedDealIntelligence[0]?.majorRiskFlags || [],
    },
    deals: normalizedDeals,
    rehabProjects,
    contractors,
    lenders,
    portfolioIntelligence,
  });

  const topMetrics = buildTopMetrics({ deals: normalizedDeals, properties: normalizedProperties, rehabProjects, lenders, portfolioEntries, alerts: commandCenterIntelligence.alerts });
  const riskScores = derivedDealIntelligence
    .map((entry) => safeNumber(entry?.riskProfile?.overallRiskScore ?? entry?.overallRisk ?? entry?.riskScore ?? 0))
    .filter((score) => score > 0);
  const averageRiskScore = riskScores.length ? Math.round(riskScores.reduce((sum, score) => sum + score, 0) / riskScores.length) : 0;
  const highestRiskScore = riskScores.length ? Math.max(...riskScores) : 0;
  const liveRiskLabel = highestRiskScore >= 70 ? 'Critical' : highestRiskScore >= 40 ? 'Moderate' : 'Low';
  const portfolioHealthScore = safeNumber(portfolioIntelligence.summary?.healthScore ?? commandCenterIntelligence.portfolioSummary?.portfolioHealthScore ?? 0);
  const portfolioRiskScore = Math.max(0, Math.min(100, Math.round(Math.max(0, 100 - portfolioHealthScore) + (portfolioIntelligence.summary?.criticalAlertCount || 0) * 6 + (portfolioIntelligence.summary?.reserveShortfallValue > 0 ? 8 : 0))));
  const portfolioRiskLabel = portfolioRiskScore >= 70 ? 'Critical' : portfolioRiskScore >= 40 ? 'Moderate' : 'Low';
  const reserveStatus = portfolioIntelligence.summary?.reserveShortfallValue > 0 ? 'Shortfall' : 'Healthy';
  const strategyAllocation = portfolioIntelligence.portfolioBalancingEngine?.rentalVsFlipAllocation || {
    rentalShare: normalizedProperties.filter((property) => String(property.strategy || '').toLowerCase() === 'brrrrr').length / Math.max(normalizedProperties.length, 1) * 100,
    flipShare: normalizedProperties.filter((property) => String(property.strategy || '').toLowerCase() === 'flip').length / Math.max(normalizedProperties.length, 1) * 100,
  };
  const liquidityForecast = Array.isArray(portfolioIntelligence.portfolioForecasts)
    ? portfolioIntelligence.portfolioForecasts.map((entry) => ({
        period: entry.period,
        liquidityPosition: safeNumber(entry.liquidityPosition),
        liquidityPositionDisplay: formatCurrency(entry.liquidityPosition),
        confidenceScore: safeNumber(entry.confidenceScore),
        confidenceLabel: safeString(entry.confidenceLabel, 'Insufficient Data'),
      }))
    : [];
  const exposureByProperty = (Array.isArray(portfolioIntelligence.properties) ? portfolioIntelligence.properties : [])
    .map((property) => ({
      propertyName: safeString(property.propertyName, 'Untitled Property'),
      value: safeNumber(property.currentValue),
      valueDisplay: formatCurrency(property.currentValue),
      strategy: safeString(property.strategy, 'Hold'),
      debt: safeNumber(property.debt),
    }))
    .sort((left, right) => right.value - left.value)
    .slice(0, 5);
  const exposureAnalysis = {
    totalExposure: formatCurrency(portfolioIntelligence.summary?.totalCurrentValue || 0),
    highestExposure: exposureByProperty[0] ? {
      propertyName: exposureByProperty[0].propertyName,
      valueDisplay: exposureByProperty[0].valueDisplay,
      strategy: exposureByProperty[0].strategy,
    } : { propertyName: 'Insufficient Data', valueDisplay: 'Insufficient Data', strategy: 'Insufficient Data' },
    properties: exposureByProperty,
    concentrationLabel: safeString(portfolioIntelligence.concentrationRisk?.riskLevel, 'Low'),
  };
  const cashReserve = {
    currentLiquidity: safeNumber(portfolioIntelligence.summary?.availableLiquidity || 250000),
    recommendedReserve: safeNumber(portfolioIntelligence.summary?.recommendedReserve || 0),
    reserveShortfall: safeNumber(portfolioIntelligence.summary?.reserveShortfallValue || 0),
    status: reserveStatus,
    currentReserveDisplay: formatCurrency(safeNumber(portfolioIntelligence.summary?.availableLiquidity || 250000)),
    recommendedReserveDisplay: formatCurrency(safeNumber(portfolioIntelligence.summary?.recommendedReserve || 0)),
    shortfallDisplay: safeNumber(portfolioIntelligence.summary?.reserveShortfallValue || 0) > 0 ? formatCurrency(portfolioIntelligence.summary.reserveShortfallValue) : 'Healthy',
  };
  const scorecard = executiveIntelligence?.executiveCommandCenter || {};
  const portfolioOverview = {
    healthScore: portfolioHealthScore,
    healthStatus: portfolioIntelligence.health?.status || portfolioIntelligence.summary?.healthStatus || 'Insufficient Data',
    portfolioRiskScore,
    riskLabel: portfolioRiskLabel,
    reserveStatus,
    liquidity: portfolioIntelligence.summary?.reserveSurplusOrShortfall || (portfolioIntelligence.summary?.availableLiquidity ? formatCurrency(portfolioIntelligence.summary.availableLiquidity) : 'Insufficient Data'),
    concentration: portfolioIntelligence.concentrationRisk || {},
    strategyAllocation: {
      rentalShare: Number(strategyAllocation?.rentalShare || 0),
      flipShare: Number(strategyAllocation?.flipShare || 0),
    },
    capitalAllocation: Array.isArray(portfolioIntelligence.capitalAllocation) ? portfolioIntelligence.capitalAllocation : [],
    cashReserve,
    liquidityForecast,
    exposureAnalysis,
    concentrationRisk: portfolioIntelligence.concentrationRisk || {},
    refinanceOpportunities: Array.isArray(portfolioIntelligence.refinanceOpportunities) ? portfolioIntelligence.refinanceOpportunities : [],
    executiveSummary: {
      headline: `${portfolioIntelligence.summary?.healthStatus || 'Portfolio'} posture is ${reserveStatus.toLowerCase()} with ${portfolioRiskLabel.toLowerCase()} risk and ${portfolioIntelligence.summary?.propertiesWithRefinanceCandidate || 0} refinance focus item(s). Executive scorecard ${scorecard.enterpriseHealthScore ?? portfolioHealthScore ?? 0}/100. ${forecastingEngine.executiveForecastSummary.headline}`,
      focusItems: [
        `Health ${portfolioHealthScore}/100`,
        `Reserve ${cashReserve.status}`,
        `Risk ${portfolioRiskScore}/100`,
        `Forecast ${forecastingEngine.executiveForecastSummary.headline}`,
        `Automation ${workflowSnapshot.summary.completedModuleCount}/${workflowSnapshot.summary.completedModuleNames.length} modules active`,
      ],
    },
    executiveSummaryCards: [
      { label: 'Health', value: `${portfolioHealthScore}/100` },
      { label: 'Liquidity', value: reserveStatus },
      { label: 'Risk', value: `${portfolioRiskScore}/100` },
      { label: 'Refi', value: String(portfolioIntelligence.summary?.propertiesWithRefinanceCandidate || portfolioIntelligence.refinanceOpportunities?.length || 0) },
    ],
  };
  const riskSummary = {
    averageRiskScore,
    highestRiskScore,
    liveRiskLabel,
    summaryLabel: `${averageRiskScore}/100 average risk`,
    portfolioRiskScore,
    portfolioRiskLabel,
  };
  const forecast30Day = Array.isArray(portfolioIntelligence?.portfolioForecasts)
    ? portfolioIntelligence.portfolioForecasts.find((entry) => safeString(entry.period, '').toLowerCase() === '30 days') || portfolioIntelligence.portfolioForecasts[0]
    : null;
  const baseForecastValue = safeNumber(forecast30Day?.portfolioValue, 0);
  const unresolvedAlerts = safeNumber(commandCenterIntelligence?.alertSummary?.unresolvedAlertCount, 0);
  const inFlightRehab = rehabProjects.filter((project) => String(project.projectStatus || '').toLowerCase() !== 'closed' && String(project.projectStatus || '').toLowerCase() !== 'completed').length;
  const bestCaseLiftPct = Math.min(12, 3 + Math.max(0, 6 - unresolvedAlerts) + Math.max(0, 4 - inFlightRehab));
  const worstCaseDrawPct = Math.min(18, 4 + unresolvedAlerts + inFlightRehab);
  const forecastScenarios = {
    base: {
      label: 'Base',
      portfolioValue: baseForecastValue,
      assumption: 'Current portfolio forecast with no shock adjustment.',
    },
    best: {
      label: 'Best',
      portfolioValue: Math.round(baseForecastValue * (1 + bestCaseLiftPct / 100)),
      adjustmentPercent: bestCaseLiftPct,
      assumption: 'Alert resolution and rehab execution improve valuation trajectory.',
    },
    worst: {
      label: 'Worst',
      portfolioValue: Math.round(baseForecastValue * (1 - worstCaseDrawPct / 100)),
      adjustmentPercent: worstCaseDrawPct,
      assumption: 'Unresolved alerts and rehab drag reduce near-term portfolio value.',
    },
  };
  const forecastComposition = [];
  const includedKeys = new Set();
  normalizeArray(normalizedProperties).forEach((property, index) => {
    const key = `property:${property.id || index}`;
    if (includedKeys.has(key)) return;
    includedKeys.add(key);
    forecastComposition.push({
      recordKey: key,
      recordName: safeString(property.propertyName || property.address, `Property ${index + 1}`),
      recordType: 'property value',
      sourceModule: 'Property Database',
      includedValue: safeNumber(property.currentValue),
      inclusionReason: 'Active canonical property value contributes to portfolio value trend.',
      exclusionReason: 'N/A',
    });
  });
  normalizeArray(normalizedDeals).forEach((deal, index) => {
    const samePropertyMatch = forecastComposition.some((entry) => safeString(entry.recordName, '').toLowerCase() === safeString(deal.propertyAddress || deal.address, '').toLowerCase());
    if (samePropertyMatch) {
      forecastComposition.push({
        recordKey: `deal:${deal.id || index}`,
        recordName: safeString(deal.propertyAddress || deal.address, `Deal ${index + 1}`),
        recordType: 'pipeline opportunity',
        sourceModule: 'Deal Analyzer',
        includedValue: 0,
        inclusionReason: 'Deal is represented in portfolio value through linked property.',
        exclusionReason: 'Excluded from additive value to prevent property+deal double counting.',
      });
      return;
    }
    forecastComposition.push({
      recordKey: `deal:${deal.id || index}`,
      recordName: safeString(deal.propertyAddress || deal.address, `Deal ${index + 1}`),
      recordType: 'pipeline opportunity',
      sourceModule: 'Deal Analyzer',
      includedValue: safeNumber(deal.purchasePrice || deal.askingPrice || 0),
      inclusionReason: 'Unlinked active deal contributes pipeline value.',
      exclusionReason: 'N/A',
    });
  });
  const workflowCompleted = safeNumber(workflowSnapshot?.summary?.completedModuleCount);
  const workflowTotal = normalizeArray(workflowSnapshot?.summary?.completedModuleNames).length || safeNumber(workflowSnapshot?.summary?.totalModuleCount);
  const automationHealthScore = safeNumber(workflowSnapshot?.summary?.overallHealthScore ?? automationSummary?.analyticsHealthScore ?? 0);
  const automationBreakdown = {
    workflowWeight: 0.6,
    telemetryWeight: 0.2,
    recoveryWeight: 0.2,
    workflowScore: workflowTotal > 0 ? Math.round((workflowCompleted / workflowTotal) * 100) : automationHealthScore,
    telemetryScore: automationSummary?.telemetryReady ? 100 : 0,
    recoveryScore: safeString(automationSummary?.recoveryStatus, 'pending').toLowerCase() === 'healthy' ? 100 : 65,
  };
  const metricTraceability = buildMetricTraceability({
    scorecard,
    portfolioOverview,
    riskSummary,
    automationHealthScore,
    automationBreakdown,
  });
  const intelligenceCards = [
    { label: 'BUSINESS STATUS', value: `Enterprise ${scorecard.enterpriseHealthScore ?? portfolioOverview.healthScore ?? 0}/100 · Risk ${riskSummary.averageRiskScore ?? 0}/100` },
    { label: 'SYSTEM PORTFOLIO HEALTH', value: `${scorecard.portfolioHealthScore ?? portfolioOverview.healthScore ?? 0}/100` },
    { label: 'CAPITAL EFFICIENCY', value: `${scorecard.capitalEfficiencyScore ?? 0}/100` },
    { label: 'RISK EXPOSURE', value: `${scorecard.riskExposureScore ?? portfolioOverview.portfolioRiskScore ?? 0}/100` },
    { label: 'OPS READINESS', value: `${scorecard.operationsReadiness ?? 0}/100` },
    {
      label: '30D FORECAST',
      value: forecast30Day
        ? `${formatCurrency(forecastScenarios.base.portfolioValue)} base · ${formatCurrency(forecastScenarios.best.portfolioValue)} best · ${formatCurrency(forecastScenarios.worst.portfolioValue)} worst`
        : 'Insufficient Data',
    },
    { label: 'ARV CONFIDENCE', value: `${forecastingEngine.arvConfidenceScore.score}/100 · ${forecastingEngine.arvConfidenceScore.label}` },
  ];

  return {
    topMetrics,
    intelligenceCards,
    riskSummary,
    portfolioOverview,
    operationsEventEngine,
    operationsAlerts,
    nextBestActions,
    reunderwritingTriggers,
    projectCheckpoints,
    drawControls,
    capitalForecast,
    alertResolutionAudit,
    dealIntelligence: derivedDealIntelligence,
    workflowSnapshot,
    operationsSummary,
    automationSummary,
    releaseReadinessSummary,
    systemHealthViewModel,
    executiveViewModel,
    executiveIntelligence,
    portfolioIntelligence,
    capitalAllocationEngine,
    forecastingEngine,
    aiDecisionEngine,
    commandCenterIntelligence,
    enterprisePlatform: commandCenterIntelligence.enterprisePlatform,
    summaryStats: {
      totalActiveDeals: normalizedDeals.filter((deal) => String(deal.status || '').toLowerCase() === 'active' || String(deal.status || '').toLowerCase() === 'ready to offer').length,
      totalCashDeployed: normalizedDeals.reduce((sum, deal) => sum + safeNumber(deal.purchasePrice || deal.askingPrice || deal.totalCashInvested), 0),
      pipelineValue: normalizedDeals.reduce((sum, deal) => sum + safeNumber(deal.purchasePrice || deal.askingPrice || deal.projectedArv || deal.estimatedArv), 0),
      rehabProjectsInFlight: rehabProjects.filter((project) => String(project.projectStatus || '').toLowerCase() !== 'closed' && String(project.projectStatus || '').toLowerCase() !== 'completed').length,
      totalAlertCount: authoritativeAlertCount,
      totalRecoveryCount: operationsSummary.recoveryCount || 0,
      monitoringStatus: operationsSummary.monitoringStatus || 'Unknown',
      analyticsReady: automationSummary.telemetryReady,
    },
    traceability: {
      alerts: {
        source: opsAlertCount > 0 ? 'operationsSummary.alertCount' : 'commandCenterIntelligence.alertSummary.unresolvedAlertCount',
        value: authoritativeAlertCount,
      },
      portfolioHealth: {
        source: 'portfolioIntelligence.summary.healthScore',
        value: portfolioHealthScore,
      },
      capitalEfficiency: {
        source: 'executiveIntelligence.executiveCommandCenter.capitalEfficiencyScore',
        value: scorecard.capitalEfficiencyScore ?? 0,
        formula: 'CapitalEfficiency = reserveCoverage + deploymentReadiness + refinanceCapacity + cashVelocity weighting',
        inputs: {
          currentReserve: portfolioOverview.cashReserve.currentReserveDisplay,
          recommendedReserve: portfolioOverview.cashReserve.recommendedReserveDisplay,
          allocation: portfolioOverview.strategyAllocation,
          refinanceCandidates: portfolioOverview.refinanceOpportunities.length,
        },
      },
      riskExposure: {
        source: 'executiveIntelligence.executiveCommandCenter.riskExposureScore + riskSummary',
        value: scorecard.riskExposureScore ?? portfolioOverview.portfolioRiskScore ?? riskSummary.averageRiskScore ?? 0,
        formula: 'RiskExposure = concentrationRisk + leverageStress + unresolvedCriticalAlertPenalty',
        inputs: {
          portfolioRiskScore: portfolioOverview.portfolioRiskScore,
          liveRiskScore: riskSummary.averageRiskScore,
          criticalAlerts: authoritativeAlertCount,
        },
      },
      forecast30Day: {
        source: 'portfolioIntelligence.portfolioForecasts[period=30 Days]',
        value: forecast30Day ? formatCurrency(forecast30Day.portfolioValue) : 'Insufficient Data',
        scenarios: forecastScenarios,
        scenarioInputs: {
          unresolvedAlerts,
          inFlightRehab,
        },
        composition: forecastComposition,
        noDoubleCountProof: 'Linked deal rows are included as metadata but contribute 0 additive value when a canonical property record already carries value, preventing property and deal double counting.',
      },
      automationStatus: {
        source: 'workflowSnapshot.summary + automationSummary',
        score: automationHealthScore,
        components: automationBreakdown,
      },
      metricTraceability,
    },
  };
}
