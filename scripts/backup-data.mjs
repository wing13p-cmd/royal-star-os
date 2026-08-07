import { mkdir, readFile, writeFile, rename, rm, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const serverDir = path.join(rootDir, 'server');
const dataDir = process.env.RSOS_DATA_DIR ? path.resolve(process.env.RSOS_DATA_DIR) : path.join(serverDir, 'data');
const backupDir = process.env.RSOS_BACKUP_DIR ? path.resolve(process.env.RSOS_BACKUP_DIR) : path.join(rootDir, 'backups');
const backupRetentionDays = Number(process.env.RSOS_BACKUP_RETENTION_DAYS || 0);

const dataFiles = [
  ['deals', 'deals.json'],
  ['properties', 'properties.json'],
  ['products', 'products.json'],
  ['contractors', 'contractors.json'],
  ['comps', 'comps.json'],
  ['neighborhoods', 'neighborhoods.json'],
  ['dealIntelligence', 'deal-intelligence.json'],
  ['portfolio', 'portfolio.json'],
  ['vendors', 'vendors.json'],
  ['materials', 'materials.json'],
  ['lenders', 'lenders.json'],
  ['appraisalPackets', 'appraisalPackets.json'],
  ['rehabProjects', 'rehabProjects.json'],
  ['enterpriseAudit', 'enterprise-audit.json'],
  ['enterpriseReports', 'enterprise-reports.json'],
  ['enterpriseDocuments', 'enterprise-documents.json'],
  ['enterpriseKnowledge', 'enterprise-knowledge.json'],
  ['workflowTransitions', 'workflow-transitions.json'],
  ['diagnosticsHistory', 'diagnostics-history.json'],
];

async function readJson(filePath) {
  const content = await readFile(filePath, 'utf8');
  const parsed = JSON.parse(content);
  if (!Array.isArray(parsed)) throw new Error(`${filePath} did not contain an array`);
  return parsed;
}

async function main() {
  await mkdir(backupDir, { recursive: true });
  const payload = {
    system: 'Royal Star OS',
    version: '1.0.0-rc1',
    createdAt: new Date().toISOString(),
    data: {},
  };

  for (const [key, fileName] of dataFiles) {
    const filePath = path.join(dataDir, fileName);
    try {
      payload.data[key] = await readJson(filePath);
    } catch {
      payload.data[key] = [];
    }
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, '');
  const backupFile = path.join(backupDir, `royal-star-os-backup-${stamp}.json`);
  const tempFile = path.join(backupDir, `royal-star-os-backup-${stamp}.tmp`);
  await writeFile(tempFile, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  await rename(tempFile, backupFile);

  if (Number.isInteger(backupRetentionDays) && backupRetentionDays > 0) {
    const entries = await readdir(backupDir, { withFileTypes: true }).catch(() => []);
    const cutoffMs = Date.now() - (backupRetentionDays * 24 * 60 * 60 * 1000);
    await Promise.all(
      entries
        .filter((entry) => entry.isFile() && /^royal-star-os-backup-.*\.json$/i.test(entry.name))
        .map(async (entry) => {
          const filePath = path.join(backupDir, entry.name);
          const stats = await stat(filePath).catch(() => null);
          if (stats && stats.mtimeMs < cutoffMs) {
            await rm(filePath, { force: true }).catch(() => {});
          }
        }),
    );
  }

  console.log(`Backup created: ${backupFile}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
