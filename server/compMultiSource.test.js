import test from "node:test";
import assert from "node:assert/strict";

import {
  AttomCompAdapter,
  ResoMlsCompAdapter,
  BridgeResoAdapter,
  CountyImportAdapter,
  GenericAuthorizedProviderAdapter,
  buildCompProviderConfig,
} from "./compProviderEngine.js";
import { buildMultiSourceCompSearchService } from "./multiSourceCompOrchestrator.js";
import { MediaRightsPolicyService } from "./mediaRightsPolicyService.js";

test("attom adapter reports disabled without credentials", async () => {
  const adapter = new AttomCompAdapter(buildCompProviderConfig({}));
  const status = adapter.getProviderStatus();
  assert.equal(status.provider, "attom");
  assert.equal(status.status, "Disabled");
  const capabilities = adapter.getCapabilities();
  assert.equal(capabilities.publicRecordSales, false);
  assert.equal(capabilities.propertyRecords, true);
});

test("reso adapter reports disabled without dataset credentials", async () => {
  const adapter = new ResoMlsCompAdapter(buildCompProviderConfig({}));
  const status = adapter.getProviderStatus();
  assert.equal(status.status, "Disabled");
  const capabilities = adapter.getCapabilities();
  assert.equal(capabilities.mlsListings, false);
  assert.equal(capabilities.propertyRecords, true);
});

test("bridge adapter reports disabled without bridge credentials", async () => {
  const adapter = new BridgeResoAdapter(buildCompProviderConfig({}));
  const status = adapter.getProviderStatus();
  assert.equal(status.status, "Disabled");
  const capabilities = adapter.getCapabilities();
  assert.equal(capabilities.propertyRecords, true);
  assert.equal(capabilities.mediaRightsUnknown, true);
});

test("county import adapter previews records without scraping", async () => {
  const adapter = new CountyImportAdapter(buildCompProviderConfig({}));
  const preview = await adapter.buildImportPreview([
    { address: "123 Main St", salePrice: 250000, saleDate: "2024-01-10", sourceJurisdiction: "Hamilton County" },
  ]);
  assert.equal(preview.rows.length, 1);
  assert.equal(preview.rows[0].address, "123 Main St");
  assert.equal(preview.rows[0].sourceType, "county");
});

test("multi-source orchestrator isolates provider failures", async () => {
  const adapters = {
    manual: new GenericAuthorizedProviderAdapter(buildCompProviderConfig({ provider: "manual" })),
    rentcast: new GenericAuthorizedProviderAdapter(buildCompProviderConfig({ provider: "rentcast" })),
    attom: new AttomCompAdapter(buildCompProviderConfig({})),
  };
  const service = buildMultiSourceCompSearchService({ adapters });
  const result = await service.searchSoldComparables({ address: "952 Goss Rd" });
  assert.equal(result.providersQueried.length, 3);
  assert.equal(result.providersSuccessful.length, 0);
  assert.equal(result.providersUnavailable.length, 3);
  assert.equal(result.records.length, 0);
});

test("multi-source orchestrator can surface active listings and media metadata", async () => {
  const adapters = {
    attom: new AttomCompAdapter(buildCompProviderConfig({})),
    rentcast: new GenericAuthorizedProviderAdapter(buildCompProviderConfig({ provider: "rentcast" })),
  };
  const service = buildMultiSourceCompSearchService({ adapters });
  const result = await service.searchActiveListings({ address: "952 Goss Rd" });
  assert.equal(result.providersQueried.length, 2);
  assert.equal(result.records.length, 0);
  assert.equal(result.mediaRestricted, 0);
});

test("media rights policy defaults to remote reference only", () => {
  const service = new MediaRightsPolicyService();
  const policy = service.evaluateMediaRights({ provider: "attom" });
  assert.equal(policy.mode, "REMOTE_REFERENCE_ONLY");
  assert.equal(policy.localStorageAllowed, false);
  assert.equal(policy.thumbnailCachingAllowed, false);
});

test("canonical media records preserve safe review-first rights metadata", () => {
  const service = new MediaRightsPolicyService();
  const media = service.buildCanonicalMediaRecord({
    url: "https://example.com/photo.jpg",
    provider: "attom",
    label: "Primary Photo",
    sourceType: "provider",
  });
  assert.equal(media.rightsMode, "REMOTE_REFERENCE_ONLY");
  assert.equal(media.requiresReview, true);
  assert.equal(media.localStorageAllowed, false);
  assert.equal(media.includeInAppraiserPacket, false);
});
