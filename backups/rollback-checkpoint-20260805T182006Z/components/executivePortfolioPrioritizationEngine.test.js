import test from 'node:test';
import assert from 'node:assert/strict';
import { buildExecutivePortfolioPrioritizationEngine } from './executivePortfolioPrioritizationEngine.js';

test('buildExecutivePortfolioPrioritizationEngine returns safe defaults for empty input', () => {
  const result = buildExecutivePortfolioPrioritizationEngine({ deals: [], portfolioIntelligence: {} });
  assert.deepEqual(result.rankings, []);
  assert.equal(result.summary.totalRankedDeals, 0);
  assert.equal(result.summary.priorityMix.Critical, 0);
});

test('buildExecutivePortfolioPrioritizationEngine ranks active deals and preserves manual override intent', () => {
  const result = buildExecutivePortfolioPrioritizationEngine({
    deals: [
      {
        id: 'deal-1',
        propertyAddress: '123 Main St',
        status: 'active',
        purchasePrice: 180000,
        rehabBudget: 40000,
        estimatedArv: 320000,
        estimatedRent: 3200,
        cashOnHand: 100000,
        strategy: 'Flip',
        manualOfferAmount: 175000,
      },
      {
        id: 'deal-2',
        propertyAddress: '999 Oak Ave',
        status: 'active',
        purchasePrice: 140000,
        rehabBudget: 30000,
        estimatedArv: 260000,
        estimatedRent: 2800,
        cashOnHand: 80000,
        strategy: 'BRRRR',
      },
    ],
    analysisByDeal: {
      'deal-1': { dealScore: 85, overallRisk: 18, estimatedFlipProfit: 90000, roi: 0.2, monthlyCashFlow: 1200, dscr: 1.4, cashRequired: 16000, buyBoxResult: 'PASS', supportedBaseArv: 320000 },
      'deal-2': { dealScore: 62, overallRisk: 34, estimatedFlipProfit: 12000, roi: 0.07, monthlyCashFlow: 900, dscr: 1.1, cashRequired: 30000, buyBoxResult: 'CONDITIONAL PASS', supportedBaseArv: 260000 },
    },
    portfolioIntelligence: { summary: { healthScore: 84, reserveShortfallValue: 0, totalProperties: 4, totalCurrentValue: 1200000, totalOutstandingDebt: 700000, totalMonthlyCashFlow: 3000 } },
    marketSignals: {
      'deal-1': { opportunityScore: 88, forecastConfidence: 82, marketTrend: 6.2 },
      'deal-2': { opportunityScore: 58, forecastConfidence: 64, marketTrend: 3.1 },
    },
  });

  assert.equal(result.rankings.length, 2);
  assert.equal(result.rankings[0].propertyAddress, '123 Main St');
  assert.equal(result.rankings[0].priorityLevel, 'Critical');
  assert.equal(result.rankings[0].recommendedExecutiveAction, 'Acquire Immediately');
  assert.equal(result.rankings[1].priorityLevel, 'Medium');
  assert.equal(result.rankings[1].recommendedExecutiveAction, 'Increase Offer');
  assert.equal(result.manualOverrideSummary.appliedCount, 1);
  assert.ok(result.rankings[0].manualOverrideProtected);
});
