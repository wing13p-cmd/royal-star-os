function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function safeString(value, fallback = "") {
  if (value === null || value === undefined) return fallback;
  return typeof value === "string" ? value : String(value);
}

function firstNonEmptyString(...values) {
  for (const value of values) {
    const text = safeString(value).trim();
    if (text) return text;
  }
  return "";
}

function isMissingValue(value) {
  return value === null || value === undefined || value === "";
}

function hasValue(value) {
  if (value === 0) return true;
  if (value === false) return true;
  return !isMissingValue(value);
}

function normalizeText(value) {
  return safeString(value, "").toLowerCase().replace(/\s+/g, " ").trim();
}

function normalizeAddressKey(record = {}) {
  return [
    normalizeText(record.address || record.propertyAddress),
    normalizeText(record.city),
    normalizeText(record.state),
    normalizeText(record.zipCode || record.zip),
  ].join("|");
}

function parseHistory(value) {
  if (Array.isArray(value)) return value;
  if (typeof value !== "string") return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function toHistoryString(value) {
  return JSON.stringify(Array.isArray(value) ? value : []);
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function setMappedValue(target, destinationField, value) {
  if (destinationField === "propertyStatus") {
    target.propertyStatus = value;
    target.status = value;
    return;
  }
  if (destinationField === "status") {
    target.status = value;
    if (Object.prototype.hasOwnProperty.call(target, "propertyStatus")) {
      target.propertyStatus = value;
    }
    return;
  }
  if (destinationField === "currentValue/projectedARV") {
    target.currentValue = value;
    target.projectedARV = value;
    return;
  }
  if (destinationField === "rehabBudget") {
    target.currentRehabBudget = value;
    target.originalRehabBudget = hasValue(target.originalRehabBudget) ? target.originalRehabBudget : value;
    return;
  }
  target[destinationField] = value;
}

function getMappedValue(record, sourceField) {
  if (sourceField === "address") return record.propertyAddress || record.address;
  if (sourceField === "zipCode") return record.zipCode || record.zip;
  if (sourceField === "estimatedArv") return record.estimatedArv ?? record.arv;
  if (sourceField === "status") return record.status || record.propertyStatus;
  if (sourceField === "strategy") return record.strategy || record.exitStrategy;
  if (sourceField === "rehabBudget") return record.rehabBudget ?? record.currentRehabBudget ?? record.originalRehabBudget;
  if (sourceField === "currentValue") return record.currentValue ?? record.projectedARV;
  if (sourceField === "monthlyRent") return record.monthlyRent ?? record.estimatedRent;
  return record[sourceField];
}

export const SHARED_SYNC_FIELD_MAP = {
  dealToProperty: {
    address: "address",
    city: "city",
    state: "state",
    zipCode: "zipCode",
    propertyType: "propertyType",
    bedrooms: "bedrooms",
    bathrooms: "bathrooms",
    squareFeet: "squareFeet",
    yearBuilt: "yearBuilt",
    purchasePrice: "purchasePrice",
    rehabBudget: "rehabBudget",
    holdingMonths: "holdingMonths",
    holdingCosts: "holdingCosts",
    earnestMoney: "earnestMoney",
    closingCosts: "closingCosts",
    financingCosts: "financingCosts",
    estimatedArv: "currentValue/projectedARV",
    estimatedRent: "monthlyRent",
    taxes: "monthlyTaxes",
    insurance: "monthlyInsurance",
    strategy: "strategy",
    status: "propertyStatus",
    pipelineStage: "pipelineStage",
    parcelNumber: "parcelNumber",
    mapUrl: "mapUrl",
  },
  propertyToDeal: {
    address: "propertyAddress",
    city: "city",
    state: "state",
    zipCode: "zipCode",
    propertyType: "propertyType",
    status: "status",
    pipelineStage: "pipelineStage",
    purchasePrice: "purchasePrice",
    rehabBudget: "rehabBudget",
    currentValue: "estimatedArv",
    holdingMonths: "holdingMonths",
    holdingCosts: "holdingCosts",
    earnestMoney: "earnestMoney",
    closingCosts: "closingCosts",
    financingCosts: "financingCosts",
    monthlyRent: "estimatedRent",
    monthlyTaxes: "taxes",
    monthlyInsurance: "insurance",
    strategy: "strategy",
    parcelNumber: "parcelNumber",
    mapUrl: "mapUrl",
  },
};

function applyMappedFields({ sourceRecord, destinationRecord, fieldMap, sourceUpdatedAt = "", sourceModule = "System", destinationFieldSourceMeta = {} }) {
  const changed = [];
  const nextDestination = { ...destinationRecord };
  const nextFieldSourceMeta = { ...destinationFieldSourceMeta };

  Object.entries(fieldMap).forEach(([sourceField, destinationField]) => {
    const sourceValue = getMappedValue(sourceRecord, sourceField);
    const destinationValue = getMappedValue(nextDestination, destinationField);
    const metaKey = destinationField;
    const destinationMeta = nextFieldSourceMeta[metaKey] || {};
    const destinationUpdatedAt = safeString(destinationMeta.updatedAt);

    if (!hasValue(sourceValue)) return;
    if (destinationUpdatedAt && sourceUpdatedAt && destinationUpdatedAt > sourceUpdatedAt) return;
    if (destinationValue === sourceValue) return;

    setMappedValue(nextDestination, destinationField, sourceValue);
    nextFieldSourceMeta[metaKey] = {
      sourceModule,
      updatedAt: sourceUpdatedAt,
    };
    changed.push({ sourceField, destinationField, value: sourceValue });
  });

  return {
    nextDestination,
    nextFieldSourceMeta,
    changed,
  };
}

function createLinkagePair({ deals, properties, sourceEntity, sourceRecord }) {
  const dealAddressKey = normalizeAddressKey(sourceRecord);
  const dealsById = new Map(deals.map((entry) => [safeString(entry.id), entry]));
  const propertiesById = new Map(properties.map((entry) => [safeString(entry.id), entry]));
  const propertiesByDealId = new Map(properties.filter((entry) => safeString(entry.linkedDealId)).map((entry) => [safeString(entry.linkedDealId), entry]));
  const propertiesByAddressKey = new Map(properties.map((entry) => [normalizeAddressKey(entry), entry]));

  let deal = sourceEntity === "deal" ? sourceRecord : dealsById.get(safeString(sourceRecord.linkedDealId));
  let property = sourceEntity === "property" ? sourceRecord : null;

  if (!deal && sourceEntity === "property") {
    const linkedByPropertyId = deals.find((entry) => safeString(entry.linkedPropertyId) === safeString(sourceRecord.id));
    const linkedByAddress = deals.find((entry) => normalizeAddressKey(entry) === dealAddressKey);
    deal = linkedByPropertyId || linkedByAddress || null;
  }

  if (!property && deal) {
    property = propertiesById.get(safeString(deal.linkedPropertyId))
      || propertiesByDealId.get(safeString(deal.id))
      || propertiesByAddressKey.get(normalizeAddressKey(deal))
      || null;
  }

  if (!deal && sourceEntity === "deal") {
    deal = sourceRecord;
  }

  if (!property && deal) {
    const resolvedDealId = firstNonEmptyString(deal.id);
    const resolvedPropertyId = firstNonEmptyString(deal.linkedPropertyId, deal.propertyId, `property-${resolvedDealId}`);
    property = {
      id: resolvedPropertyId,
      linkedDealId: resolvedDealId,
      propertyName: safeString(deal.propertyAddress || deal.address, "Untitled Property"),
      address: safeString(deal.propertyAddress || deal.address),
      city: safeString(deal.city),
      state: safeString(deal.state),
      zipCode: safeString(deal.zipCode || deal.zip),
      propertyType: safeString(deal.propertyType, "Single Family"),
      strategy: safeString(deal.strategy || deal.exitStrategy, "Hold"),
      propertyStatus: safeString(deal.status, "Lead"),
      status: safeString(deal.status, "Lead"),
      pipelineStage: safeString(deal.pipelineStage, "New Lead"),
      createdAt: safeString(deal.createdAt, new Date().toISOString()),
      updatedAt: safeString(deal.updatedAt, new Date().toISOString()),
    };
    properties.push(property);
  }

  if (!deal && property) {
    const linkedByDeal = deals.find((entry) => safeString(entry.id) === safeString(property.linkedDealId));
    if (linkedByDeal) {
      deal = linkedByDeal;
    }
  }

  if (!deal || !property) {
    return { deal: null, property: null };
  }

  const resolvedPropertyId = firstNonEmptyString(property.id, deal.linkedPropertyId, deal.propertyId);
  const resolvedDealId = firstNonEmptyString(deal.id, property.linkedDealId);

  deal.linkedPropertyId = firstNonEmptyString(deal.linkedPropertyId, deal.propertyId, resolvedPropertyId);
  deal.propertyId = firstNonEmptyString(deal.propertyId, deal.linkedPropertyId, resolvedPropertyId);
  property.linkedDealId = firstNonEmptyString(property.linkedDealId, resolvedDealId);

  if (!hasValue(deal.parcelNumber) && hasValue(property.parcelNumber)) {
    deal.parcelNumber = property.parcelNumber;
  }
  if (!hasValue(deal.mapUrl) && hasValue(property.mapUrl)) {
    deal.mapUrl = property.mapUrl;
  }

  return { deal, property };
}

function appendStageTransition({ sourceRecord, previousRecord = {}, sourceModule, sourceEntity }) {
  const previousStage = safeString(previousRecord.pipelineStage, "");
  const nextStage = safeString(sourceRecord.pipelineStage, "");
  if (!nextStage || nextStage === previousStage) {
    return parseHistory(sourceRecord.workflowTransitionHistory);
  }
  const history = parseHistory(sourceRecord.workflowTransitionHistory);
  history.push({
    previousStage: previousStage || "Unknown",
    newStage: nextStage,
    timestamp: safeString(sourceRecord.updatedAt, new Date().toISOString()),
    sourceModule,
    origin: sourceEntity === "deal" ? "user" : "system",
  });
  return history;
}

export function createDealPropertySyncService(options = {}) {
  const readDeals = options.readDeals;
  const writeDeals = options.writeDeals;
  const readProperties = options.readProperties;
  const writeProperties = options.writeProperties;

  if (!readDeals || !writeDeals || !readProperties || !writeProperties) {
    throw new Error("createDealPropertySyncService requires deal/property read and write handlers");
  }

  async function persistWithRollback({ originalDeals, originalProperties, nextDeals, nextProperties }) {
    try {
      await writeDeals(nextDeals);
      await writeProperties(nextProperties);
    } catch (error) {
      try {
        await writeDeals(originalDeals);
        await writeProperties(originalProperties);
      } catch {
        // keep original error as root cause
      }
      throw error;
    }
  }

  async function synchronizeAfterSave({ sourceEntity, savedRecordId, sourceModule = "System" }) {
    const originalDeals = await readDeals();
    const originalProperties = await readProperties();
    const nextDeals = clone(safeArray(originalDeals));
    const nextProperties = clone(safeArray(originalProperties));

    const sourceList = sourceEntity === "deal" ? nextDeals : nextProperties;
    const previousSourceList = sourceEntity === "deal" ? safeArray(originalDeals) : safeArray(originalProperties);
    const sourceIndex = sourceList.findIndex((entry) => safeString(entry.id) === safeString(savedRecordId));

    if (sourceIndex < 0) {
      return {
        ok: false,
        status: "SOURCE_NOT_FOUND",
      };
    }

    const sourceRecord = sourceList[sourceIndex];
    const previousRecord = previousSourceList.find((entry) => safeString(entry.id) === safeString(savedRecordId)) || {};

    const { deal, property } = createLinkagePair({
      deals: nextDeals,
      properties: nextProperties,
      sourceEntity,
      sourceRecord,
    });

    if (!deal || !property) {
      await persistWithRollback({ originalDeals, originalProperties, nextDeals, nextProperties });
      return {
        ok: true,
        status: "NO_LINKED_RECORD",
        updatedDealId: safeString(deal?.id),
        updatedPropertyId: safeString(property?.id),
      };
    }

    const sourceUpdatedAt = safeString(sourceRecord.updatedAt, new Date().toISOString());
    const dealFieldSourceMeta = deal.fieldSourceMeta && typeof deal.fieldSourceMeta === "object" ? deal.fieldSourceMeta : {};
    const propertyFieldSourceMeta = property.fieldSourceMeta && typeof property.fieldSourceMeta === "object" ? property.fieldSourceMeta : {};

    if (sourceEntity === "deal") {
      const { nextDestination, nextFieldSourceMeta, changed } = applyMappedFields({
        sourceRecord: deal,
        destinationRecord: property,
        fieldMap: SHARED_SYNC_FIELD_MAP.dealToProperty,
        sourceUpdatedAt,
        sourceModule,
        destinationFieldSourceMeta: propertyFieldSourceMeta,
      });
      Object.assign(property, nextDestination);
      property.fieldSourceMeta = nextFieldSourceMeta;
      property.updatedAt = sourceUpdatedAt;
      deal.workflowTransitionHistory = appendStageTransition({ sourceRecord: deal, previousRecord, sourceModule, sourceEntity: "deal" });
      property.workflowTransitionHistory = toHistoryString(appendStageTransition({ sourceRecord: property, previousRecord: parseHistory(property.workflowTransitionHistory).slice(-1)[0] || {}, sourceModule, sourceEntity: "property" }));
      deal.updatedByModule = sourceModule;
      property.updatedByModule = sourceModule;
      deal.syncMetadata = { lastSyncAt: sourceUpdatedAt, changedCount: changed.length, sourceEntity: "deal" };
      property.syncMetadata = { lastSyncAt: sourceUpdatedAt, changedCount: changed.length, sourceEntity: "deal" };
    } else {
      const { nextDestination, nextFieldSourceMeta, changed } = applyMappedFields({
        sourceRecord: property,
        destinationRecord: deal,
        fieldMap: SHARED_SYNC_FIELD_MAP.propertyToDeal,
        sourceUpdatedAt,
        sourceModule,
        destinationFieldSourceMeta: dealFieldSourceMeta,
      });
      Object.assign(deal, nextDestination);
      deal.fieldSourceMeta = nextFieldSourceMeta;
      deal.updatedAt = sourceUpdatedAt;
      property.updatedByModule = sourceModule;
      deal.updatedByModule = sourceModule;
      property.syncMetadata = { lastSyncAt: sourceUpdatedAt, changedCount: changed.length, sourceEntity: "property" };
      deal.syncMetadata = { lastSyncAt: sourceUpdatedAt, changedCount: changed.length, sourceEntity: "property" };
    }

    await persistWithRollback({ originalDeals, originalProperties, nextDeals, nextProperties });
    return {
      ok: true,
      status: "SYNCED",
      updatedDealId: safeString(deal.id),
      updatedPropertyId: safeString(property.id),
    };
  }

  async function migrateExistingLinkages(sourceModule = "System Migration") {
    const originalDeals = await readDeals();
    const originalProperties = await readProperties();
    const nextDeals = clone(safeArray(originalDeals));
    const nextProperties = clone(safeArray(originalProperties));

    let migratedCount = 0;

    nextDeals.forEach((deal) => {
      const { deal: linkedDeal, property } = createLinkagePair({
        deals: nextDeals,
        properties: nextProperties,
        sourceEntity: "deal",
        sourceRecord: deal,
      });

      if (!linkedDeal || !property) return;

      if (!safeString(property.linkedDealId) || !safeString(linkedDeal.linkedPropertyId)) {
        migratedCount += 1;
      }

      linkedDeal.updatedByModule = safeString(linkedDeal.updatedByModule, sourceModule);
      property.updatedByModule = safeString(property.updatedByModule, sourceModule);
    });

    await persistWithRollback({ originalDeals, originalProperties, nextDeals, nextProperties });
    return {
      ok: true,
      migratedCount,
      dealCount: nextDeals.length,
      propertyCount: nextProperties.length,
    };
  }

  return {
    synchronizeAfterSave,
    migrateExistingLinkages,
  };
}
