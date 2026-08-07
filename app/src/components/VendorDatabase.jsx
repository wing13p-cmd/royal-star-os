import { useEffect, useMemo, useState } from "react";
import { buildApiUrl } from "../utils/apiClient.js";
import logo from "../assets/royal-star-logo.png";
import { buildImportPreview, normalizeRecordForStorage } from "./enterpriseDataIntegration.js";

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
];

const vendorTypeOptions = ["Retail Supplier", "Wholesale Supplier", "Manufacturer", "Distributor", "Rental Company", "Service Provider", "Utility", "Disposal Company", "Delivery Company", "Other"];
const primaryCategoryOptions = ["Bathroom", "Kitchen", "Flooring", "Roofing", "Windows", "Doors", "Electrical", "Plumbing", "HVAC", "Lumber", "Drywall", "Paint", "Concrete", "Landscaping", "Appliances", "Security", "Tools", "Equipment Rental", "Waste and Disposal", "General Materials", "Other"];
const approvalStatusOptions = ["Approved", "Preferred", "Conditional", "Under Review", "Not Approved"];
const activeStatusOptions = ["Active", "Inactive", "Suspended"];
const pricingTierOptions = ["Retail", "Contractor", "Pro", "Wholesale", "Negotiated", "Unknown"];
const paymentTermOptions = ["Due on Receipt", "Net 7", "Net 15", "Net 30", "Net 45", "Net 60", "Credit Card", "Cash", "Custom"];
const w9StatusOptions = ["On File", "Requested", "Missing", "Not Required"];
const favoriteOptions = ["All", "Favorites Only"];
const complianceStatusOptions = ["All", "Compliant", "Expiring Soon", "Missing Documents", "Expired", "Not Required"];
const sortOptions = [
  ["name", "Vendor Name"],
  ["highestScore", "Highest Overall Score"],
  ["lowestScore", "Lowest Overall Score"],
  ["highestSpend", "Highest Total Spend"],
  ["lowestPricing", "Lowest Pricing Score"],
  ["highestPricing", "Highest Pricing Score"],
  ["shortestLead", "Shortest Lead Time"],
  ["newest", "Newest"],
  ["oldest", "Oldest"],
  ["recentOrder", "Most Recent Order"],
];

const initialValues = {
  id: "",
  vendorName: "",
  vendorType: "Retail Supplier",
  primaryCategory: "General Materials",
  secondaryCategories: "",
  contactName: "",
  phone: "",
  email: "",
  website: "",
  address: "",
  city: "",
  state: "",
  zipCode: "",
  accountNumber: "",
  taxIdOrW9Status: "On File",
  paymentTerms: "Net 30",
  creditLimit: "",
  availableCredit: "",
  minimumOrder: "",
  deliveryAvailable: false,
  deliveryFee: "",
  deliveryArea: "",
  pickupAvailable: false,
  preferredVendor: false,
  approvalStatus: "Under Review",
  activeStatus: "Active",
  pricingTier: "Contractor",
  discountPercentage: "",
  materialDiscountNotes: "",
  returnPolicy: "",
  warrantyTerms: "",
  insuranceRequired: false,
  insuranceExpiration: "",
  licenseNumber: "",
  licenseExpiration: "",
  averageLeadTimeDays: "",
  averageDeliveryTimeDays: "",
  qualityScore: "",
  pricingScore: "",
  reliabilityScore: "",
  communicationScore: "",
  deliveryScore: "",
  serviceScore: "",
  overallScore: "",
  totalOrders: "",
  totalSpend: "",
  lastOrderDate: "",
  lastContactDate: "",
  sourceUrl: "",
  accountPortalUrl: "",
  favorite: false,
  notes: "",
  createdAt: "",
  updatedAt: "",
};

function createId(prefix = "vendor") {
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

function formatScore(value) {
  if (value === "" || value === null || value === undefined || !Number.isFinite(Number(value))) return "Insufficient Data";
  return Number(value).toFixed(1);
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

function normalizeVendorPayload(values) {
  return {
    id: getStringValue(values.id),
    vendorName: getStringValue(values.vendorName),
    vendorType: getStringValue(values.vendorType, "Retail Supplier"),
    primaryCategory: getStringValue(values.primaryCategory, "General Materials"),
    secondaryCategories: getStringValue(values.secondaryCategories),
    contactName: getStringValue(values.contactName),
    phone: getStringValue(values.phone),
    email: getStringValue(values.email),
    website: getStringValue(values.website),
    address: getStringValue(values.address),
    city: getStringValue(values.city),
    state: getStringValue(values.state),
    zipCode: getStringValue(values.zipCode),
    accountNumber: getStringValue(values.accountNumber),
    taxIdOrW9Status: getStringValue(values.taxIdOrW9Status, "On File"),
    paymentTerms: getStringValue(values.paymentTerms, "Net 30"),
    creditLimit: parseNumber(values.creditLimit),
    availableCredit: parseNumber(values.availableCredit),
    minimumOrder: parseNumber(values.minimumOrder),
    deliveryAvailable: Boolean(values.deliveryAvailable),
    deliveryFee: parseNumber(values.deliveryFee),
    deliveryArea: getStringValue(values.deliveryArea),
    pickupAvailable: Boolean(values.pickupAvailable),
    preferredVendor: Boolean(values.preferredVendor),
    approvalStatus: getStringValue(values.approvalStatus, "Under Review"),
    activeStatus: getStringValue(values.activeStatus, "Active"),
    pricingTier: getStringValue(values.pricingTier, "Contractor"),
    discountPercentage: parseNumber(values.discountPercentage),
    materialDiscountNotes: getStringValue(values.materialDiscountNotes),
    returnPolicy: getStringValue(values.returnPolicy),
    warrantyTerms: getStringValue(values.warrantyTerms),
    insuranceRequired: Boolean(values.insuranceRequired),
    insuranceExpiration: getStringValue(values.insuranceExpiration),
    licenseNumber: getStringValue(values.licenseNumber),
    licenseExpiration: getStringValue(values.licenseExpiration),
    averageLeadTimeDays: parseNumber(values.averageLeadTimeDays),
    averageDeliveryTimeDays: parseNumber(values.averageDeliveryTimeDays),
    qualityScore: parseNumber(values.qualityScore),
    pricingScore: parseNumber(values.pricingScore),
    reliabilityScore: parseNumber(values.reliabilityScore),
    communicationScore: parseNumber(values.communicationScore),
    deliveryScore: parseNumber(values.deliveryScore),
    serviceScore: parseNumber(values.serviceScore),
    overallScore: parseNumber(values.overallScore),
    totalOrders: parseNumber(values.totalOrders),
    totalSpend: parseNumber(values.totalSpend),
    lastOrderDate: getStringValue(values.lastOrderDate),
    lastContactDate: getStringValue(values.lastContactDate),
    sourceUrl: getStringValue(values.sourceUrl),
    accountPortalUrl: getStringValue(values.accountPortalUrl),
    favorite: Boolean(values.favorite),
    notes: getStringValue(values.notes),
    createdAt: getStringValue(values.createdAt),
    updatedAt: getStringValue(values.updatedAt),
  };
}

function validateVendor(values) {
  const errors = [];
  if (!values.vendorName?.trim()) errors.push("Vendor name is required.");
  if (!values.vendorType?.trim()) errors.push("Vendor type is required.");
  if (!values.primaryCategory?.trim()) errors.push("Primary category is required.");
  if (!values.activeStatus?.trim()) errors.push("Active status is required.");
  if (!values.approvalStatus?.trim()) errors.push("Approval status is required.");

  const numericChecks = [
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

  numericChecks.forEach(([field, min, max]) => {
    if (values[field] === "" || values[field] === null || values[field] === undefined) return;
    const numericValue = Number(values[field]);
    if (!Number.isFinite(numericValue)) {
      errors.push(`${field} must be numeric.`);
      return;
    }
    if (min !== null && numericValue < min) errors.push(`${field} cannot be negative.`);
    if (max !== null && numericValue > max) errors.push(`${field} cannot exceed ${max}.`);
  });

  return errors;
}

function getVendorMetrics(vendor) {
  const scoreFields = [
    ["qualityScore", 0.2],
    ["pricingScore", 0.2],
    ["reliabilityScore", 0.2],
    ["communicationScore", 0.15],
    ["deliveryScore", 0.15],
    ["serviceScore", 0.1],
  ];

  const populated = scoreFields.filter(([field]) => vendor[field] !== "" && vendor[field] !== null && vendor[field] !== undefined);
  const totalWeight = populated.reduce((sum, [, weight]) => sum + weight, 0);
  const weightedScore = populated.reduce((sum, [field, weight]) => sum + Number(vendor[field]) * weight, 0) / (totalWeight || 1);
  const overallScore = totalWeight > 0 ? weightedScore : "";

  const creditLimit = Number(vendor.creditLimit || 0);
  const availableCredit = Number(vendor.availableCredit || 0);
  const totalSpend = Number(vendor.totalSpend || 0);
  const totalOrders = Number(vendor.totalOrders || 0);

  const creditUtilization = creditLimit > 0 ? (totalSpend / creditLimit) * 100 : "";
  const availableCreditPercentage = creditLimit > 0 ? (availableCredit / creditLimit) * 100 : "";
  const averageSpendPerOrder = totalOrders > 0 ? totalSpend / totalOrders : "";

  const now = new Date();
  let daysSinceLastOrder = "";
  if (vendor.lastOrderDate) {
    const diff = Math.max(0, Math.floor((now.getTime() - new Date(vendor.lastOrderDate).getTime()) / (1000 * 60 * 60 * 24)));
    daysSinceLastOrder = diff;
  }

  let daysSinceLastContact = "";
  if (vendor.lastContactDate) {
    const diff = Math.max(0, Math.floor((now.getTime() - new Date(vendor.lastContactDate).getTime()) / (1000 * 60 * 60 * 24)));
    daysSinceLastContact = diff;
  }

  const insuranceExpiration = vendor.insuranceExpiration ? new Date(vendor.insuranceExpiration) : null;
  const licenseExpiration = vendor.licenseExpiration ? new Date(vendor.licenseExpiration) : null;
  const expirationWindow = 30 * 24 * 60 * 60 * 1000;
  const isExpired = (date) => date && date.getTime() < now.getTime();
  const isExpiringSoon = (date) => date && date.getTime() < now.getTime() + expirationWindow;

  let complianceStatus = "Compliant";
  if (vendor.taxIdOrW9Status === "Missing" || vendor.taxIdOrW9Status === "Requested") complianceStatus = "Missing Documents";
  if (vendor.insuranceRequired && insuranceExpiration && isExpired(insuranceExpiration)) complianceStatus = "Expired";
  else if (vendor.insuranceRequired && insuranceExpiration && isExpiringSoon(insuranceExpiration)) complianceStatus = "Expiring Soon";
  else if (vendor.licenseExpiration && isExpired(licenseExpiration)) complianceStatus = "Expired";
  else if (vendor.licenseExpiration && isExpiringSoon(licenseExpiration)) complianceStatus = "Expiring Soon";
  else if (vendor.taxIdOrW9Status === "Missing") complianceStatus = "Missing Documents";
  else if (!vendor.insuranceRequired && !vendor.licenseNumber && !vendor.licenseExpiration) complianceStatus = "Not Required";

  const warnings = getWarnings(vendor, overallScore);
  let riskLevel = "Low";
  if (warnings.some((warning) => ["Insurance expired", "License expired", "W-9 missing", "Vendor suspended", "Vendor inactive"].includes(warning))) riskLevel = "Critical";
  else if (warnings.length >= 4 || vendor.activeStatus === "Suspended" || (overallScore !== "" && overallScore < 6)) riskLevel = "High";
  else if (warnings.length >= 2 || (overallScore !== "" && overallScore < 7)) riskLevel = "Moderate";

  return {
    overallScore,
    creditUtilization,
    availableCreditPercentage,
    averageSpendPerOrder,
    daysSinceLastOrder,
    daysSinceLastContact,
    complianceStatus,
    riskLevel,
    warnings,
  };
}

function getWarnings(vendor, computedOverallScore = "") {
  const warnings = [];
  const overallScore = computedOverallScore !== "" && computedOverallScore !== undefined ? computedOverallScore : (vendor.overallScore !== "" && vendor.overallScore !== null && vendor.overallScore !== undefined ? Number(vendor.overallScore) : "");
  if (vendor.insuranceExpiration && new Date(vendor.insuranceExpiration).getTime() < new Date().getTime()) warnings.push("Insurance expired");
  else if (vendor.insuranceExpiration && new Date(vendor.insuranceExpiration).getTime() < new Date().getTime() + 30 * 24 * 60 * 60 * 1000) warnings.push("Insurance expires within 30 days");
  if (vendor.licenseExpiration && new Date(vendor.licenseExpiration).getTime() < new Date().getTime()) warnings.push("License expired");
  else if (vendor.licenseExpiration && new Date(vendor.licenseExpiration).getTime() < new Date().getTime() + 30 * 24 * 60 * 60 * 1000) warnings.push("License expires within 30 days");
  if (vendor.taxIdOrW9Status === "Missing") warnings.push("W-9 missing");
  if (vendor.activeStatus === "Inactive") warnings.push("Vendor inactive");
  if (vendor.activeStatus === "Suspended") warnings.push("Vendor suspended");
  if (overallScore !== "" && overallScore < 6) warnings.push("Overall score below 6.0");
  if (vendor.reliabilityScore !== "" && Number(vendor.reliabilityScore) < 6) warnings.push("Reliability score below 6.0");
  if (vendor.pricingScore !== "" && Number(vendor.pricingScore) < 6) warnings.push("Pricing score below 6.0");
  if (vendor.communicationScore !== "" && Number(vendor.communicationScore) < 6) warnings.push("Communication score below 6.0");
  if (vendor.deliveryScore !== "" && Number(vendor.deliveryScore) < 6) warnings.push("Delivery score below 6.0");
  if (vendor.averageLeadTimeDays !== "" && Number(vendor.averageLeadTimeDays) > 30) warnings.push("Lead time above 30 days");
  if (!vendor.phone) warnings.push("Missing phone");
  if (!vendor.email) warnings.push("Missing email");
  if (!vendor.contactName) warnings.push("Missing contact name");
  if (!vendor.paymentTerms) warnings.push("Missing payment terms");
  if (!vendor.website) warnings.push("Missing website");
  if (!vendor.accountPortalUrl) warnings.push("Missing account portal");
  if (vendor.updatedAt) {
    const monthsOld = (new Date().getTime() - new Date(vendor.updatedAt).getTime()) / (1000 * 60 * 60 * 24 * 30);
    if (monthsOld > 3) warnings.push("Vendor record not updated within 90 days");
  }
  return warnings;
}

function getRecommendation(vendor) {
  const metrics = getVendorMetrics(vendor);
  const warnings = metrics.warnings;
  if (warnings.some((warning) => ["Insurance expired", "License expired", "Vendor suspended", "W-9 missing"].includes(warning))) return "Suspend";
  if (vendor.approvalStatus === "Preferred" && metrics.overallScore !== "" && metrics.overallScore >= 8 && metrics.complianceStatus === "Compliant") return "Preferred";
  if (vendor.approvalStatus === "Approved" || (metrics.overallScore !== "" && metrics.overallScore >= 7 && metrics.complianceStatus === "Compliant")) return "Approved";
  if (warnings.length > 0) return "Conditional";
  return "Review";
}

function getRecommendationExplanation(vendor) {
  const recommendation = getRecommendation(vendor);
  const metrics = getVendorMetrics(vendor);
  if (recommendation === "Preferred") return "The vendor is highly rated, compliant, and shows strong service and pricing characteristics.";
  if (recommendation === "Approved") return "The vendor meets core expectations and is operating within acceptable limits.";
  if (recommendation === "Conditional") return `The vendor is usable, but the following concerns need monitoring: ${metrics.warnings.slice(0, 3).join(", ")}.`;
  if (recommendation === "Suspend") return "The vendor has serious compliance or performance issues that require immediate attention.";
  return "The vendor has mixed signals and should be reviewed before additional commitments are made.";
}

export default function VendorDatabase({
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
  onOpenVendorDatabase,
}) {
  const [vendors, setVendors] = useState([]);
  const [products, setProducts] = useState([]);
  const [formValues, setFormValues] = useState(initialValues);
  const [selectedVendorId, setSelectedVendorId] = useState("");
  const [message, setMessage] = useState({ type: "", text: "" });
  const [searchText, setSearchText] = useState("");
  const [vendorTypeFilter, setVendorTypeFilter] = useState("All");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [approvalFilter, setApprovalFilter] = useState("All");
  const [activeFilter, setActiveFilter] = useState("All");
  const [pricingTierFilter, setPricingTierFilter] = useState("All");
  const [preferredFilter] = useState("All");
  const [favoriteFilter, setFavoriteFilter] = useState("All");
  const [deliveryFilter] = useState("All");
  const [pickupFilter] = useState("All");
  const [complianceFilter, setComplianceFilter] = useState("All");
  const [riskFilter] = useState("All");
  const [minScoreFilter] = useState("All");
  const [sortBy, setSortBy] = useState("name");
  const [comparisonIds, setComparisonIds] = useState([]);
  const [selectedDetailId, setSelectedDetailId] = useState("");
  const [connectionState, setConnectionState] = useState("Backend Connected");
  const [importText, setImportText] = useState("");
  const [importPreview, setImportPreview] = useState(null);
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    const loadVendors = async () => {
      try {
        const response = await fetch(buildApiUrl("/api/vendors"));
        if (!response.ok) throw new Error("Unable to load vendors");
        const payload = await response.json();
        setVendors(Array.isArray(payload) ? payload : []);
        setConnectionState("Backend Connected");
      } catch (error) {
        console.error("Unable to load vendors, using local fallback", error);
        setConnectionState("Local Fallback");
        if (typeof window !== "undefined") {
          try {
            const stored = JSON.parse(window.localStorage.getItem("royalStarVendors") || "[]") || [];
            setVendors(Array.isArray(stored) ? stored : []);
          } catch (localError) {
            console.error("Unable to read vendors from localStorage", localError);
            setVendors([]);
          }
        }
      }
    };

    const loadProducts = async () => {
      try {
        const response = await fetch(buildApiUrl("/api/products"));
        if (!response.ok) throw new Error("Unable to load products");
        const payload = await response.json();
        setProducts(Array.isArray(payload) ? payload : []);
      } catch (error) {
        console.error("Unable to load products", error);
        if (typeof window !== "undefined") {
          try {
            const stored = JSON.parse(window.localStorage.getItem("royalStarProducts") || "[]") || [];
            setProducts(Array.isArray(stored) ? stored : []);
          } catch (localError) {
            console.error("Unable to read products", localError);
          }
        }
      }
    };

    loadVendors();
    loadProducts();
  }, []);

  const normalizedVendors = useMemo(() => {
    return vendors.map((vendor) => {
      const metrics = getVendorMetrics(vendor);
      return {
        ...vendor,
        metrics,
        recommendation: getRecommendation(vendor),
        recommendationExplanation: getRecommendationExplanation(vendor),
        warnings: metrics.warnings,
      };
    });
  }, [vendors]);

  const filteredVendors = useMemo(() => {
    const search = searchText.trim().toLowerCase();
    let items = [...normalizedVendors];

    if (search) {
      items = items.filter((vendor) => {
        const haystack = [vendor.vendorName, vendor.contactName, vendor.primaryCategory, vendor.city, vendor.accountNumber, vendor.phone, vendor.email].filter(Boolean).join(" ").toLowerCase();
        return haystack.includes(search);
      });
    }
    if (vendorTypeFilter !== "All") items = items.filter((vendor) => vendor.vendorType === vendorTypeFilter);
    if (categoryFilter !== "All") items = items.filter((vendor) => vendor.primaryCategory === categoryFilter);
    if (approvalFilter !== "All") items = items.filter((vendor) => vendor.approvalStatus === approvalFilter);
    if (activeFilter !== "All") items = items.filter((vendor) => vendor.activeStatus === activeFilter);
    if (pricingTierFilter !== "All") items = items.filter((vendor) => vendor.pricingTier === pricingTierFilter);
    if (preferredFilter === "Yes") items = items.filter((vendor) => Boolean(vendor.preferredVendor));
    if (favoriteFilter === "Favorites Only") items = items.filter((vendor) => Boolean(vendor.favorite));
    if (deliveryFilter === "Yes") items = items.filter((vendor) => Boolean(vendor.deliveryAvailable));
    if (pickupFilter === "Yes") items = items.filter((vendor) => Boolean(vendor.pickupAvailable));
    if (complianceFilter !== "All") items = items.filter((vendor) => vendor.metrics.complianceStatus === complianceFilter);
    if (riskFilter !== "All") items = items.filter((vendor) => vendor.metrics.riskLevel === riskFilter);
    if (minScoreFilter !== "All") items = items.filter((vendor) => Number(vendor.metrics.overallScore || 0) >= Number(minScoreFilter));

    items.sort((left, right) => {
      switch (sortBy) {
        case "highestScore":
          return Number(right.metrics.overallScore || 0) - Number(left.metrics.overallScore || 0);
        case "lowestScore":
          return Number(left.metrics.overallScore || 0) - Number(right.metrics.overallScore || 0);
        case "highestSpend":
          return Number(right.totalSpend || 0) - Number(left.totalSpend || 0);
        case "lowestPricing":
          return Number(left.pricingScore || 99) - Number(right.pricingScore || 99);
        case "highestPricing":
          return Number(right.pricingScore || 0) - Number(left.pricingScore || 0);
        case "shortestLead":
          return Number(left.averageLeadTimeDays || 999) - Number(right.averageLeadTimeDays || 999);
        case "newest":
          return (right.createdAt || "").localeCompare(left.createdAt || "");
        case "oldest":
          return (left.createdAt || "").localeCompare(right.createdAt || "");
        case "recentOrder":
          return (right.lastOrderDate || "").localeCompare(left.lastOrderDate || "");
        default:
          return (left.vendorName || "").localeCompare(right.vendorName || "");
      }
    });

    return items;
  }, [approvalFilter, activeFilter, categoryFilter, complianceFilter, favoriteFilter, minScoreFilter, normalizedVendors, preferredFilter, pricingTierFilter, riskFilter, searchText, sortBy, vendorTypeFilter, deliveryFilter, pickupFilter]);

  const selectedVendor = useMemo(() => normalizedVendors.find((vendor) => vendor.id === selectedVendorId) || null, [normalizedVendors, selectedVendorId]);
  const detailVendor = useMemo(() => normalizedVendors.find((vendor) => vendor.id === selectedDetailId) || null, [normalizedVendors, selectedDetailId]);
  const comparisonItems = useMemo(() => normalizedVendors.filter((vendor) => comparisonIds.includes(vendor.id)), [comparisonIds, normalizedVendors]);

  const summaryStats = useMemo(() => {
    const total = normalizedVendors.length;
    const active = normalizedVendors.filter((vendor) => vendor.activeStatus === "Active").length;
    const preferred = normalizedVendors.filter((vendor) => vendor.approvalStatus === "Preferred").length;
    const approved = normalizedVendors.filter((vendor) => vendor.approvalStatus === "Approved" || vendor.approvalStatus === "Preferred").length;
    const underReview = normalizedVendors.filter((vendor) => vendor.approvalStatus === "Under Review").length;
    const suspended = normalizedVendors.filter((vendor) => vendor.activeStatus === "Suspended").length;
    const totalSpend = normalizedVendors.reduce((sum, vendor) => sum + Number(vendor.totalSpend || 0), 0);
    const scores = normalizedVendors.map((vendor) => Number(vendor.metrics.overallScore || 0)).filter((score) => score > 0);
    const averageScore = scores.length > 0 ? scores.reduce((sum, score) => sum + score, 0) / scores.length : 0;
    const highestRated = [...normalizedVendors].sort((left, right) => Number(right.metrics.overallScore || 0) - Number(left.metrics.overallScore || 0))[0] || null;
    const bestPricing = [...normalizedVendors].sort((left, right) => Number(right.pricingScore || 0) - Number(left.pricingScore || 0))[0] || null;
    const mostReliable = [...normalizedVendors].sort((left, right) => Number(right.reliabilityScore || 0) - Number(left.reliabilityScore || 0))[0] || null;
    const expiringInsurance = normalizedVendors.filter((vendor) => vendor.insuranceExpiration && new Date(vendor.insuranceExpiration).getTime() < new Date().getTime() + 30 * 24 * 60 * 60 * 1000).length;
    const expiringLicenses = normalizedVendors.filter((vendor) => vendor.licenseExpiration && new Date(vendor.licenseExpiration).getTime() < new Date().getTime() + 30 * 24 * 60 * 60 * 1000).length;
    const missingW9 = normalizedVendors.filter((vendor) => vendor.taxIdOrW9Status === "Missing").length;
    const favoriteCount = normalizedVendors.filter((vendor) => Boolean(vendor.favorite)).length;

    return {
      total,
      active,
      preferred,
      approved,
      underReview,
      suspended,
      totalSpend,
      averageScore,
      highestRated,
      bestPricing,
      mostReliable,
      expiringInsurance,
      expiringLicenses,
      missingW9,
      favoriteCount,
    };
  }, [normalizedVendors]);

  const vendorTypeOptionsList = useMemo(() => ["All", ...Array.from(new Set(normalizedVendors.map((vendor) => vendor.vendorType).filter(Boolean))).sort()], [normalizedVendors]);
  const categoryOptionsList = useMemo(() => ["All", ...Array.from(new Set(normalizedVendors.map((vendor) => vendor.primaryCategory).filter(Boolean))).sort()], [normalizedVendors]);
  const pricingTierOptionsList = useMemo(() => ["All", ...Array.from(new Set(normalizedVendors.map((vendor) => vendor.pricingTier).filter(Boolean))).sort()], [normalizedVendors]);

  const handleFieldChange = (event) => {
    const { name, value, type, checked } = event.target;
    setFormValues((prev) => ({ ...prev, [name]: type === "checkbox" ? checked : value }));
  };

  const handleSelectVendor = (vendor) => {
    setSelectedVendorId(vendor.id);
    setFormValues({ ...initialValues, ...vendor, favorite: Boolean(vendor.favorite) });
    setMessage({ type: "", text: "" });
  };

  const handleClearForm = () => {
    setSelectedVendorId("");
    setFormValues(initialValues);
    setMessage({ type: "", text: "" });
  };

  const persistVendor = async (payload, existingVendor = null) => {
    if (existingVendor) {
      try {
        const response = await fetch(buildApiUrl(`/api/vendors/${existingVendor.id}`), {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!response.ok) throw new Error("Unable to update vendor");
        return response.json();
      } catch (error) {
        console.error("Unable to update vendor via API, using local fallback", error);
        return { ...payload, id: existingVendor.id, createdAt: existingVendor.createdAt, updatedAt: new Date().toISOString() };
      }
    }

    try {
      const response = await fetch(buildApiUrl("/api/vendors"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error("Unable to create vendor");
      return response.json();
    } catch (error) {
      console.error("Unable to create vendor via API, using local fallback", error);
      return { ...payload, id: createId(), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const errors = validateVendor(formValues);
    if (errors.length > 0) {
      setMessage({ type: "error", text: errors[0] });
      return;
    }

    const existingVendor = vendors.find((vendor) => vendor.id === selectedVendorId);
    const likelyDuplicate = vendors.some((vendor) => {
      if (vendor.id === selectedVendorId) return false;
      const sameName = vendor.vendorName && formValues.vendorName && vendor.vendorName.toLowerCase() === formValues.vendorName.toLowerCase();
      const samePhone = vendor.phone && formValues.phone && vendor.phone === formValues.phone;
      const sameEmail = vendor.email && formValues.email && vendor.email.toLowerCase() === formValues.email.toLowerCase();
      const sameAccount = vendor.accountNumber && formValues.accountNumber && vendor.accountNumber === formValues.accountNumber;
      return sameName || samePhone || sameEmail || sameAccount;
    });

    if (likelyDuplicate && !window.confirm("This appears to be a likely duplicate. Create it anyway?")) {
      setMessage({ type: "info", text: "Duplicate warning acknowledged. No vendor saved." });
      return;
    }

    const normalizedPayload = normalizeVendorPayload({ ...formValues, overallScore: getVendorMetrics(formValues).overallScore });
    const savedVendor = await persistVendor(normalizedPayload, existingVendor);
    const nextVendors = existingVendor ? vendors.map((vendor) => (vendor.id === existingVendor.id ? { ...vendor, ...savedVendor, id: existingVendor.id } : vendor)) : [...vendors, savedVendor];
    setVendors(nextVendors);
    if (typeof window !== "undefined") {
      window.localStorage.setItem("royalStarVendors", JSON.stringify(nextVendors));
    }
    setSelectedVendorId(savedVendor.id);
    setFormValues({ ...initialValues, ...savedVendor, favorite: Boolean(savedVendor.favorite) });
    setMessage({ type: "success", text: existingVendor ? "Vendor updated successfully." : "Vendor added successfully." });
  };

  const handleDelete = async (vendorId) => {
    const target = vendors.find((vendor) => vendor.id === vendorId);
    if (!target) return;
    try {
      const response = await fetch(buildApiUrl(`/api/vendors/${vendorId}`), { method: "DELETE" });
      if (!response.ok) throw new Error("Unable to delete vendor");
    } catch (error) {
      console.error("Unable to delete vendor via API", error);
    }
    const nextVendors = vendors.filter((vendor) => vendor.id !== vendorId);
    setVendors(nextVendors);
    if (typeof window !== "undefined") {
      window.localStorage.setItem("royalStarVendors", JSON.stringify(nextVendors));
    }
    setSelectedVendorId("");
    setFormValues(initialValues);
    setMessage({ type: "success", text: "Vendor deleted successfully." });
  };

  const handleDuplicate = () => {
    if (!selectedVendor) return;
    const duplicateValues = {
      ...initialValues,
      ...selectedVendor,
      id: "",
      createdAt: "",
      updatedAt: "",
      favorite: Boolean(selectedVendor.favorite),
      vendorName: `${selectedVendor.vendorName} Copy`,
      accountNumber: selectedVendor.accountNumber || "",
    };
    setFormValues(duplicateValues);
    setSelectedVendorId("");
    setMessage({ type: "info", text: "Duplicate draft created. Review before saving." });
  };

  const handleToggleFavorite = (vendorId) => {
    const nextVendors = vendors.map((vendor) => (vendor.id === vendorId ? { ...vendor, favorite: !vendor.favorite } : vendor));
    setVendors(nextVendors);
    if (typeof window !== "undefined") {
      window.localStorage.setItem("royalStarVendors", JSON.stringify(nextVendors));
    }
  };

  const handleExport = () => {
    const rows = filteredVendors.map((vendor) => ({
      vendorName: vendor.vendorName,
      vendorType: vendor.vendorType,
      primaryCategory: vendor.primaryCategory,
      approvalStatus: vendor.approvalStatus,
      activeStatus: vendor.activeStatus,
      overallScore: vendor.metrics.overallScore,
      complianceStatus: vendor.metrics.complianceStatus,
      riskLevel: vendor.metrics.riskLevel,
      totalSpend: vendor.totalSpend,
    }));
    downloadFile("royal-star-vendors.json", JSON.stringify(rows, null, 2), "application/json");
    setMessage({ type: "success", text: "Vendor export prepared." });
  };

  const handleExportCsv = () => {
    const rows = filteredVendors.map((vendor) => ({
      vendorName: vendor.vendorName,
      vendorType: vendor.vendorType,
      primaryCategory: vendor.primaryCategory,
      approvalStatus: vendor.approvalStatus,
      activeStatus: vendor.activeStatus,
      overallScore: vendor.metrics.overallScore,
      complianceStatus: vendor.metrics.complianceStatus,
      riskLevel: vendor.metrics.riskLevel,
      totalSpend: vendor.totalSpend,
    }));
    if (!rows.length) {
      setMessage({ type: "error", text: "No vendors available to export." });
      return;
    }
    downloadCsv("royal-star-vendors.csv", rows);
    setMessage({ type: "success", text: "CSV export prepared." });
  };

  const handlePreviewImport = () => {
    if (!importText.trim()) {
      setMessage({ type: "error", text: "Paste CSV data before previewing an import." });
      return;
    }
    const preview = buildImportPreview(importText, "contractor", vendors);
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
    const nextVendors = [...vendors];

    for (const row of readyRows) {
      const normalized = normalizeRecordForStorage({ ...row.record, vendorName: row.record.vendorName || row.record.name || row.record.companyName || row.record.address }, "contractor");
      const payload = normalizeVendorPayload({
        ...initialValues,
        ...normalized,
        id: "",
        vendorName: normalized.name || normalized.vendorName || `Imported Vendor ${row.rowNumber}`,
        phone: normalized.phone || "",
        email: normalized.email || "",
        notes: normalized.notes || "",
        createdAt: "",
        updatedAt: "",
      });
      const savedVendor = await persistVendor(payload);
      nextVendors.push(savedVendor);
    }

    setVendors(nextVendors);
    if (typeof window !== "undefined") {
      window.localStorage.setItem("royalStarVendors", JSON.stringify(nextVendors));
    }
    setImportPreview(null);
    setImportText("");
    setImporting(false);
    setMessage({ type: "success", text: `${readyRows.length} imported vendors added to the database.` });
  };

  const toggleComparison = (vendorId) => {
    setComparisonIds((prev) => {
      if (prev.includes(vendorId)) return prev.filter((id) => id !== vendorId);
      if (prev.length >= 5) return prev;
      return [...prev, vendorId];
    });
  };

  const productRelationship = useMemo(() => {
    return products.reduce((acc, product) => {
      const vendorName = product.vendorName || product.vendor || "";
      if (!vendorName) return acc;
      const key = vendorName.toLowerCase();
      if (!acc[key]) acc[key] = { count: 0, totalValue: 0 };
      acc[key].count += 1;
      acc[key].totalValue += Number(product.currentValue || product.price || 0);
      return acc;
    }, {});
  }, [products]);

  return (
    <div style={styles.page}>
      <aside style={styles.sidebar}>
        <div style={styles.logoArea}><img src={logo} alt="Royal Star Properties" style={styles.logo} /></div>
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
            const isVendorDatabase = label === "VENDOR DATABASE";
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
                                    : isVendorDatabase
                                      ? onOpenVendorDatabase
                                      : undefined
                }
              >
                <span style={styles.navIcon}>{icon}</span>
                <span>{label}</span>
                <span style={styles.navTab} />
              </button>
            );
          })}
          <button type="button" style={styles.logout} onClick={onBack}><span style={styles.navIcon}>↪</span><span>COMMAND CENTER</span></button>
        </nav>
        <div style={styles.smallMark}>RS★</div>
      </aside>

      <main style={styles.main}>
        <section style={styles.topBar}>
          <button type="button" style={styles.backButton} onClick={onBack}>◀ COMMAND CENTER</button>
          <div style={styles.headingBlock}>
            <h1 style={styles.company}>ROYAL STAR PROPERTIES, LLC</h1>
            <p style={styles.subtitle}>VENDOR DATABASE / SUPPLIER MANAGEMENT</p>
          </div>
          <div style={styles.headerActions}>
            <button type="button" style={styles.secondaryButton} onClick={onOpenDealAnalyzer}>DEAL ANALYZER</button>
            <button type="button" style={styles.primaryButton} onClick={onOpenFlipAnalyzer}>FLIP ANALYZER</button>
            <button type="button" style={styles.primaryButton} onClick={onOpenBrrrrAnalyzer}>BRRRR ANALYZER</button>
          </div>
        </section>

        <section style={styles.summaryGrid}>
          <SummaryCard label="Total Vendors" value={summaryStats.total} />
          <SummaryCard label="Active Vendors" value={summaryStats.active} />
          <SummaryCard label="Preferred Vendors" value={summaryStats.preferred} />
          <SummaryCard label="Approved Vendors" value={summaryStats.approved} />
          <SummaryCard label="Under Review" value={summaryStats.underReview} />
          <SummaryCard label="Suspended Vendors" value={summaryStats.suspended} />
          <SummaryCard label="Total Vendor Spend" value={formatCurrency(summaryStats.totalSpend)} />
          <SummaryCard label="Average Overall Score" value={formatScore(summaryStats.averageScore)} />
          <SummaryCard label="Highest Rated Vendor" value={summaryStats.highestRated ? summaryStats.highestRated.vendorName : "—"} />
          <SummaryCard label="Best Pricing Vendor" value={summaryStats.bestPricing ? summaryStats.bestPricing.vendorName : "—"} />
          <SummaryCard label="Most Reliable Vendor" value={summaryStats.mostReliable ? summaryStats.mostReliable.vendorName : "—"} />
          <SummaryCard label="Expiring Insurance" value={summaryStats.expiringInsurance} />
          <SummaryCard label="Expiring Licenses" value={summaryStats.expiringLicenses} />
          <SummaryCard label="Missing W-9" value={summaryStats.missingW9} />
          <SummaryCard label="Favorite Vendors" value={summaryStats.favoriteCount} />
        </section>

        <section style={styles.toolbar}>
          <input type="text" value={searchText} onChange={(event) => setSearchText(event.target.value)} placeholder="Search vendor, contact, category, city, phone, email" style={styles.input} />
          <select value={vendorTypeFilter} onChange={(event) => setVendorTypeFilter(event.target.value)} style={styles.select}>{vendorTypeOptionsList.map((option) => <option key={option} value={option}>{option}</option>)}</select>
          <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)} style={styles.select}>{categoryOptionsList.map((option) => <option key={option} value={option}>{option}</option>)}</select>
          <select value={approvalFilter} onChange={(event) => setApprovalFilter(event.target.value)} style={styles.select}>{approvalStatusOptions.map((option) => <option key={option} value={option}>{option}</option>)}</select>
          <select value={activeFilter} onChange={(event) => setActiveFilter(event.target.value)} style={styles.select}>{activeStatusOptions.map((option) => <option key={option} value={option}>{option}</option>)}</select>
          <select value={pricingTierFilter} onChange={(event) => setPricingTierFilter(event.target.value)} style={styles.select}>{pricingTierOptionsList.map((option) => <option key={option} value={option}>{option}</option>)}</select>
          <select value={favoriteFilter} onChange={(event) => setFavoriteFilter(event.target.value)} style={styles.select}>{favoriteOptions.map((option) => <option key={option} value={option}>{option}</option>)}</select>
          <select value={complianceFilter} onChange={(event) => setComplianceFilter(event.target.value)} style={styles.select}>{complianceStatusOptions.map((option) => <option key={option} value={option}>{option}</option>)}</select>
          <select value={sortBy} onChange={(event) => setSortBy(event.target.value)} style={styles.select}>{sortOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
        </section>

        <div style={styles.contentGrid}>
          <section style={styles.panel}>
            <div style={styles.panelHeaderRow}>
              <h2 style={styles.panelTitle}>VENDOR FORM</h2>
              <div style={styles.inlineActions}>
                <button type="button" style={styles.secondaryButton} onClick={handleClearForm}>CLEAR</button>
                <button type="button" style={styles.primaryButton} onClick={handleDuplicate} disabled={!selectedVendor}>DUPLICATE</button>
              </div>
            </div>
            {message.text ? <div style={message.type === "error" ? styles.errorBox : styles.successBox}>{message.text}</div> : null}
            <form onSubmit={handleSubmit} style={styles.formGrid}>
              <label style={styles.field}><span>Vendor Name</span><input name="vendorName" value={formValues.vendorName} onChange={handleFieldChange} style={styles.input} /></label>
              <label style={styles.field}><span>Vendor Type</span><select name="vendorType" value={formValues.vendorType} onChange={handleFieldChange} style={styles.select}>{vendorTypeOptions.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>
              <label style={styles.field}><span>Primary Category</span><select name="primaryCategory" value={formValues.primaryCategory} onChange={handleFieldChange} style={styles.select}>{primaryCategoryOptions.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>
              <label style={styles.field}><span>Secondary Categories</span><input name="secondaryCategories" value={formValues.secondaryCategories} onChange={handleFieldChange} style={styles.input} /></label>
              <label style={styles.field}><span>Contact Name</span><input name="contactName" value={formValues.contactName} onChange={handleFieldChange} style={styles.input} /></label>
              <label style={styles.field}><span>Phone</span><input name="phone" value={formValues.phone} onChange={handleFieldChange} style={styles.input} /></label>
              <label style={styles.field}><span>Email</span><input type="email" name="email" value={formValues.email} onChange={handleFieldChange} style={styles.input} /></label>
              <label style={styles.field}><span>Website</span><input name="website" value={formValues.website} onChange={handleFieldChange} style={styles.input} /></label>
              <label style={styles.field}><span>Address</span><input name="address" value={formValues.address} onChange={handleFieldChange} style={styles.input} /></label>
              <label style={styles.field}><span>City</span><input name="city" value={formValues.city} onChange={handleFieldChange} style={styles.input} /></label>
              <label style={styles.field}><span>State</span><input name="state" value={formValues.state} onChange={handleFieldChange} style={styles.input} /></label>
              <label style={styles.field}><span>ZIP Code</span><input name="zipCode" value={formValues.zipCode} onChange={handleFieldChange} style={styles.input} /></label>
              <label style={styles.field}><span>Account Number</span><input name="accountNumber" value={formValues.accountNumber} onChange={handleFieldChange} style={styles.input} /></label>
              <label style={styles.field}><span>W-9 Status</span><select name="taxIdOrW9Status" value={formValues.taxIdOrW9Status} onChange={handleFieldChange} style={styles.select}>{w9StatusOptions.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>
              <label style={styles.field}><span>Payment Terms</span><select name="paymentTerms" value={formValues.paymentTerms} onChange={handleFieldChange} style={styles.select}>{paymentTermOptions.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>
              <label style={styles.field}><span>Credit Limit</span><input type="number" name="creditLimit" value={formValues.creditLimit} onChange={handleFieldChange} style={styles.input} /></label>
              <label style={styles.field}><span>Available Credit</span><input type="number" name="availableCredit" value={formValues.availableCredit} onChange={handleFieldChange} style={styles.input} /></label>
              <label style={styles.field}><span>Minimum Order</span><input type="number" name="minimumOrder" value={formValues.minimumOrder} onChange={handleFieldChange} style={styles.input} /></label>
              <label style={styles.field}><span>Delivery Available</span><input type="checkbox" name="deliveryAvailable" checked={Boolean(formValues.deliveryAvailable)} onChange={handleFieldChange} /></label>
              <label style={styles.field}><span>Delivery Fee</span><input type="number" name="deliveryFee" value={formValues.deliveryFee} onChange={handleFieldChange} style={styles.input} /></label>
              <label style={styles.field}><span>Delivery Area</span><input name="deliveryArea" value={formValues.deliveryArea} onChange={handleFieldChange} style={styles.input} /></label>
              <label style={styles.field}><span>Pickup Available</span><input type="checkbox" name="pickupAvailable" checked={Boolean(formValues.pickupAvailable)} onChange={handleFieldChange} /></label>
              <label style={styles.field}><span>Preferred Vendor</span><input type="checkbox" name="preferredVendor" checked={Boolean(formValues.preferredVendor)} onChange={handleFieldChange} /></label>
              <label style={styles.field}><span>Approval Status</span><select name="approvalStatus" value={formValues.approvalStatus} onChange={handleFieldChange} style={styles.select}>{approvalStatusOptions.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>
              <label style={styles.field}><span>Active Status</span><select name="activeStatus" value={formValues.activeStatus} onChange={handleFieldChange} style={styles.select}>{activeStatusOptions.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>
              <label style={styles.field}><span>Pricing Tier</span><select name="pricingTier" value={formValues.pricingTier} onChange={handleFieldChange} style={styles.select}>{pricingTierOptions.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>
              <label style={styles.field}><span>Discount Percentage</span><input type="number" name="discountPercentage" value={formValues.discountPercentage} onChange={handleFieldChange} style={styles.input} /></label>
              <label style={styles.field}><span>Material Discount Notes</span><input name="materialDiscountNotes" value={formValues.materialDiscountNotes} onChange={handleFieldChange} style={styles.input} /></label>
              <label style={styles.field}><span>Return Policy</span><input name="returnPolicy" value={formValues.returnPolicy} onChange={handleFieldChange} style={styles.input} /></label>
              <label style={styles.field}><span>Warranty Terms</span><input name="warrantyTerms" value={formValues.warrantyTerms} onChange={handleFieldChange} style={styles.input} /></label>
              <label style={styles.field}><span>Insurance Required</span><input type="checkbox" name="insuranceRequired" checked={Boolean(formValues.insuranceRequired)} onChange={handleFieldChange} /></label>
              <label style={styles.field}><span>Insurance Expiration</span><input type="date" name="insuranceExpiration" value={formValues.insuranceExpiration} onChange={handleFieldChange} style={styles.input} /></label>
              <label style={styles.field}><span>License Number</span><input name="licenseNumber" value={formValues.licenseNumber} onChange={handleFieldChange} style={styles.input} /></label>
              <label style={styles.field}><span>License Expiration</span><input type="date" name="licenseExpiration" value={formValues.licenseExpiration} onChange={handleFieldChange} style={styles.input} /></label>
              <label style={styles.field}><span>Average Lead Time (Days)</span><input type="number" name="averageLeadTimeDays" value={formValues.averageLeadTimeDays} onChange={handleFieldChange} style={styles.input} /></label>
              <label style={styles.field}><span>Average Delivery Time (Days)</span><input type="number" name="averageDeliveryTimeDays" value={formValues.averageDeliveryTimeDays} onChange={handleFieldChange} style={styles.input} /></label>
              <label style={styles.field}><span>Quality Score</span><input type="number" name="qualityScore" value={formValues.qualityScore} onChange={handleFieldChange} style={styles.input} /></label>
              <label style={styles.field}><span>Pricing Score</span><input type="number" name="pricingScore" value={formValues.pricingScore} onChange={handleFieldChange} style={styles.input} /></label>
              <label style={styles.field}><span>Reliability Score</span><input type="number" name="reliabilityScore" value={formValues.reliabilityScore} onChange={handleFieldChange} style={styles.input} /></label>
              <label style={styles.field}><span>Communication Score</span><input type="number" name="communicationScore" value={formValues.communicationScore} onChange={handleFieldChange} style={styles.input} /></label>
              <label style={styles.field}><span>Delivery Score</span><input type="number" name="deliveryScore" value={formValues.deliveryScore} onChange={handleFieldChange} style={styles.input} /></label>
              <label style={styles.field}><span>Service Score</span><input type="number" name="serviceScore" value={formValues.serviceScore} onChange={handleFieldChange} style={styles.input} /></label>
              <label style={styles.field}><span>Total Orders</span><input type="number" name="totalOrders" value={formValues.totalOrders} onChange={handleFieldChange} style={styles.input} /></label>
              <label style={styles.field}><span>Total Spend</span><input type="number" name="totalSpend" value={formValues.totalSpend} onChange={handleFieldChange} style={styles.input} /></label>
              <label style={styles.field}><span>Last Order Date</span><input type="date" name="lastOrderDate" value={formValues.lastOrderDate} onChange={handleFieldChange} style={styles.input} /></label>
              <label style={styles.field}><span>Last Contact Date</span><input type="date" name="lastContactDate" value={formValues.lastContactDate} onChange={handleFieldChange} style={styles.input} /></label>
              <label style={styles.field}><span>Source URL</span><input name="sourceUrl" value={formValues.sourceUrl} onChange={handleFieldChange} style={styles.input} /></label>
              <label style={styles.field}><span>Account Portal URL</span><input name="accountPortalUrl" value={formValues.accountPortalUrl} onChange={handleFieldChange} style={styles.input} /></label>
              <label style={styles.field}><span>Favorite</span><input type="checkbox" name="favorite" checked={Boolean(formValues.favorite)} onChange={handleFieldChange} /></label>
              <label style={{ ...styles.field, gridColumn: "1 / -1" }}><span>Notes</span><textarea name="notes" value={formValues.notes} onChange={handleFieldChange} style={{ ...styles.input, minHeight: 76 }} /></label>
              <div style={{ gridColumn: "1 / -1", display: "flex", gap: 10 }}>
                <button type="submit" style={styles.primaryButton}>SAVE VENDOR</button>
                <button type="button" style={styles.secondaryButton} onClick={() => setFormValues({ ...initialValues, favorite: false })}>RESET</button>
              </div>
            </form>
            <div style={styles.importSection}>
              <div style={styles.panelHeaderRow}><h3 style={styles.panelTitle}>IMPORT OPTIONS</h3></div>
              <label style={styles.field}>
                <span>CSV / Structured Import</span>
                <textarea value={importText} onChange={(event) => setImportText(event.target.value)} style={{ ...styles.input, minHeight: 110, width: "100%" }} placeholder="name,phone,email,notes\nAcme Supply,(512) 555-0100,info@example.com,Preferred" />
              </label>
              <div style={styles.inlineActions}>
                <button type="button" style={styles.secondaryButton} onClick={handlePreviewImport}>PREVIEW IMPORT</button>
                <button type="button" style={styles.secondaryButton} onClick={handleApplyImport} disabled={importing}>{importing ? "IMPORTING..." : "APPLY IMPORT"}</button>
              </div>
              {importPreview ? (
                <div style={styles.successBox}>
                  <strong>Preview summary:</strong> {importPreview.summary.accepted} ready, {importPreview.summary.flagged} flagged.
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
              <h2 style={styles.panelTitle}>VENDOR DIRECTORY</h2>
              <div style={styles.inlineActions}><span style={styles.statusBadge}>{connectionState}</span></div>
            </div>
            {filteredVendors.length === 0 ? (
              <div style={styles.emptyState}>
                <h3>No vendor records available</h3>
                <p>Start by adding a vendor or importing product vault vendors when available.</p>
                <div style={styles.inlineActions}><button type="button" style={styles.primaryButton} onClick={() => setFormValues(initialValues)}>ADD VENDOR</button></div>
              </div>
            ) : (
              <div style={styles.tableWrap}>
                <table style={styles.table}>
                  <thead>
                    <tr>
                      <th style={styles.th}>Fav</th>
                      <th style={styles.th}>Vendor</th>
                      <th style={styles.th}>Category</th>
                      <th style={styles.th}>Overall</th>
                      <th style={styles.th}>Compliance</th>
                      <th style={styles.th}>Risk</th>
                      <th style={styles.th}>Spend</th>
                      <th style={styles.th}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredVendors.map((vendor) => (
                      <tr key={vendor.id} style={styles.tr}>
                        <td style={styles.td}><button type="button" style={styles.iconButton} onClick={() => handleToggleFavorite(vendor.id)}>{vendor.favorite ? "★" : "☆"}</button></td>
                        <td style={styles.td}><button type="button" style={styles.linkButton} onClick={() => setSelectedDetailId(vendor.id)}>{vendor.vendorName || "Untitled Vendor"}</button></td>
                        <td style={styles.td}>{vendor.primaryCategory}</td>
                        <td style={styles.td}>{formatScore(vendor.metrics.overallScore)}</td>
                        <td style={styles.td}>{vendor.metrics.complianceStatus}</td>
                        <td style={styles.td}>{vendor.metrics.riskLevel}</td>
                        <td style={styles.td}>{formatCurrency(vendor.totalSpend)}</td>
                        <td style={styles.td}>
                          <div style={styles.inlineActions}>
                            <button type="button" style={styles.secondaryButton} onClick={() => handleSelectVendor(vendor)}>Edit</button>
                            <button type="button" style={styles.secondaryButton} onClick={() => toggleComparison(vendor.id)}>{comparisonIds.includes(vendor.id) ? "Unselect" : "Compare"}</button>
                            <button type="button" style={styles.secondaryButton} onClick={() => handleDuplicate(vendor.id)}>Dup</button>
                            <button type="button" style={styles.secondaryButton} onClick={() => handleDelete(vendor.id)}>Delete</button>
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
                  {comparisonItems.map((vendor) => (
                    <div key={vendor.id} style={styles.comparisonItem}>
                      <strong>{vendor.vendorName || "Unnamed Vendor"}</strong>
                      <div>Overall: {formatScore(vendor.metrics.overallScore)}</div>
                      <div>Pricing: {formatScore(vendor.pricingScore)}</div>
                      <div>Reliability: {formatScore(vendor.reliabilityScore)}</div>
                      <div>Spend: {formatCurrency(vendor.totalSpend)}</div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </section>
        </div>

        {detailVendor ? (
          <div style={styles.modalOverlay} onClick={() => setSelectedDetailId("")}>
            <div style={styles.modalCard} onClick={(event) => event.stopPropagation()}>
              <div style={styles.panelHeaderRow}>
                <h3 style={styles.panelTitle}>{detailVendor.vendorName || "Vendor Detail"}</h3>
                <button type="button" style={styles.secondaryButton} onClick={() => setSelectedDetailId("")}>Close</button>
              </div>
              <div style={styles.detailGrid}>
                <div style={styles.detailSection}>
                  <h4>Overview</h4>
                  <div>Type: {detailVendor.vendorType}</div>
                  <div>Primary Category: {detailVendor.primaryCategory}</div>
                  <div>Approval: {detailVendor.approvalStatus}</div>
                  <div>Active Status: {detailVendor.activeStatus}</div>
                  <div>Pricing Tier: {detailVendor.pricingTier}</div>
                  <div>Recommendation: {detailVendor.recommendation}</div>
                </div>
                <div style={styles.detailSection}>
                  <h4>Contact & Account</h4>
                  <div>Contact: {detailVendor.contactName || "—"}</div>
                  <div>Phone: {detailVendor.phone || "—"}</div>
                  <div>Email: {detailVendor.email || "—"}</div>
                  <div>Website: {detailVendor.website ? <a href={detailVendor.website} target="_blank" rel="noreferrer" style={styles.link}>{detailVendor.website}</a> : "No Link"}</div>
                  <div>Portal: {detailVendor.accountPortalUrl ? <a href={detailVendor.accountPortalUrl} target="_blank" rel="noreferrer" style={styles.link}>{detailVendor.accountPortalUrl}</a> : "No Link"}</div>
                </div>
                <div style={styles.detailSection}>
                  <h4>Scorecard</h4>
                  <div>Overall Score: {formatScore(detailVendor.metrics.overallScore)}</div>
                  <div>Pricing Score: {formatScore(detailVendor.pricingScore)}</div>
                  <div>Reliability Score: {formatScore(detailVendor.reliabilityScore)}</div>
                  <div>Communication Score: {formatScore(detailVendor.communicationScore)}</div>
                  <div>Delivery Score: {formatScore(detailVendor.deliveryScore)}</div>
                  <div>Service Score: {formatScore(detailVendor.serviceScore)}</div>
                </div>
                <div style={styles.detailSection}>
                  <h4>Product Vault</h4>
                  <div>Linked Products: {productRelationship[detailVendor.vendorName?.toLowerCase()]?.count || 0}</div>
                  <div>Linked Product Value: {formatCurrency(productRelationship[detailVendor.vendorName?.toLowerCase()]?.totalValue || 0)}</div>
                  <div>Compliance: {detailVendor.metrics.complianceStatus}</div>
                  <div>Risk Level: {detailVendor.metrics.riskLevel}</div>
                  <div>Reason: {detailVendor.recommendationExplanation}</div>
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
  emptyState: { background: "#0f0b06", border: "1px dashed #7b5a1b", padding: 24, textAlign: "center", color: "#f0c85c" },
  comparisonCard: { marginTop: 12, borderTop: "1px solid #7b5a1b", paddingTop: 12 },
  comparisonGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10 },
  comparisonItem: { background: "#0f0b06", border: "1px solid #7b5a1b", padding: 10, fontSize: 13 },
  modalOverlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.72)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 },
  modalCard: { width: "min(900px, 100%)", background: "#16110a", border: "1px solid #7b5a1b", padding: 20, maxHeight: "80vh", overflowY: "auto" },
  detailGrid: { display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12 },
  detailSection: { background: "#0f0b06", border: "1px solid #3a2d14", padding: 12 },
  link: { color: "#f5d06b" },
};
