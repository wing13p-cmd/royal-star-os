import { createHash, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { mkdir, readFile, writeFile, rename, access, unlink } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  createMfaEnrollment,
  generateRecoveryCodes,
  hashRecoveryCode,
  verifyRecoveryCode,
  verifyTotpCode,
} from './mfaService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// Respect RSOS_DATA_DIR so auth state persists on Railway volumes.
const authDir = process.env.RSOS_DATA_DIR
  ? path.resolve(process.env.RSOS_DATA_DIR)
  : path.join(__dirname, 'data');
const authStateFile = path.join(authDir, 'auth-state.json');
const DEFAULT_TTL_MS = 1000 * 60 * 60;
const DEFAULT_FAILURE_WINDOW_MS = 1000 * 60 * 15;
const MAX_FAILURES = 5;
const DEFAULT_MFA_CHALLENGE_TTL_MS = 1000 * 60 * 5;
const DEFAULT_MFA_FAILURE_WINDOW_MS = 1000 * 60 * 5;
const DEFAULT_MFA_MAX_FAILURES = 5;
let authStateWriteQueue = Promise.resolve();

const DEFAULT_MFA_STATE = {
  enabled: false,
  secret: null,
  pendingSecret: null,
  recoveryCodeHashes: [],
  enabledAt: null,
};

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

function normalizeMfaState(value = {}) {
  const source = value && typeof value === 'object' ? value : {};
  return {
    enabled: Boolean(source.enabled && source.secret),
    secret: source.secret ? String(source.secret) : null,
    pendingSecret: source.pendingSecret ? String(source.pendingSecret) : null,
    recoveryCodeHashes: Array.isArray(source.recoveryCodeHashes)
      ? source.recoveryCodeHashes.map((entry) => String(entry || '')).filter(Boolean)
      : [],
    enabledAt: source.enabledAt ? String(source.enabledAt) : null,
  };
}

function normalizeIpAddress(ipAddress = '') {
  return sanitizeValue(ipAddress) || 'unknown';
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
  const operation = authStateWriteQueue.then(async () => {
    await ensureAuthDir();
    const tmpFile = `${authStateFile}.${process.pid}.${Date.now()}.${randomBytes(6).toString('hex')}.tmp`;
    try {
      await writeFile(tmpFile, `${JSON.stringify(state, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' });
      await rename(tmpFile, authStateFile);
    } catch (error) {
      await unlink(tmpFile).catch((cleanupError) => {
        if (cleanupError?.code !== 'ENOENT') throw cleanupError;
      });
      throw error;
    }
  });
  authStateWriteQueue = operation.catch(() => undefined);
  return operation;
}

function pruneExpiredSessions(entries = [], now = Date.now()) {
  return entries.filter((entry) => !(entry.expiresAt && entry.expiresAt <= now));
}

function pruneFailuresForWindow(entries = [], now = Date.now(), windowMs = DEFAULT_FAILURE_WINDOW_MS) {
  return entries.filter((entry) => Number(entry.createdAt || 0) + windowMs > now);
}

function pruneMfaChallenges(entries = [], now = Date.now()) {
  return entries.filter((entry) => {
    if (!entry || typeof entry !== 'object') return false;
    if (entry.usedAt) return false;
    return Number(entry.expiresAt || 0) > now;
  });
}

function buildSession(admin = {}, ipAddress = 'unknown', ttlMs = DEFAULT_TTL_MS, now = Date.now()) {
  return {
    id: safeId('session'),
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
}

function consumeRecoveryCodeHash(storedHashes = [], code = '', pepper = '') {
  const candidateHash = hashRecoveryCode(code, pepper);
  for (let index = 0; index < storedHashes.length; index += 1) {
    const storedHash = String(storedHashes[index] || '');
    const candidateBuffer = Buffer.from(candidateHash);
    const storedBuffer = Buffer.from(storedHash);
    if (
      candidateBuffer.length === storedBuffer.length
      && timingSafeEqual(candidateBuffer, storedBuffer)
    ) {
      const next = [...storedHashes.slice(0, index), ...storedHashes.slice(index + 1)];
      return { matched: true, remainingHashes: next };
    }
  }

  return { matched: false, remainingHashes: [...storedHashes] };
}

function buildDefaultAdminCredentials(env = {}) {
  const username = normalizeUsername(env.RSOS_ADMIN_USERNAME || env.ADMIN_USERNAME || '');
  const password = sanitizeValue(env.RSOS_ADMIN_PASSWORD || env.ADMIN_PASSWORD || '');
  return {
    username,
    password,
    provided: Boolean(username && password),
  };
}

export async function initializeAuthState(env = process.env) {
  const state = await readAuthState();
  const defaults = buildDefaultAdminCredentials(env);
  const currentAdmin = state.admin || {};
  const hasExplicitAdminOverride = Boolean(env && (env.RSOS_ADMIN_USERNAME || env.RSOS_ADMIN_PASSWORD || env.ADMIN_USERNAME || env.ADMIN_PASSWORD));
  const hasExistingAdminState = Boolean(
    currentAdmin
    && typeof currentAdmin === 'object'
    && currentAdmin.username
    && hasValidPasswordHash(currentAdmin.passwordHash),
  );

  if (!hasExistingAdminState && !defaults.provided) {
    throw new Error('Missing admin bootstrap credentials. Set RSOS_ADMIN_USERNAME and RSOS_ADMIN_PASSWORD.');
  }

  if (hasExplicitAdminOverride && !defaults.provided) {
    throw new Error('Admin override requires both username and password.');
  }

  const needsResetFromDefaults = !hasExistingAdminState || hasExplicitAdminOverride;
  const adminUsername = needsResetFromDefaults
    ? normalizeUsername(defaults.username)
    : normalizeUsername(currentAdmin.username || defaults.username);
  const adminPassword = needsResetFromDefaults
    ? hashPassword(defaults.password)
    : currentAdmin.passwordHash;
  const nextState = {
    ...state,
    version: 1,
    admin: {
      id: currentAdmin.id || 'admin-brandon',
      username: adminUsername,
      displayName: currentAdmin.displayName || 'Brandon Sterling',
      role: 'System Administrator',
      passwordHash: adminPassword,
      mfa: normalizeMfaState(currentAdmin.mfa || DEFAULT_MFA_STATE),
      createdAt: currentAdmin.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    sessions: Array.isArray(state.sessions) ? state.sessions : [],
    failedLogins: Array.isArray(state.failedLogins) ? state.failedLogins : [],
    mfaChallenges: Array.isArray(state.mfaChallenges) ? state.mfaChallenges : [],
    mfaFailures: Array.isArray(state.mfaFailures) ? state.mfaFailures : [],
    settings: {
      ttlMs: Number(state.settings?.ttlMs) || DEFAULT_TTL_MS,
      failureWindowMs: Number(state.settings?.failureWindowMs) || DEFAULT_FAILURE_WINDOW_MS,
      maxFailures: Number(state.settings?.maxFailures) || MAX_FAILURES,
      mfaChallengeTtlMs: Number(state.settings?.mfaChallengeTtlMs) || DEFAULT_MFA_CHALLENGE_TTL_MS,
      mfaFailureWindowMs: Number(state.settings?.mfaFailureWindowMs) || DEFAULT_MFA_FAILURE_WINDOW_MS,
      mfaMaxFailures: Number(state.settings?.mfaMaxFailures) || DEFAULT_MFA_MAX_FAILURES,
      ...state.settings,
    },
  };
  await writeAuthState(nextState);
  return nextState;
}

export async function authenticateUser({ username, password, ipAddress }, env = process.env) {
  const state = await initializeAuthState(env);
  const now = Date.now();
  const normalizedIp = normalizeIpAddress(ipAddress);
  const failedLogins = pruneFailuresForWindow(
    (state.failedLogins || []).filter((entry) => entry.ipAddress === normalizedIp),
    now,
    state.settings?.failureWindowMs || DEFAULT_FAILURE_WINDOW_MS,
  );
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
    const nextFailed = [...failedLogins, { ipAddress: normalizedIp, createdAt: now, username: normalizedUsername }];
    const nextState = {
      ...state,
      failedLogins: nextFailed.slice(-10),
      sessions: pruneExpiredSessions(state.sessions || [], now),
      mfaChallenges: pruneMfaChallenges(state.mfaChallenges || [], now),
      mfaFailures: pruneFailuresForWindow(state.mfaFailures || [], now, state.settings?.mfaFailureWindowMs || DEFAULT_MFA_FAILURE_WINDOW_MS),
    };
    await writeAuthState(nextState);
    return { ok: false, reason: 'invalid_credentials' };
  }

  if (!verifyPassword(password, admin.passwordHash)) {
    const nextFailed = [...failedLogins, { ipAddress: normalizedIp, createdAt: now, username: normalizedUsername }];
    const nextState = {
      ...state,
      failedLogins: nextFailed.slice(-10),
      sessions: pruneExpiredSessions(state.sessions || [], now),
      mfaChallenges: pruneMfaChallenges(state.mfaChallenges || [], now),
      mfaFailures: pruneFailuresForWindow(state.mfaFailures || [], now, state.settings?.mfaFailureWindowMs || DEFAULT_MFA_FAILURE_WINDOW_MS),
    };
    await writeAuthState(nextState);
    return { ok: false, reason: 'invalid_credentials' };
  }

  const ttlMs = Number(state.settings?.ttlMs) || DEFAULT_TTL_MS;
  const mfaState = normalizeMfaState(admin.mfa || DEFAULT_MFA_STATE);

  if (mfaState.enabled && mfaState.secret) {
    const challengeTtlMs = Number(state.settings?.mfaChallengeTtlMs) || DEFAULT_MFA_CHALLENGE_TTL_MS;
    const challengeId = safeId('mfa');
    const challenge = {
      id: challengeId,
      userId: admin.id,
      username: admin.username,
      ipAddress: normalizedIp,
      createdAt: now,
      expiresAt: now + challengeTtlMs,
      attemptCount: 0,
    };

    const nextState = {
      ...state,
      sessions: pruneExpiredSessions(state.sessions || [], now),
      failedLogins: [],
      mfaChallenges: [...pruneMfaChallenges(state.mfaChallenges || [], now), challenge],
      mfaFailures: pruneFailuresForWindow(state.mfaFailures || [], now, state.settings?.mfaFailureWindowMs || DEFAULT_MFA_FAILURE_WINDOW_MS),
    };

    await writeAuthState(nextState);
    return {
      ok: true,
      mfaRequired: true,
      challengeId,
      expiresInSeconds: Math.floor(challengeTtlMs / 1000),
    };
  }

  const session = buildSession(admin, normalizedIp, ttlMs, now);
  const nextState = {
    ...state,
    sessions: [...pruneExpiredSessions(state.sessions || [], now), session],
    failedLogins: [],
    mfaChallenges: pruneMfaChallenges(state.mfaChallenges || [], now),
    mfaFailures: pruneFailuresForWindow(state.mfaFailures || [], now, state.settings?.mfaFailureWindowMs || DEFAULT_MFA_FAILURE_WINDOW_MS),
  };
  await writeAuthState(nextState);
  return { ok: true, session };
}

export async function verifyMfaLoginChallenge({ challengeId, code, ipAddress }, env = process.env) {
  const state = await initializeAuthState(env);
  const now = Date.now();
  const normalizedIp = normalizeIpAddress(ipAddress);
  const mfaFailureWindowMs = Number(state.settings?.mfaFailureWindowMs) || DEFAULT_MFA_FAILURE_WINDOW_MS;
  const maxMfaFailures = Number(state.settings?.mfaMaxFailures) || DEFAULT_MFA_MAX_FAILURES;
  const activeMfaFailures = pruneFailuresForWindow(
    (state.mfaFailures || []).filter((entry) => entry.ipAddress === normalizedIp),
    now,
    mfaFailureWindowMs,
  );

  const recordFailedAttempt = async () => {
    const nextFailures = [...activeMfaFailures, { ipAddress: normalizedIp, createdAt: now }].slice(-25);
    await writeAuthState({
      ...state,
      sessions: pruneExpiredSessions(state.sessions || [], now),
      failedLogins: pruneFailuresForWindow(state.failedLogins || [], now, state.settings?.failureWindowMs || DEFAULT_FAILURE_WINDOW_MS),
      mfaChallenges: pruneMfaChallenges(state.mfaChallenges || [], now)
        .map((entry) => (entry.id === challengeId ? { ...entry, attemptCount: Number(entry.attemptCount || 0) + 1 } : entry))
        .filter((entry) => Number(entry.attemptCount || 0) < maxMfaFailures),
      mfaFailures: nextFailures,
    });
  };

  if (activeMfaFailures.length >= maxMfaFailures) {
    return { ok: false, reason: 'invalid_credentials' };
  }

  const challenges = pruneMfaChallenges(state.mfaChallenges || [], now);
  const challenge = challenges.find((entry) => entry.id === String(challengeId || '') && entry.ipAddress === normalizedIp);

  if (!challenge) {
    await recordFailedAttempt();
    return { ok: false, reason: 'invalid_credentials' };
  }

  const admin = state.admin || {};
  const mfaState = normalizeMfaState(admin.mfa || DEFAULT_MFA_STATE);
  if (!mfaState.enabled || !mfaState.secret) {
    await recordFailedAttempt();
    return { ok: false, reason: 'invalid_credentials' };
  }

  const candidateCode = sanitizeValue(code);
  const pepper = sanitizeValue(env.RSOS_MFA_RECOVERY_PEPPER || env.MFA_RECOVERY_PEPPER || '');
  const totpValid = verifyTotpCode(mfaState.secret, candidateCode, { timestamp: now });
  const recoveryValid = !totpValid && verifyRecoveryCode(candidateCode, mfaState.recoveryCodeHashes || [], pepper);

  if (!totpValid && !recoveryValid) {
    await recordFailedAttempt();
    return { ok: false, reason: 'invalid_credentials' };
  }

  const ttlMs = Number(state.settings?.ttlMs) || DEFAULT_TTL_MS;
  const session = buildSession(admin, normalizedIp, ttlMs, now);
  const remainingRecoveryHashes = recoveryValid
    ? consumeRecoveryCodeHash(mfaState.recoveryCodeHashes || [], candidateCode, pepper).remainingHashes
    : (mfaState.recoveryCodeHashes || []);

  const nextState = {
    ...state,
    admin: {
      ...admin,
      mfa: {
        ...mfaState,
        recoveryCodeHashes: remainingRecoveryHashes,
      },
      updatedAt: new Date().toISOString(),
    },
    sessions: [...pruneExpiredSessions(state.sessions || [], now), session],
    failedLogins: [],
    mfaChallenges: challenges.filter((entry) => entry.id !== challenge.id),
    mfaFailures: pruneFailuresForWindow(state.mfaFailures || [], now, mfaFailureWindowMs)
      .filter((entry) => entry.ipAddress !== normalizedIp),
  };
  await writeAuthState(nextState);
  return { ok: true, session, recoveryCodeUsed: recoveryValid };
}

export async function verifySession(sessionId, ipAddress) {
  const state = await initializeAuthState(process.env);
  const now = Date.now();
  const normalizedIp = normalizeIpAddress(ipAddress);
  const sessions = pruneExpiredSessions(state.sessions || [], now);
  const session = sessions.find((entry) => entry.id === sessionId && entry.ipAddress === normalizedIp);
  if (!session) return null;
  const ttlMs = Number(state.settings?.ttlMs) || DEFAULT_TTL_MS;
  const rotatedSession = { ...session, lastUsedAt: now, expiresAt: now + ttlMs, rotatedAt: now };
  const nextState = {
    ...state,
    sessions: sessions.map((entry) => (entry.id === sessionId ? rotatedSession : entry)),
    mfaChallenges: pruneMfaChallenges(state.mfaChallenges || [], now),
    mfaFailures: pruneFailuresForWindow(state.mfaFailures || [], now, state.settings?.mfaFailureWindowMs || DEFAULT_MFA_FAILURE_WINDOW_MS),
  };
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
  const state = await initializeAuthState(process.env);
  const now = Date.now();
  const sessions = pruneExpiredSessions(state.sessions || [], now);
  return {
    adminUsername: state.admin?.username || '',
    mfaEnabled: Boolean(state.admin?.mfa?.enabled),
    sessionCount: sessions.length,
    failedLogins: (state.failedLogins || []).filter((entry) => entry.createdAt + (state.settings?.failureWindowMs || DEFAULT_FAILURE_WINDOW_MS) > now).length,
    ttlMs: Number(state.settings?.ttlMs) || DEFAULT_TTL_MS,
  };
}

export async function beginMfaEnrollment(sessionId, ipAddress) {
  const state = await initializeAuthState(process.env);
  const now = Date.now();
  const normalizedIp = normalizeIpAddress(ipAddress);
  const sessions = pruneExpiredSessions(state.sessions || [], now);
  const session = sessions.find((entry) => entry.id === sessionId && entry.ipAddress === normalizedIp);
  if (!session || !session.isAdmin) return { ok: false, reason: 'session_expired' };

  const admin = state.admin || {};
  const mfa = normalizeMfaState(admin.mfa || DEFAULT_MFA_STATE);
  const enrollment = createMfaEnrollment({ accountName: admin.username || session.username || 'admin' });

  const nextState = {
    ...state,
    admin: {
      ...admin,
      mfa: {
        ...mfa,
        pendingSecret: enrollment.secret,
      },
      updatedAt: new Date().toISOString(),
    },
    sessions,
    mfaChallenges: pruneMfaChallenges(state.mfaChallenges || [], now),
    mfaFailures: pruneFailuresForWindow(state.mfaFailures || [], now, state.settings?.mfaFailureWindowMs || DEFAULT_MFA_FAILURE_WINDOW_MS),
  };

  await writeAuthState(nextState);
  return {
    ok: true,
    enabled: false,
    secret: enrollment.secret,
    otpauthUrl: enrollment.otpauthUrl,
  };
}

export async function confirmMfaEnrollment(sessionId, ipAddress, code) {
  const state = await initializeAuthState(process.env);
  const now = Date.now();
  const normalizedIp = normalizeIpAddress(ipAddress);
  const sessions = pruneExpiredSessions(state.sessions || [], now);
  const session = sessions.find((entry) => entry.id === sessionId && entry.ipAddress === normalizedIp);
  if (!session || !session.isAdmin) return { ok: false, reason: 'session_expired' };

  const admin = state.admin || {};
  const mfa = normalizeMfaState(admin.mfa || DEFAULT_MFA_STATE);
  if (!mfa.pendingSecret) {
    return { ok: false, reason: 'enrollment_not_started' };
  }

  if (!verifyTotpCode(mfa.pendingSecret, code, { timestamp: now })) {
    return { ok: false, reason: 'invalid_code' };
  }

  const pepper = sanitizeValue(process.env.RSOS_MFA_RECOVERY_PEPPER || process.env.MFA_RECOVERY_PEPPER || '');
  const recoveryCodes = generateRecoveryCodes({ count: 10, pepper });

  const nextState = {
    ...state,
    admin: {
      ...admin,
      mfa: {
        enabled: true,
        secret: mfa.pendingSecret,
        pendingSecret: null,
        recoveryCodeHashes: recoveryCodes.map((entry) => entry.hash),
        enabledAt: new Date(now).toISOString(),
      },
      updatedAt: new Date().toISOString(),
    },
    sessions,
    mfaChallenges: pruneMfaChallenges(state.mfaChallenges || [], now),
    mfaFailures: pruneFailuresForWindow(state.mfaFailures || [], now, state.settings?.mfaFailureWindowMs || DEFAULT_MFA_FAILURE_WINDOW_MS),
  };
  await writeAuthState(nextState);

  return {
    ok: true,
    enabled: true,
    recoveryCodes: recoveryCodes.map((entry) => entry.code),
  };
}

export async function getMfaStatus(sessionId, ipAddress) {
  const session = await verifySession(sessionId, ipAddress);
  if (!session || !session.isAdmin) {
    return { ok: false, reason: 'session_expired' };
  }

  const state = await readAuthState();
  const mfa = normalizeMfaState(state.admin?.mfa || DEFAULT_MFA_STATE);
  return {
    ok: true,
    enabled: Boolean(mfa.enabled),
    enrolled: Boolean(mfa.secret),
    recoveryCodesRemaining: Array.isArray(mfa.recoveryCodeHashes) ? mfa.recoveryCodeHashes.length : 0,
  };
}

export async function disableMfa(sessionId, ipAddress, password, codeOrRecoveryCode) {
  const state = await initializeAuthState(process.env);
  const now = Date.now();
  const normalizedIp = normalizeIpAddress(ipAddress);
  const sessions = pruneExpiredSessions(state.sessions || [], now);
  const session = sessions.find((entry) => entry.id === sessionId && entry.ipAddress === normalizedIp);
  if (!session || !session.isAdmin) return { ok: false, reason: 'session_expired' };

  const admin = state.admin || {};
  if (!verifyPassword(password, admin.passwordHash)) {
    return { ok: false, reason: 'invalid_credentials' };
  }

  const mfa = normalizeMfaState(admin.mfa || DEFAULT_MFA_STATE);
  if (!mfa.enabled || !mfa.secret) {
    return { ok: true, disabled: true };
  }

  const candidateCode = sanitizeValue(codeOrRecoveryCode);
  const pepper = sanitizeValue(process.env.RSOS_MFA_RECOVERY_PEPPER || process.env.MFA_RECOVERY_PEPPER || '');
  const validTotp = verifyTotpCode(mfa.secret, candidateCode, { timestamp: now });
  const validRecovery = !validTotp && verifyRecoveryCode(candidateCode, mfa.recoveryCodeHashes || [], pepper);
  if (!validTotp && !validRecovery) {
    return { ok: false, reason: 'invalid_code' };
  }

  const nextState = {
    ...state,
    admin: {
      ...admin,
      mfa: { ...DEFAULT_MFA_STATE },
      updatedAt: new Date().toISOString(),
    },
    sessions,
    mfaChallenges: pruneMfaChallenges(state.mfaChallenges || [], now),
    mfaFailures: pruneFailuresForWindow(state.mfaFailures || [], now, state.settings?.mfaFailureWindowMs || DEFAULT_MFA_FAILURE_WINDOW_MS),
  };
  await writeAuthState(nextState);
  return { ok: true, disabled: true };
}

export function redactAuthError(message = '') {
  return String(message || '').replace(/(password|token|secret|key)=([^\s]+)/gi, '$1=[REDACTED]').replace(/(Bearer)\s+([^\s]+)/gi, '$1 [REDACTED]');
}
