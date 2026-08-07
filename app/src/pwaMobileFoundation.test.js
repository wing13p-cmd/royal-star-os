import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function readAppFile(relativePath) {
  return fs.readFileSync(path.join(appRoot, relativePath), "utf8");
}

test("manifest defines required RSOS installable metadata", () => {
  const manifest = JSON.parse(readAppFile("public/manifest.webmanifest"));
  assert.equal(manifest.name, "Royal Star Operating System");
  assert.equal(manifest.short_name, "RSOS");
  assert.equal(manifest.display, "standalone");
  assert.equal(manifest.scope, "/");
  assert.equal(manifest.start_url, "/");
  assert.equal(Array.isArray(manifest.icons), true);
  assert.equal(manifest.icons.some((icon) => String(icon.purpose || "").includes("maskable")), true);
});

test("required PWA icons resolve", () => {
  const iconPaths = [
    "public/icons/icon-192.png",
    "public/icons/icon-512.png",
    "public/icons/icon-maskable-192.png",
    "public/icons/icon-maskable-512.png",
    "public/icons/apple-touch-icon.png",
  ];

  for (const iconPath of iconPaths) {
    assert.equal(fs.existsSync(path.join(appRoot, iconPath)), true, `${iconPath} should exist`);
  }
});

test("service worker contains network-first API policy and no API cache persistence", () => {
  const source = readAppFile("public/sw.js");
  assert.match(source, /url\.pathname\.startsWith\("\/api\/"\)/);
  assert.match(source, /return await fetch\(request\)/);
  const apiBlockStart = source.indexOf("if (isApiRequest(url)) {");
  const navigateBlockStart = source.indexOf("if (request.mode === \"navigate\")");
  const apiBlock = apiBlockStart >= 0 && navigateBlockStart > apiBlockStart
    ? source.slice(apiBlockStart, navigateBlockStart)
    : "";
  assert.equal(apiBlock.includes("cache.put"), false);
});

test("App shell includes mobile drawer, keyboard handling, and offline safety message", () => {
  const appSource = readAppFile("src/App.jsx");
  assert.match(appSource, /rsos-mobile-drawer/);
  assert.match(appSource, /event\.key === "Escape"/);
  assert.match(appSource, /event\.key !== "Tab"/);
  assert.match(appSource, /RSOS is offline\. Viewing cached interface only\. Changes cannot be saved\./);
});

test("Responsive CSS includes mobile breakpoints and touch-safe controls", () => {
  const cssSource = readAppFile("src/App.css");
  assert.match(cssSource, /@media \(max-width: 1024px\)/);
  assert.match(cssSource, /min-height: 44px/);
  assert.match(cssSource, /font-size: 16px !important/);
  assert.match(cssSource, /grid-template-columns: 1fr !important/);
});

test("Desktop Command Center structure is preserved in dashboard style map", () => {
  const dashboardSource = readAppFile("src/components/Dashboard.jsx");
  assert.match(dashboardSource, /gridTemplateColumns: "1fr 2fr 1fr"/);
  assert.match(dashboardSource, /COMMAND CENTER|ROYAL STAR PROPERTIES, LLC/);
});

test("Canonical navigation still contains all approved modules", () => {
  const navSource = readAppFile("src/utils/navigationModel.js");
  const requiredLabels = [
    "COMMAND CENTER",
    "DEAL INTAKE",
    "DEAL ANALYZER",
    "DEAL INTELLIGENCE",
    "KNOWLEDGE BASE",
    "FLIP ANALYZER",
    "BRRRR ANALYZER",
    "PRODUCT VAULT",
    "CONTRACTOR HUB",
    "COMP DATABASE",
    "NEIGHBORHOOD DB",
    "PORTFOLIO DASHBOARD",
    "LENDER DASHBOARD",
    "APPRAISER PACKET BUILDER",
    "REHAB PROJECT TRACKER",
    "PROPERTY DATABASE",
    "VENDOR DATABASE",
    "MATERIAL MATRIX",
  ];

  for (const label of requiredLabels) {
    assert.equal(navSource.includes(label), true);
  }
});
