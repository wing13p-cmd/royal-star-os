const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

export function validatePhotoUpload(file) {
  if (!file) {
    return { ok: false, error: "Select a photo file first." };
  }

  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    return { ok: false, error: "Only JPG, PNG, WEBP, or GIF files are allowed." };
  }

  if (file.size > MAX_UPLOAD_BYTES) {
    return { ok: false, error: "Photo size must be 5 MB or smaller." };
  }

  return { ok: true, error: "" };
}

export function appendMediaAuditEntry(comp = {}, entry = {}) {
  const history = Array.isArray(comp.auditHistory) ? comp.auditHistory : [];
  return [
    ...history,
    {
      id: entry.id || `audit-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
      action: entry.action || "photo-upload",
      createdAt: entry.createdAt || new Date().toISOString(),
      summary: entry.summary || "User uploaded a review-only photo.",
      source: entry.source || "user",
      rightsMode: entry.rightsMode || "REMOTE_REFERENCE_ONLY",
      approvedForExport: Boolean(entry.approvedForExport === true),
    },
  ];
}

export function filterExportPermittedMedia(media = []) {
  return (Array.isArray(media) ? media : []).filter((item) => {
    if (!item || item.isRestricted || item.isExpired) return false;
    if (item.rightsMode === "DISPLAY_PROHIBITED") return false;
    return Boolean(item.includeInAppraiserPacket);
  });
}

export { MAX_UPLOAD_BYTES, ALLOWED_IMAGE_TYPES };
