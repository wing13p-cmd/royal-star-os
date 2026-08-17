import { normalizeCanonicalProperty } from "./propertyAutomationEngine.js";

export const APPRAISAL_THRESHOLDS = Object.freeze({
  strongDistanceMiles: 0.5,
  reviewDistanceMiles: 1,
  strongRecencyDays: 90,
  reviewRecencyDays: 180,
  cautionRecencyDays: 365,
  strongSizeVariance: 0.15,
  reviewSizeVariance: 0.25,
  strongCompScore: 80,
  usableCompScore: 50,
  supportedArvReviewVariance: 0.1,
  supportedArvHighRiskVariance: 0.2,
});

const DAY_MS = 86400000;
const own = (value, key) => Object.prototype.hasOwnProperty.call(value || {}, key);
const array = (value) => Array.isArray(value) ? value : [];
const number = (value) => {
  if (value === null || value === undefined || (typeof value === "string" && value.trim() === "")) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};
const text = (value) => value === null || value === undefined ? "" : String(value).trim();
const clamp = (value, min = 0, max = 100) => Math.min(max, Math.max(min, value));

function normalizePropertyType(value) {
  const key = text(value).toLowerCase().replace(/[^a-z0-9]/g, "");
  if (["singlefamily", "singlefamilyhome", "sfh", "1family"].includes(key)) return "single-family";
  if (["duplex", "2family", "twofamily"].includes(key)) return "duplex";
  if (["triplex", "3family", "threefamily"].includes(key)) return "triplex";
  if (["fourplex", "4plex", "4family", "fourfamily"].includes(key)) return "fourplex";
  return key;
}

function compLinkMatches(property, comp) {
  const compDealId = text(comp.dealId || comp.linkedDealId);
  const compPropertyId = text(comp.propertyId || comp.linkedPropertyId);
  if (compDealId && property.dealId && compDealId !== text(property.dealId)) return false;
  if (compPropertyId && property.propertyId && compPropertyId !== text(property.propertyId)) return false;
  return true;
}

export function evaluateAppraisalComp(subjectRecord = {}, compRecord = {}, options = {}) {
  const subject = normalizeCanonicalProperty(subjectRecord);
  const now = options.now ? new Date(options.now) : new Date();
  const salePrice = number(compRecord.salePrice ?? compRecord.adjustedSalePrice);
  const squareFeet = number(compRecord.squareFeet ?? compRecord.sqft);
  const saleDate = text(compRecord.saleDate ?? compRecord.closedDate);
  const distanceMiles = number(compRecord.distanceMiles ?? compRecord.distance);
  const subjectSize = number(subject.squareFeet);
  const ageDays = saleDate && !Number.isNaN(Date.parse(saleDate)) ? Math.max(0, (now.getTime() - Date.parse(saleDate)) / DAY_MS) : null;
  const sizeVariance = subjectSize && squareFeet ? Math.abs(squareFeet - subjectSize) / subjectSize : null;
  const propertyTypeMatch = !subject.propertyType || !compRecord.propertyType
    ? null
    : normalizePropertyType(subject.propertyType) === normalizePropertyType(compRecord.propertyType);
  const reasons = [];
  const strengths = [];
  let score = 100;

  if (!salePrice || !squareFeet || !saleDate) reasons.push("Incomplete sale price, sale date, or square footage.");
  if (!salePrice || !squareFeet || !saleDate) score -= 55;
  if (distanceMiles === null) { score -= 8; reasons.push("Distance is unavailable."); }
  else if (distanceMiles <= APPRAISAL_THRESHOLDS.strongDistanceMiles) strengths.push("Within 0.5 mile of the subject.");
  else if (distanceMiles <= APPRAISAL_THRESHOLDS.reviewDistanceMiles) { score -= 8; reasons.push("Between 0.5 and 1.0 mile from the subject."); }
  else { score -= distanceMiles > 3 ? 28 : 18; reasons.push("More than 1.0 mile from the subject."); }

  if (ageDays === null) { score -= 10; reasons.push("Sale recency cannot be verified."); }
  else if (ageDays <= APPRAISAL_THRESHOLDS.strongRecencyDays) strengths.push("Sold within 90 days.");
  else if (ageDays <= APPRAISAL_THRESHOLDS.reviewRecencyDays) { score -= 7; reasons.push("Sale is 91–180 days old."); }
  else if (ageDays <= APPRAISAL_THRESHOLDS.cautionRecencyDays) { score -= 18; reasons.push("Sale is 181–365 days old."); }
  else { score -= 32; reasons.push("Sale is more than 365 days old."); }

  if (sizeVariance === null) { score -= 8; reasons.push("Square-footage similarity cannot be measured."); }
  else if (sizeVariance <= APPRAISAL_THRESHOLDS.strongSizeVariance) strengths.push("Square footage is within 15% of the subject.");
  else if (sizeVariance <= APPRAISAL_THRESHOLDS.reviewSizeVariance) { score -= 10; reasons.push("Square footage differs by 15–25%."); }
  else { score -= 24; reasons.push("Square footage differs by more than 25%."); }

  if (propertyTypeMatch === true) strengths.push("Property type matches the subject.");
  else if (propertyTypeMatch === false) { score -= 30; reasons.push("Property type does not match the subject."); }
  else { score -= 5; reasons.push("Property-type match cannot be verified."); }

  const bedroomDelta = number(subject.bedrooms) !== null && number(compRecord.bedrooms) !== null ? Math.abs(number(subject.bedrooms) - number(compRecord.bedrooms)) : null;
  const bathroomDelta = number(subject.bathrooms) !== null && number(compRecord.bathrooms) !== null ? Math.abs(number(subject.bathrooms) - number(compRecord.bathrooms)) : null;
  if (bedroomDelta !== null && bedroomDelta > 1) { score -= 8; reasons.push("Bedroom count differs materially."); }
  if (bathroomDelta !== null && bathroomDelta > 1) { score -= 8; reasons.push("Bathroom count differs materially."); }
  if (compRecord.verified === false) { score -= 8; reasons.push("Sale is not verified."); }
  if (!compLinkMatches(subject, compRecord)) { score = 0; reasons.push("Comp is linked to a different property."); }
  if (compRecord.included === false || compRecord.verified === false || ["pending", "excluded", "rejected"].includes(text(compRecord.inclusionStatus).toLowerCase())) {
    score = 0;
    reasons.push("Comp was excluded from valuation review.");
  }

  const searchTier = number(compRecord.searchTier);
  if (searchTier !== null && searchTier > 1) {
    const tierCaps = { 2: 75, 3: 65, 4: 55 };
    score = Math.min(score, tierCaps[Math.min(4, Math.round(searchTier))] || 55);
    reasons.push(`${compRecord.searchTierLabel || `Expanded search Tier ${searchTier}`} carries weaker appraisal evidence quality.`);
  }

  score = Math.round(clamp(score));
  const usable = score >= APPRAISAL_THRESHOLDS.usableCompScore && Boolean(salePrice && squareFeet && saleDate);
  return {
    ...compRecord,
    id: compRecord.id || compRecord.compId || null,
    compId: compRecord.compId || compRecord.id || null,
    photoReferences: array(compRecord.photoReferences || compRecord.photos || compRecord.images),
    source: compRecord.source || compRecord.provider || "",
    verificationStatus: compRecord.verificationStatus || (compRecord.verified === true ? "VERIFIED" : "UNKNOWN"),
    salePrice, squareFeet, saleDate, distanceMiles, ageDays, sizeVariance, propertyTypeMatch,
    qualityScore: score,
    quality: score >= APPRAISAL_THRESHOLDS.strongCompScore ? "STRONG" : usable ? "USABLE" : "WEAK",
    usable,
    reasons,
    strengths,
  };
}

function valuationFromComps(subject, usableComps) {
  const subjectSize = number(subject.squareFeet);
  if (!subjectSize || usableComps.length < 2) return { supportedArv: null, lowSupportedArv: null, highSupportedArv: null };
  const indications = usableComps.map((comp) => ({
    value: (comp.salePrice / comp.squareFeet) * subjectSize,
    weight: Math.max(0.1, comp.qualityScore / 100),
  })).filter((entry) => Number.isFinite(entry.value) && entry.value > 0);
  if (indications.length < 2) return { supportedArv: null, lowSupportedArv: null, highSupportedArv: null };
  const totalWeight = indications.reduce((sum, entry) => sum + entry.weight, 0);
  const supportedArv = Math.round(indications.reduce((sum, entry) => sum + entry.value * entry.weight, 0) / totalWeight);
  const sorted = indications.map((entry) => Math.round(entry.value)).sort((a, b) => a - b);
  return { supportedArv, lowSupportedArv: sorted[0], highSupportedArv: sorted[sorted.length - 1] };
}

function readExistingValuation(valuation = {}) {
  const status = String(valuation.valuationReviewStatus || valuation.appraisalStatus || valuation.status || "").trim().toUpperCase();
  const approved = status === "APPROVED" || status === "READY";
  return {
    supportedArv: number(valuation.approvedArv ?? (approved ? valuation.supportedArv : null)),
    lowSupportedArv: number(approved ? (valuation.lowSupportedArv ?? valuation.conservativeArv ?? valuation.lowArv) : null),
    highSupportedArv: number(approved ? (valuation.highSupportedArv ?? valuation.aggressiveArv ?? valuation.highArv) : null),
  };
}

export function buildAppraiserPacketEvidence(appraisal = {}) {
  return {
    dealId: appraisal.dealId || null,
    propertyId: appraisal.propertyId || null,
    requestedARV: appraisal.subjectArv || null,
    supportedARV: appraisal.supportedArv || null,
    confidenceLevel: appraisal.appraisalConfidence || "LOW",
    appraisalStatus: appraisal.appraisalStatus || "NOT_READY",
    appraisalPacketReady: appraisal.appraisalPacketReady === true,
    compSelectionSummary: appraisal.usableCompCount
      ? `${appraisal.usableCompCount} usable comparable sales; ${appraisal.strongCompCount} strong.`
      : "No usable comparable sales are currently linked.",
    comps: array(appraisal.recommendedComps).map((comp) => ({ ...comp })),
    valuationNotes: [...array(appraisal.strengths), ...array(appraisal.warnings)],
  };
}

export function buildAppraisalIntelligenceResult(subjectRecord = {}, comps = [], options = {}) {
  const subject = normalizeCanonicalProperty(subjectRecord);
  const subjectArv = number(subject.arv);
  const missingCriticalData = [];
  if (!subject.id) missingCriticalData.push("propertyId/dealId");
  if (!subject.address || !subject.city || !subject.state || !subject.zip) missingCriticalData.push("subject address");
  if (!subject.propertyType) missingCriticalData.push("property type");
  if (!number(subject.squareFeet) || !number(subject.yearBuilt)) missingCriticalData.push("subject characteristics");
  if (!subjectArv || subjectArv <= 0) missingCriticalData.push("subject ARV");

  const evaluatedComps = array(comps).map((comp) => evaluateAppraisalComp(subject, comp, options));
  const usableComps = evaluatedComps.filter((comp) => comp.usable);
  const strongComps = usableComps.filter((comp) => comp.quality === "STRONG");
  const weakComps = evaluatedComps.filter((comp) => !comp.usable);
  const existing = readExistingValuation(options.valuationResult || subject.valuation || {});
  const calculated = valuationFromComps(subject, usableComps);
  const supportedArv = existing.supportedArv ?? calculated.supportedArv;
  const lowSupportedArv = existing.lowSupportedArv ?? calculated.lowSupportedArv;
  const highSupportedArv = existing.highSupportedArv ?? calculated.highSupportedArv;
  const arvVariance = subjectArv !== null && supportedArv !== null ? subjectArv - supportedArv : null;
  const arvVariancePercentage = supportedArv && arvVariance !== null ? arvVariance / supportedArv : null;
  const compQualityScore = usableComps.length ? Math.round(usableComps.reduce((sum, comp) => sum + comp.qualityScore, 0) / usableComps.length) : 0;
  const warnings = [];
  const strengths = [];

  if (!evaluatedComps.length) warnings.push("No comps available; the target ARV has insufficient valuation evidence.");
  else if (usableComps.length < 3) warnings.push(`Only ${usableComps.length} usable comparable sale${usableComps.length === 1 ? "" : "s"} supports the valuation.`);
  if (weakComps.some((comp) => comp.ageDays !== null && comp.ageDays > APPRAISAL_THRESHOLDS.cautionRecencyDays)) warnings.push("One or more comps are more than 365 days old.");
  if (weakComps.some((comp) => comp.distanceMiles !== null && comp.distanceMiles > APPRAISAL_THRESHOLDS.reviewDistanceMiles)) warnings.push("One or more comps are more than 1.0 mile from the subject.");
  if (evaluatedComps.some((comp) => comp.propertyTypeMatch === false)) warnings.push("One or more comps have a property-type mismatch.");
  if (evaluatedComps.some((comp) => number(comp.searchTier) > 1)) warnings.push("Expanded-tier comps reduce appraisal evidence confidence and require additional review.");
  if (arvVariancePercentage !== null && arvVariancePercentage > APPRAISAL_THRESHOLDS.supportedArvReviewVariance) {
    warnings.push(`Target ARV is ${(arvVariancePercentage * 100).toFixed(1)}% above the comp-supported valuation.`);
  }
  if (strongComps.length >= 3) strengths.push(`${strongComps.length} strong comparable sales support the valuation.`);
  if (strongComps.some((comp) => comp.distanceMiles !== null && comp.distanceMiles <= 0.5)) strengths.push("Strong nearby comparable evidence is available within 0.5 mile.");
  if (supportedArv !== null && arvVariancePercentage !== null && Math.abs(arvVariancePercentage) <= 0.1) strengths.push("Target ARV is within 10% of comp-supported valuation.");

  let appraisalStatus = "REVIEW";
  if (missingCriticalData.length || usableComps.length < 2 || supportedArv === null) appraisalStatus = "NOT_READY";
  else if (usableComps.length >= 3 && strongComps.length >= 2 && (arvVariancePercentage === null || arvVariancePercentage <= 0.1)) appraisalStatus = "READY";

  let appraisalConfidence = "LOW";
  if (usableComps.length >= 3 && strongComps.length >= 2 && compQualityScore >= 78) appraisalConfidence = "HIGH";
  else if (usableComps.length >= 2 && compQualityScore >= 60) appraisalConfidence = "MEDIUM";
  if (appraisalStatus === "NOT_READY") appraisalConfidence = "LOW";

  let appraisalRiskScore = 100 - compQualityScore;
  if (usableComps.length < 3) appraisalRiskScore += 20;
  if (missingCriticalData.length) appraisalRiskScore += 25;
  if (arvVariancePercentage !== null && arvVariancePercentage > 0.1) appraisalRiskScore += Math.min(30, Math.round(arvVariancePercentage * 100));
  if (arvVariancePercentage !== null && arvVariancePercentage > APPRAISAL_THRESHOLDS.supportedArvHighRiskVariance) appraisalRiskScore = Math.max(70, appraisalRiskScore);
  else if (arvVariancePercentage !== null && arvVariancePercentage > APPRAISAL_THRESHOLDS.supportedArvReviewVariance) appraisalRiskScore = Math.max(35, appraisalRiskScore);
  appraisalRiskScore = Math.round(clamp(appraisalRiskScore));
  const appraisalRiskLevel = appraisalRiskScore >= 70 ? "HIGH" : appraisalRiskScore >= 35 ? "MEDIUM" : "LOW";
  const packetReady = missingCriticalData.length === 0 && usableComps.length >= 3 && supportedArv !== null;
  const refinanceAppraisalReady = subject.strategy === "BRRRR" && appraisalStatus === "READY" && packetReady;
  const recommendedNextAction = appraisalStatus === "READY"
    ? (subject.strategy === "BRRRR" ? "Prepare appraisal packet and refinance review" : "Prepare appraisal packet and valuation review")
    : !evaluatedComps.length ? "Link verified comparable sales from the Comp Database" : "Review weak comps and strengthen ARV support";

  const result = {
    dealId: subject.dealId || subject.id || null,
    propertyId: subject.propertyId || subject.id || null,
    appraisalStatus,
    appraisalConfidence,
    supportedArv,
    lowSupportedArv,
    highSupportedArv,
    subjectArv,
    arvVariance,
    arvVariancePercentage,
    compCount: evaluatedComps.length,
    usableCompCount: usableComps.length,
    strongCompCount: strongComps.length,
    weakCompCount: weakComps.length,
    compQualityScore,
    appraisalRiskScore,
    appraisalRiskLevel,
    missingCriticalData,
    warnings,
    strengths,
    recommendedNextAction,
    appraisalPacketReady: packetReady,
    refinanceAppraisalReady,
    recommendedComps: usableComps.map((comp) => ({ ...comp })),
    excludedComps: weakComps.map((comp) => ({ ...comp })),
    evidenceStatus: evaluatedComps.length ? (usableComps.length ? "COMP_EVIDENCE_AVAILABLE" : "NO_USABLE_COMPS") : "NO_COMPS_AVAILABLE",
    methodology: existing.supportedArv !== null ? "EXISTING_RSOS_VALUATION" : supportedArv !== null ? "QUALITY_WEIGHTED_PPSF" : "INSUFFICIENT_EVIDENCE",
  };

  // Compatibility aliases for existing Deal Intelligence consumers.
  result.appraisalSupportScore = appraisalStatus === "READY" ? Math.max(0, 100 - appraisalRiskScore) : 0;
  result.riskLevel = appraisalRiskLevel === "HIGH" ? "Critical Risk" : appraisalRiskLevel === "MEDIUM" ? "Moderate Risk" : "Low Risk";
  result.likelyAppraisalRisk = result.riskLevel;
  result.weightedArv = supportedArv;
  result.lowArv = lowSupportedArv;
  result.highArv = highSupportedArv;
  result.supportedArvRange = [result.lowArv, result.weightedArv, result.highArv];
  result.indicatedArvRange = [...result.supportedArvRange];
  result.missingSupport = warnings.length ? [...warnings] : ["No major support gaps identified"];
  result.appraiserQuestions = warnings.map((warning) => `Resolve: ${warning}`);
  result.recommendedPacketActions = [recommendedNextAction];
  result.calculationSummary = supportedArv === null ? "Insufficient valuation evidence; no supported ARV was produced." : `Supported ARV uses ${result.methodology === "EXISTING_RSOS_VALUATION" ? "the existing RSOS valuation result" : "quality-weighted comparable PPSF"}.`;
  result.strongestComp = strongComps[0] || null;
  result.weakestComp = weakComps[0] || null;
  return result;
}

export default buildAppraisalIntelligenceResult;
