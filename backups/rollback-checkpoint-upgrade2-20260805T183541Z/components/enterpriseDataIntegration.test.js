import test from 'node:test';
import assert from 'node:assert/strict';
import { buildFieldMapping, normalizeRecordForStorage, detectDuplicateConfidence, buildImportPreview, mergeRecords } from './enterpriseDataIntegration.js';

test('normalizeRecordForStorage standardizes common property fields', () => {
  const result = normalizeRecordForStorage({
    address: ' 123 Main St ',
    city: ' austin ',
    state: 'tx',
    zipCode: '78701',
    purchasePrice: '$120,500',
    askingPrice: '120500',
    rehabBudget: ' 30,000 ',
    bedrooms: '3',
    bathrooms: '2',
    squareFeet: '1800',
    interestRate: ' 7.25% ',
    phone: ' (512) 555-0100 ',
    email: '  OWNER@EXAMPLE.COM ',
  }, 'property');

  assert.equal(result.address, '123 Main St');
  assert.equal(result.state, 'TX');
  assert.equal(result.zipCode, '78701');
  assert.equal(result.purchasePrice, 120500);
  assert.equal(result.askingPrice, 120500);
  assert.equal(result.rehabBudget, 30000);
  assert.equal(result.bedrooms, 3);
  assert.equal(result.bathrooms, 2);
  assert.equal(result.squareFeet, 1800);
  assert.equal(result.interestRate, 0.0725);
  assert.equal(result.phone, '(512) 555-0100');
  assert.equal(result.email, 'owner@example.com');
});

test('buildFieldMapping recognizes common header aliases', () => {
  const mapping = buildFieldMapping(['Property Address', 'City', 'St', 'ZIP Code', 'List Price', 'ARV']);
  assert.equal(mapping.address, 'address');
  assert.equal(mapping.city, 'city');
  assert.equal(mapping.state, 'state');
  assert.equal(mapping.zipCode, 'zipCode');
  assert.equal(mapping.askingPrice, 'askingPrice');
  assert.equal(mapping.estimatedArv, 'estimatedArv');
});

test('detectDuplicateConfidence returns exact and likely results for normalized duplicates', () => {
  const exact = detectDuplicateConfidence({ address: '123 Main St', city: 'Austin', state: 'TX', zipCode: '78701' }, { address: '123 Main St', city: 'Austin', state: 'TX', zipCode: '78701' });
  const likely = detectDuplicateConfidence({ address: '123 Main St', city: 'Austin', state: 'TX', zipCode: '78701' }, { address: '123 Main Street', city: 'Austin', state: 'TX', zipCode: '78701' });

  assert.equal(exact, 'exact');
  assert.equal(likely, 'likely');
});

test('buildImportPreview returns a normalized preview with duplicate flags', () => {
  const preview = buildImportPreview('address,city,state,zipCode,price\n123 Main St,Austin,TX,78701,120000\n123 Main St,Austin,TX,78701,120000', 'property', []);
  assert.equal(preview.rows.length, 2);
  assert.equal(preview.rows[0].duplicateConfidence, 'none');
  assert.equal(preview.rows[1].duplicateConfidence, 'exact');
});

test('mergeRecords preserves the newest valid values and history', () => {
  const merged = mergeRecords({ id: 'p-1', address: '123 Main St', city: 'Austin', state: 'TX', zipCode: '78701', notes: 'Original note' }, { id: 'p-2', address: '123 Main Street', city: 'Austin', state: 'TX', zipCode: '78701', notes: 'Updated note', purchasePrice: 120000 });
  assert.equal(merged.address, '123 Main St');
  assert.equal(merged.purchasePrice, 120000);
  assert.equal(merged.mergeHistory.length, 1);
});
