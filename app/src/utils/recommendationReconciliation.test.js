import test from 'node:test';
import assert from 'node:assert/strict';
import { reconcileRecommendations } from './recommendationReconciliation.js';

test('reconcileRecommendations resolves conflicts to COUNTER / RENEGOTIATE when gating checks pass', () => {
  const result = reconcileRecommendations([
    { source: 'Flip', recommendation: 'Buy' },
    { source: 'BRRRR', recommendation: 'Conditional Buy' },
    { source: 'AI Decision', recommendation: 'Do Not Purchase' },
    { source: 'Buy Box', recommendation: 'PASS' },
  ], {
    criticalDataMissing: false,
    confidenceLabel: 'Moderate',
    supportedArvEstablished: true,
    financingComplete: true,
  });

  assert.equal(result.hasConflict, true);
  assert.equal(result.displayRecommendation, 'COUNTER / RENEGOTIATE');
  assert.match(result.explanation, /Flip=Buy/);
});

test('reconcileRecommendations returns BUY when engines align and gating checks pass', () => {
  const result = reconcileRecommendations([
    { source: 'Flip', recommendation: 'Buy' },
    { source: 'BRRRR', recommendation: 'Buy' },
    { source: 'AI Decision', recommendation: 'Proceed' },
    { source: 'Buy Box', recommendation: 'PASS' },
  ], {
    criticalDataMissing: false,
    confidenceLabel: 'High',
    supportedArvEstablished: true,
    financingComplete: true,
  });

  assert.equal(result.hasConflict, false);
  assert.equal(result.displayRecommendation, 'BUY');
});

test('reconcileRecommendations forces PAUSE FOR DATA when gating blockers exist', () => {
  const result = reconcileRecommendations([
    { source: 'Flip', recommendation: 'Buy' },
    { source: 'BRRRR', recommendation: 'Buy' },
  ], {
    criticalDataMissing: true,
    confidenceLabel: 'Very Low',
    supportedArvEstablished: false,
    financingComplete: false,
    decisionBlockers: ['active decision-blocking condition'],
  });

  assert.equal(result.displayRecommendation, 'PAUSE FOR DATA');
  assert.match(result.explanation, /Controlling rule:/);
});
