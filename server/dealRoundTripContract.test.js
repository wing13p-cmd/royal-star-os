import test from "node:test";
import assert from "node:assert/strict";
import { buildDealIntakePayload, DEAL_INTAKE_FIELD_CONTRACT } from "../app/src/components/dealIntakeFieldContract.js";
import { hydrateDealIntakeFormData } from "../app/src/components/dealIntakeFormUtils.js";
import { normalizeCanonicalProperty } from "../app/src/components/propertyAutomationEngine.js";
import { buildPersistedDealPayload } from "./dealPersistence.js";
import { mergeDealRoundTripUpdate, normalizeDealRoundTripPayload } from "./dealRoundTripContract.js";

const completeForm = {
  address: "123 Test St", city: "Cincinnati", state: "OH", zip: "45211", propertyType: "Single Family",
  bedrooms: "3", bathrooms: "2", squareFeet: "1400", yearBuilt: "1960", askingPrice: "150000", purchasePrice: "135000",
  rehabBudget: "60000", arv: "275000", estimatedRent: "1800", taxes: "3000", insurance: "1800", financingCosts: "5000", closingCosts: "5000",
  actualLoanAmount: "182330", annualInterestRate: "11.24", cashToClose: "26857.90", earnestMoney: "3500", totalInitialCashInvested: "30000",
  constructionHoldback: "60000", originationFee: "3646.60", underwritingFee: "995", servicingFee: "500", lenderLegalFee: "750", monitoringFee: "300",
  otherLenderFees: "225", fundedRehab: "60000", paymentType: "Interest Only", holdingMonths: "3", holdingCosts: "6000", monthlyHoldingCost: "",
  leadSource: "Direct", exitStrategy: "Flip", status: "Lead", pipelineStage: "Underwriting", notes: "Complete fixture",
};

function roundTrip(form = completeForm) {
  const post = buildDealIntakePayload(form, null);
  const normalized = normalizeDealRoundTripPayload(buildPersistedDealPayload(post));
  const stored = { ...normalized, id: "deal-roundtrip", createdAt: "2026-08-09T00:00:00.000Z" };
  const get = buildPersistedDealPayload(stored);
  const hydrated = hydrateDealIntakeFormData(get, { rawFinancingCostInput: get.financingCosts });
  return { post, normalized, stored, get, hydrated };
}

test("field contract covers every current Deal Intake form field", () => {
  assert.deepEqual(DEAL_INTAKE_FIELD_CONTRACT.map((entry) => entry.formField).sort(), Object.keys(completeForm).sort());
  DEAL_INTAKE_FIELD_CONTRACT.forEach((entry) => {
    assert.ok(entry.canonicalField && entry.payloadField && entry.backendField && entry.persistedField && entry.getField && entry.hydrationField);
    assert.ok(entry.aliases.length > 0);
  });
});

test("new deal POST, persistence, GET, and edit hydration preserve every Deal Intake field", () => {
  const { post, get, hydrated } = roundTrip();
  DEAL_INTAKE_FIELD_CONTRACT.forEach((entry) => {
    assert.ok(Object.prototype.hasOwnProperty.call(post, entry.payloadField), `POST missing ${entry.payloadField}`);
    assert.ok(Object.prototype.hasOwnProperty.call(get, entry.persistedField), `GET missing ${entry.persistedField}`);
    const expected = entry.type === "number" ? Number(completeForm[entry.formField]) : completeForm[entry.formField];
    if (completeForm[entry.formField] === "") assert.equal(hydrated[entry.formField], "");
    else assert.equal(hydrated[entry.formField], expected, `hydration mismatch for ${entry.formField}`);
  });
});

for (const [label, partial, expected] of [
  ["ARV", { estimatedArv: 285000 }, { estimatedArv: 285000 }],
  ["purchase price", { purchasePrice: 140000 }, { purchasePrice: 140000 }],
  ["strategy", { strategy: "BRRRR" }, { strategy: "BRRRR" }],
]) {
  test(`PUT changing only ${label} preserves every unrelated persisted field`, () => {
    const { stored } = roundTrip();
    const normalized = normalizeDealRoundTripPayload(partial);
    const updated = mergeDealRoundTripUpdate(stored, normalized, partial);
    Object.entries(expected).forEach(([field, value]) => assert.equal(updated[field], value));
    assert.equal(updated.holdingCosts, 6000);
    assert.equal(updated.earnestMoney, 3500);
    assert.equal(updated.actualLoanAmount, 182330);
    assert.equal(updated.annualInterestRate, 11.24);
    assert.equal(updated.cashToClose, 26857.9);
    assert.equal(updated.totalInitialCashInvested, 30000);
    assert.equal(updated.fundedRehab, 60000);
    assert.equal(updated.paymentType, "Interest Only");
    assert.equal(updated.originationFee, 3646.6);
    assert.equal(updated.underwritingFee, 995);
    assert.equal(updated.servicingFee, 500);
    assert.equal(updated.lenderLegalFee, 750);
    assert.equal(updated.monitoringFee, 300);
    assert.equal(updated.otherLenderFees, 225);
  });
}

test("explicit zero canonical values survive and beat stale aliases", () => {
  const canonical = normalizeCanonicalProperty({ interestRate: 0, annualInterestRate: 11.24, holdingCosts: 0, totalHoldingCosts: 6000, initialCashInvested: 0, totalInitialCashInvested: 30000 });
  assert.equal(canonical.interestRate, 0);
  assert.equal(canonical.holdingCosts, 0);
  assert.equal(canonical.initialCashInvested, 0);
  const normalized = normalizeDealRoundTripPayload({ annualInterestRate: 0, interestRate: 11.24, holdingCosts: 0, totalHoldingCosts: 6000, totalInitialCashInvested: 0, initialCashInvested: 30000 });
  assert.equal(normalized.annualInterestRate, 0);
  assert.equal(normalized.holdingCosts, 0);
  assert.equal(normalized.totalInitialCashInvested, 0);
});

test("blank canonical aliases fall through to populated legacy aliases", () => {
  const canonical = normalizeCanonicalProperty({ interestRate: "", annualInterestRate: 11.24, holdingCosts: "", totalHoldingCosts: 6000 });
  assert.equal(canonical.interestRate, 11.24);
  assert.equal(canonical.holdingCosts, 6000);
  const normalized = normalizeDealRoundTripPayload({ annualInterestRate: "", interestRate: 11.24, holdingCosts: "", totalHoldingCosts: 6000 });
  assert.equal(normalized.annualInterestRate, 11.24);
  assert.equal(normalized.holdingCosts, 6000);
});

test("blank legacy fields remain safe without inventing values", () => {
  const result = roundTrip(Object.fromEntries(Object.keys(completeForm).map((key) => [key, ["address", "city", "state", "zip"].includes(key) ? completeForm[key] : ""])));
  assert.equal(result.hydrated.actualLoanAmount, "");
  assert.equal(result.hydrated.holdingCosts, "");
  assert.equal(result.hydrated.paymentType, "");
});

test("property automation preserves the full compatible financing and rehab record", () => {
  const { get } = roundTrip();
  const canonical = normalizeCanonicalProperty(get);
  assert.equal(canonical.actualLoanAmount, 182330);
  assert.equal(canonical.interestRate, 11.24);
  assert.equal(canonical.cashToClose, 26857.9);
  assert.equal(canonical.earnestMoney, 3500);
  assert.equal(canonical.initialCashInvested, 30000);
  assert.equal(canonical.constructionHoldback, 60000);
  assert.equal(canonical.fundedRehab, 60000);
  assert.equal(canonical.holdingCosts, 6000);
  assert.equal(canonical.paymentType, "Interest Only");
});

test("currency cents survive Deal Intake POST, persistence, GET, and edit hydration exactly", () => {
  const centValues = {
    holdingCosts: "2725.72", cashToClose: "24610.05", totalInitialCashInvested: "28110.05",
    originationFee: "2734.95", underwritingFee: "1707.82", lenderLegalFee: "995.00",
    monitoringFee: "750.00", otherLenderFees: "225.00",
  };
  const result = roundTrip({ ...completeForm, ...centValues });
  Object.entries(centValues).forEach(([field, value]) => {
    assert.equal(result.post[field], Number(value), `POST cents lost for ${field}`);
    assert.equal(result.get[field], Number(value), `GET cents lost for ${field}`);
    assert.equal(result.hydrated[field], Number(value), `hydration cents lost for ${field}`);
  });
});
