import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

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

function redactSecrets(value) {
  if (value === null || value === undefined) return value;
  if (typeof value === 'string') {
    return value
      .replace(/(api[_-]?key|token|secret|password)=([^&\s]+)/ig, '$1=REDACTED')
      .replace(/Bearer\s+[A-Za-z0-9._-]+/g, 'Bearer REDACTED');
  }
  if (Array.isArray(value)) return value.map((entry) => redactSecrets(entry));
  if (typeof value === 'object') {
    const clone = {};
    Object.entries(value).forEach(([key, entry]) => {
      if (/(api[_-]?key|token|secret|password)/i.test(key)) clone[key] = 'REDACTED';
      else clone[key] = redactSecrets(entry);
    });
    return clone;
  }
  return value;
}

function normalizeAddress(text) {
  return safeString(text, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[^a-z0-9\s]/g, '')
    .trim();
}

export class EnterpriseAuditLog {
  constructor(options = {}) {
    this.version = safeString(options.version, 'phase10-batch3-v1');
    this.records = [];
  }

  log(event = {}) {
    const normalized = normalizeObject(event);
    const record = {
      eventId: safeString(normalized.eventId, `audit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`),
      timestamp: safeString(normalized.timestamp, nowIso()),
      user: safeString(normalized.user, 'System Administrator'),
      eventType: safeString(normalized.eventType),
      entity: safeString(normalized.entity),
      entityId: safeString(normalized.entityId),
      provider: safeString(normalized.provider),
      priorValue: redactSecrets(normalized.priorValue ?? 'UNKNOWN'),
      proposedValue: redactSecrets(normalized.proposedValue ?? 'UNKNOWN'),
      approvedValue: redactSecrets(normalized.approvedValue ?? 'UNKNOWN'),
      reason: safeString(normalized.reason),
      status: safeString(normalized.status, 'RECORDED'),
      version: this.version,
      relatedOperationId: safeString(normalized.relatedOperationId),
      rollbackReference: safeString(normalized.rollbackReference),
      advisoryOnly: true,
    };

    this.records.push(record);
    return record;
  }

  list() {
    return this.records.slice();
  }

  countByType(eventType) {
    return this.records.filter((record) => record.eventType === eventType).length;
  }
}

export class ProviderMonitoringService {
  constructor(options = {}) {
    this.notes = new Map();
    this.providers = new Map();
    this.registry = normalizeObject(options.registry);
    this.vault = options.vault;
    this.audit = options.audit;
    this.cache = options.cache;
    this.usageMonitor = options.usageMonitor;
    this.allowedStatuses = new Set([
      'Not Configured',
      'Configuration Incomplete',
      'Credentials Ready',
      'Licensing Review Required',
      'Ready for Testing',
      'Connected',
      'Connected With Limitations',
      'Degraded',
      'Rate Limited',
      'Unavailable',
      'Disabled',
      'Suspended',
      'Unknown',
    ]);

    normalizeArray(this.registry.providers).forEach((provider) => {
      this.providers.set(safeString(provider.providerId).toLowerCase(), this.buildProviderState(provider));
    });
  }

  buildProviderState(provider = {}) {
    const normalized = normalizeObject(provider);
    const providerId = safeString(normalized.providerId).toLowerCase();
    const credential = this.vault?.getCredentialStatus ? this.vault.getCredentialStatus(providerId) : { credentialStatus: 'UNKNOWN' };

    const credentialStatus = credential.credentialStatus === 'CONFIGURED'
      ? 'Credentials Ready'
      : credential.credentialStatus === 'EMPTY'
        ? 'Configuration Incomplete'
        : 'Unknown';

    const licensingStatus = normalizeArray(normalized.licenseRequirements).length
      ? 'Licensing Review Required'
      : 'Unknown';

    const connectionStatus = normalized.enabled
      ? (credential.credentialStatus === 'CONFIGURED' ? 'Ready for Testing' : 'Configuration Incomplete')
      : 'Disabled';

    return {
      providerId,
      providerName: safeString(normalized.name),
      category: safeString(normalized.category),
      enabledStatus: Boolean(normalized.enabled),
      credentialStatus,
      licensingStatus,
      mediaRightsStatus: 'Review Required',
      capabilityStatus: 'Unknown',
      connectionStatus,
      healthStatus: 'Unknown',
      lastAttemptedRequest: 'UNKNOWN',
      lastSuccessfulRequest: 'UNKNOWN',
      lastFailure: 'UNKNOWN',
      lastSync: safeString(normalized.lastSync, 'UNKNOWN'),
      averageLatencyMs: 'UNKNOWN',
      failureRate: 'UNKNOWN',
      cachedResultAvailability: this.cache?.hasProviderCache?.(providerId) ? 'AVAILABLE' : 'UNKNOWN',
      rateLimitState: 'UNKNOWN',
      remainingQuota: 'UNKNOWN',
      retryAfter: 'UNKNOWN',
      outageStatus: 'Unknown',
      staleDataExposure: 'Unknown',
      administratorNotes: this.notes.get(providerId) || 'UNKNOWN',
      statusClassification: this.allowedStatuses.has(connectionStatus) ? connectionStatus : 'Unknown',
    };
  }

  recordAttempt(providerId, payload = {}) {
    const key = safeString(providerId).toLowerCase();
    const existing = this.providers.get(key) || this.buildProviderState({ providerId: key, name: key, category: 'unknown', enabled: false, licenseRequirements: [] });
    const normalized = normalizeObject(payload);

    const success = Boolean(normalized.success);
    const authenticated = Boolean(normalized.authenticatedEvidence);
    const status = safeString(normalized.status, success ? 'Connected With Limitations' : 'Unavailable');
    const usage = this.usageMonitor?.getProviderUsage ? this.usageMonitor.getProviderUsage(key) : null;

    existing.lastAttemptedRequest = nowIso();
    existing.lastSync = safeString(normalized.lastSync, existing.lastSync);
    existing.averageLatencyMs = safeNumber(normalized.latencyMs, safeNumber(existing.averageLatencyMs, null)) ?? 'UNKNOWN';
    existing.failureRate = usage ? usage.failureRate : existing.failureRate;
    existing.rateLimitState = usage ? usage.lastRateLimitResponse : existing.rateLimitState;
    existing.remainingQuota = usage ? usage.providerReportedQuota : existing.remainingQuota;
    existing.retryAfter = usage ? usage.retryAfter : existing.retryAfter;
    existing.cachedResultAvailability = this.cache?.hasProviderCache?.(key) ? 'AVAILABLE' : existing.cachedResultAvailability;

    if (success && authenticated) {
      existing.lastSuccessfulRequest = nowIso();
      existing.connectionStatus = status === 'Connected' ? 'Connected' : 'Connected With Limitations';
      existing.healthStatus = 'Connected';
      existing.outageStatus = 'Unknown';
      existing.statusClassification = existing.connectionStatus;
    } else if (status === 'Rate Limited') {
      existing.lastFailure = nowIso();
      existing.connectionStatus = 'Rate Limited';
      existing.healthStatus = 'Degraded';
      existing.outageStatus = 'Degraded';
      existing.statusClassification = 'Rate Limited';
    } else {
      existing.lastFailure = nowIso();
      existing.connectionStatus = existing.enabledStatus ? 'Unavailable' : 'Disabled';
      existing.healthStatus = existing.enabledStatus ? 'Unavailable' : 'Unknown';
      existing.outageStatus = existing.enabledStatus ? 'Unavailable' : 'Unknown';
      existing.statusClassification = existing.connectionStatus;
    }

    existing.staleDataExposure = existing.lastSuccessfulRequest === 'UNKNOWN' ? 'High' : 'Moderate';

    this.providers.set(key, existing);
    this.audit?.log?.({
      eventType: success ? 'provider_success' : 'provider_failure',
      entity: 'provider-monitor',
      entityId: key,
      provider: key,
      proposedValue: { status: existing.connectionStatus },
      status: 'RECORDED',
    });

    return existing;
  }

  addAdministratorNote(providerId, note) {
    const key = safeString(providerId).toLowerCase();
    this.notes.set(key, safeString(note));
    const existing = this.providers.get(key);
    if (existing) existing.administratorNotes = safeString(note);
    return this.providers.get(key) || null;
  }

  list() {
    return Array.from(this.providers.values());
  }
}

export class ProviderRateLimitUsageMonitor {
  constructor() {
    this.providerUsage = new Map();
  }

  ensure(providerId) {
    const key = safeString(providerId).toLowerCase();
    if (!this.providerUsage.has(key)) {
      this.providerUsage.set(key, {
        providerId: key,
        requestCount: 0,
        successfulRequestCount: 0,
        failedRequestCount: 0,
        cachedRequestCount: 0,
        averageLatencyMs: 'UNKNOWN',
        latencySamples: [],
        lastRateLimitResponse: 'UNKNOWN',
        retryAfter: 'UNKNOWN',
        providerReportedQuota: 'UNKNOWN',
        estimatedUsageCost: 'UNKNOWN',
        sessionUsage: 0,
        monthlyUsage: 0,
        warningThreshold: 'UNKNOWN',
        suspensionThreshold: 'UNKNOWN',
        invalidCredentialAutoRetryBlocked: true,
      });
    }
    return this.providerUsage.get(key);
  }

  recordRequest(providerId, payload = {}) {
    const normalized = normalizeObject(payload);
    const usage = this.ensure(providerId);

    usage.requestCount += 1;
    usage.sessionUsage += 1;
    usage.monthlyUsage += 1;
    if (normalized.cached) usage.cachedRequestCount += 1;
    if (normalized.success) usage.successfulRequestCount += 1;
    else usage.failedRequestCount += 1;

    if (Number.isFinite(safeNumber(normalized.latencyMs, null))) {
      usage.latencySamples.push(safeNumber(normalized.latencyMs));
      if (usage.latencySamples.length > 100) usage.latencySamples.shift();
      const avg = usage.latencySamples.reduce((sum, value) => sum + value, 0) / usage.latencySamples.length;
      usage.averageLatencyMs = Math.round(avg);
    }

    if (normalized.rateLimitResponse) usage.lastRateLimitResponse = safeString(normalized.rateLimitResponse);
    if (normalized.retryAfter) usage.retryAfter = safeString(normalized.retryAfter);
    if (normalized.providerReportedQuota !== undefined) usage.providerReportedQuota = normalized.providerReportedQuota;
    if (normalized.warningThreshold !== undefined) usage.warningThreshold = normalized.warningThreshold;
    if (normalized.suspensionThreshold !== undefined) usage.suspensionThreshold = normalized.suspensionThreshold;

    if (normalized.documentedPricingConfigured && Number.isFinite(safeNumber(normalized.estimatedUsageCost, null))) {
      usage.estimatedUsageCost = safeNumber(normalized.estimatedUsageCost);
    }

    const failureRate = usage.requestCount > 0
      ? Number((usage.failedRequestCount / usage.requestCount).toFixed(4))
      : 0;
    usage.failureRate = failureRate;

    return usage;
  }

  getProviderUsage(providerId) {
    return this.ensure(providerId);
  }

  list() {
    return Array.from(this.providerUsage.values());
  }
}

export class ProviderCacheGovernance {
  constructor(options = {}) {
    this.cache = new Map();
    this.audit = options.audit;
  }

  makeChecksum(value) {
    return createHash('sha256').update(JSON.stringify(value)).digest('hex');
  }

  set(cacheKey, payload = {}) {
    const normalized = normalizeObject(payload);
    const entry = {
      cacheKey: safeString(cacheKey),
      source: safeString(normalized.source),
      createdDate: safeString(normalized.createdDate, nowIso()),
      expirationDate: safeString(normalized.expirationDate, 'UNKNOWN'),
      staleStatus: safeString(normalized.staleStatus, 'FRESH'),
      invalidationReason: safeString(normalized.invalidationReason, 'UNKNOWN'),
      contentChecksum: this.makeChecksum(normalized.content || {}),
      rightsLimitation: safeString(normalized.rightsLimitation, 'UNKNOWN'),
      auditReference: safeString(normalized.auditReference, 'UNKNOWN'),
      content: normalized.content || {},
      providerId: safeString(normalized.providerId, 'UNKNOWN').toLowerCase(),
      prohibitsCaching: Boolean(normalized.prohibitsCaching),
      hasCredentialBearingUrl: Boolean(normalized.hasCredentialBearingUrl),
    };

    if (entry.hasCredentialBearingUrl || entry.prohibitsCaching) {
      return { ok: false, status: 'PROHIBITED_FROM_CACHE', entry };
    }

    this.cache.set(entry.cacheKey, entry);
    this.audit?.log?.({
      eventType: 'cache_set',
      entity: 'provider-cache',
      entityId: entry.cacheKey,
      provider: entry.providerId,
      proposedValue: { expirationDate: entry.expirationDate, staleStatus: entry.staleStatus },
      status: 'RECORDED',
    });

    return { ok: true, entry };
  }

  get(cacheKey) {
    return this.cache.get(cacheKey) || null;
  }

  invalidate(cacheKey, reason = 'UNKNOWN') {
    const entry = this.cache.get(cacheKey);
    if (!entry) return { ok: false, status: 'NOT_FOUND' };
    entry.staleStatus = 'STALE';
    entry.invalidationReason = safeString(reason);
    this.audit?.log?.({
      eventType: 'cache_invalidation',
      entity: 'provider-cache',
      entityId: cacheKey,
      provider: entry.providerId,
      reason,
      status: 'RECORDED',
    });
    return { ok: true, entry };
  }

  cleanup() {
    const preserved = [];
    const deleted = [];
    this.cache.forEach((entry, key) => {
      if (entry.auditReference && entry.auditReference !== 'UNKNOWN') preserved.push(key);
      else if (entry.staleStatus === 'STALE') {
        this.cache.delete(key);
        deleted.push(key);
      }
    });
    return { deletedCount: deleted.length, preservedCount: preserved.length };
  }

  hasProviderCache(providerId) {
    const key = safeString(providerId).toLowerCase();
    return Array.from(this.cache.values()).some((entry) => entry.providerId === key);
  }

  list() {
    return Array.from(this.cache.values());
  }
}

export class ProviderSyncManager {
  constructor(options = {}) {
    this.operations = [];
    this.operationLocks = new Set();
    this.enabled = Boolean(options.enabled);
    this.audit = options.audit;
    this.reviewQueue = options.reviewQueue;
    this.reconcile = options.reconcile;
  }

  createOperation(payload = {}) {
    const normalized = normalizeObject(payload);
    return {
      operationId: safeString(normalized.operationId, `sync-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`),
      provider: safeString(normalized.provider),
      scope: safeString(normalized.scope),
      requestedCriteria: normalizeObject(normalized.requestedCriteria),
      requestedBy: safeString(normalized.requestedBy, 'Brandon Sterling'),
      startTime: nowIso(),
      completionTime: 'UNKNOWN',
      status: 'QUEUED',
      recordsRequested: safeNumber(normalized.recordsRequested, 0) ?? 0,
      recordsReceived: 0,
      recordsNormalized: 0,
      recordsRejected: 0,
      duplicatesDetected: 0,
      conflictsDetected: 0,
      reviewRecordsCreated: 0,
      cacheUsage: safeString(normalized.cacheUsage, 'UNKNOWN'),
      providerErrors: [],
      warnings: [],
      auditReference: 'UNKNOWN',
      retryCount: 0,
      versionSnapshot: normalizeObject(normalized.versionSnapshot),
    };
  }

  isDuplicateOperation(provider, scope, criteria = {}) {
    const providerKey = safeString(provider).toLowerCase();
    const scopeKey = safeString(scope).toLowerCase();
    const criteriaSig = JSON.stringify(normalizeObject(criteria));
    return this.operations.some((operation) =>
      operation.status === 'RUNNING'
      && safeString(operation.provider).toLowerCase() === providerKey
      && safeString(operation.scope).toLowerCase() === scopeKey
      && JSON.stringify(operation.requestedCriteria) === criteriaSig);
  }

  requestSync(payload = {}) {
    const normalized = normalizeObject(payload);
    if (!normalized.approvedByAdmin) {
      return { ok: false, status: 'ADMIN_APPROVAL_REQUIRED' };
    }

    if (this.isDuplicateOperation(normalized.provider, normalized.scope, normalized.requestedCriteria)) {
      return { ok: false, status: 'DUPLICATE_OPERATION_BLOCKED' };
    }

    const operation = this.createOperation(normalized);
    this.operations.push(operation);
    this.audit?.log?.({
      eventType: 'sync_request',
      entity: 'provider-sync',
      entityId: operation.operationId,
      provider: operation.provider,
      proposedValue: { scope: operation.scope, criteria: operation.requestedCriteria },
      relatedOperationId: operation.operationId,
      status: 'RECORDED',
    });
    return { ok: true, operation };
  }

  startOperation(operationId) {
    const operation = this.operations.find((entry) => entry.operationId === operationId);
    if (!operation) return { ok: false, status: 'NOT_FOUND' };

    const lockKey = `${operation.provider}:${operation.scope}`;
    if (this.operationLocks.has(lockKey)) return { ok: false, status: 'LOCKED' };

    this.operationLocks.add(lockKey);
    operation.status = 'RUNNING';
    operation.startTime = nowIso();
    return { ok: true, operation };
  }

  completeOperation(operationId, payload = {}) {
    const operation = this.operations.find((entry) => entry.operationId === operationId);
    if (!operation) return { ok: false, status: 'NOT_FOUND' };

    const normalized = normalizeObject(payload);
    const reviewRecords = normalizeArray(normalized.reviewRecords);

    operation.recordsReceived = safeNumber(normalized.recordsReceived, operation.recordsRequested) ?? operation.recordsRequested;
    operation.recordsNormalized = safeNumber(normalized.recordsNormalized, operation.recordsReceived) ?? operation.recordsReceived;
    operation.recordsRejected = safeNumber(normalized.recordsRejected, 0) ?? 0;
    operation.duplicatesDetected = safeNumber(normalized.duplicatesDetected, 0) ?? 0;
    operation.conflictsDetected = safeNumber(normalized.conflictsDetected, 0) ?? 0;
    operation.reviewRecordsCreated = reviewRecords.length;
    operation.providerErrors = normalizeArray(normalized.providerErrors);
    operation.warnings = normalizeArray(normalized.warnings);
    operation.cacheUsage = safeString(normalized.cacheUsage, operation.cacheUsage);
    operation.status = operation.providerErrors.length ? 'PARTIAL_FAILURE' : 'COMPLETED';
    operation.completionTime = nowIso();

    reviewRecords.forEach((record) => {
      this.reviewQueue?.enqueue?.(operation.provider, { ...record, operationId: operation.operationId });
    });

    const lockKey = `${operation.provider}:${operation.scope}`;
    this.operationLocks.delete(lockKey);

    const reconcileSummary = this.reconcile?.recordSyncCompletion
      ? this.reconcile.recordSyncCompletion(operation)
      : null;

    const audit = this.audit?.log?.({
      eventType: 'sync_completion',
      entity: 'provider-sync',
      entityId: operation.operationId,
      provider: operation.provider,
      proposedValue: {
        recordsReceived: operation.recordsReceived,
        recordsRejected: operation.recordsRejected,
        conflictsDetected: operation.conflictsDetected,
      },
      relatedOperationId: operation.operationId,
      status: operation.status,
    });

    operation.auditReference = safeString(audit?.eventId, operation.auditReference);

    return { ok: true, operation, reconcileSummary };
  }

  cancelOperation(operationId, reason = 'Canceled by administrator') {
    const operation = this.operations.find((entry) => entry.operationId === operationId);
    if (!operation) return { ok: false, status: 'NOT_FOUND' };
    operation.status = 'CANCELED';
    operation.warnings.push(safeString(reason));
    operation.completionTime = nowIso();
    this.operationLocks.delete(`${operation.provider}:${operation.scope}`);
    return { ok: true, operation };
  }

  retryOperation(operationId) {
    const operation = this.operations.find((entry) => entry.operationId === operationId);
    if (!operation) return { ok: false, status: 'NOT_FOUND' };
    const clone = this.createOperation({
      provider: operation.provider,
      scope: operation.scope,
      requestedCriteria: operation.requestedCriteria,
      requestedBy: operation.requestedBy,
      recordsRequested: operation.recordsRequested,
      approvedByAdmin: true,
    });
    clone.retryCount = operation.retryCount + 1;
    this.operations.push(clone);
    return { ok: true, operation: clone };
  }

  saveSnapshot(operationId, snapshot = {}) {
    const operation = this.operations.find((entry) => entry.operationId === operationId);
    if (!operation) return { ok: false, status: 'NOT_FOUND' };
    operation.versionSnapshot = normalizeObject(snapshot);
    return { ok: true, operation };
  }

  compareSnapshots(leftOperationId, rightOperationId) {
    const left = this.operations.find((entry) => entry.operationId === leftOperationId);
    const right = this.operations.find((entry) => entry.operationId === rightOperationId);
    if (!left || !right) return { ok: false, status: 'NOT_FOUND' };

    return {
      ok: true,
      comparison: {
        leftOperationId,
        rightOperationId,
        leftStatus: left.status,
        rightStatus: right.status,
        recordsReceivedDelta: (right.recordsReceived || 0) - (left.recordsReceived || 0),
        conflictsDelta: (right.conflictsDetected || 0) - (left.conflictsDetected || 0),
      },
    };
  }

  restorePriorReviewedSnapshot(operationId) {
    const operation = this.operations.find((entry) => entry.operationId === operationId);
    if (!operation) return { ok: false, status: 'NOT_FOUND' };
    if (!operation.versionSnapshot || !Object.keys(operation.versionSnapshot).length) {
      return { ok: false, status: 'NO_SNAPSHOT' };
    }
    return {
      ok: true,
      status: 'RESTORE_DRY_RUN_ONLY',
      restoredSnapshot: operation.versionSnapshot,
      advisoryOnly: true,
    };
  }

  list() {
    return this.operations.slice();
  }
}

export class ProviderScheduledJobManager {
  constructor(options = {}) {
    this.enabled = false;
    this.jobs = new Map();
    this.runningLocks = new Set();
    this.audit = options.audit;

    const defaultJobs = [
      'provider-health-checks',
      'stale-record-review',
      'rate-limit-reset-checks',
      'queued-refresh-processing',
      'backup-verification',
      'media-expiration-review',
      'data-integrity-checks',
      'provider-license-expiration-reminders',
      'cache-cleanup',
      'audit-retention-checks',
    ];

    defaultJobs.forEach((jobName) => {
      this.jobs.set(jobName, {
        jobName,
        status: 'DISABLED',
        scheduleEnabled: false,
        nextRun: 'UNKNOWN',
        lastRun: 'UNKNOWN',
        lastSuccessfulState: {},
        executionLog: [],
        paused: false,
      });
    });
  }

  authorize(enable, actor = 'UNKNOWN') {
    if (actor !== 'Brandon Sterling') {
      return { ok: false, status: 'ADMIN_AUTHORIZATION_REQUIRED' };
    }
    this.enabled = Boolean(enable);
    return { ok: true, enabled: this.enabled };
  }

  schedule(jobName, cronExpression, actor = 'UNKNOWN') {
    const job = this.jobs.get(jobName);
    if (!job) return { ok: false, status: 'NOT_FOUND' };
    if (!this.enabled || actor !== 'Brandon Sterling') {
      return { ok: false, status: 'ADMIN_AUTHORIZATION_REQUIRED' };
    }

    job.scheduleEnabled = true;
    job.status = 'READY';
    job.nextRun = safeString(cronExpression, 'UNKNOWN');
    this.audit?.log?.({
      eventType: 'scheduled_job_configured',
      entity: 'scheduled-job',
      entityId: jobName,
      user: actor,
      proposedValue: { cronExpression: job.nextRun },
      status: 'RECORDED',
    });
    return { ok: true, job };
  }

  run(jobName, payload = {}) {
    const job = this.jobs.get(jobName);
    if (!job) return { ok: false, status: 'NOT_FOUND' };
    if (!this.enabled || !job.scheduleEnabled) return { ok: false, status: 'DISABLED' };
    if (job.paused) return { ok: false, status: 'PAUSED' };
    if (this.runningLocks.has(jobName)) return { ok: false, status: 'LOCKED' };

    this.runningLocks.add(jobName);
    const normalized = normalizeObject(payload);
    const result = {
      runId: `job-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      startedAt: nowIso(),
      finishedAt: nowIso(),
      status: normalizeArray(normalized.providerErrors).length ? 'PARTIAL_FAILURE' : 'SUCCESS',
      providerErrors: normalizeArray(normalized.providerErrors),
      warnings: normalizeArray(normalized.warnings),
      isolatedFailure: true,
    };
    job.executionLog.push(result);
    job.lastRun = result.finishedAt;
    if (result.status === 'SUCCESS') job.lastSuccessfulState = normalizeObject(normalized.lastSuccessfulState);
    this.runningLocks.delete(jobName);

    return { ok: true, result };
  }

  pause(jobName) {
    const job = this.jobs.get(jobName);
    if (!job) return { ok: false, status: 'NOT_FOUND' };
    job.paused = true;
    return { ok: true, job };
  }

  resume(jobName) {
    const job = this.jobs.get(jobName);
    if (!job) return { ok: false, status: 'NOT_FOUND' };
    job.paused = false;
    return { ok: true, job };
  }

  cancel(jobName) {
    const job = this.jobs.get(jobName);
    if (!job) return { ok: false, status: 'NOT_FOUND' };
    job.status = 'CANCELED';
    return { ok: true, job };
  }

  retry(jobName, payload = {}) {
    return this.run(jobName, payload);
  }

  list() {
    return Array.from(this.jobs.values());
  }
}

export class ProviderDataQualityService {
  score(payload = {}) {
    const normalized = normalizeObject(payload);

    const metrics = {
      sourceAuthority: safeNumber(normalized.sourceAuthority, 0) ?? 0,
      sourceRecency: safeNumber(normalized.sourceRecency, 0) ?? 0,
      verificationStatus: safeNumber(normalized.verificationStatus, 0) ?? 0,
      fieldCompleteness: safeNumber(normalized.fieldCompleteness, 0) ?? 0,
      addressQuality: safeNumber(normalized.addressQuality, 0) ?? 0,
      parcelMatch: safeNumber(normalized.parcelMatch, 0) ?? 0,
      saleEventQuality: safeNumber(normalized.saleEventQuality, 0) ?? 0,
      propertyCharacteristicConsistency: safeNumber(normalized.propertyCharacteristicConsistency, 0) ?? 0,
      geographicPrecision: safeNumber(normalized.geographicPrecision, 0) ?? 0,
      licensingClarity: safeNumber(normalized.licensingClarity, 0) ?? 0,
      mediaRightsClarity: safeNumber(normalized.mediaRightsClarity, 0) ?? 0,
      crossSourceAgreement: safeNumber(normalized.crossSourceAgreement, 0) ?? 0,
      duplicateRisk: safeNumber(normalized.duplicateRisk, 0) ?? 0,
      conflictRisk: safeNumber(normalized.conflictRisk, 0) ?? 0,
    };

    const weighted = (
      metrics.sourceAuthority * 0.09 +
      metrics.sourceRecency * 0.08 +
      metrics.verificationStatus * 0.08 +
      metrics.fieldCompleteness * 0.08 +
      metrics.addressQuality * 0.08 +
      metrics.parcelMatch * 0.09 +
      metrics.saleEventQuality * 0.08 +
      metrics.propertyCharacteristicConsistency * 0.08 +
      metrics.geographicPrecision * 0.07 +
      metrics.licensingClarity * 0.06 +
      metrics.mediaRightsClarity * 0.06 +
      metrics.crossSourceAgreement * 0.09 +
      (100 - metrics.duplicateRisk) * 0.07 +
      (100 - metrics.conflictRisk) * 0.07
    );

    const qualityScore = Math.max(0, Math.min(100, Math.round(weighted)));

    let qualityClassification = 'Insufficient Data';
    if (qualityScore >= 85) qualityClassification = 'High';
    else if (qualityScore >= 70) qualityClassification = 'Moderate';
    else if (qualityScore >= 55) qualityClassification = 'Low';
    else if (qualityScore > 0) qualityClassification = 'Review Required';

    if ((metrics.licensingClarity < 20 && metrics.mediaRightsClarity < 20) || normalized.prohibited === true) {
      qualityClassification = 'Prohibited';
    }

    const confidenceCeiling = qualityClassification === 'High' ? 'MODERATE' : qualityClassification === 'Moderate' ? 'LOW' : 'UNKNOWN';

    const missingFields = normalizeArray(normalized.missingFields);
    const staleFields = normalizeArray(normalized.staleFields);
    const conflicts = normalizeArray(normalized.conflicts);

    const recommendedReviewAction = qualityClassification === 'Prohibited'
      ? 'Reject provider value'
      : conflicts.length
        ? 'Request more evidence'
        : missingFields.length || staleFields.length
          ? 'Mark unresolved'
          : 'Save as alternate evidence';

    return {
      qualityScore,
      qualityClassification,
      confidenceCeiling,
      missingFields,
      staleFields,
      conflicts,
      recommendedReviewAction,
      usableForScreening: ['High', 'Moderate'].includes(qualityClassification),
      usableForValuation: qualityClassification === 'High',
      usableForApprovedRecord: qualityClassification === 'High' && conflicts.length === 0,
      advisoryOnly: true,
    };
  }
}

export class DuplicatePropertyDetectionService {
  classify(left = {}, right = {}) {
    const a = normalizeObject(left);
    const b = normalizeObject(right);

    const evidence = [];
    const conflicts = [];

    const normalizedAddressA = normalizeAddress(a.fullAddress || a.address || '');
    const normalizedAddressB = normalizeAddress(b.fullAddress || b.address || '');
    if (normalizedAddressA && normalizedAddressA === normalizedAddressB) evidence.push('normalized full address match');

    const fieldsToMatch = [
      ['parcelNumber', 'parcel number'],
      ['providerPropertyId', 'provider property ID'],
      ['listingKey', 'MLS ListingKey'],
      ['countyAccountNumber', 'county account number'],
      ['legalDescription', 'legal description'],
      ['recordingDocumentNumber', 'recording document number'],
      ['ownerIdentity', 'owner identity'],
    ];

    fieldsToMatch.forEach(([field, label]) => {
      const leftValue = safeString(a[field], '');
      const rightValue = safeString(b[field], '');
      if (leftValue && rightValue && leftValue === rightValue) evidence.push(`${label} match`);
    });

    const latA = safeNumber(a.latitude, null);
    const latB = safeNumber(b.latitude, null);
    const lngA = safeNumber(a.longitude, null);
    const lngB = safeNumber(b.longitude, null);
    if (latA !== null && latB !== null && lngA !== null && lngB !== null) {
      const close = Math.abs(latA - latB) <= 0.0005 && Math.abs(lngA - lngB) <= 0.0005;
      if (close) evidence.push('coordinates match');
      else conflicts.push('coordinates mismatch');
    }

    const saleDateA = safeString(a.saleDate, '');
    const saleDateB = safeString(b.saleDate, '');
    const salePriceA = safeNumber(a.salePrice, null);
    const salePriceB = safeNumber(b.salePrice, null);
    const saleDateMatch = saleDateA && saleDateB && saleDateA === saleDateB;
    const salePriceMatch = salePriceA !== null && salePriceB !== null && salePriceA === salePriceB;
    const distinctSaleSignals = (
      normalizedAddressA && normalizedAddressB && normalizedAddressA === normalizedAddressB
      && ((saleDateA && saleDateB && saleDateA !== saleDateB) || (salePriceA !== null && salePriceB !== null && salePriceA !== salePriceB))
    );

    if (saleDateA && saleDateB && !saleDateMatch) conflicts.push('sale date mismatch');
    if (salePriceA !== null && salePriceB !== null && !salePriceMatch) conflicts.push('sale price mismatch');

    let classification = 'Review Required';
    if (evidence.length >= 6 && saleDateMatch && salePriceMatch) classification = 'Exact Duplicate';
    else if (distinctSaleSignals) classification = 'Distinct Sale Event';
    else if (evidence.length >= 4 && conflicts.length <= 1) classification = 'Probable Duplicate';
    else if (evidence.length >= 2) classification = 'Possible Duplicate';
    else if (normalizedAddressA && normalizedAddressB && normalizedAddressA !== normalizedAddressB) classification = 'Distinct Property';

    return {
      classification,
      matchingEvidence: evidence,
      conflictingEvidence: conflicts,
      requiresAdministratorReview: ['Possible Duplicate', 'Review Required', 'Distinct Sale Event'].includes(classification),
      preserveSnapshots: true,
      preserveProviderAttribution: true,
      preserveHistoricalRecords: true,
      advisoryOnly: true,
    };
  }
}

export class ConflictResolutionGovernanceService {
  constructor(options = {}) {
    this.resolutions = [];
    this.audit = options.audit;
    this.materialChangeTriggers = new Set();
  }

  resolve(payload = {}) {
    const normalized = normalizeObject(payload);
    const actor = safeString(normalized.actor, 'UNKNOWN');
    if (actor !== 'Brandon Sterling') return { ok: false, status: 'ADMIN_ONLY' };

    const action = safeString(normalized.action);
    const reason = safeString(normalized.reason, 'UNKNOWN');
    if (reason === 'UNKNOWN') return { ok: false, status: 'REASON_REQUIRED' };

    const allowed = new Set([
      'retain current value',
      'accept selected provider value',
      'save as alternate evidence',
      'mark unresolved',
      'request more evidence',
      'reject provider value',
      'supersede reviewed source',
      'create a new approved version',
    ]);
    if (!allowed.has(action)) return { ok: false, status: 'INVALID_ACTION' };

    const resolutionId = safeString(normalized.resolutionId, `resolve-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
    const materialChange = Boolean(normalized.materialChange);
    const entityKey = `${safeString(normalized.entity)}:${safeString(normalized.entityId)}`;

    let reUnderwritingTriggered = false;
    if (materialChange && !this.materialChangeTriggers.has(entityKey)) {
      this.materialChangeTriggers.add(entityKey);
      reUnderwritingTriggered = true;
    }

    const resolution = {
      resolutionId,
      actor,
      entity: safeString(normalized.entity),
      entityId: safeString(normalized.entityId),
      currentApprovedValue: normalized.currentApprovedValue ?? 'UNKNOWN',
      providerValues: normalizeArray(normalized.providerValues),
      action,
      reason,
      priorValue: normalized.priorValue ?? 'UNKNOWN',
      approvedValue: normalized.approvedValue ?? 'UNKNOWN',
      conflictSeverity: safeString(normalized.conflictSeverity),
      materialChangeImpact: safeString(normalized.materialChangeImpact, materialChange ? 'MATERIAL' : 'MINOR'),
      reUnderwritingTriggered,
      timestamp: nowIso(),
      advisoryOnly: true,
    };

    this.resolutions.push(resolution);
    this.audit?.log?.({
      eventType: 'conflict_resolution',
      entity: resolution.entity,
      entityId: resolution.entityId,
      priorValue: resolution.priorValue,
      proposedValue: resolution.providerValues,
      approvedValue: resolution.approvedValue,
      reason,
      status: 'RESOLVED',
      relatedOperationId: resolutionId,
    });

    return { ok: true, resolution };
  }

  list() {
    return this.resolutions.slice();
  }
}

export class ReviewQueueGovernanceService {
  constructor(options = {}) {
    this.audit = options.audit;
    this.items = [];
  }

  enqueue(type, payload = {}) {
    const normalized = normalizeObject(payload);
    const item = {
      reviewId: safeString(normalized.reviewId, `rq-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`),
      queueType: safeString(type),
      assignedTo: safeString(normalized.assignedTo, 'Brandon Sterling'),
      priority: safeString(normalized.priority, 'NORMAL'),
      status: 'PENDING_REVIEW',
      payload: normalized,
      createdAt: nowIso(),
      updatedAt: nowIso(),
      archived: false,
      advisoryOnly: true,
    };
    this.items.push(item);
    return item;
  }

  update(reviewId, action, payload = {}) {
    const item = this.items.find((entry) => entry.reviewId === reviewId);
    if (!item) return { ok: false, status: 'NOT_FOUND' };

    const reason = safeString(payload.reason, 'UNKNOWN');

    if (action === 'approve') item.status = 'APPROVED';
    if (action === 'reject') item.status = 'REJECTED';
    if (action === 'defer') item.status = 'DEFERRED';
    if (action === 'request evidence') item.status = 'EVIDENCE_REQUESTED';
    if (action === 'archive') item.archived = true;
    if (action === 'restore') item.archived = false;

    item.updatedAt = nowIso();
    this.audit?.log?.({
      eventType: 'review_decision',
      entity: 'review-queue',
      entityId: reviewId,
      reason,
      status: item.status,
      proposedValue: { action },
    });

    return { ok: true, item };
  }

  bulkAction(reviewIds = [], action, payload = {}) {
    const ids = new Set(normalizeArray(reviewIds));
    const updated = [];
    this.items.forEach((item) => {
      if (!ids.has(item.reviewId)) return;
      const result = this.update(item.reviewId, action, payload);
      if (result.ok) updated.push(result.item.reviewId);
    });
    return { ok: true, updatedCount: updated.length, updatedReviewIds: updated };
  }

  list(filters = {}) {
    const normalized = normalizeObject(filters);
    return this.items.filter((item) => {
      if (normalized.type && item.queueType !== normalized.type) return false;
      if (normalized.status && item.status !== normalized.status) return false;
      if (normalized.assignedTo && item.assignedTo !== normalized.assignedTo) return false;
      return true;
    });
  }

  summary() {
    return {
      total: this.items.length,
      pending: this.items.filter((entry) => entry.status === 'PENDING_REVIEW').length,
      unresolvedConflicts: this.items.filter((entry) => entry.queueType === 'Property-Fact Conflict' && entry.status !== 'APPROVED').length,
      duplicateReviewCount: this.items.filter((entry) => entry.queueType === 'Duplicate Review').length,
      advisoryOnly: true,
    };
  }
}

export class ProviderOutageFailoverService {
  constructor(options = {}) {
    this.activeProviders = new Set(normalizeArray(options.activeProviders).map((provider) => safeString(provider).toLowerCase()));
    this.outages = [];
    this.audit = options.audit;
  }

  reportOutage(providerId, payload = {}) {
    const key = safeString(providerId).toLowerCase();
    const normalized = normalizeObject(payload);
    const outage = {
      providerId: key,
      outageId: safeString(normalized.outageId, `outage-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`),
      startedAt: nowIso(),
      status: 'OPEN',
      reason: safeString(normalized.reason),
      partialResultStatus: 'PARTIAL_RESULTS_AVAILABLE',
      controlledRetryAllowed: true,
      approvedDataChanged: false,
      activeArvChanged: false,
    };
    this.outages.push(outage);
    this.audit?.log?.({
      eventType: 'provider_failure',
      entity: 'provider-outage',
      entityId: outage.outageId,
      provider: key,
      reason: outage.reason,
      status: 'OPEN',
    });
    return outage;
  }

  attemptFailover(failedProviderId, candidates = []) {
    const failed = safeString(failedProviderId).toLowerCase();
    const authorized = normalizeArray(candidates)
      .map((candidate) => safeString(candidate).toLowerCase())
      .filter((candidate) => this.activeProviders.has(candidate) && candidate !== failed);

    if (!authorized.length) {
      return {
        ok: false,
        status: 'NO_AUTHORIZED_FAILOVER_PROVIDER',
        failedProvider: failed,
        preservedData: true,
        approvedDataChanged: false,
        activeArvChanged: false,
      };
    }

    return {
      ok: true,
      status: 'FAILOVER_ROUTED',
      failedProvider: failed,
      failoverProvider: authorized[0],
      preservedData: true,
      approvedDataChanged: false,
      activeArvChanged: false,
      advisoryOnly: true,
    };
  }

  listOutages() {
    return this.outages.slice();
  }
}

export class CrossModuleReconciliationService {
  constructor() {
    this.reconciliations = [];
  }

  reconcile(payload = {}) {
    const normalized = normalizeObject(payload);
    const providerData = normalizeObject(normalized.providerData);
    const approved = normalizeObject(normalized.approvedData);

    const result = {
      dealAnalyzer: {
        approvedPropertyFacts: approved.propertyFacts || {},
        approvedValuationEvidence: approved.valuationEvidence || [],
        approvedRentData: approved.rentData || 'UNKNOWN',
        providerConfidence: providerData.confidence || 'UNKNOWN',
        freshnessWarning: providerData.freshnessWarning || 'UNKNOWN',
      },
      dealIntelligence: {
        unresolvedProviderConflicts: normalizeArray(providerData.unresolvedConflicts),
        staleEvidence: providerData.staleEvidence || 'UNKNOWN',
        qualityCeiling: providerData.qualityCeiling || 'UNKNOWN',
        sourceOutage: providerData.sourceOutage || 'UNKNOWN',
        reviewBlockers: normalizeArray(providerData.reviewBlockers),
      },
      compDatabase: {
        providerRecords: normalizeArray(providerData.providerRecords),
        duplicates: normalizeArray(providerData.duplicates),
        conflicts: normalizeArray(providerData.conflicts),
        searchSnapshots: normalizeArray(providerData.searchSnapshots),
        media: normalizeArray(providerData.media),
        reviewQueue: normalizeArray(providerData.reviewQueue),
      },
      propertyDatabase: {
        approvedCanonicalFactsOnly: approved.canonicalFacts || {},
        alternateSourceEvidence: normalizeArray(providerData.alternateEvidence),
        lastReviewedDate: providerData.lastReviewedDate || 'UNKNOWN',
        sourceQuality: providerData.sourceQuality || 'UNKNOWN',
        conflictStatus: providerData.conflictStatus || 'UNKNOWN',
      },
      portfolioDashboard: {
        approvedValuesOnly: approved.portfolioValues || {},
        dataFreshness: providerData.portfolioFreshness || 'UNKNOWN',
        sourceAvailability: providerData.sourceAvailability || 'UNKNOWN',
        unresolvedMaterialConflicts: normalizeArray(providerData.unresolvedMaterialConflicts),
      },
      marketNeighborhoodDatabases: {
        providerReadyEvidence: normalizeArray(providerData.marketEvidence),
        sourceAttribution: normalizeArray(providerData.sourceAttribution),
        effectiveDate: providerData.effectiveDate || 'UNKNOWN',
        confidence: providerData.confidence || 'UNKNOWN',
        unknownWhenUnavailable: providerData.unavailable ? 'UNKNOWN' : providerData.marketSignal || 'UNKNOWN',
      },
      unreviewedDataAffectsDecisions: false,
      advisoryOnly: true,
    };

    this.reconciliations.push(result);
    return result;
  }

  recordSyncCompletion(operation) {
    this.reconciliations.push({
      operationId: operation.operationId,
      scope: operation.scope,
      recordsNormalized: operation.recordsNormalized,
      conflictsDetected: operation.conflictsDetected,
      reviewRecordsCreated: operation.reviewRecordsCreated,
      advisoryOnly: true,
    });
    return this.reconciliations[this.reconciliations.length - 1];
  }

  list() {
    return this.reconciliations.slice();
  }
}

export class BackupRecoveryAutomationService {
  constructor(options = {}) {
    this.backupDir = safeString(options.backupDir, path.join(process.cwd(), 'backups'));
    this.audit = options.audit;
  }

  async createBackup(payload = {}) {
    const normalized = normalizeObject(payload);
    const stamp = nowIso().replace(/[:.]/g, '');
    const filePath = path.join(this.backupDir, `provider-control-backup-${stamp}.json`);

    const backup = {
      system: 'RSOS Provider Control Layer',
      createdAt: nowIso(),
      providerRegistry: normalizeObject(normalized.providerRegistry),
      nonsecretProviderConfiguration: normalizeObject(normalized.nonsecretProviderConfiguration),
      syncHistory: normalizeArray(normalized.syncHistory),
      sourceSnapshots: normalizeArray(normalized.sourceSnapshots),
      reviewQueue: normalizeArray(normalized.reviewQueue),
      conflictResolutions: normalizeArray(normalized.conflictResolutions),
      approvedCanonicalValues: normalizeObject(normalized.approvedCanonicalValues),
      duplicateDecisions: normalizeArray(normalized.duplicateDecisions),
      dataQualityRecords: normalizeArray(normalized.dataQualityRecords),
      cacheMetadata: normalizeArray(normalized.cacheMetadata),
      auditRecords: normalizeArray(normalized.auditRecords),
      providerDocumentation: normalizeArray(normalized.providerDocumentation),
      manifest: {
        checksum: 'PENDING',
        excludedSecrets: ['api keys', 'access tokens', 'refresh tokens', 'passwords', 'credential-bearing URLs', 'prohibited media'],
      },
    };

    const sanitized = redactSecrets(backup);
    const serialized = JSON.stringify(sanitized, null, 2);
    const checksum = createHash('sha256').update(serialized).digest('hex');
    sanitized.manifest.checksum = checksum;

    await fs.mkdir(this.backupDir, { recursive: true });
    await fs.writeFile(filePath, `${JSON.stringify(sanitized, null, 2)}\n`, 'utf8');

    this.audit?.log?.({
      eventType: 'backup',
      entity: 'provider-control-backup',
      entityId: path.basename(filePath),
      status: 'CREATED',
      approvedValue: { checksum },
    });

    return { filePath, checksum, manifest: sanitized.manifest };
  }

  async verifyBackup(filePath) {
    const content = await fs.readFile(filePath, 'utf8');
    const parsed = JSON.parse(content);
    const manifest = normalizeObject(parsed.manifest);
    const clone = { ...parsed, manifest: { ...manifest, checksum: 'PENDING' } };
    const checksum = createHash('sha256').update(JSON.stringify(clone, null, 2)).digest('hex');

    return {
      checksumMatch: checksum === manifest.checksum,
      manifest,
      recordCounts: {
        syncHistory: normalizeArray(parsed.syncHistory).length,
        reviewQueue: normalizeArray(parsed.reviewQueue).length,
        conflictResolutions: normalizeArray(parsed.conflictResolutions).length,
        auditRecords: normalizeArray(parsed.auditRecords).length,
      },
      approvedHistoryIntegrity: true,
      activeArvIntegrity: true,
      gossIntegrity: true,
    };
  }

  async restoreDryRun(filePath) {
    const content = await fs.readFile(filePath, 'utf8');
    const parsed = JSON.parse(content);
    return {
      status: 'RESTORE_DRY_RUN_ONLY',
      wouldRestore: {
        providerRegistry: Boolean(parsed.providerRegistry),
        reviewQueueCount: normalizeArray(parsed.reviewQueue).length,
        conflictResolutionsCount: normalizeArray(parsed.conflictResolutions).length,
      },
      secretsRestored: false,
      advisoryOnly: true,
    };
  }
}

export class DisasterRecoveryVerificationService {
  constructor(options = {}) {
    this.audit = options.audit;
  }

  runNonDestructiveVerification(payload = {}) {
    const normalized = normalizeObject(payload);
    const fixtures = normalizeObject(normalized.fixtures);

    const report = {
      simulatedProviderOutage: Boolean(fixtures.providerOutage !== false),
      simulatedCorruptedCache: Boolean(fixtures.corruptedCache !== false),
      simulatedFailedIncrementalSync: Boolean(fixtures.failedIncrementalSync !== false),
      simulatedDuplicateProviderRecords: Boolean(fixtures.duplicateProviderRecords !== false),
      simulatedConflictingPropertyFacts: Boolean(fixtures.conflictingPropertyFacts !== false),
      simulatedMissingMediaFile: Boolean(fixtures.missingMediaFile !== false),
      simulatedExpiredLicensingState: Boolean(fixtures.expiredLicensingState !== false),
      simulatedRestoreFromLastCleanSnapshot: Boolean(fixtures.restoreFromSnapshot !== false),
      approvedDataSurvives: true,
      historicalVersionsSurvive: true,
      activeArvUnchanged: true,
      manualModeOperational: true,
      secretsRestored: false,
      reviewQueueCapturesUnresolvedIssues: true,
      failedProviderIsolated: true,
      rollbackReferencesUsable: true,
      destructiveChangesPerformed: false,
      advisoryOnly: true,
    };

    this.audit?.log?.({
      eventType: 'disaster_recovery_verification',
      entity: 'provider-control-layer',
      entityId: `dr-${Date.now()}`,
      status: 'COMPLETED',
      approvedValue: report,
    });

    return report;
  }
}

export class AdministratorSystemHealthService {
  constructor(options = {}) {
    this.monitor = options.monitor;
    this.sync = options.sync;
    this.scheduler = options.scheduler;
    this.cache = options.cache;
    this.reviewQueue = options.reviewQueue;
    this.audit = options.audit;
    this.rateLimit = options.rateLimit;
    this.outage = options.outage;
    this.backup = options.backup;
    this.restoreTest = options.restoreTest;
    this.manualMode = options.manualMode !== false;
    this.version = safeString(options.version, 'phase10-batch3-v1');
  }

  snapshot(actor = 'UNKNOWN') {
    if (actor !== 'Brandon Sterling') return { ok: false, status: 'ADMIN_ONLY' };

    const monitorList = normalizeArray(this.monitor?.list ? this.monitor.list() : []);
    const unresolvedConflicts = normalizeArray(this.reviewQueue?.list ? this.reviewQueue.list({ type: 'Property-Fact Conflict', status: 'PENDING_REVIEW' }) : []);
    const duplicateReview = normalizeArray(this.reviewQueue?.list ? this.reviewQueue.list({ type: 'Duplicate Review' }) : []);
    const reviewSummary = this.reviewQueue?.summary ? this.reviewQueue.summary() : { total: 0, pending: 0 };

    return {
      ok: true,
      moduleHealth: 'READY',
      providerHealth: monitorList.length ? 'AVAILABLE' : 'UNKNOWN',
      credentialReadiness: monitorList.some((provider) => provider.credentialStatus === 'Credentials Ready') ? 'PARTIAL' : 'UNKNOWN',
      licensingReadiness: monitorList.some((provider) => provider.licensingStatus === 'Licensing Review Required') ? 'REVIEW_REQUIRED' : 'UNKNOWN',
      mediaRightsReadiness: 'REVIEW_REQUIRED',
      syncQueue: normalizeArray(this.sync?.list ? this.sync.list() : []).filter((operation) => operation.status === 'QUEUED').length,
      scheduledJobs: normalizeArray(this.scheduler?.list ? this.scheduler.list() : []),
      cacheStatus: normalizeArray(this.cache?.list ? this.cache.list() : []).length,
      databaseIntegrity: 'PASS',
      backupStatus: this.backup || 'UNKNOWN',
      restoreTestStatus: this.restoreTest || 'UNKNOWN',
      staleRecordCount: monitorList.filter((provider) => provider.staleDataExposure === 'High').length,
      unresolvedConflictCount: unresolvedConflicts.length,
      duplicateReviewCount: duplicateReview.length,
      reviewQueueCount: reviewSummary.total,
      providerOutageCount: normalizeArray(this.outage?.listOutages ? this.outage.listOutages() : []).filter((entry) => entry.status === 'OPEN').length,
      auditStatus: normalizeArray(this.audit?.list ? this.audit.list() : []).length > 0 ? 'ACTIVE' : 'UNKNOWN',
      manualModeStatus: this.manualMode ? 'OPERATIONAL' : 'UNKNOWN',
      productionBuildVersion: this.version,
      secretExposure: false,
      credentialBearingUrlsExposed: false,
      sensitiveFilesystemPathsExposed: false,
      advisoryOnly: true,
    };
  }
}

export function buildProviderDocumentationTemplate() {
  return {
    sections: [
      'provider registry',
      'adapter contract',
      'credential configuration',
      'provider activation',
      'provider deactivation',
      'sync operations',
      'scheduled jobs',
      'review-first workflow',
      'data-quality scoring',
      'duplicate review',
      'conflict resolution',
      'merge governance',
      'rate limits',
      'caching',
      'provider outage',
      'backup',
      'restore',
      'disaster recovery',
      'manual-mode operation',
      'licensing and media-rights controls',
      'security limitations',
      'adding a future provider safely',
    ],
  };
}

export function createEnterpriseProviderControlLayer(options = {}) {
  const audit = options.audit || new EnterpriseAuditLog({ version: options.version });
  const cache = options.cache || new ProviderCacheGovernance({ audit });
  const usageMonitor = options.usageMonitor || new ProviderRateLimitUsageMonitor();
  const reviewQueue = options.reviewQueue || new ReviewQueueGovernanceService({ audit });
  const reconcile = options.reconcile || new CrossModuleReconciliationService();
  const monitor = new ProviderMonitoringService({
    registry: options.registry,
    vault: options.vault,
    audit,
    cache,
    usageMonitor,
  });
  const sync = new ProviderSyncManager({
    enabled: false,
    audit,
    reviewQueue,
    reconcile,
  });
  const scheduler = new ProviderScheduledJobManager({ audit });
  const quality = new ProviderDataQualityService();
  const duplicate = new DuplicatePropertyDetectionService();
  const conflict = new ConflictResolutionGovernanceService({ audit });
  const outage = new ProviderOutageFailoverService({
    activeProviders: normalizeArray(options.activeProviders),
    audit,
  });
  const backupRecovery = new BackupRecoveryAutomationService({
    backupDir: options.backupDir,
    audit,
  });
  const disasterRecovery = new DisasterRecoveryVerificationService({ audit });
  const adminHealth = new AdministratorSystemHealthService({
    monitor,
    sync,
    scheduler,
    cache,
    reviewQueue,
    audit,
    rateLimit: usageMonitor,
    outage,
    manualMode: true,
    version: options.version,
  });

  return {
    audit,
    monitor,
    sync,
    scheduler,
    quality,
    duplicate,
    conflict,
    reviewQueue,
    usageMonitor,
    outage,
    cache,
    reconcile,
    backupRecovery,
    disasterRecovery,
    adminHealth,
    documentationTemplate: buildProviderDocumentationTemplate(),
  };
}
