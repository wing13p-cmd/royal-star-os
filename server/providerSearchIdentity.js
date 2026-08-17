function normalizeCacheCoordinate(value) {
  if (value === null || value === undefined || String(value).trim() === "") return "missing";
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric.toFixed(6) : "missing";
}

function buildSoldCompCacheKey(query = {}, provider = "rentcast") {
  const normalized = (value) => String(value ?? "").trim().toLowerCase().replace(/\s+/g, " ");
  const propertyType = normalized(query.propertyType).replace(/[^a-z0-9]/g, "");
  const canonicalPropertyType = ["singlefamily", "singlefamilyresidential", "sfh", "sfr", "detached"].includes(propertyType)
    ? "singlefamily"
    : propertyType;
  return [
    "rentcast-sold-comps-v3",
    normalized(provider),
    normalized(query.subjectDealId || query.dealId),
    normalized(query.propertyId),
    normalized(query.address),
    normalized(query.city),
    normalized(query.state),
    normalized(query.zipCode),
    normalizeCacheCoordinate(query.latitude),
    normalizeCacheCoordinate(query.longitude),
    canonicalPropertyType,
    "radius:1.5",
    "saleDays:548",
    "methodology:comp-provider-v3",
  ].join("|");
}

export { normalizeCacheCoordinate, buildSoldCompCacheKey };
