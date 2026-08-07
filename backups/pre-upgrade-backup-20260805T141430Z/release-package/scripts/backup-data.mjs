import { mkdir, readFile, writeFile, rename, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const serverDir = path.join(rootDir, 'server');
const dataDir = path.join(serverDir, 'data');
const backupDir = path.join(rootDir, 'backups');

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
  console.log(`Backup created: ${backupFile}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
