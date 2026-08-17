import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildPersistedDealPayload } from "../../../server/dealPersistence.js";
import { DEAL_INTAKE_FIELD_CONTRACT } from "./dealIntakeFieldContract.js";
import { hydrateDealIntakeFormData } from "./dealIntakeFormUtils.js";
import {
  buildUnifiedUnderwritingIntelligence,
  normalizeDealForIntelligence,
} from "./intelligenceUpgradeEngine.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dealAnalyzerSource = fs.readFileSync(path.join(__dirname, "DealAnalyzer.jsx"), "utf8");
const appSource = fs.readFileSync(path.join(__dirname, "../App.jsx"), "utf8");
const offerGeneratorSource = fs.readFileSync(path.join(__dirname, "OfferGenerator.jsx"), "utf8");
const flipAnalyzerSource = fs.readFileSync(path.join(__dirname, "FlipAnalyzer.jsx"), "utf8");
const normalizeDealFunctionSource = dealAnalyzerSource.slice(
  dealAnalyzerSource.indexOf("function normalizeDeal(deal) {"),
  dealAnalyzerSource.indexOf("\n\nexport default function DealAnalyzer"),
).replace("function normalizeDeal", "function");
const normalizeDealUnderTest = Function("toNumber", `return (${normalizeDealFunctionSource});`)((value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
});

const productionStyleDeal = {
  id: "deal-1786261055507-664346", propertyAddress: "123 test st", city: "cincinnati", state: "OH", zipCode: "45211",
  propertyType: "single family", bedrooms: 3, bathrooms: 2, squareFeet: 1400, yearBuilt: 1960, askingPrice: 150000,
  purchasePrice: 135000, rehabBudget: 60000, estimatedArv: 285000, estimatedRent: 1800, taxes: 3000, insurance: 1800,
  financingCosts: 5000, closingCosts: 5000, actualLoanAmount: 182330, annualInterestRate: 11.24, cashToClose: 26857.9,
  earnestMoney: 3500, totalInitialCashInvested: 30000, constructionHoldback: 0, originationFee: 0, underwritingFee: 0,
  servicingFee: 0, lenderLegalFee: 0, monitoringFee: 0, otherLenderFees: 0, fundedRehab: 60000, paymentType: "intrest only",
  holdingMonths: 3, holdingCosts: 6000, monthlyHoldingCost: 0, leadSource: "test", strategy: "Flip", exitStrategy: "Flip",
  status: "Lead", pipelineStage: "New Lead", notes: "offer generator test deal", unknownFutureField: "preserved",
};

test("Deal Analyzer normalization preserves every Deal Intake contract field and unknown fields", () => {
  const normalized = normalizeDealUnderTest(productionStyleDeal);
  DEAL_INTAKE_FIELD_CONTRACT.forEach((entry) => {
    assert.ok(Object.prototype.hasOwnProperty.call(normalized, entry.persistedField), `missing ${entry.persistedField}`);
    assert.equal(normalized[entry.persistedField], productionStyleDeal[entry.persistedField], `changed ${entry.persistedField}`);
  });
  assert.equal(normalized.unknownFutureField, "preserved");
});

test("production-style API to Edit callback to Deal Intake hydration keeps financing and holding values", () => {
  const editCallbackDeal = normalizeDealUnderTest(productionStyleDeal);
  const hydrated = hydrateDealIntakeFormData(editCallbackDeal, { rawFinancingCostInput: 5000 });
  assert.equal(hydrated.actualLoanAmount, 182330);
  assert.equal(hydrated.annualInterestRate, 11.24);
  assert.equal(hydrated.cashToClose, 26857.9);
  assert.equal(hydrated.earnestMoney, 3500);
  assert.equal(hydrated.totalInitialCashInvested, 30000);
  assert.equal(hydrated.fundedRehab, 60000);
  assert.equal(hydrated.paymentType, "intrest only");
  assert.equal(hydrated.holdingMonths, 3);
  assert.equal(hydrated.holdingCosts, 6000);
});

test("Deal Analyzer normalization and edit hydration preserve explicit zeros", () => {
  const normalized = normalizeDealUnderTest({ ...productionStyleDeal, earnestMoney: 0, holdingCosts: 0, actualLoanAmount: 0, otherLenderFees: 0 });
  const hydrated = hydrateDealIntakeFormData(normalized, { rawFinancingCostInput: 5000 });
  assert.equal(hydrated.earnestMoney, 0);
  assert.equal(hydrated.holdingCosts, 0);
  assert.equal(hydrated.actualLoanAmount, 0);
  assert.equal(hydrated.otherLenderFees, 0);
});

test("buildPersistedDealPayload preserves underwriting fields required to reopen a deal with calculated financing", () => {
  const persisted = buildPersistedDealPayload({
    id: "deal-1",
    propertyAddress: "952 Goss Rd",
    city: "Cincinnati",
    state: "OH",
    zipCode: "45229",
    purchasePrice: 135000,
    rehabBudget: 60000,
    estimatedArv: 300000,
    annualInterestRate: 11.24,
    actualLoanAmount: 182330,
    cashToClose: 26857.9,
    earnestMoney: 3500,
    totalInitialCashInvested: 30357.9,
    constructionHoldback: 62990,
    originationFee: 1800,
    underwritingFee: 500,
    servicingFee: 250,
    lenderLegalFee: 750,
    monitoringFee: 100,
    otherLenderFees: 200,
    paymentType: "Interest Only",
    financingCosts: 0,
    recommendation: "Continue Project",
    overallRisk: 28,
    projectedProfit: 77902.1,
  });

  assert.ok(persisted.financingCosts > 0);
  assert.equal(persisted.financials.financingCostSource, "calculated");
  assert.equal(persisted.recommendation, "Continue Project");
  assert.equal(persisted.overallRisk, 28);
  assert.equal(persisted.projectedProfit, 77902.1);
});

test("Deal Analyzer status filter uses shared status registry options", () => {
  assert.equal(dealAnalyzerSource.includes("DEAL_STATUS_OPTIONS"), true);
  assert.equal(dealAnalyzerSource.includes("statusFilterOptions"), true);
  assert.equal(dealAnalyzerSource.includes("All Status"), true);
});

test("Deal Analyzer preserves existing actions and exposes the Offer Generator action", () => {
  assert.equal(dealAnalyzerSource.includes("ADD NEW DEAL"), true);
  assert.equal(dealAnalyzerSource.includes("onClick={onOpenDealIntelligence}"), true);
  assert.equal(dealAnalyzerSource.includes("DEAL INTELLIGENCE"), true);
  assert.equal(dealAnalyzerSource.includes("onClick={onOpenOfferGenerator}"), true);
  assert.equal(dealAnalyzerSource.includes("OFFER GENERATOR"), true);
});

test("Deal Analyzer keeps all header actions visible instead of clipping the Offer Generator", () => {
  assert.match(dealAnalyzerSource, /topBar:\s*\{[\s\S]*?flexWrap:\s*"wrap"/);
  assert.match(dealAnalyzerSource, /headerActions:\s*\{[\s\S]*?flexWrap:\s*"wrap"/);
  assert.match(dealAnalyzerSource, /headerActions:\s*\{[\s\S]*?maxWidth:\s*"100%"/);
});

test("Deal Analyzer DELETE includes shared authenticated session headers", () => {
  assert.equal(dealAnalyzerSource.includes('import { buildSessionAuthHeaders } from "../utils/sessionAuth.js";'), true);
  assert.match(dealAnalyzerSource, /method:\s*"DELETE",\s*headers:\s*buildSessionAuthHeaders\(\)/);
});

test("App opens the existing Offer Generator engine view and returns to Deal Analyzer", () => {
  assert.equal(appSource.includes('onOpenOfferGenerator={() => navigateToView("offerGenerator")}'), true);
  assert.equal(appSource.includes('if (currentView === "offerGenerator")'), true);
  assert.equal(appSource.includes('onBackToDealAnalyzer={() => navigateToView("dealAnalyzer")}'), true);
});

test("Offer Generator wrapper renders unified underwriting output without duplicating offer math", () => {
  assert.equal(offerGeneratorSource.includes("buildUnifiedUnderwritingIntelligence"), true);
  assert.equal(offerGeneratorSource.includes("underwriting?.mao"), true);
  assert.equal(offerGeneratorSource.includes("buildOfferIntelligence"), false);
  assert.equal(offerGeneratorSource.includes("Maximum Allowable Offer"), true);
  assert.equal(offerGeneratorSource.includes("offer.maximumOffer"), true);
  assert.equal(offerGeneratorSource.includes("ARV -"), false);
  assert.equal(offerGeneratorSource.includes("refinanceLtv *"), false);
});

test("Offer Generator explains explicit holding costs and reuses the Flip holding-cost path", () => {
  assert.equal(offerGeneratorSource.includes('label="Explicit Holding Costs"'), true);
  assert.equal(offerGeneratorSource.includes("Holding months are informational; no holding cost is added without entered cost data."), true);
  assert.equal(flipAnalyzerSource.includes('monthlyHoldingCost: selectedDeal.monthlyHoldingCost ?? ""'), true);
  assert.equal(flipAnalyzerSource.includes("buildPropertyAutomation(selectedDeal).moduleData.flipAnalyzer"), true);
  assert.equal(flipAnalyzerSource.includes('holdingCosts: canonical.holdingCosts ?? ""'), true);
});

test("Offer Generator UI envelope exposes the existing $143,000 flip MAO and offer ladder", () => {
  const underwriting = buildUnifiedUnderwritingIntelligence(normalizeDealForIntelligence({
    strategy: "Flip",
    purchasePrice: 135000,
    arv: 275000,
    rehabBudget: 60000,
    closingCosts: 5000,
    financingCosts: 5000,
    requiredProfit: 40000,
    sellingCosts: 22000,
  }), [], []);

  assert.equal(underwriting.mao.maximumOffer, 143000);
  assert.ok(underwriting.mao.initialOffer <= underwriting.mao.targetOffer);
  assert.ok(underwriting.mao.targetOffer <= underwriting.mao.walkAwayPrice);
  assert.ok(underwriting.mao.walkAwayPrice <= underwriting.mao.maximumOffer);
  assert.ok(Array.isArray(underwriting.mao.calculationBreakdown));
  assert.ok(underwriting.mao.sensitivity);
});
