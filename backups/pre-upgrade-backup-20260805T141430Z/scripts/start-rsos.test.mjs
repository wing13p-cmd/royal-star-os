import test from 'node:test';
import assert from 'node:assert/strict';
import { isRsosProcessCommand } from './start-rsos.mjs';

test('recognizes RSOS backend and frontend launch commands', () => {
  assert.equal(isRsosProcessCommand('/Users/example/royal-star-os/server/index.js'), true);
  assert.equal(isRsosProcessCommand('/Users/example/royal-star-os/app/node_modules/vite/bin/vite.js --host 127.0.0.1 --port 5173'), true);
  assert.equal(isRsosProcessCommand('node index.js'), true);
});

test('rejects unrelated process commands', () => {
  assert.equal(isRsosProcessCommand('python3 -m http.server 3001'), false);
  assert.equal(isRsosProcessCommand('node /tmp/other-service.js'), false);
});
