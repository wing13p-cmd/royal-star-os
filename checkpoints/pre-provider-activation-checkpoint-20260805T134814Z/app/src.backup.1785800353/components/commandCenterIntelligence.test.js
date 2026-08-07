import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCommandCenterIntelligence } from './commandCenterIntelligence.js';

test('buildCommandCenterIntelligence returns safe defaults for empty input', () => {
  const result = buildCommandCenterIntelligence({
    deals: [],
    dealIntelligence: [],
    properties: [],
    portfolioData: [],
    rehabProjects: [],
    contractors: [],
    lenders: [],
    comps: [],
    neighborhoods: [],
    appraisalPackets: [],
    portfolioIntelligence: null,
  });

  assert.equal(result.businessStatus, 'Insufficient Data');
  assert.equal(result.alerts.length, 0);
  assert.equal(result.topOpportunity.propertyName, 'Insufficient Data');
  assert.equal(result.topRisk.risk, 'Insufficient Data');
});

test('buildCommandCenterIntelligence flags critical issues from supported data', () => {
  const result = buildCommandCenterIntelligence({
    deals: [{ id: 'deal-1', propertyAddress: '100 Main', city: 'Austin', state: 'TX', zipCode: '78701', purchasePrice: 120000, rehabBudget: 40000, estimatedArv: 180000, status: 'active', strategy: 'buy' }],
    dealIntelligence: [{ id: 'di-1', decision: 'Renegotiate', dealScore: 56, recommendation: 'Renegotiate', profit: -5000, roi: -4, estimatedCashRequired: 150000, riskLevel: 'High' }],
    properties: [{ id: 'prop-1', propertyName: '100 Main', address: '100 Main', city: 'Austin', state: 'TX', zipCode: '78701', currentValue: 110000, currentLoanBalance: 130000, monthlyRent: 1800, monthlyOperatingExpenses: 900, monthlyDebtService: 2000, loanMaturityDate: '2026-08-01', rehabStatus: 'Over Budget', supportedARV: 180000, recommendation: 'Sell' }],
    portfolioData: [{ id: 'prop-1', propertyName: '100 Main', currentValue: 110000, purchasePrice: 120000, loanBalance: 130000, monthlyRent: 1800, operatingExpenses: 900, monthlyDebtService: 2000, status: 'Active', strategy: 'Hold' }],
    rehabProjects: [{ id: 'rehab-1', projectStatus: 'Delayed', originalRehabBudget: 50000, actualCost: 65000, percentComplete: 40, contractorName: 'AAA', riskLevel: 'Critical' }],
    contractors: [{ id: 'c-1', contractorName: 'AAA', insuranceStatus: 'Expired' }],
    lenders: [{ id: 'l-1', lenderName: 'Lender One', activeStatus: 'Active', loanMaturityDate: '2026-08-01' }],
    comps: [],
    neighborhoods: [],
    appraisalPackets: [],
    portfolioIntelligence: {
      summary: { totalProperties: 1, totalCurrentValue: 110000, totalEquity: -20000, portfolioLtv: '118.2%', portfolioDscr: '0.92x', totalMonthlyCashFlow: -1200, reserveShortfallValue: 50000, criticalAlertCount: 1, healthScore: 34 },
      alerts: [{ severity: 'CRITICAL', alert: 'Negative equity' }],
      known: ['Supported facts'],
      uncertain: ['Missing lender terms'],
      neededToImproveDecision: ['Updated valuation']
    },
  });

  assert.ok(result.alerts.length > 0);
  assert.equal(result.topRisk.severity, 'CRITICAL');
  assert.equal(result.capitalPosition.status, 'Capital Shortfall');
  assert.equal(result.rehabOperationsSummary.largestRisk, 'Critical rehab delay');
});

test('buildCommandCenterIntelligence returns search results for matching deals, products, and rehab projects', () => {
  const mainResult = buildCommandCenterIntelligence({
    deals: [{ id: 'deal-1', propertyAddress: '100 Main', status: 'active' }],
    dealIntelligence: [{ id: 'di-1', analysisName: '100 Main', recommendation: 'Strong Buy' }],
    properties: [{ id: 'prop-1', propertyName: '100 Main', address: '100 Main' }],
    portfolioData: [],
    rehabProjects: [{ id: 'rehab-1', propertyName: 'Main Rehab', projectStatus: 'In Progress' }],
    contractors: [{ id: 'c-1', companyName: 'Acme Contractors' }],
    lenders: [{ id: 'l-1', lenderName: 'West Bank' }],
    comps: [],
    neighborhoods: [],
    appraisalPackets: [],
    searchQuery: 'main',
  });

  const productResult = buildCommandCenterIntelligence({
    deals: [],
    dealIntelligence: [],
    properties: [],
    portfolioData: [],
    rehabProjects: [],
    contractors: [],
    lenders: [],
    comps: [],
    neighborhoods: [],
    appraisalPackets: [],
    products: [{ id: 'product-1', productName: 'Quartz Countertop', vendor: 'Tile Co' }],
    vendors: [{ id: 'vendor-1', vendorName: 'Tile Co' }],
    searchQuery: 'countertop',
  });

  assert.ok(mainResult.searchResults.some((entry) => entry.label === '100 Main' && entry.module === 'Deal Analyzer'));
  assert.ok(mainResult.searchResults.some((entry) => entry.label === 'Main Rehab' && entry.module === 'Rehab Project Tracker'));
  assert.ok(productResult.searchResults.some((entry) => entry.label === 'Quartz Countertop' && entry.module === 'Product Vault'));
});
