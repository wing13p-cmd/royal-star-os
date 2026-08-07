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
  ["📄", "APPRAISER PACKET BUILDER"],
  ["🗂️", "PROPERTY DATABASE"],
  ["🗃️", "VENDOR DATABASE"],
  ["▪", "MATERIAL MATRIX"],
];

const marketCycleOptions = ["Early Recovery", "Expansion", "Hyper Supply", "Recession", "Stable", "Unknown"];
const crimeRatingOptions = ["Very Low Risk", "Low Risk", "Moderate Risk", "High Risk", "Very High Risk", "Unknown"];
const buyBoxOptions = ["All", "Strong Match", "Selective Match", "Outside Buy Box"];
const overallRatingOptions = ["All", "Green", "Yellow", "Red"];
const strategyOptions = ["All", "Flip", "BRRRR", "Long-Term Hold", "Watchlist", "Pass"];
const favoriteOptions = ["All", "Favorites Only"];
const sortOptions = [
  ["royalStarScore", "Highest Royal Star Score"],
  ["flipScore", "Highest Flip Score"],
  ["brrrrScore", "Highest BRRRR Score"],
  ["appreciationScore", "Highest Appreciation Score"],
  ["cashFlowScore", "Highest Cash Flow Score"],
  ["riskScore", "Lowest Risk Score"],
  ["medianRent", "Highest Median Rent"],
  ["appreciation", "Highest Appreciation"],
  ["newest", "Newest"],
];

const initialValues = {
  id: "",
  neighborhoodName: "",
  city: "",
  county: "",
  state: "",
  zipCode: "",
  censusTract: "",
  latitude: "",
  longitude: "",
  schoolDistrict: "",
  medianHomeValue: "",
  medianRent: "",
  averageRent: "",
  rentGrowth1Year: "",
  rentGrowth3Year: "",
  appreciation1Year: "",
  appreciation3Year: "",
  appreciation5Year: "",
  appreciation10Year: "",
  averageDaysOnMarket: "",
  medianPricePerSquareFoot: "",
  activeInventory: "",
  monthsOfSupply: "",
  vacancyRate: "",
  ownerOccupancyRate: "",
  population: "",
  populationGrowth: "",
  medianHouseholdIncome: "",
  incomeGrowth: "",
  employmentGrowth: "",
  crimeRating: "Unknown",
  schoolRating: "",
  investorDemandScore: "",
  rentalDemandScore: "",
  marketCycle: "Unknown",
  favorite: false,
  notes: "",
  mapUrl: "",
  dataSource: "",
  sourceUrl: "",
  dataAsOfDate: "",
  createdAt: "",
  updatedAt: "",
};

const primaryZipCodes = new Set(["41011", "41014", "41015", "41016", "41017", "45211", "45224", "45239", "45205", "45238", "45231", "45223", "45232"]);
const focusCities = new Set(["Covington", "Cincinnati"]);
const focusStates = new Set(["Kentucky", "Ohio", "KY", "OH"]);

function createId(prefix = "neighborhood") {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

function parseNumber(value) {
  if (value === "" || value === null || value === undefined) return "";
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : "";
}

function formatCurrency(value) {
  if (value === "" || value === null || value === undefined || !Number.isFinite(Number(value))) return "—";
  return `$${Number(value).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

function formatPercent(value) {
  if (value === "" || value === null || value === undefined || !Number.isFinite(Number(value))) return "—";
  return `${Number(value).toFixed(1)}%`;
}

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function normalizeNeighborhoodPayload(values) {
  return {
    id: values.id || "",
    neighborhoodName: values.neighborhoodName || "",
    city: values.city || "",
    county: values.county || "",
    state: values.state || "",
    zipCode: values.zipCode || "",
    censusTract: values.censusTract || "",
    latitude: parseNumber(values.latitude),
    longitude: parseNumber(values.longitude),
    schoolDistrict: values.schoolDistrict || "",
    medianHomeValue: parseNumber(values.medianHomeValue),
    medianRent: parseNumber(values.medianRent),
    averageRent: parseNumber(values.averageRent),
    rentGrowth1Year: parseNumber(values.rentGrowth1Year),
    rentGrowth3Year: parseNumber(values.rentGrowth3Year),
    appreciation1Year: parseNumber(values.appreciation1Year),
    appreciation3Year: parseNumber(values.appreciation3Year),
    appreciation5Year: parseNumber(values.appreciation5Year),
    appreciation10Year: parseNumber(values.appreciation10Year),
    averageDaysOnMarket: parseNumber(values.averageDaysOnMarket),
    medianPricePerSquareFoot: parseNumber(values.medianPricePerSquareFoot),
    activeInventory: parseNumber(values.activeInventory),
    monthsOfSupply: parseNumber(values.monthsOfSupply),
    vacancyRate: parseNumber(values.vacancyRate),
    ownerOccupancyRate: parseNumber(values.ownerOccupancyRate),
    population: parseNumber(values.population),
    populationGrowth: parseNumber(values.populationGrowth),
    medianHouseholdIncome: parseNumber(values.medianHouseholdIncome),
    incomeGrowth: parseNumber(values.incomeGrowth),
    employmentGrowth: parseNumber(values.employmentGrowth),
    crimeRating: values.crimeRating || "Unknown",
    schoolRating: values.schoolRating === "" ? "" : parseNumber(values.schoolRating),
    investorDemandScore: parseNumber(values.investorDemandScore),
    rentalDemandScore: parseNumber(values.rentalDemandScore),
    marketCycle: values.marketCycle || "Unknown",
    favorite: Boolean(values.favorite),
    notes: values.notes || "",
    mapUrl: values.mapUrl || "",
    dataSource: values.dataSource || "",
    sourceUrl: values.sourceUrl || "",
    dataAsOfDate: values.dataAsOfDate || "",
    createdAt: values.createdAt || "",
    updatedAt: values.updatedAt || "",
  };
}

function validateNeighborhood(values) {
  const errors = [];

  if (!values.neighborhoodName?.trim()) errors.push("Neighborhood name is required.");
  if (!values.city?.trim()) errors.push("City is required.");
  if (!values.state?.trim()) errors.push("State is required.");
  if (!values.zipCode?.trim()) errors.push("ZIP code is required.");

  const numericFields = [
    ["latitude", -90, 90, false],
    ["longitude", -180, 180, false],
    ["medianHomeValue", 0, null, false],
    ["medianRent", 0, null, false],
    ["averageRent", 0, null, false],
    ["rentGrowth1Year", null, null, true],
    ["rentGrowth3Year", null, null, true],
    ["appreciation1Year", null, null, true],
    ["appreciation3Year", null, null, true],
    ["appreciation5Year", null, null, true],
    ["appreciation10Year", null, null, true],
    ["averageDaysOnMarket", 0, null, false],
    ["medianPricePerSquareFoot", 0, null, false],
    ["activeInventory", 0, null, false],
    ["monthsOfSupply", 0, null, false],
    ["vacancyRate", 0, 100, false],
    ["ownerOccupancyRate", 0, 100, false],
    ["population", 0, null, false],
    ["populationGrowth", null, null, true],
    ["medianHouseholdIncome", 0, null, false],
    ["incomeGrowth", null, null, true],
    ["employmentGrowth", null, null, true],
    ["investorDemandScore", 0, 100, false],
    ["rentalDemandScore", 0, 100, false],
    ["schoolRating", 0, 10, false],
  ];

  numericFields.forEach(([field, min, max, allowNegative]) => {
    const value = values[field];
    if (value === "" || value === null || value === undefined) return;
    const numericValue = Number(value);
    if (!Number.isFinite(numericValue)) {
      errors.push(`${field} must be numeric.`);
      return;
    }
    if (!allowNegative && numericValue < 0) {
      errors.push(`${field} cannot be negative.`);
      return;
    }
    if (max !== null && numericValue > max) {
      errors.push(`${field} cannot exceed ${max}.`);
    }
    if (min !== null && numericValue < min) {
      errors.push(`${field} cannot be below ${min}.`);
    }
  });

  return errors;
}

function getBuyBoxMatch(neighborhood) {
  const zipCode = neighborhood.zipCode;
  const primaryZip = primaryZipCodes.has(zipCode);
  const focusZip = focusCities.has(neighborhood.city) || focusStates.has(neighborhood.state) || focusStates.has(neighborhood.state?.toUpperCase());
  const supportsDemand = Boolean(neighborhood.medianRent && neighborhood.medianHomeValue && (neighborhood.rentalDemandScore >= 60 || neighborhood.investorDemandScore >= 60 || neighborhood.appreciation1Year > 0));
  const mixedIndicators = Boolean(neighborhood.rentalDemandScore && neighborhood.investorDemandScore && neighborhood.vacancyRate && neighborhood.rentGrowth1Year);

  if (primaryZip && supportsDemand) return { label: "Strong Match", explanation: "The ZIP is a primary Royal Star target and the market data supports investment activity." };
  if (primaryZip) return { label: "Selective Match", explanation: "The ZIP is a primary target but the current data is mixed enough that the market should be monitored closely." };
  if (focusZip && (mixedIndicators || neighborhood.city === "Covington" || neighborhood.city === "Cincinnati")) return { label: "Selective Match", explanation: "The market is within the Royal Star focus footprint, but the current signal is selective rather than primary-target strength." };
  return { label: "Outside Buy Box", explanation: "The neighborhood is outside the current Royal Star focus ZIP codes and does not align with the active buy-box footprint." };
}

function getFlipScore(neighborhood) {
  const appreciation = [neighborhood.appreciation1Year, neighborhood.appreciation3Year, neighborhood.appreciation5Year, neighborhood.appreciation10Year].filter((value) => value !== "" && value !== null && value !== undefined);
  const appreciationScore = appreciation.length > 0 ? appreciation.reduce((sum, value) => sum + Number(value), 0) / appreciation.length : 0;
  const daysOnMarketScore = neighborhood.averageDaysOnMarket ? clamp(100 - Number(neighborhood.averageDaysOnMarket) * 0.8, 0, 100) : 50;
  const inventoryScore = neighborhood.monthsOfSupply ? clamp(100 - Number(neighborhood.monthsOfSupply) * 8, 0, 100) : 50;
  const ppsfScore = neighborhood.medianPricePerSquareFoot ? clamp(100 - Math.max(0, Number(neighborhood.medianPricePerSquareFoot) - 250) / 5, 0, 100) : 50;
  const demandScore = neighborhood.investorDemandScore ? Number(neighborhood.investorDemandScore) : 50;
  const populationScore = neighborhood.populationGrowth !== "" ? clamp(50 + Number(neighborhood.populationGrowth) * 10, 0, 100) : 50;
  const employmentScore = neighborhood.employmentGrowth !== "" ? clamp(50 + Number(neighborhood.employmentGrowth) * 8, 0, 100) : 50;
  const marketCycleScore = neighborhood.marketCycle === "Expansion" ? 90 : neighborhood.marketCycle === "Stable" ? 80 : neighborhood.marketCycle === "Early Recovery" ? 72 : neighborhood.marketCycle === "Unknown" ? 60 : 35;
  const crimePenalty = neighborhood.crimeRating === "High Risk" || neighborhood.crimeRating === "Very High Risk" ? 18 : neighborhood.crimeRating === "Moderate Risk" ? 8 : 0;
  const schoolScore = neighborhood.schoolRating !== "" ? Number(neighborhood.schoolRating) * 10 : 60;

  const score = clamp(
    0.16 * Math.max(0, Math.min(100, appreciationScore * 2)) +
      0.12 * daysOnMarketScore +
      0.1 * inventoryScore +
      0.1 * ppsfScore +
      0.12 * demandScore +
      0.1 * populationScore +
      0.09 * employmentScore +
      0.08 * marketCycleScore +
      0.08 * schoolScore +
      0.05 * (100 - crimePenalty),
    0,
    100,
  );

  return Math.round(score);
}

function getBrrrrScore(neighborhood) {
  const medianRentScore = neighborhood.medianRent ? clamp((Number(neighborhood.medianRent) / 2500) * 100, 0, 100) : 40;
  const rentGrowthScore = neighborhood.rentGrowth1Year !== "" ? clamp(50 + Number(neighborhood.rentGrowth1Year) * 7, 0, 100) : 50;
  const vacancyScore = neighborhood.vacancyRate !== "" ? clamp(100 - Number(neighborhood.vacancyRate) * 1.2, 0, 100) : 50;
  const rentalDemandScore = neighborhood.rentalDemandScore !== "" ? Number(neighborhood.rentalDemandScore) : 50;
  const rentToValue = neighborhood.medianRent && neighborhood.medianHomeValue ? Number(neighborhood.medianRent) / Number(neighborhood.medianHomeValue) : 0;
  const rentToValueScore = rentToValue > 0.008 ? 90 : rentToValue > 0.006 ? 75 : rentToValue > 0.004 ? 60 : 35;
  const populationScore = neighborhood.populationGrowth !== "" ? clamp(50 + Number(neighborhood.populationGrowth) * 8, 0, 100) : 50;
  const employmentScore = neighborhood.employmentGrowth !== "" ? clamp(50 + Number(neighborhood.employmentGrowth) * 8, 0, 100) : 50;
  const occupancyScore = neighborhood.ownerOccupancyRate !== "" ? Number(neighborhood.ownerOccupancyRate) : 50;
  const crimePenalty = neighborhood.crimeRating === "High Risk" || neighborhood.crimeRating === "Very High Risk" ? 18 : neighborhood.crimeRating === "Moderate Risk" ? 8 : 0;
  const marketCycleScore = neighborhood.marketCycle === "Expansion" ? 90 : neighborhood.marketCycle === "Stable" ? 80 : neighborhood.marketCycle === "Early Recovery" ? 72 : neighborhood.marketCycle === "Unknown" ? 60 : 35;

  const score = clamp(
    0.16 * medianRentScore +
      0.14 * rentGrowthScore +
      0.12 * vacancyScore +
      0.12 * rentalDemandScore +
      0.1 * rentToValueScore +
      0.1 * populationScore +
      0.1 * employmentScore +
      0.08 * occupancyScore +
      0.08 * marketCycleScore +
      0.05 * (100 - crimePenalty),
    0,
    100,
  );

  return Math.round(score);
}

function getAppreciationScore(neighborhood) {
  const appreciation1 = neighborhood.appreciation1Year !== "" ? Number(neighborhood.appreciation1Year) : 0;
  const appreciation3 = neighborhood.appreciation3Year !== "" ? Number(neighborhood.appreciation3Year) : 0;
  const appreciation5 = neighborhood.appreciation5Year !== "" ? Number(neighborhood.appreciation5Year) : 0;
  const appreciation10 = neighborhood.appreciation10Year !== "" ? Number(neighborhood.appreciation10Year) : 0;
  const populationScore = neighborhood.populationGrowth !== "" ? clamp(50 + Number(neighborhood.populationGrowth) * 8, 0, 100) : 50;
  const incomeScore = neighborhood.incomeGrowth !== "" ? clamp(50 + Number(neighborhood.incomeGrowth) * 8, 0, 100) : 50;
  const employmentScore = neighborhood.employmentGrowth !== "" ? clamp(50 + Number(neighborhood.employmentGrowth) * 8, 0, 100) : 50;

  const avgAppreciation = (appreciation1 + appreciation3 + appreciation5 + appreciation10) / 4;
  const score = clamp(0.35 * clamp(avgAppreciation * 2, 0, 100) + 0.25 * populationScore + 0.2 * incomeScore + 0.2 * employmentScore, 0, 100);
  return Math.round(score);
}

function getCashFlowScore(neighborhood) {
  const medianRentScore = neighborhood.medianRent ? clamp((Number(neighborhood.medianRent) / 2600) * 100, 0, 100) : 45;
  const valueScore = neighborhood.medianHomeValue ? clamp(100 - (Number(neighborhood.medianHomeValue) / 1000000) * 10, 0, 100) : 50;
  const vacancyScore = neighborhood.vacancyRate !== "" ? clamp(100 - Number(neighborhood.vacancyRate) * 1.2, 0, 100) : 50;
  const rentGrowthScore = neighborhood.rentGrowth1Year !== "" ? clamp(50 + Number(neighborhood.rentGrowth1Year) * 7, 0, 100) : 50;
  const rentalDemandScore = neighborhood.rentalDemandScore !== "" ? Number(neighborhood.rentalDemandScore) : 50;
  const occupancyScore = neighborhood.ownerOccupancyRate !== "" ? Number(neighborhood.ownerOccupancyRate) : 50;
  const supplyScore = neighborhood.monthsOfSupply !== "" ? clamp(100 - Number(neighborhood.monthsOfSupply) * 8, 0, 100) : 50;

  const score = clamp(
    0.18 * medianRentScore +
      0.16 * valueScore +
      0.16 * vacancyScore +
      0.16 * rentGrowthScore +
      0.14 * rentalDemandScore +
      0.1 * occupancyScore +
      0.1 * supplyScore,
    0,
    100,
  );

  return Math.round(score);
}

function getRiskScore(neighborhood) {
  let score = 0;

  if (neighborhood.crimeRating === "High Risk") score += 18;
  if (neighborhood.crimeRating === "Very High Risk") score += 28;
  if (neighborhood.crimeRating === "Moderate Risk") score += 8;

  if (neighborhood.vacancyRate !== "" && Number(neighborhood.vacancyRate) > 10) score += 16;
  if (neighborhood.populationGrowth !== "" && Number(neighborhood.populationGrowth) < 0) score += 12;
  if (neighborhood.employmentGrowth !== "" && Number(neighborhood.employmentGrowth) < 0) score += 12;
  if (neighborhood.rentGrowth1Year !== "" && Number(neighborhood.rentGrowth1Year) < 0) score += 10;
  if (neighborhood.appreciation1Year !== "" && Number(neighborhood.appreciation1Year) < 0) score += 10;
  if (neighborhood.monthsOfSupply !== "" && Number(neighborhood.monthsOfSupply) > 6) score += 10;
  if (neighborhood.averageDaysOnMarket !== "" && Number(neighborhood.averageDaysOnMarket) > 90) score += 10;
  if (neighborhood.rentalDemandScore !== "" && Number(neighborhood.rentalDemandScore) < 45) score += 10;
  if (neighborhood.marketCycle === "Recession") score += 12;

  const missingDataCount = [neighborhood.medianRent, neighborhood.medianHomeValue, neighborhood.rentalDemandScore, neighborhood.investorDemandScore, neighborhood.vacancyRate].filter((value) => value === "" || value === null || value === undefined).length;
  score += missingDataCount * 5;

  return clamp(Math.round(score), 0, 100);
}

function getOverallScore(neighborhood) {
  const flip = neighborhood.flipScore;
  const brrrr = neighborhood.brrrrScore;
  const appreciation = neighborhood.appreciationScore;
  const cashFlow = neighborhood.cashFlowScore;
  const risk = neighborhood.riskScore;
  const buyBoxWeight = neighborhood.buyBoxMatch.label === "Strong Match" ? 8 : neighborhood.buyBoxMatch.label === "Selective Match" ? 4 : 0;
  const score = clamp(0.24 * flip + 0.2 * brrrr + 0.2 * appreciation + 0.16 * cashFlow + 0.2 * (100 - risk) + buyBoxWeight, 0, 100);
  return Math.round(score);
}

function getRating(score, riskScore, confidence, warnings) {
  if (score >= 75 && riskScore <= 35 && warnings.length === 0) return { label: "Green", color: "#2f9e44" };
  if (score >= 55 || confidence === "Medium" || warnings.length > 0) return { label: "Yellow", color: "#d4a017" };
  return { label: "Red", color: "#b42318" };
}

function getRecommendation(neighborhood) {
  if (neighborhood.flipScore >= 75 && neighborhood.appreciationScore >= 70 && neighborhood.riskScore <= 35 && neighborhood.buyBoxMatch.label === "Strong Match") return { label: "Flip", explanation: "The neighborhood shows strong flip fundamentals, favorable appreciation, and manageable risk for a short-cycle strategy." };
  if (neighborhood.brrrrScore >= 75 && neighborhood.cashFlowScore >= 70 && neighborhood.riskScore <= 40 && neighborhood.rentalDemandScore >= 55 && neighborhood.medianRent && neighborhood.medianHomeValue && Number(neighborhood.medianRent) / Number(neighborhood.medianHomeValue) > 0.005) return { label: "BRRRR", explanation: "The rents, occupancy, and rent-to-value relationship support a BRRRR-focused acquisition strategy." };
  if (neighborhood.appreciationScore >= 70 && neighborhood.brrrrScore < 75 && neighborhood.flipScore < 75) return { label: "Long-Term Hold", explanation: "The market has strong appreciation and core fundamentals, but near-term flip and cash-flow metrics are less compelling." };
  if (neighborhood.confidence === "Low" || neighborhood.warnings.length >= 3 || neighborhood.buyBoxMatch.label === "Outside Buy Box") return { label: "Watchlist", explanation: "The data is mixed or incomplete, so the market should be monitored rather than pursued aggressively." };
  return { label: "Pass", explanation: "The market is weak enough or risky enough that it does not fit the current Royal Star acquisition standards." };
}

function getConfidence(neighborhood) {
  const keyFields = [
    neighborhood.medianHomeValue,
    neighborhood.medianRent,
    neighborhood.vacancyRate,
    neighborhood.appreciation1Year,
    neighborhood.populationGrowth,
    neighborhood.employmentGrowth,
    neighborhood.rentalDemandScore,
    neighborhood.investorDemandScore,
    neighborhood.marketCycle,
  ];
  const populated = keyFields.filter((value) => value !== "" && value !== null && value !== undefined).length;
  const contradictions = [neighborhood.rentGrowth1Year < 0 && neighborhood.vacancyRate > 10, neighborhood.populationGrowth < 0 && neighborhood.appreciation1Year > 0].filter(Boolean).length;

  if (populated >= 7 && contradictions === 0) return "High";
  if (populated >= 4) return "Medium";
  return "Low";
}

function getRiskWarnings(neighborhood) {
  const warnings = [];
  if (neighborhood.vacancyRate !== "" && Number(neighborhood.vacancyRate) > 10) warnings.push("Vacancy is above 10%.");
  if (neighborhood.populationGrowth !== "" && Number(neighborhood.populationGrowth) < 0) warnings.push("Population is declining.");
  if (neighborhood.employmentGrowth !== "" && Number(neighborhood.employmentGrowth) < 0) warnings.push("Employment growth is negative.");
  if (neighborhood.rentGrowth1Year !== "" && Number(neighborhood.rentGrowth1Year) < 0) warnings.push("Rent growth is declining.");
  if (neighborhood.appreciation1Year !== "" && Number(neighborhood.appreciation1Year) < 0) warnings.push("Home values are declining.");
  if (neighborhood.marketCycle === "Recession") warnings.push("The market is in recession.");
  if (neighborhood.crimeRating === "High Risk" || neighborhood.crimeRating === "Very High Risk") warnings.push("Crime risk is elevated.");
  if (neighborhood.monthsOfSupply !== "" && Number(neighborhood.monthsOfSupply) > 6) warnings.push("Months of supply are above 6.");
  if (neighborhood.averageDaysOnMarket !== "" && Number(neighborhood.averageDaysOnMarket) > 90) warnings.push("Days on market are elevated.");
  if (neighborhood.confidence === "Low") warnings.push("Confidence is low due to incomplete data.");
  if (neighborhood.isStale) warnings.push("The data is stale.");
  if (neighborhood.medianRent === "" || neighborhood.medianRent === null || neighborhood.medianRent === undefined) warnings.push("Median rent is missing.");
  if (neighborhood.medianHomeValue === "" || neighborhood.medianHomeValue === null || neighborhood.medianHomeValue === undefined) warnings.push("Median home value is missing.");
  return warnings;
}

function getStrengths(neighborhood) {
  const strengths = [];
  if (neighborhood.buyBoxMatch.label === "Strong Match") strengths.push("Strong Royal Star buy-box fit.");
  if (neighborhood.flipScore >= 70) strengths.push("Strong flip metrics.");
  if (neighborhood.brrrrScore >= 70) strengths.push("Strong BRRRR metrics.");
  if (neighborhood.appreciationScore >= 70) strengths.push("Solid appreciation trend.");
  if (neighborhood.cashFlowScore >= 70) strengths.push("Healthy cash-flow potential.");
  if (neighborhood.populationGrowth > 0) strengths.push("Population growth is positive.");
  return strengths.slice(0, 4);
}

function getWeaknesses(neighborhood) {
  const weaknesses = [];
  if (neighborhood.riskScore >= 60) weaknesses.push("Elevated investment risk.");
  if (neighborhood.vacancyRate !== "" && Number(neighborhood.vacancyRate) > 8) weaknesses.push("Vacancy is elevated.");
  if (neighborhood.buyBoxMatch.label === "Outside Buy Box") weaknesses.push("Outside the current focus ZIP codes.");
  if (neighborhood.crimeRating === "High Risk" || neighborhood.crimeRating === "Very High Risk") weaknesses.push("Crime pressure is a concern.");
  if (neighborhood.averageDaysOnMarket !== "" && Number(neighborhood.averageDaysOnMarket) > 80) weaknesses.push("Days on market are high.");
  return weaknesses.slice(0, 4);
}

function getOpportunities(neighborhood) {
  const opportunities = [];
  if (neighborhood.rentalDemandScore >= 60) opportunities.push("Rental demand appears healthy.");
  if (neighborhood.rentGrowth1Year > 0) opportunities.push("Rent growth is positive.");
  if (neighborhood.incomeGrowth > 0) opportunities.push("Income growth is supportive.");
  if (neighborhood.marketCycle === "Early Recovery" || neighborhood.marketCycle === "Expansion") opportunities.push("The market is still expanding.");
  return opportunities.slice(0, 4);
}

function getRisks(neighborhood) {
  const risks = [];
  if (neighborhood.populationGrowth < 0) risks.push("Population decline could limit future demand.");
  if (neighborhood.employmentGrowth < 0) risks.push("Employment weakness could reduce momentum.");
  if (neighborhood.monthsOfSupply > 6) risks.push("Supply is building faster than demand.");
  if (neighborhood.marketCycle === "Recession") risks.push("The market is under recessionary pressure.");
  return risks.slice(0, 4);
}

function getSuggestions(neighborhoods, activeNeighborhood) {
  return neighborhoods
    .filter((entry) => entry.id !== activeNeighborhood.id)
    .map((entry) => {
      const homeValueDiff = activeNeighborhood.medianHomeValue && entry.medianHomeValue ? Math.abs(Number(activeNeighborhood.medianHomeValue) - Number(entry.medianHomeValue)) : Number.MAX_SAFE_INTEGER;
      const rentDiff = activeNeighborhood.medianRent && entry.medianRent ? Math.abs(Number(activeNeighborhood.medianRent) - Number(entry.medianRent)) : Number.MAX_SAFE_INTEGER;
      const vacancyDiff = activeNeighborhood.vacancyRate && entry.vacancyRate ? Math.abs(Number(activeNeighborhood.vacancyRate) - Number(entry.vacancyRate)) : Number.MAX_SAFE_INTEGER;
      const appreciationDiff = activeNeighborhood.appreciation1Year && entry.appreciation1Year ? Math.abs(Number(activeNeighborhood.appreciation1Year) - Number(entry.appreciation1Year)) : Number.MAX_SAFE_INTEGER;
      const populationDiff = activeNeighborhood.populationGrowth && entry.populationGrowth ? Math.abs(Number(activeNeighborhood.populationGrowth) - Number(entry.populationGrowth)) : Number.MAX_SAFE_INTEGER;
      const scoreDiff = activeNeighborhood.royalStarScore - entry.royalStarScore;
      const score = -(homeValueDiff / 50000 + rentDiff / 1000 + vacancyDiff / 5 + appreciationDiff / 2 + populationDiff / 1 + Math.abs(scoreDiff) / 12);
      return { ...entry, matchScore: score };
    })
    .sort((left, right) => right.matchScore - left.matchScore)
    .slice(0, 3);
}

export default function NeighborhoodDatabase({ onBack, onOpenDealAnalyzer, onOpenFlipAnalyzer, onOpenBrrrrAnalyzer, onOpenProductVault, onOpenContractorHub, onOpenCompDatabase, onOpenDealIntelligence, onOpenNeighborhoodDatabase }) {
  const [neighborhoods, setNeighborhoods] = useState([]);
  const [selectedNeighborhoodId, setSelectedNeighborhoodId] = useState("");
  const [formValues, setFormValues] = useState(initialValues);
  const [searchText, setSearchText] = useState("");
  const [stateFilter, setStateFilter] = useState("All");
  const [cityFilter, setCityFilter] = useState("All");
  const [countyFilter, setCountyFilter] = useState("All");
  const [zipFilter, setZipFilter] = useState("All");
  const [buyBoxFilter, setBuyBoxFilter] = useState("All");
  const [ratingFilter, setRatingFilter] = useState("All");
  const [strategyFilter, setStrategyFilter] = useState("All");
  const [cycleFilter, setCycleFilter] = useState("All");
  const [favoriteFilter, setFavoriteFilter] = useState("All");
  const [minFlipFilter, setMinFlipFilter] = useState("");
  const [minBrrrrFilter, setMinBrrrrFilter] = useState("");
  const [maxRiskFilter, setMaxRiskFilter] = useState("");
  const [sortBy, setSortBy] = useState("royalStarScore");
  const [comparisonIds, setComparisonIds] = useState([]);
  const [connectionState, setConnectionState] = useState("Backend Connected");
  const [message, setMessage] = useState({ type: "", text: "" });

  useEffect(() => {
    const loadNeighborhoods = async () => {
      try {
        const response = await fetch(buildApiUrl("/api/neighborhoods"));
        if (!response.ok) throw new Error("Unable to fetch neighborhoods");
        const apiNeighborhoods = await response.json();
        setNeighborhoods(Array.isArray(apiNeighborhoods) ? apiNeighborhoods : []);
        setConnectionState("Backend Connected");
      } catch (error) {
        console.error("Unable to load neighborhoods from API, using fallback", error);
        setConnectionState("Local Fallback");
        if (typeof window !== "undefined") {
          try {
            const stored = JSON.parse(window.localStorage.getItem("royalStarNeighborhoods") || "[]") || [];
            setNeighborhoods(Array.isArray(stored) ? stored : []);
          } catch (localError) {
            console.error("Unable to read neighborhoods from localStorage", localError);
            setNeighborhoods([]);
          }
        }
      }
    };

    loadNeighborhoods();
  }, []);

  const normalizedNeighborhoods = useMemo(() => {
    return neighborhoods.map((entry) => {
      const buyBoxMatch = getBuyBoxMatch(entry);
      const flipScore = getFlipScore(entry);
      const brrrrScore = getBrrrrScore(entry);
      const appreciationScore = getAppreciationScore(entry);
      const cashFlowScore = getCashFlowScore(entry);
      const riskScore = getRiskScore(entry);
      const royalStarScore = getOverallScore({ ...entry, flipScore, brrrrScore, appreciationScore, cashFlowScore, riskScore, buyBoxMatch });
      const rating = getRating(royalStarScore, riskScore, getConfidence(entry), getRiskWarnings({ ...entry, confidence: getConfidence(entry), isStale: isStale(entry.dataAsOfDate) }));
      const confidence = getConfidence(entry);
      const warnings = getRiskWarnings({ ...entry, confidence, isStale: isStale(entry.dataAsOfDate) });
      const recommendation = getRecommendation({ ...entry, flipScore, brrrrScore, appreciationScore, cashFlowScore, riskScore, buyBoxMatch, confidence, warnings });
      const isStale = isStale(entry.dataAsOfDate);

      return {
        ...entry,
        buyBoxMatch,
        flipScore,
        brrrrScore,
        appreciationScore,
        cashFlowScore,
        riskScore,
        royalStarScore,
        rating,
        confidence,
        warnings,
        recommendation,
        isStale,
      };
    });
  }, [neighborhoods]);

  const filteredNeighborhoods = useMemo(() => {
    const search = searchText.trim().toLowerCase();
    let items = [...normalizedNeighborhoods];

    if (search) {
      items = items.filter((item) => {
        const haystack = [item.neighborhoodName, item.city, item.county, item.zipCode].filter(Boolean).join(" ").toLowerCase();
        return haystack.includes(search);
      });
    }

    if (stateFilter !== "All") items = items.filter((item) => item.state === stateFilter);
    if (cityFilter !== "All") items = items.filter((item) => item.city === cityFilter);
    if (countyFilter !== "All") items = items.filter((item) => item.county === countyFilter);
    if (zipFilter !== "All") items = items.filter((item) => item.zipCode === zipFilter);
    if (buyBoxFilter !== "All") items = items.filter((item) => item.buyBoxMatch.label === buyBoxFilter);
    if (ratingFilter !== "All") items = items.filter((item) => item.rating.label === ratingFilter);
    if (strategyFilter !== "All") items = items.filter((item) => item.recommendation.label === strategyFilter);
    if (cycleFilter !== "All") items = items.filter((item) => item.marketCycle === cycleFilter);
    if (favoriteFilter === "Favorites Only") items = items.filter((item) => item.favorite);
    if (minFlipFilter !== "") items = items.filter((item) => item.flipScore >= Number(minFlipFilter));
    if (minBrrrrFilter !== "") items = items.filter((item) => item.brrrrScore >= Number(minBrrrrFilter));
    if (maxRiskFilter !== "") items = items.filter((item) => item.riskScore <= Number(maxRiskFilter));

    items.sort((left, right) => {
      switch (sortBy) {
        case "flipScore":
          return right.flipScore - left.flipScore;
        case "brrrrScore":
          return right.brrrrScore - left.brrrrScore;
        case "appreciationScore":
          return right.appreciationScore - left.appreciationScore;
        case "cashFlowScore":
          return right.cashFlowScore - left.cashFlowScore;
        case "riskScore":
          return left.riskScore - right.riskScore;
        case "medianRent":
          return Number(right.medianRent || 0) - Number(left.medianRent || 0);
        case "appreciation":
          return Number(right.appreciation1Year || 0) - Number(left.appreciation1Year || 0);
        case "newest":
          return (right.createdAt || "").localeCompare(left.createdAt || "");
        default:
          return right.royalStarScore - left.royalStarScore;
      }
    });

    return items;
  }, [normalizedNeighborhoods, searchText, stateFilter, cityFilter, countyFilter, zipFilter, buyBoxFilter, ratingFilter, strategyFilter, cycleFilter, favoriteFilter, minFlipFilter, minBrrrrFilter, maxRiskFilter, sortBy]);

  const selectedNeighborhood = useMemo(() => normalizedNeighborhoods.find((item) => item.id === selectedNeighborhoodId) || null, [normalizedNeighborhoods, selectedNeighborhoodId]);

  const summaryStats = useMemo(() => {
    const total = normalizedNeighborhoods.length;
    const strong = normalizedNeighborhoods.filter((item) => item.buyBoxMatch.label === "Strong Match").length;
    const averageScore = total > 0 ? Math.round(normalizedNeighborhoods.reduce((sum, item) => sum + item.royalStarScore, 0) / total) : 0;
    const highestFlip = [...normalizedNeighborhoods].sort((left, right) => right.flipScore - left.flipScore)[0] || null;
    const highestBrrrr = [...normalizedNeighborhoods].sort((left, right) => right.brrrrScore - left.brrrrScore)[0] || null;
    const highestAppreciation = [...normalizedNeighborhoods].sort((left, right) => right.appreciationScore - left.appreciationScore)[0] || null;
    const lowestRisk = [...normalizedNeighborhoods].sort((left, right) => left.riskScore - right.riskScore)[0] || null;
    const favorites = normalizedNeighborhoods.filter((item) => item.favorite).length;

    return {
      total,
      strong,
      averageScore,
      highestFlip,
      highestBrrrr,
      highestAppreciation,
      lowestRisk,
      favorites,
    };
  }, [normalizedNeighborhoods]);

  const stateOptions = useMemo(() => ["All", ...Array.from(new Set(normalizedNeighborhoods.map((item) => item.state).filter(Boolean))).sort()], [normalizedNeighborhoods]);
  const cityOptions = useMemo(() => ["All", ...Array.from(new Set(normalizedNeighborhoods.map((item) => item.city).filter(Boolean))).sort()], [normalizedNeighborhoods]);
  const countyOptions = useMemo(() => ["All", ...Array.from(new Set(normalizedNeighborhoods.map((item) => item.county).filter(Boolean))).sort()], [normalizedNeighborhoods]);
  const zipOptions = useMemo(() => ["All", ...Array.from(new Set(normalizedNeighborhoods.map((item) => item.zipCode).filter(Boolean))).sort()], [normalizedNeighborhoods]);

  const comparisonItems = useMemo(() => normalizedNeighborhoods.filter((item) => comparisonIds.includes(item.id)), [comparisonIds, normalizedNeighborhoods]);

  const handleFieldChange = (event) => {
    const { name, value, type, checked } = event.target;
    setFormValues((prev) => ({ ...prev, [name]: type === "checkbox" ? checked : value }));
  };

  const handleSelectNeighborhood = (neighborhood) => {
    setSelectedNeighborhoodId(neighborhood.id);
    setFormValues({ ...initialValues, ...neighborhood });
    setMessage({ type: "", text: "" });
  };

  const handleClearForm = () => {
    setSelectedNeighborhoodId("");
    setFormValues(initialValues);
    setMessage({ type: "", text: "" });
  };

  const persistNeighborhood = async (payload, existingNeighborhood = null) => {
    if (existingNeighborhood) {
      try {
        const response = await fetch(buildApiUrl(`/api/neighborhoods/${existingNeighborhood.id}`), {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!response.ok) throw new Error("Unable to update neighborhood");
        return response.json();
      } catch (error) {
        console.error("Unable to update neighborhood via API, using local fallback", error);
        return { ...payload, id: existingNeighborhood.id, createdAt: existingNeighborhood.createdAt, updatedAt: new Date().toISOString() };
      }
    }

    try {
      const response = await fetch(buildApiUrl("/api/neighborhoods"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error("Unable to create neighborhood");
      return response.json();
    } catch (error) {
      console.error("Unable to create neighborhood via API, using local fallback", error);
      return { ...payload, id: createId(), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const errors = validateNeighborhood(formValues);
    if (errors.length > 0) {
      setMessage({ type: "error", text: errors[0] });
      return;
    }

    const existingNeighborhood = neighborhoods.find((item) => item.id === selectedNeighborhoodId);
    const normalizedPayload = normalizeNeighborhoodPayload({ ...formValues, id: existingNeighborhood?.id || "" });
    const savedNeighborhood = await persistNeighborhood(normalizedPayload, existingNeighborhood);
    const nextNeighborhoods = existingNeighborhood ? neighborhoods.map((item) => (item.id === existingNeighborhood.id ? { ...item, ...savedNeighborhood, id: existingNeighborhood.id } : item)) : [...neighborhoods, savedNeighborhood];

    setNeighborhoods(nextNeighborhoods);
    if (typeof window !== "undefined") {
      window.localStorage.setItem("royalStarNeighborhoods", JSON.stringify(nextNeighborhoods));
    }
    setSelectedNeighborhoodId(savedNeighborhood.id);
    setFormValues({ ...initialValues, ...savedNeighborhood, favorite: Boolean(savedNeighborhood.favorite) });
    setMessage({ type: "success", text: existingNeighborhood ? "Neighborhood updated successfully." : "Neighborhood added successfully." });
  };

  const handleDelete = async (neighborhoodId) => {
    const target = neighborhoods.find((item) => item.id === neighborhoodId);
    if (!target) return;

    try {
      const response = await fetch(buildApiUrl(`/api/neighborhoods/${neighborhoodId}`), { method: "DELETE" });
      if (!response.ok) throw new Error("Unable to delete neighborhood");
      const nextNeighborhoods = neighborhoods.filter((item) => item.id !== neighborhoodId);
      setNeighborhoods(nextNeighborhoods);
      if (typeof window !== "undefined") {
        window.localStorage.setItem("royalStarNeighborhoods", JSON.stringify(nextNeighborhoods));
      }
      setSelectedNeighborhoodId("");
      setFormValues(initialValues);
      setMessage({ type: "success", text: "Neighborhood deleted successfully." });
    } catch (error) {
      console.error("Unable to delete neighborhood via API, using local fallback", error);
      const nextNeighborhoods = neighborhoods.filter((item) => item.id !== neighborhoodId);
      setNeighborhoods(nextNeighborhoods);
      if (typeof window !== "undefined") {
        window.localStorage.setItem("royalStarNeighborhoods", JSON.stringify(nextNeighborhoods));
      }
      setSelectedNeighborhoodId("");
      setFormValues(initialValues);
      setMessage({ type: "success", text: "Neighborhood deleted successfully." });
    }
  };

  const handleFavoriteToggle = async (neighborhoodId) => {
    const target = neighborhoods.find((item) => item.id === neighborhoodId);
    if (!target) return;

    const nextNeighborhoods = neighborhoods.map((item) => (item.id === neighborhoodId ? { ...item, favorite: !item.favorite } : item));
    setNeighborhoods(nextNeighborhoods);
    if (typeof window !== "undefined") {
      window.localStorage.setItem("royalStarNeighborhoods", JSON.stringify(nextNeighborhoods));
    }

    try {
      await fetch(buildApiUrl(`/api/neighborhoods/${neighborhoodId}`), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...target, favorite: !target.favorite }),
      });
    } catch (error) {
      console.error("Unable to persist favorite toggle", error);
    }
  };

  const toggleComparison = (neighborhoodId) => {
    setComparisonIds((prev) => {
      if (prev.includes(neighborhoodId)) return prev.filter((id) => id !== neighborhoodId);
      if (prev.length >= 4) return prev.slice(1).concat(neighborhoodId);
      return [...prev, neighborhoodId];
    });
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
            const isCompDatabase = label === "COMP DATABASE";
            const isNeighborhoodDatabase = label === "NEIGHBORHOOD DB";
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
                            : isCompDatabase
                              ? onOpenCompDatabase
                              : isNeighborhoodDatabase
                                ? onOpenNeighborhoodDatabase
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
            <p style={styles.subtitle}>NEIGHBORHOOD DATABASE / BUY-BOX MARKET ANALYSIS</p>
          </div>
          <div style={styles.headerActions}>
            <button type="button" style={styles.secondaryButton} onClick={onOpenDealAnalyzer}>DEAL ANALYZER</button>
            <button type="button" style={styles.primaryButton} onClick={onOpenFlipAnalyzer}>FLIP ANALYZER</button>
            <button type="button" style={styles.primaryButton} onClick={onOpenBrrrrAnalyzer}>BRRRR ANALYZER</button>
            <button type="button" style={styles.secondaryButton} onClick={onOpenCompDatabase}>COMP DATABASE</button>
            <button type="button" style={styles.secondaryButton} onClick={onOpenDealIntelligence}>DEAL INTELLIGENCE</button>
          </div>
        </section>

        <section style={styles.summaryPanel}>
          <div style={styles.summaryHeader}>
            <div>
              <h2 style={styles.panelTitle}>NEIGHBORHOOD DATABASE</h2>
              <p style={styles.panelCopy}>Track neighborhood fundamentals, buy-box fit, risk, and Royal Star scoring.</p>
            </div>
            <div style={styles.connectionBadge}>{connectionState}</div>
          </div>
          <div style={styles.summaryCards}>
            <SummaryCard label="Total Neighborhoods" value={summaryStats.total} />
            <SummaryCard label="Strong Buy Box Matches" value={summaryStats.strong} />
            <SummaryCard label="Average Royal Star Score" value={summaryStats.averageScore} />
            <SummaryCard label="Highest Flip Score" value={summaryStats.highestFlip ? `${summaryStats.highestFlip.flipScore}` : "—"} />
            <SummaryCard label="Highest BRRRR Score" value={summaryStats.highestBrrrr ? `${summaryStats.highestBrrrr.brrrrScore}` : "—"} />
            <SummaryCard label="Highest Appreciation Score" value={summaryStats.highestAppreciation ? `${summaryStats.highestAppreciation.appreciationScore}` : "—"} />
            <SummaryCard label="Lowest Risk Neighborhood" value={summaryStats.lowestRisk ? `${summaryStats.lowestRisk.neighborhoodName}` : "—"} />
            <SummaryCard label="Favorite Neighborhoods" value={summaryStats.favorites} />
          </div>
        </section>

        <section style={styles.filtersSection}>
          <input style={styles.input} value={searchText} onChange={(event) => setSearchText(event.target.value)} placeholder="Search neighborhood name, city, county, or ZIP" />
          <select style={styles.select} value={stateFilter} onChange={(event) => setStateFilter(event.target.value)}>
            {stateOptions.map((option) => (
              <option key={option} value={option}>{option === "All" ? "All States" : option}</option>
            ))}
          </select>
          <select style={styles.select} value={cityFilter} onChange={(event) => setCityFilter(event.target.value)}>
            {cityOptions.map((option) => (
              <option key={option} value={option}>{option === "All" ? "All Cities" : option}</option>
            ))}
          </select>
          <select style={styles.select} value={countyFilter} onChange={(event) => setCountyFilter(event.target.value)}>
            {countyOptions.map((option) => (
              <option key={option} value={option}>{option === "All" ? "All Counties" : option}</option>
            ))}
          </select>
          <select style={styles.select} value={zipFilter} onChange={(event) => setZipFilter(event.target.value)}>
            {zipOptions.map((option) => (
              <option key={option} value={option}>{option === "All" ? "All ZIPs" : option}</option>
            ))}
          </select>
          <select style={styles.select} value={buyBoxFilter} onChange={(event) => setBuyBoxFilter(event.target.value)}>
            {buyBoxOptions.map((option) => (
              <option key={option} value={option}>{option === "All" ? "All Buy-Box Matches" : option}</option>
            ))}
          </select>
          <select style={styles.select} value={ratingFilter} onChange={(event) => setRatingFilter(event.target.value)}>
            {overallRatingOptions.map((option) => (
              <option key={option} value={option}>{option === "All" ? "All Ratings" : option}</option>
            ))}
          </select>
          <select style={styles.select} value={strategyFilter} onChange={(event) => setStrategyFilter(event.target.value)}>
            {strategyOptions.map((option) => (
              <option key={option} value={option}>{option === "All" ? "All Strategies" : option}</option>
            ))}
          </select>
          <select style={styles.select} value={cycleFilter} onChange={(event) => setCycleFilter(event.target.value)}>
            <option value="All">All Market Cycles</option>
            {marketCycleOptions.map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
          <select style={styles.select} value={favoriteFilter} onChange={(event) => setFavoriteFilter(event.target.value)}>
            {favoriteOptions.map((option) => (
              <option key={option} value={option}>{option === "All" ? "All Favorites" : option}</option>
            ))}
          </select>
          <input style={styles.input} value={minFlipFilter} onChange={(event) => setMinFlipFilter(event.target.value)} placeholder="Min Flip" />
          <input style={styles.input} value={minBrrrrFilter} onChange={(event) => setMinBrrrrFilter(event.target.value)} placeholder="Min BRRRR" />
          <input style={styles.input} value={maxRiskFilter} onChange={(event) => setMaxRiskFilter(event.target.value)} placeholder="Max Risk" />
          <select style={styles.select} value={sortBy} onChange={(event) => setSortBy(event.target.value)}>
            {sortOptions.map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </section>

        <section style={styles.contentGrid}>
          <div style={styles.formCard}>
            <div style={styles.cardHeader}>
              <h3 style={styles.cardTitle}>NEIGHBORHOOD FORM</h3>
              <div style={styles.buttonGroup}>
                <button type="button" style={styles.secondaryButton} onClick={handleClearForm}>CLEAR FORM</button>
                <button type="submit" form="neighborhood-form" style={styles.primaryButton}>{selectedNeighborhoodId ? "UPDATE" : "ADD"}</button>
              </div>
            </div>
            {message.text ? <div style={message.type === "success" ? styles.success : styles.error}>{message.text}</div> : null}
            <form id="neighborhood-form" onSubmit={handleSubmit} style={styles.formGrid}>
              <label style={styles.field}>
                <span style={styles.fieldLabel}>Neighborhood Name</span>
                <input name="neighborhoodName" value={formValues.neighborhoodName} onChange={handleFieldChange} style={styles.input} />
              </label>
              <label style={styles.field}>
                <span style={styles.fieldLabel}>City</span>
                <input name="city" value={formValues.city} onChange={handleFieldChange} style={styles.input} />
              </label>
              <label style={styles.field}>
                <span style={styles.fieldLabel}>County</span>
                <input name="county" value={formValues.county} onChange={handleFieldChange} style={styles.input} />
              </label>
              <label style={styles.field}>
                <span style={styles.fieldLabel}>State</span>
                <input name="state" value={formValues.state} onChange={handleFieldChange} style={styles.input} />
              </label>
              <label style={styles.field}>
                <span style={styles.fieldLabel}>ZIP Code</span>
                <input name="zipCode" value={formValues.zipCode} onChange={handleFieldChange} style={styles.input} />
              </label>
              <label style={styles.field}>
                <span style={styles.fieldLabel}>Census Tract</span>
                <input name="censusTract" value={formValues.censusTract} onChange={handleFieldChange} style={styles.input} />
              </label>
              <label style={styles.field}>
                <span style={styles.fieldLabel}>Latitude</span>
                <input name="latitude" type="number" step="0.0001" value={formValues.latitude} onChange={handleFieldChange} style={styles.input} />
              </label>
              <label style={styles.field}>
                <span style={styles.fieldLabel}>Longitude</span>
                <input name="longitude" type="number" step="0.0001" value={formValues.longitude} onChange={handleFieldChange} style={styles.input} />
              </label>
              <label style={styles.field}>
                <span style={styles.fieldLabel}>School District</span>
                <input name="schoolDistrict" value={formValues.schoolDistrict} onChange={handleFieldChange} style={styles.input} />
              </label>
              <label style={styles.field}>
                <span style={styles.fieldLabel}>Median Home Value</span>
                <input name="medianHomeValue" type="number" value={formValues.medianHomeValue} onChange={handleFieldChange} style={styles.input} />
              </label>
              <label style={styles.field}>
                <span style={styles.fieldLabel}>Median Rent</span>
                <input name="medianRent" type="number" value={formValues.medianRent} onChange={handleFieldChange} style={styles.input} />
              </label>
              <label style={styles.field}>
                <span style={styles.fieldLabel}>Average Rent</span>
                <input name="averageRent" type="number" value={formValues.averageRent} onChange={handleFieldChange} style={styles.input} />
              </label>
              <label style={styles.field}>
                <span style={styles.fieldLabel}>Rent Growth 1Y</span>
                <input name="rentGrowth1Year" type="number" value={formValues.rentGrowth1Year} onChange={handleFieldChange} style={styles.input} />
              </label>
              <label style={styles.field}>
                <span style={styles.fieldLabel}>Rent Growth 3Y</span>
                <input name="rentGrowth3Year" type="number" value={formValues.rentGrowth3Year} onChange={handleFieldChange} style={styles.input} />
              </label>
              <label style={styles.field}>
                <span style={styles.fieldLabel}>Appreciation 1Y</span>
                <input name="appreciation1Year" type="number" value={formValues.appreciation1Year} onChange={handleFieldChange} style={styles.input} />
              </label>
              <label style={styles.field}>
                <span style={styles.fieldLabel}>Appreciation 3Y</span>
                <input name="appreciation3Year" type="number" value={formValues.appreciation3Year} onChange={handleFieldChange} style={styles.input} />
              </label>
              <label style={styles.field}>
                <span style={styles.fieldLabel}>Appreciation 5Y</span>
                <input name="appreciation5Year" type="number" value={formValues.appreciation5Year} onChange={handleFieldChange} style={styles.input} />
              </label>
              <label style={styles.field}>
                <span style={styles.fieldLabel}>Appreciation 10Y</span>
                <input name="appreciation10Year" type="number" value={formValues.appreciation10Year} onChange={handleFieldChange} style={styles.input} />
              </label>
              <label style={styles.field}>
                <span style={styles.fieldLabel}>Days on Market</span>
                <input name="averageDaysOnMarket" type="number" value={formValues.averageDaysOnMarket} onChange={handleFieldChange} style={styles.input} />
              </label>
              <label style={styles.field}>
                <span style={styles.fieldLabel}>Median Price / Sq Ft</span>
                <input name="medianPricePerSquareFoot" type="number" value={formValues.medianPricePerSquareFoot} onChange={handleFieldChange} style={styles.input} />
              </label>
              <label style={styles.field}>
                <span style={styles.fieldLabel}>Active Inventory</span>
                <input name="activeInventory" type="number" value={formValues.activeInventory} onChange={handleFieldChange} style={styles.input} />
              </label>
              <label style={styles.field}>
                <span style={styles.fieldLabel}>Months of Supply</span>
                <input name="monthsOfSupply" type="number" value={formValues.monthsOfSupply} onChange={handleFieldChange} style={styles.input} />
              </label>
              <label style={styles.field}>
                <span style={styles.fieldLabel}>Vacancy Rate</span>
                <input name="vacancyRate" type="number" value={formValues.vacancyRate} onChange={handleFieldChange} style={styles.input} />
              </label>
              <label style={styles.field}>
                <span style={styles.fieldLabel}>Owner Occupancy Rate</span>
                <input name="ownerOccupancyRate" type="number" value={formValues.ownerOccupancyRate} onChange={handleFieldChange} style={styles.input} />
              </label>
              <label style={styles.field}>
                <span style={styles.fieldLabel}>Population</span>
                <input name="population" type="number" value={formValues.population} onChange={handleFieldChange} style={styles.input} />
              </label>
              <label style={styles.field}>
                <span style={styles.fieldLabel}>Population Growth</span>
                <input name="populationGrowth" type="number" value={formValues.populationGrowth} onChange={handleFieldChange} style={styles.input} />
              </label>
              <label style={styles.field}>
                <span style={styles.fieldLabel}>Median Household Income</span>
                <input name="medianHouseholdIncome" type="number" value={formValues.medianHouseholdIncome} onChange={handleFieldChange} style={styles.input} />
              </label>
              <label style={styles.field}>
                <span style={styles.fieldLabel}>Income Growth</span>
                <input name="incomeGrowth" type="number" value={formValues.incomeGrowth} onChange={handleFieldChange} style={styles.input} />
              </label>
              <label style={styles.field}>
                <span style={styles.fieldLabel}>Employment Growth</span>
                <input name="employmentGrowth" type="number" value={formValues.employmentGrowth} onChange={handleFieldChange} style={styles.input} />
              </label>
              <label style={styles.field}>
                <span style={styles.fieldLabel}>Crime Rating</span>
                <select name="crimeRating" value={formValues.crimeRating} onChange={handleFieldChange} style={styles.select}>
                  {crimeRatingOptions.map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </label>
              <label style={styles.field}>
                <span style={styles.fieldLabel}>School Rating (0–10)</span>
                <input name="schoolRating" type="number" min="0" max="10" step="0.1" value={formValues.schoolRating} onChange={handleFieldChange} style={styles.input} />
              </label>
              <label style={styles.field}>
                <span style={styles.fieldLabel}>Investor Demand Score</span>
                <input name="investorDemandScore" type="number" value={formValues.investorDemandScore} onChange={handleFieldChange} style={styles.input} />
              </label>
              <label style={styles.field}>
                <span style={styles.fieldLabel}>Rental Demand Score</span>
                <input name="rentalDemandScore" type="number" value={formValues.rentalDemandScore} onChange={handleFieldChange} style={styles.input} />
              </label>
              <label style={styles.field}>
                <span style={styles.fieldLabel}>Market Cycle</span>
                <select name="marketCycle" value={formValues.marketCycle} onChange={handleFieldChange} style={styles.select}>
                  {marketCycleOptions.map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </label>
              <label style={styles.field}>
                <span style={styles.fieldLabel}>Favorite</span>
                <input name="favorite" type="checkbox" checked={Boolean(formValues.favorite)} onChange={handleFieldChange} style={styles.checkbox} />
              </label>
              <label style={styles.field}>
                <span style={styles.fieldLabel}>Map URL</span>
                <input name="mapUrl" value={formValues.mapUrl} onChange={handleFieldChange} style={styles.input} />
              </label>
              <label style={styles.field}>
                <span style={styles.fieldLabel}>Data Source</span>
                <input name="dataSource" value={formValues.dataSource} onChange={handleFieldChange} style={styles.input} />
              </label>
              <label style={styles.field}>
                <span style={styles.fieldLabel}>Source URL</span>
                <input name="sourceUrl" value={formValues.sourceUrl} onChange={handleFieldChange} style={styles.input} />
              </label>
              <label style={styles.field}>
                <span style={styles.fieldLabel}>Data As Of Date</span>
                <input name="dataAsOfDate" type="date" value={formValues.dataAsOfDate} onChange={handleFieldChange} style={styles.input} />
              </label>
              <label style={{ ...styles.field, gridColumn: "1 / -1" }}>
                <span style={styles.fieldLabel}>Notes</span>
                <textarea name="notes" value={formValues.notes} onChange={handleFieldChange} style={{ ...styles.input, minHeight: 90 }} />
              </label>
            </form>
          </div>

          <div style={styles.listSection}>
            <div style={styles.cardHeader}>
              <h3 style={styles.cardTitle}>NEIGHBORHOOD LIST</h3>
              <div style={styles.buttonGroup}>
                <button type="button" style={styles.secondaryButton} onClick={() => setComparisonIds([])}>CLEAR COMPARISON</button>
                <button type="button" style={styles.primaryButton} onClick={() => setSelectedNeighborhoodId("")}>ADD NEW</button>
              </div>
            </div>
            {filteredNeighborhoods.length === 0 ? (
              <div style={styles.emptyState}>
                <div style={styles.emptyTitle}>No neighborhood data available</div>
                <div style={styles.emptyCopy}>Add a neighborhood to begin tracking Royal Star market opportunities.</div>
                <button type="button" style={styles.primaryButton} onClick={handleClearForm}>Add Neighborhood</button>
              </div>
            ) : (
              <div style={styles.tableList}>
                {filteredNeighborhoods.map((item) => (
                  <div key={item.id} style={styles.listItem}>
                    <div style={styles.listHeader}>
                      <div>
                        <div style={styles.listTitleRow}>
                          <strong>{item.neighborhoodName || "Unnamed Neighborhood"}</strong>
                          <button type="button" style={styles.favoriteButton} onClick={() => handleFavoriteToggle(item.id)}>{item.favorite ? "★" : "☆"}</button>
                        </div>
                        <div style={styles.listMeta}>{item.city}, {item.state} · ZIP {item.zipCode}</div>
                      </div>
                      <div style={{ ...styles.ratingPill, borderColor: item.rating.color }}>{item.rating.label}</div>
                    </div>
                    <div style={styles.metricGrid}>
                      <div style={styles.metricCell}><span style={styles.metricLabel}>Median Home Value</span><div>{formatCurrency(item.medianHomeValue)}</div></div>
                      <div style={styles.metricCell}><span style={styles.metricLabel}>Median Rent</span><div>{formatCurrency(item.medianRent)}</div></div>
                      <div style={styles.metricCell}><span style={styles.metricLabel}>Vacancy</span><div>{formatPercent(item.vacancyRate)}</div></div>
                      <div style={styles.metricCell}><span style={styles.metricLabel}>Appreciation</span><div>{formatPercent(item.appreciation1Year)}</div></div>
                      <div style={styles.metricCell}><span style={styles.metricLabel}>Buy Box</span><div>{item.buyBoxMatch.label}</div></div>
                      <div style={styles.metricCell}><span style={styles.metricLabel}>Flip</span><div>{item.flipScore}</div></div>
                      <div style={styles.metricCell}><span style={styles.metricLabel}>BRRRR</span><div>{item.brrrrScore}</div></div>
                      <div style={styles.metricCell}><span style={styles.metricLabel}>Risk</span><div>{item.riskScore}</div></div>
                      <div style={styles.metricCell}><span style={styles.metricLabel}>Royal Star</span><div>{item.royalStarScore}</div></div>
                      <div style={styles.metricCell}><span style={styles.metricLabel}>Strategy</span><div>{item.recommendation.label}</div></div>
                      <div style={styles.metricCell}><span style={styles.metricLabel}>Confidence</span><div>{item.confidence}</div></div>
                    </div>
                    <div style={styles.actionRow}>
                      <button type="button" style={styles.secondaryButton} onClick={() => setSelectedNeighborhoodId(item.id)}>View</button>
                      <button type="button" style={styles.secondaryButton} onClick={() => handleSelectNeighborhood(item)}>Edit</button>
                      <button type="button" style={styles.secondaryButton} onClick={() => handleDelete(item.id)}>Delete</button>
                      <button type="button" style={styles.secondaryButton} onClick={() => toggleComparison(item.id)}>{comparisonIds.includes(item.id) ? "Remove from Comparison" : "Add to Comparison"}</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {selectedNeighborhood ? (
          <section style={styles.detailPanel}>
            <div style={styles.cardHeader}>
              <h3 style={styles.cardTitle}>{selectedNeighborhood.neighborhoodName}</h3>
              <div style={styles.buttonGroup}>
                <button type="button" style={styles.secondaryButton} onClick={() => handleSelectNeighborhood(selectedNeighborhood)}>EDIT</button>
                <button type="button" style={styles.secondaryButton} onClick={() => handleDelete(selectedNeighborhood.id)}>DELETE</button>
              </div>
            </div>
            <div style={styles.detailGrid}>
              <div style={styles.detailCard}>
                <div style={styles.detailHeading}>Market Snapshot</div>
                <div>{selectedNeighborhood.city}, {selectedNeighborhood.state} · {selectedNeighborhood.county} · ZIP {selectedNeighborhood.zipCode}</div>
                <div>{selectedNeighborhood.schoolDistrict ? `School District: ${selectedNeighborhood.schoolDistrict}` : "School district not available"}</div>
                <div>{selectedNeighborhood.mapUrl ? <a href={selectedNeighborhood.mapUrl} target="_blank" rel="noreferrer" style={styles.link}>Open Map Link</a> : "No Map Link"}</div>
                <div>{selectedNeighborhood.sourceUrl ? <a href={selectedNeighborhood.sourceUrl} target="_blank" rel="noreferrer" style={styles.link}>Open Source Link</a> : "No Source Link"}</div>
                <div>Data as of {formatDate(selectedNeighborhood.dataAsOfDate) || "Not available"}</div>
              </div>
              <div style={styles.detailCard}>
                <div style={styles.detailHeading}>Score Explanations</div>
                <div><strong>Flip Score:</strong> {selectedNeighborhood.flipScore}/100</div>
                <div><strong>BRRRR Score:</strong> {selectedNeighborhood.brrrrScore}/100</div>
                <div><strong>Appreciation Score:</strong> {selectedNeighborhood.appreciationScore}/100</div>
                <div><strong>Cash Flow Score:</strong> {selectedNeighborhood.cashFlowScore}/100</div>
                <div><strong>Risk Score:</strong> {selectedNeighborhood.riskScore}/100</div>
              </div>
              <div style={styles.detailCard}>
                <div style={styles.detailHeading}>Strategy Recommendation</div>
                <div><strong>{selectedNeighborhood.recommendation.label}</strong></div>
                <div>{selectedNeighborhood.recommendation.explanation}</div>
              </div>
              <div style={styles.detailCard}>
                <div style={styles.detailHeading}>Buy Box Match</div>
                <div><strong>{selectedNeighborhood.buyBoxMatch.label}</strong></div>
                <div>{selectedNeighborhood.buyBoxMatch.explanation}</div>
              </div>
              <div style={styles.detailCard}>
                <div style={styles.detailHeading}>Strengths</div>
                {getStrengths(selectedNeighborhood).map((item) => <div key={item}>• {item}</div>)}
              </div>
              <div style={styles.detailCard}>
                <div style={styles.detailHeading}>Weaknesses</div>
                {getWeaknesses(selectedNeighborhood).map((item) => <div key={item}>• {item}</div>)}
              </div>
              <div style={styles.detailCard}>
                <div style={styles.detailHeading}>Opportunities</div>
                {getOpportunities(selectedNeighborhood).map((item) => <div key={item}>• {item}</div>)}
              </div>
              <div style={styles.detailCard}>
                <div style={styles.detailHeading}>Risks</div>
                {getRisks(selectedNeighborhood).map((item) => <div key={item}>• {item}</div>)}
              </div>
              <div style={styles.detailCard}>
                <div style={styles.detailHeading}>Warnings</div>
                {selectedNeighborhood.warnings.length > 0 ? selectedNeighborhood.warnings.map((item) => <div key={item}>• {item}</div>) : <div>No major warnings.</div>}
              </div>
              <div style={styles.detailCard}>
                <div style={styles.detailHeading}>Comparable ZIP Suggestions</div>
                {getSuggestions(normalizedNeighborhoods, selectedNeighborhood).map((item) => (
                  <div key={item.id}>• {item.neighborhoodName} · {item.city} · {item.zipCode}</div>
                ))}
              </div>
              <div style={{ ...styles.detailCard, gridColumn: "1 / -1" }}>
                <div style={styles.detailHeading}>Notes</div>
                <div>{selectedNeighborhood.notes || "No notes yet."}</div>
              </div>
            </div>
          </section>
        ) : null}

        {comparisonItems.length > 0 ? (
          <section style={styles.comparisonPanel}>
            <div style={styles.cardHeader}>
              <h3 style={styles.cardTitle}>COMPARISON TOOL</h3>
              <div style={styles.buttonGroup}>
                <button type="button" style={styles.secondaryButton} onClick={() => setComparisonIds([])}>CLEAR</button>
              </div>
            </div>
            {comparisonItems.some((item) => item.confidence === "Low") ? <div style={styles.warningBox}>Comparison warning: one or more neighborhoods have low confidence and should not be over-interpreted.</div> : null}
            <div style={styles.comparisonTable}>
              <div style={styles.comparisonHeader}>Metric</div>
              {comparisonItems.map((item) => (
                <div key={item.id} style={styles.comparisonHeader}>{item.neighborhoodName}</div>
              ))}
              {[
                ["Median Home Value", (item) => formatCurrency(item.medianHomeValue)],
                ["Median Rent", (item) => formatCurrency(item.medianRent)],
                ["Rent Growth", (item) => formatPercent(item.rentGrowth1Year)],
                ["Appreciation", (item) => formatPercent(item.appreciation1Year)],
                ["Vacancy", (item) => formatPercent(item.vacancyRate)],
                ["Population Growth", (item) => formatPercent(item.populationGrowth)],
                ["Income Growth", (item) => formatPercent(item.incomeGrowth)],
                ["Employment Growth", (item) => formatPercent(item.employmentGrowth)],
                ["Crime Risk", (item) => item.crimeRating],
                ["School Rating", (item) => item.schoolRating === "" ? "—" : item.schoolRating],
                ["Flip Score", (item) => item.flipScore],
                ["BRRRR Score", (item) => item.brrrrScore],
                ["Risk Score", (item) => item.riskScore],
                ["Royal Star Score", (item) => item.royalStarScore],
              ].map(([label, renderValue]) => {
                const values = comparisonItems.map((item) => ({ item, value: renderValue(item) }));
                return (
                  <>
                    <div key={`${label}-label`} style={styles.comparisonCell}>{label}</div>
                    {values.map(({ item, value }) => <div key={`${item.id}-${label}`} style={styles.comparisonCell}>{value}</div>)}
                  </>
                );
              })}
            </div>
          </section>
        ) : null}
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

const styles = {
  page: {
    minHeight: "100vh",
    background: "#0f0f0f",
    color: "#f6e3aa",
    display: "flex",
    fontFamily: "Arial, sans-serif",
  },
  sidebar: {
    width: 260,
    background: "linear-gradient(180deg, #111 0%, #1b1408 100%)",
    borderRight: "1px solid #8b6a20",
    padding: "24px 18px",
    display: "flex",
    flexDirection: "column",
    gap: 16,
  },
  logoArea: { display: "flex", justifyContent: "center", marginBottom: 8 },
  logo: { width: 140, height: "auto" },
  nav: { display: "flex", flexDirection: "column", gap: 8 },
  navButton: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    background: "transparent",
    border: "none",
    color: "#f6e3aa",
    padding: "10px 8px",
    textAlign: "left",
    borderRadius: 6,
    cursor: "pointer",
  },
  navIcon: { fontSize: 18 },
  navTab: { width: 4, height: 18, background: "#b68a1b", borderRadius: 4, marginLeft: "auto" },
  logout: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    background: "#b68a1b",
    border: "none",
    color: "#111",
    padding: "10px 8px",
    borderRadius: 6,
    fontWeight: 700,
    cursor: "pointer",
    marginTop: 8,
  },
  smallMark: { marginTop: "auto", textAlign: "center", fontSize: 24, color: "#b68a1b", letterSpacing: 3 },
  main: { flex: 1, padding: 24, display: "flex", flexDirection: "column", gap: 20 },
  topBar: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, borderBottom: "1px solid #8b6a20", paddingBottom: 12 },
  backButton: { background: "transparent", border: "1px solid #b68a1b", color: "#f6e3aa", padding: "8px 12px", borderRadius: 6, cursor: "pointer" },
  headingBlock: { flex: 1 },
  company: { margin: 0, fontSize: 26, color: "#fff0c7" },
  subtitle: { margin: "2px 0 0", color: "#b68a1b", fontSize: 14, letterSpacing: 1.5 },
  headerActions: { display: "flex", gap: 10, flexWrap: "wrap" },
  primaryButton: { background: "#b68a1b", border: "none", color: "#111", padding: "8px 12px", borderRadius: 6, cursor: "pointer", fontWeight: 700 },
  secondaryButton: { background: "transparent", border: "1px solid #b68a1b", color: "#f6e3aa", padding: "8px 12px", borderRadius: 6, cursor: "pointer" },
  summaryPanel: { background: "#16110a", border: "1px solid #8b6a20", borderRadius: 10, padding: 16 },
  summaryHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  panelTitle: { margin: 0, fontSize: 18 },
  panelCopy: { margin: "4px 0 0", color: "#c3aa66" },
  connectionBadge: { border: "1px solid #b68a1b", padding: "6px 10px", borderRadius: 999, fontSize: 12, color: "#f6e3aa" },
  summaryCards: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10 },
  summaryCard: { border: "1px solid #3b2b10", background: "#1d160d", borderRadius: 8, padding: 12 },
  summaryLabel: { color: "#c3aa66", fontSize: 12, textTransform: "uppercase" },
  summaryValue: { fontSize: 18, fontWeight: 700, marginTop: 4 },
  filtersSection: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 10, background: "#16110a", border: "1px solid #8b6a20", padding: 12, borderRadius: 10 },
  input: { background: "#0f0f0f", border: "1px solid #5b4424", color: "#f6e3aa", padding: "8px 10px", borderRadius: 6, width: "100%", boxSizing: "border-box" },
  select: { background: "#0f0f0f", border: "1px solid #5b4424", color: "#f6e3aa", padding: "8px 10px", borderRadius: 6, width: "100%" },
  checkbox: { width: 18, height: 18, accentColor: "#b68a1b" },
  contentGrid: { display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: 20 },
  formCard: { background: "#16110a", border: "1px solid #8b6a20", borderRadius: 10, padding: 16 },
  listSection: { background: "#16110a", border: "1px solid #8b6a20", borderRadius: 10, padding: 16, display: "flex", flexDirection: "column", gap: 12 },
  cardHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  cardTitle: { margin: 0, fontSize: 16, letterSpacing: 1.3 },
  buttonGroup: { display: "flex", gap: 8 },
  success: { background: "#183b24", color: "#a6f5c3", padding: "8px 10px", borderRadius: 6, marginBottom: 10 },
  error: { background: "#4b1712", color: "#ffd8d8", padding: "8px 10px", borderRadius: 6, marginBottom: 10 },
  formGrid: { display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10 },
  field: { display: "flex", flexDirection: "column", gap: 6 },
  fieldLabel: { color: "#c3aa66", fontSize: 12, textTransform: "uppercase" },
  emptyState: { border: "1px dashed #5b4424", borderRadius: 8, padding: 20, textAlign: "center", color: "#c3aa66" },
  emptyTitle: { fontSize: 16, fontWeight: 700, color: "#f6e3aa", marginBottom: 6 },
  emptyCopy: { marginBottom: 10 },
  tableList: { display: "flex", flexDirection: "column", gap: 10, maxHeight: 760, overflowY: "auto" },
  listItem: { border: "1px solid #3b2b10", borderRadius: 8, padding: 12, background: "#1d160d" },
  listHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  listTitleRow: { display: "flex", alignItems: "center", gap: 8 },
  listMeta: { color: "#c3aa66", fontSize: 12, marginTop: 2 },
  favoriteButton: { background: "transparent", border: "none", color: "#f4c542", fontSize: 20, cursor: "pointer" },
  ratingPill: { border: "1px solid #b68a1b", padding: "4px 8px", borderRadius: 999, fontSize: 12 },
  metricGrid: { display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 8, marginBottom: 8 },
  metricCell: { borderTop: "1px solid #3b2b10", paddingTop: 6, fontSize: 12 },
  metricLabel: { color: "#c3aa66", display: "block", marginBottom: 2 },
  actionRow: { display: "flex", gap: 8, flexWrap: "wrap" },
  detailPanel: { background: "#16110a", border: "1px solid #8b6a20", borderRadius: 10, padding: 16, display: "flex", flexDirection: "column", gap: 12 },
  detailGrid: { display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12 },
  detailCard: { border: "1px solid #3b2b10", borderRadius: 8, padding: 12, background: "#1d160d" },
  detailHeading: { fontWeight: 700, color: "#f6e3aa", marginBottom: 6 },
  link: { color: "#f4c542", textDecoration: "underline" },
  comparisonPanel: { background: "#16110a", border: "1px solid #8b6a20", borderRadius: 10, padding: 16 },
  comparisonTable: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 8, marginTop: 10 },
  comparisonHeader: { fontWeight: 700, color: "#f6e3aa", borderBottom: "1px solid #3b2b10", paddingBottom: 6 },
  comparisonCell: { borderBottom: "1px solid #3b2b10", paddingBottom: 6, fontSize: 13 },
  warningBox: { background: "#4b1712", color: "#ffd8d8", padding: "8px 10px", borderRadius: 6, marginTop: 8 },
};
