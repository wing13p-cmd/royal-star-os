import test from 'node:test';
import assert from 'node:assert/strict';
import { createOperationsService, buildOperationsViewModel, buildOperationsStatusSummary, normalizeOperationsError } from './operationsIntegration.js';

test('buildOperationsViewModel converts workflow, recovery, and monitoring payloads into safe UI state', () => {
  const result = buildOperationsViewModel({
    workflow: {
      workflowId: 'wf-1',
      name: 'Deal Review',
      currentStage: 'Analyze',
      status: 'Running',
      sourceModule: 'Deal Intelligence',
      startedAt: '2026-07-30T00:00:00.000Z',
      completedStages: ['Trigger', 'Validate'],
      pendingStages: ['Analyze', 'Recommend'],
      failedStage: null,
      retryCount: 1,
      manualOverrideStatus: 'Applied',
      finalResult: 'In progress',
    },
    recoveries: [{
      recoveryId: 'r-1',
      failureSource: 'Workflow',
      recoveryStrategy: 'Replay',
      recoveryStatus: 'Recovered',
      recoveryDuration: 42,
      retryCount: 1,
      restoredCheckpoint: 'checkpoint-1',
      result: 'Recovered',
      timestamp: '2026-07-30T00:00:10.000Z',
    }],
    auditEvents: [{ id: 'a-1', action: 'Approve', module: 'Workflow Engine', result: 'Approved' }],
    monitoring: {
      healthScore: 88,
      backendStatus: 'Healthy',
      apiStatus: 'Healthy',
      eventBusStatus: 'Healthy',
      schedulerStatus: 'Healthy',
      workflowEngineStatus: 'Healthy',
      recoveryEngineStatus: 'Healthy',
      telemetryStatus: 'Healthy',
      queueDepth: 2,
      successRate: 97,
      failureRate: 3,
      averageRuntime: 18,
      processingLatency: 6,
      recoveryFrequency: 1,
      lastSuccessfulExecution: '2026-07-30T00:00:00.000Z',
      lastFailedExecution: null,
      lastVerificationTime: '2026-07-30T00:00:05.000Z',
    },
    alerts: [{ severity: 'high', title: 'Workflow stalled', summary: 'A workflow needs attention', source: 'Workflow Engine', timestamp: '2026-07-30T00:00:00.000Z', recommendedAction: 'Review workflow', acknowledgmentStatus: 'Pending' }],
  });

  assert.equal(result.workflow.workflowId, 'wf-1');
  assert.equal(result.workflow.status, 'Running');
  assert.equal(result.recoveries.length, 1);
  assert.equal(result.auditEvents.length, 1);
  assert.equal(result.monitoring.backendStatus, 'Healthy');
  assert.equal(result.alerts[0].title, 'Workflow stalled');
});

test('buildOperationsStatusSummary derives a compact status summary for dashboard surfaces', () => {
  const result = buildOperationsStatusSummary(buildOperationsViewModel({
    workflow: { workflowId: 'wf-2', status: 'Running', currentStage: 'Analyze' },
    recoveries: [{ recoveryStatus: 'Recovered' }],
    monitoring: { healthScore: 84, backendStatus: 'Healthy' },
    alerts: [{ severity: 'high', title: 'Workflow stalled', summary: 'Needs review', source: 'Workflow Engine' }],
  }));

  assert.equal(result.healthLabel, 'Healthy');
  assert.equal(result.workflowLabel, 'Running · Analyze');
  assert.equal(result.recoveryCount, 1);
  assert.equal(result.alertCount, 1);
});

test('buildOperationsStatusSummary uses live backend health as the fallback when operations details are missing', () => {
  const result = buildOperationsStatusSummary({
    workflow: {},
    recoveries: [],
    monitoring: {},
    alerts: [],
  }, { healthy: true, status: 'ok' });

  assert.equal(result.healthLabel, 'Healthy');
  assert.equal(result.monitoringStatus, 'Healthy');
  assert.equal(result.workflowLabel, 'Healthy · Active');
});

test('createOperationsService deduplicates concurrent requests and normalizes failures', async () => {
  const service = createOperationsService();
  let calls = 0;

  const first = service.load('alpha', async () => {
    calls += 1;
    return { ok: true, value: 1 };
  });
  const second = service.load('alpha', async () => {
    calls += 1;
    return { ok: true, value: 2 };
  });

  const [left, right] = await Promise.all([first, second]);
  assert.equal(left.value, 1);
  assert.equal(right.value, 1);
  assert.equal(calls, 1);

  const errorResult = await service.load('beta', async () => {
    throw new Error('boom');
  });
  assert.equal(errorResult.error, 'boom');
  assert.equal(normalizeOperationsError(new Error('boom')), 'boom');
});
