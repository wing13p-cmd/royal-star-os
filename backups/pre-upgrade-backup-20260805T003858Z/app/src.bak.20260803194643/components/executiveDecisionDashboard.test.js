import test from "node:test";
import assert from "node:assert/strict";
import { buildExecutiveDecisionDashboard } from "./executiveDecisionDashboard.js";

test("buildExecutiveDecisionDashboard returns safe defaults for empty input", () => {
  const result = buildExecutiveDecisionDashboard(null, null, null, null, [], []);
  assert.ok(result);
  assert.equal(result.decisionStatus, "INSUFFICIENT DATA");
  assert.equal(result.header.overallRecommendation, "Insufficient Data");
  assert.deepEqual(result.primaryCards, []);
});

test("buildExecutiveDecisionDashboard produces a ranked and comparable executive view for a saved deal", () => {
  const result = buildExecutiveDecisionDashboard(
    {
      purchasePrice: 180000,
      dealScore: 72,
      estimatedFlipProfit: 22000,
      roi: 0.08,
      monthlyCashFlow: 300,
      cashRequired: 60000,
      dscr: 1.1,
      arvConfidence: "Moderate",
      marketScore: 68,
      buyBoxResult: "PASS",
      qualificationStatus: "Qualified",
      recommendedExit: "Flip",
      recommendationDecision: "Conditional Buy",
      recommendationStrategy: "Hold",
      warnings: ["Weak comps"],
      financingWarnings: ["Elevated lender fees"],
      rehabBudget: 40000,
      cashLeftInDeal: 15000,
      riskScore: 34,
      recommendationConfidence: "Low",
    },
    {
      purchasePrice: 180000,
      address: "123 Test St",
      propertyAddress: "123 Test St",
      askingPrice: 180000,
      cashOnHand: 90000,
    },
    {
      summary: { scenarioSurvivalResult: "Marginal", failingScenarioCount: 2 },
      scenarios: [{ scenarioName: "Expected Case", summary: { profit: 22000, roi: 0.08, monthlyCashFlow: 300, dscr: 1.1, recommendation: "Conditional Buy", survival: "Marginal" } }],
    },
    {
      recommendationSurvivalResult: "Marginal",
      recommendationConfidence: "Low",
      strongestArgumentAgainstDeal: "Weak valuation support",
      mostFragileAssumption: "ARV support",
      decisionBreakingAssumption: "ARV must remain above $240,000",
      downsideRecommendation: "Hold",
      requiredCorrectiveActions: ["Order appraisal"],
    },
    [{ dealScore: 72, propertyAddress: "123 Test St", recommendationDecision: "Conditional Buy", recommendationStrategy: "Hold", riskScore: 34, estimatedFlipProfit: 22000, roi: 0.08, cashRequired: 60000, scenarioSurvivalResult: "Marginal", redTeamConfidence: "Low", buyBoxResult: "PASS" }],
    [{ id: "deal-1", propertyAddress: "123 Test St" }],
  );

  assert.equal(result.decisionStatus, "READY WITH CONDITIONS");
  assert.equal(result.offerDecision.offerStatus, "Below Recommended Offer");
  assert.equal(result.strategyDecision.primaryStrategy, "Hold");
  assert.ok(result.topStrengths.length >= 1);
  assert.ok(result.topRisks.length >= 1);
  assert.ok(result.decisionMatrix.some((entry) => entry.category === "Valuation"));
  assert.ok(result.ranking.length >= 1);
});
