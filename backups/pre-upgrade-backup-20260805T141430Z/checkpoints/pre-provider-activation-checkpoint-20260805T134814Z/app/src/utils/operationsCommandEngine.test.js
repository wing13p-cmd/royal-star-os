import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildOperationsEventEngine,
  buildOperationsAlerts,
  buildNextBestActions,
  buildReunderwritingTriggers,
  buildProjectCheckpoints,
  buildDrawControls,
  buildCapitalForecast,
  buildAlertResolutionAudit,
} from './operationsCommandEngine.js';

test('buildOperationsEventEngine creates normalized operational events from saved data', () => {
  const result = buildOperationsEventEngine({
    deals: [{ id: 'deal-1', propertyAddress: '952 Goss Rd', purchasePrice: 135000, rehabBudget: 60000, estimatedArv: 300000, financingCosts: 85575.568, status: 'active' }],
    rehabProjects: [{ id: 'project-1', projectName: '952 Goss Rd', budget: 60000, actualCost: 65000, projectStatus: 'In Progress', contractorStatus: 'Active', inspectionStatus: 'Pending' }],
    contractors: [{ id: 'contractor-1', contractorName: 'Blue Sky', insuranceExpiry: '2026-01-01', status: 'Watchlist' }],
    lenders: [{ id: 'lender-1', lenderName: 'Northstar', maturityDate: '2026-09-01' }],
    portfolioEntries: [{ id: 'portfolio-1', propertyName: '952 Goss Rd', currentValue: 300000 }],
  });

  assert.ok(result.events.length >= 3);
  const categories = new Set(result.events.map((event) => event.category));
  assert.ok(categories.has('Financing'));
  assert.ok(categories.has('Rehab'));
  assert.ok(categories.has('Contractor'));
  const event = result.events.find((entry) => entry.category === 'Financing');
  assert.equal(event.severity, 'Warning');
  assert.equal(event.status, 'Open');
});

test('buildOperationsAlerts applies financial and data-quality rules without fabricating dates', () => {
  const alerts = buildOperationsAlerts({
    deals: [{ id: 'deal-1', propertyAddress: '952 Goss Rd', purchasePrice: 135000, rehabBudget: 60000, estimatedArv: 300000, financingCosts: 85575.568, status: 'active' }],
    rehabProjects: [{ id: 'project-1', projectName: '952 Goss Rd', budget: 60000, actualCost: 65000, projectStatus: 'In Progress' }],
    contractors: [{ id: 'contractor-1', contractorName: 'Blue Sky', status: 'Watchlist' }],
    lenders: [{ id: 'lender-1', lenderName: 'Northstar', maturityDate: '2026-09-01' }],
    portfolioEntries: [{ id: 'portfolio-1', propertyName: '952 Goss Rd', currentValue: 300000 }],
  });

  assert.ok(alerts.some((alert) => alert.title.includes('Rehab')));
  assert.ok(alerts.some((alert) => alert.category === 'Financing'));
  assert.ok(alerts.every((alert) => alert.severity && alert.status));
});

test('buildNextBestActions chooses the highest-priority action for owned projects using stored facts', () => {
  const actions = buildNextBestActions({
    rehabProjects: [{ id: 'project-1', projectName: '952 Goss Rd', projectStatus: 'In Progress', inspectionStatus: 'Failed', lienWaiverStatus: 'Missing', contractorStatus: 'Active' }],
    deals: [{ id: 'deal-1', isOwned: true, propertyAddress: '952 Goss Rd' }],
  });

  assert.equal(actions.length, 1);
  assert.equal(actions[0].projectStage, 'In Progress');
  assert.ok(actions[0].nextAction.includes('inspection') || actions[0].nextAction.includes('waiver'));
});

test('buildReunderwritingTriggers records before-and-after variance details', () => {
  const triggers = buildReunderwritingTriggers({
    currentDeal: { id: 'deal-1', propertyAddress: '952 Goss Rd', rehabBudget: 60000, financingCosts: 85575.568, estimatedArv: 300000 },
    previousDeal: { id: 'deal-1', propertyAddress: '952 Goss Rd', rehabBudget: 55000, financingCosts: 78000, estimatedArv: 290000 },
  });

  assert.ok(triggers.some((trigger) => trigger.triggerSource === 'rehabBudget'));
  assert.ok(triggers.some((trigger) => trigger.triggerSource === 'financingCosts'));
  assert.equal(triggers[0].reUnderwritingStatus, 'Pending');
});

test('buildProjectCheckpoints returns the required checkpoint sequence with evidence and blockers', () => {
  const checkpoints = buildProjectCheckpoints({
    rehabProject: { id: 'project-1', projectName: '952 Goss Rd', acquisitionComplete: true, scopeConfirmed: true, budgetConfirmed: true, contractorContractsComplete: true, permitsReady: false },
  });

  const acquisition = checkpoints.find((entry) => entry.checkpoint === 'Acquisition Complete');
  assert.equal(acquisition.status, 'Complete');
  const permits = checkpoints.find((entry) => entry.checkpoint === 'Permits Ready');
  assert.equal(permits.status, 'Blocked');
  assert.ok(permits.blockingRequirement);
});

test('buildDrawControls flags duplicate and over-limit draws without inventing history', () => {
  const result = buildDrawControls({
    project: { id: 'project-1', budget: 100000, committedCost: 25000, draws: [{ drawNumber: 1, requestedAmount: 15000, approvedAmount: 15000, fundedAmount: 15000, coveredWork: 'Demo', inspectionStatus: 'Approved' }, { drawNumber: 2, requestedAmount: 15000, approvedAmount: 15000, fundedAmount: 15000, coveredWork: 'Demo', inspectionStatus: 'Approved' }, { drawNumber: 3, requestedAmount: 90000, approvedAmount: 90000, fundedAmount: 90000, coveredWork: 'Demo', inspectionStatus: 'Approved' }] },
    lender: { holdbackAmount: 20000 },
  });

  assert.ok(result.flags.some((flag) => flag.includes('duplicate')));
  assert.ok(result.flags.some((flag) => flag.includes('remaining eligible budget')));
  assert.equal(result.remainingRehabExposure, 0);
});

test('buildCapitalForecast calculates capital exposure without counting loan proceeds as revenue', () => {
  const forecast = buildCapitalForecast({
    deals: [{ id: 'deal-1', purchasePrice: 135000, rehabBudget: 60000, financingCosts: 85575.568, estimatedArv: 300000 }],
    rehabProjects: [{ id: 'project-1', budget: 60000, committedCost: 60000, fundedAmount: 30000 }],
    portfolioEntries: [{ id: 'portfolio-1', currentValue: 300000, debt: 180000 }],
  });

  assert.ok(forecast.projectedCapitalShortfall >= 0);
  assert.equal(forecast.currentCashDeployed, 135000 + 60000);
  assert.equal(forecast.cashTrappedInActiveProjects, 30000);
});

test('buildAlertResolutionAudit keeps an append-only history of resolution changes', () => {
  const history = buildAlertResolutionAudit({
    originalAlert: { id: 'alert-1', title: 'Budget overrun', sourceValues: { rehabBudget: 60000, actualCost: 65000 } },
    resolution: { action: 'Dismissed', note: 'Scope confirmed', resolvedBy: 'User', resolvedDate: '2026-08-01', changedFields: ['rehabBudget'], resultingUnderwritingEffect: 'No change', resultingRiskEffect: 'Lower' },
  });

  assert.equal(history.length, 1);
  assert.equal(history[0].originalAlert.id, 'alert-1');
  assert.equal(history[0].resolution.action, 'Dismissed');
});
