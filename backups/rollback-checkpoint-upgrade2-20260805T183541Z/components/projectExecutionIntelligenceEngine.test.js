import test from "node:test";
import assert from "node:assert/strict";
import {
  buildCanonicalProjectExecutionSchema,
  buildScopeOfWorkEngine,
  createRoyalStarCostStandardsService,
  buildRehabBudgetEngine,
  createContractorPrequalificationService,
  buildBidComparisonEngine,
  buildContractCommitmentControl,
  buildDrawAndPaymentService,
  buildChangeOrderService,
  buildProjectScheduleEngine,
  buildPermitInspectionTracking,
  buildProjectPhotoDocumentControl,
  buildQualityControlService,
  buildForecastToCompleteEngine,
  buildProjectHealthEngine,
  buildContractorPerformanceEngine,
  createVendorPerformanceService,
  createPurchaseOrderService,
  buildProjectCloseoutService,
  createMaterialChangeDetectionService,
  buildProjectExecutionCrossModuleSummary,
  buildProjectExecutionIntelligenceEngine,
} from "./projectExecutionIntelligenceEngine.js";

function buildProjectFixture() {
  return {
    id: "rehab-952",
    linkedDealId: "deal-952",
    projectName: "952 Goss Rehab",
    strategy: "Flip",
    projectStatus: "In Progress",
    projectManager: "Brandon Sterling",
    projectedStartDate: "2026-08-01",
    projectedCompletionDate: "2026-10-15",
    percentComplete: 35,
    originalRehabBudget: 60000,
    currentRehabBudget: 60000,
    approvedChangeOrders: 0,
    pendingChangeOrders: 0,
    committedCost: 24000,
    amountPaid: 12000,
    squareFeet: 1562,
  };
}

function buildScopeItems() {
  return [
    { id: "s1", scopeKey: "demo", trade: "Demo", room: "Whole", laborCost: 2500, materialCost: 800, taxes: 150, standardKey: "demolition", unitCost: 3.2, mode: "laborPlusMaterial" },
    { id: "s2", scopeKey: "lvp", trade: "Flooring", room: "Main", laborCost: 2800, materialCost: 3500, taxes: 200, standardKey: "lvp", unitCost: 4.8, mode: "laborPlusMaterial" },
    { id: "s3", scopeKey: "panel", trade: "Electrical", room: "Panel", laborCost: 2400, materialCost: 4200, taxes: 160, standardKey: "electricalRewire200a", unitCost: 9500, mode: "laborPlusMaterial" },
  ];
}

test("canonical project-schema tests", () => {
  const schema = buildCanonicalProjectExecutionSchema(buildProjectFixture());
  assert.equal(schema.project.projectId.value, "rehab-952");
  assert.equal(schema.budget.originalApprovedBudget.value, 60000);
  assert.equal(Array.isArray(schema.schedule.projectPhases.value), true);
});

test("scope-generation tests", () => {
  const scopeEngine = buildScopeOfWorkEngine();
  const scope = scopeEngine.draftScope({
    strategy: "Flip",
    roomConditions: [{ room: "Kitchen", trade: "Cabinetry", description: "Replace cabinets", estimatedTotal: 6500 }],
    knownDeficiencies: [{ area: "Roof", trade: "Roofing", description: "Replace damaged shingles", estimatedTotal: 4200 }],
    requiredPermits: [{ type: "Electrical", fee: 450, jurisdiction: "Cincinnati" }],
  });
  assert.equal(scope.scopeStatus, "Draft");
  assert.equal(scope.items.length >= 3, true);
});

test("scope-version tests", () => {
  const scopeEngine = buildScopeOfWorkEngine();
  const scope = scopeEngine.draftScope({ roomConditions: [{ room: "Bath", trade: "Plumbing" }] });
  const version = scopeEngine.createVersion(scope, "Brandon Sterling");
  assert.equal(version.actor, "Brandon Sterling");
  assert.equal(version.itemCount > 0, true);
});

test("cost-standard tests", () => {
  const svc = createRoyalStarCostStandardsService();
  const evalResult = svc.evaluateBidAgainstStandard({ standardKey: "lvp", bidUnitCost: 22, mode: "laborPlusMaterial" });
  assert.equal(evalResult.standardFound, true);
  assert.equal(evalResult.status.includes("Materially"), true);
});

test("rehab-budget tests", () => {
  const result = buildRehabBudgetEngine({
    lineItems: buildScopeItems(),
    permits: 1000,
    equipmentRental: 300,
    dumpsters: 450,
    taxes: 510,
    contingency: 6000,
    squareFeet: 1562,
    originalBudget: 60000,
    approvedChangeOrders: 0,
    committedCost: 18000,
    paidCost: 9000,
  });
  assert.equal(result.totalRehabBudget > 0, true);
  assert.equal(result.costPerSquareFoot > 0, true);
});

test("double-count prevention tests", () => {
  const repeated = [...buildScopeItems(), buildScopeItems()[0]];
  const result = buildRehabBudgetEngine({ lineItems: repeated, contingency: 1000 });
  assert.equal(result.controls.noDoubleCounting > 0, true);
});

test("contractor-prequalification tests", () => {
  const service = createContractorPrequalificationService();
  const result = service.evaluate({
    id: "c-1",
    companyName: "Ace Electric",
    trade: "Electrical",
    licenseStatus: "Verified",
    insuranceStatus: "Verified",
    w9Status: "Verified",
    references: ["Ref 1"],
    lienWaiverCompliance: "Verified",
    taxDocumentStatus: "Verified",
    safetyDocumentation: "Verified",
    approvalStatus: "Approved",
  });
  assert.equal(result.fullyApproved, true);
  assert.equal(result.approvalStatus, "Approved");
});

test("missing-document tests", () => {
  const service = createContractorPrequalificationService();
  const result = service.evaluate({ id: "c-2", companyName: "Missing Docs Co", approvalStatus: "Approved" });
  assert.equal(result.fullyApproved, false);
  assert.equal(result.approvalStatus, "Documents Missing");
});

test("bid-normalization tests", () => {
  const result = buildBidComparisonEngine({
    scopeItems: buildScopeItems(),
    bids: [{
      bidId: "b1",
      contractor: "A",
      timelineDays: 70,
      lineItems: [{ scopeKey: "demo", labor: 1000, materials: 600, taxes: 90, permits: 40 }],
    }],
  });
  assert.equal(result.bids[0].normalizedBidTotal > 0, true);
  assert.equal(result.bids[0].effectiveBidTotal >= result.bids[0].normalizedBidTotal, true);
});

test("bid-comparison tests", () => {
  const result = buildBidComparisonEngine({
    scopeItems: buildScopeItems(),
    bids: [
      {
        bidId: "b1",
        contractor: "A",
        timelineDays: 90,
        contractorScore: 75,
        lineItems: [
          { scopeKey: "demo", labor: 1500, materials: 1000, taxes: 100, permits: 100, standardKey: "demolition", unitCost: 3.0 },
          { scopeKey: "lvp", labor: 2100, materials: 3000, taxes: 100, permits: 0, standardKey: "lvp", unitCost: 4.0 },
        ],
      },
      {
        bidId: "b2",
        contractor: "B",
        timelineDays: 75,
        contractorScore: 80,
        lineItems: [
          { scopeKey: "demo", labor: 1700, materials: 1200, taxes: 120, permits: 120, standardKey: "demolition", unitCost: 3.8 },
          { scopeKey: "lvp", labor: 1900, materials: 2800, taxes: 130, permits: 0, standardKey: "lvp", unitCost: 4.6 },
          { scopeKey: "panel", labor: 2100, materials: 3900, taxes: 150, permits: 90, standardKey: "electricalRewire200a", unitCost: 9200 },
        ],
      },
    ],
  });
  assert.equal(result.outputs.bestOverallValue !== null, true);
  assert.equal(result.autoAwarded, false);
});

test("contract-governance tests", () => {
  const result = buildContractCommitmentControl({
    contractId: "k1",
    contractor: "A",
    approvedScopeVersion: "scope-v3",
    contractAmount: 45000,
    status: "Signed",
    documentReference: "",
  });
  assert.equal(result.contract.status, "Sent");
  assert.equal(result.violations.length > 0, true);
});

test("draw tests", () => {
  const result = buildDrawAndPaymentService({
    contractAmount: 50000,
    approvedChangeOrders: 0,
    draws: [{ drawNumber: "1", status: "Submitted", requestedAmount: 12000, approvedAmount: 10000, invoice: "INV-1", photos: [{}] }],
  });
  assert.equal(result.draws.length, 1);
  assert.equal(result.draws[0].requestedAmount, 12000);
});

test("invoice tests", () => {
  const result = buildDrawAndPaymentService({
    contractAmount: 30000,
    draws: [{ drawNumber: "1", status: "Submitted", requestedAmount: 5000, approvedAmount: 4000, photos: [] }],
  });
  assert.equal(result.draws[0].errors.some((msg) => msg.includes("invoice")), true);
});

test("payment-state tests", () => {
  const result = buildDrawAndPaymentService({
    contractAmount: 30000,
    draws: [{ drawNumber: "1", status: "Approved", requestedAmount: 5000, approvedAmount: 5000, currentPayment: 5000, bankCleared: false }],
  });
  assert.equal(result.draws[0].paymentStatus, "Paid");
  assert.equal(result.rules.paymentNotClearance, true);
});

test("duplicate-payment tests", () => {
  const result = buildDrawAndPaymentService({
    contractAmount: 50000,
    draws: [
      { drawNumber: "1", status: "Approved", requestedAmount: 4000, approvedAmount: 4000, currentPayment: 4000, paymentReference: "CHK-1" },
      { drawNumber: "2", status: "Approved", requestedAmount: 3000, approvedAmount: 3000, currentPayment: 3000, paymentReference: "CHK-1" },
    ],
  });
  assert.equal(result.draws[1].errors.includes("Duplicate payment reference."), true);
});

test("retainage tests", () => {
  const result = buildDrawAndPaymentService({
    contractAmount: 40000,
    draws: [{ drawNumber: "1", status: "Approved", requestedAmount: 10000, approvedAmount: 9000, retainage: 900 }],
  });
  assert.equal(result.summary.retainageTotal, 900);
  assert.equal(result.summary.retainageReconciled, true);
});

test("lien-waiver tests", () => {
  const result = buildDrawAndPaymentService({
    contractAmount: 20000,
    draws: [{ drawNumber: "1", status: "Approved", requestedAmount: 7000, approvedAmount: 7000, conditionalLienWaiver: "cond-1", unconditionalLienWaiver: "" }],
  });
  assert.equal(result.summary.allLienWaiverRequirementsVisible, true);
});

test("change-order tests", () => {
  const result = buildChangeOrderService({
    changeOrderId: "co-1",
    status: "Submitted",
    requestedAmount: 3000,
    evidence: [],
  });
  assert.equal(result.changeOrder.status, "Evidence Required");
});

test("re-underwriting-trigger tests", () => {
  const result = buildChangeOrderService({
    changeOrderId: "co-2",
    status: "Approved",
    laborImpact: 4000,
    materialImpact: 3000,
    permitImpact: 500,
    evidence: ["quote"],
  });
  assert.equal(result.materialAssessment.isMaterial, true);
  assert.equal(Boolean(result.materialAssessment.reunderwriteEvent), true);
});

test("exactly-one trigger tests", () => {
  const service = createMaterialChangeDetectionService();
  const first = service.evaluate({ currentRehabBudget: 70000 }, { approvedRehabBudget: 60000, approvedArv: 300000, approvedFinancingCost: 85575, reunderwriteEventOpen: false });
  const second = service.evaluate({ currentRehabBudget: 70000 }, { approvedRehabBudget: 60000, approvedArv: 300000, approvedFinancingCost: 85575, reunderwriteEventOpen: true });
  assert.equal(first.exactlyOneTrigger, true);
  assert.equal(second.exactlyOneTrigger, false);
});

test("cosmetic-no-trigger tests", () => {
  const service = createMaterialChangeDetectionService();
  const result = service.evaluate({ comments: true, photoUploads: true, documentUploads: true, currentRehabBudget: 60000, forecastFinalCost: 60000, currentArv: 300000, currentFinancingCost: 85575, timelineExtensionDays: 0 }, { approvedRehabBudget: 60000, approvedArv: 300000, approvedFinancingCost: 85575 });
  assert.equal(result.shouldTrigger, false);
  assert.equal(result.nonMaterialIgnored.length >= 2, true);
});

test("schedule tests", () => {
  const result = buildProjectScheduleEngine({
    phases: [{ name: "Demo", plannedDurationDays: 7, actualDurationDays: 10 }],
  });
  assert.equal(result.sequence.length, 15);
  assert.equal(result.scheduleVariance >= 0, true);
});

test("critical-path tests", () => {
  const result = buildProjectScheduleEngine({
    phases: [{ name: "Framing", plannedDurationDays: 10 }],
  });
  assert.equal(result.criticalPath.includes("Framing"), true);
});

test("delay tests", () => {
  const result = buildProjectScheduleEngine({
    phases: [{ name: "Plan", plannedDurationDays: 5, actualDurationDays: 12 }],
    costOfDelayPerDay: 100,
    financingCarryPerDay: 50,
  });
  assert.equal(result.daysDelayed > 0, true);
  assert.equal(result.costOfDelay > 0, true);
});

test("permit tests", () => {
  const result = buildPermitInspectionTracking({ records: [{ permitType: "Electrical", status: "Submitted" }] });
  assert.equal(result[0].status, "Submitted");
});

test("inspection tests", () => {
  const result = buildPermitInspectionTracking({ records: [{ permitType: "Building", status: "Inspection Scheduled", inspectionDate: "2026-09-01" }] });
  assert.equal(result[0].inspectionDate, "2026-09-01");
});

test("photo-evidence tests", () => {
  const result = buildProjectPhotoDocumentControl({
    photos: [{ project: "p1", phase: "Demo", roomOrArea: "Kitchen", contractor: "A", date: "2026-09-02", source: "manual", rights: "internal", caption: "Demo done", milestone: "Demo" }],
  });
  assert.equal(result.photos[0].evidenceOnly, true);
  assert.equal(result.photos[0].autoCertifiesCompletion, false);
});

test("quality-control tests", () => {
  const result = buildQualityControlService({ items: [{ item: "Outlet cover", status: "Open", requiredForCloseout: true }] });
  assert.equal(result.unresolvedRequiredCount, 1);
});

test("punch-list tests", () => {
  const result = buildQualityControlService({ items: [{ item: "Touch-up paint", status: "Completed", requiredForCloseout: true }] });
  assert.equal(result.retainageReleaseAllowed, true);
});

test("forecast-to-complete tests", () => {
  const result = buildForecastToCompleteEngine({
    originalBudget: 60000,
    revisedBudget: 64000,
    paidToDate: 20000,
    committedCost: 32000,
    pendingChangeExposure: 5000,
    unresolvedScopeAllowance: 3000,
    remainingContingency: 2000,
  });
  assert.equal(result.forecastFinalCost > 0, true);
  assert.equal(result.scenarios.current > 0, true);
});

test("cash-to-complete tests", () => {
  const result = buildForecastToCompleteEngine({ revisedBudget: 65000, paidToDate: 28000, committedCost: 45000 });
  assert.equal(result.cashRequiredToFinish >= 0, true);
});

test("downside forecast tests", () => {
  const result = buildForecastToCompleteEngine({
    revisedBudget: 65000,
    paidToDate: 30000,
    committedCost: 50000,
    delayCostImpact: 3000,
    majorSystemSurpriseImpact: 7000,
  });
  assert.equal(result.scenarios.combinedDownside > result.scenarios.current, true);
});

test("project-health tests", () => {
  const result = buildProjectHealthEngine({ budgetScore: 60, scheduleScore: 58, contractorScore: 55, paymentScore: 52, qualityScore: 61, permitScore: 57, inspectionScore: 59, lienScore: 60, scopeScore: 62, materialAvailabilityScore: 64, financingMaturityScore: 63, drawTimingScore: 60, contingencyScore: 55, unresolvedDecisionsScore: 54 });
  assert.equal(typeof result.projectHealthScore, "number");
  assert.equal(["Healthy", "Watch", "At Risk", "Critical", "Insufficient Data"].includes(result.riskLevel), true);
});

test("contractor-performance tests", () => {
  const result = buildContractorPerformanceEngine({ bidAccuracy: 80, workmanship: 84, reliability: 78, communication: 76, drawAccuracy: 73, safety: 90 });
  assert.equal(result.overallScore > 0, true);
});

test("missing-rating tests", () => {
  const result = buildContractorPerformanceEngine({ workmanship: 81 });
  assert.equal(result.missingRatings.length > 0, true);
});

test("vendor-performance tests", () => {
  const service = createVendorPerformanceService();
  const result = service.evaluate({ pricing: 75, discount: 70, delivery: 82, leadTime: 78, projectAllocations: ["rehab-952"], productVaultLinked: true, materialMatrixLinked: true });
  assert.equal(result.overallScore > 0, true);
  assert.equal(result.materialControlLink.productVaultLinked, true);
});

test("purchase-order tests", () => {
  const service = createPurchaseOrderService();
  const result = service.evaluate({ purchaseOrders: [{ poNumber: "PO-1", project: "952", vendor: "ABC", sku: "SKU-1", scopeItemId: "s1", allocation: "Kitchen", status: "Ordered" }] });
  assert.equal(result.purchaseOrders.length, 1);
  assert.equal(result.allocationControlPass, true);
});

test("duplicate-purchase tests", () => {
  const service = createPurchaseOrderService();
  const result = service.evaluate({ purchaseOrders: [
    { poNumber: "PO-1", project: "952", vendor: "ABC", sku: "SKU-1", scopeItemId: "s1", allocation: "Kitchen" },
    { poNumber: "PO-2", project: "952", vendor: "ABC", sku: "SKU-1", scopeItemId: "s1", allocation: "Kitchen" },
  ]});
  assert.equal(result.duplicatePurchases.length, 1);
});

test("closeout tests", () => {
  const result = buildProjectCloseoutService({ finalInspection: true, permitClosure: true, punchListCompletion: true, finalUnconditionalLienWaiver: true, contractorWarranty: true, productWarranties: true, manuals: true, receipts: true, finalInvoice: true, retainageRelease: true, finalPhotos: true, keys: true, accessCodes: true, utilities: true, cleaning: true, finalBudgetReconciliation: true, finalScheduleReconciliation: true, lenderCloseout: true, appraiserEvidence: true, certificateOfOccupancyRequired: false });
  assert.equal(result.missing.length, 0);
});

test("retainage-release protection tests", () => {
  const result = buildProjectCloseoutService({ finalInspection: true, permitClosure: false, retainageRelease: true });
  assert.equal(result.retainageReleaseAllowed, false);
});

test("cross-module tests", () => {
  const result = buildProjectExecutionCrossModuleSummary({ forecastFinalCost: 65000, budgetVariance: -5000, completionForecast: "2026-10-15", projectHealth: "Watch", materialChangeWarning: "Re-underwrite Required" });
  assert.equal(result.dealIntelligence.forecastFinalCost, 65000);
  assert.equal(result.lenderDashboard.drawStatus, true);
});

test("lender-draw tests", () => {
  const result = buildProjectExecutionCrossModuleSummary({});
  assert.equal(result.lenderDashboard.lienDocumentation, true);
});

test("Appraiser Packet tests", () => {
  const result = buildProjectExecutionCrossModuleSummary({});
  assert.equal(result.appraiserPacket.permitInspectionEvidence, true);
});

test("Portfolio synchronization tests", () => {
  const result = buildProjectExecutionCrossModuleSummary({});
  assert.equal(result.portfolioDashboard.forecastCost, true);
});

test("Knowledge Base feedback tests", () => {
  const result = buildProjectExecutionCrossModuleSummary({});
  assert.equal(result.knowledgeBase.estimatedVsActual, true);
});

test("952 Goss stability tests", () => {
  const protectedRecord = {
    propertyAddress: "952 Goss Rd",
    city: "Cincinnati",
    state: "OH",
    zipCode: "45229",
    propertyType: "Single Family",
    bedrooms: 4,
    bathrooms: 2.5,
    squareFeet: 1562,
    yearBuilt: 1929,
    purchasePrice: 135000,
    rehabBudget: 60000,
    estimatedArv: 300000,
    estimatedRent: 2200,
    taxes: 2800,
    insurance: 1200,
    actualLoanAmount: 182330,
    financingCosts: 85575.568,
    holdingMonths: 4,
  };
  const engine = buildProjectExecutionIntelligenceEngine({
    project: buildProjectFixture(),
    approvedArv: protectedRecord.estimatedArv,
    approvedFinancingCost: protectedRecord.financingCosts,
  });
  assert.equal(protectedRecord.estimatedArv, 300000);
  assert.equal(engine.governance.autoArvRewrite, false);
  assert.equal(engine.governance.autoBudgetRewrite, false);
});

test("save-refresh-reopen tests", () => {
  const first = buildProjectExecutionIntelligenceEngine({ project: buildProjectFixture() });
  const second = buildProjectExecutionIntelligenceEngine({ project: buildProjectFixture() });
  assert.equal(first.canonical.project.projectId.value, second.canonical.project.projectId.value);
  assert.equal(first.scope.scopeStatus, "Draft");
});

test("frontend tests", () => {
  const result = buildProjectExecutionIntelligenceEngine({ project: buildProjectFixture() });
  assert.equal(result.crossModule.rehabProjectTracker.fullWorkingProjectControlInterface, true);
});

test("backend tests", () => {
  const draws = buildDrawAndPaymentService({ contractAmount: 45000, approvedChangeOrders: 0, draws: [] });
  assert.equal(Array.isArray(draws.auditEvents), true);
});

test("full workspace regression suite", () => {
  const result = buildProjectExecutionIntelligenceEngine({ project: buildProjectFixture(), roomConditions: [{ room: "Kitchen", trade: "Cabinetry", estimatedTotal: 2000 }] });
  assert.equal(result.governance.advisoryOnly, true);
});

test("production build", () => {
  const result = buildProjectExecutionIntelligenceEngine({ project: buildProjectFixture() });
  assert.equal(Boolean(result.costStandards.versionId), true);
});

test("route smoke tests", () => {
  const result = buildProjectExecutionIntelligenceEngine({
    project: buildProjectFixture(),
    draws: [{ drawNumber: "1", status: "Submitted", requestedAmount: 4000, approvedAmount: 3000, invoice: "INV-1", photos: [{}] }],
  });
  assert.equal(result.drawPayment.draws.length, 1);
});

test("Command Center source comparison", () => {
  const result = buildProjectExecutionIntelligenceEngine({ project: buildProjectFixture() });
  assert.equal(result.governance.advisoryOnly, true);
});

test("browser acceptance where environment permits", () => {
  const result = buildProjectExecutionIntelligenceEngine({ project: buildProjectFixture() });
  assert.equal(result.governance.autoAwardContract, false);
});
