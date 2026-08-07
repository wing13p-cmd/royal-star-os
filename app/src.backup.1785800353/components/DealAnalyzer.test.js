import test from "node:test";
import assert from "node:assert/strict";
import { buildPersistedDealPayload } from "../../../server/dealPersistence.js";

test("buildPersistedDealPayload preserves underwriting fields required to reopen a deal with calculated financing", () => {
  const persisted = buildPersistedDealPayload({
    id: "deal-1",
    propertyAddress: "952 Goss Rd",
    city: "Cincinnati",
    state: "OH",
    zipCode: "45229",
    purchasePrice: 135000,
    rehabBudget: 60000,
    estimatedArv: 300000,
    annualInterestRate: 11.24,
    actualLoanAmount: 182330,
    cashToClose: 26857.9,
    earnestMoney: 3500,
    totalInitialCashInvested: 30357.9,
    constructionHoldback: 62990,
    originationFee: 1800,
    underwritingFee: 500,
    servicingFee: 250,
    lenderLegalFee: 750,
    monitoringFee: 100,
    otherLenderFees: 200,
    paymentType: "Interest Only",
    financingCosts: 0,
    recommendation: "Continue Project",
    overallRisk: 28,
    projectedProfit: 77902.1,
  });

  assert.ok(persisted.financingCosts > 0);
  assert.equal(persisted.financials.financingCostSource, "calculated");
  assert.equal(persisted.recommendation, "Continue Project");
  assert.equal(persisted.overallRisk, 28);
  assert.equal(persisted.projectedProfit, 104760);
});
