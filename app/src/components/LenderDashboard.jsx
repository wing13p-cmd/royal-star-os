import { useEffect, useMemo, useState } from "react";
import { buildApiUrl } from "../utils/apiClient.js";
import logo from "../assets/royal-star-logo.png";

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
  ["🗂️", "PROPERTY DATABASE"],
  ["🗃️", "VENDOR DATABASE"],
  ["▪", "MATERIAL MATRIX"],
  ["➕", "ADD NEW DEAL"],
];

const lenderTypeOptions = [
  "Hard Money Lender",
  "Private Lender",
  "Bank",
  "Credit Union",
  "DSCR Lender",
  "Bridge Lender",
  "Construction Lender",
  "Portfolio Lender",
  "Commercial Lender",
  "Other",
];

const loanPurposeOptions = [
  "Purchase",
  "Purchase and Rehab",
  "Refinance",
  "Cash-Out Refinance",
  "Bridge",
  "Construction",
  "Rental",
  "Portfolio",
  "Commercial",
  "Other",
];

const rateTypeOptions = ["Fixed", "Variable", "Interest Only", "Prime Plus", "SOFR Plus", "Custom"];
const recourseTypeOptions = ["Full Recourse", "Limited Recourse", "Non-Recourse", "Unknown"];
const drawScheduleOptions = ["Reimbursement", "Advance", "Milestone", "Monthly", "Custom", "Not Applicable"];
const approvalStatusOptions = ["Approved", "Preferred", "Conditional", "Under Review", "Not Approved"];
const activeStatusOptions = ["Active", "Inactive", "Suspended"];
const yesNoOptions = ["", "Yes", "No"];
const sortOptions = [
  ["name", "Lender Name"],
  ["interest", "Lowest Interest Rate"],
  ["points", "Lowest Points"],
  ["cost", "Lowest Estimated Cost"],
  ["score", "Highest Overall Score"],
  ["draw", "Fastest Draw"],
  ["capacity", "Highest Remaining Capacity"],
  ["newest", "Newest"],
  ["oldest", "Oldest"],
  ["loan", "Most Recent Loan"],
];

const initialValues = {
  id: "",
  lenderName: "",
  lenderType: "Hard Money Lender",
  contactName: "",
  contactTitle: "",
  phone: "",
  email: "",
  website: "",
  portalUrl: "",
  sourceUrl: "",
  address: "",
  city: "",
  state: "",
  zipCode: "",
  loanProgramName: "",
  loanPurpose: "Purchase",
  propertyTypesAllowed: "",
  statesAllowed: "",
  minimumLoanAmount: "",
  maximumLoanAmount: "",
  maximumPurchaseLTV: "",
  maximumARVLTV: "",
  maximumLTC: "",
  interestRate: "",
  rateType: "Fixed",
  originationPoints: "",
  underwritingFee: "",
  processingFee: "",
  appraisalFee: "",
  legalFee: "",
  drawFee: "",
  extensionFee: "",
  minimumInterestMonths: "",
  loanTermMonths: "",
  extensionOptions: "",
  interestOnly: "",
  recourseType: "Unknown",
  personalGuaranteeRequired: "",
  prepaymentPenalty: "",
  rehabFinancingAvailable: "",
  rehabAdvancePercentage: "",
  drawScheduleType: "Reimbursement",
  drawTurnaroundDays: "",
  appraisalRequired: "",
  creditScoreMinimum: "",
  liquidityRequirement: "",
  experienceRequirement: "",
  entityRequired: "",
  insuranceRequirements: "",
  titleRequirements: "",
  seasoningRequirementMonths: "",
  refinanceAvailable: "",
  refinanceMaximumLTV: "",
  DSCRMinimum: "",
  minimumOccupancy: "",
  termSheetDate: "",
  termSheetExpiration: "",
  approvalStatus: "Under Review",
  activeStatus: "Active",
  preferredLender: "",
  reliabilityScore: "",
  speedScore: "",
  pricingScore: "",
  communicationScore: "",
  flexibilityScore: "",
  overallScore: "",
  totalLoans: "",
  activeLoans: "",
  totalOriginalBalance: "",
  totalCurrentBalance: "",
  totalInterestPaid: "",
  totalFeesPaid: "",
  lastLoanDate: "",
  lastContactDate: "",
  favorite: false,
  notes: "",
  createdAt: "",
  updatedAt: "",
};

function getStringValue(source, fallback = "") {
  const value = source ?? fallback;
  return typeof value === "string" ? value : "";
}

function parseNumber(value) {
  if (value === "" || value === null || value === undefined) return "";
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : "";
}

function formatCurrency(value) {
  if (value === "" || value === null || value === undefined || !Number.isFinite(Number(value))) return "Insufficient Data";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(Number(value));
}

function formatPercent(value) {
  if (value === "" || value === null || value === undefined || !Number.isFinite(Number(value))) return "Insufficient Data";
  return `${Number(value).toFixed(1)}%`;
}

function normalizeLenderPayload(values) {
  return {
    id: getStringValue(values.id),
    lenderName: getStringValue(values.lenderName),
    lenderType: getStringValue(values.lenderType),
    contactName: getStringValue(values.contactName),
    contactTitle: getStringValue(values.contactTitle),
    phone: getStringValue(values.phone),
    email: getStringValue(values.email),
    website: getStringValue(values.website),
    portalUrl: getStringValue(values.portalUrl),
    sourceUrl: getStringValue(values.sourceUrl),
    address: getStringValue(values.address),
    city: getStringValue(values.city),
    state: getStringValue(values.state),
    zipCode: getStringValue(values.zipCode),
    loanProgramName: getStringValue(values.loanProgramName),
    loanPurpose: getStringValue(values.loanPurpose),
    propertyTypesAllowed: getStringValue(values.propertyTypesAllowed),
    statesAllowed: getStringValue(values.statesAllowed),
    minimumLoanAmount: parseNumber(values.minimumLoanAmount),
    maximumLoanAmount: parseNumber(values.maximumLoanAmount),
    maximumPurchaseLTV: parseNumber(values.maximumPurchaseLTV),
    maximumARVLTV: parseNumber(values.maximumARVLTV),
    maximumLTC: parseNumber(values.maximumLTC),
    interestRate: parseNumber(values.interestRate),
    rateType: getStringValue(values.rateType),
    originationPoints: parseNumber(values.originationPoints),
    underwritingFee: parseNumber(values.underwritingFee),
    processingFee: parseNumber(values.processingFee),
    appraisalFee: parseNumber(values.appraisalFee),
    legalFee: parseNumber(values.legalFee),
    drawFee: parseNumber(values.drawFee),
    extensionFee: parseNumber(values.extensionFee),
    minimumInterestMonths: parseNumber(values.minimumInterestMonths),
    loanTermMonths: parseNumber(values.loanTermMonths),
    extensionOptions: getStringValue(values.extensionOptions),
    interestOnly: getStringValue(values.interestOnly),
    recourseType: getStringValue(values.recourseType),
    personalGuaranteeRequired: getStringValue(values.personalGuaranteeRequired),
    prepaymentPenalty: getStringValue(values.prepaymentPenalty),
    rehabFinancingAvailable: getStringValue(values.rehabFinancingAvailable),
    rehabAdvancePercentage: parseNumber(values.rehabAdvancePercentage),
    drawScheduleType: getStringValue(values.drawScheduleType),
    drawTurnaroundDays: parseNumber(values.drawTurnaroundDays),
    appraisalRequired: getStringValue(values.appraisalRequired),
    creditScoreMinimum: parseNumber(values.creditScoreMinimum),
    liquidityRequirement: parseNumber(values.liquidityRequirement),
    experienceRequirement: parseNumber(values.experienceRequirement),
    entityRequired: getStringValue(values.entityRequired),
    insuranceRequirements: getStringValue(values.insuranceRequirements),
    titleRequirements: getStringValue(values.titleRequirements),
    seasoningRequirementMonths: parseNumber(values.seasoningRequirementMonths),
    refinanceAvailable: getStringValue(values.refinanceAvailable),
    refinanceMaximumLTV: parseNumber(values.refinanceMaximumLTV),
    DSCRMinimum: parseNumber(values.DSCRMinimum),
    minimumOccupancy: parseNumber(values.minimumOccupancy),
    termSheetDate: getStringValue(values.termSheetDate),
    termSheetExpiration: getStringValue(values.termSheetExpiration),
    approvalStatus: getStringValue(values.approvalStatus),
    activeStatus: getStringValue(values.activeStatus),
    preferredLender: getStringValue(values.preferredLender),
    reliabilityScore: parseNumber(values.reliabilityScore),
    speedScore: parseNumber(values.speedScore),
    pricingScore: parseNumber(values.pricingScore),
    communicationScore: parseNumber(values.communicationScore),
    flexibilityScore: parseNumber(values.flexibilityScore),
    overallScore: parseNumber(values.overallScore),
    totalLoans: parseNumber(values.totalLoans),
    activeLoans: parseNumber(values.activeLoans),
    totalOriginalBalance: parseNumber(values.totalOriginalBalance),
    totalCurrentBalance: parseNumber(values.totalCurrentBalance),
    totalInterestPaid: parseNumber(values.totalInterestPaid),
    totalFeesPaid: parseNumber(values.totalFeesPaid),
    lastLoanDate: getStringValue(values.lastLoanDate),
    lastContactDate: getStringValue(values.lastContactDate),
    favorite: Boolean(values.favorite),
    notes: getStringValue(values.notes),
    createdAt: getStringValue(values.createdAt),
    updatedAt: getStringValue(values.updatedAt),
  };
}

function validateLender(values) {
  const errors = [];
  if (!values.lenderName?.trim()) errors.push("Lender name is required.");
  if (!values.lenderType?.trim()) errors.push("Lender type is required.");
  if (!values.loanProgramName?.trim()) errors.push("Loan program name is required.");
  if (!values.approvalStatus?.trim()) errors.push("Approval status is required.");
  if (!values.activeStatus?.trim()) errors.push("Active status is required.");

  const numericChecks = [
    ["minimumLoanAmount", 0, null],
    ["maximumLoanAmount", 0, null],
    ["maximumPurchaseLTV", 0, 100],
    ["maximumARVLTV", 0, 100],
    ["maximumLTC", 0, 100],
    ["interestRate", 0, 100],
    ["originationPoints", 0, 100],
    ["underwritingFee", 0, null],
    ["processingFee", 0, null],
    ["appraisalFee", 0, null],
    ["legalFee", 0, null],
    ["drawFee", 0, null],
    ["extensionFee", 0, null],
    ["minimumInterestMonths", 0, null],
    ["loanTermMonths", 0, null],
    ["rehabAdvancePercentage", 0, 100],
    ["drawTurnaroundDays", 0, null],
    ["creditScoreMinimum", 300, 850],
    ["liquidityRequirement", 0, null],
    ["experienceRequirement", 0, null],
    ["seasoningRequirementMonths", 0, null],
    ["refinanceMaximumLTV", 0, 100],
    ["DSCRMinimum", 0, null],
    ["minimumOccupancy", 0, 100],
    ["reliabilityScore", 0, 10],
    ["speedScore", 0, 10],
    ["pricingScore", 0, 10],
    ["communicationScore", 0, 10],
    ["flexibilityScore", 0, 10],
    ["overallScore", 0, 10],
  ];

  numericChecks.forEach(([field, min, max]) => {
    const value = values[field];
    if (value === "" || value === null || value === undefined) return;
    const numericValue = Number(value);
    if (!Number.isFinite(numericValue)) {
      errors.push(`${field} must be numeric.`);
      return;
    }
    if (min !== null && numericValue < min) errors.push(`${field} cannot be negative.`);
    if (max !== null && numericValue > max) errors.push(`${field} cannot exceed ${max}.`);
  });

  return errors;
}

function getOverallScore(lender) {
  const scoreFields = [
    ["pricingScore", 0.25],
    ["reliabilityScore", 0.2],
    ["speedScore", 0.2],
    ["communicationScore", 0.15],
    ["flexibilityScore", 0.2],
  ];

  const available = scoreFields.filter(([field]) => lender[field] !== "" && lender[field] !== null && lender[field] !== undefined);
  if (available.length === 0) return "Insufficient Data";
  const totalWeight = available.reduce((sum, [, weight]) => sum + weight, 0);
  const weighted = available.reduce((sum, [field, weight]) => sum + Number(lender[field]) * (weight / totalWeight), 0);
  return Number(weighted).toFixed(1);
}

function getRiskWarnings(lender, averageInterestRate, averagePoints) {
  const warnings = [];
  const rateValue = Number(lender.interestRate);
  const pointsValue = Number(lender.originationPoints);
  const loanBalance = Number(lender.totalCurrentBalance || 0);

  if (lender.activeStatus === "Inactive") warnings.push("Lender inactive");
  if (lender.activeStatus === "Suspended") warnings.push("Lender suspended");
  if (lender.termSheetExpiration && new Date(lender.termSheetExpiration) < new Date()) warnings.push("Expired term sheet");
  if (lender.termSheetExpiration) {
    const daysUntil = Math.ceil((new Date(lender.termSheetExpiration).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
    if (daysUntil >= 0 && daysUntil <= 15) warnings.push("Term sheet expires within 15 days");
  }
  if (Number(lender.overallScore) < 6) warnings.push("Overall score below 6");
  if (Number(lender.reliabilityScore) < 6) warnings.push("Reliability score below 6");
  if (Number(lender.speedScore) < 6) warnings.push("Speed score below 6");
  if (Number(lender.communicationScore) < 6) warnings.push("Communication score below 6");
  if (Number(lender.drawTurnaroundDays) > 10) warnings.push("Draw turnaround over 10 days");
  if (Number.isFinite(rateValue) && Number.isFinite(averageInterestRate) && averageInterestRate > 0 && rateValue > averageInterestRate * 1.1) warnings.push("Interest rate materially above stored lender average");
  if (Number.isFinite(pointsValue) && Number.isFinite(averagePoints) && averagePoints > 0 && pointsValue > averagePoints * 1.1) warnings.push("Origination points materially above stored lender average");
  if (Number(lender.underwritingFee) + Number(lender.processingFee) + Number(lender.appraisalFee) + Number(lender.legalFee) + Number(lender.drawFee) > 10000) warnings.push("High fixed fees");
  if (lender.recourseType === "Full Recourse") warnings.push("Full recourse");
  if (lender.personalGuaranteeRequired === "Yes") warnings.push("Personal guarantee required");
  if (lender.prepaymentPenalty === "Yes") warnings.push("Prepayment penalty");
  if (Number(lender.minimumInterestMonths) > 0) warnings.push("Minimum interest period");
  if (!lender.phone) warnings.push("Missing phone");
  if (!lender.email) warnings.push("Missing email");
  if (!lender.contactName) warnings.push("Missing contact name");
  if (!lender.maximumLoanAmount || !lender.maximumPurchaseLTV || !lender.maximumARVLTV || !lender.maximumLTC) warnings.push("Missing leverage limits");
  if (!lender.website) warnings.push("Missing website");
  if (!lender.portalUrl) warnings.push("Missing portal URL");
  if (lender.updatedAt) {
    const updated = new Date(lender.updatedAt);
    const staleCutoff = new Date();
    staleCutoff.setDate(staleCutoff.getDate() - 90);
    if (updated < staleCutoff) warnings.push("Record not updated within 90 days");
  }
  if (!lender.updatedAt) warnings.push("Record not updated within 90 days");
  if (Number.isFinite(loanBalance) && loanBalance > 0 && !lender.totalCurrentBalance) warnings.push("Missing current balance");
  return warnings;
}

function getRecommendation(lender, warnings) {
  const score = Number(lender.overallScore);
  const active = lender.activeStatus === "Active";
  const approved = lender.approvalStatus === "Approved" || lender.approvalStatus === "Preferred";
  const fast = Number(lender.speedScore) >= 7;
  const pricing = Number(lender.pricingScore) >= 7;
  const reliable = Number(lender.reliabilityScore) >= 7;
  const critical = warnings.includes("Lender suspended") || warnings.includes("Expired term sheet") || warnings.includes("Record not updated within 90 days") && warnings.length > 6;

  if (critical || warnings.some((warning) => warning.includes("Critical"))) return { label: "Replace", explanation: "The lender presents repeated risk or critical due diligence concerns, so replacement is advised." };
  if (warnings.some((warning) => warning.includes("Lender inactive") || warning.includes("Lender suspended") || warning.includes("Expired term sheet"))) return { label: "Avoid", explanation: "The lender is inactive, suspended, or has an expired term sheet, making execution risky." };
  if (warnings.length > 4 || score < 6 || !active) return { label: "Review", explanation: "The lender has mixed data quality or several monitoring issues that need review before use." };
  if (approved && active && fast && pricing && reliable && score >= 8) return { label: "Preferred", explanation: "The lender has strong overall scoring, competitive pricing, reliable draw speed, and active approval status." };
  if (approved && active) return { label: "Approved", explanation: "The lender offers acceptable terms and execution quality for general use." };
  if (warnings.length > 0) return { label: "Conditional", explanation: "The lender is usable, but restrictions or missing information require tighter underwriting." };
  return { label: "Review", explanation: "The lender has incomplete information or mixed performance indicators that warrant review." };
}

function getRiskLevel(warnings) {
  if (warnings.some((warning) => warning.includes("Lender suspended") || warning.includes("Expired term sheet") || warning.includes("Critical"))) return "Critical";
  if (warnings.some((warning) => warning.includes("Lender inactive") || warning.includes("Full recourse") || warning.includes("Personal guarantee required") || warning.includes("Prepayment penalty"))) return "High";
  if (warnings.length > 3) return "Moderate";
  return "Low";
}

function calculateQuote(lender, quoteValues, averageInterestRate, averagePoints) {
  const loanAmount = Number(quoteValues.loanAmount || 0);
  const purchasePrice = Number(quoteValues.purchasePrice || 0);
  const rehabBudget = Number(quoteValues.rehabBudget || 0);
  const arv = Number(quoteValues.arv || 0);
  const interestRate = Number(lender.interestRate || 0);
  const originationPoints = Number(lender.originationPoints || 0);
  const underwritingFee = Number(lender.underwritingFee || 0);
  const processingFee = Number(lender.processingFee || 0);
  const appraisalFee = Number(lender.appraisalFee || 0);
  const legalFee = Number(lender.legalFee || 0);
  const drawFee = Number(lender.drawFee || 0);
  const extensionFee = Number(lender.extensionFee || 0);
  const drawCount = Number(quoteValues.expectedDrawCount || 0);
  const extensionMonths = Number(quoteValues.extensionMonths || 0);
  const loanTermMonths = Number(lender.loanTermMonths || 0);
  const minimumInterestMonths = Number(lender.minimumInterestMonths || 0);
  const interestMonths = Math.max(loanTermMonths, minimumInterestMonths);
  const estimatedMonthlyInterest = purchasePrice > 0 && loanAmount > 0 ? (loanAmount * interestRate) / 100 / 12 : "";
  const estimatedTotalInterest = Number.isFinite(estimatedMonthlyInterest) && Number.isFinite(interestMonths) ? estimatedMonthlyInterest * interestMonths : "";
  const originationFee = loanAmount > 0 ? (loanAmount * originationPoints) / 100 : "";
  const estimatedDrawFees = drawFee * drawCount;
  const estimatedExtensionCost = extensionFee * extensionMonths;
  const estimatedTotalFinancingCost = [originationFee, underwritingFee, processingFee, appraisalFee, legalFee, estimatedDrawFees, estimatedExtensionCost, estimatedTotalInterest].reduce((sum, value) => sum + (Number.isFinite(Number(value)) ? Number(value) : 0), 0);
  const estimatedCashRequired = purchasePrice + rehabBudget + estimatedTotalFinancingCost - loanAmount;

  const purchaseLtv = purchasePrice > 0 ? (loanAmount / purchasePrice) * 100 : "";
  const arvLtv = arv > 0 ? (loanAmount / arv) * 100 : "";
  const ltc = purchasePrice + rehabBudget > 0 ? (loanAmount / (purchasePrice + rehabBudget)) * 100 : "";
  const annualRent = Number(quoteValues.expectedMonthlyRent || 0) * 12;
  const annualDebtService = Number(quoteValues.annualDebtService || 0);
  const dscr = annualDebtService > 0 ? annualRent / annualDebtService : "";

  const qualificationParts = [];
  const failedRequirements = [];

  if (lender.minimumLoanAmount !== "" && loanAmount < Number(lender.minimumLoanAmount)) failedRequirements.push(`Below minimum loan amount of ${formatCurrency(lender.minimumLoanAmount)}`);
  if (lender.maximumLoanAmount !== "" && loanAmount > Number(lender.maximumLoanAmount)) failedRequirements.push(`Above maximum loan amount of ${formatCurrency(lender.maximumLoanAmount)}`);
  if (lender.maximumPurchaseLTV !== "" && Number.isFinite(purchaseLtv) && purchaseLtv > Number(lender.maximumPurchaseLTV)) failedRequirements.push(`Purchase LTV exceeds ${formatPercent(lender.maximumPurchaseLTV)}`);
  if (lender.maximumARVLTV !== "" && Number.isFinite(arvLtv) && arvLtv > Number(lender.maximumARVLTV)) failedRequirements.push(`ARV LTV exceeds ${formatPercent(lender.maximumARVLTV)}`);
  if (lender.maximumLTC !== "" && Number.isFinite(ltc) && ltc > Number(lender.maximumLTC)) failedRequirements.push(`LTC exceeds ${formatPercent(lender.maximumLTC)}`);
  if (lender.creditScoreMinimum !== "" && Number(quoteValues.creditScore) < Number(lender.creditScoreMinimum)) failedRequirements.push(`Credit score below ${lender.creditScoreMinimum}`);
  if (lender.liquidityRequirement !== "" && Number(quoteValues.liquidity) < Number(lender.liquidityRequirement)) failedRequirements.push(`Liquidity below ${formatCurrency(lender.liquidityRequirement)}`);
  if (lender.experienceRequirement !== "" && Number(quoteValues.experienceCount) < Number(lender.experienceRequirement)) failedRequirements.push(`Experience below ${lender.experienceRequirement}`);
  if (lender.propertyTypesAllowed && quoteValues.propertyType && !String(lender.propertyTypesAllowed).toLowerCase().includes(String(quoteValues.propertyType).toLowerCase())) failedRequirements.push("Property type is not allowed");
  if (lender.statesAllowed && quoteValues.state && !String(lender.statesAllowed).toLowerCase().includes(String(quoteValues.state).toLowerCase())) failedRequirements.push("State is not allowed");
  if (lender.DSCRMinimum !== "" && Number.isFinite(dscr) && dscr < Number(lender.DSCRMinimum)) failedRequirements.push(`DSCR below ${lender.DSCRMinimum}`);
  if (lender.minimumOccupancy !== "" && Number(quoteValues.minimumOccupancy) < Number(lender.minimumOccupancy)) failedRequirements.push(`Occupancy below ${lender.minimumOccupancy}%`);
  if (lender.seasoningRequirementMonths !== "" && Number(quoteValues.seasoningMonths || 0) < Number(lender.seasoningRequirementMonths)) failedRequirements.push(`Seasoning below ${lender.seasoningRequirementMonths} months`);

  if (!quoteValues.loanAmount || !quoteValues.purchasePrice || !quoteValues.arv || !quoteValues.rehabBudget) qualificationParts.push("Insufficient Data");
  else if (failedRequirements.length === 0) qualificationParts.push("Likely Eligible");
  else if (failedRequirements.length <= 2) qualificationParts.push("Conditional");
  else qualificationParts.push("Unlikely Eligible");

  const assumptions = [];
  if (lender.maximumLoanAmount === "" || lender.maximumLoanAmount === null) assumptions.push("Maximum loan amount not provided");
  if (lender.maximumPurchaseLTV === "" || lender.maximumPurchaseLTV === null) assumptions.push("Maximum purchase LTV not provided");
  if (lender.maximumARVLTV === "" || lender.maximumARVLTV === null) assumptions.push("Maximum ARV LTV not provided");
  if (lender.maximumLTC === "" || lender.maximumLTC === null) assumptions.push("Maximum LTC not provided");
  if (lender.creditScoreMinimum === "" || lender.creditScoreMinimum === null) assumptions.push("Minimum credit score not provided");
  if (lender.liquidityRequirement === "" || lender.liquidityRequirement === null) assumptions.push("Liquidity requirement not provided");
  if (lender.experienceRequirement === "" || lender.experienceRequirement === null) assumptions.push("Experience requirement not provided");
  if (lender.propertyTypesAllowed === "" || lender.propertyTypesAllowed === null) assumptions.push("Property type criteria not provided");
  if (lender.statesAllowed === "" || lender.statesAllowed === null) assumptions.push("State criteria not provided");
  if (lender.DSCRMinimum === "" || lender.DSCRMinimum === null) assumptions.push("DSCR minimum not provided");
  if (lender.minimumOccupancy === "" || lender.minimumOccupancy === null) assumptions.push("Minimum occupancy not provided");
  if (lender.seasoningRequirementMonths === "" || lender.seasoningRequirementMonths === null) assumptions.push("Seasoning requirement not provided");

  const missingValues = [];
  if (!quoteValues.loanAmount) missingValues.push("Loan amount");
  if (!quoteValues.purchasePrice) missingValues.push("Purchase price");
  if (!quoteValues.rehabBudget) missingValues.push("Rehab budget");
  if (!quoteValues.arv) missingValues.push("ARV");
  if (!quoteValues.expectedMonthlyRent) missingValues.push("Expected monthly rent");
  if (!quoteValues.annualDebtService) missingValues.push("Annual debt service");

  const warnings = [];
  if (averageInterestRate && interestRate > averageInterestRate * 1.1) warnings.push("Rate materially above average");
  if (averagePoints && originationPoints > averagePoints * 1.1) warnings.push("Points materially above average");

  return {
    purchaseLtv,
    arvLtv,
    ltc,
    originationFee,
    estimatedMonthlyInterest,
    estimatedTotalInterest,
    estimatedDrawFees,
    estimatedExtensionCost,
    estimatedTotalFinancingCost,
    estimatedCashRequired,
    dscr,
    qualification: qualificationParts[0] || "Insufficient Data",
    failedRequirements,
    assumptions,
    missingValues,
    warnings,
  };
}

function downloadJson(filename, data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
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
  const headers = Object.keys(rows[0] || {});
  const csvRows = [headers.join(",")];
  rows.forEach((row) => {
    csvRows.push(headers.map((header) => `"${String(row[header] ?? "").replace(/"/g, '""')}"`).join(","));
  });
  const blob = new Blob([csvRows.join("\n")], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export default function LenderDashboard({ onBack, onOpenDealAnalyzer, onOpenFlipAnalyzer, onOpenBrrrrAnalyzer, onOpenProductVault, onOpenContractorHub, onOpenCompDatabase, onOpenNeighborhoodDatabase, onOpenPortfolioDashboard, onOpenPropertyDatabase, onOpenVendorDatabase, onOpenMaterialMatrix, onOpenDealIntake }) {
  const [lenders, setLenders] = useState([]);
  const [deals, setDeals] = useState([]);
  const [properties, setProperties] = useState([]);
  const [portfolio, setPortfolio] = useState([]);
  const [formValues, setFormValues] = useState(initialValues);
  const [editingId, setEditingId] = useState(null);
  const [viewRecord, setViewRecord] = useState(null);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("All");
  const [purposeFilter, setPurposeFilter] = useState("All");
  const [approvalFilter, setApprovalFilter] = useState("All");
  const [activeFilter, setActiveFilter] = useState("All");
  const [preferredFilter, setPreferredFilter] = useState("All");
  const [favoriteFilter, setFavoriteFilter] = useState("All");
  const [refiFilter, setRefiFilter] = useState("All");
  const [rehabFilter, setRehabFilter] = useState("All");
  const [recourseFilter, setRecourseFilter] = useState("All");
  const [stateFilter, setStateFilter] = useState("All");
  const [maxRateFilter, setMaxRateFilter] = useState("");
  const [maxPointsFilter, setMaxPointsFilter] = useState("");
  const [minScoreFilter, setMinScoreFilter] = useState("");
  const [maxDrawFilter, setMaxDrawFilter] = useState("");
  const [sortBy, setSortBy] = useState("score");
  const [message, setMessage] = useState({ type: "info", text: "" });
  const [loading, setLoading] = useState(true);
  const [quoteValues, setQuoteValues] = useState({
    selectedLenderId: "",
    selectedDealId: "",
    selectedPropertyId: "",
    selectedPortfolioId: "",
    loanAmount: "",
    purchasePrice: "",
    rehabBudget: "",
    arv: "",
    requestedTerm: "",
    expectedDrawCount: "",
    extensionMonths: "",
    propertyType: "",
    state: "",
    creditScore: "",
    experienceCount: "",
    liquidity: "",
    expectedMonthlyRent: "",
    annualDebtService: "",
    minimumOccupancy: "",
    seasoningMonths: "",
  });
  const [comparisonIds, setComparisonIds] = useState([]);

  const loadLenders = async () => {
    setLoading(true);
    try {
      const response = await fetch(buildApiUrl("/api/lenders"));
      if (!response.ok) throw new Error("backend unavailable");
      const data = await response.json();
      setLenders(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Unable to load lenders from API, using localStorage fallback", error);
      try {
        const stored = JSON.parse(window.localStorage.getItem("royalStarLenders") || "[]") || [];
        setLenders(Array.isArray(stored) ? stored : []);
      } catch (localError) {
        console.error("Unable to read lenders from localStorage", localError);
        setLenders([]);
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

    const [dealsData, propertiesData, portfolioData] = await Promise.all([
      fetchJson("/api/deals", "royalStarDeals"),
      fetchJson("/api/properties", "royalStarProperties"),
      fetchJson("/api/portfolio", "royalStarPortfolio"),
    ]);

    setDeals(dealsData);
    setProperties(propertiesData);
    setPortfolio(portfolioData);
  };

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadLenders();
      void loadRelatedData();
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const averageInterestRate = useMemo(() => {
    const rates = lenders.map((item) => Number(item.interestRate)).filter((value) => Number.isFinite(value));
    return rates.length ? rates.reduce((sum, value) => sum + value, 0) / rates.length : 0;
  }, [lenders]);

  const averagePoints = useMemo(() => {
    const points = lenders.map((item) => Number(item.originationPoints)).filter((value) => Number.isFinite(value));
    return points.length ? points.reduce((sum, value) => sum + value, 0) / points.length : 0;
  }, [lenders]);

  const normalizedLenders = useMemo(() => {
    return lenders.map((item) => ({
      ...item,
      overallScore: item.overallScore !== "" && item.overallScore !== null && item.overallScore !== undefined ? Number(item.overallScore) : getOverallScore(item),
      recommendation: getRecommendation(item, getRiskWarnings(item, averageInterestRate, averagePoints)).label,
      riskWarnings: getRiskWarnings(item, averageInterestRate, averagePoints),
    }));
  }, [lenders, averageInterestRate, averagePoints]);

  const visibleLenders = useMemo(() => {
    const searchTerm = search.trim().toLowerCase();
    const filtered = normalizedLenders.filter((lender) => {
      const haystack = [
        lender.lenderName,
        lender.contactName,
        lender.loanProgramName,
        lender.city,
        lender.state,
        lender.phone,
        lender.email,
      ].join(" ").toLowerCase();

      const matchesSearch = !searchTerm || haystack.includes(searchTerm);
      const matchesType = typeFilter === "All" || lender.lenderType === typeFilter;
      const matchesPurpose = purposeFilter === "All" || lender.loanPurpose === purposeFilter;
      const matchesApproval = approvalFilter === "All" || lender.approvalStatus === approvalFilter;
      const matchesActive = activeFilter === "All" || lender.activeStatus === activeFilter;
      const matchesPreferred = preferredFilter === "All" || (preferredFilter === "Yes" ? lender.preferredLender === "Yes" : lender.preferredLender !== "Yes");
      const matchesFavorite = favoriteFilter === "All" || (favoriteFilter === "Favorites Only" ? lender.favorite : !lender.favorite);
      const matchesRefi = refiFilter === "All" || (refiFilter === "Yes" ? lender.refinanceAvailable === "Yes" : lender.refinanceAvailable !== "Yes");
      const matchesRehab = rehabFilter === "All" || (rehabFilter === "Yes" ? lender.rehabFinancingAvailable === "Yes" : lender.rehabFinancingAvailable !== "Yes");
      const matchesRecourse = recourseFilter === "All" || lender.recourseType === recourseFilter;
      const matchesState = stateFilter === "All" || (lender.statesAllowed || "").toLowerCase().includes(stateFilter.toLowerCase());
      const matchesMaxRate = !maxRateFilter || (Number(lender.interestRate) <= Number(maxRateFilter) || lender.interestRate === "");
      const matchesMaxPoints = !maxPointsFilter || (Number(lender.originationPoints) <= Number(maxPointsFilter) || lender.originationPoints === "");
      const matchesMinScore = !minScoreFilter || (Number(lender.overallScore) >= Number(minScoreFilter) || lender.overallScore === "Insufficient Data");
      const matchesDraw = !maxDrawFilter || (Number(lender.drawTurnaroundDays) <= Number(maxDrawFilter) || lender.drawTurnaroundDays === "");

      return matchesSearch && matchesType && matchesPurpose && matchesApproval && matchesActive && matchesPreferred && matchesFavorite && matchesRefi && matchesRehab && matchesRecourse && matchesState && matchesMaxRate && matchesMaxPoints && matchesMinScore && matchesDraw;
    });

    switch (sortBy) {
      case "interest":
        filtered.sort((a, b) => Number(a.interestRate || 999) - Number(b.interestRate || 999));
        break;
      case "points":
        filtered.sort((a, b) => Number(a.originationPoints || 999) - Number(b.originationPoints || 999));
        break;
      case "cost":
        filtered.sort((a, b) => (Number(a.underwritingFee || 0) + Number(a.processingFee || 0) + Number(a.appraisalFee || 0) + Number(a.legalFee || 0) + Number(a.drawFee || 0) + Number(a.interestRate || 0) * 10) - (Number(b.underwritingFee || 0) + Number(b.processingFee || 0) + Number(b.appraisalFee || 0) + Number(b.legalFee || 0) + Number(b.drawFee || 0) + Number(b.interestRate || 0) * 10));
        break;
      case "score":
        filtered.sort((a, b) => Number(b.overallScore || 0) - Number(a.overallScore || 0));
        break;
      case "draw":
        filtered.sort((a, b) => Number(a.drawTurnaroundDays || 999) - Number(b.drawTurnaroundDays || 999));
        break;
      case "capacity":
        filtered.sort((a, b) => Number(b.maximumLoanAmount || 0) - Number(a.maximumLoanAmount || 0));
        break;
      case "newest":
        filtered.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
        break;
      case "oldest":
        filtered.sort((a, b) => (a.createdAt || "").localeCompare(b.createdAt || ""));
        break;
      case "loan":
        filtered.sort((a, b) => (b.lastLoanDate || "").localeCompare(a.lastLoanDate || ""));
        break;
      default:
        filtered.sort((a, b) => (a.lenderName || "").localeCompare(b.lenderName || ""));
    }

    return filtered;
  }, [normalizedLenders, search, typeFilter, purposeFilter, approvalFilter, activeFilter, preferredFilter, favoriteFilter, refiFilter, rehabFilter, recourseFilter, stateFilter, maxRateFilter, maxPointsFilter, minScoreFilter, maxDrawFilter, sortBy]);

  const summaryStats = useMemo(() => {
    const total = normalizedLenders.length;
    const active = normalizedLenders.filter((item) => item.activeStatus === "Active").length;
    const preferred = normalizedLenders.filter((item) => item.approvalStatus === "Preferred").length;
    const approved = normalizedLenders.filter((item) => item.approvalStatus === "Approved").length;
    const review = normalizedLenders.filter((item) => item.approvalStatus === "Under Review").length;
    const suspended = normalizedLenders.filter((item) => item.activeStatus === "Suspended").length;
    const activeLoans = normalizedLenders.reduce((sum, item) => sum + Number(item.activeLoans || 0), 0);
    const currentBalance = normalizedLenders.reduce((sum, item) => sum + Number(item.totalCurrentBalance || 0), 0);
    const originalBalance = normalizedLenders.reduce((sum, item) => sum + Number(item.totalOriginalBalance || 0), 0);
    const interestPaid = normalizedLenders.reduce((sum, item) => sum + Number(item.totalInterestPaid || 0), 0);
    const feesPaid = normalizedLenders.reduce((sum, item) => sum + Number(item.totalFeesPaid || 0), 0);
    const scores = normalizedLenders.map((item) => Number(item.overallScore)).filter((value) => Number.isFinite(value));
    const averageScore = scores.length ? scores.reduce((sum, value) => sum + value, 0) / scores.length : 0;
    const fastest = normalizedLenders.filter((item) => Number.isFinite(Number(item.drawTurnaroundDays))).sort((a, b) => Number(a.drawTurnaroundDays || 999) - Number(b.drawTurnaroundDays || 999))[0];
    const cheapest = normalizedLenders.filter((item) => Number.isFinite(Number(item.interestRate))).sort((a, b) => Number(a.interestRate || 999) - Number(b.interestRate || 999))[0];
    const highestRated = normalizedLenders.filter((item) => Number.isFinite(Number(item.overallScore))).sort((a, b) => Number(b.overallScore || 0) - Number(a.overallScore || 0))[0];
    const expiring = normalizedLenders.filter((item) => item.termSheetExpiration && new Date(item.termSheetExpiration) <= new Date(new Date().getTime() + 15 * 24 * 60 * 60 * 1000)).length;
    const favorites = normalizedLenders.filter((item) => item.favorite).length;

    return { total, active, preferred, approved, review, suspended, activeLoans, currentBalance, originalBalance, interestPaid, feesPaid, averageScore, fastest, cheapest, highestRated, expiring, favorites };
  }, [normalizedLenders]);

  const quoteResult = useMemo(() => calculateQuote(normalizedLenders.find((item) => item.id === quoteValues.selectedLenderId) || {}, quoteValues, averageInterestRate, averagePoints), [normalizedLenders, quoteValues, averageInterestRate, averagePoints]);

  const comparisonItems = useMemo(() => normalizedLenders.filter((item) => comparisonIds.includes(item.id)), [normalizedLenders, comparisonIds]);

  const handleChange = (event) => {
    const { name, value, type, checked } = event.target;
    setFormValues((current) => ({ ...current, [name]: type === "checkbox" ? checked : value }));
  };

  const resetForm = () => {
    setFormValues(initialValues);
    setEditingId(null);
    setMessage({ type: "info", text: "Form cleared." });
  };

  const saveLender = async (event) => {
    event.preventDefault();
    const normalized = normalizeLenderPayload(formValues);
    const errors = validateLender(normalized);
    if (errors.length > 0) {
      setMessage({ type: "error", text: errors.join(" ") });
      return;
    }

    const duplicates = lenders.filter((item) => {
      if (editingId && item.id === editingId) return false;
      const sameName = normalized.lenderName && item.lenderName && normalized.lenderName.toLowerCase() === item.lenderName.toLowerCase();
      const samePhone = normalized.phone && item.phone && normalized.phone === item.phone;
      const sameEmail = normalized.email && item.email && normalized.email.toLowerCase() === item.email.toLowerCase();
      const sameProgram = normalized.loanProgramName && item.loanProgramName && normalized.loanProgramName.toLowerCase() === item.loanProgramName.toLowerCase();
      return sameName || samePhone || sameEmail || sameProgram;
    });

    if (duplicates.length > 0 && !window.confirm("This lender appears similar to an existing record. Continue creating a duplicate?")) {
      setMessage({ type: "error", text: "Duplicate lender creation cancelled." });
      return;
    }

    const payload = {
      ...normalized,
      overallScore: getOverallScore(normalized),
      createdAt: normalized.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    try {
      const response = editingId
        ? await fetch(buildApiUrl(`/api/lenders/${editingId}`), { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) })
        : await fetch(buildApiUrl("/api/lenders"), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });

      if (!response.ok) throw new Error("backend unavailable");
      const saved = await response.json();
      const nextLenders = editingId ? lenders.map((item) => (item.id === editingId ? saved : item)) : [...lenders, saved];
      setLenders(nextLenders);
      if (editingId) {
        setMessage({ type: "success", text: "Lender updated successfully." });
      } else {
        setMessage({ type: "success", text: "Lender added successfully." });
      }
      resetForm();
      setViewRecord(null);
      window.localStorage.setItem("royalStarLenders", JSON.stringify(nextLenders));
    } catch (error) {
      console.error("Unable to save lender via API, using localStorage fallback", error);
      const nextLenders = editingId ? lenders.map((item) => (item.id === editingId ? payload : item)) : [...lenders, payload];
      setLenders(nextLenders);
      window.localStorage.setItem("royalStarLenders", JSON.stringify(nextLenders));
      setMessage({ type: "success", text: editingId ? "Lender updated locally." : "Lender added locally." });
      resetForm();
      setViewRecord(null);
    }
  };

  const editLender = (lender) => {
    setFormValues({ ...initialValues, ...lender, id: lender.id });
    setEditingId(lender.id);
    setViewRecord(null);
    setMessage({ type: "info", text: `Editing ${lender.lenderName || "lender"}.` });
  };

  const duplicateLender = (lender) => {
    const duplicatePayload = { ...lender, id: "", lenderName: `${lender.lenderName} Copy`, createdAt: "", updatedAt: "" };
    setFormValues({ ...initialValues, ...duplicatePayload });
    setEditingId(null);
    setViewRecord(null);
    setMessage({ type: "info", text: "Duplicate lender loaded into the form." });
  };

  const deleteLender = async (lenderId) => {
    if (!window.confirm("Delete this lender record?")) return;
    try {
      const response = await fetch(buildApiUrl(`/api/lenders/${lenderId}`), { method: "DELETE" });
      if (!response.ok) throw new Error("backend unavailable");
      const nextLenders = lenders.filter((item) => item.id !== lenderId);
      setLenders(nextLenders);
      window.localStorage.setItem("royalStarLenders", JSON.stringify(nextLenders));
      setMessage({ type: "success", text: "Lender deleted successfully." });
    } catch {
      const nextLenders = lenders.filter((item) => item.id !== lenderId);
      setLenders(nextLenders);
      window.localStorage.setItem("royalStarLenders", JSON.stringify(nextLenders));
      setMessage({ type: "success", text: "Lender deleted locally." });
    }
  };

  const toggleFavorite = async (lender) => {
    const nextValue = !lender.favorite;
    const updated = { ...lender, favorite: nextValue, updatedAt: new Date().toISOString() };
    try {
      const response = await fetch(buildApiUrl(`/api/lenders/${lender.id}`), { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(updated) });
      if (!response.ok) throw new Error("backend unavailable");
      const saved = await response.json();
      setLenders((current) => current.map((item) => (item.id === lender.id ? saved : item)));
    } catch {
      setLenders((current) => current.map((item) => (item.id === lender.id ? updated : item)));
      window.localStorage.setItem("royalStarLenders", JSON.stringify(lenders.map((item) => (item.id === lender.id ? updated : item))));
    }
  };

  const selectDeal = (dealId) => {
    const deal = deals.find((item) => item.id === dealId);
    if (!deal) return;
    const shouldPrefill = !quoteValues.purchasePrice && !quoteValues.rehabBudget && !quoteValues.arv && !quoteValues.propertyType && !quoteValues.state;
    if (!shouldPrefill && !window.confirm("Replace the current quote values with this saved deal?")) return;
    setQuoteValues((current) => ({ ...current, selectedDealId: dealId, purchasePrice: current.purchasePrice || deal.purchasePrice || deal.askingPrice || "", rehabBudget: current.rehabBudget || deal.rehabBudget || "", arv: current.arv || deal.estimatedArv || "", propertyType: current.propertyType || deal.propertyType || "", state: current.state || deal.state || "", expectedMonthlyRent: current.expectedMonthlyRent || deal.estimatedRent || "" }));
  };

  const selectProperty = (propertyId) => {
    const property = properties.find((item) => item.id === propertyId);
    if (!property) return;
    const shouldPrefill = !quoteValues.purchasePrice && !quoteValues.rehabBudget && !quoteValues.arv && !quoteValues.propertyType && !quoteValues.state && !quoteValues.expectedMonthlyRent;
    if (!shouldPrefill && !window.confirm("Replace the current quote values with this property?")) return;
    setQuoteValues((current) => ({ ...current, selectedPropertyId: propertyId, purchasePrice: current.purchasePrice || property.purchasePrice || property.currentEstimatedValue || "", rehabBudget: current.rehabBudget || property.rehabBudget || "", arv: current.arv || property.originalARV || property.currentEstimatedValue || "", propertyType: current.propertyType || property.propertyType || "", state: current.state || property.state || "", expectedMonthlyRent: current.expectedMonthlyRent || property.monthlyRent || "" }));
  };

  const selectPortfolio = (portfolioId) => {
    const entry = portfolio.find((item) => item.id === portfolioId);
    if (!entry) return;
    const shouldPrefill = !quoteValues.purchasePrice && !quoteValues.loanAmount && !quoteValues.expectedMonthlyRent && !quoteValues.annualDebtService && !quoteValues.state;
    if (!shouldPrefill && !window.confirm("Replace the current quote values with this portfolio property?")) return;
    setQuoteValues((current) => ({ ...current, selectedPortfolioId: portfolioId, loanAmount: current.loanAmount || entry.loanBalance || "", purchasePrice: current.purchasePrice || entry.purchasePrice || "", state: current.state || entry.state || "", expectedMonthlyRent: current.expectedMonthlyRent || entry.monthlyRent || "", annualDebtService: current.annualDebtService || entry.monthlyDebtService || "" }));
  };

  const toggleComparison = (lenderId) => {
    setComparisonIds((current) => current.includes(lenderId) ? current.filter((id) => id !== lenderId) : [...current, lenderId].slice(-5));
  };

  const exportFilteredLenders = () => {
    const rows = visibleLenders.map((lender) => ({
      lenderName: lender.lenderName,
      lenderType: lender.lenderType,
      interestRate: lender.interestRate,
      originationPoints: lender.originationPoints,
      overallScore: lender.overallScore,
      recommendation: lender.recommendation,
      riskLevel: getRiskLevel(lender.riskWarnings),
    }));
    if (rows.length) {
      downloadCsv("lenders.csv", rows);
      downloadJson("lenders.json", rows);
      setMessage({ type: "success", text: "Filtered lenders exported." });
    } else {
      setMessage({ type: "error", text: "No lenders available to export." });
    }
  };

  const exportComparison = () => {
    const rows = comparisonItems.map((lender) => ({
      lenderName: lender.lenderName,
      interestRate: lender.interestRate,
      originationPoints: lender.originationPoints,
      maximumPurchaseLTV: lender.maximumPurchaseLTV,
      maximumARVLTV: lender.maximumARVLTV,
      maximumLTC: lender.maximumLTC,
      loanTermMonths: lender.loanTermMonths,
      drawTurnaroundDays: lender.drawTurnaroundDays,
      overallScore: lender.overallScore,
      recommendation: lender.recommendation,
      riskLevel: getRiskLevel(lender.riskWarnings),
    }));
    if (rows.length) {
      downloadCsv("lender-comparison.csv", rows);
      downloadJson("lender-comparison.json", rows);
      setMessage({ type: "success", text: "Comparison exported." });
    }
  };

  const exportQuote = () => {
    const selected = normalizedLenders.find((item) => item.id === quoteValues.selectedLenderId);
    if (!selected) {
      setMessage({ type: "error", text: "Select a lender before exporting quote results." });
      return;
    }
    const rows = [{
      lenderName: selected.lenderName,
      loanAmount: quoteValues.loanAmount,
      purchasePrice: quoteValues.purchasePrice,
      rehabBudget: quoteValues.rehabBudget,
      arv: quoteValues.arv,
      purchaseLtv: quoteResult.purchaseLtv,
      arvLtv: quoteResult.arvLtv,
      ltc: quoteResult.ltc,
      originationFee: quoteResult.originationFee,
      estimatedTotalFinancingCost: quoteResult.estimatedTotalFinancingCost,
      estimatedCashRequired: quoteResult.estimatedCashRequired,
      qualification: quoteResult.qualification,
      failedRequirements: quoteResult.failedRequirements.join(" | "),
      assumptions: quoteResult.assumptions.join(" | "),
    }];
    downloadCsv("quote-results.csv", rows);
    downloadJson("quote-results.json", rows);
    setMessage({ type: "success", text: "Quote results exported." });
  };

  return (
    <div style={styles.page}>
      <aside style={styles.sidebar}>
        <div style={styles.logoArea}><img src={logo} alt="Royal Star Properties" style={styles.logo} /></div>
        <nav style={styles.nav}>
          {navigation.map(([icon, label]) => {
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
            const isNewDeal = label === "ADD NEW DEAL";
            return (
              <button
                key={label}
                type="button"
                style={styles.navButton}
                onClick={isHome ? onBack : isDealAnalyzer ? onOpenDealAnalyzer : isFlip ? onOpenFlipAnalyzer : isBrrrr ? onOpenBrrrrAnalyzer : isProduct ? onOpenProductVault : isContractor ? onOpenContractorHub : isComp ? onOpenCompDatabase : isNeighborhood ? onOpenNeighborhoodDatabase : isPortfolio ? onOpenPortfolioDashboard : isProperty ? onOpenPropertyDatabase : isVendor ? onOpenVendorDatabase : isMaterial ? onOpenMaterialMatrix : isNewDeal ? onOpenDealIntake : undefined}
              >
                <span style={styles.navIcon}>{icon}</span>
                <span>{label}</span>
                <span style={styles.navTab} />
              </button>
            );
          })}
        </nav>
      </aside>

      <main style={styles.main}>
        <section style={styles.topBar}>
          <div>
            <div style={styles.eyebrow}>ROYAL STAR LENDER OPERATIONS</div>
            <h1 style={styles.pageTitle}>LENDER DASHBOARD</h1>
          </div>
          <div style={styles.topActions}>
            <button type="button" style={styles.secondaryButton} onClick={onBack}>COMMAND CENTER</button>
            <button type="button" style={styles.primaryButton} onClick={() => setViewRecord(null)}>VIEW LENDER LIST</button>
          </div>
        </section>

        {message.text ? <div style={message.type === "error" ? styles.errorBanner : styles.successBanner}>{message.text}</div> : null}

        <section style={styles.summaryGrid}>
          <SummaryCard label="Total Lenders" value={summaryStats.total} />
          <SummaryCard label="Active Lenders" value={summaryStats.active} />
          <SummaryCard label="Preferred Lenders" value={summaryStats.preferred} />
          <SummaryCard label="Approved Lenders" value={summaryStats.approved} />
          <SummaryCard label="Lenders Under Review" value={summaryStats.review} />
          <SummaryCard label="Suspended Lenders" value={summaryStats.suspended} />
          <SummaryCard label="Total Active Loans" value={summaryStats.activeLoans} />
          <SummaryCard label="Total Current Balance" value={formatCurrency(summaryStats.currentBalance)} />
          <SummaryCard label="Total Original Balance" value={formatCurrency(summaryStats.originalBalance)} />
          <SummaryCard label="Total Interest Paid" value={formatCurrency(summaryStats.interestPaid)} />
          <SummaryCard label="Total Fees Paid" value={formatCurrency(summaryStats.feesPaid)} />
          <SummaryCard label="Average Interest Rate" value={formatPercent(averageInterestRate)} />
          <SummaryCard label="Average Points" value={formatPercent(averagePoints)} />
          <SummaryCard label="Average Overall Score" value={summaryStats.averageScore ? Number(summaryStats.averageScore).toFixed(1) : "Insufficient Data"} />
          <SummaryCard label="Fastest Draw Lender" value={summaryStats.fastest ? summaryStats.fastest.lenderName : "Insufficient Data"} />
          <SummaryCard label="Lowest Cost Lender" value={summaryStats.cheapest ? summaryStats.cheapest.lenderName : "Insufficient Data"} />
          <SummaryCard label="Highest Rated Lender" value={summaryStats.highestRated ? summaryStats.highestRated.lenderName : "Insufficient Data"} />
          <SummaryCard label="Expiring Term Sheets" value={summaryStats.expiring} />
          <SummaryCard label="Favorite Lenders" value={summaryStats.favorites} />
        </section>

        <section style={styles.contentGrid}>
          <div style={styles.panel}>
            <div style={styles.panelHeader}><h2 style={styles.panelTitle}>LENDER FORM</h2><button type="button" style={styles.secondaryButton} onClick={resetForm}>CLEAR FORM</button></div>
            <form onSubmit={saveLender} style={styles.form}>
              <FieldGroup title="Core Information">
                <div style={styles.fieldRow}>
                  <label style={styles.label}>Lender Name<input name="lenderName" value={formValues.lenderName} onChange={handleChange} style={styles.input} required /></label>
                  <label style={styles.label}>Lender Type<select name="lenderType" value={formValues.lenderType} onChange={handleChange} style={styles.input}><option value="">Select</option>{lenderTypeOptions.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>
                </div>
                <div style={styles.fieldRow}>
                  <label style={styles.label}>Contact Name<input name="contactName" value={formValues.contactName} onChange={handleChange} style={styles.input} /></label>
                  <label style={styles.label}>Contact Title<input name="contactTitle" value={formValues.contactTitle} onChange={handleChange} style={styles.input} /></label>
                </div>
                <div style={styles.fieldRow}>
                  <label style={styles.label}>Phone<input name="phone" value={formValues.phone} onChange={handleChange} style={styles.input} /></label>
                  <label style={styles.label}>Email<input name="email" type="email" value={formValues.email} onChange={handleChange} style={styles.input} /></label>
                </div>
                <div style={styles.fieldRow}>
                  <label style={styles.label}>Website<input name="website" value={formValues.website} onChange={handleChange} style={styles.input} /></label>
                  <label style={styles.label}>Portal URL<input name="portalUrl" value={formValues.portalUrl} onChange={handleChange} style={styles.input} /></label>
                </div>
                <div style={styles.fieldRow}>
                  <label style={styles.label}>Source URL<input name="sourceUrl" value={formValues.sourceUrl} onChange={handleChange} style={styles.input} /></label>
                  <label style={styles.label}>Address<input name="address" value={formValues.address} onChange={handleChange} style={styles.input} /></label>
                </div>
                <div style={styles.fieldRow}>
                  <label style={styles.label}>City<input name="city" value={formValues.city} onChange={handleChange} style={styles.input} /></label>
                  <label style={styles.label}>State<input name="state" value={formValues.state} onChange={handleChange} style={styles.input} /></label>
                </div>
                <div style={styles.fieldRow}>
                  <label style={styles.label}>ZIP Code<input name="zipCode" value={formValues.zipCode} onChange={handleChange} style={styles.input} /></label>
                  <label style={styles.label}>Loan Program Name<input name="loanProgramName" value={formValues.loanProgramName} onChange={handleChange} style={styles.input} required /></label>
                </div>
              </FieldGroup>

              <FieldGroup title="Loan Terms & Fees">
                <div style={styles.fieldRow}>
                  <label style={styles.label}>Loan Purpose<select name="loanPurpose" value={formValues.loanPurpose} onChange={handleChange} style={styles.input}>{loanPurposeOptions.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>
                  <label style={styles.label}>Property Types Allowed<input name="propertyTypesAllowed" value={formValues.propertyTypesAllowed} onChange={handleChange} style={styles.input} /></label>
                </div>
                <div style={styles.fieldRow}>
                  <label style={styles.label}>States Allowed<input name="statesAllowed" value={formValues.statesAllowed} onChange={handleChange} style={styles.input} /></label>
                  <label style={styles.label}>Minimum Loan Amount<input name="minimumLoanAmount" type="number" value={formValues.minimumLoanAmount} onChange={handleChange} style={styles.input} /></label>
                </div>
                <div style={styles.fieldRow}>
                  <label style={styles.label}>Maximum Loan Amount<input name="maximumLoanAmount" type="number" value={formValues.maximumLoanAmount} onChange={handleChange} style={styles.input} /></label>
                  <label style={styles.label}>Maximum Purchase LTV<input name="maximumPurchaseLTV" type="number" value={formValues.maximumPurchaseLTV} onChange={handleChange} style={styles.input} /></label>
                </div>
                <div style={styles.fieldRow}>
                  <label style={styles.label}>Maximum ARV LTV<input name="maximumARVLTV" type="number" value={formValues.maximumARVLTV} onChange={handleChange} style={styles.input} /></label>
                  <label style={styles.label}>Maximum LTC<input name="maximumLTC" type="number" value={formValues.maximumLTC} onChange={handleChange} style={styles.input} /></label>
                </div>
                <div style={styles.fieldRow}>
                  <label style={styles.label}>Interest Rate<input name="interestRate" type="number" value={formValues.interestRate} onChange={handleChange} style={styles.input} /></label>
                  <label style={styles.label}>Rate Type<select name="rateType" value={formValues.rateType} onChange={handleChange} style={styles.input}>{rateTypeOptions.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>
                </div>
                <div style={styles.fieldRow}>
                  <label style={styles.label}>Origination Points<input name="originationPoints" type="number" value={formValues.originationPoints} onChange={handleChange} style={styles.input} /></label>
                  <label style={styles.label}>Underwriting Fee<input name="underwritingFee" type="number" value={formValues.underwritingFee} onChange={handleChange} style={styles.input} /></label>
                </div>
                <div style={styles.fieldRow}>
                  <label style={styles.label}>Processing Fee<input name="processingFee" type="number" value={formValues.processingFee} onChange={handleChange} style={styles.input} /></label>
                  <label style={styles.label}>Appraisal Fee<input name="appraisalFee" type="number" value={formValues.appraisalFee} onChange={handleChange} style={styles.input} /></label>
                </div>
                <div style={styles.fieldRow}>
                  <label style={styles.label}>Legal Fee<input name="legalFee" type="number" value={formValues.legalFee} onChange={handleChange} style={styles.input} /></label>
                  <label style={styles.label}>Draw Fee<input name="drawFee" type="number" value={formValues.drawFee} onChange={handleChange} style={styles.input} /></label>
                </div>
                <div style={styles.fieldRow}>
                  <label style={styles.label}>Extension Fee<input name="extensionFee" type="number" value={formValues.extensionFee} onChange={handleChange} style={styles.input} /></label>
                  <label style={styles.label}>Minimum Interest Months<input name="minimumInterestMonths" type="number" value={formValues.minimumInterestMonths} onChange={handleChange} style={styles.input} /></label>
                </div>
                <div style={styles.fieldRow}>
                  <label style={styles.label}>Loan Term Months<input name="loanTermMonths" type="number" value={formValues.loanTermMonths} onChange={handleChange} style={styles.input} /></label>
                  <label style={styles.label}>Extension Options<input name="extensionOptions" value={formValues.extensionOptions} onChange={handleChange} style={styles.input} /></label>
                </div>
                <div style={styles.fieldRow}>
                  <label style={styles.label}>Interest Only<select name="interestOnly" value={formValues.interestOnly} onChange={handleChange} style={styles.input}>{yesNoOptions.map((option) => <option key={option} value={option}>{option || "Select"}</option>)}</select></label>
                  <label style={styles.label}>Recourse Type<select name="recourseType" value={formValues.recourseType} onChange={handleChange} style={styles.input}>{recourseTypeOptions.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>
                </div>
                <div style={styles.fieldRow}>
                  <label style={styles.label}>Personal Guarantee Required<select name="personalGuaranteeRequired" value={formValues.personalGuaranteeRequired} onChange={handleChange} style={styles.input}>{yesNoOptions.map((option) => <option key={option} value={option}>{option || "Select"}</option>)}</select></label>
                  <label style={styles.label}>Prepayment Penalty<select name="prepaymentPenalty" value={formValues.prepaymentPenalty} onChange={handleChange} style={styles.input}>{yesNoOptions.map((option) => <option key={option} value={option}>{option || "Select"}</option>)}</select></label>
                </div>
                <div style={styles.fieldRow}>
                  <label style={styles.label}>Rehab Financing Available<select name="rehabFinancingAvailable" value={formValues.rehabFinancingAvailable} onChange={handleChange} style={styles.input}>{yesNoOptions.map((option) => <option key={option} value={option}>{option || "Select"}</option>)}</select></label>
                  <label style={styles.label}>Rehab Advance Percentage<input name="rehabAdvancePercentage" type="number" value={formValues.rehabAdvancePercentage} onChange={handleChange} style={styles.input} /></label>
                </div>
                <div style={styles.fieldRow}>
                  <label style={styles.label}>Draw Schedule Type<select name="drawScheduleType" value={formValues.drawScheduleType} onChange={handleChange} style={styles.input}>{drawScheduleOptions.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>
                  <label style={styles.label}>Draw Turnaround Days<input name="drawTurnaroundDays" type="number" value={formValues.drawTurnaroundDays} onChange={handleChange} style={styles.input} /></label>
                </div>
                <div style={styles.fieldRow}>
                  <label style={styles.label}>Appraisal Required<select name="appraisalRequired" value={formValues.appraisalRequired} onChange={handleChange} style={styles.input}>{yesNoOptions.map((option) => <option key={option} value={option}>{option || "Select"}</option>)}</select></label>
                  <label style={styles.label}>Credit Score Minimum<input name="creditScoreMinimum" type="number" value={formValues.creditScoreMinimum} onChange={handleChange} style={styles.input} /></label>
                </div>
                <div style={styles.fieldRow}>
                  <label style={styles.label}>Liquidity Requirement<input name="liquidityRequirement" type="number" value={formValues.liquidityRequirement} onChange={handleChange} style={styles.input} /></label>
                  <label style={styles.label}>Experience Requirement<input name="experienceRequirement" type="number" value={formValues.experienceRequirement} onChange={handleChange} style={styles.input} /></label>
                </div>
                <div style={styles.fieldRow}>
                  <label style={styles.label}>Entity Required<select name="entityRequired" value={formValues.entityRequired} onChange={handleChange} style={styles.input}>{yesNoOptions.map((option) => <option key={option} value={option}>{option || "Select"}</option>)}</select></label>
                  <label style={styles.label}>Insurance Requirements<input name="insuranceRequirements" value={formValues.insuranceRequirements} onChange={handleChange} style={styles.input} /></label>
                </div>
                <div style={styles.fieldRow}>
                  <label style={styles.label}>Title Requirements<input name="titleRequirements" value={formValues.titleRequirements} onChange={handleChange} style={styles.input} /></label>
                  <label style={styles.label}>Seasoning Requirement Months<input name="seasoningRequirementMonths" type="number" value={formValues.seasoningRequirementMonths} onChange={handleChange} style={styles.input} /></label>
                </div>
                <div style={styles.fieldRow}>
                  <label style={styles.label}>Refinance Available<select name="refinanceAvailable" value={formValues.refinanceAvailable} onChange={handleChange} style={styles.input}>{yesNoOptions.map((option) => <option key={option} value={option}>{option || "Select"}</option>)}</select></label>
                  <label style={styles.label}>Refinance Maximum LTV<input name="refinanceMaximumLTV" type="number" value={formValues.refinanceMaximumLTV} onChange={handleChange} style={styles.input} /></label>
                </div>
                <div style={styles.fieldRow}>
                  <label style={styles.label}>DSCR Minimum<input name="DSCRMinimum" type="number" value={formValues.DSCRMinimum} onChange={handleChange} style={styles.input} /></label>
                  <label style={styles.label}>Minimum Occupancy<input name="minimumOccupancy" type="number" value={formValues.minimumOccupancy} onChange={handleChange} style={styles.input} /></label>
                </div>
              </FieldGroup>

              <FieldGroup title="Status, Scores & Notes">
                <div style={styles.fieldRow}>
                  <label style={styles.label}>Term Sheet Date<input name="termSheetDate" type="date" value={formValues.termSheetDate} onChange={handleChange} style={styles.input} /></label>
                  <label style={styles.label}>Term Sheet Expiration<input name="termSheetExpiration" type="date" value={formValues.termSheetExpiration} onChange={handleChange} style={styles.input} /></label>
                </div>
                <div style={styles.fieldRow}>
                  <label style={styles.label}>Approval Status<select name="approvalStatus" value={formValues.approvalStatus} onChange={handleChange} style={styles.input}>{approvalStatusOptions.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>
                  <label style={styles.label}>Active Status<select name="activeStatus" value={formValues.activeStatus} onChange={handleChange} style={styles.input}>{activeStatusOptions.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>
                </div>
                <div style={styles.fieldRow}>
                  <label style={styles.label}>Preferred Lender<select name="preferredLender" value={formValues.preferredLender} onChange={handleChange} style={styles.input}>{yesNoOptions.map((option) => <option key={option} value={option}>{option || "Select"}</option>)}</select></label>
                  <label style={styles.label}>Favorite<input type="checkbox" name="favorite" checked={formValues.favorite} onChange={handleChange} style={styles.checkbox} /></label>
                </div>
                <div style={styles.fieldRow}>
                  <label style={styles.label}>Reliability Score<input name="reliabilityScore" type="number" value={formValues.reliabilityScore} onChange={handleChange} style={styles.input} /></label>
                  <label style={styles.label}>Speed Score<input name="speedScore" type="number" value={formValues.speedScore} onChange={handleChange} style={styles.input} /></label>
                </div>
                <div style={styles.fieldRow}>
                  <label style={styles.label}>Pricing Score<input name="pricingScore" type="number" value={formValues.pricingScore} onChange={handleChange} style={styles.input} /></label>
                  <label style={styles.label}>Communication Score<input name="communicationScore" type="number" value={formValues.communicationScore} onChange={handleChange} style={styles.input} /></label>
                </div>
                <div style={styles.fieldRow}>
                  <label style={styles.label}>Flexibility Score<input name="flexibilityScore" type="number" value={formValues.flexibilityScore} onChange={handleChange} style={styles.input} /></label>
                  <label style={styles.label}>Overall Score<input name="overallScore" type="number" value={formValues.overallScore || getOverallScore(normalizeLenderPayload(formValues))} onChange={handleChange} style={styles.input} readOnly /></label>
                </div>
                <div style={styles.fieldRow}>
                  <label style={styles.label}>Total Loans<input name="totalLoans" type="number" value={formValues.totalLoans} onChange={handleChange} style={styles.input} /></label>
                  <label style={styles.label}>Active Loans<input name="activeLoans" type="number" value={formValues.activeLoans} onChange={handleChange} style={styles.input} /></label>
                </div>
                <div style={styles.fieldRow}>
                  <label style={styles.label}>Total Original Balance<input name="totalOriginalBalance" type="number" value={formValues.totalOriginalBalance} onChange={handleChange} style={styles.input} /></label>
                  <label style={styles.label}>Total Current Balance<input name="totalCurrentBalance" type="number" value={formValues.totalCurrentBalance} onChange={handleChange} style={styles.input} /></label>
                </div>
                <div style={styles.fieldRow}>
                  <label style={styles.label}>Total Interest Paid<input name="totalInterestPaid" type="number" value={formValues.totalInterestPaid} onChange={handleChange} style={styles.input} /></label>
                  <label style={styles.label}>Total Fees Paid<input name="totalFeesPaid" type="number" value={formValues.totalFeesPaid} onChange={handleChange} style={styles.input} /></label>
                </div>
                <div style={styles.fieldRow}>
                  <label style={styles.label}>Last Loan Date<input name="lastLoanDate" type="date" value={formValues.lastLoanDate} onChange={handleChange} style={styles.input} /></label>
                  <label style={styles.label}>Last Contact Date<input name="lastContactDate" type="date" value={formValues.lastContactDate} onChange={handleChange} style={styles.input} /></label>
                </div>
                <label style={styles.label}>Notes<textarea name="notes" value={formValues.notes} onChange={handleChange} style={{ ...styles.input, minHeight: "90px" }} /></label>
              </FieldGroup>

              <div style={styles.formActions}>
                <button type="submit" style={styles.primaryButton}>{editingId ? "SAVE CHANGES" : "ADD LENDER"}</button>
                <button type="button" style={styles.secondaryButton} onClick={resetForm}>RESET</button>
              </div>
            </form>
          </div>

          <div style={styles.panel}>
            <div style={styles.panelHeader}><h2 style={styles.panelTitle}>SEARCH & FILTER</h2><button type="button" style={styles.secondaryButton} onClick={exportFilteredLenders}>EXPORT</button></div>
            <div style={styles.filterRow}>
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search lender name, contact, program, city, state, phone, or email" style={styles.input} />
            </div>
            <div style={styles.filterRow}>
              <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)} style={styles.input}><option value="All">All Lender Types</option>{lenderTypeOptions.map((option) => <option key={option} value={option}>{option}</option>)}</select>
              <select value={purposeFilter} onChange={(event) => setPurposeFilter(event.target.value)} style={styles.input}>{["All", ...loanPurposeOptions].map((option) => <option key={option} value={option}>{option}</option>)}</select>
            </div>
            <div style={styles.filterRow}>
              <select value={approvalFilter} onChange={(event) => setApprovalFilter(event.target.value)} style={styles.input}><option value="All">All Approval Status</option>{approvalStatusOptions.map((option) => <option key={option} value={option}>{option}</option>)}</select>
              <select value={activeFilter} onChange={(event) => setActiveFilter(event.target.value)} style={styles.input}><option value="All">All Active Status</option>{activeStatusOptions.map((option) => <option key={option} value={option}>{option}</option>)}</select>
            </div>
            <div style={styles.filterRow}>
              <select value={preferredFilter} onChange={(event) => setPreferredFilter(event.target.value)} style={styles.input}><option value="All">All Preferred</option><option value="Yes">Preferred Only</option><option value="No">Other</option></select>
              <select value={favoriteFilter} onChange={(event) => setFavoriteFilter(event.target.value)} style={styles.input}><option value="All">All Favorites</option><option value="Favorites Only">Favorites Only</option><option value="All Records">All Records</option></select>
            </div>
            <div style={styles.filterRow}>
              <select value={refiFilter} onChange={(event) => setRefiFilter(event.target.value)} style={styles.input}><option value="All">Any Refinance</option><option value="Yes">Refi Available</option><option value="No">Refi Unavailable</option></select>
              <select value={rehabFilter} onChange={(event) => setRehabFilter(event.target.value)} style={styles.input}><option value="All">Any Rehab</option><option value="Yes">Rehab Available</option><option value="No">Rehab Unavailable</option></select>
            </div>
            <div style={styles.filterRow}>
              <select value={recourseFilter} onChange={(event) => setRecourseFilter(event.target.value)} style={styles.input}><option value="All">All Recourse</option>{recourseTypeOptions.map((option) => <option key={option} value={option}>{option}</option>)}</select>
              <input value={stateFilter} onChange={(event) => setStateFilter(event.target.value)} placeholder="State allowed" style={styles.input} />
            </div>
            <div style={styles.filterRow}>
              <input value={maxRateFilter} onChange={(event) => setMaxRateFilter(event.target.value)} placeholder="Max interest rate" style={styles.input} />
              <input value={maxPointsFilter} onChange={(event) => setMaxPointsFilter(event.target.value)} placeholder="Max points" style={styles.input} />
            </div>
            <div style={styles.filterRow}>
              <input value={minScoreFilter} onChange={(event) => setMinScoreFilter(event.target.value)} placeholder="Min score" style={styles.input} />
              <input value={maxDrawFilter} onChange={(event) => setMaxDrawFilter(event.target.value)} placeholder="Max draw days" style={styles.input} />
            </div>
            <div style={styles.filterRow}><select value={sortBy} onChange={(event) => setSortBy(event.target.value)} style={styles.input}>{sortOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>

            <div style={styles.panelHeader}><h2 style={styles.panelTitle}>QUOTE CALCULATOR</h2><button type="button" style={styles.secondaryButton} onClick={exportQuote}>EXPORT QUOTE</button></div>
            <div style={styles.fieldRow}>
              <label style={styles.label}>Selected Lender<select value={quoteValues.selectedLenderId} onChange={(event) => setQuoteValues((current) => ({ ...current, selectedLenderId: event.target.value }))} style={styles.input}>{normalizedLenders.map((lender) => <option key={lender.id} value={lender.id}>{lender.lenderName}</option>)}</select></label>
              <label style={styles.label}>Selected Saved Deal<select value={quoteValues.selectedDealId} onChange={(event) => { setQuoteValues((current) => ({ ...current, selectedDealId: event.target.value })); selectDeal(event.target.value); }} style={styles.input}><option value="">Select</option>{deals.map((deal) => <option key={deal.id} value={deal.id}>{deal.propertyAddress || deal.address || deal.id}</option>)}</select></label>
            </div>
            <div style={styles.fieldRow}>
              <label style={styles.label}>Selected Property<select value={quoteValues.selectedPropertyId} onChange={(event) => { setQuoteValues((current) => ({ ...current, selectedPropertyId: event.target.value })); selectProperty(event.target.value); }} style={styles.input}><option value="">Select</option>{properties.map((property) => <option key={property.id} value={property.id}>{property.propertyName || property.address || property.id}</option>)}</select></label>
              <label style={styles.label}>Selected Portfolio Property<select value={quoteValues.selectedPortfolioId} onChange={(event) => { setQuoteValues((current) => ({ ...current, selectedPortfolioId: event.target.value })); selectPortfolio(event.target.value); }} style={styles.input}><option value="">Select</option>{portfolio.map((entry) => <option key={entry.id} value={entry.id}>{entry.propertyName || entry.propertyAddress || entry.id}</option>)}</select></label>
            </div>
            <div style={styles.fieldRow}>
              <label style={styles.label}>Loan Amount<input type="number" value={quoteValues.loanAmount} onChange={(event) => setQuoteValues((current) => ({ ...current, loanAmount: event.target.value }))} style={styles.input} /></label>
              <label style={styles.label}>Purchase Price<input type="number" value={quoteValues.purchasePrice} onChange={(event) => setQuoteValues((current) => ({ ...current, purchasePrice: event.target.value }))} style={styles.input} /></label>
            </div>
            <div style={styles.fieldRow}>
              <label style={styles.label}>Rehab Budget<input type="number" value={quoteValues.rehabBudget} onChange={(event) => setQuoteValues((current) => ({ ...current, rehabBudget: event.target.value }))} style={styles.input} /></label>
              <label style={styles.label}>ARV<input type="number" value={quoteValues.arv} onChange={(event) => setQuoteValues((current) => ({ ...current, arv: event.target.value }))} style={styles.input} /></label>
            </div>
            <div style={styles.fieldRow}>
              <label style={styles.label}>Requested Term<input type="number" value={quoteValues.requestedTerm} onChange={(event) => setQuoteValues((current) => ({ ...current, requestedTerm: event.target.value }))} style={styles.input} /></label>
              <label style={styles.label}>Expected Draw Count<input type="number" value={quoteValues.expectedDrawCount} onChange={(event) => setQuoteValues((current) => ({ ...current, expectedDrawCount: event.target.value }))} style={styles.input} /></label>
            </div>
            <div style={styles.fieldRow}>
              <label style={styles.label}>Extension Months<input type="number" value={quoteValues.extensionMonths} onChange={(event) => setQuoteValues((current) => ({ ...current, extensionMonths: event.target.value }))} style={styles.input} /></label>
              <label style={styles.label}>Property Type<input value={quoteValues.propertyType} onChange={(event) => setQuoteValues((current) => ({ ...current, propertyType: event.target.value }))} style={styles.input} /></label>
            </div>
            <div style={styles.fieldRow}>
              <label style={styles.label}>State<input value={quoteValues.state} onChange={(event) => setQuoteValues((current) => ({ ...current, state: event.target.value }))} style={styles.input} /></label>
              <label style={styles.label}>Credit Score<input type="number" value={quoteValues.creditScore} onChange={(event) => setQuoteValues((current) => ({ ...current, creditScore: event.target.value }))} style={styles.input} /></label>
            </div>
            <div style={styles.fieldRow}>
              <label style={styles.label}>Experience Count<input type="number" value={quoteValues.experienceCount} onChange={(event) => setQuoteValues((current) => ({ ...current, experienceCount: event.target.value }))} style={styles.input} /></label>
              <label style={styles.label}>Liquidity<input type="number" value={quoteValues.liquidity} onChange={(event) => setQuoteValues((current) => ({ ...current, liquidity: event.target.value }))} style={styles.input} /></label>
            </div>
            <div style={styles.fieldRow}>
              <label style={styles.label}>Expected Monthly Rent<input type="number" value={quoteValues.expectedMonthlyRent} onChange={(event) => setQuoteValues((current) => ({ ...current, expectedMonthlyRent: event.target.value }))} style={styles.input} /></label>
              <label style={styles.label}>Annual Debt Service<input type="number" value={quoteValues.annualDebtService} onChange={(event) => setQuoteValues((current) => ({ ...current, annualDebtService: event.target.value }))} style={styles.input} /></label>
            </div>
            <div style={styles.fieldRow}>
              <label style={styles.label}>Minimum Occupancy<input type="number" value={quoteValues.minimumOccupancy} onChange={(event) => setQuoteValues((current) => ({ ...current, minimumOccupancy: event.target.value }))} style={styles.input} /></label>
              <label style={styles.label}>Seasoning Months<input type="number" value={quoteValues.seasoningMonths} onChange={(event) => setQuoteValues((current) => ({ ...current, seasoningMonths: event.target.value }))} style={styles.input} /></label>
            </div>
            <div style={styles.quoteMetrics}>
              <div><strong>Purchase LTV</strong><div>{quoteResult.purchaseLtv === "" ? "Insufficient Data" : `${Number(quoteResult.purchaseLtv).toFixed(1)}%`}</div></div>
              <div><strong>ARV LTV</strong><div>{quoteResult.arvLtv === "" ? "Insufficient Data" : `${Number(quoteResult.arvLtv).toFixed(1)}%`}</div></div>
              <div><strong>LTC</strong><div>{quoteResult.ltc === "" ? "Insufficient Data" : `${Number(quoteResult.ltc).toFixed(1)}%`}</div></div>
              <div><strong>Origination Fee</strong><div>{formatCurrency(quoteResult.originationFee)}</div></div>
              <div><strong>Estimated Fixed Fees</strong><div>{formatCurrency(quoteResult.estimatedTotalFinancingCost - quoteResult.estimatedDrawFees - quoteResult.estimatedExtensionCost - quoteResult.estimatedTotalInterest)}</div></div>
              <div><strong>Estimated Draw Fees</strong><div>{formatCurrency(quoteResult.estimatedDrawFees)}</div></div>
              <div><strong>Estimated Monthly Interest</strong><div>{formatCurrency(quoteResult.estimatedMonthlyInterest)}</div></div>
              <div><strong>Estimated Total Interest</strong><div>{formatCurrency(quoteResult.estimatedTotalInterest)}</div></div>
              <div><strong>Estimated Extension Cost</strong><div>{formatCurrency(quoteResult.estimatedExtensionCost)}</div></div>
              <div><strong>Estimated Total Financing Cost</strong><div>{formatCurrency(quoteResult.estimatedTotalFinancingCost)}</div></div>
              <div><strong>Estimated Cash Required</strong><div>{formatCurrency(quoteResult.estimatedCashRequired)}</div></div>
              <div><strong>DSCR</strong><div>{quoteResult.dscr === "" ? "Insufficient Data" : Number(quoteResult.dscr).toFixed(2)}</div></div>
              <div><strong>Qualification</strong><div>{quoteResult.qualification}</div></div>
              <div><strong>Failed Requirements</strong><div>{quoteResult.failedRequirements.join(" • ") || "None"}</div></div>
              <div><strong>Assumptions</strong><div>{quoteResult.assumptions.join(" • ") || "None"}</div></div>
              <div><strong>Warnings</strong><div>{quoteResult.warnings.join(" • ") || "None"}</div></div>
            </div>
          </div>
        </section>

        <section style={styles.panel}>
          <div style={styles.panelHeader}><h2 style={styles.panelTitle}>LENDER RECORDS</h2><button type="button" style={styles.secondaryButton} onClick={() => exportComparison()}>EXPORT COMPARISON</button></div>
          {loading ? <div style={styles.emptyState}>Loading lenders…</div> : visibleLenders.length === 0 ? <div style={styles.emptyState}>No lender records available<button type="button" style={styles.primaryButton} onClick={() => setMessage({ type: "info", text: "Use the form above to add a lender." })}>ADD LENDER</button></div> : (
            <div style={styles.tableWrap}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>★</th>
                    <th style={styles.th}>Lender</th>
                    <th style={styles.th}>Type</th>
                    <th style={styles.th}>Program</th>
                    <th style={styles.th}>Contact</th>
                    <th style={styles.th}>Phone</th>
                    <th style={styles.th}>Rate</th>
                    <th style={styles.th}>Points</th>
                    <th style={styles.th}>Max LTV</th>
                    <th style={styles.th}>Loan Term</th>
                    <th style={styles.th}>Draw</th>
                    <th style={styles.th}>Status</th>
                    <th style={styles.th}>Score</th>
                    <th style={styles.th}>Risk</th>
                    <th style={styles.th}>Recommendation</th>
                    <th style={styles.th}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleLenders.map((lender) => {
                    const risks = getRiskWarnings(lender, averageInterestRate, averagePoints);
                    const recommendation = getRecommendation(lender, risks);
                    const riskLevel = getRiskLevel(risks);
                    return (
                      <tr key={lender.id} style={styles.tr}>
                        <td style={styles.td}><button type="button" style={styles.iconButton} onClick={() => toggleFavorite(lender)}>{lender.favorite ? "★" : "☆"}</button></td>
                        <td style={styles.td}>{lender.lenderName}</td>
                        <td style={styles.td}>{lender.lenderType}</td>
                        <td style={styles.td}>{lender.loanProgramName}</td>
                        <td style={styles.td}>{lender.contactName}</td>
                        <td style={styles.td}>{lender.phone}</td>
                        <td style={styles.td}>{lender.interestRate || "—"}</td>
                        <td style={styles.td}>{lender.originationPoints || "—"}</td>
                        <td style={styles.td}>{lender.maximumPurchaseLTV || lender.maximumARVLTV || "—"}</td>
                        <td style={styles.td}>{lender.loanTermMonths || "—"}</td>
                        <td style={styles.td}>{lender.drawTurnaroundDays || "—"}</td>
                        <td style={styles.td}>{lender.approvalStatus}/{lender.activeStatus}</td>
                        <td style={styles.td}>{lender.overallScore || getOverallScore(lender)}</td>
                        <td style={styles.td}>{riskLevel}</td>
                        <td style={styles.td}>{recommendation.label}</td>
                        <td style={styles.td}>
                          <div style={styles.actionRow}>
                            <button type="button" style={styles.linkButton} onClick={() => setViewRecord(lender)}>View</button>
                            <button type="button" style={styles.linkButton} onClick={() => editLender(lender)}>Edit</button>
                            <button type="button" style={styles.linkButton} onClick={() => duplicateLender(lender)}>Duplicate</button>
                            <button type="button" style={styles.linkButton} onClick={() => deleteLender(lender.id)}>Delete</button>
                            <button type="button" style={styles.linkButton} onClick={() => toggleComparison(lender.id)}>{comparisonIds.includes(lender.id) ? "Selected" : "Compare"}</button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {viewRecord ? <section style={styles.panel}><div style={styles.panelHeader}><h2 style={styles.panelTitle}>FULL LENDER RECORD</h2><button type="button" style={styles.secondaryButton} onClick={() => setViewRecord(null)}>CLOSE</button></div><div style={styles.recordGrid}>{Object.entries(viewRecord).map(([key, value]) => <div key={key} style={styles.recordField}><strong>{key}</strong><div>{typeof value === "boolean" ? String(value) : value || "—"}</div></div>)}</div></section> : null}

        {comparisonItems.length > 0 ? <section style={styles.panel}><div style={styles.panelHeader}><h2 style={styles.panelTitle}>COMPARISON</h2><button type="button" style={styles.secondaryButton} onClick={() => exportComparison()}>EXPORT</button></div><div style={styles.comparisonGrid}>{comparisonItems.map((lender) => <div key={lender.id} style={styles.comparisonCard}><h3 style={styles.cardTitle}>{lender.lenderName}</h3><div>Interest Rate: {lender.interestRate || "Insufficient Data"}</div><div>Points: {lender.originationPoints || "Insufficient Data"}</div><div>Upfront Fees: {formatCurrency(Number(lender.underwritingFee || 0) + Number(lender.processingFee || 0) + Number(lender.appraisalFee || 0) + Number(lender.legalFee || 0))}</div><div>Loan Limits: {formatCurrency(lender.maximumLoanAmount)}</div><div>Purchase LTV: {lender.maximumPurchaseLTV || "Insufficient Data"}</div><div>ARV LTV: {lender.maximumARVLTV || "Insufficient Data"}</div><div>LTC: {lender.maximumLTC || "Insufficient Data"}</div><div>Loan Term: {lender.loanTermMonths || "Insufficient Data"}</div><div>Draw Days: {lender.drawTurnaroundDays || "Insufficient Data"}</div><div>Overall Score: {lender.overallScore || "Insufficient Data"}</div><div>Risk: {getRiskLevel(getRiskWarnings(lender, averageInterestRate, averagePoints))}</div><div>Recommendation: {getRecommendation(lender, getRiskWarnings(lender, averageInterestRate, averagePoints)).label}</div></div>)}</div></section> : null}
      </main>
    </div>
  );
}

function FieldGroup({ title, children }) {
  return (
    <fieldset style={styles.fieldset}>
      <legend style={styles.legend}>{title}</legend>
      {children}
    </fieldset>
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
  page: { minHeight: "100vh", display: "flex", backgroundColor: BLACK, color: GOLD, fontFamily: "Arial, Helvetica, sans-serif" },
  sidebar: { flex: "0 0 180px", padding: "18px 12px", borderRight: `1px solid ${BORDER}` },
  logoArea: { height: "110px", display: "flex", alignItems: "center", justifyContent: "center" },
  logo: { width: "130px", height: "100px", objectFit: "contain", backgroundColor: "#fff" },
  nav: { display: "flex", flexDirection: "column", gap: "4px" },
  navButton: { background: `linear-gradient(90deg, ${GOLD} 0%, #eab90c 100%)`, color: BLACK, border: `1px solid ${BORDER}`, padding: "8px 10px", textAlign: "left", cursor: "pointer", fontWeight: 700, fontSize: "10px" },
  navIcon: { marginRight: "8px" },
  navTab: { display: "inline-block", width: "8px", height: "8px", backgroundColor: BLACK, marginLeft: "8px" },
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
  formActions: { display: "flex", gap: "8px", marginTop: "8px" },
  fieldset: { border: `1px solid ${BORDER}`, padding: "10px", margin: 0 },
  legend: { padding: "0 6px", fontSize: "12px", letterSpacing: "1px", textTransform: "uppercase" },
  fieldRow: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", marginBottom: "8px" },
  label: { display: "flex", flexDirection: "column", gap: "4px", fontSize: "11px", textTransform: "uppercase", color: "#f7d339" },
  input: { background: BLACK, border: `1px solid ${BORDER}`, color: GOLD, padding: "8px", fontSize: "12px" },
  checkbox: { width: "16px", height: "16px", marginTop: "4px" },
  filterRow: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", marginBottom: "8px" },
  quoteMetrics: { display: "grid", gridTemplateColumns: "repeat(2, minmax(120px, 1fr))", gap: "8px", marginTop: "10px" },
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
};
