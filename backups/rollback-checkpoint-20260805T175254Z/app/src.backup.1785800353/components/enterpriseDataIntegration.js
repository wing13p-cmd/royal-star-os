function normalizeText(value) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value.trim().replace(/\s+/g, ' ');
  return String(value).trim();
}

function normalizeState(value) {
  const state = normalizeText(value).toUpperCase();
  const states = { AL: 'AL', AZ: 'AZ', AR: 'AR', CA: 'CA', CO: 'CO', CT: 'CT', DE: 'DE', FL: 'FL', GA: 'GA', ID: 'ID', IL: 'IL', IN: 'IN', IA: 'IA', KS: 'KS', KY: 'KY', LA: 'LA', ME: 'ME', MD: 'MD', MA: 'MA', MI: 'MI', MN: 'MN', MS: 'MS', MO: 'MO', MT: 'MT', NE: 'NE', NV: 'NV', NH: 'NH', NJ: 'NJ', NM: 'NM', NY: 'NY', NC: 'NC', ND: 'ND', OH: 'OH', OK: 'OK', OR: 'OR', PA: 'PA', RI: 'RI', SC: 'SC', SD: 'SD', TN: 'TN', TX: 'TX', UT: 'UT', VT: 'VT', VA: 'VA', WA: 'WA', WV: 'WV', WI: 'WI', WY: 'WY', DC: 'DC' };
  return states[state] || state;
}

function normalizeZip(value) {
  const zip = normalizeText(value);
  return zip.replace(/[^0-9A-Za-z-]/g, '');
}

function parseCurrency(value) {
  if (value === null || value === undefined || value === '') return '';
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const text = normalizeText(value).replace(/[$,]/g, '').replace(/\s+/g, '');
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : '';
}

function parsePercentage(value) {
  if (value === null || value === undefined || value === '') return '';
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const text = normalizeText(value).replace(/[%]/g, '');
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed / 100 : '';
}

function normalizePhone(value) {
  const text = normalizeText(value);
  if (!text) return '';
  const digits = text.replace(/\D/g, '');
  if (digits.length === 10) return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  return text;
}

function normalizeEmail(value) {
  const text = normalizeText(value).toLowerCase();
  return text;
}

function normalizeDate(value) {
  if (!value) return '';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? normalizeText(value) : parsed.toISOString().slice(0, 10);
}

function normalizeRecordForStorage(record = {}, recordType = 'property') {
  const normalized = { ...(record || {}) };
  if (recordType === 'property' || recordType === 'deal') {
    normalized.address = normalizeText(record.address || record.propertyAddress || record.streetAddress);
    normalized.propertyAddress = normalized.address;
    normalized.city = normalizeText(record.city || record.municipality);
    normalized.state = normalizeState(record.state || record.ST || record.st);
    normalized.zipCode = normalizeZip(record.zipCode || record.zip || record.postalCode);
    normalized.propertyType = normalizeText(record.propertyType || record.property_type || record.type);
    normalized.bedrooms = Number.isFinite(Number(record.bedrooms)) ? Number(record.bedrooms) : '';
    normalized.bathrooms = Number.isFinite(Number(record.bathrooms)) ? Number(record.bathrooms) : '';
    normalized.squareFeet = Number.isFinite(Number(record.squareFeet || record.sqFt || record.livingArea)) ? Number(record.squareFeet || record.sqFt || record.livingArea) : '';
    normalized.yearBuilt = Number.isFinite(Number(record.yearBuilt)) ? Number(record.yearBuilt) : '';
    normalized.purchasePrice = parseCurrency(record.purchasePrice || record.price || record.listPrice || record.askingPrice);
    normalized.askingPrice = parseCurrency(record.askingPrice || record.listPrice || record.price || record.purchasePrice);
    normalized.estimatedArv = parseCurrency(record.estimatedArv || record.arv || record.afterRepairValue);
    normalized.rehabBudget = parseCurrency(record.rehabBudget || record.repairs || record.renovationBudget || record.rehab);
    normalized.estimatedRent = parseCurrency(record.estimatedRent || record.rent || record.monthlyRent);
    normalized.interestRate = parsePercentage(record.interestRate || record.rate);
    normalized.loanAmount = parseCurrency(record.loanAmount || record.loan);
    normalized.contractorName = normalizeText(record.contractorName || record.contractor || record.contractor_name);
    normalized.lenderName = normalizeText(record.lenderName || record.lender || record.lender_name);
    normalized.vendorName = normalizeText(record.vendorName || record.vendor || record.vendor_name);
    normalized.phone = normalizePhone(record.phone || record.phoneNumber);
    normalized.email = normalizeEmail(record.email || record.emailAddress);
    normalized.notes = normalizeText(record.notes || record.description || record.descriptionText);
    if (recordType === 'deal') {
      normalized.status = normalizeText(record.status || 'active');
    }
  }

  if (recordType === 'contractor' || recordType === 'lender' || recordType === 'vendor') {
    normalized.name = normalizeText(record.name || record.contractorName || record.lenderName || record.vendorName || record.companyName);
    normalized.phone = normalizePhone(record.phone || record.phoneNumber);
    normalized.email = normalizeEmail(record.email || record.emailAddress);
    normalized.notes = normalizeText(record.notes || record.description);
  }

  if (recordType === 'comp') {
    normalized.address = normalizeText(record.address || record.compAddress || record.streetAddress);
    normalized.saleDate = normalizeDate(record.saleDate || record.sale_date);
    normalized.salePrice = parseCurrency(record.salePrice || record.soldPrice || record.price);
    normalized.source = normalizeText(record.source || record.sourceId || record.sourceIdentifier);
  }

  return normalized;
}

function buildFieldMapping(headers = []) {
  const mapping = {};
  const normalizedHeaders = headers.map((header) => normalizeText(header).toLowerCase());
  const findHeader = (aliases) => normalizedHeaders.find((header) => aliases.some((alias) => header === alias || header.includes(alias)));

  const addressHeader = findHeader(['address', 'property address', 'street address']);
  if (addressHeader) mapping.address = 'address';
  const cityHeader = findHeader(['city', 'municipality']);
  if (cityHeader) mapping.city = 'city';
  const stateHeader = findHeader(['state', 'st']);
  if (stateHeader) mapping.state = 'state';
  const zipHeader = findHeader(['zip', 'zip code', 'postal code']);
  if (zipHeader) mapping.zipCode = 'zipCode';
  const bedsHeader = findHeader(['beds', 'bedrooms']);
  if (bedsHeader) mapping.bedrooms = 'bedrooms';
  const bathsHeader = findHeader(['baths', 'bathrooms']);
  if (bathsHeader) mapping.bathrooms = 'bathrooms';
  const sqftHeader = findHeader(['sq ft', 'square feet', 'living area']);
  if (sqftHeader) mapping.squareFeet = 'squareFeet';
  const priceHeader = findHeader(['price', 'asking price', 'list price']);
  if (priceHeader) mapping.askingPrice = 'askingPrice';
  const salePriceHeader = findHeader(['sold price', 'sale price']);
  if (salePriceHeader) mapping.purchasePrice = 'purchasePrice';
  const rehabHeader = findHeader(['rehab', 'repairs', 'renovation budget']);
  if (rehabHeader) mapping.rehabBudget = 'rehabBudget';
  const arvHeader = findHeader(['arv', 'after repair value']);
  if (arvHeader) mapping.estimatedArv = 'estimatedArv';
  const rentHeader = findHeader(['rent', 'monthly rent']);
  if (rentHeader) mapping.estimatedRent = 'estimatedRent';
  const contractorHeader = findHeader(['contractor', 'contractor name']);
  if (contractorHeader) mapping.contractorName = 'contractorName';
  const lenderHeader = findHeader(['lender', 'lender name']);
  if (lenderHeader) mapping.lenderName = 'lenderName';

  return mapping;
}

function detectDuplicateConfidence(candidate = {}, existing = {}) {
  const normalizedCandidate = normalizeRecordForStorage(candidate, 'property');
  const normalizedExisting = normalizeRecordForStorage(existing, 'property');
  const candidateAddress = `${normalizedCandidate.address || ''}`.toLowerCase();
  const existingAddress = `${normalizedExisting.address || ''}`.toLowerCase();
  const sameAddress = candidateAddress && existingAddress && candidateAddress === existingAddress;
  const sameCity = `${normalizedCandidate.city || ''}`.toLowerCase() === `${normalizedExisting.city || ''}`.toLowerCase();
  const sameState = `${normalizedCandidate.state || ''}`.toLowerCase() === `${normalizedExisting.state || ''}`.toLowerCase();
  const sameZip = `${normalizedCandidate.zipCode || ''}`.toLowerCase() === `${normalizedExisting.zipCode || ''}`.toLowerCase();
  if (sameAddress && sameCity && sameState && sameZip) return 'exact';
  if (sameCity && sameState && sameZip && (sameAddress || `${normalizedCandidate.address || ''}`.includes(`${normalizedExisting.address || ''}`) || `${normalizedExisting.address || ''}`.includes(`${normalizedCandidate.address || ''}`))) return 'likely';
  return 'none';
}

function buildImportPreview(csvText, recordType = 'property', existingRecords = []) {
  const rows = (csvText || '').trim().split(/\r?\n/).filter(Boolean);
  if (rows.length < 2) return { rows: [], summary: { accepted: 0, rejected: 0, skipped: 0, flagged: 0 } };
  const headers = rows[0].split(',').map((column) => column.trim());
  const mapping = buildFieldMapping(headers);
  const dataRows = rows.slice(1).map((row) => row.split(',').map((value) => value.trim()));

  const previewRows = [];
  dataRows.forEach((values, index) => {
    const record = Object.fromEntries(headers.map((header, headerIndex) => [header, values[headerIndex] || '']));
    const normalized = normalizeRecordForStorage(record, recordType);
    let duplicateConfidence = existingRecords.reduce((best, existing) => {
      const confidence = detectDuplicateConfidence(normalized, existing);
      return confidence === 'exact' ? 'exact' : best === 'likely' ? 'likely' : confidence;
    }, 'none');

    if (duplicateConfidence === 'none') {
      duplicateConfidence = previewRows.reduce((best, existingRow) => {
        const confidence = detectDuplicateConfidence(normalized, existingRow.normalized);
        return confidence === 'exact' ? 'exact' : best === 'likely' ? 'likely' : confidence;
      }, 'none');
    }

    previewRows.push({
      rowNumber: index + 2,
      record,
      normalized,
      mapping,
      duplicateConfidence,
      status: duplicateConfidence === 'exact' ? 'flagged' : 'ready',
    });
  });

  return {
    rows: previewRows,
    summary: {
      accepted: previewRows.filter((row) => row.status === 'ready').length,
      rejected: 0,
      skipped: 0,
      flagged: previewRows.filter((row) => row.status === 'flagged').length,
    },
    mapping,
  };
}

function mergeRecords(retainedRecord = {}, duplicateRecord = {}) {
  const merged = { ...retainedRecord };
  Object.entries(duplicateRecord).forEach(([key, value]) => {
    if (key === 'mergeHistory' || key === 'notes') return;
    const hasRetainedValue = retainedRecord[key] !== null && retainedRecord[key] !== undefined && retainedRecord[key] !== '';
    const hasDuplicateValue = value !== null && value !== undefined && value !== '';
    if (!hasRetainedValue && hasDuplicateValue) {
      merged[key] = value;
    }
  });
  const mergedNotes = [retainedRecord.notes, duplicateRecord.notes].filter(Boolean).join(' | ');
  if (mergedNotes) merged.notes = mergedNotes;
  merged.mergeHistory = [
    ...(retainedRecord.mergeHistory || []),
    {
      action: 'merge',
      timestamp: new Date().toISOString(),
      retainedId: retainedRecord.id,
      duplicateId: duplicateRecord.id,
      preservedValues: ['notes', 'sourceHistory'],
    },
  ];
  return merged;
}

export { normalizeRecordForStorage, buildFieldMapping, detectDuplicateConfidence, buildImportPreview, mergeRecords };
