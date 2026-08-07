import { URL } from "node:url";

function createId(prefix = "comp") {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

function normalizeAddress(address = "") {
  return String(address || "").trim().toLowerCase().replace(/\s+/g, " ");
}

function normalizeNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : "";
}

function normalizeText(value) {
  return value === undefined || value === null ? "" : String(value).trim();
}

function buildCompProviderConfig(overrides = {}) {
  const env = overrides.env || {};
  return {
    rentcastApiKey: normalizeText(env.RENTCAST_API_KEY || overrides.rentcastApiKey || ""),
    rentcastBaseUrl: normalizeText(env.RENTCAST_BASE_URL || overrides.rentcastBaseUrl || "https://api.rentcast.io"),
    provider: normalizeText(env.COMP_PROVIDER || overrides.provider || "manual"),
    defaultRadius: normalizeNumber(env.COMP_SEARCH_DEFAULT_RADIUS || overrides.defaultRadius || 0.5),
    maxRadius: normalizeNumber(env.COMP_SEARCH_MAX_RADIUS || overrides.maxRadius || 1),
    defaultMonths: normalizeNumber(env.COMP_SEARCH_DEFAULT_MONTHS || overrides.defaultMonths || 6),
    maxResults: normalizeNumber(env.COMP_SEARCH_MAX_RESULTS || overrides.maxResults || 10),
    cacheTtl: normalizeNumber(env.COMP_CACHE_TTL || overrides.cacheTtl || 300000),
    requestTimeout: normalizeNumber(env.COMP_REQUEST_TIMEOUT || overrides.requestTimeout || 4000),
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

  return {
    id: rawRecord.id || createId("comp"),
    compId: rawRecord.compId || createId("comp"),
    subjectPropertyId: rawRecord.subjectPropertyId || subjectProperty.id || "",
    providerRecordId: rawRecord.providerRecordId || "",
    provider: normalizeText(rawRecord.provider || provider),
    sourceType: rawRecord.sourceType || (rawRecord.providerImported ? "provider" : rawRecord.manuallyEntered ? "manual" : "manual"),
    address: normalizeText(rawRecord.address || rawRecord.compAddress || rawRecord.propertyAddress),
    normalizedAddress: normalizeAddress(rawRecord.address || rawRecord.compAddress || rawRecord.propertyAddress),
    city: normalizeText(rawRecord.city || subjectProperty.city || ""),
    state: normalizeText(rawRecord.state || subjectProperty.state || ""),
    zip: normalizeText(rawRecord.zipCode || rawRecord.zip || subjectProperty.zipCode || ""),
    latitude: normalizeNumber(rawRecord.latitude ?? ""),
    longitude: normalizeNumber(rawRecord.longitude ?? ""),
    propertyType: normalizeText(rawRecord.propertyType || subjectProperty.propertyType || "Single Family"),
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
    if (!this.config.rentcastApiKey) {
      return { ok: false, provider: "rentcast", status: "Provider Not Configured" };
    }
    return { ok: false, provider: "rentcast", status: "Connection Failed" };
  }

  getProviderStatus() {
    if (!this.config.rentcastApiKey) {
      return { provider: "rentcast", status: "Provider Not Configured", configured: false, keyPresent: false };
    }
    return { provider: "rentcast", status: "Configured", configured: true, keyPresent: true };
  }
}

class AttomCompAdapter {
  constructor(config = {}) {
    this.config = buildCompProviderConfig(config);
  }

  normalizeAddress(address = "") {
    return normalizeAddress(address);
  }

  getSubjectProperty() { return null; }
  getSaleHistory() { return []; }
  async searchSoldComparables() { return []; }
  async searchActiveListings() { return []; }
  async getRentEstimate() { return null; }
  async testConnection() { return { ok: false, provider: "attom", status: "Not Implemented" }; }
  getProviderStatus() { return { provider: "attom", status: "Placeholder", configured: false, keyPresent: false }; }
}

class ResoMlsCompAdapter {
  constructor(config = {}) {
    this.config = buildCompProviderConfig(config);
  }

  normalizeAddress(address = "") {
    return normalizeAddress(address);
  }

  getSubjectProperty() { return null; }
  getSaleHistory() { return []; }
  async searchSoldComparables() { return []; }
  async searchActiveListings() { return []; }
  async getRentEstimate() { return null; }
  async testConnection() { return { ok: false, provider: "reso-mls", status: "Not Implemented" }; }
  getProviderStatus() { return { provider: "reso-mls", status: "Placeholder", configured: false, keyPresent: false }; }
}

export {
  ManualCompAdapter,
  RentCastCompAdapter,
  AttomCompAdapter,
  ResoMlsCompAdapter,
  buildCompProviderConfig,
  buildNormalizedCompRecord,
  scoreCompQuality,
};

export default {
  ManualCompAdapter,
  RentCastCompAdapter,
  AttomCompAdapter,
  ResoMlsCompAdapter,
  buildCompProviderConfig,
  buildNormalizedCompRecord,
  scoreCompQuality,
};
