const WORKFLOW_STAGES = [
  "New Lead",
  "Intake Complete",
  "Data Complete",
  "Ready for Underwriting",
  "Underwriting In Progress",
  "Underwriting Complete",
  "Offer Strategy Finalized",
  "Offer Submitted",
  "Negotiation",
  "Under Contract",
  "Due Diligence",
  "Rehab Active",
  "Exit Prep",
  "Closed",
  "Archived",
];

const CRITICAL_CONFIRMATION_STAGES = new Set([
  "Offer Submitted",
  "Under Contract",
  "Closed",
  "Archived",
]);

function safeString(value, fallback = "") {
  if (value === null || value === undefined) return fallback;
  const text = String(value).trim();
  return text || fallback;
}

function hasNumber(value) {
  return value !== null && value !== undefined && value !== "" && Number.isFinite(Number(value));
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

export function getWorkflowStageOrder() {
  return [...WORKFLOW_STAGES];
}

export function getWorkflowProgress(stage) {
  const index = WORKFLOW_STAGES.indexOf(safeString(stage));
  if (index < 0) return 0;
  return Math.round(((index + 1) / WORKFLOW_STAGES.length) * 100);
}

export function evaluateWorkflowConditions(property = {}) {
  const conditions = {
    hasAddress: Boolean(safeString(property.address) && safeString(property.city) && safeString(property.state) && safeString(property.zipCode)),
    hasParcel: Boolean(safeString(property.parcelNumber)),
    hasMapUrl: Boolean(safeString(property.mapUrl)),
    hasSourceUrl: Boolean(safeString(property.propertySourceUrl)),
    hasPurchasePrice: hasNumber(property.purchasePrice),
    hasRehabBudget: hasNumber(property.currentRehabBudget || property.originalRehabBudget || property.actualRehabCost),
    hasProjectedArv: hasNumber(property.projectedARV || property.supportedARV || property.currentValue),
    hasMonthlyRent: hasNumber(property.monthlyRent),
    hasDebtService: hasNumber(property.monthlyDebtService || property.currentLoanBalance),
    hasClosingDate: Boolean(safeString(property.closingDate || property.saleDate)),
    isSoldStatus: ["sold", "archived", "closed"].includes(safeString(property.status).toLowerCase()),
  };

  return conditions;
}

function buildStageRules(conditions) {
  return [
    { stage: "New Lead", met: true },
    { stage: "Intake Complete", met: conditions.hasAddress },
    { stage: "Data Complete", met: conditions.hasAddress && conditions.hasParcel && conditions.hasMapUrl },
    { stage: "Ready for Underwriting", met: conditions.hasAddress && conditions.hasParcel && conditions.hasPurchasePrice && conditions.hasProjectedArv },
    { stage: "Underwriting In Progress", met: conditions.hasAddress && conditions.hasPurchasePrice },
    { stage: "Underwriting Complete", met: conditions.hasPurchasePrice && conditions.hasProjectedArv && conditions.hasRehabBudget },
    { stage: "Offer Strategy Finalized", met: conditions.hasPurchasePrice && conditions.hasProjectedArv && conditions.hasSourceUrl },
    { stage: "Offer Submitted", met: conditions.hasPurchasePrice && conditions.hasProjectedArv },
    { stage: "Negotiation", met: conditions.hasPurchasePrice && conditions.hasProjectedArv },
    { stage: "Under Contract", met: conditions.hasPurchasePrice && conditions.hasProjectedArv && conditions.hasSourceUrl },
    { stage: "Due Diligence", met: conditions.hasParcel && conditions.hasMapUrl && conditions.hasSourceUrl },
    { stage: "Rehab Active", met: conditions.hasRehabBudget },
    { stage: "Exit Prep", met: conditions.hasMonthlyRent || conditions.hasProjectedArv },
    { stage: "Closed", met: conditions.hasClosingDate || conditions.isSoldStatus },
    { stage: "Archived", met: conditions.isSoldStatus && conditions.hasClosingDate },
  ];
}

function computeRecommendedStage(conditions) {
  const rules = buildStageRules(conditions);
  let recommendedStage = "New Lead";
  for (const rule of rules) {
    if (!rule.met) break;
    recommendedStage = rule.stage;
  }
  return recommendedStage;
}

function stageMessage(stage) {
  const messages = {
    "Data Complete": "Complete parcel and map details before advancing.",
    "Ready for Underwriting": "Core underwriting inputs are ready.",
    "Underwriting Complete": "Finalize assumptions and confirm offer strategy.",
    "Offer Submitted": "Critical transition: ensure approval before submission.",
    "Under Contract": "Critical transition: contract execution confirmation required.",
    "Closed": "Critical transition: verify closing records before marking closed.",
  };
  return messages[stage] || "Workflow stage advanced based on available data.";
}

export function evaluateWorkflowTransition(property = {}, options = {}) {
  const now = safeString(options.now, new Date().toISOString());
  const actor = safeString(options.actor, "System");
  const currentStage = safeString(property.pipelineStage, "New Lead");
  const conditions = evaluateWorkflowConditions(property);
  const recommendedStage = computeRecommendedStage(conditions);
  const fromIndex = WORKFLOW_STAGES.indexOf(currentStage);
  const toIndex = WORKFLOW_STAGES.indexOf(recommendedStage);
  const movingForward = toIndex > fromIndex;
  const needsConfirmation = movingForward && CRITICAL_CONFIRMATION_STAGES.has(recommendedStage);

  const blockers = [];
  if (!conditions.hasAddress) blockers.push("Address, city, state, and ZIP are required.");
  if (!conditions.hasParcel) blockers.push("Parcel number required.");
  if (!conditions.hasMapUrl) blockers.push("Map URL required.");
  if (!conditions.hasSourceUrl) blockers.push("Property source URL required.");
  if (!conditions.hasPurchasePrice) blockers.push("Purchase price required.");
  if (!conditions.hasProjectedArv) blockers.push("Projected or supported ARV required.");

  const history = parseJsonArray(property.workflowTransitionHistory);
  const transition = movingForward
    ? {
        at: now,
        actor,
        fromStage: currentStage,
        toStage: recommendedStage,
        reason: "auto-advance",
        confirmationRequired: needsConfirmation,
      }
    : null;

  const rollbackEntry = safeString(options.rollbackReason)
    ? {
        at: now,
        actor,
        reason: safeString(options.rollbackReason),
        stage: currentStage,
      }
    : null;

  return {
    currentStage,
    recommendedStage,
    shouldAdvance: movingForward,
    needsConfirmation,
    blockers,
    completionPercent: getWorkflowProgress(recommendedStage),
    transitionMessage: stageMessage(recommendedStage),
    transition,
    transitionHistory: transition ? [...history, transition] : history,
    rollbackEntry,
    conditions,
  };
}
