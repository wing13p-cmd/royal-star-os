import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequestCache, buildDealIntelligenceViewModel, buildExecutiveViewModel, buildPortfolioViewModel, buildSystemHealthViewModel, buildAutomationViewModel, buildReleaseReadinessViewModel } from './enterpriseUiIntegration.js';

test('buildDealIntelligenceViewModel prefers live backend payload values for shared deal fields', () => {
  const result = buildDealIntelligenceViewModel({
    deal: { id: 'deal-1', propertyAddress: '123 Test St' },
    backendRecord: {
      dealScore: 88,
      recommendation: 'Proceed',
      riskLevel: 'Low',
      confidenceScore: 92,
      underwritingSummary: 'Strong underwriting support',
      arvOutput: 290000,
      offerGuidance: 'Offer at market',
      exitStrategyComparison: 'Flip vs BRRRR',
      capitalRequired: 180000,
      estimatedProfit: 65000,
      estimatedCashFlow: 2400,
      majorRiskFlags: ['Cap rate pressure'],
      requiredFollowUpItems: ['Verify comps'],
      manualOverrideStatus: 'Applied',
    },
    fallback: { dealScore: 50, recommendation: 'Hold' },
  });

  assert.equal(result.dealScore, 88);
  assert.equal(result.recommendation, 'Proceed');
  assert.equal(result.riskLevel, 'Low');
  assert.equal(result.confidenceScore, 92);
  assert.equal(result.underwritingSummary, 'Strong underwriting support');
  assert.equal(result.manualOverrideStatus, 'Applied');
});

test('buildExecutiveViewModel surfaces executive priorities from shared payload data', () => {
  const result = buildExecutiveViewModel({
    deals: [{ id: 'deal-1' }],
    portfolioIntelligence: { summary: { healthScore: 82 } },
    backendHealth: { healthy: true, status: 'ok' },
  });

  assert.ok(result.topRecommendation);
  assert.ok(result.priorityScore >= 0);
  assert.ok(result.recommendedStrategy);
  assert.ok(result.highestPriorityAction);
  assert.ok(result.confidenceLevel);
  assert.ok(Array.isArray(result.immediateActionItems));
});

test('buildPortfolioViewModel uses the shared portfolio intelligence payload and preserves fallback text', () => {
  const result = buildPortfolioViewModel({
    portfolioEntries: [{ id: 'p1', propertyName: 'Alpha', currentValue: 200000, loanBalance: 100000, monthlyRent: 2500, occupancyRate: 90 }],
    portfolioIntelligence: {
      summary: {
        healthScore: 88,
        diversificationScore: 79,
        liquidityScore: 91,
        capitalEfficiency: 84,
        equityPosition: 100000,
        cashFlowPerformance: 18000,
        concentrationRisk: 'Moderate',
        highestRiskAsset: 'Alpha',
        highestOpportunityAsset: 'Beta',
        recommendedPortfolioAction: 'Hold and preserve liquidity',
        forecastConfidence: 'High',
      },
    },
  });

  assert.equal(result.portfolioHealthScore, 88);
  assert.equal(result.recommendedPortfolioAction, 'Hold and preserve liquidity');
  assert.equal(result.forecastConfidence, 'High');
  assert.equal(result.highestRiskAsset, 'Alpha');
});

test('buildPortfolioViewModel surfaces executive portfolio summary fields for the dashboard', () => {
  const result = buildPortfolioViewModel({
    portfolioEntries: [{ id: 'p1', propertyName: 'Alpha' }],
    portfolioIntelligence: {
      summary: {
        healthScore: 88,
        concentrationRisk: 'Moderate',
        highestRiskAsset: 'Alpha',
        highestOpportunityAsset: 'Beta',
        recommendedPortfolioAction: 'Hold and preserve liquidity',
        forecastConfidence: 'High',
      },
    },
  });

  assert.equal(result.portfolioHealthSummary, 'Healthy');
  assert.equal(result.portfolioOpportunity, 'Beta');
  assert.equal(result.portfolioFocus, 'Hold and preserve liquidity');
});

test('buildSystemHealthViewModel reports live backend health and configuration readiness', () => {
  const result = buildSystemHealthViewModel({
    backendHealth: { healthy: true, status: 'ok', timestamp: '2026-07-30T00:00:00.000Z' },
    version: '1.0.0',
    configReady: true,
  });

  assert.equal(result.backendStatus, 'Healthy');
  assert.equal(result.apiHealth, 'Healthy');
  assert.equal(result.configurationReadiness, 'Ready');
  assert.ok(result.overallSystemHealthScore >= 0);
});

test('buildAutomationViewModel summarizes orchestration status for the dashboard', () => {
  const result = buildAutomationViewModel({
    orchestrator: {
      enterprisePayload: {
        orchestrationSummary: {
          workflowStatus: 'Prepared',
          monitoringStatus: 'Healthy',
          recoveryStatus: 'Ready',
          analyticsStatus: 'Ready',
        },
      },
      analytics: {
        getTelemetryPayload: () => ({ performanceSummary: { enterpriseHealthScore: 89 } }),
      },
    },
  });

  assert.equal(result.workflowStatus, 'Prepared');
  assert.equal(result.monitoringStatus, 'Healthy');
  assert.equal(result.analyticsHealthScore, 89);
  assert.equal(result.summaryLabel, 'Prepared · Healthy');
});

test('createRequestCache deduplicates concurrent requests for the same key', async () => {
  const cache = createRequestCache();
  let calls = 0;

  const first = cache.getOrCreate('alpha', async () => {
    calls += 1;
    return { ok: true, value: calls };
  });
  const second = cache.getOrCreate('alpha', async () => {
    calls += 1;
    return { ok: true, value: calls };
  });

  const [left, right] = await Promise.all([first, second]);
  assert.equal(left.value, 1);
  assert.equal(right.value, 1);
  assert.equal(calls, 1);
});
