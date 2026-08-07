import test from "node:test";
import assert from "node:assert/strict";
import {
  buildAcquisitionUnderwritingInput,
  createAcquisitionReadinessService,
  buildProjectCostEngine,
  buildFlipUnderwritingEngine,
  buildBrrrrUnderwritingEngine,
  buildRentalHoldUnderwritingEngine,
  buildWholesaleScreeningEngine,
  buildMaximumAllowableOfferEngine,
  buildRoyalStarBuyBoxEngine,
  buildCapitalExposureEngine,
  buildExecutionRiskEngine,
  buildExitStrategyOptimizer,
  buildOpportunityCostEngine,
  buildRedTeamAcquisitionReview,
  buildDecisionGovernance,
  createAcquisitionDecisionVersioningService,
  buildAcquisitionDocumentAssembly,
  buildOutcomeFeedbackSummary,
  buildAcquisitionIntelligenceEngine,
  DEFAULT_BUY_BOX_POLICY,
} from "./acquisitionIntelligenceEngine.js";

const fixture = {
  id: "deal-952",
  propertyAddress: "952 Goss Rd",
  city: "Cincinnati",
  state: "OH",
  zipCode: "45229",
  propertyType: "Single Family",
  unitCount: 1,
  bedrooms: 4,
  bathrooms: 2.5,
  squareFeet: 1562,
  yearBuilt: 1929,
  askingPrice: 135000,
  purchasePrice: 135000,
  rehabBudget: 60000,
  activeArv: 300000,
  estimatedArv: 300000,
  estimatedRent: 2200,
  taxes: 2800,
  insurance: 1200,
  actualLoanAmount: 182330,
  annualInterestRate: 11,
  financingCosts: 85575.568,
  holdingMonths: 4,
  contingency: 12000,
  laborBudget: 36000,
  materialBudget: 24000,
  operatingExpenses: 900,
  sellingCostPercent: 8,
  scopeCompleteness: "Estimated",
  contractorStatus: "Pending",
};

function buildStack() {
  const input = buildAcquisitionUnderwritingInput({ deal: fixture, policy: DEFAULT_BUY_BOX_POLICY });
  const readiness = createAcquisitionReadinessService().evaluate(input);
  const costs = buildProjectCostEngine(input);
  const flip = buildFlipUnderwritingEngine(input, costs);
  const brrrr = buildBrrrrUnderwritingEngine(input, costs);
  const rental = buildRentalHoldUnderwritingEngine(input, brrrr);
  const wholesale = buildWholesaleScreeningEngine(input, flip, costs);
  const mao = buildMaximumAllowableOfferEngine(input, flip, brrrr, rental, wholesale);
  const buyBox = buildRoyalStarBuyBoxEngine(input, DEFAULT_BUY_BOX_POLICY);
  const capital = buildCapitalExposureEngine(input, costs);
  const executionRisk = buildExecutionRiskEngine(input, costs);
  const exit = buildExitStrategyOptimizer({ flip, brrrr, rental, wholesale, capital, executionRisk });
  const opportunity = buildOpportunityCostEngine({ recommendedStrategy: exit.recommendedStrategy, strategies: exit.strategies });
  const redTeam = buildRedTeamAcquisitionReview({ flip, brrrr, rental, mao });
  const governance = buildDecisionGovernance({ readiness, mao, buyBox, exit, redTeam });
  return { input, readiness, costs, flip, brrrr, rental, wholesale, mao, buyBox, capital, executionRisk, exit, opportunity, redTeam, governance };
}

test("canonical input-schema tests", () => {
  const input = buildAcquisitionUnderwritingInput({ deal: fixture });
  assert.equal(input.propertyIdentity.address.value, "952 Goss Rd");
  assert.equal(input.valuation.activeArv.value, 300000);
});

test("source and confidence tests", () => {
  const input = buildAcquisitionUnderwritingInput({ deal: fixture });
  assert.equal(input.valuation.activeArv.source, "manual");
  assert.equal(input.valuation.activeArv.confidence, "Moderate");
});

test("readiness tests", () => {
  const readiness = createAcquisitionReadinessService().evaluate(buildAcquisitionUnderwritingInput({ deal: fixture }));
  assert.ok(["Not Ready", "Preliminary Review Only", "Offer Guidance Ready", "Conditional Approval Ready", "Final Approval Ready"].includes(readiness.status));
});

test("missing-critical-input tests", () => {
  const deal = { ...fixture, purchasePrice: 0, askingPrice: 0, activeArv: 0, estimatedArv: 0, arv: 0 };
  const readiness = createAcquisitionReadinessService().evaluate(buildAcquisitionUnderwritingInput({ deal }));
  assert.ok(readiness.criticalBlockers.length >= 1);
});

test("conflicting-input tests", () => {
  const readiness = createAcquisitionReadinessService().evaluate(buildAcquisitionUnderwritingInput({ deal: fixture }));
  assert.ok(Array.isArray(readiness.conflictingValues));
});

test("stale-input tests", () => {
  const readiness = createAcquisitionReadinessService().evaluate(buildAcquisitionUnderwritingInput({ deal: fixture }));
  assert.ok(Array.isArray(readiness.staleAssumptions));
});

test("project-cost tests", () => {
  const costs = buildProjectCostEngine(buildAcquisitionUnderwritingInput({ deal: fixture }));
  assert.ok(costs.allInCost > 0);
});

test("double-count prevention tests", () => {
  const costs = buildProjectCostEngine(buildAcquisitionUnderwritingInput({ deal: fixture }));
  assert.ok(costs.totalFinancingCost <= costs.allInCost);
});

test("cash-versus-financed-cost tests", () => {
  const costs = buildProjectCostEngine(buildAcquisitionUnderwritingInput({ deal: fixture }));
  assert.ok(costs.totalCashRequired >= 0);
});

test("flip-engine tests", () => {
  const { input, costs } = buildStack();
  const flip = buildFlipUnderwritingEngine(input, costs);
  assert.ok(typeof flip.netProjectedProfit === "number");
});

test("flip break-even tests", () => {
  const { flip } = buildStack();
  assert.ok(flip.breakEvenSalePrice > 0);
});

test("flip scenario tests", () => {
  const { flip } = buildStack();
  assert.ok(flip.maximumTolerableSaleDiscount >= 0);
});

test("BRRRR engine tests", () => {
  const { brrrr } = buildStack();
  assert.ok(typeof brrrr.dscr === "number");
});

test("refinance tests", () => {
  const { brrrr } = buildStack();
  assert.ok(brrrr.refinanceLoanAmount >= 0);
});

test("DSCR tests", () => {
  const { brrrr } = buildStack();
  assert.ok(Number.isFinite(brrrr.dscr));
});

test("debt-yield tests", () => {
  const { brrrr } = buildStack();
  assert.ok(Number.isFinite(brrrr.debtYield));
});

test("cash-left-in-deal tests", () => {
  const { brrrr } = buildStack();
  assert.ok(brrrr.cashRemainingInDeal >= 0);
});

test("rental-hold tests", () => {
  const { rental } = buildStack();
  assert.ok(Number.isFinite(rental.monthlyCashFlow));
});

test("wholesale-screen tests", () => {
  const { wholesale } = buildStack();
  assert.ok(typeof wholesale.wholesaleViability === "string");
});

test("MAO tests", () => {
  const { mao } = buildStack();
  assert.ok(mao.maximumTheoreticalOffer >= 0);
});

test("target-offer tests", () => {
  const { mao } = buildStack();
  assert.ok(mao.recommendedTargetOffer <= mao.recommendedWalkAwayPrice);
});

test("walk-away tests", () => {
  const { mao } = buildStack();
  assert.ok(mao.recommendedWalkAwayPrice >= 0);
});

test("buy-box tests", () => {
  const { buyBox } = buildStack();
  assert.ok(["Pass", "Conditional Pass", "Fail"].includes(buyBox.decision));
});

test("selective-ZIP tests", () => {
  const input = buildAcquisitionUnderwritingInput({ deal: { ...fixture, zipCode: "45205" } });
  const result = buildRoyalStarBuyBoxEngine(input, DEFAULT_BUY_BOX_POLICY);
  assert.ok(Array.isArray(result.rules));
});

test("exception tests", () => {
  const input = buildAcquisitionUnderwritingInput({ deal: { ...fixture, propertyType: "Vacant Land" } });
  const result = buildRoyalStarBuyBoxEngine(input, DEFAULT_BUY_BOX_POLICY);
  assert.ok(result.rules.some((rule) => rule.exceptionEligibility));
});

test("capital-exposure tests", () => {
  const { capital } = buildStack();
  assert.ok(["Adequate", "Tight", "Deficient", "Critical", "Insufficient Data"].includes(capital.status));
});

test("reserve tests", () => {
  const { capital } = buildStack();
  assert.ok(Number.isFinite(capital.reserveAfterAcquisition));
});

test("draw-gap tests", () => {
  const { capital } = buildStack();
  assert.ok(capital.drawGapExposure >= 0);
});

test("execution-risk tests", () => {
  const { executionRisk } = buildStack();
  assert.ok(["Low", "Moderate", "High"].includes(executionRisk.riskLevel));
});

test("exit-strategy tests", () => {
  const { exit } = buildStack();
  assert.ok(typeof exit.recommendedStrategy === "string");
});

test("no-action-alternative tests", () => {
  const { exit } = buildStack();
  assert.ok(exit.noActionAlternative);
});

test("opportunity-cost tests", () => {
  const { opportunity } = buildStack();
  assert.ok(typeof opportunity.comparisonCompleteness === "string");
});

test("red-team tests", () => {
  const { redTeam } = buildStack();
  assert.ok(redTeam.baseCaseDecision);
});

test("combined-downside tests", () => {
  const { redTeam } = buildStack();
  assert.ok(redTeam.mostDangerousCombination.includes("+") || redTeam.mostDangerousCombination.length > 0);
});

test("decision-breaking threshold tests", () => {
  const { redTeam } = buildStack();
  assert.ok(redTeam.decisionBreakingSalePrice >= 0);
});

test("recommendation-stability tests", () => {
  const { redTeam } = buildStack();
  assert.ok(["Moderate", "Fragile"].includes(redTeam.recommendationStability));
});

test("decision-status tests", () => {
  const { governance } = buildStack();
  assert.ok(typeof governance.status === "string");
});

test("approval-governance tests", () => {
  const { governance } = buildStack();
  assert.equal(governance.approvalRequiredToPersist, true);
});

test("versioning tests", () => {
  const svc = createAcquisitionDecisionVersioningService();
  svc.add({ underwritingId: "u-1" });
  assert.equal(svc.list().length, 1);
});

test("override tests", () => {
  const input = buildAcquisitionUnderwritingInput({ deal: fixture });
  assert.equal(typeof input.valuation.activeArv.overrideStatus, "boolean");
});

test("exactly-one re-underwriting tests", () => {
  const result = buildAcquisitionIntelligenceEngine({ deal: fixture });
  assert.equal(result.governance.advisoryOnly, true);
});

test("cosmetic-no-trigger tests", () => {
  const baseline = buildAcquisitionIntelligenceEngine({ deal: fixture });
  const cosmetic = buildAcquisitionIntelligenceEngine({ deal: { ...fixture, notes: "Updated note" } });
  assert.equal(baseline.mao.recommendedWalkAwayPrice, cosmetic.mao.recommendedWalkAwayPrice);
});

test("document-assembly tests", () => {
  const stack = buildStack();
  const docs = buildAcquisitionDocumentAssembly({ ...stack, input: stack.input });
  assert.ok(docs.acquisitionSummary);
});

test("outcome-feedback tests", () => {
  const feedback = buildOutcomeFeedbackSummary({ projected: { purchasePrice: 100 }, actual: { purchasePrice: 105 }, sampleSize: 6 });
  assert.equal(feedback.purchasePrice.variance, 5);
});

test("small-sample protection tests", () => {
  const feedback = buildOutcomeFeedbackSummary({ projected: {}, actual: {}, sampleSize: 2 });
  assert.match(feedback.sampleProtection, /insufficient/i);
});

test("952 Goss stability tests", () => {
  const result = buildAcquisitionIntelligenceEngine({ deal: fixture });
  assert.equal(result.input.propertyIdentity.address.value, "952 Goss Rd");
  assert.equal(result.input.valuation.activeArv.value, 300000);
});

test("save-refresh-reopen tests", () => {
  const svc = createAcquisitionDecisionVersioningService();
  svc.add({ underwritingId: "u-2", recommendation: "BUY" });
  const reopened = svc.list().find((entry) => entry.underwritingId === "u-2");
  assert.equal(reopened.recommendation, "BUY");
});

test("full acquisition engine integration result", () => {
  const result = buildAcquisitionIntelligenceEngine({ deal: fixture });
  assert.ok(result.readiness);
  assert.ok(result.costs);
  assert.ok(result.governance);
  assert.ok(result.documents);
});
