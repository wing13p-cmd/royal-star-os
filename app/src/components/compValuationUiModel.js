function formatCurrency(value) {
  if (!Number.isFinite(value)) return "$0";
  return `$${value.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

function buildCompValuationUiModel({ comps = [], subjectDeal = null } = {}) {
  const allComps = comps || [];
  const includedComps = allComps.filter((comp) => {
    const status = String(comp.inclusionStatus || "").trim().toLowerCase();
    return comp.included !== false && comp.verified !== false && !["pending", "excluded", "rejected"].includes(status);
  });
  const approvedComps = allComps.filter((comp) => !["excluded", "rejected"].includes(comp.inclusionStatus) && (comp.inclusionStatus === "approved" || comp.verified));
  const reviewQueue = allComps.filter((comp) => !["excluded", "rejected"].includes(comp.inclusionStatus) && (comp.inclusionStatus === "pending" || comp.verified === false || (comp.warningFlags || []).length > 0));
  const pendingImports = allComps.filter((comp) => {
    const pendingReview = comp.inclusionStatus === "pending" || comp.verified === false;
    return !["excluded", "rejected"].includes(comp.inclusionStatus) && (pendingReview || (comp.providerImported && pendingReview));
  });
  const rejectedComps = allComps.filter((comp) => ["excluded", "rejected"].includes(comp.inclusionStatus));

  const validPpsf = includedComps
    .map((comp) => Number(comp.squareFeet) > 0 ? Number(comp.salePrice) / Number(comp.squareFeet) : null)
    .filter(Number.isFinite);
  const averagePpsf = validPpsf.length ? validPpsf.reduce((sum, value) => sum + value, 0) / validPpsf.length : 0;
  const baseArv = subjectDeal?.squareFeet && averagePpsf > 0
    ? averagePpsf * Number(subjectDeal.squareFeet)
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
