export const RSOS_CANONICAL_NAVIGATION = Object.freeze([
  { id: 'command-center', label: 'COMMAND CENTER', viewKey: 'dashboard', icon: '🏠', activeKey: 'dashboard', permission: 'read', sidebarVisible: true },
  { id: 'deal-intake', label: 'DEAL INTAKE', viewKey: 'dealIntake', icon: '➕', activeKey: 'dealIntake', permission: 'write', sidebarVisible: false },
  { id: 'deal-analyzer', label: 'DEAL ANALYZER', viewKey: 'dealAnalyzer', icon: '🔎', activeKey: 'dealAnalyzer', permission: 'read', sidebarVisible: true },
  { id: 'deal-intelligence', label: 'DEAL INTELLIGENCE', viewKey: 'dealIntelligence', icon: '🧠', activeKey: 'dealIntelligence', permission: 'read', sidebarVisible: false },
  { id: 'knowledge-base', label: 'KNOWLEDGE BASE', viewKey: 'knowledgeBase', icon: '🎓', activeKey: 'knowledgeBase', permission: 'read', sidebarVisible: true },
  { id: 'enterprise-search', label: 'GLOBAL SEARCH', viewKey: 'enterpriseSearch', icon: '⌕', activeKey: 'enterpriseSearch', permission: 'read', sidebarVisible: true },
  { id: 'forecasting-center', label: 'FORECASTING', viewKey: 'forecastingCenter', icon: '◫', activeKey: 'forecastingCenter', permission: 'read', sidebarVisible: true },
  { id: 'reporting-center', label: 'REPORTING', viewKey: 'reportingCenter', icon: '▤', activeKey: 'reportingCenter', permission: 'read', sidebarVisible: true },
  { id: 'document-automation', label: 'DOCUMENT AUTOMATION', viewKey: 'documentAutomation', icon: '▧', activeKey: 'documentAutomation', permission: 'read', sidebarVisible: true },
  { id: 'ai-command-center', label: 'AI COMMAND CENTER', viewKey: 'aiCommandCenter', icon: '✦', activeKey: 'aiCommandCenter', permission: 'read', sidebarVisible: true },
  { id: 'flip-analyzer', label: 'FLIP ANALYZER', viewKey: 'flipAnalyzer', icon: '📈', activeKey: 'flipAnalyzer', permission: 'read', sidebarVisible: true },
  { id: 'brrrr-analyzer', label: 'BRRRR ANALYZER', viewKey: 'brrrrAnalyzer', icon: '💳', activeKey: 'brrrrAnalyzer', permission: 'read', sidebarVisible: true },
  { id: 'product-vault', label: 'PRODUCT VAULT', viewKey: 'productVault', icon: '▣', activeKey: 'productVault', permission: 'read', sidebarVisible: true },
  { id: 'contractor-hub', label: 'CONTRACTOR HUB', viewKey: 'contractorHub', icon: '👥', activeKey: 'contractorHub', permission: 'read', sidebarVisible: true },
  { id: 'comp-database', label: 'COMP DATABASE', viewKey: 'compDatabase', icon: '🏘️', activeKey: 'compDatabase', permission: 'read', sidebarVisible: true },
  { id: 'neighborhood-database', label: 'NEIGHBORHOOD DB', viewKey: 'neighborhoodDatabase', icon: '📍', activeKey: 'neighborhoodDatabase', permission: 'read', sidebarVisible: true },
  { id: 'portfolio-dashboard', label: 'PORTFOLIO DASHBOARD', viewKey: 'portfolioDashboard', icon: '👥', activeKey: 'portfolioDashboard', permission: 'read', sidebarVisible: true },
  { id: 'lender-dashboard', label: 'LENDER DASHBOARD', viewKey: 'lenderDashboard', icon: '🏦', activeKey: 'lenderDashboard', permission: 'read', sidebarVisible: true },
  { id: 'appraiser-packet-builder', label: 'APPRAISER PACKET BUILDER', viewKey: 'appraiserPacketBuilder', icon: '📄', activeKey: 'appraiserPacketBuilder', permission: 'read', sidebarVisible: true },
  { id: 'rehab-project-tracker', label: 'REHAB PROJECT TRACKER', viewKey: 'rehabProjectTracker', icon: '▥', activeKey: 'rehabProjectTracker', permission: 'read', sidebarVisible: true },
  { id: 'property-database', label: 'PROPERTY DATABASE', viewKey: 'propertyDatabase', icon: '🗂️', activeKey: 'propertyDatabase', permission: 'read', sidebarVisible: true },
  { id: 'vendor-database', label: 'VENDOR DATABASE', viewKey: 'vendorDatabase', icon: '🗃️', activeKey: 'vendorDatabase', permission: 'read', sidebarVisible: true },
  { id: 'material-matrix', label: 'MATERIAL MATRIX', viewKey: 'materialMatrix', icon: '▪', activeKey: 'materialMatrix', permission: 'read', sidebarVisible: true },
]);

const AUXILIARY_VIEW_KEYS = ['offerGenerator'];
const KNOWN_VIEW_KEYS = new Set([
  ...RSOS_CANONICAL_NAVIGATION.map((entry) => entry.viewKey),
  ...AUXILIARY_VIEW_KEYS,
]);

export function getCanonicalNavigation() {
  return RSOS_CANONICAL_NAVIGATION.slice();
}

export function getSidebarNavigation() {
  return RSOS_CANONICAL_NAVIGATION.filter((entry) => entry.sidebarVisible);
}

export function isKnownViewKey(viewKey) {
  return KNOWN_VIEW_KEYS.has(String(viewKey || ''));
}

export function resolveSafeViewKey(viewKey, fallback = 'dashboard') {
  return isKnownViewKey(viewKey) ? viewKey : fallback;
}

export function shouldConfirmNavigation({ hasUnsavedChanges, targetViewKey, currentViewKey }) {
  if (!hasUnsavedChanges) return false;
  return String(targetViewKey || '') !== String(currentViewKey || '');
}
