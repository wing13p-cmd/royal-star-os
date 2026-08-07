import test from 'node:test';
import assert from 'node:assert/strict';
import { buildExecutiveStrategyOptimizationEngine } from './executiveStrategyOptimizationEngine.js';

test('buildExecutiveStrategyOptimizationEngine returns safe defaults for empty input', () => {
  const result = buildExecutiveStrategyOptimizationEngine({});

  assert.equal(result.recommendedStrategy, 'Balanced Growth');
  assert.equal(result.confidenceLevel, 'Insufficient Data');
  assert.equal(result.strategyScores.length, 7);
  assert.equal(result.summary.totalStrategies, 7);
});

test('buildExecutiveStrategyOptimizationEngine selects the highest-scoring strategy and preserves manual overrides', () => {
  const result = buildExecutiveStrategyOptimizationEngine({
    deal: {
      id: 'deal-1',
      propertyAddress: '100 Main St',
    },
    analysis: {
      roi: 0.16,
      overallRisk: 22,
      cashRequired: 90000,
    },
    portfolioIntelligence: {
      summary: {
        reserveShortfallValue: 20000,
        availableLiquidity: 180000,
      },
      portfolioBalancingEngine: {
        portfolioBalanceScore: 72,
        diversificationScore: 78,
        liquidityReserveRatio: 16,
      },
    },
    executiveRecommendationEngine: {
      recommendations: [{ priorityScore: 78, confidenceScore: 82 }],
    },
    executiveActionQueue: {
      recommendedExecutionOrder: [{ actionType: 'Acquire' }],
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
    manualOverrideStrategy: 'Aggressive Growth',
  });

  assert.equal(result.manualOverrideSummary.applied, true);
  assert.equal(result.recommendedStrategy, 'Aggressive Growth');
  assert.ok(result.strategyScores.some((entry) => entry.strategyName === 'Aggressive Growth'));
  assert.ok(result.selectedStrategy.score > 0);
  assert.ok(result.summary.topScore >= 0);
});
