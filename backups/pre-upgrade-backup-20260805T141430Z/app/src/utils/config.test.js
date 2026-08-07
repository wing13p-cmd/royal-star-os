import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildRuntimeConfig,
  resolveApiBaseUrl,
  resolvePort,
  redactSensitiveValue,
  getFrontendSafeConfig,
  validateRuntimeConfig,
} from './config.js';

test('fails clearly when production configuration is missing required values', () => {
  assert.throws(() => validateRuntimeConfig(buildRuntimeConfig({
    env: { NODE_ENV: 'production', PORT: '', RSOS_API_BASE_URL: '' },
    runtimeEnv: {},
    isBrowser: false,
    requireProductionConfig: true,
  })), /required/i);
});

test('accepts valid development configuration', () => {
  const config = buildRuntimeConfig({
    env: { NODE_ENV: 'development', PORT: '3001', RSOS_API_BASE_URL: '' },
    runtimeEnv: {},
    isBrowser: false,
    requireProductionConfig: false,
  });

  assert.equal(config.mode, 'development');
  assert.equal(config.port, 3001);
  assert.equal(config.apiBaseUrl, '/');
});

test('accepts valid production configuration', () => {
  const config = buildRuntimeConfig({
    env: { NODE_ENV: 'production', PORT: '4000', RSOS_API_BASE_URL: 'https://api.example.com' },
    runtimeEnv: {},
    isBrowser: false,
    requireProductionConfig: true,
  });

  assert.equal(config.mode, 'production');
  assert.equal(config.port, 4000);
  assert.equal(config.apiBaseUrl, 'https://api.example.com');
});

test('resolves API URLs from frontend and server environments', () => {
  assert.equal(resolveApiBaseUrl({ env: {}, runtimeEnv: {}, isBrowser: false }), '/');
  assert.equal(resolveApiBaseUrl({ env: { RSOS_API_BASE_URL: 'https://api.internal' }, runtimeEnv: {}, isBrowser: false }), 'https://api.internal');
  assert.equal(resolveApiBaseUrl({ env: {}, runtimeEnv: { VITE_API_BASE_URL: 'https://vite.example.com' }, isBrowser: true }), 'https://vite.example.com');
});

test('resolves ports with safe defaults and overrides', () => {
  assert.equal(resolvePort({ env: {}, isBrowser: false }), 3001);
  assert.equal(resolvePort({ env: { PORT: '5000' }, isBrowser: false }), 5000);
});

test('redacts sensitive values', () => {
  assert.equal(redactSensitiveValue('super-secret-value'), '[REDACTED]');
  assert.equal(redactSensitiveValue('plain-value'), 'plain-value');
});

test('exposes only frontend-safe configuration to the browser', () => {
  const safeConfig = getFrontendSafeConfig({
    env: { NODE_ENV: 'production', RSOS_API_BASE_URL: 'https://api.example.com', RSOS_SECRET: 'abc123' },
    runtimeEnv: {},
    isBrowser: true,
  });

  assert.equal(safeConfig.apiBaseUrl, 'https://api.example.com');
  assert.equal(safeConfig.mode, 'production');
  assert.equal(safeConfig.RSOS_SECRET, undefined);
});

test('uses local fallback behavior when no override is present', () => {
  const config = buildRuntimeConfig({
    env: { NODE_ENV: 'development' },
    runtimeEnv: {},
    isBrowser: false,
    requireProductionConfig: false,
  });

  assert.equal(config.localFallbackEnabled, true);
  assert.equal(config.allowedOrigins.includes('http://localhost:5173'), true);
});

test('respects configured CORS origins and admin tokens', () => {
  const config = buildRuntimeConfig({
    env: {
      NODE_ENV: 'production',
      PORT: '4000',
      RSOS_API_BASE_URL: 'https://api.example.com',
      RSOS_ALLOWED_ORIGINS: 'https://app.example.com,https://admin.example.com',
      RSOS_ADMIN_TOKEN: 'super-secret',
    },
    runtimeEnv: {},
    isBrowser: false,
    requireProductionConfig: true,
  });

  assert.equal(config.adminToken, 'super-secret');
  assert.equal(config.allowedOrigins.includes('https://app.example.com'), true);
  assert.equal(config.allowedOrigins.includes('https://admin.example.com'), true);
});
