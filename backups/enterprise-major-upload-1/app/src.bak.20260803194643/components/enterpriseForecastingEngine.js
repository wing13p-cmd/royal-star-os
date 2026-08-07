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

function normalizeArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}

function buildPortfolioValueForecast(properties = [], portfolioIntelligence = {}) {
  const propertyList = normalizeArray(properties);
  const summary = normalizeObject(portfolioIntelligence?.summary);
  const baseValue = safeNumber(summary.totalCurrentValue || propertyList.reduce((sum, property) => sum + safeNumber(property.currentValue), 0), 0);
  const periods = [30, 90, 180, 365];
  return periods.map((days) => {
    const growthFactor = days <= 30 ? 0.01 : days <= 90 ? 0.025 : days <= 180 ? 0.04 : 0.06;
    const projectedValue = baseValue * (1 + growthFactor);
    return {
      days,
      label: `${days} Days`,
      projectedValue,
      projectedValueDisplay: formatCurrency(projectedValue),
      growthRate: growthFactor * 100,
      confidenceScore: safeNumber(portfolioIntelligence?.portfolioForecastSummary?.confidenceScore || 70),
    };
  });
}

function buildCashFlowProjection(properties = [], portfolioIntelligence = {}) {
  const summary = normalizeObject(portfolioIntelligence?.summary);
  const monthlyCashFlow = safeNumber(summary.totalMonthlyCashFlow || properties.reduce((sum, property) => sum + safeNumber(property.monthlyCashFlow), 0), 0);
  if (monthlyCashFlow === 0) {
    return {
      status: 'Insufficient Data',
      monthlyCashFlow: formatCurrency(0),
      projectedAnnualCashFlow: 0,
      projectedAnnualCashFlowDisplay: formatCurrency(0),
      outlook: 'Insufficient Data',
    };
  }
  const annualCashFlow = monthlyCashFlow * 12;
  return {
    status: monthlyCashFlow > 0 ? 'Healthy' : 'At Risk',
    monthlyCashFlow: formatCurrency(monthlyCashFlow),
    projectedAnnualCashFlow: annualCashFlow,
    projectedAnnualCashFlowDisplay: formatCurrency(annualCashFlow),
    outlook: monthlyCashFlow > 0 ? 'Positive operating cash flow supports reserve growth.' : 'Cash flow pressure requires additional review.',
  };
}

function buildRefinanceTimingPredictor(properties = [], portfolioIntelligence = {}) {
  const propertyList = normalizeArray(properties);
  const refinanceCandidate = propertyList.find((property) => property.refinanceCandidate || safeNumber(property.currentValue) > safeNumber(property.currentLoanBalance ?? property.debt) * 1.15);
  if (!refinanceCandidate) {
    return {
      timingLabel: 'Insufficient Data',
      recommendation: 'Hold',
      estimatedWindow: 'Insufficient Data',
      likelyValueRelease: formatCurrency(0),
      confidence: 0,
    };
  }
  const loanMaturityDate = safeString(refinanceCandidate.loanMaturityDate, '');
  const maturityDays = loanMaturityDate ? Math.max(0, Math.round((Date.parse(loanMaturityDate) - Date.now()) / (1000 * 60 * 60 * 24))) : 0;
  let timingLabel = 'Near Term';
  if (maturityDays > 180) timingLabel = 'Medium Term';
  if (maturityDays > 365) timingLabel = 'Long Term';
  const likelyValueRelease = Math.max(0, safeNumber(refinanceCandidate.currentValue) * 0.7 - safeNumber(refinanceCandidate.currentLoanBalance ?? refinanceCandidate.debt));
  return {
    timingLabel,
    recommendation: 'Refinance',
    estimatedWindow: maturityDays > 0 ? `${maturityDays} days` : 'Immediate',
    likelyValueRelease,
    likelyValueReleaseDisplay: formatCurrency(likelyValueRelease),
    confidence: clamp(70 + (safeNumber(portfolioIntelligence?.summary?.healthScore, 0) > 80 ? 10 : 0), 0, 100),
  };
}

function buildArvConfidenceScore(deals = [], portfolioIntelligence = {}) {
  const dealList = normalizeArray(deals);
  const summary = normalizeObject(portfolioIntelligence?.summary);
  const supportedArv = safeNumber(summary.totalSupportedArv || dealList.reduce((sum, deal) => sum + safeNumber(deal.estimatedArv), 0), 0);
  const currentValue = safeNumber(summary.totalCurrentValue || 0, 0);
  const ratio = currentValue > 0 ? supportedArv / currentValue : 0;
  const score = clamp(Math.round(60 + ratio * 20 + (dealList.length > 0 ? 8 : 0)), 0, 100);
  return {
    score,
    label: score >= 80 ? 'High' : score >= 60 ? 'Moderate' : 'Low',
    supportingValue: formatCurrency(supportedArv),
  };
}

function buildRehabBudgetVarianceForecast(rehabProjects = []) {
  const projects = normalizeArray(rehabProjects);
  const baselineBudget = projects.reduce((sum, project) => sum + safeNumber(project.originalRehabBudget || project.rehabBudget || project.estimatedBudget), 0);
  const actualCost = projects.reduce((sum, project) => sum + safeNumber(project.actualCost || project.actualRehabCost || 0), 0);
  const projectedVariance = Math.max(0, actualCost - baselineBudget);
  return {
    baselineBudget,
    baselineBudgetDisplay: formatCurrency(baselineBudget),
    projectedVarianceAmount: projectedVariance,
    projectedVarianceDisplay: formatCurrency(projectedVariance),
    status: projectedVariance > 0 ? 'Over Budget' : 'On Track',
  };
}

function buildDealProbabilityOfSuccess(dealIntelligence = [], deals = []) {
  const intelligence = normalizeArray(dealIntelligence);
  const dealList = normalizeArray(deals);
  const topDeal = intelligence[0] || dealList[0] || {};
  const score = safeNumber(topDeal.dealScore, 0);
  const recommendationFactor = safeString(topDeal.recommendation, '').toLowerCase().includes('strong') ? 12 : safeString(topDeal.recommendation, '').toLowerCase().includes('buy') ? 6 : 0;
  const probability = clamp(Math.round(score * 0.7 + recommendationFactor), 0, 100);
  return {
    probability,
    label: probability >= 80 ? 'High' : probability >= 60 ? 'Moderate' : 'Low',
  };
}

function buildExitStrategyRecommendation(properties = [], deals = [], portfolioIntelligence = {}) {
  const propertyList = normalizeArray(properties);
  const dealList = normalizeArray(deals);
  const summary = normalizeObject(portfolioIntelligence?.summary);
  const hasRefinanceCandidate = propertyList.some((property) => property.refinanceCandidate);
  const hasFlipStrategy = dealList.some((deal) => String(deal.strategy || '').toLowerCase() === 'flip');
  const hasBrrrrStrategy = dealList.some((deal) => String(deal.strategy || '').toLowerCase() === 'brrrrr');
  if (hasRefinanceCandidate && summary.totalMonthlyCashFlow > 0) return { recommendation: 'BRRRR', rationale: 'Refinance support and positive cash flow favor a BRRRR-style hold.' };
  if (hasFlipStrategy) return { recommendation: 'Flip', rationale: 'Flipping remains the strongest near-term value capture path.' };
  if (hasBrrrrStrategy) return { recommendation: 'BRRRR', rationale: 'The portfolio has rental income characteristics suitable for BRRRR.' };
  return { recommendation: 'Hold', rationale: 'Insufficient data supports a more aggressive rollout.' };
}

function buildMarketTrendScore(portfolioIntelligence = {}) {
  const summary = normalizeObject(portfolioIntelligence?.summary);
  const healthScore = safeNumber(summary.healthScore, 0);
  const trendScore = clamp(Math.round(healthScore * 0.55 + safeNumber(portfolioIntelligence?.portfolioForecastSummary?.confidenceScore, 0) * 0.35), 0, 100);
  return {
    score: trendScore,
    label: trendScore >= 80 ? 'Strong' : trendScore >= 60 ? 'Stable' : 'Mixed',
  };
}

function buildCapitalDeploymentForecast(portfolioIntelligence = {}) {
  const summary = normalizeObject(portfolioIntelligence?.summary);
  const availableLiquidity = safeNumber(summary.availableLiquidity || 250000, 0);
  const reserveShortfall = safeNumber(summary.reserveShortfallValue, 0);
  const deployableCapital = Math.max(0, availableLiquidity - reserveShortfall);
  return {
    recommendedDeployment: deployableCapital,
    recommendedDeploymentDisplay: formatCurrency(deployableCapital),
    reserveStatus: reserveShortfall > 0 ? 'Reserve Shortfall' : 'Ready',
  };
}

function buildExecutiveForecastSummary(options = {}) {
  const portfolioValueForecast = normalizeArray(options.portfolioValueForecast);
  const cashFlowProjection = normalizeObject(options.cashFlowProjection);
  const refinanceTimingPredictor = normalizeObject(options.refinanceTimingPredictor);
  const marketTrendScore = normalizeObject(options.marketTrendScore);
  const capitalDeploymentForecast = normalizeObject(options.capitalDeploymentForecast);
  const dealProbabilityOfSuccess = normalizeObject(options.dealProbabilityOfSuccess);
  const headline = `Portfolio forecast indicates ${portfolioValueForecast[0]?.label || 'current'} value support with ${cashFlowProjection.status || 'Insufficient Data'} cash flow and ${dealProbabilityOfSuccess.label || 'Low'} deal probability.`;
  return {
    headline,
    supportingPoints: [
      `Market trend ${marketTrendScore.score || 0}/100`,
      `Refinance timing ${refinanceTimingPredictor.timingLabel || 'Insufficient Data'}`,
      `Deployment capacity ${capitalDeploymentForecast.recommendedDeploymentDisplay || formatCurrency(0)}`,
    ],
  };
}

export function buildEnterpriseForecastingEngine(options = {}) {
  const deals = normalizeArray(options.deals);
  const properties = normalizeArray(options.properties);
  const portfolioIntelligence = normalizeObject(options.portfolioIntelligence);
  const rehabProjects = normalizeArray(options.rehabProjects);
  const dealIntelligence = normalizeArray(options.dealIntelligence);

  const portfolioValueForecast = buildPortfolioValueForecast(properties, portfolioIntelligence);
  const cashFlowProjection = buildCashFlowProjection(properties, portfolioIntelligence);
  const refinanceTimingPredictor = buildRefinanceTimingPredictor(properties, portfolioIntelligence);
  const arvConfidenceScore = buildArvConfidenceScore(deals, portfolioIntelligence);
  const rehabBudgetVarianceForecast = buildRehabBudgetVarianceForecast(rehabProjects);
  const dealProbabilityOfSuccess = buildDealProbabilityOfSuccess(dealIntelligence, deals);
  const exitStrategyRecommendation = buildExitStrategyRecommendation(properties, deals, portfolioIntelligence);
  const marketTrendScore = buildMarketTrendScore(portfolioIntelligence);
  const capitalDeploymentForecast = buildCapitalDeploymentForecast(portfolioIntelligence);
  const executiveForecastSummary = buildExecutiveForecastSummary({
    portfolioValueForecast,
    cashFlowProjection,
    refinanceTimingPredictor,
    marketTrendScore,
    capitalDeploymentForecast,
    dealProbabilityOfSuccess,
  });

  return {
    portfolioValueForecast,
    cashFlowProjection,
    refinanceTimingPredictor,
    arvConfidenceScore,
    rehabBudgetVarianceForecast,
    dealProbabilityOfSuccess,
    exitStrategyRecommendation,
    marketTrendScore,
    capitalDeploymentForecast,
    executiveForecastSummary,
  };
}
