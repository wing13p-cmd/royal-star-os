import test from 'node:test';
import assert from 'node:assert/strict';
import { buildReleaseManifest } from './export-release.mjs';
import { buildProductionReadinessChecklist } from './package-release.mjs';

test('buildReleaseManifest returns required release fields safely without git dependency', async () => {
  const manifest = await buildReleaseManifest({
    version: '1.0.0',
    testsRun: ['unit', 'integration'],
    buildResult: 'PASS',
    rollbackLocation: 'checkpoints/example.tgz',
    knownLimitations: ['No PDF engine'],
  });

  assert.equal(typeof manifest.version, 'string');
  assert.equal(Array.isArray(manifest.filesChanged), true);
  assert.equal(Array.isArray(manifest.modulesAffected), true);
  assert.equal(Array.isArray(manifest.testsRun), true);
  assert.equal(typeof manifest.buildResult, 'string');
  assert.equal(typeof manifest.rollbackLocation, 'string');
  assert.equal(Array.isArray(manifest.sensitiveFileScan.flagged), true);
});

test('buildProductionReadinessChecklist includes required checks', () => {
  const checklist = buildProductionReadinessChecklist({
    commandCenterPreserved: true,
    navigationPreserved: true,
    routesPreserved: true,
    gossPreserved: true,
    manualModeOperational: true,
    reviewFirstEnforced: true,
    noLiveProviders: true,
    noCredentialExposure: true,
    noAutoApprovals: true,
    buildPassed: true,
  });

  assert.equal(Array.isArray(checklist.checks), true);
  assert.ok(checklist.checks.some((check) => check.name === 'No credentials exposed' && check.status === 'PASS'));
  assert.ok(checklist.checks.some((check) => check.name === 'Production build passed'));
});
