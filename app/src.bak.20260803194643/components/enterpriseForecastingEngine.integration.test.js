import test from 'node:test';
import assert from 'node:assert/strict';
import { buildEnterpriseAnalyticsEngine } from './enterpriseAnalyticsEngine.js';
import { buildExecutiveIntelligence } from './executiveIntelligence.js';
import { buildLiveEnterpriseDashboardModel } from '../utils/liveEnterpriseIntelligence.js';

test('predictive analytics surfaces through analytics, executive, and dashboard layers', () => {
  const analytics = buildEnterpriseAnalyticsEngine({
    deals: [{ id: 'deal-1', estimatedArv: 300000, purchasePrice: 180000, rehabBudget: 35000, strategy: 'Flip' }],
    properties: [{ id: 'prop-1', currentValue: 290000, currentLoanBalance: 160000, monthlyCashFlow: 2000, refinanceCandidate: true }],
    portfolioIntelligence: {
      summary: { totalCurrentValue: 290000, totalMonthlyCashFlow: 2000, availableLiquidity: 300000, recommendedReserve: 250000, reserveShortfallValue: 0, totalSupportedArv: 320000, healthScore: 82 },
    },
    rehabProjects: [{ id: 'rehab-1', originalRehabBudget: 40000, actualCost: 45000 }],
    dealIntelligence: [{ id: 'deal-1', dealScore: 84, recommendation: 'Strong Buy' }],
  });

  const executive = buildExecutiveIntelligence({
    deals: [{ id: 'deal-1', estimatedArv: 300000, purchasePrice: 180000, rehabBudget: 35000, strategy: 'Flip' }],
    properties: [{ id: 'prop-1', currentValue: 290000, currentLoanBalance: 160000, monthlyCashFlow: 2000, refinanceCandidate: true }],
    portfolioIntelligence: {
      summary: { totalCurrentValue: 290000, totalMonthlyCashFlow: 2000, availableLiquidity: 300000, recommendedReserve: 250000, reserveShortfallValue: 0, totalSupportedArv: 320000, healthScore: 82 },
    },
    rehabProjects: [{ id: 'rehab-1', originalRehabBudget: 40000, actualCost: 45000 }],
    dealIntelligence: [{ id: 'deal-1', dealScore: 84, recommendation: 'Strong Buy' }],
  });

  const dashboard = buildLiveEnterpriseDashboardModel({
    deals: [{ id: 'deal-1', estimatedArv: 300000, purchasePrice: 180000, rehabBudget: 35000, strategy: 'Flip' }],
    properties: [{ id: 'prop-1', currentValue: 290000, currentLoanBalance: 160000, monthlyCashFlow: 2000, refinanceCandidate: true }],
    portfolioEntries: [],
    rehabProjects: [{ id: 'rehab-1', originalRehabBudget: 40000, actualCost: 45000 }],
    contractors: [],
    lenders: [],
    dealIntelligence: [{ id: 'deal-1', dealScore: 84, recommendation: 'Strong Buy' }],
    backendHealth: { healthy: true },
    operationsPayload: { workflow: {}, recoveries: [], monitoring: {}, alerts: [] },
    version: '1.0.0',
  });

  assert.ok(analytics.forecastingEngine.portfolioValueForecast.length >= 4);
  assert.equal(executive.forecastingEngine.executiveForecastSummary.headline.includes('forecast'), true);
  assert.ok(dashboard.intelligenceCards.some((card) => card.label === '30D FORECAST'));
  assert.ok(dashboard.portfolioOverview.executiveSummary.headline.includes('forecast'));
});
