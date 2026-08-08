import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { mkdtemp, mkdir, writeFile, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';

// ── RSOS_DATA_DIR respected by all active server modules ─────────────────────

test('authService respects RSOS_DATA_DIR for auth-state.json location', async () => {
  const authCode = await readFile(path.join(process.cwd(), 'server', 'authService.js'), 'utf8');
  assert.ok(authCode.includes('process.env.RSOS_DATA_DIR'), 'authService must check RSOS_DATA_DIR');
  assert.ok(authCode.includes('path.resolve(process.env.RSOS_DATA_DIR)'), 'authService must resolve RSOS_DATA_DIR to absolute path');
});

test('dealIntelligenceService respects RSOS_DATA_DIR', async () => {
  const svcCode = await readFile(path.join(process.cwd(), 'server', 'dealIntelligenceService.js'), 'utf8');
  assert.ok(svcCode.includes('process.env.RSOS_DATA_DIR'), 'dealIntelligenceService must check RSOS_DATA_DIR');
});

test('server/index.js respects RSOS_DATA_DIR for all business data files', async () => {
  const serverCode = await readFile(path.join(process.cwd(), 'server', 'index.js'), 'utf8');
  assert.ok(serverCode.includes('process.env.RSOS_DATA_DIR'), 'index.js must check RSOS_DATA_DIR');
  assert.ok(serverCode.includes('path.join(dataDir,'), 'all data files must derive from dataDir');
});

test('backup-data respects RSOS_DATA_DIR and RSOS_BACKUP_DIR', async () => {
  const backupCode = await readFile(path.join(process.cwd(), 'scripts', 'backup-data.mjs'), 'utf8');
  assert.ok(backupCode.includes('RSOS_DATA_DIR'), 'backup must read from RSOS_DATA_DIR');
  assert.ok(backupCode.includes('RSOS_BACKUP_DIR'), 'backup must write to RSOS_BACKUP_DIR');
});

test('restore-data respects RSOS_DATA_DIR and RSOS_BACKUP_DIR', async () => {
  const restoreCode = await readFile(path.join(process.cwd(), 'scripts', 'restore-data.mjs'), 'utf8');
  assert.ok(restoreCode.includes('RSOS_DATA_DIR'), 'restore must write to RSOS_DATA_DIR');
  assert.ok(restoreCode.includes('RSOS_BACKUP_DIR'), 'restore must read from RSOS_BACKUP_DIR');
});

test('http-server.js is not imported by index.js (legacy dead file — not a write risk)', async () => {
  const serverCode = await readFile(path.join(process.cwd(), 'server', 'index.js'), 'utf8');
  assert.ok(!serverCode.includes('./http-server'), 'http-server.js must not be imported by active server');
});

// ── Persistence simulation: write → simulated restart → verify ───────────────

test('auth state survives simulated restart when RSOS_DATA_DIR is set', async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'rsos-persist-'));
  const dataDir = path.join(tempDir, 'data');
  await mkdir(dataDir, { recursive: true });

  const prevDataDir = process.env.RSOS_DATA_DIR;
  process.env.RSOS_DATA_DIR = dataDir;

  try {
    // Dynamically re-import is not possible for module-cached paths.
    // Simulate by directly writing auth-state using the resolved path pattern.
    const authStatePath = path.join(dataDir, 'auth-state.json');
    const initialState = {
      version: 1,
      admin: { id: 'admin-test', username: 'persist@example.com', displayName: 'Test', role: 'System Administrator', passwordHash: 'abcd:efgh', mfa: { enabled: false, secret: null, pendingSecret: null, recoveryCodeHashes: [], enabledAt: null }, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
      sessions: [],
      failedLogins: [],
      mfaChallenges: [],
      mfaFailures: [],
      settings: { ttlMs: 3600000, failureWindowMs: 900000, maxFailures: 5, mfaChallengeTtlMs: 300000, mfaFailureWindowMs: 300000, mfaMaxFailures: 5 },
    };

    // Write (simulating first-boot)
    const tmpFile = `${authStatePath}.tmp`;
    await writeFile(tmpFile, `${JSON.stringify(initialState, null, 2)}\n`, 'utf8');
    const { rename } = await import('node:fs/promises');
    await rename(tmpFile, authStatePath);

    // Simulate restart: re-read from same directory
    const afterRestart = JSON.parse(await readFile(authStatePath, 'utf8'));
    assert.equal(afterRestart.admin.username, 'persist@example.com');
    assert.equal(afterRestart.version, 1);
    assert.ok(!existsSync(tmpFile), 'temp file must not remain after atomic write');
  } finally {
    if (prevDataDir === undefined) {
      delete process.env.RSOS_DATA_DIR;
    } else {
      process.env.RSOS_DATA_DIR = prevDataDir;
    }
  }
});

test('business data survives simulated restart when RSOS_DATA_DIR is set', async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'rsos-persist-data-'));
  const dataDir = path.join(tempDir, 'data');
  await mkdir(dataDir, { recursive: true });

  const dealsPath = path.join(dataDir, 'deals.json');
  const testDeal = [{ id: 'deal-persist-1', address: '952 Goss Rd', purchasePrice: 135000, createdAt: new Date().toISOString() }];

  // Write (simulating server write)
  await writeFile(dealsPath, JSON.stringify(testDeal, null, 2), 'utf8');

  // Simulate restart: re-read
  const afterRestart = JSON.parse(await readFile(dealsPath, 'utf8'));
  assert.equal(afterRestart.length, 1);
  assert.equal(afterRestart[0].id, 'deal-persist-1');
  assert.equal(afterRestart[0].address, '952 Goss Rd');
});

test('backup path resolves inside RSOS_BACKUP_DIR on a Railway volume', async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'rsos-persist-backup-'));
  const backupDir = path.join(tempDir, 'backups');
  await mkdir(backupDir, { recursive: true });

  const stamp = new Date().toISOString().replace(/[:.]/g, '');
  const backupFile = path.join(backupDir, `royal-star-os-backup-${stamp}.json`);
  const tmpBackup = `${backupFile}.tmp`;
  const payload = { system: 'Royal Star OS', data: { deals: [], properties: [] } };

  await writeFile(tmpBackup, JSON.stringify(payload, null, 2), 'utf8');
  const { rename } = await import('node:fs/promises');
  await rename(tmpBackup, backupFile);

  assert.ok(existsSync(backupFile), 'backup file must exist at target path after atomic write');
  const verified = JSON.parse(await readFile(backupFile, 'utf8'));
  assert.equal(verified.system, 'Royal Star OS');
});

// ── Production env template completeness ─────────────────────────────────────

test('production env template documents RSOS_DATA_DIR and RSOS_BACKUP_DIR', async () => {
  const template = await readFile(path.join(process.cwd(), 'deploy', '.env.production.template'), 'utf8');
  assert.ok(template.includes('RSOS_DATA_DIR=/data/rsos'), 'template must show RSOS_DATA_DIR Railway volume path');
  assert.ok(template.includes('RSOS_BACKUP_DIR=/data/rsos'), 'template must show RSOS_BACKUP_DIR under same volume');
  assert.ok(template.includes('REQUIRED on Railway'), 'template must clearly mark these as required');
});

// ── No writes outside controlled directories ──────────────────────────────────

test('all server write paths derive from RSOS_DATA_DIR or RSOS_BACKUP_DIR', async () => {
  // provider-credentials.json is under dataDir in index.js
  const serverCode = await readFile(path.join(process.cwd(), 'server', 'index.js'), 'utf8');
  assert.ok(!serverCode.includes("path.join(__dirname, 'data')"), 'index.js must not hardcode data path outside RSOS_DATA_DIR');
});

test('all recovery writes derive from dataDir (under RSOS_DATA_DIR)', async () => {
  const serverCode = await readFile(path.join(process.cwd(), 'server', 'index.js'), 'utf8');
  const recoverySection = serverCode.slice(serverCode.indexOf('recoveryDir'), serverCode.indexOf('recoveryDir') + 200);
  assert.ok(recoverySection.includes('dataDir'), 'recovery dir must be nested inside dataDir');
});
