import test from "node:test";
import assert from "node:assert/strict";
import { buildArvIntelligence, buildBuyBoxIntelligence, buildOfferIntelligence, buildAppraisalIntelligence } from "./intelligenceUpgradeEngine.js";

test("buildArvIntelligence returns safe defaults for empty input", () => {
  const arv = buildArvIntelligence({}, [], []);
  assert.equal(arv.confidenceLevel, "Insufficient Data");
  assert.equal(arv.supportedLowArv, 0);
  assert.equal(arv.supportedBaseArv, 0);
  assert.equal(arv.supportedHighArv, 0);
  assert.equal(arv.compEvaluations.length, 0);
});

test("buildArvIntelligence handles a single supported comp without crashing", () => {
  const result = buildArvIntelligence({
    propertyAddress: "123 Main St",
    city: "Cincinnati",
    state: "OH",
    zipCode: "45211",
    propertyType: "Single Family",
    bedrooms: 3,
    bathrooms: 2,
    squareFeet: 1800,
    yearBuilt: 1955,
    condition: "Average",
  }, [{
    compAddress: "124 Main St",
    salePrice: "220000",
    saleDate: "2024-01-15",
    squareFeet: "1750",
    bedrooms: 3,
    bathrooms: 2,
    yearBuilt: 1955,
    condition: "Average",
    zipCode: "45211",
    neighborhood: "Northside",
    propertyType: "Single Family",
    distanceMiles: 1.4,
  }], []);

  assert.equal(result.compEvaluations.length, 1);
  assert.ok(result.supportedBaseArv > 0);
  assert.ok(result.confidenceLevel === "Low" || result.confidenceLevel === "Insufficient Data");
});

test("buildBuyBoxIntelligence rejects prohibited property types", () => {
  const result = buildBuyBoxIntelligence({
    zipCode: "45211",
    propertyType: "Land",
    rehabBudget: 50000,
    squareFeet: 1200,
    yearBuilt: 1950,
    strategy: "Flip",
  }, []);

  assert.equal(result.decision, "Automatic Reject");
  assert.ok(result.rulesFailed.some((rule) => rule.includes("property type")));
});

test("buildOfferIntelligence keeps maximum offer at or below walk-away", () => {
  const offer = buildOfferIntelligence({
    askingPrice: 220000,
    purchasePrice: 200000,
    rehabBudget: 40000,
    strategy: "Flip",
    squareFeet: 1800,
  }, {
    supportedBaseArv: 260000,
    confidenceLevel: "Moderate",
  }, {
    decision: "Pass",
  }, {
    loanAmount: 0,
  });

  assert.ok(offer.maximumOffer <= offer.walkAwayPrice);
  assert.equal(offer.offerPositions.length, 4);
});

test("buildAppraisalIntelligence surfaces critical risk for weak support", () => {
  const appraisal = buildAppraisalIntelligence({
    address: "100 Main",
    city: "Covington",
    state: "KY",
    zipCode: "41011",
    supportedARV: 260000,
    requestedARV: 360000,
  }, [{
    salePrice: 180000,
    saleDate: "2018-01-01",
    squareFeet: 1600,
    distanceMiles: 12,
    included: false,
  }]);

  assert.equal(appraisal.riskLevel, "Critical Risk");
  assert.ok(appraisal.appraiserQuestions.length > 0);
});

test("buildBuyBoxIntelligence provides explainable market and neighborhood scoring", () => {
  const result = buildBuyBoxIntelligence({
    zipCode: "45211",
    propertyType: "Single Family",
    rehabBudget: 45000,
    squareFeet: 1900,
    yearBuilt: 1960,
    strategy: "Flip",
    purchasePrice: 160000,
  }, [{
    neighborhoodName: "Northside",
    city: "Cincinnati",
    zipCode: "45211",
    rentalDemandScore: 78,
    appreciation1Year: 6.5,
    crimeRating: "Low",
    liquidityScore: 80,
    averageDaysOnMarket: 28,
  }]);

  assert.equal(result.decision, "Strong Pass");
  assert.ok(result.scoringBreakdown.some((item) => item.category === "Property"));
  assert.ok(result.scoringBreakdown.some((item) => item.category === "Market"));
  assert.ok(result.scoringBreakdown.some((item) => item.category === "Neighborhood"));
  assert.ok(result.scoringExplanation.includes("Primary market"));
  assert.ok(result.marketScore > result.propertyLevelScore);
});
