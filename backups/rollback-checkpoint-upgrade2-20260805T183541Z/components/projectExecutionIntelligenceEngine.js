function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function optionalNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function safeString(value, fallback = "") {
  if (value === null || value === undefined) return fallback;
  return String(value).trim();
}

function normalizeText(value) {
  return safeString(value).toLowerCase();
}

function nowIso() {
  return new Date().toISOString();
}

function createEvidenceEnvelope(value, source = "manual", status = "reported", verification = "unverified", approver = "", version = 1, auditReference = "") {
  return {
    value,
    source,
    status,
    verification,
    approver,
    version,
    timestamps: {
      recordedAt: nowIso(),
      updatedAt: nowIso(),
    },
    auditReference,
  };
}

export const PROJECT_EXECUTION_STATUSES = [
  "Planning",
  "Pre-Construction",
  "Permitting",
  "Ready to Start",
  "In Progress",
  "On Hold",
  "Delayed",
  "Punch List",
  "Final Inspection",
  "Complete",
  "Closed",
  "Cancelled",
];

export const CONTRACTOR_PREQUAL_STATUSES = [
  "Prospect",
  "Documents Missing",
  "Under Review",
  "Approved",
  "Approved With Conditions",
  "Suspended",
  "Do Not Use",
  "Archived",
];

export const CONTRACT_STATUSES = [
  "Draft",
  "Under Review",
  "Approved",
  "Sent",
  "Signed",
  "Active",
  "Suspended",
  "Completed",
  "Terminated",
  "Archived",
];

export const DRAW_PAYMENT_STATUSES = [
  "Draft",
  "Submitted",
  "Documentation Missing",
  "Under Review",
  "Approved",
  "Partially Approved",
  "Rejected",
  "Paid",
  "Cleared",
  "Reconciled",
];

export const CHANGE_ORDER_STATUSES = [
  "Draft",
  "Submitted",
  "Evidence Required",
  "Under Review",
  "Approved",
  "Partially Approved",
  "Rejected",
  "Superseded",
  "Closed",
];

export const PERMIT_STATUSES = [
  "Not Required",
  "Needed",
  "Preparing",
  "Submitted",
  "Approved",
  "Active",
  "Inspection Scheduled",
  "Passed",
  "Failed",
  "Corrections Required",
  "Closed",
  "Expired",
];

export const QUALITY_STATUSES = [
  "Open",
  "Assigned",
  "In Progress",
  "Ready for Review",
  "Failed Review",
  "Completed",
  "Waived",
  "Archived",
];

export const PURCHASE_ORDER_STATUSES = [
  "Draft",
  "Approved",
  "Ordered",
  "Partially Received",
  "Received",
  "Backordered",
  "Returned",
  "Cancelled",
  "Reconciled",
];

export const CLOSEOUT_STATUSES = [
  "Not Started",
  "In Progress",
  "Documentation Missing",
  "Ready for Review",
  "Approved",
  "Closed",
  "Reopened",
];

export const ROYAL_STAR_SEQUENCE = [
  "Plan",
  "Demo",
  "Plan 2",
  "Framing",
  "Rough-In",
  "Tubs and Showers",
  "Drywall and Backer",
  "Prime and Paint",
  "Flooring",
  "Cabinets, Vanities, and Counters",
  "Finish Plumbing",
  "Finish Electrical",
  "Finish HVAC",
  "Final Punch",
  "Closeout",
];

export const DEFAULT_ROYAL_STAR_COST_STANDARDS = {
  bathroomFullGutTarget: {
    key: "bathroomFullGutTarget",
    laborPlusMaterial: { preferredRange: [12000, 22000], warningRange: [10000, 26000] },
    source: "Royal Star stored standard",
    confidence: "Moderate",
    effectiveDate: "2026-01-01",
  },
  roofingPerSquare: {
    key: "roofingPerSquare",
    laborPlusMaterial: { preferredRange: [400, 750], warningRange: [350, 900] },
    source: "Royal Star stored standard",
    confidence: "Moderate",
    effectiveDate: "2026-01-01",
  },
  lvp: {
    key: "lvp",
    materialOnly: { preferredRange: [2.2, 4.5], warningRange: [1.8, 6.0] },
    laborOnly: { preferredRange: [1.5, 3.25], warningRange: [1.25, 4.0] },
    laborPlusMaterial: { preferredRange: [3.7, 7.75], warningRange: [3.2, 10.0] },
    source: "Royal Star stored standard",
    confidence: "High",
    effectiveDate: "2026-01-01",
  },
  windows: {
    key: "windows",
    laborPlusMaterial: { preferredRange: [600, 1200], warningRange: [450, 1500] },
    source: "Royal Star stored standard",
    confidence: "Moderate",
    effectiveDate: "2026-01-01",
  },
  concrete: {
    key: "concrete",
    laborPlusMaterial: { preferredRange: [8, 17], warningRange: [7, 22] },
    source: "Royal Star stored standard",
    confidence: "Moderate",
    effectiveDate: "2026-01-01",
  },
  plumbingRoughInFinish: {
    key: "plumbingRoughInFinish",
    laborPlusMaterial: { preferredRange: [6000, 18000], warningRange: [4500, 25000] },
    source: "Royal Star stored standard",
    confidence: "Moderate",
    effectiveDate: "2026-01-01",
  },
  electricalRewire200a: {
    key: "electricalRewire200a",
    laborPlusMaterial: { preferredRange: [7000, 16500], warningRange: [5500, 22000] },
    source: "Royal Star stored standard",
    confidence: "Moderate",
    effectiveDate: "2026-01-01",
  },
  hvac: {
    key: "hvac",
    laborPlusMaterial: { preferredRange: [7000, 14500], warningRange: [5000, 18000] },
    source: "Royal Star stored standard",
    confidence: "Moderate",
    effectiveDate: "2026-01-01",
  },
  cabinets: {
    key: "cabinets",
    laborPlusMaterial: { preferredRange: [4500, 12000], warningRange: [3000, 16000] },
    source: "Royal Star stored standard",
    confidence: "Moderate",
    effectiveDate: "2026-01-01",
  },
  painting: {
    key: "painting",
    laborPlusMaterial: { preferredRange: [2.2, 4.8], warningRange: [1.8, 6.2] },
    source: "Royal Star stored standard",
    confidence: "Moderate",
    effectiveDate: "2026-01-01",
  },
  drywall: {
    key: "drywall",
    laborPlusMaterial: { preferredRange: [1.75, 3.8], warningRange: [1.5, 5.0] },
    source: "Royal Star stored standard",
    confidence: "Moderate",
    effectiveDate: "2026-01-01",
  },
  demolition: {
    key: "demolition",
    laborPlusMaterial: { preferredRange: [2.5, 7], warningRange: [2, 9] },
    source: "Royal Star stored standard",
    confidence: "Moderate",
    effectiveDate: "2026-01-01",
  },
  security: {
    key: "security",
    laborPlusMaterial: { preferredRange: [400, 2200], warningRange: [300, 3500] },
    source: "Royal Star stored standard",
    confidence: "Low",
    effectiveDate: "2026-01-01",
  },
  contingency: {
    key: "contingency",
    laborPlusMaterial: { preferredRange: [0.1, 0.15], warningRange: [0.08, 0.22] },
    source: "Royal Star stored standard",
    confidence: "High",
    effectiveDate: "2026-01-01",
  },
};

export function buildCanonicalProjectExecutionSchema(input = {}) {
  const projectId = safeString(input.projectId || input.id);
  const propertyId = safeString(input.propertyId);
  const dealId = safeString(input.dealId || input.linkedDealId);
  const now = nowIso();

  return {
    project: {
      projectId: createEvidenceEnvelope(projectId, "project-record"),
      propertyId: createEvidenceEnvelope(propertyId, "project-record"),
      dealId: createEvidenceEnvelope(dealId, "project-record"),
      projectName: createEvidenceEnvelope(safeString(input.projectName)),
      strategy: createEvidenceEnvelope(safeString(input.strategy)),
      projectStatus: createEvidenceEnvelope(safeString(input.projectStatus || "Planning")),
      approvedAcquisitionVersion: createEvidenceEnvelope(safeString(input.approvedAcquisitionVersion || ""), "acquisition-engine", "advisory"),
      approvedValuationVersion: createEvidenceEnvelope(safeString(input.approvedValuationVersion || ""), "valuation-engine", "advisory"),
      originalRehabVersion: createEvidenceEnvelope(safeString(input.originalRehabVersion || ""), "rehab-engine", "advisory"),
      currentRehabVersion: createEvidenceEnvelope(safeString(input.currentRehabVersion || ""), "rehab-engine", "advisory"),
      projectManager: createEvidenceEnvelope(safeString(input.projectManager)),
      startDate: createEvidenceEnvelope(safeString(input.actualStartDate || input.projectedStartDate || "")),
      targetCompletionDate: createEvidenceEnvelope(safeString(input.projectedCompletionDate || "")),
      forecastCompletionDate: createEvidenceEnvelope(safeString(input.forecastCompletionDate || input.projectedCompletionDate || ""), "schedule-engine", "advisory"),
      actualCompletionDate: createEvidenceEnvelope(safeString(input.actualCompletionDate || "")),
      percentComplete: createEvidenceEnvelope(optionalNumber(input.percentComplete), "project-record"),
      overallHealth: createEvidenceEnvelope(safeString(input.overallHealth || "Insufficient Data"), "health-engine", "advisory"),
      budgetHealth: createEvidenceEnvelope(safeString(input.budgetHealth || "Insufficient Data"), "health-engine", "advisory"),
      scheduleHealth: createEvidenceEnvelope(safeString(input.scheduleHealth || "Insufficient Data"), "health-engine", "advisory"),
      qualityHealth: createEvidenceEnvelope(safeString(input.qualityHealth || "Insufficient Data"), "health-engine", "advisory"),
      paymentHealth: createEvidenceEnvelope(safeString(input.paymentHealth || "Insufficient Data"), "payment-engine", "advisory"),
      permitHealth: createEvidenceEnvelope(safeString(input.permitHealth || "Insufficient Data"), "permit-engine", "advisory"),
      lienHealth: createEvidenceEnvelope(safeString(input.lienHealth || "Insufficient Data"), "lien-engine", "advisory"),
      lastUpdated: createEvidenceEnvelope(safeString(input.updatedAt || now), "project-record", "reported"),
    },
    budget: {
      originalApprovedBudget: createEvidenceEnvelope(optionalNumber(input.originalRehabBudget), "underwriting-approved"),
      revisedApprovedBudget: createEvidenceEnvelope(optionalNumber(input.currentRehabBudget), "underwriting-approved"),
      laborBudget: createEvidenceEnvelope(optionalNumber(input.laborBudget), "rehab-budget-engine", "advisory"),
      materialBudget: createEvidenceEnvelope(optionalNumber(input.materialBudget), "rehab-budget-engine", "advisory"),
      permitBudget: createEvidenceEnvelope(optionalNumber(input.permitBudget), "rehab-budget-engine", "advisory"),
      contingency: createEvidenceEnvelope(optionalNumber(input.contingencyAmount || input.contingency), "rehab-budget-engine", "advisory"),
      committedCost: createEvidenceEnvelope(optionalNumber(input.committedCost), "project-record"),
      invoicedCost: createEvidenceEnvelope(optionalNumber(input.invoicedCost), "payment-engine", "advisory"),
      approvedInvoiceCost: createEvidenceEnvelope(optionalNumber(input.approvedInvoiceCost), "payment-engine", "advisory"),
      paidCost: createEvidenceEnvelope(optionalNumber(input.amountPaid || input.paidCost), "payment-engine", "reported"),
      retainage: createEvidenceEnvelope(optionalNumber(input.retainage), "payment-engine", "advisory"),
      pendingChangeOrders: createEvidenceEnvelope(optionalNumber(input.pendingChangeOrders), "change-order-engine", "reported"),
      approvedChangeOrders: createEvidenceEnvelope(optionalNumber(input.approvedChangeOrders), "change-order-engine", "reported"),
      rejectedChangeOrders: createEvidenceEnvelope(optionalNumber(input.rejectedChangeOrders), "change-order-engine", "reported"),
      forecastFinalCost: createEvidenceEnvelope(optionalNumber(input.projectedFinalCost), "forecast-engine", "advisory"),
      remainingCost: createEvidenceEnvelope(optionalNumber(input.remainingBudget), "forecast-engine", "advisory"),
      budgetVariance: createEvidenceEnvelope(optionalNumber(input.budgetVariance), "forecast-engine", "advisory"),
      contingencyRemaining: createEvidenceEnvelope(optionalNumber(input.contingencyRemaining), "forecast-engine", "advisory"),
      cashRequiredToComplete: createEvidenceEnvelope(optionalNumber(input.cashRequiredToComplete), "forecast-engine", "advisory"),
    },
    schedule: {
      projectPhases: createEvidenceEnvelope(Array.isArray(input.phases) ? input.phases : [], "project-record"),
      milestones: createEvidenceEnvelope(Array.isArray(input.milestones) ? input.milestones : [], "schedule-engine", "advisory"),
      dependencies: createEvidenceEnvelope(Array.isArray(input.dependencies) ? input.dependencies : [], "schedule-engine", "advisory"),
      criticalPath: createEvidenceEnvelope(Array.isArray(input.criticalPath) ? input.criticalPath : [], "schedule-engine", "advisory"),
      baselineDates: createEvidenceEnvelope(input.baselineDates || {}, "schedule-engine", "advisory"),
      currentDates: createEvidenceEnvelope(input.currentDates || {}, "schedule-engine", "advisory"),
      actualDates: createEvidenceEnvelope(input.actualDates || {}, "project-record"),
      delays: createEvidenceEnvelope(Array.isArray(input.delays) ? input.delays : [], "schedule-engine", "advisory"),
      scheduleVariance: createEvidenceEnvelope(optionalNumber(input.scheduleVariance), "schedule-engine", "advisory"),
      forecastDelay: createEvidenceEnvelope(optionalNumber(input.forecastDelay), "schedule-engine", "advisory"),
      recoveryPlan: createEvidenceEnvelope(Array.isArray(input.recoveryPlan) ? input.recoveryPlan : [], "schedule-engine", "advisory"),
    },
  };
}

export function buildScopeOfWorkEngine(options = {}) {
  const standards = options.standards || {};
  const categories = [
    "planning and design",
    "permits",
    "demolition",
    "structural",
    "framing",
    "roofing",
    "windows and exterior doors",
    "siding and exterior",
    "masonry",
    "concrete",
    "HVAC",
    "plumbing",
    "electrical",
    "insulation",
    "drywall",
    "waterproofing",
    "bathrooms",
    "kitchen",
    "flooring",
    "interior paint",
    "exterior paint",
    "trim and doors",
    "cabinetry",
    "countertops",
    "appliances",
    "basement",
    "landscaping",
    "security",
    "cleaning",
    "punch list",
    "closeout",
  ];

  function draftScope(input = {}) {
    const roomConditions = Array.isArray(input.roomConditions) ? input.roomConditions : [];
    const deficiencies = Array.isArray(input.knownDeficiencies) ? input.knownDeficiencies : [];
    const permits = Array.isArray(input.requiredPermits) ? input.requiredPermits : [];
    const generated = [];

    roomConditions.forEach((condition, index) => {
      generated.push({
        id: `scope-room-${index + 1}`,
        category: normalizeText(condition.category || condition.system || "planning and design"),
        trade: safeString(condition.trade || "General"),
        areaOrRoom: safeString(condition.room || condition.area || "Unknown"),
        description: safeString(condition.description || "Condition-based scope"),
        quantity: optionalNumber(condition.quantity),
        unit: safeString(condition.unit || "EA"),
        laborResponsibility: safeString(condition.laborResponsibility || "Contractor"),
        materialResponsibility: safeString(condition.materialResponsibility || "Owner"),
        unitCost: optionalNumber(condition.unitCost),
        estimatedLabor: optionalNumber(condition.estimatedLabor),
        estimatedMaterial: optionalNumber(condition.estimatedMaterial),
        estimatedTotal: optionalNumber(condition.estimatedTotal),
        contractor: safeString(condition.contractor),
        vendor: safeString(condition.vendor),
        product: safeString(condition.product),
        sku: safeString(condition.sku),
        productLink: safeString(condition.productLink),
        startMilestone: safeString(condition.startMilestone || "Planning"),
        completionMilestone: safeString(condition.completionMilestone || "Closeout"),
        inspectionRequirement: Boolean(condition.inspectionRequirement),
        photoRequirement: true,
        paymentMilestone: safeString(condition.paymentMilestone || "Completion"),
        status: "Draft",
        notes: safeString(condition.notes),
      });
    });

    deficiencies.forEach((item, index) => {
      generated.push({
        id: `scope-deficiency-${index + 1}`,
        category: normalizeText(item.category || "structural"),
        trade: safeString(item.trade || "General"),
        areaOrRoom: safeString(item.area || "Unknown"),
        description: safeString(item.description || "Known deficiency correction"),
        quantity: optionalNumber(item.quantity),
        unit: safeString(item.unit || "EA"),
        laborResponsibility: safeString(item.laborResponsibility || "Contractor"),
        materialResponsibility: safeString(item.materialResponsibility || "Owner"),
        unitCost: optionalNumber(item.unitCost),
        estimatedLabor: optionalNumber(item.estimatedLabor),
        estimatedMaterial: optionalNumber(item.estimatedMaterial),
        estimatedTotal: optionalNumber(item.estimatedTotal),
        contractor: safeString(item.contractor),
        vendor: safeString(item.vendor),
        product: safeString(item.product),
        sku: safeString(item.sku),
        productLink: safeString(item.productLink),
        startMilestone: safeString(item.startMilestone || "Demo"),
        completionMilestone: safeString(item.completionMilestone || "Final Punch"),
        inspectionRequirement: Boolean(item.inspectionRequirement),
        photoRequirement: true,
        paymentMilestone: safeString(item.paymentMilestone || "Completion"),
        status: "Draft",
        notes: safeString(item.notes),
      });
    });

    permits.forEach((permit, index) => {
      generated.push({
        id: `scope-permit-${index + 1}`,
        category: "permits",
        trade: "Permit",
        areaOrRoom: safeString(permit.area || "Jurisdiction"),
        description: `Permit requirement: ${safeString(permit.type || "Unknown")}`,
        quantity: 1,
        unit: "EA",
        laborResponsibility: "Owner",
        materialResponsibility: "N/A",
        unitCost: optionalNumber(permit.fee),
        estimatedLabor: null,
        estimatedMaterial: optionalNumber(permit.fee),
        estimatedTotal: optionalNumber(permit.fee),
        contractor: "",
        vendor: safeString(permit.jurisdiction),
        product: "",
        sku: "",
        productLink: "",
        startMilestone: "Permitting",
        completionMilestone: "Inspection",
        inspectionRequirement: true,
        photoRequirement: false,
        paymentMilestone: "Submission",
        status: "Draft",
        notes: "Permit evidence required.",
      });
    });

    return {
      scopeStatus: "Draft",
      categories,
      standardsVersion: safeString(standards.version || "1.0.0"),
      sourceSummary: {
        acquisitionInspectionUsed: Boolean(input.acquisitionInspection),
        rehabAssumptionsUsed: Boolean(input.approvedRehabAssumptions),
        propertyFactsUsed: Boolean(input.propertyFacts),
        strategyUsed: safeString(input.strategy),
        materialTierUsed: safeString(input.approvedMaterialTier || ""),
      },
      items: generated,
    };
  }

  function createVersion(scope = {}, actor = "System Administrator") {
    return {
      versionId: `scope-version-${Date.now()}`,
      createdAt: nowIso(),
      actor,
      scopeStatus: safeString(scope.scopeStatus || "Draft"),
      itemCount: Array.isArray(scope.items) ? scope.items.length : 0,
      scope,
    };
  }

  return { draftScope, createVersion };
}

export function createRoyalStarCostStandardsService(initial = {}) {
  const baseline = Object.keys(initial).length ? initial : DEFAULT_ROYAL_STAR_COST_STANDARDS;
  const versions = [{
    versionId: "cost-standards-v1",
    createdAt: nowIso(),
    author: "System Administrator",
    standards: JSON.parse(JSON.stringify(baseline)),
  }];

  function getCurrentVersion() {
    return versions[versions.length - 1];
  }

  function listVersions() {
    return versions.map((entry) => ({
      versionId: entry.versionId,
      createdAt: entry.createdAt,
      author: entry.author,
      standardsCount: Object.keys(entry.standards).length,
    }));
  }

  function upsertStandard(key, payload = {}, author = "System Administrator") {
    const current = getCurrentVersion();
    const next = JSON.parse(JSON.stringify(current.standards));
    next[key] = {
      ...(next[key] || { key }),
      ...payload,
      key,
    };
    versions.push({
      versionId: `cost-standards-v${versions.length + 1}`,
      createdAt: nowIso(),
      author,
      standards: next,
    });
    return getCurrentVersion();
  }

  function evaluateBidAgainstStandard({ standardKey = "", bidUnitCost = null, mode = "laborPlusMaterial" } = {}) {
    const current = getCurrentVersion().standards;
    const standard = current[standardKey];
    if (!standard) {
      return {
        standardFound: false,
        expectedRange: null,
        status: "Unknown Standard",
        variancePct: null,
        warning: "Missing standard remains unknown.",
      };
    }

    const range = standard[mode]?.preferredRange || null;
    const warningRange = standard[mode]?.warningRange || range;
    const bid = optionalNumber(bidUnitCost);

    if (bid === null || !range) {
      return {
        standardFound: true,
        expectedRange: range,
        status: "Insufficient Data",
        variancePct: null,
        warning: "No forced estimate generated.",
      };
    }

    const midpoint = (range[0] + range[1]) / 2;
    const variancePct = midpoint > 0 ? ((bid - midpoint) / midpoint) * 100 : null;
    let status = "Within Standard";
    if (bid < warningRange[0]) status = "Materially Below Standard";
    if (bid > warningRange[1]) status = "Materially Above Standard";

    return {
      standardFound: true,
      expectedRange: range,
      warningRange,
      status,
      variancePct,
      source: standard.source || "Royal Star standard",
      confidence: standard.confidence || "Low",
      effectiveDate: standard.effectiveDate || "",
      distinction: {
        standardVsBid: "Royal Star standard and contractor bid are evaluated separately.",
        allowanceVsQuote: "Allowance and quote values remain distinct fields.",
      },
    };
  }

  return { getCurrentVersion, listVersions, upsertStandard, evaluateBidAgainstStandard };
}

export function buildRehabBudgetEngine(input = {}) {
  const lineItems = Array.isArray(input.lineItems) ? input.lineItems : [];
  const permits = toNumber(input.permits);
  const equipmentRental = toNumber(input.equipmentRental);
  const dumpsters = toNumber(input.dumpsters);
  const delivery = toNumber(input.delivery);
  const taxes = toNumber(input.taxes);
  const contractorOverhead = toNumber(input.contractorOverhead);
  const projectManagement = toNumber(input.projectManagement);
  const utilityCost = toNumber(input.utilityCost);
  const security = toNumber(input.security);
  const cleanup = toNumber(input.cleanup);
  const contingency = toNumber(input.contingency);

  const seenKeys = new Set();
  let doubleCountPrevented = 0;
  let labor = 0;
  let materialOwnerSupplied = 0;
  let materialTradeSupplied = 0;
  let unsupportedAllowanceTotal = 0;
  let missingScopeExposure = 0;
  const costByTrade = {};
  const costByRoom = {};
  const costByPhase = {};

  lineItems.forEach((item, index) => {
    const key = safeString(item.id || `${item.trade}-${item.description}-${index}`);
    if (seenKeys.has(key)) {
      doubleCountPrevented += 1;
      return;
    }
    seenKeys.add(key);

    const laborCost = toNumber(item.laborCost || item.estimatedLabor);
    const materialCost = toNumber(item.materialCost || item.estimatedMaterial);
    const discount = toNumber(item.discount || 0);
    const itemTaxes = toNumber(item.tax || 0);
    const allowance = toNumber(item.allowance || 0);
    const hasSupport = Boolean(item.supportedByScope !== false);

    const lineTotal = Math.max(0, laborCost + materialCost + itemTaxes - discount);
    labor += laborCost;
    if (normalizeText(item.materialResponsibility) === "contractor") {
      materialTradeSupplied += materialCost;
    } else {
      materialOwnerSupplied += materialCost;
    }
    if (!hasSupport) unsupportedAllowanceTotal += allowance;
    if (item.requiredButMissing) missingScopeExposure += toNumber(item.estimatedExposure || lineTotal || allowance);

    const trade = safeString(item.trade || "Unknown");
    const room = safeString(item.room || item.area || "Unknown");
    const phase = safeString(item.phase || "Unassigned");
    costByTrade[trade] = toNumber(costByTrade[trade]) + lineTotal;
    costByRoom[room] = toNumber(costByRoom[room]) + lineTotal;
    costByPhase[phase] = toNumber(costByPhase[phase]) + lineTotal;
  });

  const material = materialOwnerSupplied + materialTradeSupplied;
  const lineItemSubtotal = labor + material;
  const totalRehabBudget = lineItemSubtotal + permits + equipmentRental + dumpsters + delivery + taxes + contractorOverhead + projectManagement + utilityCost + security + cleanup + contingency;
  const squareFeet = Math.max(0, toNumber(input.squareFeet));
  const costPerSquareFoot = squareFeet > 0 ? totalRehabBudget / squareFeet : null;

  const approvedChangeOrders = toNumber(input.approvedChangeOrders);
  const originalBudget = toNumber(input.originalBudget || input.originalRehabBudget);
  const approvedBudget = originalBudget + approvedChangeOrders;
  const revisedApprovedBudget = approvedBudget;

  const committedCost = toNumber(input.committedCost);
  const paidCost = toNumber(input.paidCost || input.amountPaid);
  const currentForecast = Math.max(totalRehabBudget, committedCost, paidCost);
  const conservativeForecast = currentForecast * 1.1;
  const severeOverrunForecast = currentForecast * 1.25;

  const remainingCost = Math.max(0, currentForecast - paidCost);
  const budgetVariance = revisedApprovedBudget - currentForecast;
  const contingencyRemaining = Math.max(0, contingency - toNumber(input.contingencyUsed));
  const cashRequiredToComplete = Math.max(0, remainingCost - Math.max(0, toNumber(input.availableCashForProject)));

  return {
    labor,
    material,
    materialBreakdown: {
      ownerSupplied: materialOwnerSupplied,
      tradeSupplied: materialTradeSupplied,
    },
    permits,
    equipmentRental,
    dumpsters,
    delivery,
    taxes,
    contractorOverhead,
    projectManagement,
    utilityCost,
    security,
    cleanup,
    contingency,
    totalRehabBudget,
    costPerSquareFoot,
    costByTrade,
    costByRoom,
    costByPhase,
    budgetCompleteness: lineItems.length > 0 ? Math.max(0, Math.min(1, 1 - (missingScopeExposure / Math.max(1, totalRehabBudget)))) : 0,
    unsupportedAllowanceTotal,
    missingScopeExposure,
    scenarios: {
      originalBudget,
      approvedBudget,
      currentForecast,
      conservativeForecast,
      severeOverrunForecast,
    },
    revisedApprovedBudget,
    forecastFinalCost: currentForecast,
    remainingCost,
    budgetVariance,
    contingencyRemaining,
    cashRequiredToComplete,
    formulaVersion: "rehab-budget-v1",
    controls: {
      noDoubleCounting: doubleCountPrevented,
      contingencyDoesNotHideKnownScope: missingScopeExposure > 0 ? "Warning" : "Pass",
      approvedChangeOrdersAffectRevisedOnly: true,
      forecastDoesNotOverwriteApprovedBudget: true,
      discountsExplicit: true,
      taxesExplicit: true,
    },
  };
}

export function createContractorPrequalificationService() {
  function evaluate(contractor = {}) {
    const requiredEvidence = [
      "licenseStatus",
      "insuranceStatus",
      "w9Status",
      "references",
      "lienWaiverCompliance",
      "taxDocumentStatus",
      "safetyDocumentation",
    ];
    const missing = requiredEvidence.filter((field) => {
      const value = contractor[field];
      if (Array.isArray(value)) return value.length === 0;
      return value === null || value === undefined || value === "" || String(value).toLowerCase() === "missing";
    });

    let status = safeString(contractor.approvalStatus || "Prospect");
    if (missing.length > 0 && status === "Approved") {
      status = "Documents Missing";
    } else if (missing.length > 0 && status === "Prospect") {
      status = "Documents Missing";
    } else if (missing.length === 0 && status === "Prospect") {
      status = "Under Review";
    }

    const approved = missing.length === 0 && (status === "Approved" || status === "Approved With Conditions");

    return {
      contractorId: safeString(contractor.contractorId || contractor.id),
      company: safeString(contractor.company || contractor.companyName),
      contact: safeString(contractor.contact || contractor.contactName),
      trade: safeString(contractor.trade),
      serviceArea: safeString(contractor.serviceArea),
      entityStatus: safeString(contractor.entityStatus || "Unknown"),
      licenseStatus: safeString(contractor.licenseStatus || "Missing"),
      insuranceStatus: safeString(contractor.insuranceStatus || "Missing"),
      w9Status: safeString(contractor.w9Status || "Missing"),
      references: contractor.references || [],
      experience: safeString(contractor.experience || "Unknown"),
      projectCapacity: safeString(contractor.projectCapacity || "Unknown"),
      currentWorkload: safeString(contractor.currentWorkload || "Unknown"),
      minimumJobSize: optionalNumber(contractor.minimumJobSize),
      paymentTerms: safeString(contractor.paymentTerms || ""),
      materialPolicy: safeString(contractor.materialPolicy || ""),
      warranty: safeString(contractor.warranty || ""),
      lienWaiverCompliance: safeString(contractor.lienWaiverCompliance || "Missing"),
      safetyDocumentation: safeString(contractor.safetyDocumentation || "Missing"),
      bankingStatus: safeString(contractor.bankingStatus || "Unknown"),
      taxDocumentStatus: safeString(contractor.taxDocumentStatus || "Missing"),
      approvalStatus: approved ? status : (status === "Approved" ? "Documents Missing" : status),
      riskFlags: missing.map((field) => `Missing ${field}`),
      evidenceMissing: missing,
      fullyApproved: approved,
    };
  }

  return { evaluate };
}

export function buildBidComparisonEngine(input = {}) {
  const bids = Array.isArray(input.bids) ? input.bids : [];
  const scopeItems = Array.isArray(input.scopeItems) ? input.scopeItems : [];
  const standardsService = input.standardsService || createRoyalStarCostStandardsService();

  const compared = bids.map((bid, index) => {
    const lineItems = Array.isArray(bid.lineItems) ? bid.lineItems : [];
    const coveredScopeKeys = new Set(lineItems.map((item) => safeString(item.scopeKey)));
    const missingScope = scopeItems.filter((scope) => !coveredScopeKeys.has(safeString(scope.scopeKey || scope.id)));
    const labor = lineItems.reduce((sum, item) => sum + toNumber(item.labor), 0);
    const materials = lineItems.reduce((sum, item) => sum + toNumber(item.materials), 0);
    const allowances = lineItems.reduce((sum, item) => sum + toNumber(item.allowance), 0);
    const taxes = lineItems.reduce((sum, item) => sum + toNumber(item.taxes), 0);
    const permits = lineItems.reduce((sum, item) => sum + toNumber(item.permits), 0);
    const discount = lineItems.reduce((sum, item) => sum + toNumber(item.discount), 0);
    const markup = toNumber(bid.markup);
    const normalizedBidTotal = Math.max(0, labor + materials + allowances + taxes + permits + markup - discount);

    const uncoveredScopeValue = missingScope.reduce((sum, item) => sum + Math.max(0, toNumber(item.estimatedTotal || item.estimatedExposure || item.unitCost)), 0);
    const effectiveBidTotal = normalizedBidTotal + uncoveredScopeValue;

    const standardVariance = lineItems.map((item) => {
      const result = standardsService.evaluateBidAgainstStandard({
        standardKey: safeString(item.standardKey),
        bidUnitCost: optionalNumber(item.unitCost),
        mode: safeString(item.mode || "laborPlusMaterial"),
      });
      return result;
    });

    const materiallyFlagged = standardVariance.filter((entry) => entry.status === "Materially Above Standard" || entry.status === "Materially Below Standard").length;
    const priceScore = Math.max(0, 100 - Math.min(80, (effectiveBidTotal / Math.max(1, toNumber(input.referenceBudget || effectiveBidTotal))) * 45));
    const completenessScore = Math.max(0, 100 - missingScope.length * 10 - (bid.ambiguousLanguageCount || 0) * 5);
    const timelineScore = Math.max(0, 100 - Math.max(0, toNumber(bid.timelineDays) - toNumber(input.targetTimelineDays || bid.timelineDays)) * 0.7);
    const qualityScore = Math.max(0, Math.min(100, toNumber(bid.qualityScore || bid.contractorScore || 50)));
    const riskScore = Math.max(0, Math.min(100, 50 + materiallyFlagged * 8 + missingScope.length * 7 + (bid.exclusions?.length || 0) * 3 + (bid.insuranceOk === false ? 10 : 0) + (bid.licenseOk === false ? 10 : 0)));
    const contractorPerformanceScore = Math.max(0, Math.min(100, toNumber(bid.historicalPerformanceScore || bid.contractorScore || 50)));

    const overallBidScore = (priceScore * 0.2) + (completenessScore * 0.22) + (timelineScore * 0.12) + (qualityScore * 0.18) + ((100 - riskScore) * 0.16) + (contractorPerformanceScore * 0.12);
    const reviewStatus = missingScope.length > 0 || riskScore > 65 ? "Review Required" : "Ready for Committee Review";

    return {
      bidId: safeString(bid.bidId || `bid-${index + 1}`),
      contractor: safeString(bid.contractor),
      scopeCoverage: scopeItems.length > 0 ? (scopeItems.length - missingScope.length) / scopeItems.length : 0,
      exclusions: bid.exclusions || [],
      labor,
      materials,
      allowances,
      taxes,
      permits,
      timeline: toNumber(bid.timelineDays),
      crewSize: toNumber(bid.crewSize),
      paymentSchedule: bid.paymentSchedule || [],
      warranty: safeString(bid.warranty),
      changeOrderTerms: safeString(bid.changeOrderTerms),
      markup,
      insurance: bid.insuranceOk !== false,
      licenseStatus: bid.licenseOk !== false,
      references: bid.references || [],
      contractorScore: toNumber(bid.contractorScore),
      historicalPerformance: contractorPerformanceScore,
      priceVarianceFromStandards: standardVariance,
      missingLineItems: missingScope,
      ambiguousLanguage: toNumber(bid.ambiguousLanguageCount),
      normalizedBidTotal,
      uncoveredScopeValue,
      effectiveBidTotal,
      priceScore,
      completenessScore,
      timelineScore,
      qualityScore,
      riskScore,
      contractorPerformanceScore,
      overallBidScore,
      recommendedReviewStatus: reviewStatus,
    };
  });

  if (compared.length === 0) {
    return {
      bids: [],
      outputs: {
        bestPrice: null,
        bestCompleteBid: null,
        lowestRisk: null,
        fastest: null,
        bestOverallValue: null,
        reviewRequired: [],
        insufficientData: true,
      },
      recommendation: "Insufficient Data",
      autoAwarded: false,
    };
  }

  const byScore = [...compared].sort((a, b) => b.overallBidScore - a.overallBidScore);
  const byPrice = [...compared].sort((a, b) => a.effectiveBidTotal - b.effectiveBidTotal);
  const byRisk = [...compared].sort((a, b) => a.riskScore - b.riskScore);
  const byFast = [...compared].sort((a, b) => a.timeline - b.timeline);
  const bestComplete = [...compared].filter((entry) => entry.missingLineItems.length === 0).sort((a, b) => b.completenessScore - a.completenessScore);

  return {
    bids: compared,
    outputs: {
      bestPrice: byPrice[0]?.bidId || null,
      bestCompleteBid: bestComplete[0]?.bidId || null,
      lowestRisk: byRisk[0]?.bidId || null,
      fastest: byFast[0]?.bidId || null,
      bestOverallValue: byScore[0]?.bidId || null,
      reviewRequired: compared.filter((entry) => entry.recommendedReviewStatus === "Review Required").map((entry) => entry.bidId),
      insufficientData: false,
    },
    recommendation: byScore[0].recommendedReviewStatus === "Review Required" ? "Review Required" : "Best Overall Value",
    autoAwarded: false,
  };
}

export function buildContractCommitmentControl(input = {}) {
  const contract = {
    contractId: safeString(input.contractId || input.id),
    contractor: safeString(input.contractor),
    approvedScopeVersion: safeString(input.approvedScopeVersion),
    contractAmount: optionalNumber(input.contractAmount),
    startDate: safeString(input.startDate),
    completionDate: safeString(input.completionDate),
    paymentSchedule: Array.isArray(input.paymentSchedule) ? input.paymentSchedule : [],
    retainage: optionalNumber(input.retainage),
    warranty: safeString(input.warranty),
    insuranceRequirements: safeString(input.insuranceRequirements),
    lienWaiverRequirements: safeString(input.lienWaiverRequirements),
    changeOrderTerms: safeString(input.changeOrderTerms),
    terminationTerms: safeString(input.terminationTerms),
    signedStatus: safeString(input.signedStatus || "Unsigned"),
    documentReference: safeString(input.documentReference),
    approvedBy: safeString(input.approvedBy),
    approvalDate: safeString(input.approvalDate),
    status: CONTRACT_STATUSES.includes(input.status) ? input.status : "Draft",
  };

  const hasSignedEvidence = Boolean(contract.documentReference) || Boolean(input.explicitAdministratorConfirmation);
  const violations = [];
  if (contract.status === "Signed" && !hasSignedEvidence) {
    violations.push("Cannot mark contract as Signed without signed document reference or explicit administrator confirmation.");
    contract.status = "Sent";
  }

  return {
    contract,
    statuses: CONTRACT_STATUSES,
    hasSignedEvidence,
    violations,
    autoAwarded: false,
  };
}

export function buildDrawAndPaymentService(input = {}) {
  const draws = Array.isArray(input.draws) ? input.draws : [];
  const contractAmount = toNumber(input.contractAmount);
  const approvedChangeOrders = toNumber(input.approvedChangeOrders);
  const ceiling = contractAmount + approvedChangeOrders;
  const seenInvoiceRefs = new Set();
  const seenPaymentRefs = new Set();

  let retainageTotal = 0;
  let approvedAmountTotal = 0;
  let paymentTotal = 0;
  const events = [];

  const evaluated = draws.map((draw, index) => {
    const requestedAmount = toNumber(draw.requestedAmount);
    const approvedAmount = toNumber(draw.approvedAmount);
    const currentPayment = toNumber(draw.currentPayment || draw.paymentAmount);
    const retainage = toNumber(draw.retainage);
    const invoiceRef = safeString(draw.invoiceReference || draw.invoice);
    const paymentRef = safeString(draw.paymentReference || draw.paymentId || draw.checkNumber);
    const status = DRAW_PAYMENT_STATUSES.includes(draw.status) ? draw.status : "Draft";

    const errors = [];
    if (status === "Submitted" || status === "Under Review") {
      if (!draw.invoice) errors.push("Documentation Missing: invoice");
      if (!draw.photos || draw.photos.length === 0) errors.push("Documentation Missing: photos");
      if (draw.inspectionRequired && !draw.inspection) errors.push("Documentation Missing: inspection");
    }
    if (invoiceRef && seenInvoiceRefs.has(invoiceRef)) errors.push("Duplicate invoice reference.");
    if (paymentRef && seenPaymentRefs.has(paymentRef)) errors.push("Duplicate payment reference.");

    if (approvedAmount > requestedAmount && requestedAmount > 0) errors.push("Approved amount exceeds requested amount.");
    if (approvedAmount + approvedAmountTotal > ceiling && ceiling > 0) errors.push("Approved amount exceeds contract plus approved changes.");

    retainageTotal += retainage;
    approvedAmountTotal += approvedAmount;
    paymentTotal += currentPayment;

    if (invoiceRef) seenInvoiceRefs.add(invoiceRef);
    if (paymentRef) seenPaymentRefs.add(paymentRef);

    const approvalStatus = status === "Approved" || status === "Partially Approved" ? status : (errors.length > 0 ? "Documentation Missing" : status);
    const paymentStatus = currentPayment > 0 ? (draw.bankCleared ? "Cleared" : "Paid") : status;

    events.push({
      eventType: "PAYMENT_AUDIT_EVENT",
      drawNumber: safeString(draw.drawNumber || `draw-${index + 1}`),
      status: paymentStatus,
      at: nowIso(),
      amount: currentPayment,
    });

    return {
      drawNumber: safeString(draw.drawNumber || `draw-${index + 1}`),
      contractor: safeString(draw.contractor),
      scopeItems: Array.isArray(draw.scopeItems) ? draw.scopeItems : [],
      completionPercentage: optionalNumber(draw.completionPercentage),
      requestedAmount,
      approvedAmount,
      retainage,
      priorPayments: toNumber(draw.priorPayments),
      currentPayment,
      balanceRemaining: Math.max(0, approvedAmount - (toNumber(draw.priorPayments) + currentPayment)),
      invoice: draw.invoice || null,
      inspection: draw.inspection || null,
      photos: draw.photos || [],
      conditionalLienWaiver: draw.conditionalLienWaiver || null,
      unconditionalLienWaiver: draw.unconditionalLienWaiver || null,
      lenderDrawReference: safeString(draw.lenderDrawReference),
      paymentMethod: safeString(draw.paymentMethod),
      approvalStatus,
      paymentStatus,
      errors,
    };
  });

  const summaryErrors = [];
  if (paymentTotal > ceiling && ceiling > 0) summaryErrors.push("Payment total exceeds contract plus approved changes.");
  if (retainageTotal < 0) summaryErrors.push("Retainage reconciliation invalid.");

  return {
    statuses: DRAW_PAYMENT_STATUSES,
    draws: evaluated,
    summary: {
      contractCeiling: ceiling,
      approvedAmountTotal,
      paymentTotal,
      retainageTotal,
      retainageReconciled: retainageTotal >= 0,
      allLienWaiverRequirementsVisible: evaluated.every((draw) => draw.conditionalLienWaiver !== undefined && draw.unconditionalLienWaiver !== undefined),
      errors: summaryErrors,
    },
    auditEvents: events,
    rules: {
      invoiceNotApproval: true,
      approvalNotPayment: true,
      paymentNotClearance: true,
      duplicatePaymentPrevented: evaluated.every((draw) => !draw.errors.includes("Duplicate payment reference.")),
    },
  };
}

export function buildChangeOrderService(input = {}) {
  const current = {
    changeOrderId: safeString(input.changeOrderId || input.id),
    project: safeString(input.project),
    contractor: safeString(input.contractor),
    requestDate: safeString(input.requestDate),
    reason: safeString(input.reason),
    affectedScope: input.affectedScope || [],
    laborImpact: optionalNumber(input.laborImpact),
    materialImpact: optionalNumber(input.materialImpact),
    permitImpact: optionalNumber(input.permitImpact),
    timelineImpact: optionalNumber(input.timelineImpact),
    financingImpact: optionalNumber(input.financingImpact),
    profitImpact: optionalNumber(input.profitImpact),
    contingencyImpact: optionalNumber(input.contingencyImpact),
    evidence: input.evidence || [],
    photos: input.photos || [],
    requestedAmount: optionalNumber(input.requestedAmount),
    approvedAmount: optionalNumber(input.approvedAmount),
    status: CHANGE_ORDER_STATUSES.includes(input.status) ? input.status : "Draft",
    approval: input.approval || null,
    auditReference: safeString(input.auditReference),
  };

  const errors = [];
  if ((current.status === "Submitted" || current.status === "Under Review") && (!current.evidence || current.evidence.length === 0)) {
    errors.push("Evidence Required");
    current.status = "Evidence Required";
  }

  const materialThreshold = toNumber(input.materialThreshold || 5000);
  const totalImpact = toNumber(current.laborImpact) + toNumber(current.materialImpact) + toNumber(current.permitImpact);
  const isMaterial = totalImpact >= materialThreshold || Math.abs(toNumber(current.timelineImpact)) >= toNumber(input.timelineThreshold || 14) || Math.abs(toNumber(current.financingImpact)) >= toNumber(input.financingThreshold || 2500);

  let reunderwriteEvent = null;
  if (isMaterial && (current.status === "Approved" || current.status === "Partially Approved") && !input.reunderwriteEventAlreadyRaised) {
    reunderwriteEvent = {
      eventId: `reunderwrite-${Date.now()}`,
      reason: "Material Change Order",
      sourceChangeOrderId: current.changeOrderId,
      triggeredAt: nowIso(),
      thresholdSummary: {
        totalImpact,
        timelineImpact: toNumber(current.timelineImpact),
        financingImpact: toNumber(current.financingImpact),
      },
    };
  }

  return {
    statuses: CHANGE_ORDER_STATUSES,
    changeOrder: current,
    errors,
    materialAssessment: {
      materialThreshold,
      totalImpact,
      isMaterial,
      reunderwriteEvent,
      exactlyOneTriggered: Boolean(reunderwriteEvent),
    },
  };
}

export function buildProjectScheduleEngine(input = {}) {
  const provided = Array.isArray(input.phases) ? input.phases : [];
  const phaseMap = new Map(provided.map((phase) => [normalizeText(phase.name || phase.phaseName), phase]));
  const phases = ROYAL_STAR_SEQUENCE.map((name, index) => {
    const existing = phaseMap.get(normalizeText(name)) || {};
    const plannedDuration = Math.max(0, toNumber(existing.plannedDurationDays || existing.plannedDuration || 0));
    const actualDuration = Math.max(0, toNumber(existing.actualDurationDays || existing.actualDuration || 0));
    return {
      name,
      sequence: index + 1,
      dependencies: existing.dependencies || (index === 0 ? [] : [ROYAL_STAR_SEQUENCE[index - 1]]),
      plannedDuration,
      actualDuration,
      predecessor: existing.predecessor || (index === 0 ? "" : ROYAL_STAR_SEQUENCE[index - 1]),
      successor: existing.successor || (index < ROYAL_STAR_SEQUENCE.length - 1 ? ROYAL_STAR_SEQUENCE[index + 1] : ""),
      requiredInspection: Boolean(existing.requiredInspection),
      contractor: safeString(existing.contractor),
      milestone: safeString(existing.milestone || name),
      paymentGate: safeString(existing.paymentGate),
      photoGate: safeString(existing.photoGate),
      blocker: safeString(existing.blocker),
      delayReason: safeString(existing.delayReason),
      recoveryAction: safeString(existing.recoveryAction),
    };
  });

  const baselineCompletion = phases.reduce((sum, phase) => sum + phase.plannedDuration, 0);
  const actualCompletion = phases.reduce((sum, phase) => sum + (phase.actualDuration > 0 ? phase.actualDuration : phase.plannedDuration), 0);
  const scheduleVariance = actualCompletion - baselineCompletion;
  const daysDelayed = Math.max(0, scheduleVariance);
  const criticalPath = phases.filter((phase) => phase.plannedDuration > 0).map((phase) => phase.name);
  const floatByPhase = phases.reduce((acc, phase) => {
    acc[phase.name] = Math.max(0, baselineCompletion - actualCompletion);
    return acc;
  }, {});

  const costOfDelayPerDay = toNumber(input.costOfDelayPerDay || 150);
  const costOfDelay = daysDelayed * costOfDelayPerDay;
  const financingExtensionExposure = daysDelayed * toNumber(input.financingCarryPerDay || 95);

  return {
    sequence: ROYAL_STAR_SEQUENCE,
    phases,
    baselineCompletion,
    currentForecast: actualCompletion,
    scheduleVariance,
    criticalPath,
    floatByPhase,
    daysDelayed,
    costOfDelay,
    financingExtensionExposure,
    recoveryOptions: phases
      .filter((phase) => phase.delayReason || phase.blocker)
      .map((phase) => ({ phase: phase.name, action: phase.recoveryAction || "Add crew and resequence non-dependent tasks." })),
  };
}

export function buildPermitInspectionTracking(input = {}) {
  const records = Array.isArray(input.records) ? input.records : [];
  return records.map((record) => {
    const status = PERMIT_STATUSES.includes(record.status) ? record.status : "Needed";
    return {
      permitType: safeString(record.permitType),
      jurisdiction: safeString(record.jurisdiction),
      applicationDate: safeString(record.applicationDate),
      permitNumber: safeString(record.permitNumber),
      fee: optionalNumber(record.fee),
      status,
      issueDate: safeString(record.issueDate),
      expirationDate: safeString(record.expirationDate),
      requiredInspection: safeString(record.requiredInspection),
      inspectionDate: safeString(record.inspectionDate),
      inspector: safeString(record.inspector),
      result: safeString(record.result),
      correctionNotice: safeString(record.correctionNotice),
      reinspection: safeString(record.reinspection),
      document: safeString(record.document),
      notes: safeString(record.notes),
      inventedStatus: false,
    };
  });
}

export function buildProjectPhotoDocumentControl(input = {}) {
  const photos = Array.isArray(input.photos) ? input.photos : [];
  const docs = Array.isArray(input.documents) ? input.documents : [];
  const requiredFields = ["project", "phase", "roomOrArea", "contractor", "date", "source", "rights", "caption", "milestone"];

  const validatedPhotos = photos.map((photo) => {
    const missing = requiredFields.filter((field) => !safeString(photo[field]));
    return {
      ...photo,
      missingFields: missing,
      evidenceOnly: true,
      autoCertifiesCompletion: false,
    };
  });

  return {
    photos: validatedPhotos,
    documents: docs,
    missingEvidenceCount: validatedPhotos.filter((photo) => photo.missingFields.length > 0).length,
  };
}

export function buildQualityControlService(input = {}) {
  const items = Array.isArray(input.items) ? input.items : [];
  const unresolvedRequiredItems = items.filter((item) => {
    const status = QUALITY_STATUSES.includes(item.status) ? item.status : "Open";
    const required = item.requiredForCloseout !== false;
    return required && !["Completed", "Waived", "Archived"].includes(status);
  });

  return {
    statuses: QUALITY_STATUSES,
    items: items.map((item) => ({
      item: safeString(item.item),
      room: safeString(item.room),
      trade: safeString(item.trade),
      contractor: safeString(item.contractor),
      severity: safeString(item.severity),
      issue: safeString(item.issue),
      requiredCorrection: safeString(item.requiredCorrection),
      photo: safeString(item.photo),
      dateFound: safeString(item.dateFound),
      dueDate: safeString(item.dueDate),
      status: QUALITY_STATUSES.includes(item.status) ? item.status : "Open",
      verification: safeString(item.verification),
      completionPhoto: safeString(item.completionPhoto),
      reinspection: safeString(item.reinspection),
      responsibleParty: safeString(item.responsibleParty),
      costResponsibility: safeString(item.costResponsibility),
    })),
    unresolvedRequiredCount: unresolvedRequiredItems.length,
    retainageReleaseAllowed: unresolvedRequiredItems.length === 0 || Boolean(input.approvedException),
  };
}

export function buildForecastToCompleteEngine(input = {}) {
  const originalBudget = toNumber(input.originalBudget || input.originalRehabBudget);
  const revisedBudget = toNumber(input.revisedBudget || input.currentRehabBudget || originalBudget);
  const paidToDate = toNumber(input.paidToDate || input.amountPaid);
  const committedNotPaid = Math.max(0, toNumber(input.committedCost) - paidToDate);
  const approvedNotCommitted = Math.max(0, revisedBudget - toNumber(input.committedCost));
  const pendingChangeExposure = toNumber(input.pendingChangeExposure || input.pendingChangeOrders);
  const knownRemainingCost = Math.max(0, toNumber(input.knownRemainingCost || committedNotPaid));
  const estimatedRemainingCost = Math.max(0, toNumber(input.estimatedRemainingCost || approvedNotCommitted));
  const unresolvedScopeAllowance = Math.max(0, toNumber(input.unresolvedScopeAllowance || input.missingScopeExposure));
  const remainingContingency = Math.max(0, toNumber(input.remainingContingency || input.contingencyRemaining));

  const forecastFinalCost = paidToDate + committedNotPaid + approvedNotCommitted + pendingChangeExposure + unresolvedScopeAllowance;
  const projectedOverrun = Math.max(0, forecastFinalCost - revisedBudget);
  const projectedUnderrun = Math.max(0, revisedBudget - forecastFinalCost);
  const cashRequiredToFinish = Math.max(0, forecastFinalCost - paidToDate);

  const scenarios = {
    current: forecastFinalCost,
    likely: forecastFinalCost * 1.03,
    conservative: forecastFinalCost * 1.1,
    contractorFailure: forecastFinalCost * 1.2,
    scheduleDelay: forecastFinalCost + toNumber(input.delayCostImpact || 0),
    majorSystemSurprise: forecastFinalCost + toNumber(input.majorSystemSurpriseImpact || 0),
    combinedDownside: (forecastFinalCost * 1.2) + toNumber(input.delayCostImpact || 0) + toNumber(input.majorSystemSurpriseImpact || 0),
  };

  return {
    originalBudget,
    revisedBudget,
    paidToDate,
    committedNotPaid,
    approvedNotCommitted,
    pendingChangeExposure,
    knownRemainingCost,
    estimatedRemainingCost,
    unresolvedScopeAllowance,
    remainingContingency,
    forecastFinalCost,
    projectedOverrun,
    projectedUnderrun,
    cashRequiredToFinish,
    projectedCompletionDate: safeString(input.projectedCompletionDate),
    costToCompleteConfidence: input.costToCompleteConfidence || "Moderate",
    scenarios,
  };
}

export function buildProjectHealthEngine(input = {}) {
  const scoreInputs = {
    budget: toNumber(input.budgetScore, 50),
    schedule: toNumber(input.scheduleScore, 50),
    scope: toNumber(input.scopeScore, 50),
    contractor: toNumber(input.contractorScore, 50),
    payment: toNumber(input.paymentScore, 50),
    quality: toNumber(input.qualityScore, 50),
    permit: toNumber(input.permitScore, 50),
    inspection: toNumber(input.inspectionScore, 50),
    lien: toNumber(input.lienScore, 50),
    materialAvailability: toNumber(input.materialAvailabilityScore, 50),
    financingMaturity: toNumber(input.financingMaturityScore, 50),
    drawTiming: toNumber(input.drawTimingScore, 50),
    contingency: toNumber(input.contingencyScore, 50),
    unresolvedDecisions: toNumber(input.unresolvedDecisionsScore, 50),
  };

  const values = Object.values(scoreInputs);
  const projectHealthScore = values.length > 0 ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
  let classification = "Healthy";
  if (values.some((value) => value <= 0)) classification = "Insufficient Data";
  else if (projectHealthScore < 35) classification = "Critical";
  else if (projectHealthScore < 55) classification = "At Risk";
  else if (projectHealthScore < 72) classification = "Watch";

  const blockers = [];
  const warnings = [];
  Object.entries(scoreInputs).forEach(([key, value]) => {
    if (value <= 20) blockers.push(`${key} critical`);
    else if (value <= 45) warnings.push(`${key} watch`);
  });

  return {
    projectHealthScore,
    budgetHealth: scoreInputs.budget,
    scheduleHealth: scoreInputs.schedule,
    contractorHealth: scoreInputs.contractor,
    qualityHealth: scoreInputs.quality,
    cashHealth: scoreInputs.payment,
    complianceHealth: (scoreInputs.permit + scoreInputs.inspection + scoreInputs.lien) / 3,
    riskLevel: classification,
    blockers,
    warnings,
    requiredAction: blockers.length > 0 ? "Immediate escalation and recovery plan required." : warnings.length > 0 ? "Monitor and correct." : "Maintain execution pace.",
    recoveryPriority: blockers.length > 0 ? "High" : warnings.length > 0 ? "Medium" : "Low",
  };
}

export function buildContractorPerformanceEngine(input = {}) {
  const fields = [
    "bidAccuracy",
    "budgetVariance",
    "scheduleVariance",
    "changeOrderFrequency",
    "changeOrderQuality",
    "workmanship",
    "punchListCount",
    "correctionSpeed",
    "communication",
    "documentation",
    "drawAccuracy",
    "lienWaiverCompliance",
    "insuranceCompliance",
    "warrantyResponse",
    "safety",
    "reliability",
  ];

  const metrics = {};
  fields.forEach((field) => {
    metrics[field] = optionalNumber(input[field]);
  });

  const available = Object.values(metrics).filter((value) => value !== null);
  const overall = available.length ? available.reduce((sum, value) => sum + value, 0) / available.length : null;

  const trend = safeString(input.trend || (overall === null ? "Insufficient Data" : overall >= 80 ? "Improving" : overall >= 60 ? "Stable" : "Declining"));
  const rehireStatus = overall === null ? "Insufficient Data" : overall >= 75 ? "Rehire" : overall >= 60 ? "Conditional Rehire" : "Do Not Rehire";

  return {
    version: safeString(input.version || "contractor-performance-v1"),
    overallScore: overall,
    tradeSpecificScore: optionalNumber(input.tradeSpecificScore),
    projectScore: optionalNumber(input.projectScore || overall),
    historicalAverage: optionalNumber(input.historicalAverage),
    trend,
    strengths: Array.isArray(input.strengths) ? input.strengths : [],
    weaknesses: Array.isArray(input.weaknesses) ? input.weaknesses : [],
    riskFlags: Array.isArray(input.riskFlags) ? input.riskFlags : [],
    approvedTier: safeString(input.approvedTier || (overall === null ? "Unknown" : overall >= 85 ? "Preferred" : overall >= 70 ? "Approved" : "Watch")),
    rehireStatus,
    missingRatings: fields.filter((field) => metrics[field] === null),
    metrics,
  };
}

export function createVendorPerformanceService() {
  function evaluate(input = {}) {
    const metrics = {
      pricing: optionalNumber(input.pricing),
      discount: optionalNumber(input.discount),
      delivery: optionalNumber(input.delivery),
      leadTime: optionalNumber(input.leadTime),
      damage: optionalNumber(input.damage),
      returns: optionalNumber(input.returns),
      productAvailability: optionalNumber(input.productAvailability),
      invoiceAccuracy: optionalNumber(input.invoiceAccuracy),
      service: optionalNumber(input.service),
      warranty: optionalNumber(input.warranty),
      projectImpact: optionalNumber(input.projectImpact),
      approvedProductCompliance: optionalNumber(input.approvedProductCompliance),
      materialVariance: optionalNumber(input.materialVariance),
      costSavings: optionalNumber(input.costSavings),
      substitutionQuality: optionalNumber(input.substitutionQuality),
    };

    const available = Object.values(metrics).filter((value) => value !== null);
    const overallScore = available.length ? available.reduce((sum, value) => sum + value, 0) / available.length : null;

    return {
      vendorId: safeString(input.vendorId || input.id),
      projectAllocations: Array.isArray(input.projectAllocations) ? input.projectAllocations : [],
      purchaseOrders: Array.isArray(input.purchaseOrders) ? input.purchaseOrders : [],
      invoices: Array.isArray(input.invoices) ? input.invoices : [],
      metrics,
      overallScore,
      missingRatings: Object.entries(metrics).filter(([, value]) => value === null).map(([key]) => key),
      materialControlLink: {
        productVaultLinked: Boolean(input.productVaultLinked),
        materialMatrixLinked: Boolean(input.materialMatrixLinked),
      },
    };
  }

  return { evaluate };
}

export function createPurchaseOrderService() {
  function evaluate(input = {}) {
    const purchaseOrders = Array.isArray(input.purchaseOrders) ? input.purchaseOrders : [];
    const seenKeys = new Set();
    const duplicates = [];

    const normalized = purchaseOrders.map((po, index) => {
      const key = `${normalizeText(po.project)}|${normalizeText(po.vendor)}|${normalizeText(po.sku)}|${safeString(po.scopeItemId)}`;
      if (seenKeys.has(key)) duplicates.push(po.poNumber || `PO-${index + 1}`);
      seenKeys.add(key);

      return {
        poNumber: safeString(po.poNumber || `PO-${index + 1}`),
        project: safeString(po.project),
        vendor: safeString(po.vendor),
        scopeItems: Array.isArray(po.scopeItems) ? po.scopeItems : [],
        products: Array.isArray(po.products) ? po.products : [],
        sku: safeString(po.sku),
        quantity: optionalNumber(po.quantity),
        unitPrice: optionalNumber(po.unitPrice),
        tax: optionalNumber(po.tax),
        delivery: optionalNumber(po.delivery),
        discount: optionalNumber(po.discount),
        total: optionalNumber(po.total),
        orderDate: safeString(po.orderDate),
        expectedDelivery: safeString(po.expectedDelivery),
        actualDelivery: safeString(po.actualDelivery),
        status: PURCHASE_ORDER_STATUSES.includes(po.status) ? po.status : "Draft",
        payment: safeString(po.payment),
        receipt: safeString(po.receipt),
        return: safeString(po.return),
        damage: safeString(po.damage),
        allocation: safeString(po.allocation),
        unallocated: !safeString(po.allocation),
      };
    });

    return {
      statuses: PURCHASE_ORDER_STATUSES,
      purchaseOrders: normalized,
      duplicatePurchases: duplicates,
      unallocatedMaterials: normalized.filter((po) => po.unallocated).map((po) => po.poNumber),
      duplicatePurchasePrevented: duplicates.length === 0,
      allocationControlPass: normalized.every((po) => !po.unallocated),
    };
  }

  return { evaluate };
}

export function buildProjectCloseoutService(input = {}) {
  const required = {
    finalInspection: Boolean(input.finalInspection),
    permitClosure: Boolean(input.permitClosure),
    punchListCompletion: Boolean(input.punchListCompletion),
    finalUnconditionalLienWaiver: Boolean(input.finalUnconditionalLienWaiver),
    contractorWarranty: Boolean(input.contractorWarranty),
    productWarranties: Boolean(input.productWarranties),
    manuals: Boolean(input.manuals),
    receipts: Boolean(input.receipts),
    finalInvoice: Boolean(input.finalInvoice),
    retainageRelease: Boolean(input.retainageRelease),
    finalPhotos: Boolean(input.finalPhotos),
    keys: Boolean(input.keys),
    accessCodes: Boolean(input.accessCodes),
    utilities: Boolean(input.utilities),
    cleaning: Boolean(input.cleaning),
    finalBudgetReconciliation: Boolean(input.finalBudgetReconciliation),
    finalScheduleReconciliation: Boolean(input.finalScheduleReconciliation),
    lenderCloseout: Boolean(input.lenderCloseout),
    appraiserEvidence: Boolean(input.appraiserEvidence),
    certificateOfOccupancy: input.certificateOfOccupancyRequired ? Boolean(input.certificateOfOccupancy) : true,
  };

  const missing = Object.entries(required).filter(([, ok]) => !ok).map(([key]) => key);
  const status = missing.length === 0 ? "Ready for Review" : "Documentation Missing";
  const requestedStatus = safeString(input.status || status);

  return {
    statuses: CLOSEOUT_STATUSES,
    status: CLOSEOUT_STATUSES.includes(requestedStatus) ? requestedStatus : status,
    required,
    missing,
    retainageReleaseAllowed: missing.length === 0 || Boolean(input.approvedException),
  };
}

export function createMaterialChangeDetectionService(config = {}) {
  const thresholds = {
    rehabBudgetPct: toNumber(config.rehabBudgetPctThreshold || 0.08),
    forecastFinalCostPct: toNumber(config.forecastFinalCostPctThreshold || 0.08),
    arvPct: toNumber(config.arvPctThreshold || 0.05),
    timelineDays: toNumber(config.timelineDaysThreshold || 14),
    financingPct: toNumber(config.financingPctThreshold || 0.05),
  };

  function evaluate(change = {}, context = {}) {
    const triggers = [];
    const nonMaterial = [];

    function ratioDelta(current, approved) {
      if (!Number.isFinite(current) || !Number.isFinite(approved) || approved === 0) return 0;
      return Math.abs(current - approved) / Math.abs(approved);
    }

    const rehabDelta = ratioDelta(toNumber(change.currentRehabBudget), toNumber(context.approvedRehabBudget));
    if (rehabDelta >= thresholds.rehabBudgetPct) triggers.push("rehab budget changes materially");

    const forecastDelta = ratioDelta(toNumber(change.forecastFinalCost), toNumber(context.approvedRehabBudget));
    if (forecastDelta >= thresholds.forecastFinalCostPct) triggers.push("forecast final cost crosses threshold");

    const arvDelta = ratioDelta(toNumber(change.currentArv), toNumber(context.approvedArv));
    if (arvDelta >= thresholds.arvPct) triggers.push("ARV changes materially");

    if (Math.abs(toNumber(change.timelineExtensionDays)) >= thresholds.timelineDays) triggers.push("timeline extends materially");

    const financingDelta = ratioDelta(toNumber(change.currentFinancingCost), toNumber(context.approvedFinancingCost));
    if (financingDelta >= thresholds.financingPct) triggers.push("financing terms change materially");

    if (change.contractorFailed || change.contractorReplaced) triggers.push("contractor fails or is replaced");
    if (change.majorSystemScopeAdded) triggers.push("major system scope is added");
    if (change.strategyChanged) triggers.push("strategy changes");
    if (change.exitTimingChanged) triggers.push("exit timing changes");
    if (change.projectPaused) triggers.push("project is paused");

    ["comments", "photoUploads", "documentUploads", "formatting", "statusNotes", "minorCorrectionsBelowThreshold"].forEach((key) => {
      if (change[key]) nonMaterial.push(key);
    });

    const shouldTrigger = triggers.length > 0;
    const alreadyTriggered = Boolean(context.reunderwriteEventOpen);
    const event = shouldTrigger && !alreadyTriggered ? {
      eventId: `material-reunderwrite-${Date.now()}`,
      triggeredAt: nowIso(),
      reasons: triggers,
      values: {
        approved: {
          rehabBudget: toNumber(context.approvedRehabBudget),
          arv: toNumber(context.approvedArv),
          financingCost: toNumber(context.approvedFinancingCost),
        },
        current: {
          rehabBudget: toNumber(change.currentRehabBudget),
          forecastFinalCost: toNumber(change.forecastFinalCost),
          arv: toNumber(change.currentArv),
          financingCost: toNumber(change.currentFinancingCost),
        },
      },
      preservesPriorVersions: true,
      usesLatestApprovedAndForecastValues: true,
    } : null;

    return {
      shouldTrigger,
      reasons: triggers,
      nonMaterialIgnored: nonMaterial,
      event,
      exactlyOneTrigger: shouldTrigger ? !alreadyTriggered : true,
    };
  }

  return { thresholds, evaluate };
}

export function buildProjectExecutionCrossModuleSummary(input = {}) {
  return {
    dealIntelligence: {
      forecastFinalCost: optionalNumber(input.forecastFinalCost),
      budgetVariance: optionalNumber(input.budgetVariance),
      completionForecast: safeString(input.completionForecast),
      projectHealth: safeString(input.projectHealth),
      materialChangeWarning: safeString(input.materialChangeWarning),
      revisedProfit: optionalNumber(input.revisedProfit),
      revisedRecommendation: safeString(input.revisedRecommendation),
    },
    rehabProjectTracker: {
      fullWorkingProjectControlInterface: true,
    },
    contractorHub: {
      prequalification: true,
      bids: true,
      contracts: true,
      performance: true,
      payment: true,
      lienStatus: true,
    },
    vendorDatabase: {
      purchase: true,
      delivery: true,
      cost: true,
      performance: true,
    },
    productVault: {
      approvedMaterialSelections: true,
      actualPurchaseData: true,
      projectAllocation: true,
    },
    lenderDashboard: {
      drawStatus: true,
      approvedCost: true,
      paidCost: true,
      remainingCost: true,
      inspection: true,
      lienDocumentation: true,
      maturityRisk: true,
    },
    appraiserPacket: {
      approvedScope: true,
      completedImprovements: true,
      beforeAfterPhotos: true,
      costSummary: true,
      permitInspectionEvidence: true,
    },
    portfolioDashboard: {
      projectHealth: true,
      cashDeployed: true,
      forecastCompletion: true,
      forecastCost: true,
      revisedEquity: true,
      revisedProfit: true,
    },
    knowledgeBase: {
      estimatedVsActual: true,
      contractorLessons: true,
      vendorLessons: true,
      productLessons: true,
      costStandardUpdatesRequireApproval: true,
    },
  };
}

export function buildProjectExecutionIntelligenceEngine(input = {}) {
  const project = input.project || {};
  const standardsService = input.standardsService || createRoyalStarCostStandardsService(input.costStandards || {});
  const scopeEngine = buildScopeOfWorkEngine({ standards: standardsService.getCurrentVersion() });
  const scopeDraft = scopeEngine.draftScope({
    acquisitionInspection: input.acquisitionInspection,
    approvedRehabAssumptions: input.approvedRehabAssumptions,
    propertyFacts: input.propertyFacts,
    strategy: input.strategy || project.strategy,
    approvedMaterialTier: input.approvedMaterialTier,
    requiredPermits: input.requiredPermits,
    knownDeficiencies: input.knownDeficiencies,
    roomConditions: input.roomConditions,
  });

  const rehabBudget = buildRehabBudgetEngine({
    lineItems: scopeDraft.items,
    permits: input.permitCosts,
    equipmentRental: input.equipmentRental,
    dumpsters: input.dumpsters,
    delivery: input.delivery,
    taxes: input.taxes,
    contractorOverhead: input.contractorOverhead,
    projectManagement: input.projectManagement,
    utilityCost: input.utilityCost,
    security: input.security,
    cleanup: input.cleanup,
    contingency: input.contingency,
    squareFeet: input.squareFeet || project.squareFeet,
    approvedChangeOrders: project.approvedChangeOrders,
    originalBudget: project.originalRehabBudget,
    committedCost: project.committedCost,
    paidCost: project.amountPaid,
    availableCashForProject: input.availableCashForProject,
  });

  const prequalService = createContractorPrequalificationService();
  const contractorPrequalification = prequalService.evaluate(input.contractor || {});

  const bidComparison = buildBidComparisonEngine({
    bids: input.bids || [],
    scopeItems: scopeDraft.items,
    standardsService,
    referenceBudget: rehabBudget.totalRehabBudget,
    targetTimelineDays: toNumber(input.targetTimelineDays || 120),
  });

  const contractControl = buildContractCommitmentControl(input.contract || {});
  const drawPayment = buildDrawAndPaymentService({
    draws: input.draws || [],
    contractAmount: contractControl.contract.contractAmount,
    approvedChangeOrders: project.approvedChangeOrders,
  });

  const changeOrders = (input.changeOrders || []).map((changeOrder) => buildChangeOrderService(changeOrder));
  const schedule = buildProjectScheduleEngine({ phases: input.schedulePhases || project.phases || [] });
  const permits = buildPermitInspectionTracking({ records: input.permitRecords || [] });
  const media = buildProjectPhotoDocumentControl({ photos: input.photos || [], documents: input.documents || [] });
  const quality = buildQualityControlService({ items: input.qualityItems || [], approvedException: input.approvedRetainageException });
  const forecast = buildForecastToCompleteEngine({
    originalBudget: toNumber(project.originalRehabBudget),
    revisedBudget: toNumber(project.currentRehabBudget || rehabBudget.revisedApprovedBudget),
    paidToDate: toNumber(project.amountPaid),
    committedCost: toNumber(project.committedCost),
    pendingChangeExposure: toNumber(project.pendingChangeOrders),
    unresolvedScopeAllowance: rehabBudget.missingScopeExposure,
    remainingContingency: rehabBudget.contingencyRemaining,
    projectedCompletionDate: project.projectedCompletionDate,
    delayCostImpact: schedule.costOfDelay,
  });

  const health = buildProjectHealthEngine({
    budgetScore: rehabBudget.budgetCompleteness * 100,
    scheduleScore: Math.max(0, 100 - Math.max(0, schedule.daysDelayed * 2)),
    scopeScore: scopeDraft.items.length > 0 ? 80 : 0,
    contractorScore: contractorPrequalification.fullyApproved ? 82 : 52,
    paymentScore: drawPayment.summary.errors.length === 0 ? 78 : 48,
    qualityScore: quality.unresolvedRequiredCount === 0 ? 82 : 54,
    permitScore: permits.some((entry) => entry.status === "Failed" || entry.status === "Expired") ? 35 : 75,
    inspectionScore: permits.some((entry) => entry.status === "Corrections Required") ? 50 : 76,
    lienScore: drawPayment.draws.some((draw) => !draw.unconditionalLienWaiver) ? 45 : 78,
    materialAvailabilityScore: 72,
    financingMaturityScore: 68,
    drawTimingScore: 70,
    contingencyScore: rehabBudget.contingencyRemaining > 0 ? 72 : 40,
    unresolvedDecisionsScore: bidComparison.outputs.reviewRequired.length > 0 ? 52 : 78,
  });

  const contractorPerformance = buildContractorPerformanceEngine(input.contractorPerformance || {});
  const vendorPerformanceService = createVendorPerformanceService();
  const vendorPerformance = vendorPerformanceService.evaluate(input.vendorPerformance || {});
  const purchaseOrderService = createPurchaseOrderService();
  const purchaseOrders = purchaseOrderService.evaluate({ purchaseOrders: input.purchaseOrders || [] });
  const closeout = buildProjectCloseoutService(input.closeout || {});
  const materialChangeService = createMaterialChangeDetectionService(input.materialChangeThresholds || {});
  const materialChange = materialChangeService.evaluate(input.materialChange || {}, {
    approvedRehabBudget: toNumber(project.currentRehabBudget || project.originalRehabBudget),
    approvedArv: toNumber(input.approvedArv),
    approvedFinancingCost: toNumber(input.approvedFinancingCost),
    reunderwriteEventOpen: Boolean(input.reunderwriteEventOpen),
  });

  const canonical = buildCanonicalProjectExecutionSchema({
    ...project,
    projectId: project.id,
    currentRehabBudget: rehabBudget.revisedApprovedBudget,
    projectedFinalCost: forecast.forecastFinalCost,
    budgetVariance: forecast.revisedBudget - forecast.forecastFinalCost,
    remainingBudget: forecast.cashRequiredToFinish,
    contingencyRemaining: rehabBudget.contingencyRemaining,
    scheduleVariance: schedule.scheduleVariance,
    forecastDelay: schedule.daysDelayed,
    criticalPath: schedule.criticalPath,
  });

  const crossModule = buildProjectExecutionCrossModuleSummary({
    forecastFinalCost: forecast.forecastFinalCost,
    budgetVariance: forecast.projectedUnderrun > 0 ? forecast.projectedUnderrun : -forecast.projectedOverrun,
    completionForecast: safeString(project.projectedCompletionDate),
    projectHealth: health.riskLevel,
    materialChangeWarning: materialChange.shouldTrigger ? "Re-underwrite Required" : "No Material Change Trigger",
    revisedProfit: optionalNumber(input.revisedProfit),
    revisedRecommendation: safeString(input.revisedRecommendation || "Hold for Review"),
  });

  return {
    canonical,
    scope: scopeDraft,
    scopeVersion: scopeEngine.createVersion(scopeDraft),
    costStandards: standardsService.getCurrentVersion(),
    rehabBudget,
    contractorPrequalification,
    bidComparison,
    contractControl,
    drawPayment,
    changeOrders,
    schedule,
    permits,
    media,
    quality,
    forecast,
    health,
    contractorPerformance,
    vendorPerformance,
    purchaseOrders,
    closeout,
    materialChange,
    crossModule,
    governance: {
      autoApproveBid: false,
      autoAwardContract: false,
      autoPayment: false,
      autoDrawApproval: false,
      autoChangeOrderApproval: false,
      autoBudgetRewrite: false,
      autoArvRewrite: false,
      advisoryOnly: true,
    },
  };
}
