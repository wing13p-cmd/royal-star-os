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
  if (typeof value === 'number' && !Number.isFinite(value)) return fallback;
  if (typeof value === 'object') return fallback;
  return value;
}

function formatCurrency(value) {
  const parsed = safeNumber(value);
  if (!Number.isFinite(parsed)) return 'Insufficient Data';
  return `$${parsed.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
}

function formatPercent(value) {
  const parsed = safeNumber(value);
  if (!Number.isFinite(parsed)) return 'Insufficient Data';
  return `${parsed.toFixed(1)}%`;
}

function normalizeArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeObject(value) {
  return value && typeof value === 'object' ? value : {};
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function deriveRecommendedAction(optionName, capitalRequired, expectedProfit, capitalPosition) {
  const reserveShortfall = safeNumber(capitalPosition.reserveShortfall);
  const deployableCapital = safeNumber(capitalPosition.deployableCapital);
  const projectedProfit = safeNumber(expectedProfit);
  const requiredCapital = safeNumber(capitalRequired);
  const availableLiquidity = safeNumber(capitalPosition.availableLiquidity);

  if (optionName === 'Preserve Required Reserve' || reserveShortfall > 0) return 'Reserve Capital';
  if (optionName === 'Fund Active Rehab' || (projectedProfit > 0 && requiredCapital <= Math.max(availableLiquidity, deployableCapital))) return 'Fund Immediately';
  if (optionName === 'Refinance Property' || optionName === 'Acquire New Property') return 'Reallocate Capital';
  if (projectedProfit <= 0) return 'Reduce Offer';
  return 'Wait for Better Opportunity';
}

function parseDate(value) {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? new Date(parsed) : null;
}

function getDaysUntil(value) {
  const parsed = parseDate(value);
  if (!parsed) return null;
  return Math.ceil((parsed.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

function buildCapitalPosition(properties, rehabProjects, lenders, portfolioIntelligence) {
  const propertyList = normalizeArray(properties);
  const rehabList = normalizeArray(rehabProjects);
  const lenderList = normalizeArray(lenders);
  const portfolioSummary = normalizeObject(portfolioIntelligence?.summary);

  const extractedPropertyValues = propertyList.map((property) => ({
    currentValue: safeNumber(property.currentValue ?? property.currentEstimatedValue ?? property.value ?? property.purchaseValue),
    currentLoanBalance: safeNumber(property.currentLoanBalance ?? property.loanBalance ?? property.currentDebt ?? property.debt),
    monthlyRent: safeNumber(property.monthlyRent ?? property.marketRent ?? property.rent),
    monthlyOperatingExpenses: safeNumber(property.monthlyOperatingExpenses ?? property.operatingExpenses ?? property.expenses),
    monthlyDebtService: safeNumber(property.monthlyDebtService ?? property.debtService ?? property.payment),
    annualTaxes: safeNumber(property.annualTaxes ?? property.taxes),
    annualInsurance: safeNumber(property.annualInsurance ?? property.insurance),
    loanMaturityDate: safeString(property.loanMaturityDate ?? property.maturityDate, ''),
    recommendation: safeString(property.recommendation ?? property.recommendationType ?? property.strategy, 'Insufficient Data'),
    rehabStatus: safeString(property.rehabStatus ?? property.status ?? 'Not Started'),
    originalRehabBudget: safeNumber(property.originalRehabBudget ?? property.rehabBudget ?? property.currentRehabBudget),
    actualRehabCost: safeNumber(property.actualRehabCost ?? property.rehabCost),
    propertyName: safeString(property.propertyName ?? property.address ?? property.propertyAddress ?? 'Unnamed Property'),
  }));

  const hasPortfolioData = propertyList.length > 0 || rehabList.length > 0 || lenderList.length > 0 || Object.keys(portfolioSummary).length > 0;
  const availableLiquidity = safeNumber(portfolioSummary.availableLiquidity || portfolioSummary.cashOnHand || portfolioIntelligence?.availableLiquidity || portfolioSummary.availableCash);
  const confirmedCashBalance = safeNumber(portfolioSummary.confirmedCashBalance || portfolioSummary.cashBalance || availableLiquidity);
  const totalCashDeployed = safeNumber(portfolioSummary.totalCashDeployed || portfolioSummary.totalCapitalInvested);
  const recommendedReserve = safeNumber(portfolioSummary.recommendedReserve || 600000);
  const reserveShortfall = Math.max(0, recommendedReserve - availableLiquidity);
  const activeRehabFundingNeed = rehabList.reduce((sum, project) => sum + safeNumber(project.remainingBudget || project.originalRehabBudget || project.currentRehabBudget || project.rehabNeed), 0);
  const remainingRehabContingencyNeed = rehabList.reduce((sum, project) => sum + safeNumber(project.contingencyRemaining || project.contingencyAmount || project.contingencyBudget), 0);
  const upcomingClosingNeed = safeNumber(portfolioSummary.cashRequiredForActiveProjects || portfolioSummary.upcomingClosingNeed || 0);
  const debtDueWithin30 = extractedPropertyValues.filter((property) => {
    const days = getDaysUntil(property.loanMaturityDate);
    return days !== null && days <= 30;
  }).length;
  const debtDueWithin60 = extractedPropertyValues.filter((property) => {
    const days = getDaysUntil(property.loanMaturityDate);
    return days !== null && days <= 60;
  }).length;
  const debtDueWithin90 = extractedPropertyValues.filter((property) => {
    const days = getDaysUntil(property.loanMaturityDate);
    return days !== null && days <= 90;
  }).length;
  const upcomingInsuranceAndTaxObligations = safeNumber(portfolioSummary.upcomingInsuranceAndTaxObligations || extractedPropertyValues.reduce((sum, property) => sum + property.annualTaxes + property.annualInsurance, 0));
  const capitalTrappedInActiveProjects = Math.max(0, totalCashDeployed - availableLiquidity);
  const potentialRefinanceProceeds = extractedPropertyValues.reduce((sum, property) => sum + Math.max(0, property.currentValue * 0.7 - property.currentLoanBalance), 0);
  const potentialSaleProceeds = extractedPropertyValues.reduce((sum, property) => sum + Math.max(0, property.currentValue * 0.9), 0);
  const decisionBlockingObligations = Math.max(0, upcomingClosingNeed + activeRehabFundingNeed + remainingRehabContingencyNeed + upcomingInsuranceAndTaxObligations + (debtDueWithin30 > 0 ? 50000 : 0));
  const deployableCapital = Math.max(0, availableLiquidity - recommendedReserve - decisionBlockingObligations);
  const capitalStatus = reserveShortfall > 0 ? 'Capital Shortfall' : deployableCapital > 0 ? 'Capital Available' : 'Capital Shortfall';

  return {
    availableLiquidity,
    confirmedCashBalance,
    totalCashDeployed,
    recommendedReserve,
    reserveShortfall,
    activeRehabFundingNeed,
    remainingRehabContingencyNeed,
    upcomingClosingNeed,
    debtDueWithin30,
    debtDueWithin60,
    debtDueWithin90,
    upcomingInsuranceAndTaxObligations,
    capitalTrappedInActiveProjects,
    potentialRefinanceProceeds,
    potentialSaleProceeds,
    deployableCapital,
    capitalStatus,
    availableLiquidityDisplay: hasPortfolioData ? formatCurrency(availableLiquidity) : 'Insufficient Data',
    confirmedCashBalanceDisplay: hasPortfolioData ? formatCurrency(confirmedCashBalance) : 'Insufficient Data',
    totalCashDeployedDisplay: hasPortfolioData ? formatCurrency(totalCashDeployed) : 'Insufficient Data',
    recommendedReserveDisplay: hasPortfolioData ? formatCurrency(recommendedReserve) : 'Insufficient Data',
    reserveSurplusDisplay: hasPortfolioData ? formatCurrency(Math.max(0, recommendedReserve - availableLiquidity)) : 'Insufficient Data',
    reserveShortfallDisplay: reserveShortfall > 0 ? `Shortfall ${formatCurrency(reserveShortfall)}` : 'Insufficient Data',
    activeRehabFundingNeedDisplay: hasPortfolioData ? formatCurrency(activeRehabFundingNeed) : 'Insufficient Data',
    remainingRehabContingencyNeedDisplay: hasPortfolioData ? formatCurrency(remainingRehabContingencyNeed) : 'Insufficient Data',
    upcomingClosingNeedDisplay: hasPortfolioData ? formatCurrency(upcomingClosingNeed) : 'Insufficient Data',
    capitalTrappedDisplay: hasPortfolioData ? formatCurrency(capitalTrappedInActiveProjects) : 'Insufficient Data',
    deployableCapitalDisplay: hasPortfolioData ? formatCurrency(deployableCapital) : 'Insufficient Data',
    decisionBlockingObligationsDisplay: hasPortfolioData ? formatCurrency(decisionBlockingObligations) : 'Insufficient Data',
  };
}

function buildCapitalUseOptions(properties, deals, dealIntelligence, rehabProjects, lenders, portfolioIntelligence) {
  const propertyList = normalizeArray(properties);
  const dealList = normalizeArray(deals);
  const intelligenceEntries = normalizeArray(dealIntelligence);
  const rehabList = normalizeArray(rehabProjects);
  const lenderList = normalizeArray(lenders);
  const capitalPosition = buildCapitalPosition(propertyList, rehabList, lenderList, portfolioIntelligence);
  const options = [];

  if (capitalPosition.reserveShortfall > 0) {
    options.push({
      option: 'Preserve Required Reserve',
      relatedProperty: 'Portfolio',
      capitalRequired: capitalPosition.reserveShortfall,
      expectedCashReturned: 0,
      expectedProfit: 0,
      expectedAnnualReturn: 0,
      monthlyCashFlowImpact: 0,
      liquidityImpact: 'Protect reserve',
      reserveImpact: 'Required',
      timeToReturnCapital: 'Immediate',
      riskLevel: 'Low',
      urgency: 'Critical',
      dataConfidence: 'High',
      opportunityCost: 'Delays acquisition deployment',
      recommendationStatus: 'Required',
      reason: 'Reserve protection is required before new deployments.',
      capitalScore: 95,
      grade: 'A',
      explanation: 'Required reserve protection is the highest-priority use of capital.',
      recommendedAction: 'Reserve Capital',
    });
  }

  const rehabNeed = rehabList.find((project) => safeNumber(project.remainingBudget || project.originalRehabBudget || project.currentRehabBudget) > 0);
  if (rehabNeed) {
    options.push({
      option: 'Fund Active Rehab',
      relatedProperty: safeString(rehabNeed.propertyName || rehabNeed.projectName, 'Active Rehab'),
      capitalRequired: safeNumber(rehabNeed.remainingBudget || rehabNeed.originalRehabBudget || rehabNeed.currentRehabBudget),
      expectedCashReturned: safeNumber(rehabNeed.expectedArv || rehabNeed.projectedArv || 0),
      expectedProfit: safeNumber(rehabNeed.expectedProfit || 0),
      expectedAnnualReturn: safeNumber(rehabNeed.expectedRoi || 0.08),
      monthlyCashFlowImpact: 0,
      liquidityImpact: 'Moderate',
      reserveImpact: 'Moderate',
      timeToReturnCapital: 'Medium',
      riskLevel: 'Moderate',
      urgency: 'High',
      dataConfidence: 'Moderate',
      opportunityCost: 'Diverts cash from new acquisitions',
      recommendationStatus: 'Recommended',
      reason: 'Active rehab work is currently the strongest near-term deployment need.',
      capitalScore: 82,
      grade: 'B',
      explanation: 'Rehab funding is supported by active scope and near-term value creation.',
      recommendedAction: 'Fund Immediately',
    });
  }

  const refinanceCandidate = propertyList.find((property) => property.recommendation === 'Refinance Candidate' || safeNumber(property.currentValue) > safeNumber(property.currentLoanBalance) * 1.15);
  if (refinanceCandidate) {
    options.push({
      option: 'Refinance Property',
      relatedProperty: safeString(refinanceCandidate.propertyName || refinanceCandidate.address, 'Refinance Candidate'),
      capitalRequired: Math.max(0, safeNumber(refinanceCandidate.currentValue) * 0.05),
      expectedCashReturned: safeNumber(refinanceCandidate.currentValue) * 0.7 - safeNumber(refinanceCandidate.currentLoanBalance),
      expectedProfit: 0,
      expectedAnnualReturn: 0.06,
      monthlyCashFlowImpact: safeNumber(refinanceCandidate.monthlyDebtService) * -0.1,
      liquidityImpact: 'Positive',
      reserveImpact: 'Low',
      timeToReturnCapital: 'Short',
      riskLevel: 'Moderate',
      urgency: 'Medium',
      dataConfidence: 'Moderate',
      opportunityCost: 'Uses cash to improve liquidity rather than acquire',
      recommendationStatus: 'Conditional',
      reason: 'Refinance can release trapped equity if term sheet and appraisal are confirmed.',
      capitalScore: 74,
      grade: 'C',
      explanation: 'Refinance is viable when appraisal and lender terms are confirmed.',
      recommendedAction: 'Reallocate Capital',
    });
  }

  const acquisitionCandidate = intelligenceEntries.sort((a, b) => safeNumber(b.dealScore || b.score) - safeNumber(a.dealScore || a.score))[0];
  if (acquisitionCandidate) {
    options.push({
      option: 'Acquire New Property',
      relatedProperty: safeString(acquisitionCandidate.analysisName || acquisitionCandidate.decision || acquisitionCandidate.recommendation, 'Acquisition Opportunity'),
      capitalRequired: safeNumber(acquisitionCandidate.estimatedCashRequired || acquisitionCandidate.cashRequired || 0),
      expectedCashReturned: safeNumber(acquisitionCandidate.profit || 0),
      expectedProfit: safeNumber(acquisitionCandidate.profit || 0),
      expectedAnnualReturn: safeNumber(acquisitionCandidate.roi || 0.12),
      monthlyCashFlowImpact: safeNumber(acquisitionCandidate.monthlyCashFlow || 0),
      liquidityImpact: 'Negative',
      reserveImpact: 'High',
      timeToReturnCapital: 'Medium',
      riskLevel: safeString(acquisitionCandidate.riskLevel || 'Moderate', 'Moderate'),
      urgency: 'Medium',
      dataConfidence: safeString(acquisitionCandidate.riskLevel ? 'Moderate' : 'Low', 'Low'),
      opportunityCost: 'Uses scarce deployable capital',
      recommendationStatus: safeNumber(acquisitionCandidate.dealScore || 0) >= 80 ? 'Recommended' : 'Conditional',
      reason: 'The deal has supported underwriting but requires reserve protection and confirmation.',
      capitalScore: safeNumber(acquisitionCandidate.dealScore || 0),
      grade: safeNumber(acquisitionCandidate.dealScore || 0) >= 90 ? 'A' : safeNumber(acquisitionCandidate.dealScore || 0) >= 80 ? 'B' : safeNumber(acquisitionCandidate.dealScore || 0) >= 70 ? 'C' : 'F',
      explanation: 'Acquisition is supported when deployable capital remains after reserves and obligations.',
      recommendedAction: deriveRecommendedAction('Acquire New Property', safeNumber(acquisitionCandidate.estimatedCashRequired || acquisitionCandidate.cashRequired || 0), safeNumber(acquisitionCandidate.profit || 0), capitalPosition),
    });
  }

  if (options.length === 0) {
    options.push({
      option: 'Hold Cash',
      relatedProperty: 'Portfolio',
      capitalRequired: 0,
      expectedCashReturned: 0,
      expectedProfit: 0,
      expectedAnnualReturn: 0,
      monthlyCashFlowImpact: 0,
      liquidityImpact: 'Neutral',
      reserveImpact: 'Low',
      timeToReturnCapital: 'Immediate',
      riskLevel: 'Low',
      urgency: 'Low',
      dataConfidence: 'High',
      opportunityCost: 'Preserves flexibility',
      recommendationStatus: 'Recommended',
      reason: 'No higher-priority uses are supported from the current data.',
      capitalScore: 80,
      grade: 'B',
      explanation: 'Holding cash is the safest choice when the data are incomplete or the reserve posture is weak.',
      recommendedAction: 'Wait for Better Opportunity',
    });
  }

  return options.slice(0, 6);
}

function buildOpportunityCostAnalysis(capitalUseOptions, capitalPosition) {
  const options = normalizeArray(capitalUseOptions);
  const preserveCash = options.find((option) => option.option === 'Hold Cash') || options[0] || {};
  const rehab = options.find((option) => option.option === 'Fund Active Rehab') || {};
  const debt = options.find((option) => option.option === 'Pay Down High-Cost Debt') || {};
  const refinance = options.find((option) => option.option === 'Refinance Property') || {};
  const acquisition = options.find((option) => option.option === 'Acquire New Property') || {};
  const preferred = options[0] || preserveCash;

  return {
    preferredOption: safeString(preferred.option, 'Insufficient Data'),
    secondBestOption: safeString(options[1]?.option || 'Insufficient Data', 'Insufficient Data'),
    optionToAvoid: safeString(acquisition.option || 'Insufficient Data', 'Insufficient Data'),
    reason: safeString(preferred.reason || 'Insufficient Data', 'Insufficient Data'),
    capitalRequired: formatCurrency(preferred.capitalRequired),
    estimatedReturn: safeDisplay(preferred.expectedAnnualReturn, 'Insufficient Data'),
    liquidityRemaining: formatCurrency(Math.max(0, capitalPosition.deployableCapital - safeNumber(preferred.capitalRequired))),
    reserveRemaining: formatCurrency(Math.max(0, capitalPosition.recommendedReserve - capitalPosition.reserveShortfall)),
    lostReturnFromAlternative: formatCurrency(safeNumber(acquisition.expectedProfit || 0) - safeNumber(rehab.expectedProfit || 0)),
    costOfDelay: formatCurrency(safeNumber(rehab.capitalRequired || 0) * 0.05),
  };
}

function buildScenarioPlan(name, capitalPosition, options) {
  const scenarioOptions = normalizeArray(options).filter((option) => option.recommendationStatus !== 'Reject' && option.recommendationStatus !== 'Defer');
  return {
    scenario: name,
    deployableCapital: formatCurrency(capitalPosition.deployableCapital),
    requiredObligations: formatCurrency(capitalPosition.activeRehabFundingNeed + capitalPosition.upcomingClosingNeed + capitalPosition.upcomingInsuranceAndTaxObligations),
    reservePosition: formatCurrency(Math.max(0, capitalPosition.recommendedReserve - capitalPosition.reserveShortfall)),
    capitalShortfall: capitalPosition.reserveShortfall > 0 ? formatCurrency(capitalPosition.reserveShortfall) : 'Insufficient Data',
    projectsFunded: scenarioOptions.filter((option) => option.option === 'Fund Active Rehab').length,
    dealsFunded: scenarioOptions.filter((option) => option.option === 'Acquire New Property').length,
    refinancesFunded: scenarioOptions.filter((option) => option.option === 'Refinance Property').length,
    debtPaydownsFunded: 0,
    optionsDeferred: scenarioOptions.filter((option) => option.recommendationStatus === 'Conditional').length,
    portfolioRiskImpact: capitalPosition.reserveShortfall > 0 ? 'Elevated' : 'Managed',
  };
}

function buildKnownUncertainNeeded(portfolioIntelligence) {
  const intelligence = normalizeObject(portfolioIntelligence);
  return {
    known: normalizeArray(intelligence.known).length ? normalizeArray(intelligence.known) : ['Supported capital facts are available'],
    uncertain: normalizeArray(intelligence.uncertain).length ? normalizeArray(intelligence.uncertain) : ['Some assumptions remain unverified'],
    needed: normalizeArray(intelligence.neededToImproveDecision).length ? normalizeArray(intelligence.neededToImproveDecision) : ['Updated loan payoff', 'Verified rehab forecast', 'Confirmed cash balance'],
  };
}

function buildExecutiveCapitalAllocation(deals, dealIntelligence, capitalPosition, capitalUseOptions, portfolioIntelligence) {
  const normalizedDeals = normalizeArray(deals);
  const normalizedIntelligence = normalizeArray(dealIntelligence);
  const portfolioSummary = normalizeObject(portfolioIntelligence?.summary);
  const deployableCapital = safeNumber(capitalPosition.deployableCapital);
  const reserveShortfall = safeNumber(capitalPosition.reserveShortfall);

  const recommendations = normalizedIntelligence.map((entry) => {
    const deal = normalizedDeals.find((candidate) => String(candidate.id) === String(entry.dealId || entry.id)) || normalizedDeals[0] || {};
    const projectedProfit = safeNumber(entry.profit || entry.projectedProfit || entry.estimatedFlipProfit || 0);
    const roi = safeNumber(entry.roi || entry.projectedROI || 0);
    const cashRequired = safeNumber(entry.estimatedCashRequired || entry.cashRequired || 0);
    const riskScore = safeNumber(entry.overallRisk || 0);
    const availableLiquidity = safeNumber(portfolioSummary.availableLiquidity || 0);
    const expectedRoi = roi * 100;
    const capitalEfficiencyScore = clamp(Math.round(((expectedRoi * 0.35) + (Math.max(0, projectedProfit) / Math.max(availableLiquidity, 1) * 100 * 0.25) + ((100 - riskScore) * 0.4))), 0, 100);
    const cashRemaining = Math.max(0, availableLiquidity - reserveShortfall - cashRequired);
    const reserveImpact = reserveShortfall > 0 ? Math.min(100, reserveShortfall / Math.max(availableLiquidity, 1) * 100) : 0;
    const financingImpact = cashRequired > availableLiquidity ? 100 : Math.min(100, Math.round((cashRequired / Math.max(availableLiquidity, 1)) * 100));
    const diversificationImpact = clamp(Math.round(100 - (safeNumber(deal.purchasePrice || 0) / Math.max(safeNumber(portfolioSummary.totalCurrentValue || 1), 1) * 100)), 0, 100);
    const riskAdjustedReturn = clamp(Math.round((expectedRoi * 0.6) + ((100 - riskScore) * 0.4)), 0, 100);

    let recommendedAction = 'Wait for Better Opportunity';
    if (reserveShortfall > 0) recommendedAction = 'Reserve Capital';
    else if (projectedProfit > 0 && cashRequired <= Math.max(availableLiquidity, deployableCapital)) recommendedAction = 'Fund Immediately';
    else if (capitalEfficiencyScore >= 65 && cashRemaining > 0) recommendedAction = 'Reallocate Capital';
    else if (projectedProfit <= 0) recommendedAction = 'Reduce Offer';
    else if (cashRequired > deployableCapital) recommendedAction = 'Wait for Better Opportunity';
    else if (capitalEfficiencyScore >= 55) recommendedAction = 'Increase Offer';

    return {
      id: entry.dealId || entry.id || deal.id || 'Unnamed Opportunity',
      propertyAddress: safeString(deal.propertyAddress || deal.address || deal.propertyName || entry.analysisName || entry.recommendation || 'Unnamed Opportunity', 'Unnamed Opportunity'),
      expectedRoi: Number(expectedRoi.toFixed(1)),
      capitalEfficiencyScore,
      cashRequired,
      cashRemaining,
      reserveImpact: Number(reserveImpact.toFixed(1)),
      financingImpact: Number(financingImpact.toFixed(1)),
      portfolioDiversificationImpact: Number(diversificationImpact.toFixed(1)),
      riskAdjustedReturn: Number(riskAdjustedReturn.toFixed(1)),
      recommendedAction,
      dealScore: safeNumber(entry.dealScore || entry.score || 0),
      manualOverrideProtected: safeNumber(deal.manualOfferAmount || deal.manualArv || deal.overrideOffer || deal.overrideArv) > 0,
    };
  }).sort((left, right) => right.capitalEfficiencyScore - left.capitalEfficiencyScore);

  return {
    recommendations,
    rankedOpportunities: recommendations.map((entry, index) => ({ ...entry, rank: index + 1 })),
  };
}

export function buildCapitalAllocationEngine(payload = {}) {
  const properties = normalizeArray(payload.properties);
  const deals = normalizeArray(payload.deals);
  const dealIntelligence = normalizeArray(payload.dealIntelligence);
  const rehabProjects = normalizeArray(payload.rehabProjects);
  const lenders = normalizeArray(payload.lenders);
  const contractors = normalizeArray(payload.contractors);
  const portfolioIntelligence = normalizeObject(payload.portfolioIntelligence);

  const capitalPosition = buildCapitalPosition(properties, rehabProjects, lenders, portfolioIntelligence);
  const capitalUseOptions = buildCapitalUseOptions(properties, deals, dealIntelligence, rehabProjects, lenders, portfolioIntelligence);
  const executiveCapitalAllocation = buildExecutiveCapitalAllocation(deals, dealIntelligence, capitalPosition, capitalUseOptions, portfolioIntelligence);
  const opportunityCost = buildOpportunityCostAnalysis(capitalUseOptions, capitalPosition);
  const knownUncertainNeeded = buildKnownUncertainNeeded(portfolioIntelligence);

  const rankedPlan = [];
  let remainingCapital = Math.max(0, capitalPosition.deployableCapital);
  let reserveRemaining = Math.max(0, capitalPosition.recommendedReserve - capitalPosition.reserveShortfall);
  let allocated = new Set();

  capitalUseOptions.forEach((option, index) => {
    const optionName = safeString(option.option, 'Insufficient Data');
    const capitalRequired = safeNumber(option.capitalRequired);
    const canFund = capitalRequired <= remainingCapital && reserveRemaining >= 0 && !allocated.has(optionName);
    const status = option.recommendationStatus === 'Required' ? 'Required' : option.recommendationStatus === 'Recommended' ? 'Recommended' : 'Conditional';
    if (canFund || status === 'Required') {
      remainingCapital = canFund ? Math.max(0, remainingCapital - capitalRequired) : remainingCapital;
      reserveRemaining = canFund ? Math.max(0, reserveRemaining - Math.min(capitalRequired * 0.1, reserveRemaining)) : reserveRemaining;
      allocated.add(optionName);
      rankedPlan.push({
        rank: rankedPlan.length + 1,
        priority: `${index + 1}`,
        option: optionName,
        relatedProperty: safeString(option.relatedProperty, 'Insufficient Data'),
        capitalRequired: formatCurrency(capitalRequired),
        expectedReturn: safeDisplay(option.expectedAnnualReturn, 'Insufficient Data'),
        expectedProfit: formatCurrency(option.expectedProfit),
        liquidityAfterAllocation: formatCurrency(remainingCapital),
        reserveAfterAllocation: formatCurrency(reserveRemaining),
        risk: safeString(option.riskLevel, 'Insufficient Data'),
        timing: safeString(option.timeToReturnCapital, 'Insufficient Data'),
        recommendationStatus: status,
        requiredConditions: safeString(option.reason, 'Insufficient Data'),
        relatedModule: option.option === 'Fund Active Rehab' ? 'Rehab Project Tracker' : option.option === 'Acquire New Property' ? 'Deal Intelligence' : option.option === 'Refinance Property' ? 'Lender Dashboard' : 'Portfolio Dashboard',
      });
    }
  });

  const scenarios = [
    buildScenarioPlan('Base Case', capitalPosition, capitalUseOptions),
    buildScenarioPlan('Conservative Case', { ...capitalPosition, deployableCapital: Math.max(0, capitalPosition.deployableCapital * 0.9), activeRehabFundingNeed: capitalPosition.activeRehabFundingNeed * 1.1, upcomingClosingNeed: capitalPosition.upcomingClosingNeed * 1.05 }, capitalUseOptions),
    buildScenarioPlan('Stress Case', { ...capitalPosition, deployableCapital: Math.max(0, capitalPosition.deployableCapital * 0.8), activeRehabFundingNeed: capitalPosition.activeRehabFundingNeed * 1.2, upcomingClosingNeed: capitalPosition.upcomingClosingNeed * 1.1 }, capitalUseOptions),
  ];

  return {
    capitalPosition: {
      availableLiquidity: capitalPosition.availableLiquidity,
      confirmedCashBalance: capitalPosition.confirmedCashBalance,
      totalCashDeployed: capitalPosition.totalCashDeployed,
      recommendedReserve: capitalPosition.recommendedReserve,
      reserveShortfall: capitalPosition.reserveShortfall,
      activeRehabFundingNeed: capitalPosition.activeRehabFundingNeed,
      remainingRehabContingencyNeed: capitalPosition.remainingRehabContingencyNeed,
      upcomingClosingNeed: capitalPosition.upcomingClosingNeed,
      debtDueWithin30: capitalPosition.debtDueWithin30,
      debtDueWithin60: capitalPosition.debtDueWithin60,
      debtDueWithin90: capitalPosition.debtDueWithin90,
      upcomingInsuranceAndTaxObligations: capitalPosition.upcomingInsuranceAndTaxObligations,
      capitalTrappedInActiveProjects: capitalPosition.capitalTrappedInActiveProjects,
      potentialRefinanceProceeds: capitalPosition.potentialRefinanceProceeds,
      potentialSaleProceeds: capitalPosition.potentialSaleProceeds,
      deployableCapital: capitalPosition.deployableCapital,
      capitalStatus: capitalPosition.capitalStatus,
      availableLiquidityDisplay: capitalPosition.availableLiquidityDisplay,
      confirmedCashBalanceDisplay: capitalPosition.confirmedCashBalanceDisplay,
      totalCashDeployedDisplay: capitalPosition.totalCashDeployedDisplay,
      recommendedReserveDisplay: capitalPosition.recommendedReserveDisplay,
      reserveSurplusDisplay: capitalPosition.reserveSurplusDisplay,
      reserveShortfallDisplay: capitalPosition.reserveShortfallDisplay,
      activeRehabFundingNeedDisplay: capitalPosition.activeRehabFundingNeedDisplay,
      remainingRehabContingencyNeedDisplay: capitalPosition.remainingRehabContingencyNeedDisplay,
      upcomingClosingNeedDisplay: capitalPosition.upcomingClosingNeedDisplay,
      capitalTrappedDisplay: capitalPosition.capitalTrappedDisplay,
      deployableCapitalDisplay: capitalPosition.deployableCapitalDisplay,
      decisionBlockingObligationsDisplay: capitalPosition.decisionBlockingObligationsDisplay,
    },
    capitalUseOptions,
    executiveCapitalAllocation,
    opportunityCost,
    plan: rankedPlan,
    scenarios,
    knownUncertainNeeded,
    highestPriorityUse: capitalUseOptions[0] || {
      option: 'Insufficient Data',
      relatedProperty: 'Insufficient Data',
      capitalRequired: 0,
      expectedAnnualReturn: 0,
      reason: 'Insufficient Data',
    },
    summary: {
      highestPriorityOption: capitalUseOptions[0]?.option || 'Insufficient Data',
      highestPriorityAmount: formatCurrency(capitalUseOptions[0]?.capitalRequired || 0),
      capitalStatus: capitalPosition.capitalStatus,
    },
  };
}
