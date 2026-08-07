import test from 'node:test';
import assert from 'node:assert/strict';
import { buildEnterpriseEventBus } from './enterpriseEventBus.js';

test('buildEnterpriseEventBus publishes and subscribes to events with deduplication', () => {
  const eventBus = buildEnterpriseEventBus();
  const received = [];

  eventBus.subscribe('Deal Updated', (event) => received.push(event));
  eventBus.subscribe('Deal Updated', (event) => received.push(event));

  eventBus.publish('Deal Updated', { dealId: 'deal-1', source: 'Test' });
  eventBus.publish('Deal Updated', { dealId: 'deal-1', source: 'Test' });

  assert.equal(received.length, 2);
  assert.equal(eventBus.getEventLog().length, 1);
  assert.equal(eventBus.getDeduplicationKeys().length, 1);
});

test('buildEnterpriseEventBus retries failed events and records diagnostics', () => {
  const eventBus = buildEnterpriseEventBus({ retryLimit: 2 });
  const results = [];

  eventBus.subscribe('Forecast Updated', async (event) => {
    results.push(event.attemptCount);
    if (event.attemptCount < 2) {
      throw new Error('retry');
    }
  });

  return eventBus.publish('Forecast Updated', { dealId: 'deal-2', source: 'Forecast' }).then(() => {
    assert.equal(results.length, 2);
    assert.equal(eventBus.getEventLog()[0].retryCount, 1);
    assert.equal(eventBus.getEventLog()[0].status, 'Completed');
  });
});
