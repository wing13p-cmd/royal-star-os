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

test("executive dashboard consumes canonical MAO, grade, lifecycle, and missing-data truth", () => {
  const analysis = {
    dealScore: 69,
    offerTruth: { maximumAllowableOffer: 156200, targetOffer: 148390, openingOffer: 140971, walkAwayPrice: 156200 },
    controllingRecommendation: { context: "OWNED_PROJECT", controllingDecision: "CONTINUE REHAB WITH CONTROLS", acquisitionDecision: "PAUSE FOR DATA" },
    requiredDataTruth: { missingDataCount: 1 },
    strategyMetrics: { monthlyCashFlow: null, dscr: null },
    roiTruth: { roiOnTotalProjectCost: 0.253 },
    warnings: ["No comps", "Unsupported ARV"],
    criticalRiskCount: 1,
    recommendationStrategy: "Flip",
  };
  const result = buildExecutiveDecisionDashboard(analysis, { purchasePrice: 135000, status: "Active Rehab" }, {}, {}, [analysis], []);
  assert.equal(result.header.scoreGrade, "C");
  assert.equal(result.header.overallRecommendation, "CONTINUE REHAB WITH CONTROLS");
  assert.equal(result.header.decisionContext, "OWNED_PROJECT");
  assert.equal(result.offerDecision.maximumAllowableOffer, "$156,200");
  assert.equal(result.primaryCards.find((card) => card.label === "Missing Data Count").value, 1);
  assert.equal(result.primaryCards.find((card) => card.label === "DSCR").value, "N/A — FLIP STRATEGY");
  assert.equal(result.offerDecision.context, "HISTORICAL_ACQUISITION_REFERENCE");
  assert.equal(result.offerDecision.controlling, false);
  assert.match(result.offerDecision.offerStatus, /Reference Only/);
});

test("Score 69 has Grade C in executive header and deal ranking", () => {
  const analysis = { dealScore: 69, grade: "D", recommendationStrategy: "Flip" };
  const result = buildExecutiveDecisionDashboard(
    analysis,
    { id: "deal-123", address: "123 tset st", purchasePrice: 135000 },
    {},
    {},
    [analysis],
    [{ id: "deal-123", address: "123 tset st" }],
  );
  assert.equal(result.header.overallDealScore, 69);
  assert.equal(result.header.scoreGrade, "C");
  assert.equal(result.ranking[0].score, 69);
  assert.equal(result.ranking[0].grade, "C");
});

test("executive dashboard labels Flip rental analysis non-controlling and does not invent omitted scenarios", () => {
  const analysis = {
    dealScore: 69, recommendationStrategy: "Flip", strategyMetrics: { monthlyCashFlow: null, dscr: null },
    rentalTruth: { applicableToPrimaryStrategy: false },
    financingTruth: { currentFinancingStatus: "ACTIVE / ENTERED", lenderRecordStatus: "NOT LINKED", qualificationStatus: "NOT EVALUATED — NO LENDER LINKED" },
  };
  const result = buildExecutiveDecisionDashboard(analysis, { strategy: "Flip", purchasePrice: 135000 }, {
    scenarios: [{ scenarioName: "Expected Case", summary: { profit: 53000, roi: 0.265, monthlyCashFlow: null, dscr: null } }],
  }, {}, [analysis], []);
  const rental = result.decisionMatrix.find((entry) => entry.category === "Rental");
  assert.match(rental.status, /Not Controlling/i);
  assert.equal(result.scenarioSummary.length, 1);
  assert.equal(result.scenarioSummary[0].monthlyCashFlow, "N/A");
  assert.equal(result.scenarioSummary[0].dscr, "N/A — FLIP STRATEGY");
});

test("active financing without a linked lender is documentation work, not no-lender-approval", () => {
  const analysis = { dealScore: 69, recommendationStrategy: "Flip", arvConfidence: "Low", rehabBudget: 60000, warnings: ["No comps"], financingWarnings: ["LTC Exceeded"], financingWarningDetails: [{ message: "LTC Exceeded", source: "ROYAL_STAR_INTERNAL" }], financingTruth: { currentFinancingStatus: "ACTIVE / ENTERED", lenderRecordStatus: "NOT LINKED", qualificationStatus: "NOT EVALUATED — NO LENDER LINKED" }, qualificationStatus: "NOT EVALUATED — NO LENDER LINKED" };
  const result = buildExecutiveDecisionDashboard(analysis, { status: "Active Rehab", strategy: "Flip", purchasePrice: 135000 }, {}, {}, [analysis], []);
  assert.equal(result.decisionBlockingItems.some((item) => item.item === "No lender approval"), false);
  assert.equal(result.decisionBlockingItems.some((item) => item.item === "Lender record not linked"), true);
  assert.ok(result.topRisks.some((risk) => /loan-to-cost/i.test(risk)));
  assert.ok(result.neededToImproveDecision.some((action) => /internal financing thresholds/i.test(action)));
  assert.ok(result.neededToImproveDecision.some((action) => /rehab scope/i.test(action)));
});

test("prospective acquisition retains active offer-decision context", () => {
  const result = buildExecutiveDecisionDashboard({ dealScore: 70, offerTruth: { maximumAllowableOffer: 143000, targetOffer: 138000, walkAwayPrice: 143000 }, recommendationStrategy: "Flip" }, { status: "Lead", strategy: "Flip", purchasePrice: 135000 }, {}, {}, [], []);
  assert.equal(result.offerDecision.context, "ACTIVE_ACQUISITION");
  assert.equal(result.offerDecision.controlling, true);
  assert.doesNotMatch(result.offerDecision.offerStatus, /Reference Only/);
});
