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
  assert.ok(result.alertBuckets);
  assert.ok(Array.isArray(result.alertBuckets.active));
  assert.ok(Array.isArray(result.alertBuckets.resolved));
  assert.ok(Array.isArray(result.alertBuckets.historical));
  assert.ok(Array.isArray(result.alertBuckets.informational));
  assert.equal(result.topRisk.severity, 'CRITICAL');
  assert.equal(result.capitalPosition.status, 'Capital Shortfall');
  assert.equal(result.rehabOperationsSummary.largestRisk, 'Critical rehab delay');
  const firstAlert = result.alerts[0];
  assert.ok(firstAlert.sourceMetric);
  assert.ok(firstAlert.condition);
  assert.ok(firstAlert.threshold);
  assert.ok(firstAlert.currentValue);
  assert.ok(firstAlert.createdAt);
  assert.ok(firstAlert.lastEvaluatedAt);
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
  assert.ok(productResult.enterprisePlatform.globalSearch.indexSize >= 2);
});

test('buildCommandCenterIntelligence surfaces enterprise platform orchestration, audit, and provider readiness', () => {
  const result = buildCommandCenterIntelligence({
    deals: [{ id: 'deal-952', propertyAddress: '952 Goss Rd', status: 'active' }],
    dealIntelligence: [{ id: 'di-952', analysisName: '952 Goss Rd', recommendation: 'Continue Project' }],
    properties: [{ id: 'prop-952', propertyName: '952 Goss Rd', address: '952 Goss Rd', status: 'Active' }],
    portfolioData: [],
    rehabProjects: [{ id: 'rehab-952', propertyName: '952 Goss Rd', projectStatus: 'In Progress' }],
    contractors: [{ id: 'cont-952', contractorName: 'Prime Contractor' }],
    lenders: [{ id: 'lend-952', lenderName: 'Prime Lender' }],
    comps: [{ id: 'comp-952', address: '950 Goss Rd' }],
    neighborhoods: [],
    appraisalPackets: [{ id: 'packet-952', packetName: '952 Packet' }],
    products: [{ id: 'product-952', productName: 'Goss Flooring' }],
    vendors: [{ id: 'vendor-952', vendorName: 'Goss Supply' }],
    documents: [{ id: 'doc-952', fileName: 'goss-contract.pdf' }],
    marketRecords: [{ id: 'market-952', title: 'Goss Submarket' }],
    knowledgeArticles: [{ id: 'knowledge-952', title: '952 Notes' }],
    searchQuery: 'goss',
    auditChanges: [{
      recordId: 'prop-952',
      module: 'Portfolio Dashboard',
      whoChanged: 'Brandon Sterling System Administrator',
      changedFields: ['status'],
      previousValues: { status: 'Watch' },
      newValues: { status: 'Stable' },
    }],
  });

  assert.ok(result.enterprisePlatform.orchestration.summary.totalModules >= 13);
  assert.ok(result.enterprisePlatform.audit.entries.length >= 1);
  assert.equal(result.enterprisePlatform.providerReadinessBlueprint.liveRequestsAllowed, false);
  assert.ok(result.searchResults.some((entry) => entry.type === 'document'));
  assert.ok(result.searchResults.some((entry) => entry.type === 'market-record'));
});

test('buildCommandCenterIntelligence suppresses negative-profit alerts when authoritative projected profit is positive', () => {
  const result = buildCommandCenterIntelligence({
    deals: [{ id: 'deal-1', propertyAddress: '123 Main St', projectedProfit: 25000, status: 'active' }],
    dealIntelligence: [{ id: 'di-1', analysisName: '123 Main St', estimatedProfit: 25000, decision: 'Buy' }],
    properties: [],
    portfolioData: [],
    rehabProjects: [],
    contractors: [],
    lenders: [],
    comps: [],
    neighborhoods: [],
    appraisalPackets: [],
    portfolioIntelligence: {
      alerts: [
        {
          severity: 'HIGH',
          alert: 'Negative projected profit',
          relatedRecord: '123 Main St',
          relatedModule: 'Deal Intelligence',
          status: 'Open',
        },
      ],
    },
  });

  assert.equal(result.alerts.some((alert) => String(alert.alert).toLowerCase().includes('negative projected profit')), false);
});

test('buildCommandCenterIntelligence emits complete Today priorities fields from authoritative priorities', () => {
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
    portfolioIntelligence: {
      priorities: [
        {
          priority: 'Capital Preservation',
          relatedRecord: 'Portfolio',
          action: 'Increase reserve coverage',
          sourceMetric: 'cashReserve.shortfall',
          reason: 'Reserve target is not met',
          completionCondition: 'Reserve shortfall is cleared',
        },
        {
          priority: 'Capital Preservation',
          relatedRecord: 'Portfolio',
          action: 'Increase reserve coverage',
          sourceMetric: 'cashReserve.shortfall',
          reason: 'Duplicate of same priority intent',
          completionCondition: 'Reserve shortfall is cleared',
        },
      ],
    },
  });

  assert.equal(Array.isArray(result.priorities), true);
  assert.equal(result.priorities.length, 1);
  assert.equal(result.priorities[0].relatedRecord, 'Portfolio');
  assert.equal(result.priorities[0].sourceMetric, 'cashReserve.shortfall');
  assert.equal(result.priorities[0].reason, 'Reserve target is not met');
  assert.equal(result.priorities[0].completionCondition, 'Reserve shortfall is cleared');
  assert.equal(result.prioritySummary.source, 'commandCenterIntelligence.buildPriorityHierarchy');
  assert.equal(result.alertSummary.authoritativeEngine, 'commandCenterIntelligence.dedupeAlertRecords');
  assert.ok(Array.isArray(result.authoritativeEngines.recalculationTriggers));
});
