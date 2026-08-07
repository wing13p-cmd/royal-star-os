import test from "node:test";
import assert from "node:assert/strict";
import { buildArvIntelligence, buildBuyBoxIntelligence, buildOfferIntelligence, buildAppraisalIntelligence, normalizeDealForIntelligence, buildUnifiedUnderwritingIntelligence, buildStrategyComparisonEngine, buildDealScore, buildRiskScore, buildRehabConfidence, buildArvConfidence, buildStressScenarios, buildReunderwritingTriggers, buildUnderwritingMetrics, buildSharedUnderwritingSnapshot, buildPredictiveMarketIntelligence, buildOpportunityDetectionEngine, buildForecastConfidenceEngine, buildExecutiveMarketSummaryEngine, buildKnowledgeIntelligence, buildSearchIntelligence, buildReportingIntelligence, buildDocumentAutomationIntelligence, buildAiCommandRouting, buildEnterpriseDealIntelligenceSummary, buildInvestmentDecisionEngine, buildExitStrategyEngine, buildDealRiskProfile } from "./intelligenceUpgradeEngine.js";
import { normalizeUnderwritingInputs } from "./underwritingInputNormalizer.js";

test("buildArvIntelligence returns safe defaults for empty input", () => {
  const arv = buildArvIntelligence({}, [], []);
  assert.equal(arv.confidenceLevel, "Insufficient Data");
  assert.equal(arv.supportedLowArv, 0);
  assert.equal(arv.supportedBaseArv, 0);
  assert.equal(arv.supportedHighArv, 0);
  assert.equal(arv.compEvaluations.length, 0);
});

test("buildUnifiedUnderwritingIntelligence calibrates the Goss Rd deal without double counting financing and cash sources", () => {
  const result = buildUnifiedUnderwritingIntelligence({
    propertyAddress: "952 Goss Rd",
    purchasePrice: "135000",
    rehabBudget: "60000",
    estimatedArv: "300000",
    annualTaxes: "2800",
    annualInsurance: "1200",
    holdingMonths: "4",
    actualLoanAmount: "182330",
    annualInterestRate: "11.24",
    cashToClose: "26857.90",
    earnestMoney: "3500",
    totalInitialCashInvested: "30357.90",
    constructionHoldback: "62990",
    exitStrategy: "Flip",
    sellingCostPercent: "8",
    sellerConcessions: "0",
    fixedSaleCosts: "0",
    paymentType: "Interest Only",
  }, [], []);

  assert.equal(result.normalizedDeal.purchasePrice, 135000);
  assert.equal(result.financingAnalysis.actualLoanAmount, 182330);
  assert.ok(Math.abs(result.financingAnalysis.monthlyCarry - 1769.52) < 1);
  assert.ok(Math.abs(result.financingAnalysis.totalInterest - 81975.57) < 1);
  assert.ok(Math.abs(result.financingAnalysis.initialCashInvested - 30357.90) < 0.01);
  assert.ok(result.financingAnalysis.constructionHoldback === 0 || result.financingAnalysis.constructionHoldback === 62990);
  assert.ok(result.financingAnalysis.financingCosts >= 0);
  assert.ok(result.financingAnalysis.cashToClose === 26857.90 || result.financingAnalysis.cashToClose === 0);
  assert.ok(result.financingAnalysis.earnestMoney === 3500 || result.financingAnalysis.earnestMoney === 0);
  assert.ok(result.financingAnalysis.projectedProfit > 0);
  assert.ok(result.financingAnalysis.projectedProfit < 500000);
  assert.equal(result.decisionConsistency.recommendation, result.decisionConsistency.baseRecommendation);
  assert.equal(result.decisionConsistency.recommendation, result.decisionConsistency.aiDecision);
  assert.notEqual(result.decisionConsistency.investmentDecision, "Renegotiate");
  assert.ok(result.decisionConsistency.dataCompletenessScore >= 0);
  assert.ok(result.decisionConsistency.underwritingConfidence >= 0);
  assert.ok(result.decisionConsistency.arvConfidence >= 0);
  assert.ok(result.decisionConsistency.financingConfidence >= 0);
  assert.ok(Number.isFinite(result.decisionConsistency.decisionConfidence));
});

test("buildUnifiedUnderwritingIntelligence preserves persisted profit guidance for the saved Goss deal", () => {
  const result = buildUnifiedUnderwritingIntelligence({
    propertyAddress: "952 Goss Rd",
    purchasePrice: "135000",
    rehabBudget: "60000",
    estimatedArv: "300000",
    annualTaxes: "2800",
    annualInsurance: "1200",
    holdingMonths: "4",
    actualLoanAmount: "182330",
    annualInterestRate: "11.24",
    cashToClose: "26857.90",
    earnestMoney: "3500",
    totalInitialCashInvested: "30357.90",
    constructionHoldback: "62990",
    closingCosts: "26857.90",
    financingCosts: "85575.568",
    projectedProfit: "77902.1",
    status: "active",
  }, [], []);

  assert.equal(result.flipAnalysis.netProfit, 77902.1);
  assert.equal(result.financingAnalysis.projectedProfit, 77902.1);
  assert.equal(result.sharedDecision.projectedProfit, 77902.1);
  assert.equal(result.sharedDecision.expectedProfit, 77902.1);
});

test("buildUnifiedUnderwritingIntelligence emits cross-module decision-layer signals", () => {
  const result = buildUnifiedUnderwritingIntelligence({
    propertyAddress: "123 Market St",
    purchasePrice: "140000",
    rehabBudget: "50000",
    estimatedArv: "310000",
    annualInterestRate: "8.5",
    actualLoanAmount: "150000",
    estimatedRent: "2400",
    holdingMonths: "4",
    exitStrategy: "BRRRR",
  }, [], []);

  assert.ok(result.breakEvenAndExitControl.breakEvenSalePrice > 0);
  assert.ok(result.cashForecast.periods.length >= 4);
  assert.ok(result.lenderIntelligence.loanQualification === "Qualified" || result.lenderIntelligence.loanQualification === "Conditional");
  assert.ok(typeof result.governance.approvalReady === "boolean");
  assert.ok(Array.isArray(result.historicalLearning.entries));
  assert.ok(result.refreshSignals.moduleSyncStatus === "Synchronized");
});

test("normalizeUnderwritingInputs preserves explicit financing and closing fields for transaction-based underwriting", () => {
  const normalized = normalizeUnderwritingInputs({
    purchasePrice: "135000",
    rehabBudget: "60000",
    estimatedArv: "300000",
    annualTaxes: "2800",
    annualInsurance: "1200",
    holdingMonths: "4",
    actualLoanAmount: "182330",
    annualInterestRate: "11.24",
    cashToClose: "26857.90",
    earnestMoney: "3500",
    totalInitialCashInvested: "30357.90",
    constructionHoldback: "62990",
    acquisitionClosingCosts: "15000",
    originationFee: "1800",
    brokerFee: "0",
    underwritingFee: "500",
    servicingFee: "250",
    lenderLegalFee: "750",
    monitoringFee: "100",
    otherLenderFees: "200",
    financedClosingCosts: true,
    fundingAmount: "182330",
    rehabFunding: "60000",
    sellerConcessions: "0",
    fixedSaleCosts: "0",
    sellingCostPercent: "8",
    paymentType: "Interest Only",
  });

  assert.equal(normalized.purchasePrice, 135000);
  assert.equal(normalized.actualLoanAmount, 182330);
  assert.equal(normalized.acquisitionClosingCosts, 15000);
  assert.equal(normalized.constructionHoldback, 62990);
  assert.equal(normalized.totalInitialCashInvested, 30357.90);
  assert.equal(normalized.financingCostsIncludeClosingCosts, true);
  assert.equal(normalized.paymentType, "Interest Only");
});

test("buildUnifiedUnderwritingIntelligence uses explicit transaction-based cash and financing inputs", () => {
  const result = buildUnifiedUnderwritingIntelligence({
    purchasePrice: "135000",
    rehabBudget: "60000",
    estimatedArv: "300000",
    annualTaxes: "2800",
    annualInsurance: "1200",
    holdingMonths: "4",
    actualLoanAmount: "182330",
    annualInterestRate: "11.24",
    cashToClose: "21000",
    earnestMoney: "5000",
    totalInitialCashInvested: "26000",
    constructionHoldback: "62990",
    acquisitionClosingCosts: "15000",
    originationFee: "1800",
    brokerFee: "0",
    underwritingFee: "500",
    servicingFee: "250",
    lenderLegalFee: "750",
    monitoringFee: "100",
    otherLenderFees: "200",
    fundedRehab: "35000",
    financedClosingCosts: true,
    paymentType: "Interest Only",
  }, [], []);

  assert.equal(result.financingAnalysis.initialCashInvested, 26000);
  assert.equal(result.financingAnalysis.constructionHoldback, 62990);
  assert.equal(result.financingAnalysis.actualLoanAmount, 182330);
  assert.ok(result.flipAnalysis.totalProjectCost > 0);
  assert.ok(result.financingAnalysis.financingCosts > 0);
});

test("normalizeDealForIntelligence preserves financing fields for underwriting-driven UI mapping", () => {
  const normalized = normalizeDealForIntelligence({
    purchasePrice: "135000",
    rehabBudget: "60000",
    estimatedArv: "300000",
    annualInterestRate: "11.24",
    actualLoanAmount: "182330",
    cashToClose: "26857.90",
    earnestMoney: "3500",
    totalInitialCashInvested: "30357.90",
    constructionHoldback: "62990",
    originationFee: "1800",
    underwritingFee: "500",
    servicingFee: "250",
    lenderLegalFee: "750",
    monitoringFee: "100",
    otherLenderFees: "200",
    paymentType: "Interest Only",
  });

  assert.equal(normalized.actualLoanAmount, 182330);
  assert.equal(normalized.annualInterestRate, 11.24);
  assert.equal(normalized.cashToClose, 26857.9);
  assert.equal(normalized.earnestMoney, 3500);
  assert.equal(normalized.totalInitialCashInvested, 30357.9);
  assert.equal(normalized.constructionHoldback, 62990);
});

test("buildInvestmentDecisionEngine uses active-project guidance for flip projects instead of rejecting them", () => {
  const result = buildInvestmentDecisionEngine({
    propertyAddress: "555 Project Rd",
    exitStrategy: "Flip",
    status: "Active Project",
  }, {
    dealScore: 72,
    overallRisk: 24,
    buyBoxResult: "PASS",
    arvConfidence: "High",
    estimatedFlipProfit: 22000,
    roi: 0.18,
    monthlyCashFlow: 900,
    cashRequired: 40000,
    qualificationStatus: "Qualified",
    warnings: [],
    analysisType: "Existing Project Analysis",
  });

  assert.equal(result.recommendation, "Continue Project");
});

test("Goss underwriting produces a shared owned-project decision result without contradictory cards", () => {
  const result = buildUnifiedUnderwritingIntelligence({
    propertyAddress: "952 Goss Rd",
    purchasePrice: "135000",
    rehabBudget: "60000",
    estimatedArv: "300000",
    actualLoanAmount: "182330",
    annualInterestRate: "11.24",
    cashToClose: "26857.90",
    earnestMoney: "3500",
    totalInitialCashInvested: "30357.90",
    constructionHoldback: "62990",
    financingCosts: "",
    holdingMonths: "4",
    paymentType: "Interest Only",
    status: "owned",
  }, [], []);

  assert.equal(result.sharedDecision.mode, "owned-project");
  assert.notEqual(result.sharedDecision.strategy, "Do Not Purchase");
  assert.notEqual(result.sharedDecision.investmentDecision, "Conditional Buy");
  assert.notEqual(result.sharedDecision.baseRecommendation, "Reject");
  assert.ok(result.sharedDecision.overallRiskScore > 0);
  assert.ok(result.sharedDecision.decisionConfidence > 0);
  assert.ok(result.sharedDecision.arvConfidence === "Preliminary" || result.sharedDecision.arvConfidence === "Low");
  assert.equal(result.sharedDecision.financingCostSource, "calculated");
  assert.equal(result.sharedDecision.expectedProfit, result.sharedDecision.projectedProfit);
  assert.ok(result.sharedDecision.bestCaseProfit > result.sharedDecision.expectedProfit);
  assert.ok(result.sharedDecision.breakEvenSalePrice > 0);
  assert.ok(Number.isFinite(result.sharedDecision.breakEvenSalePrice));
  assert.ok(result.sharedDecision.reasons.length > 0);
  assert.ok(result.sharedDecision.warnings.length >= 1);
});

test("buildUnifiedUnderwritingIntelligence uses effective financing costs for risk and decision calculations", () => {
  const result = buildUnifiedUnderwritingIntelligence({
    propertyAddress: "952 Goss Rd",
    purchasePrice: "135000",
    rehabBudget: "60000",
    estimatedArv: "300000",
    financingCosts: "",
    actualLoanAmount: "182330",
    annualInterestRate: "11.24",
    holdingMonths: "4",
    paymentType: "Interest Only",
    status: "owned",
  }, [], []);

  assert.ok(result.financingAnalysis.effectiveFinancingCosts > 0);
  assert.equal(result.financingAnalysis.financingCostSource, "calculated");
  assert.ok(result.sharedDecision.overallRiskScore > 0);
  assert.ok(result.sharedDecision.decisionConfidence > 0);
  assert.ok(result.sharedDecision.decisionBreakingThreshold > 0);
});

test("buildArvIntelligence handles a single supported comp without crashing", () => {
  const result = buildArvIntelligence({
    propertyAddress: "123 Main St",
    city: "Cincinnati",
    state: "OH",
    zipCode: "45211",
    propertyType: "Single Family",
    bedrooms: 3,
    bathrooms: 2,
    squareFeet: 1800,
    yearBuilt: 1955,
    condition: "Average",
  }, [{
    compAddress: "124 Main St",
    salePrice: "220000",
    saleDate: "2024-01-15",
    squareFeet: "1750",
    bedrooms: 3,
    bathrooms: 2,
    yearBuilt: 1955,
    condition: "Average",
    zipCode: "45211",
    neighborhood: "Northside",
    propertyType: "Single Family",
    distanceMiles: 1.4,
  }], []);

  assert.equal(result.compEvaluations.length, 1);
  assert.ok(result.supportedBaseArv > 0);
  assert.ok(result.confidenceLevel === "Low" || result.confidenceLevel === "Insufficient Data");
});

test("buildArvIntelligence preserves explicit manual ARV overrides", () => {
  const result = buildArvIntelligence({
    propertyAddress: "123 Main St",
    city: "Cincinnati",
    state: "OH",
    zipCode: "45211",
    propertyType: "Single Family",
    bedrooms: 3,
    bathrooms: 2,
    squareFeet: 1800,
    yearBuilt: 1955,
    condition: "Average",
    manualArv: 310000,
  }, [{
    compAddress: "124 Main St",
    salePrice: "220000",
    saleDate: "2024-01-15",
    squareFeet: "1750",
    bedrooms: 3,
    bathrooms: 2,
    yearBuilt: 1955,
    condition: "Average",
    zipCode: "45211",
    neighborhood: "Northside",
    propertyType: "Single Family",
    distanceMiles: 1.4,
  }], []);

  assert.equal(result.supportedBaseArv, 310000);
  assert.equal(result.supportedLowArv, 294500);
  assert.equal(result.supportedHighArv, 325500);
  assert.ok(result.explanation.whySelected.includes("override"));
});

test("buildArvIntelligence generates comparable ranking, outlier, selection, confidence, and adjustment outputs", () => {
  const result = buildArvIntelligence({
    propertyAddress: "100 Main St",
    city: "Cincinnati",
    state: "OH",
    zipCode: "45211",
    propertyType: "Single Family",
    bedrooms: 3,
    bathrooms: 2,
    squareFeet: 1800,
    yearBuilt: 1955,
    condition: "Average",
    lotSize: 7000,
    garage: "2 car",
    basement: "Finished",
    style: "Colonial",
  }, [{
    compAddress: "101 Main St",
    salePrice: 215000,
    saleDate: "2024-02-10",
    squareFeet: 1750,
    bedrooms: 3,
    bathrooms: 2,
    yearBuilt: 1955,
    condition: "Average",
    zipCode: "45211",
    neighborhood: "Northside",
    propertyType: "Single Family",
    distanceMiles: 2,
    lotSize: 6500,
    garage: "2 car",
    basement: "Finished",
    style: "Colonial",
    included: true,
  }, {
    compAddress: "102 Main St",
    salePrice: 325000,
    saleDate: "2021-01-01",
    squareFeet: 2200,
    bedrooms: 4,
    bathrooms: 3,
    yearBuilt: 1970,
    condition: "Good",
    zipCode: "45211",
    neighborhood: "Westwood",
    propertyType: "Single Family",
    distanceMiles: 12,
    lotSize: 12000,
    garage: "Detached",
    basement: "Unfinished",
    style: "Ranch",
    included: true,
  }, {
    compAddress: "103 Main St",
    salePrice: 180000,
    saleDate: "2018-01-01",
    squareFeet: 1500,
    bedrooms: 2,
    bathrooms: 1,
    yearBuilt: 1940,
    condition: "Poor",
    zipCode: "45211",
    neighborhood: "Northside",
    propertyType: "Single Family",
    distanceMiles: 1,
    lotSize: 5000,
    garage: "None",
    basement: "None",
    style: "Bungalow",
    included: false,
    exclusionReason: "Manual override",
  }], []);

  assert.ok(result.comparableRankings.length >= 2);
  assert.ok(result.comparableRankings[0].rankScore >= 0);
  assert.ok(["Best Comparable", "Acceptable Comparable", "Weak Comparable", "Rejected Comparable"].includes(result.comparableRankings[0].classification));
  assert.ok(result.comparableOutlierSummary.priceOutlierCount >= 0);
  assert.ok(result.comparableConfidence.overallConfidenceScore >= 0);
  assert.ok(result.adjustmentEngine.bedrooms.adjustmentPercent !== undefined);
  assert.ok(result.adjustmentEngine.squareFeet.adjustmentPercent !== undefined);
});

test("buildPredictiveMarketIntelligence produces market trend, risk, opportunity, confidence, and executive outputs", () => {
  const market = buildPredictiveMarketIntelligence({
    propertyAddress: "100 Main St",
    city: "Cincinnati",
    state: "OH",
    zipCode: "45211",
    neighborhood: "Northside",
  }, [{
    neighborhoodName: "Northside",
    city: "Cincinnati",
    zipCode: "45211",
    appreciation1Year: 6.2,
    appreciation3Year: 5.8,
    appreciation5Year: 4.9,
    appreciation10Year: 4.1,
    medianHomeValue: 285000,
    averageDaysOnMarket: 24,
    activeInventory: 18,
    monthsOfSupply: 2.4,
    medianPricePerSqft: 175,
  }], [{ salePrice: 240000, squareFeet: 1800, saleDate: "2024-02-01", distanceMiles: 1.5 }]);

  assert.ok(market.marketTrendEngine.appreciationTrend > 0);
  assert.ok(market.marketRiskEngine.marketStabilityScore >= 0);
  assert.ok(["Strong Buy", "Buy", "Neutral", "Watch", "Avoid"].includes(market.opportunityDetection.classification));
  assert.ok(market.marketConfidence.forecastConfidence >= 0);
  assert.ok(market.executiveSummary.recommendedStrategy.length > 0);
});

test("buildUnifiedUnderwritingIntelligence exposes predictive market analysis to downstream modules", () => {
  const result = buildUnifiedUnderwritingIntelligence({
    propertyAddress: "100 Main St",
    city: "Cincinnati",
    state: "OH",
    zipCode: "45211",
    propertyType: "Single Family",
    bedrooms: 3,
    bathrooms: 2,
    squareFeet: 1800,
    yearBuilt: 1955,
    purchasePrice: 150000,
    rehabBudget: 30000,
    estimatedArv: 260000,
    strategy: "Flip",
  }, [{ salePrice: 230000, squareFeet: 1750, saleDate: "2024-02-01", distanceMiles: 1.2 }], [{
    neighborhoodName: "Northside",
    city: "Cincinnati",
    zipCode: "45211",
    appreciation1Year: 6.2,
    appreciation3Year: 5.8,
    appreciation5Year: 4.9,
    appreciation10Year: 4.1,
    medianHomeValue: 285000,
    averageDaysOnMarket: 24,
    activeInventory: 18,
    monthsOfSupply: 2.4,
    medianPricePerSqft: 175,
  }]);

  assert.ok(result.marketAnalysis);
  assert.ok(result.marketAnalysis.marketTrendEngine.appreciationTrend > 0);
  assert.ok(result.marketAnalysis.opportunityDetection.classification.length > 0);
  assert.ok(result.marketRisk);
  assert.ok(result.marketRisk.marketRiskRating.length > 0);
});

test("buildExecutiveMarketSummaryEngine returns explainable executive summaries and recommendations", () => {
  const result = buildExecutiveMarketSummaryEngine({
    strategy: "Flip",
    purchasePrice: 140000,
    rehabBudget: 30000,
    estimatedArv: 260000,
    manualArv: 270000,
  }, {
    confidenceLevel: "High",
    supportedBaseArv: 270000,
    compEvaluations: [{ qualityScore: 82 }, { qualityScore: 78 }, { qualityScore: 74 }],
  }, {
    marketTrendEngine: { appreciationTrend: 5.8, priceMomentum: 3.4, inventoryTrend: 86, daysOnMarketTrend: 82, pricePerSquareFootTrend: 2.9 },
    marketRiskEngine: { marketStabilityScore: 81, exitRisk: "Low", marketRiskRating: "Low" },
  }, {
    classification: "Buy",
    overallOpportunityScore: 82,
  }, {
    forecastConfidence: 84,
    dataQualityScore: 86,
    comparableReliability: "High",
    marketTrendReliability: "High",
    predictionStability: "Stable",
    forecastConsistency: "High",
  }, {
    action: "PROCEED",
  });

  assert.ok(result.executiveSummary.overallMarketRating.length > 0);
  assert.ok(result.executiveSummary.opportunityRating.length > 0);
  assert.ok(result.executiveSummary.marketTrendSummary.length > 0);
  assert.ok(result.executiveSummary.appreciationOutlook.length > 0);
  assert.ok(result.executiveSummary.exitStrategyRecommendation.length > 0);
  assert.ok(result.executiveSummary.primaryRisks.length > 0);
  assert.ok(result.executiveSummary.primaryStrengths.length > 0);
  assert.ok(result.executiveSummary.forecastConfidence >= 0);
  assert.ok(result.executiveSummary.recommendedAction.length > 0);
  assert.ok(result.strategySummaries.flipStrategy.length > 0);
  assert.ok(result.strategySummaries.brrrrrStrategy.length > 0);
  assert.ok(result.strategySummaries.holdStrategy.length > 0);
  assert.ok(["Strong Buy", "Buy", "Hold", "Review", "Pass"].includes(result.executiveRecommendation.label));
  assert.ok(result.executiveRecommendation.reason.length > 0);
});

test("buildUnifiedUnderwritingIntelligence exposes executive market summaries to downstream modules", () => {
  const result = buildUnifiedUnderwritingIntelligence({
    propertyAddress: "100 Main St",
    city: "Cincinnati",
    state: "OH",
    zipCode: "45211",
    propertyType: "Single Family",
    bedrooms: 3,
    bathrooms: 2,
    squareFeet: 1800,
    yearBuilt: 1955,
    purchasePrice: 150000,
    rehabBudget: 30000,
    estimatedArv: 260000,
    strategy: "Flip",
  }, [{ salePrice: 230000, squareFeet: 1750, saleDate: "2024-02-01", distanceMiles: 1.2 }], [{
    neighborhoodName: "Northside",
    city: "Cincinnati",
    zipCode: "45211",
    appreciation1Year: 6.2,
    appreciation3Year: 5.8,
    appreciation5Year: 4.9,
    appreciation10Year: 4.1,
    medianHomeValue: 285000,
    averageDaysOnMarket: 24,
    activeInventory: 18,
    monthsOfSupply: 2.4,
    medianPricePerSqft: 175,
  }]);

  assert.ok(result.executiveMarketSummary);
  assert.ok(result.executiveMarketSummary.executiveSummary.overallMarketRating.length > 0);
  assert.ok(result.executiveMarketSummary.executiveRecommendation.label.length > 0);
  assert.ok(result.executiveMarketSummary.strategySummaries.flipStrategy.length > 0);
});

test("buildOpportunityDetectionEngine returns an explainable opportunity score and rationale", () => {
  const result = buildOpportunityDetectionEngine({
    strategy: "Flip",
    purchasePrice: 140000,
    rehabBudget: 30000,
    estimatedArv: 260000,
    estimatedRent: 2400,
  }, {
    confidenceLevel: "High",
    supportedBaseArv: 260000,
    comparableConfidence: { overallConfidenceScore: 82, averageRankScore: 78 },
  }, {
    marketTrendEngine: { appreciationTrend: 5.2, priceMomentum: 4.1, inventoryTrend: 82, daysOnMarketTrend: 78, pricePerSquareFootTrend: 3.2 },
    marketRiskEngine: { marketStabilityScore: 83, exitRisk: "Low", marketRiskRating: "Low" },
  }, {
    result: "PASS",
  }, {
    dealScore: 82,
  }, {
    cashOnCashReturn: 0.18,
    cashLeftInDeal: 42000,
    debtServiceCoverageRatio: 1.4,
    monthlyCashFlow: 600,
  }, {
    profitMargin: 0.16,
    netProfit: 32000,
    returnOnCost: 0.19,
  }, {
    monthlyCashFlow: 1200,
    netOperatingIncome: 2200,
    cashOnCashReturn: 0.12,
  });

  assert.ok(["Strong Buy", "Buy", "Neutral", "Watch", "Avoid"].includes(result.classification));
  assert.ok(result.overallOpportunityScore >= 0 && result.overallOpportunityScore <= 100);
  assert.ok(typeof result.aiReasoning.summary === "string");
  assert.ok(Array.isArray(result.aiReasoning.biggestStrengths));
  assert.ok(Array.isArray(result.aiReasoning.biggestWeaknesses));
  assert.ok(typeof result.aiReasoning.largestRisk === "string");
  assert.ok(typeof result.aiReasoning.highestUpside === "string");
});

test("buildForecastConfidenceEngine returns explainable confidence and uncertainty outputs", () => {
  const result = buildForecastConfidenceEngine({
    estimatedArv: 260000,
    purchasePrice: 150000,
    rehabBudget: 30000,
    strategy: "Flip",
  }, {
    supportedBaseArv: 260000,
    compEvaluations: [{ qualityScore: 86 }, { qualityScore: 74 }, { qualityScore: 71 }],
    compSpread: 0.08,
    confidenceLevel: "High",
  }, {
    marketTrendEngine: { appreciationTrend: 5.2, priceMomentum: 3.8, inventoryTrend: 82, daysOnMarketTrend: 74, pricePerSquareFootTrend: 2.9 },
    marketRiskEngine: { marketStabilityScore: 83, marketRiskRating: "Low" },
  }, {
    opportunityAnalysis: { overallOpportunityScore: 81 },
  });

  assert.ok(result.forecastConfidence >= 0 && result.forecastConfidence <= 100);
  assert.ok(result.dataQualityScore >= 0 && result.dataQualityScore <= 100);
  assert.ok(["High", "Moderate", "Low"].includes(result.marketTrendReliability));
  assert.ok(["Stable", "Mixed", "Volatile"].includes(result.predictionStability));
  assert.ok(typeof result.aiExplanation.summary === "string");
  assert.ok(Array.isArray(result.aiExplanation.uncertaintyFactors));
  assert.ok(Array.isArray(result.aiExplanation.improvementActions));
});

test("buildPredictiveMarketIntelligence returns an explainable market risk engine with a risk rating", () => {
  const market = buildPredictiveMarketIntelligence({
    propertyAddress: "100 Main St",
    city: "Cincinnati",
    state: "OH",
    zipCode: "45211",
    neighborhood: "Northside",
  }, [{
    neighborhoodName: "Northside",
    city: "Cincinnati",
    zipCode: "45211",
    appreciation1Year: 1.8,
    appreciation3Year: 2.4,
    appreciation5Year: 2.8,
    appreciation10Year: 3.1,
    medianHomeValue: 260000,
    averageDaysOnMarket: 55,
    activeInventory: 38,
    monthsOfSupply: 5.8,
    medianPricePerSqft: 160,
  }], [{ salePrice: 240000, squareFeet: 1800, saleDate: "2024-02-01", distanceMiles: 1.5 }]);

  assert.ok(market.marketRiskEngine.marketStabilityScore >= 0);
  assert.ok(market.marketRiskEngine.volatilityScore >= 0);
  assert.ok(typeof market.marketRiskEngine.marketStabilityExplanation === "string");
  assert.ok(typeof market.marketRiskEngine.appreciationRiskExplanation === "string");
  assert.ok(typeof market.marketRiskEngine.liquidityRiskExplanation === "string");
  assert.ok(typeof market.marketRiskEngine.downsideRiskExplanation === "string");
  assert.ok(typeof market.marketRiskEngine.exitRiskExplanation === "string");
  assert.ok(typeof market.marketRiskEngine.volatilityScoreExplanation === "string");
  assert.ok(typeof market.marketRiskEngine.marketRiskRatingExplanation === "string");
  assert.ok(["Very Low", "Low", "Moderate", "Elevated", "High"].includes(market.marketRiskEngine.marketRiskRating));
});

test("buildEnterpriseDealIntelligenceSummary assembles knowledge, search, reporting, documents, and routing outputs", () => {
  const result = buildEnterpriseDealIntelligenceSummary({
    propertyAddress: "456 Market St",
    city: "Cincinnati",
    state: "OH",
    strategy: "Flip",
    estimatedArv: 280000,
  }, {
    supportedBaseArv: 280000,
  }, [{ propertyAddress: "456 Market St" }], [{ propertyName: "456 Market St" }], [{ contractorName: "BuildCo" }], [{ lenderName: "Northstar Capital" }], [{ dealId: "1", recommendation: "Proceed" }], [{ alert: "Budget threshold exceeded", relatedModule: "Deal Intelligence" }], [{ id: 1 }], { summary: { healthStatus: "Healthy" } }, [{ title: "Validate comp support" }]);

  assert.ok(result.knowledge);
  assert.equal(result.search.recommendedModule, "Deal Intelligence");
  assert.equal(result.reporting.metrics.strategy, "Flip");
  assert.ok(result.documents.documents.length >= 3);
  assert.equal(result.commandRouting.route, "Deal Intelligence");
  assert.equal(result.summary.primaryRecommendation, "Deal Intelligence");
});

test("buildBuyBoxIntelligence rejects prohibited property types", () => {
  const result = buildBuyBoxIntelligence({
    zipCode: "45211",
    propertyType: "Land",
    rehabBudget: 50000,
    squareFeet: 1200,
    yearBuilt: 1950,
    strategy: "Flip",
  }, []);

  assert.equal(result.decision, "Automatic Reject");
  assert.ok(result.rulesFailed.some((rule) => rule.includes("property type")));
});

test("buildOfferIntelligence keeps maximum offer at or below walk-away", () => {
  const offer = buildOfferIntelligence({
    askingPrice: 220000,
    purchasePrice: 200000,
    rehabBudget: 40000,
    strategy: "Flip",
    squareFeet: 1800,
  }, {
    supportedBaseArv: 260000,
    confidenceLevel: "Moderate",
  }, {
    decision: "Pass",
  }, {
    loanAmount: 0,
  });

  assert.ok(offer.maximumOffer <= offer.walkAwayPrice);
  assert.equal(offer.offerPositions.length, 4);
});

test("buildOfferIntelligence builds a negotiation ladder with per-level metrics and guidance", () => {
  const offer = buildOfferIntelligence({
    askingPrice: 220000,
    purchasePrice: 180000,
    rehabBudget: 30000,
    strategy: "Flip",
    estimatedArv: 260000,
    squareFeet: 1800,
    financingCosts: 4000,
    closingCosts: 6000,
    holdingCosts: 2500,
    sellingCosts: 18000,
    requiredProfit: 30000,
  }, {
    supportedBaseArv: 260000,
    supportedLowArv: 240000,
    confidenceLevel: "High",
  }, {
    decision: "Strong Pass",
    result: "PASS",
  }, {
    loanAmount: 0,
    lenderMaxLtv: 0.75,
  });

  assert.equal(offer.offerLadder.levels.length, 5);
  assert.equal(offer.offerLadder.levels[1].level, "Second Offer");
  const firstLevel = offer.offerLadder.levels[0];
  assert.ok(firstLevel.expectedProfit !== undefined);
  assert.ok(firstLevel.profitMargin >= 0);
  assert.ok(firstLevel.cashRequired >= 0);
  assert.ok(firstLevel.cashRemainingInDeal !== undefined);
  assert.ok(firstLevel.dealScore >= 0);
  assert.ok(["Low", "Moderate", "High", "Critical"].includes(firstLevel.riskLevel));
  assert.equal(firstLevel.strategy, "Flip");
  assert.ok(["ARV", "Rehab", "Financing", "Profit target", "Buy Box", "Risk policy", "Capital limits"].includes(firstLevel.constraint));
  assert.equal(offer.negotiationSupport.openingPosition, offer.initialOffer);
  assert.equal(offer.negotiationSupport.targetPosition, offer.targetOffer);
  assert.equal(offer.negotiationSupport.walkAwayPoint, offer.walkAwayPrice);
  assert.ok(offer.negotiationSupport.sellerConcessionOpportunities.length > 0);
  assert.ok(offer.negotiationSupport.priceVsTermsRecommendation.length > 0);
  assert.ok(offer.negotiationSupport.inspectionRecommendation.length > 0);
  assert.ok(offer.negotiationSupport.earnestMoneyRecommendation > 0);
  assert.ok(offer.negotiationSupport.closingTimelineRecommendation.length > 0);
});

test("buildOfferIntelligence preserves manual overrides without exceeding the approved ladder unless documented", () => {
  const offer = buildOfferIntelligence({
    askingPrice: 240000,
    purchasePrice: 200000,
    rehabBudget: 30000,
    strategy: "Flip",
    manualOfferAmount: 220000,
  }, {
    supportedBaseArv: 260000,
    confidenceLevel: "High",
  }, {
    decision: "Strong Pass",
    result: "PASS",
  }, {
    loanAmount: 0,
    lenderMaxLtv: 0.75,
  });

  assert.equal(offer.approvalWorkflow.manualOverrides.length, 1);
  assert.equal(offer.overrideApplied, true);
  assert.equal(offer.offerLadder.levels[2].amount, 220000);
  assert.ok(offer.offerLadder.maximumApprovedOffer >= 220000);
});

test("buildOfferIntelligence keeps shared offer signals aligned across strategy views", () => {
  const flipOffer = buildOfferIntelligence({
    askingPrice: 240000,
    purchasePrice: 200000,
    rehabBudget: 40000,
    strategy: "Flip",
    financingCosts: 3000,
    sellingCosts: 18000,
  }, {
    supportedBaseArv: 320000,
    confidenceLevel: "High",
  }, {
    decision: "Strong Pass",
    result: "PASS",
  }, {
    loanAmount: 0,
  });

  const brrrrOffer = buildOfferIntelligence({
    askingPrice: 240000,
    purchasePrice: 200000,
    rehabBudget: 40000,
    strategy: "BRRRR",
    estimatedRent: 3200,
    refinanceValue: 320000,
    refinanceLtv: 0.75,
    financingCosts: 3000,
    sellingCosts: 18000,
  }, {
    supportedBaseArv: 320000,
    confidenceLevel: "High",
  }, {
    decision: "Strong Pass",
    result: "PASS",
  }, {
    loanAmount: 0,
  });

  assert.equal(flipOffer.offerCalculations.shared.targetOffer, flipOffer.targetOffer);
  assert.equal(brrrrOffer.offerCalculations.shared.targetOffer, brrrrOffer.targetOffer);
  assert.ok(brrrrOffer.offerCalculations.brrrrr.targetOffer >= flipOffer.offerCalculations.shared.targetOffer);
  assert.equal(brrrrOffer.strategyOffer.type, "BRRRR");
});

test("buildOfferIntelligence builds a full offer ladder and decision for a supported flip", () => {
  const offer = buildOfferIntelligence({
    askingPrice: 220000,
    purchasePrice: 180000,
    rehabBudget: 30000,
    strategy: "Flip",
    estimatedArv: 260000,
    squareFeet: 1800,
    financingCosts: 4000,
    closingCosts: 6000,
    holdingCosts: 2500,
    sellingCosts: 18000,
    requiredProfit: 30000,
  }, {
    supportedBaseArv: 260000,
    supportedLowArv: 240000,
    confidenceLevel: "High",
  }, {
    decision: "Strong Pass",
    result: "PASS",
  }, {
    loanAmount: 0,
    lenderMaxLtv: 0.75,
  });

  assert.equal(offer.offerLadder.levels.length, 5);
  assert.equal(offer.offerDecision.decision, "OFFER");
  assert.equal(offer.offerDecision.confidenceLevel, "High");
  assert.ok(offer.offerLadder.maximumApprovedOffer <= offer.controllingMao);
  assert.ok(offer.offerLetterData.offerPrice > 0);
  assert.equal(offer.strategyOffer.type, "Flip");
});

test("buildOfferIntelligence holds for more information when critical data is missing", () => {
  const offer = buildOfferIntelligence({
    askingPrice: 220000,
    purchasePrice: 180000,
    strategy: "Flip",
  }, {
    supportedBaseArv: 0,
    confidenceLevel: "Insufficient Data",
  }, {
    decision: "Outside Buy Box",
    result: "FAIL",
  }, {
    loanAmount: 0,
  });

  assert.equal(offer.offerDecision.decision, "HOLD FOR MORE INFORMATION");
  assert.ok(offer.offerDecision.missingInformation.length > 0);
});

test("buildOfferIntelligence supports flip and BRRRR paths with a single shared engine", () => {
  const flipOffer = buildOfferIntelligence({
    askingPrice: 240000,
    purchasePrice: 200000,
    rehabBudget: 40000,
    strategy: "Flip",
    financingCosts: 3000,
    sellingCosts: 18000,
  }, {
    supportedBaseArv: 320000,
    confidenceLevel: "High",
  }, {
    decision: "Strong Pass",
    result: "PASS",
  }, {
    loanAmount: 0,
  });

  const brrrrOffer = buildOfferIntelligence({
    askingPrice: 240000,
    purchasePrice: 200000,
    rehabBudget: 40000,
    strategy: "BRRRR",
    estimatedRent: 3200,
    refinanceValue: 320000,
    refinanceLtv: 0.75,
    financingCosts: 3000,
    sellingCosts: 18000,
  }, {
    supportedBaseArv: 320000,
    confidenceLevel: "High",
  }, {
    decision: "Strong Pass",
    result: "PASS",
  }, {
    loanAmount: 0,
  });

  assert.ok(flipOffer.offerCalculations.flip.initialOffer > 0);
  assert.ok(brrrrOffer.offerCalculations.brrrrr.initialOffer > 0);
  assert.equal(flipOffer.controllingConstraint, "Profit Target");
  assert.equal(brrrrOffer.strategyOffer.type, "BRRRR");
  assert.ok(brrrrOffer.offerCalculations.brrrrr.recommendedOffer >= 0);
});

test("buildOfferIntelligence preserves manual overrides and recalculation triggers", () => {
  const baseOffer = buildOfferIntelligence({
    askingPrice: 210000,
    purchasePrice: 190000,
    rehabBudget: 35000,
    strategy: "Flip",
    manualOfferAmount: 160000,
  }, {
    supportedBaseArv: 280000,
    confidenceLevel: "Moderate",
  }, {
    decision: "Pass",
    result: "PASS",
  }, {
    loanAmount: 0,
  });

  const recalculatedOffer = buildOfferIntelligence({
    askingPrice: 220000,
    purchasePrice: 190000,
    rehabBudget: 35000,
    strategy: "Flip",
    manualOfferAmount: 160000,
  }, {
    supportedBaseArv: 290000,
    confidenceLevel: "Moderate",
  }, {
    decision: "Pass",
    result: "PASS",
  }, {
    loanAmount: 0,
  });

  assert.equal(baseOffer.recommendedOffer, 160000);
  assert.equal(baseOffer.approvalWorkflow.manualOverrides.length, 1);
  assert.notEqual(baseOffer.recalculationKey, recalculatedOffer.recalculationKey);
  assert.ok(recalculatedOffer.targetOffer > baseOffer.targetOffer);
});

test("buildOfferIntelligence preserves negative profit results for weak deals", () => {
  const offer = buildOfferIntelligence({
    askingPrice: 220000,
    purchasePrice: 210000,
    rehabBudget: 90000,
    strategy: "Flip",
  }, {
    supportedBaseArv: 220000,
    confidenceLevel: "Low",
  }, {
    decision: "Conditional",
    result: "CONDITIONAL",
  }, {
    loanAmount: 0,
  });

  assert.ok(offer.expectedProfitAtEachOffer[0].expectedProfit < 0);
  assert.equal(offer.offerDecision.decision, "HOLD FOR MORE INFORMATION");
});

test("buildArvIntelligence preserves manual ARV as the active source when comp support is weak", () => {
  const arv = buildArvIntelligence({
    propertyAddress: "555 Manual Ave",
    city: "Cincinnati",
    state: "OH",
    zipCode: "45211",
    propertyType: "Single Family",
    bedrooms: 3,
    bathrooms: 2,
    squareFeet: 1800,
    yearBuilt: 1955,
    manualArv: 310000,
  }, [], []);

  assert.equal(arv.activeArvSource, "Manual");
  assert.equal(arv.activeArv, 310000);
  assert.equal(arv.activeArvConfidence, "Low");
  assert.equal(arv.manualVersusSupportedVariance, 0);
});

test("buildOfferIntelligence switches to retrospective acquisition review for owned projects", () => {
  const offer = buildOfferIntelligence({
    propertyAddress: "952 Goss Rd",
    purchasePrice: 135000,
    rehabBudget: 60000,
    estimatedArv: 300000,
    financingCosts: 85575,
    closingCosts: 12000,
    holdingCosts: 15000,
    sellingCosts: 24000,
    status: "owned",
    strategy: "Flip",
  }, { supportedBaseArv: 300000, confidenceLevel: "Moderate" }, { decision: "Pass" }, { loanAmount: 182330, lenderMaxLtv: 0.75 });

  assert.equal(offer.reviewMode, "retrospective-acquisition-review");
  assert.ok(offer.retrospectiveReview);
  assert.ok(offer.retrospectiveReview.originalAcquisitionVariance >= 0);
  assert.ok(offer.retrospectiveReview.currentProjectedOutcome > 0);
});

test("buildAppraisalIntelligence surfaces critical risk for weak support", () => {
  const appraisal = buildAppraisalIntelligence({
    address: "100 Main",
    city: "Covington",
    state: "KY",
    zipCode: "41011",
    supportedARV: 260000,
    requestedARV: 360000,
  }, [{
    salePrice: 180000,
    saleDate: "2018-01-01",
    squareFeet: 1600,
    distanceMiles: 12,
    included: false,
  }]);

  assert.equal(appraisal.riskLevel, "Critical Risk");
  assert.ok(appraisal.appraiserQuestions.length > 0);
});

test("buildBuyBoxIntelligence provides explainable market and neighborhood scoring", () => {
  const result = buildBuyBoxIntelligence({
    zipCode: "45211",
    propertyType: "Single Family",
    rehabBudget: 45000,
    squareFeet: 1900,
    yearBuilt: 1960,
    strategy: "Flip",
    purchasePrice: 160000,
  }, [{
    neighborhoodName: "Northside",
    city: "Cincinnati",
    zipCode: "45211",
    rentalDemandScore: 78,
    appreciation1Year: 6.5,
    crimeRating: "Low",
    liquidityScore: 80,
    averageDaysOnMarket: 28,
  }]);

  assert.equal(result.decision, "Strong Pass");
  assert.ok(result.scoringBreakdown.some((item) => item.category === "Property"));
  assert.ok(result.scoringBreakdown.some((item) => item.category === "Market"));
  assert.ok(result.scoringBreakdown.some((item) => item.category === "Neighborhood"));
  assert.ok(result.scoringExplanation.includes("Primary market"));
  assert.ok(result.marketScore > result.propertyLevelScore);
});

test("normalizeDealForIntelligence maps intake fields into intelligence-ready values", () => {
  const intakeDeal = {
    address: "123 Main St",
    city: "Cincinnati",
    state: "OH",
    zip: "45211",
    propertyType: "Single Family",
    bedrooms: "3",
    bathrooms: "2",
    squareFeet: "1800",
    yearBuilt: "1950",
    askingPrice: "150000",
    purchasePrice: "145000",
    rehabBudget: "35000",
    arv: "220000",
    estimatedRent: "2800",
    taxes: "2400",
    insurance: "1200",
    financingCosts: "3000",
    closingCosts: "5000",
    holdingMonths: "6",
    leadSource: "Referral",
    exitStrategy: "Flip",
  };

  const normalized = normalizeDealForIntelligence(intakeDeal);

  assert.equal(normalized.propertyAddress, "123 Main St");
  assert.equal(normalized.purchasePrice, 145000);
  assert.equal(normalized.askingPrice, 150000);
  assert.equal(normalized.rehabBudget, 35000);
  assert.equal(normalized.estimatedArv, 220000);
  assert.equal(normalized.arv, 220000);
  assert.equal(normalized.projectedARV, 220000);
  assert.equal(normalized.estimatedRent, 2800);
  assert.equal(normalized.zipCode, "45211");
  assert.equal(normalized.strategy, "Flip");
  assert.equal(normalized.exitStrategy, "Flip");
});

test("buildUnifiedUnderwritingIntelligence produces shared ARV, rehab, MAO, and stress outputs", () => {
  const result = buildUnifiedUnderwritingIntelligence({
    propertyAddress: "123 Main St",
    city: "Cincinnati",
    state: "OH",
    zipCode: "45211",
    propertyType: "Single Family",
    bedrooms: 3,
    bathrooms: 2,
    squareFeet: 1800,
    yearBuilt: 1950,
    purchasePrice: 140000,
    rehabBudget: 30000,
    estimatedArv: 240000,
    estimatedRent: 2400,
    closingCosts: 8000,
    financingCosts: 4000,
    taxes: 2200,
    insurance: 1400,
    strategy: "Flip",
  }, [{
    id: "comp-1",
    compAddress: "124 Main St",
    salePrice: 220000,
    saleDate: "2024-01-15",
    squareFeet: 1750,
    bedrooms: 3,
    bathrooms: 2,
    yearBuilt: 1955,
    condition: "Average",
    zipCode: "45211",
    neighborhood: "Northside",
    propertyType: "Single Family",
    distanceMiles: 1.2,
    included: true,
  }, {
    id: "comp-2",
    compAddress: "125 Main St",
    salePrice: 225000,
    saleDate: "2024-02-10",
    squareFeet: 1780,
    bedrooms: 3,
    bathrooms: 2,
    yearBuilt: 1950,
    condition: "Average",
    zipCode: "45211",
    neighborhood: "Northside",
    propertyType: "Single Family",
    distanceMiles: 1.4,
    included: true,
  }, {
    id: "comp-3",
    compAddress: "126 Main St",
    salePrice: 240000,
    saleDate: "2023-10-12",
    squareFeet: 1900,
    bedrooms: 4,
    bathrooms: 3,
    yearBuilt: 1975,
    condition: "Good",
    zipCode: "45211",
    neighborhood: "Northside",
    propertyType: "Single Family",
    distanceMiles: 3.5,
    included: true,
  }], [{ neighborhoodName: "Northside", city: "Cincinnati", zipCode: "45211", rentalDemandScore: 78, appreciation1Year: 4.5, crimeRating: "Low", averageDaysOnMarket: 22 }]);

  assert.ok(result.arvAnalysis.recommendedArv > 0);
  assert.ok(["HIGH", "MODERATE", "LOW", "INSUFFICIENT DATA"].includes(result.arvAnalysis.confidenceLabel));
  assert.ok(result.rehabBudgetAnalysis.totalPlannedRehab > 0);
  assert.ok(result.flipAnalysis.totalProjectCost > 0);
  assert.ok(result.brrrrAnalysis.totalProjectCost > 0);
  assert.ok(result.mao.maximumOffer > 0);
  assert.ok(result.stressTests.baseCase.recommendedAction || result.stressTests.conservativeCase.recommendedAction);
  assert.equal(result.compReviewSummary.includedCount, 3);
});

test("buildUnderwritingMetrics centralizes purchase, rehab, ARV, holding, closing, financing, profit, ROI, and cash required calculations", () => {
  const metrics = buildUnderwritingMetrics({
    purchasePrice: 150000,
    rehabBudget: 40000,
    estimatedArv: 260000,
    holdingCosts: 3000,
    closingCosts: 6000,
    financingCosts: 5000,
    taxes: 2000,
    insurance: 1000,
    sellingCosts: 20800,
  }, { loanAmount: 0 });

  assert.equal(metrics.purchasePrice, 150000);
  assert.equal(metrics.rehabCost, 40000);
  assert.equal(metrics.arv, 260000);
  assert.equal(metrics.holdingCost, 3000);
  assert.equal(metrics.closingCosts, 6000);
  assert.equal(metrics.financingCosts, 5000);
  assert.equal(metrics.totalProjectCost, 208000);
  assert.equal(metrics.profit, 31200);
  assert.equal(metrics.roi, 31200 / 208000);
  assert.equal(metrics.cashRequired, 208000);
});

test("buildSharedUnderwritingSnapshot returns one reusable underwriting context for consumers", () => {
  const deal = {
    propertyAddress: "500 Market St",
    city: "Covington",
    state: "KY",
    zipCode: "41011",
    purchasePrice: 150000,
    rehabBudget: 40000,
    estimatedArv: 260000,
    estimatedRent: 2600,
    financingCosts: 5000,
    closingCosts: 6000,
    taxes: 2000,
    insurance: 1200,
    strategy: "Flip",
  };

  const snapshot = buildSharedUnderwritingSnapshot(deal, [], []);
  const underwriting = buildUnifiedUnderwritingIntelligence(deal, [], []);

  assert.equal(snapshot.metrics.totalProjectCost, underwriting.flipAnalysis.totalProjectCost);
  assert.equal(snapshot.metrics.profit, underwriting.flipAnalysis.netProfit);
  assert.equal(snapshot.summary.totalProjectCost, underwriting.flipAnalysis.totalProjectCost);
  assert.equal(snapshot.summary.profit, underwriting.flipAnalysis.netProfit);
});

test("shared underwriting helpers return consistent MAO, strategy, score, and risk outputs", () => {
  const deal = {
    propertyAddress: "500 Market St",
    city: "Covington",
    state: "KY",
    zipCode: "41011",
    propertyType: "Single Family",
    squareFeet: 1600,
    yearBuilt: 1960,
    purchasePrice: 150000,
    rehabBudget: 40000,
    estimatedArv: 260000,
    estimatedRent: 2600,
    financingCosts: 5000,
    closingCosts: 6000,
    taxes: 2000,
    insurance: 1200,
    strategy: "Flip",
  };

  const offer = buildOfferIntelligence(deal, { supportedBaseArv: 260000, confidenceLevel: "Moderate" }, { decision: "Pass" }, { loanAmount: 0, lenderMaxLtv: 0.75 });
  const buyBox = buildBuyBoxIntelligence(deal, [{ neighborhoodName: "Downtown", city: "Covington", zipCode: "41011", rentalDemandScore: 74, appreciation1Year: 4.2, crimeRating: "Low", averageDaysOnMarket: 24 }]);
  const strategies = buildStrategyComparisonEngine(deal, { supportedBaseArv: 260000, confidenceLevel: "Moderate" });
  const score = buildDealScore(deal, { supportedBaseArv: 260000, buyBoxResult: "PASS", confidenceLevel: "Moderate" }, { financingScore: 70 });
  const risk = buildRiskScore(deal, { supportedBaseArv: 260000, buyBoxResult: "PASS" });
  const rehabConfidence = buildRehabConfidence(deal);
  const arvConfidence = buildArvConfidence(deal, [{ salePrice: 220000, saleDate: "2024-01-15", squareFeet: 1600, bedrooms: 3, bathrooms: 2, distanceMiles: 2, included: true }]);
  const scenarios = buildStressScenarios(deal, { supportedBaseArv: 260000, confidenceLevel: "Moderate" });
  const triggers = buildReunderwritingTriggers(deal, { purchasePrice: 150000, rehabBudget: 40000, estimatedArv: 260000, timelineDays: 90 });
  const decision = buildInvestmentDecisionEngine(deal, { dealScore: score, overallRisk: risk.score, buyBoxResult: "PASS", arvConfidence: "High", estimatedFlipProfit: 30000, roi: 0.12, monthlyCashFlow: 900, cashRequired: 180000, qualificationStatus: "Qualified", warnings: [] });
  const exitEngine = buildExitStrategyEngine(deal, { supportedBaseArv: 260000, confidenceLevel: "Moderate", estimatedFlipProfit: 30000, monthlyCashFlow: 900, cashRequired: 180000, roi: 0.12 });
  const riskProfile = buildDealRiskProfile(deal, { overallRisk: risk.score, rehabRisk: 35, marketRisk: 25, financingRisk: 20, appraisalRisk: 18, contractorRisk: 28, liquidityRisk: 22, timelineRisk: 30 });

  assert.ok(["Profit Target", "Cash Left", "Lender Cap", "Conservative"].includes(offer.constraintLabel));
  assert.equal(buyBox.result, "PASS");
  assert.equal(strategies.recommendedStrategy, "Flip");
  assert.ok(score >= 0 && score <= 100);
  assert.ok(["LOW", "MODERATE", "HIGH", "CRITICAL"].includes(risk.level));
  assert.ok(["HIGH", "MEDIUM", "LOW", "INSUFFICIENT DATA"].includes(rehabConfidence.level));
  assert.ok(["HIGH", "MEDIUM", "LOW", "INSUFFICIENT DATA"].includes(arvConfidence.level));
  assert.ok(scenarios.baseCase && scenarios.downsideCombined);
  assert.ok(triggers.length >= 1);
  assert.ok(["Strong Buy", "Buy", "Buy With Conditions", "Hold", "Renegotiate", "Pass"].includes(decision.recommendation));
  assert.ok(exitEngine.recommendedStrategy);
  assert.ok(riskProfile.overallRiskScore >= 0);
  assert.ok(riskProfile.recommendedNextActions.length >= 1);
});
