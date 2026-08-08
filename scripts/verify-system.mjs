import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const appDir = path.join(rootDir, 'app');
const serverDir = path.join(rootDir, 'server');
const dataDir = process.env.RSOS_DATA_DIR ? path.resolve(process.env.RSOS_DATA_DIR) : path.join(serverDir, 'data');

const requiredFiles = [
  path.join(rootDir, 'package.json'),
  path.join(appDir, 'package.json'),
  path.join(appDir, 'src', 'App.jsx'),
  path.join(serverDir, 'index.js'),
  path.join(serverDir, 'authService.js'),
  path.join(serverDir, 'mfaService.js'),
  path.join(serverDir, 'enterpriseAutomationLayerService.js'),
  path.join(serverDir, 'valuationOfferBuyBoxService.js'),
];

const requiredDataFiles = [
  'deals.json',
  'properties.json',
  'comps.json',
  'neighborhoods.json',
  'lenders.json',
  'auth-state.json',
  'enterprise-audit.json',
  'enterprise-reports.json',
  'enterprise-documents.json',
  'enterprise-knowledge.json',
  'workflow-transitions.json',
  'diagnostics-history.json',
];

function fail(message) {
  return { status: 'FAIL', message };
}

function warn(message) {
  return { status: 'WARNING', message };
}

function pass(message) {
  return { status: 'PASS', message };
}

function main() {
  const results = [];
  for (const filePath of requiredFiles) {
    results.push(existsSync(filePath) ? pass(`Found ${path.relative(rootDir, filePath)}`) : fail(`Missing ${path.relative(rootDir, filePath)}`));
  }

  if (!existsSync(dataDir)) {
    results.push(fail('Missing data directory'));
  } else {
    results.push(pass('Data directory exists'));
  }

  for (const fileName of requiredDataFiles) {
    const filePath = path.join(dataDir, fileName);
    results.push(existsSync(filePath) ? pass(`Found ${fileName}`) : fail(`Missing ${fileName}`));
  }

  for (const result of results) {
    if (result.status === 'FAIL') {
      console.error(result.message);
      process.exitCode = 1;
      return;
    }
  }

  console.log('PASS');
}

main();
