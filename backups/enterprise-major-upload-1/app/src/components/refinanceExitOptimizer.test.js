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
