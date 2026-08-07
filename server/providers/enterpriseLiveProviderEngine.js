function safeString(value, fallback = 'UNKNOWN') {
  if (value === null || value === undefined || value === '') return fallback;
  return typeof value === 'string' ? value : String(value);
}

function safeNumber(value, fallback = null) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function normalizeArray(value) {
  return Array.isArray(value) ? value : [];
}

function nowIso() {
  return new Date().toISOString();
}

function createReviewEnvelope(sourceProvider, payload = {}) {
  return {
    reviewId: safeString(payload.reviewId || `review-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`),
    sourceProvider: safeString(sourceProvider),
    reviewStatus: 'PENDING_REVIEW',
    approvalRequired: true,
    autoApproved: false,
    approvedBy: 'UNKNOWN',
    approvedAt: 'UNKNOWN',
    rejectedBy: 'UNKNOWN',
    rejectedAt: 'UNKNOWN',
    rejectionReason: 'UNKNOWN',
    importedAt: nowIso(),
    advisoryOnly: true,
  };
}

function createUnknownResult(method, providerId, reason) {
  return {
    method,
    providerId,
    status: reason || 'NEEDS_CREDENTIALS',
    advisoryOnly: true,
    reviewFirst: true,
    unknowns: ['Provider response is UNKNOWN until credentials and licensing are verified.'],
    warnings: [reason === 'UNAVAILABLE' ? 'Provider endpoint is unavailable.' : 'Provider credentials are required before live calls.'],
    records: [],
    liveCallExecuted: false,
    timestamp: nowIso(),
  };
}

function buildQueryString(query = {}) {
  const params = new URLSearchParams();
  Object.entries(normalizeObject(query)).forEach(([key, value]) => {
    if (value === null || value === undefined || value === '') return;
    params.set(key, String(value));
  });
  const serialized = params.toString();
  return serialized ? `?${serialized}` : '';
}

class BaseLiveProviderAdapter {
  constructor(options = {}) {
    const normalized = normalizeObject(options);
    this.providerId = safeString(normalized.providerId, 'provider').toLowerCase();
    this.baseUrl = safeString(normalized.baseUrl, '');
    this.fetchImpl = normalized.fetchImpl || globalThis.fetch;
    this.timeoutMs = safeNumber(normalized.timeoutMs, 5000) || 5000;
    this.credentials = normalizeObject(normalized.credentials);
  }

  hasCredentials() {
    const values = Object.values(this.credentials).filter((value) => safeString(value, '') !== '');
    return values.length > 0;
  }

  async fetchJson(path, query = {}) {
    if (!this.hasCredentials()) {
      return { ok: false, status: 'NEEDS_CREDENTIALS', liveCallExecuted: false };
    }
    if (!this.baseUrl || typeof this.fetchImpl !== 'function') {
      return { ok: false, status: 'UNAVAILABLE', liveCallExecuted: false };
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await this.fetchImpl(`${this.baseUrl}${path}${buildQueryString(query)}`, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        signal: controller.signal,
      });
      const text = await response.text();
      const payload = text ? JSON.parse(text) : {};
      if (!response.ok) {
        return { ok: false, status: 'UNAVAILABLE', liveCallExecuted: true, error: payload?.error || 'provider_error' };
      }
      return { ok: true, status: 'CONNECTED', liveCallExecuted: true, payload };
    } catch {
      return { ok: false, status: 'UNAVAILABLE', liveCallExecuted: false };
    } finally {
      clearTimeout(timeout);
    }
  }

  buildResult(method, status, records = [], liveCallExecuted = false, warnings = []) {
    return {
      method,
      providerId: this.providerId,
      status,
      advisoryOnly: true,
      reviewFirst: true,
      unknowns: status === 'CONNECTED' ? [] : ['UNKNOWN values preserved for unsupported or unavailable fields.'],
      warnings,
      records,
      liveCallExecuted,
      timestamp: nowIso(),
    };
  }
}

export class CountyPropertyProviderAdapter extends BaseLiveProviderAdapter {
  constructor(options = {}) {
    super({ ...options, providerId: 'county-assessor' });
  }

  async searchProperty(query = {}) {
    const response = await this.fetchJson('/property', query);
    if (!response.ok) return createUnknownResult('searchProperty', this.providerId, response.status);

    const source = normalizeObject(response.payload);
    const record = {
      ownerName: safeString(source.ownerName),
      parcelNumber: safeString(source.parcelNumber),
      legalDescription: safeString(source.legalDescription),
      taxAssessment: safeNumber(source.taxAssessment, null) ?? 'UNKNOWN',
      lotSize: safeNumber(source.lotSize, null) ?? 'UNKNOWN',
      buildingSize: safeNumber(source.buildingSize, null) ?? 'UNKNOWN',
      yearBuilt: safeNumber(source.yearBuilt, null) ?? 'UNKNOWN',
      landValue: safeNumber(source.landValue, null) ?? 'UNKNOWN',
      improvementValue: safeNumber(source.improvementValue, null) ?? 'UNKNOWN',
      saleHistory: normalizeArray(source.saleHistory).map((entry) => ({
        saleDate: safeString(entry?.saleDate),
        salePrice: safeNumber(entry?.salePrice, null) ?? 'UNKNOWN',
      })),
      ...createReviewEnvelope(this.providerId),
    };

    return this.buildResult('searchProperty', 'CONNECTED', [record], response.liveCallExecuted);
  }
}

export class CountyRecorderProviderAdapter extends BaseLiveProviderAdapter {
  constructor(options = {}) {
    super({ ...options, providerId: 'county-recorder' });
  }

  async searchOwner(query = {}) {
    const response = await this.fetchJson('/recorder', query);
    if (!response.ok) return createUnknownResult('searchOwner', this.providerId, response.status);

    const source = normalizeObject(response.payload);
    const record = {
      recordedDeeds: normalizeArray(source.recordedDeeds).map((entry) => ({
        deedType: safeString(entry?.deedType),
        documentReference: safeString(entry?.documentReference),
        recordingDate: safeString(entry?.recordingDate),
      })),
      mortgageHistory: normalizeArray(source.mortgageHistory).map((entry) => ({
        lender: safeString(entry?.lender),
        amount: safeNumber(entry?.amount, null) ?? 'UNKNOWN',
        recordingDate: safeString(entry?.recordingDate),
      })),
      transferDates: normalizeArray(source.transferDates).map((value) => safeString(value)),
      transferPrices: normalizeArray(source.transferPrices).map((value) => safeNumber(value, null) ?? 'UNKNOWN'),
      documentReferences: normalizeArray(source.documentReferences).map((value) => safeString(value)),
      recordingDates: normalizeArray(source.recordingDates).map((value) => safeString(value)),
      ...createReviewEnvelope(this.providerId),
    };

    return this.buildResult('searchOwner', 'CONNECTED', [record], response.liveCallExecuted);
  }
}

export class PermitProviderAdapter extends BaseLiveProviderAdapter {
  constructor(options = {}) {
    super({ ...options, providerId: 'permit-records' });
  }

  async searchPermits(query = {}) {
    const response = await this.fetchJson('/permits', query);
    if (!response.ok) return createUnknownResult('searchPermits', this.providerId, response.status);

    const permits = normalizeArray(response.payload?.permits || response.payload).map((entry) => ({
      permitNumber: safeString(entry?.permitNumber),
      permitType: safeString(entry?.permitType),
      openOrClosed: safeString(entry?.openOrClosed || entry?.status),
      permitDate: safeString(entry?.permitDate || entry?.issuedDate),
      inspectionStatus: safeString(entry?.inspectionStatus),
      contractor: safeString(entry?.contractor, 'UNKNOWN'),
      ...createReviewEnvelope(this.providerId),
    }));

    return this.buildResult('searchPermits', 'CONNECTED', permits, response.liveCallExecuted);
  }
}

export class FemaProviderAdapter extends BaseLiveProviderAdapter {
  constructor(options = {}) {
    super({ ...options, providerId: 'fema' });
  }

  async searchMarket(query = {}) {
    const response = await this.fetchJson('/flood', query);
    if (!response.ok) return createUnknownResult('searchMarket', this.providerId, response.status);

    const source = normalizeObject(response.payload);
    const record = {
      floodZone: safeString(source.floodZone),
      floodRisk: safeString(source.floodRisk),
      disasterArea: safeString(source.disasterArea),
      mapReference: safeString(source.mapReference),
      ...createReviewEnvelope(this.providerId),
    };

    return this.buildResult('searchMarket', 'CONNECTED', [record], response.liveCallExecuted);
  }
}

export class CensusProviderAdapter extends BaseLiveProviderAdapter {
  constructor(options = {}) {
    super({ ...options, providerId: 'census' });
  }

  async searchMarket(query = {}) {
    const response = await this.fetchJson('/census', query);
    if (!response.ok) return createUnknownResult('searchMarket', this.providerId, response.status);

    const source = normalizeObject(response.payload);
    const record = {
      population: safeNumber(source.population, null) ?? 'UNKNOWN',
      income: safeNumber(source.income, null) ?? 'UNKNOWN',
      housing: safeNumber(source.housing, null) ?? 'UNKNOWN',
      occupancy: safeString(source.occupancy),
      growth: safeString(source.growth),
      demographics: normalizeObject(source.demographics),
      ...createReviewEnvelope(this.providerId),
    };

    return this.buildResult('searchMarket', 'CONNECTED', [record], response.liveCallExecuted);
  }
}

export class GoogleMapsProviderAdapter extends BaseLiveProviderAdapter {
  constructor(options = {}) {
    super({ ...options, providerId: 'google-maps' });
  }

  async searchProperty(query = {}) {
    const response = await this.fetchJson('/geocode', query);
    if (!response.ok) return createUnknownResult('searchProperty', this.providerId, response.status);

    const source = normalizeObject(response.payload);
    const record = {
      geocodedAddress: safeString(source.geocodedAddress),
      addressValidation: safeString(source.addressValidation),
      coordinates: {
        lat: safeNumber(source?.coordinates?.lat, null) ?? 'UNKNOWN',
        lng: safeNumber(source?.coordinates?.lng, null) ?? 'UNKNOWN',
      },
      streetViewReference: safeString(source.streetViewReference),
      placeId: safeString(source.placeId),
      drivingDistance: safeString(source.drivingDistance),
      walkingDistance: safeString(source.walkingDistance),
      ...createReviewEnvelope(this.providerId),
    };

    return this.buildResult('searchProperty', 'CONNECTED', [record], response.liveCallExecuted);
  }

  async searchMedia(query = {}) {
    const response = await this.fetchJson('/media-ref', query);
    if (!response.ok) return createUnknownResult('searchMedia', this.providerId, response.status);

    const source = normalizeObject(response.payload);
    const record = {
      mediaType: 'STREET_VIEW_REFERENCE',
      source: 'Google Maps',
      licenseStatus: safeString(source.licenseStatus, 'REVIEW_REQUIRED'),
      copyrightStatus: safeString(source.copyrightStatus, 'REVIEW_REQUIRED'),
      retrievalDate: nowIso(),
      usageRestrictions: safeString(source.usageRestrictions, 'REFERENCE_ONLY_NO_IMAGE_STORAGE'),
      reviewRequired: true,
      imageStored: false,
      imageryReference: safeString(source.imageryReference),
      ...createReviewEnvelope(this.providerId),
    };

    return this.buildResult('searchMedia', 'CONNECTED', [record], response.liveCallExecuted, ['No copyrighted imagery is stored in RSOS.']);
  }
}

export function validateMediaRights(input = {}) {
  const normalized = normalizeObject(input);
  return {
    source: safeString(normalized.source),
    licenseStatus: safeString(normalized.licenseStatus, 'UNKNOWN'),
    copyrightStatus: safeString(normalized.copyrightStatus, 'UNKNOWN'),
    retrievalDate: safeString(normalized.retrievalDate, nowIso()),
    usageRestrictions: safeString(normalized.usageRestrictions, 'UNKNOWN'),
    reviewRequired: true,
    advisoryOnly: true,
  };
}

export function createProviderReviewQueue() {
  const queue = [];

  return {
    enqueue(providerId, payload = {}) {
      const envelope = createReviewEnvelope(providerId, payload);
      const item = {
        ...normalizeObject(payload),
        ...envelope,
      };
      queue.push(item);
      return item;
    },

    list() {
      return queue.slice();
    },

    listPending() {
      return queue.filter((item) => item.reviewStatus === 'PENDING_REVIEW');
    },

    approve(reviewId, reviewer = 'UNKNOWN') {
      const item = queue.find((entry) => entry.reviewId === reviewId);
      if (!item) return null;
      item.reviewStatus = 'APPROVED';
      item.approvedBy = safeString(reviewer);
      item.approvedAt = nowIso();
      item.autoApproved = false;
      return item;
    },

    reject(reviewId, reviewer = 'UNKNOWN', reason = 'UNKNOWN') {
      const item = queue.find((entry) => entry.reviewId === reviewId);
      if (!item) return null;
      item.reviewStatus = 'REJECTED';
      item.rejectedBy = safeString(reviewer);
      item.rejectedAt = nowIso();
      item.rejectionReason = safeString(reason);
      item.autoApproved = false;
      return item;
    },

    summary() {
      return {
        total: queue.length,
        pending: queue.filter((item) => item.reviewStatus === 'PENDING_REVIEW').length,
        approved: queue.filter((item) => item.reviewStatus === 'APPROVED').length,
        rejected: queue.filter((item) => item.reviewStatus === 'REJECTED').length,
        autoApproved: 0,
        advisoryOnly: true,
      };
    },
  };
}

export function buildProviderStatusDashboard(payload = {}) {
  const registry = normalizeObject(payload.registry);
  const providers = normalizeArray(registry.providers);
  const vault = payload.vault;
  const syncEngine = payload.syncEngine;
  const audit = payload.audit;

  const auditRecords = normalizeArray(audit?.list ? audit.list() : []);

  return providers.map((provider) => {
    const normalized = normalizeObject(provider);
    const providerId = safeString(normalized.providerId, 'UNKNOWN');
    const credential = vault?.getCredentialStatus ? vault.getCredentialStatus(providerId) : { credentialStatus: 'UNKNOWN' };
    const credentialStatus = safeString(credential.credentialStatus, 'UNKNOWN');

    const providerAudit = auditRecords
      .filter((entry) => safeString(entry.providerId) === providerId && safeString(entry.status).toUpperCase() === 'SUCCESS')
      .sort((left, right) => safeString(right.timestamp).localeCompare(safeString(left.timestamp)))[0];

    return {
      providerId,
      name: safeString(normalized.name, 'UNKNOWN'),
      connected: credentialStatus === 'CONFIGURED' && Boolean(normalized.enabled),
      needsCredentials: credentialStatus !== 'CONFIGURED',
      unavailable: credentialStatus === 'UNKNOWN',
      licensed: normalizeArray(normalized.licenseRequirements).length > 0,
      ready: credentialStatus === 'CONFIGURED' && Boolean(normalized.enabled),
      syncStatus: safeString(syncEngine?.getState ? syncEngine.getState().status : 'UNKNOWN'),
      lastSuccessfulSync: providerAudit ? safeString(providerAudit.timestamp) : 'UNKNOWN',
      advisoryOnly: true,
    };
  });
}

export function createProductionProviderAdapters(options = {}) {
  const credentials = normalizeObject(options.credentials);
  const baseUrls = normalizeObject(options.baseUrls);
  const fetchImpl = options.fetchImpl || globalThis.fetch;

  return {
    countyProperty: new CountyPropertyProviderAdapter({
      credentials: normalizeObject(credentials['county-assessor']),
      baseUrl: safeString(baseUrls['county-assessor'], ''),
      fetchImpl,
    }),
    countyRecorder: new CountyRecorderProviderAdapter({
      credentials: normalizeObject(credentials['county-recorder']),
      baseUrl: safeString(baseUrls['county-recorder'], ''),
      fetchImpl,
    }),
    permit: new PermitProviderAdapter({
      credentials: normalizeObject(credentials['permit-records']),
      baseUrl: safeString(baseUrls['permit-records'], ''),
      fetchImpl,
    }),
    fema: new FemaProviderAdapter({
      credentials: normalizeObject(credentials.fema),
      baseUrl: safeString(baseUrls.fema, ''),
      fetchImpl,
    }),
    census: new CensusProviderAdapter({
      credentials: normalizeObject(credentials.census),
      baseUrl: safeString(baseUrls.census, ''),
      fetchImpl,
    }),
    googleMaps: new GoogleMapsProviderAdapter({
      credentials: normalizeObject(credentials['google-maps']),
      baseUrl: safeString(baseUrls['google-maps'], ''),
      fetchImpl,
    }),
  };
}
