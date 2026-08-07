import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const DEFAULT_VAULT_PATH = path.join(process.cwd(), "server", "data", "provider-credentials.json");
const DEFAULT_MASTER_SECRET_ENV = "RSOS_MASTER_SECRET";

function normalizeText(value) {
  return value === undefined || value === null ? "" : String(value).trim();
}

function maskSecret(value = "") {
  const text = normalizeText(value);
  if (!text) return "not-set";
  if (text.length <= 4) return `${"*".repeat(text.length)}`;
  return `${"*".repeat(Math.max(2, text.length - 2))}${text.slice(-2)}`;
}

function sanitizeRecord(record = {}) {
  return {
    provider: normalizeText(record.provider),
    configured: Boolean(record.configured),
    status: normalizeText(record.status),
    lastTestedAt: normalizeText(record.lastTestedAt),
    rotationDueAt: normalizeText(record.rotationDueAt),
    requiresReEntry: Boolean(record.requiresReEntry),
    metadata: record.metadata || {},
    hasSecret: Boolean(record.hasSecret),
  };
}

function createVaultState() {
  return {
    version: 1,
    providers: {},
    updatedAt: new Date().toISOString(),
  };
}

function readVaultFile(filePath = DEFAULT_VAULT_PATH) {
  try {
    const content = fs.readFileSync(filePath, "utf8");
    return JSON.parse(content);
  } catch {
    return createVaultState();
  }
}

function writeVaultFile(filePath = DEFAULT_VAULT_PATH, state = createVaultState()) {
  const candidatePaths = [filePath];
  const fallbackPath = path.join(process.cwd(), "server", "data", "provider-credentials.json");
  if (filePath !== fallbackPath) candidatePaths.push(fallbackPath);
  const tempPath = path.join(os.tmpdir(), "rsos-provider-credentials.json");
  if (!candidatePaths.includes(tempPath)) candidatePaths.push(tempPath);

  let lastError;
  for (const candidatePath of candidatePaths) {
    try {
      fs.mkdirSync(path.dirname(candidatePath), { recursive: true });
      fs.writeFileSync(candidatePath, JSON.stringify(state, null, 2));
      return candidatePath;
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError || new Error("Unable to write vault state");
}

class LocalCredentialVault {
  constructor(options = {}) {
    this.filePath = options.filePath || DEFAULT_VAULT_PATH;
    this.masterSecret = normalizeText(options.masterSecret || process.env[DEFAULT_MASTER_SECRET_ENV] || "");
    this.storageAvailable = Boolean(options.storageAvailable !== false);
    this.state = createVaultState();
    this.load();
  }

  load() {
    if (!this.storageAvailable) return this.state;
    try {
      this.state = readVaultFile(this.filePath);
      if (!this.state || typeof this.state !== "object") this.state = createVaultState();
      if (!this.state.providers || typeof this.state.providers !== "object") this.state.providers = {};
      this.state.updatedAt = this.state.updatedAt || new Date().toISOString();
      return this.state;
    } catch {
      this.state = createVaultState();
      return this.state;
    }
  }

  save() {
    if (!this.storageAvailable) return { ok: false, reason: "storage-unavailable" };
    try {
      this.state.updatedAt = new Date().toISOString();
      const resolvedPath = writeVaultFile(this.filePath, this.state);
      this.filePath = resolvedPath;
      return { ok: true };
    } catch {
      return { ok: false, reason: "write-failed" };
    }
  }

  getProviderRecord(provider) {
    const normalized = normalizeText(provider).toLowerCase();
    return this.state.providers[normalized] || null;
  }

  listProviders() {
    return Object.keys(this.state.providers || {}).map((provider) => sanitizeRecord(this.state.providers[provider]));
  }

  upsertCredential(provider, values = {}) {
    const normalized = normalizeText(provider).toLowerCase();
    const existing = this.state.providers[normalized] || {};
    const nextRecord = {
      ...existing,
      provider: normalized,
      configured: Boolean(values.configured !== false),
      status: normalizeText(values.status || existing.status || "Not Configured"),
      lastTestedAt: normalizeText(values.lastTestedAt || existing.lastTestedAt || ""),
      rotationDueAt: normalizeText(values.rotationDueAt || existing.rotationDueAt || ""),
      requiresReEntry: Boolean(values.requiresReEntry || existing.requiresReEntry),
      metadata: { ...(existing.metadata || {}), ...(values.metadata || {}) },
      hasSecret: Boolean(values.secret || existing.secret || existing.hasSecret),
      secret: values.secret ? String(values.secret) : existing.secret || "",
      secretMasked: maskSecret(values.secret || existing.secret || ""),
    };

    this.state.providers[normalized] = nextRecord;
    return this.save();
  }

  removeCredential(provider) {
    const normalized = normalizeText(provider).toLowerCase();
    delete this.state.providers[normalized];
    return this.save();
  }

  maskStatus(provider) {
    const record = this.getProviderRecord(provider);
    if (!record) return { configured: false, hasSecret: false, status: "Not Configured", secretMasked: "not-set" };
    return {
      configured: Boolean(record.configured),
      hasSecret: Boolean(record.hasSecret),
      status: normalizeText(record.status || "Not Configured"),
      secretMasked: maskSecret(record.secret || ""),
      lastTestedAt: normalizeText(record.lastTestedAt || ""),
      rotationDueAt: normalizeText(record.rotationDueAt || ""),
    };
  }

  validateProviderConfig(provider, schema = {}) {
    const normalized = normalizeText(provider).toLowerCase();
    const record = this.getProviderRecord(normalized) || {};
    const missing = [];
    const requiredSecrets = Array.isArray(schema.requiredSecrets) ? schema.requiredSecrets : [];
    const requiredNonSecrets = Array.isArray(schema.requiredNonSecrets) ? schema.requiredNonSecrets : [];

    for (const field of requiredSecrets) {
      if (!normalizeText(record.metadata?.[field] || record[field])) missing.push(field);
    }
    for (const field of requiredNonSecrets) {
      if (!normalizeText(record.metadata?.[field] || record[field])) missing.push(field);
    }

    return {
      provider: normalized,
      complete: missing.length === 0,
      missing,
      status: missing.length === 0 ? "Configuration Ready" : "Configuration Incomplete",
    };
  }
}

function createLocalCredentialVault(options = {}) {
  return new LocalCredentialVault(options);
}

export { LocalCredentialVault, createLocalCredentialVault, maskSecret, sanitizeRecord };
export default createLocalCredentialVault;
