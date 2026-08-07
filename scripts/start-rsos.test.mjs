import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyServiceStatus, isRsosProcessCommand } from './start-rsos.mjs';

test('recognizes RSOS backend and frontend launch commands', () => {
  assert.equal(isRsosProcessCommand('/Users/example/royal-star-os/server/index.js'), true);
  assert.equal(isRsosProcessCommand('/Users/example/royal-star-os/app/node_modules/vite/bin/vite.js --host 127.0.0.1 --port 5173'), true);
  assert.equal(isRsosProcessCommand('node index.js'), true);
});

test('rejects unrelated process commands', () => {
  assert.equal(isRsosProcessCommand('python3 -m http.server 3001'), false);
  assert.equal(isRsosProcessCommand('node /tmp/other-service.js'), false);
});

test('classifyServiceStatus reports backend running', () => {
  const result = classifyServiceStatus({
    pid: 123,
    pidFileExists: true,
    pidRunning: true,
    listenerPids: [123],
    healthy: true,
    label: 'backend',
  });
  assert.equal(result.status, 'backend running and healthy');
});

test('classifyServiceStatus reports stale pid', () => {
  const result = classifyServiceStatus({
    pid: 456,
    pidFileExists: true,
    pidRunning: false,
    listenerPids: [],
    healthy: false,
    label: 'backend',
  });
  assert.equal(result.status, 'stale pid');
});

test('classifyServiceStatus reports occupied port', () => {
  const result = classifyServiceStatus({
    pid: null,
    pidFileExists: false,
    pidRunning: false,
    listenerPids: [99999],
    healthy: false,
    label: 'backend',
  });
  assert.ok(['occupied port', 'port conflict', 'listener exists but not RSOS-owned'].includes(result.status));
});

test('classifyServiceStatus reports non-rsos listener ownership', () => {
  const result = classifyServiceStatus({
    pid: null,
    pidFileExists: false,
    pidRunning: false,
    listenerPids: [99999],
    healthy: false,
    label: 'backend',
  });
  assert.ok(['listener exists but not RSOS-owned', 'occupied port', 'port conflict'].includes(result.status));
});

test('classifyServiceStatus reports backend stopped', () => {
  const result = classifyServiceStatus({
    pid: null,
    pidFileExists: false,
    pidRunning: false,
    listenerPids: [],
    healthy: false,
    label: 'backend',
  });
  assert.equal(result.status, 'backend stopped');
});
