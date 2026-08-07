import test from "node:test";
import assert from "node:assert/strict";

import {
  DEAL_STATUS_OPTIONS,
  buildStatusOptionsWithCurrent,
  getDealPipelineStageOptions,
  getDealWorkflowProgress,
  resolveDealStatusValue,
} from "./dealWorkflowRegistry.js";

test("status registry includes controlled workflow statuses", () => {
  assert.ok(DEAL_STATUS_OPTIONS.includes("Lead"));
  assert.ok(DEAL_STATUS_OPTIONS.includes("Under Contract"));
  assert.ok(DEAL_STATUS_OPTIONS.includes("Archived"));
});

test("legacy status values map safely without mutating unknown statuses", () => {
  assert.equal(resolveDealStatusValue("active"), "Lead");
  assert.equal(resolveDealStatusValue("pending"), "Decision Pending");
  assert.equal(resolveDealStatusValue("Custom Legacy Status"), "Custom Legacy Status");
});

test("status options include current custom value so existing records are preserved", () => {
  const options = buildStatusOptionsWithCurrent("Active");
  assert.ok(options.includes("Active"));
  assert.ok(options.includes("Lead"));
});

test("pipeline progress function is shared and deterministic", () => {
  const stages = getDealPipelineStageOptions();
  assert.ok(stages.length >= 15);
  assert.equal(getDealWorkflowProgress(stages[0]) > 0, true);
  assert.equal(getDealWorkflowProgress(stages[stages.length - 1]), 100);
});
