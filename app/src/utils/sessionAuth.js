export const SESSION_STORAGE_KEYS = ["rsosSessionId", "rsosAuthSessionId", "sessionId"];

function resolveStorage(storage) {
  return storage || (typeof window !== "undefined" ? window.localStorage : null);
}

export function getStoredSessionId(storage) {
  const safeStorage = resolveStorage(storage);
  if (!safeStorage) return "";
  for (const key of SESSION_STORAGE_KEYS) {
    const value = safeStorage.getItem(key);
    if (value) return String(value);
  }
  return "";
}

export function storeSessionId(sessionId = "", storage) {
  const safeStorage = resolveStorage(storage);
  if (!safeStorage) return;
  for (const key of SESSION_STORAGE_KEYS) {
    if (sessionId) safeStorage.setItem(key, sessionId);
    else safeStorage.removeItem(key);
  }
}

export function clearStoredSessionIds(storage) {
  storeSessionId("", storage);
}

export function buildSessionHeaders(sessionId = "", additionalHeaders = {}) {
  return {
    ...additionalHeaders,
    ...(sessionId ? {
      "x-rsos-session-id": sessionId,
      "x-session-id": sessionId,
    } : {}),
  };
}

export function buildSessionAuthHeaders(additionalHeaders = {}, storage) {
  return buildSessionHeaders(getStoredSessionId(storage), additionalHeaders);
}
