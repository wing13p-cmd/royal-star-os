const own = (record, key) => Object.prototype.hasOwnProperty.call(record || {}, key);
const optionalNumber = (...values) => {
  for (const value of values) {
    if (value === null || value === undefined || (typeof value === "string" && value.trim() === "")) continue;
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
};
const text = (value) => value === null || value === undefined ? "" : String(value).trim();
const strategyOf = (deal = {}) => /brrrr|rental|hold/i.test(text(deal.strategy || deal.exitStrategy)) ? "BRRRR" : "FLIP";

export function normalizeInterestRatePercent(value) {
  const rate = optionalNumber(value);
  if (rate === null) return null;
  return Math.abs(rate) <= 1 ? rate * 100 : rate;
}

export function formatInterestRatePercent(value) {
  const rate = normalizeInterestRatePercent(value);
  return rate === null ? "Insufficient Data" : `${rate.toFixed(2)}%`;
}

export function formatQualificationFailures(status, failures = []) {
  if (/not evaluated/i.test(text(status))) return "NOT EVALUATED";
  return Array.isArray(failures) && failures.length ? failures.join(" • ") : "None";
}

export function gradeForScore(score) {
  const value = optionalNumber(score);
  if (value === null) return "INSUFFICIENT DATA";
  if (value >= 85) return "A";
  if (value >= 70) return "B";
  if (value >= 55) return "C";
  if (value >= 40) return "D";
  return "F";
}

export function withOverallDealGrade(record = {}, authoritativeScore = record?.dealScore) {
  const score = optionalNumber(authoritativeScore);
  return {
    ...record,
    dealScore: score,
    grade: gradeForScore(score),
  };
}

export function buildLeverageTruthSnapshot(deal = {}, financing = {}) {
  const loanExposure = optionalNumber(deal.actualLoanAmount, financing.actualLoanAmount, financing.loanAmount);
  const purchasePrice = optionalNumber(deal.purchasePrice, deal.askingPrice);
  const rehabBudget = optionalNumber(deal.rehabBudget) ?? 0;
  const closingCosts = optionalNumber(deal.closingCosts) ?? 0;
  const financingCosts = optionalNumber(deal.financingCosts) ?? 0;
  const holdingCosts = optionalNumber(deal.holdingCosts, deal.totalHoldingCosts, deal.holdingCost) ?? 0;
  const taxes = optionalNumber(deal.taxes) ?? 0;
  const insurance = optionalNumber(deal.insurance) ?? 0;
  const totalProjectCost = purchasePrice === null ? null : purchasePrice + rehabBudget + closingCosts + financingCosts + holdingCosts + taxes + insurance;
  const asIsValue = optionalNumber(deal.currentAsIsValue, deal.asIsValue, deal.currentValue, deal.currentEstimatedValue, deal.appraisedAsIsValue);
  const projectedArv = optionalNumber(deal.projectedARV, deal.estimatedArv, deal.arv);
  return {
    loanExposure,
    totalProjectCost,
    asIsValue,
    projectedArv,
    ltc: loanExposure !== null && totalProjectCost !== null && totalProjectCost > 0 ? loanExposure / totalProjectCost : null,
    ltv: loanExposure !== null && asIsValue !== null && asIsValue > 0 ? loanExposure / asIsValue : null,
    ltarv: loanExposure !== null && projectedArv !== null && projectedArv > 0 ? loanExposure / projectedArv : null,
    ltvSource: asIsValue !== null ? "CURRENT_AS_IS_VALUE" : "NOT_ESTABLISHED",
  };
}

export function buildRoiTruthSnapshot({ profit, totalProjectCost, cashInvested } = {}) {
  const numerator = optionalNumber(profit);
  const cost = optionalNumber(totalProjectCost);
  const cash = optionalNumber(cashInvested);
  return {
    profit: numerator,
    roiOnTotalProjectCost: numerator !== null && cost !== null && cost > 0 ? numerator / cost : null,
    roiOnCashInvested: numerator !== null && cash !== null && cash > 0 ? numerator / cash : null,
    definitions: {
      roiOnTotalProjectCost: "Projected profit divided by total project cost.",
      roiOnCashInvested: "Projected profit divided by explicit cash invested.",
    },
  };
}

export function buildRequiredDataTruth(deal = {}, appraisal = {}, financing = {}) {
  const strategy = strategyOf(deal);
  const owned = /owned|rehab|active project|in progress/i.test(text(deal.status || deal.pipelineStage || deal.projectStatus));
  const missing = [];
  if (optionalNumber(deal.purchasePrice, deal.askingPrice) === null) missing.push("purchasePrice");
  if (optionalNumber(deal.rehabBudget) === null) missing.push("rehabBudget");
  if (optionalNumber(deal.arv, deal.estimatedArv, deal.projectedARV) === null) missing.push("projectedArv");
  if (appraisal.supportedArv == null) missing.push("supportedArvEvidence");
  if (!owned && optionalNumber(deal.cashToClose, deal.initialCashInvested) === null) missing.push("acquisitionCashRequirement");
  if (strategy === "BRRRR") {
    if (optionalNumber(deal.monthlyRent, deal.estimatedRent) === null) missing.push("monthlyRent");
    if (optionalNumber(deal.refinanceLtvPercentage) === null) missing.push("refinanceLtvPercentage");
  }
  if (financing.actualLoanAmount !== null && financing.interestRate === null) missing.push("interestRate");
  return { strategy, lifecycle: owned ? "OWNED_PROJECT" : "ACQUISITION", missingCriticalData: [...new Set(missing)], missingDataCount: new Set(missing).size };
}

function warningIdentity(message) {
  const normalized = text(message).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  if (/no comps|comp support|unsupported arv|missing appraisal|arv.*insufficient valuation evidence|arv evidence.*incomplete/.test(normalized)) {
    return { key: "APPRAISAL_EVIDENCE_MISSING", message: "Comparable-sale or appraisal evidence is missing; projected ARV is not independently supported." };
  }
  if (/low dscr|dscr.*below/.test(normalized)) return { key: "LOW_DSCR", message: "Rental debt-service coverage is below the applicable threshold." };
  if (/no lender linked|lender record.*not linked|lender qualification.*uncertain|request lender approval/.test(normalized)) return { key: "LENDER_RECORD_NOT_LINKED", message: "No lender record is linked; lender qualification has not been evaluated." };
  if (/ltc.*exceed/.test(normalized)) return { key: "LTC_INTERNAL_THRESHOLD", message: "Loan-to-cost exceeds the Royal Star internal review threshold." };
  if (/loan amount too large/.test(normalized)) return { key: "LOAN_EXPOSURE_INTERNAL_THRESHOLD", message: "Loan exposure exceeds the Royal Star internal purchase-price review threshold." };
  if (/cash requirement too high/.test(normalized)) return { key: "CASH_REQUIREMENT_INTERNAL_THRESHOLD", message: "Cash requirement exceeds the Royal Star internal review threshold." };
  return { key: normalized.toUpperCase().replace(/\s+/g, "_") || "UNKNOWN_WARNING", message: text(message) };
}

export function normalizeWarningRecords(...collections) {
  const records = new Map();
  for (const warning of collections.flat(Infinity).filter(Boolean)) {
    const rawMessage = typeof warning === "string" ? warning : warning.message || warning.reason || String(warning);
    const identity = warningIdentity(rawMessage);
    const existing = records.get(identity.key);
    const detail = text(rawMessage);
    if (existing) {
      if (detail && !existing.details.includes(detail)) existing.details.push(detail);
      if (warning.source && !existing.sources.includes(warning.source)) existing.sources.push(warning.source);
      continue;
    }
    records.set(identity.key, {
      key: identity.key,
      message: identity.message,
      details: detail ? [detail] : [],
      sources: warning.source ? [warning.source] : [],
      severity: warning.severity || (["APPRAISAL_EVIDENCE_MISSING", "LOW_DSCR"].includes(identity.key) ? "HIGH" : "REVIEW"),
    });
  }
  return [...records.values()];
}

export function deduplicateWarnings(...collections) {
  return normalizeWarningRecords(...collections).map((warning) => warning.message);
}

export function buildArvTruthSnapshot(deal = {}, appraisal = {}, governedValuation = {}) {
  const projectedArv = optionalNumber(deal.projectedARV, deal.estimatedArv, deal.arv, deal.requestedARV);
  const governedStatus = String(governedValuation.valuationReviewStatus || governedValuation.status || "").trim().toUpperCase();
  const governedSupported = optionalNumber(
    governedValuation.approvedArv,
    ["APPROVED", "READY"].includes(governedStatus) ? governedValuation.supportedArv : null,
  );
  const appraisalSupported = appraisal.appraisalStatus === "READY"
    ? optionalNumber(appraisal.supportedArv)
    : null;
  const supportedArv = governedSupported ?? appraisalSupported;
  return {
    projectedArv,
    calculatedArv: optionalNumber(governedValuation.recommendedArv, governedValuation.calculatedArv, governedValuation.baseArv, appraisal.supportedArv),
    supportedArv,
    supported: supportedArv !== null,
    confidence: appraisal.appraisalConfidence || governedValuation.confidence || "LOW",
    source: governedSupported !== null ? "GOVERNED_VALUATION" : appraisalSupported !== null ? "APPRAISAL_INTELLIGENCE" : "NOT_ESTABLISHED",
  };
}

export function buildFinancingTruthSnapshot(deal = {}, financing = {}, lender = null) {
  const lenderLinked = Boolean(lender?.id || financing?.lenderId);
  const actualLoanAmount = optionalNumber(deal.actualLoanAmount, financing.actualLoanAmount, financing.loanAmount);
  const savedRate = optionalNumber(deal.annualInterestRate, deal.interestRate);
  const lenderRate = lenderLinked ? optionalNumber(lender?.interestRate, financing.interestRate) : null;
  const interestRate = normalizeInterestRatePercent(lenderRate ?? savedRate);
  const monthlyPayment = optionalNumber(deal.monthlyPayment, deal.monthlyCarry, financing.monthlyPrincipalAndInterest);
  const holdingMonths = optionalNumber(deal.holdingMonths) ?? 0;
  const interestCarry = actualLoanAmount !== null && interestRate !== null
    ? actualLoanAmount * (interestRate / 100) / 12 * holdingMonths
    : null;
  return {
    actualLoanAmount,
    interestRate,
    monthlyPayment,
    interestCarry,
    lenderId: lenderLinked ? (lender?.id || financing?.lenderId) : null,
    selectedLender: lenderLinked ? (lender?.lenderName || lender?.loanProgramName || financing?.selectedLender || null) : null,
    lenderProgram: lenderLinked ? (lender?.loanProgramName || lender?.loanType || financing?.loanProgram || null) : null,
    qualificationStatus: lenderLinked ? (financing?.qualifyingStatus || "NEEDS REVIEW") : "NOT EVALUATED — NO LENDER LINKED",
    financingInputsAvailable: actualLoanAmount !== null,
    currentFinancingStatus: actualLoanAmount !== null ? "ACTIVE / ENTERED" : "NOT ENTERED",
    lenderRecordStatus: lenderLinked ? "LINKED" : "NOT LINKED",
    rateKnown: interestRate !== null,
  };
}

export function gateStrategyMetrics(deal = {}, metrics = {}, options = {}) {
  const strategy = strategyOf(deal);
  const rentalBackupEvaluated = options.rentalBackupEvaluated === true;
  const applicable = strategy === "BRRRR" || rentalBackupEvaluated;
  return {
    strategy,
    rentalMetricsApplicable: applicable,
    monthlyCashFlow: applicable ? optionalNumber(metrics.monthlyCashFlow) : null,
    dscr: applicable ? optionalNumber(metrics.dscr, metrics.debtServiceCoverageRatio) : null,
    monthlyCashFlowDisplay: applicable ? undefined : "N/A — FLIP STRATEGY",
    dscrDisplay: applicable ? undefined : "N/A — FLIP STRATEGY",
    decisionCritical: strategy === "BRRRR",
  };
}

export function buildLiquidityTruthSnapshot(deal = {}, scenario = {}) {
  const availableLiquidity = optionalNumber(deal.availableLiquidity, deal.cashOnHand, deal.liquidity);
  const acquisitionCashToClose = optionalNumber(deal.cashToClose, scenario.cashToClose);
  const scenarioCashRequired = optionalNumber(scenario.cashRequired, scenario.downsideCashRequired);
  const gap = availableLiquidity !== null && acquisitionCashToClose !== null ? Math.max(0, acquisitionCashToClose - availableLiquidity) : null;
  return {
    availableLiquidity,
    acquisitionCashToClose,
    scenarioCashRequired,
    liquidityGap: gap,
    status: availableLiquidity === null ? "UNKNOWN" : gap > 0 ? "GAP" : "SUFFICIENT",
    warning: availableLiquidity === null ? "Available liquidity is unknown; no liquidity-gap conclusion was made." : gap > 0 ? "Cash-to-close exceeds available liquidity." : null,
  };
}

export function reconcileDealRecommendation({ deal = {}, acquisitionDecision, projectDecision, appraisalStatus, baseRecommendation, downsideRecommendation, strategyRecommendation } = {}) {
  const owned = /owned|rehab|active project|under contract/i.test(text(deal.status || deal.pipelineStage || deal.projectStatus));
  const controllingDecision = owned ? (projectDecision || "CONTINUE PROJECT WITH CONTROLS") : (acquisitionDecision || "PAUSE FOR DATA");
  return {
    context: owned ? "OWNED_PROJECT" : "ACQUISITION",
    controllingDecision,
    controllingSource: owned ? "CURRENT PROJECT OPERATING DECISION" : "ACQUISITION UNDERWRITING DECISION",
    acquisitionDecision: acquisitionDecision || "INSUFFICIENT DATA",
    projectDecision: projectDecision || "NOT APPLICABLE",
    appraisalReadiness: appraisalStatus || "NOT_READY",
    baseRecommendation: baseRecommendation || "INSUFFICIENT DATA",
    downsideRecommendation: downsideRecommendation || "INSUFFICIENT DATA",
    strategyRecommendation: strategyRecommendation || "INSUFFICIENT DATA",
    explanation: owned
      ? "The property is already controlled, so the current-project operating decision governs; acquisition economics remain advisory context."
      : "The property is in acquisition review, so acquisition underwriting governs the final recommendation.",
  };
}

export function buildOfferTruthSnapshot(offer = {}, scenario = {}) {
  const maximumAllowableOffer = optionalNumber(offer.maximumOffer, offer.maximumAllowableOffer);
  const walkAwayPrice = optionalNumber(offer.walkAwayPrice, maximumAllowableOffer);
  const targetOffer = optionalNumber(offer.targetOffer, offer.recommendedOffer);
  const openingOffer = optionalNumber(offer.initialOffer, offer.openingOffer, offer.recommendedOpeningOffer);
  return {
    maximumAllowableOffer,
    targetOffer,
    openingOffer,
    walkAwayPrice,
    downsideMaximumAllowableOffer: optionalNumber(offer.sensitivity?.worst?.maximumAllowableOffer, scenario.downsideMao),
    scenarioMaximumAllowableOffer: optionalNumber(scenario.mao),
    provenance: {
      maximumAllowableOffer: "AUTHORITATIVE_OFFER_ENGINE_BASE_CASE",
      downsideMaximumAllowableOffer: "AUTHORITATIVE_OFFER_ENGINE_DOWNSIDE",
      scenarioMaximumAllowableOffer: "SCENARIO_ANALYSIS_ONLY",
    },
    ordered: [openingOffer, targetOffer, walkAwayPrice, maximumAllowableOffer].filter((value) => value !== null).every((value, index, values) => index === 0 || values[index - 1] <= value),
  };
}

export function buildRehabTruthScore(deal = {}) {
  const budget = optionalNumber(deal.rehabBudget);
  const budgetAttractiveness = budget === null ? null : budget <= 60000 ? 100 : budget <= 100000 ? 60 : 0;
  const evidence = [deal.scopeSummary, deal.contractorEstimate, deal.materialPricingStatus, deal.contingency].filter((value) => value !== null && value !== undefined && value !== "");
  const dataCompletenessScore = Math.round(evidence.length / 4 * 100);
  const executionRisk = dataCompletenessScore >= 75 ? "LOW" : dataCompletenessScore >= 50 ? "MEDIUM" : "HIGH";
  return { budgetAttractiveness, dataCompletenessScore, executionRisk, scopeValidated: Boolean(deal.scopeSummary && deal.contractorEstimate), contingencyKnown: optionalNumber(deal.contingency) !== null };
}

export function buildRentalTruthScore(deal = {}, market = {}) {
  const applicable = strategyOf(deal) === "BRRRR" || Boolean(deal.evaluateRentalBackup);
  const projectedRent = optionalNumber(deal.monthlyRent, deal.estimatedRent);
  const verifiedRent = optionalNumber(deal.verifiedMarketRent, deal.verifiedRent);
  const demand = optionalNumber(market.rentalDemandScore, market.rentalDemand, deal.rentalDemandScore);
  const evidencePoints = [verifiedRent !== null, demand !== null, optionalNumber(deal.vacancyPercentage, deal.vacancy) !== null, optionalNumber(deal.annualPropertyTaxes, deal.taxes) !== null, optionalNumber(deal.annualInsurance, deal.insurance) !== null].filter(Boolean).length;
  const confidenceScore = Math.round(evidencePoints / 5 * 100);
  const score = verifiedRent !== null && demand !== null ? Math.round(Math.min(100, (demand + confidenceScore) / 2)) : null;
  return { applicable, projectedRent, verifiedRent, rentalDemand: demand, evidenceScore: confidenceScore, score, grade: score === null ? "INSUFFICIENT DATA" : score >= 85 ? "A" : score >= 70 ? "B" : score >= 55 ? "C" : "D", warning: verifiedRent === null ? "Verified market rent is missing." : null };
}

export function reconcileBuyBoxScoring(buyBox = {}) {
  const score = optionalNumber(buyBox.score, buyBox.overallScore) ?? 0;
  const penalties = [
    ...(buyBox.reviewRules || []).map((reason) => ({ reason, points: -7 })),
    ...(buyBox.failedRules || []).map((reason) => ({ reason, points: -25 })),
  ];
  const displayedScore = Math.max(0, 100 + penalties.reduce((sum, entry) => sum + entry.points, 0));
  return { baseline: 100, contributions: penalties, calculatedScore: displayedScore, score, reconciled: displayedScore === score };
}

export function normalizeEffectLabel(value, prefix) {
  const raw = text(value);
  const matcher = new RegExp(`^${prefix}\\s*:\\s*`, "i");
  return raw.replace(matcher, "");
}

export function normalizeScenarioTimeline({ timelineDays, timelineMonths, holdingMonths } = {}) {
  const explicitDays = own(arguments[0] || {}, "timelineDays") ? optionalNumber(timelineDays) : null;
  const months = optionalNumber(timelineMonths, holdingMonths);
  const days = explicitDays ?? (months !== null ? months * 30 : null);
  return { timelineDays: days, timelineMonths: months ?? (days !== null ? days / 30 : null), sourceUnit: explicitDays !== null ? "DAYS" : months !== null ? "MONTHS" : "UNKNOWN" };
}

export { optionalNumber };
