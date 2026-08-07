import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { initializeAuthState, authenticateUser, verifySession, logoutSession } from './authService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const authStateFile = path.join(__dirname, 'data', 'auth-state.json');

test('initializes a first-run admin account and authenticates it', async () => {
  await writeFile(authStateFile, JSON.stringify({}), 'utf8');
  const state = await initializeAuthState({ RSOS_ADMIN_USERNAME: 'brandon@example.com', RSOS_ADMIN_PASSWORD: 'StrongPass123!' });
  assert.equal(state.admin.username, 'brandon@example.com');

  const authResult = await authenticateUser({ username: 'brandon@example.com', password: 'StrongPass123!', ipAddress: '127.0.0.1' });
  assert.equal(authResult.ok, true);
  assert.equal(authResult.session.username, 'brandon@example.com');

  const verified = await verifySession(authResult.session.id, '127.0.0.1');
  assert.ok(verified);

  await logoutSession(authResult.session.id);
  const afterLogout = await verifySession(authResult.session.id, '127.0.0.1');
  assert.equal(afterLogout, null);
});

test('reinitializes the admin account to the default credentials when stale state exists', async () => {
  await mkdir(path.dirname(authStateFile), { recursive: true });
  await writeFile(authStateFile, JSON.stringify({ admin: { username: 'stale@example.com', passwordHash: 'stale' } }, null, 2));

  const state = await initializeAuthState({});
  assert.equal(state.admin.username, 'brandon.sterling@royalstaros.com');
  assert.equal(state.admin.role, 'System Administrator');
});
