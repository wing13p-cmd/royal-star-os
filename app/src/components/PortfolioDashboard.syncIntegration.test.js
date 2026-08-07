import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const dashboardFile = path.join(process.cwd(), "app/src/components/PortfolioDashboard.jsx");

test("import from deal flow requires explicit preview and approval steps", () => {
  const source = fs.readFileSync(dashboardFile, "utf8");

  assert.equal(source.includes('"/api/portfolio/deal-sync/eligible"'), true);
  assert.equal(source.includes('"/api/portfolio/deal-sync/preview"'), true);
  assert.equal(source.includes('"/api/portfolio/deal-sync/execute"'), true);
  assert.equal(source.includes("userApproval: true"), true);
  assert.equal(source.includes("PREVIEW SYNC"), true);
  assert.equal(source.includes("APPROVE IMPORT"), true);
});

test("approved import refreshes portfolio state and keeps export wired to filtered portfolio", () => {
  const source = fs.readFileSync(dashboardFile, "utf8");

  assert.equal(source.includes("await loadPortfolio();"), true);
  assert.equal(source.includes("await loadCrossModuleState();"), true);
  assert.equal(source.includes("const rows = filteredPortfolio.map((item) => {"), true);
  assert.equal(source.includes("royal-star-portfolio-summary.csv"), true);
});

test("cross-module synchronization uses canonical backend state and shared portfolio context", () => {
  const source = fs.readFileSync(dashboardFile, "utf8");

  assert.equal(source.includes('"/api/cross-module-sync"'), true);
  assert.equal(source.includes("buildCrossModulePortfolioContext"), true);
  assert.equal(source.includes("canonicalProperties"), true);
});

test("unavailable value handling displays Insufficient Data for missing values", () => {
  const source = fs.readFileSync(dashboardFile, "utf8");

  assert.equal(source.includes("Insufficient Data"), true);
  assert.equal(source.includes("formatUnavailableCurrency"), true);
  assert.equal(source.includes("formatUnavailablePercent"), true);
});

test("dashboard navigation and command center layout labels remain present", () => {
  const source = fs.readFileSync(dashboardFile, "utf8");

  const requiredLabels = [
    "COMMAND CENTER",
    "DEAL ANALYZER",
    "FLIP ANALYZER",
    "BRRRR ANALYZER",
    "PRODUCT VAULT",
    "CONTRACTOR HUB",
    "COMP DATABASE",
    "NEIGHBORHOOD DB",
    "PORTFOLIO DASHBOARD",
  ];

  for (const label of requiredLabels) {
    assert.equal(source.includes(label), true);
  }
});
