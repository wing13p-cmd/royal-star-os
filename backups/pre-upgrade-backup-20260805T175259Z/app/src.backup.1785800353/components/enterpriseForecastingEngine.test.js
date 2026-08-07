import test from 'node:test';
import assert from 'node:assert/strict';
import { buildEnterpriseForecastingEngine } from './enterpriseForecastingEngine.js';

test('buildEnterpriseForecastingEngine produces portfolio, cash flow, refinance, and executive forecast outputs', () => {
  const engine = buildEnterpriseForecastingEngine({
    deals: [{
      id: 'deal-1',
      propertyAddress: '123 Main St',
      purchasePrice: 180000,
      rehabBudget: 35000,
      estimatedArv: 280000,
      strategy: 'Flip',
      status: 'active',
    }],
    properties: [{
      id: 'prop-1',
      propertyName: '123 Main St',
      currentValue: 260000,
      currentLoanBalance: 160000,
      monthlyCashFlow: 1800,
      monthlyRent: 3200,
      monthlyDebtService: 900,
      loanMaturityDate: '2026-09-01',
      refinanceCandidate: true,
      strategy: 'BRRRR',
    }],
    portfolioIntelligence: {
      summary: {
        totalCurrentValue: 260000,
        totalMonthlyCashFlow: 1800,
        availableLiquidity: 280000,
        recommendedReserve: 250000,
        reserveShortfallValue: 0,
        totalSupportedArv: 300000,
        totalOutstandingDebt: 160000,
        healthScore: 82,
      },
      refinanceOpportunities: [{ property: '123 Main St' }],
      portfolioForecasts: [{ period: '30 Days', liquidityPosition: 270000, confidenceScore: 82 }],
      portfolioForecastSummary: { confidenceScore: 80 },
      capitalAllocation: [{ option: 'Fund Active Rehab' }],
      concentrationRisk: { riskLevel: 'Moderate' },
    },
    rehabProjects: [{
      id: 'rehab-1',
      propertyName: '123 Main St',
      originalRehabBudget: 40000,
      actualCost: 45000,
      remainingBudget: 15000,
    }],
    dealIntelligence: [{
      id: 'deal-1',
      dealScore: 84,
      recommendation: 'Strong Buy',
    }],
  });

  assert.ok(Array.isArray(engine.portfolioValueForecast));
  assert.ok(engine.portfolioValueForecast.length >= 4);
  assert.ok(engine.cashFlowProjection.projectedAnnualCashFlow > 0);
  assert.ok(engine.refinanceTimingPredictor.timingLabel.length > 0);
  assert.ok(Number.isFinite(engine.arvConfidenceScore.score));
  assert.ok(engine.rehabBudgetVarianceForecast.projectedVarianceAmount >= 0);
  assert.ok(Number.isFinite(engine.dealProbabilityOfSuccess.probability));
  assert.ok(engine.exitStrategyRecommendation.recommendation.length > 0);
  assert.ok(Number.isFinite(engine.marketTrendScore.score));
  assert.ok(engine.capitalDeploymentForecast.recommendedDeployment >= 0);
  assert.ok(engine.executiveForecastSummary.headline.length > 0);
});

test('buildEnterpriseForecastingEngine uses safe fallback values when data is incomplete', () => {
  const engine = buildEnterpriseForecastingEngine({});
  assert.equal(engine.portfolioValueForecast.length, 4);
  assert.equal(engine.cashFlowProjection.status, 'Insufficient Data');
  assert.equal(engine.refinanceTimingPredictor.timingLabel, 'Insufficient Data');
  assert.equal(engine.exitStrategyRecommendation.recommendation, 'Hold');
  assert.equal(engine.executiveForecastSummary.headline.includes('forecast'), true);
});