import { spawn, spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const appDir = path.join(rootDir, 'app');
const serverDir = path.join(rootDir, 'server');
const frontendUrl = 'http://localhost:5173';
const backendUrl = 'http://127.0.0.1:3001/api/health';
const frontendPidFile = path.join(rootDir, '.rsos-frontend.pid');
const backendPidFile = path.join(rootDir, '.rsos-backend.pid');

function log(message) {
  console.log(`[rsos] ${message}`);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizePath(value) {
  return value.replace(/\\/g, '/');
}

export function isRsosProcessCommand(command = '') {
  const normalized = normalizePath(command);
  if (!normalized) return false;

  return /(?:^|\/)server\/index\.js(?:\s|$)/.test(normalized)
    || /(?:^|\/)app\/node_modules(?:\/\.bin)?\/vite(?:\.js)?(?:\s|$)/.test(normalized)
    || /(?:^|\/)vite\/bin\/vite\.js(?:\s|$)/.test(normalized)
    || /(?:^|\/)index\.js(?:\s|$)/.test(normalized)
    || /(?:^|\/)vite(?:\.js)?(?:\s|$)/.test(normalized)
    || /(^|\s)node\s+index\.js(?:\s|$)/.test(normalized);
}

function readPid(filePath) {
  if (!existsSync(filePath)) return null;
  const value = readFileSync(filePath, 'utf8').trim();
  return value ? Number(value) : null;
}

function writePid(filePath, pid) {
  if (!pid) return;
  writeFileSync(filePath, String(pid), 'utf8');
}

function isProcessRunning(pid) {
  if (!pid) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function getProcessCommand(pid) {
  if (!pid) return '';
  try {
    const result = spawnSync('ps', ['-p', String(pid), '-o', 'command='], { encoding: 'utf8' });
    if (result.status !== 0) return '';
    return result.stdout.trim();
  } catch {
    return '';
  }
}

function getListeningPidsForPort(port) {
  try {
    const result = spawnSync('lsof', ['-nP', `-iTCP:${port}`, '-sTCP:LISTEN', '-t'], { encoding: 'utf8' });
    if (result.status !== 0) return [];
    return result.stdout.split(/\s+/).map((value) => Number(value)).filter((value) => Number.isFinite(value) && value > 0);
  } catch {
    return [];
  }
}

async function waitForUrl(url, timeoutMs = 20000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok) return true;
    } catch {
      // ignore until timeout
    }
    await sleep(1000);
  }
  return false;
}

function runCommand(command, args, options = {}) {
  return spawn(command, args, {
    cwd: rootDir,
    stdio: 'inherit',
    shell: false,
    ...options,
  });
}

async function isHealthy(url) {
  try {
    const response = await fetch(url);
    return response.ok;
  } catch {
    return false;
  }
}

async function ensureHealthyExistingProcess(port, url, pidFile, label) {
  const existingPid = readPid(pidFile);
  if (existingPid && isProcessRunning(existingPid)) {
    if (await isHealthy(url)) {
      log(`${label} already healthy with pid ${existingPid}`);
      return { pid: existingPid, reused: true };
    }
    log(`Stopping stale ${label} pid ${existingPid}`);
    try {
      process.kill(existingPid);
    } catch {
      // ignore and continue
    }
  }

  const listeningPids = getListeningPidsForPort(port);
  if (listeningPids.length) {
    for (const pid of listeningPids) {
      const command = getProcessCommand(pid);
      if (!isRsosProcessCommand(command) && !command.includes('rsos') && !command.includes('royal')) {
        log(`${label} port ${port} is occupied by pid ${pid} (${command || 'unknown'}) which does not look like RSOS`);
        continue;
      }
      if (await isHealthy(url)) {
        log(`${label} already responding on port ${port} via pid ${pid}`);
        writePid(pidFile, pid);
        return { pid, reused: true };
      }
    }

    const knownPid = listeningPids.find((pid) => pid === existingPid);
    if (knownPid) {
      log(`Stopping existing ${label} listener on port ${port}`);
      try {
        process.kill(knownPid);
      } catch {
        // ignore stale or already-dead listeners
      }
      await sleep(1000);
      if (existsSync(pidFile)) {
        try {
          unlinkSync(pidFile);
        } catch {}
      }
    } else {
      log(`${label} could not start because port ${port} is already occupied by another process`);
      return { pid: null, reused: false };
    }
  }

  return { pid: null, reused: false };
}

async function startBackend() {
  const existing = await ensureHealthyExistingProcess(3001, backendUrl, backendPidFile, 'backend');
  if (existing.reused && existing.pid) return existing.pid;
  if (!existing.reused && existing.pid === null && getListeningPidsForPort(3001).length) {
    return null;
  }

  log('Starting backend on port 3001');
  const child = runCommand(process.execPath, [path.join(serverDir, 'index.js')]);
  child.on('exit', (code) => {
    if (code !== 0) {
      log(`Backend exited with code ${code}`);
    }
  });
  child.on('error', (error) => {
    log(`Backend failed to start: ${error.message}`);
  });
  writePid(backendPidFile, child.pid);
  return child.pid;
}

async function startFrontend() {
  const existing = await ensureHealthyExistingProcess(5173, frontendUrl, frontendPidFile, 'frontend');
  if (existing.reused && existing.pid) return existing.pid;
  if (!existing.reused && existing.pid === null && getListeningPidsForPort(5173).length) {
    return null;
  }

  log('Starting frontend on port 5173');
  const child = runCommand(process.execPath, [path.join(appDir, 'node_modules', 'vite', 'bin', 'vite.js'), '--host', '127.0.0.1', '--port', '5173'], {
    cwd: appDir,
  });
  child.on('exit', (code) => {
    if (code !== 0) {
      log(`Frontend exited with code ${code}`);
    }
  });
  child.on('error', (error) => {
    log(`Frontend failed to start: ${error.message}`);
  });
  writePid(frontendPidFile, child.pid);
  return child.pid;
}

async function stopProcess(filePath) {
  const pid = readPid(filePath);
  if (!pid || !isProcessRunning(pid)) {
    if (existsSync(filePath)) {
      try {
        unlinkSync(filePath);
      } catch {}
    }
    return false;
  }
  try {
    process.kill(pid);
    return true;
  } catch {
    return false;
  }
}

async function stopAll() {
  const frontendStopped = await stopProcess(frontendPidFile);
  const backendStopped = await stopProcess(backendPidFile);
  log(frontendStopped ? 'Frontend stopped' : 'Frontend already stopped');
  log(backendStopped ? 'Backend stopped' : 'Backend already stopped');
}

async function showStatus() {
  const frontendPid = readPid(frontendPidFile);
  const backendPid = readPid(backendPidFile);
  const frontendRunning = frontendPid ? isProcessRunning(frontendPid) : false;
  const backendRunning = backendPid ? isProcessRunning(backendPid) : false;
  console.log(JSON.stringify({
    frontend: { running: frontendRunning, pid: frontendPid, url: frontendUrl },
    backend: { running: backendRunning, pid: backendPid, url: backendUrl },
  }, null, 2));
}

async function main() {
  const args = new Set(process.argv.slice(2));
  if (args.has('--stop')) {
    await stopAll();
    return;
  }

  if (args.has('--status')) {
    await showStatus();
    return;
  }

  await mkdir(rootDir, { recursive: true });
  const backendPid = await startBackend();
  const frontendPid = await startFrontend();

  const backendReady = backendPid ? await waitForUrl(backendUrl, 20000) : false;
  const frontendReady = frontendPid ? await waitForUrl(frontendUrl, 20000) : false;

  log(`Backend ready: ${backendReady}`);
  log(`Frontend ready: ${frontendReady}`);
  if (!backendReady || !frontendReady) {
    process.exitCode = 1;
  }
}

const isDirectExecution = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectExecution) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
