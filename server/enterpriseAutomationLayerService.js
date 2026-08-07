import { dealToCanonical, portfolioToCanonical, detectDuplicateProperty } from "./canonicalDataFoundation.js";
import { deriveUnifiedUnderwritingIntelligence } from "./valuationOfferBuyBoxService.js";

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function safeString(value, fallback = "") {
  if (value === null || value === undefined) return fallback;
  if (typeof value === "string") return value;
  return String(value);
}

function safeNumber(value, fallback = null) {
  if (value === null || value === undefined || value === "") return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function safeObject(value) {
  return value && typeof value === "object" ? value : {};
}

function nowIso() {
  return new Date().toISOString();
}

function createId(prefix = "entry") {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

function normalizeText(value) {
  return safeString(value, "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function redactSensitive(value) {
  if (value === null || value === undefined) return value;
  if (typeof value === "string") {
    return value
      .replace(/(api[_-]?key|token|secret|password)=([^&\s]+)/ig, "$1=REDACTED")
      .replace(/Bearer\s+[A-Za-z0-9._-]+/g, "Bearer REDACTED");
  }
  if (Array.isArray(value)) return value.map((entry) => redactSensitive(entry));
  if (typeof value === "object") {
    const next = {};
    for (const [key, entry] of Object.entries(value)) {
      if (/(api[_-]?key|token|secret|password|credential)/i.test(key)) next[key] = "REDACTED";
      else next[key] = redactSensitive(entry);
    }
    return next;
  }
  return value;
}

function buildKnownUncertainNeeded({ known = [], uncertain = [], needed = [] } = {}) {
  return {
    known: safeArray(known).filter(Boolean),
    uncertain: safeArray(uncertain).filter(Boolean),
    needed: safeArray(needed).filter(Boolean),
  };
}

function toStatusLabel(issueCount) {
  if (issueCount === 0) return "healthy";
  if (issueCount <= 3) return "warning";
  return "critical";
}

function resolveSearchNavigation(result) {
  return {
    module: result.module,
    entityType: result.entityType,
    recordId: result.recordId,
    safeTarget: {
      screen: result.module,
      id: result.recordId,
    },
  };
}

function buildSearchableText(entity = {}) {
  const fields = [
    entity.id,
    entity.propertyName,
    entity.address,
    entity.city,
    entity.state,
    entity.zipCode,
    entity.contractorCompany,
    entity.contactName,
    entity.lender,
    entity.vendor,
    entity.productName,
    entity.sku,
    entity.documentName,
    entity.notes,
    entity.status,
    entity.strategy,
    entity.recordId,
  ];
  return normalizeText(fields.filter(Boolean).join(" "));
}

function buildEntityRecord(module, entityType, rawRecord = {}, displayLabelBuilder) {
  const record = safeObject(rawRecord);
  const recordId = safeString(record.id || record.recordId || "");
  const displayLabel = displayLabelBuilder(record);
  return {
    module,
    entityType,
    recordId,
    displayLabel,
    status: safeString(record.status || record.packetStatus || record.projectStatus || record.inclusionStatus || "UNKNOWN", "UNKNOWN"),
    strategy: safeString(record.strategy || "UNKNOWN", "UNKNOWN"),
    city: safeString(record.city || ""),
    state: safeString(record.state || ""),
    zipCode: safeString(record.zipCode || record.zip || ""),
    searchableText: buildSearchableText({
      id: recordId,
      propertyName: record.propertyName || record.projectName || record.packetName || record.analysisName,
      address: record.address || record.propertyAddress || record.compAddress,
      city: record.city,
      state: record.state,
      zipCode: record.zipCode || record.zip,
      contractorCompany: record.companyName || record.contractorName,
      contactName: record.contactName,
      lender: record.lenderName,
      vendor: record.vendorName,
      productName: record.productName,
      sku: record.sku,
      documentName: record.documentName || record.title,
      notes: record.notes,
      status: record.status || record.packetStatus || record.projectStatus,
      strategy: record.strategy,
      recordId,
    }),
    raw: record,
  };
}

function parseReportFormat(format = "json") {
  const normalized = safeString(format, "json").toLowerCase();
  if (["json", "csv", "html", "pdf", "xlsx", "excel", "print"].includes(normalized)) return normalized;
  return "json";
}

function toCsv(rows = []) {
  const values = safeArray(rows);
  if (!values.length) return "";
  const keys = [...new Set(values.flatMap((row) => Object.keys(safeObject(row))))];
  const escape = (value) => {
    const text = safeString(value ?? "", "");
    if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
    return text;
  };
  const header = keys.join(",");
  const lines = values.map((row) => keys.map((key) => escape(row[key])).join(","));
  return [header, ...lines].join("\n");
}

function reportEnvelope(name, rows, metadata = {}) {
  return {
    reportId: createId("report"),
    name,
    asOfDate: nowIso().slice(0, 10),
    generatedAt: nowIso(),
    rowCount: safeArray(rows).length,
    metadata,
    rows: safeArray(rows),
  };
}

function scoreEvidence(known, uncertain, needed) {
  let score = 80;
  score -= safeArray(uncertain).length * 7;
  score -= safeArray(needed).length * 10;
  score += Math.min(10, safeArray(known).length * 2);
  return Math.max(0, Math.min(100, score));
}

export function createEnterpriseAutomationLayerService(options = {}) {
  const readDeals = options.readDeals;
  const writeDeals = options.writeDeals;
  const readProperties = options.readProperties;
  const writeProperties = options.writeProperties;
  const readPortfolio = options.readPortfolio;
  const writePortfolio = options.writePortfolio;
  const readComps = options.readComps;
  const readNeighborhoods = options.readNeighborhoods;
  const readContractors = options.readContractors;
  const readVendors = options.readVendors;
  const readLenders = options.readLenders;
  const readProducts = options.readProducts;
  const readMaterials = options.readMaterials;
  const readRehabProjects = options.readRehabProjects;
  const writeRehabProjects = options.writeRehabProjects;
  const readAppraisalPackets = options.readAppraisalPackets;
  const writeAppraisalPackets = options.writeAppraisalPackets;
  const readDealIntelligence = options.readDealIntelligence;
  const readUnderwritingAudit = options.readUnderwritingAudit;
  const readSyncAudit = options.readSyncAudit;

  const readEnterpriseAudit = options.readEnterpriseAudit;
  const writeEnterpriseAudit = options.writeEnterpriseAudit;
  const readReports = options.readReports;
  const writeReports = options.writeReports;
  const readDocuments = options.readDocuments;
  const writeDocuments = options.writeDocuments;
  const readKnowledge = options.readKnowledge;
  const writeKnowledge = options.writeKnowledge;
  const readWorkflowTransitions = options.readWorkflowTransitions;
  const writeWorkflowTransitions = options.writeWorkflowTransitions;
  const readDiagnosticsHistory = options.readDiagnosticsHistory;
  const writeDiagnosticsHistory = options.writeDiagnosticsHistory;

  if (
    !readDeals || !writeDeals || !readProperties || !writeProperties || !readPortfolio || !writePortfolio || !readComps || !readNeighborhoods || !readContractors || !readVendors || !readLenders || !readProducts || !readMaterials || !readRehabProjects || !writeRehabProjects || !readAppraisalPackets || !writeAppraisalPackets || !readDealIntelligence || !readUnderwritingAudit || !readSyncAudit || !readEnterpriseAudit || !writeEnterpriseAudit || !readReports || !writeReports || !readDocuments || !writeDocuments || !readKnowledge || !writeKnowledge || !readWorkflowTransitions || !writeWorkflowTransitions || !readDiagnosticsHistory || !writeDiagnosticsHistory
  ) {
    throw new Error("createEnterpriseAutomationLayerService requires complete read/write handlers");
  }

  async function appendAudit(action, payload = {}) {
    const audit = await readEnterpriseAudit();
    const event = redactSensitive({
      id: createId("enterprise-audit"),
      timestamp: nowIso(),
      action,
      actor: safeString(payload.actor, "System Administrator"),
      approvalState: safeString(payload.approvalState, "REVIEW_REQUIRED"),
      entityType: safeString(payload.entityType, "SYSTEM"),
      entityId: safeString(payload.entityId, ""),
      metadata: payload.metadata || {},
    });
    audit.push(event);
    await writeEnterpriseAudit(audit);
    return event;
  }

  async function getDataContext() {
    const [
      deals,
      properties,
      portfolio,
      comps,
      neighborhoods,
      contractors,
      vendors,
      lenders,
      products,
      materials,
      rehabProjects,
      appraisalPackets,
      dealIntelligence,
      underwritingAudit,
      syncAudit,
      enterpriseAudit,
      reports,
      documents,
      knowledge,
      workflows,
      diagnosticsHistory,
    ] = await Promise.all([
      readDeals(),
      readProperties(),
      readPortfolio(),
      readComps(),
      readNeighborhoods(),
      readContractors(),
      readVendors(),
      readLenders(),
      readProducts(),
      readMaterials(),
      readRehabProjects(),
      readAppraisalPackets(),
      readDealIntelligence(),
      readUnderwritingAudit(),
      readSyncAudit(),
      readEnterpriseAudit(),
      readReports(),
      readDocuments(),
      readKnowledge(),
      readWorkflowTransitions(),
      readDiagnosticsHistory(),
    ]);

    return {
      deals: safeArray(deals),
      properties: safeArray(properties),
      portfolio: safeArray(portfolio),
      comps: safeArray(comps),
      neighborhoods: safeArray(neighborhoods),
      contractors: safeArray(contractors),
      vendors: safeArray(vendors),
      lenders: safeArray(lenders),
      products: safeArray(products),
      materials: safeArray(materials),
      rehabProjects: safeArray(rehabProjects),
      appraisalPackets: safeArray(appraisalPackets),
      dealIntelligence: safeArray(dealIntelligence),
      underwritingAudit: safeArray(underwritingAudit),
      syncAudit: safeArray(syncAudit),
      enterpriseAudit: safeArray(enterpriseAudit),
      reports: safeArray(reports),
      documents: safeArray(documents),
      knowledge: safeArray(knowledge),
      workflows: safeArray(workflows),
      diagnosticsHistory: safeArray(diagnosticsHistory),
    };
  }

  function generateCriticalAlerts(context = {}) {
    const alerts = [];
    const deals = safeArray(context.deals);
    const properties = safeArray(context.properties);
    const rehabs = safeArray(context.rehabProjects);

    for (const deal of deals) {
      const confidence = safeNumber(deal.arvConfidenceScore ?? deal.valuationGovernance?.confidence?.score, 0);
      const reviewRequired = deal.reviewRequired === true || safeString(deal.valuationReviewStatus, "").toUpperCase() === "REVIEW_REQUIRED";
      if (reviewRequired && confidence < 55) {
        alerts.push({
          severity: "critical",
          category: "valuation risk",
          message: `Deal ${safeString(deal.propertyAddress || deal.id, "UNKNOWN")} has review-required valuation with low confidence`,
          module: "Deal Intelligence",
          recordId: safeString(deal.id, ""),
        });
      }
    }

    for (const property of properties) {
      const reserveFlag = safeString(property.reserveStatus || "").toLowerCase();
      if (reserveFlag === "shortfall") {
        alerts.push({ severity: "critical", category: "reserve risk", message: `Reserve shortfall on ${safeString(property.propertyName || property.address, "UNKNOWN")}`, module: "Portfolio Dashboard", recordId: safeString(property.id, "") });
      }
    }

    for (const rehab of rehabs) {
      const actual = safeNumber(rehab.actualCost ?? rehab.actualRehabCost, null);
      const budget = safeNumber(rehab.currentRehabBudget ?? rehab.originalRehabBudget ?? rehab.rehabBudget, null);
      if (actual !== null && budget !== null && actual > budget * 1.15) {
        alerts.push({ severity: "critical", category: "budget risk", message: `Rehab budget exceeded by >15% for ${safeString(rehab.projectName || rehab.propertyName, "UNKNOWN")}`, module: "Rehab Project Tracker", recordId: safeString(rehab.id, "") });
      }
    }

    return alerts;
  }

  function generateDecisionBlockers(context = {}) {
    const blockers = [];
    const deals = safeArray(context.deals);
    const audits = safeArray(context.underwritingAudit);

    deals.forEach((deal) => {
      if (safeString(deal.valuationReviewStatus, "").toUpperCase() === "REVIEW_REQUIRED") {
        blockers.push({
          blocker: "VALUATION_REVIEW_REQUIRED",
          module: "Deal Intelligence",
          recordId: safeString(deal.id, ""),
          reason: "Approved ARV not yet established with sufficient evidence.",
        });
      }
      if (safeString(deal.buyBoxResult, "").toUpperCase().includes("FAIL")) {
        blockers.push({
          blocker: "BUY_BOX_BLOCK",
          module: "Buy Box Engine",
          recordId: safeString(deal.id, ""),
          reason: "Buy-box policy currently blocks progression.",
        });
      }
    });

    const unresolved = audits.filter((event) => safeString(event.approvalState, "").toUpperCase() === "REVIEW_REQUIRED");
    if (unresolved.length > 0) {
      blockers.push({
        blocker: "UNRESOLVED_REVIEW_EVENTS",
        module: "Reporting and Audit Records",
        recordId: "audit",
        reason: `${unresolved.length} review-required audit events remain unresolved.`,
      });
    }

    return blockers;
  }

  function generateExecutivePriorities(context = {}) {
    const priorities = [];
    const blockers = generateDecisionBlockers(context);
    const alerts = generateCriticalAlerts(context);

    if (blockers.length) {
      priorities.push({
        priority: "Resolve decision blockers",
        severity: "critical",
        reason: `${blockers.length} blocker(s) must be reviewed before decisions can proceed.`,
        evidence: blockers.slice(0, 3),
      });
    }

    if (alerts.length) {
      priorities.push({
        priority: "Address critical risk alerts",
        severity: "critical",
        reason: `${alerts.length} critical alert(s) detected across active modules.`,
        evidence: alerts.slice(0, 3),
      });
    }

    const staleCount = safeArray(context.comps).filter((comp) => {
      const saleDate = Date.parse(comp.saleDate || "");
      if (!Number.isFinite(saleDate)) return true;
      const ageDays = (Date.now() - saleDate) / (1000 * 60 * 60 * 24);
      return ageDays > 365;
    }).length;
    if (staleCount > 0) {
      priorities.push({
        priority: "Refresh stale comparable evidence",
        severity: "moderate",
        reason: `${staleCount} comp record(s) are stale or unknown-dated.`,
        evidence: [{ staleCount }],
      });
    }

    if (!priorities.length) {
      priorities.push({
        priority: "Maintain review-first posture",
        severity: "info",
        reason: "No critical blockers detected; continue manual validation flow.",
        evidence: [],
      });
    }

    return priorities;
  }

  function generateAiRecommendations(context = {}) {
    const recommendations = [];
    const deals = safeArray(context.dealIntelligence);
    const blockers = generateDecisionBlockers(context);

    const topDeal = [...deals].sort((a, b) => safeNumber(b.dealScore, 0) - safeNumber(a.dealScore, 0))[0];
    if (topDeal) {
      const unknowns = [];
      if (!safeNumber(topDeal.approvedArv, null)) unknowns.push("approvedArv");
      if (!safeNumber(topDeal.offerConfidenceScore, null)) unknowns.push("offerConfidence");
      const confidence = Math.max(0, Math.min(100, safeNumber(topDeal.decisionConfidence ?? topDeal.dealScore, 0) - unknowns.length * 15));

      recommendations.push({
        id: createId("ai-reco"),
        recommendation: safeString(topDeal.recommendation, "REVIEW_REQUIRED"),
        advisoryOnly: true,
        module: "Deal Intelligence",
        recordId: safeString(topDeal.id || topDeal.dealId, ""),
        confidence,
        reasoning: safeString(topDeal.recommendationReason || topDeal.underwritingSummary, "Derived from saved underwriting and portfolio records."),
        evidence: {
          dealScore: topDeal.dealScore,
          projectedProfit: topDeal.projectedProfit,
          buyBoxResult: topDeal.buyBoxResult,
          reviewRequired: topDeal.reviewRequired,
        },
        unknowns,
      });
    }

    if (blockers.length) {
      recommendations.push({
        id: createId("ai-reco"),
        recommendation: "REVIEW_REQUIRED",
        advisoryOnly: true,
        module: "Command Center",
        recordId: "enterprise",
        confidence: 95,
        reasoning: "Decision blockers prevent high-confidence ready-to-buy conclusions.",
        evidence: { blockers: blockers.length },
        unknowns: [],
      });
    }

    return recommendations;
  }

  function calculateEnterpriseConfidence(context = {}) {
    const blockers = generateDecisionBlockers(context);
    const alerts = generateCriticalAlerts(context);
    const unknowns = [];

    if (!safeArray(context.deals).length) unknowns.push("deals");
    if (!safeArray(context.portfolio).length) unknowns.push("portfolio");
    if (!safeArray(context.comps).length) unknowns.push("comps");

    let score = 78;
    score -= blockers.length * 12;
    score -= alerts.length * 7;
    score -= unknowns.length * 10;

    return Math.max(0, Math.min(100, score));
  }

  function explainRecommendation(recommendation = {}) {
    const rec = safeObject(recommendation);
    return {
      summary: safeString(rec.reasoning, "No reasoning provided."),
      evidence: rec.evidence || {},
      confidence: safeNumber(rec.confidence, 0),
      unknowns: safeArray(rec.unknowns),
      advisoryOnly: rec.advisoryOnly !== false,
    };
  }

  async function buildExecutiveSnapshot(context = null) {
    const data = context || await getDataContext();
    const priorities = generateExecutivePriorities(data);
    const criticalAlerts = generateCriticalAlerts(data);
    const blockers = generateDecisionBlockers(data);
    const recommendations = generateAiRecommendations(data);
    const confidenceScore = calculateEnterpriseConfidence(data);

    const moderateAlerts = [];
    const staleCompCount = safeArray(data.comps).filter((comp) => {
      const stamp = Date.parse(comp.saleDate || "");
      if (!Number.isFinite(stamp)) return true;
      return (Date.now() - stamp) / (1000 * 60 * 60 * 24) > 180;
    }).length;
    if (staleCompCount > 0) {
      moderateAlerts.push({ severity: "moderate", category: "stale data", count: staleCompCount, module: "Comp Database" });
    }

    const unresolvedReviews = safeArray(data.underwritingAudit).filter((event) => safeString(event.approvalState, "").toUpperCase() === "REVIEW_REQUIRED").length;
    const decisionRecommendations = recommendations.map((entry) => explainRecommendation(entry));
    const contradictions = recommendations.length > 1
      ? recommendations.filter((entry) => safeString(entry.recommendation, "").toUpperCase().includes("BUY")).length > 0 && blockers.length > 0
        ? ["Positive deal recommendation conflicts with active blockers."]
        : []
      : [];

    const knownUncertainNeeded = buildKnownUncertainNeeded({
      known: [
        `${data.deals.length} saved deals`,
        `${data.portfolio.length} portfolio records`,
        `${data.rehabProjects.length} rehab projects`,
      ],
      uncertain: [
        staleCompCount > 0 ? `${staleCompCount} stale/unknown comp records` : null,
        unresolvedReviews > 0 ? `${unresolvedReviews} unresolved reviews` : null,
      ],
      needed: [
        blockers.length > 0 ? "Resolve review blockers" : null,
        confidenceScore < 70 ? "Additional validated evidence to raise confidence" : null,
      ],
    });

    const snapshot = {
      timestamp: nowIso(),
      advisoryOnly: true,
      todaysPriorities: priorities,
      criticalAlerts,
      moderateAlerts,
      decisionBlockers: blockers,
      unresolvedReviews,
      acquisitionsPosture: blockers.length ? "Constrained" : "Selective",
      rehabPosture: safeArray(data.rehabProjects).some((project) => safeString(project.projectStatus, "").toLowerCase() === "delayed") ? "At Risk" : "Stable",
      refinancePosture: safeArray(data.properties).some((property) => safeString(property.loanMaturityDate, "")) ? "Active Review" : "Insufficient Data",
      sellVersusHoldPosture: "Advisory Review",
      contractorRisk: safeArray(data.contractors).filter((entry) => safeString(entry.insuranceStatus, "").toLowerCase() === "expired").length,
      lenderRisk: safeArray(data.lenders).filter((entry) => safeString(entry.status, "").toLowerCase() === "delinquent").length,
      budgetRisk: safeArray(data.rehabProjects).filter((project) => {
        const budget = safeNumber(project.currentRehabBudget ?? project.rehabBudget, null);
        const actual = safeNumber(project.actualCost ?? project.actualRehabCost, null);
        return budget !== null && actual !== null && actual > budget;
      }).length,
      reserveRisk: safeArray(data.properties).filter((property) => safeString(property.reserveStatus, "").toLowerCase() === "shortfall").length,
      valuationRisk: safeArray(data.dealIntelligence).filter((entry) => safeString(entry.valuationReviewStatus, "").toUpperCase() === "REVIEW_REQUIRED").length,
      portfolioConcentrationRisk: safeArray(data.portfolio).length > 0 ? "Monitor" : "Unknown",
      activeDealCount: safeArray(data.deals).length,
      activeRehabCount: safeArray(data.rehabProjects).length,
      pendingReviewCount: unresolvedReviews,
      staleDataCount: staleCompCount,
      upcomingDeadlines: safeArray(data.rehabProjects)
        .map((project) => ({ recordId: project.id, dueDate: project.targetCompletionDate || project.projectedCompletionDate || null, module: "Rehab Project Tracker" }))
        .filter((entry) => entry.dueDate)
        .slice(0, 8),
      recommendedNextActions: priorities.map((item) => item.priority),
      confidenceScore,
      contradictions,
      recommendations,
      recommendationExplanations: decisionRecommendations,
      ...knownUncertainNeeded,
    };

    await appendAudit("executive snapshot generated", {
      entityType: "command-center",
      entityId: "enterprise",
      approvalState: blockers.length ? "REVIEW_REQUIRED" : "ADVISORY",
      metadata: {
        confidenceScore,
        blockerCount: blockers.length,
      },
    });

    return snapshot;
  }

  async function getExecutiveAuditHistory() {
    const audit = await readEnterpriseAudit();
    return safeArray(audit)
      .filter((entry) => safeString(entry.action, "").includes("executive") || safeString(entry.entityType, "") === "command-center")
      .sort((a, b) => safeString(b.timestamp, "").localeCompare(safeString(a.timestamp, "")));
  }

  function buildSearchIndex(context = {}) {
    const index = [];

    safeArray(context.deals).forEach((deal) => {
      index.push(buildEntityRecord("Deal Analyzer", "deals", deal, (record) => safeString(record.propertyAddress || record.address || record.id || "Deal")));
    });
    safeArray(context.properties).forEach((property) => {
      index.push(buildEntityRecord("Property Database", "properties", property, (record) => safeString(record.propertyName || record.address || record.id || "Property")));
    });
    safeArray(context.portfolio).forEach((portfolio) => {
      index.push(buildEntityRecord("Portfolio Dashboard", "portfolio", portfolio, (record) => safeString(record.propertyName || record.propertyAddress || record.id || "Portfolio Record")));
    });
    safeArray(context.comps).forEach((comp) => {
      index.push(buildEntityRecord("Comp Database", "comps", comp, (record) => safeString(record.compAddress || record.address || record.id || "Comp")));
    });
    safeArray(context.neighborhoods).forEach((entry) => {
      index.push(buildEntityRecord("Neighborhood Database", "neighborhoods", entry, (record) => safeString(record.name || `${record.city || "Neighborhood"} ${record.zipCode || ""}`.trim() || record.id)));
    });
    safeArray(context.contractors).forEach((entry) => {
      index.push(buildEntityRecord("Contractor Hub", "contractors", entry, (record) => safeString(record.contractorName || record.companyName || record.id || "Contractor")));
    });
    safeArray(context.vendors).forEach((entry) => {
      index.push(buildEntityRecord("Vendor Database", "vendors", entry, (record) => safeString(record.vendorName || record.companyName || record.id || "Vendor")));
    });
    safeArray(context.lenders).forEach((entry) => {
      index.push(buildEntityRecord("Lender Dashboard", "lenders", entry, (record) => safeString(record.lenderName || record.id || "Lender")));
    });
    safeArray(context.products).forEach((entry) => {
      index.push(buildEntityRecord("Product Vault", "products", entry, (record) => safeString(record.productName || record.name || record.sku || record.id || "Product")));
    });
    safeArray(context.materials).forEach((entry) => {
      index.push(buildEntityRecord("Material Matrix", "materials", entry, (record) => safeString(record.materialName || record.productName || record.sku || record.id || "Material")));
    });
    safeArray(context.rehabProjects).forEach((entry) => {
      index.push(buildEntityRecord("Rehab Project Tracker", "rehab-projects", entry, (record) => safeString(record.projectName || record.propertyName || record.id || "Rehab Project")));
    });
    safeArray(context.documents).forEach((entry) => {
      index.push(buildEntityRecord("Document Automation", "documents", entry, (record) => safeString(record.documentName || record.templateType || record.id || "Document")));
    });
    safeArray(context.appraisalPackets).forEach((entry) => {
      index.push(buildEntityRecord("Appraiser Packet Builder", "appraisal-records", entry, (record) => safeString(record.packetName || record.propertyName || record.id || "Appraisal Packet")));
    });
    safeArray(context.enterpriseAudit).forEach((entry) => {
      index.push(buildEntityRecord("Reporting and Audit Records", "audit-events", entry, (record) => safeString(record.action || record.id || "Audit Event")));
    });
    safeArray(context.reports).forEach((entry) => {
      index.push(buildEntityRecord("Reporting", "reports", entry, (record) => safeString(entry.name || entry.reportId || "Report")));
    });

    return index;
  }

  function normalizeSearchQuery(query) {
    return normalizeText(query);
  }

  function rankSearchResults(results, query) {
    const normalizedQuery = normalizeSearchQuery(query);
    const queryTokens = normalizedQuery.split(" ").filter(Boolean);
    return safeArray(results)
      .map((result) => {
        let score = 0;
        const text = safeString(result.searchableText, "");
        if (text === normalizedQuery) score += 100;
        if (safeString(result.recordId, "").toLowerCase() === normalizedQuery) score += 90;
        if (safeString(result.displayLabel, "").toLowerCase() === normalizedQuery) score += 80;
        queryTokens.forEach((token) => {
          if (text.includes(token)) score += 10;
        });
        if (text.startsWith(normalizedQuery)) score += 15;
        return { ...result, score };
      })
      .sort((a, b) => b.score - a.score);
  }

  function groupSearchResults(results) {
    const grouped = {};
    safeArray(results).forEach((result) => {
      const key = safeString(result.entityType, "unknown");
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push({
        recordId: result.recordId,
        displayLabel: result.displayLabel,
        status: result.status,
        module: result.module,
        navigation: resolveSearchNavigation(result),
      });
    });
    return grouped;
  }

  async function searchAllEntities(query, filters = {}) {
    const context = await getDataContext();
    const normalized = normalizeSearchQuery(query);
    const index = buildSearchIndex(context);

    if (!normalized) {
      return {
        query,
        normalizedQuery: normalized,
        status: "AMBIGUOUS_QUERY",
        groupedResults: {},
        totalResults: 0,
      };
    }

    const filterEntity = safeString(filters.entityType, "").toLowerCase();
    const candidates = index.filter((entry) => {
      if (filterEntity && safeString(entry.entityType, "").toLowerCase() !== filterEntity) return false;
      return entry.searchableText.includes(normalized);
    });

    const ranked = rankSearchResults(candidates, normalized);
    const grouped = groupSearchResults(ranked);

    await appendAudit("global search executed", {
      entityType: "search",
      entityId: "all",
      approvalState: "ADVISORY",
      metadata: {
        query: normalized,
        resultCount: ranked.length,
      },
    });

    return {
      query,
      normalizedQuery: normalized,
      status: ranked.length ? "OK" : "NO_RESULTS",
      groupedResults: grouped,
      totalResults: ranked.length,
      ambiguous: ranked.length > 25,
    };
  }

  async function refreshSearchIndex() {
    const context = await getDataContext();
    const index = buildSearchIndex(context);
    await appendAudit("search index refreshed", {
      entityType: "search",
      entityId: "index",
      approvalState: "ADVISORY",
      metadata: { indexedRecords: index.length },
    });
    return { ok: true, indexedRecords: index.length, refreshedAt: nowIso() };
  }

  function generateExecutiveReport(context = {}, options = {}) {
    const snapshot = options.snapshot || null;
    const reportRows = [
      {
        asOfDate: nowIso().slice(0, 10),
        activeDeals: safeArray(context.deals).length,
        activeRehabs: safeArray(context.rehabProjects).length,
        pendingReviews: safeArray(context.underwritingAudit).filter((entry) => safeString(entry.approvalState, "").toUpperCase() === "REVIEW_REQUIRED").length,
        confidenceScore: safeNumber(snapshot?.confidenceScore, null),
      },
    ];
    return reportEnvelope("Executive Summary", reportRows, {
      knownUncertainNeeded: buildKnownUncertainNeeded({
        known: [`${safeArray(context.deals).length} deals`, `${safeArray(context.portfolio).length} portfolio records`],
        uncertain: snapshot?.uncertain || [],
        needed: snapshot?.needed || [],
      }),
    });
  }

  function generateDealPipelineReport(context = {}) {
    const rows = safeArray(context.deals).map((deal) => ({
      dealId: deal.id,
      propertyAddress: deal.propertyAddress || deal.address || "UNKNOWN",
      city: deal.city || "UNKNOWN",
      state: deal.state || "UNKNOWN",
      status: deal.status || "UNKNOWN",
      strategy: deal.strategy || "UNKNOWN",
      purchasePrice: safeNumber(deal.purchasePrice ?? deal.askingPrice, null),
      rehabBudget: safeNumber(deal.rehabBudget, null),
      approvedArv: safeNumber(deal.approvedArv ?? deal.auditMetadata?.valuationGovernance?.approvedArv, null),
      recommendedArv: safeNumber(deal.recommendedArv ?? deal.auditMetadata?.valuationGovernance?.recommendedArv, null),
      reviewRequired: deal.reviewRequired === true,
    }));
    return reportEnvelope("Deal Pipeline Report", rows, {
      labels: "Approved and recommended values are explicitly separated.",
    });
  }

  function generateUnderwritingReport(context = {}, dealId = "") {
    const match = safeArray(context.dealIntelligence).find((entry) => safeString(entry.id) === safeString(dealId) || safeString(entry.dealId) === safeString(dealId));
    const rows = match ? [{
      dealId: match.dealId || match.id,
      recommendation: match.recommendation || "UNKNOWN",
      buyBoxResult: match.buyBoxResult || "UNKNOWN",
      offerStatus: match.offerStatus || "UNKNOWN",
      valuationReviewStatus: match.valuationReviewStatus || "UNKNOWN",
      approvedArv: safeNumber(match.approvedArv ?? match.valuationGovernance?.approvedArv, null),
      recommendedArv: safeNumber(match.recommendedArv ?? match.valuationGovernance?.recommendedArv, null),
      projectedProfit: safeNumber(match.projectedProfit, null),
      confidenceScore: safeNumber(match.decisionConfidence ?? match.dealScore, null),
      known: safeArray(match.investmentDecision?.primaryFactors).join(" | "),
      uncertain: safeArray(match.contradictoryRecommendations).join(" | "),
      needed: safeArray(match.requiredFollowUpItems).join(" | "),
    }] : [];
    return reportEnvelope("Underwriting Report", rows, {
      status: rows.length ? "OK" : "NO_RECORD",
    });
  }

  function generateValuationReport(context = {}, dealId = "") {
    const deal = safeArray(context.deals).find((entry) => safeString(entry.id) === safeString(dealId));
    const valuation = deal ? deriveUnifiedUnderwritingIntelligence(deal, context.comps, context.neighborhoods) : null;
    const rows = valuation ? [{
      dealId,
      approvedArv: safeNumber(valuation.governance?.approvedArv, null),
      recommendedArv: safeNumber(valuation.governance?.recommendedArv, null),
      lowRange: safeNumber(valuation.valuation?.lowRange, null),
      baseRange: safeNumber(valuation.valuation?.baseRange, null),
      highRange: safeNumber(valuation.valuation?.highRange, null),
      confidence: safeNumber(valuation.valuation?.confidence?.score, null),
      warningCount: safeArray(valuation.valuation?.warnings).length,
      reviewStatus: valuation.valuation?.valuationReviewStatus || "UNKNOWN",
    }] : [];
    return reportEnvelope("Valuation and Comp Report", rows, {
      status: rows.length ? "OK" : "NO_RECORD",
    });
  }

  function generateOfferGuidanceReport(context = {}, dealId = "") {
    const deal = safeArray(context.deals).find((entry) => safeString(entry.id) === safeString(dealId));
    const valuation = deal ? deriveUnifiedUnderwritingIntelligence(deal, context.comps, context.neighborhoods) : null;
    const offer = valuation?.offer || null;
    const rows = offer ? [{
      dealId,
      valuationSource: offer.valuationSource || "UNKNOWN",
      offerStatus: offer.offerStatus || "UNKNOWN",
      maximumAllowableOffer: safeNumber(offer.maximumAllowableOffer, null),
      targetOffer: safeNumber(offer.targetOffer, null),
      walkAwayPrice: safeNumber(offer.walkAwayPrice, null),
      confidenceScore: safeNumber(offer.confidence?.score, null),
      unknowns: safeArray(offer.confidence?.unknowns).join(" | "),
    }] : [];
    return reportEnvelope("Offer Guidance Report", rows, {
      status: rows.length ? "OK" : "NO_RECORD",
    });
  }

  function generateBuyBoxReport(context = {}, dealId = "") {
    const deal = safeArray(context.deals).find((entry) => safeString(entry.id) === safeString(dealId));
    const valuation = deal ? deriveUnifiedUnderwritingIntelligence(deal, context.comps, context.neighborhoods) : null;
    const buyBox = valuation?.buyBox || null;
    const rows = buyBox ? [{
      dealId,
      result: buyBox.result || "UNKNOWN",
      score: safeNumber(buyBox.score, null),
      confidenceScore: safeNumber(buyBox.confidenceScore, null),
      reviewRequired: buyBox.reviewRequired === true,
      warningCount: safeArray(buyBox.warnings).length,
      blockerCount: safeArray(buyBox.blockers).length,
      recommendation: buyBox.recommendation || "UNKNOWN",
    }] : [];
    return reportEnvelope("Buy Box Report", rows, {
      status: rows.length ? "OK" : "NO_RECORD",
    });
  }

  function generatePortfolioReport(context = {}) {
    const rows = safeArray(context.portfolio).map((entry) => ({
      portfolioId: entry.id,
      propertyName: entry.propertyName || entry.propertyAddress || "UNKNOWN",
      currentValue: safeNumber(entry.currentValue, null),
      loanBalance: safeNumber(entry.loanBalance, null),
      monthlyRent: safeNumber(entry.monthlyRent, null),
      operatingExpenses: safeNumber(entry.operatingExpenses, null),
      status: entry.status || "UNKNOWN",
      strategy: entry.strategy || "UNKNOWN",
    }));
    return reportEnvelope("Portfolio Summary", rows, {
      asOfDate: nowIso().slice(0, 10),
    });
  }

  function generateRiskReport(context = {}) {
    const diagnostic = runDataQualityChecks(context);
    const rows = diagnostic.issues.map((issue) => ({
      severity: issue.severity,
      module: issue.module,
      issueType: issue.type,
      recordId: issue.recordId,
      status: issue.status,
      remediationAction: issue.remediationAction,
      confidence: issue.confidence,
    }));
    return reportEnvelope("Portfolio Risk Report", rows, {
      summary: diagnostic.summary,
    });
  }

  function generateContractorReport(context = {}) {
    const rows = safeArray(context.contractors).map((entry) => ({
      contractorId: entry.id,
      contractorName: entry.contractorName || entry.companyName || "UNKNOWN",
      insuranceStatus: entry.insuranceStatus || "UNKNOWN",
      licenseStatus: entry.licenseStatus || "UNKNOWN",
      w9Status: entry.w9Status || "UNKNOWN",
      performanceRating: safeNumber(entry.performanceRating, null),
    }));
    return reportEnvelope("Contractor Performance Report", rows, {});
  }

  function generateLenderExposureReport(context = {}) {
    const rows = safeArray(context.lenders).map((entry) => ({
      lenderId: entry.id,
      lenderName: entry.lenderName || "UNKNOWN",
      status: entry.status || "UNKNOWN",
      exposure: safeNumber(entry.totalCurrentBalance ?? entry.loanBalance ?? entry.outstandingBalance, null),
      maturityDate: entry.loanMaturityDate || null,
    }));
    return reportEnvelope("Lender Exposure Report", rows, {});
  }

  function generateProductMaterialReport(context = {}) {
    const rows = [];
    safeArray(context.products).forEach((entry) => {
      rows.push({
        type: "product",
        id: entry.id,
        name: entry.productName || entry.name || "UNKNOWN",
        sku: entry.sku || "UNKNOWN",
        status: entry.status || "UNKNOWN",
      });
    });
    safeArray(context.materials).forEach((entry) => {
      rows.push({
        type: "material",
        id: entry.id,
        name: entry.materialName || entry.productName || "UNKNOWN",
        sku: entry.sku || "UNKNOWN",
        status: entry.status || "UNKNOWN",
      });
    });
    return reportEnvelope("Product and Material Report", rows, {});
  }

  function generateAppraisalSupportReport(context = {}, dealId = "") {
    const deal = safeArray(context.deals).find((entry) => safeString(entry.id) === safeString(dealId));
    const valuation = deal ? deriveUnifiedUnderwritingIntelligence(deal, context.comps, context.neighborhoods) : null;
    const support = valuation?.appraisalPacketSupport || null;
    const rows = support ? [{
      dealId,
      approvedArv: safeNumber(support.approvedArv, null),
      recommendedArv: safeNumber(support.recommendedArv, null),
      confidenceScore: safeNumber(support.confidenceScore, null),
      appraisalReviewStatus: support.appraisalReviewStatus || "UNKNOWN",
      compCount: safeArray(support.compSet).length,
      warningCount: safeArray(support.valuationWarnings).length,
    }] : [];
    return reportEnvelope("Appraisal Support Report", rows, {
      status: rows.length ? "OK" : "NO_RECORD",
    });
  }

  function generateDataQualityUnknownsReport(context = {}) {
    const diagnostics = runDataQualityChecks(context);
    const rows = diagnostics.issues.map((entry) => ({
      module: entry.module,
      recordId: entry.recordId,
      issueType: entry.type,
      status: entry.status,
      severity: entry.severity,
      unknown: entry.unknown,
      invalid: entry.invalid,
    }));
    return reportEnvelope("Data Quality and Unknowns Report", rows, {
      summary: diagnostics.summary,
    });
  }

  function generateAuditChangeReport(context = {}) {
    const rows = [
      ...safeArray(context.syncAudit).map((entry) => ({ source: "deal-portfolio-sync", id: entry.id, action: entry.action, timestamp: entry.timestamp, approvalState: entry.approvalState || "UNKNOWN" })),
      ...safeArray(context.underwritingAudit).map((entry) => ({ source: "underwriting", id: entry.id, action: entry.action, timestamp: entry.timestamp, approvalState: entry.approvalState || "UNKNOWN" })),
      ...safeArray(context.enterpriseAudit).map((entry) => ({ source: "enterprise", id: entry.id, action: entry.action, timestamp: entry.timestamp, approvalState: entry.approvalState || "UNKNOWN" })),
    ];
    return reportEnvelope("Audit and Change Report", rows, {});
  }

  async function exportReport(report, format = "json") {
    const parsed = parseReportFormat(format);
    if (parsed === "pdf") {
      return {
        format: "html",
        status: "FORMAT_FALLBACK",
        limitation: "PDF generation is unavailable in this environment. Returning printable HTML instead.",
        content: `<html><body><h1>${safeString(report.name, "Report")}</h1><pre>${safeString(JSON.stringify(report.rows, null, 2), "[]")}</pre></body></html>`,
      };
    }
    if (parsed === "csv") {
      return { format: "csv", status: "OK", content: toCsv(report.rows) };
    }
    if (parsed === "html" || parsed === "print") {
      return {
        format: "html",
        status: "OK",
        content: `<html><body><h1>${safeString(report.name, "Report")}</h1><p>As Of: ${safeString(report.asOfDate, "")}</p><pre>${safeString(JSON.stringify(report.rows, null, 2), "[]")}</pre></body></html>`,
      };
    }
    if (parsed === "xlsx" || parsed === "excel") {
      return { format: "xlsx", status: "OK", content: toCsv(report.rows), note: "Excel-compatible CSV payload returned." };
    }
    return { format: "json", status: "OK", content: JSON.stringify(report, null, 2) };
  }

  async function generateReport(reportType, options = {}) {
    const context = await getDataContext();
    const snapshot = await buildExecutiveSnapshot(context);

    let report;
    const normalized = safeString(reportType, "").toLowerCase();
    switch (normalized) {
      case "executive-summary":
        report = generateExecutiveReport(context, { snapshot });
        break;
      case "deal-pipeline":
        report = generateDealPipelineReport(context);
        break;
      case "underwriting":
        report = generateUnderwritingReport(context, options.dealId);
        break;
      case "valuation":
        report = generateValuationReport(context, options.dealId);
        break;
      case "offer-guidance":
        report = generateOfferGuidanceReport(context, options.dealId);
        break;
      case "buy-box":
        report = generateBuyBoxReport(context, options.dealId);
        break;
      case "portfolio-summary":
        report = generatePortfolioReport(context);
        break;
      case "portfolio-risk":
        report = generateRiskReport(context);
        break;
      case "rehab-project":
        report = reportEnvelope("Rehab Project Report", safeArray(context.rehabProjects));
        break;
      case "contractor-performance":
        report = generateContractorReport(context);
        break;
      case "lender-exposure":
        report = generateLenderExposureReport(context);
        break;
      case "product-material":
        report = generateProductMaterialReport(context);
        break;
      case "appraisal-support":
        report = generateAppraisalSupportReport(context, options.dealId);
        break;
      case "data-quality-unknowns":
        report = generateDataQualityUnknownsReport(context);
        break;
      case "audit-change":
        report = generateAuditChangeReport(context);
        break;
      default:
        report = reportEnvelope("Unknown Report", []);
    }

    const store = await readReports();
    const persisted = {
      ...report,
      type: normalized,
      approved: false,
      generatedBy: safeString(options.actor, "System Administrator"),
    };
    store.push(persisted);
    await writeReports(store);

    await appendAudit("report generated", {
      entityType: "report",
      entityId: persisted.reportId,
      approvalState: "ADVISORY",
      metadata: { type: normalized, rowCount: persisted.rowCount },
      actor: options.actor,
    });

    if (options.format) {
      const exported = await exportReport(persisted, options.format);
      await appendAudit("report exported", {
        entityType: "report",
        entityId: persisted.reportId,
        approvalState: "ADVISORY",
        metadata: { type: normalized, format: exported.format, status: exported.status },
        actor: options.actor,
      });
      return { ...persisted, export: exported };
    }

    return persisted;
  }

  async function getReportAuditHistory() {
    const audit = await readEnterpriseAudit();
    return safeArray(audit).filter((entry) => safeString(entry.entityType, "") === "report").sort((a, b) => safeString(b.timestamp, "").localeCompare(safeString(a.timestamp, "")));
  }

  function validateDocumentRequirements(type, data) {
    const requirementsByType = {
      "deal-summary": ["recordId", "propertyAddress", "status"],
      "offer-summary": ["recordId", "recommendedOffer", "maximumAllowableOffer"],
      "letter-of-intent": ["recordId", "purchasePrice"],
      "underwriting-summary": ["recordId", "recommendation"],
      "buy-box-review": ["recordId", "buyBoxResult"],
      "comp-arv-summary": ["recordId", "recommendedArv"],
      "appraiser-packet": ["recordId", "recommendedArv"],
      "rehab-scope-summary": ["recordId", "rehabBudget"],
      "contractor-assignment-summary": ["recordId", "contractorName"],
      "draw-request-summary": ["recordId", "drawAmount"],
      "change-order-summary": ["recordId", "changeOrderAmount"],
      "final-unconditional-lien-waiver-and-release": ["recordId", "contractorName", "projectName"],
      "project-closeout-summary": ["recordId", "projectStatus"],
      "lender-package": ["recordId", "lenderName"],
      "portfolio-property-summary": ["recordId", "propertyName"],
      "refinance-review": ["recordId", "loanBalance"],
      "sell-versus-hold-review": ["recordId", "strategy"],
    };

    const requiredFields = requirementsByType[type] || ["recordId"];
    const missing = requiredFields.filter((field) => {
      const value = data[field];
      return value === null || value === undefined || value === "";
    });

    return {
      requiredFields,
      missing,
      valid: missing.length === 0,
    };
  }

  function buildDocumentDataPackage(type, recordId, context = {}) {
    const normalizedType = safeString(type, "").toLowerCase();
    const deal = safeArray(context.deals).find((entry) => safeString(entry.id) === safeString(recordId));
    const property = safeArray(context.properties).find((entry) => safeString(entry.id) === safeString(recordId));
    const portfolio = safeArray(context.portfolio).find((entry) => safeString(entry.id) === safeString(recordId));
    const rehab = safeArray(context.rehabProjects).find((entry) => safeString(entry.id) === safeString(recordId));
    const packet = safeArray(context.appraisalPackets).find((entry) => safeString(entry.id) === safeString(recordId));

    const source = deal || property || portfolio || rehab || packet || {};
    const dealIntelligence = safeArray(context.dealIntelligence).find((entry) => safeString(entry.dealId || entry.id) === safeString(recordId));

    return {
      templateType: normalizedType,
      recordId: safeString(recordId, ""),
      propertyAddress: safeString(source.propertyAddress || source.address || source.propertyName || ""),
      propertyName: safeString(source.propertyName || source.projectName || source.packetName || ""),
      status: safeString(source.status || source.projectStatus || source.packetStatus || ""),
      strategy: safeString(source.strategy || ""),
      purchasePrice: safeNumber(source.purchasePrice ?? source.askingPrice, null),
      rehabBudget: safeNumber(source.rehabBudget ?? source.currentRehabBudget, null),
      approvedArv: safeNumber(dealIntelligence?.approvedArv ?? source.approvedArv ?? source.auditMetadata?.valuationGovernance?.approvedArv, null),
      recommendedArv: safeNumber(dealIntelligence?.recommendedArv ?? source.recommendedArv ?? source.auditMetadata?.valuationGovernance?.recommendedArv, null),
      recommendedOffer: safeNumber(dealIntelligence?.recommendedOffer, null),
      maximumAllowableOffer: safeNumber(dealIntelligence?.maximumAllowableOffer, null),
      buyBoxResult: safeString(dealIntelligence?.buyBoxResult || ""),
      recommendation: safeString(dealIntelligence?.recommendation || ""),
      contractorName: safeString(source.contractorName || ""),
      projectName: safeString(source.projectName || source.propertyName || ""),
      drawAmount: safeNumber(source.drawAmount, null),
      changeOrderAmount: safeNumber(source.changeOrderAmount, null),
      lenderName: safeString(source.lenderName || ""),
      loanBalance: safeNumber(source.loanBalance ?? source.currentLoanBalance, null),
      generatedAt: nowIso(),
      draft: true,
      approvalStatus: "DRAFT",
      references: {
        dealId: deal?.id || null,
        propertyId: property?.id || null,
        portfolioId: portfolio?.id || null,
        rehabProjectId: rehab?.id || null,
        appraisalPacketId: packet?.id || null,
      },
    };
  }

  async function generateDocumentDraft(type, recordId, options = {}) {
    const context = await getDataContext();
    const dataPackage = buildDocumentDataPackage(type, recordId, context);
    const validation = validateDocumentRequirements(type, dataPackage);
    const documents = await readDocuments();

    const draft = {
      id: createId("document"),
      documentName: options.documentName || `${safeString(type, "document")} - ${safeString(recordId, "UNKNOWN")}`,
      templateType: safeString(type, "custom"),
      recordId: safeString(recordId, ""),
      version: 1,
      draft: true,
      approvalStatus: "DRAFT",
      generatedAt: nowIso(),
      updatedAt: nowIso(),
      actor: safeString(options.actor, "System Administrator"),
      dataPackage,
      requiredFields: validation.requiredFields,
      missingFields: validation.missing,
      validationStatus: validation.valid ? "READY_FOR_REVIEW" : "REQUIRED_FIELDS_MISSING",
      legalApprovalStatus: "NOT_APPROVED",
      sendStatus: "NOT_SENT",
      exportHistory: [],
    };

    documents.push(draft);
    await writeDocuments(documents);

    await appendAudit("document created", {
      entityType: "document",
      entityId: draft.id,
      approvalState: "REVIEW_REQUIRED",
      actor: options.actor,
      metadata: {
        type,
        recordId,
        missingFields: validation.missing,
      },
    });

    return draft;
  }

  async function regenerateDocumentDraft(documentId, options = {}) {
    const documents = await readDocuments();
    const existing = safeArray(documents).find((entry) => safeString(entry.id) === safeString(documentId));
    if (!existing) return { ok: false, status: "DOCUMENT_NOT_FOUND" };

    const context = await getDataContext();
    const packageData = buildDocumentDataPackage(existing.templateType, existing.recordId, context);
    const validation = validateDocumentRequirements(existing.templateType, packageData);

    existing.version = safeNumber(existing.version, 1) + 1;
    existing.updatedAt = nowIso();
    existing.dataPackage = packageData;
    existing.missingFields = validation.missing;
    existing.validationStatus = validation.valid ? "READY_FOR_REVIEW" : "REQUIRED_FIELDS_MISSING";
    existing.approvalStatus = "DRAFT";
    existing.draft = true;

    await writeDocuments(documents);

    await appendAudit("document regenerated", {
      entityType: "document",
      entityId: existing.id,
      approvalState: "REVIEW_REQUIRED",
      actor: options.actor,
      metadata: { version: existing.version },
    });

    return { ok: true, status: "REGENERATED", document: existing };
  }

  async function approveDocumentDraft(documentId, userApproval, actor = "System Administrator") {
    if (userApproval !== true) {
      await appendAudit("document approval requested", {
        entityType: "document",
        entityId: documentId,
        approvalState: "DENIED",
        actor,
      });
      return { ok: false, status: "EXPLICIT_APPROVAL_REQUIRED" };
    }

    const documents = await readDocuments();
    const existing = safeArray(documents).find((entry) => safeString(entry.id) === safeString(documentId));
    if (!existing) return { ok: false, status: "DOCUMENT_NOT_FOUND" };

    existing.approvalStatus = "APPROVED";
    existing.draft = false;
    existing.approvedAt = nowIso();
    existing.approvedBy = actor;

    await writeDocuments(documents);
    await appendAudit("document approved", {
      entityType: "document",
      entityId: existing.id,
      approvalState: "APPROVED",
      actor,
      metadata: { version: existing.version },
    });

    return { ok: true, status: "APPROVED", document: existing };
  }

  async function exportDocument(documentId, format = "json", actor = "System Administrator") {
    const documents = await readDocuments();
    const existing = safeArray(documents).find((entry) => safeString(entry.id) === safeString(documentId));
    if (!existing) return { ok: false, status: "DOCUMENT_NOT_FOUND" };

    const parsed = parseReportFormat(format);
    const safeName = safeString(existing.documentName, "document").replace(/[^a-z0-9-_ ]/gi, "").trim().replace(/\s+/g, "-").toLowerCase();

    let payload;
    if (parsed === "csv") payload = toCsv([existing.dataPackage]);
    else if (parsed === "html" || parsed === "print" || parsed === "pdf") payload = `<html><body><h1>${existing.documentName}</h1><p>Status: ${existing.approvalStatus}</p><pre>${JSON.stringify(existing.dataPackage, null, 2)}</pre></body></html>`;
    else if (parsed === "xlsx" || parsed === "excel") payload = toCsv([existing.dataPackage]);
    else payload = JSON.stringify(existing.dataPackage, null, 2);

    const record = {
      exportedAt: nowIso(),
      format: parsed,
      fileName: `${safeName || "document"}.${parsed === "excel" || parsed === "xlsx" ? "csv" : parsed === "print" ? "html" : parsed}`,
      actor,
    };

    existing.exportHistory = safeArray(existing.exportHistory);
    existing.exportHistory.push(record);
    existing.updatedAt = nowIso();
    await writeDocuments(documents);

    await appendAudit("document exported", {
      entityType: "document",
      entityId: existing.id,
      approvalState: existing.approvalStatus,
      actor,
      metadata: record,
    });

    return {
      ok: true,
      status: parsed === "pdf" ? "FORMAT_FALLBACK" : "OK",
      limitation: parsed === "pdf" ? "PDF generator unavailable; printable HTML returned." : null,
      document: existing,
      export: { ...record, content: payload },
    };
  }

  async function getDocumentAuditHistory(documentId = "") {
    const audit = await readEnterpriseAudit();
    return safeArray(audit)
      .filter((entry) => safeString(entry.entityType, "") === "document" && (!documentId || safeString(entry.entityId, "") === safeString(documentId)))
      .sort((a, b) => safeString(b.timestamp, "").localeCompare(safeString(a.timestamp, "")));
  }

  function calculateKnowledgeConfidence(entry = {}) {
    const known = safeArray(entry.known);
    const uncertain = safeArray(entry.uncertain);
    const needed = safeArray(entry.needed);
    return scoreEvidence(known, uncertain, needed);
  }

  async function createKnowledgeEntry(entry = {}) {
    const store = await readKnowledge();
    const payload = {
      id: createId("knowledge"),
      category: safeString(entry.category, "observation"),
      title: safeString(entry.title, "Untitled Knowledge Entry"),
      type: safeString(entry.type, "observation"),
      policyOrLesson: safeString(entry.policyOrLesson, ""),
      sourceReferences: safeArray(entry.sourceReferences),
      evidence: safeArray(entry.evidence),
      known: safeArray(entry.known),
      uncertain: safeArray(entry.uncertain),
      needed: safeArray(entry.needed),
      confidence: calculateKnowledgeConfidence(entry),
      status: "active",
      version: 1,
      supersededBy: null,
      createdAt: nowIso(),
      updatedAt: nowIso(),
      actor: safeString(entry.actor, "System Administrator"),
      history: [],
    };

    store.push(payload);
    await writeKnowledge(store);
    await appendAudit("knowledge created", {
      entityType: "knowledge",
      entityId: payload.id,
      approvalState: "ADVISORY",
      actor: entry.actor,
      metadata: { category: payload.category, type: payload.type },
    });
    return payload;
  }

  async function updateKnowledgeEntry(entryId, changes = {}) {
    const store = await readKnowledge();
    const existing = safeArray(store).find((entry) => safeString(entry.id) === safeString(entryId));
    if (!existing) return { ok: false, status: "KNOWLEDGE_NOT_FOUND" };

    const previous = redactSensitive({ ...existing });
    existing.title = safeString(changes.title, existing.title);
    existing.type = safeString(changes.type, existing.type);
    existing.category = safeString(changes.category, existing.category);
    existing.policyOrLesson = safeString(changes.policyOrLesson, existing.policyOrLesson);
    existing.sourceReferences = safeArray(changes.sourceReferences).length ? safeArray(changes.sourceReferences) : existing.sourceReferences;
    existing.evidence = safeArray(changes.evidence).length ? safeArray(changes.evidence) : existing.evidence;
    existing.known = safeArray(changes.known).length ? safeArray(changes.known) : existing.known;
    existing.uncertain = safeArray(changes.uncertain).length ? safeArray(changes.uncertain) : existing.uncertain;
    existing.needed = safeArray(changes.needed).length ? safeArray(changes.needed) : existing.needed;
    existing.updatedAt = nowIso();
    existing.confidence = calculateKnowledgeConfidence(existing);
    existing.history = safeArray(existing.history);
    existing.history.push({ changedAt: nowIso(), actor: safeString(changes.actor, "System Administrator"), previous });

    await writeKnowledge(store);
    await appendAudit("knowledge updated", {
      entityType: "knowledge",
      entityId: existing.id,
      approvalState: "ADVISORY",
      actor: changes.actor,
      metadata: { version: existing.version },
    });
    return { ok: true, status: "UPDATED", entry: existing };
  }

  async function supersedeKnowledgeEntry(entryId, replacement = {}) {
    const store = await readKnowledge();
    const existing = safeArray(store).find((entry) => safeString(entry.id) === safeString(entryId));
    if (!existing) return { ok: false, status: "KNOWLEDGE_NOT_FOUND" };

    existing.status = "superseded";
    existing.updatedAt = nowIso();

    const next = await createKnowledgeEntry({
      ...replacement,
      category: replacement.category || existing.category,
      type: replacement.type || existing.type,
      sourceReferences: safeArray(replacement.sourceReferences).length ? replacement.sourceReferences : existing.sourceReferences,
      evidence: safeArray(replacement.evidence).length ? replacement.evidence : existing.evidence,
      actor: replacement.actor,
    });

    next.version = safeNumber(existing.version, 1) + 1;
    next.supersedes = existing.id;
    existing.supersededBy = next.id;

    await writeKnowledge(store);
    await appendAudit("knowledge superseded", {
      entityType: "knowledge",
      entityId: existing.id,
      approvalState: "ADVISORY",
      actor: replacement.actor,
      metadata: { supersededBy: next.id },
    });

    return { ok: true, status: "SUPERSEDED", previous: existing, replacement: next };
  }

  async function searchKnowledge(query, filters = {}) {
    const store = await readKnowledge();
    const normalized = normalizeSearchQuery(query);
    const categoryFilter = safeString(filters.category, "").toLowerCase();

    const matches = safeArray(store)
      .filter((entry) => {
        if (categoryFilter && safeString(entry.category, "").toLowerCase() !== categoryFilter) return false;
        const haystack = normalizeText([
          entry.title,
          entry.policyOrLesson,
          entry.category,
          entry.type,
          ...safeArray(entry.evidence),
          ...safeArray(entry.known),
          ...safeArray(entry.uncertain),
          ...safeArray(entry.needed),
        ].join(" "));
        return haystack.includes(normalized);
      })
      .map((entry) => ({
        id: entry.id,
        title: entry.title,
        category: entry.category,
        type: entry.type,
        confidence: entry.confidence,
        status: entry.status,
      }));

    return {
      query,
      normalizedQuery: normalized,
      status: matches.length ? "OK" : "NO_RESULTS",
      results: matches,
    };
  }

  async function getRelevantKnowledge(context = {}) {
    const store = await readKnowledge();
    const deal = safeObject(context.deal);
    const type = safeString(deal.propertyType, "").toLowerCase();
    const strategy = safeString(deal.strategy, "").toLowerCase();

    const relevant = safeArray(store).filter((entry) => {
      const text = normalizeText(`${entry.title} ${entry.policyOrLesson} ${entry.category} ${entry.type}`);
      if (strategy && text.includes(strategy)) return true;
      if (type && text.includes(type)) return true;
      return safeArray(entry.sourceReferences).some((ref) => safeString(ref).includes(safeString(deal.id, "")));
    });

    return relevant.slice(0, 10);
  }

  async function getKnowledgeAuditHistory() {
    const audit = await readEnterpriseAudit();
    return safeArray(audit).filter((entry) => safeString(entry.entityType, "") === "knowledge").sort((a, b) => safeString(b.timestamp, "").localeCompare(safeString(a.timestamp, "")));
  }

  function forecastProperty(property = {}, assumptions = {}, years = 1) {
    const initialValue = safeNumber(property.currentValue ?? property.value, null);
    const initialLoanBalance = safeNumber(property.loanBalance ?? property.currentLoanBalance, null);
    const monthlyRent = safeNumber(property.monthlyRent ?? property.estimatedRent, null);
    const monthlyExpenses = safeNumber(property.operatingExpenses ?? property.monthlyOperatingExpenses, null);
    const monthlyDebtService = safeNumber(property.monthlyDebtService ?? property.monthlyPayment, null);

    const appreciationRate = safeNumber(assumptions.appreciationRate, null);
    const rentGrowth = safeNumber(assumptions.rentGrowth, null);
    const expenseGrowth = safeNumber(assumptions.expenseGrowth, null);
    const vacancy = safeNumber(assumptions.vacancy, null);
    const refinanceLtv = safeNumber(assumptions.refinanceLtv, null);
    const reserveTarget = safeNumber(assumptions.reserveTarget, null);

    const required = [appreciationRate, rentGrowth, expenseGrowth, vacancy, refinanceLtv, reserveTarget];
    const missing = required.some((value) => value === null);

    if (missing || initialValue === null || initialLoanBalance === null || monthlyRent === null || monthlyExpenses === null || monthlyDebtService === null) {
      return {
        years,
        status: "INSUFFICIENT_DATA",
        propertyValue: null,
        equity: null,
        annualRent: null,
        annualExpenses: null,
        noi: null,
        debtService: null,
        cashFlow: null,
        dscr: null,
        refinanceCapacity: null,
        capitalReleased: null,
        reserveRequirement: null,
        riskScore: null,
        warnings: ["Missing assumptions or base property fields."],
      };
    }

    const propertyValue = initialValue * Math.pow(1 + appreciationRate, years);
    const annualRent = monthlyRent * 12 * Math.pow(1 + rentGrowth, years) * (1 - vacancy);
    const annualExpenses = monthlyExpenses * 12 * Math.pow(1 + expenseGrowth, years);
    const debtService = monthlyDebtService * 12;
    const noi = annualRent - annualExpenses;
    const cashFlow = noi - debtService;
    const dscr = debtService > 0 ? noi / debtService : null;
    const loanBalance = Math.max(0, initialLoanBalance * Math.max(0, 1 - years * 0.03));
    const equity = propertyValue - loanBalance;
    const refinanceCapacity = propertyValue * refinanceLtv;
    const capitalReleased = Math.max(0, refinanceCapacity - loanBalance);
    const reserveRequirement = annualExpenses * reserveTarget;
    const riskScore = Math.max(0, Math.min(100, 50 + (cashFlow < 0 ? 20 : -8) + ((dscr || 0) < 1.2 ? 15 : -6)));

    return {
      years,
      status: "OK",
      propertyValue,
      equity,
      loanBalance,
      annualRent,
      annualExpenses,
      noi,
      debtService,
      cashFlow,
      dscr,
      netWorth: equity,
      refinanceCapacity,
      capitalReleased,
      reserveRequirement,
      concentrationExposure: safeString(property.market || property.city || "UNKNOWN"),
      riskScore,
      warnings: [],
      assumptionsUsed: {
        appreciationRate,
        rentGrowth,
        expenseGrowth,
        vacancy,
        refinanceLtv,
        reserveTarget,
      },
    };
  }

  function forecastPortfolio(properties = [], assumptions = {}, years = 1) {
    const forecasts = safeArray(properties).map((property) => forecastProperty(property, assumptions, years));
    if (!forecasts.length) {
      return {
        years,
        status: "INSUFFICIENT_DATA",
        totals: null,
        properties: [],
      };
    }

    if (forecasts.some((entry) => entry.status !== "OK")) {
      return {
        years,
        status: "INSUFFICIENT_DATA",
        totals: null,
        properties: forecasts,
      };
    }

    const totals = forecasts.reduce((acc, entry) => {
      acc.propertyValue += entry.propertyValue;
      acc.equity += entry.equity;
      acc.loanBalance += entry.loanBalance;
      acc.annualRent += entry.annualRent;
      acc.annualExpenses += entry.annualExpenses;
      acc.noi += entry.noi;
      acc.debtService += entry.debtService;
      acc.cashFlow += entry.cashFlow;
      acc.refinanceCapacity += entry.refinanceCapacity;
      acc.capitalReleased += entry.capitalReleased;
      acc.reserveRequirement += entry.reserveRequirement;
      return acc;
    }, {
      propertyValue: 0,
      equity: 0,
      loanBalance: 0,
      annualRent: 0,
      annualExpenses: 0,
      noi: 0,
      debtService: 0,
      cashFlow: 0,
      refinanceCapacity: 0,
      capitalReleased: 0,
      reserveRequirement: 0,
    });

    const dscr = totals.debtService > 0 ? totals.noi / totals.debtService : null;
    const riskScore = Math.max(0, Math.min(100, 50 + (totals.cashFlow < 0 ? 18 : -7) + ((dscr || 0) < 1.2 ? 14 : -5)));

    return {
      years,
      status: "OK",
      totals: {
        ...totals,
        dscr,
        netWorth: totals.equity,
        riskScore,
      },
      properties: forecasts,
    };
  }

  function buildForecastScenarios(context = {}) {
    const assumptions = safeObject(context.assumptions);
    const properties = safeArray(context.properties);
    const years = safeArray(context.years).length ? context.years : [1, 3, 5, 10];

    const build = (factor) => {
      const variant = {
        ...assumptions,
        appreciationRate: assumptions.appreciationRate === undefined ? null : assumptions.appreciationRate * factor,
        rentGrowth: assumptions.rentGrowth === undefined ? null : assumptions.rentGrowth * factor,
      };
      return years.map((year) => forecastPortfolio(properties, variant, year));
    };

    return {
      asOfDate: nowIso().slice(0, 10),
      base: years.map((year) => forecastPortfolio(properties, assumptions, year)),
      conservative: build(0.7),
      stress: build(0.4),
      assumptions,
    };
  }

  function calculateForecastConfidence(context = {}) {
    const assumptions = safeObject(context.assumptions);
    const needed = ["appreciationRate", "rentGrowth", "expenseGrowth", "vacancy", "interestRate", "refinanceLtv", "saleCosts", "capitalExpenditures", "reserveTarget"];
    const missing = needed.filter((key) => assumptions[key] === undefined || assumptions[key] === null || assumptions[key] === "");
    const confidence = Math.max(0, 90 - missing.length * 9);
    return {
      score: confidence,
      label: confidence >= 75 ? "HIGH" : confidence >= 55 ? "MODERATE" : "LOW",
      missing,
    };
  }

  function generateForecastWarnings(context = {}) {
    const warnings = [];
    const confidence = calculateForecastConfidence(context);
    if (confidence.missing.length) {
      warnings.push(`Missing assumptions: ${confidence.missing.join(", ")}`);
    }
    const properties = safeArray(context.properties);
    if (!properties.length) warnings.push("No portfolio properties available for forecast.");
    return warnings;
  }

  async function getForecastAuditHistory() {
    const audit = await readEnterpriseAudit();
    return safeArray(audit).filter((entry) => safeString(entry.entityType, "") === "forecast").sort((a, b) => safeString(b.timestamp, "").localeCompare(safeString(a.timestamp, "")));
  }

  async function previewWorkflowTransition(type, sourceId) {
    const context = await getDataContext();
    const transitionType = safeString(type, "").toLowerCase();
    const deals = context.deals;
    const properties = context.properties;
    const portfolio = context.portfolio;
    const rehabs = context.rehabProjects;

    const deal = deals.find((entry) => safeString(entry.id) === safeString(sourceId));
    const property = properties.find((entry) => safeString(entry.id) === safeString(sourceId));
    const rehab = rehabs.find((entry) => safeString(entry.id) === safeString(sourceId));

    const transition = {
      type: transitionType,
      sourceId: safeString(sourceId, ""),
      status: "REVIEW_REQUIRED",
      approvalRequired: true,
      idempotentKey: `${transitionType}:${sourceId}`,
      duplicateBlocked: false,
      targetModule: "",
      preview: {},
      warnings: [],
      blockers: [],
    };

    if (transitionType === "accepted-deal-to-property") {
      transition.targetModule = "Property Database";
      if (!deal) return { ...transition, status: "SOURCE_NOT_FOUND" };

      const canonical = dealToCanonical(deal);
      const duplicate = detectDuplicateProperty(canonical, properties.map((entry) => portfolioToCanonical(entry)));
      transition.duplicateBlocked = duplicate.isDuplicate;
      transition.preview = {
        createProperty: !duplicate.isDuplicate,
        candidateAddress: canonical.address,
        city: canonical.city,
        state: canonical.state,
      };
      if (duplicate.isDuplicate) transition.blockers.push("Potential duplicate property record detected.");
      return transition;
    }

    if (transitionType === "purchased-deal-to-portfolio-preview") {
      transition.targetModule = "Portfolio Dashboard";
      if (!deal) return { ...transition, status: "SOURCE_NOT_FOUND" };
      const existing = portfolio.find((entry) => safeString(entry.linkedDealId) === safeString(deal.id));
      transition.preview = {
        existingPortfolioId: existing?.id || null,
        createPortfolioEntry: !existing,
      };
      transition.duplicateBlocked = Boolean(existing);
      if (existing) transition.blockers.push("Linked portfolio record already exists.");
      return transition;
    }

    if (transitionType === "approved-valuation-to-appraiser-packet") {
      transition.targetModule = "Appraiser Packet Builder";
      if (!deal) return { ...transition, status: "SOURCE_NOT_FOUND" };
      const intelligence = context.dealIntelligence.find((entry) => safeString(entry.dealId || entry.id) === safeString(deal.id));
      transition.preview = {
        approvedArv: safeNumber(intelligence?.approvedArv ?? deal.approvedArv ?? deal.auditMetadata?.valuationGovernance?.approvedArv, null),
        recommendedArv: safeNumber(intelligence?.recommendedArv ?? deal.recommendedArv ?? deal.auditMetadata?.valuationGovernance?.recommendedArv, null),
      };
      if (!transition.preview.approvedArv) transition.blockers.push("Approved ARV is missing.");
      return transition;
    }

    if (transitionType === "approved-rehab-scope-to-rehab-tracker") {
      transition.targetModule = "Rehab Project Tracker";
      if (!deal) return { ...transition, status: "SOURCE_NOT_FOUND" };
      const existing = rehabs.find((entry) => safeString(entry.linkedDealId) === safeString(deal.id));
      transition.preview = {
        existingProjectId: existing?.id || null,
        proposedBudget: safeNumber(deal.rehabBudget, null),
      };
      if (existing) transition.blockers.push("Linked rehab project already exists.");
      return transition;
    }

    if (transitionType === "selected-contractor-to-project-assignment-preview") {
      transition.targetModule = "Contractor Hub";
      if (!rehab) return { ...transition, status: "SOURCE_NOT_FOUND" };
      transition.preview = {
        rehabProjectId: rehab.id,
        assignedContractor: rehab.assignedContractor || null,
      };
      return transition;
    }

    if (transitionType === "selected-products-to-material-summary") {
      transition.targetModule = "Material Matrix";
      transition.preview = {
        productCount: context.products.length,
        materialCount: context.materials.length,
      };
      return transition;
    }

    if (transitionType === "completed-rehab-to-closeout-review") {
      transition.targetModule = "Rehab Project Tracker";
      if (!rehab) return { ...transition, status: "SOURCE_NOT_FOUND" };
      transition.preview = {
        projectStatus: rehab.projectStatus || "UNKNOWN",
        closeoutReady: safeString(rehab.projectStatus, "").toLowerCase() === "completed",
      };
      return transition;
    }

    if (transitionType === "stabilized-property-to-refinance-review") {
      transition.targetModule = "Portfolio Dashboard";
      if (!property) return { ...transition, status: "SOURCE_NOT_FOUND" };
      transition.preview = {
        occupancyStatus: property.occupancyStatus || "UNKNOWN",
        monthlyCashFlow: safeNumber(property.monthlyCashFlow, null),
      };
      return transition;
    }

    if (transitionType === "sold-property-to-exit-summary") {
      transition.targetModule = "Portfolio Dashboard";
      if (!property) return { ...transition, status: "SOURCE_NOT_FOUND" };
      transition.preview = {
        saleStatus: property.status || "UNKNOWN",
      };
      return transition;
    }

    return { ...transition, status: "UNSUPPORTED_TRANSITION" };
  }

  async function executeWorkflowTransition(type, sourceId, userApproval, actor = "System Administrator") {
    if (userApproval !== true) {
      await appendAudit("workflow transition approval requested", {
        entityType: "workflow",
        entityId: `${type}:${sourceId}`,
        approvalState: "DENIED",
        actor,
        metadata: { reason: "EXPLICIT_APPROVAL_REQUIRED" },
      });
      return { ok: false, status: "EXPLICIT_APPROVAL_REQUIRED" };
    }

    const preview = await previewWorkflowTransition(type, sourceId);
    if (preview.status !== "REVIEW_REQUIRED") {
      return { ok: false, status: preview.status || "PREVIEW_FAILED", preview };
    }
    if (preview.blockers.length > 0) {
      return { ok: false, status: "BLOCKED", preview };
    }

    const transitions = await readWorkflowTransitions();
    const idempotentKey = preview.idempotentKey;
    const existing = safeArray(transitions).find((entry) => safeString(entry.idempotentKey) === safeString(idempotentKey) && safeString(entry.status) === "APPROVED");
    if (existing) {
      return { ok: true, status: "IDEMPOTENT_NO_CHANGE", transitionEvent: existing };
    }

    const context = await getDataContext();
    let destinationRecordId = null;
    let rollbackSnapshot = null;

    if (preview.type === "accepted-deal-to-property") {
      const deals = context.deals;
      const properties = context.properties;
      const source = deals.find((entry) => safeString(entry.id) === safeString(sourceId));
      if (!source) return { ok: false, status: "SOURCE_NOT_FOUND" };
      const canonical = dealToCanonical(source);
      const newProperty = {
        id: createId("property"),
        propertyName: canonical.propertyName || canonical.address,
        address: canonical.address,
        city: canonical.city,
        state: canonical.state,
        zipCode: canonical.zipCode,
        propertyType: canonical.propertyType,
        bedrooms: canonical.bedrooms,
        bathrooms: canonical.bathrooms,
        squareFeet: canonical.squareFeet,
        yearBuilt: canonical.yearBuilt,
        purchasePrice: canonical.purchasePrice,
        rehabBudget: canonical.rehabBudget,
        strategy: canonical.strategy,
        status: "Review",
        linkedDealId: source.id,
        workflowCreatedAt: nowIso(),
      };
      await writeProperties([...properties, newProperty]);
      destinationRecordId = newProperty.id;
      rollbackSnapshot = { entity: "property", action: "delete-if-safe", createdId: newProperty.id };
    }

    if (preview.type === "purchased-deal-to-portfolio-preview") {
      const deals = context.deals;
      const portfolio = context.portfolio;
      const source = deals.find((entry) => safeString(entry.id) === safeString(sourceId));
      if (!source) return { ok: false, status: "SOURCE_NOT_FOUND" };
      const canonical = dealToCanonical(source);
      const entry = {
        id: createId("portfolio"),
        propertyName: canonical.propertyName || canonical.address,
        propertyAddress: canonical.address,
        city: canonical.city,
        state: canonical.state,
        zipCode: canonical.zipCode,
        propertyType: canonical.propertyType,
        purchasePrice: canonical.purchasePrice,
        rehabBudget: canonical.rehabBudget,
        strategy: canonical.strategy,
        status: "Review",
        linkedDealId: source.id,
        workflowCreatedAt: nowIso(),
      };
      await writePortfolio([...portfolio, entry]);
      destinationRecordId = entry.id;
      rollbackSnapshot = { entity: "portfolio", action: "delete-if-safe", createdId: entry.id };
    }

    if (preview.type === "approved-valuation-to-appraiser-packet") {
      const deals = context.deals;
      const packets = context.appraisalPackets;
      const source = deals.find((entry) => safeString(entry.id) === safeString(sourceId));
      if (!source) return { ok: false, status: "SOURCE_NOT_FOUND" };
      const packet = {
        id: createId("packet"),
        packetName: `${source.propertyAddress || source.id} Appraiser Packet`,
        propertyName: source.propertyAddress || source.address || "",
        address: source.propertyAddress || source.address || "",
        city: source.city || "",
        state: source.state || "",
        zipCode: source.zipCode || "",
        requestedARV: source.recommendedArv ?? source.auditMetadata?.valuationGovernance?.recommendedArv ?? "",
        supportedARV: source.approvedArv ?? source.auditMetadata?.valuationGovernance?.approvedArv ?? "",
        packetStatus: "Draft",
        linkedDealId: source.id,
        workflowCreatedAt: nowIso(),
      };
      await writeAppraisalPackets([...packets, packet]);
      destinationRecordId = packet.id;
      rollbackSnapshot = { entity: "appraisal-packet", action: "delete-if-safe", createdId: packet.id };
    }

    if (preview.type === "approved-rehab-scope-to-rehab-tracker") {
      const deals = context.deals;
      const rehabs = context.rehabProjects;
      const source = deals.find((entry) => safeString(entry.id) === safeString(sourceId));
      if (!source) return { ok: false, status: "SOURCE_NOT_FOUND" };
      const project = {
        id: createId("rehab"),
        projectName: `${source.propertyAddress || source.id} Rehab`,
        propertyName: source.propertyAddress || source.address || "",
        projectStatus: "Review",
        currentRehabBudget: source.rehabBudget || "",
        linkedDealId: source.id,
        workflowCreatedAt: nowIso(),
      };
      await writeRehabProjects([...rehabs, project]);
      destinationRecordId = project.id;
      rollbackSnapshot = { entity: "rehab-project", action: "delete-if-safe", createdId: project.id };
    }

    if (preview.type === "selected-contractor-to-project-assignment-preview") {
      const rehabs = context.rehabProjects;
      const source = rehabs.find((entry) => safeString(entry.id) === safeString(sourceId));
      if (!source) return { ok: false, status: "SOURCE_NOT_FOUND" };
      rollbackSnapshot = { entity: "rehab-project", action: "restore-field", id: source.id, previousValue: source.assignmentReviewStatus || null, field: "assignmentReviewStatus" };
      source.assignmentReviewStatus = "Review Required";
      source.updatedAt = nowIso();
      await writeRehabProjects(rehabs);
      destinationRecordId = source.id;
    }

    if (!destinationRecordId) {
      destinationRecordId = sourceId;
    }

    const event = {
      id: createId("workflow-transition"),
      type: preview.type,
      sourceId,
      targetModule: preview.targetModule,
      destinationRecordId,
      approvedBy: actor,
      approvedAt: nowIso(),
      status: "APPROVED",
      idempotentKey,
      rollbackSnapshot,
      notes: "Advisory and preview-first workflow execution",
    };

    transitions.push(event);
    await writeWorkflowTransitions(transitions);

    await appendAudit("workflow transition executed", {
      entityType: "workflow",
      entityId: event.id,
      approvalState: "APPROVED",
      actor,
      metadata: {
        type: preview.type,
        sourceId,
        destinationRecordId,
      },
    });

    return { ok: true, status: "APPROVED", transitionEvent: event };
  }

  async function getWorkflowTransitionStatus(type, sourceId) {
    const transitions = await readWorkflowTransitions();
    const key = `${safeString(type, "").toLowerCase()}:${safeString(sourceId, "")}`;
    const records = safeArray(transitions).filter((entry) => safeString(entry.idempotentKey) === key);
    return {
      type,
      sourceId,
      records,
      latest: records.sort((a, b) => safeString(b.approvedAt || b.createdAt, "").localeCompare(safeString(a.approvedAt || a.createdAt, "")))[0] || null,
    };
  }

  async function rollbackWorkflowTransition(eventId, actor = "System Administrator") {
    const transitions = await readWorkflowTransitions();
    const event = safeArray(transitions).find((entry) => safeString(entry.id) === safeString(eventId));
    if (!event) return { ok: false, status: "EVENT_NOT_FOUND" };
    if (event.rollbackStatus === "ROLLED_BACK") return { ok: true, status: "ALREADY_ROLLED_BACK", event };

    const snapshot = safeObject(event.rollbackSnapshot);
    if (!snapshot.action) return { ok: false, status: "ROLLBACK_NOT_AVAILABLE" };

    if (snapshot.action === "restore-field" && snapshot.entity === "rehab-project") {
      const rehabs = await readRehabProjects();
      const record = rehabs.find((entry) => safeString(entry.id) === safeString(snapshot.id));
      if (!record) return { ok: false, status: "ROLLBACK_TARGET_NOT_FOUND" };
      record[snapshot.field] = snapshot.previousValue;
      record.updatedAt = nowIso();
      await writeRehabProjects(rehabs);
      event.rollbackStatus = "ROLLED_BACK";
      event.rolledBackAt = nowIso();
      event.rolledBackBy = actor;
      await writeWorkflowTransitions(transitions);
      await appendAudit("workflow transition rolled back", {
        entityType: "workflow",
        entityId: event.id,
        approvalState: "APPROVED",
        actor,
      });
      return { ok: true, status: "ROLLED_BACK", event };
    }

    // Safe deletion is not automatic unless explicitly tracked and record remains untouched.
    if (snapshot.action === "delete-if-safe") {
      event.rollbackStatus = "REVIEW_REQUIRED";
      event.rollbackNotes = "Deletion rollback requires manual review to avoid removing user-edited records.";
      await writeWorkflowTransitions(transitions);
      await appendAudit("workflow rollback deferred", {
        entityType: "workflow",
        entityId: event.id,
        approvalState: "REVIEW_REQUIRED",
        actor,
        metadata: { reason: "MANUAL_REVIEW_REQUIRED_FOR_DELETE" },
      });
      return { ok: false, status: "MANUAL_REVIEW_REQUIRED_FOR_DELETE", event };
    }

    return { ok: false, status: "ROLLBACK_UNSUPPORTED", event };
  }

  function classifyDiagnosticIssue(issue = {}) {
    const normalized = safeObject(issue);
    if (normalized.invalid === true) return "critical";
    if (normalized.unknown === true) return "unknown";
    if (safeString(normalized.severity, "").toLowerCase() === "critical") return "critical";
    if (safeString(normalized.severity, "").toLowerCase() === "warning") return "warning";
    return "healthy";
  }

  function generateRemediationActions(issues = []) {
    return safeArray(issues).map((issue) => ({
      issueType: issue.type,
      module: issue.module,
      recordId: issue.recordId,
      remediationAction: issue.remediationAction || "Review and update record manually.",
      severity: classifyDiagnosticIssue(issue),
    }));
  }

  function runDataQualityChecks(context = {}) {
    const issues = [];

    safeArray(context.deals).forEach((deal) => {
      if (!deal.propertyAddress && !deal.address) {
        issues.push({
          type: "missing-required-fields",
          module: "Deal Analyzer",
          recordId: safeString(deal.id, ""),
          status: "Open",
          severity: "warning",
          unknown: false,
          invalid: true,
          confidence: 85,
          remediationAction: "Add property address to deal record.",
        });
      }
      if (!deal.city || !deal.state || !deal.zipCode) {
        issues.push({
          type: "broken-canonical-reference",
          module: "Deal Analyzer",
          recordId: safeString(deal.id, ""),
          status: "Open",
          severity: "warning",
          unknown: false,
          invalid: true,
          confidence: 80,
          remediationAction: "Populate city, state, and ZIP for canonical sync.",
        });
      }
    });

    safeArray(context.comps).forEach((comp) => {
      const saleDate = Date.parse(comp.saleDate || "");
      if (!Number.isFinite(saleDate)) {
        issues.push({
          type: "stale-comps",
          module: "Comp Database",
          recordId: safeString(comp.id, ""),
          status: "Open",
          severity: "unknown",
          unknown: true,
          invalid: false,
          confidence: 65,
          remediationAction: "Add sale date for comp freshness evaluation.",
        });
        return;
      }
      const ageDays = (Date.now() - saleDate) / (1000 * 60 * 60 * 24);
      if (ageDays > 365) {
        issues.push({
          type: "stale-comps",
          module: "Comp Database",
          recordId: safeString(comp.id, ""),
          status: "Open",
          severity: "warning",
          unknown: false,
          invalid: false,
          confidence: 78,
          remediationAction: "Refresh comp set with more recent comparables.",
        });
      }
    });

    const seenDealAddress = new Map();
    safeArray(context.deals).forEach((deal) => {
      const key = normalizeText(deal.propertyAddress || deal.address || "");
      if (!key) return;
      if (seenDealAddress.has(key)) {
        issues.push({
          type: "duplicate-records",
          module: "Deal Analyzer",
          recordId: safeString(deal.id, ""),
          status: "Open",
          severity: "warning",
          unknown: false,
          invalid: false,
          confidence: 70,
          remediationAction: "Review duplicate deal records for merge or archive.",
        });
      } else {
        seenDealAddress.set(key, deal.id);
      }
    });

    safeArray(context.contractors).forEach((contractor) => {
      if (!contractor.w9Status || safeString(contractor.w9Status, "").toLowerCase() === "missing") {
        issues.push({
          type: "missing-contractor-documents",
          module: "Contractor Hub",
          recordId: safeString(contractor.id, ""),
          status: "Open",
          severity: "warning",
          unknown: false,
          invalid: false,
          confidence: 74,
          remediationAction: "Collect current W-9 documentation.",
        });
      }
      if (safeString(contractor.insuranceStatus, "").toLowerCase() === "expired") {
        issues.push({
          type: "expiring-insurance",
          module: "Contractor Hub",
          recordId: safeString(contractor.id, ""),
          status: "Open",
          severity: "critical",
          unknown: false,
          invalid: true,
          confidence: 92,
          remediationAction: "Require updated insurance certificate before assignment.",
        });
      }
    });

    if (!context.assumptions || Object.keys(context.assumptions).length === 0) {
      issues.push({
        type: "unknown-portfolio-assumptions",
        module: "Portfolio Intelligence",
        recordId: "portfolio-assumptions",
        status: "Open",
        severity: "unknown",
        unknown: true,
        invalid: false,
        confidence: 68,
        remediationAction: "Enter explicit portfolio forecast assumptions.",
      });
    }

    const summary = {
      status: toStatusLabel(issues.length),
      issueCount: issues.length,
      critical: issues.filter((entry) => classifyDiagnosticIssue(entry) === "critical").length,
      warning: issues.filter((entry) => classifyDiagnosticIssue(entry) === "warning").length,
      unknown: issues.filter((entry) => classifyDiagnosticIssue(entry) === "unknown").length,
      impactedModules: [...new Set(issues.map((entry) => entry.module))],
      confidence: scoreEvidence([], issues.filter((entry) => entry.unknown).map((entry) => entry.type), issues.filter((entry) => entry.invalid).map((entry) => entry.type)),
    };

    return {
      summary,
      issues,
      remediationActions: generateRemediationActions(issues),
    };
  }

  async function runSystemDiagnostics() {
    const context = await getDataContext();
    const checks = runDataQualityChecks(context);

    const diagnostic = {
      id: createId("diagnostic"),
      timestamp: nowIso(),
      status: checks.summary.status,
      issueCount: checks.summary.issueCount,
      impactedModules: checks.summary.impactedModules,
      confidence: checks.summary.confidence,
      checks,
    };

    const history = await readDiagnosticsHistory();
    history.push(diagnostic);
    await writeDiagnosticsHistory(history);

    await appendAudit("system diagnostics executed", {
      entityType: "diagnostics",
      entityId: diagnostic.id,
      approvalState: "ADVISORY",
      metadata: {
        status: diagnostic.status,
        issueCount: diagnostic.issueCount,
      },
    });

    return diagnostic;
  }

  async function getDiagnosticsHistory() {
    const history = await readDiagnosticsHistory();
    return safeArray(history).sort((a, b) => safeString(b.timestamp, "").localeCompare(safeString(a.timestamp, "")));
  }

  return {
    buildExecutiveSnapshot,
    generateExecutivePriorities,
    generateCriticalAlerts,
    generateDecisionBlockers,
    generateAiRecommendations,
    calculateEnterpriseConfidence,
    explainRecommendation,
    getExecutiveAuditHistory,

    buildSearchIndex,
    normalizeSearchQuery,
    searchAllEntities,
    groupSearchResults,
    rankSearchResults,
    resolveSearchNavigation,
    refreshSearchIndex,

    generateExecutiveReport,
    generateDealPipelineReport,
    generateUnderwritingReport,
    generateValuationReport,
    generatePortfolioReport,
    generateRiskReport,
    generateContractorReport,
    generateAppraisalSupportReport,
    exportReport,
    getReportAuditHistory,
    generateReport,

    buildDocumentDataPackage,
    validateDocumentRequirements,
    generateDocumentDraft,
    regenerateDocumentDraft,
    approveDocumentDraft,
    exportDocument,
    getDocumentAuditHistory,

    createKnowledgeEntry,
    updateKnowledgeEntry,
    supersedeKnowledgeEntry,
    searchKnowledge,
    getRelevantKnowledge,
    calculateKnowledgeConfidence,
    getKnowledgeAuditHistory,

    forecastProperty,
    forecastPortfolio,
    buildForecastScenarios,
    calculateForecastConfidence,
    generateForecastWarnings,
    getForecastAuditHistory,

    previewWorkflowTransition,
    executeWorkflowTransition,
    getWorkflowTransitionStatus,
    rollbackWorkflowTransition,

    runSystemDiagnostics,
    runDataQualityChecks,
    classifyDiagnosticIssue,
    generateRemediationActions,
    getDiagnosticsHistory,
  };
}
