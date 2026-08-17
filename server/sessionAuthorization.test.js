import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getRequestContext, hasPermission } from "./security.js";
import {
  getSessionIdFromRequest,
  populateRequestUserFromSession,
} from "./sessionAuthorization.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const serverSource = fs.readFileSync(path.join(__dirname, "index.js"), "utf8");

function remoteRequest(method, sessionId = "") {
  return {
    method,
    headers: {
      host: "royal-star-os-production.up.railway.app",
      ...(sessionId ? { "x-rsos-session-id": sessionId } : {}),
    },
    socket: { remoteAddress: "203.0.113.10" },
  };
}

const validAdminSession = {
  id: "session-admin",
  userId: "admin-brandon",
  username: "brandon@example.com",
  displayName: "Brandon Sterling",
  roles: ["System Administrator"],
  isAdmin: true,
};

for (const method of ["POST", "PUT", "DELETE"]) {
  test(`valid authenticated administrator can authorize ${method} deal mutation`, async () => {
    const req = remoteRequest(method, "session-admin");
    await populateRequestUserFromSession(req, async () => validAdminSession);
    const context = getRequestContext(req);
    assert.equal(context.userId, "admin-brandon");
    assert.deepEqual(context.roles, ["System Administrator"]);
    assert.equal(context.isAdmin, true);
    assert.equal(hasPermission(context, method === "DELETE" ? "delete" : "write"), true);
  });

  test(`missing session denies ${method} deal mutation`, async () => {
    const req = remoteRequest(method);
    await populateRequestUserFromSession(req, async () => validAdminSession);
    const context = getRequestContext(req);
    assert.equal(context.userId, "anonymous");
    assert.equal(hasPermission(context, method === "DELETE" ? "delete" : "write"), false);
  });

  test(`invalid session denies ${method} deal mutation`, async () => {
    const req = remoteRequest(method, "invalid-session");
    await populateRequestUserFromSession(req, async () => null);
    const context = getRequestContext(req);
    assert.equal(context.isAdmin, false);
    assert.equal(hasPermission(context, method === "DELETE" ? "delete" : "write"), false);
  });
}

test("expired session cannot populate request identity or mutate resources", async () => {
  const req = remoteRequest("POST", "expired-session");
  const result = await populateRequestUserFromSession(req, async () => null);
  assert.equal(result, null);
  assert.equal(req.user, undefined);
  assert.equal(hasPermission(getRequestContext(req), "write"), false);
});

test("session identity is resolved before the existing authorization context", () => {
  const populateIndex = serverSource.indexOf("await populateRequestUserFromSession(req, verifySession)");
  const contextIndex = serverSource.indexOf("createRequestContext(req, res)", populateIndex);
  assert.ok(populateIndex > 0);
  assert.ok(contextIndex > populateIndex);
});

test("CORS preserves existing headers and allows both session headers", () => {
  const corsLine = serverSource.match(/Access-Control-Allow-Headers[^\n]+/)?.[0] || "";
  for (const header of [
    "Content-Type",
    "Authorization",
    "X-RSOS-Operator-Token",
    "X-RSOS-Admin-Token",
    "X-RSOS-Session-ID",
    "X-Session-ID",
  ]) assert.equal(corsLine.includes(header), true);
});

test("anonymous collection GET behavior remains unchanged", () => {
  assert.equal(serverSource.includes('if (req.method === "GET" && !itemId)'), true);
  assert.equal(serverSource.includes('if (req.method === "GET" && itemId)'), true);
});

test("both supported request headers resolve the session ID", () => {
  assert.equal(getSessionIdFromRequest({ headers: { "x-rsos-session-id": "primary" } }), "primary");
  assert.equal(getSessionIdFromRequest({ headers: { "x-session-id": "legacy" } }), "legacy");
});

test("deal persistence accepts existing explicit total and monthly holding-cost fields", () => {
  assert.equal(serverSource.includes("holdingCosts: getNumberValue(payload.totalHoldingCosts ?? payload.holdingCosts ?? payload.holdingCost)"), true);
  assert.equal(serverSource.includes("monthlyHoldingCost: getNumberValue(payload.monthlyHoldingCost)"), true);
  assert.equal(serverSource.includes('errors.push("holdingCosts cannot be negative")'), true);
});
