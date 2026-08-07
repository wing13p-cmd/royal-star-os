import { getWorkflowStageOrder, getWorkflowProgress } from "./propertyWorkflowEngine.js";

export const DEAL_STATUS_OPTIONS = [
  "Lead",
  "Data Incomplete",
  "Ready for Underwriting",
  "Underwriting",
  "Decision Pending",
  "Offer Preparation",
  "Offer Submitted",
  "Under Contract",
  "Due Diligence",
  "Rehab Planning",
  "Rehab Active",
  "Exit Preparation",
  "Listed",
  "Refinance Pending",
  "Rental",
  "Sold",
  "Stabilized",
  "Closed",
  "Archived",
];

const LEGACY_STATUS_MAP = {
  active: "Lead",
  pending: "Decision Pending",
  underreview: "Underwriting",
  inrehab: "Rehab Active",
  readytorent: "Rental",
  rented: "Rental",
};

function normalizeKey(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function resolveDealStatusValue(statusValue) {
  const status = String(statusValue || "").trim();
  if (!status) return "Lead";
  if (DEAL_STATUS_OPTIONS.includes(status)) return status;
  const mapped = LEGACY_STATUS_MAP[normalizeKey(status)];
  return mapped || status;
}

export function buildStatusOptionsWithCurrent(currentValue) {
  const current = String(currentValue || "").trim();
  if (!current || DEAL_STATUS_OPTIONS.includes(current)) {
    return DEAL_STATUS_OPTIONS;
  }
  return [...DEAL_STATUS_OPTIONS, current];
}

export function getDealPipelineStageOptions() {
  return getWorkflowStageOrder();
}

export function getDealWorkflowProgress(stage) {
  return getWorkflowProgress(stage);
}
