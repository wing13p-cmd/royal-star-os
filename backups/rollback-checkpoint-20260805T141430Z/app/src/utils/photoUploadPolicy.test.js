import test from "node:test";
import assert from "node:assert/strict";

import { appendMediaAuditEntry, filterExportPermittedMedia, validatePhotoUpload } from "./photoUploadPolicy.js";

test("validatePhotoUpload accepts supported image files within size limits", () => {
  const result = validatePhotoUpload({ name: "photo.jpg", type: "image/jpeg", size: 1024 });
  assert.equal(result.ok, true);
  assert.equal(result.error, "");
});

test("validatePhotoUpload rejects unsupported or oversized file payloads", () => {
  const unsupported = validatePhotoUpload({ name: "photo.pdf", type: "application/pdf", size: 1024 });
  assert.equal(unsupported.ok, false);
  assert.match(unsupported.error, /JPG|PNG|WEBP|GIF/);

  const oversized = validatePhotoUpload({ name: "photo.png", type: "image/png", size: 6 * 1024 * 1024 });
  assert.equal(oversized.ok, false);
  assert.match(oversized.error, /5 MB/);
});

test("appendMediaAuditEntry and export filtering preserve review-only media safety", () => {
  const audit = appendMediaAuditEntry({ auditHistory: [] }, { summary: "Upload pending review" });
  assert.equal(audit.length, 1);
  assert.equal(audit[0].rightsMode, "REMOTE_REFERENCE_ONLY");

  const permitted = filterExportPermittedMedia([
    { includeInAppraiserPacket: true, isRestricted: false, isExpired: false, rightsMode: "REMOTE_REFERENCE_ONLY" },
    { includeInAppraiserPacket: false, isRestricted: false, isExpired: false, rightsMode: "REMOTE_REFERENCE_ONLY" },
  ]);
  assert.equal(permitted.length, 1);
});
