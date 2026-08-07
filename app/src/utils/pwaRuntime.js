const MUTATION_KEYWORDS = [
  "save",
  "delete",
  "edit",
  "import",
  "export",
  "compare",
  "submit",
  "update",
];

export function isStandaloneDisplayMode(currentWindow = window) {
  if (!currentWindow || typeof currentWindow.matchMedia !== "function") return false;
  const byMediaQuery = currentWindow.matchMedia("(display-mode: standalone)").matches;
  const byNavigator = Boolean(currentWindow.navigator?.standalone);
  return byMediaQuery || byNavigator;
}

export function isIosLikeUserAgent(userAgent = "") {
  return /iPad|iPhone|iPod/i.test(String(userAgent));
}

export function shouldShowIosInstallInstructions({
  isStandalone,
  hasDeferredPrompt,
  userAgent,
} = {}) {
  if (isStandalone || hasDeferredPrompt) return false;
  const ua = userAgent || (typeof navigator !== "undefined" ? navigator.userAgent : "");
  return isIosLikeUserAgent(ua);
}

export function shouldShowInstallAction({
  isStandalone,
  hasDeferredPrompt,
  userAgent,
} = {}) {
  if (isStandalone) return false;
  if (hasDeferredPrompt) return true;
  return shouldShowIosInstallInstructions({ isStandalone, hasDeferredPrompt, userAgent });
}

export function shouldBlockOfflineMutation({ isOnline, actionText } = {}) {
  if (isOnline) return false;
  const normalized = String(actionText || "").trim().toLowerCase();
  if (!normalized) return false;
  return MUTATION_KEYWORDS.some((keyword) => normalized.includes(keyword));
}

export function getActionTextFromEvent(event) {
  const target = event?.target;
  if (!target || typeof target.closest !== "function") return "";

  const actionable = target.closest("button, [type='submit'], [role='button'], a");
  if (!actionable) return "";

  return String(
    actionable.getAttribute("aria-label")
      || actionable.getAttribute("title")
      || actionable.textContent
      || "",
  );
}

export function getRequestCacheStrategy({ url, method = "GET" } = {}) {
  const normalizedMethod = String(method).toUpperCase();
  const normalizedUrl = String(url || "");

  if (normalizedUrl.includes("/api/")) {
    return normalizedMethod === "GET" ? "network-first-no-persist" : "network-only";
  }

  if (normalizedMethod !== "GET") {
    return "network-only";
  }

  return "stale-while-revalidate-static";
}
