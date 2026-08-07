import { buildEnterpriseEventBus, enterpriseEventTypes } from './enterpriseEventBus.js';

function safeString(value, fallback = 'Insufficient Data') {
  if (value === null || value === undefined || value === '') return fallback;
  return typeof value === 'string' ? value : String(value);
}

function normalizeObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

export function buildEnterpriseTaskScheduler(options = {}) {
  const eventBus = buildEnterpriseEventBus({ retryLimit: 2 });
  const jobLog = [];
  const scheduledJobs = new Map();
  const inFlightJobs = new Set();
  const recurringJobs = new Map();
  const retryBaseMs = Number(options.retryBaseMs) || 50;

  function queueForPriority(priority) {
    return priority === 'High' ? 'High' : priority === 'Low' ? 'Low' : 'Normal';
  }

  function scheduleJob(definition = {}) {
    const normalized = normalizeObject(definition);
    const jobId = safeString(normalized.id, `job-${scheduledJobs.size + 1}`);
    const priority = safeString(normalized.priority, 'Normal');
    const queue = safeString(normalized.queue || queueForPriority(priority), 'Normal');
    const source = safeString(normalized.source, 'Unknown');

    if (scheduledJobs.has(jobId)) {
      return scheduledJobs.get(jobId);
    }

    const job = {
      jobId,
      source,
      priority,
      queue,
      run: normalized.run,
      retryLimit: Number(normalized.retryLimit) || 2,
      retryCount: 0,
      scheduledAt: new Date().toISOString(),
      type: 'Immediate',
      intervalMs: normalized.intervalMs || null,
      status: 'Pending',
    };

    scheduledJobs.set(jobId, job);
    return job;
  }

  function scheduleDelayedJob(definition = {}) {
    return scheduleJob({ ...definition, type: 'Delayed' });
  }

  function scheduleRecurringJob(definition = {}) {
    const normalized = normalizeObject(definition);
    const job = scheduleJob({ ...normalized, type: 'Recurring' });
    recurringJobs.set(job.jobId, job);
    return job;
  }

  async function runJob(job) {
    if (!job || !job.run) return null;
    if (inFlightJobs.has(job.jobId) && job._runInProgress) return null;

    inFlightJobs.add(job.jobId);
    job._runInProgress = true;
    const startedAt = Date.now();
    const logEntry = job._logEntry || {
      jobId: job.jobId,
      source: job.source,
      priority: job.priority,
      queue: job.queue,
      startTime: new Date().toISOString(),
      finishTime: null,
      runtimeMs: 0,
      retryCount: job.retryCount,
      status: 'Completed',
    };
    job._logEntry = logEntry;

    try {
      await job.run({ job, eventBus });
      logEntry.status = 'Completed';
    } catch (error) {
      if (job.retryCount < job.retryLimit) {
        job.retryCount += 1;
        logEntry.retryCount = job.retryCount;
        logEntry.status = 'Retrying';
        inFlightJobs.delete(job.jobId);
        job._runInProgress = false;
        await new Promise((resolve) => setTimeout(resolve, retryBaseMs * (2 ** job.retryCount)));
        return runJob(job);
      }
      logEntry.status = 'Failed';
      logEntry.error = safeString(error && error.message ? error.message : String(error), 'Unknown error');
    }

    logEntry.finishTime = new Date().toISOString();
    logEntry.runtimeMs = Date.now() - startedAt;
    logEntry.retryCount = job.retryCount;
    if (!job._logged) {
      jobLog.push(logEntry);
      job._logged = true;
    }
    inFlightJobs.delete(job.jobId);
    job._runInProgress = false;

    eventBus.publish(enterpriseEventTypes.DASHBOARD_REFRESH_REQUESTED, {
      source: job.source,
      jobId: job.jobId,
      priority: job.priority,
    });

    return logEntry;
  }

  async function flush() {
    const jobs = Array.from(scheduledJobs.values());
    for (const job of jobs) {
      await runJob(job);
    }
    return jobLog;
  }

  function getJobLog() {
    return jobLog;
  }

  function getScheduledJobs() {
    return Array.from(scheduledJobs.values());
  }

  function getRecurringJobs() {
    return Array.from(recurringJobs.values());
  }

  return {
    scheduleJob,
    scheduleDelayedJob,
    scheduleRecurringJob,
    runJob,
    flush,
    getJobLog,
    getScheduledJobs,
    getRecurringJobs,
    eventBus,
  };
}
