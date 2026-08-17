import test from "node:test";
import assert from "node:assert/strict";

import {
  normalizeDealRecord,
  normalizePortfolioRecord,
  canonicalToDeal,
  canonicalToPortfolio,
  mergeCanonicalRecords,
  detectDuplicateProperty,
  validateCanonicalRecord,
} from "./canonicalDataFoundation.js";

test("existing deal loads without new metadata", () => {
  const canonical = normalizeDealRecord({
    id: "deal-1",
    propertyAddress: "952 Goss Rd",
    city: "Cincinnati",
    state: "OH",
    zipCode: "45229",
    purchasePrice: 135000,
  });

  assert.equal(canonical.syncStatus, "NOT_SYNCED");
  assert.equal(canonical.syncVersion, 1);
  assert.deepEqual(canonical.approvedFields, []);
  assert.deepEqual(canonical.protectedFields, []);
});

test("existing portfolio record loads without new metadata", () => {
  const canonical = normalizePortfolioRecord({
    id: "portfolio-1",
    propertyAddress: "952 Goss Rd",
    city: "Cincinnati",
    state: "OH",
    zipCode: "45229",
    currentValue: 300000,
  });

  assert.equal(canonical.syncStatus, "NOT_SYNCED");
  assert.equal(canonical.syncVersion, 1);
  assert.deepEqual(canonical.auditMetadata, {});
});

test("canonical normalization preserves valid zero values", () => {
  const canonical = normalizeDealRecord({
    id: "deal-2",
    propertyAddress: "100 Main St",
    city: "Cincinnati",
    state: "OH",
    zipCode: "45211",
    financingCosts: 0,
    holdingMonths: 0,
  });

  assert.equal(canonical.financingCosts, 0);
  assert.equal(canonical.holdingMonths, 0);
  assert.equal(canonical.holdingCosts, null);
});

test("canonical foundation preserves automation financing, holding, rental, and refinance fields", () => {
  const canonical = normalizeDealRecord({
    id: "deal-auto",
    propertyAddress: "123 Test St",
    holdingCosts: "6000",
    earnestMoney: "3500",
    fundedRehab: "50000",
    annualPropertyTaxes: "3000",
    annualInsurance: "1800",
    monthlyHoa: 0,
    refinanceLtvPercent: "75",
    refinanceInterestRate: "7",
  });
  assert.equal(canonical.dealId, "deal-auto");
  assert.equal(canonical.holdingCosts, 6000);
  assert.equal(canonical.earnestMoney, 3500);
  assert.equal(canonical.fundedRehab, 50000);
  assert.equal(canonical.annualTaxes, 3000);
  assert.equal(canonical.annualInsurance, 1800);
  assert.equal(canonical.hoa, 0);
  assert.equal(canonical.refinanceLtvPercentage, 75);
  assert.equal(canonical.refinanceInterestRate, 7);
});

test("null values do not overwrite known values", () => {
  const merged = mergeCanonicalRecords(
    {
      id: "deal-3",
      address: "100 Main St",
      city: "Cincinnati",
      state: "OH",
      zipCode: "45211",
      purchasePrice: 150000,
    },
    {
      id: "deal-3",
      address: null,
      purchasePrice: null,
    },
    {},
  );

  assert.equal(merged.record.address, "100 Main St");
  assert.equal(merged.record.purchasePrice, 150000);
});

test("approved ARV cannot be overwritten by unapproved data", () => {
  const merged = mergeCanonicalRecords(
    {
      id: "deal-4",
      address: "200 Main St",
      city: "Cincinnati",
      state: "OH",
      zipCode: "45211",
      arv: 300000,
      protectedFields: ["arv"],
    },
    {
      id: "deal-4",
      arv: 250000,
    },
    {},
  );

  assert.equal(merged.record.arv, 300000);
  assert.ok(merged.conflicts.some((entry) => entry.field === "arv"));
});

test("duplicate detection can mark uncertain matches as review required", () => {
  const duplicate = detectDuplicateProperty(
    {
      id: "deal-5",
      propertyAddress: "300 Main St",
      city: "Cincinnati",
      state: "OH",
      zipCode: "45211",
      sourceRecordId: "external-123",
    },
    [
      {
        id: "portfolio-9",
        propertyAddress: "300 Main St",
        city: "",
        state: "",
        zipCode: "",
        sourceRecordId: "external-123",
      },
    ],
  );

  assert.equal(duplicate.reviewRequired, true);
  assert.equal(duplicate.confidence, "POSSIBLE");
});

test("canonical validation fails when required identity fields are missing", () => {
  const result = validateCanonicalRecord({ id: "deal-6" });
  assert.equal(result.valid, false);
  assert.ok(result.errors.length > 0);
});

test("canonical mapping to deal preserves core deal fields", () => {
  const mapped = canonicalToDeal({
    id: "deal-7",
    dealId: "deal-7",
    address: "400 Main St",
    city: "Cincinnati",
    state: "OH",
    zipCode: "45202",
    purchasePrice: 180000,
    rehabBudget: 35000,
    arv: 290000,
    strategy: "Flip",
    status: "Purchased",
  });

  assert.equal(mapped.id, "deal-7");
  assert.equal(mapped.propertyAddress, "400 Main St");
  assert.equal(mapped.purchasePrice, 180000);
  assert.equal(mapped.rehabBudget, 35000);
  assert.equal(mapped.estimatedArv, 290000);
  assert.equal(mapped.strategy, "Flip");
});

test("canonical mapping to portfolio preserves dashboard-relevant fields", () => {
  const mapped = canonicalToPortfolio({
    id: "portfolio-2",
    portfolioId: "portfolio-2",
    dealId: "deal-8",
    propertyName: "Mapped Asset",
    address: "500 Main St",
    city: "Cincinnati",
    state: "OH",
    zipCode: "45203",
    purchasePrice: 165000,
    currentValue: 250000,
    monthlyRent: 2300,
    strategy: "Hold",
    status: "Active",
  });

  assert.equal(mapped.id, "portfolio-2");
  assert.equal(mapped.propertyName, "Mapped Asset");
  assert.equal(mapped.propertyAddress, "500 Main St");
  assert.equal(mapped.linkedDealId, "deal-8");
  assert.equal(mapped.currentValue, 250000);
  assert.equal(mapped.monthlyRent, 2300);
  assert.equal(mapped.status, "Active");
});
