import { buildApiUrl } from './apiClient.js';
import { buildSessionAuthHeaders, clearStoredSessionIds, getStoredSessionId } from './sessionAuth.js';

function getStorage(storage) {
  return storage || (typeof window !== 'undefined' ? window.localStorage : null);
}

export { clearStoredSessionIds, getStoredSessionId } from './sessionAuth.js';

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
      headers: buildSessionAuthHeaders({}, storage),
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
      headers: buildSessionAuthHeaders({}, storage),
    });

    if (!response.ok) {
      if (response.status === 404 || response.status === 405) {
        return { ok: false, reason: 'AUTH_NOT_ACTIVE' };
      }
      return { ok: false, reason: 'LOGOUT_FAILED' };
    }

    clearStoredSessionIds(storage);
    if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
      // Replace history state so the Back button returns to the login screen, not an authenticated view.
      window.history.replaceState({ rsos_authenticated: false }, '', window.location.href);
      window.dispatchEvent(new Event('rsos-logged-out'));
    }
    return { ok: true, reason: 'LOGGED_OUT' };
  } catch {
    return { ok: false, reason: 'LOGOUT_FAILED' };
  }
}
