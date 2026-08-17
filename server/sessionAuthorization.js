export function getSessionIdFromRequest(req = {}) {
  return String(req.headers?.["x-session-id"] || req.headers?.["x-rsos-session-id"] || "").trim();
}

export function getRequestIpAddress(req = {}) {
  return String(req.headers?.["x-forwarded-for"] || "").split(",")[0].trim()
    || String(req.headers?.["x-real-ip"] || "").trim()
    || req.socket?.remoteAddress
    || "unknown";
}

export async function populateRequestUserFromSession(req = {}, verifySessionImpl) {
  const sessionId = getSessionIdFromRequest(req);
  if (!sessionId || typeof verifySessionImpl !== "function") return null;

  const session = await verifySessionImpl(sessionId, getRequestIpAddress(req));
  if (!session) return null;

  const roles = Array.isArray(session.roles) ? [...session.roles] : [];
  req.user = {
    id: session.userId || session.id || "",
    username: session.username || "",
    displayName: session.displayName || "",
    roles,
    isAdmin: Boolean(session.isAdmin || roles.includes("System Administrator") || roles.includes("admin")),
  };
  return req.user;
}
