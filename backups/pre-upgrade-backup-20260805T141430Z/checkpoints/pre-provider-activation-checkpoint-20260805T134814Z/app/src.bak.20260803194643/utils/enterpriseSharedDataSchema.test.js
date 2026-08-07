import test from 'node:test';
import assert from 'node:assert/strict';
import { migrateLegacyEnterpriseData, normalizeSharedEnterpriseRecord } from './enterpriseSharedDataSchema.js';

test('normalizeSharedEnterpriseRecord maps legacy fields into the shared schema', () => {
  const normalized = normalizeSharedEnterpriseRecord({
    id: 'deal-1',
    property_name: '952 Goss Rd',
    asking_price: 145000,
    rehab_budget: 60000,
    arv: 300000,
    financing_costs: 85000,
    status: 'owned',
  }, { entityType: 'deal' });

  assert.equal(normalized.id, 'deal-1');
  assert.equal(normalized.propertyAddress, '952 Goss Rd');
  assert.equal(normalized.purchasePrice, 145000);
  assert.equal(normalized.rehabBudget, 60000);
  assert.equal(normalized.estimatedArv, 300000);
  assert.equal(normalized.financingCosts, 85000);
  assert.equal(normalized.schemaVersion, 1);
});

test('migrateLegacyEnterpriseData upgrades an array of legacy records without losing values', () => {
  const migrated = migrateLegacyEnterpriseData([
    {
      property_name: '123 Main St',
      asking_price: 120000,
      rehab_budget: 30000,
      arv: 220000,
    },
    {
      id: 'property-2',
      address: '456 Oak Ave',
      propertyType: 'Single Family',
      purchasePrice: 130000,
    },
  ], { entityType: 'deal' });

  assert.equal(migrated[0].propertyAddress, '123 Main St');
  assert.equal(migrated[0].purchasePrice, 120000);
  assert.equal(migrated[0].rehabBudget, 30000);
  assert.equal(migrated[0].estimatedArv, 220000);
  assert.equal(migrated[1].schemaVersion, 1);
  assert.equal(migrated[1].address, '456 Oak Ave');
});
