import test from "node:test";
import assert from "node:assert/strict";
import { buildUnifiedUnderwritingIntelligence, normalizeDealForIntelligence } from "./intelligenceUpgradeEngine.js";
import { buildPropertyAutomation, buildPropertyReadiness, evaluatePropertyCompleteness, normalizeCanonicalProperty, selectCanonicalProperty } from "./propertyAutomationEngine.js";
import { hydrateDealIntakeFormData } from "./dealIntakeFormUtils.js";

const base = {
  id: "deal-123",
  propertyAddress: "123 Test St",
  city: "Cincinnati",
  state: "oh",
  zipCode: 45211,
  propertyType: "Single Family",
  bedrooms: "3",
  bathrooms: "2",
  squareFeet: "1400",
  yearBuilt: "1960",
  purchasePrice: "135000",
  estimatedArv: "275000",
  rehabBudget: "60000",
  closingCosts: "5000",
  financingCosts: "5000",
  holdingMonths: "3",
  holdingCosts: "6000",
  sellingCosts: "22000",
  requiredProfit: "30000",
  strategy: "Flip",
  pipelineStage: "Underwriting",
};

test("saved deal normalizes into one canonical property with stable identity", () => {
  const property = normalizeCanonicalProperty(base);
  assert.equal(property.id, "deal-123");
  assert.equal(property.dealId, "deal-123");
  assert.equal(property.propertyAddress, "123 Test St");
  assert.equal(property.zipCode, "45211");
});

test("numeric strings and legacy aliases normalize safely", () => {
  const property = normalizeCanonicalProperty({ id: "d1", address: "A", zip: "41011", arv: "285000", repairBudget: "45000", totalHoldingCosts: "6000", initialCashInvested: "30000" });
  assert.equal(property.arv, 285000);
  assert.equal(property.rehabBudget, 45000);
  assert.equal(property.holdingCosts, 6000);
  assert.equal(property.initialCashInvested, 30000);
});

test("blank optional values remain safe and legitimate zeros remain present", () => {
  const property = normalizeCanonicalProperty({ ...base, earnestMoney: 0, monthlyHoa: 0, monthlyUtilities: "", otherMonthlyExpenses: null });
  assert.equal(property.earnestMoney, 0);
  assert.equal(property.hoa, 0);
  assert.equal(property.monthlyUtilitiesPaidByOwner, null);
  assert.equal(property.otherMonthlyExpenses, null);
});

test("Deal Intake hydration consumes canonical aliases", () => {
  const form = hydrateDealIntakeFormData({ ...base, address: "Ignored Alias", totalHoldingCosts: 6000 }, { rawFinancingCostInput: 5000 });
  assert.equal(form.address, "123 Test St");
  assert.equal(form.arv, 275000);
  assert.equal(form.holdingCosts, 6000);
});

test("updated authoritative ARV propagates to every module projection", () => {
  const result = buildPropertyAutomation({ ...base, estimatedArv: 285000 });
  Object.values(result.moduleData).forEach((moduleProperty) => assert.equal(moduleProperty.arv, 285000));
});

for (const [field, value] of [["rehabBudget", 70000], ["purchasePrice", 140000], ["holdingCosts", 9000]]) {
  test(`updated ${field} propagates to every module projection`, () => {
    const result = buildPropertyAutomation({ ...base, [field]: value });
    Object.values(result.moduleData).forEach((moduleProperty) => assert.equal(moduleProperty[field], value));
  });
}

test("earnest money is retained but does not alter total project economics", () => {
  const without = buildUnifiedUnderwritingIntelligence(normalizeDealForIntelligence({ ...base, earnestMoney: 0 }), [], []);
  const withEarnest = buildUnifiedUnderwritingIntelligence(normalizeDealForIntelligence({ ...base, earnestMoney: 3500 }), [], []);
  assert.equal(without.mao.maximumOffer, withEarnest.mao.maximumOffer);
});

test("holding months alone does not invent holding cost", () => {
  [0, 3, 12].forEach((holdingMonths) => {
    const property = normalizeCanonicalProperty({ ...base, holdingMonths, holdingCosts: 0 });
    assert.equal(property.holdingCosts, 0);
  });
});

test("Offer Generator and centralized Buy Box consume canonical property", () => {
  const canonical = buildPropertyAutomation(base).moduleData.offerGenerator;
  const result = buildUnifiedUnderwritingIntelligence(canonical, [], []);
  assert.equal(result.mao.maximumOffer, 147000);
  assert.equal(result.buyBox.status, "REVIEW");
  assert.ok(result.buyBox.reasons.some((reason) => /downside/i.test(reason)));
});

test("shared Deal Intelligence normalization retains canonical identity", () => {
  const normalized = normalizeDealForIntelligence(base);
  assert.equal(normalized.id, "deal-123");
  assert.equal(normalized.dealId, "deal-123");
  assert.equal(normalized.arv, 275000);
});

test("Flip and BRRRR strategy aliases remain supported", () => {
  assert.equal(normalizeCanonicalProperty({ ...base, strategy: "fix and flip" }).strategy, "Flip");
  assert.equal(normalizeCanonicalProperty({ ...base, strategy: "buy rehab rent refinance repeat" }).strategy, "BRRRR");
});

test("strategy change retains common canonical values", () => {
  const flip = normalizeCanonicalProperty(base);
  const brrrr = normalizeCanonicalProperty({ ...flip, strategy: "BRRRR", monthlyRent: 3000, refinanceLtvPercentage: 75 });
  assert.equal(brrrr.id, flip.id);
  assert.equal(brrrr.purchasePrice, flip.purchasePrice);
  assert.equal(brrrr.rehabBudget, flip.rehabBudget);
  assert.equal(brrrr.strategy, "BRRRR");
});

test("no selected property is a safe empty state", () => {
  assert.equal(selectCanonicalProperty([base], ""), null);
  assert.deepEqual(buildPropertyReadiness({}).availableModules, []);
});

test("switching selected properties cannot retain another property's values", () => {
  const a = { ...base, id: "a", estimatedArv: 275000 };
  const b = { ...base, id: "b", estimatedArv: 330000, holdingCosts: 12000 };
  assert.equal(selectCanonicalProperty([a, b], "a").property.arv, 275000);
  assert.equal(selectCanonicalProperty([a, b], "b").property.arv, 330000);
  assert.equal(selectCanonicalProperty([a, b], "a").property.holdingCosts, 6000);
});

test("ambiguous duplicate IDs fail safely instead of selecting a record", () => {
  assert.equal(selectCanonicalProperty([{ ...base }, { ...base, estimatedArv: 999999 }], "deal-123"), null);
});

test("ordinary module navigation never generates a replacement ID", () => {
  const first = buildPropertyAutomation(base);
  const second = buildPropertyAutomation(first.moduleData.flipAnalyzer);
  assert.equal(first.canonicalId, "deal-123");
  assert.equal(second.canonicalId, "deal-123");
});

test("edit/save normalization retains the original deal ID", () => {
  const edited = normalizeCanonicalProperty({ ...base, estimatedArv: 285000 });
  assert.equal(edited.id, base.id);
  assert.equal(edited.dealId, base.id);
});

test("missing critical fields are explicit and optional zero values are accepted", () => {
  const result = evaluatePropertyCompleteness({ id: "d", address: "", hoa: 0, otherMonthlyExpenses: 0 });
  assert.equal(result.complete, false);
  assert.ok(result.missingCriticalData.some((item) => item.field === "address"));
  assert.ok(!result.missingCriticalData.some((item) => item.field === "hoa"));
});

test("BRRRR completeness adds only strategy-specific required inputs", () => {
  const result = evaluatePropertyCompleteness({ ...base, strategy: "BRRRR", monthlyRent: "", refinanceLtvPercentage: "" });
  assert.ok(result.missingCriticalData.some((item) => item.field === "monthlyRent"));
  assert.ok(result.missingCriticalData.some((item) => item.field === "refinanceLtvPercentage"));
});

test("workflow readiness returns a non-destructive next action", () => {
  const result = buildPropertyReadiness(base);
  assert.equal(result.currentStage, "Underwriting");
  assert.match(result.recommendedNextAction, /Buy Box|offer/i);
  assert.ok(result.availableModules.includes("propertyDatabase"));
});

test("unknown workflow status is preserved and fails safely", () => {
  const result = buildPropertyReadiness({ ...base, pipelineStage: "Custom Legacy Stage" });
  assert.equal(result.currentStage, "Custom Legacy Stage");
  assert.equal(typeof result.recommendedNextAction, "string");
});

test("canonical projections expose financing, rental, and BRRRR data without overwriting common data", () => {
  const result = buildPropertyAutomation({ ...base, actualLoanAmount: "120000", annualPropertyTaxes: "3000", annualInsurance: "1800", refinanceLtvPercent: "75" });
  const brrrr = result.moduleData.brrrrAnalyzer;
  assert.equal(brrrr.actualLoanAmount, 120000);
  assert.equal(brrrr.annualPropertyTaxes, 3000);
  assert.equal(brrrr.annualInsurance, 1800);
  assert.equal(brrrr.refinanceLtvPercentage, 75);
});

test("property automation exposes appraisal intelligence without replacing its canonical record", () => {
  const appraisalIntelligence = { appraisalStatus: "READY", recommendedNextAction: "Prepare appraisal packet", warnings: [] };
  const result = buildPropertyAutomation({ ...base, pipelineStage: "Ready for Appraisal" }, { appraisalIntelligence });
  assert.equal(result.appraisalIntelligence, appraisalIntelligence);
  assert.equal(result.moduleData.appraisalIntelligence.id, result.canonicalId);
  assert.equal(result.moduleData.appraisalIntelligence.appraisalIntelligence.appraisalStatus, "READY");
  assert.equal(result.readiness.recommendedNextAction, "Prepare appraisal packet");
});
