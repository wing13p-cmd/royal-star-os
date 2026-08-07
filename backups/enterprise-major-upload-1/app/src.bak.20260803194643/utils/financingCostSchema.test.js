import test from "node:test";
import assert from "node:assert/strict";
import { buildFinancingCostState, getDisplayedFinancingCostValue } from "./financingCostSchema.js";

test("preserves a manual financing-cost override", () => {
  const state = buildFinancingCostState({ financingCosts: "1250" }, { financingCosts: 5000 });

  assert.equal(state.rawFinancingCostInput, 1250);
  assert.equal(state.calculatedFinancingCosts, 5000);
  assert.equal(state.effectiveFinancingCosts, 1250);
  assert.equal(state.financingCostSource, "manual-override");
});

test("uses calculated financing costs when the manual input is blank", () => {
  const state = buildFinancingCostState({ financingCosts: "" }, { financingCosts: 5000 });

  assert.equal(state.rawFinancingCostInput, 0);
  assert.equal(state.calculatedFinancingCosts, 5000);
  assert.equal(state.effectiveFinancingCosts, 5000);
  assert.equal(state.financingCostSource, "calculated");
});

test("uses calculated financing costs when the manual input is zero", () => {
  const state = buildFinancingCostState({ financingCosts: "0" }, { financingCosts: 5000 });

  assert.equal(state.rawFinancingCostInput, 0);
  assert.equal(state.calculatedFinancingCosts, 5000);
  assert.equal(state.effectiveFinancingCosts, 5000);
  assert.equal(state.financingCostSource, "calculated");
});

test("hydrates legacy Goss financing-cost data from the calculated underwriting path", () => {
  const state = buildFinancingCostState({ financingCosts: 0 }, { financingCosts: 81975.568 });

  assert.equal(state.rawFinancingCostInput, 0);
  assert.equal(state.calculatedFinancingCosts, 81975.568);
  assert.equal(state.effectiveFinancingCosts, 81975.568);
  assert.equal(state.financingCostSource, "calculated");
});

test("displays the effective financing cost when the record uses the calculated source", () => {
  const state = buildFinancingCostState({ financingCosts: 0 }, { financingCosts: 81975.568 });

  assert.equal(getDisplayedFinancingCostValue(0, state), 81975.568);
});

test("displays a manual financing override when one exists", () => {
  const state = buildFinancingCostState({ financingCosts: "1250" }, { financingCosts: 5000 });

  assert.equal(getDisplayedFinancingCostValue("1250", state), 1250);
});
