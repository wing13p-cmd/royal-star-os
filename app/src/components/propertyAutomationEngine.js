const TEXT_ALIASES = {
  dealId: ["dealId", "id", "sourceDealId", "linkedDealId"],
  propertyId: ["propertyId", "linkedPropertyId"],
  address: ["propertyAddress", "address", "streetAddress", "property_name"],
  city: ["city", "City"],
  state: ["state", "State"],
  zip: ["zipCode", "zip", "postalCode"],
  propertyType: ["propertyType", "type"],
  paymentType: ["paymentType", "loanPaymentType", "debtPaymentType"],
  strategy: ["strategy", "exitStrategy", "preferredStrategy", "preferredExitStrategy"],
  status: ["status", "propertyStatus"],
  pipelineStage: ["pipelineStage"],
  leadSource: ["leadSource", "source"],
  notes: ["notes"],
};

const NUMBER_ALIASES = {
  bedrooms: ["bedrooms"], bathrooms: ["bathrooms"], squareFeet: ["squareFeet", "sqft"], yearBuilt: ["yearBuilt"],
  askingPrice: ["askingPrice", "listPrice"], purchasePrice: ["purchasePrice", "currentOfferPrice"],
  earnestMoney: ["earnestMoney"], closingCosts: ["closingCosts", "closingCost"], financingCosts: ["financingCosts", "financingCost"],
  initialCashInvested: ["initialCashInvested", "totalInitialCashInvested", "cashInvested"],
  actualLoanAmount: ["actualLoanAmount", "actualLoan", "loanAmount", "fundingAmount"], cashToClose: ["cashToClose", "cashToCloseAmount"],
  rehabBudget: ["rehabBudget", "repairBudget", "renovationBudget"], fundedRehab: ["fundedRehab", "rehabFunding", "rehabLoan"],
  holdingMonths: ["holdingMonths"], holdingCosts: ["holdingCosts", "totalHoldingCosts", "holdingCost"],
  constructionHoldback: ["constructionHoldback", "holdbackAmount", "constructionHoldbackAmount"],
  arv: ["estimatedArv", "arv", "projectedARV", "supportedARV", "supportedArv", "currentValue", "marketValue", "estimatedValue"],
  monthlyRent: ["monthlyRent", "estimatedRent", "marketRent", "projectedRent", "rent"],
  annualPropertyTaxes: ["annualPropertyTaxes", "annualTaxes", "taxes"], annualInsurance: ["annualInsurance", "insurance"],
  hoa: ["hoa", "monthlyHoa", "monthlyHOA"], vacancyPercentage: ["vacancyPercentage", "vacancyPercent"],
  maintenancePercentage: ["maintenancePercentage", "maintenancePercent"], capitalExpendituresPercentage: ["capitalExpendituresPercentage", "capexPercent", "capExPercentage"],
  propertyManagementPercentage: ["propertyManagementPercentage", "propertyManagementPercent"],
  monthlyUtilitiesPaidByOwner: ["monthlyUtilitiesPaidByOwner", "monthlyUtilities", "utilities"],
  otherMonthlyExpenses: ["otherMonthlyExpenses", "otherExpenses"], otherMonthlyIncome: ["otherMonthlyIncome", "otherIncome"],
  interestRate: ["interestRate", "annualInterestRate", "rate"], originationFee: ["originationFee", "originationFees"],
  underwritingFee: ["underwritingFee"], servicingFee: ["servicingFee"], lenderLegalFee: ["lenderLegalFee", "legalFee"],
  monitoringFee: ["monitoringFee"], otherLenderFees: ["otherLenderFees", "otherFees"],
  refinanceLtvPercentage: ["refinanceLtvPercentage", "refinanceLtvPercent"], refinanceInterestRate: ["refinanceInterestRate"],
  refinanceLoanTermYears: ["refinanceLoanTermYears"], refinanceClosingCosts: ["refinanceClosingCosts"],
  sellingCosts: ["sellingCosts", "sellingCost"], requiredProfit: ["requiredProfit", "minimumProfit", "targetProfit"],
};

const MODULES = ["dealAnalyzer", "dealIntelligence", "offerGenerator", "buyBox", "flipAnalyzer", "brrrrAnalyzer", "propertyDatabase", "appraisalIntelligence"];

function own(record, key) { return Object.prototype.hasOwnProperty.call(record, key); }
function pick(record, aliases) {
  for (const key of aliases) {
    if (!own(record, key)) continue;
    const value = record[key];
    if (value === undefined || value === null) continue;
    if (typeof value === "string" && value.trim() === "") continue;
    return value;
  }
  return undefined;
}
function text(value, fallback = "") {
  if (value === null || value === undefined) return fallback;
  const result = String(value).trim();
  return result || fallback;
}
function numberOrNull(value) {
  if (value === null || value === undefined || (typeof value === "string" && value.trim() === "")) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}
function normalizeStrategy(value) {
  const normalized = text(value).toLowerCase().replace(/[^a-z0-9]/g, "");
  if (["flip", "fixandflip", "fixflip"].includes(normalized)) return "Flip";
  if (["brrrr", "buyrehabrentrefinancerepeat", "rental", "hold", "appreciation"].includes(normalized)) return "BRRRR";
  return text(value);
}
function canonicalStage(value) {
  const raw = text(value, "Lead");
  const key = raw.toLowerCase().replace(/[^a-z0-9]/g, "");
  const stages = {
    lead: "Lead", newlead: "Lead", underwriting: "Underwriting", analysis: "Underwriting",
    offer: "Offer", offermade: "Offer", undercontract: "Under Contract", contract: "Under Contract",
    rehab: "Rehab", renovation: "Rehab", readyforappraisal: "Ready for Appraisal", appraisal: "Ready for Appraisal",
    refinance: "Refinance", listedforsale: "Listed for Sale", listed: "Listed for Sale", rented: "Rented",
    sold: "Sold", archived: "Archived",
  };
  return stages[key] || raw;
}
function hasRequiredNumber(value) { return Number.isFinite(value) && value > 0; }

export function normalizeCanonicalProperty(record = {}) {
  const canonical = { ...record };
  Object.entries(TEXT_ALIASES).forEach(([field, aliases]) => { canonical[field] = text(pick(record, aliases)); });
  Object.entries(NUMBER_ALIASES).forEach(([field, aliases]) => { canonical[field] = numberOrNull(pick(record, aliases)); });

  canonical.dealId = canonical.dealId || null;
  canonical.propertyId = canonical.propertyId || null;
  canonical.id = canonical.dealId || text(record.id) || canonical.propertyId || null;
  canonical.address = canonical.address || "";
  canonical.propertyAddress = canonical.address;
  canonical.state = canonical.state.toUpperCase();
  canonical.zip = canonical.zip.replace(/\.0$/, "").padStart(canonical.zip ? 5 : 0, "0");
  canonical.zipCode = canonical.zip;
  canonical.strategy = normalizeStrategy(canonical.strategy);
  canonical.exitStrategy = canonical.strategy;
  canonical.currentStage = canonicalStage(canonical.pipelineStage || canonical.status);
  canonical.pipelineStage = canonical.pipelineStage || canonical.currentStage;
  canonical.status = canonical.status || "Lead";

  // Canonical aliases retained for existing consumers. Explicit total holding cost is never multiplied by duration.
  canonical.estimatedArv = canonical.arv;
  canonical.projectedARV = canonical.arv;
  // Entered/projected ARV is not appraisal support. Preserve a supported value only when evidence supplied one explicitly.
  canonical.supportedARV = numberOrNull(pick(record, ["supportedARVApproved", "approvedArv", "supportedArv"]));
  canonical.estimatedRent = canonical.monthlyRent;
  canonical.taxes = canonical.annualPropertyTaxes;
  canonical.insurance = canonical.annualInsurance;
  canonical.annualInterestRate = canonical.interestRate;
  canonical.totalHoldingCosts = canonical.holdingCosts;
  canonical.totalInitialCashInvested = canonical.initialCashInvested;
  canonical.refinanceLtvPercent = canonical.refinanceLtvPercentage;
  canonical.vacancyPercent = canonical.vacancyPercentage;
  canonical.maintenancePercent = canonical.maintenancePercentage;
  canonical.capexPercent = canonical.capitalExpendituresPercentage;
  canonical.propertyManagementPercent = canonical.propertyManagementPercentage;
  canonical.monthlyUtilities = canonical.monthlyUtilitiesPaidByOwner;
  canonical.monthlyHoa = canonical.hoa;
  return canonical;
}

export function evaluatePropertyCompleteness(record = {}) {
  const property = normalizeCanonicalProperty(record);
  const missingCriticalData = [];
  [["address", "Property address"], ["city", "City"], ["state", "State"], ["zip", "ZIP"], ["propertyType", "Property type"]]
    .forEach(([field, label]) => { if (!property[field]) missingCriticalData.push({ field, reason: `${label} is required.` }); });
  [["purchasePrice", "Purchase price"], ["arv", "ARV"], ["rehabBudget", "Rehab budget"]]
    .forEach(([field, label]) => { if (!hasRequiredNumber(property[field])) missingCriticalData.push({ field, reason: `${label} is required for underwriting.` }); });
  if (!property.strategy) missingCriticalData.push({ field: "strategy", reason: "Strategy is required." });
  if (property.strategy === "BRRRR") {
    [["monthlyRent", "Monthly rent"], ["refinanceLtvPercentage", "Refinance LTV"]]
      .forEach(([field, label]) => { if (!hasRequiredNumber(property[field])) missingCriticalData.push({ field, reason: `${label} is required for BRRRR underwriting.` }); });
  }
  return {
    complete: missingCriticalData.length === 0,
    missingCriticalData,
    optionalZeroFieldsAccepted: ["earnestMoney", "hoa", "otherMonthlyIncome", "monthlyUtilitiesPaidByOwner", "otherMonthlyExpenses", "holdingCosts"],
  };
}

export function buildPropertyReadiness(record = {}) {
  const property = normalizeCanonicalProperty(record);
  const completeness = evaluatePropertyCompleteness(property);
  const stage = property.currentStage;
  let recommendedNextAction = "Complete Deal Intake";
  if (!hasRequiredNumber(property.arv)) recommendedNextAction = "Complete valuation and comparable-sales review";
  else if (!completeness.complete) recommendedNextAction = "Complete required underwriting inputs";
  else if (["Lead", "Underwriting"].includes(stage)) recommendedNextAction = "Review Buy Box and generate offer";
  else if (stage === "Offer") recommendedNextAction = "Review negotiation and contract status";
  else if (stage === "Under Contract") recommendedNextAction = property.strategy === "Flip" ? "Set up rehab project" : "Confirm acquisition and rehab plan";
  else if (stage === "Rehab") recommendedNextAction = "Update rehab progress and budget";
  else if (stage === "Ready for Appraisal") recommendedNextAction = property.strategy === "BRRRR" ? "Order appraisal and prepare refinance" : "Prepare listing and sale package";
  else if (stage === "Refinance") recommendedNextAction = "Complete refinance workflow";
  else if (stage === "Listed for Sale") recommendedNextAction = "Monitor listing and disposition";
  else if (["Rented", "Sold"].includes(stage)) recommendedNextAction = "Update portfolio and reporting records";
  else if (stage === "Archived") recommendedNextAction = "No active workflow action";

  return {
    currentStage: stage,
    recommendedNextAction,
    missingCriticalData: completeness.missingCriticalData,
    availableModules: property.id ? MODULES.slice() : [],
    warnings: property.id ? [] : ["No saved property is selected."],
  };
}

export function buildPropertyAutomation(record = {}, options = {}) {
  const property = normalizeCanonicalProperty(record);
  const readiness = buildPropertyReadiness(property);
  const moduleData = Object.fromEntries(MODULES.map((module) => [module, { ...property }]));
  const appraisalIntelligence = options.appraisalIntelligence || null;
  if (appraisalIntelligence) {
    moduleData.appraisalIntelligence = { ...property, appraisalIntelligence };
    if (["Ready for Appraisal", "Refinance"].includes(readiness.currentStage)) {
      readiness.recommendedNextAction = appraisalIntelligence.recommendedNextAction || readiness.recommendedNextAction;
      readiness.warnings = [...readiness.warnings, ...(appraisalIntelligence.warnings || [])];
    }
  }
  return {
    property,
    canonicalId: property.id,
    dealId: property.dealId,
    propertyId: property.propertyId,
    strategy: property.strategy,
    moduleData,
    readiness,
    appraisalIntelligence,
  };
}

export function selectCanonicalProperty(records = [], selectedId = "") {
  if (!selectedId) return null;
  const matches = (Array.isArray(records) ? records : []).filter((record) => {
    const property = normalizeCanonicalProperty(record);
    return [property.id, property.dealId, property.propertyId].filter(Boolean).some((id) => String(id) === String(selectedId));
  });
  return matches.length === 1 ? buildPropertyAutomation(matches[0]) : null;
}
