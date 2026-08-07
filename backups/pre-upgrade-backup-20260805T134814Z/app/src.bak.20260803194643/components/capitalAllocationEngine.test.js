import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCapitalAllocationEngine } from './capitalAllocationEngine.js';

test('buildCapitalAllocationEngine returns safe defaults for empty input', () => {
  const result = buildCapitalAllocationEngine({
    properties: [],
    deals: [],
    dealIntelligence: [],
    rehabProjects: [],
    lenders: [],
    contractors: [],
    portfolioIntelligence: null,
  });

  assert.equal(result.capitalPosition.capitalStatus, 'Capital Shortfall');
  assert.equal(result.capitalPosition.availableLiquidityDisplay, 'Insufficient Data');
  assert.equal(result.capitalUseOptions.length > 0, true);
  assert.equal(result.plan.length >= 0, true);
});

test('buildCapitalAllocationEngine prioritizes reserve protection and rehab funding', () => {
  const result = buildCapitalAllocationEngine({
    properties: [{
      id: 'p1',
      propertyName: '100 Main',
      currentValue: 180000,
      currentLoanBalance: 220000,
      monthlyRent: 2500,
      monthlyOperatingExpenses: 900,
      monthlyDebtService: 1800,
      rehabStatus: 'Active',
      originalRehabBudget: 60000,
      actualRehabCost: 30000,
      recommendation: 'Refinance Candidate',
      loanMaturityDate: '2026-08-01',
      annualTaxes: 4000,
      annualInsurance: 2200,
    }],
    deals: [{ id: 'd1', propertyAddress: '100 Main', purchasePrice: 120000, rehabBudget: 50000, estimatedArv: 220000, status: 'active', strategy: 'buy' }],
    dealIntelligence: [{ id: 'di1', decision: 'Buy', recommendation: 'Buy', dealScore: 88, estimatedCashRequired: 140000, profit: 30000, roi: 0.18, analysisStatus: 'Ready to Offer' }],
    rehabProjects: [{ id: 'r1', propertyName: '100 Main', remainingBudget: 30000, originalRehabBudget: 60000, actualCost: 30000, projectStatus: 'Active', riskLevel: 'Moderate' }],
    lenders: [{ id: 'l1', lenderName: 'Northstar', loanMaturityDate: '2026-08-01' }],
    contractors: [{ id: 'c1', contractorName: 'AAA', insuranceStatus: 'Expired' }],
    portfolioIntelligence: { summary: { availableLiquidity: 120000, recommendedReserve: 150000, reserveShortfallValue: 30000, totalCurrentValue: 180000, totalOutstandingDebt: 220000 } },
  });

  assert.equal(result.capitalPosition.reserveShortfallDisplay.includes('Shortfall'), true);
  assert.equal(result.capitalUseOptions.some((option) => option.option === 'Preserve Required Reserve'), true);
  assert.equal(result.capitalUseOptions.some((option) => option.option === 'Fund Active Rehab'), true);
  assert.equal(result.plan[0]?.option, 'Preserve Required Reserve');
});

test('buildCapitalAllocationEngine produces executive capital allocation recommendations', () => {
  const result = buildCapitalAllocationEngine({
    properties: [{
      id: 'p1',
      propertyName: '100 Main',
      currentValue: 220000,
      currentLoanBalance: 150000,
      monthlyRent: 2600,
      monthlyOperatingExpenses: 800,
      monthlyDebtService: 1600,
      rehabStatus: 'Active',
      originalRehabBudget: 40000,
      actualRehabCost: 20000,
      recommendation: 'Refinance Candidate',
      annualTaxes: 3000,
      annualInsurance: 1800,
    }],
    deals: [{ id: 'd1', propertyAddress: '100 Main', purchasePrice: 140000, rehabBudget: 40000, estimatedArv: 280000, status: 'active', strategy: 'flip' }],
    dealIntelligence: [{ id: 'di1', dealId: 'd1', decision: 'Buy', recommendation: 'Buy', dealScore: 84, estimatedCashRequired: 80000, profit: 42000, roi: 0.16, analysisStatus: 'Ready to Offer', overallRisk: 22, cashRequired: 80000 }],
    rehabProjects: [{ id: 'r1', propertyName: '100 Main', remainingBudget: 20000, originalRehabBudget: 40000, actualCost: 20000, projectStatus: 'Active', riskLevel: 'Moderate' }],
    lenders: [{ id: 'l1', lenderName: 'Northstar' }],
    contractors: [{ id: 'c1', contractorName: 'AAA' }],
    portfolioIntelligence: { summary: { availableLiquidity: 220000, recommendedReserve: 150000, reserveShortfallValue: 0, totalCurrentValue: 1000000, totalOutstandingDebt: 500000, totalMonthlyCashFlow: 10000 } },
  });

  assert.equal(result.executiveCapitalAllocation?.recommendations?.length > 0, true);
  assert.equal(result.executiveCapitalAllocation?.rankedOpportunities?.length > 0, true);
  assert.equal(result.executiveCapitalAllocation?.recommendations[0].recommendedAction, 'Fund Immediately');
  assert.ok(result.executiveCapitalAllocation?.recommendations[0].capitalEfficiencyScore >= 0);
  assert.equal(result.capitalUseOptions.some((option) => option.recommendedAction === 'Fund Immediately' || option.recommendedAction === 'Reserve Capital'), true);
});
