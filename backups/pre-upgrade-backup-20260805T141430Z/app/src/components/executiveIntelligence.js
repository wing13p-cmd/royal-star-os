import { buildExecutiveDecisionExecutionEngine } from './executiveDecisionExecutionEngine.js';
import { buildExecutiveStrategyOptimizationEngine } from './executiveStrategyOptimizationEngine.js';
import { buildEnterpriseForecastingEngine } from './enterpriseForecastingEngine.js';

function safeNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function safeString(value, fallback = 'Insufficient Data') {
  if (value === null || value === undefined || value === '') return fallback;
  return typeof value === 'string' ? value : String(value);
}

function safeDisplay(value, fallback = 'Insufficient Data') {
  if (value === null || value === undefined || value === '' || Number.isNaN(value)) return fallback;
  return value;
}

function formatCurrency(value) {
  const parsed = safeNumber(value);
  if (!Number.isFinite(parsed)) return 'Insufficient Data';
  return `$${parsed.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
}

function normalizeArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeObject(value) {
  return value && typeof value === 'object' ? value : {};
}

function clampScore(value, fallback = 0) {
  const parsed = safeNumber(value, fallback);
  return Math.max(0, Math.min(100, Math.round(parsed)));
}

function parseNumericValue(value) {
  const parsed = Number(value);
  if (Number.isFinite(parsed)) return parsed;
  if (typeof value === 'string') {
    const match = value.match(/-?\d*\.?\d+/);
    return match ? Number(match[0]) : 0;
  }
  return 0;
}

function buildExecutiveCommandCenterScorecard(deal = {}, analysis = {}, portfolioIntelligence = {}, properties = [], rehabProjects = [], contractors = [], lenders = [], dealIntelligence = []) {
  const summary = normalizeObject(portfolioIntelligence?.summary);
  const balanceEngine = normalizeObject(portfolioIntelligence?.portfolioBalancingEngine);
  const reserveShortfall = safeNumber(summary.reserveShortfallValue);
  const recommendedReserve = safeNumber(summary.recommendedReserve || 600000);
  const availableLiquidity = safeNumber(summary.availableLiquidity);
  const healthScore = safeNumber(summary.healthScore);
  const monthlyCashFlow = safeNumber(summary.totalMonthlyCashFlow);
  const criticalAlertCount = safeNumber(summary.criticalAlertCount);
  const propertyList = normalizeArray(properties);
  const rehabList = normalizeArray(rehabProjects);
  const contractorList = normalizeArray(contractors);
  const lenderList = normalizeArray(lenders);
  const dealList = normalizeArray(dealIntelligence);
  const averageDealScore = dealList.length ? dealList.reduce((sum, entry) => sum + safeNumber(entry.dealScore || entry.score), 0) / dealList.length : 0;
  const reserveCoverageRatio = recommendedReserve > 0 ? availableLiquidity / recommendedReserve : 1;
  const delayedProjects = rehabList.filter((project) => project.projectStatus === 'Delayed' || project.currentPhase === 'Delayed').length;
  const criticalRehabCount = rehabList.filter((project) => project.riskLevel === 'Critical').length;
  const activeContractors = contractorList.filter((contractor) => safeString(contractor.insuranceStatus, 'Unknown').toLowerCase() !== 'expired').length;
  const lenderCoverageScore = clampScore(lenderList.length ? lenderList.length * 12 + activeContractors * 4 : 60);
  const financingDscr = parseNumericValue(summary.portfolioDscr || analysis.dscr || 1.2);
  const portfolioHealthScore = clampScore(healthScore || 100 - Math.max(0, criticalAlertCount * 12) - (reserveShortfall > 0 ? 12 : 0));
  const capitalEfficiencyScore = clampScore((reserveCoverageRatio * 100) * 0.6 + Math.max(0, 100 - criticalAlertCount * 8) * 0.4);
  const cashReserveScore = clampScore(100 - Math.min(100, (reserveShortfall / Math.max(recommendedReserve, 1)) * 100) + (monthlyCashFlow > 0 ? 8 : 0) - (reserveShortfall > 0 ? 8 : 0));
  const dealPipelineHealth = clampScore(averageDealScore * 0.7 + (dealList.length ? 12 : 0));
  const rehabPerformanceScore = clampScore(100 - delayedProjects * 18 - criticalRehabCount * 12 - (propertyList.length ? 2 : 0));
  const contractorPerformanceScore = clampScore(100 - Math.max(0, contractorList.length ? 0 : 14) - Math.max(0, contractorList.length - activeContractors) * 8 + (contractorList.length ? 4 : 0));
  const operationsReadiness = clampScore(100 - criticalAlertCount * 12 - Math.max(0, safeNumber(balanceEngine?.portfolioBalanceScore) < 60 ? 8 : 0) + (propertyList.length ? 4 : 0));
  const financingReadiness = clampScore(Math.max(20, Math.min(100, 60 + Math.max(0, financingDscr - 1) * 35 + lenderCoverageScore * 0.1)));
  const growthReadiness = clampScore((portfolioHealthScore + dealPipelineHealth + capitalEfficiencyScore) / 3 + Math.min(20, reserveCoverageRatio * 20));
  const riskExposureScore = clampScore(Math.max(0, Math.min(100, (100 - portfolioHealthScore) * 0.6 + criticalAlertCount * 8 + (reserveShortfall > 0 ? 10 : 0) + safeNumber(analysis.overallRisk) * 0.2)));
  const enterpriseHealthScore = clampScore((portfolioHealthScore + capitalEfficiencyScore + cashReserveScore + dealPipelineHealth + rehabPerformanceScore + contractorPerformanceScore + operationsReadiness + financingReadiness + growthReadiness + (100 - riskExposureScore)) / 10);

  return {
    enterpriseHealthScore,
    portfolioHealthScore,
    capitalEfficiencyScore,
    cashReserveScore,
    dealPipelineHealth,
    rehabPerformanceScore,
    contractorPerformanceScore,
    operationsReadiness,
    financingReadiness,
    growthReadiness,
    riskExposureScore,
    summary: `Enterprise health ${enterpriseHealthScore}/100 with ${riskExposureScore}/100 risk exposure`,
  };
}

function buildNextBestActions(deal = {}, analysis = {}, portfolioIntelligence = {}, properties = [], rehabProjects = [], lenders = []) {
  const actions = [];
  const summary = normalizeObject(portfolioIntelligence?.summary);
  const reserveShortfall = safeNumber(summary.reserveShortfallValue);
  const risk = safeNumber(analysis.overallRisk);
  const negativeEquityProperty = normalizeArray(properties).find((property) => safeNumber(property.currentValue) - safeNumber(property.currentLoanBalance ?? property.debt) < 0 || safeNumber(property.monthlyCashFlow) < 0);
  const rehabRisk = normalizeArray(rehabProjects).find((project) => project.projectStatus === 'Delayed' || project.currentPhase === 'Delayed' || project.riskLevel === 'Critical');
  const relatedRecord = safeString(deal.propertyAddress || deal.propertyName, 'Portfolio');

  if (reserveShortfall > 0) {
    actions.push({ priority: 'CRITICAL', action: 'Preserve liquidity and protect reserves', rationale: 'Reserve coverage is below target and could constrain new commitments.', relatedRecord });
  }
  if (risk >= 60 || safeNumber(analysis.estimatedFlipProfit ?? analysis.projectedProfit) <= 0) {
    actions.push({ priority: 'HIGH', action: 'Re-underwrite the lead opportunity before advancing', rationale: 'The current deal posture needs a tighter underwriting pass before moving forward.', relatedRecord });
  }
  if (negativeEquityProperty) {
    actions.push({ priority: 'HIGH', action: 'Rework the ownership or financing structure', rationale: 'Negative equity needs a re-underwrite or lender conversation to preserve exit options.', relatedRecord: safeString(negativeEquityProperty.propertyName || negativeEquityProperty.address, 'Portfolio') });
  }
  if (rehabRisk) {
    actions.push({ priority: 'MODERATE', action: 'Re-sequence rehab delivery and contractor commitments', rationale: 'Delayed rehab activity is increasing carrying costs and execution risk.', relatedRecord: safeString(rehabRisk.propertyName || rehabRisk.projectName, 'Portfolio') });
  }
  if (lenders.length && safeNumber(summary.portfolioDscr) < 1) {
    actions.push({ priority: 'MODERATE', action: 'Confirm lender options and refinance readiness', rationale: 'Financing readiness is constrained and needs a near-term funding update.', relatedRecord: 'Financing' });
  }

  if (!actions.length) {
    actions.push({ priority: 'MODERATE', action: 'Advance the strongest supported opportunity', rationale: 'The current portfolio is stable enough to move the leading deal forward.', relatedRecord });
  }

  return actions.slice(0, 3);
}

function buildExecutiveAlerts(deal = {}, analysis = {}, portfolioIntelligence = {}, executiveRecommendationEngine = {}, executiveDecisionExecutionEngine = {}) {
  const alerts = [];
  const reserveShortfall = safeNumber(portfolioIntelligence?.summary?.reserveShortfallValue);
  const risk = safeNumber(analysis.overallRisk);
  const cashRequired = safeNumber(analysis.cashRequired);
  const cashOnHand = safeNumber(deal.cashOnHand);
  const portfolioBalancingEngine = normalizeObject(portfolioIntelligence?.portfolioBalancingEngine);

  if (reserveShortfall > 0) {
    alerts.push({ severity: 'CRITICAL', alert: 'Preserve liquidity and protect reserve coverage', message: 'Capital reserve shortfall', relatedRecord: safeString(deal.propertyAddress || deal.propertyName, 'Portfolio'), requiredAction: 'Preserve liquidity and delay new commitments.', relatedModule: 'Portfolio Dashboard' });
  }
  if (risk >= 60) {
    alerts.push({ severity: 'HIGH', alert: 'Re-underwrite the deal before moving forward', message: 'High downside exposure', relatedRecord: safeString(deal.propertyAddress || deal.propertyName, 'Deal'), requiredAction: 'Re-underwrite the deal before moving forward.', relatedModule: 'Deal Intelligence' });
  }
  if (cashRequired > cashOnHand && cashOnHand > 0) {
    alerts.push({ severity: 'HIGH', alert: 'Cash-to-close exceeds available liquidity', message: 'Cash-to-close exceeds available liquidity', relatedRecord: safeString(deal.propertyAddress || deal.propertyName, 'Deal'), requiredAction: 'Rework the funding stack or reduce the offer.', relatedModule: 'Deal Analyzer' });
  }
  if (risk >= 50) {
    alerts.push({ severity: 'HIGH', alert: 'High downside exposure', message: 'High downside exposure', relatedRecord: safeString(deal.propertyAddress || deal.propertyName, 'Deal'), requiredAction: 'Re-underwrite the deal before moving forward.', relatedModule: 'Deal Intelligence' });
  }
  if (safeNumber(analysis.estimatedFlipProfit ?? analysis.projectedProfit) <= 0) {
    alerts.push({ severity: 'MODERATE', alert: 'Projected profit is negative', message: 'Projected profit is negative', relatedRecord: safeString(deal.propertyAddress || deal.propertyName, 'Deal'), requiredAction: 'Reprice the deal or reassess the scope.', relatedModule: 'Deal Analyzer' });
  }
  if (portfolioBalancingEngine?.recommendedAction) {
    alerts.push({ severity: safeNumber(portfolioBalancingEngine.portfolioBalanceScore) < 60 ? 'HIGH' : 'MODERATE', alert: `Portfolio balance recommendation: ${portfolioBalancingEngine.recommendedAction}`, message: `Portfolio balance recommendation: ${portfolioBalancingEngine.recommendedAction}`, relatedRecord: 'Portfolio', requiredAction: 'Review the portfolio balance recommendation and rebalance exposure.', relatedModule: 'Portfolio Balancing Engine' });
  }
  if (Array.isArray(executiveRecommendationEngine?.recommendations) && executiveRecommendationEngine.recommendations.length) {
    executiveRecommendationEngine.recommendations.forEach((recommendation, index) => {
      alerts.push({ severity: recommendation.priorityScore >= 80 ? 'HIGH' : 'MODERATE', alert: `Executive recommendation ${index + 1}: ${recommendation.category}`, message: recommendation.rationale, relatedRecord: recommendation.propertyAddress, requiredAction: recommendation.category, relatedModule: 'Executive Recommendation Engine' });
    });
  }
  if (Array.isArray(executiveDecisionExecutionEngine?.recommendedExecutionOrder) && executiveDecisionExecutionEngine.recommendedExecutionOrder.length) {
    const topAction = executiveDecisionExecutionEngine.recommendedExecutionOrder[0];
    alerts.push({ severity: topAction.priorityScore >= 80 ? 'HIGH' : 'MODERATE', alert: `Executive action queue: ${topAction.actionType}`, message: topAction.rationale, relatedRecord: safeString(deal.propertyAddress || deal.propertyName, 'Portfolio'), requiredAction: topAction.actionType, relatedModule: 'Executive Decision Execution Engine' });
  }

  return alerts;
}

function buildTodaysPriorities(deal = {}, analysis = {}, alerts = [], executiveDecisionExecutionEngine = {}) {
  const priorities = [];
  if (alerts.some((alert) => alert.alert === 'Cash-to-close exceeds available liquidity')) {
    priorities.push({ priority: 'Capital', action: 'Resolve liquidity before proceeding', relatedRecord: safeString(deal.propertyAddress || deal.propertyName, 'Deal') });
  }
  if (safeNumber(analysis.estimatedFlipProfit ?? analysis.projectedProfit) <= 0) {
    priorities.push({ priority: 'Pricing', action: 'Re-underwrite the purchase price or rehab scope', relatedRecord: safeString(deal.propertyAddress || deal.propertyName, 'Deal') });
  }
  if (safeNumber(analysis.supportedBaseArv) <= 0) {
    priorities.push({ priority: 'Valuation', action: 'Request updated comp support or appraisal evidence', relatedRecord: safeString(deal.propertyAddress || deal.propertyName, 'Deal') });
  }
  if (Array.isArray(executiveDecisionExecutionEngine?.recommendedExecutionOrder) && executiveDecisionExecutionEngine.recommendedExecutionOrder.length) {
    const topAction = executiveDecisionExecutionEngine.recommendedExecutionOrder[0];
    priorities.push({ priority: 'Execution', action: topAction.actionType, relatedRecord: safeString(deal.propertyAddress || deal.propertyName, 'Deal') });
  }
  return priorities.slice(0, 5);
}

function buildCapitalReserveMonitor(portfolioIntelligence = {}) {
  const summary = normalizeObject(portfolioIntelligence?.summary);
  const reserveShortfall = safeNumber(summary.reserveShortfallValue);
  const availableLiquidity = safeNumber(summary.availableLiquidity);
  const recommendedReserve = safeNumber(summary.recommendedReserve);
  const portfolioBalancingEngine = normalizeObject(portfolioIntelligence?.portfolioBalancingEngine);
  const status = reserveShortfall > 0 ? 'Capital Shortfall' : availableLiquidity >= recommendedReserve ? 'Capital Available' : 'Limited Capital';

  return {
    status,
    availableLiquidity: formatCurrency(availableLiquidity),
    recommendedReserve: formatCurrency(recommendedReserve),
    reserveShortfall: formatCurrency(reserveShortfall),
    balanceRecommendation: portfolioBalancingEngine?.recommendedAction || null,
  };
}

function buildPortfolioRiskMonitor(properties = [], portfolioIntelligence = {}, rehabProjects = []) {
  const propertyList = normalizeArray(properties);
  const rehabList = normalizeArray(rehabProjects);
  const reserveShortfall = safeNumber(portfolioIntelligence?.summary?.reserveShortfallValue);
  const portfolioBalancingEngine = normalizeObject(portfolioIntelligence?.portfolioBalancingEngine);
  const propertyRisk = propertyList.find((property) => safeNumber(property.currentValue) - safeNumber(property.currentLoanBalance ?? property.debt) < 0 || safeNumber(property.monthlyCashFlow) < 0);
  const rehabRisk = rehabList.find((project) => project.projectStatus === 'Delayed' || project.currentPhase === 'Delayed' || project.riskLevel === 'Critical');
  const balanceScore = safeNumber(portfolioBalancingEngine.portfolioBalanceScore);
  const recommendation = portfolioBalancingEngine.recommendedAction || null;

  if (!propertyRisk && !rehabRisk && reserveShortfall <= 0) {
    return {
      risk: 'Insufficient Data',
      relatedRecord: 'Insufficient Data',
      severity: 'Insufficient Data',
      financialExposure: 'Insufficient Data',
      whyItMatters: 'Insufficient Data',
      requiredAction: 'Insufficient Data',
      relatedModule: 'Insufficient Data',
      portfolioBalanceScore: balanceScore || null,
      recommendedAction: recommendation,
    };
  }

  if (reserveShortfall > 0) {
    return {
      risk: 'Reserve shortfall',
      relatedRecord: 'Portfolio',
      severity: 'CRITICAL',
      financialExposure: formatCurrency(reserveShortfall),
      whyItMatters: 'Liquidity is below the reserve target and could constrain new deals.',
      requiredAction: 'Preserve liquidity and increase reserve coverage',
      relatedModule: 'Portfolio Dashboard',
      portfolioBalanceScore: balanceScore || null,
      recommendedAction: recommendation,
    };
  }

  if (propertyRisk) {
    return {
      risk: 'Negative equity or negative cash flow',
      relatedRecord: safeString(propertyRisk.propertyName || propertyRisk.address, 'Unnamed Property'),
      severity: 'CRITICAL',
      financialExposure: formatCurrency(safeNumber(propertyRisk.currentValue) - safeNumber(propertyRisk.currentLoanBalance ?? property.debt)),
      whyItMatters: 'The asset is carrying pressure that could affect refinance and exit options.',
      requiredAction: 'Re-underwrite the asset and evaluate seller or lender flexibility',
      relatedModule: 'Portfolio Dashboard',
      portfolioBalanceScore: balanceScore || null,
      recommendedAction: recommendation,
    };
  }

  return {
    risk: 'Rehab delay',
    relatedRecord: safeString(rehabRisk.propertyName || rehabRisk.projectName, 'Unnamed Rehab'),
    severity: 'HIGH',
    financialExposure: formatCurrency(safeNumber(rehabRisk.originalRehabBudget || rehabRisk.currentRehabBudget)),
    whyItMatters: 'Delayed rehab work can extend carrying costs and compress profitability.',
    requiredAction: 'Review schedule and contractor delivery plan',
    relatedModule: 'Rehab Project Tracker',
    portfolioBalanceScore: balanceScore || null,
    recommendedAction: recommendation,
  };
}

function buildExecutiveCapitalSignals(capitalAllocationEngine = {}) {
  const recommendations = normalizeArray(capitalAllocationEngine?.executiveCapitalAllocation?.recommendations);
  const ranked = normalizeArray(capitalAllocationEngine?.executiveCapitalAllocation?.rankedOpportunities);
  return {
    recommendations,
    rankedOpportunities: ranked,
    highestPriorityRecommendation: ranked[0] || recommendations[0] || null,
  };
}

function buildBusinessHealth(portfolioIntelligence = {}) {
  const summary = normalizeObject(portfolioIntelligence?.summary);
  const healthScore = safeNumber(summary.healthScore);
  const status = healthScore >= 80 ? 'Strong' : healthScore >= 60 ? 'Watch' : healthScore > 0 ? 'Critical' : 'Insufficient Data';
  const grade = healthScore >= 80 ? 'A' : healthScore >= 60 ? 'C' : healthScore > 0 ? 'F' : 'Insufficient Data';

  return {
    status,
    grade,
    healthScore,
    portfolioHealth: safeDisplay(summary.healthStatus || summary.healthGrade || status, 'Insufficient Data'),
  };
}

function buildCashFlowForecast(portfolioIntelligence = {}) {
  const summary = normalizeObject(portfolioIntelligence?.summary);
  const monthlyCashFlow = safeNumber(summary.totalMonthlyCashFlow);
  if (monthlyCashFlow > 0) {
    return { status: 'Healthy', monthlyCashFlow: formatCurrency(monthlyCashFlow), outlook: 'Positive cash flow supports reserve growth.' };
  }
  if (monthlyCashFlow < 0) {
    return { status: 'At Risk', monthlyCashFlow: formatCurrency(monthlyCashFlow), outlook: 'Negative cash flow requires reserve and operating review.' };
  }
  return { status: 'Insufficient Data', monthlyCashFlow: formatCurrency(monthlyCashFlow), outlook: 'Insufficient Data' };
}

function buildOpportunityRanking(deals = [], dealIntelligence = [], properties = [], portfolioIntelligence = {}) {
  const dealList = normalizeArray(deals);
  const intelligenceEntries = normalizeArray(dealIntelligence);
  const propertyList = normalizeArray(properties);

  const scored = intelligenceEntries.map((entry) => {
    const deal = dealList.find((candidate) => String(candidate.id) === String(entry.dealId) || String(candidate.id) === String(entry.id)) || dealList[0] || {};
    const property = propertyList.find((candidate) => String(candidate.id) === String(deal.linkedPropertyId) || safeString(candidate.propertyName || candidate.address, '') === safeString(deal.propertyAddress || deal.address, '')) || propertyList[0] || {};
    const score = safeNumber(entry.dealScore || entry.score);
    return {
      propertyName: safeString(property.propertyName || property.address || deal.propertyAddress || deal.address || entry.analysisName || entry.dealName, 'Insufficient Data'),
      recommendation: safeString(entry.recommendation || entry.decision || 'Insufficient Data', 'Insufficient Data'),
      strategy: safeString(deal.strategy || property.strategy || 'Hold', 'Insufficient Data'),
      score,
      profit: safeNumber(entry.profit || entry.projectedProfit),
      roi: safeNumber(entry.roi || entry.projectedROI),
      cashRequired: safeDisplay(entry.estimatedCashRequired || entry.cashRequired || portfolioIntelligence?.summary?.cashRequiredForActiveProjects, 'Insufficient Data'),
      mainAdvantage: safeString(entry.mainAdvantage || 'Supported by current underwriting', 'Insufficient Data'),
      mainRisk: safeString(entry.mainRisk || 'Requires confirmation', 'Insufficient Data'),
      requiredNextAction: safeString(entry.requiredNextAction || 'Open analysis for next step', 'Insufficient Data'),
    };
  }).sort((a, b) => safeNumber(b.score) - safeNumber(a.score));

  return scored;
}

function buildSystemHealth(portfolioIntelligence = {}, alerts = [], priorities = []) {
  const summary = normalizeObject(portfolioIntelligence?.summary);
  const healthScore = safeNumber(summary.healthScore);
  const alertCount = normalizeArray(alerts).length;
  const priorityCount = normalizeArray(priorities).length;

  if (!portfolioIntelligence || Object.keys(portfolioIntelligence).length === 0) {
    return { status: 'Insufficient Data', summary: 'Insufficient Data' };
  }

  if (healthScore >= 80 && alertCount === 0 && priorityCount === 0) {
    return { status: 'Healthy', summary: 'All core signals are stable.' };
  }
  if (healthScore >= 60 || alertCount > 0 || priorityCount > 0) {
    return { status: 'Needs Attention', summary: 'Portfolio signals require follow-up.' };
  }
  return { status: 'Insufficient Data', summary: 'Insufficient Data' };
}

export function buildExecutiveIntelligence(payload = {}) {
  const deal = normalizeObject(payload.deal);
  const analysis = normalizeObject(payload.analysis);
  const portfolioIntelligence = normalizeObject(payload.portfolioIntelligence);
  const deals = normalizeArray(payload.deals);
  const dealIntelligence = normalizeArray(payload.dealIntelligence);
  const properties = normalizeArray(payload.properties);
  const rehabProjects = normalizeArray(payload.rehabProjects);
  const contractors = normalizeArray(payload.contractors);
  const lenders = normalizeArray(payload.lenders);

  const executiveRecommendationEngine = normalizeObject(payload.executiveRecommendationEngine);
  const executiveDecisionExecutionEngine = buildExecutiveDecisionExecutionEngine({
    deal,
    analysis,
    portfolioIntelligence,
    executiveRecommendationEngine,
    capitalAllocationEngine: normalizeObject(payload.capitalAllocationEngine),
    marketAnalysis: normalizeObject(payload.marketAnalysis),
    forecastAnalysis: normalizeObject(payload.forecastAnalysis),
    dealIntelligence: normalizeArray(payload.dealIntelligence),
  });
  const executiveStrategyOptimizationEngine = buildExecutiveStrategyOptimizationEngine({
    deal,
    analysis,
    portfolioIntelligence,
    executiveRecommendationEngine,
    executiveActionQueue: executiveDecisionExecutionEngine,
    capitalAllocationEngine: normalizeObject(payload.capitalAllocationEngine),
    marketAnalysis: normalizeObject(payload.marketAnalysis),
    forecastAnalysis: normalizeObject(payload.forecastAnalysis),
  });
  const executiveAlerts = buildExecutiveAlerts(deal, analysis, portfolioIntelligence, executiveRecommendationEngine, executiveDecisionExecutionEngine);
  const todaysPriorities = buildTodaysPriorities(deal, analysis, executiveAlerts, executiveDecisionExecutionEngine);
  const executiveCommandCenter = buildExecutiveCommandCenterScorecard(deal, analysis, portfolioIntelligence, properties, rehabProjects, contractors, lenders, dealIntelligence);
  const nextBestActions = buildNextBestActions(deal, analysis, portfolioIntelligence, properties, rehabProjects, lenders);
  const capitalReserveMonitor = buildCapitalReserveMonitor(portfolioIntelligence);
  const portfolioRiskMonitor = buildPortfolioRiskMonitor(properties, portfolioIntelligence, rehabProjects);
  const portfolioBalancingEngine = normalizeObject(portfolioIntelligence.portfolioBalancingEngine);
  const businessHealth = buildBusinessHealth(portfolioIntelligence);
  const cashFlowForecast = buildCashFlowForecast(portfolioIntelligence);
  const opportunityRanking = buildOpportunityRanking(deals, dealIntelligence, properties, portfolioIntelligence);
  const systemHealth = buildSystemHealth(portfolioIntelligence, executiveAlerts, todaysPriorities);
  const executiveCapitalSignals = buildExecutiveCapitalSignals(payload.capitalAllocationEngine);
  const forecastingEngine = buildEnterpriseForecastingEngine({
    deals,
    properties,
    portfolioIntelligence,
    rehabProjects,
    dealIntelligence,
  });
  const sharedExecutivePayload = {
    recommendedStrategy: executiveStrategyOptimizationEngine.recommendedStrategy,
    prioritizedActionQueue: normalizeArray(executiveDecisionExecutionEngine.recommendedExecutionOrder),
    capitalDeploymentRecommendations: normalizeArray(executiveCapitalSignals.recommendations),
    portfolioBalanceScore: safeNumber(portfolioBalancingEngine.portfolioBalanceScore),
    portfolioDiversificationScore: safeNumber(portfolioBalancingEngine.diversificationScore),
    liquidityScore: safeNumber(portfolioBalancingEngine.liquidityReserveRatio),
    executivePriorityScore: safeNumber(executiveRecommendationEngine?.recommendations?.[0]?.priorityScore),
    confidenceScore: safeNumber(executiveStrategyOptimizationEngine.selectedStrategy?.confidenceScore || executiveStrategyOptimizationEngine.selectedStrategy?.score),
    riskSummary: safeString(portfolioRiskMonitor?.risk || 'Insufficient Data', 'Insufficient Data'),
    executiveAlerts,
    executiveCommandCenter,
    nextBestActions,
    topOpportunities: opportunityRanking.slice(0, 5),
    immediateActionItems: [...todaysPriorities.slice(0, 5), ...nextBestActions.map((action) => ({ priority: action.priority, action: action.action, relatedRecord: action.relatedRecord }))],
    forecastSummary: forecastingEngine.executiveForecastSummary,
    forecastSignals: {
      portfolioValueForecast: forecastingEngine.portfolioValueForecast,
      cashFlowProjection: forecastingEngine.cashFlowProjection,
      refinanceTimingPredictor: forecastingEngine.refinanceTimingPredictor,
      arvConfidenceScore: forecastingEngine.arvConfidenceScore,
      dealProbabilityOfSuccess: forecastingEngine.dealProbabilityOfSuccess,
      exitStrategyRecommendation: forecastingEngine.exitStrategyRecommendation,
      marketTrendScore: forecastingEngine.marketTrendScore,
      capitalDeploymentForecast: forecastingEngine.capitalDeploymentForecast,
    },
  };

  return {
    executiveAlerts,
    todaysPriorities,
    capitalReserveMonitor,
    portfolioRiskMonitor,
    businessHealth,
    cashFlowForecast,
    opportunityRanking,
    systemHealth,
    executiveCapitalSignals,
    executiveRecommendationEngine,
    executiveDecisionExecutionEngine,
    executiveStrategyOptimizationEngine,
    executivePayload: sharedExecutivePayload,
    executiveCommandCenter,
    nextBestActions,
    portfolioForecasts: normalizeArray(portfolioIntelligence.portfolioForecasts),
    portfolioForecastScenarios: normalizeArray(portfolioIntelligence.portfolioForecastScenarios),
    portfolioForecastSummary: normalizeObject(portfolioIntelligence.portfolioForecastSummary),
    integrityAudit: normalizeObject(portfolioIntelligence.integrityAudit),
    portfolioBalancingEngine,
    forecastingEngine,
  };
}
