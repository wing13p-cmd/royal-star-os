export const enterpriseEventTypes = {
  DEAL_ADDED: 'Deal Added',
  DEAL_UPDATED: 'Deal Updated',
  DEAL_DELETED: 'Deal Deleted',
  PORTFOLIO_UPDATED: 'Portfolio Updated',
  CAPITAL_UPDATED: 'Capital Updated',
  FORECAST_UPDATED: 'Forecast Updated',
  OPPORTUNITY_UPDATED: 'Opportunity Updated',
  MARKET_RISK_UPDATED: 'Market Risk Updated',
  EXECUTIVE_RECOMMENDATION_UPDATED: 'Executive Recommendation Updated',
  DASHBOARD_REFRESH_REQUESTED: 'Dashboard Refresh Requested',
};

function safeString(value, fallback = 'Insufficient Data') {
  if (value === null || value === undefined || value === '') return fallback;
  return typeof value === 'string' ? value : String(value);
}

function normalizeObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function buildEventKey(eventName, payload = {}) {
  const normalized = normalizeObject(payload);
  return `${safeString(eventName)}::${safeString(normalized.dealId || normalized.propertyId || normalized.source || normalized.type || 'global')}`;
}

export function buildEnterpriseEventBus(options = {}) {
  const subscribers = new Map();
  const eventLog = [];
  const deduplicationKeys = new Set();
  const retryLimit = Number(options.retryLimit) || 2;

  function subscribe(eventName, handler) {
    const handlers = subscribers.get(eventName) || [];
    handlers.push(handler);
    subscribers.set(eventName, handlers);
    return () => {
      const current = subscribers.get(eventName) || [];
      subscribers.set(eventName, current.filter((entry) => entry !== handler));
    };
  }

  async function publish(eventName, payload = {}) {
    const normalizedPayload = normalizeObject(payload);
    const eventKey = buildEventKey(eventName, normalizedPayload);
    if (deduplicationKeys.has(eventKey)) {
      return { status: 'Deduplicated', eventKey };
    }

    const event = {
      eventName: safeString(eventName),
      source: safeString(normalizedPayload.source, 'Unknown'),
      payload: normalizedPayload,
      timestamp: new Date().toISOString(),
      status: 'Pending',
      retryCount: 0,
      processingDurationMs: 0,
    };

    deduplicationKeys.add(eventKey);
    eventLog.push(event);

    const handlers = subscribers.get(eventName) || [];
    const startedAt = Date.now();
    let attemptCount = 0;
    let state = 'Completed';

    try {
      for (const handler of handlers) {
        attemptCount += 1;
        let handlerError = null;
        try {
          const result = handler({ ...event, attemptCount });
          if (result && typeof result.then === 'function') {
            await result;
          }
        } catch (error) {
          handlerError = error;
        }

        if (handlerError) {
          if (attemptCount <= retryLimit) {
            event.retryCount += 1;
            event.status = 'Retrying';
            const retryResult = handler({ ...event, attemptCount: attemptCount + 1 });
            if (retryResult && typeof retryResult.then === 'function') {
              await retryResult;
            }
          } else {
            state = 'Failed';
            event.error = safeString(handlerError.message || String(handlerError), 'Unknown error');
            break;
          }
        }
      }
    } catch (error) {
      state = 'Failed';
      event.error = safeString(error.message || String(error), 'Unknown error');
    }

    event.status = state;
    event.processingDurationMs = Date.now() - startedAt;
    event.completedAt = new Date().toISOString();
    event.attemptCount = attemptCount;

    return event;
  }

  function getEventLog() {
    return eventLog;
  }

  function getDeduplicationKeys() {
    return Array.from(deduplicationKeys);
  }

  return {
    subscribe,
    publish,
    getEventLog,
    getDeduplicationKeys,
  };
}
