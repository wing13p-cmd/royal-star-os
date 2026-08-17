function createProviderSearchSessionService(options = {}) {
  const maxStoredSessions = options.maxStoredSessions || 25;
  const cacheTtlMs = options.cacheTtlMs ?? 86400000;
  const maxCacheEntries = options.maxCacheEntries || 50;
  const sessions = [];
  const cache = new Map();
  const inFlight = new Map();
  const usage = new Map();
  let persistenceCallback = null;

  function notifyPersistence() {
    if (typeof persistenceCallback === "function") {
      try { persistenceCallback(exportState()); } catch { /* telemetry persistence must never break provider work */ }
    }
  }

  function now() {
    return new Date().toISOString();
  }

  function pruneSessions() {
    if (sessions.length > maxStoredSessions) {
      sessions.splice(0, sessions.length - maxStoredSessions);
    }
  }

  function getSession(sessionId) {
    return sessions.find((session) => session.id === sessionId) || null;
  }

  function getSessionById(sessionId) {
    return getSession(sessionId);
  }

  function buildSessionSnapshot(session = {}) {
    return {
      id: session.id || "",
      provider: session.provider || "manual",
      operation: session.operation || "provider-search",
      status: session.status || "queued",
      createdAt: session.createdAt || now(),
      updatedAt: session.updatedAt || now(),
      retryCount: Number(session.retryCount || 0),
      cachedResults: Boolean(session.cachedResults),
      resultCount: Number(session.resultCount || 0),
      requestDurationMs: Number(session.requestDurationMs || 0),
      lastError: session.lastError || "",
      snapshot: session.snapshot || null,
    };
  }

  function createSession(input = {}) {
    const session = {
      id: input.id || `provider-search-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
      provider: input.provider || "manual",
      operation: input.operation || "provider-search",
      query: input.query || {},
      status: input.status || "queued",
      createdAt: input.createdAt || now(),
      updatedAt: input.updatedAt || now(),
      retryCount: Number(input.retryCount || 0),
      cachedResults: Boolean(input.cachedResults),
      resultCount: Number(input.resultCount || 0),
      requestDurationMs: Number(input.requestDurationMs || 0),
      lastError: input.lastError || "",
      snapshot: input.snapshot || null,
    };
    sessions.push(session);
    pruneSessions();
    notifyPersistence();
    return buildSessionSnapshot(session);
  }

  function getLatestSession() {
    return sessions.length > 0 ? buildSessionSnapshot(sessions[sessions.length - 1]) : null;
  }

  function updateSession(sessionId, patch = {}) {
    const session = getSession(sessionId);
    if (!session) return null;
    Object.assign(session, patch, { updatedAt: now() });
    notifyPersistence();
    return buildSessionSnapshot(session);
  }

  function cancelSession(sessionId) {
    return updateSession(sessionId, { status: "canceled" });
  }

  function retrySession(sessionId) {
    const session = getSession(sessionId);
    if (!session) return null;
    const retryCount = Number(session.retryCount || 0) + 1;
    const retrySession = createSession({
      provider: session.provider,
      operation: session.operation,
      query: session.query,
      status: "queued",
      retryCount,
      snapshot: session.snapshot || null,
    });
    retrySession.parentSessionId = session.id;
    return retrySession;
  }

  function snapshotSession(sessionId, snapshot = {}) {
    const session = getSession(sessionId);
    if (!session) return null;
    session.snapshot = snapshot;
    session.updatedAt = now();
    notifyPersistence();
    return buildSessionSnapshot(session);
  }

  function recordResult(sessionId, result = {}) {
    const session = getSession(sessionId);
    if (!session) return null;
    Object.assign(session, {
      status: result.status || session.status || "completed",
      resultCount: Number(result.resultCount || session.resultCount || 0),
      cachedResults: Boolean(result.cachedResults),
      requestDurationMs: Number(result.requestDurationMs || 0),
      lastError: result.lastError || session.lastError || "",
      updatedAt: now(),
    });
    notifyPersistence();
    return buildSessionSnapshot(session);
  }

  function getCachedResult(cacheKey) {
    const entry = getCachedResultEntry(cacheKey);
    return entry?.status === "HIT" ? entry.value : null;
  }

  function getCachedResultEntry(cacheKey, options = {}) {
    const entry = cache.get(cacheKey);
    if (!entry) return { status: "MISS", value: null, timestamp: null, ageMs: null, ttlMs: cacheTtlMs };
    const ageMs = Math.max(0, Date.now() - entry.timestamp);
    const expired = Number.isFinite(Number(entry.expiresAt)) ? Date.now() >= Number(entry.expiresAt) : ageMs > cacheTtlMs;
    if (expired && !options.includeExpired) {
      return { status: "EXPIRED", value: null, timestamp: entry.timestamp, ageMs, ttlMs: cacheTtlMs, metadata: entry.metadata || {} };
    }
    return { status: expired ? "EXPIRED" : "HIT", value: entry.value, timestamp: entry.timestamp, ageMs, ttlMs: cacheTtlMs, metadata: entry.metadata || {} };
  }

  function setCachedResult(cacheKey, value, metadata = {}) {
    const timestamp = Date.now();
    cache.set(cacheKey, { timestamp, expiresAt: timestamp + cacheTtlMs, value, metadata });
    while (cache.size > maxCacheEntries) cache.delete(cache.keys().next().value);
    notifyPersistence();
    return value;
  }

  function getInFlight(cacheKey) { return inFlight.get(cacheKey) || null; }
  function setInFlight(cacheKey, promise) {
    inFlight.set(cacheKey, promise);
    Promise.resolve(promise).finally(() => { if (inFlight.get(cacheKey) === promise) inFlight.delete(cacheKey); }).catch(() => {});
    return promise;
  }

  function clearCache() {
    cache.clear();
    notifyPersistence();
  }

  function recordUsage(provider = "manual", operation = "provider-search", outcome = "completed") {
    const normalized = String(provider || "manual").toLowerCase();
    const existing = usage.get(normalized) || {
      provider: normalized,
      operations: {},
      successfulRequests: 0,
      failedRequests: 0,
      cachedResponses: 0,
      lastUpdatedAt: now(),
    };
    existing.operations[operation] = Number(existing.operations[operation] || 0) + 1;
    if (outcome === "cached") existing.cachedResponses += 1;
    else if (outcome === "failed") existing.failedRequests += 1;
    else existing.successfulRequests += 1;
    existing.lastUpdatedAt = now();
    usage.set(normalized, existing);
    notifyPersistence();
    return existing;
  }

  function getUsageSummary(provider = "manual") {
    const normalized = String(provider || "manual").toLowerCase();
    const usageEntry = usage.get(normalized) || {
      provider: normalized,
      operations: {},
      successfulRequests: 0,
      failedRequests: 0,
      cachedResponses: 0,
      lastUpdatedAt: now(),
    };
    return usageEntry;
  }

  function getSummary() {
    const subjectProperties = Array.from(cache.values())
      .map((entry) => entry?.value?.property)
      .filter((property) => property && property.address)
      .map((property) => ({
        provider: property.provider || "",
        providerRecordId: property.providerRecordId || "",
        subjectDealId: property.subjectDealId || "",
        dealId: property.dealId || "",
        propertyId: property.propertyId || property.subjectPropertyId || "",
        address: property.address || "",
        city: property.city || "",
        state: property.state || "",
        zipCode: property.zip || property.zipCode || "",
        propertyType: property.propertyType || "",
        bedrooms: property.bedrooms ?? "",
        bathrooms: property.bathrooms ?? "",
        squareFeet: property.squareFeet ?? "",
        yearBuilt: property.yearBuilt ?? "",
        latitude: property.latitude ?? "",
        longitude: property.longitude ?? "",
      }));
    return {
      latestSession: getLatestSession(),
      recentSessions: sessions.slice(-5).map((session) => buildSessionSnapshot(session)),
      cacheEntries: cache.size,
      usage: Object.fromEntries(Array.from(usage.entries())),
      subjectProperties,
    };
  }

  function setPersistenceCallback(callback) { persistenceCallback = callback; }

  function exportState() {
    return {
      sessions: sessions.map((session) => ({
        ...session,
        snapshot: session.snapshot ? {
          ok: session.snapshot.ok,
          status: session.snapshot.status,
          errorCode: session.snapshot.errorCode || null,
          diagnostics: session.snapshot.diagnostics || {},
          resultCount: Number(session.snapshot.resultCount || session.resultCount || 0),
        } : null,
      })),
      cache: Array.from(cache.entries()).map(([cacheKey, entry]) => ({ cacheKey, ...entry })),
      usage: Object.fromEntries(usage.entries()),
    };
  }

  function hydrate(snapshot = {}) {
    sessions.length = 0;
    cache.clear();
    usage.clear();
    const restoredSessions = Array.isArray(snapshot.sessions) ? snapshot.sessions.slice(-maxStoredSessions) : [];
    restoredSessions.forEach((session) => sessions.push({ ...session, query: session.query || {} }));
    const nowMs = Date.now();
    const restoredCache = Array.isArray(snapshot.cache) ? snapshot.cache : [];
    restoredCache.forEach((entry) => {
      const expiresAt = Number(entry.expiresAt || (Number(entry.timestamp) + cacheTtlMs));
      if (!entry.cacheKey || !entry.value || !Number.isFinite(expiresAt) || expiresAt <= nowMs) return;
      cache.set(entry.cacheKey, {
        timestamp: Number(entry.timestamp) || nowMs,
        expiresAt,
        value: entry.value,
        metadata: entry.metadata || {},
      });
    });
    while (cache.size > maxCacheEntries) cache.delete(cache.keys().next().value);
    if (snapshot.usage && typeof snapshot.usage === "object") {
      Object.entries(snapshot.usage).forEach(([key, value]) => usage.set(key, value));
    }
  }

  return {
    createSession,
    getSession: getSessionById,
    getLatestSession,
    updateSession,
    cancelSession,
    retrySession,
    snapshotSession,
    recordResult,
    getCachedResult,
    getCachedResultEntry,
    setCachedResult,
    getInFlight,
    setInFlight,
    clearCache,
    recordUsage,
    getUsageSummary,
    getSummary,
    setPersistenceCallback,
    exportState,
    hydrate,
  };
}

function createProviderSearchSessionStore(options = {}) {
  return createProviderSearchSessionService(options);
}

export { createProviderSearchSessionService, createProviderSearchSessionStore };
export default createProviderSearchSessionService;
