import test from "node:test";
import assert from "node:assert/strict";
import { buildPortfolioIntelligence } from "./portfolioIntelligence.js";

test("buildPortfolioIntelligence returns safe defaults for empty input", () => {
  const intel = buildPortfolioIntelligence([], [], [], [], [], [], [], []);
  assert.equal(intel.summary.totalProperties, 0);
  assert.equal(intel.summary.totalCurrentValue, 0);
  assert.equal(intel.summary.portfolioLtv, "Insufficient Data");
  assert.equal(intel.health.score, 0);
  assert.equal(intel.health.status, "Insufficient Data");
  assert.deepEqual(intel.alerts, []);
});

test("buildPortfolioIntelligence flags negative equity and refinance opportunities for a saved property", () => {
  const intel = buildPortfolioIntelligence(
    [
      {
        id: "prop-1",
        propertyName: "Sample House",
        propertyAddress: "123 Main St",
        city: "Austin",
        state: "TX",
        zipCode: "78701",
        purchasePrice: 180000,
        currentValue: 160000,
        currentLoanBalance: 200000,
        monthlyRent: 2400,
        monthlyOperatingExpenses: 700,
        monthlyDebtService: 1400,
        monthlyCashFlow: 300,
        annualCashFlow: 3600,
        annualNetOperatingIncome: 12000,
        projectedProfit: 10000,
        supportedARV: 190000,
        appraisedValue: 170000,
        loanMaturityDate: "2026-09-01",
        riskLevel: "High",
        strategy: "BRRRR",
        status: "Active",
        recommendation: "Refinance Candidate",
      },
    ],
    [{ propertyAddress: "123 Main St", recommendation: "Refinance Candidate" }],
    [],
    [],
    [{ id: "lender-1", name: "Royal Star Capital" }],
    [],
    [],
    [],
  );

  assert.equal(intel.summary.totalProperties, 1);
  assert.equal(intel.summary.totalEquity, -40000);
  assert.equal(intel.summary.portfolioLtv, "125.0%");
  assert.ok(intel.health.score <= 100);
  assert.ok(intel.alerts.some((alert) => alert.severity === "CRITICAL"));
  assert.ok(intel.refinanceOpportunities.length >= 1);
  assert.ok(intel.sellVsHold.length >= 1);
});

test("buildPortfolioIntelligence uses the unified underwriting engine for deal-driven portfolio opportunities", () => {
  const intel = buildPortfolioIntelligence(
    [],
    [{
      id: "deal-1",
      propertyAddress: "500 Market St",
      city: "Covington",
      state: "KY",
      zipCode: "41011",
      purchasePrice: 140000,
      rehabBudget: 35000,
      estimatedArv: 235000,
      estimatedRent: 2400,
      strategy: "Flip",
    }],
    [],
    [],
    [],
    [],
    [],
    [],
  );

  assert.equal(intel.summary.activeDeals, 1);
  assert.ok(intel.summary.totalProjectedFlipProfit >= 0);
  assert.equal(intel.topOpportunity.propertyName, "500 Market St");
  assert.equal(intel.topOpportunity.strategy, "Flip");
});

test("buildPortfolioIntelligence surfaces portfolio-level metrics and alerts", () => {
  const intel = buildPortfolioIntelligence([
    {
      id: "prop-1",
      propertyName: "Flip Asset",
      propertyAddress: "100 Market St",
      city: "Covington",
      state: "KY",
      zipCode: "41011",
      purchasePrice: 140000,
      currentValue: 230000,
      currentLoanBalance: 120000,
      monthlyRent: 2400,
      monthlyOperatingExpenses: 700,
      monthlyDebtService: 1400,
      monthlyCashFlow: 300,
      supportedARV: 250000,
      rehabBudget: 30000,
      actualRehabCost: 28000,
      strategy: "Flip",
      riskLevel: "Moderate",
      recommendation: "Proceed",
    },
    {
      id: "prop-2",
      propertyName: "BRRRR Asset",
      propertyAddress: "200 Market St",
      city: "Covington",
      state: "KY",
      zipCode: "41011",
      purchasePrice: 170000,
      currentValue: 210000,
      currentLoanBalance: 130000,
      monthlyRent: 2600,
      monthlyOperatingExpenses: 900,
      monthlyDebtService: 1200,
      monthlyCashFlow: 500,
      supportedARV: 240000,
      rehabBudget: 40000,
      actualRehabCost: 42000,
      strategy: "BRRRR",
      riskLevel: "High",
      recommendation: "Refinance Candidate",
    },
  ], [], [], [], [], [], [], []);

  assert.ok(intel.summary.totalMarketValue > 0);
  assert.ok(intel.summary.totalEstimatedEquity > 0);
  assert.ok(intel.summary.totalArv > 0);
  assert.ok(intel.summary.totalAcquisitionCost > 0);
  assert.ok(intel.summary.totalRehabCost > 0);
  assert.ok(intel.summary.averageRoi >= 0);
  assert.ok(intel.summary.averageCashOnCashReturn >= 0);
  assert.ok(intel.summary.averageCapRate >= 0);
  assert.ok(intel.summary.averageDealScore >= 0);
  assert.ok(intel.summary.averageOpportunityScore >= 0);
  assert.ok(intel.summary.averageRiskScore >= 0);
  assert.ok(intel.portfolioHighlights.bestFlip.propertyName.length > 0);
  assert.ok(intel.portfolioHighlights.bestBrrrrr.propertyName.length > 0);
  assert.ok(intel.portfolioHighlights.highestRisk.propertyName.length > 0);
  assert.ok(intel.portfolioAlerts.some((alert) => alert.type === "overexposure-zip" || alert.type === "rehab-budget-risk" || alert.type === "liquidity-warning"));
  assert.equal(intel.integrityAudit.status, "PASS");
  assert.equal(intel.integrityAudit.moduleSynchronization.status, "PASS");
  assert.equal(intel.integrityAudit.manualOverrides.status, "PASS");
});

test("buildPortfolioIntelligence generates forecast periods, scenario engines, and confidence scoring", () => {
  const intel = buildPortfolioIntelligence([
    {
      id: "prop-1",
      propertyName: "Forecast Asset",
      propertyAddress: "300 Forecast Ave",
      city: "Covington",
      state: "KY",
      zipCode: "41011",
      purchasePrice: 150000,
      currentValue: 220000,
      currentLoanBalance: 110000,
      monthlyRent: 2800,
      monthlyOperatingExpenses: 800,
      monthlyDebtService: 1500,
      monthlyCashFlow: 500,
      supportedARV: 240000,
      rehabBudget: 25000,
      actualRehabCost: 22000,
      strategy: "BRRRR",
      riskLevel: "Moderate",
      recommendation: "Proceed",
    },
  ], [], [], [], [], [], [], []);

  assert.ok(Array.isArray(intel.portfolioForecasts));
  assert.equal(intel.portfolioForecasts.length, 4);
  assert.ok(intel.portfolioForecasts.some((forecast) => forecast.period === "30 Days"));
  assert.ok(intel.portfolioForecasts.some((forecast) => forecast.period === "12 Months"));
  assert.ok(intel.portfolioForecasts.every((forecast) => Number.isFinite(forecast.confidenceScore)));
  assert.ok(intel.portfolioForecastScenarios.some((scenario) => scenario.scenario === "Expected"));
  assert.ok(intel.portfolioForecastScenarios.some((scenario) => scenario.scenario === "Conservative"));
  assert.ok(intel.portfolioForecastScenarios.some((scenario) => scenario.scenario === "Aggressive"));
  assert.ok(intel.portfolioForecastSummary.confidenceScore >= 0);
  assert.ok(intel.portfolioForecastSummary.primaryScenario.length > 0);
});

test("buildPortfolioIntelligence includes upgrade-2 enterprise overlay payload", () => {
  const intel = buildPortfolioIntelligence([
    {
      id: "prop-upgrade2-1",
      propertyName: "Upgrade 2 Asset",
      propertyAddress: "400 Enterprise Blvd",
      city: "Covington",
      state: "KY",
      zipCode: "41011",
      purchasePrice: 210000,
      currentValue: 320000,
      currentLoanBalance: 190000,
      monthlyRent: 2800,
      occupancyRate: 94,
      monthlyOperatingExpenses: 950,
      monthlyDebtService: 1500,
      monthlyCashFlow: 350,
      strategy: "BRRRR",
      recommendation: "Refinance Candidate",
    },
  ], [], [{ projectStatus: "Delayed", originalRehabBudget: 50000, actualCost: 56000 }], [], [{ status: "Approved", name: "Prime GC" }], [], [], []);

  assert.ok(intel.enterpriseUpgrade2);
  assert.equal(intel.enterpriseUpgrade2.market.providerReadyOnly, true);
  assert.equal(intel.enterpriseUpgrade2.forecast.horizons.length, 4);
  assert.ok(intel.enterpriseUpgrade2.dashboardKpis.marketKpis.unknownIndicators >= 0);
  assert.equal(intel.enterpriseUpgrade2.automation.protectedVersionPolicy.overwriteApprovedVersions, false);
});
