const text = (value) => value === null || value === undefined ? "" : String(value).trim();
const numberOrBlank = (value) => {
  if (value === null || value === undefined || (typeof value === "string" && value.trim() === "")) return "";
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : "";
};

export function normalizePersistedComp(payload = {}) {
  const subjectDealId = text(payload.subjectDealId || payload.dealId || payload.linkedDealId);
  const propertyId = text(payload.propertyId || payload.linkedPropertyId || payload.subjectPropertyId);
  return {
    ...payload,
    id: text(payload.id),
    subjectDealId,
    dealId: text(payload.dealId || subjectDealId),
    propertyId,
    subjectPropertyId: text(payload.subjectPropertyId || propertyId || subjectDealId),
    subjectProperty: text(payload.subjectProperty),
    compAddress: text(payload.compAddress || payload.address || payload.propertyAddress),
    city: text(payload.city),
    state: text(payload.state),
    zipCode: text(payload.zipCode || payload.zip),
    salePrice: numberOrBlank(payload.salePrice),
    saleDate: text(payload.saleDate),
    listPrice: numberOrBlank(payload.listPrice ?? payload.listingPrice),
    propertyType: text(payload.propertyType) || "Single Family",
    bedrooms: numberOrBlank(payload.bedrooms),
    bathrooms: numberOrBlank(payload.bathrooms),
    squareFeet: numberOrBlank(payload.squareFeet),
    yearBuilt: numberOrBlank(payload.yearBuilt),
    lotSize: payload.lotSize ?? "",
    distanceMiles: numberOrBlank(payload.distanceMiles ?? payload.distance),
    condition: text(payload.condition) || "Average",
    garage: payload.garage ?? "",
    basement: payload.basement ?? "",
    source: text(payload.source),
    sourceLink: text(payload.sourceLink || payload.sourceURL),
    notes: payload.notes ?? "",
    included: payload.included !== false,
    provider: text(payload.provider) || "manual",
    providerImported: Boolean(payload.providerImported),
    manuallyEntered: Boolean(payload.manuallyEntered),
    verified: Boolean(payload.verified),
    inclusionStatus: text(payload.inclusionStatus) || "pending",
    exclusionReason: payload.exclusionReason ?? "",
    warningFlags: Array.isArray(payload.warningFlags) ? payload.warningFlags : [],
    media: Array.isArray(payload.media) ? payload.media : [],
    createdAt: text(payload.createdAt),
    updatedAt: text(payload.updatedAt),
  };
}

export function mergeCompResponse(comp = {}, providerRecord = {}, quality = {}) {
  const persisted = normalizePersistedComp(comp);
  return {
    ...providerRecord,
    ...persisted,
    ...quality,
    id: persisted.id,
    compId: text(comp.compId || persisted.id),
    compAddress: persisted.compAddress,
    address: text(providerRecord.address || persisted.compAddress),
    zipCode: persisted.zipCode,
    zip: text(providerRecord.zip || persisted.zipCode),
    listPrice: persisted.listPrice,
    included: persisted.included,
    subjectDealId: persisted.subjectDealId,
    dealId: persisted.dealId,
    propertyId: persisted.propertyId,
    subjectPropertyId: persisted.subjectPropertyId,
  };
}

export function findExistingProviderImport(comps = [], candidate = {}) {
  const normalized = normalizePersistedComp(candidate);
  if (!normalized.providerImported) return null;
  const subjectDealId = text(normalized.subjectDealId || normalized.dealId);
  if (!subjectDealId) return null;
  const providerRecordId = text(candidate.providerRecordId || candidate.providerPropertyId).toLowerCase();
  return (Array.isArray(comps) ? comps : []).find((entry) => {
    const existing = normalizePersistedComp(entry);
    if (text(existing.subjectDealId || existing.dealId) !== subjectDealId) return false;
    const existingProviderId = text(entry.providerRecordId || entry.providerPropertyId).toLowerCase();
    if (providerRecordId && existingProviderId) return providerRecordId === existingProviderId;
    return text(existing.compAddress).toLowerCase().replace(/\s+/g, " ") === text(normalized.compAddress).toLowerCase().replace(/\s+/g, " ")
      && text(existing.saleDate) === text(normalized.saleDate)
      && numberOrBlank(existing.salePrice) === numberOrBlank(normalized.salePrice);
  }) || null;
}
