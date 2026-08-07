function safeNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function optionalNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function safeString(value, fallback = 'UNKNOWN') {
  if (value === null || value === undefined || value === '') return fallback;
  return typeof value === 'string' ? value : String(value);
}

function normalizeObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function normalizeArray(value) {
  return Array.isArray(value) ? value : [];
}

function clamp(value, min = 0, max = 100) {
  return Math.min(max, Math.max(min, value));
}

function knownOrUnknown(value) {
  return Number.isFinite(value) ? value : 'UNKNOWN';
}

function scoreOrUnknown(value) {
  return Number.isFinite(value) ? clamp(Math.round(value), 0, 100) : 'UNKNOWN';
}

function averageKnown(values = []) {
  const known = values.filter((value) => Number.isFinite(value));
  if (!known.length) return null;
  return known.reduce((sum, value) => sum + value, 0) / known.length;
}

function estimateNeighborhoodTrendScore(market = {}, deal = {}) {
  const appreciation = optionalNumber(market.appreciationRate ?? deal.appreciationRate);
  const trend = appreciation !== null ? 50 + appreciation * 350 : null;
  return scoreOrUnknown(trend);
}

function estimateInventoryTrend(market = {}, comps = []) {
  const inventoryMonths = optionalNumber(market.inventoryMonths);
  if (inventoryMonths !== null) {
    if (inventoryMonths < 3) return 'TIGHTENING';
    if (inventoryMonths > 6) return 'EXPANDING';
    return 'STABLE';
  }
  const compCount = normalizeArray(comps).length;
  if (!compCount) return 'UNKNOWN';
  return compCount >= 6 ? 'STABLE' : 'UNKNOWN';
}

function estimatePriceMomentum(market = {}, deal = {}) {
  const appreciation = optionalNumber(market.appreciationRate ?? deal.appreciationRate);
  if (appreciation === null) return 'UNKNOWN';
  if (appreciation >= 0.05) return 'STRONG_UP';
  if (appreciation >= 0.02) return 'UP';
  if (appreciation <= -0.03) return 'DOWN';
  return 'FLAT';
}

function estimateDomTrend(market = {}, deal = {}) {
  const dom = optionalNumber(market.daysOnMarket ?? deal.daysOnMarket);
  if (dom === null) return 'UNKNOWN';
  if (dom <= 30) return 'FAST';
  if (dom <= 60) return 'NORMAL';
  return 'SLOW';
}

function estimateSaleVelocity(market = {}, comps = []) {
  const turnover = optionalNumber(market.saleVelocity);
  if (turnover !== null) return scoreOrUnknown(turnover);
  const compCount = normalizeArray(comps).length;
  if (!compCount) return 'UNKNOWN';
  return scoreOrUnknown(35 + compCount * 8);
}

function estimateDemandScore(market = {}, deal = {}) {
  const rentDemand = optionalNumber(market.rentDemandScore ?? deal.rentDemandScore);
  const dom = optionalNumber(market.daysOnMarket ?? deal.daysOnMarket);
  if (rentDemand === null && dom === null) return 'UNKNOWN';
  const score = (rentDemand ?? 60) + (dom !== null ? Math.max(0, 60 - dom) * 0.25 : 0);
  return scoreOrUnknown(score);
}

function estimateSupplyScore(market = {}, deal = {}) {
  const inventoryMonths = optionalNumber(market.inventoryMonths);
  const activeListings = optionalNumber(market.activeListings ?? deal.activeListings);
  if (inventoryMonths === null && activeListings === null) return 'UNKNOWN';
  const score = (inventoryMonths !== null ? Math.min(100, inventoryMonths * 12) : 50) + (activeListings !== null ? Math.min(30, activeListings / 10) : 0);
  return scoreOrUnknown(score);
}

function estimateMarketConfidence(metrics = {}) {
  const confidence = averageKnown([
    optionalNumber(metrics.neighborhoodTrendScore),
    optionalNumber(metrics.saleVelocity),
    optionalNumber(metrics.demandScore),
    optionalNumber(metrics.supplyScore) !== null ? 100 - optionalNumber(metrics.supplyScore) : null,
  ]);
  return scoreOrUnknown(confidence);
}

export function buildPredictiveMarketEngine(input = {}) {
  const deal = normalizeObject(input.deal);
  const market = normalizeObject(input.marketContext);
  const comps = normalizeArray(input.comps);

  const neighborhoodTrendScore = estimateNeighborhoodTrendScore(market, deal);
  const inventoryTrend = estimateInventoryTrend(market, comps);
  const priceMomentum = estimatePriceMomentum(market, deal);
  const domTrend = estimateDomTrend(market, deal);
  const saleVelocity = estimateSaleVelocity(market, comps);
  const demandScore = estimateDemandScore(market, deal);
  const supplyScore = estimateSupplyScore(market, deal);

  const marketConfidence = estimateMarketConfidence({ neighborhoodTrendScore, saleVelocity, demandScore, supplyScore });

  return {
    neighborhoodTrendScore,
    inventoryTrend,
    priceMomentum,
    domTrend,
    saleVelocity,
    demandScore,
    supplyScore,
    marketConfidence,
    advisoryOnly: true,
    unknowns: [
      neighborhoodTrendScore === 'UNKNOWN' ? 'Neighborhood trend inputs missing.' : null,
      inventoryTrend === 'UNKNOWN' ? 'Inventory trend inputs missing.' : null,
      priceMomentum === 'UNKNOWN' ? 'Price momentum inputs missing.' : null,
      domTrend === 'UNKNOWN' ? 'DOM trend inputs missing.' : null,
    ].filter(Boolean),
  };
}

export function buildRehabPredictionEngine(input = {}) {
  const deal = normalizeObject(input.deal);
  const analysis = normalizeObject(input.analysis);
  const rehabProjects = normalizeArray(input.rehabProjects);
  const contractors = normalizeArray(input.contractors);

  const rehabBudget = optionalNumber(deal.rehabBudget ?? analysis.rehabBudget);
  const squareFeet = optionalNumber(deal.squareFeet);
  const activeProject = rehabProjects[0] || {};
  const baselineDuration = optionalNumber(activeProject.estimatedDurationDays ?? activeProject.durationDays);

  const rehabDuration = baselineDuration !== null
    ? baselineDuration
    : rehabBudget !== null
      ? Math.round(45 + rehabBudget / 1800 + (squareFeet !== null ? squareFeet / 220 : 0))
      : 'UNKNOWN';

  const costConfidence = rehabBudget !== null ? scoreOrUnknown(70 - (rehabBudget > 100000 ? 12 : 0)) : 'UNKNOWN';
  const scheduleRisk = rehabDuration !== 'UNKNOWN' ? scoreOrUnknown(25 + rehabDuration * 0.35) : 'UNKNOWN';
  const permitRisk = safeString(activeProject.permitStatus, '').toLowerCase().includes('approved')
    ? scoreOrUnknown(20)
    : safeString(activeProject.permitStatus, '').length > 0
      ? scoreOrUnknown(55)
      : 'UNKNOWN';
  const contractorComplexity = contractors.length
    ? scoreOrUnknown(35 + contractors.length * 6 + contractors.filter((contractor) => safeString(contractor.status).toLowerCase().includes('watch')).length * 12)
    : 'UNKNOWN';
  const materialVolatility = rehabBudget !== null ? scoreOrUnknown(40 + Math.min(30, rehabBudget / 5000)) : 'UNKNOWN';

  let contingencyRecommendation = 'UNKNOWN';
  if (rehabBudget !== null) {
    const pct = scheduleRisk !== 'UNKNOWN' && scheduleRisk >= 60 ? 0.15 : 0.1;
    contingencyRecommendation = {
      percentage: pct,
      amount: rehabBudget * pct,
    };
  }

  return {
    rehabDuration,
    costConfidence,
    scheduleRisk,
    permitRisk,
    contractorComplexity,
    materialVolatility,
    contingencyRecommendation,
    advisoryOnly: true,
  };
}

function makeExitMetrics(label, input = {}, multipliers = {}) {
  const deal = normalizeObject(input.deal);
  const analysis = normalizeObject(input.analysis);

  const purchasePrice = optionalNumber(deal.purchasePrice ?? deal.askingPrice);
  const arv = optionalNumber(deal.estimatedArv ?? analysis.supportedBaseArv);
  const rehabBudget = optionalNumber(deal.rehabBudget);
  const cashRequired = optionalNumber(analysis.cashRequired);
  const baseRoi = optionalNumber(analysis.roi);

  const expectedRoi = baseRoi !== null ? baseRoi * (multipliers.roi ?? 1) : null;
  const expectedEquity = (arv !== null && purchasePrice !== null)
    ? (arv - purchasePrice - (rehabBudget ?? 0)) * (multipliers.equity ?? 1)
    : null;
  const cashReturned = cashRequired !== null ? cashRequired * (multipliers.cashReturn ?? 0.6) : null;
  const irr = expectedRoi !== null ? expectedRoi * (multipliers.irr ?? 0.85) : null;
  const paybackMonths = cashRequired !== null && expectedEquity !== null && expectedEquity > 0
    ? Math.max(6, Math.round((cashRequired / expectedEquity) * 24 * (multipliers.payback ?? 1)))
    : null;
  const riskRating = baseRoi !== null
    ? scoreOrUnknown(100 - (baseRoi * 180) + (multipliers.risk ?? 0))
    : 'UNKNOWN';

  const confidence = scoreOrUnknown(averageKnown([
    expectedRoi !== null ? Math.min(100, expectedRoi * 300) : null,
    expectedEquity !== null ? Math.min(100, expectedEquity / 3000) : null,
    optionalNumber(riskRating) !== null ? 100 - optionalNumber(riskRating) : null,
  ]));

  return {
    strategy: label,
    expectedRoi: knownOrUnknown(expectedRoi),
    expectedEquity: knownOrUnknown(expectedEquity),
    cashReturned: knownOrUnknown(cashReturned),
    irr: knownOrUnknown(irr),
    paybackMonths: knownOrUnknown(paybackMonths),
    riskRating,
    confidence,
    advisoryOnly: true,
  };
}

export function buildExitStrategyEngine(input = {}) {
  const strategies = [
    makeExitMetrics('Flip', input, { roi: 1.1, equity: 1, cashReturn: 0.55, irr: 1.0, payback: 0.8, risk: 12 }),
    makeExitMetrics('BRRRR', input, { roi: 0.95, equity: 1.05, cashReturn: 0.75, irr: 0.92, payback: 1.1, risk: 8 }),
    makeExitMetrics('Long-term Rental', input, { roi: 0.8, equity: 1.15, cashReturn: 0.45, irr: 0.78, payback: 1.3, risk: 5 }),
    makeExitMetrics('Wholesale', input, { roi: 0.55, equity: 0.55, cashReturn: 0.9, irr: 1.2, payback: 0.55, risk: 15 }),
    makeExitMetrics('Hold for Appreciation', input, { roi: 0.7, equity: 1.25, cashReturn: 0.35, irr: 0.7, payback: 1.6, risk: 7 }),
  ];

  return {
    strategies,
    bestByConfidence: strategies
      .filter((entry) => Number.isFinite(optionalNumber(entry.confidence)))
      .sort((left, right) => optionalNumber(right.confidence) - optionalNumber(left.confidence))[0]?.strategy || 'UNKNOWN',
    advisoryOnly: true,
  };
}

function concentrationByKey(items = [], keyName) {
  const map = new Map();
  items.forEach((item) => {
    const key = safeString(item?.[keyName], 'UNKNOWN');
    const current = map.get(key) || 0;
    map.set(key, current + safeNumber(item?.currentValue ?? item?.value));
  });
  return map;
}

export function buildPortfolioPredictiveIntelligence(input = {}) {
  const properties = normalizeArray(input.properties);
  const portfolio = normalizeObject(input.portfolioContext);

  const totalValue = optionalNumber(portfolio.totalCurrentValue)
    ?? properties.reduce((sum, property) => sum + safeNumber(property.currentValue ?? property.value), 0);
  const totalDebt = optionalNumber(portfolio.totalOutstandingDebt)
    ?? properties.reduce((sum, property) => sum + safeNumber(property.currentLoanBalance ?? property.debt), 0);
  const reserveShortfall = optionalNumber(portfolio.reserveShortfallValue);

  const strategyMix = new Set(properties.map((property) => safeString(property.strategy, 'UNKNOWN'))).size;
  const diversification = properties.length ? scoreOrUnknown(45 + strategyMix * 10 - (properties.length > 10 ? 0 : 5)) : 'UNKNOWN';

  const capitalAllocation = scoreOrUnknown(averageKnown([
    optionalNumber(diversification),
    reserveShortfall !== null ? clamp(100 - reserveShortfall / 5000, 0, 100) : null,
  ]));

  const liquidityImpact = reserveShortfall !== null
    ? (reserveShortfall > 0 ? 'NEGATIVE' : 'STABLE')
    : 'UNKNOWN';

  const cityConcentration = concentrationByKey(properties, 'city');
  const maxCityExposure = totalValue > 0
    ? Math.max(...Array.from(cityConcentration.values()).map((value) => value / totalValue))
    : null;

  const geographicExposure = maxCityExposure !== null ? knownOrUnknown(Math.round(maxCityExposure * 100)) : 'UNKNOWN';
  const portfolioConcentration = maxCityExposure !== null ? scoreOrUnknown(maxCityExposure * 120) : 'UNKNOWN';
  const debtExposure = totalValue > 0 ? knownOrUnknown((totalDebt / totalValue) * 100) : 'UNKNOWN';
  const cashReserveImpact = reserveShortfall !== null ? (reserveShortfall > 0 ? 'RESERVE_SHORTFALL' : 'RESERVE_STABLE') : 'UNKNOWN';

  return {
    diversification,
    capitalAllocation,
    liquidityImpact,
    geographicExposure,
    portfolioConcentration,
    debtExposure,
    cashReserveImpact,
    advisoryOnly: true,
  };
}

function adjustValue(value, pct) {
  return value !== null ? value * (1 + pct) : null;
}

export function buildSensitivityAnalysis(input = {}) {
  const deal = normalizeObject(input.deal);
  const analysis = normalizeObject(input.analysis);

  const arv = optionalNumber(deal.estimatedArv ?? analysis.supportedBaseArv);
  const rehab = optionalNumber(deal.rehabBudget ?? analysis.rehabBudget);
  const interestRate = optionalNumber(analysis.interestRate ?? deal.annualInterestRate);
  const holdMonths = optionalNumber(deal.holdingMonths ?? analysis.holdingMonths);
  const rent = optionalNumber(deal.estimatedRent ?? analysis.estimatedRent);

  return {
    arvSensitivity: {
      plus5: knownOrUnknown(adjustValue(arv, 0.05)),
      minus5: knownOrUnknown(adjustValue(arv, -0.05)),
      plus10: knownOrUnknown(adjustValue(arv, 0.1)),
      minus10: knownOrUnknown(adjustValue(arv, -0.1)),
    },
    rehabSensitivity: {
      plus10: knownOrUnknown(adjustValue(rehab, 0.1)),
      minus10: knownOrUnknown(adjustValue(rehab, -0.1)),
      plus20: knownOrUnknown(adjustValue(rehab, 0.2)),
      minus20: knownOrUnknown(adjustValue(rehab, -0.2)),
    },
    interestRateSensitivity: {
      plus100bps: knownOrUnknown(adjustValue(interestRate, 0.01)),
      plus200bps: knownOrUnknown(adjustValue(interestRate, 0.02)),
      minus100bps: knownOrUnknown(adjustValue(interestRate, -0.01)),
    },
    holdingPeriodSensitivity: {
      plus30Days: knownOrUnknown(holdMonths !== null ? holdMonths + 1 : null),
      plus60Days: knownOrUnknown(holdMonths !== null ? holdMonths + 2 : null),
      minus30Days: knownOrUnknown(holdMonths !== null ? Math.max(0, holdMonths - 1) : null),
    },
    rentSensitivity: {
      plus5: knownOrUnknown(adjustValue(rent, 0.05)),
      minus5: knownOrUnknown(adjustValue(rent, -0.05)),
      minus10: knownOrUnknown(adjustValue(rent, -0.1)),
    },
    advisoryOnly: true,
  };
}

export function buildOpportunityRanking(input = {}) {
  const deal = normalizeObject(input.deal);
  const analysis = normalizeObject(input.analysis);
  const marketEngine = normalizeObject(input.marketEngine);
  const exitEngine = normalizeObject(input.exitEngine);

  const roi = optionalNumber(analysis.roi);
  const risk = optionalNumber(analysis.overallRisk);
  const marketConfidence = optionalNumber(marketEngine.marketConfidence);
  const bestExit = normalizeArray(exitEngine.strategies)
    .filter((entry) => Number.isFinite(optionalNumber(entry.confidence)))
    .sort((left, right) => optionalNumber(right.confidence) - optionalNumber(left.confidence))[0] || {};

  const topOpportunityScore = scoreOrUnknown(averageKnown([
    roi !== null ? clamp(roi * 300, 0, 100) : null,
    risk !== null ? 100 - risk : null,
    marketConfidence,
    optionalNumber(bestExit.confidence),
  ]));

  const priorityRank = topOpportunityScore === 'UNKNOWN'
    ? 'UNKNOWN'
    : topOpportunityScore >= 85
      ? 'A'
      : topOpportunityScore >= 70
        ? 'B'
        : topOpportunityScore >= 55
          ? 'C'
          : 'D';

  const capitalPriority = roi !== null && roi >= 0.15 ? 'HIGH' : roi !== null && roi >= 0.08 ? 'MEDIUM' : 'LOW';
  const riskAdjustedReturn = (roi !== null && risk !== null)
    ? knownOrUnknown((roi * 100) - (risk * 0.5))
    : 'UNKNOWN';

  const requiredAttention = risk !== null && risk >= 60
    ? 'IMMEDIATE'
    : topOpportunityScore !== 'UNKNOWN' && topOpportunityScore < 60
      ? 'ELEVATED'
      : 'STANDARD';

  return {
    dealReference: safeString(deal.propertyAddress ?? deal.id, 'UNKNOWN'),
    topOpportunityScore,
    priorityRank,
    capitalPriority,
    riskAdjustedReturn,
    requiredAttention,
    advisoryOnly: true,
  };
}

export function buildExecutivePredictiveSummary(input = {}) {
  const market = normalizeObject(input.marketEngine);
  const rehab = normalizeObject(input.rehabEngine);
  const exits = normalizeObject(input.exitEngine);
  const portfolio = normalizeObject(input.portfolioEngine);
  const ranking = normalizeObject(input.rankingEngine);

  const strengths = [];
  if (optionalNumber(market.marketConfidence) !== null && optionalNumber(market.marketConfidence) >= 70) strengths.push('Market confidence is favorable for current assumptions.');
  if (safeString(exits.bestByConfidence) !== 'UNKNOWN') strengths.push(`Best exit by confidence is ${exits.bestByConfidence}.`);
  if (optionalNumber(portfolio.diversification) !== null && optionalNumber(portfolio.diversification) >= 65) strengths.push('Portfolio diversification metrics are supportive.');

  const weaknesses = [];
  if (optionalNumber(rehab.scheduleRisk) !== null && optionalNumber(rehab.scheduleRisk) >= 60) weaknesses.push('Schedule risk is elevated.');
  if (safeString(portfolio.liquidityImpact) === 'NEGATIVE') weaknesses.push('Liquidity impact indicates reserve pressure.');

  const unknowns = [];
  if (safeString(market.inventoryTrend) === 'UNKNOWN') unknowns.push('Inventory trend is UNKNOWN.');
  if (safeString(market.priceMomentum) === 'UNKNOWN') unknowns.push('Price momentum is UNKNOWN.');
  if (safeString(rehab.rehabDuration) === 'UNKNOWN') unknowns.push('Rehab duration is UNKNOWN.');

  const primaryRisks = [];
  if (optionalNumber(rehab.permitRisk) !== null && optionalNumber(rehab.permitRisk) >= 55) primaryRisks.push('Permit risk can affect delivery timelines.');
  if (safeString(ranking.requiredAttention) === 'IMMEDIATE') primaryRisks.push('Opportunity requires immediate executive attention.');

  const recommendedNextSteps = [
    'Validate unknown inputs before committing capital.',
    'Review sensitivity downside scenarios and reserve requirements.',
    'Confirm contractor schedule and permit readiness before approval.',
  ];

  const evidenceUsed = [
    'Deal intake fields',
    'Current underwriting analysis',
    'Portfolio summary context',
    'Comparable and market context where available',
  ];

  const confidence = scoreOrUnknown(averageKnown([
    optionalNumber(market.marketConfidence),
    optionalNumber(rehab.costConfidence),
    optionalNumber(ranking.topOpportunityScore),
  ]));

  return {
    strengths,
    weaknesses,
    unknowns,
    primaryRisks,
    recommendedNextSteps,
    evidenceUsed,
    confidence,
    advisoryOnly: true,
  };
}

export function buildEnterprisePredictiveIntelligenceEngine(input = {}) {
  const marketEngine = buildPredictiveMarketEngine(input);
  const rehabEngine = buildRehabPredictionEngine(input);
  const exitEngine = buildExitStrategyEngine(input);
  const portfolioEngine = buildPortfolioPredictiveIntelligence(input);
  const sensitivityEngine = buildSensitivityAnalysis(input);
  const rankingEngine = buildOpportunityRanking({
    ...input,
    marketEngine,
    exitEngine,
  });
  const executiveSummary = buildExecutivePredictiveSummary({
    marketEngine,
    rehabEngine,
    exitEngine,
    portfolioEngine,
    rankingEngine,
  });

  return {
    advisoryOnly: true,
    approvalState: 'PENDING_USER_APPROVAL',
    marketEngine,
    rehabEngine,
    exitEngine,
    portfolioEngine,
    sensitivityEngine,
    rankingEngine,
    executiveSummary,
  };
}
