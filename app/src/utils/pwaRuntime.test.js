import test from "node:test";
import assert from "node:assert/strict";
import {
  getActionTextFromEvent,
  getRequestCacheStrategy,
  isIosLikeUserAgent,
  shouldBlockOfflineMutation,
  shouldShowInstallAction,
  shouldShowIosInstallInstructions,
} from "./pwaRuntime.js";

test("PWA runtime install action rules", () => {
  assert.equal(shouldShowInstallAction({ isStandalone: true, hasDeferredPrompt: true }), false);
  assert.equal(shouldShowInstallAction({ isStandalone: false, hasDeferredPrompt: true }), true);
  assert.equal(
    shouldShowInstallAction({
      isStandalone: false,
      hasDeferredPrompt: false,
      userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)",
    }),
    true,
  );
});

test("PWA runtime iOS instruction gating", () => {
  assert.equal(isIosLikeUserAgent("Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X)"), true);
  assert.equal(
    shouldShowIosInstallInstructions({
      isStandalone: false,
      hasDeferredPrompt: false,
      userAgent: "Mozilla/5.0 (Linux; Android 14)",
    }),
    false,
  );
  assert.equal(
    shouldShowIosInstallInstructions({
      isStandalone: false,
      hasDeferredPrompt: false,
      userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)",
    }),
    true,
  );
});

test("Offline mutation blocking catches save/delete/import/export actions", () => {
  assert.equal(shouldBlockOfflineMutation({ isOnline: false, actionText: "Save Deal" }), true);
  assert.equal(shouldBlockOfflineMutation({ isOnline: false, actionText: "Delete" }), true);
  assert.equal(shouldBlockOfflineMutation({ isOnline: false, actionText: "Export Summary" }), true);
  assert.equal(shouldBlockOfflineMutation({ isOnline: false, actionText: "View" }), false);
  assert.equal(shouldBlockOfflineMutation({ isOnline: true, actionText: "Save" }), false);
});

test("Cache strategy enforces network-first for API and SWR for static", () => {
  assert.equal(getRequestCacheStrategy({ url: "/api/deals", method: "GET" }), "network-first-no-persist");
  assert.equal(getRequestCacheStrategy({ url: "/api/deals", method: "POST" }), "network-only");
  assert.equal(getRequestCacheStrategy({ url: "/assets/index.js", method: "GET" }), "stale-while-revalidate-static");
});

test("Action text extraction prefers accessibility labels then text", () => {
  const event = {
    target: {
      closest: () => ({
        getAttribute: (name) => (name === "aria-label" ? "Save Deal" : null),
        textContent: "Save",
      }),
    },
  };
  assert.equal(getActionTextFromEvent(event), "Save Deal");
});
