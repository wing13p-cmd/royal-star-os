import test from "node:test";
import assert from "node:assert/strict";

import { createDealPropertySyncService } from "./dealPropertySyncService.js";

function createHarness() {
  const store = {
    deals: [
      {
        id: "deal-952",
        linkedPropertyId: "property-952",
        propertyId: "property-952",
        propertyAddress: "952 Goss Rd",
        city: "Cincinnati",
        state: "OH",
        zipCode: "45229",
        propertyType: "Single Family",
        bedrooms: 4,
        bathrooms: 2.5,
        squareFeet: 1562,
        yearBuilt: 1929,
        purchasePrice: 135000,
        rehabBudget: 60000,
        estimatedArv: 300000,
        estimatedRent: "",
        taxes: "",
        insurance: "",
        strategy: "Flip",
        status: "Lead",
        pipelineStage: "New Lead",
        parcelNumber: "123456789",
        mapUrl: "https://maps.google.com/?q=952+Goss+Rd",
        updatedAt: "2026-08-06T18:00:00.000Z",
      },
    ],
    properties: [
      {
        id: "property-952",
        linkedDealId: "deal-952",
        propertyName: "952 Goss Rd",
        address: "952 Goss Rd",
        city: "Cincinnati",
        state: "OH",
        zipCode: "45229",
        propertyType: "Single Family",
        purchasePrice: 135000,
        currentRehabBudget: 60000,
        currentValue: 300000,
        monthlyRent: 2200,
        monthlyTaxes: 300,
        monthlyInsurance: 120,
        strategy: "Flip",
        status: "Lead",
        propertyStatus: "Lead",
        pipelineStage: "New Lead",
        parcelNumber: "123456789",
        mapUrl: "https://maps.google.com/?q=952+Goss+Rd",
        updatedAt: "2026-08-06T18:00:00.000Z",
      },
      {
        id: "property-test-2",
        linkedDealId: "",
        propertyName: "test property 2",
        address: "100 main st",
        city: "cincinnati",
        state: "oh",
        zipCode: "45211",
        status: "Active",
        propertyStatus: "Active",
        currentValue: 250000,
        purchasePrice: 150000,
        monthlyRent: 2200,
        updatedAt: "2026-08-06T18:00:00.000Z",
      },
    ],
  };

  const service = createDealPropertySyncService({
    readDeals: async () => store.deals,
    writeDeals: async (next) => { store.deals = next; },
    readProperties: async () => store.properties,
    writeProperties: async (next) => { store.properties = next; },
  });

  return { store, service };
}

test("deal ARV synchronization updates linked property and does not create a new property", async () => {
  const { store, service } = createHarness();
  const initialCount = store.properties.length;

  store.deals[0] = {
    ...store.deals[0],
    estimatedArv: 301000,
    updatedAt: "2026-08-06T19:00:00.000Z",
  };

  const result = await service.synchronizeAfterSave({
    sourceEntity: "deal",
    savedRecordId: "deal-952",
    sourceModule: "Deal Intake",
  });

  assert.equal(result.ok, true);
  assert.equal(store.properties.length, initialCount);
  const linkedProperty = store.properties.find((entry) => entry.id === "property-952");
  assert.equal(linkedProperty.currentValue, 301000);
});

test("property ARV synchronization updates linked deal", async () => {
  const { store, service } = createHarness();

  store.properties[0] = {
    ...store.properties[0],
    currentValue: 302000,
    updatedAt: "2026-08-06T19:05:00.000Z",
  };

  const result = await service.synchronizeAfterSave({
    sourceEntity: "property",
    savedRecordId: "property-952",
    sourceModule: "Property Database",
  });

  assert.equal(result.ok, true);
  const linkedDeal = store.deals.find((entry) => entry.id === "deal-952");
  assert.equal(linkedDeal.estimatedArv, 302000);
});

test("status and pipeline stage synchronize from deal to property with transition history", async () => {
  const { store, service } = createHarness();

  store.deals[0] = {
    ...store.deals[0],
    status: "Under Contract",
    pipelineStage: "Under Contract",
    updatedAt: "2026-08-06T19:10:00.000Z",
  };

  const result = await service.synchronizeAfterSave({
    sourceEntity: "deal",
    savedRecordId: "deal-952",
    sourceModule: "Deal Intake",
  });

  assert.equal(result.ok, true);
  const linkedProperty = store.properties.find((entry) => entry.id === "property-952");
  assert.equal(linkedProperty.status, "Under Contract");
  assert.equal(linkedProperty.propertyStatus, "Under Contract");
  assert.equal(linkedProperty.pipelineStage, "Under Contract");
  const history = JSON.parse(linkedProperty.workflowTransitionHistory || "[]");
  assert.ok(Array.isArray(history));
});

test("missing-value protection keeps property rent and parcel values when deal values are blank", async () => {
  const { store, service } = createHarness();

  store.deals[0] = {
    ...store.deals[0],
    estimatedRent: "",
    parcelNumber: "",
    updatedAt: "2026-08-06T19:15:00.000Z",
  };

  await service.synchronizeAfterSave({
    sourceEntity: "deal",
    savedRecordId: "deal-952",
    sourceModule: "Deal Intake",
  });

  const linkedProperty = store.properties.find((entry) => entry.id === "property-952");
  assert.equal(linkedProperty.monthlyRent, 2200);
  assert.equal(linkedProperty.parcelNumber, "123456789");
});

test("true zero remains zero when synchronized", async () => {
  const { store, service } = createHarness();

  store.deals[0] = {
    ...store.deals[0],
    rehabBudget: 0,
    updatedAt: "2026-08-06T19:20:00.000Z",
  };

  await service.synchronizeAfterSave({
    sourceEntity: "deal",
    savedRecordId: "deal-952",
    sourceModule: "Deal Intake",
  });

  const linkedProperty = store.properties.find((entry) => entry.id === "property-952");
  assert.equal(linkedProperty.currentRehabBudget, 0);
});

test("no duplication and linkage preservation for 952 and test property 2", async () => {
  const { store, service } = createHarness();
  const initialPropertyCount = store.properties.length;
  const initialDealCount = store.deals.length;

  store.deals[0] = {
    ...store.deals[0],
    estimatedArv: 301000,
    updatedAt: "2026-08-06T19:25:00.000Z",
  };

  await service.synchronizeAfterSave({
    sourceEntity: "deal",
    savedRecordId: "deal-952",
    sourceModule: "Deal Intake",
  });

  assert.equal(store.properties.length, initialPropertyCount);
  assert.equal(store.deals.length, initialDealCount);
  assert.equal(store.properties.filter((entry) => entry.propertyName === "952 Goss Rd").length, 1);
  assert.equal(store.properties.filter((entry) => entry.propertyName === "test property 2").length, 1);
  assert.equal(store.properties.find((entry) => entry.id === "property-test-2")?.currentValue, 250000);
});

test("blank deal linkage IDs are restored and do not prevent status/value synchronization", async () => {
  const { store, service } = createHarness();

  store.deals[0] = {
    ...store.deals[0],
    linkedPropertyId: "",
    propertyId: "",
    parcelNumber: "",
    estimatedArv: 305000,
    status: "Underwriting",
    pipelineStage: "Underwriting In Progress",
    updatedAt: "2026-08-06T19:30:00.000Z",
  };

  await service.synchronizeAfterSave({
    sourceEntity: "deal",
    savedRecordId: "deal-952",
    sourceModule: "Deal Intake",
  });

  const linkedDeal = store.deals.find((entry) => entry.id === "deal-952");
  const linkedProperty = store.properties.find((entry) => entry.id === "property-952");

  assert.equal(linkedDeal.linkedPropertyId, "property-952");
  assert.equal(linkedDeal.propertyId, "property-952");
  assert.equal(linkedDeal.parcelNumber, "123456789");
  assert.equal(linkedProperty.currentValue, 305000);
  assert.equal(linkedProperty.status, "Underwriting");
  assert.equal(linkedProperty.pipelineStage, "Underwriting In Progress");
});

test("migration establishes or preserves linkage without changing record counts", async () => {
  const { store, service } = createHarness();
  const propertyCount = store.properties.length;
  const dealCount = store.deals.length;

  const result = await service.migrateExistingLinkages("Test Migration");

  assert.equal(result.ok, true);
  assert.equal(result.propertyCount, propertyCount);
  assert.equal(result.dealCount, dealCount);
  const deal = store.deals.find((entry) => entry.id === "deal-952");
  const property = store.properties.find((entry) => entry.id === "property-952");
  assert.equal(deal.linkedPropertyId, "property-952");
  assert.equal(property.linkedDealId, "deal-952");
});
