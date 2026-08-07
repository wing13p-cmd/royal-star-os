import { mkdir, readFile, writeFile, readdir, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const exportDir = path.join(rootDir, 'exports');
const backupDir = path.join(rootDir, 'backups');

const SENSITIVE_PATTERNS = [/\.env/i, /credentials?/i, /secret/i, /token/i, /key/i];

function parseArgs(argv = process.argv.slice(2)) {
  const parsed = {};
  argv.forEach((arg) => {
    const [key, value] = String(arg).split('=');
    if (!key.startsWith('--')) return;
    parsed[key.slice(2)] = value === undefined ? 'true' : value;
  });
  return parsed;
}

async function listFilesRecursive(dir, baseDir = dir) {
  const output = [];
  const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
  for (const entry of entries) {
    const absolutePath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (
        ['node_modules', '.git', 'dist', 'backups', 'checkpoints', 'release-package', 'exports'].includes(entry.name)
        || entry.name.startsWith('src.bak')
        || entry.name.startsWith('data.backup')
      ) {
        continue;
      }
      output.push(...await listFilesRecursive(absolutePath, baseDir));
      continue;
    }
    if (entry.name.endsWith('.bak')) continue;
    output.push(path.relative(baseDir, absolutePath));
  }
  return output;
}

function isSensitivePath(relativePath) {
  return SENSITIVE_PATTERNS.some((pattern) => pattern.test(relativePath));
}

export async function buildReleaseManifest(options = {}) {
  const now = new Date();
  const generatedAt = now.toISOString();
  const backups = existsSync(backupDir) ? (await readdir(backupDir)).filter((entry) => entry.endsWith('.json') || entry.endsWith('.tgz')) : [];
  const latestBackup = backups.sort().at(-1) || 'none';

  const changedCandidates = [
    ...(await listFilesRecursive(path.join(rootDir, 'server')).catch(() => [])),
    ...(await listFilesRecursive(path.join(rootDir, 'app')).catch(() => [])),
    ...(await listFilesRecursive(path.join(rootDir, 'scripts')).catch(() => [])),
  ];
  const filesChanged = [...new Set(changedCandidates)].map((file) => file.replace(/\\/g, '/'));

  const sensitiveCandidates = filesChanged.filter((file) => isSensitivePath(file));

  return {
    version: options.version || '1.0.0',
    timestamp: generatedAt,
    generatedAt,
    filesChanged,
    modulesAffected: options.modulesAffected || [
      'AI Command Center',
      'Global Search',
      'Reporting Engine',
      'Document Automation',
      'Knowledge Engine',
      'Forecasting',
      'Workflow Automation',
      'Diagnostics',
      'Production Hardening',
    ],
    testsRun: options.testsRun || [],
    buildResult: options.buildResult || 'UNKNOWN',
    knownLimitations: options.knownLimitations || [],
    rollbackLocation: options.rollbackLocation || 'unknown',
    latestBackup,
    gitAvailable: existsSync(path.join(rootDir, '.git')),
    sensitiveFileScan: {
      scanned: filesChanged.length,
      flagged: sensitiveCandidates,
    },
  };
}

async function main() {
  const args = parseArgs();
  await mkdir(exportDir, { recursive: true });
  const manifest = await buildReleaseManifest({
    version: args.version || '1.0.0',
    buildResult: args.buildResult || 'UNKNOWN',
    rollbackLocation: args.rollbackLocation || 'unknown',
    testsRun: args.testsRun ? String(args.testsRun).split('|') : [],
    knownLimitations: args.knownLimitations ? String(args.knownLimitations).split('|') : [],
  });

  const manifestPath = path.join(exportDir, 'release-manifest.json');
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  console.log(`Exported release manifest to ${manifestPath}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
