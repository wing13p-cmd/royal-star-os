import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const analyzerFile = path.join(process.cwd(), "app/src/components/BrrrrAnalyzer.jsx");

test("BRRRR analyzer passes refinance rate and term into underwriting recalculation", () => {
  const source = fs.readFileSync(analyzerFile, "utf8");

  assert.equal(source.includes("refinanceInterestRate: formValues.refinanceInterestRate"), true);
  assert.equal(source.includes("refinanceLoanTermYears: formValues.refinanceLoanTermYears"), true);
  assert.equal(source.includes("buildUnifiedUnderwritingIntelligence(underwritingInputs, [])"), true);
});

test("BRRRR analyzer normalizes optional cash-flow inputs so monthly cash flow and DSCR can recompute", () => {
  const source = fs.readFileSync(analyzerFile, "utf8");

  assert.equal(source.includes("normalizeOptionalNumberInput(formValues.otherMonthlyIncome, 0)"), true);
  assert.equal(source.includes("normalizeOptionalNumberInput(formValues.annualPropertyTaxes, 0)"), true);
  assert.equal(source.includes("normalizeOptionalNumberInput(formValues.annualInsurance, 0)"), true);
  assert.equal(source.includes("normalizeOptionalNumberInput(formValues.monthlyHoa, 0)"), true);
  assert.equal(source.includes("normalizeOptionalNumberInput(formValues.monthlyUtilities, 0)"), true);
  assert.equal(source.includes("normalizeOptionalNumberInput(formValues.otherMonthlyExpenses, 0)"), true);
});

test("BRRRR analyzer includes maintenance and capex percentages in recalculation payload", () => {
  const source = fs.readFileSync(analyzerFile, "utf8");

  assert.equal(source.includes("maintenancePercent: formValues.maintenancePercent"), true);
  assert.equal(source.includes("capexPercent: formValues.capexPercent"), true);
  assert.equal(source.includes("propertyManagementPercent: formValues.propertyManagementPercent"), true);
});

test("BRRRR analyzer includes and constrains earnest money and holding months", () => {
  const source = fs.readFileSync(analyzerFile, "utf8");

  assert.equal(source.includes('["EARNEST MONEY", "earnestMoney"]'), true);
  assert.equal(source.includes('["HOLDING MONTHS", "holdingMonths"]'), true);
  assert.equal(source.includes("earnestMoney: formValues.earnestMoney"), true);
  assert.equal(source.includes("holdingMonths: formValues.holdingMonths"), true);
  assert.equal(source.includes("buildPropertyAutomation(selectedDeal).moduleData.brrrrAnalyzer"), true);
  assert.equal(source.includes('earnestMoney: canonical.earnestMoney ?? ""'), true);
  assert.equal(source.includes('holdingMonths: canonical.holdingMonths ?? ""'), true);
  assert.equal(source.includes('step={name === "holdingMonths" ? 1 : undefined}'), true);
});
