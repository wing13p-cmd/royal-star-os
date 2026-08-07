import test from 'node:test';
import assert from 'node:assert/strict';
import { buildEnterpriseAnalyticsEngine } from './enterpriseAnalyticsEngine.js';

test('buildEnterpriseAnalyticsEngine aggregates telemetry and performance summaries', () => {
  const engine = buildEnterpriseAnalyticsEngine();

  engine.recordMetric('Executive Intelligence', { executionCount: 5, averageRuntime: 10, successRate: 0.9, failureRate: 0.1, queueUtilization: 0.3, workflowThroughput: 2, recoveryFrequency: 0.2, forecastAccuracy: 0.8, recommendationAcceptanceRate: 0.7 });
  engine.recordMetric('Portfolio Intelligence', { executionCount: 4, averageRuntime: 8, successRate: 0.95, failureRate: 0.05, queueUtilization: 0.4, workflowThroughput: 3, recoveryFrequency: 0.1, forecastAccuracy: 0.75, recommendationAcceptanceRate: 0.6 });

  const payload = engine.getTelemetryPayload();
  assert.equal(payload.modules['Executive Intelligence'].executionCount, 5);
  assert.equal(payload.modules['Portfolio Intelligence'].successRate > 0.9, true);
  assert.equal(payload.performanceSummary.enterpriseHealthScore >= 0, true);
  assert.equal(payload.performanceSummary.enterpriseHealthScore <= 100, true);
  assert.equal(payload.historicalMetrics.length >= 2, true);
});

test('buildEnterpriseAnalyticsEngine preserves manual override context', () => {
  const engine = buildEnterpriseAnalyticsEngine();
  const payload = engine.getTelemetryPayload({ context: { manualOverrideStrategy: 'Aggressive Growth' } });
  assert.equal(payload.context.manualOverrideStrategy, 'Aggressive Growth');
});
