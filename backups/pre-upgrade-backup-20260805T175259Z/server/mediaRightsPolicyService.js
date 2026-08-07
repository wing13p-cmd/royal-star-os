const MEDIA_MODES = {
  LOCAL_STORAGE_ALLOWED: "LOCAL_STORAGE_ALLOWED",
  THUMBNAIL_CACHE_ONLY: "THUMBNAIL_CACHE_ONLY",
  REMOTE_REFERENCE_ONLY: "REMOTE_REFERENCE_ONLY",
  DISPLAY_PROHIBITED: "DISPLAY_PROHIBITED",
  RIGHTS_UNKNOWN_REVIEW_REQUIRED: "RIGHTS_UNKNOWN_REVIEW_REQUIRED",
};

class MediaRightsPolicyService {
  evaluateMediaRights(options = {}) {
    const provider = String(options.provider || "manual").toLowerCase();
    const hasLocalStoragePermission = Boolean(options.localStorageAllowed);
    const policy = {
      mode: MEDIA_MODES.REMOTE_REFERENCE_ONLY,
      localStorageAllowed: false,
      thumbnailCachingAllowed: false,
      attributionRequired: true,
      retentionDays: 0,
      exportAllowed: false,
      allowedTypes: ["photo"],
      requiresReview: true,
      provider,
    };

    if (provider === "rentcast") {
      policy.mode = MEDIA_MODES.REMOTE_REFERENCE_ONLY;
      policy.localStorageAllowed = false;
      policy.thumbnailCachingAllowed = false;
      policy.attributionRequired = true;
      policy.exportAllowed = false;
      policy.requiresReview = true;
    }

    if (provider === "attom") {
      policy.mode = MEDIA_MODES.REMOTE_REFERENCE_ONLY;
      policy.localStorageAllowed = false;
      policy.thumbnailCachingAllowed = false;
      policy.attributionRequired = true;
      policy.exportAllowed = false;
      policy.requiresReview = true;
    }

    if (hasLocalStoragePermission) {
      policy.localStorageAllowed = true;
      policy.mode = MEDIA_MODES.LOCAL_STORAGE_ALLOWED;
    }

    return policy;
  }

  buildCanonicalMediaRecord(options = {}) {
    const policy = this.evaluateMediaRights(options);
    const mediaUrl = String(options.url || "").trim();
    const normalized = {
      id: options.id || `media-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
      provider: String(options.provider || "manual").toLowerCase(),
      providerRecordId: options.providerRecordId || "",
      sourceType: options.sourceType || "manual",
      label: options.label || "Photo",
      url: mediaUrl,
      thumbnailUrl: options.thumbnailUrl || mediaUrl,
      rightsMode: policy.mode,
      localStorageAllowed: policy.localStorageAllowed,
      thumbnailCachingAllowed: policy.thumbnailCachingAllowed,
      attributionRequired: policy.attributionRequired,
      requiresReview: policy.requiresReview,
      retainUntil: options.retainUntil || "",
      checksum: options.checksum || "",
      isExpired: Boolean(options.isExpired),
      isRestricted: Boolean(options.isRestricted),
      includeInAppraiserPacket: false,
      source: options.source || "",
      notes: options.notes || "",
      createdAt: options.createdAt || new Date().toISOString(),
      updatedAt: options.updatedAt || new Date().toISOString(),
    };

    if (normalized.url && !normalized.url.startsWith("http")) {
      normalized.url = "";
    }

    return normalized;
  }
}

export { MediaRightsPolicyService, MEDIA_MODES };
export default MediaRightsPolicyService;
