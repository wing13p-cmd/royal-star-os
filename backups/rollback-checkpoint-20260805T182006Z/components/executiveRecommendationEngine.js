function safeNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function safeString(value, fallback = 'Insufficient Data') {
  if (value === null || value === undefined || value === '') return fallback;
  return typeof value === 'string' ? value : String(value);
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function normalizeObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function buildRecommendationScore(entry) {
  return clamp(
    (entry.roiScore * 0.22) +
    (entry.riskAdjustedReturnScore * 0.18) +
    (entry.capitalEfficiencyScore * 0.16) +
    (entry.liquidityImpactScore * 0.14) +
    (entry.diversificationImpactScore * 0.14) +
    (entry.confidenceScore * 0.16),
    0,
    100,
  );
}

function buildRecommendationCategory(score, entry) {
  if (score >= 80) return 'Acquire Immediately';
  if (score >= 60) return 'Acquire Soon';
  if (score >= 48) return 'Hold';
  if (score >= 36) return 'Monitor';
  if (entry.liquidityPressure > 0) return 'Increase Liquidity';
  if (entry.riskProfile > 60) return 'Reduce Risk';
  if (entry.capitalEfficiency < 50) return 'Pause Acquisitions';
  return 'Hold';
}

export function buildExecutiveRecommendationEngine(payload = {}) {
  const deal = normalizeObject(payload.deal);
  const analysis = normalizeObject(payload.analysis);
  const portfolioIntelligence = normalizeObject(payload.portfolioIntelligence);
  const capitalAllocationEngine = normalizeObject(payload.capitalAllocationEngine);
  const opportunityAnalysis = normalizeObject(payload.opportunityAnalysis);
  const marketAnalysis = normalizeObject(payload.marketAnalysis);
  const forecastAnalysis = normalizeObject(payload.forecastAnalysis);

  const portfolioBalancingEngine = normalizeObject(portfolioIntelligence.portfolioBalancingEngine);
  const capitalRecommendations = Array.isArray(capitalAllocationEngine?.executiveCapitalAllocation?.recommendations) ? capitalAllocationEngine.executiveCapitalAllocation.recommendations : [];
  const roi = safeNumber(analysis.roi);
  const risk = safeNumber(analysis.overallRisk);
  const cashRequired = safeNumber(analysis.cashRequired);
  const projectedProfit = safeNumber(analysis.estimatedFlipProfit ?? analysis.projectedProfit);
  const liquidityPressure = safeNumber(portfolioIntelligence.summary?.reserveShortfallValue) > 0 ? 1 : 0;
  const balanceScore = safeNumber(portfolioBalancingEngine.portfolioBalanceScore);
  const diversificationScore = safeNumber(portfolioBalancingEngine.diversificationScore);
  const liquidityRatio = safeNumber(portfolioBalancingEngine.liquidityReserveRatio);
  const financingExposure = safeNumber(portfolioBalancingEngine.financingExposure);
  const opportunityScore = safeNumber(opportunityAnalysis.overallOpportunityScore);
  const marketStability = safeNumber(marketAnalysis.marketRiskEngine?.marketStabilityScore);
  const forecastConfidence = safeNumber(forecastAnalysis.forecastConfidence);
  const confidenceScore = clamp(Math.round((opportunityScore * 0.35) + (forecastConfidence * 0.25) + (marketStability * 0.2) + (balanceScore * 0.2)), 0, 100);
  const hasMeaningfulSignals = Boolean(roi || projectedProfit || opportunityScore || forecastConfidence || marketStability || balanceScore);

  const baseEntry = {
    id: deal.id || 'executive-recommendation',
    propertyAddress: safeString(deal.propertyAddress || deal.propertyName || 'Portfolio', 'Portfolio'),
    roiScore: clamp(Math.round((roi > 0 ? roi * 100 : 0) * 0.8 + (projectedProfit > 0 ? 20 : 0)), 0, 100),
    riskAdjustedReturnScore: clamp(Math.round(100 - risk), 0, 100),
    capitalEfficiencyScore: clamp(Math.round((projectedProfit > 0 ? 60 : 20) + (cashRequired <= safeNumber(deal.cashOnHand) ? 20 : 0)), 0, 100),
    liquidityImpactScore: clamp(Math.round((liquidityPressure > 0 ? 25 : 60) + (liquidityRatio > 15 ? 10 : 0)), 0, 100),
    diversificationImpactScore: clamp(Math.round(diversificationScore), 0, 100),
    confidenceScore,
    liquidityPressure,
    riskProfile: clamp(Math.round(risk), 0, 100),
    capitalEfficiency: clamp(Math.round((projectedProfit / Math.max(cashRequired, 1)) * 10), 0, 100),
  };

  const recommendationScore = buildRecommendationScore(baseEntry);
  const category = buildRecommendationCategory(recommendationScore, baseEntry);

  const recommendations = [
    {
      id: `${baseEntry.id}-recommendation`,
      propertyAddress: baseEntry.propertyAddress,
      category,
      priorityRank: 1,
      priorityScore: Math.round(recommendationScore),
      rationale: `The current deal posture is supported by ROI ${roi.toFixed(2)}, opportunity ${opportunityScore}, and forecast confidence ${forecastConfidence}.`,
      expectedRoi: roi,
      riskAdjustedReturn: baseEntry.riskAdjustedReturnScore,
      capitalEfficiency: baseEntry.capitalEfficiencyScore,
      liquidityImpact: baseEntry.liquidityImpactScore,
      diversificationImpact: baseEntry.diversificationImpactScore,
      confidenceScore: baseEntry.confidenceScore,
      supportingSignals: [
        capitalRecommendations[0]?.priority || 'Capital allocation support available',
        portfolioBalancingEngine.recommendedAction || 'Portfolio balancing remains stable',
      ],
    },
    ...(liquidityPressure > 0 ? [{
      id: `${baseEntry.id}-liquidity`,
      propertyAddress: baseEntry.propertyAddress,
      category: 'Increase Liquidity',
      priorityRank: 2,
      priorityScore: Math.max(60, Math.round(baseEntry.liquidityImpactScore)),
      rationale: 'Reserve coverage is below target and the portfolio should preserve operating liquidity.',
      expectedRoi: roi,
      riskAdjustedReturn: baseEntry.riskAdjustedReturnScore,
      capitalEfficiency: baseEntry.capitalEfficiencyScore,
      liquidityImpact: 95,
      diversificationImpact: baseEntry.diversificationImpactScore,
      confidenceScore: baseEntry.confidenceScore,
      supportingSignals: ['Reserve shortfall exists', 'Portfolio balance recommendation favors liquidity'],
    }] : []),
  ];

  const executivePriorityScore = clamp(Math.round(recommendations.reduce((sum, entry) => sum + entry.priorityScore, 0) / Math.max(recommendations.length, 1)), 0, 100);

  return {
    executivePriorityScore: hasMeaningfulSignals ? executivePriorityScore : 0,
    recommendations: hasMeaningfulSignals ? recommendations.map((entry, index) => ({ ...entry, priorityRank: index + 1 })) : [],
    summary: {
      totalRecommendations: hasMeaningfulSignals ? recommendations.length : 0,
      topCategory: hasMeaningfulSignals ? recommendations[0]?.category || 'Hold' : 'Hold',
      highestPriorityScore: hasMeaningfulSignals ? recommendations[0]?.priorityScore || 0 : 0,
      liquidityFocus: hasMeaningfulSignals ? recommendations.some((entry) => entry.category === 'Increase Liquidity') : false,
    },
  };
}
