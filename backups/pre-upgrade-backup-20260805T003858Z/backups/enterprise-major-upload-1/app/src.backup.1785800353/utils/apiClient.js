import { resolveApiBaseUrl } from './config.js';

function readConfiguredApiBaseUrl() {
  if (typeof globalThis !== 'undefined') {
    const runtimeEnv = globalThis.__RSOS_API_ENV__ || globalThis.importMetaEnv || {};
    if (runtimeEnv.VITE_API_BASE_URL) {
      return runtimeEnv.VITE_API_BASE_URL;
    }
  }
  const viteEnv = import.meta?.env || {};
  return viteEnv.VITE_API_BASE_URL || '';
}

export function getApiBaseUrl() {
  const runtimeEnv = typeof globalThis !== 'undefined' ? globalThis.__RSOS_API_ENV__ || globalThis.importMetaEnv || {} : {};
  const isBrowser = typeof window !== 'undefined';
  const resolved = resolveApiBaseUrl({
    env: { RSOS_API_BASE_URL: readConfiguredApiBaseUrl() },
    runtimeEnv,
    isBrowser,
  });
  return resolved;
}

export function buildApiUrl(pathname = '') {
  const normalizedPath = pathname.startsWith('/') ? pathname : `/${pathname}`;
  const baseUrl = getApiBaseUrl();
  if (baseUrl === '/') return normalizedPath;
  return `${baseUrl}${normalizedPath}`;
}

export function createApiHeaders(headers = {}) {
  return {
    'Content-Type': 'application/json',
    ...headers,
  };
}
