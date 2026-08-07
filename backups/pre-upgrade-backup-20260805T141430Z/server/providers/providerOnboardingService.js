import { createLocalCredentialVault } from "./credentialVault.js";
import { getProviderSchema } from "./providerSchemas.js";

function normalizeText(value) {
  return value === undefined || value === null ? "" : String(value).trim();
}

function createProviderState(provider = "manual") {
  return {
    provider: normalizeText(provider).toLowerCase(),
    configured: false,
    active: false,
    connectionStatus: "Not Configured",
    lastTestedAt: "",
    lastSuccessfulRequestAt: "",
    lastFailureAt: "",
    licensingStatus: "Not Recorded",
    mediaRightsStatus: "RIGHTS_UNKNOWN_REVIEW_REQUIRED",
    exportRightsStatus: "REVIEW_ONLY",
    capabilitySnapshot: [],
    configurationVersion: 1,
    rateLimit: {
      requestsThisSession: 0,
      successfulRequests: 0,
      failedRequests: 0,
      cachedResponses: 0,
      estimatedRemainingQuota: null,
      lastRateLimitResponse: "",
      retryAfterSeconds: null,
      averageLatencyMs: 0,
      lastSuccessfulRequest: "",
      lastFailure: "",
    },
    diagnostics: {
      providerErrors: [],
      searchHistory: [],
      auditReferences: [],
    },
  };
}

class ProviderOnboardingService {
  constructor(options = {}) {
    this.vault = options.vault || createLocalCredentialVault(options);
    this.providers = new Map();
  }

  initProvider(provider = "manual") {
    const normalized = normalizeText(provider).toLowerCase();
    if (!this.providers.has(normalized)) this.providers.set(normalized, createProviderState(normalized));
    return this.providers.get(normalized);
  }

  getProviderState(provider = "manual") {
    return this.initProvider(provider);
  }

  saveCredential(provider, values = {}) {
    const record = this.getProviderState(provider);
    const payload = {
      configured: true,
      status: "Configuration Ready",
      lastTestedAt: normalizeText(values.lastTestedAt || record.lastTestedAt),
      rotationDueAt: normalizeText(values.rotationDueAt || ""),
      requiresReEntry: Boolean(values.requiresReEntry),
      metadata: {
        ...(values.metadata || {}),
        ...(values.secret ? { [values.secretField || "apiKey"]: values.secret } : {}),
      },
      secret: values.secret || "",
      secretField: values.secretField || "apiKey",
    };
    return this.vault.upsertCredential(provider, payload);
  }

  removeCredential(provider) {
    return this.vault.removeCredential(provider);
  }

  getMaskedCredentialStatus(provider) {
    return this.vault.maskStatus(provider);
  }

  getSchema(provider = "manual") {
    return getProviderSchema(provider);
  }

  testConnection(provider = "manual") {
    const state = this.initProvider(provider);
    state.connectionStatus = "Testing";
    const schema = this.getSchema(provider);
    const configValidation = this.vault.validateProviderConfig(provider, schema);
    if (!configValidation.complete) {
      state.connectionStatus = "Configuration Incomplete";
      return { ok: false, provider, status: state.connectionStatus, missing: configValidation.missing };
    }
    state.connectionStatus = "Connected";
    state.lastTestedAt = new Date().toISOString();
    state.capabilitySnapshot = schema.capabilities;
    state.licensingStatus = schema.licensingConfirmationRequired ? "Licensing Review Required" : "Confirmed";
    state.mediaRightsStatus = schema.mediaRights.includes("LOCAL_STORAGE_ALLOWED") ? "LOCAL_STORAGE_ALLOWED" : "REMOTE_REFERENCE_ONLY";
    return { ok: true, provider, status: state.connectionStatus, capabilities: schema.capabilities };
  }

  activateProvider(provider = "manual", admin = "System Administrator") {
    const state = this.getProviderState(provider);
    const schema = this.getSchema(provider);
    const configValidation = this.vault.validateProviderConfig(provider, schema);
    if (!configValidation.complete || state.connectionStatus !== "Connected") {
      state.connectionStatus = "Configuration Incomplete";
      state.active = false;
      return { ok: false, provider, status: "Activation Blocked", reason: "requires-successful-test" };
    }
    state.active = true;
    state.connectionStatus = "Connected";
    state.licensingStatus = schema.licensingConfirmationRequired ? "Licensing Review Required" : "Confirmed";
    state.mediaRightsStatus = schema.mediaRights.includes("LOCAL_STORAGE_ALLOWED") ? "LOCAL_STORAGE_ALLOWED" : "REMOTE_REFERENCE_ONLY";
    state.diagnostics.auditReferences.push(`activated:${provider}:${admin}`);
    return { ok: true, provider, status: "Activated", admin };
  }

  deactivateProvider(provider = "manual") {
    const state = this.getProviderState(provider);
    state.active = false;
    state.connectionStatus = "Not Configured";
    return { ok: true, provider, status: "Deactivated" };
  }

  rotateCredential(provider, values = {}) {
    const state = this.getProviderState(provider);
    const previous = this.vault.getProviderRecord(provider);
    const result = this.saveCredential(provider, { ...values, requiresReEntry: true });
    state.lastTestedAt = "";
    state.connectionStatus = "Configuration Incomplete";
    state.active = false;
    state.diagnostics.auditReferences.push(`rotated:${provider}:${previous?.provider || provider}`);
    return { ok: result.ok, provider, status: result.ok ? "Rotated" : "Rotation Failed" };
  }

  getProviderSummary(provider = "manual") {
    const state = this.getProviderState(provider);
    const schema = this.getSchema(provider);
    const masked = this.getMaskedCredentialStatus(provider);
    const licensing = {
      readiness: schema.licensingConfirmationRequired ? "review-required" : "ready",
      confirmationRequired: Boolean(schema.licensingConfirmationRequired),
      status: state.licensingStatus,
    };
    const mediaRights = {
      mode: schema.mediaRights.includes("LOCAL_STORAGE_ALLOWED") ? "LOCAL_STORAGE_ALLOWED" : "REMOTE_REFERENCE_ONLY",
      requiresReview: true,
      exportAllowed: schema.exportRights.includes("REVIEW_ONLY"),
    };
    return {
      provider: normalizeText(provider).toLowerCase(),
      active: state.active,
      capabilities: schema.capabilities,
      licensing,
      mediaRights,
      redacted: Boolean(masked.secretMasked) && !masked.secretMasked.includes("secret"),
      credentialPresence: masked,
      diagnostics: state.diagnostics,
    };
  }

  getDiagnostics(provider = "manual") {
    const state = this.getProviderState(provider);
    return {
      provider,
      connectionStatus: state.connectionStatus,
      active: state.active,
      licensingStatus: state.licensingStatus,
      mediaRightsStatus: state.mediaRightsStatus,
      exportRightsStatus: state.exportRightsStatus,
      credentialPresence: this.getMaskedCredentialStatus(provider),
      rateLimit: state.rateLimit,
      diagnostics: state.diagnostics,
      capabilitySnapshot: state.capabilitySnapshot,
    };
  }
}

function createProviderOnboardingService(options = {}) {
  return new ProviderOnboardingService(options);
}

export { ProviderOnboardingService, createProviderOnboardingService };
export default createProviderOnboardingService;
