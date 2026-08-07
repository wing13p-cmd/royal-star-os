import { createHash, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { mkdir, readFile, writeFile, access } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const authDir = path.join(__dirname, 'data');
const authStateFile = path.join(authDir, 'auth-state.json');
const DEFAULT_TTL_MS = 1000 * 60 * 60;
const DEFAULT_FAILURE_WINDOW_MS = 1000 * 60 * 15;
const MAX_FAILURES = 5;

function safeId(prefix = 'session') {
  return `${prefix}-${Date.now()}-${randomBytes(4).toString('hex')}`;
}

function normalizeUsername(value = '') {
  return String(value || '').trim().toLowerCase();
}

function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const derived = scryptSync(password, salt, 64);
  return `${salt}:${derived.toString('hex')}`;
}

function verifyPassword(password, stored) {
  if (!stored || typeof stored !== 'string') return false;
  const [salt, hash] = stored.split(':');
  if (!salt || !hash) return false;
  const derived = scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, 'hex');
  const actual = Buffer.from(derived.toString('hex'), 'hex');
  return timingSafeEqual(expected, actual);
}

function sanitizeValue(value) {
  if (value === undefined || value === null || value === '') return '';
  return String(value).replace(/\s+/g, ' ').trim();
}

function hasValidPasswordHash(value) {
  if (typeof value !== 'string') return false;
  const [salt, hash] = value.split(':');
  return Boolean(salt && hash && /^[a-f0-9]+$/i.test(salt) && /^[a-f0-9]+$/i.test(hash));
}

async function ensureAuthDir() {
  await mkdir(authDir, { recursive: true });
}

async function readAuthState() {
  await ensureAuthDir();
  try {
    const content = await readFile(authStateFile, 'utf8');
    const parsed = JSON.parse(content);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

async function writeAuthState(state) {
  await ensureAuthDir();
  await writeFile(authStateFile, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
}

function buildDefaultAdminCredentials(env = {}) {
  const username = normalizeUsername(env.RSOS_ADMIN_USERNAME || env.ADMIN_USERNAME || 'brandon.sterling@royalstaros.com');
  const password = sanitizeValue(env.RSOS_ADMIN_PASSWORD || env.ADMIN_PASSWORD || 'RSOS-Admin-2026!');
  return { username, password };
}

export async function initializeAuthState(env = process.env) {
  const state = await readAuthState();
  const defaults = buildDefaultAdminCredentials(env);
  const defaultUsername = normalizeUsername(defaults.username || 'brandon.sterling@royalstaros.com');
  const defaultPassword = sanitizeValue(defaults.password || 'RSOS-Admin-2026!');
  const currentAdmin = state.admin || {};
  const hasExplicitAdminOverride = Boolean(env && (env.RSOS_ADMIN_USERNAME || env.RSOS_ADMIN_PASSWORD || env.ADMIN_USERNAME || env.ADMIN_PASSWORD));
  const hasExistingAdminState = Boolean(currentAdmin && typeof currentAdmin === 'object' && currentAdmin.username);
  const needsResetFromDefaults = !hasExistingAdminState || !hasValidPasswordHash(currentAdmin.passwordHash) || hasExplicitAdminOverride;
  const adminUsername = needsResetFromDefaults ? defaultUsername : normalizeUsername(currentAdmin.username || defaultUsername);
  const adminPassword = needsResetFromDefaults ? hashPassword(defaultPassword) : currentAdmin.passwordHash || hashPassword(defaultPassword);
  const nextState = {
    ...state,
    version: 1,
    admin: {
      id: currentAdmin.id || 'admin-brandon',
      username: adminUsername,
      displayName: currentAdmin.displayName || 'Brandon Sterling',
      role: 'System Administrator',
      passwordHash: adminPassword,
      createdAt: currentAdmin.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    sessions: Array.isArray(state.sessions) ? state.sessions : [],
    failedLogins: Array.isArray(state.failedLogins) ? state.failedLogins : [],
    settings: {
      ttlMs: Number(state.settings?.ttlMs) || DEFAULT_TTL_MS,
      failureWindowMs: Number(state.settings?.failureWindowMs) || DEFAULT_FAILURE_WINDOW_MS,
      maxFailures: Number(state.settings?.maxFailures) || MAX_FAILURES,
      ...state.settings,
    },
  };
  await writeAuthState(nextState);
  return nextState;
}

function pruneExpiredEntries(entries = [], now = Date.now()) {
  return entries.filter((entry) => !(entry.expiresAt && entry.expiresAt <= now));
}

export async function authenticateUser({ username, password, ipAddress }, env = process.env) {
  const state = await initializeAuthState(env);
  const now = Date.now();
  const failedLogins = pruneExpiredEntries(state.failedLogins || [], now).filter((entry) => entry.ipAddress === ipAddress);
  if (failedLogins.length >= (state.settings?.maxFailures || MAX_FAILURES)) {
    const oldest = failedLogins[failedLogins.length - 1];
    const windowMs = state.settings?.failureWindowMs || DEFAULT_FAILURE_WINDOW_MS;
    if (oldest && oldest.createdAt + windowMs > now) {
      return { ok: false, reason: 'locked_out', retryAt: oldest.createdAt + windowMs };
    }
  }

  const normalizedUsername = normalizeUsername(username);
  const admin = state.admin || {};
  if (normalizedUsername !== normalizeUsername(admin.username)) {
    const nextFailed = [...failedLogins, { ipAddress, createdAt: now, username: normalizedUsername }];
    const nextState = { ...state, failedLogins: nextFailed.slice(-10) };
    await writeAuthState(nextState);
    return { ok: false, reason: 'invalid_credentials' };
  }

  if (!verifyPassword(password, admin.passwordHash)) {
    const nextFailed = [...failedLogins, { ipAddress, createdAt: now, username: normalizedUsername }];
    const nextState = { ...state, failedLogins: nextFailed.slice(-10) };
    await writeAuthState(nextState);
    return { ok: false, reason: 'invalid_credentials' };
  }

  const sessionId = safeId('session');
  const ttlMs = Number(state.settings?.ttlMs) || DEFAULT_TTL_MS;
  const session = {
    id: sessionId,
    userId: admin.id,
    username: admin.username,
    displayName: admin.displayName,
    roles: [admin.role],
    isAdmin: true,
    createdAt: now,
    lastUsedAt: now,
    expiresAt: now + ttlMs,
    rotatedAt: now,
    ipAddress,
  };
  const nextState = {
    ...state,
    sessions: pruneExpiredEntries([...(state.sessions || []), session], now),
    failedLogins: [],
  };
  await writeAuthState(nextState);
  return { ok: true, session };
}

export async function verifySession(sessionId, ipAddress) {
  const state = await readAuthState();
  const now = Date.now();
  const sessions = pruneExpiredEntries(state.sessions || [], now);
  const session = sessions.find((entry) => entry.id === sessionId && entry.ipAddress === ipAddress);
  if (!session) return null;
  const ttlMs = Number(state.settings?.ttlMs) || DEFAULT_TTL_MS;
  const rotatedSession = { ...session, lastUsedAt: now, expiresAt: now + ttlMs, rotatedAt: now };
  const nextState = { ...state, sessions: sessions.map((entry) => (entry.id === sessionId ? rotatedSession : entry)) };
  await writeAuthState(nextState);
  return rotatedSession;
}

export async function logoutSession(sessionId) {
  const state = await readAuthState();
  const nextState = {
    ...state,
    sessions: (state.sessions || []).filter((session) => session.id !== sessionId),
  };
  await writeAuthState(nextState);
  return true;
}

export async function getAuthSummary() {
  const state = await readAuthState();
  const now = Date.now();
  const sessions = pruneExpiredEntries(state.sessions || [], now);
  return {
    adminUsername: state.admin?.username || '',
    sessionCount: sessions.length,
    failedLogins: (state.failedLogins || []).filter((entry) => entry.createdAt + (state.settings?.failureWindowMs || DEFAULT_FAILURE_WINDOW_MS) > now).length,
    ttlMs: Number(state.settings?.ttlMs) || DEFAULT_TTL_MS,
  };
}

export function redactAuthError(message = '') {
  return String(message || '').replace(/(password|token|secret|key)=([^\s]+)/gi, '$1=[REDACTED]').replace(/(Bearer)\s+([^\s]+)/gi, '$1 [REDACTED]');
}
