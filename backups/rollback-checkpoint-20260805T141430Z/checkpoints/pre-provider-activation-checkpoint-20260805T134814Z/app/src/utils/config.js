function normalizeBaseUrl(value = '') {
  if (!value) return '/';
  return String(value).trim().replace(/\/$/, '');
}

function normalizePort(value, fallback = 3001) {
  if (value === '' || value === null || value === undefined) return fallback;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function normalizeAllowedOrigins(value = '', defaults = []) {
  const values = String(value || '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);

  return Array.from(new Set([...values, ...defaults]));
}

function getEnvValue(env = {}, key) {
  const value = env[key];
  return value === undefined || value === null ? '' : String(value);
}

function isSensitiveKey(key = '') {
  return /secret|token|password|key|api[_-]?key/i.test(key);
}

export function redactSensitiveValue(value) {
  if (value === undefined || value === null || value === '') return value;
  return typeof value === 'string' && isSensitiveKey(value) ? '[REDACTED]' : value;
}

export function resolveApiBaseUrl(options = {}) {
  const env = options.env || {};
  const runtimeEnv = options.runtimeEnv || {};
  const isBrowser = Boolean(options.isBrowser);
  const browserOverride = runtimeEnv.VITE_API_BASE_URL || '';
  const serverOverride = getEnvValue(env, 'RSOS_API_BASE_URL') || getEnvValue(env, 'API_BASE_URL') || '';

  if (isBrowser) {
    return normalizeBaseUrl(browserOverride || serverOverride);
  }

  return normalizeBaseUrl(serverOverride || browserOverride);
}

export function resolvePort(options = {}) {
  const env = options.env || {};
  const fallback = options.fallbackPort || 3001;
  return normalizePort(getEnvValue(env, 'PORT') || '', fallback);
}

export function buildRuntimeConfig(options = {}) {
  const env = options.env || {};
  const runtimeEnv = options.runtimeEnv || {};
  const isBrowser = Boolean(options.isBrowser);
  const mode = String(getEnvValue(env, 'NODE_ENV') || 'development').toLowerCase() || 'development';
  const apiBaseUrl = resolveApiBaseUrl({ env, runtimeEnv, isBrowser });
  const port = resolvePort({ env, fallbackPort: options.fallbackPort || 3001 });
  const localFallbackEnabled = mode !== 'production';
  const defaultAllowedOrigins = [
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://localhost:4173',
    'http://127.0.0.1:4173',
    'http://localhost:4174',
    'http://127.0.0.1:4174',
  ];
  const allowedOrigins = normalizeAllowedOrigins(
    getEnvValue(env, 'RSOS_ALLOWED_ORIGINS') || getEnvValue(env, 'ALLOWED_ORIGINS'),
    defaultAllowedOrigins,
  );

  const config = {
    mode,
    port,
    apiBaseUrl,
    localFallbackEnabled,
    allowedOrigins,
    adminToken: getEnvValue(env, 'RSOS_ADMIN_TOKEN') || getEnvValue(env, 'ADMIN_TOKEN') || '',
    sessionSecret: getEnvValue(env, 'RSOS_SESSION_SECRET') || getEnvValue(env, 'SESSION_SECRET') || '',
    production: mode === 'production',
    frontendSafe: isBrowser,
  };

  if (options.requireProductionConfig && mode === 'production') {
    const missing = [];
    if (!getEnvValue(env, 'RSOS_API_BASE_URL') && !getEnvValue(env, 'API_BASE_URL')) missing.push('RSOS_API_BASE_URL or API_BASE_URL');
    if (!getEnvValue(env, 'PORT')) missing.push('PORT');
    if (missing.length) {
      throw new Error(`Missing required production configuration: ${missing.join(', ')}`);
    }
  }

  return config;
}

export function validateRuntimeConfig(config) {
  if (!config || typeof config !== 'object') {
    throw new Error('Runtime configuration is required');
  }
  if (!config.mode) {
    throw new Error('Runtime configuration must include a mode');
  }
  if (!config.port) {
    throw new Error('Runtime configuration must include a port');
  }
  if (config.production && !config.apiBaseUrl) {
    throw new Error('Production configuration requires an API base URL');
  }
  return config;
}

export function getFrontendSafeConfig(options = {}) {
  const config = buildRuntimeConfig(options);
  const safeConfig = {
    mode: config.mode,
    apiBaseUrl: config.apiBaseUrl,
    localFallbackEnabled: config.localFallbackEnabled,
    production: config.production,
  };
  return safeConfig;
}
