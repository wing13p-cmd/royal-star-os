import test from "node:test";
import assert from "node:assert/strict";

import { createCrossModuleSyncService } from "./crossModuleSyncService.js";

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
        strategy: "Flip",
        status: "active",
      },
    ],
    properties: [],
    portfolio: [
      {
        id: "portfolio-952",
        propertyAddress: "952 Goss Rd",
        city: "Cincinnati",
        state: "OH",
        zipCode: "45229",
        purchasePrice: 135000,
        strategy: "Hold",
        status: "Active",
      },
      {
        id: "portfolio-100",
        propertyAddress: "100 Main St",
        city: "Cincinnati",
        state: "OH",
        zipCode: "45211",
        purchasePrice: 150000,
        strategy: "Hold",
        status: "Active",
      },
    ],
    rehabProjects: [
      {
        id: "rehab-1",
        projectName: "952 Rehab",
        propertyAddress: "952 Goss Rd",
        city: "Cincinnati",
        state: "OH",
        zipCode: "45229",
        projectStatus: "Draft",
      },
    ],
  };

  const service = createCrossModuleSyncService({
    readDeals: async () => store.deals,
    writeDeals: async (next) => { store.deals = next; },
    readProperties: async () => store.properties,
    writeProperties: async (next) => { store.properties = next; },
    readPortfolio: async () => store.portfolio,
    writePortfolio: async (next) => { store.portfolio = next; },
    readRehabProjects: async () => store.rehabProjects,
    writeRehabProjects: async (next) => { store.rehabProjects = next; },
  });

  return { store, service };
}

test("idempotent deal import updates linked property without creating duplicates", async () => {
  const { service, store } = createHarness();

  const first = await service.synchronizeDealImport("deal-952", "Brandon Sterling");
  assert.equal(first.ok, true);
  assert.equal(store.properties.length, 2);

  const second = await service.synchronizeDealImport("deal-952", "Brandon Sterling");
  assert.equal(second.ok, true);
  assert.equal(store.properties.length, 2);

  const linked = store.properties.find((entry) => entry.linkedDealId === "deal-952");
  assert.ok(linked);
  assert.equal(linked.id, "property-deal-952");
});

test("no duplicate property records are created for same ID or linked deal", async () => {
  const { service, store } = createHarness();

  await service.synchronizeAll("Brandon Sterling");
  await service.synchronizeAll("Brandon Sterling");

  const ids = store.properties.map((entry) => entry.id);
  assert.equal(new Set(ids).size, ids.length);

  const linkedDealRows = store.properties.filter((entry) => entry.linkedDealId === "deal-952");
  assert.equal(linkedDealRows.length, 1);
});

test("sync preserves ownership and rehab state defaults without auto-promoting lifecycle", async () => {
  const { service, store } = createHarness();

  await service.synchronizeDealImport("deal-952", "Brandon Sterling");
  const linked = store.properties.find((entry) => entry.linkedDealId === "deal-952");
  assert.ok(linked);
  assert.equal(linked.ownershipStatus, "Not Owned");
  assert.equal(linked.rehabStatus, "Not Started");

  const rehab = store.rehabProjects.find((entry) => entry.id === "rehab-1");
  assert.ok(rehab);
  assert.equal(rehab.projectStatus, "Draft");
});
