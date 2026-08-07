import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { readJsonBody, HttpRequestBodyError } from './requestBody.js';

function createMockRequest(body, headers = {}, method = 'POST') {
  const request = new EventEmitter();
  request.method = method;
  request.headers = headers;
  request.body = undefined;
  request.readableEnded = false;
  request._readableState = { ended: false };
  request.setEncoding = () => {};
  request.removeListener = request.removeListener.bind(request);
  request.on = request.on.bind(request);
  request.once = request.once.bind(request);
  request.emitData = () => {
    if (body === undefined) {
      request.readableEnded = true;
      request._readableState.ended = true;
      request.emit('end');
      return;
    }
    request.emit('data', Buffer.from(body));
    request.readableEnded = true;
    request._readableState.ended = true;
    request.emit('end');
  };
  setImmediate(() => request.emitData());
  return request;
}

test('parses a valid JSON body once', async () => {
  const request = createMockRequest('{"ok":true}', { 'content-type': 'application/json' });
  const first = await readJsonBody(request);
  const second = await readJsonBody(request);
  assert.deepEqual(first, { ok: true });
  assert.deepEqual(second, { ok: true });
});

test('rejects malformed JSON with a clear error', async () => {
  const request = createMockRequest('{"ok":', { 'content-type': 'application/json' });
  await assert.rejects(readJsonBody(request), (error) => {
    assert.ok(error instanceof HttpRequestBodyError);
    assert.equal(error.statusCode, 400);
    assert.equal(error.errorType, 'invalid_json');
    return true;
  });
});

test('rejects empty bodies for routes that require one', async () => {
  const request = createMockRequest('', { 'content-type': 'application/json' });
  await assert.rejects(readJsonBody(request), (error) => {
    assert.ok(error instanceof HttpRequestBodyError);
    assert.equal(error.statusCode, 400);
    assert.equal(error.errorType, 'empty_body');
    return true;
  });
});

test('rejects bodies sent with the wrong content type', async () => {
  const request = createMockRequest('{"ok":true}', { 'content-type': 'text/plain' });
  await assert.rejects(readJsonBody(request), (error) => {
    assert.ok(error instanceof HttpRequestBodyError);
    assert.equal(error.statusCode, 415);
    assert.equal(error.errorType, 'invalid_content_type');
    return true;
  });
});

test('rejects oversized bodies', async () => {
  const body = 'x'.repeat(300 * 1024);
  const request = createMockRequest(body, { 'content-type': 'application/json' });
  await assert.rejects(readJsonBody(request, { maxBytes: 256 * 1024 }), (error) => {
    assert.ok(error instanceof HttpRequestBodyError);
    assert.equal(error.statusCode, 413);
    assert.equal(error.errorType, 'payload_too_large');
    return true;
  });
});

test('permits bodyless requests for methods that do not need a payload', async () => {
  const request = createMockRequest('', {}, 'GET');
  await assert.doesNotReject(readJsonBody(request, { allowEmptyBody: true }));
});
