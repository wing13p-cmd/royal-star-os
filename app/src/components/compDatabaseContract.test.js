import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  buildCompCreatePayload, buildCompReviewCounts, buildCompStatistics, buildProviderCandidateApprovalPayload, filterCompsForSubject,
  findPersistedProviderCandidate, findPersistedProviderSubject, formatProviderSaleDate, getProviderReviewCandidate, getProviderReviewCandidateKey, importProviderCandidateTransaction, isConfirmedPersistedComp, normalizeCompRecord, normalizeProviderReviewCandidates, persistCompViaApi,
  persistedCompMatchesProviderCandidate, rejectProviderReviewCandidate,
} from "./compDatabaseContract.js";
import { buildAppraisalIntelligenceResult } from "./appraisalIntelligenceEngine.js";

const subject = { id: "deal-123", propertyId: "property-123", address: "123 test st", city: "Cincinnati", state: "OH", zipCode: "45211", propertyType: "Single Family", bedrooms: 3, bathrooms: 2, squareFeet: 1400, yearBuilt: 1960, arv: 280000, strategy: "Flip" };
const fixture = { compAddress: "100 Test Comp Ave", city: "Cincinnati", state: "OH", zipCode: "45211", salePrice: 280000, saleDate: "2026-07-15", listPrice: 285000, propertyType: "Single Family", bedrooms: 3, bathrooms: 2, squareFeet: 1400, yearBuilt: 1960, lotSize: 0, distanceMiles: 0.3, condition: "Average", garage: 0, basement: "", source: "TEST DATA", sourceLink: "", notes: "LOCAL TEST", included: true, futureField: "preserved" };

test("canonical create payload links a comp to the selected saved deal", () => {
  const payload = buildCompCreatePayload(fixture, subject);
  assert.equal(payload.subjectDealId, "deal-123");
  assert.equal(payload.dealId, "deal-123");
  assert.equal(payload.propertyId, "property-123");
  assert.equal(payload.subjectPropertyId, "property-123");
});

test("confirmed API persistence is required before create can succeed", async () => {
  const payload = buildCompCreatePayload(fixture, subject);
  await assert.rejects(() => persistCompViaApi({ fetchImpl: async () => ({ ok: false, json: async () => ({}) }), url: "/api/comps", payload }), /Unable to create/);
  await assert.rejects(() => persistCompViaApi({ fetchImpl: async () => ({ ok: true, json: async () => ({ ok: true }) }), url: "/api/comps", payload }), /did not confirm/);
  const saved = await persistCompViaApi({ fetchImpl: async () => ({ ok: true, json: async () => ({ ...payload, id: "comp-1" }) }), url: "/api/comps", payload });
  assert.equal(saved.id, "comp-1");
  assert.equal(isConfirmedPersistedComp(saved, "deal-123"), true);
});

test("reload normalization preserves the complete comp contract and explicit values", () => {
  const persisted = normalizeCompRecord({ ...buildCompCreatePayload(fixture, subject), id: "comp-1", included: false, bedrooms: 0, garage: 0 });
  const reloaded = normalizeCompRecord(JSON.parse(JSON.stringify(persisted)));
  assert.equal(reloaded.id, "comp-1");
  assert.equal(reloaded.subjectDealId, "deal-123");
  assert.equal(reloaded.salePrice, 280000);
  assert.equal(reloaded.saleDate, "2026-07-15");
  assert.equal(reloaded.squareFeet, 1400);
  assert.equal(reloaded.included, false);
  assert.equal(reloaded.bedrooms, 0);
  assert.equal(reloaded.garage, 0);
  assert.equal(reloaded.futureField, "preserved");
});

test("subject switching prevents cross-deal leakage and restores the original comp", () => {
  const compA = { ...buildCompCreatePayload(fixture, subject), id: "comp-a" };
  const subjectB = { id: "deal-456", propertyId: "property-456", address: "456 Other St" };
  const compB = { ...buildCompCreatePayload({ ...fixture, compAddress: "200 Other Ave" }, subjectB), id: "comp-b" };
  assert.deepEqual(filterCompsForSubject([compA, compB], subject).map((comp) => comp.id), ["comp-a"]);
  assert.deepEqual(filterCompsForSubject([compA, compB], subjectB).map((comp) => comp.id), ["comp-b"]);
  assert.deepEqual(filterCompsForSubject(JSON.parse(JSON.stringify([compA, compB])), subject).map((comp) => comp.id), ["comp-a"]);
  const legacyPropertyLinked = { ...fixture, id: "comp-legacy", subjectPropertyId: "property-123" };
  assert.deepEqual(filterCompsForSubject([legacyPropertyLinked], subject).map((comp) => comp.id), ["comp-legacy"]);
});

test("one included comp reconciles sale-price and PPSF statistics", () => {
  const comp = { ...buildCompCreatePayload(fixture, subject), id: "comp-1" };
  const stats = buildCompStatistics([comp], subject);
  assert.deepEqual(stats, { total: 1, included: 1, averageSalePrice: 280000, medianSalePrice: 280000, averagePpsf: 200, medianPpsf: 200, baseArv: 280000 });
  const appraisal = buildAppraisalIntelligenceResult(subject, [{ ...comp, verified: true, inclusionStatus: "approved" }], { now: "2026-08-09" });
  assert.equal(appraisal.supportedArv, null);
  assert.equal(appraisal.appraisalStatus, "NOT_READY");
  assert.equal(appraisal.appraisalConfidence, "LOW");
});

test("excluded comp remains stored but does not affect included valuation statistics", () => {
  const included = { ...buildCompCreatePayload(fixture, subject), id: "comp-1" };
  const excluded = { ...buildCompCreatePayload({ ...fixture, salePrice: 500000, included: false }, subject), id: "comp-2", included: false };
  const stats = buildCompStatistics([included, excluded], subject);
  assert.equal(stats.total, 2);
  assert.equal(stats.included, 1);
  assert.equal(stats.averageSalePrice, 280000);
  assert.equal(filterCompsForSubject([included, excluded], subject).length, 2);
});

test("three persisted strong comps flow into existing Appraisal Intelligence", () => {
  const comps = [278000, 280000, 282000].map((salePrice, index) => ({
    ...buildCompCreatePayload({ ...fixture, salePrice, compAddress: `${100 + index} Test Comp Ave`, distanceMiles: 0.2 + index * 0.1 }, subject),
    id: `comp-${index + 1}`, verified: true, inclusionStatus: "approved",
  }));
  const appraisal = buildAppraisalIntelligenceResult(subject, JSON.parse(JSON.stringify(comps)), { now: "2026-08-09" });
  assert.equal(appraisal.compCount, 3);
  assert.equal(appraisal.usableCompCount, 3);
  assert.equal(appraisal.appraisalStatus, "READY");
  assert.equal(appraisal.appraisalConfidence, "HIGH");
  assert.equal(appraisal.supportedArv, 280000);
});

test("Comp Database sends session headers and never fabricates local persistence success", () => {
  const source = readFileSync(new URL("./CompDatabase.jsx", import.meta.url), "utf8");
  assert.match(source, /buildSessionAuthHeaders/);
  assert.doesNotMatch(source, /Unable to persist comp via API, using local fallback/);
  assert.match(source, /Persistence was not confirmed/);
  assert.match(source, /provider-test"\), \{\s*method: "POST",\s*headers: buildSessionAuthHeaders/s);
  assert.match(source, /subject-property"\), \{\s*method: "POST",\s*headers: buildSessionAuthHeaders/s);
  assert.match(source, /sold-comps"\), \{\s*method: "POST",\s*headers: buildSessionAuthHeaders/s);
  assert.match(source, /Internal RSOS provider-route authorization failure/);
});

test("provider imports carry canonical subject identifiers and remain review-first", () => {
  const source = readFileSync(new URL("../../../server/index.js", import.meta.url), "utf8");
  assert.match(source, /subjectDealId: query\.subjectDealId/);
  assert.match(source, /dealId: query\.dealId \|\| query\.subjectDealId/);
  assert.match(source, /propertyId: query\.propertyId/);
  assert.match(source, /verified: false/);
  assert.match(source, /inclusionStatus: "pending"/);
  assert.match(source, /included: false/);
  assert.match(source, /persisted: false/);
  assert.match(source, /tierCounts: providerResult\.tierCounts/);
  assert.match(source, /searchTier: record\.searchTier/);
  const frontend = readFileSync(new URL("./CompDatabase.jsx", import.meta.url), "utf8");
  assert.match(frontend, /Nothing was imported automatically/);
  assert.match(frontend, /setProviderCandidates/);
  assert.match(frontend, /Tier 1 qualifying:/);
  assert.match(frontend, /Tier 2 additional:/);
  assert.match(frontend, /Tier 3 additional:/);
  assert.match(frontend, /Tier 4 additional:/);
});

test("reload restores only a coordinate-backed persisted subject with matching identity fields", () => {
  const goss = { id: "deal-goss", propertyId: "property-goss", propertyAddress: "952 Goss Rd", city: "Cincinnati", state: "OH", zipCode: "45229" };
  const restored = findPersistedProviderSubject(goss, [{ address: "952 Goss Rd", city: "Cincinnati", state: "OH", zipCode: "45229", latitude: 39.146737, longitude: -84.482759, propertyType: "Single Family", squareFeet: 1562, bedrooms: 4, bathrooms: 2.5 }]);
  assert.equal(restored.latitude, 39.146737);
  assert.equal(restored.longitude, -84.482759);
  assert.equal(findPersistedProviderSubject({ ...goss, zipCode: "45230" }, [restored]), null);
});

test("reload never invents coordinates when persisted subject evidence is incomplete", () => {
  const goss = { propertyAddress: "952 Goss Rd", city: "Cincinnati", state: "OH", zipCode: "45229" };
  assert.equal(findPersistedProviderSubject(goss, [{ address: "952 Goss Rd", city: "Cincinnati", state: "OH", zipCode: "45229", latitude: "", longitude: null }]), null);
});

test("provider sale dates remain calendar-stable across browser timezones", () => {
  const originalTz = process.env.TZ;
  try {
    for (const timezone of ["America/New_York", "America/Los_Angeles", "UTC"]) {
      process.env.TZ = timezone;
      assert.equal(formatProviderSaleDate("2025-12-30T00:00:00.000Z"), "Dec 30, 2025");
      assert.equal(formatProviderSaleDate("2024-02-29T00:00:00.000Z"), "Feb 29, 2024");
      assert.equal(formatProviderSaleDate("2026-01-01T00:00:00.000Z"), "Jan 1, 2026");
      assert.equal(formatProviderSaleDate("2025-12-31T00:00:00.000Z"), "Dec 31, 2025");
    }
  } finally {
    if (originalTz === undefined) delete process.env.TZ;
    else process.env.TZ = originalTz;
  }
});

test("Dauner sale-date presentation preserves canonical date while backend age/tier evidence remains unchanged", () => {
  const source = readFileSync(new URL("./CompDatabase.jsx", import.meta.url), "utf8");
  assert.match(source, /formatProviderSaleDate/);
  assert.equal(formatProviderSaleDate("2025-12-30T00:00:00.000Z"), "Dec 30, 2025");
  assert.equal({ saleAgeDays: 223, saleAgeMonths: 7.3, searchTier: 2, futureSaleDate: false }.futureSaleDate, false);
});

test("provider results populate a deduplicated temporary review queue with complete tier metadata", () => {
  const providerFixture = {
    id: "rentcast-provider-1", providerRecordId: "provider-1", compAddress: "10 Review Ave", city: "Cincinnati", state: "OH", zipCode: "45229",
    salePrice: 275000, saleDate: "2026-04-15", propertyType: "Single Family", bedrooms: 4, bathrooms: 2.5, squareFeet: 1600,
    distanceMiles: 0.8, searchTier: 3, searchTierLabel: "Expanded Comp — Tier 3", similarityScore: 62.5,
    saleAgeDays: 116, saleAgeMonths: 3.8, squareFeetVariancePercentage: 2.4, bedroomVariance: 0, bathroomVariance: 0,
    provider: "rentcast", source: "rentcast Provider", acceptanceReasons: ["property type matches"], verified: false, inclusionStatus: "pending", included: false,
  };
  const queue = normalizeProviderReviewCandidates([providerFixture, { ...providerFixture, id: "duplicate-id" }], subject);
  assert.equal(queue.length, 1);
  assert.equal(queue[0].subjectDealId, "deal-123");
  assert.equal(queue[0].propertyId, "property-123");
  assert.equal(queue[0].searchTier, 3);
  assert.equal(queue[0].searchTierLabel, "Expanded Comp — Tier 3");
  assert.equal(queue[0].similarityScore, 62.5);
  assert.equal(queue[0].verified, false);
  assert.equal(queue[0].included, false);
  assert.deepEqual(queue[0].acceptanceReasons, ["property type matches"]);
});

test("provider candidate without backend IDs receives a stable review key instead of the subject property ID", () => {
  const idlessCandidates = normalizeProviderReviewCandidates([{
    ...fixture,
    id: "",
    compId: "",
    providerRecordId: "",
    propertyId: "property-123",
    compAddress: "1524 Jonathan Ave",
    saleDate: "2026-01-27",
    salePrice: 320000,
    included: false,
  }, {
    ...fixture,
    id: "",
    compId: "",
    providerRecordId: "",
    propertyId: "property-123",
    compAddress: "1600 Other Ave",
    saleDate: "2026-02-10",
    salePrice: 300000,
    included: false,
  }], subject);
  assert.equal(idlessCandidates.length, 2);
  const [idless] = idlessCandidates;
  assert.equal(idless.providerRecordId, "");
  assert.notEqual(idless.reviewCandidateKey, "provider:property-123");
  assert.match(idless.reviewCandidateKey, /^sale:1524 jonathan ave\|2026-01-27\|320000$/);
  assert.equal(idless.id, idless.reviewCandidateKey);
  assert.equal(getProviderReviewCandidate([idless], idless.reviewCandidateKey)?.compAddress, "1524 Jonathan Ave");
});

test("review selection opens only the requested candidate without mutating or persisting the queue", () => {
  const candidates = normalizeProviderReviewCandidates([
    { ...fixture, id: "candidate-a", providerRecordId: "provider-a", included: false },
    { ...fixture, id: "candidate-b", providerRecordId: "provider-b", compAddress: "11 Review Ave", included: false },
  ], subject);
  const before = JSON.stringify(candidates);
  const countsBefore = buildCompReviewCounts({ providerCandidates: candidates, persistedComps: [] });
  const valuationBefore = buildCompStatistics([], subject);
  const selected = getProviderReviewCandidate(candidates, "candidate-a");
  assert.equal(selected.id, "candidate-a");
  assert.equal(selected.providerRecordId, "provider-a");
  assert.notEqual(selected.id, candidates[1].id);
  assert.equal(getProviderReviewCandidate(candidates, "candidate-b").id, "candidate-b");
  assert.equal(getProviderReviewCandidate(candidates, "missing"), null);
  assert.equal(JSON.stringify(candidates), before);
  assert.deepEqual(buildCompReviewCounts({ providerCandidates: candidates, persistedComps: [] }), countsBefore);
  assert.deepEqual(buildCompStatistics([], subject), valuationBefore);
});

test("explicit provider approval persists once, remains excluded from ARV, and survives reload", async () => {
  const candidate = normalizeProviderReviewCandidates([{ ...fixture, id: "candidate-1", providerRecordId: "provider-1", included: false, providerImported: true, source: "RentCast Provider", searchTier: 3 }], subject)[0];
  const payload = buildProviderCandidateApprovalPayload(candidate, subject);
  assert.equal(payload.verified, true);
  assert.equal(payload.inclusionStatus, "approved");
  assert.equal(payload.included, false);
  const saved = await persistCompViaApi({ fetchImpl: async () => ({ ok: true, json: async () => ({ ...payload, id: "comp-persisted" }) }), url: "/api/comps", payload });
  const reloaded = normalizeCompRecord(JSON.parse(JSON.stringify(saved)));
  assert.equal(reloaded.id, "comp-persisted");
  assert.equal(reloaded.subjectDealId, "deal-123");
  assert.equal(reloaded.included, false);
  assert.equal(persistedCompMatchesProviderCandidate([reloaded], candidate, subject), true);
  assert.equal(persistedCompMatchesProviderCandidate([reloaded], candidate, { id: "deal-other", propertyId: "property-other" }), false);
  assert.equal(buildCompStatistics([reloaded], subject).included, 0);
});

test("provider import transaction sends one authenticated POST and returns one governed persisted comp", async () => {
  const candidate = normalizeProviderReviewCandidates([{ ...fixture, id: "candidate-1", providerRecordId: "provider-1", included: false, providerImported: true }], subject)[0];
  const calls = [];
  const fetchImpl = async (url, options = {}) => {
    calls.push({ url, ...options });
    if (options.method === "GET") return { ok: true, json: async () => [] };
    const payload = JSON.parse(options.body);
    return { ok: true, status: 201, json: async () => ({ ...payload, id: "comp-1" }) };
  };
  const result = await importProviderCandidateTransaction({ fetchImpl, url: "/api/comps", candidate, subjectDeal: subject, headers: { "X-RSOS-Session-ID": "session-test" }, timeoutMs: 100 });
  assert.equal(result.status, "succeeded");
  assert.equal(calls.filter((call) => call.method === "POST").length, 1);
  assert.equal(calls.find((call) => call.method === "POST").headers["X-RSOS-Session-ID"], "session-test");
  assert.equal(result.comp.inclusionStatus, "approved");
  assert.equal(result.comp.included, false);
  assert.equal(result.comp.subjectDealId, "deal-123");
  assert.equal(result.comps.length, 1);
});

test("provider import failure settles, preserves candidate externally, and never fabricates success", async () => {
  const candidate = normalizeProviderReviewCandidates([{ ...fixture, id: "candidate-1", providerRecordId: "provider-1", included: false, providerImported: true }], subject)[0];
  let postCount = 0;
  await assert.rejects(() => importProviderCandidateTransaction({
    fetchImpl: async (_url, options = {}) => {
      if (options.method === "POST") {
        postCount += 1;
        return { ok: false, status: 500, json: async () => ({}) };
      }
      return { ok: true, json: async () => [] };
    },
    url: "/api/comps", candidate, subjectDeal: subject, timeoutMs: 50,
  }), (error) => error.category === "server");
  assert.equal(postCount, 1);
  assert.equal(candidate.inclusionStatus, "pending");
  assert.equal(candidate.included, false);
});

test("provider import timeout settles without automatic retry and can retry after confirmed no-persist", async () => {
  const candidate = normalizeProviderReviewCandidates([{ ...fixture, id: "candidate-1", providerRecordId: "provider-1", included: false, providerImported: true }], subject)[0];
  let postCount = 0;
  await assert.rejects(() => importProviderCandidateTransaction({
    fetchImpl: async (_url, options = {}) => {
      if (options.method === "POST") {
        postCount += 1;
        return new Promise(() => {});
      }
      return { ok: true, json: async () => [] };
    },
    url: "/api/comps", candidate, subjectDeal: subject, timeoutMs: 5,
  }), (error) => error.category === "timeout" && /timed out/i.test(error.message));
  assert.equal(postCount, 1);

  const retry = await importProviderCandidateTransaction({
    fetchImpl: async (_url, options = {}) => {
      if (options.method === "POST") {
        postCount += 1;
        const payload = JSON.parse(options.body);
        return { ok: true, status: 201, json: async () => ({ ...payload, id: "comp-retry" }) };
      }
      return { ok: true, json: async () => [] };
    },
    url: "/api/comps", candidate, subjectDeal: subject, timeoutMs: 50,
  });
  assert.equal(retry.status, "succeeded");
  assert.equal(postCount, 2);
});

test("ambiguous timeout reconciles a persisted provider ID instead of retrying or duplicating", async () => {
  const candidate = normalizeProviderReviewCandidates([{ ...fixture, id: "candidate-1", providerRecordId: "provider-1", included: false, providerImported: true }], subject)[0];
  const persisted = { ...buildProviderCandidateApprovalPayload(candidate, subject), id: "comp-existing" };
  let getCount = 0;
  let postCount = 0;
  const result = await importProviderCandidateTransaction({
    fetchImpl: async (_url, options = {}) => {
      if (options.method === "POST") {
        postCount += 1;
        return new Promise(() => {});
      }
      getCount += 1;
      return { ok: true, json: async () => getCount === 1 ? [] : [persisted] };
    },
    url: "/api/comps", candidate, subjectDeal: subject, timeoutMs: 5,
  });
  assert.equal(result.status, "reconciled");
  assert.equal(result.comp.id, "comp-existing");
  assert.equal(postCount, 1);
});

test("existing provider import reconciles before POST and remains isolated by subject", async () => {
  const candidate = normalizeProviderReviewCandidates([{ ...fixture, id: "candidate-1", providerRecordId: "provider-1", included: false, providerImported: true }], subject)[0];
  const persisted = { ...buildProviderCandidateApprovalPayload(candidate, subject), id: "comp-existing", garage: 0 };
  let postCount = 0;
  const result = await importProviderCandidateTransaction({
    fetchImpl: async (_url, options = {}) => {
      if (options.method === "POST") postCount += 1;
      return { ok: true, json: async () => [persisted] };
    },
    url: "/api/comps", candidate, subjectDeal: subject, timeoutMs: 50,
  });
  assert.equal(result.status, "already_imported");
  assert.equal(postCount, 0);
  assert.equal(findPersistedProviderCandidate([persisted], candidate, subject)?.id, "comp-existing");
  assert.equal(findPersistedProviderCandidate([persisted], candidate, { id: "deal-other", propertyId: "property-other" }), null);
  assert.equal(result.comp.included, false);
  assert.equal(result.comp.garage, 0);
});

test("provider rejection removes the candidate without creating a persisted comp and counts reconcile", () => {
  const candidates = normalizeProviderReviewCandidates([{ ...fixture, id: "candidate-1", providerRecordId: "provider-1", included: false }, { ...fixture, id: "candidate-2", providerRecordId: "provider-2", compAddress: "11 Review Ave", included: false }], subject);
  const rejected = rejectProviderReviewCandidate(candidates, [], candidates[0], "2026-08-09T12:00:00.000Z");
  assert.equal(rejected.active.length, 1);
  assert.equal(rejected.rejected.length, 1);
  assert.equal(rejected.rejected[0].inclusionStatus, "rejected");
  const counts = buildCompReviewCounts({ providerCandidates: rejected.active, persistedComps: [], rejectedCandidates: rejected.rejected });
  assert.deepEqual(counts, { qualifyingReviewCandidates: 1, persistedPendingComps: 0, approvedComps: 0, rejectedCandidates: 1, includedInArvComps: 0 });
});

test("two-result review counts reconcile before and after one governed import", () => {
  const candidates = normalizeProviderReviewCandidates([{ ...fixture, id: "candidate-1", providerRecordId: "provider-1", included: false }, { ...fixture, id: "candidate-2", providerRecordId: "provider-2", compAddress: "11 Review Ave", included: false }], subject);
  assert.deepEqual(buildCompReviewCounts({ providerCandidates: candidates, persistedComps: [] }), { qualifyingReviewCandidates: 2, persistedPendingComps: 0, approvedComps: 0, rejectedCandidates: 0, includedInArvComps: 0 });
  const imported = { ...buildProviderCandidateApprovalPayload(candidates[0], subject), id: "comp-1" };
  assert.deepEqual(buildCompReviewCounts({ providerCandidates: candidates.slice(1), persistedComps: [imported] }), { qualifyingReviewCandidates: 1, persistedPendingComps: 0, approvedComps: 1, rejectedCandidates: 0, includedInArvComps: 0 });
});

test("Comp Database renders temporary candidates and clearly separates server provider from administrator override", () => {
  const source = readFileSync(new URL("./CompDatabase.jsx", import.meta.url), "utf8");
  assert.match(source, /REVIEW \/ VIEW/);
  assert.match(source, /REFRESH LIVE COMPS/);
  assert.match(source, /APPROVE \/ IMPORT/);
  assert.match(source, /handleRejectProviderCandidate/);
  assert.match(source, /ACTIVE SERVER PROVIDER/);
  assert.match(source, /Provider Source:/);
  assert.match(source, /Configured securely/);
  assert.match(source, /ADMINISTRATOR PROVIDER OVERRIDE/);
  assert.doesNotMatch(source, /Live providers remain disabled/);
  assert.doesNotMatch(source, /providerStatus\.apiKey|providerStatus\.secret/);
  assert.match(source, /type="password" name="apiKey"/);
  assert.match(source, /type="password" name="clientSecret"/);
});

test("provider candidate review renders a visible governed dialog and close is side-effect free", () => {
  const source = readFileSync(new URL("./CompDatabase.jsx", import.meta.url), "utf8");
  assert.match(source, /role="dialog" aria-modal="true"/);
  assert.match(source, /PROVIDER CANDIDATE REVIEW/);
  assert.match(source, /NOT YET APPROVED • NOT INCLUDED IN ARV/);
  assert.match(source, /APPROVE \/ IMPORT/);
  assert.match(source, /CLOSE \/ BACK WITHOUT CHANGES/);
  assert.match(source, /PHOTO \/ MEDIA REFERENCE/);
  const openHandler = source.slice(source.indexOf("const handleReviewProviderCandidate"), source.indexOf("const handleCloseProviderCandidateReview"));
  const closeHandler = source.slice(source.indexOf("const handleCloseProviderCandidateReview"), source.indexOf("const handleApproveProviderCandidate"));
  assert.match(openHandler, /const candidateId = candidate\.reviewCandidateKey \|\| getProviderReviewCandidateKey\(candidate\) \|\| candidate\.id/);
  assert.match(openHandler, /setSelectedProviderCandidateId\(candidateId\)/);
  assert.doesNotMatch(openHandler, /persistComp|handleApprove|handleReject/);
  assert.match(closeHandler, /setSelectedProviderCandidateId\(""\)/);
  assert.doesNotMatch(closeHandler, /persistComp|setComps|setProviderCandidates|setRejectedProviderCandidates/);
  assert.match(source, /providerImportInFlightRef/);
  assert.match(source, /status: "importing"/);
  assert.match(source, /status: timedOut \? "timed_out" : "failed"/);
  assert.match(source, /Import timed out — verify before retrying/);
});

test("provider review modal uses a production-safe body portal outside the overflow-constrained page", () => {
  const source = readFileSync(new URL("./CompDatabase.jsx", import.meta.url), "utf8");
  assert.match(source, /import \{ createPortal \} from "react-dom"/);
  assert.match(source, /createPortal\(\(/);
  assert.match(source, /\), document\.body\)/);
  assert.match(source, /position: "fixed"/);
  assert.match(source, /zIndex: 2147483647/);
  assert.match(source, /width: "100vw"/);
  assert.match(source, /height: "100vh"/);
  assert.match(source, /maxWidth: "820px"/);
  assert.match(source, /WebkitOverflowScrolling: "touch"/);
  assert.doesNotMatch(source, /width: "min\(820px, 100%\)"/);
});

test("provider review modal has deterministic backdrop Escape focus and scroll cleanup", () => {
  const source = readFileSync(new URL("./CompDatabase.jsx", import.meta.url), "utf8");
  assert.match(source, /event\.target === event\.currentTarget/);
  assert.match(source, /event\.key === "Escape"/);
  assert.match(source, /document\.body\.style\.overflow = "hidden"/);
  assert.match(source, /document\.body\.style\.overflow = previousBodyOverflow/);
  assert.match(source, /providerReviewCloseButtonRef\.current\?\.focus/);
  assert.match(source, /providerReviewReturnFocusRef\.current\?\.focus/);
  assert.match(source, /setProviderCandidates\(\[\]\)[\s\S]*setSelectedProviderCandidateId\(""\)/);
  assert.match(source, /onMouseDown=\{\(event\) => \{ if \(event\.target === event\.currentTarget\)/);
  assert.match(source, /onMouseDown=\{\(event\) => event\.stopPropagation\(\)\}/);
});

test("provider review lifecycle instrumentation proves handler selection resolution portal and retained mount", () => {
  const source = readFileSync(new URL("./CompDatabase.jsx", import.meta.url), "utf8");
  assert.match(source, /providerReviewTraceRef/);
  assert.match(source, /handlerExecuted: true/);
  assert.match(source, /selectionChanged: true/);
  assert.match(source, /candidateResolved: Boolean\(selectedProviderCandidate\)/);
  assert.match(source, /portalRendered: Boolean\(selectedProviderCandidate\)/);
  assert.match(source, /modalMounted: true/);
  assert.match(source, /remainedMounted: true/);
  assert.match(source, /data-review-candidate-key=/);
  assert.match(source, /data-review-mounted="true"/);
});

test("backend sold-comp linkage preserves provider identities required by review and idempotency", () => {
  const backend = readFileSync(new URL("../../../server/index.js", import.meta.url), "utf8");
  assert.match(backend, /id: record\.id \|\| record\.compId \|\| record\.providerRecordId/);
  assert.match(backend, /compId: record\.compId \|\| record\.id \|\| record\.providerRecordId/);
  assert.match(backend, /providerRecordId: record\.providerRecordId \|\| record\.id \|\| record\.compId/);
  const candidate = { id: "rentcast-record-1", providerRecordId: "rentcast-property-1", compAddress: "1524 Jonathan Ave", saleDate: "2026-01-27", salePrice: 320000 };
  assert.equal(getProviderReviewCandidateKey(candidate), "provider:rentcast-property-1");
});

test("provider review count labels distinguish returned, deduplicated, active, rejected, and persisted states", () => {
  const source = readFileSync(new URL("./CompDatabase.jsx", import.meta.url), "utf8");
  assert.match(source, /Provider candidates retrieved:/);
  assert.match(source, /Qualifying candidates returned:/);
  assert.match(source, /Active review queue:/);
  assert.match(source, /Deduplicated before queue:/);
  assert.match(source, /Rejected this search:/);
  assert.match(source, /Persisted pending:/);
  assert.match(source, /Persisted approved:/);
  assert.match(source, /Included in ARV:/);
});

test("sold-comp quality diagnostics remain credential-free and are exposed through the canonical response", () => {
  const source = readFileSync(new URL("./CompDatabase.jsx", import.meta.url), "utf8");
  const backend = readFileSync(new URL("../../../server/index.js", import.meta.url), "utf8");
  assert.match(source, /Pages retrieved:/);
  assert.match(source, /Provider records retrieved:/);
  assert.match(source, /Normalized:/);
  assert.match(source, /Normalization failures:/);
  assert.match(source, /Invalid sales:/);
  assert.match(source, /Future sales:/);
  assert.match(source, /Missing distance\/type:/);
  assert.match(source, /Provider cap reached:/);
  assert.match(source, /Provider deduplicated:/);
  assert.match(source, /Type\/sqft\/bed\/bath rejections:/);
  assert.match(source, /Final review candidates:/);
  const identity = readFileSync(new URL("../../../server/providerSearchIdentity.js", import.meta.url), "utf8");
  assert.match(identity, /rentcast-sold-comps-v3/);
  assert.match(backend, /decorateDiagnostics\(providerResult\.diagnostics \|\| \{\}/);
  assert.doesNotMatch(source, /RENTCAST_API_KEY/);
});

test("review and comp actions do not initiate provider searches", () => {
  const source = readFileSync(new URL("./CompDatabase.jsx", import.meta.url), "utf8");
  const review = source.slice(source.indexOf("const handleReviewProviderCandidate"), source.indexOf("const handleCloseProviderCandidateReview"));
  const close = source.slice(source.indexOf("const handleCloseProviderCandidateReview"), source.indexOf("const handleApproveProviderCandidate"));
  const approve = source.slice(source.indexOf("const handleApproveProviderCandidate"), source.indexOf("const handleRejectProviderCandidate"));
  const reject = source.slice(source.indexOf("const handleRejectProviderCandidate"), source.indexOf("const handleProviderTest"));
  assert.doesNotMatch(review, /handleFindSoldComps|fetch\(/);
  assert.doesNotMatch(close, /handleFindSoldComps|fetch\(/);
  assert.doesNotMatch(approve, /handleFindSoldComps/);
  assert.doesNotMatch(reject, /handleFindSoldComps/);
  assert.match(source, /forceRefresh/);
});

test("operations history and diagnostics use the canonical provider-search telemetry", () => {
  const source = readFileSync(new URL("./CompDatabase.jsx", import.meta.url), "utf8");
  assert.match(source, /\/api\/comps\/provider-search-history/);
  assert.match(source, /setProviderSearchHistory\(Array\.isArray\(history\) \? history : \[\]\)/);
  assert.match(source, /Provider Search History/);
  assert.match(source, /RECENT PROVIDER SEARCHES/);
  assert.match(source, /PROVIDER SEARCH \/ CACHE/);
  assert.match(source, /Provider Data Freshness/);
  assert.match(source, /refreshProviderTelemetry\(result\.diagnostics \|\| \{\}\)/);
});

test("provider history records retain cache diagnostics without credentials", () => {
  const backend = readFileSync(new URL("../../../server/index.js", import.meta.url), "utf8");
  assert.match(backend, /addProviderSearchHistory\(\{ provider: activeProviderKey, operation: "sold-comps"/);
  assert.match(backend, /diagnostics: responsePayload\.diagnostics/);
  assert.match(backend, /status: "Cached"/);
  assert.doesNotMatch(backend, /RENTCAST_API_KEY.*addProviderSearchHistory/);
});
