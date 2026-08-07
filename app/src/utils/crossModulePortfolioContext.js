import { buildPortfolioIntelligence } from "../components/portfolioIntelligence.js";

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function toKey(value) {
  if (value === null || value === undefined) return "";
  return String(value).trim().toLowerCase();
}

function firstPresent(values = []) {
  for (const value of values) {
    if (value !== null && value !== undefined && String(value).trim() !== "") return value;
  }
  return "";
}

function buildCanonicalRecordKey(record = {}, index = 0) {
  const id = toKey(record.id || record.propertyId || record.dealId);
  if (id) return `id:${id}`;

  const address = toKey(record.propertyAddress || record.address || record.propertyName);
  const zip = toKey(record.zipCode || record.zip);
  if (address || zip) return `loc:${address}|${zip}`;

  return `idx:${index}`;
}

function dedupeCanonicalRecords(records = [], source = "unknown") {
  const canonical = [];
  const mirrors = [];
  const byKey = new Map();

  records.forEach((record, index) => {
    const key = buildCanonicalRecordKey(record, index);
    if (!byKey.has(key)) {
      byKey.set(key, canonical.length);
      canonical.push({
        ...record,
        id: record.id || record.propertyId || key,
        propertyAddress: firstPresent([record.propertyAddress, record.address, record.propertyName]),
      });
      return;
    }

    const canonicalIndex = byKey.get(key);
    const existing = canonical[canonicalIndex] || {};
    canonical[canonicalIndex] = {
      ...record,
      ...existing,
      id: existing.id || record.id || record.propertyId || key,
      propertyAddress: firstPresent([existing.propertyAddress, existing.address, record.propertyAddress, record.address, existing.propertyName, record.propertyName]),
    };
    mirrors.push({ key, source, index, canonicalIndex });
  });

  return { canonical, mirrors };
}

export function buildCrossModulePortfolioContext({
  deals = [],
  properties = [],
  portfolioEntries = [],
  rehabProjects = [],
  lenders = [],
  contractors = [],
} = {}) {
  const dedupedProperties = dedupeCanonicalRecords(safeArray(properties), "properties");
  const dedupedPortfolio = dedupeCanonicalRecords(safeArray(portfolioEntries), "portfolio");
  const canonicalProperties = dedupedProperties.canonical;
  const canonicalPortfolio = dedupedPortfolio.canonical;
  const canonicalDeals = safeArray(deals);
  const canonicalRehabProjects = safeArray(rehabProjects);
  const canonicalLenders = safeArray(lenders);
  const canonicalContractors = safeArray(contractors);

  const portfolioIntelligence = buildPortfolioIntelligence(
    canonicalProperties,
    canonicalDeals,
    canonicalRehabProjects,
    canonicalLenders,
    canonicalContractors,
    canonicalPortfolio,
    [],
    [],
  );

  return {
    canonicalProperties,
    canonicalPortfolio,
    canonicalMirrors: {
      properties: dedupedProperties.mirrors,
      portfolio: dedupedPortfolio.mirrors,
      totalMirrorCount: dedupedProperties.mirrors.length + dedupedPortfolio.mirrors.length,
    },
    contextTrace: {
      canonicalPropertyCount: canonicalProperties.length,
      canonicalPortfolioCount: canonicalPortfolio.length,
      sourcePropertyCount: safeArray(properties).length,
      sourcePortfolioCount: safeArray(portfolioEntries).length,
    },
    portfolioIntelligence,
  };
}

export function formatUnavailableCurrency(value) {
  if (value === null || value === undefined || value === "") return "Insufficient Data";
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return "Insufficient Data";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(parsed);
}

export function formatUnavailablePercent(value) {
  if (value === null || value === undefined || value === "") return "Insufficient Data";
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return "Insufficient Data";
  return `${parsed.toFixed(1)}%`;
}
