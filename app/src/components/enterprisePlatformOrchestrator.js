function safeNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function safeString(value, fallback = "Insufficient Data") {
  if (value === null || value === undefined || value === "") return fallback;
  return typeof value === "string" ? value : String(value);
}

function normalizeArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function formatCurrency(value) {
  return `$${safeNumber(value, 0).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

function nowIso() {
  return new Date().toISOString();
}

function buildModuleExecutionStatus(name, payload = {}) {
  const modulePayload = normalizeObject(payload);
  return {
    module: name,
    status: modulePayload.status || "Ready",
    records: safeNumber(modulePayload.records, 0),
    latencyMs: safeNumber(modulePayload.latencyMs, 0),
    lastUpdatedAt: safeString(modulePayload.lastUpdatedAt, nowIso()),
    warnings: normalizeArray(modulePayload.warnings),
  };
}

function buildEnterpriseOrchestrationLayer(input = {}) {
  const moduleInputs = normalizeObject(input.moduleStatus);
  const modules = [
    "Acquisition",
    "Comparable Sales",
    "ARV",
    "Portfolio",
    "Rehab",
    "Contractors",
    "Lenders",
    "Capital",
    "Risk",
    "Knowledge Base",
    "Vendor Purchasing",
    "Forecasting",
    "Executive Dashboards",
  ].map((name) => buildModuleExecutionStatus(name, moduleInputs[name] || {}));

  const healthyCount = modules.filter((module) => module.status === "Ready" || module.status === "Healthy").length;
  const degradedCount = modules.filter((module) => module.status !== "Ready" && module.status !== "Healthy").length;

  return {
    workflowPreserved: true,
    modules,
    summary: {
      healthyCount,
      degradedCount,
      totalModules: modules.length,
      orchestrationStatus: degradedCount > 0 ? "Degraded" : "Healthy",
    },
  };
}

function normalizeSearchTerm(query) {
  return safeString(query, "").trim().toLowerCase();
}

function buildSearchRecord(id, label, type, module, detail, raw = {}) {
  return {
    id: safeString(id, `${type}-${Math.random().toString(36).slice(2, 8)}`),
    label: safeString(label, "Record"),
    type: safeString(type, "record"),
    module: safeString(module, "Command Center"),
    detail: safeString(detail, ""),
    raw: normalizeObject(raw),
  };
}

function collectSearchCorpus(input = {}) {
  const deals = normalizeArray(input.deals).map((deal, index) => buildSearchRecord(
    deal.id || `deal-${index + 1}`,
    deal.propertyAddress || deal.propertyName,
    "property",
    "Deal Analyzer",
    deal.status || deal.strategy || "Deal",
    deal,
  ));

  const properties = normalizeArray(input.properties).map((property, index) => buildSearchRecord(
    property.id || `property-${index + 1}`,
    property.propertyName || property.address,
    "portfolio-asset",
    "Portfolio Dashboard",
    property.status || property.recommendation || "Portfolio Asset",
    property,
  ));

  const contractors = normalizeArray(input.contractors).map((contractor, index) => buildSearchRecord(
    contractor.id || `contractor-${index + 1}`,
    contractor.contractorName || contractor.companyName,
    "contractor",
    "Contractor Hub",
    contractor.trade || contractor.status || "Contractor",
    contractor,
  ));

  const vendors = normalizeArray(input.vendors).map((vendor, index) => buildSearchRecord(
    vendor.id || `vendor-${index + 1}`,
    vendor.vendorName || vendor.companyName,
    "vendor",
    "Vendor Database",
    vendor.category || vendor.status || "Vendor",
    vendor,
  ));

  const products = normalizeArray(input.products).map((product, index) => buildSearchRecord(
    product.id || `product-${index + 1}`,
    product.productName || product.name,
    "product",
    "Product Vault",
    product.vendor || product.category || "Product",
    product,
  ));

  const lenders = normalizeArray(input.lenders).map((lender, index) => buildSearchRecord(
    lender.id || `lender-${index + 1}`,
    lender.lenderName || lender.name,
    "lender",
    "Lender Dashboard",
    lender.activeStatus || lender.loanProgramName || "Lender",
    lender,
  ));

  const rehabs = normalizeArray(input.rehabProjects).map((rehab, index) => buildSearchRecord(
    rehab.id || `rehab-${index + 1}`,
    rehab.propertyName || rehab.projectName,
    "rehab",
    "Rehab Project Tracker",
    rehab.projectStatus || rehab.currentPhase || "Rehab",
    rehab,
  ));

  const packets = normalizeArray(input.appraisalPackets).map((packet, index) => buildSearchRecord(
    packet.id || `packet-${index + 1}`,
    packet.packetName || packet.propertyName || packet.address,
    "packet",
    "Appraiser Packet Builder",
    packet.status || "Packet",
    packet,
  ));

  const knowledge = normalizeArray(input.knowledgeArticles).map((article, index) => buildSearchRecord(
    article.id || `knowledge-${index + 1}`,
    article.title || article.headline,
    "knowledge-article",
    "Knowledge Base",
    article.topic || article.status || "Knowledge",
    article,
  ));

  const documents = normalizeArray(input.documents).map((document, index) => buildSearchRecord(
    document.id || `doc-${index + 1}`,
    document.fileName || document.title,
    "document",
    "Document Vault",
    document.documentType || document.status || "Document",
    document,
  ));

  const marketRecords = normalizeArray(input.marketRecords).map((record, index) => buildSearchRecord(
    record.id || `market-${index + 1}`,
    record.title || record.marketName || record.location,
    "market-record",
    "Market Intelligence",
    record.status || record.source || "Market",
    record,
  ));

  const comps = normalizeArray(input.comps).map((comp, index) => buildSearchRecord(
    comp.id || `comp-${index + 1}`,
    comp.address || comp.compAddress,
    "saved-comp",
    "Comparable Sales",
    comp.source || comp.saleDate || "Comp",
    comp,
  ));

  return [
    ...deals,
    ...properties,
    ...contractors,
    ...vendors,
    ...products,
    ...lenders,
    ...rehabs,
    ...packets,
    ...knowledge,
    ...documents,
    ...marketRecords,
    ...comps,
  ];
}

function buildEnterpriseGlobalSearch(input = {}) {
  const query = safeString(input.query, "");
  const corpus = collectSearchCorpus(input);
  const startedAt = Date.now();
  const searchTerm = normalizeSearchTerm(query);

  if (!searchTerm) {
    return {
      query,
      results: [],
      indexSize: corpus.length,
      performance: {
        scannedRecords: corpus.length,
        elapsedMs: Date.now() - startedAt,
      },
      cache: {
        status: "Warm",
        hits: 0,
        misses: 1,
      },
    };
  }

  const results = [];
  for (const entry of corpus) {
    const haystack = [
      entry.label,
      entry.type,
      entry.module,
      entry.detail,
      JSON.stringify(entry.raw),
    ].join(" ").toLowerCase();
    if (haystack.includes(searchTerm)) results.push(entry);
  }

  return {
    query,
    results,
    indexSize: corpus.length,
    performance: {
      scannedRecords: corpus.length,
      elapsedMs: Date.now() - startedAt,
    },
    cache: {
      status: "Warm",
      hits: 0,
      misses: 1,
    },
  };
}

function buildAuditDiff(previousValue, newValue) {
  if (previousValue === newValue) return null;
  return {
    previousValue: previousValue ?? null,
    newValue: newValue ?? null,
  };
}

function buildAuditEntry(change = {}) {
  const recordId = safeString(change.recordId || change.id, "unknown-record");
  const changedFields = normalizeArray(change.changedFields);
  const diffs = changedFields
    .map((field) => {
      const diff = buildAuditDiff(change.previousValues?.[field], change.newValues?.[field]);
      if (!diff) return null;
      return {
        field,
        ...diff,
      };
    })
    .filter(Boolean);

  return {
    auditId: `audit-${Math.random().toString(36).slice(2, 10)}`,
    recordId,
    module: safeString(change.module, "Unknown Module"),
    whoChanged: safeString(change.whoChanged || change.actor, "System"),
    whenChanged: safeString(change.whenChanged || change.timestamp, nowIso()),
    whyChanged: safeString(change.whyChanged || change.reason, "Operational update"),
    approvalState: safeString(change.approvalState, "Pending Review"),
    changedFields: diffs,
    rollback: {
      supported: true,
      rollbackToken: `rollback-${recordId}-${Math.random().toString(36).slice(2, 6)}`,
      previousSnapshot: normalizeObject(change.previousValues),
      newSnapshot: normalizeObject(change.newValues),
    },
  };
}

function buildEnterpriseAuditTrail(input = {}) {
  const changes = normalizeArray(input.changes);
  const entries = changes.map((change) => buildAuditEntry(change));
  return {
    entries,
    summary: {
      totalEntries: entries.length,
      pendingApprovals: entries.filter((entry) => entry.approvalState !== "Approved").length,
      rollbackReady: entries.every((entry) => entry.rollback.supported),
    },
  };
}

function buildSystemHealth(input = {}) {
  const moduleHealth = normalizeArray(input.moduleHealth);
  const providerReadiness = normalizeArray(input.providerReadiness);
  const backgroundJobs = normalizeArray(input.backgroundJobs);

  const moduleHealthy = moduleHealth.filter((item) => safeString(item.status, "").toLowerCase() === "healthy" || safeString(item.status, "").toLowerCase() === "ready").length;
  const providerConfigured = providerReadiness.filter((item) => Boolean(item.configured)).length;
  const runningJobs = backgroundJobs.filter((job) => safeString(job.status, "").toLowerCase() === "running").length;

  return {
    moduleHealth: {
      healthy: moduleHealthy,
      total: moduleHealth.length,
      status: moduleHealth.length === 0 ? "Insufficient Data" : moduleHealthy === moduleHealth.length ? "Healthy" : "Degraded",
    },
    providerReadiness: {
      configured: providerConfigured,
      total: providerReadiness.length,
      status: providerReadiness.length === 0 ? "Insufficient Data" : providerConfigured > 0 ? "Partially Ready" : "Not Configured",
    },
    storageHealth: normalizeObject(input.storageHealth).status || "Healthy",
    performanceMetrics: {
      averageSearchMs: safeNumber(normalizeObject(input.performanceMetrics).averageSearchMs, 0),
      averageRenderMs: safeNumber(normalizeObject(input.performanceMetrics).averageRenderMs, 0),
      memoryPressure: safeString(normalizeObject(input.performanceMetrics).memoryPressure, "Normal"),
    },
    cacheStatus: {
      status: safeString(normalizeObject(input.cacheStatus).status, "Warm"),
      hitRate: safeNumber(normalizeObject(input.cacheStatus).hitRate, 0),
      itemCount: safeNumber(normalizeObject(input.cacheStatus).itemCount, 0),
    },
    databaseStatus: safeString(input.databaseStatus, "Read-Only Local Store"),
    backgroundJobs: {
      running: runningJobs,
      total: backgroundJobs.length,
      status: runningJobs > 0 ? "Active" : "Idle",
    },
    securityHealth: {
      status: safeString(normalizeObject(input.securityHealth).status, "Hardened"),
      notes: normalizeArray(normalizeObject(input.securityHealth).notes),
    },
  };
}

function buildProviderPlaceholder(provider, displayName, capabilities) {
  return {
    provider,
    displayName,
    liveRequestsEnabled: false,
    apiKeysAccepted: false,
    secureCredentialPlaceholder: {
      configured: false,
      status: "Placeholder Ready",
      validationMode: "Schema Only",
      requiredFields: ["baseUrl", "credentialAlias", "licensingAcknowledgement"],
      secretFieldLabel: "Encrypted Secret Placeholder",
    },
    capabilities,
  };
}

function buildProviderReadinessBlueprint() {
  return {
    liveRequestsAllowed: false,
    providers: [
      buildProviderPlaceholder("mls", "MLS", ["subject-property", "sold-comp-search", "media-access"]),
      buildProviderPlaceholder("rentcast", "RentCast", ["rent", "subject-property", "sold-comp-search"]),
      buildProviderPlaceholder("attom", "ATTOM", ["subject-property", "deed", "tax"]),
      buildProviderPlaceholder("corelogic", "CoreLogic", ["subject-property", "valuation", "transaction-history"]),
      buildProviderPlaceholder("estated", "Estated", ["public-record", "ownership-history"]),
      buildProviderPlaceholder("batchdata", "BatchData", ["skip-trace", "ownership", "portfolio-enrichment"]),
      buildProviderPlaceholder("propertyradar", "PropertyRadar", ["lead-list", "ownership", "parcel"]),
      buildProviderPlaceholder("regrid", "Regrid", ["parcel", "lot-boundary"]),
      buildProviderPlaceholder("google-maps", "Google Maps", ["geocoding", "nearby-places"]),
      buildProviderPlaceholder("openstreetmap", "OpenStreetMap", ["geocoding", "map-tiles"]),
      buildProviderPlaceholder("county-gis", "County GIS", ["parcel", "zoning", "flood-overlay"]),
      buildProviderPlaceholder("public-records", "Public Record Providers", ["deeds", "liens", "tax-history"]),
    ],
  };
}

function buildMediaEngine(input = {}) {
  const attachments = normalizeArray(input.attachments).map((attachment, index) => ({
    mediaId: attachment.mediaId || `media-${index + 1}`,
    fileName: safeString(attachment.fileName, "untitled"),
    mediaType: safeString(attachment.mediaType, "document"),
    linkedRecordId: safeString(attachment.linkedRecordId, "unknown-record"),
    linkedModule: safeString(attachment.linkedModule, "Unknown Module"),
    uploadedBy: safeString(attachment.uploadedBy, "System"),
    uploadedAt: safeString(attachment.uploadedAt, nowIso()),
    checksum: safeString(attachment.checksum, "pending"),
    metadata: {
      fileSizeBytes: safeNumber(attachment.fileSizeBytes, 0),
      contentType: safeString(attachment.contentType, "application/octet-stream"),
      tags: normalizeArray(attachment.tags),
      beforeAfterGroup: safeString(attachment.beforeAfterGroup, ""),
    },
    auditTrail: normalizeArray(attachment.auditTrail),
  }));

  return {
    supportedTypes: [
      "photos",
      "inspection-pdf",
      "appraisal-pdf",
      "contracts",
      "permits",
      "videos",
      "drone-images",
      "before-after-gallery",
    ],
    attachments,
    summary: {
      totalAttachments: attachments.length,
      linkedRecords: new Set(attachments.map((item) => item.linkedRecordId)).size,
    },
  };
}

function buildEnterpriseReports(input = {}) {
  const portfolioSummary = normalizeObject(input.portfolioSummary);
  const riskSummary = normalizeObject(input.riskSummary);
  const rehabSummary = normalizeObject(input.rehabSummary);

  const reportMeta = {
    generatedAt: nowIso(),
    exportReady: true,
    format: "JSON-ready",
  };

  return {
    investmentReport: {
      ...reportMeta,
      headline: safeString(input.investmentHeadline, "Investment posture available for review."),
      totalPortfolioValue: formatCurrency(portfolioSummary.totalCurrentValue),
    },
    lenderReport: {
      ...reportMeta,
      headline: "Lender exposure and maturity schedule",
      outstandingDebt: formatCurrency(portfolioSummary.totalOutstandingDebt),
    },
    partnerReport: {
      ...reportMeta,
      headline: "Partner portfolio and execution summary",
      monthlyCashFlow: formatCurrency(portfolioSummary.totalMonthlyCashFlow),
    },
    contractorReport: {
      ...reportMeta,
      headline: "Contractor performance and execution status",
      activeRehabs: safeNumber(rehabSummary.activeProjects, 0),
    },
    executivePortfolioReport: {
      ...reportMeta,
      headline: "Executive portfolio overview",
      healthScore: safeNumber(portfolioSummary.healthScore, 0),
    },
    rehabReport: {
      ...reportMeta,
      headline: "Rehab timeline and budget summary",
      delayedProjects: safeNumber(rehabSummary.delayedProjects, 0),
    },
    arvReport: {
      ...reportMeta,
      headline: "ARV support and comparables summary",
      compCount: safeNumber(input.compCount, 0),
    },
    riskReport: {
      ...reportMeta,
      headline: "Enterprise risk posture",
      riskScore: safeNumber(riskSummary.portfolioRiskScore || riskSummary.averageRiskScore, 0),
    },
  };
}

function buildPerformanceProfile(input = {}) {
  const search = normalizeObject(input.search);
  const portfolioSize = safeNumber(input.portfolioSize, 0);
  const renderWindow = portfolioSize > 250 ? "Virtualized Window Recommended" : "Standard Window";

  return {
    searchOptimization: {
      indexSize: safeNumber(search.indexSize, 0),
      lastQueryMs: safeNumber(normalizeObject(search.performance).elapsedMs, 0),
      strategy: "In-memory normalized index with module-level facets",
    },
    renderingOptimization: {
      renderWindow,
      memoization: "Enabled",
      heavyPanelsDeferred: true,
    },
    memoryOptimization: {
      estimatedWorkingSetMb: Number((portfolioSize * 0.045).toFixed(2)),
      gcPressure: portfolioSize > 500 ? "Elevated" : "Normal",
    },
    backgroundProcessing: {
      jobsEnabled: true,
      queuePolicy: "FIFO with retry",
      cachePolicy: "Read-through warm cache",
    },
    largePortfolioReadiness: {
      supported: true,
      guidance: portfolioSize > 1000 ? "Batch heavy reports and defer non-critical recomputes" : "No additional action required",
    },
  };
}

export function buildEnterprisePlatformOrchestrator(input = {}) {
  const orchestration = buildEnterpriseOrchestrationLayer(input);
  const globalSearch = buildEnterpriseGlobalSearch({
    query: input.searchQuery,
    deals: input.deals,
    properties: input.properties,
    contractors: input.contractors,
    vendors: input.vendors,
    products: input.products,
    lenders: input.lenders,
    rehabProjects: input.rehabProjects,
    appraisalPackets: input.appraisalPackets,
    knowledgeArticles: input.knowledgeArticles,
    documents: input.documents,
    marketRecords: input.marketRecords,
    comps: input.comps,
  });
  const audit = buildEnterpriseAuditTrail({ changes: input.auditChanges });
  const systemHealth = buildSystemHealth({
    moduleHealth: orchestration.modules.map((module) => ({ module: module.module, status: module.status })),
    providerReadiness: normalizeArray(input.providerReadiness),
    storageHealth: input.storageHealth,
    performanceMetrics: input.performanceMetrics,
    cacheStatus: {
      status: "Warm",
      hitRate: 0,
      itemCount: globalSearch.indexSize,
    },
    databaseStatus: input.databaseStatus || "Read-Only Local Store",
    backgroundJobs: normalizeArray(input.backgroundJobs),
    securityHealth: input.securityHealth,
  });
  const providerReadinessBlueprint = buildProviderReadinessBlueprint();
  const media = buildMediaEngine({ attachments: input.mediaAttachments });
  const reports = buildEnterpriseReports({
    portfolioSummary: input.portfolioSummary,
    riskSummary: input.riskSummary,
    rehabSummary: input.rehabSummary,
    compCount: normalizeArray(input.comps).length,
    investmentHeadline: input.investmentHeadline,
  });
  const performance = buildPerformanceProfile({
    search: globalSearch,
    portfolioSize: safeNumber(normalizeObject(input.portfolioSummary).totalProperties, normalizeArray(input.properties).length),
  });

  return {
    orchestration,
    globalSearch,
    audit,
    systemHealth,
    providerReadinessBlueprint,
    media,
    reports,
    performance,
  };
}

export {
  buildEnterpriseOrchestrationLayer,
  buildEnterpriseGlobalSearch,
  buildEnterpriseAuditTrail,
  buildSystemHealth,
  buildProviderReadinessBlueprint,
  buildMediaEngine,
  buildEnterpriseReports,
  buildPerformanceProfile,
};
