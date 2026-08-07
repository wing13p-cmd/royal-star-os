function isMissing(value) {
  return value === null || value === undefined || (typeof value === 'string' && value.trim() === '');
}

function parseNumeric(value) {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const normalized = trimmed.replace(/[$,\s]/g, '').replace(/%/g, '');
    if (!normalized) return null;
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

export function normalizePercent(value, options = {}) {
  const min = options.min ?? 0;
  const max = options.max ?? 1;
  const maxWholePercent = options.maxWholePercent ?? 100;

  if (isMissing(value)) {
    return { status: 'unknown', value: null };
  }

  const parsed = parseNumeric(value);
  if (!Number.isFinite(parsed)) {
    return { status: 'invalid', value: null };
  }

  let fraction = parsed;
  if (Math.abs(fraction) > 1) {
    if (Math.abs(fraction) <= maxWholePercent) {
      fraction = fraction / 100;
    } else {
      return { status: 'invalid', value: null };
    }
  }

  if (!Number.isFinite(fraction) || fraction < min || fraction > max) {
    return { status: 'invalid', value: null };
  }

  return { status: 'ok', value: fraction };
}

export function normalizePercentOrNull(value, options = {}) {
  const normalized = normalizePercent(value, options);
  return normalized.status === 'ok' ? normalized.value : null;
}

export function percentDisplayValue(value) {
  return Number.isFinite(value) ? value * 100 : null;
}
