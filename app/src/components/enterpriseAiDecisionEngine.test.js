import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildDealScoreEngine,
  evaluateDecisionRules,
  buildEnterpriseRecommendationEngine,
  buildExplainabilityEngine,
  buildEnterpriseScenarioEngine,
  createDecisionAuditRecord,
  buildAiReadinessLayer,
  buildEnterpriseAiDecisionEngine,
  mergeDecisionRules,
} from './enterpriseAiDecisionEngine.js';

test('deal score engine produces bounded score outputs without mutating inputs', () => {
  const input = {
    deal: { purchasePrice: 180000, rehabBudget: 45000, estimatedArv: 310000, strategy: 'Flip' },
    analysis: { monthlyCashFlow: 900, roi: 0.18, overallRisk: 34, capRate: 0.075, ltv: 0.71, holdCost: 18000 },
    portfolioContext: { healthScore: 84, reserveShortfallValue: 0 },
  };

  const result = buildDealScoreEngine(input);
  assert.ok(result.scores.overallScore >= 0 && result.scores.overallScore <= 100);
  assert.ok(result.scores.acquisitionScore >= 0 && result.scores.acquisitionScore <= 100);
  assert.equal(input.deal.purchasePrice, 180000);
});

test('deal score engine preserves UNKNOWN for missing values', () => {
  const result = buildDealScoreEngine({ deal: {}, analysis: {}, portfolioContext: {} });
  assert.equal(result.scores.acquisitionScore, 'UNKNOWN');
  assert.equal(result.scores.cashFlowPotential, 'UNKNOWN');
  assert.equal(result.scores.appreciationPotential, 'UNKNOWN');
});

test('rule engine evaluates configurable thresholds', () => {
  const rules = mergeDecisionRules({ maximumRiskScore: 40, minimumRoi: 0.15 });
  const result = evaluateDecisionRules({
    deal: { purchasePrice: 200000, rehabBudget: 50000, estimatedArv: 320000, daysOnMarket: 80 },
    analysis: { roi: 0.18, overallRisk: 35, ltv: 0.72, capRate: 0.08, holdCost: 22000, equity: 120000 },
  }, rules);

  assert.ok(result.summary.passCount >= 1);
  assert.equal(result.rules.maximumRiskScore, 40);
  assert.equal(result.rules.minimumRoi, 0.15);
});

test('recommendation engine returns advisory recommendation structure', () => {
  const recommendation = buildEnterpriseRecommendationEngine(
    { scores: { overallScore: 88, acquisitionScore: 90, capitalEfficiency: 83, exitConfidence: 82, cashFlowPotential: 77, appreciationPotential: 74, portfolioFit: 79, riskScore: 28 } },
    { summary: { failCount: 0, unknownCount: 0 }, checks: [] },
  );

  assert.equal(recommendation.recommendation, 'STRONG BUY');
  assert.equal(recommendation.advisoryOnly, true);
  assert.equal(recommendation.approvalState, 'PENDING_USER_APPROVAL');
  assert.ok(recommendation.confidencePercent >= 0 && recommendation.confidencePercent <= 100);
});

test('explainability engine includes contributors unknowns evidence and confidence', () => {
  const explainability = buildExplainabilityEngine(
    { scores: { overallScore: 70, acquisitionScore: 78, riskScore: 62, cashFlowPotential: 'UNKNOWN', portfolioFit: 74 } },
    { confidenceLabel: 'MODERATE', reasoningSummary: 'Rule and score weighted output.' },
    { checks: [{ name: 'Maximum Risk Score', status: 'FAIL' }] },
    { evidenceSources: ['deal-input', 'analysis-input'] },
  );

  assert.ok(explainability.positiveContributors.length >= 1);
  assert.ok(explainability.negativeContributors.length >= 1);
  assert.ok(explainability.unknownVariables.includes('cashFlowPotential'));
  assert.equal(explainability.confidenceLevel, 'MODERATE');
});

test('scenario engine returns best expected conservative worst without replacing actual data', () => {
  const scenarios = buildEnterpriseScenarioEngine({
    deal: { purchasePrice: 190000, estimatedArv: 315000 },
    analysis: { roi: 0.16, overallRisk: 30, monthlyCashFlow: 650, capRate: 0.07 },
  });

  assert.equal(typeof scenarios.actualSnapshot, 'object');
  assert.equal(typeof scenarios.scenarios.bestCase, 'object');
  assert.equal(typeof scenarios.scenarios.expectedCase, 'object');
  assert.equal(typeof scenarios.scenarios.conservativeCase, 'object');
  assert.equal(typeof scenarios.scenarios.worstCase, 'object');
});

test('decision audit stores timestamp engine version inputs outputs confidence evidence and decision id', () => {
  const audit = createDecisionAuditRecord({
    decisionId: 'decision-1',
    timestamp: '2026-08-05T00:00:00.000Z',
    engineVersion: 'phase9-batch1-v1',
    inputs: { deal: { id: 'deal-1' } },
    outputs: { recommendation: 'BUY' },
    confidence: 81,
    evidence: ['deal-input'],
  });

  assert.equal(audit.decisionId, 'decision-1');
  assert.equal(audit.engineVersion, 'phase9-batch1-v1');
  assert.equal(audit.confidence, 81);
  assert.equal(audit.advisoryOnly, true);
});

test('ai readiness layer exposes disabled adapters with interface-only mode', () => {
  const readiness = buildAiReadinessLayer();
  assert.equal(readiness.enabled, false);
  assert.equal(readiness.adapters.openai.enabled, false);
  assert.equal(readiness.adapters.anthropic.enabled, false);
  assert.equal(readiness.adapters.googleGemini.enabled, false);
  assert.equal(readiness.adapters.localLlm.enabled, false);
});

test('enterprise decision engine composes all modules with advisory-only output', () => {
  const result = buildEnterpriseAiDecisionEngine({
    deal: { id: 'deal-1', purchasePrice: 185000, rehabBudget: 42000, estimatedArv: 315000, daysOnMarket: 42, strategy: 'Flip' },
    analysis: { roi: 0.17, overallRisk: 32, monthlyCashFlow: 700, capRate: 0.072, ltv: 0.7, holdCost: 17000 },
    portfolioContext: { healthScore: 86, reserveShortfallValue: 0 },
    rulesConfig: { maximumRiskScore: 60 },
    engineVersion: 'phase9-batch1-v1',
    evidenceSources: ['deal-input', 'analysis-input', 'portfolio-context'],
  });

  assert.equal(result.advisoryOnly, true);
  assert.equal(result.approvalState, 'PENDING_USER_APPROVAL');
  assert.ok(result.recommendationEngine.recommendation.length > 0);
  assert.ok(result.predictiveIntelligence);
  assert.equal(result.predictiveIntelligence.advisoryOnly, true);
  assert.ok(result.predictiveIntelligence.marketEngine);
  assert.ok(result.predictiveIntelligence.exitEngine.strategies.length >= 5);
  assert.ok(result.enterpriseIntelligenceLayer);
  assert.equal(result.enterpriseIntelligenceLayer.advisoryOnly, true);
  assert.equal(result.enterpriseIntelligenceLayer.approvalState, 'PENDING_USER_APPROVAL');
  assert.ok(['STRONG BUY', 'BUY', 'NEGOTIATE', 'WAIT', 'PASS'].includes(result.enterpriseIntelligenceLayer.masterRecommendation.recommendation));
  assert.equal(result.enterpriseIntelligenceLayer.futureIntegrationLayer.enabled, false);
  assert.ok(result.audit.decisionId.length > 0);
  assert.equal(result.aiReadinessLayer.adapters.openai.status, 'DISABLED');
});
