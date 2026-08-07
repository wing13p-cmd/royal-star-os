import test from 'node:test';
import assert from 'node:assert/strict';
import { buildEnterpriseRecoveryEngine } from './enterpriseRecoveryEngine.js';

test('buildEnterpriseRecoveryEngine detects and recovers workflow failures', async () => {
  const engine = buildEnterpriseRecoveryEngine();
  let workflowRecovered = false;

  const workflow = {
    workflowId: 'workflow-100',
    status: 'Failed',
    stages: [{ id: 'Validate', status: 'Failed' }],
  };

  const recovery = await engine.recoverWorkflow({ workflow, recoveryHandler: async () => { workflowRecovered = true; return { status: 'Recovered' }; } });

  assert.equal(recovery.success, true);
  assert.equal(workflowRecovered, true);
  assert.equal(recovery.metrics.recoveryStrategy, 'Restart failed workflow stages');
});

test('buildEnterpriseRecoveryEngine reschedules failed jobs and replays missed events', async () => {
  const engine = buildEnterpriseRecoveryEngine();
  const jobResults = [];
  const eventResults = [];

  await engine.recoverScheduledJobs({ job: { id: 'job-1', source: 'Scheduler' }, recoveryHandler: async () => { jobResults.push('recovered'); return { status: 'Recovered' }; } });
  await engine.replayMissedEvents({ eventName: 'Dashboard Refresh Requested', payload: { source: 'Event Bus' }, recoveryHandler: async () => { eventResults.push('replayed'); return { status: 'Replayed' }; } });

  assert.deepEqual(jobResults, ['recovered']);
  assert.deepEqual(eventResults, ['replayed']);
});

test('buildEnterpriseRecoveryEngine restores from rollback checkpoints and preserves manual overrides', async () => {
  const engine = buildEnterpriseRecoveryEngine();
  const result = await engine.restoreFromCheckpoint({
    checkpoint: { id: 'checkpoint-1', state: { manualOverrideStrategy: 'Aggressive Growth' } },
  });

  assert.equal(result.success, true);
  assert.equal(result.state.manualOverrideStrategy, 'Aggressive Growth');
  assert.equal(result.metrics.recoveryStrategy, 'Restore from rollback checkpoint');
});
