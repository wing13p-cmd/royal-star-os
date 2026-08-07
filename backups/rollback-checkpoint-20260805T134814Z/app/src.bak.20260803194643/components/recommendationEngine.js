export function safeNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function safeDisplay(value, fallback = "Insufficient Data") {
  if (value === null || value === undefined || value === "" || Number.isNaN(value)) return fallback;
  if (typeof value === "number" && !Number.isFinite(value)) return fallback;
  return value;
}

function formatMetric(value, fallback = "Insufficient Data") {
  return safeDisplay(value, fallback);
}

function getPrimaryRecommendation(analysis, deal) {
  const buyBoxPass = analysis.buyBoxResult === "PASS";
  const highDealScore = analysis.dealScore >= 80;
  const lowRisk = analysis.overallRisk <= 25;
  const highArvConfidence = analysis.arvConfidence === "High" || analysis.arvConfidence === "Very High";
  const strongEconomics = analysis.estimatedFlipProfit > 0 || analysis.monthlyCashFlow > 0 || analysis.roi > 0.1;
  const financingQualified = analysis.qualificationStatus === "Qualified";
  const criticalWarnings = analysis.financingWarnings?.some((warning) => warning.includes("Critical")) || false;

  if (buyBoxPass && highDealScore && lowRisk && highArvConfidence && strongEconomics && financingQualified && !criticalWarnings) {
    return "Strong Buy";
  }
  if (buyBoxPass && analysis.dealScore >= 70 && lowRisk && strongEconomics && financingQualified) {
    return "Buy";
  }
  if (analysis.dealScore >= 55 && analysis.dealScore < 70 && (analysis.warnings?.length || 0) > 0) {
    return "Conditional Buy";
  }
  if (analysis.dealScore >= 45 && (analysis.warnings?.length || 0) > 0) {
    return "Re-Underwrite";
  }
  if (analysis.estimatedFlipProfit <= 0 || analysis.roi <= 0 || analysis.cashRequired > safeNumber(deal.cashOnHand)) {
    return "Reject";
  }
  if (analysis.overallRisk > 60) {
    return "Reject";
  }
  return "Hold";
}

function getStrategyRecommendation(analysis) {
  if (analysis.dealScore >= 80 && analysis.estimatedFlipProfit > 0) return "Flip";
  if (analysis.rentToCostRatio > 0.01 && analysis.dscr > 1.2) return "BRRRR";
  if (analysis.monthlyCashFlow > 0 && analysis.capRate > 0.06) return "Rental";
  if (analysis.dealScore < 60) return "Do Not Purchase";
  return "Hold";
}

function getRequiredNextActions(analysis, deal) {
  const actions = [];
  if (!analysis.supportedBaseArv) actions.push("Order appraisal");
  if ((analysis.warnings?.length || 0) > 0) actions.push("Verify comps");
  if (analysis.qualificationStatus !== "Qualified") actions.push("Request lender approval");
  if (analysis.financingWarnings?.length) actions.push("Review financing terms");
  if (safeNumber(deal.rehabBudget) > 0 && safeNumber(deal.rehabBudget) > 50000) actions.push("Increase contingency");
  if (safeNumber(deal.purchasePrice) > 0 && safeNumber(deal.purchasePrice) > safeNumber(analysis.supportedBaseArv) * 0.8) actions.push("Reduce purchase price");
  if (analysis.buyBoxResult !== "PASS") actions.push("Complete underwriting");
  if (!analysis.marketScore) actions.push("Review title");
  return actions.slice(0, 5);
}

function getRiskSummary(analysis) {
  const risks = [];
  if (analysis.overallRisk > 50) risks.push("High overall risk");
  if (analysis.financingWarnings?.length) risks.push("Financing risk present");
  if (analysis.warnings?.length) risks.push("Market or underwriting concerns");
  if (!analysis.supportedBaseArv) risks.push("ARV support missing");
  return risks.slice(0, 3);
}

function getStrengths(analysis) {
  const strengths = [];
  if (analysis.dealScore >= 80) strengths.push("Strong overall economics");
  if (analysis.buyBoxResult === "PASS") strengths.push("Meets buy box criteria");
  if (analysis.financingScore >= 70) strengths.push("Financing profile is workable");
  if (analysis.marketScore >= 75) strengths.push("Market conditions support the deal");
  return strengths.slice(0, 3);
}

function getWeaknesses(analysis) {
  const weaknesses = [];
  if (analysis.financingWarnings?.length) weaknesses.push("Financing warnings remain");
  if (analysis.warnings?.length) weaknesses.push("Underwriting warnings remain");
  if (analysis.arvConfidence !== "High" && analysis.arvConfidence !== "Very High") weaknesses.push("ARV confidence is not strong");
  if (analysis.overallRisk > 35) weaknesses.push("Risk profile is elevated");
  return weaknesses.slice(0, 3);
}

function getLargestOpportunity(analysis) {
  if (analysis.supportedBaseArv > 0) return `Support the offer with ARV evidence of ${formatMetric(analysis.supportedBaseArv)}`;
  return "Strengthen valuation support with stronger comps";
}

function getLargestRisk(analysis) {
  if (analysis.financingWarnings?.length) return analysis.financingWarnings[0];
  if (analysis.warnings?.length) return analysis.warnings[0];
  return "Market conditions remain a watch item";
}

export function buildRecommendationEngine(deal = {}, analysis = {}) {
  const primaryRecommendation = getPrimaryRecommendation(analysis, deal);
  const strategyRecommendation = getStrategyRecommendation(analysis);
  const recommendedOffer = safeDisplay(analysis.recommendedOffer, "Insufficient Data");
  const mao = safeDisplay(analysis.maximumAllowableOffer ?? analysis.maxAllowableOffer ?? analysis.recommendedOffer ?? analysis.targetOffer, "Insufficient Data");
  const walkAwayPrice = safeDisplay(analysis.walkAwayPrice, "Insufficient Data");

  return {
    primaryRecommendation,
    strategyRecommendation,
    executiveSummary: {
      overallRecommendation: primaryRecommendation,
      strategyRecommendation,
      dealScore: safeDisplay(analysis.dealScore, "Insufficient Data"),
      overallRisk: safeDisplay(analysis.overallRisk, "Insufficient Data"),
      buyBoxResult: safeDisplay(analysis.buyBoxResult, "Insufficient Data"),
      arvConfidence: safeDisplay(analysis.arvConfidence, "Insufficient Data"),
      recommendedOffer,
      maximumAllowableOffer: mao,
      walkAwayPrice,
      cashRequired: safeDisplay(analysis.cashRequired, "Insufficient Data"),
      projectedProfit: safeDisplay(analysis.estimatedFlipProfit, "Insufficient Data"),
      projectedRoi: safeDisplay(analysis.roi, "Insufficient Data"),
      monthlyCashFlow: safeDisplay(analysis.monthlyCashFlow, "Insufficient Data"),
      dscr: safeDisplay(analysis.dscr, "Insufficient Data"),
      topThreeRisks: getRiskSummary(analysis),
      topThreeStrengths: getStrengths(analysis),
      requiredNextActions: getRequiredNextActions(analysis, deal),
    },
    explanation: {
      summary: `${primaryRecommendation} based on current deal quality, lender terms, and market support.`,
      strengths: getStrengths(analysis),
      weaknesses: getWeaknesses(analysis),
      largestOpportunity: getLargestOpportunity(analysis),
      largestRisk: getLargestRisk(analysis),
      primaryExit: safeDisplay(analysis.recommendedExit, "Insufficient Data"),
      backupExit: safeDisplay(analysis.backupExit || analysis.recommendedExit, "Insufficient Data"),
      whySelected: `${primaryRecommendation} was selected because the current deal metrics and lender terms align with the established underwriting thresholds.`,
    },
    requiredNextActions: getRequiredNextActions(analysis, deal),
  };
}
