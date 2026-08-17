import test from "node:test";
import assert from "node:assert/strict";
import {
  buildAppraisalIntelligenceResult,
  buildAppraiserPacketEvidence,
  evaluateAppraisalComp,
} from "./appraisalIntelligenceEngine.js";

const now = "2026-08-09T12:00:00.000Z";
const subject = {
  id: "deal-123", dealId: "deal-123", propertyId: "property-123",
  propertyAddress: "123 Test St", city: "Cincinnati", state: "OH", zipCode: "45211",
  propertyType: "Single Family", bedrooms: 3, bathrooms: 2, squareFeet: 1400, yearBuilt: 1960,
  purchasePrice: 135000, rehabBudget: 60000, holdingMonths: 3, holdingCosts: 6000,
  estimatedArv: 285000, strategy: "Flip",
};
const comp = (overrides = {}) => ({
  id: "comp-1", salePrice: 280000, saleDate: "2026-07-15", distanceMiles: 0.25,
  squareFeet: 1400, propertyType: "SFH", bedrooms: 3, bathrooms: 2, yearBuilt: 1962,
  verified: true, included: true, photos: ["photo-1.jpg"], source: "manual",
  ...overrides,
});
const strongComps = [
  comp({ id: "comp-1", salePrice: 280000 }),
  comp({ id: "comp-2", salePrice: 285000, distanceMiles: 0.35, squareFeet: 1450 }),
  comp({ id: "comp-3", salePrice: 290000, distanceMiles: 0.45, squareFeet: 1380 }),
];

test("canonical property IDs and explicit zero values feed appraisal intelligence", () => {
  const result = buildAppraisalIntelligenceResult({ ...subject, holdingCosts: 0, earnestMoney: 0 }, strongComps, { now });
  assert.equal(result.dealId, "deal-123");
  assert.equal(result.propertyId, "property-123");
  assert.equal(result.appraisalStatus, "READY");
});

test("no comps is insufficient evidence and never fabricates a supported ARV or ARV failure", () => {
  const result = buildAppraisalIntelligenceResult(subject, [], { now });
  assert.equal(result.appraisalStatus, "NOT_READY");
  assert.equal(result.appraisalConfidence, "LOW");
  assert.equal(result.supportedArv, null);
  assert.equal(result.evidenceStatus, "NO_COMPS_AVAILABLE");
  assert.match(result.warnings[0], /No comps available/);
  assert.equal(result.warnings.some((warning) => /incorrect|failed/i.test(warning)), false);
});

test("one qualifying comp can indicate value but cannot establish supported ARV", () => {
  const result = buildAppraisalIntelligenceResult(subject, [comp()], { now });
  assert.equal(result.appraisalStatus, "NOT_READY");
  assert.equal(result.appraisalConfidence, "LOW");
  assert.equal(result.supportedArv, null);
  assert.equal(result.weightedArv, null);
  assert.equal(result.appraisalSupportScore, 0);
});

test("three strong recent nearby matching comps produce READY and HIGH confidence", () => {
  const result = buildAppraisalIntelligenceResult(subject, strongComps, { now });
  assert.equal(result.appraisalStatus, "READY");
  assert.equal(result.appraisalConfidence, "HIGH");
  assert.equal(result.strongCompCount, 3);
  assert.equal(result.appraisalPacketReady, true);
  assert.equal(result.methodology, "QUALITY_WEIGHTED_PPSF");
  assert.ok(result.supportedArv > 0);
  assert.ok(result.lowSupportedArv <= result.supportedArv);
  assert.ok(result.highSupportedArv >= result.supportedArv);
});

test("expanded-tier comps preserve evidence labels and cannot automatically produce HIGH confidence", () => {
  const expanded = strongComps.map((entry, index) => ({ ...entry, searchTier: index === 0 ? 2 : 3, searchTierLabel: index === 0 ? "Expanded Comp — Tier 2" : "Expanded Comp — Tier 3" }));
  const result = buildAppraisalIntelligenceResult(subject, expanded, { now });
  assert.notEqual(result.appraisalConfidence, "HIGH");
  assert.ok(result.warnings.some((warning) => /Expanded-tier comps reduce/.test(warning)));
  assert.ok(result.recommendedComps.every((entry) => entry.searchTier >= 2));
});

test("pending fallback candidates cannot create Supported ARV before explicit approval", () => {
  const pending = strongComps.map((entry) => ({ ...entry, searchTier: 2, searchTierLabel: "Expanded Comp — Tier 2", verified: false, included: false, inclusionStatus: "pending" }));
  const result = buildAppraisalIntelligenceResult(subject, pending, { now });
  assert.equal(result.supportedArv, null);
  assert.equal(result.appraisalStatus, "NOT_READY");
  assert.equal(result.appraisalConfidence, "LOW");
});

test("existing RSOS valuation remains authoritative when supplied", () => {
  const result = buildAppraisalIntelligenceResult(subject, strongComps, {
    now, valuationResult: { supportedArv: 282000, conservativeArv: 275000, aggressiveArv: 290000, valuationReviewStatus: "APPROVED" },
  });
  assert.equal(result.supportedArv, 282000);
  assert.equal(result.lowSupportedArv, 275000);
  assert.equal(result.highSupportedArv, 290000);
  assert.equal(result.methodology, "EXISTING_RSOS_VALUATION");
});

test("preliminary calculated valuation is not promoted to supported ARV", () => {
  const result = buildAppraisalIntelligenceResult(subject, [comp()], {
    now, valuationResult: { supportedArv: 280000, expectedArv: 280000, valuationReviewStatus: "PRELIMINARY" },
  });
  assert.equal(result.supportedArv, null);
  assert.equal(result.appraisalStatus, "NOT_READY");
});

test("target ARV materially above strong comp evidence produces REVIEW and explicit warning", () => {
  const result = buildAppraisalIntelligenceResult({ ...subject, estimatedArv: 350000 }, strongComps, { now });
  assert.equal(result.appraisalStatus, "REVIEW");
  assert.ok(result.arvVariancePercentage > 0.1);
  assert.equal(result.appraisalRiskLevel, "HIGH");
  assert.ok(result.warnings.some((warning) => /above the comp-supported valuation/.test(warning)));
});

test("old distant mismatched comps reduce quality and cannot falsely produce READY", () => {
  const weak = strongComps.map((entry, index) => ({ ...entry, id: `weak-${index}`, saleDate: "2024-01-01", distanceMiles: 4, squareFeet: 2300, propertyType: "Duplex" }));
  const result = buildAppraisalIntelligenceResult(subject, weak, { now });
  assert.notEqual(result.appraisalStatus, "READY");
  assert.equal(result.appraisalConfidence, "LOW");
  assert.equal(result.weakCompCount, 3);
  assert.equal(result.excludedComps.length, 3);
});

test("recent nearby matching comp scores above stale distant mismatch", () => {
  const strong = evaluateAppraisalComp(subject, comp(), { now });
  const weak = evaluateAppraisalComp(subject, comp({ saleDate: "2024-01-01", distanceMiles: 5, squareFeet: 2200, propertyType: "Triplex" }), { now });
  assert.ok(strong.qualityScore > weak.qualityScore);
  assert.equal(strong.quality, "STRONG");
  assert.equal(weak.quality, "WEAK");
});

test("missing optional comp fields does not crash while missing subject data is NOT_READY", () => {
  assert.doesNotThrow(() => buildAppraisalIntelligenceResult(subject, [{ id: "partial", salePrice: "" }], { now }));
  const missing = buildAppraisalIntelligenceResult({ id: "deal-missing", estimatedArv: 285000 }, strongComps, { now });
  assert.equal(missing.appraisalStatus, "NOT_READY");
  assert.ok(missing.missingCriticalData.length > 0);
});

test("comp IDs photos sources and weak comp records remain preserved", () => {
  const excluded = comp({ id: "comp-x", included: false, photos: ["front.jpg"], source: "county" });
  const result = buildAppraisalIntelligenceResult(subject, [...strongComps, excluded], { now });
  assert.equal(result.compCount, 4);
  assert.equal(result.excludedComps[0].id, "comp-x");
  assert.deepEqual(result.excludedComps[0].photoReferences, ["front.jpg"]);
  assert.equal(result.excludedComps[0].source, "county");
});

test("comp linked to another canonical property is excluded without address merging", () => {
  const linkedElsewhere = comp({ id: "wrong", propertyId: "property-other" });
  const result = buildAppraisalIntelligenceResult(subject, [linkedElsewhere], { now });
  assert.equal(result.usableCompCount, 0);
  assert.ok(result.excludedComps[0].reasons.some((reason) => /different property/.test(reason)));
});

test("packet evidence consumes appraisal result without generating a duplicate packet", () => {
  const appraisal = buildAppraisalIntelligenceResult(subject, strongComps, { now });
  const evidence = buildAppraiserPacketEvidence(appraisal);
  assert.equal(evidence.dealId, "deal-123");
  assert.equal(evidence.propertyId, "property-123");
  assert.equal(evidence.appraisalPacketReady, true);
  assert.equal(evidence.comps.length, 3);
  assert.equal(ownPacketIdentity(evidence), false);
});

test("BRRRR refinance appraisal readiness depends on evidence without performing BRRRR math", () => {
  const result = buildAppraisalIntelligenceResult({ ...subject, strategy: "BRRRR", refinanceLtvPercentage: 75 }, strongComps, { now });
  assert.equal(result.refinanceAppraisalReady, true);
  assert.equal(Object.prototype.hasOwnProperty.call(result, "maxRefinanceLoan"), false);
});

test("Flip remains supported and does not become refinance-ready", () => {
  const result = buildAppraisalIntelligenceResult(subject, strongComps, { now });
  assert.equal(result.appraisalStatus, "READY");
  assert.equal(result.refinanceAppraisalReady, false);
});

function ownPacketIdentity(evidence) {
  return Object.prototype.hasOwnProperty.call(evidence, "packetId") || Object.prototype.hasOwnProperty.call(evidence, "id");
}
