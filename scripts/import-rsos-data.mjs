import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile, rename, access } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const serverDir = path.join(rootDir, "server");

const DATA_FILES = [
  ["deals", "deals.json"],
  ["properties", "properties.json"],
  ["products", "products.json"],
  ["contractors", "contractors.json"],
  ["comps", "comps.json"],
  ["neighborhoods", "neighborhoods.json"],
  ["dealIntelligence", "deal-intelligence.json"],
  ["portfolio", "portfolio.json"],
  ["vendors", "vendors.json"],
  ["materials", "materials.json"],
  ["lenders", "lenders.json"],
  ["appraisalPackets", "appraisalPackets.json"],
  ["rehabProjects", "rehabProjects.json"],
  ["enterpriseAudit", "enterprise-audit.json"],
  ["enterpriseReports", "enterprise-reports.json"],
  ["enterpriseDocuments", "enterprise-documents.json"],
  ["enterpriseKnowledge", "enterprise-knowledge.json"],
  ["workflowTransitions", "workflow-transitions.json"],
  ["diagnosticsHistory", "diagnostics-history.json"],
];

function getDirectories() {
  return {
    dataDir: process.env.RSOS_DATA_DIR ? path.resolve(process.env.RSOS_DATA_DIR) : path.join(serverDir, "data"),
    backupDir: process.env.RSOS_BACKUP_DIR ? path.resolve(process.env.RSOS_BACKUP_DIR) : path.join(rootDir, "backups"),
  };
}

function stableHash(input) {
  return createHash("sha256").update(input).digest("hex");
}

async function writeJsonAtomic(filePath, payload) {
  const tempPath = `${filePath}.${Date.now()}.tmp`;
  await writeFile(tempPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  await rename(tempPath, filePath);
}

async function readJsonIfExists(filePath, fallback) {
  try {
    const content = await readFile(filePath, "utf8");
    return JSON.parse(content);
  } catch {
    return fallback;
  }
}

export function validateImportPayload(backupPayload) {
  if (!backupPayload || backupPayload.system !== "Royal Star OS") {
    throw new Error("Invalid backup payload. Expected Royal Star OS backup format.");
  }

  for (const [key] of DATA_FILES) {
    if (!Array.isArray(backupPayload?.data?.[key])) {
      throw new Error(`Backup payload missing array data for ${key}`);
    }
  }

  const propertiesById = new Set((backupPayload.data.properties || []).map((entry) => String(entry?.id || "")).filter(Boolean));
  const deals = backupPayload.data.deals || [];
  for (const deal of deals) {
    const linkedPropertyId = String(deal?.linkedPropertyId || deal?.propertyId || "").trim();
    if (linkedPropertyId && !propertiesById.has(linkedPropertyId)) {
      throw new Error(`Deal linkage validation failed for deal ${String(deal?.id || "unknown")}`);
    }
  }

  return true;
}

export async function importRsosData(options = {}) {
  const sourceFile = options.sourceFile;
  if (!sourceFile) throw new Error("sourceFile is required");

  const { dataDir, backupDir } = getDirectories();
  await mkdir(dataDir, { recursive: true });
  await mkdir(backupDir, { recursive: true });

  const sourceRaw = await readFile(sourceFile, "utf8");
  const sourcePayload = JSON.parse(sourceRaw);
  validateImportPayload(sourcePayload);

  const sourceHash = stableHash(sourceRaw);
  const stateFile = path.join(dataDir, ".rsos-import-state.json");
  const importState = await readJsonIfExists(stateFile, {});

  if (importState.lastImportHash && importState.lastImportHash === sourceHash) {
    throw new Error("Import refused: this backup was already imported");
  }

  const existingDeals = await readJsonIfExists(path.join(dataDir, "deals.json"), []);
  const hasExistingData = Array.isArray(existingDeals) && existingDeals.length > 0;
  if (hasExistingData && options.allowNonEmpty !== true) {
    throw new Error("Import refused: target data directory is not empty. Use an empty directory or pass allowNonEmpty=true intentionally.");
  }

  const preImportBackupPath = path.join(backupDir, `pre-import-backup-${new Date().toISOString().replace(/[:.]/g, "")}.json`);
  const currentDataSnapshot = { system: "Royal Star OS", createdAt: new Date().toISOString(), data: {} };
  for (const [key, fileName] of DATA_FILES) {
    currentDataSnapshot.data[key] = await readJsonIfExists(path.join(dataDir, fileName), []);
  }
  await writeJsonAtomic(preImportBackupPath, currentDataSnapshot);

  for (const [key, fileName] of DATA_FILES) {
    await writeJsonAtomic(path.join(dataDir, fileName), sourcePayload.data[key]);
  }

  const postDeals = await readJsonIfExists(path.join(dataDir, "deals.json"), []);
  const postProperties = await readJsonIfExists(path.join(dataDir, "properties.json"), []);
  if (postDeals.length !== sourcePayload.data.deals.length) {
    throw new Error("Import validation failed: deal count mismatch after import");
  }
  if (postProperties.length !== sourcePayload.data.properties.length) {
    throw new Error("Import validation failed: property count mismatch after import");
  }

  await writeJsonAtomic(stateFile, {
    lastImportHash: sourceHash,
    lastImportedAt: new Date().toISOString(),
  });

  return {
    ok: true,
    preImportBackupPath,
    importedCounts: {
      deals: postDeals.length,
      properties: postProperties.length,
    },
  };
}

async function main() {
  const sourceArg = process.argv[2];
  if (!sourceArg) {
    console.error("Usage: npm run import:data -- <backup-file>");
    process.exit(1);
  }

  const absoluteSource = path.isAbsolute(sourceArg) ? sourceArg : path.resolve(process.cwd(), sourceArg);
  await access(absoluteSource);
  const result = await importRsosData({ sourceFile: absoluteSource });
  console.log(JSON.stringify(result, null, 2));
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  main().catch((error) => {
    console.error(String(error?.message || error));
    process.exit(1);
  });
}
