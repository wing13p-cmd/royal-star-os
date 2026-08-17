import test from "node:test";
import assert from "node:assert/strict";
import { buildCompEvidenceReport, createCompEvidenceEngine } from "./compEvidenceEngine.js";

test("evidence report preserves review-first governance and detects material conflicts", () => {
  const report = buildCompEvidenceReport({
    comp: { id: "comp-1", provider: "rentcast", compAddress: "1 Main St", salePrice: 250000, saleDate: "2026-01-01", squareFeet: 1400, distanceMiles: 0.4 },
    sources: { countyProperty: [{ buildingSize: 1800, yearBuilt: 1930, taxAssessment: 160000, saleHistory: [{ salePrice: 190000, saleDate: "2025-12-01" }] }], countyRecorder: [{ recordedDeeds: [{ deedType: "Warranty Deed" }] }] },
    retrievedAt: "2026-08-10T00:00:00.000Z",
  });
  assert.equal(report.reviewRequired, true);
  assert.equal(report.autoApproved, false);
  assert.equal(report.recommendation, "NEEDS_REVIEW");
  assert.ok(report.discrepancies.some((item) => item.field === "salePrice" && item.severity === "blocking"));
  assert.ok(report.provenance.every((item) => item.source && item.retrievedAt));
});

test("authorized media policy retains references without storing provider imagery", () => {
  const report = buildCompEvidenceReport({ comp: { id: "comp-2", provider: "rentcast", salePrice: 200000, saleDate: "2026-01-01", media: [{ url: "https://example.com/photo.jpg", label: "Listing photo" }] } });
  assert.equal(report.media.length, 1);
  assert.equal(report.media[0].rightsMode, "REMOTE_REFERENCE_ONLY");
  assert.equal(report.media[0].localStorageAllowed, false);
  assert.equal(report.media[0].includeInAppraiserPacket, false);
});

test("evidence engine caches provider enrichment and recommends approval only as advisory", async () => {
  let calls = 0;
  const adapter = { async searchProperty() { calls += 1; return { records: [{ buildingSize: 1500, yearBuilt: 1940, taxAssessment: 180000, saleHistory: [{ salePrice: 240000, saleDate: "2026-02-01" }] }] }; } };
  const engine = createCompEvidenceEngine({ providerAdapters: { countyProperty: adapter } });
  const comp = { id: "comp-3", provider: "rentcast", salePrice: 240000, saleDate: "2026-02-01", squareFeet: 1500, distanceMiles: 0.2, listingHistory: [{ status: "Sold" }], notes: "Renovated kitchen" };
  const first = await engine.verify(comp);
  const second = await engine.verify(comp);
  assert.equal(calls, 1);
  assert.equal(second.cached, true);
  assert.equal(first.autoApproved, false);
  assert.equal(first.reviewRequired, true);
  assert.equal(first.recommendation, "APPROVE");
});
