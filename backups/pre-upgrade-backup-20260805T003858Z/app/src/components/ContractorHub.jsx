import { useEffect, useMemo, useState } from "react";
import { buildApiUrl } from "../utils/apiClient.js";
import logo from "../assets/royal-star-logo.png";
import { buildImportPreview, normalizeRecordForStorage } from "./enterpriseDataIntegration.js";

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

const trades = [
  "General Contractor",
  "Plumbing",
  "Electrical",
  "HVAC",
  "Roofing",
  "Flooring",
  "Painting",
  "Drywall",
  "Framing",
  "Concrete",
  "Windows",
  "Landscaping",
  "Cleaning",
  "Security",
  "Other",
];

const statuses = ["Active", "Inactive", "Pending Review", "Do Not Use"];
const projectStatuses = ["Not Started", "In Progress", "Delayed", "Completed", "On Hold", "Cancelled"];
const documentStatuses = ["Missing", "Requested", "Received", "Verified", "Expired", "Not Required"];

const initialValues = {
  companyName: "",
  contactName: "",
  phone: "",
  email: "",
  trade: "General Contractor",
  serviceArea: "",
  licenseNumber: "",
  licenseExpiration: "",
  insuranceCompany: "",
  insuranceExpiration: "",
  w9Status: "",
  preferred: false,
  status: "Active",
  notes: "",
  qualityScore: "",
  speedScore: "",
  communicationScore: "",
  budgetAccuracyScore: "",
  reliabilityScore: "",
  cleanlinessScore: "",
  insuranceCertificateStatus: "Missing",
  licenseDocumentStatus: "Missing",
  w9DocumentStatus: "Missing",
  contractDocumentStatus: "Missing",
  beforePhotosStatus: "Missing",
  afterPhotosStatus: "Missing",
  lienWaiverStatus: "Missing",
};

const initialProjectValues = {
  propertyAddress: "",
  projectScope: "",
  startDate: "",
  estimatedCompletionDate: "",
  actualCompletionDate: "",
  projectStatus: "Not Started",
  contractAmount: "",
  amountPaid: "",
  amountRemaining: "",
  changeOrders: "",
  projectNotes: "",
};

function createId(prefix = "contractor") {
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

function formatPercent(value) {
  if (!Number.isFinite(value)) return "Not Available";
  return `${(value * 100).toFixed(1)}%`;
}

function getOverallScore(contractor) {
  const scores = [
    contractor.qualityScore,
    contractor.speedScore,
    contractor.communicationScore,
    contractor.budgetAccuracyScore,
    contractor.reliabilityScore,
    contractor.cleanlinessScore,
  ].filter((score) => score !== "" && score !== null && score !== undefined);

  if (scores.length === 0) return 0;
  return scores.reduce((sum, score) => sum + toNumber(score), 0) / scores.length;
}

function getAmountRemaining(contractAmount, changeOrders, amountPaid) {
  return toNumber(contractAmount) + toNumber(changeOrders) - Math.max(0, toNumber(amountPaid));
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

function getRecommendation(contractor) {
  const overall = getOverallScore(contractor);
  const warnings = getWarnings(contractor);
  const hasExpiredInsurance = warnings.includes("Insurance expired");
  const hasMissingW9 = warnings.includes("Missing W-9");
  const hasMajorWarnings = warnings.some((warning) => ["Insurance expired", "License expired", "Missing contract", "Missing lien waiver", "Contractor status is Do Not Use"].includes(warning));

  if (overall >= 8.5 && !hasExpiredInsurance && contractor.w9DocumentStatus === "Verified" && warnings.length === 0) {
    return { label: "Preferred", reason: "The contractor has an excellent score profile, current insurance, a verified W-9, and no major warnings." };
  }

  if (overall >= 7 && !hasExpiredInsurance && !hasMajorWarnings) {
    return { label: "Approved", reason: "The contractor has a strong score profile, insurance is current, and the documentation is substantially complete." };
  }

  if (overall >= 5.5 || warnings.length > 0 || contractor.status === "Pending Review") {
    return { label: "Review", reason: "The contractor has moderate performance or incomplete documentation, so a closer review is warranted." };
  }

  return { label: "Do Not Use", reason: "The contractor has weak performance, expired insurance, or a status that places the project at unnecessary risk." };
}

function getWarnings(contractor) {
  const warnings = [];
  const insuranceExpiration = contractor.insuranceExpiration;
  const licenseExpiration = contractor.licenseExpiration;
  const now = new Date();

  if (insuranceExpiration) {
    const insuranceDate = new Date(insuranceExpiration);
    if (!Number.isNaN(insuranceDate.getTime()) && insuranceDate < now) {
      warnings.push("Insurance expired");
    } else if (!Number.isNaN(insuranceDate.getTime())) {
      const diffDays = Math.ceil((insuranceDate - now) / (1000 * 60 * 60 * 24));
      if (diffDays <= 30) warnings.push("Insurance expires within 30 days");
    }
  }

  if (licenseExpiration) {
    const licenseDate = new Date(licenseExpiration);
    if (!Number.isNaN(licenseDate.getTime()) && licenseDate < now) {
      warnings.push("License expired");
    }
  }

  if (contractor.w9DocumentStatus === "Missing" || contractor.w9DocumentStatus === "Requested") {
    warnings.push("Missing W-9");
  }

  if (contractor.contractDocumentStatus === "Missing" || contractor.contractDocumentStatus === "Requested") {
    warnings.push("Missing contract");
  }

  if (contractor.lienWaiverStatus === "Missing" || contractor.lienWaiverStatus === "Requested") {
    warnings.push("Missing lien waiver");
  }

  if (getOverallScore(contractor) < 6) {
    warnings.push("Overall score below 6");
  }

  if (contractor.status === "Do Not Use") {
    warnings.push("Contractor status is Do Not Use");
  }

  const activeProjects = contractor.projects || [];
  const delayedProjects = activeProjects.filter((project) => project.projectStatus === "Delayed");
  if (delayedProjects.length > 0) warnings.push("Project is delayed");

  const overBudgetProjects = activeProjects.filter((project) => {
    const adjustedContract = toNumber(project.contractAmount) + toNumber(project.changeOrders);
    const paid = Math.max(0, toNumber(project.amountPaid));
    return adjustedContract > 0 && paid > adjustedContract;
  });
  if (overBudgetProjects.length > 0) warnings.push("Contractor is over budget");

  return warnings;
}

function normalizeContractorPayload(values) {
  return {
    companyName: values.companyName || "",
    contactName: values.contactName || "",
    phone: values.phone || "",
    email: values.email || "",
    trade: values.trade || "General Contractor",
    serviceArea: values.serviceArea || "",
    licenseNumber: values.licenseNumber || "",
    licenseExpiration: values.licenseExpiration || "",
    insuranceCompany: values.insuranceCompany || "",
    insuranceExpiration: values.insuranceExpiration || "",
    w9Status: values.w9Status || "",
    preferred: Boolean(values.preferred),
    status: values.status || "Active",
    notes: values.notes || "",
    qualityScore: parseOptionalNumber(values.qualityScore),
    speedScore: parseOptionalNumber(values.speedScore),
    communicationScore: parseOptionalNumber(values.communicationScore),
    budgetAccuracyScore: parseOptionalNumber(values.budgetAccuracyScore),
    reliabilityScore: parseOptionalNumber(values.reliabilityScore),
    cleanlinessScore: parseOptionalNumber(values.cleanlinessScore),
    insuranceCertificateStatus: values.insuranceCertificateStatus || "Missing",
    licenseDocumentStatus: values.licenseDocumentStatus || "Missing",
    w9DocumentStatus: values.w9DocumentStatus || "Missing",
    contractDocumentStatus: values.contractDocumentStatus || "Missing",
    beforePhotosStatus: values.beforePhotosStatus || "Missing",
    afterPhotosStatus: values.afterPhotosStatus || "Missing",
    lienWaiverStatus: values.lienWaiverStatus || "Missing",
    projects: values.projects || [],
  };
}

export default function ContractorHub({
  onBack,
  onOpenDealIntake,
  onOpenDealAnalyzer,
  onOpenFlipAnalyzer,
  onOpenBrrrrAnalyzer,
  onOpenProductVault,
  onOpenDealIntelligence,
  onOpenContractorHub,
}) {
  const [contractors, setContractors] = useState([]);
  const [selectedContractorId, setSelectedContractorId] = useState("");
  const [formValues, setFormValues] = useState(initialValues);
  const [projectForm, setProjectForm] = useState(initialProjectValues);
  const [searchText, setSearchText] = useState("");
  const [tradeFilter, setTradeFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [preferredFilter, setPreferredFilter] = useState("All");
  const [serviceAreaFilter, setServiceAreaFilter] = useState("All");
  const [insuranceFilter, setInsuranceFilter] = useState("All");
  const [sortBy, setSortBy] = useState("companyName");
  const [connectionState, setConnectionState] = useState("Backend Connected");
  const [message, setMessage] = useState({ type: "", text: "" });
  const [importText, setImportText] = useState("");
  const [importPreview, setImportPreview] = useState(null);
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    const loadContractors = async () => {
      try {
        const response = await fetch(buildApiUrl("/api/contractors"));
        if (!response.ok) throw new Error("Unable to fetch contractors");

        const apiContractors = await response.json();
        setContractors(Array.isArray(apiContractors) ? apiContractors : []);
      } catch (error) {
        console.error("Unable to load contractors from API, using localStorage fallback", error);
        setConnectionState("Local Fallback");
        if (typeof window !== "undefined") {
          try {
            const storedContractors = JSON.parse(window.localStorage.getItem("royalStarContractors") || "[]") || [];
            setContractors(Array.isArray(storedContractors) ? storedContractors : []);
          } catch (localError) {
            console.error("Unable to read contractors from localStorage", localError);
            setContractors([]);
          }
        }
      }
    };

    loadContractors();
  }, []);

  const serviceAreaOptions = useMemo(() => Array.from(new Set(contractors.map((contractor) => contractor.serviceArea).filter(Boolean))).sort(), [contractors]);
  const insuranceStatusOptions = ["All", "Current", "Expiring", "Expired"];

  const filteredContractors = useMemo(() => {
    const search = searchText.trim().toLowerCase();
    let items = [...contractors];

    if (search) {
      items = items.filter((contractor) => {
        const haystack = [contractor.companyName, contractor.contactName, contractor.phone, contractor.email, contractor.trade]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return haystack.includes(search);
      });
    }

    if (tradeFilter !== "All") items = items.filter((contractor) => contractor.trade === tradeFilter);
    if (statusFilter !== "All") items = items.filter((contractor) => contractor.status === statusFilter);
    if (preferredFilter !== "All") items = items.filter((contractor) => Boolean(contractor.preferred) === (preferredFilter === "Preferred"));
    if (serviceAreaFilter !== "All") items = items.filter((contractor) => contractor.serviceArea === serviceAreaFilter);
    if (insuranceFilter !== "All") {
      items = items.filter((contractor) => {
        const expiration = contractor.insuranceExpiration;
        if (!expiration) return insuranceFilter === "Expired";
        const expirationDate = new Date(expiration);
        const now = new Date();
        if (Number.isNaN(expirationDate.getTime())) return false;
        if (expirationDate < now) return insuranceFilter === "Expired";
        const diffDays = Math.ceil((expirationDate - now) / (1000 * 60 * 60 * 24));
        return insuranceFilter === "Expiring" ? diffDays <= 30 : insuranceFilter === "Current";
      });
    }

    items.sort((left, right) => {
      switch (sortBy) {
        case "highestScore":
          return getOverallScore(right) - getOverallScore(left);
        case "lowestScore":
          return getOverallScore(left) - getOverallScore(right);
        case "newest":
          return (right.updatedAt || "").localeCompare(left.updatedAt || "");
        case "insuranceExpiration":
          return (left.insuranceExpiration || "").localeCompare(right.insuranceExpiration || "");
        case "mostActiveJobs":
          return (right.projects || []).length - (left.projects || []).length;
        default:
          return (left.companyName || "").localeCompare(right.companyName || "");
      }
    });

    return items;
  }, [contractors, searchText, tradeFilter, statusFilter, preferredFilter, serviceAreaFilter, insuranceFilter, sortBy]);

  const summaryStats = useMemo(() => {
    const preferred = contractors.filter((contractor) => contractor.preferred).length;
    const active = contractors.filter((contractor) => contractor.status === "Active").length;
    const activeJobs = contractors.reduce((sum, contractor) => sum + (contractor.projects || []).filter((project) => project.projectStatus !== "Completed" && project.projectStatus !== "Cancelled").length, 0);
    const averageScore = contractors.length > 0 ? contractors.reduce((sum, contractor) => sum + getOverallScore(contractor), 0) / contractors.length : 0;
    const expiringInsurance = contractors.filter((contractor) => {
      const expiration = contractor.insuranceExpiration;
      if (!expiration) return false;
      const expirationDate = new Date(expiration);
      if (Number.isNaN(expirationDate.getTime())) return false;
      const diffDays = Math.ceil((expirationDate - new Date()) / (1000 * 60 * 60 * 24));
      return diffDays <= 30 && diffDays >= 0;
    }).length;
    const missingW9s = contractors.filter((contractor) => contractor.w9DocumentStatus === "Missing" || contractor.w9DocumentStatus === "Requested").length;
    const doNotUse = contractors.filter((contractor) => contractor.status === "Do Not Use").length;

    return { total: contractors.length, preferred, active, activeJobs, averageScore, expiringInsurance, missingW9s, doNotUse };
  }, [contractors]);

  const selectedContractor = useMemo(() => contractors.find((contractor) => contractor.id === selectedContractorId) || null, [contractors, selectedContractorId]);
  const recommendation = selectedContractor ? getRecommendation(selectedContractor) : null;
  const warnings = selectedContractor ? getWarnings(selectedContractor) : [];

  const rankedContractors = useMemo(() => {
    return [...contractors]
      .map((contractor) => {
        const overall = getOverallScore(contractor);
        const completedJobs = (contractor.projects || []).filter((project) => project.projectStatus === "Completed").length;
        const onTimeRate = completedJobs > 0 ? ((contractor.projects || []).filter((project) => project.projectStatus === "Completed" && project.actualCompletionDate && project.estimatedCompletionDate && new Date(project.actualCompletionDate) <= new Date(project.estimatedCompletionDate)).length / completedJobs) : 0;
        const budgetAccuracy = contractor.budgetAccuracyScore !== "" ? toNumber(contractor.budgetAccuracyScore) : overall / 10;
        const rankScore = overall * 2 + (contractor.preferred ? 2 : 0) + completedJobs * 0.5 + onTimeRate + budgetAccuracy;
        return { ...contractor, overall, completedJobs, onTimeRate, budgetAccuracy, rankScore };
      })
      .sort((left, right) => {
        if (left.status === "Do Not Use" && right.status !== "Do Not Use") return 1;
        if (right.status === "Do Not Use" && left.status !== "Do Not Use") return -1;
        return right.rankScore - left.rankScore;
      });
  }, [contractors]);

  const handleFieldChange = (event) => {
    const { name, value, type, checked } = event.target;
    setFormValues((prev) => ({ ...prev, [name]: type === "checkbox" ? checked : value }));
  };

  const handleProjectFieldChange = (event) => {
    const { name, value } = event.target;
    setProjectForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSelectContractor = (contractor) => {
    setSelectedContractorId(contractor.id);
    setFormValues({
      ...initialValues,
      ...contractor,
      qualityScore: contractor.qualityScore ?? "",
      speedScore: contractor.speedScore ?? "",
      communicationScore: contractor.communicationScore ?? "",
      budgetAccuracyScore: contractor.budgetAccuracyScore ?? "",
      reliabilityScore: contractor.reliabilityScore ?? "",
      cleanlinessScore: contractor.cleanlinessScore ?? "",
      preferred: Boolean(contractor.preferred),
      projects: contractor.projects || [],
    });
    setProjectForm(initialProjectValues);
    setMessage({ type: "", text: "" });
  };

  const handleClearForm = () => {
    setSelectedContractorId("");
    setFormValues(initialValues);
    setProjectForm(initialProjectValues);
    setMessage({ type: "", text: "" });
  };

  const persistContractor = async (payload, existingContractor = null) => {
    if (existingContractor) {
      try {
        const response = await fetch(buildApiUrl(`/api/contractors/${existingContractor.id}`), {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!response.ok) throw new Error("Unable to update contractor");
        return response.json();
      } catch (error) {
        console.error("Unable to update contractor via API, using local fallback", error);
        return { ...payload, id: existingContractor.id, createdAt: existingContractor.createdAt, updatedAt: new Date().toISOString() };
      }
    }

    try {
      const response = await fetch(buildApiUrl("/api/contractors"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error("Unable to create contractor");
      return response.json();
    } catch (error) {
      console.error("Unable to create contractor via API, using local fallback", error);
      return { ...payload, id: createId(), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!formValues.companyName.trim()) {
      setMessage({ type: "error", text: "Company name is required." });
      return;
    }
    if (!formValues.contactName.trim()) {
      setMessage({ type: "error", text: "Contact name is required." });
      return;
    }
    if (!formValues.phone.trim() && !formValues.email.trim()) {
      setMessage({ type: "error", text: "Please provide either a phone number or an email address." });
      return;
    }
    if (!formValues.trade) {
      setMessage({ type: "error", text: "Trade is required." });
      return;
    }
    if (!formValues.status) {
      setMessage({ type: "error", text: "Status is required." });
      return;
    }

    for (const key of ["qualityScore", "speedScore", "communicationScore", "budgetAccuracyScore", "reliabilityScore", "cleanlinessScore"]) {
      const scoreValue = formValues[key];
      if (scoreValue !== "" && (Number(scoreValue) < 1 || Number(scoreValue) > 10)) {
        setMessage({ type: "error", text: "All score values must be between 1 and 10." });
        return;
      }
    }

    const existingContractor = contractors.find((contractor) => contractor.id === selectedContractorId);
    const normalizedContractor = normalizeContractorPayload({ ...formValues, projects: existingContractor?.projects || [] });
    const savedContractor = await persistContractor(normalizedContractor, existingContractor);

    const nextContractors = existingContractor
      ? contractors.map((contractor) => (contractor.id === existingContractor.id ? { ...contractor, ...savedContractor, id: existingContractor.id } : contractor))
      : [...contractors, savedContractor];

    setContractors(nextContractors);
    if (typeof window !== "undefined") {
      window.localStorage.setItem("royalStarContractors", JSON.stringify(nextContractors));
    }
    setSelectedContractorId(savedContractor.id);
    setFormValues({ ...initialValues, ...savedContractor, preferred: Boolean(savedContractor.preferred) });
    setMessage({ type: "success", text: existingContractor ? "Contractor updated successfully." : "Contractor added successfully." });
  };

  const handleDeleteContractor = async (contractorId) => {
    const target = contractors.find((contractor) => contractor.id === contractorId);
    if (!target) return;

    try {
      const response = await fetch(buildApiUrl(`/api/contractors/${contractorId}`), { method: "DELETE" });
      if (!response.ok) throw new Error("Unable to delete contractor");
      const nextContractors = contractors.filter((contractor) => contractor.id !== contractorId);
      setContractors(nextContractors);
      if (typeof window !== "undefined") {
        window.localStorage.setItem("royalStarContractors", JSON.stringify(nextContractors));
      }
      setSelectedContractorId("");
      setFormValues(initialValues);
      setMessage({ type: "success", text: "Contractor deleted successfully." });
    } catch (error) {
      console.error("Unable to delete contractor via API, using local fallback", error);
      const nextContractors = contractors.filter((contractor) => contractor.id !== contractorId);
      setContractors(nextContractors);
      if (typeof window !== "undefined") {
        window.localStorage.setItem("royalStarContractors", JSON.stringify(nextContractors));
      }
      setSelectedContractorId("");
      setFormValues(initialValues);
      setMessage({ type: "success", text: "Contractor deleted successfully." });
    }
  };

  const handleExport = () => {
    const rows = filteredContractors.map((contractor) => ({
      companyName: contractor.companyName,
      contactName: contractor.contactName,
      phone: contractor.phone,
      email: contractor.email,
      trade: contractor.trade,
      status: contractor.status,
      preferred: contractor.preferred,
      overallScore: getOverallScore(contractor),
    }));
    downloadFile("royal-star-contractors.json", JSON.stringify(rows, null, 2), "application/json");
    setMessage({ type: "success", text: "Contractor export prepared." });
  };

  const handleExportCsv = () => {
    const rows = filteredContractors.map((contractor) => ({
      companyName: contractor.companyName,
      contactName: contractor.contactName,
      phone: contractor.phone,
      email: contractor.email,
      trade: contractor.trade,
      status: contractor.status,
      preferred: contractor.preferred,
      overallScore: getOverallScore(contractor),
    }));
    if (!rows.length) {
      setMessage({ type: "error", text: "No contractors available to export." });
      return;
    }
    downloadCsv("royal-star-contractors.csv", rows);
    setMessage({ type: "success", text: "CSV export prepared." });
  };

  const handlePreviewImport = () => {
    if (!importText.trim()) {
      setMessage({ type: "error", text: "Paste CSV data before previewing an import." });
      return;
    }
    const preview = buildImportPreview(importText, "contractor", contractors);
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
    const nextContractors = [...contractors];

    for (const row of readyRows) {
      const normalized = normalizeRecordForStorage({ ...row.record, companyName: row.record.companyName || row.record.name || row.record.company || row.record.address }, "contractor");
      const payload = normalizeContractorPayload({
        ...initialValues,
        ...normalized,
        companyName: normalized.name || normalized.companyName || `Imported Contractor ${row.rowNumber}`,
        phone: normalized.phone || "",
        email: normalized.email || "",
        notes: normalized.notes || "",
      });
      const savedContractor = await persistContractor(payload);
      nextContractors.push(savedContractor);
    }

    setContractors(nextContractors);
    if (typeof window !== "undefined") {
      window.localStorage.setItem("royalStarContractors", JSON.stringify(nextContractors));
    }
    setImportPreview(null);
    setImportText("");
    setImporting(false);
    setMessage({ type: "success", text: `${readyRows.length} imported contractors added to the database.` });
  };

  const handleSaveProject = () => {
    if (!selectedContractor) return;

    const nextProjects = [...(selectedContractor.projects || [])];
    const adjustedProject = {
      ...projectForm,
      contractAmount: toNumber(projectForm.contractAmount),
      amountPaid: Math.max(0, toNumber(projectForm.amountPaid)),
      changeOrders: toNumber(projectForm.changeOrders),
      amountRemaining: getAmountRemaining(projectForm.contractAmount, projectForm.changeOrders, projectForm.amountPaid),
    };

    const existingProjectIndex = nextProjects.findIndex((project) => project.id === projectForm.id);
    if (existingProjectIndex >= 0) {
      nextProjects[existingProjectIndex] = adjustedProject;
    } else {
      nextProjects.push({ ...adjustedProject, id: createId("project") });
    }

    const updatedContractor = { ...selectedContractor, projects: nextProjects };
    const nextContractors = contractors.map((contractor) => (contractor.id === selectedContractor.id ? updatedContractor : contractor));
    setContractors(nextContractors);
    if (typeof window !== "undefined") {
      window.localStorage.setItem("royalStarContractors", JSON.stringify(nextContractors));
    }
    setProjectForm(initialProjectValues);
    setMessage({ type: "success", text: existingProjectIndex >= 0 ? "Project updated successfully." : "Project assigned successfully." });
  };

  const handleEditProject = (project) => {
    setProjectForm({ ...initialProjectValues, ...project });
  };

  const handleMarkProjectComplete = (project) => {
    if (!selectedContractor) return;
    const nextProjects = (selectedContractor.projects || []).map((entry) =>
      entry.id === project.id ? { ...entry, projectStatus: "Completed", actualCompletionDate: entry.actualCompletionDate || new Date().toISOString().slice(0, 10), amountRemaining: getAmountRemaining(entry.contractAmount, entry.changeOrders, entry.amountPaid) } : entry
    );
    const updatedContractor = { ...selectedContractor, projects: nextProjects };
    const nextContractors = contractors.map((contractor) => (contractor.id === selectedContractor.id ? updatedContractor : contractor));
    setContractors(nextContractors);
    if (typeof window !== "undefined") {
      window.localStorage.setItem("royalStarContractors", JSON.stringify(nextContractors));
    }
    setMessage({ type: "success", text: "Project marked complete." });
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
            <p style={styles.subtitle}>CONTRACTOR HUB / RSOS PROJECT TEAM</p>
          </div>
          <div style={styles.headerActions}>
            <button type="button" style={styles.secondaryButton} onClick={onOpenDealAnalyzer}>DEAL ANALYZER</button>
            <button type="button" style={styles.primaryButton} onClick={onOpenFlipAnalyzer}>FLIP ANALYZER</button>
            <button type="button" style={styles.primaryButton} onClick={onOpenBrrrrAnalyzer}>BRRRR ANALYZER</button>
            <button type="button" style={styles.primaryButton} onClick={onOpenProductVault}>PRODUCT VAULT</button>
            <button type="button" style={styles.primaryButton} onClick={onOpenDealIntake}>ADD NEW DEAL</button>
            <button type="button" style={styles.primaryButton} onClick={onOpenDealIntelligence}>DEAL INTELLIGENCE</button>
          </div>
        </section>

        <section style={styles.card}>
          <div style={styles.cardHeader}>
            <div>
              <h2 style={styles.cardTitle}>CONTRACTOR HUB</h2>
              <p style={styles.cardSubtitle}>Manage preferred builders, score performance, assign projects, and track documentation.</p>
            </div>
            <div style={styles.connectionBadge}>{connectionState}</div>
          </div>

          <div style={styles.summaryGrid}>
            <SummaryCard label="Total Contractors" value={summaryStats.total} />
            <SummaryCard label="Preferred Contractors" value={summaryStats.preferred} />
            <SummaryCard label="Active Contractors" value={summaryStats.active} />
            <SummaryCard label="Active Jobs" value={summaryStats.activeJobs} />
            <SummaryCard label="Average Contractor Score" value={formatPercent(summaryStats.averageScore / 10)} />
            <SummaryCard label="Expiring Insurance" value={summaryStats.expiringInsurance} />
            <SummaryCard label="Missing W-9s" value={summaryStats.missingW9s} />
            <SummaryCard label="Do Not Use" value={summaryStats.doNotUse} />
          </div>

          <div style={styles.controlsRow}>
            <input type="text" value={searchText} onChange={(event) => setSearchText(event.target.value)} placeholder="Search company, contact, phone, email, trade" style={styles.input} />
            <select value={tradeFilter} onChange={(event) => setTradeFilter(event.target.value)} style={styles.select}>
              <option value="All">All Trades</option>
              {trades.map((trade) => <option key={trade} value={trade}>{trade}</option>)}
            </select>
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} style={styles.select}>
              <option value="All">All Status</option>
              {statuses.map((status) => <option key={status} value={status}>{status}</option>)}
            </select>
            <select value={preferredFilter} onChange={(event) => setPreferredFilter(event.target.value)} style={styles.select}>
              <option value="All">Preferred Status</option>
              <option value="Preferred">Preferred</option>
              <option value="Standard">Standard</option>
            </select>
            <select value={serviceAreaFilter} onChange={(event) => setServiceAreaFilter(event.target.value)} style={styles.select}>
              <option value="All">All Service Areas</option>
              {serviceAreaOptions.map((serviceArea) => <option key={serviceArea} value={serviceArea}>{serviceArea}</option>)}
            </select>
            <select value={insuranceFilter} onChange={(event) => setInsuranceFilter(event.target.value)} style={styles.select}>
              <option value="All">All Insurance</option>
              {insuranceStatusOptions.slice(1).map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
            <select value={sortBy} onChange={(event) => setSortBy(event.target.value)} style={styles.select}>
              <option value="companyName">Sort by Company Name</option>
              <option value="highestScore">Sort by Highest Score</option>
              <option value="lowestScore">Sort by Lowest Score</option>
              <option value="newest">Sort by Newest</option>
              <option value="insuranceExpiration">Sort by Insurance Expiration</option>
              <option value="mostActiveJobs">Sort by Most Active Jobs</option>
            </select>
          </div>

          {message.text ? <div style={message.type === "success" ? styles.successMessage : styles.errorMessage}>{message.text}</div> : null}

          <div style={styles.gridTwo}>
            <div style={styles.section}>
              <h3 style={styles.sectionTitle}>CONTRACTOR FORM</h3>
              <div style={styles.formGrid}>
                <label style={styles.label}><span style={styles.fieldLabel}>Company Name</span><input type="text" name="companyName" value={formValues.companyName} onChange={handleFieldChange} style={styles.input} /></label>
                <label style={styles.label}><span style={styles.fieldLabel}>Contact Name</span><input type="text" name="contactName" value={formValues.contactName} onChange={handleFieldChange} style={styles.input} /></label>
                <label style={styles.label}><span style={styles.fieldLabel}>Phone</span><input type="text" name="phone" value={formValues.phone} onChange={handleFieldChange} style={styles.input} /></label>
                <label style={styles.label}><span style={styles.fieldLabel}>Email</span><input type="text" name="email" value={formValues.email} onChange={handleFieldChange} style={styles.input} /></label>
                <label style={styles.label}><span style={styles.fieldLabel}>Trade</span><select name="trade" value={formValues.trade} onChange={handleFieldChange} style={styles.select}>{trades.map((trade) => <option key={trade} value={trade}>{trade}</option>)}</select></label>
                <label style={styles.label}><span style={styles.fieldLabel}>Service Area</span><input type="text" name="serviceArea" value={formValues.serviceArea} onChange={handleFieldChange} style={styles.input} /></label>
                <label style={styles.label}><span style={styles.fieldLabel}>License Number</span><input type="text" name="licenseNumber" value={formValues.licenseNumber} onChange={handleFieldChange} style={styles.input} /></label>
                <label style={styles.label}><span style={styles.fieldLabel}>License Expiration</span><input type="date" name="licenseExpiration" value={formValues.licenseExpiration} onChange={handleFieldChange} style={styles.input} /></label>
                <label style={styles.label}><span style={styles.fieldLabel}>Insurance Company</span><input type="text" name="insuranceCompany" value={formValues.insuranceCompany} onChange={handleFieldChange} style={styles.input} /></label>
                <label style={styles.label}><span style={styles.fieldLabel}>Insurance Expiration</span><input type="date" name="insuranceExpiration" value={formValues.insuranceExpiration} onChange={handleFieldChange} style={styles.input} /></label>
                <label style={styles.label}><span style={styles.fieldLabel}>W-9 Status</span><input type="text" name="w9Status" value={formValues.w9Status} onChange={handleFieldChange} style={styles.input} /></label>
                <label style={styles.label}><span style={styles.fieldLabel}>Status</span><select name="status" value={formValues.status} onChange={handleFieldChange} style={styles.select}>{statuses.map((status) => <option key={status} value={status}>{status}</option>)}</select></label>
                <label style={styles.label}><span style={styles.fieldLabel}>Preferred</span><input type="checkbox" name="preferred" checked={formValues.preferred} onChange={handleFieldChange} /></label>
                <label style={styles.label}><span style={styles.fieldLabel}>Notes</span><textarea name="notes" value={formValues.notes} onChange={handleFieldChange} style={{ ...styles.input, minHeight: "90px" }} /></label>
              </div>

              <h4 style={styles.sectionTitle}>SCORECARD</h4>
              <div style={styles.formGrid}>
                {[
                  ["Quality Score", "qualityScore"],
                  ["Speed Score", "speedScore"],
                  ["Communication Score", "communicationScore"],
                  ["Budget Accuracy Score", "budgetAccuracyScore"],
                  ["Reliability Score", "reliabilityScore"],
                  ["Cleanliness Score", "cleanlinessScore"],
                ].map(([label, name]) => (
                  <label key={name} style={styles.label}><span style={styles.fieldLabel}>{label}</span><input type="number" min="1" max="10" name={name} value={formValues[name]} onChange={handleFieldChange} style={styles.input} /></label>
                ))}
              </div>

              <h4 style={styles.sectionTitle}>DOCUMENT STATUS</h4>
              <div style={styles.formGrid}>
                {[
                  ["Insurance Certificate", "insuranceCertificateStatus"],
                  ["License Document", "licenseDocumentStatus"],
                  ["W-9 Document", "w9DocumentStatus"],
                  ["Contract Document", "contractDocumentStatus"],
                  ["Before Photos", "beforePhotosStatus"],
                  ["After Photos", "afterPhotosStatus"],
                  ["Lien Waiver", "lienWaiverStatus"],
                ].map(([label, name]) => (
                  <label key={name} style={styles.label}><span style={styles.fieldLabel}>{label}</span><select name={name} value={formValues[name]} onChange={handleFieldChange} style={styles.select}>{documentStatuses.map((status) => <option key={status} value={status}>{status}</option>)}</select></label>
                ))}
              </div>

              <div style={styles.formActions}>
                <button type="button" style={styles.primaryButton} onClick={handleSubmit}>{selectedContractorId ? "UPDATE CONTRACTOR" : "ADD CONTRACTOR"}</button>
                <button type="button" style={styles.secondaryButton} onClick={handleClearForm}>CLEAR FORM</button>
              </div>
            </div>

            <div style={styles.section}>
              <h3 style={styles.sectionTitle}>IMPORT / EXPORT</h3>
              <div style={styles.importSection}>
                <label style={styles.label}>
                  <span style={styles.fieldLabel}>CSV / Structured Import</span>
                  <textarea value={importText} onChange={(event) => setImportText(event.target.value)} style={{ ...styles.input, minHeight: "110px" }} placeholder="companyName,phone,email,notes\nAcme Contractors,(512) 555-0100,info@example.com,Preferred" />
                </label>
                <div style={styles.inlineActions}>
                  <button type="button" style={styles.secondaryButton} onClick={handlePreviewImport}>PREVIEW IMPORT</button>
                  <button type="button" style={styles.secondaryButton} onClick={handleApplyImport} disabled={importing}>{importing ? "IMPORTING..." : "APPLY IMPORT"}</button>
                </div>
                {importPreview ? (
                  <div style={styles.successMessage}>Preview summary: {importPreview.summary.accepted} ready, {importPreview.summary.flagged} flagged.</div>
                ) : null}
                <div style={styles.inlineActions}>
                  <button type="button" style={styles.secondaryButton} onClick={handleExport}>EXPORT FILTERED DATA</button>
                  <button type="button" style={styles.secondaryButton} onClick={handleExportCsv}>EXPORT CSV</button>
                </div>
              </div>
            </div>

            <div style={styles.section}>
              <h3 style={styles.sectionTitle}>PROJECT MANAGEMENT</h3>
              <div style={styles.formGrid}>
                <label style={styles.label}><span style={styles.fieldLabel}>Property Address</span><input type="text" name="propertyAddress" value={projectForm.propertyAddress} onChange={handleProjectFieldChange} style={styles.input} /></label>
                <label style={styles.label}><span style={styles.fieldLabel}>Project Scope</span><input type="text" name="projectScope" value={projectForm.projectScope} onChange={handleProjectFieldChange} style={styles.input} /></label>
                <label style={styles.label}><span style={styles.fieldLabel}>Start Date</span><input type="date" name="startDate" value={projectForm.startDate} onChange={handleProjectFieldChange} style={styles.input} /></label>
                <label style={styles.label}><span style={styles.fieldLabel}>Estimated Completion Date</span><input type="date" name="estimatedCompletionDate" value={projectForm.estimatedCompletionDate} onChange={handleProjectFieldChange} style={styles.input} /></label>
                <label style={styles.label}><span style={styles.fieldLabel}>Actual Completion Date</span><input type="date" name="actualCompletionDate" value={projectForm.actualCompletionDate} onChange={handleProjectFieldChange} style={styles.input} /></label>
                <label style={styles.label}><span style={styles.fieldLabel}>Project Status</span><select name="projectStatus" value={projectForm.projectStatus} onChange={handleProjectFieldChange} style={styles.select}>{projectStatuses.map((status) => <option key={status} value={status}>{status}</option>)}</select></label>
                <label style={styles.label}><span style={styles.fieldLabel}>Contract Amount</span><input type="number" min="0" name="contractAmount" value={projectForm.contractAmount} onChange={handleProjectFieldChange} style={styles.input} /></label>
                <label style={styles.label}><span style={styles.fieldLabel}>Amount Paid</span><input type="number" min="0" name="amountPaid" value={projectForm.amountPaid} onChange={handleProjectFieldChange} style={styles.input} /></label>
                <label style={styles.label}><span style={styles.fieldLabel}>Change Orders</span><input type="number" min="0" name="changeOrders" value={projectForm.changeOrders} onChange={handleProjectFieldChange} style={styles.input} /></label>
                <label style={styles.label}><span style={styles.fieldLabel}>Project Notes</span><textarea name="projectNotes" value={projectForm.projectNotes} onChange={handleProjectFieldChange} style={{ ...styles.input, minHeight: "90px" }} /></label>
              </div>
              <div style={styles.formActions}><button type="button" style={styles.primaryButton} onClick={handleSaveProject}>SAVE PROJECT</button></div>
              <div style={styles.selectionList}>
                {(selectedContractor?.projects || []).map((project) => (
                  <div key={project.id} style={styles.selectionRow}>
                    <div>
                      <div style={styles.productNameCell}>{project.propertyAddress || "Untitled Project"}</div>
                      <div style={styles.productMeta}>{project.projectStatus} • Remaining {formatCurrency(getAmountRemaining(project.contractAmount, project.changeOrders, project.amountPaid))}</div>
                    </div>
                    <div style={styles.inlineActions}>
                      <button type="button" style={styles.tableButton} onClick={() => handleEditProject(project)}>Edit</button>
                      <button type="button" style={styles.tableButton} onClick={() => handleMarkProjectComplete(project)}>Complete</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div style={styles.section}>
            <h3 style={styles.sectionTitle}>CONTRACTOR RANKING</h3>
            <div style={styles.summaryGrid}>
              {rankedContractors.slice(0, 5).map((contractor, index) => (
                <div key={contractor.id} style={styles.summaryCard}>
                  <div style={styles.summaryLabel}>#{index + 1} {contractor.companyName}</div>
                  <div style={styles.summaryValue}>{formatPercent(getOverallScore(contractor) / 10)}</div>
                  <div style={styles.summaryLabel}>{contractor.preferred ? "Preferred" : "Standard"} • {contractor.status}</div>
                </div>
              ))}
            </div>
          </div>

          <div style={styles.section}>
            <h3 style={styles.sectionTitle}>CONTRACTOR LIST</h3>
            {filteredContractors.length === 0 ? (
              <div style={styles.emptyState}>
                No contractors available.
                <div style={{ marginTop: "8px" }}><button type="button" style={styles.primaryButton} onClick={handleClearForm}>Add Contractor</button></div>
              </div>
            ) : (
              <div style={styles.tableWrap}>
                <table style={styles.table}>
                  <thead>
                    <tr>
                      <th style={styles.th}>Company</th>
                      <th style={styles.th}>Contact</th>
                      <th style={styles.th}>Trade</th>
                      <th style={styles.th}>Phone</th>
                      <th style={styles.th}>Email</th>
                      <th style={styles.th}>Area</th>
                      <th style={styles.th}>Score</th>
                      <th style={styles.th}>Status</th>
                      <th style={styles.th}>Insurance</th>
                      <th style={styles.th}>Jobs</th>
                      <th style={styles.th}>View</th>
                      <th style={styles.th}>Edit</th>
                      <th style={styles.th}>Delete</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredContractors.map((contractor) => (
                      <tr key={contractor.id}>
                        <td style={styles.td}>{contractor.companyName}</td>
                        <td style={styles.td}>{contractor.contactName}</td>
                        <td style={styles.td}>{contractor.trade}</td>
                        <td style={styles.td}>{contractor.phone}</td>
                        <td style={styles.td}>{contractor.email}</td>
                        <td style={styles.td}>{contractor.serviceArea}</td>
                        <td style={styles.td}>{formatPercent(getOverallScore(contractor) / 10)}</td>
                        <td style={styles.td}>{contractor.status}</td>
                        <td style={styles.td}>{contractor.insuranceExpiration || "—"}</td>
                        <td style={styles.td}>{(contractor.projects || []).length}</td>
                        <td style={styles.td}><button type="button" style={styles.tableButton} onClick={() => setSelectedContractorId(contractor.id)}>View</button></td>
                        <td style={styles.td}><button type="button" style={styles.tableButton} onClick={() => handleSelectContractor(contractor)}>Edit</button></td>
                        <td style={styles.td}><button type="button" style={styles.tableButton} onClick={() => handleDeleteContractor(contractor.id)}>Delete</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {selectedContractor ? (
            <div style={styles.section}>
              <h3 style={styles.sectionTitle}>DETAIL PANEL</h3>
              <div style={styles.summaryGrid}>
                <SummaryCard label="Recommendation" value={recommendation?.label || "Review"} />
                <SummaryCard label="Overall Score" value={formatPercent(getOverallScore(selectedContractor) / 10)} />
                <SummaryCard label="Preferred" value={selectedContractor.preferred ? "Yes" : "No"} />
                <SummaryCard label="Insurance" value={selectedContractor.insuranceExpiration || "—"} />
              </div>
              <div style={styles.recommendationBox}>
                <div style={styles.summaryValue}>{recommendation?.label || "Review"}</div>
                <div style={styles.summaryLabel}>{recommendation?.reason || "No recommendation provided."}</div>
              </div>
              <div style={styles.warningList}>
                {warnings.map((warning) => <div key={warning} style={styles.warning}>{warning}</div>)}
              </div>
              <div style={styles.gridTwo}>
                <div style={styles.section}>
                  <h4 style={styles.sectionTitle}>SCORECARD</h4>
                  <div style={styles.summaryGrid}>
                    {[
                      ["Quality", selectedContractor.qualityScore],
                      ["Speed", selectedContractor.speedScore],
                      ["Communication", selectedContractor.communicationScore],
                      ["Budget Accuracy", selectedContractor.budgetAccuracyScore],
                      ["Reliability", selectedContractor.reliabilityScore],
                      ["Cleanliness", selectedContractor.cleanlinessScore],
                    ].map(([label, value]) => <SummaryCard key={label} label={label} value={value !== "" && value !== null && value !== undefined ? value : "—"} />)}
                  </div>
                </div>
                <div style={styles.section}>
                  <h4 style={styles.sectionTitle}>DOCUMENT STATUS</h4>
                  {[
                    ["Insurance Certificate", selectedContractor.insuranceCertificateStatus],
                    ["License Document", selectedContractor.licenseDocumentStatus],
                    ["W-9 Document", selectedContractor.w9DocumentStatus],
                    ["Contract Document", selectedContractor.contractDocumentStatus],
                    ["Before Photos", selectedContractor.beforePhotosStatus],
                    ["After Photos", selectedContractor.afterPhotosStatus],
                    ["Lien Waiver", selectedContractor.lienWaiverStatus],
                  ].map(([label, value]) => <div key={label} style={styles.detailRow}><span>{label}</span><span>{value}</span></div>)}
                </div>
              </div>
              <div style={styles.section}>
                <h4 style={styles.sectionTitle}>PROJECTS</h4>
                {(selectedContractor.projects || []).length === 0 ? <div style={styles.emptyState}>No active projects assigned.</div> : (selectedContractor.projects || []).map((project) => (
                  <div key={project.id} style={styles.projectCard}>
                    <div style={styles.productNameCell}>{project.propertyAddress || "Untitled Project"}</div>
                    <div style={styles.productMeta}>{project.projectScope || "No scope"}</div>
                    <div style={styles.detailRow}><span>Status</span><span>{project.projectStatus}</span></div>
                    <div style={styles.detailRow}><span>Contract</span><span>{formatCurrency(project.contractAmount)}</span></div>
                    <div style={styles.detailRow}><span>Paid</span><span>{formatCurrency(project.amountPaid)}</span></div>
                    <div style={styles.detailRow}><span>Remaining</span><span>{formatCurrency(getAmountRemaining(project.contractAmount, project.changeOrders, project.amountPaid))}</span></div>
                    {toNumber(project.amountPaid) > toNumber(project.contractAmount) + toNumber(project.changeOrders) ? <div style={styles.warning}>Overpaid adjustment detected.</div> : null}
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </section>
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
  successMessage: { border: "1px solid #4caf50", color: "#4caf50", padding: "8px 10px", marginBottom: "10px", fontSize: "12px" },
  errorMessage: { border: "1px solid #ff6b6b", color: "#ff6b6b", padding: "8px 10px", marginBottom: "10px", fontSize: "12px" },
  emptyState: { border: `1px dashed ${BORDER}`, padding: "14px", color: "#f9e27b", fontSize: "12px", background: "#0c0c0c" },
  selectionList: { display: "flex", flexDirection: "column", gap: "8px", marginTop: "10px" },
  selectionRow: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px", padding: "8px 10px", border: `1px solid ${BORDER}`, background: "#0c0c0c", fontSize: "12px" },
  tableWrap: { overflowX: "auto" },
  table: { width: "100%", borderCollapse: "collapse", fontSize: "12px" },
  th: { textAlign: "left", padding: "8px 6px", borderBottom: `1px solid ${BORDER}`, color: GOLD, textTransform: "uppercase" },
  td: { padding: "8px 6px", borderBottom: "1px solid #2a2400", verticalAlign: "top" },
  productNameCell: { fontWeight: 700, color: GOLD },
  productMeta: { fontSize: "11px", color: "#f9e27b", marginTop: "2px" },
  tableButton: { border: `1px solid ${BORDER}`, background: "#111111", color: GOLD, padding: "6px 8px", cursor: "pointer" },
  inlineActions: { display: "flex", gap: "8px" },
  recommendationBox: { border: `1px solid ${BORDER}`, background: "#0c0c0c", padding: "12px", marginBottom: "10px" },
  warningList: { display: "flex", flexDirection: "column", gap: "8px", marginBottom: "10px" },
  warning: { border: "1px solid #ff6b6b", color: "#ff6b6b", padding: "8px 10px", fontSize: "12px" },
  detailRow: { display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid #2a2400", fontSize: "12px" },
  projectCard: { border: `1px solid ${BORDER}`, background: "#0c0c0c", padding: "10px", marginBottom: "8px" },
};
