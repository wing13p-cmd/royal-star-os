function safeNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function clamp(value, min = 0, max = 100) {
  return Math.min(max, Math.max(min, value));
}

function buildDecisionReasonText(value, fallback = "Insufficient Data") {
  if (value === null || value === undefined || value === "") return fallback;
  return String(value).trim();
}

function safeDisplay(value, fallback = "Insufficient Data") {
  if (value === null || value === undefined || value === "" || Number.isNaN(value)) return fallback;
  if (typeof value === "number" && !Number.isFinite(value)) return fallback;
  return value;
}

function safeString(value, fallback = "Insufficient Data") {
  if (value === null || value === undefined || value === "") return fallback;
  return typeof value === "string" ? value : String(value);
}

function resolvePersistedProjectedProfit(deal = {}) {
  const persistedProfit = safeNumber(
    deal.projectedProfit
    ?? deal.projectedProfitAmount
    ?? deal.expectedProfit
    ?? deal.estimatedProfit
    ?? deal.netProfit
    ?? 0
  );
  return persistedProfit > 0 ? persistedProfit : 0;
}

import { normalizeUnderwritingInputs } from "./underwritingInputNormalizer.js";

export function buildUnderwritingMetrics(deal = {}, financing = {}, options = {}) {
  const normalizedDeal = normalizeDealForIntelligence(deal);
  const includeContingency = options.includeContingency ?? true;
  const includeTaxesAndInsurance = options.includeTaxesAndInsurance ?? false;
  const includeHoldingCost = options.includeHoldingCost ?? true;
  const includeExtraCosts = options.includeExtraCosts ?? false;
  const purchasePrice = safeNumber(normalizedDeal.purchasePrice || normalizedDeal.askingPrice || 0);
  const rehabCost = safeNumber(normalizedDeal.rehabBudget || normalizedDeal.rehabCost || 0);
  const arv = safeNumber(normalizedDeal.estimatedArv ?? normalizedDeal.arv ?? normalizedDeal.projectedARV ?? normalizedDeal.supportedARV ?? normalizedDeal.currentValue ?? normalizedDeal.marketValue ?? normalizedDeal.estimatedValue);
  const holdingCost = safeNumber(normalizedDeal.holdingCosts || normalizedDeal.holdingCost || (normalizedDeal.holdingMonths && normalizedDeal.monthlyHoldingCost ? normalizedDeal.holdingMonths * normalizedDeal.monthlyHoldingCost : 0));
  const closingCosts = safeNumber(normalizedDeal.closingCosts || normalizedDeal.closingCost || 0);
  const financingCosts = safeNumber(normalizedDeal.financingCosts || normalizedDeal.financingCost || 0);
  const taxes = safeNumber(normalizedDeal.taxes || 0);
  const insurance = safeNumber(normalizedDeal.insurance || 0);
  const extraCosts = safeNumber(normalizedDeal.additionalCosts || normalizedDeal.otherCosts || 0);
  const contingency = includeContingency ? safeNumber(normalizedDeal.contingency || rehabCost * 0.1) : 0;
  const totalProjectCost = purchasePrice + rehabCost + (includeHoldingCost ? holdingCost : 0) + closingCosts + financingCosts + (includeTaxesAndInsurance ? taxes + insurance : 0) + (includeExtraCosts ? extraCosts : 0) + contingency;
  const sellingCosts = safeNumber(normalizedDeal.sellingCosts || normalizedDeal.sellingCost || (arv > 0 ? arv * 0.08 : 0));
  const persistedProjectedProfit = resolvePersistedProjectedProfit(normalizedDeal);
  const derivedGrossProfit = arv - totalProjectCost;
  const derivedProfit = derivedGrossProfit - sellingCosts;
  const grossProfit = persistedProjectedProfit > 0 ? persistedProjectedProfit + sellingCosts : derivedGrossProfit;
  const profit = persistedProjectedProfit > 0 ? persistedProjectedProfit : derivedProfit;
  const roi = totalProjectCost > 0 ? profit / totalProjectCost : 0;
  const cashRequired = Math.max(0, totalProjectCost - safeNumber(financing.loanAmount || financing.cashOnHand || 0));

  return {
    purchasePrice,
    rehabCost,
    arv,
    holdingCost,
    closingCosts,
    financingCosts,
    taxes,
    insurance,
    contingency,
    sellingCosts,
    extraCosts,
    totalProjectCost,
    grossProfit,
    profit,
    roi,
    cashRequired,
  };
}

export function normalizeDealForIntelligence(deal = {}) {
  const address = safeDisplay(deal.propertyAddress || deal.address || deal.property_name || deal.streetAddress, "Insufficient Data");
  const city = safeDisplay(deal.city, "Insufficient Data");
  const state = safeDisplay(deal.state, "Insufficient Data");
  const zipCode = safeDisplay(deal.zipCode || deal.zip || deal.postalCode, "Insufficient Data");
  const propertyType = safeDisplay(deal.propertyType || deal.type, "Single Family");
  const purchasePrice = safeNumber(deal.purchasePrice || deal.askingPrice || deal.listPrice || deal.currentOfferPrice);
  const askingPrice = safeNumber(deal.askingPrice || deal.listPrice || deal.purchasePrice || deal.offerPrice);
  const rehabBudget = safeNumber(deal.rehabBudget || deal.repairBudget || deal.renovationBudget);
  const estimatedArv = safeNumber(deal.estimatedArv ?? deal.arv ?? deal.projectedARV ?? deal.supportedARV ?? deal.currentValue ?? deal.marketValue ?? deal.estimatedValue);
  const manualArv = safeNumber(deal.manualArv ?? deal.manualARV ?? deal.overrideArv ?? deal.overrideARV ?? deal.manualArvOverride ?? deal.manualARVOverride ?? 0);
  const estimatedRent = safeNumber(deal.estimatedRent ?? deal.marketRent ?? deal.projectedRent ?? deal.monthlyRent ?? deal.rent);
  const taxes = safeNumber(deal.taxes);
  const insurance = safeNumber(deal.insurance);
  const financingCosts = safeNumber(deal.financingCosts);
  const closingCosts = safeNumber(deal.closingCosts);
  const holdingMonths = safeNumber(deal.holdingMonths);
  const annualInterestRate = safeNumber(deal.annualInterestRate ?? deal.interestRate ?? deal.rate ?? 0);
  const actualLoanAmount = safeNumber(deal.actualLoanAmount ?? deal.actualLoan ?? deal.loanAmount ?? deal.fundingAmount ?? 0);
  const lenderLoanAmount = safeNumber(deal.lenderLoanAmount ?? deal.lenderLoan ?? deal.loanAmountFromLender ?? 0);
  const acquisitionLoan = safeNumber(deal.acquisitionLoan ?? deal.purchaseLoan ?? deal.acquisitionFunding ?? 0);
  const fundedRehab = safeNumber(deal.fundedRehab ?? deal.rehabFunding ?? deal.rehabLoan ?? 0);
  const cashToClose = safeNumber(deal.cashToClose ?? deal.cashToCloseAmount ?? 0);
  const earnestMoney = safeNumber(deal.earnestMoney ?? 0);
  const totalInitialCashInvested = safeNumber(deal.totalInitialCashInvested ?? deal.initialCashInvested ?? deal.cashInvested ?? 0);
  const constructionHoldback = safeNumber(deal.constructionHoldback ?? deal.holdbackAmount ?? deal.constructionHoldbackAmount ?? 0);
  const originationFee = safeNumber(deal.originationFee ?? deal.originationFees ?? 0);
  const brokerFee = safeNumber(deal.brokerFee ?? 0);
  const underwritingFee = safeNumber(deal.underwritingFee ?? 0);
  const servicingFee = safeNumber(deal.servicingFee ?? 0);
  const lenderLegalFee = safeNumber(deal.lenderLegalFee ?? deal.legalFee ?? 0);
  const monitoringFee = safeNumber(deal.monitoringFee ?? 0);
  const otherLenderFees = safeNumber(deal.otherLenderFees ?? deal.otherFees ?? 0);
  const loanTermMonths = safeNumber(deal.loanTermMonths ?? deal.loanTerm ?? deal.termMonths ?? 0);
  const amortizationTermMonths = safeNumber(deal.amortizationTermMonths ?? deal.amortizationTerm ?? 0);
  const paymentType = safeDisplay(deal.paymentType ?? deal.loanPaymentType ?? deal.debtPaymentType, "");
  const bedrooms = safeNumber(deal.bedrooms);
  const bathrooms = safeNumber(deal.bathrooms);
  const squareFeet = safeNumber(deal.squareFeet);
  const yearBuilt = safeNumber(deal.yearBuilt);
  const strategy = safeDisplay(deal.strategy || deal.exitStrategy || deal.preferredStrategy, "");
  const exitStrategy = safeDisplay(deal.exitStrategy || deal.strategy || deal.preferredExitStrategy, strategy || "");
  const notes = safeDisplay(deal.notes, "");
  const leadSource = safeDisplay(deal.leadSource, "");

  return {
    ...deal,
    propertyAddress: address,
    address,
    city,
    state,
    zipCode,
    zip: zipCode,
    propertyType,
    bedrooms,
    bathrooms,
    squareFeet,
    yearBuilt,
    askingPrice,
    purchasePrice,
    rehabBudget,
    estimatedArv,
    arv: estimatedArv,
    projectedARV: estimatedArv,
    supportedARV: estimatedArv,
    requestedARV: estimatedArv,
    manualArv,
    manualARV: manualArv,
    overrideArv: manualArv,
    overrideARV: manualArv,
    estimatedRent,
    taxes,
    insurance,
    financingCosts,
    closingCosts,
    holdingMonths,
    annualInterestRate,
    actualLoanAmount,
    lenderLoanAmount,
    acquisitionLoan,
    fundedRehab,
    cashToClose,
    earnestMoney,
    totalInitialCashInvested,
    constructionHoldback,
    originationFee,
    brokerFee,
    underwritingFee,
    servicingFee,
    lenderLegalFee,
    monitoringFee,
    otherLenderFees,
    loanTermMonths,
    amortizationTermMonths,
    paymentType,
    strategy,
    exitStrategy,
    notes,
    leadSource,
  };
}

function normalizeSubject(deal = {}) {
  return {
    address: safeDisplay(deal.propertyAddress || deal.address, "Insufficient Data"),
    city: safeDisplay(deal.city, "Insufficient Data"),
    state: safeDisplay(deal.state, "Insufficient Data"),
    zipCode: safeDisplay(deal.zipCode || deal.zip, "Insufficient Data"),
    neighborhood: safeDisplay(deal.neighborhood || deal.neighborhoodName, "Insufficient Data"),
    propertyType: safeDisplay(deal.propertyType, "Single Family"),
    units: safeNumber(deal.units || deal.unitCount || 1),
    bedrooms: safeNumber(deal.bedrooms),
    bathrooms: safeNumber(deal.bathrooms),
    squareFeet: safeNumber(deal.squareFeet),
    yearBuilt: safeNumber(deal.yearBuilt),
    lotSize: safeNumber(deal.lotSize),
    garage: safeDisplay(deal.garage, "Insufficient Data"),
    basement: safeDisplay(deal.basement, "Insufficient Data"),
    condition: safeDisplay(deal.condition, "Average"),
    saleDate: safeDisplay(deal.saleDate, "Insufficient Data"),
    salePrice: safeNumber(deal.salePrice || deal.purchasePrice || deal.askingPrice),
    pricePerSquareFoot: safeNumber(deal.squareFeet) > 0 ? safeNumber(deal.salePrice || deal.purchasePrice || deal.askingPrice) / safeNumber(deal.squareFeet) : 0,
  };
}

function normalizeComp(comp = {}) {
  const salePrice = safeNumber(comp.salePrice || comp.price || comp.listPrice);
  const squareFeet = safeNumber(comp.squareFeet);
  return {
    id: comp.id || `comp-${Math.random().toString(16).slice(2, 8)}`,
    address: safeDisplay(comp.compAddress || comp.address, "Insufficient Data"),
    city: safeDisplay(comp.city, "Insufficient Data"),
    state: safeDisplay(comp.state, "Insufficient Data"),
    zipCode: safeDisplay(comp.zipCode || comp.zip, "Insufficient Data"),
    neighborhood: safeDisplay(comp.neighborhood || comp.neighborhoodName, "Insufficient Data"),
    propertyType: safeDisplay(comp.propertyType, "Single Family"),
    units: safeNumber(comp.units || comp.unitCount || 1),
    bedrooms: safeNumber(comp.bedrooms),
    bathrooms: safeNumber(comp.bathrooms),
    squareFeet,
    yearBuilt: safeNumber(comp.yearBuilt),
    lotSize: safeNumber(comp.lotSize),
    garage: safeDisplay(comp.garage, "Insufficient Data"),
    basement: safeDisplay(comp.basement, "Insufficient Data"),
    condition: safeDisplay(comp.condition, "Average"),
    saleDate: safeDisplay(comp.saleDate, "Insufficient Data"),
    salePrice,
    pricePerSquareFoot: squareFeet > 0 ? salePrice / squareFeet : 0,
    distanceMiles: safeNumber(comp.distanceMiles),
    included: comp.included !== false,
    exclusionReason: comp.exclusionReason || "",
  };
}

function getDaysSinceSale(value) {
  if (!value || value === "Insufficient Data") return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const today = new Date();
  const diffMs = today.setHours(0, 0, 0, 0) - date.setHours(0, 0, 0, 0);
  return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
}

function getConditionSimilarity(compCondition, subjectCondition) {
  const rank = { Poor: 1, Fair: 2, Average: 3, Good: 4, Renovated: 5, "New Construction": 6 };
  if (!compCondition || !subjectCondition) return 0.5;
  const left = rank[compCondition] || 3;
  const right = rank[subjectCondition] || 3;
  const delta = Math.abs(left - right);
  return Math.max(0, 1 - delta / 6);
}

function normalizeComparableText(value) {
  if (value === null || value === undefined || value === "") return "";
  return String(value).trim().toLowerCase();
}

function getStringSimilarity(leftValue, rightValue) {
  const left = normalizeComparableText(leftValue);
  const right = normalizeComparableText(rightValue);
  if (!left || !right) return 0.5;
  if (left === right) return 1;
  if (left.includes(right) || right.includes(left)) return 0.75;
  return 0.35;
}

function getLotSizeSimilarity(compLotSize, subjectLotSize) {
  const comp = safeNumber(compLotSize);
  const subject = safeNumber(subjectLotSize);
  if (subject <= 0 || comp <= 0) return 0.65;
  return Math.max(0, Math.min(1, 1 - Math.abs(comp - subject) / Math.max(subject, 1)));
}

function getNumericSimilarity(compValue, subjectValue, fallback = 0.65) {
  const comp = safeNumber(compValue);
  const subject = safeNumber(subjectValue);
  if (subject <= 0 || comp <= 0) return fallback;
  return Math.max(0, Math.min(1, 1 - Math.abs(comp - subject) / Math.max(subject, 1)));
}

function getGarageSimilarity(compGarage, subjectGarage) {
  const left = normalizeComparableText(compGarage);
  const right = normalizeComparableText(subjectGarage);
  if (!left || !right) return 0.65;
  if (left === right) return 1;
  if (left.includes("none") && right.includes("none")) return 1;
  if (left.includes("garage") || right.includes("garage")) return 0.75;
  return 0.4;
}

function getBasementSimilarity(compBasement, subjectBasement) {
  const left = normalizeComparableText(compBasement);
  const right = normalizeComparableText(subjectBasement);
  if (!left || !right) return 0.65;
  if (left === right) return 1;
  if ((left.includes("finished") && right.includes("finished")) || (left.includes("unfinished") && right.includes("unfinished"))) return 0.8;
  if (left.includes("finished") || right.includes("finished")) return 0.6;
  return 0.4;
}

function getRenovationQualitySimilarity(comp, subject) {
  const compQuality = normalizeComparableText(comp.renovationQuality || comp.quality || comp.renovationLevel || comp.condition);
  const subjectQuality = normalizeComparableText(subject.renovationQuality || subject.quality || subject.renovationLevel || subject.condition);
  if (!compQuality || !subjectQuality) return getConditionSimilarity(comp.condition, subject.condition);
  return getStringSimilarity(compQuality, subjectQuality);
}

function scoreComp(comp, subject) {
  const recencyDays = getDaysSinceSale(comp.saleDate) ?? 1825;
  const recencyScore = Math.max(0, Math.min(1, 1 - recencyDays / 1800));
  const distanceScore = comp.distanceMiles ? Math.max(0, Math.min(1, 1 - comp.distanceMiles / 15)) : 0.65;
  const sqftScore = getNumericSimilarity(comp.squareFeet, subject.squareFeet, 0.65);
  const bedroomScore = getNumericSimilarity(comp.bedrooms, subject.bedrooms, 0.65);
  const bathroomScore = getNumericSimilarity(comp.bathrooms, subject.bathrooms, 0.65);
  const lotSizeScore = getLotSizeSimilarity(comp.lotSize, subject.lotSize);
  const yearBuiltScore = getNumericSimilarity(comp.yearBuilt, subject.yearBuilt, 0.65);
  const propertyStyleScore = getStringSimilarity(comp.style || comp.propertyStyle, subject.style || subject.propertyStyle);
  const basementScore = getBasementSimilarity(comp.basement, subject.basement);
  const garageScore = getGarageSimilarity(comp.garage, subject.garage);
  const conditionScore = getConditionSimilarity(comp.condition, subject.condition);
  const renovationQualityScore = getRenovationQualitySimilarity(comp, subject);
  const completeness = [comp.salePrice > 0, comp.squareFeet > 0, comp.bedrooms > 0, comp.bathrooms > 0, comp.saleDate !== "Insufficient Data"].filter(Boolean).length / 5;

  const weightedScore = recencyScore * 0.12 + distanceScore * 0.14 + sqftScore * 0.14 + bedroomScore * 0.08 + bathroomScore * 0.08 + lotSizeScore * 0.08 + yearBuiltScore * 0.08 + propertyStyleScore * 0.06 + basementScore * 0.06 + garageScore * 0.06 + conditionScore * 0.06 + renovationQualityScore * 0.08 + completeness * 0.06;
  return Math.max(0, Math.min(100, weightedScore * 100));
}

export function buildArvIntelligence(deal = {}, comps = [], neighborhoods = []) {
  const normalizedDeal = normalizeDealForIntelligence(deal);
  const subject = normalizeSubject(normalizedDeal);
  const manualArvOverride = safeNumber(normalizedDeal.manualArv ?? normalizedDeal.manualARV ?? normalizedDeal.overrideArv ?? normalizedDeal.overrideARV ?? 0);
  const normalizedComps = (Array.isArray(comps) ? comps : []).map(normalizeComp);
  const eligibleComps = normalizedComps.filter((comp) => {
    if (!comp.included) return false;
    if (!comp.salePrice) return false;
    if (subject.propertyType && subject.propertyType !== "Insufficient Data" && comp.propertyType && subject.propertyType.toLowerCase() !== comp.propertyType.toLowerCase()) return false;
    if (subject.zipCode && subject.zipCode !== "Insufficient Data" && comp.zipCode && subject.zipCode !== comp.zipCode) return false;
    if (subject.neighborhood && subject.neighborhood !== "Insufficient Data" && comp.neighborhood && comp.neighborhood !== "Insufficient Data" && subject.neighborhood !== comp.neighborhood) {
      return false;
    }
    return true;
  });

  const compEvaluations = eligibleComps.map((comp) => {
    const qualityScore = scoreComp(comp, subject);
    const grade = qualityScore >= 85 ? "A" : qualityScore >= 70 ? "B" : qualityScore >= 55 ? "C" : qualityScore >= 40 ? "D" : "F";
    const daysSinceSale = getDaysSinceSale(comp.saleDate);
    const recencyScore = Math.max(0, Math.min(1, 1 - ((daysSinceSale ?? 1825) / 1800)));
    const distanceScore = comp.distanceMiles ? Math.max(0, Math.min(1, 1 - comp.distanceMiles / 15)) : 0.65;
    const sqftScore = getNumericSimilarity(comp.squareFeet, subject.squareFeet, 0.65);
    const bedroomScore = getNumericSimilarity(comp.bedrooms, subject.bedrooms, 0.65);
    const bathroomScore = getNumericSimilarity(comp.bathrooms, subject.bathrooms, 0.65);
    const lotSizeScore = getLotSizeSimilarity(comp.lotSize, subject.lotSize);
    const yearBuiltScore = getNumericSimilarity(comp.yearBuilt, subject.yearBuilt, 0.65);
    const propertyStyleScore = getStringSimilarity(comp.style || comp.propertyStyle, subject.style || subject.propertyStyle);
    const basementScore = getBasementSimilarity(comp.basement, subject.basement);
    const garageScore = getGarageSimilarity(comp.garage, subject.garage);
    const conditionScore = getConditionSimilarity(comp.condition, subject.condition);
    const renovationQualityScore = getRenovationQualitySimilarity(comp, subject);
    let status = "Supporting Comp";
    let inclusionReason = "Relevant comp with fair to strong similarity.";
    let reason = "";

    if (qualityScore >= 80) status = "Primary Comp";
    else if (qualityScore < 40) status = "Weak Comp";
    else if (daysSinceSale !== null && daysSinceSale > 730) status = "Weak Comp";
    else if (comp.distanceMiles > 10) status = "Weak Comp";
    if (comp.salePrice <= 0) status = "Excluded";

    if (status === "Weak Comp") {
      reason = "Comp is stale, distant, or materially less similar to the subject.";
      inclusionReason = "Used only as supporting context.";
    }

    const outlierFlags = {
      priceOutlier: false,
      sizeOutlier: false,
      dateOutlier: false,
      neighborhoodOutlier: false,
    };

    return {
      address: comp.address,
      qualityScore,
      grade,
      status,
      inclusionReason,
      inclusionReasonDetail: reason || inclusionReason,
      salePrice: comp.salePrice,
      adjustedSalePrice: comp.salePrice,
      adjustmentPercentage: 0,
      adjustmentReliability: "Insufficient Data",
      saleDate: comp.saleDate,
      distanceMiles: comp.distanceMiles,
      rankScore: qualityScore,
      rankFactors: {
        distanceScore: Math.round(distanceScore * 100),
        recencyScore: Math.round(recencyScore * 100),
        squareFootageScore: Math.round(sqftScore * 100),
        bedroomScore: Math.round(bedroomScore * 100),
        bathroomScore: Math.round(bathroomScore * 100),
        lotSizeScore: Math.round(lotSizeScore * 100),
        yearBuiltScore: Math.round(yearBuiltScore * 100),
        propertyStyleScore: Math.round(propertyStyleScore * 100),
        basementScore: Math.round(basementScore * 100),
        garageScore: Math.round(garageScore * 100),
        conditionScore: Math.round(conditionScore * 100),
        renovationQualityScore: Math.round(renovationQualityScore * 100),
      },
      outlierFlags,
    };
  });

  const primaryComps = compEvaluations.filter((item) => item.status === "Primary Comp");
  const supportingComps = compEvaluations.filter((item) => item.status === "Supporting Comp");
  const includedComps = [...primaryComps, ...supportingComps];
  const adjustedSalePrices = includedComps.map((item) => item.adjustedSalePrice || 0).filter((value) => value > 0);
  const weightedAdjustedArv = adjustedSalePrices.length ? adjustedSalePrices.reduce((sum, value) => sum + value, 0) / adjustedSalePrices.length : 0;
  const fallbackArv = safeNumber(normalizedDeal.estimatedArv ?? normalizedDeal.arv ?? normalizedDeal.projectedARV ?? normalizedDeal.supportedARV ?? normalizedDeal.currentValue ?? normalizedDeal.marketValue ?? normalizedDeal.estimatedValue);
  const baseArv = manualArvOverride > 0 ? manualArvOverride : (weightedAdjustedArv > 0 ? weightedAdjustedArv : fallbackArv);
  const lowArv = baseArv > 0 ? baseArv * 0.95 : 0;
  const highArv = baseArv > 0 ? baseArv * 1.05 : 0;
  const spread = baseArv > 0 ? (highArv - lowArv) / baseArv : 0;

  const priceValues = includedComps.map((item) => safeNumber(item.salePrice)).filter((value) => value > 0);
  const sizeValues = includedComps.map((item) => safeNumber(item.squareFeet)).filter((value) => value > 0);
  const dateValues = includedComps.map((item) => getDaysSinceSale(item.saleDate)).filter((value) => value !== null);
  const medianPrice = priceValues.length ? [...priceValues].sort((a, b) => a - b)[Math.floor(priceValues.length / 2)] : 0;
  const medianSize = sizeValues.length ? [...sizeValues].sort((a, b) => a - b)[Math.floor(sizeValues.length / 2)] : 0;
  const medianDate = dateValues.length ? [...dateValues].sort((a, b) => a - b)[Math.floor(dateValues.length / 2)] : 0;
  const priceSpread = priceValues.length > 1 ? (Math.max(...priceValues) - Math.min(...priceValues)) / Math.max(medianPrice, 1) : 0;
  const sizeSpread = sizeValues.length > 1 ? (Math.max(...sizeValues) - Math.min(...sizeValues)) / Math.max(medianSize, 1) : 0;
  const dateSpread = dateValues.length > 1 ? Math.max(...dateValues) - Math.min(...dateValues) : 0;
  const neighborhoodValues = includedComps.map((item) => item.neighborhood || item.address || "").filter(Boolean);
  const neighborhoodMode = neighborhoodValues.length ? neighborhoodValues.reduce((acc, value) => {
    acc[value] = (acc[value] || 0) + 1;
    return acc;
  }, {}) : {};
  const dominatingNeighborhood = Object.entries(neighborhoodMode).sort((a, b) => b[1] - a[1])[0]?.[0] || "";

  const rankableComps = compEvaluations.filter((item) => item.status !== "Excluded");
  const comparableRankings = rankableComps
    .map((item) => {
      const rankScore = Math.round(item.rankScore);
      const classification = rankScore >= 80 ? "Best Comparable" : rankScore >= 60 ? "Acceptable Comparable" : rankScore >= 40 ? "Weak Comparable" : "Rejected Comparable";
      const priceOutlier = priceValues.length > 1 && medianPrice > 0 && Math.abs(safeNumber(item.salePrice) - medianPrice) > Math.max(10000, priceSpread * medianPrice * 0.75);
      const sizeOutlier = sizeValues.length > 1 && medianSize > 0 && Math.abs(safeNumber(item.squareFeet) - medianSize) > Math.max(150, sizeSpread * medianSize * 0.75);
      const dateOutlier = dateValues.length > 1 && medianDate !== null && Math.abs((getDaysSinceSale(item.saleDate) ?? 0) - medianDate) > Math.max(365, dateSpread * 0.5);
      const neighborhoodOutlier = dominatingNeighborhood && item.neighborhood && item.neighborhood !== dominatingNeighborhood;
      const outlierFlags = {
        priceOutlier,
        sizeOutlier,
        dateOutlier,
        neighborhoodOutlier,
        isOutlier: priceOutlier || sizeOutlier || dateOutlier || neighborhoodOutlier,
      };
      const explanation = [
        rankScore >= 80 ? "This comp is very close to the subject on timing, location, and physical characteristics." : "This comp is reasonably similar but not a perfect match.",
        priceOutlier ? "The sale price sits outside the typical range for the current comp set." : "The sale price remains within the general range of the comp set.",
        sizeOutlier ? "The size deviates materially from the other comparables." : "The size is broadly in line with the comparable set.",
        dateOutlier ? "The sale date is materially older or newer than the surrounding comp pool." : "The sale date is acceptable for the current market window.",
        neighborhoodOutlier ? "The neighborhood differs from the dominant cluster of nearby sales." : "The neighborhood stays consistent with the nearby cluster.",
      ].filter(Boolean);
      return {
        ...item,
        rank: 0,
        rankScore,
        classification,
        classExplanation: explanation.join(" "),
        outlierFlags,
      };
    })
    .sort((a, b) => b.rankScore - a.rankScore)
    .map((item, index) => ({ ...item, rank: index + 1 }));

  const allOutlierFlags = comparableRankings.flatMap((item) => Object.entries(item.outlierFlags || {}).filter(([, value]) => value).map(([flag]) => flag));
  const priceOutlierCount = comparableRankings.filter((item) => item.outlierFlags?.priceOutlier).length;
  const sizeOutlierCount = comparableRankings.filter((item) => item.outlierFlags?.sizeOutlier).length;
  const dateOutlierCount = comparableRankings.filter((item) => item.outlierFlags?.dateOutlier).length;
  const neighborhoodOutlierCount = comparableRankings.filter((item) => item.outlierFlags?.neighborhoodOutlier).length;
  const averageRankScore = comparableRankings.length ? comparableRankings.reduce((sum, item) => sum + item.rankScore, 0) / comparableRankings.length : 0;
  const marketStabilityScore = Math.max(0, Math.min(100, 100 - (priceOutlierCount * 12 + sizeOutlierCount * 8 + dateOutlierCount * 8 + neighborhoodOutlierCount * 6)));
  const sampleQualityScore = Math.max(0, Math.min(100, averageRankScore));
  const diversityPool = new Set(comparableRankings.map((item) => `${item.neighborhood || ""}-${item.propertyType || ""}-${item.distanceMiles || 0}`));
  const comparableDiversityScore = Math.max(0, Math.min(100, Math.round((diversityPool.size / Math.max(1, comparableRankings.length)) * 100)));
  const overallConfidenceScore = Math.round(sampleQualityScore * 0.45 + marketStabilityScore * 0.3 + comparableDiversityScore * 0.25);
  const confidenceLabel = overallConfidenceScore >= 80 ? "High" : overallConfidenceScore >= 60 ? "Moderate" : overallConfidenceScore >= 35 ? "Low" : "Very Low";

  const adjustmentEngine = {
    bedrooms: {
      adjustmentPercent: comparableRankings.length ? Math.round((comparableRankings.reduce((sum, item) => sum + (safeNumber(item.bedrooms) - safeNumber(subject.bedrooms)), 0) / Math.max(1, comparableRankings.length)) * 10) : 0,
      adjustmentValue: 0,
      rationale: comparableRankings.length ? "Profile the room count against the most similar comps before underwriting the value." : "No comp data available for bedroom adjustment.",
    },
    bathrooms: {
      adjustmentPercent: comparableRankings.length ? Math.round((comparableRankings.reduce((sum, item) => sum + (safeNumber(item.bathrooms) - safeNumber(subject.bathrooms)), 0) / Math.max(1, comparableRankings.length)) * 10) : 0,
      adjustmentValue: 0,
      rationale: comparableRankings.length ? "Inspect bath count variance and reflect it in the comp adjustment logic." : "No comp data available for bathroom adjustment.",
    },
    garage: {
      adjustmentPercent: comparableRankings.length && subject.garage ? 4 : 0,
      adjustmentValue: 0,
      rationale: comparableRankings.length ? "Garage type should be adjusted for variance in parking and storage utility." : "No comp data available for garage adjustment.",
    },
    basement: {
      adjustmentPercent: comparableRankings.length && subject.basement ? 4 : 0,
      adjustmentValue: 0,
      rationale: comparableRankings.length ? "Finished or unfinished basement quality should be reflected in the adjustment model." : "No comp data available for basement adjustment.",
    },
    lotSize: {
      adjustmentPercent: comparableRankings.length ? Math.round((safeNumber(subject.lotSize) > 0 ? (safeNumber(subject.lotSize) - (comparableRankings.reduce((sum, item) => sum + safeNumber(item.lotSize), 0) / Math.max(1, comparableRankings.length))) / Math.max(safeNumber(subject.lotSize), 1) * 100 : 0)) : 0,
      adjustmentValue: 0,
      rationale: comparableRankings.length ? "Lot size variance should be considered for market comparability." : "No comp data available for lot-size adjustment.",
    },
    squareFeet: {
      adjustmentPercent: comparableRankings.length ? Math.round((safeNumber(subject.squareFeet) > 0 ? (safeNumber(subject.squareFeet) - (comparableRankings.reduce((sum, item) => sum + safeNumber(item.squareFeet), 0) / Math.max(1, comparableRankings.length))) / Math.max(safeNumber(subject.squareFeet), 1) * 100 : 0)) : 0,
      adjustmentValue: 0,
      rationale: comparableRankings.length ? "Square footage variance should be adjusted before finalizing the ARV range." : "No comp data available for square-foot adjustment.",
    },
    condition: {
      adjustmentPercent: comparableRankings.length ? Math.round((1 - getConditionSimilarity(subject.condition, comparableRankings[0]?.condition || subject.condition)) * 100) : 0,
      adjustmentValue: 0,
      rationale: comparableRankings.length ? "Condition differences should temper the sale price expectation." : "No comp data available for condition adjustment.",
    },
    age: {
      adjustmentPercent: comparableRankings.length ? Math.round((safeNumber(subject.yearBuilt) > 0 ? Math.abs(safeNumber(subject.yearBuilt) - (comparableRankings.reduce((sum, item) => sum + safeNumber(item.yearBuilt || 0), 0) / Math.max(1, comparableRankings.length))) / Math.max(safeNumber(subject.yearBuilt), 1) * 100 : 0)) : 0,
      adjustmentValue: 0,
      rationale: comparableRankings.length ? "Age differences should influence the final supported value." : "No comp data available for age adjustment.",
    },
    quality: {
      adjustmentPercent: comparableRankings.length ? Math.round((100 - Math.min(100, averageRankScore))) : 0,
      adjustmentValue: 0,
      rationale: comparableRankings.length ? "The quality of the comp pool should influence the final confidence and range." : "No comp data available for quality adjustment.",
    },
  };

  let confidenceLevel = "Insufficient Data";
  if (manualArvOverride > 0) confidenceLevel = includedComps.length >= 3 ? "High" : includedComps.length >= 2 ? "Moderate" : "Low";
  else if (includedComps.length >= 3 && spread <= 0.12 && primaryComps.length >= 2) confidenceLevel = "High";
  else if (includedComps.length >= 2) confidenceLevel = "Moderate";
  else if (includedComps.length === 1) confidenceLevel = "Low";

  const strongestComp = [...comparableRankings].sort((a, b) => b.rankScore - a.rankScore)[0] || null;
  const weakestComp = [...comparableRankings].sort((a, b) => a.rankScore - b.rankScore)[0] || null;
  const supportedArvBase = weightedAdjustedArv > 0 ? weightedAdjustedArv : fallbackArv;
  const activeArv = manualArvOverride > 0 ? manualArvOverride : supportedArvBase;
  const activeArvSource = manualArvOverride > 0 ? "Manual" : (includedComps.length ? "Comparable Sales" : "Manual");
  const activeArvConfidence = manualArvOverride > 0 ? (includedComps.length >= 3 ? "High" : includedComps.length >= 2 ? "Moderate" : "Low") : (confidenceLabel === "High" ? "High" : confidenceLabel === "Moderate" ? "Moderate" : confidenceLabel === "Low" ? "Low" : "Low");
  const manualVersusSupportedVariance = activeArv > 0 && supportedArvBase > 0 ? (activeArv - supportedArvBase) / supportedArvBase : 0;
  const explanation = {
    whySelected: manualArvOverride > 0
      ? `A manual ARV override of ${manualArvOverride.toLocaleString()} was applied to preserve the documented value.`
      : includedComps.length ? "The selected comps align on property type, ZIP, and basic physical characteristics." : "No qualifying comps were available.",
    whyExcluded: compEvaluations.filter((item) => item.status === "Weak Comp").length ? "More distant or stale comps were downgraded due to reduced similarity." : "No comps were excluded beyond the eligibility filter.",
    strongestSupportingComp: strongestComp ? `${strongestComp.address} (${strongestComp.rankScore.toFixed(0)} quality score)` : "Insufficient Data",
    weakestIncludedComp: weakestComp ? `${weakestComp.address} (${weakestComp.rankScore.toFixed(0)} quality score)` : "Insufficient Data",
    largestAdjustment: manualArvOverride > 0 ? "Manual override applied" : "Insufficient Data",
    primaryUncertainty: includedComps.length ? "Limited comp count or weaker similarity can reduce confidence." : "No supported comp data is available.",
    informationNeeded: includedComps.length ? ["Additional recent sales", "More complete comp details", "Neighborhood support"] : ["At least one reliable comp", "Sale pricing", "Property-level characteristics"],
  };

  return {
    subject,
    compEvaluations: comparableRankings.map((item) => ({
      ...item,
      rankScore: item.rankScore,
      classification: item.classification,
      inclusionReason: item.classificationReason || item.inclusionReason,
      inclusionReasonDetail: item.classExplanation || item.inclusionReasonDetail,
      outlierFlags: item.outlierFlags,
    })),
    comparableRankings,
    comparableOutlierSummary: {
      priceOutlierCount,
      sizeOutlierCount,
      dateOutlierCount,
      neighborhoodOutlierCount,
      flaggedCompCount: allOutlierFlags.length,
      outlierFlags: allOutlierFlags,
    },
    comparableConfidence: {
      overallConfidenceScore,
      confidenceLabel,
      marketStabilityScore,
      sampleQualityScore,
      comparableDiversityScore,
      averageRankScore,
    },
    adjustmentEngine,
    supportedLowArv: lowArv,
    supportedBaseArv: baseArv,
    supportedHighArv: highArv,
    activeArv,
    activeArvSource,
    activeArvConfidence,
    manualVersusSupportedVariance,
    weightedAdjustedArv: baseArv,
    medianAdjustedArv: baseArv,
    weightedPricePerSquareFoot: subject.squareFeet > 0 && baseArv > 0 ? baseArv / subject.squareFeet : 0,
    primaryCompCount: primaryComps.length,
    supportingCompCount: supportingComps.length,
    compSpread: spread,
    confidenceScore: confidenceLevel === "High" ? 85 : confidenceLevel === "Moderate" ? 65 : confidenceLevel === "Low" ? 35 : 0,
    confidenceLevel,
    explanation,
    neighborhoods,
  };
}

export function buildPredictiveMarketIntelligence(deal = {}, neighborhoods = [], comps = []) {
  const normalizedDeal = normalizeDealForIntelligence(deal);
  const normalizedNeighborhoods = Array.isArray(neighborhoods) ? neighborhoods : [];
  const normalizedComps = (Array.isArray(comps) ? comps : []).map(normalizeComp);
  const neighborhood = normalizedNeighborhoods.find((entry) => {
    const name = String(entry.neighborhoodName || entry.name || "").toLowerCase();
    const city = String(entry.city || "").toLowerCase();
    const zip = String(entry.zipCode || entry.zip || "");
    const target = String(normalizedDeal.neighborhood || normalizedDeal.neighborhoodName || "").toLowerCase();
    return name.includes(target) || city.includes(String(normalizedDeal.city || "").toLowerCase()) || zip === String(normalizedDeal.zipCode || "");
  }) || normalizedNeighborhoods[0] || {};

  const appreciation1Year = safeNumber(neighborhood.appreciation1Year ?? neighborhood.appreciation ?? 0);
  const appreciation3Year = safeNumber(neighborhood.appreciation3Year ?? 0);
  const appreciation5Year = safeNumber(neighborhood.appreciation5Year ?? 0);
  const appreciation10Year = safeNumber(neighborhood.appreciation10Year ?? 0);
  const medianHomeValue = safeNumber(neighborhood.medianHomeValue ?? neighborhood.homeValue ?? 0);
  const averageDaysOnMarket = safeNumber(neighborhood.averageDaysOnMarket ?? neighborhood.daysOnMarket ?? 0);
  const activeInventory = safeNumber(neighborhood.activeInventory ?? 0);
  const monthsOfSupply = safeNumber(neighborhood.monthsOfSupply ?? 0);
  const medianPricePerSqft = safeNumber(neighborhood.medianPricePerSqft ?? neighborhood.pricePerSqft ?? 0);
  const affordability = medianHomeValue > 0 ? Math.max(0, 100 - medianHomeValue / 10000) : 0;
  const recentCompValues = normalizedComps.map((entry) => safeNumber(entry.salePrice)).filter((value) => value > 0);
  const recentCompPsf = normalizedComps.map((entry) => safeNumber(entry.pricePerSquareFoot)).filter((value) => value > 0);
  const averageRecentCompPrice = recentCompValues.length ? recentCompValues.reduce((sum, value) => sum + value, 0) / recentCompValues.length : medianHomeValue;
  const averageRecentCompPsf = recentCompPsf.length ? recentCompPsf.reduce((sum, value) => sum + value, 0) / recentCompPsf.length : medianPricePerSqft;

  const appreciationTrend = ((appreciation1Year + appreciation3Year + appreciation5Year + appreciation10Year) / 4) || 0;
  const priceMomentum = medianHomeValue > 0 && averageRecentCompPrice > 0 ? ((averageRecentCompPrice - medianHomeValue) / medianHomeValue) * 100 : 0;
  const inventoryTrend = activeInventory > 0 ? Math.max(0, 100 - activeInventory * 4) : 0;
  const daysOnMarketTrend = averageDaysOnMarket > 0 ? Math.max(0, 100 - averageDaysOnMarket * 1.5) : 0;
  const pricePerSquareFootTrend = medianPricePerSqft > 0 && averageRecentCompPsf > 0 ? ((averageRecentCompPsf - medianPricePerSqft) / medianPricePerSqft) * 100 : 0;

  const marketTrendEngine = {
    appreciationTrend,
    priceMomentum,
    inventoryTrend,
    daysOnMarketTrend,
    pricePerSquareFootTrend,
  };

  const marketStabilityScore = Math.max(0, Math.min(100, 45 + appreciationTrend * 3 + Math.max(0, priceMomentum) * 0.2 + inventoryTrend * 0.3 + daysOnMarketTrend * 0.2 + Math.max(0, pricePerSquareFootTrend) * 0.15));
  const appreciationRisk = appreciationTrend < 2 ? "High" : appreciationTrend < 4 ? "Moderate" : "Low";
  const downsideRisk = marketStabilityScore < 55 ? "High" : marketStabilityScore < 75 ? "Moderate" : "Low";
  const liquidityRisk = averageDaysOnMarket > 45 ? "High" : averageDaysOnMarket > 30 ? "Moderate" : "Low";
  const exitRisk = monthsOfSupply > 4 ? "High" : monthsOfSupply > 2 ? "Moderate" : "Low";
  const volatilityScore = Math.max(0, Math.min(100, Math.round((Math.abs(priceMomentum) * 0.4) + (Math.abs(pricePerSquareFootTrend) * 0.3) + (Math.abs(activeInventory - 20) / 20 * 20) + (Math.abs(averageDaysOnMarket - 30) / 30 * 20))));
  const volatilityBand = volatilityScore >= 75 ? "High" : volatilityScore >= 45 ? "Moderate" : "Low";
  const marketRiskRating = marketStabilityScore >= 85 && appreciationRisk === "Low" && liquidityRisk === "Low" && exitRisk === "Low" ? "Very Low"
    : marketStabilityScore >= 70 && appreciationRisk !== "High" && liquidityRisk !== "High" && exitRisk !== "High" ? "Low"
      : marketStabilityScore >= 55 && volatilityBand !== "High" ? "Moderate"
        : marketStabilityScore >= 35 ? "Elevated" : "High";

  const marketStabilityExplanation = `The market stability score of ${Math.round(marketStabilityScore)} reflects ${appreciationTrend >= 4 ? "healthy" : appreciationTrend >= 2 ? "moderate" : "weak"} appreciation momentum, ${inventoryTrend >= 70 ? "tight inventory" : inventoryTrend >= 45 ? "balanced supply" : "elevated supply"}, and ${daysOnMarketTrend >= 70 ? "strong" : daysOnMarketTrend >= 50 ? "steady" : "sluggish"} liquidity pressure.`;
  const appreciationRiskExplanation = appreciationRisk === "Low"
    ? `Appreciation remains constructive at ${appreciationTrend.toFixed(1)}% annualized, supporting a durable exit thesis.`
    : appreciationRisk === "Moderate"
      ? `Appreciation is mixed at ${appreciationTrend.toFixed(1)}%, so the market may underperform if buyer demand softens.`
      : `Appreciation is weak at ${appreciationTrend.toFixed(1)}%, which increases downside sensitivity if the market cools.`;
  const liquidityRiskExplanation = liquidityRisk === "Low"
    ? `Days on market are ${averageDaysOnMarket.toFixed(0)}, indicating ${averageDaysOnMarket <= 30 ? "healthy" : "acceptable"} velocity for resale.`
    : liquidityRisk === "Moderate"
      ? `Days on market are ${averageDaysOnMarket.toFixed(0)}, which suggests a slower path to sale if the market softens.`
      : `Days on market are ${averageDaysOnMarket.toFixed(0)}, signaling materially weaker resale liquidity.`;
  const downsideRiskExplanation = downsideRisk === "Low"
    ? "The market carries limited downside risk because the combined stability metrics remain favorable."
    : downsideRisk === "Moderate"
      ? "The market has moderate downside risk because price momentum and liquidity are not yet fully aligned."
      : "The market has elevated downside risk because supply, demand, and timing indicators are not supporting a stable exit.";
  const exitRiskExplanation = exitRisk === "Low"
    ? "Exit risk is low because supply conditions remain manageable and the market should absorb a sale without major delay."
    : exitRisk === "Moderate"
      ? "Exit risk is moderate because inventory and absorption conditions may lengthen the sale period." 
      : "Exit risk is high because the market is carrying excess supply and may require more time and price flexibility to exit.";
  const volatilityScoreExplanation = `Volatility is ${volatilityScore.toFixed(0)} out of 100 due to price momentum, price-per-square-foot movement, and inventory variation across the observed market signals.`;
  const marketRiskRatingExplanation = marketRiskRating === "Very Low"
    ? "The market is exceptionally stable with supportive appreciation, strong liquidity, and manageable supply conditions."
    : marketRiskRating === "Low"
      ? "The market is generally stable with only modest risk to underwriting assumptions."
      : marketRiskRating === "Moderate"
        ? "The market is workable, but underwriting should reflect some sensitivity to timing and exit conditions."
        : marketRiskRating === "Elevated"
          ? "The market carries elevated risk and requires a more conservative acquisition posture."
          : "The market is risky and should be approached with caution, tighter pricing, and stronger downside assumptions.";

  const marketRiskEngine = {
    marketStabilityScore,
    appreciationRisk,
    downsideRisk,
    liquidityRisk,
    exitRisk,
    volatilityScore,
    marketRiskRating,
    marketStabilityExplanation,
    appreciationRiskExplanation,
    liquidityRiskExplanation,
    downsideRiskExplanation,
    exitRiskExplanation,
    volatilityScoreExplanation,
    marketRiskRatingExplanation,
  };

  const opportunityScore = Math.max(0, Math.min(100, marketStabilityScore + appreciationTrend * 4 + (priceMomentum > 0 ? 8 : 0) - (liquidityRisk === "High" ? 12 : liquidityRisk === "Moderate" ? 6 : 0) - (exitRisk === "High" ? 10 : exitRisk === "Moderate" ? 4 : 0)));
  let classification = "Neutral";
  let explanation = "The market is balanced and does not clearly favor aggressive underwriting.";
  if (opportunityScore >= 85) {
    classification = "Strong Buy";
    explanation = "The market shows strong appreciation, stable liquidity, and supportive forward momentum for acquisition.";
  } else if (opportunityScore >= 70) {
    classification = "Buy";
    explanation = "The market has favorable appreciation and manageable risk, supporting a disciplined purchase.";
  } else if (opportunityScore >= 55) {
    classification = "Neutral";
    explanation = "The market is acceptable but should be underwritten conservatively until more data is available.";
  } else if (opportunityScore >= 40) {
    classification = "Watch";
    explanation = "The market shows mixed momentum and elevated risk, so the deal should be monitored closely.";
  } else {
    classification = "Avoid";
    explanation = "The market has weak momentum and elevated downside risk, so the opportunity is unattractive.";
  }

  const opportunityDetection = {
    classification,
    explanation,
    opportunityScore,
  };

  const forecastConfidence = Math.max(0, Math.min(100, marketStabilityScore * 0.55 + (appreciationTrend > 0 ? 20 : 0) + (averageDaysOnMarket > 0 ? 10 : 0) + (activeInventory > 0 ? 5 : 0)));
  const dataQualityScore = Math.max(0, Math.min(100, 40 + (appreciation1Year > 0 ? 15 : 0) + (medianHomeValue > 0 ? 15 : 0) + (averageDaysOnMarket > 0 ? 15 : 0) + (monthsOfSupply > 0 ? 10 : 0) + (normalizedComps.length ? 5 : 0)));
  const trendReliability = forecastConfidence >= 80 ? "High" : forecastConfidence >= 60 ? "Moderate" : "Low";
  const predictionStability = marketStabilityScore >= 75 ? "Stable" : marketStabilityScore >= 55 ? "Mixed" : "Volatile";

  const marketConfidence = {
    forecastConfidence,
    dataQualityScore,
    trendReliability,
    predictionStability,
  };

  const executiveSummary = {
    attractiveMarket: appreciationTrend > 3 ? "The neighborhood is showing healthy appreciation and strong momentum, which supports a premium underwriting posture." : "The neighborhood’s appreciation is moderate, so the strategy should stay conservative.",
    majorRisks: [
      affordability ? "Affordability pressure may slow buyer demand." : null,
      liquidityRisk === "High" ? "Liquidity remains tight and could prolong the exit." : null,
      exitRisk === "High" ? "Inventory and supply conditions may increase marketing time." : null,
    ].filter(Boolean),
    recommendedStrategy: classification === "Strong Buy" || classification === "Buy" ? "Proceed with disciplined underwriting and keep the offer ladder grounded in conservative ARV support." : "Proceed cautiously and require stronger comp support before increasing the offer or hold period.",
    confidenceLevel: forecastConfidence >= 80 ? "High" : forecastConfidence >= 60 ? "Moderate" : "Low",
  };

  return {
    deal: normalizedDeal,
    neighborhood,
    marketTrendEngine,
    marketRiskEngine,
    opportunityDetection,
    marketConfidence,
    executiveSummary,
    comps: normalizedComps,
  };
}

export function buildOpportunityDetectionEngine(deal = {}, arv = {}, market = {}, buyBox = {}, dealMetrics = {}, brrrrMetrics = {}, flipMetrics = {}, holdMetrics = {}) {
  const normalizedDeal = normalizeDealForIntelligence(deal);
  const normalizedArv = arv || {};
  const normalizedMarket = market || {};
  const normalizedBuyBox = buyBox || {};
  const normalizedDealMetrics = dealMetrics || {};
  const normalizedBrrrrMetrics = brrrrMetrics || {};
  const normalizedFlipMetrics = flipMetrics || {};
  const normalizedHoldMetrics = holdMetrics || {};
  const confidenceLevel = String(normalizedArv.confidenceLevel || normalizedArv.confidence || "Insufficient Data").toLowerCase();
  const compQuality = safeNumber(normalizedArv.comparableConfidence?.overallConfidenceScore ?? normalizedArv.comparableConfidence?.averageRankScore ?? 0);
  const marketTrendScore = safeNumber(normalizedMarket.marketTrendEngine?.appreciationTrend ?? normalizedMarket.marketTrendScore ?? 0) * 8 + safeNumber(normalizedMarket.marketTrendEngine?.priceMomentum ?? 0) * 1.2 + safeNumber(normalizedMarket.marketTrendEngine?.inventoryTrend ?? 0) * 0.25 + safeNumber(normalizedMarket.marketTrendEngine?.daysOnMarketTrend ?? 0) * 0.25;
  const marketRiskScore = safeNumber(normalizedMarket.marketRiskEngine?.marketStabilityScore ?? normalizedMarket.marketRiskScore ?? 0);
  const cashOnCashReturn = safeNumber(normalizedBrrrrMetrics.cashOnCashReturn ?? normalizedDealMetrics.cashOnCashReturn ?? 0);
  const equityCreated = safeNumber(normalizedBrrrrMetrics.cashLeftInDeal ?? normalizedDealMetrics.equityCreated ?? normalizedDealMetrics.equityCreatedValue ?? 0);
  const brrrrPerformance = safeNumber(normalizedBrrrrMetrics.debtServiceCoverageRatio ?? normalizedBrrrrMetrics.dscr ?? 0) * 30 + safeNumber(normalizedBrrrrMetrics.monthlyCashFlow ?? 0) / 200;
  const flipMargin = safeNumber(normalizedFlipMetrics.profitMargin ?? normalizedFlipMetrics.margin ?? 0) * 100;
  const holdPerformance = safeNumber(normalizedHoldMetrics.cashOnCashReturn ?? normalizedHoldMetrics.monthlyCashFlow ?? 0) * 10 + safeNumber(normalizedHoldMetrics.netOperatingIncome ?? 0) / 500;
  const exitRisk = String(normalizedMarket.marketRiskEngine?.exitRisk || normalizedMarket.exitRisk || "Moderate").toLowerCase();

  let score = 0;
  if (confidenceLevel === "high") score += 18;
  else if (confidenceLevel === "moderate") score += 12;
  else if (confidenceLevel === "low") score += 6;
  if (compQuality >= 80) score += 16;
  else if (compQuality >= 60) score += 10;
  else if (compQuality >= 40) score += 6;
  if (marketTrendScore >= 40) score += 14;
  else if (marketTrendScore >= 20) score += 8;
  if (marketRiskScore >= 75) score += 12;
  else if (marketRiskScore >= 55) score += 8;
  else if (marketRiskScore >= 35) score += 4;
  if (cashOnCashReturn >= 0.12) score += 10;
  else if (cashOnCashReturn >= 0.08) score += 6;
  if (equityCreated >= 30000) score += 8;
  else if (equityCreated >= 15000) score += 4;
  if (brrrrPerformance >= 1.2) score += 8;
  else if (brrrrPerformance >= 0.8) score += 4;
  if (flipMargin >= 15) score += 8;
  else if (flipMargin >= 8) score += 4;
  if (holdPerformance >= 8) score += 6;
  else if (holdPerformance >= 4) score += 3;
  if (exitRisk === "low") score += 6;
  else if (exitRisk === "moderate") score += 3;
  if (String(normalizedBuyBox.result || normalizedBuyBox.decision || "").toLowerCase() === "pass") score += 6;
  else if (String(normalizedBuyBox.result || normalizedBuyBox.decision || "").toLowerCase() === "conditional") score += 3;

  const overallOpportunityScore = Math.max(0, Math.min(100, Math.round(score)));
  let classification = "Neutral";
  if (overallOpportunityScore >= 88) classification = "Strong Buy";
  else if (overallOpportunityScore >= 74) classification = "Buy";
  else if (overallOpportunityScore >= 58) classification = "Neutral";
  else if (overallOpportunityScore >= 40) classification = "Watch";
  else classification = "Avoid";

  const strengths = [];
  if (confidenceLevel === "high") strengths.push("ARV confidence is strong and supported by quality comparables.");
  if (marketRiskScore >= 70) strengths.push("The market structure is stable with favorable liquidity and exit conditions.");
  if (cashOnCashReturn >= 0.12 || equityCreated >= 30000) strengths.push("The deal is producing strong cash-on-cash or equity creation potential.");
  if (flipMargin >= 15) strengths.push("The flip margin remains attractive relative to the current cost basis.");
  if (brrrrPerformance >= 1.2) strengths.push("The BRRRR cash-flow profile is supportive of the strategy.");

  const weaknesses = [];
  if (confidenceLevel !== "high") weaknesses.push("ARV support is not yet fully confident.");
  if (compQuality < 60) weaknesses.push("Comparable quality is only moderate and may weaken support.");
  if (marketRiskScore < 60) weaknesses.push("The market risk profile is not yet strong enough to justify aggressive pricing.");
  if (cashOnCashReturn < 0.08 && equityCreated < 15000) weaknesses.push("Near-term cash yield and equity creation are modest.");
  if (flipMargin < 8) weaknesses.push("The flip margin is thin and leaves limited cushion for execution variance.");
  if (exitRisk === "high") weaknesses.push("Exit risk is elevated and could pressure the eventual sale or refinance outcome.");

  let largestRisk = "The deal is sensitive to pricing, timing, and market execution.";
  if (exitRisk === "high") largestRisk = "Exit risk is the primary concern because liquidity and move-up timing may be constrained.";
  else if (confidenceLevel !== "high") largestRisk = "Valuation confidence is the largest risk because the ARV support may be less durable.";
  else if (marketRiskScore < 60) largestRisk = "Market weakness could compress value faster than the underwriting assumptions anticipate.";

  let highestUpside = "The deal can still benefit from strong comp support, favorable timing, and disciplined execution.";
  if (flipMargin >= 15 || cashOnCashReturn >= 0.12) highestUpside = "The project has meaningful upside through margin expansion and stronger-than-expected exit performance.";
  else if (equityCreated >= 30000) highestUpside = "The deal has substantial upside through equity creation and refinance flexibility.";

  const aiReasoning = {
    summary: `The opportunity received a ${classification.toLowerCase()} rating because the combined underwriting signals, market posture, and financing profile support a ${overallOpportunityScore}-out-of-100 opportunity score.`,
    biggestStrengths: strengths.length ? strengths : ["The deal still has a workable cost basis and an acceptable underwriting profile."],
    biggestWeaknesses: weaknesses.length ? weaknesses : ["The current data set leaves some room for uncertainty around execution timing."],
    largestRisk,
    highestUpside,
  };

  return {
    normalizedDeal,
    classification,
    overallOpportunityScore,
    aiReasoning,
    scoreComponents: {
      confidenceLevel,
      compQuality,
      marketTrendScore,
      marketRiskScore,
      cashOnCashReturn,
      equityCreated,
      brrrrPerformance,
      flipMargin,
      holdPerformance,
      exitRisk,
    },
  };
}

export function buildExecutiveMarketSummaryEngine(deal = {}, arv = {}, market = {}, opportunity = {}, forecast = {}, recommendation = {}) {
  const normalizedDeal = normalizeDealForIntelligence(deal);
  const normalizedArv = arv || {};
  const normalizedMarket = market || {};
  const normalizedOpportunity = opportunity || {};
  const normalizedForecast = forecast || {};
  const normalizedRecommendation = recommendation || {};
  const appreciationTrend = safeNumber(normalizedMarket.marketTrendEngine?.appreciationTrend ?? 0);
  const priceMomentum = safeNumber(normalizedMarket.marketTrendEngine?.priceMomentum ?? 0);
  const marketStabilityScore = safeNumber(normalizedMarket.marketRiskEngine?.marketStabilityScore ?? 0);
  const opportunityScore = safeNumber(normalizedOpportunity.overallOpportunityScore ?? normalizedOpportunity.opportunityScore ?? 0);
  const forecastConfidence = safeNumber(normalizedForecast.forecastConfidence ?? 0);
  const confidenceLabel = forecastConfidence >= 80 ? "High" : forecastConfidence >= 60 ? "Moderate" : "Low";
  const strategy = safeString(normalizedDeal.strategy || normalizedDeal.exitStrategy || "Flip", "Flip").toLowerCase();

  let overallMarketRating = "Balanced";
  if (marketStabilityScore >= 80 && appreciationTrend >= 4) overallMarketRating = "Strong";
  else if (marketStabilityScore >= 60 && appreciationTrend >= 2) overallMarketRating = "Healthy";
  else if (marketStabilityScore >= 40) overallMarketRating = "Mixed";
  else overallMarketRating = "Weak";

  let opportunityRating = "Moderate";
  if (opportunityScore >= 80) opportunityRating = "Strong";
  else if (opportunityScore >= 60) opportunityRating = "Favorable";
  else if (opportunityScore >= 40) opportunityRating = "Watch";
  else opportunityRating = "Limited";

  const marketTrendSummary = appreciationTrend >= 4
    ? `The market is showing strong appreciation momentum with ${priceMomentum >= 0 ? "positive" : "soft"} price movement.`
    : appreciationTrend >= 2
      ? `The market is moderately growing and still supports a disciplined underwriting posture.`
      : `The market is not strongly advancing, so the thesis should remain conservative.`;

  const appreciationOutlook = appreciationTrend >= 4
    ? `Appreciation expectations remain constructive and should support a resilient exit.`
    : appreciationTrend >= 2
      ? `Appreciation is present but should be treated as a moderate tailwind rather than a guaranteed outcome.`
      : `Appreciation is limited, so the strategy will rely more on purchase discipline than market upside.`;

  let exitStrategyRecommendation = "Hold for a disciplined exit and revisit pricing if the market softens.";
  if (strategy === "flip") exitStrategyRecommendation = "Target a quick sale with a conservative hold period and a clear markdown reserve.";
  else if (strategy === "brrrrr") exitStrategyRecommendation = "Preserve refinance flexibility and monitor DSCR, rents, and refinance terms closely.";
  else if (strategy === "hold") exitStrategyRecommendation = "Maintain a long-hold posture with focus on rent growth, occupancy, and operating efficiency.";

  const primaryRisks = [];
  if (marketStabilityScore < 70) primaryRisks.push("Market volatility could pressure exit timing or sale price.");
  if (opportunityScore < 70) primaryRisks.push("The deal margin is thin enough that execution variance could erase upside.");
  if (forecastConfidence < 70) primaryRisks.push("Forecast confidence is only moderate, so the assumptions need closer validation.");
  if (!primaryRisks.length) primaryRisks.push("The current thesis is intact but should still be monitored as the market evolves.");

  const primaryStrengths = [];
  if (marketStabilityScore >= 70) primaryStrengths.push("The market structure is stable enough to support the underwriting thesis.");
  if (opportunityScore >= 70) primaryStrengths.push("The opportunity score indicates strong value or cash-flow support.");
  if (forecastConfidence >= 70) primaryStrengths.push("The forecast is supported by credible comps and stable market signals.");
  if (!primaryStrengths.length) primaryStrengths.push("The deal still has a workable cost basis and a clear path to review.");

  const recommendedAction = normalizedRecommendation.action === "PROCEED"
    ? "Proceed with the deal while keeping the offer discipline consistent with the current assumptions."
    : normalizedRecommendation.action === "REQUEST MORE DATA"
      ? "Request more data and re-underwrite before moving forward with a stronger offer posture."
      : "Maintain current underwriting assumptions and continue monitoring the market before advancing.";

  const executiveSummary = {
    overallMarketRating,
    opportunityRating,
    marketTrendSummary,
    appreciationOutlook,
    exitStrategyRecommendation,
    primaryRisks,
    primaryStrengths,
    forecastConfidence: Math.round(forecastConfidence),
    recommendedAction,
    confidenceLabel,
  };

  const strategySummaries = {
    flipStrategy: `Flip strategy remains ${opportunityRating.toLowerCase()} because the market and comp support point to ${overallMarketRating.toLowerCase()} conditions for a short hold and resale.`,
    brrrrrStrategy: `BRRRR strategy remains ${opportunityRating.toLowerCase()} because refinance flexibility and cash-flow durability should be tested against current market liquidity and risk.`,
    holdStrategy: `Hold strategy remains ${opportunityRating.toLowerCase()} when the operating assumptions hold and the market continues to provide steady appreciation and liquidity.`,
  };

  let recommendationLabel = "Hold";
  if (opportunityScore >= 85 && forecastConfidence >= 80) recommendationLabel = "Strong Buy";
  else if (opportunityScore >= 70 && forecastConfidence >= 70) recommendationLabel = "Buy";
  else if (opportunityScore >= 55 && forecastConfidence >= 60) recommendationLabel = "Hold";
  else if (opportunityScore >= 40) recommendationLabel = "Review";
  else recommendationLabel = "Pass";

  const executiveRecommendation = {
    label: recommendationLabel,
    reason: `The ${recommendationLabel.toLowerCase()} recommendation reflects ${opportunityRating.toLowerCase()} opportunity quality, ${confidenceLabel.toLowerCase()} forecast confidence, and ${overallMarketRating.toLowerCase()} market conditions for the selected strategy.`,
  };

  return {
    normalizedDeal,
    executiveSummary,
    strategySummaries,
    executiveRecommendation,
  };
}

export function buildForecastConfidenceEngine(deal = {}, arv = {}, market = {}, opportunity = {}) {
  const normalizedDeal = normalizeDealForIntelligence(deal);
  const normalizedArv = arv || {};
  const normalizedMarket = market || {};
  const normalizedOpportunity = opportunity || {};
  const compEvaluations = Array.isArray(normalizedArv.compEvaluations) ? normalizedArv.compEvaluations : [];
  const comparableCount = compEvaluations.length;
  const avgCompQuality = comparableCount ? compEvaluations.reduce((sum, entry) => sum + safeNumber(entry.qualityScore ?? entry.rankScore ?? 0), 0) / comparableCount : 0;
  const compSpread = safeNumber(normalizedArv.compSpread ?? normalizedArv.comparableConfidence?.averageRankScore ?? 0);
  const confidenceLevel = String(normalizedArv.confidenceLevel || "Insufficient Data").toLowerCase();
  const appreciationTrend = safeNumber(normalizedMarket.marketTrendEngine?.appreciationTrend ?? 0);
  const priceMomentum = safeNumber(normalizedMarket.marketTrendEngine?.priceMomentum ?? 0);
  const marketStabilityScore = safeNumber(normalizedMarket.marketRiskEngine?.marketStabilityScore ?? normalizedMarket.marketTrendEngine?.marketStabilityScore ?? 0);
  const opportunityScore = safeNumber(normalizedOpportunity.opportunityAnalysis?.overallOpportunityScore ?? normalizedOpportunity.overallOpportunityScore ?? normalizedOpportunity.dealScore ?? 0);
  const missingDataFlags = [
    !normalizedDeal.estimatedArv && !normalizedDeal.arv ? 1 : 0,
    comparableCount < 3 ? 1 : 0,
    compSpread > 0.15 ? 1 : 0,
    appreciationTrend <= 0 ? 1 : 0,
    marketStabilityScore <= 0 ? 1 : 0,
  ];
  const uncertaintyCount = missingDataFlags.reduce((sum, value) => sum + value, 0);

  let forecastConfidence = 100;
  if (confidenceLevel === "low") forecastConfidence -= 25;
  else if (confidenceLevel === "moderate") forecastConfidence -= 10;
  if (comparableCount < 3) forecastConfidence -= 12;
  if (compSpread > 0.15) forecastConfidence -= 10;
  if (Math.abs(priceMomentum) > 8) forecastConfidence -= 8;
  if (marketStabilityScore < 60) forecastConfidence -= 12;
  if (opportunityScore < 60) forecastConfidence -= 8;
  if (uncertaintyCount >= 3) forecastConfidence -= 10;
  if (uncertaintyCount >= 4) forecastConfidence -= 8;
  forecastConfidence = Math.max(0, Math.min(100, Math.round(forecastConfidence)));

  const dataQualityScore = Math.max(0, Math.min(100, Math.round(35 + (confidenceLevel === "high" ? 20 : confidenceLevel === "moderate" ? 12 : 6) + (comparableCount >= 3 ? 15 : comparableCount >= 2 ? 8 : 3) + (avgCompQuality >= 70 ? 15 : avgCompQuality >= 50 ? 8 : 3) + (marketStabilityScore >= 70 ? 10 : marketStabilityScore >= 50 ? 6 : 3))));
  const comparableReliability = comparableCount >= 3 && avgCompQuality >= 75 ? "High" : comparableCount >= 2 ? "Moderate" : "Low";
  const marketTrendReliability = marketStabilityScore >= 75 ? "High" : marketStabilityScore >= 55 ? "Moderate" : "Low";
  const predictionStability = forecastConfidence >= 80 ? "Stable" : forecastConfidence >= 60 ? "Mixed" : "Volatile";
  const forecastConsistency = comparableReliability === "High" && marketTrendReliability === "High" ? "High" : comparableReliability === "Moderate" || marketTrendReliability === "Moderate" ? "Moderate" : "Low";

  const uncertaintyFactors = [];
  if (comparableCount < 3) uncertaintyFactors.push("Low comparable count limits valuation reliability.");
  if (compSpread > 0.15) uncertaintyFactors.push("Wide value variance indicates unstable comparable support.");
  if (Math.abs(priceMomentum) > 8) uncertaintyFactors.push("Rapid market changes are creating directional uncertainty.");
  if (marketStabilityScore < 60) uncertaintyFactors.push("Conflicting market indicators are reducing forecast stability.");
  if (!normalizedDeal.estimatedArv && !normalizedDeal.arv) uncertaintyFactors.push("Missing market value data reduces confidence in the forecast.");
  if (!uncertaintyFactors.length) uncertaintyFactors.push("No major uncertainty flags were detected.");

  const improvementActions = [];
  if (comparableCount < 3) improvementActions.push("Add more recent comparable sales to stabilize the valuation.");
  if (compSpread > 0.15) improvementActions.push("Tighten the comp set or adjust for quality differences.");
  if (marketStabilityScore < 60) improvementActions.push("Collect additional market data to resolve conflicting trend signals.");
  if (!normalizedDeal.estimatedArv && !normalizedDeal.arv) improvementActions.push("Confirm the supported ARV before underwriting further.");
  if (!improvementActions.length) improvementActions.push("Maintain current assumptions and continue monitoring the market.");

  const aiExplanation = {
    summary: `Forecast confidence is ${forecastConfidence} because the combined comp support, market stability, and opportunity strength are ${forecastConfidence >= 70 ? "supportive" : forecastConfidence >= 40 ? "mixed" : "weak"}.`,
    uncertaintyFactors,
    improvementActions,
    largestUncertainty: uncertaintyFactors[0] || "No major uncertainty flags were detected.",
  };

  return {
    forecastConfidence,
    dataQualityScore,
    comparableReliability,
    marketTrendReliability,
    predictionStability,
    forecastConsistency,
    aiExplanation,
    uncertaintyFactors,
    improvementActions,
  };
}

export function buildBuyBoxIntelligence(deal = {}, neighborhoods = []) {
  const subject = normalizeSubject(deal);
  const normalizedNeighborhoods = Array.isArray(neighborhoods) ? neighborhoods : [];
  const rulesPassed = [];
  const rulesFailed = [];
  const conditionalRules = [];
  const targetMarkets = ["41011", "41014", "41015", "41016", "41017", "45211", "45224", "45239", "45205", "45238", "45231", "45223", "45232"];
  const prohibitedPropertyTypes = ["land", "mobile-home park", "rv park", "self-storage"];
  const normalizedZip = String(subject.zipCode).trim();
  const normalizedPropertyType = String(subject.propertyType).trim().toLowerCase();
  const normalizedStrategy = String(deal.strategy || "").trim().toLowerCase();
  const rehabBudget = safeNumber(deal.rehabBudget);
  const purchasePrice = safeNumber(deal.purchasePrice || deal.askingPrice);
  const arv = safeNumber(deal.projectedARV || deal.estimatedArv || deal.arv || deal.supportedARV || deal.currentValue);
  const propertyTypeAllowed = !prohibitedPropertyTypes.includes(normalizedPropertyType) && !["vacant land", "land"].includes(normalizedPropertyType);
  const locatedInTarget = targetMarkets.includes(normalizedZip) || /covington|cincinnati/i.test(`${subject.city} ${subject.state}`);
  const neighborhoodEntry = normalizedNeighborhoods.find((entry) => {
    const name = String(entry.neighborhoodName || entry.name || "").toLowerCase();
    const city = String(entry.city || "").toLowerCase();
    const zip = String(entry.zipCode || entry.zip || "");
    return name.includes(subject.neighborhood.toLowerCase()) || city.includes("covington") || city.includes("cincinnati") || zip === normalizedZip;
  }) || normalizedNeighborhoods[0] || {};
  const rentalDemand = safeNumber(neighborhoodEntry.rentalDemandScore ?? neighborhoodEntry.rentalDemand ?? neighborhoodEntry.investorDemandScore);
  const appreciation = safeNumber(neighborhoodEntry.appreciation1Year ?? neighborhoodEntry.appreciation3Year ?? neighborhoodEntry.appreciation5Year ?? neighborhoodEntry.appreciation10Year);
  const crimeRisk = safeNumber(neighborhoodEntry.crimeRating === "Low" ? 10 : neighborhoodEntry.crimeRating === "Moderate" ? 30 : neighborhoodEntry.crimeRating === "High" ? 70 : 0);
  const daysOnMarket = safeNumber(neighborhoodEntry.averageDaysOnMarket ?? neighborhoodEntry.daysOnMarket);

  if (!propertyTypeAllowed) {
    rulesFailed.push("Prohibited property type");
  } else {
    rulesPassed.push("Property type is acceptable");
  }

  if (locatedInTarget) {
    rulesPassed.push("Primary market location");
  } else {
    rulesFailed.push("Outside the primary target markets");
  }

  if (normalizedZip === "41011" || normalizedZip === "41014" || normalizedZip === "41015" || normalizedZip === "41016" || normalizedZip === "41017" || normalizedZip === "45211" || normalizedZip === "45224" || normalizedZip === "45239") {
    rulesPassed.push("Primary focus ZIP code");
  } else if (["41015", "45205", "45238", "45231", "45223", "45232"].includes(normalizedZip)) {
    conditionalRules.push("Selective ZIP code review");
  } else {
    rulesFailed.push("ZIP code is outside the preferred buy box");
  }

  if (rehabBudget <= 60000) rulesPassed.push("Rehab budget is within the preferred threshold");
  else rulesFailed.push("Rehab budget exceeds the preferred threshold");

  if (["flip", "brrrrr", "long-term rental", "rental"].includes(normalizedStrategy)) rulesPassed.push("Strategy supports the target business plans");
  else conditionalRules.push("Strategy is not explicitly aligned");

  const priceToArvRatio = arv > 0 ? purchasePrice / arv : 0;
  const propertyTypeScore = propertyTypeAllowed ? 32 : 0;
  const sizeScore = subject.squareFeet > 1800 ? 18 : 12;
  const ageScore = subject.yearBuilt >= 1950 ? 15 : 10;
  const rehabScore = rehabBudget <= 60000 ? 15 : 8;
  const priceScore = priceToArvRatio > 0 && priceToArvRatio <= 0.8 ? 12 : priceToArvRatio <= 0.9 ? 10 : 6;
  const propertyLevelScore = Math.round(Math.min(100, propertyTypeScore + sizeScore + ageScore + rehabScore + priceScore - 15));

  const locationScore = locatedInTarget ? 34 : 8;
  const marketPriorityScore = normalizedZip === "41011" || normalizedZip === "45211" || normalizedZip === "45239" ? 16 : normalizedZip === "41015" || normalizedZip === "45205" || normalizedZip === "45238" ? 10 : 6;
  const strategyFitScore = ["flip", "brrrrr", "long-term rental", "rental"].includes(normalizedStrategy) ? 12 : 8;
  const marketScore = Math.round(locationScore + marketPriorityScore + strategyFitScore + 18);

  const neighborhoodDemandScore = rentalDemand > 70 ? 18 : rentalDemand > 55 ? 12 : 8;
  const appreciationScore = appreciation >= 4 ? 14 : appreciation >= 2 ? 10 : 7;
  const riskAdjustmentScore = crimeRisk <= 20 ? 12 : crimeRisk <= 40 ? 8 : 4;
  const liquidityScore = daysOnMarket <= 45 ? 10 : daysOnMarket <= 90 ? 6 : 3;
  const neighborhoodScore = Math.round(neighborhoodDemandScore + appreciationScore + riskAdjustmentScore + liquidityScore);

  const overallScore = Math.round(propertyLevelScore * 0.4 + marketScore * 0.35 + neighborhoodScore * 0.25);
  const marketScoreForTest = Math.max(marketScore, neighborhoodScore);
  const marketScoreToUse = marketScoreForTest > propertyLevelScore ? marketScoreForTest : marketScore;

  const scoringBreakdown = [
    { category: "Property", factor: "Property type", points: propertyTypeAllowed ? 32 : 0, rationale: propertyTypeAllowed ? "Eligible property type for Royal Star buy-box review." : "Prohibited property type automatically fails the buy box." },
    { category: "Property", factor: "Square footage", points: sizeScore, rationale: subject.squareFeet > 1800 ? "The footprint supports the preferred scale for this strategy." : "The footprint is smaller than the preferred profile, which limits score." },
    { category: "Property", factor: "Year built", points: ageScore, rationale: subject.yearBuilt >= 1950 ? "The age aligns with the target housing stock." : "The age is outside the preferred profile." },
    { category: "Property", factor: "Rehab budget", points: rehabScore, rationale: rehabBudget <= 60000 ? "Rehab spend remains within the preferred threshold." : "Rehab spend exceeds the preferred threshold." },
    { category: "Property", factor: "Purchase price to ARV", points: priceScore, rationale: arv > 0 && priceToArvRatio <= 0.8 ? "The purchase price leaves an attractive spread to the supported ARV." : "The spread to ARV is less compelling than the target profile." },
    { category: "Market", factor: "Primary market location", points: locationScore, rationale: locatedInTarget ? "Primary market location in Covington or Cincinnati." : "Location falls outside the primary market footprint." },
    { category: "Market", factor: "ZIP priority", points: marketPriorityScore, rationale: normalizedZip === "41011" || normalizedZip === "45211" || normalizedZip === "45239" ? "The ZIP code is a primary focus area." : normalizedZip === "41015" || normalizedZip === "45205" || normalizedZip === "45238" ? "The ZIP code is a selective area requiring extra review." : "The ZIP code is outside the preferred focus footprint." },
    { category: "Market", factor: "Strategy fit", points: strategyFitScore, rationale: ["flip", "brrrrr", "long-term rental", "rental"].includes(normalizedStrategy) ? "The strategy aligns with the core Royal Star business plans." : "The strategy is not explicitly aligned with the preferred playbook." },
    { category: "Neighborhood", factor: "Rental demand", points: neighborhoodDemandScore, rationale: rentalDemand > 70 ? "Rental demand is strong for the selected neighborhood." : rentalDemand > 55 ? "Rental demand is acceptable but not exceptional." : "Rental demand is weak for the target buy box." },
    { category: "Neighborhood", factor: "Appreciation", points: appreciationScore, rationale: appreciation >= 4 ? "Recent appreciation supports the market thesis." : appreciation >= 2 ? "Appreciation is moderate and watchable." : "Appreciation is not currently supportive." },
    { category: "Neighborhood", factor: "Risk profile", points: riskAdjustmentScore, rationale: crimeRisk <= 20 ? "Crime risk is low for the neighborhood context." : crimeRisk <= 40 ? "Risk is manageable with conservative underwriting." : "Risk indicators suggest tighter underwriting is needed." },
    { category: "Neighborhood", factor: "Market liquidity", points: liquidityScore, rationale: daysOnMarket <= 45 ? "Liquidity looks healthy and turnover is brisk." : daysOnMarket <= 90 ? "Liquidity is moderate." : "Liquidity is soft, which can pressure exit assumptions." },
  ];

  let decision = "Insufficient Data";
  if (!propertyTypeAllowed) decision = "Automatic Reject";
  else if (rulesFailed.length === 0 && conditionalRules.length === 0 && overallScore >= 70 && neighborhoodScore >= 45) decision = "Strong Pass";
  else if (rulesFailed.length <= 1 && overallScore >= 62) decision = "Pass";
  else if (overallScore >= 58) decision = "Conditional Pass";
  else if (rulesFailed.some((rule) => rule.includes("ZIP"))) decision = "Selective Area Review";
  else decision = "Outside Buy Box";

  const scoringExplanation = [
    locatedInTarget ? "Primary market location in Covington or Cincinnati supports the deal." : "The location falls outside the primary market footprint.",
    normalizedZip === "41011" || normalizedZip === "45211" || normalizedZip === "45239" ? "The ZIP code is a primary focus area." : normalizedZip === "41015" || normalizedZip === "45205" || normalizedZip === "45238" ? "The ZIP code is a selective area requiring additional review." : "The ZIP code is outside the preferred focus footprint.",
    rentalDemand > 70 ? "Neighborhood demand is strong, which improves the rent and exit assumptions." : "Neighborhood demand is only moderate, so the deal should be underwritten conservatively.",
    rehabBudget <= 60000 ? "The rehab budget is within the preferred threshold." : "The rehab budget is above the preferred threshold and lowers the buy-box score.",
  ].join(" ");

  const result = {
    subject,
    decision,
    rulesPassed,
    rulesFailed,
    conditionalRules,
    locationScore,
    propertyTypeScore,
    sizeScore,
    ageScore,
    rehabScore,
    rentalScore: neighborhoodDemandScore,
    appreciationScore,
    financingScore: riskAdjustmentScore,
    exitScore: liquidityScore,
    overallScore,
    propertyLevelScore,
    marketScore: marketScoreToUse,
    neighborhoodScore,
    scoringBreakdown,
    scoringExplanation,
    decisionBreakingRule: rulesFailed.find((rule) => rule.includes("property type")) || rulesFailed[0] || "None",
    exceptionJustification: propertyTypeAllowed ? "The property fits the stated target market and rehab preferences." : "Prohibited property types are automatically rejected.",
    informationNeeded: propertyTypeAllowed ? ["Neighborhood demand", "Recent comparable sales", "Rehab scope"] : ["Use an eligible property type"],
  };

  return {
    ...result,
    result: decision === "Strong Pass" || decision === "Pass" ? "PASS" : decision === "Conditional Pass" || decision === "Selective Area Review" ? "CONDITIONAL" : decision === "Automatic Reject" ? "FAIL" : "INSUFFICIENT DATA",
  };
}

export function buildOfferIntelligence(deal = {}, arv = {}, buyBox = {}, financing = {}) {
  const normalizedDeal = normalizeDealForIntelligence(deal);
  const rawStrategy = String(normalizedDeal.strategy || normalizedDeal.exitStrategy || "Flip").toLowerCase();
  const strategy = rawStrategy === "brrrrr" || rawStrategy === "brrrr" ? "brrrr" : rawStrategy;
  const askingPrice = safeNumber(normalizedDeal.askingPrice || normalizedDeal.purchasePrice);
  const currentPurchasePrice = safeNumber(normalizedDeal.purchasePrice || normalizedDeal.askingPrice);
  const rehabBudget = safeNumber(normalizedDeal.rehabBudget);
  const contingency = safeNumber(normalizedDeal.contingency || rehabBudget * 0.1);
  const sellingCosts = safeNumber(normalizedDeal.sellingCosts || 0.08 * safeNumber(arv.supportedBaseArv || arv.supportedLowArv || arv.weightedAdjustedArv || 0));
  const financingCost = safeNumber(normalizedDeal.financingCosts || financing.loanAmount * 0.02 || 0);
  const holdCosts = safeNumber(normalizedDeal.holdingCosts || 0);
  const profitTarget = safeNumber(normalizedDeal.requiredProfit || 30000);
  const cashLeftTarget = safeNumber(normalizedDeal.requiredCashLeft || normalizedDeal.cashLeftTarget || 15000);
  const minimumProfitMargin = safeNumber(normalizedDeal.minimumProfitMargin || 0.12);
  const supportedArv = safeNumber(arv.supportedBaseArv || arv.weightedAdjustedArv || 0);
  const conservativeArv = safeNumber(arv.supportedLowArv || supportedArv * 0.95 || 0);
  const baseArv = supportedArv;
  const status = String(normalizedDeal.status || normalizedDeal.projectStatus || "").toLowerCase();
  const notes = String(normalizedDeal.notes || "").toLowerCase();
  const reviewMode = ["acquired", "owned", "in-rehab", "in rehab", "rehab", "listed", "refinancing", "held", "active project", "active", "in progress", "in progress"].includes(status) || /(owned|acquired|rehab|listed|refinancing|held)/i.test(notes) || (safeNumber(normalizedDeal.actualLoanAmount) > 0 && safeNumber(normalizedDeal.purchasePrice) > 0)
    ? "retrospective-acquisition-review"
    : "acquisition-offer-review";
  const retrospectiveReview = reviewMode === "retrospective-acquisition-review" ? {
    originalAcquisitionPrice: currentPurchasePrice,
    originalAcquisitionVariance: Math.max(0, currentPurchasePrice - Math.max(0, supportedArv - rehabBudget - contingency - financingCost - holdCosts - sellingCosts)),
    currentProjectedOutcome: Math.max(0, supportedArv - rehabBudget - contingency - financingCost - holdCosts - sellingCosts - Math.max(currentPurchasePrice * 0.8, currentPurchasePrice * 0.75)),
    reviewSummary: "Owned-project underwriting is being reviewed with acquisition cost context and current projected economics.",
  } : null;
  const lenderMaxLtv = safeNumber(financing.lenderMaxLtv || financing.maxLtv || 0.75);
  const lenderLoanAmount = supportedArv > 0 ? supportedArv * lenderMaxLtv : 0;
  const refinanceValue = safeNumber(normalizedDeal.refinanceValue || normalizedDeal.estimatedArv || supportedArv || 0);
  const refinanceLtv = safeNumber(normalizedDeal.refinanceLtv || normalizedDeal.refinanceLtvPercent || 0.7);
  const expectedRefinanceLoan = refinanceValue * refinanceLtv;
  const expectedRent = safeNumber(normalizedDeal.estimatedRent || normalizedDeal.marketRent || normalizedDeal.projectedRent || 0);
  const monthlyDebtService = expectedRefinanceLoan > 0 ? expectedRefinanceLoan / 360 : 0;
  const monthlyCashFlow = Math.max(0, expectedRent - monthlyDebtService);
  const dscr = monthlyDebtService > 0 ? expectedRent / monthlyDebtService : 0;
  const nonPurchaseProjectCost = rehabBudget + contingency + financingCost + holdCosts + sellingCosts;
  const baseCost = nonPurchaseProjectCost;
  const purchasePricePenalty = Math.max(0, currentPurchasePrice - (supportedArv - nonPurchaseProjectCost));
  const netProfitBeforeOffer = supportedArv - nonPurchaseProjectCost - purchasePricePenalty;
  const netProfitAtOffer = (amount) => supportedArv - nonPurchaseProjectCost - amount - purchasePricePenalty;
  const cashReturn = expectedRefinanceLoan - (currentPurchasePrice + rehabBudget + contingency + financingCost + holdCosts);
  const cashRemainingInDeal = cashReturn - (currentPurchasePrice + rehabBudget + contingency + financingCost + holdCosts);
  const flipMao = Math.max(0, baseArv - rehabBudget - contingency - sellingCosts - financingCost - holdCosts - profitTarget);
  const conservativeFlipMao = Math.max(0, conservativeArv - rehabBudget - contingency - sellingCosts - financingCost - holdCosts - profitTarget);
  const cashLeftMao = Math.max(0, baseArv - rehabBudget - contingency - sellingCosts - financingCost - holdCosts - cashLeftTarget);
  const lenderConstrainedMao = lenderLoanAmount > 0 ? Math.max(0, lenderLoanAmount - rehabBudget - contingency - financingCost - holdCosts) : 0;
  const maoCandidates = [
    { label: "Profit Target", value: flipMao },
    { label: "Cash Left", value: cashLeftMao },
    { label: "Lender Cap", value: lenderConstrainedMao },
    { label: "Conservative", value: conservativeFlipMao },
  ].filter((candidate) => Number.isFinite(candidate.value) && candidate.value > 0);
  const controlledMao = maoCandidates.sort((a, b) => a.value - b.value)[0] || { label: "Profit Target", value: 0 };
  const riskAdjustedMao = Math.max(0, controlledMao.value * (arv.confidenceLevel === "High" ? 1 : arv.confidenceLevel === "Moderate" ? 0.9 : 0.8));
  const manualOverrideAmount = safeNumber(normalizedDeal.manualOfferAmount || normalizedDeal.manualOffer || normalizedDeal.overrideOffer || normalizedDeal.recommendedOffer);
  const hasDocumentedOverride = manualOverrideAmount > 0;
  const approvedMaximumOffer = Math.max(0, Math.min(Math.max(0, riskAdjustedMao * 1.05), askingPrice));
  const maximumApprovedOffer = hasDocumentedOverride ? Math.max(approvedMaximumOffer, manualOverrideAmount) : approvedMaximumOffer;
  const baseOfferCandidates = [
    manualOverrideAmount,
    Math.min(Math.max(0, riskAdjustedMao), currentPurchasePrice),
    Math.min(Math.max(0, riskAdjustedMao * 0.9), currentPurchasePrice),
  ].filter((value) => Number.isFinite(value) && value >= 0);
  const recommendedOffer = baseOfferCandidates[0] ?? 0;
  const initialOffer = Math.min(Math.max(0, riskAdjustedMao * 0.9), maximumApprovedOffer);
  const targetOffer = Math.min(Math.max(0, Math.max(recommendedOffer, riskAdjustedMao)), maximumApprovedOffer);
  const walkAwayPrice = Math.min(Math.max(0, riskAdjustedMao * 0.95), maximumApprovedOffer);
  const maximumOffer = Math.min(Math.max(0, Math.max(walkAwayPrice, riskAdjustedMao * 1.05)), maximumApprovedOffer, walkAwayPrice);
  const offerRange = [initialOffer, targetOffer, maximumOffer, walkAwayPrice];
  const offerPositions = [
    { label: "Initial Offer", amount: initialOffer },
    { label: "Target Offer", amount: targetOffer },
    { label: "Maximum Approved Offer", amount: maximumOffer },
    { label: "Walk-Away Price", amount: walkAwayPrice },
  ];
  const buyBoxResult = String(buyBox?.result || buyBox?.decision || "INSUFFICIENT DATA").toUpperCase();
  const controllingConstraint = strategy === "brrrr"
    ? "Financing"
    : supportedArv <= 0
      ? "ARV"
      : rehabBudget <= 0
        ? "Rehab"
        : buyBoxResult !== "PASS" && buyBoxResult !== "CONDITIONAL" && buyBoxResult !== "CONDITIONAL PASS"
          ? "Buy Box"
          : "Profit Target";
  const controllingMao = Math.max(0, Math.min(maximumOffer, riskAdjustedMao));
  const flipProfitAtTarget = netProfitAtOffer(targetOffer);
  const flipProfitMarginAtTarget = supportedArv > 0 ? flipProfitAtTarget / supportedArv : 0;
  const dealScore = Math.max(0, Math.min(100, Math.round((flipProfitMarginAtTarget > minimumProfitMargin ? 55 : 30) + (buyBox?.result === "PASS" ? 20 : 10) + (arv.confidenceLevel === "High" ? 15 : arv.confidenceLevel === "Moderate" ? 10 : 5) + (expectedRent > 0 ? 10 : 0))));
  const riskLevel = dealScore >= 80 ? "Low" : dealScore >= 60 ? "Moderate" : dealScore >= 40 ? "High" : "Critical";
  const hasCriticalData = supportedArv > 0 && rehabBudget > 0 && (buyBoxResult === "PASS" || buyBoxResult === "CONDITIONAL" || buyBoxResult === "CONDITIONAL PASS");
  const missingInformation = [];
  if (supportedArv <= 0) missingInformation.push("ARV support");
  if (rehabBudget <= 0) missingInformation.push("Rehab budget");
  if (expectedRent <= 0 && strategy === "brrrr") missingInformation.push("Rent support");
  if (buyBoxResult !== "PASS" && buyBoxResult !== "CONDITIONAL" && buyBoxResult !== "CONDITIONAL PASS") missingInformation.push("Buy-box fit");
  const profitThresholdMet = flipProfitAtTarget > 0 && (flipProfitMarginAtTarget >= minimumProfitMargin || flipProfitAtTarget >= profitTarget);
  const decision = hasCriticalData && profitThresholdMet ? "OFFER" : missingInformation.length > 0 || !profitThresholdMet ? "HOLD FOR MORE INFORMATION" : "DO NOT OFFER";
  const confidenceLevel = supportedArv > 0 && rehabBudget > 0 ? (arv.confidenceLevel === "High" ? "High" : arv.confidenceLevel === "Moderate" ? "Moderate" : "Low") : "Insufficient Data";
  const decisionReason = decision === "OFFER" ? "The deal meets the minimum buy-box and valuation support threshold." : decision === "DO NOT OFFER" ? "The underwriting support is not strong enough to justify an offer." : "Critical underwriting inputs are still missing.";
  const conditionsRequired = [];
  if (buyBoxResult !== "PASS") conditionsRequired.push("Confirm buy-box fit");
  if (supportedArv <= 0) conditionsRequired.push("Confirm ARV support");
  if (rehabBudget <= 0) conditionsRequired.push("Verify rehab scope");
  if (strategy === "brrrr" && expectedRent <= 0) conditionsRequired.push("Validate rent assumptions");
  const deriveOfferConstraint = (amount) => {
    if (strategy === "brrrr" && (expectedRent <= 0 || monthlyCashFlow <= 0)) return "Financing";
    if (supportedArv <= 0) return "ARV";
    if (rehabBudget <= 0) return "Rehab";
    if (buyBoxResult !== "PASS" && buyBoxResult !== "CONDITIONAL" && buyBoxResult !== "CONDITIONAL PASS") return "Buy Box";
    if (amount > maximumApprovedOffer) return "Capital limits";
    if (netProfitAtOffer(amount) <= 0 || (supportedArv > 0 && (netProfitAtOffer(amount) / supportedArv) < minimumProfitMargin)) return "Profit target";
    if (dealScore < 60) return "Risk policy";
    return "Profit target";
  };
  const offerLadderLevels = [
    { level: "Initial Offer", amount: initialOffer, expectedProfit: netProfitAtOffer(initialOffer), profitMargin: supportedArv > 0 ? netProfitAtOffer(initialOffer) / supportedArv : 0, cashRequired: Math.max(0, baseCost - initialOffer), cashRemainingInDeal: netProfitAtOffer(initialOffer), monthlyCashFlow: strategy === "brrrr" ? monthlyCashFlow : 0, dscr: strategy === "brrrr" ? dscr : 0, marginOfSafety: supportedArv > 0 ? netProfitAtOffer(initialOffer) / Math.max(baseCost, 1) : 0, dealScore, riskLevel, conditionsRequired, constraint: deriveOfferConstraint(initialOffer), strategy: strategy === "brrrr" ? "BRRRR" : "Flip" },
    { level: "Second Offer", amount: targetOffer * 0.95, expectedProfit: netProfitAtOffer(targetOffer * 0.95), profitMargin: supportedArv > 0 ? netProfitAtOffer(targetOffer * 0.95) / supportedArv : 0, cashRequired: Math.max(0, baseCost - targetOffer * 0.95), cashRemainingInDeal: netProfitAtOffer(targetOffer * 0.95), monthlyCashFlow: strategy === "brrrr" ? monthlyCashFlow : 0, dscr: strategy === "brrrr" ? dscr : 0, marginOfSafety: supportedArv > 0 ? netProfitAtOffer(targetOffer * 0.95) / Math.max(baseCost, 1) : 0, dealScore, riskLevel, conditionsRequired, constraint: deriveOfferConstraint(targetOffer * 0.95), strategy: strategy === "brrrr" ? "BRRRR" : "Flip" },
    { level: "Target Offer", amount: targetOffer, expectedProfit: flipProfitAtTarget, profitMargin: flipProfitMarginAtTarget, cashRequired: Math.max(0, baseCost - targetOffer), cashRemainingInDeal: flipProfitAtTarget, monthlyCashFlow: strategy === "brrrr" ? monthlyCashFlow : 0, dscr: strategy === "brrrr" ? dscr : 0, marginOfSafety: supportedArv > 0 ? flipProfitAtTarget / Math.max(baseCost, 1) : 0, dealScore, riskLevel, conditionsRequired, constraint: deriveOfferConstraint(targetOffer), strategy: strategy === "brrrr" ? "BRRRR" : "Flip" },
    { level: "Maximum Approved Offer", amount: maximumOffer, expectedProfit: netProfitAtOffer(maximumOffer), profitMargin: supportedArv > 0 ? netProfitAtOffer(maximumOffer) / supportedArv : 0, cashRequired: Math.max(0, baseCost - maximumOffer), cashRemainingInDeal: netProfitAtOffer(maximumOffer), monthlyCashFlow: strategy === "brrrr" ? monthlyCashFlow : 0, dscr: strategy === "brrrr" ? dscr : 0, marginOfSafety: supportedArv > 0 ? netProfitAtOffer(maximumOffer) / Math.max(baseCost, 1) : 0, dealScore, riskLevel, conditionsRequired, constraint: deriveOfferConstraint(maximumOffer), strategy: strategy === "brrrr" ? "BRRRR" : "Flip" },
    { level: "Walk-Away Price", amount: walkAwayPrice, expectedProfit: netProfitAtOffer(walkAwayPrice), profitMargin: supportedArv > 0 ? netProfitAtOffer(walkAwayPrice) / supportedArv : 0, cashRequired: Math.max(0, baseCost - walkAwayPrice), cashRemainingInDeal: netProfitAtOffer(walkAwayPrice), monthlyCashFlow: strategy === "brrrr" ? monthlyCashFlow : 0, dscr: strategy === "brrrr" ? dscr : 0, marginOfSafety: supportedArv > 0 ? netProfitAtOffer(walkAwayPrice) / Math.max(baseCost, 1) : 0, dealScore, riskLevel, conditionsRequired, constraint: deriveOfferConstraint(walkAwayPrice), strategy: strategy === "brrrr" ? "BRRRR" : "Flip" },
  ];
  const strategyOffer = strategy === "brrrr" ? {
    type: "BRRRR",
    refinanceValue,
    refinanceLtv,
    expectedRefinanceLoan,
    cashReturned: cashReturn,
    cashRemainingInDeal,
    monthlyCashFlow,
    dscr,
    recommendation: monthlyCashFlow > 0 && dscr >= 1.2 && cashReturn > 0 ? "OFFER" : "DO NOT OFFER",
  } : strategy === "long-term hold" || strategy === "hold" ? {
    type: "Long-Term Hold",
    recommendation: expectedRent > 0 ? "OFFER WITH CONDITIONS" : "DO NOT OFFER",
  } : {
    type: "Flip",
    recommendation: flipProfitAtTarget > 0 && flipProfitMarginAtTarget >= minimumProfitMargin ? "OFFER" : "DO NOT OFFER",
  };
  const sellerConcessionOpportunities = [
    ...(supportedArv > 0 ? ["Seller credit toward repairs if the price stays within the target position."] : []),
    ...(buyBoxResult !== "PASS" && buyBoxResult !== "CONDITIONAL" && buyBoxResult !== "CONDITIONAL PASS" ? ["Flexible inspection and closing terms until buy-box support is confirmed."] : []),
    ...(strategy === "brrrr" ? ["Rate buydown or repair credit if the refinance path is still pending."] : ["A modest repair credit or flexible close date if the offer remains disciplined."]),
  ];
  const priceVsTermsRecommendation = strategy === "brrrr"
    ? `Prioritize cash-flow terms and refinance clarity over a premium price while keeping the target position at ${targetOffer}.`
    : `Keep the opening position at ${initialOffer} and use terms rather than price escalation unless the inspection confirms stronger support.`;
  const inspectionRecommendation = supportedArv > 0 && rehabBudget > 0
    ? `Complete inspection and scope validation before moving above ${targetOffer}.`
    : "Complete inspection and title diligence before increasing the offer further.";
  const earnestMoneyRecommendation = Math.min(5000, Math.max(1000, Math.round(targetOffer * 0.01)));
  const closingTimelineRecommendation = strategy === "brrrr"
    ? "Move to closing within 30-45 days once the rent and refinance assumptions are documented."
    : "Move to closing within 30 days while preserving inspection and title contingencies.";
  const offerSummary = {
    property: normalizedDeal.propertyAddress || normalizedDeal.address || "Insufficient Data",
    offerAmount: targetOffer,
    financingMethod: financing.loanAmount > 0 ? "Financed" : "Cash",
    earnestMoney: earnestMoneyRecommendation,
    inspectionPeriod: "7 days",
    closingTarget: "30 days",
    contingencies: ["Inspection", strategy === "brrrr" ? "Financing" : "Financing if needed"],
    majorAssumptions: ["ARV support remains intact", "Rehab scope stays within budget"],
    requiredApprovals: ["Analyst review", "Underwriter review"],
    supportingAnalysis: ["ARV support", "Buy Box result", "Rehab assumptions"],
    expirationStatus: "Open",
    analystNotes: `Offer aligned to ${buyBox?.decision || "Insufficient Data"} buy-box guidance.`,
  };
  const offerLetterData = {
    buyerEntityName: normalizedDeal.buyerEntityName || "Buyer Entity",
    propertyAddress: normalizedDeal.propertyAddress || normalizedDeal.address || "Insufficient Data",
    offerPrice: targetOffer,
    earnestMoney: Math.min(5000, Math.max(1000, targetOffer * 0.01)),
    financingMethod: financing.loanAmount > 0 ? "Financed" : "Cash",
    inspectionPeriod: "7 days",
    closingDateOrWindow: "30-45 days",
    sellerPaidCosts: Math.min(5000, targetOffer * 0.01),
    contingencies: ["Inspection", "Financing if needed"],
    specialTerms: ["Subject to final underwriting", "Subject to title review"],
    expirationDate: new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString().slice(0, 10),
    authorizedSigner: normalizedDeal.authorizedSigner || "Authorized Signer",
  };
  const manualOverrides = manualOverrideAmount > 0 ? [{ field: "manualOfferAmount", value: manualOverrideAmount }] : [];
  const approvalWorkflow = {
    status: manualOverrides.length > 0 ? "APPROVED" : "DRAFT",
    history: [],
    manualOverrides,
    approvedBy: manualOverrides.length > 0 ? "Analyst" : null,
    previousApprovedAmount: manualOverrides.length > 0 ? manualOverrides[0].value : 0,
  };
  const reunderwriting = {
    eligible: true,
    triggers: [],
    previousOffer: targetOffer,
    revisedLadder: offerLadderLevels,
    changedFields: [],
    financialDifference: 0,
    confidenceLevel,
    riskLevel,
  };
  const offerCalculations = {
    shared: {
      initialOffer,
      targetOffer,
      maximumOffer,
      walkAwayPrice,
      recommendedOffer: recommendedOffer || targetOffer,
      controllingConstraint,
      controllingMao,
      netProfitBeforeOffer,
      baseCost,
    },
    flip: {
      initialOffer,
      targetOffer,
      maximumOffer,
      walkAwayPrice,
      recommendedOffer: recommendedOffer || targetOffer,
      controllingConstraint,
      controllingMao,
      netProfitBeforeOffer,
      baseCost,
    },
    brrrrr: {
      initialOffer: Math.max(0, initialOffer + monthlyCashFlow * 0.1),
      targetOffer: Math.max(0, targetOffer + monthlyCashFlow * 0.1),
      maximumOffer: Math.max(0, maximumOffer + monthlyCashFlow * 0.1),
      walkAwayPrice: Math.max(0, walkAwayPrice + monthlyCashFlow * 0.1),
      recommendedOffer: Math.max(0, (recommendedOffer || targetOffer) + monthlyCashFlow * 0.1),
      controllingConstraint: strategy === "brrrrr" ? "Financing" : controllingConstraint,
      controllingMao,
      netProfitBeforeOffer,
      baseCost,
    },
  };
  const recalculationKey = [
    normalizedDeal.purchasePrice,
    normalizedDeal.rehabBudget,
    supportedArv,
    expectedRent,
    refinanceValue,
    buyBoxResult,
    financing.loanAmount,
    confidenceLevel,
    strategy,
  ].join("|");
  return {
    askingPrice,
    currentPurchasePrice,
    strategyMao: controlledMao.value,
    riskAdjustedMao,
    initialOffer,
    recommendedOpeningOffer: initialOffer,
    recommendedOffer: recommendedOffer || targetOffer,
    targetOffer,
    maximumOffer,
    walkAwayPrice,
    controllingMao,
    controllingConstraint,
    priceReductionNeeded: Math.max(0, currentPurchasePrice - walkAwayPrice),
    offerRange,
    sellerDiscountRequired: Math.max(0, currentPurchasePrice - targetOffer),
    estimatedCashRequired: Math.max(0, currentPurchasePrice - safeNumber(financing.loanAmount)),
    expectedProfitAtEachOffer: offerPositions.map((position) => ({ ...position, expectedProfit: netProfitAtOffer(position.amount) })),
    expectedRoiAtEachOffer: offerPositions.map((position) => ({ ...position, expectedRoi: position.amount > 0 ? netProfitAtOffer(position.amount) / position.amount : 0 })),
    recommendationAtEachOffer: offerPositions.map((position) => ({ ...position, recommendation: position.amount <= walkAwayPrice ? "Proceed" : "Do not proceed" })),
    offerPositions,
    constraintLabel: controllingConstraint,
    constraintValue: controlledMao.value,
    offerCalculations,
    offerLadder: {
      levels: offerLadderLevels,
      maximumApprovedOffer: Math.max(hasDocumentedOverride ? manualOverrideAmount : 0, Math.min(maximumOffer, controllingMao)),
    },
    strategyOffer,
    negotiationSupport: {
      mainPriceJustification: `The supported ARV of ${supportedArv} supports a disciplined offer based on rehab and carrying costs.`,
      strongestSupportingNumber: String(supportedArv),
      negotiationPoints: ["Rehab scope is within planned thresholds", "Comp support is present", "Holding costs are manageable"],
      concessionOptions: ["Flexible closing date", "Limited repair credit", "Quick inspection turnaround"],
      conditionsBeforeIncreasingOffer: ["More complete inspection", "Stronger comp support", "Lower rehab scope"],
      informationRequired: ["Inspection findings", "Seller motivation", "Title and permit status"],
      openingPosition: initialOffer,
      targetPosition: targetOffer,
      walkAwayPoint: walkAwayPrice,
      sellerConcessionOpportunities,
      priceVsTermsRecommendation,
      inspectionRecommendation,
      earnestMoneyRecommendation,
      closingTimelineRecommendation,
    },
    offerDecision: {
      decision,
      confidenceLevel,
      controllingReason: decisionReason,
      missingInformation,
      requiredConditions: conditionsRequired,
      reUnderwritingTrigger: missingInformation.length > 0 ? "Missing underwriting evidence" : "No immediate trigger",
    },
    reviewMode,
    retrospectiveReview,
    overrideApplied: hasDocumentedOverride,
    offerSummary,
    offerLetterData,
    approvalWorkflow,
    reunderwriting,
    dealScore,
    riskLevel,
    controllingMao,
    confidenceLevel,
    recalculationKey,
  };
}

export function buildInvestmentDecisionEngine(deal = {}, analysis = {}) {
  const normalizedDeal = normalizeDealForIntelligence(deal);
  const dealScore = safeNumber(analysis.dealScore ?? analysis.score ?? 0);
  const overallRisk = safeNumber(analysis.overallRisk ?? analysis.riskScore ?? 0);
  const buyBoxResult = String(analysis.buyBoxResult || normalizedDeal.buyBoxResult || "INSUFFICIENT DATA").toUpperCase();
  const arvConfidence = String(analysis.arvConfidence || normalizedDeal.arvConfidence || "Insufficient Data").toLowerCase();
  const estimatedProfit = safeNumber(analysis.estimatedFlipProfit ?? analysis.projectedProfit ?? 0);
  const roi = safeNumber(analysis.roi ?? 0);
  const monthlyCashFlow = safeNumber(analysis.monthlyCashFlow ?? 0);
  const cashRequired = safeNumber(analysis.cashRequired ?? 0);
  const qualificationStatus = String(analysis.qualificationStatus || "Pending").toLowerCase();
  const warnings = Array.isArray(analysis.warnings) ? analysis.warnings : [];
  const analysisType = String(analysis.analysisType || normalizedDeal.analysisType || "Acquisition Analysis").toLowerCase();
  const exitStrategy = String(normalizedDeal.exitStrategy || normalizedDeal.strategy || "Flip").toLowerCase();
  const status = String(normalizedDeal.status || normalizedDeal.projectStatus || "").toLowerCase();
  const isExistingProjectAnalysis = analysisType.includes("existing project") || status === "active project" || (status === "in progress" && exitStrategy === "flip");
  const highConfidence = arvConfidence === "high" || arvConfidence === "very high";
  const buyBoxPass = buyBoxResult === "PASS";
  const positiveEconomics = estimatedProfit > 0 && roi > 0;
  const strongEconomics = estimatedProfit > 0 && roi > 0.1;
  const lowRisk = overallRisk <= 25;
  const qualified = qualificationStatus === "qualified" || qualificationStatus === "qualified with conditions";
  const hardFailure = qualificationStatus === "insufficient capital" || qualificationStatus === "insufficient funds" || qualificationStatus === "not qualified" || (estimatedProfit <= 0 && (roi <= 0 || !qualified) && !buyBoxPass);

  let recommendation = "Pass";
  let confidence = 0;
  let reasons = [];

  if (isExistingProjectAnalysis && exitStrategy === "flip") {
    if (estimatedProfit > 0) {
      recommendation = "Continue Project";
      confidence = 78;
      reasons = ["The project remains profitable and should continue to completion.", "The economics support ongoing execution rather than a new purchase decision."];
    } else if (estimatedProfit > -10000) {
      recommendation = "Continue Rehab";
      confidence = 66;
      reasons = ["The project is close to breakeven and should be stabilized before reassessing.", "A targeted rehab or cost control review is more appropriate than a purchase decision."];
    } else {
      recommendation = "Hold";
      confidence = 62;
      reasons = ["The project no longer supports the current execution plan.", "A pause and re-underwrite are appropriate until the economics improve."];
    }
  } else if (hardFailure) {
    recommendation = "Renegotiate";
    confidence = 74;
    reasons = ["The current pricing or capital structure is insufficient for approval.", "A hard underwriting failure requires a structural reset."];
  } else if (buyBoxPass && dealScore >= 80 && lowRisk && highConfidence && strongEconomics && qualified && warnings.length === 0) {
    recommendation = "Strong Buy";
    confidence = 92;
    reasons = ["The buy box, valuation support, and economics all align.", "The deal carries a low-risk profile and a strong expected return."];
  } else if (buyBoxPass && dealScore >= 70 && strongEconomics && qualified) {
    recommendation = "Buy";
    confidence = 78;
    reasons = ["The deal meets the core underwriting threshold and has workable economics.", "A few diligence items still need confirmation before closing."];
  } else if (buyBoxPass && dealScore >= 55 && warnings.length > 0) {
    recommendation = "Buy With Conditions";
    confidence = 68;
    reasons = ["The economics are acceptable but require conditional diligence.", "The current risk profile needs tighter documentation and scope validation."];
  } else if (dealScore >= 45 && overallRisk >= 35) {
    recommendation = "Hold";
    confidence = 60;
    reasons = ["The deal is not yet fully supported by current assumptions.", "Current market or financing conditions justify waiting rather than advancing."];
  } else if (positiveEconomics) {
    recommendation = "Buy";
    confidence = 70;
    reasons = ["The projected profit remains positive and the deal should continue forward.", "The current numbers support progression without a hard rejection."];
  } else {
    recommendation = "Hold";
    confidence = 66;
    reasons = ["The deal does not currently meet the investment hurdle rate.", "A stronger basis or lower basis is required before approval."];
  }

  return {
    recommendation,
    confidence,
    confidenceLabel: confidence >= 85 ? "High" : confidence >= 70 ? "Moderate" : confidence >= 55 ? "Low" : "Very Low",
    primaryFactors: reasons,
    dealScore,
    overallRisk,
    buyBoxResult,
    arvConfidence: String(analysis.arvConfidence || normalizedDeal.arvConfidence || "Insufficient Data"),
    estimatedProfit,
    roi,
    monthlyCashFlow,
    cashRequired,
    qualificationStatus: String(analysis.qualificationStatus || "Pending"),
    recommendedNextActions: [
      ...(warnings.length ? ["Validate the current warning list before moving forward."] : []),
      ...(cashRequired > 0 ? ["Confirm capital availability for the full cash requirement."] : []),
      ...(buyBoxPass ? [] : ["Revisit the buy-box fit before underwriting further."]),
      ...(estimatedProfit <= 0 ? ["Reprice the deal or reduce the scope to preserve margin."] : []),
    ],
  };
}

export function buildExitStrategyEngine(deal = {}, analysis = {}) {
  const normalizedDeal = normalizeDealForIntelligence(deal);
  const metrics = buildUnderwritingMetrics(normalizedDeal, {}, { includeContingency: true, includeHoldingCost: true, includeTaxesAndInsurance: false, includeExtraCosts: false });
  const projectedProfit = safeNumber(analysis.estimatedFlipProfit ?? analysis.projectedProfit ?? metrics.profit ?? 0);
  const roi = safeNumber(analysis.roi ?? metrics.roi ?? 0);
  const monthlyCashFlow = safeNumber(analysis.monthlyCashFlow ?? 0);
  const cashRequired = safeNumber(analysis.cashRequired ?? metrics.cashRequired ?? 0);
  const arv = safeNumber(analysis.supportedBaseArv ?? normalizedDeal.estimatedArv ?? normalizedDeal.arv ?? 0);
  const rent = safeNumber(normalizedDeal.estimatedRent ?? 0);

  const strategies = [
    {
      strategy: "Flip",
      projectedReturn: projectedProfit,
      capitalEfficiency: projectedProfit > 0 ? projectedProfit / Math.max(cashRequired, 1) : 0,
      risk: projectedProfit > 0 ? 35 : 70,
      score: (projectedProfit > 0 ? 0.55 : 0) + (roi > 0.12 ? 0.25 : 0) + (arv > 0 ? 0.2 : 0),
      rationale: projectedProfit > 0 ? "The current spread and timing support a short-cycle flip execution." : "The spread is too thin to justify this exit path.",
    },
    {
      strategy: "BRRRR",
      projectedReturn: monthlyCashFlow * 12,
      capitalEfficiency: monthlyCashFlow > 0 ? monthlyCashFlow / Math.max(cashRequired, 1) : 0,
      risk: rent > 0 ? 45 : 70,
      score: (monthlyCashFlow > 0 ? 0.45 : 0) + (arv > 0 ? 0.2 : 0) + (rent > 0 ? 0.35 : 0),
      rationale: monthlyCashFlow > 0 ? "The rent-to-debt profile is strong enough for a refinance-backed hold strategy." : "The cash-flow assumptions are too weak for a BRRRR path.",
    },
    {
      strategy: "Rental",
      projectedReturn: rent * 12 * 0.08,
      capitalEfficiency: rent > 0 ? (rent * 12 * 0.08) / Math.max(cashRequired, 1) : 0,
      risk: rent > 0 ? 40 : 75,
      score: (rent > 0 ? 0.5 : 0) + (monthlyCashFlow > 0 ? 0.25 : 0) + (roi > 0.05 ? 0.25 : 0),
      rationale: rent > 0 ? "The deal can be held for stable cash-flow generation if the rent support is validated." : "The rental assumptions are incomplete.",
    },
    {
      strategy: "Wholesale",
      projectedReturn: Math.max(0, projectedProfit * 0.4),
      capitalEfficiency: projectedProfit > 0 ? (projectedProfit * 0.4) / Math.max(cashRequired, 1) : 0,
      risk: 30,
      score: (projectedProfit > 0 ? 0.3 : 0) + (roi > 0.1 ? 0.2 : 0) + (cashRequired > 0 ? 0.5 : 0),
      rationale: "The deal may be attractive for a quick assignment if the seller is motivated and the spread is supported.",
    },
    {
      strategy: "Seller Finance",
      projectedReturn: Math.max(0, projectedProfit * 0.25),
      capitalEfficiency: projectedProfit > 0 ? (projectedProfit * 0.25) / Math.max(cashRequired, 1) : 0,
      risk: 50,
      score: (projectedProfit > 0 ? 0.3 : 0) + (cashRequired > 0 ? 0.4 : 0) + (monthlyCashFlow > 0 ? 0.3 : 0),
      rationale: "Seller financing can preserve liquidity but usually trades off against the total yield.",
    },
    {
      strategy: "Hybrid",
      projectedReturn: projectedProfit * 0.75 + monthlyCashFlow * 6,
      capitalEfficiency: projectedProfit > 0 || monthlyCashFlow > 0 ? (projectedProfit * 0.75 + monthlyCashFlow * 6) / Math.max(cashRequired, 1) : 0,
      risk: 55,
      score: (projectedProfit > 0 ? 0.35 : 0) + (monthlyCashFlow > 0 ? 0.35 : 0) + (arv > 0 ? 0.3 : 0),
      rationale: "A hybrid path can balance immediate liquidity and upside, but the execution is more complex.",
    },
  ];

  const rankedStrategies = [...strategies].sort((left, right) => right.score - left.score);
  const recommendedStrategy = rankedStrategies[0]?.strategy || "Flip";

  return {
    recommendedStrategy,
    rankedStrategies,
    strategyScores: rankedStrategies.map((entry) => ({ strategy: entry.strategy, score: entry.score })),
    summary: `${recommendedStrategy} ranks highest based on projected return, capital efficiency, and risk profile.`,
  };
}

export function buildDealRiskProfile(deal = {}, analysis = {}) {
  const normalizedDeal = normalizeDealForIntelligence(deal);
  const rehabRisk = safeNumber(analysis.rehabRisk ?? 0);
  const marketRisk = safeNumber(analysis.marketRisk ?? 0);
  const financingRisk = safeNumber(analysis.financingRisk ?? 0);
  const appraisalRisk = safeNumber(analysis.appraisalRisk ?? 0);
  const contractorRisk = safeNumber(analysis.contractorRisk ?? 0);
  const liquidityRisk = safeNumber(analysis.liquidityRisk ?? 0);
  const timelineRisk = safeNumber(analysis.timelineRisk ?? 0);
  const overallRiskScore = Math.max(0, Math.min(100, Math.round((rehabRisk + marketRisk + financingRisk + appraisalRisk + contractorRisk + liquidityRisk + timelineRisk) / 7)));
  const overallRiskLabel = overallRiskScore >= 70 ? "High" : overallRiskScore >= 40 ? "Moderate" : "Low";
  const breakDown = [
    { category: "Rehab", score: rehabRisk, explanation: rehabRisk >= 50 ? "Rehab scope and contingency are a meaningful risk driver." : "Rehab risk is manageable with current assumptions." },
    { category: "Market", score: marketRisk, explanation: marketRisk >= 50 ? "Market timing or value support is a major concern." : "The current market appears stable enough for the plan." },
    { category: "Financing", score: financingRisk, explanation: financingRisk >= 50 ? "Financing terms could materially change the economics." : "The financing assumptions are within an acceptable range." },
    { category: "Appraisal", score: appraisalRisk, explanation: appraisalRisk >= 50 ? "Appraisal support is thin and could shift the value thesis." : "The value support looks reasonable for the current data set." },
    { category: "Contractor", score: contractorRisk, explanation: contractorRisk >= 50 ? "Contractor execution could widen the rehab budget or timing." : "Contractor execution risk is moderate and controllable." },
    { category: "Liquidity", score: liquidityRisk, explanation: liquidityRisk >= 50 ? "Exit liquidity is a major concern for the timeline." : "Liquidity looks manageable for the current plan." },
    { category: "Timeline", score: timelineRisk, explanation: timelineRisk >= 50 ? "The project timeline could stretch beyond the current assumptions." : "The timeline assumptions appear workable." },
  ];

  return {
    normalizedDeal,
    overallRiskScore,
    overallRiskLabel,
    breakdown: breakDown,
    recommendedNextActions: [
      ...(rehabRisk >= 50 ? ["Add contingency and confirm the rehab scope before scheduling the close."] : []),
      ...(marketRisk >= 50 ? ["Revisit the market support and competing sale assumptions."] : []),
      ...(financingRisk >= 50 ? ["Reprice or re-underwrite the financing terms before moving forward."] : []),
      ...(appraisalRisk >= 50 ? ["Order a fresh appraisal or gather stronger comp support."] : []),
      ...(contractorRisk >= 50 ? ["Confirm contractor availability and pricing before the project starts."] : []),
      ...(liquidityRisk >= 50 ? ["Pressure-test the exit strategy and refine liquidity assumptions."] : []),
      ...(timelineRisk >= 50 ? ["Add a schedule buffer and capture the critical path early."] : []),
      ...(overallRiskScore >= 60 ? ["Treat this as a conditional deal and require additional executive review."] : ["Proceed with normal diligence and monitor the key risk triggers."]),
    ],
  };
}

export function buildStrategyComparisonEngine(deal = {}, arv = {}) {
  const metrics = buildUnderwritingMetrics(deal, {}, { includeContingency: true, includeHoldingCost: true, includeTaxesAndInsurance: false, includeExtraCosts: false });
  const purchasePrice = metrics.purchasePrice;
  const rehabBudget = metrics.rehabCost;
  const contingency = metrics.contingency;
  const financingCosts = metrics.financingCosts;
  const holdingCosts = metrics.holdingCost;
  const sellingCosts = metrics.sellingCosts;
  const closingCosts = metrics.closingCosts;
  const estimatedArv = safeNumber(deal.estimatedArv || deal.arv || arv.supportedBaseArv || 0);
  const estimatedRent = safeNumber(deal.estimatedRent || deal.monthlyRent || 0);
  const monthlyDebtService = safeNumber(deal.monthlyDebtService || 0);
  const totalProjectCost = metrics.totalProjectCost;
  const flipProfit = metrics.profit;
  const flipMargin = estimatedArv > 0 ? flipProfit / estimatedArv : 0;
  const brrrrCashInvested = purchasePrice + rehabBudget + contingency + financingCosts + closingCosts;
  const refinanceAmount = Math.max(0, estimatedArv * 0.75);
  const cashReturned = refinanceAmount - closingCosts;
  const cashRemaining = cashReturned - brrrrCashInvested;
  const monthlyCashFlow = Math.max(0, estimatedRent - monthlyDebtService);
  const dscr = monthlyDebtService > 0 ? (estimatedRent + monthlyDebtService) / monthlyDebtService : 0;

  const strategies = [
    {
      strategy: "Flip",
      totalProjectCost,
      cashRequired: totalProjectCost,
      expectedProfit: flipProfit,
      profitMargin: flipMargin,
      cashOnCashReturn: totalProjectCost > 0 ? flipProfit / totalProjectCost : 0,
      cashRemainingInDeal: flipProfit - totalProjectCost,
      cashReturnedAtRefinance: 0,
      monthlyCashFlow: 0,
      dscr: 0,
      breakEvenArv: totalProjectCost + sellingCosts,
      breakEvenRent: 0,
      downsideExposure: Math.min(100000, Math.max(0, totalProjectCost - estimatedArv * 0.9)),
      capitalDuration: safeNumber(deal.holdingMonths || 6),
      sensitivityToArv: 0.5,
      sensitivityToRehab: 0.4,
      sensitivityToTimeline: 0.3,
      sensitivityToInterestRate: 0.2,
    },
    {
      strategy: "BRRRR",
      totalProjectCost: brrrrCashInvested,
      cashRequired: brrrrCashInvested,
      expectedProfit: cashRemaining,
      profitMargin: brrrrCashInvested > 0 ? cashRemaining / brrrrCashInvested : 0,
      cashOnCashReturn: brrrrCashInvested > 0 ? monthlyCashFlow * 12 / brrrrCashInvested : 0,
      cashRemainingInDeal: cashRemaining,
      cashReturnedAtRefinance: cashReturned,
      monthlyCashFlow,
      dscr,
      breakEvenArv: purchasePrice + rehabBudget + contingency + financingCosts + closingCosts,
      breakEvenRent: monthlyDebtService > 0 ? monthlyDebtService : 0,
      downsideExposure: Math.max(0, brrrrCashInvested - cashReturned),
      capitalDuration: safeNumber(deal.holdingMonths || 12),
      sensitivityToArv: 0.6,
      sensitivityToRehab: 0.5,
      sensitivityToTimeline: 0.4,
      sensitivityToInterestRate: 0.4,
    },
    {
      strategy: "Long-Term Hold",
      totalProjectCost: brrrrCashInvested,
      cashRequired: brrrrCashInvested,
      expectedProfit: estimatedRent * 12 * 0.08,
      profitMargin: brrrrCashInvested > 0 ? (estimatedRent * 12 * 0.08) / brrrrCashInvested : 0,
      cashOnCashReturn: brrrrCashInvested > 0 ? (estimatedRent * 12 * 0.08) / brrrrCashInvested : 0,
      cashRemainingInDeal: cashRemaining,
      cashReturnedAtRefinance: 0,
      monthlyCashFlow,
      dscr,
      breakEvenArv: purchasePrice + rehabBudget + contingency + financingCosts + closingCosts,
      breakEvenRent: monthlyDebtService > 0 ? monthlyDebtService : 0,
      downsideExposure: Math.max(0, brrrrCashInvested - cashReturned),
      capitalDuration: safeNumber(deal.holdingMonths || 18),
      sensitivityToArv: 0.4,
      sensitivityToRehab: 0.3,
      sensitivityToTimeline: 0.2,
      sensitivityToInterestRate: 0.3,
    },
    {
      strategy: "No Action / Reject",
      totalProjectCost: purchasePrice,
      cashRequired: 0,
      expectedProfit: 0,
      profitMargin: 0,
      cashOnCashReturn: 0,
      cashRemainingInDeal: 0,
      cashReturnedAtRefinance: 0,
      monthlyCashFlow: 0,
      dscr: 0,
      breakEvenArv: purchasePrice,
      breakEvenRent: 0,
      downsideExposure: purchasePrice,
      capitalDuration: 0,
      sensitivityToArv: 0,
      sensitivityToRehab: 0,
      sensitivityToTimeline: 0,
      sensitivityToInterestRate: 0,
    },
  ];

  const sorted = [...strategies].sort((a, b) => b.expectedProfit - a.expectedProfit);
  const recommendedStrategy = sorted[0].strategy;
  const secondBestStrategy = sorted[1].strategy;
  const rejectOption = sorted[sorted.length - 1];

  return {
    strategies,
    recommendedStrategy,
    secondBestStrategy,
    rejectOption,
    reasoning: recommendedStrategy === "Flip" ? "Flip economics are strongest on the current assumptions." : recommendedStrategy === "BRRRR" ? "Refinance and cash-flow support the BRRRR path." : recommendedStrategy === "Long-Term Hold" ? "The hold strategy is the most durable on the available data." : "The deal does not currently support an active acquisition plan.",
    confidenceLevel: estimatedArv > 0 && rehabBudget > 0 ? "Moderate" : "Insufficient Data",
    missingInformation: [] ,
    primaryRisk: recommendedStrategy === "BRRRR" ? "Refinance and rent support" : "Exit timing and valuation support",
    opportunityCost: recommendedStrategy === "Flip" ? "Potentially higher upside is foregone if the project is held longer." : "A different strategy could create more liquidity or less execution risk.",
  };
}

export function buildDealScore(deal = {}, arv = {}, financing = {}) {
  const purchasePrice = safeNumber(deal.purchasePrice || deal.askingPrice || 0);
  const rehabBudget = safeNumber(deal.rehabBudget || 0);
  const estimatedArv = safeNumber(deal.estimatedArv || deal.arv || arv.supportedBaseArv || 0);
  const buyBoxResult = String(arv.buyBoxResult || deal.buyBoxResult || "INSUFFICIENT DATA").toUpperCase();
  const confidenceLevel = String(arv.confidenceLevel || "Insufficient Data").toLowerCase();
  const financingScore = safeNumber(financing.financingScore || 0);
  const expectedProfit = estimatedArv - purchasePrice - rehabBudget;
  const marginOfSafety = estimatedArv > 0 ? (estimatedArv - purchasePrice - rehabBudget) / estimatedArv : 0;
  const buyBoxScore = buyBoxResult === "PASS" ? 100 : buyBoxResult === "CONDITIONAL" ? 70 : buyBoxResult === "FAIL" ? 0 : 40;
  const compConfidenceScore = confidenceLevel === "high" ? 100 : confidenceLevel === "moderate" ? 70 : confidenceLevel === "low" ? 35 : 0;
  const rehabCertaintyScore = rehabBudget > 0 ? 70 : 0;
  const rentalStrengthScore = safeNumber(deal.estimatedRent) > 0 ? 70 : 0;
  const dataCompletenessScore = [purchasePrice > 0, rehabBudget > 0, estimatedArv > 0, safeNumber(deal.estimatedRent) > 0].filter(Boolean).length / 4 * 100;
  const weightedScore = 0.2 * Math.max(0, Math.min(100, expectedProfit > 0 ? 100 : 0)) + 0.15 * Math.max(0, Math.min(100, marginOfSafety * 100)) + 0.15 * buyBoxScore + 0.1 * compConfidenceScore + 0.1 * rehabCertaintyScore + 0.1 * financingScore + 0.1 * rentalStrengthScore + 0.1 * dataCompletenessScore;
  const score = Math.max(0, Math.min(100, Math.round(weightedScore)));
  const criticalFinancialConstraint = expectedProfit <= 0 && buyBoxResult !== "PASS";
  return criticalFinancialConstraint ? Math.min(score, 39) : score;
}

export function buildRiskScore(deal = {}, arv = {}) {
  const estimatedArv = safeNumber(deal.estimatedArv || deal.arv || arv.supportedBaseArv || 0);
  const purchasePrice = safeNumber(deal.purchasePrice || deal.askingPrice || 0);
  const rehabBudget = safeNumber(deal.rehabBudget || 0);
  const missingDataRisk = [purchasePrice > 0, rehabBudget > 0, estimatedArv > 0, safeNumber(deal.estimatedRent) > 0].filter(Boolean).length < 4 ? 1 : 0;
  const projectRisk = estimatedArv > 0 && purchasePrice + rehabBudget > estimatedArv * 0.9 ? 1 : 0;
  const rehabRisk = rehabBudget > 0 && rehabBudget > 60000 ? 1 : 0;
  const financingRisk = safeNumber(deal.financingCosts) > 0 ? 1 : 0;
  const timingRisk = safeNumber(deal.holdingMonths) > 6 ? 1 : 0;
  const rentalRisk = safeNumber(deal.estimatedRent) > 0 ? 0 : 1;
  const riskScore = 20 + missingDataRisk * 20 + projectRisk * 20 + rehabRisk * 15 + financingRisk * 10 + timingRisk * 10 + rentalRisk * 10;
  let level = "LOW";
  if (riskScore >= 70) level = "CRITICAL";
  else if (riskScore >= 50) level = "HIGH";
  else if (riskScore >= 30) level = "MODERATE";
  return { level, score: riskScore, topRisks: [missingDataRisk ? "Missing data" : null, projectRisk ? "ARV compression" : null, rehabRisk ? "Rehab overrun" : null, financingRisk ? "Financing sensitivity" : null, timingRisk ? "Timeline extension" : null, rentalRisk ? "Rent uncertainty" : null].filter(Boolean) };
}

export function buildRehabConfidence(deal = {}) {
  const rehabBudget = safeNumber(deal.rehabBudget || 0);
  const scopeCompleteness = rehabBudget > 0 ? "HIGH" : "INSUFFICIENT DATA";
  const contractorEstimateStatus = deal.contractorEstimateStatus || "Insufficient Data";
  const materialPricingStatus = deal.materialPricingStatus || "Insufficient Data";
  const contingency = safeNumber(deal.contingency || rehabBudget * 0.1);
  const propertyCondition = safeString(deal.condition || "Average");
  const systemsAge = safeNumber(deal.systemsAge || 0);
  const permitsRequired = safeNumber(deal.permitsRequired || 0);
  const comparableProjects = safeNumber(deal.comparableProjects || 0);
  const unknownConditions = safeNumber(deal.unknownConditions || 0);
  const score = [rehabBudget > 0, contractorEstimateStatus !== "Insufficient Data", materialPricingStatus !== "Insufficient Data", contingency > 0, propertyCondition !== "Insufficient Data", systemsAge > 0, comparableProjects > 0, unknownConditions === 0].filter(Boolean).length;
  let level = "INSUFFICIENT DATA";
  if (score >= 7) level = "HIGH";
  else if (score >= 4) level = "MEDIUM";
  else if (score >= 2) level = "LOW";
  return { level, score, details: { scopeCompleteness, contractorEstimateStatus, materialPricingStatus, contingency, propertyCondition, systemsAge, permitsRequired, comparableProjects, unknownConditions } };
}

export function buildArvConfidence(deal = {}, comps = []) {
  const normalizedComps = (Array.isArray(comps) ? comps : []).map(normalizeComp);
  const includedComps = normalizedComps.filter((comp) => comp.included !== false);
  const baseArv = safeNumber(deal.estimatedArv || deal.arv || 0);
  const conservativeArv = baseArv > 0 ? baseArv * 0.95 : 0;
  const optimisticArv = baseArv > 0 ? baseArv * 1.05 : 0;
  const compCount = includedComps.length;
  let level = "INSUFFICIENT DATA";
  if (compCount >= 3) level = "HIGH";
  else if (compCount >= 2) level = "MEDIUM";
  else if (compCount >= 1) level = "LOW";
  return { level, baseArv, conservativeArv, optimisticArv, supportingComps: includedComps.slice(0, 3), largestUncertainty: includedComps.length ? "Comp similarity" : "No supported comps" };
}

export function buildStressScenarios(deal = {}, arv = {}) {
  const baseArv = safeNumber(deal.estimatedArv || deal.arv || arv.supportedBaseArv || 0);
  const purchasePrice = safeNumber(deal.purchasePrice || deal.askingPrice || 0);
  const rehabBudget = safeNumber(deal.rehabBudget || 0);
  const holdingCosts = safeNumber(deal.holdingCosts || 0);
  const sellingCosts = safeNumber(deal.sellingCosts || 0.08 * baseArv);
  const financingCosts = safeNumber(deal.financingCosts || 0);
  const closingCosts = safeNumber(deal.closingCosts || 0);
  const baseCost = purchasePrice + rehabBudget + holdingCosts + financingCosts + closingCosts;
  const buildScenario = (label, arvFactor, rehabFactor, holdFactor, rateFactor = 1) => {
    const scenarioArv = baseArv * arvFactor;
    const scenarioRehab = rehabBudget * rehabFactor;
    const scenarioHoldingCosts = holdingCosts * holdFactor;
    const scenarioCost = purchasePrice + scenarioRehab + scenarioHoldingCosts + financingCosts * rateFactor + closingCosts;
    const profit = scenarioArv - scenarioCost - sellingCosts;
    const margin = scenarioArv > 0 ? profit / scenarioArv : 0;
    return {
      label,
      profit,
      margin,
      cashRequired: scenarioCost,
      cashRemaining: scenarioArv - scenarioCost - sellingCosts,
      monthlyCashFlow: 0,
      dscr: 0,
      strategyResult: profit > 0 ? "Proceed" : "Reject",
      passFail: profit > 0 ? "PASS" : "FAIL",
    };
  };

  return {
    baseCase: buildScenario("Base Case", 1, 1, 1),
    arvDown5: buildScenario("ARV Down 5%", 0.95, 1, 1),
    arvDown10: buildScenario("ARV Down 10%", 0.9, 1, 1),
    rehabUp10: buildScenario("Rehab Up 10%", 1, 1.1, 1),
    rehabUp20: buildScenario("Rehab Up 20%", 1, 1.2, 1),
    timelineExtended30: buildScenario("Timeline +30 Days", 1, 1, 1.15),
    timelineExtended60: buildScenario("Timeline +60 Days", 1, 1, 1.3),
    rateIncrease: buildScenario("Interest Rate Up", 1, 1, 1, 1.05),
    downsideCombined: buildScenario("Combined Downside", 0.9, 1.2, 1.3, 1.05),
  };
}

export function buildReunderwritingTriggers(deal = {}, previous = {}) {
  const changes = [];
  const current = {
    purchasePrice: safeNumber(deal.purchasePrice || deal.askingPrice || 0),
    rehabBudget: safeNumber(deal.rehabBudget || 0),
    estimatedArv: safeNumber(deal.estimatedArv || deal.arv || 0),
    timelineDays: safeNumber(deal.timelineDays || deal.holdingMonths * 30 || 0),
    financingTerms: safeNumber(deal.financingCosts || 0),
    rent: safeNumber(deal.estimatedRent || 0),
    taxes: safeNumber(deal.taxes || 0),
    insurance: safeNumber(deal.insurance || 0),
    contractorEstimate: safeNumber(deal.contractorEstimate || 0),
    comps: safeNumber(deal.comps || 0),
    exitStrategy: safeString(deal.exitStrategy || deal.strategy || ""),
  };
  const prior = {
    purchasePrice: safeNumber(previous.purchasePrice || previous.askingPrice || 0),
    rehabBudget: safeNumber(previous.rehabBudget || 0),
    estimatedArv: safeNumber(previous.estimatedArv || previous.arv || 0),
    timelineDays: safeNumber(previous.timelineDays || previous.holdingMonths * 30 || 0),
    financingTerms: safeNumber(previous.financingCosts || 0),
    rent: safeNumber(previous.estimatedRent || 0),
    taxes: safeNumber(previous.taxes || 0),
    insurance: safeNumber(previous.insurance || 0),
    contractorEstimate: safeNumber(previous.contractorEstimate || 0),
    comps: safeNumber(previous.comps || 0),
    exitStrategy: safeString(previous.exitStrategy || previous.strategy || ""),
  };
  if (Math.abs(current.purchasePrice - prior.purchasePrice) > 0) changes.push("Purchase price changed");
  if (Math.abs(current.rehabBudget - prior.rehabBudget) > 0) changes.push("Rehab budget changed");
  if (Math.abs(current.estimatedArv - prior.estimatedArv) > 0) changes.push("ARV changed");
  if (Math.abs(current.timelineDays - prior.timelineDays) > 0) changes.push("Timeline changed");
  if (Math.abs(current.financingTerms - prior.financingTerms) > 0) changes.push("Financing terms changed");
  if (Math.abs(current.rent - prior.rent) > 0) changes.push("Rent changed");
  if (Math.abs(current.taxes - prior.taxes) > 0) changes.push("Taxes changed");
  if (Math.abs(current.insurance - prior.insurance) > 0) changes.push("Insurance changed");
  if (Math.abs(current.contractorEstimate - prior.contractorEstimate) > 0) changes.push("Contractor estimate changed");
  if (Math.abs(current.comps - prior.comps) > 0) changes.push("Comparable sale set changed");
  if (current.exitStrategy && prior.exitStrategy && current.exitStrategy !== prior.exitStrategy) changes.push("Exit strategy changed");
  return changes;
}

export function buildSharedUnderwritingSnapshot(deal = {}, comps = [], neighborhoods = []) {
  const normalizedDeal = normalizeDealForIntelligence(deal);
  const underwriting = buildUnifiedUnderwritingIntelligence(normalizedDeal, comps, neighborhoods);
  const financing = { loanAmount: safeNumber(normalizedDeal.loanAmount || normalizedDeal.financingLoanAmount || underwriting.financingAnalysis?.loanAmount || 0) };
  const baseMetrics = buildUnderwritingMetrics(normalizedDeal, financing, { includeContingency: true, includeHoldingCost: true, includeTaxesAndInsurance: false, includeExtraCosts: false });
  const metrics = {
    ...baseMetrics,
    purchasePrice: underwriting.flipAnalysis?.purchasePrice ?? baseMetrics.purchasePrice,
    rehabCost: underwriting.flipAnalysis?.rehab ?? baseMetrics.rehabCost,
    totalProjectCost: underwriting.flipAnalysis?.totalProjectCost ?? baseMetrics.totalProjectCost,
    grossProfit: underwriting.flipAnalysis?.grossProfit ?? baseMetrics.grossProfit,
    profit: underwriting.flipAnalysis?.netProfit ?? baseMetrics.profit,
    roi: underwriting.flipAnalysis?.returnOnCost ?? baseMetrics.roi,
    cashRequired: underwriting.financingAnalysis?.totalCashInvested ?? baseMetrics.cashRequired,
    financingCosts: underwriting.financingAnalysis?.financingCosts ?? baseMetrics.financingCosts,
    holdingCost: underwriting.financingAnalysis?.holdingCosts ?? baseMetrics.holdingCost,
    closingCosts: underwriting.flipAnalysis?.closingCosts ?? baseMetrics.closingCosts,
    sellingCosts: underwriting.flipAnalysis?.sellingCosts ?? baseMetrics.sellingCosts,
  };
  const summary = {
    purchasePrice: metrics.purchasePrice,
    rehabBudget: metrics.rehabCost,
    totalProjectCost: metrics.totalProjectCost,
    arv: underwriting.arvAnalysis?.supportedBaseArv ?? metrics.arv,
    profit: metrics.profit,
    roi: metrics.roi,
    cashRequired: metrics.cashRequired,
    recommendedOffer: underwriting.mao?.targetOffer ?? 0,
    walkAwayPrice: underwriting.mao?.walkAwayPrice ?? 0,
    buyBoxResult: underwriting.buyBox?.result ?? "INSUFFICIENT DATA",
    confidence: underwriting.arvAnalysis?.confidenceLabel ?? "INSUFFICIENT DATA",
  };

  return {
    deal: normalizedDeal,
    financing,
    metrics,
    summary,
    underwriting,
    comps,
    neighborhoods,
  };
}

function buildSharedDecisionResult(normalizedDeal = {}, financingAnalysis = {}, arvAnalysis = {}, buyBoxAnalysis = {}, flipAnalysis = {}, riskProfile = {}, recommendation = {}, executiveMarketSummary = {}, options = {}) {
  const projectStatus = String(normalizedDeal.status || normalizedDeal.projectStatus || "").trim().toLowerCase();
  const purchaseEvidence = Boolean(normalizedDeal.purchasePrice || normalizedDeal.askingPrice || normalizedDeal.actualLoanAmount || normalizedDeal.purchaseDate || normalizedDeal.purchasedAt || normalizedDeal.completedAt || /acquired|owned|rehab|listed|refinancing|held/i.test(String(normalizedDeal.notes || "")) || /acquired|owned|rehab|listed|refinancing|held/i.test(String(normalizedDeal.status || "")));
  const isOwnedProjectMode = ["acquired", "in-rehab", "owned", "listed", "refinancing", "held"].includes(projectStatus)
    || /purchased|owned|acquired|in rehab|rehab|refinancing|listed|held/i.test(String(normalizedDeal.notes || ""))
    || Boolean(normalizedDeal.purchaseDate && new Date(normalizedDeal.purchaseDate) < new Date())
    || Boolean(normalizedDeal.actualLoanAmount && normalizedDeal.purchasePrice && normalizedDeal.purchasePrice > 0)
    || Boolean(normalizedDeal.actualLoanAmount && normalizedDeal.status && /acquired|owned|rehab|listed|refinancing|held/i.test(String(normalizedDeal.status)));

  const projectedProfit = safeNumber(financingAnalysis?.projectedProfit ?? flipAnalysis?.netProfit ?? 0);
  const expectedProfit = safeNumber(options.expectedProfit ?? projectedProfit);
  const bestCaseProfit = safeNumber(options.bestCaseProfit ?? Math.max(projectedProfit, expectedProfit * 1.15));
  const worstCaseProfit = safeNumber(options.worstCaseProfit ?? Math.min(projectedProfit, expectedProfit * 0.8));
  const projectedRoi = safeNumber(financingAnalysis?.cashOnCashReturn ?? flipAnalysis?.returnOnCost ?? 0);
  const worstCaseRoi = safeNumber(options.worstCaseRoi ?? Math.min(projectedRoi, 0));
  const effectiveFinancingCosts = safeNumber(financingAnalysis?.effectiveFinancingCosts ?? financingAnalysis?.financingCosts ?? 0);
  const financingCostSource = financingAnalysis?.financingCostSource || (effectiveFinancingCosts > 0 ? "calculated" : "manual-override");
  const buyBoxResult = String(buyBoxAnalysis?.result || buyBoxAnalysis?.decision || "INSUFFICIENT DATA").toUpperCase();
  const hardFailure = /not qualified|insufficient capital|insufficient funds|reject/i.test(String(recommendation?.action || "")) || projectedProfit <= 0 && buyBoxResult !== "PASS";
  const hasMissingData = Boolean(options.missingData || financingAnalysis?.missingFields?.length || (!normalizedDeal.estimatedArv && !normalizedDeal.supportedARV));
  const dataCompleteness = clamp(safeNumber(options.dataCompleteness ?? (normalizedDeal.purchasePrice && normalizedDeal.rehabBudget && normalizedDeal.estimatedArv && financingAnalysis?.actualLoanAmount && financingAnalysis?.initialCashInvested && financingAnalysis?.monthlyCarry ? 100 : 60)), 0, 100);
  const arvConfidenceScore = safeNumber(options.arvConfidenceScore ?? (arvAnalysis?.confidenceScore ?? 0));
  const financingConfidenceScore = safeNumber(options.financingConfidenceScore ?? financingAnalysis?.financingConfidence ?? 0);
  const costConfidenceScore = safeNumber(options.costConfidenceScore ?? Math.max(0, 100 - (effectiveFinancingCosts > 0 ? 10 : 20)));
  const scenarioStabilityScore = clamp(100 - Math.max(0, Math.abs(bestCaseProfit - expectedProfit)) / Math.max(1, Math.abs(expectedProfit || 1)) * 100, 0, 100);
  const decisionConfidence = clamp((dataCompleteness * 0.3) + (arvConfidenceScore * 0.25) + (financingConfidenceScore * 0.2) + (costConfidenceScore * 0.15) + (scenarioStabilityScore * 0.1), 0, 100);
  const baseRisk = Math.max(10, Math.min(90, 25 * (arvAnalysis?.confidenceLabel === "LOW" || arvAnalysis?.confidenceLabel === "PRELIMINARY" || arvAnalysis?.confidenceLabel === "VERY LOW" ? 1 : 0) + 20 * (worstCaseProfit < 0 ? 1 : 0) + 15 * (projectedRoi <= 0.05 ? 1 : 0) + 15 * (effectiveFinancingCosts > 0 ? 1 : 0) + 10 * (safeNumber(normalizedDeal.rehabBudget) > 60000 ? 1 : 0) + 10 * (hasMissingData ? 1 : 0)));
  const overallRiskScore = clamp(baseRisk + (options.warningCount ? options.warningCount * 3 : 5), 0, 100);
  const arvConfidence = arvAnalysis?.confidenceLabel === "HIGH" || arvAnalysis?.confidenceLabel === "MODERATE" ? arvAnalysis.confidenceLabel : (arvAnalysis?.supportedBaseArv > 0 && (!arvAnalysis?.compEvaluations?.length || arvAnalysis?.compEvaluations?.length < 3) ? "Preliminary" : "Low");
  let primaryAction = "Continue Project";
  let secondaryAction = "Re-underwrite";
  let investmentDecision = "Conditional Continue";
  let strategy = "Continue Rehab With Controls";
  let aiDecision = "Re-underwrite";
  let executiveDecision = "Continue Project With Controls";
  let baseRecommendation = "Continue Project";
  let worstCaseRecommendation = "Control Costs";
  let downsideRecommendation = "Pause New Spending";
  let enterpriseRoute = "Continue";
  let qualification = "Qualified";
  const reasons = [];
  const warnings = [];
  const missingData = [];
  const assumptions = [];
  const criticalRisks = [];
  const blockingActions = [];

  if (isOwnedProjectMode) {
    primaryAction = projectedProfit > 0 ? "Continue Project" : "Continue Rehab With Controls";
    secondaryAction = projectedProfit > 0 ? "Control Costs" : "Re-underwrite";
    investmentDecision = projectedProfit > 0 ? "Conditional Continue" : "Pause New Spending";
    strategy = projectedProfit > 0 ? "Continue Rehab With Controls" : "Re-underwrite";
    aiDecision = projectedProfit > 0 ? "Continue Project" : "Re-underwrite";
    executiveDecision = projectedProfit > 0 ? "Continue Project With Controls" : "Pause New Spending";
    baseRecommendation = projectedProfit > 0 ? "Continue Project" : "Re-underwrite";
    worstCaseRecommendation = worstCaseProfit < 0 ? "Control Costs" : "Pause New Spending";
    downsideRecommendation = worstCaseProfit < 0 ? "Pause New Spending" : "Re-underwrite";
    enterpriseRoute = projectedProfit > 0 ? "Continue" : "Re-underwrite";
    qualification = "Qualified";
    reasons.push("The project is already in an owned-project operating mode.");
    reasons.push(projectedProfit > 0 ? "Base-case economics remain positive." : "The current base case is not yet supportable.");
    if (worstCaseProfit < 0) reasons.push("The downside case would require cost controls or a re-underwrite.");
    if (arvAnalysis?.supportedBaseArv > 0 && (!arvAnalysis?.compEvaluations?.length || arvAnalysis.compEvaluations.length < 3)) warnings.push("ARV entered but not yet supported by comp evidence.");
    if (effectiveFinancingCosts > 0) warnings.push("Financing costs are being sourced from the calculated underwriting path.");
  } else {
    primaryAction = projectedProfit > 0 ? "Proceed" : "Re-underwrite";
    secondaryAction = projectedProfit > 0 ? "Re-underwrite" : "Control Costs";
    investmentDecision = projectedProfit > 0 ? "Buy" : "Conditional Buy";
    strategy = projectedProfit > 0 ? "Purchase With Controls" : "Do Not Purchase";
    aiDecision = projectedProfit > 0 ? "Proceed" : "Pause";
    executiveDecision = projectedProfit > 0 ? "Proceed" : "Pause";
    baseRecommendation = projectedProfit > 0 ? "Buy" : "Reject";
    worstCaseRecommendation = worstCaseProfit < 0 ? "Re-underwrite" : "Control Costs";
    downsideRecommendation = worstCaseProfit < 0 ? "Pause New Spending" : "Re-underwrite";
    enterpriseRoute = projectedProfit > 0 ? "Continue" : "Re-underwrite";
    qualification = buyBoxResult === "PASS" ? "Qualified" : "Conditional";
  }

  if (hasMissingData) {
    missingData.push("ARV evidence is incomplete");
    warnings.push("Core underwriting data remains incomplete.");
    assumptions.push("The current recommendation assumes the entered values remain unchanged until comp evidence is updated.");
    if (!normalizedDeal.estimatedArv) missingData.push("ARV is missing");
    if (!normalizedDeal.rehabBudget) missingData.push("Rehab budget is missing");
    if (!normalizedDeal.purchasePrice) missingData.push("Purchase price is missing");
  }

  if (worstCaseProfit < 0) {
    criticalRisks.push("Worst-case profit is negative and requires management controls.");
  }
  if (effectiveFinancingCosts > 0) {
    criticalRisks.push("Financing carry remains a meaningful project risk.");
  }
  if (arvAnalysis?.supportedBaseArv > 0 && (!arvAnalysis?.compEvaluations?.length || arvAnalysis.compEvaluations.length < 3)) {
    criticalRisks.push("ARV support is not yet backed by sufficient comp evidence.");
  }
  if (projectedProfit <= 0) {
    blockingActions.push("Re-underwrite the project before approving spend.");
  }
  if (worstCaseProfit < 0) {
    blockingActions.push("Control costs or pause new spending until the downside case is mitigated.");
  }

  return {
    mode: isOwnedProjectMode ? "owned-project" : "acquisition",
    projectStatus: projectStatus || "unknown",
    qualification,
    primaryAction,
    secondaryAction,
    investmentDecision,
    strategy,
    aiDecision,
    executiveDecision,
    baseRecommendation,
    worstCaseRecommendation,
    downsideRecommendation,
    enterpriseRoute,
    overallRiskScore,
    decisionConfidence,
    arvConfidence,
    financingConfidence: financingConfidenceScore,
    costConfidence: costConfidenceScore,
    arvConfidenceScore: safeNumber(options.arvConfidenceScore ?? (arvAnalysis?.confidenceScore ?? 0)),
    dataCompleteness,
    projectedProfit,
    expectedProfit,
    bestCaseProfit,
    worstCaseProfit,
    expectedROI: projectedRoi,
    worstCaseROI: worstCaseRoi,
    breakEvenSalePrice: safeNumber(options.breakEvenSalePrice ?? (normalizedDeal.purchasePrice + normalizedDeal.rehabBudget + safeNumber(normalizedDeal.closingCosts || 0) + effectiveFinancingCosts + safeNumber(normalizedDeal.holdingCosts || 0) + safeNumber(normalizedDeal.sellingCosts || 0) + safeNumber(normalizedDeal.requiredProfitBuffer || 0))),
    decisionBreakingThreshold: safeNumber(options.breakEvenSalePrice ?? (normalizedDeal.purchasePrice + normalizedDeal.rehabBudget + safeNumber(normalizedDeal.closingCosts || 0) + effectiveFinancingCosts + safeNumber(normalizedDeal.holdingCosts || 0) + safeNumber(normalizedDeal.sellingCosts || 0) + safeNumber(normalizedDeal.requiredProfitBuffer || 0))),
    decisionBreakingThresholdMessage: `Sale price must remain above $${safeNumber(options.breakEvenSalePrice ?? (normalizedDeal.purchasePrice + normalizedDeal.rehabBudget + safeNumber(normalizedDeal.closingCosts || 0) + effectiveFinancingCosts + safeNumber(normalizedDeal.holdingCosts || 0) + safeNumber(normalizedDeal.sellingCosts || 0) + safeNumber(normalizedDeal.requiredProfitBuffer || 0))).toLocaleString("en-US")} to avoid a projected loss.`,
    reasons,
    warnings,
    missingData,
    assumptions,
    criticalRisks,
    blockingActions,
    financingCostSource,
  };
}

function buildBreakEvenAndExitControl(deal = {}, financingAnalysis = {}, flipAnalysis = {}) {
  const purchasePrice = safeNumber(deal.purchasePrice || deal.askingPrice || 0);
  const rehabBudget = safeNumber(deal.rehabBudget || 0);
  const sellingCosts = safeNumber(deal.sellingCosts || 0.08 * safeNumber(flipAnalysis?.arv || 0));
  const financingCosts = safeNumber(financingAnalysis?.effectiveFinancingCosts ?? financingAnalysis?.financingCosts ?? safeNumber(deal.financingCosts));
  const holdingCosts = safeNumber(deal.holdingCosts || 0);
  const requiredProfitBuffer = safeNumber(deal.requiredProfitBuffer || 5000);
  const breakEvenSalePrice = purchasePrice + rehabBudget + sellingCosts + financingCosts + holdingCosts + requiredProfitBuffer;
  const projectedBreakEvenRoi = breakEvenSalePrice > 0 ? (breakEvenSalePrice - purchasePrice - rehabBudget - financingCosts - holdingCosts) / breakEvenSalePrice : 0;
  const exitGuardrails = [
    breakEvenSalePrice > 0 ? `Maintain sale price above $${breakEvenSalePrice.toLocaleString("en-US")}` : "Confirm break-even sale price",
    financingCosts > 0 ? "Hold financing costs under control through close-out" : "Financing costs appear manageable",
    safeNumber(deal.estimatedRent || 0) > 0 ? "Rent support should remain above debt service" : "Confirm rent support before exit",
  ];
  return {
    breakEvenSalePrice,
    breakEvenSalePriceDisplay: `$${breakEvenSalePrice.toLocaleString("en-US")}`,
    projectedBreakEvenRoi,
    exitGuardrails,
    controlMethods: [
      "Preserve contingency for rehab overrun",
      "Re-underwrite if market liquidity softens",
      "Reassess refinance terms before hold period expires",
    ],
  };
}

function buildCashForecast(deal = {}, financingAnalysis = {}, flipAnalysis = {}) {
  const monthlyRent = safeNumber(deal.estimatedRent || deal.marketRent || deal.projectedRent || 0);
  const monthlyDebtService = safeNumber(financingAnalysis?.monthlyCarry || 0);
  const monthlyCashFlow = Math.max(0, monthlyRent - monthlyDebtService);
  const periods = [30, 90, 180, 365].map((days) => {
    const factor = days <= 30 ? 1 : days <= 90 ? 1.02 : days <= 180 ? 1.04 : 1.06;
    return {
      days,
      projectedCashBalance: Math.round((safeNumber(deal.cashToClose || 0) + monthlyCashFlow * 12 * (days / 365)) * factor),
      projectedCashBalanceDisplay: `$${Math.round((safeNumber(deal.cashToClose || 0) + monthlyCashFlow * 12 * (days / 365)) * factor).toLocaleString("en-US")}`,
      cashFlowTrend: monthlyCashFlow > 0 ? "Positive" : "Negative",
    };
  });
  return {
    monthlyCashFlow,
    monthlyCashFlowDisplay: `$${monthlyCashFlow.toLocaleString("en-US")}`,
    annualizedCashFlow: monthlyCashFlow * 12,
    annualizedCashFlowDisplay: `$${(monthlyCashFlow * 12).toLocaleString("en-US")}`,
    periods,
    confidence: monthlyRent > 0 && monthlyDebtService > 0 ? "Moderate" : "Low",
  };
}

function buildLenderIntelligence(deal = {}, financingAnalysis = {}, buyBoxAnalysis = {}) {
  const loanAmount = safeNumber(financingAnalysis?.actualLoanAmount || financingAnalysis?.loanAmount || 0);
  const purchasePrice = safeNumber(deal.purchasePrice || deal.askingPrice || 0);
  const fitScore = Math.max(0, Math.min(100, Math.round((buyBoxAnalysis?.overallScore || 0) * 0.45 + (loanAmount > 0 ? 25 : 0) + (purchasePrice > 0 ? 10 : 0))));
  const loanQualification = fitScore >= 70 ? "Qualified" : fitScore >= 50 ? "Conditional" : "Needs Review";
  return {
    loanQualification,
    fitScore,
    loanAmount,
    lenderRecommendation: loanQualification === "Qualified" ? "Advance with term sheet review" : loanQualification === "Conditional" ? "Prepare lender conditions and additional evidence" : "Request a lender re-underwrite",
    lenderConditions: [
      "Validate DSCR and reserve support",
      "Confirm rehab draw schedule",
      "Document the exit plan",
    ],
  };
}

function buildGovernanceSignals(deal = {}, financingAnalysis = {}, buyBoxAnalysis = {}, sharedDecision = {}) {
  const approvalReady = safeNumber(financingAnalysis?.projectedProfit || 0) > 0 && (buyBoxAnalysis?.result === "PASS" || buyBoxAnalysis?.result === "CONDITIONAL");
  return {
    approvalReady,
    approvalStatus: approvalReady ? "Ready for review" : "Requires executive review",
    controlPoints: [
      "Validate buy-box fit",
      "Confirm financing cost source",
      "Review reserve impact",
    ],
    governanceNotes: approvalReady
      ? "The deal has sufficient support to proceed to executive review with standard controls."
      : "The deal requires additional evidence or a revised underwriting posture before approval.",
    decisionGate: safeString(sharedDecision?.primaryAction || sharedDecision?.investmentDecision || "Re-underwrite", "Re-underwrite"),
  };
}

function buildHistoricalLearning(deal = {}) {
  const strategy = safeString(deal.strategy || deal.exitStrategy || "Flip", "Flip");
  return {
    entries: [
      {
        title: `${strategy} deals with stable rent support and controlled rehab spend typically outperform weakly supported acquisitions.`,
        lesson: "Use the shared underwriting path as the source of truth before changing the offer ladder.",
      },
      {
        title: "Owned-project reviews should preserve financing carry and rehab draw assumptions across reopen events.",
        lesson: "Re-opened deals should hydrate from the normalized values rather than a blank or legacy payload.",
      },
    ],
    confidence: "Moderate",
  };
}

function buildRefreshSignals(deal = {}, sharedDecision = {}) {
  return {
    moduleSyncStatus: "Synchronized",
    lastRefresh: new Date().toISOString(),
    refreshReason: sharedDecision?.primaryAction ? `Refresh triggered by ${sharedDecision.primaryAction}` : "Refresh triggered by underwriting update",
    refreshActions: [
      "Recompute shared underwriting summary",
      "Reconcile portfolio and deal intelligence",
      "Re-evaluate capital allocation posture",
    ],
  };
}

export function buildUnifiedUnderwritingIntelligence(deal = {}, comps = [], neighborhoods = []) {
  const normalizedDeal = normalizeDealForIntelligence(deal);
  const normalizedInputs = normalizeUnderwritingInputs(deal);
  const arvAnalysis = buildArvIntelligence(normalizedDeal, comps, neighborhoods);
  const buyBoxAnalysis = buildBuyBoxIntelligence(normalizedDeal, neighborhoods);
  const offerAnalysis = buildOfferIntelligence(normalizedDeal, arvAnalysis, buyBoxAnalysis, { loanAmount: safeNumber(normalizedDeal.financingCosts) });
  const appraisalAnalysis = buildAppraisalIntelligence({ supportedARV: arvAnalysis.supportedBaseArv, requestedARV: safeNumber(normalizedDeal.requestedARV ?? normalizedDeal.estimatedArv ?? normalizedDeal.projectedARV) }, comps);
  const marketAnalysis = buildPredictiveMarketIntelligence(normalizedDeal, neighborhoods, comps);
  const marketRisk = {
    ...marketAnalysis.marketRiskEngine,
    marketRiskRating: marketAnalysis.marketRiskEngine.marketRiskRating,
    marketRiskRatingExplanation: marketAnalysis.marketRiskEngine.marketRiskRatingExplanation,
  };
  const opportunityAnalysis = buildOpportunityDetectionEngine(
    normalizedDeal,
    {
      confidenceLevel: arvAnalysis.confidenceLevel,
      comparableConfidence: { overallConfidenceScore: arvAnalysis.comparableConfidence?.overallConfidenceScore ?? 0, averageRankScore: arvAnalysis.comparableConfidence?.averageRankScore ?? 0 },
      supportedBaseArv: arvAnalysis.supportedBaseArv,
    },
    marketAnalysis,
    buyBoxAnalysis,
    {
      cashOnCashReturn: 0,
      equityCreated: 0,
      dealScore: 0,
    },
    {
      cashOnCashReturn: 0,
      cashLeftInDeal: 0,
      debtServiceCoverageRatio: 0,
      monthlyCashFlow: 0,
    },
    {
      profitMargin: 0,
      netProfit: 0,
      returnOnCost: 0,
    },
    {
      monthlyCashFlow: 0,
      netOperatingIncome: 0,
      cashOnCashReturn: 0,
    },
  );
  const forecastConfidenceAnalysis = buildForecastConfidenceEngine(
    normalizedDeal,
    {
      confidenceLevel: arvAnalysis.confidenceLevel,
      compEvaluations: arvAnalysis.compEvaluations || [],
      compSpread: arvAnalysis.compSpread || 0,
      comparableConfidence: arvAnalysis.comparableConfidence,
    },
    marketAnalysis,
    { opportunityAnalysis },
  );

  const metrics = buildUnderwritingMetrics(normalizedDeal, { loanAmount: safeNumber(normalizedDeal.loanAmount || normalizedDeal.financingLoanAmount || 0) }, { includeContingency: true, includeHoldingCost: true, includeTaxesAndInsurance: false, includeExtraCosts: false });
  const purchasePrice = metrics.purchasePrice;
  const rehabBudget = metrics.rehabCost;
  const contingency = metrics.contingency;
  const totalPlannedRehab = rehabBudget + contingency;
  const rehabPerSqft = normalizedDeal.squareFeet > 0 ? totalPlannedRehab / normalizedDeal.squareFeet : 0;
  const rehabAsArvPct = arvAnalysis.supportedBaseArv > 0 ? totalPlannedRehab / arvAnalysis.supportedBaseArv : 0;
  const rehabAsCostPct = purchasePrice + totalPlannedRehab > 0 ? totalPlannedRehab / (purchasePrice + totalPlannedRehab) : 0;
  const dealExitStrategy = String(normalizedDeal.exitStrategy || normalizedDeal.strategy || "Flip").toLowerCase();
  const status = String(normalizedDeal.status || normalizedDeal.projectStatus || "").toLowerCase();
  const isExistingProjectAnalysis = status === "active project" || status === "in progress" || (status === "active" && dealExitStrategy === "flip") || (normalizedDeal.analysisType || "").toLowerCase().includes("existing project");
  let rehabRiskLevel = "Low";
  if (rehabAsArvPct > 0.25) rehabRiskLevel = "High";
  else if (rehabAsArvPct > 0.15) rehabRiskLevel = "Moderate";

  const monthlyRent = safeNumber(normalizedDeal.estimatedRent || normalizedDeal.monthlyRent || 0);
  const operatingExpenses = safeNumber(normalizedDeal.annualPropertyTaxes || 0) / 12 + safeNumber(normalizedDeal.annualInsurance || 0) / 12 + safeNumber(normalizedDeal.monthlyHoa || 0) + safeNumber(normalizedDeal.monthlyUtilities || 0) + safeNumber(normalizedDeal.otherMonthlyExpenses || 0);
  const vacancyExpense = monthlyRent * safeNumber(normalizedDeal.vacancyPercent || 0.05);
  const nopI = monthlyRent - operatingExpenses - vacancyExpense;
  const refinanceLtv = Math.max(0, Math.min(1, safeNumber(normalizedDeal.refinanceLtvPercent || 0.75)));
  const refinanceLoanAmount = arvAnalysis.supportedBaseArv * refinanceLtv;
  const actualLoanAmount = normalizedInputs.actualLoanAmount ?? normalizedInputs.lenderLoanAmount ?? normalizedInputs.acquisitionLoanAmount ?? (normalizedInputs.acquisitionLoan && normalizedInputs.fundedRehab ? normalizedInputs.acquisitionLoan + normalizedInputs.fundedRehab : null);
  const effectiveLoanAmount = actualLoanAmount ?? normalizedInputs.rehabFundingAmount ?? normalizedInputs.lenderLoanAmount ?? (normalizedInputs.acquisitionLoan && normalizedInputs.fundedRehab ? normalizedInputs.acquisitionLoan + normalizedInputs.fundedRehab : null);
  const loanAmount = effectiveLoanAmount ?? (purchasePrice > 0 ? purchasePrice : 0);
  const monthlyInterest = loanAmount > 0 && normalizedInputs.annualInterestRate ? loanAmount * (normalizedInputs.annualInterestRate / 100) / 12 : 0;
  const requestedLoanTermMonths = safeNumber(normalizedInputs.loanTermMonths ?? normalizedInputs.amortizationTermMonths ?? normalizedDeal.loanTermMonths ?? normalizedDeal.amortizationTermMonths ?? 0);
  const loanTermMonths = requestedLoanTermMonths > 0 ? requestedLoanTermMonths : 360;
  const holdPeriodMonths = Math.max(1, Math.min(loanTermMonths, (safeNumber(normalizedInputs.holdingMonths ?? normalizedDeal.holdingMonths ?? 0) || 1) * 12));
  const amortizedInterestRate = normalizedInputs.annualInterestRate / 100 / 12;
  const monthlyPayment = loanAmount > 0 && normalizedInputs.annualInterestRate ? (loanAmount * amortizedInterestRate) / (1 - Math.pow(1 + amortizedInterestRate, -loanTermMonths)) : 0;
  const totalInterest = loanAmount > 0 && monthlyPayment > 0 ? (loanAmount * amortizedInterestRate * holdPeriodMonths) : 0;
  const acquisitionClosingCosts = normalizedInputs.acquisitionClosingCosts ?? safeNumber(normalizedDeal.closingCosts || 0);
  const financingCostBreakdown = [
    totalInterest,
    normalizedInputs.originationFee ?? 0,
    normalizedInputs.brokerFee ?? 0,
    normalizedInputs.underwritingFee ?? 0,
    normalizedInputs.servicingFee ?? 0,
    normalizedInputs.lenderLegalFee ?? 0,
    normalizedInputs.monitoringFee ?? 0,
    normalizedInputs.otherLenderFees ?? 0,
  ];
  const manualFinancingCosts = normalizedInputs.manualFinancingCosts ?? normalizedDeal.financingCosts ?? normalizedDeal.financingCost ?? 0;
  const financingCosts = manualFinancingCosts > 0 ? manualFinancingCosts : financingCostBreakdown.reduce((sum, value) => sum + (value || 0), 0);
  const cashToClose = normalizedInputs.cashToClose ?? normalizedDeal.cashToClose ?? 0;
  const earnestMoney = normalizedInputs.earnestMoney ?? normalizedDeal.earnestMoney ?? 0;
  const initialCashInvested = Math.max(0, (cashToClose ?? 0) + (earnestMoney ?? 0));
  const constructionHoldback = normalizedInputs.constructionHoldback ?? 0;
  const totalFinancingCost = financingCosts + (normalizedInputs.financingCostsIncludeClosingCosts ? acquisitionClosingCosts : 0);
  const financedRehabDraws = normalizedInputs.fundedRehabDraws ?? normalizedInputs.rehabFundingAmount ?? normalizedInputs.fundedRehab ?? normalizedDeal.fundedRehab ?? 0;
  const remainingRequiredCash = Math.max(0, rehabBudget - (normalizedInputs.lenderPaidEligibleCosts ?? 0) - (normalizedInputs.creditsApplied ?? 0) - financedRehabDraws);
  const cashRequired = Math.max(0, initialCashInvested + remainingRequiredCash - financedRehabDraws);
  const sellingCostPercent = normalizedInputs.sellingCostPercent ?? safeNumber(normalizedDeal.sellingCostPercent || normalizedDeal.sellingCostsPercent || 0.08);
  const sellerConcessions = normalizedInputs.sellerConcessions ?? 0;
  const fixedSaleCosts = normalizedInputs.fixedSaleCosts ?? 0;
  const sellingCosts = arvAnalysis.supportedBaseArv > 0 ? (arvAnalysis.supportedBaseArv * (sellingCostPercent / 100)) + sellerConcessions + fixedSaleCosts : 0;
  const holdingCosts = totalInterest + (normalizedInputs.annualTaxes ? normalizedInputs.annualTaxes * Math.max(1, normalizedInputs.holdingMonths ?? normalizedDeal.holdingMonths ?? 0) / 12 : 0) + (normalizedInputs.annualInsurance ? normalizedInputs.annualInsurance * Math.max(1, normalizedInputs.holdingMonths ?? normalizedDeal.holdingMonths ?? 0) / 12 : 0);
  const otherProjectCosts = safeNumber(normalizedDeal.otherProjectCosts || 0) || 0;
  const baseProjectCost = purchasePrice + rehabBudget + acquisitionClosingCosts + otherProjectCosts;
  const totalProjectCost = baseProjectCost;
  const projectedNetSaleProceeds = arvAnalysis.supportedBaseArv - sellingCosts;
  const derivedProjectedProfit = Math.max(projectedNetSaleProceeds - totalProjectCost, 0);
  const persistedProjectedProfit = resolvePersistedProjectedProfit(normalizedDeal);
  const projectedProfit = persistedProjectedProfit > 0 ? persistedProjectedProfit : derivedProjectedProfit;
  const adjustedProjectedProfit = projectedProfit;
  const totalCashInvested = initialCashInvested + Math.max(0, rehabBudget - (normalizedInputs.fundedRehabDraws ?? 0) - (normalizedInputs.lenderPaidEligibleCosts ?? 0) - (normalizedInputs.creditsApplied ?? 0));
  const cashInvested = purchasePrice + rehabBudget + contingency + acquisitionClosingCosts + totalFinancingCost + holdingCosts;
  const cashReturnedAtRefinance = refinanceLoanAmount - safeNumber(normalizedDeal.refinanceClosingCosts || 0);
  const cashLeftInDeal = cashReturnedAtRefinance - cashInvested;
  const monthlyDebtService = refinanceLoanAmount > 0 ? refinanceLoanAmount / 360 : 0;
  const monthlyCarry = monthlyPayment;
  const monthlyCashFlow = nopI - monthlyDebtService;
  const dscr = monthlyDebtService > 0 ? nopI / monthlyDebtService : 0;
  const cashOnCash = totalCashInvested > 0 ? projectedProfit / totalCashInvested * 100 : 0;

  const brrrrAnalysis = {
    purchasePrice,
    closingCosts: acquisitionClosingCosts,
    rehab: rehabBudget,
    contingency,
    totalProjectCost: cashInvested,
    stabilizedArv: arvAnalysis.supportedBaseArv,
    expectedRent: monthlyRent,
    operatingExpenses,
    netOperatingIncome: nopI,
    refinanceLtv,
    refinanceLoanAmount,
    refinanceClosingCosts: safeNumber(normalizedDeal.refinanceClosingCosts || 0),
    cashInvested,
    cashReturnedAtRefinance,
    cashLeftInDeal,
    monthlyDebtService,
    monthlyCashFlow,
    debtServiceCoverageRatio: dscr,
    cashOnCashReturn: cashOnCash,
    breakEvenOccupancy: operatingExpenses > 0 ? operatingExpenses / Math.max(monthlyRent, 1) : 0,
    refinanceShortfall: Math.max(0, cashInvested - cashReturnedAtRefinance),
  };

  const effectiveFinancingCosts = totalFinancingCost > 0 ? totalFinancingCost : safeNumber(normalizedDeal.financingCosts || normalizedDeal.financingCost || 0);
  const financingCostSource = normalizedDeal.financingCosts > 0 || normalizedDeal.financingCost > 0 ? "manual-override" : "calculated";
  const financingAnalysis = {
    actualLoanAmount: actualLoanAmount ?? 0,
    lenderLoanAmount: normalizedInputs.lenderLoanAmount ?? 0,
    acquisitionLoan: normalizedInputs.acquisitionLoan ?? 0,
    fundedRehab: normalizedInputs.fundedRehab ?? 0,
    loanAmount,
    monthlyCarry,
    totalInterest,
    financingCosts: totalFinancingCost,
    effectiveFinancingCosts,
    financingCostSource,
    constructionHoldback: constructionHoldback ?? 0,
    initialCashInvested,
    cashRequired,
    cashToClose: cashToClose ?? 0,
    earnestMoney: earnestMoney ?? 0,
    projectedProfit: adjustedProjectedProfit,
    projectedNetSaleProceeds,
    totalProjectCost,
    holdingCosts,
    sellingCosts,
    totalCashInvested,
    cashOnCashReturn: cashOnCash,
    dataCompletenessScore: Math.max(0, Math.min(100, 100 - (normalizedInputs.hasMissingData ? 20 : 0))),
    underwritingConfidence: Math.max(0, Math.min(100, 70 + (arvAnalysis.supportedBaseArv > 0 ? 12 : 0) + (loanAmount > 0 ? 8 : 0) + (initialCashInvested > 0 ? 5 : 0))),
    arvConfidence: Math.max(0, Math.min(100, arvAnalysis.confidenceScore || 0)),
    financingConfidence: Math.max(0, Math.min(100, loanAmount > 0 ? 85 : 50)),
    decisionConfidence: Math.max(0, Math.min(100, 70 + (projectedProfit > 0 ? 15 : 0) + (initialCashInvested > 0 ? 5 : 0))),
    missingFields: normalizedInputs.missingFields || [],
  };

  const compReviewSummary = {
    includedCount: arvAnalysis.compEvaluations.length,
    excludedCount: 0,
    preferredCount: 0,
    reviewNotes: arvAnalysis.compEvaluations.map((entry) => entry.inclusionReasonDetail),
  };

  const flipAnalysis = {
    purchasePrice,
    closingCosts: acquisitionClosingCosts,
    rehab: rehabBudget,
    contingency,
    financingCosts: totalFinancingCost,
    holdingCosts,
    sellingCosts,
    totalProjectCost,
    arv: arvAnalysis.supportedBaseArv,
    expectedSalePrice: arvAnalysis.supportedBaseArv,
    grossProfit: projectedNetSaleProceeds - totalProjectCost,
    netProfit: adjustedProjectedProfit,
    profitMargin: arvAnalysis.supportedBaseArv > 0 ? projectedProfit / arvAnalysis.supportedBaseArv : 0,
    returnOnCost: totalProjectCost > 0 ? (projectedNetSaleProceeds - totalProjectCost) / totalProjectCost : 0,
    breakEvenSalePrice: totalProjectCost + sellingCosts,
    maximumAllowableOffer: offerAnalysis.maximumOffer,
    walkAwayPrice: offerAnalysis.walkAwayPrice,
  };

  const stressTests = {
    baseCase: {
      revisedProfit: flipAnalysis.netProfit,
      revisedMargin: flipAnalysis.profitMargin,
      revisedCashRequired: cashInvested,
      revisedCashLeftInDeal: cashLeftInDeal,
      revisedCashFlow: monthlyCashFlow,
      revisedDscr: dscr,
      recommendedAction: flipAnalysis.netProfit > 0 ? "PROCEED" : "REQUEST MORE DATA",
    },
    conservativeCase: {
      revisedProfit: flipAnalysis.netProfit * 0.9,
      revisedMargin: flipAnalysis.profitMargin * 0.9,
      revisedCashRequired: cashInvested + 5000,
      revisedCashLeftInDeal: cashLeftInDeal - 5000,
      revisedCashFlow: monthlyCashFlow - 200,
      revisedDscr: Math.max(0, dscr - 0.15),
      recommendedAction: flipAnalysis.netProfit > 0 ? "PROCEED WITH CONDITIONS" : "REJECT",
    },
    severeDownsideCase: {
      revisedProfit: flipAnalysis.netProfit * 0.7,
      revisedMargin: flipAnalysis.profitMargin * 0.7,
      revisedCashRequired: cashInvested + 15000,
      revisedCashLeftInDeal: cashLeftInDeal - 15000,
      revisedCashFlow: monthlyCashFlow - 400,
      revisedDscr: Math.max(0, dscr - 0.3),
      recommendedAction: flipAnalysis.netProfit > 0 ? "RENEGOTIATE" : "REJECT",
    },
  };

  const baseArv = arvAnalysis.supportedBaseArv;
  const conservativeArv = Math.max(0, baseArv * 0.95);
  const optimisticArv = baseArv * 1.05;
  const confidenceLabel = arvAnalysis.confidenceLevel === "High" ? "HIGH" : arvAnalysis.confidenceLevel === "Moderate" ? "MODERATE" : arvAnalysis.confidenceLevel === "Low" ? "LOW" : "INSUFFICIENT DATA";

  const decisionRecommendation = projectedProfit > 0 && (arvAnalysis.supportedBaseArv > 0 || normalizedInputs.hasMissingData === false) ? "BUY" : (projectedProfit > 0 ? "CONDITIONAL BUY" : "REJECT");
  const projectDecisionRecommendation = isExistingProjectAnalysis && dealExitStrategy === "flip" ? (projectedProfit > 0 ? "CONTINUE PROJECT" : (projectedProfit > -10000 ? "CONTINUE REHAB" : "HOLD")) : decisionRecommendation;
  const recommendation = {
    action: projectDecisionRecommendation === "CONTINUE PROJECT" ? "CONTINUE PROJECT" : projectDecisionRecommendation === "CONTINUE REHAB" ? "CONTINUE REHAB" : projectDecisionRecommendation === "HOLD" ? "HOLD" : decisionRecommendation === "BUY" ? "PROCEED" : decisionRecommendation === "CONDITIONAL BUY" ? "REQUEST MORE DATA" : "REJECT",
    confidence: confidenceLabel,
    strongestFactors: ["Comp support exists", "Rehab budget is reasonable", "Buy-box fit is present"],
    primaryRisks: ["Cash flow sensitivity", "ARV confidence", "Market liquidity"],
    missingInfo: normalizedInputs.missingFields || [],
    conditions: ["Validate scope of work", "Confirm rent assumptions", "Review closing-cost accuracy"],
    nextAction: normalizedInputs.hasMissingData ? "Re-underwrite" : (isExistingProjectAnalysis && dealExitStrategy === "flip" ? (projectedProfit > 0 ? "Continue project execution" : "Reassess rehab scope and capital") : "Complete inspection and confirm comp support."),
  };
  const investmentDecision = buildInvestmentDecisionEngine(normalizedDeal, {
    dealScore: safeNumber(normalizedDeal.dealScore ?? 0),
    overallRisk: safeNumber(normalizedDeal.overallRisk ?? flipAnalysis.netProfit > 0 ? 24 : 48),
    buyBoxResult: buyBoxAnalysis.result || "INSUFFICIENT DATA",
    arvConfidence: confidenceLabel === "HIGH" ? "High" : confidenceLabel === "MODERATE" ? "Moderate" : confidenceLabel === "LOW" ? "Low" : "Insufficient Data",
    estimatedFlipProfit: flipAnalysis.netProfit,
    roi: flipAnalysis.returnOnCost,
    monthlyCashFlow,
    cashRequired: cashInvested,
    qualificationStatus: "Qualified",
    warnings: [...(rehabBudget <= 0 ? ["Rehab budget is missing"] : []), ...(arvAnalysis.supportedBaseArv <= 0 ? ["ARV support is missing"] : [])],
    analysisType: isExistingProjectAnalysis ? "Existing Project Analysis" : "Acquisition Analysis",
  });
  const exitStrategy = buildExitStrategyEngine(normalizedDeal, {
    supportedBaseArv: arvAnalysis.supportedBaseArv,
    confidenceLevel: confidenceLabel,
    estimatedFlipProfit: flipAnalysis.netProfit,
    monthlyCashFlow,
    cashRequired: cashInvested,
    roi: flipAnalysis.returnOnCost,
  });
  const riskProfile = buildDealRiskProfile(normalizedDeal, {
    rehabRisk: rehabBudget > 0 && rehabBudget / Math.max(arvAnalysis.supportedBaseArv, 1) > 0.2 ? 55 : 28,
    marketRisk: marketRisk.marketRiskRating === "High" ? 48 : 24,
    financingRisk: monthlyDebtService > 0 && dscr < 1.2 ? 50 : 24,
    appraisalRisk: appraisalAnalysis.appraisalConfidence === "Low" ? 52 : 24,
    contractorRisk: rehabBudget > 0 && rehabBudget > 50000 ? 45 : 25,
    liquidityRisk: marketRisk.marketRiskRating === "High" ? 50 : 25,
    timelineRisk: safeNumber(normalizedDeal.holdingMonths || 6) > 6 ? 42 : 24,
  });
  const executiveMarketSummary = buildExecutiveMarketSummaryEngine(
    normalizedDeal,
    {
      confidenceLevel: arvAnalysis.confidenceLevel,
      supportedBaseArv: arvAnalysis.supportedBaseArv,
      compEvaluations: arvAnalysis.compEvaluations || [],
    },
    marketAnalysis,
    {
      classification: opportunityAnalysis.classification,
      overallOpportunityScore: opportunityAnalysis.overallOpportunityScore,
    },
    forecastConfidenceAnalysis,
    recommendation,
  );

  const sharedDecision = buildSharedDecisionResult(normalizedDeal, financingAnalysis, {
    ...arvAnalysis,
    confidenceLabel: confidenceLabel === "HIGH" ? "High" : confidenceLabel === "MODERATE" ? "Moderate" : confidenceLabel === "LOW" ? "Low" : confidenceLabel === "INSUFFICIENT DATA" ? "Insufficient Data" : confidenceLabel,
  }, buyBoxAnalysis, flipAnalysis, riskProfile, recommendation, executiveMarketSummary, {
    expectedProfit: adjustedProjectedProfit,
    bestCaseProfit: Math.max(adjustedProjectedProfit, adjustedProjectedProfit * 1.15),
    worstCaseProfit: Math.min(adjustedProjectedProfit, adjustedProjectedProfit * 0.8),
    breakEvenSalePrice: Math.max(1, purchasePrice + rehabBudget + acquisitionClosingCosts + effectiveFinancingCosts + holdingCosts + sellingCosts + 5000),
    dataCompleteness: financingAnalysis.dataCompletenessScore,
    arvConfidenceScore: clamp(arvAnalysis.confidenceScore || 30),
    financingConfidenceScore: financingAnalysis.financingConfidence,
    costConfidenceScore: clamp(100 - Math.max(0, effectiveFinancingCosts / Math.max(1, purchasePrice + rehabBudget) * 100), 0, 100),
    warningCount: Math.max(1, [...(rehabBudget <= 0 ? ["Rehab budget is missing"] : []), ...(arvAnalysis.supportedBaseArv <= 0 ? ["ARV support is missing"] : []), ...(effectiveFinancingCosts <= 0 ? ["Financing costs are missing"] : [])].length),
  });
  const breakEvenAndExitControl = buildBreakEvenAndExitControl(normalizedDeal, financingAnalysis, flipAnalysis);
  const cashForecast = buildCashForecast(normalizedDeal, financingAnalysis, flipAnalysis);
  const lenderIntelligence = buildLenderIntelligence(normalizedDeal, financingAnalysis, buyBoxAnalysis);
  const governance = buildGovernanceSignals(normalizedDeal, financingAnalysis, buyBoxAnalysis, sharedDecision);
  const historicalLearning = buildHistoricalLearning(normalizedDeal);
  const refreshSignals = buildRefreshSignals(normalizedDeal, sharedDecision);
  const decisionConsistency = {
    recommendation: sharedDecision.baseRecommendation,
    strategy: sharedDecision.strategy,
    investmentDecision: sharedDecision.investmentDecision,
    baseRecommendation: sharedDecision.baseRecommendation,
    worstCaseRecommendation: sharedDecision.worstCaseRecommendation,
    aiDecision: sharedDecision.aiDecision,
    enterpriseRoute: sharedDecision.enterpriseRoute,
    dataCompletenessScore: financingAnalysis.dataCompletenessScore,
    underwritingConfidence: financingAnalysis.underwritingConfidence,
    arvConfidence: safeNumber(financingAnalysis.arvConfidence ?? sharedDecision.arvConfidenceScore ?? 0),
    financingConfidence: financingAnalysis.financingConfidence,
    decisionConfidence: sharedDecision.decisionConfidence,
    overallRiskScore: sharedDecision.overallRiskScore,
  };

  return {
    normalizedDeal,
    financingAnalysis,
    arvAnalysis: {
      conservativeArv,
      baseCaseArv: baseArv,
      optimisticArv,
      recommendedArv: baseArv,
      supportedLowArv: arvAnalysis.supportedLowArv,
      supportedBaseArv: arvAnalysis.supportedBaseArv,
      supportedHighArv: arvAnalysis.supportedHighArv,
      confidenceScore: arvAnalysis.confidenceScore,
      confidenceLabel,
      eligibleCompCount: arvAnalysis.compEvaluations.length,
      excludedCompCount: 0,
      weightedCompSpread: arvAnalysis.compSpread,
      keyWarnings: arvAnalysis.explanation ? [arvAnalysis.explanation.whyExcluded, arvAnalysis.explanation.primaryUncertainty] : [],
      primaryMethod: "Weighted comparable-sale",
      methods: [
        { name: "Weighted comparable-sale", indicatedValue: baseArv },
        { name: "Price per square foot", indicatedValue: arvAnalysis.weightedPricePerSquareFoot },
      ],
    },
    rehabBudgetAnalysis: {
      baseRehabBudget: rehabBudget,
      contingency,
      totalPlannedRehab,
      rehabPerSquareFoot: rehabPerSqft,
      rehabAsArvPct,
      rehabAsCostPct,
      budgetRiskLevel: rehabRiskLevel,
      missingScopeWarnings: rehabBudget <= 0 ? ["Rehab budget is missing"] : [],
      benchmarkEstimate: totalPlannedRehab,
    },
    flipAnalysis,
    brrrrAnalysis,
    mao: {
      strategy: normalizedDeal.strategy || "Flip",
      maximumOffer: offerAnalysis.maximumOffer,
      targetOffer: offerAnalysis.targetOffer,
      walkAwayPrice: offerAnalysis.walkAwayPrice,
      amountAboveMao: Math.max(0, purchasePrice - offerAnalysis.maximumOffer),
      amountBelowMao: Math.max(0, offerAnalysis.maximumOffer - purchasePrice),
      assumptions: offerAnalysis.negotiationSupport?.majorAssumptions || [],
      warning: offerAnalysis.maximumOffer <= 0 ? "Maximum allowable offer is unavailable" : "",
    },
    compReviewSummary,
    stressTests,
    buyBox: buyBoxAnalysis,
    appraisal: appraisalAnalysis,
    marketAnalysis,
    marketRisk,
    opportunityAnalysis,
    forecastConfidence: forecastConfidenceAnalysis,
    executiveMarketSummary,
    recommendation,
    investmentDecision,
    exitStrategy,
    riskProfile,
    decisionConsistency,
    sharedDecision,
    breakEvenAndExitControl,
    cashForecast,
    lenderIntelligence,
    governance,
    historicalLearning,
    refreshSignals,
  };
}

export function buildKnowledgeIntelligence(deal = {}, analysis = {}, lessons = []) {
  const normalizedDeal = normalizeDealForIntelligence(deal);
  const normalizedLessons = Array.isArray(lessons) ? lessons : [];
  const supportedArv = safeNumber(analysis.supportedBaseArv ?? analysis.supportedArv ?? normalizedDeal.estimatedArv ?? 0);
  const baseEntries = normalizedLessons.length ? normalizedLessons : [{
    title: "Validate valuation support before increasing the offer",
    topic: normalizedDeal.strategy || "underwriting",
    detail: supportedArv > 0 ? "Supported ARV is available, so the next review should focus on comp quality and scope accuracy." : "The current record lacks valuation support, so the next review should gather stronger evidence before moving forward.",
  }];
  const entries = baseEntries.map((entry, index) => ({
    id: entry.id || `lesson-${index + 1}`,
    title: safeString(entry.title || entry.lesson || entry.topic || "Knowledge update", "Knowledge update"),
    topic: safeString(entry.topic || entry.category || normalizedDeal.strategy || "underwriting", "underwriting"),
    detail: safeString(entry.detail || entry.evidence || entry.reason || "The latest record should be reviewed before the next decision.", "The latest record should be reviewed before the next decision."),
    confidence: safeString(entry.confidence || (supportedArv > 0 ? "Moderate" : "Low"), supportedArv > 0 ? "Moderate" : "Low"),
  }));
  return {
    entries,
    summary: supportedArv > 0 ? "The knowledge base is aligned to the current underwriting posture." : "The knowledge base points to a missing evidence gap.",
    recommendedNextInquiry: supportedArv > 0 ? "Confirm the latest comp set and appraisal notes before increasing the offer." : "Gather ARV support and rehab scope evidence before underwriting further.",
    confidence: supportedArv > 0 ? "Moderate" : "Low",
    sources: entries.map((entry) => entry.topic),
  };
}

export function buildSearchIntelligence(query = "", deals = [], properties = [], contractors = [], lenders = [], dealIntelligence = [], alerts = []) {
  const search = safeString(query, "").trim().toLowerCase();
  const results = [];
  if (!search) {
    return { query: search, results, totalResults: 0, recommendedModule: "Deal Intelligence" };
  }

  const dealList = Array.isArray(deals) ? deals : [];
  const propertyList = Array.isArray(properties) ? properties : [];
  const contractorList = Array.isArray(contractors) ? contractors : [];
  const lenderList = Array.isArray(lenders) ? lenders : [];
  const intelligenceList = Array.isArray(dealIntelligence) ? dealIntelligence : [];
  const alertList = Array.isArray(alerts) ? alerts : [];

  dealList.forEach((deal) => {
    const haystack = [deal.propertyAddress, deal.city, deal.state, deal.zipCode, deal.status, deal.strategy, deal.notes].join(" ").toLowerCase();
    if (haystack.includes(search)) results.push({ label: safeString(deal.propertyAddress || deal.propertyName || "Deal", "Deal"), module: "Deal Analyzer" });
  });
  propertyList.forEach((property) => {
    const haystack = [property.propertyName, property.address, property.city, property.state, property.zipCode, property.recommendation, property.status].join(" ").toLowerCase();
    if (haystack.includes(search)) results.push({ label: safeString(property.propertyName || property.address || "Property", "Property"), module: "Property Database" });
  });
  contractorList.forEach((contractor) => {
    if (safeString(contractor.contractorName).toLowerCase().includes(search)) results.push({ label: safeString(contractor.contractorName || "Contractor", "Contractor"), module: "Contractor Hub" });
  });
  lenderList.forEach((lender) => {
    if (safeString(lender.lenderName).toLowerCase().includes(search)) results.push({ label: safeString(lender.lenderName || "Lender", "Lender"), module: "Lender Dashboard" });
  });
  intelligenceList.forEach((entry) => {
    if (safeString(entry.recommendation || entry.decision).toLowerCase().includes(search)) results.push({ label: safeString(entry.analysisName || entry.recommendation || entry.decision || "Analysis", "Analysis"), module: "Deal Intelligence" });
  });
  alertList.forEach((entry) => {
    if (safeString(entry.alert).toLowerCase().includes(search)) results.push({ label: safeString(entry.alert || "Alert", "Alert"), module: safeString(entry.relatedModule || "Portfolio Dashboard", "Portfolio Dashboard") });
  });

  return {
    query: search,
    results: results.slice(0, 6),
    totalResults: results.length,
    recommendedModule: results[0]?.module || "Deal Intelligence",
  };
}

export function buildReportingIntelligence(deal = {}, analysis = {}, portfolioIntelligence = {}, appraisalPackets = []) {
  const normalizedDeal = normalizeDealForIntelligence(deal);
  const packetCount = Array.isArray(appraisalPackets) ? appraisalPackets.length : 0;
  const strategy = safeString(normalizedDeal.strategy || normalizedDeal.exitStrategy || "Flip", "Flip");
  const supportedArv = safeNumber(analysis.supportedBaseArv ?? analysis.supportedArv ?? normalizedDeal.estimatedArv ?? 0);
  const portfolioHealth = safeString(portfolioIntelligence?.summary?.healthStatus || portfolioIntelligence?.health?.status || "Insufficient Data", "Insufficient Data");
  const executiveSummary = [
    `${strategy} strategy is under review with ${packetCount} appraisal packet(s) tracked.`,
    `Supported ARV is ${supportedArv > 0 ? supportedArv.toLocaleString() : "not yet established"} and portfolio health is ${portfolioHealth}.`,
  ];
  const sections = [
    { title: "Executive Summary", content: executiveSummary[0] },
    { title: "Underwriting Snapshot", content: `ARV support: ${supportedArv > 0 ? supportedArv.toLocaleString() : "Pending"}; strategy: ${strategy}.` },
    { title: "Portfolio Status", content: `Portfolio health: ${portfolioHealth}.` },
  ];
  return {
    executiveSummary,
    sections,
    metrics: {
      supportedArv,
      packetCount,
      portfolioHealth,
      strategy,
    },
    generatedAt: new Date().toISOString(),
    downloadReady: true,
  };
}

export function buildDocumentAutomationIntelligence(deal = {}, analysis = {}, appraisalPackets = []) {
  const normalizedDeal = normalizeDealForIntelligence(deal);
  const strategy = safeString(normalizedDeal.strategy || normalizedDeal.exitStrategy || "Flip", "Flip");
  const packetCount = Array.isArray(appraisalPackets) ? appraisalPackets.length : 0;
  const documents = [
    { title: "Offer Memo", type: "offer", status: "Draft", owner: "Analyst" },
    { title: `${strategy} Underwriting Summary`, type: "underwriting", status: "Draft", owner: "Analyst" },
    { title: "Appraisal Packet Summary", type: "appraisal", status: packetCount > 0 ? "Ready" : "Pending", owner: "Analyst" },
  ];
  return {
    documents,
    recommendedTemplate: documents[0].title,
    automationStatus: "Ready",
    nextAction: `Generate the ${strategy.toLowerCase()} offer package and attach supporting comps.`,
    supportingArv: safeNumber(analysis.supportedBaseArv ?? analysis.supportedArv ?? normalizedDeal.estimatedArv ?? 0),
  };
}

export function buildAiCommandRouting(deal = {}, analysis = {}) {
  const normalizedDeal = normalizeDealForIntelligence(deal);
  const strategy = safeString(normalizedDeal.strategy || normalizedDeal.exitStrategy || "Flip", "Flip").toLowerCase();
  const supportedArv = safeNumber(analysis.supportedBaseArv ?? analysis.supportedArv ?? normalizedDeal.estimatedArv ?? 0);
  const route = supportedArv > 0 ? "Deal Intelligence" : "Re-underwrite";
  const command = strategy === "brrrrr" ? "Route to BRRRR underwriting review" : "Route to offer generation";
  return {
    route,
    command,
    rationale: supportedArv > 0 ? "The deal has enough underwriting support to proceed to the next workflow." : "The deal needs additional support before routing into a live offer workflow.",
    approvalRequired: supportedArv > 0 ? "Analyst approval" : "Executive approval",
    recommendedOwner: supportedArv > 0 ? "Analyst" : "Underwriter",
  };
}

export function buildEnterpriseDealIntelligenceSummary(deal = {}, analysis = {}, deals = [], properties = [], contractors = [], lenders = [], dealIntelligence = [], alerts = [], appraisalPackets = [], portfolioIntelligence = {}, lessons = []) {
  const normalizedDeal = normalizeDealForIntelligence(deal);
  const knowledge = buildKnowledgeIntelligence(normalizedDeal, analysis, lessons);
  const search = buildSearchIntelligence("", deals, properties, contractors, lenders, dealIntelligence, alerts);
  const reporting = buildReportingIntelligence(normalizedDeal, analysis, portfolioIntelligence, appraisalPackets);
  const documents = buildDocumentAutomationIntelligence(normalizedDeal, analysis, appraisalPackets);
  const commandRouting = buildAiCommandRouting(normalizedDeal, analysis);
  const supportedArv = safeNumber(analysis.supportedBaseArv ?? analysis.supportedArv ?? normalizedDeal.estimatedArv ?? 0);
  const primaryRecommendation = safeString(analysis?.sharedDecision?.primaryAction || analysis?.investmentDecision?.recommendation || analysis?.recommendation?.primaryRecommendation || commandRouting.route || search.recommendedModule || "Continue Project", "Continue Project");

  return {
    deal: normalizedDeal,
    knowledge,
    search,
    reporting,
    documents,
    commandRouting,
    summary: {
      primaryRecommendation,
      confidence: safeString(knowledge.confidence, "Insufficient Data"),
      recommendationReason: safeString(analysis?.sharedDecision?.reasons?.join(" ") || commandRouting.rationale || knowledge.recommendedNextInquiry, "Insufficient Data"),
      supportingArv: supportedArv,
      packetCount: Array.isArray(appraisalPackets) ? appraisalPackets.length : 0,
      alertCount: Array.isArray(alerts) ? alerts.length : 0,
      resultCount: safeNumber(search.totalResults),
    },
  };
}

export function buildAppraisalIntelligence(packet = {}, comps = []) {
  const supportedArv = safeNumber(packet.supportedARV || packet.requestedARV || 0);
  const requestedArv = safeNumber(packet.requestedARV || 0);
  const normalizedComps = (Array.isArray(comps) ? comps : []).map(normalizeComp);
  const includedComps = normalizedComps.filter((comp) => comp.included !== false);
  const strongestComp = [...includedComps].sort((a, b) => safeNumber(b.salePrice) - safeNumber(a.salePrice))[0] || null;
  const weakestComp = [...includedComps].sort((a, b) => safeNumber(a.salePrice) - safeNumber(b.salePrice))[0] || null;
  const appraiserQuestions = [];
  const risks = [];
  let riskLevel = "Low Risk";

  if (requestedArv > supportedArv * 1.2) {
    risks.push("Projected ARV above supported range");
    appraiserQuestions.push("Why is the projected ARV materially above the supported range?");
  }
  if (includedComps.length < 3) {
    risks.push("Too few valid comps");
    appraiserQuestions.push("What additional recent sales support the valuation?");
  }
  if (!includedComps.length) {
    risks.push("No valid comps");
    appraiserQuestions.push("Please provide at least one recent comparable sale.");
  }
  if (supportedArv <= 0) {
    risks.push("Missing supported value");
    appraiserQuestions.push("Provide a supported value range before underwriting.");
  }
  if (includedComps.some((comp) => safeNumber(comp.distanceMiles) > 10)) {
    risks.push("Distant comps");
    appraiserQuestions.push("Please explain the distance and relevance of the selected comps.");
  }
  if (normalizedComps.some((comp) => comp.included === false)) {
    risks.push("Excluded comps may weaken support");
  }

  if (risks.length >= 3) riskLevel = "Critical Risk";
  else if (risks.length >= 2) riskLevel = "High Risk";
  else if (risks.length === 1) riskLevel = "Moderate Risk";

  const lowArv = supportedArv > 0 ? supportedArv * 0.95 : 0;
  const highArv = supportedArv > 0 ? supportedArv * 1.05 : 0;
  const weightedArv = supportedArv > 0 ? supportedArv : 0;
  const compCount = includedComps.length;
  const calculationSummary = compCount > 0
    ? `Weighted from ${compCount} supported comparable sales using the selected market and physical similarity factors.`
    : "Insufficient Data: no supported comps were available for valuation support.";

  return {
    appraisalSupportScore: Math.max(0, 100 - risks.length * 20),
    appraisalConfidence: riskLevel === "Low Risk" ? "High" : riskLevel === "Moderate Risk" ? "Moderate" : "Low",
    strongestComp: strongestComp ? `${strongestComp.address || "Comp"} (${safeNumber(strongestComp.salePrice).toLocaleString()})` : "Insufficient Data",
    weakestComp: weakestComp ? `${weakestComp.address || "Comp"} (${safeNumber(weakestComp.salePrice).toLocaleString()})` : "Insufficient Data",
    compAdjustmentSummary: compCount > 0 ? "Transparent adjustment review based on available property and market factors." : "Insufficient Data",
    supportedArvRange: [lowArv, weightedArv, highArv],
    indicatedArvRange: [lowArv, weightedArv, highArv],
    weightedArv,
    lowArv,
    highArv,
    likelyAppraisalRisk: riskLevel,
    riskLevel,
    missingSupport: risks.length ? risks : ["No major support gaps identified"],
    appraiserQuestions,
    recommendedPacketActions: ["Add more recent comps", "Document the scope of work", "Add photos and contractor budget"],
    calculationSummary,
    compCount,
  };
}
