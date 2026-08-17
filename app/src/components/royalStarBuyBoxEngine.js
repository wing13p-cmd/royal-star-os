const PRIMARY_ZIPS = new Set(["41011", "41014", "45211", "45224", "45239"]);
const SELECTIVE_ZIPS = new Set(["41015", "41016", "41017", "45205", "45238", "45231", "45223", "45232"]);

function optionalNumber(value) {
  if (value === "" || value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function normalizeBuyBoxZip(value) {
  const digits = String(value ?? "").trim().match(/\d/g)?.join("") || "";
  if (!digits) return "";
  return digits.length >= 5 ? digits.slice(0, 5) : digits.padStart(5, "0");
}

export function normalizeBuyBoxPropertyType(value, unitsValue) {
  const raw = String(value ?? "").trim().toLowerCase().replace(/[_/]+/g, " ").replace(/-/g, " ").replace(/\s+/g, " ");
  const units = optionalNumber(unitsValue);
  if (units != null && units >= 5) return "5+ units";
  if (/^(sfh|sfr|single family|single family home|detached single family|1 family|one family)$/.test(raw)) return "single-family";
  if (/^(duplex|2 family|two family|2 unit|two unit)$/.test(raw)) return "duplex";
  if (/^(triplex|3 family|three family|3 unit|three unit)$/.test(raw)) return "triplex";
  if (/^(fourplex|quadplex|4 family|four family|4 unit|four unit|2 4 unit|2 to 4 units?)$/.test(raw)) return "fourplex";
  if (/^(mobile home park|mobile homes?|rv park|storage|self storage|vacant land|land)$/.test(raw)) return raw || "unsupported";
  if (/\b([5-9]|\d{2,})\s*(unit|family)/.test(raw)) return "5+ units";
  return raw;
}

function normalizeStrategy(value) {
  const raw = String(value ?? "").trim().toLowerCase().replace(/[_-]+/g, " ");
  if (/brrrr/.test(raw)) return "BRRRR";
  if (/flip|fix and flip/.test(raw)) return "FLIP";
  if (/appreciation|long term hold|long term rental|rental|hold/.test(raw)) return "APPRECIATION";
  return raw ? raw.toUpperCase() : "";
}

function offerNumber(offer, ...paths) {
  for (const path of paths) {
    const value = path.split(".").reduce((current, key) => current?.[key], offer);
    const parsed = optionalNumber(value);
    if (parsed != null) return parsed;
  }
  return null;
}

export function evaluateRoyalStarBuyBox(deal = {}, context = {}) {
  const offer = context.offer || context.offerAnalysis || {};
  const zip = normalizeBuyBoxZip(deal.zipCode ?? deal.zip ?? deal.postalCode);
  const propertyType = normalizeBuyBoxPropertyType(deal.propertyType ?? deal.type, deal.units ?? deal.unitCount ?? deal.numberOfUnits);
  const squareFeet = optionalNumber(deal.squareFeet ?? deal.sqft);
  const yearBuilt = optionalNumber(deal.yearBuilt);
  const rehabBudget = optionalNumber(deal.rehabBudget ?? deal.repairBudget);
  const arv = optionalNumber(context.baseArv ?? context.arvAnalysis?.supportedBaseArv ?? deal.estimatedArv ?? deal.arv ?? deal.projectedARV);
  const purchasePrice = optionalNumber(deal.purchasePrice ?? deal.askingPrice ?? deal.listPrice);
  const strategy = normalizeStrategy(deal.strategy ?? deal.exitStrategy);
  const maximumOffer = offerNumber(offer, "maximumOffer", "maximumAllowableOffer", "walkAwayPrice");
  const walkAwayPrice = offerNumber(offer, "walkAwayPrice", "maximumOffer", "maximumAllowableOffer");
  const targetOffer = offerNumber(offer, "targetOffer", "recommendedOffer");
  const downsideMao = offerNumber(offer, "sensitivity.worst.maximumAllowableOffer", "downsideMaximumOffer", "downsideMao");
  const explicitHoldingCosts = optionalNumber(offer.assumptions?.explicitHoldingCosts ?? deal.totalHoldingCosts ?? deal.holdingCosts ?? deal.holdingCost) ?? 0;
  const passedRules = [];
  const reviewRules = [];
  const failedRules = [];

  const pass = (message) => passedRules.push(message);
  const review = (message) => reviewRules.push(message);
  const fail = (message) => failedRules.push(message);

  const marketClassification = PRIMARY_ZIPS.has(zip) ? "PRIMARY" : SELECTIVE_ZIPS.has(zip) ? "SELECTIVE" : "OUTSIDE";
  if (marketClassification === "PRIMARY") pass(`ZIP ${zip} is in a Royal Star primary market.`);
  else if (marketClassification === "SELECTIVE") review(`ZIP ${zip} is a selective Royal Star market and requires review.`);
  else fail(zip ? `ZIP ${zip} is outside the Royal Star geographic buy box.` : "ZIP code is missing or invalid.");

  if (["single-family", "duplex", "triplex", "fourplex"].includes(propertyType)) pass(`Property type ${propertyType} is supported.`);
  else if (!propertyType) review("Property type is missing and requires confirmation.");
  else fail(`Unsupported property type: ${propertyType}.`);

  if (squareFeet == null) review("Square footage is missing and requires confirmation.");
  else if (squareFeet <= 1800) pass("Square footage is within the preferred 1,800 sq ft limit.");
  else review("Square footage exceeds the preferred 1,800 sq ft limit.");

  if (yearBuilt == null) review("Year built is missing and requires confirmation.");
  else if (yearBuilt >= 1950) pass("Year built meets the 1950-or-newer preference.");
  else review("Property was built before 1950 and requires review.");

  if (rehabBudget == null) review("Rehab budget is missing and requires confirmation.");
  else if (rehabBudget <= 60000) pass("Rehab budget is within the preferred $60,000 limit.");
  else if (rehabBudget <= 100000) review("Rehab budget is between $60,001 and $100,000.");
  else fail("Rehab budget exceeds the $100,000 hard limit.");

  if (arv == null || arv <= 0) review("ARV is missing or invalid and requires confirmation.");
  else if (arv < 150000) review("Projected/entered ARV is below the $150,000 Royal Star target range; this does not establish independent valuation support.");
  else if (arv > 400000) review("Projected/entered ARV is above the $400,000 Royal Star target range; this does not establish independent valuation support.");
  else pass("Projected/entered ARV is within the $150,000-$400,000 target range; independent valuation support is evaluated separately.");

  if (["BRRRR", "FLIP", "APPRECIATION"].includes(strategy)) pass(`${strategy} is a supported Royal Star strategy.`);
  else if (!strategy) review("Strategy is missing and requires confirmation.");
  else review(`Strategy ${strategy} requires manual review.`);

  const offerIncomplete = String(offer.recommendation || offer.decision || "").toUpperCase() === "INCOMPLETE";
  if (offerIncomplete) review("Offer underwriting is incomplete and requires additional inputs.");
  else {
    if (maximumOffer != null && maximumOffer <= 0) fail("Maximum allowable offer is zero or economically unsupported.");
    if (purchasePrice != null && walkAwayPrice != null && purchasePrice > walkAwayPrice) fail("Current purchase price exceeds the walk-away price.");
    else if (purchasePrice != null && maximumOffer != null && purchasePrice > maximumOffer) fail("Current purchase price exceeds the maximum allowable offer.");
    else if (purchasePrice != null && downsideMao != null && purchasePrice > downsideMao) review("Downside ARV does not support the current purchase price.");
    else if (purchasePrice != null && downsideMao != null) pass("Current purchase price is supported by the downside MAO.");
  }

  const independentHardStops = Array.isArray(offer.hardStopReasons)
    ? offer.hardStopReasons.filter((reason) => !/buy box/i.test(String(reason)))
    : [];
  independentHardStops.forEach((reason) => {
    if (!failedRules.includes(String(reason))) fail(String(reason));
  });
  const independentReviews = Array.isArray(offer.reviewReasons)
    ? offer.reviewReasons.filter((reason) => !/buy box/i.test(String(reason)) && !reviewRules.includes(String(reason)))
    : [];
  independentReviews.forEach((reason) => {
    if (!reviewRules.includes(String(reason))) review(String(reason));
  });

  const status = failedRules.length ? "FAIL" : reviewRules.length ? "REVIEW" : "PASS";
  const score = Math.max(0, Math.min(100, 100 - reviewRules.length * 7 - failedRules.length * 25));
  const reasons = [...failedRules, ...reviewRules, ...passedRules];
  const decision = status === "FAIL" ? "Automatic Reject" : status === "REVIEW" ? "Conditional Pass" : "Pass";

  return {
    status,
    result: status,
    decision,
    score,
    overallScore: score,
    propertyLevelScore: score,
    marketScore: marketClassification === "PRIMARY" ? 100 : marketClassification === "SELECTIVE" ? 70 : 0,
    neighborhoodScore: marketClassification === "PRIMARY" ? 100 : marketClassification === "SELECTIVE" ? 70 : 0,
    marketClassification,
    market: zip.startsWith("410") ? "Covington" : zip.startsWith("452") ? "Cincinnati" : "Outside",
    normalizedZip: zip,
    normalizedPropertyType: propertyType,
    normalizedStrategy: strategy,
    reasons,
    passedRules,
    reviewRules,
    failedRules,
    rulesPassed: passedRules,
    conditionalRules: reviewRules,
    rulesFailed: failedRules,
    decisionBreakingRule: failedRules[0] || reviewRules[0] || "None",
    exceptionJustification: reasons[0] || "All Royal Star buy box rules passed.",
    reviewRequired: status === "REVIEW",
    explicitHoldingCosts,
    currentPurchasePrice: purchasePrice,
    maximumAllowableOffer: maximumOffer,
    targetOffer,
    walkAwayPrice,
    downsideMaximumAllowableOffer: downsideMao,
    scoringBreakdown: [
      { category: "Baseline", factor: "Eligible-deal baseline", points: 100, rationale: "Buy Box scoring begins at 100 before review and failure penalties." },
      ...failedRules.map((reason, index) => ({ category: "FAIL", factor: `Failed rule ${index + 1}`, points: -25, rationale: reason })),
      ...reviewRules.map((reason, index) => ({ category: "REVIEW", factor: `Review rule ${index + 1}`, points: -7, rationale: reason })),
      ...passedRules.map((reason, index) => ({ category: "PASS", factor: `Passed rule ${index + 1}`, points: 0, rationale: reason })),
    ],
    informationNeeded: reviewRules,
  };
}

export const ROYAL_STAR_BUY_BOX_POLICY = Object.freeze({
  primaryZips: [...PRIMARY_ZIPS],
  selectiveZips: [...SELECTIVE_ZIPS],
  allowedPropertyTypes: ["single-family", "duplex", "triplex", "fourplex"],
  preferredMaxSquareFeet: 1800,
  preferredMinimumYearBuilt: 1950,
  preferredRehabMax: 60000,
  hardRehabMax: 100000,
  targetArvMin: 150000,
  targetArvMax: 400000,
});
