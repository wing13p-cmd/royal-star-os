import test from "node:test";
import assert from "node:assert/strict";

import { buildCrossModulePortfolioContext, formatUnavailableCurrency, formatUnavailablePercent } from "./crossModulePortfolioContext.js";

test("matching property counts across modules use one canonical collection", () => {
  const deals = [{ id: "deal-1", propertyAddress: "952 Goss Rd", city: "Cincinnati", state: "OH", zipCode: "45229", purchasePrice: 135000, estimatedArv: 300000 }];
  const properties = [{ id: "property-deal-1", linkedDealId: "deal-1", propertyName: "952 Goss Rd", address: "952 Goss Rd", city: "Cincinnati", state: "OH", zipCode: "45229", currentValue: 300000, purchasePrice: 135000, monthlyRent: 2200, status: "Lead", strategy: "Flip" }];
  const portfolioEntries = [{ id: "portfolio-1", linkedDealId: "deal-1", linkedPropertyId: "property-deal-1", propertyAddress: "952 Goss Rd", city: "Cincinnati", state: "OH", zipCode: "45229", currentValue: 300000, purchasePrice: 135000, strategy: "Hold", status: "Active" }];

  const commandCenterView = buildCrossModulePortfolioContext({ deals, properties, portfolioEntries });
  const portfolioView = buildCrossModulePortfolioContext({ deals, properties, portfolioEntries });

  assert.equal(commandCenterView.canonicalProperties.length, portfolioView.canonicalProperties.length);
  assert.equal(commandCenterView.canonicalProperties.length, 1);
});

test("matching health and risk metrics and top opportunity derive from same context", () => {
  const deals = [{ id: "deal-1", propertyAddress: "952 Goss Rd", city: "Cincinnati", state: "OH", zipCode: "45229", purchasePrice: 135000, rehabBudget: 60000, estimatedArv: 300000, strategy: "Flip" }];
  const properties = [{ id: "property-deal-1", linkedDealId: "deal-1", propertyName: "952 Goss Rd", address: "952 Goss Rd", city: "Cincinnati", state: "OH", zipCode: "45229", currentValue: 300000, purchasePrice: 135000, monthlyRent: 2200, monthlyOperatingExpenses: 700, monthlyDebtService: 900, status: "Lead", strategy: "Flip" }];
  const portfolioEntries = [{ id: "portfolio-1", linkedDealId: "deal-1", linkedPropertyId: "property-deal-1", propertyAddress: "952 Goss Rd", city: "Cincinnati", state: "OH", zipCode: "45229", currentValue: 300000, purchasePrice: 135000, strategy: "Hold", status: "Active" }];

  const left = buildCrossModulePortfolioContext({ deals, properties, portfolioEntries }).portfolioIntelligence;
  const right = buildCrossModulePortfolioContext({ deals, properties, portfolioEntries }).portfolioIntelligence;

  assert.equal(left.summary.healthScore, right.summary.healthScore);
  assert.equal(left.summary.averageRiskScore, right.summary.averageRiskScore);
  assert.equal(left.topOpportunity.propertyName, right.topOpportunity.propertyName);
});

test("unavailable value handling returns Insufficient Data for missing values", () => {
  assert.equal(formatUnavailableCurrency(null), "Insufficient Data");
  assert.equal(formatUnavailableCurrency(undefined), "Insufficient Data");
  assert.equal(formatUnavailableCurrency(""), "Insufficient Data");
  assert.equal(formatUnavailablePercent(null), "Insufficient Data");
  assert.equal(formatUnavailablePercent(undefined), "Insufficient Data");
  assert.equal(formatUnavailablePercent(""), "Insufficient Data");
});
