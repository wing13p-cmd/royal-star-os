function safeNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function safeDisplay(value, fallback = "Insufficient Data") {
  if (value === null || value === undefined || value === "" || Number.isNaN(value)) return fallback;
  if (typeof value === "number" && !Number.isFinite(value)) return fallback;
  return value;
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

function scoreComp(comp, subject) {
  const recencyDays = getDaysSinceSale(comp.saleDate) ?? 1825;
  const recencyScore = Math.max(0, Math.min(1, 1 - recencyDays / 1800));
  const distanceScore = comp.distanceMiles ? Math.max(0, Math.min(1, 1 - comp.distanceMiles / 15)) : 0.65;
  const sqftScore = subject.squareFeet > 0 && comp.squareFeet > 0 ? Math.max(0, 1 - Math.abs(comp.squareFeet - subject.squareFeet) / Math.max(subject.squareFeet, 1)) : 0.65;
  const bedroomScore = subject.bedrooms > 0 && comp.bedrooms > 0 ? Math.max(0, 1 - Math.abs(comp.bedrooms - subject.bedrooms) / Math.max(subject.bedrooms, 1)) : 0.65;
  const bathroomScore = subject.bathrooms > 0 && comp.bathrooms > 0 ? Math.max(0, 1 - Math.abs(comp.bathrooms - subject.bathrooms) / Math.max(subject.bathrooms, 1)) : 0.65;
  const yearBuiltScore = subject.yearBuilt > 0 && comp.yearBuilt > 0 ? Math.max(0, 1 - Math.abs(comp.yearBuilt - subject.yearBuilt) / Math.max(subject.yearBuilt, 1)) : 0.65;
  const conditionScore = getConditionSimilarity(comp.condition, subject.condition);
  const completeness = [comp.salePrice > 0, comp.squareFeet > 0, comp.bedrooms > 0, comp.bathrooms > 0, comp.saleDate !== "Insufficient Data"].filter(Boolean).length / 5;

  const weightedScore = recencyScore * 0.18 + distanceScore * 0.2 + sqftScore * 0.18 + bedroomScore * 0.12 + bathroomScore * 0.12 + yearBuiltScore * 0.1 + conditionScore * 0.1 + completeness * 0.1;
  return Math.max(0, Math.min(100, weightedScore * 100));
}

export function buildArvIntelligence(deal = {}, comps = [], neighborhoods = []) {
  const subject = normalizeSubject(deal);
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
    };
  });

  const primaryComps = compEvaluations.filter((item) => item.status === "Primary Comp");
  const supportingComps = compEvaluations.filter((item) => item.status === "Supporting Comp");
  const includedComps = [...primaryComps, ...supportingComps];
  const adjustedSalePrices = includedComps.map((item) => item.adjustedSalePrice || 0).filter((value) => value > 0);
  const weightedAdjustedArv = adjustedSalePrices.length ? adjustedSalePrices.reduce((sum, value) => sum + value, 0) / adjustedSalePrices.length : 0;
  const lowArv = weightedAdjustedArv > 0 ? weightedAdjustedArv * 0.95 : 0;
  const baseArv = weightedAdjustedArv > 0 ? weightedAdjustedArv : 0;
  const highArv = weightedAdjustedArv > 0 ? weightedAdjustedArv * 1.05 : 0;
  const spread = baseArv > 0 ? (highArv - lowArv) / baseArv : 0;

  let confidenceLevel = "Insufficient Data";
  if (includedComps.length >= 3 && spread <= 0.12 && primaryComps.length >= 2) confidenceLevel = "High";
  else if (includedComps.length >= 2) confidenceLevel = "Moderate";
  else if (includedComps.length === 1) confidenceLevel = "Low";

  const strongestComp = [...compEvaluations].sort((a, b) => b.qualityScore - a.qualityScore)[0] || null;
  const weakestComp = [...compEvaluations].sort((a, b) => a.qualityScore - b.qualityScore)[0] || null;
  const explanation = {
    whySelected: includedComps.length ? "The selected comps align on property type, ZIP, and basic physical characteristics." : "No qualifying comps were available.",
    whyExcluded: compEvaluations.filter((item) => item.status === "Weak Comp").length ? "More distant or stale comps were downgraded due to reduced similarity." : "No comps were excluded beyond the eligibility filter.",
    strongestSupportingComp: strongestComp ? `${strongestComp.address} (${strongestComp.qualityScore.toFixed(0)} quality score)` : "Insufficient Data",
    weakestIncludedComp: weakestComp ? `${weakestComp.address} (${weakestComp.qualityScore.toFixed(0)} quality score)` : "Insufficient Data",
    largestAdjustment: "Insufficient Data",
    primaryUncertainty: includedComps.length ? "Limited comp count or weaker similarity can reduce confidence." : "No supported comp data is available.",
    informationNeeded: includedComps.length ? ["Additional recent sales", "More complete comp details", "Neighborhood support"] : ["At least one reliable comp", "Sale pricing", "Property-level characteristics"],
  };

  return {
    subject,
    compEvaluations,
    supportedLowArv: lowArv,
    supportedBaseArv: baseArv,
    supportedHighArv: highArv,
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
  const propertyTypeAllowed = !prohibitedPropertyTypes.includes(normalizedPropertyType) && !["vacant land", "land"].includes(normalizedPropertyType);
  const locatedInTarget = targetMarkets.includes(normalizedZip) || /covington|cincinnati/i.test(`${subject.city} ${subject.state}`);

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

  const propertyTypeScore = propertyTypeAllowed ? 90 : 0;
  const locationScore = locatedInTarget ? 95 : 20;
  const sizeScore = subject.squareFeet > 1800 ? 45 : 80;
  const ageScore = subject.yearBuilt >= 1950 ? 85 : 65;
  const rehabScore = rehabBudget <= 60000 ? 85 : 35;
  const rentalScore = normalizedNeighborhoods.some((entry) => String(entry.neighborhoodName || entry.name || "").toLowerCase().includes("cincinnati") || String(entry.city || "").toLowerCase().includes("covington")) ? 80 : 60;
  const appreciationScore = 75;
  const financingScore = 70;
  const exitScore = 75;
  const overallScore = Math.round((locationScore + propertyTypeScore + sizeScore + ageScore + rehabScore + rentalScore + appreciationScore + financingScore + exitScore) / 9);

  let decision = "Insufficient Data";
  if (!propertyTypeAllowed) decision = "Automatic Reject";
  else if (rulesFailed.length === 0 && conditionalRules.length === 0) decision = "Strong Pass";
  else if (rulesFailed.length <= 1) decision = "Pass";
  else if (rulesFailed.length <= 2) decision = "Conditional Pass";
  else if (rulesFailed.some((rule) => rule.includes("ZIP"))) decision = "Selective Area Review";
  else decision = "Outside Buy Box";

  return {
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
    rentalScore,
    appreciationScore,
    financingScore,
    exitScore,
    overallScore,
    decisionBreakingRule: rulesFailed.find((rule) => rule.includes("property type")) || rulesFailed[0] || "None",
    exceptionJustification: propertyTypeAllowed ? "The property fits the stated target market and rehab preferences." : "Prohibited property types are automatically rejected.",
    informationNeeded: propertyTypeAllowed ? ["Neighborhood demand", "Recent comparable sales", "Rehab scope"] : ["Use an eligible property type"],
  };
}

export function buildOfferIntelligence(deal = {}, arv = {}, buyBox = {}, financing = {}) {
  const askingPrice = safeNumber(deal.askingPrice || deal.purchasePrice);
  const currentPurchasePrice = safeNumber(deal.purchasePrice || deal.askingPrice);
  const rehabBudget = safeNumber(deal.rehabBudget);
  const contingency = safeNumber(deal.contingency || rehabBudget * 0.1);
  const sellingCosts = safeNumber(deal.sellingCosts || 0.08 * safeNumber(arv.supportedBaseArv || arv.supportedLowArv || arv.weightedAdjustedArv || 0));
  const financingCost = safeNumber(deal.financingCosts || financing.loanAmount * 0.02 || 0);
  const holdCosts = safeNumber(deal.holdingCosts || 0);
  const profitTarget = safeNumber(deal.requiredProfit || 30000);
  const strategy = String(deal.strategy || "Flip").toLowerCase();
  const supportedArv = safeNumber(arv.supportedBaseArv || arv.weightedAdjustedArv || 0);
  const mao = Math.max(0, supportedArv - rehabBudget - contingency - sellingCosts - financingCost - holdCosts - profitTarget);
  const riskAdjustedMao = Math.max(0, mao * (arv.confidenceLevel === "High" ? 1 : arv.confidenceLevel === "Moderate" ? 0.9 : 0.8));
  const recommendedOpeningOffer = Math.min(Math.max(0, riskAdjustedMao * 0.9), currentPurchasePrice);
  const targetOffer = Math.min(Math.max(0, riskAdjustedMao), currentPurchasePrice);
  const walkAwayPrice = Math.min(Math.max(0, riskAdjustedMao * 0.95), currentPurchasePrice);
  const maximumOffer = Math.min(Math.max(0, riskAdjustedMao * 1.05), currentPurchasePrice, walkAwayPrice);
  const offerRange = [recommendedOpeningOffer, targetOffer, maximumOffer, walkAwayPrice];
  const offerPositions = [
    { label: "Opening", amount: recommendedOpeningOffer },
    { label: "Target", amount: targetOffer },
    { label: "Maximum", amount: maximumOffer },
    { label: "Walk Away", amount: walkAwayPrice },
  ];

  return {
    askingPrice,
    currentPurchasePrice,
    strategyMao: mao,
    riskAdjustedMao,
    recommendedOpeningOffer,
    targetOffer,
    maximumOffer,
    walkAwayPrice,
    priceReductionNeeded: Math.max(0, currentPurchasePrice - walkAwayPrice),
    offerRange,
    sellerDiscountRequired: Math.max(0, currentPurchasePrice - targetOffer),
    estimatedCashRequired: Math.max(0, currentPurchasePrice - safeNumber(financing.loanAmount)),
    expectedProfitAtEachOffer: offerPositions.map((position) => ({ ...position, expectedProfit: Math.max(0, supportedArv - rehabBudget - contingency - sellingCosts - position.amount) })),
    expectedRoiAtEachOffer: offerPositions.map((position) => ({ ...position, expectedRoi: position.amount > 0 ? (supportedArv - rehabBudget - contingency - sellingCosts - position.amount) / position.amount : 0 })),
    recommendationAtEachOffer: offerPositions.map((position) => ({ ...position, recommendation: position.amount <= walkAwayPrice ? "Proceed" : "Do not proceed" })),
    offerPositions,
    negotiationSupport: {
      mainPriceJustification: `The supported ARV of ${supportedArv} supports a disciplined offer based on rehab and carrying costs.`,
      strongestSupportingNumber: String(supportedArv),
      negotiationPoints: ["Rehab scope is within planned thresholds", "Comp support is present", "Holding costs are manageable"],
      concessionOptions: ["Flexible closing date", "Limited repair credit", "Quick inspection turnaround"],
      conditionsBeforeIncreasingOffer: ["More complete inspection", "Stronger comp support", "Lower rehab scope"],
      informationRequired: ["Inspection findings", "Seller motivation", "Title and permit status"],
    },
    offerSummary: {
      property: deal.propertyAddress || deal.address || "Insufficient Data",
      offerAmount: targetOffer,
      financingMethod: financing.loanAmount > 0 ? "Financed" : "Cash",
      earnestMoney: Math.min(5000, Math.max(1000, targetOffer * 0.01)),
      inspectionPeriod: "7 days",
      closingTarget: "30 days",
      contingencies: ["Inspection", "Financing if needed"],
      majorAssumptions: ["ARV support remains intact", "Rehab scope stays within budget"],
      requiredApprovals: ["Analyst review", "Underwriter review"],
      supportingAnalysis: ["ARV support", "Buy Box result", "Rehab assumptions"],
      expirationStatus: "Open",
      analystNotes: `Offer aligned to ${buyBox.decision || "Insufficient Data"} buy-box guidance.`,
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

  return {
    appraisalSupportScore: Math.max(0, 100 - risks.length * 20),
    appraisalConfidence: riskLevel === "Low Risk" ? "High" : riskLevel === "Moderate Risk" ? "Moderate" : "Low",
    strongestComp: strongestComp ? `${strongestComp.address || "Comp"} (${safeNumber(strongestComp.salePrice).toLocaleString()})` : "Insufficient Data",
    weakestComp: weakestComp ? `${weakestComp.address || "Comp"} (${safeNumber(weakestComp.salePrice).toLocaleString()})` : "Insufficient Data",
    compAdjustmentSummary: "No unsupported adjustments were applied.",
    supportedArvRange: [supportedArv * 0.95, supportedArv, supportedArv * 1.05],
    likelyAppraisalRisk: riskLevel,
    riskLevel,
    missingSupport: risks.length ? risks : ["No major support gaps identified"],
    appraiserQuestions,
    recommendedPacketActions: ["Add more recent comps", "Document the scope of work", "Add photos and contractor budget"],
  };
}
