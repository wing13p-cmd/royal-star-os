import test from 'node:test';
import assert from 'node:assert/strict';
import { buildUnifiedUnderwritingIntelligence } from './intelligenceUpgradeEngine.js';

function buildBaseDeal(overrides = {}) {
  return {
    purchasePrice: 135000,
    rehabBudget: 60000,
    estimatedArv: 300000,
    strategy: 'BRRRR',
    refinanceLtvPercent: 75,
    refinanceInterestRate: 8,
    refinanceLoanTermYears: 30,
    refinanceClosingCosts: 5000,
    estimatedRent: 2400,
    otherMonthlyIncome: 0,
    annualPropertyTaxes: 2800,
    annualInsurance: 1200,
    monthlyHoa: 0,
    monthlyUtilities: 0,
    otherMonthlyExpenses: 0,
    vacancyPercent: 5,
    maintenancePercent: 5,
    capexPercent: 5,
    propertyManagementPercent: 8,
    initialCashInvested: 50000,
    cashToClose: 45000,
    earnestMoney: 5000,
    ...overrides,
  };
}

test('BRRRR LTV normalization supports 75 and 0.75 equally', () => {
  const wholePercent = buildUnifiedUnderwritingIntelligence(buildBaseDeal({ refinanceLtvPercent: 75 }), [], []);
  const fractionalPercent = buildUnifiedUnderwritingIntelligence(buildBaseDeal({ refinanceLtvPercent: 0.75 }), [], []);

  assert.equal(wholePercent.brrrrAnalysis.refinanceLtv, 0.75);
  assert.equal(fractionalPercent.brrrrAnalysis.refinanceLtv, 0.75);
  assert.equal(wholePercent.brrrrAnalysis.maxLoanBasedOnLtv, 225000);
  assert.equal(fractionalPercent.brrrrAnalysis.maxLoanBasedOnLtv, 225000);
});

test('refinance loan amount honors the lowest valid constraint', () => {
  const result = buildUnifiedUnderwritingIntelligence(buildBaseDeal({
    refinanceLtvPercent: 75,
    lenderLoanAmount: 210000,
  }), [], []);

  assert.equal(result.brrrrAnalysis.maxLoanBasedOnLtv, 225000);
  assert.equal(result.brrrrAnalysis.lenderApprovedLoan, 210000);
  assert.equal(result.brrrrAnalysis.refinanceLoanAmount, 210000);
  assert.ok(result.brrrrAnalysis.refinanceLoanAmount <= result.brrrrAnalysis.maxLoanBasedOnLtv);
});

test('equity created is not an alias of cash left in deal', () => {
  const result = buildUnifiedUnderwritingIntelligence(buildBaseDeal({
    refinanceLtvPercent: 75,
    initialCashInvested: 40000,
  }), [], []);

  assert.equal(result.brrrrAnalysis.equityCreated, result.brrrrAnalysis.stabilizedArv - result.brrrrAnalysis.refinanceLoanAmount);
  assert.notEqual(result.brrrrAnalysis.equityCreated, result.brrrrAnalysis.cashLeftInDeal);
});

test('returns remain fractional and are not double scaled in underwriting output', () => {
  const result = buildUnifiedUnderwritingIntelligence(buildBaseDeal({
    initialCashInvested: 45000,
    estimatedRent: 2800,
  }), [], []);

  assert.ok(Number.isFinite(result.brrrrAnalysis.cashOnCashReturn));
  assert.ok(Math.abs(result.brrrrAnalysis.cashOnCashReturn) < 5);
  assert.ok(Number.isFinite(result.brrrrAnalysis.returnOnTotalCost));
  assert.ok(Math.abs(result.brrrrAnalysis.returnOnTotalCost) < 5);
});

test('missing rent blocks cash-flow dependent metrics and recommendation', () => {
  const result = buildUnifiedUnderwritingIntelligence(buildBaseDeal({ estimatedRent: '' }), [], []);

  assert.equal(result.brrrrAnalysis.netOperatingIncome, null);
  assert.equal(result.brrrrAnalysis.monthlyCashFlow, null);
  assert.equal(result.brrrrAnalysis.debtServiceCoverageRatio, null);
  assert.equal(result.recommendation.action, 'REQUEST MORE DATA');
  assert.ok(result.recommendation.missingFinancialInputs.includes('Monthly rent'));
});

test('missing refinance rate blocks debt service and DSCR outputs', () => {
  const result = buildUnifiedUnderwritingIntelligence(buildBaseDeal({ refinanceInterestRate: '' }), [], []);

  assert.equal(result.brrrrAnalysis.monthlyDebtService, null);
  assert.equal(result.brrrrAnalysis.debtServiceCoverageRatio, null);
  assert.equal(result.recommendation.action, 'REQUEST MORE DATA');
  assert.ok(result.recommendation.missingFinancialInputs.includes('Refinance interest rate'));
});

test('missing LTV blocks refinance amount outputs', () => {
  const result = buildUnifiedUnderwritingIntelligence(buildBaseDeal({ refinanceLtvPercent: '' }), [], []);

  assert.equal(result.brrrrAnalysis.refinanceLtv, null);
  assert.equal(result.brrrrAnalysis.maxLoanBasedOnLtv, null);
  assert.equal(result.brrrrAnalysis.refinanceLoanAmount, null);
  assert.equal(result.recommendation.action, 'REQUEST MORE DATA');
  assert.ok(result.recommendation.missingFinancialInputs.includes('Refinance LTV'));
});
