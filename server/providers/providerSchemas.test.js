import test from 'node:test';
import assert from 'node:assert/strict';
import { listProviderSchemas, getProviderSchema } from './providerSchemas.js';

test('provider schema registry includes enterprise readiness placeholders for required providers', () => {
  const providerNames = listProviderSchemas().map((schema) => schema.provider);

  assert.ok(providerNames.includes('mls'));
  assert.ok(providerNames.includes('rentcast'));
  assert.ok(providerNames.includes('attom'));
  assert.ok(providerNames.includes('corelogic'));
  assert.ok(providerNames.includes('estated'));
  assert.ok(providerNames.includes('batchdata'));
  assert.ok(providerNames.includes('propertyradar'));
  assert.ok(providerNames.includes('regrid'));
  assert.ok(providerNames.includes('google-maps'));
  assert.ok(providerNames.includes('openstreetmap'));
  assert.ok(providerNames.includes('county-gis'));
  assert.ok(providerNames.includes('public-records'));
});

test('provider schema placeholders stay in validation-only mode until credentials are configured', () => {
  const schema = getProviderSchema('corelogic');
  assert.equal(schema.provider, 'corelogic');
  assert.equal(schema.licensingConfirmationRequired, true);
  assert.ok(schema.requiredNonSecrets.includes('licensingAcknowledgement'));
});
