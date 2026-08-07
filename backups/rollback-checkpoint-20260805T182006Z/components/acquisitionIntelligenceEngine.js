function safeNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function safeString(value, fallback = "") {
  if (value === null || value === undefined) return fallback;
  const normalized = String(value).trim();
  return normalized || fallback;
}

function nowIso() {
  return new Date().toISOString();
}

function withEvidence(value, options = {}) {
  return {
    value,
    source: options.source || "manual",
    confidence: options.confidence || "Moderate",
    verificationStatus: options.verificationStatus || "Preliminary",
    effectiveDate: options.effectiveDate || nowIso(),
    lastUpdatedDate: options.lastUpdatedDate || nowIso(),
    overrideStatus: Boolean(options.overrideStatus),
    auditReference: options.auditReference || "audit:manual-entry",
  };
}

function getEvidenceValue(section = {}, key, fallback = null) {
  return section?.[key]?.value ?? fallback;
}

const DEFAULT_BUY_BOX_POLICY = {
  version: "rs-policy-v1",
  markets: ["Covington, Kentucky", "Cincinnati, Ohio"],
  permittedPropertyTypes: ["Single Family", "Duplex", "Triplex", "Quadplex", "2-4 Unit"],
  prohibitedPropertyTypes: ["Mobile Home Park", "RV Park", "Storage", "Vacant Land"],
  preferredMaxSquareFeet: 1800,
  preferredRehabMax: 60000,
  stretchRehabMax: 100000,
  zipRules: {
    covingtonPrimary: ["41011", "41014", "41016", "41017"],
    covingtonSelective: ["41015"],
    cincinnatiPrimary: ["45211", "45224", "45239"],
    cincinnatiSelective: ["45205", "45238", "45231", "45223", "45232"],
  },
  riskLimits: {
    maxCashExposure: 180000,
    minReserveAfterClosing: 20000,
    minRoi: 0.12,
  },
};

const ACQUISITION_DECISION_STATUSES = [
  "Draft",
  "Screening",
  "Under Review",
  "Missing Information",
  "Negotiation Recommended",
  "Conditional Approval",
  "Approved",
  "Rejected",
  "Deferred",
  "Superseded",
  "Closed",
  "Archived",
];

export function buildAcquisitionUnderwritingInput({ deal = {}, policy = DEFAULT_BUY_BOX_POLICY } = {}) {
  const address = safeString(deal.propertyAddress || deal.address, "Insufficient Data");
  const zip = safeString(deal.zipCode || deal.zip, "");
  const propertyType = safeString(deal.propertyType, "Single Family");
  const purchasePrice = safeNumber(deal.purchasePrice || deal.askingPrice);
  const rehabBudget = safeNumber(deal.rehabBudget);
  const activeArv = safeNumber(deal.activeArv || deal.estimatedArv || deal.arv);
  const estimatedRent = safeNumber(deal.estimatedRent || deal.monthlyRent);
  const taxes = safeNumber(deal.taxes);
  const insurance = safeNumber(deal.insurance);
  const loanAmount = safeNumber(deal.actualLoanAmount || deal.loanAmount);
  const interestRate = safeNumber(deal.annualInterestRate || deal.interestRate);
  const holdingMonths = safeNumber(deal.holdingMonths);
  const sellingCostPercent = safeNumber(deal.sellingCostPercent || 8);

  return {
    propertyIdentity: {
      propertyId: withEvidence(deal.id || "unknown-property"),
      address: withEvidence(address),
      city: withEvidence(safeString(deal.city, "Insufficient Data")),
      state: withEvidence(safeString(deal.state, "Insufficient Data")),
      zipCode: withEvidence(zip || "Insufficient Data"),
      county: withEvidence(safeString(deal.county, "Insufficient Data")),
      propertyType: withEvidence(propertyType),
      unitCount: withEvidence(safeNumber(deal.unitCount || deal.units || 1)),
      bedrooms: withEvidence(safeNumber(deal.bedrooms)),
      bathrooms: withEvidence(safeNumber(deal.bathrooms)),
      squareFeet: withEvidence(safeNumber(deal.squareFeet)),
      lotSize: withEvidence(safeNumber(deal.lotSize)),
      yearBuilt: withEvidence(safeNumber(deal.yearBuilt)),
      stories: withEvidence(safeNumber(deal.stories)),
      garage: withEvidence(safeString(deal.garage, "Insufficient Data")),
      basement: withEvidence(safeString(deal.basement, "Insufficient Data")),
      occupancy: withEvidence(safeString(deal.occupancy, "Insufficient Data")),
      condition: withEvidence(safeString(deal.condition, "Average")),
      zoning: withEvidence(safeString(deal.zoning, "Insufficient Data")),
      parcelId: withEvidence(safeString(deal.parcelId, "Insufficient Data")),
    },
    acquisition: {
      askingPrice: withEvidence(safeNumber(deal.askingPrice || purchasePrice)),
      proposedPurchasePrice: withEvidence(purchasePrice),
      earnestMoney: withEvidence(safeNumber(deal.earnestMoney)),
      assignmentFee: withEvidence(safeNumber(deal.assignmentFee)),
      acquisitionClosingCosts: withEvidence(safeNumber(deal.acquisitionClosingCosts || deal.closingCosts)),
      dueDiligenceCosts: withEvidence(safeNumber(deal.dueDiligenceCosts)),
      titleCosts: withEvidence(safeNumber(deal.titleCosts)),
      acquisitionDate: withEvidence(safeString(deal.acquisitionDate || deal.purchaseDate, "Insufficient Data")),
      leadSource: withEvidence(safeString(deal.leadSource, "Insufficient Data")),
      sellerMotivation: withEvidence(safeString(deal.sellerMotivation, "Insufficient Data")),
      competingOfferStatus: withEvidence(safeString(deal.competingOfferStatus, "Insufficient Data")),
    },
    valuation: {
      activeArv: withEvidence(activeArv, { verificationStatus: deal.activeArv ? "Approved" : "Preliminary" }),
      supportedArv: withEvidence(safeNumber(deal.supportedArv || activeArv)),
      lowArv: withEvidence(safeNumber(deal.lowArv || activeArv * 0.95)),
      likelyArv: withEvidence(activeArv),
      highArv: withEvidence(safeNumber(deal.highArv || activeArv * 1.05)),
      arvConfidence: withEvidence(safeString(deal.arvConfidence, "Preliminary")),
      valuationVersion: withEvidence(safeString(deal.valuationVersion, "v1")),
      approvedCompCount: withEvidence(safeNumber(deal.approvedCompCount)),
      valuationFreshness: withEvidence(safeString(deal.valuationFreshness, "Unknown")),
      fragileAssumptions: withEvidence(Array.isArray(deal.fragileAssumptions) ? deal.fragileAssumptions : []),
      decisionBreakingArv: withEvidence(safeNumber(deal.decisionBreakingArv || activeArv * 0.9)),
    },
    rehab: {
      currentRehabBudget: withEvidence(rehabBudget),
      laborBudget: withEvidence(safeNumber(deal.laborBudget)),
      materialBudget: withEvidence(safeNumber(deal.materialBudget)),
      contingency: withEvidence(safeNumber(deal.contingency || rehabBudget * 0.1)),
      projectedTimeline: withEvidence(safeNumber(deal.holdingMonths || holdingMonths)),
      scopeCompleteness: withEvidence(safeString(deal.scopeCompleteness, "Estimated")),
      contractorStatus: withEvidence(safeString(deal.contractorStatus, "Insufficient Data")),
      permits: withEvidence(safeString(deal.permits, "Insufficient Data")),
      majorSystems: withEvidence(safeString(deal.majorSystems, "Insufficient Data")),
      complexityScore: withEvidence(safeNumber(deal.complexityScore)),
      unfinishedAssumptions: withEvidence(Array.isArray(deal.unfinishedAssumptions) ? deal.unfinishedAssumptions : []),
    },
    financing: {
      loanAmount: withEvidence(loanAmount),
      interestRate: withEvidence(interestRate),
      points: withEvidence(safeNumber(deal.points)),
      originationFees: withEvidence(safeNumber(deal.originationFee || deal.originationFees)),
      lenderFees: withEvidence(safeNumber(deal.lenderFees)),
      drawFees: withEvidence(safeNumber(deal.drawFees)),
      extensionFees: withEvidence(safeNumber(deal.extensionFees)),
      appraisalFees: withEvidence(safeNumber(deal.appraisalFees)),
      inspectionFees: withEvidence(safeNumber(deal.inspectionFees)),
      monthlyInterest: withEvidence(loanAmount > 0 ? (loanAmount * (interestRate / 100)) / 12 : 0),
      financingCosts: withEvidence(safeNumber(deal.financingCosts || deal.financingCost)),
      requiredCash: withEvidence(safeNumber(deal.requiredCash || deal.cashRequired)),
      loanToCost: withEvidence(safeNumber(deal.loanToCost)),
      loanToValue: withEvidence(safeNumber(deal.loanToValue)),
      maturity: withEvidence(safeString(deal.maturity, "Insufficient Data")),
      drawSchedule: withEvidence(Array.isArray(deal.drawSchedule) ? deal.drawSchedule : []),
      reserveRequirement: withEvidence(safeNumber(deal.reserveRequirement)),
    },
    operations: {
      taxes: withEvidence(taxes),
      insurance: withEvidence(insurance),
      utilities: withEvidence(safeNumber(deal.utilities)),
      maintenance: withEvidence(safeNumber(deal.maintenance)),
      propertyManagement: withEvidence(safeNumber(deal.propertyManagement)),
      hoa: withEvidence(safeNumber(deal.hoa)),
      vacancy: withEvidence(safeNumber(deal.vacancy || 0.05)),
      holdingMonths: withEvidence(holdingMonths),
      sellingCosts: withEvidence(safeNumber(deal.sellingCosts || activeArv * (sellingCostPercent / 100))),
      brokerageCommission: withEvidence(safeNumber(deal.brokerageCommission)),
      transferTaxes: withEvidence(safeNumber(deal.transferTaxes)),
      concessions: withEvidence(safeNumber(deal.concessions)),
      rent: withEvidence(estimatedRent),
      otherIncome: withEvidence(safeNumber(deal.otherIncome)),
      operatingExpenses: withEvidence(safeNumber(deal.operatingExpenses)),
    },
    market: {
      marketScore: withEvidence(safeNumber(deal.marketScore)),
      neighborhoodScore: withEvidence(safeNumber(deal.neighborhoodScore)),
      rentalDemand: withEvidence(safeString(deal.rentalDemand, "Insufficient Data")),
      liquidity: withEvidence(safeString(deal.liquidity, "Insufficient Data")),
      daysOnMarket: withEvidence(safeNumber(deal.daysOnMarket)),
      priceTrend: withEvidence(safeString(deal.priceTrend, "Insufficient Data")),
      rentTrend: withEvidence(safeString(deal.rentTrend, "Insufficient Data")),
      inventory: withEvidence(safeString(deal.inventory, "Insufficient Data")),
      sourceQuality: withEvidence(safeString(deal.sourceQuality, "Preliminary")),
      dataFreshness: withEvidence(safeString(deal.dataFreshness, "Unknown")),
    },
    royalStarPolicy: {
      buyBoxRules: withEvidence(policy),
      targetProfit: withEvidence(safeNumber(deal.targetProfit || 30000)),
      targetRoi: withEvidence(safeNumber(deal.targetRoi || 0.12)),
      targetCashOnCashReturn: withEvidence(safeNumber(deal.targetCashOnCashReturn || 0.12)),
      maximumRehab: withEvidence(policy.stretchRehabMax),
      maximumTimeline: withEvidence(safeNumber(deal.maximumTimeline || 12)),
      maximumCashExposure: withEvidence(policy.riskLimits.maxCashExposure),
      minimumReserveAfterClosing: withEvidence(policy.riskLimits.minReserveAfterClosing),
      permittedPropertyTypes: withEvidence(policy.permittedPropertyTypes),
      permittedMarkets: withEvidence(policy.markets),
      approvedStrategies: withEvidence(["Flip", "BRRRR", "Long-Term Rental", "Wholesale"]),
      riskLimits: withEvidence(policy.riskLimits),
    },
  };
}

export function createAcquisitionReadinessService() {
  return {
    evaluate(input) {
      const purchasePrice = safeNumber(getEvidenceValue(input.acquisition, "proposedPurchasePrice", 0));
      const activeArv = safeNumber(getEvidenceValue(input.valuation, "activeArv", 0));
      const rehabBudget = safeNumber(getEvidenceValue(input.rehab, "currentRehabBudget", 0));
      const financingRate = safeNumber(getEvidenceValue(input.financing, "interestRate", 0));
      const rent = safeNumber(getEvidenceValue(input.operations, "rent", 0));
      const saleCosts = safeNumber(getEvidenceValue(input.operations, "sellingCosts", 0));
      const operatingExpenses = safeNumber(getEvidenceValue(input.operations, "operatingExpenses", 0));

      const criticalBlockers = [];
      const decisionBlockers = [];
      const warnings = [];
      const evidenceStillRequired = [];

      if (purchasePrice <= 0) criticalBlockers.push("purchase price is missing");
      if (activeArv <= 0) criticalBlockers.push("active ARV is missing");
      if (rehabBudget <= 0) decisionBlockers.push("rehab budget is missing");
      if (financingRate <= 0) decisionBlockers.push("financing terms missing");
      if (saleCosts <= 0) decisionBlockers.push("sale-cost assumptions missing");
      if (operatingExpenses <= 0) warnings.push("operating expenses are incomplete");
      if (rent <= 0) warnings.push("rent support missing");
      if (safeString(getEvidenceValue(input.valuation, "arvConfidence", "Preliminary")).toLowerCase().includes("preliminary")) {
        warnings.push("preliminary ARV caps decision confidence");
      }
      if (safeString(getEvidenceValue(input.rehab, "scopeCompleteness", "Estimated")).toLowerCase() !== "verified") {
        warnings.push("rehab scope is unverified");
      }

      let readiness = "Final Approval Ready";
      if (criticalBlockers.length > 0) readiness = "Not Ready";
      else if (decisionBlockers.length > 0) readiness = "Preliminary Review Only";
      else if (warnings.length > 0) readiness = "Conditional Approval Ready";
      else if (rent <= 0 || operatingExpenses <= 0) readiness = "Offer Guidance Ready";

      if (criticalBlockers.length > 0) evidenceStillRequired.push(...criticalBlockers);
      if (decisionBlockers.length > 0) evidenceStillRequired.push(...decisionBlockers);

      return {
        status: readiness,
        criticalBlockers,
        decisionBlockers,
        warnings,
        missingDocuments: evidenceStillRequired,
        conflictingValues: [],
        staleAssumptions: [],
        evidenceStillRequired,
        confidenceCeiling: warnings.length > 0 ? "Moderate" : "High",
      };
    },
  };
}

export function buildProjectCostEngine(input) {
  const acquisition = input.acquisition;
  const rehab = input.rehab;
  const financing = input.financing;
  const operations = input.operations;
  const valuation = input.valuation;

  const acquisitionCosts = {
    purchasePrice: safeNumber(getEvidenceValue(acquisition, "proposedPurchasePrice", 0)),
    assignmentFee: safeNumber(getEvidenceValue(acquisition, "assignmentFee", 0)),
    acquisitionClosingCosts: safeNumber(getEvidenceValue(acquisition, "acquisitionClosingCosts", 0)),
    dueDiligence: safeNumber(getEvidenceValue(acquisition, "dueDiligenceCosts", 0)),
    titleAndRecording: safeNumber(getEvidenceValue(acquisition, "titleCosts", 0)),
  };
  const rehabCosts = {
    labor: safeNumber(getEvidenceValue(rehab, "laborBudget", 0)),
    materials: safeNumber(getEvidenceValue(rehab, "materialBudget", 0)),
    contingency: safeNumber(getEvidenceValue(rehab, "contingency", 0)),
    otherRehabCosts: Math.max(0, safeNumber(getEvidenceValue(rehab, "currentRehabBudget", 0)) - safeNumber(getEvidenceValue(rehab, "laborBudget", 0)) - safeNumber(getEvidenceValue(rehab, "materialBudget", 0))),
  };
  const financingCosts = {
    interest: safeNumber(getEvidenceValue(financing, "monthlyInterest", 0)) * Math.max(1, safeNumber(getEvidenceValue(operations, "holdingMonths", 0))),
    points: safeNumber(getEvidenceValue(financing, "points", 0)),
    origination: safeNumber(getEvidenceValue(financing, "originationFees", 0)),
    appraisal: safeNumber(getEvidenceValue(financing, "appraisalFees", 0)),
    inspections: safeNumber(getEvidenceValue(financing, "inspectionFees", 0)),
    drawFees: safeNumber(getEvidenceValue(financing, "drawFees", 0)),
    extensionFees: safeNumber(getEvidenceValue(financing, "extensionFees", 0)),
    lenderLegalFees: safeNumber(getEvidenceValue(financing, "lenderFees", 0)),
    servicing: 0,
    otherFinancingCosts: Math.max(0, safeNumber(getEvidenceValue(financing, "financingCosts", 0)) - safeNumber(getEvidenceValue(financing, "originationFees", 0))),
  };
  const holdingCosts = {
    taxes: safeNumber(getEvidenceValue(operations, "taxes", 0)) * (Math.max(1, safeNumber(getEvidenceValue(operations, "holdingMonths", 0))) / 12),
    insurance: safeNumber(getEvidenceValue(operations, "insurance", 0)) * (Math.max(1, safeNumber(getEvidenceValue(operations, "holdingMonths", 0))) / 12),
    utilities: safeNumber(getEvidenceValue(operations, "utilities", 0)) * Math.max(1, safeNumber(getEvidenceValue(operations, "holdingMonths", 0))),
    maintenance: safeNumber(getEvidenceValue(operations, "maintenance", 0)) * Math.max(1, safeNumber(getEvidenceValue(operations, "holdingMonths", 0))),
    hoa: safeNumber(getEvidenceValue(operations, "hoa", 0)) * Math.max(1, safeNumber(getEvidenceValue(operations, "holdingMonths", 0))),
    propertyManagement: safeNumber(getEvidenceValue(operations, "propertyManagement", 0)) * Math.max(1, safeNumber(getEvidenceValue(operations, "holdingMonths", 0))),
  };
  const dispositionCosts = {
    brokerCommission: safeNumber(getEvidenceValue(operations, "brokerageCommission", 0)),
    transferTaxes: safeNumber(getEvidenceValue(operations, "transferTaxes", 0)),
    concessions: safeNumber(getEvidenceValue(operations, "concessions", 0)),
    otherSellingCosts: safeNumber(getEvidenceValue(operations, "sellingCosts", 0)),
  };

  const sum = (obj) => Object.values(obj).reduce((acc, value) => acc + safeNumber(value), 0);
  const totalAcquisitionBasis = sum(acquisitionCosts);
  const totalRehabBasis = sum(rehabCosts);
  const totalFinancingCost = sum(financingCosts);
  const totalHoldingCost = sum(holdingCosts);
  const totalDispositionCost = sum(dispositionCosts);
  const allInCost = totalAcquisitionBasis + totalRehabBasis + totalFinancingCost + totalHoldingCost + totalDispositionCost;
  const loanProceeds = safeNumber(getEvidenceValue(financing, "loanAmount", 0));
  const totalCashRequired = Math.max(0, allInCost - loanProceeds);
  const activeArv = safeNumber(getEvidenceValue(valuation, "activeArv", 0));
  const costPerSquareFoot = safeNumber(getEvidenceValue(input.propertyIdentity, "squareFeet", 0)) > 0 ? allInCost / safeNumber(getEvidenceValue(input.propertyIdentity, "squareFeet", 1)) : 0;

  return {
    acquisitionCosts,
    rehabCosts,
    financingCosts,
    holdingCosts,
    dispositionCosts,
    totalAcquisitionBasis,
    totalRehabBasis,
    totalFinancingCost,
    totalHoldingCost,
    totalDispositionCost,
    allInCost,
    totalCashRequired,
    peakCashExposure: totalCashRequired,
    reserveAfterClosing: safeNumber(getEvidenceValue(input.royalStarPolicy, "minimumReserveAfterClosing", 0)) - Math.max(0, totalCashRequired * 0.1),
    reserveAfterRehab: safeNumber(getEvidenceValue(input.royalStarPolicy, "minimumReserveAfterClosing", 0)) - Math.max(0, totalCashRequired * 0.2),
    costPerSquareFoot,
    costPerBedroom: safeNumber(getEvidenceValue(input.propertyIdentity, "bedrooms", 0)) > 0 ? allInCost / safeNumber(getEvidenceValue(input.propertyIdentity, "bedrooms", 1)) : 0,
    contingencyCoverage: totalRehabBasis > 0 ? safeNumber(getEvidenceValue(input.rehab, "contingency", 0)) / totalRehabBasis : 0,
    budgetCompleteness: totalAcquisitionBasis > 0 && totalRehabBasis > 0 ? "Complete" : "Incomplete",
    unknownCosts: allInCost <= 0 ? ["cost basis missing"] : [],
    breakEvenSalePrice: activeArv > 0 ? Math.max(allInCost, activeArv * 0.8) : allInCost,
    formulaVersion: "acq-cost-v1",
  };
}

export function buildFlipUnderwritingEngine(input, costs) {
  const arv = safeNumber(getEvidenceValue(input.valuation, "activeArv", 0));
  const conservativeSalePrice = safeNumber(getEvidenceValue(input.valuation, "lowArv", arv * 0.95));
  const aggressiveSalePrice = safeNumber(getEvidenceValue(input.valuation, "highArv", arv * 1.05));
  const projectedSalePrice = safeNumber(getEvidenceValue(input.valuation, "likelyArv", arv));
  const netProjectedProfit = projectedSalePrice - costs.allInCost;
  const baseRoi = costs.allInCost > 0 ? netProjectedProfit / costs.allInCost : 0;
  return {
    projectedSalePrice,
    conservativeSalePrice,
    aggressiveSalePrice,
    grossSpread: projectedSalePrice - safeNumber(getEvidenceValue(input.acquisition, "proposedPurchasePrice", 0)),
    totalProjectCost: costs.allInCost,
    netProjectedProfit,
    profitMargin: projectedSalePrice > 0 ? netProjectedProfit / projectedSalePrice : 0,
    roiOnTotalCost: baseRoi,
    roiOnCashInvested: costs.totalCashRequired > 0 ? netProjectedProfit / costs.totalCashRequired : 0,
    annualizedRoi: baseRoi,
    breakEvenSalePrice: costs.breakEvenSalePrice,
    breakEvenArv: costs.breakEvenSalePrice,
    breakEvenPurchasePrice: projectedSalePrice - (costs.allInCost - safeNumber(getEvidenceValue(input.acquisition, "proposedPurchasePrice", 0))),
    breakEvenHoldingPeriod: safeNumber(getEvidenceValue(input.operations, "holdingMonths", 0)),
    maximumTolerableRehabOverrun: Math.max(0, netProjectedProfit * 0.5),
    maximumTolerableSaleDiscount: Math.max(0, netProjectedProfit * 0.6),
    minimumRequiredSalePrice: costs.allInCost,
    projectedTaxExposureInfoOnly: Math.max(0, netProjectedProfit) * 0.2,
    capitalVelocity: safeNumber(getEvidenceValue(input.operations, "holdingMonths", 0)) > 0 ? netProjectedProfit / Math.max(1, safeNumber(getEvidenceValue(input.operations, "holdingMonths", 1))) : 0,
    profitPerMonth: safeNumber(getEvidenceValue(input.operations, "holdingMonths", 0)) > 0 ? netProjectedProfit / Math.max(1, safeNumber(getEvidenceValue(input.operations, "holdingMonths", 1))) : 0,
    profitPerSquareFoot: safeNumber(getEvidenceValue(input.propertyIdentity, "squareFeet", 0)) > 0 ? netProjectedProfit / safeNumber(getEvidenceValue(input.propertyIdentity, "squareFeet", 1)) : 0,
  };
}

export function buildBrrrrUnderwritingEngine(input, costs) {
  const stabilizedValue = safeNumber(getEvidenceValue(input.valuation, "likelyArv", 0));
  const refinanceLtv = 0.75;
  const refinanceLoanAmount = stabilizedValue * refinanceLtv;
  const rent = safeNumber(getEvidenceValue(input.operations, "rent", 0));
  const opEx = safeNumber(getEvidenceValue(input.operations, "operatingExpenses", 0));
  const monthlyPi = refinanceLoanAmount > 0 ? refinanceLoanAmount * 0.007 : 0;
  const noi = rent - opEx;
  const dscr = monthlyPi > 0 ? noi / monthlyPi : 0;
  const cashReturned = Math.max(0, refinanceLoanAmount - safeNumber(getEvidenceValue(input.financing, "loanAmount", 0)));
  const cashLeftInDeal = Math.max(0, costs.totalCashRequired - cashReturned);
  return {
    allInBasis: costs.allInCost,
    stabilizedValue,
    refinanceValue: stabilizedValue,
    refinanceLtv,
    refinanceLoanAmount,
    closingCosts: safeNumber(getEvidenceValue(input.operations, "sellingCosts", 0)) * 0.25,
    lenderReserves: safeNumber(getEvidenceValue(input.financing, "reserveRequirement", 0)),
    cashOutProceeds: cashReturned,
    originalLoanPayoff: safeNumber(getEvidenceValue(input.financing, "loanAmount", 0)),
    cashRemainingInDeal: cashLeftInDeal,
    cashReturnedToInvestor: cashReturned,
    excessCashReceived: Math.max(0, cashReturned - costs.totalCashRequired),
    monthlyPrincipalAndInterest: monthlyPi,
    taxes: safeNumber(getEvidenceValue(input.operations, "taxes", 0)) / 12,
    insurance: safeNumber(getEvidenceValue(input.operations, "insurance", 0)) / 12,
    propertyManagement: safeNumber(getEvidenceValue(input.operations, "propertyManagement", 0)),
    repairsAndMaintenance: safeNumber(getEvidenceValue(input.operations, "maintenance", 0)),
    vacancy: safeNumber(getEvidenceValue(input.operations, "vacancy", 0)),
    capitalExpenditures: safeNumber(getEvidenceValue(input.rehab, "contingency", 0)) * 0.15,
    utilities: safeNumber(getEvidenceValue(input.operations, "utilities", 0)),
    hoa: safeNumber(getEvidenceValue(input.operations, "hoa", 0)),
    netOperatingIncome: noi,
    dscr,
    debtYield: refinanceLoanAmount > 0 ? (noi * 12) / refinanceLoanAmount : 0,
    capRate: stabilizedValue > 0 ? (noi * 12) / stabilizedValue : 0,
    cashOnCashReturn: costs.totalCashRequired > 0 ? (noi * 12) / costs.totalCashRequired : 0,
    monthlyCashFlow: noi - monthlyPi,
    annualCashFlow: (noi - monthlyPi) * 12,
    equityCreated: Math.max(0, stabilizedValue - costs.allInCost),
    equityCapturePercentage: stabilizedValue > 0 ? Math.max(0, stabilizedValue - costs.allInCost) / stabilizedValue : 0,
  };
}

export function buildRentalHoldUnderwritingEngine(input, brrrr) {
  const grossRent = safeNumber(getEvidenceValue(input.operations, "rent", 0));
  const otherIncome = safeNumber(getEvidenceValue(input.operations, "otherIncome", 0));
  const vacancy = safeNumber(getEvidenceValue(input.operations, "vacancy", 0.05));
  const egi = (grossRent + otherIncome) * (1 - vacancy);
  const operatingExpenses = safeNumber(getEvidenceValue(input.operations, "operatingExpenses", 0));
  const noi = egi - operatingExpenses;
  const debtService = brrrr.monthlyPrincipalAndInterest;
  return {
    grossScheduledRent: grossRent,
    otherIncome,
    vacancy,
    effectiveGrossIncome: egi,
    operatingExpenses,
    noi,
    capRate: brrrr.stabilizedValue > 0 ? (noi * 12) / brrrr.stabilizedValue : 0,
    debtService,
    dscr: debtService > 0 ? noi / debtService : 0,
    debtYield: brrrr.refinanceLoanAmount > 0 ? (noi * 12) / brrrr.refinanceLoanAmount : 0,
    monthlyCashFlow: noi - debtService,
    annualCashFlow: (noi - debtService) * 12,
    cashOnCashReturn: brrrr.cashRemainingInDeal > 0 ? ((noi - debtService) * 12) / brrrr.cashRemainingInDeal : 0,
    operatingExpenseRatio: egi > 0 ? operatingExpenses / egi : 0,
    breakEvenOccupancy: grossRent > 0 ? (operatingExpenses + debtService) / grossRent : 1,
    reserveRequirement: safeNumber(getEvidenceValue(input.financing, "reserveRequirement", 0)),
  };
}

export function buildWholesaleScreeningEngine(input, flip, costs) {
  const likelyInvestorPurchaseCeiling = Math.max(0, safeNumber(getEvidenceValue(input.valuation, "lowArv", 0)) - safeNumber(getEvidenceValue(input.rehab, "currentRehabBudget", 0)) - 30000);
  const estimatedAssignmentSpread = Math.max(0, likelyInvestorPurchaseCeiling - safeNumber(getEvidenceValue(input.acquisition, "proposedPurchasePrice", 0)));
  return {
    likelyInvestorPurchaseCeiling,
    estimatedAssignmentSpread,
    endBuyerAllInBasis: costs.allInCost,
    endBuyerProjectedProfit: flip.netProjectedProfit,
    endBuyerRoi: flip.roiOnTotalCost,
    assignmentBreakEven: likelyInvestorPurchaseCeiling,
    buyerRiskWarnings: estimatedAssignmentSpread <= 0 ? ["no assignment spread"] : [],
    marketabilityScore: estimatedAssignmentSpread > 0 ? 70 : 35,
    dispositionUrgency: estimatedAssignmentSpread > 0 ? "Moderate" : "High",
    wholesaleViability: estimatedAssignmentSpread > 0 ? "Viable" : "Weak",
  };
}

export function buildMaximumAllowableOfferEngine(input, flip, brrrr, rental, wholesale) {
  const purchasePrice = safeNumber(getEvidenceValue(input.acquisition, "proposedPurchasePrice", 0));
  const flipTarget = Math.max(0, safeNumber(getEvidenceValue(input.valuation, "activeArv", 0)) - safeNumber(getEvidenceValue(input.rehab, "currentRehabBudget", 0)) - 30000);
  const brrrrTarget = Math.max(0, brrrr.refinanceLoanAmount - 25000);
  const rentalTarget = Math.max(0, safeNumber(getEvidenceValue(input.operations, "rent", 0)) * 120);
  const wholesaleTarget = wholesale.likelyInvestorPurchaseCeiling;
  const binding = [
    { method: "Flip Target", value: flipTarget },
    { method: "BRRRR Constraint", value: brrrrTarget },
    { method: "Rental Constraint", value: rentalTarget },
    { method: "Wholesale Ceiling", value: wholesaleTarget },
  ].sort((a, b) => a.value - b.value)[0];
  const maxOffer = Math.max(0, binding.value);
  return {
    maximumTheoreticalOffer: maxOffer,
    recommendedOpeningOffer: Math.max(0, maxOffer * 0.92),
    recommendedTargetOffer: Math.max(0, maxOffer * 0.97),
    recommendedWalkAwayPrice: maxOffer,
    currentAskingPriceGap: purchasePrice - maxOffer,
    currentProposedPriceGap: purchasePrice - maxOffer,
    negotiationRoom: Math.max(0, purchasePrice - maxOffer),
    offerConfidence: safeString(getEvidenceValue(input.valuation, "arvConfidence", "Low")),
    bindingConstraint: binding.method,
    calculationExplanation: `Offer is constrained by ${binding.method} under current assumptions.`,
  };
}

export function buildRoyalStarBuyBoxEngine(input, policy = DEFAULT_BUY_BOX_POLICY) {
  const market = `${safeString(getEvidenceValue(input.propertyIdentity, "city", ""))}, ${safeString(getEvidenceValue(input.propertyIdentity, "state", ""))}`;
  const zip = safeString(getEvidenceValue(input.propertyIdentity, "zipCode", ""));
  const propertyType = safeString(getEvidenceValue(input.propertyIdentity, "propertyType", ""));
  const squareFeet = safeNumber(getEvidenceValue(input.propertyIdentity, "squareFeet", 0));
  const rehabBudget = safeNumber(getEvidenceValue(input.rehab, "currentRehabBudget", 0));

  const results = [];
  const addRule = (rule, pass, explanation, severity = "Warning") => {
    results.push({
      rule,
      result: pass ? "Pass" : "Fail",
      explanation,
      severity,
      evidence: { market, zip, propertyType, squareFeet, rehabBudget },
      exceptionEligibility: !pass,
      approvalRequirement: !pass ? "System Administrator" : "None",
    });
  };

  addRule("Market", policy.markets.includes(market), policy.markets.includes(market) ? "Market is in policy." : "Market is outside policy.", "Critical");
  addRule("Property Type", policy.permittedPropertyTypes.includes(propertyType) && !policy.prohibitedPropertyTypes.includes(propertyType), policy.permittedPropertyTypes.includes(propertyType) ? "Property type is permitted." : "Property type is not permitted.", "Critical");
  addRule("Square Footage", squareFeet <= policy.preferredMaxSquareFeet, squareFeet <= policy.preferredMaxSquareFeet ? "Size is within preferred threshold." : "Size exceeds preferred threshold.", "Warning");
  addRule("Rehab Budget", rehabBudget <= policy.stretchRehabMax, rehabBudget <= policy.preferredRehabMax ? "Rehab is preferred." : rehabBudget <= policy.stretchRehabMax ? "Rehab is in stretch range." : "Rehab exceeds policy.", rehabBudget <= policy.stretchRehabMax ? "Warning" : "Critical");

  const allowedZip = Object.values(policy.zipRules).flat().includes(zip);
  addRule("ZIP Rule", allowedZip, allowedZip ? "ZIP is eligible." : "ZIP requires exception.", allowedZip ? "Info" : "Warning");

  const failedCritical = results.some((entry) => entry.result === "Fail" && entry.severity === "Critical");
  const failedAny = results.some((entry) => entry.result === "Fail");
  const decision = failedCritical ? "Fail" : failedAny ? "Conditional Pass" : "Pass";
  return {
    policyVersion: policy.version,
    decision,
    rules: results,
  };
}

export function buildCapitalExposureEngine(input, costs) {
  const reserveThreshold = safeNumber(getEvidenceValue(input.royalStarPolicy, "minimumReserveAfterClosing", 0));
  const reserveAfterClosing = costs.reserveAfterClosing;
  const peakCashExposure = costs.peakCashExposure;
  const status = peakCashExposure <= reserveThreshold ? "Adequate" : peakCashExposure <= reserveThreshold * 1.5 ? "Tight" : "Deficient";
  const warnings = [];
  if (reserveAfterClosing < reserveThreshold) warnings.push("reserve below Royal Star threshold");
  if (peakCashExposure > safeNumber(getEvidenceValue(input.royalStarPolicy, "maximumCashExposure", 180000))) warnings.push("excessive cash tied up");
  return {
    initialCashRequired: costs.totalCashRequired,
    totalProjectedCashRequired: costs.totalCashRequired,
    peakCashExposure,
    reserveAfterAcquisition: reserveAfterClosing,
    reserveAfterFirstDraw: reserveAfterClosing - costs.totalRehabBasis * 0.35,
    reserveAfterFinalDraw: costs.reserveAfterRehab,
    drawGapExposure: costs.totalRehabBasis * 0.2,
    contingencyCoverage: costs.contingencyCoverage,
    extensionExposure: costs.totalFinancingCost * 0.25,
    unexpectedRepairExposure: costs.totalRehabBasis * 0.1,
    projectedLiquidityAfterClosing: reserveAfterClosing,
    projectedLiquidityAfterRehab: costs.reserveAfterRehab,
    portfolioConcentration: "Moderate",
    lenderConcentration: "Moderate",
    marketConcentration: "Moderate",
    strategyConcentration: "Moderate",
    status,
    warnings,
  };
}

export function buildExecutionRiskEngine(input, costs) {
  const scope = safeString(getEvidenceValue(input.rehab, "scopeCompleteness", "Estimated")).toLowerCase();
  const contractor = safeString(getEvidenceValue(input.rehab, "contractorStatus", "Insufficient Data")).toLowerCase();
  const permits = safeString(getEvidenceValue(input.rehab, "permits", "Insufficient Data")).toLowerCase();
  const majorSystems = safeString(getEvidenceValue(input.rehab, "majorSystems", "Insufficient Data")).toLowerCase();
  let riskScore = 30;
  if (scope !== "verified") riskScore += 18;
  if (contractor.includes("insufficient") || contractor.includes("pending")) riskScore += 14;
  if (permits.includes("required")) riskScore += 10;
  if (majorSystems.includes("unknown")) riskScore += 10;
  if (costs.contingencyCoverage < 0.08) riskScore += 10;
  const riskLevel = riskScore >= 70 ? "High" : riskScore >= 50 ? "Moderate" : "Low";
  return {
    riskScore,
    riskLevel,
    criticalRisks: riskLevel === "High" ? ["scope incompleteness", "execution uncertainty"] : [],
    warnings: scope !== "verified" ? ["scope verification incomplete"] : [],
    requiredControls: ["contractor bid verification", "permit checklist", "major systems inspection"],
    decisionBlockers: contractor.includes("insufficient") ? ["contractor not ready"] : [],
    contingencyRecommendation: costs.contingencyCoverage < 0.1 ? "increase contingency" : "current contingency acceptable",
    scheduleRecommendation: safeNumber(getEvidenceValue(input.rehab, "projectedTimeline", 0)) > 6 ? "add delay buffer" : "timeline within range",
  };
}

export function buildExitStrategyOptimizer({ flip, brrrr, rental, wholesale, capital, executionRisk }) {
  const strategies = [
    { name: "Flip", expectedProfit: flip.netProjectedProfit, downsideProfit: flip.netProjectedProfit * 0.75, expectedRoi: flip.roiOnTotalCost, downsideRoi: flip.roiOnTotalCost * 0.75, cashRequired: capital.totalProjectedCashRequired, executionRisk: executionRisk.riskLevel, confidence: "Moderate" },
    { name: "BRRRR", expectedProfit: brrrr.cashReturnedToInvestor, downsideProfit: brrrr.cashReturnedToInvestor * 0.75, expectedRoi: brrrr.cashOnCashReturn, downsideRoi: brrrr.cashOnCashReturn * 0.75, cashRequired: capital.totalProjectedCashRequired, executionRisk: executionRisk.riskLevel, confidence: "Moderate" },
    { name: "Long-Term Rental", expectedProfit: rental.annualCashFlow, downsideProfit: rental.annualCashFlow * 0.7, expectedRoi: rental.cashOnCashReturn, downsideRoi: rental.cashOnCashReturn * 0.7, cashRequired: capital.totalProjectedCashRequired, executionRisk: executionRisk.riskLevel, confidence: "Low" },
    { name: "Wholesale", expectedProfit: wholesale.estimatedAssignmentSpread, downsideProfit: wholesale.estimatedAssignmentSpread * 0.7, expectedRoi: wholesale.endBuyerRoi, downsideRoi: wholesale.endBuyerRoi * 0.7, cashRequired: capital.initialCashRequired * 0.25, executionRisk: "Low", confidence: "Moderate" },
    { name: "Hold for Review", expectedProfit: 0, downsideProfit: 0, expectedRoi: 0, downsideRoi: 0, cashRequired: 0, executionRisk: "Low", confidence: "High" },
    { name: "Pass", expectedProfit: 0, downsideProfit: 0, expectedRoi: 0, downsideRoi: 0, cashRequired: 0, executionRisk: "Low", confidence: "High" },
  ];

  const ranked = [...strategies].sort((a, b) => (b.expectedProfit - b.cashRequired * 0.1) - (a.expectedProfit - a.cashRequired * 0.1));
  return {
    strategies,
    bestFinancialStrategy: ranked[0]?.name || "Pass",
    safestStrategy: "Hold for Review",
    lowestCashStrategy: ranked.sort((a, b) => a.cashRequired - b.cashRequired)[0]?.name || "Pass",
    fastestCapitalRecyclingStrategy: "Wholesale",
    bestRiskAdjustedStrategy: ranked[0]?.name || "Hold for Review",
    recommendedStrategy: ranked[0]?.name || "Hold for Review",
    secondaryExit: ranked[1]?.name || "Hold for Review",
    emergencyExit: "Pass",
    noActionAlternative: "Hold for Review",
  };
}

export function buildOpportunityCostEngine({ recommendedStrategy, strategies, hasPipelineAlternatives = false }) {
  const selected = strategies.find((entry) => entry.name === recommendedStrategy) || strategies[0] || {};
  return {
    selectedStrategy: selected.name || "Hold for Review",
    cashTiedUp: safeNumber(selected.cashRequired),
    expectedReturn: safeNumber(selected.expectedProfit),
    downsideReturn: safeNumber(selected.downsideProfit),
    capitalDuration: selected.name === "Wholesale" ? "short" : "medium",
    liquidityReduction: safeNumber(selected.cashRequired),
    portfolioConcentration: "Moderate",
    forgoneCapacity: safeNumber(selected.cashRequired) * 0.5,
    riskAdjustedReturn: safeNumber(selected.expectedProfit) - safeNumber(selected.cashRequired) * 0.1,
    comparisonCompleteness: hasPipelineAlternatives ? "Complete" : "Incomplete: no alternative-deal data",
  };
}

export function buildRedTeamAcquisitionReview({ flip, brrrr, rental, mao }) {
  const downsideProfit = Math.min(flip.netProjectedProfit * 0.65, brrrr.cashReturnedToInvestor * 0.65, rental.annualCashFlow * 0.65);
  return {
    baseCaseDecision: flip.netProjectedProfit > 0 ? "BUY" : "HOLD FOR REVIEW",
    conservativeDecision: flip.netProjectedProfit * 0.85 > 0 ? "NEGOTIATE" : "PASS",
    downsideDecision: downsideProfit > 0 ? "HOLD FOR REVIEW" : "PASS",
    severeDownsideDecision: "PASS",
    recommendationStability: downsideProfit > 0 ? "Moderate" : "Fragile",
    weakestAssumption: "ARV support",
    mostDangerousCombination: "lower ARV + rehab overrun + extended hold",
    decisionBreakingArv: mao.recommendedWalkAwayPrice + 50000,
    decisionBreakingRehabBudget: mao.recommendedWalkAwayPrice * 0.45,
    decisionBreakingHoldingPeriod: 9,
    decisionBreakingSalePrice: mao.recommendedWalkAwayPrice,
    decisionBreakingRent: 0,
    decisionBreakingInterestRate: 11,
    additionalCashRequired: Math.max(0, mao.currentProposedPriceGap),
    survivalResult: downsideProfit > 0 ? "Survives with Conditions" : "Fails",
  };
}

export function buildDecisionGovernance({ readiness, mao, buyBox, exit, redTeam }) {
  const blockers = [...(readiness.criticalBlockers || []), ...(readiness.decisionBlockers || [])];
  const warnings = [...(readiness.warnings || [])];
  let output = "HOLD FOR REVIEW";
  if (blockers.length === 0 && buyBox.decision === "Pass" && redTeam.survivalResult !== "Fails") output = "BUY";
  else if (mao.currentAskingPriceGap > 0) output = "NEGOTIATE";
  else if (buyBox.decision === "Fail") output = "PASS";
  return {
    status: blockers.length ? "Missing Information" : output === "BUY" ? "Conditional Approval" : output === "PASS" ? "Rejected" : "Under Review",
    output,
    qualification: blockers.length ? "Conditional" : "Qualified",
    confidence: blockers.length ? "Moderate" : "High",
    recommendation: output,
    rationale: output === "BUY" ? "Readiness, buy-box, and downside checks are acceptable." : output === "NEGOTIATE" ? "Price must move toward walk-away threshold." : output === "PASS" ? "Policy or downside constraints failed." : "More underwriting evidence is required.",
    conditions: blockers,
    blockers,
    warnings,
    requiredApprovals: ["System Administrator"],
    nextBestAction: blockers.length ? "Complete missing evidence" : output === "NEGOTIATE" ? "Negotiate toward target offer" : "Route for approval review",
    offerRange: {
      opening: mao.recommendedOpeningOffer,
      target: mao.recommendedTargetOffer,
      walkAway: mao.recommendedWalkAwayPrice,
    },
    walkAwayPrice: mao.recommendedWalkAwayPrice,
    recommendedStrategy: exit.recommendedStrategy,
    secondaryStrategy: exit.secondaryExit,
    executiveDecision: output,
    advisoryOnly: true,
    approvalRequiredToPersist: true,
  };
}

export function createAcquisitionDecisionVersioningService(seed = []) {
  const versions = Array.isArray(seed) ? [...seed] : [];
  return {
    list() {
      return [...versions];
    },
    add(version) {
      versions.push({ ...version, createdAt: version.createdAt || nowIso() });
      return versions.at(-1);
    },
    approve(versionId, approvedBy = "System Administrator") {
      const target = versions.find((entry) => entry.underwritingId === versionId);
      if (!target) return { ok: false, message: "version not found" };
      if (target.approved) return { ok: false, message: "approved version cannot be overwritten" };
      target.approved = true;
      target.approvedBy = approvedBy;
      target.approvedAt = nowIso();
      return { ok: true, version: target };
    },
  };
}

export function buildAcquisitionDocumentAssembly(result) {
  const packageMeta = {
    generatedAt: nowIso(),
    version: "acquisition-doc-v1",
    advisoryOnly: true,
  };
  return {
    acquisitionSummary: { ...packageMeta, recommendation: result.governance.recommendation, offerRange: result.governance.offerRange },
    investmentCommitteeSummary: { ...packageMeta, strategy: result.exit.recommendedStrategy, downside: result.redTeam.downsideDecision },
    lenderPackage: { ...packageMeta, financing: result.costs.totalFinancingCost, dscr: result.brrrr.dscr },
    appraisalPacket: { ...packageMeta, activeArv: getEvidenceValue(result.input.valuation, "activeArv", 0), approvedCompCount: getEvidenceValue(result.input.valuation, "approvedCompCount", 0) },
    offerWorksheet: { ...packageMeta, mao: result.mao },
    negotiationWorksheet: { ...packageMeta, target: result.mao.recommendedTargetOffer, walkAway: result.mao.recommendedWalkAwayPrice },
    rehabBudgetSummary: { ...packageMeta, rehab: result.costs.totalRehabBasis },
    riskSummary: { ...packageMeta, executionRisk: result.executionRisk.riskLevel, capitalStatus: result.capital.status },
    closingReadinessChecklist: { ...packageMeta, readiness: result.readiness.status, blockers: result.readiness.criticalBlockers },
  };
}

export function buildOutcomeFeedbackSummary({ projected = {}, actual = {}, sampleSize = 0 }) {
  const error = (projectedValue, actualValue) => {
    const p = safeNumber(projectedValue);
    const a = safeNumber(actualValue);
    if (p === 0) return null;
    return {
      variance: a - p,
      absolutePercentageError: Math.abs((a - p) / p),
      directionalBias: a > p ? "underestimated" : a < p ? "overestimated" : "neutral",
    };
  };
  return {
    sampleSize,
    sampleProtection: sampleSize < 5 ? "insufficient sample size for trend inference" : "sample size adequate",
    purchasePrice: error(projected.purchasePrice, actual.purchasePrice),
    rehabBudget: error(projected.rehabBudget, actual.rehabBudget),
    timeline: error(projected.timelineMonths, actual.timelineMonths),
    arvVsSale: error(projected.arv, actual.salePrice),
    rent: error(projected.rent, actual.rent),
    financing: error(projected.financingCosts, actual.financingCosts),
    profit: error(projected.profit, actual.profit),
    roi: error(projected.roi, actual.roi),
  };
}

export function buildAcquisitionIntelligenceEngine(payload = {}) {
  const input = buildAcquisitionUnderwritingInput({ deal: payload.deal || {}, policy: payload.policy || DEFAULT_BUY_BOX_POLICY });
  const readiness = createAcquisitionReadinessService().evaluate(input);
  const costs = buildProjectCostEngine(input);
  const flip = buildFlipUnderwritingEngine(input, costs);
  const brrrr = buildBrrrrUnderwritingEngine(input, costs);
  const rental = buildRentalHoldUnderwritingEngine(input, brrrr);
  const wholesale = buildWholesaleScreeningEngine(input, flip, costs);
  const mao = buildMaximumAllowableOfferEngine(input, flip, brrrr, rental, wholesale);
  const buyBox = buildRoyalStarBuyBoxEngine(input, payload.policy || DEFAULT_BUY_BOX_POLICY);
  const capital = buildCapitalExposureEngine(input, costs);
  const executionRisk = buildExecutionRiskEngine(input, costs);
  const exit = buildExitStrategyOptimizer({ flip, brrrr, rental, wholesale, capital, executionRisk });
  const opportunityCost = buildOpportunityCostEngine({ recommendedStrategy: exit.recommendedStrategy, strategies: exit.strategies, hasPipelineAlternatives: Boolean(payload.hasPipelineAlternatives) });
  const redTeam = buildRedTeamAcquisitionReview({ flip, brrrr, rental, mao });
  const governance = buildDecisionGovernance({ readiness, mao, buyBox, exit, redTeam });
  const versioning = {
    formulaVersion: costs.formulaVersion,
    buyBoxVersion: buyBox.policyVersion,
    valuationVersion: safeString(getEvidenceValue(input.valuation, "valuationVersion", "v1")),
    financingVersion: "financing-v1",
    underwritingVersion: "acq-underwriting-v1",
  };
  const result = {
    input,
    readiness,
    costs,
    flip,
    brrrr,
    rental,
    wholesale,
    mao,
    buyBox,
    capital,
    executionRisk,
    exit,
    opportunityCost,
    redTeam,
    governance,
    versioning,
  };
  result.documents = buildAcquisitionDocumentAssembly(result);
  result.feedbackTemplate = buildOutcomeFeedbackSummary({ projected: { purchasePrice: getEvidenceValue(input.acquisition, "proposedPurchasePrice", 0), rehabBudget: getEvidenceValue(input.rehab, "currentRehabBudget", 0), timelineMonths: getEvidenceValue(input.operations, "holdingMonths", 0), arv: getEvidenceValue(input.valuation, "activeArv", 0), rent: getEvidenceValue(input.operations, "rent", 0), financingCosts: getEvidenceValue(input.financing, "financingCosts", 0), profit: flip.netProjectedProfit, roi: flip.roiOnTotalCost }, actual: {}, sampleSize: 0 });
  return result;
}

export { DEFAULT_BUY_BOX_POLICY, ACQUISITION_DECISION_STATUSES };
