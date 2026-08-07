function safeNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function safeString(value, fallback = "") {
  if (value === null || value === undefined || value === "") return fallback;
  return typeof value === "string" ? value : String(value);
}

export function normalizeSharedEnterpriseRecord(record = {}, options = {}) {
  const entityType = safeString(options.entityType || record.entityType || "deal", "deal").toLowerCase();
  const normalized = {
    id: safeString(record.id || record.uuid || record.recordId || `${entityType}-${Date.now()}`),
    entityType,
    schemaVersion: 1,
    propertyAddress: safeString(record.propertyAddress || record.property_name || record.address || record.propertyName || record.streetAddress, "Insufficient Data"),
    address: safeString(record.address || record.propertyAddress || record.property_name || record.propertyName || record.streetAddress, "Insufficient Data"),
    city: safeString(record.city || record.City || record.cityName, "Insufficient Data"),
    state: safeString(record.state || record.State, "Insufficient Data"),
    zipCode: safeString(record.zipCode || record.zip || record.postalCode, "Insufficient Data"),
    propertyType: safeString(record.propertyType || record.type || record.property_type, "Single Family"),
    purchasePrice: safeNumber(record.purchasePrice || record.askingPrice || record.asking_price || record.listPrice || record.list_price || record.purchase_price),
    askingPrice: safeNumber(record.askingPrice || record.asking_price || record.listPrice || record.list_price || record.purchasePrice || record.purchase_price),
    rehabBudget: safeNumber(record.rehabBudget || record.rehab_budget || record.repairBudget || record.repair_budget || record.renovationBudget || record.renovation_budget),
    estimatedArv: safeNumber(record.estimatedArv || record.arv || record.projectedARV || record.supportedARV || record.estimated_arv || record.currentValue || record.marketValue),
    financingCosts: safeNumber(record.financingCosts || record.financing_costs || record.financingCost || record.financing_cost || record.financingCostAmount),
    rawFinancingCostInput: safeNumber(record.rawFinancingCostInput || record.rawFinancingCost || record.rawFinancingCostAmount || record.financingCosts || record.financing_costs),
    calculatedFinancingCosts: safeNumber(record.calculatedFinancingCosts || record.calculatedFinancingCost || record.calculatedFinancingCostsAmount || record.financingCosts || record.financing_costs),
    effectiveFinancingCosts: safeNumber(record.effectiveFinancingCosts || record.effectiveFinancingCost || record.effectiveFinancingCostsAmount || record.financingCosts || record.financing_costs),
    financingCostSource: safeString(record.financingCostSource || record.financing_cost_source || record.financingSource || (record.effectiveFinancingCosts ? "calculated" : "manual"), "calculated"),
    status: safeString(record.status || record.propertyStatus || record.projectStatus || record.workflowStatus, "Lead"),
    strategy: safeString(record.strategy || record.exitStrategy || record.preferredStrategy || record.preferredExitStrategy, "Flip"),
    notes: safeString(record.notes || record.description || record.summary, ""),
    createdAt: safeString(record.createdAt || record.created_at || record.created),
    updatedAt: safeString(record.updatedAt || record.updated_at || record.updated),
  };

  return normalized;
}

export function migrateLegacyEnterpriseData(records = [], options = {}) {
  const entityType = safeString(options.entityType || "deal", "deal").toLowerCase();
  return Array.isArray(records) ? records.map((record) => normalizeSharedEnterpriseRecord(record, { entityType })) : [];
}
