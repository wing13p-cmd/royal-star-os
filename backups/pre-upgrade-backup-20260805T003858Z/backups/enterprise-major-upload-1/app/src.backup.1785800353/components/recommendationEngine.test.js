import test from "node:test";
import assert from "node:assert/strict";
import { buildRecommendationEngine } from "./recommendationEngine.js";
import { buildSharedUnderwritingSnapshot } from "./intelligenceUpgradeEngine.js";

test("buildRecommendationEngine returns a strong buy recommendation when the deal is strong", () => {
  const deal = {
    purchasePrice: 120000,
    rehabBudget: 30000,
    closingCosts: 8000,
    financingCosts: 3000,
    taxes: 2000,
    insurance: 1000,
    estimatedArv: 220000,
    estimatedRent: 3500,
    propertyAddress: "123 Main St",
    cashOnHand: 50000,
  };

  const analysis = {
    dealScore: 86,
    buyBoxResult: "PASS",
    arvConfidence: "High",
    supportedBaseArv: 0,
    marketScore: 82,
    valuationScore: 78,
    rehabScore: 70,
    financingScore: 82,
    financingWarnings: [],
    warnings: [],
    estimatedFlipProfit: 50000,
    roi: 0.2,
    rentToCostRatio: 0.015,
    dscr: 1.4,
    loanAmount: 120000,
    cashRequired: 20000,
    monthlyCashFlow: 1000,
    capRate: 0.08,
    overallRisk: 18,
    qualificationStatus: "Qualified",
    selectedLenderName: "Northstar Capital",
    recommendedExit: "Flip",
  };

  const result = buildRecommendationEngine(deal, analysis);

  assert.equal(result.primaryRecommendation, "Strong Buy");
  assert.equal(result.strategyRecommendation, "Flip");
  assert.equal(result.requiredNextActions.includes("Order appraisal"), true);
  assert.equal(result.executiveSummary.recommendedOffer, "Insufficient Data");
});

test("buildRecommendationEngine uses the shared underwriting snapshot when present", () => {
  const deal = {
    purchasePrice: 80000,
    rehabBudget: 20000,
    closingCosts: 6000,
    financingCosts: 2500,
    taxes: 1800,
    insurance: 900,
    estimatedArv: 220000,
    estimatedRent: 3600,
    propertyAddress: "200 Oak St",
    cashOnHand: 50000,
  };

  const snapshot = buildSharedUnderwritingSnapshot(deal, [], []);
  const result = buildRecommendationEngine(deal, {
    ...snapshot.summary,
    dealScore: 82,
    buyBoxResult: "PASS",
    arvConfidence: "High",
    supportedBaseArv: 220000,
    marketScore: 78,
    valuationScore: 76,
    rehabScore: 74,
    financingScore: 84,
    financingWarnings: [],
    warnings: [],
    estimatedFlipProfit: snapshot.summary.profit,
    roi: snapshot.summary.roi,
    rentToCostRatio: 0.015,
    dscr: 1.4,
    loanAmount: 90000,
    cashRequired: snapshot.summary.cashRequired,
    monthlyCashFlow: 700,
    capRate: 0.08,
    overallRisk: 20,
    qualificationStatus: "Qualified",
    selectedLenderName: "Northstar Capital",
    recommendedExit: "Flip",
  });

  assert.equal(result.primaryRecommendation, "Strong Buy");
  assert.equal(result.executiveSummary.maximumAllowableOffer, snapshot.summary.recommendedOffer);
});
