import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CountyPropertyProviderAdapter,
  CountyRecorderProviderAdapter,
  PermitProviderAdapter,
  FemaProviderAdapter,
  CensusProviderAdapter,
  GoogleMapsProviderAdapter,
  validateMediaRights,
  createProviderReviewQueue,
  buildProviderStatusDashboard,
  createProductionProviderAdapters,
} from './enterpriseLiveProviderEngine.js';

function makeFetch(payload) {
  return async () => ({
    ok: true,
    text: async () => JSON.stringify(payload),
  });
}

test('county property provider maps required production fields and enforces review-first', async () => {
  const adapter = new CountyPropertyProviderAdapter({
    credentials: { apiKey: 'configured' },
    baseUrl: 'https://county.example.test',
    fetchImpl: makeFetch({
      ownerName: 'RSOS Holdings LLC',
      parcelNumber: 'APN-952',
      legalDescription: 'Lot 9 Block 2',
      taxAssessment: 210000,
      lotSize: 7800,
      buildingSize: 1800,
      yearBuilt: 1986,
      landValue: 95000,
      improvementValue: 115000,
      saleHistory: [{ saleDate: '2024-01-01', salePrice: 185000 }],
    }),
  });

  const result = await adapter.searchProperty({ address: '952 Goss Rd' });
  const record = result.records[0];

  assert.equal(result.status, 'CONNECTED');
  assert.equal(result.reviewFirst, true);
  assert.equal(record.ownerName, 'RSOS Holdings LLC');
  assert.equal(record.parcelNumber, 'APN-952');
  assert.equal(record.legalDescription, 'Lot 9 Block 2');
  assert.equal(record.taxAssessment, 210000);
  assert.equal(record.lotSize, 7800);
  assert.equal(record.buildingSize, 1800);
  assert.equal(record.yearBuilt, 1986);
  assert.equal(record.landValue, 95000);
  assert.equal(record.improvementValue, 115000);
  assert.ok(Array.isArray(record.saleHistory));
  assert.equal(record.reviewStatus, 'PENDING_REVIEW');
  assert.equal(record.autoApproved, false);
});

test('county recorder provider maps deeds mortgages transfers and recording references', async () => {
  const adapter = new CountyRecorderProviderAdapter({
    credentials: { token: 'configured' },
    baseUrl: 'https://recorder.example.test',
    fetchImpl: makeFetch({
      recordedDeeds: [{ deedType: 'Warranty', documentReference: 'D-100', recordingDate: '2025-02-02' }],
      mortgageHistory: [{ lender: 'Bank', amount: 150000, recordingDate: '2025-02-03' }],
      transferDates: ['2025-02-01'],
      transferPrices: [190000],
      documentReferences: ['DOC-22'],
      recordingDates: ['2025-02-04'],
    }),
  });

  const result = await adapter.searchOwner({ address: '952 Goss Rd' });
  const record = result.records[0];

  assert.equal(result.status, 'CONNECTED');
  assert.ok(Array.isArray(record.recordedDeeds));
  assert.ok(Array.isArray(record.mortgageHistory));
  assert.ok(Array.isArray(record.transferDates));
  assert.ok(Array.isArray(record.transferPrices));
  assert.ok(Array.isArray(record.documentReferences));
  assert.ok(Array.isArray(record.recordingDates));
  assert.equal(record.reviewStatus, 'PENDING_REVIEW');
});

test('permit provider maps open and closed permits with inspection and contractor fields', async () => {
  const adapter = new PermitProviderAdapter({
    credentials: { apiKey: 'configured' },
    baseUrl: 'https://permits.example.test',
    fetchImpl: makeFetch({
      permits: [
        { permitNumber: 'P-1', permitType: 'Electrical', status: 'Open', permitDate: '2026-01-01', inspectionStatus: 'Scheduled', contractor: 'Prime Electric' },
        { permitNumber: 'P-2', permitType: 'Plumbing', status: 'Closed', permitDate: '2025-11-01', inspectionStatus: 'Passed' },
      ],
    }),
  });

  const result = await adapter.searchPermits({ address: '952 Goss Rd' });
  assert.equal(result.status, 'CONNECTED');
  assert.equal(result.records.length, 2);
  assert.equal(result.records[0].openOrClosed, 'Open');
  assert.equal(result.records[1].openOrClosed, 'Closed');
  assert.equal(result.records[0].reviewStatus, 'PENDING_REVIEW');
});

test('fema provider maps flood and disaster attributes', async () => {
  const adapter = new FemaProviderAdapter({
    credentials: { token: 'configured' },
    baseUrl: 'https://fema.example.test',
    fetchImpl: makeFetch({
      floodZone: 'AE',
      floodRisk: 'Moderate',
      disasterArea: 'No',
      mapReference: 'FIRM-123',
    }),
  });

  const result = await adapter.searchMarket({ address: '952 Goss Rd' });
  assert.equal(result.status, 'CONNECTED');
  assert.equal(result.records[0].floodZone, 'AE');
  assert.equal(result.records[0].mapReference, 'FIRM-123');
});

test('census provider maps demographics metrics', async () => {
  const adapter = new CensusProviderAdapter({
    credentials: { token: 'configured' },
    baseUrl: 'https://census.example.test',
    fetchImpl: makeFetch({
      population: 12000,
      income: 68000,
      housing: 4300,
      occupancy: 'Owner Occupied',
      growth: 'Positive',
      demographics: { medianAge: 36 },
    }),
  });

  const result = await adapter.searchMarket({ zipCode: '41011' });
  assert.equal(result.status, 'CONNECTED');
  assert.equal(result.records[0].population, 12000);
  assert.equal(result.records[0].income, 68000);
  assert.equal(result.records[0].demographics.medianAge, 36);
});

test('google maps provider maps geocoding and media references without storing imagery', async () => {
  const geocodeAdapter = new GoogleMapsProviderAdapter({
    credentials: { apiKey: 'configured' },
    baseUrl: 'https://maps.example.test',
    fetchImpl: makeFetch({
      geocodedAddress: '952 Goss Rd, Covington, KY',
      addressValidation: 'VALID',
      coordinates: { lat: 39.083, lng: -84.508 },
      streetViewReference: 'pano-123',
      placeId: 'place-123',
      drivingDistance: '4.3 mi',
      walkingDistance: '3.1 mi',
    }),
  });

  const geocode = await geocodeAdapter.searchProperty({ address: '952 Goss Rd' });
  assert.equal(geocode.status, 'CONNECTED');
  assert.equal(geocode.records[0].placeId, 'place-123');

  const mediaAdapter = new GoogleMapsProviderAdapter({
    credentials: { apiKey: 'configured' },
    baseUrl: 'https://maps.example.test',
    fetchImpl: makeFetch({
      licenseStatus: 'LICENSED',
      copyrightStatus: 'COPYRIGHT_PROTECTED',
      usageRestrictions: 'REFERENCE_ONLY_NO_IMAGE_STORAGE',
      imageryReference: 'street-view-ref',
    }),
  });

  const media = await mediaAdapter.searchMedia({ address: '952 Goss Rd' });
  assert.equal(media.status, 'CONNECTED');
  assert.equal(media.records[0].imageStored, false);
  assert.equal(media.records[0].usageRestrictions, 'REFERENCE_ONLY_NO_IMAGE_STORAGE');
});

test('adapters preserve unknown values and do not execute live calls without credentials', async () => {
  const adapter = new CountyPropertyProviderAdapter({
    credentials: {},
    baseUrl: 'https://county.example.test',
    fetchImpl: async () => {
      throw new Error('should not execute fetch without credentials');
    },
  });

  const result = await adapter.searchProperty({ address: '952 Goss Rd' });
  assert.equal(result.status, 'NEEDS_CREDENTIALS');
  assert.equal(result.liveCallExecuted, false);
  assert.equal(result.records.length, 0);
  assert.ok(result.unknowns.length > 0);
});

test('media rights validator returns required compliance fields', () => {
  const result = validateMediaRights({
    source: 'Google Maps',
    licenseStatus: 'LICENSED',
    copyrightStatus: 'COPYRIGHT_PROTECTED',
    retrievalDate: '2026-08-05T00:00:00.000Z',
    usageRestrictions: 'REFERENCE_ONLY',
  });

  assert.equal(result.source, 'Google Maps');
  assert.equal(result.licenseStatus, 'LICENSED');
  assert.equal(result.copyrightStatus, 'COPYRIGHT_PROTECTED');
  assert.equal(result.usageRestrictions, 'REFERENCE_ONLY');
  assert.equal(result.reviewRequired, true);
});

test('review queue enforces pending-review ingestion and no automatic approvals', () => {
  const queue = createProviderReviewQueue();
  const item = queue.enqueue('county-assessor', { recordId: 'r-1', ownerName: 'RSOS Holdings' });

  assert.equal(item.reviewStatus, 'PENDING_REVIEW');
  assert.equal(item.approvalRequired, true);
  assert.equal(item.autoApproved, false);

  const approved = queue.approve(item.reviewId, 'Analyst One');
  assert.equal(approved.reviewStatus, 'APPROVED');
  assert.equal(approved.autoApproved, false);

  const second = queue.enqueue('county-recorder', { recordId: 'r-2' });
  const rejected = queue.reject(second.reviewId, 'Analyst Two', 'Insufficient support');
  assert.equal(rejected.reviewStatus, 'REJECTED');

  const summary = queue.summary();
  assert.equal(summary.autoApproved, 0);
});

test('provider status dashboard reports required status flags and sync summary', () => {
  const registry = {
    providers: [
      { providerId: 'county-assessor', name: 'County Assessor', enabled: true, licenseRequirements: ['County terms'] },
      { providerId: 'fema', name: 'FEMA', enabled: false, licenseRequirements: ['FEMA terms'] },
    ],
  };
  const vault = {
    getCredentialStatus(providerId) {
      if (providerId === 'county-assessor') return { credentialStatus: 'CONFIGURED' };
      return { credentialStatus: 'EMPTY' };
    },
  };
  const syncEngine = {
    getState() {
      return { status: 'DISABLED_UNTIL_PROVIDER_ENABLEMENT' };
    },
  };
  const audit = {
    list() {
      return [{ providerId: 'county-assessor', status: 'SUCCESS', timestamp: '2026-08-05T12:00:00.000Z' }];
    },
  };

  const dashboard = buildProviderStatusDashboard({ registry, vault, syncEngine, audit });
  assert.equal(dashboard.length, 2);
  assert.equal(dashboard[0].syncStatus, 'DISABLED_UNTIL_PROVIDER_ENABLEMENT');
  assert.ok('connected' in dashboard[0]);
  assert.ok('needsCredentials' in dashboard[0]);
  assert.ok('unavailable' in dashboard[0]);
  assert.ok('licensed' in dashboard[0]);
  assert.ok('ready' in dashboard[0]);
  assert.ok('lastSuccessfulSync' in dashboard[0]);
});

test('production adapter factory returns all required live provider adapters', () => {
  const adapters = createProductionProviderAdapters({
    credentials: {
      'county-assessor': { apiKey: 'x' },
      'county-recorder': { apiKey: 'x' },
      'permit-records': { apiKey: 'x' },
      fema: { apiKey: 'x' },
      census: { apiKey: 'x' },
      'google-maps': { apiKey: 'x' },
    },
    baseUrls: {
      'county-assessor': 'https://a.example',
      'county-recorder': 'https://b.example',
      'permit-records': 'https://c.example',
      fema: 'https://d.example',
      census: 'https://e.example',
      'google-maps': 'https://f.example',
    },
  });

  assert.ok(adapters.countyProperty);
  assert.ok(adapters.countyRecorder);
  assert.ok(adapters.permit);
  assert.ok(adapters.fema);
  assert.ok(adapters.census);
  assert.ok(adapters.googleMaps);
});
