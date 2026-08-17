import { URL } from "node:url";

function createId(prefix = "comp") {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

function normalizeAddress(address = "") {
  const suffixes = { street: "st", avenue: "ave", road: "rd", boulevard: "blvd", drive: "dr", lane: "ln", court: "ct", circle: "cir", place: "pl", highway: "hwy", parkway: "pkwy" };
  return String(address || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .map((token) => suffixes[token] || token)
    .join(" ");
}

function normalizeNumber(value) {
  if (value === "" || value === null || value === undefined) return "";
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : "";
}

function normalizeText(value) {
  return value === undefined || value === null ? "" : String(value).trim();
}

function normalizeProviderMedia(rawRecord = {}, provider = "manual") {
  const candidates = [
    ...(Array.isArray(rawRecord.media) ? rawRecord.media : []),
    ...(Array.isArray(rawRecord.photos) ? rawRecord.photos : []),
    ...(Array.isArray(rawRecord.images) ? rawRecord.images : []),
  ];
  const singleReferences = [rawRecord.photoUrl, rawRecord.imageUrl, rawRecord.thumbnailUrl].filter(Boolean);
  return [...candidates, ...singleReferences].reduce((items, value, index) => {
    const source = typeof value === "string" ? { url: value } : (value && typeof value === "object" ? value : {});
    const url = normalizeText(source.url || source.imageUrl || source.photoUrl || source.sourceUrl || source.referenceUrl);
    if (!url || items.some((item) => item.url === url)) return items;
    items.push({
      id: normalizeText(source.id) || `${provider}-media-${index + 1}`,
      label: normalizeText(source.label || source.caption) || `Provider photo ${index + 1}`,
      url,
      thumbnailUrl: normalizeText(source.thumbnailUrl || source.thumbnail) || url,
      sourceType: "provider",
      source: normalizeText(source.source) || provider,
      isPrimary: Boolean(source.isPrimary || index === 0),
      rightsMode: normalizeText(source.rightsMode) || "REMOTE_REFERENCE_ONLY",
      localStorageAllowed: false,
      thumbnailCachingAllowed: false,
      attributionRequired: source.attributionRequired !== false,
      requiresReview: true,
      includeInAppraiserPacket: false,
    });
    return items;
  }, []);
}

function normalizePropertyType(value = "") {
  const normalized = normalizeText(value).toLowerCase().replace(/[^a-z0-9]/g, "");
  if (["singlefamily", "singlefamilyresidential", "sfh", "sfr", "detached"].includes(normalized)) return "singlefamily";
  if (["duplex", "2family", "twofamily"].includes(normalized)) return "duplex";
  if (["triplex", "3family", "threefamily"].includes(normalized)) return "triplex";
  if (["fourplex", "4family", "fourfamily"].includes(normalized)) return "fourplex";
  return normalized;
}

const SOLD_COMP_SEARCH_TIERS = Object.freeze([
  Object.freeze({ searchTier: 1, searchTierLabel: "Preferred Comp — Tier 1", radiusMiles: 0.5, months: 6, squareFeetVariance: 0.2 }),
  Object.freeze({ searchTier: 2, searchTierLabel: "Expanded Comp — Tier 2", radiusMiles: 1, months: 12, squareFeetVariance: 0.2 }),
  Object.freeze({ searchTier: 3, searchTierLabel: "Expanded Comp — Tier 3", radiusMiles: 1, months: 12, squareFeetVariance: 0.3 }),
  Object.freeze({ searchTier: 4, searchTierLabel: "Backstop Comp — Tier 4", radiusMiles: 1.5, months: 18, squareFeetVariance: 0.3 }),
]);

const SOLD_COMP_PROVIDER_PAGE_SIZE = 500;
const SOLD_COMP_PROVIDER_MAX_PAGES = 4;
const SOLD_COMP_PROVIDER_MAX_RECORDS = SOLD_COMP_PROVIDER_PAGE_SIZE * SOLD_COMP_PROVIDER_MAX_PAGES;
const SOLD_COMP_TIER4_DAYS = 548;

function providerPropertyType(value = "") {
  const normalized = normalizePropertyType(value);
  const mappings = {
    singlefamily: "Single Family",
    duplex: "Multi-Family",
    triplex: "Multi-Family",
    fourplex: "Multi-Family",
  };
  return mappings[normalized] || "";
}

function closedSaleEventKey(comp = {}) {
  const address = normalizeAddress(comp.address || comp.compAddress);
  const saleDate = normalizeText(comp.saleDate);
  const salePrice = normalizeNumber(comp.salePrice);
  return address && saleDate && salePrice !== "" && salePrice > 0
    ? `sale:${address}|${saleDate}|${salePrice}`
    : "";
}

function compDeduplicationKey(comp = {}) {
  const providerId = normalizeText(comp.providerRecordId || comp.propertyId || "").toLowerCase();
  return providerId ? `provider:${providerId}` : `address:${normalizeAddress(comp.address || comp.compAddress)}`;
}

function getSaleAge(saleDate, nowValue) {
  const saleTime = Date.parse(saleDate || "");
  const nowTime = new Date(nowValue || Date.now()).getTime();
  if (!Number.isFinite(saleTime) || !Number.isFinite(nowTime)) return { days: null, months: null };
  const days = Math.floor((nowTime - saleTime) / 86400000);
  return { days, months: Math.round((days / 30.4375) * 10) / 10, future: days < 0 };
}

function evaluateSoldCompForTier(candidate, subject, tier, fullAddress, nowValue) {
  const reasons = [];
  const acceptanceReasons = [];
  const subjectType = normalizePropertyType(subject.propertyType);
  const candidateType = normalizePropertyType(candidate.propertyType);
  const optionalNumber = (value) => value === "" || value === null || value === undefined ? null : Number(value);
  const subjectSqft = optionalNumber(subject.squareFeet);
  const candidateSqft = optionalNumber(candidate.squareFeet);
  const subjectBedrooms = optionalNumber(subject.bedrooms);
  const subjectBathrooms = optionalNumber(subject.bathrooms);
  const candidateBedrooms = optionalNumber(candidate.bedrooms);
  const candidateBathrooms = optionalNumber(candidate.bathrooms);
  const bedroomVariance = Number.isFinite(subjectBedrooms) && Number.isFinite(candidateBedrooms) ? Math.abs(candidateBedrooms - subjectBedrooms) : null;
  const bathroomVariance = Number.isFinite(subjectBathrooms) && Number.isFinite(candidateBathrooms) ? Math.abs(candidateBathrooms - subjectBathrooms) : null;
  const sqftVariance = Number.isFinite(subjectSqft) && subjectSqft > 0 && Number.isFinite(candidateSqft) && candidateSqft > 0
    ? Math.abs(candidateSqft - subjectSqft) / subjectSqft
    : null;
  const saleAge = getSaleAge(candidate.saleDate, nowValue);
  const distanceMiles = candidate.distanceMiles === "" || candidate.distanceMiles === null || candidate.distanceMiles === undefined ? null : Number(candidate.distanceMiles);
  const propertyTypeMatch = Boolean(subjectType && candidateType && subjectType === candidateType);

  if (normalizeAddress(candidate.address) === normalizeAddress(fullAddress)) reasons.push("subject property is not a comparable");
  if (!candidate.saleDate || candidate.salePrice === "" || !Number.isFinite(Number(candidate.salePrice)) || Number(candidate.salePrice) <= 0 || saleAge.days === null) reasons.push("missing closed-sale date or price");
  else if (saleAge.future) reasons.push("invalid future closed-sale date");
  else if (saleAge.months > tier.months) reasons.push(`sale is older than ${tier.months} months`);
  if (!candidateType) reasons.push("missing property type");
  else if (!propertyTypeMatch) reasons.push("property-type mismatch");
  if (Number.isFinite(subjectSqft) && subjectSqft > 0 && (sqftVariance === null || sqftVariance > tier.squareFeetVariance)) reasons.push(`square footage outside ±${Math.round(tier.squareFeetVariance * 100)}%`);
  if (Number.isFinite(subjectBedrooms) && bedroomVariance === null) reasons.push("missing bedroom count");
  else if (bedroomVariance !== null && bedroomVariance > 1) reasons.push("bedroom count outside ±1");
  if (Number.isFinite(subjectBathrooms) && bathroomVariance === null) reasons.push("missing bathroom count");
  else if (bathroomVariance !== null && bathroomVariance > 1) reasons.push("bathroom count outside ±1");
  if (distanceMiles === null || !Number.isFinite(distanceMiles)) reasons.push("missing distance evidence");
  else if (distanceMiles > tier.radiusMiles) reasons.push(`distance exceeds ${tier.radiusMiles} miles`);

  if (!reasons.length) {
    acceptanceReasons.push(`within ${tier.radiusMiles} miles`, `sold within ${tier.months} months`, `square footage within ±${Math.round(tier.squareFeetVariance * 100)}%`, "bedrooms and bathrooms within ±1", "property type matches");
  }
  const closeness = {
    distance: distanceMiles === null ? 0.5 : Math.max(0, 1 - distanceMiles / tier.radiusMiles),
    recency: saleAge.months === null ? 0 : Math.max(0, 1 - saleAge.months / tier.months),
    squareFeet: sqftVariance === null ? 0 : Math.max(0, 1 - sqftVariance / tier.squareFeetVariance),
    bedrooms: bedroomVariance === null ? 0.5 : Math.max(0, 1 - bedroomVariance),
    bathrooms: bathroomVariance === null ? 0.5 : Math.max(0, 1 - bathroomVariance),
    propertyType: propertyTypeMatch ? 1 : 0,
  };
  const withinTierScore = closeness.distance * 0.25 + closeness.recency * 0.2 + closeness.squareFeet * 0.25 + closeness.bedrooms * 0.1 + closeness.bathrooms * 0.1 + closeness.propertyType * 0.1;
  // Disjoint score bands guarantee an otherwise-similar earlier tier always ranks first.
  const similarityScore = Math.round(Math.max(0, Math.min(100, 100 - ((tier.searchTier - 1) * 20) - ((1 - withinTierScore) * 19))) * 10) / 10;
  return {
    accepted: reasons.length === 0,
    reasons,
    acceptanceReasons,
    metrics: {
      searchTier: tier.searchTier,
      searchTierLabel: tier.searchTierLabel,
      distanceMiles,
      saleAgeDays: saleAge.days,
      saleAgeMonths: saleAge.months,
      squareFeetVariancePercentage: sqftVariance === null ? null : Math.round(sqftVariance * 1000) / 10,
      bedroomVariance,
      bathroomVariance,
      propertyTypeMatch,
      futureSaleDate: Boolean(saleAge.future),
      similarityScore,
    },
  };
}

function distanceMilesBetween(lat1, lon1, lat2, lon2) {
  if ([lat1, lon1, lat2, lon2].some((value) => value === null || value === undefined || value === "")) return null;
  const values = [lat1, lon1, lat2, lon2].map(Number);
  if (!values.every(Number.isFinite)) return null;
  const [aLat, aLon, bLat, bLon] = values.map((value) => value * Math.PI / 180);
  const deltaLat = bLat - aLat;
  const deltaLon = bLon - aLon;
  const h = Math.sin(deltaLat / 2) ** 2 + Math.cos(aLat) * Math.cos(bLat) * Math.sin(deltaLon / 2) ** 2;
  return 3958.8 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function buildCompProviderConfig(overrides = {}) {
  const env = overrides.env || {};
  const fetchImpl = overrides.fetchImpl || globalThis.fetch;
  const rentcastApiKey = normalizeText(env.RENTCAST_API_KEY || overrides.rentcastApiKey || "");
  return {
    rentcastApiKey,
    rentcastBaseUrl: normalizeText(env.RENTCAST_BASE_URL || overrides.rentcastBaseUrl || "https://api.rentcast.io"),
    provider: normalizeText(env.COMP_PROVIDER || overrides.provider || (rentcastApiKey ? "rentcast" : "manual")),
    defaultRadius: normalizeNumber(env.COMP_SEARCH_DEFAULT_RADIUS || overrides.defaultRadius || 0.5),
    maxRadius: normalizeNumber(env.COMP_SEARCH_MAX_RADIUS || overrides.maxRadius || 1),
    defaultMonths: normalizeNumber(env.COMP_SEARCH_DEFAULT_MONTHS || overrides.defaultMonths || 6),
    maxResults: normalizeNumber(env.COMP_SEARCH_MAX_RESULTS || overrides.maxResults || 10),
    cacheTtl: normalizeNumber(env.COMP_CACHE_TTL || overrides.cacheTtl || 300000),
    requestTimeout: normalizeNumber(env.COMP_REQUEST_TIMEOUT || overrides.requestTimeout || 4000),
    fetchImpl,
  };
}

function buildNormalizedCompRecord(rawRecord = {}, subjectProperty = {}, provider = "manual") {
  const salePrice = normalizeNumber(rawRecord.salePrice ?? rawRecord.price ?? rawRecord.listPrice ?? 0);
  const squareFeet = normalizeNumber(rawRecord.squareFeet ?? rawRecord.square_footage ?? 0);
  const bedrooms = normalizeNumber(rawRecord.bedrooms ?? 0);
  const bathrooms = normalizeNumber(rawRecord.bathrooms ?? 0);
  const yearBuilt = normalizeNumber(rawRecord.yearBuilt ?? 0);
  const distanceMiles = normalizeNumber(rawRecord.distanceMiles ?? rawRecord.distance ?? 0);
  const subjectSquareFeet = normalizeNumber(subjectProperty.squareFeet ?? 0);
  const subjectBedrooms = normalizeNumber(subjectProperty.bedrooms ?? 0);
  const subjectBathrooms = normalizeNumber(subjectProperty.bathrooms ?? 0);
  const subjectYearBuilt = normalizeNumber(subjectProperty.yearBuilt ?? 0);

  const normalizedProvider = normalizeText(rawRecord.provider || provider);
  const media = normalizeProviderMedia(rawRecord, normalizedProvider || provider);
  return {
    id: rawRecord.id || createId("comp"),
    compId: rawRecord.compId || createId("comp"),
    subjectPropertyId: rawRecord.subjectPropertyId || subjectProperty.id || "",
    providerRecordId: rawRecord.providerRecordId || "",
    provider: normalizedProvider,
    sourceType: rawRecord.sourceType || (rawRecord.providerImported ? "provider" : rawRecord.manuallyEntered ? "manual" : "manual"),
    address: normalizeText(rawRecord.address || rawRecord.compAddress || rawRecord.propertyAddress),
    normalizedAddress: normalizeAddress(rawRecord.address || rawRecord.compAddress || rawRecord.propertyAddress),
    city: normalizeText(rawRecord.city || subjectProperty.city || ""),
    state: normalizeText(rawRecord.state || subjectProperty.state || ""),
    zip: normalizeText(rawRecord.zipCode || rawRecord.zip || subjectProperty.zipCode || ""),
    latitude: normalizeNumber(rawRecord.latitude ?? ""),
    longitude: normalizeNumber(rawRecord.longitude ?? ""),
    propertyType: normalizeText(rawRecord.propertyType || (rawRecord.providerImported ? "" : subjectProperty.propertyType || "Single Family")),
    bedrooms,
    bathrooms,
    squareFeet,
    lotSize: normalizeText(rawRecord.lotSize || ""),
    yearBuilt,
    stories: normalizeNumber(rawRecord.stories ?? ""),
    garage: normalizeText(rawRecord.garage || ""),
    basement: normalizeText(rawRecord.basement || ""),
    condition: normalizeText(rawRecord.condition || "Average"),
    renovationLevel: normalizeText(rawRecord.renovationLevel || ""),
    salePrice,
    saleDate: normalizeText(rawRecord.saleDate || ""),
    recordingDate: normalizeText(rawRecord.recordingDate || ""),
    listingPrice: normalizeNumber(rawRecord.listingPrice ?? ""),
    status: normalizeText(rawRecord.status || "closed"),
    armsLengthStatus: normalizeText(rawRecord.armsLengthStatus || "unknown"),
    concessions: normalizeText(rawRecord.concessions || ""),
    transactionType: normalizeText(rawRecord.transactionType || "sale"),
    distanceMiles: distanceMiles,
    saleAgeMonths: normalizeNumber(rawRecord.saleAgeMonths ?? ""),
    pricePerSquareFoot: squareFeet > 0 ? salePrice / squareFeet : 0,
    adjustedValue: normalizeNumber(rawRecord.adjustedValue ?? salePrice),
    weightedValue: normalizeNumber(rawRecord.weightedValue ?? salePrice),
    qualityScore: normalizeNumber(rawRecord.qualityScore ?? 0),
    confidenceScore: normalizeNumber(rawRecord.confidenceScore ?? 0),
    similarityScore: normalizeNumber(rawRecord.similarityScore ?? 0),
    inclusionStatus: rawRecord.inclusionStatus || "pending",
    exclusionReason: rawRecord.exclusionReason || "",
    warningFlags: Array.isArray(rawRecord.warningFlags) ? rawRecord.warningFlags : [],
    media,
    mediaAvailability: rawRecord.mediaAvailability || {
      status: media.length ? "AVAILABLE" : "NOT_PROVIDED",
      provider: normalizedProvider,
      reason: media.length
        ? "Provider returned remote media references."
        : normalizedProvider === "rentcast"
          ? "RentCast property records do not include photo fields; a licensed listing-media source or manual upload is required."
          : "The provider response did not include media references.",
    },
    mediaRightsStatus: normalizeText(rawRecord.mediaRightsStatus || "REMOTE_REFERENCE_ONLY"),
    attributionRequired: rawRecord.attributionRequired !== false,
    sourceURL: normalizeText(rawRecord.sourceURL || rawRecord.sourceLink || ""),
    providerUpdatedAt: normalizeText(rawRecord.providerUpdatedAt || ""),
    importedAt: normalizeText(rawRecord.importedAt || new Date().toISOString()),
    manuallyEntered: Boolean(rawRecord.manuallyEntered),
    providerImported: Boolean(rawRecord.providerImported),
    verified: Boolean(rawRecord.verified),
    verifiedBy: normalizeText(rawRecord.verifiedBy || ""),
    verifiedAt: normalizeText(rawRecord.verifiedAt || ""),
    lastReviewedAt: normalizeText(rawRecord.lastReviewedAt || ""),
    staleStatus: normalizeText(rawRecord.staleStatus || "fresh"),
    active: rawRecord.active !== false,
    notes: normalizeText(rawRecord.notes || ""),
    recordVersion: normalizeNumber(rawRecord.recordVersion ?? 1),
    valuationVersion: normalizeNumber(rawRecord.valuationVersion ?? 1),
    sourceSnapshot: rawRecord.sourceSnapshot || null,
    auditReference: normalizeText(rawRecord.auditReference || ""),
    createdAt: normalizeText(rawRecord.createdAt || new Date().toISOString()),
    updatedAt: normalizeText(rawRecord.updatedAt || new Date().toISOString()),
    subjectSimilarity: {
      squareFeet: subjectSquareFeet > 0 && squareFeet > 0 ? Math.min(1, Math.max(0, 1 - Math.abs(squareFeet - subjectSquareFeet) / Math.max(subjectSquareFeet, 1))) : 0.5,
      bedrooms: subjectBedrooms > 0 && bedrooms > 0 ? Math.min(1, Math.max(0, 1 - Math.abs(bedrooms - subjectBedrooms) / Math.max(subjectBedrooms, 1))) : 0.5,
      bathrooms: subjectBathrooms > 0 && bathrooms > 0 ? Math.min(1, Math.max(0, 1 - Math.abs(bathrooms - subjectBathrooms) / Math.max(subjectBathrooms, 1))) : 0.5,
      yearBuilt: subjectYearBuilt > 0 && yearBuilt > 0 ? Math.min(1, Math.max(0, 1 - Math.abs(yearBuilt - subjectYearBuilt) / Math.max(subjectYearBuilt, 1))) : 0.5,
    },
  };
}

function scoreCompQuality(comp = {}, subjectProperty = {}) {
  const recencyDays = getDaysSinceSale(comp.saleDate);
  const recencyScore = recencyDays === null ? 0.5 : Math.max(0, Math.min(1, 1 - recencyDays / 1800));
  const distanceScore = comp.distanceMiles ? Math.max(0, Math.min(1, 1 - comp.distanceMiles / 15)) : 0.65;
  const sqftScore = comp.subjectSimilarity?.squareFeet ?? 0.65;
  const bedroomScore = comp.subjectSimilarity?.bedrooms ?? 0.65;
  const bathroomScore = comp.subjectSimilarity?.bathrooms ?? 0.65;
  const yearBuiltScore = comp.subjectSimilarity?.yearBuilt ?? 0.65;
  const conditionScore = 0.65;
  const baseScore = recencyScore * 0.18 + distanceScore * 0.2 + sqftScore * 0.18 + bedroomScore * 0.12 + bathroomScore * 0.12 + yearBuiltScore * 0.1 + conditionScore * 0.1;
  const completenessScore = getDataCompletenessScore(comp);
  const sourceQualityScore = getSourceQualityScore(comp);
  const finalCompQualityScore = Math.max(0, Math.min(100, baseScore * 100 * 0.8 + completenessScore * 0.15 + sourceQualityScore * 0.05));
  let inclusionRecommendation = "Weak Comp";
  if (finalCompQualityScore >= 80) inclusionRecommendation = "Strong Comp";
  else if (finalCompQualityScore >= 65) inclusionRecommendation = "Supporting Comp";
  else if (finalCompQualityScore >= 45) inclusionRecommendation = "Weak Comp";
  else inclusionRecommendation = "Exclude";
  if (!comp.salePrice || !comp.squareFeet || !comp.bedrooms || !comp.bathrooms || !comp.saleDate) inclusionRecommendation = "Insufficient Data";
  return {
    rawSimilarityScore: Math.round(baseScore * 1000) / 10,
    dataCompletenessScore: Math.round(completenessScore * 10) / 10,
    sourceQualityScore: Math.round(sourceQualityScore * 10) / 10,
    finalCompQualityScore: Math.round(finalCompQualityScore * 10) / 10,
    inclusionRecommendation,
    confidenceRating: finalCompQualityScore >= 80 ? "High" : finalCompQualityScore >= 60 ? "Moderate" : "Low",
  };
}

function getDataCompletenessScore(comp = {}) {
  const completed = [comp.salePrice, comp.squareFeet, comp.bedrooms, comp.bathrooms, comp.saleDate].filter((value) => value !== "" && value !== undefined && value !== null).length;
  return Math.round((completed / 5) * 100);
}

function getSourceQualityScore(comp = {}) {
  if (comp.providerImported) return 70;
  if (comp.manuallyEntered) return 60;
  return 50;
}

function getDaysSinceSale(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const today = new Date();
  const diffMs = today.setHours(0, 0, 0, 0) - date.setHours(0, 0, 0, 0);
  return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
}

class ManualCompAdapter {
  constructor(config = {}) {
    this.config = buildCompProviderConfig(config);
  }

  normalizeAddress(address = "") {
    return normalizeAddress(address);
  }

  getSubjectProperty() {
    return null;
  }

  getSaleHistory() {
    return [];
  }

  async searchSoldComparables() {
    return [];
  }

  async searchActiveListings() {
    return [];
  }

  async getRentEstimate() {
    return null;
  }

  async testConnection() {
    return { ok: true, provider: "manual", status: "Manual Entry Ready" };
  }

  getProviderStatus() {
    return { provider: "manual", status: "Manual Entry Ready", configured: true, keyPresent: false };
  }
}

class RentCastCompAdapter {
  constructor(config = {}) {
    this.config = buildCompProviderConfig(config);
  }

  normalizeAddress(address = "") {
    return normalizeAddress(address);
  }

  getSubjectProperty() {
    return null;
  }

  getSaleHistory() {
    return [];
  }

  async _fetchJson(path, options = {}) {
    if (!this.config.rentcastApiKey) {
      return { ok: false, errorCode: "not_configured", status: "Provider Not Configured" };
    }

    const url = new URL(path, this.config.rentcastBaseUrl.endsWith("/") ? this.config.rentcastBaseUrl : `${this.config.rentcastBaseUrl}/`);
    const headers = {
      "X-Api-Key": this.config.rentcastApiKey,
      Accept: "application/json",
      ...(options.headers || {}),
    };

    try {
      const response = await (this.config.fetchImpl || globalThis.fetch)(url, {
        method: options.method || "GET",
        headers,
        signal: AbortSignal.timeout(this.config.requestTimeout || 4000),
      });
      const text = await response.text();
      let payload = {};
      try {
        payload = text ? JSON.parse(text) : {};
      } catch {
        payload = {};
      }
      if (!response.ok) {
        const errorCode = payload?.error || payload?.status || "provider_failure";
        if (response.status === 401 || response.status === 403) {
          return { ok: false, errorCode: "unauthorized", status: "Unauthorized", payload };
        }
        if (response.status === 402 || response.status === 429) {
          return { ok: false, errorCode: "rate_limited", status: "Rate Limited", payload };
        }
        if (response.status >= 400 && response.status < 500) {
          return { ok: false, errorCode: "invalid_request", status: "Invalid Request", payload };
        }
        return { ok: false, errorCode: "provider_failure", status: "Temporary Provider Failure", payload };
      }
      return { ok: true, payload };
    } catch (error) {
      if (error?.name === "AbortError" || error?.name === "TimeoutError") {
        return { ok: false, errorCode: "timeout", status: "Provider Unavailable / Timeout" };
      }
      return { ok: false, errorCode: "provider_failure", status: "Temporary Provider Failure" };
    }
  }

  async testConnection() {
    if (!this.config.rentcastApiKey) {
      return { ok: false, provider: "rentcast", status: "RentCast Not Configured", errorCode: "not_configured" };
    }
    const result = await this._fetchJson("/v1/properties/random?limit=1", { method: "GET" });
    if (!result.ok) {
      const status = result.errorCode === "unauthorized"
        ? "RentCast API Key Invalid or Unauthorized"
        : result.errorCode === "rate_limited"
          ? "RentCast Rate or Usage Limit Reached"
          : ["timeout", "provider_failure"].includes(result.errorCode)
            ? "RentCast Unavailable / Network Failure"
            : result.status;
      return {
        ok: false,
        provider: "rentcast",
        status,
        errorCode: result.errorCode,
      };
    }
    return { ok: true, provider: "rentcast", status: "Connected", errorCode: null };
  }

  async getSubjectProperty(address = "") {
    if (!address) return { ok: false, errorCode: "invalid_request", status: "Invalid Request" };
    const normalizedAddress = this.normalizeAddress(address);
    if (!normalizedAddress) return { ok: false, errorCode: "invalid_request", status: "Invalid Request" };
    const result = await this._fetchJson(`/v1/properties?address=${encodeURIComponent(normalizedAddress)}&limit=1`);
    if (!result.ok) return { ok: false, errorCode: result.errorCode, status: result.status };
    const payload = Array.isArray(result.payload) ? result.payload[0] : Array.isArray(result.payload?.properties) ? result.payload.properties[0] : result.payload;
    const propertyAddress = payload?.formattedAddress || payload?.address || payload?.addressLine1 || "";
    if (!propertyAddress) {
      return { ok: false, errorCode: "no_results", status: "No Results" };
    }
    return {
      ok: true,
      status: "Success",
      property: {
        provider: "rentcast",
        providerRecordId: payload.id || payload.propertyId || "",
        address: propertyAddress,
        city: payload.city || "",
        state: payload.state || "",
        zip: payload.zipCode || payload.zip || "",
        propertyType: payload.propertyType || "Single Family",
        bedrooms: normalizeNumber(payload.bedrooms ?? payload.bedroomCount ?? 0),
        bathrooms: normalizeNumber(payload.bathrooms ?? payload.bathroomCount ?? 0),
        squareFeet: normalizeNumber(payload.squareFootage ?? payload.squareFeet ?? payload.livingArea ?? 0),
        lotSize: normalizeNumber(payload.lotSize ?? payload.lotSizeSqFt ?? 0),
        yearBuilt: normalizeNumber(payload.yearBuilt ?? 0),
        latitude: normalizeNumber(payload.latitude ?? 0),
        longitude: normalizeNumber(payload.longitude ?? 0),
        sourceSnapshot: payload,
      },
    };
  }

  async searchSoldComparablesDetailed(options = {}) {
    const fullAddress = [options.address || options.subjectAddress, options.city, options.state, options.zipCode || options.zip].filter(Boolean).join(", ");
    const normalizedAddress = this.normalizeAddress(fullAddress);
    const latitude = options.latitude === "" || options.latitude === null || options.latitude === undefined ? null : Number(options.latitude);
    const longitude = options.longitude === "" || options.longitude === null || options.longitude === undefined ? null : Number(options.longitude);
    const hasCoordinates = Number.isFinite(latitude) && Number.isFinite(longitude);
    if (!normalizedAddress && !hasCoordinates) {
      return { ok: false, status: "Invalid Request", errorCode: "invalid_request", providerCandidates: [], qualifyingCandidates: [], rejectedCandidates: [] };
    }
    const pageSize = Math.min(SOLD_COMP_PROVIDER_PAGE_SIZE, Math.max(1, Number(options.providerPageSize) || SOLD_COMP_PROVIDER_PAGE_SIZE));
    const maxPages = Math.min(SOLD_COMP_PROVIDER_MAX_PAGES, Math.max(1, Number(options.providerMaxPages) || SOLD_COMP_PROVIDER_MAX_PAGES));
    const maxRecords = Math.min(SOLD_COMP_PROVIDER_MAX_RECORDS, pageSize * maxPages);
    const locationQuery = hasCoordinates
      ? `latitude=${latitude}&longitude=${longitude}`
      : `address=${encodeURIComponent(normalizedAddress)}`;
    const subject = { propertyType: options.propertyType, squareFeet: options.squareFeet, bedrooms: options.bedrooms, bathrooms: options.bathrooms };
    const providerCandidateMap = new Map();
    const providerIds = new Set();
    const saleEvents = new Set();
    const tierCounts = { 1: 0, 2: 0, 3: 0, 4: 0 };
    const tiersRun = [];
    const diagnostics = {
      providerRecordsRetrieved: 0,
      pagesRetrieved: 0,
      normalizedRecords: 0,
      failedNormalizationRecords: 0,
      invalidSaleRecords: 0,
      futureSaleRecords: 0,
      missingDistanceRecords: 0,
      missingPropertyTypeRecords: 0,
      propertyTypeMismatches: 0,
      squareFeetRejections: 0,
      bedroomRejections: 0,
      bathroomRejections: 0,
      deduplicatedRecords: 0,
      supersededSaleEvents: 0,
      providerCapReached: false,
      providerRecordCap: maxRecords,
      providerPageCap: maxPages,
    };
    const providerType = providerPropertyType(options.propertyType);
    const providerFilter = `${locationQuery}&radius=1.5&saleDateRange=${SOLD_COMP_TIER4_DAYS}${providerType ? `&propertyType=${encodeURIComponent(providerType)}` : ""}`;
    let offset = 0;
    let lastPageFull = false;

    for (let page = 0; page < maxPages && diagnostics.providerRecordsRetrieved < maxRecords; page += 1) {
      const result = await this._fetchJson(`/v1/properties?${providerFilter}&limit=${pageSize}&offset=${offset}`);
      if (!result.ok) return { ok: false, status: result.status, errorCode: result.errorCode, providerCandidates: [...providerCandidateMap.values()], qualifyingCandidates: [], rejectedCandidates: [], tierCounts, tiersRun, diagnostics };
      diagnostics.pagesRetrieved += 1;
      const properties = Array.isArray(result.payload) ? result.payload : Array.isArray(result.payload?.properties) ? result.payload.properties : [];
      diagnostics.providerRecordsRetrieved += properties.length;
      lastPageFull = properties.length === pageSize;
      diagnostics.failedNormalizationRecords += properties.filter((property) => !(property?.formattedAddress || property?.address || property?.addressLine1)).length;
      const normalizedRecords = properties
      .filter((property) => property?.formattedAddress || property?.address || property?.addressLine1)
      .map((property) => {
        const calculatedDistance = distanceMilesBetween(latitude, longitude, property.latitude, property.longitude);
        const normalized = buildNormalizedCompRecord({
          id: `rentcast-${property.id || createId("comp")}`,
          compId: property.id || createId("comp"),
          providerRecordId: property.id || property.propertyId || "",
          address: property.formattedAddress || property.address || property.addressLine1 || "",
          city: property.city || "",
          state: property.state || "",
          zipCode: property.zipCode || property.zip || "",
          propertyType: property.propertyType || "",
          bedrooms: normalizeNumber(property.bedrooms),
          bathrooms: normalizeNumber(property.bathrooms),
          squareFeet: normalizeNumber(property.squareFootage ?? property.squareFeet),
          yearBuilt: normalizeNumber(property.yearBuilt),
          salePrice: normalizeNumber(property.lastSalePrice),
          saleDate: property.lastSaleDate || "",
          latitude: normalizeNumber(property.latitude),
          longitude: normalizeNumber(property.longitude),
          distanceMiles: normalizeNumber(property.distance ?? calculatedDistance ?? ""),
          providerImported: true,
          verified: false,
          inclusionStatus: "pending",
          sourceURL: property.sourceURL || property.sourceLink || "",
          sourceSnapshot: property,
          sourceType: "provider",
          status: property.status === "sold" ? "closed" : (property.status || "closed"),
          manuallyEntered: false,
          active: true,
          statusLabel: property.status || "closed",
          notes: property.notes || "",
        }, {
          address: options.address || "",
          city: options.city || "",
          state: options.state || "",
          zipCode: options.zipCode || "",
          propertyType: options.propertyType || "Single Family",
          bedrooms: normalizeNumber(options.bedrooms ?? 0),
          bathrooms: normalizeNumber(options.bathrooms ?? 0),
          squareFeet: normalizeNumber(options.squareFeet ?? 0),
          yearBuilt: normalizeNumber(options.yearBuilt ?? 0),
        }, "rentcast");
        return normalized;
      });
      diagnostics.normalizedRecords += normalizedRecords.length;
      for (const candidate of normalizedRecords) {
        const providerId = normalizeText(candidate.providerRecordId).toLowerCase();
        const saleEvent = closedSaleEventKey(candidate);
        if ((providerId && providerIds.has(providerId)) || (saleEvent && saleEvents.has(saleEvent))) {
          diagnostics.deduplicatedRecords += 1;
          continue;
        }
        if (providerId) providerIds.add(providerId);
        if (saleEvent) saleEvents.add(saleEvent);
        providerCandidateMap.set(compDeduplicationKey(candidate), candidate);
      }
      if (properties.length < pageSize) break;
      offset += pageSize;
    }
    diagnostics.providerCapReached = lastPageFull && diagnostics.pagesRetrieved === maxPages;

    const acceptedKeys = new Set();
    const qualifyingCandidates = [];
    const rejectionTrace = new Map();
    const currentSaleByAddress = new Map();
    const nowTime = new Date(options.now || Date.now()).getTime();
    for (const [key, candidate] of providerCandidateMap) {
      const address = normalizeAddress(candidate.address);
      const saleTime = Date.parse(candidate.saleDate || "");
      if (!address || !Number.isFinite(saleTime) || saleTime > nowTime || !(Number(candidate.salePrice) > 0)) continue;
      const current = currentSaleByAddress.get(address);
      if (!current || saleTime > current.saleTime) currentSaleByAddress.set(address, { key, saleTime });
    }
    const supersededKeys = new Set();
    for (const [key, candidate] of providerCandidateMap) {
      const address = normalizeAddress(candidate.address);
      const saleTime = Date.parse(candidate.saleDate || "");
      const current = currentSaleByAddress.get(address);
      if (current && current.key !== key && Number.isFinite(saleTime) && saleTime <= nowTime && Number(candidate.salePrice) > 0) {
        supersededKeys.add(key);
        diagnostics.supersededSaleEvents += 1;
        rejectionTrace.set(key, {
          id: candidate.id,
          providerRecordId: candidate.providerRecordId,
          tierTrace: [{ accepted: false, searchTier: null, searchTierLabel: "Pre-tier validation", reasons: ["superseded historical sale event"] }],
          allReasons: new Set(["superseded historical sale event"]),
        });
      }
    }
    for (const tier of SOLD_COMP_SEARCH_TIERS) {
      if (qualifyingCandidates.length >= 3) break;
      tiersRun.push(tier.searchTier);
      for (const [key, candidate] of providerCandidateMap) {
        if (acceptedKeys.has(key) || supersededKeys.has(key)) continue;
        const evaluation = evaluateSoldCompForTier(candidate, subject, tier, fullAddress, options.now);
        const enriched = { ...candidate, ...evaluation.metrics, acceptanceReasons: evaluation.acceptanceReasons, rejectionReasons: evaluation.reasons, verified: false, inclusionStatus: "pending", included: false };
        providerCandidateMap.set(key, enriched);
        if (evaluation.accepted) {
          const priorTrace = rejectionTrace.get(key)?.tierTrace || [];
          const acceptedEnriched = {
            ...enriched,
            tierTrace: [...priorTrace, { accepted: true, searchTier: tier.searchTier, searchTierLabel: tier.searchTierLabel, reasons: [], ...evaluation.metrics }],
            priorRejectionReasons: [...new Set(priorTrace.flatMap((entry) => entry.reasons || []))],
          };
          providerCandidateMap.set(key, acceptedEnriched);
          acceptedKeys.add(key);
          qualifyingCandidates.push(acceptedEnriched);
          tierCounts[tier.searchTier] += 1;
        } else {
          const existing = rejectionTrace.get(key) || { id: candidate.id, providerRecordId: candidate.providerRecordId, tierTrace: [], allReasons: new Set() };
          existing.tierTrace.push({ accepted: false, searchTier: tier.searchTier, searchTierLabel: tier.searchTierLabel, reasons: evaluation.reasons, ...evaluation.metrics });
          for (const reason of evaluation.reasons) existing.allReasons.add(reason);
          rejectionTrace.set(key, existing);
        }
      }
    }
    qualifyingCandidates.sort((a, b) => a.searchTier - b.searchTier || b.similarityScore - a.similarityScore);
    const providerCandidates = [...providerCandidateMap.values()];
    const rejectedCandidates = [...rejectionTrace.entries()]
      .filter(([key]) => !acceptedKeys.has(key))
      .map(([, entry]) => ({ ...entry, reasons: [...entry.allReasons], allReasons: undefined }));
    const rejectedReasonSets = rejectedCandidates.map((entry) => new Set(entry.reasons));
    diagnostics.invalidSaleRecords = rejectedReasonSets.filter((reasons) => reasons.has("missing closed-sale date or price")).length;
    diagnostics.futureSaleRecords = rejectedReasonSets.filter((reasons) => reasons.has("invalid future closed-sale date")).length;
    diagnostics.missingDistanceRecords = rejectedReasonSets.filter((reasons) => reasons.has("missing distance evidence")).length;
    diagnostics.missingPropertyTypeRecords = rejectedReasonSets.filter((reasons) => reasons.has("missing property type")).length;
    diagnostics.propertyTypeMismatches = rejectedReasonSets.filter((reasons) => reasons.has("property-type mismatch")).length;
    diagnostics.squareFeetRejections = rejectedReasonSets.filter((reasons) => [...reasons].some((reason) => reason.startsWith("square footage outside"))).length;
    diagnostics.bedroomRejections = rejectedReasonSets.filter((reasons) => [...reasons].some((reason) => reason.includes("bedroom"))).length;
    diagnostics.bathroomRejections = rejectedReasonSets.filter((reasons) => [...reasons].some((reason) => reason.includes("bathroom"))).length;
    diagnostics.tierCounts = { ...tierCounts };
    diagnostics.finalReviewCandidateCount = qualifyingCandidates.length;
    const status = qualifyingCandidates.length ? "Qualifying Comps Found" : "No qualifying comps found through the Royal Star extended search.";
    return { ok: true, status, errorCode: null, providerCandidates, qualifyingCandidates, rejectedCandidates, tierCounts, tiersRun, totalReviewCandidates: qualifyingCandidates.length, diagnostics };
  }

  async searchSoldComparables(options = {}) {
    const result = await this.searchSoldComparablesDetailed(options);
    return result.ok ? result.qualifyingCandidates : [];
  }

  async searchActiveListings(options = {}) {
    const address = options.address || options.subjectAddress || "";
    const normalizedAddress = this.normalizeAddress(address);
    if (!normalizedAddress) return [];
    const result = await this._fetchJson(`/v1/listings/sale?address=${encodeURIComponent(normalizedAddress)}&radius=${options.radiusMiles ?? this.config.defaultRadius ?? 0.5}`);
    if (!result.ok) return [];
    const properties = Array.isArray(result.payload?.properties) ? result.payload.properties : Array.isArray(result.payload) ? result.payload : [];
    return properties
      .filter((property) => property?.address)
      .map((property) => ({
        ...property,
        providerImported: true,
        verified: false,
        inclusionStatus: "pending",
        status: "active",
      }));
  }

  async getRentEstimate(address = "") {
    if (!address) return null;
    const result = await this._fetchJson(`/v1/avm/rent/long-term?address=${encodeURIComponent(this.normalizeAddress(address))}`);
    if (!result.ok) return null;
    return result.payload;
  }

  getProviderStatus() {
    if (!this.config.rentcastApiKey) {
      return { provider: "rentcast", status: "RentCast Not Configured", configured: false, keyPresent: false, errorCode: "not_configured" };
    }
    return { provider: "rentcast", status: "Configured", configured: true, keyPresent: true, errorCode: null };
  }
}

function buildDefaultCapabilities(overrides = {}) {
  return {
    propertyRecords: true,
    publicRecordSales: false,
    mlsListings: false,
    closedMlsSales: false,
    activeListings: false,
    pendingListings: false,
    listingHistory: false,
    propertyPhotos: false,
    floorPlans: false,
    virtualTours: false,
    documents: false,
    avms: false,
    rentEstimates: false,
    permittedLocalImageStorage: false,
    permittedThumbnailCaching: false,
    requiredAttribution: false,
    mediaExpirationRequirements: false,
    redistributionRestrictions: false,
    mediaRightsUnknown: true,
    ...overrides,
  };
}

function buildDefaultLicenseCapabilities(overrides = {}) {
  return {
    localStorageAllowed: false,
    thumbnailCachingAllowed: false,
    attributionRequired: false,
    retentionDays: 0,
    exportAllowed: false,
    displayContexts: ["review"],
    mediaExpirationRequired: false,
    redistributionRestricted: true,
    requiresReview: true,
    ...overrides,
  };
}

class AttomCompAdapter {
  constructor(config = {}) {
    this.config = buildCompProviderConfig(config);
  }

  normalizeAddress(address = "") {
    return normalizeAddress(address);
  }

  getCapabilities() {
    return buildDefaultCapabilities({ publicRecordSales: false, avms: false, propertyRecords: true, requiredAttribution: true, redistributionRestrictions: true });
  }

  getLicenseCapabilities() {
    return buildDefaultLicenseCapabilities({ attributionRequired: true, redistributionRestricted: true, exportAllowed: false, localStorageAllowed: false, thumbnailCachingAllowed: false });
  }

  getSubjectProperty() { return null; }
  getSaleHistory() { return []; }
  async searchSoldComparables() { return []; }
  async searchActiveListings() { return []; }
  async getListingHistory() { return []; }
  async getPropertyMedia() { return []; }
  async getRentEstimate() { return null; }
  async getValuationEstimate() { return null; }
  async getProviderRecord() { return null; }
  async refreshProviderRecord() { return { ok: false, status: "Disabled" }; }
  async testConnection() {
    const status = this.getProviderStatus();
    return { ok: false, provider: "attom", status: status.status, errorCode: status.errorCode || "disabled" };
  }
  getProviderStatus() {
    const configured = Boolean(this.config.attomApiKey || this.config.attomBaseUrl);
    return { provider: "attom", status: configured ? "Configured" : "Disabled", configured, keyPresent: Boolean(this.config.attomApiKey), errorCode: configured ? null : "disabled" };
  }
}

class ResoMlsCompAdapter {
  constructor(config = {}) {
    this.config = buildCompProviderConfig(config);
  }

  normalizeAddress(address = "") {
    return normalizeAddress(address);
  }

  getCapabilities() {
    return buildDefaultCapabilities({ propertyRecords: true, mlsListings: false, closedMlsSales: false, activeListings: false, pendingListings: false, listingHistory: false, propertyPhotos: false, documents: false, requiredAttribution: true, redistributionRestrictions: true });
  }

  getLicenseCapabilities() {
    return buildDefaultLicenseCapabilities({ attributionRequired: true, redistributionRestricted: true, exportAllowed: false, localStorageAllowed: false, thumbnailCachingAllowed: false });
  }

  getSubjectProperty() { return null; }
  getSaleHistory() { return []; }
  async searchSoldComparables() { return []; }
  async searchActiveListings() { return []; }
  async getListingHistory() { return []; }
  async getPropertyMedia() { return []; }
  async getRentEstimate() { return null; }
  async getValuationEstimate() { return null; }
  async getProviderRecord() { return null; }
  async refreshProviderRecord() { return { ok: false, status: "Disabled" }; }
  async testConnection() {
    const status = this.getProviderStatus();
    return { ok: false, provider: "reso-mls", status: status.status, errorCode: status.errorCode || "disabled" };
  }
  getProviderStatus() {
    const configured = Boolean(this.config.resoBaseUrl || this.config.resoDatasetId || this.config.resoClientId || this.config.resoAccessToken);
    return { provider: "reso-mls", status: configured ? "Configured" : "Disabled", configured, keyPresent: Boolean(this.config.resoAccessToken), errorCode: configured ? null : "disabled" };
  }
}

class BridgeResoAdapter {
  constructor(config = {}) {
    this.config = buildCompProviderConfig(config);
  }

  normalizeAddress(address = "") {
    return normalizeAddress(address);
  }

  getCapabilities() {
    return buildDefaultCapabilities({ propertyRecords: true, mlsListings: false, listingHistory: false, propertyPhotos: false, mediaRightsUnknown: true, requiredAttribution: true, redistributionRestrictions: true });
  }

  getLicenseCapabilities() {
    return buildDefaultLicenseCapabilities({ attributionRequired: true, redistributionRestricted: true, exportAllowed: false, localStorageAllowed: false, thumbnailCachingAllowed: false });
  }

  getSubjectProperty() { return null; }
  getSaleHistory() { return []; }
  async searchSoldComparables() { return []; }
  async searchActiveListings() { return []; }
  async getListingHistory() { return []; }
  async getPropertyMedia() { return []; }
  async getRentEstimate() { return null; }
  async getValuationEstimate() { return null; }
  async getProviderRecord() { return null; }
  async refreshProviderRecord() { return { ok: false, status: "Disabled" }; }
  async testConnection() {
    const status = this.getProviderStatus();
    return { ok: false, provider: "bridge", status: status.status, errorCode: status.errorCode || "disabled" };
  }
  getProviderStatus() {
    const configured = Boolean(this.config.bridgeBaseUrl || this.config.bridgeDatasetId || this.config.bridgeAccessToken);
    return { provider: "bridge", status: configured ? "Configured" : "Disabled", configured, keyPresent: Boolean(this.config.bridgeAccessToken), errorCode: configured ? null : "disabled" };
  }
}

class CountyImportAdapter {
  constructor(config = {}) {
    this.config = buildCompProviderConfig(config);
  }

  normalizeAddress(address = "") {
    return normalizeAddress(address);
  }

  getCapabilities() {
    return buildDefaultCapabilities({ propertyRecords: true, publicRecordSales: true, requiredAttribution: true, redistributionRestrictions: true, mediaRightsUnknown: true });
  }

  getLicenseCapabilities() {
    return buildDefaultLicenseCapabilities({ attributionRequired: true, redistributionRestricted: true, exportAllowed: false, localStorageAllowed: false, thumbnailCachingAllowed: false });
  }

  async buildImportPreview(records = []) {
    const rows = Array.isArray(records) ? records.map((record, index) => ({
      id: `county-${index + 1}`,
      address: normalizeText(record.address || ""),
      parcelId: normalizeText(record.parcelId || ""),
      salePrice: normalizeNumber(record.salePrice ?? 0),
      saleDate: normalizeText(record.saleDate || ""),
      sourceJurisdiction: normalizeText(record.sourceJurisdiction || "County"),
      sourceType: "county",
      requiresConfirmation: true,
      sourceFile: normalizeText(record.sourceFile || ""),
      importDate: normalizeText(record.importDate || new Date().toISOString()),
    })) : [];
    return { rows, duplicateFlags: [], warnings: [] };
  }

  async importRecords(records = []) {
    const preview = await this.buildImportPreview(records);
    return { preview, imported: preview.rows.length };
  }

  getSubjectProperty() { return null; }
  getSaleHistory() { return []; }
  async searchSoldComparables() { return []; }
  async searchActiveListings() { return []; }
  async getListingHistory() { return []; }
  async getPropertyMedia() { return []; }
  async getRentEstimate() { return null; }
  async getValuationEstimate() { return null; }
  async getProviderRecord() { return null; }
  async refreshProviderRecord() { return { ok: false, status: "Disabled" }; }
  async testConnection() {
    return { ok: true, provider: "county-import", status: "Ready", errorCode: null };
  }
  getProviderStatus() {
    return { provider: "county-import", status: "Configured", configured: true, keyPresent: false, errorCode: null };
  }
}

class GenericAuthorizedProviderAdapter {
  constructor(config = {}) {
    this.config = buildCompProviderConfig(config);
  }

  normalizeAddress(address = "") {
    return normalizeAddress(address);
  }

  getCapabilities() {
    return buildDefaultCapabilities({ propertyRecords: true, requiredAttribution: true, redistributionRestrictions: true, mediaRightsUnknown: true });
  }

  getLicenseCapabilities() {
    return buildDefaultLicenseCapabilities({ attributionRequired: true, redistributionRestricted: true, exportAllowed: false, localStorageAllowed: false, thumbnailCachingAllowed: false });
  }

  getSubjectProperty() { return null; }
  getSaleHistory() { return []; }
  async searchSoldComparables() { return []; }
  async searchActiveListings() { return []; }
  async getListingHistory() { return []; }
  async getPropertyMedia() { return []; }
  async getRentEstimate() { return null; }
  async getValuationEstimate() { return null; }
  async getProviderRecord() { return null; }
  async refreshProviderRecord() { return { ok: false, status: "Disabled" }; }
  async testConnection() {
    const status = this.getProviderStatus();
    return { ok: false, provider: this.config.provider || "generic", status: status.status, errorCode: status.errorCode || "disabled" };
  }
  getProviderStatus() {
    const provider = this.config.provider || "generic";
    const configured = provider !== "manual" && (
      (provider === "rentcast" && Boolean(this.config.rentcastApiKey)) ||
      (provider === "attom" && Boolean(this.config.attomApiKey || this.config.attomBaseUrl)) ||
      (provider === "reso-mls" && Boolean(this.config.resoAccessToken || this.config.resoDatasetId || this.config.resoClientId || this.config.resoBaseUrl)) ||
      (provider === "bridge" && Boolean(this.config.bridgeAccessToken || this.config.bridgeBaseUrl || this.config.bridgeDatasetId)) ||
      (provider === "county-import") ||
      false
    );
    return { provider, status: configured ? "Configured" : "Disabled", configured, keyPresent: false, errorCode: configured ? null : "disabled" };
  }
}

export {
  ManualCompAdapter,
  RentCastCompAdapter,
  AttomCompAdapter,
  ResoMlsCompAdapter,
  BridgeResoAdapter,
  CountyImportAdapter,
  GenericAuthorizedProviderAdapter,
  buildCompProviderConfig,
  buildNormalizedCompRecord,
  normalizeProviderMedia,
  scoreCompQuality,
  SOLD_COMP_SEARCH_TIERS,
};

export default {
  ManualCompAdapter,
  RentCastCompAdapter,
  AttomCompAdapter,
  ResoMlsCompAdapter,
  BridgeResoAdapter,
  CountyImportAdapter,
  GenericAuthorizedProviderAdapter,
  buildCompProviderConfig,
  buildNormalizedCompRecord,
  normalizeProviderMedia,
  scoreCompQuality,
  SOLD_COMP_SEARCH_TIERS,
};
