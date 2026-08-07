import test from 'node:test';
import assert from 'node:assert/strict';
import { buildApiUrl, getApiBaseUrl } from './apiClient.js';

function getEnv() {
  if (typeof globalThis !== 'undefined') {
    if (!globalThis.__RSOS_API_ENV__) {
      globalThis.__RSOS_API_ENV__ = {};
    }
    return globalThis.__RSOS_API_ENV__;
  }
  return import.meta.env || {};
}

test('uses a relative API base by default', () => {
  assert.equal(getApiBaseUrl(), '/');
  assert.equal(buildApiUrl('/api/health'), '/api/health');
});

test('uses configured API base URL when provided', () => {
  const env = getEnv();
  const original = env.VITE_API_BASE_URL;
  env.VITE_API_BASE_URL = 'https://api.example.com';
  try {
    assert.equal(getApiBaseUrl(), 'https://api.example.com');
    assert.equal(buildApiUrl('/api/deals'), 'https://api.example.com/api/deals');
  } finally {
    env.VITE_API_BASE_URL = original;
  }
});
