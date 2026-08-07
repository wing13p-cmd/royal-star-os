import { buildExecutiveIntelligence } from './executiveIntelligence.js';
import { buildEnterprisePlatformOrchestrator } from './enterprisePlatformOrchestrator.js';

function safeNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function safeString(value, fallback = 'Insufficient Data') {
  if (value === null || value === undefined || value === '') return fallback;
  return typeof value === 'string' ? value : String(value);
}

function safeDisplay(value, fallback = 'Insufficient Data') {
  if (value === null || value === undefined || value === '' || Number.isNaN(value)) return fallback;
  return value;
}

function formatCurrency(value) {
  const parsed = safeNumber(value);
  if (!Number.isFinite(parsed)) return 'Insufficient Data';
  return `$${parsed.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
}

function normalizeArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeObject(value) {
  return value && typeof value === 'object' ? value : {};
}

function parseDate(value) {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? new Date(parsed) : null;
}

function isResolvedAlert(alert = {}) {
  const status = safeString(alert.status, "").trim().toLowerCase();
  return status === "resolved" || status === "closed" || status === "dismissed" || Boolean(alert.resolvedAt || alert.closedAt);
}

function getLatestDate(values = []) {
  const parsed = values.map((value) => parseDate(value)).filter(Boolean);
  if (!parsed.length) return 'Insufficient Data';
  parsed.sort((a, b) => b.getTime() - a.getTime());
  return parsed[0].toISOString().slice(0, 10);
}

function determineBusinessStatus(summary, portfolioIntelligence) {
  const healthScore = safeNumber(portfolioIntelligence?.summary?.healthScore ?? summary?.portfolioHealthScore ?? summary?.healthScore);
  if (healthScore >= 90) return 'Strong';
  if (healthScore >= 80) return 'Stable';
  if (healthScore >= 70) return 'Watch';
  if (healthScore >= 60) return 'Stressed';
  if (healthScore > 0) return 'Critical';
  return 'Insufficient Data';
}

function buildAlerts(deals, properties, rehabProjects, contractors, lenders, portfolioIntelligence) {
  const alerts = [];
  const propertyList = normalizeArray(properties);
  const dealList = normalizeArray(deals);
  const rehabList = normalizeArray(rehabProjects);
  const contractorList = normalizeArray(contractors);
  const lenderList = normalizeArray(lenders);

  propertyList.forEach((property) => {
    const currentValue = safeNumber(property.currentValue ?? property.currentEstimatedValue ?? property.value);
    const debt = safeNumber(property.currentLoanBalance ?? property.currentDebt ?? property.loanBalance ?? property.debt);
    const equity = currentValue - debt;
    const maturityDate = property.loanMaturityDate;
    const maturityValue = parseDate(maturityDate);
    const now = new Date();
    const daysUntil = maturityValue ? Math.ceil((maturityValue.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) : null;

    if (equity < 0) {
      alerts.push({ severity: 'CRITICAL', alert: 'Negative equity', relatedRecord: safeString(property.propertyName || property.address, 'Unnamed Property'), financialExposure: formatCurrency(equity), requiredAction: 'Re-underwrite or prepare refinance plan', relatedModule: 'Portfolio Dashboard', status: 'Open' });
    }
    if (daysUntil !== null && daysUntil <= 30) {
      alerts.push({ severity: 'CRITICAL', alert: 'Loan maturity within 30 days', relatedRecord: safeString(property.propertyName || property.address, 'Unnamed Property'), financialExposure: formatCurrency(debt), requiredAction: 'Start refinance or extension review', relatedModule: 'Lender Dashboard', status: 'Open' });
    }
    if (property.rehabStatus === 'Over Budget' || safeNumber(property.actualRehabCost) > safeNumber(property.originalRehabBudget || property.currentRehabBudget || property.rehabBudget)) {
      alerts.push({ severity: 'HIGH', alert: 'Major rehab overrun', relatedRecord: safeString(property.propertyName || property.address, 'Unnamed Property'), financialExposure: formatCurrency(safeNumber(property.actualRehabCost) - safeNumber(property.originalRehabBudget || property.currentRehabBudget || property.rehabBudget)), requiredAction: 'Validate contingency and scope', relatedModule: 'Rehab Project Tracker', status: 'Open' });
    }
    if (safeNumber(property.monthlyCashFlow) < 0) {
      alerts.push({ severity: 'HIGH', alert: 'Negative cash flow', relatedRecord: safeString(property.propertyName || property.address, 'Unnamed Property'), financialExposure: formatCurrency(safeNumber(property.monthlyCashFlow)), requiredAction: 'Review rents or operating costs', relatedModule: 'Property Database', status: 'Open' });
    }
  });

  rehabList.forEach((project) => {
    const budget = safeNumber(project.originalRehabBudget || project.currentRehabBudget || project.projectedFinalCost);
    const actual = safeNumber(project.actualCost || project.committedCost || project.totalProjectCost);
    if (project.projectStatus === 'Delayed' || project.currentPhase === 'Delayed') {
      alerts.push({ severity: 'HIGH', alert: 'Major project delay', relatedRecord: safeString(project.propertyName || project.projectName, 'Unnamed Rehab Project'), financialExposure: formatCurrency(Math.max(0, budget - actual)), requiredAction: 'Review contractor delay and milestone plan', relatedModule: 'Rehab Project Tracker', status: 'Open' });
    }
    if (budget > 0 && actual > budget) {
      alerts.push({ severity: 'HIGH', alert: 'Rehab over budget', relatedRecord: safeString(project.propertyName || project.projectName, 'Unnamed Rehab Project'), financialExposure: formatCurrency(actual - budget), requiredAction: 'Approve contingency or reduce scope', relatedModule: 'Rehab Project Tracker', status: 'Open' });
    }
  });

  contractorList.forEach((contractor) => {
    if (contractor.insuranceStatus === 'Expired' || contractor.licenseStatus === 'Expired') {
      alerts.push({ severity: 'HIGH', alert: 'Contractor insurance or license issue', relatedRecord: safeString(contractor.contractorName || contractor.companyName, 'Unnamed Contractor'), financialExposure: 'Insufficient Data', requiredAction: 'Verify coverage and licensing', relatedModule: 'Contractor Hub', status: 'Open' });
    }
  });

  lenderList.forEach((lender) => {
    const maturityDate = parseDate(lender.loanMaturityDate || lender.termSheetExpiration);
    const now = new Date();
    const daysUntil = maturityDate ? Math.ceil((maturityDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) : null;
    if (daysUntil !== null && daysUntil <= 60) {
      alerts.push({ severity: 'HIGH', alert: 'Loan maturity within 60 days', relatedRecord: safeString(lender.lenderName || lender.loanProgramName, 'Unnamed Lender'), financialExposure: formatCurrency(safeNumber(lender.totalCurrentBalance)), requiredAction: 'Request lender term sheet', relatedModule: 'Lender Dashboard', status: 'Open' });
    }
  });

  dealList.forEach((deal) => {
    const purchase = safeNumber(deal.purchasePrice || deal.askingPrice);
    const rehab = safeNumber(deal.rehabBudget);
    const arv = safeNumber(deal.supportedBaseArv || deal.supportedARV || deal.estimatedArv || deal.arv);
    const hold = safeNumber(deal.holdingMonths);
    const strategy = safeString(deal.strategy || deal.exitStrategy, '').toLowerCase();
    const monthlyCashFlow = deal.monthlyCashFlow ?? deal.estimatedCashFlow ?? deal.brrrrAnalysis?.monthlyCashFlow;

    if (arv <= 0) {
      alerts.push({
        severity: 'HIGH',
        alert: 'Missing supported ARV',
        relatedRecord: safeString(deal.propertyAddress || deal.propertyName, 'Unnamed Deal'),
        financialExposure: 'Insufficient Data',
        requiredAction: 'Establish supported ARV from comps or appraisal evidence',
        relatedModule: 'Deal Intelligence',
        status: 'Open',
      });
    }

    if (strategy === 'brrrr' && (monthlyCashFlow === null || monthlyCashFlow === undefined || Number.isNaN(Number(monthlyCashFlow)))) {
      alerts.push({
        severity: 'MODERATE',
        alert: 'Insufficient BRRRR cash-flow inputs',
        relatedRecord: safeString(deal.propertyAddress || deal.propertyName, 'Unnamed Deal'),
        financialExposure: 'Insufficient Data',
        requiredAction: 'Complete BRRRR rent, expense, and financing inputs',
        relatedModule: 'BRRRR Analyzer',
        status: 'Open',
      });
    }

    if (purchase > 0 && rehab > 0 && arv > 0 && purchase + rehab > arv) {
      alerts.push({ severity: 'MODERATE', alert: 'Deal above walk-away price', relatedRecord: safeString(deal.propertyAddress || deal.propertyName, 'Unnamed Deal'), financialExposure: formatCurrency((purchase + rehab) - arv), requiredAction: 'Re-underwrite deal economics', relatedModule: 'Deal Analyzer', status: 'Open' });
    }
    if (hold > 0 && hold > 12) {
      alerts.push({ severity: 'MODERATE', alert: 'Extended holding period', relatedRecord: safeString(deal.propertyAddress || deal.propertyName, 'Unnamed Deal'), financialExposure: formatCurrency(rehab), requiredAction: 'Review hold assumption and exit plan', relatedModule: 'Deal Analyzer', status: 'Open' });
    }
  });

  const reserveShortfall = safeNumber(portfolioIntelligence?.summary?.reserveShortfallValue);
  const hasLivePortfolioContext = propertyList.length > 0 || dealList.length > 0 || rehabList.length > 0;
  if (reserveShortfall > 0 && hasLivePortfolioContext) {
    alerts.push({
      severity: 'CRITICAL',
      alert: 'Reserve shortfall',
      relatedRecord: 'Portfolio',
      financialExposure: formatCurrency(reserveShortfall),
      requiredAction: 'Increase reserves to target coverage before new commitments',
      relatedModule: 'Portfolio Dashboard',
      status: 'Open',
    });
  }

  const dedupedAlerts = [];
  const seen = new Set();
  alerts.forEach((alert) => {
    const dedupeKey = [alert.severity, alert.alert, alert.relatedRecord, alert.relatedModule].join('|').toLowerCase();
    if (seen.has(dedupeKey)) return;
    seen.add(dedupeKey);
    dedupedAlerts.push(alert);
  });

  return dedupedAlerts.slice(0, 10);
}

function buildPriorities(deals, properties, rehabProjects, lenders, portfolioIntelligence) {
  const priorities = [];
  const dealList = normalizeArray(deals);
  const propertyList = normalizeArray(properties);
  const rehabList = normalizeArray(rehabProjects);

  const blockingDeal = dealList.find((deal) => deal.status === 'under review' || deal.status === 'needs information');
  if (blockingDeal) {
    priorities.push({ priority: 'Decision Blocking', action: `Resolve missing information on ${safeString(blockingDeal.propertyAddress || blockingDeal.propertyName, 'the current deal')}`, reason: 'The deal is waiting on missing information before moving forward.', relatedRecord: safeString(blockingDeal.propertyAddress || blockingDeal.propertyName, 'Unnamed Deal'), relatedModule: 'Deal Analyzer', status: 'Open' });
  }

  const reserveShortfall = safeNumber(portfolioIntelligence?.summary?.reserveShortfallValue);
  if (reserveShortfall > 0) {
    priorities.push({ priority: 'Capital Preservation', action: 'Increase reserve and avoid new commitments', reason: 'Current reserve coverage is below the recommended target.', relatedRecord: 'Portfolio', relatedModule: 'Portfolio Dashboard', status: 'Open' });
  }

  const maturityProperty = propertyList.find((property) => property.loanMaturityDate);
  if (maturityProperty) {
    priorities.push({ priority: 'Loan Maturity', action: `Review maturity on ${safeString(maturityProperty.propertyName || maturityProperty.address, 'the property')}`, reason: 'A loan maturity is approaching and requires active planning.', relatedRecord: safeString(maturityProperty.propertyName || maturityProperty.address, 'Unnamed Property'), relatedModule: 'Lender Dashboard', status: 'Open' });
  }

  const rehabRisk = rehabList.find((project) => project.projectStatus === 'Delayed' || project.currentPhase === 'Delayed' || project.riskLevel === 'Critical');
  if (rehabRisk) {
    priorities.push({ priority: 'Rehab Risk', action: `Review rehab progress on ${safeString(rehabRisk.propertyName || rehabRisk.projectName, 'the active rehab')}`, reason: 'The project is carrying meaningful delay or risk.', relatedRecord: safeString(rehabRisk.propertyName || rehabRisk.projectName, 'Unnamed Rehab'), relatedModule: 'Rehab Project Tracker', status: 'Open' });
  }

  const opportunityDeal = dealList.find((deal) => (deal.status === 'active' || deal.status === 'ready to offer') && safeNumber(deal.purchasePrice) > 0);
  if (opportunityDeal) {
    priorities.push({ priority: 'Deal Opportunity', action: `Advance ${safeString(opportunityDeal.propertyAddress || opportunityDeal.propertyName, 'the current opportunity')} to decision`, reason: 'A supported deal is available to move forward.', relatedRecord: safeString(opportunityDeal.propertyAddress || opportunityDeal.propertyName, 'Unnamed Deal'), relatedModule: 'Deal Intelligence', status: 'Open' });
  }

  return priorities.slice(0, 5);
}

function normalizePriorityItem(item = {}) {
  const priority = safeString(item.priority || item.severity || item.level || 'Informational', 'Informational');
  const reason = safeString(item.reason || item.rationale || item.why || item.summary || 'Insufficient Data', 'Insufficient Data');
  const relatedRecord = safeString(item.relatedRecord || item.property || item.record || 'Portfolio', 'Portfolio');
  const requiredAction = safeString(item.requiredAction || item.action || item.nextAction || 'Review this item', 'Review this item');
  const sourceMetric = safeString(item.sourceMetric || item.metric || item.source || item.relatedModule || 'Portfolio metric', 'Portfolio metric');
  const completionCondition = safeString(item.completionCondition || item.doneWhen || item.clearCondition || 'Condition no longer active', 'Condition no longer active');
  return {
    ...item,
    priority,
    relatedRecord,
    sourceMetric,
    reason,
    requiredAction,
    completionCondition,
  };
}

function buildPriorityHierarchy(priorities = []) {
  const rank = (item = {}) => {
    const value = safeString(item.priority, '').toLowerCase();
    const reason = safeString(item.reason, '').toLowerCase();
    if (value.includes('critical') || value.includes('capital') || reason.includes('liquidity') || reason.includes('safety')) return 1;
    if (value.includes('missing') || reason.includes('missing')) return 2;
    if (value.includes('decision') || value.includes('underwriting')) return 3;
    if (value.includes('operational') || value.includes('rehab') || value.includes('loan')) return 4;
    return 5;
  };

  const deduped = [];
  const seen = new Set();
  normalizeArray(priorities).forEach((entry) => {
    const normalized = normalizePriorityItem(entry);
    const key = [
      normalizeComparablePriorityText(normalized.relatedRecord),
      normalizeComparablePriorityText(normalized.sourceMetric),
      normalizeComparablePriorityText(normalized.requiredAction),
    ].join('|');
    if (seen.has(key)) return;
    seen.add(key);
    deduped.push(normalized);
  });

  return deduped
    .sort((left, right) => rank(left) - rank(right))
    .slice(0, 8);
}

function normalizeComparablePriorityText(value) {
  return safeString(value, '').toLowerCase().replace(/\s+/g, ' ').trim();
}

function shouldSuppressNegativeProfitAlert(alert, deals = [], dealIntelligence = []) {
  const alertLabel = safeString(alert.alert || alert.condition || '').toLowerCase();
  if (!alertLabel.includes('negative') || !alertLabel.includes('profit')) return false;
  const target = safeString(alert.relatedRecord || '').toLowerCase();
  if (!target) return false;
  const dealMatch = normalizeArray(deals).find((deal) => {
    const label = safeString(deal.propertyAddress || deal.propertyName || deal.address, '').toLowerCase();
    return label && target.includes(label);
  });
  const intelligenceMatch = normalizeArray(dealIntelligence).find((entry) => {
    const label = safeString(entry.analysisName || entry.propertyAddress || entry.address, '').toLowerCase();
    return label && target.includes(label);
  });
  const projectedProfit = safeNumber(intelligenceMatch?.estimatedProfit ?? intelligenceMatch?.projectedProfit ?? dealMatch?.projectedProfit);
  return projectedProfit > 0;
}

function buildTopOpportunity(deals, dealIntelligence, properties, portfolioIntelligence) {
  const intelligenceEntries = normalizeArray(dealIntelligence);
  const best = intelligenceEntries.sort((a, b) => safeNumber(b.dealScore || b.score) - safeNumber(a.dealScore || a.score))[0];
  const firstDeal = normalizeArray(deals)[0];
  const property = normalizeArray(properties).find((entry) => entry.id === firstDeal?.linkedPropertyId || entry.propertyName === firstDeal?.propertyAddress || entry.address === firstDeal?.propertyAddress) || normalizeArray(properties)[0] || {};

  if (!best && !firstDeal) {
    return {
      propertyName: 'Insufficient Data',
      recommendation: 'Insufficient Data',
      strategy: 'Insufficient Data',
      score: 'Insufficient Data',
      profit: 'Insufficient Data',
      roi: 'Insufficient Data',
      cashRequired: 'Insufficient Data',
      mainAdvantage: 'Insufficient Data',
      mainRisk: 'Insufficient Data',
      requiredNextAction: 'Insufficient Data',
      openAnalysis: 'Deal Intelligence',
    };
  }

  return {
    propertyName: safeString(property.propertyName || property.address || firstDeal?.propertyAddress || best?.dealName, 'Insufficient Data'),
    recommendation: safeString(best?.recommendation || best?.decision || best?.analysisStatus, 'Insufficient Data'),
    strategy: safeString(property.strategy || firstDeal?.strategy || 'Hold', 'Insufficient Data'),
    score: safeDisplay(best?.dealScore || best?.score, 'Insufficient Data'),
    profit: safeDisplay(best?.profit || best?.projectedProfit, 'Insufficient Data'),
    roi: safeDisplay(best?.roi || best?.projectedROI, 'Insufficient Data'),
    cashRequired: safeDisplay(best?.estimatedCashRequired || best?.cashRequired || portfolioIntelligence?.summary?.cashRequiredForActiveProjects, 'Insufficient Data'),
    mainAdvantage: safeString(best?.mainAdvantage || 'Supported by current underwriting', 'Insufficient Data'),
    mainRisk: safeString(best?.mainRisk || 'Requires confirmation', 'Insufficient Data'),
    requiredNextAction: safeString(best?.requiredNextAction || 'Open analysis for next step', 'Insufficient Data'),
    openAnalysis: 'Deal Intelligence',
  };
}

function dedupeAlertRecords(alerts = []) {
  const dedupedByKey = new Map();
  normalizeArray(alerts).forEach((alert) => {
    if (isResolvedAlert(alert)) return;
    const key = [
      safeString(alert.alert, ''),
      safeString(alert.relatedRecord, ''),
      safeString(alert.relatedModule, ''),
    ].join('|').toLowerCase();
    if (!key) return;

    const existing = dedupedByKey.get(key);
    if (!existing) {
      dedupedByKey.set(key, alert);
      return;
    }

    const existingTime = parseDate(existing.updatedAt || existing.createdAt || existing.detectedAt || 0)?.getTime() || 0;
    const candidateTime = parseDate(alert.updatedAt || alert.createdAt || alert.detectedAt || 0)?.getTime() || 0;
    const existingWeight = safeString(existing.severity, '').toUpperCase() === 'CRITICAL' ? 3 : safeString(existing.severity, '').toUpperCase() === 'HIGH' ? 2 : 1;
    const candidateWeight = safeString(alert.severity, '').toUpperCase() === 'CRITICAL' ? 3 : safeString(alert.severity, '').toUpperCase() === 'HIGH' ? 2 : 1;

    if (candidateWeight > existingWeight || candidateTime > existingTime) {
      dedupedByKey.set(key, { ...existing, ...alert });
    }
  });
  return Array.from(dedupedByKey.values());
}

function buildTopRisk(properties, portfolioIntelligence, rehabProjects) {
  const propertyList = normalizeArray(properties);
  const rehabList = normalizeArray(rehabProjects);
  const propertyRisk = propertyList.find((property) => safeNumber(property.currentValue) - safeNumber(property.currentLoanBalance ?? property.debt) < 0 || safeNumber(property.monthlyCashFlow) < 0);
  const rehabRisk = rehabList.find((project) => project.projectStatus === 'Delayed' || project.currentPhase === 'Delayed' || project.riskLevel === 'Critical');
  const reserveShortfall = safeNumber(portfolioIntelligence?.summary?.reserveShortfallValue);

  if (!propertyRisk && !rehabRisk && reserveShortfall <= 0) {
    return {
      risk: 'Insufficient Data',
      relatedRecord: 'Insufficient Data',
      severity: 'Insufficient Data',
      financialExposure: 'Insufficient Data',
      whyItMatters: 'Insufficient Data',
      requiredAction: 'Insufficient Data',
      relatedModule: 'Insufficient Data',
    };
  }

  if (reserveShortfall > 0) {
    return {
      risk: 'Reserve shortfall',
      relatedRecord: 'Portfolio',
      severity: 'CRITICAL',
      financialExposure: formatCurrency(reserveShortfall),
      whyItMatters: 'Liquidity is below the reserve target and could constrain new deals.',
      requiredAction: 'Preserve liquidity and increase reserve coverage',
      relatedModule: 'Portfolio Dashboard',
    };
  }

  if (propertyRisk) {
    return {
      risk: 'Negative equity or negative cash flow',
      relatedRecord: safeString(propertyRisk.propertyName || propertyRisk.address, 'Unnamed Property'),
      severity: 'CRITICAL',
      financialExposure: formatCurrency(safeNumber(propertyRisk.currentValue) - safeNumber(propertyRisk.currentLoanBalance ?? propertyRisk.debt)),
      whyItMatters: 'The asset is carrying pressure that could affect refinance and exit options.',
      requiredAction: 'Re-underwrite the asset and evaluate seller or lender flexibility',
      relatedModule: 'Portfolio Dashboard',
    };
  }

  return {
    risk: 'Rehab delay',
    relatedRecord: safeString(rehabRisk.propertyName || rehabRisk.projectName, 'Unnamed Rehab'),
    severity: 'HIGH',
    financialExposure: formatCurrency(safeNumber(rehabRisk.originalRehabBudget || rehabRisk.currentRehabBudget)),
    whyItMatters: 'Delayed rehab work can extend carrying costs and compress profitability.',
    requiredAction: 'Review schedule and contractor delivery plan',
    relatedModule: 'Rehab Project Tracker',
  };
}

function buildCapitalPosition(properties, rehabProjects, lenders, portfolioIntelligence) {
  const propertyList = normalizeArray(properties);
  const rehabList = normalizeArray(rehabProjects);

  const confirmedCashDeployed = propertyList.reduce((sum, property) => sum + safeNumber(property.totalCashInvested ?? property.purchasePrice ?? property.currentValue), 0);
  const availableLiquidity = safeNumber(portfolioIntelligence?.summary?.availableLiquidity ?? 250000);
  const reserveShortfall = safeNumber(portfolioIntelligence?.summary?.reserveShortfallValue);
  const recommendedReserve = safeNumber(portfolioIntelligence?.summary?.recommendedReserve ?? 600000);
  const activeRehabNeed = rehabList.reduce((sum, project) => sum + safeNumber(project.remainingBudget || project.originalRehabBudget || project.currentRehabBudget), 0);
  const upcomingClosingNeed = safeNumber(portfolioIntelligence?.summary?.cashRequiredForActiveProjects ?? 0);
  const debtDueWithin90 = propertyList.filter((property) => {
    const maturityDate = parseDate(property.loanMaturityDate);
    if (!maturityDate) return false;
    return (maturityDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24) <= 90;
  }).length;

  const capitalAvailableForNewDeals = Math.max(0, availableLiquidity - recommendedReserve - activeRehabNeed);
  const trappedCapital = Math.max(0, confirmedCashDeployed - availableLiquidity);
  const refinanceProceedsPotential = Math.max(0, propertyList.reduce((sum, property) => sum + safeNumber(property.currentValue) * 0.7 - safeNumber(property.currentLoanBalance ?? property.debt), 0));
  const liquidityStatus = reserveShortfall > 0 ? 'Capital Shortfall' : capitalAvailableForNewDeals > 250000 ? 'Capital Available' : capitalAvailableForNewDeals > 0 ? 'Limited Capital' : 'Capital Shortfall';

  return {
    confirmedCashDeployed: formatCurrency(confirmedCashDeployed),
    availableLiquidity: formatCurrency(availableLiquidity),
    recommendedReserve: formatCurrency(recommendedReserve),
    reserveSurplusOrShortfall: reserveShortfall > 0 ? `Shortfall ${formatCurrency(reserveShortfall)}` : `Surplus ${formatCurrency(Math.max(0, recommendedReserve - availableLiquidity))}`,
    activeRehabFundingNeed: formatCurrency(activeRehabNeed),
    upcomingClosingNeed: formatCurrency(upcomingClosingNeed),
    debtDueWithin90,
    capitalAvailableForNewDeals: formatCurrency(capitalAvailableForNewDeals),
    trappedCapital: formatCurrency(trappedCapital),
    refinanceProceedsPotential: formatCurrency(refinanceProceedsPotential),
    status: liquidityStatus,
  };
}

function buildPipelineIntelligence(deals, dealIntelligence) {
  const dealList = normalizeArray(deals);
  const intelligence = normalizeArray(dealIntelligence);
  const stages = ['New', 'Under Review', 'Needs Information', 'Ready to Offer', 'Offer Submitted', 'Under Contract', 'In Rehab', 'Ready to Refinance', 'Ready to Sell', 'Closed', 'Passed', 'Rejected'];

  return stages.map((stage) => {
    const matches = dealList.filter((deal) => safeString(deal.status).toLowerCase() === stage.toLowerCase() || safeString(deal.pipelineStage).toLowerCase() === stage.toLowerCase());
    const stageIntelligence = intelligence.find((entry) => safeString(entry.stage || entry.status).toLowerCase() === stage.toLowerCase());
    return {
      stage,
      dealCount: matches.length,
      pipelineValue: formatCurrency(matches.reduce((sum, deal) => sum + safeNumber(deal.purchasePrice || deal.askingPrice), 0)),
      expectedProfit: formatCurrency(matches.reduce((sum, deal) => sum + safeNumber(deal.projectedProfit || deal.profit), 0)),
      requiredCash: formatCurrency(matches.reduce((sum, deal) => sum + safeNumber(deal.rehabBudget || deal.cashRequired), 0)),
      averageScore: stageIntelligence?.averageScore ? `${stageIntelligence.averageScore}` : 'Insufficient Data',
      averageRisk: stageIntelligence?.averageRisk || 'Insufficient Data',
      bottleneck: stageIntelligence?.bottleneck || 'Insufficient Data',
      requiredAction: stageIntelligence?.requiredAction || 'Insufficient Data',
    };
  }).filter((entry) => entry.dealCount > 0 || entry.averageScore !== 'Insufficient Data');
}

function buildRehabOperationsSummary(rehabProjects, contractors) {
  const rehabList = normalizeArray(rehabProjects);
  const contractorList = normalizeArray(contractors);
  const activeProjects = rehabList.filter((project) => project.projectStatus && project.projectStatus !== 'Closed').length;
  const totalRemainingBudget = rehabList.reduce((sum, project) => sum + safeNumber(project.remainingBudget || project.originalRehabBudget || project.currentRehabBudget), 0);
  const totalContingencyRemaining = rehabList.reduce((sum, project) => sum + safeNumber(project.contingencyRemaining || project.contingencyAmount), 0);
  const averagePercentComplete = rehabList.length ? `${(rehabList.reduce((sum, project) => sum + safeNumber(project.percentComplete), 0) / rehabList.length).toFixed(1)}%` : 'Insufficient Data';
  const delayedProjects = rehabList.filter((project) => project.projectStatus === 'Delayed' || project.currentPhase === 'Delayed').length;
  const overBudgetProjects = rehabList.filter((project) => safeNumber(project.actualCost || project.committedCost || project.totalProjectCost) > safeNumber(project.originalRehabBudget || project.currentRehabBudget)).length;
  const criticalProjects = rehabList.filter((project) => project.riskLevel === 'Critical').length;
  const contractorCapacityStatus = contractorList.length > 3 ? 'At Capacity' : contractorList.length > 0 ? 'Near Capacity' : 'Insufficient Data';
  const nextInspection = rehabList.length ? getLatestDate(rehabList.map((project) => project.nextMilestoneDate)) : 'Insufficient Data';
  const nextDraw = rehabList.length ? getLatestDate(rehabList.map((project) => project.drawDate || project.updatedAt)) : 'Insufficient Data';
  const largestRisk = rehabList.find((project) => project.riskLevel === 'Critical' || project.projectStatus === 'Delayed' || project.currentPhase === 'Delayed');

  return {
    activeProjects,
    totalRemainingBudget: formatCurrency(totalRemainingBudget),
    totalContingencyRemaining: formatCurrency(totalContingencyRemaining),
    averagePercentComplete,
    delayedProjects,
    overBudgetProjects,
    criticalProjects,
    contractorCapacityStatus,
    nextInspection,
    nextDraw,
    largestRisk: largestRisk ? safeString(largestRisk.riskLevel === 'Critical' && (largestRisk.projectStatus === 'Delayed' || largestRisk.currentPhase === 'Delayed') ? 'Critical rehab delay' : largestRisk.propertyName || largestRisk.projectName, 'Insufficient Data') : 'Insufficient Data',
  };
}

function buildFinancingSummary(properties, lenders, portfolioIntelligence) {
  const propertyList = normalizeArray(properties);
  const lenderList = normalizeArray(lenders);
  const totalOutstandingDebt = propertyList.reduce((sum, property) => sum + safeNumber(property.currentLoanBalance ?? property.debt), 0);
  const averageInterestRate = propertyList.length ? `${(propertyList.reduce((sum, property) => sum + safeNumber(property.interestRate), 0) / propertyList.length).toFixed(1)}%` : 'Insufficient Data';
  const monthlyDebtService = propertyList.reduce((sum, property) => sum + safeNumber(property.monthlyDebtService), 0);
  const portfolioDscr = safeDisplay(portfolioIntelligence?.summary?.portfolioDscr, 'Insufficient Data');
  const maturingWithin30 = propertyList.filter((property) => {
    const maturityDate = parseDate(property.loanMaturityDate);
    if (!maturityDate) return false;
    return (maturityDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24) <= 30;
  }).length;
  const maturingWithin60 = propertyList.filter((property) => {
    const maturityDate = parseDate(property.loanMaturityDate);
    if (!maturityDate) return false;
    return (maturityDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24) <= 60;
  }).length;
  const maturingWithin90 = propertyList.filter((property) => {
    const maturityDate = parseDate(property.loanMaturityDate);
    if (!maturityDate) return false;
    return (maturityDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24) <= 90;
  }).length;
  const refinanceCandidates = propertyList.filter((property) => property.recommendation === 'Refinance Candidate' || property.refinanceCandidate || safeNumber(property.currentValue) > safeNumber(property.currentLoanBalance ?? property.debt) * 1.15).length;
  const qualifiedLenders = lenderList.filter((lender) => lender.activeStatus === 'Active').length;
  const financingShortfall = safeNumber(portfolioIntelligence?.summary?.reserveShortfallValue) > 0 ? formatCurrency(safeNumber(portfolioIntelligence?.summary?.reserveShortfallValue)) : 'Insufficient Data';

  return {
    totalOutstandingDebt: formatCurrency(totalOutstandingDebt),
    averageInterestRate,
    monthlyDebtService: formatCurrency(monthlyDebtService),
    portfolioDscr,
    loansMaturingWithin30: maturingWithin30,
    loansMaturingWithin60: maturingWithin60,
    loansMaturingWithin90: maturingWithin90,
    refinanceCandidates,
    qualifiedLenders,
    financingShortfall,
    largestFinancingRisk: maturingWithin30 > 0 ? 'Loan maturity is imminent' : 'Insufficient Data',
  };
}

function buildPortfolioSummary(properties, portfolioIntelligence) {
  const portfolioSummary = normalizeObject(portfolioIntelligence?.summary);
  const propertyList = normalizeArray(properties);
  return {
    portfolioHealthScore: safeNumber(portfolioSummary.healthScore),
    totalProperties: safeNumber(portfolioSummary.totalProperties || propertyList.length),
    currentValue: formatCurrency(portfolioSummary.totalCurrentValue),
    debt: formatCurrency(portfolioSummary.totalOutstandingDebt || portfolioSummary.totalDebt),
    equity: formatCurrency(portfolioSummary.totalEquity),
    portfolioLtv: safeDisplay(portfolioSummary.portfolioLtv, 'Insufficient Data'),
    portfolioDscr: safeDisplay(portfolioSummary.portfolioDscr, 'Insufficient Data'),
    monthlyCashFlow: formatCurrency(portfolioSummary.totalMonthlyCashFlow),
    reservePosition: safeDisplay(portfolioSummary.reserveSurplusOrShortfall || portfolioSummary.reserveShortfallValue, 'Insufficient Data'),
    refinanceOpportunities: safeNumber(portfolioSummary.propertiesWithRefinanceCandidate || portfolioIntelligence?.refinanceOpportunities?.length),
    sellCandidates: safeNumber(portfolioSummary.propertiesWithSellCandidate),
    criticalRiskCount: safeNumber(portfolioSummary.criticalAlertCount),
  };
}

function buildDealDecisionSummary(dealIntelligence) {
  const intelligence = normalizeArray(dealIntelligence);
  const counts = {
    strongBuy: intelligence.filter((entry) => safeString(entry.decision || entry.recommendation).toLowerCase() === 'strong buy').length,
    buy: intelligence.filter((entry) => safeString(entry.decision || entry.recommendation).toLowerCase() === 'buy').length,
    conditionalBuy: intelligence.filter((entry) => safeString(entry.decision || entry.recommendation).toLowerCase() === 'conditional buy').length,
    renegotiate: intelligence.filter((entry) => safeString(entry.decision || entry.recommendation).toLowerCase() === 'renegotiate').length,
    reUnderwrite: intelligence.filter((entry) => safeString(entry.decision || entry.recommendation).toLowerCase() === 're-underwrite').length,
    hold: intelligence.filter((entry) => safeString(entry.decision || entry.recommendation).toLowerCase() === 'hold').length,
    pass: intelligence.filter((entry) => safeString(entry.decision || entry.recommendation).toLowerCase() === 'pass').length,
    reject: intelligence.filter((entry) => safeString(entry.decision || entry.recommendation).toLowerCase() === 'reject').length,
    insufficientData: intelligence.filter((entry) => safeString(entry.decision || entry.recommendation).toLowerCase() === 'insufficient data').length,
  };

  return {
    counts,
    readyToOffer: intelligence.filter((entry) => safeString(entry.status || entry.analysisStatus).toLowerCase() === 'ready to offer').length,
    readyWithConditions: intelligence.filter((entry) => safeString(entry.status || entry.analysisStatus).toLowerCase() === 'ready with conditions').length,
    reUnderwriteRequired: intelligence.filter((entry) => safeString(entry.status || entry.analysisStatus).toLowerCase() === 're-underwrite required').length,
    renegotiationRequired: intelligence.filter((entry) => safeString(entry.status || entry.analysisStatus).toLowerCase() === 'renegotiation required').length,
    holdForInformation: intelligence.filter((entry) => safeString(entry.status || entry.analysisStatus).toLowerCase() === 'hold for information').length,
    pass: intelligence.filter((entry) => safeString(entry.status || entry.analysisStatus).toLowerCase() === 'pass').length,
    reject: intelligence.filter((entry) => safeString(entry.status || entry.analysisStatus).toLowerCase() === 'reject').length,
  };
}

function buildKnownUncertainNeeded(portfolioIntelligence) {
  return {
    known: normalizeArray(portfolioIntelligence?.known).length ? normalizeArray(portfolioIntelligence?.known) : ['Supported portfolio data is available'],
    uncertain: normalizeArray(portfolioIntelligence?.uncertain).length ? normalizeArray(portfolioIntelligence?.uncertain) : ['Some underwriting assumptions remain unverified'],
    needed: normalizeArray(portfolioIntelligence?.neededToImproveDecision).length ? normalizeArray(portfolioIntelligence?.neededToImproveDecision) : ['Updated appraisals', 'Current lender terms', 'Verified rents'],
  };
}

function buildSyncSummary(syncState) {
  const summary = normalizeObject(syncState?.summary);
  return {
    linkedPropertyCount: safeNumber(summary.linkedPropertyCount),
    linkedPortfolioCount: safeNumber(summary.linkedPortfolioCount),
    linkedRehabProjectCount: safeNumber(summary.linkedRehabProjectCount),
    contractorCount: safeNumber(summary.contractorCount),
    lenderCount: safeNumber(summary.lenderCount),
    appraisalPacketCount: safeNumber(summary.appraisalPacketCount),
  };
}

function buildExecutiveRecommendation(portfolioIntelligence, topOpportunity, topRisk) {
  if (topRisk?.risk === 'Insufficient Data' && topOpportunity?.propertyName === 'Insufficient Data') return { recommendation: 'Continue current plan', why: 'Insufficient Data', expectedBenefit: 'Insufficient Data', mainRisk: 'Insufficient Data', requiredNextAction: 'Insufficient Data', relatedModule: 'Deal Intelligence' };

  if (topRisk?.severity === 'CRITICAL') {
    return { recommendation: 'Preserve liquidity and delay new acquisitions', why: 'Critical risk exposure requires capital protection.', expectedBenefit: 'Protects liquidity and reduces downside exposure.', mainRisk: 'Further deterioration in the current portfolio posture.', requiredNextAction: 'Address the highest-priority risk immediately.', relatedModule: 'Portfolio Dashboard' };
  }

  return { recommendation: 'Move the highest-ranked opportunity to offer', why: 'The top opportunity has the strongest supported upside.', expectedBenefit: 'Improves near-term execution and capital deployment quality.', mainRisk: 'Executive decision remains dependent on confirmation data.', requiredNextAction: 'Confirm the next required analysis step.', relatedModule: 'Deal Intelligence' };
}

function buildOpportunityCost(topOpportunity, capitalPosition) {
  if (!topOpportunity || topOpportunity.propertyName === 'Insufficient Data') {
    return { capitalRequired: 'Insufficient Data', expectedReturn: 'Insufficient Data', risk: 'Insufficient Data', timing: 'Insufficient Data', liquidityImpact: 'Insufficient Data', opportunityCost: 'Insufficient Data', preferredOption: 'Insufficient Data' };
  }

  return {
    capitalRequired: safeDisplay(topOpportunity.cashRequired, 'Insufficient Data'),
    expectedReturn: safeDisplay(topOpportunity.roi, 'Insufficient Data'),
    risk: safeDisplay(topOpportunity.mainRisk, 'Insufficient Data'),
    timing: 'Near-Term',
    liquidityImpact: safeDisplay(capitalPosition.status, 'Insufficient Data'),
    opportunityCost: 'Preserve cash if data confidence is weak',
    preferredOption: 'Proceed',
  };
}

function buildStressSummary(portfolioIntelligence) {
  const stressTests = normalizeArray(portfolioIntelligence?.stressTests);
  const base = stressTests[0] || {};
  return {
    baseCase: { portfolioHealth: safeDisplay(base.portfolioHealthScore || portfolioIntelligence?.summary?.healthScore, 'Insufficient Data'), equity: safeDisplay(base.totalEquity || portfolioIntelligence?.summary?.totalEquity, 'Insufficient Data'), cashFlow: safeDisplay(base.monthlyCashFlow || portfolioIntelligence?.summary?.totalMonthlyCashFlow, 'Insufficient Data'), dscr: safeDisplay(base.dscr || portfolioIntelligence?.summary?.portfolioDscr, 'Insufficient Data'), reservePosition: safeDisplay(base.reserveShortfall || portfolioIntelligence?.summary?.reserveSurplusOrShortfall, 'Insufficient Data'), projectedProfit: safeDisplay(base.projectedProfit || portfolioIntelligence?.summary?.totalProjectedFlipProfit, 'Insufficient Data'), criticalRiskCount: safeNumber(portfolioIntelligence?.summary?.criticalAlertCount), requiredAction: safeDisplay(base.recommendedActions?.[0] || 'Review assumptions', 'Insufficient Data') },
    moderateDownside: stressTests[1] || {},
    severeDownside: stressTests[2] || {},
    interestRateStress: stressTests[3] || {},
    rehabStress: stressTests[4] || {},
    rentStress: stressTests[1] || {},
    valueStress: stressTests[4] || {},
    combinedDownside: stressTests[4] || {},
  };
}

function buildRecentActivity(deals, properties, rehabProjects, lenders, dealIntelligence) {
  const activities = [];
  normalizeArray(deals).forEach((deal) => {
    if (deal.createdAt) activities.push({ event: 'Deal created', relatedRecord: safeString(deal.propertyAddress || deal.propertyName, 'Unnamed Deal'), date: deal.createdAt, status: safeString(deal.status, 'Open'), openRecord: 'Deal Analyzer' });
    if (deal.updatedAt) activities.push({ event: 'Deal recommendation changed', relatedRecord: safeString(deal.propertyAddress || deal.propertyName, 'Unnamed Deal'), date: deal.updatedAt, status: 'Updated', openRecord: 'Deal Intelligence' });
  });
  normalizeArray(properties).forEach((property) => {
    if (property.updatedAt) activities.push({ event: 'Property added', relatedRecord: safeString(property.propertyName || property.address, 'Unnamed Property'), date: property.updatedAt, status: 'Open', openRecord: 'Property Database' });
  });
  normalizeArray(rehabProjects).forEach((project) => {
    if (project.updatedAt) activities.push({ event: 'Rehab phase changed', relatedRecord: safeString(project.projectName || project.propertyName, 'Unnamed Rehab'), date: project.updatedAt, status: safeString(project.projectStatus, 'Open'), openRecord: 'Rehab Project Tracker' });
  });
  normalizeArray(lenders).forEach((lender) => {
    if (lender.updatedAt) activities.push({ event: 'Lender terms updated', relatedRecord: safeString(lender.lenderName, 'Unnamed Lender'), date: lender.updatedAt, status: safeString(lender.activeStatus, 'Open'), openRecord: 'Lender Dashboard' });
  });
  normalizeArray(dealIntelligence).forEach((entry) => {
    if (entry.updatedAt) activities.push({ event: 'Deal recommendation changed', relatedRecord: safeString(entry.analysisName || entry.decision, 'Unnamed Analysis'), date: entry.updatedAt, status: safeString(entry.analysisStatus, 'Open'), openRecord: 'Deal Intelligence' });
  });
  return activities.slice(0, 8);
}

function buildSearchResults(query, deals, properties, contractors, lenders, dealIntelligence, alerts, rehabProjects = [], products = [], vendors = []) {
  const search = safeString(query, '').trim().toLowerCase();
  if (!search) return [];
  const results = [];

  const addResult = (label, module, detail = '') => {
    if (!label) return;
    const normalizedLabel = safeString(label, 'Record');
    const normalizedModule = safeString(module, 'Command Center');
    const existing = results.find((entry) => entry.label === normalizedLabel && entry.module === normalizedModule);
    if (!existing) {
      results.push({ label: normalizedLabel, module: normalizedModule, detail: safeString(detail, '') });
    }
  };

  normalizeArray(deals).forEach((deal) => {
    const haystack = [deal.propertyAddress, deal.city, deal.state, deal.zipCode, deal.status, deal.strategy, deal.notes].join(' ').toLowerCase();
    if (haystack.includes(search)) addResult(deal.propertyAddress, 'Deal Analyzer', deal.status);
  });
  normalizeArray(properties).forEach((property) => {
    const haystack = [property.propertyName, property.address, property.city, property.state, property.zipCode, property.recommendation, property.status].join(' ').toLowerCase();
    if (haystack.includes(search)) addResult(property.propertyName || property.address, 'Property Database', property.recommendation || property.status);
  });
  normalizeArray(contractors).forEach((contractor) => {
    const haystack = [contractor.companyName, contractor.contractorName, contractor.contactName, contractor.trade, contractor.serviceArea].join(' ').toLowerCase();
    if (haystack.includes(search)) addResult(contractor.companyName || contractor.contractorName, 'Contractor Hub', contractor.trade);
  });
  normalizeArray(lenders).forEach((lender) => {
    const haystack = [lender.lenderName, lender.loanProgramName, lender.activeStatus].join(' ').toLowerCase();
    if (haystack.includes(search)) addResult(lender.lenderName || lender.loanProgramName, 'Lender Dashboard', lender.activeStatus);
  });
  normalizeArray(dealIntelligence).forEach((entry) => {
    const haystack = [entry.recommendation, entry.decision, entry.analysisName, entry.mainAdvantage, entry.mainRisk].join(' ').toLowerCase();
    if (haystack.includes(search)) addResult(entry.analysisName || entry.recommendation || entry.decision, 'Deal Intelligence', entry.recommendation || entry.decision);
  });
  normalizeArray(alerts).forEach((alert) => {
    if (safeString(alert.alert).toLowerCase().includes(search)) addResult(alert.alert, safeString(alert.relatedModule, 'Portfolio Dashboard'), alert.status);
  });
  normalizeArray(rehabProjects).forEach((project) => {
    const haystack = [project.propertyName, project.projectName, project.projectStatus, project.contractorName, project.notes].join(' ').toLowerCase();
    if (haystack.includes(search)) addResult(project.propertyName || project.projectName, 'Rehab Project Tracker', project.projectStatus);
  });
  normalizeArray(products).forEach((product) => {
    const haystack = [product.productName, product.vendor, product.category, product.sku, product.notes].join(' ').toLowerCase();
    if (haystack.includes(search)) addResult(product.productName, 'Product Vault', product.vendor);
  });
  normalizeArray(vendors).forEach((vendor) => {
    const haystack = [vendor.vendorName, vendor.contactName, vendor.category, vendor.notes].join(' ').toLowerCase();
    if (haystack.includes(search)) addResult(vendor.vendorName, 'Vendor Database', vendor.category);
  });

  return results.slice(0, 8);
}

export function buildCommandCenterIntelligence(payload = {}) {
  const deals = normalizeArray(payload.deals);
  const dealIntelligence = normalizeArray(payload.dealIntelligence);
  const properties = normalizeArray(payload.properties);
  const portfolioData = normalizeArray(payload.portfolioData);
  const rehabProjects = normalizeArray(payload.rehabProjects);
  const contractors = normalizeArray(payload.contractors);
  const lenders = normalizeArray(payload.lenders);
  const comps = normalizeArray(payload.comps);
  const neighborhoods = normalizeArray(payload.neighborhoods);
  const appraisalPackets = normalizeArray(payload.appraisalPackets);
  const portfolioIntelligence = normalizeObject(payload.portfolioIntelligence);
  const syncState = normalizeObject(payload.syncState);

  const executiveIntelligence = buildExecutiveIntelligence({
    deal: normalizeObject(deals[0]),
    analysis: {},
    portfolioIntelligence,
    deals,
    dealIntelligence,
    properties,
    rehabProjects,
    contractors,
    lenders,
  });
  const executiveAlerts = normalizeArray(executiveIntelligence.executiveAlerts);
  const executivePriorities = normalizeArray(executiveIntelligence.todaysPriorities);
  const nextBestActionPriorities = normalizeArray(executiveIntelligence.nextBestActions).map((action) => ({ priority: action.priority || 'EXECUTIVE', action: action.action || 'Advance the next best action', relatedRecord: safeString(action.relatedRecord, 'Portfolio') }));
  const hasPortfolioIntelligence = Boolean(portfolioIntelligence && Object.keys(portfolioIntelligence).length > 0);
  const hasLiveContext = deals.length > 0 || properties.length > 0 || rehabProjects.length > 0 || contractors.length > 0 || lenders.length > 0;
  const sourceAlerts = [
    ...(hasLiveContext ? executiveAlerts : []),
    ...buildAlerts(deals, properties, rehabProjects, contractors, lenders, portfolioIntelligence),
    ...normalizeArray(portfolioIntelligence?.alerts),
  ];
  const unresolvedAlerts = dedupeAlertRecords(sourceAlerts)
    .filter((alert) => !shouldSuppressNegativeProfitAlert(alert, deals, dealIntelligence));
  const resolvedAlerts = normalizeArray(sourceAlerts)
    .filter((alert) => isResolvedAlert(alert))
    .map((alert) => ({
      ...alert,
      status: safeString(alert.status, 'Resolved'),
      resolvedAt: safeString(alert.resolvedAt || alert.closedAt || alert.updatedAt || alert.createdAt || 'Unknown', 'Unknown'),
      resolutionReason: safeString(alert.resolutionReason || alert.notes || 'Resolved by workflow update', 'Resolved by workflow update'),
    }));
  const informationalAlerts = normalizeArray(sourceAlerts)
    .filter((alert) => safeString(alert.severity, '').toUpperCase() === 'INFO' || safeString(alert.status, '').toLowerCase() === 'informational')
    .map((alert) => ({
      ...alert,
      severity: 'INFO',
      status: safeString(alert.status, 'Informational'),
    }));
  const historicalAlerts = [...resolvedAlerts].sort((left, right) => {
    const leftTime = parseDate(left.resolvedAt || left.updatedAt || left.createdAt)?.getTime() || 0;
    const rightTime = parseDate(right.resolvedAt || right.updatedAt || right.createdAt)?.getTime() || 0;
    return rightTime - leftTime;
  }).slice(0, 20);
  const alerts = unresolvedAlerts.slice(0, 10).map((alert) => ({
    ...alert,
    alertKey: [
      safeString(alert.severity, '').toUpperCase(),
      safeString(alert.alert, ''),
      safeString(alert.relatedRecord, ''),
      safeString(alert.relatedModule, ''),
    ].join('|').toLowerCase(),
    sourceMetric: safeString(alert.sourceMetric || alert.relatedModule || 'Portfolio metric', 'Portfolio metric'),
    condition: safeString(alert.condition || alert.alert || 'Condition detected', 'Condition detected'),
    threshold: safeString(alert.threshold || 'See module formula', 'See module formula'),
    currentValue: safeString(alert.currentValue || alert.financialExposure || 'Insufficient Data', 'Insufficient Data'),
    createdAt: safeString(alert.createdAt || alert.detectedAt || new Date().toISOString(), new Date().toISOString()),
    lastEvaluatedAt: safeString(alert.lastEvaluatedAt || new Date().toISOString(), new Date().toISOString()),
  }));
  const priorities = buildPriorityHierarchy(
    normalizeArray(portfolioIntelligence?.priorities).length
      ? normalizeArray(portfolioIntelligence.priorities)
      : hasPortfolioIntelligence
        ? [...executivePriorities, ...nextBestActionPriorities]
        : buildPriorities(deals, properties, rehabProjects, lenders, portfolioIntelligence)
  );
  const topOpportunity = normalizeObject(portfolioIntelligence?.topOpportunity).propertyName && normalizeObject(portfolioIntelligence?.topOpportunity).propertyName !== 'Insufficient Data'
    ? normalizeObject(portfolioIntelligence.topOpportunity)
    : buildTopOpportunity(deals, dealIntelligence, properties, portfolioIntelligence);
  const topRisk = normalizeObject(portfolioIntelligence?.topRisk).risk ? normalizeObject(portfolioIntelligence.topRisk) : buildTopRisk(properties, portfolioIntelligence, rehabProjects);
  const capitalPosition = normalizeObject(portfolioIntelligence?.capitalPosition).status ? normalizeObject(portfolioIntelligence.capitalPosition) : buildCapitalPosition(properties, rehabProjects, lenders, portfolioIntelligence);
  const pipelineIntelligence = buildPipelineIntelligence(deals, dealIntelligence);
  const rehabOperationsSummary = buildRehabOperationsSummary(rehabProjects, contractors);
  const financingSummary = buildFinancingSummary(properties, lenders, portfolioIntelligence);
  const portfolioSummary = buildPortfolioSummary(properties, portfolioIntelligence);
  const dealDecisionSummary = buildDealDecisionSummary(dealIntelligence);
  const knownUncertainNeeded = buildKnownUncertainNeeded(portfolioIntelligence);
  const executiveRecommendation = buildExecutiveRecommendation(portfolioIntelligence, topOpportunity, topRisk);
  const opportunityCost = buildOpportunityCost(topOpportunity, capitalPosition);
  const stressSummary = buildStressSummary(portfolioIntelligence);
  const recentActivity = buildRecentActivity(deals, properties, rehabProjects, lenders, dealIntelligence);
  const localSearchResults = buildSearchResults(
    safeString(payload.searchQuery, ''),
    deals,
    properties,
    contractors,
    lenders,
    dealIntelligence,
    alerts,
    rehabProjects,
    normalizeArray(payload.products),
    normalizeArray(payload.vendors),
  );
  const enterprisePlatform = buildEnterprisePlatformOrchestrator({
    searchQuery: safeString(payload.searchQuery, ''),
    deals,
    properties,
    contractors,
    vendors: normalizeArray(payload.vendors),
    products: normalizeArray(payload.products),
    lenders,
    rehabProjects,
    appraisalPackets,
    knowledgeArticles: normalizeArray(payload.knowledgeArticles),
    documents: normalizeArray(payload.documents),
    marketRecords: normalizeArray(payload.marketRecords),
    comps,
    moduleStatus: {
      Acquisition: { status: 'Ready', records: deals.length },
      'Comparable Sales': { status: 'Ready', records: comps.length },
      ARV: { status: 'Ready', records: dealIntelligence.length },
      Portfolio: { status: 'Ready', records: properties.length },
      Rehab: { status: 'Ready', records: rehabProjects.length },
      Contractors: { status: 'Ready', records: contractors.length },
      Lenders: { status: 'Ready', records: lenders.length },
      Capital: { status: 'Ready', records: 1 },
      Risk: { status: 'Ready', records: alerts.length },
      'Knowledge Base': { status: 'Ready', records: normalizeArray(payload.knowledgeArticles).length },
      'Vendor Purchasing': { status: 'Ready', records: normalizeArray(payload.vendors).length + normalizeArray(payload.products).length },
      Forecasting: { status: 'Ready', records: normalizeArray(portfolioIntelligence.portfolioForecasts).length },
      'Executive Dashboards': { status: 'Ready', records: 1 },
    },
    auditChanges: normalizeArray(payload.auditChanges),
    providerReadiness: normalizeArray(payload.providerReadiness),
    storageHealth: normalizeObject(payload.storageHealth),
    performanceMetrics: normalizeObject(payload.performanceMetrics),
    backgroundJobs: normalizeArray(payload.backgroundJobs),
    securityHealth: normalizeObject(payload.securityHealth),
    databaseStatus: safeString(payload.databaseStatus, 'Read-Only Local Store'),
    mediaAttachments: normalizeArray(payload.mediaAttachments),
    portfolioSummary: portfolioIntelligence.summary,
    riskSummary: {
      averageRiskScore: safeNumber(portfolioIntelligence.summary?.criticalAlertCount) * 12,
      portfolioRiskScore: safeNumber(portfolioIntelligence.summary?.criticalAlertCount) * 12,
    },
    rehabSummary: rehabOperationsSummary,
  });
  const searchResults = [...enterprisePlatform.globalSearch.results, ...localSearchResults]
    .filter((entry, index, collection) => collection.findIndex((candidate) => candidate.label === entry.label && candidate.module === entry.module) === index)
    .slice(0, 25);
  const syncSummary = buildSyncSummary(syncState);
  const authoritativeEngines = {
    alerts: 'commandCenterIntelligence.dedupeAlertRecords',
    priorities: 'commandCenterIntelligence.buildPriorityHierarchy',
    recalculationTriggers: [
      'royalStarPropertiesUpdated',
      'royalStarDealsUpdated',
      '/api/cross-module-sync',
      'moduleSyncSummary',
    ],
  };

  return {
    businessStatus: safeDisplay(portfolioIntelligence?.businessStatus || executiveIntelligence.businessHealth.status || determineBusinessStatus({ portfolioHealthScore: portfolioIntelligence?.summary?.healthScore }, portfolioIntelligence), 'Insufficient Data'),
    portfolioHealth: safeDisplay(portfolioIntelligence?.portfolioHealth || executiveIntelligence.businessHealth.portfolioHealth || portfolioIntelligence?.health?.status || portfolioIntelligence?.summary?.healthStatus || portfolioIntelligence?.summary?.healthGrade, 'Insufficient Data'),
    pipelineHealth: safeDisplay(portfolioIntelligence?.portfolioHealth || executiveIntelligence.businessHealth.portfolioHealth || portfolioIntelligence?.health?.status || portfolioIntelligence?.summary?.healthStatus, 'Insufficient Data'),
    capitalStatus: safeDisplay(portfolioIntelligence?.capitalStatus || executiveIntelligence.capitalReserveMonitor.status || capitalPosition.status, 'Insufficient Data'),
    rehabCapacity: rehabOperationsSummary.contractorCapacityStatus,
    financingStatus: financingSummary.largestFinancingRisk === 'Insufficient Data' ? 'Insufficient Data' : 'Active',
    alertSummary: {
      unresolvedAlertCount: unresolvedAlerts.length,
      displayedAlertCount: alerts.length,
      resolvedAlertCount: resolvedAlerts.length,
      historicalAlertCount: historicalAlerts.length,
      informationalAlertCount: informationalAlerts.length,
      severityBreakdown: {
        critical: unresolvedAlerts.filter((alert) => safeString(alert.severity, '').toUpperCase() === 'CRITICAL').length,
        high: unresolvedAlerts.filter((alert) => safeString(alert.severity, '').toUpperCase() === 'HIGH').length,
        moderate: unresolvedAlerts.filter((alert) => safeString(alert.severity, '').toUpperCase() === 'MODERATE').length,
      },
      source: 'commandCenterIntelligence.dedupeAlertRecords',
      authoritativeEngine: authoritativeEngines.alerts,
    },
    highestPriorityOpportunity: topOpportunity,
    highestPriorityRisk: topRisk,
    mostImportantMissingInformation: knownUncertainNeeded.needed[0] || 'Insufficient Data',
    recommendedNextAction: executiveRecommendation.requiredNextAction,
    alerts,
    alertBuckets: {
      active: alerts,
      resolved: resolvedAlerts,
      historical: historicalAlerts,
      informational: informationalAlerts,
    },
    priorities,
    prioritySummary: {
      source: authoritativeEngines.priorities,
      count: priorities.length,
      conflictCount: 0,
    },
    topOpportunity,
    topRisk,
    capitalPosition,
    pipelineIntelligence,
    rehabOperationsSummary,
    financingSummary,
    portfolioSummary,
    dealDecisionSummary,
    knownUncertainNeeded,
    executiveRecommendation,
    opportunityCost,
    moduleSyncSummary: syncSummary,
    authoritativeEngines,
    stressSummary,
    recentActivity,
    searchResults,
    enterprisePlatform,
    executiveCommandCenter: executiveIntelligence.executiveCommandCenter,
    nextBestActions: executiveIntelligence.nextBestActions,
    dataSources: {
      deals,
      dealIntelligence,
      properties,
      portfolioData,
      rehabProjects,
      contractors,
      lenders,
      comps,
      neighborhoods,
      appraisalPackets,
      portfolioIntelligence,
    },
    traceability: {
      alertCountSource: 'commandCenterIntelligence.alertSummary.unresolvedAlertCount',
      riskSource: 'portfolioIntelligence.summary.healthScore',
      decisionSource: 'dealIntelligence.sharedDecision + recommendationReconciliation',
    },
  };
}
