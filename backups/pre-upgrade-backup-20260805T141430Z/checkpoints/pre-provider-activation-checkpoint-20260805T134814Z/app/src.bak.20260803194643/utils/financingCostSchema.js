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

export function buildFinancingCostState(record = {}, underwritingResult = {}) {
  const rawInput = normalizeNumericValue(
    record?.financials?.rawFinancingCostInput
    ?? record?.rawFinancingCostInput
    ?? record?.financingCosts
    ?? record?.financingCost
    ?? record?.manualFinancingCosts
    ?? record?.overrideFinancingCosts
    ?? 0
  );

  const calculatedValue = normalizeNumericValue(
    record?.financials?.calculatedFinancingCosts
    ?? record?.calculatedFinancingCosts
    ?? record?.calculatedFinancingCost
    ?? underwritingResult?.financingAnalysis?.effectiveFinancingCosts
    ?? underwritingResult?.financingAnalysis?.financingCosts
    ?? underwritingResult?.effectiveFinancingCosts
    ?? underwritingResult?.financingCosts
    ?? 0
  );

  const sourceOverride = record?.financials?.financingCostSource
    ?? record?.financingCostSource
    ?? record?.financials?.source
    ?? record?.source;
  const explicitManualOverride = (sourceOverride === "manual-override") || (rawInput > 0 && (
    !isMissingValue(record?.financials?.rawFinancingCostInput)
    || !isMissingValue(record?.rawFinancingCostInput)
    || !isMissingValue(record?.financingCosts)
    || !isMissingValue(record?.financingCost)
    || !isMissingValue(record?.manualFinancingCosts)
    || !isMissingValue(record?.overrideFinancingCosts)
  ));

  const effectiveValue = explicitManualOverride && rawInput > 0 ? rawInput : calculatedValue;
  const source = explicitManualOverride && rawInput > 0 ? "manual-override" : "calculated";

  return {
    rawFinancingCostInput: rawInput,
    calculatedFinancingCosts: calculatedValue,
    effectiveFinancingCosts: effectiveValue,
    financingCostSource: source,
  };
}

export function getDisplayedFinancingCostValue(rawFinancingCostInput, financingCostState = {}) {
  const rawValue = normalizeNumericValue(rawFinancingCostInput);
  if (rawValue > 0) return rawValue;
  return normalizeNumericValue(financingCostState?.effectiveFinancingCosts ?? 0);
}
