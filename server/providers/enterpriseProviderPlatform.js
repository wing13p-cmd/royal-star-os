import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {
  createProductionProviderAdapters,
  buildProviderStatusDashboard,
  createProviderReviewQueue,
  validateMediaRights,
} from './enterpriseLiveProviderEngine.js';
import { createEnterpriseProviderControlLayer } from './enterpriseProviderControlLayer.js';

const DEFAULT_VAULT_PATH = path.join(process.cwd(), 'server', 'data', 'enterprise-provider-vault.enc.json');
const DEFAULT_VAULT_KEY_ENV = 'RSOS_PROVIDER_VAULT_KEY';

const DEFAULT_PROVIDER_DEFINITIONS = [
  { providerId: 'mls', name: 'MLS', category: 'listing-data', priority: 10, licenseRequirements: ['MLS display attribution required'] },
  { providerId: 'attom', name: 'ATTOM', category: 'property-data', priority: 9, licenseRequirements: ['Commercial license agreement required'] },
  { providerId: 'rentcast', name: 'RentCast', category: 'rental-data', priority: 9, licenseRequirements: ['API agreement and attribution required'] },
  { providerId: 'corelogic', name: 'CoreLogic', category: 'property-data', priority: 9, licenseRequirements: ['Enterprise data license required'] },
  { providerId: 'google-maps', name: 'Google Maps', category: 'mapping', priority: 8, licenseRequirements: ['Maps API terms and attribution required'] },
  { providerId: 'county-assessor', name: 'County Assessor', category: 'public-records', priority: 8, licenseRequirements: ['County data usage terms required'] },
  { providerId: 'county-recorder', name: 'County Recorder', category: 'public-records', priority: 8, licenseRequirements: ['Recorder office usage terms required'] },
  { providerId: 'permit-records', name: 'Permit Records', category: 'permits', priority: 8, licenseRequirements: ['Permit data usage policy required'] },
  { providerId: 'census', name: 'Census', category: 'demographics', priority: 7, licenseRequirements: ['Open data citation required'] },
  { providerId: 'fema', name: 'FEMA', category: 'risk-data', priority: 7, licenseRequirements: ['FEMA map attribution required'] },
  { providerId: 'school-data', name: 'School Data', category: 'demographics', priority: 7, licenseRequirements: ['District/source attribution required'] },
  { providerId: 'crime-data', name: 'Crime Data', category: 'risk-data', priority: 7, licenseRequirements: ['Provider usage policy required'] },
  { providerId: 'mortgage-rates', name: 'Mortgage Rates', category: 'finance', priority: 7, licenseRequirements: ['Rate provider terms required'] },
  { providerId: 'property-tax', name: 'Property Tax', category: 'tax-data', priority: 7, licenseRequirements: ['Tax data source attribution required'] },
  { providerId: 'auction-data', name: 'Auction Data', category: 'distressed-data', priority: 7, licenseRequirements: ['Auction feed license required'] },
  { providerId: 'foreclosure-data', name: 'Foreclosure Data', category: 'distressed-data', priority: 7, licenseRequirements: ['Foreclosure feed license required'] },
];

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

function createRateLimitShape() {
  return {
    windowSeconds: 'UNKNOWN',
    maxRequestsPerWindow: 'UNKNOWN',
    remainingRequests: 'UNKNOWN',
    resetAt: 'UNKNOWN',
  };
}

function buildProviderRecord(definition = {}, overrides = {}) {
  const normalizedDef = normalizeObject(definition);
  const normalizedOverrides = normalizeObject(overrides);

  return {
    providerId: safeString(normalizedDef.providerId).toLowerCase(),
    name: safeString(normalizedDef.name),
    category: safeString(normalizedDef.category),
    connectionStatus: 'DISCONNECTED',
    credentialStatus: 'EMPTY',
    healthStatus: 'UNKNOWN',
    lastSync: 'UNKNOWN',
    rateLimits: createRateLimitShape(),
    licenseRequirements: normalizeArray(normalizedDef.licenseRequirements),
    enabled: false,
    priority: safeNumber(normalizedOverrides.priority ?? normalizedDef.priority, 5),
    advisoryOnly: true,
    liveRequestsAllowed: false,
  };
}

export function createEnterpriseProviderRegistry(options = {}) {
  const userDefinedProviders = normalizeArray(options.userDefinedProviders);
  const records = [];

  DEFAULT_PROVIDER_DEFINITIONS.forEach((provider) => {
    records.push(buildProviderRecord(provider));
  });

  userDefinedProviders.forEach((provider, index) => {
    const normalized = normalizeObject(provider);
    const providerId = safeString(normalized.providerId || normalized.name || `user-provider-${index + 1}`).toLowerCase();
    records.push(buildProviderRecord({
      providerId,
      name: safeString(normalized.name || providerId),
      category: safeString(normalized.category, 'user-defined'),
      priority: safeNumber(normalized.priority, 6),
      licenseRequirements: normalizeArray(normalized.licenseRequirements),
    }));
  });

  const deduped = new Map();
  records.forEach((record) => {
    deduped.set(record.providerId, record);
  });

  return {
    advisoryOnly: true,
    liveRequestsAllowed: false,
    generatedAt: new Date().toISOString(),
    providers: Array.from(deduped.values()).sort((left, right) => right.priority - left.priority),
  };
}

function buildAdapterPlaceholder(methodName, providerId, query = {}) {
  return {
    method: methodName,
    providerId: safeString(providerId).toLowerCase(),
    status: 'DISABLED_REVIEW_ONLY',
    reviewStatus: 'REVIEW_REQUIRED',
    query: normalizeObject(query),
    records: [],
    warnings: ['Provider implementation is disabled pending credential and licensing review.'],
    unknowns: ['Provider responses are UNKNOWN until manually enabled and validated.'],
    advisoryOnly: true,
    liveRequestsAllowed: false,
    timestamp: new Date().toISOString(),
  };
}

export class UniversalProviderAdapter {
  constructor(options = {}) {
    this.providerId = safeString(options.providerId || 'manual').toLowerCase();
  }

  searchProperty(query = {}) {
    return buildAdapterPlaceholder('searchProperty', this.providerId, query);
  }

  searchComps(query = {}) {
    return buildAdapterPlaceholder('searchComps', this.providerId, query);
  }

  searchRent(query = {}) {
    return buildAdapterPlaceholder('searchRent', this.providerId, query);
  }

  searchMarket(query = {}) {
    return buildAdapterPlaceholder('searchMarket', this.providerId, query);
  }

  searchOwner(query = {}) {
    return buildAdapterPlaceholder('searchOwner', this.providerId, query);
  }

  searchParcel(query = {}) {
    return buildAdapterPlaceholder('searchParcel', this.providerId, query);
  }

  searchPermits(query = {}) {
    return buildAdapterPlaceholder('searchPermits', this.providerId, query);
  }

  searchTax(query = {}) {
    return buildAdapterPlaceholder('searchTax', this.providerId, query);
  }

  searchMedia(query = {}) {
    return buildAdapterPlaceholder('searchMedia', this.providerId, query);
  }
}

function ensureDirForFile(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function deriveKey(secret, salt) {
  return crypto.scryptSync(secret, Buffer.from(salt, 'hex'), 32);
}

function encryptPayload(secret, payload = {}) {
  const salt = crypto.randomBytes(16).toString('hex');
  const iv = crypto.randomBytes(12);
  const key = deriveKey(secret, salt);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const plaintext = Buffer.from(JSON.stringify(payload), 'utf8');
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();

  return {
    version: 1,
    salt,
    iv: iv.toString('hex'),
    tag: tag.toString('hex'),
    ciphertext: ciphertext.toString('hex'),
    updatedAt: new Date().toISOString(),
  };
}

function decryptPayload(secret, encrypted = {}) {
  const iv = Buffer.from(safeString(encrypted.iv, ''), 'hex');
  const tag = Buffer.from(safeString(encrypted.tag, ''), 'hex');
  const ciphertext = Buffer.from(safeString(encrypted.ciphertext, ''), 'hex');
  const key = deriveKey(secret, safeString(encrypted.salt, ''));
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
  return JSON.parse(plaintext);
}

function normalizeCredentialRecord(providerId, authType, values = {}) {
  const normalizedValues = normalizeObject(values);
  const filledValueCount = Object.values(normalizedValues).filter((value) => safeString(value, '') !== '').length;
  return {
    providerId: safeString(providerId).toLowerCase(),
    authType: safeString(authType, 'ENV_VAR'),
    configured: filledValueCount > 0,
    valueCount: filledValueCount,
    values: normalizedValues,
    updatedAt: new Date().toISOString(),
  };
}

export class EncryptedCredentialVault {
  constructor(options = {}) {
    this.filePath = safeString(options.filePath, DEFAULT_VAULT_PATH);
    this.keyEnvName = safeString(options.keyEnvName, DEFAULT_VAULT_KEY_ENV);
    const env = normalizeObject(options.env || process.env);
    const configuredSecret = safeString(options.masterSecret || env[this.keyEnvName], '');

    this.masterSecret = configuredSecret || crypto.randomBytes(32).toString('hex');
    this.keySource = configuredSecret ? 'ENV_OR_CONFIG' : 'EPHEMERAL_RUNTIME';
    this.state = { version: 1, credentials: {}, updatedAt: new Date().toISOString() };

    this.load();
  }

  load() {
    try {
      const content = fs.readFileSync(this.filePath, 'utf8');
      const encrypted = JSON.parse(content);
      const decrypted = decryptPayload(this.masterSecret, encrypted);
      const parsed = normalizeObject(decrypted);
      this.state = {
        version: 1,
        credentials: normalizeObject(parsed.credentials),
        updatedAt: safeString(parsed.updatedAt, new Date().toISOString()),
      };
    } catch {
      this.state = { version: 1, credentials: {}, updatedAt: new Date().toISOString() };
    }
    return this.state;
  }

  save() {
    ensureDirForFile(this.filePath);
    const encrypted = encryptPayload(this.masterSecret, this.state);
    fs.writeFileSync(this.filePath, JSON.stringify(encrypted, null, 2));
    return { ok: true, filePath: this.filePath };
  }

  setCredential(providerId, authType, values = {}) {
    const allowedAuthTypes = ['API_KEY', 'OAUTH', 'BEARER_TOKEN', 'BASIC_AUTH', 'ENV_VAR'];
    const normalizedAuthType = safeString(authType, 'ENV_VAR').toUpperCase();
    if (!allowedAuthTypes.includes(normalizedAuthType)) {
      return { ok: false, error: 'UNSUPPORTED_AUTH_TYPE' };
    }

    const record = normalizeCredentialRecord(providerId, normalizedAuthType, values);
    this.state.credentials[record.providerId] = record;
    this.state.updatedAt = new Date().toISOString();
    this.save();

    return { ok: true, providerId: record.providerId, credentialStatus: record.configured ? 'CONFIGURED' : 'EMPTY' };
  }

  clearCredential(providerId) {
    const key = safeString(providerId).toLowerCase();
    delete this.state.credentials[key];
    this.state.updatedAt = new Date().toISOString();
    this.save();
    return { ok: true, providerId: key, credentialStatus: 'EMPTY' };
  }

  getCredentialStatus(providerId) {
    const key = safeString(providerId).toLowerCase();
    const record = this.state.credentials[key];
    if (!record) {
      return {
        providerId: key,
        credentialStatus: 'EMPTY',
        authType: 'UNKNOWN',
        configured: false,
        valueCount: 0,
      };
    }

    return {
      providerId: key,
      credentialStatus: record.configured ? 'CONFIGURED' : 'EMPTY',
      authType: safeString(record.authType, 'UNKNOWN'),
      configured: Boolean(record.configured),
      valueCount: safeNumber(record.valueCount, 0),
      updatedAt: safeString(record.updatedAt, 'UNKNOWN'),
    };
  }

  getSummary() {
    const providers = Object.keys(this.state.credentials);
    return {
      encrypted: true,
      keySource: this.keySource,
      filePath: this.filePath,
      providerCount: providers.length,
      providers,
      advisoryOnly: true,
    };
  }
}

function createSyncAuditRecord(entry = {}) {
  const normalized = normalizeObject(entry);
  return {
    providerId: safeString(normalized.providerId, 'UNKNOWN'),
    syncMode: safeString(normalized.syncMode, 'UNKNOWN'),
    status: safeString(normalized.status, 'UNKNOWN'),
    recordsRetrieved: safeNumber(normalized.recordsRetrieved, 0),
    errors: normalizeArray(normalized.errors),
    warnings: normalizeArray(normalized.warnings),
    credentialState: safeString(normalized.credentialState, 'UNKNOWN'),
    syncDurationMs: safeNumber(normalized.syncDurationMs, 0),
    timestamp: safeString(normalized.timestamp, new Date().toISOString()),
  };
}

export function createSyncEngine(options = {}) {
  const registry = normalizeObject(options.registry);
  const providers = normalizeArray(registry.providers);
  const isEnabled = providers.some((provider) => Boolean(provider.enabled));

  const state = {
    enabled: isEnabled,
    status: isEnabled ? 'READY' : 'DISABLED_UNTIL_PROVIDER_ENABLEMENT',
    retryQueue: [],
    auditLog: [],
    lastSyncAt: 'UNKNOWN',
  };

  function appendAudit(entry = {}) {
    const record = createSyncAuditRecord(entry);
    state.auditLog.push(record);
    state.lastSyncAt = record.timestamp;
    if (state.auditLog.length > 200) {
      state.auditLog.splice(0, state.auditLog.length - 200);
    }
    return record;
  }

  return {
    getState() {
      return {
        enabled: state.enabled,
        status: state.status,
        retryQueueDepth: state.retryQueue.length,
        auditEntries: state.auditLog.length,
        lastSyncAt: state.lastSyncAt,
      };
    },

    buildSyncPlan(payload = {}) {
      const normalized = normalizeObject(payload);
      const mode = safeString(normalized.mode, 'MANUAL_SYNC').toUpperCase();
      const supportedModes = ['MANUAL_SYNC', 'SCHEDULED_SYNC', 'INCREMENTAL_SYNC', 'FULL_REFRESH'];
      if (!supportedModes.includes(mode)) {
        return { ok: false, status: 'INVALID_MODE', mode };
      }
      if (!state.enabled) {
        appendAudit({ providerId: safeString(normalized.providerId, 'UNKNOWN'), syncMode: mode, status: 'BLOCKED', warnings: ['Sync is disabled until providers are enabled and approved.'] });
        return {
          ok: false,
          status: 'SYNC_DISABLED',
          mode,
          retryQueueDepth: state.retryQueue.length,
          advisoryOnly: true,
        };
      }

      appendAudit({ providerId: safeString(normalized.providerId, 'UNKNOWN'), syncMode: mode, status: 'PLANNED' });
      return {
        ok: true,
        status: 'PLANNED_REVIEW_ONLY',
        mode,
        syncStrategy: mode,
        advisoryOnly: true,
      };
    },

    enqueueRetry(item = {}) {
      const normalized = normalizeObject(item);
      state.retryQueue.push({
        providerId: safeString(normalized.providerId, 'UNKNOWN'),
        reason: safeString(normalized.reason, 'UNKNOWN'),
        attempts: safeNumber(normalized.attempts, 0),
        nextAttemptAt: safeString(normalized.nextAttemptAt, 'UNKNOWN'),
      });
      return { ok: true, retryQueueDepth: state.retryQueue.length };
    },

    detectConflicts(localRecords = [], remoteRecords = [], keyField = 'id') {
      const local = normalizeArray(localRecords);
      const remote = normalizeArray(remoteRecords);
      const conflicts = [];
      const remoteMap = new Map(remote.map((record) => [safeString(record?.[keyField], ''), normalizeObject(record)]));

      local.forEach((record) => {
        const localRecord = normalizeObject(record);
        const key = safeString(localRecord[keyField], '');
        if (!key) return;
        const remoteRecord = remoteMap.get(key);
        if (!remoteRecord) return;

        const localUpdatedAt = safeString(localRecord.updatedAt, '');
        const remoteUpdatedAt = safeString(remoteRecord.updatedAt, '');
        const localFingerprint = JSON.stringify(localRecord);
        const remoteFingerprint = JSON.stringify(remoteRecord);

        if (localFingerprint !== remoteFingerprint && localUpdatedAt && remoteUpdatedAt && localUpdatedAt !== remoteUpdatedAt) {
          conflicts.push({
            key,
            localUpdatedAt,
            remoteUpdatedAt,
            status: 'CONFLICT_REVIEW_REQUIRED',
          });
        }
      });

      return {
        conflictCount: conflicts.length,
        conflicts,
        advisoryOnly: true,
      };
    },

    getAuditLog() {
      return state.auditLog.slice();
    },
  };
}

function normalizeMediaRecord(input = {}) {
  const normalized = normalizeObject(input);
  return {
    mediaId: safeString(normalized.mediaId || normalized.id || `media-${Date.now()}`),
    mediaType: safeString(normalized.mediaType, 'UNKNOWN'),
    source: safeString(normalized.source, 'UNKNOWN'),
    license: safeString(normalized.license, 'UNKNOWN'),
    copyright: safeString(normalized.copyright, 'UNKNOWN'),
    retrievalDate: safeString(normalized.retrievalDate, new Date().toISOString()),
    reviewStatus: safeString(normalized.reviewStatus, 'REVIEW_REQUIRED'),
    advisoryOnly: true,
  };
}

export function createMediaManager() {
  const records = [];

  return {
    registerMediaRecord(input = {}) {
      const record = normalizeMediaRecord(input);
      records.push(record);
      return record;
    },

    listMediaRecords() {
      return records.slice();
    },
  };
}

function normalizeAddress(source = {}) {
  const normalized = normalizeObject(source);
  return {
    line1: safeString(normalized.line1 || normalized.address1 || normalized.street || normalized.address),
    line2: safeString(normalized.line2 || normalized.unit, 'UNKNOWN'),
    city: safeString(normalized.city),
    state: safeString(normalized.state),
    postalCode: safeString(normalized.postalCode || normalized.zipCode || normalized.zip),
    county: safeString(normalized.county),
  };
}

function normalizeOwner(source = {}) {
  const normalized = normalizeObject(source);
  return {
    name: safeString(normalized.name || normalized.ownerName),
    entityType: safeString(normalized.entityType || normalized.ownerType, 'UNKNOWN'),
    mailingAddress: normalizeAddress(normalized.mailingAddress || normalized),
    occupancyStatus: safeString(normalized.occupancyStatus, 'UNKNOWN'),
  };
}

function normalizeParcel(source = {}) {
  const normalized = normalizeObject(source);
  return {
    apn: safeString(normalized.apn || normalized.parcelNumber),
    lotSizeSqFt: safeNumber(normalized.lotSizeSqFt || normalized.lotSize, null) ?? 'UNKNOWN',
    zoning: safeString(normalized.zoning),
    legalDescription: safeString(normalized.legalDescription),
    geometryRef: safeString(normalized.geometryRef, 'UNKNOWN'),
  };
}

function normalizeTax(source = {}) {
  const normalized = normalizeObject(source);
  return {
    assessedValue: safeNumber(normalized.assessedValue, null) ?? 'UNKNOWN',
    annualTax: safeNumber(normalized.annualTax || normalized.propertyTax, null) ?? 'UNKNOWN',
    delinquent: typeof normalized.delinquent === 'boolean' ? normalized.delinquent : 'UNKNOWN',
    taxYear: safeString(normalized.taxYear),
  };
}

function normalizeMls(source = {}) {
  const normalized = normalizeObject(source);
  return {
    listingId: safeString(normalized.listingId || normalized.mlsId),
    status: safeString(normalized.status),
    listPrice: safeNumber(normalized.listPrice, null) ?? 'UNKNOWN',
    daysOnMarket: safeNumber(normalized.daysOnMarket, null) ?? 'UNKNOWN',
  };
}

function normalizeRental(source = {}) {
  const normalized = normalizeObject(source);
  return {
    estimatedRent: safeNumber(normalized.estimatedRent, null) ?? 'UNKNOWN',
    rentRangeLow: safeNumber(normalized.rentRangeLow, null) ?? 'UNKNOWN',
    rentRangeHigh: safeNumber(normalized.rentRangeHigh, null) ?? 'UNKNOWN',
    vacancyTrend: safeString(normalized.vacancyTrend),
  };
}

function normalizeMarket(source = {}) {
  const normalized = normalizeObject(source);
  return {
    medianPrice: safeNumber(normalized.medianPrice, null) ?? 'UNKNOWN',
    inventoryMonths: safeNumber(normalized.inventoryMonths, null) ?? 'UNKNOWN',
    appreciationRate: safeNumber(normalized.appreciationRate, null) ?? 'UNKNOWN',
    confidence: safeString(normalized.confidence, 'UNKNOWN'),
  };
}

function normalizePermit(source = {}) {
  const normalized = normalizeObject(source);
  return {
    permitId: safeString(normalized.permitId || normalized.id),
    permitType: safeString(normalized.permitType || normalized.type),
    status: safeString(normalized.status),
    issuedDate: safeString(normalized.issuedDate),
  };
}

export function normalizeEnterpriseProviderData(payload = {}) {
  const normalized = normalizeObject(payload);

  return {
    schemaVersion: 'rsos-canonical-v1',
    reviewStatus: 'REVIEW_REQUIRED',
    advisoryOnly: true,
    sourceProvider: safeString(normalized.sourceProvider),
    address: normalizeAddress(normalized.address),
    owner: normalizeOwner(normalized.owner),
    parcel: normalizeParcel(normalized.parcel),
    tax: normalizeTax(normalized.tax),
    mls: normalizeMls(normalized.mls),
    rental: normalizeRental(normalized.rental),
    market: normalizeMarket(normalized.market),
    media: normalizeMediaRecord(normalized.media),
    permit: normalizePermit(normalized.permit),
  };
}

export function createEnterpriseProviderAudit() {
  const records = [];

  return {
    log(entry = {}) {
      const record = createSyncAuditRecord(entry);
      records.push(record);
      if (records.length > 500) {
        records.splice(0, records.length - 500);
      }
      return record;
    },

    list() {
      return records.slice();
    },

    summary() {
      return {
        totalEntries: records.length,
        latestTimestamp: records.length ? records[records.length - 1].timestamp : 'UNKNOWN',
        errors: records.reduce((sum, record) => sum + normalizeArray(record.errors).length, 0),
        warnings: records.reduce((sum, record) => sum + normalizeArray(record.warnings).length, 0),
        advisoryOnly: true,
      };
    },
  };
}

export function buildProviderDiagnostics(payload = {}) {
  const registry = normalizeObject(payload.registry);
  const vault = payload.vault;
  const syncEngine = payload.syncEngine;

  const providers = normalizeArray(registry.providers).map((provider) => {
    const record = normalizeObject(provider);
    const credential = vault?.getCredentialStatus ? vault.getCredentialStatus(record.providerId) : { credentialStatus: 'UNKNOWN' };
    return {
      providerId: safeString(record.providerId),
      name: safeString(record.name),
      connectionHealth: safeString(record.connectionStatus, 'UNKNOWN'),
      syncHealth: syncEngine?.getState ? safeString(syncEngine.getState().status, 'UNKNOWN') : 'UNKNOWN',
      credentialStatus: safeString(credential.credentialStatus, 'UNKNOWN'),
      licenseStatus: normalizeArray(record.licenseRequirements).length ? 'REVIEW_REQUIRED' : 'UNKNOWN',
      providerPriority: safeNumber(record.priority, 0),
      enabled: Boolean(record.enabled),
      advisoryOnly: true,
    };
  });

  return {
    advisoryOnly: true,
    providerDashboard: providers,
    syncHealth: syncEngine?.getState ? syncEngine.getState() : { status: 'UNKNOWN' },
    credentialVault: vault?.getSummary ? vault.getSummary() : { encrypted: 'UNKNOWN' },
  };
}

export function createEnterpriseProviderPlatform(options = {}) {
  const registry = createEnterpriseProviderRegistry({ userDefinedProviders: options.userDefinedProviders });
  const vault = new EncryptedCredentialVault({
    filePath: options.vaultFilePath,
    masterSecret: options.masterSecret,
    env: options.env,
    keyEnvName: options.keyEnvName,
  });
  const syncEngine = createSyncEngine({ registry });
  const mediaManager = createMediaManager();
  const audit = createEnterpriseProviderAudit();
  const reviewQueue = createProviderReviewQueue();
  const providerAdapters = createProductionProviderAdapters({
    credentials: options.credentials,
    baseUrls: options.baseUrls,
    fetchImpl: options.fetchImpl,
  });
  const controlLayer = createEnterpriseProviderControlLayer({
    version: safeString(options.version, 'phase10-batch3-v1'),
    registry,
    vault,
    backupDir: options.backupDir,
    activeProviders: normalizeArray(options.activeProviders),
  });

  function importIntoReviewQueue(providerId, records = []) {
    const normalizedProviderId = safeString(providerId, 'UNKNOWN').toLowerCase();
    const imported = normalizeArray(records).map((record) => reviewQueue.enqueue(normalizedProviderId, normalizeObject(record)));
    imported.forEach((record) => {
      controlLayer.reviewQueue.enqueue('New Provider Record', {
        assignedTo: 'Brandon Sterling',
        priority: 'HIGH',
        providerId: normalizedProviderId,
        record,
      });
      controlLayer.audit.log({
        eventType: 'imported_record',
        entity: 'provider-import',
        entityId: safeString(record.reviewId),
        provider: normalizedProviderId,
        proposedValue: record,
        status: 'PENDING_REVIEW',
      });
    });
    return imported;
  }

  function providerStatusDashboard() {
    return buildProviderStatusDashboard({ registry, vault, syncEngine, audit });
  }

  return {
    advisoryOnly: true,
    liveRequestsAllowed: false,
    registry,
    providerAdapters,
    controlLayer,
    universalAdapterFactory(providerId) {
      return new UniversalProviderAdapter({ providerId });
    },
    credentialVault: vault,
    syncEngine,
    mediaManager,
    validateMediaRights,
    normalizeEnterpriseProviderData,
    audit,
    reviewQueue,
    importIntoReviewQueue,
    providerStatusDashboard,
    diagnostics() {
      return {
        ...buildProviderDiagnostics({ registry, vault, syncEngine }),
        providerStatusDashboard: providerStatusDashboard(),
        reviewQueue: reviewQueue.summary(),
        providerMonitor: controlLayer.monitor.list(),
        syncOperations: controlLayer.sync.list(),
        scheduledJobs: controlLayer.scheduler.list(),
        dataGovernanceReviewQueue: controlLayer.reviewQueue.summary(),
        rateLimitUsage: controlLayer.usageMonitor.list(),
        outageState: controlLayer.outage.listOutages(),
        cacheState: controlLayer.cache.list(),
      };
    },
  };
}
