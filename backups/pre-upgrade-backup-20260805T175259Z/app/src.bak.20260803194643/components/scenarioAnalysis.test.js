import test from "node:test";
import assert from "node:assert/strict";
import { buildScenarioAnalysis, safeDisplay } from "./scenarioAnalysis.js";
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
});
