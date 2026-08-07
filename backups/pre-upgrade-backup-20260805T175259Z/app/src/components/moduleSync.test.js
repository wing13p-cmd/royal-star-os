import test from 'node:test';
import assert from 'node:assert/strict';
import { buildModuleSyncState, buildRehabProjectFromDeal } from './moduleSync.js';

test('buildModuleSyncState links a deal to a matching property and portfolio record', () => {
  const result = buildModuleSyncState({
    deals: [{ id: 'deal-1', propertyAddress: '100 Main St', city: 'Austin', state: 'TX', zipCode: '78701', purchasePrice: 120000, rehabBudget: 30000, estimatedArv: 220000, strategy: 'Flip' }],
    properties: [{ id: 'prop-1', address: '100 Main St', city: 'Austin', state: 'TX', zipCode: '78701', purchasePrice: 120000, currentValue: 220000, linkedDealId: '' }],
    portfolioEntries: [{ id: 'portfolio-1', propertyAddress: '100 Main St', purchasePrice: 120000, currentValue: 220000 }],
    rehabProjects: [],
    contractors: [],
    lenders: [],
    appraisalPackets: [],
  });

  assert.equal(result.dealLinks[0].linkedPropertyId, 'prop-1');
  assert.equal(result.propertyLinks[0].linkedDealId, 'deal-1');
  assert.ok(result.summary.linkedPropertyCount >= 1);
});

test('buildRehabProjectFromDeal reuses an existing matching project instead of creating a duplicate', () => {
  const matchedProject = buildRehabProjectFromDeal(
    { id: 'deal-1', propertyAddress: '100 Main St', purchasePrice: 120000, rehabBudget: 30000, estimatedArv: 220000, strategy: 'Flip' },
    { id: 'prop-1', address: '100 Main St' },
    [{ id: 'project-1', propertyId: 'prop-1', linkedDealId: 'deal-1', propertyAddress: '100 Main St' }],
  );

  assert.equal(matchedProject?.id, 'project-1');
});
