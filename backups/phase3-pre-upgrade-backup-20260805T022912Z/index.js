import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getStoredOrGeneratedDealIntelligence, syncDealIntelligenceStore } from "./dealIntelligenceService.js";
import { buildRuntimeConfig, validateRuntimeConfig, redactSensitiveValue } from "../app/src/utils/config.js";
import { buildPersistedDealPayload } from "./dealPersistence.js";
import { migrateLegacyEnterpriseData } from "../app/src/utils/enterpriseSharedDataSchema.js";
import { sanitizePayload, getRequestContext, hasPermission, validateNumericRange } from "./security.js";
import { readJsonBody, HttpRequestBodyError } from "./requestBody.js";
import {
  ManualCompAdapter,
  RentCastCompAdapter,
  buildCompProviderConfig,
  buildNormalizedCompRecord,
  scoreCompQuality,
} from "./compProviderEngine.js";
import {
  initializeAuthState,
  authenticateUser,
  verifySession,
  logoutSession,
  getAuthSummary,
  redactAuthError,
} from "./authService.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dataDir = path.join(__dirname, "data");
const propertiesFile = path.join(dataDir, "properties.json");
const dealsFile = path.join(dataDir, "deals.json");
const productsFile = path.join(dataDir, "products.json");
const contractorsFile = path.join(dataDir, "contractors.json");
const compsFile = path.join(dataDir, "comps.json");
const neighborhoodsFile = path.join(dataDir, "neighborhoods.json");
const dealIntelligenceFile = path.join(dataDir, "deal-intelligence.json");
const portfolioFile = path.join(dataDir, "portfolio.json");
const vendorsFile = path.join(dataDir, "vendors.json");
const materialsFile = path.join(dataDir, "materials.json");
const lendersFile = path.join(dataDir, "lenders.json");
const appraisalPacketsFile = path.join(dataDir, "appraisalPackets.json");
const rehabProjectsFile = path.join(dataDir, "rehabProjects.json");
const runtimeConfig = validateRuntimeConfig(buildRuntimeConfig({
  env: process.env,
  runtimeEnv: {},
  isBrowser: false,
  requireProductionConfig: process.env.NODE_ENV === "production",
}));
const allowedOrigins = runtimeConfig.allowedOrigins;
const port = runtimeConfig.port;
const compProviderConfig = buildCompProviderConfig({ env: process.env });
const compProviderAdapters = {
  manual: new ManualCompAdapter(compProviderConfig),
  rentcast: new RentCastCompAdapter(compProviderConfig),
};
const activeCompProvider = compProviderConfig.provider === "rentcast" ? compProviderAdapters.rentcast : compProviderAdapters.manual;
const schemaVersion = 1;
const rateLimitBuckets = new Map();
const protectedFields = ["id", "createdAt", "updatedAt", "role", "roles", "permissions", "isAdmin"];
const shutdownSignals = new Set(["SIGINT", "SIGTERM"]);
const providerSearchHistory = [];

function addProviderSearchHistory(entry = {}) {
  providerSearchHistory.push({
    ...entry,
    timestamp: new Date().toISOString(),
  });
  if (providerSearchHistory.length > 25) {
    providerSearchHistory.splice(0, providerSearchHistory.length - 25);
  }
}

function normalizeProviderSearchQuery(payload = {}) {
  return {
    address: getStringValue(payload.address || payload.subjectAddress),
    city: getStringValue(payload.city),
    state: getStringValue(payload.state),
    zipCode: getStringValue(payload.zipCode || payload.zip),
    radiusMiles: getNumberValue(payload.radiusMiles) || compProviderConfig.defaultRadius || 0.5,
    months: getNumberValue(payload.months) || compProviderConfig.defaultMonths || 6,
    maxResults: getNumberValue(payload.maxResults) || compProviderConfig.maxResults || 10,
    propertyType: getStringValue(payload.propertyType),
    bedrooms: getNumberValue(payload.bedrooms),
    bathrooms: getNumberValue(payload.bathrooms),
    squareFeet: getNumberValue(payload.squareFeet),
    yearBuilt: getNumberValue(payload.yearBuilt),
  };
}

function createId(prefix = "deal") {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

function redactForLogs(value) {
  if (value === undefined || value === null || value === "") return value;
  return typeof value === "string" ? redactSensitiveValue(value) : value;
}

function createRequestContext(req, res) {
  const context = getRequestContext(req);
  req.requestContext = context;
  res.setHeader("x-request-id", context.requestId);
  return context;
}

function sendStructuredError(res, statusCode, message, errorType = "error", requestId = "") {
  sendJson(res, statusCode, {
    error: message,
    errorType,
    requestId: requestId || res.getHeader("x-request-id") || "",
  });
}

function safeConsoleLog(level, message, details = {}) {
  const safeDetails = Object.fromEntries(
    Object.entries(details || {}).map(([key, value]) => [key, typeof value === "string" ? redactSensitiveValue(value) : value]),
  );
  const output = { level, message, ...safeDetails };
  console.log(JSON.stringify(output));
}

function authorizeRequest(req, res, action = "read") {
  const context = req.requestContext || createRequestContext(req, res);
  if (action === "read" || context.isLocalHost || context.isAdmin || hasPermission(context, action)) {
    return { allowed: true, context };
  }
  safeConsoleLog("warn", "permission_denied", { action, path: context.path, userId: context.userId });
  sendStructuredError(res, 403, "You do not have permission to perform this action", "permission_error", context.requestId);
  return { allowed: false, context };
}

function enforceRateLimit(req, res, action = "read") {
  const context = req.requestContext || createRequestContext(req, res);
  if (action === "read" || context.isLocalHost) {
    return true;
  }
  const forwardedFor = req.headers["x-forwarded-for"];
  const key = Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor || req.socket?.remoteAddress || "unknown";
  const now = Date.now();
  const windowMs = 60_000;
  const bucket = rateLimitBuckets.get(key) || [];
  while (bucket.length && bucket[0] <= now - windowMs) {
    bucket.shift();
  }
  if (bucket.length >= 120) {
    sendStructuredError(res, 429, "Rate limit exceeded", "rate_limit", context.requestId);
    return false;
  }
  bucket.push(now);
  rateLimitBuckets.set(key, bucket);
  return true;
}

function sanitizeIncomingPayload(payload = {}) {
  return sanitizePayload(payload, {
    protectedFields,
  });
}

function getStringValue(source, fallback = "") {
  const value = source ?? fallback;
  return typeof value === "string" ? value : "";
}

function getNumberValue(source) {
  if (source === "" || source === null || source === undefined) return "";
  const parsed = Number(source);
  return Number.isFinite(parsed) ? parsed : "";
}

function normalizePropertyPayload(payload = {}) {
  return {
    id: getStringValue(payload.id),
    propertyName: getStringValue(payload.propertyName),
    propertyStatus: getStringValue(payload.propertyStatus || payload.status, "Lead"),
    pipelineStage: getStringValue(payload.pipelineStage, "New Lead"),
    ownershipStatus: getStringValue(payload.ownershipStatus, "Not Owned"),
    strategy: getStringValue(payload.strategy, "Hold"),
    propertyType: getStringValue(payload.propertyType, "Single Family"),
    favorite: Boolean(payload.favorite),
    address: getStringValue(payload.address),
    unitNumber: getStringValue(payload.unitNumber),
    city: getStringValue(payload.city),
    state: getStringValue(payload.state),
    zipCode: getStringValue(payload.zipCode),
    county: getStringValue(payload.county),
    parcelNumber: getStringValue(payload.parcelNumber),
    legalDescription: getStringValue(payload.legalDescription),
    latitude: getNumberValue(payload.latitude),
    longitude: getNumberValue(payload.longitude),
    neighborhood: getStringValue(payload.neighborhood),
    schoolDistrict: getStringValue(payload.schoolDistrict),
    yearBuilt: getNumberValue(payload.yearBuilt),
    squareFeet: getNumberValue(payload.squareFeet),
    lotSize: getNumberValue(payload.lotSize),
    bedrooms: getNumberValue(payload.bedrooms),
    bathrooms: getNumberValue(payload.bathrooms),
    units: getNumberValue(payload.units),
    stories: getNumberValue(payload.stories),
    basementType: getStringValue(payload.basementType || payload.basement),
    garageType: getStringValue(payload.garageType || payload.garage),
    garageSpaces: getNumberValue(payload.garageSpaces),
    constructionType: getStringValue(payload.constructionType),
    roofType: getStringValue(payload.roofType),
    heatingType: getStringValue(payload.heatingType),
    coolingType: getStringValue(payload.coolingType),
    waterSource: getStringValue(payload.waterSource),
    sewerType: getStringValue(payload.sewerType),
    occupancyStatus: getStringValue(payload.occupancyStatus || payload.occupancy, "Unknown"),
    currentOccupant: getStringValue(payload.currentOccupant),
    ownerEntity: getStringValue(payload.ownerEntity || payload.ownershipEntity),
    currentOwnerName: getStringValue(payload.currentOwnerName || payload.currentOwner),
    sellerName: getStringValue(payload.sellerName),
    sellerPhone: getStringValue(payload.sellerPhone),
    sellerEmail: getStringValue(payload.sellerEmail),
    acquisitionSource: getStringValue(payload.acquisitionSource),
    acquisitionDate: getStringValue(payload.acquisitionDate),
    closingDate: getStringValue(payload.closingDate),
    purchasePrice: getNumberValue(payload.purchasePrice || payload.askingPrice),
    earnestMoney: getNumberValue(payload.earnestMoney),
    closingCosts: getNumberValue(payload.closingCosts || payload.acquisitionClosingCosts),
    totalCashInvested: getNumberValue(payload.totalCashInvested),
    originalRehabBudget: getNumberValue(payload.originalRehabBudget || payload.rehabBudget),
    currentRehabBudget: getNumberValue(payload.currentRehabBudget || payload.rehabBudget),
    actualRehabCost: getNumberValue(payload.actualRehabCost),
    rehabStatus: getStringValue(payload.rehabStatus, "Not Started"),
    rehabProjectId: getStringValue(payload.rehabProjectId),
    rehabPercentComplete: getNumberValue(payload.rehabPercentComplete),
    projectedRehabCompletionDate: getStringValue(payload.projectedRehabCompletionDate),
    holdingCosts: getNumberValue(payload.holdingCosts),
    financingCosts: getNumberValue(payload.financingCosts),
    permitCosts: getNumberValue(payload.permitCosts),
    insuranceCosts: getNumberValue(payload.insuranceCosts),
    utilityCosts: getNumberValue(payload.utilityCosts),
    taxesDuringProject: getNumberValue(payload.taxesDuringProject),
    cleanupCosts: getNumberValue(payload.cleanupCosts),
    sellingCosts: getNumberValue(payload.sellingCosts),
    totalProjectCost: getNumberValue(payload.totalProjectCost),
    currentValue: getNumberValue(payload.currentValue || payload.currentEstimatedValue),
    projectedARV: getNumberValue(payload.projectedARV || payload.originalARV),
    supportedARV: getNumberValue(payload.supportedARV),
    appraisedValue: getNumberValue(payload.appraisedValue || payload.appraisalValue),
    arvVariance: getNumberValue(payload.arvVariance),
    pricePerSquareFoot: getNumberValue(payload.pricePerSquareFoot),
    rehabCostPerSquareFoot: getNumberValue(payload.rehabCostPerSquareFoot),
    listPrice: getNumberValue(payload.listPrice),
    listingDate: getStringValue(payload.listingDate),
    salePrice: getNumberValue(payload.salePrice),
    saleDate: getStringValue(payload.saleDate),
    listingAgentName: getStringValue(payload.listingAgentName),
    sellingAgentName: getStringValue(payload.sellingAgentName),
    monthlyRent: getNumberValue(payload.monthlyRent),
    marketRent: getNumberValue(payload.marketRent),
    annualGrossRent: getNumberValue(payload.annualGrossRent),
    monthlyTaxes: getNumberValue(payload.monthlyTaxes || payload.annualTaxes),
    monthlyInsurance: getNumberValue(payload.monthlyInsurance || payload.annualInsurance),
    monthlyHOA: getNumberValue(payload.monthlyHOA),
    monthlyUtilities: getNumberValue(payload.monthlyUtilities),
    monthlyMaintenance: getNumberValue(payload.monthlyMaintenance),
    monthlyManagement: getNumberValue(payload.monthlyManagement),
    monthlyDebtService: getNumberValue(payload.monthlyDebtService),
    monthlyOperatingExpenses: getNumberValue(payload.monthlyOperatingExpenses),
    monthlyCashFlow: getNumberValue(payload.monthlyCashFlow),
    annualCashFlow: getNumberValue(payload.annualCashFlow),
    annualNetOperatingIncome: getNumberValue(payload.annualNetOperatingIncome),
    capRate: getNumberValue(payload.capRate),
    cashOnCashReturn: getNumberValue(payload.cashOnCashReturn),
    originalLoanAmount: getNumberValue(payload.originalLoanAmount),
    currentLoanBalance: getNumberValue(payload.currentLoanBalance),
    interestRate: getNumberValue(payload.interestRate),
    loanTermMonths: getNumberValue(payload.loanTermMonths),
    loanMaturityDate: getStringValue(payload.loanMaturityDate),
    lenderId: getStringValue(payload.lenderId),
    lenderName: getStringValue(payload.lenderName),
    loanProgram: getStringValue(payload.loanProgram),
    loanToValue: getNumberValue(payload.loanToValue),
    equity: getNumberValue(payload.equity),
    projectedProfit: getNumberValue(payload.projectedProfit),
    projectedROI: getNumberValue(payload.projectedROI),
    actualProfit: getNumberValue(payload.actualProfit),
    actualROI: getNumberValue(payload.actualROI),
    linkedDealId: getStringValue(payload.linkedDealId),
    contractorId: getStringValue(payload.contractorId),
    contractorName: getStringValue(payload.contractorName),
    appraisalPacketId: getStringValue(payload.appraisalPacketId),
    appraisalStatus: getStringValue(payload.appraisalStatus),
    appraiserName: getStringValue(payload.appraiserName),
    riskLevel: getStringValue(payload.riskLevel, "Low"),
    recommendation: getStringValue(payload.recommendation, "Ready for Analysis"),
    warningCount: getNumberValue(payload.warningCount),
    mapUrl: getStringValue(payload.mapUrl),
    streetViewUrl: getStringValue(payload.streetViewUrl),
    countyRecordUrl: getStringValue(payload.countyRecordUrl),
    taxRecordUrl: getStringValue(payload.taxRecordUrl),
    listingUrl: getStringValue(payload.listingUrl),
    propertySourceUrl: getStringValue(payload.propertySourceUrl),
    insurancePolicyUrl: getStringValue(payload.insurancePolicyUrl),
    titleDocumentUrl: getStringValue(payload.titleDocumentUrl),
    purchaseContractUrl: getStringValue(payload.purchaseContractUrl),
    settlementStatementUrl: getStringValue(payload.settlementStatementUrl),
    appraisalReportUrl: getStringValue(payload.appraisalReportUrl),
    inspectionReportUrl: getStringValue(payload.inspectionReportUrl),
    permitUrl: getStringValue(payload.permitUrl),
    coverPhotoUrl: getStringValue(payload.coverPhotoUrl),
    beforePhotos: Array.isArray(payload.beforePhotos) ? payload.beforePhotos : [],
    demoPhotos: Array.isArray(payload.demoPhotos) ? payload.demoPhotos : [],
    progressPhotos: Array.isArray(payload.progressPhotos) ? payload.progressPhotos : [],
    inspectionPhotos: Array.isArray(payload.inspectionPhotos) ? payload.inspectionPhotos : [],
    punchListPhotos: Array.isArray(payload.punchListPhotos) ? payload.punchListPhotos : [],
    afterPhotos: Array.isArray(payload.afterPhotos) ? payload.afterPhotos : [],
    floorPlanUrls: Array.isArray(payload.floorPlanUrls) ? payload.floorPlanUrls : [],
    otherPhotos: Array.isArray(payload.otherPhotos) ? payload.otherPhotos : [],
    documentUrls: Array.isArray(payload.documentUrls) ? payload.documentUrls : [],
    notes: getStringValue(payload.notes),
    createdAt: getStringValue(payload.createdAt),
    updatedAt: getStringValue(payload.updatedAt),
    status: getStringValue(payload.status || payload.propertyStatus, "Lead"),
  };
}

function validateProperty(property) {
  const errors = [];
  if (!property.propertyName?.trim() && !property.address?.trim()) errors.push("Property name or address is required");
  if (!property.city?.trim()) errors.push("City is required");
  if (!property.state?.trim()) errors.push("State is required");
  if (!property.zipCode?.trim()) errors.push("ZIP code is required");
  if (!property.propertyType?.trim()) errors.push("Property type is required");
  if (!property.propertyStatus?.trim()) errors.push("Property status is required");
  if (!property.strategy?.trim()) errors.push("Strategy is required");

  const numericFields = [
    ["purchasePrice", 0, null],
    ["closingCosts", 0, null],
    ["earnestMoney", 0, null],
    ["originalRehabBudget", 0, null],
    ["currentRehabBudget", 0, null],
    ["actualRehabCost", 0, null],
    ["holdingCosts", 0, null],
    ["financingCosts", 0, null],
    ["permitCosts", 0, null],
    ["insuranceCosts", 0, null],
    ["utilityCosts", 0, null],
    ["taxesDuringProject", 0, null],
    ["cleanupCosts", 0, null],
    ["sellingCosts", 0, null],
    ["currentValue", 0, null],
    ["projectedARV", 0, null],
    ["supportedARV", 0, null],
    ["appraisedValue", 0, null],
    ["monthlyRent", 0, null],
    ["monthlyTaxes", 0, null],
    ["monthlyInsurance", 0, null],
    ["monthlyHOA", 0, null],
    ["monthlyUtilities", 0, null],
    ["monthlyMaintenance", 0, null],
    ["monthlyManagement", 0, null],
    ["monthlyDebtService", 0, null],
    ["currentLoanBalance", 0, null],
    ["originalLoanAmount", 0, null],
    ["interestRate", 0, 100],
    ["loanTermMonths", 0, null],
    ["yearBuilt", 0, null],
    ["squareFeet", 0, null],
    ["lotSize", 0, null],
    ["bedrooms", 0, null],
    ["bathrooms", 0, null],
    ["units", 0, null],
    ["stories", 0, null],
    ["garageSpaces", 0, null],
    ["rehabPercentComplete", 0, 100],
  ];

  numericFields.forEach(([field, min, max]) => {
    const value = property[field];
    if (value === "" || value === null || value === undefined) return;
    if (Number.isNaN(Number(value))) {
      errors.push(`${field} must be numeric`);
      return;
    }
    if (min !== null && Number(value) < min) errors.push(`${field} cannot be negative`);
    if (max !== null && Number(value) > max) errors.push(`${field} must remain between 0 and ${max}`);
  });

  if (property.acquisitionDate && property.closingDate && new Date(property.closingDate) < new Date(property.acquisitionDate)) errors.push("closingDate cannot precede acquisitionDate");
  if (property.listingDate && property.saleDate && new Date(property.listingDate) > new Date(property.saleDate)) errors.push("listingDate cannot follow saleDate");

  const urlFields = ["mapUrl", "streetViewUrl", "countyRecordUrl", "taxRecordUrl", "listingUrl", "propertySourceUrl", "insurancePolicyUrl", "titleDocumentUrl", "purchaseContractUrl", "settlementStatementUrl", "appraisalReportUrl", "inspectionReportUrl", "permitUrl", "coverPhotoUrl"];
  urlFields.forEach((field) => {
    const value = property[field];
    if (value && !/^https?:\/\//i.test(value)) errors.push(`${field} must be a valid URL`);
  });

  return errors;
}

function normalizeDealPayload(payload = {}) {
  return {
    propertyAddress: getStringValue(payload.propertyAddress ?? payload.address),
    city: getStringValue(payload.city),
    state: getStringValue(payload.state),
    zipCode: getStringValue(payload.zipCode ?? payload.zip),
    propertyType: getStringValue(payload.propertyType),
    bedrooms: getNumberValue(payload.bedrooms),
    bathrooms: getNumberValue(payload.bathrooms),
    squareFeet: getNumberValue(payload.squareFeet),
    yearBuilt: getNumberValue(payload.yearBuilt),
    askingPrice: getNumberValue(payload.askingPrice),
    purchasePrice: getNumberValue(payload.purchasePrice),
    rehabBudget: getNumberValue(payload.rehabBudget),
    estimatedArv: getNumberValue(payload.estimatedArv ?? payload.arv),
    estimatedRent: getNumberValue(payload.estimatedRent),
    taxes: getNumberValue(payload.taxes),
    insurance: getNumberValue(payload.insurance),
    financingCosts: getNumberValue(payload.financingCosts),
    rawFinancingCostInput: getNumberValue(payload.financials?.rawFinancingCostInput ?? payload.rawFinancingCostInput ?? payload.financingCosts),
    calculatedFinancingCosts: getNumberValue(payload.financials?.calculatedFinancingCosts ?? payload.calculatedFinancingCosts ?? payload.calculatedFinancingCost),
    effectiveFinancingCosts: getNumberValue(payload.financials?.effectiveFinancingCosts ?? payload.effectiveFinancingCosts ?? payload.effectiveFinancingCost),
    financingCostSource: getStringValue(payload.financials?.financingCostSource ?? payload.financingCostSource, "calculated"),
    financials: payload.financials ? {
      rawFinancingCostInput: getNumberValue(payload.financials.rawFinancingCostInput ?? payload.rawFinancingCostInput ?? payload.financingCosts),
      calculatedFinancingCosts: getNumberValue(payload.financials.calculatedFinancingCosts ?? payload.calculatedFinancingCosts ?? payload.calculatedFinancingCost),
      effectiveFinancingCosts: getNumberValue(payload.financials.effectiveFinancingCosts ?? payload.effectiveFinancingCosts ?? payload.effectiveFinancingCost),
      financingCostSource: getStringValue(payload.financials.financingCostSource ?? payload.financingCostSource, "calculated"),
    } : undefined,
    closingCosts: getNumberValue(payload.closingCosts),
    holdingMonths: getNumberValue(payload.holdingMonths),
    annualInterestRate: getNumberValue(payload.annualInterestRate ?? payload.interestRate ?? payload.rate),
    actualLoanAmount: getNumberValue(payload.actualLoanAmount ?? payload.actualLoan ?? payload.loanAmount ?? payload.fundingAmount),
    lenderLoanAmount: getNumberValue(payload.lenderLoanAmount ?? payload.lenderLoan ?? payload.loanAmountFromLender),
    acquisitionLoan: getNumberValue(payload.acquisitionLoan ?? payload.purchaseLoan ?? payload.acquisitionFunding),
    fundedRehab: getNumberValue(payload.fundedRehab ?? payload.rehabFunding ?? payload.rehabLoan),
    cashToClose: getNumberValue(payload.cashToClose ?? payload.cashToCloseAmount),
    earnestMoney: getNumberValue(payload.earnestMoney),
    totalInitialCashInvested: getNumberValue(payload.totalInitialCashInvested ?? payload.initialCashInvested ?? payload.cashInvested),
    constructionHoldback: getNumberValue(payload.constructionHoldback ?? payload.holdbackAmount ?? payload.constructionHoldbackAmount),
    originationFee: getNumberValue(payload.originationFee ?? payload.originationFees),
    brokerFee: getNumberValue(payload.brokerFee),
    underwritingFee: getNumberValue(payload.underwritingFee),
    servicingFee: getNumberValue(payload.servicingFee),
    lenderLegalFee: getNumberValue(payload.lenderLegalFee ?? payload.legalFee),
    monitoringFee: getNumberValue(payload.monitoringFee),
    otherLenderFees: getNumberValue(payload.otherLenderFees ?? payload.otherFees),
    loanTermMonths: getNumberValue(payload.loanTermMonths ?? payload.loanTerm ?? payload.termMonths),
    amortizationTermMonths: getNumberValue(payload.amortizationTermMonths ?? payload.amortizationTerm),
    paymentType: getStringValue(payload.paymentType ?? payload.loanPaymentType ?? payload.debtPaymentType),
    leadSource: getStringValue(payload.leadSource),
    strategy: getStringValue(payload.strategy ?? payload.exitStrategy),
    notes: getStringValue(payload.notes),
    overallRisk: getNumberValue(payload.overallRisk),
    riskLevel: getStringValue(payload.riskLevel, "Low"),
    recommendation: getStringValue(payload.recommendation, "Ready for Analysis"),
    warningCount: getNumberValue(payload.warningCount),
    confidenceScore: getNumberValue(payload.confidenceScore),
    status: getStringValue(payload.status, "active"),
    source: getStringValue(payload.source, "web"),
  };
}

function validateDeal(deal) {
  const errors = [];
  if (!deal.propertyAddress) errors.push("propertyAddress is required");
  if (!deal.city) errors.push("city is required");
  if (!deal.state) errors.push("state is required");
  if (!deal.zipCode) errors.push("zipCode is required");
  if (deal.purchasePrice !== "" && deal.purchasePrice < 0) errors.push("purchasePrice cannot be negative");
  if (deal.rehabBudget !== "" && deal.rehabBudget < 0) errors.push("rehabBudget cannot be negative");
  if (deal.estimatedArv !== "" && deal.estimatedArv < 0) errors.push("estimatedArv cannot be negative");
  return errors;
}

function normalizeDealIntelligencePayload(payload = {}) {
  return {
    id: getStringValue(payload.id),
    dealId: getStringValue(payload.dealId),
    analysisName: getStringValue(payload.analysisName, "Deal Intelligence Review"),
    analysisStatus: getStringValue(payload.analysisStatus, "Draft"),
    favorite: Boolean(payload.favorite),
    createdAt: getStringValue(payload.createdAt),
    updatedAt: getStringValue(payload.updatedAt),
    propertyId: getStringValue(payload.propertyId),
    propertyName: getStringValue(payload.propertyName),
    address: getStringValue(payload.address),
    city: getStringValue(payload.city),
    state: getStringValue(payload.state),
    zipCode: getStringValue(payload.zipCode),
    county: getStringValue(payload.county),
    propertyType: getStringValue(payload.propertyType),
    strategy: getStringValue(payload.strategy),
    bedrooms: getNumberValue(payload.bedrooms),
    bathrooms: getNumberValue(payload.bathrooms),
    squareFeet: getNumberValue(payload.squareFeet),
    units: getNumberValue(payload.units),
    yearBuilt: getNumberValue(payload.yearBuilt),
    occupancyStatus: getStringValue(payload.occupancyStatus),
    askingPrice: getNumberValue(payload.askingPrice),
    purchasePrice: getNumberValue(payload.purchasePrice),
    offerPrice: getNumberValue(payload.offerPrice),
    recommendedOffer: getNumberValue(payload.recommendedOffer),
    maximumAllowableOffer: getNumberValue(payload.maximumAllowableOffer),
    walkAwayPrice: getNumberValue(payload.walkAwayPrice),
    earnestMoney: getNumberValue(payload.earnestMoney),
    buyerClosingCosts: getNumberValue(payload.buyerClosingCosts),
    acquisitionFees: getNumberValue(payload.acquisitionFees),
    rehabBudget: getNumberValue(payload.rehabBudget),
    actualRehabCost: getNumberValue(payload.actualRehabCost),
    remainingRehab: getNumberValue(payload.remainingRehab),
    contingencyPercent: getNumberValue(payload.contingencyPercent),
    contingencyAmount: getNumberValue(payload.contingencyAmount),
    rehabTimelineMonths: getNumberValue(payload.rehabTimelineMonths),
    rehabStatus: getStringValue(payload.rehabStatus),
    rehabProjectId: getStringValue(payload.rehabProjectId),
    contractorId: getStringValue(payload.contractorId),
    currentValue: getNumberValue(payload.currentValue),
    projectedARV: getNumberValue(payload.projectedARV),
    supportedARV: getNumberValue(payload.supportedARV),
    appraisedValue: getNumberValue(payload.appraisedValue),
    arvLow: getNumberValue(payload.arvLow),
    arvBase: getNumberValue(payload.arvBase),
    arvHigh: getNumberValue(payload.arvHigh),
    arvConfidence: getStringValue(payload.arvConfidence),
    arvConfidenceScore: getNumberValue(payload.arvConfidenceScore),
    loanAmount: getNumberValue(payload.loanAmount),
    interestRate: getNumberValue(payload.interestRate),
    loanTerm: getNumberValue(payload.loanTerm),
    loanType: getStringValue(payload.loanType),
    loanPoints: getNumberValue(payload.loanPoints),
    loanFees: getNumberValue(payload.loanFees),
    loanToCost: getNumberValue(payload.loanToCost),
    loanToValue: getNumberValue(payload.loanToValue),
    loanToARV: getNumberValue(payload.loanToARV),
    monthlyPayment: getNumberValue(payload.monthlyPayment),
    cashRequired: getNumberValue(payload.cashRequired),
    holdingCosts: getNumberValue(payload.holdingCosts),
    sellingCosts: getNumberValue(payload.sellingCosts),
    projectedSalePrice: getNumberValue(payload.projectedSalePrice),
    projectedProfit: getNumberValue(payload.projectedProfit),
    projectedROI: getNumberValue(payload.projectedROI),
    annualizedROI: getNumberValue(payload.annualizedROI),
    breakEvenPrice: getNumberValue(payload.breakEvenPrice),
    marketRent: getNumberValue(payload.marketRent),
    projectedRent: getNumberValue(payload.projectedRent),
    vacancyRate: getNumberValue(payload.vacancyRate),
    operatingExpenses: getNumberValue(payload.operatingExpenses),
    NOI: getNumberValue(payload.NOI),
    cashFlow: getNumberValue(payload.cashFlow),
    capRate: getNumberValue(payload.capRate),
    cashOnCashReturn: getNumberValue(payload.cashOnCashReturn),
    DSCR: getNumberValue(payload.DSCR),
    refinanceValue: getNumberValue(payload.refinanceValue),
    refinanceLoan: getNumberValue(payload.refinanceLoan),
    cashReturned: getNumberValue(payload.cashReturned),
    cashLeftInDeal: getNumberValue(payload.cashLeftInDeal),
    refinancePayment: getNumberValue(payload.refinancePayment),
    postRefinancingCashFlow: getNumberValue(payload.postRefinancingCashFlow),
    marketGrade: getStringValue(payload.marketGrade),
    marketScore: getNumberValue(payload.marketScore),
    appreciationScore: getNumberValue(payload.appreciationScore),
    rentalDemand: getNumberValue(payload.rentalDemand),
    vacancyRisk: getNumberValue(payload.vacancyRisk),
    crimeRisk: getNumberValue(payload.crimeRisk),
    employmentScore: getNumberValue(payload.employmentScore),
    populationGrowth: getNumberValue(payload.populationGrowth),
    daysOnMarket: getNumberValue(payload.daysOnMarket),
    liquidityScore: getNumberValue(payload.liquidityScore),
    buyBoxResult: getStringValue(payload.buyBoxResult),
    buyBoxReason: getStringValue(payload.buyBoxReason),
    buyBoxExceptions: Array.isArray(payload.buyBoxExceptions) ? payload.buyBoxExceptions : [],
    acquisitionRisk: getNumberValue(payload.acquisitionRisk),
    valuationRisk: getNumberValue(payload.valuationRisk),
    rehabRisk: getNumberValue(payload.rehabRisk),
    financingRisk: getNumberValue(payload.financingRisk),
    marketRisk: getNumberValue(payload.marketRisk),
    rentalRisk: getNumberValue(payload.rentalRisk),
    exitRisk: getNumberValue(payload.exitRisk),
    documentationRisk: getNumberValue(payload.documentationRisk),
    overallRisk: getNumberValue(payload.overallRisk),
    dealScore: getNumberValue(payload.dealScore),
    grade: getStringValue(payload.grade),
    recommendation: getStringValue(payload.recommendation),
    recommendationReason: getStringValue(payload.recommendationReason),
    requiredNextActions: Array.isArray(payload.requiredNextActions) ? payload.requiredNextActions : [],
    analystNotes: getStringValue(payload.analystNotes),
    warnings: Array.isArray(payload.warnings) ? payload.warnings : [],
    riskLevel: getStringValue(payload.riskLevel),
    confidenceScore: getNumberValue(payload.confidenceScore),
    underwritingSummary: getStringValue(payload.underwritingSummary),
    arvOutput: getNumberValue(payload.arvOutput),
    offerGuidance: getStringValue(payload.offerGuidance),
    exitStrategyComparison: getStringValue(payload.exitStrategyComparison),
    capitalRequired: getNumberValue(payload.capitalRequired),
    estimatedProfit: getNumberValue(payload.estimatedProfit),
    estimatedCashFlow: getNumberValue(payload.estimatedCashFlow),
    majorRiskFlags: Array.isArray(payload.majorRiskFlags) ? payload.majorRiskFlags : [],
    requiredFollowUpItems: Array.isArray(payload.requiredFollowUpItems) ? payload.requiredFollowUpItems : [],
    manualOverrideStatus: getStringValue(payload.manualOverrideStatus),
  };
}

function validateDealIntelligence(entry) {
  const errors = [];
  if (!entry.analysisName?.trim()) errors.push("analysisName is required");
  if (!entry.propertyName?.trim() && !entry.address?.trim()) errors.push("propertyName or address is required");
  return errors;
}

function normalizeCompPayload(payload = {}) {
  const salePrice = Number(payload.salePrice);
  const listPrice = Number(payload.listPrice);
  const bedrooms = Number(payload.bedrooms);
  const bathrooms = Number(payload.bathrooms);
  const squareFeet = Number(payload.squareFeet);
  const yearBuilt = Number(payload.yearBuilt);
  const distanceMiles = Number(payload.distanceMiles);

  return {
    id: payload.id || "",
    subjectProperty: payload.subjectProperty || "",
    compAddress: payload.compAddress || "",
    city: payload.city || "",
    state: payload.state || "",
    zipCode: payload.zipCode || "",
    salePrice: Number.isFinite(salePrice) ? salePrice : "",
    saleDate: payload.saleDate || "",
    listPrice: Number.isFinite(listPrice) ? listPrice : "",
    propertyType: payload.propertyType || "Single Family",
    bedrooms: Number.isFinite(bedrooms) ? bedrooms : "",
    bathrooms: Number.isFinite(bathrooms) ? bathrooms : "",
    squareFeet: Number.isFinite(squareFeet) ? squareFeet : "",
    yearBuilt: Number.isFinite(yearBuilt) ? yearBuilt : "",
    lotSize: payload.lotSize || "",
    distanceMiles: Number.isFinite(distanceMiles) ? distanceMiles : "",
    condition: payload.condition || "Average",
    garage: payload.garage || "",
    basement: payload.basement || "",
    source: payload.source || "",
    sourceLink: payload.sourceLink || "",
    notes: payload.notes || "",
    included: payload.included !== false,
    provider: payload.provider || activeCompProvider?.constructor?.name === "RentCastCompAdapter" ? "rentcast" : "manual",
    providerImported: Boolean(payload.providerImported),
    manuallyEntered: Boolean(payload.manuallyEntered),
    verified: Boolean(payload.verified),
    inclusionStatus: payload.inclusionStatus || "pending",
    exclusionReason: payload.exclusionReason || "",
    warningFlags: Array.isArray(payload.warningFlags) ? payload.warningFlags : [],
    createdAt: payload.createdAt || "",
    updatedAt: payload.updatedAt || "",
  };
}

function validateComp(comp) {
  const errors = [];
  if (!comp.compAddress) errors.push("compAddress is required");
  if (!comp.salePrice && comp.salePrice !== 0) errors.push("salePrice is required");
  if (comp.salePrice !== "" && comp.salePrice < 0) errors.push("salePrice cannot be negative");
  if (!comp.saleDate) errors.push("saleDate is required");
  if (!comp.squareFeet && comp.squareFeet !== 0) errors.push("squareFeet is required");
  if (comp.squareFeet !== "" && comp.squareFeet < 0) errors.push("squareFeet cannot be negative");
  if (!comp.source) errors.push("source is required");
  return errors;
}

function normalizeNeighborhoodPayload(payload = {}) {
  return {
    id: getStringValue(payload.id),
    neighborhoodName: getStringValue(payload.neighborhoodName),
    city: getStringValue(payload.city),
    county: getStringValue(payload.county),
    state: getStringValue(payload.state),
    zipCode: getStringValue(payload.zipCode),
    censusTract: getStringValue(payload.censusTract),
    latitude: getNumberValue(payload.latitude),
    longitude: getNumberValue(payload.longitude),
    schoolDistrict: getStringValue(payload.schoolDistrict),
    medianHomeValue: getNumberValue(payload.medianHomeValue),
    medianRent: getNumberValue(payload.medianRent),
    averageRent: getNumberValue(payload.averageRent),
    rentGrowth1Year: getNumberValue(payload.rentGrowth1Year),
    rentGrowth3Year: getNumberValue(payload.rentGrowth3Year),
    appreciation1Year: getNumberValue(payload.appreciation1Year),
    appreciation3Year: getNumberValue(payload.appreciation3Year),
    appreciation5Year: getNumberValue(payload.appreciation5Year),
    appreciation10Year: getNumberValue(payload.appreciation10Year),
    averageDaysOnMarket: getNumberValue(payload.averageDaysOnMarket),
    medianPricePerSquareFoot: getNumberValue(payload.medianPricePerSquareFoot),
    activeInventory: getNumberValue(payload.activeInventory),
    monthsOfSupply: getNumberValue(payload.monthsOfSupply),
    vacancyRate: getNumberValue(payload.vacancyRate),
    ownerOccupancyRate: getNumberValue(payload.ownerOccupancyRate),
    population: getNumberValue(payload.population),
    populationGrowth: getNumberValue(payload.populationGrowth),
    medianHouseholdIncome: getNumberValue(payload.medianHouseholdIncome),
    incomeGrowth: getNumberValue(payload.incomeGrowth),
    employmentGrowth: getNumberValue(payload.employmentGrowth),
    crimeRating: getStringValue(payload.crimeRating, "Unknown"),
    schoolRating: getNumberValue(payload.schoolRating),
    investorDemandScore: getNumberValue(payload.investorDemandScore),
    rentalDemandScore: getNumberValue(payload.rentalDemandScore),
    marketCycle: getStringValue(payload.marketCycle, "Unknown"),
    favorite: Boolean(payload.favorite),
    notes: getStringValue(payload.notes),
    mapUrl: getStringValue(payload.mapUrl),
    dataSource: getStringValue(payload.dataSource),
    sourceUrl: getStringValue(payload.sourceUrl),
    dataAsOfDate: getStringValue(payload.dataAsOfDate),
    createdAt: getStringValue(payload.createdAt),
    updatedAt: getStringValue(payload.updatedAt),
  };
}

function normalizePortfolioPayload(payload = {}) {
  return {
    id: getStringValue(payload.id),
    propertyName: getStringValue(payload.propertyName),
    propertyAddress: getStringValue(payload.propertyAddress),
    city: getStringValue(payload.city),
    state: getStringValue(payload.state),
    zipCode: getStringValue(payload.zipCode),
    propertyType: getStringValue(payload.propertyType, "Single Family"),
    acquisitionDate: getStringValue(payload.acquisitionDate),
    purchasePrice: getNumberValue(payload.purchasePrice),
    rehabBudget: getNumberValue(payload.rehabBudget),
    currentValue: getNumberValue(payload.currentValue),
    monthlyRent: getNumberValue(payload.monthlyRent),
    occupancyRate: getNumberValue(payload.occupancyRate),
    operatingExpenses: getNumberValue(payload.operatingExpenses),
    annualTaxes: getNumberValue(payload.annualTaxes),
    annualInsurance: getNumberValue(payload.annualInsurance),
    loanBalance: getNumberValue(payload.loanBalance),
    interestRate: getNumberValue(payload.interestRate),
    monthlyDebtService: getNumberValue(payload.monthlyDebtService),
    status: getStringValue(payload.status, "Active"),
    strategy: getStringValue(payload.strategy, "Hold"),
    favorite: Boolean(payload.favorite),
    notes: getStringValue(payload.notes),
    createdAt: getStringValue(payload.createdAt),
    updatedAt: getStringValue(payload.updatedAt),
  };
}

function validatePortfolio(property) {
  const errors = [];
  if (!property.propertyName) errors.push("propertyName is required");
  if (!property.propertyAddress) errors.push("propertyAddress is required");
  if (!property.city) errors.push("city is required");
  if (!property.state) errors.push("state is required");
  if (!property.zipCode) errors.push("zipCode is required");
  if (property.purchasePrice !== "" && property.purchasePrice < 0) errors.push("purchasePrice cannot be negative");
  if (property.currentValue !== "" && property.currentValue < 0) errors.push("currentValue cannot be negative");
  if (property.monthlyRent !== "" && property.monthlyRent < 0) errors.push("monthlyRent cannot be negative");
  if (property.occupancyRate !== "" && (property.occupancyRate < 0 || property.occupancyRate > 100)) errors.push("occupancyRate must be between 0 and 100");
  return errors;
}

function normalizeVendorPayload(payload = {}) {
  return {
    id: getStringValue(payload.id),
    vendorName: getStringValue(payload.vendorName),
    vendorType: getStringValue(payload.vendorType, "Retail Supplier"),
    primaryCategory: getStringValue(payload.primaryCategory, "General Materials"),
    secondaryCategories: getStringValue(payload.secondaryCategories),
    contactName: getStringValue(payload.contactName),
    phone: getStringValue(payload.phone),
    email: getStringValue(payload.email),
    website: getStringValue(payload.website),
    address: getStringValue(payload.address),
    city: getStringValue(payload.city),
    state: getStringValue(payload.state),
    zipCode: getStringValue(payload.zipCode),
    accountNumber: getStringValue(payload.accountNumber),
    taxIdOrW9Status: getStringValue(payload.taxIdOrW9Status, "On File"),
    paymentTerms: getStringValue(payload.paymentTerms, "Net 30"),
    creditLimit: getNumberValue(payload.creditLimit),
    availableCredit: getNumberValue(payload.availableCredit),
    minimumOrder: getNumberValue(payload.minimumOrder),
    deliveryAvailable: Boolean(payload.deliveryAvailable),
    deliveryFee: getNumberValue(payload.deliveryFee),
    deliveryArea: getStringValue(payload.deliveryArea),
    pickupAvailable: Boolean(payload.pickupAvailable),
    preferredVendor: Boolean(payload.preferredVendor),
    approvalStatus: getStringValue(payload.approvalStatus, "Under Review"),
    activeStatus: getStringValue(payload.activeStatus, "Active"),
    pricingTier: getStringValue(payload.pricingTier, "Contractor"),
    discountPercentage: getNumberValue(payload.discountPercentage),
    materialDiscountNotes: getStringValue(payload.materialDiscountNotes),
    returnPolicy: getStringValue(payload.returnPolicy),
    warrantyTerms: getStringValue(payload.warrantyTerms),
    insuranceRequired: Boolean(payload.insuranceRequired),
    insuranceExpiration: getStringValue(payload.insuranceExpiration),
    licenseNumber: getStringValue(payload.licenseNumber),
    licenseExpiration: getStringValue(payload.licenseExpiration),
    averageLeadTimeDays: getNumberValue(payload.averageLeadTimeDays),
    averageDeliveryTimeDays: getNumberValue(payload.averageDeliveryTimeDays),
    qualityScore: getNumberValue(payload.qualityScore),
    pricingScore: getNumberValue(payload.pricingScore),
    reliabilityScore: getNumberValue(payload.reliabilityScore),
    communicationScore: getNumberValue(payload.communicationScore),
    deliveryScore: getNumberValue(payload.deliveryScore),
    serviceScore: getNumberValue(payload.serviceScore),
    overallScore: getNumberValue(payload.overallScore),
    totalOrders: getNumberValue(payload.totalOrders),
    totalSpend: getNumberValue(payload.totalSpend),
    lastOrderDate: getStringValue(payload.lastOrderDate),
    lastContactDate: getStringValue(payload.lastContactDate),
    sourceUrl: getStringValue(payload.sourceUrl),
    accountPortalUrl: getStringValue(payload.accountPortalUrl),
    favorite: Boolean(payload.favorite),
    notes: getStringValue(payload.notes),
    createdAt: getStringValue(payload.createdAt),
    updatedAt: getStringValue(payload.updatedAt),
  };
}

function validateVendor(vendor) {
  const errors = [];
  if (!vendor.vendorName) errors.push("vendorName is required");
  if (!vendor.vendorType) errors.push("vendorType is required");
  if (!vendor.primaryCategory) errors.push("primaryCategory is required");
  if (!vendor.approvalStatus) errors.push("approvalStatus is required");
  if (!vendor.activeStatus) errors.push("activeStatus is required");

  const numericFields = [
    ["creditLimit", 0, null],
    ["availableCredit", 0, null],
    ["minimumOrder", 0, null],
    ["deliveryFee", 0, null],
    ["discountPercentage", 0, 100],
    ["averageLeadTimeDays", 0, null],
    ["averageDeliveryTimeDays", 0, null],
    ["qualityScore", 0, 10],
    ["pricingScore", 0, 10],
    ["reliabilityScore", 0, 10],
    ["communicationScore", 0, 10],
    ["deliveryScore", 0, 10],
    ["serviceScore", 0, 10],
    ["overallScore", 0, 10],
    ["totalOrders", 0, null],
    ["totalSpend", 0, null],
  ];

  numericFields.forEach(([field, min, max]) => {
    const value = vendor[field];
    if (value === "" || value === null || value === undefined) return;
    if (Number.isNaN(Number(value))) {
      errors.push(`${field} must be numeric`);
      return;
    }
    if (min !== null && Number(value) < min) errors.push(`${field} cannot be below ${min}`);
    if (max !== null && Number(value) > max) errors.push(`${field} cannot exceed ${max}`);
  });

  return errors;
}

function normalizeMaterialPayload(payload = {}) {
  return {
    id: getStringValue(payload.id),
    materialName: getStringValue(payload.materialName),
    category: getStringValue(payload.category, "General Materials"),
    unit: getStringValue(payload.unit, "EA"),
    estimatedQty: getNumberValue(payload.estimatedQty),
    unitCost: getNumberValue(payload.unitCost),
    totalCost: getNumberValue(payload.totalCost),
    supplier: getStringValue(payload.supplier),
    propertyId: getStringValue(payload.propertyId),
    propertyName: getStringValue(payload.propertyName),
    projectStage: getStringValue(payload.projectStage, "Planning"),
    priority: getStringValue(payload.priority, "Medium"),
    sourceProductId: getStringValue(payload.sourceProductId),
    leadTimeDays: getNumberValue(payload.leadTimeDays),
    warrantyMonths: getNumberValue(payload.warrantyMonths),
    wasteFactor: getNumberValue(payload.wasteFactor),
    favorite: Boolean(payload.favorite),
    notes: getStringValue(payload.notes),
    createdAt: getStringValue(payload.createdAt),
    updatedAt: getStringValue(payload.updatedAt),
  };
}

function validateMaterial(material) {
  const errors = [];
  if (!material.materialName) errors.push("materialName is required");
  if (!material.category) errors.push("category is required");
  if (!material.unit) errors.push("unit is required");
  if (!material.supplier) errors.push("supplier is required");
  if (material.estimatedQty !== "" && material.estimatedQty < 0) errors.push("estimatedQty cannot be negative");
  if (material.unitCost !== "" && material.unitCost < 0) errors.push("unitCost cannot be negative");
  if (material.totalCost !== "" && material.totalCost < 0) errors.push("totalCost cannot be negative");
  return errors;
}

function normalizeAppraisalPacketPayload(payload = {}) {
  return {
    id: getStringValue(payload.id),
    packetName: getStringValue(payload.packetName),
    packetStatus: getStringValue(payload.packetStatus, "Draft"),
    propertyId: getStringValue(payload.propertyId),
    propertyName: getStringValue(payload.propertyName),
    address: getStringValue(payload.address),
    city: getStringValue(payload.city),
    state: getStringValue(payload.state),
    zipCode: getStringValue(payload.zipCode),
    county: getStringValue(payload.county),
    parcelNumber: getStringValue(payload.parcelNumber),
    propertyType: getStringValue(payload.propertyType, "Single Family"),
    bedrooms: getNumberValue(payload.bedrooms),
    bathrooms: getNumberValue(payload.bathrooms),
    squareFeet: getNumberValue(payload.squareFeet),
    lotSize: getNumberValue(payload.lotSize),
    yearBuilt: getNumberValue(payload.yearBuilt),
    units: getNumberValue(payload.units),
    strategy: getStringValue(payload.strategy, "Hold"),
    purchasePrice: getNumberValue(payload.purchasePrice),
    rehabBudget: getNumberValue(payload.rehabBudget),
    actualRehabCost: getNumberValue(payload.actualRehabCost),
    totalProjectCost: getNumberValue(payload.totalProjectCost),
    currentValue: getNumberValue(payload.currentValue),
    requestedARV: getNumberValue(payload.requestedARV),
    supportedARV: getNumberValue(payload.supportedARV),
    appraisalValue: getNumberValue(payload.appraisalValue),
    loanAmount: getNumberValue(payload.loanAmount),
    lenderId: getStringValue(payload.lenderId),
    lenderName: getStringValue(payload.lenderName),
    appraiserName: getStringValue(payload.appraiserName),
    appraisalCompany: getStringValue(payload.appraisalCompany),
    appraisalOrderDate: getStringValue(payload.appraisalOrderDate),
    appraisalInspectionDate: getStringValue(payload.appraisalInspectionDate),
    appraisalDueDate: getStringValue(payload.appraisalDueDate),
    appraisalCompletedDate: getStringValue(payload.appraisalCompletedDate),
    ownerEntity: getStringValue(payload.ownerEntity),
    borrowerName: getStringValue(payload.borrowerName),
    contactName: getStringValue(payload.contactName),
    contactPhone: getStringValue(payload.contactPhone),
    contactEmail: getStringValue(payload.contactEmail),
    neighborhood: getStringValue(payload.neighborhood),
    marketSummary: getStringValue(payload.marketSummary),
    propertySummary: getStringValue(payload.propertySummary),
    renovationSummary: getStringValue(payload.renovationSummary),
    scopeSummary: getStringValue(payload.scopeSummary),
    valueAddSummary: getStringValue(payload.valueAddSummary),
    compSelectionSummary: getStringValue(payload.compSelectionSummary),
    ARVMethod: getStringValue(payload.ARVMethod, "Comparable Sales"),
    confidenceLevel: getStringValue(payload.confidenceLevel, "Insufficient Data"),
    adjustmentSummary: getStringValue(payload.adjustmentSummary),
    rentEstimate: getNumberValue(payload.rentEstimate),
    monthlyTaxes: getNumberValue(payload.monthlyTaxes),
    monthlyInsurance: getNumberValue(payload.monthlyInsurance),
    mapUrl: getStringValue(payload.mapUrl),
    propertySourceUrl: getStringValue(payload.propertySourceUrl),
    permitUrl: getStringValue(payload.permitUrl),
    taxRecordUrl: getStringValue(payload.taxRecordUrl),
    appraisalReportUrl: getStringValue(payload.appraisalReportUrl),
    coverPhotoUrl: getStringValue(payload.coverPhotoUrl),
    beforePhotos: Array.isArray(payload.beforePhotos) ? payload.beforePhotos : [],
    progressPhotos: Array.isArray(payload.progressPhotos) ? payload.progressPhotos : [],
    afterPhotos: Array.isArray(payload.afterPhotos) ? payload.afterPhotos : [],
    floorPlanUrls: Array.isArray(payload.floorPlanUrls) ? payload.floorPlanUrls : [],
    supportingDocumentUrls: Array.isArray(payload.supportingDocumentUrls) ? payload.supportingDocumentUrls : [],
    notes: getStringValue(payload.notes),
    favorite: Boolean(payload.favorite),
    comps: Array.isArray(payload.comps) ? payload.comps : [],
    createdAt: getStringValue(payload.createdAt),
    updatedAt: getStringValue(payload.updatedAt),
  };
}

function validateAppraisalPacket(packet) {
  const errors = [];
  if (!packet.packetName) errors.push("packetName is required");
  if (!packet.address) errors.push("address is required");
  if (!packet.city) errors.push("city is required");
  if (!packet.state) errors.push("state is required");
  if (!packet.zipCode) errors.push("zipCode is required");
  if (!packet.propertyType) errors.push("propertyType is required");
  if (!packet.packetStatus) errors.push("packetStatus is required");

  const numericFields = [
    ["purchasePrice", 0, null],
    ["rehabBudget", 0, null],
    ["actualRehabCost", 0, null],
    ["currentValue", 0, null],
    ["requestedARV", 0, null],
    ["supportedARV", 0, null],
    ["appraisalValue", 0, null],
    ["loanAmount", 0, null],
    ["bedrooms", 0, null],
    ["bathrooms", 0, null],
    ["squareFeet", 0, null],
    ["lotSize", 0, null],
    ["yearBuilt", 0, null],
    ["units", 0, null],
    ["rentEstimate", 0, null],
    ["monthlyTaxes", 0, null],
    ["monthlyInsurance", 0, null],
  ];

  numericFields.forEach(([field, min, max]) => {
    const value = packet[field];
    if (value === "" || value === null || value === undefined) return;
    if (Number.isNaN(Number(value))) {
      errors.push(`${field} must be numeric`);
      return;
    }
    if (min !== null && Number(value) < min) errors.push(`${field} cannot be negative`);
    if (max !== null && Number(value) > max) errors.push(`${field} must remain between 0 and ${max}`);
  });

  return errors;
}

function normalizeRehabProjectPayload(payload = {}) {
  return {
    id: getStringValue(payload.id),
    projectName: getStringValue(payload.projectName),
    propertyId: getStringValue(payload.propertyId),
    propertyName: getStringValue(payload.propertyName),
    propertyAddress: getStringValue(payload.propertyAddress),
    city: getStringValue(payload.city),
    state: getStringValue(payload.state),
    zipCode: getStringValue(payload.zipCode),
    strategy: getStringValue(payload.strategy, "Flip"),
    projectType: getStringValue(payload.projectType, "Full Gut"),
    projectStatus: getStringValue(payload.projectStatus, "Planning"),
    priority: getStringValue(payload.priority, "Medium"),
    projectManager: getStringValue(payload.projectManager),
    contractorId: getStringValue(payload.contractorId),
    contractorName: getStringValue(payload.contractorName),
    lenderId: getStringValue(payload.lenderId),
    lenderName: getStringValue(payload.lenderName),
    projectedStartDate: getStringValue(payload.projectedStartDate),
    actualStartDate: getStringValue(payload.actualStartDate),
    projectedCompletionDate: getStringValue(payload.projectedCompletionDate),
    actualCompletionDate: getStringValue(payload.actualCompletionDate),
    currentPhase: getStringValue(payload.currentPhase, "Planning"),
    nextMilestone: getStringValue(payload.nextMilestone),
    nextMilestoneDate: getStringValue(payload.nextMilestoneDate),
    percentComplete: getNumberValue(payload.percentComplete),
    purchasePrice: getNumberValue(payload.purchasePrice),
    originalRehabBudget: getNumberValue(payload.originalRehabBudget),
    approvedChangeOrders: getNumberValue(payload.approvedChangeOrders),
    pendingChangeOrders: getNumberValue(payload.pendingChangeOrders),
    currentRehabBudget: getNumberValue(payload.currentRehabBudget),
    committedCost: getNumberValue(payload.committedCost),
    actualCost: getNumberValue(payload.actualCost),
    amountPaid: getNumberValue(payload.amountPaid),
    remainingBudget: getNumberValue(payload.remainingBudget),
    projectedFinalCost: getNumberValue(payload.projectedFinalCost),
    budgetVariance: getNumberValue(payload.budgetVariance),
    contingencyPercentage: getNumberValue(payload.contingencyPercentage),
    contingencyAmount: getNumberValue(payload.contingencyAmount),
    contingencyUsed: getNumberValue(payload.contingencyUsed),
    contingencyRemaining: getNumberValue(payload.contingencyRemaining),
    projectedARV: getNumberValue(payload.projectedARV),
    totalProjectCost: getNumberValue(payload.totalProjectCost),
    projectedProfit: getNumberValue(payload.projectedProfit),
    projectedROI: getNumberValue(payload.projectedROI),
    drawCount: getNumberValue(payload.drawCount),
    drawAmountRequested: getNumberValue(payload.drawAmountRequested),
    drawAmountApproved: getNumberValue(payload.drawAmountApproved),
    drawAmountPaid: getNumberValue(payload.drawAmountPaid),
    permitStatus: getStringValue(payload.permitStatus),
    lienWaiverStatus: getStringValue(payload.lienWaiverStatus),
    insuranceStatus: getStringValue(payload.insuranceStatus),
    licenseStatus: getStringValue(payload.licenseStatus),
    finalInspectionStatus: getStringValue(payload.finalInspectionStatus),
    punchListStatus: getStringValue(payload.punchListStatus),
    closeoutStatus: getStringValue(payload.closeoutStatus),
    riskLevel: getStringValue(payload.riskLevel, "Moderate"),
    recommendation: getStringValue(payload.recommendation, "Watch"),
    favorite: Boolean(payload.favorite),
    notes: getStringValue(payload.notes),
    createdAt: getStringValue(payload.createdAt),
    updatedAt: getStringValue(payload.updatedAt),
    phases: Array.isArray(payload.phases) ? payload.phases : [],
    budgetLineItems: Array.isArray(payload.budgetLineItems) ? payload.budgetLineItems : [],
    changeOrders: Array.isArray(payload.changeOrders) ? payload.changeOrders : [],
    draws: Array.isArray(payload.draws) ? payload.draws : [],
    inspections: Array.isArray(payload.inspections) ? payload.inspections : [],
    punchListItems: Array.isArray(payload.punchListItems) ? payload.punchListItems : [],
    projectPhotos: Array.isArray(payload.projectPhotos) ? payload.projectPhotos : [],
    projectDocuments: Array.isArray(payload.projectDocuments) ? payload.projectDocuments : [],
  };
}

function validateRehabProject(project) {
  const errors = [];
  if (!project.projectName) errors.push("projectName is required");
  if (!project.propertyAddress && !project.propertyId) errors.push("propertyAddress or propertyId is required");
  if (!project.projectType) errors.push("projectType is required");
  if (!project.projectStatus) errors.push("projectStatus is required");
  if (!project.strategy) errors.push("strategy is required");
  if (!project.priority) errors.push("priority is required");
  if (project.originalRehabBudget === "" || project.originalRehabBudget === null || project.originalRehabBudget === undefined) errors.push("originalRehabBudget is required");
  if (!project.projectedStartDate) errors.push("projectedStartDate is required");
  if (!project.projectedCompletionDate) errors.push("projectedCompletionDate is required");
  const numericFields = ["purchasePrice", "originalRehabBudget", "approvedChangeOrders", "pendingChangeOrders", "currentRehabBudget", "committedCost", "actualCost", "amountPaid", "contingencyPercentage", "contingencyUsed", "projectedARV", "percentComplete", "drawAmountRequested", "drawAmountApproved", "drawAmountPaid"];
  numericFields.forEach((field) => {
    const value = project[field];
    if (value === "" || value === null || value === undefined) return;
    if (Number.isNaN(Number(value))) {
      errors.push(`${field} must be numeric`);
      return;
    }
    if (Number(value) < 0) errors.push(`${field} cannot be negative`);
  });
  const percentFields = ["contingencyPercentage", "percentComplete"];
  percentFields.forEach((field) => {
    const value = project[field];
    if (value === "" || value === null || value === undefined) return;
    const numericValue = Number(value);
    if (numericValue < 0 || numericValue > 100) errors.push(`${field} must remain between 0 and 100`);
  });
  if (project.projectedStartDate && project.projectedCompletionDate && new Date(project.projectedCompletionDate) < new Date(project.projectedStartDate)) errors.push("projectedCompletionDate cannot precede projectedStartDate");
  return errors;
}

function normalizeLenderPayload(payload = {}) {
  return {
    id: getStringValue(payload.id),
    lenderName: getStringValue(payload.lenderName),
    lenderType: getStringValue(payload.lenderType),
    contactName: getStringValue(payload.contactName),
    contactTitle: getStringValue(payload.contactTitle),
    phone: getStringValue(payload.phone),
    email: getStringValue(payload.email),
    website: getStringValue(payload.website),
    portalUrl: getStringValue(payload.portalUrl),
    sourceUrl: getStringValue(payload.sourceUrl),
    address: getStringValue(payload.address),
    city: getStringValue(payload.city),
    state: getStringValue(payload.state),
    zipCode: getStringValue(payload.zipCode),
    loanProgramName: getStringValue(payload.loanProgramName),
    loanPurpose: getStringValue(payload.loanPurpose),
    propertyTypesAllowed: getStringValue(payload.propertyTypesAllowed),
    statesAllowed: getStringValue(payload.statesAllowed),
    minimumLoanAmount: getNumberValue(payload.minimumLoanAmount),
    maximumLoanAmount: getNumberValue(payload.maximumLoanAmount),
    maximumPurchaseLTV: getNumberValue(payload.maximumPurchaseLTV),
    maximumARVLTV: getNumberValue(payload.maximumARVLTV),
    maximumLTC: getNumberValue(payload.maximumLTC),
    interestRate: getNumberValue(payload.interestRate),
    rateType: getStringValue(payload.rateType),
    originationPoints: getNumberValue(payload.originationPoints),
    underwritingFee: getNumberValue(payload.underwritingFee),
    processingFee: getNumberValue(payload.processingFee),
    appraisalFee: getNumberValue(payload.appraisalFee),
    legalFee: getNumberValue(payload.legalFee),
    drawFee: getNumberValue(payload.drawFee),
    extensionFee: getNumberValue(payload.extensionFee),
    minimumInterestMonths: getNumberValue(payload.minimumInterestMonths),
    loanTermMonths: getNumberValue(payload.loanTermMonths),
    extensionOptions: getStringValue(payload.extensionOptions),
    interestOnly: getStringValue(payload.interestOnly),
    recourseType: getStringValue(payload.recourseType),
    personalGuaranteeRequired: getStringValue(payload.personalGuaranteeRequired),
    prepaymentPenalty: getStringValue(payload.prepaymentPenalty),
    rehabFinancingAvailable: getStringValue(payload.rehabFinancingAvailable),
    rehabAdvancePercentage: getNumberValue(payload.rehabAdvancePercentage),
    drawScheduleType: getStringValue(payload.drawScheduleType),
    drawTurnaroundDays: getNumberValue(payload.drawTurnaroundDays),
    appraisalRequired: getStringValue(payload.appraisalRequired),
    creditScoreMinimum: getNumberValue(payload.creditScoreMinimum),
    liquidityRequirement: getNumberValue(payload.liquidityRequirement),
    experienceRequirement: getNumberValue(payload.experienceRequirement),
    entityRequired: getStringValue(payload.entityRequired),
    insuranceRequirements: getStringValue(payload.insuranceRequirements),
    titleRequirements: getStringValue(payload.titleRequirements),
    seasoningRequirementMonths: getNumberValue(payload.seasoningRequirementMonths),
    refinanceAvailable: getStringValue(payload.refinanceAvailable),
    refinanceMaximumLTV: getNumberValue(payload.refinanceMaximumLTV),
    DSCRMinimum: getNumberValue(payload.DSCRMinimum),
    minimumOccupancy: getNumberValue(payload.minimumOccupancy),
    termSheetDate: getStringValue(payload.termSheetDate),
    termSheetExpiration: getStringValue(payload.termSheetExpiration),
    approvalStatus: getStringValue(payload.approvalStatus),
    activeStatus: getStringValue(payload.activeStatus),
    preferredLender: getStringValue(payload.preferredLender),
    reliabilityScore: getNumberValue(payload.reliabilityScore),
    speedScore: getNumberValue(payload.speedScore),
    pricingScore: getNumberValue(payload.pricingScore),
    communicationScore: getNumberValue(payload.communicationScore),
    flexibilityScore: getNumberValue(payload.flexibilityScore),
    overallScore: getNumberValue(payload.overallScore),
    totalLoans: getNumberValue(payload.totalLoans),
    activeLoans: getNumberValue(payload.activeLoans),
    totalOriginalBalance: getNumberValue(payload.totalOriginalBalance),
    totalCurrentBalance: getNumberValue(payload.totalCurrentBalance),
    totalInterestPaid: getNumberValue(payload.totalInterestPaid),
    totalFeesPaid: getNumberValue(payload.totalFeesPaid),
    lastLoanDate: getStringValue(payload.lastLoanDate),
    lastContactDate: getStringValue(payload.lastContactDate),
    favorite: Boolean(payload.favorite),
    notes: getStringValue(payload.notes),
    createdAt: getStringValue(payload.createdAt),
    updatedAt: getStringValue(payload.updatedAt),
  };
}

function validateLender(lender) {
  const errors = [];
  if (!lender.lenderName) errors.push("lenderName is required");
  if (!lender.lenderType) errors.push("lenderType is required");
  if (!lender.loanProgramName) errors.push("loanProgramName is required");
  if (!lender.approvalStatus) errors.push("approvalStatus is required");
  if (!lender.activeStatus) errors.push("activeStatus is required");

  const numericFields = [
    ["minimumLoanAmount", 0, null],
    ["maximumLoanAmount", 0, null],
    ["maximumPurchaseLTV", 0, 100],
    ["maximumARVLTV", 0, 100],
    ["maximumLTC", 0, 100],
    ["interestRate", 0, 100],
    ["originationPoints", 0, 100],
    ["underwritingFee", 0, null],
    ["processingFee", 0, null],
    ["appraisalFee", 0, null],
    ["legalFee", 0, null],
    ["drawFee", 0, null],
    ["extensionFee", 0, null],
    ["minimumInterestMonths", 0, null],
    ["loanTermMonths", 0, null],
    ["rehabAdvancePercentage", 0, 100],
    ["drawTurnaroundDays", 0, null],
    ["creditScoreMinimum", 300, 850],
    ["liquidityRequirement", 0, null],
    ["experienceRequirement", 0, null],
    ["seasoningRequirementMonths", 0, null],
    ["refinanceMaximumLTV", 0, 100],
    ["DSCRMinimum", 0, null],
    ["minimumOccupancy", 0, 100],
    ["reliabilityScore", 0, 10],
    ["speedScore", 0, 10],
    ["pricingScore", 0, 10],
    ["communicationScore", 0, 10],
    ["flexibilityScore", 0, 10],
    ["overallScore", 0, 10],
  ];

  numericFields.forEach(([field, min, max]) => {
    const value = lender[field];
    if (value === "" || value === null || value === undefined) return;
    if (Number.isNaN(Number(value))) {
      errors.push(`${field} must be numeric`);
      return;
    }
    if (min !== null && Number(value) < min) errors.push(`${field} cannot be below ${min}`);
    if (max !== null && Number(value) > max) errors.push(`${field} cannot exceed ${max}`);
  });

  return errors;
}

function validateNeighborhood(neighborhood) {
  const errors = [];
  if (!neighborhood.neighborhoodName) errors.push("neighborhoodName is required");
  if (!neighborhood.city) errors.push("city is required");
  if (!neighborhood.state) errors.push("state is required");
  if (!neighborhood.zipCode) errors.push("zipCode is required");

  const numericFields = [
    ["latitude", -90, 90],
    ["longitude", -180, 180],
    ["medianHomeValue", 0, null],
    ["medianRent", 0, null],
    ["averageRent", 0, null],
    ["averageDaysOnMarket", 0, null],
    ["medianPricePerSquareFoot", 0, null],
    ["activeInventory", 0, null],
    ["monthsOfSupply", 0, null],
    ["vacancyRate", 0, 100],
    ["ownerOccupancyRate", 0, 100],
    ["population", 0, null],
    ["medianHouseholdIncome", 0, null],
    ["schoolRating", 0, 10],
    ["investorDemandScore", 0, 100],
    ["rentalDemandScore", 0, 100],
  ];

  numericFields.forEach(([field, min, max]) => {
    const value = neighborhood[field];
    if (value === "" || value === null || value === undefined) return;
    if (Number.isNaN(Number(value))) {
      errors.push(`${field} must be numeric`);
      return;
    }
    if (min !== null && Number(value) < min) errors.push(`${field} cannot be below ${min}`);
    if (max !== null && Number(value) > max) errors.push(`${field} cannot exceed ${max}`);
  });

  return errors;
}

async function ensureDataFile(filePath, fallbackData) {
  await fs.mkdir(dataDir, { recursive: true });
  try {
    await fs.access(filePath);
  } catch {
    await writeJsonFile(filePath, fallbackData);
  }
}

async function createRecoveryCopy(filePath) {
  const recoveryDir = path.join(dataDir, '.recovery');
  await fs.mkdir(recoveryDir, { recursive: true });
  const backupName = `${path.basename(filePath)}.${Date.now()}.bak`;
  const backupPath = path.join(recoveryDir, backupName);
  try {
    await fs.copyFile(filePath, backupPath);
  } catch {
    // ignore recovery failures
  }
  return backupPath;
}

async function readJsonArrayFile(filePath, fallbackData, label = 'data') {
  await ensureDataFile(filePath, fallbackData);
  try {
    const content = await fs.readFile(filePath, 'utf8');
    if (!content.trim()) return fallbackData;
    const parsed = JSON.parse(content);
    if (!Array.isArray(parsed)) throw new Error(`${label} is invalid`);
    return parsed;
  } catch (error) {
    await createRecoveryCopy(filePath);
    console.error(`Unable to read ${label} from ${path.basename(filePath)}. Using safe fallback.`, error.message);
    return fallbackData;
  }
}

async function readMigratedJsonArrayFile(filePath, fallbackData, label = 'data', entityType = 'deal') {
  const rawData = await readJsonArrayFile(filePath, fallbackData, label);
  const migrated = migrateLegacyEnterpriseData(rawData, { entityType });
  return Array.isArray(migrated) ? migrated : fallbackData;
}

async function writeJsonFile(filePath, payload) {
  const tempFilePath = path.join(dataDir, `${path.basename(filePath)}.${Date.now()}.tmp`);
  const content = `${JSON.stringify(payload, null, 2)}\n`;
  try {
    await fs.writeFile(tempFilePath, content, "utf8");
    await fs.rm(filePath, { force: true });
    await fs.rename(tempFilePath, filePath);
  } catch (error) {
    await fs.rm(tempFilePath, { force: true }).catch(() => {});
    throw error;
  }
}

async function writePropertiesFile(properties) { await writeJsonFile(propertiesFile, properties); }
async function readPropertiesFile() { return readJsonArrayFile(propertiesFile, [], "properties"); }
async function writeDealsFile(deals) { await writeJsonFile(dealsFile, deals); }
async function readDealsFile() {
  const deals = await readJsonArrayFile(dealsFile, [], "deals");
  const normalizedDeals = Array.isArray(deals) ? deals.map((entry) => buildPersistedDealPayload(entry)) : [];
  const needsWrite = JSON.stringify(normalizedDeals) !== JSON.stringify(deals);
  if (needsWrite) {
    await writeDealsFile(normalizedDeals);
  }
  return normalizedDeals;
}
async function writeProductsFile(products) { await writeJsonFile(productsFile, products); }
async function readProductsFile() { return readMigratedJsonArrayFile(productsFile, [], "products", "product"); }
async function writeContractorsFile(contractors) { await writeJsonFile(contractorsFile, contractors); }
async function readContractorsFile() { return readMigratedJsonArrayFile(contractorsFile, [], "contractors", "contractor"); }
async function writeCompsFile(comps) { await writeJsonFile(compsFile, comps); }
async function readCompsFile() { return readJsonArrayFile(compsFile, [], "comps"); }

function mapCompRecordForResponse(comp, subjectProperty = {}) {
  const normalized = buildNormalizedCompRecord(comp, subjectProperty, comp.provider || (activeCompProvider?.constructor?.name === "RentCastCompAdapter" ? "rentcast" : "manual"));
  const quality = scoreCompQuality(normalized, subjectProperty);
  return {
    ...normalized,
    ...quality,
    qualityScore: quality.finalCompQualityScore,
  };
}

function buildCompProviderStatus() {
  const providerStatus = activeCompProvider.getProviderStatus();
  const rentcastStatus = compProviderAdapters.rentcast.getProviderStatus();
  const effectiveStatus = rentcastStatus.errorCode === "not_configured" ? rentcastStatus : providerStatus;
  return {
    provider: effectiveStatus.provider,
    status: effectiveStatus.status,
    configured: effectiveStatus.configured,
    keyPresent: effectiveStatus.keyPresent,
    errorCode: effectiveStatus.errorCode || null,
    availableProviders: ["manual", "rentcast"],
  };
}
async function writeNeighborhoodsFile(neighborhoods) { await writeJsonFile(neighborhoodsFile, neighborhoods); }
async function readNeighborhoodsFile() { return readJsonArrayFile(neighborhoodsFile, [], "neighborhoods"); }
async function writeDealIntelligenceFile(analyses) { await writeJsonFile(dealIntelligenceFile, analyses); }
async function readDealIntelligenceFile() {
  const deals = await readDealsFile();
  const stored = await readJsonArrayFile(dealIntelligenceFile, [], "deal intelligence");
  return getStoredOrGeneratedDealIntelligence(stored, deals);
}
async function writePortfolioFile(portfolio) { await writeJsonFile(portfolioFile, portfolio); }
async function readPortfolioFile() { return readMigratedJsonArrayFile(portfolioFile, [], "portfolio", "property"); }
async function writeVendorsFile(vendors) { await writeJsonFile(vendorsFile, vendors); }
async function readVendorsFile() { return readJsonArrayFile(vendorsFile, [], "vendors"); }
async function writeMaterialsFile(materials) { await writeJsonFile(materialsFile, materials); }
async function readMaterialsFile() { return readMigratedJsonArrayFile(materialsFile, [], "materials", "material"); }
async function writeLendersFile(lenders) { await writeJsonFile(lendersFile, lenders); }
async function readLendersFile() { return readMigratedJsonArrayFile(lendersFile, [], "lenders", "lender"); }
async function writeAppraisalPacketsFile(packets) { await writeJsonFile(appraisalPacketsFile, packets); }
async function readAppraisalPacketsFile() { return readMigratedJsonArrayFile(appraisalPacketsFile, [], "appraisal packets", "appraisalPacket"); }
async function writeRehabProjectsFile(projects) { await writeJsonFile(rehabProjectsFile, projects); }
async function readRehabProjectsFile() { return readMigratedJsonArrayFile(rehabProjectsFile, [], "rehab projects", "rehabProject"); }


function setCorsHeaders(res, req) {
  const origin = req.headers.origin;
  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  } else {
    res.setHeader("Access-Control-Allow-Origin", "*");
  }
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload));
}

async function buildOperationsPayload() {
  const [deals, properties, rehabProjects, contractors, lenders, portfolioEntries] = await Promise.all([
    readDealsFile(),
    readPropertiesFile(),
    readRehabProjectsFile(),
    readContractorsFile(),
    readLendersFile(),
    readPortfolioFile(),
  ]);

  const now = new Date().toISOString();
  const activeRecordCount = [deals, properties, rehabProjects, contractors, lenders, portfolioEntries].reduce((total, entries) => total + (Array.isArray(entries) ? entries.length : 0), 0);
  const workflowStatus = activeRecordCount > 0 ? 'Healthy' : 'Preparing';
  const workflowStage = activeRecordCount > 0 ? 'Operational' : 'Bootstrapping';

  return {
    workflow: {
      workflowId: 'rsos-ops-workflow',
      name: 'RSOS Operations',
      currentStage: workflowStage,
      status: workflowStatus,
      sourceModule: 'RSOS Backend',
      startedAt: now,
      lastUpdatedAt: now,
      runtime: 0,
      completedStages: ['Bootstrap', 'Health Check'],
      pendingStages: [],
      failedStage: 'None',
      retryCount: 0,
      manualOverrideStatus: 'Not Applied',
      finalResult: 'Operational',
    },
    recoveries: [],
    auditEvents: [],
    monitoring: {
      healthScore: activeRecordCount > 0 ? 100 : 90,
      backendStatus: 'Healthy',
      apiStatus: 'Healthy',
      eventBusStatus: 'Healthy',
      schedulerStatus: 'Healthy',
      workflowEngineStatus: 'Healthy',
      recoveryEngineStatus: 'Healthy',
      telemetryStatus: 'Healthy',
      queueDepth: 0,
      successRate: 100,
      failureRate: 0,
      averageRuntime: 0,
      processingLatency: 0,
      recoveryFrequency: 0,
      lastSuccessfulExecution: now,
      lastFailedExecution: null,
      lastVerificationTime: now,
    },
    alerts: [],
  };
}

async function handleCollection(req, res, entity, readFile, writeFile, normalizeFn, validateFn, newIdPrefix) {
  const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
  const segments = url.pathname.split("/").filter(Boolean);
  const itemId = segments[2];

  if (req.method === "GET" && !itemId) {
    let items = await readFile();
    if (entity === "deal intelligence" && (!Array.isArray(items) || items.length === 0)) {
      try {
        items = await syncDealIntelligenceStore();
      } catch (error) {
        console.error("[RSOS] Unable to sync deal intelligence on demand", error);
      }
    }
    const responseItems = entity === "deal"
      ? (Array.isArray(items) ? items.map((entry) => buildPersistedDealPayload(entry)) : items)
      : items;
    sendJson(res, 200, responseItems);
    return;
  }

  if (req.method === "GET" && itemId) {
    const items = await readFile();
    const item = items.find((entry) => entry.id === itemId);
    if (!item) {
      sendJson(res, 404, { error: `${entity} not found` });
      return;
    }
    const responseItem = entity === "deal" ? buildPersistedDealPayload(item) : item;
    sendJson(res, 200, responseItem);
    return;
  }

  if (req.method === "POST" && !itemId) {
    const auth = authorizeRequest(req, res, "write");
    if (!auth.allowed) return;
    if (!enforceRateLimit(req, res, "write")) return;
    let payload = {};
    try {
      payload = await readJsonBody(req);
    } catch (error) {
      if (error instanceof HttpRequestBodyError) {
        sendStructuredError(res, error.statusCode, error.message, error.errorType, req.requestContext?.requestId || "");
        return;
      }
      throw error;
    }
    const sanitizedPayload = sanitizeIncomingPayload(payload);
    const persistedPayload = entity === "deal" ? buildPersistedDealPayload(sanitizedPayload) : sanitizedPayload;
    const normalized = normalizeFn(persistedPayload);
    const errors = validateFn(normalized);
    if (errors.length > 0) {
      sendStructuredError(res, 400, "Validation failed", "validation_error", req.requestContext?.requestId || "");
      return;
    }
    const items = await readFile();
    const now = new Date().toISOString();
    const item = { ...normalized, id: createId(newIdPrefix), createdAt: now, updatedAt: now };
    items.push(item);
    await writeFile(items);
    if (entity === "deal") {
      try {
        await syncDealIntelligenceStore();
      } catch (error) {
        console.error("[RSOS] Unable to sync deal intelligence after save", error);
      }
    }
    sendJson(res, 201, item);
    return;
  }

  if (req.method === "PUT" && itemId) {
    const auth = authorizeRequest(req, res, "write");
    if (!auth.allowed) return;
    if (!enforceRateLimit(req, res, "write")) return;
    let payload = {};
    try {
      payload = await readJsonBody(req);
    } catch (error) {
      if (error instanceof HttpRequestBodyError) {
        sendStructuredError(res, error.statusCode, error.message, error.errorType, req.requestContext?.requestId || "");
        return;
      }
      throw error;
    }
    const sanitizedPayload = sanitizeIncomingPayload(payload);
    const persistedPayload = entity === "deal" ? buildPersistedDealPayload(sanitizedPayload) : sanitizedPayload;
    const normalized = normalizeFn(persistedPayload);
    const errors = validateFn(normalized);
    if (errors.length > 0) {
      sendStructuredError(res, 400, "Validation failed", "validation_error", req.requestContext?.requestId || "");
      return;
    }
    const items = await readFile();
    const targetIndex = items.findIndex((entry) => entry.id === itemId);
    if (targetIndex === -1) {
      sendJson(res, 404, { error: `${entity} not found` });
      return;
    }
    const existingItem = items[targetIndex];
    const updatedItem = { ...existingItem, ...normalized, id: existingItem.id, createdAt: existingItem.createdAt, updatedAt: new Date().toISOString() };
    items[targetIndex] = updatedItem;
    await writeFile(items);
    if (entity === "deal") {
      try {
        await syncDealIntelligenceStore();
      } catch (error) {
        console.error("[RSOS] Unable to sync deal intelligence after update", error);
      }
    }
    sendJson(res, 200, updatedItem);
    return;
  }

  if (req.method === "DELETE" && itemId) {
    const auth = authorizeRequest(req, res, "delete");
    if (!auth.allowed) return;
    if (!enforceRateLimit(req, res, "delete")) return;
    const items = await readFile();
    const targetIndex = items.findIndex((entry) => entry.id === itemId);
    if (targetIndex === -1) {
      sendJson(res, 404, { error: `${entity} not found` });
      return;
    }
    items.splice(targetIndex, 1);
    await writeFile(items);
    if (entity === "deal") {
      try {
        await syncDealIntelligenceStore();
      } catch (error) {
        console.error("[RSOS] Unable to sync deal intelligence after delete", error);
      }
    }
    sendJson(res, 200, { success: true, deletedId: itemId });
    return;
  }

  sendJson(res, 405, { error: "Method not allowed" });
}

const server = http.createServer(async (req, res) => {
  setCorsHeaders(res, req);

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
  const pathname = url.pathname;
  const segments = pathname.split("/").filter(Boolean);

  try {
    createRequestContext(req, res);

    if (pathname === "/health" || pathname === "/api/health") {
      const dataFiles = {};
      const candidateFiles = [
        ["deals", dealsFile],
        ["properties", propertiesFile],
        ["comps", compsFile],
        ["neighborhoods", neighborhoodsFile],
        ["lenders", lendersFile],
      ];

      for (const [key, filePath] of candidateFiles) {
        try {
          await fs.access(filePath);
          dataFiles[key] = true;
        } catch {
          dataFiles[key] = false;
        }
      }

      sendJson(res, 200, {
        status: "ok",
        timestamp: new Date().toISOString(),
        server: true,
        dataDirectory: true,
        dataFiles,
        service: "rsos-backend",
        schemaVersion,
        healthy: true,
        ready: true,
      });
      return;
    }

    if (pathname === "/ready" || pathname === "/api/ready") {
      const authSummary = await getAuthSummary().catch(() => ({}));
      sendJson(res, 200, {
        status: "ready",
        ready: true,
        timestamp: new Date().toISOString(),
        service: "rsos-backend",
        auth: authSummary,
      });
      return;
    }

    if (pathname === "/api/auth/login") {
      if (req.method !== "POST") {
        sendJson(res, 405, { error: "Method not allowed" });
        return;
      }
      let payload = {};
      try {
        payload = await readJsonBody(req);
      } catch (error) {
        if (error instanceof HttpRequestBodyError) {
          sendStructuredError(res, error.statusCode, error.message, error.errorType, req.requestContext?.requestId || "");
          return;
        }
        throw error;
      }
      const username = typeof payload?.username === "string" ? payload.username : "";
      const password = typeof payload?.password === "string" ? payload.password : "";
      const ipAddress = req.socket?.remoteAddress || req.headers["x-forwarded-for"] || "unknown";
      const authResult = await authenticateUser({ username, password, ipAddress }, process.env);
      if (!authResult.ok) {
        safeConsoleLog("warn", "login_failed", { reason: authResult.reason, username: redactSensitiveValue(username) });
        sendStructuredError(res, 401, "Invalid credentials", "auth_error", req.requestContext?.requestId || "");
        return;
      }
      safeConsoleLog("info", "login_succeeded", { username: redactSensitiveValue(username) });
      sendJson(res, 200, { ok: true, session: authResult.session });
      return;
    }

    if (pathname === "/api/auth/me") {
      const sessionId = req.headers["x-session-id"] || req.headers["x-rsos-session-id"] || "";
      const ipAddress = req.socket?.remoteAddress || req.headers["x-forwarded-for"] || "unknown";
      const session = await verifySession(sessionId, ipAddress);
      if (!session) {
        sendStructuredError(res, 401, "Session expired", "auth_error", req.requestContext?.requestId || "");
        return;
      }
      sendJson(res, 200, { ok: true, session });
      return;
    }

    if (pathname === "/api/auth/logout") {
      const sessionId = req.headers["x-session-id"] || req.headers["x-rsos-session-id"] || "";
      await logoutSession(sessionId);
      sendJson(res, 200, { ok: true });
      return;
    }

    if (pathname === "/api/monitoring") {
      const [dealsCount, propertiesCount, rehabProjectsCount] = await Promise.all([
        readDealsFile().then((items) => items.length).catch(() => 0),
        readPropertiesFile().then((items) => items.length).catch(() => 0),
        readRehabProjectsFile().then((items) => items.length).catch(() => 0),
      ]);

      sendJson(res, 200, {
        status: "ok",
        timestamp: new Date().toISOString(),
        service: "rsos-backend",
        healthy: true,
        summary: {
          deals: dealsCount,
          properties: propertiesCount,
          rehabProjects: rehabProjectsCount,
          uptimeSeconds: Math.round(process.uptime()),
          processId: process.pid,
        },
      });
      return;
    }

    if (segments[0] === "api" && segments[1] === "operations") {
      const operationsPayload = await buildOperationsPayload();
      if (!segments[2] || segments[2] === "") {
        sendJson(res, 200, operationsPayload);
        return;
      }
      if (segments[2] === "workflow") {
        sendJson(res, 200, { workflow: operationsPayload.workflow });
        return;
      }
      if (segments[2] === "recoveries" || segments[2] === "recovery") {
        sendJson(res, 200, { recoveries: operationsPayload.recoveries });
        return;
      }
      if (segments[2] === "audit") {
        sendJson(res, 200, { auditEvents: operationsPayload.auditEvents });
        return;
      }
      if (segments[2] === "monitoring") {
        sendJson(res, 200, { monitoring: operationsPayload.monitoring });
        return;
      }
      if (segments[2] === "alerts") {
        sendJson(res, 200, { alerts: operationsPayload.alerts });
        return;
      }
      sendJson(res, 404, { error: "Operations endpoint not found" });
      return;
    }

    if (segments[0] === "api" && segments[1] === "properties") {
      await handleCollection(req, res, "property", readPropertiesFile, writePropertiesFile, normalizePropertyPayload, validateProperty, "property");
      return;
    }

    if (segments[0] === "api" && segments[1] === "deals") {
      await handleCollection(req, res, "deal", readDealsFile, writeDealsFile, normalizeDealPayload, validateDeal, "deal");
      return;
    }

    if (segments[0] === "api" && segments[1] === "deal-intelligence") {
      await handleCollection(req, res, "deal intelligence", readDealIntelligenceFile, writeDealIntelligenceFile, normalizeDealIntelligencePayload, validateDealIntelligence, "analysis");
      return;
    }

    if (segments[0] === "api" && segments[1] === "products") {
      await handleCollection(req, res, "product", readProductsFile, writeProductsFile, (payload) => ({ ...payload }), () => [], "product");
      return;
    }

    if (segments[0] === "api" && segments[1] === "contractors") {
      await handleCollection(req, res, "contractor", readContractorsFile, writeContractorsFile, (payload) => ({ ...payload }), () => [], "contractor");
      return;
    }

    if (segments[0] === "api" && segments[1] === "comps") {
      if (req.method === "GET" && segments[2] === "provider-status") {
        sendJson(res, 200, buildCompProviderStatus());
        return;
      }
      if (req.method === "POST" && segments[2] === "provider-test") {
        const auth = authorizeRequest(req, res, "write");
        if (!auth.allowed) return;
        if (!enforceRateLimit(req, res, "write")) return;
        const result = await activeCompProvider.testConnection();
        sendJson(res, 200, result);
        return;
      }
      if (req.method === "POST" && segments[2] === "subject-property") {
        const auth = authorizeRequest(req, res, "write");
        if (!auth.allowed) return;
        if (!enforceRateLimit(req, res, "write")) return;
        let payload = {};
        try {
          payload = await readJsonBody(req);
        } catch (error) {
          if (error instanceof HttpRequestBodyError) {
            sendStructuredError(res, error.statusCode, error.message, error.errorType, req.requestContext?.requestId || "");
            return;
          }
          throw error;
        }
        const sanitizedPayload = sanitizeIncomingPayload(payload);
        const address = getStringValue(sanitizedPayload.address || sanitizedPayload.subjectAddress);
        if (!address) {
          sendStructuredError(res, 400, "Address is required", "validation_error", req.requestContext?.requestId || "");
          return;
        }
        const subjectResult = await activeCompProvider.getSubjectProperty(address);
        addProviderSearchHistory({ operation: "subject-property", query: { address }, ok: subjectResult.ok, status: subjectResult.status, errorCode: subjectResult.errorCode || null });
        sendJson(res, 200, {
          ok: subjectResult.ok,
          status: subjectResult.status,
          errorCode: subjectResult.errorCode || null,
          property: subjectResult.property || null,
        });
        return;
      }
      if (req.method === "POST" && segments[2] === "sold-comps") {
        const auth = authorizeRequest(req, res, "write");
        if (!auth.allowed) return;
        if (!enforceRateLimit(req, res, "write")) return;
        let payload = {};
        try {
          payload = await readJsonBody(req);
        } catch (error) {
          if (error instanceof HttpRequestBodyError) {
            sendStructuredError(res, error.statusCode, error.message, error.errorType, req.requestContext?.requestId || "");
            return;
          }
          throw error;
        }
        const sanitizedPayload = sanitizeIncomingPayload(payload);
        const query = normalizeProviderSearchQuery(sanitizedPayload);
        if (!query.address) {
          sendStructuredError(res, 400, "Address is required", "validation_error", req.requestContext?.requestId || "");
          return;
        }
        const providerStatus = activeCompProvider.getProviderStatus();
        if (!providerStatus.configured || providerStatus.errorCode === "not_configured") {
          addProviderSearchHistory({ operation: "sold-comps", query, ok: false, status: "RentCast Not Configured", errorCode: providerStatus.errorCode || "not_configured" });
          sendJson(res, 200, { ok: false, status: "RentCast Not Configured", errorCode: providerStatus.errorCode || "not_configured", records: [], resultCount: 0 });
          return;
        }
        const providerResults = await activeCompProvider.searchSoldComparables(query);
        const storedComps = await readCompsFile();
        const seenKeys = new Set(storedComps.map((item) => [item.providerRecordId, item.address, item.compAddress].filter(Boolean).join("|")));
        const now = new Date().toISOString();
        const importedRecords = [];
        const records = Array.isArray(providerResults) ? providerResults : [];
        records.forEach((record) => {
          const key = [record.providerRecordId, record.address, record.compAddress].filter(Boolean).join("|");
          if (!key || seenKeys.has(key)) return;
          seenKeys.add(key);
          const importedRecord = normalizeCompPayload({
            compAddress: record.address || "",
            city: record.city || "",
            state: record.state || "",
            zipCode: record.zip || record.zipCode || "",
            salePrice: record.salePrice || "",
            saleDate: record.saleDate || "",
            propertyType: record.propertyType || "Single Family",
            bedrooms: record.bedrooms || "",
            bathrooms: record.bathrooms || "",
            squareFeet: record.squareFeet || "",
            yearBuilt: record.yearBuilt || "",
            distanceMiles: record.distanceMiles || "",
            condition: record.condition || "Average",
            source: "RentCast Provider",
            sourceLink: record.sourceURL || record.sourceLink || "",
            notes: record.notes || "",
            provider: "rentcast",
            providerImported: true,
            manuallyEntered: false,
            verified: false,
            inclusionStatus: "pending",
            included: false,
            active: true,
            subjectProperty: query.address || "",
            createdAt: now,
            updatedAt: now,
          });
          importedRecords.push({ ...importedRecord, id: createId("comp"), createdAt: now, updatedAt: now });
        });
        if (importedRecords.length > 0) {
          await writeCompsFile([...storedComps, ...importedRecords]);
        }
        addProviderSearchHistory({ operation: "sold-comps", query, ok: true, status: providerResults.length > 0 ? "Success" : "No Qualifying Comps", resultCount: importedRecords.length });
        sendJson(res, 200, { ok: true, status: providerResults.length > 0 ? "Success" : "No Qualifying Comps", errorCode: null, records: importedRecords, resultCount: importedRecords.length });
        return;
      }
      if (req.method === "POST" && segments[2] === "active-listings") {
        const auth = authorizeRequest(req, res, "write");
        if (!auth.allowed) return;
        if (!enforceRateLimit(req, res, "write")) return;
        let payload = {};
        try {
          payload = await readJsonBody(req);
        } catch (error) {
          if (error instanceof HttpRequestBodyError) {
            sendStructuredError(res, error.statusCode, error.message, error.errorType, req.requestContext?.requestId || "");
            return;
          }
          throw error;
        }
        const sanitizedPayload = sanitizeIncomingPayload(payload);
        const query = normalizeProviderSearchQuery(sanitizedPayload);
        if (!query.address) {
          sendStructuredError(res, 400, "Address is required", "validation_error", req.requestContext?.requestId || "");
          return;
        }
        const providerStatus = activeCompProvider.getProviderStatus();
        if (!providerStatus.configured || providerStatus.errorCode === "not_configured") {
          addProviderSearchHistory({ operation: "active-listings", query, ok: false, status: "RentCast Not Configured", errorCode: providerStatus.errorCode || "not_configured" });
          sendJson(res, 200, { ok: false, status: "RentCast Not Configured", errorCode: providerStatus.errorCode || "not_configured", records: [], resultCount: 0 });
          return;
        }
        const providerResults = await activeCompProvider.searchActiveListings(query);
        addProviderSearchHistory({ operation: "active-listings", query, ok: true, status: providerResults.length > 0 ? "Success" : "No Results", resultCount: providerResults.length });
        sendJson(res, 200, { ok: true, status: providerResults.length > 0 ? "Success" : "No Results", errorCode: null, records: providerResults, resultCount: providerResults.length });
        return;
      }
      if (req.method === "POST" && segments[2] === "refresh-comp") {
        const auth = authorizeRequest(req, res, "write");
        if (!auth.allowed) return;
        if (!enforceRateLimit(req, res, "write")) return;
        let payload = {};
        try {
          payload = await readJsonBody(req);
        } catch (error) {
          if (error instanceof HttpRequestBodyError) {
            sendStructuredError(res, error.statusCode, error.message, error.errorType, req.requestContext?.requestId || "");
            return;
          }
          throw error;
        }
        const sanitizedPayload = sanitizeIncomingPayload(payload);
        const compId = getStringValue(sanitizedPayload.compId);
        if (!compId) {
          sendStructuredError(res, 400, "Comp ID is required", "validation_error", req.requestContext?.requestId || "");
          return;
        }
        const storedComps = await readCompsFile();
        const existingComp = storedComps.find((entry) => entry.id === compId);
        if (!existingComp) {
          sendStructuredError(res, 404, "Comp not found", "not_found", req.requestContext?.requestId || "");
          return;
        }
        const providerStatus = activeCompProvider.getProviderStatus();
        if (!providerStatus.configured || providerStatus.errorCode === "not_configured") {
          sendJson(res, 200, { ok: false, status: "RentCast Not Configured", errorCode: providerStatus.errorCode || "not_configured" });
          return;
        }
        const refreshedProperty = await activeCompProvider.getSubjectProperty(existingComp.compAddress || existingComp.address || "");
        sendJson(res, 200, { ok: refreshedProperty.ok, status: refreshedProperty.status, errorCode: refreshedProperty.errorCode || null, property: refreshedProperty.property || null });
        return;
      }
      if (req.method === "GET" && segments[2] === "provider-search-history") {
        sendJson(res, 200, providerSearchHistory);
        return;
      }
      if (req.method === "GET") {
        const items = await readCompsFile();
        const subjectProperty = {};
        const mapped = items.map((item) => mapCompRecordForResponse(item, subjectProperty));
        sendJson(res, 200, mapped);
        return;
      }
      await handleCollection(req, res, "comp", readCompsFile, writeCompsFile, normalizeCompPayload, validateComp, "comp");
      return;
    }

    if (segments[0] === "api" && segments[1] === "neighborhoods") {
      await handleCollection(req, res, "neighborhood", readNeighborhoodsFile, writeNeighborhoodsFile, normalizeNeighborhoodPayload, validateNeighborhood, "neighborhood");
      return;
    }

    if (segments[0] === "api" && segments[1] === "portfolio") {
      await handleCollection(req, res, "portfolio", readPortfolioFile, writePortfolioFile, normalizePortfolioPayload, validatePortfolio, "portfolio");
      return;
    }

    if (segments[0] === "api" && segments[1] === "vendors") {
      await handleCollection(req, res, "vendor", readVendorsFile, writeVendorsFile, normalizeVendorPayload, validateVendor, "vendor");
      return;
    }

    if (segments[0] === "api" && segments[1] === "materials") {
      await handleCollection(req, res, "material", readMaterialsFile, writeMaterialsFile, normalizeMaterialPayload, validateMaterial, "material");
      return;
    }

    if (segments[0] === "api" && segments[1] === "lenders") {
      await handleCollection(req, res, "lender", readLendersFile, writeLendersFile, normalizeLenderPayload, validateLender, "lender");
      return;
    }

    if (segments[0] === "api" && segments[1] === "appraisal-packets") {
      await handleCollection(req, res, "appraisal packet", readAppraisalPacketsFile, writeAppraisalPacketsFile, normalizeAppraisalPacketPayload, validateAppraisalPacket, "packet");
      return;
    }

    if (segments[0] === "api" && segments[1] === "rehab-projects") {
      await handleCollection(req, res, "rehab project", readRehabProjectsFile, writeRehabProjectsFile, normalizeRehabProjectPayload, validateRehabProject, "project");
      return;
    }

    if (segments[0] === "api" && segments[1] === "material-matrix") {
      await handleCollection(req, res, "material matrix entry", readMaterialsFile, writeMaterialsFile, (payload) => ({ ...payload }), () => [], "material");
      return;
    }

    sendJson(res, 404, { error: "Not found" });
  } catch (error) {
    console.error("[RSOS] Request failed:", error.message);
    sendStructuredError(res, 500, "Internal server error", "internal_error", req.requestContext?.requestId || "");
  }
});

const serverInstance = server.listen(port, "127.0.0.1", async () => {
  try {
    await initializeAuthState(process.env);
    await syncDealIntelligenceStore();
  } catch (error) {
    console.error("[RSOS] Unable to initialize deal intelligence store", error);
  }
  safeConsoleLog("info", "backend_listening", { port, host: "127.0.0.1" });
});

for (const signal of shutdownSignals) {
  process.on(signal, () => {
    safeConsoleLog("info", "shutdown_requested", { signal });
    serverInstance.close(() => process.exit(0));
  });
}
