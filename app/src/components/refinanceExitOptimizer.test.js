import test from 'node:test';
import assert from 'node:assert/strict';
import { buildRefinanceExitOptimizer } from './refinanceExitOptimizer.js';

test('buildRefinanceExitOptimizer returns safe defaults for empty input', () => {
  const result = buildRefinanceExitOptimizer({ properties: [], deals: [], portfolioIntelligence: null, capitalAllocationEngine: null });

  assert.equal(result.primaryExit, 'Insufficient Data');
  assert.equal(result.refinanceReadiness, 'Insufficient Data');
  assert.equal(result.comparison.length >= 0, true);
  assert.equal(result.known.length > 0, true);
  assert.equal(result.uncertain.length > 0, true);
  assert.equal(result.needed.length > 0, true);
});

test('buildRefinanceExitOptimizer identifies refinance-ready properties', () => {
  const result = buildRefinanceExitOptimizer({
    properties: [{
      id: 'p1',
      propertyName: '100 Main',
      currentValue: 240000,
      currentLoanBalance: 140000,
      monthlyRent: 2800,
      monthlyOperatingExpenses: 900,
      monthlyDebtService: 1100,
      annualTaxes: 4000,
      annualInsurance: 2200,
      rehabRemainingBudget: 10000,
      rehabPercentComplete: 70,
      loanMaturityDate: '2026-10-01',
      interestRate: 0.065,
      supportedARV: 260000,
      appraisedValue: 250000,
      occupancyRate: 95,
      leaseStatus: 'Leased',
      lenderRequirements: { maxLtv: 0.75, minDscr: 1.2 },
      appraisalStatus: 'Complete',
      insuranceStatus: 'Current',
      titleStatus: 'Clear',
      documentationCompleteness: 0.9,
      refinanceCandidate: true,
    }],
    deals: [],
    portfolioIntelligence: { summary: {} },
    capitalAllocationEngine: null,
  });

  assert.equal(result.primaryExit, 'Refinance and Hold');
  assert.equal(result.refinanceReadiness, 'Ready to Refinance');
  assert.equal(result.comparison.some((option) => option.strategy === 'Refinance and Hold'), true);
});

test('buildRefinanceExitOptimizer returns a complete safe shape for partial input', () => {
  const result = buildRefinanceExitOptimizer({
    properties: [{
      id: 'p2',
      propertyName: 'Partial Property',
      currentValue: 0,
      currentLoanBalance: 0,
      monthlyRent: 0,
      monthlyOperatingExpenses: 0,
      monthlyDebtService: 0,
      rehabRemainingBudget: 0,
      paret: null,
    }],
    deals: [],
    portfolioIntelligence: null,
    capitalAllocationEngine: null,
  });

  assert.equal(result.status, 'Unavailable');
  assert.equal(result.primaryExit, 'Insufficient Data');
  assert.equal(Array.isArray(result.strategies), true);
  assert.equal(Array.isArray(result.warnings), true);
  assert.equal(Array.isArray(result.requiredActions), true);
  assert.equal(typeof result.summary, 'object');
  assert.equal(result.summary.message.includes('unavailable'), true);
});

test('Flip projected ARV enables sale planning without creating fake refinance proceeds', () => {
  const result = buildRefinanceExitOptimizer({ properties: [{ strategy: 'Flip', projectedARV: 285000, currentLoanBalance: 182330, sellingCosts: 22000, rehabRemainingBudget: 0, interestRate: 11.24 }] });
  assert.equal(result.status, 'Available with Conditions');
  assert.equal(result.primaryExit, 'Sell After Rehab');
  assert.equal(result.refinanceAnalysis.refinanceLoanAmount, null);
  assert.equal(result.refinanceAnalysis.netRefinanceProceeds, null);
  assert.equal(result.comparison.find((entry) => entry.strategy === 'Sell After Rehab').estimatedGrossProceeds, 285000);
  assert.equal(result.comparison.find((entry) => entry.strategy === 'Sell After Rehab').estimatedNetProceeds, 80670);
});

test('preliminary calculated ARV does not unlock refinance proceeds', () => {
  const result = buildRefinanceExitOptimizer({ properties: [{
    strategy: 'Flip', projectedARV: 285000, calculatedARV: 280000, baseARV: 280000,
    currentLoanBalance: 182330, refinanceLtv: 75, refinanceClosingCosts: 5000,
  }] });
  assert.equal(result.primaryExit, 'Sell After Rehab');
  assert.equal(result.refinanceAnalysis.refinanceLoanAmount, null);
  assert.equal(result.refinanceAnalysis.netRefinanceProceeds, null);
  assert.equal(result.refinanceAnalysis.cashReturned, null);
  assert.equal(result.refinanceAnalysis.cashLeftInDeal, null);
});

test('refinance and sale proceeds use supported value, payoff, costs, and explicit invested cash', () => {
  const result = buildRefinanceExitOptimizer({ properties: [{
    supportedARV: 285000,
    currentLoanBalance: 182330,
    refinanceLtv: 75,
    refinanceClosingCosts: 5000,
    totalCashInvested: 30000,
    sellingCosts: 22000,
    rehabRemainingBudget: 0,
    interestRate: 11.24,
  }] });
  assert.equal(result.refinanceAnalysis.refinanceLoanAmount, 213750);
  assert.equal(result.refinanceAnalysis.netRefinanceProceeds, 26420);
  assert.equal(result.refinanceAnalysis.cashReturned, 26420);
  assert.equal(result.refinanceAnalysis.cashLeftInDeal, 3580);
  const sale = result.comparison.find((entry) => entry.strategy === 'Sell After Rehab');
  assert.equal(sale.estimatedGrossProceeds, 285000);
  assert.equal(sale.estimatedNetProceeds, 80670);
});
