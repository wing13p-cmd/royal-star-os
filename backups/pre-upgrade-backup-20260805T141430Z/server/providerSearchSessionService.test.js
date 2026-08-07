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
