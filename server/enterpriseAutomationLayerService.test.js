import test from "node:test";
import assert from "node:assert/strict";
import { createEnterpriseAutomationLayerService } from "./enterpriseAutomationLayerService.js";

function fixture() {
  const db = {
    deals: [
      {
        id: "deal-1",
        propertyAddress: "952 Goss Rd",
        city: "Covington",
        state: "KY",
        zipCode: "41011",
        status: "active",
        strategy: "Flip",
        purchasePrice: 135000,
        rehabBudget: 60000,
        approvedArv: 300000,
        recommendedArv: 305000,
        reviewRequired: false,
        valuationReviewStatus: "PRELIMINARY",
      },
      {
        id: "deal-2",
        propertyAddress: "111 Risky Ave",
        city: "Cincinnati",
        state: "OH",
        zipCode: "45211",
        status: "active",
        strategy: "BRRRR",
        purchasePrice: 180000,
        rehabBudget: 90000,
        recommendedArv: 250000,
        reviewRequired: true,
        valuationReviewStatus: "REVIEW_REQUIRED",
      },
    ],
    properties: [
      {
        id: "property-952",
        propertyName: "952 Goss Rd",
        address: "952 Goss Rd",
        city: "Covington",
        state: "KY",
        zipCode: "41011",
        currentValue: 320000,
        loanBalance: 190000,
        monthlyRent: 2500,
        operatingExpenses: 900,
        monthlyDebtService: 1200,
        reserveStatus: "healthy",
      },
    ],
    portfolio: [
      {
        id: "portfolio-1",
        propertyName: "952 Goss Rd",
        propertyAddress: "952 Goss Rd",
        city: "Covington",
        state: "KY",
        zipCode: "41011",
        strategy: "Hold",
        status: "Active",
        currentValue: 320000,
        loanBalance: 190000,
        monthlyRent: 2500,
        operatingExpenses: 900,
      },
    ],
    comps: [
      { id: "comp-1", compAddress: "953 Goss Rd", city: "Covington", state: "KY", zipCode: "41011", salePrice: 302000, saleDate: "2026-06-01", inclusionStatus: "approved", included: true, verified: true, qualityScore: 84, squareFeet: 1500 },
      { id: "comp-2", compAddress: "954 Goss Rd", city: "Covington", state: "KY", zipCode: "41011", salePrice: 297000, saleDate: "2026-05-20", inclusionStatus: "approved", included: true, verified: true, qualityScore: 82, squareFeet: 1480 },
      { id: "comp-3", compAddress: "955 Goss Rd", city: "Covington", state: "KY", zipCode: "41011", salePrice: 305000, saleDate: "2026-04-15", inclusionStatus: "reviewed", included: true, verified: true, qualityScore: 80, squareFeet: 1520 },
      { id: "comp-stale", compAddress: "Old Sale", city: "Covington", state: "KY", zipCode: "41011", salePrice: 100000, saleDate: "", inclusionStatus: "pending", included: false, verified: false, qualityScore: 60, squareFeet: 1200 },
    ],
    neighborhoods: [{ id: "n1", city: "Covington", state: "KY", zipCode: "41011" }],
    contractors: [{ id: "c1", contractorName: "Alpha Contracting", insuranceStatus: "expired", w9Status: "missing", licenseStatus: "active" }],
    vendors: [{ id: "v1", vendorName: "Prime Vendor", status: "Active" }],
    lenders: [{ id: "l1", lenderName: "Royal Lender", status: "Active", totalCurrentBalance: 450000 }],
    products: [{ id: "p1", productName: "Cabinet Set", sku: "CAB-001", status: "Active" }],
    materials: [{ id: "m1", materialName: "Drywall", sku: "DRY-002", status: "Active" }],
    rehabProjects: [{ id: "r1", projectName: "Goss Rehab", propertyName: "952 Goss Rd", projectStatus: "In Progress", currentRehabBudget: 60000, actualCost: 71000, linkedDealId: "deal-1" }],
    appraisalPackets: [{ id: "ap1", packetName: "952 Packet", propertyName: "952 Goss Rd", status: "Draft" }],
    dealIntelligence: [
      {
        id: "di-1",
        dealId: "deal-1",
        recommendation: "Buy",
        dealScore: 84,
        projectedProfit: 78000,
        buyBoxResult: "PASS",
        decisionConfidence: 82,
        approvedArv: 300000,
        recommendedArv: 305000,
        offerConfidenceScore: 80,
        requiredFollowUpItems: [],
      },
      {
        id: "di-2",
        dealId: "deal-2",
        recommendation: "Conditional Buy",
        dealScore: 58,
        projectedProfit: 18000,
        buyBoxResult: "REVIEW REQUIRED",
        decisionConfidence: 48,
        approvedArv: null,
        recommendedArv: 250000,
        offerConfidenceScore: 40,
        requiredFollowUpItems: ["Need approved ARV"],
      },
    ],
    underwritingAudit: [{ id: "ua1", approvalState: "REVIEW_REQUIRED", action: "valuation preview generated" }],
    syncAudit: [{ id: "sa1", action: "deal-to-portfolio preview", approvalState: "REVIEW_REQUIRED", timestamp: new Date().toISOString() }],
    enterpriseAudit: [],
    reports: [],
    documents: [],
    knowledge: [],
    workflows: [],
    diagnosticsHistory: [],
  };

  const service = createEnterpriseAutomationLayerService({
    readDeals: async () => db.deals,
    writeDeals: async (next) => { db.deals = next; },
    readProperties: async () => db.properties,
    writeProperties: async (next) => { db.properties = next; },
    readPortfolio: async () => db.portfolio,
    writePortfolio: async (next) => { db.portfolio = next; },
    readComps: async () => db.comps,
    readNeighborhoods: async () => db.neighborhoods,
    readContractors: async () => db.contractors,
    readVendors: async () => db.vendors,
    readLenders: async () => db.lenders,
    readProducts: async () => db.products,
    readMaterials: async () => db.materials,
    readRehabProjects: async () => db.rehabProjects,
    writeRehabProjects: async (next) => { db.rehabProjects = next; },
    readAppraisalPackets: async () => db.appraisalPackets,
    writeAppraisalPackets: async (next) => { db.appraisalPackets = next; },
    readDealIntelligence: async () => db.dealIntelligence,
    readUnderwritingAudit: async () => db.underwritingAudit,
    readSyncAudit: async () => db.syncAudit,
    readEnterpriseAudit: async () => db.enterpriseAudit,
    writeEnterpriseAudit: async (next) => { db.enterpriseAudit = next; },
    readReports: async () => db.reports,
    writeReports: async (next) => { db.reports = next; },
    readDocuments: async () => db.documents,
    writeDocuments: async (next) => { db.documents = next; },
    readKnowledge: async () => db.knowledge,
    writeKnowledge: async (next) => { db.knowledge = next; },
    readWorkflowTransitions: async () => db.workflows,
    writeWorkflowTransitions: async (next) => { db.workflows = next; },
    readDiagnosticsHistory: async () => db.diagnosticsHistory,
    writeDiagnosticsHistory: async (next) => { db.diagnosticsHistory = next; },
  });

  return { db, service };
}

test("executive snapshot aggregates current data", async () => {
  const { service } = fixture();
  const snapshot = await service.buildExecutiveSnapshot();
  assert.ok(snapshot.activeDealCount >= 2);
  assert.ok(Array.isArray(snapshot.todaysPriorities));
});

test("critical blockers prevent false-ready recommendations", async () => {
  const { service } = fixture();
  const snapshot = await service.buildExecutiveSnapshot();
  assert.ok(snapshot.decisionBlockers.length > 0);
  assert.equal(snapshot.acquisitionsPosture, "Constrained");
});

test("missing data reduces AI confidence", async () => {
  const { service, db } = fixture();
  db.deals = [];
  const snapshot = await service.buildExecutiveSnapshot();
  assert.ok(snapshot.confidenceScore < 70);
});

test("global search returns grouped results", async () => {
  const { service } = fixture();
  const result = await service.searchAllEntities("goss", {});
  assert.equal(result.status, "OK");
  assert.ok(result.totalResults > 0);
  assert.ok(result.groupedResults.deals || result.groupedResults.properties || result.groupedResults.portfolio);
});

test("global search does not expose credentials", async () => {
  const { service, db } = fixture();
  db.deals[0].notes = "token=abc123";
  const result = await service.searchAllEntities("token", {});
  const serialized = JSON.stringify(result);
  assert.equal(serialized.includes("abc123"), false);
});

test("reports generate from saved records", async () => {
  const { service, db } = fixture();
  const beforeDeals = JSON.stringify(db.deals);
  const report = await service.generateReport("deal-pipeline", { actor: "Tester" });
  assert.equal(report.name, "Deal Pipeline Report");
  assert.ok(report.rowCount > 0);
  assert.equal(JSON.stringify(db.deals), beforeDeals);
});

test("reports distinguish approved and recommended values", async () => {
  const { service } = fixture();
  const report = await service.generateReport("deal-pipeline", { actor: "Tester" });
  const row = report.rows[0];
  assert.ok(Object.prototype.hasOwnProperty.call(row, "approvedArv"));
  assert.ok(Object.prototype.hasOwnProperty.call(row, "recommendedArv"));
});

test("documents remain draft until approved", async () => {
  const { service } = fixture();
  const draft = await service.generateDocumentDraft("offer-summary", "deal-1", { actor: "Tester" });
  assert.equal(draft.approvalStatus, "DRAFT");
  const denied = await service.approveDocumentDraft(draft.id, false, "Tester");
  assert.equal(denied.ok, false);
});

test("missing document fields remain required", async () => {
  const { service } = fixture();
  const draft = await service.generateDocumentDraft("contractor-assignment-summary", "deal-1", { actor: "Tester" });
  assert.ok(draft.validationStatus === "REQUIRED_FIELDS_MISSING");
  assert.ok(draft.missingFields.includes("contractorName"));
});

test("knowledge entries retain source references", async () => {
  const { service } = fixture();
  const entry = await service.createKnowledgeEntry({
    actor: "Tester",
    category: "buy-box standards",
    type: "policy",
    title: "Covington buy box",
    sourceReferences: ["deal-1", "policy-doc-1"],
    known: ["zip 41011 primary"],
  });
  assert.equal(entry.sourceReferences.length, 2);
});

test("knowledge history is preserved", async () => {
  const { service } = fixture();
  const created = await service.createKnowledgeEntry({ actor: "Tester", title: "Lesson A", sourceReferences: ["deal-1"] });
  const updated = await service.updateKnowledgeEntry(created.id, { actor: "Tester", title: "Lesson A Updated" });
  assert.equal(updated.ok, true);
  assert.ok(updated.entry.history.length >= 1);
});

test("forecasts return Insufficient Data when assumptions are missing", async () => {
  const { service } = fixture();
  const result = service.forecastProperty({ currentValue: 100000, loanBalance: 70000, monthlyRent: 1500, operatingExpenses: 600, monthlyDebtService: 700 }, {}, 3);
  assert.equal(result.status, "INSUFFICIENT_DATA");
});

test("forecasts calculate when assumptions exist", async () => {
  const { service } = fixture();
  const assumptions = {
    appreciationRate: 0.03,
    rentGrowth: 0.02,
    expenseGrowth: 0.02,
    vacancy: 0.08,
    refinanceLtv: 0.7,
    reserveTarget: 0.1,
  };
  const result = service.forecastProperty({ currentValue: 100000, loanBalance: 70000, monthlyRent: 1500, operatingExpenses: 600, monthlyDebtService: 700 }, assumptions, 3);
  assert.equal(result.status, "OK");
  assert.ok(result.propertyValue > 100000);
});

test("workflow transitions require explicit approval", async () => {
  const { service } = fixture();
  const result = await service.executeWorkflowTransition("accepted-deal-to-property", "deal-1", false, "Tester");
  assert.equal(result.ok, false);
  assert.equal(result.status, "EXPLICIT_APPROVAL_REQUIRED");
});

test("workflow transitions are idempotent", async () => {
  const { service } = fixture();
  const one = await service.executeWorkflowTransition("selected-products-to-material-summary", "products-global", true, "Tester");
  const two = await service.executeWorkflowTransition("selected-products-to-material-summary", "products-global", true, "Tester");
  assert.equal(one.ok, true);
  assert.equal(two.status, "IDEMPOTENT_NO_CHANGE");
});

test("duplicate destination records are blocked", async () => {
  const { service, db } = fixture();
  db.portfolio[0].linkedDealId = "deal-1";
  const preview = await service.previewWorkflowTransition("purchased-deal-to-portfolio-preview", "deal-1");
  assert.ok(preview.blockers.length > 0);
});

test("protected destination fields remain preserved", async () => {
  const { service, db } = fixture();
  const before = JSON.stringify(db.deals[0].approvedArv);
  await service.generateReport("underwriting", { dealId: "deal-1", actor: "Tester" });
  assert.equal(JSON.stringify(db.deals[0].approvedArv), before);
});

test("diagnostics distinguish unknown from invalid", async () => {
  const { service } = fixture();
  const diagnostics = await service.runSystemDiagnostics();
  const unknown = diagnostics.checks.issues.some((issue) => issue.unknown === true);
  const invalid = diagnostics.checks.issues.some((issue) => issue.invalid === true);
  assert.equal(unknown, true);
  assert.equal(invalid, true);
});

test("search reports and documents do not mutate records", async () => {
  const { service, db } = fixture();
  const beforeDeals = JSON.stringify(db.deals);
  await service.searchAllEntities("goss", {});
  await service.generateReport("executive-summary", { actor: "Tester", format: "json" });
  const draft = await service.generateDocumentDraft("deal-summary", "deal-1", { actor: "Tester" });
  await service.exportDocument(draft.id, "json", "Tester");
  assert.equal(JSON.stringify(db.deals), beforeDeals);
});

test("approved document flow and audit history work", async () => {
  const { service } = fixture();
  const draft = await service.generateDocumentDraft("deal-summary", "deal-1", { actor: "Tester" });
  const approved = await service.approveDocumentDraft(draft.id, true, "Tester");
  const exported = await service.exportDocument(draft.id, "pdf", "Tester");
  const audit = await service.getDocumentAuditHistory(draft.id);
  assert.equal(approved.ok, true);
  assert.equal(exported.ok, true);
  assert.ok(audit.length >= 2);
  assert.equal(exported.status, "FORMAT_FALLBACK");
});

test("forecast scenario and confidence APIs work", async () => {
  const { service, db } = fixture();
  const scenarios = service.buildForecastScenarios({
    properties: db.portfolio,
    years: [1, 3, 5, 10],
    assumptions: {
      appreciationRate: 0.03,
      rentGrowth: 0.02,
      expenseGrowth: 0.02,
      vacancy: 0.08,
      interestRate: 0.08,
      refinanceLtv: 0.7,
      saleCosts: 0.08,
      capitalExpenditures: 0.01,
      reserveTarget: 0.1,
    },
  });
  const confidence = service.calculateForecastConfidence({
    assumptions: {
      appreciationRate: 0.03,
      rentGrowth: 0.02,
      expenseGrowth: 0.02,
      vacancy: 0.08,
      interestRate: 0.08,
      refinanceLtv: 0.7,
      saleCosts: 0.08,
      capitalExpenditures: 0.01,
      reserveTarget: 0.1,
    },
  });
  assert.equal(Array.isArray(scenarios.base), true);
  assert.ok(confidence.score > 70);
});

test("knowledge supersede preserves historical record", async () => {
  const { service } = fixture();
  const created = await service.createKnowledgeEntry({ actor: "Tester", title: "Contractor Lessons", category: "contractor performance", sourceReferences: ["c1"] });
  const superseded = await service.supersedeKnowledgeEntry(created.id, { actor: "Tester", title: "Contractor Lessons v2" });
  assert.equal(superseded.ok, true);
  assert.equal(superseded.previous.status, "superseded");
});

test("report audit history records generation and export", async () => {
  const { service } = fixture();
  await service.generateReport("executive-summary", { actor: "Tester", format: "csv" });
  const history = await service.getReportAuditHistory();
  assert.ok(history.length >= 2);
});

test("workflow rollback supports safe restore cases", async () => {
  const { service, db } = fixture();
  db.rehabProjects.push({ id: "r2", projectName: "Secondary", assignmentReviewStatus: "None" });
  const exec = await service.executeWorkflowTransition("selected-contractor-to-project-assignment-preview", "r2", true, "Tester");
  assert.equal(exec.ok, true);
  const rolled = await service.rollbackWorkflowTransition(exec.transitionEvent.id, "Tester");
  assert.equal(rolled.ok, true);
  const status = await service.getWorkflowTransitionStatus("selected-contractor-to-project-assignment-preview", "r2");
  assert.ok(status.records.length >= 1);
});

test("952 Goss Rd remains preserved after enterprise operations", async () => {
  const { service, db } = fixture();
  const baseline = JSON.stringify(db.deals.find((deal) => deal.propertyAddress === "952 Goss Rd"));
  await service.buildExecutiveSnapshot();
  await service.searchAllEntities("952 goss", {});
  await service.generateReport("executive-summary", { actor: "Tester" });
  await service.runSystemDiagnostics();
  const after = JSON.stringify(db.deals.find((deal) => deal.propertyAddress === "952 Goss Rd"));
  assert.equal(after, baseline);
});
