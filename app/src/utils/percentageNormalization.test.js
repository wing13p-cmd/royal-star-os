import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizePercent, normalizePercentOrNull, percentDisplayValue } from './percentageNormalization.js';

test('normalizePercent supports whole and fractional percent values', () => {
  assert.deepEqual(normalizePercent(75), { status: 'ok', value: 0.75 });
  assert.deepEqual(normalizePercent(0.75), { status: 'ok', value: 0.75 });
  assert.deepEqual(normalizePercent('75'), { status: 'ok', value: 0.75 });
  assert.deepEqual(normalizePercent('75%'), { status: 'ok', value: 0.75 });
});

test('normalizePercent handles unknown and invalid values safely', () => {
  assert.deepEqual(normalizePercent(null), { status: 'unknown', value: null });
  assert.deepEqual(normalizePercent(undefined), { status: 'unknown', value: null });
  assert.deepEqual(normalizePercent(''), { status: 'unknown', value: null });
  assert.deepEqual(normalizePercent(-5), { status: 'invalid', value: null });
  assert.deepEqual(normalizePercent(Number.NaN), { status: 'invalid', value: null });
  assert.deepEqual(normalizePercent(Infinity), { status: 'invalid', value: null });
});

test('normalizePercentOrNull returns null for unknown and invalid inputs', () => {
  assert.equal(normalizePercentOrNull(75), 0.75);
  assert.equal(normalizePercentOrNull(0.75), 0.75);
  assert.equal(normalizePercentOrNull(null), null);
  assert.equal(normalizePercentOrNull(-1), null);
});

test('percentDisplayValue scales a fraction exactly once for UI formatting', () => {
  assert.equal(percentDisplayValue(0.12), 12);
  assert.equal(percentDisplayValue(-0.05), -5);
  assert.equal(percentDisplayValue(Number.NaN), null);
});
