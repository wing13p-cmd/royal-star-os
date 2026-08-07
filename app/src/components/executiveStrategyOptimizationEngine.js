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

const strategyDefinitions = [
  { key: 'Aggressive Growth', label: 'Aggressive Growth', bias: 1.12 },
  { key: 'Balanced Growth', label: 'Balanced Growth', bias: 1.0 },
  { key: 'Conservative Growth', label: 'Conservative Growth', bias: 0.88 },
  { key: 'Cash Preservation', label: 'Cash Preservation', bias: 0.8 },
  { key: 'BRRRR Focus', label: 'BRRRR Focus', bias: 0.95 },
  { key: 'Flip Focus', label: 'Flip Focus', bias: 0.98 },
  { key: 'Mixed Strategy', label: 'Mixed Strategy', bias: 1.02 },
];

function buildStrategyScore(strategy, signals) {
  const expectedRoi = safeNumber(signals.expectedRoi) * 100;
  const cashRequired = safeNumber(signals.cashRequired);
  const liquidityRemaining = safeNumber(signals.liquidityRemaining);
  const diversification = safeNumber(signals.diversification);
  const riskScore = safeNumber(signals.riskScore);
  const confidenceScore = safeNumber(signals.confidenceScore);
  const annualCashFlow = safeNumber(signals.annualCashFlow);
  const equityGrowth = safeNumber(signals.equityGrowth);
  const capitalEfficiency = safeNumber(signals.capitalEfficiency);

  const growthBias = strategy.bias || 1;
  const score = clamp(
    (expectedRoi * 0.2) +
    ((100 - Math.min(cashRequired, 100000) / 1000) * 0.1) +
    (liquidityRemaining * 0.1) +
    (diversification * 0.12) +
    ((100 - riskScore) * 0.16) +
    (confidenceScore * 0.14) +
    (annualCashFlow * 0.08) +
    (equityGrowth * 0.06) +
    (capitalEfficiency * 0.04) +
    (growthBias * 10),
    0,
    100,
  );

  return Math.round(score);
}

function buildReasoning(strategy) {
  if (strategy.key === 'Aggressive Growth') return 'Higher upside is available, but capital deployment and risk discipline must remain tight.';
  if (strategy.key === 'Balanced Growth') return 'The current opportunity set supports a balanced mix of growth and resilience.';
  if (strategy.key === 'Conservative Growth') return 'This strategy protects liquidity while still allowing measured growth.';
  if (strategy.key === 'Cash Preservation') return 'Preserving liquidity is the strongest current posture given the reserve pressure.';
  if (strategy.key === 'BRRRR Focus') return 'Cash-flow oriented execution is well-supported by the current market and financing conditions.';
  if (strategy.key === 'Flip Focus') return 'Short-cycle execution is attractive where the profit and timing support remain strong.';
  if (strategy.key === 'Mixed Strategy') return 'A blended approach protects flexibility while capturing upside.';
  return 'The current portfolio and forecast data support a disciplined strategy choice.';
}

function buildTradeOffs(strategy) {
  if (strategy.key === 'Aggressive Growth') return ['Higher capital deployment', 'Greater sensitivity to market timing'];
  if (strategy.key === 'Balanced Growth') return ['Moderate capital deployment', 'Some reserve pressure remains'];
  if (strategy.key === 'Conservative Growth') return ['Lower upside', 'Slower expansion'];
  if (strategy.key === 'Cash Preservation') return ['Reduced growth capacity', 'Lower near-term deployment'];
  if (strategy.key === 'BRRRR Focus') return ['Refinance sensitivity', 'Cash-flow underwriting dependency'];
  if (strategy.key === 'Flip Focus') return ['Shorter hold time', 'Execution timing matters'];
  if (strategy.key === 'Mixed Strategy') return ['More coordination required', 'Some concentration remains'];
  return ['Execution discipline required'];
}

function buildConfidenceLevel(score) {
  if (score >= 80) return 'High';
  if (score >= 65) return 'Moderate';
  if (score >= 50) return 'Low';
  return 'Insufficient Data';
}

export function buildExecutiveStrategyOptimizationEngine(payload = {}) {
  const analysis = normalizeObject(payload.analysis);
  const portfolioIntelligence = normalizeObject(payload.portfolioIntelligence);
  const executiveRecommendationEngine = normalizeObject(payload.executiveRecommendationEngine);
  const marketAnalysis = normalizeObject(payload.marketAnalysis);
  const forecastAnalysis = normalizeObject(payload.forecastAnalysis);

  const availableLiquidity = safeNumber(portfolioIntelligence.summary?.availableLiquidity);
  const cashRequired = safeNumber(analysis.cashRequired);
  const balanceScore = safeNumber(portfolioIntelligence.portfolioBalancingEngine?.portfolioBalanceScore);
  const diversification = safeNumber(portfolioIntelligence.portfolioBalancingEngine?.diversificationScore);
  const riskScore = safeNumber(analysis.overallRisk);
  const forecastConfidence = safeNumber(forecastAnalysis.forecastConfidence);
  const marketStability = safeNumber(marketAnalysis.marketRiskEngine?.marketStabilityScore);
  const recommendationScore = safeNumber(executiveRecommendationEngine?.recommendations?.[0]?.priorityScore);
  const confidenceScore = clamp(Math.round((recommendationScore * 0.4) + (forecastConfidence * 0.25) + (marketStability * 0.2) + (balanceScore * 0.15)), 0, 100);
  const expectedRoi = safeNumber(analysis.roi);
  const liquidityRemaining = Math.max(0, availableLiquidity - cashRequired);
  const annualCashFlow = Math.max(0, safeNumber(analysis.estimatedFlipProfit ?? analysis.projectedProfit) * 0.12);
  const equityGrowth = Math.max(0, safeNumber(analysis.estimatedFlipProfit ?? analysis.projectedProfit) * 0.8);
  const capitalEfficiency = clamp(Math.round((safeNumber(analysis.estimatedFlipProfit ?? analysis.projectedProfit) / Math.max(cashRequired, 1)) * 10), 0, 100);

  const baseSignals = {
    expectedRoi,
    cashRequired,
    liquidityRemaining,
    diversification,
    riskScore,
    confidenceScore,
    annualCashFlow,
    equityGrowth,
    capitalEfficiency,
  };

  const strategyScores = strategyDefinitions.map((strategy) => {
    const score = buildStrategyScore(strategy, {
      ...baseSignals,
      expectedRoi: strategy.key === 'Cash Preservation' ? Math.max(0, expectedRoi * 0.8) : strategy.key === 'Conservative Growth' ? expectedRoi * 0.9 : strategy.key === 'Aggressive Growth' ? expectedRoi * 1.15 : expectedRoi,
      cashRequired: strategy.key === 'Cash Preservation' ? Math.max(0, cashRequired * 0.65) : strategy.key === 'Conservative Growth' ? Math.max(0, cashRequired * 0.85) : strategy.key === 'Aggressive Growth' ? cashRequired * 1.1 : cashRequired,
      liquidityRemaining: strategy.key === 'Cash Preservation' ? Math.max(liquidityRemaining, availableLiquidity) : strategy.key === 'Conservative Growth' ? Math.max(liquidityRemaining, availableLiquidity * 0.8) : liquidityRemaining,
      diversification: strategy.key === 'Mixed Strategy' ? Math.min(100, diversification + 8) : strategy.key === 'BRRRR Focus' ? Math.min(100, diversification + 4) : strategy.key === 'Flip Focus' ? Math.max(0, diversification - 4) : diversification,
      riskScore: strategy.key === 'Aggressive Growth' ? Math.min(100, riskScore + 8) : strategy.key === 'Cash Preservation' ? Math.max(0, riskScore - 8) : strategy.key === 'Conservative Growth' ? Math.max(0, riskScore - 4) : riskScore,
      confidenceScore: strategy.key === 'Balanced Growth' ? Math.min(100, confidenceScore + 3) : strategy.key === 'Conservative Growth' ? Math.min(100, confidenceScore + 2) : confidenceScore,
      annualCashFlow: strategy.key === 'BRRRR Focus' ? annualCashFlow * 1.08 : strategy.key === 'Cash Preservation' ? annualCashFlow * 0.8 : annualCashFlow,
      equityGrowth: strategy.key === 'Aggressive Growth' ? equityGrowth * 1.1 : strategy.key === 'Balanced Growth' ? equityGrowth * 1.05 : strategy.key === 'Conservative Growth' ? equityGrowth * 0.9 : equityGrowth,
      capitalEfficiency: strategy.key === 'Cash Preservation' ? Math.min(100, capitalEfficiency + 6) : strategy.key === 'Balanced Growth' ? Math.min(100, capitalEfficiency + 3) : capitalEfficiency,
    });

    return {
      strategyName: strategy.key,
      score,
      confidenceLevel: buildConfidenceLevel(score),
      reasoning: buildReasoning(strategy, score, baseSignals),
      tradeOffs: buildTradeOffs(strategy, baseSignals),
      expectedRoi: Number((expectedRoi * (strategy.key === 'Aggressive Growth' ? 1.1 : strategy.key === 'Conservative Growth' ? 0.9 : strategy.key === 'Cash Preservation' ? 0.8 : 1)).toFixed(3)),
      cashRequired: Math.round(cashRequired * (strategy.key === 'Cash Preservation' ? 0.65 : strategy.key === 'Conservative Growth' ? 0.85 : strategy.key === 'Aggressive Growth' ? 1.1 : strategy.key === 'BRRRR Focus' ? 0.95 : 1)),
      liquidityRemaining: Math.round(liquidityRemaining * (strategy.key === 'Cash Preservation' ? 1.08 : strategy.key === 'Conservative Growth' ? 0.95 : strategy.key === 'Aggressive Growth' ? 0.9 : 1)),
      portfolioDiversification: Math.round(diversification + (strategy.key === 'Mixed Strategy' ? 8 : strategy.key === 'BRRRR Focus' ? 4 : strategy.key === 'Flip Focus' ? -3 : 0)),
      riskScore: Math.round(riskScore + (strategy.key === 'Aggressive Growth' ? 8 : strategy.key === 'Cash Preservation' ? -8 : strategy.key === 'Conservative Growth' ? -4 : 0)),
      confidenceScore: Math.round(confidenceScore + (strategy.key === 'Balanced Growth' ? 3 : strategy.key === 'Conservative Growth' ? 2 : 0)),
      annualCashFlow: Math.round(annualCashFlow * (strategy.key === 'BRRRR Focus' ? 1.08 : strategy.key === 'Cash Preservation' ? 0.8 : 1)),
      equityGrowth: Math.round(equityGrowth * (strategy.key === 'Aggressive Growth' ? 1.1 : strategy.key === 'Balanced Growth' ? 1.05 : strategy.key === 'Conservative Growth' ? 0.9 : 1)),
      capitalEfficiency: Math.round(capitalEfficiency + (strategy.key === 'Cash Preservation' ? 6 : strategy.key === 'Balanced Growth' ? 3 : 0)),
    };
  }).sort((left, right) => right.score - left.score);

  const manualOverrideStrategy = safeString(payload.manualOverrideStrategy || payload.manualOverride || '', '');
  const manualOverrideApplied = Boolean(manualOverrideStrategy);
  const selectedStrategy = manualOverrideApplied
    ? strategyScores.find((entry) => entry.strategyName === manualOverrideStrategy) || strategyScores[0]
    : strategyScores[0];

  const improvement = selectedStrategy?.score > 0 ? Math.round(selectedStrategy.score - 50) : 0;

  return {
    recommendedStrategy: selectedStrategy?.strategyName || 'Balanced Growth',
    reasoningSummary: selectedStrategy?.reasoning || 'Balanced Growth remains the most resilient option based on current conditions.',
    tradeOffs: selectedStrategy?.tradeOffs || [],
    confidenceLevel: selectedStrategy?.confidenceLevel || 'Insufficient Data',
    expectedImprovementOverCurrentAllocation: `${improvement > 0 ? '+' : ''}${improvement}%`,
    strategyScores,
    selectedStrategy: {
      ...selectedStrategy,
      score: selectedStrategy?.score || 0,
    },
    summary: {
      totalStrategies: strategyScores.length,
      topScore: strategyScores[0]?.score || 0,
      lowestScore: strategyScores[strategyScores.length - 1]?.score || 0,
      selectedStrategyName: selectedStrategy?.strategyName || 'Balanced Growth',
    },
    manualOverrideSummary: {
      applied: manualOverrideApplied,
      strategyName: manualOverrideApplied ? manualOverrideStrategy : null,
    },
  };
}
