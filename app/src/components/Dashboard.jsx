import { useEffect, useMemo, useState } from "react";
import logo from "../assets/royal-star-logo.png";
import { buildCapitalAllocationEngine } from "./capitalAllocationEngine.js";
import { buildCommandCenterIntelligence } from "./commandCenterIntelligence.js";
import { buildPortfolioIntelligence } from "./portfolioIntelligence.js";
import { buildModuleSyncState } from "./moduleSync.js";
import { buildAiDecisionEngine } from "./aiDecisionEngine.js";
import { buildEnterpriseAutomationOrchestrator } from "./enterpriseAutomationOrchestrator.js";
import { buildApiUrl } from "../utils/apiClient.js";
import { buildExecutiveViewModel, buildSystemHealthViewModel, buildAutomationViewModel, createRequestCache } from "../utils/enterpriseUiIntegration.js";
import { buildUnifiedUnderwritingIntelligence, normalizeDealForIntelligence } from "./intelligenceUpgradeEngine.js";
import { buildOperationsStatusSummary, createOperationsService, fetchOperationsJson } from "../utils/operationsIntegration.js";
import { buildLiveEnterpriseDashboardModel } from "../utils/liveEnterpriseIntelligence.js";
import { buildCrossModulePortfolioContext } from "../utils/crossModulePortfolioContext.js";
import { version as appVersion } from "../version.js";
import { getSidebarNavigation } from "../utils/navigationModel.js";
import { useLogoutControl } from "../hooks/useLogoutControl.js";

const navigation = getSidebarNavigation();

const topMetrics = [
  ["🏠", "ACTIVE DEALS", "View All Deals"],
  ["$", "TOTAL CASH DEPLOYED", "View Summary"],
  ["📈", "PIPELINE VALUE", "View Pipeline"],
  ["📄", "PROJECTS IN REHAB", "View Projects"],
  ["🏦", "LENDERS & FUNDING", "View Lenders"],
];

const firstRow = [
  {
    icon: "🔎",
    title: "DEAL ANALYZER",
    body: "Analyze deals, run calculations, and evaluate investment scenarios.",
    action: "OPEN TOOL",
  },
  {
    icon: "▣",
    title: "PRODUCT VAULT",
    body: "Access approved products, vendors, SKU tracking, and pricing history.",
    action: "OPEN VAULT",
  },
  {
    icon: "🤝",
    title: "CONTRACTOR HUB",
    body: "Manage contractors, performance, insurance, and project assignments.",
    action: "OPEN HUB",
  },
  {
    icon: "🏘️",
    title: "COMP DATABASE",
    body: "View and manage comps, sales data, and market analysis.",
    action: "OPEN DATABASE",
  },
  {
    icon: "👥",
    title: "PORTFOLIO DASHBOARD",
    body: "Track assets, equity, performance, ROI, and cash flow.",
    action: "VIEW DASHBOARD",
  },
];

const secondRow = [
  {
    icon: "🏦",
    title: "LENDER DASHBOARD",
    body: "Track loans, balances, term sheets, and communication.",
    action: "OPEN DASHBOARD",
  },
  {
    icon: "📄",
    title: "APPRAISER PACKET BUILDER",
    body: "Build professional appraisal packets in minutes.",
    action: "BUILD PACKET",
  },
  {
    icon: "📍",
    title: "NEIGHBORHOOD DATABASE",
    body: "Explore neighborhoods, demographics, and investment data.",
    action: "OPEN DATABASE",
  },
  {
    icon: "▥",
    title: "REHAB PROJECT TRACKER",
    body: "Track budgets, timelines, progress, and project photos.",
    action: "OPEN TRACKER",
  },
  {
    icon: "🎓",
    title: "KNOWLEDGE BASE",
    body: "Access templates, checklists, guides, and training.",
    action: "OPEN LIBRARY",
  },
];

const activity = [
  ["📄", "123 Main St - Analysis Updated", "Today"],
  ["🏠", "456 Oak Ave - Rehab Budget", "Today"],
  ["📊", "New Comp Added - 789 Pine", "Yesterday"],
  ["🏦", "Lender Packet Sent - Sunshine", "Yesterday"],
  ["🧰", "Vendor Price Update - Flooring", "2 Days Ago"],
];

function stringifyDetail(value) {
  if (value === null || value === undefined || value === "") return "Insufficient Data";
  if (typeof value === "string") return value;
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "Insufficient Data";
  if (Array.isArray(value)) return value.length ? value.join(" | ") : "Insufficient Data";
  try {
    return JSON.stringify(value);
  } catch {
    return "Insufficient Data";
  }
}

function buildTraceabilityRows(metricTrace = {}, fallbackValue = "Insufficient Data") {
  const weightsText = metricTrace.weights && typeof metricTrace.weights === "object"
    ? Object.entries(metricTrace.weights).map(([key, value]) => `${key}=${value}`).join(" | ")
    : "Insufficient Data";
  const sourcesText = Array.isArray(metricTrace.sourceRecords)
    ? metricTrace.sourceRecords.join(" | ")
    : "Insufficient Data";
  const missingText = Array.isArray(metricTrace.missingInputs)
    ? (metricTrace.missingInputs.length ? metricTrace.missingInputs.join(" | ") : "None")
    : "Insufficient Data";
  return [
    ["Value", stringifyDetail(metricTrace.value ?? fallbackValue)],
    ["Formula", stringifyDetail(metricTrace.formula)],
    ["Source Records", sourcesText],
    ["Weights", weightsText],
    ["Missing Inputs", missingText],
    ["Thresholds", stringifyDetail(metricTrace.thresholds)],
    ["Calculated At", stringifyDetail(metricTrace.lastCalculationTime)],
  ];
}

export default function Dashboard({ onOpenDealIntake, onOpenDealAnalyzer, onOpenProductVault, onOpenContractorHub, onOpenDealIntelligence, onOpenKnowledgeBase, onOpenCompDatabase, onOpenNeighborhoodDatabase, onOpenPortfolioDashboard, onOpenPropertyDatabase, onOpenLenderDashboard, onOpenAppraiserPacketBuilder, onOpenRehabProjectTracker, currentView = "dashboard", onNavigate }) {
  const [commandCenterState, setCommandCenterState] = useState(null);
  const [searchText, setSearchText] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [systemHealth, setSystemHealth] = useState(null);
  const [operationsSummary, setOperationsSummary] = useState(null);
  const [automationSummary, setAutomationSummary] = useState(null);
  const [liveEnterpriseModel, setLiveEnterpriseModel] = useState(null);
  const [kpiDrilldown, setKpiDrilldown] = useState(null);
  const [focusedKpiId, setFocusedKpiId] = useState("");
  const [refreshTick, setRefreshTick] = useState(0);
  const { logoutEnabled, loggingOut, handleLogout, title: logoutTitle } = useLogoutControl();

  const handleSidebarNavigate = (viewKey) => {
    if (!onNavigate) return;
    if (String(viewKey) === String(currentView)) return;
    onNavigate(viewKey);
  };
  const requestCache = useMemo(() => createRequestCache(), []);
  const operationsService = useMemo(() => createOperationsService(), []);

  useEffect(() => {
    const loadSourceData = async () => {
      try {
        const [dealsRes, intelligenceRes, propertiesRes, rehabRes, contractorsRes, lendersRes, portfolioRes, syncStateRes, healthRes] = await Promise.all([
          fetch(buildApiUrl("/api/deals")).catch(() => ({ ok: false })),
          fetch(buildApiUrl("/api/deal-intelligence")).catch(() => ({ ok: false })),
          fetch(buildApiUrl("/api/properties")).catch(() => ({ ok: false })),
          fetch(buildApiUrl("/api/rehab-projects")).catch(() => ({ ok: false })),
          fetch(buildApiUrl("/api/contractors")).catch(() => ({ ok: false })),
          fetch(buildApiUrl("/api/lenders")).catch(() => ({ ok: false })),
          fetch(buildApiUrl("/api/portfolio")).catch(() => ({ ok: false })),
          fetch(buildApiUrl("/api/cross-module-sync")).catch(() => ({ ok: false })),
          requestCache.getOrCreate('system-health', async () => fetch(buildApiUrl('/api/health')).catch(() => ({ ok: false }))),
        ]);

        const readJson = async (response) => {
          if (!response || !response.ok) return [];
          try {
            return await response.json();
          } catch {
            return [];
          }
        };

        const [deals, dealIntelligence, properties, rehabProjects, contractors, lenders, portfolioData, crossModuleState, healthPayload] = await Promise.all([
          readJson(dealsRes),
          readJson(intelligenceRes),
          readJson(propertiesRes),
          readJson(rehabRes),
          readJson(contractorsRes),
          readJson(lendersRes),
          readJson(portfolioRes),
          readJson(syncStateRes),
          readJson(healthRes),
        ]);

        const synchronizedProperties = Array.isArray(crossModuleState?.properties) ? crossModuleState.properties : properties;
        const synchronizedPortfolio = Array.isArray(crossModuleState?.portfolio) ? crossModuleState.portfolio : portfolioData;
        const synchronizedRehabProjects = Array.isArray(crossModuleState?.rehabProjects) ? crossModuleState.rehabProjects : rehabProjects;

        const operationsPayload = await operationsService.load('dashboard-operations', async () => {
          const [workflowRes, recoveryRes, auditRes, monitoringRes, alertsRes] = await Promise.all([
            fetchOperationsJson('/api/operations/workflow').catch(() => ({ workflow: {} })),
            fetchOperationsJson('/api/operations/recoveries').catch(() => ({ recoveries: [] })),
            fetchOperationsJson('/api/operations/audit').catch(() => ({ auditEvents: [] })),
            fetchOperationsJson('/api/operations/monitoring').catch(() => ({ monitoring: {} })),
            fetchOperationsJson('/api/operations/alerts').catch(() => ({ alerts: [] })),
          ]);
          return {
            workflow: workflowRes?.workflow || {},
            recoveries: recoveryRes?.recoveries || [],
            auditEvents: auditRes?.auditEvents || [],
            monitoring: monitoringRes?.monitoring || {},
            alerts: alertsRes?.alerts || [],
          };
        });
        const derivedOperationsSummary = buildOperationsStatusSummary({
          workflow: operationsPayload.workflow || {},
          recoveries: operationsPayload.recoveries || [],
          monitoring: operationsPayload.monitoring || {},
          alerts: operationsPayload.alerts || [],
        }, healthPayload && typeof healthPayload === 'object' ? healthPayload : {}, { applicationVersion: appVersion });
        setOperationsSummary(derivedOperationsSummary);

        const derivedLiveModel = buildLiveEnterpriseDashboardModel({
          deals,
          properties: synchronizedProperties,
          rehabProjects: synchronizedRehabProjects,
          contractors,
          lenders,
          portfolioEntries: synchronizedPortfolio,
          dealIntelligence,
          backendHealth: healthPayload && typeof healthPayload === 'object' ? healthPayload : {},
          operationsPayload,
          version: appVersion,
        });
        const operationsDerivedSummary = {
          ...derivedOperationsSummary,
          alertCount: derivedLiveModel?.summaryStats?.totalAlertCount ?? derivedOperationsSummary?.alertCount ?? 0,
        };
        setOperationsSummary(operationsDerivedSummary);
        setLiveEnterpriseModel(derivedLiveModel);

        const derivedDealIntelligence = (Array.isArray(deals) ? deals : []).map((deal, index) => {
          const normalizedDeal = normalizeDealForIntelligence(deal);
          const underwriting = buildUnifiedUnderwritingIntelligence(normalizedDeal, [], []);
          const existingEntry = Array.isArray(dealIntelligence) ? dealIntelligence.find((entry) => String(entry.id) === String(deal.id) || String(entry.dealId) === String(deal.id)) : null;
          const decisionLabel = underwriting.recommendation.action === "PROCEED" ? "Strong Buy" : underwriting.recommendation.action === "REQUEST MORE DATA" ? "Re-underwrite" : underwriting.recommendation.action === "CONTINUE PROJECT" || underwriting.recommendation.action === "CONTINUE REHAB" || underwriting.recommendation.action === "HOLD" ? underwriting.recommendation.action : "Conditional Buy";
          const backendIntelligence = existingEntry && typeof existingEntry === 'object' ? existingEntry : {};
          const riskFlags = Array.isArray(backendIntelligence.majorRiskFlags) && backendIntelligence.majorRiskFlags.length ? backendIntelligence.majorRiskFlags : [];
          const followUps = Array.isArray(backendIntelligence.requiredFollowUpItems) && backendIntelligence.requiredFollowUpItems.length ? backendIntelligence.requiredFollowUpItems : [];
          const investmentDecision = underwriting.decisionConsistency?.investmentDecision || underwriting.recommendation.action || 'REJECT';
          const decisionText = investmentDecision === 'Continue Project' || investmentDecision === 'Continue Rehab' || investmentDecision === 'Hold' ? investmentDecision : (investmentDecision === 'Buy' || investmentDecision === 'Strong Buy' ? 'Buy' : investmentDecision);
          return {
            ...backendIntelligence,
            id: backendIntelligence.id || deal.id || `deal-intelligence-${index}`,
            dealId: deal.id || backendIntelligence.dealId || `deal-${index}`,
            analysisName: deal.propertyAddress || deal.address || `Deal ${index + 1}`,
            decision: backendIntelligence.decision || decisionLabel,
            recommendation: backendIntelligence.recommendation || decisionText,
            dealScore: backendIntelligence.dealScore ?? Math.max(0, Math.min(100, Math.round(underwriting.flipAnalysis.netProfit > 0 ? 74 : 44))),
            profit: backendIntelligence.profit ?? underwriting.flipAnalysis.netProfit,
            roi: backendIntelligence.roi ?? underwriting.flipAnalysis.returnOnCost,
            estimatedCashRequired: backendIntelligence.estimatedCashRequired ?? underwriting.brrrrAnalysis.cashInvested,
            riskLevel: backendIntelligence.riskLevel || (underwriting.buyBox.decision === "Strong Pass" ? "Low" : "Moderate"),
            mainAdvantage: backendIntelligence.mainAdvantage || underwriting.recommendation.strongestFactors[0] || "Supported by shared underwriting",
            mainRisk: backendIntelligence.mainRisk || underwriting.recommendation.primaryRisks[0] || "Requires confirmation",
            requiredNextAction: backendIntelligence.requiredNextAction || underwriting.recommendation.nextAction,
            analysisStatus: backendIntelligence.analysisStatus || (underwriting.recommendation.action === "PROCEED" ? "Ready to offer" : underwriting.recommendation.action === "CONTINUE PROJECT" || underwriting.recommendation.action === "CONTINUE REHAB" || underwriting.recommendation.action === "HOLD" ? "Active project review" : "Re-underwrite required"),
            underwritingSummary: backendIntelligence.underwritingSummary || `ARV ${underwriting.arvAnalysis.supportedBaseArv > 0 ? `$${underwriting.arvAnalysis.supportedBaseArv.toLocaleString()}` : 'Insufficient Data'} · Rehab ${underwriting.rehabBudget > 0 ? `$${underwriting.rehabBudget.toLocaleString()}` : 'Insufficient Data'}`,
            offerGuidance: backendIntelligence.offerGuidance || `Offer guidance ${backendIntelligence.recommendedOffer ? `$${backendIntelligence.recommendedOffer.toLocaleString()}` : 'Insufficient Data'}`,
            majorRiskFlags: riskFlags.length ? riskFlags : (backendIntelligence.warnings || []),
            requiredFollowUpItems: followUps.length ? followUps : (backendIntelligence.requiredNextActions || []),
            actualLoanAmount: backendIntelligence.actualLoanAmount ?? underwriting.financingAnalysis?.actualLoanAmount ?? 0,
            monthlyCarry: backendIntelligence.monthlyCarry ?? underwriting.financingAnalysis?.monthlyCarry ?? 0,
            initialCashInvested: backendIntelligence.initialCashInvested ?? underwriting.financingAnalysis?.initialCashInvested ?? 0,
          };
        });

        const crossModuleContext = buildCrossModulePortfolioContext({
          deals,
          properties: synchronizedProperties,
          portfolioEntries: synchronizedPortfolio,
          rehabProjects: synchronizedRehabProjects,
          lenders,
          contractors,
        });
        const portfolioIntelligence = crossModuleContext.portfolioIntelligence;
        const syncState = buildModuleSyncState({
          deals,
          properties: crossModuleContext.canonicalProperties,
          portfolioEntries: crossModuleContext.canonicalPortfolio,
          rehabProjects: synchronizedRehabProjects,
          contractors,
          lenders,
          appraisalPackets: [],
        });
        const intelligence = buildCommandCenterIntelligence({
          deals,
          dealIntelligence: derivedDealIntelligence,
          properties: crossModuleContext.canonicalProperties,
          portfolioData: crossModuleContext.canonicalPortfolio,
          rehabProjects: synchronizedRehabProjects,
          contractors,
          lenders,
          comps: [],
          neighborhoods: [],
          appraisalPackets: [],
          portfolioIntelligence,
          syncState,
        });
        const derivedHealth = buildSystemHealthViewModel({ backendHealth: healthPayload, version: appVersion, configReady: true });
        const orchestrator = buildEnterpriseAutomationOrchestrator({
          deals,
          dealIntelligence: derivedDealIntelligence,
          properties: crossModuleContext.canonicalProperties,
          rehabProjects: synchronizedRehabProjects,
          contractors,
          lenders,
          portfolioIntelligence,
          portfolioNotes: [],
          comps: [],
          neighborhoods: [],
          manualOverrideStrategy: 'Balanced Growth',
        });
        setSystemHealth(derivedHealth);
        setAutomationSummary(buildAutomationViewModel({ orchestrator }));
        setCommandCenterState(intelligence);
      } catch {
        setOperationsSummary(buildOperationsStatusSummary({ workflow: {}, recoveries: [], monitoring: {}, alerts: [] }, { healthy: true, status: 'ok' }, { applicationVersion: appVersion }));
        setAutomationSummary(buildAutomationViewModel({ orchestrator: buildEnterpriseAutomationOrchestrator({}) }));
        setCommandCenterState(buildCommandCenterIntelligence({ deals: [], dealIntelligence: [], properties: [], portfolioData: [], rehabProjects: [], contractors: [], lenders: [], comps: [], neighborhoods: [], appraisalPackets: [], portfolioIntelligence: buildPortfolioIntelligence([], [], [], [], [], [], [], []) }));
      }
    };

    loadSourceData();
  }, [operationsService, refreshTick, requestCache]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const refresh = () => setRefreshTick((current) => current + 1);
    const refreshOnVisibility = () => {
      if (document.visibilityState === "visible") {
        refresh();
      }
    };

    window.addEventListener("royalStarPropertiesUpdated", refresh);
    window.addEventListener("royalStarDealsUpdated", refresh);
    window.addEventListener("royalStarDataSynchronized", refresh);
    window.addEventListener("storage", refresh);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refreshOnVisibility);

    return () => {
      window.removeEventListener("royalStarPropertiesUpdated", refresh);
      window.removeEventListener("royalStarDealsUpdated", refresh);
      window.removeEventListener("royalStarDataSynchronized", refresh);
      window.removeEventListener("storage", refresh);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refreshOnVisibility);
    };
  }, []);

  const intelligence = useMemo(() => commandCenterState || buildCommandCenterIntelligence({ deals: [], dealIntelligence: [], properties: [], portfolioData: [], rehabProjects: [], contractors: [], lenders: [], comps: [], neighborhoods: [], appraisalPackets: [], portfolioIntelligence: buildPortfolioIntelligence([], [], [], [], [], [], [], []) }), [commandCenterState]);
  const enterpriseViewModel = liveEnterpriseModel || buildLiveEnterpriseDashboardModel({ deals: [], properties: [], rehabProjects: [], contractors: [], lenders: [], portfolioEntries: [], dealIntelligence: [], backendHealth: {}, operationsPayload: {}, version: appVersion });
  const operationsHighlights = useMemo(() => ({
    actionCount: Array.isArray(enterpriseViewModel?.nextBestActions) ? enterpriseViewModel.nextBestActions.length : 0,
    alertCount: enterpriseViewModel?.summaryStats?.totalAlertCount ?? (Array.isArray(enterpriseViewModel?.operationsAlerts) ? enterpriseViewModel.operationsAlerts.length : 0),
    checkpointCount: Array.isArray(enterpriseViewModel?.projectCheckpoints) ? enterpriseViewModel.projectCheckpoints.length : 0,
    reunderwritingCount: Array.isArray(enterpriseViewModel?.reunderwritingTriggers) ? enterpriseViewModel.reunderwritingTriggers.length : 0,
  }), [enterpriseViewModel]);

  const automationStatusDetail = useMemo(() => {
    const trace = enterpriseViewModel?.traceability?.automationStatus;
    if (!trace) return null;
    const components = trace.components || {};
    return `${trace.score}/100 · W:${Math.round((components.workflowWeight || 0) * 100)}% T:${Math.round((components.telemetryWeight || 0) * 100)}% R:${Math.round((components.recoveryWeight || 0) * 100)}%`;
  }, [enterpriseViewModel]);

  const capitalAllocationEngine = useMemo(() => buildCapitalAllocationEngine({
    properties: intelligence.dataSources.properties,
    deals: intelligence.dataSources.deals,
    dealIntelligence: intelligence.dataSources.dealIntelligence,
    rehabProjects: intelligence.dataSources.rehabProjects,
    lenders: intelligence.dataSources.lenders,
    contractors: intelligence.dataSources.contractors,
    portfolioIntelligence: intelligence.dataSources.portfolioIntelligence,
  }), [intelligence]);

  const aiDecisionEngine = useMemo(() => {
    const leadDeal = intelligence.dataSources.deals?.[0];
    if (!leadDeal) return null;

    const normalizedLeadDeal = normalizeDealForIntelligence(leadDeal);
    const underwriting = buildUnifiedUnderwritingIntelligence(normalizedLeadDeal, [], []);

    return buildAiDecisionEngine({
      deal: normalizedLeadDeal,
      analysis: {
        dealScore: Math.max(0, Math.min(100, Math.round(underwriting.flipAnalysis.netProfit > 0 ? 76 : 44))),
        financingScore: 72,
        overallRisk: underwriting.recommendation.action === "PROCEED" ? 24 : 48,
        buyBoxResult: underwriting.buyBox.decision === "Strong Pass" || underwriting.buyBox.decision === "Pass" ? "PASS" : "CONDITIONAL PASS",
        arvConfidence: underwriting.arvAnalysis.confidenceLabel.toLowerCase(),
        supportedBaseArv: underwriting.arvAnalysis.supportedBaseArv,
        recommendedOffer: underwriting.mao.targetOffer,
        maximumAllowableOffer: underwriting.mao.maximumOffer,
        walkAwayPrice: underwriting.mao.walkAwayPrice,
        estimatedFlipProfit: underwriting.flipAnalysis.netProfit,
        roi: underwriting.flipAnalysis.returnOnCost,
        dscr: underwriting.brrrrAnalysis.debtServiceCoverageRatio,
        monthlyCashFlow: underwriting.brrrrAnalysis.monthlyCashFlow,
        cashRequired: underwriting.brrrrAnalysis.cashInvested,
        warnings: underwriting.recommendation.primaryRisks || [],
      },
      deals: intelligence.dataSources.deals,
      rehabProjects: intelligence.dataSources.rehabProjects,
      contractors: intelligence.dataSources.contractors,
      lenders: intelligence.dataSources.lenders,
      portfolioIntelligence: intelligence.dataSources.portfolioIntelligence,
    });
  }, [intelligence]);

  const executivePriorities = useMemo(() => {
    const executiveView = buildExecutiveViewModel({ deals: intelligence.dataSources.deals, portfolioIntelligence: intelligence.dataSources.portfolioIntelligence, backendHealth: systemHealth || { healthy: true } });
    const alerts = Array.isArray(intelligence.alerts) ? intelligence.alerts : [];
    const authoritativePriorities = Array.isArray(intelligence.priorities) ? intelligence.priorities : [];
    const criticalCapital = alerts
      .filter((alert) => String(alert.severity || '').toUpperCase() === 'CRITICAL')
      .map((alert) => ({
        priority: 'CRITICAL',
        action: alert.requiredAction || alert.alert || 'Resolve critical risk',
        relatedRecord: alert.relatedRecord || 'Portfolio',
        sourceMetric: alert.sourceMetric || alert.relatedModule || 'Risk',
        reason: alert.condition || alert.alert || 'Critical alert is unresolved.',
        completionCondition: 'Alert condition no longer meets critical threshold.',
      }));
    const missingDecisionData = alerts
      .filter((alert) => String(alert.alert || '').toLowerCase().includes('missing') || String(alert.requiredAction || '').toLowerCase().includes('complete'))
      .map((alert) => ({
        priority: 'DATA',
        action: alert.requiredAction || 'Complete decision-critical data',
        relatedRecord: alert.relatedRecord || 'Portfolio',
        sourceMetric: alert.sourceMetric || alert.relatedModule || 'Underwriting',
        reason: alert.condition || 'Decision-critical inputs are incomplete.',
        completionCondition: 'Required fields are entered and re-evaluated without missing-data alert.',
      }));
    const underwritingDecision = aiDecisionEngine?.dealDecision ? [{
      priority: 'UNDERWRITING',
      action: `${aiDecisionEngine.dealDecision.recommendedAction} · ${aiDecisionEngine.dealDecision.confidenceLabel}`,
      relatedRecord: intelligence.topOpportunity?.propertyName || 'Portfolio',
      sourceMetric: 'AI decision + recommendation reconciliation',
      reason: aiDecisionEngine.dealDecision.rationale || 'Derived from shared underwriting signals.',
      completionCondition: 'Decision accepted or recommendation changes after new underwriting inputs.',
    }] : [];
    const operationalActions = (enterpriseViewModel?.nextBestActions || []).slice(0, 2).map((entry) => ({
      priority: 'OPERATIONS',
      action: entry.action || 'Execute next best action',
      relatedRecord: entry.relatedRecord || 'Portfolio',
      sourceMetric: entry.sourceMetric || 'Operations engine',
      reason: entry.reason || 'Operational sequence requires action.',
      completionCondition: entry.completionCondition || 'Action marked complete in operations workflow.',
    }));
    const informational = [{
      priority: 'INFO',
      action: executiveView?.highestPriorityAction || enterpriseViewModel?.portfolioOverview?.executiveSummary?.headline || 'Monitor portfolio posture',
      relatedRecord: 'Portfolio',
      sourceMetric: 'Executive view model',
      reason: 'Advisory recommendation for current state.',
      completionCondition: 'Informational recommendation superseded by higher-priority blocker.',
    }];

    const ordered = authoritativePriorities.length
      ? authoritativePriorities
      : [
          ...criticalCapital,
          ...missingDecisionData,
          ...underwritingDecision,
          ...operationalActions,
          ...informational,
        ];

    const seen = new Set();
    const filtered = ordered.filter((item) => {
      const key = `${item.priority}|${item.action}|${item.relatedRecord}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    const rank = (priorityItem = {}) => {
      const value = String(priorityItem.priority || "").toLowerCase();
      if (value.includes("critical") || value.includes("capital")) return 1;
      if (value.includes("missing") || value.includes("data")) return 2;
      if (value.includes("decision") || value.includes("underwriting")) return 3;
      if (value.includes("operational") || value.includes("rehab") || value.includes("loan")) return 4;
      return 5;
    };

    return filtered
      .map((item) => ({
        ...item,
        sourceMetric: item.sourceMetric || item.relatedModule || "Executive",
        reason: item.reason || item.rationale || "Action required",
        completionCondition: item.completionCondition || "Condition resolved",
      }))
      .sort((left, right) => rank(left) - rank(right))
      .slice(0, 7);
  }, [aiDecisionEngine, enterpriseViewModel, intelligence.alerts, intelligence.dataSources.deals, intelligence.dataSources.portfolioIntelligence, intelligence.topOpportunity?.propertyName, systemHealth]);

  const getInteractiveCardProps = (id, label, onActivate) => ({
    role: "button",
    tabIndex: 0,
    "aria-label": label,
    onClick: onActivate,
    onFocus: () => setFocusedKpiId(id),
    onBlur: () => setFocusedKpiId((current) => (current === id ? "" : current)),
    onKeyDown: (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        onActivate();
      }
    },
  });

  const openKpiDrilldown = (tileLabel, tileValue, section = "kpi") => {
    const trace = enterpriseViewModel?.traceability || {};
    const metricTrace = trace.metricTraceability || {};
    const risk = enterpriseViewModel?.riskSummary || {};
    const portfolio = enterpriseViewModel?.portfolioOverview || {};
    const alerts = Array.isArray(intelligence?.alerts) ? intelligence.alerts : [];
    const workflow = enterpriseViewModel?.workflowSnapshot?.summary || {};

    const detailsByLabel = {
      "ACTIVE DEALS": {
        title: "Active Deals Breakdown",
        rows: [
          ["Displayed Value", tileValue || String(enterpriseViewModel?.summaryStats?.totalActiveDeals ?? 0)],
          ["Source", "summaryStats.totalActiveDeals"],
          ["Definition", "Deals with status Active or Ready to Offer from canonical backend records."],
          ["Related Records", String((intelligence?.dataSources?.deals || []).length)],
        ],
      },
      "TOTAL CASH DEPLOYED": {
        title: "Total Cash Deployed Breakdown",
        rows: [
          ["Displayed Value", tileValue || "Insufficient Data"],
          ["Definition", "Sum of purchase and deployed basis from canonical deals."],
          ["Source", "topMetrics[1] + deals purchase basis"],
          ["Related Records", String((intelligence?.dataSources?.deals || []).length)],
        ],
      },
      "PIPELINE VALUE": {
        title: "Pipeline Value Breakdown",
        rows: [
          ["Displayed Value", tileValue || "Insufficient Data"],
          ["Definition", "Aggregate opportunity value from active pipeline records."],
          ["Source", "topMetrics[2] + deal basis inputs"],
          ["Related Records", String((intelligence?.dataSources?.deals || []).length)],
        ],
      },
      "PROJECTS IN REHAB": {
        title: "Projects In Rehab Breakdown",
        rows: [
          ["Displayed Value", tileValue || String((intelligence?.dataSources?.rehabProjects || []).length)],
          ["Definition", "Rehab projects not marked Closed or Completed."],
          ["Source", "topMetrics[3] + rehab-project statuses"],
          ["Related Records", String((intelligence?.dataSources?.rehabProjects || []).length)],
        ],
      },
      "LENDERS & FUNDING": {
        title: "Lenders & Funding Breakdown",
        rows: [
          ["Displayed Value", tileValue || String((intelligence?.dataSources?.lenders || []).length)],
          ["Definition", "Count of active lender/funding partner records."],
          ["Source", "topMetrics[4] + lender records"],
          ["Related Records", String((intelligence?.dataSources?.lenders || []).length)],
        ],
      },
      "BUSINESS STATUS": {
        title: "Business Status Breakdown",
        rows: [
          ["Enterprise Score", `${enterpriseViewModel?.executiveIntelligence?.executiveCommandCenter?.enterpriseHealthScore ?? portfolio.healthScore ?? 0}/100`],
          ["Risk Score", `${risk.averageRiskScore ?? 0}/100`],
          ["Formula", "Business Status = Enterprise Health (strategy/operations/capital) + Portfolio Risk context"],
          ["Source Values", "enterpriseIntelligence.executiveCommandCenter + riskSummary.averageRiskScore"],
          ["Weights", "Enterprise score weighted heavier than risk context in label presentation"],
          ["Calculated At", new Date().toISOString()],
        ],
      },
      "SYSTEM PORTFOLIO HEALTH": {
        title: "System Portfolio Health Breakdown",
        rows: [
          ["Metric Type", "System-level health from executive scorecard"],
          ["Score", `${enterpriseViewModel?.executiveIntelligence?.executiveCommandCenter?.portfolioHealthScore ?? portfolio.healthScore ?? 0}/100`],
          ["Source", "executiveIntelligence.executiveCommandCenter.portfolioHealthScore"],
          ["Operational Inputs", "automation readiness, risk controls, portfolio summary status"],
        ],
      },
      "CAPITAL EFFICIENCY": {
        title: "Capital Efficiency Breakdown",
        rows: buildTraceabilityRows(metricTrace.capitalEfficiency, `${enterpriseViewModel?.executiveIntelligence?.executiveCommandCenter?.capitalEfficiencyScore ?? 0}/100`),
      },
      "RISK EXPOSURE": {
        title: "Risk Exposure Breakdown",
        rows: buildTraceabilityRows(metricTrace.riskExposure, `${enterpriseViewModel?.executiveIntelligence?.executiveCommandCenter?.riskExposureScore ?? portfolio.portfolioRiskScore ?? 0}/100`),
      },
      "OPS READINESS": {
        title: "Operations Readiness Breakdown",
        rows: [
          ["Score", `${enterpriseViewModel?.executiveIntelligence?.executiveCommandCenter?.operationsReadiness ?? 0}/100`],
          ["Completed Requirements", `${workflow.completedModuleCount || 0} active workflow capabilities`],
          ["Incomplete Requirements", `${Math.max(0, (workflow.totalModuleCount || 0) - (workflow.completedModuleCount || 0))}`],
          ["Blockers", alerts.filter((alert) => String(alert.severity || '').toUpperCase() === 'CRITICAL').map((alert) => alert.alert).join(" | ") || 'No critical blockers'],
        ],
      },
      "30D FORECAST": {
        title: "30-Day Forecast Composition",
        rows: [
          ["Displayed Value", trace?.forecast30Day?.value || tileValue || 'Insufficient Data'],
          ["Definition", "30-day projected portfolio value trend from canonical portfolio forecast."],
          ["No Double Count Proof", trace?.forecast30Day?.noDoubleCountProof || 'Linked records excluded from additive duplicate value.'],
          ["Composition", (trace?.forecast30Day?.composition || []).map((entry) => `${entry.recordName} [${entry.recordType}] ${entry.includedValue} (${entry.sourceModule})`).join(" | ") || 'Insufficient Data'],
          ["Composition Record Count", String((trace?.forecast30Day?.composition || []).length)],
          ["Unique Record Keys", String(new Set((trace?.forecast30Day?.composition || []).map((entry) => entry.recordKey)).size)],
        ],
      },
      "ARV CONFIDENCE": {
        title: "ARV Confidence Evidence",
        rows: [
          ["Projected ARV", intelligence?.topOpportunity?.profit || 'Insufficient Data'],
          ["Calculated ARV", enterpriseViewModel?.dealIntelligence?.[0]?.underwritingSummary || 'Insufficient Data'],
          ["Supported ARV", enterpriseViewModel?.dealIntelligence?.[0]?.offerGuidance || 'Insufficient Data'],
          ["Evidence Count", `${enterpriseViewModel?.dealIntelligence?.[0]?.majorRiskFlags?.length ? 0 : 1}`],
          ["Comp Count", `${enterpriseViewModel?.dealIntelligence?.[0]?.compCount ?? 'Insufficient Data'}`],
          ["Confidence Factors", `${enterpriseViewModel?.forecastingEngine?.arvConfidenceScore?.label || 'Insufficient Data'}`],
          ["Missing Evidence", enterpriseViewModel?.dealIntelligence?.[0]?.majorRiskFlags?.join(" | ") || 'None flagged'],
        ],
      },
      "LIVE RISK SCORE": {
        title: "Live Risk Score Formula",
        rows: buildTraceabilityRows(metricTrace.liveRiskScore, `${risk.averageRiskScore ?? 0}/100`),
      },
      "RISK LEVEL": {
        title: "Risk Level Thresholds",
        rows: buildTraceabilityRows(metricTrace.riskLevel, enterpriseViewModel?.riskSummary?.liveRiskLabel || tileValue || 'Insufficient Data'),
      },
      "INVESTMENT PORTFOLIO HEALTH": {
        title: "Investment Portfolio Health Breakdown",
        rows: buildTraceabilityRows(metricTrace.investmentPortfolioHealth, `${portfolio.healthScore ?? 0}/100`),
      },
      "PORTFOLIO RISK": {
        title: "Portfolio Risk Breakdown",
        rows: buildTraceabilityRows(metricTrace.portfolioRisk, `${portfolio.portfolioRiskScore ?? 0}/100`),
      },
      "WORKFLOW STATUS": {
        title: "Workflow Health Status",
        rows: [
          ["Current Status", operationsSummary?.workflowLabel || 'Insufficient Data'],
          ["Health Components", `Completed modules ${workflow.completedModuleCount || 0}`],
          ["Failed Workflows", `${operationsSummary?.failedWorkflowCount ?? 0}`],
          ["Warnings", alerts.filter((entry) => String(entry.severity || '').toUpperCase() === 'HIGH').map((entry) => entry.alert).join(" | ") || 'None'],
          ["Last Successful Activity", operationsSummary?.lastWorkflowExecution || 'Unknown'],
        ],
      },
      "RECOVERY EVENTS": {
        title: "Recovery Event History",
        rows: [
          ["Event Count", `${enterpriseViewModel?.summaryStats?.totalRecoveryCount ?? 0}`],
          ["Last Recovery Event", operationsSummary?.lastRecoveryEvent || 'Unknown'],
          ["Affected Module", 'Recovery engine / workflow engine'],
          ["Recovery Action", 'Automated recovery and replay pipeline'],
          ["Resolution Status", operationsSummary?.recoveryStatus || 'Unknown'],
        ],
      },
      "ACTIVE ALERTS": {
        title: "Unresolved Active Alerts",
        rows: alerts.map((alert, index) => [
          `${index + 1}. ${alert.severity}`,
          `${alert.alert} | record=${alert.relatedRecord} | metric=${alert.sourceMetric || 'N/A'} | threshold=${alert.threshold || 'N/A'} | current=${alert.currentValue || 'N/A'} | action=${alert.requiredAction || 'N/A'} | created=${alert.createdAt || 'Unknown'} | lastEval=${alert.lastEvaluatedAt || 'Unknown'}`,
        ]),
      },
      "MONITORING": {
        title: "Monitoring Status",
        rows: [
          ["Frontend", 'Running'],
          ["Backend", operationsSummary?.backendStatus || 'Unknown'],
          ["API", operationsSummary?.apiStatus || 'Unknown'],
          ["Persistence", operationsSummary?.fallbackActive ? 'Fallback active' : 'Healthy'],
          ["Health Checks", operationsSummary?.lastSuccessfulCheck || 'Unknown'],
        ],
      },
      "AUTOMATION STATUS": {
        title: "Automation Capability Breakdown",
        rows: buildTraceabilityRows(metricTrace.automationStatus, automationStatusDetail || 'Insufficient Data'),
      },
      "TELEMETRY HEALTH": {
        title: "Telemetry Health Sources",
        rows: [
          ["Score", `${automationSummary?.analyticsHealthScore ?? (enterpriseViewModel?.summaryStats?.analyticsReady ? 100 : 0)}`],
          ["Sources", 'automationSummary + enterprise analytics readiness'],
          ["Last Check", operationsSummary?.lastMonitoringUpdate || 'Unknown'],
          ["Error Count", `${alerts.filter((entry) => String(entry.severity || '').toUpperCase() === 'CRITICAL').length}`],
          ["Warning Count", `${alerts.filter((entry) => String(entry.severity || '').toUpperCase() === 'HIGH').length}`],
          ["Data Freshness", operationsSummary?.dataFreshness || 'Unknown'],
        ],
      },
      "RECOVERY STATUS": {
        title: "Recovery Readiness",
        rows: [
          ["Status", automationSummary?.recoveryStatus || 'Pending'],
          ["Last Checkpoint", operationsSummary?.lastRecoveryEvent || 'Unknown'],
          ["Readiness State", operationsSummary?.recoveryStatus || 'Unknown'],
          ["Rollback Options", 'Use backup checkpoints under backups/ and automated recovery workflow.'],
        ],
      },
      "ANALYTICS READY": {
        title: "Analytics Readiness",
        rows: [
          ["State", enterpriseViewModel?.summaryStats?.analyticsReady || automationSummary?.telemetryReady ? 'Ready' : 'Pending'],
          ["Reason", enterpriseViewModel?.summaryStats?.analyticsReady ? 'Required analytics feeds are active.' : 'One or more analytics feeds are incomplete.'],
          ["Incomplete Sources", enterpriseViewModel?.summaryStats?.analyticsReady ? 'None flagged' : 'Telemetry or workflow analytics feed pending.'],
        ],
      },
    };

    const key = String(tileLabel || '').toUpperCase();
    const selected = detailsByLabel[key] || {
      title: `${tileLabel} Details`,
      rows: [
        ['Value', tileValue == null || tileValue === '' ? 'Insufficient Data' : String(tileValue)],
        ['Source', section],
      ],
    };
    setKpiDrilldown(selected);
  };

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const results = buildCommandCenterIntelligence({
        deals: intelligence.dataSources.deals,
        dealIntelligence: intelligence.dataSources.dealIntelligence,
        properties: intelligence.dataSources.properties,
        portfolioData: intelligence.dataSources.portfolioData,
        rehabProjects: intelligence.dataSources.rehabProjects,
        contractors: intelligence.dataSources.contractors,
        lenders: intelligence.dataSources.lenders,
        comps: intelligence.dataSources.comps,
        neighborhoods: intelligence.dataSources.neighborhoods,
        appraisalPackets: intelligence.dataSources.appraisalPackets,
        portfolioIntelligence: intelligence.dataSources.portfolioIntelligence,
      }).searchResults;
      setSearchResults(results);
    }, 0);

    return () => window.clearTimeout(timer);
  }, [intelligence]);

  const handleSearch = (event) => {
    const term = event.target.value || '';
    setSearchText(term);
    const results = buildCommandCenterIntelligence({
      deals: intelligence.dataSources.deals,
      dealIntelligence: intelligence.dataSources.dealIntelligence,
      properties: intelligence.dataSources.properties,
      portfolioData: intelligence.dataSources.portfolioData,
      rehabProjects: intelligence.dataSources.rehabProjects,
      contractors: intelligence.dataSources.contractors,
      lenders: intelligence.dataSources.lenders,
      comps: intelligence.dataSources.comps,
      neighborhoods: intelligence.dataSources.neighborhoods,
      appraisalPackets: intelligence.dataSources.appraisalPackets,
      portfolioIntelligence: intelligence.dataSources.portfolioIntelligence,
    }).searchResults;
    setSearchResults(results);
  };

  return (
    <div style={styles.page}>
      <aside style={styles.sidebar}>
        <div style={styles.logoArea}>
          <img src={logo} alt="Royal Star Properties" style={styles.logo} />
        </div>

        <nav style={styles.nav}>
          {navigation.map((item) => {
            return (
              <button
                key={item.id}
                type="button"
                style={styles.navButton}
                aria-current={item.viewKey === currentView ? "page" : undefined}
                onClick={() => handleSidebarNavigate(item.viewKey)}
              >
                <span style={styles.navIcon}>{item.icon}</span>
                <span>{item.label}</span>
                <span style={styles.navTab} />
              </button>
            );
          })}

          <button
            type="button"
            style={{ ...styles.logout, ...(logoutEnabled ? {} : styles.logoutDisabled) }}
            onClick={handleLogout}
            disabled={!logoutEnabled || loggingOut}
            aria-disabled={!logoutEnabled || loggingOut}
            title={logoutTitle}
            aria-label={logoutEnabled ? "Log out" : "Log out unavailable while authentication is inactive"}
          >
            <span style={styles.navIcon}>↪</span>
            <span>LOG OUT</span>
          </button>
        </nav>

        <div style={styles.smallMark}>RS★</div>
      </aside>

      <main style={styles.main}>
        <section style={styles.topArea}>
          <div />

          <div style={styles.heading}>
            <h1 style={styles.company}>ROYAL STAR PROPERTIES, LLC</h1>
            <p style={styles.subtitle}>
              ROYAL STAR OPERATING SYSTEM (RSOS) ENTERPRISE
            </p>
          </div>

          <div style={styles.admin}>
            <div>👤 BRANDON STERLING</div>
            <span>System Administrator</span>
          </div>
        </section>

        <section style={styles.metrics}>
          {(enterpriseViewModel?.topMetrics || topMetrics).map((metric) => (
            <div
              key={metric.title}
              style={{ ...styles.metric, ...(focusedKpiId === `metric-${metric.title}` ? styles.kpiFocus : null) }}
              {...getInteractiveCardProps(`metric-${metric.title}`, `${metric.title} KPI`, () => openKpiDrilldown(metric.title, metric.value, 'topMetrics'))}
            >
              <div style={styles.metricTitle}>
                <span>{metric.icon || '●'}</span>
                <strong>{metric.title}</strong>
              </div>
              <div style={styles.metricSubtitle}>{metric.value}</div>
              <div style={styles.metricSubtitle}>{metric.subtitle}</div>
            </div>
          ))}
        </section>

        <section style={styles.intelligenceStrip}>
          {(enterpriseViewModel?.intelligenceCards || []).map((card) => (
            <div
              key={card.label}
              style={{ ...styles.intelligenceCard, ...(focusedKpiId === `strip-${card.label}` ? styles.kpiFocus : null) }}
              {...getInteractiveCardProps(`strip-${card.label}`, `${card.label} KPI`, () => openKpiDrilldown(card.label, card.value, 'intelligenceStrip'))}
            >
              <div style={styles.intelligenceLabel}>{card.label}</div>
              <div style={styles.intelligenceValue}>{card.value}</div>
            </div>
          ))}
        </section>

        <section style={styles.operationsRow}>
          <div style={{ ...styles.operationsCard, ...(focusedKpiId === 'ops-live-risk' ? styles.kpiFocus : null) }} {...getInteractiveCardProps('ops-live-risk', 'Live Risk Score KPI', () => openKpiDrilldown('LIVE RISK SCORE', enterpriseViewModel?.riskSummary?.summaryLabel || '0/100 average risk', 'operations'))}>
            <div style={styles.intelligenceLabel}>LIVE RISK SCORE</div>
            <div style={styles.intelligenceValue}>{enterpriseViewModel?.riskSummary?.summaryLabel || '0/100 average risk'}</div>
          </div>
          <div style={{ ...styles.operationsCard, ...(focusedKpiId === 'ops-risk-level' ? styles.kpiFocus : null) }} {...getInteractiveCardProps('ops-risk-level', 'Risk Level KPI', () => openKpiDrilldown('RISK LEVEL', enterpriseViewModel?.riskSummary?.liveRiskLabel || 'Low', 'operations'))}>
            <div style={styles.intelligenceLabel}>RISK LEVEL</div>
            <div style={styles.intelligenceValue}>{enterpriseViewModel?.riskSummary?.liveRiskLabel || 'Low'}</div>
          </div>
          <div style={{ ...styles.operationsCard, ...(focusedKpiId === 'ops-investment-health' ? styles.kpiFocus : null) }} {...getInteractiveCardProps('ops-investment-health', 'Investment Portfolio Health KPI', () => openKpiDrilldown('INVESTMENT PORTFOLIO HEALTH', `${enterpriseViewModel?.portfolioOverview?.healthScore ?? 0}/100`, 'operations'))}>
            <div style={styles.intelligenceLabel}>INVESTMENT PORTFOLIO HEALTH</div>
            <div style={styles.intelligenceValue}>{enterpriseViewModel?.portfolioOverview?.healthScore ?? 0}/100</div>
          </div>
          <div style={{ ...styles.operationsCard, ...(focusedKpiId === 'ops-portfolio-risk' ? styles.kpiFocus : null) }} {...getInteractiveCardProps('ops-portfolio-risk', 'Portfolio Risk KPI', () => openKpiDrilldown('PORTFOLIO RISK', `${enterpriseViewModel?.portfolioOverview?.portfolioRiskScore ?? enterpriseViewModel?.riskSummary?.portfolioRiskScore ?? 0}/100`, 'operations'))}>
            <div style={styles.intelligenceLabel}>PORTFOLIO RISK</div>
            <div style={styles.intelligenceValue}>{enterpriseViewModel?.portfolioOverview?.portfolioRiskScore ?? enterpriseViewModel?.riskSummary?.portfolioRiskScore ?? 0}/100</div>
          </div>
        </section>

        <section style={styles.operationsRow}>
          <div style={{ ...styles.operationsCard, ...(focusedKpiId === 'ops-workflow-status' ? styles.kpiFocus : null) }} {...getInteractiveCardProps('ops-workflow-status', 'Workflow Status KPI', () => openKpiDrilldown('WORKFLOW STATUS', operationsSummary?.workflowLabel || 'Pending · Pending', 'operations'))}>
            <div style={styles.intelligenceLabel}>WORKFLOW STATUS</div>
            <div style={styles.intelligenceValue}>{operationsSummary?.workflowLabel || automationSummary?.workflowStatus || 'Pending · Pending'}</div>
          </div>
          <div style={{ ...styles.operationsCard, ...(focusedKpiId === 'ops-recovery-events' ? styles.kpiFocus : null) }} {...getInteractiveCardProps('ops-recovery-events', 'Recovery Events KPI', () => openKpiDrilldown('RECOVERY EVENTS', `${enterpriseViewModel?.summaryStats?.totalRecoveryCount ?? operationsSummary?.recoveryCount ?? 0}`, 'operations'))}>
            <div style={styles.intelligenceLabel}>RECOVERY EVENTS</div>
            <div style={styles.intelligenceValue}>{enterpriseViewModel?.summaryStats?.totalRecoveryCount ?? operationsSummary?.recoveryCount ?? automationSummary?.recoveryLabel ?? 0}</div>
          </div>
          <div style={{ ...styles.operationsCard, ...(focusedKpiId === 'ops-active-alerts' ? styles.kpiFocus : null) }} {...getInteractiveCardProps('ops-active-alerts', 'Active Alerts KPI', () => openKpiDrilldown('ACTIVE ALERTS', `${enterpriseViewModel?.summaryStats?.totalAlertCount ?? 0}`, 'operations'))}>
            <div style={styles.intelligenceLabel}>ACTIVE ALERTS</div>
            <div style={styles.intelligenceValue}>{enterpriseViewModel?.summaryStats?.totalAlertCount ?? operationsHighlights.alertCount ?? operationsSummary?.alertCount ?? 0}</div>
          </div>
          <div style={{ ...styles.operationsCard, ...(focusedKpiId === 'ops-monitoring' ? styles.kpiFocus : null) }} {...getInteractiveCardProps('ops-monitoring', 'Monitoring KPI', () => openKpiDrilldown('MONITORING', enterpriseViewModel?.summaryStats?.monitoringStatus || 'Unknown', 'operations'))}>
            <div style={styles.intelligenceLabel}>MONITORING</div>
            <div style={styles.intelligenceValue}>{enterpriseViewModel?.summaryStats?.monitoringStatus || operationsSummary?.monitoringStatus || automationSummary?.monitoringStatus || 'Unknown'}</div>
          </div>
        </section>

        <section style={styles.operationsRow}>
          <div style={{ ...styles.operationsCard, ...(focusedKpiId === 'ops-automation-status' ? styles.kpiFocus : null) }} {...getInteractiveCardProps('ops-automation-status', 'Automation Status KPI', () => openKpiDrilldown('AUTOMATION STATUS', automationStatusDetail || 'Insufficient Data', 'operations'))}>
            <div style={styles.intelligenceLabel}>AUTOMATION STATUS</div>
            <div style={styles.intelligenceValue}>{automationStatusDetail || (enterpriseViewModel?.workflowSnapshot?.summary?.overallHealthScore ? `${enterpriseViewModel.workflowSnapshot.summary.overallHealthScore}/100` : automationSummary?.summaryLabel || 'Pending · Pending')}</div>
          </div>
          <div style={{ ...styles.operationsCard, ...(focusedKpiId === 'ops-telemetry-health' ? styles.kpiFocus : null) }} {...getInteractiveCardProps('ops-telemetry-health', 'Telemetry Health KPI', () => openKpiDrilldown('TELEMETRY HEALTH', `${automationSummary?.analyticsHealthScore ?? (enterpriseViewModel?.summaryStats?.analyticsReady ? 100 : 0)}`, 'operations'))}>
            <div style={styles.intelligenceLabel}>TELEMETRY HEALTH</div>
            <div style={styles.intelligenceValue}>{automationSummary?.analyticsHealthScore ?? (enterpriseViewModel?.summaryStats?.analyticsReady ? 100 : 0)}</div>
          </div>
          <div style={{ ...styles.operationsCard, ...(focusedKpiId === 'ops-recovery-status' ? styles.kpiFocus : null) }} {...getInteractiveCardProps('ops-recovery-status', 'Recovery Status KPI', () => openKpiDrilldown('RECOVERY STATUS', automationSummary?.recoveryStatus || 'Pending', 'operations'))}>
            <div style={styles.intelligenceLabel}>RECOVERY STATUS</div>
            <div style={styles.intelligenceValue}>{automationSummary?.recoveryStatus || 'Pending'}</div>
          </div>
          <div style={{ ...styles.operationsCard, ...(focusedKpiId === 'ops-analytics-ready' ? styles.kpiFocus : null) }} {...getInteractiveCardProps('ops-analytics-ready', 'Analytics Ready KPI', () => openKpiDrilldown('ANALYTICS READY', enterpriseViewModel?.summaryStats?.analyticsReady || automationSummary?.telemetryReady ? 'Ready' : 'Pending', 'operations'))}>
            <div style={styles.intelligenceLabel}>ANALYTICS READY</div>
            <div style={styles.intelligenceValue}>{enterpriseViewModel?.summaryStats?.analyticsReady || automationSummary?.telemetryReady ? 'Ready' : 'Pending'}</div>
          </div>
        </section>

        <section style={styles.intelligenceGrid}>
          <div style={styles.intelligencePanel}>
            <h3 style={styles.lowerTitle}>EXECUTIVE ALERTS</h3>
            {intelligence.alerts.length ? intelligence.alerts.map((alert, index) => (
              <div key={`${alert.alert}-${index}`} style={styles.alertRow}>
                <span style={styles.alertBadge}>{alert.severity}</span>
                <span style={styles.alertText}>{alert.alert} · {alert.relatedRecord}</span>
              </div>
            )) : <div style={styles.emptyAlert}>Executive intelligence unavailable.</div>}
          </div>
          <div style={styles.intelligencePanel}>
            <h3 style={styles.lowerTitle}>TODAY'S PRIORITIES</h3>
            {executivePriorities.length ? executivePriorities.map((priority, index) => (
              <div key={`${priority.priority}-${index}`} style={styles.alertRow}>
                <span style={styles.priorityBadge}>{priority.priority}</span>
                <span style={styles.alertText}>{priority.action} · {priority.relatedRecord || 'Portfolio'} · {priority.sourceMetric || 'Executive'} · {priority.reason || 'Action required'} · Done when: {priority.completionCondition || 'Condition resolved'}</span>
              </div>
            )) : <div style={styles.emptyAlert}>No priorities at this time.</div>}
            {operationsHighlights.actionCount > 0 ? (
              <div style={styles.alertRow}>
                <span style={styles.priorityBadge}>OPS</span>
                <span style={styles.alertText}>{operationsHighlights.actionCount} next-best action{operationsHighlights.actionCount === 1 ? '' : 's'} derived from saved project data.</span>
              </div>
            ) : null}
          </div>
        </section>

        <section style={styles.moduleRow}>
          {firstRow.map((item) => (
            <ModuleCard
              key={item.title}
              item={item}
              onClick={
                item.title === "DEAL ANALYZER"
                  ? onOpenDealAnalyzer
                  : item.title === "PRODUCT VAULT"
                    ? onOpenProductVault
                    : item.title === "CONTRACTOR HUB"
                      ? onOpenContractorHub
                      : item.title === "COMP DATABASE"
                        ? onOpenCompDatabase
                        : item.title === "PORTFOLIO DASHBOARD"
                          ? onOpenPortfolioDashboard
                          : item.title === "NEIGHBORHOOD DATABASE"
                            ? onOpenNeighborhoodDatabase
                            : item.title === "LENDER DASHBOARD"
                              ? onOpenLenderDashboard
                              : undefined
              }
            />
          ))}
        </section>

        <section style={styles.moduleRow}>
          {secondRow.map((item) => (
            <ModuleCard key={item.title} item={item} onClick={item.title === "NEIGHBORHOOD DATABASE" ? onOpenNeighborhoodDatabase : item.title === "PORTFOLIO DASHBOARD" ? onOpenPortfolioDashboard : item.title === "LENDER DASHBOARD" ? onOpenLenderDashboard : item.title === "APPRAISER PACKET BUILDER" ? onOpenAppraiserPacketBuilder : item.title === "REHAB PROJECT TRACKER" ? onOpenRehabProjectTracker : item.title === "KNOWLEDGE BASE" ? onOpenKnowledgeBase : undefined} />
          ))}
        </section>

        <section style={styles.lowerGrid}>
          <div style={styles.lowerPanel}>
            <h2 style={styles.lowerTitle}>RECENT ACTIVITY</h2>

            <div style={styles.activityList}>
              {intelligence.recentActivity.length ? intelligence.recentActivity.map((item, index) => (
                <div key={`${item.event}-${index}`} style={styles.activityRow}>
                  <span style={styles.activityIcon}>●</span>
                  <span style={styles.activityDescription}>{item.event} · {item.relatedRecord}</span>
                  <span style={styles.activityDate}>{item.status}</span>
                </div>
              )) : activity.map(([icon, description, date]) => (
                <div key={description} style={styles.activityRow}>
                  <span style={styles.activityIcon}>{icon}</span>
                  <span style={styles.activityDescription}>{description}</span>
                  <span style={styles.activityDate}>{date}</span>
                </div>
              ))}
            </div>

            <div style={styles.totalActivity}>18 TOTAL</div>
            <button type="button" style={styles.lowerAction}>
              VIEW ALL ACTIVITY&nbsp;&nbsp;➜
            </button>
          </div>

          <div style={styles.lowerPanel}>
            <h2 style={styles.lowerTitle}>PIPELINE OVERVIEW</h2>

            <div style={styles.pipeline}>
              <PipelineRow label="Active Deals" value={String(enterpriseViewModel?.summaryStats?.totalActiveDeals ?? intelligence.dealDecisionSummary?.counts?.buy ?? 0)} />
              <PipelineRow label="Capital Status" value={capitalAllocationEngine?.capitalPosition?.capitalStatus || intelligence.capitalPosition.status} />
              <PipelineRow label="Portfolio Health" value={`${enterpriseViewModel?.portfolioOverview?.healthScore ?? 0}/100`} />
              <PipelineRow label="Portfolio Risk" value={`${enterpriseViewModel?.portfolioOverview?.portfolioRiskScore ?? 0}/100`} />
              <PipelineRow label="Cash Reserve" value={enterpriseViewModel?.portfolioOverview?.cashReserve?.currentReserveDisplay || 'Insufficient Data'} />
              <PipelineRow label="Liquidity Forecast" value={enterpriseViewModel?.portfolioOverview?.liquidityForecast?.[0]?.liquidityPositionDisplay || 'Insufficient Data'} />
              <PipelineRow label="Exposure" value={enterpriseViewModel?.portfolioOverview?.exposureAnalysis?.highestExposure?.propertyName || 'Insufficient Data'} />
              <PipelineRow label="Refi / Allocation" value={`${enterpriseViewModel?.portfolioOverview?.refinanceOpportunities?.length || 0} refi · ${Math.round(enterpriseViewModel?.portfolioOverview?.strategyAllocation?.flipShare || 0)}% flip`} />
              <PipelineRow label="Top Opportunity" value={capitalAllocationEngine?.highestPriorityUse?.option || intelligence.topOpportunity.recommendation} />
              <PipelineRow label="Automation" value={`${enterpriseViewModel?.workflowSnapshot?.summary?.completedModuleCount || 0} modules`} />
            </div>

            <button type="button" style={styles.lowerAction}>
              VIEW FULL PIPELINE&nbsp;&nbsp;➜
            </button>
          </div>

          <div style={styles.lowerPanel}>
            <h2 style={styles.lowerTitle}>QUICK LINKS</h2>

            <div style={styles.quickColumns}>
              <div>
                <QuickLink text="Add New Deal" onClick={onOpenDealIntake} />
                <QuickLink text="Run New Analysis" onClick={onOpenDealIntelligence} />
                <QuickLink text="Open Property Database" onClick={onOpenPropertyDatabase} />
                <QuickLink text="Open Contractor Hub" onClick={onOpenContractorHub} />
                <QuickLink text="Open Lender Dashboard" onClick={onOpenLenderDashboard} />
              </div>

              <div>
                <QuickLink text="Open Rehab Tracker" onClick={onOpenRehabProjectTracker} />
                <QuickLink text="Open Portfolio Dashboard" onClick={onOpenPortfolioDashboard} />
                <QuickLink text="Open Deal Intelligence" onClick={onOpenDealIntelligence} />
                <QuickLink text="Open Comp Database" onClick={onOpenCompDatabase} />
                <QuickLink text="Open Appraiser Packet Builder" onClick={onOpenAppraiserPacketBuilder} />
              </div>
            </div>

            <button type="button" style={styles.lowerAction}>
              VIEW ALL LINKS&nbsp;&nbsp;➜
            </button>
          </div>
        </section>

        <section style={styles.searchSection}>
          <input style={styles.searchInput} value={searchText} onChange={handleSearch} placeholder="Search executive records" />
          {searchResults.length ? <div style={styles.searchResults}>{searchResults.map((result, index) => <button key={`${result.label}-${index}`} type="button" style={styles.searchResult} onClick={() => {
            if (result.module === 'Deal Analyzer') onOpenDealAnalyzer();
            else if (result.module === 'Property Database') onOpenPropertyDatabase();
            else if (result.module === 'Contractor Hub') onOpenContractorHub();
            else if (result.module === 'Lender Dashboard') onOpenLenderDashboard();
            else if (result.module === 'Portfolio Dashboard') onOpenPortfolioDashboard();
            else if (result.module === 'Deal Intelligence') onOpenDealIntelligence();
            else if (result.module === 'Rehab Project Tracker') onOpenRehabProjectTracker();
            else if (result.module === 'Comp Database') onOpenCompDatabase();
            else if (result.module === 'Appraiser Packet Builder') onOpenAppraiserPacketBuilder();
            else if (result.module === 'Knowledge Base') onOpenKnowledgeBase();
          }}>{result.label} · {result.module}</button>)}</div> : null}
        </section>

        <footer style={styles.footer}>
          <div style={styles.footerText}>
            <div>BUILT ON SYSTEMS. DRIVEN BY DATA. DESIGNED FOR WEALTH.</div>
            <div>
              ROYAL STAR PROPERTIES, LLC&nbsp;&nbsp;★&nbsp;&nbsp;BUILDING LEGACY.
              CREATING FREEDOM.
            </div>
          </div>

          <div style={styles.footerMark}>RS★</div>
        </footer>

        {kpiDrilldown ? (
          <div style={styles.kpiModalOverlay} onClick={() => setKpiDrilldown(null)}>
            <div style={styles.kpiModalCard} onClick={(event) => event.stopPropagation()}>
              <div style={styles.kpiModalHeader}>
                <strong>{kpiDrilldown.title}</strong>
                <button type="button" style={styles.kpiModalClose} onClick={() => setKpiDrilldown(null)} aria-label="Close KPI details">Close</button>
              </div>
              <div style={styles.kpiModalBody}>
                {(kpiDrilldown.rows || []).map((row, index) => (
                  <div key={`${row[0]}-${index}`} style={styles.kpiDetailRow}>
                    <span style={styles.kpiDetailLabel}>{row[0]}</span>
                    <span style={styles.kpiDetailValue}>{row[1]}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : null}
      </main>
    </div>
  );
}

function ModuleCard({ item, onClick }) {
  return (
    <article style={styles.module}>
      <div style={styles.moduleContent}>
        <h2 style={styles.moduleTitle}>
          <span style={styles.moduleIcon}>{item.icon}</span>
          {item.title}
        </h2>

        <p style={styles.moduleBody}>{item.body}</p>
      </div>

      <button type="button" style={styles.moduleAction} onClick={onClick}>
        {item.action}
      </button>
    </article>
  );
}

function PipelineRow({ label, value }) {
  return (
    <div style={styles.pipelineRow}>
      <span>
        <span style={styles.pipelineDot}>●</span>
        {label}
      </span>
      <strong>{value}</strong>
    </div>
  );
}

function QuickLink({ text, onClick }) {
  return (
    <button type="button" style={styles.quickLink} onClick={onClick}>
      🔗 {text}
    </button>
  );
}

const GOLD = "#f2c500";
const BLACK = "#050505";
const BORDER = "#c89f00";

const styles = {
  page: {
    minHeight: "100vh",
    width: "100%",
    display: "flex",
    overflow: "hidden",
    backgroundColor: BLACK,
    color: GOLD,
    fontFamily: "Arial, Helvetica, sans-serif",
    fontWeight: 700,
  },

  sidebar: {
    flex: "0 0 178px",
    minHeight: "100vh",
    padding: "18px 0 10px",
    boxSizing: "border-box",
    backgroundColor: BLACK,
    display: "flex",
    flexDirection: "column",
    position: "relative",
  },

  logoArea: {
    height: "114px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "0 15px 10px",
    boxSizing: "border-box",
  },

  logo: {
    display: "block",
    width: "135px",
    height: "104px",
    objectFit: "contain",
    backgroundColor: "#ffffff",
  },

  nav: {
    display: "flex",
    flexDirection: "column",
    gap: "1px",
    paddingRight: "14px",
  },

  navButton: {
    position: "relative",
    width: "100%",
    minHeight: "36px",
    padding: "7px 10px",
    border: "1px solid #846c00",
    background: "linear-gradient(90deg, #f7d339 0%, #eab90c 100%)",
    color: "#17120a",
    textAlign: "left",
    fontSize: "10px",
    fontWeight: 500,
    display: "flex",
    alignItems: "center",
    gap: "8px",
    cursor: "pointer",
  },

  navIcon: {
    width: "18px",
    textAlign: "center",
    fontSize: "12px",
  },

  navTab: {
    position: "absolute",
    right: "-13px",
    top: "8px",
    width: "13px",
    height: "20px",
    backgroundColor: GOLD,
    border: "1px solid #8d7100",
    boxSizing: "border-box",
  },

  logout: {
    width: "100%",
    minHeight: "34px",
    padding: "7px 10px",
    border: "1px solid #846c00",
    background: "linear-gradient(90deg, #f7d339 0%, #eab90c 100%)",
    color: "#17120a",
    textAlign: "left",
    fontSize: "10px",
    display: "flex",
    alignItems: "center",
    gap: "8px",
    cursor: "pointer",
  },
  logoutDisabled: {
    opacity: 0.65,
    cursor: "not-allowed",
  },

  smallMark: {
    marginTop: "8px",
    paddingLeft: "12px",
    fontFamily: "Georgia, serif",
    fontSize: "25px",
    color: GOLD,
  },

  main: {
    flex: 1,
    minWidth: 0,
    padding: "20px 17px 10px 8px",
    boxSizing: "border-box",
    backgroundColor: BLACK,
  },

  topArea: {
    minHeight: "120px",
    display: "grid",
    gridTemplateColumns: "1fr 2fr 1fr",
    alignItems: "start",
  },

  heading: {
    textAlign: "center",
    paddingTop: "13px",
  },

  company: {
    margin: 0,
    color: GOLD,
    fontSize: "15px",
    fontWeight: 800,
  },

  subtitle: {
    margin: "10px 0 0",
    fontSize: "9px",
    color: GOLD,
  },

  admin: {
    paddingTop: "8px",
    textAlign: "right",
    color: "#ffffff",
    fontSize: "8px",
    lineHeight: 1.4,
  },

  metrics: {
    minHeight: "75px",
    display: "grid",
    gridTemplateColumns: "repeat(5, 1fr)",
    alignItems: "center",
    columnGap: "6px",
  },

  metric: {
    textAlign: "center",
    padding: "5px",
  },

  metricTitle: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    gap: "6px",
    fontSize: "10px",
    color: GOLD,
  },

  metricSubtitle: {
    marginTop: "3px",
    color: "#ffffff",
    fontSize: "9px",
  },

  intelligenceStrip: {
    display: "grid",
    gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
    gap: "6px",
    margin: "8px 0 10px",
  },

  operationsRow: {
    display: "grid",
    gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
    gap: "6px",
    margin: "0 0 10px",
  },

  operationsCard: {
    padding: "8px 10px",
    border: `1px solid ${BORDER}`,
    background: "linear-gradient(135deg, #161616 0%, #0e0e0e 100%)",
    minHeight: "58px",
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    gap: "4px",
  },

  intelligenceCard: {
    border: `1px solid ${BORDER}`,
    backgroundColor: "#111",
    padding: "8px 10px",
    minHeight: "52px",
  },

  kpiFocus: {
    boxShadow: "0 0 0 2px rgba(242,197,0,0.58)",
  },

  intelligenceLabel: {
    color: GOLD,
    fontSize: "8px",
    textTransform: "uppercase",
    marginBottom: "4px",
  },

  intelligenceValue: {
    color: "#ffffff",
    fontSize: "9px",
    lineHeight: 1.35,
  },

  intelligenceGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "8px",
    marginBottom: "10px",
  },

  intelligencePanel: {
    border: `1px solid ${BORDER}`,
    backgroundColor: "#111",
    padding: "8px 10px",
    minHeight: "90px",
  },

  alertRow: {
    display: "flex",
    gap: "6px",
    alignItems: "center",
    marginBottom: "4px",
    color: GOLD,
    fontSize: "8px",
  },

  alertBadge: {
    border: `1px solid ${BORDER}`,
    padding: "2px 5px",
    color: "#fff",
    backgroundColor: "#2a1d00",
    whiteSpace: "nowrap",
  },

  priorityBadge: {
    border: `1px solid ${BORDER}`,
    padding: "2px 5px",
    color: "#fff",
    backgroundColor: "#2f2b00",
    whiteSpace: "nowrap",
  },

  alertText: {
    color: "#ffffff",
    fontSize: "8px",
  },

  emptyAlert: {
    color: "#ffffff",
    fontSize: "8px",
  },

  searchSection: {
    margin: "10px 0 0",
    display: "flex",
    flexDirection: "column",
    gap: "6px",
  },

  searchInput: {
    backgroundColor: "#111",
    border: `1px solid ${BORDER}`,
    color: GOLD,
    padding: "7px 8px",
    fontSize: "9px",
  },

  searchResults: {
    display: "flex",
    flexDirection: "column",
    gap: "4px",
  },

  searchResult: {
    backgroundColor: "transparent",
    border: `1px solid ${BORDER}`,
    color: GOLD,
    textAlign: "left",
    padding: "6px 8px",
    cursor: "pointer",
    fontSize: "8px",
  },

  moduleRow: {
    display: "grid",
    gridTemplateColumns: "repeat(5, 1fr)",
  },

  module: {
    minWidth: 0,
    minHeight: "150px",
    borderLeft: `1px solid ${BORDER}`,
    borderRight: `1px solid ${BORDER}`,
    display: "flex",
    flexDirection: "column",
    backgroundColor: BLACK,
  },

  moduleContent: {
    flex: 1,
    padding: "12px 10px 8px",
    textAlign: "center",
  },

  moduleTitle: {
    minHeight: "30px",
    margin: "0 0 10px",
    color: GOLD,
    fontSize: "10px",
    fontWeight: 800,
    lineHeight: 1.18,
  },

  moduleIcon: {
    marginRight: "5px",
  },

  moduleBody: {
    maxWidth: "165px",
    margin: "0 auto",
    color: GOLD,
    fontSize: "9px",
    fontWeight: 700,
    lineHeight: 1.35,
  },

  moduleAction: {
    height: "25px",
    width: "100%",
    padding: 0,
    border: `1px solid ${BORDER}`,
    background: "linear-gradient(#f9d62d, #e4ae00)",
    color: "#322600",
    fontSize: "8px",
    fontWeight: 700,
    cursor: "pointer",
  },

  lowerGrid: {
    display: "grid",
    gridTemplateColumns: "1.18fr 1fr 1.3fr",
  },

  lowerPanel: {
    minHeight: "164px",
    position: "relative",
    padding: "8px 12px 31px",
    borderLeft: `1px solid ${BORDER}`,
    borderRight: `1px solid ${BORDER}`,
    boxSizing: "border-box",
    backgroundColor: BLACK,
  },

  lowerTitle: {
    margin: "0 0 8px",
    textAlign: "center",
    color: GOLD,
    fontSize: "10px",
  },

  activityList: {
    paddingRight: "4px",
  },

  activityRow: {
    display: "grid",
    gridTemplateColumns: "20px 1fr 70px",
    alignItems: "center",
    minHeight: "18px",
    color: GOLD,
    fontSize: "8px",
  },

  activityIcon: {
    fontSize: "11px",
  },

  activityDescription: {
    paddingRight: "8px",
  },

  activityDate: {
    textAlign: "right",
  },

  totalActivity: {
    position: "absolute",
    right: "18px",
    bottom: "40px",
    color: GOLD,
    fontSize: "9px",
    textAlign: "center",
  },

  pipeline: {
    width: "75%",
    margin: "12px auto 0",
  },

  pipelineRow: {
    display: "flex",
    justifyContent: "space-between",
    padding: "3px 0",
    color: GOLD,
    fontSize: "9px",
  },

  pipelineDot: {
    marginRight: "5px",
    fontSize: "8px",
  },

  quickColumns: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    columnGap: "17px",
    padding: "5px 8px 0",
  },

  quickLink: {
    width: "100%",
    padding: "7px 0",
    border: 0,
    backgroundColor: "transparent",
    color: GOLD,
    textAlign: "left",
    fontSize: "8px",
    fontWeight: 700,
    cursor: "pointer",
  },

  lowerAction: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: "26px",
    border: `1px solid ${BORDER}`,
    background: "linear-gradient(#f9d62d, #e4ae00)",
    color: "#6c5300",
    fontSize: "8px",
    fontWeight: 800,
    cursor: "pointer",
  },

  footer: {
    minHeight: "82px",
    position: "relative",
    display: "flex",
    justifyContent: "center",
    alignItems: "flex-end",
    padding: "14px 15px 8px",
    boxSizing: "border-box",
  },

  footerText: {
    textAlign: "center",
    color: GOLD,
    fontSize: "8px",
    lineHeight: 1.45,
  },

  footerMark: {
    position: "absolute",
    right: "43%",
    bottom: "8px",
    transform: "translateX(50%)",
    fontFamily: "Georgia, serif",
    color: GOLD,
    fontSize: "25px",
  },

  kpiModalOverlay: {
    position: "fixed",
    inset: 0,
    backgroundColor: "rgba(0,0,0,0.64)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "24px",
    zIndex: 1200,
  },

  kpiModalCard: {
    width: "min(920px, 95vw)",
    maxHeight: "85vh",
    overflowY: "auto",
    borderRadius: "14px",
    border: `1px solid ${BORDER}`,
    backgroundColor: "#111",
    boxShadow: "0 24px 70px rgba(0,0,0,0.45)",
    padding: "16px",
    display: "flex",
    flexDirection: "column",
    gap: "12px",
  },

  kpiModalHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    color: GOLD,
    fontSize: "10px",
    letterSpacing: "0.05em",
    textTransform: "uppercase",
  },

  kpiModalClose: {
    border: `1px solid ${BORDER}`,
    borderRadius: "999px",
    background: "rgba(242,197,0,0.08)",
    color: GOLD,
    padding: "6px 12px",
    cursor: "pointer",
    fontWeight: 700,
    fontSize: "8px",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
  },

  kpiModalBody: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },

  kpiDetailRow: {
    display: "grid",
    gridTemplateColumns: "190px 1fr",
    gap: "12px",
    padding: "8px 10px",
    borderRadius: "10px",
    border: "1px solid rgba(255,255,255,0.08)",
    backgroundColor: "rgba(255,255,255,0.02)",
  },

  kpiDetailLabel: {
    color: GOLD,
    fontSize: "8px",
    letterSpacing: "0.04em",
    textTransform: "uppercase",
    fontWeight: 700,
  },

  kpiDetailValue: {
    color: "#f2f2f2",
    fontSize: "8px",
    lineHeight: 1.45,
  },
};