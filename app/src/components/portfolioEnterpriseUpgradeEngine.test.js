import test from "node:test";
import assert from "node:assert/strict";
import {
  buildPortfolioEnterpriseUpgradeEngine,
  buildPortfolioLongRangeForecast,
  buildProviderReadyMarketIntelligence,
} from "./portfolioEnterpriseUpgradeEngine.js";

test("buildProviderReadyMarketIntelligence preserves unknowns when providers are not configured", () => {
  const market = buildProviderReadyMarketIntelligence({ providerStatus: {}, marketSnapshot: {} });
  assert.equal(market.providerReadyOnly, true);
  assert.ok(market.indicators.length >= 10);
  assert.ok(market.indicators.every((entry) => entry.providerReady === true));
  assert.ok(market.indicators.some((entry) => entry.knownValue === null));
});

test("buildPortfolioLongRangeForecast returns 1/3/5/10 horizon records and preserves missing assumptions", () => {
  const forecast = buildPortfolioLongRangeForecast({
    summary: {
      totalCurrentValue: 500000,
      totalOutstandingDebt: 250000,
      totalAnnualCashFlow: 30000,
      totalMonthlyRent: 6000,
      totalMonthlyOperatingExpenses: 1500,
      totalMonthlyDebtService: 2200,
    },
    assumptions: {},
  });

  assert.equal(forecast.horizons.length, 4);
  assert.deepEqual(forecast.horizons.map((entry) => entry.year), [1, 3, 5, 10]);
  assert.ok(forecast.horizons.every((entry) => entry.projections === null));
  assert.ok(forecast.horizons.every((entry) => entry.confidence === "Insufficient Data"));
});

test("buildPortfolioLongRangeForecast computes numeric projections when assumptions are provided", () => {
  const forecast = buildPortfolioLongRangeForecast({
    summary: {
      totalCurrentValue: 500000,
      totalOutstandingDebt: 250000,
      totalAnnualCashFlow: 30000,
      totalMonthlyRent: 6000,
      totalMonthlyOperatingExpenses: 1500,
      totalMonthlyDebtService: 2200,
    },
    assumptions: {
      appreciationRate: 0.03,
      rentGrowthRate: 0.02,
      expenseGrowthRate: 0.015,
    },
  });

  assert.ok(forecast.horizons.every((entry) => entry.projections !== null));
  assert.ok(forecast.horizons[3].projections.portfolioValue > forecast.horizons[0].projections.portfolioValue);
});

test("buildPortfolioEnterpriseUpgradeEngine returns enterprise risk, AI, and automation payload", () => {
  const engine = buildPortfolioEnterpriseUpgradeEngine({
    summary: {
      totalCurrentValue: 900000,
      totalOutstandingDebt: 520000,
      totalMonthlyCashFlow: 1800,
      totalMonthlyDebtService: 3900,
      totalMonthlyRent: 10400,
      totalMonthlyOperatingExpenses: 2800,
      totalAnnualCashFlow: 21600,
      reserveShortfallValue: 100000,
      recommendedReserve: 350000,
      availableLiquidity: 250000,
      activeRehabs: 2,
      activeDeals: 1,
      propertiesWithRefinanceCandidate: 1,
      upcomingMaturities: 1,
    },
    properties: [
      {
        currentValue: 450000,
        currentLoanBalance: 270000,
        monthlyRent: 4200,
        monthlyOperatingExpenses: 1200,
        monthlyDebtService: 1800,
        occupancyRate: 94,
        strategy: "BRRRR",
        interestRate: 8.25,
      },
      {
        currentValue: 450000,
        currentLoanBalance: 250000,
        monthlyRent: 3900,
        monthlyOperatingExpenses: 1100,
        monthlyDebtService: 1700,
        occupancyRate: 91,
        strategy: "Flip",
        interestRate: 9.0,
      },
    ],
    contractors: [{ name: "Prime GC", status: "Approved" }],
    rehabProjects: [{ projectStatus: "Delayed", originalRehabBudget: 80000, actualCost: 90000 }],
    assumptions: {
      appreciationRate: 0.03,
      rentGrowthRate: 0.02,
      expenseGrowthRate: 0.015,
    },
    providerStatus: {},
  });

  assert.ok(engine.dashboardKpis.portfolioKpis.totalValue > 0);
  assert.ok(engine.risk.overallRiskScore >= 0);
  assert.ok(engine.ai.acquisitions.confidenceScore >= 0);
  assert.equal(engine.automation.protectedVersionPolicy.overwriteApprovedVersions, false);
});
