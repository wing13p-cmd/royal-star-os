import { createHash } from 'node:crypto';

const DEFAULT_ALLOWED_FIELDS = [];
const DEFAULT_PROTECTED_FIELDS = ['id', 'createdAt', 'updatedAt', 'role', 'roles', 'permissions', 'isAdmin'];

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function sanitizeText(value) {
  if (typeof value !== 'string') return value;
  const withoutScripts = value.replace(/<script[^>]*>.*?<\/script>/gis, ' ').replace(/<[^>]*>/g, ' ');
  return withoutScripts.replace(/\s+/g, ' ').trim();
}

function stripDangerousKeys(input = {}, options = {}) {
  const allowedFields = new Set(options.allowedFields || DEFAULT_ALLOWED_FIELDS);
  const protectedFields = new Set(options.protectedFields || DEFAULT_PROTECTED_FIELDS);
  const result = Object.create(null);

  for (const [key, value] of Object.entries(input || {})) {
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') continue;
    if (protectedFields.has(key)) continue;
    if (allowedFields.size > 0 && !allowedFields.has(key)) continue;
    if (isPlainObject(value)) {
      result[key] = stripDangerousKeys(value, options);
    } else if (Array.isArray(value)) {
      result[key] = value.map((entry) => (isPlainObject(entry) ? stripDangerousKeys(entry, options) : sanitizeText(entry)));
    } else if (typeof value === 'string') {
      result[key] = sanitizeText(value);
    } else {
      result[key] = value;
    }
  }

  return result;
}

export function sanitizePayload(payload = {}, options = {}) {
  if (!isPlainObject(payload)) return {};
  return stripDangerousKeys(payload, options);
}

export function validateNumericRange(value, { min = 0, max = null } = {}) {
  if (value === '' || value === null || value === undefined) {
    return { valid: true, value };
  }
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    return { valid: false, value, reason: 'must be numeric' };
  }
  if (min !== null && numericValue < min) {
    return { valid: false, value: numericValue, reason: `must be >= ${min}` };
  }
  if (max !== null && numericValue > max) {
    return { valid: false, value: numericValue, reason: `must be <= ${max}` };
  }
  return { valid: true, value: numericValue };
}

export function getRequestContext(req = {}, options = {}) {
  const headers = req.headers || {};
  const environment = options.env || process.env || {};
  const host = String(headers.host || '').toLowerCase();
  const isLocalHost = host.includes('127.0.0.1') || host.includes('localhost') || host.includes('::1');
  const authHeader = String(headers.authorization || headers.Authorization || '').trim();
  const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  const adminTokenHeader = [headers['x-rsos-admin-token'], headers['x-admin-token'], headers['x-api-key']]
    .map((value) => (typeof value === 'string' ? value.trim() : ''))
    .find(Boolean) || '';
  const adminToken = String(environment.RSOS_ADMIN_TOKEN || environment.ADMIN_TOKEN || '').trim();
  const user = req.user || {};
  const roles = Array.isArray(user.roles) ? user.roles : [];
  const tokenMatches = Boolean(adminToken && [bearerToken, adminTokenHeader].some((token) => token && adminToken === token));
  const isAdmin = Boolean(user.isAdmin)
    || roles.includes('System Administrator')
    || roles.includes('admin')
    || isLocalHost
    || tokenMatches;
  return {
    requestId: createHash('sha256').update(`${Date.now()}-${Math.random()}`).digest('hex').slice(0, 12),
    isLocalHost,
    isAdmin,
    userId: user.id || 'anonymous',
    roles,
    method: req.method || 'GET',
    path: req.url || '/',
  };
}

export function hasPermission(context = {}, action = 'read') {
  if (context.isAdmin) return true;
  const roles = Array.isArray(context.roles) ? context.roles : [];
  const rolePermissions = {
    'System Administrator': ['read', 'write', 'approve', 'delete', 'export', 'admin'],
    admin: ['read', 'write', 'approve', 'delete', 'export', 'admin'],
  };
  return roles.some((role) => (rolePermissions[role] || []).includes(action));
}
