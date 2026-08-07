function safeNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function optionalNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function safeString(value, fallback = "Insufficient Data") {
  if (value === null || value === undefined || value === "") return fallback;
  return typeof value === "string" ? value : String(value);
}

function normalizeArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function average(values = []) {
  const valid = values.filter((value) => Number.isFinite(value));
  if (valid.length === 0) return null;
  return valid.reduce((sum, value) => sum + value, 0) / valid.length;
}

function clamp(value, min = 0, max = 100) {
  return Math.min(max, Math.max(min, value));
}

function getIndicatorRecord(key, providerStatus = {}, observedValue = null, source = "manual") {
  const status = normalizeObject(providerStatus)[key] || {};
  const configured = Boolean(status.configured);
  const active = Boolean(status.active);
  const known = observedValue !== null && observedValue !== undefined && observedValue !== "";
  return {
    metric: key,
    providerReady: true,
    configured,
    active,
    knownValue: known ? observedValue : null,
    unknown: known ? [] : ["No verified provider feed or saved value available."],
    confidence: known ? (configured ? "Moderate" : "Low") : "Insufficient Data",
    supportingEvidence: known ? [{ source, detail: "Derived from current saved assumptions or property records." }] : [],
    reasoning: known
      ? "Value is available from current records without synthesizing external market facts."
      : "No value is produced because market providers are provider-ready only and no verified feed is active.",
    notes: configured
      ? active
        ? "Provider is configured and active."
        : "Provider credentials are configured but feed is inactive in this environment."
      : "Provider credentials not configured.",
  };
}

export function buildProviderReadyMarketIntelligence(input = {}) {
  const providerStatus = normalizeObject(input.providerStatus);
  const marketSnapshot = normalizeObject(input.marketSnapshot);
  const indicators = [
    "appreciation",
    "employment",
    "population",
    "permits",
    "income",
    "demographics",
    "rentGrowth",
    "vacancy",
    "inventory",
    "daysOnMarket",
    "neighborhoodTrends",
    "investorActivity",
    "schoolReferences",
    "floodReferences",
    "crimeReferences",
    "taxReferences",
  ];

  const records = indicators.map((key) => getIndicatorRecord(key, providerStatus, marketSnapshot[key] ?? null, "market-snapshot"));
  return {
    providerReadyOnly: true,
    indicators: records,
    knownCount: records.filter((record) => record.knownValue !== null).length,
    unknownCount: records.filter((record) => record.knownValue === null).length,
  };
}

export function buildPortfolioHealthAndCapitalEngine(input = {}) {
  const properties = normalizeArray(input.properties);
  const summary = normalizeObject(input.summary);

  const value = safeNumber(summary.totalCurrentValue || properties.reduce((sum, property) => sum + safeNumber(property.currentValue), 0));
  const debt = safeNumber(summary.totalOutstandingDebt || properties.reduce((sum, property) => sum + safeNumber(property.debt || property.loanBalance || property.currentLoanBalance), 0));
  const equity = safeNumber(summary.totalEquity || (value - debt));
  const monthlyCashFlow = safeNumber(summary.totalMonthlyCashFlow || properties.reduce((sum, property) => sum + safeNumber(property.monthlyCashFlow), 0));
  const annualCashFlow = monthlyCashFlow * 12;
  const deployed = safeNumber(summary.totalCapitalInvested || value + safeNumber(summary.totalRehabBudget));
  const reserveTarget = safeNumber(summary.recommendedReserve || 0);
  const liquidity = safeNumber(summary.availableLiquidity || 0);
  const reserveShortfall = Math.max(0, reserveTarget - liquidity);

  const roi = deployed > 0 ? (annualCashFlow / deployed) * 100 : null;
  const irr = roi !== null ? roi * 0.85 : null;
  const leverage = value > 0 ? (debt / value) * 100 : null;
  const debtService = safeNumber(summary.totalMonthlyDebtService || properties.reduce((sum, property) => sum + safeNumber(property.monthlyDebtService), 0));
  const occupancy = average(properties.map((property) => optionalNumber(property.occupancyRate)).filter((value) => value !== null));

  const brrrrCount = properties.filter((property) => String(property.strategy || "").toLowerCase() === "brrrr" || String(property.strategy || "").toLowerCase() === "brrrrr").length;
  const flipCount = properties.filter((property) => String(property.strategy || "").toLowerCase() === "flip").length;
  const rentalCount = properties.filter((property) => safeNumber(property.monthlyRent) > 0).length;

  return {
    portfolioHealth: {
      totalValue: value,
      totalDebt: debt,
      totalEquity: equity,
      leverage,
      monthlyCashFlow,
      annualCashFlow,
      roi,
      irr,
      netWorth: equity,
      debtService,
      occupancy,
      cashDeployed: deployed,
      capitalRemaining: Math.max(0, liquidity - reserveTarget),
      reserveShortfall,
      strategyMix: {
        brrrr: brrrrCount,
        flip: flipCount,
        rental: rentalCount,
      },
    },
    stressTesting: {
      rentDownsideFivePct: annualCashFlow * 0.95,
      rentDownsideTenPct: annualCashFlow * 0.9,
      refinanceRateShock: leverage !== null ? leverage + 5 : null,
      cashBufferAfterShock: Math.max(0, liquidity - reserveTarget - Math.abs(annualCashFlow * 0.1)),
    },
    capitalAllocation: {
      deployableCapital: Math.max(0, liquidity - reserveTarget),
      reserveRequirement: reserveTarget,
      reserveShortfall,
      recommendation: reserveShortfall > 0 ? "Preserve Reserve" : "Deploy Selectively",
    },
  };
}

function resolveGrowthRate(explicitRate, fallbackRate) {
  const explicit = optionalNumber(explicitRate);
  if (explicit !== null) return explicit;
  const fallback = optionalNumber(fallbackRate);
  if (fallback !== null) return fallback;
  return null;
}

function buildForecastPoint(year, base, rates) {
  const valueRate = rates.valueGrowthRate;
  const rentRate = rates.rentGrowthRate;
  const expenseRate = rates.expenseGrowthRate;

  const unknown = [];
  if (valueRate === null) unknown.push("Missing appreciation/value growth rate assumption.");
  if (rentRate === null) unknown.push("Missing rent growth assumption.");
  if (expenseRate === null) unknown.push("Missing expense growth assumption.");

  if (unknown.length > 0) {
    return {
      year,
      known: {
        startingValue: base.totalValue,
        startingCashFlow: base.annualCashFlow,
      },
      unknown,
      confidence: "Insufficient Data",
      supportingEvidence: [{ source: "portfolio-summary", detail: "Current saved assumptions are incomplete for long-range forecasting." }],
      reasoning: "Forecast values are not produced when growth assumptions are missing.",
      projections: null,
    };
  }

  const projectedValue = base.totalValue * Math.pow(1 + valueRate, year);
  const projectedRent = base.annualRent * Math.pow(1 + rentRate, year);
  const projectedExpenses = base.annualExpenses * Math.pow(1 + expenseRate, year);
  const projectedCashFlow = projectedRent - projectedExpenses - base.annualDebtService;

  return {
    year,
    known: {
      valueGrowthRate: valueRate,
      rentGrowthRate: rentRate,
      expenseGrowthRate: expenseRate,
    },
    unknown,
    confidence: "Moderate",
    supportingEvidence: [{ source: "saved-assumptions", detail: "Forecast uses only current saved assumptions." }],
    reasoning: "Forecast compounds the current baseline using saved growth assumptions without external fabrication.",
    projections: {
      portfolioValue: projectedValue,
      annualCashFlow: projectedCashFlow,
      annualRent: projectedRent,
      annualExpenses: projectedExpenses,
      netWorth: projectedValue - base.totalDebt,
    },
  };
}

export function buildPortfolioLongRangeForecast(input = {}) {
  const summary = normalizeObject(input.summary);
  const assumptions = normalizeObject(input.assumptions);
  const properties = normalizeArray(input.properties);

  const totalValue = safeNumber(summary.totalCurrentValue || properties.reduce((sum, property) => sum + safeNumber(property.currentValue), 0));
  const totalDebt = safeNumber(summary.totalOutstandingDebt || properties.reduce((sum, property) => sum + safeNumber(property.currentLoanBalance || property.loanBalance || property.debt), 0));
  const annualCashFlow = safeNumber(summary.totalAnnualCashFlow || safeNumber(summary.totalMonthlyCashFlow) * 12);
  const annualRent = safeNumber(summary.totalMonthlyRent || properties.reduce((sum, property) => sum + safeNumber(property.monthlyRent), 0)) * 12;
  const annualExpenses = safeNumber(summary.totalMonthlyOperatingExpenses || properties.reduce((sum, property) => sum + safeNumber(property.monthlyOperatingExpenses), 0)) * 12;
  const annualDebtService = safeNumber(summary.totalMonthlyDebtService || properties.reduce((sum, property) => sum + safeNumber(property.monthlyDebtService), 0)) * 12;

  const rates = {
    valueGrowthRate: resolveGrowthRate(assumptions.appreciationRate, assumptions.valueGrowthRate),
    rentGrowthRate: resolveGrowthRate(assumptions.rentGrowthRate, assumptions.rentRate),
    expenseGrowthRate: resolveGrowthRate(assumptions.expenseGrowthRate, assumptions.expenseRate),
  };

  const base = { totalValue, totalDebt, annualCashFlow, annualRent, annualExpenses, annualDebtService };
  const horizons = [1, 3, 5, 10].map((year) => buildForecastPoint(year, base, rates));

  return {
    horizons,
    assumptionsUsed: rates,
    providerReadyOnly: true,
  };
}

function classifyRisk(score) {
  if (score === null) return "Insufficient Data";
  if (score >= 75) return "Critical";
  if (score >= 55) return "At Risk";
  if (score >= 35) return "Watch";
  return "Healthy";
}

export function buildEnterpriseRiskEngine(input = {}) {
  const summary = normalizeObject(input.summary);
  const properties = normalizeArray(input.properties);
  const contractors = normalizeArray(input.contractors);
  const rehabProjects = normalizeArray(input.rehabProjects);

  const leverage = optionalNumber(summary.portfolioLtvValue ?? summary.portfolioLtv);
  const monthlyCashFlow = safeNumber(summary.totalMonthlyCashFlow);
  const reserveShortfall = safeNumber(summary.reserveShortfallValue);
  const vacancyAverage = average(properties.map((property) => optionalNumber(property.vacancyRate)).filter((value) => value !== null));
  const rateExposure = average(properties.map((property) => optionalNumber(property.interestRate)).filter((value) => value !== null));
  const concentration = optionalNumber(summary.concentrationPct ?? summary.cityConcentrationPct);

  const risks = {
    capitalRisk: clamp((leverage || 0) + (reserveShortfall > 0 ? 25 : 0), 0, 100),
    cashRisk: clamp((monthlyCashFlow < 0 ? 80 : monthlyCashFlow === 0 ? 50 : 25) + (reserveShortfall > 0 ? 10 : 0), 0, 100),
    refinancingRisk: clamp((summary.upcomingMaturities ? safeNumber(summary.upcomingMaturities) * 10 : 0) + ((rateExposure || 0) > 9 ? 25 : 10), 0, 100),
    concentrationRisk: clamp((concentration || 25), 0, 100),
    marketRisk: clamp((input.marketRiskScore || 45), 0, 100),
    rehabRisk: clamp((rehabProjects.filter((project) => String(project.rehabStatus || project.projectStatus).toLowerCase().includes("delayed") || safeNumber(project.actualCost) > safeNumber(project.originalRehabBudget)).length * 18) || 20, 0, 100),
    contractorRisk: clamp((contractors.filter((contractor) => String(contractor.status || contractor.approvalStatus).toLowerCase().includes("do not use") || String(contractor.status || contractor.approvalStatus).toLowerCase().includes("suspended")).length * 22) || 18, 0, 100),
    scheduleRisk: clamp((rehabProjects.filter((project) => String(project.projectStatus || "").toLowerCase().includes("delayed")).length * 20) || 15, 0, 100),
    liquidityRisk: clamp((reserveShortfall > 0 ? 75 : 25), 0, 100),
    vacancyRisk: clamp((vacancyAverage !== null ? vacancyAverage * 10 : 35), 0, 100),
    tenantRisk: clamp((vacancyAverage !== null ? vacancyAverage * 8 : 30), 0, 100),
    interestRateExposure: clamp((rateExposure !== null ? rateExposure * 8 : 40), 0, 100),
  };

  const overall = average(Object.values(risks));
  return {
    risks,
    overallRiskScore: overall,
    overallRiskClass: classifyRisk(overall),
    blockers: Object.entries(risks).filter(([, score]) => score >= 75).map(([name]) => name),
    warnings: Object.entries(risks).filter(([, score]) => score >= 55 && score < 75).map(([name]) => name),
  };
}

function buildRecommendationRecord(name, known, unknown, confidenceScore, evidence, reasoning, action) {
  const confidence = confidenceScore >= 80 ? "High" : confidenceScore >= 60 ? "Moderate" : confidenceScore >= 40 ? "Low" : "Insufficient Data";
  return {
    recommendationType: name,
    action,
    known,
    unknown,
    confidence,
    confidenceScore,
    supportingEvidence: evidence,
    reasoning,
  };
}

export function buildEnterpriseAiDecisionSuite(input = {}) {
  const summary = normalizeObject(input.summary);
  const risk = normalizeObject(input.risk);
  const forecast = normalizeObject(input.forecast);

  const knownBase = {
    totalValue: safeNumber(summary.totalCurrentValue),
    totalDebt: safeNumber(summary.totalOutstandingDebt),
    cashFlow: safeNumber(summary.totalMonthlyCashFlow),
    reserveShortfall: safeNumber(summary.reserveShortfallValue),
  };

  const unknownBase = [];
  if (!Number.isFinite(knownBase.totalValue) || knownBase.totalValue <= 0) unknownBase.push("Portfolio value is incomplete.");
  if (!Number.isFinite(knownBase.totalDebt) || knownBase.totalDebt <= 0) unknownBase.push("Debt schedule is incomplete.");
  if (forecast.horizons && forecast.horizons.some((h) => h.projections === null)) unknownBase.push("Long-range assumptions are incomplete.");

  const leverage = knownBase.totalValue > 0 ? (knownBase.totalDebt / knownBase.totalValue) * 100 : 0;
  const confidenceBase = clamp(85 - unknownBase.length * 18, 0, 100);

  const suite = {
    acquisitions: buildRecommendationRecord(
      "acquisitions",
      knownBase,
      unknownBase,
      confidenceBase,
      [{ source: "portfolio-summary", detail: "Acquisition guidance uses saved portfolio leverage, reserves, and cash flow." }],
      "Acquire selectively only when reserves remain above target and leverage stays controlled.",
      knownBase.reserveShortfall > 0 || leverage > 70 ? "Pause Acquisitions" : "Selective Acquire"
    ),
    rehabStrategy: buildRecommendationRecord(
      "rehab strategy",
      { activeRehabs: safeNumber(summary.activeRehabs), reserveShortfall: knownBase.reserveShortfall },
      unknownBase,
      confidenceBase,
      [{ source: "rehab-summary", detail: "Rehab strategy uses active rehab count and reserve position." }],
      "Prioritize funded active rehabs before opening new scope to reduce schedule and liquidity pressure.",
      knownBase.reserveShortfall > 0 ? "Preserve Scope" : "Fund Critical Rehab"
    ),
    refinanceTiming: buildRecommendationRecord(
      "refinance timing",
      { maturities: safeNumber(summary.upcomingMaturities), leverage },
      unknownBase,
      clamp(confidenceBase - 5, 0, 100),
      [{ source: "lender-summary", detail: "Refinance timing is tied to maturities and leverage." }],
      "Refinance priority increases with upcoming maturities and high leverage.",
      safeNumber(summary.upcomingMaturities) > 0 ? "Refinance Review" : "Monitor"
    ),
    flipTiming: buildRecommendationRecord(
      "flip timing",
      { projectedFlipProfit: safeNumber(summary.totalProjectedFlipProfit), marketRisk: safeNumber(risk.marketRisk || 0) },
      unknownBase,
      clamp(confidenceBase - 8, 0, 100),
      [{ source: "profit-summary", detail: "Flip timing guidance uses projected flip profit and market risk proxy." }],
      "Accelerate exits when profit support is positive and market risk remains contained.",
      safeNumber(summary.totalProjectedFlipProfit) > 0 ? "Stage Exit Windows" : "Hold"
    ),
    holdVsSell: buildRecommendationRecord(
      "hold vs sell",
      { monthlyCashFlow: knownBase.cashFlow, leverage },
      unknownBase,
      confidenceBase,
      [{ source: "cashflow-summary", detail: "Hold vs sell compares cash flow health and leverage." }],
      "Negative cash flow combined with high leverage supports selective sell reviews.",
      knownBase.cashFlow < 0 && leverage > 70 ? "Review Sell Candidates" : "Hold"
    ),
    contractorRisk: buildRecommendationRecord(
      "contractor risk",
      { contractorRisk: safeNumber(risk.contractorRisk || 0) },
      unknownBase,
      clamp(confidenceBase - 10, 0, 100),
      [{ source: "risk-engine", detail: "Contractor risk recommendation consumes enterprise risk output." }],
      "Escalate contractor review when contractor risk score rises above threshold.",
      safeNumber(risk.contractorRisk || 0) >= 55 ? "Escalate Review" : "Standard Monitoring"
    ),
    budgetRisk: buildRecommendationRecord(
      "budget risk",
      { rehabRisk: safeNumber(risk.rehabRisk || 0), reserveShortfall: knownBase.reserveShortfall },
      unknownBase,
      clamp(confidenceBase - 6, 0, 100),
      [{ source: "rehab-risk", detail: "Budget risk uses rehab variance and reserve posture." }],
      "Contain new commitments when rehab overrun risk and reserve shortfall are elevated.",
      safeNumber(risk.rehabRisk || 0) >= 55 || knownBase.reserveShortfall > 0 ? "Contain Spend" : "Maintain Budget"
    ),
    lenderRisk: buildRecommendationRecord(
      "lender risk",
      { refinancingRisk: safeNumber(risk.refinancingRisk || 0), interestRateExposure: safeNumber(risk.interestRateExposure || 0) },
      unknownBase,
      clamp(confidenceBase - 6, 0, 100),
      [{ source: "lender-risk", detail: "Lender risk recommendation uses refinance pressure and rate exposure." }],
      "Diversify lender exposure when refinance and rate risks increase.",
      safeNumber(risk.refinancingRisk || 0) >= 55 ? "Diversify Lenders" : "Maintain Lender Mix"
    ),
    portfolioDiversification: buildRecommendationRecord(
      "portfolio diversification",
      { concentrationRisk: safeNumber(risk.concentrationRisk || 0) },
      unknownBase,
      clamp(confidenceBase - 4, 0, 100),
      [{ source: "concentration-risk", detail: "Diversification recommendation uses concentration risk score." }],
      "Increase diversification when concentration risk crosses the watch threshold.",
      safeNumber(risk.concentrationRisk || 0) >= 55 ? "Diversify Geography" : "Balanced"
    ),
    capitalDeployment: buildRecommendationRecord(
      "capital deployment",
      { reserveShortfall: knownBase.reserveShortfall, cashFlow: knownBase.cashFlow },
      unknownBase,
      confidenceBase,
      [{ source: "capital-summary", detail: "Deployment recommendation follows reserve requirement and cash flow trend." }],
      "Deploy capital only after reserve coverage is satisfied.",
      knownBase.reserveShortfall > 0 ? "Hold Deployment" : "Deploy Selectively"
    ),
    reserveRequirements: buildRecommendationRecord(
      "reserve requirements",
      { reserveTarget: safeNumber(summary.recommendedReserve), reserveShortfall: knownBase.reserveShortfall },
      unknownBase,
      confidenceBase,
      [{ source: "reserve-summary", detail: "Reserve recommendation uses current reserve target and shortfall." }],
      "Reserve protection remains mandatory when shortfall exists.",
      knownBase.reserveShortfall > 0 ? "Increase Reserve" : "Reserve Satisfied"
    ),
    refinanceProbability: buildRecommendationRecord(
      "refinance probability",
      { leverage, maturities: safeNumber(summary.upcomingMaturities) },
      unknownBase,
      clamp(confidenceBase - 7, 0, 100),
      [{ source: "maturity-summary", detail: "Probability proxy uses leverage and upcoming maturities." }],
      "Refinance probability is moderate when leverage is elevated and maturities approach.",
      leverage > 65 ? "Moderate Probability" : "Low Probability"
    ),
    dscrAnalysis: buildRecommendationRecord(
      "DSCR analysis",
      { dscr: optionalNumber(summary.portfolioDscrValue), cashFlow: knownBase.cashFlow },
      unknownBase,
      clamp(confidenceBase - 5, 0, 100),
      [{ source: "dscr-summary", detail: "DSCR recommendation uses portfolio DSCR value when available." }],
      "DSCR below threshold triggers reserve and debt-service review.",
      optionalNumber(summary.portfolioDscrValue) !== null && safeNumber(summary.portfolioDscrValue) < 1.2 ? "DSCR Watch" : "DSCR Stable"
    ),
    brrrrOptimization: buildRecommendationRecord(
      "BRRRR optimization",
      { brrrrCount: safeNumber(summary.propertiesWithRefinanceCandidate), cashFlow: knownBase.cashFlow },
      unknownBase,
      clamp(confidenceBase - 7, 0, 100),
      [{ source: "brrrr-summary", detail: "Optimization recommendation uses refinance-candidate count and cash flow trend." }],
      "BRRRR optimization requires refinance-ready assets and stable cash flow.",
      safeNumber(summary.propertiesWithRefinanceCandidate) > 0 ? "Optimize Refinance Queue" : "Build Pipeline"
    ),
  };

  return suite;
}

export function buildExecutiveAutomationAudit(input = {}) {
  const updates = normalizeArray(input.updates);
  const events = updates.map((entry, index) => ({
    id: entry.id || `auto-event-${index + 1}`,
    module: safeString(entry.module, "portfolio-dashboard"),
    action: safeString(entry.action, "refresh"),
    timestamp: safeString(entry.timestamp, new Date().toISOString()),
    preservesApprovedVersions: true,
    auditOnly: true,
  }));

  return {
    autoRefreshEnabled: true,
    auditEvents: events,
    protectedVersionPolicy: {
      overwriteApprovedVersions: false,
      appendOnlyHistory: true,
    },
  };
}

export function buildPortfolioEnterpriseUpgradeEngine(input = {}) {
  const summary = normalizeObject(input.summary);
  const properties = normalizeArray(input.properties);
  const contractors = normalizeArray(input.contractors);
  const rehabProjects = normalizeArray(input.rehabProjects);

  const market = buildProviderReadyMarketIntelligence({
    providerStatus: normalizeObject(input.providerStatus),
    marketSnapshot: normalizeObject(input.marketSnapshot),
  });

  const portfolio = buildPortfolioHealthAndCapitalEngine({
    summary,
    properties,
  });

  const forecast = buildPortfolioLongRangeForecast({
    summary,
    properties,
    assumptions: normalizeObject(input.assumptions),
  });

  const risk = buildEnterpriseRiskEngine({
    summary,
    properties,
    contractors,
    rehabProjects,
    marketRiskScore: safeNumber(input.marketRiskScore || 45),
  });

  const ai = buildEnterpriseAiDecisionSuite({
    summary,
    risk: {
      ...risk.risks,
      marketRisk: safeNumber(input.marketRiskScore || 45),
    },
    forecast,
  });

  const automation = buildExecutiveAutomationAudit({ updates: normalizeArray(input.auditUpdates) });

  const dashboardKpis = {
    portfolioKpis: {
      totalValue: portfolio.portfolioHealth.totalValue,
      totalEquity: portfolio.portfolioHealth.totalEquity,
      netWorth: portfolio.portfolioHealth.netWorth,
      roi: portfolio.portfolioHealth.roi,
      irr: portfolio.portfolioHealth.irr,
      occupancy: portfolio.portfolioHealth.occupancy,
    },
    capitalKpis: {
      cashDeployed: portfolio.portfolioHealth.cashDeployed,
      capitalRemaining: portfolio.portfolioHealth.capitalRemaining,
      leverage: portfolio.portfolioHealth.leverage,
      reserveShortfall: portfolio.portfolioHealth.reserveShortfall,
    },
    pipelineKpis: {
      activeRehabs: safeNumber(summary.activeRehabs),
      activeDeals: safeNumber(summary.activeDeals),
      refinanceCandidates: safeNumber(summary.propertiesWithRefinanceCandidate),
    },
    riskKpis: {
      overallRiskScore: risk.overallRiskScore,
      overallRiskClass: risk.overallRiskClass,
      blockers: risk.blockers.length,
      warnings: risk.warnings.length,
    },
    rehabKpis: {
      rehabRisk: risk.risks.rehabRisk,
      scheduleRisk: risk.risks.scheduleRisk,
    },
    contractorKpis: {
      contractorRisk: risk.risks.contractorRisk,
      trackedContractors: contractors.length,
    },
    vendorKpis: {
      vendorRiskProxy: clamp((safeNumber(input.vendorRiskScore || 40)), 0, 100),
      trackedVendors: safeNumber(input.vendorCount || 0),
    },
    forecastKpis: {
      horizonCount: forecast.horizons.length,
      firstHorizonConfidence: safeString(forecast.horizons[0]?.confidence || "Insufficient Data"),
      longRangeReady: forecast.horizons.every((entry) => entry.projections !== null),
    },
    marketKpis: {
      knownIndicators: market.knownCount,
      unknownIndicators: market.unknownCount,
      providerReadyOnly: true,
    },
  };

  return {
    market,
    portfolio,
    forecast,
    risk,
    ai,
    automation,
    dashboardKpis,
  };
}
