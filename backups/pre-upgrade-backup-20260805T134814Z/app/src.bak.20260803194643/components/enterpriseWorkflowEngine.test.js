import test from 'node:test';
import assert from 'node:assert/strict';
import { buildEnterpriseWorkflowEngine } from './enterpriseWorkflowEngine.js';

test('buildEnterpriseWorkflowEngine executes branched workflows with audit logging', async () => {
  const engine = buildEnterpriseWorkflowEngine();
  const result = await engine.runWorkflow({
    deal: {
      id: 'deal-1',
      propertyAddress: '100 Main St',
      cashOnHand: 70000,
    },
    analysis: {
      overallRisk: 20,
      cashRequired: 35000,
      estimatedFlipProfit: 22000,
      roi: 0.16,
    },
    portfolioIntelligence: {
      summary: {
        healthScore: 85,
        reserveShortfallValue: 0,
        availableLiquidity: 250000,
      },
    },
    opportunityDetection: {
      opportunityScore: 82,
    },
    forecastConfidence: {
      confidenceLevel: 0.85,
    },
    manualOverrideStrategy: 'Aggressive Growth',
  });

  assert.equal(result.finalStatus, 'Completed');
  assert.ok(result.workflowId.startsWith('workflow-'));
  assert.ok(result.auditTrail.some((entry) => entry.stage === 'Trigger' && entry.status === 'Completed'));
  assert.ok(result.auditTrail.some((entry) => entry.stage === 'Recommend' && entry.status === 'Completed'));
  assert.ok(result.auditTrail.some((entry) => entry.stage === 'Verify' && entry.status === 'Completed'));
  assert.ok(result.auditTrail.every((entry) => entry.workflowId === result.workflowId));
  assert.ok(result.auditTrail.every((entry) => typeof entry.runtime === 'number'));
  assert.ok(result.auditTrail.every((entry) => typeof entry.retryCount === 'number'));
  assert.equal(result.context.branchingPath.includes('Recommend'), true);
});

test('buildEnterpriseWorkflowEngine supports parallel execution where dependencies allow', async () => {
  const engine = buildEnterpriseWorkflowEngine();
  const started = [];
  const definition = {
    stages: [
      { id: 'Trigger', name: 'Trigger', run: async () => ({ status: 'Completed' }) },
      { id: 'ParallelA', name: 'ParallelA', dependsOn: ['Trigger'], run: async () => { started.push('ParallelA'); return { status: 'Completed' }; } },
      { id: 'ParallelB', name: 'ParallelB', dependsOn: ['Trigger'], run: async () => { started.push('ParallelB'); return { status: 'Completed' }; } },
      { id: 'Complete', name: 'Complete', dependsOn: ['ParallelA', 'ParallelB'], run: async () => ({ status: 'Completed' }) },
    ],
  };

  const result = await engine.runWorkflow({ workflowDefinition: definition });

  assert.equal(result.finalStatus, 'Completed');
  assert.deepEqual(started.sort(), ['ParallelA', 'ParallelB']);
});

test('buildEnterpriseWorkflowEngine recovers failed stages without replaying completed work', async () => {
  const engine = buildEnterpriseWorkflowEngine();
  let attemptCount = 0;
  const completedStages = [];
  const definition = {
    stages: [
      { id: 'Trigger', name: 'Trigger', run: async () => { completedStages.push('Trigger'); return { status: 'Completed' }; } },
      { id: 'Validate', name: 'Validate', dependsOn: ['Trigger'], run: async () => { completedStages.push('Validate'); attemptCount += 1; if (attemptCount === 1) throw new Error('temporary failure'); return { status: 'Completed' }; } },
      { id: 'Complete', name: 'Complete', dependsOn: ['Validate'], run: async () => { completedStages.push('Complete'); return { status: 'Completed' }; } },
    ],
  };

  const result = await engine.runWorkflow({ workflowDefinition: definition });
  const validateEntry = result.auditTrail.find((entry) => entry.stage === 'Validate');

  assert.equal(result.finalStatus, 'Completed');
  assert.equal(completedStages.filter((stage) => stage === 'Trigger').length, 1);
  assert.equal(validateEntry.retryCount, 1);
  assert.equal(result.context.recoveryCount, 1);
});

test('buildEnterpriseWorkflowEngine exposes automation snapshots for dashboard integration', () => {
  const engine = buildEnterpriseWorkflowEngine();
  const snapshot = engine.buildAutomationSnapshot({
    deal: { id: 'deal-1', propertyAddress: '100 Main St', status: 'active' },
    analysis: { dealScore: 82, overallRisk: 18, cashRequired: 22000 },
    portfolioIntelligence: {
      summary: { healthScore: 83, availableLiquidity: 315000, reserveShortfallValue: 0 },
    },
    rehabProjects: [{ id: 'rehab-1', projectStatus: 'In Progress', currentPhase: 'Drywall', originalRehabBudget: 40000, actualCost: 33000 }],
    contractors: [{ id: 'cont-1', contractorName: 'Ace Builders' }],
    lenders: [{ id: 'lender-1', lenderName: 'Sunshine' }],
    dealIntelligence: [{ id: 'deal-1', requiredFollowUpItems: ['Confirm lender docs'] }],
    appraisalPackets: [{ id: 'packet-1', status: 'Ready' }],
    forecastAnalysis: { confidenceLevel: 0.88 },
  });

  assert.ok(snapshot.automaticDealStageProgression);
  assert.ok(snapshot.rehabMilestoneTracking);
  assert.ok(snapshot.contractorTaskQueue);
  assert.ok(snapshot.followUpReminderEngine);
  assert.ok(snapshot.capitalDeploymentAutomation);
  assert.ok(snapshot.lenderChecklistAutomation);
  assert.ok(snapshot.appraisalPacketReadinessMonitor);
  assert.ok(snapshot.closingChecklistAutomation);
  assert.ok(snapshot.executiveNotifications);
  assert.ok(snapshot.systemHealthAutomation);
  assert.ok(snapshot.summary.overallHealthScore >= 0);
});
