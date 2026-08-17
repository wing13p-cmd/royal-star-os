import { resolveDealStatusValue } from "../utils/dealWorkflowRegistry.js";
import { normalizeCanonicalProperty } from "./propertyAutomationEngine.js";

const REQUIRED_FIELDS = {
  address: "Address is required.",
  city: "City is required.",
  state: "State is required.",
  zip: "ZIP is required.",
};

const NUMERIC_FIELDS = {
  bedrooms: "Bedrooms",
  bathrooms: "Bathrooms",
  squareFeet: "Square Feet",
  yearBuilt: "Year Built",
  askingPrice: "Asking Price",
  purchasePrice: "Purchase Price",
  rehabBudget: "Rehab Budget",
  arv: "ARV",
  estimatedRent: "Estimated Rent",
  taxes: "Taxes",
  insurance: "Insurance",
  financingCosts: "Financing Costs",
  closingCosts: "Closing Costs",
  actualLoanAmount: "Actual Loan Amount",
  annualInterestRate: "Annual Interest Rate",
  cashToClose: "Cash to Close",
  earnestMoney: "Earnest Money",
  totalInitialCashInvested: "Total Initial Cash Invested",
  constructionHoldback: "Construction Holdback",
  originationFee: "Origination Fee",
  underwritingFee: "Underwriting Fee",
  servicingFee: "Servicing Fee",
  lenderLegalFee: "Lender Legal Fee",
  monitoringFee: "Monitoring Fee",
  otherLenderFees: "Other Lender Fees",
  fundedRehab: "Funded Rehab",
  holdingMonths: "Holding Months",
  holdingCosts: "Total Holding Costs",
};

export function toNumberOrBlank(value) {
  if (value === "" || value === null || value === undefined) return "";
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : "";
}

export function hydrateDealIntakeFormData(deal = {}, financingCostState = {}) {
  const canonical = normalizeCanonicalProperty(deal);
  return {
    address: canonical.address,
    city: canonical.city,
    state: canonical.state,
    zip: canonical.zip,
    propertyType: canonical.propertyType,
    bedrooms: deal.bedrooms ?? "",
    bathrooms: deal.bathrooms ?? "",
    squareFeet: deal.squareFeet ?? "",
    yearBuilt: deal.yearBuilt ?? "",
    askingPrice: canonical.askingPrice ?? "",
    purchasePrice: canonical.purchasePrice ?? "",
    rehabBudget: canonical.rehabBudget ?? "",
    arv: canonical.arv ?? "",
    estimatedRent: canonical.monthlyRent ?? "",
    taxes: canonical.annualPropertyTaxes ?? "",
    insurance: canonical.annualInsurance ?? "",
    financingCosts: financingCostState.rawFinancingCostInput ?? deal.financingCosts ?? "",
    closingCosts: canonical.closingCosts ?? "",
    actualLoanAmount: canonical.actualLoanAmount ?? "",
    annualInterestRate: canonical.interestRate ?? "",
    cashToClose: canonical.cashToClose ?? "",
    earnestMoney: canonical.earnestMoney ?? "",
    totalInitialCashInvested: canonical.initialCashInvested ?? "",
    constructionHoldback: canonical.constructionHoldback ?? "",
    originationFee: canonical.originationFee ?? "",
    underwritingFee: canonical.underwritingFee ?? "",
    servicingFee: canonical.servicingFee ?? "",
    lenderLegalFee: canonical.lenderLegalFee ?? "",
    monitoringFee: canonical.monitoringFee ?? "",
    otherLenderFees: canonical.otherLenderFees ?? "",
    fundedRehab: canonical.fundedRehab ?? "",
    paymentType: canonical.paymentType,
    holdingMonths: canonical.holdingMonths ?? "",
    holdingCosts: canonical.holdingCosts ?? "",
    monthlyHoldingCost: deal.monthlyHoldingCost ?? "",
    leadSource: canonical.leadSource,
    exitStrategy: canonical.strategy,
    status: resolveDealStatusValue(deal.status || "Lead"),
    pipelineStage: deal.pipelineStage || "New Lead",
    notes: deal.notes || "",
  };
}

export function validateDealIntakeFormData(formData = {}) {
  const fieldErrors = {};

  Object.entries(REQUIRED_FIELDS).forEach(([field, message]) => {
    if (!String(formData[field] || "").trim()) {
      fieldErrors[field] = message;
    }
  });

  Object.entries(NUMERIC_FIELDS).forEach(([field, label]) => {
    const value = formData[field];
    if (value === "" || value === null || value === undefined) return;
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
      fieldErrors[field] = `${label} must be a valid number.`;
    } else if (field === "holdingCosts" && parsed < 0) {
      fieldErrors[field] = "Total Holding Costs cannot be negative.";
    }
  });

  const firstInvalidField = Object.keys(fieldErrors)[0] || "";
  return {
    isValid: firstInvalidField.length === 0,
    fieldErrors,
    firstInvalidField,
  };
}
