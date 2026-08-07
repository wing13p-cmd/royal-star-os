function safeNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

import { buildEnterprisePredictiveIntelligenceEngine } from './enterprisePredictiveIntelligenceEngine.js';
import { buildEnterpriseIntelligenceLayer } from './enterpriseIntelligenceLayer.js';

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

function averageKnown(values = []) {
  const known = values.filter((value) => Number.isFinite(value));
  if (!known.length) return null;
  return known.reduce((sum, value) => sum + value, 0) / known.length;
}

function scoreOrUnknown(value) {
  return Number.isFinite(value) ? clamp(Math.round(value), 0, 100) : 'UNKNOWN';
}

function knownOrUnknownNumber(value) {
  return Number.isFinite(value) ? value : 'UNKNOWN';
}

function makeDecisionId(prefix = 'decision') {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export const DEFAULT_DECISION_RULES = {
  maximumRehabPct: 0.35,
  maximumLtv: 0.8,
  minimumRoi: 0.12,
  minimumEquity: 50000,
  maximumHoldCost: 45000,
  maximumDom: 120,
  minimumCapRate: 0.06,
  maximumRiskScore: 65,
};

export function mergeDecisionRules(overrides = {}) {
  const candidate = normalizeObject(overrides);
  return {
    maximumRehabPct: optionalNumber(candidate.maximumRehabPct) ?? DEFAULT_DECISION_RULES.maximumRehabPct,
    maximumLtv: optionalNumber(candidate.maximumLtv) ?? DEFAULT_DECISION_RULES.maximumLtv,
    minimumRoi: optionalNumber(candidate.minimumRoi) ?? DEFAULT_DECISION_RULES.minimumRoi,
    minimumEquity: optionalNumber(candidate.minimumEquity) ?? DEFAULT_DECISION_RULES.minimumEquity,
    maximumHoldCost: optionalNumber(candidate.maximumHoldCost) ?? DEFAULT_DECISION_RULES.maximumHoldCost,
    maximumDom: optionalNumber(candidate.maximumDom) ?? DEFAULT_DECISION_RULES.maximumDom,
    minimumCapRate: optionalNumber(candidate.minimumCapRate) ?? DEFAULT_DECISION_RULES.minimumCapRate,
    maximumRiskScore: optionalNumber(candidate.maximumRiskScore) ?? DEFAULT_DECISION_RULES.maximumRiskScore,
  };
}

function buildDealSignalSnapshot(input = {}) {
  const deal = normalizeObject(input.deal);
  const analysis = normalizeObject(input.analysis);
  const portfolio = normalizeObject(input.portfolioContext);

  const purchasePrice = optionalNumber(deal.purchasePrice ?? deal.askingPrice);
  const rehabBudget = optionalNumber(deal.rehabBudget);
  const arv = optionalNumber(deal.estimatedArv ?? deal.arv ?? analysis.supportedBaseArv);
  const monthlyCashFlow = optionalNumber(analysis.monthlyCashFlow ?? deal.monthlyCashFlow);
  const roi = optionalNumber(analysis.roi ?? analysis.projectedRoi);
  const riskScore = optionalNumber(analysis.overallRisk ?? analysis.riskScore);
  const capRate = optionalNumber(analysis.capRate ?? analysis.projectedCapRate);
  const ltv = optionalNumber(analysis.ltv ?? analysis.loanToValue);
  const holdCost = optionalNumber(analysis.holdCost ?? analysis.totalHoldingCost);
  const dom = optionalNumber(deal.daysOnMarket ?? analysis.daysOnMarket);
  const equity = optionalNumber(analysis.equity ?? ((arv !== null && purchasePrice !== null) ? arv - purchasePrice : null));

  return {
    purchasePrice,
    rehabBudget,
    arv,
    monthlyCashFlow,
    roi,
    riskScore,
    capRate,
    ltv,
    holdCost,
    dom,
    equity,
    strategy: safeString(deal.strategy, 'UNKNOWN').toUpperCase(),
    portfolioReserveShortfall: optionalNumber(portfolio.reserveShortfallValue ?? portfolio.reserveShortfall),
    portfolioHealthScore: optionalNumber(portfolio.healthScore),
    evidenceSources: normalizeArray(input.evidenceSources),
  };
}

export function buildDealScoreEngine(input = {}) {
  const snapshot = buildDealSignalSnapshot(input);

  const rehabPct = snapshot.purchasePrice && snapshot.purchasePrice > 0 && snapshot.rehabBudget !== null
    ? snapshot.rehabBudget / snapshot.purchasePrice
    : null;

  const acquisitionScore = snapshot.roi !== null
    ? scoreOrUnknown(55 + (snapshot.roi * 220) - (snapshot.riskScore !== null ? snapshot.riskScore * 0.18 : 0))
    : 'UNKNOWN';
  const rehabComplexity = rehabPct !== null
    ? scoreOrUnknown(30 + rehabPct * 180)
    : 'UNKNOWN';
  const riskScore = snapshot.riskScore !== null
    ? scoreOrUnknown(snapshot.riskScore)
    : 'UNKNOWN';
  const capitalEfficiency = (snapshot.roi !== null && snapshot.holdCost !== null)
    ? scoreOrUnknown(65 + snapshot.roi * 180 - Math.min(snapshot.holdCost / 1500, 35))
    : snapshot.roi !== null
      ? scoreOrUnknown(65 + snapshot.roi * 180)
      : 'UNKNOWN';
  const exitConfidence = (snapshot.arv !== null && snapshot.roi !== null)
    ? scoreOrUnknown(45 + snapshot.roi * 150 + (snapshot.capRate !== null ? snapshot.capRate * 240 : 0))
    : 'UNKNOWN';
  const cashFlowPotential = snapshot.monthlyCashFlow !== null
    ? scoreOrUnknown(50 + Math.min(snapshot.monthlyCashFlow / 25, 50))
    : 'UNKNOWN';
  const appreciationPotential = snapshot.arv !== null && snapshot.purchasePrice !== null
    ? scoreOrUnknown(40 + Math.max(0, ((snapshot.arv - snapshot.purchasePrice) / Math.max(snapshot.purchasePrice, 1)) * 200))
    : 'UNKNOWN';
  const portfolioFit = snapshot.portfolioHealthScore !== null
    ? scoreOrUnknown(45 + (snapshot.portfolioHealthScore * 0.4) - (snapshot.portfolioReserveShortfall && snapshot.portfolioReserveShortfall > 0 ? 18 : 0))
    : 'UNKNOWN';

  const overall = averageKnown([
    optionalNumber(acquisitionScore),
    optionalNumber(capitalEfficiency),
    optionalNumber(exitConfidence),
    optionalNumber(cashFlowPotential),
    optionalNumber(appreciationPotential),
    optionalNumber(portfolioFit),
    riskScore === 'UNKNOWN' ? null : 100 - riskScore,
  ]);

  return {
    scores: {
      acquisitionScore,
      rehabComplexity,
      riskScore,
      capitalEfficiency,
      exitConfidence,
      cashFlowPotential,
      appreciationPotential,
      portfolioFit,
      overallScore: scoreOrUnknown(overall),
    },
    knownSignals: {
      purchasePrice: knownOrUnknownNumber(snapshot.purchasePrice),
      rehabBudget: knownOrUnknownNumber(snapshot.rehabBudget),
      arv: knownOrUnknownNumber(snapshot.arv),
      monthlyCashFlow: knownOrUnknownNumber(snapshot.monthlyCashFlow),
      roi: knownOrUnknownNumber(snapshot.roi),
      capRate: knownOrUnknownNumber(snapshot.capRate),
      ltv: knownOrUnknownNumber(snapshot.ltv),
      holdCost: knownOrUnknownNumber(snapshot.holdCost),
      dom: knownOrUnknownNumber(snapshot.dom),
      equity: knownOrUnknownNumber(snapshot.equity),
    },
  };
}

function evaluateRule(name, currentValue, comparator, threshold) {
  if (!Number.isFinite(currentValue)) {
    return { name, status: 'UNKNOWN', currentValue: 'UNKNOWN', threshold, comparator };
  }

  let pass = false;
  if (comparator === '<=') pass = currentValue <= threshold;
  if (comparator === '>=') pass = currentValue >= threshold;

  return {
    name,
    status: pass ? 'PASS' : 'FAIL',
    currentValue,
    threshold,
    comparator,
  };
}

export function evaluateDecisionRules(input = {}, rulesConfig = {}) {
  const rules = mergeDecisionRules(rulesConfig);
  const snapshot = buildDealSignalSnapshot(input);

  const rehabPct = snapshot.purchasePrice && snapshot.purchasePrice > 0 && snapshot.rehabBudget !== null
    ? snapshot.rehabBudget / snapshot.purchasePrice
    : null;

  const checks = [
    evaluateRule('Maximum Rehab %', rehabPct, '<=', rules.maximumRehabPct),
    evaluateRule('Maximum LTV', snapshot.ltv, '<=', rules.maximumLtv),
    evaluateRule('Minimum ROI', snapshot.roi, '>=', rules.minimumRoi),
    evaluateRule('Minimum Equity', snapshot.equity, '>=', rules.minimumEquity),
    evaluateRule('Maximum Hold Cost', snapshot.holdCost, '<=', rules.maximumHoldCost),
    evaluateRule('Maximum DOM', snapshot.dom, '<=', rules.maximumDom),
    evaluateRule('Minimum Cap Rate', snapshot.capRate, '>=', rules.minimumCapRate),
    evaluateRule('Maximum Risk Score', snapshot.riskScore, '<=', rules.maximumRiskScore),
  ];

  return {
    rules,
    checks,
    summary: {
      passCount: checks.filter((check) => check.status === 'PASS').length,
      failCount: checks.filter((check) => check.status === 'FAIL').length,
      unknownCount: checks.filter((check) => check.status === 'UNKNOWN').length,
    },
  };
}

function classifyRecommendation(scoreCard = {}, ruleResult = {}) {
  const overall = optionalNumber(scoreCard.overallScore);
  const failCount = safeNumber(ruleResult.summary?.failCount, 0);
  const unknownCount = safeNumber(ruleResult.summary?.unknownCount, 0);
  const riskScore = optionalNumber(scoreCard.riskScore);

  if (overall === null) return 'REVIEW';
  if (failCount >= 3) return 'PASS';
  if (riskScore !== null && riskScore > 75) return 'PASS';
  if (failCount >= 2) return 'REDUCE OFFER';
  if (unknownCount >= 3) return 'REVIEW';
  if (overall >= 85 && failCount === 0) return 'STRONG BUY';
  if (overall >= 72 && failCount <= 1) return 'BUY';
  if (overall >= 60) return 'NEGOTIATE';
  return 'REVIEW';
}

function buildSupportingFactors(scoreCard = {}, ruleResult = {}) {
  const factors = [];
  if (optionalNumber(scoreCard.acquisitionScore) >= 75) factors.push('Acquisition score is strong.');
  if (optionalNumber(scoreCard.capitalEfficiency) >= 70) factors.push('Capital efficiency is above threshold.');
  if (optionalNumber(scoreCard.exitConfidence) >= 70) factors.push('Exit confidence is supported by current evidence.');
  if (safeNumber(ruleResult.summary?.failCount, 0) === 0) factors.push('Configured investment rules currently pass.');
  return factors;
}

function buildMissingInformation(scoreCard = {}, ruleResult = {}) {
  const missing = [];
  if (scoreCard.acquisitionScore === 'UNKNOWN') missing.push('Acquisition score inputs are incomplete.');
  if (scoreCard.cashFlowPotential === 'UNKNOWN') missing.push('Cash flow inputs are missing or unverified.');
  if (scoreCard.appreciationPotential === 'UNKNOWN') missing.push('Appreciation inputs are missing.');
  if (scoreCard.portfolioFit === 'UNKNOWN') missing.push('Portfolio fit inputs are incomplete.');
  if (safeNumber(ruleResult.summary?.unknownCount, 0) > 0) missing.push('One or more rule checks are UNKNOWN due to missing values.');
  return missing;
}

function buildRiskFactors(scoreCard = {}, ruleResult = {}) {
  const risks = [];
  if (optionalNumber(scoreCard.riskScore) !== null && optionalNumber(scoreCard.riskScore) > 60) risks.push('Risk score is elevated.');
  const failedRules = normalizeArray(ruleResult.checks).filter((check) => check.status === 'FAIL');
  failedRules.forEach((check) => risks.push(`${check.name} failed.`));
  return risks;
}

function buildConfidencePercentage(scoreCard = {}, missingInfo = [], riskFactors = []) {
  const knownScores = [
    optionalNumber(scoreCard.acquisitionScore),
    optionalNumber(scoreCard.capitalEfficiency),
    optionalNumber(scoreCard.exitConfidence),
    optionalNumber(scoreCard.cashFlowPotential),
    optionalNumber(scoreCard.appreciationPotential),
    optionalNumber(scoreCard.portfolioFit),
  ].filter((value) => value !== null).length;

  const base = 35 + knownScores * 9;
  const penalty = missingInfo.length * 8 + riskFactors.length * 3;
  return clamp(Math.round(base - penalty), 0, 100);
}

export function buildEnterpriseRecommendationEngine(scoreEngine = {}, ruleResult = {}) {
  const scoreCard = normalizeObject(scoreEngine.scores);
  const recommendation = classifyRecommendation(scoreCard, ruleResult);
  const supportingFactors = buildSupportingFactors(scoreCard, ruleResult);
  const missingInformation = buildMissingInformation(scoreCard, ruleResult);
  const riskFactors = buildRiskFactors(scoreCard, ruleResult);
  const confidencePercent = buildConfidencePercentage(scoreCard, missingInformation, riskFactors);

  return {
    recommendation,
    advisoryOnly: true,
    approvalState: 'PENDING_USER_APPROVAL',
    confidencePercent,
    confidenceLabel: confidencePercent >= 80 ? 'HIGH' : confidencePercent >= 60 ? 'MODERATE' : confidencePercent >= 40 ? 'LOW' : 'UNKNOWN',
    supportingFactors,
    missingInformation,
    riskFactors,
    reasoningSummary: `Recommendation ${recommendation} is based on scorecard strength, rule outcomes, and unknown/risk penalties.`,
  };
}

export function buildExplainabilityEngine(scoreEngine = {}, recommendationEngine = {}, ruleResult = {}, input = {}) {
  const scoreCard = normalizeObject(scoreEngine.scores);
  const evidenceSources = normalizeArray(input.evidenceSources);
  const positiveContributors = [];
  const negativeContributors = [];
  const unknownVariables = [];

  Object.entries(scoreCard).forEach(([key, value]) => {
    if (value === 'UNKNOWN') unknownVariables.push(key);
    if (Number.isFinite(value) && value >= 70) positiveContributors.push(`${key} contributed positively (${value}).`);
    if (Number.isFinite(value) && value <= 45) negativeContributors.push(`${key} is weak (${value}).`);
  });

  const failedRules = normalizeArray(ruleResult.checks).filter((check) => check.status === 'FAIL');
  failedRules.forEach((check) => negativeContributors.push(`${check.name} failed against configured threshold.`));

  return {
    whyItScoredThisWay: recommendationEngine.reasoningSummary,
    positiveContributors,
    negativeContributors,
    unknownVariables,
    evidenceSources: evidenceSources.length ? evidenceSources : ['deal-input', 'analysis-input', 'portfolio-context'],
    confidenceLevel: recommendationEngine.confidenceLabel || 'UNKNOWN',
  };
}

function applyScenario(baseSnapshot = {}, adjustments = {}) {
  const roi = optionalNumber(baseSnapshot.roi);
  const riskScore = optionalNumber(baseSnapshot.riskScore);
  const monthlyCashFlow = optionalNumber(baseSnapshot.monthlyCashFlow);
  const capRate = optionalNumber(baseSnapshot.capRate);

  const adjustedRoi = roi !== null ? roi + safeNumber(adjustments.roiDelta, 0) : null;
  const adjustedRisk = riskScore !== null ? riskScore + safeNumber(adjustments.riskDelta, 0) : null;
  const adjustedCashFlow = monthlyCashFlow !== null ? monthlyCashFlow + safeNumber(adjustments.cashFlowDelta, 0) : null;
  const adjustedCapRate = capRate !== null ? capRate + safeNumber(adjustments.capRateDelta, 0) : null;

  return {
    roi: knownOrUnknownNumber(adjustedRoi),
    riskScore: knownOrUnknownNumber(adjustedRisk),
    monthlyCashFlow: knownOrUnknownNumber(adjustedCashFlow),
    capRate: knownOrUnknownNumber(adjustedCapRate),
  };
}

export function buildEnterpriseScenarioEngine(input = {}) {
  const baseSnapshot = buildDealSignalSnapshot(input);

  return {
    actualSnapshot: {
      roi: knownOrUnknownNumber(baseSnapshot.roi),
      riskScore: knownOrUnknownNumber(baseSnapshot.riskScore),
      monthlyCashFlow: knownOrUnknownNumber(baseSnapshot.monthlyCashFlow),
      capRate: knownOrUnknownNumber(baseSnapshot.capRate),
    },
    scenarios: {
      bestCase: applyScenario(baseSnapshot, { roiDelta: 0.04, riskDelta: -12, cashFlowDelta: 350, capRateDelta: 0.01 }),
      expectedCase: applyScenario(baseSnapshot, { roiDelta: 0, riskDelta: 0, cashFlowDelta: 0, capRateDelta: 0 }),
      conservativeCase: applyScenario(baseSnapshot, { roiDelta: -0.03, riskDelta: 10, cashFlowDelta: -250, capRateDelta: -0.006 }),
      worstCase: applyScenario(baseSnapshot, { roiDelta: -0.07, riskDelta: 22, cashFlowDelta: -600, capRateDelta: -0.015 }),
    },
  };
}

export function createDecisionAuditRecord(payload = {}) {
  const normalized = normalizeObject(payload);
  return {
    decisionId: safeString(normalized.decisionId, makeDecisionId()),
    timestamp: safeString(normalized.timestamp, new Date().toISOString()),
    engineVersion: safeString(normalized.engineVersion, 'phase9-batch1-v1'),
    inputs: normalizeObject(normalized.inputs),
    outputs: normalizeObject(normalized.outputs),
    confidence: safeNumber(normalized.confidence, 0),
    evidence: normalizeArray(normalized.evidence),
    advisoryOnly: true,
  };
}

function buildAdapter(name) {
  return {
    provider: name,
    enabled: false,
    status: 'DISABLED',
    mode: 'INTERFACE_ONLY',
    endpoint: 'UNKNOWN',
    apiKeyConfigured: false,
    liveRequestsAllowed: false,
  };
}

export function buildAiReadinessLayer() {
  return {
    enabled: false,
    adapters: {
      openai: buildAdapter('OpenAI'),
      anthropic: buildAdapter('Anthropic'),
      googleGemini: buildAdapter('Google Gemini'),
      localLlm: buildAdapter('Local LLM'),
    },
  };
}

export function buildEnterpriseAiDecisionEngine(input = {}) {
  const scoreEngine = buildDealScoreEngine(input);
  const ruleEngine = evaluateDecisionRules(input, input.rulesConfig);
  const recommendationEngine = buildEnterpriseRecommendationEngine(scoreEngine, ruleEngine);
  const explainability = buildExplainabilityEngine(scoreEngine, recommendationEngine, ruleEngine, input);
  const scenarioEngine = buildEnterpriseScenarioEngine(input);
  const readiness = buildAiReadinessLayer();
  const predictiveIntelligence = buildEnterprisePredictiveIntelligenceEngine(input);
  const enterpriseIntelligenceLayer = buildEnterpriseIntelligenceLayer({
    ...input,
    scoreEngine,
    recommendationEngine,
    ruleEngine,
    explainability,
    scenarioEngine,
    predictiveIntelligence,
  });

  const audit = createDecisionAuditRecord({
    decisionId: makeDecisionId('enterprise-ai'),
    engineVersion: safeString(input.engineVersion, 'phase9-batch1-v1'),
    inputs: {
      deal: normalizeObject(input.deal),
      analysis: normalizeObject(input.analysis),
      portfolioContext: normalizeObject(input.portfolioContext),
      rulesConfig: mergeDecisionRules(input.rulesConfig),
    },
    outputs: {
      scores: scoreEngine.scores,
      recommendation: recommendationEngine.recommendation,
      ruleSummary: ruleEngine.summary,
      explainability,
    },
    confidence: recommendationEngine.confidencePercent,
    evidence: explainability.evidenceSources,
  });

  return {
    advisoryOnly: true,
    approvalState: 'PENDING_USER_APPROVAL',
    scoreEngine,
    recommendationEngine,
    explainability,
    ruleEngine,
    scenarioEngine,
    predictiveIntelligence,
    enterpriseIntelligenceLayer,
    audit,
    aiReadinessLayer: readiness,
  };
}
