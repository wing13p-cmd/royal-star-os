import test from 'node:test';
import assert from 'node:assert/strict';
import { buildExecutiveRecommendationEngine } from './executiveRecommendationEngine.js';

test('buildExecutiveRecommendationEngine returns safe defaults for empty input', () => {
  const result = buildExecutiveRecommendationEngine({});

  assert.equal(result.executivePriorityScore, 0);
  assert.deepEqual(result.recommendations, []);
  assert.equal(result.summary.totalRecommendations, 0);
});

test('buildExecutiveRecommendationEngine produces prioritized recommendations from portfolio and deal signals', () => {
  const result = buildExecutiveRecommendationEngine({
    deal: {
      id: 'deal-1',
      propertyAddress: '100 Main St',
      cashOnHand: 250000,
    },
    analysis: {
      roi: 0.16,
      overallRisk: 20,
      cashRequired: 60000,
      estimatedFlipProfit: 50000,
    },
    portfolioIntelligence: {
      summary: {
        reserveShortfallValue: 20000,
        availableLiquidity: 180000,
        healthScore: 78,
      },
      portfolioBalancingEngine: {
        portfolioBalanceScore: 72,
        liquidityReserveRatio: 14,
        diversificationScore: 78,
        financingExposure: 48,
        recommendedAction: 'Increase liquidity',
      },
    },
    capitalAllocationEngine: {
      executiveCapitalAllocation: {
        recommendations: [{ priority: 'Fund Active Rehab' }],
      },
    },
    opportunityAnalysis: {
      overallOpportunityScore: 84,
    },
    marketAnalysis: {
      marketRiskEngine: {
        marketStabilityScore: 80,
      },
    },
    forecastAnalysis: {
      forecastConfidence: 82,
    },
  });

  assert.ok(result.executivePriorityScore > 0);
  assert.ok(result.recommendations.some((entry) => entry.category === 'Acquire Immediately' || entry.category === 'Acquire Soon'));
  assert.ok(result.recommendations.some((entry) => entry.category === 'Increase Liquidity'));
  assert.equal(result.summary.totalRecommendations, result.recommendations.length);
  assert.equal(result.recommendations[0].priorityRank, 1);
});
