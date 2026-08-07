import test from "node:test";
import assert from "node:assert/strict";

import { createDealPortfolioSyncService } from "./dealPortfolioSyncService.js";

function createHarness() {
  const store = {
    deals: [
      {
        id: "deal-952",
        propertyAddress: "952 Goss Rd",
        city: "Cincinnati",
        state: "OH",
        zipCode: "45229",
        propertyType: "Single Family",
        purchasePrice: 135000,
        rehabBudget: 60000,
        estimatedArv: 300000,
        strategy: "BRRRR",
        status: "Owned",
        notes: "Protected record",
        createdAt: "2026-08-01T00:00:00.000Z",
        updatedAt: "2026-08-05T00:00:00.000Z",
      },
      {
        id: "deal-hold-1",
        propertyAddress: "100 Main St",
        city: "Cincinnati",
        state: "OH",
        zipCode: "45211",
        propertyType: "Single Family",
        purchasePrice: 150000,
        rehabBudget: 20000,
        estimatedArv: 240000,
        strategy: "Hold",
        status: "Purchased",
        createdAt: "2026-08-02T00:00:00.000Z",
        updatedAt: "2026-08-05T00:00:00.000Z",
      },
    ],
    portfolio: [],
    audit: [],
  };

  const service = createDealPortfolioSyncService({
    readDeals: async () => store.deals,
    writeDeals: async (next) => { store.deals = next; },
    readPortfolio: async () => store.portfolio,
    writePortfolio: async (next) => { store.portfolio = next; },
    readAudit: async () => store.audit,
    writeAudit: async (next) => { store.audit = next; },
  });

  return { store, service };
}

test("952 Goss Rd remains unchanged before sync", async () => {
  const { store } = createHarness();
  const protectedDeal = store.deals.find((entry) => entry.id === "deal-952");
  assert.equal(protectedDeal.propertyAddress, "952 Goss Rd");
  assert.equal(protectedDeal.purchasePrice, 135000);
  assert.equal(protectedDeal.estimatedArv, 300000);
});

test("deal-to-portfolio preview returns expected change categories", async () => {
  const { service } = createHarness();
  const preview = await service.previewDealToPortfolioSync("deal-hold-1", "Brandon Sterling");
  assert.equal(preview.ok, true);
  assert.equal(preview.approvalRequired, true);
  assert.ok(Array.isArray(preview.fieldsToCreate));
  assert.ok(preview.fieldsToCreate.length > 0);
});

test("sync requires explicit approval", async () => {
  const { service } = createHarness();
  const result = await service.executeDealToPortfolioSync("deal-hold-1", false, "Brandon Sterling");
  assert.equal(result.ok, false);
  assert.equal(result.status, "EXPLICIT_APPROVAL_REQUIRED");
});

test("approved sync creates one portfolio record", async () => {
  const { service, store } = createHarness();
  const result = await service.executeDealToPortfolioSync("deal-hold-1", true, "Brandon Sterling");
  assert.equal(result.ok, true);
  assert.equal(result.created, true);
  assert.equal(store.portfolio.length, 1);
  assert.equal(store.portfolio[0].linkedDealId, "deal-hold-1");
});

test("synchronized portfolio record contains dashboard and export summary fields", async () => {
  const { service, store } = createHarness();
  await service.executeDealToPortfolioSync("deal-hold-1", true, "Brandon Sterling");
  const record = store.portfolio[0];

  assert.equal(typeof record.propertyName, "string");
  assert.equal(record.propertyAddress, "100 Main St");
  assert.equal(record.city, "Cincinnati");
  assert.equal(record.state, "OH");
  assert.equal(record.status, "Purchased");
});

test("repeated sync does not create duplicates", async () => {
  const { service, store } = createHarness();
  await service.executeDealToPortfolioSync("deal-hold-1", true, "Brandon Sterling");
  await service.executeDealToPortfolioSync("deal-hold-1", true, "Brandon Sterling");
  assert.equal(store.portfolio.length, 1);
});

test("existing linked portfolio record is safely updated while preserving portfolio-owned fields", async () => {
  const { service, store } = createHarness();
  store.portfolio = [
    {
      id: "portfolio-1",
      linkedDealId: "deal-hold-1",
      propertyName: "100 Main St",
      propertyAddress: "100 Main St",
      city: "Cincinnati",
      state: "OH",
      zipCode: "45211",
      purchasePrice: 140000,
      rehabBudget: 10000,
      monthlyRent: 2500,
      operatingExpenses: 700,
      currentValue: 260000,
      favorite: true,
      protectedFields: ["supportedArv"],
      approvedFields: [],
      auditMetadata: {},
    },
  ];

  const result = await service.executeDealToPortfolioSync("deal-hold-1", true, "Brandon Sterling");
  assert.equal(result.ok, true);
  const linked = store.portfolio[0];
  assert.equal(linked.purchasePrice, 150000);
  assert.equal(linked.monthlyRent, 2500);
  assert.equal(linked.favorite, true);
});

test("manual portfolio entry remains operational after sync", async () => {
  const { service, store } = createHarness();
  store.portfolio = [
    {
      id: "portfolio-manual",
      propertyName: "Manual Entry Property",
      propertyAddress: "700 Manual Ave",
      city: "Cincinnati",
      state: "OH",
      zipCode: "45212",
      status: "Active",
      strategy: "Hold",
      favorite: true,
      notes: "manual entry",
    },
  ];

  await service.executeDealToPortfolioSync("deal-hold-1", true, "Brandon Sterling");
  const manual = store.portfolio.find((entry) => entry.id === "portfolio-manual");
  assert.ok(manual);
  assert.equal(manual.favorite, true);
  assert.equal(manual.notes, "manual entry");
});

test("possible duplicate address is blocked for review", async () => {
  const { service, store } = createHarness();
  store.portfolio = [
    {
      id: "portfolio-dup",
      propertyName: "100 Main St",
      propertyAddress: "100 Main St",
      city: "",
      state: "",
      zipCode: "",
      sourceRecordId: "legacy-1",
    },
  ];

  const result = await service.executeDealToPortfolioSync("deal-hold-1", true, "Brandon Sterling");
  assert.equal(result.ok, false);
  assert.equal(result.status, "REVIEW_REQUIRED_DUPLICATE");
});

test("rollback restores pre-sync state", async () => {
  const { service, store } = createHarness();
  await service.executeDealToPortfolioSync("deal-hold-1", true, "Brandon Sterling");
  assert.equal(store.portfolio.length, 1);

  const rollback = await service.rollbackLastSyncEvent("deal-hold-1", "Brandon Sterling");
  assert.equal(rollback.ok, true);
  assert.equal(store.portfolio.length, 0);
});

test("sync status endpoint returns linked status", async () => {
  const { service } = createHarness();
  await service.executeDealToPortfolioSync("deal-hold-1", true, "Brandon Sterling");
  const status = await service.getDealPortfolioSyncStatus("deal-hold-1");
  assert.equal(status.ok, true);
  assert.equal(status.syncStatus, "SYNCED");
  assert.ok(status.linkedPortfolioId);
});

test("audit events are written for sync actions", async () => {
  const { service, store } = createHarness();
  await service.previewDealToPortfolioSync("deal-hold-1", "Brandon Sterling");
  await service.executeDealToPortfolioSync("deal-hold-1", true, "Brandon Sterling");
  assert.ok(store.audit.length >= 2);
  assert.ok(store.audit.some((entry) => entry.action === "sync preview generated"));
  assert.ok(store.audit.some((entry) => entry.action === "sync completed"));
});
