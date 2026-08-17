import { dealToCanonical, canonicalToDeal } from "./canonicalDataFoundation.js";
import { evaluateRoyalStarBuyBox } from "../app/src/components/royalStarBuyBoxEngine.js";
import { buildAppraisalIntelligenceResult } from "../app/src/components/appraisalIntelligenceEngine.js";

function safeNumber(value, fallback = null) {
  if (value === null || value === undefined || value === "") return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function safeString(value, fallback = "") {
  if (value === null || value === undefined) return fallback;
  return typeof value === "string" ? value : String(value);
}

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function nowIso() {
  return new Date().toISOString();
}

function createId(prefix = "audit") {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

function percentile(values, p) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = (sorted.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

function normalizeComp(comp = {}) {
  return {
    id: safeString(comp.id, ""),
    address: safeString(comp.compAddress || comp.address || comp.propertyAddress, ""),
    city: safeString(comp.city, ""),
    state: safeString(comp.state, "").toUpperCase(),
    zipCode: safeString(comp.zipCode || comp.zip, ""),
    propertyType: safeString(comp.propertyType, ""),
    salePrice: safeNumber(comp.salePrice, null),
    saleDate: safeString(comp.saleDate, ""),
    squareFeet: safeNumber(comp.squareFeet, null),
    bedrooms: safeNumber(comp.bedrooms, null),
    bathrooms: safeNumber(comp.bathrooms, null),
    yearBuilt: safeNumber(comp.yearBuilt, null),
    lotSize: safeNumber(comp.lotSize, null),
    garage: safeString(comp.garage, ""),
    basement: safeString(comp.basement, ""),
    condition: safeString(comp.condition, ""),
    included: comp.included !== false,
    inclusionStatus: safeString(comp.inclusionStatus, "pending").toLowerCase(),
    verified: comp.verified === true,
    approved: comp.manualApproval === true || comp.approved === true || safeString(comp.inclusionStatus, "").toLowerCase() === "approved",
    qualityScore: safeNumber(comp.qualityScore ?? comp.finalCompQualityScore ?? comp.compQualityScore, 50),
    distanceMiles: safeNumber(comp.distanceMiles, null),
    sourceRecord: comp,
  };
}

function normalizeDealForValuation(deal = {}) {
  const canonical = dealToCanonical(deal);
  return {
    ...canonical,
    rawDeal: deal,
    approvedArv: safeNumber(deal.approvedArv ?? deal.supportedARVApproved ?? deal.auditMetadata?.valuationGovernance?.approvedArv, null),
    recommendedArv: safeNumber(deal.recommendedArv ?? deal.auditMetadata?.valuationGovernance?.recommendedArv, null),
    propertyUnits: safeNumber(deal.units ?? deal.unitCount ?? 1, 1),
    neighborhoodQuality: safeString(deal.neighborhoodQuality || deal.neighborhoodGrade || "", ""),
  };
}

function compIsReviewEligible(comp) {
  const status = safeString(comp.inclusionStatus, "pending").toLowerCase();
  if (status === "rejected" || status === "excluded") return false;
  if (comp.included === false) return false;
  return comp.verified === true || status === "approved" || status === "reviewed";
}

function compIsRejected(comp) {
  const status = safeString(comp.inclusionStatus, "").toLowerCase();
  return status === "rejected" || status === "excluded";
}

function propertyTypeSimilarity(subjectType, compType) {
  if (!subjectType || !compType) return 0.6;
  return safeString(subjectType).toLowerCase() === safeString(compType).toLowerCase() ? 1 : 0.5;
}

function ratioSimilarity(subjectValue, compValue, tolerance = 0.35) {
  if (subjectValue === null || subjectValue === undefined || compValue === null || compValue === undefined) return 0.55;
  const subject = safeNumber(subjectValue, null);
  const comp = safeNumber(compValue, null);
  if (subject === null || comp === null || subject === 0) return 0.55;
  const deltaRatio = Math.abs(comp - subject) / Math.abs(subject);
  if (deltaRatio >= tolerance) return 0.2;
  return Math.max(0.2, 1 - deltaRatio / tolerance);
}

function dateRecencyScore(saleDate) {
  if (!saleDate) return 0.4;
  const ts = Date.parse(saleDate);
  if (!Number.isFinite(ts)) return 0.4;
  const ageDays = Math.max(0, (Date.now() - ts) / (1000 * 60 * 60 * 24));
  if (ageDays <= 90) return 1;
  if (ageDays <= 180) return 0.85;
  if (ageDays <= 365) return 0.65;
  if (ageDays <= 540) return 0.45;
  return 0.25;
}

function distanceScore(distanceMiles) {
  const distance = safeNumber(distanceMiles, null);
  if (distance === null) return 0.55;
  if (distance <= 1) return 1;
  if (distance <= 2) return 0.9;
  if (distance <= 5) return 0.7;
  if (distance <= 10) return 0.5;
  return 0.25;
}

export function calculateCompSimilarity(subject = {}, comp = {}) {
  const subjectCanonical = normalizeDealForValuation(subject);
  const normalizedComp = normalizeComp(comp);

  const components = {
    recency: dateRecencyScore(normalizedComp.saleDate),
    distance: distanceScore(normalizedComp.distanceMiles),
    propertyType: propertyTypeSimilarity(subjectCanonical.propertyType, normalizedComp.propertyType),
    squareFeet: ratioSimilarity(subjectCanonical.squareFeet, normalizedComp.squareFeet, 0.4),
    bedrooms: ratioSimilarity(subjectCanonical.bedrooms, normalizedComp.bedrooms, 1),
    bathrooms: ratioSimilarity(subjectCanonical.bathrooms, normalizedComp.bathrooms, 1),
    yearBuilt: ratioSimilarity(subjectCanonical.yearBuilt, normalizedComp.yearBuilt, 0.25),
    lotSize: ratioSimilarity(subjectCanonical.lotSize, normalizedComp.lotSize, 0.6),
    garage: subjectCanonical.garage && normalizedComp.garage ? (safeString(subjectCanonical.garage).toLowerCase() === safeString(normalizedComp.garage).toLowerCase() ? 1 : 0.5) : 0.6,
    basement: subjectCanonical.basement && normalizedComp.basement ? (safeString(subjectCanonical.basement).toLowerCase() === safeString(normalizedComp.basement).toLowerCase() ? 1 : 0.5) : 0.6,
    condition: subjectCanonical.condition && normalizedComp.condition ? (safeString(subjectCanonical.condition).toLowerCase() === safeString(normalizedComp.condition).toLowerCase() ? 1 : 0.55) : 0.55,
    quality: Math.max(0.2, Math.min(1, safeNumber(normalizedComp.qualityScore, 50) / 100)),
  };

  const weighted =
    components.recency * 0.14 +
    components.distance * 0.12 +
    components.propertyType * 0.12 +
    components.squareFeet * 0.12 +
    components.bedrooms * 0.07 +
    components.bathrooms * 0.07 +
    components.yearBuilt * 0.08 +
    components.lotSize * 0.05 +
    components.garage * 0.04 +
    components.basement * 0.04 +
    components.condition * 0.08 +
    components.quality * 0.07;

  return {
    score: Math.round(Math.max(0, Math.min(1, weighted)) * 1000) / 1000,
    components,
  };
}

export function calculateCompWeight(subject = {}, comp = {}) {
  const normalizedComp = normalizeComp(comp);
  const similarity = calculateCompSimilarity(subject, comp);
  const status = safeString(normalizedComp.inclusionStatus, "pending").toLowerCase();
  const approvalBonus = normalizedComp.approved ? 1.06 : 0.92;
  const inclusionMultiplier = status === "approved" || status === "reviewed" ? 1 : 0.75;
  const freshnessMultiplier = dateRecencyScore(normalizedComp.saleDate);
  const qualityMultiplier = Math.max(0.25, Math.min(1.1, safeNumber(normalizedComp.qualityScore, 50) / 100));
  const weight = similarity.score * approvalBonus * inclusionMultiplier * freshnessMultiplier * qualityMultiplier;
  return {
    weight: Math.max(0.05, Math.min(1.5, Math.round(weight * 1000) / 1000)),
    similarity,
    reviewEligible: compIsReviewEligible(normalizedComp),
  };
}

export function detectCompOutlier(comp = {}, compSet = []) {
  const normalized = normalizeComp(comp);
  const normalizedSet = safeArray(compSet).map((entry) => normalizeComp(entry));
  const ppsfValues = normalizedSet
    .map((entry) => {
      if (!entry.salePrice || !entry.squareFeet) return null;
      return entry.salePrice / Math.max(1, entry.squareFeet);
    })
    .filter((value) => value !== null);

  if (!normalized.salePrice || !normalized.squareFeet || ppsfValues.length < 4) {
    return { isOutlier: false, reason: "INSUFFICIENT_COMPS", score: 0 };
  }

  const compPpsf = normalized.salePrice / Math.max(1, normalized.squareFeet);
  const q1 = percentile(ppsfValues, 0.25);
  const q3 = percentile(ppsfValues, 0.75);
  const iqr = q3 - q1;
  const lowerFence = q1 - 1.5 * iqr;
  const upperFence = q3 + 1.5 * iqr;
  const isOutlier = compPpsf < lowerFence || compPpsf > upperFence;
  const distanceFromMedian = Math.abs(compPpsf - percentile(ppsfValues, 0.5));

  return {
    isOutlier,
    reason: isOutlier ? "PRICE_PER_SQFT_OUTLIER" : "IN_RANGE",
    score: Math.round(distanceFromMedian * 100) / 100,
    compPpsf,
    lowerFence,
    upperFence,
  };
}

export function generateValuationWarnings(subject = {}, approvedComps = []) {
  const warnings = [];
  const comps = safeArray(approvedComps).map((entry) => normalizeComp(entry));
  if (comps.length < 3) warnings.push("INSUFFICIENT_COMPS");

  const stale = comps.filter((comp) => dateRecencyScore(comp.saleDate) <= 0.45).length;
  if (stale > 0) warnings.push("STALE_COMPS");

  const missingData = comps.filter((comp) => !comp.salePrice || !comp.squareFeet || !comp.saleDate).length;
  if (missingData > 0) warnings.push("INCOMPLETE_COMP_DATA");

  const outlierCount = comps.filter((comp) => detectCompOutlier(comp, comps).isOutlier).length;
  if (outlierCount > 0) warnings.push("OUTLIER_COMPS_DETECTED");
  if (outlierCount >= Math.ceil(Math.max(1, comps.length) / 2)) warnings.push("OUTLIER_DOMINATED_SET");

  const subjectCanonical = normalizeDealForValuation(subject);
  if (!subjectCanonical.squareFeet || !subjectCanonical.propertyType || !subjectCanonical.zipCode) warnings.push("SUBJECT_DATA_GAPS");

  return warnings;
}

export function calculateArvConfidence(subject = {}, approvedComps = []) {
  const comps = safeArray(approvedComps).map((entry) => normalizeComp(entry));
  if (!comps.length) {
    return {
      score: 0,
      label: "LOW",
      grade: "D",
      reasons: ["No review-eligible comps are available."],
    };
  }

  const warnings = generateValuationWarnings(subject, comps);
  const similarityScores = comps.map((comp) => calculateCompSimilarity(subject, comp).score);
  const avgSimilarity = similarityScores.length ? similarityScores.reduce((sum, value) => sum + value, 0) / similarityScores.length : 0;
  const approvedCount = comps.filter((comp) => comp.approved).length;

  let score = 20;
  score += Math.min(30, comps.length * 8);
  score += Math.round(avgSimilarity * 25);
  score += Math.min(15, approvedCount * 4);

  if (warnings.includes("STALE_COMPS")) score -= 10;
  if (warnings.includes("INCOMPLETE_COMP_DATA")) score -= 12;
  if (warnings.includes("OUTLIER_DOMINATED_SET")) score -= 20;
  if (warnings.includes("SUBJECT_DATA_GAPS")) score -= 10;

  score = Math.max(0, Math.min(100, score));

  let label = "LOW";
  let grade = "D";
  if (score >= 80) {
    label = "HIGH";
    grade = "A";
  } else if (score >= 65) {
    label = "MODERATE";
    grade = "B";
  } else if (score >= 50) {
    label = "MODERATE";
    grade = "C";
  }

  const reasons = [];
  reasons.push(comps.length >= 3 ? "Comp count supports a stable valuation range." : "Comp count is limited; range is preliminary.");
  reasons.push(avgSimilarity >= 0.7 ? "Comp similarity is strong." : "Comp similarity is mixed.");
  if (warnings.includes("STALE_COMPS")) reasons.push("Some comps are stale.");
  if (warnings.includes("INCOMPLETE_COMP_DATA")) reasons.push("Missing comp fields reduced confidence.");
  if (warnings.includes("OUTLIER_COMPS_DETECTED")) reasons.push("Outlier detection reduced influence of extreme comps.");

  return { score, label, grade, reasons };
}

export function buildValuationRange(subject = {}, approvedComps = []) {
  const canonicalSubject = normalizeDealForValuation(subject);
  const comps = safeArray(approvedComps).map((entry) => normalizeComp(entry));
  const weightedRows = [];

  for (const comp of comps) {
    if (!comp.salePrice || !comp.squareFeet) continue;
    const outlier = detectCompOutlier(comp, comps);
    const weightInfo = calculateCompWeight(canonicalSubject, comp);
    const ppsf = comp.salePrice / Math.max(1, comp.squareFeet);
    weightedRows.push({ comp, outlier, weightInfo, ppsf });
  }

  const includedRows = weightedRows.filter((entry) => !entry.outlier.isOutlier);
  const effectiveRows = includedRows.length ? includedRows : weightedRows;

  if (!effectiveRows.length || !canonicalSubject.squareFeet) {
    const warnings = generateValuationWarnings(canonicalSubject, comps);
    const confidence = calculateArvConfidence(canonicalSubject, comps);
    return {
      conservativeArv: null,
      expectedArv: null,
      aggressiveArv: null,
      supportedArv: null,
      lowRange: null,
      baseRange: null,
      highRange: null,
      confidence,
      qualityGrade: confidence.grade,
      strongestComp: null,
      compCountUsed: 0,
      compCountExcluded: comps.length,
      warningCount: warnings.length,
      valuationReviewStatus: "REVIEW_REQUIRED",
      assumptions: ["Subject square footage or comp pricing is unavailable."],
      unknowns: ["ARV cannot be supported without minimum evidence."],
      warnings,
    };
  }

  const totalWeight = effectiveRows.reduce((sum, row) => sum + row.weightInfo.weight, 0) || 1;
  const weightedPpsf = effectiveRows.reduce((sum, row) => sum + row.ppsf * row.weightInfo.weight, 0) / totalWeight;
  const ppsfValues = effectiveRows.map((row) => row.ppsf);
  const spreadLow = percentile(ppsfValues, 0.2);
  const spreadHigh = percentile(ppsfValues, 0.8);

  const expectedArv = Math.round(weightedPpsf * canonicalSubject.squareFeet);
  const conservativeArv = Math.round((spreadLow || weightedPpsf) * canonicalSubject.squareFeet);
  const aggressiveArv = Math.round((spreadHigh || weightedPpsf) * canonicalSubject.squareFeet);

  const confidence = calculateArvConfidence(canonicalSubject, comps);
  const warnings = generateValuationWarnings(canonicalSubject, comps);
  const strongest = [...effectiveRows].sort((a, b) => b.weightInfo.weight - a.weightInfo.weight)[0];

  const valuationReviewStatus =
    confidence.score < 50 ||
    warnings.includes("INSUFFICIENT_COMPS") ||
    warnings.includes("OUTLIER_DOMINATED_SET")
      ? "REVIEW_REQUIRED"
      : "PRELIMINARY";

  return {
    conservativeArv,
    expectedArv,
    aggressiveArv,
    supportedArv: expectedArv,
    lowRange: conservativeArv,
    baseRange: expectedArv,
    highRange: aggressiveArv,
    confidence,
    qualityGrade: confidence.grade,
    strongestComp: strongest ? {
      id: strongest.comp.id,
      address: strongest.comp.address,
      salePrice: strongest.comp.salePrice,
      squareFeet: strongest.comp.squareFeet,
      ppsf: Math.round(strongest.ppsf),
      weight: strongest.weightInfo.weight,
    } : null,
    compCountUsed: effectiveRows.length,
    compCountExcluded: comps.length - effectiveRows.length,
    warningCount: warnings.length,
    valuationReviewStatus,
    assumptions: [
      "Valuation uses review-eligible, non-rejected comparable sales only.",
      "Outlier comps are reduced or excluded to prevent a single comp from dominating.",
    ],
    unknowns: warnings.includes("INCOMPLETE_COMP_DATA") ? ["Some comp fields are missing and confidence is reduced."] : [],
    warnings,
    compSetVersion: `comp-set-${nowIso().slice(0, 10)}`,
    valuationVersion: "upload2-v1",
  };
}

function buildSubjectCompUniverse(dealCanonical, comps = []) {
  const normalizedComps = safeArray(comps).map((entry) => normalizeComp(entry));
  const sameZip = normalizedComps.filter((comp) => comp.zipCode && dealCanonical.zipCode && comp.zipCode === dealCanonical.zipCode);
  const sameCityState = normalizedComps.filter((comp) => comp.city && comp.state && dealCanonical.city && dealCanonical.state && comp.city.toLowerCase() === dealCanonical.city.toLowerCase() && comp.state.toLowerCase() === dealCanonical.state.toLowerCase());
  const pool = sameZip.length >= 2 ? sameZip : sameCityState.length ? sameCityState : normalizedComps;
  return {
    all: pool,
    approved: pool.filter((comp) => compIsReviewEligible(comp)),
    rejectedCount: pool.filter((comp) => compIsRejected(comp)).length,
    pendingCount: pool.filter((comp) => !compIsReviewEligible(comp) && !compIsRejected(comp)).length,
  };
}

function buildValuationGovernance(deal = {}, valuation = {}) {
  const existing = (deal.auditMetadata && deal.auditMetadata.valuationGovernance) || {};
  const approvedArv = safeNumber(existing.approvedArv ?? deal.approvedArv ?? deal.supportedARVApproved, null);
  const previousApprovedArv = safeNumber(existing.previousApprovedArv, null);

  return {
    recommendedArv: valuation.supportedArv,
    reviewedArv: valuation.expectedArv,
    approvedArv,
    protectedArv: approvedArv,
    previousApprovedArv,
    approvalTimestamp: existing.approvalTimestamp || null,
    approvalActor: existing.approvalActor || null,
    approvalEvidenceSummary: existing.approvalEvidenceSummary || null,
    compSetVersion: valuation.compSetVersion || existing.compSetVersion || null,
    valuationVersion: valuation.valuationVersion || existing.valuationVersion || "upload2-v1",
    reviewRequired: valuation.valuationReviewStatus === "REVIEW_REQUIRED",
    dataAsOf: nowIso(),
  };
}

function sanitizeAudit(value) {
  if (value === null || value === undefined) return value;
  if (typeof value === "string") {
    return value
      .replace(/(api[_-]?key|token|secret|password)=([^&\s]+)/ig, "$1=REDACTED")
      .replace(/Bearer\s+[A-Za-z0-9._-]+/g, "Bearer REDACTED");
  }
  if (Array.isArray(value)) return value.map((entry) => sanitizeAudit(entry));
  if (typeof value === "object") {
    const next = {};
    Object.entries(value).forEach(([key, entry]) => {
      if (/(api[_-]?key|token|secret|password)/i.test(key)) next[key] = "REDACTED";
      else next[key] = sanitizeAudit(entry);
    });
    return next;
  }
  return value;
}

function calculateOfferConfidence(deal = {}, valuation = {}, assumptions = {}) {
  const unknowns = [];
  const required = [
    [deal.purchasePrice, "purchasePrice"],
    [deal.rehabBudget, "rehabBudget"],
    [valuation.supportedArv, "supportedArv"],
    [assumptions.sellingCostPct, "sellingCostPct"],
    [assumptions.holdingMonths, "holdingMonths"],
  ];
  required.forEach(([value, label]) => {
    if (value === null || value === undefined || value === "") unknowns.push(label);
  });

  let score = 80;
  score -= unknowns.length * 10;
  if (valuation.confidence?.score < 65) score -= 15;
  if (valuation.valuationReviewStatus === "REVIEW_REQUIRED") score -= 10;
  score = Math.max(0, Math.min(100, score));
  return {
    score,
    label: score >= 75 ? "HIGH" : score >= 55 ? "MODERATE" : "LOW",
    unknowns,
  };
}

export function calculateFlipOffer(deal = {}, assumptions = {}) {
  const canonical = normalizeDealForValuation(deal);
  const arv = safeNumber(assumptions.arvOverride ?? canonical.approvedArv ?? canonical.recommendedArv ?? canonical.arv, null);
  const purchasePrice = safeNumber(canonical.purchasePrice ?? canonical.askingPrice, null);
  const rehabBudget = safeNumber(canonical.rehabBudget, null);
  const sellingCostPct = safeNumber(assumptions.sellingCostPct, null);
  const contingencyPct = safeNumber(assumptions.contingencyPct, 0.1);
  const holdingMonths = safeNumber(assumptions.holdingMonths ?? canonical.holdingMonths, null);
  const monthlyHoldingCost = safeNumber(assumptions.monthlyHoldingCost, null);
  const financingCosts = safeNumber(canonical.financingCosts, null);
  const closingCosts = safeNumber(canonical.closingCosts, null);
  const taxes = safeNumber(canonical.taxes, null);
  const insurance = safeNumber(canonical.insurance, null);
  const additionalCosts = safeNumber(assumptions.additionalCosts, null);
  const targetProfit = safeNumber(assumptions.targetProfit, null);
  const targetMargin = safeNumber(assumptions.targetMargin, null);

  const unknowns = [];
  const known = [];

  const sellingCosts = arv !== null && sellingCostPct !== null ? arv * sellingCostPct : null;
  const holdingCosts = monthlyHoldingCost !== null && holdingMonths !== null ? monthlyHoldingCost * holdingMonths : null;
  const rehabContingency = rehabBudget !== null ? rehabBudget * contingencyPct : null;

  const totalProjectCost = [purchasePrice, rehabBudget, rehabContingency, closingCosts, holdingCosts, financingCosts, taxes, insurance, additionalCosts]
    .reduce((sum, value) => {
      if (value === null) return sum;
      return sum + value;
    }, 0);

  [
    [purchasePrice, "purchasePrice"],
    [rehabBudget, "rehabBudget"],
    [arv, "arv"],
    [sellingCostPct, "sellingCostPct"],
    [holdingMonths, "holdingMonths"],
  ].forEach(([value, field]) => {
    if (value === null) unknowns.push(field);
    else known.push(field);
  });

  const expectedProfit = arv !== null ? arv - totalProjectCost - (sellingCosts || 0) : null;
  const conservativeProfit = expectedProfit !== null && arv !== null ? expectedProfit - Math.max(0, arv * 0.05) : null;
  const worstCaseProfit = expectedProfit !== null && arv !== null ? expectedProfit - Math.max(0, arv * 0.1) : null;

  const roi = totalProjectCost > 0 && expectedProfit !== null ? expectedProfit / totalProjectCost : null;
  const margin = arv && expectedProfit !== null ? expectedProfit / arv : null;
  const cashOnCashReturn = totalProjectCost > 0 && expectedProfit !== null ? expectedProfit / totalProjectCost : null;

  const breakEvenSalePrice = totalProjectCost + (sellingCosts || 0);
  const breakEvenArv = breakEvenSalePrice;
  const minimumAcceptableArv = breakEvenSalePrice + (targetProfit || 0);

  const decisionBreakingThresholds = [];
  if (worstCaseProfit !== null && worstCaseProfit < 0) decisionBreakingThresholds.push("NEGATIVE_WORST_CASE_PROFIT");
  if (roi !== null && roi < 0.08) decisionBreakingThresholds.push("ROI_BELOW_MINIMUM");

  const mao = arv !== null ? Math.max(0, arv - ((sellingCosts || 0) + (rehabBudget || 0) + (rehabContingency || 0) + (holdingCosts || 0) + (financingCosts || 0) + (closingCosts || 0) + (taxes || 0) + (insurance || 0) + (additionalCosts || 0) + (targetProfit || 0))) : null;
  const targetOffer = targetMargin !== null && arv !== null
    ? Math.max(0, arv * (1 - targetMargin) - ((rehabBudget || 0) + (rehabContingency || 0) + (holdingCosts || 0) + (financingCosts || 0) + (closingCosts || 0) + (taxes || 0) + (insurance || 0) + (additionalCosts || 0)))
    : mao;

  const walkAwayPrice = targetOffer !== null ? Math.max(0, targetOffer * 1.02) : null;
  const financedAmount = safeNumber(assumptions.financedAmount ?? canonical.loanAmount, null);
  const requiredCash = totalProjectCost - (financedAmount || 0);

  return {
    strategy: "FLIP",
    maximumAllowableOffer: mao,
    targetOffer,
    conservativeOffer: targetOffer !== null ? Math.max(0, targetOffer * 0.95) : null,
    aggressiveOffer: targetOffer !== null ? Math.max(0, targetOffer * 1.05) : null,
    walkAwayPrice,
    offerRange: targetOffer !== null ? { low: Math.max(0, targetOffer * 0.95), high: Math.max(0, targetOffer * 1.05) } : { low: null, high: null },
    requiredCash,
    financedAmount,
    acquisitionCost: purchasePrice,
    rehabContingency,
    totalProjectCost,
    estimatedSellingCosts: sellingCosts,
    estimatedHoldingCosts: holdingCosts,
    estimatedFinancingCosts: financingCosts,
    expectedProfit,
    conservativeProfit,
    worstCaseProfit,
    roi,
    margin,
    cashOnCashReturn,
    breakEvenSalePrice,
    breakEvenArv,
    minimumAcceptableArv,
    downsideCashRequired: requiredCash + Math.max(0, (rehabBudget || 0) * 0.1),
    decisionBreakingThresholds,
    known,
    uncertain: unknowns,
    needed: unknowns,
    confidence: calculateOfferConfidence(canonical, { supportedArv: arv, confidence: { score: 70 }, valuationReviewStatus: "PRELIMINARY" }, assumptions),
  };
}

export function calculateBrrrrOffer(deal = {}, assumptions = {}) {
  const canonical = normalizeDealForValuation(deal);
  const flip = calculateFlipOffer(canonical, assumptions);

  const arv = safeNumber(assumptions.arvOverride ?? canonical.approvedArv ?? canonical.recommendedArv ?? canonical.arv, null);
  const refinanceLtv = safeNumber(assumptions.refinanceLtv, null);
  const refinanceInterestRate = safeNumber(assumptions.refinanceInterestRate ?? canonical.interestRate, null);
  const loanTermMonths = safeNumber(assumptions.loanTermMonths, 360);
  const refinanceClosingCosts = safeNumber(assumptions.refinanceClosingCosts, null);
  const rent = safeNumber(assumptions.rent ?? canonical.estimatedRent ?? canonical.monthlyRent, null);
  const vacancyPct = safeNumber(assumptions.vacancyPct, null);
  const maintenancePct = safeNumber(assumptions.maintenancePct, null);
  const capexPct = safeNumber(assumptions.capexPct, null);
  const managementPct = safeNumber(assumptions.managementPct, null);
  const taxes = safeNumber(canonical.taxes ?? canonical.annualTaxes, null);
  const insurance = safeNumber(canonical.insurance ?? canonical.annualInsurance, null);

  const refinanceAmount = arv !== null && refinanceLtv !== null ? arv * refinanceLtv : null;
  const vacancy = rent !== null && vacancyPct !== null ? rent * vacancyPct : null;
  const maintenance = rent !== null && maintenancePct !== null ? rent * maintenancePct : null;
  const capex = rent !== null && capexPct !== null ? rent * capexPct : null;
  const management = rent !== null && managementPct !== null ? rent * managementPct : null;
  const monthlyTaxes = taxes !== null ? taxes / 12 : null;
  const monthlyInsurance = insurance !== null ? insurance / 12 : null;

  const noi = rent !== null
    ? rent - (vacancy || 0) - (maintenance || 0) - (capex || 0) - (management || 0) - (monthlyTaxes || 0) - (monthlyInsurance || 0)
    : null;

  const monthlyRate = refinanceInterestRate !== null ? refinanceInterestRate / 12 : null;
  const debtService = refinanceAmount !== null && monthlyRate !== null
    ? refinanceAmount * (monthlyRate / Math.max(1e-6, 1 - Math.pow(1 + monthlyRate, -Math.max(1, loanTermMonths))))
    : null;

  const dscr = noi !== null && debtService ? noi / debtService : null;
  const monthlyCashFlow = noi !== null && debtService !== null ? noi - debtService : null;

  const totalCashIn = flip.totalProjectCost + (refinanceClosingCosts || 0);
  const cashReturnedAtRefinance = refinanceAmount !== null ? refinanceAmount - (refinanceClosingCosts || 0) : null;
  const cashLeftInDeal = cashReturnedAtRefinance !== null ? totalCashIn - cashReturnedAtRefinance : null;
  const equityCreated = arv !== null ? arv - flip.totalProjectCost : null;

  return {
    ...flip,
    strategy: "BRRRR",
    refinanceLtv,
    refinanceInterestRate,
    loanTermMonths,
    refinanceClosingCosts,
    rent,
    vacancyPct,
    maintenancePct,
    capexPct,
    managementPct,
    taxes,
    insurance,
    debtService,
    dscr,
    cashLeftInDeal,
    cashReturnedAtRefinance,
    equityCreated,
    monthlyCashFlow,
  };
}

export function calculateMao(deal = {}, assumptions = {}) {
  return calculateFlipOffer(deal, assumptions).maximumAllowableOffer;
}

export function calculateTargetOffer(deal = {}, assumptions = {}) {
  return calculateFlipOffer(deal, assumptions).targetOffer;
}

export function calculateWalkAwayPrice(deal = {}, assumptions = {}) {
  return calculateFlipOffer(deal, assumptions).walkAwayPrice;
}

export function calculateBreakEvenThresholds(deal = {}, assumptions = {}) {
  const offer = calculateFlipOffer(deal, assumptions);
  return {
    breakEvenSalePrice: offer.breakEvenSalePrice,
    breakEvenArv: offer.breakEvenArv,
    minimumAcceptableArv: offer.minimumAcceptableArv,
    downsideCashRequired: offer.downsideCashRequired,
    decisionBreakingThresholds: offer.decisionBreakingThresholds,
  };
}

function getBuyBoxZipMarket(zipCode) {
  const zip = safeString(zipCode, "");
  const covingtonPrimary = new Set(["41011", "41014", "41016", "41017"]);
  const covingtonSelective = new Set(["41015"]);
  const cincinnatiPrimary = new Set(["45211", "45224", "45239"]);
  const cincinnatiSelective = new Set(["45205", "45238", "45231", "45223", "45232"]);

  if (covingtonPrimary.has(zip)) return { market: "Covington", priority: "Primary" };
  if (covingtonSelective.has(zip)) return { market: "Covington", priority: "Selective" };
  if (cincinnatiPrimary.has(zip)) return { market: "Cincinnati", priority: "Primary" };
  if (cincinnatiSelective.has(zip)) return { market: "Cincinnati", priority: "Selective" };
  return { market: "Outside", priority: "Outside" };
}

export function scoreBuyBoxDimension(dimension, inputs = {}) {
  const unknown = inputs.value === null || inputs.value === undefined || inputs.value === "";
  if (unknown) return { dimension, score: 45, unknown: true, reason: "Unknown data reduced confidence." };

  const value = safeNumber(inputs.value, null);
  switch (dimension) {
    case "zipFit":
      return { dimension, score: inputs.value === "Primary" ? 100 : inputs.value === "Selective" ? 70 : 20, unknown: false, reason: "ZIP fit evaluated against Royal Star target markets." };
    case "rehabFit":
      if (value === null) return { dimension, score: 45, unknown: true, reason: "Unknown rehab budget." };
      if (value <= 60000) return { dimension, score: 95, unknown: false, reason: "Rehab is within preferred range." };
      if (value <= 100000) return { dimension, score: 65, unknown: false, reason: "Rehab exceeds preferred range and needs review." };
      return { dimension, score: 35, unknown: false, reason: "Rehab is high and requires strong economics." };
    case "propertyTypeFit":
      return { dimension, score: inputs.value ? 100 : 0, unknown: false, reason: inputs.value ? "Property type is within 1-4 units." : "Property type outside 1-4 units is a hard blocker." };
    case "squareFootFit":
      if (value === null) return { dimension, score: 45, unknown: true, reason: "Unknown square footage." };
      if (value <= 1800) return { dimension, score: 90, unknown: false, reason: "Square footage aligns with preferred profile." };
      return { dimension, score: 60, unknown: false, reason: "Larger square footage lowers fit but does not auto-fail." };
    case "arvSupport":
      if (value === null) return { dimension, score: 40, unknown: true, reason: "ARV support unknown." };
      if (value >= 75) return { dimension, score: 90, unknown: false, reason: "ARV support confidence is strong." };
      if (value >= 55) return { dimension, score: 70, unknown: false, reason: "ARV support is moderate." };
      return { dimension, score: 35, unknown: false, reason: "Weak ARV support lowers buy confidence." };
    default:
      return { dimension, score: value === null ? 45 : Math.max(0, Math.min(100, value)), unknown, reason: unknown ? "Unknown data reduced confidence." : "Dimension scored." };
  }
}

function calculateBuyBoxResult(scores = [], blockers = [], unknowns = []) {
  const avg = scores.length ? scores.reduce((sum, row) => sum + row.score, 0) / scores.length : 0;
  const hardFail = blockers.some((blocker) => blocker.severity === "HARD_FAIL");

  if (hardFail) {
    return { result: "FAIL", score: Math.round(avg), confidenceScore: Math.max(0, Math.round(avg - unknowns.length * 4)), reviewRequired: true };
  }
  if (blockers.length > 0 || unknowns.length >= 4 || avg < 55) {
    return { result: "REVIEW REQUIRED", score: Math.round(avg), confidenceScore: Math.max(0, Math.round(avg - unknowns.length * 5)), reviewRequired: true };
  }
  if (avg >= 75) {
    return { result: "PASS", score: Math.round(avg), confidenceScore: Math.max(0, Math.round(avg - unknowns.length * 3)), reviewRequired: unknowns.length > 0 };
  }
  if (avg >= 60) {
    return { result: "CONDITIONAL PASS", score: Math.round(avg), confidenceScore: Math.max(0, Math.round(avg - unknowns.length * 4)), reviewRequired: true };
  }
  return { result: "REVIEW REQUIRED", score: Math.round(avg), confidenceScore: Math.max(0, Math.round(avg - unknowns.length * 5)), reviewRequired: true };
}

function generateBuyBoxWarnings(deal, context = {}) {
  const warnings = [];
  const rehabBudget = safeNumber(deal.rehabBudget, null);
  if (rehabBudget !== null && rehabBudget > 60000) warnings.push("Rehab exceeds preferred threshold of $60,000.");
  if (rehabBudget !== null && rehabBudget > 100000) warnings.push("Rehab above $100,000 requires strong economics and explicit review.");
  if (safeNumber(context.arvConfidenceScore, 0) < 55) warnings.push("Weak ARV support blocks high-confidence approval.");
  if (safeNumber(context.dscr, 0) > 0 && safeNumber(context.dscr, 0) < 1.2) warnings.push("DSCR is below preferred threshold.");
  return warnings;
}

function generateBuyBoxRecommendation(deal, evaluation = {}) {
  if (evaluation.result === "PASS" && !evaluation.reviewRequired) return "Proceed to review-first offer approval.";
  if (evaluation.result === "CONDITIONAL PASS") return "Proceed only after valuation and financing review items are cleared.";
  if (evaluation.result === "REVIEW REQUIRED") return "Do not advance until blockers and unknowns are resolved.";
  return "Reject unless policy conflicts are explicitly remediated.";
}

export function evaluateCovingtonBuyBox(deal = {}, context = {}) {
  return evaluateBuyBoxForMarket(deal, context, "Covington");
}

export function evaluateCincinnatiBuyBox(deal = {}, context = {}) {
  return evaluateBuyBoxForMarket(deal, context, "Cincinnati");
}

function evaluateBuyBoxForMarket(deal = {}, context = {}, expectedMarket = "Covington") {
  void expectedMarket;
  const central = evaluateRoyalStarBuyBox(deal, context);
  const centralBlockers = central.failedRules.map((action) => ({ type: "ROYAL_STAR_BUY_BOX_FAIL", severity: "HARD_FAIL", action }));
  return {
    ...central,
    confidenceScore: central.score,
    reviewRequired: central.status !== "PASS",
    warnings: central.reviewRules,
    blockers: centralBlockers,
    warningCount: central.reviewRules.length,
    criticalBlockerCount: centralBlockers.length,
    decisionBlockingActions: central.failedRules,
    known: central.passedRules,
    uncertain: central.reviewRules,
    needed: central.reviewRules,
    recommendation: central.status === "PASS"
      ? "Proceed to review-first offer approval."
      : central.status === "REVIEW"
        ? "Do not advance until review conditions are cleared."
        : "Reject unless hard policy conflicts are remediated.",
    scoringDimensions: central.reasons.map((reason) => ({ dimension: "centralBuyBox", score: central.score, unknown: false, reason })),
  };
  /* Legacy scoring retained below for backward reference; this return makes the centralized result authoritative. */
  const canonical = normalizeDealForValuation(deal);
  const marketInfo = getBuyBoxZipMarket(canonical.zipCode);
  const isTargetMarket = marketInfo.market === expectedMarket;

  const unitCount = safeNumber(canonical.propertyUnits, 1);
  const propertyTypeAllowed = ["single family", "duplex", "triplex", "fourplex", "2-4 units"].includes(safeString(canonical.propertyType, "").toLowerCase()) || (unitCount >= 1 && unitCount <= 4);

  const blockers = [];
  if (!propertyTypeAllowed) blockers.push({ type: "INVALID_PROPERTY_TYPE", severity: "HARD_FAIL", action: "Property types outside 1-4 units are not eligible." });
  if (!isTargetMarket) blockers.push({ type: "OUTSIDE_MARKET", severity: "SOFT_FAIL", action: "Outside target market requires explicit exception review." });

  const scores = [
    scoreBuyBoxDimension("zipFit", { value: marketInfo.priority }),
    scoreBuyBoxDimension("propertyTypeFit", { value: propertyTypeAllowed }),
    scoreBuyBoxDimension("squareFootFit", { value: canonical.squareFeet }),
    scoreBuyBoxDimension("rehabFit", { value: canonical.rehabBudget }),
    scoreBuyBoxDimension("arvSupport", { value: safeNumber(context.arvConfidenceScore, null) }),
    scoreBuyBoxDimension("marketPriority", { value: marketInfo.priority === "Primary" ? 90 : marketInfo.priority === "Selective" ? 65 : 30 }),
    scoreBuyBoxDimension("strategyFit", { value: ["brrrr", "brrrrr", "flip", "hold", "rental"].includes(safeString(canonical.strategy, "").toLowerCase()) ? 80 : 50 }),
    scoreBuyBoxDimension("dscr", { value: context.dscr !== null && context.dscr !== undefined ? Math.min(100, Math.max(0, safeNumber(context.dscr, 0) * 60)) : null }),
    scoreBuyBoxDimension("cashFlow", { value: context.monthlyCashFlow !== null && context.monthlyCashFlow !== undefined ? (safeNumber(context.monthlyCashFlow, 0) >= 0 ? 80 : 35) : null }),
    scoreBuyBoxDimension("profit", { value: context.expectedProfit !== null && context.expectedProfit !== undefined ? (safeNumber(context.expectedProfit, 0) > 0 ? 85 : 30) : null }),
  ];

  const unknowns = scores.filter((row) => row.unknown).map((row) => row.dimension);
  const warnings = generateBuyBoxWarnings(canonical, context);
  if (safeNumber(canonical.rehabBudget, 0) > 100000) blockers.push({ type: "REHAB_HIGH", severity: "SOFT_FAIL", action: "Requires strong economics and manual review." });

  const result = calculateBuyBoxResult(scores, blockers, unknowns);
  const recommendation = generateBuyBoxRecommendation(canonical, result);

  return {
    ...result,
    market: marketInfo.market,
    marketStatus: marketInfo.priority,
    strategyFit: scores.find((row) => row.dimension === "strategyFit")?.score ?? null,
    rehabFit: scores.find((row) => row.dimension === "rehabFit")?.score ?? null,
    valuationFit: scores.find((row) => row.dimension === "arvSupport")?.score ?? null,
    financingFit: scores.find((row) => row.dimension === "dscr")?.score ?? null,
    rentalFit: scores.find((row) => row.dimension === "cashFlow")?.score ?? null,
    appreciationFit: safeNumber(context.appreciationPotentialScore, null),
    neighborhoodFit: safeNumber(context.neighborhoodScore, null),
    warningCount: warnings.length,
    criticalBlockerCount: blockers.length,
    decisionBlockingActions: blockers.map((entry) => entry.action),
    known: scores.filter((row) => !row.unknown).map((row) => `${row.dimension}:${row.score}`),
    uncertain: unknowns,
    needed: unknowns,
    recommendation,
    confidenceScore: result.confidenceScore,
    warnings,
    blockers,
    scoringDimensions: scores,
  };
}

function chooseMarketEvaluation(deal, context = {}) {
  const marketInfo = getBuyBoxZipMarket(deal.zipCode || deal.zip);
  if (marketInfo.market === "Covington") return evaluateCovingtonBuyBox(deal, context);
  if (marketInfo.market === "Cincinnati") return evaluateCincinnatiBuyBox(deal, context);

  const covington = evaluateCovingtonBuyBox(deal, context);
  const cincinnati = evaluateCincinnatiBuyBox(deal, context);
  return covington.score >= cincinnati.score ? covington : cincinnati;
}

function buildOfferPreview(dealCanonical, valuation, assumptions = {}) {
  const strategy = safeString(dealCanonical.strategy, "").toLowerCase();
  const isBrrrr = strategy.includes("brrrr") || strategy.includes("hold") || strategy.includes("rental");
  const output = isBrrrr ? calculateBrrrrOffer(dealCanonical, assumptions) : calculateFlipOffer(dealCanonical, assumptions);
  const preliminary = dealCanonical.approvedArv === null || dealCanonical.approvedArv === undefined;

  const valuationSource = preliminary ? "RECOMMENDED_ARV_PRELIMINARY" : "APPROVED_ARV";
  output.valuationSource = valuationSource;
  output.offerStatus = preliminary ? "PRELIMINARY_REVIEW_REQUIRED" : "ADVISORY_APPROVED_ARV";
  output.confidence = calculateOfferConfidence(dealCanonical, valuation, assumptions);
  return output;
}

function buildAppraiserPacketSupport(dealCanonical, valuation, approvedComps) {
  return {
    subjectPropertyFacts: {
      address: dealCanonical.address,
      city: dealCanonical.city,
      state: dealCanonical.state,
      zipCode: dealCanonical.zipCode,
      propertyType: dealCanonical.propertyType,
      bedrooms: dealCanonical.bedrooms,
      bathrooms: dealCanonical.bathrooms,
      squareFeet: dealCanonical.squareFeet,
      yearBuilt: dealCanonical.yearBuilt,
    },
    approvedArv: dealCanonical.approvedArv,
    recommendedArv: valuation.supportedArv,
    compSet: approvedComps.map((comp) => ({
      id: comp.id,
      address: comp.address,
      salePrice: comp.salePrice,
      saleDate: comp.saleDate,
      qualityScore: comp.qualityScore,
      inclusionStatus: comp.inclusionStatus,
      similarity: calculateCompSimilarity(dealCanonical, comp),
      sourceLink: safeString(comp.sourceRecord?.sourceLink || comp.sourceRecord?.sourceURL, ""),
      dataAsOf: comp.saleDate || null,
    })),
    lowBaseHighRange: {
      low: valuation.lowRange,
      base: valuation.baseRange,
      high: valuation.highRange,
    },
    confidenceScore: valuation.confidence?.score ?? 0,
    valuationWarnings: valuation.warnings,
    appraisalReviewStatus: valuation.valuationReviewStatus,
    sourceLinks: approvedComps.map((comp) => safeString(comp.sourceRecord?.sourceLink || comp.sourceRecord?.sourceURL, "")).filter(Boolean),
    dataAsOfDates: approvedComps.map((comp) => comp.saleDate).filter(Boolean),
  };
}

function calculateUnifiedDealOutputs(deal = {}, comps = [], neighborhoods = [], assumptions = {}) {
  const canonical = normalizeDealForValuation(deal);
  const compUniverse = buildSubjectCompUniverse(canonical, comps);
  const valuation = buildValuationRange(canonical, compUniverse.approved);
  const governance = buildValuationGovernance(deal, valuation);

  const effectiveArv = governance.approvedArv ?? valuation.supportedArv;
  const valuationContext = {
    ...valuation,
    supportedArv: effectiveArv,
  };

  const offer = buildOfferPreview({ ...canonical, approvedArv: governance.approvedArv, recommendedArv: valuation.supportedArv }, valuationContext, assumptions);
  const buyBox = chooseMarketEvaluation(canonical, {
    offer,
    baseArv: effectiveArv,
    arvConfidenceScore: valuation.confidence?.score ?? 0,
    expectedProfit: offer.expectedProfit,
    dscr: offer.dscr,
    monthlyCashFlow: offer.monthlyCashFlow,
    appreciationPotentialScore: safeNumber(neighborhoods?.[0]?.appreciation1Year, null),
    neighborhoodScore: safeNumber(neighborhoods?.[0]?.rentalDemandScore, null),
  });

  // Prevent high-confidence buy signal when valuation support is weak.
  const contradictoryRecommendations = [];
  if ((offer.expectedProfit || 0) > 0 && (valuation.confidence?.score || 0) < 55) {
    contradictoryRecommendations.push("High projected profit with weak ARV support.");
  }

  const decisionConfidence = Math.max(0, Math.min(100,
    Math.round(
      (valuation.confidence?.score || 0) * 0.35 +
      (offer.confidence?.score || 0) * 0.35 +
      (buyBox.confidenceScore || 0) * 0.3 -
      contradictoryRecommendations.length * 15,
    ),
  ));

  const investmentDecision = buyBox.result === "FAIL"
    ? "DO_NOT_BUY"
    : buyBox.result === "PASS" && decisionConfidence >= 70 && contradictoryRecommendations.length === 0
      ? "BUY"
      : "REVIEW_REQUIRED";

  const reviewRequired =
    valuation.valuationReviewStatus === "REVIEW_REQUIRED" ||
    buyBox.reviewRequired ||
    offer.offerStatus === "PRELIMINARY_REVIEW_REQUIRED" ||
    contradictoryRecommendations.length > 0;

  const appraisalPacketSupport = buildAppraiserPacketSupport(canonical, valuationContext, compUniverse.approved);
  const appraisalIntelligence = buildAppraisalIntelligenceResult(canonical, compUniverse.approved, {
    valuationResult: valuationContext,
  });

  return {
    canonical: canonical,
    compUniverse,
    valuation,
    governance,
    offer,
    buyBox,
    appraisalIntelligence,
    appraisalPacketSupport,
    contradictoryRecommendations,
    decisionConfidence,
    investmentDecision,
    reviewRequired,
  };
}

export function deriveUnifiedUnderwritingIntelligence(deal = {}, comps = [], neighborhoods = [], assumptions = {}) {
  return calculateUnifiedDealOutputs(deal, comps, neighborhoods, assumptions);
}

function mergeAuditMetadata(deal = {}, updates = {}) {
  const current = deal.auditMetadata && typeof deal.auditMetadata === "object" ? deal.auditMetadata : {};
  return {
    ...current,
    ...updates,
  };
}

export function createValuationOfferBuyBoxService(options = {}) {
  const readDeals = options.readDeals;
  const writeDeals = options.writeDeals;
  const readComps = options.readComps;
  const readNeighborhoods = options.readNeighborhoods;
  const readAudit = options.readAudit;
  const writeAudit = options.writeAudit;

  if (!readDeals || !writeDeals || !readComps || !readNeighborhoods || !readAudit || !writeAudit) {
    throw new Error("createValuationOfferBuyBoxService requires read/write handlers for deals, comps, neighborhoods, and audit");
  }

  async function appendAudit(action, payload = {}) {
    const auditEvents = await readAudit();
    const event = sanitizeAudit({
      id: createId("underwriting-audit"),
      timestamp: nowIso(),
      action,
      actor: safeString(payload.actor, "System Administrator"),
      dealId: safeString(payload.dealId, ""),
      approvalState: safeString(payload.approvalState, "REVIEW_REQUIRED"),
      metadata: payload.metadata || {},
    });
    auditEvents.push(event);
    await writeAudit(auditEvents);
    return event;
  }

  async function getDealAndContext(dealId) {
    const [deals, comps, neighborhoods] = await Promise.all([readDeals(), readComps(), readNeighborhoods()]);
    const deal = safeArray(deals).find((entry) => safeString(entry.id) === safeString(dealId));
    return { deal, deals: safeArray(deals), comps: safeArray(comps), neighborhoods: safeArray(neighborhoods) };
  }

  async function previewArvRecommendation(dealId) {
    const { deal, comps } = await getDealAndContext(dealId);
    if (!deal) {
      await appendAudit("valuation preview generated", { dealId, approvalState: "BLOCKED", metadata: { status: "DEAL_NOT_FOUND" } });
      return { ok: false, status: "DEAL_NOT_FOUND" };
    }

    const outputs = calculateUnifiedDealOutputs(deal, comps, []);

    await appendAudit("valuation preview generated", {
      dealId,
      metadata: {
        compCountUsed: outputs.valuation.compCountUsed,
        warningCount: outputs.valuation.warningCount,
        reviewStatus: outputs.valuation.valuationReviewStatus,
      },
    });

    if (outputs.compUniverse.pendingCount > 0) {
      await appendAudit("blocker created", {
        dealId,
        metadata: { reason: "PENDING_OR_UNAPPROVED_COMPS", pendingCount: outputs.compUniverse.pendingCount },
      });
    }
    if (outputs.compUniverse.rejectedCount > 0) {
      await appendAudit("comp excluded", {
        dealId,
        metadata: { rejectedCount: outputs.compUniverse.rejectedCount },
      });
    }

    return {
      ok: true,
      status: outputs.valuation.valuationReviewStatus,
      reviewRequired: outputs.reviewRequired,
      conservativeArv: outputs.valuation.conservativeArv,
      expectedArv: outputs.valuation.expectedArv,
      aggressiveArv: outputs.valuation.aggressiveArv,
      supportedArv: outputs.valuation.supportedArv,
      confidence: outputs.valuation.confidence,
      qualityGrade: outputs.valuation.qualityGrade,
      strongestComp: outputs.valuation.strongestComp,
      compCountUsed: outputs.valuation.compCountUsed,
      compCountExcluded: outputs.compUniverse.rejectedCount + outputs.valuation.compCountExcluded,
      warningCount: outputs.valuation.warningCount,
      valuationReviewStatus: outputs.valuation.valuationReviewStatus,
      assumptions: outputs.valuation.assumptions,
      unknowns: outputs.valuation.unknowns,
      warnings: outputs.valuation.warnings,
      governance: outputs.governance,
      lowBaseHighRange: {
        low: outputs.valuation.lowRange,
        base: outputs.valuation.baseRange,
        high: outputs.valuation.highRange,
      },
    };
  }

  async function approveArvRecommendation(dealId, selectedValue, userApproval, actor = "System Administrator") {
    if (userApproval !== true) {
      await appendAudit("ARV approval requested", { dealId, actor, approvalState: "DENIED", metadata: { reason: "EXPLICIT_APPROVAL_REQUIRED" } });
      return { ok: false, status: "EXPLICIT_APPROVAL_REQUIRED" };
    }

    const { deal, deals, comps } = await getDealAndContext(dealId);
    if (!deal) return { ok: false, status: "DEAL_NOT_FOUND" };

    const outputs = calculateUnifiedDealOutputs(deal, comps, []);
    const nextApproved = safeNumber(selectedValue, null) ?? outputs.valuation.supportedArv;
    if (nextApproved === null) {
      await appendAudit("ARV rejected", { dealId, actor, approvalState: "REVIEW_REQUIRED", metadata: { reason: "NO_RECOMMENDED_ARV" } });
      return { ok: false, status: "NO_RECOMMENDED_ARV" };
    }

    const currentGovernance = buildValuationGovernance(deal, outputs.valuation);
    const previousApproved = currentGovernance.approvedArv;

    const nextDeal = {
      ...deal,
      approvedArv: nextApproved,
      supportedARV: nextApproved,
      estimatedArv: nextApproved,
      protectedFields: Array.from(new Set([...(Array.isArray(deal.protectedFields) ? deal.protectedFields : []), "approvedArv", "supportedARV"])),
      auditMetadata: mergeAuditMetadata(deal, {
        valuationGovernance: {
          ...currentGovernance,
          recommendedArv: outputs.valuation.supportedArv,
          reviewedArv: outputs.valuation.expectedArv,
          approvedArv: nextApproved,
          protectedArv: nextApproved,
          previousApprovedArv: previousApproved,
          approvalTimestamp: nowIso(),
          approvalActor: actor,
          approvalEvidenceSummary: `Comp set used: ${outputs.valuation.compCountUsed}. Confidence: ${outputs.valuation.confidence.score}.`,
          compSetVersion: outputs.valuation.compSetVersion,
          valuationVersion: outputs.valuation.valuationVersion,
        },
      }),
      updatedAt: nowIso(),
    };

    const nextDeals = deals.map((entry) => (safeString(entry.id) === safeString(dealId) ? canonicalToDeal(nextDeal) : entry));
    await writeDeals(nextDeals);

    await appendAudit("ARV approval requested", { dealId, actor, approvalState: "APPROVED" });
    await appendAudit("ARV approved", {
      dealId,
      actor,
      approvalState: "APPROVED",
      metadata: {
        previousApprovedArv: previousApproved,
        approvedArv: nextApproved,
        compSetVersion: outputs.valuation.compSetVersion,
      },
    });
    if (previousApproved !== null && previousApproved !== nextApproved) {
      await appendAudit("valuation recommendation changed", {
        dealId,
        actor,
        metadata: { previousApprovedArv: previousApproved, nextApprovedArv: nextApproved },
      });
    }

    return {
      ok: true,
      status: "ARV_APPROVED",
      approvedArv: nextApproved,
      previousApprovedArv: previousApproved,
      governance: nextDeal.auditMetadata.valuationGovernance,
    };
  }

  async function getArvAuditHistory(dealId) {
    const auditEvents = await readAudit();
    return safeArray(auditEvents).filter((entry) => safeString(entry.dealId) === safeString(dealId) && /valuation|ARV|comp/i.test(safeString(entry.action))).sort((a, b) => safeString(b.timestamp).localeCompare(safeString(a.timestamp)));
  }

  async function previewOfferRecommendation(dealId, assumptions = {}) {
    const { deal, comps, neighborhoods } = await getDealAndContext(dealId);
    if (!deal) return { ok: false, status: "DEAL_NOT_FOUND" };

    const outputs = calculateUnifiedDealOutputs(deal, comps, neighborhoods, assumptions);
    const offer = outputs.offer;
    await appendAudit("offer preview generated", { dealId, metadata: { strategy: offer.strategy, valuationSource: offer.valuationSource, confidence: offer.confidence.score } });

    return {
      ok: true,
      status: offer.offerStatus,
      reviewRequired: outputs.reviewRequired,
      valuationSource: offer.valuationSource,
      offer: offer,
      governance: outputs.governance,
    };
  }

  async function approveOfferGuidance(dealId, userApproval, actor = "System Administrator") {
    if (userApproval !== true) {
      await appendAudit("offer guidance approved", { dealId, actor, approvalState: "DENIED", metadata: { reason: "EXPLICIT_APPROVAL_REQUIRED" } });
      return { ok: false, status: "EXPLICIT_APPROVAL_REQUIRED" };
    }

    const { deal, deals, comps, neighborhoods } = await getDealAndContext(dealId);
    if (!deal) return { ok: false, status: "DEAL_NOT_FOUND" };

    const outputs = calculateUnifiedDealOutputs(deal, comps, neighborhoods, {});
    const nextDeal = {
      ...deal,
      auditMetadata: mergeAuditMetadata(deal, {
        offerGovernance: {
          approvedAt: nowIso(),
          approvedBy: actor,
          calculationVersion: "upload2-v1",
          assumptionsVersion: "user-default",
          approvedOfferStatus: outputs.offer.offerStatus,
          valuationSource: outputs.offer.valuationSource,
        },
      }),
      updatedAt: nowIso(),
    };

    const nextDeals = deals.map((entry) => (safeString(entry.id) === safeString(dealId) ? canonicalToDeal(nextDeal) : entry));
    await writeDeals(nextDeals);

    await appendAudit("offer assumptions changed", { dealId, actor, metadata: { valuationSource: outputs.offer.valuationSource } });
    await appendAudit("offer guidance approved", { dealId, actor, approvalState: "APPROVED", metadata: { confidence: outputs.offer.confidence.score } });

    return { ok: true, status: "OFFER_GUIDANCE_APPROVED" };
  }

  async function getOfferAuditHistory(dealId) {
    const auditEvents = await readAudit();
    return safeArray(auditEvents).filter((entry) => safeString(entry.dealId) === safeString(dealId) && /offer/i.test(safeString(entry.action))).sort((a, b) => safeString(b.timestamp).localeCompare(safeString(a.timestamp)));
  }

  async function previewBuyBoxEvaluation(dealId) {
    const { deal, comps, neighborhoods } = await getDealAndContext(dealId);
    if (!deal) return { ok: false, status: "DEAL_NOT_FOUND" };

    const outputs = calculateUnifiedDealOutputs(deal, comps, neighborhoods, {});
    await appendAudit("buy-box evaluation generated", { dealId, metadata: { result: outputs.buyBox.result, score: outputs.buyBox.score } });

    if (outputs.buyBox.criticalBlockerCount > 0) {
      await appendAudit("blocker created", { dealId, metadata: { blockers: outputs.buyBox.blockers } });
    }

    return {
      ok: true,
      status: outputs.buyBox.result,
      reviewRequired: outputs.buyBox.reviewRequired,
      evaluation: outputs.buyBox,
      valuationReviewStatus: outputs.valuation.valuationReviewStatus,
      contradictoryRecommendations: outputs.contradictoryRecommendations,
    };
  }

  async function approveBuyBoxReview(dealId, userApproval, actor = "System Administrator") {
    if (userApproval !== true) {
      await appendAudit("buy-box review approved", { dealId, actor, approvalState: "DENIED", metadata: { reason: "EXPLICIT_APPROVAL_REQUIRED" } });
      return { ok: false, status: "EXPLICIT_APPROVAL_REQUIRED" };
    }

    const { deal, deals, comps, neighborhoods } = await getDealAndContext(dealId);
    if (!deal) return { ok: false, status: "DEAL_NOT_FOUND" };

    const outputs = calculateUnifiedDealOutputs(deal, comps, neighborhoods, {});
    const nextDeal = {
      ...deal,
      auditMetadata: mergeAuditMetadata(deal, {
        buyBoxGovernance: {
          approvedAt: nowIso(),
          approvedBy: actor,
          result: outputs.buyBox.result,
          score: outputs.buyBox.score,
          confidenceScore: outputs.buyBox.confidenceScore,
          blockers: outputs.buyBox.blockers,
        },
      }),
      updatedAt: nowIso(),
    };
    const nextDeals = deals.map((entry) => (safeString(entry.id) === safeString(dealId) ? canonicalToDeal(nextDeal) : entry));
    await writeDeals(nextDeals);

    await appendAudit("buy-box review approved", {
      dealId,
      actor,
      approvalState: "APPROVED",
      metadata: { result: outputs.buyBox.result, confidence: outputs.buyBox.confidenceScore },
    });

    if (outputs.buyBox.criticalBlockerCount === 0) {
      await appendAudit("blocker resolved", {
        dealId,
        actor,
        metadata: { reason: "No unresolved hard blockers remain." },
      });
    }

    return { ok: true, status: "BUY_BOX_REVIEW_APPROVED", result: outputs.buyBox.result };
  }

  async function getUnifiedIntelligenceSnapshot(dealId) {
    const { deal, comps, neighborhoods } = await getDealAndContext(dealId);
    if (!deal) return { ok: false, status: "DEAL_NOT_FOUND" };
    const outputs = calculateUnifiedDealOutputs(deal, comps, neighborhoods, {});
    await appendAudit("downstream recalculation completed", { dealId, metadata: { reviewRequired: outputs.reviewRequired, decisionConfidence: outputs.decisionConfidence } });

    return {
      ok: true,
      reviewRequired: outputs.reviewRequired,
      valuation: outputs.valuation,
      valuationGovernance: outputs.governance,
      offer: outputs.offer,
      buyBox: outputs.buyBox,
      appraisalPacketSupport: outputs.appraisalPacketSupport,
      contradictoryRecommendations: outputs.contradictoryRecommendations,
      decisionConfidence: outputs.decisionConfidence,
      investmentDecision: outputs.investmentDecision,
    };
  }

  async function getAppraiserPacketSupport(dealId) {
    const snapshot = await getUnifiedIntelligenceSnapshot(dealId);
    if (!snapshot.ok) return snapshot;
    return {
      ok: true,
      dealId,
      ...snapshot.appraisalPacketSupport,
    };
  }

  async function rollbackLatestApproval(dealId, actor = "System Administrator") {
    const deals = await readDeals();
    const deal = safeArray(deals).find((entry) => safeString(entry.id) === safeString(dealId));
    if (!deal) return { ok: false, status: "DEAL_NOT_FOUND" };

    const valuationGov = deal.auditMetadata?.valuationGovernance || {};
    const previousApprovedArv = safeNumber(valuationGov.previousApprovedArv, null);
    if (previousApprovedArv === null) return { ok: false, status: "NO_PREVIOUS_APPROVED_ARV" };

    const nextDeal = {
      ...deal,
      approvedArv: previousApprovedArv,
      supportedARV: previousApprovedArv,
      estimatedArv: previousApprovedArv,
      auditMetadata: mergeAuditMetadata(deal, {
        valuationGovernance: {
          ...valuationGov,
          approvedArv: previousApprovedArv,
          protectedArv: previousApprovedArv,
          approvalTimestamp: nowIso(),
          approvalActor: actor,
        },
      }),
      updatedAt: nowIso(),
    };

    const nextDeals = deals.map((entry) => (safeString(entry.id) === safeString(dealId) ? canonicalToDeal(nextDeal) : entry));
    await writeDeals(nextDeals);

    await appendAudit("rollback performed", { dealId, actor, approvalState: "APPROVED", metadata: { restoredApprovedArv: previousApprovedArv } });
    return { ok: true, status: "ROLLED_BACK", approvedArv: previousApprovedArv };
  }

  async function listAuditEvents(dealId = "") {
    const audit = await readAudit();
    if (!dealId) return audit;
    return safeArray(audit).filter((entry) => safeString(entry.dealId) === safeString(dealId));
  }

  return {
    calculateCompSimilarity,
    calculateCompWeight,
    detectCompOutlier,
    buildValuationRange,
    calculateArvConfidence,
    generateValuationWarnings,
    previewArvRecommendation,
    approveArvRecommendation,
    getArvAuditHistory,
    calculateFlipOffer,
    calculateBrrrrOffer,
    calculateMao,
    calculateTargetOffer,
    calculateWalkAwayPrice,
    calculateBreakEvenThresholds,
    calculateOfferConfidence,
    previewOfferRecommendation,
    approveOfferGuidance,
    getOfferAuditHistory,
    evaluateCovingtonBuyBox,
    evaluateCincinnatiBuyBox,
    scoreBuyBoxDimension,
    calculateBuyBoxResult,
    generateBuyBoxWarnings,
    generateBuyBoxRecommendation,
    previewBuyBoxEvaluation,
    approveBuyBoxReview,
    getUnifiedIntelligenceSnapshot,
    getAppraiserPacketSupport,
    rollbackLatestApproval,
    listAuditEvents,
  };
}

export {
  calculateBuyBoxResult,
  generateBuyBoxWarnings,
  generateBuyBoxRecommendation,
};
