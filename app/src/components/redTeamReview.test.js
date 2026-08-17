import test from "node:test";
import assert from "node:assert/strict";
import { buildRedTeamReview } from "./redTeamReview.js";

test("buildRedTeamReview returns safe defaults for null or empty inputs", () => {
  const result = buildRedTeamReview(null, null, null);

  assert.ok(result);
  assert.equal(result.recommendationSurvivalResult, "Insufficient Data");
  assert.equal(result.recommendationConfidence, "Insufficient Data");
  assert.equal(result.strongestArgumentAgainstDeal, "Insufficient Data");
  assert.deepEqual(result.requiredCorrectiveActions, []);
});

test("buildRedTeamReview flags a weak deal with negative cash flow and no comps", () => {
  const result = buildRedTeamReview(
    {
      purchasePrice: 250000,
      rehabBudget: 90000,
      estimatedArv: 300000,
      estimatedRent: 2200,
      vacancyRate: 0.02,
      taxes: 4000,
      insurance: 2500,
      financingCosts: 6000,
      closingCosts: 8000,
      cashOnHand: 50000,
      propertyType: "single family",
      city: "Cincinnati",
      state: "OH",
      zipCode: "45299",
      strategy: "flip",
    },
    {
      dealScore: 38,
      estimatedFlipProfit: -50000,
      roi: -0.1,
      dscr: 0.8,
      monthlyCashFlow: -1800,
      cashRequired: 120000,
      recommendations: { primaryRecommendation: "Reject" },
      financingWarnings: ["Critical financing risk"],
      warnings: ["No comps", "High vacancy"],
      supportedBaseArv: 0,
      buyBoxResult: "FAIL",
      arvConfidence: "Very Low",
      marketScore: 40,
      valuationScore: 20,
      recommendedExit: "Hold",
    },
    {
      summary: {
        baseRecommendation: "Reject",
        worstCaseRecommendation: "Reject",
        expectedRoi: -0.05,
        worstCaseRoi: -0.2,
        downsideCashRequired: 140000,
        downsideMonthlyCashFlow: -2200,
        scenarioSurvivalResult: "Fails",
        failingScenarioCount: 4,
      },
      scenarios: [{ scenarioName: "Moderate Downside", summary: { profit: -20000, roi: -0.08, monthlyCashFlow: -1200, dscr: 0.9 } }],
    },
  );

  assert.ok(result);
  assert.equal(result.recommendationSurvivalResult, "Fails");
  assert.equal(result.downsideRecommendation, "Reject");
  assert.equal(result.largestFinancialRisk, "Negative projected profit");
  assert.ok(result.requiredCorrectiveActions.includes("Order appraisal"));
});

test("buildRedTeamReview uses structured challenge sections and a decision-breaking threshold when data exists", () => {
  const result = buildRedTeamReview(
    {
      purchasePrice: 180000,
      rehabBudget: 30000,
      estimatedArv: 260000,
      estimatedRent: 2600,
      vacancyRate: 0.05,
      financingCosts: 5000,
      closingCosts: 4500,
      taxes: 3000,
      insurance: 1800,
      cashOnHand: 75000,
      propertyType: "single family",
      city: "Covington",
      state: "KY",
      zipCode: "41011",
      strategy: "flip",
    },
    {
      dealScore: 66,
      estimatedFlipProfit: 25000,
      roi: 0.07,
      dscr: 1.1,
      monthlyCashFlow: 200,
      cashRequired: 60000,
      financingWarnings: ["Elevated lender fees"],
      warnings: ["Weak comps"],
      supportedBaseArv: 240000,
      buyBoxResult: "PASS",
      arvConfidence: "Moderate",
      marketScore: 68,
      valuationScore: 55,
      recommendedExit: "Flip",
    },
    {
      summary: {
        baseRecommendation: "Conditional Buy",
        worstCaseRecommendation: "Hold",
        expectedRoi: 0.03,
        worstCaseRoi: 0.01,
        downsideCashRequired: 70000,
        downsideMonthlyCashFlow: -300,
        scenarioSurvivalResult: "Marginal",
        failingScenarioCount: 2,
      },
      scenarios: [{ scenarioName: "Moderate Downside", summary: { profit: 8000, roi: 0.04, monthlyCashFlow: 100, dscr: 1.0 } }],
    },
  );

  assert.equal(result.recommendationSurvivalResult, "Marginal");
  assert.equal(result.recommendationConfidence, "Low");
  assert.ok(result.challenges.some((entry) => entry.title === "Valuation Challenge"));
  assert.ok(result.decisionBreakingAssumption.includes("ARV"));
});

test("pure Flip red-team review excludes rental and DSCR from controlling challenges", () => {
  const result = buildRedTeamReview(
    { purchasePrice: 135000, rehabBudget: 60000, estimatedArv: 285000, strategy: "Flip" },
    {
      dealScore: 69, estimatedFlipProfit: 53000, roi: 0.265, dscr: 0.2, monthlyCashFlow: -900,
      warnings: ["Low DSCR", "No comps"], financingWarnings: ["Low DSCR", "LTC Exceeded"],
      financingWarningDetails: [{ message: "LTC Exceeded", source: "ROYAL_STAR_INTERNAL" }],
      financingTruth: { lenderRecordStatus: "NOT LINKED", currentFinancingStatus: "ACTIVE / ENTERED" },
      recommendedExit: "Flip", buyBoxResult: "PASS", arvConfidence: "Low",
    },
    { summary: { scenarioSurvivalResult: "Marginal", failingScenarioCount: 1 }, scenarios: [] },
  );
  assert.equal(result.challenges.some((entry) => entry.title === "Rental Challenge"), false);
  assert.equal(result.challenges.flatMap((entry) => entry.warnings || []).some((warning) => /dscr/i.test(warning)), false);
  assert.equal(result.requiredCorrectiveActions.some((action) => /rent|lender approval/i.test(action)), false);
});

test("BRRRR red-team review retains rental and DSCR control", () => {
  const result = buildRedTeamReview(
    { purchasePrice: 135000, rehabBudget: 60000, estimatedArv: 285000, estimatedRent: 900, strategy: "BRRRR" },
    { dealScore: 55, dscr: 0.7, monthlyCashFlow: -500, warnings: ["Low DSCR"], financingWarnings: ["Low DSCR"], recommendedExit: "BRRRR", buyBoxResult: "PASS", arvConfidence: "Moderate" },
    { summary: { scenarioSurvivalResult: "Fails", failingScenarioCount: 2 }, scenarios: [] },
  );
  assert.equal(result.challenges.some((entry) => entry.title === "Rental Challenge"), true);
  assert.equal(result.challenges.flatMap((entry) => entry.supportingWarnings || []).some((warning) => /dscr/i.test(warning)), true);
});

test("missing supported ARV is rendered as not established and produces known actions", () => {
  const result = buildRedTeamReview(
    { purchasePrice: 135000, rehabBudget: 60000, estimatedArv: 285000, strategy: "Flip" },
    { dealScore: 69, estimatedFlipProfit: 53000, roi: 0.265, supportedBaseArv: null, compCount: 0, financingWarnings: ["LTC Exceeded"], financingWarningDetails: [{ message: "LTC Exceeded", source: "ROYAL_STAR_INTERNAL" }], financingTruth: { currentFinancingStatus: "ACTIVE / ENTERED", lenderRecordStatus: "NOT LINKED" }, recommendedExit: "Flip", buyBoxResult: "PASS", arvConfidence: "Low" },
    { summary: { scenarioSurvivalResult: "Marginal" }, scenarios: [] },
  );
  const valuation = result.challenges.find((entry) => entry.title === "Valuation Challenge");
  const financing = result.challenges.find((entry) => entry.title === "Financing Challenge");
  const market = result.challenges.find((entry) => entry.title === "Market Challenge");
  assert.match(valuation.baseAssumption, /Supported ARV Not Established/);
  assert.equal(valuation.baseAssumption.includes("$0"), false);
  assert.ok(financing.requiredActions.some((action) => /internal financing thresholds/i.test(action)));
  assert.ok(market.requiredActions.some((action) => /appraisal/i.test(action)));
});
