function createProviderSearchSessionService(options = {}) {
  const maxStoredSessions = options.maxStoredSessions || 25;
  const cacheTtlMs = options.cacheTtlMs || 60000;
  const sessions = [];
  const cache = new Map();
  const usage = new Map();

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
    return buildSessionSnapshot(session);
  }

  function getLatestSession() {
    return sessions.length > 0 ? buildSessionSnapshot(sessions[sessions.length - 1]) : null;
  }

  function updateSession(sessionId, patch = {}) {
    const session = getSession(sessionId);
    if (!session) return null;
    Object.assign(session, patch, { updatedAt: now() });
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
    return buildSessionSnapshot(session);
  }

  function getCachedResult(cacheKey) {
    const entry = cache.get(cacheKey);
    if (!entry) return null;
    if (Date.now() - entry.timestamp > cacheTtlMs) {
      cache.delete(cacheKey);
      return null;
    }
    return entry.value;
  }

  function setCachedResult(cacheKey, value) {
    cache.set(cacheKey, { timestamp: Date.now(), value });
    return value;
  }

  function clearCache() {
    cache.clear();
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
    return {
      latestSession: getLatestSession(),
      recentSessions: sessions.slice(-5).map((session) => buildSessionSnapshot(session)),
      cacheEntries: cache.size,
      usage: Object.fromEntries(Array.from(usage.entries())),
    };
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
    setCachedResult,
    clearCache,
    recordUsage,
    getUsageSummary,
    getSummary,
  };
}

function createProviderSearchSessionStore(options = {}) {
  return createProviderSearchSessionService(options);
}

export { createProviderSearchSessionService, createProviderSearchSessionStore };
export default createProviderSearchSessionService;
