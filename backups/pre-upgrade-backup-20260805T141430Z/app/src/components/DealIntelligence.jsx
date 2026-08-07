import { useEffect, useMemo, useState } from "react";
import { buildApiUrl } from "../utils/apiClient.js";
import { buildDealIntelligenceViewModel } from "../utils/enterpriseUiIntegration.js";
import logo from "../assets/royal-star-logo.png";
import { buildFinancingIntelligence, buildLenderComparison } from "./financeIntelligence.js";
import { buildRecommendationEngine } from "./recommendationEngine.js";
import { buildScenarioAnalysis, safeDisplay as scenarioSafeDisplay } from "./scenarioAnalysis.js";
import { buildRedTeamReview, safeDisplay as redTeamSafeDisplay } from "./redTeamReview.js";
import { buildExecutiveDecisionDashboard } from "./executiveDecisionDashboard.js";
import { buildExecutiveDecisionExecutionEngine } from "./executiveDecisionExecutionEngine.js";
import { buildRefinanceExitOptimizer } from "./refinanceExitOptimizer.js";
import { buildArvIntelligence, buildBuyBoxIntelligence, buildOfferIntelligence, buildAppraisalIntelligence, normalizeDealForIntelligence, buildUnifiedUnderwritingIntelligence, buildUnderwritingMetrics, buildEnterpriseDealIntelligenceSummary } from "./intelligenceUpgradeEngine.js";
import { buildAiDecisionEngine } from "./aiDecisionEngine.js";

const API_BASE_URL = "";

const navigation = [
  ["🏠", "COMMAND CENTER"],
  ["🔎", "DEAL ANALYZER"],
  ["📈", "FLIP ANALYZER"],
  ["💳", "BRRRR ANALYZER"],
  ["▣", "PRODUCT VAULT"],
  ["👥", "CONTRACTOR HUB"],
  ["🏘️", "COMP DATABASE"],
  ["📍", "NEIGHBORHOOD DB"],
  ["👥", "PORTFOLIO DASHBOARD"],
  ["🏦", "LENDER DASHBOARD"],
  ["📄", "APPRAISER PACKET BUILDER"],
  ["🗂️", "PROPERTY DATABASE"],
  ["🗃️", "VENDOR DATABASE"],
  ["▪", "MATERIAL MATRIX"],
];

function safeNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function safeDisplay(value, fallback = "Insufficient Data") {
  if (value === null || value === undefined || value === "" || Number.isNaN(value)) return fallback;
  if (typeof value === "number" && !Number.isFinite(value)) return fallback;
  return value;
}

function formatCurrency(value) {
  if (!Number.isFinite(value)) return "Insufficient Data";
  return `$${value.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

function formatPercent(value) {
  if (!Number.isFinite(value)) return "Insufficient Data";
  return `${(value * 100).toFixed(1)}%`;
}

function normalizeDecisionLabel(value, fallback = "Insufficient Data") {
  if (value === null || value === undefined || value === "") return fallback;
  const normalized = String(value).trim().toUpperCase();
  if (!normalized) return fallback;
  const map = {
    PROCEED: "Strong Buy",
    "STRONG BUY": "Strong Buy",
    BUY: "Buy",
    "REQUEST MORE DATA": "Re-underwrite",
    "CONDITIONAL BUY": "Conditional Buy",
    "CONTINUE PROJECT": "Continue Project",
    "CONTINUE REHAB": "Continue Rehab",
    HOLD: "Hold",
    REJECT: "Do Not Purchase",
    "DO NOT PURCHASE": "Do Not Purchase",
  };
  return map[normalized] || String(value).trim();
}

export function buildDealIntelligenceDisplayBindings({ deal, underwritingDecision, recommendation, financing }) {
  const dealStatus = String(deal?.status || "").trim().toLowerCase();
  const isProjectContinuationContext = ["owned", "active rehab", "active project", "in progress", "rehab in progress"].includes(dealStatus);
  const sharedRecommendationAction = String(underwritingDecision?.recommendation?.action || underwritingDecision?.decisionConsistency?.recommendation || "REJECT").trim().toUpperCase();
  const investmentDecision = String(underwritingDecision?.decisionConsistency?.investmentDecision || sharedRecommendationAction || "REJECT").trim();
  const decisionLabel = normalizeDecisionLabel(investmentDecision, "Do Not Purchase");
  const continuationStrategy = sharedRecommendationAction === "CONTINUE PROJECT"
    ? "Continue Project"
    : sharedRecommendationAction === "CONTINUE REHAB"
      ? "Continue Rehab"
      : sharedRecommendationAction === "HOLD"
        ? "Hold"
        : recommendation?.strategyRecommendation || "Hold";
  const strategyLabel = isProjectContinuationContext ? continuationStrategy : normalizeDecisionLabel(recommendation?.strategyRecommendation || decisionLabel, "Hold");
  const actualLoanAmount = safeNumber(underwritingDecision?.financingAnalysis?.actualLoanAmount ?? financing?.loanAmount ?? 0);
  const monthlyCarry = safeNumber(underwritingDecision?.financingAnalysis?.monthlyCarry ?? financing?.monthlyPrincipalAndInterest ?? 0);
  const initialCashInvested = safeNumber(underwritingDecision?.financingAnalysis?.initialCashInvested ?? financing?.cashRequired ?? 0);
  const loanAmountLabel = underwritingDecision?.financingAnalysis?.actualLoanAmount != null && underwritingDecision.financingAnalysis.actualLoanAmount > 0 ? "Actual Loan Amount" : "Recalculated Financed Amount";

  return {
    recommendationDecision: decisionLabel,
    recommendationStrategy: strategyLabel,
    actualLoanAmount,
    monthlyCarry,
    initialCashInvested,
    loanAmountLabel,
  };
}

function buildDealAnalysis(deal, comps, neighborhoods, lenders = [], selectedLenderId = "") {
  const normalizedDeal = normalizeDealForIntelligence(deal);
  const purchasePrice = safeNumber(normalizedDeal.purchasePrice ?? normalizedDeal.askingPrice);
  const rehabBudget = safeNumber(normalizedDeal.rehabBudget);
  const financingCosts = safeNumber(normalizedDeal.financingCosts);
  const closingCosts = safeNumber(normalizedDeal.closingCosts);
  const taxes = safeNumber(normalizedDeal.taxes);
  const insurance = safeNumber(normalizedDeal.insurance);
  const arv = safeNumber(normalizedDeal.estimatedArv ?? normalizedDeal.arv ?? normalizedDeal.projectedARV ?? normalizedDeal.currentValue);
  const estimatedRent = safeNumber(normalizedDeal.estimatedRent ?? normalizedDeal.marketRent ?? normalizedDeal.projectedRent);
  const askingPrice = safeNumber(normalizedDeal.askingPrice);
  const projectedArv = safeNumber(normalizedDeal.projectedARV ?? normalizedDeal.estimatedArv ?? normalizedDeal.arv);
  const supportedArv = safeNumber(normalizedDeal.supportedARV ?? 0);
  const appraisedValue = safeNumber(normalizedDeal.appraisedValue ?? 0);
  const propertyType = normalizedDeal.propertyType || "";
  const strategy = normalizedDeal.strategy || "";
  const squareFeet = safeNumber(normalizedDeal.squareFeet);
  const bedrooms = safeNumber(normalizedDeal.bedrooms);
  const bathrooms = safeNumber(normalizedDeal.bathrooms);
  const yearBuilt = safeNumber(normalizedDeal.yearBuilt);
  const zipCode = normalizedDeal.zipCode || normalizedDeal.zip || "";
  const city = normalizedDeal.city || "";
  const state = normalizedDeal.state || "";
  const address = normalizedDeal.propertyAddress || normalizedDeal.address || "";
  const neighborhoodName = normalizedDeal.neighborhood || "";

  const selectedLender = (lenders || []).find((entry) => entry.id === selectedLenderId) || null;
  const financing = buildFinancingIntelligence(normalizedDeal, selectedLender || {});
  const lenderComparison = buildLenderComparison(deal, lenders);
  const underwritingMetrics = buildUnderwritingMetrics(normalizedDeal, financing, { includeContingency: false, includeHoldingCost: false, includeTaxesAndInsurance: true, includeExtraCosts: false });
  const underwritingDecision = buildUnifiedUnderwritingIntelligence(normalizedDeal, comps, neighborhoods);
  const sharedDecision = underwritingDecision?.sharedDecision || null;
  const totalProjectCost = underwritingMetrics.totalProjectCost;
  const estimatedSellingCosts = underwritingMetrics.sellingCosts;
  const grossSpread = underwritingMetrics.grossProfit;
  const canonicalProjectedProfit = safeNumber(sharedDecision?.projectedProfit ?? underwritingMetrics.profit ?? underwritingDecision?.flipAnalysis?.netProfit ?? 0);
  const estimatedFlipProfit = canonicalProjectedProfit;
  const roi = underwritingMetrics.roi;
  const rentToCostRatio = totalProjectCost > 0 ? estimatedRent / totalProjectCost : 0;
  const arvDiscount = arv > 0 ? 1 - ((purchasePrice + rehabBudget) / arv) : 0;

  const validComps = (comps || []).filter((entry) => {
    if (!entry || entry.included === false) return false;
    const sameAddress = address && entry.compAddress && entry.compAddress.toLowerCase() === address.toLowerCase();
    const sameZip = zipCode && entry.zipCode && entry.zipCode === zipCode;
    const sameCity = city && entry.city && entry.city.toLowerCase() === city.toLowerCase();
    const sameNeighborhood = neighborhoodName && entry.neighborhood && entry.neighborhood.toLowerCase() === neighborhoodName.toLowerCase();
    const samePropertyType = propertyType && entry.propertyType && entry.propertyType.toLowerCase() === propertyType.toLowerCase();
    const sameBedrooms = bedrooms && entry.bedrooms && Number(entry.bedrooms) === bedrooms;
    const sameBathrooms = bathrooms && entry.bathrooms && Number(entry.bathrooms) === bathrooms;
    const sameSqFt = squareFeet && entry.squareFeet && Math.abs(Number(entry.squareFeet) - squareFeet) <= squareFeet * 0.25;
    return sameAddress || sameZip || sameCity || sameNeighborhood || samePropertyType || sameBedrooms || sameBathrooms || sameSqFt;
  });

  const compCount = validComps.length;
  const avgSalePrice = compCount ? validComps.reduce((sum, entry) => sum + safeNumber(entry.salePrice), 0) / compCount : 0;
  const medianSalePrice = compCount ? [...validComps].sort((a, b) => safeNumber(a.salePrice) - safeNumber(b.salePrice))[Math.floor(compCount / 2)]?.salePrice || 0 : 0;
  const lowestSalePrice = compCount ? Math.min(...validComps.map((entry) => safeNumber(entry.salePrice))) : 0;
  const highestSalePrice = compCount ? Math.max(...validComps.map((entry) => safeNumber(entry.salePrice))) : 0;
  const avgPricePerSqft = compCount ? validComps.reduce((sum, entry) => sum + (safeNumber(entry.squareFeet) > 0 ? safeNumber(entry.salePrice) / safeNumber(entry.squareFeet) : 0), 0) / compCount : 0;
  const subjectPricePerSqft = squareFeet > 0 ? purchasePrice / squareFeet : 0;
  const averageDistance = compCount ? validComps.reduce((sum, entry) => sum + safeNumber(entry.distanceMiles), 0) / compCount : 0;
  const averageSaleDate = compCount ? validComps.reduce((sum, entry) => sum + (entry.saleDate ? new Date(entry.saleDate).getTime() : 0), 0) / compCount : 0;
  const priceVariance = compCount ? ((avgSalePrice || 1) > 0 ? Math.abs((purchasePrice || avgSalePrice) - avgSalePrice) / avgSalePrice : 0) : 0;
  const squareFootageVariance = squareFeet && compCount ? Math.abs(squareFeet - (validComps.reduce((sum, entry) => sum + safeNumber(entry.squareFeet), 0) / compCount)) / Math.max(squareFeet, 1) : 0;

  const unifiedUnderwriting = underwritingDecision;
  const upgradeArv = unifiedUnderwriting.arvAnalysis;
  const upgradeBuyBox = unifiedUnderwriting.buyBox;
  const upgradeOffer = buildOfferIntelligence(normalizedDeal, { supportedBaseArv: upgradeArv.supportedBaseArv, supportedLowArv: upgradeArv.supportedLowArv, supportedHighArv: upgradeArv.supportedHighArv, confidenceLevel: upgradeArv.confidenceLabel === "HIGH" ? "High" : upgradeArv.confidenceLabel === "MODERATE" ? "Moderate" : upgradeArv.confidenceLabel === "LOW" ? "Low" : "Insufficient Data" }, upgradeBuyBox, { loanAmount: financing.loanAmount });
  const upgradeAppraisal = unifiedUnderwriting.appraisal;

  const supportedLowArv = upgradeArv.supportedLowArv || (compCount ? avgSalePrice * 0.9 : 0);
  const supportedBaseArv = upgradeArv.supportedBaseArv || (compCount ? avgSalePrice : 0);
  const supportedHighArv = upgradeArv.supportedHighArv || (compCount ? avgSalePrice * 1.1 : 0);

  let confidenceLabel = upgradeArv.confidenceLabel || "Insufficient Data";
  let confidenceScore = 0;
  if (compCount >= 3) {
    const ageScore = Math.max(0, 100 - Math.min(100, (Date.now() - averageSaleDate) / (1000 * 60 * 60 * 24 * 365) * 20));
    const distanceScore = Math.max(0, 100 - Math.min(100, averageDistance * 10));
    const similarityScore = Math.max(0, 100 - Math.min(100, (Math.abs((bedrooms || 0) - (validComps.reduce((sum, entry) => sum + safeNumber(entry.bedrooms), 0) / Math.max(compCount, 1))) * 20 + Math.abs((bathrooms || 0) - (validComps.reduce((sum, entry) => sum + safeNumber(entry.bathrooms), 0) / Math.max(compCount, 1))) * 15 + squareFootageVariance * 100)));
    const neighborhoodScore = neighborhoodName ? 90 : 50;
    const priceConsistencyScore = Math.max(0, 100 - Math.min(100, priceVariance * 100));
    const appraisalSupport = appraisedValue > 0 ? 85 : 50;
    confidenceScore = Math.round((compCount / 6) * 25 + ageScore * 0.15 + distanceScore * 0.15 + similarityScore * 0.2 + neighborhoodScore * 0.1 + priceConsistencyScore * 0.1 + appraisalSupport * 0.05);
    if (confidenceScore >= 85) confidenceLabel = "Very High";
    else if (confidenceScore >= 70) confidenceLabel = "High";
    else if (confidenceScore >= 50) confidenceLabel = "Moderate";
    else if (confidenceScore >= 30) confidenceLabel = "Low";
    else confidenceLabel = "Very Low";
  } else if (compCount === 2 || compCount === 1) {
    confidenceLabel = compCount === 0 ? "Insufficient Data" : "Low";
    confidenceScore = compCount === 2 ? 35 : 20;
  }

  const neighborhood = (neighborhoods || []).find((entry) => {
    const sameName = neighborhoodName && entry.neighborhoodName && entry.neighborhoodName.toLowerCase() === neighborhoodName.toLowerCase();
    const sameCity = city && entry.city && entry.city.toLowerCase() === city.toLowerCase();
    const sameZip = zipCode && entry.zipCode && entry.zipCode === zipCode;
    return sameName || sameCity || sameZip;
  });

  const marketGrade = neighborhood?.marketGrade || "Unknown";
  const rentalDemand = safeNumber(neighborhood?.rentalDemandScore ?? neighborhood?.rentalDemand ?? neighborhood?.investorDemandScore);
  const appreciation = safeNumber(neighborhood?.appreciation1Year ?? neighborhood?.appreciation3Year ?? neighborhood?.appreciation5Year ?? neighborhood?.appreciation10Year);
  const employmentScore = safeNumber(neighborhood?.employmentGrowth);
  const populationGrowth = safeNumber(neighborhood?.populationGrowth);
  const vacancyRisk = safeNumber(neighborhood?.vacancyRate ?? neighborhood?.vacancy);
  const liquidityScore = safeNumber(neighborhood?.liquidityScore ?? neighborhood?.investorDemandScore);
  const crimeRisk = safeNumber(neighborhood?.crimeRating === "Low" ? 10 : neighborhood?.crimeRating === "Moderate" ? 30 : neighborhood?.crimeRating === "High" ? 70 : 0);
  const daysOnMarket = safeNumber(neighborhood?.averageDaysOnMarket ?? neighborhood?.daysOnMarket);

  const marketScore = Math.round(Math.max(0, Math.min(100, 25 + rentalDemand * 0.3 + appreciation * 20 + employmentScore * 5 + populationGrowth * 2 + (100 - vacancyRisk * 100) * 0.2 + liquidityScore * 0.2 + (100 - crimeRisk) * 0.2 + Math.max(0, 100 - daysOnMarket * 0.3))));

  const buyBoxResult = (() => {
    const result = upgradeBuyBox.decision;
    if (result === "Automatic Reject") return { result: "FAIL", reason: upgradeBuyBox.decisionBreakingRule || "Automatic reject due to prohibited property type or out-of-box location.", exceptions: upgradeBuyBox.rulesFailed };
    if (result === "Strong Pass") return { result: "PASS", reason: "Meets the primary Royal Star buy box criteria.", exceptions: [] };
    if (result === "Pass") return { result: "PASS", reason: upgradeBuyBox.exceptionJustification || "Meets the primary Royal Star buy box criteria.", exceptions: upgradeBuyBox.conditionalRules };
    if (result === "Conditional Pass") return { result: "CONDITIONAL PASS", reason: upgradeBuyBox.exceptionJustification || "Conditional pass based on selective rubric.", exceptions: upgradeBuyBox.conditionalRules };
    if (result === "Selective Area Review") return { result: "CONDITIONAL PASS", reason: upgradeBuyBox.exceptionJustification || "Selective area review required.", exceptions: upgradeBuyBox.rulesFailed };
    return { result: "FAIL", reason: upgradeBuyBox.exceptionJustification || "Outside the buy box.", exceptions: upgradeBuyBox.rulesFailed };
  })();

  const valuationScore = Math.round(Math.max(0, Math.min(100, 30 + (supportedArv > 0 ? 20 : 0) + (appraisedValue > 0 ? 15 : 0) + (compCount >= 3 ? 20 : compCount >= 1 ? 10 : 0) + (projectedArv > 0 ? 15 : 0))));
  const valuationExplanation = supportedArv > 0 ? `Supported ARV of ${formatCurrency(supportedArv)} provides a clear basis for valuation.` : "Supported ARV is not yet established.";
  const upgradedOfferSummary = upgradeOffer.offerSummary;

  const warnings = [];
  if (compCount === 0) warnings.push("No comps");
  if (compCount > 0 && compCount < 3) warnings.push("Weak comps");
  if (averageDistance > 8) warnings.push("Old comps");
  if (priceVariance > 0.15) warnings.push("High variance");
  if (!supportedArv) warnings.push("Unsupported ARV");
  if (buyBoxResult.result !== "PASS") warnings.push("Property outside Buy Box");
  if (vacancyRisk > 0.08) warnings.push("High vacancy");
  if (rentalDemand < 60) warnings.push("Weak rental demand");
  if (daysOnMarket > 60) warnings.push("Slow market");
  if (rehabBudget > 75000) warnings.push("Excessive rehab budget");
  if (!appraisedValue) warnings.push("Missing appraisal");
  if (!neighborhood) warnings.push("Missing neighborhood data");

  const dataCompleteness = [address, city, state, askingPrice, purchasePrice, rehabBudget, projectedArv, estimatedRent].filter(Boolean).length / 8;
  const arvMarginScore = Math.max(0, Math.min(25, grossSpread / Math.max(arv, 1) * 25));
  const profitScore = Math.max(0, Math.min(20, estimatedFlipProfit / Math.max(arv, 1) * 20));
  const roiScore = Math.max(0, Math.min(20, Math.max(0, roi) * 20));
  const rehabRiskScore = Math.max(0, Math.min(15, 15 - Math.min(15, rehabBudget / Math.max(arv, 1) * 15)));
  const rentPotentialScore = Math.max(0, Math.min(10, rentToCostRatio * 10));
  const completenessScore = Math.max(0, Math.min(10, dataCompleteness * 10));
  const dealScore = Math.round(arvMarginScore + profitScore + roiScore + rehabRiskScore + rentPotentialScore + completenessScore + Math.min(10, marketScore / 10) + Math.min(10, valuationScore / 10));

  let grade = "F";
  if (dealScore >= 85) grade = "A";
  else if (dealScore >= 70) grade = "B";
  else if (dealScore >= 55) grade = "C";
  else if (dealScore >= 40) grade = "D";

  const riskScore = Math.min(100, Math.round(Math.max(0, 100 - dealScore) + Math.max(0, rehabBudget / Math.max(arv, 1) * 25) + (estimatedRent > 0 ? 5 : 10) + warnings.length * 3));
  const recommendedExit = buyBoxResult.result === "FAIL" ? "Pass" : estimatedFlipProfit > 40000 && roi > 0.15 ? "Flip" : rentToCostRatio > 0.01 && (purchasePrice + rehabBudget) > 0 && arv > 0 ? "BRRRR" : estimatedRent > 0 && roi > 0 ? "Hold" : "Hold";
  const overallDealScore = Math.round(dealScore * 0.75 + financing.financingScore * 0.25);
  const rehabScore = Math.max(0, Math.min(100, 100 - Math.min(100, (rehabBudget / Math.max(arv, 1)) * 100)));
  const monthlyCashFlow = estimatedRent - financing.monthlyPrincipalAndInterest;
  const capRate = purchasePrice > 0 ? (estimatedRent * 12) / purchasePrice : 0;
  const overallRisk = Math.min(100, Math.max(0, riskScore + financing.financingWarnings.length * 5 + warnings.length * 3));
  const recommendationInput = {
    dealScore: overallDealScore,
    buyBoxResult: buyBoxResult.result,
    arvConfidence: confidenceLabel,
    supportedBaseArv,
    marketScore,
    valuationScore,
    rehabScore,
    financingScore: financing.financingScore,
    financingWarnings: financing.financingWarnings,
    warnings,
    estimatedFlipProfit,
    roi,
    rentToCostRatio,
    dscr: financing.dscr,
    loanAmount: financing.loanAmount,
    cashRequired: financing.cashRequired,
    monthlyCashFlow,
    capRate,
    overallRisk,
    qualificationStatus: financing.qualifyingStatus,
    selectedLenderName: financing.selectedLender,
    recommendedExit,
    recommendedOffer: upgradeOffer.recommendedOpeningOffer,
    maximumAllowableOffer: upgradeOffer.maximumOffer,
    walkAwayPrice: upgradeOffer.walkAwayPrice,
  };
  const recommendation = buildRecommendationEngine(normalizedDeal, recommendationInput);
  const displayBindings = buildDealIntelligenceDisplayBindings({ deal: normalizedDeal, underwritingDecision, recommendation, financing });
  const aiDecisionEngine = buildAiDecisionEngine({
    deal: normalizedDeal,
    analysis: recommendationInput,
    deals: [normalizedDeal],
    rehabProjects: [],
    contractors: [],
    lenders: lenders || [],
    portfolioIntelligence: { summary: { healthScore: 70, reserveShortfallValue: 0 } },
  });
  const strengths = [];
  if (estimatedFlipProfit > 0) strengths.push("Positive estimated flip profit");
  if (roi > 0.1) strengths.push("Strong ROI profile");
  if (rentToCostRatio > 0.01) strengths.push("Solid rent-to-cost ratio");
  if (arvDiscount > 0) strengths.push("Healthy ARV discount cushion");
  if (compCount >= 3) strengths.push("Three or more quality comps available");
  if (neighborhood) strengths.push("Neighborhood data available");

  const risks = [];
  if (estimatedFlipProfit <= 0) risks.push("Estimated flip profit is negative");
  if (roi <= 0) risks.push("ROI is below break-even");
  if (rehabBudget > 0 && rehabBudget > arv * 0.4) risks.push("Rehab budget is aggressive relative to ARV");
  if (!purchasePrice || !rehabBudget || !projectedArv) risks.push("Key cost inputs are missing");
  if (estimatedRent <= 0) risks.push("Rental estimate is missing or weak");
  if (buyBoxResult.result !== "PASS") risks.push("Property is outside the buy box");

  const inheritedRiskScore = safeNumber(sharedDecision?.overallRiskScore ?? riskScore);
  const inheritedRiskLabel = safeDisplay(sharedDecision?.overallRiskLabel || (inheritedRiskScore >= 70 ? "High" : inheritedRiskScore >= 40 ? "Moderate" : "Low"), "Low");
  const inheritedArvConfidence = safeDisplay(sharedDecision?.arvConfidence || confidenceLabel, confidenceLabel);
  const inheritedDecisionConfidence = safeNumber(sharedDecision?.decisionConfidence ?? 0);
  const sharedRecommendation = safeDisplay(sharedDecision?.baseRecommendation || sharedDecision?.primaryAction || displayBindings.recommendationDecision, displayBindings.recommendationDecision);

  return {
    ...normalizedDeal,
    buyBox: upgradeBuyBox,
    appraisalIntelligence: upgradeAppraisal,
    totalProjectCost,
    grossSpread,
    estimatedFlipProfit,
    roi,
    rentToCostRatio,
    arvDiscount,
    dealScore: overallDealScore,
    baseDealScore: dealScore,
    grade,
    riskScore: inheritedRiskScore,
    riskLevel: inheritedRiskLabel,
    overallRiskScore: inheritedRiskScore,
    baseRecommendation: sharedRecommendation,
    recommendedExit,
    strengths: strengths.length ? strengths : ["Core metrics available but need more support data"],
    risks: risks.length ? risks : ["Risk profile appears manageable with current data"],
    askingPrice,
    compCount,
    avgSalePrice,
    medianSalePrice,
    lowestSalePrice,
    highestSalePrice,
    avgPricePerSqft,
    subjectPricePerSqft: subjectPricePerSqft,
    averageDistance,
    averageSaleDate,
    priceVariance,
    squareFootageVariance,
    supportedLowArv,
    supportedBaseArv,
    supportedHighArv,
    arvConfidence: inheritedArvConfidence,
    arvConfidenceScore: confidenceScore,
    marketGrade,
    marketScore,
    appreciationScore: appreciation,
    rentalDemand,
    vacancyRisk,
    crimeRisk,
    employmentScore,
    populationGrowth,
    daysOnMarket,
    liquidityScore,
    buyBoxResult: buyBoxResult.result,
    buyBoxReason: buyBoxResult.reason,
    buyBoxExceptions: buyBoxResult.exceptions,
    valuationScore,
    valuationExplanation,
    warnings,
    financing,
    selectedLenderId,
    selectedLenderName: financing.selectedLender,
    financingScore: financing.financingScore,
    financingGrade: financing.financingGrade,
    financingRisk: financing.financingRisk,
    qualificationStatus: financing.qualifyingStatus,
    financingWarnings: financing.financingWarnings,
    lenderComparison,
    qualificationFailures: financing.qualificationFailures,
    recommendation,
    recommendationDecision: safeDisplay(sharedDecision?.primaryAction || sharedRecommendation || displayBindings.recommendationDecision, displayBindings.recommendationDecision),
    recommendationStrategy: safeDisplay(sharedDecision?.strategy || displayBindings.recommendationStrategy, displayBindings.recommendationStrategy),
    underwritingSummary: safeDisplay(unifiedUnderwriting?.recommendation?.action || unifiedUnderwriting?.recommendation?.nextAction || "Insufficient Data", "Insufficient Data"),
    arvOutput: safeNumber(unifiedUnderwriting?.arvAnalysis?.supportedBaseArv ?? 0),
    offerGuidance: safeDisplay(unifiedUnderwriting?.mao?.targetOffer || unifiedUnderwriting?.recommendation?.nextAction || "Insufficient Data", "Insufficient Data"),
    exitStrategyComparison: safeDisplay(unifiedUnderwriting?.exitStrategy?.recommendedStrategy || "Insufficient Data", "Insufficient Data"),
    capitalRequired: safeNumber(unifiedUnderwriting?.financingAnalysis?.cashRequired ?? unifiedUnderwriting?.financingAnalysis?.initialCashInvested ?? 0),
    estimatedProfit: safeNumber(unifiedUnderwriting?.flipAnalysis?.netProfit ?? 0),
    estimatedCashFlow: safeNumber(unifiedUnderwriting?.brrrrAnalysis?.monthlyCashFlow ?? 0),
    loanAmount: displayBindings.actualLoanAmount,
    cashRequired: displayBindings.initialCashInvested,
    monthlyPayment: displayBindings.monthlyCarry,
    dscr: financing.dscr,
    activeWarnings: financing.activeWarnings,
    upgradeArv,
    upgradeBuyBox,
    upgradeOffer,
    upgradeAppraisal,
    actualLoanAmount: displayBindings.actualLoanAmount,
    monthlyCarry: displayBindings.monthlyCarry,
    initialCashInvested: displayBindings.initialCashInvested,
    loanAmountLabel: displayBindings.loanAmountLabel,
    aiDecisionEngine,
    sharedDecision,
    decisionConfidence: inheritedDecisionConfidence,
    investmentDecision: {
      recommendation: safeDisplay(sharedDecision?.investmentDecision || sharedRecommendation || displayBindings.recommendationDecision || recommendation?.primaryRecommendation || "Insufficient Data", "Insufficient Data"),
      confidence: inheritedDecisionConfidence,
      primaryFactors: sharedDecision?.reasons || [],
      recommendedNextActions: sharedDecision?.blockingActions?.length ? sharedDecision.blockingActions : sharedDecision?.warnings || [],
    },
  };
}

export default function DealIntelligence({ onBack }) {
  const [deals, setDeals] = useState([]);
  const [comps, setComps] = useState([]);
  const [neighborhoods, setNeighborhoods] = useState([]);
  const [lenders, setLenders] = useState([]);
  const [selectedLenderIds, setSelectedLenderIds] = useState({});
  const [recalcTick, setRecalcTick] = useState(0);
  const [connectionState, setConnectionState] = useState("Backend Connected");
  const [refreshKey, setRefreshKey] = useState(0);
  const [scenarioState, setScenarioState] = useState({
    arvPct: 0.05,
    rehabPct: 0.1,
    timelineDays: 60,
    rateChangePct: 0.01,
    rentPct: -0.05,
    vacancyPct: 0.02,
    sellingCostPct: 0.01,
    operatingExpensePct: 0.05,
    refinanceValuePct: -0.1,
    refinanceLtvAdjustment: -0.05,
    refinanceClosingCostPct: 0.01,
  });
  const [savedScenarios, setSavedScenarios] = useState([]);
  const [selectedScenario, setSelectedScenario] = useState(null);
  const [scenarioMessage, setScenarioMessage] = useState("");
  const [liveDealIntelligence, setLiveDealIntelligence] = useState([]);

  const loadData = async () => {
    try {
      const [dealsResponse, compsResponse, neighborhoodsResponse, lendersResponse] = await Promise.all([
        fetch(buildApiUrl("/api/deals")),
        fetch(buildApiUrl("/api/comps")),
        fetch(buildApiUrl("/api/neighborhoods")),
        fetch(buildApiUrl("/api/lenders")),
      ]);

      if (!dealsResponse.ok || !compsResponse.ok || !neighborhoodsResponse.ok || !lendersResponse.ok) {
        throw new Error("Unable to fetch intelligence data");
      }

      const [apiDeals, apiComps, apiNeighborhoods, apiLenders] = await Promise.all([
        dealsResponse.json(),
        compsResponse.json(),
        neighborhoodsResponse.json(),
        lendersResponse.json(),
      ]);

      let normalizedBackendIntelligence = [];
      try {
        const intelligenceResponse = await fetch(buildApiUrl('/api/deal-intelligence'));
        if (intelligenceResponse.ok) {
          const parsed = await intelligenceResponse.json();
          normalizedBackendIntelligence = Array.isArray(parsed) ? parsed : [];
        }
      } catch (intelligenceError) {
        console.warn("Deal intelligence endpoint unavailable; using live deal analysis instead.", intelligenceError);
      }

      const normalizedDeals = Array.isArray(apiDeals) ? apiDeals : [];
      setLiveDealIntelligence(normalizedBackendIntelligence);
      setDeals(normalizedDeals);
      setComps(Array.isArray(apiComps) ? apiComps : []);
      setNeighborhoods(Array.isArray(apiNeighborhoods) ? apiNeighborhoods : []);
      setLenders(Array.isArray(apiLenders) ? apiLenders : []);
      setConnectionState("Backend Connected");
    } catch (error) {
      console.error("Unable to read intelligence data, using localStorage fallback", error);
      setConnectionState("Local Fallback");
      setLiveDealIntelligence([]);

      if (typeof window !== "undefined") {
        try {
          const fallbackDeals = JSON.parse(window.localStorage.getItem("royalStarDeals") || "[]") || [];
          const fallbackComps = JSON.parse(window.localStorage.getItem("royalStarComps") || "[]") || [];
          const fallbackNeighborhoods = JSON.parse(window.localStorage.getItem("royalStarNeighborhoods") || "[]") || [];
          const fallbackLenders = JSON.parse(window.localStorage.getItem("royalStarLenders") || "[]") || [];
          setDeals(Array.isArray(fallbackDeals) ? fallbackDeals : []);
          setComps(Array.isArray(fallbackComps) ? fallbackComps : []);
          setNeighborhoods(Array.isArray(fallbackNeighborhoods) ? fallbackNeighborhoods : []);
          setLenders(Array.isArray(fallbackLenders) ? fallbackLenders : []);
        } catch (localError) {
          console.error("Unable to read fallback data", localError);
          setDeals([]);
          setComps([]);
          setNeighborhoods([]);
          setLenders([]);
        }
      }
    }
  };

  useEffect(() => {
    loadData();

    if (typeof window === "undefined") return undefined;

    const refreshOnFocus = () => {
      loadData();
    };

    const refreshOnDealChange = () => {
      setRefreshKey((previous) => previous + 1);
      loadData();
    };

    window.addEventListener("focus", refreshOnFocus);
    window.addEventListener("storage", refreshOnFocus);
    window.addEventListener("royalStarDealsUpdated", refreshOnDealChange);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") {
        loadData();
      }
    });

    return () => {
      window.removeEventListener("focus", refreshOnFocus);
      window.removeEventListener("storage", refreshOnFocus);
      window.removeEventListener("royalStarDealsUpdated", refreshOnDealChange);
      document.removeEventListener("visibilitychange", refreshOnFocus);
    };
  }, [refreshKey]);

  const handleLenderSelection = (dealKey, lenderId) => {
    setSelectedLenderIds((previous) => ({ ...previous, [dealKey]: lenderId }));
  };

  const handleUnlinkLender = (dealKey) => {
    setSelectedLenderIds((previous) => {
      const next = { ...previous };
      delete next[dealKey];
      return next;
    });
  };

  const handleRefreshLenderData = async () => {
    await loadData();
  };

  const handleRecalculateFinancing = () => {
    setRecalcTick((previous) => previous + 1);
  };

  const exportRedTeamReview = () => {
    if (typeof window === "undefined") return;
    const payload = JSON.stringify(redTeamReview || {}, null, 2);
    const blob = new Blob([payload], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "royal-star-red-team-review.json";
    link.click();
    URL.revokeObjectURL(url);
  };

  const exportRedTeamCsv = () => {
    if (typeof window === "undefined") return;
    const rows = [
      ["Metric", "Value"],
      ["Recommendation Survival", redTeamReview?.recommendationSurvivalResult || "Insufficient Data"],
      ["Recommendation Confidence", redTeamReview?.recommendationConfidence || "Insufficient Data"],
      ["Strongest Argument Against the Deal", redTeamReview?.strongestArgumentAgainstDeal || "Insufficient Data"],
      ["Most Fragile Assumption", redTeamReview?.mostFragileAssumption || "Insufficient Data"],
      ["Decision-Breaking Assumption", redTeamReview?.decisionBreakingAssumption || "Insufficient Data"],
      ["Largest Financial Risk", redTeamReview?.largestFinancialRisk || "Insufficient Data"],
      ["Largest Execution Risk", redTeamReview?.largestExecutionRisk || "Insufficient Data"],
      ["Largest Market Risk", redTeamReview?.largestMarketRisk || "Insufficient Data"],
      ["Largest Financing Risk", redTeamReview?.largestFinancingRisk || "Insufficient Data"],
      ["Largest Exit Risk", redTeamReview?.largestExitRisk || "Insufficient Data"],
      ["Downside Recommendation", redTeamReview?.downsideRecommendation || "Insufficient Data"],
      ["Required Corrective Actions", (redTeamReview?.requiredCorrectiveActions || []).join(" | ")],
    ];
    const csv = rows.map((row) => row.map((entry) => `"${String(entry).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "royal-star-red-team-review.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  const printRedTeamReview = () => {
    if (typeof window !== "undefined") {
      window.print();
    }
  };

  const displayDeals = useMemo(() => {
    const activeDeals = deals.filter((deal) => {
      const status = String(deal?.status || "").trim().toLowerCase();
      return status === "active" || status === "ready to offer" || status === "owned" || status === "active rehab" || status === "active project" || status === "in progress";
    });
    return activeDeals.length ? activeDeals : deals;
  }, [deals]);

  const analysis = useMemo(
    () =>
      displayDeals
        .map((deal, index) => {
          const dealKey = deal.id || `deal-${index}`;
          const backendRecord = Array.isArray(liveDealIntelligence)
            ? liveDealIntelligence.find((entry) => String(entry.id) === String(deal.id) || String(entry.dealId) === String(deal.id) || String(entry.propertyId) === String(deal.id)) || null
            : null;
          const viewModel = buildDealIntelligenceViewModel({
            deal,
            backendRecord,
            fallback: {
              dealScore: 0,
              recommendation: 'Insufficient Data',
              riskLevel: 'Insufficient Data',
              confidenceScore: 0,
              underwritingSummary: 'Insufficient Data',
              arvOutput: 0,
              offerGuidance: 'Insufficient Data',
              exitStrategyComparison: 'Insufficient Data',
              capitalRequired: 0,
              estimatedProfit: 0,
              estimatedCashFlow: 0,
              majorRiskFlags: [],
              requiredFollowUpItems: [],
              manualOverrideStatus: 'Not Applied',
            },
          });
          try {
            const computed = buildDealAnalysis(deal, comps, neighborhoods, lenders, selectedLenderIds[dealKey] || "", recalcTick);
            const backendRiskFlags = Array.isArray(backendRecord?.majorRiskFlags) && backendRecord.majorRiskFlags.length ? backendRecord.majorRiskFlags : [];
            const backendFollowUps = Array.isArray(backendRecord?.requiredFollowUpItems) && backendRecord.requiredFollowUpItems.length ? backendRecord.requiredFollowUpItems : [];
            return {
              ...computed,
              dealId: backendRecord?.dealId || deal.id || dealKey,
              dealScore: safeNumber(backendRecord?.dealScore ?? computed.sharedDecision?.dealScore ?? computed.dealScore ?? 0),
              recommendationDecision: computed.recommendationDecision ?? 'Insufficient Data',
              recommendationStrategy: computed.recommendationStrategy ?? 'Insufficient Data',
              investmentDecision: computed.investmentDecision || {
                recommendation: computed.recommendation?.primaryRecommendation || 'Insufficient Data',
                confidence: 0,
                primaryFactors: [],
                recommendedNextActions: [],
              },
              exitStrategy: computed.exitStrategy,
              riskProfile: computed.riskProfile,
              riskLevel: computed.riskLevel ?? 'Insufficient Data',
              confidenceScore: computed.confidenceScore ?? 0,
              underwritingSummary: computed.underwritingSummary ?? '',
              arvOutput: computed.arvOutput ?? computed.supportedBaseArv ?? computed.arv ?? 0,
              offerGuidance: computed.offerGuidance ?? computed.recommendation?.executiveSummary?.recommendedOffer ?? computed.recommendedOffer,
              exitStrategyComparison: computed.exitStrategyComparison ?? computed.recommendedExit,
              capitalRequired: computed.capitalRequired ?? computed.cashRequired ?? 0,
              estimatedProfit: safeNumber(backendRecord?.estimatedProfit ?? computed.sharedDecision?.projectedProfit ?? computed.estimatedProfit ?? computed.estimatedFlipProfit ?? 0),
              estimatedCashFlow: computed.estimatedCashFlow ?? computed.monthlyCashFlow ?? 0,
              actualLoanAmount: computed.actualLoanAmount ?? 0,
              monthlyCarry: computed.monthlyCarry ?? 0,
              initialCashInvested: computed.initialCashInvested ?? 0,
              majorRiskFlags: backendRiskFlags.length ? backendRiskFlags : computed.majorRiskFlags?.length ? computed.majorRiskFlags : computed.risks || [],
              requiredFollowUpItems: backendFollowUps.length ? backendFollowUps : computed.requiredFollowUpItems?.length ? computed.requiredFollowUpItems : computed.risks || [],
              manualOverrideStatus: computed.manualOverrideStatus ?? 'Not Applied',
            };
          } catch (error) {
            console.error("Unable to build deal intelligence for a deal", error);
            return {
              ...normalizeDealForIntelligence(deal),
              dealScore: 0,
              baseDealScore: 0,
              grade: "F",
              riskScore: 100,
              strengths: ["Core metrics available but need more support data"],
              risks: ["Analysis failed for this deal"],
              warnings: ["Analysis failed"],
              buyBoxResult: "FAIL",
              recommendation: {
                primaryRecommendation: "Hold",
                strategyRecommendation: "Hold",
                executiveSummary: {
                  recommendedOffer: "Insufficient Data",
                },
              },
            };
          }
        })
        .sort((a, b) => b.dealScore - a.dealScore),
    [displayDeals, comps, neighborhoods, lenders, liveDealIntelligence, selectedLenderIds, recalcTick],
  );

  const scenarioAnalysis = useMemo(() => {
    if (!analysis.length) return null;
    const baseDeal = deals[0] || {};
    return buildScenarioAnalysis(baseDeal, analysis[0], lenders.find((lender) => lender.id === selectedLenderIds[baseDeal.id || "deal-0"]) || {});
  }, [analysis, deals, lenders, selectedLenderIds]);

  const redTeamReview = useMemo(() => {
    const baseDeal = deals[0] || {};
    const topDeal = analysis[0] || {};
    return buildRedTeamReview(baseDeal, topDeal, scenarioAnalysis || {});
  }, [analysis, deals, scenarioAnalysis]);

  const summary = useMemo(() => {
    const totalDeals = analysis.length;
    const avgScore = totalDeals
      ? analysis.reduce((sum, deal) => sum + safeNumber(deal.dealScore), 0) / totalDeals
      : 0;
    const totalProfit = analysis.reduce((sum, deal) => sum + safeNumber(deal.estimatedFlipProfit ?? deal.estimatedProfit ?? deal.profit), 0);
    const topDeal = analysis.find((deal) => safeNumber(deal.dealScore) > 0) || analysis[0] || null;

    return {
      totalDeals,
      avgScore,
      totalProfit,
      topDeal: topDeal
        ? {
            ...topDeal,
            propertyAddress: safeDisplay(topDeal.propertyAddress || topDeal.address || "Untitled Deal", "Untitled Deal"),
            arvConfidence: safeDisplay(topDeal.arvConfidence || topDeal.arvConfidenceLabel || topDeal.confidenceLabel || "Insufficient Data", "Insufficient Data"),
            supportedBaseArv: safeNumber(topDeal.supportedBaseArv || topDeal.supportedArv || topDeal.arvOutput || 0),
            marketScore: safeDisplay(topDeal.marketScore ?? topDeal.marketStabilityScore ?? topDeal.marketRating ?? "Insufficient Data", "Insufficient Data"),
            valuationScore: safeDisplay(topDeal.valuationScore ?? topDeal.valuationScoreValue ?? "Insufficient Data", "Insufficient Data"),
            buyBoxResult: safeDisplay(topDeal.buyBoxResult || topDeal.buyBox?.result || "Insufficient Data", "Insufficient Data"),
            warnings: Array.isArray(topDeal.warnings) ? topDeal.warnings : [],
            financingScore: safeNumber(topDeal.financingScore ?? topDeal.financing?.score ?? 0),
            loanAmount: safeNumber(topDeal.actualLoanAmount ?? topDeal.loanAmount ?? topDeal.financing?.loanAmount ?? 0),
            cashRequired: safeNumber(topDeal.initialCashInvested ?? topDeal.cashRequired ?? topDeal.cashRequiredForDeal ?? topDeal.estimatedCashRequired ?? 0),
            monthlyPayment: safeNumber(topDeal.monthlyCarry ?? topDeal.monthlyPayment ?? topDeal.financing?.monthlyPayment ?? 0),
            dscr: safeDisplay(topDeal.dscr ?? topDeal.financing?.debtServiceCoverageRatio ?? "Insufficient Data", "Insufficient Data"),
            selectedLenderName: safeDisplay(topDeal.selectedLenderName || topDeal.selectedLender?.name || "Insufficient Data", "Insufficient Data"),
            qualificationStatus: safeDisplay(topDeal.qualificationStatus || "Insufficient Data", "Insufficient Data"),
            recommendationDecision: safeDisplay(topDeal.recommendationDecision || topDeal.recommendation?.primaryRecommendation || "Insufficient Data", "Insufficient Data"),
            recommendationStrategy: safeDisplay(topDeal.recommendationStrategy || topDeal.recommendation?.strategyRecommendation || "Insufficient Data", "Insufficient Data"),
            actualLoanAmount: safeNumber(topDeal.actualLoanAmount ?? topDeal.loanAmount ?? 0),
            initialCashInvested: safeNumber(topDeal.initialCashInvested ?? topDeal.cashRequired ?? 0),
            monthlyCarry: safeNumber(topDeal.monthlyCarry ?? topDeal.monthlyPayment ?? 0),
            loanAmountDisplayLabel: safeDisplay(topDeal.loanAmountLabel || "Actual Loan Amount", "Actual Loan Amount"),
            aiDecisionEngine: topDeal.aiDecisionEngine || {
              dealDecision: {
                recommendedAction: "Insufficient Data",
                confidenceLabel: "Insufficient Data",
              },
            },
          }
        : null,
    };
  }, [analysis]);

  const enterpriseSummary = useMemo(() => {
    const baseDeal = deals[0] || {};
    const topDeal = analysis[0] || {};
    return buildEnterpriseDealIntelligenceSummary(baseDeal, topDeal, deals, [], [], lenders, analysis, [], [], summary || {}, []);
  }, [analysis, deals, lenders, summary]);

  const executiveDashboard = useMemo(() => {
    const baseDeal = deals[0] || {};
    const topDeal = analysis[0] || {};
    const executiveDecisionExecutionEngine = buildExecutiveDecisionExecutionEngine({
      deal: baseDeal,
      analysis: topDeal,
      portfolioIntelligence: {},
      executiveRecommendationEngine: topDeal.executiveRecommendationEngine || {},
      capitalAllocationEngine: {},
      marketAnalysis: { marketRiskEngine: { marketStabilityScore: safeNumber(topDeal.marketStabilityScore || topDeal.marketScore) } },
      forecastAnalysis: { forecastConfidence: safeNumber(topDeal.forecastConfidence) },
      dealIntelligence: analysis,
    });
    const executiveStrategyOptimizationEngine = {
      recommendedStrategy: 'Balanced Growth',
      confidenceLevel: 'Insufficient Data',
      strategyScores: [],
      summary: { totalStrategies: 0, topScore: 0, lowestScore: 0, selectedStrategyName: 'Balanced Growth' },
      manualOverrideSummary: { applied: false, strategyName: null },
    };
    return buildExecutiveDecisionDashboard({ ...topDeal, executiveDecisionExecutionEngine, executiveRecommendationEngine: topDeal.executiveRecommendationEngine || {}, executiveStrategyOptimizationEngine }, baseDeal, scenarioAnalysis || {}, redTeamReview || {}, analysis, deals);
  }, [analysis, deals, redTeamReview, scenarioAnalysis]);

  const refinanceExitOptimizer = useMemo(() => {
    try {
      return buildRefinanceExitOptimizer({
        properties: analysis.map((deal) => ({
          ...deal,
          currentValue: deal.supportedBaseArv || deal.arv || deal.askingPrice || 0,
          currentLoanBalance: deal.loanAmount || deal.purchasePrice || 0,
          monthlyRent: deal.estimatedRent || 0,
          monthlyOperatingExpenses: safeNumber(deal.financing?.monthlyOperatingExpenses ?? 0),
          monthlyDebtService: deal.monthlyPayment || 0,
          annualTaxes: safeNumber(deal.taxes || 0),
          annualInsurance: safeNumber(deal.insurance || 0),
          rehabRemainingBudget: safeNumber(deal.rehabBudget || 0) - safeNumber(deal.estimatedFlipProfit || 0) * 0.1,
          rehabPercentComplete: safeNumber(deal.rehabPercentComplete || 0),
          loanMaturityDate: safeDisplay(deal.loanMaturityDate || '', 'Insufficient Data'),
          interestRate: safeNumber(deal.financing?.interestRate || 0),
          supportedARV: safeNumber(deal.supportedBaseArv || 0),
          appraisedValue: safeNumber(deal.supportedBaseArv || 0),
          occupancyRate: safeNumber(deal.occupancyRate || 0),
          leaseStatus: safeDisplay(deal.leaseStatus || 'Insufficient Data', 'Insufficient Data'),
          lenderRequirements: { maxLtv: 0.75, minDscr: 1.2 },
          appraisalStatus: safeDisplay(deal.appraisalStatus || 'Insufficient Data', 'Insufficient Data'),
          insuranceStatus: safeDisplay(deal.insuranceStatus || 'Insufficient Data', 'Insufficient Data'),
          titleStatus: safeDisplay(deal.titleStatus || 'Insufficient Data', 'Insufficient Data'),
          documentationCompleteness: safeNumber(deal.documentationCompleteness || 0.7),
          refinanceCandidate: safeNumber(deal.dealScore) >= 70,
          totalCashInvested: safeNumber(deal.purchasePrice || 0) + safeNumber(deal.rehabBudget || 0),
          remainingUnrecoveredCashInvestment: safeNumber(deal.rehabBudget || 0),
        })),
        deals,
        portfolioIntelligence: summary || {},
        capitalAllocationEngine: executiveDashboard || {},
      });
    } catch (error) {
      console.error('Unable to build refinance exit optimizer', error);
      return {
        status: 'Unavailable',
        primaryExit: 'Insufficient Data',
        secondaryExit: 'Insufficient Data',
        exitToAvoid: 'Insufficient Data',
        recommendedTiming: 'Insufficient Data',
        decisionStatus: 'Insufficient Data',
        reason: 'Refinance & Exit analysis unavailable.',
        refinanceReadiness: 'Insufficient Data',
        exitScore: 0,
        viability: 'Insufficient Data',
        strategies: [],
        comparison: [],
        stressTests: [],
        breakEvenThresholds: [],
        warnings: [],
        requiredActions: [],
        summary: {
          message: 'Refinance & Exit analysis unavailable for this deal.',
        },
        refinanceAnalysis: {},
        timeline: [],
        known: ['Refinance & Exit analysis unavailable.'],
        uncertain: ['The optimizer could not produce a supported recommendation.'],
        needed: ['More property-level exit data'],
      };
    }
  }, [analysis, deals, executiveDashboard, summary]);

  return (
    <div style={styles.page}>
      <aside style={styles.sidebar}>
        <div style={styles.logoArea}>
          <img src={logo} alt="Royal Star Properties" style={styles.logo} />
        </div>

        <nav style={styles.nav}>
          {navigation.map(([icon, label]) => (
            <button key={label} type="button" style={styles.navButton}>
              <span style={styles.navIcon}>{icon}</span>
              <span>{label}</span>
              <span style={styles.navTab} />
            </button>
          ))}

          <button type="button" style={styles.logout}>
            <span style={styles.navIcon}>↪</span>
            <span>LOG OUT</span>
          </button>
        </nav>

        <div style={styles.smallMark}>RS★</div>
      </aside>

      <main style={styles.main}>
        <section style={styles.topBar}>
          <button type="button" style={styles.backButton} onClick={onBack}>
            ◀ COMMAND CENTER
          </button>

          <div style={styles.headingBlock}>
            <h1 style={styles.company}>ROYAL STAR PROPERTIES, LLC</h1>
            <p style={styles.subtitle}>DEAL INTELLIGENCE / RSOS WORKBOOK BRIDGE</p>
          </div>

          <div style={styles.adminBadge}>👤 BRANDON STERLING</div>
        </section>

        <section style={styles.card}>
          <div style={styles.cardHeader}>
            <div>
              <h2 style={styles.cardTitle}>DEAL INTELLIGENCE</h2>
              <p style={styles.cardSubtitle}>Ranked opportunities derived from saved Royal Star deals.</p>
            </div>
            <div style={styles.connectionBadge}>{connectionState}</div>
          </div>

          {analysis.length === 0 ? (
            <div style={styles.emptyState}>No deals available yet. Save a deal in Deal Intake to generate intelligence.</div>
          ) : (
            <>
              <div style={styles.summaryGrid}>
                <SummaryCard label="Deals Reviewed" value={summary?.totalDeals ?? 0} />
                <SummaryCard label="Average Score" value={`${(summary?.avgScore ?? 0).toFixed(1)}/100`} />
                <SummaryCard label="Projected Profit" value={formatCurrency(summary?.totalProfit ?? 0)} />
                <SummaryCard label="Top Opportunity" value={summary?.topDeal ? summary.topDeal.propertyAddress || summary.topDeal.address || "Untitled Deal" : "Not Available"} />
                <SummaryCard label="ARV Confidence" value={summary?.topDeal?.arvConfidence || "Insufficient Data"} />
                <SummaryCard label="Supported ARV" value={formatCurrency(summary?.topDeal?.supportedBaseArv || 0)} />
                <SummaryCard label="Market Score" value={`${safeDisplay(summary?.topDeal?.marketScore, "Insufficient Data")}`} />
                <SummaryCard label="Valuation Score" value={`${safeDisplay(summary?.topDeal?.valuationScore, "Insufficient Data")}`} />
                <SummaryCard label="Buy Box Result" value={summary?.topDeal?.buyBoxResult || "Insufficient Data"} />
                <SummaryCard label="Warning Count" value={summary?.topDeal?.warnings?.length || 0} />
                <SummaryCard label="Financing Score" value={summary?.topDeal?.financingScore ?? "Insufficient Data"} />
                <SummaryCard label={summary?.topDeal?.loanAmountDisplayLabel || "Actual Loan Amount"} value={formatCurrency(summary?.topDeal?.actualLoanAmount || summary?.topDeal?.loanAmount || 0)} />
                <SummaryCard label="Initial Cash Invested" value={formatCurrency(summary?.topDeal?.initialCashInvested || summary?.topDeal?.cashRequired || 0)} />
                <SummaryCard label="Monthly Carry" value={formatCurrency(summary?.topDeal?.monthlyCarry || summary?.topDeal?.monthlyPayment || 0)} />
                <SummaryCard label="Cash Required" value={formatCurrency(summary?.topDeal?.cashRequired || 0)} />
                <SummaryCard label="DSCR" value={safeDisplay(summary?.topDeal?.dscr, "Insufficient Data")} />
                <SummaryCard label="Selected Lender" value={summary?.topDeal?.selectedLenderName || "Insufficient Data"} />
                <SummaryCard label="Qualification" value={summary?.topDeal?.qualificationStatus || "Insufficient Data"} />
                <SummaryCard label="Recommendation" value={summary?.topDeal?.recommendationDecision || "Insufficient Data"} />
                <SummaryCard label="Strategy" value={summary?.topDeal?.recommendationStrategy || "Insufficient Data"} />
                <SummaryCard label="Investment Decision" value={summary?.topDeal?.investmentDecision?.recommendation || "Insufficient Data"} />
                <SummaryCard label="Decision Confidence" value={`${summary?.topDeal?.investmentDecision?.confidence ?? 0}%`} />
                <SummaryCard label="Exit Strategy" value={summary?.topDeal?.exitStrategy?.recommendedStrategy || "Insufficient Data"} />
                <SummaryCard label="Overall Risk" value={`${summary?.topDeal?.riskProfile?.overallRiskScore ?? summary?.topDeal?.riskScore ?? summary?.topDeal?.overallRiskScore ?? 0}/100`} />
                <SummaryCard label="AI Decision" value={summary?.topDeal?.aiDecisionEngine?.dealDecision?.recommendedAction || "Insufficient Data"} />
                <SummaryCard label="AI Confidence" value={summary?.topDeal?.aiDecisionEngine?.dealDecision?.confidenceLabel || "Insufficient Data"} />
                <SummaryCard label="Enterprise Route" value={enterpriseSummary?.summary?.primaryRecommendation || "Insufficient Data"} />
                <SummaryCard label="Enterprise Confidence" value={enterpriseSummary?.summary?.confidence || "Insufficient Data"} />
                <SummaryCard label="Base Recommendation" value={summary?.topDeal?.baseRecommendation || "Insufficient Data"} />
                <SummaryCard label="Worst-Case Recommendation" value={scenarioAnalysis?.summary?.worstCaseRecommendation || "Insufficient Data"} />
                <SummaryCard label="Best-Case Profit" value={formatCurrency(scenarioAnalysis?.summary?.bestCaseProfit || 0)} />
                <SummaryCard label="Expected Profit" value={formatCurrency(scenarioAnalysis?.summary?.expectedProfit || 0)} />
                <SummaryCard label="Worst-Case Profit" value={formatCurrency(scenarioAnalysis?.summary?.worstCaseProfit || 0)} />
                <SummaryCard label="Expected ROI" value={formatPercent(scenarioAnalysis?.summary?.expectedRoi || 0)} />
                <SummaryCard label="Worst-Case ROI" value={formatPercent(scenarioAnalysis?.summary?.worstCaseRoi || 0)} />
                <SummaryCard label="Downside Cash Required" value={formatCurrency(scenarioAnalysis?.summary?.downsideCashRequired || 0)} />
                <SummaryCard label="Downside Monthly Cash Flow" value={formatCurrency(scenarioAnalysis?.summary?.downsideMonthlyCashFlow || 0)} />
                <SummaryCard label="Scenario Survival Result" value={scenarioAnalysis?.summary?.scenarioSurvivalResult || "Insufficient Data"} />
                <SummaryCard label="Failing Scenarios" value={scenarioAnalysis?.summary?.failingScenarioCount ?? 0} />
                <SummaryCard label="Survival Result" value={redTeamReview?.summary?.survivalResult || "Insufficient Data"} />
                <SummaryCard label="Recommendation Confidence" value={redTeamReview?.summary?.recommendationConfidence || "Insufficient Data"} />
                <SummaryCard label="Fragile Assumption" value={redTeamReview?.summary?.fragileAssumption || "Insufficient Data"} />
                <SummaryCard label="Decision-Breaking Threshold" value={redTeamReview?.summary?.decisionBreakingThreshold || "Insufficient Data"} />
                <SummaryCard label="Downside Recommendation" value={redTeamReview?.summary?.downsideRecommendation || "Insufficient Data"} />
                <SummaryCard label="Critical Risk Count" value={redTeamReview?.summary?.criticalRiskCount ?? 0} />
                <SummaryCard label="Decision-Blocking Action Count" value={redTeamReview?.summary?.decisionBlockingActionCount ?? 0} />
                <SummaryCard label="Executive Decision" value={executiveDashboard?.decisionStatus || "INSUFFICIENT DATA"} />
              </div>

              <div style={styles.scenarioSection}>
                <div style={styles.explanationBox}>
                  <div style={styles.explanationTitle}>ENTERPRISE DEAL INTELLIGENCE SUMMARY</div>
                  <div style={styles.listItem}>Primary recommendation: {enterpriseSummary?.summary?.primaryRecommendation || "Insufficient Data"}</div>
                  <div style={styles.listItem}>Confidence: {enterpriseSummary?.summary?.confidence || "Insufficient Data"}</div>
                  <div style={styles.listItem}>Investment decision: {summary?.topDeal?.investmentDecision?.recommendation || "Insufficient Data"}</div>
                  <div style={styles.listItem}>Decision factors: {summary?.topDeal?.investmentDecision?.primaryFactors?.join(" · ") || "Insufficient Data"}</div>
                  <div style={styles.listItem}>Recommended next action: {summary?.topDeal?.investmentDecision?.recommendedNextActions?.[0] || "Insufficient Data"}</div>
                  <div style={styles.listItem}>Exit ranking: {(summary?.topDeal?.exitStrategy?.rankedStrategies || []).map((entry) => `${entry.strategy}:${entry.score.toFixed(2)}`).join(" | ") || "Insufficient Data"}</div>
                  <div style={styles.listItem}>Risk breakdown: {(summary?.topDeal?.riskProfile?.breakdown || []).map((entry) => `${entry.category}:${entry.score}`).join(" | ") || "Insufficient Data"}</div>
                  <div style={styles.listItem}>Reasoning: {enterpriseSummary?.summary?.recommendationReason || "Insufficient Data"}</div>
                  <div style={styles.listItem}>Knowledge summary: {enterpriseSummary?.knowledge?.summary || "Insufficient Data"}</div>
                  <div style={styles.listItem}>Suggested next inquiry: {enterpriseSummary?.knowledge?.recommendedNextInquiry || "Insufficient Data"}</div>
                  <div style={styles.listItem}>Search module: {enterpriseSummary?.search?.recommendedModule || "Insufficient Data"}</div>
                  <div style={styles.listItem}>Reporting ready: {enterpriseSummary?.reporting?.downloadReady ? "Yes" : "No"}</div>
                  <div style={styles.listItem}>Document automation: {enterpriseSummary?.documents?.automationStatus || "Insufficient Data"}</div>
                  <div style={styles.listItem}>Routing command: {enterpriseSummary?.commandRouting?.command || "Insufficient Data"}</div>
                </div>

                <div style={styles.explanationBox}>
                  <div style={styles.explanationTitle}>REFINANCE & EXIT OPTIMIZER</div>
                  <div style={styles.listItem}>Primary Exit: {refinanceExitOptimizer?.primaryExit || 'Insufficient Data'}</div>
                  <div style={styles.listItem}>Secondary Exit: {refinanceExitOptimizer?.secondaryExit || 'Insufficient Data'}</div>
                  <div style={styles.listItem}>Exit to Avoid: {refinanceExitOptimizer?.exitToAvoid || 'Insufficient Data'}</div>
                  <div style={styles.listItem}>Recommended Timing: {refinanceExitOptimizer?.recommendedTiming || 'Insufficient Data'}</div>
                  <div style={styles.listItem}>Decision Status: {refinanceExitOptimizer?.decisionStatus || 'Insufficient Data'}</div>
                  <div style={styles.listItem}>Refinance Readiness: {refinanceExitOptimizer?.refinanceReadiness || 'Insufficient Data'}</div>
                  <div style={styles.listItem}>Estimated Refinance Proceeds: {safeDisplay(refinanceExitOptimizer?.refinanceAnalysis?.netRefinanceProceeds, 'Insufficient Data')}</div>
                  <div style={styles.listItem}>Estimated Sale Proceeds: {safeDisplay(refinanceExitOptimizer?.comparison?.find((entry) => entry.strategy === 'Sell After Rehab')?.estimatedNetProceeds, 'Insufficient Data')}</div>
                  <div style={styles.listItem}>Cash Returned: {safeDisplay(refinanceExitOptimizer?.refinanceAnalysis?.cashReturned, 'Insufficient Data')}</div>
                  <div style={styles.listItem}>Cash Left in Deal: {safeDisplay(refinanceExitOptimizer?.refinanceAnalysis?.cashLeftInDeal, 'Insufficient Data')}</div>
                  <div style={styles.listItem}>Main Exit Risk: {refinanceExitOptimizer?.comparison?.find((entry) => entry.strategy === refinanceExitOptimizer.primaryExit)?.mainWeakness || 'Insufficient Data'}</div>
                  <div style={styles.listItem}>Decision-Breaking Threshold: {refinanceExitOptimizer?.breakEvenThresholds?.[0]?.metric || 'Insufficient Data'}</div>
                  <div style={styles.listItem}>Required Next Action: {refinanceExitOptimizer?.comparison?.find((entry) => entry.strategy === refinanceExitOptimizer.primaryExit)?.requiredNextAction || 'Insufficient Data'}</div>
                </div>

                <div style={styles.explanationBox}>
                  <div style={styles.explanationTitle}>Scenario Analysis</div>
                  <div style={styles.listItem}>Use the comparison below to test downside and upside assumptions without changing the saved deal.</div>
                </div>

                <div style={styles.explanationBox}>
                  <div style={styles.explanationTitle}>EXECUTIVE DECISION DASHBOARD</div>
                  <div style={styles.listItem}>This executive layer consolidates recommendation, scenario, and Red-Team outcomes into one decision-ready view.</div>
                  <div style={styles.explanationBox}>
                    <div style={styles.explanationTitle}>Executive Header</div>
                    <div style={styles.listItem}>Property: {executiveDashboard?.header?.propertyAddress || "Insufficient Data"}</div>
                    <div style={styles.listItem}>Analysis Status: {executiveDashboard?.header?.analysisStatus || "Insufficient Data"}</div>
                    <div style={styles.listItem}>Overall Recommendation: {executiveDashboard?.header?.overallRecommendation || "Insufficient Data"}</div>
                    <div style={styles.listItem}>Recommended Strategy: {executiveDashboard?.header?.recommendedStrategy || "Insufficient Data"}</div>
                    <div style={styles.listItem}>Secondary Strategy: {executiveDashboard?.header?.secondaryStrategy || "Insufficient Data"}</div>
                    <div style={styles.listItem}>Overall Deal Score: {executiveDashboard?.header?.overallDealScore ?? "Insufficient Data"}</div>
                    <div style={styles.listItem}>Score Grade: {executiveDashboard?.header?.scoreGrade || "Insufficient Data"}</div>
                    <div style={styles.listItem}>Overall Risk: {executiveDashboard?.header?.overallRisk ?? "Insufficient Data"}</div>
                    <div style={styles.listItem}>Recommendation Confidence: {executiveDashboard?.header?.recommendationConfidence || "Insufficient Data"}</div>
                    <div style={styles.listItem}>Recommendation Survival Result: {executiveDashboard?.header?.recommendationSurvivalResult || "Insufficient Data"}</div>
                    <div style={styles.listItem}>Buy Box Result: {executiveDashboard?.header?.buyBoxResult || "Insufficient Data"}</div>
                    <div style={styles.listItem}>Backend Status: {executiveDashboard?.header?.backendStatus || "Insufficient Data"}</div>
                  </div>
                  <div style={styles.metricRow}>
                    {executiveDashboard?.primaryCards?.length ? executiveDashboard.primaryCards.map((card) => (
                      <Metric key={card.label} label={card.label} value={card.value} />
                    )) : <div style={styles.listItem}>Executive Decision Dashboard unavailable for this deal.</div>}
                  </div>
                  <div style={styles.explanationBox}>
                    <div style={styles.explanationTitle}>Decision Status</div>
                    <div style={styles.listItem}>Status: {executiveDashboard?.decisionStatus || "INSUFFICIENT DATA"}</div>
                  </div>
                  <div style={styles.explanationBox}>
                    <div style={styles.explanationTitle}>Offer Decision</div>
                    <div style={styles.listItem}>Asking Price: {executiveDashboard?.offerDecision?.askingPrice || "Insufficient Data"}</div>
                    <div style={styles.listItem}>Current Purchase Price: {executiveDashboard?.offerDecision?.currentPurchasePrice || "Insufficient Data"}</div>
                    <div style={styles.listItem}>Maximum Allowable Offer: {executiveDashboard?.offerDecision?.maximumAllowableOffer || "Insufficient Data"}</div>
                    <div style={styles.listItem}>Recommended Offer: {executiveDashboard?.offerDecision?.recommendedOffer || "Insufficient Data"}</div>
                    <div style={styles.listItem}>Walk-Away Price: {executiveDashboard?.offerDecision?.walkAwayPrice || "Insufficient Data"}</div>
                    <div style={styles.listItem}>Price Reduction Needed: {executiveDashboard?.offerDecision?.priceReductionNeeded || "Insufficient Data"}</div>
                    <div style={styles.listItem}>Offer Status: {executiveDashboard?.offerDecision?.offerStatus || "Insufficient Data"}</div>
                  </div>
                  <div style={styles.explanationBox}>
                    <div style={styles.explanationTitle}>Strategy Decision</div>
                    <div style={styles.listItem}>Primary Strategy: {executiveDashboard?.strategyDecision?.primaryStrategy || "Insufficient Data"}</div>
                    <div style={styles.listItem}>Secondary Strategy: {executiveDashboard?.strategyDecision?.secondaryStrategy || "Insufficient Data"}</div>
                    <div style={styles.listItem}>Strategy to Avoid: {executiveDashboard?.strategyDecision?.strategyToAvoid || "Insufficient Data"}</div>
                    <div style={styles.listItem}>Explanation: {executiveDashboard?.strategyDecision?.explanation || "Insufficient Data"}</div>
                  </div>
                  <div style={styles.explanationBox}>
                    <div style={styles.explanationTitle}>Decision Matrix</div>
                    {executiveDashboard?.decisionMatrix?.length ? executiveDashboard.decisionMatrix.map((entry) => (
                      <div key={entry.category} style={styles.explanationBox}>
                        <div style={styles.explanationTitle}>{entry.category}</div>
                        <div style={styles.listItem}>Score: {entry.score}</div>
                        <div style={styles.listItem}>Grade: {entry.grade}</div>
                        <div style={styles.listItem}>Risk: {entry.risk}</div>
                        <div style={styles.listItem}>Status: {entry.status}</div>
                        <div style={styles.listItem}>Main Strength: {entry.strength}</div>
                        <div style={styles.listItem}>Main Concern: {entry.concern}</div>
                        <div style={styles.listItem}>Required Action: {entry.action}</div>
                      </div>
                    )) : <div style={styles.listItem}>Insufficient Data</div>}
                  </div>
                  <div style={styles.explanationBox}>
                    <div style={styles.explanationTitle}>Top Strengths</div>
                    <ul style={styles.list}>{(executiveDashboard?.topStrengths || []).length ? executiveDashboard.topStrengths.map((item) => <li key={item} style={styles.listItem}>{item}</li>) : <li style={styles.listItem}>Insufficient Data</li>}</ul>
                  </div>
                  <div style={styles.explanationBox}>
                    <div style={styles.explanationTitle}>Top Risks</div>
                    <ul style={styles.list}>{(executiveDashboard?.topRisks || []).length ? executiveDashboard.topRisks.map((item) => <li key={item} style={styles.listItem}>{item}</li>) : <li style={styles.listItem}>Insufficient Data</li>}</ul>
                  </div>
                  <div style={styles.explanationBox}>
                    <div style={styles.explanationTitle}>DECISION-BLOCKING ITEMS</div>
                    {(executiveDashboard?.decisionBlockingItems || []).length ? executiveDashboard.decisionBlockingItems.map((item) => (
                      <div key={item.item} style={styles.explanationBox}>
                        <div style={styles.listItem}>Item: {item.item}</div>
                        <div style={styles.listItem}>Reason: {item.reason}</div>
                        <div style={styles.listItem}>Owner: {item.owner}</div>
                        <div style={styles.listItem}>Priority: {item.priority}</div>
                        <div style={styles.listItem}>Due Status: {item.dueStatus}</div>
                        <div style={styles.listItem}>Resolution Needed: {item.resolutionNeeded}</div>
                      </div>
                    )) : <div style={styles.listItem}>Insufficient Data</div>}
                  </div>
                  <div style={styles.explanationBox}>
                    <div style={styles.explanationTitle}>Next Action Plan</div>
                    {(executiveDashboard?.nextActionPlan || []).length ? executiveDashboard.nextActionPlan.map((item) => (
                      <div key={item.action} style={styles.explanationBox}>
                        <div style={styles.listItem}>Priority: {item.priority}</div>
                        <div style={styles.listItem}>Action: {item.action}</div>
                        <div style={styles.listItem}>Reason: {item.reason}</div>
                        <div style={styles.listItem}>Related Module: {item.relatedModule}</div>
                        <div style={styles.listItem}>Completion Status: {item.completionStatus}</div>
                      </div>
                    )) : <div style={styles.listItem}>Insufficient Data</div>}
                  </div>
                  <div style={styles.explanationBox}>
                    <div style={styles.explanationTitle}>Executive Summary</div>
                    <div style={styles.listItem}>Final Decision: {executiveDashboard?.executiveSummary?.finalDecision || "Insufficient Data"}</div>
                    <div style={styles.listItem}>Why: {executiveDashboard?.executiveSummary?.why || "Insufficient Data"}</div>
                    <div style={styles.listItem}>Recommended Strategy: {executiveDashboard?.executiveSummary?.recommendedStrategy || "Insufficient Data"}</div>
                    <div style={styles.listItem}>Recommended Offer: {executiveDashboard?.executiveSummary?.recommendedOffer || "Insufficient Data"}</div>
                    <div style={styles.listItem}>Maximum Allowable Offer: {executiveDashboard?.executiveSummary?.maximumAllowableOffer || "Insufficient Data"}</div>
                    <div style={styles.listItem}>Walk-Away Price: {executiveDashboard?.executiveSummary?.walkAwayPrice || "Insufficient Data"}</div>
                    <div style={styles.listItem}>Expected Profit: {executiveDashboard?.executiveSummary?.expectedProfit || "Insufficient Data"}</div>
                    <div style={styles.listItem}>Expected ROI: {executiveDashboard?.executiveSummary?.expectedRoi || "Insufficient Data"}</div>
                    <div style={styles.listItem}>Required Cash: {executiveDashboard?.executiveSummary?.requiredCash || "Insufficient Data"}</div>
                    <div style={styles.listItem}>Largest Risk: {executiveDashboard?.executiveSummary?.largestRisk || "Insufficient Data"}</div>
                    <div style={styles.listItem}>Strongest Opportunity: {executiveDashboard?.executiveSummary?.strongestOpportunity || "Insufficient Data"}</div>
                    <div style={styles.listItem}>Most Important Missing Information: {executiveDashboard?.executiveSummary?.mostImportantMissingInformation || "Insufficient Data"}</div>
                    <div style={styles.listItem}>Required Next Step: {executiveDashboard?.executiveSummary?.requiredNextStep || "Insufficient Data"}</div>
                  </div>
                  <div style={styles.explanationBox}>
                    <div style={styles.explanationTitle}>Known, Uncertain, and Needed</div>
                    <div style={styles.listItem}>Known: {executiveDashboard?.known?.join(" • ") || "Insufficient Data"}</div>
                    <div style={styles.listItem}>Uncertain: {executiveDashboard?.uncertain?.join(" • ") || "Insufficient Data"}</div>
                    <div style={styles.listItem}>Needed to Improve the Decision: {executiveDashboard?.neededToImproveDecision?.join(" • ") || "Insufficient Data"}</div>
                  </div>
                  <div style={styles.explanationBox}>
                    <div style={styles.explanationTitle}>Scenario Summary</div>
                    {(executiveDashboard?.scenarioSummary || []).length ? executiveDashboard.scenarioSummary.map((item) => (
                      <div key={item.name} style={styles.explanationBox}>
                        <div style={styles.listItem}>Scenario: {item.name}</div>
                        <div style={styles.listItem}>Profit: {item.profit}</div>
                        <div style={styles.listItem}>ROI: {item.roi}</div>
                        <div style={styles.listItem}>Cash Required: {item.cashRequired}</div>
                        <div style={styles.listItem}>Monthly Cash Flow: {item.monthlyCashFlow}</div>
                        <div style={styles.listItem}>DSCR: {item.dscr}</div>
                        <div style={styles.listItem}>Recommendation: {item.recommendation}</div>
                        <div style={styles.listItem}>Survival Result: {item.survivalResult}</div>
                      </div>
                    )) : <div style={styles.listItem}>Insufficient Data</div>}
                  </div>
                  <div style={styles.explanationBox}>
                    <div style={styles.explanationTitle}>Red-Team Summary</div>
                    <div style={styles.listItem}>Strongest Argument Against the Deal: {executiveDashboard?.redTeamSummary?.strongestArgumentAgainstDeal || "Insufficient Data"}</div>
                    <div style={styles.listItem}>Most Fragile Assumption: {executiveDashboard?.redTeamSummary?.mostFragileAssumption || "Insufficient Data"}</div>
                    <div style={styles.listItem}>Decision-Breaking Threshold: {executiveDashboard?.redTeamSummary?.decisionBreakingThreshold || "Insufficient Data"}</div>
                    <div style={styles.listItem}>Downside Recommendation: {executiveDashboard?.redTeamSummary?.downsideRecommendation || "Insufficient Data"}</div>
                    <div style={styles.listItem}>Recommendation Confidence: {executiveDashboard?.redTeamSummary?.recommendationConfidence || "Insufficient Data"}</div>
                    <div style={styles.listItem}>Survival Result: {executiveDashboard?.redTeamSummary?.survivalResult || "Insufficient Data"}</div>
                    <div style={styles.listItem}>Required Corrective Actions: {(executiveDashboard?.redTeamSummary?.requiredCorrectiveActions || []).join(" • ") || "Insufficient Data"}</div>
                  </div>
                  <div style={styles.explanationBox}>
                    <div style={styles.explanationTitle}>Deal Ranking</div>
                    {(executiveDashboard?.ranking || []).length ? executiveDashboard.ranking.map((item, index) => (
                      <div key={item.id} style={styles.listItem}>{index + 1}. {item.property} — {item.recommendation} / {item.strategy} / Score {item.score} / Risk {item.risk} / Profit {item.profit}</div>
                    )) : <div style={styles.listItem}>Insufficient Data</div>}
                  </div>
                </div>

                <div style={styles.explanationBox}>
                  <div style={styles.explanationTitle}>RED-TEAM REVIEW</div>
                  <div style={styles.listItem}>This review challenges the current recommendation using the same deal and scenario inputs already in Deal Intelligence.</div>
                  <div style={styles.actionRow}>
                    <button type="button" style={styles.smallButton} onClick={exportRedTeamReview}>Export JSON</button>
                    <button type="button" style={styles.smallButton} onClick={exportRedTeamCsv}>Export CSV</button>
                    <button type="button" style={styles.smallButton} onClick={printRedTeamReview}>Print</button>
                  </div>
                  <div style={styles.metricRow}>
                    <Metric label="Recommendation Survival" value={redTeamSafeDisplay(redTeamReview?.recommendationSurvivalResult, "Insufficient Data")} />
                    <Metric label="Recommendation Confidence" value={redTeamSafeDisplay(redTeamReview?.recommendationConfidence, "Insufficient Data")} />
                    <Metric label="Strongest Argument Against the Deal" value={redTeamSafeDisplay(redTeamReview?.strongestArgumentAgainstDeal, "Insufficient Data")} />
                    <Metric label="Most Fragile Assumption" value={redTeamSafeDisplay(redTeamReview?.mostFragileAssumption, "Insufficient Data")} />
                  </div>
                  <div style={styles.metricRow}>
                    <Metric label="Decision-Breaking Assumption" value={redTeamSafeDisplay(redTeamReview?.decisionBreakingAssumption, "Insufficient Data")} />
                    <Metric label="Largest Financial Risk" value={redTeamSafeDisplay(redTeamReview?.largestFinancialRisk, "Insufficient Data")} />
                    <Metric label="Largest Execution Risk" value={redTeamSafeDisplay(redTeamReview?.largestExecutionRisk, "Insufficient Data")} />
                    <Metric label="Largest Market Risk" value={redTeamSafeDisplay(redTeamReview?.largestMarketRisk, "Insufficient Data")} />
                  </div>
                  <div style={styles.metricRow}>
                    <Metric label="Largest Financing Risk" value={redTeamSafeDisplay(redTeamReview?.largestFinancingRisk, "Insufficient Data")} />
                    <Metric label="Largest Exit Risk" value={redTeamSafeDisplay(redTeamReview?.largestExitRisk, "Insufficient Data")} />
                    <Metric label="Downside Recommendation" value={redTeamSafeDisplay(redTeamReview?.downsideRecommendation, "Insufficient Data")} />
                    <Metric label="Primary Exit Viability" value={redTeamSafeDisplay(redTeamReview?.metadata?.buyBoxResult || "Insufficient Data", "Insufficient Data")} />
                  </div>
                  <div style={styles.explanationBox}>
                    <div style={styles.explanationTitle}>Required Corrective Actions</div>
                    <ul style={styles.list}>
                      {(redTeamReview?.requiredCorrectiveActions || []).length ? redTeamReview.requiredCorrectiveActions.map((item) => <li key={item} style={styles.listItem}>{item}</li>) : <li style={styles.listItem}>Insufficient Data</li>}
                    </ul>
                  </div>
                  <div style={styles.explanationBox}>
                    <div style={styles.explanationTitle}>Challenge Summary</div>
                    <div style={styles.listItem}>The review below summarizes the main downside challenges to the recommendation.</div>
                    {redTeamReview?.challenges?.length ? redTeamReview.challenges.map((challenge) => (
                      <div key={challenge.title} style={styles.explanationBox}>
                        <div style={styles.explanationTitle}>{challenge.title}</div>
                        <div style={styles.listItem}>Base assumption: {challenge.baseAssumption}</div>
                        <div style={styles.listItem}>Challenged assumption: {challenge.challengedAssumption}</div>
                        <div style={styles.listItem}>Financial effect: {challenge.financialEffect}</div>
                        <div style={styles.listItem}>Score effect: {challenge.scoreEffect}</div>
                        <div style={styles.listItem}>Risk effect: {challenge.riskEffect}</div>
                        <div style={styles.listItem}>Recommendation effect: {challenge.recommendationEffect}</div>
                        <div style={styles.listItem}>Supporting warnings: {challenge.supportingWarnings.length ? challenge.supportingWarnings.join(" • ") : "Insufficient Data"}</div>
                        <div style={styles.listItem}>Required actions: {challenge.requiredActions.length ? challenge.requiredActions.join(" • ") : "Insufficient Data"}</div>
                      </div>
                    )) : <div style={styles.listItem}>Red-Team Review unavailable for this deal.</div>}
                  </div>
                </div>

                {(scenarioAnalysis?.scenarios || []).length ? (
                  <>
                    <div style={styles.tableWrap}>
                      <table style={styles.table}>
                        <thead>
                          <tr>
                            <th style={styles.th}>Scenario</th>
                            <th style={styles.th}>ARV</th>
                            <th style={styles.th}>Rehab</th>
                            <th style={styles.th}>Timeline</th>
                            <th style={styles.th}>Rate</th>
                            <th style={styles.th}>Rent</th>
                            <th style={styles.th}>Vacancy</th>
                            <th style={styles.th}>Total Cost</th>
                            <th style={styles.th}>Profit</th>
                            <th style={styles.th}>ROI</th>
                            <th style={styles.th}>Cash Required</th>
                            <th style={styles.th}>Monthly Cash Flow</th>
                            <th style={styles.th}>DSCR</th>
                            <th style={styles.th}>Cash Left</th>
                            <th style={styles.th}>Deal Score</th>
                            <th style={styles.th}>Risk</th>
                            <th style={styles.th}>Recommendation</th>
                            <th style={styles.th}>Strategy</th>
                            <th style={styles.th}>Survival</th>
                            <th style={styles.th}>Warnings</th>
                            <th style={styles.th}>View</th>
                            <th style={styles.th}>Apply</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(scenarioAnalysis?.scenarios || []).map((scenario) => (
                            <tr key={scenario.scenarioName} style={styles.tr}>
                              <td style={styles.td}>{scenario.scenarioName}</td>
                              <td style={styles.td}>{formatCurrency(scenario.summary.scenarioArv)}</td>
                              <td style={styles.td}>{formatCurrency(scenario.summary.scenarioRehabCost)}</td>
                              <td style={styles.td}>{safeDisplay(scenario.summary.scenarioHoldingPeriod, "Insufficient Data")}</td>
                              <td style={styles.td}>{formatPercent(scenario.summary.scenarioInterestRate)}</td>
                              <td style={styles.td}>{formatCurrency(scenario.summary.scenarioRent)}</td>
                              <td style={styles.td}>{formatPercent(scenario.summary.scenarioVacancy)}</td>
                              <td style={styles.td}>{formatCurrency(scenario.summary.totalProjectCost)}</td>
                              <td style={styles.td}>{formatCurrency(scenario.summary.profit)}</td>
                              <td style={styles.td}>{formatPercent(scenario.summary.roi)}</td>
                              <td style={styles.td}>{formatCurrency(scenario.summary.cashRequired)}</td>
                              <td style={styles.td}>{formatCurrency(scenario.summary.monthlyCashFlow)}</td>
                              <td style={styles.td}>{safeDisplay(scenario.summary.dscr, "Insufficient Data")}</td>
                              <td style={styles.td}>{formatCurrency(scenario.summary.cashLeftInDeal)}</td>
                              <td style={styles.td}>{safeDisplay(scenario.summary.dealScore, "Insufficient Data")}</td>
                              <td style={styles.td}>{safeDisplay(scenario.summary.overallRisk, "Insufficient Data")}</td>
                              <td style={styles.td}>{safeDisplay(scenario.summary.recommendation, "Insufficient Data")}</td>
                              <td style={styles.td}>{scenario.summary.strategy}</td>
                              <td style={styles.td}>{scenario.summary.survival}</td>
                              <td style={styles.td}>{scenario.summary.warningCount}</td>
                              <td style={styles.td}><button type="button" style={styles.smallButton} onClick={() => setSelectedScenario(scenario)}>View</button></td>
                              <td style={styles.td}><button type="button" style={styles.smallButton} onClick={() => setScenarioMessage("Apply this scenario’s assumptions to the current analysis? This will update the Deal Intelligence analysis but will not modify the original linked records.")}>Apply</button></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <div style={styles.explanationBox}>
                      <div style={styles.explanationTitle}>Custom Scenario Builder</div>
                      <div style={styles.metricRow}> 
                        {[
                          ["ARV %", "arvPct", 0.05],
                          ["Rehab %", "rehabPct", 0.1],
                          ["Timeline Days", "timelineDays", 60],
                          ["Rate Change %", "rateChangePct", 0.01],
                          ["Rent %", "rentPct", -0.05],
                          ["Vacancy %", "vacancyPct", 0.02],
                          ["Selling Cost %", "sellingCostPct", 0.01],
                          ["Operating Expense %", "operatingExpensePct", 0.05],
                          ["Refi Value %", "refinanceValuePct", -0.1],
                          ["Refi LTV Adj", "refinanceLtvAdjustment", -0.05],
                        ].map(([label, key, defaultValue]) => (
                          <label key={key} style={styles.metricBox}>
                            <div style={styles.metricLabel}>{label}</div>
                            <input
                              type="number"
                              step="0.01"
                              value={scenarioState[key] ?? defaultValue}
                              onChange={(event) => setScenarioState((current) => ({ ...current, [key]: Number(event.target.value) }))}
                              style={styles.input}
                            />
                          </label>
                        ))}
                      </div>
                      <div style={styles.actionRow}>
                        <button type="button" style={styles.smallButton} onClick={() => setSelectedScenario(null)}>Reset</button>
                        <button type="button" style={styles.smallButton} onClick={() => setSavedScenarios((current) => [...current, { scenarioId: `custom-${Date.now()}`, scenarioName: "Custom Scenario", scenarioType: "custom", assumptions: scenarioState, results: selectedScenario?.summary || {}, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }])}>Save Scenario</button>
                        <button type="button" style={styles.smallButton} onClick={() => setScenarioMessage("Apply this scenario’s assumptions to the current analysis? This will update the Deal Intelligence analysis but will not modify the original linked records.")}>Apply Scenario to Analysis</button>
                        <button type="button" style={styles.smallButton} onClick={() => setSavedScenarios([])}>Delete Saved Scenario</button>
                      </div>
                      {scenarioMessage ? <div style={styles.listItem}>{scenarioMessage}</div> : null}
                      {savedScenarios.length ? <div style={styles.listItem}>Saved custom scenarios: {savedScenarios.length}</div> : null}
                    </div>

                    {selectedScenario ? (
                      <div style={styles.explanationBox}>
                        <div style={styles.explanationTitle}>Selected Scenario Details</div>
                        <div style={styles.listItem}>Scenario: {selectedScenario.scenarioName}</div>
                        <div style={styles.listItem}>Recommendation Impact: {selectedScenario.results.recommendationImpact || "Unchanged"}</div>
                        <div style={styles.listItem}>Assumptions: ARV {formatPercent(selectedScenario.assumptions.scenarioArv / Math.max(safeDisplay(selectedScenario.baseSummary?.purchasePrice, 1), 1))} • Rehab {formatCurrency(selectedScenario.assumptions.scenarioRehabCost)} • Holding {safeDisplay(selectedScenario.assumptions.scenarioHoldingPeriod, "Insufficient Data")}</div>
                        <div style={styles.listItem}>Warnings: {selectedScenario.results.warnings?.join(" • ") || "None"}</div>
                        <div style={styles.listItem}>Required Actions: {selectedScenario.results.recommendationDetails?.requiredNextActions?.join(" • ") || selectedScenario.results.recommendation?.requiredNextActions?.join(" • ") || "Insufficient Data"}</div>
                      </div>
                    ) : null}
                  </>
                ) : (
                  <div style={styles.explanationBox}>
                    <div style={styles.explanationTitle}>Scenario Analysis unavailable</div>
                    <div style={styles.listItem}>This deal does not currently have enough underwriting data to generate scenario results.</div>
                  </div>
                )}
              </div>

              <div style={styles.tableWrap}>
                <table style={styles.table}>
                  <thead>
                    <tr>
                      <th style={styles.th}>Rank</th>
                      <th style={styles.th}>Deal</th>
                      <th style={styles.th}>Score</th>
                      <th style={styles.th}>Grade</th>
                      <th style={styles.th}>Risk</th>
                      <th style={styles.th}>Exit</th>
                      <th style={styles.th}>Estimated Profit</th>
                      <th style={styles.th}>ROI</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analysis.map((deal, index) => (
                      <tr key={deal.id || index} style={styles.tr}>
                        <td style={styles.td}>{index + 1}</td>
                        <td style={styles.td}>{deal.address || "Untitled Deal"}</td>
                        <td style={styles.td}>{deal.dealScore}</td>
                        <td style={styles.td}>{deal.grade}</td>
                        <td style={styles.td}>{deal.riskScore}</td>
                        <td style={styles.td}>{deal.recommendedExit}</td>
                        <td style={styles.td}>{formatCurrency(deal.estimatedFlipProfit)}</td>
                        <td style={styles.td}>{formatPercent(deal.roi)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div style={styles.analysisGrid}>
                {analysis.map((deal, index) => (
                  <div key={deal.id || index} style={styles.analysisCard}>
                    <div style={styles.analysisHeader}>
                      <div>
                        <div style={styles.analysisTitle}>{deal.propertyAddress || deal.address || `Deal ${index + 1}`}</div>
                        <div style={styles.analysisSubtext}>{deal.city ? `${deal.city}, ${deal.state}` : "Location not provided"}</div>
                      </div>
                      <div style={styles.scoreBadge}>{deal.dealScore}/100</div>
                    </div>

                    <div style={styles.metricRow}>
                      <Metric label="Grade" value={deal.grade} />
                      <Metric label="Risk" value={deal.riskScore} />
                      <Metric label="Exit" value={deal.recommendedExit} />
                    </div>

                    <div style={styles.actionRow}>
                      <select
                        value={selectedLenderIds[deal.id || `deal-${index}`] || ""}
                        onChange={(event) => handleLenderSelection(deal.id || `deal-${index}`, event.target.value)}
                        style={styles.select}
                      >
                        <option value="">Select Lender</option>
                        {lenders.map((lender) => (
                          <option key={lender.id} value={lender.id}>
                            {lender.lenderName || lender.loanProgramName || lender.id}
                          </option>
                        ))}
                      </select>
                      <button type="button" onClick={() => handleUnlinkLender(deal.id || `deal-${index}`)} style={styles.smallButton}>Unlink</button>
                      <button type="button" onClick={handleRefreshLenderData} style={styles.smallButton}>Refresh</button>
                      <button type="button" onClick={handleRecalculateFinancing} style={styles.smallButton}>Recalculate</button>
                    </div>

                    <div style={styles.metricRow}>
                      <Metric label="Estimated Profit" value={formatCurrency(deal.estimatedFlipProfit)} />
                      <Metric label="ROI" value={formatPercent(deal.roi)} />
                      <Metric label="Rent/Cost" value={formatPercent(deal.rentToCostRatio)} />
                    </div>

                    <div style={styles.metricRow}>
                      <Metric label="ARV Confidence" value={deal.arvConfidence} />
                      <Metric label="Supported ARV" value={formatCurrency(deal.supportedBaseArv)} />
                      <Metric label="Market Score" value={`${deal.marketScore}/100`} />
                    </div>

                    <div style={styles.explanationBox}>
                      <div style={styles.explanationTitle}>Financing Intelligence</div>
                      <div style={styles.listItem}>Selected Lender: {deal.selectedLenderName || "Insufficient Data"}</div>
                      <div style={styles.listItem}>Loan Program: {deal.financing?.loanProgram || "Insufficient Data"}</div>
                      <div style={styles.listItem}>Interest Rate: {formatPercent(deal.financing?.interestRate || 0)}</div>
                      <div style={styles.listItem}>Points: {formatPercent(deal.financing?.points || 0)}</div>
                      <div style={styles.listItem}>Fees: {formatCurrency(deal.financing?.fees || 0)}</div>
                      <div style={styles.listItem}>{deal.loanAmountLabel || "Actual Loan Amount"}: {formatCurrency(deal.actualLoanAmount || deal.loanAmount || 0)}</div>
                      <div style={styles.listItem}>Initial Cash Invested: {formatCurrency(deal.initialCashInvested || deal.cashRequired || 0)}</div>
                      <div style={styles.listItem}>Monthly Carry: {formatCurrency(deal.monthlyCarry || deal.monthlyPayment || 0)}</div>
                      <div style={styles.listItem}>Cash Required: {formatCurrency(deal.cashRequired || 0)}</div>
                      <div style={styles.listItem}>LTC: {formatPercent(deal.financing?.ltc || 0)}</div>
                      <div style={styles.listItem}>LTV: {formatPercent(deal.financing?.ltv || 0)}</div>
                      <div style={styles.listItem}>LTARV: {formatPercent(deal.financing?.ltarv || 0)}</div>
                      <div style={styles.listItem}>Monthly Payment: {formatCurrency(deal.monthlyPayment || 0)}</div>
                      <div style={styles.listItem}>Interest Carry: {formatCurrency(deal.financing?.interestCarryDuringRehab || 0)}</div>
                      <div style={styles.listItem}>Financing Score: {deal.financingScore}/100</div>
                      <div style={styles.listItem}>Financing Risk: {deal.financingRisk}</div>
                      <div style={styles.listItem}>Qualification: {deal.qualificationStatus}</div>
                      <div style={styles.listItem}>Failed Requirements: {deal.qualificationFailures?.length ? deal.qualificationFailures.join(" • ") : "None"}</div>
                      <div style={styles.listItem}>Best Qualified Lender: {deal.lenderComparison?.bestLender?.lenderName || "Insufficient Data"}</div>
                      <div style={styles.listItem}>Active Warnings: {deal.activeWarnings || "No active warnings"}</div>
                    </div>

                    <div style={styles.explanationBox}>
                      <div style={styles.explanationTitle}>Recommendation</div>
                      <div style={styles.listItem}>Decision: {deal.recommendationDecision || deal.recommendation?.primaryRecommendation || deal.investmentDecision?.recommendation || "Insufficient Data"}</div>
                      <div style={styles.listItem}>Strategy: {deal.recommendationStrategy || deal.recommendation?.strategyRecommendation || "Insufficient Data"}</div>
                      <div style={styles.listItem}>Summary: {deal.recommendation?.explanation?.summary || "Insufficient Data"}</div>
                      <div style={styles.listItem}>Risk Summary: {deal.recommendation?.executiveSummary?.topThreeRisks?.join(" • ") || "Insufficient Data"}</div>
                      <div style={styles.listItem}>Financial Summary: {deal.recommendation?.executiveSummary?.cashRequired ? `${formatCurrency(deal.recommendation.executiveSummary.cashRequired)} cash required` : "Insufficient Data"}</div>
                      <div style={styles.listItem}>Market Summary: {deal.recommendation?.explanation?.strengths?.join(" • ") || "Insufficient Data"}</div>
                      <div style={styles.listItem}>Exit Strategy: {deal.recommendation?.explanation?.primaryExit || "Insufficient Data"}</div>
                      <div style={styles.listItem}>Required Actions: {deal.recommendation?.requiredNextActions?.join(" • ") || "Insufficient Data"}</div>
                    </div>

                    <div style={styles.metricRow}>
                      <Metric label="Valuation Score" value={`${deal.valuationScore}/100`} />
                      <Metric label="Buy Box" value={deal.buyBoxResult} />
                      <Metric label="Warnings" value={deal.warnings.length} />
                    </div>

                    <div style={styles.explanationBox}>
                      <div style={styles.explanationTitle}>Buy Box</div>
                      <div style={styles.listItem}>{deal.buyBoxReason}</div>
                      {deal.buyBoxExceptions?.length ? <div style={styles.listItem}>{deal.buyBoxExceptions.join(" • ")}</div> : null}
                      <div style={styles.listItem}>Property Level Score: {deal.buyBox?.propertyLevelScore ?? "Insufficient Data"}/100</div>
                      <div style={styles.listItem}>Market Score: {deal.buyBox?.marketScore ?? "Insufficient Data"}/100</div>
                      <div style={styles.listItem}>Neighborhood Score: {deal.buyBox?.neighborhoodScore ?? "Insufficient Data"}/100</div>
                      <div style={styles.listItem}>Overall Score: {deal.buyBox?.overallScore ?? "Insufficient Data"}/100</div>
                      {deal.buyBox?.scoringBreakdown?.length ? <div style={styles.list}>{deal.buyBox.scoringBreakdown.map((item) => <div key={`${item.category}-${item.factor}`} style={styles.listItem}>{item.category}: {item.factor} (+{item.points}) — {item.rationale}</div>)}</div> : null}
                    </div>

                    <div style={styles.explanationBox}>
                      <div style={styles.explanationTitle}>Warnings</div>
                      <ul style={styles.list}>
                        {deal.warnings.map((item) => (
                          <li key={item} style={styles.listItem}>{item}</li>
                        ))}
                      </ul>
                    </div>

                    <div style={styles.explanationBox}>
                      <div style={styles.explanationTitle}>Main Strengths</div>
                      <ul style={styles.list}>
                        {deal.strengths.map((item) => (
                          <li key={item} style={styles.listItem}>{item}</li>
                        ))}
                      </ul>
                    </div>

                    <div style={styles.explanationBox}>
                      <div style={styles.explanationTitle}>Main Risks</div>
                      <ul style={styles.list}>
                        {deal.risks.map((item) => (
                          <li key={item} style={styles.listItem}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </section>
      </main>
    </div>
  );
}

function SummaryCard({ label, value }) {
  return (
    <div style={styles.summaryCard}>
      <div style={styles.summaryLabel}>{label}</div>
      <div style={styles.summaryValue}>{value}</div>
    </div>
  );
}

function Metric({ label, value }) {
  return (
    <div style={styles.metricBox}>
      <div style={styles.metricLabel}>{label}</div>
      <div style={styles.metricValue}>{value}</div>
    </div>
  );
}

const GOLD = "#f2c500";
const BLACK = "#050505";
const BORDER = "#c89f00";

const styles = {
  page: {
    minHeight: "100vh",
    width: "100%",
    display: "flex",
    overflow: "hidden",
    backgroundColor: BLACK,
    color: GOLD,
    fontFamily: "Arial, Helvetica, sans-serif",
    fontWeight: 700,
  },
  sidebar: {
    flex: "0 0 178px",
    minHeight: "100vh",
    padding: "18px 0 10px",
    boxSizing: "border-box",
    backgroundColor: BLACK,
    display: "flex",
    flexDirection: "column",
    position: "relative",
  },
  logoArea: {
    height: "114px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "0 15px 10px",
    boxSizing: "border-box",
  },
  logo: {
    display: "block",
    width: "135px",
    height: "104px",
    objectFit: "contain",
    backgroundColor: "#ffffff",
  },
  nav: {
    display: "flex",
    flexDirection: "column",
    gap: "1px",
    paddingRight: "14px",
  },
  navButton: {
    position: "relative",
    width: "100%",
    minHeight: "36px",
    padding: "7px 10px",
    border: `1px solid ${BORDER}`,
    background: "linear-gradient(90deg, #f7d339 0%, #eab90c 100%)",
    color: "#17120a",
    textAlign: "left",
    fontSize: "10px",
    fontWeight: 500,
    display: "flex",
    alignItems: "center",
    gap: "8px",
    cursor: "pointer",
  },
  navIcon: {
    width: "18px",
    textAlign: "center",
    fontSize: "12px",
  },
  navTab: {
    position: "absolute",
    right: "-13px",
    top: "8px",
    width: "13px",
    height: "20px",
    backgroundColor: GOLD,
    border: `1px solid ${BORDER}`,
    boxSizing: "border-box",
  },
  logout: {
    width: "100%",
    minHeight: "34px",
    padding: "7px 10px",
    border: `1px solid ${BORDER}`,
    background: "linear-gradient(90deg, #f7d339 0%, #eab90c 100%)",
    color: "#17120a",
    textAlign: "left",
    fontSize: "10px",
    display: "flex",
    alignItems: "center",
    gap: "8px",
  },
  smallMark: {
    marginTop: "8px",
    paddingLeft: "12px",
    fontFamily: "Georgia, serif",
    fontSize: "25px",
    color: GOLD,
  },
  main: {
    flex: 1,
    minWidth: 0,
    padding: "20px 20px 18px",
    boxSizing: "border-box",
    backgroundColor: BLACK,
  },
  topBar: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "12px",
    marginBottom: "16px",
  },
  backButton: {
    border: `1px solid ${BORDER}`,
    background: "linear-gradient(90deg, #f7d339 0%, #eab90c 100%)",
    color: "#17120a",
    padding: "10px 14px",
    fontWeight: 700,
    cursor: "pointer",
  },
  headingBlock: {
    flex: 1,
    textAlign: "center",
  },
  company: {
    margin: 0,
    fontSize: "22px",
    letterSpacing: "1px",
  },
  subtitle: {
    margin: "4px 0 0",
    fontSize: "12px",
    letterSpacing: "1.4px",
    color: "#f9e27b",
  },
  adminBadge: {
    border: `1px solid ${BORDER}`,
    padding: "8px 12px",
    fontSize: "12px",
    color: GOLD,
    backgroundColor: "#111111",
  },
  card: {
    border: `1px solid ${BORDER}`,
    background: "linear-gradient(180deg, #0f0f0f 0%, #171717 100%)",
    padding: "18px",
    boxShadow: `0 0 0 1px ${BORDER} inset`,
  },
  cardHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "12px",
    marginBottom: "18px",
  },
  cardTitle: {
    margin: 0,
    fontSize: "20px",
    letterSpacing: "1px",
  },
  cardSubtitle: {
    margin: "6px 0 0",
    fontSize: "13px",
    color: "#f9e27b",
  },
  summaryGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
    gap: "10px",
    marginBottom: "14px",
  },
  summaryCard: {
    border: `1px solid ${BORDER}`,
    backgroundColor: "#111111",
    padding: "12px",
  },
  summaryLabel: {
    fontSize: "11px",
    textTransform: "uppercase",
    color: "#f9e27b",
  },
  summaryValue: {
    marginTop: "6px",
    fontSize: "16px",
  },
  emptyState: {
    border: `1px solid ${BORDER}`,
    backgroundColor: "#111111",
    padding: "20px",
    color: "#f9e27b",
  },
  scenarioSection: {
    marginTop: "16px",
    display: "flex",
    flexDirection: "column",
    gap: "10px",
  },
  tableWrap: {
    overflowX: "auto",
    marginBottom: "14px",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
  },
  th: {
    textAlign: "left",
    padding: "10px",
    borderBottom: `1px solid ${BORDER}`,
    color: GOLD,
    fontSize: "11px",
    textTransform: "uppercase",
  },
  tr: {
    borderBottom: `1px solid #222222`,
  },
  td: {
    padding: "10px",
    borderBottom: `1px solid #222222`,
    color: "#f9e27b",
    fontSize: "12px",
  },
  analysisGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: "12px",
  },
  analysisCard: {
    border: `1px solid ${BORDER}`,
    backgroundColor: "#111111",
    padding: "12px",
  },
  analysisHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: "10px",
    marginBottom: "10px",
  },
  analysisTitle: {
    fontSize: "14px",
    color: GOLD,
  },
  analysisSubtext: {
    marginTop: "4px",
    fontSize: "11px",
    color: "#f9e27b",
  },
  scoreBadge: {
    border: `1px solid ${BORDER}`,
    padding: "8px 10px",
    backgroundColor: "#171717",
    color: GOLD,
    fontWeight: 700,
    whiteSpace: "nowrap",
  },
  metricRow: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: "8px",
    marginBottom: "8px",
  },
  actionRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: "8px",
    marginBottom: "8px",
  },
  select: {
    flex: 1,
    minWidth: "180px",
    padding: "8px",
    border: `1px solid ${BORDER}`,
    backgroundColor: "#111111",
    color: GOLD,
  },
  smallButton: {
    border: `1px solid ${BORDER}`,
    backgroundColor: "#171717",
    color: GOLD,
    padding: "8px 10px",
    cursor: "pointer",
  },
  input: {
    width: "100%",
    marginTop: "4px",
    padding: "8px",
    border: `1px solid ${BORDER}`,
    backgroundColor: "#111111",
    color: GOLD,
  },
  metricBox: {
    border: `1px solid #2f2400`,
    backgroundColor: "#0d0d0d",
    padding: "8px",
  },
  metricLabel: {
    fontSize: "10px",
    textTransform: "uppercase",
    color: "#f9e27b",
  },
  metricValue: {
    marginTop: "4px",
    fontSize: "12px",
    color: GOLD,
  },
  explanationBox: {
    border: `1px solid #2f2400`,
    backgroundColor: "#0d0d0d",
    padding: "8px",
    marginTop: "8px",
  },
  explanationTitle: {
    fontSize: "11px",
    textTransform: "uppercase",
    color: GOLD,
    marginBottom: "6px",
  },
  list: {
    margin: 0,
    paddingLeft: "16px",
  },
  listItem: {
    marginBottom: "4px",
    color: "#f9e27b",
    fontSize: "12px",
  },
};
