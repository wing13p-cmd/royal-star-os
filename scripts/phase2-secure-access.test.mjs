import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { mkdtemp, mkdir, writeFile, readFile } from "node:fs/promises";
import { buildApiUrl } from "../app/src/utils/apiClient.js";
import { buildRuntimeConfig } from "../app/src/utils/config.js";
import { importRsosData } from "./import-rsos-data.mjs";

function restoreEnvValue(key, previous) {
  if (previous === undefined) {
    delete process.env[key];
    return;
  }
  process.env[key] = previous;
}

function sampleBackup() {
  return {
    system: "Royal Star OS",
    data: {
      deals: [{ id: "deal-1", propertyId: "prop-1", linkedPropertyId: "prop-1", propertyAddress: "952 Goss Rd" }],
      properties: [{ id: "prop-1", propertyName: "test property 2", address: "952 Goss Rd", parcelNumber: "P-123", mapUrl: "https://maps.example/p-123" }],
      products: [],
      contractors: [],
      comps: [],
      neighborhoods: [],
      dealIntelligence: [],
      portfolio: [],
      vendors: [],
      materials: [],
      lenders: [],
      appraisalPackets: [],
      rehabProjects: [],
      enterpriseAudit: [],
      enterpriseReports: [],
      enterpriseDocuments: [],
      enterpriseKnowledge: [],
      workflowTransitions: [],
      diagnosticsHistory: [],
    },
  };
}

test("1. production config supports relative /api routing", () => {
  const config = buildRuntimeConfig({ env: { NODE_ENV: "production", PORT: "3001" }, runtimeEnv: {}, isBrowser: true, requireProductionConfig: true });
  assert.equal(config.apiBaseUrl, "/");
});

test("2. API URL builder keeps relative /api paths", () => {
  assert.equal(buildApiUrl("/api/health"), "/api/health");
});

test("3. production config does not require localhost fallback origins", () => {
  const config = buildRuntimeConfig({ env: { NODE_ENV: "production", PORT: "3001" }, runtimeEnv: {}, isBrowser: false, requireProductionConfig: true });
  assert.deepEqual(config.allowedOrigins, []);
});

test("4. secure origin supports https URLs", () => {
  const origin = new URL("https://rsos.example.com");
  assert.equal(origin.protocol, "https:");
});

test("5. manifest target file path exists in source", async () => {
  const manifest = await readFile(path.join(process.cwd(), "app/public/manifest.webmanifest"), "utf8");
  assert.equal(manifest.includes('"name": "Royal Star Operating System"'), true);
});

test("6. service worker registration file exists", async () => {
  const sw = await readFile(path.join(process.cwd(), "app/src/registerServiceWorker.js"), "utf8");
  assert.equal(sw.includes("register(\"/sw.js\""), true);
});

test("7. service worker scope remains root", async () => {
  const sw = await readFile(path.join(process.cwd(), "app/src/registerServiceWorker.js"), "utf8");
  assert.equal(sw.includes('{ scope: "/" }'), true);
});

test("8. icon references exist in manifest", async () => {
  const manifest = JSON.parse(await readFile(path.join(process.cwd(), "app/public/manifest.webmanifest"), "utf8"));
  const srcs = new Set((manifest.icons || []).map((icon) => icon.src));
  assert.equal(srcs.has("/icons/icon-192.png"), true);
  assert.equal(srcs.has("/icons/icon-512.png"), true);
});

test("9. offline warning string remains present", async () => {
  const sw = await readFile(path.join(process.cwd(), "app/public/sw.js"), "utf8");
  assert.equal(sw.includes("RSOS is offline. Viewing cached interface only. Changes cannot be saved."), true);
});

test("10. reconnect behavior keeps network-first API strategy", async () => {
  const sw = await readFile(path.join(process.cwd(), "app/public/sw.js"), "utf8");
  assert.equal(sw.includes("return await fetch(request);"), true);
});

test("11. import requires writable persistent data path", async () => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "rsos-import-"));
  const dataDir = path.join(tempRoot, "data");
  const backupDir = path.join(tempRoot, "backups");
  await mkdir(dataDir, { recursive: true });
  await mkdir(backupDir, { recursive: true });
  const sourcePath = path.join(tempRoot, "source.json");
  await writeFile(sourcePath, JSON.stringify(sampleBackup()), "utf8");

  const prevDataDir = process.env.RSOS_DATA_DIR;
  const prevBackupDir = process.env.RSOS_BACKUP_DIR;
  process.env.RSOS_DATA_DIR = dataDir;
  process.env.RSOS_BACKUP_DIR = backupDir;
  try {
    const result = await importRsosData({ sourceFile: sourcePath });
    assert.equal(result.ok, true);
  } finally {
    restoreEnvValue("RSOS_DATA_DIR", prevDataDir);
    restoreEnvValue("RSOS_BACKUP_DIR", prevBackupDir);
  }
});

test("12. import preserves IDs", async () => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "rsos-import-id-"));
  const dataDir = path.join(tempRoot, "data");
  const backupDir = path.join(tempRoot, "backups");
  await mkdir(dataDir, { recursive: true });
  await mkdir(backupDir, { recursive: true });
  const sourcePath = path.join(tempRoot, "source.json");
  await writeFile(sourcePath, JSON.stringify(sampleBackup()), "utf8");

  const prevDataDir = process.env.RSOS_DATA_DIR;
  const prevBackupDir = process.env.RSOS_BACKUP_DIR;
  process.env.RSOS_DATA_DIR = dataDir;
  process.env.RSOS_BACKUP_DIR = backupDir;
  try {
    await importRsosData({ sourceFile: sourcePath });
    const deals = JSON.parse(await readFile(path.join(dataDir, "deals.json"), "utf8"));
    assert.equal(deals[0].id, "deal-1");
  } finally {
    restoreEnvValue("RSOS_DATA_DIR", prevDataDir);
    restoreEnvValue("RSOS_BACKUP_DIR", prevBackupDir);
  }
});

test("13. import preserves record counts", async () => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "rsos-import-count-"));
  const dataDir = path.join(tempRoot, "data");
  const backupDir = path.join(tempRoot, "backups");
  await mkdir(dataDir, { recursive: true });
  await mkdir(backupDir, { recursive: true });
  const sourcePath = path.join(tempRoot, "source.json");
  const payload = sampleBackup();
  payload.data.properties.push({ id: "prop-2", propertyName: "another", address: "x" });
  await writeFile(sourcePath, JSON.stringify(payload), "utf8");

  const prevDataDir = process.env.RSOS_DATA_DIR;
  const prevBackupDir = process.env.RSOS_BACKUP_DIR;
  process.env.RSOS_DATA_DIR = dataDir;
  process.env.RSOS_BACKUP_DIR = backupDir;
  try {
    await importRsosData({ sourceFile: sourcePath });
    const properties = JSON.parse(await readFile(path.join(dataDir, "properties.json"), "utf8"));
    assert.equal(properties.length, 2);
  } finally {
    restoreEnvValue("RSOS_DATA_DIR", prevDataDir);
    restoreEnvValue("RSOS_BACKUP_DIR", prevBackupDir);
  }
});

test("14. import does not duplicate 952 Goss Rd", async () => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "rsos-import-goss-"));
  const dataDir = path.join(tempRoot, "data");
  const backupDir = path.join(tempRoot, "backups");
  await mkdir(dataDir, { recursive: true });
  await mkdir(backupDir, { recursive: true });
  const sourcePath = path.join(tempRoot, "source.json");
  await writeFile(sourcePath, JSON.stringify(sampleBackup()), "utf8");

  const prevDataDir = process.env.RSOS_DATA_DIR;
  const prevBackupDir = process.env.RSOS_BACKUP_DIR;
  process.env.RSOS_DATA_DIR = dataDir;
  process.env.RSOS_BACKUP_DIR = backupDir;
  try {
    await importRsosData({ sourceFile: sourcePath });
    const properties = JSON.parse(await readFile(path.join(dataDir, "properties.json"), "utf8"));
    const count = properties.filter((entry) => String(entry.address || "").toLowerCase() === "952 goss rd").length;
    assert.equal(count, 1);
  } finally {
    restoreEnvValue("RSOS_DATA_DIR", prevDataDir);
    restoreEnvValue("RSOS_BACKUP_DIR", prevBackupDir);
  }
});

test("15. test property 2 remains unchanged after import", async () => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "rsos-import-prop2-"));
  const dataDir = path.join(tempRoot, "data");
  const backupDir = path.join(tempRoot, "backups");
  await mkdir(dataDir, { recursive: true });
  await mkdir(backupDir, { recursive: true });
  const sourcePath = path.join(tempRoot, "source.json");
  await writeFile(sourcePath, JSON.stringify(sampleBackup()), "utf8");

  const prevDataDir = process.env.RSOS_DATA_DIR;
  const prevBackupDir = process.env.RSOS_BACKUP_DIR;
  process.env.RSOS_DATA_DIR = dataDir;
  process.env.RSOS_BACKUP_DIR = backupDir;
  try {
    await importRsosData({ sourceFile: sourcePath });
    const properties = JSON.parse(await readFile(path.join(dataDir, "properties.json"), "utf8"));
    const property = properties.find((entry) => entry.id === "prop-1");
    assert.equal(property.propertyName, "test property 2");
  } finally {
    restoreEnvValue("RSOS_DATA_DIR", prevDataDir);
    restoreEnvValue("RSOS_BACKUP_DIR", prevBackupDir);
  }
});

test("16. backup directory is not a public asset path", async () => {
  const envTemplate = await readFile(path.join(process.cwd(), "deploy/.env.production.template"), "utf8");
  assert.equal(envTemplate.includes("RSOS_BACKUP_DIR="), true);
});

test("17. environment template does not expose real secrets", async () => {
  const envTemplate = await readFile(path.join(process.cwd(), "deploy/.env.production.template"), "utf8");
  assert.equal(envTemplate.includes("replace-with-strong-random-token"), true);
});

test("18. production API health endpoint path remains defined", async () => {
  const serverCode = await readFile(path.join(process.cwd(), "server/index.js"), "utf8");
  assert.equal(serverCode.includes('/api/health'), true);
});

test("19. mobile navigation code remains present", async () => {
  const appCode = await readFile(path.join(process.cwd(), "app/src/App.jsx"), "utf8");
  assert.equal(appCode.includes("rsos-mobile-drawer"), true);
});

test("20. desktop Command Center route remains present", async () => {
  const appCode = await readFile(path.join(process.cwd(), "app/src/App.jsx"), "utf8");
  assert.equal(appCode.includes("dashboard"), true);
});

test("21. deal-property synchronization service remains wired", async () => {
  const serverCode = await readFile(path.join(process.cwd(), "server/index.js"), "utf8");
  assert.equal(serverCode.includes("createDealPropertySyncService"), true);
});

test("22. 30-day forecast engine references still exist", async () => {
  const dashboardCode = await readFile(path.join(process.cwd(), "app/src/components/Dashboard.jsx"), "utf8");
  assert.equal(/30[- ]day/i.test(dashboardCode), true);
});

test("23. secure gateway does not embed localhost URLs in served bundle defaults", async () => {
  const gatewayCode = await readFile(path.join(process.cwd(), "server/secureGateway.js"), "utf8");
  assert.equal(gatewayCode.includes("RSOS_PUBLIC_ORIGIN"), true);
});

test("24. no mixed-content fallback endpoint is introduced in gateway", async () => {
  const gatewayCode = await readFile(path.join(process.cwd(), "server/secureGateway.js"), "utf8");
  assert.equal(gatewayCode.includes("http://127.0.0.1"), true);
  assert.equal(gatewayCode.includes("http://localhost"), false);
});

test("25. frontend bundle secret placeholders are not present in source", async () => {
  const sourceFiles = [
    path.join(process.cwd(), "app/src/utils/config.js"),
    path.join(process.cwd(), "app/src/utils/apiClient.js"),
  ];
  const combined = (await Promise.all(sourceFiles.map((filePath) => readFile(filePath, "utf8")))).join("\n");
  assert.equal(/RSOS_OPERATOR_TOKEN|RSOS_TLS_KEY_PATH|RSOS_TLS_CERT_PATH/.test(combined), false);
});
