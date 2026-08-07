import { buildApiUrl } from './apiClient.js';

const SESSION_STORAGE_KEYS = ['rsosSessionId', 'rsosAuthSessionId', 'sessionId'];

function getStorage(storage) {
  return storage || (typeof window !== 'undefined' ? window.localStorage : null);
}

export function getStoredSessionId(storage) {
  const safeStorage = getStorage(storage);
  if (!safeStorage) return '';
  for (const key of SESSION_STORAGE_KEYS) {
    const value = safeStorage.getItem(key);
    if (value) return String(value);
  }
  return '';
}

export function clearStoredSessionIds(storage) {
  const safeStorage = getStorage(storage);
  if (!safeStorage) return;
  for (const key of SESSION_STORAGE_KEYS) {
    safeStorage.removeItem(key);
  }
}

export async function resolveLogoutAvailability(options = {}) {
  const fetchImpl = options.fetchImpl || (typeof fetch === 'function' ? fetch : null);
  const storage = getStorage(options.storage);
  const sessionId = getStoredSessionId(storage);

  if (!fetchImpl || !sessionId) {
    return {
      enabled: false,
      authActive: false,
      reason: 'AUTH_NOT_ACTIVE',
    };
  }

  try {
    const response = await fetchImpl(buildApiUrl('/api/auth/me'), {
      method: 'GET',
      headers: {
        'x-rsos-session-id': sessionId,
        'x-session-id': sessionId,
      },
    });

    if (response.ok) {
      return {
        enabled: true,
        authActive: true,
        reason: 'AUTH_ACTIVE',
      };
    }

    if (response.status === 404 || response.status === 405) {
      return {
        enabled: false,
        authActive: false,
        reason: 'AUTH_NOT_ACTIVE',
      };
    }

    return {
      enabled: false,
      authActive: false,
      reason: 'AUTH_NOT_ACTIVE',
    };
  } catch {
    return {
      enabled: false,
      authActive: false,
      reason: 'AUTH_UNAVAILABLE',
    };
  }
}

export async function executeLogout(options = {}) {
  const fetchImpl = options.fetchImpl || (typeof fetch === 'function' ? fetch : null);
  const storage = getStorage(options.storage);
  const sessionId = getStoredSessionId(storage);

  if (!fetchImpl || !sessionId) {
    return { ok: false, reason: 'AUTH_NOT_ACTIVE' };
  }

  try {
    const response = await fetchImpl(buildApiUrl('/api/auth/logout'), {
      method: 'POST',
      headers: {
        'x-rsos-session-id': sessionId,
        'x-session-id': sessionId,
      },
    });

    if (!response.ok) {
      if (response.status === 404 || response.status === 405) {
        return { ok: false, reason: 'AUTH_NOT_ACTIVE' };
      }
      return { ok: false, reason: 'LOGOUT_FAILED' };
    }

    clearStoredSessionIds(storage);
    return { ok: true, reason: 'LOGGED_OUT' };
  } catch {
    return { ok: false, reason: 'LOGOUT_FAILED' };
  }
}
