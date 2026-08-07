import { mkdir, writeFile, copyFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const packageDir = path.join(rootDir, 'release-package');
const exportDir = path.join(rootDir, 'exports');

async function main() {
  await mkdir(packageDir, { recursive: true });
  await mkdir(path.join(packageDir, 'server'), { recursive: true });
  await mkdir(path.join(packageDir, 'app'), { recursive: true });
  await mkdir(path.join(packageDir, 'scripts'), { recursive: true });

  await writeFile(path.join(packageDir, 'README.txt'), 'Royal Star OS release package\n', 'utf8');
  await copyFile(path.join(rootDir, 'package.json'), path.join(packageDir, 'package.json'));
  await copyFile(path.join(rootDir, 'scripts', 'backup-data.mjs'), path.join(packageDir, 'scripts', 'backup-data.mjs'));
  await copyFile(path.join(rootDir, 'scripts', 'restore-data.mjs'), path.join(packageDir, 'scripts', 'restore-data.mjs'));
  await copyFile(path.join(rootDir, 'scripts', 'export-release.mjs'), path.join(packageDir, 'scripts', 'export-release.mjs'));

  console.log(`Created release package at ${packageDir}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
