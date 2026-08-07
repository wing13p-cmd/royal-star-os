function normalizeText(value) {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function classifyRecommendation(value, source) {
  const normalized = normalizeText(value).toUpperCase();
  if (!normalized) return "unknown";

  if (source === "Buy Box") {
    if (normalized === "PASS" || normalized === "CONDITIONAL PASS" || normalized === "CONDITIONAL") return "positive";
    if (normalized === "FAIL") return "negative";
    return "unknown";
  }

  if (["STRONG BUY", "BUY", "PROCEED", "CONTINUE PROJECT", "CONTINUE REHAB", "OFFER", "REFINANCE CANDIDATE"].includes(normalized)) return "positive";
  if (["CONDITIONAL BUY", "REQUEST MORE DATA", "RE-UNDERWRITE", "REUNDERWRITE", "HOLD", "REVIEW", "OFFER WITH CONDITIONS"].includes(normalized)) return "conditional";
  if (["REJECT", "DO NOT PURCHASE", "DO NOT OFFER", "PASS"].includes(normalized)) return "negative";

  return "unknown";
}

function normalizeDisplayRecommendation(value, fallback = "Insufficient Data") {
  const text = normalizeText(value);
  return text || fallback;
}

function unifiedLabelForClassification(classification) {
  if (classification === "positive") return "BUY";
  if (classification === "conditional") return "COUNTER / RENEGOTIATE";
  if (classification === "negative") return "REJECT";
  return "PAUSE FOR DATA";
}

function toBoolean(value) {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value > 0;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    return normalized === "true" || normalized === "yes" || normalized === "1";
  }
  return false;
}

export function reconcileRecommendations(entries = [], context = {}) {
  const normalizedEntries = Array.isArray(entries)
    ? entries.map((entry) => ({
      source: normalizeDisplayRecommendation(entry?.source, "Unknown"),
      recommendation: normalizeDisplayRecommendation(entry?.recommendation),
      classification: classifyRecommendation(entry?.recommendation, entry?.source),
    }))
    : [];

  const classified = normalizedEntries.filter((entry) => entry.classification !== "unknown");
  const classifications = new Set(classified.map((entry) => entry.classification));
  const hasConflict = classifications.size > 1;

  const decisionBlockers = Array.isArray(context.decisionBlockers) ? context.decisionBlockers.filter(Boolean) : [];
  const criticalDataMissing = toBoolean(context.criticalDataMissing) || decisionBlockers.length > 0;
  const veryLowConfidence = String(context.confidenceLabel || "").toLowerCase() === "very low";
  const supportedArvEstablished = toBoolean(context.supportedArvEstablished);
  const financingComplete = toBoolean(context.financingComplete);

  let finalRecommendation = "PAUSE FOR DATA";
  let controllingRule = "Decision-critical data is incomplete.";

  if (criticalDataMissing || veryLowConfidence || !supportedArvEstablished || !financingComplete) {
    finalRecommendation = "PAUSE FOR DATA";
    const blockers = [
      ...(criticalDataMissing ? ["decision-critical data missing"] : []),
      ...(veryLowConfidence ? ["recommendation confidence is Very Low"] : []),
      ...(!supportedArvEstablished ? ["supported ARV is not established"] : []),
      ...(!financingComplete ? ["financing is incomplete"] : []),
      ...decisionBlockers,
    ];
    controllingRule = `Blocked by: ${blockers.join("; ")}.`;
  } else if (hasConflict || classifications.has("conditional")) {
    finalRecommendation = "COUNTER / RENEGOTIATE";
    controllingRule = hasConflict
      ? "Engines conflict on risk posture, so negotiation/re-underwrite control applies."
      : "Conditional signals require renegotiation before approval.";
  } else if (classifications.has("negative")) {
    finalRecommendation = "REJECT";
    controllingRule = "At least one decision engine returned a rejection-level outcome after gating checks.";
  } else if (classifications.has("positive")) {
    finalRecommendation = "BUY";
    controllingRule = "All gating checks passed and recommendations are favorable.";
  }

  const classification = classified[0]?.classification || "unknown";
  const unifiedRecommendation = finalRecommendation || unifiedLabelForClassification(classification);
  const engineSummary = classified.map((entry) => `${entry.source}=${entry.recommendation}`).join("; ") || "No engine recommendations available.";

  return {
    hasConflict,
    displayRecommendation: unifiedRecommendation,
    explanation: `Engine reconciliation: ${engineSummary}. Controlling rule: ${controllingRule}`,
    controllingRule,
    sources: normalizedEntries,
    unifiedRecommendation,
    finalRecommendation: unifiedRecommendation,
    scenarioRecommendations: normalizedEntries,
  };
}
