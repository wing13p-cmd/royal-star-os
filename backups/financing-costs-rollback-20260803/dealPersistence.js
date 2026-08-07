import { buildUnifiedUnderwritingIntelligence } from "../app/src/components/intelligenceUpgradeEngine.js";

function isMissingValue(value) {
  if (value === null || value === undefined || value === "") return true;
  if (typeof value === "number") return !Number.isFinite(value);
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return true;
    return /^(n\/a|na|none|null|undefined|nan)$/i.test(trimmed);
  }
  return false;
}

function normalizeNumericValue(value) {
  if (isMissingValue(value)) return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeTextValue(value, fallback = "") {
  if (isMissingValue(value)) return fallback;
  return String(value).trim();
}

export function buildPersistedDealPayload(payload = {}) {
  const normalizedPayload = { ...payload };
  let underwriting = null;

  try {
    underwriting = buildUnifiedUnderwritingIntelligence(normalizedPayload, [], []);
  } catch {
    // ignore underwriting failures and fall back to the existing payload
  }

  const rawFinancingCosts = normalizeNumericValue(normalizedPayload.financingCosts);
  const computedFinancingCosts = normalizeNumericValue(underwriting?.financingAnalysis?.financingCosts);
  if (rawFinancingCosts > 0) {
    normalizedPayload.financingCosts = rawFinancingCosts;
  } else if (computedFinancingCosts > 0) {
    normalizedPayload.financingCosts = computedFinancingCosts;
  }

  if (underwriting) {
    const overallRisk = normalizeNumericValue(
      underwriting?.decisionConsistency?.overallRiskScore
      ?? underwriting?.sharedDecision?.overallRiskScore
      ?? underwriting?.riskProfile?.overallRiskScore
      ?? normalizedPayload.overallRisk
    );
    if (overallRisk > 0) {
      normalizedPayload.overallRisk = overallRisk;
    }

    const riskLevel = normalizeTextValue(
      underwriting?.riskProfile?.overallRiskLabel
      ?? underwriting?.sharedDecision?.overallRiskLabel
      ?? normalizedPayload.riskLevel
    );
    if (riskLevel) {
      normalizedPayload.riskLevel = riskLevel;
    }

    const recommendation = normalizeTextValue(
      underwriting?.sharedDecision?.baseRecommendation
      ?? underwriting?.decisionConsistency?.baseRecommendation
      ?? underwriting?.decisionConsistency?.recommendation
      ?? normalizedPayload.recommendation
    );
    if (recommendation) {
      normalizedPayload.recommendation = recommendation;
    }

    const warningCount = normalizeNumericValue(
      underwriting?.sharedDecision?.warnings?.length
      ?? normalizedPayload.warningCount
    );
    if (warningCount > 0) {
      normalizedPayload.warningCount = warningCount;
    }

    const confidenceScore = normalizeNumericValue(
      underwriting?.sharedDecision?.decisionConfidence
      ?? underwriting?.decisionConsistency?.decisionConfidence
      ?? normalizedPayload.confidenceScore
    );
    if (confidenceScore > 0) {
      normalizedPayload.confidenceScore = confidenceScore;
    }
  }

  return normalizedPayload;
}
