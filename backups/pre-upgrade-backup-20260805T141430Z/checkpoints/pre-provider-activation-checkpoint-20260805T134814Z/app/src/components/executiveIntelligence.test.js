import test from 'node:test';
import assert from 'node:assert/strict';
import { buildExecutiveIntelligence } from './executiveIntelligence.js';

test('buildExecutiveIntelligence returns safe defaults for empty input', () => {
  const result = buildExecutiveIntelligence({});

  assert.ok(Array.isArray(result.executiveAlerts));
  assert.ok(Array.isArray(result.todaysPriorities));
  assert.equal(result.capitalReserveMonitor.status, 'Capital Available');
  assert.equal(result.portfolioRiskMonitor.risk, 'Insufficient Data');
  assert.equal(result.businessHealth.status, 'Insufficient Data');
  assert.equal(result.cashFlowForecast.status, 'Insufficient Data');
  assert.equal(result.opportunityRanking.length, 0);
  assert.equal(result.systemHealth.status, 'Insufficient Data');
});

test('buildExecutiveIntelligence centralizes the core executive metrics', () => {
  const result = buildExecutiveIntelligence({
    deal: {
      id: 'deal-1',
      propertyAddress: '100 Main St',
      purchasePrice: 180000,
      rehabBudget: 40000,
      cashOnHand: 50000,
      status: 'active',
    },
    analysis: {
      overallRisk: 62,
      cashRequired: 80000,
      estimatedFlipProfit: -6000,
      supportedBaseArv: 220000,
    },
    portfolioIntelligence: {
      summary: {
        healthScore: 74,
        totalMonthlyCashFlow: -1200,
        reserveShortfallValue: 50000,
        recommendedReserve: 600000,
        availableLiquidity: 250000,
        totalEquity: 120000,
      },
      alerts: [{ severity: 'CRITICAL', alert: 'Negative equity', property: 'Portfolio' }],
    },
    deals: [{ id: 'deal-1', propertyAddress: '100 Main St', purchasePrice: 180000, rehabBudget: 40000, status: 'active' }],
    dealIntelligence: [{ id: 'di-1', dealScore: 88, recommendation: 'Proceed', profit: 25000, roi: 12, estimatedCashRequired: 25000, mainAdvantage: 'Strong support', mainRisk: 'Liquidity' }],
    properties: [{ id: 'prop-1', propertyName: '100 Main St', currentValue: 350000, currentLoanBalance: 300000, monthlyCashFlow: -1200, loanMaturityDate: '2026-08-01' }],
    rehabProjects: [{ id: 'rehab-1', projectStatus: 'Delayed', originalRehabBudget: 60000, actualCost: 75000, riskLevel: 'Critical' }],
    contractors: [],
    lenders: [],
  });

  assert.ok(result.executiveAlerts.length > 0);
  assert.ok(result.todaysPriorities.some((priority) => priority.priority === 'Capital'));
  assert.equal(result.capitalReserveMonitor.status, 'Capital Shortfall');
  assert.equal(result.portfolioRiskMonitor.severity, 'CRITICAL');
  assert.equal(result.businessHealth.status, 'Watch');
  assert.equal(result.cashFlowForecast.status, 'At Risk');
  assert.equal(result.opportunityRanking[0].propertyName, '100 Main St');
  assert.equal(result.systemHealth.status, 'Needs Attention');
});
test('buildExecutiveIntelligence surfaces portfolio forecasts and scenario detail', () => {
  const result = buildExecutiveIntelligence({
    portfolioIntelligence: {
      portfolioForecasts: [{ period: '30 Days', portfolioValue: 100000, equityGrowth: 1500, cashFlow: 1000, rentalIncome: 3000, arvAppreciation: 1200, roiTrend: 2.1, portfolioRiskTrend: 48, liquidityPosition: 220000, confidenceScore: 78, confidenceLabel: 'High' }],
      portfolioForecastScenarios: [{ scenario: 'Expected', periods: [{ period: '30 Days', portfolioValue: 100000 }] }],
      portfolioForecastSummary: { confidenceScore: 78, confidenceLabel: 'High', primaryScenario: 'Expected', riskTrend: 'Stable', liquidityPosition: 220000 },
      integrityAudit: { status: 'PASS', moduleSynchronization: { status: 'PASS' } },
      portfolioBalancingEngine: { recommendedAction: 'Increase liquidity', portfolioBalanceScore: 64 },
    },
  });

  assert.equal(result.portfolioForecasts.length, 1);
  assert.equal(result.portfolioForecastScenarios.length, 1);
  assert.equal(result.portfolioForecastSummary.primaryScenario, 'Expected');
  assert.equal(result.portfolioForecastSummary.confidenceLabel, 'High');
  assert.equal(result.integrityAudit.status, 'PASS');
  assert.equal(result.integrityAudit.moduleSynchronization.status, 'PASS');
  assert.equal(result.portfolioRiskMonitor.recommendedAction, 'Increase liquidity');
  assert.equal(result.portfolioRiskMonitor.portfolioBalanceScore, 64);
  assert.ok(result.executiveAlerts.some((alert) => alert.message.includes('Increase liquidity')));
});

test('buildExecutiveIntelligence returns a unified executive payload', () => {
  const result = buildExecutiveIntelligence({
    deal: {
      id: 'deal-1',
      propertyAddress: '100 Main St',
      cashOnHand: 50000,
    },
    analysis: {
      overallRisk: 35,
      cashRequired: 75000,
      estimatedFlipProfit: 18000,
      roi: 0.13,
    },
    portfolioIntelligence: {
      summary: {
        reserveShortfallValue: 15000,
        availableLiquidity: 180000,
        healthScore: 78,
      },
      portfolioBalancingEngine: {
        portfolioBalanceScore: 74,
        diversificationScore: 81,
        liquidityReserveRatio: 14,
      },
    },
    deals: [{ id: 'deal-1' }],
    dealIntelligence: [{ dealId: 'deal-1', dealScore: 82, recommendation: 'Proceed' }],
    properties: [{ id: 'prop-1', propertyName: '100 Main St' }],
    rehabProjects: [],
    contractors: [],
    lenders: [],
  });

  assert.equal(result.executivePayload.recommendedStrategy, result.executiveStrategyOptimizationEngine.recommendedStrategy);
  assert.deepEqual(result.executivePayload.prioritizedActionQueue, result.executiveDecisionExecutionEngine.recommendedExecutionOrder);
  assert.equal(result.executivePayload.portfolioBalanceScore, 74);
  assert.equal(result.executivePayload.portfolioDiversificationScore, 81);
  assert.equal(result.executivePayload.liquidityScore, 14);
  assert.ok(result.executivePayload.executiveAlerts.length >= 0);
  assert.ok(Array.isArray(result.executivePayload.topOpportunities));
  assert.ok(Array.isArray(result.executivePayload.immediateActionItems));
});

test('buildExecutiveIntelligence produces a normalized command-center scorecard and next-best-actions', () => {
  const result = buildExecutiveIntelligence({
    deal: { propertyAddress: '100 Main St', cashOnHand: 40000 },
    analysis: { overallRisk: 72, cashRequired: 85000, estimatedFlipProfit: -12000, supportedBaseArv: 210000 },
    portfolioIntelligence: {
      summary: {
        healthScore: 48,
        reserveShortfallValue: 22000,
        availableLiquidity: 180000,
        recommendedReserve: 600000,
        totalMonthlyCashFlow: -1800,
        criticalAlertCount: 2,
      },
      portfolioBalancingEngine: { portfolioBalanceScore: 54, diversificationScore: 61, liquidityReserveRatio: 18 },
    },
    deals: [{ id: 'deal-1', propertyAddress: '100 Main St', status: 'active' }],
    dealIntelligence: [{ dealId: 'deal-1', dealScore: 61, recommendation: 'Re-underwrite' }],
    properties: [{ id: 'prop-1', propertyName: '100 Main St', currentValue: 310000, currentLoanBalance: 330000, monthlyCashFlow: -1800 }],
    rehabProjects: [{ id: 'rehab-1', projectStatus: 'Delayed', originalRehabBudget: 50000, percentComplete: 42, riskLevel: 'Critical' }],
    contractors: [{ id: 'contractor-1', contractorName: 'North Build', insuranceStatus: 'Active' }],
    lenders: [{ id: 'lender-1', lenderName: 'Peak Capital', activeStatus: 'Active' }],
  });

  assert.ok(result.executiveCommandCenter);
  assert.ok(result.executiveCommandCenter.enterpriseHealthScore >= 0 && result.executiveCommandCenter.enterpriseHealthScore <= 100);
  assert.ok(result.executiveCommandCenter.portfolioHealthScore >= 0 && result.executiveCommandCenter.portfolioHealthScore <= 100);
  assert.ok(result.executiveCommandCenter.capitalEfficiencyScore >= 0 && result.executiveCommandCenter.capitalEfficiencyScore <= 100);
  assert.ok(result.executiveCommandCenter.cashReserveScore >= 0 && result.executiveCommandCenter.cashReserveScore <= 100);
  assert.ok(result.executiveCommandCenter.dealPipelineHealth >= 0 && result.executiveCommandCenter.dealPipelineHealth <= 100);
  assert.ok(result.executiveCommandCenter.rehabPerformanceScore >= 0 && result.executiveCommandCenter.rehabPerformanceScore <= 100);
  assert.ok(result.executiveCommandCenter.contractorPerformanceScore >= 0 && result.executiveCommandCenter.contractorPerformanceScore <= 100);
  assert.ok(result.executiveCommandCenter.operationsReadiness >= 0 && result.executiveCommandCenter.operationsReadiness <= 100);
  assert.ok(result.executiveCommandCenter.financingReadiness >= 0 && result.executiveCommandCenter.financingReadiness <= 100);
  assert.ok(result.executiveCommandCenter.growthReadiness >= 0 && result.executiveCommandCenter.growthReadiness <= 100);
  assert.ok(result.executiveCommandCenter.riskExposureScore >= 0 && result.executiveCommandCenter.riskExposureScore <= 100);
  assert.ok(result.nextBestActions.length > 0);
  assert.ok(result.executiveAlerts.some((alert) => alert.alert.includes('Preserve liquidity') || alert.alert.includes('Re-underwrite')));
});
