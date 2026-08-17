const text = (value) => value === null || value === undefined ? "" : String(value).trim();
const numberOrBlank = (value) => {
  if (value === null || value === undefined || (typeof value === "string" && value.trim() === "")) return "";
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : "";
};

/** Format a provider sale date as a calendar date, never converting it through local time. */
export function formatProviderSaleDate(value, locale = "en-US") {
  const raw = text(value);
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(raw);
  if (!match) return raw || "—";
  const [, year, month, day] = match;
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  if (Number.isNaN(date.getTime())) return raw;
  return new Intl.DateTimeFormat(locale, { timeZone: "UTC", month: "short", day: "numeric", year: "numeric" }).format(date);
}

function normalizedSubjectPart(value) {
  return text(value).toLowerCase().replace(/\s+/g, " ");
}

export function findPersistedProviderSubject(subjectDeal = null, subjectProperties = []) {
  if (!subjectDeal || !Array.isArray(subjectProperties)) return null;
  const address = normalizedSubjectPart(subjectDeal.propertyAddress || subjectDeal.address);
  const city = normalizedSubjectPart(subjectDeal.city);
  const state = normalizedSubjectPart(subjectDeal.state);
  const zipCode = normalizedSubjectPart(subjectDeal.zipCode || subjectDeal.zip);
  if (!address || !city || !state || !zipCode) return null;
  const hasCoordinate = (value) => value !== null && value !== undefined && String(value).trim() !== "" && Number.isFinite(Number(value));
  return subjectProperties.find((property) => (
    (!text(property.subjectDealId || property.dealId) || text(property.subjectDealId || property.dealId) === text(subjectDeal.id))
    && (!text(property.propertyId || property.subjectPropertyId) || text(property.propertyId || property.subjectPropertyId) === text(subjectDeal.propertyId || subjectDeal.linkedPropertyId))
    && normalizedSubjectPart(property.address) === address
    && normalizedSubjectPart(property.city) === city
    && normalizedSubjectPart(property.state) === state
    && normalizedSubjectPart(property.zipCode || property.zip) === zipCode
    && hasCoordinate(property.latitude)
    && hasCoordinate(property.longitude)
  )) || null;
}

export function getCompSubjectDealId(comp = {}) {
  return text(comp.subjectDealId || comp.dealId || comp.linkedDealId);
}

export function getProviderReviewCandidateKey(comp = {}) {
  const providerId = text(comp.providerRecordId || comp.providerPropertyId || comp.compId || comp.id);
  if (providerId) return `provider:${providerId.toLowerCase()}`;
  const address = text(comp.compAddress || comp.address || comp.propertyAddress).toLowerCase().replace(/\s+/g, " ");
  const saleDate = text(comp.saleDate);
  const salePrice = numberOrBlank(comp.salePrice);
  return address ? `sale:${address}|${saleDate}|${salePrice}` : "";
}

export function normalizeCompRecord(comp = {}) {
  const inclusionStatus = text(comp.inclusionStatus).toLowerCase();
  const reviewBlocked = ["pending", "excluded", "rejected"].includes(inclusionStatus) || comp.verified === false;
  return {
    ...comp,
    id: text(comp.id || comp.compId),
    compAddress: text(comp.compAddress || comp.address || comp.propertyAddress),
    zipCode: text(comp.zipCode || comp.zip),
    listPrice: numberOrBlank(comp.listPrice ?? comp.listingPrice),
    salePrice: numberOrBlank(comp.salePrice),
    bedrooms: numberOrBlank(comp.bedrooms),
    bathrooms: numberOrBlank(comp.bathrooms),
    squareFeet: numberOrBlank(comp.squareFeet),
    yearBuilt: numberOrBlank(comp.yearBuilt),
    distanceMiles: numberOrBlank(comp.distanceMiles ?? comp.distance),
    subjectDealId: getCompSubjectDealId(comp),
    dealId: text(comp.dealId || comp.subjectDealId || comp.linkedDealId || comp.subjectPropertyId),
    propertyId: text(comp.propertyId || comp.linkedPropertyId || comp.subjectPropertyId),
    included: comp.included !== false && !reviewBlocked,
  };
}

export function buildCompCreatePayload(values = {}, subjectDeal = null) {
  const subjectDealId = text(subjectDeal?.id || values.subjectDealId || values.dealId);
  const propertyId = text(subjectDeal?.propertyId || subjectDeal?.linkedPropertyId || values.propertyId);
  return {
    ...values,
    subjectDealId,
    dealId: subjectDealId,
    propertyId,
    subjectPropertyId: propertyId || subjectDealId,
    subjectProperty: text(subjectDeal?.propertyAddress || subjectDeal?.address || values.subjectProperty),
  };
}

export function compBelongsToSubject(comp = {}, subjectDeal = null) {
  if (!subjectDeal) return true;
  const normalized = normalizeCompRecord(comp);
  const subjectId = text(subjectDeal.id);
  if (normalized.subjectDealId) return normalized.subjectDealId === subjectId;
  const propertyId = text(subjectDeal.propertyId || subjectDeal.linkedPropertyId);
  if (normalized.propertyId && propertyId) return normalized.propertyId === propertyId;
  const legacyAddress = text(comp.subjectProperty).toLowerCase();
  const subjectAddress = text(subjectDeal.propertyAddress || subjectDeal.address).toLowerCase();
  return Boolean(legacyAddress && subjectAddress && legacyAddress === subjectAddress);
}

export function filterCompsForSubject(comps = [], subjectDeal = null) {
  return (Array.isArray(comps) ? comps : []).filter((comp) => compBelongsToSubject(comp, subjectDeal)).map(normalizeCompRecord);
}

export function normalizeProviderReviewCandidate(comp = {}, subjectDeal = null) {
  const subjectDealId = text(subjectDeal?.id || comp.subjectDealId || comp.dealId);
  const propertyId = text(subjectDeal?.propertyId || subjectDeal?.linkedPropertyId || comp.propertyId || comp.subjectPropertyId);
  const providerRecordId = text(comp.providerRecordId || comp.providerPropertyId || comp.compId || comp.id);
  const reviewCandidateKey = getProviderReviewCandidateKey({ ...comp, providerRecordId });
  return normalizeCompRecord({
    ...comp,
    id: text(comp.id || comp.compId || providerRecordId || reviewCandidateKey),
    providerRecordId,
    reviewCandidateKey,
    subjectDealId,
    dealId: subjectDealId,
    propertyId,
    subjectPropertyId: propertyId || subjectDealId,
    verified: false,
    inclusionStatus: "pending",
    included: false,
    providerImported: true,
    manuallyEntered: false,
    acceptanceReasons: Array.isArray(comp.acceptanceReasons) ? [...comp.acceptanceReasons] : [],
    rejectionReasons: Array.isArray(comp.rejectionReasons) ? [...comp.rejectionReasons] : [],
  });
}

export function normalizeProviderReviewCandidates(records = [], subjectDeal = null) {
  const seen = new Set();
  return (Array.isArray(records) ? records : []).reduce((items, record) => {
    const normalized = normalizeProviderReviewCandidate(record, subjectDeal);
    const key = getProviderReviewCandidateKey(normalized);
    if (!key || seen.has(key)) return items;
    seen.add(key);
    items.push(normalized);
    return items;
  }, []);
}

export function getProviderReviewCandidate(candidates = [], candidateId = "") {
  const targetId = text(candidateId);
  if (!targetId) return null;
  return (Array.isArray(candidates) ? candidates : []).find((candidate) => text(candidate.reviewCandidateKey || getProviderReviewCandidateKey(candidate) || candidate.id) === targetId || text(candidate.id) === targetId) || null;
}

export function buildProviderCandidateApprovalPayload(candidate = {}, subjectDeal = null) {
  const normalized = normalizeProviderReviewCandidate(candidate, subjectDeal);
  return buildCompCreatePayload({
    ...normalized,
    verified: true,
    inclusionStatus: "approved",
    included: false,
    exclusionReason: "",
    notes: normalized.notes || `${normalized.searchTierLabel || "Provider comp"} approved for import; Include in ARV remains off pending valuation review.`,
  }, subjectDeal);
}

export function persistedCompMatchesProviderCandidate(comps = [], candidate = {}, subjectDeal = null) {
  const normalized = normalizeProviderReviewCandidate(candidate, subjectDeal);
  return (Array.isArray(comps) ? comps : []).some((comp) => {
    if (!compBelongsToSubject(comp, subjectDeal)) return false;
    const providerId = text(comp.providerRecordId).toLowerCase();
    if (providerId && providerId === text(normalized.providerRecordId).toLowerCase()) return true;
    return text(comp.compAddress || comp.address).toLowerCase().replace(/\s+/g, " ") === text(normalized.compAddress).toLowerCase().replace(/\s+/g, " ");
  });
}

export function findPersistedProviderCandidate(comps = [], candidate = {}, subjectDeal = null) {
  const normalized = normalizeProviderReviewCandidate(candidate, subjectDeal);
  return (Array.isArray(comps) ? comps : []).map(normalizeCompRecord).find((comp) => {
    if (!compBelongsToSubject(comp, subjectDeal)) return false;
    const providerId = text(comp.providerRecordId).toLowerCase();
    const candidateProviderId = text(normalized.providerRecordId).toLowerCase();
    if (providerId && candidateProviderId) return providerId === candidateProviderId;
    return text(comp.compAddress).toLowerCase().replace(/\s+/g, " ") === text(normalized.compAddress).toLowerCase().replace(/\s+/g, " ")
      && text(comp.saleDate) === text(normalized.saleDate)
      && numberOrBlank(comp.salePrice) === numberOrBlank(normalized.salePrice);
  }) || null;
}

export function buildCompReviewCounts({ providerCandidates = [], persistedComps = [], rejectedCandidates = [] } = {}) {
  const persisted = Array.isArray(persistedComps) ? persistedComps : [];
  return {
    qualifyingReviewCandidates: Array.isArray(providerCandidates) ? providerCandidates.length : 0,
    persistedPendingComps: persisted.filter((comp) => comp.inclusionStatus === "pending" || comp.verified === false).length,
    approvedComps: persisted.filter((comp) => !["excluded", "rejected"].includes(comp.inclusionStatus) && (comp.inclusionStatus === "approved" || comp.verified === true)).length,
    rejectedCandidates: Array.isArray(rejectedCandidates) ? rejectedCandidates.length : 0,
    includedInArvComps: persisted.filter((comp) => comp.included !== false && (comp.inclusionStatus === "approved" || comp.verified === true)).length,
  };
}

export function rejectProviderReviewCandidate(providerCandidates = [], rejectedCandidates = [], candidate = {}, now = new Date().toISOString()) {
  const active = (Array.isArray(providerCandidates) ? providerCandidates : []).filter((entry) => entry.id !== candidate.id);
  const rejected = [...(Array.isArray(rejectedCandidates) ? rejectedCandidates : []), {
    ...candidate,
    inclusionStatus: "rejected",
    included: false,
    verified: false,
    rejectedAt: now,
    rejectionReason: "Rejected during provider candidate review",
  }];
  return { active, rejected };
}

export function isConfirmedPersistedComp(comp, expectedSubjectDealId = "") {
  const normalized = normalizeCompRecord(comp || {});
  return Boolean(
    normalized.id && normalized.compAddress && normalized.saleDate && normalized.salePrice !== "" &&
    normalized.squareFeet !== "" && (!expectedSubjectDealId || normalized.subjectDealId === text(expectedSubjectDealId))
  );
}

export async function persistCompViaApi({ fetchImpl, url, payload, existingId = "", headers = {}, signal }) {
  const response = await fetchImpl(existingId ? `${url}/${existingId}` : url, {
    method: existingId ? "PUT" : "POST",
    headers,
    body: JSON.stringify(payload),
    signal,
  });
  if (!response?.ok) {
    const error = new Error(existingId ? "Unable to update comp" : "Unable to create comp");
    error.status = Number(response?.status || 0);
    error.category = error.status === 401 || error.status === 403 ? "authorization" : error.status === 409 ? "duplicate" : error.status >= 500 ? "server" : "request";
    throw error;
  }
  const saved = await response.json();
  if (!isConfirmedPersistedComp(saved, payload.subjectDealId)) throw new Error("Backend did not confirm persisted comp");
  return normalizeCompRecord(saved);
}

function runWithTimeout(executor, timeoutMs) {
  const controller = typeof AbortController === "function" ? new AbortController() : null;
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      controller?.abort();
      const error = new Error("Comp import timed out");
      error.category = "timeout";
      reject(error);
    }, timeoutMs);
  });
  return Promise.race([Promise.resolve().then(() => executor(controller?.signal)), timeout]).finally(() => clearTimeout(timer));
}

export async function fetchPersistedCompsViaApi({ fetchImpl, url, headers = {}, timeoutMs = 15000 }) {
  return runWithTimeout(async (signal) => {
    const response = await fetchImpl(url, { method: "GET", headers, signal });
    if (!response?.ok) {
      const error = new Error("Unable to verify persisted comps");
      error.status = Number(response?.status || 0);
      error.category = "reconciliation";
      throw error;
    }
    const records = await response.json();
    if (!Array.isArray(records)) throw new Error("Invalid persisted comp collection");
    return records.map(normalizeCompRecord);
  }, timeoutMs);
}

export async function importProviderCandidateTransaction({ fetchImpl, url, candidate, subjectDeal, headers = {}, timeoutMs = 15000 }) {
  const payload = buildProviderCandidateApprovalPayload(candidate, subjectDeal);
  const loadPersisted = () => fetchPersistedCompsViaApi({ fetchImpl, url, headers, timeoutMs });
  const before = await loadPersisted();
  const existing = findPersistedProviderCandidate(before, candidate, subjectDeal);
  if (existing) return { status: "already_imported", comp: existing, payload, comps: before };

  try {
    const saved = await runWithTimeout((signal) => persistCompViaApi({ fetchImpl, url, payload, headers, signal }), timeoutMs);
    return { status: "succeeded", comp: saved, payload, comps: [...before.filter((entry) => entry.id !== saved.id), saved] };
  } catch (requestError) {
    try {
      const after = await loadPersisted();
      const reconciled = findPersistedProviderCandidate(after, candidate, subjectDeal);
      if (reconciled) return { status: "reconciled", comp: reconciled, payload, comps: after };
    } catch {
      // The original request result remains authoritative when reconciliation is unavailable.
    }
    const error = new Error(requestError?.category === "timeout" ? "Import timed out — verify before retrying" : "Unable to import comp. Persistence was not confirmed.");
    error.category = requestError?.category === "timeout" ? "timeout" : (requestError?.category || "failed");
    error.status = requestError?.status || 0;
    throw error;
  }
}

const median = (values) => {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
};

export function buildCompStatistics(comps = [], subjectDeal = null) {
  const normalized = (Array.isArray(comps) ? comps : []).map(normalizeCompRecord);
  const included = normalized.filter((comp) => comp.included !== false);
  const prices = included.map((comp) => Number(comp.salePrice)).filter(Number.isFinite);
  const ppsf = included.map((comp) => Number(comp.squareFeet) > 0 ? Number(comp.salePrice) / Number(comp.squareFeet) : null).filter(Number.isFinite);
  const average = (values) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
  const averagePpsf = average(ppsf);
  const subjectSqft = numberOrBlank(subjectDeal?.squareFeet);
  return {
    total: normalized.length,
    included: included.length,
    averageSalePrice: average(prices),
    medianSalePrice: median(prices),
    averagePpsf,
    medianPpsf: median(ppsf),
    baseArv: subjectSqft !== "" && averagePpsf > 0 ? subjectSqft * averagePpsf : average(prices),
  };
}
