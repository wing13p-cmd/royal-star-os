import test from "node:test";
import assert from "node:assert/strict";
import { buildPersistedDealPayload } from "./dealPersistence.js";

test("buildPersistedDealPayload writes a computed financing cost when the saved value is blank", () => {
  const persisted = buildPersistedDealPayload({
    propertyAddress: "952 Goss Rd",
    purchasePrice: "135000",
    rehabBudget: "60000",
    estimatedArv: "300000",
    annualInterestRate: "11.24",
    actualLoanAmount: "182330",
    annualTaxes: "2800",
    annualInsurance: "1200",
    holdingMonths: "4",
    cashToClose: "26857.90",
    earnestMoney: "3500",
    totalInitialCashInvested: "30357.90",
    constructionHoldback: "62990",
    financingCosts: "",
    paymentType: "Interest Only",
  });

  assert.ok(persisted.financingCosts > 0);
  assert.ok(persisted.financingCosts >= 1000);
});

test("buildPersistedDealPayload preserves an explicit financing cost when it is already positive", () => {
  const persisted = buildPersistedDealPayload({
    propertyAddress: "123 Main St",
    purchasePrice: "100000",
    rehabBudget: "20000",
    estimatedArv: "180000",
    financingCosts: "1250",
  });

  assert.equal(persisted.financingCosts, 1250);
});

test("buildPersistedDealPayload writes shared underwriting risk and recommendation fields", () => {
  const persisted = buildPersistedDealPayload({
    propertyAddress: "952 Goss Rd",
    purchasePrice: "135000",
    rehabBudget: "60000",
    estimatedArv: "300000",
    annualInterestRate: "11.24",
    actualLoanAmount: "182330",
    annualTaxes: "2800",
    annualInsurance: "1200",
    holdingMonths: "4",
    cashToClose: "26857.90",
    earnestMoney: "3500",
    totalInitialCashInvested: "30357.90",
    constructionHoldback: "62990",
    financingCosts: "",
    paymentType: "Interest Only",
  });

  assert.ok(persisted.overallRisk > 0);
  assert.ok(persisted.riskLevel);
  assert.equal(persisted.recommendation, "Continue Project");
  assert.ok(persisted.warningCount > 0);
});
