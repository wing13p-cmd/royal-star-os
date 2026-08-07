import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveBackendStatus } from './backendHealthStatus.js';

test('returns a healthy status for a healthy backend payload', () => {
  assert.equal(resolveBackendStatus({ healthy: true, status: 'ok' }), 'Backend Healthy');
});

test('returns an unhealthy status for a failed backend payload', () => {
  assert.equal(resolveBackendStatus({ healthy: false, status: 'degraded' }), 'Backend Unhealthy');
});

test('returns an offline status when the health check fails', () => {
  assert.equal(resolveBackendStatus(null, true), 'Backend Offline — Local Fallback');
});
