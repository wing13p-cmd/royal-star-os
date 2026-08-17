import { MediaRightsPolicyService } from "./mediaRightsPolicyService.js";

const FACT_FIELDS = ["salePrice", "saleDate", "squareFeet", "bedrooms", "bathrooms", "yearBuilt", "lotSize", "propertyType"];
const DISTRESS_TERMS = /foreclos|sheriff|reo|bank owned|short sale|auction|quitclaim|tax sale|distress/i;
const RENOVATION_TERMS = /renovat|remodel|updated|new (roof|kitchen|bath|hvac)|rehab|permit/i;

function text(value) { return value === undefined || value === null ? "" : String(value).trim(); }
function number(value) { const parsed = Number(value); return Number.isFinite(parsed) ? parsed : null; }
function array(value) { return Array.isArray(value) ? value : []; }
function known(value) { return value !== null && value !== undefined && value !== "" && value !== "UNKNOWN"; }
function nowIso() { return new Date().toISOString(); }

function comparableValue(field, value) {
  if (["salePrice", "squareFeet", "bedrooms", "bathrooms", "yearBuilt", "lotSize"].includes(field)) return number(value);
  return text(value).toLowerCase();
}

function conflicts(field, left, right) {
  const a = comparableValue(field, left);
  const b = comparableValue(field, right);
  if (a === null || b === null || a === "" || b === "") return false;
  if (typeof a === "number" && typeof b === "number") {
    if (["bedrooms", "bathrooms", "yearBuilt"].includes(field)) return Math.abs(a - b) > (field === "yearBuilt" ? 1 : 0);
    return Math.abs(a - b) / Math.max(Math.abs(a), Math.abs(b), 1) > 0.05;
  }
  return a !== b;
}

function sourceRecord(source, field, value, retrievedAt, confidence = "medium", reference = "") {
  return { source, field, value, retrievedAt, confidence, reference };
}

function settledRecords(result) {
  return result?.status === "fulfilled" ? array(result.value?.records) : [];
}

export function buildCompEvidenceReport({ comp = {}, subject = {}, sources = {}, mediaPolicy = new MediaRightsPolicyService(), retrievedAt = nowIso() } = {}) {
  const countyProperty = array(sources.countyProperty)[0] || {};
  const countyRecorder = array(sources.countyRecorder)[0] || {};
  const permits = array(sources.permits);
  const location = array(sources.location)[0] || {};
  const rawMedia = [...array(comp.media), ...array(sources.media)];
  const provenance = [];

  FACT_FIELDS.forEach((field) => {
    if (known(comp[field])) provenance.push(sourceRecord(text(comp.provider || "candidate"), field, comp[field], retrievedAt, "medium", comp.sourceLink || ""));
  });
  const publicFactMap = {
    squareFeet: countyProperty.buildingSize,
    yearBuilt: countyProperty.yearBuilt,
    lotSize: countyProperty.lotSize,
  };
  Object.entries(publicFactMap).forEach(([field, value]) => {
    if (known(value)) provenance.push(sourceRecord("county-assessor", field, value, retrievedAt, "high"));
  });
  array(countyProperty.saleHistory).forEach((sale, index) => {
    if (known(sale.salePrice)) provenance.push(sourceRecord("county-assessor", "salePrice", sale.salePrice, retrievedAt, "high", `sale-history-${index + 1}`));
    if (known(sale.saleDate)) provenance.push(sourceRecord("county-assessor", "saleDate", sale.saleDate, retrievedAt, "high", `sale-history-${index + 1}`));
  });

  const discrepancies = [];
  FACT_FIELDS.forEach((field) => {
    const values = provenance.filter((entry) => entry.field === field);
    for (let i = 0; i < values.length; i += 1) {
      for (let j = i + 1; j < values.length; j += 1) {
        if (values[i].source !== values[j].source && conflicts(field, values[i].value, values[j].value)) {
          discrepancies.push({ field, severity: ["salePrice", "saleDate", "propertyType"].includes(field) ? "blocking" : "review", sources: [values[i], values[j]], resolutionStatus: "UNRESOLVED_REVIEW_REQUIRED" });
        }
      }
    }
  });

  const deedText = array(countyRecorder.recordedDeeds).map((entry) => `${entry.deedType || ""} ${entry.documentReference || ""}`).join(" ");
  const narrative = `${comp.notes || ""} ${comp.listingDescription || ""} ${deedText}`;
  const distressFlags = [];
  if (DISTRESS_TERMS.test(narrative)) distressFlags.push("POSSIBLE_DISTRESSED_TRANSFER");
  if (comp.salePrice && comp.listPrice && number(comp.salePrice) < number(comp.listPrice) * 0.7) distressFlags.push("SALE_PRICE_MATERIALLY_BELOW_LIST");
  const armLength = distressFlags.length ? "QUESTIONABLE" : (array(countyRecorder.recordedDeeds).length || array(countyProperty.saleHistory).length ? "NO_DISTRESS_SIGNAL_FOUND" : "UNKNOWN");
  const conditionEvidence = [
    ...(RENOVATION_TERMS.test(narrative) ? [{ type: "listing-text", finding: "Renovation language detected", source: comp.provider || "candidate", retrievedAt }] : []),
    ...permits.map((permit) => ({ type: "permit", finding: text(permit.permitType || "Permit record"), status: text(permit.openOrClosed || permit.inspectionStatus || "UNKNOWN"), source: "permit-records", retrievedAt, reference: text(permit.permitNumber) })),
  ];

  const media = rawMedia.map((item) => mediaPolicy.buildCanonicalMediaRecord({
    ...item,
    provider: item.provider || item.sourceProvider || comp.provider || "manual",
    url: item.url || item.imageryReference || item.sourceUrl || item.referenceUrl || "",
    source: item.source || item.sourceProvider || comp.provider || "",
    sourceType: item.mediaType || item.sourceType || "provider-reference",
    localStorageAllowed: item.localStorageAllowed === true && item.imageStored === true,
  })).filter((item) => item.url);

  const listingHistory = array(comp.listingHistory).map((entry) => ({ ...entry, source: entry.source || comp.provider || "candidate", retrievedAt: entry.retrievedAt || retrievedAt }));
  const transferHistory = [
    ...array(countyProperty.saleHistory).map((entry) => ({ ...entry, source: "county-assessor", retrievedAt })),
    ...array(countyRecorder.recordedDeeds).map((entry) => ({ ...entry, source: "county-recorder", retrievedAt })),
  ];
  const taxHistory = array(countyProperty.taxHistory || countyProperty.assessmentHistory).map((entry) => ({ ...entry, source: "county-assessor", retrievedAt }));
  const coverage = {
    closedSale: Boolean(comp.salePrice && comp.saleDate),
    publicFacts: Object.values(publicFactMap).some(known),
    transferHistory: transferHistory.length > 0,
    taxHistory: taxHistory.length > 0 || known(countyProperty.taxAssessment),
    listingHistory: listingHistory.length > 0,
    condition: conditionEvidence.length > 0,
    media: media.length > 0,
    location: known(location.geocodedAddress) || known(comp.distanceMiles),
  };
  let score = 0;
  score += coverage.closedSale ? 20 : 0;
  score += coverage.publicFacts ? 15 : 0;
  score += coverage.transferHistory ? 15 : 0;
  score += coverage.taxHistory ? 10 : 0;
  score += coverage.listingHistory ? 10 : 0;
  score += coverage.condition ? 10 : 0;
  score += coverage.media ? 10 : 0;
  score += coverage.location ? 10 : 0;
  score -= discrepancies.filter((entry) => entry.severity === "blocking").length * 15;
  score -= discrepancies.filter((entry) => entry.severity === "review").length * 5;
  score -= distressFlags.length * 15;
  score = Math.max(0, Math.min(100, score));

  const blockingReasons = [];
  if (!coverage.closedSale) blockingReasons.push("Closed-sale price and date are required");
  if (discrepancies.some((entry) => entry.severity === "blocking")) blockingReasons.push("Material cross-source discrepancies require resolution");
  if (distressFlags.length) blockingReasons.push("Possible distressed or non-arm's-length transfer requires review");
  const recommendation = blockingReasons.length ? (coverage.closedSale ? "NEEDS_REVIEW" : "REJECT") : score >= 80 ? "APPROVE" : "NEEDS_REVIEW";

  return {
    schemaVersion: "rsos-comp-evidence-v1",
    compId: comp.id || comp.compId || comp.providerRecordId || "",
    generatedAt: retrievedAt,
    cached: false,
    advisoryOnly: true,
    reviewRequired: true,
    autoApproved: false,
    verifiedCompScore: score,
    recommendation,
    recommendationReasons: blockingReasons.length ? blockingReasons : [score >= 80 ? "Evidence coverage meets the verification threshold" : "Additional evidence is needed before approval"],
    coverage,
    publicRecordFacts: { parcelNumber: countyProperty.parcelNumber || "", legalDescription: countyProperty.legalDescription || "", taxAssessment: countyProperty.taxAssessment ?? "", landValue: countyProperty.landValue ?? "", improvementValue: countyProperty.improvementValue ?? "", ...publicFactMap },
    transferHistory,
    taxHistory,
    listingHistory,
    conditionEvidence,
    armLengthAssessment: { status: armLength, distressFlags, evidenceReviewed: transferHistory.length },
    discrepancies,
    provenance,
    media,
    rightsSummary: { displayableReferences: media.length, locallyStored: media.filter((item) => item.localStorageAllowed).length, restrictedOrReviewRequired: media.filter((item) => item.requiresReview || item.isRestricted).length },
  };
}

export function createCompEvidenceEngine({ providerAdapters = {}, cacheTtlMs = 604800000, mediaPolicy } = {}) {
  const cache = new Map();
  return {
    async verify(comp = {}, subject = {}, options = {}) {
      const key = `${text(comp.provider)}:${text(comp.providerRecordId || comp.id || comp.compAddress).toLowerCase()}`;
      const cached = cache.get(key);
      if (!options.forceRefresh && cached && Date.now() < cached.expiresAt) return { ...cached.report, cached: true };
      const query = { address: comp.compAddress || comp.address || "", city: comp.city || "", state: comp.state || "", zipCode: comp.zipCode || comp.zip || "", parcelNumber: comp.parcelNumber || "" };
      const [property, recorder, permits, location, media] = await Promise.allSettled([
        providerAdapters.countyProperty?.searchProperty?.(query),
        providerAdapters.countyRecorder?.searchOwner?.(query),
        providerAdapters.permit?.searchPermits?.(query),
        providerAdapters.googleMaps?.searchProperty?.(query),
        providerAdapters.googleMaps?.searchMedia?.(query),
      ]);
      const report = buildCompEvidenceReport({ comp, subject, mediaPolicy, sources: { countyProperty: settledRecords(property), countyRecorder: settledRecords(recorder), permits: settledRecords(permits), location: settledRecords(location), media: settledRecords(media) } });
      cache.set(key, { expiresAt: Date.now() + cacheTtlMs, report });
      return report;
    },
    clearCache() { cache.clear(); },
    cacheSummary() { return { entries: cache.size, ttlMs: cacheTtlMs }; },
  };
}

export default createCompEvidenceEngine;
