import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import {
  createEnterpriseProviderControlLayer,
  EnterpriseAuditLog,
  ProviderMonitoringService,
  ProviderSyncManager,
  ProviderScheduledJobManager,
  ProviderDataQualityService,
  DuplicatePropertyDetectionService,
  ConflictResolutionGovernanceService,
  ReviewQueueGovernanceService,
  ProviderRateLimitUsageMonitor,
  ProviderOutageFailoverService,
  ProviderCacheGovernance,
  CrossModuleReconciliationService,
  BackupRecoveryAutomationService,
  DisasterRecoveryVerificationService,
  AdministratorSystemHealthService,
} from './enterpriseProviderControlLayer.js';
import { createEnterpriseProviderPlatform } from './enterpriseProviderPlatform.js';

function createRegistry() {
  return {
    providers: [
      { providerId: 'county-assessor', name: 'County Assessor', category: 'public-records', enabled: true, licenseRequirements: ['County terms'] },
      { providerId: 'county-recorder', name: 'County Recorder', category: 'public-records', enabled: false, licenseRequirements: ['Recorder terms'] },
      { providerId: 'permit-records', name: 'Permit Records', category: 'permits', enabled: false, licenseRequirements: ['Permit terms'] },
      { providerId: 'fema', name: 'FEMA', category: 'risk-data', enabled: false, licenseRequirements: ['FEMA terms'] },
      { providerId: 'census', name: 'Census', category: 'demographics', enabled: false, licenseRequirements: ['Census terms'] },
      { providerId: 'google-maps', name: 'Google Maps', category: 'mapping', enabled: false, licenseRequirements: ['Google terms'] },
    ],
  };
}

function createVault() {
  return {
    getCredentialStatus(providerId) {
      if (providerId === 'county-assessor') return { credentialStatus: 'CONFIGURED' };
      return { credentialStatus: 'EMPTY' };
    },
  };
}

test('provider-monitor tests', () => {
  const monitor = new ProviderMonitoringService({ registry: createRegistry(), vault: createVault(), cache: new ProviderCacheGovernance() });
  assert.ok(monitor.list().length >= 6);
});

test('provider-status tests', () => {
  const monitor = new ProviderMonitoringService({ registry: createRegistry(), vault: createVault(), cache: new ProviderCacheGovernance() });
  const county = monitor.list().find((entry) => entry.providerId === 'county-assessor');
  assert.equal(county.credentialStatus, 'Credentials Ready');
});

test('false-connected prevention tests', () => {
  const monitor = new ProviderMonitoringService({ registry: createRegistry(), vault: createVault(), cache: new ProviderCacheGovernance() });
  const result = monitor.recordAttempt('county-assessor', { success: true, authenticatedEvidence: false, status: 'Connected' });
  assert.notEqual(result.connectionStatus, 'Connected');
});

test('sync-manager tests', () => {
  const sync = new ProviderSyncManager({ reviewQueue: new ReviewQueueGovernanceService(), reconcile: new CrossModuleReconciliationService() });
  const requested = sync.requestSync({ provider: 'county-assessor', scope: 'single-provider-sync', requestedCriteria: { address: '952 Goss Rd' }, approvedByAdmin: true });
  assert.equal(requested.ok, true);
});

test('incremental-sync tests', () => {
  const sync = new ProviderSyncManager({ reviewQueue: new ReviewQueueGovernanceService(), reconcile: new CrossModuleReconciliationService() });
  const requested = sync.requestSync({ provider: 'county-assessor', scope: 'incremental-refresh', requestedCriteria: { since: '2026-08-01' }, approvedByAdmin: true });
  assert.equal(requested.ok, true);
  assert.equal(requested.operation.scope, 'incremental-refresh');
});

test('full-refresh approval tests', () => {
  const sync = new ProviderSyncManager({ reviewQueue: new ReviewQueueGovernanceService(), reconcile: new CrossModuleReconciliationService() });
  const denied = sync.requestSync({ provider: 'county-assessor', scope: 'full-refresh', requestedCriteria: {}, approvedByAdmin: false });
  assert.equal(denied.status, 'ADMIN_APPROVAL_REQUIRED');
});

test('cancellation tests', () => {
  const sync = new ProviderSyncManager({ reviewQueue: new ReviewQueueGovernanceService(), reconcile: new CrossModuleReconciliationService() });
  const requested = sync.requestSync({ provider: 'county-assessor', scope: 'manual-sync', requestedCriteria: {}, approvedByAdmin: true });
  const canceled = sync.cancelOperation(requested.operation.operationId, 'Canceled for maintenance');
  assert.equal(canceled.ok, true);
  assert.equal(canceled.operation.status, 'CANCELED');
});

test('retry tests', () => {
  const sync = new ProviderSyncManager({ reviewQueue: new ReviewQueueGovernanceService(), reconcile: new CrossModuleReconciliationService() });
  const requested = sync.requestSync({ provider: 'county-assessor', scope: 'manual-sync', requestedCriteria: {}, approvedByAdmin: true });
  const retried = sync.retryOperation(requested.operation.operationId);
  assert.equal(retried.ok, true);
  assert.equal(retried.operation.retryCount, 1);
});

test('duplicate-operation tests', () => {
  const sync = new ProviderSyncManager({ reviewQueue: new ReviewQueueGovernanceService(), reconcile: new CrossModuleReconciliationService() });
  const op = sync.requestSync({ provider: 'county-assessor', scope: 'subject-property-sync', requestedCriteria: { address: '952 Goss Rd' }, approvedByAdmin: true }).operation;
  sync.startOperation(op.operationId);
  const duplicate = sync.requestSync({ provider: 'county-assessor', scope: 'subject-property-sync', requestedCriteria: { address: '952 Goss Rd' }, approvedByAdmin: true });
  assert.equal(duplicate.status, 'DUPLICATE_OPERATION_BLOCKED');
});

test('scheduler-disabled tests', () => {
  const scheduler = new ProviderScheduledJobManager();
  const run = scheduler.run('provider-health-checks', {});
  assert.equal(run.status, 'DISABLED');
});

test('job-lock tests', () => {
  const scheduler = new ProviderScheduledJobManager();
  scheduler.authorize(true, 'Brandon Sterling');
  scheduler.schedule('provider-health-checks', '*/15 * * * *', 'Brandon Sterling');
  scheduler.runningLocks.add('provider-health-checks');
  const run = scheduler.run('provider-health-checks', {});
  assert.equal(run.status, 'LOCKED');
});

test('data-quality tests', () => {
  const quality = new ProviderDataQualityService();
  const result = quality.score({ sourceAuthority: 90, sourceRecency: 90, verificationStatus: 90, fieldCompleteness: 90, addressQuality: 90, parcelMatch: 90, saleEventQuality: 90, propertyCharacteristicConsistency: 90, geographicPrecision: 90, licensingClarity: 90, mediaRightsClarity: 90, crossSourceAgreement: 90, duplicateRisk: 5, conflictRisk: 5 });
  assert.ok(result.qualityScore >= 80);
});

test('confidence-ceiling tests', () => {
  const quality = new ProviderDataQualityService();
  const result = quality.score({ sourceAuthority: 90, sourceRecency: 90, verificationStatus: 90, fieldCompleteness: 90, addressQuality: 90, parcelMatch: 90, saleEventQuality: 90, propertyCharacteristicConsistency: 90, geographicPrecision: 90, licensingClarity: 90, mediaRightsClarity: 90, crossSourceAgreement: 90, duplicateRisk: 5, conflictRisk: 5 });
  assert.equal(result.confidenceCeiling, 'MODERATE');
});

test('duplicate-property tests', () => {
  const duplicate = new DuplicatePropertyDetectionService();
  const result = duplicate.classify(
    { address: '952 Goss Rd', parcelNumber: 'APN-1', providerPropertyId: 'A', listingKey: 'L1', countyAccountNumber: 'C1', legalDescription: 'Lot 1', recordingDocumentNumber: 'D1', ownerIdentity: 'RSOS', latitude: 39.1, longitude: -84.5, saleDate: '2026-01-01', salePrice: 200000 },
    { address: '952 Goss Rd', parcelNumber: 'APN-1', providerPropertyId: 'A', listingKey: 'L1', countyAccountNumber: 'C1', legalDescription: 'Lot 1', recordingDocumentNumber: 'D1', ownerIdentity: 'RSOS', latitude: 39.1, longitude: -84.5, saleDate: '2026-01-01', salePrice: 200000 },
  );
  assert.equal(result.classification, 'Exact Duplicate');
});

test('distinct-sale-event tests', () => {
  const duplicate = new DuplicatePropertyDetectionService();
  const result = duplicate.classify(
    { address: '952 Goss Rd', saleDate: '2026-01-01', salePrice: 200000 },
    { address: '952 Goss Rd', saleDate: '2026-03-01', salePrice: 210000 },
  );
  assert.equal(result.classification, 'Distinct Sale Event');
});

test('conflict-resolution tests', () => {
  const conflict = new ConflictResolutionGovernanceService({ audit: new EnterpriseAuditLog() });
  const result = conflict.resolve({ actor: 'Brandon Sterling', action: 'retain current value', reason: 'Current value already verified', entity: 'property', entityId: 'prop-1' });
  assert.equal(result.ok, true);
});

test('no-silent-overwrite tests', () => {
  const conflict = new ConflictResolutionGovernanceService({ audit: new EnterpriseAuditLog() });
  const denied = conflict.resolve({ actor: 'Brandon Sterling', action: 'retain current value', entity: 'property', entityId: 'prop-1' });
  assert.equal(denied.status, 'REASON_REQUIRED');
});

test('exactly-one re-underwriting tests', () => {
  const conflict = new ConflictResolutionGovernanceService({ audit: new EnterpriseAuditLog() });
  const first = conflict.resolve({ actor: 'Brandon Sterling', action: 'create a new approved version', reason: 'Material change', entity: 'property', entityId: 'prop-1', materialChange: true });
  const second = conflict.resolve({ actor: 'Brandon Sterling', action: 'create a new approved version', reason: 'Material change 2', entity: 'property', entityId: 'prop-1', materialChange: true });
  assert.equal(first.resolution.reUnderwritingTriggered, true);
  assert.equal(second.resolution.reUnderwritingTriggered, false);
});

test('cosmetic-no-trigger tests', () => {
  const conflict = new ConflictResolutionGovernanceService({ audit: new EnterpriseAuditLog() });
  const result = conflict.resolve({ actor: 'Brandon Sterling', action: 'save as alternate evidence', reason: 'Metadata only', entity: 'property', entityId: 'prop-1', materialChange: false });
  assert.equal(result.resolution.reUnderwritingTriggered, false);
});

test('review-queue tests', () => {
  const queue = new ReviewQueueGovernanceService({ audit: new EnterpriseAuditLog() });
  const item = queue.enqueue('New Provider Record', { assignedTo: 'Brandon Sterling' });
  assert.equal(item.status, 'PENDING_REVIEW');
});

test('bulk-review tests', () => {
  const queue = new ReviewQueueGovernanceService({ audit: new EnterpriseAuditLog() });
  const a = queue.enqueue('Comp Review', {});
  const b = queue.enqueue('Comp Review', {});
  const result = queue.bulkAction([a.reviewId, b.reviewId], 'approve', { reason: 'Bulk approval after review' });
  assert.equal(result.updatedCount, 2);
});

test('partial-failure tests', () => {
  const queue = new ReviewQueueGovernanceService({ audit: new EnterpriseAuditLog() });
  const sync = new ProviderSyncManager({ reviewQueue: queue, reconcile: new CrossModuleReconciliationService(), audit: new EnterpriseAuditLog() });
  const operation = sync.requestSync({ provider: 'county-assessor', scope: 'manual-sync', requestedCriteria: {}, approvedByAdmin: true }).operation;
  sync.startOperation(operation.operationId);
  const completed = sync.completeOperation(operation.operationId, { providerErrors: ['timeout'], warnings: ['partial'], reviewRecords: [{ id: 'r1' }] });
  assert.equal(completed.operation.status, 'PARTIAL_FAILURE');
});

test('rate-limit tests', () => {
  const usage = new ProviderRateLimitUsageMonitor();
  const result = usage.recordRequest('county-assessor', { success: true, latencyMs: 120, rateLimitResponse: 'OK', retryAfter: '0', providerReportedQuota: 500 });
  assert.equal(result.requestCount, 1);
  assert.equal(result.providerReportedQuota, 500);
});

test('no-fabricated-quota tests', () => {
  const usage = new ProviderRateLimitUsageMonitor();
  const result = usage.getProviderUsage('county-recorder');
  assert.equal(result.providerReportedQuota, 'UNKNOWN');
});

test('provider-outage tests', () => {
  const outage = new ProviderOutageFailoverService({ activeProviders: ['county-assessor'], audit: new EnterpriseAuditLog() });
  const record = outage.reportOutage('county-assessor', { reason: 'provider timeout' });
  assert.equal(record.status, 'OPEN');
});

test('authorized-failover tests', () => {
  const outage = new ProviderOutageFailoverService({ activeProviders: ['county-assessor', 'county-recorder'], audit: new EnterpriseAuditLog() });
  const result = outage.attemptFailover('county-assessor', ['county-recorder', 'fema']);
  assert.equal(result.ok, true);
  assert.equal(result.failoverProvider, 'county-recorder');
});

test('cache tests', () => {
  const cache = new ProviderCacheGovernance({ audit: new EnterpriseAuditLog() });
  const set = cache.set('property:952-goss', { source: 'county-assessor', providerId: 'county-assessor', content: { value: 1 }, expirationDate: '2026-08-31T00:00:00.000Z', staleStatus: 'FRESH' });
  assert.equal(set.ok, true);
  assert.ok(cache.get('property:952-goss'));
});

test('cache-expiration tests', () => {
  const cache = new ProviderCacheGovernance({ audit: new EnterpriseAuditLog() });
  cache.set('property:952-goss', { source: 'county-assessor', providerId: 'county-assessor', content: { value: 1 }, expirationDate: '2026-08-31T00:00:00.000Z', staleStatus: 'FRESH' });
  const invalidated = cache.invalidate('property:952-goss', 'expired');
  assert.equal(invalidated.ok, true);
  assert.equal(invalidated.entry.staleStatus, 'STALE');
});

test('secret-cache prevention tests', () => {
  const cache = new ProviderCacheGovernance({ audit: new EnterpriseAuditLog() });
  const blocked = cache.set('secret:url', { source: 'google-maps', providerId: 'google-maps', content: {}, hasCredentialBearingUrl: true });
  assert.equal(blocked.status, 'PROHIBITED_FROM_CACHE');
});

test('cross-module reconciliation tests', () => {
  const reconcile = new CrossModuleReconciliationService();
  const result = reconcile.reconcile({
    approvedData: { propertyFacts: { address: '952 Goss Rd' }, valuationEvidence: [], rentData: 2200, canonicalFacts: { address: '952 Goss Rd' }, portfolioValues: { total: 1 } },
    providerData: { confidence: 'MODERATE', providerRecords: [], unavailable: true, unresolvedConflicts: [] },
  });
  assert.equal(result.advisoryOnly, true);
});

test('unreviewed-data isolation tests', () => {
  const reconcile = new CrossModuleReconciliationService();
  const result = reconcile.reconcile({ approvedData: {}, providerData: { reviewBlockers: ['pending review'] } });
  assert.equal(result.unreviewedDataAffectsDecisions, false);
});

test('audit tests', () => {
  const audit = new EnterpriseAuditLog();
  const entry = audit.log({ eventType: 'sync_request', entity: 'provider-sync', entityId: 'sync-1' });
  assert.equal(entry.eventType, 'sync_request');
  assert.equal(audit.list().length, 1);
});

test('secret-redaction tests', () => {
  const audit = new EnterpriseAuditLog();
  const entry = audit.log({ eventType: 'credential_status_change', entity: 'provider', entityId: 'county-assessor', proposedValue: { apiKey: 'SECRET', token: 'ABC' } });
  assert.equal(entry.proposedValue.apiKey, 'REDACTED');
  assert.equal(entry.proposedValue.token, 'REDACTED');
});

test('backup tests', async () => {
  const backupDir = await fs.mkdtemp(path.join(os.tmpdir(), 'rsos-bkp-'));
  const backup = new BackupRecoveryAutomationService({ backupDir, audit: new EnterpriseAuditLog() });
  const created = await backup.createBackup({ providerRegistry: createRegistry(), syncHistory: [{ id: 1 }], reviewQueue: [{ id: 2 }], conflictResolutions: [{ id: 3 }], auditRecords: [{ id: 4 }] });
  assert.ok(created.filePath.includes('provider-control-backup-'));
});

test('credential-exclusion tests', async () => {
  const backupDir = await fs.mkdtemp(path.join(os.tmpdir(), 'rsos-bkp-'));
  const backup = new BackupRecoveryAutomationService({ backupDir, audit: new EnterpriseAuditLog() });
  const created = await backup.createBackup({ nonsecretProviderConfiguration: { token: 'DO_NOT_STORE' } });
  const content = await fs.readFile(created.filePath, 'utf8');
  assert.equal(content.includes('DO_NOT_STORE'), false);
});

test('restore dry-run tests', async () => {
  const backupDir = await fs.mkdtemp(path.join(os.tmpdir(), 'rsos-bkp-'));
  const backup = new BackupRecoveryAutomationService({ backupDir, audit: new EnterpriseAuditLog() });
  const created = await backup.createBackup({ reviewQueue: [{ id: 1 }] });
  const dryRun = await backup.restoreDryRun(created.filePath);
  assert.equal(dryRun.status, 'RESTORE_DRY_RUN_ONLY');
  assert.equal(dryRun.secretsRestored, false);
});

test('disaster-recovery tests', () => {
  const disaster = new DisasterRecoveryVerificationService({ audit: new EnterpriseAuditLog() });
  const report = disaster.runNonDestructiveVerification({ fixtures: {} });
  assert.equal(report.destructiveChangesPerformed, false);
  assert.equal(report.activeArvUnchanged, true);
});

test('system-health tests', () => {
  const audit = new EnterpriseAuditLog();
  const monitor = new ProviderMonitoringService({ registry: createRegistry(), vault: createVault(), cache: new ProviderCacheGovernance() });
  const sync = new ProviderSyncManager({ reviewQueue: new ReviewQueueGovernanceService({ audit }), reconcile: new CrossModuleReconciliationService(), audit });
  const scheduler = new ProviderScheduledJobManager({ audit });
  const cache = new ProviderCacheGovernance({ audit });
  const queue = new ReviewQueueGovernanceService({ audit });
  const outage = new ProviderOutageFailoverService({ activeProviders: ['county-assessor'], audit });

  const health = new AdministratorSystemHealthService({ monitor, sync, scheduler, cache, reviewQueue: queue, audit, outage, version: 'phase10-batch3-v1' }).snapshot('Brandon Sterling');
  assert.equal(health.ok, true);
  assert.equal(health.secretExposure, false);
});

test('documentation validation', async () => {
  const docPath = path.join(process.cwd(), 'docs', 'phase10-live-data-platform-enterprise-control.md');
  const content = (await fs.readFile(docPath, 'utf8')).toLowerCase();
  assert.equal(content.includes('provider registry'), true);
  assert.equal(content.includes('review-first workflow'), true);
  assert.equal(content.includes('adding a future provider safely'), true);
});

test('manual-mode tests', async () => {
  const platform = createEnterpriseProviderPlatform({
    credentials: {
      'county-assessor': {},
      'county-recorder': {},
      'permit-records': {},
      fema: {},
      census: {},
      'google-maps': {},
    },
    baseUrls: {
      'county-assessor': '',
      'county-recorder': '',
      'permit-records': '',
      fema: '',
      census: '',
      'google-maps': '',
    },
    activeProviders: [],
  });

  const result = await platform.providerAdapters.countyProperty.searchProperty({ address: '952 Goss Rd' });
  assert.equal(result.status, 'NEEDS_CREDENTIALS');
  assert.equal(result.liveCallExecuted, false);
});
