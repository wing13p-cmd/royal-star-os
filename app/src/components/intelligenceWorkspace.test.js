import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { isKnownViewKey } from "../utils/navigationModel.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const source = fs.readFileSync(path.join(here, "IntelligenceWorkspace.jsx"), "utf8");

test("enterprise workspace routes are canonical and production reachable", () => {
  for (const key of ["knowledgeBase", "enterpriseSearch", "forecastingCenter", "reportingCenter", "documentAutomation", "aiCommandCenter"]) {
    assert.equal(isKnownViewKey(key), true, `${key} must be a canonical route`);
    assert.match(source, new RegExp(key));
  }
});

test("enterprise workspace remains advisory and exports review copies only", () => {
  assert.match(source, /Advisory only/);
  assert.match(source, /Approval required for changes/);
  assert.match(source, /DOWNLOAD REVIEW COPY/);
  assert.match(source, /GENERATE DRAFT PACKAGE/);
  assert.doesNotMatch(source, /fetch\([^)]*,\s*\{[^}]*method:\s*["'](?:POST|PUT|PATCH|DELETE)/s);
});

test("AI command center discloses deterministic non-transactional behavior", () => {
  assert.match(source, /deterministic advisory engines/);
  assert.match(source, /does not execute transactions/);
  assert.match(source, /does not execute transactions or send data to an external AI model/);
});
