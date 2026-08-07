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
});
