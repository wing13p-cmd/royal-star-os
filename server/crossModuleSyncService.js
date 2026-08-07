function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function safeString(value, fallback = "") {
  if (value === null || value === undefined) return fallback;
  return typeof value === "string" ? value : String(value);
}

function nowIso() {
  return new Date().toISOString();
}

function isBlank(value) {
  return value === null || value === undefined || value === "";
}

function normalizeText(value) {
  return safeString(value, "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function buildAddressKey(record = {}) {
  return [
    normalizeText(record.address || record.propertyAddress),
    normalizeText(record.city),
    normalizeText(record.state),
    normalizeText(record.zipCode || record.zip),
  ].join("|");
}

function stablePropertyIdForDeal(dealId) {
  return `property-${safeString(dealId)}`;
}

function stablePropertyIdForPortfolio(portfolioId) {
  return `property-${safeString(portfolioId)}`;
}

function applyIfBlank(target, key, value) {
  if (isBlank(target[key]) && !isBlank(value)) {
    target[key] = value;
  }
}

function mapDealToProperty(deal = {}, existing = null) {
  const baseline = existing && typeof existing === "object" ? { ...existing } : {};
  const now = nowIso();
  const next = {
    ...baseline,
    id: safeString(baseline.id, stablePropertyIdForDeal(deal.id)),
    linkedDealId: safeString(deal.id),
    propertyName: safeString(baseline.propertyName || deal.propertyAddress || deal.address, "Untitled Property"),
    address: safeString(baseline.address || deal.propertyAddress || deal.address),
    city: safeString(baseline.city || deal.city),
    state: safeString(baseline.state || deal.state),
    zipCode: safeString(baseline.zipCode || deal.zipCode || deal.zip),
    propertyType: safeString(baseline.propertyType || deal.propertyType, "Single Family"),
    strategy: safeString(baseline.strategy || deal.strategy, "Hold"),
    propertyStatus: safeString(baseline.propertyStatus || baseline.status, "Lead"),
    status: safeString(baseline.status || baseline.propertyStatus, "Lead"),
    ownershipStatus: safeString(baseline.ownershipStatus, "Not Owned"),
    rehabStatus: safeString(baseline.rehabStatus, "Not Started"),
    favorite: Boolean(baseline.favorite),
    createdAt: safeString(baseline.createdAt, now),
    updatedAt: safeString(baseline.updatedAt, safeString(baseline.createdAt, now)),
  };

  applyIfBlank(next, "purchasePrice", deal.purchasePrice ?? deal.askingPrice);
  applyIfBlank(next, "currentValue", deal.estimatedArv ?? deal.projectedARV);
  applyIfBlank(next, "monthlyRent", deal.estimatedRent);
  applyIfBlank(next, "bedrooms", deal.bedrooms);
  applyIfBlank(next, "bathrooms", deal.bathrooms);
  applyIfBlank(next, "squareFeet", deal.squareFeet);
  applyIfBlank(next, "yearBuilt", deal.yearBuilt);
  applyIfBlank(next, "notes", deal.notes);

  return next;
}

function mapPortfolioToProperty(portfolio = {}, existing = null) {
  const baseline = existing && typeof existing === "object" ? { ...existing } : {};
  const now = nowIso();
  const next = {
    ...baseline,
    id: safeString(baseline.id, safeString(portfolio.linkedPropertyId, stablePropertyIdForPortfolio(portfolio.id))),
    linkedDealId: safeString(baseline.linkedDealId || portfolio.linkedDealId),
    linkedPortfolioId: safeString(baseline.linkedPortfolioId || portfolio.id),
    propertyName: safeString(baseline.propertyName || portfolio.propertyName || portfolio.propertyAddress || portfolio.address, "Untitled Property"),
    address: safeString(baseline.address || portfolio.propertyAddress || portfolio.address),
    city: safeString(baseline.city || portfolio.city),
    state: safeString(baseline.state || portfolio.state),
    zipCode: safeString(baseline.zipCode || portfolio.zipCode),
    propertyType: safeString(baseline.propertyType || portfolio.propertyType, "Single Family"),
    strategy: safeString(baseline.strategy || portfolio.strategy, "Hold"),
    propertyStatus: safeString(baseline.propertyStatus || baseline.status || portfolio.status, "Lead"),
    status: safeString(baseline.status || baseline.propertyStatus || portfolio.status, "Lead"),
    ownershipStatus: safeString(baseline.ownershipStatus, "Not Owned"),
    rehabStatus: safeString(baseline.rehabStatus, "Not Started"),
    favorite: Boolean(baseline.favorite || portfolio.favorite),
    createdAt: safeString(baseline.createdAt, now),
    updatedAt: safeString(baseline.updatedAt, safeString(baseline.createdAt, now)),
  };

  applyIfBlank(next, "purchasePrice", portfolio.purchasePrice ?? portfolio.askingPrice);
  applyIfBlank(next, "currentValue", portfolio.currentValue ?? portfolio.estimatedArv);
  applyIfBlank(next, "monthlyRent", portfolio.monthlyRent);
  applyIfBlank(next, "notes", portfolio.notes);

  return next;
}

function isDeepEqual(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

export function createCrossModuleSyncService(options = {}) {
  const readDeals = options.readDeals;
  const writeDeals = options.writeDeals;
  const readProperties = options.readProperties;
  const writeProperties = options.writeProperties;
  const readPortfolio = options.readPortfolio;
  const writePortfolio = options.writePortfolio;
  const readRehabProjects = options.readRehabProjects;
  const writeRehabProjects = options.writeRehabProjects;

  if (!readDeals || !writeDeals || !readProperties || !writeProperties || !readPortfolio || !writePortfolio || !readRehabProjects || !writeRehabProjects) {
    throw new Error("createCrossModuleSyncService requires full read/write handlers");
  }

  async function reconcileState({ dealId = "", actor = "System Administrator", apply = true } = {}) {
    const [deals, properties, portfolio, rehabProjects] = await Promise.all([
      readDeals(),
      readProperties(),
      readPortfolio(),
      readRehabProjects(),
    ]);

    const filteredDeals = safeArray(deals).filter((entry) => !dealId || safeString(entry.id) === safeString(dealId));
    const nextProperties = safeArray(properties).map((entry) => ({ ...entry }));
    const nextDeals = safeArray(deals).map((entry) => ({ ...entry }));
    const nextPortfolio = safeArray(portfolio).map((entry) => ({ ...entry }));
    const nextRehabProjects = safeArray(rehabProjects).map((entry) => ({ ...entry }));

    const propertiesById = new Map(nextProperties.map((entry) => [safeString(entry.id), entry]));
    const propertiesByDealId = new Map(nextProperties.filter((entry) => safeString(entry.linkedDealId)).map((entry) => [safeString(entry.linkedDealId), entry]));
    const propertiesByAddress = new Map(nextProperties.map((entry) => [buildAddressKey(entry), entry]));

    const portfolioByAddress = new Map(nextPortfolio.map((entry) => [buildAddressKey(entry), entry]));

    for (const deal of filteredDeals) {
      const dealAddressKey = buildAddressKey(deal);
      const existingByDeal = propertiesByDealId.get(safeString(deal.id));
      const existingById = propertiesById.get(safeString(deal.propertyId));
      const existingByAddress = propertiesByAddress.get(dealAddressKey);
      const linkedPortfolio = nextPortfolio.find((entry) => safeString(entry.linkedDealId) === safeString(deal.id)) || portfolioByAddress.get(dealAddressKey);

      const existing = existingByDeal || existingById || existingByAddress || (linkedPortfolio ? propertiesById.get(safeString(linkedPortfolio.linkedPropertyId)) : null) || null;
      const mapped = mapDealToProperty(deal, existing);

      if (!existing) {
        nextProperties.push(mapped);
      } else {
        const index = nextProperties.findIndex((entry) => safeString(entry.id) === safeString(existing.id));
        if (index >= 0) {
          nextProperties[index] = mapped;
        }
      }

      propertiesById.set(safeString(mapped.id), mapped);
      propertiesByDealId.set(safeString(deal.id), mapped);
      propertiesByAddress.set(dealAddressKey, mapped);

      void linkedPortfolio;
    }

    for (let i = 0; i < nextPortfolio.length; i += 1) {
      const portfolioEntry = nextPortfolio[i];
      const addressKey = buildAddressKey(portfolioEntry);
      let property = propertiesById.get(safeString(portfolioEntry.linkedPropertyId));
      if (!property && safeString(portfolioEntry.linkedDealId)) {
        property = propertiesByDealId.get(safeString(portfolioEntry.linkedDealId));
      }
      if (!property) {
        property = propertiesByAddress.get(addressKey);
      }

      if (!property) {
        property = mapPortfolioToProperty(portfolioEntry, null);
        nextProperties.push(property);
      } else {
        const index = nextProperties.findIndex((entry) => safeString(entry.id) === safeString(property.id));
        if (index >= 0) {
          nextProperties[index] = mapPortfolioToProperty(portfolioEntry, nextProperties[index]);
          property = nextProperties[index];
        }
      }

      propertiesById.set(safeString(property.id), property);
      if (safeString(property.linkedDealId)) {
        propertiesByDealId.set(safeString(property.linkedDealId), property);
      }
      propertiesByAddress.set(addressKey, property);

      void portfolioEntry;
    }

    for (let i = 0; i < nextRehabProjects.length; i += 1) {
      const project = nextRehabProjects[i];
      let property = propertiesById.get(safeString(project.propertyId));
      if (!property && safeString(project.linkedDealId)) {
        property = propertiesByDealId.get(safeString(project.linkedDealId));
      }
      if (!property) {
        property = propertiesByAddress.get(buildAddressKey(project));
      }
      if (!property) continue;
    }

    const dedupedProperties = [];
    const seenPropertyIds = new Set();
    for (const property of nextProperties) {
      const id = safeString(property.id);
      if (!id || seenPropertyIds.has(id)) continue;
      seenPropertyIds.add(id);
      dedupedProperties.push(property);
    }

    const changed = {
      deals: !isDeepEqual(nextDeals, deals),
      properties: !isDeepEqual(dedupedProperties, properties),
      portfolio: !isDeepEqual(nextPortfolio, portfolio),
      rehabProjects: !isDeepEqual(nextRehabProjects, rehabProjects),
    };

    if (apply) {
      if (changed.deals) await writeDeals(nextDeals);
      if (changed.properties) await writeProperties(dedupedProperties);
      if (changed.portfolio) await writePortfolio(nextPortfolio);
      if (changed.rehabProjects) await writeRehabProjects(nextRehabProjects);
    }

    return {
      ok: true,
      actor,
      scopeDealId: safeString(dealId),
      changed,
      counts: {
        deals: safeArray(nextDeals).length,
        properties: safeArray(dedupedProperties).length,
        portfolio: safeArray(nextPortfolio).length,
        rehabProjects: safeArray(nextRehabProjects).length,
      },
      deals: nextDeals,
      properties: dedupedProperties,
      portfolio: nextPortfolio,
      rehabProjects: nextRehabProjects,
    };
  }

  async function synchronizeAll(actor = "System Administrator") {
    return reconcileState({ actor, apply: true });
  }

  async function synchronizeDealImport(dealId, actor = "System Administrator") {
    return reconcileState({ dealId, actor, apply: true });
  }

  async function previewSynchronizedState() {
    return reconcileState({ apply: false });
  }

  return {
    synchronizeAll,
    synchronizeDealImport,
    previewSynchronizedState,
  };
}
