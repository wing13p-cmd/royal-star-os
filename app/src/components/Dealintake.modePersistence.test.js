import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  hydrateDealIntakeFormData,
  toNumberOrBlank,
  validateDealIntakeFormData,
} from "./dealIntakeFormUtils.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const source = fs.readFileSync(path.join(__dirname, "Dealintake.jsx"), "utf8");

test("Deal Intake validates required fields and focuses field-level constraints", () => {
  const validation = validateDealIntakeFormData({
    address: "",
    city: "",
    state: "",
    zip: "",
    arv: "NaN",
  });

  assert.equal(validation.isValid, false);
  assert.equal(validation.fieldErrors.address, "Address is required.");
  assert.equal(validation.fieldErrors.city, "City is required.");
  assert.equal(validation.fieldErrors.state, "State is required.");
  assert.equal(validation.fieldErrors.zip, "ZIP is required.");
  assert.equal(validation.fieldErrors.arv, "ARV must be a valid number.");
  assert.equal(validation.firstInvalidField, "address");
});

test("Deal Intake numeric coercion preserves missing values versus true zero", () => {
  assert.equal(toNumberOrBlank(""), "");
  assert.equal(toNumberOrBlank(undefined), "");
  assert.equal(toNumberOrBlank("0"), 0);
  assert.equal(toNumberOrBlank(0), 0);
  assert.equal(toNumberOrBlank("42.5"), 42.5);
  assert.equal(toNumberOrBlank("not-a-number"), "");
});

test("Deal Intake hydration keeps status, pipeline stage, and edit fields", () => {
  const hydrated = hydrateDealIntakeFormData({
    id: "deal-952",
    propertyAddress: "952 Goss Rd",
    city: "Cincinnati",
    state: "OH",
    zipCode: "45229",
    estimatedArv: 304000,
    status: "Due Diligence",
    pipelineStage: "Due Diligence",
    linkedPropertyId: "property-deal-952",
    propertyId: "property-deal-952",
    parcelNumber: "123456789",
    mapUrl: "",
  }, {
    rawFinancingCostInput: 0,
  });

  assert.equal(hydrated.address, "952 Goss Rd");
  assert.equal(hydrated.city, "Cincinnati");
  assert.equal(hydrated.state, "OH");
  assert.equal(hydrated.zip, "45229");
  assert.equal(hydrated.arv, 304000);
  assert.equal(hydrated.status, "Due Diligence");
  assert.equal(hydrated.pipelineStage, "Due Diligence");
});

test("Deal Intake preserves existing explicit holding-cost data without adding a required input", () => {
  const hydrated = hydrateDealIntakeFormData({
    holdingMonths: 3,
    totalHoldingCosts: 6000,
    monthlyHoldingCost: 2000,
  });

  assert.equal(hydrated.holdingMonths, 3);
  assert.equal(hydrated.holdingCosts, 6000);
  assert.equal(hydrated.monthlyHoldingCost, 2000);
  assert.equal(source.includes("buildDealIntakePayload(formData, currentDeal)"), true);
});

test("older saved deals hydrate safely without holding-cost data", () => {
  const hydrated = hydrateDealIntakeFormData({ holdingMonths: 3 });
  assert.equal(hydrated.holdingCosts, "");
});

test("Deal Intake renders one non-negative TOTAL HOLDING COSTS input beside Holding Months", () => {
  assert.match(source, /label="Holding Months"[\s\S]*?label="TOTAL HOLDING COSTS"/);
  assert.equal(source.includes('label="TOTAL HOLDING COSTS" name="holdingCosts"'), true);
  assert.equal(source.includes('name="holdingCosts" value={formData.holdingCosts}'), true);
  assert.match(source, /name="holdingCosts"[^\n]+min=\{0\}/);
});

test("Deal Intake rejects negative holding costs while allowing blank and zero", () => {
  const base = { address: "1 Main", city: "Cincinnati", state: "OH", zip: "45202" };
  assert.equal(validateDealIntakeFormData({ ...base, holdingCosts: "" }).isValid, true);
  assert.equal(validateDealIntakeFormData({ ...base, holdingCosts: 0 }).isValid, true);
  const negative = validateDealIntakeFormData({ ...base, holdingCosts: -1 });
  assert.equal(negative.isValid, false);
  assert.equal(negative.fieldErrors.holdingCosts, "Total Holding Costs cannot be negative.");
});

test("Deal Intake keeps edit mode loaded and blocks duplicate save while saving", () => {
  assert.equal(source.includes('const [formMode, setFormMode] = useState(dealToEdit?.id ? "edit" : "new");'), true);
  assert.equal(source.includes('const [isSaving, setIsSaving] = useState(false);'), true);
  assert.equal(source.includes('if (isSaving) return;'), true);
  assert.equal(source.includes('disabled={isSaving}'), true);
  assert.equal(source.includes('hydrateSavedDeal(finalSavedDeal'), true);
  assert.equal(source.includes('setFormMode("edit");'), true);
  assert.equal(source.includes('fetchCanonicalDealById(savedDeal.id)'), true);
});

test("Deal Intake edit mode updates existing deal endpoint instead of creating duplicates", () => {
  assert.equal(source.includes('const endpoint = isEditMode ? buildApiUrl(`/api/deals/${currentDeal.id}`) : buildApiUrl("/api/deals");'), true);
  assert.equal(source.includes('const method = isEditMode ? "PUT" : "POST";'), true);
  assert.equal(source.includes('const updatedDeals = isEditMode'), true);
  assert.equal(source.includes("buildDealIntakePayload(formData, currentDeal)"), true);
});

test("Deal Intake POST and PUT share authenticated session headers", () => {
  assert.equal(source.includes('import { buildSessionAuthHeaders } from "../utils/sessionAuth.js";'), true);
  assert.equal(source.includes('headers: buildSessionAuthHeaders({'), true);
  assert.equal(source.includes('"Content-Type": "application/json"'), true);
  assert.equal(source.includes('const method = isEditMode ? "PUT" : "POST";'), true);
});

test("Deal Intake monetary inputs accept cent precision while counts retain explicit steps", () => {
  assert.match(source, /DEAL_INTAKE_MONEY_FIELDS/);
  assert.match(source, /MONEY_FIELD_SET\.has\(name\) \? "0\.01"/);
  assert.match(source, /name="annualInterestRate"[^\n]+step="0\.01"/);
  assert.match(source, /name="holdingMonths"[^\n]+step="1"/);
  assert.match(source, /name="bathrooms"[^\n]+step="0\.5"/);
});
