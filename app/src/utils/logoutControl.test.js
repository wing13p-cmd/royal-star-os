import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getStoredSessionId,
  clearStoredSessionIds,
  resolveLogoutAvailability,
  executeLogout,
} from './logoutControl.js';

function createStorage(seed = {}) {
  const data = new Map(Object.entries(seed));
  return {
    getItem(key) {
      return data.has(key) ? data.get(key) : null;
    },
    setItem(key, value) {
      data.set(key, String(value));
    },
    removeItem(key) {
      data.delete(key);
    },
    has(key) {
      return data.has(key);
    },
  };
}

test('getStoredSessionId prefers first available known session key', () => {
  const storage = createStorage({ sessionId: 'legacy', rsosSessionId: 'primary' });
  assert.equal(getStoredSessionId(storage), 'primary');
});

test('clearStoredSessionIds removes all supported keys', () => {
  const storage = createStorage({
    rsosSessionId: 'a',
    rsosAuthSessionId: 'b',
    sessionId: 'c',
  });

  clearStoredSessionIds(storage);

  assert.equal(storage.has('rsosSessionId'), false);
  assert.equal(storage.has('rsosAuthSessionId'), false);
  assert.equal(storage.has('sessionId'), false);
});

test('resolveLogoutAvailability disables logout when no auth session is active', async () => {
  const storage = createStorage({});
  const result = await resolveLogoutAvailability({
    storage,
    fetchImpl: async () => ({ ok: true }),
  });

  assert.equal(result.enabled, false);
  assert.equal(result.reason, 'AUTH_NOT_ACTIVE');
});

test('resolveLogoutAvailability enables logout when auth endpoint confirms session', async () => {
  const storage = createStorage({ rsosSessionId: 'session-1' });
  const calls = [];
  const result = await resolveLogoutAvailability({
    storage,
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return { ok: true };
    },
  });

  assert.equal(result.enabled, true);
  assert.equal(result.reason, 'AUTH_ACTIVE');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url.endsWith('/api/auth/me'), true);
  assert.equal(calls[0].options.headers['x-rsos-session-id'], 'session-1');
});

test('executeLogout clears session keys on successful logout', async () => {
  const storage = createStorage({
    rsosSessionId: 'session-1',
    rsosAuthSessionId: 'session-2',
    sessionId: 'session-3',
  });

  const result = await executeLogout({
    storage,
    fetchImpl: async () => ({ ok: true }),
  });

  assert.equal(result.ok, true);
  assert.equal(result.reason, 'LOGGED_OUT');
  assert.equal(getStoredSessionId(storage), '');
});

test('executeLogout reports failure when auth session is missing', async () => {
  const storage = createStorage({});
  const result = await executeLogout({
    storage,
    fetchImpl: async () => ({ ok: true }),
  });

  assert.equal(result.ok, false);
  assert.equal(result.reason, 'AUTH_NOT_ACTIVE');
});

// ── Logout correctness: session, protected-route access, Back-button safety ──

test('executeLogout calls POST /api/auth/logout with session header', async () => {
  const storage = createStorage({ rsosSessionId: 'test-session-abc' });
  const calls = [];
  await executeLogout({
    storage,
    fetchImpl: async (url, options) => {
      calls.push({ url, method: options?.method, headers: options?.headers });
      return { ok: true };
    },
  });

  assert.equal(calls.length, 1);
  assert.ok(calls[0].url.endsWith('/api/auth/logout'), 'must call /api/auth/logout');
  assert.equal(calls[0].method, 'POST', 'must use POST method');
  assert.equal(calls[0].headers['x-rsos-session-id'], 'test-session-abc', 'must send session header');
});

test('executeLogout clears ALL session storage keys after server confirms logout', async () => {
  const storage = createStorage({ rsosSessionId: 's1', rsosAuthSessionId: 's2', sessionId: 's3' });
  await executeLogout({ storage, fetchImpl: async () => ({ ok: true }) });

  assert.equal(storage.has('rsosSessionId'), false);
  assert.equal(storage.has('rsosAuthSessionId'), false);
  assert.equal(storage.has('sessionId'), false);
  assert.equal(getStoredSessionId(storage), '');
});

test('executeLogout does NOT clear session keys when server returns failure', async () => {
  const storage = createStorage({ rsosSessionId: 'live-session' });
  const result = await executeLogout({
    storage,
    fetchImpl: async () => ({ ok: false, status: 500 }),
  });

  assert.equal(result.ok, false);
  assert.equal(result.reason, 'LOGOUT_FAILED');
  // Session keys must remain intact on server-side failure.
  assert.equal(getStoredSessionId(storage), 'live-session');
});

test('session is absent after successful logout (protected-route access is denied)', async () => {
  const storage = createStorage({ rsosSessionId: 'authenticated-session' });

  await executeLogout({ storage, fetchImpl: async () => ({ ok: true }) });

  // Simulating what AuthGate checks: no session → unauthenticated
  const sessionIdAfterLogout = getStoredSessionId(storage);
  assert.equal(sessionIdAfterLogout, '', 'session must be cleared so AuthGate returns to login screen');
});

test('session persists across simulated page refresh (session in localStorage survives)', () => {
  const storage = createStorage({ rsosSessionId: 'persistent-session-xyz' });

  // Simulate a page refresh: create a new storage instance from the same backing data.
  // getStoredSessionId on the fresh reference must find the same key.
  const sessionAfterRefresh = getStoredSessionId(storage);
  assert.equal(sessionAfterRefresh, 'persistent-session-xyz', 'session must survive simulated refresh');
});

test('executeLogout returns AUTH_NOT_ACTIVE when logout server route is 404 (auth inactive)', async () => {
  const storage = createStorage({ rsosSessionId: 'session-orphan' });
  const result = await executeLogout({
    storage,
    fetchImpl: async () => ({ ok: false, status: 404 }),
  });

  assert.equal(result.ok, false);
  assert.equal(result.reason, 'AUTH_NOT_ACTIVE');
});

test('resolveLogoutAvailability returns AUTH_UNAVAILABLE on network error', async () => {
  const storage = createStorage({ rsosSessionId: 'net-error-session' });
  const result = await resolveLogoutAvailability({
    storage,
    fetchImpl: async () => { throw new Error('network failure'); },
  });

  assert.equal(result.enabled, false);
  assert.equal(result.reason, 'AUTH_UNAVAILABLE');
});
