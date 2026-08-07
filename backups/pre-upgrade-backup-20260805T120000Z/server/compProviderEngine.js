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
  const fetchImpl = overrides.fetchImpl || globalThis.fetch;
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
      const payload = text ? JSON.parse(text) : {};
      if (!response.ok) {
        const errorCode = payload?.error || payload?.status || "provider_failure";
        if (response.status === 401) {
          return { ok: false, errorCode: "unauthorized", status: "Unauthorized", payload };
        }
        if (response.status === 429) {
          return { ok: false, errorCode: "rate_limited", status: "Rate Limited", payload };
        }
        if (response.status >= 400 && response.status < 500) {
          return { ok: false, errorCode: "invalid_request", status: "Invalid Request", payload };
        }
        return { ok: false, errorCode: "provider_failure", status: "Temporary Provider Failure", payload };
      }
      return { ok: true, payload };
    } catch (error) {
      if (error?.name === "AbortError") {
        return { ok: false, errorCode: "timeout", status: "Timeout" };
      }
      return { ok: false, errorCode: "provider_failure", status: "Temporary Provider Failure" };
    }
  }

  async testConnection() {
    if (!this.config.rentcastApiKey) {
      return { ok: false, provider: "rentcast", status: "Provider Not Configured", errorCode: "not_configured" };
    }
    const result = await this._fetchJson("/v1/properties/subject", { method: "GET" });
    if (!result.ok) {
      return {
        ok: false,
        provider: "rentcast",
        status: result.status,
        errorCode: result.errorCode,
      };
    }
    return { ok: true, provider: "rentcast", status: "Connected", errorCode: null };
  }

  async getSubjectProperty(address = "") {
    if (!address) return { ok: false, errorCode: "invalid_request", status: "Invalid Request" };
    const normalizedAddress = this.normalizeAddress(address);
    if (!normalizedAddress) return { ok: false, errorCode: "invalid_request", status: "Invalid Request" };
    const result = await this._fetchJson(`/v1/properties/subject?address=${encodeURIComponent(normalizedAddress)}`);
    if (!result.ok) return { ok: false, errorCode: result.errorCode, status: result.status };
    const payload = Array.isArray(result.payload?.properties) ? result.payload.properties[0] : result.payload;
    if (!payload?.address) {
      return { ok: false, errorCode: "no_results", status: "No Results" };
    }
    return {
      ok: true,
      status: "Success",
      property: {
        provider: "rentcast",
        providerRecordId: payload.id || payload.propertyId || "",
        address: payload.address || "",
        city: payload.city || "",
        state: payload.state || "",
        zip: payload.zip || payload.zipCode || "",
        propertyType: payload.propertyType || "Single Family",
        bedrooms: normalizeNumber(payload.bedrooms ?? payload.bedroomCount ?? 0),
        bathrooms: normalizeNumber(payload.bathrooms ?? payload.bathroomCount ?? 0),
        squareFeet: normalizeNumber(payload.squareFeet ?? payload.livingArea ?? 0),
        lotSize: normalizeNumber(payload.lotSize ?? payload.lotSizeSqFt ?? 0),
        yearBuilt: normalizeNumber(payload.yearBuilt ?? 0),
        latitude: normalizeNumber(payload.latitude ?? 0),
        longitude: normalizeNumber(payload.longitude ?? 0),
        sourceSnapshot: payload,
      },
    };
  }

  async searchSoldComparables(options = {}) {
    const address = options.address || options.subjectAddress || "";
    const normalizedAddress = this.normalizeAddress(address);
    if (!normalizedAddress) return [];
    const result = await this._fetchJson(`/v1/properties/sold?address=${encodeURIComponent(normalizedAddress)}&radius=${options.radiusMiles ?? this.config.defaultRadius ?? 0.5}&months=${options.months ?? this.config.defaultMonths ?? 6}`);
    if (!result.ok) return [];
    const properties = Array.isArray(result.payload?.properties) ? result.payload.properties : Array.isArray(result.payload) ? result.payload : [];
    return properties
      .filter((property) => property?.address && (property.status || "").toLowerCase() !== "active" && (property.status || "").toLowerCase() !== "pending")
      .map((property) => {
        const normalized = buildNormalizedCompRecord({
          id: `rentcast-${property.id || createId("comp")}`,
          compId: property.id || createId("comp"),
          providerRecordId: property.id || property.propertyId || "",
          address: property.address || "",
          city: property.city || "",
          state: property.state || "",
          zipCode: property.zip || property.zipCode || "",
          propertyType: property.propertyType || "Single Family",
          bedrooms: normalizeNumber(property.bedrooms ?? 0),
          bathrooms: normalizeNumber(property.bathrooms ?? 0),
          squareFeet: normalizeNumber(property.squareFeet ?? 0),
          yearBuilt: normalizeNumber(property.yearBuilt ?? 0),
          salePrice: normalizeNumber(property.salePrice ?? property.price ?? 0),
          saleDate: property.saleDate || property.dateSold || property.soldDate || "",
          latitude: normalizeNumber(property.latitude ?? 0),
          longitude: normalizeNumber(property.longitude ?? 0),
          distanceMiles: normalizeNumber(property.distance ?? 0),
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
  }

  async searchActiveListings(options = {}) {
    const address = options.address || options.subjectAddress || "";
    const normalizedAddress = this.normalizeAddress(address);
    if (!normalizedAddress) return [];
    const result = await this._fetchJson(`/v1/properties/active?address=${encodeURIComponent(normalizedAddress)}&radius=${options.radiusMiles ?? this.config.defaultRadius ?? 0.5}`);
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
    const result = await this._fetchJson(`/v1/properties/rent?address=${encodeURIComponent(this.normalizeAddress(address))}`);
    if (!result.ok) return null;
    return result.payload;
  }

  getProviderStatus() {
    if (!this.config.rentcastApiKey) {
      return { provider: "rentcast", status: "Provider Not Configured", configured: false, keyPresent: false, errorCode: "not_configured" };
    }
    return { provider: "rentcast", status: "Configured", configured: true, keyPresent: true, errorCode: null };
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
