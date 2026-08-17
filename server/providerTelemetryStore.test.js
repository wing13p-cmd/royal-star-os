import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createProviderSearchSessionService } from "./providerSearchSessionService.js";
import { createProviderTelemetryStore } from "./providerTelemetryStore.js";

async function fixture() {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "rsos-provider-telemetry-"));
  const filePath = path.join(dir, "provider-search-telemetry.json");
  return { dir, filePath, store: createProviderTelemetryStore({ filePath, maxHistoryEntries: 3, maxCacheEntries: 2 }) };
}

function cachedService() {
  const service = createProviderSearchSessionService({ cacheTtlMs: 86400000, maxCacheEntries: 2 });
  service.setCachedResult("subject-a", { ok: true, records: [{ id: "comp-a" }] }, { lastLiveProviderRefresh: "2026-08-09T00:00:00.000Z", upstreamProviderRequests: 1 });
  service.recordUsage("rentcast", "sold-comps", "completed");
  return service;
}

test("valid cache, history, and usage survive a simulated restart", async () => {
  const { filePath, store } = await fixture();
  const service = cachedService();
  await store.persist({ history: [{ id: "search-1", provider: "rentcast" }], service: service.exportState() });
  const restoredStore = createProviderTelemetryStore({ filePath, maxCacheEntries: 2 });
  const state = await restoredStore.load();
  const restarted = createProviderSearchSessionService({ cacheTtlMs: 86400000, maxCacheEntries: 2 });
  restarted.hydrate(state.service);
  assert.equal(restarted.getCachedResult("subject-a").records[0].id, "comp-a");
  assert.equal(state.history.length, 1);
  assert.equal(state.service.usage.rentcast.successfulRequests, 1);
});

test("restored cache hit avoids another upstream retrieval and preserves absolute expiry", async () => {
  const { filePath, store } = await fixture();
  const service = cachedService();
  const before = service.exportState().cache[0].expiresAt;
  await store.persist({ history: [], service: service.exportState() });
  const restarted = createProviderSearchSessionService({ cacheTtlMs: 86400000, maxCacheEntries: 2 });
  restarted.hydrate((await store.load()).service);
  assert.equal(restarted.getCachedResultEntry("subject-a").status, "HIT");
  assert.equal(restarted.exportState().cache[0].expiresAt, before);
});

test("expired cache is discarded on hydration and never served fresh", async () => {
  const { filePath, store } = await fixture();
  await store.persist({ history: [], service: { sessions: [], usage: {}, cache: [{ cacheKey: "old", timestamp: 1, expiresAt: 2, value: { ok: true } }] } });
  const state = await store.load();
  assert.equal(state.service.cache.length, 0);
});

test("subject isolation, bounds, and in-flight exclusion survive persistence", async () => {
  const { filePath, store } = await fixture();
  const service = createProviderSearchSessionService({ cacheTtlMs: 86400000, maxCacheEntries: 2 });
  service.setCachedResult("a", { subject: "a" });
  service.setCachedResult("b", { subject: "b" });
  service.setCachedResult("c", { subject: "c" });
  service.setInFlight("c", Promise.resolve({ ok: true }));
  await store.persist({ history: [{ id: "1" }, { id: "2" }, { id: "3" }, { id: "4" }], service: service.exportState() });
  const state = await store.load();
  assert.equal(state.service.cache.length, 2);
  assert.equal(state.history.length, 3);
  assert.equal(JSON.stringify(state).includes("inFlight"), false);
  assert.equal(state.service.cache.some((entry) => entry.value.subject === "a"), false);
});

test("concurrent writes serialize with unique temporary files and preserve valid JSON", async () => {
  const { filePath, store } = await fixture();
  await Promise.all(Array.from({ length: 8 }, (_, index) => store.persist({ history: [{ id: String(index) }], service: { sessions: [], cache: [], usage: {} } })));
  const parsed = JSON.parse(await fs.readFile(filePath, "utf8"));
  assert.equal(parsed.schemaVersion, 1);
  assert.equal(Array.isArray(parsed.history), true);
  assert.equal((await fs.readdir(path.dirname(filePath))).some((name) => name.endsWith(".tmp")), false);
});

test("corrupt primary recovers from recovery copy and corrupt pair starts empty", async () => {
  const { filePath, store } = await fixture();
  await store.persist({ history: [{ id: "valid" }], service: { sessions: [], cache: [], usage: {} } });
  await fs.copyFile(filePath, `${filePath}.recovery`);
  await fs.writeFile(filePath, "not-json", "utf8");
  assert.equal((await store.load()).history[0].id, "valid");
  await fs.writeFile(`${filePath}.recovery`, "also-not-json", "utf8");
  assert.deepEqual((await store.load()).history, []);
});

test("future schema versions fail safely and supported schema remains credential-free", async () => {
  const { filePath, store } = await fixture();
  await fs.writeFile(filePath, JSON.stringify({ schemaVersion: 99, history: [{ secret: "no" }] }), "utf8");
  assert.deepEqual((await store.load()).history, []);
  await store.persist({ history: [{ provider: "rentcast", diagnostics: { cacheStatus: "HIT" } }], service: { sessions: [], cache: [], usage: {} } });
  const text = await fs.readFile(filePath, "utf8");
  assert.equal(text.includes("RENTCAST_API_KEY"), false);
  assert.equal(text.includes("Authorization"), false);
  assert.equal(text.includes("sessionToken"), false);
});
