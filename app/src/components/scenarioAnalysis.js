import { buildRecommendationEngine } from "./recommendationEngine.js";
import { buildFinancingIntelligence } from "./financeIntelligence.js";
import { buildUnifiedUnderwritingIntelligence } from "./intelligenceUpgradeEngine.js";
import { normalizeInterestRatePercent } from "./dealIntelligenceTruthEngine.js";

export function safeNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function safeDisplay(value, fallback = "Insufficient Data") {
  if (value === null || value === undefined || value === "" || Number.isNaN(value)) return fallback;
  if (typeof value === "number" && !Number.isFinite(value)) return fallback;
  if (typeof value === "object") return fallback;
  return value;
}

function formatCurrency(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return "Insufficient Data";
  return `$${parsed.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

function formatPercent(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return "Insufficient Data";
  return `${(parsed * 100).toFixed(1)}%`;
}

function normalizeDeal(deal) {
  return deal && typeof deal === "object" && !Array.isArray(deal) ? deal : {};
}

function normalizeAnalysis(analysis) {
  return analysis && typeof analysis === "object" && !Array.isArray(analysis) ? analysis : {};
}

function normalizeLender(lender) {
  return lender && typeof lender === "object" && !Array.isArray(lender) ? lender : {};
}

function isRentalStrategy(deal = {}) {
  return /brrrr|rental|hold/i.test(String(deal.strategy || deal.exitStrategy || ""));
}

export function scenarioPercentToInput(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed * 100 : "";
}

export function scenarioPercentFromInput(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed / 100 : 0;
}

export function deriveScenarioRecommendation({ profit, roi, overallRisk, survival } = {}) {
  const scenarioProfit = Number(profit);
  const scenarioRoi = Number(roi);
  const risk = Number(overallRisk);
  if (!Number.isFinite(scenarioProfit) || !Number.isFinite(scenarioRoi)) return "Insufficient Data";
  if (scenarioProfit <= 0 || scenarioRoi <= 0 || survival === "Fails") return "Re-underwrite";
  if (scenarioRoi < 0.05 || risk >= 70) return "Hold";
  if (scenarioRoi < 0.15 || risk >= 40 || survival === "Marginal") return "Continue With Controls";
  return "Continue Project";
}

function hasOwnValue(record, key) {
  return Object.prototype.hasOwnProperty.call(record || {}, key) && record[key] !== null && record[key] !== undefined && record[key] !== "";
}

function buildScenarioBase(deal, analysis, lender = {}) {
  const normalizedDeal = normalizeDeal(deal);
  const normalizedLender = normalizeLender(lender);
  const purchasePrice = safeNumber(normalizedDeal.purchasePrice ?? normalizedDeal.askingPrice);
  const rehabBudget = safeNumber(normalizedDeal.rehabBudget);
  const closingCosts = safeNumber(normalizedDeal.closingCosts);
  const financingCosts = safeNumber(normalizedDeal.financingCosts);
  const taxes = safeNumber(normalizedDeal.taxes);
  const insurance = safeNumber(normalizedDeal.insurance);
  const arv = safeNumber(normalizedDeal.estimatedArv ?? normalizedDeal.arv ?? normalizedDeal.projectedARV ?? normalizedDeal.currentValue);
  const rent = safeNumber(normalizedDeal.estimatedRent ?? normalizedDeal.marketRent ?? normalizedDeal.projectedRent);
  const vacancy = safeNumber(normalizedDeal.vacancyRate ?? normalizedDeal.vacancy ?? 0);
  const enteredSellingRate = hasOwnValue(normalizedDeal, "sellingCostRate") ? safeNumber(normalizedDeal.sellingCostRate) : null;
  const enteredSellingCosts = hasOwnValue(normalizedDeal, "sellingCosts") ? safeNumber(normalizedDeal.sellingCosts) : null;
  const sellingCostsPct = enteredSellingRate !== null
    ? (enteredSellingRate > 1 ? enteredSellingRate / 100 : enteredSellingRate)
    : enteredSellingCosts !== null && arv > 0 ? enteredSellingCosts / arv : 0;
  const baseSellingCosts = enteredSellingCosts ?? (arv * sellingCostsPct);
  const holdMonths = safeNumber(normalizedDeal.holdingMonths ?? normalizedDeal.holdingPeriodMonths ?? normalizedDeal.timelineMonths ?? 0);
  const interestRate = normalizeInterestRatePercent(normalizedLender.interestRate ?? normalizedDeal.annualInterestRate ?? normalizedDeal.interestRate) ?? 0;
  const totalHoldingCosts = safeNumber(normalizedDeal.holdingCosts ?? normalizedDeal.totalHoldingCosts ?? 0);
  const monthlyHoldingCost = hasOwnValue(normalizedDeal, "monthlyHoldingCost")
    ? safeNumber(normalizedDeal.monthlyHoldingCost)
    : holdMonths > 0 && totalHoldingCosts > 0 ? totalHoldingCosts / holdMonths : 0;

  return {
    purchasePrice,
    rehabBudget,
    closingCosts,
    financingCosts,
    taxes,
    insurance,
    arv,
    rent,
    vacancy,
    sellingCostsPct,
    baseSellingCosts,
    holdMonths,
    interestRate,
    monthlyHoldingCost,
    totalHoldingCosts,
  };
}

export function calculateScenario(deal, analysis, lender = {}, overrides = {}) {
  const normalizedDeal = normalizeDeal(deal);
  const normalizedAnalysis = normalizeAnalysis(analysis);
  const normalizedLender = normalizeLender(lender);
  const base = buildScenarioBase(normalizedDeal, normalizedAnalysis, normalizedLender);
  const rentalMetricsApplicable = isRentalStrategy(normalizedDeal) || overrides.evaluateRentalBackup === true;
  const sharedUnderwriting = buildUnifiedUnderwritingIntelligence(normalizedDeal, [], []);
  const arv = base.arv * (1 + safeNumber(overrides.arvPct ?? 0));
  const rehabBudget = base.rehabBudget * (1 + safeNumber(overrides.rehabPct ?? 0));
  const holdingMonths = base.holdMonths + safeNumber(overrides.timelineDays ?? 0) / 30;
  const interestRate = base.interestRate + safeNumber(overrides.rateChangePct ?? 0);
  const rent = base.rent * (1 + safeNumber(overrides.rentPct ?? 0));
  const vacancy = base.vacancy + safeNumber(overrides.vacancyPct ?? 0);
  const sellingCostsPct = base.sellingCostsPct + safeNumber(overrides.sellingCostPct ?? 0);
  const operatingExpensePct = safeNumber(overrides.operatingExpensePct ?? 0);
  const refinanceValuePct = safeNumber(overrides.refinanceValuePct ?? 0);
  const refinanceLtvAdjustment = safeNumber(overrides.refinanceLtvAdjustment ?? 0);
  const refinanceClosingCostPct = safeNumber(overrides.refinanceClosingCostPct ?? 0);
  const closingCostPct = safeNumber(overrides.closingCostPct ?? 0);
  const financingCostPct = safeNumber(overrides.financingCostPct ?? 0);
  const holdingCostPct = safeNumber(overrides.holdingCostPct ?? 0);

  const monthlyHoldingCost = base.monthlyHoldingCost * (1 + operatingExpensePct);
  const additionalHoldingMonths = Math.max(0, holdingMonths - base.holdMonths);
  const additionalHoldingCost = monthlyHoldingCost * additionalHoldingMonths;
  const financing = buildFinancingIntelligence({ ...normalizedDeal, purchasePrice: base.purchasePrice, rehabBudget, closingCosts: base.closingCosts, financingCosts: base.financingCosts, taxes: base.taxes, insurance: base.insurance, estimatedArv: arv, estimatedRent: rent, cashOnHand: normalizedDeal.cashOnHand }, { ...normalizedLender, interestRate, originationPoints: safeNumber(normalizedLender.originationPoints ?? 0), maximumLoanAmount: safeNumber(normalizedLender.maximumLoanAmount ?? 0), minimumLoanAmount: safeNumber(normalizedLender.minimumLoanAmount ?? 0), maximumLTC: safeNumber(normalizedLender.maximumLTC ?? 0), maximumPurchaseLTV: safeNumber(normalizedLender.maximumPurchaseLTV ?? 0), maximumARVLTV: safeNumber(normalizedLender.maximumARVLTV ?? 0), liquidityRequirement: safeNumber(normalizedLender.liquidityRequirement ?? 0), creditScoreMinimum: safeNumber(normalizedLender.creditScoreMinimum ?? 0), DSCRMinimum: safeNumber(normalizedLender.DSCRMinimum ?? 0), drawTurnaroundDays: safeNumber(normalizedLender.drawTurnaroundDays ?? 0), flexibilityScore: safeNumber(normalizedLender.flexibilityScore ?? 0) });

  const scenarioSellingCosts = base.baseSellingCosts + (arv * safeNumber(overrides.sellingCostPct ?? 0));
  const rehabDelta = rehabBudget - base.rehabBudget;
  const closingCostDelta = base.closingCosts * closingCostPct;
  const financingCostDelta = base.financingCosts * financingCostPct;
  const holdingCostStress = base.totalHoldingCosts * holdingCostPct;
  const rateStressCost = financing.loanAmount > 0
    ? financing.loanAmount * Math.max(0, interestRate - base.interestRate) / 100 / 12 * Math.max(holdingMonths, 0)
    : 0;
  const scenarioCostDelta = rehabDelta + closingCostDelta + financingCostDelta + additionalHoldingCost + holdingCostStress + rateStressCost;
  const sellingCostDelta = scenarioSellingCosts - base.baseSellingCosts;
  const revenueDelta = arv - base.arv;
  const totalProjectCost = sharedUnderwriting.flipAnalysis.totalProjectCost + scenarioCostDelta;
  const estimatedProfit = sharedUnderwriting.flipAnalysis.netProfit + revenueDelta - sellingCostDelta - scenarioCostDelta;
  const roi = totalProjectCost > 0 ? estimatedProfit / totalProjectCost : 0;
  const annualizedRoi = holdingMonths > 0 ? roi / (holdingMonths / 12) : 0;
  const monthlyCashFlow = rentalMetricsApplicable && financing.monthlyPrincipalAndInterest !== null ? rent * (1 - vacancy) - financing.monthlyPrincipalAndInterest - monthlyHoldingCost : null;
  const annualCashFlow = monthlyCashFlow !== null ? monthlyCashFlow * 12 : null;
  const noi = Math.max(0, rent * (1 - vacancy) - monthlyHoldingCost);
  const capRate = base.purchasePrice > 0 ? (noi * 12) / base.purchasePrice : 0;
  const dscr = rentalMetricsApplicable && financing.monthlyPrincipalAndInterest > 0 ? (rent * (1 - vacancy)) / financing.monthlyPrincipalAndInterest : null;
  const refinanceValue = arv * (1 + refinanceValuePct);
  const refinanceLtv = Math.max(0.5, 0.7 + refinanceLtvAdjustment);
  const refinanceLoan = refinanceValue * refinanceLtv;
  const cashReturned = refinanceLoan - (base.purchasePrice + rehabBudget) * refinanceClosingCostPct;
  const cashLeftInDeal = Math.max(0, financing.loanAmount - totalProjectCost + cashReturned);
  const mao = Math.max(0, (arv - totalProjectCost + financing.loanAmount) * 0.7);
  const recommendedOffer = Math.min(mao, base.purchasePrice);
  const walkAwayPrice = Math.max(0, mao * 0.9);
  const dealScore = Math.max(0, Math.min(100, Math.round((estimatedProfit > 0 ? 35 : 0) + (roi > 0.1 ? 20 : 0) + (rentalMetricsApplicable && dscr > 1.2 ? 15 : 0) + (rentalMetricsApplicable && capRate > 0.06 ? 10 : 0) + (financing.financingScore > 0 ? 20 : 0))));
  const overallRisk = Math.min(100, Math.max(0, (estimatedProfit <= 0 ? 25 : 0) + (roi <= 0.08 ? 20 : 0) + (rentalMetricsApplicable && (dscr === null || dscr < 1.2) ? 20 : 0) + (financing.financingWarnings.length * 10) + (rentalMetricsApplicable && vacancy > 0.05 ? 10 : 0)));
  const recommendationInput = {
    dealScore,
    buyBoxResult: normalizedAnalysis.buyBoxResult || "PASS",
    arvConfidence: normalizedAnalysis.arvConfidence || "Insufficient Data",
    supportedBaseArv: arv,
    marketScore: normalizedAnalysis.marketScore || 0,
    valuationScore: normalizedAnalysis.valuationScore || 0,
    rehabScore: Math.max(0, 100 - rehabBudget / Math.max(arv, 1) * 100),
    financingScore: financing.financingScore,
    financingWarnings: financing.financingWarnings,
    warnings: [],
    estimatedFlipProfit: estimatedProfit,
    roi,
    rentToCostRatio: rent / Math.max(totalProjectCost, 1),
    dscr,
    loanAmount: financing.loanAmount,
    cashRequired: financing.cashRequired,
    monthlyCashFlow,
    capRate,
    overallRisk,
    qualificationStatus: financing.qualifyingStatus,
    selectedLenderName: financing.selectedLender,
    recommendedExit: normalizedAnalysis.recommendedExit || "Hold",
    recommendedOffer,
    maximumAllowableOffer: mao,
    walkAwayPrice,
  };
  const recommendation = buildRecommendationEngine(normalizedDeal, recommendationInput);

  const warnings = [];
  if (estimatedProfit < 0) warnings.push("Negative profit");
  if (roi < 0.08) warnings.push("ROI below target");
  if (rentalMetricsApplicable && monthlyCashFlow < 0) warnings.push("Negative monthly cash flow");
  if (rentalMetricsApplicable && dscr !== null && dscr < safeNumber(normalizedLender.DSCRMinimum ?? normalizedLender.minimumDSCR ?? 1.2)) warnings.push("DSCR below lender requirement");
  if (rentalMetricsApplicable && dscr !== null && dscr < 1) warnings.push("DSCR below 1.00");
  if (hasOwnValue(normalizedDeal, "cashOnHand") && financing.cashRequired > safeNumber(normalizedDeal.cashOnHand)) warnings.push("Cash requirement exceeds available liquidity");
  if (base.purchasePrice > mao) warnings.push("Purchase price exceeds scenario MAO");
  if (base.purchasePrice > walkAwayPrice) warnings.push("Purchase price exceeds scenario walk-away price");
  if (cashReturned < 0) warnings.push("Refinance proceeds insufficient");
  if (cashLeftInDeal > 50000) warnings.push("Excessive cash left in deal");
  if (financing.financingWarnings.some((warning) => warning.includes("High") || warning.includes("Excessive") || warning.includes("Critical"))) warnings.push("Critical financing risk");
  if (rehabBudget > base.rehabBudget * 1.2) warnings.push("Critical rehab risk");
  if (recommendation.primaryRecommendation === "Pass" || recommendation.primaryRecommendation === "Reject") warnings.push("Recommendation changes to Pass or Reject");

  let survival = "Insufficient Data";
  if (estimatedProfit > 0 || roi > 0 || monthlyCashFlow > 0 || dscr > 0 || cashLeftInDeal > 0 || financing.cashRequired > 0 || mao > 0 || overallRisk >= 0) {
    if (estimatedProfit > 0 && roi >= 0.08 && (!rentalMetricsApplicable || (monthlyCashFlow >= 0 && dscr >= 1.2)) && cashLeftInDeal >= 0 && overallRisk <= 40 && !warnings.some((warning) => warning.includes("Critical"))) survival = "Survives";
    else if (estimatedProfit > 0 || roi >= 0.05 || (rentalMetricsApplicable && (monthlyCashFlow >= 0 || dscr >= 1))) survival = "Marginal";
    else survival = "Fails";
  }
  const scenarioRecommendation = deriveScenarioRecommendation({ profit: estimatedProfit, roi, overallRisk, survival });

  return {
    scenarioName: "",
    scenarioType: "",
    assumptions: {
      scenarioArv: arv,
      scenarioRehabCost: rehabBudget,
      scenarioHoldingPeriod: holdingMonths,
      scenarioHoldingPeriodUnit: "MONTHS",
      timelineDays: Math.round(holdingMonths * 30),
      scenarioInterestRate: interestRate,
      scenarioInterestRateUnit: "PERCENT_POINTS",
      scenarioRent: rent,
      scenarioVacancy: vacancy,
      scenarioSellingCosts: scenarioSellingCosts,
      scenarioFinancingCost: financing.totalFinancingCost,
      scenarioHoldingCost: additionalHoldingCost,
      scenarioOperatingExpensePct: operatingExpensePct,
      scenarioRefinanceValuePct: refinanceValuePct,
      scenarioRefinanceLtvAdjustment: refinanceLtvAdjustment,
      scenarioRefinanceClosingCostPct: refinanceClosingCostPct,
    },
    results: {
      totalProjectCost,
      profit: estimatedProfit,
      roi,
      annualizedRoi,
      monthlyCashFlow,
      annualCashFlow,
      noi,
      capRate,
      dscr,
      refinanceLoan,
      cashReturned,
      cashLeftInDeal,
      cashRequired: financing.cashRequired,
      mao,
      recommendedOffer,
      walkAwayPrice,
      dealScore,
      overallRisk,
      recommendation: scenarioRecommendation,
      recommendationDetails: recommendation,
      strategy: recommendation.strategyRecommendation,
      warningCount: warnings.length,
      recommendationImpact: "Unchanged",
      survival,
      warnings,
      financing,
      baseValues: {
        purchasePrice: base.purchasePrice,
        rehabBudget: base.rehabBudget,
        holdingMonths: base.holdMonths,
        interestRate: base.interestRate,
        rent: base.rent,
        vacancy: base.vacancy,
        sellingCostsPct: base.sellingCostsPct,
      },
    },
    baseSummary: {
      purchasePrice: base.purchasePrice,
      rehabBudget: base.rehabBudget,
      holdMonths: base.holdMonths,
      interestRate: base.interestRate,
      rent: base.rent,
      vacancy: base.vacancy,
      sellingCostsPct: base.sellingCostsPct,
    },
    summary: {
      scenarioArv: arv,
      scenarioRehabCost: rehabBudget,
      scenarioHoldingPeriod: holdingMonths,
      scenarioInterestRate: interestRate,
      scenarioInterestRateUnit: "PERCENT_POINTS",
      scenarioRent: rent,
      scenarioVacancy: vacancy,
      scenarioSellingCosts: scenarioSellingCosts,
      totalProjectCost,
      profit: estimatedProfit,
      roi,
      annualizedRoi,
      monthlyCashFlow,
      annualCashFlow,
      capRate,
      dscr,
      cashLeftInDeal,
      cashRequired: financing.cashRequired,
      mao,
      recommendedOffer,
      walkAwayPrice,
      dealScore,
      overallRisk,
      recommendation: scenarioRecommendation,
      strategy: recommendation.strategyRecommendation,
      warningCount: warnings.length,
      survival,
      warnings,
      recommendationImpact: "Unchanged",
      formatted: {
        totalProjectCost: formatCurrency(totalProjectCost),
        profit: formatCurrency(estimatedProfit),
        roi: formatPercent(roi),
        interestRate: `${interestRate.toFixed(2)}%`,
        monthlyCashFlow: monthlyCashFlow === null ? "N/A — FLIP STRATEGY" : formatCurrency(monthlyCashFlow),
        annualCashFlow: annualCashFlow === null ? "N/A — FLIP STRATEGY" : formatCurrency(annualCashFlow),
        capRate: formatPercent(capRate),
        dscr: dscr === null ? "N/A — FLIP STRATEGY" : Number.isFinite(dscr) ? dscr.toFixed(2) : "Insufficient Data",
        cashLeftInDeal: formatCurrency(cashLeftInDeal),
        cashRequired: formatCurrency(financing.cashRequired),
        mao: formatCurrency(mao),
        recommendedOffer: formatCurrency(recommendedOffer),
        walkAwayPrice: formatCurrency(walkAwayPrice),
      },
    },
  };
}

function getRecommendationImpact(baseRecommendation, scenarioRecommendation) {
  if (!baseRecommendation || !scenarioRecommendation) return "Unchanged";
  if (baseRecommendation === scenarioRecommendation) return "Unchanged";
  const severity = ["Improves", "Unchanged", "Weakens", "Materially Weakens", "Fails"];
  const index = Math.min(severity.length - 1, ["Strong Buy", "Buy", "Conditional Buy", "Re-Underwrite", "Hold", "Pass", "Reject"].indexOf(scenarioRecommendation) + 1);
  if (scenarioRecommendation === "Reject" || scenarioRecommendation === "Pass") return "Fails";
  if (scenarioRecommendation === "Hold") return "Weakens";
  return severity[index];
}

export function buildScenarioAnalysis(deal, analysis, lender = {}) {
  const normalizedDeal = normalizeDeal(deal);
  const hasDealData = Object.keys(normalizedDeal).some((key) => {
    const value = normalizedDeal[key];
    return value !== null && value !== undefined && value !== "";
  });

  if (!hasDealData) {
    return {
      baseScenario: {
        scenarioName: "",
        scenarioType: "",
        assumptions: {},
        results: {
          recommendation: "Insufficient Data",
          survival: "Insufficient Data",
          warningCount: 0,
          warnings: [],
          cashRequired: 0,
          monthlyCashFlow: 0,
          dealScore: 0,
          overallRisk: 0,
          recommendationImpact: "Unchanged",
        },
        baseSummary: {},
        summary: {
          formatted: {},
        },
      },
      scenarios: [],
      summary: {
        baseRecommendation: "Insufficient Data",
        worstCaseRecommendation: "Insufficient Data",
        bestCaseProfit: "Insufficient Data",
        expectedProfit: "Insufficient Data",
        worstCaseProfit: "Insufficient Data",
        expectedRoi: "Insufficient Data",
        worstCaseRoi: "Insufficient Data",
        downsideCashRequired: "Insufficient Data",
        downsideMonthlyCashFlow: "Insufficient Data",
        scenarioSurvivalResult: "Insufficient Data",
        failingScenarioCount: 0,
      },
    };
  }

  const baseScenario = calculateScenario(normalizedDeal, analysis, lender, {});
  const backupRentalEnabled = isRentalStrategy(normalizedDeal) || normalizedDeal.evaluateRentalBackup === true;
  const scenarios = [
    {
      scenarioName: "Best Case",
      scenarioType: "combined",
      overrides: { arvPct: 0.05 },
    },
    {
      scenarioName: "Expected Case",
      scenarioType: "base",
      overrides: {},
    },
    {
      scenarioName: "Moderate Downside",
      scenarioType: "combined",
      overrides: { arvPct: -0.05, rehabPct: 0.1, rateChangePct: 0.01, timelineDays: 60, rentPct: -0.05, vacancyPct: 0.02, sellingCostPct: 0.01 },
    },
    {
      scenarioName: "Severe Downside",
      scenarioType: "combined",
      overrides: { arvPct: -0.1, rehabPct: 0.2, rateChangePct: 0.02, timelineDays: 90, rentPct: -0.1, vacancyPct: 0.05, sellingCostPct: 0.02 },
    },
    {
      scenarioName: "Delayed Exit",
      scenarioType: "timeline",
      overrides: { rehabPct: 0.1, rateChangePct: 0.01, timelineDays: 180, sellingCostPct: 0.01 },
    },
    {
      scenarioName: "Refinance Stress",
      scenarioType: "combined",
      overrides: { refinanceValuePct: -0.1, refinanceLtvAdjustment: -0.05, rateChangePct: 0.02, refinanceClosingCostPct: 0.01, rentPct: -0.05, vacancyPct: 0.02 },
    },
    {
      scenarioName: "Rental Stress",
      scenarioType: "combined",
      overrides: { rentPct: -0.1, vacancyPct: 0.05, operatingExpensePct: 0.1, rateChangePct: 0.01 },
    },
  ].filter((entry) => backupRentalEnabled || !["Refinance Stress", "Rental Stress"].includes(entry.scenarioName));
  const scenarioResults = scenarios.map((entry) => {
    const result = calculateScenario(normalizedDeal, analysis, lender, entry.overrides);
    result.scenarioName = entry.scenarioName;
    result.scenarioType = entry.scenarioType;
    result.results.recommendationImpact = getRecommendationImpact(baseScenario.results.recommendation, result.results.recommendation);
    result.results.survival = result.results.survival || "Insufficient Data";
    return result;
  });
  const expected = scenarioResults.find((entry) => entry.scenarioName === "Expected Case");
  const worstCase = scenarioResults.slice().sort((a, b) => a.results.dealScore - b.results.dealScore)[0];
  const bestCase = scenarioResults.slice().sort((a, b) => b.results.profit - a.results.profit)[0];
  return {
    baseScenario,
    scenarios: scenarioResults,
    summary: {
      baseRecommendation: baseScenario.results.recommendation,
      worstCaseRecommendation: worstCase?.results.recommendation || "Insufficient Data",
      bestCaseProfit: bestCase?.results.profit ?? "Insufficient Data",
      expectedProfit: expected?.results.profit ?? "Insufficient Data",
      worstCaseProfit: worstCase?.results.profit ?? "Insufficient Data",
      expectedRoi: expected?.results.roi ?? "Insufficient Data",
      worstCaseRoi: worstCase?.results.roi ?? "Insufficient Data",
      downsideCashRequired: worstCase?.results.cashRequired ?? "Insufficient Data",
      downsideMonthlyCashFlow: worstCase?.results.monthlyCashFlow ?? "Insufficient Data",
      scenarioSurvivalResult: expected?.results.survival || "Insufficient Data",
      failingScenarioCount: scenarioResults.filter((entry) => entry.results.survival === "Fails").length,
    },
  };
}
