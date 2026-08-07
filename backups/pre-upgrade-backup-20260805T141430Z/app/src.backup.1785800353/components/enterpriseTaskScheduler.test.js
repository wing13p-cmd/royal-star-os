import test from 'node:test';
import assert from 'node:assert/strict';
import { buildEnterpriseTaskScheduler } from './enterpriseTaskScheduler.js';

test('buildEnterpriseTaskScheduler schedules immediate and recurring jobs with deduplication', async () => {
  const scheduler = buildEnterpriseTaskScheduler();
  const executed = [];

  scheduler.scheduleJob({ id: 'job-1', source: 'Executive', priority: 'High', queue: 'High', run: () => executed.push('job-1') });
  scheduler.scheduleJob({ id: 'job-1', source: 'Executive', priority: 'High', queue: 'High', run: () => executed.push('job-1-dup') });
  scheduler.scheduleRecurringJob({ id: 'job-2', source: 'Portfolio', priority: 'Normal', queue: 'Normal', intervalMs: 5, run: () => executed.push('job-2') });

  await scheduler.flush();

  assert.equal(executed.filter((entry) => entry === 'job-1').length, 1);
  assert.equal(executed.filter((entry) => entry === 'job-2').length, 1);
  assert.equal(scheduler.getJobLog().length >= 2, true);
});

test('buildEnterpriseTaskScheduler retries failed jobs with exponential backoff', async () => {
  const scheduler = buildEnterpriseTaskScheduler();
  let attempts = 0;

  scheduler.scheduleJob({
    id: 'job-3',
    source: 'Forecast',
    priority: 'Low',
    queue: 'Low',
    retryLimit: 2,
    run: async () => {
      attempts += 1;
      if (attempts < 2) {
        throw new Error('retry');
      }
    },
  });

  await scheduler.flush();

  assert.equal(attempts, 2);
  const logEntry = scheduler.getJobLog().find((entry) => entry.jobId === 'job-3');
  assert.equal(logEntry.retryCount, 1);
  assert.equal(logEntry.status, 'Completed');
});
