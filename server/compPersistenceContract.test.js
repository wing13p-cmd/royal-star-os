import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { findExistingProviderImport, mergeCompResponse, normalizePersistedComp } from "./compPersistenceContract.js";

const fixture = { id: "comp-1", subjectDealId: "deal-123", dealId: "deal-123", propertyId: "property-123", subjectPropertyId: "property-123", subjectProperty: "123 test st", compAddress: "100 Test Comp Ave", city: "Cincinnati", state: "OH", zipCode: "45211", salePrice: 280000, saleDate: "2026-07-15", listPrice: 285000, propertyType: "Single Family", bedrooms: 3, bathrooms: 2, squareFeet: 1400, yearBuilt: 1960, lotSize: 0, distanceMiles: 0.3, condition: "Average", garage: 0, basement: "", source: "TEST DATA", sourceLink: "", notes: "LOCAL TEST", included: false, verified: false, futureField: "preserved" };

test("backend comp normalization preserves linkage, explicit false/zero, aliases, and future fields", () => {
  const result = normalizePersistedComp(fixture);
  assert.equal(result.subjectDealId, "deal-123");
  assert.equal(result.included, false);
  assert.equal(result.lotSize, 0);
  assert.equal(result.garage, 0);
  assert.equal(result.futureField, "preserved");
});

test("persisted comp survives JSON store reload with stable ID and complete fields", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "rsos-comp-roundtrip-"));
  const file = path.join(directory, "comps.json");
  const persisted = normalizePersistedComp(fixture);
  await writeFile(file, JSON.stringify([persisted]), "utf8");
  const [reloaded] = JSON.parse(await readFile(file, "utf8"));
  assert.deepEqual(normalizePersistedComp(reloaded), persisted);
});

test("GET response mapping retains persistence fields while adding provider quality", () => {
  const result = mergeCompResponse(fixture, { address: fixture.compAddress, zip: fixture.zipCode, generatedProviderField: true }, { finalCompQualityScore: 88, qualityScore: 88 });
  assert.equal(result.id, "comp-1");
  assert.equal(result.compAddress, fixture.compAddress);
  assert.equal(result.subjectDealId, "deal-123");
  assert.equal(result.included, false);
  assert.equal(result.futureField, "preserved");
  assert.equal(result.generatedProviderField, true);
});

test("provider import idempotency matches stable provider ID only within the canonical subject", () => {
  const persisted = normalizePersistedComp({ ...fixture, providerImported: true, providerRecordId: "rentcast-123", inclusionStatus: "approved", included: false });
  const same = { ...persisted, id: "", providerRecordId: "rentcast-123" };
  assert.equal(findExistingProviderImport([persisted], same)?.id, "comp-1");
  assert.equal(findExistingProviderImport([persisted], { ...same, subjectDealId: "deal-other", dealId: "deal-other" }), null);
  assert.equal(findExistingProviderImport([persisted], { ...same, providerImported: false }), null);
});

test("provider import idempotency fallback requires matching address sale date and price", () => {
  const persisted = normalizePersistedComp({ ...fixture, providerImported: true, providerRecordId: "", inclusionStatus: "approved", included: false });
  assert.equal(findExistingProviderImport([persisted], { ...persisted, id: "", providerImported: true })?.id, "comp-1");
  assert.equal(findExistingProviderImport([persisted], { ...persisted, id: "", providerImported: true, salePrice: 281000 }), null);
});
