import test from 'node:test';
import assert from 'node:assert/strict';
import { buildEnterpriseMonitoringEngine } from './enterpriseMonitoringEngine.js';

test('buildEnterpriseMonitoringEngine tracks module health and produces monitoring payloads', () => {
  const engine = buildEnterpriseMonitoringEngine();

  engine.recordModuleExecution('Executive Intelligence', {
    status: 'Healthy',
    runtime: 12,
    errorCount: 0,
    success: true,
    queueDepth: 1,
    memoryUsage: 85,
    processingLatency: 7,
  });

  engine.recordModuleExecution('Forecast Engine', {
    status: 'Warning',
    runtime: 36,
    errorCount: 2,
    success: false,
    queueDepth: 4,
    memoryUsage: 140,
    processingLatency: 22,
  });

  const payload = engine.getMonitoringPayload();
  assert.equal(payload.modules['Executive Intelligence'].status, 'Healthy');
  assert.equal(payload.modules['Forecast Engine'].status, 'Warning');
  assert.equal(payload.healthScore >= 0, true);
  assert.equal(payload.healthScore <= 100, true);
  assert.equal(payload.events.length >= 2, true);
});

test('buildEnterpriseMonitoringEngine detects stalled workflows and recovers them automatically', async () => {
  const engine = buildEnterpriseMonitoringEngine();
  let recovered = false;

  const workflow = {
    workflowId: 'workflow-42',
    status: 'Running',
    lastUpdatedAt: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
    stages: [{ id: 'Validate', status: 'Running' }],
  };

  engine.registerWorkflow(workflow, async () => {
    recovered = true;
    return { status: 'Recovered' };
  });

  const result = await engine.detectAndRecoverStalledWorkflows({ stallThresholdMs: 1000 * 60 * 2 });

  assert.equal(result.recovered.length, 1);
  assert.equal(recovered, true);
});

test('buildEnterpriseMonitoringEngine preserves manual override context while monitoring', () => {
  const engine = buildEnterpriseMonitoringEngine();
  const context = {
    manualOverrideStrategy: 'Aggressive Growth',
    moduleSnapshot: {},
  };

  engine.recordModuleExecution('Workflow Engine', {
    status: 'Critical',
    runtime: 80,
    errorCount: 4,
    success: false,
    queueDepth: 8,
    memoryUsage: 220,
    processingLatency: 55,
  });

  const payload = engine.getMonitoringPayload({ context });
  assert.equal(payload.context.manualOverrideStrategy, 'Aggressive Growth');
  assert.equal(payload.modules['Workflow Engine'].status, 'Critical');
});
