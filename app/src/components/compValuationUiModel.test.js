import test from "node:test";
import assert from "node:assert/strict";
import { buildCompValuationUiModel } from "./compValuationUiModel.js";

test("buildCompValuationUiModel surfaces advisory valuation results from included comps", () => {
  const model = buildCompValuationUiModel({
    comps: [
      { id: "comp-1", compAddress: "101 Main St", salePrice: 220000, squareFeet: 1400, included: true, qualityScore: 85, verified: true, inclusionStatus: "approved", warningFlags: [] },
      { id: "comp-2", compAddress: "102 Main St", salePrice: 230000, squareFeet: 1450, included: true, qualityScore: 77, verified: false, inclusionStatus: "pending", warningFlags: ["unverified sale"] },
      { id: "comp-3", compAddress: "103 Main St", salePrice: 210000, squareFeet: 1350, included: false, qualityScore: 50, verified: true, inclusionStatus: "excluded", warningFlags: ["excluded"] },
    ],
    subjectDeal: { squareFeet: 1400 },
  });

  assert.equal(model.methods.length, 4);
  assert.ok(model.confidenceScore >= 0);
  assert.equal(model.approvedComps.length, 1);
  assert.equal(model.reviewQueue.length, 1);
  assert.equal(model.pendingImports.length, 1);
  assert.equal(model.rejectedComps.length, 1);
  assert.match(model.confidenceLabel, /High|Moderate|Preliminary|Low/);
});

test("buildCompValuationUiModel returns an empty advisory state when no comps are present", () => {
  const model = buildCompValuationUiModel({ comps: [], subjectDeal: null });

  assert.equal(model.methods.length, 0);
  assert.equal(model.approvedComps.length, 0);
  assert.equal(model.reviewQueue.length, 0);
  assert.equal(model.pendingImports.length, 0);
  assert.equal(model.rejectedComps.length, 0);
  assert.equal(model.confidenceLabel, "Pending");
});
