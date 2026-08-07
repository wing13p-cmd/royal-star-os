function safeNumber(value, fallback = null) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
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

function scoreOrUnknown(value) {
  return Number.isFinite(value) ? clamp(Math.round(value), 0, 100) : 'UNKNOWN';
}

function knownOrUnknown(value) {
  return Number.isFinite(value) ? value : 'UNKNOWN';
}

function averageKnown(values = []) {
  const known = values.filter((value) => Number.isFinite(value));
  if (!known.length) return null;
  return known.reduce((sum, value) => sum + value, 0) / known.length;
}

function mapRecommendationToMaster(recommendation, overallScore, failCount, riskScore, unknownCount) {
  if (failCount >= 3) return 'PASS';
  if (Number.isFinite(riskScore) && riskScore >= 75) return 'PASS';
  if (Number.isFinite(overallScore) && overallScore >= 85 && failCount === 0 && (!Number.isFinite(riskScore) || riskScore < 45)) return 'STRONG BUY';
  if (Number.isFinite(overallScore) && overallScore >= 72 && failCount <= 1 && (!Number.isFinite(riskScore) || riskScore < 60)) return 'BUY';
  if (Number.isFinite(overallScore) && overallScore >= 60) return 'NEGOTIATE';
  if (unknownCount >= 3) return 'WAIT';

  const normalized = safeString(recommendation, 'WAIT').toUpperCase();
  if (normalized === 'REVIEW') return 'WAIT';
  if (normalized === 'REDUCE OFFER') return 'NEGOTIATE';
  if (normalized === 'PASS') return 'PASS';
  if (normalized === 'BUY') return 'BUY';
  if (normalized === 'STRONG BUY') return 'STRONG BUY';
  if (normalized === 'NEGOTIATE') return 'NEGOTIATE';
  return 'WAIT';
}

export function buildGovernanceEnvelope(payload = {}) {
  const normalized = normalizeObject(payload);
  return {
    version: safeString(normalized.version, 'phase9-batch3-v1'),
    timestamp: safeString(normalized.timestamp, new Date().toISOString()),
    confidence: Number.isFinite(safeNumber(normalized.confidence)) ? safeNumber(normalized.confidence) : 'UNKNOWN',
    evidence: normalizeArray(normalized.evidence),
    unknownInputs: normalizeArray(normalized.unknownInputs),
    decisionTrace: normalizeArray(normalized.decisionTrace),
    approvalRequired: true,
    advisoryOnly: true,
    automaticApproval: false,
  };
}

export function buildEnterpriseDecisionHub(input = {}) {
  const scoreEngine = normalizeObject(input.scoreEngine);
  const recommendationEngine = normalizeObject(input.recommendationEngine);
  const ruleEngine = normalizeObject(input.ruleEngine);
  const predictive = normalizeObject(input.predictiveIntelligence);
  const portfolioContext = normalizeObject(input.portfolioContext);

  const scores = normalizeObject(scoreEngine.scores);
  const rulesSummary = normalizeObject(ruleEngine.summary);
  const marketEngine = normalizeObject(predictive.marketEngine);
  const exitStrategyEngine = normalizeObject(predictive.exitEngine);
  const portfolioEngine = normalizeObject(predictive.portfolioEngine);

  const riskEngine = {
    overallRisk: Number.isFinite(safeNumber(scores.riskScore)) ? safeNumber(scores.riskScore) : 'UNKNOWN',
    riskBand: Number.isFinite(safeNumber(scores.riskScore))
      ? safeNumber(scores.riskScore) >= 75
        ? 'CRITICAL'
        : safeNumber(scores.riskScore) >= 60
          ? 'HIGH'
          : safeNumber(scores.riskScore) >= 40
            ? 'MODERATE'
            : 'LOW'
      : 'UNKNOWN',
    primaryRisks: [
      ...normalizeArray(recommendationEngine.riskFactors),
      safeString(portfolioEngine.liquidityImpact) === 'NEGATIVE' ? 'Portfolio liquidity impact is negative.' : null,
      safeString(marketEngine.inventoryTrend) === 'UNKNOWN' ? 'Inventory trend is UNKNOWN.' : null,
    ].filter(Boolean),
  };

  const missingInformation = [
    ...normalizeArray(recommendationEngine.missingInformation),
    ...normalizeArray(marketEngine.unknowns),
  ];

  return {
    advisoryOnly: true,
    approvalState: 'PENDING_USER_APPROVAL',
    modules: {
      dealScoreEngine: scoreEngine,
      predictiveIntelligence: predictive,
      portfolioIntelligence: {
        context: portfolioContext,
        portfolioEngine,
      },
      exitStrategyEngine,
      riskEngine,
      marketEngine,
      ruleSummary: {
        passCount: Number.isFinite(safeNumber(rulesSummary.passCount)) ? safeNumber(rulesSummary.passCount) : 'UNKNOWN',
        failCount: Number.isFinite(safeNumber(rulesSummary.failCount)) ? safeNumber(rulesSummary.failCount) : 'UNKNOWN',
        unknownCount: Number.isFinite(safeNumber(rulesSummary.unknownCount)) ? safeNumber(rulesSummary.unknownCount) : 'UNKNOWN',
      },
    },
    missingInformation,
  };
}

export function buildMasterRecommendation(input = {}) {
  const analysis = normalizeObject(input.analysis);
  const decisionHub = normalizeObject(input.decisionHub);
  const recommendationEngine = normalizeObject(input.recommendationEngine);

  const scores = normalizeObject(decisionHub.modules?.dealScoreEngine?.scores);
  const riskEngine = normalizeObject(decisionHub.modules?.riskEngine);
  const rules = normalizeObject(decisionHub.modules?.ruleSummary);
  const ranking = normalizeObject(decisionHub.modules?.predictiveIntelligence?.rankingEngine);

  const overallScore = safeNumber(scores.overallScore);
  const riskScore = safeNumber(riskEngine.overallRisk);
  const failCount = safeNumber(rules.failCount, 0);
  const unknownCount = safeNumber(rules.unknownCount, 0);
  const mappedRecommendation = mapRecommendationToMaster(
    recommendationEngine.recommendation,
    overallScore,
    failCount,
    riskScore,
    unknownCount,
  );

  const capitalRequired = safeNumber(analysis.cashRequired ?? analysis.totalCashRequired);
  const expectedRoi = safeNumber(analysis.roi);
  const confidence = safeNumber(recommendationEngine.confidencePercent);

  const primaryRisks = normalizeArray(riskEngine.primaryRisks);
  const missingInformation = normalizeArray(decisionHub.missingInformation);

  const nextBestAction = mappedRecommendation === 'STRONG BUY' || mappedRecommendation === 'BUY'
    ? 'Advance to executive offer review with reserve and contingency checks.'
    : mappedRecommendation === 'NEGOTIATE'
      ? 'Prepare revised pricing and seller counter strategy.'
      : mappedRecommendation === 'WAIT'
        ? 'Collect missing data and re-run advisory analysis.'
        : 'Preserve capital and evaluate alternative opportunities.';

  return {
    recommendation: mappedRecommendation,
    overallConfidence: Number.isFinite(confidence) ? confidence : 'UNKNOWN',
    overallRisk: Number.isFinite(riskScore) ? scoreOrUnknown(riskScore) : 'UNKNOWN',
    capitalRequired: knownOrUnknown(capitalRequired),
    expectedRoi: knownOrUnknown(expectedRoi),
    primaryRisks,
    missingInformation,
    nextBestAction,
    governance: buildGovernanceEnvelope({
      version: safeString(input.engineVersion, 'phase9-batch3-v1'),
      confidence,
      evidence: normalizeArray(input.evidenceSources),
      unknownInputs: missingInformation,
      decisionTrace: [
        `Base recommendation: ${safeString(recommendationEngine.recommendation, 'UNKNOWN')}`,
        `Rule failures: ${failCount}`,
        `Unknown rule checks: ${unknownCount}`,
        `Overall score: ${Number.isFinite(overallScore) ? overallScore : 'UNKNOWN'}`,
        `Top opportunity score: ${safeString(ranking.topOpportunityScore, 'UNKNOWN')}`,
      ],
    }),
    advisoryOnly: true,
    approvalRequired: true,
  };
}

export function buildCapitalAllocationRecommendation(input = {}) {
  const deal = normalizeObject(input.deal);
  const analysis = normalizeObject(input.analysis);
  const portfolioContext = normalizeObject(input.portfolioContext);
  const masterRecommendation = normalizeObject(input.masterRecommendation);

  const purchasePrice = safeNumber(deal.purchasePrice ?? deal.askingPrice);
  const maxOffer = safeNumber(analysis.maximumAllowableOffer ?? analysis.maxAllowableOffer ?? analysis.recommendedOffer ?? purchasePrice);
  const rehabBudget = safeNumber(deal.rehabBudget ?? analysis.rehabBudget);
  const maxRehab = Number.isFinite(rehabBudget)
    ? rehabBudget * 1.15
    : 'UNKNOWN';

  const maxTotalInvestment = (Number.isFinite(maxOffer) && Number.isFinite(maxRehab))
    ? maxOffer + maxRehab
    : 'UNKNOWN';

  const ltv = safeNumber(analysis.ltv ?? analysis.loanToValue);
  const idealFinancingMix = Number.isFinite(ltv)
    ? {
      debtPercent: clamp(Math.round(ltv * 100), 0, 85),
      equityPercent: clamp(100 - Math.round(ltv * 100), 15, 100),
      source: 'UNDERWRITING_LTV',
    }
    : {
      debtPercent: 'UNKNOWN',
      equityPercent: 'UNKNOWN',
      source: 'UNKNOWN',
    };

  const reserveRequirement = Number.isFinite(safeNumber(portfolioContext.recommendedReserve))
    ? safeNumber(portfolioContext.recommendedReserve)
    : Number.isFinite(safeNumber(portfolioContext.reserveShortfallValue))
      ? safeNumber(portfolioContext.reserveShortfallValue)
      : 'UNKNOWN';

  const capitalPriority = ['STRONG BUY', 'BUY'].includes(safeString(masterRecommendation.recommendation))
    ? 'HIGH'
    : safeString(masterRecommendation.recommendation) === 'NEGOTIATE'
      ? 'MEDIUM'
      : 'LOW';

  const unknownInputs = [
    !Number.isFinite(maxOffer) ? 'Maximum offer is UNKNOWN.' : null,
    !Number.isFinite(safeNumber(maxRehab)) ? 'Maximum rehab is UNKNOWN.' : null,
    reserveRequirement === 'UNKNOWN' ? 'Reserve requirement is UNKNOWN.' : null,
    idealFinancingMix.debtPercent === 'UNKNOWN' ? 'Financing mix is UNKNOWN.' : null,
  ].filter(Boolean);

  return {
    maximumOffer: Number.isFinite(maxOffer) ? maxOffer : 'UNKNOWN',
    maximumRehab: Number.isFinite(safeNumber(maxRehab)) ? safeNumber(maxRehab) : 'UNKNOWN',
    maximumTotalInvestment: Number.isFinite(safeNumber(maxTotalInvestment)) ? safeNumber(maxTotalInvestment) : 'UNKNOWN',
    idealFinancingMix,
    reserveRequirement,
    capitalPriority,
    governance: buildGovernanceEnvelope({
      version: safeString(input.engineVersion, 'phase9-batch3-v1'),
      confidence: safeNumber(masterRecommendation.overallConfidence),
      evidence: normalizeArray(input.evidenceSources),
      unknownInputs,
      decisionTrace: [
        `Master recommendation: ${safeString(masterRecommendation.recommendation)}`,
        `Max offer basis: ${Number.isFinite(maxOffer) ? 'KNOWN' : 'UNKNOWN'}`,
        `LTV basis: ${Number.isFinite(ltv) ? ltv : 'UNKNOWN'}`,
      ],
    }),
    advisoryOnly: true,
    approvalRequired: true,
  };
}

export function buildPortfolioOptimizationRecommendation(input = {}) {
  const portfolioContext = normalizeObject(input.portfolioContext);
  const decisionHub = normalizeObject(input.decisionHub);
  const masterRecommendation = normalizeObject(input.masterRecommendation);

  const portfolioEngine = normalizeObject(decisionHub.modules?.portfolioIntelligence?.portfolioEngine);
  const liquidityImpact = safeString(portfolioEngine.liquidityImpact);
  const concentration = safeNumber(portfolioEngine.portfolioConcentration);
  const debtExposure = safeNumber(portfolioEngine.debtExposure);
  const reserveShortfall = safeNumber(portfolioContext.reserveShortfallValue);

  const actions = [];

  if (Number.isFinite(reserveShortfall) && reserveShortfall > 0) {
    actions.push('Delay');
    actions.push('Refinance');
  }

  if (Number.isFinite(concentration) && concentration >= 70) {
    actions.push('Diversify');
  } else if (Number.isFinite(concentration) && concentration <= 35) {
    actions.push('Concentrate');
  }

  if (Number.isFinite(debtExposure) && debtExposure >= 75) {
    actions.push('Sell');
    actions.push('Refinance');
  }

  if (liquidityImpact === 'STABLE' && ['STRONG BUY', 'BUY'].includes(safeString(masterRecommendation.recommendation))) {
    actions.push('Acquire');
  }

  if (!actions.length) actions.push('Hold');

  const uniqueActions = Array.from(new Set(actions));
  const primaryAction = uniqueActions[0] || 'Hold';

  return {
    primaryAction,
    recommendedActions: uniqueActions,
    rationale: [
      liquidityImpact === 'UNKNOWN' ? 'Liquidity impact is UNKNOWN.' : `Liquidity impact: ${liquidityImpact}.`,
      Number.isFinite(concentration) ? `Portfolio concentration score: ${Math.round(concentration)}.` : 'Portfolio concentration is UNKNOWN.',
      Number.isFinite(debtExposure) ? `Debt exposure: ${Math.round(debtExposure)}%.` : 'Debt exposure is UNKNOWN.',
    ],
    governance: buildGovernanceEnvelope({
      version: safeString(input.engineVersion, 'phase9-batch3-v1'),
      confidence: safeNumber(masterRecommendation.overallConfidence),
      evidence: normalizeArray(input.evidenceSources),
      unknownInputs: [
        liquidityImpact === 'UNKNOWN' ? 'Liquidity impact is UNKNOWN.' : null,
        !Number.isFinite(concentration) ? 'Concentration score is UNKNOWN.' : null,
        !Number.isFinite(debtExposure) ? 'Debt exposure is UNKNOWN.' : null,
      ].filter(Boolean),
      decisionTrace: [
        `Master recommendation: ${safeString(masterRecommendation.recommendation)}`,
        `Primary action: ${primaryAction}`,
      ],
    }),
    advisoryOnly: true,
    approvalRequired: true,
  };
}

export function buildExecutiveDashboardIntelligence(input = {}) {
  const masterRecommendation = normalizeObject(input.masterRecommendation);
  const decisionHub = normalizeObject(input.decisionHub);
  const capitalAllocation = normalizeObject(input.capitalAllocation);
  const portfolioOptimization = normalizeObject(input.portfolioOptimization);

  const scores = normalizeObject(decisionHub.modules?.dealScoreEngine?.scores);
  const portfolioEngine = normalizeObject(decisionHub.modules?.portfolioIntelligence?.portfolioEngine);

  const businessHealth = scoreOrUnknown(averageKnown([
    safeNumber(scores.overallScore),
    safeNumber(masterRecommendation.overallConfidence),
  ]));

  const portfolioHealth = scoreOrUnknown(averageKnown([
    safeNumber(portfolioEngine.diversification),
    safeNumber(portfolioEngine.capitalAllocation),
    Number.isFinite(safeNumber(portfolioEngine.portfolioConcentration)) ? 100 - safeNumber(portfolioEngine.portfolioConcentration) : null,
  ]));

  const acquisitionReadiness = scoreOrUnknown(averageKnown([
    safeNumber(scores.acquisitionScore),
    safeNumber(masterRecommendation.overallConfidence),
  ]));

  const capitalReadiness = scoreOrUnknown(averageKnown([
    safeNumber(scores.capitalEfficiency),
    safeNumber(capitalAllocation.maximumTotalInvestment) !== null ? 70 : null,
  ]));

  const liquidityReadiness = scoreOrUnknown(averageKnown([
    safeString(portfolioEngine.liquidityImpact) === 'STABLE' ? 80 : null,
    safeString(portfolioEngine.liquidityImpact) === 'NEGATIVE' ? 35 : null,
    safeNumber(capitalAllocation.reserveRequirement) !== null ? 70 : null,
  ]));

  const riskExposure = scoreOrUnknown(averageKnown([
    Number.isFinite(safeNumber(masterRecommendation.overallRisk)) ? 100 - safeNumber(masterRecommendation.overallRisk) : null,
    safeNumber(scores.riskScore) !== null ? 100 - safeNumber(scores.riskScore) : null,
  ]));

  const growthCapacity = scoreOrUnknown(averageKnown([
    safeNumber(scores.appreciationPotential),
    safeNumber(scores.cashFlowPotential),
    safeString(portfolioOptimization.primaryAction) === 'Acquire' ? 80 : null,
  ]));

  const operationsReadiness = scoreOrUnknown(averageKnown([
    safeNumber(masterRecommendation.overallConfidence),
    safeNumber(scores.portfolioFit),
    safeString(portfolioOptimization.primaryAction) === 'Delay' ? 40 : null,
  ]));

  return {
    businessHealth,
    portfolioHealth,
    acquisitionReadiness,
    capitalReadiness,
    liquidityReadiness,
    riskExposure,
    growthCapacity,
    operationsReadiness,
    advisoryOnly: true,
    approvalRequired: true,
    governance: buildGovernanceEnvelope({
      version: safeString(input.engineVersion, 'phase9-batch3-v1'),
      confidence: safeNumber(masterRecommendation.overallConfidence),
      evidence: normalizeArray(input.evidenceSources),
      unknownInputs: [
        businessHealth === 'UNKNOWN' ? 'Business health is UNKNOWN.' : null,
        portfolioHealth === 'UNKNOWN' ? 'Portfolio health is UNKNOWN.' : null,
        liquidityReadiness === 'UNKNOWN' ? 'Liquidity readiness is UNKNOWN.' : null,
      ].filter(Boolean),
      decisionTrace: ['Built dashboard metrics from decision hub and allocation outputs.'],
    }),
  };
}

export function buildExecutiveReport(input = {}) {
  const deal = normalizeObject(input.deal);
  const analysis = normalizeObject(input.analysis);
  const masterRecommendation = normalizeObject(input.masterRecommendation);
  const decisionHub = normalizeObject(input.decisionHub);
  const scenarioEngine = normalizeObject(input.scenarioEngine);
  const explainability = normalizeObject(input.explainability);

  const strengths = [
    ...normalizeArray(explainability.positiveContributors).slice(0, 4),
    safeString(masterRecommendation.recommendation) === 'STRONG BUY' ? 'Combined enterprise signals support a high-conviction recommendation.' : null,
  ].filter(Boolean);

  const weaknesses = [
    ...normalizeArray(explainability.negativeContributors).slice(0, 4),
  ].filter(Boolean);

  const opportunities = [];
  const bestExit = safeString(decisionHub.modules?.predictiveIntelligence?.exitStrategyEngine?.bestByConfidence, 'UNKNOWN');
  if (bestExit !== 'UNKNOWN') opportunities.push(`Best modeled exit path by confidence: ${bestExit}.`);
  if (safeString(decisionHub.modules?.marketEngine?.priceMomentum) === 'UP') opportunities.push('Positive price momentum signal supports upside scenarios.');

  const threats = [
    ...normalizeArray(masterRecommendation.primaryRisks),
  ];

  const unknownVariables = Array.from(new Set([
    ...normalizeArray(masterRecommendation.missingInformation),
    ...normalizeArray(explainability.unknownVariables),
  ]));

  return {
    dealSummary: {
      property: safeString(deal.propertyAddress ?? deal.id, 'UNKNOWN'),
      strategy: safeString(deal.strategy, 'UNKNOWN'),
      recommendation: safeString(masterRecommendation.recommendation, 'WAIT'),
    },
    investmentThesis: `Recommendation ${safeString(masterRecommendation.recommendation, 'WAIT')} is derived from integrated deal score, predictive, risk, market, portfolio, and rules-based evidence.`,
    strengths,
    weaknesses,
    opportunities,
    threats,
    financialSummary: {
      capitalRequired: knownOrUnknown(safeNumber(masterRecommendation.capitalRequired)),
      expectedRoi: knownOrUnknown(safeNumber(masterRecommendation.expectedRoi)),
      purchasePrice: knownOrUnknown(safeNumber(deal.purchasePrice ?? deal.askingPrice)),
      rehabBudget: knownOrUnknown(safeNumber(deal.rehabBudget ?? analysis.rehabBudget)),
    },
    scenarioSummary: normalizeObject(scenarioEngine.scenarios),
    supportingEvidence: normalizeArray(input.evidenceSources),
    unknownVariables,
    recommendedAction: safeString(masterRecommendation.recommendation, 'WAIT'),
    governance: buildGovernanceEnvelope({
      version: safeString(input.engineVersion, 'phase9-batch3-v1'),
      confidence: safeNumber(masterRecommendation.overallConfidence),
      evidence: normalizeArray(input.evidenceSources),
      unknownInputs: unknownVariables,
      decisionTrace: [
        'Generated structured executive report from integrated advisory engines.',
      ],
    }),
    advisoryOnly: true,
    approvalRequired: true,
  };
}

function buildDisabledAdapter(name) {
  return {
    provider: name,
    enabled: false,
    status: 'DISABLED',
    mode: 'INTERFACE_ONLY',
    liveRequestsAllowed: false,
  };
}

export function buildFutureIntegrationLayer() {
  return {
    enabled: false,
    adapters: {
      mls: buildDisabledAdapter('MLS'),
      attom: buildDisabledAdapter('ATTOM'),
      coreLogic: buildDisabledAdapter('CoreLogic'),
      rentCast: buildDisabledAdapter('RentCast'),
      googleMaps: buildDisabledAdapter('Google Maps'),
      countyRecords: buildDisabledAdapter('County Records'),
      publicRecords: buildDisabledAdapter('Public Records'),
    },
    advisoryOnly: true,
    approvalRequired: true,
  };
}

export function buildEnterpriseIntelligenceLayer(input = {}) {
  const decisionHub = buildEnterpriseDecisionHub(input);
  const masterRecommendation = buildMasterRecommendation({
    ...input,
    decisionHub,
  });
  const capitalAllocation = buildCapitalAllocationRecommendation({
    ...input,
    masterRecommendation,
  });
  const portfolioOptimization = buildPortfolioOptimizationRecommendation({
    ...input,
    decisionHub,
    masterRecommendation,
  });
  const executiveDashboardIntelligence = buildExecutiveDashboardIntelligence({
    ...input,
    decisionHub,
    masterRecommendation,
    capitalAllocation,
    portfolioOptimization,
  });
  const executiveReport = buildExecutiveReport({
    ...input,
    decisionHub,
    masterRecommendation,
  });
  const futureIntegrationLayer = buildFutureIntegrationLayer();

  const unknownInputs = Array.from(new Set([
    ...normalizeArray(masterRecommendation.missingInformation),
    ...normalizeArray(executiveReport.unknownVariables),
  ]));

  return {
    advisoryOnly: true,
    approvalState: 'PENDING_USER_APPROVAL',
    decisionHub,
    masterRecommendation,
    capitalAllocation,
    portfolioOptimization,
    executiveDashboardIntelligence,
    executiveReport,
    futureIntegrationLayer,
    governance: buildGovernanceEnvelope({
      version: safeString(input.engineVersion, 'phase9-batch3-v1'),
      confidence: safeNumber(masterRecommendation.overallConfidence),
      evidence: normalizeArray(input.evidenceSources),
      unknownInputs,
      decisionTrace: [
        'Integrated deal score, predictive intelligence, portfolio context, risk signals, and market signals.',
        `Master recommendation: ${safeString(masterRecommendation.recommendation)}`,
      ],
    }),
  };
}
