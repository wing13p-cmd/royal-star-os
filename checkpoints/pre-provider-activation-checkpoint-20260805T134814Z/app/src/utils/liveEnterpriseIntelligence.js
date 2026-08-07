import { buildCommandCenterIntelligence } from '../components/commandCenterIntelligence.js';
import { buildPortfolioIntelligence } from '../components/portfolioIntelligence.js';
import { buildUnifiedUnderwritingIntelligence, normalizeDealForIntelligence } from '../components/intelligenceUpgradeEngine.js';
import { buildOperationsStatusSummary, createOperationsService } from './operationsIntegration.js';
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

function buildTopMetrics({ deals = [], properties = [], rehabProjects = [], lenders = [], portfolioEntries = [], alerts = [] }) {
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

export function buildLiveEnterpriseDashboardModel(options = {}) {
  const deals = Array.isArray(options.deals) ? options.deals : [];
  const properties = Array.isArray(options.properties) ? options.properties : [];
  const rehabProjects = Array.isArray(options.rehabProjects) ? options.rehabProjects : [];
  const contractors = Array.isArray(options.contractors) ? options.contractors : [];
  const lenders = Array.isArray(options.lenders) ? options.lenders : [];
  const portfolioEntries = Array.isArray(options.portfolioEntries) ? options.portfolioEntries : [];
  const dealIntelligence = Array.isArray(options.dealIntelligence) ? options.dealIntelligence : [];
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
  });
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
  const intelligenceCards = [
    { label: 'BUSINESS STATUS', value: `${scorecard.enterpriseHealthScore ?? portfolioOverview.healthScore ?? 0}/100 · ${riskSummary.averageRiskScore ?? 0}/100` },
    { label: 'PORTFOLIO HEALTH', value: `${scorecard.portfolioHealthScore ?? portfolioOverview.healthScore ?? 0}/100` },
    { label: 'CAPITAL EFFICIENCY', value: `${scorecard.capitalEfficiencyScore ?? 0}/100` },
    { label: 'RISK EXPOSURE', value: `${scorecard.riskExposureScore ?? portfolioOverview.portfolioRiskScore ?? 0}/100` },
    { label: 'OPS READINESS', value: `${scorecard.operationsReadiness ?? 0}/100` },
    { label: '30D FORECAST', value: forecastingEngine.portfolioValueForecast[0]?.projectedValueDisplay || 'Insufficient Data' },
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
    summaryStats: {
      totalActiveDeals: normalizedDeals.filter((deal) => String(deal.status || '').toLowerCase() === 'active' || String(deal.status || '').toLowerCase() === 'ready to offer').length,
      totalCashDeployed: normalizedDeals.reduce((sum, deal) => sum + safeNumber(deal.purchasePrice || deal.askingPrice || deal.totalCashInvested), 0),
      pipelineValue: normalizedDeals.reduce((sum, deal) => sum + safeNumber(deal.purchasePrice || deal.askingPrice || deal.projectedArv || deal.estimatedArv), 0),
      rehabProjectsInFlight: rehabProjects.filter((project) => String(project.projectStatus || '').toLowerCase() !== 'closed' && String(project.projectStatus || '').toLowerCase() !== 'completed').length,
      totalAlertCount: operationsSummary.alertCount || commandCenterIntelligence.alerts.length,
      totalRecoveryCount: operationsSummary.recoveryCount || 0,
      monitoringStatus: operationsSummary.monitoringStatus || 'Unknown',
      analyticsReady: automationSummary.telemetryReady,
    },
  };
}
