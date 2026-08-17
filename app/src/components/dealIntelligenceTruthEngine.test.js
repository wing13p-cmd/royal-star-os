import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  buildArvTruthSnapshot, buildFinancingTruthSnapshot, gateStrategyMetrics, buildLiquidityTruthSnapshot,
  reconcileDealRecommendation, buildOfferTruthSnapshot, buildRehabTruthScore, buildRentalTruthScore,
  reconcileBuyBoxScoring, normalizeEffectLabel, normalizeScenarioTimeline,
  normalizeInterestRatePercent, formatInterestRatePercent, buildLeverageTruthSnapshot,
  buildRoiTruthSnapshot, gradeForScore, withOverallDealGrade, buildRequiredDataTruth, deduplicateWarnings,
  normalizeWarningRecords,
  formatQualificationFailures,
} from "./dealIntelligenceTruthEngine.js";

test("lender failed requirements distinguish not evaluated from evaluated pass", () => {
  assert.equal(formatQualificationFailures("NOT EVALUATED — NO LENDER LINKED", []), "NOT EVALUATED");
  assert.equal(formatQualificationFailures("Qualified", []), "None");
  assert.equal(formatQualificationFailures("Conditional", ["Maximum LTC exceeded"]), "Maximum LTC exceeded");
});

test("entered ARV is projected but not supported without appraisal evidence", () => {
  const result = buildArvTruthSnapshot({ estimatedArv: 285000 }, { evidenceStatus: "NO_COMPS_AVAILABLE", supportedArv: null });
  assert.equal(result.projectedArv, 285000);
  assert.equal(result.supportedArv, null);
  assert.equal(result.source, "NOT_ESTABLISHED");
});

test("Deal Intelligence presentation keeps owned offers historical, percent inputs explicit, and scenario table scrollable", () => {
  const source = readFileSync(new URL("./DealIntelligence.jsx", import.meta.url), "utf8");
  assert.match(source, /Historical Acquisition Underwriting — Reference Only/);
  assert.match(source, /scenarioPercentToInput/);
  assert.match(source, /scenarioPercentFromInput/);
  assert.match(source, /overflowX: "auto"/);
  assert.match(source, /width: "max-content"/);
  assert.match(source, /formatQualificationFailures/);
});

test("strong or governed appraisal evidence establishes supported ARV", () => {
  const appraisal = buildArvTruthSnapshot({ estimatedArv: 285000 }, { appraisalStatus: "READY", evidenceStatus: "COMP_EVIDENCE_AVAILABLE", supportedArv: 283125, appraisalConfidence: "HIGH" });
  assert.equal(appraisal.supportedArv, 283125);
  const governed = buildArvTruthSnapshot({ estimatedArv: 285000 }, appraisal, { approvedArv: 282000 });
  assert.equal(governed.supportedArv, 282000);
});

test("projected and preliminary calculated ARV never become supported valuation", () => {
  const result = buildArvTruthSnapshot(
    { estimatedArv: 285000, supportedARV: 285000 },
    { appraisalStatus: "NOT_READY", evidenceStatus: "COMP_EVIDENCE_AVAILABLE", supportedArv: null, appraisalConfidence: "LOW" },
    { calculatedArv: 280000, supportedArv: 280000, valuationReviewStatus: "PRELIMINARY" },
  );
  assert.equal(result.projectedArv, 285000);
  assert.equal(result.calculatedArv, 280000);
  assert.equal(result.supportedArv, null);
  assert.equal(result.supported, false);
});

test("Deal Intelligence does not fall back from supported ARV to calculated or projected values", () => {
  const source = readFileSync(new URL("./DealIntelligence.jsx", import.meta.url), "utf8");
  assert.doesNotMatch(source, /supportedBaseArv:\s*safeNumber\(topDeal\.supportedBaseArv/);
  assert.doesNotMatch(source, /supportedArv:\s*safeNumber\(topDeal\.supportedBaseArv/);
  assert.match(source, /valuationReviewStatus:\s*"PRELIMINARY"/);
});

test("saved financing survives without lender while unknown rate is not zero", () => {
  const saved = buildFinancingTruthSnapshot({ actualLoanAmount: 182330, annualInterestRate: 11.24, holdingMonths: 3 }, {}, null);
  assert.equal(saved.actualLoanAmount, 182330);
  assert.equal(saved.interestRate, 11.24);
  assert.ok(saved.interestCarry > 0);
  assert.match(saved.qualificationStatus, /NOT EVALUATED/);
  const unknown = buildFinancingTruthSnapshot({ actualLoanAmount: 182330 }, {}, null);
  assert.equal(unknown.interestRate, null);
  assert.equal(unknown.interestCarry, null);
});

test("Flip gates rental cash flow and DSCR while BRRRR preserves them", () => {
  const flip = gateStrategyMetrics({ strategy: "Flip" }, { monthlyCashFlow: -13306, dscr: 0.12 });
  assert.equal(flip.monthlyCashFlow, null);
  assert.equal(flip.dscr, null);
  assert.equal(flip.decisionCritical, false);
  const brrrr = gateStrategyMetrics({ strategy: "BRRRR" }, { monthlyCashFlow: -386, dscr: 0.719 });
  assert.equal(brrrr.monthlyCashFlow, -386);
  assert.equal(brrrr.dscr, 0.719);
  assert.equal(brrrr.decisionCritical, true);
});

test("missing liquidity is unknown rather than a zero-dollar gap conclusion", () => {
  const unknown = buildLiquidityTruthSnapshot({ cashToClose: 26857.9 });
  assert.equal(unknown.availableLiquidity, null);
  assert.equal(unknown.liquidityGap, null);
  assert.equal(unknown.status, "UNKNOWN");
  const zero = buildLiquidityTruthSnapshot({ cashToClose: 1000, availableLiquidity: 0 });
  assert.equal(zero.status, "GAP");
  assert.equal(zero.liquidityGap, 1000);
});

test("owned project recommendation is distinct from acquisition decision", () => {
  const result = reconcileDealRecommendation({ deal: { status: "Active Rehab" }, acquisitionDecision: "REJECT", projectDecision: "CONTINUE REHAB WITH CONTROLS", appraisalStatus: "NOT_READY" });
  assert.equal(result.context, "OWNED_PROJECT");
  assert.equal(result.controllingDecision, "CONTINUE REHAB WITH CONTROLS");
  assert.equal(result.acquisitionDecision, "REJECT");
});

test("offer truth labels authoritative, downside, and scenario MAO separately", () => {
  const result = buildOfferTruthSnapshot({ maximumOffer: 176988, targetOffer: 148390, initialOffer: 135000, walkAwayPrice: 159289, sensitivity: { worst: { maximumAllowableOffer: 156200 } } }, { mao: 150000 });
  assert.equal(result.maximumAllowableOffer, 176988);
  assert.equal(result.downsideMaximumAllowableOffer, 156200);
  assert.equal(result.scenarioMaximumAllowableOffer, 150000);
  assert.equal(result.provenance.maximumAllowableOffer, "AUTHORITATIVE_OFFER_ENGINE_BASE_CASE");
});

test("rehab attractiveness is separate from incomplete execution evidence", () => {
  const result = buildRehabTruthScore({ rehabBudget: 60000 });
  assert.equal(result.budgetAttractiveness, 100);
  assert.equal(result.dataCompletenessScore, 0);
  assert.equal(result.executionRisk, "HIGH");
});

test("rental score cannot be 100 without verified rental evidence", () => {
  const result = buildRentalTruthScore({ strategy: "Flip", estimatedRent: 1800 }, {});
  assert.equal(result.applicable, false);
  assert.equal(result.score, null);
  assert.equal(result.grade, "INSUFFICIENT DATA");
});

test("Buy Box score arithmetic reconciles baseline and penalties", () => {
  const result = reconcileBuyBoxScoring({ score: 68, reviewRules: ["a"], failedRules: ["b"] });
  assert.equal(result.calculatedScore, 68);
  assert.deepEqual(result.contributions.map((entry) => entry.points), [-7, -25]);
  assert.equal(result.reconciled, true);
});

test("Red-Team effect labels are normalized once", () => {
  assert.equal(normalizeEffectLabel("Score effect: Materially reduced", "Score effect"), "Materially reduced");
  assert.equal(normalizeEffectLabel("High", "Risk effect"), "High");
});

test("scenario timeline units convert at explicit boundaries", () => {
  assert.deepEqual(normalizeScenarioTimeline({ holdingMonths: 6 }), { timelineDays: 180, timelineMonths: 6, sourceUnit: "MONTHS" });
  assert.deepEqual(normalizeScenarioTimeline({ timelineDays: 60 }), { timelineDays: 60, timelineMonths: 2, sourceUnit: "DAYS" });
});

test("interest rate uses canonical percent points and displays 11.24 percent", () => {
  assert.equal(normalizeInterestRatePercent(11.24), 11.24);
  assert.equal(normalizeInterestRatePercent(0.1124), 11.24);
  assert.equal(formatInterestRatePercent(11.24), "11.24%");
  assert.equal(formatInterestRatePercent(null), "Insufficient Data");
});

test("leverage uses explicit denominators and never substitutes purchase price for as-is value", () => {
  const missingValue = buildLeverageTruthSnapshot({ purchasePrice: 135000, rehabBudget: 60000, closingCosts: 5000, financingCosts: 5000, holdingCosts: 6000, estimatedArv: 285000, actualLoanAmount: 182330 });
  assert.equal(missingValue.ltc, 182330 / 211000);
  assert.equal(missingValue.ltv, null);
  assert.equal(missingValue.ltarv, 182330 / 285000);
  const knownValue = buildLeverageTruthSnapshot({ currentAsIsValue: 200000, estimatedArv: 285000, actualLoanAmount: 182330 });
  assert.equal(knownValue.ltv, 182330 / 200000);
});

test("ROI definitions use their named denominators", () => {
  const result = buildRoiTruthSnapshot({ profit: 53000, totalProjectCost: 209000, cashInvested: 30000 });
  assert.equal(result.roiOnTotalProjectCost, 53000 / 209000);
  assert.equal(result.roiOnCashInvested, 53000 / 30000);
});

test("canonical grade maps 69 consistently to C", () => {
  assert.equal(gradeForScore(69), "C");
  assert.equal(gradeForScore(null), "INSUFFICIENT DATA");
});

test("overall-deal grade boundaries follow the authoritative policy", () => {
  const cases = [
    [39, "F"], [40, "D"], [41, "D"],
    [54, "D"], [55, "C"], [56, "C"],
    [69, "C"], [70, "B"], [71, "B"],
    [84, "B"], [85, "A"], [86, "A"],
  ];
  for (const [score, expected] of cases) assert.equal(gradeForScore(score), expected, `score ${score}`);
});

test("authoritative score replaces stale overall grade at presentation time", () => {
  const result = withOverallDealGrade({ dealScore: 48, grade: "D", propertyAddress: "123 tset st" }, 69);
  assert.equal(result.dealScore, 69);
  assert.equal(result.grade, "C");
  assert.equal(result.propertyAddress, "123 tset st");
});

test("Deal Intelligence ranking and card consume the same finalized overall grade", () => {
  const source = readFileSync(new URL("./DealIntelligence.jsx", import.meta.url), "utf8");
  assert.match(source, /return withOverallDealGrade\(/);
  assert.match(source, /<td style=\{styles\.td\}>\{deal\.grade\}<\/td>/);
  assert.match(source, /<Metric label="Grade" value=\{deal\.grade\} \/>/);
});

test("required data count is lifecycle and strategy aware", () => {
  const flip = buildRequiredDataTruth({ strategy: "Flip", status: "Active Rehab", purchasePrice: 135000, rehabBudget: 60000, arv: 285000 }, { supportedArv: null }, { actualLoanAmount: 182330, interestRate: 11.24 });
  assert.deepEqual(flip.missingCriticalData, ["supportedArvEvidence"]);
  assert.equal(flip.missingDataCount, 1);
  assert.equal(flip.missingCriticalData.includes("monthlyRent"), false);
});

test("warnings are deduplicated by root issue", () => {
  const result = deduplicateWarnings("No comps", "Missing appraisal", "Unsupported ARV", "No lender linked", "Request lender approval");
  assert.deepEqual(result, [
    "Comparable-sale or appraisal evidence is missing; projected ARV is not independently supported.",
    "No lender record is linked; lender qualification has not been evaluated.",
  ]);
});

test("semantic no-comp variants preserve detail under one canonical warning key", () => {
  const result = normalizeWarningRecords(
    "No comps",
    "Insufficient comp support",
    { message: "No comps available; the target ARV has insufficient valuation evidence.", source: "APPRAISAL" },
  );
  assert.equal(result.length, 1);
  assert.equal(result[0].key, "APPRAISAL_EVIDENCE_MISSING");
  assert.equal(result[0].details.length, 3);
  assert.deepEqual(result[0].sources, ["APPRAISAL"]);
});
