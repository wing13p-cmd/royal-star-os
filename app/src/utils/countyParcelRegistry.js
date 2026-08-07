const COUNTY_SEARCH_REGISTRY = {
  "OH|HAMILTON": {
    county: "Hamilton",
    state: "OH",
    label: "Hamilton County Auditor Property Search",
    baseUrl: "https://wedge.hcauditor.org/",
    queryParam: "q",
    parcelParam: "parcel",
  },
};

const ZIP_TO_COUNTY = {
  "45205": { county: "Hamilton", state: "OH", city: "Cincinnati" },
};

const CITY_STATE_TO_COUNTY = {
  "CINCINNATI|OH": "Hamilton",
};

function normalizeText(value) {
  return String(value || "").trim();
}

function normalizeState(value) {
  const text = normalizeText(value).toUpperCase();
  return text.length > 2 ? text.slice(0, 2) : text;
}

function buildAddressQuery(values = {}) {
  return [values.address, values.city, values.state, values.zipCode]
    .map((entry) => normalizeText(entry))
    .filter(Boolean)
    .join(", ");
}

export function inferCounty(values = {}) {
  const explicitCounty = normalizeText(values.county);
  const explicitState = normalizeState(values.state);
  if (explicitCounty && explicitState) {
    return { county: explicitCounty, state: explicitState, source: "record" };
  }

  const zip = normalizeText(values.zipCode);
  if (zip && ZIP_TO_COUNTY[zip]) {
    const mapped = ZIP_TO_COUNTY[zip];
    return { county: mapped.county, state: mapped.state, source: "zip-map" };
  }

  const city = normalizeText(values.city).toUpperCase();
  const state = normalizeState(values.state);
  const cityKey = city && state ? `${city}|${state}` : "";
  if (cityKey && CITY_STATE_TO_COUNTY[cityKey]) {
    return { county: CITY_STATE_TO_COUNTY[cityKey], state, source: "city-map" };
  }

  return null;
}

export function resolveCountyParcelSearch(values = {}, options = {}) {
  const inferred = inferCounty(values);
  if (!inferred) {
    return {
      ok: false,
      message: "County information required.",
      county: "",
      state: normalizeState(values.state),
      source: "missing",
      url: "",
      destination: null,
    };
  }

  const key = `${normalizeState(inferred.state)}|${normalizeText(inferred.county).toUpperCase()}`;
  const destination = COUNTY_SEARCH_REGISTRY[key];
  if (!destination) {
    return {
      ok: false,
      message: "County information required.",
      county: inferred.county,
      state: inferred.state,
      source: inferred.source,
      url: "",
      destination: null,
    };
  }

  const addressQuery = buildAddressQuery(values);
  const parcelQuery = normalizeText(options.parcelNumber || values.parcelNumber);
  const queryValue = parcelQuery || addressQuery;
  const url = new URL(destination.baseUrl);

  if (queryValue && destination.queryParam) {
    url.searchParams.set(destination.queryParam, queryValue);
  }
  if (parcelQuery && destination.parcelParam) {
    url.searchParams.set(destination.parcelParam, parcelQuery);
  }

  return {
    ok: true,
    message: `Opened ${destination.label} (${inferred.county} County, ${inferred.state}).`,
    county: inferred.county,
    state: inferred.state,
    source: inferred.source,
    url: url.toString(),
    destination,
  };
}

export function getCountyRegistrySnapshot() {
  return {
    destinations: COUNTY_SEARCH_REGISTRY,
    zipToCounty: ZIP_TO_COUNTY,
    cityStateToCounty: CITY_STATE_TO_COUNTY,
  };
}
