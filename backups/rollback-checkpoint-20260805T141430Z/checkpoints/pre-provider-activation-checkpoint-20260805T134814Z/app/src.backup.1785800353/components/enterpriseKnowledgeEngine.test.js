import test from 'node:test';
import assert from 'node:assert/strict';
import { buildEnterpriseDataAndKnowledgeEngine } from './enterpriseKnowledgeEngine.js';
import { buildAiDecisionEngine } from './aiDecisionEngine.js';

test('buildEnterpriseDataAndKnowledgeEngine creates a centralized knowledge base and executive insights', () => {
  const result = buildEnterpriseDataAndKnowledgeEngine({
    deal: {
      id: 'deal-1',
      propertyAddress: '123 Main St',
      strategy: 'Flip',
      purchasePrice: 180000,
      rehabBudget: 40000,
      estimatedArv: 320000,
    },
    analysis: {
      estimatedFlipProfit: 90000,
      roi: 0.2,
      monthlyCashFlow: 1200,
      cashRequired: 20000,
      overallRisk: 18,
    },
    historicalDeals: [
      {
        id: 'hist-1',
        propertyAddress: '100 Oak St',
        strategy: 'Flip',
        purchasePrice: 160000,
        rehabBudget: 38000,
        actualRehabCost: 36000,
        estimatedArv: 300000,
        actualSalePrice: 310000,
        daysOnMarket: 18,
        cashReturned: 86000,
        roi: 0.22,
        profit: 92000,
      },
    ],
    rehabOutcomes: [{ propertyAddress: '100 Oak St', actualCostVariance: 2000, outcome: 'Strong' }],
    contractorPerformanceHistory: [{ contractorName: 'Acme Renovation', performanceScore: 88 }],
    materialSelections: [{ materialName: 'Quartz Countertops', recommendationScore: 82 }],
    arvAccuracyHistory: [{ source: 'Appraiser A', accuracyScore: 91 }],
    offerHistory: [{ offerAmount: 170000, outcome: 'Accepted' }],
    lenderPerformance: [{ lenderName: 'Northstar', score: 87 }],
    appraisalHistory: [{ source: 'Appraiser A', value: 310000 }],
    portfolioPerformance: [{ period: 'Q1', roi: 0.17 }],
    knowledgeRecords: [{ id: 'knowledge-1', title: 'Keep contingency on structural scope', topic: 'rehab' }],
  });

  assert.ok(result.knowledgeBase.historicalDeals.length > 0);
  assert.ok(result.learningEngine.completedProjects.length > 0);
  assert.ok(result.smartRecommendations.offerRecommendations.length > 0);
  assert.ok(result.searchEngine.results.length >= 0);
  assert.ok(result.executiveInsights.topPerformingContractors.length > 0);
  assert.ok(result.executiveInsights.highestRoiStrategies.length > 0);
});

test('buildAiDecisionEngine exposes the enterprise knowledge engine outputs', () => {
  const result = buildAiDecisionEngine({
    deal: { id: 'deal-2', propertyAddress: '67 Pine Ave', strategy: 'Flip', purchasePrice: 200000, rehabBudget: 42000, estimatedArv: 340000 },
    analysis: { estimatedFlipProfit: 95000, roi: 0.18, monthlyCashFlow: 1000, cashRequired: 22000, overallRisk: 22 },
    deals: [{ id: 'deal-2', propertyAddress: '67 Pine Ave', strategy: 'Flip' }],
    rehabProjects: [],
    contractors: [{ contractorName: 'Acme Renovation', performanceScore: 88 }],
    lenders: [{ lenderName: 'Northstar', score: 87 }],
    properties: [],
    portfolioIntelligence: { summary: { healthScore: 78, reserveShortfallValue: 0 } },
  });

  assert.ok(result.enterpriseKnowledgeEngine);
  assert.ok(result.enterpriseKnowledgeEngine.smartRecommendations.offerRecommendations.length > 0);
  assert.ok(result.enterpriseKnowledgeEngine.executiveInsights.topPerformingContractors.length > 0);
});
