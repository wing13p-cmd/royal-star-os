import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { buildApiUrl } from "../utils/apiClient.js";
import { appendMediaAuditEntry, filterExportPermittedMedia, validatePhotoUpload } from "../utils/photoUploadPolicy.js";
import { buildCompValuationUiModel } from "./compValuationUiModel.js";
import { buildSessionAuthHeaders } from "../utils/sessionAuth.js";
import { buildCompCreatePayload, buildCompReviewCounts, buildCompStatistics, filterCompsForSubject, findPersistedProviderSubject, formatProviderSaleDate, getProviderReviewCandidate, getProviderReviewCandidateKey, importProviderCandidateTransaction, normalizeProviderReviewCandidates, persistCompViaApi, rejectProviderReviewCandidate } from "./compDatabaseContract.js";
import { buildCompEnterpriseUiModel, buildCompExportPackage, buildAppraisalExportPackage, buildPdfSummary, buildExcelCompPackage, buildCompDatabaseBackup } from "../utils/compEnterpriseIntelligence.js";
import logo from "../assets/royal-star-logo.png";

const API_BASE_URL = "";

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
  ["🏦", "LENDER DASHBOARD"],
  ["📄", "APPRAISER PACKET BUILDER"],
  ["🗂️", "PROPERTY DATABASE"],
  ["🗃️", "VENDOR DATABASE"],
  ["▪", "MATERIAL MATRIX"],
];

const propertyTypes = ["Single Family", "Condo", "Townhome", "Multi-Family", "Land", "Other"];
const conditionOptions = ["Poor", "Fair", "Average", "Good", "Renovated", "New Construction"];
const qualityGrades = ["A", "B", "C", "D", "F"];
const includedFilterOptions = ["All", "Included", "Excluded"];
const sortOptions = [
  ["newestSale", "Newest Sale"],
  ["closestDistance", "Closest Distance"],
  ["highestQuality", "Highest Quality Score"],
  ["lowestQuality", "Lowest Quality Score"],
  ["pricePerSqft", "Price Per Square Foot"],
  ["salePrice", "Sale Price"],
];

const initialValues = {
  subjectProperty: "",
  compAddress: "",
  city: "",
  state: "",
  zipCode: "",
  salePrice: "",
  saleDate: "",
  listPrice: "",
  propertyType: "Single Family",
  bedrooms: "",
  bathrooms: "",
  squareFeet: "",
  yearBuilt: "",
  lotSize: "",
  distanceMiles: "",
  condition: "Average",
  garage: "",
  basement: "",
  source: "",
  sourceLink: "",
  notes: "",
  included: true,
};

function createId(prefix = "comp") {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseOptionalNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : "";
}

function formatCurrency(value) {
  if (!Number.isFinite(value)) return "Not Available";
  return `$${value.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

function formatDate(value) {
  return formatProviderSaleDate(value);
}

function formatCompAddress(value) {
  const normalized = typeof value === "string" ? value.trim() : "";
  return normalized || "N/A";
}

function formatCompSummaryLabel(comp) {
  if (!comp) return "Address unavailable (N/A)";
  const hasAddress = Boolean(formatCompAddress(comp.compAddress || comp.address || comp.propertyAddress) !== "N/A");
  const address = hasAddress ? formatCompAddress(comp.compAddress || comp.address || comp.propertyAddress) : "Address unavailable";
  const grade = (typeof comp.grade === "string" && comp.grade.trim()) ? comp.grade.trim() : "N/A";
  return `${address} (${grade})`;
}

function getDaysSinceSale(saleDate) {
  if (!saleDate) return null;
  const sale = new Date(saleDate);
  if (Number.isNaN(sale.getTime())) return null;
  const today = new Date();
  const diffMs = today.setHours(0, 0, 0, 0) - sale.setHours(0, 0, 0, 0);
  return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
}

function getQualityGrade(score) {
  if (score >= 85) return "A";
  if (score >= 70) return "B";
  if (score >= 55) return "C";
  if (score >= 40) return "D";
  return "F";
}

function getSimilarityBadge(score) {
  const numeric = Number(score);
  if (!Number.isFinite(numeric)) return { label: "Pending", tone: GOLD };
  if (numeric >= 80) return { label: "Strong Match", tone: "#4caf50" };
  if (numeric >= 60) return { label: "Moderate Match", tone: GOLD };
  return { label: "Weak Match", tone: "#ff6b6b" };
}

function getWarningBadges(comp) {
  const badges = [];
  if (comp.providerImported) badges.push("Imported");
  if (comp.inclusionStatus === "pending" || comp.verified === false) badges.push("Pending Review");
  if (comp.included === false || comp.inclusionStatus === "excluded") badges.push("Excluded");
  if (Array.isArray(comp.warningFlags) && comp.warningFlags.length > 0) {
    badges.push(...comp.warningFlags.slice(0, 2));
  }
  return badges;
}

function normalizeCompPayload(values) {
  return {
    subjectProperty: values.subjectProperty || "",
    compAddress: values.compAddress || "",
    city: values.city || "",
    state: values.state || "",
    zipCode: values.zipCode || "",
    salePrice: parseOptionalNumber(values.salePrice),
    saleDate: values.saleDate || "",
    listPrice: parseOptionalNumber(values.listPrice),
    propertyType: values.propertyType || "Single Family",
    bedrooms: parseOptionalNumber(values.bedrooms),
    bathrooms: parseOptionalNumber(values.bathrooms),
    squareFeet: parseOptionalNumber(values.squareFeet),
    yearBuilt: parseOptionalNumber(values.yearBuilt),
    lotSize: values.lotSize || "",
    distanceMiles: parseOptionalNumber(values.distanceMiles),
    condition: values.condition || "Average",
    garage: values.garage || "",
    basement: values.basement || "",
    source: values.source || "",
    sourceLink: values.sourceLink || "",
    notes: values.notes || "",
    included: Boolean(values.included !== false),
    provider: values.provider || "manual",
    media: Array.isArray(values.media) ? values.media : [],
    mediaRightsStatus: values.mediaRightsStatus || "REMOTE_REFERENCE_ONLY",
    attributionRequired: Boolean(values.attributionRequired !== false),
    mediaRestricted: Boolean(values.mediaRestricted),
    mediaExpired: Boolean(values.mediaExpired),
    duplicateSourceCount: values.duplicateSourceCount || 0,
    providerImported: Boolean(values.providerImported),
    manuallyEntered: Boolean(values.manuallyEntered),
    verified: Boolean(values.verified),
    inclusionStatus: values.inclusionStatus || "pending",
    exclusionReason: values.exclusionReason || "",
    warningFlags: Array.isArray(values.warningFlags) ? values.warningFlags : [],
  };
}

function getConditionSimilarity(compCondition, subjectCondition) {
  const conditionRank = {
    Poor: 1,
    Fair: 2,
    Average: 3,
    Good: 4,
    Renovated: 5,
    "New Construction": 6,
  };

  if (!compCondition || !subjectCondition) return 0.5;
  const left = conditionRank[compCondition] || 3;
  const right = conditionRank[subjectCondition] || 3;
  const delta = Math.abs(left - right);
  const similarity = Math.max(0, 1 - delta / 6);
  return similarity;
}

function getValueSimilarity(compValue, subjectValue, fallback = 0.5) {
  if (compValue === "" || compValue === null || compValue === undefined || subjectValue === "" || subjectValue === null || subjectValue === undefined) {
    return fallback;
  }

  const left = Number(compValue);
  const right = Number(subjectValue);
  if (!Number.isFinite(left) || !Number.isFinite(right) || right === 0) {
    return fallback;
  }

  const ratio = Math.min(1, Math.max(0, 1 - Math.abs(left - right) / Math.max(right, 1)));
  return ratio;
}

function getBasicQualityScore(comp, subject) {
  const recencyDays = getDaysSinceSale(comp.saleDate) ?? 365;
  const recencyScore = Math.max(0, Math.min(1, 1 - recencyDays / 1800));
  const distanceScore = comp.distanceMiles ? Math.max(0, Math.min(1, 1 - comp.distanceMiles / 15)) : 0.65;
  const sqftScore = getValueSimilarity(comp.squareFeet, subject?.squareFeet ?? comp.squareFeet, 0.65);
  const bedroomScore = getValueSimilarity(comp.bedrooms, subject?.bedrooms, 0.65);
  const bathroomScore = getValueSimilarity(comp.bathrooms, subject?.bathrooms, 0.65);
  const yearBuiltScore = getValueSimilarity(comp.yearBuilt, subject?.yearBuilt, 0.65);
  const conditionScore = getConditionSimilarity(comp.condition, subject?.condition);

  const weightedScore =
    recencyScore * 0.18 +
    distanceScore * 0.2 +
    sqftScore * 0.18 +
    bedroomScore * 0.12 +
    bathroomScore * 0.12 +
    yearBuiltScore * 0.1 +
    conditionScore * 0.1;

  return Math.max(0, Math.min(100, weightedScore * 100));
}

function getArvConfidence(includedComps, avgPpsf, priceSpread) {
  const strongComps = includedComps.filter((comp) => comp.qualityScore >= 75).length;
  const recentSales = includedComps.filter((comp) => getDaysSinceSale(comp.saleDate) !== null && getDaysSinceSale(comp.saleDate) <= 365).length;
  const closeDistance = includedComps.filter((comp) => comp.distanceMiles !== "" && comp.distanceMiles <= 3).length;
  const consistentPricing = priceSpread <= 0.18;

  if (includedComps.length >= 3 && strongComps >= 3 && recentSales >= 2 && closeDistance >= 2 && consistentPricing) {
    return "High";
  }

  if (includedComps.length >= 2 && (strongComps >= 2 || recentSales >= 1) && closeDistance >= 1) {
    return "Medium";
  }

  return "Low";
}

function getArvRecommendation(estimateLow, estimateBase, estimateHigh, confidence) {
  if (confidence === "High") {
    return {
      conservative: estimateLow,
      base: estimateBase,
      aggressive: estimateHigh,
      recommended: estimateBase,
      explanation: "High confidence and a tight pricing spread support using the base ARV estimate.",
    };
  }

  if (confidence === "Medium") {
    return {
      conservative: estimateLow,
      base: estimateBase,
      aggressive: estimateHigh,
      recommended: estimateBase,
      explanation: "Moderate confidence keeps the underwriting ARV centered on the base estimate while avoiding the aggressive outcome.",
    };
  }

  return {
    conservative: estimateLow,
    base: estimateBase,
    aggressive: estimateHigh,
    recommended: estimateLow,
    explanation: "Low confidence calls for a conservative underwriting approach until more recent comps are available.",
    };
}

function getOutlierFlags(includedComps) {
  const salePrices = includedComps.map((comp) => toNumber(comp.salePrice)).filter((value) => value > 0);
  const pricePerSqft = includedComps.map((comp) => toNumber(comp.pricePerSqft)).filter((value) => value > 0);
  const avgSale = salePrices.length > 0 ? salePrices.reduce((sum, value) => sum + value, 0) / salePrices.length : 0;
  const avgPpsf = pricePerSqft.length > 0 ? pricePerSqft.reduce((sum, value) => sum + value, 0) / pricePerSqft.length : 0;
  const varianceSale = salePrices.length > 1 ? salePrices.reduce((sum, value) => sum + (value - avgSale) ** 2, 0) / salePrices.length : 0;
  const variancePpsf = pricePerSqft.length > 1 ? pricePerSqft.reduce((sum, value) => sum + (value - avgPpsf) ** 2, 0) / pricePerSqft.length : 0;
  const stdSale = Math.sqrt(varianceSale);
  const stdPpsf = Math.sqrt(variancePpsf);

  return includedComps.map((comp) => {
    const saleOutlier = stdSale > 0 && Math.abs(toNumber(comp.salePrice) - avgSale) > stdSale * 1.5;
    const ppsfOutlier = stdPpsf > 0 && Math.abs(toNumber(comp.pricePerSqft) - avgPpsf) > stdPpsf * 1.5;
    return { ...comp, saleOutlier, ppsfOutlier };
  });
}

export default function CompDatabase({
  onBack,
  onOpenDealIntake,
  onOpenDealAnalyzer,
  onOpenFlipAnalyzer,
  onOpenBrrrrAnalyzer,
  onOpenProductVault,
  onOpenContractorHub,
  onOpenDealIntelligence,
  onOpenCompDatabase,
}) {
  const [comps, setComps] = useState([]);
  const [deals, setDeals] = useState([]);
  const [selectedCompId, setSelectedCompId] = useState("");
  const [formValues, setFormValues] = useState(initialValues);
  const [searchText, setSearchText] = useState("");
  const [propertyTypeFilter, setPropertyTypeFilter] = useState("All");
  const [conditionFilter, setConditionFilter] = useState("All");
  const [zipFilter, setZipFilter] = useState("All");
  const [includeFilter, setIncludeFilter] = useState("All");
  const [gradeFilter, setGradeFilter] = useState("All");
  const [sortBy, setSortBy] = useState("newestSale");
  const [subjectDealId, setSubjectDealId] = useState("");
  const [connectionState, setConnectionState] = useState("Backend Connected");
  const [providerStatus, setProviderStatus] = useState({ provider: "manual", status: "Manual Entry Ready", configured: true, keyPresent: false, availableProviders: ["manual"], providerStatuses: {} });
  const [providerSearchState, setProviderSearchState] = useState({ loading: false, status: "", error: "", summary: "" });
  const [message, setMessage] = useState({ type: "", text: "" });
  const [compMediaSummary, setCompMediaSummary] = useState({ provider: "manual", mediaCount: 0, primaryPhoto: null, rightsStatus: "REMOTE_REFERENCE_ONLY", reviewRequired: true });
  const [photoUploadState, setPhotoUploadState] = useState({ loading: false, error: "", summary: "" });
  const [enterpriseDiagnostics, setEnterpriseDiagnostics] = useState(null);
  const [exportStatus, setExportStatus] = useState({ message: "", type: "" });
  const [providerOnboardingState, setProviderOnboardingState] = useState({ provider: "manual", status: "Not Configured", active: false, maskedCredentialStatus: { configured: false, hasSecret: false, status: "Not Configured", secretMasked: "not-set" } });
  const [providerConfigForm, setProviderConfigForm] = useState({ provider: "manual", baseUrl: "", apiKey: "", clientId: "", clientSecret: "", datasetId: "", mediaRights: "REMOTE_REFERENCE_ONLY" });
  const [providerSessionSummary, setProviderSessionSummary] = useState({ latestSession: null, recentSessions: [], cacheEntries: 0, usage: {} });
  const [providerSearchHistory, setProviderSearchHistory] = useState([]);
  const [providerFreshness, setProviderFreshness] = useState(null);
  const [providerCacheDiagnostics, setProviderCacheDiagnostics] = useState({});
  const [providerSubject, setProviderSubject] = useState(null);
  const [providerCandidates, setProviderCandidates] = useState([]);
  const [rejectedProviderCandidates, setRejectedProviderCandidates] = useState([]);
  const [selectedProviderCandidateId, setSelectedProviderCandidateId] = useState("");
  const [providerImportState, setProviderImportState] = useState({ candidateId: "", status: "idle", message: "" });
  const [providerEvidenceState, setProviderEvidenceState] = useState({ candidateId: "", status: "idle", report: null, error: "" });
  const providerImportInFlightRef = useRef("");
  const mountedRef = useRef(true);
  const subjectDealIdRef = useRef("");
  const providerReviewCloseButtonRef = useRef(null);
  const providerReviewReturnFocusRef = useRef(null);
  const providerReviewTraceRef = useRef({ handlerExecuted: false, candidateId: "", selectionChanged: false, candidateResolved: false, portalRendered: false, modalMounted: false, remainedMounted: false });
  const providerSearchRequestRef = useRef(0);
  const [providerSearchCounts, setProviderSearchCounts] = useState({ providerCandidatesRetrieved: 0, qualifyingCandidatesReturned: 0, deduplicatedCandidates: 0, tierCounts: { 1: 0, 2: 0, 3: 0, 4: 0 } });
  const [providerSearchDiagnostics, setProviderSearchDiagnostics] = useState({});
  const [opsTemplates, setOpsTemplates] = useState([]);
  const [opsSearchHistory, setOpsSearchHistory] = useState([]);
  const [opsFreshness, setOpsFreshness] = useState(null);
  const [opsReadiness, setOpsReadiness] = useState(null);
  const [opsDiagnostics, setOpsDiagnostics] = useState(null);
  const [opsMessage, setOpsMessage] = useState({ type: "", text: "" });

  useEffect(() => () => {
    mountedRef.current = false;
  }, []);

  useEffect(() => {
    const loadOpsState = async () => {
      try {
        const [templatesRes, readinessRes, diagnosticsRes] = await Promise.all([
          fetch(buildApiUrl("/api/comps/operations/templates")),
          fetch(buildApiUrl("/api/comps/operations/readiness"), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ comps: comps }) }),
          fetch(buildApiUrl("/api/comps/operations/diagnostics"), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ comps, redaction: true }) }),
        ]);
        if (templatesRes.ok) setOpsTemplates(await templatesRes.json());
        if (readinessRes.ok) setOpsReadiness(await readinessRes.json());
        if (diagnosticsRes.ok) setOpsDiagnostics(await diagnosticsRes.json());
      } catch (error) {
        console.error("Unable to load comp operations state", error);
      }
    };

    const loadProviderStatus = async () => {
      try {
        const response = await fetch(buildApiUrl("/api/comps/provider-status"));
        if (!response.ok) throw new Error("Unable to fetch provider status");
        const status = await response.json();
        setProviderStatus(status || { provider: "manual", status: "Manual Entry Ready", configured: true, keyPresent: false, availableProviders: ["manual"], providerStatuses: {} });
      } catch (error) {
        console.error("Unable to load provider status", error);
      }
    };

    const loadComps = async () => {
      try {
        const response = await fetch(buildApiUrl("/api/comps"));
        if (!response.ok) throw new Error("Unable to fetch comps");
        const apiComps = await response.json();
        setComps(Array.isArray(apiComps) ? apiComps : []);
        setConnectionState("Backend Connected");
      } catch (error) {
        console.error("Unable to load comps from API, using localStorage fallback", error);
        setConnectionState("Local Fallback");
        if (typeof window !== "undefined") {
          try {
            const storedComps = JSON.parse(window.localStorage.getItem("royalStarComps") || "[]") || [];
            setComps(Array.isArray(storedComps) ? storedComps : []);
          } catch (localError) {
            console.error("Unable to read comps from localStorage", localError);
            setComps([]);
          }
        }
      }
    };

    const loadDeals = async () => {
      try {
        const response = await fetch(buildApiUrl("/api/deals"));
        if (!response.ok) throw new Error("Unable to fetch deals");
        const apiDeals = await response.json();
        setDeals(Array.isArray(apiDeals) ? apiDeals : []);
      } catch (error) {
        console.error("Unable to load deals for subject selection", error);
        if (typeof window !== "undefined") {
          try {
            const storedDeals = JSON.parse(window.localStorage.getItem("royalStarDeals") || "[]") || [];
            setDeals(Array.isArray(storedDeals) ? storedDeals : []);
          } catch (localError) {
            console.error("Unable to read deals from localStorage", localError);
            setDeals([]);
          }
        }
      }
    };

    const loadProviderSessionSummary = async () => {
      try {
        const [sessionResponse, historyResponse] = await Promise.all([
          fetch(buildApiUrl("/api/comps/search-session")),
          fetch(buildApiUrl("/api/comps/provider-search-history")),
        ]);
        if (!sessionResponse.ok || !historyResponse.ok) throw new Error("Unable to fetch provider search telemetry");
        const summary = await sessionResponse.json();
        const history = await historyResponse.json();
        setProviderSessionSummary(summary || { latestSession: null, recentSessions: [], cacheEntries: 0, usage: {} });
        setProviderSearchHistory(Array.isArray(history) ? history : []);
        const diagnostics = summary?.latestSession?.snapshot?.diagnostics || {};
        setProviderCacheDiagnostics(diagnostics);
        setProviderFreshness(buildProviderFreshness(summary?.latestSession, diagnostics));
      } catch (error) {
        console.error("Unable to load provider search telemetry", error);
      }
    };

    loadOpsState();
    loadProviderStatus();
    loadComps();
    loadDeals();
    loadProviderSessionSummary();
  }, []);

  const buildProviderFreshness = (session, diagnostics = {}) => {
    const timestamp = diagnostics.lastLiveProviderRefresh || session?.updatedAt || session?.createdAt || null;
    if (!timestamp) return null;
    const ageMs = Math.max(0, Date.now() - Date.parse(timestamp));
    const ttlMs = Number(diagnostics.cacheTtlMs || 0);
    return { timestamp, ageMs, ttlMs, status: ttlMs > 0 && ageMs <= ttlMs ? "Fresh" : "Stale" };
  };

  const refreshProviderTelemetry = async (diagnosticsOverride = null) => {
    try {
      const [sessionResponse, historyResponse] = await Promise.all([
        fetch(buildApiUrl("/api/comps/search-session")),
        fetch(buildApiUrl("/api/comps/provider-search-history")),
      ]);
      if (!sessionResponse.ok || !historyResponse.ok) return;
      const summary = await sessionResponse.json();
      const history = await historyResponse.json();
      setProviderSessionSummary(summary || { latestSession: null, recentSessions: [], cacheEntries: 0, usage: {} });
      setProviderSearchHistory(Array.isArray(history) ? history : []);
      const diagnostics = diagnosticsOverride || summary?.latestSession?.snapshot?.diagnostics || {};
      setProviderCacheDiagnostics(diagnostics);
      setProviderFreshness(buildProviderFreshness(summary?.latestSession, diagnostics));
    } catch (error) {
      console.error("Unable to refresh provider search telemetry", error);
    }
  };

  const selectedSubjectDeal = useMemo(() => deals.find((deal) => deal.id === subjectDealId) || null, [deals, subjectDealId]);

  useEffect(() => {
    providerSearchRequestRef.current += 1;
    subjectDealIdRef.current = subjectDealId;
    setProviderCandidates([]);
    setProviderSubject(null);
    setRejectedProviderCandidates([]);
    setSelectedProviderCandidateId("");
    setProviderImportState({ candidateId: "", status: "idle", message: "" });
    setProviderSearchCounts({ providerCandidatesRetrieved: 0, qualifyingCandidatesReturned: 0, deduplicatedCandidates: 0, tierCounts: { 1: 0, 2: 0, 3: 0, 4: 0 } });
    setProviderSearchDiagnostics({});
    setProviderSearchState({ loading: false, status: "", error: "", summary: "" });
  }, [subjectDealId]);

  useEffect(() => {
    if (!selectedSubjectDeal || providerSubject) return;
    const restored = findPersistedProviderSubject(selectedSubjectDeal, providerSessionSummary?.subjectProperties);
    if (restored) setProviderSubject(restored);
  }, [selectedSubjectDeal, providerSessionSummary, providerSubject]);

  const subjectComps = useMemo(() => filterCompsForSubject(comps, selectedSubjectDeal), [comps, selectedSubjectDeal]);

  const normalizedComps = useMemo(() => {
    return subjectComps.map((comp) => ({
      ...comp,
      salePrice: toNumber(comp.salePrice),
      listPrice: toNumber(comp.listPrice),
      bedrooms: toNumber(comp.bedrooms),
      bathrooms: toNumber(comp.bathrooms),
      squareFeet: toNumber(comp.squareFeet),
      yearBuilt: toNumber(comp.yearBuilt),
      distanceMiles: toNumber(comp.distanceMiles),
      pricePerSqft: toNumber(comp.squareFeet) > 0 ? toNumber(comp.salePrice) / toNumber(comp.squareFeet) : 0,
      qualityScore: getBasicQualityScore(comp, selectedSubjectDeal),
      grade: getQualityGrade(getBasicQualityScore(comp, selectedSubjectDeal)),
      daysSinceSale: getDaysSinceSale(comp.saleDate),
      priceDifference: selectedSubjectDeal?.salePrice ? toNumber(comp.salePrice) - toNumber(selectedSubjectDeal.salePrice) : null,
      sqFtDifference: selectedSubjectDeal?.squareFeet ? toNumber(comp.squareFeet) - toNumber(selectedSubjectDeal.squareFeet) : null,
      bedroomDifference: selectedSubjectDeal?.bedrooms ? toNumber(comp.bedrooms) - toNumber(selectedSubjectDeal.bedrooms) : null,
      bathroomDifference: selectedSubjectDeal?.bathrooms ? toNumber(comp.bathrooms) - toNumber(selectedSubjectDeal.bathrooms) : null,
      ageDifference: selectedSubjectDeal?.yearBuilt ? toNumber(comp.yearBuilt) - toNumber(selectedSubjectDeal.yearBuilt) : null,
    }));
  }, [subjectComps, selectedSubjectDeal]);

  const filteredComps = useMemo(() => {
    const search = searchText.trim().toLowerCase();
    let items = [...normalizedComps];

    if (search) {
      items = items.filter((comp) => {
        const haystack = [comp.compAddress, comp.city, comp.zipCode, comp.source].filter(Boolean).join(" ").toLowerCase();
        return haystack.includes(search);
      });
    }

    if (propertyTypeFilter !== "All") items = items.filter((comp) => comp.propertyType === propertyTypeFilter);
    if (conditionFilter !== "All") items = items.filter((comp) => comp.condition === conditionFilter);
    if (zipFilter !== "All") items = items.filter((comp) => comp.zipCode === zipFilter);
    if (includeFilter === "Included") items = items.filter((comp) => comp.included !== false);
    if (includeFilter === "Excluded") items = items.filter((comp) => comp.included === false);
    if (gradeFilter !== "All") items = items.filter((comp) => comp.grade === gradeFilter);

    items.sort((left, right) => {
      switch (sortBy) {
        case "closestDistance":
          return toNumber(left.distanceMiles) - toNumber(right.distanceMiles);
        case "highestQuality":
          return right.qualityScore - left.qualityScore;
        case "lowestQuality":
          return left.qualityScore - right.qualityScore;
        case "pricePerSqft":
          return right.pricePerSqft - left.pricePerSqft;
        case "salePrice":
          return right.salePrice - left.salePrice;
        default:
          return (right.saleDate || "").localeCompare(left.saleDate || "");
      }
    });

    return items;
  }, [normalizedComps, searchText, propertyTypeFilter, conditionFilter, zipFilter, includeFilter, gradeFilter, sortBy]);

  const selectedComp = useMemo(() => filteredComps.find((comp) => comp.id === selectedCompId) || normalizedComps.find((comp) => comp.id === selectedCompId) || null, [filteredComps, normalizedComps, selectedCompId]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (!selectedComp) {
        setCompMediaSummary({ provider: "manual", mediaCount: 0, primaryPhoto: null, rightsStatus: "REMOTE_REFERENCE_ONLY", reviewRequired: true });
        return;
      }

      const mediaItems = Array.isArray(selectedComp.media) ? selectedComp.media : [];
      const primaryPhoto = mediaItems.find((entry) => entry.isPrimary || entry.label?.toLowerCase().includes("primary")) || mediaItems[0] || null;
      const rightsStatus = selectedComp.mediaRightsStatus || (selectedComp.providerImported ? "REMOTE_REFERENCE_ONLY" : "REMOTE_REFERENCE_ONLY");
      setCompMediaSummary({
        provider: selectedComp.provider || "manual",
        mediaCount: mediaItems.length,
        primaryPhoto,
        rightsStatus,
        reviewRequired: selectedComp.verified === false || selectedComp.inclusionStatus === "pending",
      });
    }, 0);

    return () => window.clearTimeout(timer);
  }, [selectedComp]);

  const exportPermittedMedia = useMemo(() => filterExportPermittedMedia(selectedComp?.media || []), [selectedComp]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (!selectedComp) {
        setOpsFreshness(null);
        return;
      }
      fetch(buildApiUrl("/api/comps/operations/freshness"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ comp: selectedComp }),
      })
        .then((response) => (response.ok ? response.json() : null))
        .then((payload) => setOpsFreshness(payload))
        .catch(() => setOpsFreshness(null));
    }, 0);

    return () => window.clearTimeout(timer);
  }, [selectedComp]);

  const handleSaveOpsTemplate = async () => {
    try {
      const response = await fetch(buildApiUrl("/api/comps/operations/templates"), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "Manual Template", criteria: { radiusMiles: 0.5 } }) });
      if (!response.ok) throw new Error("Unable to save template");
      const saved = await response.json();
      setOpsTemplates((current) => [saved, ...current]);
      setOpsMessage({ type: "success", text: `Saved template ${saved.name}` });
    } catch (error) {
      setOpsMessage({ type: "error", text: error.message || "Unable to save template" });
    }
  };

  const handleRecordOpsSearch = async () => {
    try {
      const response = await fetch(buildApiUrl("/api/comps/operations/search-history"), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ subjectProperty: selectedSubjectDeal?.address || "952 Goss Rd", user: "Brandon Sterling", template: "Manual Template", criteria: { radiusMiles: 0.5 } }) });
      if (!response.ok) throw new Error("Unable to record search");
      const saved = await response.json();
      setOpsSearchHistory((current) => [saved, ...current]);
      setOpsMessage({ type: "success", text: `Recorded search ${saved.id}` });
    } catch (error) {
      setOpsMessage({ type: "error", text: error.message || "Unable to record search" });
    }
  };

  const handleLifecycleTransition = async () => {
    if (!selectedComp) return;
    try {
      const response = await fetch(buildApiUrl("/api/comps/operations/lifecycle"), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ compId: selectedComp.id, currentStatus: selectedComp.inclusionStatus || "Pending Review", nextStatus: selectedComp.verified ? "Included" : "Pending Review", reason: "Administrator review", actor: "Brandon Sterling" }) });
      if (!response.ok) throw new Error("Unable to transition lifecycle");
      const payload = await response.json();
      setOpsMessage({ type: payload.ok ? "success" : "error", text: payload.ok ? `Lifecycle updated: ${payload.entry?.toStatus || "Updated"}` : payload.message || "Lifecycle update failed" });
    } catch (error) {
      setOpsMessage({ type: "error", text: error.message || "Lifecycle update failed" });
    }
  };

  const handleBulkReview = async () => {
    if (!selectedComp) return;
    try {
      const response = await fetch(buildApiUrl("/api/comps/operations/bulk"), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ compIds: [selectedComp.id], action: "archive", reason: "Administrative cleanup", actor: "Brandon Sterling" }) });
      if (!response.ok) throw new Error("Unable to apply bulk action");
      const payload = await response.json();
      setOpsMessage({ type: "success", text: `Bulk action applied to ${payload.affectedCount} record(s)` });
    } catch (error) {
      setOpsMessage({ type: "error", text: error.message || "Bulk action failed" });
    }
  };

  const summaryStats = useMemo(() => {
    const included = normalizedComps.filter((comp) => comp.included !== false);
    const statistics = buildCompStatistics(normalizedComps, selectedSubjectDeal);
    const averageSalePrice = statistics.averageSalePrice;
    const averagePpsf = statistics.averagePpsf;
    const subjectSqft = selectedSubjectDeal?.squareFeet ? toNumber(selectedSubjectDeal.squareFeet) : null;
    const baseArv = subjectSqft && averagePpsf > 0 ? averagePpsf * subjectSqft : averageSalePrice;
    const lowArv = subjectSqft && averagePpsf > 0 ? averagePpsf * subjectSqft * 0.95 : averageSalePrice * 0.9;
    const highArv = subjectSqft && averagePpsf > 0 ? averagePpsf * subjectSqft * 1.05 : averageSalePrice * 1.1;
    const priceSpread = averagePpsf > 0 ? (highArv - lowArv) / averagePpsf : 0;
    const confidence = getArvConfidence(included, averagePpsf, priceSpread);
    const recommendation = getArvRecommendation(lowArv, baseArv, highArv, confidence);
    const strongest = [...included].sort((left, right) => right.qualityScore - left.qualityScore)[0] || null;
    const recent = [...included].sort((left, right) => (right.saleDate || "").localeCompare(left.saleDate || ""))[0] || null;

    return {
      ...statistics,
      confidence,
      recommendation,
      strongest,
      recent,
    };
  }, [normalizedComps, selectedSubjectDeal]);

  const outlierDetails = useMemo(() => getOutlierFlags(normalizedComps.filter((comp) => comp.included !== false)), [normalizedComps]);
  const selectedOutlier = useMemo(() => outlierDetails.find((comp) => comp.id === selectedCompId) || null, [outlierDetails, selectedCompId]);
  const valuationUiModel = useMemo(() => buildCompValuationUiModel({ comps: normalizedComps, subjectDeal: selectedSubjectDeal }), [normalizedComps, selectedSubjectDeal]);
  const selectedCompReview = useMemo(() => (selectedComp ? buildCompValuationUiModel({ comps: [selectedComp], subjectDeal: selectedSubjectDeal }) : null), [selectedComp, selectedSubjectDeal]);
  const enterpriseUiModel = useMemo(() => buildCompEnterpriseUiModel({ comps: normalizedComps, auditLog: [], subjectDeal: selectedSubjectDeal }), [normalizedComps, selectedSubjectDeal]);
  const reviewCounts = useMemo(() => buildCompReviewCounts({ providerCandidates, persistedComps: normalizedComps, rejectedCandidates: rejectedProviderCandidates }), [providerCandidates, normalizedComps, rejectedProviderCandidates]);
  const selectedProviderCandidate = useMemo(() => getProviderReviewCandidate(providerCandidates, selectedProviderCandidateId), [providerCandidates, selectedProviderCandidateId]);
  const selectedProviderMedia = useMemo(() => {
    if (!selectedProviderCandidate || selectedProviderCandidate.mediaRestricted || selectedProviderCandidate.mediaExpired) return null;
    const media = Array.isArray(selectedProviderCandidate.media) ? selectedProviderCandidate.media : [];
    return media.find((item) => item?.url || item?.sourceUrl || item?.referenceUrl) || null;
  }, [selectedProviderCandidate]);

  useEffect(() => {
    if (!selectedProviderCandidateId || typeof document === "undefined") return undefined;
    providerReviewTraceRef.current = { ...providerReviewTraceRef.current, selectionChanged: true, candidateResolved: Boolean(selectedProviderCandidate), portalRendered: Boolean(selectedProviderCandidate) };
    const previousBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const handleKeyDown = (event) => {
      if (event.key === "Escape") setSelectedProviderCandidateId("");
    };
    document.addEventListener("keydown", handleKeyDown);
    const focusFrame = window.requestAnimationFrame(() => {
      providerReviewCloseButtonRef.current?.focus();
      if (providerReviewTraceRef.current.modalMounted) providerReviewTraceRef.current = { ...providerReviewTraceRef.current, remainedMounted: true };
    });
    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousBodyOverflow;
      providerReviewReturnFocusRef.current?.focus?.();
    };
  }, [selectedProviderCandidateId, selectedProviderCandidate]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setEnterpriseDiagnostics(enterpriseUiModel);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [enterpriseUiModel]);

  const propertyTypeOptions = useMemo(() => ["All", ...Array.from(new Set(normalizedComps.map((comp) => comp.propertyType).filter(Boolean))).sort()], [normalizedComps]);
  const conditionOptionsList = useMemo(() => ["All", ...conditionOptions], []);
  const zipCodeOptions = useMemo(() => ["All", ...Array.from(new Set(normalizedComps.map((comp) => comp.zipCode).filter(Boolean))).sort()], [normalizedComps]);
  const gradeOptions = useMemo(() => ["All", ...qualityGrades], []);

  const handleFieldChange = (event) => {
    const { name, value, type, checked } = event.target;
    setFormValues((prev) => ({ ...prev, [name]: type === "checkbox" ? checked : value }));
  };

  const handleSelectComp = (comp) => {
    setSelectedCompId(comp.id);
    setFormValues({ ...initialValues, ...comp, included: comp.included !== false });
    setMessage({ type: "", text: "" });
  };

  const handleClearForm = () => {
    setSelectedCompId("");
    setFormValues(initialValues);
    setMessage({ type: "", text: "" });
  };

  const persistComp = async (payload, existingComp = null) => {
    try {
      return await persistCompViaApi({
        fetchImpl: fetch,
        url: buildApiUrl("/api/comps"),
        payload,
        existingId: existingComp?.id || "",
        headers: buildSessionAuthHeaders({ "Content-Type": "application/json" }),
      });
    } catch (error) {
      console.error(existingComp ? "Unable to update comp via API" : "Unable to create comp via API", error);
      throw error;
    }
  };

  const handleProviderTest = async () => {
    setProviderSearchState({ loading: true, status: "Testing connection…", error: "", summary: "" });
    try {
      const response = await fetch(buildApiUrl("/api/comps/provider-test"), {
        method: "POST",
        headers: buildSessionAuthHeaders({ "Content-Type": "application/json" }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        const status = response.status === 401 || response.status === 403 ? "Internal RSOS provider-route authorization failure" : "Internal RSOS provider-route failure";
        throw new Error(result.status || result.error || status);
      }
      setProviderStatus({ ...providerStatus, ...result });
      setMessage({ type: result.ok ? "success" : "error", text: `Provider test: ${result.status}` });
      setProviderSearchState({ loading: false, status: result.ok ? "Connected" : result.status, error: result.ok ? "" : result.status, summary: result.ok ? "Provider connection verified." : "Provider connection failed safely." });
    } catch (error) {
      console.error("Unable to test provider connection", error);
      const message = error?.message || "Internal RSOS provider-route failure";
      setMessage({ type: "error", text: `Provider test: ${message}` });
      setProviderSearchState({ loading: false, status: "Error", error: message, summary: "" });
    }
  };

  const handleSubjectLookup = async () => {
    const address = selectedSubjectDeal?.propertyAddress || selectedSubjectDeal?.address || formValues.compAddress || "";
    if (!address) {
      setMessage({ type: "error", text: "Select a subject deal or enter a comp address first." });
      return;
    }
    setProviderSearchState({ loading: true, status: "Looking up subject property…", error: "", summary: "" });
    try {
      const response = await fetch(buildApiUrl("/api/comps/subject-property"), {
        method: "POST",
        headers: buildSessionAuthHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ address, city: selectedSubjectDeal?.city || formValues.city, state: selectedSubjectDeal?.state || formValues.state, zipCode: selectedSubjectDeal?.zipCode || formValues.zipCode }),
      });
      if (!response.ok) throw new Error("Subject lookup failed");
      const result = await response.json();
      if (result.ok && result.property) setProviderSubject(result.property);
      setProviderSearchState({ loading: false, status: result.ok ? "Lookup complete" : result.status, error: result.ok ? "" : result.status, summary: result.property ? `Provider returned ${result.property.propertyType || "property"} data.` : "No provider property match." });
      setMessage({ type: result.ok ? "success" : "error", text: result.ok ? "Subject-property lookup completed." : result.status });
    } catch (error) {
      console.error("Unable to look up provider subject property", error);
      setProviderSearchState({ loading: false, status: "Error", error: "Subject lookup could not be completed.", summary: "" });
      setMessage({ type: "error", text: "Subject lookup could not be completed." });
    }
  };

  const handleFindSoldComps = async (forceRefresh = false) => {
    const subjectAddress = selectedSubjectDeal?.propertyAddress || selectedSubjectDeal?.address || formValues.compAddress || "";
    if (!subjectAddress) {
      setMessage({ type: "error", text: "Select a subject deal or enter a subject address first." });
      return;
    }
    const requestId = ++providerSearchRequestRef.current;
    const requestSubjectId = selectedSubjectDeal?.id || "";
    setProviderSearchState({ loading: true, status: forceRefresh ? "Refreshing live sold comps…" : "Searching sold comps…", error: "", summary: "Tier 1 starts at same type • 6 months • 0.5 mi • ±20% sqft; widening only if fewer than 3 qualify." });
    try {
      const response = await fetch(buildApiUrl("/api/comps/sold-comps"), {
        method: "POST",
        headers: buildSessionAuthHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({
          subjectDealId: selectedSubjectDeal?.id || "",
          dealId: selectedSubjectDeal?.id || "",
          propertyId: selectedSubjectDeal?.propertyId || selectedSubjectDeal?.linkedPropertyId || "",
          latitude: providerSubject?.latitude ?? "",
          longitude: providerSubject?.longitude ?? "",
          address: subjectAddress,
          city: selectedSubjectDeal?.city || formValues.city,
          state: selectedSubjectDeal?.state || formValues.state,
          zipCode: selectedSubjectDeal?.zipCode || formValues.zipCode,
          radiusMiles: 0.5,
          months: 6,
          maxResults: 10,
          forceRefresh,
          propertyType: formValues.propertyType || selectedSubjectDeal?.propertyType || "Single Family",
          bedrooms: formValues.bedrooms || selectedSubjectDeal?.bedrooms,
          bathrooms: formValues.bathrooms || selectedSubjectDeal?.bathrooms,
          squareFeet: formValues.squareFeet || selectedSubjectDeal?.squareFeet,
          yearBuilt: formValues.yearBuilt || selectedSubjectDeal?.yearBuilt,
        }),
      });
      if (!response.ok) throw new Error("Sold-comp search failed");
      const result = await response.json();
      if (requestId !== providerSearchRequestRef.current || requestSubjectId !== subjectDealIdRef.current) return;
      const importedRecords = normalizeProviderReviewCandidates(Array.isArray(result.records) ? result.records : [], selectedSubjectDeal);
      setProviderCandidates(importedRecords);
      setRejectedProviderCandidates([]);
      setSelectedProviderCandidateId("");
      const tierCounts = result.tierCounts || {};
      const qualifyingCandidatesReturned = result.totalReviewCandidates ?? result.qualifyingCandidateCount ?? importedRecords.length;
      setProviderSearchCounts({ providerCandidatesRetrieved: result.providerCandidateCount || 0, qualifyingCandidatesReturned, deduplicatedCandidates: Math.max(0, qualifyingCandidatesReturned - importedRecords.length), tierCounts: { 1: tierCounts[1] || 0, 2: tierCounts[2] || 0, 3: tierCounts[3] || 0, 4: tierCounts[4] || 0 } });
      setProviderSearchDiagnostics(result.diagnostics || {});
      setProviderCacheDiagnostics(result.diagnostics || {});
      setProviderFreshness(buildProviderFreshness({ updatedAt: result.diagnostics?.lastLiveProviderRefresh }, result.diagnostics || {}));
      refreshProviderTelemetry(result.diagnostics || {});
      const tierSummary = `Provider candidates retrieved: ${result.providerCandidateCount || 0} • Qualifying candidates returned: ${qualifyingCandidatesReturned} • Active review queue after deduplication: ${importedRecords.length} • Tier 1 qualifying: ${tierCounts[1] || 0} • Tier 2 additional: ${tierCounts[2] || 0} • Tier 3 additional: ${tierCounts[3] || 0} • Tier 4 additional: ${tierCounts[4] || 0}`;
      setProviderSearchState({ loading: false, status: result.status || "Complete", error: result.ok ? "" : result.status, summary: result.ok ? `${tierSummary}. Nothing was imported automatically.` : result.status });
      setMessage({ type: result.ok ? "success" : "error", text: result.status || "Sold-comp search complete." });
    } catch (error) {
      console.error("Unable to search sold comps", error);
      setProviderSearchState({ loading: false, status: "Error", error: "Sold-comp search could not be completed.", summary: "" });
      setMessage({ type: "error", text: "Sold-comp search could not be completed." });
    }
  };

  const handleVerifyProviderCandidate = async (candidate, forceRefresh = false) => {
    const candidateId = candidate.id || candidate.providerRecordId;
    setProviderEvidenceState({ candidateId, status: "loading", report: null, error: "" });
    try {
      const response = await fetch(buildApiUrl("/api/comps/verify-evidence"), {
        method: "POST",
        headers: buildSessionAuthHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ comp: candidate, subject: selectedSubjectDeal || {}, forceRefresh }),
      });
      if (!response.ok) throw new Error("Evidence verification failed");
      const result = await response.json();
      const report = result.evidence || null;
      setProviderEvidenceState({ candidateId, status: "complete", report, error: "" });
      setProviderCandidates((current) => current.map((entry) => entry.id === candidate.id ? {
        ...entry,
        evidenceReport: report,
        verifiedCompScore: report?.verifiedCompScore ?? null,
        verificationRecommendation: report?.recommendation || "NEEDS_REVIEW",
        evidenceProvenance: report?.provenance || [],
        discrepancies: report?.discrepancies || [],
        media: report?.media?.length ? report.media : entry.media,
      } : entry));
    } catch (error) {
      console.error("Unable to verify comp evidence", error);
      setProviderEvidenceState({ candidateId, status: "failed", report: null, error: "Evidence sources could not be verified. The comp remains pending review." });
    }
  };

  const handleReviewProviderCandidate = (candidate) => {
    if (typeof document !== "undefined") providerReviewReturnFocusRef.current = document.activeElement;
    const candidateId = candidate.reviewCandidateKey || getProviderReviewCandidateKey(candidate) || candidate.id;
    providerReviewTraceRef.current = { handlerExecuted: true, candidateId, selectionChanged: false, candidateResolved: false, portalRendered: false, modalMounted: false, remainedMounted: false };
    setSelectedProviderCandidateId(candidateId);
    setMessage({ type: "", text: "" });
  };

  const handleCloseProviderCandidateReview = () => {
    setSelectedProviderCandidateId("");
    setProviderEvidenceState({ candidateId: "", status: "idle", report: null, error: "" });
  };

  const handleApproveProviderCandidate = async (candidate) => {
    if (!selectedSubjectDeal || providerImportInFlightRef.current) return;
    const candidateId = candidate.id;
    const importSubjectId = selectedSubjectDeal.id;
    providerImportInFlightRef.current = candidateId;
    setProviderImportState({ candidateId, status: "importing", message: "Importing…" });
    setMessage({ type: "", text: "" });
    try {
      const result = await importProviderCandidateTransaction({
        fetchImpl: fetch,
        url: buildApiUrl("/api/comps"),
        candidate,
        subjectDeal: selectedSubjectDeal,
        headers: buildSessionAuthHeaders({ "Content-Type": "application/json" }),
        timeoutMs: 15000,
      });
      if (!mountedRef.current || subjectDealIdRef.current !== importSubjectId) return;
      const nextComps = result.comps;
      setComps(nextComps);
      setProviderCandidates((current) => current.filter((entry) => entry.id !== candidateId));
      setSelectedProviderCandidateId("");
      setProviderImportState({ candidateId, status: result.status === "succeeded" ? "succeeded" : "reconciled", message: result.status === "succeeded" ? "Imported successfully" : "Already imported / reconciled" });
      if (typeof window !== "undefined") window.localStorage.setItem("royalStarComps", JSON.stringify(nextComps));
      setMessage({ type: "success", text: result.status === "succeeded" ? "Provider comp imported successfully. Include in ARV remains off pending valuation review." : "Provider comp was already persisted and has been reconciled. Include in ARV remains off." });
    } catch (error) {
      if (!mountedRef.current || subjectDealIdRef.current !== importSubjectId) return;
      const timedOut = error?.category === "timeout";
      setProviderImportState({ candidateId, status: timedOut ? "timed_out" : "failed", message: error?.message || "Import failed" });
      setMessage({ type: "error", text: timedOut ? "Import timed out — verify before retrying. The candidate remains in review." : "Unable to import comp. Persistence was not confirmed; the candidate remains in review." });
    } finally {
      if (providerImportInFlightRef.current === candidateId) providerImportInFlightRef.current = "";
    }
  };

  const handleRejectProviderCandidate = (candidate) => {
    if (providerImportInFlightRef.current) return;
    const next = rejectProviderReviewCandidate(providerCandidates, rejectedProviderCandidates, candidate);
    setProviderCandidates(next.active);
    setRejectedProviderCandidates(next.rejected);
    setSelectedProviderCandidateId("");
    setMessage({ type: "success", text: "Provider candidate rejected. No comp was persisted." });
  };

  const handlePhotoUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file || !selectedCompId) {
      setPhotoUploadState({ loading: false, error: "Select a comp before uploading a photo.", summary: "" });
      return;
    }

    const validation = validatePhotoUpload(file);
    if (!validation.ok) {
      setPhotoUploadState({ loading: false, error: validation.error, summary: "" });
      setMessage({ type: "error", text: validation.error });
      return;
    }

    setPhotoUploadState({ loading: true, error: "", summary: "Preparing upload…" });
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const existingComp = comps.find((entry) => entry.id === selectedCompId);
        const nextMedia = [
          ...(Array.isArray(existingComp?.media) ? existingComp.media : []),
          {
            id: createId("media"),
            label: "User Upload",
            sourceType: "manual",
            url: reader.result,
            thumbnailUrl: reader.result,
            isPrimary: false,
            rightsMode: "REMOTE_REFERENCE_ONLY",
            localStorageAllowed: false,
            thumbnailCachingAllowed: false,
            attributionRequired: true,
            requiresReview: true,
            includeInAppraiserPacket: false,
            source: "User Upload",
            notes: "User-uploaded photo pending review and rights confirmation.",
          },
        ];
        const payload = buildCompCreatePayload(normalizeCompPayload({
          ...existingComp,
          media: nextMedia,
          mediaRightsStatus: "REMOTE_REFERENCE_ONLY",
          attributionRequired: true,
          mediaRestricted: false,
          mediaExpired: false,
          duplicateSourceCount: 0,
          auditHistory: appendMediaAuditEntry(existingComp, {
            action: "photo-upload",
            summary: `Uploaded ${file.name} for review only.`,
            source: "user",
            rightsMode: "REMOTE_REFERENCE_ONLY",
            approvedForExport: false,
          }),
        }), selectedSubjectDeal);
        const savedComp = await persistComp(payload, existingComp);
        const nextComps = existingComp ? comps.map((entry) => (entry.id === existingComp.id ? { ...entry, ...savedComp, id: existingComp.id } : entry)) : [...comps, savedComp];
        setComps(nextComps);
        if (typeof window !== "undefined") {
          window.localStorage.setItem("royalStarComps", JSON.stringify(nextComps));
        }
        setPhotoUploadState({ loading: false, error: "", summary: "Photo queued for review; no storage rights implied." });
        setMessage({ type: "success", text: "Photo uploaded for review." });
      } catch (error) {
        console.error("Unable to persist uploaded photo", error);
        setPhotoUploadState({ loading: false, error: "Photo upload could not be completed.", summary: "" });
        setMessage({ type: "error", text: "Photo upload could not be completed." });
      }
    };
    reader.onerror = () => {
      setPhotoUploadState({ loading: false, error: "Photo upload failed to read the selected file.", summary: "" });
      setMessage({ type: "error", text: "Photo upload failed." });
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!selectedSubjectDeal) {
      setMessage({ type: "error", text: "Select a subject deal before adding a comp." });
      return;
    }

    if (!formValues.compAddress.trim()) {
      setMessage({ type: "error", text: "Comp address is required." });
      return;
    }
    if (!formValues.salePrice || toNumber(formValues.salePrice) < 0) {
      setMessage({ type: "error", text: "Sale price is required and cannot be negative." });
      return;
    }
    if (!formValues.saleDate) {
      setMessage({ type: "error", text: "Sale date is required." });
      return;
    }
    if (!formValues.squareFeet || toNumber(formValues.squareFeet) < 0) {
      setMessage({ type: "error", text: "Square feet are required and cannot be negative." });
      return;
    }
    if (!formValues.source.trim()) {
      setMessage({ type: "error", text: "Source is required." });
      return;
    }

    const existingComp = comps.find((comp) => comp.id === selectedCompId);
    const normalizedPayload = buildCompCreatePayload(normalizeCompPayload({
      ...formValues,
      provider: "manual",
      providerImported: false,
      manuallyEntered: true,
      verified: false,
      inclusionStatus: "pending",
    }), selectedSubjectDeal);
    let savedComp;
    try {
      savedComp = await persistComp(normalizedPayload, existingComp);
    } catch (error) {
      setMessage({ type: "error", text: existingComp ? "Unable to update comp. No changes were saved." : "Unable to add comp. Persistence was not confirmed." });
      return;
    }

    const nextComps = existingComp ? comps.map((comp) => (comp.id === existingComp.id ? { ...comp, ...savedComp, id: existingComp.id } : comp)) : [...comps, savedComp];
    setComps(nextComps);
    if (typeof window !== "undefined") {
      window.localStorage.setItem("royalStarComps", JSON.stringify(nextComps));
    }
    setSelectedCompId(savedComp.id);
    setFormValues({ ...initialValues, ...savedComp, included: savedComp.included !== false, subjectProperty: savedComp.subjectProperty || selectedSubjectDeal?.propertyAddress || "" });
    setMessage({ type: "success", text: existingComp ? "Comp updated successfully." : "Comp added successfully." });
  };

  const handleProviderConfigChange = (event) => {
    const { name, value } = event.target;
    setProviderConfigForm((current) => ({ ...current, [name]: value }));
  };

  const handleProviderAction = async (action) => {
    const payload = {
      action,
      provider: providerConfigForm.provider,
      admin: "System Administrator",
      baseUrl: providerConfigForm.baseUrl,
      apiKey: providerConfigForm.apiKey,
      clientId: providerConfigForm.clientId,
      clientSecret: providerConfigForm.clientSecret,
      datasetId: providerConfigForm.datasetId,
      mediaRights: providerConfigForm.mediaRights,
    };
    const response = await fetch(`${API_BASE_URL}/api/provider-onboarding`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const result = await response.json();
    if (action === "test") {
      setProviderOnboardingState((current) => ({ ...current, status: result.status || current.status }));
    } else if (action === "activate") {
      setProviderOnboardingState((current) => ({ ...current, status: result.status || current.status, active: result.ok }));
    } else if (action === "deactivate") {
      setProviderOnboardingState((current) => ({ ...current, status: result.status || current.status, active: false }));
    }
  };

  const handleExportPackage = () => {
    const packageData = buildCompExportPackage({ comps: normalizedComps, subjectDeal: selectedSubjectDeal });
    const blob = new Blob([JSON.stringify(packageData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "rsos-comp-package.json";
    link.click();
    URL.revokeObjectURL(url);
    setExportStatus({ type: "success", message: "Comparable package exported for review." });
  };

  const handleExportAppraisalPackage = () => {
    const packageData = buildAppraisalExportPackage({ comps: normalizedComps, subjectDeal: selectedSubjectDeal });
    const blob = new Blob([JSON.stringify(packageData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "rsos-appraisal-package.json";
    link.click();
    URL.revokeObjectURL(url);
    setExportStatus({ type: "success", message: "Appraisal package exported for review." });
  };

  const handleExportPdf = () => {
    const pdfSummary = buildPdfSummary({ comps: normalizedComps, subjectDeal: selectedSubjectDeal });
    const blob = new Blob([pdfSummary], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "rsos-comp-summary.pdf";
    link.click();
    URL.revokeObjectURL(url);
    setExportStatus({ type: "success", message: "PDF summary exported for review." });
  };

  const handleExportExcel = () => {
    const excelPackage = buildExcelCompPackage({ comps: normalizedComps });
    const blob = new Blob([excelPackage], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "rsos-comp-package.csv";
    link.click();
    URL.revokeObjectURL(url);
    setExportStatus({ type: "success", message: "Excel comp package exported for review." });
  };

  const handleBackup = () => {
    const backup = buildCompDatabaseBackup({ comps: normalizedComps, auditLog: [] });
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "rsos-comp-database-backup.json";
    link.click();
    URL.revokeObjectURL(url);
    setExportStatus({ type: "success", message: "Comp database backup exported." });
  };

  const handleDeleteComp = async (compId) => {
    const target = comps.find((comp) => comp.id === compId);
    if (!target) return;

    try {
      const response = await fetch(buildApiUrl(`/api/comps/${compId}`), { method: "DELETE", headers: buildSessionAuthHeaders() });
      if (!response.ok) throw new Error("Unable to delete comp");
      const nextComps = comps.filter((comp) => comp.id !== compId);
      setComps(nextComps);
      if (typeof window !== "undefined") {
        window.localStorage.setItem("royalStarComps", JSON.stringify(nextComps));
      }
      setSelectedCompId("");
      setFormValues(initialValues);
      setMessage({ type: "success", text: "Comp deleted successfully." });
    } catch (error) {
      console.error("Unable to delete comp via API, using local fallback", error);
      const nextComps = comps.filter((comp) => comp.id !== compId);
      setComps(nextComps);
      if (typeof window !== "undefined") {
        window.localStorage.setItem("royalStarComps", JSON.stringify(nextComps));
      }
      setSelectedCompId("");
      setFormValues(initialValues);
      setMessage({ type: "success", text: "Comp deleted successfully." });
    }
  };

  const handleToggleInclude = (compId) => {
    const nextComps = comps.map((comp) => (comp.id === compId ? { ...comp, included: comp.included === false } : comp));
    setComps(nextComps);
    if (typeof window !== "undefined") {
      window.localStorage.setItem("royalStarComps", JSON.stringify(nextComps));
    }
  };

  const subjectFields = selectedSubjectDeal
    ? [
        ["Property", selectedSubjectDeal.propertyAddress || selectedSubjectDeal.address || "—"],
        ["City", selectedSubjectDeal.city || "—"],
        ["State", selectedSubjectDeal.state || "—"],
        ["ZIP", selectedSubjectDeal.zipCode || selectedSubjectDeal.zip || "—"],
        ["Square Feet", selectedSubjectDeal.squareFeet || "—"],
        ["Bedrooms", selectedSubjectDeal.bedrooms || "—"],
        ["Bathrooms", selectedSubjectDeal.bathrooms || "—"],
        ["Year Built", selectedSubjectDeal.yearBuilt || "—"],
      ]
    : [];

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
            <p style={styles.subtitle}>COMP DATABASE / COMPARABLE SALES</p>
          </div>
          <div style={styles.headerActions}>
            <button type="button" style={styles.secondaryButton} onClick={onOpenDealAnalyzer}>DEAL ANALYZER</button>
            <button type="button" style={styles.primaryButton} onClick={onOpenFlipAnalyzer}>FLIP ANALYZER</button>
            <button type="button" style={styles.primaryButton} onClick={onOpenBrrrrAnalyzer}>BRRRR ANALYZER</button>
            <button type="button" style={styles.primaryButton} onClick={onOpenProductVault}>PRODUCT VAULT</button>
            <button type="button" style={styles.primaryButton} onClick={onOpenDealIntake}>ADD NEW DEAL</button>
            <button type="button" style={styles.primaryButton} onClick={onOpenDealIntelligence}>DEAL INTELLIGENCE</button>
            <button type="button" style={styles.primaryButton} onClick={onOpenContractorHub}>CONTRACTOR HUB</button>
          </div>
        </section>

        <section style={styles.card}>
          <div style={styles.cardHeader}>
            <div>
              <h2 style={styles.cardTitle}>COMP DATABASE</h2>
              <p style={styles.cardSubtitle}>Track visible comparable sales, quality scores, ARV logic, and include/exclude decisions.</p>
            </div>
            <div style={styles.connectionBadge}>{connectionState} · {providerStatus.status}</div>
          </div>

          <div style={styles.summaryGrid}>
            <SummaryCard label="Total Comps" value={summaryStats.total} />
            <SummaryCard label="Included Comps" value={summaryStats.included} />
            <SummaryCard label="Average Sale Price" value={formatCurrency(summaryStats.averageSalePrice)} />
            <SummaryCard label="Average Price / Sq Ft" value={formatCurrency(summaryStats.averagePpsf)} />
            <SummaryCard label="Base ARV" value={formatCurrency(summaryStats.baseArv)} />
            <SummaryCard label="ARV Confidence" value={summaryStats.confidence} />
            <SummaryCard label="Strongest Comp" value={formatCompSummaryLabel(summaryStats.strongest)} />
            <SummaryCard label="Most Recent Sale" value={summaryStats.recent ? `${formatDate(summaryStats.recent.saleDate)} • ${formatCurrency(summaryStats.recent.salePrice)}` : "—"} />
          </div>

          <div style={styles.controlsRow}>
            <input type="text" value={searchText} onChange={(event) => setSearchText(event.target.value)} placeholder="Search address, city, ZIP, or source" style={styles.input} />
            <select value={propertyTypeFilter} onChange={(event) => setPropertyTypeFilter(event.target.value)} style={styles.select}>
              {propertyTypeOptions.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
            <select value={conditionFilter} onChange={(event) => setConditionFilter(event.target.value)} style={styles.select}>
              {conditionOptionsList.map((option) => <option key={option} value={option}>{option === "All" ? "All Conditions" : option}</option>)}
            </select>
            <select value={zipFilter} onChange={(event) => setZipFilter(event.target.value)} style={styles.select}>
              {zipCodeOptions.map((option) => <option key={option} value={option}>{option === "All" ? "All ZIPs" : option}</option>)}
            </select>
            <select value={includeFilter} onChange={(event) => setIncludeFilter(event.target.value)} style={styles.select}>
              {includedFilterOptions.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
            <select value={gradeFilter} onChange={(event) => setGradeFilter(event.target.value)} style={styles.select}>
              {gradeOptions.map((option) => <option key={option} value={option}>{option === "All" ? "All Grades" : option}</option>)}
            </select>
            <select value={sortBy} onChange={(event) => setSortBy(event.target.value)} style={styles.select}>
              {sortOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </div>

          {message.text ? <div style={message.type === "success" ? styles.successMessage : styles.errorMessage}>{message.text}</div> : null}

          <div style={styles.gridTwo}>
            <div style={styles.section}>
              <h3 style={styles.sectionTitle}>COMP FORM</h3>
              <div style={styles.formGrid}>
                <label style={styles.label}><span style={styles.fieldLabel}>Subject Deal</span><select name="subjectProperty" value={subjectDealId} onChange={(event) => setSubjectDealId(event.target.value)} style={styles.select}>{deals.length === 0 ? <option value="">No saved deals</option> : <><option value="">Select subject deal</option>{deals.map((deal) => <option key={deal.id} value={deal.id}>{deal.propertyAddress || deal.address || deal.id}</option>)}</>}</select></label>
                <label style={styles.label}><span style={styles.fieldLabel}>Comp Address</span><input type="text" name="compAddress" value={formValues.compAddress} onChange={handleFieldChange} style={styles.input} /></label>
                <label style={styles.label}><span style={styles.fieldLabel}>City</span><input type="text" name="city" value={formValues.city} onChange={handleFieldChange} style={styles.input} /></label>
                <label style={styles.label}><span style={styles.fieldLabel}>State</span><input type="text" name="state" value={formValues.state} onChange={handleFieldChange} style={styles.input} /></label>
                <label style={styles.label}><span style={styles.fieldLabel}>ZIP Code</span><input type="text" name="zipCode" value={formValues.zipCode} onChange={handleFieldChange} style={styles.input} /></label>
                <label style={styles.label}><span style={styles.fieldLabel}>Sale Price</span><input type="number" min="0" name="salePrice" value={formValues.salePrice} onChange={handleFieldChange} style={styles.input} /></label>
                <label style={styles.label}><span style={styles.fieldLabel}>Sale Date</span><input type="date" name="saleDate" value={formValues.saleDate} onChange={handleFieldChange} style={styles.input} /></label>
                <label style={styles.label}><span style={styles.fieldLabel}>List Price</span><input type="number" min="0" name="listPrice" value={formValues.listPrice} onChange={handleFieldChange} style={styles.input} /></label>
                <label style={styles.label}><span style={styles.fieldLabel}>Property Type</span><select name="propertyType" value={formValues.propertyType} onChange={handleFieldChange} style={styles.select}>{propertyTypes.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>
                <label style={styles.label}><span style={styles.fieldLabel}>Bedrooms</span><input type="number" min="0" name="bedrooms" value={formValues.bedrooms} onChange={handleFieldChange} style={styles.input} /></label>
                <label style={styles.label}><span style={styles.fieldLabel}>Bathrooms</span><input type="number" min="0" name="bathrooms" value={formValues.bathrooms} onChange={handleFieldChange} style={styles.input} /></label>
                <label style={styles.label}><span style={styles.fieldLabel}>Square Feet</span><input type="number" min="0" name="squareFeet" value={formValues.squareFeet} onChange={handleFieldChange} style={styles.input} /></label>
                <label style={styles.label}><span style={styles.fieldLabel}>Year Built</span><input type="number" min="1800" name="yearBuilt" value={formValues.yearBuilt} onChange={handleFieldChange} style={styles.input} /></label>
                <label style={styles.label}><span style={styles.fieldLabel}>Lot Size</span><input type="text" name="lotSize" value={formValues.lotSize} onChange={handleFieldChange} style={styles.input} /></label>
                <label style={styles.label}><span style={styles.fieldLabel}>Distance Miles</span><input type="number" min="0" name="distanceMiles" value={formValues.distanceMiles} onChange={handleFieldChange} style={styles.input} /></label>
                <label style={styles.label}><span style={styles.fieldLabel}>Condition</span><select name="condition" value={formValues.condition} onChange={handleFieldChange} style={styles.select}>{conditionOptions.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>
                <label style={styles.label}><span style={styles.fieldLabel}>Garage</span><input type="text" name="garage" value={formValues.garage} onChange={handleFieldChange} style={styles.input} /></label>
                <label style={styles.label}><span style={styles.fieldLabel}>Basement</span><input type="text" name="basement" value={formValues.basement} onChange={handleFieldChange} style={styles.input} /></label>
                <label style={styles.label}><span style={styles.fieldLabel}>Source</span><input type="text" name="source" value={formValues.source} onChange={handleFieldChange} style={styles.input} /></label>
                <label style={styles.label}><span style={styles.fieldLabel}>Source Link</span><input type="text" name="sourceLink" value={formValues.sourceLink} onChange={handleFieldChange} style={styles.input} /></label>
                <label style={styles.label}><span style={styles.fieldLabel}>Notes</span><textarea name="notes" value={formValues.notes} onChange={handleFieldChange} style={{ ...styles.input, minHeight: "90px" }} /></label>
                <label style={styles.label}><span style={styles.fieldLabel}>Include in ARV</span><input type="checkbox" name="included" checked={formValues.included !== false} onChange={handleFieldChange} /></label>
              </div>
              <div style={styles.formActions}>
                <button type="button" style={styles.primaryButton} onClick={handleSubmit}>{selectedCompId ? "UPDATE COMP" : "ADD COMP"}</button>
                <button type="button" style={styles.secondaryButton} onClick={handleClearForm}>CLEAR FORM</button>
              </div>

              <div style={styles.providerPanel}>
                <div style={styles.providerHeaderRow}>
                  <div style={styles.sectionTitle}>PROVIDER CONTROLS</div>
                  <div style={styles.providerStatusText}>{providerStatus.status}</div>
                </div>
                <div style={styles.formActions}>
                  <button type="button" style={styles.secondaryButton} onClick={handleProviderTest} disabled={providerSearchState.loading}>{providerSearchState.loading ? "WORKING…" : "TEST CONNECTION"}</button>
                  <button type="button" style={styles.secondaryButton} onClick={handleSubjectLookup} disabled={providerSearchState.loading}>LOOKUP SUBJECT</button>
                  <button type="button" style={styles.secondaryButton} onClick={() => handleFindSoldComps(false)} disabled={providerSearchState.loading}>FIND SOLD COMPS</button>
                  <button type="button" style={styles.secondaryButton} onClick={() => handleFindSoldComps(true)} disabled={providerSearchState.loading}>REFRESH LIVE COMPS</button>
                </div>
                <div style={styles.providerMeta}>Criteria: Tier 1 0.5 mi/6 mo/±20% sqft; then controlled expansion through Tier 4 (1.5 mi/18 mo/±30% sqft) only when fewer than 3 qualify. Same type • ±1 bed/bath • review-first.</div>
                <div style={styles.providerMeta}>{providerSearchState.summary || (providerStatus.configured ? "Ready for a safe provider lookup." : "Manual mode only until a local provider key or license is configured.")}</div>
                <div style={styles.providerMeta}>Providers: {Array.isArray(providerStatus.availableProviders) ? providerStatus.availableProviders.join(", ") : "manual"}</div>
                <div style={styles.providerMeta}>Credential readiness: {providerStatus.keyPresent ? "Local credentials detected" : "Awaiting local credentials / licensing"}</div>
                <div style={styles.providerMeta}>Media rights: {compMediaSummary.rightsStatus || "REMOTE_REFERENCE_ONLY"} • Review required: {compMediaSummary.reviewRequired ? "Yes" : "No"}</div>
                <div style={styles.providerMeta}>Media available: {compMediaSummary.mediaCount} • Primary photo: {compMediaSummary.primaryPhoto ? compMediaSummary.primaryPhoto.label || "Photo" : "None"}</div>
                <div style={styles.providerMeta}>Search session: {providerSessionSummary.latestSession?.status || "idle"} • Cache entries: {providerSessionSummary.cacheEntries || 0}</div>
                <div style={styles.providerMeta}>Provider candidates retrieved: {providerSearchCounts.providerCandidatesRetrieved}</div>
                <div style={styles.providerMeta}>Qualifying candidates returned: {providerSearchCounts.qualifyingCandidatesReturned} • Active review queue: {reviewCounts.qualifyingReviewCandidates} • Deduplicated before queue: {providerSearchCounts.deduplicatedCandidates}</div>
                <div style={styles.providerMeta}>Rejected this search: {reviewCounts.rejectedCandidates} • Persisted pending: {reviewCounts.persistedPendingComps} • Persisted approved: {reviewCounts.approvedComps} • Included in ARV: {reviewCounts.includedInArvComps}</div>
                <div style={styles.providerMeta}>Qualifying review candidates: {reviewCounts.qualifyingReviewCandidates} • Rejected this search: {reviewCounts.rejectedCandidates}</div>
                {providerSearchDiagnostics.pagesRetrieved ? <div style={styles.providerMeta}>Pages retrieved: {providerSearchDiagnostics.pagesRetrieved} • Provider records retrieved: {providerSearchDiagnostics.providerRecordsRetrieved || 0} • Normalized: {providerSearchDiagnostics.normalizedRecords || 0} • Normalization failures: {providerSearchDiagnostics.failedNormalizationRecords || 0} • Invalid sales: {providerSearchDiagnostics.invalidSaleRecords || 0} • Future sales: {providerSearchDiagnostics.futureSaleRecords || 0} • Missing distance/type: {providerSearchDiagnostics.missingDistanceRecords || 0}/{providerSearchDiagnostics.missingPropertyTypeRecords || 0} • Provider cap reached: {providerSearchDiagnostics.providerCapReached ? "Yes" : "No"}</div> : null}
                {providerSearchDiagnostics.pagesRetrieved ? <div style={styles.providerMeta}>Provider deduplicated: {providerSearchDiagnostics.deduplicatedRecords || 0} • Type/sqft/bed/bath rejections: {providerSearchDiagnostics.propertyTypeMismatches || 0}/{providerSearchDiagnostics.squareFeetRejections || 0}/{providerSearchDiagnostics.bedroomRejections || 0}/{providerSearchDiagnostics.bathroomRejections || 0} • Final review candidates: {providerSearchDiagnostics.finalReviewCandidateCount || 0}</div> : null}
                {providerSearchDiagnostics.cacheStatus ? <div style={styles.providerMeta}>Cache: {providerSearchDiagnostics.cacheStatus} • Age: {providerSearchDiagnostics.cacheAgeMs === null ? "—" : `${Math.round(providerSearchDiagnostics.cacheAgeMs / 3600000 * 10) / 10}h`} • TTL: {Math.round((providerSearchDiagnostics.cacheTtlMs || 0) / 3600000 * 10) / 10}h • Upstream requests this search: {providerSearchDiagnostics.upstreamProviderRequestsThisSearch || 0} • Avoided: {providerSearchDiagnostics.requestsAvoidedByCache || 0} • Coalesced: {providerSearchDiagnostics.requestCoalesced ? "Yes" : "No"} • Last live refresh: {providerSearchDiagnostics.lastLiveProviderRefresh || "—"}</div> : null}
                <div style={styles.providerMeta}>Upload: {selectedCompId ? "Attach a review-only photo to the selected comp" : "Select a comp before uploading"}</div>
                <div style={{ marginTop: "10px", border: `1px solid ${BORDER}`, padding: "8px", background: "#0b0b0b" }}>
                  <div style={{ color: GOLD, fontSize: "12px" }}>ACTIVE SERVER PROVIDER</div>
                  <div style={styles.providerMeta}>Active Provider: {providerStatus.provider === "rentcast" ? "RentCast" : providerStatus.provider || "Manual"}</div>
                  <div style={styles.providerMeta}>Provider Source: {providerStatus.keyPresent ? "Server Environment" : "Local / Manual"} • Connection: {providerSearchState.status === "Connected" ? "Connected" : providerStatus.status}</div>
                  <div style={styles.providerMeta}>Credential: {providerStatus.keyPresent ? "Configured securely" : "Not configured"}</div>
                  <div style={{ color: GOLD, fontSize: "12px", marginTop: "10px" }}>ADMINISTRATOR PROVIDER OVERRIDE</div>
                  <div style={{ display: "grid", gap: "8px", marginTop: "8px" }}>
                    <select name="provider" value={providerConfigForm.provider} onChange={handleProviderConfigChange} style={styles.select}>
                      <option value="manual">Manual</option>
                      <option value="rentcast">RentCast</option>
                      <option value="attom">ATTOM</option>
                      <option value="reso-mls">RESO MLS</option>
                      <option value="bridge">Bridge RESO</option>
                      <option value="county-import">County Import</option>
                    </select>
                    <input name="baseUrl" placeholder="Base URL" value={providerConfigForm.baseUrl} onChange={handleProviderConfigChange} style={styles.input} />
                    <input type="password" name="apiKey" placeholder="API Key (masked locally)" value={providerConfigForm.apiKey} onChange={handleProviderConfigChange} style={styles.input} />
                    <input name="clientId" placeholder="Client ID" value={providerConfigForm.clientId} onChange={handleProviderConfigChange} style={styles.input} />
                    <input type="password" name="clientSecret" placeholder="Client Secret" value={providerConfigForm.clientSecret} onChange={handleProviderConfigChange} style={styles.input} />
                    <input name="datasetId" placeholder="Dataset ID" value={providerConfigForm.datasetId} onChange={handleProviderConfigChange} style={styles.input} />
                    <select name="mediaRights" value={providerConfigForm.mediaRights} onChange={handleProviderConfigChange} style={styles.select}>
                      <option value="REMOTE_REFERENCE_ONLY">Remote Reference Only</option>
                      <option value="THUMBNAIL_CACHE_ONLY">Thumbnail Cache Only</option>
                      <option value="LOCAL_STORAGE_ALLOWED">Local Storage Allowed</option>
                    </select>
                  </div>
                  <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginTop: "8px" }}>
                    <button type="button" style={styles.secondaryButton} onClick={() => handleProviderAction("save")}>Configure Provider</button>
                    <button type="button" style={styles.secondaryButton} onClick={() => handleProviderAction("test")}>Test Connection</button>
                    <button type="button" style={styles.secondaryButton} onClick={() => handleProviderAction("activate")}>Activate Provider</button>
                    <button type="button" style={styles.secondaryButton} onClick={() => handleProviderAction("deactivate")}>Deactivate Provider</button>
                    <button type="button" style={styles.secondaryButton} onClick={() => handleProviderAction("rotate")}>Rotate Credential</button>
                    <button type="button" style={styles.secondaryButton} onClick={() => handleProviderAction("remove")}>Remove Credential</button>
                  </div>
                  <div style={styles.providerMeta}>Override Status: {providerOnboardingState.status} • Override Active: {providerOnboardingState.active ? "Yes" : "No"}</div>
                  <div style={styles.providerMeta}>Override Credential: {providerOnboardingState.maskedCredentialStatus?.configured ? "Configured securely" : "Not configured"}</div>
                </div>
                <label style={styles.label}><span style={styles.fieldLabel}>Upload Property Photo</span><input type="file" accept="image/*" onChange={handlePhotoUpload} style={styles.input} /></label>
                {photoUploadState.summary ? <div style={styles.providerMeta}>{photoUploadState.summary}</div> : null}
                {photoUploadState.error ? <div style={styles.errorMessage}>{photoUploadState.error}</div> : null}
                {providerSearchState.error ? <div style={styles.errorMessage}>{providerSearchState.error}</div> : null}
              </div>
            </div>

            <div style={styles.section}>
              <h3 style={styles.sectionTitle}>SUBJECT PROPERTY</h3>
              {selectedSubjectDeal ? (
                <div>
                  <div style={styles.summaryLabel}>Selected subject property</div>
                  <div style={styles.summaryValue}>{selectedSubjectDeal.propertyAddress || selectedSubjectDeal.address || "Selected deal"}</div>
                  {subjectFields.map(([label, value]) => <div key={label} style={styles.detailRow}><span>{label}</span><span>{value}</span></div>)}
                </div>
              ) : (
                <div style={styles.emptyState}>Select a saved deal to prefill subject-property fields.</div>
              )}

              <div style={{ marginTop: "12px" }}>
                <h4 style={styles.sectionTitle}>ARV ANALYSIS</h4>
                <div style={styles.summaryGrid}>
                  <SummaryCard label="Average Sale Price" value={formatCurrency(summaryStats.averageSalePrice)} />
                  <SummaryCard label="Median Sale Price" value={formatCurrency(summaryStats.medianSalePrice)} />
                  <SummaryCard label="Average Price / Sq Ft" value={formatCurrency(summaryStats.averagePpsf)} />
                  <SummaryCard label="Median Price / Sq Ft" value={formatCurrency(summaryStats.medianPpsf)} />
                  <SummaryCard label="Low ARV" value={formatCurrency(summaryStats.recommendation?.conservative || 0)} />
                  <SummaryCard label="Base ARV" value={formatCurrency(summaryStats.recommendation?.base || 0)} />
                  <SummaryCard label="High ARV" value={formatCurrency(summaryStats.recommendation?.aggressive || 0)} />
                </div>
                <div style={styles.recommendationBox}>
                  <div style={styles.summaryValue}>{formatCurrency(summaryStats.recommendation?.recommended || 0)}</div>
                  <div style={styles.summaryLabel}>{summaryStats.recommendation?.explanation || "No recommendation yet."}</div>
                </div>

                <div style={{ ...styles.recommendationBox, marginTop: "10px" }}>
                  <div style={styles.summaryValue}>VALUATION REVIEW PANEL</div>
                  <div style={styles.summaryLabel}>Advisory confidence: {valuationUiModel.confidenceLabel} • Score {valuationUiModel.confidenceScore}</div>
                  <div style={styles.summaryLabel}>Pending imports: {valuationUiModel.pendingImports.length} • Similarity badge: {selectedCompReview ? getSimilarityBadge(selectedCompReview.approvedComps[0]?.qualityScore || selectedComp?.qualityScore).label : "Pending"}</div>
                  <div style={styles.summaryLabel}>{valuationUiModel.summary.advisoryNote}</div>
                  <div style={styles.summaryGrid}>
                    <SummaryCard label="Recommended Range" value={valuationUiModel.summary.recommendedRange} />
                    <SummaryCard label="Likely ARV" value={formatCurrency(valuationUiModel.likelyArv)} />
                    <SummaryCard label="Approved Comps" value={valuationUiModel.approvedComps.length} />
                    <SummaryCard label="Provider Review Queue" value={reviewCounts.qualifyingReviewCandidates} />
                    <SummaryCard label="Persisted Pending" value={reviewCounts.persistedPendingComps} />
                    <SummaryCard label="Persisted Approved" value={reviewCounts.approvedComps} />
                    <SummaryCard label="Included in ARV" value={reviewCounts.includedInArvComps} />
                  </div>
                  <div style={{ display: "grid", gap: "8px", marginTop: "8px" }}>
                    {valuationUiModel.methods.map((method) => (
                      <div key={method.method} style={{ border: `1px solid ${BORDER}`, padding: "8px", background: "#0d0d0d" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", gap: "8px", alignItems: "center" }}>
                          <span style={{ color: GOLD, fontSize: "12px" }}>{method.method}</span>
                          <span style={{ color: GOLD, fontSize: "12px" }}>{formatCurrency(method.result)}</span>
                        </div>
                        <div style={{ fontSize: "11px", color: "#f9e27b", marginTop: "4px" }}>Confidence: {(method.confidence * 100).toFixed(0)}%</div>
                      </div>
                    ))}
                  </div>
                </div>

                <div style={{ ...styles.gridTwo, marginTop: "10px" }}>
                  <div style={styles.section}>
                    <h5 style={styles.sectionTitle}>APPROVED / READY</h5>
                    {valuationUiModel.approvedComps.length === 0 ? (
                      <div style={styles.summaryLabel}>No approved comps are ready for advisory valuation.</div>
                    ) : (
                      valuationUiModel.approvedComps.map((comp) => (
                        <div key={comp.id} style={{ border: `1px solid ${BORDER}`, padding: "8px", marginBottom: "8px", background: "#0b0b0b" }}>
                          <div style={{ color: GOLD, fontSize: "12px" }}>{comp.compAddress || comp.address || "Comp"}</div>
                          <div style={styles.summaryLabel}>Score {comp.qualityScore || 0}/100 • {comp.inclusionStatus || "approved"}</div>
                        </div>
                      ))
                    )}
                  </div>
                  <div style={styles.section}>
                    <h5 style={styles.sectionTitle}>REVIEW QUEUE / REJECTED</h5>
                    {providerCandidates.length === 0 && valuationUiModel.reviewQueue.length === 0 && valuationUiModel.rejectedComps.length === 0 && rejectedProviderCandidates.length === 0 ? (
                      <div style={styles.summaryLabel}>No review queue items.</div>
                    ) : (
                      <>
                        {providerCandidates.map((candidate) => (
                          <div key={`provider-review-${candidate.id}`} style={{ border: `1px solid ${GOLD}`, padding: "8px", marginBottom: "8px", background: "rgba(242,197,0,0.06)" }}>
                            <div style={{ color: GOLD, fontSize: "12px" }}>{candidate.compAddress || candidate.address || "Provider candidate"}</div>
                            <div style={styles.summaryLabel}>{candidate.city}, {candidate.state} {candidate.zipCode} • {formatCurrency(Number(candidate.salePrice))} • Sold {formatDate(candidate.saleDate)}</div>
                            <div style={styles.summaryLabel}>{candidate.searchTierLabel || `Tier ${candidate.searchTier || "—"}`} • Similarity {Number(candidate.similarityScore || 0).toFixed(1)} • {candidate.distanceMiles === "" ? "Distance unavailable" : `${candidate.distanceMiles} mi`}</div>
                            <div style={styles.summaryLabel}>{candidate.squareFeet || "—"} sq ft • {candidate.bedrooms || "—"} bd • {candidate.bathrooms || "—"} ba • {candidate.propertyType || "—"}</div>
                            <div style={styles.summaryLabel}>Sale age: {candidate.saleAgeDays ?? "—"} days / {candidate.saleAgeMonths ?? "—"} months • Sqft variance: {candidate.squareFeetVariancePercentage ?? "—"}% • Bed variance: {candidate.bedroomVariance ?? "—"} • Bath variance: {candidate.bathroomVariance ?? "—"}</div>
                            <div style={styles.summaryLabel}>Provider: {candidate.provider || candidate.source || "Provider"} • ID: {candidate.providerRecordId || candidate.id}</div>
                            <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginTop: "8px" }}>
                              <button type="button" style={styles.tableButton} onClick={() => handleReviewProviderCandidate(candidate)}>REVIEW / VIEW</button>
                              <button type="button" style={styles.tableButton} disabled={providerImportState.status === "importing"} onClick={() => handleApproveProviderCandidate(candidate)}>{providerImportState.status === "importing" && providerImportState.candidateId === candidate.id ? "IMPORTING…" : "APPROVE / IMPORT"}</button>
                              <button type="button" style={styles.tableButton} disabled={providerImportState.status === "importing"} onClick={() => handleRejectProviderCandidate(candidate)}>REJECT</button>
                            </div>
                          </div>
                        ))}
                        {valuationUiModel.reviewQueue.map((comp) => (
                          <div key={`review-${comp.id}`} style={{ border: `1px solid ${BORDER}`, padding: "8px", marginBottom: "8px", background: "#0b0b0b" }}>
                            <div style={{ color: GOLD, fontSize: "12px" }}>{comp.compAddress || comp.address || "Comp"}</div>
                            <div style={styles.summaryLabel}>Review required • {comp.inclusionStatus || "pending"}</div>
                          </div>
                        ))}
                        {valuationUiModel.rejectedComps.map((comp) => (
                          <div key={`reject-${comp.id}`} style={{ border: `1px solid #ff6b6b`, padding: "8px", marginBottom: "8px", background: "rgba(255,107,107,0.08)" }}>
                            <div style={{ color: GOLD, fontSize: "12px" }}>{comp.compAddress || comp.address || "Comp"}</div>
                            <div style={{ color: "#ff6b6b", fontSize: "11px" }}>Rejected / excluded from advisory set</div>
                          </div>
                        ))}
                        {rejectedProviderCandidates.map((comp) => (
                          <div key={`provider-reject-${comp.id}`} style={{ border: `1px solid #ff6b6b`, padding: "8px", marginBottom: "8px", background: "rgba(255,107,107,0.08)" }}>
                            <div style={{ color: GOLD, fontSize: "12px" }}>{comp.compAddress || comp.address || "Provider candidate"}</div>
                            <div style={{ color: "#ff6b6b", fontSize: "11px" }}>Rejected from temporary review • not persisted</div>
                          </div>
                        ))}
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div style={{ ...styles.section, marginTop: "12px" }}>
            <h3 style={styles.sectionTitle}>ENTERPRISE DIAGNOSTICS & EXPORTS</h3>
            <div style={styles.summaryGrid}>
              <SummaryCard label="Providers" value={enterpriseDiagnostics?.providerHealth?.metrics?.length || 0} />
              <SummaryCard label="Imported Records" value={enterpriseDiagnostics?.importedCount || 0} />
              <SummaryCard label="Pending Review" value={enterpriseDiagnostics?.pendingReviewCount || 0} />
              <SummaryCard label="Duplicate Groups" value={enterpriseDiagnostics?.duplicates?.length || 0} />
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginTop: "8px" }}>
              <button type="button" style={styles.secondaryButton} onClick={handleExportPackage}>EXPORT COMPARABLE PACKAGE</button>
              <button type="button" style={styles.secondaryButton} onClick={handleExportAppraisalPackage}>EXPORT APPRAISAL PACKAGE</button>
              <button type="button" style={styles.secondaryButton} onClick={handleExportPdf}>EXPORT PDF SUMMARY</button>
              <button type="button" style={styles.secondaryButton} onClick={handleExportExcel}>EXPORT EXCEL PACKAGE</button>
              <button type="button" style={styles.secondaryButton} onClick={handleBackup}>BACKUP COMP DB</button>
            </div>
            {exportStatus.message ? <div style={exportStatus.type === "success" ? styles.successMessage : styles.errorMessage}>{exportStatus.message}</div> : null}
            <div style={{ display: "grid", gap: "8px", marginTop: "10px" }}>
              {enterpriseDiagnostics?.providerHealth?.metrics?.map((metric) => (
                <div key={metric.provider} style={{ border: `1px solid ${BORDER}`, padding: "8px", background: "#0b0b0b" }}>
                  <div style={{ color: GOLD, fontSize: "12px" }}>{metric.provider}</div>
                  <div style={styles.summaryLabel}>Status: {metric.status} • Latency: {metric.latencyMs}ms • Coverage: {(metric.coverage * 100).toFixed(0)}%</div>
                </div>
              ))}
            </div>
            <div style={{ marginTop: "10px", border: `1px solid ${BORDER}`, padding: "8px", background: "#0b0b0b" }}>
              <div style={{ color: GOLD, fontSize: "12px" }}>REVIEW-FIRST STATUS</div>
              <div style={styles.summaryLabel}>{providerStatus.configured ? `${providerStatus.provider === "rentcast" ? "RentCast" : providerStatus.provider} is active. Provider results remain pending review and do not alter approved ARVs until explicitly imported and included.` : "No live provider is configured. Manual imports remain review-first."}</div>
            </div>
            <div style={{ display: "grid", gap: "8px", marginTop: "10px" }}>
              <div style={{ border: `1px solid ${BORDER}`, padding: "8px", background: "#0b0b0b" }}>
                <div style={{ color: GOLD, fontSize: "12px" }}>AUDIT LOG</div>
                {enterpriseDiagnostics?.auditEntries?.slice(0, 4).map((entry) => (
                  <div key={entry.id} style={{ ...styles.summaryLabel, marginTop: "6px" }}>{entry.summary} • {entry.reviewStatus}</div>
                ))}
              </div>
              <div style={{ border: `1px solid ${BORDER}`, padding: "8px", background: "#0b0b0b" }}>
                <div style={{ color: GOLD, fontSize: "12px" }}>IMPORT HISTORY</div>
                {enterpriseDiagnostics?.importHistory?.slice(0, 4).map((entry) => (
                  <div key={entry.id} style={{ ...styles.summaryLabel, marginTop: "6px" }}>{entry.address} • {entry.provider} • {entry.reviewStatus}</div>
                ))}
              </div>
            </div>
          </div>

          <div style={styles.section}>
            <h3 style={styles.sectionTitle}>PHASE 6 OPERATIONS CONTROLS</h3>
            {opsMessage.text ? <div style={opsMessage.type === "success" ? styles.successMessage : styles.errorMessage}>{opsMessage.text}</div> : null}
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: "10px" }}>
              <button type="button" style={styles.secondaryButton} onClick={handleSaveOpsTemplate}>SAVE TEMPLATE</button>
              <button type="button" style={styles.secondaryButton} onClick={handleRecordOpsSearch}>RECORD OPERATIONS AUDIT</button>
              <button type="button" style={styles.secondaryButton} onClick={handleLifecycleTransition}>APPLY LIFECYCLE</button>
              <button type="button" style={styles.secondaryButton} onClick={handleBulkReview}>BULK REVIEW</button>
            </div>
            <div style={styles.summaryGrid}>
              <SummaryCard label="Templates" value={opsTemplates.length} />
              <SummaryCard label="Provider Search History" value={providerSearchHistory.length} />
              <SummaryCard label="Freshness" value={opsFreshness?.status || "Unknown"} />
              <SummaryCard label="Provider Data Freshness" value={providerFreshness?.status || "Unknown"} />
              <SummaryCard label="Readiness" value={opsReadiness?.status || "Not Ready"} />
            </div>
            <div style={{ display: "grid", gap: "8px" }}>
              <div style={{ border: `1px solid ${BORDER}`, padding: "8px", background: "#0b0b0b" }}>
                <div style={{ color: GOLD, fontSize: "12px" }}>TEMPLATES</div>
                {opsTemplates.slice(0, 3).map((template) => <div key={template.id} style={{ ...styles.summaryLabel, marginTop: "6px" }}>{template.name}</div>)}
              </div>
              <div style={{ border: `1px solid ${BORDER}`, padding: "8px", background: "#0b0b0b" }}>
                <div style={{ color: GOLD, fontSize: "12px" }}>RECENT PROVIDER SEARCHES</div>
                {providerSearchHistory.slice(-3).reverse().map((entry, index) => <div key={entry.id || `${entry.timestamp}-${index}`} style={{ ...styles.summaryLabel, marginTop: "6px" }}>
                  {entry.query?.address || entry.query?.subjectProperty || "Search"} • {entry.query?.provider || entry.provider || "Provider"} • {entry.timestamp ? new Date(entry.timestamp).toLocaleString() : "Unknown time"} • {entry.diagnostics?.cacheStatus || entry.cacheStatus || "Cache status unavailable"} • {entry.resultCount ?? "—"} qualifying
                </div>)}
                {providerSearchHistory.length === 0 ? <div style={{ ...styles.summaryLabel, marginTop: "6px" }}>No provider searches recorded.</div> : null}
              </div>
              <div style={{ border: `1px solid ${BORDER}`, padding: "8px", background: "#0b0b0b" }}>
                <div style={{ color: GOLD, fontSize: "12px" }}>PROVIDER SEARCH / CACHE</div>
                <div style={styles.summaryLabel}>Cache status: {providerCacheDiagnostics.cacheStatus || "Unavailable"} • Age: {providerCacheDiagnostics.cacheAgeMs == null ? "—" : `${Math.round(providerCacheDiagnostics.cacheAgeMs / 3600000 * 10) / 10}h`} • TTL: {providerCacheDiagnostics.cacheTtlMs ? `${Math.round(providerCacheDiagnostics.cacheTtlMs / 3600000 * 10) / 10}h` : "—"}</div>
                <div style={styles.summaryLabel}>Upstream requests: {providerCacheDiagnostics.upstreamProviderRequestsThisSearch ?? "—"} • Avoided: {providerCacheDiagnostics.requestsAvoidedByCache ?? "—"} • Coalesced: {providerCacheDiagnostics.requestCoalesced ? "Yes" : "No"}</div>
                <div style={styles.summaryLabel}>Last live refresh: {providerCacheDiagnostics.lastLiveProviderRefresh || "—"} • Stale cache available: {providerCacheDiagnostics.staleCacheAvailable ? "Yes" : "No"}</div>
                <div style={styles.summaryLabel}>Pages: {providerCacheDiagnostics.pagesRetrieved ?? "—"} • Provider records: {providerCacheDiagnostics.providerRecordsRetrieved ?? "—"} • Provider cap reached: {providerCacheDiagnostics.providerCapReached ? "Yes" : "No"}</div>
              </div>
              <div style={{ border: `1px solid ${BORDER}`, padding: "8px", background: "#0b0b0b" }}>
                <div style={{ color: GOLD, fontSize: "12px" }}>OPERATIONS DIAGNOSTICS</div>
                <div style={styles.summaryLabel}>Manual mode: {opsDiagnostics?.manualMode ? "Active" : "Inactive"} • Queue: {opsDiagnostics?.refreshQueueStatus || "Disabled"} • Redacted: {opsDiagnostics?.redacted ? "Yes" : "No"}</div>
              </div>
            </div>
          </div>

          <div style={styles.section}>
            <h3 style={styles.sectionTitle}>COMPARABLE SALES</h3>
            {filteredComps.length === 0 ? (
              <div style={styles.emptyState}>
                No comparable sales available.
                <div style={{ marginTop: "8px" }}><button type="button" style={styles.primaryButton} onClick={handleClearForm}>Add Comp</button></div>
              </div>
            ) : (
              <div style={styles.tableWrap}>
                <table style={styles.table}>
                  <thead>
                    <tr>
                      <th style={styles.th}>Include</th>
                      <th style={styles.th}>Address</th>
                      <th style={styles.th}>Sale Price</th>
                      <th style={styles.th}>Sale Date</th>
                      <th style={styles.th}>Distance</th>
                      <th style={styles.th}>Beds</th>
                      <th style={styles.th}>Baths</th>
                      <th style={styles.th}>Sq Ft</th>
                      <th style={styles.th}>Price / Sq Ft</th>
                      <th style={styles.th}>Year Built</th>
                      <th style={styles.th}>Condition</th>
                      <th style={styles.th}>Quality</th>
                      <th style={styles.th}>Grade</th>
                      <th style={styles.th}>Link</th>
                      <th style={styles.th}>View</th>
                      <th style={styles.th}>Edit</th>
                      <th style={styles.th}>Delete</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredComps.map((comp) => (
                      <tr key={comp.id}>
                        <td style={styles.td}><input type="checkbox" checked={comp.included !== false} onChange={() => handleToggleInclude(comp.id)} /></td>
                        <td style={styles.td}>
                          <div>{formatCompAddress(comp.compAddress || comp.address || comp.propertyAddress)}</div>
                          <div style={{ fontSize: "11px", color: getSimilarityBadge(comp.qualityScore).tone, marginTop: "3px" }}>{getSimilarityBadge(comp.qualityScore).label}</div>
                          {getWarningBadges(comp).length > 0 ? <div style={{ fontSize: "10px", color: "#ff6b6b", marginTop: "3px" }}>{getWarningBadges(comp).join(" • ")}</div> : null}
                        </td>
                        <td style={styles.td}>{formatCurrency(comp.salePrice)}</td>
                        <td style={styles.td}>{formatDate(comp.saleDate)}</td>
                        <td style={styles.td}>{comp.distanceMiles ? `${comp.distanceMiles} mi` : "—"}</td>
                        <td style={styles.td}>{comp.bedrooms || "—"}</td>
                        <td style={styles.td}>{comp.bathrooms || "—"}</td>
                        <td style={styles.td}>{comp.squareFeet || "—"}</td>
                        <td style={styles.td}>{formatCurrency(comp.pricePerSqft)}</td>
                        <td style={styles.td}>{comp.yearBuilt || "—"}</td>
                        <td style={styles.td}>{comp.condition}</td>
                        <td style={styles.td}>{comp.qualityScore.toFixed(1)}</td>
                        <td style={styles.td}>{comp.grade}</td>
                        <td style={styles.td}>{comp.sourceLink ? <a href={comp.sourceLink} target="_blank" rel="noreferrer" style={{ color: GOLD }}>Open</a> : "No Link"}</td>
                        <td style={styles.td}><button type="button" style={styles.tableButton} onClick={() => handleSelectComp(comp)}>View</button></td>
                        <td style={styles.td}><button type="button" style={styles.tableButton} onClick={() => handleSelectComp(comp)}>Edit</button></td>
                        <td style={styles.td}><button type="button" style={styles.tableButton} onClick={() => handleDeleteComp(comp.id)}>Delete</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {selectedComp ? (
            <div style={styles.section}>
              <h3 style={styles.sectionTitle}>DETAIL PANEL</h3>
              <div style={styles.summaryGrid}>
                <SummaryCard label="Address" value={formatCompAddress(selectedComp.compAddress || selectedComp.address || selectedComp.propertyAddress)} />
                <SummaryCard label="Sale Price" value={formatCurrency(selectedComp.salePrice)} />
                <SummaryCard label="Price / Sq Ft" value={formatCurrency(selectedComp.pricePerSqft)} />
                <SummaryCard label="Quality Score" value={`${selectedComp.qualityScore.toFixed(1)}/100`} />
                <SummaryCard label="Grade" value={selectedComp.grade} />
                <SummaryCard label="Status" value={selectedComp.included === false ? "Excluded" : "Included"} />
              </div>
              <div style={styles.recommendationBox}>
                <div style={styles.summaryValue}>{selectedComp.grade}</div>
                <div style={styles.summaryLabel}>Quality score explanation: Recency, distance, size similarity, year-built similarity, and condition similarity drove the score.</div>
                <div style={{ marginTop: "8px", display: "flex", flexWrap: "wrap", gap: "8px" }}>
                  <span style={{ border: `1px solid ${getSimilarityBadge(selectedComp.qualityScore).tone}`, color: getSimilarityBadge(selectedComp.qualityScore).tone, padding: "4px 8px", fontSize: "11px" }}>{getSimilarityBadge(selectedComp.qualityScore).label}</span>
                  {getWarningBadges(selectedComp).map((badge) => (
                    <span key={badge} style={{ border: "1px solid #ff6b6b", color: "#ff6b6b", padding: "4px 8px", fontSize: "11px" }}>{badge}</span>
                  ))}
                </div>
              </div>
              <div style={{ ...styles.recommendationBox, marginTop: "10px" }}>
                <div style={styles.summaryValue}>PROVIDER & MEDIA REVIEW</div>
                <div style={styles.summaryLabel}>Provider: {selectedComp.provider || "manual"} • Source: {selectedComp.source || "Manual entry"}</div>
                <div style={styles.summaryLabel}>Review state: {selectedComp.verified ? "Verified" : selectedComp.inclusionStatus || "Pending Review"} • Media rights: {selectedComp.mediaRightsStatus || "REMOTE_REFERENCE_ONLY"}</div>
                <div style={styles.summaryLabel}>Duplicate sources: {selectedComp.duplicateSourceCount ? `${selectedComp.duplicateSourceCount}` : "0"} • Photo count: {compMediaSummary.mediaCount} • Primary photo: {compMediaSummary.primaryPhoto ? compMediaSummary.primaryPhoto.label || "Photo" : "None"}</div>
                <div style={styles.summaryLabel}>Attribution: {selectedComp.attributionRequired ? "Required" : "Not required"} • Restricted: {selectedComp.mediaRestricted ? "Yes" : "No"} • Expired: {selectedComp.mediaExpired ? "Yes" : "No"}</div>
                <div style={styles.summaryLabel}>Export-permitted media: {exportPermittedMedia.length}</div>
              </div>
              <div style={{ ...styles.recommendationBox, marginTop: "10px" }}>
                <div style={styles.summaryValue}>PHOTO GALLERY</div>
                {compMediaSummary.mediaCount > 0 ? (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "8px", marginTop: "8px" }}>
                    {(Array.isArray(selectedComp.media) ? selectedComp.media : []).map((item) => (
                      <div key={item.id} style={{ border: `1px solid ${GOLD}`, padding: "6px", background: "rgba(242,197,0,0.08)" }}>
                        {item.url ? <img src={item.url} alt={item.label || "Photo"} style={{ width: "100%", height: "90px", objectFit: "cover", display: "block" }} /> : null}
                        <div style={{ fontSize: "12px", color: GOLD, marginTop: "6px" }}>{item.label || "Photo"}</div>
                        <div style={{ fontSize: "11px", color: "#d8d8d8" }}>{item.sourceType === "manual" ? "User upload" : "Provider reference"}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={styles.summaryLabel}>No approved photos are attached yet. Upload a review-only photo to attach it to the selected comp.</div>
                )}
              </div>
              <div style={styles.gridTwo}>
                <div>
                  <h4 style={styles.sectionTitle}>COMPARISON AGAINST SUBJECT</h4>
                  <div style={styles.detailRow}><span>Price Difference</span><span>{selectedComp.priceDifference !== null ? formatCurrency(selectedComp.priceDifference) : "—"}</span></div>
                  <div style={styles.detailRow}><span>Square-Footage Difference</span><span>{selectedComp.sqFtDifference !== null ? `${selectedComp.sqFtDifference} sq ft` : "—"}</span></div>
                  <div style={styles.detailRow}><span>Bedroom Difference</span><span>{selectedComp.bedroomDifference !== null ? selectedComp.bedroomDifference : "—"}</span></div>
                  <div style={styles.detailRow}><span>Bathroom Difference</span><span>{selectedComp.bathroomDifference !== null ? selectedComp.bathroomDifference : "—"}</span></div>
                  <div style={styles.detailRow}><span>Age Difference</span><span>{selectedComp.ageDifference !== null ? `${selectedComp.ageDifference} years` : "—"}</span></div>
                  <div style={styles.detailRow}><span>Distance Adjustment</span><span>{selectedComp.distanceMiles ? (selectedComp.distanceMiles <= 3 ? "Close" : selectedComp.distanceMiles <= 8 ? "Moderate" : "High") : "—"}</span></div>
                  <div style={styles.detailRow}><span>Condition Adjustment</span><span>{selectedComp.condition || "—"}</span></div>
                </div>
                <div>
                  <h4 style={styles.sectionTitle}>STRENGTHS / WEAKNESSES</h4>
                  <div style={styles.warningList}>
                    <div style={styles.warning}>Strengths: strong recency and fit to the selected subject property.</div>
                    <div style={styles.warning}>Weaknesses: large distance or condition difference may require an adjustment.</div>
                    {selectedOutlier?.saleOutlier || selectedOutlier?.ppsfOutlier ? <div style={styles.warning}>Outlier warning: this comp is outside the typical price or price-per-square-foot range.</div> : null}
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </section>
      </main>
      {selectedProviderCandidate && typeof document !== "undefined" ? createPortal((
        <div style={styles.reviewOverlay} role="dialog" aria-modal="true" aria-labelledby="provider-candidate-review-title" onMouseDown={(event) => { if (event.target === event.currentTarget) handleCloseProviderCandidateReview(); }}>
          <div ref={(node) => { if (node) providerReviewTraceRef.current = { ...providerReviewTraceRef.current, modalMounted: true }; }} style={styles.reviewDialog} onMouseDown={(event) => event.stopPropagation()} data-review-candidate-key={selectedProviderCandidate.reviewCandidateKey || getProviderReviewCandidateKey(selectedProviderCandidate)} data-review-mounted="true">
            <div style={styles.reviewHeader}>
              <div>
                <h2 id="provider-candidate-review-title" style={styles.reviewTitle}>PROVIDER CANDIDATE REVIEW</h2>
                <div style={styles.reviewPending}>NOT YET APPROVED • NOT INCLUDED IN ARV</div>
              </div>
              <button ref={providerReviewCloseButtonRef} type="button" style={styles.tableButton} onClick={handleCloseProviderCandidateReview}>CLOSE / BACK WITHOUT CHANGES</button>
            </div>
            <div style={styles.reviewGrid}>
              <div style={styles.detailRow}><span>Property</span><span>{selectedProviderCandidate.compAddress || selectedProviderCandidate.address || "—"}</span></div>
              <div style={styles.detailRow}><span>Location</span><span>{selectedProviderCandidate.city || "—"}, {selectedProviderCandidate.state || "—"} {selectedProviderCandidate.zipCode || ""}</span></div>
              <div style={styles.detailRow}><span>Sale Price</span><span>{selectedProviderCandidate.salePrice === "" ? "—" : formatCurrency(Number(selectedProviderCandidate.salePrice))}</span></div>
              <div style={styles.detailRow}><span>Sale Date</span><span>{selectedProviderCandidate.saleDate ? formatDate(selectedProviderCandidate.saleDate) : "—"}</span></div>
              <div style={styles.detailRow}><span>Distance</span><span>{selectedProviderCandidate.distanceMiles === "" ? "—" : `${selectedProviderCandidate.distanceMiles} mi`}</span></div>
              <div style={styles.detailRow}><span>Property Type</span><span>{selectedProviderCandidate.propertyType || "—"}</span></div>
              <div style={styles.detailRow}><span>Square Feet</span><span>{selectedProviderCandidate.squareFeet || "—"}</span></div>
              <div style={styles.detailRow}><span>Bedrooms / Bathrooms</span><span>{selectedProviderCandidate.bedrooms ?? "—"} / {selectedProviderCandidate.bathrooms ?? "—"}</span></div>
              <div style={styles.detailRow}><span>Year Built</span><span>{selectedProviderCandidate.yearBuilt || "—"}</span></div>
              <div style={styles.detailRow}><span>Search Tier</span><span>{selectedProviderCandidate.searchTierLabel || `Tier ${selectedProviderCandidate.searchTier || "—"}`}</span></div>
              <div style={styles.detailRow}><span>Similarity Score</span><span>{Number(selectedProviderCandidate.similarityScore || 0).toFixed(1)}</span></div>
              <div style={styles.detailRow}><span>Square-Foot Variance</span><span>{selectedProviderCandidate.squareFeetVariancePercentage ?? "—"}%</span></div>
              <div style={styles.detailRow}><span>Bedroom / Bathroom Variance</span><span>{selectedProviderCandidate.bedroomVariance ?? "—"} / {selectedProviderCandidate.bathroomVariance ?? "—"}</span></div>
              <div style={styles.detailRow}><span>Sale Age / Recency</span><span>{selectedProviderCandidate.saleAgeDays ?? "—"} days / {selectedProviderCandidate.saleAgeMonths ?? "—"} months</span></div>
              <div style={styles.detailRow}><span>Provider</span><span>{selectedProviderCandidate.provider || selectedProviderCandidate.source || "Provider"}</span></div>
              <div style={styles.detailRow}><span>Provider / Property ID</span><span>{selectedProviderCandidate.providerRecordId || selectedProviderCandidate.id || "—"}</span></div>
            </div>
            <div style={styles.reviewEvidence}>
              <div style={styles.fieldLabel}>QUALIFICATION / ACCEPTANCE REASONS</div>
              <div style={styles.providerMeta}>{(selectedProviderCandidate.acceptanceReasons || []).join(" • ") || "Meets the selected Royal Star tier criteria."}</div>
            </div>
            <div style={styles.reviewWarning}>
              Evidence quality: {selectedProviderCandidate.searchTier === 1 ? "Preferred Tier 1 evidence." : `Expanded Tier ${selectedProviderCandidate.searchTier || "—"} evidence is weaker than preferred Tier 1 evidence and remains subject to the existing confidence cap.`}
            </div>
            <div style={styles.reviewEvidence}>
              <div style={styles.fieldLabel}>PHOTO / MEDIA REFERENCE</div>
              <div style={styles.providerMeta}>{selectedProviderMedia ? (selectedProviderMedia.label || selectedProviderMedia.url || selectedProviderMedia.sourceUrl || selectedProviderMedia.referenceUrl) : "No provider-permitted media reference available."}</div>
              {!selectedProviderMedia && selectedProviderCandidate.mediaAvailability?.reason ? <div style={styles.reviewWarning}>{selectedProviderCandidate.mediaAvailability.reason}</div> : null}
            </div>
            <div style={styles.reviewEvidence}>
              <div style={styles.fieldLabel}>COMP VERIFICATION / EVIDENCE ENGINE</div>
              {providerEvidenceState.status === "idle" ? <div style={styles.providerMeta}>Run verification to collect cached public-record, transfer, tax, listing, condition, rights-safe media, provenance, and discrepancy evidence. Results are advisory and never auto-approve a comp.</div> : null}
              {providerEvidenceState.status === "loading" ? <div style={styles.providerMeta}>Collecting authorized evidence…</div> : null}
              {providerEvidenceState.error ? <div style={styles.errorMessage}>{providerEvidenceState.error}</div> : null}
              {providerEvidenceState.report ? (
                <div style={styles.warningList}>
                  <div style={styles.providerMeta}>Verified Comp Score: {providerEvidenceState.report.verifiedCompScore}/100 • Recommendation: {providerEvidenceState.report.recommendation} • {providerEvidenceState.report.cached ? "Cached evidence" : "Fresh evidence"}</div>
                  <div style={styles.providerMeta}>Coverage: {Object.entries(providerEvidenceState.report.coverage || {}).filter(([, value]) => value).map(([key]) => key).join(" • ") || "No verified coverage"}</div>
                  <div style={styles.providerMeta}>Arm's-length review: {providerEvidenceState.report.armLengthAssessment?.status || "UNKNOWN"} • Discrepancies: {(providerEvidenceState.report.discrepancies || []).length} • Provenance records: {(providerEvidenceState.report.provenance || []).length}</div>
                  <div style={styles.providerMeta}>Rights-safe media references: {(providerEvidenceState.report.media || []).length} • Local provider-image storage: {providerEvidenceState.report.rightsSummary?.locallyStored || 0}</div>
                  {(providerEvidenceState.report.recommendationReasons || []).map((reason) => <div key={reason} style={styles.warning}>{reason}</div>)}
                </div>
              ) : null}
              <button type="button" style={styles.tableButton} disabled={providerEvidenceState.status === "loading"} onClick={() => handleVerifyProviderCandidate(selectedProviderCandidate, providerEvidenceState.status === "complete")}>{providerEvidenceState.status === "complete" ? "REFRESH EVIDENCE" : "VERIFY EVIDENCE"}</button>
            </div>
            <div style={styles.reviewActions}>
              <button type="button" style={styles.primaryButton} disabled={providerImportState.status === "importing"} onClick={() => handleApproveProviderCandidate(selectedProviderCandidate)}>{providerImportState.status === "importing" && providerImportState.candidateId === selectedProviderCandidate.id ? "IMPORTING…" : "APPROVE / IMPORT"}</button>
              <button type="button" style={styles.secondaryButton} disabled={providerImportState.status === "importing"} onClick={() => handleRejectProviderCandidate(selectedProviderCandidate)}>REJECT</button>
              <button type="button" style={styles.secondaryButton} onClick={handleCloseProviderCandidateReview}>CLOSE / BACK WITHOUT CHANGES</button>
            </div>
            {providerImportState.candidateId === selectedProviderCandidate.id && providerImportState.status !== "idle" ? <div style={providerImportState.status === "failed" || providerImportState.status === "timed_out" ? styles.errorMessage : styles.successMessage}>{providerImportState.message}</div> : null}
          </div>
        </div>
      ), document.body) : null}
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

const GOLD = "#f2c500";
const BLACK = "#050505";
const BORDER = "#c89f00";

const styles = {
  page: { minHeight: "100vh", width: "100%", display: "flex", overflow: "hidden", backgroundColor: BLACK, color: GOLD, fontFamily: "Arial, Helvetica, sans-serif", fontWeight: 700 },
  sidebar: { flex: "0 0 178px", minHeight: "100vh", padding: "18px 0 10px", boxSizing: "border-box", backgroundColor: BLACK, display: "flex", flexDirection: "column", position: "relative" },
  logoArea: { height: "114px", display: "flex", alignItems: "center", justifyContent: "center", padding: "0 15px 10px", boxSizing: "border-box" },
  logo: { display: "block", width: "135px", height: "104px", objectFit: "contain", backgroundColor: "#ffffff" },
  nav: { display: "flex", flexDirection: "column", gap: "1px", paddingRight: "14px" },
  navButton: { position: "relative", width: "100%", minHeight: "36px", padding: "7px 10px", border: `1px solid ${BORDER}`, background: "linear-gradient(90deg, #f7d339 0%, #eab90c 100%)", color: "#17120a", textAlign: "left", fontSize: "10px", fontWeight: 500, display: "flex", alignItems: "center", gap: "8px", cursor: "pointer" },
  navIcon: { width: "18px", textAlign: "center", fontSize: "12px" },
  navTab: { position: "absolute", right: "-13px", top: "8px", width: "13px", height: "20px", backgroundColor: GOLD, border: `1px solid ${BORDER}`, boxSizing: "border-box" },
  logout: { width: "100%", minHeight: "34px", padding: "7px 10px", border: `1px solid ${BORDER}`, background: "linear-gradient(90deg, #f7d339 0%, #eab90c 100%)", color: "#17120a", textAlign: "left", fontSize: "10px", display: "flex", alignItems: "center", gap: "8px", cursor: "pointer" },
  smallMark: { marginTop: "8px", paddingLeft: "12px", fontFamily: "Georgia, serif", fontSize: "25px", color: GOLD },
  main: { flex: 1, minWidth: 0, padding: "20px 20px 18px", boxSizing: "border-box", backgroundColor: BLACK },
  topBar: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", marginBottom: "16px" },
  backButton: { border: `1px solid ${BORDER}`, background: "linear-gradient(90deg, #f7d339 0%, #eab90c 100%)", color: "#17120a", padding: "10px 14px", fontWeight: 700, cursor: "pointer" },
  headingBlock: { flex: 1, textAlign: "center" },
  company: { margin: 0, fontSize: "22px", letterSpacing: "1px" },
  subtitle: { margin: "4px 0 0", fontSize: "12px", letterSpacing: "1.4px", color: "#f9e27b" },
  headerActions: { display: "flex", gap: "8px", flexWrap: "wrap", justifyContent: "flex-end" },
  primaryButton: { border: `1px solid ${BORDER}`, background: "linear-gradient(90deg, #f7d339 0%, #eab90c 100%)", color: "#17120a", padding: "10px 14px", fontWeight: 700, cursor: "pointer" },
  secondaryButton: { border: `1px solid ${BORDER}`, background: "#111111", color: GOLD, padding: "10px 14px", fontWeight: 700, cursor: "pointer" },
  card: { border: `1px solid ${BORDER}`, background: "#0b0b0b", padding: "16px", boxSizing: "border-box" },
  cardHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", marginBottom: "10px" },
  cardTitle: { margin: 0, fontSize: "20px", color: GOLD },
  cardSubtitle: { margin: "4px 0 0", fontSize: "12px", color: "#f9e27b" },
  connectionBadge: { border: `1px solid ${BORDER}`, padding: "8px 10px", fontSize: "12px", color: GOLD, background: "#111111" },
  summaryGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "10px", marginBottom: "12px" },
  summaryCard: { border: `1px solid ${BORDER}`, background: "#111111", padding: "10px", boxSizing: "border-box" },
  summaryLabel: { fontSize: "11px", textTransform: "uppercase", color: "#f9e27b", marginBottom: "6px" },
  summaryValue: { fontSize: "16px", color: GOLD, fontWeight: 700 },
  controlsRow: { display: "flex", flexWrap: "wrap", gap: "10px", marginBottom: "12px" },
  input: { border: `1px solid ${BORDER}`, background: "#111111", color: GOLD, padding: "8px 10px", fontSize: "12px", minWidth: "120px", boxSizing: "border-box" },
  select: { border: `1px solid ${BORDER}`, background: "#111111", color: GOLD, padding: "8px 10px", fontSize: "12px", minWidth: "140px" },
  gridTwo: { display: "grid", gridTemplateColumns: "1.2fr 0.8fr", gap: "12px", marginBottom: "12px" },
  section: { border: `1px solid ${BORDER}`, background: "#111111", padding: "12px", boxSizing: "border-box" },
  sectionTitle: { margin: "0 0 10px", fontSize: "15px", color: GOLD },
  formGrid: { display: "grid", gridTemplateColumns: "repeat(2, minmax(180px, 1fr))", gap: "10px" },
  label: { display: "flex", flexDirection: "column", gap: "6px", fontSize: "12px", color: "#f9e27b" },
  fieldLabel: { fontSize: "11px", textTransform: "uppercase" },
  formActions: { display: "flex", gap: "10px", marginTop: "12px" },
  providerPanel: { border: `1px solid ${BORDER}`, background: "#0b0b0b", padding: "10px", marginTop: "12px" },
  providerHeaderRow: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px", marginBottom: "8px" },
  providerStatusText: { fontSize: "12px", color: GOLD },
  providerMeta: { fontSize: "12px", color: "#f9e27b", marginTop: "6px" },
  successMessage: { border: "1px solid #4caf50", color: "#4caf50", padding: "8px 10px", marginBottom: "10px", fontSize: "12px" },
  errorMessage: { border: "1px solid #ff6b6b", color: "#ff6b6b", padding: "8px 10px", marginBottom: "10px", fontSize: "12px" },
  emptyState: { border: `1px dashed ${BORDER}`, padding: "14px", color: "#f9e27b", fontSize: "12px", background: "#0c0c0c" },
  tableWrap: { overflowX: "auto" },
  table: { width: "100%", borderCollapse: "collapse", fontSize: "12px" },
  th: { textAlign: "left", padding: "8px 6px", borderBottom: `1px solid ${BORDER}`, color: GOLD, textTransform: "uppercase" },
  td: { padding: "8px 6px", borderBottom: "1px solid #2a2400", verticalAlign: "top" },
  tableButton: { border: `1px solid ${BORDER}`, background: "#111111", color: GOLD, padding: "6px 8px", cursor: "pointer" },
  recommendationBox: { border: `1px solid ${BORDER}`, background: "#0c0c0c", padding: "12px", marginBottom: "10px" },
  warningList: { display: "flex", flexDirection: "column", gap: "8px" },
  warning: { border: "1px solid #ff6b6b", color: "#ff6b6b", padding: "8px 10px", fontSize: "12px" },
  detailRow: { display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid #2a2400", fontSize: "12px" },
  reviewOverlay: { position: "fixed", top: 0, right: 0, bottom: 0, left: 0, zIndex: 2147483647, display: "flex", alignItems: "center", justifyContent: "center", width: "100vw", height: "100vh", minHeight: "100%", padding: "16px", boxSizing: "border-box", overflow: "hidden", visibility: "visible", opacity: 1, pointerEvents: "auto", isolation: "isolate", background: "rgba(0,0,0,0.88)" },
  reviewDialog: { position: "relative", width: "100%", maxWidth: "820px", maxHeight: "calc(100vh - 32px)", overflowX: "hidden", overflowY: "auto", WebkitOverflowScrolling: "touch", border: `2px solid ${BORDER}`, background: "#0b0b0b", color: GOLD, padding: "18px", boxSizing: "border-box", boxShadow: "0 0 28px rgba(242,197,0,0.2)" },
  reviewHeader: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "12px", flexWrap: "wrap", borderBottom: `1px solid ${BORDER}`, paddingBottom: "12px", marginBottom: "12px" },
  reviewTitle: { margin: 0, fontSize: "19px", color: GOLD },
  reviewPending: { marginTop: "6px", color: "#ffcf66", fontSize: "12px", letterSpacing: "0.5px" },
  reviewGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", columnGap: "18px" },
  reviewEvidence: { border: `1px solid ${BORDER}`, padding: "10px", marginTop: "12px", background: "#111111" },
  reviewWarning: { border: "1px solid #ffcf66", padding: "10px", marginTop: "12px", color: "#ffcf66", fontSize: "12px", background: "rgba(255,207,102,0.06)" },
  reviewActions: { display: "flex", flexWrap: "wrap", gap: "8px", marginTop: "14px" },
};
