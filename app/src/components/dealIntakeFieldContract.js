function numeric(value) {
  if (value === "" || value === null || value === undefined) return "";
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : "";
}

export const DEAL_INTAKE_FIELD_CONTRACT = Object.freeze([
  ["address", "address", "propertyAddress", "propertyAddress", ["propertyAddress", "address", "streetAddress"]],
  ["city", "city", "city", "city", ["city"]], ["state", "state", "state", "state", ["state"]],
  ["zip", "zip", "zipCode", "zipCode", ["zipCode", "zip", "postalCode"]],
  ["propertyType", "propertyType", "propertyType", "propertyType", ["propertyType", "type"]],
  ["bedrooms", "bedrooms", "bedrooms", "bedrooms", ["bedrooms"], "number"],
  ["bathrooms", "bathrooms", "bathrooms", "bathrooms", ["bathrooms"], "number"],
  ["squareFeet", "squareFeet", "squareFeet", "squareFeet", ["squareFeet", "sqft"], "number"],
  ["yearBuilt", "yearBuilt", "yearBuilt", "yearBuilt", ["yearBuilt"], "number"],
  ["askingPrice", "askingPrice", "askingPrice", "askingPrice", ["askingPrice", "listPrice"], "number"],
  ["purchasePrice", "purchasePrice", "purchasePrice", "purchasePrice", ["purchasePrice"], "number"],
  ["rehabBudget", "rehabBudget", "rehabBudget", "rehabBudget", ["rehabBudget", "repairBudget", "renovationBudget"], "number"],
  ["arv", "arv", "estimatedArv", "estimatedArv", ["estimatedArv", "arv", "projectedARV", "supportedARV"], "number"],
  ["estimatedRent", "monthlyRent", "estimatedRent", "estimatedRent", ["estimatedRent", "monthlyRent", "marketRent"], "number"],
  ["taxes", "annualPropertyTaxes", "taxes", "taxes", ["taxes", "annualPropertyTaxes", "annualTaxes"], "number"],
  ["insurance", "annualInsurance", "insurance", "insurance", ["insurance", "annualInsurance"], "number"],
  ["financingCosts", "financingCosts", "financingCosts", "financingCosts", ["financingCosts", "financingCost", "totalFinancingCosts"], "number"],
  ["closingCosts", "closingCosts", "closingCosts", "closingCosts", ["closingCosts", "closingCost"], "number"],
  ["actualLoanAmount", "actualLoanAmount", "actualLoanAmount", "actualLoanAmount", ["actualLoanAmount", "actualLoan", "loanAmount", "fundingAmount"], "number"],
  ["annualInterestRate", "interestRate", "annualInterestRate", "annualInterestRate", ["annualInterestRate", "interestRate", "rate"], "number"],
  ["cashToClose", "cashToClose", "cashToClose", "cashToClose", ["cashToClose", "cashToCloseAmount"], "number"],
  ["earnestMoney", "earnestMoney", "earnestMoney", "earnestMoney", ["earnestMoney"], "number"],
  ["totalInitialCashInvested", "initialCashInvested", "totalInitialCashInvested", "totalInitialCashInvested", ["totalInitialCashInvested", "initialCashInvested", "cashInvested"], "number"],
  ["constructionHoldback", "constructionHoldback", "constructionHoldback", "constructionHoldback", ["constructionHoldback", "holdbackAmount", "constructionHoldbackAmount"], "number"],
  ["originationFee", "originationFee", "originationFee", "originationFee", ["originationFee", "originationFees"], "number"],
  ["underwritingFee", "underwritingFee", "underwritingFee", "underwritingFee", ["underwritingFee"], "number"],
  ["servicingFee", "servicingFee", "servicingFee", "servicingFee", ["servicingFee"], "number"],
  ["lenderLegalFee", "lenderLegalFee", "lenderLegalFee", "lenderLegalFee", ["lenderLegalFee", "legalFee"], "number"],
  ["monitoringFee", "monitoringFee", "monitoringFee", "monitoringFee", ["monitoringFee"], "number"],
  ["otherLenderFees", "otherLenderFees", "otherLenderFees", "otherLenderFees", ["otherLenderFees", "otherFees"], "number"],
  ["fundedRehab", "fundedRehab", "fundedRehab", "fundedRehab", ["fundedRehab", "rehabFunding", "rehabLoan"], "number"],
  ["paymentType", "paymentType", "paymentType", "paymentType", ["paymentType", "loanPaymentType", "debtPaymentType"]],
  ["holdingMonths", "holdingMonths", "holdingMonths", "holdingMonths", ["holdingMonths"], "number"],
  ["holdingCosts", "holdingCosts", "holdingCosts", "holdingCosts", ["holdingCosts", "totalHoldingCosts", "holdingCost"], "number"],
  ["monthlyHoldingCost", "monthlyHoldingCost", "monthlyHoldingCost", "monthlyHoldingCost", ["monthlyHoldingCost"], "number"],
  ["leadSource", "leadSource", "leadSource", "leadSource", ["leadSource"]],
  ["exitStrategy", "strategy", "strategy", "strategy", ["strategy", "exitStrategy"]],
  ["status", "status", "status", "status", ["status", "propertyStatus"]],
  ["pipelineStage", "pipelineStage", "pipelineStage", "pipelineStage", ["pipelineStage"]],
  ["notes", "notes", "notes", "notes", ["notes"]],
].map(([formField, canonicalField, payloadField, persistedField, aliases, type = "text"]) => ({ formField, canonicalField, payloadField, backendField: persistedField, persistedField, getField: persistedField, hydrationField: formField, aliases, type })));

export function buildDealIntakePayload(formData = {}, currentDeal = null) {
  const payload = {};
  DEAL_INTAKE_FIELD_CONTRACT.forEach((entry) => {
    const value = formData[entry.formField];
    payload[entry.payloadField] = entry.type === "number" ? numeric(value) : (value ?? "");
  });
  payload.exitStrategy = formData.exitStrategy ?? "";
  payload.financials = {
    rawFinancingCostInput: payload.financingCosts === "" ? 0 : payload.financingCosts,
    calculatedFinancingCosts: 0,
    effectiveFinancingCosts: payload.financingCosts === "" ? 0 : payload.financingCosts,
    financingCostSource: payload.financingCosts === "" ? "calculated" : "manual-override",
  };
  payload.linkedPropertyId = currentDeal?.linkedPropertyId || currentDeal?.propertyId || "";
  payload.propertyId = currentDeal?.propertyId || currentDeal?.linkedPropertyId || "";
  payload.parcelNumber = currentDeal?.parcelNumber || "";
  payload.mapUrl = currentDeal?.mapUrl || "";
  payload.updatedByModule = "Deal Intake";
  return payload;
}
