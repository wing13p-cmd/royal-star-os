import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const manifestPath = path.join(rootDir, 'release-manifest.json');
const docs = [
  'docs/RSOS-v1.0-Release-Manifest.md',
  'docs/Architecture-Summary.md',
  'docs/Canonical-Formula-Registry.md',
  'docs/Schema-and-Migration-Registry.md',
  'docs/API-Route-Registry.md',
  'docs/Role-and-Permission-Matrix.md',
  'docs/Backup-and-Restore-Procedure.md',
  'docs/Recovery-Procedure.md',
  'docs/Production-Start-Procedure.md',
  'docs/Production-Verification-Checklist.md',
  'docs/Known-Missing-Data-Limitations.md',
  'docs/Post-Release-Change-Control-Procedure.md',
  'docs/Gold-Master-Acceptance-Report.md',
];

test('gold master release manifest and production docs are present', () => {
  assert.equal(fs.existsSync(manifestPath), true);
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  assert.equal(manifest.version, '1.0.0-gold-master');
  for (const relativePath of docs) {
    assert.equal(fs.existsSync(path.join(rootDir, relativePath)), true, `${relativePath} missing`);
  }
});
