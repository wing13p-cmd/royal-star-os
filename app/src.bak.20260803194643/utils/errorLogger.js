const MAX_LOGS = 50;
const storageKey = 'royalStarErrorLog';

function readLogs() {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(storageKey);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function writeLogs(logs) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(logs.slice(-MAX_LOGS)));
  } catch {
    // ignore storage failures
  }
}

export function logRuntimeError(context, error) {
  const entry = {
    context,
    message: error?.message || 'Unknown error',
    stack: error?.stack || '',
    timestamp: new Date().toISOString(),
  };
  const logs = [entry, ...readLogs()];
  writeLogs(logs);
  console.error(`[${context}]`, error);
}

export function getRuntimeLogs() {
  return readLogs();
}
