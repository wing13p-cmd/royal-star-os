import test from "node:test";
import assert from "node:assert/strict";
import { createProviderSearchSessionService } from "./providerSearchSessionService.js";

test("provider search session service tracks session state, retries, and usage", () => {
  const service = createProviderSearchSessionService({ maxStoredSessions: 10, cacheTtlMs: 60_000 });
  const session = service.createSession({ provider: "rentcast", operation: "sold-comps", query: { address: "123 Main St" }, status: "running" });

  assert.equal(session.provider, "rentcast");
  assert.equal(session.status, "running");

  const canceled = service.cancelSession(session.id);
  assert.equal(canceled.status, "canceled");

  const retry = service.retrySession(session.id);
  assert.equal(retry.parentSessionId, session.id);
  assert.equal(retry.status, "queued");

  const stored = service.getSession(retry.id);
  assert.equal(stored?.id, retry.id);

  service.snapshotSession(retry.id, { status: "completed", resultCount: 2 });
  const recorded = service.recordResult(retry.id, { status: "completed", resultCount: 2, cachedResults: false, requestDurationMs: 42, lastError: "" });
  assert.equal(recorded.resultCount, 2);
  assert.equal(recorded.status, "completed");

  service.setCachedResult("sold-comps:rentcast:123", { resultCount: 2 });
  const cached = service.getCachedResult("sold-comps:rentcast:123");
  assert.deepEqual(cached, { resultCount: 2 });

  const usage = service.recordUsage("rentcast", "sold-comps", "completed");
  assert.equal(usage.successfulRequests, 1);

  const summary = service.getSummary();
  assert.ok(summary.latestSession);
  assert.equal(summary.usage.rentcast.operations["sold-comps"], 1);
});

test("cache entries expose HIT/MISS/EXPIRED metadata and remain bounded", async () => {
  let clock = 0;
  const originalNow = Date.now;
  Date.now = () => clock;
  try {
    const service = createProviderSearchSessionService({ cacheTtlMs: 100, maxCacheEntries: 2 });
    assert.equal(service.getCachedResultEntry("missing").status, "MISS");
    service.setCachedResult("a", { resultCount: 1 }, { upstreamProviderRequests: 2 });
    assert.equal(service.getCachedResultEntry("a").status, "HIT");
    assert.equal(service.getCachedResultEntry("a").metadata.upstreamProviderRequests, 2);
    clock = 101;
    assert.equal(service.getCachedResultEntry("a").status, "EXPIRED");
    assert.equal(service.getCachedResultEntry("a", { includeExpired: true }).value.resultCount, 1);
    service.setCachedResult("b", {});
    service.setCachedResult("c", {});
    assert.equal(service.getCachedResult("a"), null);
  } finally {
    Date.now = originalNow;
  }
});

test("identical in-flight cache keys coalesce to one promise", async () => {
  const service = createProviderSearchSessionService();
  let calls = 0;
  const first = (async () => { calls += 1; await new Promise((resolve) => setTimeout(resolve, 2)); return { ok: true }; })();
  service.setInFlight("same", first);
  const second = service.getInFlight("same");
  assert.equal(second, first);
  assert.deepEqual(await Promise.all([first, second]), [{ ok: true }, { ok: true }]);
  assert.equal(calls, 1);
});

test("identical completed searches reuse cached result without another upstream call", () => {
  const service = createProviderSearchSessionService({ cacheTtlMs: 86400000 });
  let upstreamCalls = 0;
  const key = "rentcast-sold-comps-v3|deal-1|property-1|952 goss rd|singlefamily|radius:1.5|saleDays:548";
  const retrieve = () => { upstreamCalls += 1; return { providerRecords: [{ id: "p1" }], diagnostics: { pagesRetrieved: 1 } }; };
  const first = service.getCachedResultEntry(key);
  assert.equal(first.status, "MISS");
  const result = retrieve();
  service.setCachedResult(key, result, { upstreamProviderRequests: 1 });
  const second = service.getCachedResultEntry(key);
  assert.equal(second.status, "HIT");
  assert.equal(second.value.providerRecords.length, 1);
  assert.equal(upstreamCalls, 1);
});

test("summary exposes safe coordinate-backed subject evidence for reload hydration", () => {
  const service = createProviderSearchSessionService();
  service.setCachedResult("subject-property:rentcast:952 goss rd", { property: {
    provider: "rentcast", providerRecordId: "goss-1", address: "952 Goss Rd", city: "Cincinnati", state: "OH", zip: "45229",
    latitude: 39.146737, longitude: -84.482759, propertyType: "Single Family", squareFeet: 1562, bedrooms: 4, bathrooms: 2.5,
    sourceSnapshot: { secret: "must-not-be-exposed" },
  }});
  const summary = service.getSummary();
  assert.equal(summary.subjectProperties.length, 1);
  assert.equal(summary.subjectProperties[0].latitude, 39.146737);
  assert.equal(summary.subjectProperties[0].longitude, -84.482759);
  assert.equal("sourceSnapshot" in summary.subjectProperties[0], false);
});
