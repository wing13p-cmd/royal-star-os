function safeString(value, fallback = "") {
  if (value === null || value === undefined) return fallback;
  if (typeof value === "string") return value;
  return String(value);
}

function safeTrimmedString(value, fallback = null) {
  if (value === null || value === undefined) return fallback;
  const parsed = safeString(value, "").trim();
  return parsed === "" ? fallback : parsed;
}

function safeNumber(value, fallback = null) {
  if (value === null || value === undefined || value === "") return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function safeBoolean(value, fallback = false) {
  if (value === null || value === undefined) return fallback;
  return Boolean(value);
}

function normalizeDateString(value) {
  const parsed = safeTrimmedString(value, null);
  if (!parsed) return null;
  const stamp = Date.parse(parsed);
  if (!Number.isFinite(stamp)) return parsed;
  // Keep valid stored dates exactly as provided to avoid mutating historical values.
  return parsed;
}

function normalizeState(value) {
  const parsed = safeTrimmedString(value, null);
  return parsed ? parsed.toUpperCase() : null;
}

function normalizeZip(value) {
  const parsed = safeTrimmedString(value, null);
  if (!parsed) return null;
  const numeric = parsed.replace(/[^0-9-]/g, "");
  return numeric || parsed;
}

function normalizeAddressForMatch(value) {
  return safeString(value, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[^a-z0-9\s]/g, "")
    .trim();
}

function nowIso() {
  return new Date().toISOString();
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function pickValue(record = {}, candidates = [], fallback = null) {
  for (const key of candidates) {
    if (Object.prototype.hasOwnProperty.call(record, key)) {
      const value = record[key];
      if (value !== undefined) return value;
    }
  }
  return fallback;
}

function createBaseCanonical(record = {}, sourceModule = "UNKNOWN") {
  const entityId = safeTrimmedString(pickValue(record, ["dealId", "id", "propertyId", "portfolioId"]), null);
  return {
    id: entityId,
    dealId: safeTrimmedString(pickValue(record, ["dealId", "linkedDealId", "sourceDealId"]), null),
    portfolioId: safeTrimmedString(pickValue(record, ["portfolioId", "linkedPortfolioId"]), null),
    propertyName: safeTrimmedString(pickValue(record, ["propertyName", "name"]), null),
    address: safeTrimmedString(pickValue(record, ["address", "propertyAddress", "streetAddress"]), null),
    city: safeTrimmedString(pickValue(record, ["city", "City"]), null),
    state: normalizeState(pickValue(record, ["state", "State"])),
    zipCode: normalizeZip(pickValue(record, ["zipCode", "zip", "postalCode"])),
    county: safeTrimmedString(pickValue(record, ["county"]), null),
    propertyType: safeTrimmedString(pickValue(record, ["propertyType", "type"]), null),
    bedrooms: safeNumber(pickValue(record, ["bedrooms"]), null),
    bathrooms: safeNumber(pickValue(record, ["bathrooms"]), null),
    squareFeet: safeNumber(pickValue(record, ["squareFeet", "sqft"]), null),
    yearBuilt: safeNumber(pickValue(record, ["yearBuilt"]), null),

    askingPrice: safeNumber(pickValue(record, ["askingPrice", "listPrice"]), null),
    purchasePrice: safeNumber(pickValue(record, ["purchasePrice"]), null),
    rehabBudget: safeNumber(pickValue(record, ["rehabBudget"]), null),
    arv: safeNumber(pickValue(record, ["arv", "estimatedArv", "supportedARV", "supportedArv"]), null),
    estimatedRent: safeNumber(pickValue(record, ["estimatedRent", "marketRent"]), null),
    taxes: safeNumber(pickValue(record, ["taxes", "annualTaxes"]), null),
    insurance: safeNumber(pickValue(record, ["insurance", "annualInsurance"]), null),
    financingCosts: safeNumber(pickValue(record, ["financingCosts"]), null),
    closingCosts: safeNumber(pickValue(record, ["closingCosts"]), null),
    holdingMonths: safeNumber(pickValue(record, ["holdingMonths"]), null),
    holdingCosts: safeNumber(pickValue(record, ["totalHoldingCosts", "holdingCosts", "holdingCost"]), null),
    earnestMoney: safeNumber(pickValue(record, ["earnestMoney"]), null),
    initialCashInvested: safeNumber(pickValue(record, ["initialCashInvested", "totalInitialCashInvested", "cashInvested"]), null),
    cashToClose: safeNumber(pickValue(record, ["cashToClose", "cashToCloseAmount"]), null),
    fundedRehab: safeNumber(pickValue(record, ["fundedRehab", "rehabFunding", "rehabLoan"]), null),
    constructionHoldback: safeNumber(pickValue(record, ["constructionHoldback", "holdbackAmount"]), null),
    leadSource: safeTrimmedString(pickValue(record, ["leadSource"]), null),
    exitStrategy: safeTrimmedString(pickValue(record, ["exitStrategy"]), null),
    strategy: safeTrimmedString(pickValue(record, ["strategy"]), null),
    status: safeTrimmedString(pickValue(record, ["status", "propertyStatus"]), null),
    notes: safeTrimmedString(pickValue(record, ["notes"]), null),

    loanBalance: safeNumber(pickValue(record, ["loanBalance", "currentLoanBalance"]), null),
    loanAmount: safeNumber(pickValue(record, ["loanAmount", "actualLoanAmount", "originalLoanAmount"]), null),
    interestRate: safeNumber(pickValue(record, ["interestRate", "annualInterestRate"]), null),
    monthlyDebtService: safeNumber(pickValue(record, ["monthlyDebtService", "monthlyPayment"]), null),
    loanMaturityDate: normalizeDateString(pickValue(record, ["loanMaturityDate"])),
    lenderId: safeTrimmedString(pickValue(record, ["lenderId"]), null),

    currentValue: safeNumber(pickValue(record, ["currentValue"]), null),
    monthlyRent: safeNumber(pickValue(record, ["monthlyRent"]), null),
    hoa: safeNumber(pickValue(record, ["hoa", "monthlyHoa"]), null),
    vacancyPercentage: safeNumber(pickValue(record, ["vacancyPercentage", "vacancyPercent"]), null),
    maintenancePercentage: safeNumber(pickValue(record, ["maintenancePercentage", "maintenancePercent"]), null),
    capitalExpendituresPercentage: safeNumber(pickValue(record, ["capitalExpendituresPercentage", "capexPercent"]), null),
    propertyManagementPercentage: safeNumber(pickValue(record, ["propertyManagementPercentage", "propertyManagementPercent"]), null),
    monthlyUtilitiesPaidByOwner: safeNumber(pickValue(record, ["monthlyUtilitiesPaidByOwner", "monthlyUtilities"]), null),
    otherMonthlyExpenses: safeNumber(pickValue(record, ["otherMonthlyExpenses"]), null),
    refinanceLtvPercentage: safeNumber(pickValue(record, ["refinanceLtvPercentage", "refinanceLtvPercent"]), null),
    refinanceInterestRate: safeNumber(pickValue(record, ["refinanceInterestRate"]), null),
    refinanceLoanTermYears: safeNumber(pickValue(record, ["refinanceLoanTermYears"]), null),
    refinanceClosingCosts: safeNumber(pickValue(record, ["refinanceClosingCosts"]), null),
    operatingExpenses: safeNumber(pickValue(record, ["operatingExpenses", "monthlyOperatingExpenses"]), null),
    occupancyRate: safeNumber(pickValue(record, ["occupancyRate"]), null),
    acquisitionDate: normalizeDateString(pickValue(record, ["acquisitionDate", "closingDate"])),
    annualTaxes: safeNumber(pickValue(record, ["annualPropertyTaxes", "annualTaxes", "taxes"]), null),
    annualInsurance: safeNumber(pickValue(record, ["annualInsurance", "insurance"]), null),
    favorite: safeBoolean(pickValue(record, ["favorite"], false), false),

    sourceModule: safeTrimmedString(pickValue(record, ["sourceModule"]), sourceModule),
    sourceRecordId: safeTrimmedString(pickValue(record, ["sourceRecordId", "id"]), null),
    syncStatus: safeTrimmedString(pickValue(record, ["syncStatus"]), "NOT_SYNCED"),
    syncVersion: safeNumber(pickValue(record, ["syncVersion"]), 1),
    lastSyncedAt: normalizeDateString(pickValue(record, ["lastSyncedAt"])),
    createdAt: normalizeDateString(pickValue(record, ["createdAt"])),
    updatedAt: normalizeDateString(pickValue(record, ["updatedAt"])),
    approvedFields: Array.isArray(record.approvedFields) ? record.approvedFields.slice() : [],
    protectedFields: Array.isArray(record.protectedFields) ? record.protectedFields.slice() : [],
    auditMetadata: record.auditMetadata && typeof record.auditMetadata === "object" ? clone(record.auditMetadata) : {},
  };
}

export function normalizeDealRecord(record = {}) {
  const canonical = createBaseCanonical(record, "Deal Analyzer");
  if (!canonical.dealId) canonical.dealId = safeTrimmedString(record.id, null);
  return canonical;
}

export function normalizePortfolioRecord(record = {}) {
  const canonical = createBaseCanonical(record, "Portfolio Dashboard");
  if (!canonical.portfolioId) canonical.portfolioId = safeTrimmedString(record.id, null);
  return canonical;
}

export function dealToCanonical(record = {}) {
  return normalizeDealRecord(record);
}

export function portfolioToCanonical(record = {}) {
  return normalizePortfolioRecord(record);
}

export function canonicalToDeal(record = {}) {
  const canonical = normalizeDealRecord(record);
  return {
    id: canonical.dealId || canonical.id,
    propertyAddress: canonical.address,
    city: canonical.city,
    state: canonical.state,
    zipCode: canonical.zipCode,
    county: canonical.county,
    propertyType: canonical.propertyType,
    bedrooms: canonical.bedrooms,
    bathrooms: canonical.bathrooms,
    squareFeet: canonical.squareFeet,
    yearBuilt: canonical.yearBuilt,
    askingPrice: canonical.askingPrice,
    purchasePrice: canonical.purchasePrice,
    rehabBudget: canonical.rehabBudget,
    estimatedArv: canonical.arv,
    estimatedRent: canonical.estimatedRent,
    taxes: canonical.taxes,
    insurance: canonical.insurance,
    financingCosts: canonical.financingCosts,
    closingCosts: canonical.closingCosts,
    holdingMonths: canonical.holdingMonths,
    holdingCosts: canonical.holdingCosts,
    earnestMoney: canonical.earnestMoney,
    initialCashInvested: canonical.initialCashInvested,
    cashToClose: canonical.cashToClose,
    fundedRehab: canonical.fundedRehab,
    constructionHoldback: canonical.constructionHoldback,
    leadSource: canonical.leadSource,
    exitStrategy: canonical.exitStrategy,
    strategy: canonical.strategy,
    status: canonical.status,
    notes: canonical.notes,
    annualInterestRate: canonical.interestRate,
    actualLoanAmount: canonical.loanAmount,
    loanMaturityDate: canonical.loanMaturityDate,
    lenderId: canonical.lenderId,
    monthlyRent: canonical.monthlyRent,
    monthlyHoa: canonical.hoa,
    vacancyPercent: canonical.vacancyPercentage,
    maintenancePercent: canonical.maintenancePercentage,
    capexPercent: canonical.capitalExpendituresPercentage,
    propertyManagementPercent: canonical.propertyManagementPercentage,
    monthlyUtilities: canonical.monthlyUtilitiesPaidByOwner,
    otherMonthlyExpenses: canonical.otherMonthlyExpenses,
    refinanceLtvPercent: canonical.refinanceLtvPercentage,
    refinanceInterestRate: canonical.refinanceInterestRate,
    refinanceLoanTermYears: canonical.refinanceLoanTermYears,
    refinanceClosingCosts: canonical.refinanceClosingCosts,
    portfolioId: canonical.portfolioId,
    syncStatus: canonical.syncStatus,
    syncVersion: canonical.syncVersion,
    lastSyncedAt: canonical.lastSyncedAt,
    approvedFields: canonical.approvedFields,
    protectedFields: canonical.protectedFields,
    auditMetadata: canonical.auditMetadata,
    createdAt: canonical.createdAt,
    updatedAt: canonical.updatedAt,
  };
}

export function canonicalToPortfolio(record = {}) {
  const canonical = normalizePortfolioRecord(record);
  return {
    id: canonical.portfolioId || canonical.id,
    propertyName: canonical.propertyName || canonical.address,
    propertyAddress: canonical.address,
    city: canonical.city,
    state: canonical.state,
    zipCode: canonical.zipCode,
    propertyType: canonical.propertyType || "Single Family",
    acquisitionDate: canonical.acquisitionDate,
    purchasePrice: canonical.purchasePrice,
    rehabBudget: canonical.rehabBudget,
    currentValue: canonical.currentValue,
    monthlyRent: canonical.monthlyRent,
    occupancyRate: canonical.occupancyRate,
    operatingExpenses: canonical.operatingExpenses,
    annualTaxes: canonical.annualTaxes,
    annualInsurance: canonical.annualInsurance,
    loanBalance: canonical.loanBalance,
    interestRate: canonical.interestRate,
    monthlyDebtService: canonical.monthlyDebtService,
    status: canonical.status || "Active",
    strategy: canonical.strategy || "Hold",
    favorite: canonical.favorite,
    notes: canonical.notes,
    linkedDealId: canonical.dealId,
    syncStatus: canonical.syncStatus,
    syncVersion: canonical.syncVersion,
    lastSyncedAt: canonical.lastSyncedAt,
    approvedFields: canonical.approvedFields,
    protectedFields: canonical.protectedFields,
    auditMetadata: canonical.auditMetadata,
    createdAt: canonical.createdAt,
    updatedAt: canonical.updatedAt,
  };
}

export function validateCanonicalRecord(record = {}) {
  const canonical = normalizeDealRecord(record);
  const errors = [];
  if (!canonical.address) errors.push("address is required");
  if (!canonical.city) errors.push("city is required");
  if (!canonical.state) errors.push("state is required");
  if (!canonical.zipCode) errors.push("zipCode is required");

  const numericFields = [
    "askingPrice", "purchasePrice", "rehabBudget", "arv", "estimatedRent", "taxes", "insurance",
    "financingCosts", "closingCosts", "holdingMonths", "holdingCosts", "earnestMoney", "initialCashInvested",
    "cashToClose", "fundedRehab", "constructionHoldback", "loanBalance", "loanAmount", "interestRate",
    "monthlyDebtService", "currentValue", "monthlyRent", "operatingExpenses", "occupancyRate",
    "annualTaxes", "annualInsurance", "hoa", "vacancyPercentage", "maintenancePercentage",
    "capitalExpendituresPercentage", "propertyManagementPercentage", "monthlyUtilitiesPaidByOwner",
    "otherMonthlyExpenses", "refinanceLtvPercentage", "refinanceInterestRate", "refinanceLoanTermYears", "refinanceClosingCosts",
  ];

  numericFields.forEach((field) => {
    const value = canonical[field];
    if (value === null) return;
    if (!Number.isFinite(Number(value))) errors.push(`${field} must be numeric or null`);
  });

  return {
    valid: errors.length === 0,
    errors,
    canonical,
  };
}

export function mergeCanonicalRecords(existing = {}, incoming = {}, options = {}) {
  const base = normalizeDealRecord(existing);
  const candidate = normalizeDealRecord(incoming);
  const changedFields = [];
  const preservedFields = [];
  const conflicts = [];

  const approved = new Set([...(base.approvedFields || []), ...(options.approvedFields || [])]);
  const protectedSet = new Set([...(base.protectedFields || []), ...(options.protectedFields || [])]);
  const immutable = new Set(["id", "dealId", "portfolioId", "createdAt", "syncVersion", "auditMetadata", "approvedFields", "protectedFields"]);

  const merged = { ...base };

  Object.keys(candidate).forEach((field) => {
    if (immutable.has(field)) return;

    const incomingValue = candidate[field];
    const existingValue = base[field];

    if (incomingValue === null || incomingValue === undefined) {
      preservedFields.push(field);
      return;
    }

    if ((approved.has(field) || protectedSet.has(field)) && incomingValue !== existingValue) {
      conflicts.push({ field, reason: "PROTECTED_FIELD", existingValue, incomingValue });
      preservedFields.push(field);
      return;
    }

    if (incomingValue === existingValue) {
      return;
    }

    merged[field] = incomingValue;
    changedFields.push(field);
  });

  merged.updatedAt = nowIso();
  merged.syncVersion = Number(base.syncVersion || 1) + (changedFields.length ? 1 : 0);
  merged.approvedFields = Array.from(approved);
  merged.protectedFields = Array.from(protectedSet);

  return {
    record: merged,
    changedFields,
    preservedFields,
    conflicts,
    requiresReview: conflicts.length > 0,
  };
}

export function detectDuplicateProperty(record = {}, existingRecords = []) {
  const canonical = normalizeDealRecord(record);
  const normalizedAddress = normalizeAddressForMatch(canonical.address);
  const normalizedCity = normalizeAddressForMatch(canonical.city);
  const normalizedState = normalizeAddressForMatch(canonical.state);
  const normalizedZip = normalizeAddressForMatch(canonical.zipCode);

  const candidates = Array.isArray(existingRecords) ? existingRecords : [];

  let best = null;
  let confidence = "NONE";
  let reason = "NO_MATCH";

  for (const source of candidates) {
    const existing = normalizeDealRecord(source);

    if (canonical.dealId && existing.dealId && canonical.dealId === existing.dealId) {
      best = existing;
      confidence = "EXACT";
      reason = "MATCHED_DEAL_ID";
      break;
    }

    if (canonical.portfolioId && existing.portfolioId && canonical.portfolioId === existing.portfolioId) {
      best = existing;
      confidence = "EXACT";
      reason = "MATCHED_PORTFOLIO_ID";
      break;
    }

    const existingAddress = normalizeAddressForMatch(existing.address);
    const existingCity = normalizeAddressForMatch(existing.city);
    const existingState = normalizeAddressForMatch(existing.state);
    const existingZip = normalizeAddressForMatch(existing.zipCode);

    if (normalizedAddress && normalizedZip && existingAddress === normalizedAddress && existingZip === normalizedZip) {
      best = existing;
      confidence = "HIGH";
      reason = "ADDRESS_ZIP_MATCH";
      continue;
    }

    if (normalizedAddress && normalizedCity && normalizedState && existingAddress === normalizedAddress && existingCity === normalizedCity && existingState === normalizedState) {
      if (confidence !== "HIGH") {
        best = existing;
        confidence = "HIGH";
        reason = "ADDRESS_CITY_STATE_MATCH";
      }
      continue;
    }

    if (canonical.sourceRecordId && existing.sourceRecordId && canonical.sourceRecordId === existing.sourceRecordId) {
      if (confidence === "NONE") {
        best = existing;
        confidence = "POSSIBLE";
        reason = "SOURCE_RECORD_MATCH";
      }
      continue;
    }

    if (normalizedAddress && existingAddress === normalizedAddress) {
      if (confidence === "NONE") {
        best = existing;
        confidence = "POSSIBLE";
        reason = "ADDRESS_ONLY_MATCH";
      }
    }
  }

  const reviewRequired = confidence === "POSSIBLE";

  return {
    isDuplicate: confidence === "EXACT" || confidence === "HIGH",
    confidence,
    reason,
    reviewRequired,
    matchedRecord: best,
  };
}
