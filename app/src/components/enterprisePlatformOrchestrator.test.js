import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildEnterprisePlatformOrchestrator,
  buildEnterpriseGlobalSearch,
  buildEnterpriseAuditTrail,
  buildProviderReadinessBlueprint,
} from './enterprisePlatformOrchestrator.js';

test('buildEnterpriseGlobalSearch locates records across required enterprise categories', () => {
  const search = buildEnterpriseGlobalSearch({
    query: 'goss',
    deals: [{ id: 'deal-1', propertyAddress: '952 Goss Rd', status: 'active' }],
    properties: [{ id: 'prop-1', propertyName: '952 Goss Rd', status: 'Active' }],
    contractors: [{ id: 'cont-1', contractorName: 'Goss Contractors' }],
    vendors: [{ id: 'vendor-1', vendorName: 'Goss Supply' }],
    products: [{ id: 'product-1', productName: 'Goss Flooring' }],
    lenders: [{ id: 'lender-1', lenderName: 'Goss Capital' }],
    rehabProjects: [{ id: 'rehab-1', propertyName: '952 Goss Rd', projectStatus: 'In Progress' }],
    appraisalPackets: [{ id: 'packet-1', packetName: 'Goss Packet' }],
    knowledgeArticles: [{ id: 'knowledge-1', title: 'Goss Historical Notes' }],
    documents: [{ id: 'doc-1', fileName: 'Goss Permit.pdf', documentType: 'permit' }],
    marketRecords: [{ id: 'market-1', title: 'Goss Submarket', source: 'manual' }],
    comps: [{ id: 'comp-1', address: '952 Goss Rd', source: 'saved' }],
  });

  assert.ok(search.results.some((entry) => entry.type === 'property'));
  assert.ok(search.results.some((entry) => entry.type === 'contractor'));
  assert.ok(search.results.some((entry) => entry.type === 'vendor'));
  assert.ok(search.results.some((entry) => entry.type === 'product'));
  assert.ok(search.results.some((entry) => entry.type === 'lender'));
  assert.ok(search.results.some((entry) => entry.type === 'rehab'));
  assert.ok(search.results.some((entry) => entry.type === 'packet'));
  assert.ok(search.results.some((entry) => entry.type === 'knowledge-article'));
  assert.ok(search.results.some((entry) => entry.type === 'document'));
  assert.ok(search.results.some((entry) => entry.type === 'market-record'));
  assert.ok(search.results.some((entry) => entry.type === 'saved-comp'));
  assert.ok(search.results.some((entry) => entry.type === 'portfolio-asset'));
});

test('buildEnterpriseAuditTrail captures who what when why and rollback support', () => {
  const audit = buildEnterpriseAuditTrail({
    changes: [
      {
        recordId: 'prop-1',
        module: 'Portfolio Dashboard',
        whoChanged: 'Brandon Sterling System Administrator',
        whenChanged: '2026-08-05T00:00:00.000Z',
        whyChanged: 'Manual correction',
        approvalState: 'Approved',
        changedFields: ['status', 'monthlyCashFlow'],
        previousValues: { status: 'Watch', monthlyCashFlow: 200 },
        newValues: { status: 'Stable', monthlyCashFlow: 320 },
      },
    ],
  });

  assert.equal(audit.entries.length, 1);
  assert.equal(audit.entries[0].whoChanged, 'Brandon Sterling System Administrator');
  assert.equal(audit.entries[0].changedFields.length, 2);
  assert.equal(audit.entries[0].rollback.supported, true);
  assert.equal(audit.summary.rollbackReady, true);
});

test('buildProviderReadinessBlueprint includes required provider placeholders with live requests disabled', () => {
  const blueprint = buildProviderReadinessBlueprint();
  const providers = blueprint.providers.map((provider) => provider.provider);

  assert.equal(blueprint.liveRequestsAllowed, false);
  assert.ok(providers.includes('mls'));
  assert.ok(providers.includes('rentcast'));
  assert.ok(providers.includes('attom'));
  assert.ok(providers.includes('corelogic'));
  assert.ok(providers.includes('estated'));
  assert.ok(providers.includes('batchdata'));
  assert.ok(providers.includes('propertyradar'));
  assert.ok(providers.includes('regrid'));
  assert.ok(providers.includes('google-maps'));
  assert.ok(providers.includes('openstreetmap'));
  assert.ok(providers.includes('county-gis'));
  assert.ok(providers.includes('public-records'));
  assert.ok(blueprint.providers.every((provider) => provider.liveRequestsEnabled === false));
});

test('buildEnterprisePlatformOrchestrator returns full enterprise architecture payload', () => {
  const platform = buildEnterprisePlatformOrchestrator({
    searchQuery: '952',
    deals: [{ id: 'deal-1', propertyAddress: '952 Goss Rd', status: 'active' }],
    properties: [{ id: 'prop-1', propertyName: '952 Goss Rd', status: 'Active', currentValue: 300000, currentLoanBalance: 170000, monthlyCashFlow: 600 }],
    contractors: [{ id: 'cont-1', contractorName: 'Alpha' }],
    lenders: [{ id: 'lender-1', lenderName: 'Main Street Capital' }],
    rehabProjects: [{ id: 'rehab-1', propertyName: '952 Goss Rd', projectStatus: 'In Progress' }],
    products: [{ id: 'product-1', productName: 'Tile' }],
    vendors: [{ id: 'vendor-1', vendorName: 'Supply Co' }],
    appraisalPackets: [{ id: 'packet-1', packetName: 'Packet' }],
    knowledgeArticles: [{ id: 'knowledge-1', title: 'ARV Method' }],
    documents: [{ id: 'doc-1', fileName: 'permit.pdf' }],
    marketRecords: [{ id: 'market-1', title: 'Covington Market' }],
    comps: [{ id: 'comp-1', address: '950 Goss Rd' }],
    auditChanges: [{ recordId: 'prop-1', changedFields: ['status'], previousValues: { status: 'Watch' }, newValues: { status: 'Stable' } }],
    moduleStatus: {
      Acquisition: { status: 'Ready', records: 1 },
      'Comparable Sales': { status: 'Ready', records: 1 },
      ARV: { status: 'Ready', records: 1 },
      Portfolio: { status: 'Ready', records: 1 },
      Rehab: { status: 'Ready', records: 1 },
      Contractors: { status: 'Ready', records: 1 },
      Lenders: { status: 'Ready', records: 1 },
      Capital: { status: 'Ready', records: 1 },
      Risk: { status: 'Ready', records: 1 },
      'Knowledge Base': { status: 'Ready', records: 1 },
      'Vendor Purchasing': { status: 'Ready', records: 2 },
      Forecasting: { status: 'Ready', records: 1 },
      'Executive Dashboards': { status: 'Ready', records: 1 },
    },
    providerReadiness: [{ provider: 'rentcast', configured: false }],
    backgroundJobs: [{ id: 'job-1', status: 'running' }],
    securityHealth: { status: 'Hardened' },
    portfolioSummary: { totalProperties: 1, totalCurrentValue: 300000, totalOutstandingDebt: 170000, totalMonthlyCashFlow: 600, healthScore: 82 },
    riskSummary: { portfolioRiskScore: 32 },
    rehabSummary: { activeProjects: 1, delayedProjects: 0 },
  });

  assert.equal(platform.orchestration.summary.totalModules, 13);
  assert.ok(Array.isArray(platform.globalSearch.results));
  assert.equal(platform.audit.summary.rollbackReady, true);
  assert.ok(platform.systemHealth.moduleHealth.total >= 0);
  assert.ok(platform.reports.executivePortfolioReport.exportReady);
  assert.ok(platform.media.supportedTypes.includes('photos'));
  assert.ok(platform.performance.largePortfolioReadiness.supported);
});
