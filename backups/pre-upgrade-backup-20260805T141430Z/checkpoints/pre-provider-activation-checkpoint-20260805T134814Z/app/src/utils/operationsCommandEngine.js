function safeNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function safeString(value, fallback = 'Insufficient Data') {
  if (value === null || value === undefined || value === '') return fallback;
  return typeof value === 'string' ? value : String(value);
}

function normalizeArray(values) {
  return Array.isArray(values) ? values : [];
}

function formatCurrency(value) {
  return `$${safeNumber(value, 0).toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
}

function resolveSeverity(override, fallback) {
  const severity = safeString(override, '').toLowerCase();
  if (severity === 'critical' || severity === 'warning' || severity === 'monitor' || severity === 'informational') return severity.charAt(0).toUpperCase() + severity.slice(1);
  return fallback;
}

function buildBaseEvent({ category, title, description, sourceModule, sourceField, detectedDate, status = 'Open', severity = 'Monitor', responsibleParty = 'Unassigned', dueStatus = 'Not Scheduled', requiredAction = 'Review the latest data', resolutionNote = 'Pending', resolvedDate = 'Unknown', escalationLevel = 'Standard', relatedFinancialExposure = 0, relatedDecisionBlocker = 'Insufficient Data', dealOrProjectId = 'Unknown' }) {
  return {
    eventId: `event-${Math.random().toString(36).slice(2, 10)}`,
    dealOrProjectId: safeString(dealOrProjectId, 'Unknown'),
    category: safeString(category, 'System'),
    severity: resolveSeverity(severity, 'Monitor'),
    title: safeString(title, 'Operational event'),
    description: safeString(description, 'Operational review required.'),
    sourceModule: safeString(sourceModule, 'RSOS'),
    sourceField: safeString(sourceField, 'Unknown'),
    detectedDate: safeString(detectedDate, 'Unknown'),
    status: safeString(status, 'Open'),
    responsibleParty: safeString(responsibleParty, 'Unassigned'),
    dueStatus: safeString(dueStatus, 'Not Scheduled'),
    requiredAction: safeString(requiredAction, 'Review the latest data'),
    resolutionNote: safeString(resolutionNote, 'Pending'),
    resolvedDate: safeString(resolvedDate, 'Unknown'),
    escalationLevel: safeString(escalationLevel, 'Standard'),
    relatedFinancialExposure: safeNumber(relatedFinancialExposure, 0),
    relatedDecisionBlocker: safeString(relatedDecisionBlocker, 'Insufficient Data'),
  };
}

export function buildOperationsEventEngine({ deals = [], rehabProjects = [], contractors = [], lenders = [], portfolioEntries = [] } = {}) {
  const events = [];
  const normalizedDeals = normalizeArray(deals);
  const normalizedProjects = normalizeArray(rehabProjects);
  const normalizedContractors = normalizeArray(contractors);
  const normalizedLenders = normalizeArray(lenders);
  const normalizedPortfolio = normalizeArray(portfolioEntries);

  normalizedDeals.forEach((deal) => {
    const financingCost = safeNumber(deal.financingCosts || deal.effectiveFinancingCost || deal.effectiveFinancingCosts, 0);
    if (financingCost > 0) {
      events.push(buildBaseEvent({
        category: 'Financing',
        title: `Financing cost persisted for ${safeString(deal.propertyAddress || deal.address, 'deal')}`,
        description: `Stored financing cost ${formatCurrency(financingCost)} remains on the saved deal.`,
        sourceModule: 'Deal Intelligence',
        sourceField: 'financingCosts',
        detectedDate: safeString(deal.updatedAt || deal.createdAt || 'Unknown', 'Unknown'),
        severity: 'Warning',
        responsibleParty: 'Unassigned',
        requiredAction: 'Confirm financing remains aligned with the current loan terms.',
        relatedFinancialExposure: financingCost,
        relatedDecisionBlocker: 'Financing cost is active in underwriting.',
        dealOrProjectId: deal.id,
      }));
    }

    if (safeNumber(deal.rehabBudget, 0) > 0 && safeNumber(deal.purchasePrice, 0) > 0) {
      events.push(buildBaseEvent({
        category: 'Deal',
        title: `Deal economics require review for ${safeString(deal.propertyAddress || deal.address, 'deal')}`,
        description: 'The saved deal has a meaningful rehab budget that should be monitored against the live underwriting assumptions.',
        sourceModule: 'Deal Analyzer',
        sourceField: 'rehabBudget',
        detectedDate: safeString(deal.updatedAt || 'Unknown', 'Unknown'),
        severity: 'Monitor',
        requiredAction: 'Re-underwrite when assumptions change.',
        relatedFinancialExposure: safeNumber(deal.rehabBudget, 0),
        relatedDecisionBlocker: 'Budget assumptions can change the decision.',
        dealOrProjectId: deal.id,
      }));
    }
  });

  normalizedProjects.forEach((project) => {
    const actualCost = safeNumber(project.actualCost || project.actualRehabCost, 0);
    const budget = safeNumber(project.budget || project.rehabBudget, 0);
    if (budget > 0 && actualCost > budget) {
      events.push(buildBaseEvent({
        category: 'Rehab',
        title: `Rehab budget overrun for ${safeString(project.projectName || project.name, 'project')}`,
        description: `Actual cost ${formatCurrency(actualCost)} exceeds the current budget ${formatCurrency(budget)}.`,
        sourceModule: 'Rehab Project Tracker',
        sourceField: 'actualCost',
        detectedDate: safeString(project.updatedAt || 'Unknown', 'Unknown'),
        severity: 'Critical',
        requiredAction: 'Approve change control or confirm contingency.',
        relatedFinancialExposure: actualCost - budget,
        relatedDecisionBlocker: 'Budget overrun threatens the deal.',
        dealOrProjectId: project.id,
      }));
    }

    if (safeString(project.inspectionStatus, '').toLowerCase() === 'failed') {
      events.push(buildBaseEvent({
        category: 'Inspection',
        title: `Inspection failed for ${safeString(project.projectName || project.name, 'project')}`,
        description: 'The project requires immediate inspection follow-up before continuing to the next milestone.',
        sourceModule: 'Rehab Project Tracker',
        sourceField: 'inspectionStatus',
        detectedDate: safeString(project.updatedAt || 'Unknown', 'Unknown'),
        severity: 'Critical',
        requiredAction: 'Resolve the failed inspection before advancing the checkpoint.',
        relatedDecisionBlocker: 'Inspection failure blocks progress.',
        dealOrProjectId: project.id,
      }));
    }
  });

  normalizedContractors.forEach((contractor) => {
    if (safeString(contractor.status, '').toLowerCase() === 'watchlist' || safeString(contractor.status, '').toLowerCase() === 'do not use') {
      events.push(buildBaseEvent({
        category: 'Contractor',
        title: `${safeString(contractor.contractorName || contractor.companyName, 'Contractor')} requires closer oversight`,
        description: 'The contractor status is on a restricted list and should be reviewed before additional spend.',
        sourceModule: 'Contractor Hub',
        sourceField: 'status',
        detectedDate: safeString(contractor.updatedAt || 'Unknown', 'Unknown'),
        severity: 'Warning',
        requiredAction: 'Confirm active work scope and contractor controls.',
        relatedDecisionBlocker: 'Restricted contractor status can affect delivery.',
        dealOrProjectId: contractor.id,
      }));
    }
  });

  normalizedLenders.forEach((lender) => {
    if (safeString(lender.maturityDate, '').trim() !== 'Unknown' && safeString(lender.maturityDate, '').trim() !== 'Insufficient Data') {
      events.push(buildBaseEvent({
        category: 'Financing',
        title: `Financing maturity approaching for ${safeString(lender.lenderName || lender.name, 'lender')}`,
        description: 'A financing maturity date exists and should be tracked for refinance or extension planning.',
        sourceModule: 'Lender Dashboard',
        sourceField: 'maturityDate',
        detectedDate: safeString(lender.updatedAt || 'Unknown', 'Unknown'),
        severity: 'Monitor',
        requiredAction: 'Start refinance or extension planning well before maturity.',
        relatedDecisionBlocker: 'Maturity risk can force a refinance decision.',
        dealOrProjectId: lender.id,
      }));
    }
  });

  normalizedPortfolio.forEach((entry) => {
    if (safeNumber(entry.currentValue, 0) > 0) {
      events.push(buildBaseEvent({
        category: 'Portfolio',
        title: `Portfolio exposure tracked for ${safeString(entry.propertyName || entry.address, 'portfolio record')}`,
        description: 'The portfolio entry is active and should be monitored for liquidity or exposure changes.',
        sourceModule: 'Portfolio Dashboard',
        sourceField: 'currentValue',
        detectedDate: safeString(entry.updatedAt || 'Unknown', 'Unknown'),
        severity: 'Informational',
        requiredAction: 'Review the latest portfolio exposure and reserve posture.',
        relatedFinancialExposure: safeNumber(entry.currentValue, 0),
        relatedDecisionBlocker: 'Portfolio exposure affects capital decisions.',
        dealOrProjectId: entry.id,
      }));
    }
  });

  return { events };
}

export function buildOperationsAlerts({ deals = [], rehabProjects = [], contractors = [], lenders = [], portfolioEntries = [] } = {}) {
  const alerts = [];
  const normalizedDeals = normalizeArray(deals);
  const normalizedProjects = normalizeArray(rehabProjects);
  const normalizedContractors = normalizeArray(contractors);
  const normalizedLenders = normalizeArray(lenders);
  const normalizedPortfolio = normalizeArray(portfolioEntries);

  normalizedDeals.forEach((deal) => {
    const financingCost = safeNumber(deal.financingCosts || deal.effectiveFinancingCost || deal.effectiveFinancingCosts, 0);
    if (financingCost > 0) {
      alerts.push({ id: `alert-${Math.random().toString(36).slice(2, 10)}`, category: 'Financing', severity: 'Warning', status: 'Open', title: `Financing cost requires review for ${safeString(deal.propertyAddress || deal.address, 'deal')}`, description: `The saved financing value is ${formatCurrency(financingCost)}.`, sourceModule: 'Deal Intelligence', sourceField: 'financingCosts', relatedFinancialExposure: financingCost, dueStatus: 'Not Scheduled' });
    }
    if (safeNumber(deal.rehabBudget, 0) > 0 && safeNumber(deal.purchasePrice, 0) > 0) {
      alerts.push({ id: `alert-${Math.random().toString(36).slice(2, 10)}`, category: 'Data Quality', severity: 'Monitor', status: 'Open', title: `Underwriting assumptions should be rechecked for ${safeString(deal.propertyAddress || deal.address, 'deal')}`, description: 'The current saved deal still needs a fresh underwriting pass when the scope changes.', sourceModule: 'Deal Analyzer', sourceField: 'rehabBudget', relatedFinancialExposure: safeNumber(deal.rehabBudget, 0), dueStatus: 'Not Scheduled' });
    }
  });

  normalizedProjects.forEach((project) => {
    const actualCost = safeNumber(project.actualCost || project.actualRehabCost, 0);
    const budget = safeNumber(project.budget || project.rehabBudget, 0);
    if (budget > 0 && actualCost > budget) {
      alerts.push({ id: `alert-${Math.random().toString(36).slice(2, 10)}`, category: 'Rehab', severity: 'Critical', status: 'Open', title: `Rehab overrun for ${safeString(project.projectName || project.name, 'project')}`, description: `Actual spend ${formatCurrency(actualCost)} exceeds budget ${formatCurrency(budget)}.`, sourceModule: 'Rehab Project Tracker', sourceField: 'actualCost', relatedFinancialExposure: actualCost - budget, dueStatus: 'Not Scheduled' });
    }
    if (safeString(project.inspectionStatus, '').toLowerCase() === 'failed') {
      alerts.push({ id: `alert-${Math.random().toString(36).slice(2, 10)}`, category: 'Inspection', severity: 'Critical', status: 'Open', title: `Inspection failed for ${safeString(project.projectName || project.name, 'project')}`, description: 'The project cannot advance until the inspection issue is resolved.', sourceModule: 'Rehab Project Tracker', sourceField: 'inspectionStatus', relatedFinancialExposure: 0, dueStatus: 'Not Scheduled' });
    }
  });

  normalizedContractors.forEach((contractor) => {
    if (safeString(contractor.status, '').toLowerCase() === 'watchlist' || safeString(contractor.status, '').toLowerCase() === 'do not use') {
      alerts.push({ id: `alert-${Math.random().toString(36).slice(2, 10)}`, category: 'Contractor', severity: 'Warning', status: 'Open', title: `${safeString(contractor.contractorName || contractor.companyName, 'Contractor')} status requires review`, description: 'The contractor status is restricted and should be monitored closely.', sourceModule: 'Contractor Hub', sourceField: 'status', relatedFinancialExposure: 0, dueStatus: 'Not Scheduled' });
    }
  });

  normalizedLenders.forEach((lender) => {
    if (safeString(lender.maturityDate, '').trim() !== 'Unknown' && safeString(lender.maturityDate, '').trim() !== 'Insufficient Data') {
      alerts.push({ id: `alert-${Math.random().toString(36).slice(2, 10)}`, category: 'Financing', severity: 'Monitor', status: 'Open', title: `Financing maturity for ${safeString(lender.lenderName || lender.name, 'lender')}`, description: 'A financing maturity date is present and should be tracked.', sourceModule: 'Lender Dashboard', sourceField: 'maturityDate', relatedFinancialExposure: 0, dueStatus: 'Not Scheduled' });
    }
  });

  normalizedPortfolio.forEach((entry) => {
    if (safeNumber(entry.currentValue, 0) > 0) {
      alerts.push({ id: `alert-${Math.random().toString(36).slice(2, 10)}`, category: 'Portfolio', severity: 'Informational', status: 'Open', title: `Portfolio exposure tracked for ${safeString(entry.propertyName || entry.address, 'portfolio record')}`, description: 'Portfolio exposure is being monitored against current liquidity.', sourceModule: 'Portfolio Dashboard', sourceField: 'currentValue', relatedFinancialExposure: safeNumber(entry.currentValue, 0), dueStatus: 'Not Scheduled' });
    }
  });

  return alerts;
}

export function buildNextBestActions({ rehabProjects = [], deals = [] } = {}) {
  const normalizedProjects = normalizeArray(rehabProjects);
  const normalizedDeals = normalizeArray(deals);
  const ownedProject = normalizedProjects.find((project) => safeString(project.projectStatus, '').toLowerCase() === 'in progress' || safeString(project.projectStatus, '').toLowerCase() === 'active');
  if (!ownedProject) return [];

  const projectName = safeString(ownedProject.projectName || ownedProject.name, 'Unknown Project');
  const inspectionStatus = safeString(ownedProject.inspectionStatus, 'Insufficient Data');
  const lienWaiverStatus = safeString(ownedProject.lienWaiverStatus, 'Insufficient Data');
  const isOwned = normalizedDeals.some((deal) => String(deal.id || '').toLowerCase() === String(ownedProject.id || '').toLowerCase() || safeString(deal.propertyAddress || deal.address, '').toLowerCase().includes(projectName.toLowerCase()));

  let nextAction = 'Confirm the current project status and any missing documentation before advancing.';
  let severity = 'Monitor';
  let decisionBlocker = 'Insufficient Data';
  let financialExposure = 0;
  let prerequisite = 'Saved project data must include the current inspection and document status.';

  if (inspectionStatus.toLowerCase() === 'failed') {
    nextAction = `Resolve the failed inspection for ${projectName}.`;
    severity = 'Critical';
    decisionBlocker = 'Inspection is failing and blocks the next milestone.';
    financialExposure = safeNumber(ownedProject.budget || ownedProject.rehabBudget, 0);
    prerequisite = 'Inspection report and corrective plan are required.';
  } else if (lienWaiverStatus.toLowerCase() === 'missing') {
    nextAction = `Collect the missing lien waivers for ${projectName}.`;
    severity = 'Warning';
    decisionBlocker = 'Lien waiver status is incomplete.';
    financialExposure = safeNumber(ownedProject.budget || ownedProject.rehabBudget, 0);
    prerequisite = 'Lien waiver status and supporting documents are required.';
  } else if (isOwned) {
    nextAction = `Review the current rehab progress and next checkpoint for ${projectName}.`;
    severity = 'Monitor';
    decisionBlocker = 'Project progress and checkpoint evidence are incomplete.';
    financialExposure = safeNumber(ownedProject.budget || ownedProject.rehabBudget, 0);
    prerequisite = 'Current project status and checkpoint evidence are required.';
  }

  return [{
    nextAction,
    whyItMatters: 'This action protects the current project from avoidable delay or legal exposure.',
    severity,
    projectStage: safeString(ownedProject.projectStatus, 'In Progress'),
    actionCategory: 'Operations',
    responsibleParty: 'Unassigned',
    dueStatus: 'Not Scheduled',
    prerequisite,
    financialExposure,
    decisionBlocker,
    expectedResult: 'The project advances with a clear next milestone.',
    nextCheckpoint: 'Review the next required checkpoint.',
  }];
}

export function buildReunderwritingTriggers({ currentDeal = {}, previousDeal = {} } = {}) {
  const triggers = [];
  const current = currentDeal || {};
  const previous = previousDeal || {};
  const comparisons = [
    ['rehabBudget', current.rehabBudget, previous.rehabBudget],
    ['financingCosts', current.financingCosts, previous.financingCosts],
    ['estimatedArv', current.estimatedArv, previous.estimatedArv],
    ['loanAmount', current.loanAmount, previous.loanAmount],
  ];

  comparisons.forEach(([source, currentValue, previousValue]) => {
    const currentNumber = safeNumber(currentValue, 0);
    const previousNumber = safeNumber(previousValue, 0);
    if (currentNumber === previousNumber) return;
    const variance = currentNumber - previousNumber;
    const variancePercentage = previousNumber === 0 ? 0 : (variance / previousNumber) * 100;
    triggers.push({
      triggerSource: source,
      priorValue: previousNumber,
      newValue: currentNumber,
      variance,
      variancePercentage,
      detectedDate: 'Unknown',
      affectedCalculations: ['MAO', 'Profit', 'Hold period'],
      reUnderwritingStatus: 'Pending',
      reUnderwritingResult: 'Pending',
      userAcknowledgment: 'Pending',
    });
  });

  return triggers;
}

export function buildProjectCheckpoints({ rehabProject = {} } = {}) {
  const checkpoints = [
    { checkpoint: 'Acquisition Complete', status: safeString(rehabProject.acquisitionComplete, '').toLowerCase() === 'true' || rehabProject.acquisitionComplete === true ? 'Complete' : 'Insufficient Data', completionEvidence: rehabProject.acquisitionComplete ? 'Recorded acquisition evidence exists.' : 'No acquisition evidence recorded.', blockingRequirement: 'Acquisition record required.', responsibleParty: 'Unassigned', dateStatus: 'Unknown', financialEffect: 'None', nextCheckpoint: 'Scope Confirmed' },
    { checkpoint: 'Scope Confirmed', status: safeString(rehabProject.scopeConfirmed, '').toLowerCase() === 'true' || rehabProject.scopeConfirmed === true ? 'Complete' : 'Insufficient Data', completionEvidence: rehabProject.scopeConfirmed ? 'Scope confirmation exists.' : 'Scope confirmation is missing.', blockingRequirement: 'Scope confirmation required.', responsibleParty: 'Unassigned', dateStatus: 'Unknown', financialEffect: 'None', nextCheckpoint: 'Budget Confirmed' },
    { checkpoint: 'Budget Confirmed', status: safeString(rehabProject.budgetConfirmed, '').toLowerCase() === 'true' || rehabProject.budgetConfirmed === true ? 'Complete' : 'Insufficient Data', completionEvidence: rehabProject.budgetConfirmed ? 'Budget confirmation exists.' : 'Budget confirmation is missing.', blockingRequirement: 'Budget confirmation required.', responsibleParty: 'Unassigned', dateStatus: 'Unknown', financialEffect: 'None', nextCheckpoint: 'Contractor Contracts Complete' },
    { checkpoint: 'Contractor Contracts Complete', status: safeString(rehabProject.contractorContractsComplete, '').toLowerCase() === 'true' || rehabProject.contractorContractsComplete === true ? 'Complete' : 'Blocked', completionEvidence: rehabProject.contractorContractsComplete ? 'Contracts are complete.' : 'Contract status is missing.', blockingRequirement: 'Contract package required.', responsibleParty: 'Unassigned', dateStatus: 'Unknown', financialEffect: 'None', nextCheckpoint: 'Permits Ready' },
    { checkpoint: 'Permits Ready', status: safeString(rehabProject.permitsReady, '').toLowerCase() === 'true' || rehabProject.permitsReady === true ? 'Complete' : 'Blocked', completionEvidence: rehabProject.permitsReady ? 'Permits are ready.' : 'Permits are not ready.', blockingRequirement: 'Permit status required.', responsibleParty: 'Unassigned', dateStatus: 'Unknown', financialEffect: 'None', nextCheckpoint: 'Demo Complete' },
    { checkpoint: 'Demo Complete', status: 'Not Started', completionEvidence: 'No completion evidence recorded.', blockingRequirement: 'Demo evidence required.', responsibleParty: 'Unassigned', dateStatus: 'Unknown', financialEffect: 'None', nextCheckpoint: 'Framing Complete' },
    { checkpoint: 'Framing Complete', status: 'Not Started', completionEvidence: 'No completion evidence recorded.', blockingRequirement: 'Framing evidence required.', responsibleParty: 'Unassigned', dateStatus: 'Unknown', financialEffect: 'None', nextCheckpoint: 'Rough Ins Complete' },
    { checkpoint: 'Rough Ins Complete', status: 'Not Started', completionEvidence: 'No completion evidence recorded.', blockingRequirement: 'Rough-in evidence required.', responsibleParty: 'Unassigned', dateStatus: 'Unknown', financialEffect: 'None', nextCheckpoint: 'Inspections Passed' },
    { checkpoint: 'Inspections Passed', status: 'Not Started', completionEvidence: 'No completion evidence recorded.', blockingRequirement: 'Inspection evidence required.', responsibleParty: 'Unassigned', dateStatus: 'Unknown', financialEffect: 'None', nextCheckpoint: 'Drywall Complete' },
    { checkpoint: 'Drywall Complete', status: 'Not Started', completionEvidence: 'No completion evidence recorded.', blockingRequirement: 'Drywall evidence required.', responsibleParty: 'Unassigned', dateStatus: 'Unknown', financialEffect: 'None', nextCheckpoint: 'Cabinets and Finishes Complete' },
    { checkpoint: 'Cabinets and Finishes Complete', status: 'Not Started', completionEvidence: 'No completion evidence recorded.', blockingRequirement: 'Finish evidence required.', responsibleParty: 'Unassigned', dateStatus: 'Unknown', financialEffect: 'None', nextCheckpoint: 'Final Systems Complete' },
    { checkpoint: 'Final Systems Complete', status: 'Not Started', completionEvidence: 'No completion evidence recorded.', blockingRequirement: 'System evidence required.', responsibleParty: 'Unassigned', dateStatus: 'Unknown', financialEffect: 'None', nextCheckpoint: 'Punch List Complete' },
    { checkpoint: 'Punch List Complete', status: 'Not Started', completionEvidence: 'No completion evidence recorded.', blockingRequirement: 'Punch list evidence required.', responsibleParty: 'Unassigned', dateStatus: 'Unknown', financialEffect: 'None', nextCheckpoint: 'Lien Waivers Complete' },
    { checkpoint: 'Lien Waivers Complete', status: 'Not Started', completionEvidence: 'No completion evidence recorded.', blockingRequirement: 'Lien waiver evidence required.', responsibleParty: 'Unassigned', dateStatus: 'Unknown', financialEffect: 'None', nextCheckpoint: 'Appraisal Ready' },
    { checkpoint: 'Appraisal Ready', status: 'Not Started', completionEvidence: 'No completion evidence recorded.', blockingRequirement: 'Appraisal evidence required.', responsibleParty: 'Unassigned', dateStatus: 'Unknown', financialEffect: 'None', nextCheckpoint: 'Listing Ready' },
    { checkpoint: 'Listing Ready', status: 'Not Started', completionEvidence: 'No completion evidence recorded.', blockingRequirement: 'Listing evidence required.', responsibleParty: 'Unassigned', dateStatus: 'Unknown', financialEffect: 'None', nextCheckpoint: 'Refinance Ready' },
    { checkpoint: 'Refinance Ready', status: 'Not Started', completionEvidence: 'No completion evidence recorded.', blockingRequirement: 'Refinance evidence required.', responsibleParty: 'Unassigned', dateStatus: 'Unknown', financialEffect: 'None', nextCheckpoint: 'Project Closeout Complete' },
    { checkpoint: 'Project Closeout Complete', status: 'Not Started', completionEvidence: 'No completion evidence recorded.', blockingRequirement: 'Closeout evidence required.', responsibleParty: 'Unassigned', dateStatus: 'Unknown', financialEffect: 'None', nextCheckpoint: 'Complete' },
  ];

  return checkpoints;
}

export function buildDrawControls({ project = {}, lender = {} } = {}) {
  const draws = normalizeArray(project.draws);
  const budget = safeNumber(project.budget || project.rehabBudget, 0);
  const committedCost = safeNumber(project.committedCost, 0);
  const holdback = safeNumber(lender.holdbackAmount, 0);
  const remainingEligibleBudget = Math.max(0, budget - committedCost);
  const flags = [];
  let remainingRehabExposure = remainingEligibleBudget;

  draws.forEach((draw, index) => {
    const requestedAmount = safeNumber(draw.requestedAmount || draw.amountRequested, 0);
    const approvedAmount = safeNumber(draw.approvedAmount || draw.amountApproved, 0);
    const fundedAmount = safeNumber(draw.fundedAmount || draw.amountPaid, 0);
    const remainingHoldback = holdback - fundedAmount;
    const previousDraws = draws.slice(0, index);
    const duplicateAmount = previousDraws.some((previousDraw) => safeNumber(previousDraw.requestedAmount || previousDraw.amountRequested, 0) === requestedAmount && requestedAmount > 0);
    if (duplicateAmount) {
      flags.push(`duplicate draw amount detected for draw ${draw.drawNumber || index + 1}.`);
    }
    if (requestedAmount > remainingEligibleBudget) {
      flags.push(`Draw exceeds remaining eligible budget for draw ${draw.drawNumber || index + 1}.`);
    }
    if (fundedAmount > remainingHoldback) {
      flags.push(`Funded amount exceeds lender holdback for draw ${draw.drawNumber || index + 1}.`);
    }
    if (!draw.inspectionStatus) {
      flags.push(`Missing inspection status for draw ${draw.drawNumber || index + 1}.`);
    }
    if (!draw.lienWaiverReceived && draw.lienWaiverRequired) {
      flags.push(`Missing lien waiver for draw ${draw.drawNumber || index + 1}.`);
    }
    if (approvedAmount > 0 && fundedAmount > 0) {
      remainingRehabExposure = Math.max(0, remainingRehabExposure - Math.min(fundedAmount, remainingRehabExposure));
    }
  });

  return { flags, remainingRehabExposure };
}

export function buildCapitalForecast({ deals = [], rehabProjects = [], portfolioEntries = [] } = {}) {
  const currentCashDeployed = normalizeArray(deals).reduce((sum, deal) => sum + safeNumber(deal.purchasePrice || deal.askingPrice || deal.totalCashInvested, 0) + safeNumber(deal.rehabBudget || deal.rehabCost, 0), 0);
  const committedButUnpaid = normalizeArray(rehabProjects).reduce((sum, project) => sum + safeNumber(project.committedCost, 0), 0);
  const projected30Day = Math.max(0, currentCashDeployed - committedButUnpaid * 0.1);
  const projected60Day = Math.max(0, currentCashDeployed - committedButUnpaid * 0.2);
  const projected90Day = Math.max(0, currentCashDeployed - committedButUnpaid * 0.3);
  const lenderDrawReceivables = normalizeArray(rehabProjects).reduce((sum, project) => sum + safeNumber(project.fundedAmount, 0), 0);
  const expectedSaleProceeds = normalizeArray(deals).reduce((sum, deal) => sum + safeNumber(deal.estimatedArv, 0), 0);
  const expectedRefinanceProceeds = normalizeArray(portfolioEntries).reduce((sum, entry) => sum + safeNumber(entry.currentValue, 0), 0);
  const projectedCapitalShortfall = Math.max(0, currentCashDeployed + committedButUnpaid - expectedSaleProceeds - expectedRefinanceProceeds);
  const cashTrappedInActiveProjects = normalizeArray(rehabProjects).reduce((sum, project) => sum + safeNumber(project.fundedAmount, 0), 0);

  return {
    currentCashDeployed,
    committedButUnpaid,
    projected30DayCashNeed: projected30Day,
    projected60DayCashNeed: projected60Day,
    projected90DayCashNeed: projected90Day,
    lenderDrawReceivables,
    expectedSaleProceeds,
    expectedRefinanceProceeds,
    minimumOperatingCashReserve: currentCashDeployed * 0.1,
    projectedCapitalShortfall,
    cashTrappedInActiveProjects,
    cashExpectedToBeReturned: expectedSaleProceeds * 0.2,
    projectLevelCapitalExposure: committedButUnpaid,
    portfolioLevelDownsideExposure: projectedCapitalShortfall,
  };
}

export function buildAlertResolutionAudit({ originalAlert = {}, resolution = {} } = {}) {
  return [{
    originalAlert,
    originalSourceValues: originalAlert.sourceValues || {},
    resolution: {
      action: resolution.action || 'Unknown',
      note: resolution.note || 'No note provided.',
      resolvedBy: resolution.resolvedBy || 'Unassigned',
      resolvedDate: resolution.resolvedDate || 'Unknown',
      changedFields: Array.isArray(resolution.changedFields) ? resolution.changedFields : [],
      resultingUnderwritingEffect: resolution.resultingUnderwritingEffect || 'Unknown',
      resultingRiskEffect: resolution.resultingRiskEffect || 'Unknown',
    },
  }];
}
