import test from "node:test";
import assert from "node:assert/strict";
import { buildCompEnterpriseUiModel, buildCompExportPackage, buildAppraisalExportPackage, buildPdfSummary, buildExcelCompPackage, buildCompDatabaseBackup } from "./compEnterpriseIntelligence.js";

test("buildCompEnterpriseUiModel returns review-first enterprise analytics", () => {
  const model = buildCompEnterpriseUiModel({
    comps: [
      { id: "comp-1", compAddress: "101 Main St", provider: "manual", inclusionStatus: "approved", verified: true, media: [] },
      { id: "comp-2", compAddress: "101 Main St", provider: "rentcast", inclusionStatus: "pending", verified: false, providerImported: true, media: [{ label: "front", source: "rentcast" }] },
    ],
    auditLog: [{ compId: "comp-2", action: "import", reviewStatus: "pending" }],
  });

  assert.equal(model.importedCount, 1);
  assert.equal(model.pendingReviewCount, 1);
  assert.ok(model.providerHealth.overallHealthy);
  assert.ok(model.auditEntries.length >= 1);
  assert.ok(model.importHistory.length >= 1);
});

test("export helpers build review-first packages without mutating ARVs", () => {
  const packageData = buildCompExportPackage({ comps: [{ id: "c1", compAddress: "300 Oak Ave", salePrice: 250000, saleDate: "2024-03-01", provider: "manual", inclusionStatus: "approved", verified: true, media: [{ label: "front" }] }], subjectDeal: { propertyAddress: "952 Goss Rd" } });
  const appraisalPackage = buildAppraisalExportPackage({ comps: packageData.comps, subjectDeal: packageData.subjectDeal });
  const pdfSummary = buildPdfSummary({ comps: packageData.comps, subjectDeal: packageData.subjectDeal });
  const excelPackage = buildExcelCompPackage({ comps: packageData.comps });
  const backup = buildCompDatabaseBackup({ comps: packageData.comps, auditLog: [] });

  assert.equal(packageData.comps[0].address, "300 Oak Ave");
  assert.equal(appraisalPackage.exportType, "appraisal-package");
  assert.match(pdfSummary, /RSOS Comp Summary/);
  assert.match(excelPackage, /address,salePrice/);
  assert.ok(backup.comps.length >= 1);
});
