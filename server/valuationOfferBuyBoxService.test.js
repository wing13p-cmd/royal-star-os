import test from "node:test";
import assert from "node:assert/strict";
import {
  calculateCompSimilarity,
  calculateCompWeight,
  detectCompOutlier,
  buildValuationRange,
  calculateArvConfidence,
  evaluateCovingtonBuyBox,
  evaluateCincinnatiBuyBox,
  createValuationOfferBuyBoxService,
  deriveUnifiedUnderwritingIntelligence,
} from "./valuationOfferBuyBoxService.js";

function createFixture() {
  const db = {
    deals: [
      {
        id: "deal-1",
        propertyAddress: "952 Goss Rd",
        city: "Covington",
        state: "KY",
        zipCode: "41011",
        propertyType: "Single Family",
        units: 1,
        squareFeet: 1500,
        bedrooms: 3,
        bathrooms: 2,
        yearBuilt: 1940,
        purchasePrice: 130000,
        rehabBudget: 45000,
        strategy: "Flip",
        estimatedRent: 1900,
      },
      {
        id: "deal-2",
        propertyAddress: "111 Elm St",
        city: "Cincinnati",
        state: "OH",
        zipCode: "45211",
        propertyType: "Single Family",
        units: 1,
        squareFeet: 1400,
        bedrooms: 3,
        bathrooms: 1.5,
        yearBuilt: 1935,
        purchasePrice: 125000,
        rehabBudget: 55000,
        strategy: "BRRRR",
        estimatedRent: 2100,
      },
    ],
    comps: [
      {
        id: "comp-1",
        compAddress: "900 First Ave",
        city: "Covington",
        state: "KY",
        zipCode: "41011",
        propertyType: "Single Family",
        salePrice: 245000,
        saleDate: "2026-06-10",
        squareFeet: 1460,
        bedrooms: 3,
        bathrooms: 2,
        yearBuilt: 1941,
        included: true,
        inclusionStatus: "approved",
        qualityScore: 84,
        distanceMiles: 0.8,
        verified: true,
      },
      {
        id: "comp-2",
        compAddress: "901 First Ave",
        city: "Covington",
        state: "KY",
        zipCode: "41011",
        propertyType: "Single Family",
        salePrice: 252000,
        saleDate: "2026-05-12",
        squareFeet: 1520,
        bedrooms: 3,
        bathrooms: 2,
        yearBuilt: 1942,
        included: true,
        inclusionStatus: "reviewed",
        qualityScore: 80,
        distanceMiles: 1.1,
        verified: true,
      },
      {
        id: "comp-3",
        compAddress: "902 First Ave",
        city: "Covington",
        state: "KY",
        zipCode: "41011",
        propertyType: "Single Family",
        salePrice: 259000,
        saleDate: "2026-04-02",
        squareFeet: 1550,
        bedrooms: 3,
        bathrooms: 2,
        yearBuilt: 1939,
        included: true,
        inclusionStatus: "approved",
        qualityScore: 78,
        distanceMiles: 1.4,
        verified: true,
      },
      {
        id: "comp-rejected",
        compAddress: "903 First Ave",
        city: "Covington",
        state: "KY",
        zipCode: "41011",
        propertyType: "Single Family",
        salePrice: 330000,
        saleDate: "2026-06-15",
        squareFeet: 1400,
        bedrooms: 3,
        bathrooms: 2,
        yearBuilt: 1940,
        included: true,
        inclusionStatus: "rejected",
        qualityScore: 86,
        distanceMiles: 0.9,
        verified: true,
      },
      {
        id: "comp-pending",
        compAddress: "904 First Ave",
        city: "Covington",
        state: "KY",
        zipCode: "41011",
        propertyType: "Single Family",
        salePrice: 248000,
        saleDate: "2026-03-01",
        squareFeet: 1500,
        bedrooms: 3,
        bathrooms: 2,
        yearBuilt: 1940,
        included: true,
        inclusionStatus: "pending",
        qualityScore: 75,
        distanceMiles: 1.0,
        verified: false,
      },
    ],
    neighborhoods: [
      {
        id: "n-1",
        city: "Covington",
        state: "KY",
        zipCode: "41011",
        rentalDemandScore: 72,
        appreciation1Year: 4.1,
      },
    ],
    audit: [],
  };

  const service = createValuationOfferBuyBoxService({
    readDeals: async () => db.deals,
    writeDeals: async (next) => {
      db.deals = next;
    },
    readComps: async () => db.comps,
    readNeighborhoods: async () => db.neighborhoods,
    readAudit: async () => db.audit,
    writeAudit: async (next) => {
      db.audit = next;
    },
  });

  return { db, service };
}

test("calculateCompSimilarity returns a bounded score and components", () => {
  const subject = { propertyType: "Single Family", squareFeet: 1500, bedrooms: 3, bathrooms: 2, yearBuilt: 1940, lotSize: 5000 };
  const comp = { propertyType: "Single Family", squareFeet: 1480, bedrooms: 3, bathrooms: 2, yearBuilt: 1941, lotSize: 5100, saleDate: "2026-06-01", distanceMiles: 1.2, qualityScore: 85 };
  const output = calculateCompSimilarity(subject, comp);
  assert.ok(output.score >= 0 && output.score <= 1);
  assert.ok(output.components.squareFeet > 0);
});

test("calculateCompWeight gives lower weight to pending comps than approved comps", () => {
  const subject = { propertyType: "Single Family", squareFeet: 1500 };
  const approved = calculateCompWeight(subject, { propertyType: "Single Family", squareFeet: 1490, salePrice: 250000, saleDate: "2026-06-01", inclusionStatus: "approved", qualityScore: 80, verified: true });
  const pending = calculateCompWeight(subject, { propertyType: "Single Family", squareFeet: 1490, salePrice: 250000, saleDate: "2026-06-01", inclusionStatus: "pending", qualityScore: 80, verified: false });
  assert.ok(approved.weight > pending.weight);
});

test("detectCompOutlier flags extreme price-per-square-foot outliers", () => {
  const base = [
    { salePrice: 240000, squareFeet: 1500 },
    { salePrice: 245000, squareFeet: 1500 },
    { salePrice: 250000, squareFeet: 1500 },
    { salePrice: 255000, squareFeet: 1500 },
  ];
  const outlier = { salePrice: 430000, squareFeet: 1200 };
  const output = detectCompOutlier(outlier, [...base, outlier]);
  assert.equal(output.isOutlier, true);
});

test("buildValuationRange returns review-required when insufficient comps", () => {
  const subject = { zipCode: "41011", propertyType: "Single Family", squareFeet: 1500 };
  const range = buildValuationRange(subject, [{ salePrice: 250000, squareFeet: 1500, inclusionStatus: "approved", saleDate: "2026-06-01" }]);
  assert.equal(range.valuationReviewStatus, "REVIEW_REQUIRED");
  assert.ok(range.warnings.includes("INSUFFICIENT_COMPS"));
});

test("calculateArvConfidence is low with zero comps", () => {
  const confidence = calculateArvConfidence({}, []);
  assert.equal(confidence.label, "LOW");
  assert.equal(confidence.score, 0);
});

test("deriveUnifiedUnderwritingIntelligence excludes rejected comps from comp universe", () => {
  const deal = { id: "deal-1", zipCode: "41011", city: "Covington", state: "KY", squareFeet: 1500, propertyType: "Single Family", rehabBudget: 45000, purchasePrice: 130000 };
  const comps = [
    { id: "a", zipCode: "41011", city: "Covington", state: "KY", salePrice: 250000, squareFeet: 1500, saleDate: "2026-05-01", inclusionStatus: "approved", included: true, verified: true },
    { id: "b", zipCode: "41011", city: "Covington", state: "KY", salePrice: 255000, squareFeet: 1500, saleDate: "2026-05-02", inclusionStatus: "approved", included: true, verified: true },
    { id: "c", zipCode: "41011", city: "Covington", state: "KY", salePrice: 260000, squareFeet: 1500, saleDate: "2026-05-03", inclusionStatus: "rejected", included: true, verified: true },
  ];
  const output = deriveUnifiedUnderwritingIntelligence(deal, comps, [], {});
  assert.equal(output.compUniverse.approved.length, 2);
  assert.equal(output.compUniverse.rejectedCount, 1);
});

test("previewArvRecommendation returns governed valuation payload", async () => {
  const { service } = createFixture();
  const preview = await service.previewArvRecommendation("deal-1");
  assert.equal(preview.ok, true);
  assert.ok(preview.supportedArv > 0);
  assert.ok(preview.compCountUsed >= 2);
});

test("approveArvRecommendation enforces explicit user approval", async () => {
  const { service } = createFixture();
  const denied = await service.approveArvRecommendation("deal-1", null, false, "Tester");
  assert.equal(denied.ok, false);
  assert.equal(denied.status, "EXPLICIT_APPROVAL_REQUIRED");
});

test("approveArvRecommendation stores approved ARV and protected fields", async () => {
  const { service, db } = createFixture();
  const approved = await service.approveArvRecommendation("deal-1", 251000, true, "Tester");
  assert.equal(approved.ok, true);
  const updatedDeal = db.deals.find((deal) => deal.id === "deal-1");
  assert.equal(updatedDeal.auditMetadata?.valuationGovernance?.approvedArv, 251000);
  assert.ok(Array.isArray(updatedDeal.protectedFields));
  assert.ok(updatedDeal.protectedFields.includes("approvedArv"));
});

test("offer preview uses preliminary valuation source before ARV approval", async () => {
  const { service } = createFixture();
  const preview = await service.previewOfferRecommendation("deal-1", { targetProfit: 25000, sellingCostPct: 0.08, holdingMonths: 6, monthlyHoldingCost: 1200 });
  assert.equal(preview.ok, true);
  assert.equal(preview.offer.valuationSource, "RECOMMENDED_ARV_PRELIMINARY");
});

test("offer preview switches to approved valuation source after ARV approval", async () => {
  const { service } = createFixture();
  await service.approveArvRecommendation("deal-1", 252000, true, "Tester");
  const preview = await service.previewOfferRecommendation("deal-1", { targetProfit: 25000, sellingCostPct: 0.08, holdingMonths: 6, monthlyHoldingCost: 1200 });
  assert.equal(preview.offer.valuationSource, "APPROVED_ARV");
});

test("buy box policy evaluates target market rules", () => {
  const covington = evaluateCovingtonBuyBox({ zipCode: "41011", propertyType: "Single Family", units: 1, squareFeet: 1500, rehabBudget: 50000, strategy: "Flip" }, { arvConfidenceScore: 78, expectedProfit: 35000 });
  const cincinnati = evaluateCincinnatiBuyBox({ zipCode: "45211", propertyType: "Single Family", units: 1, squareFeet: 1450, rehabBudget: 58000, strategy: "BRRRR" }, { arvConfidenceScore: 72, expectedProfit: 28000 });
  assert.ok(["PASS", "CONDITIONAL PASS", "REVIEW REQUIRED"].includes(covington.result));
  assert.ok(["PASS", "CONDITIONAL PASS", "REVIEW REQUIRED"].includes(cincinnati.result));
});

test("buy box evaluation hard-fails non 1-4 unit properties", async () => {
  const { service } = createFixture();
  const preview = await service.previewBuyBoxEvaluation("deal-1");
  assert.equal(preview.ok, true);

  const outside = evaluateCovingtonBuyBox({ zipCode: "41011", propertyType: "Commercial", units: 8, squareFeet: 5500, rehabBudget: 120000 }, { arvConfidenceScore: 80 });
  assert.equal(outside.result, "FAIL");
});

test("buy box approval enforces explicit approval", async () => {
  const { service } = createFixture();
  const denied = await service.approveBuyBoxReview("deal-1", false, "Tester");
  assert.equal(denied.ok, false);
  assert.equal(denied.status, "EXPLICIT_APPROVAL_REQUIRED");
});

test("appraiser packet support includes governed comp set and valuation range", async () => {
  const { service } = createFixture();
  const support = await service.getAppraiserPacketSupport("deal-1");
  assert.equal(support.ok, true);
  assert.ok(Array.isArray(support.compSet));
  assert.ok(support.lowBaseHighRange.base > 0);
});

test("audit histories are generated for valuation and offer actions", async () => {
  const { service } = createFixture();
  await service.previewArvRecommendation("deal-1");
  await service.approveArvRecommendation("deal-1", 252000, true, "Tester");
  await service.previewOfferRecommendation("deal-1", { targetProfit: 25000, sellingCostPct: 0.08, holdingMonths: 6, monthlyHoldingCost: 1200 });
  const arvHistory = await service.getArvAuditHistory("deal-1");
  const offerHistory = await service.getOfferAuditHistory("deal-1");
  assert.ok(arvHistory.length >= 2);
  assert.ok(offerHistory.length >= 1);
});

test("rollbackLatestApproval restores previous approved ARV", async () => {
  const { service } = createFixture();
  await service.approveArvRecommendation("deal-1", 250000, true, "Tester");
  await service.approveArvRecommendation("deal-1", 255000, true, "Tester");
  const rollback = await service.rollbackLatestApproval("deal-1", "Tester");
  assert.equal(rollback.ok, true);
  assert.equal(rollback.approvedArv, 250000);
});
