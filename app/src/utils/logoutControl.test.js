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
