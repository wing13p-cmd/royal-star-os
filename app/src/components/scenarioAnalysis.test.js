import test from "node:test";
import assert from "node:assert/strict";
import { buildScenarioAnalysis, calculateScenario, safeDisplay, scenarioPercentFromInput, scenarioPercentToInput } from "./scenarioAnalysis.js";
import { buildUnifiedUnderwritingIntelligence } from "./intelligenceUpgradeEngine.js";

test("buildScenarioAnalysis returns safe defaults for incomplete deals", () => {
  const result = buildScenarioAnalysis(null, null, {});

  assert.ok(result);
  assert.deepEqual(result.scenarios, []);
  assert.equal(result.summary.baseRecommendation, "Insufficient Data");
  assert.equal(result.summary.worstCaseRecommendation, "Insufficient Data");
  assert.equal(result.summary.failingScenarioCount, 0);
});

test("safeDisplay falls back for object values so the UI never renders raw objects", () => {
  assert.equal(safeDisplay({ primaryRecommendation: "Buy" }, "Insufficient Data"), "Insufficient Data");
  assert.equal(safeDisplay("Strong Buy", "Insufficient Data"), "Strong Buy");
});

test("buildScenarioAnalysis derives scenario results from the shared underwriting engine", () => {
  const deal = {
    purchasePrice: 120000,
    rehabBudget: 25000,
    closingCosts: 6000,
    financingCosts: 4000,
    taxes: 1800,
    insurance: 1200,
    estimatedArv: 200000,
    estimatedRent: 2200,
    holdingMonths: 6,
    strategy: "Flip",
  };

  const analysis = {
    buyBoxResult: "PASS",
    arvConfidence: "Moderate",
    marketScore: 80,
    valuationScore: 80,
    rehabScore: 80,
    recommendedExit: "Flip",
  };

  const underwriting = buildUnifiedUnderwritingIntelligence(deal, [], []);
  const result = buildScenarioAnalysis(deal, analysis, { interestRate: 0.08, DSCRMinimum: 1.2 });

  assert.equal(result.baseScenario.results.totalProjectCost, underwriting.flipAnalysis.totalProjectCost);
  assert.equal(result.baseScenario.results.profit, underwriting.flipAnalysis.netProfit);
  assert.equal(result.baseScenario.results.monthlyCashFlow, null);
  assert.equal(result.baseScenario.results.dscr, null);
  assert.equal(result.baseScenario.summary.formatted.monthlyCashFlow, "N/A — FLIP STRATEGY");
  assert.equal(result.baseScenario.results.warnings.includes("DSCR below 1.00"), false);
});

test("BRRRR scenarios preserve rental cash flow and DSCR evaluation", () => {
  const result = buildScenarioAnalysis({
    purchasePrice: 135000, rehabBudget: 60000, estimatedArv: 275000, estimatedRent: 1800,
    actualLoanAmount: 182330, annualInterestRate: 11.24, paymentType: "Interest Only",
    annualPropertyTaxes: 3000, annualInsurance: 1800, holdingMonths: 3, holdingCosts: 6000,
    strategy: "BRRRR",
  }, { buyBoxResult: "PASS", arvConfidence: "Moderate" }, {});
  assert.equal(typeof result.baseScenario.results.monthlyCashFlow, "number");
  assert.equal(typeof result.baseScenario.results.dscr, "number");
});

test("scenario timeline explicitly reports months and converts day overrides once", () => {
  const result = buildScenarioAnalysis({ purchasePrice: 100000, rehabBudget: 20000, estimatedArv: 180000, holdingMonths: 6, strategy: "Flip" }, {}, {});
  assert.equal(result.baseScenario.assumptions.scenarioHoldingPeriodUnit, "MONTHS");
  assert.equal(result.baseScenario.assumptions.timelineDays, 180);
  const delayed = result.scenarios.find((scenario) => scenario.scenarioName === "Delayed Exit");
  assert.ok(delayed.summary.scenarioHoldingPeriod > 6);
});

test("scenario interest-rate changes preserve percent-point representation", () => {
  const result = buildScenarioAnalysis({ purchasePrice: 135000, rehabBudget: 60000, estimatedArv: 285000, annualInterestRate: 11.24, actualLoanAmount: 182330, holdingMonths: 3, strategy: "Flip" }, {}, {});
  assert.equal(result.baseScenario.summary.scenarioInterestRate, 11.24);
  assert.equal(result.baseScenario.summary.formatted.interestRate, "11.24%");
  assert.equal(result.scenarios.find((entry) => entry.scenarioName === "Moderate Downside").summary.scenarioInterestRate, 11.25);
  assert.equal(result.scenarios.find((entry) => entry.scenarioName === "Severe Downside").summary.scenarioInterestRate, 11.26);
});

test("scenario profit orders best through severe downside and delay adds carrying cost", () => {
  const result = buildScenarioAnalysis({ purchasePrice: 135000, rehabBudget: 60000, closingCosts: 5000, financingCosts: 5000, holdingCosts: 6000, estimatedArv: 285000, annualInterestRate: 11.24, actualLoanAmount: 182330, holdingMonths: 3, strategy: "Flip" }, {}, {});
  const byName = Object.fromEntries(result.scenarios.map((entry) => [entry.scenarioName, entry]));
  assert.ok(byName["Best Case"].summary.profit >= byName["Expected Case"].summary.profit);
  assert.ok(byName["Expected Case"].summary.profit >= byName["Moderate Downside"].summary.profit);
  assert.ok(byName["Moderate Downside"].summary.profit >= byName["Severe Downside"].summary.profit);
  assert.ok(byName["Delayed Exit"].summary.totalProjectCost > byName["Expected Case"].summary.totalProjectCost);
});

test("persisted base profit cannot override stressed scenario economics", () => {
  const result = buildScenarioAnalysis({ purchasePrice: 135000, rehabBudget: 60000, closingCosts: 5000, financingCosts: 5000, sellingCosts: 22000, holdingCosts: 6000, estimatedArv: 285000, actualLoanAmount: 182330, annualInterestRate: 11.24, holdingMonths: 3, strategy: "Flip", projectedProfit: 53000 }, {}, {});
  const profits = Object.fromEntries(result.scenarios.map((entry) => [entry.scenarioName, entry.summary.profit]));
  assert.equal(profits["Expected Case"], 53000);
  assert.ok(profits["Best Case"] > profits["Expected Case"]);
  assert.ok(profits["Expected Case"] > profits["Moderate Downside"]);
  assert.ok(profits["Moderate Downside"] > profits["Severe Downside"]);
  assert.ok(profits["Delayed Exit"] < profits["Expected Case"]);
  assert.equal(result.scenarios.some((entry) => entry.scenarioName === "Rental Stress"), false);
  assert.equal(result.scenarios.some((entry) => entry.scenarioName === "Refinance Stress"), false);
});

test("selling, financing, and holding stresses change scenario profit independently", () => {
  const deal = { purchasePrice: 135000, rehabBudget: 60000, closingCosts: 5000, financingCosts: 5000, sellingCosts: 22000, holdingCosts: 6000, estimatedArv: 285000, actualLoanAmount: 182330, annualInterestRate: 11.24, holdingMonths: 3, strategy: "Flip", projectedProfit: 53000 };
  const base = calculateScenario(deal, {}, {}, {});
  const selling = calculateScenario(deal, {}, {}, { sellingCostPct: 0.01 });
  const financing = calculateScenario(deal, {}, {}, { financingCostPct: 0.1 });
  const holding = calculateScenario(deal, {}, {}, { holdingCostPct: 0.1 });
  assert.ok(selling.summary.profit < base.summary.profit);
  assert.ok(financing.summary.profit < base.summary.profit);
  assert.ok(holding.summary.profit < base.summary.profit);
});

test("Flip scenario recommendations follow scenario economics and DSCR remains strategy-gated", () => {
  const result = buildScenarioAnalysis({ purchasePrice: 135000, rehabBudget: 60000, closingCosts: 5000, financingCosts: 5000, sellingCosts: 22000, holdingCosts: 6000, estimatedArv: 285000, actualLoanAmount: 182330, annualInterestRate: 11.24, holdingMonths: 3, strategy: "Flip", projectedProfit: 53000 }, {}, {});
  const scenarios = Object.fromEntries(result.scenarios.map((entry) => [entry.scenarioName, entry.summary]));
  assert.equal(scenarios["Best Case"].recommendation, "Continue Project");
  assert.equal(scenarios["Expected Case"].recommendation, "Continue Project");
  assert.notEqual(scenarios["Moderate Downside"].recommendation, "Hold");
  assert.match(scenarios["Severe Downside"].recommendation, /Hold|Re-underwrite/);
  assert.equal(scenarios["Delayed Exit"].recommendation, "Continue With Controls");
  Object.values(scenarios).forEach((scenario) => assert.equal(scenario.formatted.dscr, "N/A — FLIP STRATEGY"));
});

test("custom scenario percentage UI converts percent values only at the boundary", () => {
  assert.equal(scenarioPercentToInput(0.05), 5);
  assert.equal(scenarioPercentFromInput(5), 0.05);
  assert.equal(scenarioPercentToInput(-0.05), -5);
});
