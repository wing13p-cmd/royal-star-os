import fs from "node:fs/promises";
import path from "node:path";

const SCHEMA_VERSION = 1;

function createProviderTelemetryStore(options = {}) {
  const filePath = options.filePath;
  const recoveryPath = `${filePath}.recovery`;
  const maxHistoryEntries = Number(options.maxHistoryEntries || 25);
  const maxCacheEntries = Number(options.maxCacheEntries || 50);
  let writeQueue = Promise.resolve();

  const emptyState = () => ({ schemaVersion: SCHEMA_VERSION, writtenAt: null, history: [], service: { sessions: [], cache: [], usage: {} } });

  function normalizeState(raw = {}) {
    if (Number(raw.schemaVersion || 0) > SCHEMA_VERSION) return null;
    const state = {
      schemaVersion: SCHEMA_VERSION,
      writtenAt: raw.writtenAt || null,
      history: Array.isArray(raw.history) ? raw.history.slice(-maxHistoryEntries) : [],
      service: {
        sessions: Array.isArray(raw.service?.sessions) ? raw.service.sessions.slice(-25) : [],
        cache: Array.isArray(raw.service?.cache) ? raw.service.cache.slice(-maxCacheEntries) : [],
        usage: raw.service?.usage && typeof raw.service.usage === "object" ? raw.service.usage : {},
      },
    };
    const now = Date.now();
    state.service.cache = state.service.cache.filter((entry) => Number(entry.expiresAt || 0) > now && entry.cacheKey && entry.value);
    return state;
  }

  async function readCandidate(candidatePath) {
    try {
      const parsed = JSON.parse(await fs.readFile(candidatePath, "utf8"));
      return normalizeState(parsed);
    } catch {
      return null;
    }
  }

  async function load() {
    const primary = await readCandidate(filePath);
    if (primary) return primary;
    const recovery = await readCandidate(recoveryPath);
    return recovery || emptyState();
  }

  async function writeNow(state) {
    const normalized = normalizeState(state) || emptyState();
    normalized.writtenAt = new Date().toISOString();
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    const tempPath = `${filePath}.${process.pid}.${Date.now()}.${Math.random().toString(16).slice(2)}.tmp`;
    const content = `${JSON.stringify(normalized, null, 2)}\n`;
    const handle = await fs.open(tempPath, "w");
    try {
      await handle.writeFile(content, "utf8");
      await handle.sync();
    } finally {
      await handle.close();
    }
    const existingPrimary = await readCandidate(filePath);
    if (existingPrimary) {
      try { await fs.copyFile(filePath, recoveryPath); } catch { /* retain the prior recovery copy */ }
    }
    try {
      await fs.rename(tempPath, filePath);
    } catch (error) {
      await fs.rm(tempPath, { force: true }).catch(() => {});
      throw error;
    }
    return normalized;
  }

  function persist(state) {
    writeQueue = writeQueue.then(() => writeNow(state));
    return writeQueue;
  }

  return { load, persist, emptyState, schemaVersion: SCHEMA_VERSION, filePath, recoveryPath };
}

export { createProviderTelemetryStore, SCHEMA_VERSION };
export default createProviderTelemetryStore;
