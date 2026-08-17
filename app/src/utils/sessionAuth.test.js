import test from "node:test";
import assert from "node:assert/strict";
import {
  buildSessionAuthHeaders,
  buildSessionHeaders,
  clearStoredSessionIds,
  getStoredSessionId,
  storeSessionId,
} from "./sessionAuth.js";

function createStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem: (key) => values.get(key) || null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
    has: (key) => values.has(key),
  };
}

test("shared session utility preserves all supported storage keys and headers", () => {
  const storage = createStorage();
  storeSessionId("session-admin", storage);
  assert.equal(getStoredSessionId(storage), "session-admin");
  assert.deepEqual(buildSessionAuthHeaders({ "Content-Type": "application/json" }, storage), {
    "Content-Type": "application/json",
    "x-rsos-session-id": "session-admin",
    "x-session-id": "session-admin",
  });
  clearStoredSessionIds(storage);
  assert.equal(getStoredSessionId(storage), "");
});

test("explicit session headers never expose an admin token or credentials", () => {
  const headers = buildSessionHeaders("session-admin");
  assert.deepEqual(headers, {
    "x-rsos-session-id": "session-admin",
    "x-session-id": "session-admin",
  });
  assert.equal("authorization" in headers, false);
  assert.equal("x-rsos-admin-token" in headers, false);
});

test("missing session produces no authentication headers", () => {
  assert.deepEqual(buildSessionAuthHeaders({ Accept: "application/json" }, createStorage()), {
    Accept: "application/json",
  });
});
