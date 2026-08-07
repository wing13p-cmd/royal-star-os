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

function getFinancialsState(record = {}) {
  const rawFinancingCostInput = normalizeNumericValue(
    record?.financials?.rawFinancingCostInput
    ?? record?.rawFinancingCostInput
    ?? record?.financingCosts
    ?? record?.financingCost
    ?? record?.manualFinancingCosts
    ?? record?.overrideFinancingCosts
    ?? 0
  );
  const calculatedFinancingCosts = normalizeNumericValue(
    record?.financials?.calculatedFinancingCosts
    ?? record?.calculatedFinancingCosts
    ?? record?.calculatedFinancingCost
    ?? record?.underwriting?.financingAnalysis?.financingCosts
    ?? record?.underwriting?.financingAnalysis?.effectiveFinancingCosts
    ?? record?.effectiveFinancingCosts
    ?? record?.financingAnalysis?.financingCosts
    ?? record?.financingAnalysis?.effectiveFinancingCosts
    ?? 0
  );
  const sourceOverride = record?.financials?.financingCostSource
    ?? record?.financingCostSource
    ?? record?.financials?.source
    ?? record?.source;
  const explicitManualOverride = sourceOverride === "manual-override" || (rawFinancingCostInput > 0 && (
    !isMissingValue(record?.financials?.rawFinancingCostInput)
    || !isMissingValue(record?.rawFinancingCostInput)
    || !isMissingValue(record?.financingCosts)
    || !isMissingValue(record?.financingCost)
    || !isMissingValue(record?.manualFinancingCosts)
    || !isMissingValue(record?.overrideFinancingCosts)
  ));

  const effectiveFinancingCosts = explicitManualOverride && rawFinancingCostInput > 0 ? rawFinancingCostInput : calculatedFinancingCosts;
  const financingCostSource = explicitManualOverride && rawFinancingCostInput > 0 ? "manual-override" : "calculated";

  return {
    rawFinancingCostInput,
    calculatedFinancingCosts,
    effectiveFinancingCosts,
    financingCostSource,
  };
}

export function buildPersistedDealPayload(payload = {}) {
  const normalizedPayload = { ...payload };
  let underwriting = null;

  try {
    underwriting = buildUnifiedUnderwritingIntelligence(normalizedPayload, [], []);
  } catch {
    // ignore underwriting failures and fall back to the existing payload
  }

  const financingCostState = getFinancialsState({
    ...normalizedPayload,
    underwriting,
  });

  normalizedPayload.financials = {
    rawFinancingCostInput: financingCostState.rawFinancingCostInput,
    calculatedFinancingCosts: financingCostState.calculatedFinancingCosts,
    effectiveFinancingCosts: financingCostState.effectiveFinancingCosts,
    financingCostSource: financingCostState.financingCostSource,
  };

  normalizedPayload.financingCosts = financingCostState.effectiveFinancingCosts;
  normalizedPayload.financingCost = financingCostState.effectiveFinancingCosts;
  normalizedPayload.totalFinancingCosts = financingCostState.effectiveFinancingCosts;
  normalizedPayload.calculatedFinancingCost = financingCostState.calculatedFinancingCosts;
  normalizedPayload.effectiveFinancingCost = financingCostState.effectiveFinancingCosts;

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

    const projectedProfit = normalizeNumericValue(
      underwriting?.sharedDecision?.projectedProfit
      ?? underwriting?.financingAnalysis?.projectedProfit
      ?? underwriting?.flipAnalysis?.netProfit
      ?? normalizedPayload.projectedProfit
    );
    if (projectedProfit > 0 || normalizedPayload.projectedProfit > 0) {
      normalizedPayload.projectedProfit = projectedProfit;
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
