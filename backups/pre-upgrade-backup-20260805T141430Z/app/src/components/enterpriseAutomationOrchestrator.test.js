import test from 'node:test';
import assert from 'node:assert/strict';
import { buildEnterpriseAutomationOrchestrator } from './enterpriseAutomationOrchestrator.js';

test('buildEnterpriseAutomationOrchestrator returns a safe automation pipeline', () => {
  const result = buildEnterpriseAutomationOrchestrator({});

  assert.equal(result.pipeline.length, 7);
  assert.ok(result.pipeline.every((stage) => ['Pending', 'Running', 'Completed', 'Failed'].includes(stage.status)));
  assert.equal(result.executionSummary.completedStages, 0);
  assert.equal(result.executionSummary.failedStages, 0);
  assert.equal(result.enterprisePayload.recommendedStrategy, 'Balanced Growth');
});

test('buildEnterpriseAutomationOrchestrator wires the scheduler into the automation pipeline', async () => {
  const result = await buildEnterpriseAutomationOrchestrator({
    deal: {
      id: 'deal-2',
      propertyAddress: '200 Elm St',
      cashOnHand: 100000,
    },
    analysis: {
      overallRisk: 20,
      cashRequired: 40000,
      estimatedFlipProfit: 18000,
      roi: 0.16,
    },
  });

  assert.ok(result.scheduler);
  assert.ok(result.scheduler.getScheduledJobs().length >= 1);
  assert.ok(result.scheduler.getJobLog().length >= 1);
});

test('buildEnterpriseAutomationOrchestrator executes the expected order and preserves manual overrides', () => {
  const result = buildEnterpriseAutomationOrchestrator({
    deal: {
      id: 'deal-1',
      propertyAddress: '100 Main St',
      cashOnHand: 50000,
    },
    analysis: {
      overallRisk: 28,
      cashRequired: 70000,
      estimatedFlipProfit: 22000,
      roi: 0.14,
    },
    portfolioIntelligence: {
      summary: {
        reserveShortfallValue: 10000,
        availableLiquidity: 220000,
        healthScore: 82,
      },
      portfolioBalancingEngine: {
        portfolioBalanceScore: 76,
        diversificationScore: 80,
        liquidityReserveRatio: 15,
      },
    },
    executiveRecommendationEngine: {
      recommendations: [{ category: 'Fund Active Rehab', priorityScore: 88 }],
    },
    manualOverrideStrategy: 'Aggressive Growth',
  });

  assert.deepEqual(result.pipeline.map((stage) => stage.name), [
    'Data Refresh',
    'Opportunity Analysis',
    'Risk Analysis',
    'Forecast Generation',
    'Executive Recommendations',
    'Portfolio Synchronization',
    'Dashboard Synchronization',
  ]);
  assert.equal(result.enterprisePayload.recommendedStrategy, 'Aggressive Growth');
  assert.equal(result.executionSummary.completedStages, 7);
  assert.equal(result.manualOverrideSummary.applied, true);
});

test('buildEnterpriseAutomationOrchestrator integrates monitoring, recovery, and analytics into the shared orchestration layer', async () => {
  const result = await buildEnterpriseAutomationOrchestrator({
    deal: {
      id: 'deal-3',
      propertyAddress: '300 Pine St',
      cashOnHand: 75000,
    },
    analysis: {
      overallRisk: 18,
      cashRequired: 32000,
      estimatedFlipProfit: 24000,
      roi: 0.18,
    },
    portfolioIntelligence: {
      summary: {
        healthScore: 84,
      },
      portfolioBalancingEngine: {
        portfolioBalanceScore: 80,
        diversificationScore: 78,
        liquidityReserveRatio: 16,
      },
    },
    deals: [{ id: 'deal-3' }],
    properties: [{ id: 'prop-3' }],
    rehabProjects: [{ id: 'rehab-3' }],
    contractors: [{ id: 'contractor-3' }],
    lenders: [{ id: 'lender-3' }],
    comps: [{ id: 'comp-3' }],
    neighborhoods: [{ id: 'hood-3' }],
    manualOverrideStrategy: 'Balanced Growth',
  });

  assert.ok(result.monitoring);
  assert.ok(result.recovery);
  assert.ok(result.analytics);
  assert.ok(result.enterprisePayload.orchestrationSummary);
  assert.equal(result.enterprisePayload.orchestrationSummary.moduleCount, 11);
  assert.equal(result.enterprisePayload.orchestrationSummary.workflowStatus, 'Prepared');
});

test('buildEnterpriseAutomationOrchestrator exposes the enterprise completion-pack layers', () => {
  const result = buildEnterpriseAutomationOrchestrator({
    deal: {
      id: 'deal-4',
      propertyAddress: '400 Oak St',
      cashOnHand: 120000,
    },
    analysis: {
      overallRisk: 14,
      cashRequired: 24000,
      estimatedFlipProfit: 26000,
      roi: 0.2,
    },
    portfolioIntelligence: {
      summary: {
        healthScore: 86,
        reserveShortfallValue: 0,
      },
      portfolioBalancingEngine: {
        portfolioBalanceScore: 84,
        diversificationScore: 82,
        liquidityReserveRatio: 18,
      },
    },
    deals: [{ id: 'deal-4' }],
    properties: [{ id: 'prop-4' }],
    rehabProjects: [{ id: 'rehab-4' }],
    contractors: [{ id: 'contractor-4', contractorName: 'BuildCo' }],
    lenders: [{ id: 'lender-4', lenderName: 'Northstar' }],
    comps: [{ id: 'comp-4' }],
    neighborhoods: [{ id: 'hood-4' }],
    manualOverrideStrategy: 'Balanced Growth',
  });

  assert.ok(result.enterprisePayload.workflowSnapshot);
  assert.ok(result.enterprisePayload.operationalLayers);
  assert.equal(result.enterprisePayload.operationalLayers.executiveOrchestration.status, 'Ready');
  assert.equal(result.enterprisePayload.operationalLayers.portfolioOrchestration.status, 'Ready');
  assert.equal(result.enterprisePayload.operationalLayers.knowledgeSignals.status, 'Ready');
});
