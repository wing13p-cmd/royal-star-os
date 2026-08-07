import test from "node:test";
import assert from "node:assert/strict";
import { buildProductVaultIntelligence, buildMaterialMatrixIntelligence, buildAppraisalPacketIntelligence } from "./optionExpansionIntelligence.js";

test("buildProductVaultIntelligence summarizes selection quality and pricing posture", () => {
  const result = buildProductVaultIntelligence({
    products: [
      { approved: true, preferred: true, currentPrice: 100 },
      { approved: true, preferred: false, currentPrice: 50 },
      { approved: false, preferred: false, currentPrice: 200 },
    ],
    selectedProductIds: ["p1", "p2"],
    taxPercent: 8,
    deal: { propertyAddress: "123 Main St" },
  });

  assert.equal(result.summary.approvedCount, 2);
  assert.equal(result.summary.preferredCount, 1);
  assert.equal(result.summary.subtotal, 150);
  assert.equal(result.summary.taxAmount, 12);
  assert.equal(result.summary.total, 162);
  assert.equal(result.summary.selectionHealth, "Balanced");
  assert.ok(result.recommendations.length > 0);
});

test("buildMaterialMatrixIntelligence highlights priority budget pressure", () => {
  const result = buildMaterialMatrixIntelligence({
    materials: [
      { totalCost: 1000, priority: "High" },
      { totalCost: 500, priority: "Critical" },
      { totalCost: 200, priority: "Medium" },
    ],
    products: [{ approved: true }],
    properties: [{ propertyName: "Main Street" }],
  });

  assert.equal(result.summary.totalBudget, 1700);
  assert.equal(result.summary.highPriorityCount, 2);
  assert.equal(result.summary.budgetHealth, "Watch");
  assert.ok(result.recommendations.some((entry) => entry.includes("priority")));
});

test("buildAppraisalPacketIntelligence provides packet risk and next-step guidance", () => {
  const result = buildAppraisalPacketIntelligence({
    packet: {
      packetName: "Packet A",
      propertyName: "Test Property",
      supportedARV: 200000,
      requestedARV: 210000,
      strategy: "Flip",
    },
    comps: [
      { salePrice: 205000, included: true },
      { salePrice: 210000, included: true },
      { salePrice: 215000, included: true },
    ],
  });

  assert.ok(result.summary.includes("Packet A"));
  assert.equal(result.appraisal.riskLevel, "Low Risk");
  assert.ok(result.nextSteps.length > 0);
});
