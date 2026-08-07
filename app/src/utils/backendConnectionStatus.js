import { buildApiUrl } from "./apiClient.js";

function safeString(value, fallback = "Insufficient Data") {
  if (value === null || value === undefined || value === "") return fallback;
  return typeof value === "string" ? value : String(value);
}

function parsePortFromApiUrl() {
  try {
    const healthUrl = buildApiUrl("/api/health");
    const parsed = new URL(healthUrl, typeof window !== "undefined" ? window.location.origin : "https://rsos.invalid");
    return parsed.port ? Number(parsed.port) : (parsed.protocol === "https:" ? 443 : 80);
  } catch {
    return 3001;
  }
}

async function timedJson(path) {
  const startedAt = Date.now();
  try {
    const response = await fetch(buildApiUrl(path));
    const durationMs = Date.now() - startedAt;
    if (!response.ok) {
      return { ok: false, status: response.status, data: null, durationMs };
    }
    const data = await response.json();
    return { ok: true, status: response.status, data, durationMs };
  } catch {
    return { ok: false, status: 0, data: null, durationMs: Date.now() - startedAt };
  }
}

function resolvePersistenceState(runtimePayload, healthPayload) {
  if (runtimePayload?.persistenceState) return safeString(runtimePayload.persistenceState, "Insufficient Data");
  const files = healthPayload?.dataFiles || {};
  const flags = Object.values(files);
  if (!flags.length) return "Insufficient Data";
  return flags.every(Boolean) ? "Ready" : "Degraded";
}

function resolveLastVerification(runtimePayload, operationsPayload) {
  if (runtimePayload?.lastVerificationResult) return safeString(runtimePayload.lastVerificationResult, "Insufficient Data");
  const stamp = operationsPayload?.monitoring?.lastVerificationTime || operationsPayload?.monitoring?.lastSuccessfulExecution;
  if (!stamp) return "Insufficient Data";
  return `Healthy (${stamp})`;
}

export async function fetchBackendConnectionStatus(options = {}) {
  const [health, monitoring, operations, diagnosticsHistory, runtimeStatus] = await Promise.all([
    timedJson("/api/health"),
    timedJson("/api/monitoring"),
    timedJson("/api/operations"),
    timedJson("/api/enterprise/diagnostics/history"),
    timedJson("/api/runtime-status"),
  ]);

  const runtimePayload = runtimeStatus?.data || null;
  const healthPayload = health?.data || null;
  const monitoringPayload = monitoring?.data || null;
  const operationsPayload = operations?.data || null;
  const diagnostics = Array.isArray(diagnosticsHistory?.data?.history) ? diagnosticsHistory.data.history : [];

  const backendPort = Number(runtimePayload?.backendPort || parsePortFromApiUrl());
  const apiHealthStatus = runtimePayload?.apiHealthStatus
    || (healthPayload?.status === "ok" || healthPayload?.healthy === true ? "ok" : "unhealthy");
  const backendHealthy = String(apiHealthStatus).toLowerCase() === "ok" || runtimePayload?.backendStatus === "Healthy";

  const listenerCount = runtimePayload?.listenerCount
    ?? (monitoringPayload?.summary?.processId ? 1 : "Insufficient Data");

  const lastBackupTimestamp = runtimePayload?.lastBackupTimestamp
    || diagnostics.find((entry) => String(entry?.checks?.summary?.status || "").toLowerCase().includes("backup"))?.timestamp
    || "Insufficient Data";

  const responseTimeMs = runtimePayload?.responseTimeMs
    ?? health.durationMs
    ?? monitoring.durationMs
    ?? operations.durationMs
    ?? 0;

  const latestSuccess = runtimePayload?.lastSuccessfulResponse
    || healthPayload?.timestamp
    || monitoringPayload?.timestamp
    || operationsPayload?.monitoring?.lastSuccessfulExecution
    || "Insufficient Data";

  const fallbackSource = Array.isArray(options.fallbackStorageKeys) && options.fallbackStorageKeys.length
    ? `localStorage ${options.fallbackStorageKeys.join("/")}`
    : "localStorage";

  return {
    frontendStatus: safeString(options.frontendStatus || "Online", "Online"),
    backendStatus: runtimePayload?.backendStatus || (backendHealthy ? "Healthy" : "Offline"),
    rsosOwnership: safeString(runtimePayload?.rsosOwnership || (healthPayload?.service === "rsos-backend" ? "RSOS-owned" : "Insufficient Data")),
    backendPort: Number.isFinite(backendPort) ? backendPort : "Insufficient Data",
    apiHealthStatus: safeString(apiHealthStatus, "Insufficient Data"),
    listenerCount,
    responseTimeMs,
    lastSuccessfulResponse: safeString(latestSuccess, "Insufficient Data"),
    persistenceState: resolvePersistenceState(runtimePayload, healthPayload),
    dataDirectoryState: safeString(runtimePayload?.dataDirectoryState || (healthPayload?.dataDirectory ? "Ready" : "Missing"), "Insufficient Data"),
    lastVerificationResult: resolveLastVerification(runtimePayload, operationsPayload),
    lastBackupTimestamp,
    primarySource: safeString(options.primarySource || options.primaryEndpoint || "Insufficient Data"),
    fallbackSource,
    recordCount: Number.isFinite(Number(options.recordCount)) ? Number(options.recordCount) : "Insufficient Data",
    diagnosticsStatus: diagnostics[0]?.status || "Insufficient Data",
  };
}
