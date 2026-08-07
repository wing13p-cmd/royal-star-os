import { useEffect, useMemo, useState } from "react";
import { buildApiUrl } from "../utils/apiClient.js";
import logo from "../assets/royal-star-logo.png";
import { buildModuleSyncState, buildRehabProjectFromDeal } from "./moduleSync.js";
import { buildProjectExecutionIntelligenceEngine } from "./projectExecutionIntelligenceEngine.js";

const API_BASE_URL = "";

const projectStatusOptions = ["Planning", "Pre-Construction", "Permitting", "Ready to Start", "In Progress", "On Hold", "Delayed", "Punch List", "Final Inspection", "Complete", "Closed", "Cancelled"];
const projectTypeOptions = ["Full Gut", "Medium Rehab", "Light Rehab", "Rental Turnover", "Flip Rehab", "BRRRR Rehab", "Maintenance", "Emergency Repair", "Exterior Only", "Interior Only", "Other"];
const strategyOptions = ["Flip", "BRRRR", "Rental", "Hold", "Refinance", "Sale", "Other"];
const priorityOptions = ["Critical", "High", "Medium", "Low"];
const riskLevelOptions = ["Low", "Moderate", "High", "Critical"];
const recommendationOptions = ["On Track", "Watch", "Corrective Action Required", "Pause Work", "Re-Underwrite", "Replace Contractor", "Ready for Closeout"];
const phaseStatusOptions = ["Not Started", "Ready", "In Progress", "Blocked", "Delayed", "Awaiting Inspection", "Failed Inspection", "Complete", "Not Applicable"];
const paymentStatusOptions = ["Not Invoiced", "Invoiced", "Partially Paid", "Paid", "Disputed", "Hold", "Cancelled"];
const changeOrderStatusOptions = ["Draft", "Submitted", "Under Review", "Approved", "Rejected", "Cancelled", "Completed"];
const drawStatusOptions = ["Draft", "Submitted", "Under Review", "Inspection Scheduled", "Approved", "Partially Funded", "Funded", "Rejected", "Cancelled"];
const inspectionResultsOptions = ["Scheduled", "Passed", "Failed", "Conditional", "Cancelled", "Not Required"];
const punchListStatusOptions = ["Open", "Assigned", "In Progress", "Ready for Review", "Rework Required", "Complete", "Waived"];
const photoCategories = ["Before", "Demo", "Progress", "Inspection", "Punch List", "Completed", "Other"];
const documentCategories = ["Scope of Work", "Rehab Budget", "Contract", "Change Order", "Invoice", "Receipt", "Lien Waiver", "Draw Request", "Inspection Report", "Permit", "Insurance", "Contractor License", "Material Order", "Warranty", "Closeout Document", "Other"];
const standardPhases = ["Planning", "Demo", "Framing", "Rough HVAC", "Rough Plumbing", "Rough Electrical", "Insulation", "Fire Blocking", "Windows", "Tubs and Showers", "Drywall and Backer", "Waterproofing", "Prime and Paint", "Flooring", "Cabinets and Vanities", "Countertops", "Finish Plumbing", "Finish Electrical", "Finish HVAC", "Exterior", "Landscaping", "Cleaning", "Punch List", "Final Inspection", "Closeout"];
const sortOptions = [
  ["updated", "Most Recently Updated"],
  ["name", "Project Name"],
  ["newest", "Newest"],
  ["oldest", "Oldest"],
  ["budgetHigh", "Highest Budget"],
  ["costHigh", "Highest Actual Cost"],
  ["overrunHigh", "Largest Budget Overrun"],
  ["completeHigh", "Highest Percent Complete"],
  ["completeLow", "Lowest Percent Complete"],
  ["riskHigh", "Highest Risk"],
  ["dueSoon", "Earliest Completion"],
  ["dueLate", "Latest Completion"],
];

const initialValues = {
  id: "",
  projectName: "",
  propertyId: "",
  propertyName: "",
  propertyAddress: "",
  city: "",
  state: "",
  zipCode: "",
  strategy: "Flip",
  projectType: "Full Gut",
  projectStatus: "Planning",
  priority: "Medium",
  projectManager: "",
  contractorId: "",
  contractorName: "",
  lenderId: "",
  lenderName: "",
  projectedStartDate: "",
  actualStartDate: "",
  projectedCompletionDate: "",
  actualCompletionDate: "",
  currentPhase: "Planning",
  nextMilestone: "",
  nextMilestoneDate: "",
  percentComplete: "",
  purchasePrice: "",
  originalRehabBudget: "",
  approvedChangeOrders: "",
  pendingChangeOrders: "",
  currentRehabBudget: "",
  committedCost: "",
  actualCost: "",
  amountPaid: "",
  remainingBudget: "",
  projectedFinalCost: "",
  budgetVariance: "",
  contingencyPercentage: "",
  contingencyAmount: "",
  contingencyUsed: "",
  contingencyRemaining: "",
  projectedARV: "",
  totalProjectCost: "",
  projectedProfit: "",
  projectedROI: "",
  drawCount: "",
  drawAmountRequested: "",
  drawAmountApproved: "",
  drawAmountPaid: "",
  permitStatus: "",
  lienWaiverStatus: "",
  insuranceStatus: "",
  licenseStatus: "",
  finalInspectionStatus: "",
  punchListStatus: "",
  closeoutStatus: "",
  riskLevel: "Moderate",
  recommendation: "Watch",
  favorite: false,
  notes: "",
  createdAt: "",
  updatedAt: "",
  phases: [],
  budgetLineItems: [],
  changeOrders: [],
  draws: [],
  inspections: [],
  punchListItems: [],
  projectPhotos: [],
  projectDocuments: [],
};

function createId(prefix = "project") {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

function parseNumber(value) {
  if (value === "" || value === null || value === undefined) return "";
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : "";
}

function formatCurrency(value) {
  if (value === "" || value === null || value === undefined) return "Insufficient Data";
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return "Insufficient Data";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(numericValue);
}

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString();
}

function safePercent(value) {
  if (value === "" || value === null || value === undefined) return "";
  const numericValue = Number(value);
  return Number.isFinite(numericValue) && numericValue >= 0 && numericValue <= 100 ? numericValue : "";
}

function deriveProjectMetrics(project) {
  const originalRehabBudget = Number(project.originalRehabBudget || 0);
  const approvedChangeOrders = Number(project.approvedChangeOrders || 0);
  const pendingChangeOrders = Number(project.pendingChangeOrders || 0);
  const committedCost = Number(project.committedCost || 0);
  const actualCost = Number(project.actualCost || 0);
  const amountPaid = Number(project.amountPaid || 0);
  const purchasePrice = Number(project.purchasePrice || 0);
  const projectedARV = Number(project.projectedARV || 0);
  const contingencyPercentage = Number(project.contingencyPercentage || 0);
  const contingencyUsed = Number(project.contingencyUsed || 0);
  const drawAmountApproved = Number(project.drawAmountApproved || 0);
  const drawAmountPaid = Number(project.drawAmountPaid || 0);

  const currentRehabBudget = originalRehabBudget + approvedChangeOrders;
  const remainingBudget = currentRehabBudget - actualCost;
  const projectedFinalCost = actualCost + committedCost + pendingChangeOrders;
  const budgetVariance = currentRehabBudget - projectedFinalCost;
  const contingencyAmount = contingencyPercentage > 0 ? (originalRehabBudget * contingencyPercentage) / 100 : 0;
  const contingencyRemaining = contingencyAmount - contingencyUsed;
  const totalProjectCost = purchasePrice + projectedFinalCost;
  const projectedProfit = projectedARV - totalProjectCost;
  const projectedROI = totalProjectCost > 0 ? (projectedProfit / totalProjectCost) * 100 : "";
  const drawCompletionPercentage = drawAmountApproved > 0 ? (drawAmountPaid / drawAmountApproved) * 100 : "";

  return {
    currentRehabBudget: currentRehabBudget || "",
    remainingBudget: remainingBudget || "",
    projectedFinalCost: projectedFinalCost || "",
    budgetVariance: budgetVariance || "",
    contingencyAmount: contingencyAmount || "",
    contingencyRemaining: contingencyRemaining || "",
    totalProjectCost: totalProjectCost || "",
    projectedProfit: projectedProfit || "",
    projectedROI: projectedROI || "",
    drawCompletionPercentage: drawCompletionPercentage || "",
    amountPaid: amountPaid || "",
  };
}

function calculateWarnings(project) {
  const derived = deriveProjectMetrics(project);
  const warnings = [];
  if (!project.projectName) warnings.push("Missing project name");
  if (!project.propertyAddress && !project.propertyId) warnings.push("Missing property address or linked property");
  if (!project.projectType) warnings.push("Missing project type");
  if (!project.projectStatus) warnings.push("Missing project status");
  if (!project.strategy) warnings.push("Missing strategy");
  if (!project.priority) warnings.push("Missing priority");
  if (!project.originalRehabBudget) warnings.push("Missing original rehab budget");
  if (!project.projectedStartDate) warnings.push("Missing projected start date");
  if (!project.projectedCompletionDate) warnings.push("Missing projected completion date");
  if (project.projectedStartDate && project.projectedCompletionDate && new Date(project.projectedCompletionDate) < new Date(project.projectedStartDate)) warnings.push("Completion date precedes start date");
  if (Number(project.originalRehabBudget || 0) > Number(project.currentRehabBudget || 0)) warnings.push("Project over budget");
  if (project.projectedFinalCost && project.currentRehabBudget && project.projectedFinalCost > project.currentRehabBudget) warnings.push("Projected final cost over budget");
  if (project.contingencyPercentage && Number(project.contingencyPercentage) > 50 && Number(project.contingencyUsed || 0) > 0) warnings.push("Contingency more than 50% used");
  if (project.contingencyRemaining !== "" && Number(project.contingencyRemaining) <= 0) warnings.push("Contingency exhausted");
  if (project.projectedCompletionDate && new Date(project.projectedCompletionDate) < new Date()) warnings.push("Project past completion date");
  const phaseBlocked = (project.phases || []).some((phase) => phase.status === "Blocked");
  if (phaseBlocked) warnings.push("Blocked phase");
  if (!project.contractorName && project.projectStatus !== "Planning") warnings.push("Missing contractor");
  if (!project.permitStatus) warnings.push("Missing permit");
  if ((project.inspections || []).some((item) => item.result === "Failed")) warnings.push("Failed inspection");
  if ((project.draws || []).some((item) => item.status === "Approved" && !item.paidAmount && item.approvedAmount)) warnings.push("Approved draw unpaid");
  if (!project.lienWaiverStatus || project.lienWaiverStatus === "Pending") warnings.push("Missing lien waiver");
  if ((project.budgetLineItems || []).some((item) => item.paymentStatus === "Invoiced" || item.paymentStatus === "Partially Paid")) warnings.push("Overdue invoice");
  if ((project.budgetLineItems || []).some((item) => Number(item.actualCost || 0) > Number(item.currentBudget || 0))) warnings.push("Unpaid balance");
  if ((project.punchListItems || []).some((item) => item.status !== "Complete" && item.dueDate && new Date(item.dueDate) < new Date())) warnings.push("Punch-list item overdue");
  if (project.projectStatus === "Complete" && !project.finalInspectionStatus) warnings.push("Final inspection incomplete");
  if (!project.projectDocuments.some((document) => document.category === "Closeout Document")) warnings.push("Missing closeout documents");
  if (!project.projectPhotos.some((photo) => photo.category === "Before")) warnings.push("Missing before photos");
  if (!project.projectPhotos.some((photo) => photo.category === "Progress")) warnings.push("Missing progress photos");
  if (!project.projectPhotos.some((photo) => photo.category === "Completed")) warnings.push("Missing completed photos");
  if (project.updatedAt) {
    const updatedAt = new Date(project.updatedAt);
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 14);
    if (updatedAt < cutoff) warnings.push("Project not updated within 14 days");
  }
  if (project.projectedProfit !== "" && Number(project.projectedProfit) < 0) warnings.push("Projected profit negative");
  if (project.projectedROI !== "" && Number(project.projectedROI) < 0) warnings.push("Projected ROI below target");
  if (derived.projectedFinalCost !== "" && project.originalRehabBudget && derived.projectedFinalCost > project.originalRehabBudget) warnings.push("Projected final cost over budget");
  return warnings;
}

function evaluateRecommendation(project) {
  const warnings = calculateWarnings(project);
  if (warnings.includes("Missing closeout documents") || warnings.includes("Final inspection incomplete")) return "Ready for Closeout";
  if (warnings.includes("Projected profit negative") || warnings.includes("Projected ROI below target") || warnings.includes("Contingency exhausted")) return "Re-Underwrite";
  if (warnings.includes("Blocked phase") || warnings.includes("Failed inspection") || warnings.includes("Approved draw unpaid")) return "Corrective Action Required";
  if (warnings.includes("Project past completion date") || warnings.includes("Project delayed more than 14 days") || warnings.includes("Contingency more than 50% used")) return "Pause Work";
  if (warnings.includes("Missing contractor") || warnings.includes("Missing permit") || warnings.includes("Missing lien waiver")) return "Watch";
  return "On Track";
}

function buildProjectRecord(project) {
  const derived = deriveProjectMetrics(project);
  const warnings = calculateWarnings(project);
  return {
    ...project,
    ...derived,
    warnings,
    recommendation: project.recommendation || evaluateRecommendation(project),
    riskLevel: project.riskLevel || (warnings.length > 6 ? "Critical" : warnings.length > 3 ? "High" : warnings.length > 1 ? "Moderate" : "Low"),
  };
}

function downloadJson(filename, rows) {
  const blob = new Blob([JSON.stringify(rows, null, 2)], { type: "application/json" });
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
  if (rows.length === 0) rows = [{ empty: "No data" }];
  const headers = Object.keys(rows[0]);
  const lines = [headers.join(",")];
  rows.forEach((row) => {
    lines.push(headers.map((header) => `"${String(row[header] ?? "").replace(/"/g, '""')}"`).join(","));
  });
  const blob = new Blob([lines.join("\n")], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export default function RehabProjectTracker({ onBack, onOpenDealAnalyzer, onOpenFlipAnalyzer, onOpenBrrrrAnalyzer, onOpenProductVault, onOpenContractorHub, onOpenCompDatabase, onOpenDealIntelligence, onOpenNeighborhoodDatabase, onOpenPortfolioDashboard, onOpenPropertyDatabase, onOpenVendorDatabase, onOpenMaterialMatrix, onOpenLenderDashboard, onOpenAppraiserPacketBuilder, onOpenDealIntake }) {
  const [projects, setProjects] = useState([]);
  const [properties, setProperties] = useState([]);
  const [deals, setDeals] = useState([]);
  const [contractors, setContractors] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [lenders, setLenders] = useState([]);
  const [appraisalPackets, setAppraisalPackets] = useState([]);
  const [formValues, setFormValues] = useState(initialValues);
  const [editingId, setEditingId] = useState(null);
  const [viewRecord, setViewRecord] = useState(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [typeFilter, setTypeFilter] = useState("All");
  const [strategyFilter, setStrategyFilter] = useState("All");
  const [priorityFilter, setPriorityFilter] = useState("All");
  const [stateFilter, setStateFilter] = useState("All");
  const [cityFilter, setCityFilter] = useState("");
  const [zipFilter, setZipFilter] = useState("");
  const [currentPhaseFilter, setCurrentPhaseFilter] = useState("All");
  const [contractorFilter, setContractorFilter] = useState("All");
  const [lenderFilter, setLenderFilter] = useState("All");
  const [riskFilter, setRiskFilter] = useState("All");
  const [recommendationFilter, setRecommendationFilter] = useState("All");
  const [favoriteFilter, setFavoriteFilter] = useState("All");
  const [overBudgetFilter, setOverBudgetFilter] = useState("All");
  const [pastDueFilter, setPastDueFilter] = useState("All");
  const [delayedFilter, setDelayedFilter] = useState("All");
  const [failedInspectionFilter, setFailedInspectionFilter] = useState("All");
  const [missingLienWaiverFilter, setMissingLienWaiverFilter] = useState("All");
  const [percentCompleteFilter, setPercentCompleteFilter] = useState("");
  const [sortBy, setSortBy] = useState("updated");
  const [message, setMessage] = useState({ type: "info", text: "" });
  const [loading, setLoading] = useState(true);
  const [comparisonIds, setComparisonIds] = useState([]);
  const [printView, setPrintView] = useState(false);
  const [phaseDraft, setPhaseDraft] = useState({ id: "", phaseName: "", sequenceNumber: "", status: "Not Started", contractorId: "", contractorName: "", projectedStartDate: "", actualStartDate: "", projectedCompletionDate: "", actualCompletionDate: "", percentComplete: "", originalBudget: "", approvedChangeOrders: "", currentBudget: "", committedCost: "", actualCost: "", remainingBudget: "", inspectionRequired: false, inspectionStatus: "Not Required", dependencies: "", notes: "" });
  const [budgetItemDraft, setBudgetItemDraft] = useState({ id: "", category: "", subcategory: "", description: "", phaseId: "", phaseName: "", contractorId: "", contractorName: "", vendorId: "", vendorName: "", materialId: "", materialName: "", quantity: "", unit: "", unitCost: "", originalBudget: "", approvedChangeOrders: "", currentBudget: "", committedCost: "", actualCost: "", amountPaid: "", remainingBalance: "", variance: "", invoiceNumber: "", invoiceDate: "", dueDate: "", paidDate: "", paymentStatus: "Not Invoiced", receiptUrl: "", invoiceUrl: "", lienWaiverRequired: false, lienWaiverReceived: false, notes: "" });
  const [changeOrderDraft, setChangeOrderDraft] = useState({ id: "", changeOrderNumber: "", title: "", description: "", requestedBy: "", contractorId: "", contractorName: "", phaseId: "", phaseName: "", requestedDate: "", decisionDate: "", status: "Draft", costImpact: "", scheduleImpactDays: "", reason: "", approvalNotes: "", documentUrl: "" });
  const [drawDraft, setDrawDraft] = useState({ id: "", drawNumber: "", lenderId: "", lenderName: "", requestedDate: "", requestedAmount: "", approvedDate: "", approvedAmount: "", paidDate: "", paidAmount: "", status: "Draft", inspectionRequired: false, inspectionDate: "", inspectorName: "", lienWaiverRequired: false, lienWaiverReceived: false, documentUrl: "", notes: "" });
  const [inspectionDraft, setInspectionDraft] = useState({ id: "", inspectionType: "", phaseId: "", inspectorName: "", scheduledDate: "", completedDate: "", result: "Scheduled", correctionsRequired: "", reinspectionDate: "", documentUrl: "", notes: "" });
  const [punchListDraft, setPunchListDraft] = useState({ id: "", item: "", category: "", phaseId: "", location: "", contractorId: "", contractorName: "", priority: "Medium", status: "Open", dateAdded: "", dueDate: "", completedDate: "", estimatedCost: "", actualCost: "", photoUrl: "", notes: "" });
  const [photoDraft, setPhotoDraft] = useState({ category: photoCategories[0], url: "" });
  const [documentDraft, setDocumentDraft] = useState({ category: documentCategories[0], url: "" });

  const loadProjects = async () => {
    setLoading(true);
    try {
      const response = await fetch(buildApiUrl("/api/rehab-projects"));
      if (!response.ok) throw new Error("backend unavailable");
      const data = await response.json();
      setProjects(Array.isArray(data) ? data : []);
    } catch (error) {
      try {
        const stored = JSON.parse(window.localStorage.getItem("royalStarRehabProjects") || "[]") || [];
        setProjects(Array.isArray(stored) ? stored : []);
      } catch {
        setProjects([]);
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

    const [propertiesData, dealsData, contractorsData, vendorsData, materialsData, lendersData, appraisalData] = await Promise.all([
      fetchJson("/api/properties", "royalStarProperties"),
      fetchJson("/api/deals", "royalStarDeals"),
      fetchJson("/api/contractors", "royalStarContractors"),
      fetchJson("/api/vendors", "royalStarVendors"),
      fetchJson("/api/material-matrix", "royalStarMaterialMatrix"),
      fetchJson("/api/lenders", "royalStarLenders"),
      fetchJson("/api/appraisal-packets", "royalStarAppraisalPackets"),
    ]);
    setProperties(propertiesData);
    setDeals(dealsData);
    setContractors(contractorsData);
    setVendors(vendorsData);
    setMaterials(materialsData);
    setLenders(lendersData);
    setAppraisalPackets(appraisalData);
  };

  useEffect(() => {
    void loadProjects();
    void loadRelatedData();
  }, []);

  const enrichedProjects = useMemo(() => projects.map((project) => buildProjectRecord(project)), [projects]);
  const syncState = useMemo(() => buildModuleSyncState({ deals, properties, portfolioEntries: [], rehabProjects: projects, contractors, lenders, appraisalPackets }), [deals, properties, projects, contractors, lenders, appraisalPackets]);

  const visibleProjects = useMemo(() => {
    const searchTerm = search.trim().toLowerCase();
    let filtered = enrichedProjects.filter((project) => {
      const haystack = [project.projectName, project.propertyName, project.propertyAddress, project.city, project.zipCode, project.contractorName, project.lenderName, project.currentPhase, project.notes].join(" ").toLowerCase();
      const matchesSearch = !searchTerm || haystack.includes(searchTerm);
      const matchesStatus = statusFilter === "All" || project.projectStatus === statusFilter;
      const matchesType = typeFilter === "All" || project.projectType === typeFilter;
      const matchesStrategy = strategyFilter === "All" || project.strategy === strategyFilter;
      const matchesPriority = priorityFilter === "All" || project.priority === priorityFilter;
      const matchesState = stateFilter === "All" || project.state === stateFilter;
      const matchesCity = !cityFilter || project.city?.toLowerCase().includes(cityFilter.toLowerCase());
      const matchesZip = !zipFilter || project.zipCode?.includes(zipFilter);
      const matchesPhase = currentPhaseFilter === "All" || project.currentPhase === currentPhaseFilter;
      const matchesContractor = contractorFilter === "All" || project.contractorName === contractorFilter;
      const matchesLender = lenderFilter === "All" || project.lenderName === lenderFilter;
      const matchesRisk = riskFilter === "All" || project.riskLevel === riskFilter;
      const matchesRecommendation = recommendationFilter === "All" || project.recommendation === recommendationFilter;
      const matchesFavorite = favoriteFilter === "All" || (favoriteFilter === "Favorites Only" ? project.favorite : !project.favorite);
      const matchesOverBudget = overBudgetFilter === "All" || (overBudgetFilter === "Yes" ? project.warnings.includes("Project over budget") || project.warnings.includes("Projected final cost over budget") : !project.warnings.includes("Project over budget") && !project.warnings.includes("Projected final cost over budget"));
      const matchesPastDue = pastDueFilter === "All" || (pastDueFilter === "Yes" ? project.warnings.includes("Project past completion date") : !project.warnings.includes("Project past completion date"));
      const matchesDelayed = delayedFilter === "All" || (delayedFilter === "Yes" ? project.warnings.includes("Project delayed more than 7 days") || project.warnings.includes("Project delayed more than 14 days") : !project.warnings.includes("Project delayed more than 7 days") && !project.warnings.includes("Project delayed more than 14 days"));
      const matchesFailedInspection = failedInspectionFilter === "All" || (failedInspectionFilter === "Yes" ? project.warnings.includes("Failed inspection") : !project.warnings.includes("Failed inspection"));
      const matchesMissingLienWaiver = missingLienWaiverFilter === "All" || (missingLienWaiverFilter === "Yes" ? project.warnings.includes("Missing lien waiver") : !project.warnings.includes("Missing lien waiver"));
      const matchesPercentComplete = !percentCompleteFilter || Number(project.percentComplete || 0) >= Number(percentCompleteFilter);
      return matchesSearch && matchesStatus && matchesType && matchesStrategy && matchesPriority && matchesState && matchesCity && matchesZip && matchesPhase && matchesContractor && matchesLender && matchesRisk && matchesRecommendation && matchesFavorite && matchesOverBudget && matchesPastDue && matchesDelayed && matchesFailedInspection && matchesMissingLienWaiver && matchesPercentComplete;
    });

    switch (sortBy) {
      case "name": filtered.sort((a, b) => (a.projectName || "").localeCompare(b.projectName || "")); break;
      case "newest": filtered.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || "")); break;
      case "oldest": filtered.sort((a, b) => (a.createdAt || "").localeCompare(b.createdAt || "")); break;
      case "budgetHigh": filtered.sort((a, b) => Number(b.originalRehabBudget || 0) - Number(a.originalRehabBudget || 0)); break;
      case "costHigh": filtered.sort((a, b) => Number(b.actualCost || 0) - Number(a.actualCost || 0)); break;
      case "overrunHigh": filtered.sort((a, b) => Number(b.budgetVariance || 0) - Number(a.budgetVariance || 0)); break;
      case "completeHigh": filtered.sort((a, b) => Number(b.percentComplete || 0) - Number(a.percentComplete || 0)); break;
      case "completeLow": filtered.sort((a, b) => Number(a.percentComplete || 0) - Number(b.percentComplete || 0)); break;
      case "riskHigh": filtered.sort((a, b) => { const rank = { Low: 0, Moderate: 1, High: 2, Critical: 3 }; return rank[b.riskLevel || "Low"] - rank[a.riskLevel || "Low"]; }); break;
      case "dueSoon": filtered.sort((a, b) => (a.projectedCompletionDate || "").localeCompare(b.projectedCompletionDate || "")); break;
      case "dueLate": filtered.sort((a, b) => (b.projectedCompletionDate || "").localeCompare(a.projectedCompletionDate || "")); break;
      case "updated": default: filtered.sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || "")); break;
    }
    return filtered;
  }, [enrichedProjects, search, statusFilter, typeFilter, strategyFilter, priorityFilter, stateFilter, cityFilter, zipFilter, currentPhaseFilter, contractorFilter, lenderFilter, riskFilter, recommendationFilter, favoriteFilter, overBudgetFilter, pastDueFilter, delayedFilter, failedInspectionFilter, missingLienWaiverFilter, percentCompleteFilter, sortBy]);

  const enterpriseExecutionSignal = useMemo(() => {
    const focusProject = viewRecord || visibleProjects[0] || enrichedProjects[0] || null;
    if (!focusProject) return null;
    const execution = buildProjectExecutionIntelligenceEngine({
      project: {
        ...focusProject,
        id: focusProject.id,
        linkedDealId: focusProject.linkedDealId,
      },
      approvedArv: Number(focusProject.projectedARV || 0),
      approvedFinancingCost: Number(focusProject.financingCost || focusProject.financingCosts || 0),
      permitRecords: Array.isArray(focusProject.inspections) ? focusProject.inspections : [],
      photos: Array.isArray(focusProject.projectPhotos) ? focusProject.projectPhotos : [],
      documents: Array.isArray(focusProject.projectDocuments) ? focusProject.projectDocuments : [],
      qualityItems: Array.isArray(focusProject.punchListItems) ? focusProject.punchListItems : [],
      changeOrders: Array.isArray(focusProject.changeOrders) ? focusProject.changeOrders : [],
      draws: Array.isArray(focusProject.draws) ? focusProject.draws : [],
    });

    return {
      projectId: focusProject.id,
      projectName: focusProject.projectName || "Current project",
      budgetForecast: execution.forecast.forecastFinalCost,
      projectedCompletionDate: execution.forecast.projectedCompletionDate || focusProject.projectedCompletionDate || "",
      health: execution.health.riskLevel,
      healthScore: execution.health.projectHealthScore,
      unresolvedQuality: execution.quality.unresolvedRequiredCount,
      paymentErrors: execution.drawPayment.summary.errors.length,
      closeoutMissing: execution.closeout.missing.length,
      materialTrigger: execution.materialChange.shouldTrigger,
      advisoryOnly: execution.governance.advisoryOnly,
    };
  }, [viewRecord, visibleProjects, enrichedProjects]);

  const summaryStats = useMemo(() => {
    const total = enrichedProjects.length;
    const planning = enrichedProjects.filter((item) => item.projectStatus === "Planning").length;
    const active = enrichedProjects.filter((item) => ["Pre-Construction", "Permitting", "Ready to Start", "In Progress"].includes(item.projectStatus)).length;
    const delayed = enrichedProjects.filter((item) => ["Delayed", "On Hold"].includes(item.projectStatus)).length;
    const onHold = enrichedProjects.filter((item) => item.projectStatus === "On Hold").length;
    const punchList = enrichedProjects.filter((item) => item.projectStatus === "Punch List").length;
    const completed = enrichedProjects.filter((item) => ["Complete", "Closed"].includes(item.projectStatus)).length;
    const totalOriginalBudget = enrichedProjects.reduce((sum, item) => sum + Number(item.originalRehabBudget || 0), 0);
    const totalCurrentBudget = enrichedProjects.reduce((sum, item) => sum + Number(item.currentRehabBudget || 0), 0);
    const totalActualCost = enrichedProjects.reduce((sum, item) => sum + Number(item.actualCost || 0), 0);
    const totalRemainingBudget = enrichedProjects.reduce((sum, item) => sum + Number(item.remainingBudget || 0), 0);
    const totalApprovedChangeOrders = enrichedProjects.reduce((sum, item) => sum + Number(item.approvedChangeOrders || 0), 0);
    const totalPendingChangeOrders = enrichedProjects.reduce((sum, item) => sum + Number(item.pendingChangeOrders || 0), 0);
    const totalDrawsRequested = enrichedProjects.reduce((sum, item) => sum + Number(item.drawAmountRequested || 0), 0);
    const totalDrawsPaid = enrichedProjects.reduce((sum, item) => sum + Number(item.drawAmountPaid || 0), 0);
    const percentCompleteValues = enrichedProjects.map((item) => Number(item.percentComplete || 0)).filter((value) => Number.isFinite(value));
    const averagePercentComplete = percentCompleteValues.length ? percentCompleteValues.reduce((sum, value) => sum + value, 0) / percentCompleteValues.length : 0;
    const overBudget = enrichedProjects.filter((item) => item.warnings.includes("Project over budget") || item.warnings.includes("Projected final cost over budget")).length;
    const pastDue = enrichedProjects.filter((item) => item.warnings.includes("Project past completion date")).length;
    const failedInspections = enrichedProjects.filter((item) => item.warnings.includes("Failed inspection")).length;
    const missingLienWaivers = enrichedProjects.filter((item) => item.warnings.includes("Missing lien waiver")).length;
    const favorites = enrichedProjects.filter((item) => item.favorite).length;
    return { total, planning, active, delayed, onHold, punchList, completed, totalOriginalBudget, totalCurrentBudget, totalActualCost, totalRemainingBudget, totalApprovedChangeOrders, totalPendingChangeOrders, totalDrawsRequested, totalDrawsPaid, averagePercentComplete, overBudget, pastDue, failedInspections, missingLienWaivers, favorites };
  }, [enrichedProjects]);

  const handleChange = (event) => {
    const { name, value, type, checked } = event.target;
    setFormValues((current) => ({ ...current, [name]: type === "checkbox" ? checked : value }));
  };

  const resetForm = () => {
    setFormValues(initialValues);
    setEditingId(null);
    setViewRecord(null);
    setMessage({ type: "info", text: "Form cleared." });
  };

  const saveProject = async (event) => {
    event.preventDefault();
    const matchedDeal = deals.find((deal) => {
      const dealAddress = `${deal.propertyAddress || deal.address || ''}`.toLowerCase().replace(/\s+/g, ' ').trim();
      const projectAddress = `${formValues.propertyAddress || formValues.propertyName || ''}`.toLowerCase().replace(/\s+/g, ' ').trim();
      return dealAddress && projectAddress && dealAddress === projectAddress;
    });
    const projectPayload = {
      ...formValues,
      linkedDealId: formValues.linkedDealId || matchedDeal?.id || '',
      propertyId: formValues.propertyId || (matchedDeal ? properties.find((property) => (property.address || property.propertyName || '').toLowerCase().replace(/\s+/g, ' ').trim() === `${matchedDeal.propertyAddress || matchedDeal.address || ''}`.toLowerCase().replace(/\s+/g, ' ').trim())?.id || '' : ''),
    };
    const normalized = {
      ...projectPayload,
      propertyName: formValues.propertyName || "",
      projectName: formValues.projectName.trim(),
      propertyAddress: formValues.propertyAddress.trim(),
      city: formValues.city.trim(),
      state: formValues.state.trim(),
      zipCode: formValues.zipCode.trim(),
      purchasePrice: parseNumber(formValues.purchasePrice),
      originalRehabBudget: parseNumber(formValues.originalRehabBudget),
      approvedChangeOrders: parseNumber(formValues.approvedChangeOrders),
      pendingChangeOrders: parseNumber(formValues.pendingChangeOrders),
      currentRehabBudget: parseNumber(formValues.currentRehabBudget),
      committedCost: parseNumber(formValues.committedCost),
      actualCost: parseNumber(formValues.actualCost),
      amountPaid: parseNumber(formValues.amountPaid),
      contingencyPercentage: safePercent(formValues.contingencyPercentage),
      contingencyUsed: parseNumber(formValues.contingencyUsed),
      projectedARV: parseNumber(formValues.projectedARV),
      percentComplete: safePercent(formValues.percentComplete),
      favorite: Boolean(formValues.favorite),
      phases: (formValues.phases || []).map((phase) => ({ ...phase, percentComplete: safePercent(phase.percentComplete), originalBudget: parseNumber(phase.originalBudget), approvedChangeOrders: parseNumber(phase.approvedChangeOrders), currentBudget: parseNumber(phase.currentBudget), committedCost: parseNumber(phase.committedCost), actualCost: parseNumber(phase.actualCost), remainingBudget: parseNumber(phase.remainingBudget) })),
      budgetLineItems: (formValues.budgetLineItems || []).map((item) => ({ ...item, quantity: parseNumber(item.quantity), unitCost: parseNumber(item.unitCost), originalBudget: parseNumber(item.originalBudget), approvedChangeOrders: parseNumber(item.approvedChangeOrders), currentBudget: parseNumber(item.currentBudget), committedCost: parseNumber(item.committedCost), actualCost: parseNumber(item.actualCost), amountPaid: parseNumber(item.amountPaid), remainingBalance: parseNumber(item.remainingBalance), variance: parseNumber(item.variance) })),
      changeOrders: (formValues.changeOrders || []).map((item) => ({ ...item, costImpact: parseNumber(item.costImpact), scheduleImpactDays: parseNumber(item.scheduleImpactDays) })),
      draws: (formValues.draws || []).map((item) => ({ ...item, requestedAmount: parseNumber(item.requestedAmount), approvedAmount: parseNumber(item.approvedAmount), paidAmount: parseNumber(item.paidAmount) })),
      inspections: (formValues.inspections || []).map((item) => ({ ...item })),
      punchListItems: (formValues.punchListItems || []).map((item) => ({ ...item, estimatedCost: parseNumber(item.estimatedCost), actualCost: parseNumber(item.actualCost) })),
      projectPhotos: (formValues.projectPhotos || []).map((item) => ({ ...item })),
      projectDocuments: (formValues.projectDocuments || []).map((item) => ({ ...item })),
    };

    const errors = [];
    if (!normalized.projectName) errors.push("Project name is required");
    if (!normalized.propertyAddress && !normalized.propertyId) errors.push("Property address or linked property is required");
    if (!normalized.projectType) errors.push("Project type is required");
    if (!normalized.projectStatus) errors.push("Project status is required");
    if (!normalized.strategy) errors.push("Strategy is required");
    if (!normalized.priority) errors.push("Priority is required");
    if (normalized.originalRehabBudget === "") errors.push("Original rehab budget is required");
    if (!normalized.projectedStartDate) errors.push("Projected start date is required");
    if (!normalized.projectedCompletionDate) errors.push("Projected completion date is required");
    if (normalized.purchasePrice !== "" && normalized.purchasePrice < 0) errors.push("Purchase price cannot be negative");
    if (normalized.originalRehabBudget !== "" && normalized.originalRehabBudget < 0) errors.push("Original rehab budget cannot be negative");
    if (normalized.approvedChangeOrders !== "" && normalized.approvedChangeOrders < 0) errors.push("Approved change orders cannot be negative");
    if (normalized.pendingChangeOrders !== "" && normalized.pendingChangeOrders < 0) errors.push("Pending change orders cannot be negative");
    if (normalized.currentRehabBudget !== "" && normalized.currentRehabBudget < 0) errors.push("Current rehab budget cannot be negative");
    if (normalized.committedCost !== "" && normalized.committedCost < 0) errors.push("Committed cost cannot be negative");
    if (normalized.actualCost !== "" && normalized.actualCost < 0) errors.push("Actual cost cannot be negative");
    if (normalized.amountPaid !== "" && normalized.amountPaid < 0) errors.push("Amount paid cannot be negative");
    if (normalized.contingencyPercentage !== "" && (normalized.contingencyPercentage < 0 || normalized.contingencyPercentage > 100)) errors.push("Contingency percentage must remain between 0 and 100");
    if (normalized.percentComplete !== "" && (normalized.percentComplete < 0 || normalized.percentComplete > 100)) errors.push("Percent complete must remain between 0 and 100");
    if (normalized.projectedStartDate && normalized.projectedCompletionDate && new Date(normalized.projectedCompletionDate) < new Date(normalized.projectedStartDate)) errors.push("Completion date cannot precede start date");
    if (errors.length) {
      setMessage({ type: "error", text: errors.join(" ") });
      return;
    }

    const calculated = deriveProjectMetrics(normalized);
    const payload = {
      ...normalized,
      ...calculated,
      recommendation: normalized.recommendation || evaluateRecommendation(normalized),
      riskLevel: normalized.riskLevel || (calculateWarnings(normalized).length > 6 ? "Critical" : calculateWarnings(normalized).length > 3 ? "High" : calculateWarnings(normalized).length > 1 ? "Moderate" : "Low"),
      createdAt: normalized.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    try {
      const response = editingId
        ? await fetch(buildApiUrl(`/api/rehab-projects/${editingId}`), { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) })
        : await fetch(buildApiUrl("/api/rehab-projects"), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      if (!response.ok) throw new Error("backend unavailable");
      const saved = await response.json();
      const nextProjects = editingId ? projects.map((item) => (item.id === editingId ? saved : item)) : [...projects, saved];
      setProjects(nextProjects);
      window.localStorage.setItem("royalStarRehabProjects", JSON.stringify(nextProjects));
      setMessage({ type: "success", text: editingId ? "Project updated successfully." : "Project added successfully." });
      const linkedDealMessage = matchedDeal ? " Linked to the matching deal." : "";
      setMessage({ type: "success", text: `${editingId ? "Project updated successfully." : "Project added successfully."}${linkedDealMessage}` });
      resetForm();
    } catch (error) {
      const nextProjects = editingId ? projects.map((item) => (item.id === editingId ? payload : item)) : [...projects, payload];
      setProjects(nextProjects);
      window.localStorage.setItem("royalStarRehabProjects", JSON.stringify(nextProjects));
      const linkedDealMessage = matchedDeal ? " Linked to the matching deal." : "";
      setMessage({ type: "success", text: `${editingId ? "Project updated locally." : "Project added locally."}${linkedDealMessage}` });
      resetForm();
    }
  };

  const editProject = (project) => {
    setFormValues({ ...initialValues, ...project, phases: project.phases || [], budgetLineItems: project.budgetLineItems || [], changeOrders: project.changeOrders || [], draws: project.draws || [], inspections: project.inspections || [], punchListItems: project.punchListItems || [], projectPhotos: project.projectPhotos || [], projectDocuments: project.projectDocuments || [] });
    setEditingId(project.id);
    setViewRecord(null);
    setMessage({ type: "info", text: `Editing ${project.projectName || "project"}.` });
  };

  const duplicateProject = (project) => {
    const duplicatePayload = { ...project, id: "", projectName: `${project.projectName} Copy`, createdAt: "", updatedAt: "" };
    setFormValues({ ...initialValues, ...duplicatePayload, phases: project.phases || [], budgetLineItems: project.budgetLineItems || [], changeOrders: project.changeOrders || [], draws: project.draws || [], inspections: project.inspections || [], punchListItems: project.punchListItems || [], projectPhotos: project.projectPhotos || [], projectDocuments: project.projectDocuments || [] });
    setEditingId(null);
    setViewRecord(null);
    setMessage({ type: "info", text: "Duplicate project loaded into the form." });
  };

  const deleteProject = async (projectId) => {
    if (!window.confirm("Delete this project?")) return;
    try {
      const response = await fetch(buildApiUrl(`/api/rehab-projects/${projectId}`), { method: "DELETE" });
      if (!response.ok) throw new Error("backend unavailable");
      const nextProjects = projects.filter((item) => item.id !== projectId);
      setProjects(nextProjects);
      window.localStorage.setItem("royalStarRehabProjects", JSON.stringify(nextProjects));
      setMessage({ type: "success", text: "Project deleted successfully." });
    } catch {
      const nextProjects = projects.filter((item) => item.id !== projectId);
      setProjects(nextProjects);
      window.localStorage.setItem("royalStarRehabProjects", JSON.stringify(nextProjects));
      setMessage({ type: "success", text: "Project deleted locally." });
    }
  };

  const toggleFavorite = async (project) => {
    const updated = { ...project, favorite: !project.favorite, updatedAt: new Date().toISOString() };
    try {
      const response = await fetch(buildApiUrl(`/api/rehab-projects/${project.id}`), { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(updated) });
      if (!response.ok) throw new Error("backend unavailable");
      const saved = await response.json();
      setProjects((current) => current.map((item) => (item.id === project.id ? saved : item)));
    } catch {
      setProjects((current) => current.map((item) => (item.id === project.id ? updated : item)));
    }
  };

  const importProperty = (propertyId) => {
    const property = properties.find((item) => item.id === propertyId);
    if (!property) return;
    const shouldPrefill = !formValues.propertyAddress && !formValues.purchasePrice && !formValues.originalRehabBudget && !formValues.projectedARV && !formValues.strategy;
    if (!shouldPrefill && !window.confirm("Replace current project values with this property?")) return;
    setFormValues((current) => ({
      ...current,
      propertyId: property.id,
      propertyName: current.propertyName || property.propertyName || property.address || "",
      propertyAddress: current.propertyAddress || property.address || "",
      city: current.city || property.city || "",
      state: current.state || property.state || "",
      zipCode: current.zipCode || property.zipCode || "",
      purchasePrice: current.purchasePrice || property.purchasePrice || "",
      originalRehabBudget: current.originalRehabBudget || property.rehabBudget || "",
      projectedARV: current.projectedARV || property.originalARV || property.currentEstimatedValue || "",
      strategy: current.strategy || property.strategy || "Flip",
      notes: current.notes || property.notes || "",
    }));
  };

  const importDeal = (dealId) => {
    const deal = deals.find((item) => item.id === dealId);
    if (!deal) return;
    const shouldPrefill = !formValues.purchasePrice && !formValues.originalRehabBudget && !formValues.projectedARV && !formValues.strategy;
    if (!shouldPrefill && !window.confirm("Replace current project values with this saved deal?")) return;
    setFormValues((current) => ({
      ...current,
      propertyName: current.propertyName || deal.propertyAddress || "",
      propertyAddress: current.propertyAddress || deal.propertyAddress || "",
      city: current.city || deal.city || "",
      state: current.state || deal.state || "",
      zipCode: current.zipCode || deal.zipCode || "",
      purchasePrice: current.purchasePrice || deal.purchasePrice || deal.askingPrice || "",
      originalRehabBudget: current.originalRehabBudget || deal.rehabBudget || "",
      projectedARV: current.projectedARV || deal.estimatedArv || "",
      strategy: current.strategy || deal.strategy || "Flip",
      notes: current.notes || deal.notes || "",
    }));
  };

  const addPhase = () => {
    const nextPhase = { ...phaseDraft, id: createId("phase"), phaseName: phaseDraft.phaseName || standardPhases[0], sequenceNumber: phaseDraft.sequenceNumber || (formValues.phases.length + 1).toString(), contractorName: phaseDraft.contractorName || formValues.contractorName || "" };
    setFormValues((current) => ({ ...current, phases: [...(current.phases || []), nextPhase] }));
    setPhaseDraft({ id: "", phaseName: "", sequenceNumber: "", status: "Not Started", contractorId: "", contractorName: "", projectedStartDate: "", actualStartDate: "", projectedCompletionDate: "", actualCompletionDate: "", percentComplete: "", originalBudget: "", approvedChangeOrders: "", currentBudget: "", committedCost: "", actualCost: "", remainingBudget: "", inspectionRequired: false, inspectionStatus: "Not Required", dependencies: "", notes: "" });
  };

  const editPhase = (phase) => setPhaseDraft({ ...phase });
  const removePhase = (phaseId) => setFormValues((current) => ({ ...current, phases: (current.phases || []).filter((phase) => phase.id !== phaseId) }));
  const reorderPhase = (phaseId, direction) => setFormValues((current) => ({ ...current, phases: (current.phases || []).reduce((acc, phase, index, phases) => { if (phase.id === phaseId) { const targetIndex = direction === "up" ? index - 1 : index + 1; if (targetIndex >= 0 && targetIndex < phases.length) { const [moved] = phases.splice(index, 1); phases.splice(targetIndex, 0, moved); } } return acc; }, current.phases || []) }));

  const addBudgetItem = () => {
    const nextItem = { ...budgetItemDraft, id: createId("budget-item") };
    setFormValues((current) => ({ ...current, budgetLineItems: [...(current.budgetLineItems || []), nextItem] }));
    setBudgetItemDraft({ id: "", category: "", subcategory: "", description: "", phaseId: "", phaseName: "", contractorId: "", contractorName: "", vendorId: "", vendorName: "", materialId: "", materialName: "", quantity: "", unit: "", unitCost: "", originalBudget: "", approvedChangeOrders: "", currentBudget: "", committedCost: "", actualCost: "", amountPaid: "", remainingBalance: "", variance: "", invoiceNumber: "", invoiceDate: "", dueDate: "", paidDate: "", paymentStatus: "Not Invoiced", receiptUrl: "", invoiceUrl: "", lienWaiverRequired: false, lienWaiverReceived: false, notes: "" });
  };

  const removeBudgetItem = (itemId) => setFormValues((current) => ({ ...current, budgetLineItems: (current.budgetLineItems || []).filter((item) => item.id !== itemId) }));
  const addChangeOrder = () => { const next = { ...changeOrderDraft, id: createId("change-order") }; setFormValues((current) => ({ ...current, changeOrders: [...(current.changeOrders || []), next] })); setChangeOrderDraft({ id: "", changeOrderNumber: "", title: "", description: "", requestedBy: "", contractorId: "", contractorName: "", phaseId: "", phaseName: "", requestedDate: "", decisionDate: "", status: "Draft", costImpact: "", scheduleImpactDays: "", reason: "", approvalNotes: "", documentUrl: "" }); };
  const removeChangeOrder = (itemId) => setFormValues((current) => ({ ...current, changeOrders: (current.changeOrders || []).filter((item) => item.id !== itemId) }));
  const addDraw = () => { const next = { ...drawDraft, id: createId("draw") }; setFormValues((current) => ({ ...current, draws: [...(current.draws || []), next] })); setDrawDraft({ id: "", drawNumber: "", lenderId: "", lenderName: "", requestedDate: "", requestedAmount: "", approvedDate: "", approvedAmount: "", paidDate: "", paidAmount: "", status: "Draft", inspectionRequired: false, inspectionDate: "", inspectorName: "", lienWaiverRequired: false, lienWaiverReceived: false, documentUrl: "", notes: "" }); };
  const removeDraw = (itemId) => setFormValues((current) => ({ ...current, draws: (current.draws || []).filter((item) => item.id !== itemId) }));
  const addInspection = () => { const next = { ...inspectionDraft, id: createId("inspection") }; setFormValues((current) => ({ ...current, inspections: [...(current.inspections || []), next] })); setInspectionDraft({ id: "", inspectionType: "", phaseId: "", inspectorName: "", scheduledDate: "", completedDate: "", result: "Scheduled", correctionsRequired: "", reinspectionDate: "", documentUrl: "", notes: "" }); };
  const removeInspection = (itemId) => setFormValues((current) => ({ ...current, inspections: (current.inspections || []).filter((item) => item.id !== itemId) }));
  const addPunchListItem = () => { const next = { ...punchListDraft, id: createId("punch") }; setFormValues((current) => ({ ...current, punchListItems: [...(current.punchListItems || []), next] })); setPunchListDraft({ id: "", item: "", category: "", phaseId: "", location: "", contractorId: "", contractorName: "", priority: "Medium", status: "Open", dateAdded: "", dueDate: "", completedDate: "", estimatedCost: "", actualCost: "", photoUrl: "", notes: "" }); };
  const removePunchListItem = (itemId) => setFormValues((current) => ({ ...current, punchListItems: (current.punchListItems || []).filter((item) => item.id !== itemId) }));
  const addPhoto = () => { if (!photoDraft.url) return; setFormValues((current) => ({ ...current, projectPhotos: [...(current.projectPhotos || []), photoDraft] })); setPhotoDraft({ category: photoCategories[0], url: "" }); };
  const removePhoto = (index) => setFormValues((current) => ({ ...current, projectPhotos: (current.projectPhotos || []).filter((_, itemIndex) => itemIndex !== index) }));
  const addDocument = () => { if (!documentDraft.url) return; setFormValues((current) => ({ ...current, projectDocuments: [...(current.projectDocuments || []), documentDraft] })); setDocumentDraft({ category: documentCategories[0], url: "" }); };
  const removeDocument = (index) => setFormValues((current) => ({ ...current, projectDocuments: (current.projectDocuments || []).filter((_, itemIndex) => itemIndex !== index) }));

  const toggleComparison = (projectId) => setComparisonIds((current) => current.includes(projectId) ? current.filter((id) => id !== projectId) : [...current, projectId].slice(-5));

  const exportProjects = () => {
    downloadCsv("rehab-projects.csv", visibleProjects.map((project) => ({ projectName: project.projectName, propertyAddress: project.propertyAddress, projectStatus: project.projectStatus, originalRehabBudget: project.originalRehabBudget, currentRehabBudget: project.currentRehabBudget, actualCost: project.actualCost, projectedFinalCost: project.projectedFinalCost, riskLevel: project.riskLevel, recommendation: project.recommendation, warningCount: project.warnings.length })));
    downloadJson("rehab-projects.json", visibleProjects);
    setMessage({ type: "success", text: "Filtered projects exported." });
  };

  const exportBudget = () => { downloadCsv("rehab-budget.csv", visibleProjects.map((project) => ({ projectName: project.projectName, originalRehabBudget: project.originalRehabBudget, currentRehabBudget: project.currentRehabBudget, actualCost: project.actualCost, remainingBudget: project.remainingBudget, projectedFinalCost: project.projectedFinalCost }))); setMessage({ type: "success", text: "Budget export created." }); };
  const exportPhases = () => { downloadCsv("rehab-phases.csv", visibleProjects.flatMap((project) => (project.phases || []).map((phase) => ({ projectName: project.projectName, phaseName: phase.phaseName, status: phase.status, percentComplete: phase.percentComplete, contractorName: phase.contractorName })))); setMessage({ type: "success", text: "Phase tracker export created." }); };
  const exportChangeOrders = () => { downloadCsv("rehab-change-orders.csv", visibleProjects.flatMap((project) => (project.changeOrders || []).map((item) => ({ projectName: project.projectName, changeOrderNumber: item.changeOrderNumber, title: item.title, status: item.status, costImpact: item.costImpact })))); setMessage({ type: "success", text: "Change orders export created." }); };
  const exportDraws = () => { downloadCsv("rehab-draws.csv", visibleProjects.flatMap((project) => (project.draws || []).map((item) => ({ projectName: project.projectName, drawNumber: item.drawNumber, status: item.status, requestedAmount: item.requestedAmount, approvedAmount: item.approvedAmount, paidAmount: item.paidAmount })))); setMessage({ type: "success", text: "Draws export created." }); };
  const exportPunchList = () => { downloadCsv("rehab-punch-list.csv", visibleProjects.flatMap((project) => (project.punchListItems || []).map((item) => ({ projectName: project.projectName, item: item.item, status: item.status, dueDate: item.dueDate, actualCost: item.actualCost })))); setMessage({ type: "success", text: "Punch list export created." }); };
  const exportWarnings = () => { downloadCsv("rehab-warnings.csv", visibleProjects.flatMap((project) => project.warnings.map((warning) => ({ projectName: project.projectName, warning })))); setMessage({ type: "success", text: "Warnings export created." }); };

  const openPrintView = () => {
    setPrintView(true);
    setTimeout(() => window.print(), 250);
  };

  return (
    <div style={styles.page}>
      <style>{`@media print { .no-print { display: none !important; } .print-only { display: block !important; } }`}</style>
      <aside style={styles.sidebar} className="no-print">
        <div style={styles.logoArea}><img src={logo} alt="Royal Star Properties" style={styles.logo} /></div>
        <nav style={styles.nav}>
          {[
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
            ["▥", "REHAB PROJECT TRACKER"],
          ].map(([icon, label]) => {
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
            const isAppraiser = label === "APPRAISER PACKET BUILDER";
            const isRehab = label === "REHAB PROJECT TRACKER";
            return <button key={label} type="button" style={styles.navButton} onClick={isHome ? onBack : isDealAnalyzer ? onOpenDealAnalyzer : isFlip ? onOpenFlipAnalyzer : isBrrrr ? onOpenBrrrrAnalyzer : isProduct ? onOpenProductVault : isContractor ? onOpenContractorHub : isComp ? onOpenCompDatabase : isNeighborhood ? onOpenNeighborhoodDatabase : isPortfolio ? onOpenPortfolioDashboard : isProperty ? onOpenPropertyDatabase : isVendor ? onOpenVendorDatabase : isMaterial ? onOpenMaterialMatrix : isLender ? onOpenLenderDashboard : isAppraiser ? onOpenAppraiserPacketBuilder : isRehab ? undefined : undefined}>{icon} {label}</button>;
          })}
        </nav>
      </aside>

      <main style={styles.main}>
        <section style={styles.topBar} className="no-print">
          <div><div style={styles.eyebrow}>ROYAL STAR REHAB OPERATIONS</div><h1 style={styles.pageTitle}>REHAB PROJECT TRACKER</h1></div>
          <div style={styles.topActions}>
            <button type="button" style={styles.secondaryButton} onClick={onBack}>COMMAND CENTER</button>
            <button type="button" style={styles.primaryButton} onClick={() => setViewRecord(null)}>VIEW TRACKER</button>
          </div>
        </section>

        {message.text ? <div style={message.type === "error" ? styles.errorBanner : styles.successBanner} className="no-print">{message.text}</div> : null}

        <section style={styles.summaryGrid} className="no-print">
          <SummaryCard label="Total Projects" value={summaryStats.total} />
          <SummaryCard label="Planning" value={summaryStats.planning} />
          <SummaryCard label="Active" value={summaryStats.active} />
          <SummaryCard label="Delayed" value={summaryStats.delayed} />
          <SummaryCard label="On Hold" value={summaryStats.onHold} />
          <SummaryCard label="Punch List" value={summaryStats.punchList} />
          <SummaryCard label="Completed" value={summaryStats.completed} />
          <SummaryCard label="Original Budget" value={formatCurrency(summaryStats.totalOriginalBudget)} />
          <SummaryCard label="Current Budget" value={formatCurrency(summaryStats.totalCurrentBudget)} />
          <SummaryCard label="Actual Cost" value={formatCurrency(summaryStats.totalActualCost)} />
          <SummaryCard label="Remaining Budget" value={formatCurrency(summaryStats.totalRemainingBudget)} />
          <SummaryCard label="Approved Change Orders" value={formatCurrency(summaryStats.totalApprovedChangeOrders)} />
          <SummaryCard label="Pending Change Orders" value={formatCurrency(summaryStats.totalPendingChangeOrders)} />
          <SummaryCard label="Draws Requested" value={formatCurrency(summaryStats.totalDrawsRequested)} />
          <SummaryCard label="Draws Paid" value={formatCurrency(summaryStats.totalDrawsPaid)} />
          <SummaryCard label="Avg. % Complete" value={`${Number(summaryStats.averagePercentComplete).toFixed(1)}%`} />
          <SummaryCard label="Over Budget" value={summaryStats.overBudget} />
          <SummaryCard label="Past Due" value={summaryStats.pastDue} />
          <SummaryCard label="Failed Inspections" value={summaryStats.failedInspections} />
          <SummaryCard label="Missing Lien Waivers" value={summaryStats.missingLienWaivers} />
          <SummaryCard label="Favorites" value={summaryStats.favorites} />
        </section>

        <section style={styles.panel} className="no-print">
          <div style={styles.panelHeader}>
            <h2 style={styles.panelTitle}>ENTERPRISE PROJECT EXECUTION INTELLIGENCE</h2>
          </div>
          {enterpriseExecutionSignal ? (
            <div style={styles.summaryGrid}>
              <SummaryCard label="Focus Project" value={enterpriseExecutionSignal.projectName} />
              <SummaryCard label="Forecast Final Cost" value={formatCurrency(enterpriseExecutionSignal.budgetForecast)} />
              <SummaryCard label="Forecast Completion" value={formatDate(enterpriseExecutionSignal.projectedCompletionDate)} />
              <SummaryCard label="Project Health" value={`${enterpriseExecutionSignal.health} (${Number(enterpriseExecutionSignal.healthScore || 0).toFixed(1)})`} />
              <SummaryCard label="Unresolved Quality Items" value={enterpriseExecutionSignal.unresolvedQuality} />
              <SummaryCard label="Payment Errors" value={enterpriseExecutionSignal.paymentErrors} />
              <SummaryCard label="Closeout Missing Items" value={enterpriseExecutionSignal.closeoutMissing} />
              <SummaryCard label="Material Re-Underwrite Trigger" value={enterpriseExecutionSignal.materialTrigger ? "Triggered" : "Not Triggered"} />
              <SummaryCard label="Governance Mode" value={enterpriseExecutionSignal.advisoryOnly ? "Advisory Only" : "Review"} />
            </div>
          ) : (
            <div style={styles.emptyState}>No project loaded for execution intelligence.</div>
          )}
        </section>

        <section style={styles.contentGrid} className="no-print">
          <div style={styles.panel}>
            <div style={styles.panelHeader}><h2 style={styles.panelTitle}>PROJECT FORM</h2><button type="button" style={styles.secondaryButton} onClick={resetForm}>CLEAR FORM</button></div>
            <form onSubmit={saveProject} style={styles.form}>
              <FieldGroup title="Project Basics">
                <div style={styles.fieldRow}><label style={styles.label}>Project Name<input name="projectName" value={formValues.projectName} onChange={handleChange} style={styles.input} required /></label><label style={styles.label}>Project Status<select name="projectStatus" value={formValues.projectStatus} onChange={handleChange} style={styles.input}>{projectStatusOptions.map((option) => <option key={option} value={option}>{option}</option>)}</select></label></div>
                <div style={styles.fieldRow}><label style={styles.label}>Project Type<select name="projectType" value={formValues.projectType} onChange={handleChange} style={styles.input}>{projectTypeOptions.map((option) => <option key={option} value={option}>{option}</option>)}</select></label><label style={styles.label}>Strategy<select name="strategy" value={formValues.strategy} onChange={handleChange} style={styles.input}>{strategyOptions.map((option) => <option key={option} value={option}>{option}</option>)}</select></label></div>
                <div style={styles.fieldRow}><label style={styles.label}>Priority<select name="priority" value={formValues.priority} onChange={handleChange} style={styles.input}>{priorityOptions.map((option) => <option key={option} value={option}>{option}</option>)}</select></label><label style={styles.label}>Risk Level<select name="riskLevel" value={formValues.riskLevel} onChange={handleChange} style={styles.input}>{riskLevelOptions.map((option) => <option key={option} value={option}>{option}</option>)}</select></label></div>
                <div style={styles.fieldRow}><label style={styles.label}>Project Manager<input name="projectManager" value={formValues.projectManager} onChange={handleChange} style={styles.input} /></label><label style={styles.label}>Favorite<input type="checkbox" name="favorite" checked={formValues.favorite} onChange={handleChange} style={styles.checkbox} /></label></div>
                <div style={styles.fieldRow}><label style={styles.label}>Property Address<input name="propertyAddress" value={formValues.propertyAddress} onChange={handleChange} style={styles.input} /></label><label style={styles.label}>Property Name<input name="propertyName" value={formValues.propertyName} onChange={handleChange} style={styles.input} /></label></div>
                <div style={styles.fieldRow}><label style={styles.label}>City<input name="city" value={formValues.city} onChange={handleChange} style={styles.input} /></label><label style={styles.label}>State<input name="state" value={formValues.state} onChange={handleChange} style={styles.input} /></label></div>
                <div style={styles.fieldRow}><label style={styles.label}>ZIP<input name="zipCode" value={formValues.zipCode} onChange={handleChange} style={styles.input} /></label><label style={styles.label}>Current Phase<input name="currentPhase" value={formValues.currentPhase} onChange={handleChange} style={styles.input} /></label></div>
                <div style={styles.fieldRow}><label style={styles.label}>Projected Start<input name="projectedStartDate" type="date" value={formValues.projectedStartDate} onChange={handleChange} style={styles.input} /></label><label style={styles.label}>Projected Completion<input name="projectedCompletionDate" type="date" value={formValues.projectedCompletionDate} onChange={handleChange} style={styles.input} /></label></div>
                <div style={styles.fieldRow}><label style={styles.label}>Actual Start<input name="actualStartDate" type="date" value={formValues.actualStartDate} onChange={handleChange} style={styles.input} /></label><label style={styles.label}>Actual Completion<input name="actualCompletionDate" type="date" value={formValues.actualCompletionDate} onChange={handleChange} style={styles.input} /></label></div>
                <div style={styles.fieldRow}><label style={styles.label}>Next Milestone<input name="nextMilestone" value={formValues.nextMilestone} onChange={handleChange} style={styles.input} /></label><label style={styles.label}>Next Milestone Date<input name="nextMilestoneDate" type="date" value={formValues.nextMilestoneDate} onChange={handleChange} style={styles.input} /></label></div>
                <div style={styles.fieldRow}><label style={styles.label}>Percent Complete<input name="percentComplete" type="number" value={formValues.percentComplete} onChange={handleChange} style={styles.input} /></label><label style={styles.label}>Recommendation<select name="recommendation" value={formValues.recommendation} onChange={handleChange} style={styles.input}>{recommendationOptions.map((option) => <option key={option} value={option}>{option}</option>)}</select></label></div>
              </FieldGroup>

              <FieldGroup title="Budget & Finance">
                <div style={styles.fieldRow}><label style={styles.label}>Purchase Price<input name="purchasePrice" type="number" value={formValues.purchasePrice} onChange={handleChange} style={styles.input} /></label><label style={styles.label}>Original Rehab Budget<input name="originalRehabBudget" type="number" value={formValues.originalRehabBudget} onChange={handleChange} style={styles.input} /></label></div>
                <div style={styles.fieldRow}><label style={styles.label}>Approved Change Orders<input name="approvedChangeOrders" type="number" value={formValues.approvedChangeOrders} onChange={handleChange} style={styles.input} /></label><label style={styles.label}>Pending Change Orders<input name="pendingChangeOrders" type="number" value={formValues.pendingChangeOrders} onChange={handleChange} style={styles.input} /></label></div>
                <div style={styles.fieldRow}><label style={styles.label}>Current Rehab Budget<input name="currentRehabBudget" type="number" value={formValues.currentRehabBudget} onChange={handleChange} style={styles.input} /></label><label style={styles.label}>Committed Cost<input name="committedCost" type="number" value={formValues.committedCost} onChange={handleChange} style={styles.input} /></label></div>
                <div style={styles.fieldRow}><label style={styles.label}>Actual Cost<input name="actualCost" type="number" value={formValues.actualCost} onChange={handleChange} style={styles.input} /></label><label style={styles.label}>Amount Paid<input name="amountPaid" type="number" value={formValues.amountPaid} onChange={handleChange} style={styles.input} /></label></div>
                <div style={styles.fieldRow}><label style={styles.label}>Contingency %<input name="contingencyPercentage" type="number" value={formValues.contingencyPercentage} onChange={handleChange} style={styles.input} /></label><label style={styles.label}>Contingency Used<input name="contingencyUsed" type="number" value={formValues.contingencyUsed} onChange={handleChange} style={styles.input} /></label></div>
                <div style={styles.fieldRow}><label style={styles.label}>Projected ARV<input name="projectedARV" type="number" value={formValues.projectedARV} onChange={handleChange} style={styles.input} /></label><label style={styles.label}>Draw Count<input name="drawCount" type="number" value={formValues.drawCount} onChange={handleChange} style={styles.input} /></label></div>
                <div style={styles.fieldRow}><label style={styles.label}>Draw Requested<input name="drawAmountRequested" type="number" value={formValues.drawAmountRequested} onChange={handleChange} style={styles.input} /></label><label style={styles.label}>Draw Approved<input name="drawAmountApproved" type="number" value={formValues.drawAmountApproved} onChange={handleChange} style={styles.input} /></label></div>
                <div style={styles.fieldRow}><label style={styles.label}>Draw Paid<input name="drawAmountPaid" type="number" value={formValues.drawAmountPaid} onChange={handleChange} style={styles.input} /></label><label style={styles.label}>Permit Status<input name="permitStatus" value={formValues.permitStatus} onChange={handleChange} style={styles.input} /></label></div>
                <div style={styles.fieldRow}><label style={styles.label}>Lien Waiver Status<input name="lienWaiverStatus" value={formValues.lienWaiverStatus} onChange={handleChange} style={styles.input} /></label><label style={styles.label}>Insurance Status<input name="insuranceStatus" value={formValues.insuranceStatus} onChange={handleChange} style={styles.input} /></label></div>
                <div style={styles.fieldRow}><label style={styles.label}>License Status<input name="licenseStatus" value={formValues.licenseStatus} onChange={handleChange} style={styles.input} /></label><label style={styles.label}>Final Inspection Status<input name="finalInspectionStatus" value={formValues.finalInspectionStatus} onChange={handleChange} style={styles.input} /></label></div>
                <div style={styles.fieldRow}><label style={styles.label}>Punch List Status<input name="punchListStatus" value={formValues.punchListStatus} onChange={handleChange} style={styles.input} /></label><label style={styles.label}>Closeout Status<input name="closeoutStatus" value={formValues.closeoutStatus} onChange={handleChange} style={styles.input} /></label></div>
              </FieldGroup>

              <FieldGroup title="Relationships & Imports">
                <div style={styles.fieldRow}><label style={styles.label}>Import Property<select value={formValues.propertyId} onChange={(event) => { setFormValues((current) => ({ ...current, propertyId: event.target.value })); importProperty(event.target.value); }} style={styles.input}><option value="">Select</option>{properties.map((item) => <option key={item.id} value={item.id}>{item.propertyName || item.address || item.id}</option>)}</select></label><label style={styles.label}>Import Saved Deal<select value={formValues.propertyId} onChange={(event) => { setFormValues((current) => ({ ...current, propertyId: event.target.value })); importDeal(event.target.value); }} style={styles.input}><option value="">Select</option>{deals.map((item) => <option key={item.id} value={item.id}>{item.propertyAddress || item.address || item.id}</option>)}</select></label></div>
                <div style={styles.fieldRow}><label style={styles.label}>Contractor<select name="contractorId" value={formValues.contractorId} onChange={(event) => { const contractor = contractors.find((entry) => entry.id === event.target.value); setFormValues((current) => ({ ...current, contractorId: event.target.value, contractorName: current.contractorName || contractor?.contractorName || contractor?.vendorName || "" })); }} style={styles.input}><option value="">Select</option>{contractors.map((item) => <option key={item.id} value={item.id}>{item.contractorName || item.vendorName || item.id}</option>)}</select></label><label style={styles.label}>Lender<select name="lenderId" value={formValues.lenderId} onChange={(event) => { const lender = lenders.find((entry) => entry.id === event.target.value); setFormValues((current) => ({ ...current, lenderId: event.target.value, lenderName: current.lenderName || lender?.lenderName || "" })); }} style={styles.input}><option value="">Select</option>{lenders.map((item) => <option key={item.id} value={item.id}>{item.lenderName || item.id}</option>)}</select></label></div>
              </FieldGroup>

              <FieldGroup title="Notes">
                <label style={styles.label}>Notes<textarea name="notes" value={formValues.notes} onChange={handleChange} style={{ ...styles.input, minHeight: "80px" }} /></label>
              </FieldGroup>

              <FieldGroup title="Phases">
                <div style={styles.listBox}>{(formValues.phases || []).map((phase) => <div key={phase.id} style={styles.listItem}><span>{phase.phaseName || phase.id}</span><div style={styles.actionRow}><button type="button" style={styles.linkButton} onClick={() => editPhase(phase)}>Edit</button><button type="button" style={styles.linkButton} onClick={() => removePhase(phase.id)}>Remove</button></div></div>)}</div>
                <div style={styles.fieldRow}><label style={styles.label}>Phase Name<input value={phaseDraft.phaseName} onChange={(event) => setPhaseDraft((current) => ({ ...current, phaseName: event.target.value }))} style={styles.input} /></label><label style={styles.label}>Status<select value={phaseDraft.status} onChange={(event) => setPhaseDraft((current) => ({ ...current, status: event.target.value }))} style={styles.input}>{phaseStatusOptions.map((option) => <option key={option} value={option}>{option}</option>)}</select></label></div>
                <div style={styles.fieldRow}><label style={styles.label}>Sequence<input value={phaseDraft.sequenceNumber} onChange={(event) => setPhaseDraft((current) => ({ ...current, sequenceNumber: event.target.value }))} style={styles.input} /></label><label style={styles.label}>Contractor<input value={phaseDraft.contractorName} onChange={(event) => setPhaseDraft((current) => ({ ...current, contractorName: event.target.value }))} style={styles.input} /></label></div>
                <div style={styles.fieldRow}><label style={styles.label}>Projected Start<input type="date" value={phaseDraft.projectedStartDate} onChange={(event) => setPhaseDraft((current) => ({ ...current, projectedStartDate: event.target.value }))} style={styles.input} /></label><label style={styles.label}>Projected Completion<input type="date" value={phaseDraft.projectedCompletionDate} onChange={(event) => setPhaseDraft((current) => ({ ...current, projectedCompletionDate: event.target.value }))} style={styles.input} /></label></div>
                <div style={styles.fieldRow}><label style={styles.label}>Percent Complete<input type="number" value={phaseDraft.percentComplete} onChange={(event) => setPhaseDraft((current) => ({ ...current, percentComplete: event.target.value }))} style={styles.input} /></label><label style={styles.label}>Original Budget<input type="number" value={phaseDraft.originalBudget} onChange={(event) => setPhaseDraft((current) => ({ ...current, originalBudget: event.target.value }))} style={styles.input} /></label></div>
                <div style={styles.fieldRow}><label style={styles.label}>Current Budget<input type="number" value={phaseDraft.currentBudget} onChange={(event) => setPhaseDraft((current) => ({ ...current, currentBudget: event.target.value }))} style={styles.input} /></label><label style={styles.label}>Actual Cost<input type="number" value={phaseDraft.actualCost} onChange={(event) => setPhaseDraft((current) => ({ ...current, actualCost: event.target.value }))} style={styles.input} /></label></div>
                <div style={styles.fieldRow}><label style={styles.label}>Inspection Required<input type="checkbox" checked={phaseDraft.inspectionRequired} onChange={(event) => setPhaseDraft((current) => ({ ...current, inspectionRequired: event.target.checked }))} style={styles.checkbox} /></label><label style={styles.label}>Inspection Status<select value={phaseDraft.inspectionStatus} onChange={(event) => setPhaseDraft((current) => ({ ...current, inspectionStatus: event.target.value }))} style={styles.input}>{inspectionResultsOptions.map((option) => <option key={option} value={option}>{option}</option>)}</select></label></div>
                <div style={styles.fieldRow}><label style={styles.label}>Dependencies<input value={phaseDraft.dependencies} onChange={(event) => setPhaseDraft((current) => ({ ...current, dependencies: event.target.value }))} style={styles.input} /></label><label style={styles.label}>Notes<input value={phaseDraft.notes} onChange={(event) => setPhaseDraft((current) => ({ ...current, notes: event.target.value }))} style={styles.input} /></label></div>
                <div style={styles.actionRow}><button type="button" style={styles.secondaryButton} onClick={addPhase}>Add Phase</button><button type="button" style={styles.secondaryButton} onClick={() => setPhaseDraft({ id: "", phaseName: "", sequenceNumber: "", status: "Not Started", contractorId: "", contractorName: "", projectedStartDate: "", actualStartDate: "", projectedCompletionDate: "", actualCompletionDate: "", percentComplete: "", originalBudget: "", approvedChangeOrders: "", currentBudget: "", committedCost: "", actualCost: "", remainingBudget: "", inspectionRequired: false, inspectionStatus: "Not Required", dependencies: "", notes: "" })}>Clear Phase</button></div>
              </FieldGroup>

              <FieldGroup title="Budget Line Items">
                <div style={styles.listBox}>{(formValues.budgetLineItems || []).map((item) => <div key={item.id} style={styles.listItem}><span>{item.description || item.category || item.id}</span><button type="button" style={styles.linkButton} onClick={() => removeBudgetItem(item.id)}>Remove</button></div>)}</div>
                <div style={styles.fieldRow}><label style={styles.label}>Category<input value={budgetItemDraft.category} onChange={(event) => setBudgetItemDraft((current) => ({ ...current, category: event.target.value }))} style={styles.input} /></label><label style={styles.label}>Subcategory<input value={budgetItemDraft.subcategory} onChange={(event) => setBudgetItemDraft((current) => ({ ...current, subcategory: event.target.value }))} style={styles.input} /></label></div>
                <div style={styles.fieldRow}><label style={styles.label}>Description<input value={budgetItemDraft.description} onChange={(event) => setBudgetItemDraft((current) => ({ ...current, description: event.target.value }))} style={styles.input} /></label><label style={styles.label}>Phase<input value={budgetItemDraft.phaseName} onChange={(event) => setBudgetItemDraft((current) => ({ ...current, phaseName: event.target.value }))} style={styles.input} /></label></div>
                <div style={styles.fieldRow}><label style={styles.label}>Vendor<input value={budgetItemDraft.vendorName} onChange={(event) => setBudgetItemDraft((current) => ({ ...current, vendorName: event.target.value }))} style={styles.input} /></label><label style={styles.label}>Material<input value={budgetItemDraft.materialName} onChange={(event) => setBudgetItemDraft((current) => ({ ...current, materialName: event.target.value }))} style={styles.input} /></label></div>
                <div style={styles.fieldRow}><label style={styles.label}>Quantity<input type="number" value={budgetItemDraft.quantity} onChange={(event) => setBudgetItemDraft((current) => ({ ...current, quantity: event.target.value }))} style={styles.input} /></label><label style={styles.label}>Unit Cost<input type="number" value={budgetItemDraft.unitCost} onChange={(event) => setBudgetItemDraft((current) => ({ ...current, unitCost: event.target.value }))} style={styles.input} /></label></div>
                <div style={styles.fieldRow}><label style={styles.label}>Original Budget<input type="number" value={budgetItemDraft.originalBudget} onChange={(event) => setBudgetItemDraft((current) => ({ ...current, originalBudget: event.target.value }))} style={styles.input} /></label><label style={styles.label}>Current Budget<input type="number" value={budgetItemDraft.currentBudget} onChange={(event) => setBudgetItemDraft((current) => ({ ...current, currentBudget: event.target.value }))} style={styles.input} /></label></div>
                <div style={styles.fieldRow}><label style={styles.label}>Payment Status<select value={budgetItemDraft.paymentStatus} onChange={(event) => setBudgetItemDraft((current) => ({ ...current, paymentStatus: event.target.value }))} style={styles.input}>{paymentStatusOptions.map((option) => <option key={option} value={option}>{option}</option>)}</select></label><label style={styles.label}>Invoice Number<input value={budgetItemDraft.invoiceNumber} onChange={(event) => setBudgetItemDraft((current) => ({ ...current, invoiceNumber: event.target.value }))} style={styles.input} /></label></div>
                <div style={styles.fieldRow}><label style={styles.label}>Invoice URL<input value={budgetItemDraft.invoiceUrl} onChange={(event) => setBudgetItemDraft((current) => ({ ...current, invoiceUrl: event.target.value }))} style={styles.input} /></label><label style={styles.label}>Receipt URL<input value={budgetItemDraft.receiptUrl} onChange={(event) => setBudgetItemDraft((current) => ({ ...current, receiptUrl: event.target.value }))} style={styles.input} /></label></div>
                <button type="button" style={styles.secondaryButton} onClick={addBudgetItem}>Add Budget Item</button>
              </FieldGroup>

              <FieldGroup title="Change Orders">
                <div style={styles.listBox}>{(formValues.changeOrders || []).map((item) => <div key={item.id} style={styles.listItem}><span>{item.title || item.changeOrderNumber || item.id}</span><button type="button" style={styles.linkButton} onClick={() => removeChangeOrder(item.id)}>Remove</button></div>)}</div>
                <div style={styles.fieldRow}><label style={styles.label}>Change Order #<input value={changeOrderDraft.changeOrderNumber} onChange={(event) => setChangeOrderDraft((current) => ({ ...current, changeOrderNumber: event.target.value }))} style={styles.input} /></label><label style={styles.label}>Title<input value={changeOrderDraft.title} onChange={(event) => setChangeOrderDraft((current) => ({ ...current, title: event.target.value }))} style={styles.input} /></label></div>
                <div style={styles.fieldRow}><label style={styles.label}>Status<select value={changeOrderDraft.status} onChange={(event) => setChangeOrderDraft((current) => ({ ...current, status: event.target.value }))} style={styles.input}>{changeOrderStatusOptions.map((option) => <option key={option} value={option}>{option}</option>)}</select></label><label style={styles.label}>Cost Impact<input type="number" value={changeOrderDraft.costImpact} onChange={(event) => setChangeOrderDraft((current) => ({ ...current, costImpact: event.target.value }))} style={styles.input} /></label></div>
                <label style={styles.label}>Description<textarea value={changeOrderDraft.description} onChange={(event) => setChangeOrderDraft((current) => ({ ...current, description: event.target.value }))} style={{ ...styles.input, minHeight: "60px" }} /></label>
                <button type="button" style={styles.secondaryButton} onClick={addChangeOrder}>Add Change Order</button>
              </FieldGroup>

              <FieldGroup title="Draw Tracking">
                <div style={styles.listBox}>{(formValues.draws || []).map((item) => <div key={item.id} style={styles.listItem}><span>{item.drawNumber || item.id}</span><button type="button" style={styles.linkButton} onClick={() => removeDraw(item.id)}>Remove</button></div>)}</div>
                <div style={styles.fieldRow}><label style={styles.label}>Draw #<input value={drawDraft.drawNumber} onChange={(event) => setDrawDraft((current) => ({ ...current, drawNumber: event.target.value }))} style={styles.input} /></label><label style={styles.label}>Status<select value={drawDraft.status} onChange={(event) => setDrawDraft((current) => ({ ...current, status: event.target.value }))} style={styles.input}>{drawStatusOptions.map((option) => <option key={option} value={option}>{option}</option>)}</select></label></div>
                <div style={styles.fieldRow}><label style={styles.label}>Requested Amount<input type="number" value={drawDraft.requestedAmount} onChange={(event) => setDrawDraft((current) => ({ ...current, requestedAmount: event.target.value }))} style={styles.input} /></label><label style={styles.label}>Approved Amount<input type="number" value={drawDraft.approvedAmount} onChange={(event) => setDrawDraft((current) => ({ ...current, approvedAmount: event.target.value }))} style={styles.input} /></label></div>
                <div style={styles.fieldRow}><label style={styles.label}>Paid Amount<input type="number" value={drawDraft.paidAmount} onChange={(event) => setDrawDraft((current) => ({ ...current, paidAmount: event.target.value }))} style={styles.input} /></label><label style={styles.label}>Lender<input value={drawDraft.lenderName} onChange={(event) => setDrawDraft((current) => ({ ...current, lenderName: event.target.value }))} style={styles.input} /></label></div>
                <button type="button" style={styles.secondaryButton} onClick={addDraw}>Add Draw</button>
              </FieldGroup>

              <FieldGroup title="Inspections">
                <div style={styles.listBox}>{(formValues.inspections || []).map((item) => <div key={item.id} style={styles.listItem}><span>{item.inspectionType || item.id}</span><button type="button" style={styles.linkButton} onClick={() => removeInspection(item.id)}>Remove</button></div>)}</div>
                <div style={styles.fieldRow}><label style={styles.label}>Inspection Type<input value={inspectionDraft.inspectionType} onChange={(event) => setInspectionDraft((current) => ({ ...current, inspectionType: event.target.value }))} style={styles.input} /></label><label style={styles.label}>Result<select value={inspectionDraft.result} onChange={(event) => setInspectionDraft((current) => ({ ...current, result: event.target.value }))} style={styles.input}>{inspectionResultsOptions.map((option) => <option key={option} value={option}>{option}</option>)}</select></label></div>
                <div style={styles.fieldRow}><label style={styles.label}>Scheduled Date<input type="date" value={inspectionDraft.scheduledDate} onChange={(event) => setInspectionDraft((current) => ({ ...current, scheduledDate: event.target.value }))} style={styles.input} /></label><label style={styles.label}>Completed Date<input type="date" value={inspectionDraft.completedDate} onChange={(event) => setInspectionDraft((current) => ({ ...current, completedDate: event.target.value }))} style={styles.input} /></label></div>
                <button type="button" style={styles.secondaryButton} onClick={addInspection}>Add Inspection</button>
              </FieldGroup>

              <FieldGroup title="Punch List">
                <div style={styles.listBox}>{(formValues.punchListItems || []).map((item) => <div key={item.id} style={styles.listItem}><span>{item.item || item.id}</span><button type="button" style={styles.linkButton} onClick={() => removePunchListItem(item.id)}>Remove</button></div>)}</div>
                <div style={styles.fieldRow}><label style={styles.label}>Item<input value={punchListDraft.item} onChange={(event) => setPunchListDraft((current) => ({ ...current, item: event.target.value }))} style={styles.input} /></label><label style={styles.label}>Category<input value={punchListDraft.category} onChange={(event) => setPunchListDraft((current) => ({ ...current, category: event.target.value }))} style={styles.input} /></label></div>
                <div style={styles.fieldRow}><label style={styles.label}>Priority<select value={punchListDraft.priority} onChange={(event) => setPunchListDraft((current) => ({ ...current, priority: event.target.value }))} style={styles.input}>{priorityOptions.map((option) => <option key={option} value={option}>{option}</option>)}</select></label><label style={styles.label}>Status<select value={punchListDraft.status} onChange={(event) => setPunchListDraft((current) => ({ ...current, status: event.target.value }))} style={styles.input}>{punchListStatusOptions.map((option) => <option key={option} value={option}>{option}</option>)}</select></label></div>
                <div style={styles.fieldRow}><label style={styles.label}>Due Date<input type="date" value={punchListDraft.dueDate} onChange={(event) => setPunchListDraft((current) => ({ ...current, dueDate: event.target.value }))} style={styles.input} /></label><label style={styles.label}>Estimated Cost<input type="number" value={punchListDraft.estimatedCost} onChange={(event) => setPunchListDraft((current) => ({ ...current, estimatedCost: event.target.value }))} style={styles.input} /></label></div>
                <button type="button" style={styles.secondaryButton} onClick={addPunchListItem}>Add Punch List Item</button>
              </FieldGroup>

              <FieldGroup title="Photos & Documents">
                <div style={styles.fieldRow}><label style={styles.label}>Photo Category<select value={photoDraft.category} onChange={(event) => setPhotoDraft((current) => ({ ...current, category: event.target.value }))} style={styles.input}>{photoCategories.map((option) => <option key={option} value={option}>{option}</option>)}</select></label><label style={styles.label}>Photo URL<input value={photoDraft.url} onChange={(event) => setPhotoDraft((current) => ({ ...current, url: event.target.value }))} style={styles.input} /></label></div>
                <button type="button" style={styles.secondaryButton} onClick={addPhoto}>Add Photo</button>
                <div style={styles.listBox}>{(formValues.projectPhotos || []).map((photo, index) => <div key={`${photo.category}-${index}`} style={styles.listItem}><span>{photo.category}: {photo.url}</span><button type="button" style={styles.linkButton} onClick={() => removePhoto(index)}>Remove</button></div>)}</div>
                <div style={styles.fieldRow}><label style={styles.label}>Document Category<select value={documentDraft.category} onChange={(event) => setDocumentDraft((current) => ({ ...current, category: event.target.value }))} style={styles.input}>{documentCategories.map((option) => <option key={option} value={option}>{option}</option>)}</select></label><label style={styles.label}>Document URL<input value={documentDraft.url} onChange={(event) => setDocumentDraft((current) => ({ ...current, url: event.target.value }))} style={styles.input} /></label></div>
                <button type="button" style={styles.secondaryButton} onClick={addDocument}>Add Document</button>
                <div style={styles.listBox}>{(formValues.projectDocuments || []).map((doc, index) => <div key={`${doc.category}-${index}`} style={styles.listItem}><span>{doc.category}: {doc.url}</span><button type="button" style={styles.linkButton} onClick={() => removeDocument(index)}>Remove</button></div>)}</div>
              </FieldGroup>

              <FieldGroup title="Closeout Checklist">
                <div style={styles.listBox}>{["All phases complete", "Final inspection passed", "Punch list complete", "Final contractor invoices received", "Final vendor invoices received", "Final unconditional lien waivers received", "Warranties received", "Permits closed", "Draws funded", "Contractors paid", "Vendors paid", "Final photos received", "Appraisal completed when required", "Property added to Portfolio Dashboard", "Final project costs reconciled"].map((item) => <div key={item} style={styles.listItem}><span>{item}</span><input type="checkbox" /></div>)}</div>
              </FieldGroup>

              <div style={styles.formActions}><button type="submit" style={styles.primaryButton}>{editingId ? "SAVE CHANGES" : "ADD PROJECT"}</button><button type="button" style={styles.secondaryButton} onClick={resetForm}>RESET</button></div>
            </form>
          </div>

          <div style={styles.panel}>
            <div style={styles.panelHeader}><h2 style={styles.panelTitle}>FILTERS & EXPORTS</h2><button type="button" style={styles.secondaryButton} onClick={exportProjects}>EXPORT</button></div>
            <div style={styles.filterRow}><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search project, property, address, city, ZIP, contractor, lender, notes" style={styles.input} /></div>
            <div style={styles.filterRow}><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} style={styles.input}><option value="All">All Status</option>{projectStatusOptions.map((option) => <option key={option} value={option}>{option}</option>)}</select><select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)} style={styles.input}><option value="All">All Type</option>{projectTypeOptions.map((option) => <option key={option} value={option}>{option}</option>)}</select></div>
            <div style={styles.filterRow}><select value={strategyFilter} onChange={(event) => setStrategyFilter(event.target.value)} style={styles.input}><option value="All">All Strategy</option>{strategyOptions.map((option) => <option key={option} value={option}>{option}</option>)}</select><select value={priorityFilter} onChange={(event) => setPriorityFilter(event.target.value)} style={styles.input}><option value="All">All Priority</option>{priorityOptions.map((option) => <option key={option} value={option}>{option}</option>)}</select></div>
            <div style={styles.filterRow}><select value={stateFilter} onChange={(event) => setStateFilter(event.target.value)} style={styles.input}><option value="All">All State</option>{Array.from(new Set(enrichedProjects.map((project) => project.state).filter(Boolean))).map((value) => <option key={value} value={value}>{value}</option>)}</select><input value={cityFilter} onChange={(event) => setCityFilter(event.target.value)} placeholder="City" style={styles.input} /></div>
            <div style={styles.filterRow}><input value={zipFilter} onChange={(event) => setZipFilter(event.target.value)} placeholder="ZIP" style={styles.input} /><select value={currentPhaseFilter} onChange={(event) => setCurrentPhaseFilter(event.target.value)} style={styles.input}><option value="All">All Phases</option>{Array.from(new Set(enrichedProjects.map((project) => project.currentPhase).filter(Boolean))).map((value) => <option key={value} value={value}>{value}</option>)}</select></div>
            <div style={styles.filterRow}><select value={contractorFilter} onChange={(event) => setContractorFilter(event.target.value)} style={styles.input}><option value="All">All Contractors</option>{Array.from(new Set(enrichedProjects.map((project) => project.contractorName).filter(Boolean))).map((value) => <option key={value} value={value}>{value}</option>)}</select><select value={lenderFilter} onChange={(event) => setLenderFilter(event.target.value)} style={styles.input}><option value="All">All Lenders</option>{Array.from(new Set(enrichedProjects.map((project) => project.lenderName).filter(Boolean))).map((value) => <option key={value} value={value}>{value}</option>)}</select></div>
            <div style={styles.filterRow}><select value={riskFilter} onChange={(event) => setRiskFilter(event.target.value)} style={styles.input}><option value="All">All Risk</option>{riskLevelOptions.map((option) => <option key={option} value={option}>{option}</option>)}</select><select value={recommendationFilter} onChange={(event) => setRecommendationFilter(event.target.value)} style={styles.input}><option value="All">All Recommendation</option>{recommendationOptions.map((option) => <option key={option} value={option}>{option}</option>)}</select></div>
            <div style={styles.filterRow}><select value={favoriteFilter} onChange={(event) => setFavoriteFilter(event.target.value)} style={styles.input}><option value="All">All Projects</option><option value="Favorites Only">Favorites Only</option><option value="Non-Favorites">Non-Favorites</option></select><select value={overBudgetFilter} onChange={(event) => setOverBudgetFilter(event.target.value)} style={styles.input}><option value="All">Any Budget</option><option value="Yes">Over Budget</option><option value="No">On Budget</option></select></div>
            <div style={styles.filterRow}><select value={pastDueFilter} onChange={(event) => setPastDueFilter(event.target.value)} style={styles.input}><option value="All">Any Due</option><option value="Yes">Past Due</option><option value="No">On Track</option></select><select value={delayedFilter} onChange={(event) => setDelayedFilter(event.target.value)} style={styles.input}><option value="All">Any Delay</option><option value="Yes">Delayed</option><option value="No">On Schedule</option></select></div>
            <div style={styles.filterRow}><select value={failedInspectionFilter} onChange={(event) => setFailedInspectionFilter(event.target.value)} style={styles.input}><option value="All">Any Inspection</option><option value="Yes">Failed Inspection</option><option value="No">No Failures</option></select><select value={missingLienWaiverFilter} onChange={(event) => setMissingLienWaiverFilter(event.target.value)} style={styles.input}><option value="All">Any Lien Waiver</option><option value="Yes">Missing Lien Waiver</option><option value="No">Has Waiver</option></select></div>
            <div style={styles.filterRow}><input value={percentCompleteFilter} onChange={(event) => setPercentCompleteFilter(event.target.value)} placeholder="Min % complete" style={styles.input} /><select value={sortBy} onChange={(event) => setSortBy(event.target.value)} style={styles.input}>{sortOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
            <div style={styles.actionRow}><button type="button" style={styles.secondaryButton} onClick={exportBudget}>Budget</button><button type="button" style={styles.secondaryButton} onClick={exportPhases}>Phases</button><button type="button" style={styles.secondaryButton} onClick={exportChangeOrders}>Change Orders</button><button type="button" style={styles.secondaryButton} onClick={exportDraws}>Draws</button></div>
            <div style={styles.actionRow}><button type="button" style={styles.secondaryButton} onClick={exportPunchList}>Punch List</button><button type="button" style={styles.secondaryButton} onClick={exportWarnings}>Warnings</button><button type="button" style={styles.secondaryButton} onClick={openPrintView}>PRINT</button></div>
          </div>
        </section>

        <section style={styles.panel} className="no-print">
          <div style={styles.panelHeader}><h2 style={styles.panelTitle}>PROJECT RECORDS</h2><div style={styles.actionRow}><button type="button" style={styles.secondaryButton} onClick={exportProjects}>EXPORT FILTERED</button><button type="button" style={styles.secondaryButton} onClick={() => setMessage({ type: "info", text: "Use the form to create a project." })}>ADD PROJECT</button></div></div>
          {loading ? <div style={styles.emptyState}>Loading projects…</div> : visibleProjects.length === 0 ? <div style={styles.emptyState}>No rehab projects available<button type="button" style={styles.primaryButton} onClick={() => setMessage({ type: "info", text: "Use the form to create a project." })}>ADD PROJECT</button></div> : (
            <div style={styles.tableWrap}><table style={styles.table}><thead><tr><th style={styles.th}>★</th><th style={styles.th}>Project</th><th style={styles.th}>Property</th><th style={styles.th}>Address</th><th style={styles.th}>Strategy</th><th style={styles.th}>Status</th><th style={styles.th}>Priority</th><th style={styles.th}>Phase</th><th style={styles.th}>% Complete</th><th style={styles.th}>Original Budget</th><th style={styles.th}>Current Budget</th><th style={styles.th}>Actual Cost</th><th style={styles.th}>Remaining</th><th style={styles.th}>Projected Completion</th><th style={styles.th}>Contractor</th><th style={styles.th}>Lender</th><th style={styles.th}>Risk</th><th style={styles.th}>Recommendation</th><th style={styles.th}>Warnings</th><th style={styles.th}>Actions</th></tr></thead><tbody>{visibleProjects.map((project) => (<tr key={project.id} style={styles.tr}><td style={styles.td}><button type="button" style={styles.iconButton} onClick={() => toggleFavorite(project)}>{project.favorite ? "★" : "☆"}</button></td><td style={styles.td}>{project.projectName}</td><td style={styles.td}>{project.propertyName}</td><td style={styles.td}>{project.propertyAddress}</td><td style={styles.td}>{project.strategy}</td><td style={styles.td}>{project.projectStatus}</td><td style={styles.td}>{project.priority}</td><td style={styles.td}>{project.currentPhase}</td><td style={styles.td}>{project.percentComplete === "" ? "Insufficient Data" : `${Number(project.percentComplete).toFixed(0)}%`}</td><td style={styles.td}>{formatCurrency(project.originalRehabBudget)}</td><td style={styles.td}>{formatCurrency(project.currentRehabBudget)}</td><td style={styles.td}>{formatCurrency(project.actualCost)}</td><td style={styles.td}>{formatCurrency(project.remainingBudget)}</td><td style={styles.td}>{formatDate(project.projectedCompletionDate)}</td><td style={styles.td}>{project.contractorName}</td><td style={styles.td}>{project.lenderName}</td><td style={styles.td}>{project.riskLevel}</td><td style={styles.td}>{project.recommendation}</td><td style={styles.td}>{project.warnings.length}</td><td style={styles.td}><div style={styles.actionRow}><button type="button" style={styles.linkButton} onClick={() => setViewRecord(project)}>View</button><button type="button" style={styles.linkButton} onClick={() => editProject(project)}>Edit</button><button type="button" style={styles.linkButton} onClick={() => duplicateProject(project)}>Duplicate</button><button type="button" style={styles.linkButton} onClick={() => deleteProject(project.id)}>Delete</button><button type="button" style={styles.linkButton} onClick={() => toggleComparison(project.id)}>{comparisonIds.includes(project.id) ? "Selected" : "Compare"}</button></div></td></tr>))}</tbody></table></div>)}
        </section>

        {viewRecord ? <section style={styles.panel}><div style={styles.panelHeader}><h2 style={styles.panelTitle}>FULL PROJECT VIEW</h2><button type="button" style={styles.secondaryButton} onClick={() => setViewRecord(null)}>CLOSE</button></div><div style={styles.recordGrid}>{Object.entries(viewRecord).filter(([key]) => !["phases", "budgetLineItems", "changeOrders", "draws", "inspections", "punchListItems", "projectPhotos", "projectDocuments"].includes(key)).map(([key, value]) => <div key={key} style={styles.recordField}><strong>{key}</strong><div>{Array.isArray(value) ? value.join(", ") : typeof value === "boolean" ? String(value) : value || "—"}</div></div>)}</div><div style={styles.panelHeader}><h2 style={styles.panelTitle}>DETAILS</h2></div><div style={styles.recordGrid}>{["phases", "budgetLineItems", "changeOrders", "draws", "inspections", "punchListItems", "projectPhotos", "projectDocuments"].map((key) => <div key={key} style={styles.recordField}><strong>{key}</strong><div>{JSON.stringify(viewRecord[key] || [])}</div></div>)}</div></section> : null}

        {comparisonIds.length > 0 ? <section style={styles.panel}><div style={styles.panelHeader}><h2 style={styles.panelTitle}>COMPARISON</h2></div><div style={styles.comparisonGrid}>{visibleProjects.filter((project) => comparisonIds.includes(project.id)).map((project) => <div key={project.id} style={styles.comparisonCard}><h3 style={styles.cardTitle}>{project.projectName}</h3><div>Original Budget: {formatCurrency(project.originalRehabBudget)}</div><div>Current Budget: {formatCurrency(project.currentRehabBudget)}</div><div>Actual Cost: {formatCurrency(project.actualCost)}</div><div>Projected Final Cost: {formatCurrency(project.projectedFinalCost)}</div><div>Budget Variance: {formatCurrency(project.budgetVariance)}</div><div>Percent Complete: {project.percentComplete === "" ? "Insufficient Data" : `${Number(project.percentComplete).toFixed(0)}%`}</div><div>Change Orders: {formatCurrency(Number(project.approvedChangeOrders || 0) + Number(project.pendingChangeOrders || 0))}</div><div>Draw Performance: {project.drawAmountApproved ? `${Number(project.drawAmountPaid || 0).toFixed(0)}/${Number(project.drawAmountApproved || 0).toFixed(0)}` : "Insufficient Data"}</div><div>Projected ARV: {formatCurrency(project.projectedARV)}</div><div>Projected Profit: {formatCurrency(project.projectedProfit)}</div><div>Projected ROI: {project.projectedROI === "" ? "Insufficient Data" : `${Number(project.projectedROI).toFixed(1)}%`}</div><div>Risk: {project.riskLevel}</div><div>Recommendation: {project.recommendation}</div></div>)}</div></section> : null}

        {printView ? <section style={styles.printView} className="print-only"><h2 style={styles.pageTitle}>REHAB PROJECT TRACKER</h2>{visibleProjects[0] ? <div><h3>{visibleProjects[0].projectName}</h3><p>{visibleProjects[0].propertyAddress}</p><p>{visibleProjects[0].notes}</p></div> : <div>No rehab projects available.</div>}</section> : null}
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
