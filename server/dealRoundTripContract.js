import { DEAL_INTAKE_FIELD_CONTRACT } from "../app/src/components/dealIntakeFieldContract.js";

function stringValue(value, fallback = "") { return typeof (value ?? fallback) === "string" ? (value ?? fallback) : fallback; }
function numberValue(value) {
  if (value === "" || value === null || value === undefined) return "";
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : "";
}
function meaningfulAlias(payload, aliases = []) {
  for (const alias of aliases) {
    if (!Object.prototype.hasOwnProperty.call(payload, alias)) continue;
    const value = payload[alias];
    if (value === undefined || value === null) continue;
    if (typeof value === "string" && value.trim() === "") continue;
    return value;
  }
  return undefined;
}
function hasAlias(payload, aliases = []) { return aliases.some((alias) => Object.prototype.hasOwnProperty.call(payload, alias)); }

export function normalizeDealRoundTripPayload(payload = {}) {
  const normalized = {};
  DEAL_INTAKE_FIELD_CONTRACT.forEach((entry) => {
    const selected = meaningfulAlias(payload, entry.aliases);
    normalized[entry.persistedField] = entry.type === "number" ? numberValue(selected) : stringValue(selected);
  });

  const financials = payload.financials && typeof payload.financials === "object" ? payload.financials : null;
  normalized.rawFinancingCostInput = numberValue(meaningfulAlias(financials || payload, ["rawFinancingCostInput", "financingCosts"]));
  normalized.calculatedFinancingCosts = numberValue(meaningfulAlias(financials || payload, ["calculatedFinancingCosts", "calculatedFinancingCost"]));
  normalized.effectiveFinancingCosts = numberValue(meaningfulAlias(financials || payload, ["effectiveFinancingCosts", "effectiveFinancingCost", "financingCosts"]));
  normalized.financingCostSource = stringValue(meaningfulAlias(financials || payload, ["financingCostSource"]), "calculated");
  normalized.financials = financials ? {
    rawFinancingCostInput: normalized.rawFinancingCostInput,
    calculatedFinancingCosts: normalized.calculatedFinancingCosts,
    effectiveFinancingCosts: normalized.effectiveFinancingCosts,
    financingCostSource: normalized.financingCostSource,
  } : undefined;

  const extraNumbers = {
    annualPropertyTaxes: ["annualPropertyTaxes", "annualTaxes", "taxes"], annualInsurance: ["annualInsurance", "insurance"],
    monthlyHoa: ["monthlyHoa", "hoa"], vacancyPercent: ["vacancyPercent", "vacancyPercentage"], maintenancePercent: ["maintenancePercent", "maintenancePercentage"],
    capexPercent: ["capexPercent", "capitalExpendituresPercentage", "capExPercentage"], propertyManagementPercent: ["propertyManagementPercent", "propertyManagementPercentage"],
    monthlyUtilities: ["monthlyUtilities", "monthlyUtilitiesPaidByOwner"], otherMonthlyExpenses: ["otherMonthlyExpenses"], otherMonthlyIncome: ["otherMonthlyIncome", "otherIncome"],
    lenderLoanAmount: ["lenderLoanAmount", "lenderLoan", "loanAmountFromLender"], acquisitionLoan: ["acquisitionLoan", "purchaseLoan", "acquisitionFunding"],
    brokerFee: ["brokerFee"], loanTermMonths: ["loanTermMonths", "loanTerm", "termMonths"], amortizationTermMonths: ["amortizationTermMonths", "amortizationTerm"],
    refinanceLtvPercent: ["refinanceLtvPercent", "refinanceLtvPercentage"], refinanceInterestRate: ["refinanceInterestRate"], refinanceLoanTermYears: ["refinanceLoanTermYears"], refinanceClosingCosts: ["refinanceClosingCosts"],
    overallRisk: ["overallRisk"], warningCount: ["warningCount"], confidenceScore: ["confidenceScore"],
  };
  Object.entries(extraNumbers).forEach(([field, aliases]) => { normalized[field] = numberValue(meaningfulAlias(payload, aliases)); });

  const extraStrings = {
    linkedPropertyId: ["linkedPropertyId", "propertyId"], propertyId: ["propertyId", "linkedPropertyId"], parcelNumber: ["parcelNumber"], mapUrl: ["mapUrl"],
    updatedByModule: ["updatedByModule"], riskLevel: ["riskLevel"], recommendation: ["recommendation"], source: ["source"],
  };
  Object.entries(extraStrings).forEach(([field, aliases]) => { normalized[field] = stringValue(meaningfulAlias(payload, aliases)); });
  normalized.riskLevel ||= "Low";
  normalized.recommendation ||= "Ready for Analysis";
  normalized.source ||= "web";
  normalized.pipelineStage ||= "New Lead";
  normalized.status ||= "Lead";
  normalized.workflowTransitionHistory = Array.isArray(payload.workflowTransitionHistory) ? payload.workflowTransitionHistory : [];
  return normalized;
}

export function mergeDealRoundTripUpdate(existing = {}, normalized = {}, rawPayload = {}) {
  const merged = { ...existing };
  DEAL_INTAKE_FIELD_CONTRACT.forEach((entry) => {
    if (hasAlias(rawPayload, entry.aliases)) merged[entry.persistedField] = normalized[entry.persistedField];
  });
  const alwaysMerge = ["financials", "rawFinancingCostInput", "calculatedFinancingCosts", "effectiveFinancingCosts", "financingCostSource", "linkedPropertyId", "propertyId", "parcelNumber", "mapUrl", "updatedByModule", "overallRisk", "riskLevel", "recommendation", "warningCount", "confidenceScore", "source", "workflowTransitionHistory"];
  alwaysMerge.forEach((field) => {
    if (Object.prototype.hasOwnProperty.call(rawPayload, field) || (field.startsWith("financing") && rawPayload.financials)) merged[field] = normalized[field];
  });
  // Additional canonical fields are presence-aware as well.
  Object.keys(normalized).forEach((field) => {
    if (Object.prototype.hasOwnProperty.call(rawPayload, field)) merged[field] = normalized[field];
  });
  return merged;
}
