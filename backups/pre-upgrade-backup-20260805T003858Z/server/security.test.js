import test from 'node:test';
import assert from 'node:assert/strict';
import { sanitizePayload, validateNumericRange, getRequestContext, hasPermission } from './security.js';

test('sanitizePayload strips dangerous keys and sanitizes text', () => {
  const result = sanitizePayload(
    {
      __proto__: { polluted: true },
      constructor: { polluted: true },
      propertyName: '  <script>alert(1)</script> 123 ',
      notes: 'Keep this safe',
      purchasePrice: 135000,
      protectedField: 'nope',
    },
    {
      allowedFields: ['propertyName', 'notes', 'purchasePrice'],
      protectedFields: ['protectedField'],
    },
  );

  assert.equal(result.propertyName, '123');
  assert.equal(result.notes, 'Keep this safe');
  assert.equal(result.purchasePrice, 135000);
  assert.equal(result.protectedField, undefined);
  assert.equal(result.__proto__, undefined);
  assert.equal(result.constructor, undefined);
});

test('validateNumericRange rejects invalid bounds and negative values', () => {
  assert.equal(validateNumericRange('not-a-number', { min: 0, max: 100 }).valid, false);
  assert.equal(validateNumericRange(-1, { min: 0, max: 100 }).valid, false);
  assert.equal(validateNumericRange(50, { min: 0, max: 100 }).valid, true);
});

test('getRequestContext and hasPermission preserve local admin access while blocking remote write actions without role', () => {
  const localContext = getRequestContext({ headers: { host: '127.0.0.1:3001' } });
  assert.equal(localContext.isAdmin, true);
  assert.equal(hasPermission(localContext, 'write'), true);

  const remoteContext = getRequestContext({ headers: { host: 'example.com' } });
  assert.equal(remoteContext.isAdmin, false);
  assert.equal(hasPermission(remoteContext, 'write'), false);
});
