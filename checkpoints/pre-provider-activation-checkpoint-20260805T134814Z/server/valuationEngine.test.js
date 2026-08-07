import test from "node:test";
import assert from "node:assert/strict";

import {
  buildCanonicalValuationEngine,
  evaluateCompEligibility,
  buildSimilarityScores,
  buildAdjustmentModel,
  validateAdjustments,
  calculateAdjustedCompValue,
  buildMultiMethodValuation,
  buildArvConfidence,
  buildRedTeamReview,
  createValuationVersion,
  defaultSimilarityWeights,
} from "./valuationEngine.js";
import { buildNormalizedCompRecord } from "./compProviderEngine.js";

const subjectProperty = {
  id: "subject-1",
  address: "952 Goss Rd",
  city: "Cincinnati",
  state: "OH",
  zipCode: "45229",
  propertyType: "Single Family",
  bedrooms: 4,
  bathrooms: 2.5,
  squareFeet: 1562,
  yearBuilt: 1929,
  lotSize: "0.2 acre",
  stories: 2,
  garage: "2-car",
  basement: "finished",
};

const approvedComp = buildNormalizedCompRecord(
  {
    address: "100 Test St",
    salePrice: 280000,
    saleDate: "2024-01-15",
    squareFeet: 1600,
    bedrooms: 4,
    bathrooms: 2.5,
    yearBuilt: 1930,
    lotSize: "0.18 acre",
    stories: 2,
    garage: "2-car",
    basement: "finished",
    status: "closed",
    armsLengthStatus: "armslength",
    verified: true,
    providerImported: false,
    manuallyEntered: true,
    saleAgeMonths: 6,
    distanceMiles: 1.2,
    condition: "Average",
    renovationLevel: "None",
  },
  subjectProperty,
  "manual",
);

test("buildCanonicalValuationEngine returns a canonical valuation schema", () => {
  const valuation = buildCanonicalValuationEngine({ subjectProperty, comps: [approvedComp] });
  assert.equal(valuation.formulaVersion, "phase4-batch1-v1");
  assert.equal(valuation.subjectProperty.id, "subject-1");
  assert.equal(valuation.compSetVersion, "draft-1");
  assert.ok(Array.isArray(valuation.comps));
});

test("evaluateCompEligibility classifies verified closed sales as primary comps and excludes non-arm's-length transfers", () => {
  const primary = evaluateCompEligibility(approvedComp, subjectProperty);
  assert.equal(primary.classification, "Primary Comp Candidate");
  assert.equal(primary.eligible, true);

  const excluded = evaluateCompEligibility(
    {
      ...approvedComp,
      id: "excluded-1",
      armsLengthStatus: "family-transfer",
      status: "closed",
      verified: true,
      salePrice: 250000,
      saleDate: "2024-02-15",
      providerImported: false,
    },
    subjectProperty,
  );
  assert.equal(excluded.eligible, false);
  assert.equal(excluded.classification, "Exclude");
  assert.match(excluded.exclusionReason, /family transfer/i);
});

test("buildSimilarityScores exposes component scores and preserves formula version", () => {
  const similarity = buildSimilarityScores(approvedComp, subjectProperty);
  assert.equal(similarity.formulaVersion, "phase4-batch1-v1");
  assert.ok(similarity.totalScore >= 0);
  assert.ok(similarity.componentScores.distanceScore >= 0);
  assert.ok(similarity.componentScores.sourceScore >= 0);
  assert.ok(similarity.label === "Excellent Match" || similarity.label === "Strong Match" || similarity.label === "Moderate Match" || similarity.label === "Weak Match" || similarity.label === "Poor Match");
});

test("buildAdjustmentModel validates unsupported adjustments and prevents double-counting", () => {
  const adjustments = buildAdjustmentModel(approvedComp, subjectProperty, {
    adjustments: [
      { category: "square-footage", amount: 10000, method: "market-derived", source: "market", evidence: "paired sales", confidence: 0.8, approved: true },
      { category: "bedroom", amount: 5000, method: "market-derived", source: "market", evidence: "paired sales", confidence: 0.8, approved: true },
      { category: "condition", amount: 8000, method: "unsupported / review required", source: "system", evidence: "", confidence: 0.2, approved: false },
      { category: "renovation", amount: 4000, method: "market-derived", source: "market", evidence: "paired sales", confidence: 0.8, approved: true },
    ],
  });
  const validation = validateAdjustments(adjustments);
  assert.equal(adjustments.length, 4);
  assert.equal(validation.supportedAdjustmentCount, 3);
  assert.equal(validation.issues.includes("unsupported adjustment"), true);
  assert.equal(validation.doubleCountPrevented, true);
});

test("calculateAdjustedCompValue produces adjusted values and reduces weight for heavy adjustments", () => {
  const adjusted = calculateAdjustedCompValue(approvedComp, subjectProperty, {
    adjustments: [
      { category: "market-time", amount: 2500, method: "market-derived", source: "market", evidence: "paired sales", confidence: 0.8, approved: true },
      { category: "square-footage", amount: 6000, method: "market-derived", source: "market", evidence: "paired sales", confidence: 0.8, approved: true },
      { category: "bedroom", amount: 4000, method: "market-derived", source: "market", evidence: "paired sales", confidence: 0.8, approved: true },
    ],
  });
  assert.ok(adjusted.adjustedValue > 0);
  assert.ok(adjusted.finalWeight <= 1);
  assert.equal(adjusted.weightingReason, "standard");
});

test("buildMultiMethodValuation returns methods and a reconciled ARV range", () => {
  const comps = [
    {
      ...approvedComp,
      adjustedValue: 285000,
      finalWeight: 0.9,
      approvedAdjustments: true,
      inclusionStatus: "approved",
    },
    {
      ...approvedComp,
      id: "comp-2",
      address: "101 Test St",
      salePrice: 270000,
      adjustedValue: 272000,
      finalWeight: 0.8,
      approvedAdjustments: true,
      inclusionStatus: "approved",
    },
  ];
  const valuation = buildMultiMethodValuation({ subjectProperty, comps });
  assert.ok(valuation.methods.length >= 4);
  assert.ok(valuation.reconciledLowArv > 0);
  assert.ok(valuation.reconciledHighArv >= valuation.reconciledLowArv);
  assert.equal(valuation.reconciliation.selectedMethod, "weighted-adjusted-sale-price");
});

test("buildArvConfidence caps confidence for one comp and lowers it for source conflicts", () => {
  const valuation = buildArvConfidence({
    approvedCompCount: 1,
    sourceConflicts: true,
    methodSpread: 12000,
    grossAdjustmentPct: 12,
    adjustmentConfidence: 0.7,
  });
  assert.equal(valuation.classification, "Preliminary");
  assert.ok(valuation.score <= 60);
});

test("buildRedTeamReview and createValuationVersion preserve proposed versus approved separation", () => {
  const valuation = buildCanonicalValuationEngine({ subjectProperty, comps: [approvedComp] });
  const redTeam = buildRedTeamReview({ baseArv: 300000, conservativeArv: 285000, aggressiveArv: 315000, decisionBreakingArv: 285000 });
  const version = createValuationVersion({
    valuation,
    redTeam,
    approvedArv: 300000,
    proposedArv: 310000,
  });
  assert.equal(redTeam.baseArv, 300000);
  assert.equal(version.approvedArv, 300000);
  assert.equal(version.proposedArv, 310000);
  assert.equal(version.versionId.startsWith("valuation-"), true);
});
