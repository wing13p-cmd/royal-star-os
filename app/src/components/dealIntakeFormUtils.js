import { resolveDealStatusValue } from "../utils/dealWorkflowRegistry.js";

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
};

export function toNumberOrBlank(value) {
  if (value === "" || value === null || value === undefined) return "";
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : "";
}

export function hydrateDealIntakeFormData(deal = {}, financingCostState = {}) {
  return {
    address: deal.propertyAddress || deal.address || "",
    city: deal.city || "",
    state: deal.state || "",
    zip: deal.zipCode || deal.zip || "",
    propertyType: deal.propertyType || "",
    bedrooms: deal.bedrooms ?? "",
    bathrooms: deal.bathrooms ?? "",
    squareFeet: deal.squareFeet ?? "",
    yearBuilt: deal.yearBuilt ?? "",
    askingPrice: deal.askingPrice ?? "",
    purchasePrice: deal.purchasePrice ?? "",
    rehabBudget: deal.rehabBudget ?? "",
    arv: deal.estimatedArv ?? deal.arv ?? "",
    estimatedRent: deal.estimatedRent ?? "",
    taxes: deal.taxes ?? "",
    insurance: deal.insurance ?? "",
    financingCosts: financingCostState.rawFinancingCostInput ?? deal.financingCosts ?? "",
    closingCosts: deal.closingCosts ?? "",
    actualLoanAmount: deal.actualLoanAmount ?? deal.loanAmount ?? "",
    annualInterestRate: deal.annualInterestRate ?? deal.interestRate ?? "",
    cashToClose: deal.cashToClose ?? "",
    earnestMoney: deal.earnestMoney ?? "",
    totalInitialCashInvested: deal.totalInitialCashInvested ?? deal.initialCashInvested ?? "",
    constructionHoldback: deal.constructionHoldback ?? "",
    originationFee: deal.originationFee ?? "",
    underwritingFee: deal.underwritingFee ?? "",
    servicingFee: deal.servicingFee ?? "",
    lenderLegalFee: deal.lenderLegalFee ?? "",
    monitoringFee: deal.monitoringFee ?? "",
    otherLenderFees: deal.otherLenderFees ?? "",
    fundedRehab: deal.fundedRehab ?? deal.rehabFunding ?? "",
    paymentType: deal.paymentType ?? "",
    holdingMonths: deal.holdingMonths ?? "",
    leadSource: deal.leadSource || "",
    exitStrategy: deal.exitStrategy || deal.strategy || "",
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
    }
  });

  const firstInvalidField = Object.keys(fieldErrors)[0] || "";
  return {
    isValid: firstInvalidField.length === 0,
    fieldErrors,
    firstInvalidField,
  };
}
