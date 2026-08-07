const PROVIDER_SCHEMAS = {
  manual: {
    provider: "manual",
    displayName: "Manual",
    capabilities: ["manual-entry"],
    requiredSecrets: [],
    requiredNonSecrets: [],
    licensingConfirmationRequired: false,
    mediaRights: ["REMOTE_REFERENCE_ONLY"],
    exportRights: ["NONE"],
    attributionRequirements: ["manual-entry-only"],
  },
  rentcast: {
    provider: "rentcast",
    displayName: "RentCast",
    capabilities: ["subject-property", "sold-comp-search", "active-listing-search"],
    requiredSecrets: ["apiKey"],
    requiredNonSecrets: ["baseUrl"],
    licensingConfirmationRequired: true,
    mediaRights: ["REMOTE_REFERENCE_ONLY"],
    exportRights: ["REVIEW_ONLY"],
    attributionRequirements: ["display-attribution-required"],
  },
  attom: {
    provider: "attom",
    displayName: "ATTOM",
    capabilities: ["subject-property", "sold-comp-search"],
    requiredSecrets: ["apiKey"],
    requiredNonSecrets: ["baseUrl", "datasetCapabilities"],
    licensingConfirmationRequired: true,
    mediaRights: ["REMOTE_REFERENCE_ONLY"],
    exportRights: ["REVIEW_ONLY"],
    attributionRequirements: ["display-attribution-required"],
  },
  "reso-mls": {
    provider: "reso-mls",
    displayName: "RESO MLS",
    capabilities: ["subject-property", "sold-comp-search", "media-access"],
    requiredSecrets: ["clientSecret", "accessToken"],
    requiredNonSecrets: ["baseUrl", "datasetId", "clientId", "originatingSystem", "mediaStorageRights", "mediaExportRights"],
    licensingConfirmationRequired: true,
    mediaRights: ["REMOTE_REFERENCE_ONLY", "LOCAL_STORAGE_ALLOWED"],
    exportRights: ["REVIEW_ONLY"],
    attributionRequirements: ["mls-display-attribution-required"],
  },
  bridge: {
    provider: "bridge",
    displayName: "Bridge RESO",
    capabilities: ["subject-property", "sold-comp-search", "media-access"],
    requiredSecrets: ["accessToken"],
    requiredNonSecrets: ["baseUrl", "datasetId", "originatingSystem", "mediaStorageRights", "mediaExportRights"],
    licensingConfirmationRequired: true,
    mediaRights: ["REMOTE_REFERENCE_ONLY", "LOCAL_STORAGE_ALLOWED"],
    exportRights: ["REVIEW_ONLY"],
    attributionRequirements: ["display-attribution-required"],
  },
  "county-import": {
    provider: "county-import",
    displayName: "County Import",
    capabilities: ["sold-comp-search", "file-import"],
    requiredSecrets: [],
    requiredNonSecrets: ["jurisdiction", "importFormat", "sourceDescription"],
    licensingConfirmationRequired: false,
    mediaRights: ["REMOTE_REFERENCE_ONLY"],
    exportRights: ["REVIEW_ONLY"],
    attributionRequirements: ["source-attribution-required"],
  },
  generic: {
    provider: "generic",
    displayName: "Generic Authorized Provider",
    capabilities: ["subject-property", "sold-comp-search"],
    requiredSecrets: ["credentialFields"],
    requiredNonSecrets: ["baseUrl", "providerName", "authenticationType", "licensingNotes"],
    licensingConfirmationRequired: true,
    mediaRights: ["REMOTE_REFERENCE_ONLY", "THUMBNAIL_CACHE_ONLY"],
    exportRights: ["REVIEW_ONLY"],
    attributionRequirements: ["documented-attribution-required"],
  },
};

function getProviderSchema(provider = "manual") {
  return PROVIDER_SCHEMAS[provider] || PROVIDER_SCHEMAS.manual;
}

function listProviderSchemas() {
  return Object.values(PROVIDER_SCHEMAS);
}

export { PROVIDER_SCHEMAS, getProviderSchema, listProviderSchemas };
export default PROVIDER_SCHEMAS;
