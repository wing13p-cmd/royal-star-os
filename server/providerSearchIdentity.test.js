import test from "node:test";
import assert from "node:assert/strict";
import { buildSoldCompCacheKey, normalizeCacheCoordinate } from "./providerSearchIdentity.js";
import { createProviderSearchSessionService } from "./providerSearchSessionService.js";

const baseQuery = { subjectDealId: "deal-1", propertyId: "property-1", address: "952 Goss Rd", city: "Cincinnati", state: "OH", zipCode: "45229", propertyType: "Single Family" };

test("missing coordinates use one explicit identity token and never become zero", () => {
  assert.equal(normalizeCacheCoordinate(null), "missing");
  assert.equal(normalizeCacheCoordinate(undefined), "missing");
  assert.equal(normalizeCacheCoordinate(""), "missing");
  assert.equal(normalizeCacheCoordinate("not-a-coordinate"), "missing");
  const key = buildSoldCompCacheKey({ ...baseQuery, latitude: "", longitude: undefined });
  assert.match(key, /\|missing\|missing\|/);
  assert.doesNotMatch(key, /0\.000000/);
});

test("real coordinates remain deterministic and legitimate zero is preserved", () => {
  assert.equal(normalizeCacheCoordinate("39.146737"), "39.146737");
  assert.equal(normalizeCacheCoordinate(0), "0.000000");
  assert.equal(normalizeCacheCoordinate(-84.482759), "-84.482759");
  const key = buildSoldCompCacheKey({ ...baseQuery, latitude: 39.146737, longitude: -84.482759 });
  assert.match(key, /\|39\.146737\|-84\.482759\|/);
});

test("reload-equivalent subject inputs generate the same coordinate-backed cache identity", () => {
  const immediate = buildSoldCompCacheKey({ ...baseQuery, latitude: 39.146737, longitude: -84.482759 });
  const restored = buildSoldCompCacheKey({ ...baseQuery, latitude: "39.146737", longitude: "-84.482759" });
  assert.equal(restored, immediate);
});

test("restored coordinate-backed Goss cache reuses 346 records and 14 qualifying results without upstream work", () => {
  const service = createProviderSearchSessionService({ cacheTtlMs: 86400000 });
  const key = buildSoldCompCacheKey({ ...baseQuery, latitude: 39.146737, longitude: -84.482759 });
  service.hydrate({ cache: [{ cacheKey: key, timestamp: Date.now(), expiresAt: Date.now() + 86400000, value: {
    providerCandidateCount: 346, qualifyingCandidateCount: 14, records: Array.from({ length: 14 }, (_, index) => ({ id: `comp-${index}` })),
  }}] });
  let upstreamCalls = 0;
  const cached = service.getCachedResultEntry(key);
  if (cached.status === "HIT") upstreamCalls += 0;
  assert.equal(cached.status, "HIT");
  assert.equal(cached.value.providerCandidateCount, 346);
  assert.equal(cached.value.qualifyingCandidateCount, 14);
  assert.equal(cached.value.records.length, 14);
  assert.equal(upstreamCalls, 0);
});
