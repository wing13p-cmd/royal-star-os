import test from 'node:test';
import assert from 'node:assert/strict';
import { buildFlipScenarioSet } from './flipScenarioModel.js';

test('flip scenarios preserve best >= base >= worst ordering for positive deals', () => {
  const result = buildFlipScenarioSet({
    purchasePrice: 135000,
    rehabBudget: 60000,
    arv: 300000,
    financingCosts: 8000,
    closingCosts: 3500,
    taxes: 2800,
    insurance: 1200,
    holdingMonths: 4,
    monthlyHoldingCost: 1500,
    sellingCostPercent: 8,
    contingencyPercent: 10,
    additionalCosts: 0,
  });

  assert.equal(result.missingCoreInputs.length, 0);
  assert.ok(result.best.netProfit >= result.base.netProfit);
  assert.ok(result.base.netProfit >= result.worst.netProfit);
  assert.ok(result.best.roi >= result.base.roi);
  assert.ok(result.base.roi >= result.worst.roi);
  assert.ok(result.best.profitMargin >= result.base.profitMargin);
  assert.ok(result.base.profitMargin >= result.worst.profitMargin);
});

test('flip scenarios are independently calculated and not copied/scaled from one value', () => {
  const result = buildFlipScenarioSet({
    purchasePrice: 150000,
    rehabBudget: 50000,
    arv: 320000,
    financingCosts: 10000,
    closingCosts: 5000,
    taxes: 3000,
    insurance: 1500,
    holdingMonths: 5,
    monthlyHoldingCost: 1700,
    sellingCostPercent: 8,
    contingencyPercent: 10,
    additionalCosts: 2000,
  });

  assert.notEqual(result.best.netProfit, result.base.netProfit);
  assert.notEqual(result.worst.netProfit, result.base.netProfit);
  assert.notEqual(result.best.roi, result.base.roi);
  assert.notEqual(result.worst.roi, result.base.roi);
});

test('flip scenario model blocks recommendations when core financial inputs are missing', () => {
  const result = buildFlipScenarioSet({
    purchasePrice: 135000,
    rehabBudget: '',
    arv: 300000,
    sellingCostPercent: 8,
    contingencyPercent: 10,
  });

  assert.ok(result.missingCoreInputs.includes('Rehab Budget'));
  assert.equal(result.base.netProfit, null);
  assert.equal(result.best.roi, null);
  assert.equal(result.worst.profitMargin, null);
});
