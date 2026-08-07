import { mkdir, readFile, writeFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const exportDir = path.join(rootDir, 'exports');
const backupDir = path.join(rootDir, 'backups');

async function main() {
  await mkdir(exportDir, { recursive: true });
  const backups = (await readdir(backupDir)).filter((entry) => entry.endsWith('.json'));
  const latestBackup = backups.sort().at(-1) || 'none';
  const manifest = {
    generatedAt: new Date().toISOString(),
    system: 'Royal Star OS',
    version: '1.0.0',
    latestBackup,
  };

  await writeFile(path.join(exportDir, 'release-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  console.log(`Exported release manifest to ${path.join(exportDir, 'release-manifest.json')}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
