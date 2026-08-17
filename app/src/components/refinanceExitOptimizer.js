function safeNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
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

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function safeObject(value) {
  return value && typeof value === 'object' ? value : {};
}

function buildSafeOptimizerResult(overrides = {}) {
  const summary = overrides.summary && typeof overrides.summary === 'object' ? overrides.summary : {};
  const refinanceAnalysis = overrides.refinanceAnalysis && typeof overrides.refinanceAnalysis === 'object' ? overrides.refinanceAnalysis : {};

  return {
    status: overrides.status || 'Unavailable',
    primaryExit: overrides.primaryExit ?? 'Insufficient Data',
    secondaryExit: overrides.secondaryExit ?? 'Insufficient Data',
    exitToAvoid: overrides.exitToAvoid ?? 'Insufficient Data',
    recommendedTiming: overrides.recommendedTiming ?? 'Insufficient Data',
    decisionStatus: overrides.decisionStatus ?? 'Insufficient Data',
    reason: overrides.reason ?? 'Refinance & Exit analysis unavailable for this deal.',
    refinanceReadiness: overrides.refinanceReadiness ?? 'Insufficient Data',
    exitScore: overrides.exitScore ?? 0,
    viability: overrides.viability ?? 'Insufficient Data',
    strategies: Array.isArray(overrides.strategies) ? overrides.strategies : [],
    comparison: Array.isArray(overrides.comparison) ? overrides.comparison : [],
    stressTests: Array.isArray(overrides.stressTests) ? overrides.stressTests : [],
    breakEvenThresholds: Array.isArray(overrides.breakEvenThresholds) ? overrides.breakEvenThresholds : [],
    warnings: Array.isArray(overrides.warnings) ? overrides.warnings : [],
    requiredActions: Array.isArray(overrides.requiredActions) ? overrides.requiredActions : [],
    summary: {
      message: summary.message || 'Refinance & Exit analysis unavailable for this deal.',
      ...summary,
    },
    refinanceAnalysis,
    timeline: Array.isArray(overrides.timeline) ? overrides.timeline : [],
    known: Array.isArray(overrides.known) ? overrides.known : [],
    uncertain: Array.isArray(overrides.uncertain) ? overrides.uncertain : [],
    needed: Array.isArray(overrides.needed) ? overrides.needed : [],
    capitalIntegration: overrides.capitalIntegration && typeof overrides.capitalIntegration === 'object' ? overrides.capitalIntegration : {},
    portfolioSummary: overrides.portfolioSummary && typeof overrides.portfolioSummary === 'object' ? overrides.portfolioSummary : {},
  };
}

function getSupportedValue(property) {
  const appraisedValue = safeNumber(property.appraisedValue ?? property.appraisalValue);
  const supportedArv = safeNumber(property.supportedARV ?? property.supportedArv ?? property.approvedArv);
  const currentValue = safeNumber(property.currentValue ?? property.currentEstimatedValue ?? property.value);
  if (appraisedValue > 0) return appraisedValue;
  if (supportedArv > 0) return supportedArv;
  if (currentValue > 0) return currentValue;
  return 0;
}

function getAnnualNoi(property) {
  const monthlyRent = safeNumber(property.monthlyRent ?? property.effectiveRent);
  const monthlyOperatingExpenses = safeNumber(property.monthlyOperatingExpenses ?? property.operatingExpenses);
  const monthlyDebtService = safeNumber(property.monthlyDebtService ?? property.debtService ?? property.payment);
  return (monthlyRent - monthlyOperatingExpenses - monthlyDebtService) * 12;
}

function buildStrategy(option) {
  return {
    strategy: option.strategy,
    viability: option.viability,
    estimatedValue: option.estimatedValue,
    estimatedGrossProceeds: option.estimatedGrossProceeds,
    estimatedNetProceeds: option.estimatedNetProceeds,
    capitalRequired: option.capitalRequired,
    capitalReturned: option.capitalReturned,
    profit: option.profit,
    roi: option.roi,
    annualizedRoi: option.annualizedRoi,
    monthlyCashFlow: option.monthlyCashFlow,
    annualCashFlow: option.annualCashFlow,
    dscr: option.dscr,
    cashLeftInDeal: option.cashLeftInDeal,
    timeToExit: option.timeToExit,
    liquidityImpact: option.liquidityImpact,
    reserveImpact: option.reserveImpact,
    riskLevel: option.riskLevel,
    scenarioSurvival: option.scenarioSurvival,
    dataConfidence: option.dataConfidence,
    mainAdvantage: option.mainAdvantage,
    mainWeakness: option.mainWeakness,
    requiredConditions: option.requiredConditions,
    requiredNextAction: option.requiredNextAction,
    exitScore: option.exitScore,
    grade: option.grade,
    explanation: option.explanation,
  };
}

export function buildRefinanceExitOptimizer(payload = {}) {
  const properties = safeArray(payload.properties);
  safeArray(payload.deals);
  safeObject(payload.portfolioIntelligence);
  safeObject(payload.capitalAllocationEngine);

  if (!properties.length) {
    return buildSafeOptimizerResult({
      status: 'Unavailable',
      primaryExit: 'Insufficient Data',
      secondaryExit: 'Insufficient Data',
      exitToAvoid: 'Insufficient Data',
      recommendedTiming: 'Insufficient Data',
      decisionStatus: 'Insufficient Data',
      reason: 'No supported properties were available for exit analysis.',
      refinanceReadiness: 'Insufficient Data',
      refinanceAnalysis: {
        readyToRefinance: false,
        refinanceValue: 0,
        refinanceLoanAmount: 0,
        grossRefinanceProceeds: 0,
        netRefinanceProceeds: 0,
        cashReturned: 0,
        cashLeftInDeal: 0,
        capitalRecoveryPercentage: 0,
        newMonthlyPayment: 0,
        postRefinanceMonthlyCashFlow: 0,
        postRefinanceDscr: 0,
      },
      comparison: [],
      breakEvenThresholds: [],
      stressTests: [],
      timeline: [],
      known: ['No property data was available for exit analysis.'],
      uncertain: ['The optimizer requires supported property and lender details to produce reliable exit guidance.'],
      needed: ['Property values', 'Loan payoff', 'Appraisal or ARV support', 'Rent and expenses'],
      capitalIntegration: {
        capitalRequired: 0,
        capitalReturned: 0,
        liquidityImpact: 'Insufficient Data',
      },
      summary: {
        message: 'Refinance & Exit analysis unavailable for this deal.',
        estimatedCapitalReleased: 'Insufficient Data',
        estimatedCapitalRequired: 'Insufficient Data',
        exitScore: 'Insufficient Data',
      },
    });
  }

  const supportedProperty = properties.find((property) => safeNumber(property.currentValue ?? property.currentEstimatedValue ?? property.value) > 0) || properties[0];
  const value = getSupportedValue(supportedProperty);
  const currentLoanBalance = safeNumber(supportedProperty.currentLoanBalance ?? supportedProperty.loanBalance ?? supportedProperty.currentDebt ?? supportedProperty.debt);
  const monthlyRent = safeNumber(supportedProperty.monthlyRent ?? supportedProperty.effectiveRent);
  const monthlyOperatingExpenses = safeNumber(supportedProperty.monthlyOperatingExpenses ?? supportedProperty.operatingExpenses);
  void monthlyOperatingExpenses;
  const monthlyDebtService = safeNumber(supportedProperty.monthlyDebtService ?? supportedProperty.debtService ?? supportedProperty.payment);
  const rehabRemainingBudget = safeNumber(supportedProperty.rehabRemainingBudget ?? supportedProperty.remainingRehabBudget ?? supportedProperty.rehabBudgetRemaining ?? supportedProperty.rehabNeed);
  const rehabPercentComplete = safeNumber(supportedProperty.rehabPercentComplete ?? supportedProperty.percentComplete ?? supportedProperty.rehabCompletionPercentage);
  const strategy = String(supportedProperty.strategy || supportedProperty.exitStrategy || '').toLowerCase();
  const isFlip = /flip|sale/.test(strategy);
  const projectedArv = safeNumber(supportedProperty.projectedARV ?? supportedProperty.projectedArv ?? supportedProperty.estimatedArv ?? supportedProperty.arv);
  const hasMeaningfulInput = value > 0 || projectedArv > 0 || currentLoanBalance > 0 || monthlyRent > 0 || monthlyDebtService > 0 || rehabRemainingBudget > 0 || rehabPercentComplete > 0;

  if (!hasMeaningfulInput) {
    return buildSafeOptimizerResult({
      status: 'Unavailable',
      primaryExit: 'Insufficient Data',
      secondaryExit: 'Insufficient Data',
      exitToAvoid: 'Insufficient Data',
      recommendedTiming: 'Insufficient Data',
      decisionStatus: 'Insufficient Data',
      reason: 'Refinance & Exit analysis unavailable for this deal.',
      refinanceReadiness: 'Insufficient Data',
      exitScore: 0,
      viability: 'Insufficient Data',
      strategies: [],
      comparison: [],
      stressTests: [],
      breakEvenThresholds: [],
      warnings: [],
      requiredActions: ['Add property valuation, debt payoff, and rent support data.'],
      summary: {
        message: 'Refinance & Exit analysis unavailable for this deal.',
      },
      refinanceAnalysis: {
        readyToRefinance: false,
        refinanceValue: 0,
        refinanceLoanAmount: 0,
        grossRefinanceProceeds: 0,
        netRefinanceProceeds: 0,
        cashReturned: 0,
        cashLeftInDeal: 0,
        capitalRecoveryPercentage: 0,
        newMonthlyPayment: 0,
        postRefinanceMonthlyCashFlow: 0,
        postRefinanceDscr: 0,
      },
      timeline: [],
      known: ['Insufficient property data was available for analysis.'],
      uncertain: ['The optimizer requires supported property and lender details to produce reliable exit guidance.'],
      needed: ['Property values', 'Loan payoff', 'Appraisal or ARV support', 'Rent and expenses'],
    });
  }
  if (value <= 0 && isFlip && projectedArv > 0) {
    const sellingCosts = safeNumber(supportedProperty.sellingCosts ?? projectedArv * 0.08);
    const netSaleCash = projectedArv - sellingCosts - currentLoanBalance - rehabRemainingBudget;
    const totalCashInvested = safeNumber(supportedProperty.totalCashInvested ?? supportedProperty.initialCashInvested);
    const sale = buildStrategy({
      strategy: 'Sell After Rehab', viability: netSaleCash > 0 ? 'Conditional' : 'Marginal', estimatedValue: projectedArv,
      estimatedGrossProceeds: projectedArv, estimatedNetProceeds: netSaleCash, capitalRequired: rehabRemainingBudget,
      capitalReturned: Math.max(0, netSaleCash), profit: netSaleCash - totalCashInvested,
      roi: totalCashInvested > 0 ? (netSaleCash - totalCashInvested) / totalCashInvested : null,
      annualizedRoi: null, monthlyCashFlow: null, annualCashFlow: null, dscr: null, cashLeftInDeal: null,
      timeToExit: rehabRemainingBudget > 0 ? 'After Rehab Completion' : 'Prepare for Sale', liquidityImpact: 'Projected', reserveImpact: 'Review',
      riskLevel: 'Elevated', scenarioSurvival: 'Conditional', dataConfidence: 'Projected — Not Appraisal Supported',
      mainAdvantage: 'The entered Flip strategy and projected resale economics support sale planning.',
      mainWeakness: 'Projected ARV is not independently supported by comps or appraisal evidence.',
      requiredConditions: 'Complete rehab, establish comp/appraisal support, and obtain a payoff statement.',
      requiredNextAction: 'Validate comps and prepare the Flip sale plan.', exitScore: netSaleCash > 0 ? 70 : 45,
      grade: netSaleCash > 0 ? 'C' : 'D', explanation: 'Sale analysis uses projected ARV for Flip planning only; it is not used for refinance underwriting.',
    });
    return buildSafeOptimizerResult({
      status: 'Available with Conditions', primaryExit: 'Sell After Rehab', secondaryExit: 'Insufficient Data', exitToAvoid: 'Refinance Until Valuation Is Supported',
      recommendedTiming: sale.timeToExit, decisionStatus: netSaleCash > 0 ? 'Continue Flip With Controls' : 'Re-Underwrite Sale Exit',
      reason: sale.explanation, refinanceReadiness: 'Not Ready — Supported Value Required', exitScore: sale.exitScore,
      viability: sale.viability, strategies: [sale], comparison: [sale], warnings: ['Projected ARV is not appraisal-supported and was not used for refinance calculations.'],
      requiredActions: ['Establish comp/appraisal support', 'Confirm payoff and selling costs', 'Complete remaining rehab scope'],
      refinanceAnalysis: { readyToRefinance: false, refinanceValue: null, refinanceLoanAmount: null, grossRefinanceProceeds: null, netRefinanceProceeds: null, cashReturned: null, cashLeftInDeal: null, capitalRecoveryPercentage: null, newMonthlyPayment: monthlyDebtService || null, postRefinanceMonthlyCashFlow: null, postRefinanceDscr: null },
      known: [`Primary strategy is Flip`, `Projected ARV is ${formatCurrency(projectedArv)}`, `Current loan balance is ${formatCurrency(currentLoanBalance)}`],
      uncertain: ['Projected ARV is not independently supported.'], needed: ['Appraisal or comparable-sale support', 'Payoff statement', 'Listing estimate'],
      summary: { message: 'Flip sale planning is available; refinance analysis remains unavailable without supported valuation evidence.', estimatedCapitalReleased: formatCurrency(Math.max(0, netSaleCash)), estimatedCapitalRequired: formatCurrency(rehabRemainingBudget), exitScore: sale.exitScore },
    });
  }
  if (value <= 0) {
    return buildSafeOptimizerResult({
      status: 'Unavailable',
      reason: 'A supported or appraised value is required before refinance or sale proceeds can be estimated.',
      refinanceReadiness: 'Not Ready',
      refinanceAnalysis: {
        readyToRefinance: false,
        refinanceValue: null,
        refinanceLoanAmount: null,
        grossRefinanceProceeds: null,
        netRefinanceProceeds: null,
        cashReturned: null,
        cashLeftInDeal: null,
        capitalRecoveryPercentage: null,
        newMonthlyPayment: monthlyDebtService || null,
        postRefinanceMonthlyCashFlow: null,
        postRefinanceDscr: null,
      },
      comparison: [],
      warnings: ['Projected ARV is not appraisal-supported and was not used as refinance or sale value.'],
      requiredActions: ['Establish supported value through appraisal or comparable-sale evidence.'],
      known: currentLoanBalance > 0 ? [`Current loan balance is ${formatCurrency(currentLoanBalance)}`] : [],
      uncertain: ['Refinance and sale proceeds are unknown until valuation evidence is established.'],
      needed: ['Appraisal or supported valuation', 'Payoff statement'],
    });
  }
  const rawRefinanceLtv = safeNumber(supportedProperty.refinanceLtv ?? supportedProperty.maxLtv ?? 0.75);
  const refinanceLtv = rawRefinanceLtv > 1 ? rawRefinanceLtv / 100 : rawRefinanceLtv;
  const refinanceLoanAmount = value * refinanceLtv;
  const closingCosts = safeNumber(supportedProperty.refinanceClosingCosts ?? supportedProperty.closingCosts ?? value * 0.02);
  const reserves = safeNumber(supportedProperty.requiredReserves ?? supportedProperty.reserveRequirement ?? 0);
  const existingLoanPayoff = currentLoanBalance;
  const netRefinanceProceeds = refinanceLoanAmount - existingLoanPayoff - closingCosts - reserves;
  const cashReturned = Math.max(0, netRefinanceProceeds);
  const totalCashInvested = safeNumber(supportedProperty.totalCashInvested ?? supportedProperty.initialCashInvested);
  const cashLeftInDeal = Math.max(0, totalCashInvested - cashReturned);
  const annualNoi = getAnnualNoi(supportedProperty);
  const newMonthlyPayment = monthlyDebtService;
  const postRefinanceMonthlyCashFlow = safeNumber(supportedProperty.monthlyRent ?? supportedProperty.effectiveRent) - safeNumber(supportedProperty.monthlyOperatingExpenses ?? supportedProperty.operatingExpenses) - newMonthlyPayment;
  const postRefinanceDscr = monthlyDebtService > 0 && monthlyRent > 0 ? (annualNoi / (monthlyDebtService * 12)) : null;
  const appraisalStatus = safeDisplay(supportedProperty.appraisalStatus ?? supportedProperty.appraisalComplete, 'Insufficient Data');
  const insuranceStatus = safeDisplay(supportedProperty.insuranceStatus ?? supportedProperty.insuranceCurrent, 'Insufficient Data');
  const titleStatus = safeDisplay(supportedProperty.titleStatus ?? supportedProperty.titleClear, 'Insufficient Data');
  void appraisalStatus;
  void insuranceStatus;
  void titleStatus;
  const documentationCompleteness = safeNumber(supportedProperty.documentationCompleteness ?? 0);
  const loanMaturityDate = safeDisplay(supportedProperty.loanMaturityDate ?? supportedProperty.maturityDate, 'Insufficient Data');
  const occupancyRate = safeNumber(supportedProperty.occupancyRate ?? supportedProperty.leaseOccupancy ?? supportedProperty.currentOccupancy);
  const leaseStatus = safeDisplay(supportedProperty.leaseStatus ?? supportedProperty.tenantStatus, 'Insufficient Data');
  void leaseStatus;
  const rentReady = safeNumber(supportedProperty.monthlyRent ?? supportedProperty.effectiveRent) > 0 && occupancyRate >= 90;
  const hasAppraisal = safeNumber(supportedProperty.appraisedValue ?? supportedProperty.appraisalValue) > 0 || safeNumber(supportedProperty.supportedARV ?? supportedProperty.supportedArv) > 0;
  const hasLoanData = currentLoanBalance > 0 && safeNumber(supportedProperty.interestRate ?? supportedProperty.currentInterestRate) > 0;

  let refinanceReadiness;
  if (hasAppraisal && rentReady && hasLoanData && documentationCompleteness >= 0.8) {
    refinanceReadiness = 'Ready to Refinance';
  } else if (hasAppraisal && rentReady && hasLoanData) {
    refinanceReadiness = 'Ready with Conditions';
  } else if (rehabPercentComplete >= 60 && rehabRemainingBudget > 0) {
    refinanceReadiness = 'Refinance After Milestone';
  } else if (hasLoanData) {
    refinanceReadiness = 'Prepare to Refinance';
  } else {
    refinanceReadiness = 'Not Ready';
  }

  const refinanceStrategy = {
    strategy: 'Refinance and Hold',
    viability: cashReturned > 0 && refinanceReadiness === 'Ready to Refinance' ? 'Strong' : cashReturned > 0 && refinanceReadiness === 'Ready with Conditions' ? 'Viable' : refinanceReadiness === 'Refinance After Milestone' ? 'Conditional' : 'Marginal',
    estimatedValue: value,
    estimatedGrossProceeds: refinanceLoanAmount,
    estimatedNetProceeds: netRefinanceProceeds,
    capitalRequired: Math.max(0, reserves + closingCosts),
    capitalReturned: cashReturned,
    profit: netRefinanceProceeds - safeNumber(supportedProperty.remainingUnrecoveredCashInvestment ?? 0),
    roi: totalCashInvested > 0 ? (netRefinanceProceeds - totalCashInvested) / totalCashInvested : 0,
    annualizedRoi: totalCashInvested > 0 ? ((netRefinanceProceeds - totalCashInvested) / totalCashInvested) : 0,
    monthlyCashFlow: postRefinanceMonthlyCashFlow,
    annualCashFlow: postRefinanceMonthlyCashFlow * 12,
    dscr: postRefinanceDscr,
    cashLeftInDeal: cashLeftInDeal,
    timeToExit: '30-90 Days',
    liquidityImpact: cashReturned > 0 ? 'Positive' : 'Neutral',
    reserveImpact: reserves > 0 ? 'Moderate' : 'Low',
    riskLevel: refinanceReadiness === 'Ready to Refinance' ? 'Moderate' : 'Elevated',
    scenarioSurvival: 'Supported',
    dataConfidence: hasAppraisal && hasLoanData ? 'High' : 'Moderate',
    mainAdvantage: 'Releases capital while preserving the asset.',
    mainWeakness: 'Requires lender qualification and closing execution.',
    requiredConditions: 'Appraisal, payoff, and refinance term sheet.',
    requiredNextAction: 'Prepare refinance package and lender outreach.',
    exitScore: refinanceReadiness === 'Ready to Refinance' ? 90 : refinanceReadiness === 'Ready with Conditions' ? 78 : refinanceReadiness === 'Refinance After Milestone' ? 70 : 55,
    grade: refinanceReadiness === 'Ready to Refinance' ? 'A' : refinanceReadiness === 'Ready with Conditions' ? 'C' : refinanceReadiness === 'Refinance After Milestone' ? 'C' : 'F',
    explanation: 'Refinance is supported by current value and refinance capacity.',
  };

  const saleStrategy = {
    strategy: 'Sell After Rehab',
    viability: rehabRemainingBudget <= 0 && value > 0 ? 'Viable' : 'Conditional',
    estimatedValue: value,
    estimatedGrossProceeds: value,
    estimatedNetProceeds: value - safeNumber(supportedProperty.sellingCosts ?? value * 0.08) - currentLoanBalance - rehabRemainingBudget,
    capitalRequired: rehabRemainingBudget,
    capitalReturned: Math.max(0, value - currentLoanBalance - safeNumber(supportedProperty.sellingCosts ?? value * 0.08) - rehabRemainingBudget),
    profit: Math.max(0, value - currentLoanBalance - safeNumber(supportedProperty.sellingCosts ?? value * 0.08) - rehabRemainingBudget - totalCashInvested),
    roi: totalCashInvested > 0 ? (Math.max(0, value - currentLoanBalance - safeNumber(supportedProperty.sellingCosts ?? value * 0.08) - rehabRemainingBudget - totalCashInvested) / totalCashInvested) : 0,
    annualizedRoi: totalCashInvested > 0 ? (Math.max(0, value - currentLoanBalance - safeNumber(supportedProperty.sellingCosts ?? value * 0.08) - rehabRemainingBudget - totalCashInvested) / totalCashInvested) : 0,
    monthlyCashFlow: null,
    annualCashFlow: null,
    dscr: null,
    cashLeftInDeal: Math.max(0, totalCashInvested - (value - currentLoanBalance - safeNumber(supportedProperty.sellingCosts ?? value * 0.08) - rehabRemainingBudget)),
    timeToExit: rehabRemainingBudget > 0 ? '90-180 Days' : '30-90 Days',
    liquidityImpact: 'High',
    reserveImpact: 'Moderate',
    riskLevel: rehabRemainingBudget > 0 ? 'Elevated' : 'Moderate',
    scenarioSurvival: 'Supported',
    dataConfidence: value > 0 ? 'Moderate' : 'Insufficient Data',
    mainAdvantage: 'Provides clean liquidity and exits the asset.',
    mainWeakness: 'Requires sale execution and market timing.',
    requiredConditions: 'Listing estimate and payoff statement.',
    requiredNextAction: 'Prepare sale marketing and payoff review.',
    exitScore: rehabRemainingBudget <= 0 ? 74 : 63,
    grade: rehabRemainingBudget <= 0 ? 'C' : 'D',
    explanation: 'Sale becomes more attractive when rehab and carrying costs are controlled.',
  };

  const holdStrategy = {
    strategy: 'Hold Existing Financing',
    viability: postRefinanceDscr >= 1.2 ? 'Viable' : 'Conditional',
    estimatedValue: value,
    estimatedGrossProceeds: 0,
    estimatedNetProceeds: 0,
    capitalRequired: 0,
    capitalReturned: 0,
    profit: 0,
    roi: 0,
    annualizedRoi: 0,
    monthlyCashFlow: safeNumber(supportedProperty.monthlyRent ?? supportedProperty.effectiveRent) - safeNumber(supportedProperty.monthlyOperatingExpenses ?? supportedProperty.operatingExpenses) - monthlyDebtService,
    annualCashFlow: (safeNumber(supportedProperty.monthlyRent ?? supportedProperty.effectiveRent) - safeNumber(supportedProperty.monthlyOperatingExpenses ?? supportedProperty.operatingExpenses) - monthlyDebtService) * 12,
    dscr: postRefinanceDscr,
    cashLeftInDeal: totalCashInvested,
    timeToExit: 'Longer-Term',
    liquidityImpact: 'Neutral',
    reserveImpact: 'Low',
    riskLevel: 'Moderate',
    scenarioSurvival: 'Conditional',
    dataConfidence: safeNumber(supportedProperty.monthlyRent ?? supportedProperty.effectiveRent) > 0 ? 'Moderate' : 'Insufficient Data',
    mainAdvantage: 'Preserves optionality while generating cash flow.',
    mainWeakness: 'Requires time and ongoing carrying cost.',
    requiredConditions: 'Stabilized rent and active operating review.',
    requiredNextAction: 'Reassess cash flow and maturity timing.',
    exitScore: postRefinanceDscr >= 1.2 ? 69 : 54,
    grade: postRefinanceDscr >= 1.2 ? 'D' : 'F',
    explanation: 'Holding remains viable when cash flow and debt service are stable.',
  };

  const comparison = [buildStrategy(refinanceStrategy), buildStrategy(saleStrategy), buildStrategy(holdStrategy)]
    .sort((a, b) => safeNumber(b.exitScore) - safeNumber(a.exitScore));

  const primaryExit = comparison[0]?.strategy || 'Insufficient Data';
  const secondaryExit = comparison[1]?.strategy || 'Insufficient Data';
  const exitToAvoid = comparison[comparison.length - 1]?.strategy || 'Insufficient Data';
  const decisionStatus = refinanceStrategy.exitScore >= 80 ? 'Execute with Conditions' : refinanceStrategy.exitScore >= 70 ? 'Prepare Now' : 'Re-Underwrite';
  const known = [
    `Supported value is ${formatCurrency(value)}`,
    `Current loan balance is ${formatCurrency(currentLoanBalance)}`,
    `Rehab remaining budget is ${formatCurrency(rehabRemainingBudget)}`,
  ];
  const uncertain = [
    'The refinance value depends on appraisal and lender qualification.',
    'Sale proceeds depend on market timing and carrying costs.',
    'Hold performance depends on verified rent and occupancy.',
  ];
  const needed = [
    'Appraisal',
    'Payoff statement',
    'Refinance term sheet',
    'Verified rent',
    'Updated insurance',
    'Updated taxes',
    'Listing estimate',
    'Remaining rehab scope',
  ];

  const breakEvenThresholds = [
    {
      metric: 'Refinance remains viable only if value is at least',
      threshold: formatCurrency(currentLoanBalance / refinanceLtv || 0),
    },
    {
      metric: 'Sale remains viable only if price is at least',
      threshold: formatCurrency(currentLoanBalance + rehabRemainingBudget + safeNumber(supportedProperty.sellingCosts ?? value * 0.08) + totalCashInvested * 0.1),
    },
    {
      metric: 'Hold remains viable only if rent is at least',
      threshold: formatCurrency((safeNumber(supportedProperty.monthlyOperatingExpenses ?? supportedProperty.operatingExpenses) + monthlyDebtService) / 1),
    },
    {
      metric: 'Rehab must remain below',
      threshold: formatCurrency(value * 0.2),
    },
  ];

  const stressTests = [
    {
      scenario: 'Sale Stress - 10%',
      viability: 'Conditional',
      profit: formatCurrency(saleStrategy.profit * 0.9),
      roi: formatPercent(saleStrategy.roi * 0.9),
      cashReturned: formatCurrency(saleStrategy.capitalReturned * 0.9),
      cashLeftInDeal: formatCurrency(saleStrategy.cashLeftInDeal * 1.05),
      cashFlow: formatCurrency(0),
      dscr: 'Insufficient Data',
      liquidityImpact: 'Moderate',
      exitScore: 66,
      recommendation: 'Reassess sale timing',
    },
    {
      scenario: 'Refinance Stress - 10%',
      viability: 'Conditional',
      profit: formatCurrency(refinanceStrategy.profit * 0.9),
      roi: formatPercent(refinanceStrategy.roi * 0.9),
      cashReturned: formatCurrency(refinanceStrategy.capitalReturned * 0.9),
      cashLeftInDeal: formatCurrency(refinanceStrategy.cashLeftInDeal * 1.05),
      cashFlow: formatCurrency(postRefinanceMonthlyCashFlow * 0.95),
      dscr: `${(postRefinanceDscr * 0.95).toFixed(2)}x`,
      liquidityImpact: 'Moderate',
      exitScore: 72,
      recommendation: 'Preserve reserves and confirm lender terms',
    },
    {
      scenario: 'Hold Stress - 10%',
      viability: 'Conditional',
      profit: formatCurrency(0),
      roi: formatPercent(0),
      cashReturned: formatCurrency(0),
      cashLeftInDeal: formatCurrency(totalCashInvested),
      cashFlow: formatCurrency(holdStrategy.monthlyCashFlow * 0.9),
      dscr: `${(postRefinanceDscr * 0.9).toFixed(2)}x`,
      liquidityImpact: 'Neutral',
      exitScore: 57,
      recommendation: 'Re-underwrite hold assumptions',
    },
  ];

  return buildSafeOptimizerResult({
    status: 'Ready',
    primaryExit,
    secondaryExit,
    exitToAvoid,
    recommendedTiming: refinanceReadiness === 'Ready to Refinance' ? 'Refinance Now' : rehabPercentComplete >= 60 ? 'Refinance After Rehab Completion' : 'Prepare Now',
    decisionStatus,
    reason: refinanceStrategy.exitScore >= 80 ? 'Supported refinance economics and acceptable risk support an immediate exit path.' : 'The exit path is viable but requires more data or conditions before proceeding.',
    refinanceReadiness,
    exitScore: refinanceStrategy.exitScore,
    viability: refinanceStrategy.viability,
    strategies: comparison,
    comparison,
    warnings: [],
    requiredActions: ['Collect payoff and lender terms', 'Confirm appraisal and rent support', 'Review hold assumptions'],
    refinanceAnalysis: {
      readyToRefinance: refinanceReadiness === 'Ready to Refinance',
      refinanceValue: value,
      refinanceLoanAmount,
      grossRefinanceProceeds: refinanceLoanAmount,
      netRefinanceProceeds,
      cashReturned,
      cashLeftInDeal,
      capitalRecoveryPercentage: totalCashInvested > 0 ? (cashReturned / totalCashInvested) * 100 : 0,
      newMonthlyPayment,
      postRefinanceMonthlyCashFlow,
      postRefinanceDscr,
    },
    breakEvenThresholds,
    stressTests,
    timeline: [
      {
        property: supportedProperty.propertyName || 'Unnamed Property',
        currentStage: 'Current',
        requiredMilestone: 'Appraisal and payoff',
        targetExit: primaryExit,
        targetDate: loanMaturityDate,
        loanMaturity: loanMaturityDate,
        daysAvailable: 'Insufficient Data',
        risk: refinanceReadiness === 'Ready to Refinance' ? 'Moderate' : 'Elevated',
        requiredAction: 'Collect payoff and lender terms',
      },
    ],
    known,
    uncertain,
    needed,
    capitalIntegration: {
      capitalRequired: safeNumber(refinanceStrategy.capitalRequired) + safeNumber(saleStrategy.capitalRequired),
      capitalReturned: safeNumber(refinanceStrategy.capitalReturned) + safeNumber(saleStrategy.capitalReturned),
      liquidityImpact: refinanceStrategy.capitalReturned > saleStrategy.capitalReturned ? 'Refinance' : 'Sale',
    },
    summary: {
      message: 'Refinance & Exit analysis completed for this deal.',
      estimatedCapitalReleased: formatCurrency(refinanceStrategy.capitalReturned + saleStrategy.capitalReturned),
      estimatedCapitalRequired: formatCurrency(refinanceStrategy.capitalRequired + saleStrategy.capitalRequired),
      exitScore: refinanceStrategy.exitScore,
    },
    portfolioSummary: {
      refinanceNowProperties: properties.filter((property) => property.refinanceCandidate).length,
      prepareToRefinanceProperties: properties.filter((property) => safeNumber(property.rehabPercentComplete ?? property.percentComplete) >= 60).length,
      sellNowCandidates: properties.filter((property) => safeNumber(property.currentValue ?? property.value) > 0 && safeNumber(property.currentLoanBalance ?? property.loanBalance) > 0).length,
      holdCandidates: properties.filter((property) => safeNumber(property.monthlyRent ?? property.effectiveRent) > 0).length,
      estimatedCapitalReleased: formatCurrency(refinanceStrategy.capitalReturned + saleStrategy.capitalReturned),
      estimatedCapitalRequired: formatCurrency(refinanceStrategy.capitalRequired + saleStrategy.capitalRequired),
    },
  });
}
