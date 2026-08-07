import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

import {
  createEnterpriseProviderRegistry,
  UniversalProviderAdapter,
  EncryptedCredentialVault,
  createSyncEngine,
  createMediaManager,
  normalizeEnterpriseProviderData,
  createEnterpriseProviderAudit,
  buildProviderDiagnostics,
  createEnterpriseProviderPlatform,
} from './enterpriseProviderPlatform.js';

test('provider registry includes required enterprise providers and user-defined providers', () => {
  const registry = createEnterpriseProviderRegistry({
    userDefinedProviders: [
      { providerId: 'custom-county-feed', name: 'Custom County Feed', category: 'public-records', priority: 11 },
    ],
  });

  const ids = registry.providers.map((provider) => provider.providerId);

  assert.ok(ids.includes('mls'));
  assert.ok(ids.includes('attom'));
  assert.ok(ids.includes('rentcast'));
  assert.ok(ids.includes('corelogic'));
  assert.ok(ids.includes('google-maps'));
  assert.ok(ids.includes('county-assessor'));
  assert.ok(ids.includes('county-recorder'));
  assert.ok(ids.includes('permit-records'));
  assert.ok(ids.includes('census'));
  assert.ok(ids.includes('fema'));
  assert.ok(ids.includes('school-data'));
  assert.ok(ids.includes('crime-data'));
  assert.ok(ids.includes('mortgage-rates'));
  assert.ok(ids.includes('property-tax'));
  assert.ok(ids.includes('auction-data'));
  assert.ok(ids.includes('foreclosure-data'));
  assert.ok(ids.includes('custom-county-feed'));
  assert.ok(registry.providers.every((provider) => provider.liveRequestsAllowed === false));
  assert.ok(registry.providers.every((provider) => provider.advisoryOnly === true));
});

test('universal provider adapter returns review-first placeholders for all search methods', () => {
  const adapter = new UniversalProviderAdapter({ providerId: 'mls' });

  const methods = [
    adapter.searchProperty({ address: '952 Goss Rd' }),
    adapter.searchComps({ address: '952 Goss Rd' }),
    adapter.searchRent({ address: '952 Goss Rd' }),
    adapter.searchMarket({ city: 'Covington' }),
    adapter.searchOwner({ address: '952 Goss Rd' }),
    adapter.searchParcel({ apn: '123-456' }),
    adapter.searchPermits({ address: '952 Goss Rd' }),
    adapter.searchTax({ address: '952 Goss Rd' }),
    adapter.searchMedia({ address: '952 Goss Rd' }),
  ];

  methods.forEach((result) => {
    assert.equal(result.status, 'DISABLED_REVIEW_ONLY');
    assert.equal(result.reviewStatus, 'REVIEW_REQUIRED');
    assert.equal(result.advisoryOnly, true);
    assert.equal(result.liveRequestsAllowed, false);
    assert.ok(Array.isArray(result.records));
    assert.ok(Array.isArray(result.warnings));
    assert.ok(Array.isArray(result.unknowns));
  });
});

test('encrypted credential vault stores encrypted data without exposing raw secret in file', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rsos-vault-'));
  const vaultPath = path.join(tempDir, 'enterprise-provider-vault.enc.json');

  const vault = new EncryptedCredentialVault({
    filePath: vaultPath,
    masterSecret: 'phase10-test-master-key',
  });

  const saveResult = vault.setCredential('mls', 'API_KEY', { apiKey: 'TOP-SECRET-KEY' });
  assert.equal(saveResult.ok, true);

  const status = vault.getCredentialStatus('mls');
  assert.equal(status.providerId, 'mls');
  assert.equal(status.credentialStatus, 'CONFIGURED');
  assert.equal(status.authType, 'API_KEY');

  const fileContent = fs.readFileSync(vaultPath, 'utf8');
  assert.equal(fileContent.includes('TOP-SECRET-KEY'), false);

  const emptyStatus = vault.getCredentialStatus('rentcast');
  assert.equal(emptyStatus.credentialStatus, 'EMPTY');
});

test('sync engine supports required modes and stays disabled until providers are enabled', () => {
  const registry = createEnterpriseProviderRegistry();
  const syncEngine = createSyncEngine({ registry });

  const disabledPlan = syncEngine.buildSyncPlan({ mode: 'MANUAL_SYNC', providerId: 'mls' });
  assert.equal(disabledPlan.ok, false);
  assert.equal(disabledPlan.status, 'SYNC_DISABLED');

  const retryResult = syncEngine.enqueueRetry({ providerId: 'mls', reason: 'Rate limit', attempts: 1 });
  assert.equal(retryResult.ok, true);
  assert.ok(retryResult.retryQueueDepth >= 1);

  const conflicts = syncEngine.detectConflicts(
    [{ id: 'record-1', updatedAt: '2026-08-05T00:00:00.000Z', value: 10 }],
    [{ id: 'record-1', updatedAt: '2026-08-05T00:01:00.000Z', value: 12 }],
    'id',
  );
  assert.equal(conflicts.conflictCount, 1);
  assert.equal(conflicts.conflicts[0].status, 'CONFLICT_REVIEW_REQUIRED');
});

test('media manager stores review-first media metadata with source and licensing fields', () => {
  const mediaManager = createMediaManager();
  const mediaRecord = mediaManager.registerMediaRecord({
    mediaType: 'Property Photos',
    source: 'MLS',
    license: 'DISPLAY_ONLY',
    copyright: 'Copyright Example MLS',
    retrievalDate: '2026-08-05T00:00:00.000Z',
  });

  assert.equal(mediaRecord.mediaType, 'Property Photos');
  assert.equal(mediaRecord.source, 'MLS');
  assert.equal(mediaRecord.license, 'DISPLAY_ONLY');
  assert.equal(mediaRecord.reviewStatus, 'REVIEW_REQUIRED');
  assert.equal(mediaRecord.advisoryOnly, true);
  assert.equal(mediaManager.listMediaRecords().length, 1);
});

test('canonical normalization returns all required RSOS domains and preserves unknowns', () => {
  const normalized = normalizeEnterpriseProviderData({
    sourceProvider: 'county-assessor',
    address: { address: '952 Goss Rd', city: 'Covington', state: 'KY', zip: '41011' },
    owner: { ownerName: 'RSOS Holdings' },
    parcel: { parcelNumber: 'APN-1' },
    tax: { annualTax: 2500 },
    mls: { listingId: 'MLS-1' },
    rental: { estimatedRent: 2100 },
    market: { medianPrice: 280000 },
    media: { mediaType: 'Street View', source: 'Google Maps' },
    permit: { permitId: 'PERMIT-1', status: 'Open' },
  });

  assert.equal(normalized.schemaVersion, 'rsos-canonical-v1');
  assert.ok(normalized.address);
  assert.ok(normalized.owner);
  assert.ok(normalized.parcel);
  assert.ok(normalized.tax);
  assert.ok(normalized.mls);
  assert.ok(normalized.rental);
  assert.ok(normalized.market);
  assert.ok(normalized.media);
  assert.ok(normalized.permit);
  assert.equal(normalized.reviewStatus, 'REVIEW_REQUIRED');
  assert.equal(normalized.advisoryOnly, true);

  const unknownPreserved = normalizeEnterpriseProviderData({});
  assert.equal(unknownPreserved.address.line1, 'UNKNOWN');
  assert.equal(unknownPreserved.owner.name, 'UNKNOWN');
  assert.equal(unknownPreserved.tax.annualTax, 'UNKNOWN');
});

test('enterprise audit log records provider sync diagnostics fields', () => {
  const audit = createEnterpriseProviderAudit();
  const record = audit.log({
    providerId: 'mls',
    syncMode: 'MANUAL_SYNC',
    status: 'BLOCKED',
    recordsRetrieved: 0,
    errors: ['CREDENTIALS_EMPTY'],
    warnings: ['Provider disabled'],
    credentialState: 'EMPTY',
    syncDurationMs: 12,
  });

  assert.equal(record.providerId, 'mls');
  assert.equal(record.syncMode, 'MANUAL_SYNC');
  assert.equal(record.credentialState, 'EMPTY');

  const summary = audit.summary();
  assert.equal(summary.totalEntries, 1);
  assert.equal(summary.errors, 1);
  assert.equal(summary.warnings, 1);
});

test('provider diagnostics return dashboard with health credential status and priority', () => {
  const registry = createEnterpriseProviderRegistry();
  const vault = new EncryptedCredentialVault({ masterSecret: 'diagnostics-key', filePath: path.join(os.tmpdir(), `diag-vault-${Date.now()}.enc.json`) });
  const syncEngine = createSyncEngine({ registry });

  const diagnostics = buildProviderDiagnostics({ registry, vault, syncEngine });
  assert.equal(diagnostics.advisoryOnly, true);
  assert.ok(Array.isArray(diagnostics.providerDashboard));
  assert.ok(diagnostics.providerDashboard.length >= 16);

  const first = diagnostics.providerDashboard[0];
  assert.ok(first.providerId);
  assert.ok(first.connectionHealth);
  assert.ok(first.syncHealth);
  assert.ok(first.credentialStatus);
  assert.ok(first.licenseStatus);
  assert.ok(first.providerPriority !== undefined);
});

test('enterprise provider platform composes registry adapter vault sync media normalization audit and diagnostics', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rsos-provider-platform-'));
  const platform = createEnterpriseProviderPlatform({
    masterSecret: 'phase10-platform-key',
    vaultFilePath: path.join(tempDir, 'platform-vault.enc.json'),
    userDefinedProviders: [{ providerId: 'custom-provider', name: 'Custom Provider' }],
  });

  assert.equal(platform.advisoryOnly, true);
  assert.equal(platform.liveRequestsAllowed, false);
  assert.ok(platform.registry.providers.some((provider) => provider.providerId === 'custom-provider'));

  const adapter = platform.universalAdapterFactory('custom-provider');
  const searchResult = adapter.searchProperty({ address: '952 Goss Rd' });
  assert.equal(searchResult.status, 'DISABLED_REVIEW_ONLY');

  const saveCredential = platform.credentialVault.setCredential('custom-provider', 'ENV_VAR', {});
  assert.equal(saveCredential.ok, true);
  assert.equal(saveCredential.credentialStatus, 'EMPTY');

  const syncPlan = platform.syncEngine.buildSyncPlan({ mode: 'FULL_REFRESH', providerId: 'custom-provider' });
  assert.equal(syncPlan.status, 'SYNC_DISABLED');

  const mediaRecord = platform.mediaManager.registerMediaRecord({ mediaType: 'Parcel Images', source: 'County Assessor' });
  assert.equal(mediaRecord.reviewStatus, 'REVIEW_REQUIRED');

  const normalized = platform.normalizeEnterpriseProviderData({ sourceProvider: 'custom-provider' });
  assert.equal(normalized.schemaVersion, 'rsos-canonical-v1');

  const auditRecord = platform.audit.log({ providerId: 'custom-provider', status: 'BLOCKED' });
  assert.equal(auditRecord.providerId, 'custom-provider');

  const diagnostics = platform.diagnostics();
  assert.ok(Array.isArray(diagnostics.providerDashboard));
  assert.ok(diagnostics.providerDashboard.some((entry) => entry.providerId === 'custom-provider'));
  assert.ok(Array.isArray(diagnostics.providerStatusDashboard));
  assert.ok(diagnostics.reviewQueue);

  const liveAdapters = platform.providerAdapters;
  assert.ok(liveAdapters.countyProperty);
  assert.ok(liveAdapters.countyRecorder);
  assert.ok(liveAdapters.permit);
  assert.ok(liveAdapters.fema);
  assert.ok(liveAdapters.census);
  assert.ok(liveAdapters.googleMaps);

  const queueItem = platform.importIntoReviewQueue('county-assessor', [{ parcelNumber: 'APN-952' }])[0];
  assert.equal(queueItem.reviewStatus, 'PENDING_REVIEW');
  assert.equal(queueItem.autoApproved, false);

  const mediaRights = platform.validateMediaRights({ source: 'Google Maps', usageRestrictions: 'REFERENCE_ONLY' });
  assert.equal(mediaRights.reviewRequired, true);
  assert.equal(mediaRights.usageRestrictions, 'REFERENCE_ONLY');

  const statusDashboard = platform.providerStatusDashboard();
  assert.ok(Array.isArray(statusDashboard));
  assert.ok(statusDashboard.length >= 1);
});
