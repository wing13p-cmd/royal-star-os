import { mkdir, readFile, writeFile, rename, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const serverDir = path.join(rootDir, 'server');
const dataDir = path.join(serverDir, 'data');
const backupDir = path.join(rootDir, 'backups');
const backupArg = process.argv[2];

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

async function main() {
  if (!backupArg) {
    console.error('Usage: npm run restore -- <backup-file>');
    process.exit(1);
  }

  const backupFile = path.isAbsolute(backupArg) ? backupArg : path.join(backupDir, backupArg);
  if (!existsSync(backupFile)) {
    console.error(`Backup file not found: ${backupFile}`);
    process.exit(1);
  }

  const backup = JSON.parse(await readFile(backupFile, 'utf8'));
  if (!backup || backup.system !== 'Royal Star OS') {
    console.error('Invalid backup structure');
    process.exit(1);
  }

  await mkdir(dataDir, { recursive: true });
  for (const [key, fileName] of dataFiles) {
    const targetFile = path.join(dataDir, fileName);
    const value = backup?.data?.[key];
    if (!Array.isArray(value)) {
      throw new Error(`Backup data for ${key} is invalid`);
    }
    const tempFile = path.join(dataDir, `${fileName}.tmp`);
    await writeFile(tempFile, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
    await rename(tempFile, targetFile);
    console.log(`Restored ${fileName}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
