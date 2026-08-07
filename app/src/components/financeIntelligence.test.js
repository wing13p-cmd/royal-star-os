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
  assert.equal(result.qualifyingStatus, "Not Qualified");
  assert.equal(result.financingScore >= 0 && result.financingScore <= 100, true);
  assert.equal(result.financingWarnings.length > 0, true);
  assert.equal(result.displayValue("Insufficient Data"), "Insufficient Data");
});
