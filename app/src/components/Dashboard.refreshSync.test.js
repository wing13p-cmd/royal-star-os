import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const source = fs.readFileSync(path.join(__dirname, "Dashboard.jsx"), "utf8");

test("Dashboard refreshes from synchronized save events without browser restart", () => {
  assert.equal(source.includes('window.addEventListener("royalStarDealsUpdated", refresh)'), true);
  assert.equal(source.includes('window.addEventListener("royalStarPropertiesUpdated", refresh)'), true);
  assert.equal(source.includes('window.addEventListener("royalStarDataSynchronized", refresh)'), true);
});
