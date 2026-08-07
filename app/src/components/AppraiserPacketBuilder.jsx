import { useEffect, useMemo, useState } from "react";
import { buildApiUrl } from "../utils/apiClient.js";
import logo from "../assets/royal-star-logo.png";
import { buildAppraisalPacketIntelligence } from "./optionExpansionIntelligence.js";

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
  ["🗃️", "VENDOR DATABASE"],
  ["▪", "MATERIAL MATRIX"],
  ["🏦", "LENDER DASHBOARD"],
  ["📄", "APPRAISER PACKET BUILDER"],
  ["➕", "ADD NEW DEAL"],
];

const packetStatusOptions = [
  "Draft",
  "In Progress",
  "Ready for Review",
  "Submitted",
  "Appraisal Ordered",
  "Inspection Scheduled",
  "Awaiting Report",
  "Completed",
  "Revision Requested",
  "Archived",
];
const arVMethodOptions = ["Comparable Sales", "Price Per Square Foot", "Income Approach", "Cost Approach", "Blended Analysis", "Manual Override"];
const confidenceLevelOptions = ["High", "Moderate", "Low", "Insufficient Data"];
const strategyOptions = ["Flip", "BRRRR", "Long-Term Rental", "Short-Term Rental", "Wholesale", "Hold", "Undecided"];
const propertyTypeOptions = ["Single Family", "Duplex", "Triplex", "Fourplex", "Condominium", "Townhouse", "Mixed Use", "Other"];
const sortOptions = [
  ["name", "Packet Name"],
  ["newest", "Newest"],
  ["oldest", "Oldest"],
  ["arvHigh", "Highest Supported ARV"],
  ["arvLow", "Lowest Supported ARV"],
  ["completeHigh", "Highest Completeness"],
  ["completeLow", "Lowest Completeness"],
  ["varianceHigh", "Largest ARV Variance"],
  ["varianceLow", "Smallest ARV Variance"],
  ["due", "Appraisal Due Date"],
  ["updated", "Most Recently Updated"],
];

const initialValues = {
  id: "",
  packetName: "",
  packetStatus: "Draft",
  propertyId: "",
  propertyName: "",
  address: "",
  city: "",
  state: "",
  zipCode: "",
  county: "",
  parcelNumber: "",
  propertyType: "Single Family",
  bedrooms: "",
  bathrooms: "",
  squareFeet: "",
  lotSize: "",
  yearBuilt: "",
  units: "",
  strategy: "Hold",
  purchasePrice: "",
  rehabBudget: "",
  actualRehabCost: "",
  totalProjectCost: "",
  currentValue: "",
  requestedARV: "",
  supportedARV: "",
  appraisalValue: "",
  loanAmount: "",
  lenderId: "",
  lenderName: "",
  appraiserName: "",
  appraisalCompany: "",
  appraisalOrderDate: "",
  appraisalInspectionDate: "",
  appraisalDueDate: "",
  appraisalCompletedDate: "",
  ownerEntity: "",
  borrowerName: "",
  contactName: "",
  contactPhone: "",
  contactEmail: "",
  neighborhood: "",
  marketSummary: "",
  propertySummary: "",
  renovationSummary: "",
  scopeSummary: "",
  valueAddSummary: "",
  compSelectionSummary: "",
  ARVMethod: "Comparable Sales",
  confidenceLevel: "Insufficient Data",
  adjustmentSummary: "",
  rentEstimate: "",
  monthlyTaxes: "",
  monthlyInsurance: "",
  mapUrl: "",
  propertySourceUrl: "",
  permitUrl: "",
  taxRecordUrl: "",
  appraisalReportUrl: "",
  coverPhotoUrl: "",
  beforePhotos: [],
  progressPhotos: [],
  afterPhotos: [],
  floorPlanUrls: [],
  supportingDocumentUrls: [],
  comps: [],
  notes: "",
  favorite: false,
  createdAt: "",
  updatedAt: "",
};

function createId(prefix = "packet") {
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

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function normalizePacketPayload(values) {
  return {
    id: getStringValue(values.id),
    packetName: getStringValue(values.packetName),
    packetStatus: getStringValue(values.packetStatus),
    propertyId: getStringValue(values.propertyId),
    propertyName: getStringValue(values.propertyName),
    address: getStringValue(values.address),
    city: getStringValue(values.city),
    state: getStringValue(values.state),
    zipCode: getStringValue(values.zipCode),
    county: getStringValue(values.county),
    parcelNumber: getStringValue(values.parcelNumber),
    propertyType: getStringValue(values.propertyType),
    bedrooms: parseNumber(values.bedrooms),
    bathrooms: parseNumber(values.bathrooms),
    squareFeet: parseNumber(values.squareFeet),
    lotSize: parseNumber(values.lotSize),
    yearBuilt: parseNumber(values.yearBuilt),
    units: parseNumber(values.units),
    strategy: getStringValue(values.strategy),
    purchasePrice: parseNumber(values.purchasePrice),
    rehabBudget: parseNumber(values.rehabBudget),
    actualRehabCost: parseNumber(values.actualRehabCost),
    totalProjectCost: parseNumber(values.totalProjectCost),
    currentValue: parseNumber(values.currentValue),
    requestedARV: parseNumber(values.requestedARV),
    supportedARV: parseNumber(values.supportedARV),
    appraisalValue: parseNumber(values.appraisalValue),
    loanAmount: parseNumber(values.loanAmount),
    lenderId: getStringValue(values.lenderId),
    lenderName: getStringValue(values.lenderName),
    appraiserName: getStringValue(values.appraiserName),
    appraisalCompany: getStringValue(values.appraisalCompany),
    appraisalOrderDate: getStringValue(values.appraisalOrderDate),
    appraisalInspectionDate: getStringValue(values.appraisalInspectionDate),
    appraisalDueDate: getStringValue(values.appraisalDueDate),
    appraisalCompletedDate: getStringValue(values.appraisalCompletedDate),
    ownerEntity: getStringValue(values.ownerEntity),
    borrowerName: getStringValue(values.borrowerName),
    contactName: getStringValue(values.contactName),
    contactPhone: getStringValue(values.contactPhone),
    contactEmail: getStringValue(values.contactEmail),
    neighborhood: getStringValue(values.neighborhood),
    marketSummary: getStringValue(values.marketSummary),
    propertySummary: getStringValue(values.propertySummary),
    renovationSummary: getStringValue(values.renovationSummary),
    scopeSummary: getStringValue(values.scopeSummary),
    valueAddSummary: getStringValue(values.valueAddSummary),
    compSelectionSummary: getStringValue(values.compSelectionSummary),
    ARVMethod: getStringValue(values.ARVMethod),
    confidenceLevel: getStringValue(values.confidenceLevel),
    adjustmentSummary: getStringValue(values.adjustmentSummary),
    rentEstimate: parseNumber(values.rentEstimate),
    monthlyTaxes: parseNumber(values.monthlyTaxes),
    monthlyInsurance: parseNumber(values.monthlyInsurance),
    mapUrl: getStringValue(values.mapUrl),
    propertySourceUrl: getStringValue(values.propertySourceUrl),
    permitUrl: getStringValue(values.permitUrl),
    taxRecordUrl: getStringValue(values.taxRecordUrl),
    appraisalReportUrl: getStringValue(values.appraisalReportUrl),
    coverPhotoUrl: getStringValue(values.coverPhotoUrl),
    beforePhotos: Array.isArray(values.beforePhotos) ? values.beforePhotos : [],
    progressPhotos: Array.isArray(values.progressPhotos) ? values.progressPhotos : [],
    afterPhotos: Array.isArray(values.afterPhotos) ? values.afterPhotos : [],
    floorPlanUrls: Array.isArray(values.floorPlanUrls) ? values.floorPlanUrls : [],
    supportingDocumentUrls: Array.isArray(values.supportingDocumentUrls) ? values.supportingDocumentUrls : [],
    comps: Array.isArray(values.comps) ? values.comps : [],
    notes: getStringValue(values.notes),
    favorite: Boolean(values.favorite),
    createdAt: getStringValue(values.createdAt),
    updatedAt: getStringValue(values.updatedAt),
  };
}

function validatePacket(values) {
  const errors = [];
  if (!values.packetName?.trim()) errors.push("Packet name is required.");
  if (!values.address?.trim()) errors.push("Property address is required.");
  if (!values.city?.trim()) errors.push("City is required.");
  if (!values.state?.trim()) errors.push("State is required.");
  if (!values.zipCode?.trim()) errors.push("ZIP code is required.");
  if (!values.propertyType?.trim()) errors.push("Property type is required.");
  if (!values.packetStatus?.trim()) errors.push("Packet status is required.");

  const numericChecks = [
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

  return errors;
}

function calculateDerivedMetrics(packet, comps) {
  const purchasePrice = Number(packet.purchasePrice || 0);
  const actualRehabCost = Number(packet.actualRehabCost || 0);
  const totalProjectCost = purchasePrice + actualRehabCost;
  const squareFeet = Number(packet.squareFeet || 0);
  const supportedARV = Number(packet.supportedARV || 0);
  const requestedARV = Number(packet.requestedARV || 0);
  const loanAmount = Number(packet.loanAmount || 0);
  const pricePerSquareFoot = squareFeet > 0 && supportedARV > 0 ? supportedARV / squareFeet : "";
  const arvVariance = requestedARV - supportedARV;
  const loanToArv = supportedARV > 0 ? (loanAmount / supportedARV) * 100 : "";
  const rehabCostPerSquareFoot = squareFeet > 0 ? actualRehabCost / squareFeet : "";
  const includedComps = Array.isArray(comps) ? comps.filter((comp) => comp.included) : [];
  const compPrices = includedComps.map((comp) => Number(comp.adjustedSalePrice || comp.salePrice || 0)).filter((value) => Number.isFinite(value));
  const compPsf = includedComps.map((comp) => Number(comp.pricePerSquareFoot || 0)).filter((value) => Number.isFinite(value));
  const compAverageSalePrice = compPrices.length ? compPrices.reduce((sum, value) => sum + value, 0) / compPrices.length : "";
  const compAveragePricePerSquareFoot = compPsf.length ? compPsf.reduce((sum, value) => sum + value, 0) / compPsf.length : "";
  const compMedianSalePrice = compPrices.length ? [...compPrices].sort((a, b) => a - b)[Math.floor(compPrices.length / 2)] : "";
  const compMedianPricePerSquareFoot = compPsf.length ? [...compPsf].sort((a, b) => a - b)[Math.floor(compPsf.length / 2)] : "";
  const compRange = compPrices.length ? Math.max(...compPrices) - Math.min(...compPrices) : "";
  const now = new Date();
  const daysBetweenMilestones = [];
  if (packet.appraisalOrderDate) daysBetweenMilestones.push(Math.round((now.getTime() - new Date(packet.appraisalOrderDate).getTime()) / (1000 * 60 * 60 * 24)));
  const completenessScore = calculateCompleteness(packet);
  const warnings = calculateWarnings(packet, includedComps);
  return {
    totalProjectCost,
    pricePerSquareFoot,
    arvVariance,
    loanToArv,
    rehabCostPerSquareFoot,
    compAverageSalePrice,
    compAveragePricePerSquareFoot,
    compMedianSalePrice,
    compMedianPricePerSquareFoot,
    compRange,
    daysBetweenMilestones,
    completenessScore,
    warnings,
  };
}

function calculateCompleteness(packet) {
  const sections = [
    ["Subject Property", Boolean(packet.address && packet.city && packet.state && packet.zipCode && packet.propertyType)],
    ["Deal Numbers", Boolean(packet.purchasePrice || packet.rehabBudget || packet.actualRehabCost || packet.requestedARV || packet.loanAmount)],
    ["Renovation Scope", Boolean(packet.renovationSummary || packet.scopeSummary)],
    ["Comparable Sales", Boolean(packet.compSelectionSummary || (Array.isArray(packet.beforePhotos) && packet.beforePhotos.length > 0) || packet.supportedARV)],
    ["ARV Support", Boolean(packet.supportedARV || packet.ARVMethod)],
    ["Photos", Boolean(packet.coverPhotoUrl || (packet.beforePhotos && packet.beforePhotos.length > 0) || (packet.progressPhotos && packet.progressPhotos.length > 0) || (packet.afterPhotos && packet.afterPhotos.length > 0))],
    ["Maps", Boolean(packet.mapUrl || packet.propertySourceUrl)],
    ["Documents", Boolean(packet.supportingDocumentUrls && packet.supportingDocumentUrls.length > 0)],
    ["Lender Information", Boolean(packet.lenderName || packet.loanAmount)],
    ["Appraisal Timeline", Boolean(packet.appraisalOrderDate || packet.appraisalDueDate || packet.appraisalCompletedDate)],
    ["Contact Information", Boolean(packet.contactName || packet.contactPhone || packet.contactEmail)],
  ];
  const requiredSections = sections.filter(([, isComplete]) => isComplete);
  return sections.length ? Math.round((requiredSections.length / sections.length) * 100) : 0;
}

function calculateWarnings(packet, comps) {
  const warnings = [];
  if (!packet.address) warnings.push("Missing subject address");
  if (!packet.parcelNumber) warnings.push("Missing parcel number");
  if (!packet.squareFeet) warnings.push("Missing square footage");
  if (!packet.yearBuilt) warnings.push("Missing year built");
  if (!packet.purchasePrice) warnings.push("Missing purchase price");
  if (!packet.rehabBudget) warnings.push("Missing rehab budget");
  if (!packet.requestedARV) warnings.push("Missing requested ARV");
  if (!packet.supportedARV) warnings.push("Missing supported ARV");
  if (!comps.length) warnings.push("No included comps");
  if (comps.length < 3) warnings.push("Fewer than 3 included comps");
  if (!packet.renovationSummary) warnings.push("Missing renovation summary");
  if (!packet.scopeSummary) warnings.push("Missing scope summary");
  if (!packet.coverPhotoUrl) warnings.push("Missing cover photo");
  if (!packet.mapUrl) warnings.push("Missing map link");
  if (!packet.taxRecordUrl) warnings.push("Missing tax record link");
  if (!packet.lenderName) warnings.push("Missing lender");
  if (!packet.appraiserName) warnings.push("Missing appraiser");
  if (packet.appraisalDueDate && new Date(packet.appraisalDueDate).getTime() < new Date().getTime()) warnings.push("Appraisal due date passed");
  if (packet.packetStatus === "Completed" && !packet.appraisalReportUrl) warnings.push("Appraisal report missing after completed status");
  if (packet.requestedARV && packet.supportedARV && packet.requestedARV > packet.supportedARV * 1.2) warnings.push("Requested ARV exceeds supported ARV by more than 20%");
  else if (packet.requestedARV && packet.supportedARV && packet.requestedARV > packet.supportedARV * 1.1) warnings.push("Requested ARV exceeds supported ARV by more than 10%");
  if (packet.loanAmount && packet.supportedARV && (packet.loanAmount / packet.supportedARV) * 100 > 80) warnings.push("Loan-to-ARV above 80%");
  else if (packet.loanAmount && packet.supportedARV && (packet.loanAmount / packet.supportedARV) * 100 > 75) warnings.push("Loan-to-ARV above 75%");
  if (packet.updatedAt) {
    const updatedAt = new Date(packet.updatedAt);
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 30);
    if (updatedAt < cutoff) warnings.push("Packet record not updated within 30 days");
  }
  return warnings;
}

function buildCompRecords(packetComps, basePacket) {
  return (packetComps || []).map((comp, index) => {
    const salePrice = Number(comp.salePrice || 0);
    const adjustedSalePrice = Number(comp.adjustedSalePrice || comp.salePrice || 0);
    const squareFeet = Number(comp.squareFeet || 0);
    const pricePerSquareFoot = squareFeet > 0 ? salePrice / squareFeet : "";
    const weight = Number(comp.compWeight || 1);
    const adjustmentAmount = adjustedSalePrice > 0 && salePrice > 0 ? adjustedSalePrice - salePrice : Number(comp.adjustmentAmount || 0);
    return {
      ...comp,
      id: comp.id || `comp-${index + 1}`,
      compId: comp.compId || comp.id || `comp-${index + 1}`,
      address: comp.address || comp.compAddress || "",
      city: comp.city || "",
      state: comp.state || "",
      zipCode: comp.zipCode || "",
      salePrice,
      saleDate: comp.saleDate || "",
      squareFeet,
      bedrooms: comp.bedrooms || "",
      bathrooms: comp.bathrooms || "",
      yearBuilt: comp.yearBuilt || "",
      distanceMiles: comp.distanceMiles || "",
      pricePerSquareFoot,
      propertyType: comp.propertyType || basePacket.propertyType || "",
      condition: comp.condition || "Average",
      sourceUrl: comp.sourceUrl || "",
      listingUrl: comp.listingUrl || "",
      photoUrl: comp.photoUrl || "",
      included: comp.included !== false,
      compWeight: weight,
      qualityGrade: comp.qualityGrade || "Fair",
      adjustmentAmount,
      adjustedSalePrice,
      notes: comp.notes || "",
      adjustmentSummary: comp.adjustmentSummary || "No unsupported adjustments were applied.",
      rawSalePrice: salePrice,
      totalAdjustments: adjustmentAmount,
      weightedValue: adjustedSalePrice * weight,
      propertyLevelDetails: {
        squareFootage: squareFeet > 0 ? `${squareFeet.toLocaleString()} sf` : "Insufficient Data",
        bedrooms: comp.bedrooms || "Insufficient Data",
        bathrooms: comp.bathrooms || "Insufficient Data",
        yearBuilt: comp.yearBuilt || "Insufficient Data",
        condition: comp.condition || "Average",
      },
    };
  });
}

function downloadJson(filename, data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function downloadCsv(filename, rows) {
  const headers = Object.keys(rows[0] || {});
  const csvRows = [headers.join(",")];
  rows.forEach((row) => {
    csvRows.push(headers.map((header) => `"${String(row[header] ?? "").replace(/"/g, '""')}"`).join(","));
  });
  const blob = new Blob([csvRows.join("\n")], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export default function AppraiserPacketBuilder({ onBack, onOpenDealAnalyzer, onOpenFlipAnalyzer, onOpenBrrrrAnalyzer, onOpenProductVault, onOpenContractorHub, onOpenCompDatabase, onOpenNeighborhoodDatabase, onOpenPortfolioDashboard, onOpenPropertyDatabase, onOpenVendorDatabase, onOpenMaterialMatrix, onOpenLenderDashboard, onOpenDealIntake }) {
  const [packets, setPackets] = useState([]);
  const [properties, setProperties] = useState([]);
  const [deals, setDeals] = useState([]);
  const [comps, setComps] = useState([]);
  const [, setLenders] = useState([]);
  const [formValues, setFormValues] = useState(initialValues);
  const [editingId, setEditingId] = useState(null);
  const [viewRecord, setViewRecord] = useState(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [propertyTypeFilter, setPropertyTypeFilter] = useState("All");
  const [strategyFilter, setStrategyFilter] = useState("All");
  const [stateFilter, setStateFilter] = useState("All");
  const [cityFilter, setCityFilter] = useState("");
  const [zipFilter, setZipFilter] = useState("");
  const [lenderFilter, setLenderFilter] = useState("All");
  const [appraiserFilter, setAppraiserFilter] = useState("All");
  const [confidenceFilter, setConfidenceFilter] = useState("All");
  const [arvMethodFilter, setArvMethodFilter] = useState("All");
  const [favoriteFilter, setFavoriteFilter] = useState("All");
  const [missingCompsFilter, setMissingCompsFilter] = useState("All");
  const [missingPhotosFilter, setMissingPhotosFilter] = useState("All");
  const [pastDueFilter, setPastDueFilter] = useState("All");
  const [minCompletenessFilter, setMinCompletenessFilter] = useState("");
  const [maxVarianceFilter, setMaxVarianceFilter] = useState("");
  const [maxLoanToArvFilter, setMaxLoanToArvFilter] = useState("");
  const [sortBy, setSortBy] = useState("updated");
  const [message, setMessage] = useState({ type: "info", text: "" });
  const [loading, setLoading] = useState(true);
  const [selectedCompIds, setSelectedCompIds] = useState([]);
  const [comparisonIds, setComparisonIds] = useState([]);
  const [printView, setPrintView] = useState(false);

  const loadPackets = async () => {
    setLoading(true);
    try {
      const response = await fetch(buildApiUrl("/api/appraisal-packets"));
      if (!response.ok) throw new Error("backend unavailable");
      const data = await response.json();
      setPackets(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Unable to load packets from API, using localStorage fallback", error);
      try {
        const stored = JSON.parse(window.localStorage.getItem("royalStarAppraisalPackets") || "[]") || [];
        setPackets(Array.isArray(stored) ? stored : []);
      } catch (localError) {
        console.error("Unable to read packets from localStorage", localError);
        setPackets([]);
      }
    } finally {
      setLoading(false);
    }
  };

  const loadRelatedData = async () => {
    const fetchJson = async (endpoint, storageKey) => {
      try {
        const response = await fetch(buildApiUrl(endpoint));
        if (!response.ok) throw new Error("backend unavailable");
        const data = await response.json();
        return Array.isArray(data) ? data : [];
      } catch {
        try {
          const stored = JSON.parse(window.localStorage.getItem(storageKey) || "[]") || [];
          return Array.isArray(stored) ? stored : [];
        } catch {
          return [];
        }
      }
    };

    const [propertiesData, dealsData, compsData, lendersData] = await Promise.all([
      fetchJson("/api/properties", "royalStarProperties"),
      fetchJson("/api/deals", "royalStarDeals"),
      fetchJson("/api/comps", "royalStarComps"),
      fetchJson("/api/lenders", "royalStarLenders"),
    ]);
    setProperties(propertiesData);
    setDeals(dealsData);
    setComps(compsData);
    setLenders(lendersData);
  };

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadPackets();
      void loadRelatedData();
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const packetsWithMetrics = useMemo(() => {
    return packets.map((packet) => {
      const derived = calculateDerivedMetrics(packet, buildCompRecords(packet.comps || [], packet));
      const warnings = calculateWarnings(packet, buildCompRecords(packet.comps || [], packet).filter((comp) => comp.included));
      return { ...packet, ...derived, warnings, compRecords: buildCompRecords(packet.comps || [], packet) };
    });
  }, [packets]);

  const visiblePackets = useMemo(() => {
    const searchTerm = search.trim().toLowerCase();
    const filtered = packetsWithMetrics.filter((packet) => {
      const haystack = [packet.packetName, packet.propertyName, packet.address, packet.city, packet.zipCode, packet.parcelNumber, packet.lenderName, packet.appraiserName, packet.borrowerName].join(" ").toLowerCase();
      const matchesSearch = !searchTerm || haystack.includes(searchTerm);
      const matchesStatus = statusFilter === "All" || packet.packetStatus === statusFilter;
      const matchesPropertyType = propertyTypeFilter === "All" || packet.propertyType === propertyTypeFilter;
      const matchesStrategy = strategyFilter === "All" || packet.strategy === strategyFilter;
      const matchesState = stateFilter === "All" || packet.state === stateFilter;
      const matchesCity = !cityFilter || packet.city?.toLowerCase().includes(cityFilter.toLowerCase());
      const matchesZip = !zipFilter || packet.zipCode?.includes(zipFilter);
      const matchesLender = lenderFilter === "All" || packet.lenderName === lenderFilter;
      const matchesAppraiser = appraiserFilter === "All" || packet.appraiserName === appraiserFilter;
      const matchesConfidence = confidenceFilter === "All" || packet.confidenceLevel === confidenceFilter;
      const matchesArvMethod = arvMethodFilter === "All" || packet.ARVMethod === arvMethodFilter;
      const matchesFavorite = favoriteFilter === "All" || (favoriteFilter === "Favorites Only" ? packet.favorite : !packet.favorite);
      const matchesMissingComps = missingCompsFilter === "All" || (missingCompsFilter === "Yes" ? packet.warnings.includes("No included comps") || packet.warnings.includes("Fewer than 3 included comps") : !packet.warnings.includes("No included comps") && !packet.warnings.includes("Fewer than 3 included comps"));
      const matchesMissingPhotos = missingPhotosFilter === "All" || (missingPhotosFilter === "Yes" ? packet.warnings.includes("Missing cover photo") : !packet.warnings.includes("Missing cover photo"));
      const matchesPastDue = pastDueFilter === "All" || (pastDueFilter === "Yes" ? packet.warnings.includes("Appraisal due date passed") : !packet.warnings.includes("Appraisal due date passed"));
      const matchesCompleteness = !minCompletenessFilter || packet.completenessScore >= Number(minCompletenessFilter);
      const matchesVariance = !maxVarianceFilter || (packet.arvVariance === "" ? false : Number(packet.arvVariance) <= Number(maxVarianceFilter));
      const matchesLoanToArv = !maxLoanToArvFilter || (packet.loanToArv === "" ? false : Number(packet.loanToArv) <= Number(maxLoanToArvFilter));
      return matchesSearch && matchesStatus && matchesPropertyType && matchesStrategy && matchesState && matchesCity && matchesZip && matchesLender && matchesAppraiser && matchesConfidence && matchesArvMethod && matchesFavorite && matchesMissingComps && matchesMissingPhotos && matchesPastDue && matchesCompleteness && matchesVariance && matchesLoanToArv;
    });

    switch (sortBy) {
      case "name":
        filtered.sort((a, b) => (a.packetName || "").localeCompare(b.packetName || ""));
        break;
      case "newest":
        filtered.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
        break;
      case "oldest":
        filtered.sort((a, b) => (a.createdAt || "").localeCompare(b.createdAt || ""));
        break;
      case "arvHigh":
        filtered.sort((a, b) => Number(b.supportedARV || 0) - Number(a.supportedARV || 0));
        break;
      case "arvLow":
        filtered.sort((a, b) => Number(a.supportedARV || 0) - Number(b.supportedARV || 0));
        break;
      case "completeHigh":
        filtered.sort((a, b) => Number(b.completenessScore || 0) - Number(a.completenessScore || 0));
        break;
      case "completeLow":
        filtered.sort((a, b) => Number(a.completenessScore || 0) - Number(b.completenessScore || 0));
        break;
      case "varianceHigh":
        filtered.sort((a, b) => Number(b.arvVariance || 0) - Number(a.arvVariance || 0));
        break;
      case "varianceLow":
        filtered.sort((a, b) => Number(a.arvVariance || 0) - Number(b.arvVariance || 0));
        break;
      case "due":
        filtered.sort((a, b) => (a.appraisalDueDate || "").localeCompare(b.appraisalDueDate || ""));
        break;
      case "updated":
        filtered.sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""));
        break;
      default:
        filtered.sort((a, b) => (a.packetName || "").localeCompare(b.packetName || ""));
    }

    return filtered;
  }, [packetsWithMetrics, search, statusFilter, propertyTypeFilter, strategyFilter, stateFilter, cityFilter, zipFilter, lenderFilter, appraiserFilter, confidenceFilter, arvMethodFilter, favoriteFilter, missingCompsFilter, missingPhotosFilter, pastDueFilter, minCompletenessFilter, maxVarianceFilter, maxLoanToArvFilter, sortBy]);

  const summaryStats = useMemo(() => {
    const total = packetsWithMetrics.length;
    const draft = packetsWithMetrics.filter((item) => item.packetStatus === "Draft").length;
    const ready = packetsWithMetrics.filter((item) => item.packetStatus === "Ready for Review").length;
    const submitted = packetsWithMetrics.filter((item) => item.packetStatus === "Submitted").length;
    const active = packetsWithMetrics.filter((item) => ["In Progress", "Appraisal Ordered", "Inspection Scheduled", "Awaiting Report"].includes(item.packetStatus)).length;
    const completed = packetsWithMetrics.filter((item) => item.packetStatus === "Completed").length;
    const revisions = packetsWithMetrics.filter((item) => item.packetStatus === "Revision Requested").length;
    const supportedValues = packetsWithMetrics.map((item) => Number(item.supportedARV)).filter((value) => Number.isFinite(value));
    const appraisalValues = packetsWithMetrics.map((item) => Number(item.appraisalValue)).filter((value) => Number.isFinite(value));
    const variances = packetsWithMetrics.map((item) => Number(item.arvVariance)).filter((value) => Number.isFinite(value));
    const completeness = packetsWithMetrics.map((item) => Number(item.completenessScore)).filter((value) => Number.isFinite(value));
    const missingComps = packetsWithMetrics.filter((item) => item.warnings.includes("No included comps") || item.warnings.includes("Fewer than 3 included comps")).length;
    const missingPhotos = packetsWithMetrics.filter((item) => item.warnings.includes("Missing cover photo")).length;
    const pastDue = packetsWithMetrics.filter((item) => item.warnings.includes("Appraisal due date passed")).length;
    const favorites = packetsWithMetrics.filter((item) => item.favorite).length;
    return { total, draft, ready, submitted, active, completed, revisions, supportedValues, appraisalValues, variances, completeness, missingComps, missingPhotos, pastDue, favorites };
  }, [packetsWithMetrics]);

  const averageSupportedArv = summaryStats.supportedValues.length ? summaryStats.supportedValues.reduce((sum, value) => sum + value, 0) / summaryStats.supportedValues.length : 0;
  const averageAppraisalValue = summaryStats.appraisalValues.length ? summaryStats.appraisalValues.reduce((sum, value) => sum + value, 0) / summaryStats.appraisalValues.length : 0;
  const averageArvVariance = summaryStats.variances.length ? summaryStats.variances.reduce((sum, value) => sum + value, 0) / summaryStats.variances.length : 0;
  const averageCompleteness = summaryStats.completeness.length ? summaryStats.completeness.reduce((sum, value) => sum + value, 0) / summaryStats.completeness.length : 0;
  const packetIntelligenceContext = useMemo(() => {
    if (viewRecord?.id) {
      return packetsWithMetrics.find((packet) => packet.id === viewRecord.id) || viewRecord;
    }
    return packetsWithMetrics[0] || null;
  }, [packetsWithMetrics, viewRecord]);
  const appraisalPacketIntelligence = useMemo(() => {
    return buildAppraisalPacketIntelligence({
      packet: packetIntelligenceContext || {},
      comps: (packetIntelligenceContext?.compRecords || packetIntelligenceContext?.comps || []).filter(Boolean),
    });
  }, [packetIntelligenceContext]);

  const handleChange = (event) => {
    const { name, value, type, checked } = event.target;
    setFormValues((current) => ({ ...current, [name]: type === "checkbox" ? checked : value }));
  };

  const resetForm = () => {
    setFormValues(initialValues);
    setEditingId(null);
    setMessage({ type: "info", text: "Form cleared." });
  };

  const savePacket = async (event) => {
    event.preventDefault();
    const normalized = normalizePacketPayload(formValues);
    const errors = validatePacket(normalized);
    if (errors.length > 0) {
      setMessage({ type: "error", text: errors.join(" ") });
      return;
    }

    const duplicates = packets.filter((item) => {
      if (editingId && item.id === editingId) return false;
      const sameName = normalized.packetName && item.packetName && normalized.packetName.toLowerCase() === item.packetName.toLowerCase();
      const sameAddress = normalized.address && item.address && normalized.address.toLowerCase() === item.address.toLowerCase();
      const sameParcel = normalized.parcelNumber && item.parcelNumber && normalized.parcelNumber === item.parcelNumber;
      const sameOrderDate = normalized.appraisalOrderDate && item.appraisalOrderDate && normalized.appraisalOrderDate === item.appraisalOrderDate;
      return sameName || sameAddress || sameParcel || sameOrderDate;
    });

    if (duplicates.length > 0 && !window.confirm("This packet appears similar to an existing record. Continue creating a duplicate?")) {
      setMessage({ type: "error", text: "Duplicate packet creation cancelled." });
      return;
    }

    const derived = calculateDerivedMetrics(normalized, []);
    const payload = {
      ...normalized,
      totalProjectCost: derived.totalProjectCost,
      supportedARV: normalized.supportedARV || "",
      confidenceLevel: normalized.confidenceLevel || "Insufficient Data",
      createdAt: normalized.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    try {
      const response = editingId
        ? await fetch(buildApiUrl(`/api/appraisal-packets/${editingId}`), { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) })
        : await fetch(buildApiUrl("/api/appraisal-packets"), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      if (!response.ok) throw new Error("backend unavailable");
      const saved = await response.json();
      const nextPackets = editingId ? packets.map((item) => (item.id === editingId ? saved : item)) : [...packets, saved];
      setPackets(nextPackets);
      window.localStorage.setItem("royalStarAppraisalPackets", JSON.stringify(nextPackets));
      setMessage({ type: "success", text: editingId ? "Packet updated successfully." : "Packet added successfully." });
      resetForm();
      setViewRecord(null);
    } catch (error) {
      console.error("Unable to save packet via API, using localStorage fallback", error);
      const nextPackets = editingId ? packets.map((item) => (item.id === editingId ? payload : item)) : [...packets, payload];
      setPackets(nextPackets);
      window.localStorage.setItem("royalStarAppraisalPackets", JSON.stringify(nextPackets));
      setMessage({ type: "success", text: editingId ? "Packet updated locally." : "Packet added locally." });
      resetForm();
      setViewRecord(null);
    }
  };

  const editPacket = (packet) => {
    setFormValues({ ...initialValues, ...packet });
    setEditingId(packet.id);
    setViewRecord(null);
    setMessage({ type: "info", text: `Editing ${packet.packetName || "packet"}.` });
  };

  const duplicatePacket = (packet) => {
    const duplicatePayload = { ...packet, id: "", packetName: `${packet.packetName} Copy`, createdAt: "", updatedAt: "" };
    setFormValues({ ...initialValues, ...duplicatePayload });
    setEditingId(null);
    setViewRecord(null);
    setMessage({ type: "info", text: "Duplicate packet loaded into the form." });
  };

  const deletePacket = async (packetId) => {
    if (!window.confirm("Delete this packet record?")) return;
    try {
      const response = await fetch(buildApiUrl(`/api/appraisal-packets/${packetId}`), { method: "DELETE" });
      if (!response.ok) throw new Error("backend unavailable");
      const nextPackets = packets.filter((item) => item.id !== packetId);
      setPackets(nextPackets);
      window.localStorage.setItem("royalStarAppraisalPackets", JSON.stringify(nextPackets));
      setMessage({ type: "success", text: "Packet deleted successfully." });
    } catch {
      const nextPackets = packets.filter((item) => item.id !== packetId);
      setPackets(nextPackets);
      window.localStorage.setItem("royalStarAppraisalPackets", JSON.stringify(nextPackets));
      setMessage({ type: "success", text: "Packet deleted locally." });
    }
  };

  const toggleFavorite = async (packet) => {
    const nextValue = !packet.favorite;
    const updated = { ...packet, favorite: nextValue, updatedAt: new Date().toISOString() };
    try {
      const response = await fetch(buildApiUrl(`/api/appraisal-packets/${packet.id}`), { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(updated) });
      if (!response.ok) throw new Error("backend unavailable");
      const saved = await response.json();
      setPackets((current) => current.map((item) => (item.id === packet.id ? saved : item)));
    } catch {
      setPackets((current) => current.map((item) => (item.id === packet.id ? updated : item)));
    }
  };

  const importProperty = (propertyId) => {
    const property = properties.find((item) => item.id === propertyId);
    if (!property) return;
    const shouldPrefill = !formValues.address && !formValues.city && !formValues.state && !formValues.zipCode && !formValues.purchasePrice;
    if (!shouldPrefill && !window.confirm("Replace current packet values with this property?")) return;
    setFormValues((current) => ({
      ...current,
      propertyId: property.id,
      propertyName: current.propertyName || property.propertyName || property.address || "",
      address: current.address || property.address || "",
      city: current.city || property.city || "",
      state: current.state || property.state || "",
      zipCode: current.zipCode || property.zipCode || "",
      county: current.county || property.county || "",
      parcelNumber: current.parcelNumber || property.parcelNumber || "",
      propertyType: current.propertyType || property.propertyType || "Single Family",
      bedrooms: current.bedrooms || property.bedrooms || "",
      bathrooms: current.bathrooms || property.bathrooms || "",
      squareFeet: current.squareFeet || property.squareFeet || "",
      lotSize: current.lotSize || property.lotSize || "",
      yearBuilt: current.yearBuilt || property.yearBuilt || "",
      purchasePrice: current.purchasePrice || property.purchasePrice || "",
      rehabBudget: current.rehabBudget || property.rehabBudget || "",
      actualRehabCost: current.actualRehabCost || property.actualRehabCost || "",
      currentValue: current.currentValue || property.currentEstimatedValue || "",
      neighborhood: current.neighborhood || property.neighborhood || "",
      notes: current.notes || property.notes || "",
    }));
  };

  const importDeal = async (dealId) => {
    const deal = deals.find((item) => item.id === dealId);
    if (!deal) return;
    const shouldPrefill = !formValues.purchasePrice && !formValues.rehabBudget && !formValues.requestedARV && !formValues.strategy;
    if (!shouldPrefill && !window.confirm("Replace current packet values with this saved deal?")) return;
    let support = null;
    try {
      const response = await fetch(buildApiUrl(`/api/underwriting/appraiser-packet-support?dealId=${encodeURIComponent(dealId)}`));
      if (response.ok) {
        const payload = await response.json();
        support = payload?.ok ? payload : null;
      }
    } catch {
      support = null;
    }

    setFormValues((current) => ({
      ...current,
      propertyName: current.propertyName || deal.propertyAddress || "",
      address: current.address || deal.propertyAddress || "",
      city: current.city || deal.city || "",
      state: current.state || deal.state || "",
      zipCode: current.zipCode || deal.zipCode || "",
      propertyType: current.propertyType || deal.propertyType || "Single Family",
      purchasePrice: current.purchasePrice || deal.purchasePrice || deal.askingPrice || "",
      rehabBudget: current.rehabBudget || deal.rehabBudget || "",
      requestedARV: current.requestedARV || support?.recommendedArv || deal.estimatedArv || "",
      supportedARV: current.supportedARV || support?.approvedArv || support?.recommendedArv || deal.supportedARV || deal.estimatedArv || "",
      confidenceLevel: current.confidenceLevel || (support?.confidenceScore >= 80 ? "High" : support?.confidenceScore >= 60 ? "Moderate" : support?.confidenceScore > 0 ? "Low" : "Insufficient Data"),
      ARVMethod: current.ARVMethod || (support?.appraisalReviewStatus === "REVIEW_REQUIRED" ? "Review Required" : "Comp Weighted"),
      compSelectionSummary: current.compSelectionSummary || (Array.isArray(support?.compSet) && support.compSet.length > 0 ? `Governed comp set (${support.compSet.length})` : current.compSelectionSummary || ""),
      comps: (current.comps && current.comps.length > 0)
        ? current.comps
        : (Array.isArray(support?.compSet)
          ? support.compSet.map((comp) => ({
            id: comp.id,
            compId: comp.id,
            address: comp.address || "",
            salePrice: comp.salePrice || "",
            saleDate: comp.saleDate || "",
            qualityGrade: (comp.qualityScore || 0) >= 80 ? "Excellent" : (comp.qualityScore || 0) >= 65 ? "Good" : "Fair",
            sourceUrl: comp.sourceLink || "",
            included: true,
            adjustmentAmount: "",
            adjustedSalePrice: comp.salePrice || "",
            notes: "Imported from governed underwriting comp set",
          }))
          : current.comps),
      strategy: current.strategy || deal.strategy || "Hold",
      notes: current.notes || deal.notes || "",
    }));
    setMessage({ type: "success", text: support ? "Deal and governed underwriting support imported." : "Deal imported into packet." });
  };

  const toggleCompSelection = (compId) => {
    setSelectedCompIds((current) => (current.includes(compId) ? current.filter((id) => id !== compId) : [...current, compId].slice(-10)));
  };

  const addCompToPacket = (comp) => {
    if (!formValues.id) {
      setMessage({ type: "info", text: "Save the packet first to attach comparable sales." });
      return;
    }
    const nextComp = {
      ...comp,
      id: comp.id || createId("comp"),
      compId: comp.id || createId("comp"),
      address: comp.address || comp.compAddress || "",
      city: comp.city || "",
      state: comp.state || "",
      zipCode: comp.zipCode || "",
      salePrice: comp.salePrice || "",
      saleDate: comp.saleDate || "",
      squareFeet: comp.squareFeet || "",
      bedrooms: comp.bedrooms || "",
      bathrooms: comp.bathrooms || "",
      yearBuilt: comp.yearBuilt || "",
      distanceMiles: comp.distanceMiles || "",
      pricePerSquareFoot: comp.pricePerSquareFoot || (comp.squareFeet && comp.salePrice ? Number(comp.salePrice) / Number(comp.squareFeet) : ""),
      propertyType: comp.propertyType || formValues.propertyType || "",
      condition: comp.condition || "Average",
      sourceUrl: comp.sourceUrl || "",
      listingUrl: comp.listingUrl || "",
      photoUrl: comp.photoUrl || "",
      included: true,
      compWeight: 1,
      qualityGrade: "Fair",
      adjustmentAmount: "",
      adjustedSalePrice: comp.salePrice || "",
      notes: comp.notes || "",
    };

    setFormValues((current) => ({ ...current, comps: [...(current.comps || []), nextComp] }));
    setMessage({ type: "info", text: "Comparable added to packet." });
  };

  const removeCompFromPacket = (compId) => {
    setFormValues((current) => ({ ...current, comps: (current.comps || []).filter((comp) => comp.id !== compId) }));
  };

  const toggleComparison = (packetId) => {
    setComparisonIds((current) => current.includes(packetId) ? current.filter((id) => id !== packetId) : [...current, packetId].slice(-5));
  };

  const exportSummary = () => {
    const rows = visiblePackets.map((packet) => ({ packetName: packet.packetName, propertyName: packet.propertyName, requestedARV: packet.requestedARV, supportedARV: packet.supportedARV, appraisalValue: packet.appraisalValue, completenessScore: packet.completenessScore, confidenceLevel: packet.confidenceLevel, warningCount: packet.warnings.length }));
    downloadCsv("packet-summary.csv", rows);
    downloadJson("packet-summary.json", rows);
    setMessage({ type: "success", text: "Packet summary exported." });
  };

  const exportCompTable = () => {
    const rows = visiblePackets.flatMap((packet) => (packet.compRecords || []).map((comp) => ({ packetName: packet.packetName, address: comp.address, salePrice: comp.salePrice, adjustedSalePrice: comp.adjustedSalePrice, included: comp.included ? "Yes" : "No", qualityGrade: comp.qualityGrade })));
    downloadCsv("comp-table.csv", rows);
    setMessage({ type: "success", text: "Comp table exported." });
  };

  const exportWarnings = () => {
    const rows = visiblePackets.flatMap((packet) => packet.warnings.map((warning) => ({ packetName: packet.packetName, warning })));
    downloadCsv("warning-list.csv", rows);
    setMessage({ type: "success", text: "Warnings exported." });
  };

  const openPrintView = () => {
    setPrintView(true);
    setTimeout(() => window.print(), 200);
  };

  const activePacket = viewRecord || visiblePackets[0] || null;
  const activeCompRecords = (activePacket?.compRecords || []).filter((comp) => comp.included !== false);
  const activeAppraisalInsights = activePacket
    ? {
        indicatedArvRange: activePacket.supportedARV && activePacket.supportedARV > 0 ? [activePacket.supportedARV * 0.95, activePacket.supportedARV, activePacket.supportedARV * 1.05] : [0, 0, 0],
        weightedArv: activePacket.supportedARV || 0,
        confidenceLevel: activePacket.confidenceLevel || "Insufficient Data",
        explanation: activePacket.supportedARV ? `The value is based on ${activeCompRecords.length} included comparables and a supported ARV of ${formatCurrency(activePacket.supportedARV)}.` : "Insufficient Data",
      }
    : null;

  return (
    <div style={styles.page}>
      <style>{`@media print { .no-print { display: none !important; } .print-only { display: block !important; } }`}</style>
      <aside style={styles.sidebar} className="no-print">
        <div style={styles.logoArea}><img src={logo} alt="Royal Star Properties" style={styles.logo} /></div>
        <nav style={styles.nav}>
          {navigation.map(([icon, label]) => {
            const isHome = label === "COMMAND CENTER";
            const isDealAnalyzer = label === "DEAL ANALYZER";
            const isFlip = label === "FLIP ANALYZER";
            const isBrrrr = label === "BRRRR ANALYZER";
            const isProduct = label === "PRODUCT VAULT";
            const isContractor = label === "CONTRACTOR HUB";
            const isComp = label === "COMP DATABASE";
            const isNeighborhood = label === "NEIGHBORHOOD DB";
            const isPortfolio = label === "PORTFOLIO DASHBOARD";
            const isProperty = label === "PROPERTY DATABASE";
            const isVendor = label === "VENDOR DATABASE";
            const isMaterial = label === "MATERIAL MATRIX";
            const isLender = label === "LENDER DASHBOARD";
            const isNewDeal = label === "ADD NEW DEAL";
            return (
              <button key={label} type="button" style={styles.navButton} onClick={isHome ? onBack : isDealAnalyzer ? onOpenDealAnalyzer : isFlip ? onOpenFlipAnalyzer : isBrrrr ? onOpenBrrrrAnalyzer : isProduct ? onOpenProductVault : isContractor ? onOpenContractorHub : isComp ? onOpenCompDatabase : isNeighborhood ? onOpenNeighborhoodDatabase : isPortfolio ? onOpenPortfolioDashboard : isProperty ? onOpenPropertyDatabase : isVendor ? onOpenVendorDatabase : isMaterial ? onOpenMaterialMatrix : isLender ? onOpenLenderDashboard : isNewDeal ? onOpenDealIntake : undefined}>
                <span style={styles.navIcon}>{icon}</span><span>{label}</span><span style={styles.navTab} />
              </button>
            );
          })}
        </nav>
      </aside>

      <main style={styles.main}>
        <section style={styles.topBar} className="no-print">
          <div><div style={styles.eyebrow}>ROYAL STAR APPRAISAL OPERATIONS</div><h1 style={styles.pageTitle}>APPRAISER PACKET BUILDER</h1></div>
          <div style={styles.topActions}>
            <button type="button" style={styles.secondaryButton} onClick={onBack}>COMMAND CENTER</button>
            <button type="button" style={styles.primaryButton} onClick={() => setViewRecord(null)}>VIEW PACKETS</button>
          </div>
        </section>

        {message.text ? <div style={message.type === "error" ? styles.errorBanner : styles.successBanner} className="no-print">{message.text}</div> : null}

        <section style={styles.summaryGrid} className="no-print">
          <SummaryCard label="Total Packets" value={summaryStats.total} />
          <SummaryCard label="Draft Packets" value={summaryStats.draft} />
          <SummaryCard label="Ready for Review" value={summaryStats.ready} />
          <SummaryCard label="Submitted Packets" value={summaryStats.submitted} />
          <SummaryCard label="Active Appraisals" value={summaryStats.active} />
          <SummaryCard label="Completed Appraisals" value={summaryStats.completed} />
          <SummaryCard label="Revision Requests" value={summaryStats.revisions} />
          <SummaryCard label="Average Supported ARV" value={formatCurrency(averageSupportedArv)} />
          <SummaryCard label="Average Appraisal Value" value={formatCurrency(averageAppraisalValue)} />
          <SummaryCard label="Average ARV Variance" value={formatCurrency(averageArvVariance)} />
          <SummaryCard label="Average Packet Completeness" value={`${Number(averageCompleteness).toFixed(1)}%`} />
          <SummaryCard label="Packets Missing Comps" value={summaryStats.missingComps} />
          <SummaryCard label="Packets Missing Photos" value={summaryStats.missingPhotos} />
          <SummaryCard label="Packets Past Due" value={summaryStats.pastDue} />
          <SummaryCard label="Favorite Packets" value={summaryStats.favorites} />
        </section>

        <section style={styles.insightPanel} className="no-print">
          <div style={styles.insightTitle}>PACKET INTELLIGENCE</div>
          <div style={styles.insightBody}>{appraisalPacketIntelligence.summary}</div>
          <div style={styles.insightMeta}>Risk: {appraisalPacketIntelligence.appraisal.riskLevel} • Variance: {appraisalPacketIntelligence.appraisal.variance.toFixed(1)}%</div>
          <ul style={styles.insightList}>
            {appraisalPacketIntelligence.nextSteps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ul>
        </section>

        <section style={styles.contentGrid} className="no-print">
          <div style={styles.panel}>
            <div style={styles.panelHeader}><h2 style={styles.panelTitle}>PACKET FORM</h2><button type="button" style={styles.secondaryButton} onClick={resetForm}>CLEAR FORM</button></div>
            <form onSubmit={savePacket} style={styles.form}>
              <FieldGroup title="Packet Basics">
                <div style={styles.fieldRow}><label style={styles.label}>Packet Name<input name="packetName" value={formValues.packetName} onChange={handleChange} style={styles.input} required /></label><label style={styles.label}>Packet Status<select name="packetStatus" value={formValues.packetStatus} onChange={handleChange} style={styles.input}>{packetStatusOptions.map((option) => <option key={option} value={option}>{option}</option>)}</select></label></div>
                <div style={styles.fieldRow}><label style={styles.label}>Property Name<input name="propertyName" value={formValues.propertyName} onChange={handleChange} style={styles.input} /></label><label style={styles.label}>Strategy<select name="strategy" value={formValues.strategy} onChange={handleChange} style={styles.input}>{strategyOptions.map((option) => <option key={option} value={option}>{option}</option>)}</select></label></div>
                <div style={styles.fieldRow}><label style={styles.label}>Address<input name="address" value={formValues.address} onChange={handleChange} style={styles.input} /></label><label style={styles.label}>City<input name="city" value={formValues.city} onChange={handleChange} style={styles.input} /></label></div>
                <div style={styles.fieldRow}><label style={styles.label}>State<input name="state" value={formValues.state} onChange={handleChange} style={styles.input} /></label><label style={styles.label}>ZIP<input name="zipCode" value={formValues.zipCode} onChange={handleChange} style={styles.input} /></label></div>
                <div style={styles.fieldRow}><label style={styles.label}>County<input name="county" value={formValues.county} onChange={handleChange} style={styles.input} /></label><label style={styles.label}>Parcel Number<input name="parcelNumber" value={formValues.parcelNumber} onChange={handleChange} style={styles.input} /></label></div>
                <div style={styles.fieldRow}><label style={styles.label}>Property Type<select name="propertyType" value={formValues.propertyType} onChange={handleChange} style={styles.input}>{propertyTypeOptions.map((option) => <option key={option} value={option}>{option}</option>)}</select></label><label style={styles.label}>Neighborhood<input name="neighborhood" value={formValues.neighborhood} onChange={handleChange} style={styles.input} /></label></div>
                <div style={styles.fieldRow}><label style={styles.label}>Bedrooms<input name="bedrooms" type="number" value={formValues.bedrooms} onChange={handleChange} style={styles.input} /></label><label style={styles.label}>Bathrooms<input name="bathrooms" type="number" value={formValues.bathrooms} onChange={handleChange} style={styles.input} /></label></div>
                <div style={styles.fieldRow}><label style={styles.label}>Square Feet<input name="squareFeet" type="number" value={formValues.squareFeet} onChange={handleChange} style={styles.input} /></label><label style={styles.label}>Lot Size<input name="lotSize" type="number" value={formValues.lotSize} onChange={handleChange} style={styles.input} /></label></div>
                <div style={styles.fieldRow}><label style={styles.label}>Year Built<input name="yearBuilt" type="number" value={formValues.yearBuilt} onChange={handleChange} style={styles.input} /></label><label style={styles.label}>Units<input name="units" type="number" value={formValues.units} onChange={handleChange} style={styles.input} /></label></div>
              </FieldGroup>

              <FieldGroup title="Deal Numbers & Financing">
                <div style={styles.fieldRow}><label style={styles.label}>Purchase Price<input name="purchasePrice" type="number" value={formValues.purchasePrice} onChange={handleChange} style={styles.input} /></label><label style={styles.label}>Rehab Budget<input name="rehabBudget" type="number" value={formValues.rehabBudget} onChange={handleChange} style={styles.input} /></label></div>
                <div style={styles.fieldRow}><label style={styles.label}>Actual Rehab Cost<input name="actualRehabCost" type="number" value={formValues.actualRehabCost} onChange={handleChange} style={styles.input} /></label><label style={styles.label}>Current Value<input name="currentValue" type="number" value={formValues.currentValue} onChange={handleChange} style={styles.input} /></label></div>
                <div style={styles.fieldRow}><label style={styles.label}>Requested ARV<input name="requestedARV" type="number" value={formValues.requestedARV} onChange={handleChange} style={styles.input} /></label><label style={styles.label}>Supported ARV<input name="supportedARV" type="number" value={formValues.supportedARV} onChange={handleChange} style={styles.input} /></label></div>
                <div style={styles.fieldRow}><label style={styles.label}>Appraisal Value<input name="appraisalValue" type="number" value={formValues.appraisalValue} onChange={handleChange} style={styles.input} /></label><label style={styles.label}>Loan Amount<input name="loanAmount" type="number" value={formValues.loanAmount} onChange={handleChange} style={styles.input} /></label></div>
                <div style={styles.fieldRow}><label style={styles.label}>Lender Name<input name="lenderName" value={formValues.lenderName} onChange={handleChange} style={styles.input} /></label><label style={styles.label}>Appraiser Name<input name="appraiserName" value={formValues.appraiserName} onChange={handleChange} style={styles.input} /></label></div>
                <div style={styles.fieldRow}><label style={styles.label}>Appraisal Company<input name="appraisalCompany" value={formValues.appraisalCompany} onChange={handleChange} style={styles.input} /></label><label style={styles.label}>ARV Method<select name="ARVMethod" value={formValues.ARVMethod} onChange={handleChange} style={styles.input}>{arVMethodOptions.map((option) => <option key={option} value={option}>{option}</option>)}</select></label></div>
                <div style={styles.fieldRow}><label style={styles.label}>Confidence Level<select name="confidenceLevel" value={formValues.confidenceLevel} onChange={handleChange} style={styles.input}>{confidenceLevelOptions.map((option) => <option key={option} value={option}>{option}</option>)}</select></label><label style={styles.label}>Favorite<input type="checkbox" name="favorite" checked={formValues.favorite} onChange={handleChange} style={styles.checkbox} /></label></div>
              </FieldGroup>

              <FieldGroup title="Narrative & Links">
                <label style={styles.label}>Property Summary<textarea name="propertySummary" value={formValues.propertySummary} onChange={handleChange} style={{ ...styles.input, minHeight: "80px" }} /></label>
                <label style={styles.label}>Renovation Summary<textarea name="renovationSummary" value={formValues.renovationSummary} onChange={handleChange} style={{ ...styles.input, minHeight: "80px" }} /></label>
                <label style={styles.label}>Scope Summary<textarea name="scopeSummary" value={formValues.scopeSummary} onChange={handleChange} style={{ ...styles.input, minHeight: "80px" }} /></label>
                <label style={styles.label}>Value Add Summary<textarea name="valueAddSummary" value={formValues.valueAddSummary} onChange={handleChange} style={{ ...styles.input, minHeight: "80px" }} /></label>
                <label style={styles.label}>Comp Selection Summary<textarea name="compSelectionSummary" value={formValues.compSelectionSummary} onChange={handleChange} style={{ ...styles.input, minHeight: "80px" }} /></label>
                <div style={styles.fieldRow}><label style={styles.label}>Map URL<input name="mapUrl" value={formValues.mapUrl} onChange={handleChange} style={styles.input} /></label><label style={styles.label}>Property Source URL<input name="propertySourceUrl" value={formValues.propertySourceUrl} onChange={handleChange} style={styles.input} /></label></div>
                <div style={styles.fieldRow}><label style={styles.label}>Permit URL<input name="permitUrl" value={formValues.permitUrl} onChange={handleChange} style={styles.input} /></label><label style={styles.label}>Tax Record URL<input name="taxRecordUrl" value={formValues.taxRecordUrl} onChange={handleChange} style={styles.input} /></label></div>
                <div style={styles.fieldRow}><label style={styles.label}>Appraisal Report URL<input name="appraisalReportUrl" value={formValues.appraisalReportUrl} onChange={handleChange} style={styles.input} /></label><label style={styles.label}>Cover Photo URL<input name="coverPhotoUrl" value={formValues.coverPhotoUrl} onChange={handleChange} style={styles.input} /></label></div>
                <div style={styles.fieldRow}><label style={styles.label}>Appraisal Order Date<input name="appraisalOrderDate" type="date" value={formValues.appraisalOrderDate} onChange={handleChange} style={styles.input} /></label><label style={styles.label}>Appraisal Due Date<input name="appraisalDueDate" type="date" value={formValues.appraisalDueDate} onChange={handleChange} style={styles.input} /></label></div>
                <div style={styles.fieldRow}><label style={styles.label}>Appraisal Inspection Date<input name="appraisalInspectionDate" type="date" value={formValues.appraisalInspectionDate} onChange={handleChange} style={styles.input} /></label><label style={styles.label}>Appraisal Completed Date<input name="appraisalCompletedDate" type="date" value={formValues.appraisalCompletedDate} onChange={handleChange} style={styles.input} /></label></div>
              </FieldGroup>

              <div style={styles.formActions}><button type="submit" style={styles.primaryButton}>{editingId ? "SAVE CHANGES" : "CREATE PACKET"}</button><button type="button" style={styles.secondaryButton} onClick={resetForm}>RESET</button></div>
            </form>
          </div>

          <div style={styles.panel}>
            <div style={styles.panelHeader}><h2 style={styles.panelTitle}>IMPORT & FILTER</h2><button type="button" style={styles.secondaryButton} onClick={exportSummary}>EXPORT</button></div>
            <div style={styles.filterRow}><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} style={styles.input}><option value="All">All Status</option>{packetStatusOptions.map((option) => <option key={option} value={option}>{option}</option>)}</select><select value={propertyTypeFilter} onChange={(event) => setPropertyTypeFilter(event.target.value)} style={styles.input}><option value="All">All Property Type</option>{propertyTypeOptions.map((option) => <option key={option} value={option}>{option}</option>)}</select></div>
            <div style={styles.filterRow}><select value={strategyFilter} onChange={(event) => setStrategyFilter(event.target.value)} style={styles.input}><option value="All">All Strategy</option>{strategyOptions.map((option) => <option key={option} value={option}>{option}</option>)}</select><select value={stateFilter} onChange={(event) => setStateFilter(event.target.value)} style={styles.input}><option value="All">All State</option>{Array.from(new Set(packetsWithMetrics.map((packet) => packet.state).filter(Boolean))).map((value) => <option key={value} value={value}>{value}</option>)}</select></div>
            <div style={styles.filterRow}><input value={cityFilter} onChange={(event) => setCityFilter(event.target.value)} placeholder="City" style={styles.input} /><input value={zipFilter} onChange={(event) => setZipFilter(event.target.value)} placeholder="ZIP" style={styles.input} /></div>
            <div style={styles.filterRow}><select value={lenderFilter} onChange={(event) => setLenderFilter(event.target.value)} style={styles.input}><option value="All">All Lenders</option>{Array.from(new Set(packetsWithMetrics.map((packet) => packet.lenderName).filter(Boolean))).map((value) => <option key={value} value={value}>{value}</option>)}</select><select value={appraiserFilter} onChange={(event) => setAppraiserFilter(event.target.value)} style={styles.input}><option value="All">All Appraisers</option>{Array.from(new Set(packetsWithMetrics.map((packet) => packet.appraiserName).filter(Boolean))).map((value) => <option key={value} value={value}>{value}</option>)}</select></div>
            <div style={styles.filterRow}><select value={confidenceFilter} onChange={(event) => setConfidenceFilter(event.target.value)} style={styles.input}><option value="All">All Confidence</option>{confidenceLevelOptions.map((option) => <option key={option} value={option}>{option}</option>)}</select><select value={arvMethodFilter} onChange={(event) => setArvMethodFilter(event.target.value)} style={styles.input}><option value="All">All ARV Methods</option>{arVMethodOptions.map((option) => <option key={option} value={option}>{option}</option>)}</select></div>
            <div style={styles.filterRow}><select value={favoriteFilter} onChange={(event) => setFavoriteFilter(event.target.value)} style={styles.input}><option value="All">All Packets</option><option value="Favorites Only">Favorites Only</option><option value="Non-Favorites">Non-Favorites</option></select><select value={missingCompsFilter} onChange={(event) => setMissingCompsFilter(event.target.value)} style={styles.input}><option value="All">Any Comp Count</option><option value="Yes">Missing/Low Comps</option><option value="No">Enough Comps</option></select></div>
            <div style={styles.filterRow}><select value={missingPhotosFilter} onChange={(event) => setMissingPhotosFilter(event.target.value)} style={styles.input}><option value="All">Any Photos</option><option value="Yes">Missing Photos</option><option value="No">Has Photos</option></select><select value={pastDueFilter} onChange={(event) => setPastDueFilter(event.target.value)} style={styles.input}><option value="All">Any Due Date</option><option value="Yes">Past Due</option><option value="No">On Track</option></select></div>
            <div style={styles.filterRow}><input value={minCompletenessFilter} onChange={(event) => setMinCompletenessFilter(event.target.value)} placeholder="Min completeness" style={styles.input} /><input value={maxVarianceFilter} onChange={(event) => setMaxVarianceFilter(event.target.value)} placeholder="Max ARV variance" style={styles.input} /></div>
            <div style={styles.filterRow}><input value={maxLoanToArvFilter} onChange={(event) => setMaxLoanToArvFilter(event.target.value)} placeholder="Max loan-to-ARV" style={styles.input} /><select value={sortBy} onChange={(event) => setSortBy(event.target.value)} style={styles.input}>{sortOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
            <div style={styles.filterRow}><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search packet name, property, address, city, ZIP, parcel, lender, appraiser, borrower" style={styles.input} /></div>

            <div style={styles.panelHeader}><h2 style={styles.panelTitle}>PROPERTY & DEAL RELATIONSHIPS</h2></div>
            <div style={styles.fieldRow}><label style={styles.label}>Import Property<select value={formValues.propertyId} onChange={(event) => { setFormValues((current) => ({ ...current, propertyId: event.target.value })); importProperty(event.target.value); }} style={styles.input}><option value="">Select</option>{properties.map((property) => <option key={property.id} value={property.id}>{property.propertyName || property.address || property.id}</option>)}</select></label><label style={styles.label}>Import Saved Deal<select value={formValues.propertyId} onChange={(event) => { setFormValues((current) => ({ ...current, propertyId: event.target.value })); importDeal(event.target.value); }} style={styles.input}><option value="">Select</option>{deals.map((deal) => <option key={deal.id} value={deal.id}>{deal.propertyAddress || deal.address || deal.id}</option>)}</select></label></div>
            <div style={styles.panelHeader}><h2 style={styles.panelTitle}>COMPARABLE SALES</h2><button type="button" style={styles.secondaryButton} onClick={() => setMessage({ type: "info", text: "Select comps to include from the list below." })}>SELECT</button></div>
            <div style={styles.listBox}>{comps.map((comp) => <div key={comp.id} style={styles.listItem}><label><input type="checkbox" checked={selectedCompIds.includes(comp.id)} onChange={() => toggleCompSelection(comp.id)} /> {comp.compAddress || comp.address || comp.id}</label><button type="button" style={styles.linkButton} onClick={() => addCompToPacket(comp)}>Add</button></div>)}</div>
            <div style={styles.panelHeader}><h2 style={styles.panelTitle}>ATTACHED COMPS</h2></div>
            <div style={styles.listBox}>{(formValues.comps || []).map((comp) => <div key={comp.id} style={styles.listItem}><span>{comp.address || comp.compAddress || comp.id}</span><button type="button" style={styles.linkButton} onClick={() => removeCompFromPacket(comp.id)}>Remove</button></div>)}</div>
          </div>
        </section>

        <section style={styles.panel} className="no-print">
          <div style={styles.panelHeader}><h2 style={styles.panelTitle}>PACKET RECORDS</h2><div style={styles.topActions}><button type="button" style={styles.secondaryButton} onClick={exportCompTable}>EXPORT COMPS</button><button type="button" style={styles.secondaryButton} onClick={exportWarnings}>EXPORT WARNINGS</button><button type="button" style={styles.secondaryButton} onClick={openPrintView}>PRINT PACKET</button></div></div>
          {loading ? <div style={styles.emptyState}>Loading packets…</div> : visiblePackets.length === 0 ? <div style={styles.emptyState}>No appraisal packets available<button type="button" style={styles.primaryButton} onClick={() => setMessage({ type: "info", text: "Use the form to create a packet." })}>CREATE PACKET</button></div> : (
            <div style={styles.tableWrap}><table style={styles.table}><thead><tr><th style={styles.th}>★</th><th style={styles.th}>Packet</th><th style={styles.th}>Property</th><th style={styles.th}>Address</th><th style={styles.th}>Status</th><th style={styles.th}>Requested ARV</th><th style={styles.th}>Supported ARV</th><th style={styles.th}>Appraisal Value</th><th style={styles.th}>ARV Variance</th><th style={styles.th}>Loan-to-ARV</th><th style={styles.th}>Comps</th><th style={styles.th}>Complete</th><th style={styles.th}>Due</th><th style={styles.th}>Warnings</th><th style={styles.th}>Actions</th></tr></thead><tbody>{visiblePackets.map((packet) => (
              <tr key={packet.id} style={styles.tr}>
                <td style={styles.td}><button type="button" style={styles.iconButton} onClick={() => toggleFavorite(packet)}>{packet.favorite ? "★" : "☆"}</button></td>
                <td style={styles.td}>{packet.packetName}</td>
                <td style={styles.td}>{packet.propertyName}</td>
                <td style={styles.td}>{packet.address}</td>
                <td style={styles.td}>{packet.packetStatus}</td>
                <td style={styles.td}>{formatCurrency(packet.requestedARV)}</td>
                <td style={styles.td}>{formatCurrency(packet.supportedARV)}</td>
                <td style={styles.td}>{formatCurrency(packet.appraisalValue)}</td>
                <td style={styles.td}>{formatCurrency(packet.arvVariance)}</td>
                <td style={styles.td}>{packet.loanToArv === "" ? "Insufficient Data" : `${Number(packet.loanToArv).toFixed(1)}%`}</td>
                <td style={styles.td}>{packet.compRecords.filter((comp) => comp.included).length}</td>
                <td style={styles.td}>{packet.completenessScore}%</td>
                <td style={styles.td}>{formatDate(packet.appraisalDueDate)}</td>
                <td style={styles.td}>{packet.warnings.length}</td>
                <td style={styles.td}><div style={styles.actionRow}><button type="button" style={styles.linkButton} onClick={() => setViewRecord(packet)}>View</button><button type="button" style={styles.linkButton} onClick={() => editPacket(packet)}>Edit</button><button type="button" style={styles.linkButton} onClick={() => duplicatePacket(packet)}>Duplicate</button><button type="button" style={styles.linkButton} onClick={() => deletePacket(packet.id)}>Delete</button><button type="button" style={styles.linkButton} onClick={() => toggleComparison(packet.id)}>{comparisonIds.includes(packet.id) ? "Selected" : "Compare"}</button></div></td>
              </tr>))}</tbody></table></div>)}</section>

        {viewRecord ? <section style={styles.panel}><div style={styles.panelHeader}><h2 style={styles.panelTitle}>FULL PACKET VIEW</h2><button type="button" style={styles.secondaryButton} onClick={() => setViewRecord(null)}>CLOSE</button></div><div style={styles.recordGrid}>{Object.entries(viewRecord).map(([key, value]) => <div key={key} style={styles.recordField}><strong>{key}</strong><div>{Array.isArray(value) ? value.join(", ") : typeof value === "boolean" ? String(value) : value || "—"}</div></div>)}</div>{activePacket ? <div style={{ marginTop: "12px", display: "flex", flexDirection: "column", gap: "10px" }}>
          <div style={styles.summaryCard}><div style={styles.summaryLabel}>ARV SUPPORT SUMMARY</div><div style={styles.summaryValue}>{activeAppraisalInsights?.explanation || "Insufficient Data"}</div></div>
          <div style={styles.recordGrid}><div style={styles.recordField}><strong>Indicated ARV Range</strong><div>{activeAppraisalInsights?.indicatedArvRange?.map((value) => formatCurrency(value)).join(" – ") || "Insufficient Data"}</div></div><div style={styles.recordField}><strong>Weighted ARV</strong><div>{formatCurrency(activeAppraisalInsights?.weightedArv)}</div></div><div style={styles.recordField}><strong>Confidence</strong><div>{activeAppraisalInsights?.confidenceLevel || "Insufficient Data"}</div></div></div>
          <div style={{ overflowX: "auto" }}><table style={styles.table}><thead><tr><th style={styles.th}>Comp</th><th style={styles.th}>Sale Price</th><th style={styles.th}>Adj. Value</th><th style={styles.th}>Weight</th><th style={styles.th}>Distance</th><th style={styles.th}>Notes</th></tr></thead><tbody>{activeCompRecords.map((comp) => <tr key={comp.id} style={styles.tr}><td style={styles.td}>{comp.address || "Insufficient Data"}</td><td style={styles.td}>{formatCurrency(comp.rawSalePrice || comp.salePrice)}</td><td style={styles.td}>{formatCurrency(comp.adjustedSalePrice || comp.rawSalePrice || comp.salePrice)}</td><td style={styles.td}>{comp.compWeight || 1}</td><td style={styles.td}>{comp.distanceMiles ? `${comp.distanceMiles} mi` : "Insufficient Data"}</td><td style={styles.td}>{comp.notes || comp.adjustmentSummary || "Insufficient Data"}</td></tr>)}</tbody></table></div>
        </div> : null}</section> : null}

        {comparisonIds.length > 0 ? <section style={styles.panel}><div style={styles.panelHeader}><h2 style={styles.panelTitle}>COMPARISON</h2></div><div style={styles.comparisonGrid}>{visiblePackets.filter((packet) => comparisonIds.includes(packet.id)).map((packet) => <div key={packet.id} style={styles.comparisonCard}><h3 style={styles.cardTitle}>{packet.packetName}</h3><div>Purchase Price: {formatCurrency(packet.purchasePrice)}</div><div>Rehab Budget: {formatCurrency(packet.rehabBudget)}</div><div>Total Project Cost: {formatCurrency(packet.totalProjectCost)}</div><div>Requested ARV: {formatCurrency(packet.requestedARV)}</div><div>Supported ARV: {formatCurrency(packet.supportedARV)}</div><div>Appraisal Value: {formatCurrency(packet.appraisalValue)}</div><div>ARV Variance: {formatCurrency(packet.arvVariance)}</div><div>Loan-to-ARV: {packet.loanToArv === "" ? "Insufficient Data" : `${Number(packet.loanToArv).toFixed(1)}%`}</div><div>Included Comps: {packet.compRecords.filter((comp) => comp.included).length}</div><div>Completeness: {packet.completenessScore}%</div><div>Confidence: {packet.confidenceLevel}</div><div>Status: {packet.packetStatus}</div></div>)}</div></section> : null}

        {printView ? <section style={styles.printView} className="print-only"><div style={{ ...styles.panel, background: "#fff", color: "#000", border: "1px solid #b69400", pageBreakInside: "avoid" }}><div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}><div><h2 style={{ margin: 0, color: "#000" }}>APPRAISER PACKET</h2><div style={{ fontSize: "12px", color: "#555" }}>{activePacket?.packetName || "Royal Star Packet"}</div></div><div style={{ fontSize: "12px", color: "#555" }}>{activePacket?.address || "Insufficient Data"}</div></div>{activePacket ? <div style={{ display: "grid", gap: "10px" }}><div style={{ border: "1px solid #b69400", padding: "10px" }}><strong>Subject</strong><div>{activePacket.address || "Insufficient Data"}</div><div>{[activePacket.city, activePacket.state, activePacket.zipCode].filter(Boolean).join(", ")}</div></div><div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "8px" }}><div style={{ border: "1px solid #b69400", padding: "8px" }}><strong>Indicated ARV</strong><div>{formatCurrency(activePacket.supportedARV)}</div></div><div style={{ border: "1px solid #b69400", padding: "8px" }}><strong>Confidence</strong><div>{activePacket.confidenceLevel || "Insufficient Data"}</div></div><div style={{ border: "1px solid #b69400", padding: "8px" }}><strong>Included Comps</strong><div>{activeCompRecords.length}</div></div></div><div style={{ overflowX: "auto" }}><table style={{ width: "100%", borderCollapse: "collapse", fontSize: "11px" }}><thead><tr><th style={{ textAlign: "left", borderBottom: "1px solid #b69400", padding: "6px" }}>Comp</th><th style={{ textAlign: "left", borderBottom: "1px solid #b69400", padding: "6px" }}>Sale Price</th><th style={{ textAlign: "left", borderBottom: "1px solid #b69400", padding: "6px" }}>Adj. Price</th><th style={{ textAlign: "left", borderBottom: "1px solid #b69400", padding: "6px" }}>Weight</th><th style={{ textAlign: "left", borderBottom: "1px solid #b69400", padding: "6px" }}>Notes</th></tr></thead><tbody>{activeCompRecords.map((comp) => <tr key={comp.id}><td style={{ padding: "6px", borderBottom: "1px solid #eee" }}>{comp.address || "Insufficient Data"}</td><td style={{ padding: "6px", borderBottom: "1px solid #eee" }}>{formatCurrency(comp.rawSalePrice || comp.salePrice)}</td><td style={{ padding: "6px", borderBottom: "1px solid #eee" }}>{formatCurrency(comp.adjustedSalePrice || comp.rawSalePrice || comp.salePrice)}</td><td style={{ padding: "6px", borderBottom: "1px solid #eee" }}>{comp.compWeight || 1}</td><td style={{ padding: "6px", borderBottom: "1px solid #eee" }}>{comp.notes || comp.adjustmentSummary || "Insufficient Data"}</td></tr>)}</tbody></table></div><div style={{ border: "1px solid #b69400", padding: "8px" }}><strong>Explanation</strong><div>{activeAppraisalInsights?.explanation || "Insufficient Data"}</div></div></div> : <div>No packet selected.</div>}</div></section> : null}
      </main>
    </div>
  );
}

function FieldGroup({ title, children }) {
  return <fieldset style={styles.fieldset}><legend style={styles.legend}>{title}</legend>{children}</fieldset>;
}

function SummaryCard({ label, value }) {
  return <div style={styles.summaryCard}><div style={styles.summaryLabel}>{label}</div><div style={styles.summaryValue}>{value}</div></div>;
}

const GOLD = "#f2c500";
const BLACK = "#050505";
const BORDER = "#c89f00";

const styles = {
  page: { minHeight: "100vh", display: "flex", backgroundColor: BLACK, color: GOLD, fontFamily: "Arial, Helvetica, sans-serif" },
  sidebar: { flex: "0 0 180px", padding: "18px 12px", borderRight: `1px solid ${BORDER}` },
  logoArea: { height: "110px", display: "flex", alignItems: "center", justifyContent: "center" },
  logo: { width: "130px", height: "100px", objectFit: "contain", backgroundColor: "#fff" },
  nav: { display: "flex", flexDirection: "column", gap: "4px" },
  navButton: { background: `linear-gradient(90deg, ${GOLD} 0%, #eab90c 100%)`, color: BLACK, border: `1px solid ${BORDER}`, padding: "8px 10px", textAlign: "left", cursor: "pointer", fontWeight: 700, fontSize: "10px" },
  navIcon: { marginRight: "8px" },
  navTab: { display: "inline-block", width: "8px", height: "8px", backgroundColor: BLACK, marginLeft: "8px" },
  main: { flex: 1, padding: "18px", display: "flex", flexDirection: "column", gap: "12px" },
  topBar: { display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: `1px solid ${BORDER}`, paddingBottom: "10px" },
  eyebrow: { fontSize: "10px", letterSpacing: "2px", color: "#f7d339" },
  pageTitle: { margin: "4px 0 0", fontSize: "24px", textTransform: "uppercase" },
  topActions: { display: "flex", gap: "8px" },
  primaryButton: { background: `linear-gradient(90deg, ${GOLD} 0%, #eab90c 100%)`, color: BLACK, border: `1px solid ${BORDER}`, padding: "8px 12px", cursor: "pointer", fontWeight: 700 },
  secondaryButton: { background: BLACK, color: GOLD, border: `1px solid ${BORDER}`, padding: "8px 12px", cursor: "pointer", fontWeight: 700 },
  successBanner: { background: "#15341b", color: "#d4f7d8", padding: "10px", border: "1px solid #2d7a3a" },
  errorBanner: { background: "#3f1515", color: "#ffd6d6", padding: "10px", border: "1px solid #9c2b2b" },
  summaryGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: "8px" },
  insightPanel: {
    border: `1px solid ${BORDER}`,
    backgroundColor: "#121212",
    padding: "12px 14px",
    marginBottom: "12px",
  },
  insightTitle: {
    color: GOLD,
    fontSize: "10px",
    letterSpacing: "0.2em",
    marginBottom: "6px",
  },
  insightBody: {
    color: "#f4f3ed",
    fontSize: "13px",
    marginBottom: "6px",
  },
  insightMeta: {
    color: GOLD,
    fontSize: "12px",
    marginBottom: "8px",
  },
  insightList: {
    margin: 0,
    paddingLeft: "18px",
    color: "#d8d0ba",
    fontSize: "12px",
    display: "grid",
    gap: "4px",
  },
  summaryCard: { border: `1px solid ${BORDER}`, padding: "10px", background: "#101010" },
  summaryLabel: { fontSize: "10px", letterSpacing: "1px", textTransform: "uppercase", color: "#f7d339" },
  summaryValue: { marginTop: "6px", fontSize: "14px", fontWeight: 700 },
  contentGrid: { display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: "12px" },
  panel: { border: `1px solid ${BORDER}`, padding: "12px", background: "#101010" },
  panelHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" },
  panelTitle: { margin: 0, fontSize: "16px", textTransform: "uppercase" },
  form: { display: "flex", flexDirection: "column", gap: "8px" },
  fieldset: { border: `1px solid ${BORDER}`, padding: "10px", margin: 0 },
  legend: { padding: "0 6px", fontSize: "12px", letterSpacing: "1px", textTransform: "uppercase" },
  fieldRow: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", marginBottom: "8px" },
  label: { display: "flex", flexDirection: "column", gap: "4px", fontSize: "11px", textTransform: "uppercase", color: "#f7d339" },
  input: { background: BLACK, border: `1px solid ${BORDER}`, color: GOLD, padding: "8px", fontSize: "12px" },
  checkbox: { width: "16px", height: "16px", marginTop: "4px" },
  formActions: { display: "flex", gap: "8px", marginTop: "8px" },
  filterRow: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", marginBottom: "8px" },
  listBox: { display: "flex", flexDirection: "column", gap: "6px", maxHeight: "220px", overflowY: "auto" },
  listItem: { display: "flex", justifyContent: "space-between", alignItems: "center", border: `1px solid ${BORDER}`, padding: "8px", background: "#0f0f0f" },
  emptyState: { border: `1px dashed ${BORDER}`, padding: "20px", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: "8px" },
  tableWrap: { overflowX: "auto" },
  table: { width: "100%", borderCollapse: "collapse", fontSize: "11px" },
  th: { textAlign: "left", padding: "8px", borderBottom: `1px solid ${BORDER}`, color: "#f7d339", textTransform: "uppercase" },
  td: { padding: "8px", borderBottom: `1px solid ${BORDER}` },
  tr: { backgroundColor: "#0f0f0f" },
  actionRow: { display: "flex", gap: "4px", flexWrap: "wrap" },
  linkButton: { background: "transparent", color: GOLD, border: "none", cursor: "pointer", padding: 0, textDecoration: "underline" },
  iconButton: { background: "transparent", color: GOLD, border: "none", cursor: "pointer", fontSize: "14px" },
  recordGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "8px" },
  recordField: { border: `1px solid ${BORDER}`, padding: "8px", background: "#0f0f0f", fontSize: "11px" },
  comparisonGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "10px" },
  comparisonCard: { border: `1px solid ${BORDER}`, padding: "10px", background: "#0f0f0f", fontSize: "12px", display: "flex", flexDirection: "column", gap: "4px" },
  cardTitle: { margin: "0 0 6px", fontSize: "14px", textTransform: "uppercase" },
  printView: { display: "none", padding: "20px", background: "#fff", color: "#000" },
};
