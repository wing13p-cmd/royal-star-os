function normalizeText(value) {
  return `${value ?? ''}`.toLowerCase().replace(/\s+/g, ' ').trim();
}

function findMatchingProperty(deal, properties = []) {
  return properties.find((property) => {
    const addressMatch = normalizeText(property.address || property.propertyAddress) && normalizeText(deal.propertyAddress || deal.address) && normalizeText(property.address || property.propertyAddress) === normalizeText(deal.propertyAddress || deal.address);
    const cityMatch = normalizeText(property.city) && normalizeText(deal.city) && normalizeText(property.city) === normalizeText(deal.city);
    const zipMatch = normalizeText(property.zipCode || property.zip) && normalizeText(deal.zipCode || deal.zip) && normalizeText(property.zipCode || property.zip) === normalizeText(deal.zipCode || deal.zip);
    return addressMatch || (cityMatch && zipMatch);
  });
}

function findMatchingPortfolioEntry(deal, portfolioEntries = []) {
  return portfolioEntries.find((entry) => {
    const addressMatch = normalizeText(entry.propertyAddress || entry.address) && normalizeText(deal.propertyAddress || deal.address) && normalizeText(entry.propertyAddress || entry.address) === normalizeText(deal.propertyAddress || deal.address);
    const cityMatch = normalizeText(entry.city) && normalizeText(deal.city) && normalizeText(entry.city) === normalizeText(deal.city);
    const zipMatch = normalizeText(entry.zipCode || entry.zip) && normalizeText(deal.zipCode || deal.zip) && normalizeText(entry.zipCode || entry.zip) === normalizeText(deal.zipCode || deal.zip);
    return addressMatch || (cityMatch && zipMatch);
  });
}

function getExistingProject(deal, properties = [], rehabProjects = []) {
  const property = findMatchingProperty(deal, properties);
  const propertyId = property?.id || '';
  const addressKey = normalizeText(deal.propertyAddress || deal.address);

  return rehabProjects.find((project) => {
    if (project.linkedDealId && project.linkedDealId === deal.id) return true;
    if (project.propertyId && propertyId && project.propertyId === propertyId) return true;
    return Boolean(addressKey && normalizeText(project.propertyAddress || project.propertyName) === addressKey);
  });
}

export function buildModuleSyncState(payload = {}) {
  const deals = Array.isArray(payload.deals) ? payload.deals : [];
  const properties = Array.isArray(payload.properties) ? payload.properties : [];
  const portfolioEntries = Array.isArray(payload.portfolioEntries) ? payload.portfolioEntries : [];
  const rehabProjects = Array.isArray(payload.rehabProjects) ? payload.rehabProjects : [];
  const contractors = Array.isArray(payload.contractors) ? payload.contractors : [];
  const lenders = Array.isArray(payload.lenders) ? payload.lenders : [];
  const appraisalPackets = Array.isArray(payload.appraisalPackets) ? payload.appraisalPackets : [];

  const dealLinks = deals.map((deal) => {
    const matchedProperty = findMatchingProperty(deal, properties);
    const matchedPortfolio = findMatchingPortfolioEntry(deal, portfolioEntries);
    return {
      dealId: deal.id,
      linkedPropertyId: matchedProperty?.id || '',
      linkedPortfolioId: matchedPortfolio?.id || '',
      propertyAddress: deal.propertyAddress || deal.address || '',
      hasLinkedProperty: Boolean(matchedProperty),
      hasLinkedPortfolio: Boolean(matchedPortfolio),
    };
  });

  const propertyLinks = properties.map((property) => {
    const matchedDeal = deals.find((deal) => {
      const dealAddress = normalizeText(deal.propertyAddress || deal.address);
      const propertyAddress = normalizeText(property.address || property.propertyName);
      return dealAddress && propertyAddress && dealAddress === propertyAddress;
    });
    return {
      propertyId: property.id,
      linkedDealId: matchedDeal?.id || property.linkedDealId || '',
      address: property.address || property.propertyName || '',
      hasLinkedDeal: Boolean(matchedDeal),
    };
  });

  const summary = {
    linkedPropertyCount: dealLinks.filter((link) => link.linkedPropertyId).length,
    linkedPortfolioCount: dealLinks.filter((link) => link.linkedPortfolioId).length,
    linkedRehabProjectCount: rehabProjects.filter((project) => project.linkedDealId || project.propertyId).length,
    contractorCount: contractors.length,
    lenderCount: lenders.length,
    appraisalPacketCount: appraisalPackets.length,
  };

  return {
    dealLinks,
    propertyLinks,
    summary,
  };
}

export function buildRehabProjectFromDeal(deal, property = {}, rehabProjects = []) {
  const matchedProject = getExistingProject(deal, [property].filter(Boolean), rehabProjects);
  if (matchedProject) {
    return matchedProject;
  }

  const address = deal.propertyAddress || deal.address || property.address || '';
  const budget = deal.rehabBudget || 0;
  const projectedArv = deal.estimatedArv || deal.arv || 0;

  return {
    id: `project-${Date.now()}`,
    propertyId: property.id || '',
    linkedDealId: deal.id || '',
    projectName: `${address || 'Untitled Project'} Rehab`,
    propertyAddress: address,
    projectStatus: 'Planning',
    currentPhase: 'Planning',
    originalRehabBudget: budget,
    projectedARV: projectedArv,
    projectedProfit: projectedArv - (deal.purchasePrice || 0) - budget,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}
