import test from 'node:test';
import assert from 'node:assert/strict';
import { buildLiveEnterpriseDashboardModel } from './liveEnterpriseIntelligence.js';

test('buildLiveEnterpriseDashboardModel surfaces calculated dashboard values from live data', () => {
  const model = buildLiveEnterpriseDashboardModel({
    deals: [
      {
        id: 'deal-1',
        propertyAddress: '123 Main St',
        purchasePrice: 180000,
        rehabBudget: 40000,
        estimatedArv: 280000,
        status: 'active',
        strategy: 'Flip',
      },
    ],
    properties: [
      {
        id: 'prop-1',
        propertyName: '123 Main St',
        currentValue: 280000,
        currentLoanBalance: 140000,
        monthlyCashFlow: 1200,
        strategy: 'Flip',
      },
    ],
    rehabProjects: [
      {
        id: 'rehab-1',
        propertyName: '123 Main St',
        projectStatus: 'In Progress',
        remainingBudget: 30000,
        percentComplete: 40,
        originalRehabBudget: 40000,
        actualCost: 25000,
      },
    ],
    contractors: [{ id: 'cont-1', contractorName: 'Ace Builders', insuranceStatus: 'Active', licenseStatus: 'Active' }],
    lenders: [{ id: 'lender-1', lenderName: 'Sunshine', activeStatus: 'Active' }],
    portfolioEntries: [{ id: 'portfolio-1', propertyName: '123 Main St' }],
    dealIntelligence: [{
      id: 'deal-1',
      dealScore: 74,
      riskProfile: { overallRiskScore: 34, overallRiskLabel: 'Moderate' },
      investmentDecision: { recommendation: 'Buy' },
    }],
    backendHealth: { healthy: true, status: 'ok', timestamp: '2026-08-03T00:00:00.000Z' },
    operationsPayload: {
      workflow: { status: 'Healthy', currentStage: 'Active' },
      recoveries: [{ id: 'recovery-1' }],
      monitoring: { backendStatus: 'Healthy' },
      alerts: [{ title: 'Live alert', severity: 'HIGH' }],
    },
    version: '1.0.0',
  });

  assert.equal(model.topMetrics[0].title, 'ACTIVE DEALS');
  assert.equal(model.topMetrics[0].value, '1');
  assert.equal(model.intelligenceCards[0].label, 'BUSINESS STATUS');
  assert.equal(model.intelligenceCards[1].label, 'SYSTEM PORTFOLIO HEALTH');
  assert.equal(model.summaryStats.totalActiveDeals, 1);
  assert.equal(model.summaryStats.rehabProjectsInFlight, 1);
  assert.equal(model.summaryStats.totalAlertCount, 1);
  assert.ok(model.commandCenterIntelligence.alerts.length >= 0);
  assert.ok(model.enterprisePlatform);
  assert.ok(model.enterprisePlatform.orchestration.summary.totalModules >= 13);
  assert.equal(model.riskSummary.averageRiskScore, 34);
  assert.equal(model.riskSummary.highestRiskScore, 34);
  assert.ok(model.intelligenceCards.some((card) => String(card.value).includes('34/100')));
  assert.ok(model.traceability?.capitalEfficiency?.formula);
  assert.ok(model.traceability?.riskExposure?.formula);
});

test('buildLiveEnterpriseDashboardModel exposes shared underwriting decisions and financing fields', () => {
  const model = buildLiveEnterpriseDashboardModel({
    deals: [{
      id: 'deal-goss',
      propertyAddress: '952 Goss Rd',
      purchasePrice: '135000',
      rehabBudget: '60000',
      estimatedArv: '300000',
      annualTaxes: '2800',
      annualInsurance: '1200',
      holdingMonths: '4',
      actualLoanAmount: '182330',
      annualInterestRate: '11.24',
      cashToClose: '26857.90',
      earnestMoney: '3500',
      totalInitialCashInvested: '30357.90',
      constructionHoldback: '62990',
      exitStrategy: 'Flip',
      sellingCostPercent: '8',
      sellerConcessions: '0',
      fixedSaleCosts: '0',
      paymentType: 'Interest Only',
      status: 'Active Project',
    }],
    properties: [],
    rehabProjects: [],
    contractors: [],
    lenders: [],
    portfolioEntries: [],
    dealIntelligence: [],
    backendHealth: { healthy: true },
    operationsPayload: { workflow: {}, recoveries: [], monitoring: {}, alerts: [] },
    version: '1.0.0',
  });

  const deal = model.dealIntelligence[0];
  assert.equal(deal.decision, 'Continue Project');
  assert.equal(deal.recommendation, 'Continue Project');
  assert.equal(deal.actualLoanAmount, 182330);
  assert.ok(Math.abs(deal.monthlyCarry - 1769.52) < 1);
  assert.ok(Math.abs(deal.initialCashInvested - 30357.90) < 0.01);
});

test('buildLiveEnterpriseDashboardModel exposes portfolio intelligence summary cards', () => {
  const model = buildLiveEnterpriseDashboardModel({
    deals: [],
    properties: [
      {
        id: 'prop-2',
        propertyName: 'Portfolio Sample',
        currentValue: 260000,
        currentLoanBalance: 180000,
        monthlyCashFlow: 800,
        strategy: 'BRRRR',
        city: 'Austin',
        zipCode: '78701',
        refinanceCandidate: true,
      },
    ],
    rehabProjects: [],
    contractors: [],
    lenders: [],
    portfolioEntries: [],
    dealIntelligence: [],
    backendHealth: { healthy: true },
    operationsPayload: { workflow: {}, recoveries: [], monitoring: {}, alerts: [] },
    version: '1.0.0',
  });

  assert.ok(model.portfolioOverview);
  assert.ok(Number.isFinite(model.portfolioOverview.healthScore));
  assert.ok(Number.isFinite(model.portfolioOverview.portfolioRiskScore));
  assert.ok(model.portfolioOverview.executiveSummaryCards.some((card) => card.label === 'Liquidity'));
  assert.ok(Array.isArray(model.portfolioOverview.capitalAllocation));
  assert.ok(model.portfolioOverview.cashReserve);
  assert.ok(Array.isArray(model.portfolioOverview.liquidityForecast));
  assert.ok(model.portfolioOverview.exposureAnalysis);
  assert.ok(model.portfolioOverview.strategyAllocation.rentalShare >= 0 || model.portfolioOverview.strategyAllocation.flipShare >= 0);
  assert.ok(model.portfolioOverview.concentrationRisk);
  assert.ok(Array.isArray(model.portfolioOverview.refinanceOpportunities));
  assert.ok(model.portfolioOverview.executiveSummary);
  assert.ok(model.enterprisePlatform.systemHealth);
});

test('buildLiveEnterpriseDashboardModel includes 30-day forecast composition and no-double-count proof', () => {
  const model = buildLiveEnterpriseDashboardModel({
    deals: [{
      id: 'deal-forecast-1',
      propertyAddress: '22 Cedar Ave',
      purchasePrice: 150000,
      estimatedArv: 210000,
      status: 'active',
    }],
    properties: [{
      id: 'prop-forecast-1',
      propertyName: '22 Cedar Ave',
      currentValue: 205000,
      status: 'Active',
    }],
    rehabProjects: [],
    contractors: [],
    lenders: [],
    portfolioEntries: [],
    dealIntelligence: [],
    backendHealth: { healthy: true },
    operationsPayload: { workflow: {}, recoveries: [], monitoring: {}, alerts: [] },
    version: '1.0.0',
  });

  const composition = model.traceability?.forecast30Day?.composition || [];
  assert.ok(Array.isArray(composition));
  assert.ok(composition.some((entry) => entry.recordType === 'property value'));
  assert.ok(composition.some((entry) => entry.recordType === 'pipeline opportunity' && entry.exclusionReason.includes('double counting')));
  assert.ok(String(model.traceability?.forecast30Day?.noDoubleCountProof || '').toLowerCase().includes('double count'));
  assert.ok(model.traceability?.forecast30Day?.scenarios?.base);
  assert.ok(model.traceability?.forecast30Day?.scenarios?.best);
  assert.ok(model.traceability?.forecast30Day?.scenarios?.worst);
  assert.ok(Object.prototype.hasOwnProperty.call(model.traceability?.forecast30Day?.scenarioInputs || {}, 'unresolvedAlerts'));
  assert.ok(Object.prototype.hasOwnProperty.call(model.traceability?.forecast30Day?.scenarioInputs || {}, 'inFlightRehab'));
});

test('buildLiveEnterpriseDashboardModel exposes KPI metric traceability records with formulas and thresholds', () => {
  const model = buildLiveEnterpriseDashboardModel({
    deals: [{ id: 'deal-t1', propertyAddress: '44 Oak Dr', purchasePrice: 100000, estimatedArv: 160000, status: 'active' }],
    properties: [{ id: 'prop-t1', propertyName: '44 Oak Dr', currentValue: 155000, currentLoanBalance: 80000, monthlyCashFlow: 500, strategy: 'Flip' }],
    rehabProjects: [],
    contractors: [],
    lenders: [{ id: 'lender-t1', lenderName: 'First Capital', activeStatus: 'Active' }],
    portfolioEntries: [],
    dealIntelligence: [],
    backendHealth: { healthy: true, status: 'ok' },
    operationsPayload: { workflow: {}, recoveries: [], monitoring: {}, alerts: [] },
    version: '1.0.0',
  });

  const metricTraceability = model.traceability?.metricTraceability || {};
  const required = [
    'capitalEfficiency',
    'riskExposure',
    'liveRiskScore',
    'riskLevel',
    'investmentPortfolioHealth',
    'portfolioRisk',
    'automationStatus',
  ];

  required.forEach((key) => {
    assert.ok(metricTraceability[key]);
    assert.ok(String(metricTraceability[key].formula || '').length > 0);
    assert.ok(metricTraceability[key].thresholds && typeof metricTraceability[key].thresholds === 'object');
    assert.ok(Array.isArray(metricTraceability[key].sourceRecords));
    assert.ok(Object.prototype.hasOwnProperty.call(metricTraceability[key], 'lastCalculationTime'));
  });
});

test('buildLiveEnterpriseDashboardModel keeps 30-day forecast composition keys unique for canonical records', () => {
  const model = buildLiveEnterpriseDashboardModel({
    deals: [
      { id: 'deal-link-1', propertyAddress: '99 Pine St', purchasePrice: 120000, estimatedArv: 180000, status: 'active' },
      { id: 'deal-link-2', propertyAddress: '77 Elm St', purchasePrice: 115000, estimatedArv: 170000, status: 'active' },
    ],
    properties: [
      { id: 'prop-link-1', propertyName: '99 Pine St', currentValue: 176000, currentLoanBalance: 90000, monthlyCashFlow: 600, strategy: 'Flip' },
      { id: 'prop-link-2', propertyName: '77 Elm St', currentValue: 168000, currentLoanBalance: 86000, monthlyCashFlow: 550, strategy: 'Flip' },
    ],
    rehabProjects: [],
    contractors: [],
    lenders: [],
    portfolioEntries: [],
    dealIntelligence: [],
    backendHealth: { healthy: true, status: 'ok' },
    operationsPayload: { workflow: {}, recoveries: [], monitoring: {}, alerts: [] },
    version: '1.0.0',
  });

  const composition = model.traceability?.forecast30Day?.composition || [];
  const keys = composition.map((entry) => entry.recordKey);
  assert.equal(keys.length, new Set(keys).size);
});
