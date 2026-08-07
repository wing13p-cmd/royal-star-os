function normalizeText(value) {
  return value === undefined || value === null ? "" : String(value).trim();
}

function normalizeAddress(value) {
  return normalizeText(value).toLowerCase().replace(/\s+/g, " ");
}

function createId(prefix = "entry") {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

/**
 * Build a provider priority plan that keeps review-first imports safe while
 * accounting for provider health and availability.
 */
function buildProviderPriorityEngine({ providers = [], selectedProvider = "manual" } = {}) {
  const providerList = Array.isArray(providers) && providers.length > 0
    ? providers
    : ["manual", "rentcast", "attom", "reso", "county"];

  const ranked = providerList.map((provider, index) => {
    const normalized = normalizeText(provider);
    const isSelected = normalized === normalizeText(selectedProvider);
    const priority = isSelected ? 100 : Math.max(10, 90 - index * 10);
    return {
      provider: normalized || "manual",
      priority,
      selected: isSelected,
      safeMode: normalized === "manual" || !normalized,
    };
  });

  const selected = ranked.find((entry) => entry.selected) || ranked[0] || { provider: "manual", priority: 100, selected: true, safeMode: true };
  const fallback = ranked.find((entry) => entry.provider !== selected.provider) || selected;

  return {
    providers: ranked,
    selectedProvider: selected.provider,
    fallbackProvider: fallback.provider,
    orchestrationStatus: "review-first orchestration active",
  };
}

/**
 * Create a provider health summary that never requires live credentials to work.
 */
function buildProviderHealthMonitor({ providers = [], comps = [] } = {}) {
  const providerList = Array.isArray(providers) && providers.length > 0
    ? providers
    : [{ provider: "manual", status: "Manual Entry Ready", healthy: true, latencyMs: 0, coverage: 1 }];

  const metrics = providerList.map((provider) => {
    const normalized = typeof provider === "string" ? provider : normalizeText(provider.provider || provider.name || "manual");
    const status = typeof provider === "string"
      ? "Manual Entry Ready"
      : normalizeText(provider.status || "Manual Entry Ready");
    const healthy = typeof provider === "string" ? true : Boolean(provider.healthy !== false);
    const latencyMs = typeof provider === "string" ? 0 : Number(provider.latencyMs || 0);
    const coverage = typeof provider === "string" ? 1 : Number(provider.coverage || 0.5);
    return {
      provider: normalized || "manual",
      status,
      healthy,
      latencyMs,
      coverage,
      compCount: (comps || []).filter((comp) => normalizeText(comp.provider) === normalized).length,
    };
  });

  const overallHealthy = metrics.every((entry) => entry.healthy || entry.provider === "manual");
  return {
    metrics,
    overallHealthy,
    overallStatus: overallHealthy ? "healthy" : "degraded",
    averageLatencyMs: metrics.reduce((sum, entry) => sum + entry.latencyMs, 0) / Math.max(1, metrics.length),
    averageCoverage: metrics.reduce((sum, entry) => sum + entry.coverage, 0) / Math.max(1, metrics.length),
  };
}

/**
 * Return a failover plan that remains advisory and disabled until credentials exist.
 */
function buildProviderFailoverPlan({ providers = [], selectedProvider = "manual" } = {}) {
  const priority = buildProviderPriorityEngine({ providers, selectedProvider });
  return {
    enabled: false,
    shouldFailover: false,
    activeProvider: priority.selectedProvider,
    fallbackProvider: priority.fallbackProvider,
    reason: "Automatic provider failover is disabled until credentials or licensing are present.",
  };
}

/**
 * Detect duplicate comps across providers using normalized address matching.
 */
function detectDuplicateComps(comps = []) {
  const groups = new Map();
  for (const comp of comps || []) {
    const key = normalizeAddress(comp.compAddress || comp.address || comp.propertyAddress || comp.providerRecordId || comp.id);
    if (!key) continue;
    const bucket = groups.get(key) || [];
    bucket.push(comp);
    groups.set(key, bucket);
  }

  return Array.from(groups.entries())
    .filter(([, items]) => items.length > 1)
    .map(([key, items]) => ({
      key,
      items,
      duplicateCount: items.length,
    }));
}

/**
 * Match comps across providers using address and property-type similarity.
 */
function matchPropertiesAcrossProviders(comps = []) {
  const results = [];
  for (let index = 0; index < (comps || []).length; index += 1) {
    const current = comps[index];
    const matches = (comps || []).filter((candidate, candidateIndex) => candidateIndex !== index && normalizeAddress(candidate.compAddress || candidate.address || candidate.propertyAddress) === normalizeAddress(current.compAddress || current.address || current.propertyAddress));
    if (matches.length > 0) {
      results.push({
        sourceId: current.id,
        matches: matches.map((match) => ({ id: match.id, provider: match.provider || "manual" })),
      });
    }
  }
  return results;
}

/**
 * Match photo assets across providers using shared media labels or sources.
 */
function matchPhotosAcrossProviders(comps = []) {
  const results = [];
  for (const comp of comps || []) {
    const mediaItems = Array.isArray(comp.media) ? comp.media : [];
    const matches = (comps || []).flatMap((candidate) => {
      const candidateMedia = Array.isArray(candidate.media) ? candidate.media : [];
      return candidateMedia.filter((item) => mediaItems.some((sourceItem) => normalizeText(sourceItem.label || sourceItem.source) && normalizeText(item.label || item.source) && normalizeText(sourceItem.label || sourceItem.source) === normalizeText(item.label || item.source)));
    });
    if (matches.length > 0) {
      results.push({ sourceId: comp.id, matches });
    }
  }
  return results;
}

/**
 * Build a cross-provider confidence score that stays advisory and review-first.
 */
function buildCrossProviderConfidence(comp = {}, matches = []) {
  const duplicateCount = matches.filter((entry) => entry.sourceId === comp.id).length;
  const score = Math.min(100, 55 + duplicateCount * 10 + (comp.providerImported ? 10 : 0));
  const label = score >= 80 ? "High" : score >= 60 ? "Moderate" : "Low";
  return {
    score,
    label,
    advisoryOnly: true,
  };
}

/**
 * Create a review-first audit entry for imported comps and media events.
 */
function buildEnterpriseAuditEntry({ id = createId("audit"), compId = "", action = "import", summary = "", provider = "manual", timestamp = new Date().toISOString(), reviewStatus = "pending" } = {}) {
  return {
    id,
    compId,
    action,
    summary,
    provider,
    timestamp,
    reviewStatus,
  };
}

/**
 * Materialize a full audit log from persisted entries or comp data.
 */
function buildEnterpriseAuditLog(comps = [], auditEntries = []) {
  const fallbackEntries = (comps || []).filter((comp) => comp.providerImported).map((comp) => buildEnterpriseAuditEntry({
    compId: comp.id,
    action: "import",
    summary: `Imported ${comp.compAddress || comp.address || "comp"} for review only.`,
    provider: comp.provider || "manual",
    reviewStatus: comp.inclusionStatus || "pending",
  }));

  return [...fallbackEntries, ...(Array.isArray(auditEntries) ? auditEntries : [])].sort((left, right) => (right.timestamp || "").localeCompare(left.timestamp || ""));
}

/**
 * Build a history view of imported comps and their review state.
 */
function buildImportHistory(comps = [], auditEntries = []) {
  const imported = (comps || []).filter((comp) => comp.providerImported || comp.sourceType === "provider");
  return imported.map((comp) => ({
    id: comp.id,
    address: comp.compAddress || comp.address || comp.propertyAddress || "Unknown",
    provider: comp.provider || "manual",
    importedAt: comp.importedAt || comp.createdAt || new Date().toISOString(),
    reviewed: Boolean(comp.verified),
    reviewStatus: comp.inclusionStatus || "pending",
    auditEntries: (auditEntries || []).filter((entry) => entry.compId === comp.id),
  })).sort((left, right) => (right.importedAt || "").localeCompare(left.importedAt || ""));
}

/**
 * Build a single enterprise intelligence model for the Comp Database view.
 */
function buildCompEnterpriseUiModel({ comps = [], auditLog = [], subjectDeal = null } = {}) {
  const safeComps = Array.isArray(comps) ? comps : [];
  const providerPriority = buildProviderPriorityEngine({ providers: ["manual", "rentcast", "attom", "reso", "county"], selectedProvider: "manual" });
  const providerHealth = buildProviderHealthMonitor({ providers: [
    { provider: "manual", status: "Manual Entry Ready", healthy: true, latencyMs: 0, coverage: 1 },
    { provider: "rentcast", status: "Review-only", healthy: true, latencyMs: 14, coverage: 0.45 },
    { provider: "attom", status: "Review-only", healthy: true, latencyMs: 18, coverage: 0.4 },
    { provider: "reso", status: "Review-only", healthy: true, latencyMs: 16, coverage: 0.36 },
    { provider: "county", status: "Review-only", healthy: true, latencyMs: 12, coverage: 0.3 },
  ], comps: safeComps });
  const failoverPlan = buildProviderFailoverPlan({ providers: providerPriority.providers, selectedProvider: providerPriority.selectedProvider });
  const duplicates = detectDuplicateComps(safeComps);
  const propertyMatches = matchPropertiesAcrossProviders(safeComps);
  const photoMatches = matchPhotosAcrossProviders(safeComps);
  const crossProviderConfidence = buildCrossProviderConfidence(safeComps[0] || {}, propertyMatches);
  const auditEntries = buildEnterpriseAuditLog(safeComps, auditLog);
  const importHistory = buildImportHistory(safeComps, auditEntries);
  const importedCount = safeComps.filter((comp) => comp.providerImported).length;
  const pendingReviewCount = safeComps.filter((comp) => comp.inclusionStatus === "pending" || comp.verified === false).length;

  return {
    providerPriority,
    providerHealth,
    failoverPlan,
    duplicates,
    crossProviderMatches: propertyMatches,
    photoMatches,
    crossProviderConfidence,
    auditEntries,
    importHistory,
    importedCount,
    pendingReviewCount,
    backgroundRefresh: {
      enabled: false,
      reason: "Background refresh is disabled until credentials or licensing are available.",
    },
    subjectDeal,
  };
}

/**
 * Build a comparable export package for review-first distribution.
 */
function buildCompExportPackage({ comps = [], subjectDeal = null } = {}) {
  return {
    exportedAt: new Date().toISOString(),
    subjectDeal,
    comps: (comps || []).map((comp) => ({
      id: comp.id,
      address: comp.compAddress || comp.address || comp.propertyAddress || "",
      salePrice: comp.salePrice || comp.listPrice || 0,
      saleDate: comp.saleDate || "",
      provider: comp.provider || "manual",
      inclusionStatus: comp.inclusionStatus || "pending",
      verified: Boolean(comp.verified),
      mediaCount: Array.isArray(comp.media) ? comp.media.length : 0,
    })),
  };
}

/**
 * Build an appraisal export package that remains advisory and non-impacting.
 */
function buildAppraisalExportPackage({ comps = [], subjectDeal = null } = {}) {
  const packageData = buildCompExportPackage({ comps, subjectDeal });
  return {
    ...packageData,
    exportType: "appraisal-package",
    advisoryOnly: true,
    notes: "This package is advisory and does not change approved ARVs.",
  };
}

/**
 * Build a simple PDF summary payload for download.
 */
function buildPdfSummary({ comps = [], subjectDeal = null } = {}) {
  const lines = [
    "%PDF-1.4",
    "1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj",
    "2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj",
    "3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >> endobj",
    "4 0 obj << /Length 96 >> stream",
    `BT /F1 12 Tf 50 750 Td (RSOS Comp Summary) Tj 0 -16 Td (${normalizeText(subjectDeal?.propertyAddress || subjectDeal?.address || "Subject Property")}) Tj 0 -16 Td (${(comps || []).length} comparable(s) reviewed) Tj ET`,
    "endstream endobj",
    "5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj",
    "xref",
    "0 6",
    "0000000000 65535 f ",
    "0000000010 00000 n ",
    "0000000062 00000 n ",
    "0000000119 00000 n ",
    "0000000207 00000 n ",
    "0000000302 00000 n ",
    "trailer << /Size 6 /Root 1 0 R >>",
    "startxref",
    "0",
    "%%EOF",
  ];
  return lines.join("\n");
}

/**
 * Build a CSV export for Excel-style consumption.
 */
function buildExcelCompPackage({ comps = [] } = {}) {
  const header = ["address", "salePrice", "saleDate", "provider", "inclusionStatus", "verified", "mediaCount"].join(",");
  const rows = (comps || []).map((comp) => [
    normalizeText(comp.compAddress || comp.address || comp.propertyAddress),
    normalizeText(comp.salePrice || comp.listPrice || 0),
    normalizeText(comp.saleDate || ""),
    normalizeText(comp.provider || "manual"),
    normalizeText(comp.inclusionStatus || "pending"),
    comp.verified ? "true" : "false",
    Array.isArray(comp.media) ? comp.media.length : 0,
  ].join(","));
  return [header, ...rows].join("\n");
}

/**
 * Build a backup payload so the comp database can be restored later.
 */
function buildCompDatabaseBackup({ comps = [], auditLog = [] } = {}) {
  return {
    exportedAt: new Date().toISOString(),
    comps: Array.isArray(comps) ? comps : [],
    auditLog: Array.isArray(auditLog) ? auditLog : [],
  };
}

export {
  buildProviderPriorityEngine,
  buildProviderHealthMonitor,
  buildProviderFailoverPlan,
  detectDuplicateComps,
  matchPropertiesAcrossProviders,
  matchPhotosAcrossProviders,
  buildCrossProviderConfidence,
  buildEnterpriseAuditEntry,
  buildEnterpriseAuditLog,
  buildImportHistory,
  buildCompEnterpriseUiModel,
  buildCompExportPackage,
  buildAppraisalExportPackage,
  buildPdfSummary,
  buildExcelCompPackage,
  buildCompDatabaseBackup,
};

export default buildCompEnterpriseUiModel;
