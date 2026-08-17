import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  initializeAuthState,
  authenticateUser,
  verifySession,
  logoutSession,
  beginMfaEnrollment,
  confirmMfaEnrollment,
  getMfaStatus,
  disableMfa,
  verifyMfaLoginChallenge,
} from './authService.js';
import { generateTotpCode } from './mfaService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const authStateFile = path.join(__dirname, 'data', 'auth-state.json');
let originalAuthStateContent = null;
let originalAuthStateExists = false;

async function resetAuthState(payload = {}) {
  await mkdir(path.dirname(authStateFile), { recursive: true });
  await writeFile(authStateFile, JSON.stringify(payload, null, 2), 'utf8');
}

async function readAuthStateFile() {
  return JSON.parse(await readFile(authStateFile, 'utf8'));
}

before(async () => {
  originalAuthStateExists = existsSync(authStateFile);
  if (originalAuthStateExists) {
    originalAuthStateContent = await readFile(authStateFile, 'utf8');
  }
});

test('initializes a first-run admin account and authenticates it', async () => {
  await resetAuthState({});
  const state = await initializeAuthState({ RSOS_ADMIN_USERNAME: 'brandon@example.com', RSOS_ADMIN_PASSWORD: 'StrongPass123!' });
  assert.equal(state.admin.username, 'brandon@example.com');
  assert.deepEqual(state.admin.mfa, {
    enabled: false,
    secret: null,
    pendingSecret: null,
    recoveryCodeHashes: [],
    enabledAt: null,
  });

  const authResult = await authenticateUser({ username: 'brandon@example.com', password: 'StrongPass123!', ipAddress: '127.0.0.1' });
  assert.equal(authResult.ok, true);
  assert.equal(authResult.mfaRequired, undefined);
  assert.equal(authResult.session.username, 'brandon@example.com');

  const verified = await verifySession(authResult.session.id, '127.0.0.1');
  assert.ok(verified);

  await logoutSession(authResult.session.id);
  const afterLogout = await verifySession(authResult.session.id, '127.0.0.1');
  assert.equal(afterLogout, null);
});

test('reinitializes the admin account using provided credentials when stale state exists', async () => {
  await mkdir(path.dirname(authStateFile), { recursive: true });
  await writeFile(authStateFile, JSON.stringify({ admin: { username: 'stale@example.com', passwordHash: 'stale' } }, null, 2));

  const state = await initializeAuthState({ RSOS_ADMIN_USERNAME: 'admin.reset@example.com', RSOS_ADMIN_PASSWORD: 'ResetPass123!' });
  assert.equal(state.admin.username, 'admin.reset@example.com');
  assert.equal(state.admin.role, 'System Administrator');
});

test('missing bootstrap credentials fails when auth state is missing', async () => {
  await resetAuthState({});
  await assert.rejects(() => initializeAuthState({}), /Missing admin bootstrap credentials/i);
});

test('legacy auth-state without mfa migrates safely', async () => {
  await resetAuthState({
    admin: {
      id: 'admin-brandon',
      username: 'legacy@example.com',
      displayName: 'Legacy Admin',
      role: 'System Administrator',
      passwordHash: 'stale',
      createdAt: new Date().toISOString(),
    },
  });

  const state = await initializeAuthState({ RSOS_ADMIN_USERNAME: 'legacy@example.com', RSOS_ADMIN_PASSWORD: 'LegacyPass123!' });
  assert.equal(Boolean(state.admin.mfa), true);
  assert.equal(state.admin.mfa.enabled, false);
  assert.equal(state.admin.mfa.secret, null);
  assert.deepEqual(state.admin.mfa.recoveryCodeHashes, []);
});

test('begin enrollment requires authenticated session', async () => {
  await resetAuthState({});
  await initializeAuthState({ RSOS_ADMIN_USERNAME: 'admin@example.com', RSOS_ADMIN_PASSWORD: 'StartPass123!' });

  const begin = await beginMfaEnrollment('missing-session', '127.0.0.1');
  assert.equal(begin.ok, false);
});

test('begin enrollment creates pending secret and does not enable mfa', async () => {
  await resetAuthState({});
  await initializeAuthState({ RSOS_ADMIN_USERNAME: 'admin@example.com', RSOS_ADMIN_PASSWORD: 'StartPass123!' });
  const login = await authenticateUser({ username: 'admin@example.com', password: 'StartPass123!', ipAddress: '127.0.0.1' });

  const begin = await beginMfaEnrollment(login.session.id, '127.0.0.1');
  assert.equal(begin.ok, true);
  assert.equal(begin.enabled, false);
  assert.ok(begin.secret);
  assert.match(begin.otpauthUrl, /^otpauth:\/\/totp\//);

  const state = await readAuthStateFile();
  assert.equal(state.admin.mfa.enabled, false);
  assert.equal(Boolean(state.admin.mfa.pendingSecret), true);
});

test('confirm enrollment rejects wrong code and enables on correct code', async () => {
  await resetAuthState({});
  await initializeAuthState({ RSOS_ADMIN_USERNAME: 'admin@example.com', RSOS_ADMIN_PASSWORD: 'StartPass123!' });
  const login = await authenticateUser({ username: 'admin@example.com', password: 'StartPass123!', ipAddress: '127.0.0.1' });
  const begin = await beginMfaEnrollment(login.session.id, '127.0.0.1');

  const wrong = await confirmMfaEnrollment(login.session.id, '127.0.0.1', '000000');
  assert.equal(wrong.ok, false);

  const correctCode = generateTotpCode(begin.secret, { timestamp: Date.now() });
  const confirmed = await confirmMfaEnrollment(login.session.id, '127.0.0.1', correctCode);
  assert.equal(confirmed.ok, true);
  assert.equal(Array.isArray(confirmed.recoveryCodes), true);
  assert.equal(confirmed.recoveryCodes.length, 10);

  const state = await readAuthStateFile();
  assert.equal(state.admin.mfa.enabled, true);
  assert.equal(Boolean(state.admin.mfa.secret), true);
  assert.equal(state.admin.mfa.pendingSecret, null);
  assert.equal(state.admin.mfa.recoveryCodeHashes.length, 10);
  assert.equal(typeof state.admin.mfa.recoveryCodeHashes[0], 'string');
  assert.equal(JSON.stringify(state).includes(confirmed.recoveryCodes[0]), false);
});

test('user with mfa enabled receives challenge and no immediate final session', async () => {
  await resetAuthState({});
  await initializeAuthState({ RSOS_ADMIN_USERNAME: 'admin@example.com', RSOS_ADMIN_PASSWORD: 'StartPass123!' });
  const login = await authenticateUser({ username: 'admin@example.com', password: 'StartPass123!', ipAddress: '127.0.0.1' });
  const begin = await beginMfaEnrollment(login.session.id, '127.0.0.1');
  const code = generateTotpCode(begin.secret, { timestamp: Date.now() });
  await confirmMfaEnrollment(login.session.id, '127.0.0.1', code);

  const challengeLogin = await authenticateUser({ username: 'admin@example.com', password: 'StartPass123!', ipAddress: '127.0.0.1' });
  assert.equal(challengeLogin.ok, true);
  assert.equal(challengeLogin.mfaRequired, true);
  assert.ok(challengeLogin.challengeId);
  assert.equal(Boolean(challengeLogin.session), false);
});

test('mfa challenge verifies with current totp and cannot be reused', async () => {
  await resetAuthState({});
  await initializeAuthState({ RSOS_ADMIN_USERNAME: 'admin@example.com', RSOS_ADMIN_PASSWORD: 'StartPass123!' });
  const login = await authenticateUser({ username: 'admin@example.com', password: 'StartPass123!', ipAddress: '127.0.0.1' });
  const begin = await beginMfaEnrollment(login.session.id, '127.0.0.1');
  await confirmMfaEnrollment(login.session.id, '127.0.0.1', generateTotpCode(begin.secret, { timestamp: Date.now() }));

  const challenge = await authenticateUser({ username: 'admin@example.com', password: 'StartPass123!', ipAddress: '127.0.0.1' });
  const verifyResult = await verifyMfaLoginChallenge({
    challengeId: challenge.challengeId,
    code: generateTotpCode(begin.secret, { timestamp: Date.now() }),
    ipAddress: '127.0.0.1',
  });
  assert.equal(verifyResult.ok, true);
  assert.ok(verifyResult.session?.id);

  const reused = await verifyMfaLoginChallenge({
    challengeId: challenge.challengeId,
    code: generateTotpCode(begin.secret, { timestamp: Date.now() }),
    ipAddress: '127.0.0.1',
  });
  assert.equal(reused.ok, false);
});

test('wrong or expired mfa challenge verification is rejected', async () => {
  await resetAuthState({});
  await initializeAuthState({ RSOS_ADMIN_USERNAME: 'admin@example.com', RSOS_ADMIN_PASSWORD: 'StartPass123!' });
  const login = await authenticateUser({ username: 'admin@example.com', password: 'StartPass123!', ipAddress: '127.0.0.1' });
  const begin = await beginMfaEnrollment(login.session.id, '127.0.0.1');
  await confirmMfaEnrollment(login.session.id, '127.0.0.1', generateTotpCode(begin.secret, { timestamp: Date.now() }));

  const challenge = await authenticateUser({ username: 'admin@example.com', password: 'StartPass123!', ipAddress: '127.0.0.1' });
  const wrong = await verifyMfaLoginChallenge({ challengeId: challenge.challengeId, code: '000000', ipAddress: '127.0.0.1' });
  assert.equal(wrong.ok, false);

  const state = await readAuthStateFile();
  state.mfaChallenges = (state.mfaChallenges || []).map((entry) => (
    entry.id === challenge.challengeId ? { ...entry, expiresAt: Date.now() - 1000 } : entry
  ));
  await writeFile(authStateFile, JSON.stringify(state, null, 2));

  const expired = await verifyMfaLoginChallenge({
    challengeId: challenge.challengeId,
    code: generateTotpCode(begin.secret, { timestamp: Date.now() }),
    ipAddress: '127.0.0.1',
  });
  assert.equal(expired.ok, false);
});

test('recovery codes are single-use during mfa login', async () => {
  await resetAuthState({});
  await initializeAuthState({ RSOS_ADMIN_USERNAME: 'admin@example.com', RSOS_ADMIN_PASSWORD: 'StartPass123!' });
  const login = await authenticateUser({ username: 'admin@example.com', password: 'StartPass123!', ipAddress: '127.0.0.1' });
  const begin = await beginMfaEnrollment(login.session.id, '127.0.0.1');
  const confirmed = await confirmMfaEnrollment(login.session.id, '127.0.0.1', generateTotpCode(begin.secret, { timestamp: Date.now() }));
  const recoveryCode = confirmed.recoveryCodes[0];

  const challenge = await authenticateUser({ username: 'admin@example.com', password: 'StartPass123!', ipAddress: '127.0.0.1' });
  const verified = await verifyMfaLoginChallenge({ challengeId: challenge.challengeId, code: recoveryCode, ipAddress: '127.0.0.1' });
  assert.equal(verified.ok, true);
  assert.equal(verified.recoveryCodeUsed, true);

  const secondChallenge = await authenticateUser({ username: 'admin@example.com', password: 'StartPass123!', ipAddress: '127.0.0.1' });
  const reused = await verifyMfaLoginChallenge({ challengeId: secondChallenge.challengeId, code: recoveryCode, ipAddress: '127.0.0.1' });
  assert.equal(reused.ok, false);
});

test('disable mfa requires valid password and valid totp/recovery code', async () => {
  await resetAuthState({});
  await initializeAuthState({ RSOS_ADMIN_USERNAME: 'admin@example.com', RSOS_ADMIN_PASSWORD: 'StartPass123!' });
  const login = await authenticateUser({ username: 'admin@example.com', password: 'StartPass123!', ipAddress: '127.0.0.1' });
  const begin = await beginMfaEnrollment(login.session.id, '127.0.0.1');
  await confirmMfaEnrollment(login.session.id, '127.0.0.1', generateTotpCode(begin.secret, { timestamp: Date.now() }));

  const invalidPassword = await disableMfa(login.session.id, '127.0.0.1', 'WrongPass', '000000');
  assert.equal(invalidPassword.ok, false);

  const invalidCode = await disableMfa(login.session.id, '127.0.0.1', 'StartPass123!', '000000');
  assert.equal(invalidCode.ok, false);

  const disabled = await disableMfa(
    login.session.id,
    '127.0.0.1',
    'StartPass123!',
    generateTotpCode(begin.secret, { timestamp: Date.now() }),
  );
  assert.equal(disabled.ok, true);

  const status = await getMfaStatus(login.session.id, '127.0.0.1');
  assert.equal(status.ok, true);
  assert.equal(status.enabled, false);
});

test('expired sessions are rejected and brute-force lockout remains active', async () => {
  await resetAuthState({});
  await initializeAuthState({ RSOS_ADMIN_USERNAME: 'admin@example.com', RSOS_ADMIN_PASSWORD: 'StartPass123!' });

  for (let index = 0; index < 5; index += 1) {
    const failed = await authenticateUser({ username: 'admin@example.com', password: 'WrongPass', ipAddress: '127.0.0.1' });
    assert.equal(failed.ok, false);
  }
  const locked = await authenticateUser({ username: 'admin@example.com', password: 'WrongPass', ipAddress: '127.0.0.1' });
  assert.equal(locked.reason, 'locked_out');

  await resetAuthState({
    settings: { ttlMs: 1 },
  });
  await initializeAuthState({ RSOS_ADMIN_USERNAME: 'admin@example.com', RSOS_ADMIN_PASSWORD: 'StartPass123!' });
  const login = await authenticateUser({ username: 'admin@example.com', password: 'StartPass123!', ipAddress: '127.0.0.1' });
  await new Promise((resolve) => setTimeout(resolve, 5));
  const session = await verifySession(login.session.id, '127.0.0.1');
  assert.equal(session, null);
});

test('concurrent auth-state writes use isolated temp files and leave valid state without temp artifacts', async () => {
  await resetAuthState({});
  await initializeAuthState({ RSOS_ADMIN_USERNAME: 'concurrent@example.com', RSOS_ADMIN_PASSWORD: 'StrongPass123!' });
  const attempts = await Promise.all(Array.from({ length: 12 }, (_, index) => authenticateUser({
    username: 'concurrent@example.com',
    password: 'StrongPass123!',
    ipAddress: `127.0.0.${index + 1}`,
  })));
  assert.equal(attempts.every((entry) => entry.ok), true);
  const persisted = await readAuthStateFile();
  assert.equal(persisted.admin.username, 'concurrent@example.com');
  assert.equal(Array.isArray(persisted.sessions), true);
  const files = await readdir(path.dirname(authStateFile));
  assert.equal(files.some((name) => /^auth-state\.json\..+\.tmp$/.test(name)), false);
});

after(async () => {
  // Always reset to empty so test users never persist into the next server run.
  await mkdir(path.dirname(authStateFile), { recursive: true });
  await writeFile(authStateFile, JSON.stringify({}, null, 2), 'utf8');
});
