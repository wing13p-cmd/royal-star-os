import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { evaluateRoyalStarBuyBox, normalizeBuyBoxPropertyType, normalizeBuyBoxZip } from "./royalStarBuyBoxEngine.js";
import { buildUnifiedUnderwritingIntelligence } from "./intelligenceUpgradeEngine.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const engineSource = fs.readFileSync(path.join(__dirname, "intelligenceUpgradeEngine.js"), "utf8");

const cleanDeal = {
  zipCode: "45211",
  city: "Cincinnati",
  state: "OH",
  propertyType: "Single Family",
  squareFeet: 1400,
  yearBuilt: 1960,
  rehabBudget: 60000,
  estimatedArv: 275000,
  purchasePrice: 120000,
  strategy: "Flip",
};

const cleanOffer = {
  maximumOffer: 147000,
  targetOffer: 139650,
  walkAwayPrice: 147000,
  sensitivity: { worst: { maximumAllowableOffer: 134350 } },
  assumptions: { explicitHoldingCosts: 6000 },
  hardStopReasons: [],
  reviewReasons: [],
};

const evaluate = (deal = {}, offer = cleanOffer) => evaluateRoyalStarBuyBox({ ...cleanDeal, ...deal }, { offer });

test("Cincinnati primary ZIP clean deal passes", () => assert.equal(evaluate().status, "PASS"));
test("Covington primary ZIP clean deal passes", () => assert.equal(evaluate({ zipCode: "41011", city: "Covington", state: "KY" }).status, "PASS"));
test("selective ZIP requires review", () => assert.equal(evaluate({ zipCode: "41016" }).status, "REVIEW"));
test("outside ZIP fails and cannot pass based on city name", () => assert.equal(evaluate({ zipCode: "99999", city: "Cincinnati" }).status, "FAIL"));
test("unsupported property type fails", () => assert.equal(evaluate({ propertyType: "Storage" }).status, "FAIL"));
test("property above 1,800 square feet reviews", () => assert.equal(evaluate({ squareFeet: 1801 }).status, "REVIEW"));
test("property built before 1950 reviews", () => assert.equal(evaluate({ yearBuilt: 1949 }).status, "REVIEW"));
test("rehab at $60,000 passes its rule", () => assert.ok(evaluate({ rehabBudget: 60000 }).passedRules.some((rule) => rule.includes("$60,000"))));
test("rehab from $60,001 through $100,000 reviews", () => assert.equal(evaluate({ rehabBudget: 60001 }).status, "REVIEW"));
test("rehab above $100,000 fails", () => assert.equal(evaluate({ rehabBudget: 100001 }).status, "FAIL"));
test("ARV below target range reviews", () => assert.equal(evaluate({ estimatedArv: 149999 }).status, "REVIEW"));
test("ARV above target range reviews", () => assert.equal(evaluate({ estimatedArv: 400001 }).status, "REVIEW"));
test("Buy Box labels entered ARV as projected rather than independently supported", () => {
  const result = evaluate();
  const arvRule = result.passedRules.find((rule) => /ARV.*target range/i.test(rule));
  assert.match(arvRule, /Projected\/entered ARV/i);
  assert.match(arvRule, /independent valuation support is evaluated separately/i);
});
test("purchase below base MAO but above downside MAO reviews", () => {
  const result = evaluate({ purchasePrice: 135000 });
  assert.equal(result.status, "REVIEW");
  assert.ok(result.reviewRules.includes("Downside ARV does not support the current purchase price."));
});
test("purchase safely below downside MAO can pass", () => assert.equal(evaluate({ purchasePrice: 130000 }).status, "PASS"));
test("holding costs are consumed exactly once through shared MAO", () => {
  const result = buildUnifiedUnderwritingIntelligence({
    ...cleanDeal,
    purchasePrice: 130000,
    closingCosts: 5000,
    financingCosts: 5000,
    sellingCosts: 22000,
    requiredProfit: 30000,
    holdingMonths: 3,
    holdingCosts: 6000,
  }, [], []);
  assert.equal(result.mao.maximumOffer, 147000);
  assert.equal(result.mao.assumptions.explicitHoldingCosts, 6000);
});
test("holding months alone never create holding cost", () => {
  const results = [0, 3, 12].map((holdingMonths) => buildUnifiedUnderwritingIntelligence({
    ...cleanDeal,
    purchasePrice: 130000,
    closingCosts: 5000,
    financingCosts: 5000,
    sellingCosts: 22000,
    requiredProfit: 30000,
    holdingMonths,
  }, [], []).mao);
  assert.deepEqual(results.map((result) => result.maximumOffer), [153000, 153000, 153000]);
  assert.deepEqual(results.map((result) => result.assumptions.explicitHoldingCosts), [0, 0, 0]);
});
test("BRRRR remains supported", () => assert.equal(evaluate({ strategy: "BRRRR" }).status, "PASS"));
test("Flip remains supported", () => assert.equal(evaluate({ strategy: "flip" }).status, "PASS"));
test("missing optional data does not crash", () => assert.doesNotThrow(() => evaluateRoyalStarBuyBox({ zipCode: "45211", propertyType: "SFH", rehabBudget: "" })));
test("property aliases normalize to supported canonical types", () => {
  assert.equal(normalizeBuyBoxPropertyType("SFH"), "single-family");
  assert.equal(normalizeBuyBoxPropertyType("2 family"), "duplex");
  assert.equal(normalizeBuyBoxPropertyType("3-family"), "triplex");
  assert.equal(normalizeBuyBoxPropertyType("4 unit"), "fourplex");
});
test("ZIP normalization supports numbers and ZIP+4", () => {
  assert.equal(normalizeBuyBoxZip(45211), "45211");
  assert.equal(normalizeBuyBoxZip("45211-1234"), "45211");
});
test("FAIL overrides REVIEW", () => assert.equal(evaluate({ zipCode: "41016", propertyType: "Vacant Land" }).status, "FAIL"));
test("REVIEW overrides otherwise passing rules", () => assert.equal(evaluate({ squareFeet: 1801 }).status, "REVIEW"));
test("Offer Generator shared engine uses centralized Buy Box instead of duplicate logic", () => {
  assert.equal(engineSource.includes('import { evaluateRoyalStarBuyBox } from "./royalStarBuyBoxEngine.js";'), true);
  assert.equal(engineSource.includes("buildBuyBoxIntelligence(normalizedDeal, neighborhoods, { offer: preliminaryOfferAnalysis, arvAnalysis })"), true);
  const result = buildUnifiedUnderwritingIntelligence({
    ...cleanDeal,
    purchasePrice: 135000,
    closingCosts: 5000,
    financingCosts: 5000,
    sellingCosts: 22000,
    requiredProfit: 30000,
    holdingMonths: 3,
    holdingCosts: 6000,
  }, [], []);
  assert.equal(result.buyBox.status, "REVIEW");
  assert.ok(result.buyBox.reasons.includes("Downside ARV does not support the current purchase price."));
  assert.equal(result.mao.buyBoxStatus, "REVIEW");
});

test("Buy Box displayed scoring contributions reconcile exactly to the score", () => {
  const result = evaluateRoyalStarBuyBox(cleanDeal, { offer: cleanOffer });
  const arithmetic = result.scoringBreakdown.reduce((sum, item) => sum + item.points, 0);
  assert.equal(arithmetic, result.score);
  assert.equal(result.scoringBreakdown[0].points, 100);
});
