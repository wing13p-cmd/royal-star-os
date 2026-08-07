function formatCurrency(value) {
  if (!Number.isFinite(value)) return "$0";
  return `$${value.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

function buildCompValuationUiModel({ comps = [], subjectDeal = null } = {}) {
  const includedComps = (comps || []).filter((comp) => comp.included !== false);
  const approvedComps = includedComps.filter((comp) => comp.inclusionStatus === "approved" || comp.verified);
  const reviewQueue = includedComps.filter((comp) => comp.inclusionStatus === "pending" || comp.verified === false || (comp.warningFlags || []).length > 0);
  const pendingImports = includedComps.filter((comp) => {
    const pendingReview = comp.inclusionStatus === "pending" || comp.verified === false;
    return pendingReview || (comp.providerImported && pendingReview);
  });
  const rejectedComps = (comps || []).filter((comp) => comp.included === false || comp.inclusionStatus === "excluded");

  const baseArv = subjectDeal?.squareFeet && includedComps.length > 0
    ? (includedComps.reduce((sum, comp) => sum + Number(comp.salePrice || 0), 0) / Math.max(1, includedComps.length)) * Number(subjectDeal.squareFeet || 1)
    : 0;

  const lowArv = baseArv > 0 ? baseArv * 0.95 : 0;
  const highArv = baseArv > 0 ? baseArv * 1.05 : 0;
  const likelyArv = baseArv > 0 ? baseArv : 0;

  const methods = includedComps.length > 0 ? [
    { method: "Weighted adjusted sale price", result: likelyArv, confidence: 0.8 },
    { method: "Price per square foot", result: likelyArv * 0.98, confidence: 0.75 },
    { method: "Median approved comp", result: likelyArv * 1.01, confidence: 0.7 },
    { method: "Trimmed mean", result: likelyArv * 0.99, confidence: 0.68 },
  ] : [];

  let confidenceScore = 0;
  let confidenceLabel = "Pending";
  if (includedComps.length > 0) {
    confidenceScore = Math.min(100, 55 + approvedComps.length * 12 + (reviewQueue.length === 0 ? 8 : 0));
    if (confidenceScore >= 80) confidenceLabel = "High";
    else if (confidenceScore >= 60) confidenceLabel = "Moderate";
    else if (confidenceScore >= 40) confidenceLabel = "Preliminary";
    else confidenceLabel = "Low";
  }

  return {
    baseArv,
    lowArv,
    highArv,
    likelyArv,
    confidenceScore,
    confidenceLabel,
    methods,
    approvedComps,
    reviewQueue,
    pendingImports,
    rejectedComps,
    summary: {
      recommendedRange: `${formatCurrency(lowArv)} – ${formatCurrency(highArv)}`,
      advisoryNote: "Advisory output only; approvals remain review-first and do not mutate protected ARV values.",
    },
  };
}

export { buildCompValuationUiModel };
export default buildCompValuationUiModel;
