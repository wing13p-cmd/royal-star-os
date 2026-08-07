import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const indexSource = fs.readFileSync(path.join(__dirname, 'index.js'), 'utf8');

test('enterprise route smoke tests', () => {
  assert.equal(indexSource.includes('segments[1] === "enterprise"'), true);
  assert.equal(indexSource.includes('segments[2] === "command-center"'), true);
  assert.equal(indexSource.includes('segments[2] === "search"'), true);
  assert.equal(indexSource.includes('segments[2] === "reports"'), true);
  assert.equal(indexSource.includes('segments[2] === "documents"'), true);
  assert.equal(indexSource.includes('segments[2] === "knowledge"'), true);
  assert.equal(indexSource.includes('segments[2] === "forecast"'), true);
  assert.equal(indexSource.includes('segments[2] === "workflow"'), true);
  assert.equal(indexSource.includes('segments[2] === "diagnostics"'), true);
});

test('review-first approvals remain explicit', () => {
  assert.equal(indexSource.includes('payload.userApproval === true'), true);
  assert.equal(indexSource.includes('executeWorkflowTransition('), true);
});

test('no automatic provider activation introduced', () => {
  assert.equal(indexSource.includes('enterpriseProviderPlatform'), true);
  assert.equal(indexSource.includes('liveRequestsAllowed: false'), true);
});
