import { useEffect, useMemo, useState } from "react";
import { buildApiUrl } from "../utils/apiClient.js";
import { fetchBackendConnectionStatus } from "../utils/backendConnectionStatus.js";
import logo from "../assets/royal-star-logo.png";
import { buildImportPreview, normalizeRecordForStorage } from "./enterpriseDataIntegration.js";
import { resolveCountyParcelSearch } from "../utils/countyParcelRegistry.js";
import { evaluateWorkflowTransition, getWorkflowProgress, getWorkflowStageOrder } from "../utils/propertyWorkflowEngine.js";
import { DEAL_STATUS_OPTIONS } from "../utils/dealWorkflowRegistry.js";

const navigation = [
  ["🏠", "COMMAND CENTER"],
  ["🔎", "DEAL ANALYZER"],
  ["📈", "FLIP ANALYZER"],
  ["💳", "BRRRR ANALYZER"],
  ["▣", "PRODUCT VAULT"],
  ["👥", "CONTRACTOR HUB"],
  ["🏘️", "COMP DATABASE"],
  ["📍", "NEIGHBORHOOD DB"],
  ["👥", "PORTFOLIO DASHBOARD"],
  ["🗂️", "PROPERTY DATABASE"],
];

const propertyTypeOptions = ["Single Family", "Duplex", "Triplex", "Fourplex", "Condominium", "Townhouse", "Mixed Use", "Small Multifamily", "Commercial", "Other"];
const statusOptions = DEAL_STATUS_OPTIONS;
const strategyOptions = ["Flip", "BRRRR", "Rental", "Hold", "Refinance", "Wholesale", "Sale", "Other"];
const occupancyOptions = ["Vacant", "Owner Occupied", "Tenant Occupied", "Partially Occupied", "Under Rehab", "Unknown"];
const favoriteOptions = ["All", "Favorites Only"];
const sortOptions = [
  ["newest", "Newest"],
  ["oldest", "Oldest"],
  ["highestValue", "Highest Value"],
  ["highestEquity", "Highest Equity"],
  ["lowestLtv", "Lowest LTV"],
  ["highestRent", "Highest Rent"],
  ["highestPsf", "Highest Price / Sq Ft"],
  ["longestOwned", "Longest Owned"],
  ["name", "Property Name"],
];
const workflowStageOptions = getWorkflowStageOrder();
const initialValues = {
  id: "",
  propertyName: "",
  propertyStatus: "Lead",
  pipelineStage: "New Lead",
  ownershipStatus: "Not Owned",
  strategy: "Hold",
  propertyType: "Single Family",
  address: "",
  unitNumber: "",
  city: "",
  county: "",
  state: "",
  zipCode: "",
  parcelNumber: "",
  parcelRetrievalSourceUrl: "",
  parcelRetrievedAt: "",
  parcelVerificationStatus: "Pending",
  parcelUserConfirmedAt: "",
  legalDescription: "",
  neighborhood: "",
  schoolDistrict: "",
  yearBuilt: "",
  squareFeet: "",
  lotSize: "",
  bedrooms: "",
  bathrooms: "",
  units: "",
  stories: "",
  basementType: "",
  garageType: "",
  garageSpaces: "",
  constructionType: "",
  roofType: "",
  heatingType: "",
  coolingType: "",
  waterSource: "",
  sewerType: "",
  occupancyStatus: "Unknown",
  currentOccupant: "",
  ownerEntity: "",
  currentOwnerName: "",
  sellerName: "",
  sellerPhone: "",
  sellerEmail: "",
  acquisitionSource: "",
  acquisitionDate: "",
  closingDate: "",
  purchasePrice: "",
  earnestMoney: "",
  closingCosts: "",
  totalCashInvested: "",
  originalRehabBudget: "",
  currentRehabBudget: "",
  actualRehabCost: "",
  rehabStatus: "Not Started",
  rehabProjectId: "",
  rehabPercentComplete: "",
  projectedRehabCompletionDate: "",
  holdingCosts: "",
  financingCosts: "",
  permitCosts: "",
  insuranceCosts: "",
  utilityCosts: "",
  taxesDuringProject: "",
  cleanupCosts: "",
  sellingCosts: "",
  totalProjectCost: "",
  currentValue: "",
  projectedARV: "",
  supportedARV: "",
  appraisedValue: "",
  arvVariance: "",
  pricePerSquareFoot: "",
  rehabCostPerSquareFoot: "",
  listPrice: "",
  listingDate: "",
  salePrice: "",
  saleDate: "",
  listingAgentName: "",
  sellingAgentName: "",
  monthlyRent: "",
  marketRent: "",
  annualGrossRent: "",
  monthlyTaxes: "",
  monthlyInsurance: "",
  monthlyHOA: "",
  monthlyUtilities: "",
  monthlyMaintenance: "",
  monthlyManagement: "",
  monthlyDebtService: "",
  monthlyOperatingExpenses: "",
  monthlyCashFlow: "",
  annualCashFlow: "",
  annualNetOperatingIncome: "",
  capRate: "",
  cashOnCashReturn: "",
  originalLoanAmount: "",
  currentLoanBalance: "",
  interestRate: "",
  loanTermMonths: "",
  loanMaturityDate: "",
  lenderId: "",
  lenderName: "",
  loanProgram: "",
  loanToValue: "",
  equity: "",
  projectedProfit: "",
  projectedROI: "",
  actualProfit: "",
  actualROI: "",
  linkedDealId: "",
  contractorId: "",
  contractorName: "",
  appraisalPacketId: "",
  appraisalStatus: "",
  appraiserName: "",
  riskLevel: "Low",
  recommendation: "Ready for Analysis",
  warningCount: "",
  mapUrl: "",
  streetViewUrl: "",
  countyRecordUrl: "",
  taxRecordUrl: "",
  listingUrl: "",
  propertySourceUrl: "",
  insurancePolicyUrl: "",
  titleDocumentUrl: "",
  purchaseContractUrl: "",
  settlementStatementUrl: "",
  appraisalReportUrl: "",
  inspectionReportUrl: "",
  permitUrl: "",
  coverPhotoUrl: "",
  beforePhotos: [],
  demoPhotos: [],
  progressPhotos: [],
  inspectionPhotos: [],
  punchListPhotos: [],
  afterPhotos: [],
  floorPlanUrls: [],
  otherPhotos: [],
  documentUrls: [],
  notes: "",
  dataQualityHistory: "[]",
  workflowTransitionHistory: "[]",
  workflowBlockers: "[]",
  workflowCompletionPercent: "",
  workflowRollbackReason: "",
  favorite: false,
  createdAt: "",
  updatedAt: "",
};

function createId(prefix = "property") {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

function parseNumber(value) {
  if (value === "" || value === null || value === undefined) return "";
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : "";
}

function getStringValue(source, fallback = "") {
  const value = source ?? fallback;
  return typeof value === "string" ? value : "";
}

function formatCurrency(value) {
  if (value === "" || value === null || value === undefined || !Number.isFinite(Number(value))) return "Insufficient Data";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(Number(value));
}

function formatPercent(value) {
  if (value === "" || value === null || value === undefined || !Number.isFinite(Number(value))) return "Insufficient Data";
  return `${Number(value).toFixed(1)}%`;
}

function buildAddressQuery(values = {}) {
  return [values.address, values.city, values.state, values.zipCode].filter(Boolean).join(", ").trim();
}

function buildGoogleMapsUrl(values = {}) {
  const query = buildAddressQuery(values);
  if (!query) return "";
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

function hasSufficientAddressData(values = {}) {
  return Boolean(`${values.address || ""}`.trim() && `${values.city || ""}`.trim() && `${values.state || ""}`.trim());
}

function mapLinkHintText(values = {}) {
  if (`${values.mapUrl || ""}`.trim()) return "Map link available";
  return hasSufficientAddressData(values) ? "Missing Map Link" : "Insufficient Address Data";
}

function normalizeComparableText(value) {
  return `${value || ""}`.toLowerCase().replace(/\s+/g, " ").trim();
}

function isExactDuplicateProperty(left = {}, right = {}) {
  const sameAddress = normalizeComparableText(left.address) && normalizeComparableText(left.address) === normalizeComparableText(right.address);
  const sameCity = normalizeComparableText(left.city) && normalizeComparableText(left.city) === normalizeComparableText(right.city);
  const sameState = normalizeComparableText(left.state) && normalizeComparableText(left.state) === normalizeComparableText(right.state);
  const sameZip = normalizeComparableText(left.zipCode) && normalizeComparableText(left.zipCode) === normalizeComparableText(right.zipCode);
  const sameParcel = normalizeComparableText(left.parcelNumber) && normalizeComparableText(left.parcelNumber) === normalizeComparableText(right.parcelNumber);
  const sameName = normalizeComparableText(left.propertyName) && normalizeComparableText(left.propertyName) === normalizeComparableText(right.propertyName);
  return sameParcel || (sameAddress && sameCity && sameState && sameZip && sameName);
}

function buildCountyParcelSearchUrl(values = {}) {
  const resolved = resolveCountyParcelSearch(values);
  return resolved.url || "";
}

function parseJsonArray(value) {
  if (Array.isArray(value)) return value;
  if (typeof value !== "string") return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function downloadFile(filename, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function downloadCsv(filename, rows) {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const csvRows = [headers.join(",")];
  rows.forEach((row) => {
    const values = headers.map((header) => `"${String(row[header] ?? "").replace(/"/g, '""')}"`);
    csvRows.push(values.join(","));
  });
  downloadFile(filename, csvRows.join("\n"), "text/csv");
}

function normalizePropertyPayload(values) {
  return {
    id: getStringValue(values.id),
    propertyName: getStringValue(values.propertyName),
    propertyStatus: getStringValue(values.propertyStatus || values.status, "Lead"),
    pipelineStage: getStringValue(values.pipelineStage, "New Lead"),
    ownershipStatus: getStringValue(values.ownershipStatus, "Not Owned"),
    strategy: getStringValue(values.strategy, "Hold"),
    propertyType: getStringValue(values.propertyType, "Single Family"),
    address: getStringValue(values.address),
    unitNumber: getStringValue(values.unitNumber),
    city: getStringValue(values.city),
    county: getStringValue(values.county),
    state: getStringValue(values.state),
    zipCode: getStringValue(values.zipCode),
    parcelNumber: getStringValue(values.parcelNumber),
    parcelRetrievalSourceUrl: getStringValue(values.parcelRetrievalSourceUrl),
    parcelRetrievedAt: getStringValue(values.parcelRetrievedAt),
    parcelVerificationStatus: getStringValue(values.parcelVerificationStatus, "Pending"),
    parcelUserConfirmedAt: getStringValue(values.parcelUserConfirmedAt),
    legalDescription: getStringValue(values.legalDescription),
    neighborhood: getStringValue(values.neighborhood),
    schoolDistrict: getStringValue(values.schoolDistrict),
    yearBuilt: parseNumber(values.yearBuilt),
    squareFeet: parseNumber(values.squareFeet),
    lotSize: parseNumber(values.lotSize),
    bedrooms: parseNumber(values.bedrooms),
    bathrooms: parseNumber(values.bathrooms),
    units: parseNumber(values.units),
    stories: parseNumber(values.stories),
    basementType: getStringValue(values.basementType),
    garageType: getStringValue(values.garageType),
    garageSpaces: parseNumber(values.garageSpaces),
    constructionType: getStringValue(values.constructionType),
    roofType: getStringValue(values.roofType),
    heatingType: getStringValue(values.heatingType),
    coolingType: getStringValue(values.coolingType),
    waterSource: getStringValue(values.waterSource),
    sewerType: getStringValue(values.sewerType),
    occupancyStatus: getStringValue(values.occupancyStatus, "Unknown"),
    currentOccupant: getStringValue(values.currentOccupant),
    ownerEntity: getStringValue(values.ownerEntity),
    currentOwnerName: getStringValue(values.currentOwnerName),
    sellerName: getStringValue(values.sellerName),
    sellerPhone: getStringValue(values.sellerPhone),
    sellerEmail: getStringValue(values.sellerEmail),
    acquisitionSource: getStringValue(values.acquisitionSource),
    acquisitionDate: getStringValue(values.acquisitionDate),
    closingDate: getStringValue(values.closingDate),
    purchasePrice: parseNumber(values.purchasePrice),
    earnestMoney: parseNumber(values.earnestMoney),
    closingCosts: parseNumber(values.closingCosts),
    totalCashInvested: parseNumber(values.totalCashInvested),
    originalRehabBudget: parseNumber(values.originalRehabBudget),
    currentRehabBudget: parseNumber(values.currentRehabBudget),
    actualRehabCost: parseNumber(values.actualRehabCost),
    rehabStatus: getStringValue(values.rehabStatus, "Not Started"),
    rehabProjectId: getStringValue(values.rehabProjectId),
    rehabPercentComplete: parseNumber(values.rehabPercentComplete),
    projectedRehabCompletionDate: getStringValue(values.projectedRehabCompletionDate),
    holdingCosts: parseNumber(values.holdingCosts),
    financingCosts: parseNumber(values.financingCosts),
    permitCosts: parseNumber(values.permitCosts),
    insuranceCosts: parseNumber(values.insuranceCosts),
    utilityCosts: parseNumber(values.utilityCosts),
    taxesDuringProject: parseNumber(values.taxesDuringProject),
    cleanupCosts: parseNumber(values.cleanupCosts),
    sellingCosts: parseNumber(values.sellingCosts),
    totalProjectCost: parseNumber(values.totalProjectCost),
    currentValue: parseNumber(values.currentValue),
    projectedARV: parseNumber(values.projectedARV),
    supportedARV: parseNumber(values.supportedARV),
    appraisedValue: parseNumber(values.appraisedValue),
    arvVariance: parseNumber(values.arvVariance),
    pricePerSquareFoot: parseNumber(values.pricePerSquareFoot),
    rehabCostPerSquareFoot: parseNumber(values.rehabCostPerSquareFoot),
    listPrice: parseNumber(values.listPrice),
    listingDate: getStringValue(values.listingDate),
    salePrice: parseNumber(values.salePrice),
    saleDate: getStringValue(values.saleDate),
    listingAgentName: getStringValue(values.listingAgentName),
    sellingAgentName: getStringValue(values.sellingAgentName),
    monthlyRent: parseNumber(values.monthlyRent),
    marketRent: parseNumber(values.marketRent),
    annualGrossRent: parseNumber(values.annualGrossRent),
    monthlyTaxes: parseNumber(values.monthlyTaxes),
    monthlyInsurance: parseNumber(values.monthlyInsurance),
    monthlyHOA: parseNumber(values.monthlyHOA),
    monthlyUtilities: parseNumber(values.monthlyUtilities),
    monthlyMaintenance: parseNumber(values.monthlyMaintenance),
    monthlyManagement: parseNumber(values.monthlyManagement),
    monthlyDebtService: parseNumber(values.monthlyDebtService),
    monthlyOperatingExpenses: parseNumber(values.monthlyOperatingExpenses),
    monthlyCashFlow: parseNumber(values.monthlyCashFlow),
    annualCashFlow: parseNumber(values.annualCashFlow),
    annualNetOperatingIncome: parseNumber(values.annualNetOperatingIncome),
    capRate: parseNumber(values.capRate),
    cashOnCashReturn: parseNumber(values.cashOnCashReturn),
    originalLoanAmount: parseNumber(values.originalLoanAmount),
    currentLoanBalance: parseNumber(values.currentLoanBalance),
    interestRate: parseNumber(values.interestRate),
    loanTermMonths: parseNumber(values.loanTermMonths),
    loanMaturityDate: getStringValue(values.loanMaturityDate),
    lenderId: getStringValue(values.lenderId),
    lenderName: getStringValue(values.lenderName),
    loanProgram: getStringValue(values.loanProgram),
    loanToValue: parseNumber(values.loanToValue),
    equity: parseNumber(values.equity),
    projectedProfit: parseNumber(values.projectedProfit),
    projectedROI: parseNumber(values.projectedROI),
    actualProfit: parseNumber(values.actualProfit),
    actualROI: parseNumber(values.actualROI),
    linkedDealId: getStringValue(values.linkedDealId),
    contractorId: getStringValue(values.contractorId),
    contractorName: getStringValue(values.contractorName),
    appraisalPacketId: getStringValue(values.appraisalPacketId),
    appraisalStatus: getStringValue(values.appraisalStatus),
    appraiserName: getStringValue(values.appraiserName),
    riskLevel: getStringValue(values.riskLevel, "Low"),
    recommendation: getStringValue(values.recommendation, "Ready for Analysis"),
    warningCount: parseNumber(values.warningCount),
    mapUrl: getStringValue(values.mapUrl),
    streetViewUrl: getStringValue(values.streetViewUrl),
    countyRecordUrl: getStringValue(values.countyRecordUrl),
    taxRecordUrl: getStringValue(values.taxRecordUrl),
    listingUrl: getStringValue(values.listingUrl),
    propertySourceUrl: getStringValue(values.propertySourceUrl),
    insurancePolicyUrl: getStringValue(values.insurancePolicyUrl),
    titleDocumentUrl: getStringValue(values.titleDocumentUrl),
    purchaseContractUrl: getStringValue(values.purchaseContractUrl),
    settlementStatementUrl: getStringValue(values.settlementStatementUrl),
    appraisalReportUrl: getStringValue(values.appraisalReportUrl),
    inspectionReportUrl: getStringValue(values.inspectionReportUrl),
    permitUrl: getStringValue(values.permitUrl),
    coverPhotoUrl: getStringValue(values.coverPhotoUrl),
    beforePhotos: Array.isArray(values.beforePhotos) ? values.beforePhotos : [],
    demoPhotos: Array.isArray(values.demoPhotos) ? values.demoPhotos : [],
    progressPhotos: Array.isArray(values.progressPhotos) ? values.progressPhotos : [],
    inspectionPhotos: Array.isArray(values.inspectionPhotos) ? values.inspectionPhotos : [],
    punchListPhotos: Array.isArray(values.punchListPhotos) ? values.punchListPhotos : [],
    afterPhotos: Array.isArray(values.afterPhotos) ? values.afterPhotos : [],
    floorPlanUrls: Array.isArray(values.floorPlanUrls) ? values.floorPlanUrls : [],
    otherPhotos: Array.isArray(values.otherPhotos) ? values.otherPhotos : [],
    documentUrls: Array.isArray(values.documentUrls) ? values.documentUrls : [],
    favorite: Boolean(values.favorite),
    notes: getStringValue(values.notes),
    dataQualityHistory: getStringValue(values.dataQualityHistory, "[]"),
    workflowTransitionHistory: getStringValue(values.workflowTransitionHistory, "[]"),
    workflowBlockers: getStringValue(values.workflowBlockers, "[]"),
    workflowCompletionPercent: parseNumber(values.workflowCompletionPercent),
    workflowRollbackReason: getStringValue(values.workflowRollbackReason),
    createdAt: getStringValue(values.createdAt),
    updatedAt: getStringValue(values.updatedAt),
    status: getStringValue(values.propertyStatus || values.status, "Lead"),
  };
}

function validateProperty(values) {
  const errors = [];
  if (!values.propertyName?.trim() && !values.address?.trim()) errors.push("Property name or address is required.");
  if (!values.city?.trim()) errors.push("City is required.");
  if (!values.state?.trim()) errors.push("State is required.");
  if (!values.zipCode?.trim()) errors.push("ZIP code is required.");
  if (!values.propertyType?.trim()) errors.push("Property type is required.");
  if (!values.propertyStatus?.trim()) errors.push("Property status is required.");
  if (!values.strategy?.trim()) errors.push("Strategy is required.");

  const numericChecks = [
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

  numericChecks.forEach(([field, min, max]) => {
    const value = values[field];
    if (value === "" || value === null || value === undefined) return;
    const numericValue = Number(value);
    if (!Number.isFinite(numericValue)) {
      errors.push(`${field} must be numeric.`);
      return;
    }
    if (min !== null && numericValue < min) errors.push(`${field} cannot be negative.`);
    if (max !== null && numericValue > max) errors.push(`${field} cannot exceed ${max}.`);
  });

  if (values.acquisitionDate && values.closingDate && new Date(values.closingDate) < new Date(values.acquisitionDate)) errors.push("Closing date cannot precede acquisition date.");
  if (values.listingDate && values.saleDate && new Date(values.listingDate) > new Date(values.saleDate)) errors.push("Listing date cannot follow sale date.");

  return errors;
}

function getDerivedMetrics(property) {
  const purchasePrice = Number(property.purchasePrice || property.purchasePrice || 0);
  const closingCosts = Number(property.closingCosts || 0);
  const actualRehabCost = Number(property.actualRehabCost || 0);
  const holdingCosts = Number(property.holdingCosts || 0);
  const financingCosts = Number(property.financingCosts || 0);
  const permitCosts = Number(property.permitCosts || 0);
  const insuranceCosts = Number(property.insuranceCosts || 0);
  const utilityCosts = Number(property.utilityCosts || 0);
  const taxesDuringProject = Number(property.taxesDuringProject || 0);
  const cleanupCosts = Number(property.cleanupCosts || 0);
  const sellingCosts = Number(property.sellingCosts || 0);
  const currentValue = Number(property.currentValue || property.currentEstimatedValue || 0);
  const currentLoanBalance = Number(property.currentLoanBalance || 0);
  const monthlyRent = Number(property.monthlyRent || 0);
  const monthlyTaxes = Number(property.monthlyTaxes || 0);
  const monthlyInsurance = Number(property.monthlyInsurance || 0);
  const monthlyHOA = Number(property.monthlyHOA || 0);
  const monthlyUtilities = Number(property.monthlyUtilities || 0);
  const monthlyMaintenance = Number(property.monthlyMaintenance || 0);
  const monthlyManagement = Number(property.monthlyManagement || 0);
  const monthlyDebtService = Number(property.monthlyDebtService || 0);
  const squareFeet = Number(property.squareFeet || 0);
  const annualGrossRent = monthlyRent * 12;
  const monthlyOperatingExpenses = monthlyTaxes + monthlyInsurance + monthlyHOA + monthlyUtilities + monthlyMaintenance + monthlyManagement;
  const monthlyCashFlow = monthlyRent - monthlyOperatingExpenses - monthlyDebtService;
  const annualCashFlow = monthlyCashFlow * 12;
  const annualNetOperatingIncome = annualGrossRent - monthlyOperatingExpenses * 12;
  const totalProjectCost = purchasePrice + actualRehabCost + closingCosts + holdingCosts + financingCosts + permitCosts + insuranceCosts + utilityCosts + taxesDuringProject + cleanupCosts + sellingCosts;
  const equity = currentValue - currentLoanBalance;
  const ltv = currentValue > 0 ? (currentLoanBalance / currentValue) * 100 : "";
  const pricePerSqft = squareFeet > 0 ? currentValue / squareFeet : "";
  const rehabCostPerSqft = squareFeet > 0 ? actualRehabCost / squareFeet : "";
  const projectedProfit = Number(property.projectedARV || 0) - totalProjectCost;
  const projectedRoi = totalProjectCost > 0 ? (projectedProfit / totalProjectCost) * 100 : "";
  const capRate = currentValue > 0 ? (annualNetOperatingIncome / currentValue) * 100 : "";
  const cashOnCashReturn = Number(property.totalCashInvested || 0) > 0 ? (annualCashFlow / Number(property.totalCashInvested || 0)) * 100 : "";
  const arvVariance = Number(property.projectedARV || 0) - Number(property.supportedARV || 0);

  return {
    totalProjectCost,
    equity,
    ltv,
    pricePerSqft,
    rehabCostPerSqft,
    annualGrossRent,
    monthlyOperatingExpenses,
    monthlyCashFlow,
    annualCashFlow,
    annualNetOperatingIncome,
    projectedProfit,
    projectedRoi,
    capRate,
    cashOnCashReturn,
    arvVariance,
  };
}

function getWarnings(property) {
  const warnings = [];
  const metrics = getDerivedMetrics(property);
  const status = property.propertyStatus || property.status || "Lead";
  const isRental = ["Rental", "BRRRR"].includes(property.strategy);

  if (!property.parcelNumber) warnings.push("Missing parcel number");
  if (!property.legalDescription) warnings.push("Missing legal description");
  if (!property.mapUrl) warnings.push("Missing map link");
  if (!property.countyRecordUrl) warnings.push("Missing county record link");
  if (!property.taxRecordUrl) warnings.push("Missing tax record link");
  if (!property.titleDocumentUrl) warnings.push("Missing title document");
  if (!property.purchaseContractUrl) warnings.push("Missing purchase contract");
  if (!property.settlementStatementUrl && (status === "Closed" || status === "Sold")) warnings.push("Missing settlement statement after closing");
  if (!property.insurancePolicyUrl) warnings.push("Missing insurance policy");
  if (!property.coverPhotoUrl && !property.beforePhotos?.length && !property.progressPhotos?.length && !property.afterPhotos?.length) warnings.push("Missing photos");
  if (!property.documentUrls?.length) warnings.push("Missing documents");
  if (!property.currentValue) warnings.push("Missing current value");
  if (metrics.equity < 0) warnings.push("Negative equity");
  if (metrics.ltv !== "" && metrics.ltv > 75) warnings.push("LTV above 75%");
  if (metrics.ltv !== "" && metrics.ltv > 80) warnings.push("LTV above 80%");
  if (status === "In Rehab" && !property.contractorName) warnings.push("Missing contractor while in rehab");
  if (metrics.monthlyCashFlow < 0) warnings.push("Negative monthly cash flow");
  if (Number(property.currentRehabBudget || 0) > 0 && Number(property.actualRehabCost || 0) > Number(property.currentRehabBudget || 0)) warnings.push("Actual rehab cost above budget");
  if (Number(property.currentRehabBudget || 0) > 0 && Number(property.originalRehabBudget || 0) > 0 && Number(property.currentRehabBudget || 0) > Number(property.originalRehabBudget || 0)) warnings.push("Current rehab budget above original budget");
  if (metrics.projectedProfit < 0) warnings.push("Negative projected profit");
  if (isRental && !property.monthlyRent) warnings.push("Missing rent on a rental property");
  if (status === "Sold" && !property.salePrice) warnings.push("Sold property missing sale price");
  if ((status === "Closed" || status === "Sold") && !property.closingDate) warnings.push("Closed property missing closing date");
  if (!property.updatedAt) warnings.push("Record not updated within 90 days");

  return warnings;
}

function getGrade(property) {
  const warnings = getWarnings(property);
  const metrics = getDerivedMetrics(property);
  if (warnings.some((warning) => ["Negative equity", "LTV above 80%", "Missing current value"].includes(warning))) return "F";
  if (metrics.equity > 0 && metrics.ltv !== "" && metrics.ltv <= 80 && warnings.length <= 2) return "A";
  if (metrics.equity >= 0 && warnings.length <= 4) return "B";
  if (warnings.length <= 8) return "C";
  return "D";
}

function getRecommendation(property) {
  const metrics = getDerivedMetrics(property);
  const warnings = getWarnings(property);
  const status = property.propertyStatus || property.status || "Lead";
  if (warnings.some((warning) => ["Negative equity", "LTV above 80%", "Missing current value"].includes(warning))) return "Critical Intervention";
  if (status === "In Rehab") return "Proceed";
  if (status === "Sold") return "Sell";
  if (metrics.monthlyCashFlow < 0) return "Watch";
  if (metrics.equity > 0 && metrics.ltv !== "" && metrics.ltv < 75) return "Proceed";
  if (warnings.length > 4) return "Resolve Documentation";
  return "Ready for Analysis";
}

function getRecommendationExplanation(property) {
  const recommendation = getRecommendation(property);
  const metrics = getDerivedMetrics(property);
  const warnings = getWarnings(property);
  if (recommendation === "Critical Intervention") return "The property shows high leverage or negative equity and needs immediate attention.";
  if (recommendation === "Proceed") return "The financial profile is strong enough to move forward with the next step.";
  if (recommendation === "Watch") return `Monthly cash flow is negative at ${formatCurrency(metrics.monthlyCashFlow)} and the property should be monitored closely.`;
  if (recommendation === "Resolve Documentation") return `The record needs attention on: ${warnings.slice(0, 3).join(", ")}.`;
  return "The asset appears generally stable and is ready for analysis.";
}

export default function PropertyDatabase({
  onBack,
  onOpenDealAnalyzer,
  onOpenFlipAnalyzer,
  onOpenBrrrrAnalyzer,
  onOpenProductVault,
  onOpenContractorHub,
  onOpenCompDatabase,
  onOpenNeighborhoodDatabase,
  onOpenPortfolioDashboard,
  onOpenPropertyDatabase,
}) {
  const [properties, setProperties] = useState([]);
  const [deals, setDeals] = useState([]);
  const [portfolioEntries, setPortfolioEntries] = useState([]);
  const [formValues, setFormValues] = useState(initialValues);
  const [selectedPropertyId, setSelectedPropertyId] = useState("");
  const [message, setMessage] = useState({ type: "", text: "" });
  const [searchText, setSearchText] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [strategyFilter, setStrategyFilter] = useState("All");
  const [propertyTypeFilter, setPropertyTypeFilter] = useState("All");
  const [cityFilter, setCityFilter] = useState("All");
  const [countyFilter] = useState("All");
  const [stateFilter, setStateFilter] = useState("All");
  const [zipFilter, setZipFilter] = useState("All");
  const [occupancyFilter] = useState("All");
  const [favoriteFilter, setFavoriteFilter] = useState("All");
  const [missingParcelFilter] = useState("All");
  const [missingSourceFilter] = useState("All");
  const [staleDataFilter] = useState("All");
  const [sortBy, setSortBy] = useState("newest");
  const [comparisonIds, setComparisonIds] = useState([]);
  const [selectedDetailId, setSelectedDetailId] = useState("");
  const [connectionState, setConnectionState] = useState("Backend Connected");
  const [importDealId, setImportDealId] = useState("");
  const [importPortfolioId, setImportPortfolioId] = useState("");
  const [importText, setImportText] = useState("");
  const [importPreview, setImportPreview] = useState(null);
  const [importing, setImporting] = useState(false);
  const [duplicateDraftMeta, setDuplicateDraftMeta] = useState(null);
  const [showConnectionDetails, setShowConnectionDetails] = useState(false);
  const [connectionDetails, setConnectionDetails] = useState(null);
  const [showParcelAssistant, setShowParcelAssistant] = useState(false);
  const [parcelAssistantDraft, setParcelAssistantDraft] = useState({ parcelNumber: "", sourceUrl: "", verificationStatus: "Pending" });
  const [showDataQuality, setShowDataQuality] = useState(false);

  const refreshConnectionDetails = async (recordCount = properties.length) => {
    const details = await fetchBackendConnectionStatus({
      primaryEndpoint: "/api/properties",
      fallbackStorageKeys: ["royalStarProperties"],
      recordCount,
    });
    setConnectionDetails(details);
  };

  const triggerCrossModuleRefresh = async (dealId = "", context = {}) => {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("royalStarPropertiesUpdated"));
      window.dispatchEvent(new Event("royalStarDealsUpdated"));
      window.dispatchEvent(new Event("royalStarDataSynchronized"));
    }

    try {
      await fetch(buildApiUrl("/api/cross-module-sync"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actor: "Property Database", dealId, context }),
      });
    } catch (error) {
      console.warn("Cross-module sync refresh failed", error);
    }
  };

  useEffect(() => {
    const loadProperties = async () => {
      try {
        const response = await fetch(buildApiUrl("/api/properties"));
        if (!response.ok) throw new Error("Unable to load properties");
        const payload = await response.json();
        setProperties(Array.isArray(payload) ? payload : []);
        setConnectionState("Backend Connected");
        await refreshConnectionDetails(Array.isArray(payload) ? payload.length : 0);
      } catch (error) {
        console.error("Unable to load properties from API, using local fallback", error);
        setConnectionState("Local Fallback");
        if (typeof window !== "undefined") {
          try {
            const stored = JSON.parse(window.localStorage.getItem("royalStarProperties") || "[]") || [];
            setProperties(Array.isArray(stored) ? stored : []);
            await refreshConnectionDetails(Array.isArray(stored) ? stored.length : 0);
          } catch (localError) {
            console.error("Unable to read properties from localStorage", localError);
            setProperties([]);
            await refreshConnectionDetails(0);
          }
        }
      }
    };

    const loadDeals = async () => {
      try {
        const response = await fetch(buildApiUrl("/api/deals"));
        if (!response.ok) throw new Error("Unable to load deals");
        const payload = await response.json();
        setDeals(Array.isArray(payload) ? payload : []);
      } catch (error) {
        console.error("Unable to load deals", error);
        if (typeof window !== "undefined") {
          try {
            const stored = JSON.parse(window.localStorage.getItem("royalStarDeals") || "[]") || [];
            setDeals(Array.isArray(stored) ? stored : []);
          } catch (localError) {
            console.error("Unable to read saved deals", localError);
          }
        }
      }
    };

    const loadPortfolio = async () => {
      try {
        const response = await fetch(buildApiUrl("/api/portfolio"));
        if (!response.ok) throw new Error("Unable to load portfolio");
        const payload = await response.json();
        setPortfolioEntries(Array.isArray(payload) ? payload : []);
      } catch (error) {
        console.error("Unable to load portfolio entries", error);
        if (typeof window !== "undefined") {
          try {
            const stored = JSON.parse(window.localStorage.getItem("royalStarPortfolio") || "[]") || [];
            setPortfolioEntries(Array.isArray(stored) ? stored : []);
          } catch (localError) {
            console.error("Unable to read portfolio entries", localError);
          }
        }
      }
    };

    loadProperties();
    loadDeals();
    loadPortfolio();
  }, []);

  const normalizedProperties = useMemo(() =>
    properties.map((property) => ({
      ...property,
      propertyStatus: property.propertyStatus || property.status || "Lead",
      status: property.propertyStatus || property.status || "Lead",
      strategy: property.strategy || "Hold",
      propertyType: property.propertyType || "Single Family",
      currentEstimatedValue: property.currentValue ?? property.currentEstimatedValue ?? "",
      purchasePrice: property.purchasePrice ?? "",
      currentLoanBalance: property.currentLoanBalance ?? "",
      monthlyRent: property.monthlyRent ?? "",
      currentRehabBudget: property.currentRehabBudget ?? property.originalRehabBudget ?? property.rehabBudget ?? "",
      actualRehabCost: property.actualRehabCost ?? "",
      derived: getDerivedMetrics(property),
      warnings: getWarnings(property),
      grade: getGrade(property),
      recommendation: getRecommendation(property),
      recommendationExplanation: getRecommendationExplanation(property),
    })),
    [properties]
  );

  const filteredProperties = useMemo(() => {
    const search = searchText.trim().toLowerCase();
    let items = [...normalizedProperties];

    if (search) {
      items = items.filter((property) => {
        const haystack = [property.propertyName, property.address, property.city, property.county, property.zipCode, property.parcelNumber, property.lenderName, property.contractorName, property.currentOwner].filter(Boolean).join(" ").toLowerCase();
        return haystack.includes(search);
      });
    }
    if (statusFilter !== "All") items = items.filter((property) => property.status === statusFilter);
    if (strategyFilter !== "All") items = items.filter((property) => property.strategy === strategyFilter);
    if (propertyTypeFilter !== "All") items = items.filter((property) => property.propertyType === propertyTypeFilter);
    if (cityFilter !== "All") items = items.filter((property) => property.city === cityFilter);
    if (countyFilter !== "All") items = items.filter((property) => property.county === countyFilter);
    if (stateFilter !== "All") items = items.filter((property) => property.state === stateFilter);
    if (zipFilter !== "All") items = items.filter((property) => property.zipCode === zipFilter);
    if (occupancyFilter !== "All") items = items.filter((property) => property.occupancyStatus === occupancyFilter);
    if (favoriteFilter === "Favorites Only") items = items.filter((property) => Boolean(property.favorite));
    if (missingParcelFilter === "Yes") items = items.filter((property) => !property.parcelNumber);
    if (missingSourceFilter === "Yes") items = items.filter((property) => !property.sourceUrl);
    if (staleDataFilter === "Yes") items = items.filter((property) => {
      if (!property.dataAsOfDate) return true;
      const monthsOld = (new Date().getTime() - new Date(property.dataAsOfDate).getTime()) / (1000 * 60 * 60 * 24 * 30);
      return monthsOld > 12;
    });

    items.sort((left, right) => {
      switch (sortBy) {
        case "oldest":
          return (left.createdAt || "").localeCompare(right.createdAt || "");
        case "highestValue":
          return Number(right.currentEstimatedValue || 0) - Number(left.currentEstimatedValue || 0);
        case "highestEquity":
          return Number(right.derived.equity || 0) - Number(left.derived.equity || 0);
        case "lowestLtv":
          return Number(left.derived.ltv || 999999) - Number(right.derived.ltv || 999999);
        case "highestRent":
          return Number(right.monthlyRent || 0) - Number(left.monthlyRent || 0);
        case "highestPsf":
          return Number(right.derived.pricePerSqft || 0) - Number(left.derived.pricePerSqft || 0);
        case "longestOwned":
          return Number(right.derived.daysOwned || 0) - Number(left.derived.daysOwned || 0);
        case "name":
          return (left.propertyName || "").localeCompare(right.propertyName || "");
        default:
          return (right.createdAt || right.updatedAt || "").localeCompare(left.createdAt || left.updatedAt || "");
      }
    });

    return items;
  }, [cityFilter, countyFilter, favoriteFilter, missingParcelFilter, missingSourceFilter, normalizedProperties, occupancyFilter, propertyTypeFilter, searchText, sortBy, staleDataFilter, stateFilter, statusFilter, strategyFilter, zipFilter]);

  const selectedProperty = useMemo(() => normalizedProperties.find((property) => property.id === selectedPropertyId) || null, [normalizedProperties, selectedPropertyId]);
  const comparisonItems = useMemo(() => normalizedProperties.filter((property) => comparisonIds.includes(property.id)), [comparisonIds, normalizedProperties]);
  const detailProperty = useMemo(() => normalizedProperties.find((property) => property.id === selectedDetailId) || null, [normalizedProperties, selectedDetailId]);
  const workflowTransition = useMemo(() => evaluateWorkflowTransition(formValues, { actor: "Property Database" }), [formValues]);
  const dataQualityIssues = useMemo(() => {
    const warnings = getWarnings(formValues);
    return warnings.map((warning) => {
      let severity = "Moderate";
      let action = "Review and resolve";
      if (warning.includes("Missing parcel")) {
        severity = "High";
        action = "Use parcel assistant to retrieve and save parcel details";
      } else if (warning.includes("Missing map")) {
        severity = "High";
        action = "Regenerate map link from address";
      } else if (warning.includes("Negative")) {
        severity = "Critical";
        action = "Review valuation, debt balance, and underwriting assumptions";
      } else if (warning.includes("LTV above")) {
        severity = "High";
        action = "Re-balance leverage or refinance strategy";
      } else if (warning.includes("Missing") && warning.includes("source")) {
        severity = "Moderate";
        action = "Add source URL for verification traceability";
      }
      return {
        warning,
        severity,
        reason: warning,
        action,
        verification: warning.includes("Missing") ? "Pending" : "Manual Review",
      };
    });
  }, [formValues]);
  const dataQualityHistory = useMemo(() => parseJsonArray(formValues.dataQualityHistory), [formValues.dataQualityHistory]);

  const summaryStats = useMemo(() => {
    const total = normalizedProperties.length;
    const active = normalizedProperties.filter((property) => !["Sold", "Cancelled", "Archived"].includes(property.status)).length;
    const rehab = normalizedProperties.filter((property) => property.status === "In Rehab" || ["Planning", "In Progress", "Delayed", "Punch List"].includes(property.rehabStatus)).length;
    const rental = normalizedProperties.filter((property) => ["Rental", "BRRRR"].includes(property.strategy) && ["Ready to Rent", "Rented"].includes(property.status)).length;
    const listed = normalizedProperties.filter((property) => property.status === "Listed").length;
    const sold = normalizedProperties.filter((property) => property.status === "Sold").length;
    const totalValue = normalizedProperties.reduce((sum, property) => sum + Number(property.currentEstimatedValue || property.currentValue || 0), 0);
    const totalLoan = normalizedProperties.reduce((sum, property) => sum + Number(property.currentLoanBalance || 0), 0);
    const totalEquity = normalizedProperties.reduce((sum, property) => sum + Number(property.derived.equity || 0), 0);
    const ltvValues = normalizedProperties.map((property) => Number(property.derived.ltv || 0)).filter((value) => value > 0);
    const averageLtv = ltvValues.length > 0 ? ltvValues.reduce((sum, value) => sum + value, 0) / ltvValues.length : 0;
    const averagePsfValues = normalizedProperties.map((property) => Number(property.derived.pricePerSqft || 0)).filter((value) => value > 0);
    const averagePsf = averagePsfValues.length > 0 ? averagePsfValues.reduce((sum, value) => sum + value, 0) / averagePsfValues.length : 0;
    const averageRehabPsfValues = normalizedProperties.map((property) => Number(property.derived.rehabCostPerSqft || 0)).filter((value) => value > 0);
    const averageRehabPsf = averageRehabPsfValues.length > 0 ? averageRehabPsfValues.reduce((sum, value) => sum + value, 0) / averageRehabPsfValues.length : 0;
    const favoriteCount = normalizedProperties.filter((property) => Boolean(property.favorite)).length;
    const missingParcel = normalizedProperties.filter((property) => !property.parcelNumber).length;
    const missingMap = normalizedProperties.filter((property) => !property.mapUrl).length;
    const stale = normalizedProperties.filter((property) => {
      if (!property.updatedAt) return true;
      const monthsOld = (new Date().getTime() - new Date(property.updatedAt).getTime()) / (1000 * 60 * 60 * 24 * 30);
      return monthsOld > 3;
    }).length;

    return {
      total,
      active,
      rehab,
      rental,
      listed,
      sold,
      totalValue,
      totalLoan,
      totalEquity,
      averageLtv,
      averagePsf,
      averageRehabPsf,
      favoriteCount,
      missingParcel,
      missingMap,
      stale,
    };
  }, [normalizedProperties]);

  const statusOptionsList = useMemo(() => ["All", ...Array.from(new Set(normalizedProperties.map((property) => property.status).filter(Boolean))).sort()], [normalizedProperties]);
  const strategyOptionsList = useMemo(() => ["All", ...Array.from(new Set(normalizedProperties.map((property) => property.strategy).filter(Boolean))).sort()], [normalizedProperties]);
  const propertyTypeOptionsList = useMemo(() => ["All", ...Array.from(new Set(normalizedProperties.map((property) => property.propertyType).filter(Boolean))).sort()], [normalizedProperties]);
  const cityOptions = useMemo(() => ["All", ...Array.from(new Set(normalizedProperties.map((property) => property.city).filter(Boolean))).sort()], [normalizedProperties]);
  const stateOptions = useMemo(() => ["All", ...Array.from(new Set(normalizedProperties.map((property) => property.state).filter(Boolean))).sort()], [normalizedProperties]);
  const zipOptions = useMemo(() => ["All", ...Array.from(new Set(normalizedProperties.map((property) => property.zipCode).filter(Boolean))).sort()], [normalizedProperties]);

  const handleFieldChange = (event) => {
    const { name, value, type, checked } = event.target;
    setFormValues((prev) => ({ ...prev, [name]: type === "checkbox" ? checked : value }));
  };

  const appendDataQualityHistory = (action, details = "") => {
    const nextEntry = {
      at: new Date().toISOString(),
      actor: "Property Database",
      action,
      details,
    };
    setFormValues((prev) => {
      const history = parseJsonArray(prev.dataQualityHistory);
      return { ...prev, dataQualityHistory: JSON.stringify([...history, nextEntry]) };
    });
  };

  const handleOpenParcelAssistant = () => {
    setParcelAssistantDraft({
      parcelNumber: formValues.parcelNumber || "",
      sourceUrl: formValues.parcelRetrievalSourceUrl || formValues.countyRecordUrl || "",
      verificationStatus: formValues.parcelVerificationStatus || "Pending",
    });
    setShowParcelAssistant(true);
  };

  const handleValidateParcelFormat = () => {
    const normalized = `${parcelAssistantDraft.parcelNumber || ""}`.trim();
    const valid = /^[A-Za-z0-9.-]{6,}$/.test(normalized);
    setMessage({ type: valid ? "success" : "error", text: valid ? "Parcel format validation passed." : "Parcel format validation failed. Use at least 6 letters/numbers (hyphens and dots allowed)." });
    if (valid) {
      setParcelAssistantDraft((prev) => ({ ...prev, verificationStatus: "Format Validated" }));
    }
  };

  const handleSaveParcelAssistant = () => {
    const parcelNumber = `${parcelAssistantDraft.parcelNumber || ""}`.trim();
    if (!parcelNumber) {
      setMessage({ type: "error", text: "Parcel number is required before saving." });
      return;
    }

    const now = new Date().toISOString();
    setFormValues((prev) => ({
      ...prev,
      parcelNumber,
      countyRecordUrl: parcelAssistantDraft.sourceUrl || prev.countyRecordUrl,
      parcelRetrievalSourceUrl: parcelAssistantDraft.sourceUrl,
      parcelRetrievedAt: now,
      parcelVerificationStatus: parcelAssistantDraft.verificationStatus || "Pending",
      parcelUserConfirmedAt: now,
    }));
    appendDataQualityHistory("Parcel Saved", parcelNumber);
    setShowParcelAssistant(false);
    setMessage({ type: "success", text: "Parcel number saved with source and verification metadata." });
  };

  const handleCancelParcelAssistant = () => {
    setShowParcelAssistant(false);
    setMessage({ type: "info", text: "Parcel assistant cancelled." });
  };

  const handleWorkflowRollback = () => {
    const reason = window.prompt("Enter rollback reason:", "");
    if (!reason || !reason.trim()) {
      setMessage({ type: "error", text: "Rollback reason is required." });
      return;
    }
    const stages = getWorkflowStageOrder();
    const currentIndex = Math.max(0, stages.indexOf(formValues.pipelineStage || "New Lead"));
    const priorStage = stages[Math.max(0, currentIndex - 1)] || "New Lead";
    const now = new Date().toISOString();
    setFormValues((prev) => {
      const history = parseJsonArray(prev.workflowTransitionHistory);
      const rollbackEntry = {
        at: now,
        actor: "Property Database",
        fromStage: prev.pipelineStage || "New Lead",
        toStage: priorStage,
        reason: reason.trim(),
        type: "rollback",
      };
      return {
        ...prev,
        pipelineStage: priorStage,
        workflowRollbackReason: reason.trim(),
        workflowTransitionHistory: JSON.stringify([...history, rollbackEntry]),
      };
    });
    appendDataQualityHistory("Workflow Rollback", reason.trim());
    setMessage({ type: "info", text: `Workflow rolled back to ${priorStage}.` });
  };

  const syncLinkedDealParcel = async (dealId, payload) => {
    if (!dealId) return;
    try {
      const response = await fetch(buildApiUrl("/api/deals"));
      if (!response.ok) throw new Error("Unable to load deals for parcel sync");
      const dealList = await response.json();
      const linkedDeal = Array.isArray(dealList) ? dealList.find((deal) => deal.id === dealId) : null;
      if (!linkedDeal) return;

      const mergedNotes = [
        `${linkedDeal.notes || ""}`.trim(),
        payload.parcelNumber ? `Parcel linked from Property Database: ${payload.parcelNumber}` : "",
        payload.parcelRetrievalSourceUrl ? `Parcel source: ${payload.parcelRetrievalSourceUrl}` : "",
      ].filter(Boolean).join("\n");

      await fetch(buildApiUrl(`/api/deals/${dealId}`), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...linkedDeal,
          parcelNumber: payload.parcelNumber || linkedDeal.parcelNumber || "",
          notes: mergedNotes,
        }),
      });
    } catch (error) {
      console.warn("Unable to sync parcel data to linked deal", error);
    }
  };

  const confirmDuplicate = (candidate) => {
    const duplicateMatch = properties.find((property) => {
      const normalizedAddress = `${property.address || ""}`.toLowerCase().replace(/\s+/g, " ").trim();
      const candidateAddress = `${candidate.address || ""}`.toLowerCase().replace(/\s+/g, " ").trim();
      const sameAddress = normalizedAddress && candidateAddress && normalizedAddress === candidateAddress;
      const sameUnit = (property.unitNumber || "").toLowerCase().trim() && (candidate.unitNumber || "").toLowerCase().trim() && (property.unitNumber || "").toLowerCase().trim() === (candidate.unitNumber || "").toLowerCase().trim();
      const sameParcel = (property.parcelNumber || "").toLowerCase().trim() && (candidate.parcelNumber || "").toLowerCase().trim() && (property.parcelNumber || "").toLowerCase().trim() === (candidate.parcelNumber || "").toLowerCase().trim();
      const samePropertyName = (property.propertyName || "").toLowerCase().trim() && (candidate.propertyName || "").toLowerCase().trim() && (property.propertyName || "").toLowerCase().trim() === (candidate.propertyName || "").toLowerCase().trim();
      return sameAddress || sameUnit || sameParcel || samePropertyName;
    });

    if (duplicateMatch) {
      setMessage({ type: "info", text: `Possible duplicate detected with ${duplicateMatch.propertyName || duplicateMatch.address || "another record"}. Continue?` });
      return window.confirm("A likely duplicate property already exists. Continue creating this record?");
    }
    return true;
  };

  const handleSelectProperty = (property) => {
    setSelectedPropertyId(property.id);
    setFormValues({ ...initialValues, ...property, propertyStatus: property.propertyStatus || property.status || "Lead", favorite: Boolean(property.favorite) });
    setDuplicateDraftMeta(null);
    setMessage({ type: "", text: "" });
  };

  const handleClearForm = () => {
    setSelectedPropertyId("");
    setFormValues(initialValues);
    setDuplicateDraftMeta(null);
    setMessage({ type: "", text: "" });
  };

  const persistProperty = async (payload, existingProperty = null) => {
    if (existingProperty) {
      try {
        const response = await fetch(buildApiUrl(`/api/properties/${existingProperty.id}`), {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!response.ok) throw new Error("Unable to update property");
        return response.json();
      } catch (error) {
        console.error("Unable to update property via API, using local fallback", error);
        return { ...payload, id: existingProperty.id, createdAt: existingProperty.createdAt, updatedAt: new Date().toISOString() };
      }
    }

    try {
      const response = await fetch(buildApiUrl("/api/properties"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error("Unable to create property");
      return response.json();
    } catch (error) {
      console.error("Unable to create property via API, using local fallback", error);
      return { ...payload, id: createId(), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (duplicateDraftMeta) {
      const requiredFields = ["propertyName", "address", "city", "state", "zipCode"];
      const missingRequired = requiredFields.find((field) => !`${formValues[field] || ""}`.trim());
      if (missingRequired) {
        setMessage({ type: "error", text: `Save Duplicate requires ${missingRequired}.` });
        return;
      }
    }

    const errors = validateProperty(formValues);
    if (errors.length > 0) {
      setMessage({ type: "error", text: errors[0] });
      return;
    }

    const existingProperty = properties.find((property) => property.id === selectedPropertyId);
    const normalizedPayload = normalizePropertyPayload({ ...formValues, totalProjectCost: getDerivedMetrics(formValues).totalProjectCost });
    const matchedDeal = deals.find((deal) => {
      const dealAddress = `${deal.propertyAddress || deal.address || ''}`.toLowerCase().replace(/\s+/g, ' ').trim();
      const propertyAddress = `${normalizedPayload.address || ''}`.toLowerCase().replace(/\s+/g, ' ').trim();
      return dealAddress && propertyAddress && dealAddress === propertyAddress;
    });

    if (duplicateDraftMeta) {
      const existingByName = properties.find((property) => normalizeComparableText(property.propertyName) === normalizeComparableText(normalizedPayload.propertyName));
      const existingByParcel = normalizedPayload.parcelNumber
        ? properties.find((property) => normalizeComparableText(property.parcelNumber) === normalizeComparableText(normalizedPayload.parcelNumber))
        : null;
      const existingByAddressUnit = properties.find((property) => {
        const sameAddress = normalizeComparableText(property.address) && normalizeComparableText(property.address) === normalizeComparableText(normalizedPayload.address);
        const sameCity = normalizeComparableText(property.city) && normalizeComparableText(property.city) === normalizeComparableText(normalizedPayload.city);
        const sameState = normalizeComparableText(property.state) && normalizeComparableText(property.state) === normalizeComparableText(normalizedPayload.state);
        const sameZip = normalizeComparableText(property.zipCode) && normalizeComparableText(property.zipCode) === normalizeComparableText(normalizedPayload.zipCode);
        const sameUnit = normalizeComparableText(property.unitNumber) === normalizeComparableText(normalizedPayload.unitNumber);
        return sameAddress && sameCity && sameState && sameZip && sameUnit;
      });
      const existingExact = properties.find((property) => isExactDuplicateProperty(property, normalizedPayload));
      if (existingExact) {
        setMessage({ type: "error", text: "Exact duplicate detected. Update identifying details before saving this duplicate." });
        return;
      }
      const hasUniqueName = !existingByName;
      const hasUniqueIdentifier = !existingByParcel && !existingByAddressUnit;
      if (!hasUniqueName && !hasUniqueIdentifier) {
        setMessage({ type: "error", text: "Save Duplicate requires a unique name or unique identifying field." });
        return;
      }
    }

    if (matchedDeal && !normalizedPayload.linkedDealId) {
      normalizedPayload.linkedDealId = matchedDeal.id;
    }
    if (!existingProperty && !confirmDuplicate(normalizedPayload)) {
      setMessage({ type: "info", text: "Duplicate check cancelled." });
      return;
    }
    const workflowEvaluation = evaluateWorkflowTransition(normalizedPayload, { actor: "Property Database" });
    if (workflowEvaluation.shouldAdvance && workflowEvaluation.needsConfirmation) {
      const confirmed = window.confirm(`Confirm critical stage transition from ${workflowEvaluation.currentStage} to ${workflowEvaluation.recommendedStage}?`);
      if (!confirmed) {
        setMessage({ type: "info", text: "Critical workflow transition cancelled." });
        return;
      }
    }
    if (workflowEvaluation.shouldAdvance) {
      normalizedPayload.pipelineStage = workflowEvaluation.recommendedStage;
    }
    normalizedPayload.workflowTransitionHistory = JSON.stringify(workflowEvaluation.transitionHistory || []);
    normalizedPayload.workflowBlockers = JSON.stringify(workflowEvaluation.blockers || []);
    normalizedPayload.workflowCompletionPercent = workflowEvaluation.completionPercent;

    const savedProperty = await persistProperty(normalizedPayload, existingProperty);
    const nextProperties = existingProperty ? properties.map((property) => (property.id === existingProperty.id ? { ...property, ...savedProperty, id: existingProperty.id } : property)) : [...properties, savedProperty];
    setProperties(nextProperties);
    if (typeof window !== "undefined") {
      window.localStorage.setItem("royalStarProperties", JSON.stringify(nextProperties));
    }
    await refreshConnectionDetails(nextProperties.length);
    await triggerCrossModuleRefresh(normalizedPayload.linkedDealId || matchedDeal?.id || "", {
      type: existingProperty ? "property-updated" : "property-created",
      pipelineStage: normalizedPayload.pipelineStage,
      workflowCompletionPercent: normalizedPayload.workflowCompletionPercent,
      parcelNumber: normalizedPayload.parcelNumber,
    });
    setSelectedPropertyId(savedProperty.id);
    setFormValues({ ...initialValues, ...savedProperty, favorite: Boolean(savedProperty.favorite) });
    setDuplicateDraftMeta(null);
    const linkedDealMessage = matchedDeal ? " and linked to the matching deal." : "";
    setMessage({ type: "success", text: `${existingProperty ? "Property updated successfully." : "Property added successfully."}${linkedDealMessage}` });
  };

  const handleDelete = async (propertyId) => {
    const target = properties.find((property) => property.id === propertyId);
    if (!target) return;
    if (!window.confirm(`Delete ${target.propertyName || target.address || "this property"}?`)) return;
    try {
      const response = await fetch(buildApiUrl(`/api/properties/${propertyId}`), { method: "DELETE" });
      if (!response.ok) throw new Error("Unable to delete property");
    } catch (error) {
      console.error("Unable to delete property via API", error);
    }
    const nextProperties = properties.filter((property) => property.id !== propertyId);
    setProperties(nextProperties);
    if (typeof window !== "undefined") {
      window.localStorage.setItem("royalStarProperties", JSON.stringify(nextProperties));
    }
    await refreshConnectionDetails(nextProperties.length);
    await triggerCrossModuleRefresh(target.linkedDealId || "");
    setSelectedPropertyId("");
    setFormValues(initialValues);
    setDuplicateDraftMeta(null);
    setMessage({ type: "success", text: "Property deleted successfully." });
  };

  const handleDuplicate = (propertyId = "") => {
    const sourceProperty = propertyId ? normalizedProperties.find((entry) => entry.id === propertyId) || null : selectedProperty;
    if (!sourceProperty) return;
    if (!window.confirm(`Create a duplicate of ${sourceProperty.propertyName || sourceProperty.address || "this property"}?`)) return;
    const duplicateValues = {
      ...initialValues,
      ...sourceProperty,
      id: "",
      createdAt: "",
      updatedAt: "",
      propertyStatus: sourceProperty.propertyStatus || sourceProperty.status || "Lead",
      favorite: Boolean(sourceProperty.favorite),
      propertyName: `${sourceProperty.propertyName || sourceProperty.address || "Property"} — Copy — Unsaved`,
    };
    setFormValues(duplicateValues);
    setSelectedPropertyId("");
    setDuplicateDraftMeta({
      sourceId: sourceProperty.id,
      sourceName: sourceProperty.propertyName || sourceProperty.address || "Property",
      createdAt: new Date().toISOString(),
    });
    setMessage({ type: "info", text: "Duplicate draft created. Use Save Duplicate or Cancel Duplicate." });
  };

  const handleCancelDuplicate = () => {
    setDuplicateDraftMeta(null);
    setSelectedPropertyId("");
    setFormValues(initialValues);
    setMessage({ type: "info", text: "Duplicate draft cancelled." });
  };

  const handleOpenCountyParcelSearch = () => {
    const resolved = resolveCountyParcelSearch(formValues, { parcelNumber: parcelAssistantDraft.parcelNumber || formValues.parcelNumber });
    const countySearchUrl = buildCountyParcelSearchUrl(formValues);
    if (!resolved.ok || !countySearchUrl) {
      setMessage({ type: "error", text: "County information required." });
      return;
    }
    if (typeof window !== "undefined") {
      window.open(countySearchUrl, "_blank", "noopener,noreferrer");
    }
    setFormValues((prev) => ({
      ...prev,
      county: prev.county || resolved.county,
      state: prev.state || resolved.state,
      countyRecordUrl: countySearchUrl,
    }));
    setParcelAssistantDraft((prev) => ({ ...prev, sourceUrl: countySearchUrl || prev.sourceUrl }));
    setMessage({ type: "info", text: resolved.message });
  };

  const handleOpenMap = () => {
    const mapUrl = formValues.mapUrl || buildGoogleMapsUrl(formValues);
    if (!hasSufficientAddressData(formValues) || !mapUrl) {
      setMessage({ type: "error", text: "Insufficient Address Data" });
      return;
    }
    if (typeof window !== "undefined") {
      window.open(mapUrl, "_blank", "noopener,noreferrer");
    }
    setMessage({ type: "info", text: "Map opened in a new tab." });
  };

  const handleCopyMapLink = async () => {
    const mapUrl = formValues.mapUrl || buildGoogleMapsUrl(formValues);
    if (!hasSufficientAddressData(formValues) || !mapUrl) {
      setMessage({ type: "error", text: "Insufficient Address Data" });
      return;
    }
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard) {
        await navigator.clipboard.writeText(mapUrl);
        setMessage({ type: "success", text: "Map link copied to clipboard." });
      } else {
        setMessage({ type: "info", text: `Copy this map link: ${mapUrl}` });
      }
    } catch (error) {
      console.error("Unable to copy map link", error);
      setMessage({ type: "info", text: `Copy this map link: ${mapUrl}` });
    }
  };

  const handleRegenerateMap = () => {
    const regenerated = buildGoogleMapsUrl(formValues);
    if (!hasSufficientAddressData(formValues) || !regenerated) {
      setMessage({ type: "error", text: "Insufficient Address Data" });
      return;
    }
    setFormValues((prev) => ({ ...prev, mapUrl: regenerated }));
    setMessage({ type: "success", text: "Map link regenerated from the current address." });
  };

  const handleToggleFavorite = (propertyId) => {
    const nextProperties = properties.map((property) => (property.id === propertyId ? { ...property, favorite: !property.favorite } : property));
    setProperties(nextProperties);
    if (typeof window !== "undefined") {
      window.localStorage.setItem("royalStarProperties", JSON.stringify(nextProperties));
    }
  };

  const handleImportSavedDeal = () => {
    const selectedDeal = deals.find((deal) => deal.id === importDealId);
    if (!selectedDeal) return;
    const nextValues = {
      ...initialValues,
      propertyName: selectedDeal.propertyAddress || selectedDeal.address || "",
      address: selectedDeal.propertyAddress || selectedDeal.address || "",
      city: selectedDeal.city || "",
      state: selectedDeal.state || "",
      zipCode: selectedDeal.zipCode || selectedDeal.zip || "",
      purchasePrice: selectedDeal.purchasePrice || selectedDeal.askingPrice || "",
      strategy: selectedDeal.strategy || "Hold",
      notes: selectedDeal.notes || "",
    };
    setFormValues(nextValues);
    setMessage({ type: "info", text: "Saved deal imported into the property form." });
  };

  const handleImportPortfolioProperty = () => {
    const selectedPortfolio = portfolioEntries.find((entry) => entry.id === importPortfolioId);
    if (!selectedPortfolio) return;
    const nextValues = {
      ...initialValues,
      propertyName: selectedPortfolio.propertyName || "",
      address: selectedPortfolio.propertyAddress || selectedPortfolio.address || "",
      city: selectedPortfolio.city || "",
      state: selectedPortfolio.state || "",
      zipCode: selectedPortfolio.zipCode || "",
      purchasePrice: selectedPortfolio.purchasePrice || "",
      strategy: selectedPortfolio.strategy || "Hold",
      status: selectedPortfolio.status || "Lead",
      currentEstimatedValue: selectedPortfolio.currentValue || selectedPortfolio.currentEstimatedValue || "",
      monthlyRent: selectedPortfolio.monthlyRent || "",
      notes: selectedPortfolio.notes || "",
    };
    setFormValues(nextValues);
    setMessage({ type: "info", text: "Portfolio property imported into the property form." });
  };

  const handleExport = () => {
    const rows = filteredProperties.map((property) => ({
      propertyName: property.propertyName,
      address: property.address,
      city: property.city,
      state: property.state,
      zipCode: property.zipCode,
      currentValue: property.currentEstimatedValue,
      equity: property.derived.equity,
      ltv: property.derived.ltv,
      monthlyRent: property.monthlyRent,
      grade: property.grade,
      recommendation: property.recommendation,
    }));
    downloadFile("royal-star-properties.json", JSON.stringify(rows, null, 2), "application/json");
    setMessage({ type: "success", text: "Property export prepared." });
  };

  const handleExportCsv = () => {
    const rows = filteredProperties.map((property) => ({
      propertyName: property.propertyName,
      address: property.address,
      city: property.city,
      state: property.state,
      zipCode: property.zipCode,
      currentValue: property.currentEstimatedValue,
      equity: property.derived.equity,
      ltv: property.derived.ltv,
      monthlyRent: property.monthlyRent,
      grade: property.grade,
      recommendation: property.recommendation,
    }));
    if (!rows.length) {
      setMessage({ type: "error", text: "No properties available to export." });
      return;
    }
    downloadCsv("royal-star-properties.csv", rows);
    setMessage({ type: "success", text: "CSV export prepared." });
  };

  const handlePreviewImport = () => {
    if (!importText.trim()) {
      setMessage({ type: "error", text: "Paste CSV data before previewing an import." });
      return;
    }
    const preview = buildImportPreview(importText, "property", properties);
    setImportPreview(preview);
    setMessage({ type: preview.summary.flagged ? "info" : "success", text: `${preview.summary.accepted} rows ready and ${preview.summary.flagged} flagged for review.` });
  };

  const handleApplyImport = async () => {
    if (!importPreview) {
      setMessage({ type: "error", text: "Preview an import before applying it." });
      return;
    }

    setImporting(true);
    const readyRows = importPreview.rows.filter((row) => row.status === "ready");
    const nextProperties = [...properties];

    for (const row of readyRows) {
      const baseRecord = {
        ...row.record,
        propertyName: row.record.propertyName || row.record.address || `Imported Property ${row.rowNumber}`,
        address: row.record.address || row.record.propertyAddress || row.record.streetAddress || "",
      };
      const normalized = normalizeRecordForStorage(baseRecord, "property");
      const payload = normalizePropertyPayload({
        ...initialValues,
        ...normalized,
        id: "",
        propertyName: normalized.propertyName || normalized.address || `Imported Property ${row.rowNumber}`,
        propertyStatus: "Lead",
        strategy: normalized.strategy || "Hold",
        address: normalized.address || "",
        city: normalized.city || "",
        state: normalized.state || "",
        zipCode: normalized.zipCode || "",
        purchasePrice: normalized.purchasePrice ?? normalized.askingPrice ?? "",
        currentValue: normalized.estimatedArv ?? normalized.purchasePrice ?? "",
        notes: normalized.notes || "",
        createdAt: "",
        updatedAt: "",
      });
      const savedProperty = await persistProperty(payload);
      nextProperties.push(savedProperty);
    }

    setProperties(nextProperties);
    if (typeof window !== "undefined") {
      window.localStorage.setItem("royalStarProperties", JSON.stringify(nextProperties));
    }
    await refreshConnectionDetails(nextProperties.length);
    await triggerCrossModuleRefresh();
    setImportPreview(null);
    setImportText("");
    setImporting(false);
    setMessage({ type: "success", text: `${readyRows.length} imported properties added to the database.` });
  };

  const toggleComparison = (propertyId) => {
    setComparisonIds((prev) => {
      if (prev.includes(propertyId)) return prev.filter((id) => id !== propertyId);
      if (prev.length >= 5) return prev;
      return [...prev, propertyId];
    });
  };

  return (
    <div style={styles.page}>
      <aside style={styles.sidebar}>
        <div style={styles.logoArea}>
          <img src={logo} alt="Royal Star Properties" style={styles.logo} />
        </div>
        <nav style={styles.nav}>
          {navigation.map(([icon, label]) => {
            const isDealAnalyzer = label === "DEAL ANALYZER";
            const isFlipAnalyzer = label === "FLIP ANALYZER";
            const isBrrrrAnalyzer = label === "BRRRR ANALYZER";
            const isProductVault = label === "PRODUCT VAULT";
            const isContractorHub = label === "CONTRACTOR HUB";
            const isCompDatabase = label === "COMP DATABASE";
            const isNeighborhoodDatabase = label === "NEIGHBORHOOD DB";
            const isPortfolioDashboard = label === "PORTFOLIO DASHBOARD";
            const isPropertyDatabase = label === "PROPERTY DATABASE";
            return (
              <button
                key={label}
                type="button"
                style={styles.navButton}
                onClick={
                  isDealAnalyzer
                    ? onOpenDealAnalyzer
                    : isFlipAnalyzer
                      ? onOpenFlipAnalyzer
                      : isBrrrrAnalyzer
                        ? onOpenBrrrrAnalyzer
                        : isProductVault
                          ? onOpenProductVault
                          : isContractorHub
                            ? onOpenContractorHub
                            : isCompDatabase
                              ? onOpenCompDatabase
                              : isNeighborhoodDatabase
                                ? onOpenNeighborhoodDatabase
                                : isPortfolioDashboard
                                  ? onOpenPortfolioDashboard
                                  : isPropertyDatabase
                                    ? onOpenPropertyDatabase
                                    : undefined
                }
              >
                <span style={styles.navIcon}>{icon}</span>
                <span>{label}</span>
                <span style={styles.navTab} />
              </button>
            );
          })}
          <button type="button" style={styles.logout} onClick={onBack}>
            <span style={styles.navIcon}>↪</span>
            <span>COMMAND CENTER</span>
          </button>
        </nav>
        <div style={styles.smallMark}>RS★</div>
      </aside>

      <main style={styles.main}>
        <section style={styles.topBar}>
          <button type="button" style={styles.backButton} onClick={onBack}>◀ COMMAND CENTER</button>
          <div style={styles.headingBlock}>
            <h1 style={styles.company}>ROYAL STAR PROPERTIES, LLC</h1>
            <p style={styles.subtitle}>PROPERTY DATABASE / ASSET MANAGEMENT</p>
          </div>
          <div style={styles.headerActions}>
            <button type="button" style={styles.secondaryButton} onClick={onOpenDealAnalyzer}>DEAL ANALYZER</button>
            <button type="button" style={styles.primaryButton} onClick={onOpenFlipAnalyzer}>FLIP ANALYZER</button>
            <button type="button" style={styles.primaryButton} onClick={onOpenBrrrrAnalyzer}>BRRRR ANALYZER</button>
          </div>
        </section>

        <section style={styles.summaryGrid}>
          <SummaryCard label="Total Properties" value={summaryStats.total} />
          <SummaryCard label="Active Properties" value={summaryStats.active} />
          <SummaryCard label="Properties in Rehab" value={summaryStats.rehab} />
          <SummaryCard label="Rental Properties" value={summaryStats.rental} />
          <SummaryCard label="Listed Properties" value={summaryStats.listed} />
          <SummaryCard label="Sold Properties" value={summaryStats.sold} />
          <SummaryCard label="Total Current Value" value={formatCurrency(summaryStats.totalValue)} />
          <SummaryCard label="Total Loan Balance" value={formatCurrency(summaryStats.totalLoan)} />
          <SummaryCard label="Total Equity" value={formatCurrency(summaryStats.totalEquity)} />
          <SummaryCard label="Average LTV" value={formatPercent(summaryStats.averageLtv)} />
          <SummaryCard label="Average Price / Sq Ft" value={formatCurrency(summaryStats.averagePsf)} />
          <SummaryCard label="Average Rehab / Sq Ft" value={formatCurrency(summaryStats.averageRehabPsf)} />
          <SummaryCard label="Favorite Properties" value={summaryStats.favoriteCount} />
          <SummaryCard label="Missing Parcel Numbers" value={summaryStats.missingParcel} />
          <SummaryCard label="Missing Map Links" value={summaryStats.missingMap} />
          <SummaryCard label="Records With Stale Data" value={summaryStats.stale} />
        </section>

        <section style={styles.toolbar}>
          <input type="text" placeholder="Search name, address, city, ZIP, parcel, owner, lender, contractor" value={searchText} onChange={(event) => setSearchText(event.target.value)} style={styles.input} />
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} style={styles.select}>{statusOptionsList.map((option) => <option key={option} value={option}>{option}</option>)}</select>
          <select value={strategyFilter} onChange={(event) => setStrategyFilter(event.target.value)} style={styles.select}>{strategyOptionsList.map((option) => <option key={option} value={option}>{option}</option>)}</select>
          <select value={propertyTypeFilter} onChange={(event) => setPropertyTypeFilter(event.target.value)} style={styles.select}>{propertyTypeOptionsList.map((option) => <option key={option} value={option}>{option}</option>)}</select>
          <select value={cityFilter} onChange={(event) => setCityFilter(event.target.value)} style={styles.select}>{cityOptions.map((option) => <option key={option} value={option}>{option}</option>)}</select>
          <select value={stateFilter} onChange={(event) => setStateFilter(event.target.value)} style={styles.select}>{stateOptions.map((option) => <option key={option} value={option}>{option}</option>)}</select>
          <select value={zipFilter} onChange={(event) => setZipFilter(event.target.value)} style={styles.select}>{zipOptions.map((option) => <option key={option} value={option}>{option}</option>)}</select>
          <select value={favoriteFilter} onChange={(event) => setFavoriteFilter(event.target.value)} style={styles.select}>{favoriteOptions.map((option) => <option key={option} value={option}>{option}</option>)}</select>
          <select value={sortBy} onChange={(event) => setSortBy(event.target.value)} style={styles.select}>{sortOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
        </section>

        <div style={styles.contentGrid}>
          <section style={styles.panel}>
            <div style={styles.panelHeaderRow}>
              <h2 style={styles.panelTitle}>PROPERTY FORM</h2>
              <div style={styles.inlineActions}>
                <button type="button" style={styles.secondaryButton} onClick={() => setShowDataQuality(true)}>DATA QUALITY PANEL</button>
                <button type="button" style={styles.secondaryButton} onClick={handleClearForm}>CLEAR</button>
                <button type="button" style={styles.primaryButton} onClick={handleDuplicate} disabled={!selectedProperty || Boolean(duplicateDraftMeta)}>DUPLICATE</button>
              </div>
            </div>
            {duplicateDraftMeta ? (
              <div style={styles.infoBox}>
                <strong>UNSAVED DUPLICATE DRAFT</strong> — Source Property: {duplicateDraftMeta.sourceName}. Save Duplicate to persist or Cancel Duplicate to discard.
              </div>
            ) : null}
            {message.text ? <div style={message.type === "error" ? styles.errorBox : styles.successBox}>{message.text}</div> : null}
            <form onSubmit={handleSubmit} style={styles.formGrid}>
              <label style={styles.field}><span>Property Name</span><input name="propertyName" value={formValues.propertyName} onChange={handleFieldChange} style={styles.input} /></label>
              <label style={styles.field}><span>Address</span><input name="address" value={formValues.address} onChange={handleFieldChange} style={styles.input} /></label>
              <label style={styles.field}><span>Unit Number</span><input name="unitNumber" value={formValues.unitNumber} onChange={handleFieldChange} style={styles.input} /></label>
              <label style={styles.field}><span>City</span><input name="city" value={formValues.city} onChange={handleFieldChange} style={styles.input} /></label>
              <label style={styles.field}><span>County</span><input name="county" value={formValues.county} onChange={handleFieldChange} style={styles.input} /></label>
              <label style={styles.field}><span>State</span><input name="state" value={formValues.state} onChange={handleFieldChange} style={styles.input} /></label>
              <label style={styles.field}><span>ZIP Code</span><input name="zipCode" value={formValues.zipCode} onChange={handleFieldChange} style={styles.input} /></label>
              <label style={styles.field}><span>Parcel Number</span><input name="parcelNumber" value={formValues.parcelNumber} onChange={handleFieldChange} style={styles.input} /></label>
              <div style={{ ...styles.field, justifyContent: "flex-end" }}>
                <span style={styles.hintText}>{formValues.parcelNumber ? "Parcel Number Saved" : "Missing Parcel Number"}</span>
                <div style={styles.inlineActions}>
                  <button type="button" style={styles.secondaryButton} onClick={handleOpenCountyParcelSearch}>SEARCH COUNTY RECORDS</button>
                  <button type="button" style={styles.secondaryButton} onClick={handleOpenParcelAssistant}>PASTE/ENTER PARCEL NUMBER</button>
                </div>
              </div>
              {showParcelAssistant ? (
                <div style={{ ...styles.field, gridColumn: "1 / -1" }}>
                  <span>Parcel Retrieval Assistant</span>
                  <div style={styles.inlineActions}>
                    <input
                      value={parcelAssistantDraft.parcelNumber}
                      onChange={(event) => setParcelAssistantDraft((prev) => ({ ...prev, parcelNumber: event.target.value }))}
                      placeholder="Parcel Number"
                      style={styles.input}
                    />
                    <input
                      value={parcelAssistantDraft.sourceUrl}
                      onChange={(event) => setParcelAssistantDraft((prev) => ({ ...prev, sourceUrl: event.target.value }))}
                      placeholder="Source URL"
                      style={styles.input}
                    />
                    <select
                      value={parcelAssistantDraft.verificationStatus}
                      onChange={(event) => setParcelAssistantDraft((prev) => ({ ...prev, verificationStatus: event.target.value }))}
                      style={styles.select}
                    >
                      <option value="Pending">Pending</option>
                      <option value="Format Validated">Format Validated</option>
                      <option value="Verified">Verified</option>
                    </select>
                  </div>
                  <div style={styles.inlineActions}>
                    <button type="button" style={styles.secondaryButton} onClick={handleValidateParcelFormat}>VALIDATE FORMAT</button>
                    <button type="button" style={styles.primaryButton} onClick={handleSaveParcelAssistant}>SAVE PARCEL NUMBER</button>
                    <button type="button" style={styles.secondaryButton} onClick={handleCancelParcelAssistant}>CANCEL</button>
                  </div>
                </div>
              ) : null}
              <label style={styles.field}><span>Property Type</span><select name="propertyType" value={formValues.propertyType} onChange={handleFieldChange} style={styles.select}>{propertyTypeOptions.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>
              <label style={styles.field}><span>Legal Description</span><input name="legalDescription" value={formValues.legalDescription} onChange={handleFieldChange} style={styles.input} /></label>
              <label style={styles.field}><span>Status</span><select name="propertyStatus" value={formValues.propertyStatus} onChange={handleFieldChange} style={styles.select}>{Array.from(new Set([...(statusOptions || []), formValues.propertyStatus].filter(Boolean))).map((option) => <option key={option} value={option}>{option}</option>)}</select></label>
              <label style={styles.field}><span>Pipeline Stage</span><select name="pipelineStage" value={formValues.pipelineStage} onChange={handleFieldChange} style={styles.select}>{workflowStageOptions.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>
              <div style={styles.field}>
                <span>Workflow Progress</span>
                <div>{getWorkflowProgress(formValues.pipelineStage || "New Lead")}% complete</div>
                <div style={styles.hintText}>{workflowTransition.transitionMessage}</div>
                <div style={styles.inlineActions}>
                  <button type="button" style={styles.secondaryButton} onClick={handleWorkflowRollback}>ROLLBACK ONE STAGE</button>
                </div>
              </div>
              <label style={styles.field}><span>Ownership Status</span><input name="ownershipStatus" value={formValues.ownershipStatus} onChange={handleFieldChange} style={styles.input} /></label>
              <label style={styles.field}><span>Strategy</span><select name="strategy" value={formValues.strategy} onChange={handleFieldChange} style={styles.select}>{strategyOptions.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>
              <label style={styles.field}><span>Occupancy</span><select name="occupancyStatus" value={formValues.occupancyStatus} onChange={handleFieldChange} style={styles.select}>{occupancyOptions.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>
              <label style={styles.field}><span>Units</span><input type="number" name="units" value={formValues.units} onChange={handleFieldChange} style={styles.input} /></label>
              <label style={styles.field}><span>Bedrooms</span><input type="number" name="bedrooms" value={formValues.bedrooms} onChange={handleFieldChange} style={styles.input} /></label>
              <label style={styles.field}><span>Bathrooms</span><input type="number" name="bathrooms" value={formValues.bathrooms} onChange={handleFieldChange} style={styles.input} /></label>
              <label style={styles.field}><span>Square Feet</span><input type="number" name="squareFeet" value={formValues.squareFeet} onChange={handleFieldChange} style={styles.input} /></label>
              <label style={styles.field}><span>Lot Size</span><input type="number" name="lotSize" value={formValues.lotSize} onChange={handleFieldChange} style={styles.input} /></label>
              <label style={styles.field}><span>Year Built</span><input type="number" name="yearBuilt" value={formValues.yearBuilt} onChange={handleFieldChange} style={styles.input} /></label>
              <label style={styles.field}><span>Stories</span><input type="number" name="stories" value={formValues.stories} onChange={handleFieldChange} style={styles.input} /></label>
              <label style={styles.field}><span>Basement Type</span><input name="basementType" value={formValues.basementType} onChange={handleFieldChange} style={styles.input} /></label>
              <label style={styles.field}><span>Garage Type</span><input name="garageType" value={formValues.garageType} onChange={handleFieldChange} style={styles.input} /></label>
              <label style={styles.field}><span>Construction Type</span><input name="constructionType" value={formValues.constructionType} onChange={handleFieldChange} style={styles.input} /></label>
              <label style={styles.field}><span>Current Owner</span><input name="currentOwnerName" value={formValues.currentOwnerName} onChange={handleFieldChange} style={styles.input} /></label>
              <label style={styles.field}><span>Owner Entity</span><input name="ownerEntity" value={formValues.ownerEntity} onChange={handleFieldChange} style={styles.input} /></label>
              <label style={styles.field}><span>Acquisition Date</span><input type="date" name="acquisitionDate" value={formValues.acquisitionDate} onChange={handleFieldChange} style={styles.input} /></label>
              <label style={styles.field}><span>Purchase Price</span><input type="number" name="purchasePrice" value={formValues.purchasePrice} onChange={handleFieldChange} style={styles.input} /></label>
              <label style={styles.field}><span>Closing Costs</span><input type="number" name="closingCosts" value={formValues.closingCosts} onChange={handleFieldChange} style={styles.input} /></label>
              <label style={styles.field}><span>Original Rehab Budget</span><input type="number" name="originalRehabBudget" value={formValues.originalRehabBudget} onChange={handleFieldChange} style={styles.input} /></label>
              <label style={styles.field}><span>Current Rehab Budget</span><input type="number" name="currentRehabBudget" value={formValues.currentRehabBudget} onChange={handleFieldChange} style={styles.input} /></label>
              <label style={styles.field}><span>Actual Rehab Cost</span><input type="number" name="actualRehabCost" value={formValues.actualRehabCost} onChange={handleFieldChange} style={styles.input} /></label>
              <label style={styles.field}><span>Projected ARV</span><input type="number" name="projectedARV" value={formValues.projectedARV} onChange={handleFieldChange} style={styles.input} /></label>
              <label style={styles.field}><span>Current Value</span><input type="number" name="currentValue" value={formValues.currentValue} onChange={handleFieldChange} style={styles.input} /></label>
              <label style={styles.field}><span>Supported ARV</span><input type="number" name="supportedARV" value={formValues.supportedARV} onChange={handleFieldChange} style={styles.input} /></label>
              <label style={styles.field}><span>Monthly Rent</span><input type="number" name="monthlyRent" value={formValues.monthlyRent} onChange={handleFieldChange} style={styles.input} /></label>
              <label style={styles.field}><span>Monthly Taxes</span><input type="number" name="monthlyTaxes" value={formValues.monthlyTaxes} onChange={handleFieldChange} style={styles.input} /></label>
              <label style={styles.field}><span>Monthly Insurance</span><input type="number" name="monthlyInsurance" value={formValues.monthlyInsurance} onChange={handleFieldChange} style={styles.input} /></label>
              <label style={styles.field}><span>Monthly HOA</span><input type="number" name="monthlyHOA" value={formValues.monthlyHOA} onChange={handleFieldChange} style={styles.input} /></label>
              <label style={styles.field}><span>Current Loan Balance</span><input type="number" name="currentLoanBalance" value={formValues.currentLoanBalance} onChange={handleFieldChange} style={styles.input} /></label>
              <label style={styles.field}><span>Lender</span><input name="lenderName" value={formValues.lenderName} onChange={handleFieldChange} style={styles.input} /></label>
              <label style={styles.field}><span>Contractor</span><input name="contractorName" value={formValues.contractorName} onChange={handleFieldChange} style={styles.input} /></label>
              <label style={styles.field}><span>Property Manager</span><input name="propertyManager" value={formValues.propertyManager} onChange={handleFieldChange} style={styles.input} /></label>
              <label style={styles.field}><span>Neighborhood</span><input name="neighborhood" value={formValues.neighborhood} onChange={handleFieldChange} style={styles.input} /></label>
              <label style={styles.field}><span>Latitude</span><input type="number" name="latitude" value={formValues.latitude} onChange={handleFieldChange} style={styles.input} /></label>
              <label style={styles.field}><span>Longitude</span><input type="number" name="longitude" value={formValues.longitude} onChange={handleFieldChange} style={styles.input} /></label>
              <label style={styles.field}><span>Map URL</span><input name="mapUrl" value={formValues.mapUrl} onChange={handleFieldChange} style={styles.input} /></label>
              <div style={{ ...styles.field, justifyContent: "flex-end" }}>
                <span style={styles.hintText}>{mapLinkHintText(formValues)}</span>
                <div style={styles.inlineActions}>
                  <button type="button" style={styles.secondaryButton} onClick={handleOpenMap}>OPEN MAP</button>
                  <button type="button" style={styles.secondaryButton} onClick={handleCopyMapLink}>COPY MAP LINK</button>
                  <button type="button" style={styles.secondaryButton} onClick={handleRegenerateMap}>REGENERATE</button>
                </div>
              </div>
              <label style={styles.field}><span>Property Source URL</span><input name="propertySourceUrl" value={formValues.propertySourceUrl} onChange={handleFieldChange} style={styles.input} /></label>
              <label style={styles.field}><span>Updated At</span><input type="date" name="updatedAt" value={formValues.updatedAt} onChange={handleFieldChange} style={styles.input} /></label>
              <label style={styles.field}><span>Favorite</span><input type="checkbox" name="favorite" checked={Boolean(formValues.favorite)} onChange={handleFieldChange} /></label>
              <label style={{ ...styles.field, gridColumn: "1 / -1" }}><span>Notes</span><textarea name="notes" value={formValues.notes} onChange={handleFieldChange} style={{ ...styles.input, minHeight: 76 }} /></label>
              <div style={{ gridColumn: "1 / -1", display: "flex", gap: 12 }}>
                <button type="submit" style={styles.primaryButton}>{duplicateDraftMeta ? "SAVE DUPLICATE" : "SAVE PROPERTY"}</button>
                {duplicateDraftMeta ? <button type="button" style={styles.secondaryButton} onClick={handleCancelDuplicate}>CANCEL DUPLICATE</button> : null}
                <button type="button" style={styles.secondaryButton} onClick={() => setFormValues({ ...initialValues, favorite: false })}>RESET</button>
              </div>
            </form>
            <div style={styles.importSection}>
              <div style={styles.panelHeaderRow}><h3 style={styles.panelTitle}>IMPORT OPTIONS</h3></div>
              <div style={styles.inlineActions}>
                <select value={importDealId} onChange={(event) => setImportDealId(event.target.value)} style={styles.select}>
                  <option value="">Select Saved Deal</option>
                  {deals.map((deal) => <option key={deal.id} value={deal.id}>{deal.propertyAddress || deal.address}</option>)}
                </select>
                <button type="button" style={styles.secondaryButton} onClick={handleImportSavedDeal}>IMPORT DEAL</button>
              </div>
              <div style={styles.inlineActions}>
                <select value={importPortfolioId} onChange={(event) => setImportPortfolioId(event.target.value)} style={styles.select}>
                  <option value="">Select Portfolio Property</option>
                  {portfolioEntries.map((entry) => <option key={entry.id} value={entry.id}>{entry.propertyName || entry.propertyAddress}</option>)}
                </select>
                <button type="button" style={styles.secondaryButton} onClick={handleImportPortfolioProperty}>IMPORT PORTFOLIO</button>
              </div>
              <label style={styles.field}>
                <span>CSV / Structured Import</span>
                <textarea value={importText} onChange={(event) => setImportText(event.target.value)} style={{ ...styles.input, minHeight: 110, width: "100%" }} placeholder="address,city,state,zipCode,price\n123 Main St,Austin,TX,78701,120000" />
              </label>
              <div style={styles.inlineActions}>
                <button type="button" style={styles.secondaryButton} onClick={handlePreviewImport}>PREVIEW IMPORT</button>
                <button type="button" style={styles.secondaryButton} onClick={handleApplyImport} disabled={importing}>{importing ? "IMPORTING..." : "APPLY IMPORT"}</button>
              </div>
              {importPreview ? (
                <div style={styles.successBox}>
                  <strong>Preview summary:</strong> {importPreview.summary.accepted} ready, {importPreview.summary.flagged} flagged.
                  <div style={{ marginTop: 8, fontSize: 12 }}>
                    Mapping: {Object.keys(importPreview.mapping).join(", ") || "No compatible fields detected"}
                  </div>
                </div>
              ) : null}
              <div style={styles.inlineActions}>
                <button type="button" style={styles.secondaryButton} onClick={handleExport}>EXPORT FILTERED DATA</button>
                <button type="button" style={styles.secondaryButton} onClick={handleExportCsv}>EXPORT CSV</button>
              </div>
            </div>
          </section>

          <section style={styles.panel}>
            <div style={styles.panelHeaderRow}>
              <h2 style={styles.panelTitle}>PROPERTY PORTFOLIO</h2>
              <div style={styles.inlineActions}>
                <button type="button" style={styles.statusBadgeButton} onClick={() => setShowConnectionDetails(true)}>{connectionState}</button>
              </div>
            </div>
            {filteredProperties.length === 0 ? (
              <div style={styles.emptyState}>
                <h3>No property records available</h3>
                <p>Start with an import or add a new property record to build the database.</p>
                <div style={styles.inlineActions}>
                  <button type="button" style={styles.primaryButton} onClick={() => setFormValues(initialValues)}>ADD PROPERTY</button>
                  <button type="button" style={styles.secondaryButton} onClick={handleImportSavedDeal}>IMPORT SAVED DEAL</button>
                </div>
              </div>
            ) : (
              <div style={styles.tableWrap}>
                <table style={styles.table}>
                  <thead>
                    <tr>
                      <th style={styles.th}>Fav</th>
                      <th style={styles.th}>Property</th>
                      <th style={styles.th}>Address</th>
                      <th style={styles.th}>Strategy</th>
                      <th style={styles.th}>Status</th>
                      <th style={styles.th}>Value</th>
                      <th style={styles.th}>Equity</th>
                      <th style={styles.th}>LTV</th>
                      <th style={styles.th}>Rent</th>
                      <th style={styles.th}>Grade</th>
                      <th style={styles.th}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredProperties.map((property) => (
                      <tr key={property.id} style={styles.tr}>
                        <td style={styles.td}><button type="button" style={styles.iconButton} onClick={() => handleToggleFavorite(property.id)}>{property.favorite ? "★" : "☆"}</button></td>
                        <td style={styles.td}><button type="button" style={styles.linkButton} onClick={() => setSelectedDetailId(property.id)}>{property.propertyName || "Untitled Property"}</button></td>
                        <td style={styles.td}>{property.address}</td>
                        <td style={styles.td}>{property.strategy}</td>
                        <td style={styles.td}>{property.status}</td>
                        <td style={styles.td}>{formatCurrency(property.currentEstimatedValue)}</td>
                        <td style={styles.td}>{formatCurrency(property.derived.equity)}</td>
                        <td style={styles.td}>{formatPercent(property.derived.ltv)}</td>
                        <td style={styles.td}>{formatCurrency(property.monthlyRent)}</td>
                        <td style={styles.td}>{property.grade}</td>
                        <td style={styles.td}>
                          <div style={styles.inlineActions}>
                            <button type="button" style={styles.secondaryButton} onClick={() => handleSelectProperty(property)}>Edit</button>
                            <button type="button" style={styles.secondaryButton} onClick={() => toggleComparison(property.id)}>{comparisonIds.includes(property.id) ? "Unselect" : "Compare"}</button>
                            <button type="button" style={styles.secondaryButton} onClick={() => handleDuplicate(property.id)} disabled={Boolean(duplicateDraftMeta)}>Dup</button>
                            <button type="button" style={styles.secondaryButton} onClick={() => handleDelete(property.id)}>Delete</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {comparisonItems.length > 0 ? (
              <div style={styles.comparisonCard}>
                <h3 style={styles.panelTitle}>COMPARISON</h3>
                <div style={styles.comparisonGrid}>
                  {comparisonItems.map((property) => (
                    <div key={property.id} style={styles.comparisonItem}>
                      <strong>{property.propertyName || "Unnamed"}</strong>
                      <div>Value: {formatCurrency(property.currentEstimatedValue)}</div>
                      <div>Equity: {formatCurrency(property.derived.equity)}</div>
                      <div>LTV: {formatPercent(property.derived.ltv)}</div>
                      <div>Rent: {formatCurrency(property.monthlyRent)}</div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </section>
        </div>

        {detailProperty ? (
          <div style={styles.modalOverlay} onClick={() => setSelectedDetailId("")}>
            <div style={styles.modalCard} onClick={(event) => event.stopPropagation()}>
              <div style={styles.panelHeaderRow}>
                <h3 style={styles.panelTitle}>{detailProperty.propertyName || "Property Detail"}</h3>
                <button type="button" style={styles.secondaryButton} onClick={() => setSelectedDetailId("")}>Close</button>
              </div>
              <div style={styles.detailGrid}>
                <div style={styles.detailSection}>
                  <h4>Overview</h4>
                  <div>Address: {detailProperty.address}</div>
                  <div>Strategy: {detailProperty.strategy}</div>
                  <div>Status: {detailProperty.status}</div>
                  <div>Purchase Price: {formatCurrency(detailProperty.purchasePrice)}</div>
                  <div>Current Value: {formatCurrency(detailProperty.currentEstimatedValue)}</div>
                  <div>Equity: {formatCurrency(detailProperty.derived.equity)}</div>
                </div>
                <div style={styles.detailSection}>
                  <h4>Calculated Metrics</h4>
                  <div>Total Project Cost: {formatCurrency(detailProperty.derived.totalProjectCost)}</div>
                  <div>LTV: {formatPercent(detailProperty.derived.ltv)}</div>
                  <div>Price / Sq Ft: {formatCurrency(detailProperty.derived.pricePerSqft)}</div>
                  <div>Rehab / Sq Ft: {formatCurrency(detailProperty.derived.rehabCostPerSqft)}</div>
                  <div>Monthly Rent: {formatCurrency(detailProperty.monthlyRent)}</div>
                  <div>Rent-to-Value: {formatPercent(detailProperty.derived.rentToValueRatio)}</div>
                </div>
                <div style={styles.detailSection}>
                  <h4>Risk Warnings</h4>
                  {detailProperty.warnings.length === 0 ? <div>None</div> : detailProperty.warnings.map((warning) => <div key={warning}>• {warning}</div>)}
                </div>
                <div style={styles.detailSection}>
                  <h4>Recommendation</h4>
                  <div>{detailProperty.recommendation}</div>
                  <div>{detailProperty.recommendationExplanation}</div>
                  <div>Grade: {detailProperty.grade}</div>
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {showDataQuality ? (
          <div style={styles.modalOverlay} onClick={() => setShowDataQuality(false)}>
            <div style={styles.modalCard} onClick={(event) => event.stopPropagation()}>
              <div style={styles.panelHeaderRow}>
                <h3 style={styles.panelTitle}>DATA QUALITY PANEL</h3>
                <button type="button" style={styles.secondaryButton} onClick={() => setShowDataQuality(false)}>Close</button>
              </div>
              <div style={styles.detailSection}>
                <div><strong>Current Issues:</strong> {dataQualityIssues.length}</div>
                <div><strong>Workflow Blockers:</strong> {(workflowTransition.blockers || []).length}</div>
              </div>
              <div style={styles.tableWrap}>
                <table style={styles.table}>
                  <thead>
                    <tr>
                      <th style={styles.th}>Severity</th>
                      <th style={styles.th}>Issue</th>
                      <th style={styles.th}>Action</th>
                      <th style={styles.th}>Verification</th>
                      <th style={styles.th}>Guided Repair</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dataQualityIssues.length === 0 ? (
                      <tr>
                        <td style={styles.td} colSpan={5}>No active data-quality issues.</td>
                      </tr>
                    ) : dataQualityIssues.map((issue) => (
                      <tr key={issue.warning}>
                        <td style={styles.td}>{issue.severity}</td>
                        <td style={styles.td}>{issue.reason}</td>
                        <td style={styles.td}>{issue.action}</td>
                        <td style={styles.td}>{issue.verification}</td>
                        <td style={styles.td}>
                          <div style={styles.inlineActions}>
                            {issue.warning.includes("parcel") ? <button type="button" style={styles.secondaryButton} onClick={() => { handleOpenParcelAssistant(); appendDataQualityHistory("Guided Repair", issue.warning); }}>Open Parcel Assistant</button> : null}
                            {issue.warning.includes("map") ? <button type="button" style={styles.secondaryButton} onClick={() => { handleRegenerateMap(); appendDataQualityHistory("Guided Repair", issue.warning); }}>Regenerate Map</button> : null}
                            {issue.warning.includes("source") ? <button type="button" style={styles.secondaryButton} onClick={() => { document.querySelector('input[name="propertySourceUrl"]')?.focus(); appendDataQualityHistory("Guided Repair", issue.warning); }}>Open Source Field</button> : null}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div style={styles.detailSection}>
                <h4>Action History</h4>
                {dataQualityHistory.length === 0 ? <div>No history recorded yet.</div> : dataQualityHistory.slice(-8).reverse().map((entry, index) => (
                  <div key={`${entry.at}-${index}`}>{entry.at}: {entry.action} {entry.details ? `(${entry.details})` : ""}</div>
                ))}
              </div>
            </div>
          </div>
        ) : null}

        {showConnectionDetails ? (
          <div style={styles.modalOverlay} onClick={() => setShowConnectionDetails(false)}>
            <div style={styles.modalCard} onClick={(event) => event.stopPropagation()}>
              <div style={styles.panelHeaderRow}>
                <h3 style={styles.panelTitle}>BACKEND CONNECTION DETAILS</h3>
                <button type="button" style={styles.secondaryButton} onClick={() => setShowConnectionDetails(false)}>Close</button>
              </div>
              <div style={styles.detailGrid}>
                <div style={styles.detailSection}>
                  <h4>Status</h4>
                  <div>Frontend Status: {connectionDetails?.frontendStatus || "Insufficient Data"}</div>
                  <div>Backend Status: {connectionDetails?.backendStatus || connectionState}</div>
                  <div>RSOS Ownership: {connectionDetails?.rsosOwnership || "Insufficient Data"}</div>
                  <div>Backend Port: {connectionDetails?.backendPort ?? "Insufficient Data"}</div>
                  <div>API Health Status: {connectionDetails?.apiHealthStatus || "Insufficient Data"}</div>
                  <div>Listener Count: {connectionDetails?.listenerCount ?? "Insufficient Data"}</div>
                  <div>Response Time: {connectionDetails?.responseTimeMs ?? "Insufficient Data"} ms</div>
                  <div>Last Successful Response: {connectionDetails?.lastSuccessfulResponse || "Insufficient Data"}</div>
                  <div>Persistence State: {connectionDetails?.persistenceState || "Insufficient Data"}</div>
                  <div>Data Directory State: {connectionDetails?.dataDirectoryState || "Insufficient Data"}</div>
                  <div>Last Verification Result: {connectionDetails?.lastVerificationResult || "Insufficient Data"}</div>
                  <div>Last Backup Timestamp: {connectionDetails?.lastBackupTimestamp || "Insufficient Data"}</div>
                  <div>Primary Source: {connectionDetails?.primarySource || "/api/properties"}</div>
                  <div>Fallback Source: {connectionDetails?.fallbackSource || "localStorage royalStarProperties"}</div>
                  <div>Record Count: {connectionDetails?.recordCount ?? properties.length}</div>
                </div>
                <div style={styles.detailSection}>
                  <h4>Actions</h4>
                  <button
                    type="button"
                    style={styles.primaryButton}
                    onClick={async () => {
                      try {
                        const response = await fetch(buildApiUrl("/api/properties"));
                        if (!response.ok) throw new Error("Unable to refresh properties");
                        const payload = await response.json();
                        setProperties(Array.isArray(payload) ? payload : []);
                        setConnectionState("Backend Connected");
                        await refreshConnectionDetails(Array.isArray(payload) ? payload.length : 0);
                        setMessage({ type: "success", text: "Connection refreshed from backend." });
                      } catch (error) {
                        console.error("Refresh failed", error);
                        setConnectionState("Local Fallback");
                        await refreshConnectionDetails(properties.length);
                        setMessage({ type: "error", text: "Backend refresh failed; continuing with local fallback." });
                      }
                    }}
                  >
                    REFRESH STATUS
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </main>
    </div>
  );
}

function SummaryCard({ label, value }) {
  return (
    <div style={styles.summaryCard}>
      <div style={styles.summaryLabel}>{label}</div>
      <div style={styles.summaryValue}>{value}</div>
    </div>
  );
}

const styles = {
  page: { minHeight: "100vh", display: "flex", background: "#070707", color: "#f3d78b", fontFamily: "Arial, sans-serif" },
  sidebar: { width: 260, background: "linear-gradient(180deg, #111 0%, #1a1408 100%)", borderRight: "1px solid #7b5a1b", padding: "24px 16px", display: "flex", flexDirection: "column", gap: 16 },
  logoArea: { display: "flex", justifyContent: "center", marginBottom: 12 },
  logo: { width: 140, height: "auto" },
  nav: { display: "flex", flexDirection: "column", gap: 8 },
  navButton: { display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", border: "1px solid #7b5a1b", background: "#17120a", color: "#f5d06b", cursor: "pointer", textAlign: "left" },
  navIcon: { width: 18 },
  navTab: { flex: 1 },
  logout: { display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", border: "1px solid #7b5a1b", background: "#2a1d08", color: "#f0c85c", cursor: "pointer", textAlign: "left", marginTop: 12 },
  smallMark: { marginTop: "auto", textAlign: "center", color: "#f0c85c", fontSize: 24, letterSpacing: 3 },
  main: { flex: 1, padding: 24, display: "flex", flexDirection: "column", gap: 16 },
  topBar: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16 },
  backButton: { background: "#2a1d08", color: "#f0c85c", border: "1px solid #7b5a1b", padding: "10px 14px", cursor: "pointer" },
  headingBlock: { flex: 1, textAlign: "center" },
  company: { margin: 0, fontSize: 24, color: "#f7e09b" },
  subtitle: { margin: "4px 0 0", color: "#d8b24f" },
  headerActions: { display: "flex", gap: 10 },
  primaryButton: { background: "#d4a31d", color: "#140d04", border: "none", padding: "10px 14px", fontWeight: 700, cursor: "pointer" },
  secondaryButton: { background: "#1d160c", color: "#f0c85c", border: "1px solid #7b5a1b", padding: "10px 14px", cursor: "pointer" },
  summaryGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 },
  summaryCard: { background: "#16110a", border: "1px solid #7b5a1b", padding: 12 },
  summaryLabel: { fontSize: 12, textTransform: "uppercase", color: "#c49a2b" },
  summaryValue: { marginTop: 8, fontSize: 20, fontWeight: 700, color: "#f7e09b" },
  toolbar: { display: "flex", flexWrap: "wrap", gap: 10, background: "#16110a", border: "1px solid #7b5a1b", padding: 12 },
  input: { background: "#20180d", border: "1px solid #7b5a1b", color: "#f5d06b", padding: "10px 12px", flex: 1, minWidth: 220 },
  select: { background: "#20180d", border: "1px solid #7b5a1b", color: "#f5d06b", padding: "10px 12px", minWidth: 160 },
  contentGrid: { display: "grid", gridTemplateColumns: "1.1fr 1fr", gap: 16 },
  panel: { background: "#16110a", border: "1px solid #7b5a1b", padding: 16, display: "flex", flexDirection: "column", gap: 12 },
  panelHeaderRow: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 },
  panelTitle: { margin: 0, color: "#f7e09b", textTransform: "uppercase", letterSpacing: 1 },
  inlineActions: { display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" },
  formGrid: { display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10 },
  field: { display: "flex", flexDirection: "column", gap: 6, color: "#f0c85c", fontSize: 13 },
  importSection: { display: "flex", flexDirection: "column", gap: 10, marginTop: 8 },
  infoBox: { background: "rgba(56, 86, 145, 0.2)", border: "1px solid #5e84c7", color: "#d5e4ff", padding: 10 },
  hintText: { fontSize: 12, color: "#c49a2b" },
  errorBox: { background: "rgba(184, 55, 46, 0.2)", border: "1px solid #b8392e", color: "#ffb2ae", padding: 10 },
  successBox: { background: "rgba(36, 115, 44, 0.2)", border: "1px solid #3f8b3a", color: "#bfe7b3", padding: 10 },
  tableWrap: { overflowX: "auto" },
  table: { width: "100%", borderCollapse: "collapse", fontSize: 13 },
  th: { textAlign: "left", padding: "8px 6px", borderBottom: "1px solid #7b5a1b", color: "#f0c85c" },
  td: { padding: "8px 6px", borderBottom: "1px solid #3a2d14", verticalAlign: "top" },
  tr: { background: "rgba(255,255,255,0.02)" },
  linkButton: { background: "none", border: "none", color: "#f0c85c", padding: 0, cursor: "pointer", textAlign: "left" },
  iconButton: { background: "none", border: "none", color: "#f0c85c", cursor: "pointer", fontSize: 16 },
  statusBadge: { fontSize: 12, padding: "6px 8px", background: "#2a1d08", border: "1px solid #7b5a1b", color: "#f0c85c" },
  statusBadgeButton: { fontSize: 12, padding: "6px 8px", background: "#2a1d08", border: "1px solid #7b5a1b", color: "#f0c85c", cursor: "pointer" },
  emptyState: { background: "#0f0b06", border: "1px dashed #7b5a1b", padding: 24, textAlign: "center", color: "#f0c85c" },
  comparisonCard: { marginTop: 12, borderTop: "1px solid #7b5a1b", paddingTop: 12 },
  comparisonGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10 },
  comparisonItem: { background: "#0f0b06", border: "1px solid #7b5a1b", padding: 10, fontSize: 13 },
  modalOverlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.72)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 },
  modalCard: { width: "min(900px, 100%)", background: "#16110a", border: "1px solid #7b5a1b", padding: 20, maxHeight: "80vh", overflowY: "auto" },
  detailGrid: { display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12 },
  detailSection: { background: "#0f0b06", border: "1px solid #3a2d14", padding: 12 },
};
