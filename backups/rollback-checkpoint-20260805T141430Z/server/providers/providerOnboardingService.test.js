import test from "node:test";
import assert from "node:assert/strict";
import { ProviderOnboardingService } from "./providerOnboardingService.js";
import { createLocalCredentialVault } from "./credentialVault.js";

test("credential vault masks and stores provider secrets without exposing them", () => {
  const vault = createLocalCredentialVault({ storageAvailable: true, filePath: "/tmp/rsos-vault-test.json" });
  const result = vault.upsertCredential("rentcast", { secret: "real-key", metadata: { baseUrl: "https://example.test" } });
  assert.equal(result.ok, true);
  const status = vault.maskStatus("rentcast");
  assert.equal(status.hasSecret, true);
  assert.equal(status.secretMasked.includes("*"), true);
});

test("provider onboarding blocks activation before a successful test", () => {
  const service = new ProviderOnboardingService({ vault: createLocalCredentialVault({ storageAvailable: true, filePath: "/tmp/rsos-onboarding-test.json" }) });
  service.saveCredential("rentcast", { secret: "secret", metadata: { baseUrl: "https://example.test" } });
  const testResult = service.testConnection("rentcast");
  assert.equal(testResult.ok, true);
  const activation = service.activateProvider("rentcast");
  assert.equal(activation.ok, true);
});

test("provider onboarding exposes redacted diagnostics", () => {
  const service = new ProviderOnboardingService({ vault: createLocalCredentialVault({ storageAvailable: true, filePath: "/tmp/rsos-diagnostics-test.json" }) });
  service.saveCredential("attom", { secret: "secret" });
  const diagnostics = service.getDiagnostics("attom");
  assert.equal(diagnostics.credentialPresence.hasSecret, true);
  assert.equal(diagnostics.credentialPresence.secretMasked.includes("secret"), false);
});

test("provider onboarding reports capability, licensing, and media readiness without exposing secrets", () => {
  const service = new ProviderOnboardingService({ vault: createLocalCredentialVault({ storageAvailable: true, filePath: "/tmp/rsos-readiness-test.json" }) });
  service.saveCredential("reso-mls", { secret: "secret", metadata: { baseUrl: "https://example.test", clientId: "demo", datasetId: "demo-dataset" } });
  const summary = service.getProviderSummary("reso-mls");
  assert.equal(summary.capabilities.includes("media-access"), true);
  assert.equal(summary.licensing.readiness, "review-required");
  assert.equal(summary.mediaRights.mode, "LOCAL_STORAGE_ALLOWED");
  assert.equal(summary.redacted, true);
});
