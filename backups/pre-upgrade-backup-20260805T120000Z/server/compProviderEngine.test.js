import test from "node:test";
import assert from "node:assert/strict";

import {
  ManualCompAdapter,
  RentCastCompAdapter,
  buildCompProviderConfig,
  buildNormalizedCompRecord,
  scoreCompQuality,
} from "./compProviderEngine.js";

test("manual adapter exposes a safe review-ready status", async () => {
  const adapter = new ManualCompAdapter();
  const status = adapter.getProviderStatus();
  assert.equal(status.provider, "manual");
  assert.equal(status.status, "Manual Entry Ready");
  const connection = await adapter.testConnection();
  assert.equal(connection.ok, true);
});

test("rentcast adapter reports not configured without a key", async () => {
  const adapter = new RentCastCompAdapter(buildCompProviderConfig({}));
  const status = adapter.getProviderStatus();
  assert.equal(status.status, "Provider Not Configured");
  const connection = await adapter.testConnection();
  assert.equal(connection.ok, false);
  assert.equal(connection.status, "Provider Not Configured");
});

test("normalized comp records preserve review state and quality scoring", () => {
  const record = buildNormalizedCompRecord(
    {
      address: "123 Test St",
      salePrice: 250000,
      saleDate: "2024-01-10",
      squareFeet: 1600,
      bedrooms: 3,
      bathrooms: 2,
      yearBuilt: 1985,
      source: "Provider Import",
      providerImported: true,
      verified: false,
    },
    {
      address: "123 Test St",
      city: "Cincinnati",
      state: "OH",
      zipCode: "45229",
      propertyType: "Single Family",
      bedrooms: 3,
      bathrooms: 2,
      squareFeet: 1600,
      yearBuilt: 1929,
    },
    "rentcast",
  );

  assert.equal(record.provider, "rentcast");
  assert.equal(record.manuallyEntered, false);
  assert.equal(record.providerImported, true);
  assert.equal(record.verified, false);
  assert.equal(record.inclusionStatus, "pending");
  const score = scoreCompQuality(record, {
    squareFeet: 1600,
    bedrooms: 3,
    bathrooms: 2,
    yearBuilt: 1929,
    propertyType: "Single Family",
  });
  assert.ok(score.finalCompQualityScore >= 0);
  assert.ok(score.inclusionRecommendation === "Strong Comp" || score.inclusionRecommendation === "Supporting Comp" || score.inclusionRecommendation === "Weak Comp");
});

test("rentcast adapter reports unauthorized credentials without leaking them", async () => {
  const adapter = new RentCastCompAdapter(buildCompProviderConfig({
    rentcastApiKey: "test-key",
    fetchImpl: async () => ({
      ok: false,
      status: 401,
      text: async () => JSON.stringify({ status: 401, error: "auth/api-key-invalid", message: "Invalid API key" }),
    }),
  }));
  const result = await adapter.testConnection();
  assert.equal(result.ok, false);
  assert.equal(result.status, "Unauthorized");
  assert.equal(result.errorCode, "unauthorized");
});

test("rentcast adapter normalizes mocked sold-comps into review-ready records", async () => {
  const adapter = new RentCastCompAdapter(buildCompProviderConfig({
    rentcastApiKey: "test-key",
    fetchImpl: async () => ({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({
        properties: [{
          address: "123 Test St",
          city: "Cincinnati",
          state: "OH",
          zip: "45229",
          propertyType: "Single Family",
          bedrooms: 3,
          bathrooms: 2,
          squareFeet: 1600,
          yearBuilt: 1985,
          saleDate: "2024-01-10",
          salePrice: 250000,
          latitude: 39.1,
          longitude: -84.5,
          status: "sold",
        }],
      }),
    }),
  }));
  const results = await adapter.searchSoldComparables({ address: "123 Test St", city: "Cincinnati", state: "OH", radiusMiles: 0.5, months: 6 });
  assert.equal(results.length, 1);
  assert.equal(results[0].providerImported, true);
  assert.equal(results[0].verified, false);
  assert.equal(results[0].inclusionStatus, "pending");
  assert.equal(results[0].status, "closed");
});
