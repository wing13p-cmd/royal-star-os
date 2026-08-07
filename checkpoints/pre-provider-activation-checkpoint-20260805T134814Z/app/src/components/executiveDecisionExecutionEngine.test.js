import test from 'node:test';
import assert from 'node:assert/strict';
import { buildExecutiveDecisionExecutionEngine } from './executiveDecisionExecutionEngine.js';

test('buildExecutiveDecisionExecutionEngine returns safe defaults for empty input', () => {
  const result = buildExecutiveDecisionExecutionEngine({});

  assert.equal(result.executiveActionPriorityScore, 0);
  assert.deepEqual(result.recommendedExecutionOrder, []);
  assert.equal(result.estimatedCapitalRequired, 0);
  assert.equal(result.estimatedPortfolioImpact.liabilityExposure, 0);
});

test('buildExecutiveDecisionExecutionEngine builds a ranked action queue from portfolio and deal signals', () => {
  const result = buildExecutiveDecisionExecutionEngine({
    deal: {
      id: 'deal-1',
      propertyAddress: '100 Main St',
      cashOnHand: 180000,
      manualOverrideAction: 'Acquire',
    },
    analysis: {
      roi: 0.16,
      overallRisk: 22,
      cashRequired: 90000,
      estimatedFlipProfit: 60000,
    },
    portfolioIntelligence: {
      summary: {
        reserveShortfallValue: 25000,
        availableLiquidity: 140000,
      },
      portfolioBalancingEngine: {
        portfolioBalanceScore: 72,
        diversificationScore: 78,
        liquidityReserveRatio: 16,
        financingExposure: 40,
        recommendedAction: 'Increase liquidity',
      },
    },
    executiveRecommendationEngine: {
      recommendations: [{
        category: 'Acquire Soon',
        priorityScore: 78,
        expectedRoi: 0.16,
        confidenceScore: 82,
        liquidityImpact: 70,
        capitalEfficiency: 82,
        diversificationImpact: 78,
      }],
      summary: {
        topCategory: 'Acquire Soon',
      },
    },
    capitalAllocationEngine: {
      executiveCapitalAllocation: {
        recommendations: [{ priority: 'Fund Active Rehab' }],
      },
    },
    marketAnalysis: {
      marketRiskEngine: {
        marketStabilityScore: 80,
      },
    },
    forecastAnalysis: {
      forecastConfidence: 84,
    },
  });

  assert.ok(result.executiveActionPriorityScore > 0);
  assert.ok(result.recommendedExecutionOrder.some((entry) => entry.actionType === 'Acquire'));
  assert.ok(result.recommendedExecutionOrder.some((entry) => entry.actionType === 'Increase Cash Reserve'));
  assert.ok(result.estimatedCapitalRequired > 0);
  assert.equal(result.recommendedExecutionOrder[0].priorityRank, 1);
  assert.equal(result.manualOverrideSummary.applied, true);
});
