import test from "node:test";
import assert from "node:assert/strict";

import {
  ManualCompAdapter,
  RentCastCompAdapter,
  buildCompProviderConfig,
  buildNormalizedCompRecord,
  scoreCompQuality,
  SOLD_COMP_SEARCH_TIERS,
} from "./compProviderEngine.js";

test("progressive sold-comp tiers are bounded and preserve the Royal Star criteria", () => {
  assert.deepEqual(SOLD_COMP_SEARCH_TIERS.map(({ radiusMiles, months, squareFeetVariance }) => [radiusMiles, months, squareFeetVariance]), [
    [0.5, 6, 0.2], [1, 12, 0.2], [1, 12, 0.3], [1.5, 18, 0.3],
  ]);
});

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
  assert.equal(status.status, "RentCast Not Configured");
  const connection = await adapter.testConnection();
  assert.equal(connection.ok, false);
  assert.equal(connection.status, "RentCast Not Configured");
});

test("RentCast key selects RentCast when no explicit provider override exists", () => {
  const config = buildCompProviderConfig({ env: { RENTCAST_API_KEY: "test-key" } });
  assert.equal(config.provider, "rentcast");
  assert.equal(new RentCastCompAdapter(config).getProviderStatus().configured, true);
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
  assert.equal(result.status, "RentCast API Key Invalid or Unauthorized");
  assert.equal(result.errorCode, "unauthorized");
});

test("rentcast adapter uses current property endpoints and safely classifies limits", async () => {
  const requests = [];
  const adapter = new RentCastCompAdapter(buildCompProviderConfig({
    rentcastApiKey: "test-key",
    fetchImpl: async (url) => {
      requests.push(String(url));
      const soldSearch = String(url).includes("saleDateRange");
      return { ok: true, status: 200, text: async () => JSON.stringify([{ id: soldSearch ? "p2" : "p1", formattedAddress: soldSearch ? "5502 Grand Lake Dr, San Antonio, TX 78244" : "5500 Grand Lake Dr, San Antonio, TX 78244", city: "San Antonio", state: "TX", zipCode: "78244", squareFootage: 1878, bedrooms: 3, bathrooms: 2, lastSalePrice: 250000, lastSaleDate: "2026-07-15", propertyType: "Single Family", distance: 0.3 }]) };
    },
  }));
  assert.equal((await adapter.testConnection()).ok, true);
  assert.equal((await adapter.getSubjectProperty("5500 Grand Lake Dr, San Antonio, TX, 78244")).property.squareFeet, 1878);
  const comps = await adapter.searchSoldComparables({ address: "5500 Grand Lake Dr", city: "San Antonio", state: "TX", zipCode: "78244", radiusMiles: 0.5, months: 6, maxResults: 10, propertyType: "Single Family", squareFeet: 1878, bedrooms: 3, bathrooms: 2, now: "2026-08-09" });
  assert.equal(comps[0].salePrice, 250000);
  assert.match(requests[0], /\/v1\/properties\/random\?limit=1/);
  assert.match(requests[1], /\/v1\/properties\?address=/);
  assert.match(requests[2], /saleDateRange=548/);
  assert.match(requests[2], /propertyType=Single%20Family/);
  assert.match(requests[2], /limit=500/);
  assert.match(requests[2], /offset=0/);

  const limited = new RentCastCompAdapter(buildCompProviderConfig({ rentcastApiKey: "test-key", fetchImpl: async () => ({ ok: false, status: 429, text: async () => "{}" }) }));
  const result = await limited.testConnection();
  assert.equal(result.errorCode, "rate_limited");
  assert.equal(result.status, "RentCast Rate or Usage Limit Reached");
});

test("rentcast adapter normalizes mocked sold-comps into review-ready records", async () => {
  const adapter = new RentCastCompAdapter(buildCompProviderConfig({
    rentcastApiKey: "test-key",
    fetchImpl: async () => ({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({
        properties: [{
          address: "125 Test St",
          city: "Cincinnati",
          state: "OH",
          zip: "45229",
          propertyType: "Single Family",
          bedrooms: 3,
          bathrooms: 2,
          squareFeet: 1600,
          yearBuilt: 1985,
          lastSaleDate: "2024-01-10",
          lastSalePrice: 250000,
          latitude: 39.1,
          longitude: -84.5,
          distance: 0.2,
          status: "sold",
        }],
      }),
    }),
  }));
  const results = await adapter.searchSoldComparables({ address: "123 Test St", city: "Cincinnati", state: "OH", propertyType: "Single Family", bedrooms: 3, bathrooms: 2, squareFeet: 1600, radiusMiles: 0.5, months: 6, now: "2024-03-01" });
  assert.equal(results.length, 1);
  assert.equal(results[0].providerImported, true);
  assert.equal(results[0].verified, false);
  assert.equal(results[0].inclusionStatus, "pending");
  assert.equal(results[0].status, "closed");
  assert.deepEqual(results[0].media, []);
  assert.equal(results[0].mediaAvailability.status, "NOT_PROVIDED");
  assert.match(results[0].mediaAvailability.reason, /RentCast property records do not include photo fields/);
});

test("provider media references are normalized without granting storage or export rights", () => {
  const record = buildNormalizedCompRecord({
    provider: "licensed-test-provider",
    photos: ["https://example.test/front.jpg", { photoUrl: "https://example.test/kitchen.jpg", caption: "Kitchen" }],
  });
  assert.equal(record.media.length, 2);
  assert.equal(record.media[0].rightsMode, "REMOTE_REFERENCE_ONLY");
  assert.equal(record.media[0].localStorageAllowed, false);
  assert.equal(record.media[1].label, "Kitchen");
  assert.equal(record.mediaAvailability.status, "AVAILABLE");
});

test("Goss-style candidates progress through tiers, deduplicate, and preserve review governance", async () => {
  const candidates = [
    { id: "tier2", formattedAddress: "950 Nearby Rd, Cincinnati, OH 45229", propertyType: "Single Family", bedrooms: 4, bathrooms: 2, squareFootage: 1500, lastSalePrice: 280000, lastSaleDate: "2025-12-01", distance: 0.7 },
    { id: "tier3", formattedAddress: "951 Nearby Rd, Cincinnati, OH 45229", propertyType: "Single Family", bedrooms: 4, bathrooms: 2, squareFootage: 1990, lastSalePrice: 270000, lastSaleDate: "2025-12-01", distance: 0.8 },
    { id: "tier4", formattedAddress: "956 Nearby Rd, Cincinnati, OH 45229", propertyType: "Single Family", bedrooms: 4, bathrooms: 2, squareFootage: 1500, lastSalePrice: 265000, lastSaleDate: "2025-04-01", distance: 1.2 },
    { id: "stale", formattedAddress: "957 Nearby Rd, Cincinnati, OH 45229", propertyType: "Single Family", bedrooms: 4, bathrooms: 2, squareFootage: 1500, lastSalePrice: 270000, lastSaleDate: "2024-01-01", distance: 0.2 },
    { id: "missing-sale", formattedAddress: "953 Nearby Rd, Cincinnati, OH 45229", propertyType: "Single Family", bedrooms: 4, bathrooms: 2, squareFootage: 1500, distance: 0.2 },
    { id: "wrong-type", formattedAddress: "954 Nearby Rd, Cincinnati, OH 45229", propertyType: "Multi-Family", bedrooms: 4, bathrooms: 2, squareFootage: 1500, lastSalePrice: 260000, lastSaleDate: "2026-07-01", distance: 0.2 },
    { id: "too-distant", formattedAddress: "955 Nearby Rd, Cincinnati, OH 45229", propertyType: "Single Family", bedrooms: 4, bathrooms: 2, squareFootage: 1500, lastSalePrice: 290000, lastSaleDate: "2026-07-01", distance: 2 },
  ];
  let requests = 0;
  const adapter = new RentCastCompAdapter(buildCompProviderConfig({ rentcastApiKey: "test-key", fetchImpl: async () => { requests += 1; return { ok: true, status: 200, text: async () => JSON.stringify(candidates) }; } }));
  const result = await adapter.searchSoldComparablesDetailed({ address: "952 Goss Rd", city: "Cincinnati", state: "OH", zipCode: "45229", propertyType: "Single Family", bedrooms: 4, bathrooms: 2.5, squareFeet: 1562, radiusMiles: 0.5, months: 6, maxResults: 10, now: "2026-08-09" });
  assert.equal(result.ok, true);
  assert.equal(result.providerCandidates.length, 7);
  assert.equal(result.qualifyingCandidates.length, 3);
  assert.deepEqual(result.qualifyingCandidates.map((entry) => entry.searchTier), [2, 3, 4]);
  assert.deepEqual(result.tierCounts, { 1: 0, 2: 1, 3: 1, 4: 1 });
  assert.deepEqual(result.tiersRun, [1, 2, 3, 4]);
  assert.equal(requests, 1);
  assert.equal(new Set(result.qualifyingCandidates.map((entry) => entry.providerRecordId)).size, 3);
  assert.ok(result.rejectedCandidates.some((entry) => entry.reasons.includes("sale is older than 18 months")));
  assert.ok(result.rejectedCandidates.some((entry) => entry.reasons.includes("missing closed-sale date or price")));
  assert.ok(result.rejectedCandidates.some((entry) => entry.reasons.includes("property-type mismatch")));
  assert.ok(result.rejectedCandidates.some((entry) => entry.reasons.includes("distance exceeds 1.5 miles")));
  for (const candidate of result.qualifyingCandidates) {
    assert.equal(candidate.verified, false);
    assert.equal(candidate.inclusionStatus, "pending");
    assert.equal(candidate.included, false);
    assert.ok(candidate.searchTierLabel);
    assert.ok(candidate.similarityScore > 0);
    assert.ok(candidate.acceptanceReasons.length);
  }
});

test("progressive search stops before later tiers once three review candidates qualify", async () => {
  const candidates = [1, 2, 3].map((index) => ({ id: `strict-${index}`, formattedAddress: `${900 + index} Nearby Rd, Cincinnati, OH 45229`, propertyType: "Single Family", bedrooms: 4, bathrooms: 2.5, squareFootage: 1562, lastSalePrice: 280000 + index, lastSaleDate: "2026-07-01", distance: 0.2 + index * 0.05 }));
  let requests = 0;
  const adapter = new RentCastCompAdapter(buildCompProviderConfig({ rentcastApiKey: "test-key", fetchImpl: async () => { requests += 1; return { ok: true, status: 200, text: async () => JSON.stringify(candidates) }; } }));
  const result = await adapter.searchSoldComparablesDetailed({ address: "952 Goss Rd", city: "Cincinnati", state: "OH", propertyType: "Single Family", bedrooms: 4, bathrooms: 2.5, squareFeet: 1562, now: "2026-08-09" });
  assert.equal(requests, 1);
  assert.deepEqual(result.tiersRun, [1]);
  assert.deepEqual(result.tierCounts, { 1: 3, 2: 0, 3: 0, 4: 0 });
  assert.ok(result.qualifyingCandidates.every((candidate) => candidate.searchTier === 1));
});

test("RentCast pagination retrieves and ranks a strong page-two comp before weaker page-one evidence", async () => {
  const pages = [
    [
      { id: "weak-1", formattedAddress: "1524 Jonathan Ave, Cincinnati, OH 45207", propertyType: "Single Family", bedrooms: 3, bathrooms: 2.5, squareFootage: 1954, lastSalePrice: 320000, lastSaleDate: "2026-01-27", distance: 0.373 },
      { id: "weak-2", formattedAddress: "1864 Hewitt Ave, Cincinnati, OH 45207", propertyType: "Single Family", bedrooms: 4, bathrooms: 1.5, squareFootage: 1922, lastSalePrice: 420000, lastSaleDate: "2025-05-26", distance: 0.989 },
    ],
    [{ id: "strong-page-2", formattedAddress: "954 Goss Rd, Cincinnati, OH 45229", propertyType: "Single Family Residential", bedrooms: 4, bathrooms: 2.5, squareFootage: 1580, lastSalePrice: 285000, lastSaleDate: "2026-07-15", distance: 0.1 }],
  ];
  const requests = [];
  const adapter = new RentCastCompAdapter(buildCompProviderConfig({ rentcastApiKey: "test-key", fetchImpl: async (url) => {
    requests.push(String(url));
    const offset = Number(new URL(String(url)).searchParams.get("offset"));
    const payload = offset === 0 ? pages[0] : pages[1];
    return { ok: true, status: 200, text: async () => JSON.stringify(payload) };
  } }));
  const result = await adapter.searchSoldComparablesDetailed({ address: "952 Goss Rd", city: "Cincinnati", state: "OH", zipCode: "45229", propertyType: "Single-Family", bedrooms: 4, bathrooms: 2.5, squareFeet: 1562, now: "2026-08-09", providerPageSize: 2 });
  assert.equal(requests.length, 2);
  assert.match(requests[0], /radius=1\.5/);
  assert.match(requests[0], /saleDateRange=548/);
  assert.match(requests[1], /offset=2/);
  assert.equal(result.diagnostics.pagesRetrieved, 2);
  assert.equal(result.qualifyingCandidates[0].providerRecordId, "strong-page-2");
  assert.equal(result.qualifyingCandidates[0].searchTier, 1);
  assert.ok(result.qualifyingCandidates[0].similarityScore > result.qualifyingCandidates.at(-1).similarityScore);
  assert.equal(result.qualifyingCandidates.at(-1).tierTrace[0].accepted, false);
  assert.equal(result.qualifyingCandidates.at(-1).tierTrace.at(-1).accepted, true);
});

test("closed-sale truth rejects generic prices, future dates, and missing location/type evidence", async () => {
  const records = [
    { id: "generic-price", formattedAddress: "1 Generic Price Ave, Cincinnati, OH 45229", propertyType: "Single Family", bedrooms: 4, bathrooms: 2.5, squareFootage: 1562, price: 300000, lastSaleDate: "2026-07-01", distance: 0.2 },
    { id: "future-date", formattedAddress: "2 Future Ave, Cincinnati, OH 45229", propertyType: "Single Family", bedrooms: 4, bathrooms: 2.5, squareFootage: 1562, lastSalePrice: 300000, lastSaleDate: "2027-01-01", distance: 0.2 },
    { id: "missing-distance", formattedAddress: "3 Missing Distance Ave, Cincinnati, OH 45229", propertyType: "Single Family", bedrooms: 4, bathrooms: 2.5, squareFootage: 1562, lastSalePrice: 300000, lastSaleDate: "2026-07-01" },
    { id: "missing-type", formattedAddress: "4 Missing Type Ave, Cincinnati, OH 45229", bedrooms: 4, bathrooms: 2.5, squareFootage: 1562, lastSalePrice: 300000, lastSaleDate: "2026-07-01", distance: 0.2 },
  ];
  const adapter = new RentCastCompAdapter(buildCompProviderConfig({ rentcastApiKey: "test-key", fetchImpl: async () => ({ ok: true, status: 200, text: async () => JSON.stringify(records) }) }));
  const result = await adapter.searchSoldComparablesDetailed({ address: "952 Goss Rd", city: "Cincinnati", state: "OH", propertyType: "Single Family", bedrooms: 4, bathrooms: 2.5, squareFeet: 1562, now: "2026-08-09" });
  assert.equal(result.qualifyingCandidates.length, 0);
  const byId = Object.fromEntries(result.rejectedCandidates.map((entry) => [entry.providerRecordId, entry.reasons]));
  assert.ok(byId["generic-price"].includes("missing closed-sale date or price"));
  assert.ok(byId["future-date"].includes("invalid future closed-sale date"));
  assert.ok(byId["missing-distance"].includes("missing distance evidence"));
  assert.ok(byId["missing-type"].includes("missing property type"));
  assert.equal(result.providerCandidates.find((entry) => entry.providerRecordId === "missing-distance").distanceMiles, null);
  assert.equal(result.providerCandidates.find((entry) => entry.providerRecordId === "missing-type").propertyType, "");
  assert.deepEqual({ invalid: result.diagnostics.invalidSaleRecords, future: result.diagnostics.futureSaleRecords, distance: result.diagnostics.missingDistanceRecords, type: result.diagnostics.missingPropertyTypeRecords }, { invalid: 1, future: 1, distance: 1, type: 1 });
});

test("property aliases match intentionally while unrelated types do not", async () => {
  const records = [
    { id: "sfr", formattedAddress: "1 SFR Ave, Cincinnati, OH 45229", propertyType: "SFR", bedrooms: 4, bathrooms: 2.5, squareFootage: 1562, lastSalePrice: 280000, lastSaleDate: "2026-07-01", distance: 0.2 },
    { id: "residential", formattedAddress: "2 Residential Ave, Cincinnati, OH 45229", propertyType: "Single Family Residential", bedrooms: 4, bathrooms: 2.5, squareFootage: 1562, lastSalePrice: 281000, lastSaleDate: "2026-07-01", distance: 0.2 },
    { id: "condo", formattedAddress: "3 Condo Ave, Cincinnati, OH 45229", propertyType: "Condo", bedrooms: 4, bathrooms: 2.5, squareFootage: 1562, lastSalePrice: 282000, lastSaleDate: "2026-07-01", distance: 0.2 },
  ];
  const adapter = new RentCastCompAdapter(buildCompProviderConfig({ rentcastApiKey: "test-key", fetchImpl: async () => ({ ok: true, status: 200, text: async () => JSON.stringify(records) }) }));
  const result = await adapter.searchSoldComparablesDetailed({ address: "952 Goss Rd", city: "Cincinnati", state: "OH", propertyType: "Single-Family Residential", bedrooms: 4, bathrooms: 2.5, squareFeet: 1562, now: "2026-08-09" });
  assert.deepEqual(result.qualifyingCandidates.map((entry) => entry.providerRecordId).sort(), ["residential", "sfr"]);
  assert.ok(result.rejectedCandidates.find((entry) => entry.providerRecordId === "condo").reasons.includes("property-type mismatch"));
});

test("same sale event under different provider IDs deduplicates while an older historical event remains auditable but cannot count twice", async () => {
  const records = [
    { id: "duplicate-a", formattedAddress: "100 Duplicate Ave, Cincinnati, OH 45229", propertyType: "Single Family", bedrooms: 4, bathrooms: 2.5, squareFootage: 1562, lastSalePrice: 280000, lastSaleDate: "2026-07-01", distance: 0.2 },
    { id: "duplicate-b", formattedAddress: "100 DUPLICATE AVENUE, Cincinnati, OH 45229", propertyType: "Single Family", bedrooms: 4, bathrooms: 2.5, squareFootage: 1562, lastSalePrice: 280000, lastSaleDate: "2026-07-01", distance: 0.2 },
    { id: "historical-event", formattedAddress: "100 Duplicate Ave, Cincinnati, OH 45229", propertyType: "Single Family", bedrooms: 4, bathrooms: 2.5, squareFootage: 1562, lastSalePrice: 260000, lastSaleDate: "2025-10-01", distance: 0.2 },
  ];
  const adapter = new RentCastCompAdapter(buildCompProviderConfig({ rentcastApiKey: "test-key", fetchImpl: async () => ({ ok: true, status: 200, text: async () => JSON.stringify(records) }) }));
  const result = await adapter.searchSoldComparablesDetailed({ address: "952 Goss Rd", city: "Cincinnati", state: "OH", propertyType: "Single Family", bedrooms: 4, bathrooms: 2.5, squareFeet: 1562, now: "2026-08-09" });
  assert.equal(result.providerCandidates.length, 2);
  assert.equal(result.diagnostics.deduplicatedRecords, 1);
  assert.equal(result.diagnostics.supersededSaleEvents, 1);
  assert.equal(result.qualifyingCandidates.length, 1);
  assert.ok(result.rejectedCandidates.find((entry) => entry.providerRecordId === "historical-event").reasons.includes("superseded historical sale event"));
});

test("provider pagination ends on a short page and reports a bounded cap without looping", async () => {
  const record = (id) => ({ id, formattedAddress: `${id} Test Ave, Cincinnati, OH 45229`, propertyType: "Single Family", bedrooms: 4, bathrooms: 2.5, squareFootage: 1562, lastSalePrice: 280000, lastSaleDate: "2026-07-01", distance: 0.2 });
  let endRequests = 0;
  const ending = new RentCastCompAdapter(buildCompProviderConfig({ rentcastApiKey: "test-key", fetchImpl: async () => ({ ok: true, status: 200, text: async () => JSON.stringify(endRequests++ === 0 ? [record("a"), record("b")] : [record("c")]) }) }));
  const ended = await ending.searchSoldComparablesDetailed({ address: "952 Goss Rd", propertyType: "Single Family", bedrooms: 4, bathrooms: 2.5, squareFeet: 1562, now: "2026-08-09", providerPageSize: 2 });
  assert.equal(endRequests, 2);
  assert.equal(ended.diagnostics.providerCapReached, false);

  let cappedRequests = 0;
  const capped = new RentCastCompAdapter(buildCompProviderConfig({ rentcastApiKey: "test-key", fetchImpl: async () => ({ ok: true, status: 200, text: async () => JSON.stringify([record(`p${cappedRequests}-a`), record(`p${cappedRequests++}-b`)]) }) }));
  const capResult = await capped.searchSoldComparablesDetailed({ address: "952 Goss Rd", propertyType: "Single Family", bedrooms: 4, bathrooms: 2.5, squareFeet: 1562, now: "2026-08-09", providerPageSize: 2, providerMaxPages: 2 });
  assert.equal(cappedRequests, 2);
  assert.equal(capResult.diagnostics.providerCapReached, true);
  assert.equal(capResult.diagnostics.providerPageCap, 2);
  assert.equal(capResult.diagnostics.providerRecordCap, 4);
});
