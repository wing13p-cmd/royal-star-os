import {
  dealToCanonical,
  portfolioToCanonical,
  canonicalToPortfolio,
  canonicalToDeal,
  validateCanonicalRecord,
  mergeCanonicalRecords,
  detectDuplicateProperty,
} from "./canonicalDataFoundation.js";

function safeString(value, fallback = "") {
  if (value === null || value === undefined) return fallback;
  return typeof value === "string" ? value : String(value);
}

function nowIso() {
  return new Date().toISOString();
}

function createId(prefix = "portfolio") {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

const ELIGIBLE_STATUSES = new Set([
  "purchased",
  "closed",
  "owned",
  "active rehab",
  "hold",
  "brrrr",
  "rental",
]);

const DEAL_OWNED_FIELDS = new Set([
  "askingPrice",
  "purchasePrice",
  "rehabBudget",
  "leadSource",
  "strategy",
  "status",
  "address",
  "city",
  "state",
  "zipCode",
  "propertyType",
  "bedrooms",
  "bathrooms",
  "squareFeet",
  "yearBuilt",
]);

const PORTFOLIO_OWNED_FIELDS = new Set([
  "currentValue",
  "loanBalance",
  "monthlyRent",
  "operatingExpenses",
  "occupancyRate",
  "annualInsurance",
  "annualTaxes",
  "status",
  "favorite",
]);

const SYSTEM_PROTECTED_FIELDS = new Set([
  "approvedArv",
  "supportedArv",
  "supportedARV",
  "reviewedComps",
  "approvedPortfolioValuation",
  "manualLenderSelection",
  "approvedFinancingTerms",
  "manualPropertyCorrections",
  "auditMetadata",
]);

function normalizeStatus(value) {
  return safeString(value, "").trim().toLowerCase();
}

function buildAuditEvent(action, payload = {}) {
  return {
    id: `sync-audit-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    timestamp: nowIso(),
    action,
    sourceRecord: payload.sourceRecord || null,
    destinationRecord: payload.destinationRecord || null,
    changedFields: Array.isArray(payload.changedFields) ? payload.changedFields : [],
    preservedFields: Array.isArray(payload.preservedFields) ? payload.preservedFields : [],
    conflicts: Array.isArray(payload.conflicts) ? payload.conflicts : [],
    approvalState: safeString(payload.approvalState, "REVIEW_REQUIRED"),
    actor: safeString(payload.actor, "System Administrator"),
    syncVersion: Number(payload.syncVersion || 1),
    rollbackSnapshot: payload.rollbackSnapshot || null,
    metadata: payload.metadata || {},
  };
}

function sanitizeForAudit(value) {
  if (value === null || value === undefined) return value;
  if (typeof value === "string") {
    return value
      .replace(/(api[_-]?key|token|secret|password)=([^&\s]+)/ig, "$1=REDACTED")
      .replace(/Bearer\s+[A-Za-z0-9._-]+/g, "Bearer REDACTED");
  }
  if (Array.isArray(value)) return value.map((entry) => sanitizeForAudit(entry));
  if (typeof value === "object") {
    const clone = {};
    Object.entries(value).forEach(([key, entry]) => {
      if (/(api[_-]?key|token|secret|password)/i.test(key)) clone[key] = "REDACTED";
      else clone[key] = sanitizeForAudit(entry);
    });
    return clone;
  }
  return value;
}

function buildSyncFingerprint(dealCanonical, portfolioCanonical) {
  return JSON.stringify({
    dealId: dealCanonical.dealId,
    portfolioId: portfolioCanonical?.portfolioId || null,
    address: dealCanonical.address,
    purchasePrice: dealCanonical.purchasePrice,
    rehabBudget: dealCanonical.rehabBudget,
    strategy: dealCanonical.strategy,
    status: dealCanonical.status,
  });
}

export function createDealPortfolioSyncService(options = {}) {
  const readDeals = options.readDeals;
  const writeDeals = options.writeDeals;
  const readPortfolio = options.readPortfolio;
  const writePortfolio = options.writePortfolio;
  const readAudit = options.readAudit;
  const writeAudit = options.writeAudit;

  if (!readDeals || !writeDeals || !readPortfolio || !writePortfolio || !readAudit || !writeAudit) {
    throw new Error("createDealPortfolioSyncService requires read/write handlers for deals, portfolio, and audit");
  }

  async function appendAudit(event) {
    const auditEvents = await readAudit();
    auditEvents.push(sanitizeForAudit(event));
    await writeAudit(auditEvents);
    return event;
  }

  function isDealEligible(dealRecord) {
    const status = normalizeStatus(dealRecord.status);
    const strategy = normalizeStatus(dealRecord.strategy);
    return ELIGIBLE_STATUSES.has(status) || ELIGIBLE_STATUSES.has(strategy);
  }

  function computePreview(deal, portfolioRecords) {
    const canonicalDeal = dealToCanonical(deal);
    const validation = validateCanonicalRecord(canonicalDeal);

    if (!validation.valid) {
      return {
        ok: false,
        status: "REVIEW_REQUIRED",
        approvalRequired: true,
        missingRequiredInformation: validation.errors,
        conflicts: [],
        protectedFieldWarnings: [],
        duplicateWarnings: [],
        fieldsToCreate: [],
        fieldsToUpdate: [],
        fieldsUnchanged: [],
      };
    }

    const linked = portfolioRecords.find((entry) => safeString(entry.linkedDealId) === safeString(deal.id));
    const duplicate = detectDuplicateProperty(canonicalDeal, portfolioRecords.map((entry) => portfolioToCanonical(entry)));

    const duplicateWarnings = [];
    if (duplicate.reviewRequired) {
      duplicateWarnings.push({ type: "POSSIBLE_DUPLICATE", reason: duplicate.reason, confidence: duplicate.confidence, recordId: duplicate.matchedRecord?.portfolioId || duplicate.matchedRecord?.id || null });
    }

    const targetPortfolio = linked || (duplicate.isDuplicate ? portfolioRecords.find((entry) => safeString(entry.id) === safeString(duplicate.matchedRecord?.portfolioId || duplicate.matchedRecord?.id)) : null);

    if (!targetPortfolio) {
      const created = canonicalToPortfolio({
        ...canonicalDeal,
        propertyName: canonicalDeal.propertyName || canonicalDeal.address,
        dealId: safeString(deal.id),
        portfolioId: null,
        syncStatus: "PENDING_APPROVAL",
      });
      return {
        ok: true,
        status: duplicate.reviewRequired ? "REVIEW_REQUIRED" : "READY",
        approvalRequired: true,
        missingRequiredInformation: [],
        conflicts: [],
        protectedFieldWarnings: [],
        duplicateWarnings,
        fieldsToCreate: Object.keys(created).filter((key) => created[key] !== null && created[key] !== ""),
        fieldsToUpdate: [],
        fieldsUnchanged: [],
        targetRecordExists: false,
        targetPortfolioId: null,
      };
    }

    const canonicalPortfolio = portfolioToCanonical(targetPortfolio);
    const mergeResult = mergeCanonicalRecords(
      {
        ...canonicalPortfolio,
        protectedFields: Array.from(new Set([...(canonicalPortfolio.protectedFields || []), ...Array.from(SYSTEM_PROTECTED_FIELDS)])),
      },
      {
        ...canonicalDeal,
        portfolioId: canonicalPortfolio.portfolioId,
      },
      {
        approvedFields: canonicalPortfolio.approvedFields || [],
        protectedFields: Array.from(new Set([...(canonicalPortfolio.protectedFields || []), ...Array.from(SYSTEM_PROTECTED_FIELDS)])),
      },
    );

    const filteredChanges = mergeResult.changedFields.filter((field) => DEAL_OWNED_FIELDS.has(field));
    const fieldsUnchanged = mergeResult.changedFields.filter((field) => !DEAL_OWNED_FIELDS.has(field));
    const protectedFieldWarnings = mergeResult.conflicts.filter((entry) => entry.reason === "PROTECTED_FIELD");

    const ownershipConflicts = mergeResult.changedFields
      .filter((field) => PORTFOLIO_OWNED_FIELDS.has(field))
      .map((field) => ({ field, reason: "PORTFOLIO_OWNED_FIELD_PRESERVED" }));

    return {
      ok: true,
      status: duplicate.reviewRequired ? "REVIEW_REQUIRED" : "READY",
      approvalRequired: true,
      missingRequiredInformation: [],
      conflicts: [...mergeResult.conflicts, ...ownershipConflicts],
      protectedFieldWarnings,
      duplicateWarnings,
      fieldsToCreate: [],
      fieldsToUpdate: filteredChanges,
      fieldsUnchanged: [...new Set([...fieldsUnchanged, ...mergeResult.preservedFields])],
      targetRecordExists: true,
      targetPortfolioId: targetPortfolio.id,
      targetCanonical: canonicalPortfolio,
      mergedCanonical: mergeResult.record,
    };
  }

  async function listEligibleDeals() {
    const deals = await readDeals();
    return deals.filter((deal) => isDealEligible(deal)).map((deal) => ({
      id: deal.id,
      propertyAddress: deal.propertyAddress,
      city: deal.city,
      state: deal.state,
      zipCode: deal.zipCode,
      status: deal.status,
      strategy: deal.strategy,
      purchasePrice: deal.purchasePrice,
      rehabBudget: deal.rehabBudget,
      estimatedArv: deal.estimatedArv,
      updatedAt: deal.updatedAt,
    }));
  }

  async function previewDealToPortfolioSync(dealId, actor = "System Administrator") {
    const deals = await readDeals();
    const portfolio = await readPortfolio();

    const deal = deals.find((entry) => safeString(entry.id) === safeString(dealId));
    if (!deal) {
      const event = buildAuditEvent("sync blocked", {
        sourceRecord: { dealId },
        approvalState: "BLOCKED",
        conflicts: [{ reason: "DEAL_NOT_FOUND" }],
        actor,
      });
      await appendAudit(event);
      return { ok: false, status: "DEAL_NOT_FOUND", approvalRequired: true };
    }

    if (!isDealEligible(deal)) {
      const event = buildAuditEvent("sync blocked", {
        sourceRecord: { dealId: deal.id },
        conflicts: [{ reason: "DEAL_NOT_ELIGIBLE" }],
        approvalState: "BLOCKED",
        actor,
      });
      await appendAudit(event);
      return { ok: false, status: "DEAL_NOT_ELIGIBLE", approvalRequired: true };
    }

    const preview = computePreview(deal, portfolio);
    const event = buildAuditEvent("sync preview generated", {
      sourceRecord: { dealId: deal.id },
      destinationRecord: { portfolioId: preview.targetPortfolioId || null },
      changedFields: preview.fieldsToUpdate,
      preservedFields: preview.fieldsUnchanged,
      conflicts: preview.conflicts,
      approvalState: "REVIEW_REQUIRED",
      actor,
      syncVersion: 1,
      metadata: { duplicateWarnings: preview.duplicateWarnings },
    });
    await appendAudit(event);

    return {
      ok: true,
      dealId: deal.id,
      dealAddress: deal.propertyAddress,
      approvalRequired: true,
      ...preview,
    };
  }

  async function executeDealToPortfolioSync(dealId, userApproval, actor = "System Administrator") {
    if (userApproval !== true) {
      const event = buildAuditEvent("sync blocked", {
        sourceRecord: { dealId },
        approvalState: "DENIED",
        conflicts: [{ reason: "EXPLICIT_APPROVAL_REQUIRED" }],
        actor,
      });
      await appendAudit(event);
      return { ok: false, status: "EXPLICIT_APPROVAL_REQUIRED", approvalRequired: true };
    }

    const deals = await readDeals();
    const portfolio = await readPortfolio();
    const preview = await previewDealToPortfolioSync(dealId, actor);

    if (!preview.ok) return preview;
    if (preview.status === "REVIEW_REQUIRED" && preview.duplicateWarnings.length > 0) {
      const event = buildAuditEvent("duplicate detected", {
        sourceRecord: { dealId },
        destinationRecord: { portfolioId: preview.targetPortfolioId || null },
        conflicts: preview.duplicateWarnings,
        approvalState: "REVIEW_REQUIRED",
        actor,
      });
      await appendAudit(event);
      return { ok: false, status: "REVIEW_REQUIRED_DUPLICATE", preview };
    }

    const dealIndex = deals.findIndex((entry) => safeString(entry.id) === safeString(dealId));
    if (dealIndex === -1) return { ok: false, status: "DEAL_NOT_FOUND", approvalRequired: true };

    const deal = deals[dealIndex];
    const canonicalDeal = dealToCanonical(deal);

    if (!preview.targetRecordExists) {
      const portfolioRecord = canonicalToPortfolio({
        ...canonicalDeal,
        propertyName: canonicalDeal.propertyName || canonicalDeal.address,
        portfolioId: createId("portfolio"),
        syncStatus: "SYNCED",
        lastSyncedAt: nowIso(),
        syncVersion: 1,
        auditMetadata: {
          sourceModule: "Deal Analyzer",
          sourceRecordId: deal.id,
          lastSyncEvent: "CREATED_FROM_DEAL",
        },
      });

      const fingerprint = buildSyncFingerprint(canonicalDeal, portfolioToCanonical(portfolioRecord));
      const existingByFingerprint = portfolio.find((entry) => safeString(entry.auditMetadata?.lastSyncFingerprint) === fingerprint);
      if (existingByFingerprint) {
        return {
          ok: true,
          status: "ALREADY_SYNCED",
          dealId,
          portfolioId: existingByFingerprint.id,
          created: false,
          updated: false,
          auditState: "NO_CHANGE",
        };
      }

      portfolioRecord.linkedDealId = deal.id;
      portfolioRecord.auditMetadata = {
        ...(portfolioRecord.auditMetadata || {}),
        lastSyncFingerprint: fingerprint,
      };

      const nextPortfolio = [...portfolio, portfolioRecord];
      const nextDeal = {
        ...deal,
        portfolioId: portfolioRecord.id,
        syncStatus: "SYNCED",
        syncVersion: Number(deal.syncVersion || 1),
        lastSyncedAt: nowIso(),
        protectedFields: Array.from(new Set([...(Array.isArray(deal.protectedFields) ? deal.protectedFields : []), ...Array.from(SYSTEM_PROTECTED_FIELDS)])),
        auditMetadata: {
          ...(deal.auditMetadata && typeof deal.auditMetadata === "object" ? deal.auditMetadata : {}),
          lastSyncFingerprint: fingerprint,
          lastSyncEvent: "SYNC_CREATED",
        },
      };

      const nextDeals = deals.slice();
      nextDeals[dealIndex] = canonicalToDeal(nextDeal);

      await writePortfolio(nextPortfolio);
      await writeDeals(nextDeals);

      const event = buildAuditEvent("sync completed", {
        sourceRecord: { dealId: deal.id },
        destinationRecord: { portfolioId: portfolioRecord.id },
        changedFields: preview.fieldsToCreate,
        preservedFields: preview.fieldsUnchanged,
        conflicts: preview.conflicts,
        approvalState: "APPROVED",
        actor,
        syncVersion: 1,
        rollbackSnapshot: {
          dealBefore: deal,
          dealAfter: nextDeals[dealIndex],
          portfolioBefore: null,
          portfolioAfter: portfolioRecord,
        },
      });
      await appendAudit(event);

      return {
        ok: true,
        status: "SYNCED",
        dealId: deal.id,
        portfolioId: portfolioRecord.id,
        created: true,
        updated: false,
        fieldsCreated: preview.fieldsToCreate,
        fieldsUpdated: [],
        fieldsPreserved: preview.fieldsUnchanged,
      };
    }

    const targetIndex = portfolio.findIndex((entry) => safeString(entry.id) === safeString(preview.targetPortfolioId));
    if (targetIndex === -1) return { ok: false, status: "PORTFOLIO_TARGET_NOT_FOUND", approvalRequired: true };

    const targetPortfolio = portfolio[targetIndex];
    const canonicalPortfolio = portfolioToCanonical(targetPortfolio);

    const protectedFields = Array.from(new Set([
      ...(Array.isArray(canonicalPortfolio.protectedFields) ? canonicalPortfolio.protectedFields : []),
      ...Array.from(SYSTEM_PROTECTED_FIELDS),
      ...Array.from(PORTFOLIO_OWNED_FIELDS),
    ]));

    const mergeResult = mergeCanonicalRecords(
      { ...canonicalPortfolio, protectedFields },
      { ...canonicalDeal, portfolioId: canonicalPortfolio.portfolioId || targetPortfolio.id },
      { protectedFields },
    );

    const syncedCanonical = {
      ...mergeResult.record,
      syncStatus: "SYNCED",
      lastSyncedAt: nowIso(),
      sourceModule: "Deal Analyzer",
      sourceRecordId: deal.id,
    };

    const fingerprint = buildSyncFingerprint(canonicalDeal, syncedCanonical);
    if (safeString(targetPortfolio.auditMetadata?.lastSyncFingerprint) === fingerprint) {
      return {
        ok: true,
        status: "ALREADY_SYNCED",
        dealId: deal.id,
        portfolioId: targetPortfolio.id,
        created: false,
        updated: false,
        fieldsUpdated: [],
      };
    }

    const mergedPortfolio = {
      ...targetPortfolio,
      ...canonicalToPortfolio(syncedCanonical),
      id: targetPortfolio.id,
      linkedDealId: deal.id,
      updatedAt: nowIso(),
      auditMetadata: {
        ...(targetPortfolio.auditMetadata && typeof targetPortfolio.auditMetadata === "object" ? targetPortfolio.auditMetadata : {}),
        lastSyncFingerprint: fingerprint,
        lastSyncEvent: "SYNC_UPDATED",
      },
      protectedFields,
    };

    // Preserve portfolio-owned fields from manual entries.
    Array.from(PORTFOLIO_OWNED_FIELDS).forEach((field) => {
      if (targetPortfolio[field] !== undefined && targetPortfolio[field] !== null && targetPortfolio[field] !== "") {
        mergedPortfolio[field] = targetPortfolio[field];
      }
    });

    const nextPortfolio = portfolio.slice();
    nextPortfolio[targetIndex] = mergedPortfolio;

    const nextDeal = {
      ...deal,
      portfolioId: mergedPortfolio.id,
      syncStatus: "SYNCED",
      syncVersion: Number(deal.syncVersion || 1),
      lastSyncedAt: nowIso(),
      protectedFields: Array.from(new Set([...(Array.isArray(deal.protectedFields) ? deal.protectedFields : []), ...Array.from(SYSTEM_PROTECTED_FIELDS)])),
      auditMetadata: {
        ...(deal.auditMetadata && typeof deal.auditMetadata === "object" ? deal.auditMetadata : {}),
        lastSyncFingerprint: fingerprint,
        lastSyncEvent: "SYNC_UPDATED",
      },
    };
    const nextDeals = deals.slice();
    nextDeals[dealIndex] = canonicalToDeal(nextDeal);

    await writePortfolio(nextPortfolio);
    await writeDeals(nextDeals);

    const event = buildAuditEvent("sync completed", {
      sourceRecord: { dealId: deal.id },
      destinationRecord: { portfolioId: mergedPortfolio.id },
      changedFields: mergeResult.changedFields.filter((field) => DEAL_OWNED_FIELDS.has(field)),
      preservedFields: mergeResult.preservedFields,
      conflicts: mergeResult.conflicts,
      approvalState: "APPROVED",
      actor,
      syncVersion: Number(mergedPortfolio.syncVersion || 1),
      rollbackSnapshot: {
        dealBefore: deal,
        dealAfter: nextDeals[dealIndex],
        portfolioBefore: targetPortfolio,
        portfolioAfter: mergedPortfolio,
      },
    });
    await appendAudit(event);

    return {
      ok: true,
      status: "SYNCED",
      dealId: deal.id,
      portfolioId: mergedPortfolio.id,
      created: false,
      updated: true,
      fieldsUpdated: mergeResult.changedFields.filter((field) => DEAL_OWNED_FIELDS.has(field)),
      fieldsPreserved: mergeResult.preservedFields,
      conflicts: mergeResult.conflicts,
    };
  }

  async function getDealPortfolioSyncStatus(dealId) {
    const deals = await readDeals();
    const portfolio = await readPortfolio();
    const deal = deals.find((entry) => safeString(entry.id) === safeString(dealId));
    if (!deal) return { ok: false, status: "DEAL_NOT_FOUND" };

    const linked = portfolio.find((entry) => safeString(entry.linkedDealId) === safeString(deal.id) || safeString(entry.id) === safeString(deal.portfolioId));

    return {
      ok: true,
      dealId: deal.id,
      linkedPortfolioId: linked?.id || deal.portfolioId || null,
      syncStatus: safeString(deal.syncStatus, "NOT_SYNCED"),
      syncVersion: Number(deal.syncVersion || 1),
      lastSyncedAt: deal.lastSyncedAt || null,
      eligible: isDealEligible(deal),
    };
  }

  async function reconcileDealAndPortfolio(dealId, portfolioId, actor = "System Administrator") {
    const deals = await readDeals();
    const portfolio = await readPortfolio();

    const deal = deals.find((entry) => safeString(entry.id) === safeString(dealId));
    const target = portfolio.find((entry) => safeString(entry.id) === safeString(portfolioId));

    if (!deal || !target) {
      const event = buildAuditEvent("conflict detected", {
        sourceRecord: { dealId },
        destinationRecord: { portfolioId },
        conflicts: [{ reason: "RECONCILE_NOT_FOUND" }],
        actor,
      });
      await appendAudit(event);
      return { ok: false, status: "RECONCILE_NOT_FOUND" };
    }

    const dealCanonical = dealToCanonical(deal);
    const portfolioCanonical = portfolioToCanonical(target);

    const conflicts = [];
    if (dealCanonical.address && portfolioCanonical.address && dealCanonical.address.toLowerCase() !== portfolioCanonical.address.toLowerCase()) {
      conflicts.push({ field: "address", deal: dealCanonical.address, portfolio: portfolioCanonical.address });
    }
    if (dealCanonical.zipCode && portfolioCanonical.zipCode && dealCanonical.zipCode !== portfolioCanonical.zipCode) {
      conflicts.push({ field: "zipCode", deal: dealCanonical.zipCode, portfolio: portfolioCanonical.zipCode });
    }

    const event = buildAuditEvent(conflicts.length ? "conflict detected" : "sync completed", {
      sourceRecord: { dealId },
      destinationRecord: { portfolioId },
      conflicts,
      approvalState: conflicts.length ? "REVIEW_REQUIRED" : "APPROVED",
      actor,
    });
    await appendAudit(event);

    return {
      ok: true,
      status: conflicts.length ? "REVIEW_REQUIRED" : "RECONCILED",
      conflicts,
      reviewRequired: conflicts.length > 0,
    };
  }

  async function rollbackLastSyncEvent(dealId, actor = "System Administrator") {
    const auditEvents = await readAudit();
    const matching = auditEvents
      .filter((entry) => entry.action === "sync completed" && safeString(entry.sourceRecord?.dealId) === safeString(dealId))
      .sort((a, b) => safeString(b.timestamp).localeCompare(safeString(a.timestamp)));

    const latest = matching[0];
    if (!latest || !latest.rollbackSnapshot) {
      return { ok: false, status: "NO_ROLLBACK_SNAPSHOT" };
    }

    const deals = await readDeals();
    const portfolio = await readPortfolio();

    const { dealBefore, portfolioBefore, portfolioAfter } = latest.rollbackSnapshot;

    const nextDeals = deals.slice();
    const dealIndex = nextDeals.findIndex((entry) => safeString(entry.id) === safeString(dealBefore?.id || dealId));
    if (dealIndex >= 0 && dealBefore) {
      nextDeals[dealIndex] = dealBefore;
    }

    let nextPortfolio = portfolio.slice();
    const afterId = safeString(portfolioAfter?.id);
    const beforeId = safeString(portfolioBefore?.id);

    if (portfolioBefore && beforeId) {
      const beforeIndex = nextPortfolio.findIndex((entry) => safeString(entry.id) === beforeId);
      if (beforeIndex >= 0) nextPortfolio[beforeIndex] = portfolioBefore;
      else nextPortfolio.push(portfolioBefore);
    } else if (afterId) {
      nextPortfolio = nextPortfolio.filter((entry) => safeString(entry.id) !== afterId);
    }

    await writeDeals(nextDeals);
    await writePortfolio(nextPortfolio);

    const event = buildAuditEvent("rollback performed", {
      sourceRecord: { dealId },
      destinationRecord: { portfolioId: beforeId || afterId || null },
      approvalState: "APPROVED",
      actor,
      metadata: { rollbackFromAuditId: latest.id },
    });
    await appendAudit(event);

    return {
      ok: true,
      status: "ROLLED_BACK",
      dealId,
      portfolioId: beforeId || afterId || null,
    };
  }

  async function listAuditEvents() {
    return readAudit();
  }

  return {
    listEligibleDeals,
    previewDealToPortfolioSync,
    executeDealToPortfolioSync,
    getDealPortfolioSyncStatus,
    reconcileDealAndPortfolio,
    rollbackLastSyncEvent,
    listAuditEvents,
  };
}
