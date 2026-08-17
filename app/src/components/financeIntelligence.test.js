import test from "node:test";
import assert from "node:assert/strict";
import { buildFinancingIntelligence } from "./financeIntelligence.js";

test("buildFinancingIntelligence returns safe financing values and qualification status", () => {
  const deal = {
    purchasePrice: 100000,
    rehabBudget: 20000,
    closingCosts: 5000,
    financingCosts: 2000,
    taxes: 1000,
    insurance: 500,
    estimatedArv: 180000,
    estimatedRent: 3000,
    cashOnHand: 40000,
  };

  const lender = {
    id: "lender-1",
    lenderName: "Northstar Capital",
    loanProgramName: "Fix & Flip",
    loanType: "Hard Money",
    interestRate: 0.12,
    originationPoints: 0.02,
    underwritingFee: 1500,
    processingFee: 750,
    appraisalFee: 500,
    legalFee: 500,
    maximumLoanAmount: 140000,
    minimumLoanAmount: 50000,
    maximumLTC: 0.8,
    maximumPurchaseLTV: 0.7,
    maximumARVLTV: 0.75,
    liquidityRequirement: 20000,
    drawScheduleType: "Reimbursement",
    loanTermMonths: 12,
    extensionOptions: "1 extension",
    creditScoreMinimum: 680,
    DSCRMinimum: 1.25,
    drawTurnaroundDays: 7,
    notes: "Good for quick close",
  };

  const result = buildFinancingIntelligence(deal, lender);

  assert.equal(result.loanAmount, 102800);
  assert.equal(result.cashRequired, 25700);
  assert.equal(result.pointsCost, 2056);
  assert.equal(result.originationFees, 3250);
  assert.equal(result.totalFinancingCost, 5306);
  assert.equal(result.ltc, 0.8);
  assert.equal(result.qualifyingStatus, "Conditionally Qualified");
  assert.equal(result.financingScore >= 0 && result.financingScore <= 100, true);
  assert.equal(result.financingWarnings.length > 0, true);
  assert.equal(result.displayValue("Insufficient Data"), "Insufficient Data");
});

test("saved financing remains authoritative without a linked lender", () => {
  const result = buildFinancingIntelligence({
    purchasePrice: 135000, rehabBudget: 60000, actualLoanAmount: 182330,
    annualInterestRate: 11.24, paymentType: "intrest only", holdingMonths: 3,
    totalInitialCashInvested: 30000, estimatedRent: 1800,
  }, {});
  assert.equal(result.loanAmount, 182330);
  assert.equal(result.interestRate, 11.24);
  assert.ok(result.monthlyPrincipalAndInterest > 0);
  assert.ok(result.interestCarryDuringRehab > 0);
  assert.equal(result.qualifyingStatus, "Not Evaluated — No Lender Linked");
  assert.equal(result.lenderLinked, false);
});

test("unknown rate remains unknown and never creates zero interest carry", () => {
  const result = buildFinancingIntelligence({ purchasePrice: 135000, actualLoanAmount: 100000 }, {});
  assert.equal(result.interestRate, null);
  assert.equal(result.monthlyInterestPayment, null);
  assert.equal(result.interestCarryDuringRehab, null);
});

test("financing leverage keeps LTV unknown without current as-is value", () => {
  const result = buildFinancingIntelligence({ purchasePrice: 135000, rehabBudget: 60000, closingCosts: 5000, financingCosts: 5000, holdingCosts: 6000, estimatedArv: 285000, actualLoanAmount: 182330, annualInterestRate: 11.24 }, {});
  assert.equal(result.ltc, 182330 / 211000);
  assert.equal(result.ltv, null);
  assert.equal(result.ltarv, 182330 / 285000);
  assert.equal(result.interestRate, 11.24);
});

test("production-style LTC uses the canonical 215800 project-cost denominator", () => {
  const result = buildFinancingIntelligence({ purchasePrice: 135000, rehabBudget: 60000, closingCosts: 5000, financingCosts: 5000, holdingCosts: 6000, taxes: 3000, insurance: 1800, estimatedArv: 285000, actualLoanAmount: 182330, annualInterestRate: 11.24, initialCashInvested: 30000, strategy: "Flip" }, {});
  assert.equal(result.leverage.totalProjectCost, 215800);
  assert.equal(result.ltc, 182330 / 215800);
  assert.equal(result.ltv, null);
});

test("unlinked Flip financing warnings have internal provenance and exclude DSCR", () => {
  const result = buildFinancingIntelligence({ purchasePrice: 135000, rehabBudget: 60000, closingCosts: 5000, financingCosts: 5000, holdingCosts: 6000, estimatedArv: 285000, estimatedRent: 100, actualLoanAmount: 182330, annualInterestRate: 11.24, initialCashInvested: 30000, strategy: "Flip" }, {});
  assert.equal(result.qualifyingStatus, "Not Evaluated — No Lender Linked");
  assert.equal(result.financingWarnings.includes("Low DSCR"), false);
  assert.ok(result.financingWarningDetails.length > 0);
  assert.ok(result.financingWarningDetails.every((warning) => warning.source === "ROYAL_STAR_INTERNAL"));
  assert.equal(result.lenderQualificationWarnings.length, 0);
});

test("BRRRR financing retains strategy DSCR warning", () => {
  const result = buildFinancingIntelligence({ purchasePrice: 135000, rehabBudget: 60000, estimatedArv: 285000, estimatedRent: 100, actualLoanAmount: 182330, annualInterestRate: 11.24, paymentType: "Interest Only", strategy: "BRRRR" }, {});
  assert.equal(result.financingWarnings.includes("Low DSCR"), true);
  assert.equal(result.financingWarningDetails.find((warning) => warning.message === "Low DSCR").source, "STRATEGY");
});
