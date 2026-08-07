import test from 'node:test';
import assert from 'node:assert/strict';
import { createCompOperationsService } from './compOperationsService.js';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

let tempDir;
let service;

test.before(async () => {
  tempDir = await mkdtemp(path.join(os.tmpdir(), 'rsos-comp-ops-'));
  service = createCompOperationsService({ storageFilePath: path.join(tempDir, 'state.json') });
});

test.after(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

test('creates default saved-search templates and keeps manual mode safe', () => {
  const templates = service.createDefaultTemplates();
  assert.ok(templates.some((entry) => entry.name === 'Standard Urban Comp Search'));
  assert.ok(templates.some((entry) => entry.name === 'Small Multifamily Comp Search'));
  const initialCount = service.listTemplates().length;
  const added = service.saveTemplate({ name: 'Test Template', criteria: { radiusMiles: 0.5 } });
  assert.equal(added.name, 'Test Template');
  assert.equal(service.listTemplates().length, initialCount + 1);
});

test('records search history without mutating existing records', () => {
  const first = service.recordSearch({ subjectProperty: '952 Goss Rd', user: 'Brandon Sterling', template: 'Standard', criteria: { radiusMiles: 0.5 } });
  const second = service.recordSearch({ subjectProperty: '952 Goss Rd', user: 'Brandon Sterling', template: 'Standard', criteria: { radiusMiles: 1 } });
  const archived = service.archiveSearch(first.id, 'test');
  assert.equal(archived.archived, true);
  const history = service.listSearchHistory();
  assert.equal(history.length, 2);
  const reopened = history.find((entry) => entry.id === first.id);
  assert.equal(reopened.archived, true);
});

test('evaluates freshness and keeps stale status as warning only', () => {
  const comp = {
    id: 'comp-1',
    saleDate: new Date(Date.now() - 1000 * 60 * 60 * 24 * 220).toISOString(),
    providerUpdatedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 140).toISOString(),
    reviewDate: new Date(Date.now() - 1000 * 60 * 60 * 24 * 130).toISOString(),
    listingStatusAgeDays: 140,
    mediaRetrievedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 120).toISOString(),
    sourceExpiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString(),
  };
  const result = service.evaluateFreshness(comp);
  assert.equal(result.status, 'Stale');
  assert.ok(result.warningOnly);
});

test('keeps refresh queue disabled without active providers', () => {
  const queue = service.queueRefresh({ compId: 'comp-1', type: 'comp' });
  assert.equal(queue.ok, false);
  assert.match(queue.message, /disabled/i);
});

test('transitions lifecycle states and records audit entries', () => {
  const imported = service.transitionLifecycle({ compId: 'comp-2', currentStatus: 'Provider Imported', nextStatus: 'Pending Review', reason: 'Received provider import', actor: 'Brandon Sterling' });
  assert.equal(imported.ok, true);
  const verified = service.transitionLifecycle({ compId: 'comp-2', currentStatus: 'Pending Review', nextStatus: 'Verified', reason: 'Reviewed', actor: 'Brandon Sterling' });
  assert.equal(verified.ok, true);
  const invalid = service.transitionLifecycle({ compId: 'comp-2', currentStatus: 'Pending Review', nextStatus: 'Included', reason: 'Too soon', actor: 'Brandon Sterling' });
  assert.equal(invalid.ok, false);
  assert.match(invalid.message, /invalid/i);
});

test('detects duplicate candidates and records conflict state', () => {
  const comps = [
    { id: 'a', compAddress: '100 Main St', salePrice: 250000, saleDate: '2024-01-01', latitude: 39.1, longitude: -84.5, parcelId: 'PAR-001' },
    { id: 'b', compAddress: '100 main st', salePrice: 250000, saleDate: '2024-01-01', latitude: 39.1, longitude: -84.5, parcelId: 'PAR-001' },
  ];
  const duplicates = service.detectDuplicates(comps);
  assert.equal(duplicates.length, 1);
  const conflict = service.createConflict({ compIds: ['a', 'b'], reason: 'same sale event' });
  assert.equal(conflict.kind, 'duplicate');
});

test('applies bulk actions with clear partial failures', () => {
  const result = service.applyBulkAction({ compIds: ['comp-2'], action: 'archive', reason: 'cleanup', actor: 'Brandon Sterling' });
  assert.equal(result.applied.length, 1);
  const missing = service.applyBulkAction({ compIds: ['missing-id'], action: 'archive', reason: 'cleanup', actor: 'Brandon Sterling' });
  assert.equal(missing.failed.length, 1);
});

test('builds readiness and diagnostics without exposing credentials', () => {
  const readiness = service.evaluateReadiness({ comps: [{ id: 'x', verified: true, salePrice: 200000, saleDate: '2024-01-01', squareFeet: 1600, distanceMiles: 1.5, providerImported: false, inclusionStatus: 'Verified' }] });
  assert.ok(['Ready for Preliminary Valuation', 'Ready for Approval', 'Review Required', 'Not Ready'].includes(readiness.status));
  const diagnostics = service.buildDiagnostics({ comps: [], providerStatus: { active: false, provider: 'manual' }, redaction: true });
  assert.equal(diagnostics.providerReady, false);
  assert.equal(diagnostics.redacted, true);
});

test('preserves the 952 Goss Rd facts', () => {
  const facts = service.getProtectedFacts();
  assert.equal(facts.address, '952 Goss Rd');
  assert.equal(facts.purchasePrice, 135000);
  assert.equal(facts.activeArv, 300000);
});
