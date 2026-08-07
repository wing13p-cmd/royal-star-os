import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildPredictiveMarketEngine,
  buildRehabPredictionEngine,
  buildExitStrategyEngine,
  buildPortfolioPredictiveIntelligence,
  buildSensitivityAnalysis,
  buildOpportunityRanking,
  buildExecutivePredictiveSummary,
  buildEnterprisePredictiveIntelligenceEngine,
} from './enterprisePredictiveIntelligenceEngine.js';

test('predictive market engine returns required market metrics and unknown-safe behavior', () => {
  const result = buildPredictiveMarketEngine({
    deal: { daysOnMarket: 34, appreciationRate: 0.04, rentDemandScore: 72 },
    marketContext: { inventoryMonths: 3.5, saleVelocity: 68 },
    comps: [{ id: 'comp-1' }, { id: 'comp-2' }],
  });

  assert.ok(result.neighborhoodTrendScore !== undefined);
  assert.ok(result.inventoryTrend !== undefined);
  assert.ok(result.priceMomentum !== undefined);
  assert.ok(result.domTrend !== undefined);
  assert.ok(result.saleVelocity !== undefined);
  assert.ok(result.demandScore !== undefined);
  assert.ok(result.supplyScore !== undefined);
  assert.ok(result.marketConfidence !== undefined);
  assert.equal(result.advisoryOnly, true);
});

test('rehab prediction engine estimates duration confidence and contingency recommendation', () => {
  const result = buildRehabPredictionEngine({
    deal: { rehabBudget: 62000, squareFeet: 1450 },
    rehabProjects: [{ estimatedDurationDays: 92, permitStatus: 'Pending' }],
    contractors: [{ status: 'Approved' }, { status: 'Watch' }],
  });

  assert.ok(result.rehabDuration !== undefined);
  assert.ok(result.costConfidence !== undefined);
  assert.ok(result.scheduleRisk !== undefined);
  assert.ok(result.permitRisk !== undefined);
  assert.ok(result.contractorComplexity !== undefined);
  assert.ok(result.materialVolatility !== undefined);
  assert.ok(result.contingencyRecommendation !== undefined);
  assert.equal(result.advisoryOnly, true);
});

test('exit strategy engine returns advisory comparisons for required strategies', () => {
  const result = buildExitStrategyEngine({
    deal: { purchasePrice: 180000, estimatedArv: 305000, rehabBudget: 50000 },
    analysis: { roi: 0.16, cashRequired: 42000 },
  });

  const names = result.strategies.map((entry) => entry.strategy);
  assert.ok(names.includes('Flip'));
  assert.ok(names.includes('BRRRR'));
  assert.ok(names.includes('Long-term Rental'));
  assert.ok(names.includes('Wholesale'));
  assert.ok(names.includes('Hold for Appreciation'));
  assert.ok(result.strategies.every((entry) => entry.advisoryOnly === true));
});

test('portfolio predictive intelligence evaluates required exposure dimensions', () => {
  const result = buildPortfolioPredictiveIntelligence({
    properties: [
      { city: 'Covington', strategy: 'Flip', currentValue: 300000, currentLoanBalance: 180000 },
      { city: 'Covington', strategy: 'BRRRR', currentValue: 260000, currentLoanBalance: 150000 },
      { city: 'Lexington', strategy: 'Rental', currentValue: 220000, currentLoanBalance: 120000 },
    ],
    portfolioContext: { totalCurrentValue: 780000, totalOutstandingDebt: 450000, reserveShortfallValue: 0 },
  });

  assert.ok(result.diversification !== undefined);
  assert.ok(result.capitalAllocation !== undefined);
  assert.ok(result.liquidityImpact !== undefined);
  assert.ok(result.geographicExposure !== undefined);
  assert.ok(result.portfolioConcentration !== undefined);
  assert.ok(result.debtExposure !== undefined);
  assert.ok(result.cashReserveImpact !== undefined);
});

test('sensitivity analysis computes required scenario matrices', () => {
  const result = buildSensitivityAnalysis({
    deal: { estimatedArv: 300000, rehabBudget: 60000, holdingMonths: 6, estimatedRent: 2200 },
    analysis: { interestRate: 0.09 },
  });

  assert.ok(result.arvSensitivity.plus5 !== undefined);
  assert.ok(result.arvSensitivity.minus5 !== undefined);
  assert.ok(result.arvSensitivity.plus10 !== undefined);
  assert.ok(result.arvSensitivity.minus10 !== undefined);
  assert.ok(result.rehabSensitivity.plus10 !== undefined);
  assert.ok(result.rehabSensitivity.plus20 !== undefined);
  assert.ok(result.interestRateSensitivity.plus100bps !== undefined);
  assert.ok(result.holdingPeriodSensitivity.plus30Days !== undefined);
  assert.ok(result.rentSensitivity.minus10 !== undefined);
});

test('opportunity ranking returns top opportunity score priority rank and attention', () => {
  const result = buildOpportunityRanking({
    deal: { propertyAddress: '952 Goss Rd' },
    analysis: { roi: 0.17, overallRisk: 32 },
    marketEngine: { marketConfidence: 74 },
    exitEngine: { strategies: [{ strategy: 'Flip', confidence: 78 }] },
  });

  assert.ok(result.topOpportunityScore !== undefined);
  assert.ok(result.priorityRank !== undefined);
  assert.ok(result.capitalPriority !== undefined);
  assert.ok(result.riskAdjustedReturn !== undefined);
  assert.ok(result.requiredAttention !== undefined);
  assert.equal(result.advisoryOnly, true);
});

test('executive summary generator includes strengths weaknesses unknowns risks and evidence', () => {
  const result = buildExecutivePredictiveSummary({
    marketEngine: { marketConfidence: 76, inventoryTrend: 'STABLE', priceMomentum: 'UP' },
    rehabEngine: { costConfidence: 68, permitRisk: 52, scheduleRisk: 61, rehabDuration: 90 },
    exitEngine: { bestByConfidence: 'Flip' },
    portfolioEngine: { diversification: 70, liquidityImpact: 'STABLE' },
    rankingEngine: { topOpportunityScore: 73, requiredAttention: 'STANDARD' },
  });

  assert.ok(Array.isArray(result.strengths));
  assert.ok(Array.isArray(result.weaknesses));
  assert.ok(Array.isArray(result.unknowns));
  assert.ok(Array.isArray(result.primaryRisks));
  assert.ok(Array.isArray(result.recommendedNextSteps));
  assert.ok(Array.isArray(result.evidenceUsed));
  assert.ok(result.confidence !== undefined);
});

test('enterprise predictive intelligence engine composes all predictive modules in advisory mode', () => {
  const result = buildEnterprisePredictiveIntelligenceEngine({
    deal: {
      propertyAddress: '952 Goss Rd',
      purchasePrice: 180000,
      estimatedArv: 305000,
      rehabBudget: 52000,
      estimatedRent: 2300,
      daysOnMarket: 38,
      holdingMonths: 6,
      appreciationRate: 0.03,
    },
    analysis: {
      roi: 0.16,
      overallRisk: 34,
      cashRequired: 45000,
      interestRate: 0.09,
      capRate: 0.071,
      monthlyCashFlow: 650,
    },
    marketContext: { inventoryMonths: 3.8, saleVelocity: 66 },
    properties: [{ city: 'Covington', strategy: 'Flip', currentValue: 300000 }],
    portfolioContext: { totalCurrentValue: 300000, totalOutstandingDebt: 180000, reserveShortfallValue: 50000 },
    rehabProjects: [{ estimatedDurationDays: 95, permitStatus: 'Pending' }],
    contractors: [{ status: 'Watch' }],
    comps: [{ id: 'comp-1' }],
  });

  assert.equal(result.advisoryOnly, true);
  assert.equal(result.approvalState, 'PENDING_USER_APPROVAL');
  assert.ok(result.marketEngine);
  assert.ok(result.rehabEngine);
  assert.ok(result.exitEngine);
  assert.ok(result.portfolioEngine);
  assert.ok(result.sensitivityEngine);
  assert.ok(result.rankingEngine);
  assert.ok(result.executiveSummary);
});
