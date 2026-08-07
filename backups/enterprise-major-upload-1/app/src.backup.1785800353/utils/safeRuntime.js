export function safeObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

export function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

export function safeNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function safeString(value, fallback = 'Insufficient Data') {
  if (value === null || value === undefined || value === '') return fallback;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed || fallback;
  }
  return String(value);
}

export function safePercent(value) {
  return Number.isFinite(Number(value)) ? Number(value) : 0;
}

export function safeCurrency(value) {
  return Number.isFinite(Number(value)) ? Number(value) : 0;
}

export function safeDisplay(value, fallback = 'Insufficient Data') {
  if (value === null || value === undefined || value === '' || Number.isNaN(value)) return fallback;
  if (typeof value === 'number' && !Number.isFinite(value)) return fallback;
  if (typeof value === 'object' && !Array.isArray(value)) return fallback;
  return String(value);
}

export function safeDate(value, fallback = 'Insufficient Data') {
  if (!value) return fallback;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return fallback;
  return date.toISOString().slice(0, 10);
}
