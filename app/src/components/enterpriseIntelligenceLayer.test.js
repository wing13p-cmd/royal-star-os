import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildGovernanceEnvelope,
  buildEnterpriseDecisionHub,
  buildMasterRecommendation,
  buildCapitalAllocationRecommendation,
  buildPortfolioOptimizationRecommendation,
  buildExecutiveDashboardIntelligence,
  buildExecutiveReport,
  buildFutureIntegrationLayer,
  buildEnterpriseIntelligenceLayer,
} from './enterpriseIntelligenceLayer.js';

test('governance envelope enforces advisory-only approval-required structure', () => {
  const result = buildGovernanceEnvelope({
    version: 'phase9-batch3-v1',
    confidence: 77,
    evidence: ['deal-input'],
    unknownInputs: ['ROI is UNKNOWN'],
    decisionTrace: ['Rule check done'],
  });

  assert.equal(result.version, 'phase9-batch3-v1');
  assert.equal(result.approvalRequired, true);
  assert.equal(result.advisoryOnly, true);
  assert.equal(result.automaticApproval, false);
  assert.ok(Array.isArray(result.evidence));
  assert.ok(Array.isArray(result.unknownInputs));
  assert.ok(Array.isArray(result.decisionTrace));
});

test('enterprise decision hub unifies all required engines', () => {
  const result = buildEnterpriseDecisionHub({
    scoreEngine: { scores: { overallScore: 78, riskScore: 36 } },
    recommendationEngine: { riskFactors: ['Risk factor A'], missingInformation: ['Need comp update'] },
    ruleEngine: { summary: { passCount: 6, failCount: 1, unknownCount: 1 } },
    predictiveIntelligence: {
      marketEngine: { inventoryTrend: 'STABLE', unknowns: [] },
      exitEngine: { bestByConfidence: 'Flip', strategies: [{ strategy: 'Flip', confidence: 80 }] },
      portfolioEngine: { liquidityImpact: 'STABLE' },
    },
    portfolioContext: { healthScore: 84 },
  });

  assert.equal(result.advisoryOnly, true);
  assert.equal(result.approvalState, 'PENDING_USER_APPROVAL');
  assert.ok(result.modules.dealScoreEngine);
  assert.ok(result.modules.predictiveIntelligence);
  assert.ok(result.modules.portfolioIntelligence);
  assert.ok(result.modules.exitStrategyEngine);
  assert.ok(result.modules.riskEngine);
  assert.ok(result.modules.marketEngine);
});

test('master recommendation returns one of required executive actions with required summary fields', () => {
  const decisionHub = buildEnterpriseDecisionHub({
    scoreEngine: { scores: { overallScore: 86, riskScore: 31 } },
    recommendationEngine: { recommendation: 'STRONG BUY', riskFactors: [], missingInformation: [] },
    ruleEngine: { summary: { passCount: 8, failCount: 0, unknownCount: 0 } },
    predictiveIntelligence: {
      marketEngine: { marketConfidence: 73, inventoryTrend: 'STABLE', unknowns: [] },
      exitEngine: { bestByConfidence: 'Flip', strategies: [{ strategy: 'Flip', confidence: 79 }] },
      portfolioEngine: { liquidityImpact: 'STABLE' },
      rankingEngine: { topOpportunityScore: 82 },
    },
    portfolioContext: { healthScore: 85 },
  });

  const result = buildMasterRecommendation({
    deal: { propertyAddress: '952 Goss Rd' },
    analysis: { cashRequired: 44000, roi: 0.16 },
    decisionHub,
    recommendationEngine: { recommendation: 'STRONG BUY', confidencePercent: 83, riskFactors: [], missingInformation: [] },
    evidenceSources: ['deal-input', 'analysis-input'],
  });

  assert.ok(['STRONG BUY', 'BUY', 'NEGOTIATE', 'WAIT', 'PASS'].includes(result.recommendation));
  assert.ok(result.overallConfidence !== undefined);
  assert.ok(result.overallRisk !== undefined);
  assert.ok(result.capitalRequired !== undefined);
  assert.ok(result.expectedRoi !== undefined);
  assert.ok(Array.isArray(result.primaryRisks));
  assert.ok(Array.isArray(result.missingInformation));
  assert.ok(typeof result.nextBestAction === 'string');
  assert.equal(result.approvalRequired, true);
  assert.equal(result.advisoryOnly, true);
});

test('capital allocation recommendation returns required allocation fields', () => {
  const result = buildCapitalAllocationRecommendation({
    deal: { purchasePrice: 180000, rehabBudget: 50000 },
    analysis: { maxAllowableOffer: 172000, ltv: 0.72 },
    portfolioContext: { recommendedReserve: 600000 },
    masterRecommendation: { recommendation: 'BUY', overallConfidence: 76 },
    evidenceSources: ['deal-input'],
  });

  assert.ok(result.maximumOffer !== undefined);
  assert.ok(result.maximumRehab !== undefined);
  assert.ok(result.maximumTotalInvestment !== undefined);
  assert.ok(result.idealFinancingMix);
  assert.ok(result.reserveRequirement !== undefined);
  assert.ok(['HIGH', 'MEDIUM', 'LOW'].includes(result.capitalPriority));
  assert.equal(result.approvalRequired, true);
  assert.equal(result.advisoryOnly, true);
});

test('portfolio optimization includes required action vocabulary and chooses a primary action', () => {
  const decisionHub = buildEnterpriseDecisionHub({
    scoreEngine: { scores: { overallScore: 71, riskScore: 48 } },
    recommendationEngine: { recommendation: 'NEGOTIATE', riskFactors: [], missingInformation: [] },
    ruleEngine: { summary: { passCount: 5, failCount: 1, unknownCount: 1 } },
    predictiveIntelligence: {
      marketEngine: { unknowns: [] },
      exitEngine: { strategies: [{ strategy: 'Flip', confidence: 70 }] },
      portfolioEngine: { liquidityImpact: 'NEGATIVE', portfolioConcentration: 76, debtExposure: 78 },
    },
    portfolioContext: { reserveShortfallValue: 120000 },
  });

  const result = buildPortfolioOptimizationRecommendation({
    portfolioContext: { reserveShortfallValue: 120000 },
    decisionHub,
    masterRecommendation: { recommendation: 'NEGOTIATE', overallConfidence: 62 },
    evidenceSources: ['portfolio-context'],
  });

  const allowed = ['Acquire', 'Delay', 'Sell', 'Refinance', 'Hold', 'Diversify', 'Concentrate'];
  assert.ok(allowed.includes(result.primaryAction));
  assert.ok(result.recommendedActions.every((action) => allowed.includes(action)));
  assert.equal(result.approvalRequired, true);
  assert.equal(result.advisoryOnly, true);
});

test('executive dashboard intelligence exposes all required advisory metrics', () => {
  const result = buildExecutiveDashboardIntelligence({
    masterRecommendation: { recommendation: 'BUY', overallConfidence: 74, overallRisk: 39 },
    decisionHub: {
      modules: {
        dealScoreEngine: { scores: { overallScore: 77, acquisitionScore: 78, capitalEfficiency: 73, riskScore: 39, appreciationPotential: 69, cashFlowPotential: 71, portfolioFit: 74 } },
        portfolioIntelligence: { portfolioEngine: { diversification: 66, capitalAllocation: 63, portfolioConcentration: 48, liquidityImpact: 'STABLE' } },
      },
    },
    capitalAllocation: { maximumTotalInvestment: 220000, reserveRequirement: 600000 },
    portfolioOptimization: { primaryAction: 'Acquire' },
    evidenceSources: ['deal-input', 'portfolio-context'],
  });

  assert.ok(result.businessHealth !== undefined);
  assert.ok(result.portfolioHealth !== undefined);
  assert.ok(result.acquisitionReadiness !== undefined);
  assert.ok(result.capitalReadiness !== undefined);
  assert.ok(result.liquidityReadiness !== undefined);
  assert.ok(result.riskExposure !== undefined);
  assert.ok(result.growthCapacity !== undefined);
  assert.ok(result.operationsReadiness !== undefined);
  assert.equal(result.advisoryOnly, true);
  assert.equal(result.approvalRequired, true);
});

test('executive report generator returns required report sections and preserves unknowns', () => {
  const result = buildExecutiveReport({
    deal: { propertyAddress: '952 Goss Rd', strategy: 'Flip', purchasePrice: 180000, rehabBudget: 50000 },
    analysis: { roi: 0.16 },
    masterRecommendation: {
      recommendation: 'BUY',
      capitalRequired: 45000,
      expectedRoi: 0.16,
      primaryRisks: ['Schedule risk elevated'],
      missingInformation: ['Permit status UNKNOWN'],
      overallConfidence: 72,
    },
    decisionHub: {
      modules: {
        predictiveIntelligence: {
          exitStrategyEngine: { bestByConfidence: 'Flip' },
        },
        marketEngine: { priceMomentum: 'UP' },
      },
    },
    scenarioEngine: { scenarios: { bestCase: { roi: 0.2 }, worstCase: { roi: 0.08 } } },
    explainability: {
      positiveContributors: ['acquisitionScore contributed positively (78).'],
      negativeContributors: ['riskScore is weak (42).'],
      unknownVariables: ['cashFlowPotential'],
    },
    evidenceSources: ['deal-input', 'analysis-input'],
  });

  assert.ok(result.dealSummary);
  assert.ok(typeof result.investmentThesis === 'string');
  assert.ok(Array.isArray(result.strengths));
  assert.ok(Array.isArray(result.weaknesses));
  assert.ok(Array.isArray(result.opportunities));
  assert.ok(Array.isArray(result.threats));
  assert.ok(result.financialSummary);
  assert.ok(result.scenarioSummary);
  assert.ok(Array.isArray(result.supportingEvidence));
  assert.ok(Array.isArray(result.unknownVariables));
  assert.ok(result.recommendedAction);
  assert.equal(result.advisoryOnly, true);
  assert.equal(result.approvalRequired, true);
});

test('future integration layer is disabled and contains required provider adapters without live calls', () => {
  const result = buildFutureIntegrationLayer();

  assert.equal(result.enabled, false);
  assert.equal(result.advisoryOnly, true);
  assert.equal(result.approvalRequired, true);
  assert.equal(result.adapters.mls.enabled, false);
  assert.equal(result.adapters.attom.enabled, false);
  assert.equal(result.adapters.coreLogic.enabled, false);
  assert.equal(result.adapters.rentCast.enabled, false);
  assert.equal(result.adapters.googleMaps.enabled, false);
  assert.equal(result.adapters.countyRecords.enabled, false);
  assert.equal(result.adapters.publicRecords.enabled, false);
  assert.ok(Object.values(result.adapters).every((adapter) => adapter.liveRequestsAllowed === false));
});

test('enterprise intelligence layer composes decision hub recommendation optimization dashboard report governance and adapters', () => {
  const result = buildEnterpriseIntelligenceLayer({
    deal: { propertyAddress: '952 Goss Rd', strategy: 'Flip', purchasePrice: 180000, rehabBudget: 50000 },
    analysis: { roi: 0.16, cashRequired: 45000, maxAllowableOffer: 172000, ltv: 0.7 },
    portfolioContext: { healthScore: 84, reserveShortfallValue: 0, recommendedReserve: 600000 },
    scoreEngine: {
      scores: {
        overallScore: 82,
        acquisitionScore: 84,
        capitalEfficiency: 78,
        riskScore: 34,
        appreciationPotential: 73,
        cashFlowPotential: 72,
        portfolioFit: 79,
      },
    },
    recommendationEngine: {
      recommendation: 'BUY',
      confidencePercent: 80,
      riskFactors: ['Risk score is elevated.'],
      missingInformation: [],
    },
    ruleEngine: { summary: { passCount: 7, failCount: 0, unknownCount: 1 } },
    explainability: {
      positiveContributors: ['acquisitionScore contributed positively (84).'],
      negativeContributors: [],
      unknownVariables: [],
    },
    scenarioEngine: { scenarios: { expectedCase: { roi: 0.16 } } },
    predictiveIntelligence: {
      marketEngine: { marketConfidence: 71, inventoryTrend: 'STABLE', priceMomentum: 'UP', unknowns: [] },
      exitEngine: { bestByConfidence: 'Flip', strategies: [{ strategy: 'Flip', confidence: 79 }] },
      portfolioEngine: { diversification: 67, capitalAllocation: 64, liquidityImpact: 'STABLE', portfolioConcentration: 42, debtExposure: 58 },
      rankingEngine: { topOpportunityScore: 76 },
    },
    evidenceSources: ['deal-input', 'analysis-input', 'portfolio-context'],
    engineVersion: 'phase9-batch3-v1',
  });

  assert.equal(result.advisoryOnly, true);
  assert.equal(result.approvalState, 'PENDING_USER_APPROVAL');
  assert.ok(result.decisionHub);
  assert.ok(result.masterRecommendation);
  assert.ok(result.capitalAllocation);
  assert.ok(result.portfolioOptimization);
  assert.ok(result.executiveDashboardIntelligence);
  assert.ok(result.executiveReport);
  assert.ok(result.futureIntegrationLayer);
  assert.ok(result.governance);
});
