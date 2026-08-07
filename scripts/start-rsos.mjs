import { spawn, spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const appDir = path.join(rootDir, 'app');
const serverDir = path.join(rootDir, 'server');
const frontendHost = '127.0.0.1';
const frontendPort = resolvePortValue(process.env.RSOS_FRONTEND_PORT || process.env.FRONTEND_PORT || process.env.VITE_PORT, 4173);
const frontendCandidatePorts = Array.from(new Set([frontendPort, 4173, 5173]));
const frontendUrl = `http://${frontendHost}:${frontendPort}`;
const backendPort = resolvePortValue(process.env.PORT, 3001);
const backendUrl = `http://127.0.0.1:${backendPort}/api/health`;
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

function resolvePortValue(value, fallback) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export function isRsosProcessCommand(command = '') {
  const normalized = normalizePath(command);
  if (!normalized) return false;

  return /(?:^|\/)server\/index\.js(?:\s|$)/.test(normalized)
    || /(?:^|\/)app\/node_modules(?:\/\.bin)?\/vite(?:\.js)?(?:\s|$)/.test(normalized)
    || /(?:^|\/)app\/node_modules(?:\/\.bin)?\/v(?:ite)?(?:\s|$)/.test(normalized)
    || /(?:^|\/)vite\/bin\/vite\.js(?:\s|$)/.test(normalized)
    || /(?:^|\/)index\.js(?:\s|$)/.test(normalized)
    || /(?:^|\/)vite(?:\.js)?(?:\s|$)/.test(normalized)
    || /(^|\s)node\s+server\/index\.js(?:\s|$)/.test(normalized)
    || /(^|\s)node\s+index\.js(?:\s|$)/.test(normalized);
}

function readPid(filePath) {
  if (!existsSync(filePath)) return null;
  const value = readFileSync(filePath, 'utf8').trim();
  if (!value) return null;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function writePid(filePath, pid) {
  if (!pid) return;
  writeFileSync(filePath, String(pid), 'utf8');
}

function isProcessRunning(pid) {
  if (!pid) return false;
  try {
    const result = spawnSync('lsof', ['-a', '-p', String(pid), '-d', 'cwd'], { encoding: 'utf8' });
    if (result.status === 0) {
      return true;
    }
  } catch {
    // fall through to signal check
  }

  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function removePidFile(filePath) {
  if (!existsSync(filePath)) return;
  try {
    unlinkSync(filePath);
  } catch {
    // ignore cleanup failures
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

function getProcessWorkingDirectory(pid) {
  if (!pid) return '';
  try {
    const result = spawnSync('lsof', ['-a', '-p', String(pid), '-d', 'cwd', '-Fn'], { encoding: 'utf8' });
    if (result.status !== 0) return '';
    const entry = String(result.stdout || '')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find((line) => line.startsWith('n'));
    return entry ? entry.slice(1).trim() : '';
  } catch {
    return '';
  }
}

function isProcessInRsosWorkspace(pid) {
  const cwd = normalizePath(getProcessWorkingDirectory(pid));
  const normalizedRoot = normalizePath(rootDir);
  if (!cwd || !normalizedRoot) return false;
  return cwd === normalizedRoot || cwd.startsWith(`${normalizedRoot}/`);
}

function isRsosListenerPid(pid) {
  const command = getProcessCommand(pid);
  const normalizedCommand = normalizePath(String(command || '')).toLowerCase();
  if (isProcessInRsosWorkspace(pid)) return true;
  if (isRsosProcessCommand(command)) return true;
  if (normalizedCommand.includes('rsos') || normalizedCommand.includes('royal star os') || normalizedCommand.includes('royal')) return true;
  return false;
}

async function probeHealthWithFetch(url) {
  try {
    const response = await fetch(url);
    if (!response.ok) return { ok: false, rsosService: false };
    const body = await response.text();
    const normalizedBody = String(body || '').trim();
    if (!normalizedBody) return { ok: true, rsosService: false };
    try {
      const payload = JSON.parse(normalizedBody);
      const service = String(payload?.service || '').toLowerCase();
      const rsosService = service === 'rsos-backend' || service.includes('rsos');
      return { ok: true, rsosService, method: 'fetch' };
    } catch {
      // Non-JSON body is still a reachable healthy endpoint for frontend probes.
      return { ok: true, rsosService: false, method: 'fetch' };
    }
  } catch (error) {
    return { ok: false, rsosService: false, method: 'fetch', error: String(error?.message || error || 'fetch failed') };
  }
}

async function probeHealthWithHttp(url) {
  return await new Promise((resolve) => {
    let settled = false;
    const done = (result) => {
      if (settled) return;
      settled = true;
      resolve(result);
    };

    try {
      const request = http.get(url, { timeout: 2500 }, (response) => {
        let body = '';
        response.setEncoding('utf8');
        response.on('data', (chunk) => {
          body += chunk;
        });
        response.on('end', () => {
          const ok = Number(response.statusCode || 0) >= 200 && Number(response.statusCode || 0) < 300;
          if (!ok) {
            done({ ok: false, rsosService: false, method: 'http', error: `status ${response.statusCode || 0}` });
            return;
          }

          const trimmed = String(body || '').trim();
          if (!trimmed) {
            done({ ok: true, rsosService: false, method: 'http' });
            return;
          }

          try {
            const payload = JSON.parse(trimmed);
            const service = String(payload?.service || '').toLowerCase();
            const rsosService = service === 'rsos-backend' || service.includes('rsos');
            done({ ok: true, rsosService, method: 'http' });
          } catch {
            done({ ok: true, rsosService: false, method: 'http' });
          }
        });
      });

      request.on('timeout', () => {
        request.destroy(new Error('timeout'));
      });

      request.on('error', (error) => {
        done({ ok: false, rsosService: false, method: 'http', error: String(error?.message || error || 'http probe failed') });
      });
    } catch (error) {
      done({ ok: false, rsosService: false, method: 'http', error: String(error?.message || error || 'http probe failed') });
    }
  });
}

function probeHealthWithCurl(url) {
  try {
    const curlCandidates = ['curl', '/usr/bin/curl', '/opt/homebrew/bin/curl'];
    let curlResult = null;
    for (const candidate of curlCandidates) {
      const attempt = spawnSync(candidate, ['-sS', '--max-time', '2', url], { encoding: 'utf8' });
      if (!attempt.error) {
        curlResult = attempt;
        break;
      }
    }
    if (!curlResult) return { ok: false, rsosService: false, method: 'curl', error: 'curl unavailable' };
    if (curlResult.status !== 0) return { ok: false, rsosService: false, method: 'curl', error: String(curlResult.stderr || `curl exit ${curlResult.status}`) };
    const body = String(curlResult.stdout || '').trim();
    if (!body) return { ok: false, rsosService: false, method: 'curl', error: 'empty response' };
    try {
      const payload = JSON.parse(body);
      const service = String(payload?.service || '').toLowerCase();
      const rsosService = service === 'rsos-backend' || service.includes('rsos');
      return { ok: true, rsosService, method: 'curl' };
    } catch {
      // Non-JSON body is still a reachable healthy endpoint for frontend probes.
      return { ok: true, rsosService: false, method: 'curl' };
    }
  } catch (error) {
    return { ok: false, rsosService: false, method: 'curl', error: String(error?.message || error || 'curl failed') };
  }
}

async function inspectPortState(port, healthUrl) {
  const listenerPids = getListeningPidsForPort(port);
  const listenersOwnedByRsos = listenerPids.some((listenerPid) => isRsosListenerPid(listenerPid));
  const health = listenerPids.length > 0 ? await probeHealth(healthUrl) : { ok: false, rsosService: false, method: 'none', error: '' };
  const sandboxBlocked = !health.ok && /EPERM|Operation not permitted/i.test(String(health.error || ''));
  const inferredHealthy = sandboxBlocked && listenerPids.length > 0 && listenersOwnedByRsos;
  const normalizedHealth = inferredHealthy
    ? { ok: true, rsosService: true, method: 'sandbox-fallback', error: '' }
    : health;
  const healthy = normalizedHealth.ok;
  return {
    port,
    healthUrl,
    listenerPids,
    healthy,
    rsosService: normalizedHealth.rsosService,
    probeMethod: normalizedHealth.method || 'none',
    probeError: normalizedHealth.error || '',
    listenersOwnedByRsos,
  };
}

async function probeHealth(url) {
  const httpProbe = await probeHealthWithHttp(url);
  if (httpProbe.ok) return httpProbe;

  const fetchProbe = await probeHealthWithFetch(url);
  if (fetchProbe.ok) return fetchProbe;
  const curlProbe = probeHealthWithCurl(url);
  if (curlProbe.ok) {
    return {
      ...curlProbe,
      method: 'curl-fallback',
      error: `${httpProbe.error || 'http probe failed'}${fetchProbe.error ? ` | ${fetchProbe.error}` : ''}`,
    };
  }
  return {
    ...curlProbe,
    method: 'http+fetch+curl',
    error: `${httpProbe.error || 'http probe failed'} | ${fetchProbe.error || 'fetch probe failed'} | ${curlProbe.error || 'curl probe failed'}`,
  };
}

export function classifyServiceStatus({ pid, pidFileExists, pidRunning, listenerPids, healthy, label = 'service' }) {
  const hasListeners = listenerPids.length > 0;
  const listenersOwnedByRsos = listenerPids.some((listenerPid) => isRsosListenerPid(listenerPid));
  const stalePid = pidFileExists && (!pid || !pidRunning);

  if (healthy && (pidRunning || hasListeners)) {
    return {
      status: `${label} running and healthy`,
      listenersOwnedByRsos,
      stalePid,
    };
  }

  if (hasListeners && !listenersOwnedByRsos) {
    return {
      status: 'listener exists but not RSOS-owned',
      listenersOwnedByRsos,
      stalePid,
    };
  }

  if (hasListeners && listenersOwnedByRsos && !healthy) {
    return {
      status: 'port conflict',
      listenersOwnedByRsos,
      stalePid,
    };
  }

  if (hasListeners) {
    return {
      status: 'occupied port',
      listenersOwnedByRsos,
      stalePid,
    };
  }

  if (stalePid) {
    return {
      status: 'stale pid',
      listenersOwnedByRsos,
      stalePid,
    };
  }

  return {
    status: `${label} stopped`,
    listenersOwnedByRsos,
    stalePid,
  };
}

async function inspectServiceState(label, port, url, pidFile) {
  const pidFileExists = existsSync(pidFile);
  const pid = readPid(pidFile);
  const pidRunning = isProcessRunning(pid);
  const stalePid = pidFileExists && (!pid || !pidRunning);
  const isFrontend = label === 'frontend';
  const frontendListeningPorts = isFrontend
    ? frontendCandidatePorts.filter((candidatePort) => getListeningPidsForPort(candidatePort).length > 0)
    : [];
  const candidatePorts = isFrontend
    ? Array.from(new Set([port, ...frontendListeningPorts]))
    : [port];
  const probes = [];
  for (const candidatePort of candidatePorts) {
    const healthUrl = isFrontend ? `http://${frontendHost}:${candidatePort}` : `http://127.0.0.1:${candidatePort}/api/health`;
    probes.push(await inspectPortState(candidatePort, healthUrl));
  }

  const managedProbe = probes.find((probe) => probe.port === port) || {
    port,
    healthUrl: url,
    listenerPids: [],
    healthy: false,
    listenersOwnedByRsos: false,
  };
  const healthyProbe = probes.find((probe) => probe.healthy && probe.listenerPids.length > 0) || null;
  const alternateListenerProbe = probes.find((probe) => probe.port !== port && probe.listenerPids.length > 0) || null;
  const allListenerPids = Array.from(new Set(probes.flatMap((probe) => probe.listenerPids)));
  const listenersOwnedByRsos = allListenerPids.some((listenerPid) => isRsosListenerPid(listenerPid));
  const pidOwnedByManager = pidRunning;

  if (stalePid) {
    removePidFile(pidFile);
  }

  let status = `${label} stopped`;
  if (pidOwnedByManager && allListenerPids.includes(pid)) {
    status = `${label} running and RSOS-owned`;
  } else if (pidOwnedByManager && allListenerPids.length > 0 && !allListenerPids.includes(pid)) {
    status = 'port conflict';
  } else if (pidOwnedByManager && allListenerPids.length === 0) {
    status = `${label} process running without active listener`;
  } else if (managedProbe.listenerPids.length > 0 && listenersOwnedByRsos) {
    status = `${label} running but unmanaged`;
  } else if (managedProbe.listenerPids.length > 0 && !listenersOwnedByRsos) {
    status = 'listener exists but not RSOS-owned';
  } else if (alternateListenerProbe) {
    status = isRsosListenerPid(alternateListenerProbe.listenerPids[0])
      ? `${label} running but unmanaged on alternate port ${alternateListenerProbe.port}`
      : `listener exists on alternate port ${alternateListenerProbe.port} but not RSOS-owned`;
  } else if (stalePid) {
    status = 'stale pid';
  }

  const activePid = pidOwnedByManager ? pid : null;
  const rsosListenerPid = allListenerPids.find((listenerPid) => isRsosListenerPid(listenerPid)) || null;
  const detectedPort = healthyProbe ? healthyProbe.port : (managedProbe.listenerPids.length > 0 ? managedProbe.port : (alternateListenerProbe ? alternateListenerProbe.port : null));

  if (!activePid && rsosListenerPid) {
    writePid(pidFile, rsosListenerPid);
  }

  return {
    name: label,
    status,
    running: status.startsWith(`${label} running`) || status.startsWith('healthy listener exists'),
    pid: activePid || rsosListenerPid,
    stalePid,
    occupiedPort: allListenerPids.length > 0,
    listenersOwnedByRsos,
    listenerPids: allListenerPids,
    managedPort: port,
    detectedPort,
    probes: probes.map((probe) => ({
      port: probe.port,
      healthUrl: probe.healthUrl,
      healthy: probe.healthy,
      rsosService: probe.rsosService,
      probeMethod: probe.probeMethod,
      probeError: probe.probeError,
      listenerCount: probe.listenerPids.length,
    })),
    port,
    url,
  };
}

async function waitForUrl(url, timeoutMs = 20000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await isHealthy(url)) return true;
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
  const probe = await probeHealth(url);
  return probe.ok;
}

async function ensureHealthyExistingProcess(port, url, pidFile, label) {
  const existingPid = readPid(pidFile);
  if (existsSync(pidFile) && (!existingPid || !isProcessRunning(existingPid))) {
    log(`Clearing stale ${label} pid file`);
    removePidFile(pidFile);
  }

  if (existingPid && isProcessRunning(existingPid)) {
    if (await isHealthy(url)) {
      log(`${label} already healthy with pid ${existingPid}`);
      return { pid: existingPid, reused: true };
    } else {
      log(`Stopping stale ${label} pid ${existingPid}`);
      try {
        process.kill(existingPid);
      } catch {
        // ignore and continue
      }
    }
  }

  const listeningPids = getListeningPidsForPort(port);
  if (listeningPids.length) {
    for (const pid of listeningPids) {
      if (!isRsosListenerPid(pid)) {
        const command = getProcessCommand(pid);
        log(`${label} port ${port} is occupied by pid ${pid} (${command || 'unknown'}) which does not look like RSOS`);
        continue;
      }
      if (await isHealthy(url)) {
        log(`${label} adopting existing RSOS listener on port ${port} via pid ${pid}`);
        writePid(pidFile, pid);
        return { pid, reused: true };
      }
      log(`Stopping unhealthy ${label} listener on port ${port} via pid ${pid}`);
      try {
        process.kill(pid);
      } catch {
        // ignore and continue to evaluate remaining listeners
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
      removePidFile(pidFile);
    } else {
      log(`${label} could not start because port ${port} is already occupied by another process`);
      return { pid: null, reused: false };
    }
  }

  return { pid: null, reused: false };
}

async function detectEarlyPortCollision(child, port, label, timeoutMs = 1500) {
  return await new Promise((resolve) => {
    let settled = false;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };

    const timer = setTimeout(() => {
      finish('started');
    }, timeoutMs);

    child.once('exit', () => {
      clearTimeout(timer);
      const listeners = getListeningPidsForPort(port);
      if (listeners.length > 0) {
        log(`${label} detected occupied port ${port} during startup (graceful EADDRINUSE handling)`);
        finish('occupied-port');
        return;
      }
      finish('exited');
    });

    child.once('error', () => {
      clearTimeout(timer);
      finish('exited');
    });
  });
}

async function startBackend() {
  const existing = await ensureHealthyExistingProcess(backendPort, backendUrl, backendPidFile, 'backend');
  if (existing.reused && existing.pid) return existing.pid;
  if (!existing.reused && existing.pid === null && getListeningPidsForPort(backendPort).length) {
    return null;
  }

  log(`Starting backend on port ${backendPort}`);
  const child = runCommand(process.execPath, [path.join(serverDir, 'index.js')], {
    env: {
      ...process.env,
      PORT: String(backendPort),
    },
  });
  child.on('exit', (code) => {
    if (code !== 0) {
      log(`Backend exited with code ${code}`);
    }
  });
  child.on('error', (error) => {
    log(`Backend failed to start: ${error.message}`);
  });
  writePid(backendPidFile, child.pid);
  const startupResult = await detectEarlyPortCollision(child, backendPort, 'backend');
  if (startupResult === 'occupied-port') {
    removePidFile(backendPidFile);
    return null;
  }
  return child.pid;
}

async function startFrontend() {
  const existing = await ensureHealthyExistingProcess(frontendPort, frontendUrl, frontendPidFile, 'frontend');
  if (existing.reused && existing.pid) return existing.pid;
  if (!existing.reused && existing.pid === null && getListeningPidsForPort(frontendPort).length) {
    return null;
  }

  log(`Starting frontend on port ${frontendPort}`);
  const child = runCommand(process.execPath, [path.join(appDir, 'node_modules', 'vite', 'bin', 'vite.js'), '--host', frontendHost, '--port', String(frontendPort)], {
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
  const startupResult = await detectEarlyPortCollision(child, frontendPort, 'frontend');
  if (startupResult === 'occupied-port') {
    removePidFile(frontendPidFile);
    return null;
  }
  return child.pid;
}

async function stopProcess(filePath) {
  const pid = readPid(filePath);
  if (!pid || !isProcessRunning(pid)) {
    removePidFile(filePath);
    return false;
  }
  try {
    process.kill(pid);
    return true;
  } catch {
    return false;
  }
}

async function stopPortListeners(port, pidFile) {
  const stoppedPids = [];
  const pid = readPid(pidFile);
  if (pid && isProcessRunning(pid)) {
    try {
      process.kill(pid);
      stoppedPids.push(pid);
    } catch {
      // ignore and continue to listener sweep
    }
  }

  for (const listenerPid of getListeningPidsForPort(port)) {
    if (!isRsosListenerPid(listenerPid)) continue;
    if (stoppedPids.includes(listenerPid)) continue;
    try {
      process.kill(listenerPid);
      stoppedPids.push(listenerPid);
    } catch {
      // ignore and continue cleanup
    }
  }

  removePidFile(pidFile);
  return stoppedPids.length > 0;
}

async function stopAll() {
  const frontendStopped = await stopPortListeners(frontendPort, frontendPidFile);
  const backendStopped = await stopPortListeners(backendPort, backendPidFile);
  log(frontendStopped ? 'Frontend stopped' : 'Frontend already stopped');
  log(backendStopped ? 'Backend stopped' : 'Backend already stopped');
}

async function showStatus() {
  const frontendState = await inspectServiceState('frontend', frontendPort, frontendUrl, frontendPidFile);
  const backendState = await inspectServiceState('backend', backendPort, backendUrl, backendPidFile);
  console.log(JSON.stringify({
    frontend: frontendState,
    backend: backendState,
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
