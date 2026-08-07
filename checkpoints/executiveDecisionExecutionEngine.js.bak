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

function normalizeArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeActionType(value) {
  const normalized = safeString(value, 'Hold').toLowerCase();
  if (normalized.includes('acquire')) return 'Acquire';
  if (normalized.includes('offer')) return 'Submit Offer';
  if (normalized.includes('counter')) return 'Counter Offer';
  if (normalized.includes('refinance')) return 'Refinance';
  if (normalized.includes('sell')) return 'Sell';
  if (normalized.includes('cash reserve')) return 'Increase Cash Reserve';
  if (normalized.includes('rehab budget')) return 'Increase Rehab Budget';
  if (normalized.includes('delay rehab')) return 'Delay Rehab';
  if (normalized.includes('reduce exposure')) return 'Reduce Exposure';
  if (normalized.includes('hold')) return 'Hold';
  return 'Hold';
}

function buildActionScore(actionType, signals) {
  const expectedRoi = safeNumber(signals.expectedRoi) * 100;
  const confidenceScore = safeNumber(signals.confidenceScore);
  const liquidityImpact = safeNumber(signals.liquidityImpact);
  const riskReduction = safeNumber(signals.riskReduction);
  const timeSensitivity = safeNumber(signals.timeSensitivity);
  const diversification = safeNumber(signals.diversificationImpact);
  const capitalEfficiency = safeNumber(signals.capitalEfficiency);

  const actionModifiers = {
    Acquire: 16,
    'Submit Offer': 10,
    'Counter Offer': 6,
    Hold: 2,
    Refinance: 8,
    Sell: 4,
    'Increase Cash Reserve': 10,
    'Delay Rehab': 8,
    'Increase Rehab Budget': 4,
    'Reduce Exposure': 10,
  };

  return clamp(
    (expectedRoi * 0.22) +
    (confidenceScore * 0.18) +
    (liquidityImpact * 0.16) +
    (riskReduction * 0.16) +
    (timeSensitivity * 0.12) +
    (diversification * 0.08) +
    (capitalEfficiency * 0.08) +
    (actionModifiers[actionType] || 0),
    0,
    100,
  );
}

function buildActionRationale(actionType, signals) {
  if (actionType === 'Acquire') return 'The opportunity is supported by strong profit, positive forecast confidence, and a favorable portfolio posture.';
  if (actionType === 'Submit Offer') return 'The deal merits an offer package while preserving liquidity and pricing discipline.';
  if (actionType === 'Counter Offer') return 'A measured counteroffer is warranted when valuation support is strong but pricing remains negotiable.';
  if (actionType === 'Hold') return 'Current conditions warrant a wait-and-watch posture until the capital and valuation picture clears.';
  if (actionType === 'Refinance') return 'Refinancing can improve liquidity and preserve optionality for a durable asset.';
  if (actionType === 'Sell') return 'The portfolio would benefit from reducing concentration in a lower-conviction opportunity.';
  if (actionType === 'Increase Cash Reserve') return 'Liquidity should be preserved to protect against reserve shortfall and preserve deployment flexibility.';
  if (actionType === 'Delay Rehab') return 'Rehab sequencing should be delayed until cash reserve and execution risk are stabilized.';
  if (actionType === 'Increase Rehab Budget') return 'A larger rehab budget may unlock premium value when the market and execution profile support it.';
  if (actionType === 'Reduce Exposure') return 'Risk should be reduced when downside sensitivity and concentration pressure are elevated.';
  return 'The current signal set supports a disciplined execution posture.';
}

function buildPortfolioImpact(actionType, signals) {
  const baseLiquidity = safeNumber(signals.liquidityImpact);
  const baseDiversification = safeNumber(signals.diversificationImpact);
  const baseRiskReduction = safeNumber(signals.riskReduction);
  const baseCapitalEfficiency = safeNumber(signals.capitalEfficiency);

  const impactByAction = {
    Acquire: { liquidityImpact: Math.max(35, baseLiquidity - 10), diversificationImpact: Math.max(40, baseDiversification), exposureReduction: Math.max(20, baseRiskReduction - 10), liabilityExposure: Math.max(0, safeNumber(signals.estimatedCapitalRequired) * 0.35) },
    'Submit Offer': { liquidityImpact: Math.max(45, baseLiquidity - 5), diversificationImpact: Math.max(35, baseDiversification - 5), exposureReduction: Math.max(20, baseRiskReduction - 15), liabilityExposure: Math.max(0, safeNumber(signals.estimatedCapitalRequired) * 0.2) },
    'Counter Offer': { liquidityImpact: Math.max(50, baseLiquidity), diversificationImpact: Math.max(30, baseDiversification - 10), exposureReduction: Math.max(25, baseRiskReduction), liabilityExposure: Math.max(0, safeNumber(signals.estimatedCapitalRequired) * 0.15) },
    Hold: { liquidityImpact: Math.max(55, baseLiquidity), diversificationImpact: Math.max(35, baseDiversification - 5), exposureReduction: Math.max(25, baseRiskReduction), liabilityExposure: 0 },
    Refinance: { liquidityImpact: Math.max(75, baseLiquidity + 10), diversificationImpact: Math.max(45, baseDiversification + 5), exposureReduction: Math.max(30, baseRiskReduction), liabilityExposure: Math.max(0, safeNumber(signals.estimatedCapitalRequired) * 0.05) },
    Sell: { liquidityImpact: Math.max(50, baseLiquidity + 8), diversificationImpact: Math.max(60, baseDiversification + 10), exposureReduction: Math.max(55, baseRiskReduction + 10), liabilityExposure: Math.max(0, safeNumber(signals.estimatedCapitalRequired) * 0.1) },
    'Increase Cash Reserve': { liquidityImpact: Math.max(85, baseLiquidity + 10), diversificationImpact: Math.max(45, baseDiversification + 4), exposureReduction: Math.max(40, baseRiskReduction + 8), liabilityExposure: 0 },
    'Delay Rehab': { liquidityImpact: Math.max(70, baseLiquidity + 15), diversificationImpact: Math.max(40, baseDiversification), exposureReduction: Math.max(35, baseRiskReduction + 8), liabilityExposure: 0 },
    'Increase Rehab Budget': { liquidityImpact: Math.max(40, baseLiquidity - 5), diversificationImpact: Math.max(50, baseDiversification + 5), exposureReduction: Math.max(25, baseRiskReduction - 5), liabilityExposure: Math.max(0, safeNumber(signals.estimatedCapitalRequired) * 0.25) },
    'Reduce Exposure': { liquidityImpact: Math.max(60, baseLiquidity + 5), diversificationImpact: Math.max(70, baseDiversification + 10), exposureReduction: Math.max(70, baseRiskReduction + 15), liabilityExposure: 0 },
  };

  return impactByAction[actionType] || impactByAction.Hold;
}

export function buildExecutiveDecisionExecutionEngine(payload = {}) {
  const deal = normalizeObject(payload.deal);
  const analysis = normalizeObject(payload.analysis);
  const portfolioIntelligence = normalizeObject(payload.portfolioIntelligence);
  const executiveRecommendationEngine = normalizeObject(payload.executiveRecommendationEngine);
  const capitalAllocationEngine = normalizeObject(payload.capitalAllocationEngine);
  const marketAnalysis = normalizeObject(payload.marketAnalysis);
  const forecastAnalysis = normalizeObject(payload.forecastAnalysis);

  const recommendationEntries = normalizeArray(executiveRecommendationEngine.recommendations);
  const topRecommendation = recommendationEntries[0] || {};
  const reserveShortfall = safeNumber(portfolioIntelligence.summary?.reserveShortfallValue);
  const liquidityRatio = safeNumber(portfolioIntelligence.portfolioBalancingEngine?.liquidityReserveRatio);
  const balanceScore = safeNumber(portfolioIntelligence.portfolioBalancingEngine?.portfolioBalanceScore);
  const diversificationScore = safeNumber(portfolioIntelligence.portfolioBalancingEngine?.diversificationScore);
  const financingExposure = safeNumber(portfolioIntelligence.portfolioBalancingEngine?.financingExposure);
  const risk = safeNumber(analysis.overallRisk);
  const projectedProfit = safeNumber(analysis.estimatedFlipProfit ?? analysis.projectedProfit);
  const roi = safeNumber(analysis.roi);
  const cashRequired = safeNumber(analysis.cashRequired);
  const confidenceScore = clamp(Math.round((safeNumber(topRecommendation.confidenceScore) * 0.5) + (safeNumber(forecastAnalysis.forecastConfidence) * 0.3) + (safeNumber(marketAnalysis.marketRiskEngine?.marketStabilityScore) * 0.2)), 0, 100);
  const expectedRoi = safeNumber(topRecommendation.expectedRoi ?? roi);
  const capitalEfficiency = safeNumber(topRecommendation.capitalEfficiency ?? (projectedProfit / Math.max(cashRequired, 1)) * 10);
  const liquidityPressure = reserveShortfall > 0 ? 85 : liquidityRatio > 15 ? 65 : 45;
  const riskReduction = clamp(100 - risk + (reserveShortfall > 0 ? 8 : 0), 0, 100);
  const timeSensitivity = safeNumber(topRecommendation.priorityScore) >= 70 ? 80 : 60;
  const manualOverrideAction = safeString(deal.manualOverrideAction || deal.manualOverride || deal.overrideAction || '', '');
  const hasMeaningfulSignals = Boolean(roi || projectedProfit || confidenceScore || reserveShortfall || balanceScore || cashRequired || recommendationEntries.length);

  const baseSignals = {
    expectedRoi,
    confidenceScore,
    liquidityImpact: liquidityPressure,
    riskReduction,
    timeSensitivity,
    diversificationImpact: clamp(diversificationScore || balanceScore, 0, 100),
    capitalEfficiency: clamp(capitalEfficiency, 0, 100),
    estimatedCapitalRequired: cashRequired,
  };

  const actionCandidates = [
    { actionType: 'Acquire', baseSignals },
    { actionType: 'Submit Offer', baseSignals },
    { actionType: 'Counter Offer', baseSignals },
    { actionType: 'Hold', baseSignals },
    { actionType: 'Refinance', baseSignals },
    { actionType: 'Sell', baseSignals },
    { actionType: 'Increase Cash Reserve', baseSignals },
    { actionType: 'Delay Rehab', baseSignals },
    { actionType: 'Increase Rehab Budget', baseSignals },
    { actionType: 'Reduce Exposure', baseSignals },
  ];

  const scoredActions = actionCandidates.map((candidate) => {
    const actionType = normalizeActionType(candidate.actionType);
    let priorityScore = buildActionScore(actionType, {
      ...baseSignals,
      expectedRoi: actionType === 'Increase Cash Reserve' && reserveShortfall > 0 ? 0.08 : baseSignals.expectedRoi,
      confidenceScore: actionType === 'Acquire' && safeNumber(topRecommendation.priorityScore) >= 60 ? Math.max(baseSignals.confidenceScore, 78) : baseSignals.confidenceScore,
      liquidityImpact: actionType === 'Increase Cash Reserve' ? Math.max(baseSignals.liquidityImpact, 85) : actionType === 'Delay Rehab' && reserveShortfall > 0 ? Math.max(baseSignals.liquidityImpact, 72) : baseSignals.liquidityImpact,
      riskReduction: actionType === 'Reduce Exposure' ? Math.max(baseSignals.riskReduction, 80) : actionType === 'Acquire' && risk <= 30 ? Math.max(baseSignals.riskReduction, 70) : baseSignals.riskReduction,
      capitalEfficiency: actionType === 'Increase Cash Reserve' ? Math.max(baseSignals.capitalEfficiency, 70) : baseSignals.capitalEfficiency,
      diversificationImpact: actionType === 'Sell' ? Math.max(baseSignals.diversificationImpact, 82) : actionType === 'Acquire' ? Math.max(baseSignals.diversificationImpact, balanceScore > 0 ? balanceScore : 70) : baseSignals.diversificationImpact,
      estimatedCapitalRequired: actionType === 'Increase Rehab Budget' ? Math.max(baseSignals.estimatedCapitalRequired, cashRequired) : baseSignals.estimatedCapitalRequired,
    });

    if (actionType === 'Acquire' && (safeString(topRecommendation.category, '').includes('Acquire') || safeNumber(topRecommendation.priorityScore) >= 60)) {
      priorityScore = Math.min(100, priorityScore + 10);
    }
    if (actionType === 'Increase Cash Reserve' && reserveShortfall > 0) {
      priorityScore = Math.min(100, priorityScore + 8);
    }
    if (actionType === 'Reduce Exposure' && (risk > 40 || financingExposure > 50)) {
      priorityScore = Math.min(100, priorityScore + 8);
    }
    if (safeNumber(topRecommendation.priorityScore) < 60 && actionType === 'Hold') {
      priorityScore = Math.max(priorityScore, 65);
    }

    const estimatedCapitalRequired = actionType === 'Acquire' || actionType === 'Submit Offer' || actionType === 'Counter Offer' || actionType === 'Increase Rehab Budget' ? Math.max(baseSignals.estimatedCapitalRequired, cashRequired) : actionType === 'Refinance' ? Math.max(0, Math.round(baseSignals.estimatedCapitalRequired * 0.5)) : 0;
    const portfolioImpact = buildPortfolioImpact(actionType, {
      ...baseSignals,
      estimatedCapitalRequired,
    });

    return {
      actionType,
      priorityRank: 0,
      priorityScore: Math.round(priorityScore),
      rationale: buildActionRationale(actionType, baseSignals),
      estimatedCapitalRequired,
      portfolioImpact,
      supportingSignals: [
        safeString(topRecommendation.category || '', 'No active recommendation'),
        reserveShortfall > 0 ? 'Reserve shortfall present' : 'Reserve coverage acceptable',
        capitalAllocationEngine?.executiveCapitalAllocation?.recommendations?.[0]?.priority || 'Capital allocation guidance available',
      ],
      manualOverrideApplied: Boolean(manualOverrideAction && normalizeActionType(manualOverrideAction) === actionType),
    };
  });

  const orderedActions = scoredActions
    .filter((entry) => entry.priorityScore > 0 || entry.manualOverrideApplied)
    .sort((left, right) => {
      if (left.manualOverrideApplied && !right.manualOverrideApplied) return -1;
      if (!left.manualOverrideApplied && right.manualOverrideApplied) return 1;
      return right.priorityScore - left.priorityScore;
    })
    .slice(0, 5);

  const manualOverrideApplied = Boolean(manualOverrideAction);
  if (!hasMeaningfulSignals) {
    return {
      executiveActionPriorityScore: 0,
      recommendedExecutionOrder: [],
      estimatedCapitalRequired: 0,
      estimatedPortfolioImpact: {
        liquidityImpact: 0,
        diversificationImpact: 0,
        exposureReduction: 0,
        liabilityExposure: 0,
      },
      manualOverrideSummary: {
        applied: manualOverrideApplied,
        actionType: manualOverrideApplied ? normalizeActionType(manualOverrideAction) : null,
      },
      summary: {
        totalActions: 0,
        highestPriorityAction: 'Hold',
        highestPriorityScore: 0,
        capitalFocus: 'Growth',
        liquidityFocus: false,
      },
    };
  }

  const highestPriorityAction = orderedActions[0] || null;
  const executiveActionPriorityScore = highestPriorityAction ? Math.round(orderedActions.reduce((sum, entry) => sum + entry.priorityScore, 0) / orderedActions.length) : 0;
  const estimatedCapitalRequired = orderedActions.reduce((sum, entry) => sum + entry.estimatedCapitalRequired, 0);
  const estimatedPortfolioImpact = orderedActions.reduce((accumulator, entry) => ({
    liquidityImpact: accumulator.liquidityImpact + entry.portfolioImpact.liquidityImpact,
    diversificationImpact: accumulator.diversificationImpact + entry.portfolioImpact.diversificationImpact,
    exposureReduction: accumulator.exposureReduction + entry.portfolioImpact.exposureReduction,
    liabilityExposure: accumulator.liabilityExposure + entry.portfolioImpact.liabilityExposure,
  }), { liquidityImpact: 0, diversificationImpact: 0, exposureReduction: 0, liabilityExposure: 0 });

  const recommendedExecutionOrder = orderedActions.map((entry, index) => ({
    ...entry,
    priorityRank: index + 1,
  }));

  return {
    executiveActionPriorityScore,
    recommendedExecutionOrder,
    estimatedCapitalRequired,
    estimatedPortfolioImpact: {
      liquidityImpact: Math.round(estimatedPortfolioImpact.liquidityImpact / Math.max(recommendedExecutionOrder.length, 1)),
      diversificationImpact: Math.round(estimatedPortfolioImpact.diversificationImpact / Math.max(recommendedExecutionOrder.length, 1)),
      exposureReduction: Math.round(estimatedPortfolioImpact.exposureReduction / Math.max(recommendedExecutionOrder.length, 1)),
      liabilityExposure: Math.round(estimatedPortfolioImpact.liabilityExposure / Math.max(recommendedExecutionOrder.length, 1)),
    },
    manualOverrideSummary: {
      applied: manualOverrideApplied,
      actionType: manualOverrideApplied ? normalizeActionType(manualOverrideAction) : null,
    },
    summary: {
      totalActions: recommendedExecutionOrder.length,
      highestPriorityAction: highestPriorityAction?.actionType || 'Hold',
      highestPriorityScore: highestPriorityAction?.priorityScore || 0,
      capitalFocus: recommendedExecutionOrder.some((entry) => entry.actionType === 'Increase Cash Reserve') ? 'Liquidity' : 'Growth',
      liquidityFocus: recommendedExecutionOrder.some((entry) => entry.actionType === 'Increase Cash Reserve' || entry.actionType === 'Delay Rehab'),
    },
  };
}
