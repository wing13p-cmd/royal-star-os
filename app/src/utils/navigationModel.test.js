import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getCanonicalNavigation,
  getSidebarNavigation,
  resolveSafeViewKey,
  shouldConfirmNavigation,
  isKnownViewKey,
} from './navigationModel.js';

test('sidebar navigation includes Rehab Project Tracker and excludes Deal Intake', () => {
  const sidebar = getSidebarNavigation();
  const labels = sidebar.map((entry) => entry.label);
  const viewKeys = sidebar.map((entry) => entry.viewKey);

  assert.equal(labels.includes('REHAB PROJECT TRACKER'), true);
  assert.equal(viewKeys.includes('rehabProjectTracker'), true);
  assert.equal(viewKeys.includes('dealIntake'), false);
});

test('canonical navigation returns a shallow copy', () => {
  const a = getCanonicalNavigation();
  const b = getCanonicalNavigation();

  assert.notEqual(a, b);
  assert.equal(Array.isArray(a), true);
  assert.equal(a.length > 0, true);
});

test('resolveSafeViewKey falls back to dashboard for unknown view', () => {
  assert.equal(resolveSafeViewKey('dealAnalyzer', 'dashboard'), 'dealAnalyzer');
  assert.equal(resolveSafeViewKey('unknown-view', 'dashboard'), 'dashboard');
  assert.equal(isKnownViewKey('dashboard'), true);
  assert.equal(isKnownViewKey('not-a-view'), false);
});

test('shouldConfirmNavigation only prompts when unsaved data would be abandoned', () => {
  assert.equal(
    shouldConfirmNavigation({ hasUnsavedChanges: false, targetViewKey: 'dashboard', currentViewKey: 'dealIntake' }),
    false,
  );
  assert.equal(
    shouldConfirmNavigation({ hasUnsavedChanges: true, targetViewKey: 'dealIntake', currentViewKey: 'dealIntake' }),
    false,
  );
  assert.equal(
    shouldConfirmNavigation({ hasUnsavedChanges: true, targetViewKey: 'dealAnalyzer', currentViewKey: 'dealIntake' }),
    true,
  );
});
