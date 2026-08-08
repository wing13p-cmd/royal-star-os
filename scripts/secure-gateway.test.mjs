import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

test('secure gateway enforces NODE_ENV production check', async () => {
  const source = await readFile(path.join(rootDir, 'server', 'secureGateway.js'), 'utf8');
  assert.ok(source.includes("getEnv(\"NODE_ENV\") !== \"production\""), 'gateway must require NODE_ENV=production');
});

test('secure gateway requires RSOS_PUBLIC_ORIGIN with https', async () => {
  const source = await readFile(path.join(rootDir, 'server', 'secureGateway.js'), 'utf8');
  assert.ok(source.includes('ensureHttpsOrigin'), 'gateway must validate https origin');
  assert.ok(source.includes('must use https://'), 'gateway must reject non-https origins');
});

test('secure gateway requires TLS key and cert', async () => {
  const source = await readFile(path.join(rootDir, 'server', 'secureGateway.js'), 'utf8');
  assert.ok(source.includes('RSOS_TLS_KEY_PATH'), 'gateway must require TLS key path');
  assert.ok(source.includes('RSOS_TLS_CERT_PATH'), 'gateway must require TLS cert path');
  assert.ok(source.includes('TLS key file not found'), 'gateway must fail on missing TLS key');
  assert.ok(source.includes('TLS certificate file not found'), 'gateway must fail on missing TLS cert');
});

test('secure gateway applies HSTS header', async () => {
  const source = await readFile(path.join(rootDir, 'server', 'secureGateway.js'), 'utf8');
  assert.ok(source.includes('Strict-Transport-Security'), 'gateway must set HSTS header');
  assert.ok(source.includes('max-age=31536000'), 'HSTS max-age must be at least 1 year');
});

test('secure gateway applies Content-Security-Policy', async () => {
  const source = await readFile(path.join(rootDir, 'server', 'secureGateway.js'), 'utf8');
  assert.ok(source.includes('Content-Security-Policy'), 'gateway must set CSP header');
});

test('secure gateway blocks path traversal to server/scripts/backups', async () => {
  const source = await readFile(path.join(rootDir, 'server', 'secureGateway.js'), 'utf8');
  assert.ok(source.includes('isDeniedStaticPath'), 'gateway must have static path deny logic');
  assert.ok(source.includes('/backups'), 'gateway must block /backups path');
  assert.ok(source.includes('/server'), 'gateway must block /server path');
  assert.ok(source.includes('/checkpoints'), 'gateway must block /checkpoints path');
});

test('secure gateway blocks hidden dotfiles', async () => {
  const source = await readFile(path.join(rootDir, 'server', 'secureGateway.js'), 'utf8');
  assert.ok(source.includes('startsWith("/.") || pathname.includes("/.") || pathname.endsWith(".env")'), 'gateway must block dotfiles');
});

test('secure gateway prevents path traversal via path.normalize', async () => {
  const source = await readFile(path.join(rootDir, 'server', 'secureGateway.js'), 'utf8');
  assert.ok(source.includes('withinDist'), 'gateway must verify resolved path is within dist');
});

test('secure gateway proxies /api routes to internal loopback only', async () => {
  const source = await readFile(path.join(rootDir, 'server', 'secureGateway.js'), 'utf8');
  assert.ok(source.includes("127.0.0.1"), 'proxy target must be loopback only');
  assert.ok(source.includes('/api/') && source.includes('startsWith'), 'gateway must detect /api routes');
});

test('secure gateway redirects HTTP to HTTPS with 308', async () => {
  const source = await readFile(path.join(rootDir, 'server', 'secureGateway.js'), 'utf8');
  assert.ok(source.includes('308'), 'HTTP redirect must use 308 permanent redirect');
  assert.ok(source.includes('RSOS_HTTP_REDIRECT_PORT'), 'HTTP redirect port must be configurable');
});

test('secure gateway binds internal backend to RSOS_BIND_HOST=127.0.0.1', async () => {
  const source = await readFile(path.join(rootDir, 'server', 'secureGateway.js'), 'utf8');
  assert.ok(source.includes('RSOS_BIND_HOST'), 'backend bind host must be configurable');
  assert.ok(source.includes('"127.0.0.1"'), 'backend must default to loopback');
});

test('secure gateway does not leak RSOS_OPERATOR_TOKEN or TLS paths to frontend', async () => {
  const source = await readFile(path.join(rootDir, 'server', 'secureGateway.js'), 'utf8');
  assert.ok(!source.includes('RSOS_OPERATOR_TOKEN') || source.includes('backendEnv'), 'operator token must not appear in static file serving path');
});

test('production env template includes admin bootstrap credential placeholders', async () => {
  const template = await readFile(path.join(rootDir, 'deploy', '.env.production.template'), 'utf8');
  assert.ok(template.includes('RSOS_ADMIN_USERNAME'), 'template must document admin username env var');
  assert.ok(template.includes('RSOS_ADMIN_PASSWORD'), 'template must document admin password env var');
  assert.ok(!template.includes('replace-with-admin-email') === false, 'template must show placeholder, not real email');
});

test('verify-system requires authService.js and mfaService.js', async () => {
  const source = await readFile(path.join(rootDir, 'scripts', 'verify-system.mjs'), 'utf8');
  assert.ok(source.includes('authService.js'), 'verify-system must check for authService.js');
  assert.ok(source.includes('mfaService.js'), 'verify-system must check for mfaService.js');
});

test('verify-system requires auth-state.json in data directory', async () => {
  const source = await readFile(path.join(rootDir, 'scripts', 'verify-system.mjs'), 'utf8');
  assert.ok(source.includes('auth-state.json'), 'verify-system must check for auth-state.json');
});
