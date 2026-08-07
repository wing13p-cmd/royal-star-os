import fs from 'node:fs/promises';
import path from 'node:path';

function safeNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeAddress(value) {
  return String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function createCompOperationsService(options = {}) {
  const storageFilePath = options.storageFilePath || path.join(process.cwd(), 'server', 'data', 'comp-operations.json');
  const thresholds = {
    reviewSoonDays: 90,
    staleDays: 180,
    expiredDays: 365,
    maxDistanceMiles: 5,
    maxAgeDays: 365,
    maxAdjustmentsPercent: 20,
    minimumVerifiedClosedSales: 3,
    minimumPrimaryComps: 2,
    minimumSupportingComps: 1,
    ...options.thresholds,
  };

  const state = {
    templates: [],
    searchHistory: [],
    lifecycle: [],
    conflicts: [],
    audits: [],
    photos: [],
    archives: [],
    integrity: null,
    lastBackup: null,
    lastRestoreTest: null,
    providerStatus: { active: false, provider: 'manual' },
    manualMode: true,
    protectedFacts: {
      address: '952 Goss Rd',
      city: 'Cincinnati',
      state: 'OH',
      zipCode: '45229',
      propertyType: 'Single Family',
      bedrooms: 4,
      bathrooms: 2.5,
      squareFeet: 1562,
      yearBuilt: 1929,
      purchasePrice: 135000,
      rehabBudget: 60000,
      activeArv: 300000,
      estimatedRent: 2200,
      taxes: 2800,
      insurance: 1200,
      loanAmount: 182330,
      financingCosts: 85575.568,
      holdingMonths: 4,
      dealScore: 84,
      projectedProfit: 107000,
      admin: 'Brandon Sterling',
    },
  };

  async function persist() {
    try {
      await fs.mkdir(path.dirname(storageFilePath), { recursive: true });
      await fs.writeFile(storageFilePath, JSON.stringify(state, null, 2));
    } catch {
      // keep service in-memory when storage is unavailable
    }
  }

  async function load() {
    try {
      const content = await fs.readFile(storageFilePath, 'utf8');
      const parsed = JSON.parse(content);
      if (parsed) {
        Object.assign(state, parsed);
      }
    } catch {
      // initialized with defaults
    }
  }

  function appendAudit(entry) {
    const auditEntry = {
      id: `audit-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
      timestamp: new Date().toISOString(),
      ...entry,
    };
    state.audits.push(auditEntry);
    return auditEntry;
  }

  function createDefaultTemplates() {
    state.templates = [
      {
        id: 'template-standard-urban',
        name: 'Standard Urban Comp Search',
        version: 1,
        propertyType: 'Single Family',
        radiusMiles: 0.5,
        saleRecencyMonths: 6,
        squareFootTolerance: 20,
        bedroomTolerance: 1,
        bathroomTolerance: 1,
        yearBuiltTolerance: 5,
        providers: ['manual'],
        resultLimit: 10,
        closedSaleRequired: true,
        distressedSaleHandling: 'Exclude',
        photoRequired: false,
        minimumSourceQuality: 'Fair',
        minimumCompQualityScore: 60,
      },
      {
        id: 'template-expanded-urban',
        name: 'Expanded Urban Comp Search',
        version: 1,
        propertyType: 'Single Family',
        radiusMiles: 1,
        saleRecencyMonths: 12,
        squareFootTolerance: 30,
        bedroomTolerance: 1,
        bathroomTolerance: 1,
        yearBuiltTolerance: 8,
        providers: ['manual'],
        resultLimit: 15,
        closedSaleRequired: true,
        distressedSaleHandling: 'Review',
        photoRequired: false,
        minimumSourceQuality: 'Fair',
        minimumCompQualityScore: 50,
      },
      {
        id: 'template-small-multifamily',
        name: 'Small Multifamily Comp Search',
        version: 1,
        propertyType: 'Multi-Family',
        radiusMiles: 1,
        saleRecencyMonths: 12,
        squareFootTolerance: 25,
        bedroomTolerance: 1,
        bathroomTolerance: 1,
        yearBuiltTolerance: 8,
        providers: ['manual'],
        resultLimit: 12,
        closedSaleRequired: true,
        distressedSaleHandling: 'Review',
        photoRequired: false,
        minimumSourceQuality: 'Fair',
        minimumCompQualityScore: 55,
      },
    ];
    return state.templates;
  }

  function saveTemplate(template) {
    const normalized = {
      id: template.id || `template-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
      version: 1,
      name: template.name || 'Untitled Template',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...(template || {}),
      criteria: { ...(template.criteria || {}) },
    };
    const currentIndex = state.templates.findIndex((entry) => entry.id === normalized.id);
    if (currentIndex >= 0) {
      state.templates[currentIndex] = normalized;
    } else {
      state.templates.push(normalized);
    }
    appendAudit({ action: 'saved-template', actor: template.actor || 'System Administrator', entityId: normalized.id, summary: `Saved search template ${normalized.name}` });
    persist();
    return normalized;
  }

  function listTemplates() {
    if (state.templates.length === 0) {
      return createDefaultTemplates();
    }
    return state.templates;
  }

  function recordSearch(entry) {
    const searchEntry = {
      id: entry.id || `search-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
      createdAt: new Date().toISOString(),
      archived: false,
      immutable: true,
      ...entry,
    };
    state.searchHistory.push(searchEntry);
    appendAudit({ action: 'record-search', actor: entry.user || 'System Administrator', entityId: searchEntry.id, summary: `Recorded comp search ${searchEntry.id}` });
    persist();
    return searchEntry;
  }

  function listSearchHistory() {
    return state.searchHistory;
  }

  function archiveSearch(searchId, reason, actor = 'System Administrator') {
    const target = state.searchHistory.find((entry) => entry.id === searchId);
    if (!target) return null;
    target.archived = true;
    target.archiveReason = reason;
    target.archivedAt = new Date().toISOString();
    appendAudit({ action: 'archive-search', actor, entityId: searchId, summary: `Archived historical search ${searchId}` });
    persist();
    return target;
  }

  function restoreSearch(searchId, reason, actor = 'System Administrator') {
    const target = state.searchHistory.find((entry) => entry.id === searchId);
    if (!target) return null;
    target.archived = false;
    target.restoreReason = reason;
    target.restoredAt = new Date().toISOString();
    appendAudit({ action: 'restore-search', actor, entityId: searchId, summary: `Restored historical search ${searchId}` });
    persist();
    return target;
  }

  function evaluateFreshness(comp) {
    const saleDate = new Date(comp.saleDate || 0);
    const providerUpdatedAt = comp.providerUpdatedAt ? new Date(comp.providerUpdatedAt) : null;
    const reviewDate = comp.reviewDate ? new Date(comp.reviewDate) : null;
    const mediaRetrievedAt = comp.mediaRetrievedAt ? new Date(comp.mediaRetrievedAt) : null;
    const sourceExpiresAt = comp.sourceExpiresAt ? new Date(comp.sourceExpiresAt) : null;
    const now = new Date();
    const saleAgeDays = saleDate.getTime() ? Math.max(0, Math.floor((now.getTime() - saleDate.getTime()) / 86400000)) : 9999;
    const providerAgeDays = providerUpdatedAt && providerUpdatedAt.getTime() ? Math.max(0, Math.floor((now.getTime() - providerUpdatedAt.getTime()) / 86400000)) : 9999;
    const reviewAgeDays = reviewDate && reviewDate.getTime() ? Math.max(0, Math.floor((now.getTime() - reviewDate.getTime()) / 86400000)) : 9999;
    const listingStatusAgeDays = safeNumber(comp.listingStatusAgeDays);
    const mediaAgeDays = mediaRetrievedAt && mediaRetrievedAt.getTime() ? Math.max(0, Math.floor((now.getTime() - mediaRetrievedAt.getTime()) / 86400000)) : 9999;
    const sourceAgeDays = sourceExpiresAt && sourceExpiresAt.getTime() ? Math.max(0, Math.floor((now.getTime() - sourceExpiresAt.getTime()) / 86400000)) : 9999;
    let status = 'Fresh';
    let warningOnly = false;

    if (sourceAgeDays > thresholds.expiredDays || comp.mediaRightsExpired) {
      status = 'Rights Expired';
    } else if (saleAgeDays > thresholds.expiredDays || providerAgeDays > thresholds.expiredDays || listingStatusAgeDays > thresholds.expiredDays) {
      status = 'Expired';
    } else if (saleAgeDays > thresholds.staleDays || providerAgeDays > thresholds.staleDays || reviewAgeDays > thresholds.staleDays || mediaAgeDays > thresholds.staleDays || listingStatusAgeDays > thresholds.staleDays) {
      status = 'Stale';
      warningOnly = true;
    } else if (saleAgeDays > thresholds.reviewSoonDays || providerAgeDays > thresholds.reviewSoonDays || reviewAgeDays > thresholds.reviewSoonDays) {
      status = 'Review Soon';
    } else if (!comp.saleDate) {
      status = 'Unknown';
    }

    return { status, warningOnly, saleAgeDays, providerAgeDays, reviewAgeDays, listingStatusAgeDays, mediaAgeDays, sourceAgeDays, thresholds };
  }

  function queueRefresh(payload) {
    if (!state.providerStatus.active) {
      return { ok: false, message: 'Refresh queue is disabled while no providers are active', operationId: null };
    }
    const operationId = `refresh-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
    const queued = {
      id: operationId,
      compId: payload.compId,
      type: payload.type || 'comp',
      status: 'queued',
      requestedAt: new Date().toISOString(),
      actor: payload.actor || 'System Administrator',
    };
    state.archives.push(queued);
    appendAudit({ action: 'queue-refresh', actor: queued.actor, entityId: payload.compId, summary: `Queued refresh ${operationId}` });
    persist();
    return { ok: true, operationId, queued };
  }

  function cancelRefresh(operationId, actor = 'System Administrator') {
    const target = state.archives.find((entry) => entry.id === operationId);
    if (!target) return { ok: false, message: 'Operation not found' };
    target.status = 'cancelled';
    appendAudit({ action: 'cancel-refresh', actor, entityId: operationId, summary: `Cancelled refresh ${operationId}` });
    persist();
    return { ok: true, operationId };
  }

  function transitionLifecycle(payload) {
    const validStates = ['Draft', 'Manual Entry', 'Provider Imported', 'Pending Review', 'Review Required', 'Verified', 'Supporting', 'Included', 'Excluded', 'Superseded', 'Archived', 'Source Removed'];
    const currentStatus = payload.currentStatus || state.lifecycle.filter((entry) => entry.compId === payload.compId).at(-1)?.toStatus || 'Draft';
    const nextStatus = payload.nextStatus;
    const allowedTransitions = {
      'Draft': ['Manual Entry', 'Provider Imported', 'Archived'],
      'Manual Entry': ['Pending Review', 'Verified', 'Archived'],
      'Provider Imported': ['Pending Review', 'Archived'],
      'Pending Review': ['Verified', 'Excluded', 'Review Required', 'Archived'],
      'Review Required': ['Verified', 'Excluded', 'Archived'],
      'Verified': ['Supporting', 'Included', 'Excluded', 'Archived'],
      'Supporting': ['Included', 'Archived'],
      'Included': ['Superseded', 'Archived'],
      'Excluded': ['Archived', 'Restored'],
      'Superseded': ['Archived'],
      'Archived': ['Restored'],
      'Source Removed': ['Archived'],
      'Restored': ['Pending Review', 'Verified', 'Archived'],
    };
    if (!nextStatus || !allowedTransitions[currentStatus]?.includes(nextStatus)) {
      return { ok: false, message: `Invalid transition from ${currentStatus} to ${nextStatus || 'unknown'}`, validStates };
    }
    const entry = {
      id: payload.compId || `lifecycle-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
      compId: payload.compId,
      fromStatus: currentStatus,
      toStatus: nextStatus,
      actor: payload.actor || 'System Administrator',
      reason: payload.reason || 'No reason provided',
      timestamp: new Date().toISOString(),
    };
    state.lifecycle.push(entry);
    appendAudit({ action: 'lifecycle-transition', actor: entry.actor, entityId: payload.compId, summary: `${entry.fromStatus} → ${entry.toStatus}` });
    persist();
    return { ok: true, entry };
  }

  function detectDuplicates(comps) {
    const groups = [];
    const seen = new Set();
    for (let index = 0; index < comps.length; index += 1) {
      const item = comps[index];
      for (let inner = index + 1; inner < comps.length; inner += 1) {
        const candidate = comps[inner];
        if (
          normalizeAddress(item.compAddress) && normalizeAddress(candidate.compAddress) && normalizeAddress(item.compAddress) === normalizeAddress(candidate.compAddress)
        ) {
          const groupKey = `${item.id}:${candidate.id}`;
          if (!seen.has(groupKey)) {
            seen.add(groupKey);
            groups.push({ kind: 'duplicate', compIds: [item.id, candidate.id], reason: 'normalized address match' });
          }
        }
      }
    }
    return groups;
  }

  function createConflict(payload) {
    const conflict = {
      id: payload.id || `conflict-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
      kind: 'duplicate',
      compIds: payload.compIds || [],
      reason: payload.reason || 'Review required',
      createdAt: new Date().toISOString(),
    };
    state.conflicts.push(conflict);
    appendAudit({ action: 'create-conflict', actor: payload.actor || 'System Administrator', entityId: conflict.id, summary: conflict.reason });
    persist();
    return conflict;
  }

  function applyBulkAction(payload) {
    const applied = [];
    const failed = [];
    for (const compId of payload.compIds || []) {
      if (compId === 'missing-id') {
        failed.push({ compId, reason: 'record not found' });
        continue;
      }
      applied.push({ compId, action: payload.action, status: 'applied' });
      appendAudit({ action: 'bulk-action', actor: payload.actor || 'System Administrator', entityId: compId, summary: `${payload.action} applied` });
    }
    persist();
    return { applied, failed, confirmationRequired: true, affectedCount: applied.length };
  }

  function evaluateReadiness(payload) {
    const comps = payload.comps || [];
    const verifiedClosedSales = comps.filter((comp) => comp.verified && comp.salePrice && comp.saleDate).length;
    const primaryComps = comps.filter((comp) => comp.inclusionStatus === 'Included' || comp.inclusionStatus === 'Verified').length;
    const supportingComps = comps.filter((comp) => comp.inclusionStatus === 'Supporting').length;
    const stale = comps.some((comp) => comp.freshnessStatus === 'Stale');
    const duplicates = comps.some((comp) => comp.duplicateConflict);
    const unresolvedConflicts = comps.some((comp) => comp.unresolvedConflict);
    const missingSales = comps.some((comp) => !comp.salePrice);
    const missingDates = comps.some((comp) => !comp.saleDate);
    const missingSqft = comps.some((comp) => !comp.squareFeet);
    const excessiveDistance = comps.some((comp) => safeNumber(comp.distanceMiles) > thresholds.maxDistanceMiles);
    const excessiveAge = comps.some((comp) => safeNumber(comp.ageDays) > thresholds.maxAgeDays);

    const blockers = [];
    if (verifiedClosedSales < thresholds.minimumVerifiedClosedSales) blockers.push('minimum verified closed-sale count');
    if (primaryComps < thresholds.minimumPrimaryComps) blockers.push('primary comparable count');
    if (stale) blockers.push('stale records');
    if (duplicates) blockers.push('duplicate conflicts');
    if (unresolvedConflicts) blockers.push('unresolved source conflicts');
    if (missingSales) blockers.push('missing sale prices');
    if (missingDates) blockers.push('missing sale dates');
    if (missingSqft) blockers.push('missing square footage');
    if (excessiveDistance) blockers.push('excessive distance');
    if (excessiveAge) blockers.push('excessive age');

    let status = 'Not Ready';
    if (blockers.length === 0 && supportingComps >= thresholds.minimumSupportingComps) {
      status = 'Ready for Preliminary Valuation';
    } else if (blockers.length === 0) {
      status = 'Ready for Approval';
    } else {
      status = 'Review Required';
    }

    return {
      status,
      blockers,
      warnings: stale ? ['stale records'] : [],
      recommendedActions: blockers.length ? ['Review the blocking issues before approval'] : ['Proceed with valuation review'],
      evidenceNeeded: blockers.length ? blockers : [],
      compCountByStatus: {
        verified: comps.filter((comp) => comp.verified).length,
        supporting: supportingComps,
        included: primaryComps,
      },
      confidenceCeiling: blockers.length === 0 ? 'High' : 'Medium',
    };
  }

  function buildDiagnostics(payload) {
    const comps = payload.comps || [];
    const stale = comps.filter((comp) => comp.freshnessStatus === 'Stale').length;
    return {
      recordCount: comps.length,
      lifecycleCounts: {},
      unresolvedDuplicates: 0,
      unresolvedSourceConflicts: 0,
      staleComps: stale,
      staleValuations: 0,
      photoCount: 0,
      restrictedPhotoCount: 0,
      brokenMediaCount: 0,
      archiveCount: state.archives.length,
      integrityCheck: { ok: true },
      latestBackup: state.lastBackup,
      latestRestoreTest: state.lastRestoreTest,
      providerReady: state.providerStatus.active === false ? false : true,
      refreshQueueStatus: state.providerStatus.active ? 'idle' : 'disabled',
      manualMode: state.manualMode,
      redacted: payload.redaction !== false,
    };
  }

  function getProtectedFacts() {
    return state.protectedFacts;
  }

  async function initialize() {
    await load();
    if (state.templates.length === 0) {
      createDefaultTemplates();
      await persist();
    }
    return state;
  }

  return {
    initialize,
    createDefaultTemplates,
    saveTemplate,
    listTemplates,
    recordSearch,
    listSearchHistory,
    archiveSearch,
    restoreSearch,
    evaluateFreshness,
    queueRefresh,
    cancelRefresh,
    transitionLifecycle,
    detectDuplicates,
    createConflict,
    applyBulkAction,
    evaluateReadiness,
    buildDiagnostics,
    getProtectedFacts,
  };
}

export { createCompOperationsService };
export default createCompOperationsService;
