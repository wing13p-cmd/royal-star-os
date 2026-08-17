import { buildLeverageTruthSnapshot, normalizeInterestRatePercent } from "./dealIntelligenceTruthEngine.js";

export function safeNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function safeDisplay(value, fallback = "Insufficient Data") {
  if (value === null || value === undefined || value === "" || Number.isNaN(value)) return fallback;
  if (typeof value === "number" && !Number.isFinite(value)) return fallback;
  return value;
}

function optionalNumber(...values) {
  for (const value of values) {
    if (value === null || value === undefined || (typeof value === "string" && value.trim() === "")) continue;
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function sanitize(value) {
  return safeDisplay(value, "Insufficient Data");
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function calculateEligibility(funding, lender, deal) {
  const failures = [];
  const maxLtc = safeNumber(lender.maximumLTC ?? lender.maximumLoanToCost);
  const maxLtv = safeNumber(lender.maximumPurchaseLTV ?? lender.maximumLTV ?? lender.maximumARVLTV);
  const maxLtarv = safeNumber(lender.maximumARVLTV ?? lender.maximumLTARV ?? lender.maximumARV);
  const requiredCash = safeNumber(lender.requiredCashContribution ?? lender.liquidityRequirement);
  const requiredDscr = safeNumber(lender.DSCRMinimum ?? lender.minimumDSCR);
  const minCredit = safeNumber(lender.creditScoreMinimum);
  const loanAmount = funding.loanAmount;
  const ltc = funding.ltc;
  const ltv = funding.ltv;
  const ltarv = funding.ltarv;
  const dscr = safeNumber(deal.estimatedRent) > 0 && funding.monthlyPrincipalAndInterest > 0 ? safeNumber(deal.estimatedRent) / funding.monthlyPrincipalAndInterest : 0;

  if (maxLtc > 0 && ltc > maxLtc) failures.push(`LTC exceeds ${Math.round(maxLtc * 100)}%`);
  if (maxLtv > 0 && ltv !== null && ltv > maxLtv) failures.push(`LTV exceeds ${Math.round(maxLtv * 100)}%`);
  if (maxLtarv > 0 && ltarv > maxLtarv) failures.push(`LTARV exceeds ${Math.round(maxLtarv * 100)}%`);
  if (maxLtc > 0 && loanAmount > safeNumber(lender.maximumLoanAmount)) failures.push("Loan amount exceeds lender maximum");
  if (requiredCash > 0 && funding.cashRequired > requiredCash) failures.push("Cash contribution exceeds lender requirement");
  if (requiredDscr > 0 && dscr < requiredDscr) failures.push(`DSCR below ${requiredDscr}`);
  if (minCredit > 0 && safeNumber(deal.creditScore) > 0 && safeNumber(deal.creditScore) < minCredit) failures.push(`Credit score below ${minCredit}`);
  if (safeNumber(deal.cashOnHand) > 0 && funding.cashRequired > safeNumber(deal.cashOnHand)) failures.push("Cash requirement exceeds available liquidity");

  if (failures.length === 0) {
    return { status: "Qualified", failures };
  }

  if (failures.length <= 2) {
    return { status: "Conditionally Qualified", failures };
  }

  return { status: "Not Qualified", failures };
}

function calculateWarnings(funding, lender, deal, hasLinkedLender) {
  const warnings = [];
  const push = (message, source, rule) => warnings.push({ message, source, rule });
  const rate = funding.interestRateDecimal;
  const points = safeNumber(lender.originationPoints);
  const fees = funding.originationFees;
  const purchasePrice = safeNumber(deal.purchasePrice ?? deal.askingPrice);
  const rehabBudget = safeNumber(deal.rehabBudget);
  const arv = safeNumber(deal.estimatedArv ?? deal.arv ?? deal.projectedARV ?? deal.currentValue);
  const ltc = funding.ltc;
  const ltarv = funding.ltarv;
  const dscr = safeNumber(deal.estimatedRent) > 0 && funding.monthlyPrincipalAndInterest > 0 ? safeNumber(deal.estimatedRent) / funding.monthlyPrincipalAndInterest : 0;

  if (rate !== null && rate > 0.12) push("Excessive Interest Rate", "ROYAL_STAR_INTERNAL", "INTERNAL_RATE");
  if (points > 0.03) push("High Points", hasLinkedLender ? "LENDER_RULE" : "ROYAL_STAR_INTERNAL", "POINTS");
  if (fees > 5000) push("High Fees", hasLinkedLender ? "LENDER_RULE" : "ROYAL_STAR_INTERNAL", "FEES");
  if (ltc > 0.8) push("LTC Exceeded", "ROYAL_STAR_INTERNAL", "INTERNAL_LTC");
  if (ltarv > 0.75) push("LTARV Exceeded", "ROYAL_STAR_INTERNAL", "INTERNAL_LTARV");
  if (/brrrr|rental|hold/i.test(String(deal.strategy || deal.exitStrategy || "")) && dscr > 0 && dscr < 1.25) push("Low DSCR", "STRATEGY", "RENTAL_DSCR");
  if (funding.loanAmount > 0 && purchasePrice > 0 && funding.loanAmount > purchasePrice * 0.8) push("Loan Amount Too Large", "ROYAL_STAR_INTERNAL", "INTERNAL_LOAN_TO_PURCHASE");
  if (funding.cashRequired > 25000) push("Cash Requirement Too High", "ROYAL_STAR_INTERNAL", "INTERNAL_CASH_REQUIREMENT");
  if (hasLinkedLender && safeNumber(lender.loanTermMonths) > 0 && safeNumber(lender.loanTermMonths) < 12) push("Short Loan Term", "LENDER_RULE", "LENDER_TERM");
  if (hasLinkedLender && safeNumber(lender.loanTermMonths) > 0 && safeNumber(lender.loanTermMonths) < 24) push("Maturity Risk", "LENDER_RULE", "LENDER_MATURITY");

  return warnings;
}

function calculateFinancingScore(funding, lender, deal) {
  const rate = funding.interestRateDecimal ?? 0;
  const points = safeNumber(lender.originationPoints);
  const fees = funding.originationFees;
  const cashRequired = funding.cashRequired;
  const ltc = funding.ltc;
  const ltarv = funding.ltarv;
  const monthlyPayment = funding.monthlyPrincipalAndInterest;
  const rentalApplicable = /brrrr|rental|hold/i.test(String(deal.strategy || deal.exitStrategy || ""));
  const dscr = rentalApplicable && safeNumber(deal.estimatedRent) > 0 && monthlyPayment > 0 ? safeNumber(deal.estimatedRent) / monthlyPayment : 0;
  const closingSpeed = safeNumber(lender.drawTurnaroundDays);
  const flexibility = safeNumber(lender.flexibilityScore);

  let score = 100;
  if (rate > 0.1) score -= 10;
  if (points > 0.02) score -= 6;
  if (fees > 5000) score -= 5;
  if (cashRequired > 20000) score -= 8;
  if (ltc > 0.75) score -= 8;
  if (ltarv > 0.7) score -= 7;
  if (monthlyPayment > 4000) score -= 6;
  if (dscr > 0 && dscr < 1.25) score -= 8;
  if (closingSpeed > 7) score -= 4;
  if (flexibility > 0 && flexibility < 7) score -= 5;
  score = clamp(Math.round(score), 0, 100);
  return score;
}

function calculateRiskLevel(warnings) {
  const severity = ["Low", "Moderate", "High", "Critical"];
  if (warnings.includes("Critical") || warnings.length >= 5) return severity[3];
  if (warnings.length >= 3) return severity[2];
  if (warnings.length >= 1) return severity[1];
  return severity[0];
}

export function buildLenderComparison(deal = {}, lenders = []) {
  const normalized = (lenders || []).filter(Boolean);
  if (normalized.length <= 1) return null;
  const evaluations = normalized.map((lender) => ({
    lender,
    financing: buildFinancingIntelligence(deal, lender),
  }));
  const qualified = evaluations.filter((entry) => entry.financing.qualifyingStatus === "Qualified");
  const ranked = qualified.length > 0 ? qualified : evaluations;
  ranked.sort((left, right) => {
    if (right.financing.financingScore !== left.financing.financingScore) {
      return right.financing.financingScore - left.financing.financingScore;
    }
    if (left.financing.monthlyPrincipalAndInterest !== right.financing.monthlyPrincipalAndInterest) {
      return left.financing.monthlyPrincipalAndInterest - right.financing.monthlyPrincipalAndInterest;
    }
    return left.financing.cashRequired - right.financing.cashRequired;
  });
  const best = ranked[0];
  return {
    lenderCount: normalized.length,
    bestLender: best?.lender || null,
    bestFinancing: best?.financing || null,
  };
}

export function buildFinancingIntelligence(deal = {}, lender = {}) {
  const purchasePrice = safeNumber(deal.purchasePrice ?? deal.askingPrice);
  const rehabBudget = safeNumber(deal.rehabBudget);
  const closingCosts = safeNumber(deal.closingCosts);
  const financingCosts = safeNumber(deal.financingCosts);
  const taxes = safeNumber(deal.taxes);
  const insurance = safeNumber(deal.insurance);
  const arv = safeNumber(deal.estimatedArv ?? deal.arv ?? deal.projectedARV ?? deal.currentValue);
  const estimatedRent = safeNumber(deal.estimatedRent ?? deal.marketRent ?? deal.projectedRent);
  const hasLinkedLender = Boolean(lender.id || lender.lenderName || lender.loanProgramName);
  const savedInterestRate = optionalNumber(deal.annualInterestRate, deal.interestRate, deal.rate);
  const lenderInterestRate = hasLinkedLender ? optionalNumber(lender.interestRate) : null;
  const interestRate = normalizeInterestRatePercent(lenderInterestRate ?? savedInterestRate);
  const points = safeNumber(lender.originationPoints);
  const originationFees = safeNumber(lender.underwritingFee) + safeNumber(lender.processingFee) + safeNumber(lender.appraisalFee) + safeNumber(lender.legalFee) + safeNumber(lender.drawFee) + safeNumber(lender.extensionFee);
  const totalProjectCost = purchasePrice + rehabBudget + closingCosts + financingCosts + taxes + insurance;
  const maxLoanAmount = safeNumber(lender.maximumLoanAmount);
  const minimumLoanAmount = safeNumber(lender.minimumLoanAmount);
  const savedLoanAmount = optionalNumber(deal.actualLoanAmount, deal.actualLoan, deal.loanAmount, deal.fundingAmount);
  const baseLoanAmount = totalProjectCost > 0 ? totalProjectCost * 0.8 : 0;
  const modeledLoanAmount = maxLoanAmount > 0 ? Math.min(baseLoanAmount, maxLoanAmount) : baseLoanAmount;
  const loanAmount = savedLoanAmount ?? (hasLinkedLender ? modeledLoanAmount : 0);
  const explicitCashRequired = optionalNumber(deal.initialCashInvested, deal.totalInitialCashInvested);
  const cashRequired = explicitCashRequired ?? Math.max(0, totalProjectCost - loanAmount);
  const pointsCost = loanAmount * points;
  const totalFinancingCost = pointsCost + originationFees;
  const normalizedRate = interestRate === null ? null : interestRate / 100;
  const monthlyInterestPayment = loanAmount > 0 && normalizedRate !== null ? (loanAmount * normalizedRate) / 12 : null;
  const savedMonthlyPayment = optionalNumber(deal.monthlyPayment, deal.monthlyCarry);
  const interestOnly = /interest|intrest/i.test(String(deal.paymentType || ""));
  const monthlyPrincipalAndInterest = savedMonthlyPayment ?? (interestOnly ? monthlyInterestPayment : (loanAmount > 0 && monthlyInterestPayment !== null ? (loanAmount / 12) + monthlyInterestPayment : null));
  const leverage = buildLeverageTruthSnapshot(deal, { loanAmount });
  const ltc = leverage.ltc;
  const ltv = leverage.ltv;
  const ltarv = leverage.ltarv;
  const dscr = estimatedRent > 0 && monthlyPrincipalAndInterest > 0 ? estimatedRent / monthlyPrincipalAndInterest : null;
  const holdingMonths = optionalNumber(deal.holdingMonths) ?? 0;
  const interestCarryDuringRehab = monthlyInterestPayment !== null ? monthlyInterestPayment * holdingMonths : null;
  const totalInterestExpense = monthlyInterestPayment !== null ? monthlyInterestPayment * 12 : null;
  const estimatedCashToClose = cashRequired + totalFinancingCost + closingCosts + financingCosts + taxes + insurance;
  const availableLiquidity = optionalNumber(deal.availableLiquidity, deal.cashOnHand, deal.liquidity);
  const remainingLiquidityAfterClosing = availableLiquidity !== null ? availableLiquidity - estimatedCashToClose : null;

  const funding = {
    loanAmount: Math.max(0, loanAmount),
    cashRequired: Math.max(0, cashRequired),
    pointsCost,
    originationFees,
    totalFinancingCost,
    monthlyInterestPayment,
    monthlyPrincipalAndInterest,
    ltc,
    ltv,
    ltarv,
    leverage,
    dscr,
    interestCarryDuringRehab,
    totalInterestExpense,
    estimatedCashToClose,
    remainingLiquidityAfterClosing,
    interestRateDecimal: normalizedRate,
  };

  const qualification = hasLinkedLender ? calculateEligibility(funding, lender, deal) : { status: "Not Evaluated — No Lender Linked", failures: [] };
  const financingWarningDetails = calculateWarnings(funding, lender, deal, hasLinkedLender);
  const financingWarnings = financingWarningDetails.map((warning) => warning.message);
  const financingScore = calculateFinancingScore(funding, lender, deal);
  const riskLevel = calculateRiskLevel(financingWarnings);

  return {
    ...funding,
    lenderId: lender.id || "",
    selectedLender: hasLinkedLender ? (lender.lenderName || lender.loanProgramName || "Insufficient Data") : "Insufficient Data",
    loanProgram: lender.loanProgramName || lender.loanType || "Insufficient Data",
    loanType: lender.loanType || lender.loanProgramName || "Insufficient Data",
    interestRate,
    interestRateKnown: interestRate !== null,
    lenderLinked: hasLinkedLender,
    points,
    fees: originationFees,
    minimumLoanAmount,
    maximumLoanAmount: maxLoanAmount,
    maximumLtc: safeNumber(lender.maximumLTC ?? lender.maximumLoanToCost),
    maximumLtv: safeNumber(lender.maximumPurchaseLTV ?? lender.maximumLTV ?? lender.maximumARVLTV),
    maximumLtarv: safeNumber(lender.maximumARVLTV ?? lender.maximumLTARV ?? lender.maximumARV),
    requiredCashContribution: safeNumber(lender.requiredCashContribution ?? lender.liquidityRequirement),
    drawSchedule: lender.drawScheduleType || lender.drawSchedule || "Insufficient Data",
    loanTerm: safeNumber(lender.loanTermMonths),
    extensionOptions: lender.extensionOptions || "Insufficient Data",
    minimumCreditScore: safeNumber(lender.creditScoreMinimum),
    minimumDscr: safeNumber(lender.DSCRMinimum ?? lender.minimumDSCR),
    closingTime: lender.drawTurnaroundDays || "Insufficient Data",
    notes: lender.notes || "Insufficient Data",
    ltc,
    ltv,
    ltarv,
    dscr,
    financingScore,
    financingGrade: financingScore >= 85 ? "A" : financingScore >= 70 ? "B" : financingScore >= 55 ? "C" : financingScore >= 40 ? "D" : "F",
    financingExplanation: financingScore >= 80 ? "Strong overall financing profile." : financingScore >= 60 ? "Moderate financing profile with some tradeoffs." : "Financing is expensive or restrictive.",
    qualifyingStatus: qualification.status,
    qualificationFailures: qualification.failures,
    financingWarnings,
    financingWarningDetails,
    lenderQualificationWarnings: hasLinkedLender ? qualification.failures.map((message) => ({ message, source: "LENDER_RULE", rule: "QUALIFICATION" })) : [],
    financingRisk: riskLevel,
    activeWarnings: financingWarningDetails.map((warning) => `[${warning.source.replaceAll("_", " ")}] ${warning.message}`).join(" • ") || "No active warnings",
    displayValue: sanitize,
  };
}
