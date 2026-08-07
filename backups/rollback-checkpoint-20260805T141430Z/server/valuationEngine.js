import { buildNormalizedCompRecord } from "./compProviderEngine.js";

const defaultSimilarityWeights = {
  propertyType: 0.12,
  distance: 0.16,
  saleRecency: 0.1,
  squareFootage: 0.14,
  bedrooms: 0.08,
  bathrooms: 0.08,
  yearBuilt: 0.08,
  lotSize: 0.06,
  garage: 0.04,
  basement: 0.04,
  stories: 0.04,
  condition: 0.06,
  renovationLevel: 0.04,
  sourceQuality: 0.06,
  verificationQuality: 0.08,
};

function normalizeNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function buildCanonicalValuationEngine({ subjectProperty = {}, comps = [] } = {}) {
  return {
    valuationId: `valuation-${Date.now()}`,
    propertyId: subjectProperty.id || "",
    compSetVersion: "draft-1",
    formulaVersion: "phase4-batch1-v1",
    scoringVersion: "phase4-batch1-v1",
    adjustmentVersion: "phase4-batch1-v1",
    reconciliationVersion: "phase4-batch1-v1",
    valuationDate: new Date().toISOString(),
    effectiveDate: new Date().toISOString(),
    subjectProperty,
    comps: comps.map((comp) => ({
      ...comp,
      eligibility: evaluateCompEligibility(comp, subjectProperty),
      similarity: buildSimilarityScores(comp, subjectProperty),
      adjustments: buildAdjustmentModel(comp, subjectProperty, { adjustments: [] }),
      adjustedValue: calculateAdjustedCompValue(comp, subjectProperty, { adjustments: [] }).adjustedValue,
    })),
    proposedArv: null,
    approvedArv: null,
    lowArv: null,
    likelyArv: null,
    highArv: null,
    supportedArv: null,
    activeArvBefore: null,
    activeArvAfter: null,
    confidence: null,
    approvedComps: [],
    excludedComps: [],
    adjustmentSummary: [],
    methodSummary: [],
    redTeamSummary: null,
    warnings: [],
    fragileAssumptions: [],
    decisionBreakingThreshold: null,
    preparedBy: "RSOS",
    approvedBy: "",
    approvalDate: "",
    overrideReason: "",
    sourceSnapshots: [],
    mediaReferences: [],
    auditReferences: [],
  };
}

function evaluateCompEligibility(comp = {}, subjectProperty = {}) {
  const armsLength = normalizeText(comp.armsLengthStatus || "");
  const status = normalizeText(comp.status || "closed");
  const verified = Boolean(comp.verified);
  const providerImported = Boolean(comp.providerImported);
  const inclusionStatus = normalizeText(comp.inclusionStatus || "pending");
  const propertyType = normalizeText(comp.propertyType || subjectProperty.propertyType || "Single Family");
  const hasMinimumData = Boolean(comp.salePrice && comp.saleDate && comp.squareFeet && comp.bedrooms && comp.bathrooms);
  const hasExcludedFlag = Boolean(armsLength && !["armslength", "arms-length", "unknown"].includes(armsLength.toLowerCase()));
  const isActiveListing = ["listing", "active", "pending"].includes(status.toLowerCase());
  const eligible = hasMinimumData && !isActiveListing && !hasExcludedFlag && (status.toLowerCase() === "closed" || status.toLowerCase() === "sold");
  const classification = classifyEligibility({ eligible, armsLength, status, verified, providerImported, inclusionStatus, propertyType });
  const exclusionReason = classification === "Exclude" ? deriveExclusionReason({ armsLength, status, verified, providerImported, inclusionStatus }) : "";
  const warningFlags = [];
  if (!verified) warningFlags.push("unverified sale");
  if (hasExcludedFlag) warningFlags.push("non-arm's-length transfer");
  if (!comp.squareFeet || !comp.bedrooms || !comp.bathrooms) warningFlags.push("incomplete data");
  return {
    eligible,
    classification,
    eligibilityScore: Math.round((eligible ? 0.7 : 0.2) * 100) / 100,
    exclusionRecommendation: classification === "Exclude" ? "exclude" : "include",
    exclusionReason,
    warningFlags,
    expandedSearchStatus: "not-needed",
    sourceQualityRating: getSourceQualityRating(comp),
    dataCompletenessRating: getDataCompletenessRating(comp),
    formulaVersion: "phase4-batch1-v1",
    version: 1,
  };
}

function classifyEligibility({ eligible, armsLength, status, verified, providerImported, inclusionStatus, propertyType }) {
  if (inclusionStatus === "excluded") return "Exclude";
  if (status === "listing" || status === "active" || status === "pending") return "Review Required";
  if (armsLength && !["armslength", "arms-length", "unknown"].includes(armsLength.toLowerCase())) return "Exclude";
  if (!eligible) return "Insufficient Data";
  if (status === "closed" && verified) return "Primary Comp Candidate";
  if (status === "closed") return "Supporting Comp Candidate";
  if (providerImported) return "Review Required";
  return "Supporting Comp Candidate";
}

function deriveExclusionReason({ armsLength, status, verified, providerImported, inclusionStatus }) {
  if (inclusionStatus === "excluded") return "User excluded";
  if (armsLength && !["armslength", "arms-length", "unknown"].includes(armsLength.toLowerCase())) {
    if (armsLength.toLowerCase().includes("family")) return "Family transfer";
    if (armsLength.toLowerCase().includes("nominal")) return "Nominal transfer";
    if (armsLength.toLowerCase().includes("foreclosure") || armsLength.toLowerCase().includes("sheriff")) return "Foreclosure or sheriff sale";
    return "Non-arm's-length transfer";
  }
  if (status === "listing" || status === "active" || status === "pending") return "Active or pending listing is market evidence only";
  if (providerImported && !verified) return "Imported comp requires verification";
  return "Insufficient evidence";
}

function buildSimilarityScores(comp = {}, subjectProperty = {}) {
  const componentScores = {
    distanceScore: computeDistanceScore(comp.distanceMiles),
    recencyScore: computeRecencyScore(comp.saleDate),
    sizeScore: computeSizeScore(comp.squareFeet, subjectProperty.squareFeet),
    bedroomScore: computeDifferenceScore(comp.bedrooms, subjectProperty.bedrooms),
    bathroomScore: computeDifferenceScore(comp.bathrooms, subjectProperty.bathrooms),
    ageScore: computeDifferenceScore(comp.yearBuilt, subjectProperty.yearBuilt),
    lotScore: computeLotScore(comp.lotSize, subjectProperty.lotSize),
    featureScore: computeFeatureScore(comp, subjectProperty),
    conditionScore: computeConditionScore(comp.condition, subjectProperty.condition),
    sourceScore: getSourceQualityRating(comp),
    completenessScore: getDataCompletenessRating(comp),
  };
  const totalScore = Object.entries(defaultSimilarityWeights).reduce((acc, [key, weight]) => {
    const value = componentScoreValue(key, componentScores);
    return acc + value * weight;
  }, 0);
  const label = getSimilarityLabel(totalScore);
  return {
    formulaVersion: "phase4-batch1-v1",
    totalScore: Math.round(totalScore * 100) / 100,
    componentScores,
    label,
    version: 1,
  };
}

function componentScoreValue(key, componentScores) {
  const map = {
    propertyType: 0.8,
    distance: componentScores.distanceScore,
    saleRecency: componentScores.recencyScore,
    squareFootage: componentScores.sizeScore,
    bedrooms: componentScores.bedroomScore,
    bathrooms: componentScores.bathroomScore,
    yearBuilt: componentScores.ageScore,
    lotSize: componentScores.lotScore,
    garage: componentScores.featureScore,
    basement: componentScores.featureScore,
    stories: componentScores.featureScore,
    condition: componentScores.conditionScore,
    renovationLevel: componentScores.conditionScore,
    sourceQuality: componentScores.sourceScore,
    verificationQuality: componentScores.sourceScore,
  };
  return map[key] ?? 0.5;
}

function computeDistanceScore(distanceMiles) {
  const distance = normalizeNumber(distanceMiles);
  if (!distance) return 0.6;
  return clamp(1 - distance / 10, 0.1, 1);
}

function computeRecencyScore(saleDate) {
  if (!saleDate) return 0.5;
  const date = new Date(saleDate);
  if (Number.isNaN(date.getTime())) return 0.5;
  const ageDays = Math.max(0, (Date.now() - date.getTime()) / (1000 * 60 * 60 * 24));
  const ageMonths = ageDays / 30;
  return clamp(1 - ageMonths / 24, 0.1, 1);
}

function computeSizeScore(squareFeet, subjectSquareFeet) {
  const compSize = normalizeNumber(squareFeet);
  const subjectSize = normalizeNumber(subjectSquareFeet);
  if (!compSize || !subjectSize) return 0.6;
  const delta = Math.abs(compSize - subjectSize) / Math.max(subjectSize, 1);
  return clamp(1 - delta / 0.4, 0.1, 1);
}

function computeDifferenceScore(value, subjectValue) {
  const compValue = normalizeNumber(value);
  const subject = normalizeNumber(subjectValue);
  if (!compValue || !subject) return 0.6;
  const delta = Math.abs(compValue - subject);
  return clamp(1 - delta / Math.max(subject, 1), 0.1, 1);
}

function computeLotScore(compLot, subjectLot) {
  if (!compLot || !subjectLot) return 0.6;
  return clamp(0.8, 0.1, 1);
}

function computeFeatureScore(comp = {}, subjectProperty = {}) {
  return 0.7;
}

function computeConditionScore(compCondition, subjectCondition) {
  if (!compCondition || !subjectCondition) return 0.6;
  return 0.7;
}

function getSourceQualityRating(comp = {}) {
  if (comp.providerImported) return 0.7;
  if (comp.manuallyEntered) return 0.8;
  return 0.6;
}

function getDataCompletenessRating(comp = {}) {
  const completed = [comp.salePrice, comp.squareFeet, comp.bedrooms, comp.bathrooms, comp.saleDate, comp.distanceMiles].filter((value) => value !== "" && value !== undefined && value !== null).length;
  return clamp(completed / 6, 0.1, 1);
}

function normalizeText(value) {
  return value === undefined || value === null ? "" : String(value).trim();
}

function getSimilarityLabel(totalScore) {
  if (totalScore >= 0.8) return "Excellent Match";
  if (totalScore >= 0.65) return "Strong Match";
  if (totalScore >= 0.5) return "Moderate Match";
  if (totalScore >= 0.35) return "Weak Match";
  return "Poor Match";
}

function buildAdjustmentModel(comp = {}, subjectProperty = {}, { adjustments = [] } = {}) {
  const normalized = adjustments.map((entry) => ({
    category: normalizeText(entry.category),
    subjectValue: normalizeNumber(entry.subjectValue),
    compValue: normalizeNumber(entry.compValue),
    direction: normalizeText(entry.direction),
    rawDifference: normalizeNumber(entry.rawDifference),
    adjustmentBasis: normalizeText(entry.adjustmentBasis),
    adjustmentMethod: normalizeText(entry.adjustmentMethod || entry.method),
    adjustmentAmount: normalizeNumber(entry.adjustmentAmount ?? entry.amount),
    confidence: normalizeNumber(entry.confidence),
    source: normalizeText(entry.source),
    evidence: normalizeText(entry.evidence),
    formulaVersion: normalizeText(entry.formulaVersion || "phase4-batch1-v1"),
    approved: Boolean(entry.approved),
    notes: normalizeText(entry.notes),
  }));
  return normalized;
}

function validateAdjustments(adjustments = []) {
  const supported = adjustments.filter((entry) => entry.adjustmentMethod && entry.adjustmentMethod !== "unsupported / review required");
  const issues = [];
  let doubleCountPrevented = false;
  const categories = new Set();
  const categoryGroups = {
    size: new Set(["square-footage", "bedroom", "bathroom"]),
    condition: new Set(["condition", "renovation"]),
  };
  for (const entry of adjustments) {
    if (!entry.adjustmentMethod || entry.adjustmentMethod === "unsupported / review required") {
      issues.push("unsupported adjustment");
      continue;
    }
    const category = normalizeText(entry.category);
    if (category && categories.has(category)) {
      issues.push(`duplicate adjustment: ${category}`);
      doubleCountPrevented = true;
      continue;
    }
    let overlappingGroup = null;
    for (const [groupName, group] of Object.entries(categoryGroups)) {
      if (group.has(category)) {
        overlappingGroup = group;
        break;
      }
    }
    if (overlappingGroup && Array.from(categories).some((existing) => overlappingGroup.has(existing))) {
      issues.push(`double-count prevention: ${category}`);
      doubleCountPrevented = true;
      continue;
    }
    categories.add(category);
    if (!entry.notes && entry.approved) issues.push(`missing notes: ${category}`);
  }
  return {
    supportedAdjustmentCount: supported.length,
    issues,
    doubleCountPrevented,
    approvedAdjustmentCount: adjustments.filter((entry) => entry.approved).length,
    formulaVersion: "phase4-batch1-v1",
  };
}

function calculateAdjustedCompValue(comp = {}, subjectProperty = {}, { adjustments = [] } = {}) {
  const normalized = buildAdjustmentModel(comp, subjectProperty, { adjustments });
  const validation = validateAdjustments(normalized);
  const approvedAdjustments = normalized.filter((entry) => entry.approved && !validation.issues.some((issue) => issue.includes("unsupported")));
  const baseValue = normalizeNumber(comp.salePrice || 0);
  const adjustmentAmount = approvedAdjustments.reduce((total, entry) => total + normalizeNumber(entry.adjustmentAmount), 0);
  const adjustedValue = Math.max(0, baseValue + adjustmentAmount);
  const grossAdjustmentPct = baseValue > 0 ? (approvedAdjustments.reduce((total, entry) => total + Math.abs(normalizeNumber(entry.adjustmentAmount)), 0) / baseValue) * 100 : 0;
  let weightingReason = "standard";
  if (grossAdjustmentPct > 15) weightingReason = "heavily-adjusted";
  const finalWeight = clamp(1 - grossAdjustmentPct / 100 * 0.3, 0.1, 1);
  return {
    originalSalePrice: baseValue,
    adjustmentAmount,
    adjustedValue,
    grossAdjustmentPct: Math.round(grossAdjustmentPct * 10) / 10,
    finalWeight: Math.round(finalWeight * 1000) / 1000,
    weightingReason,
    approvedAdjustments: approvedAdjustments.length > 0,
    validation,
  };
}

function buildMultiMethodValuation({ subjectProperty = {}, comps = [] } = {}) {
  const weightedAdjustedSalePrice = comps.reduce((sum, comp) => sum + normalizeNumber(comp.adjustedValue || 0) * normalizeNumber(comp.finalWeight || 0.5), 0) / Math.max(1, comps.reduce((sum, comp) => sum + normalizeNumber(comp.finalWeight || 0.5), 0));
  const weightedPricePerSqft = comps.reduce((sum, comp) => sum + ((normalizeNumber(comp.salePrice || 0) / Math.max(normalizeNumber(comp.squareFeet || 1), 1)) * normalizeNumber(comp.finalWeight || 0.5)), 0) / Math.max(1, comps.reduce((sum, comp) => sum + normalizeNumber(comp.finalWeight || 0.5), 0));
  const median = comps.length > 0 ? comps.map((comp) => normalizeNumber(comp.adjustedValue || 0)).sort((a, b) => a - b)[Math.floor(comps.length / 2)] : 0;
  const trimmedMean = comps.length > 2 ? comps.map((comp) => normalizeNumber(comp.adjustedValue || 0)).slice(1, -1).reduce((sum, value) => sum + value, 0) / Math.max(1, comps.length - 2) : weightedAdjustedSalePrice;
  const lowArv = Math.min(weightedAdjustedSalePrice, weightedPricePerSqft * normalizeNumber(subjectProperty.squareFeet || 1), median, trimmedMean);
  const highArv = Math.max(weightedAdjustedSalePrice, weightedPricePerSqft * normalizeNumber(subjectProperty.squareFeet || 1), median, trimmedMean);
  const likelyArv = (lowArv + highArv) / 2;
  return {
    methods: [
      {
        method: "weighted-adjusted-sale-price",
        result: weightedAdjustedSalePrice,
        compCount: comps.length,
        weighting: "weighted-by-adjustment-quality",
        confidence: 0.8,
        warnings: [],
        formulaVersion: "phase4-batch1-v1",
      },
      {
        method: "weighted-adjusted-price-per-square-foot",
        result: weightedPricePerSqft * normalizeNumber(subjectProperty.squareFeet || 1),
        compCount: comps.length,
        weighting: "weighted-by-adjustment-quality",
        confidence: 0.75,
        warnings: [],
        formulaVersion: "phase4-batch1-v1",
      },
      {
        method: "median-approved-comp",
        result: median,
        compCount: comps.length,
        weighting: "median",
        confidence: 0.7,
        warnings: [],
        formulaVersion: "phase4-batch1-v1",
      },
      {
        method: "trimmed-mean",
        result: trimmedMean,
        compCount: comps.length,
        weighting: "trimmed-mean",
        confidence: 0.7,
        warnings: [],
        formulaVersion: "phase4-batch1-v1",
      },
    ],
    reconciledLowArv: lowArv,
    reconciledHighArv: highArv,
    reconciledLikelyArv: likelyArv,
    recommendedSupportedArv: likelyArv,
    lowArv,
    highArv,
    likelyArv,
    reconciliation: {
      selectedMethod: "weighted-adjusted-sale-price",
      lowArv,
      highArv,
      reconciledLowArv: lowArv,
      reconciledHighArv: highArv,
      reconciledLikelyArv: likelyArv,
      recommendedSupportedArv: likelyArv,
      methodSpread: highArv - lowArv,
      methodDisagreementWarning: highArv - lowArv > 20000 ? "method spread is wide" : "",
      formulaVersion: "phase4-batch1-v1",
    },
  };
}

function buildArvConfidence({ approvedCompCount = 0, sourceConflicts = false, methodSpread = 0, grossAdjustmentPct = 0, adjustmentConfidence = 0.8 } = {}) {
  let score = 50;
  if (approvedCompCount >= 3) score += 15;
  else if (approvedCompCount === 2) score += 8;
  else if (approvedCompCount === 1) score += 2;
  if (sourceConflicts) score -= 12;
  if (methodSpread > 20000) score -= 12;
  if (grossAdjustmentPct > 15) score -= 10;
  score = clamp(score, 10, 100);
  let classification = "Preliminary";
  if (score >= 80) classification = "High";
  else if (score >= 55) classification = "Moderate";
  else if (score >= 40) classification = "Preliminary";
  else classification = "Low";
  return {
    score,
    classification,
    explanation: "Confidence is derived from comp count, adjustment magnitude, and reconciliation spread.",
    strengths: [],
    weaknesses: [],
    missingEvidence: [],
    confidenceImprovementActions: [],
    fragileAssumptions: [],
    decisionBreakingThreshold: 0,
    formulaVersion: "phase4-batch1-v1",
  };
}

function buildRedTeamReview({ baseArv = 0, conservativeArv = 0, aggressiveArv = 0, decisionBreakingArv = 0 } = {}) {
  return {
    baseArv,
    conservativeArv,
    aggressiveArv,
    sensitivityRange: aggressiveArv - conservativeArv,
    compDependenceRisk: "moderate",
    outlierDependence: "moderate",
    adjustmentDependence: "moderate",
    sourceDependence: "moderate",
    downsideImpactOnProfit: 0,
    downsideImpactOnRoi: 0,
    downsideImpactOnOffer: 0,
    recommendationStability: "stable",
    decisionBreakingArv: decisionBreakingArv,
  };
}

function createValuationVersion({ valuation = {}, redTeam = {}, approvedArv = null, proposedArv = null } = {}) {
  return {
    versionId: `valuation-${Date.now()}`,
    valuationId: valuation.valuationId || "",
    propertyId: valuation.propertyId || "",
    compSetVersion: valuation.compSetVersion || "draft-1",
    formulaVersion: valuation.formulaVersion || "phase4-batch1-v1",
    scoringVersion: valuation.scoringVersion || "phase4-batch1-v1",
    adjustmentVersion: valuation.adjustmentVersion || "phase4-batch1-v1",
    reconciliationVersion: valuation.reconciliationVersion || "phase4-batch1-v1",
    valuationDate: valuation.valuationDate || new Date().toISOString(),
    effectiveDate: valuation.effectiveDate || new Date().toISOString(),
    lowArv: valuation.lowArv || null,
    likelyArv: valuation.likelyArv || null,
    highArv: valuation.highArv || null,
    supportedArv: valuation.supportedArv || null,
    approvedArv: approvedArv != null ? approvedArv : valuation.approvedArv || null,
    proposedArv: proposedArv != null ? proposedArv : valuation.proposedArv || null,
    confidence: valuation.confidence || null,
    approvedComps: valuation.approvedComps || [],
    excludedComps: valuation.excludedComps || [],
    adjustmentSummary: valuation.adjustmentSummary || [],
    methodSummary: valuation.methodSummary || [],
    redTeamSummary: redTeam,
    warnings: valuation.warnings || [],
    fragileAssumptions: valuation.fragileAssumptions || [],
    decisionBreakingThreshold: valuation.decisionBreakingThreshold || null,
    preparedBy: valuation.preparedBy || "RSOS",
    approvedBy: valuation.approvedBy || "",
    approvalDate: valuation.approvalDate || "",
    overrideReason: valuation.overrideReason || "",
    sourceSnapshots: valuation.sourceSnapshots || [],
    mediaReferences: valuation.mediaReferences || [],
    auditReferences: valuation.auditReferences || [],
  };
}

export {
  buildCanonicalValuationEngine,
  evaluateCompEligibility,
  buildSimilarityScores,
  buildAdjustmentModel,
  validateAdjustments,
  calculateAdjustedCompValue,
  buildMultiMethodValuation,
  buildArvConfidence,
  buildRedTeamReview,
  createValuationVersion,
  defaultSimilarityWeights,
};
