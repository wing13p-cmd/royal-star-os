import { useEffect, useMemo, useState } from "react";
import { buildApiUrl } from "../utils/apiClient.js";
import logo from "../assets/royal-star-logo.png";
import { buildCapitalAllocationEngine } from "./capitalAllocationEngine.js";
import { buildRefinanceExitOptimizer } from "./refinanceExitOptimizer.js";
import { buildPortfolioViewModel } from "../utils/enterpriseUiIntegration.js";
import { buildCrossModulePortfolioContext, formatUnavailableCurrency, formatUnavailablePercent } from "../utils/crossModulePortfolioContext.js";


const initialValues = {
  propertyName: "",
  propertyAddress: "",
  city: "",
  state: "",
  zipCode: "",
  propertyType: "Single Family",
  acquisitionDate: "",
  purchasePrice: "",
  rehabBudget: "",
  currentValue: "",
  monthlyRent: "",
  occupancyRate: "",
  operatingExpenses: "",
  annualTaxes: "",
  annualInsurance: "",
  loanBalance: "",
  interestRate: "",
  monthlyDebtService: "",
  status: "Active",
  strategy: "Hold",
  favorite: false,
  notes: "",
};

function createId(prefix = "portfolio") {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

function getStringValue(source, fallback = "") {
  const value = source ?? fallback;
  return typeof value === "string" ? value : "";
}

function getNumberValue(source) {
  if (source === "" || source === null || source === undefined) return "";
  const parsed = Number(source);
  return Number.isFinite(parsed) ? parsed : "";
}

function normalizePortfolioPayload(payload = {}) {
  return {
    id: getStringValue(payload.id),
    propertyName: getStringValue(payload.propertyName),
    propertyAddress: getStringValue(payload.propertyAddress),
    city: getStringValue(payload.city),
    state: getStringValue(payload.state),
    zipCode: getStringValue(payload.zipCode),
    propertyType: getStringValue(payload.propertyType, "Single Family"),
    acquisitionDate: getStringValue(payload.acquisitionDate),
    purchasePrice: getNumberValue(payload.purchasePrice),
    rehabBudget: getNumberValue(payload.rehabBudget),
    currentValue: getNumberValue(payload.currentValue),
    monthlyRent: getNumberValue(payload.monthlyRent),
    occupancyRate: getNumberValue(payload.occupancyRate),
    operatingExpenses: getNumberValue(payload.operatingExpenses),
    annualTaxes: getNumberValue(payload.annualTaxes),
    annualInsurance: getNumberValue(payload.annualInsurance),
    loanBalance: getNumberValue(payload.loanBalance),
    interestRate: getNumberValue(payload.interestRate),
    monthlyDebtService: getNumberValue(payload.monthlyDebtService),
    status: getStringValue(payload.status, "Active"),
    strategy: getStringValue(payload.strategy, "Hold"),
    favorite: Boolean(payload.favorite),
    notes: getStringValue(payload.notes),
    createdAt: getStringValue(payload.createdAt),
    updatedAt: getStringValue(payload.updatedAt),
  };
}

function validatePortfolio(property) {
  const errors = [];
  if (!property.propertyName) errors.push("Property name is required");
  if (!property.propertyAddress) errors.push("Property address is required");
  if (!property.city) errors.push("City is required");
  if (!property.state) errors.push("State is required");
  if (!property.zipCode) errors.push("ZIP code is required");
  if (property.purchasePrice !== "" && property.purchasePrice < 0) errors.push("Purchase price cannot be negative");
  if (property.currentValue !== "" && property.currentValue < 0) errors.push("Current value cannot be negative");
  if (property.monthlyRent !== "" && property.monthlyRent < 0) errors.push("Monthly rent cannot be negative");
  if (property.occupancyRate !== "" && (property.occupancyRate < 0 || property.occupancyRate > 100)) errors.push("Occupancy rate must be between 0 and 100");
  return errors;
}

function formatCurrency(value) {
  return formatUnavailableCurrency(value);
}

function formatPercent(value) {
  return formatUnavailablePercent(value);
}

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function getPortfolioMetrics(item) {
  const purchasePrice = item.purchasePrice === "" || item.purchasePrice === null || item.purchasePrice === undefined ? null : Number(item.purchasePrice);
  const currentValue = item.currentValue === "" || item.currentValue === null || item.currentValue === undefined ? null : Number(item.currentValue);
  const monthlyRent = item.monthlyRent === "" || item.monthlyRent === null || item.monthlyRent === undefined ? null : Number(item.monthlyRent);
  const operatingExpenses = item.operatingExpenses === "" || item.operatingExpenses === null || item.operatingExpenses === undefined ? null : Number(item.operatingExpenses);
  const annualTaxes = item.annualTaxes === "" || item.annualTaxes === null || item.annualTaxes === undefined ? null : Number(item.annualTaxes);
  const annualInsurance = item.annualInsurance === "" || item.annualInsurance === null || item.annualInsurance === undefined ? null : Number(item.annualInsurance);
  const loanBalance = item.loanBalance === "" || item.loanBalance === null || item.loanBalance === undefined ? null : Number(item.loanBalance);
  const monthlyDebtService = item.monthlyDebtService === "" || item.monthlyDebtService === null || item.monthlyDebtService === undefined ? null : Number(item.monthlyDebtService);
  const occupancyRate = item.occupancyRate === "" || item.occupancyRate === null || item.occupancyRate === undefined ? null : Number(item.occupancyRate);
  const annualGrossRent = monthlyRent === null ? null : monthlyRent * 12;
  const annualNetOperatingIncome = annualGrossRent === null || occupancyRate === null || operatingExpenses === null || annualTaxes === null || annualInsurance === null
    ? null
    : annualGrossRent * (occupancyRate / 100) - operatingExpenses - annualTaxes - annualInsurance;
  const cashFlow = annualNetOperatingIncome === null || monthlyDebtService === null ? null : annualNetOperatingIncome - (monthlyDebtService * 12);
  const equity = currentValue === null || loanBalance === null ? null : currentValue - loanBalance;
  const capRate = annualGrossRent === null || annualNetOperatingIncome === null || currentValue === null || currentValue <= 0 ? null : (annualNetOperatingIncome / currentValue) * 100;
  const roi = currentValue === null || purchasePrice === null || purchasePrice <= 0 ? null : ((currentValue - purchasePrice) / purchasePrice) * 100;
  const risk = equity === null || capRate === null ? "Insufficient Data" : equity < 0 ? "High" : capRate < 4 ? "Watch" : "Healthy";

  return {
    annualGrossRent,
    annualNetOperatingIncome,
    cashFlow,
    equity,
    capRate,
    roi,
    risk,
  };
}

export default function PortfolioDashboard({
  onBack,
  onOpenDealAnalyzer,
  onOpenFlipAnalyzer,
  onOpenBrrrrAnalyzer,
  onOpenProductVault,
  onOpenContractorHub,
  onOpenCompDatabase,
  onOpenDealIntelligence,
  onOpenNeighborhoodDatabase,
}) {
  const [portfolio, setPortfolio] = useState([]);
  const [formValues, setFormValues] = useState(initialValues);
  const [selectedPropertyId, setSelectedPropertyId] = useState("");
  const [message, setMessage] = useState({ type: "", text: "" });
  const [searchText, setSearchText] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [strategyFilter, setStrategyFilter] = useState("All");
  const [favoriteFilter, setFavoriteFilter] = useState("All");
  const [sortBy, setSortBy] = useState("recent");
  const [comparisonIds, setComparisonIds] = useState([]);
  const [connectionState, setConnectionState] = useState("Online");
  const [canonicalProperties, setCanonicalProperties] = useState([]);
  const [importDeals, setImportDeals] = useState([]);
  const [importDealId, setImportDealId] = useState("");
  const [importPreview, setImportPreview] = useState(null);
  const [importBusy, setImportBusy] = useState(false);

  const loadPortfolio = async () => {
    try {
      const response = await fetch(buildApiUrl("/api/portfolio"));
      if (!response.ok) throw new Error("Unable to load portfolio");
      const data = await response.json();
      if (Array.isArray(data)) {
        setPortfolio(data);
        setConnectionState("Online");
        if (typeof window !== "undefined") {
          window.localStorage.setItem("royalStarPortfolio", JSON.stringify(data));
        }
      }
    } catch (error) {
      console.error("Unable to load portfolio via API, using local fallback", error);
      if (typeof window !== "undefined") {
        const saved = window.localStorage.getItem("royalStarPortfolio");
        if (saved) {
          try {
            setPortfolio(JSON.parse(saved));
            setConnectionState("Offline");
            return;
          } catch (parseError) {
            console.error("Unable to parse saved portfolio", parseError);
          }
        }
      }
      setPortfolio([]);
      setConnectionState("Offline");
    }
  };

  const loadCrossModuleState = async () => {
    try {
      const response = await fetch(buildApiUrl("/api/cross-module-sync"));
      if (!response.ok) throw new Error("Unable to load synchronized state");
      const payload = await response.json();
      setCanonicalProperties(Array.isArray(payload?.properties) ? payload.properties : []);
    } catch (error) {
      console.error("Unable to load synchronized state", error);
      setCanonicalProperties([]);
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadPortfolio();
      void loadCrossModuleState();
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const normalizedPortfolio = useMemo(() => portfolio.map((item) => ({ ...item, metrics: getPortfolioMetrics(item) })), [portfolio]);
  const crossModuleContext = useMemo(() => buildCrossModulePortfolioContext({
    deals: [],
    properties: canonicalProperties,
    portfolioEntries: normalizedPortfolio,
    rehabProjects: [],
    lenders: [],
    contractors: [],
  }), [canonicalProperties, normalizedPortfolio]);
  const portfolioIntelligence = crossModuleContext.portfolioIntelligence;
  const portfolioViewModel = useMemo(() => buildPortfolioViewModel({ portfolioEntries: normalizedPortfolio, portfolioIntelligence }), [normalizedPortfolio, portfolioIntelligence]);

  const filteredPortfolio = useMemo(() => {
    const search = searchText.trim().toLowerCase();
    const filtered = normalizedPortfolio.filter((item) => {
      const matchesText = !search || [item.propertyName, item.propertyAddress, item.city, item.state, item.zipCode, item.status, item.strategy].some((value) => String(value ?? "").toLowerCase().includes(search));
      const matchesStatus = statusFilter === "All" || item.status === statusFilter;
      const matchesStrategy = strategyFilter === "All" || item.strategy === strategyFilter;
      const matchesFavorite = favoriteFilter === "All" || (favoriteFilter === "Favorites" ? Boolean(item.favorite) : !item.favorite);
      return matchesText && matchesStatus && matchesStrategy && matchesFavorite;
    });

    const sorted = [...filtered];
    sorted.sort((left, right) => {
      switch (sortBy) {
        case "value":
          return Number(right.metrics.equity || 0) - Number(left.metrics.equity || 0);
        case "yield":
          return Number(right.metrics.capRate || 0) - Number(left.metrics.capRate || 0);
        case "name":
          return (left.propertyName || "").localeCompare(right.propertyName || "");
        default:
          return (right.updatedAt || right.createdAt || "").localeCompare(left.updatedAt || left.createdAt || "");
      }
    });

    return sorted;
  }, [favoriteFilter, normalizedPortfolio, searchText, sortBy, statusFilter, strategyFilter]);

  const selectedProperty = useMemo(() => normalizedPortfolio.find((item) => item.id === selectedPropertyId) || null, [normalizedPortfolio, selectedPropertyId]);

  const comparisonItems = useMemo(() => normalizedPortfolio.filter((item) => comparisonIds.includes(item.id)), [comparisonIds, normalizedPortfolio]);

  const summaryStats = useMemo(() => {
    const total = normalizedPortfolio.length;
    const totalValue = normalizedPortfolio.reduce((sum, item) => sum + Number(item.currentValue || 0), 0);
    const totalEquity = normalizedPortfolio.reduce((sum, item) => sum + Number(item.metrics.equity || 0), 0);
    return { total, totalValue, totalEquity };
  }, [normalizedPortfolio]);

  const canonicalRiskById = useMemo(() => {
    const index = new Map();
    const records = Array.isArray(portfolioIntelligence?.properties) ? portfolioIntelligence.properties : [];
    records.forEach((record) => {
      if (!record?.id) return;
      index.set(String(record.id), String(record.riskLevel || record.cashFlowRisk || "Insufficient Data"));
    });
    return index;
  }, [portfolioIntelligence]);

  const capitalAllocationEngine = useMemo(() => buildCapitalAllocationEngine({
    properties: normalizedPortfolio,
    deals: [],
    dealIntelligence: [],
    rehabProjects: [],
    lenders: [],
    contractors: [],
    portfolioIntelligence,
  }), [normalizedPortfolio, portfolioIntelligence]);

  const refinanceExitOptimizer = useMemo(() => buildRefinanceExitOptimizer({
    properties: normalizedPortfolio,
    deals: [],
    portfolioIntelligence,
    capitalAllocationEngine,
  }), [capitalAllocationEngine, normalizedPortfolio, portfolioIntelligence]);

  const statusOptions = useMemo(() => ["All", ...Array.from(new Set(normalizedPortfolio.map((item) => item.status).filter(Boolean))).sort()], [normalizedPortfolio]);
  const strategyOptions = useMemo(() => ["All", ...Array.from(new Set(normalizedPortfolio.map((item) => item.strategy).filter(Boolean))).sort()], [normalizedPortfolio]);
  const favoriteOptions = ["All", "Favorites", "Non-Favorites"];
  const sortOptions = [
    ["recent", "Most Recent"],
    ["value", "Highest Equity"],
    ["yield", "Highest Cap Rate"],
    ["name", "Alphabetical"],
  ];

  const handleFieldChange = (event) => {
    const { name, value, type, checked } = event.target;
    setFormValues((prev) => ({ ...prev, [name]: type === "checkbox" ? checked : value }));
  };

  const handleSelectProperty = (property) => {
    setSelectedPropertyId(property.id);
    setFormValues({ ...initialValues, ...property });
    setMessage({ type: "", text: "" });
  };

  const handleClearForm = () => {
    setSelectedPropertyId("");
    setFormValues(initialValues);
    setMessage({ type: "", text: "" });
  };

  const persistPortfolio = async (payload, existingProperty = null) => {
    if (existingProperty) {
      try {
        const response = await fetch(buildApiUrl(`/api/portfolio/${existingProperty.id}`), {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!response.ok) throw new Error("Unable to update portfolio record");
        return response.json();
      } catch (error) {
        console.error("Unable to update portfolio via API, using local fallback", error);
        return { ...payload, id: existingProperty.id, createdAt: existingProperty.createdAt, updatedAt: new Date().toISOString() };
      }
    }

    try {
      const response = await fetch(buildApiUrl("/api/portfolio"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error("Unable to create portfolio record");
      return response.json();
    } catch (error) {
      console.error("Unable to create portfolio via API, using local fallback", error);
      return { ...payload, id: createId(), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const errors = validatePortfolio(formValues);
    if (errors.length > 0) {
      setMessage({ type: "error", text: errors[0] });
      return;
    }

    const existingProperty = portfolio.find((item) => item.id === selectedPropertyId);
    const normalizedPayload = normalizePortfolioPayload({ ...formValues, id: existingProperty?.id || "" });
    const savedProperty = await persistPortfolio(normalizedPayload, existingProperty);
    const nextPortfolio = existingProperty ? portfolio.map((item) => (item.id === existingProperty.id ? { ...item, ...savedProperty, id: existingProperty.id } : item)) : [...portfolio, savedProperty];

    setPortfolio(nextPortfolio);
    if (typeof window !== "undefined") {
      window.localStorage.setItem("royalStarPortfolio", JSON.stringify(nextPortfolio));
    }
    setSelectedPropertyId(savedProperty.id);
    setFormValues({ ...initialValues, ...savedProperty, favorite: Boolean(savedProperty.favorite) });
    setMessage({ type: "success", text: existingProperty ? "Portfolio record updated successfully." : "Portfolio record added successfully." });
  };

  const handleDelete = async (propertyId) => {
    const target = portfolio.find((item) => item.id === propertyId);
    if (!target) return;

    try {
      const response = await fetch(buildApiUrl(`/api/portfolio/${propertyId}`), { method: "DELETE" });
      if (!response.ok) throw new Error("Unable to delete portfolio record");
      const nextPortfolio = portfolio.filter((item) => item.id !== propertyId);
      setPortfolio(nextPortfolio);
      if (typeof window !== "undefined") {
        window.localStorage.setItem("royalStarPortfolio", JSON.stringify(nextPortfolio));
      }
      setSelectedPropertyId("");
      setFormValues(initialValues);
      setMessage({ type: "success", text: "Portfolio record deleted successfully." });
    } catch (error) {
      console.error("Unable to delete portfolio via API, using local fallback", error);
      const nextPortfolio = portfolio.filter((item) => item.id !== propertyId);
      setPortfolio(nextPortfolio);
      if (typeof window !== "undefined") {
        window.localStorage.setItem("royalStarPortfolio", JSON.stringify(nextPortfolio));
      }
      setSelectedPropertyId("");
      setFormValues(initialValues);
      setMessage({ type: "success", text: "Portfolio record deleted successfully." });
    }
  };

  const handleFavoriteToggle = async (propertyId) => {
    const target = portfolio.find((item) => item.id === propertyId);
    if (!target) return;

    const nextPortfolio = portfolio.map((item) => (item.id === propertyId ? { ...item, favorite: !item.favorite } : item));
    setPortfolio(nextPortfolio);
    if (typeof window !== "undefined") {
      window.localStorage.setItem("royalStarPortfolio", JSON.stringify(nextPortfolio));
    }

    try {
      await fetch(buildApiUrl(`/api/portfolio/${propertyId}`), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...target, favorite: !target.favorite }),
      });
    } catch (error) {
      console.error("Unable to persist favorite toggle", error);
    }
  };

  const toggleComparison = (propertyId) => {
    setComparisonIds((prev) => {
      if (prev.includes(propertyId)) return prev.filter((id) => id !== propertyId);
      if (prev.length >= 4) return prev.slice(1).concat(propertyId);
      return [...prev, propertyId];
    });
  };

  const handleImportFromDeal = async () => {
    setImportBusy(true);
    try {
      const response = await fetch(buildApiUrl("/api/portfolio/deal-sync/eligible"));
      if (!response.ok) throw new Error("Unable to load eligible deals");
      const payload = await response.json();
      const deals = Array.isArray(payload.eligibleDeals) ? payload.eligibleDeals : [];
      setImportDeals(deals);
      setImportPreview(null);

      if (!deals.length) {
        setMessage({ type: "error", text: "No eligible deals are ready for portfolio synchronization yet." });
        return;
      }

      if (!importDealId) {
        setImportDealId(deals[0].id);
      }
      setMessage({ type: "success", text: "Select a deal, review preview details, and explicitly approve the sync." });
    } catch (error) {
      console.error("Unable to import from deals", error);
      setMessage({ type: "error", text: "Unable to import from deals right now." });
    } finally {
      setImportBusy(false);
    }
  };

  const handleImportPreview = async () => {
    if (!importDealId) {
      setMessage({ type: "error", text: "Select a deal before generating preview." });
      return;
    }

    setImportBusy(true);
    try {
      const response = await fetch(buildApiUrl("/api/portfolio/deal-sync/preview"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dealId: importDealId, actor: "Brandon Sterling" }),
      });

      if (!response.ok) throw new Error("Unable to generate sync preview");
      const preview = await response.json();
      setImportPreview(preview);
      if (preview.ok) {
        setMessage({ type: "success", text: "Review sync preview and approve to continue." });
      } else {
        setMessage({ type: "error", text: "Sync preview requires review before approval." });
      }
    } catch (error) {
      console.error("Unable to preview deal import", error);
      setMessage({ type: "error", text: "Unable to generate import preview right now." });
    } finally {
      setImportBusy(false);
    }
  };

  const handleImportApprove = async () => {
    if (!importDealId) {
      setMessage({ type: "error", text: "Select a deal before approving sync." });
      return;
    }

    setImportBusy(true);
    try {
      const response = await fetch(buildApiUrl("/api/portfolio/deal-sync/execute"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dealId: importDealId,
          userApproval: true,
          actor: "Brandon Sterling",
        }),
      });
      if (!response.ok) throw new Error("Unable to execute sync");
      const result = await response.json();

      if (!result.ok) {
        setMessage({ type: "error", text: `Sync blocked: ${result.status || "REVIEW REQUIRED"}` });
        return;
      }

      await loadPortfolio();
      await loadCrossModuleState();
      setImportPreview(null);
      setMessage({ type: "success", text: result.status === "ALREADY_SYNCED" ? "Deal already synchronized with portfolio." : "Deal synchronized to portfolio successfully." });
    } catch (error) {
      console.error("Unable to execute deal import sync", error);
      setMessage({ type: "error", text: "Unable to complete approved sync right now." });
    } finally {
      setImportBusy(false);
    }
  };

  const handleExportSummary = () => {
    const rows = filteredPortfolio.map((item) => {
      const metrics = getPortfolioMetrics(item);
      return [
        item.propertyName,
        item.propertyAddress,
        item.city,
        item.state,
        item.status,
        formatCurrency(item.currentValue),
        formatCurrency(metrics.equity),
        `${metrics.capRate.toFixed(1)}%`,
        `${metrics.roi.toFixed(1)}%`,
      ].join(",");
    });
    const csv = ["Property Name,Address,City,State,Status,Current Value,Equity,Cap Rate,ROI", ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "royal-star-portfolio-summary.csv";
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div style={styles.page}>
      <aside style={styles.sidebar}>
        <div style={styles.logoArea}>
          <img src={logo} alt="Royal Star Properties" style={styles.logo} />
        </div>
        <nav style={styles.nav}>
          {[
            ["🏠", "COMMAND CENTER"],
            ["🔎", "DEAL ANALYZER"],
            ["📈", "FLIP ANALYZER"],
            ["💳", "BRRRR ANALYZER"],
            ["▣", "PRODUCT VAULT"],
            ["👥", "CONTRACTOR HUB"],
            ["🏘️", "COMP DATABASE"],
            ["📍", "NEIGHBORHOOD DB"],
            ["📦", "PORTFOLIO DASHBOARD"],
          ].map(([icon, label]) => {
            const isDealAnalyzer = label === "DEAL ANALYZER";
            const isFlipAnalyzer = label === "FLIP ANALYZER";
            const isBrrrrAnalyzer = label === "BRRRR ANALYZER";
            const isProductVault = label === "PRODUCT VAULT";
            const isContractorHub = label === "CONTRACTOR HUB";
            const isCompDatabase = label === "COMP DATABASE";
            const isNeighborhoodDatabase = label === "NEIGHBORHOOD DB";
            const isPortfolioDashboard = label === "PORTFOLIO DASHBOARD";
            return (
              <button
                key={label}
                type="button"
                style={styles.navButton}
                onClick={
                  isDealAnalyzer
                    ? onOpenDealAnalyzer
                    : isFlipAnalyzer
                      ? onOpenFlipAnalyzer
                      : isBrrrrAnalyzer
                        ? onOpenBrrrrAnalyzer
                        : isProductVault
                          ? onOpenProductVault
                          : isContractorHub
                            ? onOpenContractorHub
                            : isCompDatabase
                              ? onOpenCompDatabase
                              : isNeighborhoodDatabase
                                ? onOpenNeighborhoodDatabase
                                : isPortfolioDashboard
                                  ? undefined
                                  : undefined
                }
              >
                <span style={styles.navIcon}>{icon}</span>
                <span>{label}</span>
                <span style={styles.navTab} />
              </button>
            );
          })}
          <button type="button" style={styles.logout} onClick={onBack}>
            <span style={styles.navIcon}>↪</span>
            <span>COMMAND CENTER</span>
          </button>
        </nav>
        <div style={styles.smallMark}>RS★</div>
      </aside>

      <main style={styles.main}>
        <section style={styles.topBar}>
          <button type="button" style={styles.backButton} onClick={onBack}>◀ COMMAND CENTER</button>
          <div style={styles.headingBlock}>
            <h1 style={styles.company}>ROYAL STAR PROPERTIES, LLC</h1>
            <p style={styles.subtitle}>PORTFOLIO DASHBOARD / ASSET PERFORMANCE</p>
          </div>
          <div style={styles.headerActions}>
            <button type="button" style={styles.secondaryButton} onClick={onOpenDealAnalyzer}>DEAL ANALYZER</button>
            <button type="button" style={styles.primaryButton} onClick={onOpenFlipAnalyzer}>FLIP ANALYZER</button>
            <button type="button" style={styles.primaryButton} onClick={onOpenBrrrrAnalyzer}>BRRRR ANALYZER</button>
            <button type="button" style={styles.secondaryButton} onClick={onOpenCompDatabase}>COMP DATABASE</button>
            <button type="button" style={styles.secondaryButton} onClick={onOpenDealIntelligence}>DEAL INTELLIGENCE</button>
          </div>
        </section>

        <section style={styles.summaryPanel}>
          <div style={styles.summaryHeader}>
            <div>
              <h2 style={styles.panelTitle}>PORTFOLIO DASHBOARD</h2>
              <p style={styles.panelCopy}>Track equity, cash flow, cap rate, and portfolio performance from one executive view.</p>
            </div>
            <div style={styles.connectionBadge}>{connectionState}</div>
          </div>
          <div style={styles.summaryCards}>
            <SummaryCard label="Properties" value={portfolioIntelligence?.summary?.totalProperties ?? summaryStats.total} />
            <SummaryCard label="Current Value" value={formatCurrency(portfolioIntelligence?.summary?.totalCurrentValue ?? summaryStats.totalValue)} />
            <SummaryCard label="Total Equity" value={formatCurrency(portfolioIntelligence?.summary?.totalEquity ?? summaryStats.totalEquity)} />
            <SummaryCard label="Portfolio LTV" value={portfolioIntelligence?.summary?.portfolioLtv || "Insufficient Data"} />
            <SummaryCard label="Portfolio DSCR" value={portfolioIntelligence?.summary?.portfolioDscr || "Insufficient Data"} />
            <SummaryCard label="Health Score" value={portfolioIntelligence?.summary?.healthScore !== null && portfolioIntelligence?.summary?.healthScore !== undefined ? `${portfolioIntelligence.summary.healthScore} / 100` : "Insufficient Data"} />
            <SummaryCard label="Health Summary" value={portfolioViewModel?.portfolioHealthSummary || "Insufficient Data"} />
            <SummaryCard label="Portfolio Focus" value={portfolioViewModel?.portfolioFocus || "Review portfolio allocation"} />
            <SummaryCard label="Top Opportunity" value={portfolioViewModel?.portfolioOpportunity || "No active opportunity"} />
            <SummaryCard label="Monthly Cash Flow" value={formatCurrency(portfolioIntelligence?.summary?.totalMonthlyCashFlow)} />
            <SummaryCard label="Active Rehabs" value={portfolioIntelligence?.summary?.activeRehabs ?? 0} />
            <SummaryCard label="Reserve Shortfall" value={portfolioIntelligence?.summary?.reserveShortfallValue !== null && portfolioIntelligence?.summary?.reserveShortfallValue !== undefined ? formatCurrency(portfolioIntelligence.summary.reserveShortfallValue) : "—"} />
            <SummaryCard label="Critical Alerts" value={portfolioIntelligence?.summary?.criticalAlertCount ?? 0} />
          </div>
        </section>

        <section style={styles.filtersSection}>
          <input style={styles.input} value={searchText} onChange={(event) => setSearchText(event.target.value)} placeholder="Search property, address, city, or status" />
          <select style={styles.select} value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
            {statusOptions.map((option) => (
              <option key={option} value={option}>{option === "All" ? "All Statuses" : option}</option>
            ))}
          </select>
          <select style={styles.select} value={strategyFilter} onChange={(event) => setStrategyFilter(event.target.value)}>
            {strategyOptions.map((option) => (
              <option key={option} value={option}>{option === "All" ? "All Strategies" : option}</option>
            ))}
          </select>
          <select style={styles.select} value={favoriteFilter} onChange={(event) => setFavoriteFilter(event.target.value)}>
            {favoriteOptions.map((option) => (
              <option key={option} value={option}>{option === "All" ? "All Properties" : option}</option>
            ))}
          </select>
          <select style={styles.select} value={sortBy} onChange={(event) => setSortBy(event.target.value)}>
            {sortOptions.map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
          <button type="button" style={styles.secondaryButton} onClick={handleExportSummary}>EXPORT SUMMARY</button>
          <button type="button" style={styles.secondaryButton} onClick={handleImportFromDeal}>IMPORT FROM DEAL</button>
        </section>

        {importDeals.length ? (
          <section style={styles.summaryPanel}>
            <div style={styles.summaryHeader}>
              <div>
                <h3 style={styles.cardTitle}>DEAL-TO-PORTFOLIO REVIEW PREVIEW</h3>
                <p style={styles.panelCopy}>Review-first synchronization requires explicit approval before any portfolio changes.</p>
              </div>
            </div>
            <div style={{ display: "grid", gap: "0.75rem", gridTemplateColumns: "2fr 1fr 1fr" }}>
              <select style={styles.select} value={importDealId} onChange={(event) => setImportDealId(event.target.value)}>
                <option value="">Select Eligible Deal</option>
                {importDeals.map((deal) => (
                  <option key={deal.id} value={deal.id}>{deal.propertyAddress || deal.id} - {deal.city}, {deal.state} {deal.zipCode}</option>
                ))}
              </select>
              <button type="button" style={styles.secondaryButton} onClick={handleImportPreview} disabled={importBusy}>PREVIEW SYNC</button>
              <button type="button" style={styles.primaryButton} onClick={handleImportApprove} disabled={importBusy || !importPreview?.ok}>APPROVE IMPORT</button>
            </div>
            {importPreview ? (
              <div style={{ marginTop: "1rem", display: "grid", gap: "0.5rem" }}>
                <div style={styles.listMeta}>Status: {importPreview.status || "UNKNOWN"}</div>
                <div style={styles.listMeta}>Approval Required: {importPreview.approvalRequired ? "Yes" : "No"}</div>
                <div style={styles.listMeta}>Fields to Create: {(importPreview.fieldsToCreate || []).length}</div>
                <div style={styles.listMeta}>Fields to Update: {(importPreview.fieldsToUpdate || []).length}</div>
                <div style={styles.listMeta}>Fields Unchanged: {(importPreview.fieldsUnchanged || []).length}</div>
                {(importPreview.conflicts || []).length ? <div style={styles.error}>Conflicts: {(importPreview.conflicts || []).length} (review required)</div> : null}
                {(importPreview.duplicateWarnings || []).length ? <div style={styles.error}>Duplicate warnings detected. Automatic merge is blocked pending review.</div> : null}
                {(importPreview.missingRequiredInformation || []).length ? <div style={styles.error}>Missing required information: {(importPreview.missingRequiredInformation || []).join(", ")}</div> : null}
              </div>
            ) : null}
          </section>
        ) : null}

        {portfolioIntelligence ? (
          <>
            <section style={styles.summaryPanel}>
              <div style={styles.summaryHeader}>
                <div>
                  <h3 style={styles.cardTitle}>PORTFOLIO INTELLIGENCE</h3>
                  <p style={styles.panelCopy}>Executive health, risk posture, and priority actions.</p>
                </div>
              </div>
              <div style={styles.summaryCards}>
                <SummaryCard label="Health Grade" value={portfolioIntelligence.health?.grade || "Insufficient Data"} />
                <SummaryCard label="Health Status" value={portfolioIntelligence.health?.status || "Insufficient Data"} />
                <SummaryCard label="Known" value={portfolioIntelligence.known?.length ? portfolioIntelligence.known[0] : "Insufficient Data"} />
                <SummaryCard label="Uncertain" value={portfolioIntelligence.uncertain?.length ? portfolioIntelligence.uncertain[0] : "Insufficient Data"} />
                <SummaryCard label="Needed" value={portfolioIntelligence.neededToImproveDecision?.length ? portfolioIntelligence.neededToImproveDecision[0] : "Insufficient Data"} />
              </div>
            </section>

            <section style={styles.summaryPanel}>
              <div style={styles.summaryHeader}>
                <div>
                  <h3 style={styles.cardTitle}>ENTERPRISE PORTFOLIO INTELLIGENCE UPGRADE</h3>
                  <p style={styles.panelCopy}>Long-range forecast, provider-ready market intelligence, enterprise risk, and AI recommendations.</p>
                </div>
                <div style={styles.ratingPill}>{portfolioIntelligence.enterpriseUpgrade2?.risk?.overallRiskClass || "Insufficient Data"}</div>
              </div>
              <div style={styles.summaryCards}>
                <SummaryCard label="Net Worth" value={formatCurrency(portfolioIntelligence.enterpriseUpgrade2?.dashboardKpis?.portfolioKpis?.netWorth)} />
                <SummaryCard label="Portfolio ROI" value={formatPercent(portfolioIntelligence.enterpriseUpgrade2?.dashboardKpis?.portfolioKpis?.roi)} />
                <SummaryCard label="Portfolio IRR" value={formatPercent(portfolioIntelligence.enterpriseUpgrade2?.dashboardKpis?.portfolioKpis?.irr)} />
                <SummaryCard label="Occupancy" value={portfolioIntelligence.enterpriseUpgrade2?.dashboardKpis?.portfolioKpis?.occupancy !== null && portfolioIntelligence.enterpriseUpgrade2?.dashboardKpis?.portfolioKpis?.occupancy !== undefined ? formatPercent(portfolioIntelligence.enterpriseUpgrade2.dashboardKpis.portfolioKpis.occupancy) : "Insufficient Data"} />
                <SummaryCard label="Leverage" value={portfolioIntelligence.enterpriseUpgrade2?.dashboardKpis?.capitalKpis?.leverage !== null && portfolioIntelligence.enterpriseUpgrade2?.dashboardKpis?.capitalKpis?.leverage !== undefined ? formatPercent(portfolioIntelligence.enterpriseUpgrade2.dashboardKpis.capitalKpis.leverage) : "Insufficient Data"} />
                <SummaryCard label="Capital Remaining" value={formatCurrency(portfolioIntelligence.enterpriseUpgrade2?.dashboardKpis?.capitalKpis?.capitalRemaining)} />
                <SummaryCard label="Forecast Horizon" value={portfolioIntelligence.enterpriseUpgrade2?.dashboardKpis?.forecastKpis?.horizonCount || 0} />
                <SummaryCard label="Market Known" value={portfolioIntelligence.enterpriseUpgrade2?.dashboardKpis?.marketKpis?.knownIndicators || 0} />
                <SummaryCard label="Market Unknown" value={portfolioIntelligence.enterpriseUpgrade2?.dashboardKpis?.marketKpis?.unknownIndicators || 0} />
                <SummaryCard label="Risk Score" value={portfolioIntelligence.enterpriseUpgrade2?.risk?.overallRiskScore ? `${Math.round(portfolioIntelligence.enterpriseUpgrade2.risk.overallRiskScore)} / 100` : "Insufficient Data"} />
                <SummaryCard label="Risk Blockers" value={portfolioIntelligence.enterpriseUpgrade2?.dashboardKpis?.riskKpis?.blockers || 0} />
                <SummaryCard label="Reserve Action" value={portfolioIntelligence.enterpriseUpgrade2?.ai?.reserveRequirements?.action || "Insufficient Data"} />
              </div>
            </section>

            <section style={styles.summaryPanel}>
              <div style={styles.summaryHeader}>
                <div>
                  <h3 style={styles.cardTitle}>1 / 3 / 5 / 10 YEAR FORECAST</h3>
                  <p style={styles.panelCopy}>Forecast uses only saved assumptions and preserves unknowns when assumptions are missing.</p>
                </div>
              </div>
              {portfolioIntelligence.enterpriseUpgrade2?.forecast?.horizons?.length ? portfolioIntelligence.enterpriseUpgrade2.forecast.horizons.map((entry) => (
                <div key={`horizon-${entry.year}`} style={styles.listItem}>
                  <div style={styles.listHeader}>
                    <strong>{entry.year}-Year Horizon</strong>
                    <span style={styles.ratingPill}>{entry.confidence}</span>
                  </div>
                  <div style={styles.listMeta}>
                    Value: {entry.projections ? formatCurrency(entry.projections.portfolioValue) : "Insufficient Data"} · Cash Flow: {entry.projections ? formatCurrency(entry.projections.annualCashFlow) : "Insufficient Data"} · Net Worth: {entry.projections ? formatCurrency(entry.projections.netWorth) : "Insufficient Data"}
                  </div>
                  {entry.unknown?.length ? <div style={styles.listMeta}>Unknown: {entry.unknown.join(" • ")}</div> : null}
                </div>
              )) : <div style={styles.emptyState}>No long-range forecast available.</div>}
            </section>

            <section style={styles.summaryPanel}>
              <div style={styles.summaryHeader}>
                <div>
                  <h3 style={styles.cardTitle}>MARKET INTELLIGENCE (PROVIDER-READY)</h3>
                  <p style={styles.panelCopy}>Provider-ready references only. No external market data is fabricated.</p>
                </div>
                <div style={styles.ratingPill}>{portfolioIntelligence.enterpriseUpgrade2?.market?.providerReadyOnly ? "Provider Ready" : "Insufficient Data"}</div>
              </div>
              {portfolioIntelligence.enterpriseUpgrade2?.market?.indicators?.length ? portfolioIntelligence.enterpriseUpgrade2.market.indicators.slice(0, 8).map((indicator) => (
                <div key={`market-${indicator.metric}`} style={styles.listItem}>
                  <div style={styles.listHeader}>
                    <strong>{indicator.metric}</strong>
                    <span style={styles.ratingPill}>{indicator.confidence}</span>
                  </div>
                  <div style={styles.listMeta}>Known: {indicator.knownValue !== null ? String(indicator.knownValue) : "Insufficient Data"} · Provider Configured: {indicator.configured ? "Yes" : "No"} · Feed Active: {indicator.active ? "Yes" : "No"}</div>
                </div>
              )) : <div style={styles.emptyState}>No provider-ready market indicators available.</div>}
            </section>

            <section style={styles.summaryPanel}>
              <div style={styles.summaryHeader}>
                <div>
                  <h3 style={styles.cardTitle}>ENTERPRISE AI DECISION SUITE</h3>
                  <p style={styles.panelCopy}>Each recommendation includes known, unknown, confidence, evidence, and reasoning.</p>
                </div>
              </div>
              {portfolioIntelligence.enterpriseUpgrade2?.ai ? Object.values(portfolioIntelligence.enterpriseUpgrade2.ai).slice(0, 8).map((entry) => (
                <div key={`ai-${entry.recommendationType}`} style={styles.listItem}>
                  <div style={styles.listHeader}>
                    <strong>{entry.recommendationType}</strong>
                    <span style={styles.ratingPill}>{entry.confidence}</span>
                  </div>
                  <div style={styles.listMeta}>Action: {entry.action} · Confidence Score: {entry.confidenceScore} · Unknown Count: {entry.unknown?.length || 0}</div>
                  <div style={styles.listMeta}>Reasoning: {entry.reasoning}</div>
                </div>
              )) : <div style={styles.emptyState}>No AI recommendation data available.</div>}
            </section>

            <section style={styles.contentGrid}>
          <div style={styles.formCard}>
            <div style={styles.cardHeader}>
              <h3 style={styles.cardTitle}>PROPERTY FORM</h3>
              <div style={styles.buttonGroup}>
                <button type="button" style={styles.secondaryButton} onClick={handleClearForm}>CLEAR FORM</button>
                <button type="submit" form="portfolio-form" style={styles.primaryButton}>{selectedPropertyId ? "UPDATE" : "ADD"}</button>
              </div>
            </div>
            {message.text ? <div style={message.type === "success" ? styles.success : styles.error}>{message.text}</div> : null}
            <form id="portfolio-form" onSubmit={handleSubmit} style={styles.formGrid}>
              <label style={styles.field}>
                <span style={styles.fieldLabel}>Property Name</span>
                <input name="propertyName" value={formValues.propertyName} onChange={handleFieldChange} style={styles.input} />
              </label>
              <label style={styles.field}>
                <span style={styles.fieldLabel}>Address</span>
                <input name="propertyAddress" value={formValues.propertyAddress} onChange={handleFieldChange} style={styles.input} />
              </label>
              <label style={styles.field}>
                <span style={styles.fieldLabel}>City</span>
                <input name="city" value={formValues.city} onChange={handleFieldChange} style={styles.input} />
              </label>
              <label style={styles.field}>
                <span style={styles.fieldLabel}>State</span>
                <input name="state" value={formValues.state} onChange={handleFieldChange} style={styles.input} />
              </label>
              <label style={styles.field}>
                <span style={styles.fieldLabel}>ZIP Code</span>
                <input name="zipCode" value={formValues.zipCode} onChange={handleFieldChange} style={styles.input} />
              </label>
              <label style={styles.field}>
                <span style={styles.fieldLabel}>Property Type</span>
                <input name="propertyType" value={formValues.propertyType} onChange={handleFieldChange} style={styles.input} />
              </label>
              <label style={styles.field}>
                <span style={styles.fieldLabel}>Acquisition Date</span>
                <input name="acquisitionDate" type="date" value={formValues.acquisitionDate} onChange={handleFieldChange} style={styles.input} />
              </label>
              <label style={styles.field}>
                <span style={styles.fieldLabel}>Purchase Price</span>
                <input name="purchasePrice" type="number" value={formValues.purchasePrice} onChange={handleFieldChange} style={styles.input} />
              </label>
              <label style={styles.field}>
                <span style={styles.fieldLabel}>Rehab Budget</span>
                <input name="rehabBudget" type="number" value={formValues.rehabBudget} onChange={handleFieldChange} style={styles.input} />
              </label>
              <label style={styles.field}>
                <span style={styles.fieldLabel}>Current Value</span>
                <input name="currentValue" type="number" value={formValues.currentValue} onChange={handleFieldChange} style={styles.input} />
              </label>
              <label style={styles.field}>
                <span style={styles.fieldLabel}>Monthly Rent</span>
                <input name="monthlyRent" type="number" value={formValues.monthlyRent} onChange={handleFieldChange} style={styles.input} />
              </label>
              <label style={styles.field}>
                <span style={styles.fieldLabel}>Occupancy Rate</span>
                <input name="occupancyRate" type="number" value={formValues.occupancyRate} onChange={handleFieldChange} style={styles.input} />
              </label>
              <label style={styles.field}>
                <span style={styles.fieldLabel}>Operating Expenses</span>
                <input name="operatingExpenses" type="number" value={formValues.operatingExpenses} onChange={handleFieldChange} style={styles.input} />
              </label>
              <label style={styles.field}>
                <span style={styles.fieldLabel}>Annual Taxes</span>
                <input name="annualTaxes" type="number" value={formValues.annualTaxes} onChange={handleFieldChange} style={styles.input} />
              </label>
              <label style={styles.field}>
                <span style={styles.fieldLabel}>Annual Insurance</span>
                <input name="annualInsurance" type="number" value={formValues.annualInsurance} onChange={handleFieldChange} style={styles.input} />
              </label>
              <label style={styles.field}>
                <span style={styles.fieldLabel}>Loan Balance</span>
                <input name="loanBalance" type="number" value={formValues.loanBalance} onChange={handleFieldChange} style={styles.input} />
              </label>
              <label style={styles.field}>
                <span style={styles.fieldLabel}>Interest Rate</span>
                <input name="interestRate" type="number" value={formValues.interestRate} onChange={handleFieldChange} style={styles.input} />
              </label>
              <label style={styles.field}>
                <span style={styles.fieldLabel}>Monthly Debt Service</span>
                <input name="monthlyDebtService" type="number" value={formValues.monthlyDebtService} onChange={handleFieldChange} style={styles.input} />
              </label>
              <label style={styles.field}>
                <span style={styles.fieldLabel}>Status</span>
                <input name="status" value={formValues.status} onChange={handleFieldChange} style={styles.input} />
              </label>
              <label style={styles.field}>
                <span style={styles.fieldLabel}>Strategy</span>
                <input name="strategy" value={formValues.strategy} onChange={handleFieldChange} style={styles.input} />
              </label>
              <label style={styles.field}>
                <span style={styles.fieldLabel}>Favorite</span>
                <input name="favorite" type="checkbox" checked={Boolean(formValues.favorite)} onChange={handleFieldChange} style={styles.checkbox} />
              </label>
              <label style={{ ...styles.field, gridColumn: "1 / -1" }}>
                <span style={styles.fieldLabel}>Notes</span>
                <textarea name="notes" value={formValues.notes} onChange={handleFieldChange} style={{ ...styles.input, minHeight: 90 }} />
              </label>
            </form>
          </div>

          <div style={styles.listSection}>
            <div style={styles.cardHeader}>
              <h3 style={styles.cardTitle}>PORTFOLIO LIST</h3>
              <div style={styles.buttonGroup}>
                <button type="button" style={styles.secondaryButton} onClick={() => setComparisonIds([])}>CLEAR COMPARISON</button>
                <button type="button" style={styles.primaryButton} onClick={() => setSelectedPropertyId("")}>ADD NEW</button>
              </div>
            </div>
            {filteredPortfolio.length === 0 ? (
              <div style={styles.emptyState}>
                <div style={styles.emptyTitle}>No portfolio properties available</div>
                <div style={styles.emptyCopy}>Add a property to begin tracking Royal Star portfolio performance.</div>
                <button type="button" style={styles.primaryButton} onClick={handleClearForm}>Add Property</button>
              </div>
            ) : (
              <div style={styles.tableList}>
                {filteredPortfolio.map((item) => (
                  <div key={item.id} style={styles.listItem}>
                    <div style={styles.listHeader}>
                      <div>
                        <div style={styles.listTitleRow}>
                          <strong>{item.propertyName || "Unnamed Property"}</strong>
                          <button type="button" style={styles.favoriteButton} onClick={() => handleFavoriteToggle(item.id)}>{item.favorite ? "★" : "☆"}</button>
                        </div>
                        <div style={styles.listMeta}>{item.propertyAddress} · {item.city}, {item.state} · {item.zipCode}</div>
                      </div>
                      <div style={{ ...styles.ratingPill, borderColor: (() => {
                        const label = String(canonicalRiskById.get(String(item.id)) || item.metrics.risk || "").toLowerCase();
                        if (label.includes("low") || label.includes("healthy") || label.includes("positive") || label.includes("stable")) return "#2f7d32";
                        if (label.includes("moderate") || label.includes("watch") || label.includes("neutral")) return "#b68a1b";
                        return "#9c2a2a";
                      })() }}>{canonicalRiskById.get(String(item.id)) || item.metrics.risk}</div>
                    </div>
                    <div style={styles.metricGrid}>
                      <div style={styles.metricCell}><span style={styles.metricLabel}>Current Value</span><div>{formatCurrency(item.currentValue)}</div></div>
                      <div style={styles.metricCell}><span style={styles.metricLabel}>Equity</span><div>{formatCurrency(item.metrics.equity)}</div></div>
                      <div style={styles.metricCell}><span style={styles.metricLabel}>Cash Flow</span><div>{formatCurrency(item.metrics.cashFlow)}</div></div>
                      <div style={styles.metricCell}><span style={styles.metricLabel}>Cap Rate</span><div>{formatPercent(item.metrics.capRate)}</div></div>
                      <div style={styles.metricCell}><span style={styles.metricLabel}>ROI</span><div>{formatPercent(item.metrics.roi)}</div></div>
                      <div style={styles.metricCell}><span style={styles.metricLabel}>Status</span><div>{item.status}</div></div>
                    </div>
                    <div style={styles.actionRow}>
                      <button type="button" style={styles.secondaryButton} onClick={() => setSelectedPropertyId(item.id)}>View</button>
                      <button type="button" style={styles.secondaryButton} onClick={() => handleSelectProperty(item)}>Edit</button>
                      <button type="button" style={styles.secondaryButton} onClick={() => handleDelete(item.id)}>Delete</button>
                      <button type="button" style={styles.secondaryButton} onClick={() => toggleComparison(item.id)}>{comparisonIds.includes(item.id) ? "Remove from Comparison" : "Add to Comparison"}</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

            <section style={styles.summaryPanel}>
              <div style={styles.summaryHeader}><div><h3 style={styles.cardTitle}>PORTFOLIO ALERTS</h3><p style={styles.panelCopy}>Critical, high, and moderate risk signals requiring attention.</p></div></div>
              {portfolioIntelligence.alerts?.length ? portfolioIntelligence.alerts.map((alert) => (
                <div key={`${alert.alert}-${alert.property}`} style={styles.listItem}>
                  <div style={styles.listHeader}><strong>{alert.alert}</strong><span style={styles.ratingPill}>{alert.severity}</span></div>
                  <div style={styles.listMeta}>Property: {alert.property} · Exposure: {alert.financialExposure} · Action: {alert.requiredAction}</div>
                </div>
              )) : <div style={styles.emptyState}>No portfolio alerts at this time.</div>}
            </section>

            <section style={styles.summaryPanel}>
              <div style={styles.summaryHeader}><div><h3 style={styles.cardTitle}>PROPERTY RANKINGS</h3><p style={styles.panelCopy}>Ranked by current support and risk posture.</p></div></div>
              {portfolioIntelligence.rankings?.length ? portfolioIntelligence.rankings.map((entry, index) => (
                <div key={`${entry.property}-${index}`} style={styles.listItem}>
                  <div style={styles.listHeader}><strong>{index + 1}. {entry.property}</strong><span style={styles.ratingPill}>{entry.recommendation}</span></div>
                  <div style={styles.listMeta}>{entry.address} · {entry.strategy} · {entry.status} · Equity {formatCurrency(entry.equity)} · Cash Flow {formatCurrency(entry.monthlyCashFlow)} · DSCR {entry.dscr}</div>
                </div>
              )) : <div style={styles.emptyState}>No ranking data available.</div>}
            </section>

            <section style={styles.summaryPanel}>
              <div style={styles.summaryHeader}>
                <div>
                  <h3 style={styles.cardTitle}>REFINANCE & EXIT OPPORTUNITIES</h3>
                  <p style={styles.panelCopy}>Portfolio-wide exit guidance and capital release logic.</p>
                </div>
                <div style={styles.ratingPill}>{refinanceExitOptimizer?.primaryExit || "Insufficient Data"}</div>
              </div>
              <div style={styles.summaryCards}>
                <SummaryCard label="Primary Exit" value={refinanceExitOptimizer?.primaryExit || "Insufficient Data"} />
                <SummaryCard label="Secondary Exit" value={refinanceExitOptimizer?.secondaryExit || "Insufficient Data"} />
                <SummaryCard label="Refinance Readiness" value={refinanceExitOptimizer?.refinanceReadiness || "Insufficient Data"} />
                <SummaryCard label="Capital Released" value={refinanceExitOptimizer?.summary?.estimatedCapitalReleased || "Insufficient Data"} />
                <SummaryCard label="Capital Required" value={refinanceExitOptimizer?.summary?.estimatedCapitalRequired || "Insufficient Data"} />
              </div>
              {refinanceExitOptimizer?.comparison?.length ? (
                <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
                  {refinanceExitOptimizer.comparison.map((entry) => (
                    <div key={`${entry.strategy}`} style={styles.listItem}>
                      <div style={styles.listHeader}>
                        <strong>{entry.strategy}</strong>
                        <span style={styles.ratingPill}>{entry.viability}</span>
                      </div>
                      <div style={styles.listMeta}>Score: {entry.exitScore} · Net Proceeds: {entry.estimatedNetProceeds} · Capital Returned: {entry.capitalReturned} · Cash Flow: {entry.monthlyCashFlow} · Required Action: {entry.requiredNextAction}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={styles.emptyState}>No refinance or exit opportunities available.</div>
              )}
            </section>

            <section style={styles.summaryPanel}>
              <div style={styles.summaryHeader}>
                <div>
                  <h3 style={styles.cardTitle}>CAPITAL ALLOCATION</h3>
                  <p style={styles.panelCopy}>Where capital should flow next.</p>
                </div>
                <div style={styles.ratingPill}>{capitalAllocationEngine?.capitalPosition?.capitalStatus || "Insufficient Data"}</div>
              </div>
              <div style={styles.summaryCards}>
                <SummaryCard label="Available Liquidity" value={capitalAllocationEngine?.capitalPosition?.availableLiquidityDisplay || "Insufficient Data"} />
                <SummaryCard label="Reserve Status" value={capitalAllocationEngine?.capitalPosition?.reserveShortfallDisplay || "Insufficient Data"} />
                <SummaryCard label="Deployable Capital" value={capitalAllocationEngine?.capitalPosition?.deployableCapitalDisplay || "Insufficient Data"} />
                <SummaryCard label="Highest Priority" value={capitalAllocationEngine?.summary?.highestPriorityOption || "Insufficient Data"} />
              </div>
              {capitalAllocationEngine?.plan?.length ? (
                <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
                  {capitalAllocationEngine.plan.map((entry) => (
                    <div key={`${entry.option}-${entry.rank}`} style={styles.listItem}>
                      <div style={styles.listHeader}>
                        <strong>{entry.rank}. {entry.option}</strong>
                        <span style={styles.ratingPill}>{entry.recommendationStatus}</span>
                      </div>
                      <div style={styles.listMeta}>Property: {entry.relatedProperty} · Required: {entry.capitalRequired} · Return: {entry.expectedReturn} · Risk: {entry.risk}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={styles.emptyState}>No capital allocation recommendation available.</div>
              )}
            </section>

            <section style={styles.summaryPanel}>
              <div style={styles.summaryHeader}><div><h3 style={styles.cardTitle}>REFINANCE OPPORTUNITIES</h3><p style={styles.panelCopy}>Properties that may support a refinance or capital recycle.</p></div></div>
              {portfolioIntelligence.refinanceOpportunities?.length ? portfolioIntelligence.refinanceOpportunities.map((entry) => (
                <div key={`${entry.property}-refi`} style={styles.listItem}>
                  <div style={styles.listHeader}><strong>{entry.property}</strong><span style={styles.ratingPill}>{entry.refinanceNow ? "Refinance Now" : "Review"}</span></div>
                  <div style={styles.listMeta}>New Loan: {entry.estimateNewLoan} · Cash Returned: {entry.estimatedCashReturned} · Reason: {entry.recommendationReason}</div>
                </div>
              )) : <div style={styles.emptyState}>No refinance opportunities flagged.</div>}
            </section>

            <section style={styles.summaryPanel}>
              <div style={styles.summaryHeader}><div><h3 style={styles.cardTitle}>SELL VS HOLD</h3><p style={styles.panelCopy}>Simple decision support for stabilized positions.</p></div></div>
              {portfolioIntelligence.sellVsHold?.length ? portfolioIntelligence.sellVsHold.map((entry) => (
                <div key={`${entry.property}-hold`} style={styles.listItem}>
                  <div style={styles.listHeader}><strong>{entry.property}</strong><span style={styles.ratingPill}>{entry.recommendation}</span></div>
                  <div style={styles.listMeta}>{entry.reason}</div>
                </div>
              )) : <div style={styles.emptyState}>No sell vs hold analysis available.</div>}
            </section>

            <section style={styles.summaryPanel}>
              <div style={styles.summaryHeader}><div><h3 style={styles.cardTitle}>BRRRR CAPITAL RECYCLING</h3><p style={styles.panelCopy}>Capital recovered and next deployment opportunity.</p></div></div>
              {portfolioIntelligence.brrrrRecycling?.length ? portfolioIntelligence.brrrrRecycling.map((entry) => (
                <div key={`${entry.property}-brrrr`} style={styles.listItem}>
                  <div style={styles.listHeader}><strong>{entry.property}</strong><span style={styles.ratingPill}>{entry.status}</span></div>
                  <div style={styles.listMeta}>Cash Returned: {entry.cashReturned} · Cash Left: {entry.cashLeftInDeal} · Readiness: {entry.refinanceReadiness}</div>
                </div>
              )) : <div style={styles.emptyState}>No BRRRR recycling opportunities available.</div>}
            </section>

            <section style={styles.summaryPanel}>
              <div style={styles.summaryHeader}><div><h3 style={styles.cardTitle}>DEBT MATURITY SCHEDULE</h3><p style={styles.panelCopy}>Upcoming maturity exposure and required action.</p></div></div>
              {portfolioIntelligence.debtMaturitySchedule?.length ? portfolioIntelligence.debtMaturitySchedule.map((entry) => (
                <div key={`${entry.property}-${entry.maturityDate}`} style={styles.listItem}>
                  <div style={styles.listHeader}><strong>{entry.property}</strong><span style={styles.ratingPill}>{entry.riskLevel}</span></div>
                  <div style={styles.listMeta}>Lender: {entry.lender} · Balance: {entry.loanBalance} · Maturity: {entry.maturityDate} · Days: {entry.daysUntilMaturity} · Action: {entry.requiredAction}</div>
                </div>
              )) : <div style={styles.emptyState}>No debt maturity data available.</div>}
            </section>

            <section style={styles.summaryPanel}>
              <div style={styles.summaryHeader}><div><h3 style={styles.cardTitle}>REHAB CAPACITY</h3><p style={styles.panelCopy}>Active pipeline and capacity pressure.</p></div></div>
              <div style={styles.listMeta}>Active rehabs: {portfolioIntelligence.rehabCapacity?.activeRehabCount ?? 0} · Remaining budget: {portfolioIntelligence.rehabCapacity?.totalRemainingRehabBudget || "Insufficient Data"} · Status: {portfolioIntelligence.rehabCapacity?.capacityStatus || "Insufficient Data"}</div>
            </section>

            <section style={styles.summaryPanel}>
              <div style={styles.summaryHeader}><div><h3 style={styles.cardTitle}>CONCENTRATION RISK</h3><p style={styles.panelCopy}>Concentration by geography and exposure.</p></div></div>
              <div style={styles.listMeta}>Concentration: {portfolioIntelligence.concentrationRisk?.concentrationPercentage || "Insufficient Data"} · Exposed amount: {portfolioIntelligence.concentrationRisk?.portfolioAmountExposed || "Insufficient Data"} · Risk: {portfolioIntelligence.concentrationRisk?.riskLevel || "Insufficient Data"}</div>
            </section>

            <section style={styles.summaryPanel}>
              <div style={styles.summaryHeader}><div><h3 style={styles.cardTitle}>PORTFOLIO STRESS TESTS</h3><p style={styles.panelCopy}>Portfolio resilience under downside conditions.</p></div></div>
              {portfolioIntelligence.stressTests?.length ? portfolioIntelligence.stressTests.map((entry) => (
                <div key={`${entry.scenario}`} style={styles.listItem}>
                  <div style={styles.listHeader}><strong>{entry.scenario}</strong><span style={styles.ratingPill}>{entry.riskLevel}</span></div>
                  <div style={styles.listMeta}>Equity: {entry.totalEquity} · Cash Flow: {entry.monthlyCashFlow} · DSCR: {entry.dscr} · Actions: {entry.recommendedActions.join(" • ")}</div>
                </div>
              )) : <div style={styles.emptyState}>No stress test data available.</div>}
            </section>

            <section style={styles.summaryPanel}>
              <div style={styles.summaryHeader}><div><h3 style={styles.cardTitle}>KNOWN / UNCERTAIN / NEEDED</h3><p style={styles.panelCopy}>Portfolio confidence and the next data gaps to close.</p></div></div>
              <div style={styles.listMeta}>Known: {portfolioIntelligence.known?.join(" • ") || "Insufficient Data"}</div>
              <div style={styles.listMeta}>Uncertain: {portfolioIntelligence.uncertain?.join(" • ") || "Insufficient Data"}</div>
              <div style={styles.listMeta}>Needed: {portfolioIntelligence.neededToImproveDecision?.join(" • ") || "Insufficient Data"}</div>
            </section>

                {selectedProperty ? (
          <section style={styles.detailPanel}>
            <div style={styles.cardHeader}>
              <h3 style={styles.cardTitle}>{selectedProperty.propertyName}</h3>
              <div style={styles.buttonGroup}>
                <button type="button" style={styles.secondaryButton} onClick={() => handleSelectProperty(selectedProperty)}>EDIT</button>
                <button type="button" style={styles.secondaryButton} onClick={() => handleDelete(selectedProperty.id)}>DELETE</button>
              </div>
            </div>
            <div style={styles.detailGrid}>
              <div style={styles.detailCard}>
                <div style={styles.detailHeading}>Asset Snapshot</div>
                <div>{selectedProperty.propertyAddress}</div>
                <div>{selectedProperty.city}, {selectedProperty.state} {selectedProperty.zipCode}</div>
                <div>Acquired {formatDate(selectedProperty.acquisitionDate)}</div>
                <div>Status: {selectedProperty.status}</div>
              </div>
              <div style={styles.detailCard}>
                <div style={styles.detailHeading}>Performance Metrics</div>
                <div><strong>Current Value:</strong> {formatCurrency(selectedProperty.currentValue)}</div>
                <div><strong>Equity:</strong> {formatCurrency(selectedProperty.metrics.equity)}</div>
                <div><strong>Annual Gross Rent:</strong> {formatCurrency(selectedProperty.metrics.annualGrossRent)}</div>
                <div><strong>Annual NOI:</strong> {formatCurrency(selectedProperty.metrics.annualNetOperatingIncome)}</div>
                <div><strong>Cash Flow:</strong> {formatCurrency(selectedProperty.metrics.cashFlow)}</div>
              </div>
              <div style={styles.detailCard}>
                <div style={styles.detailHeading}>Valuation</div>
                <div><strong>Purchase Price:</strong> {formatCurrency(selectedProperty.purchasePrice)}</div>
                <div><strong>Rehab Budget:</strong> {formatCurrency(selectedProperty.rehabBudget)}</div>
                <div><strong>Cap Rate:</strong> {formatPercent(selectedProperty.metrics.capRate)}</div>
                <div><strong>ROI:</strong> {formatPercent(selectedProperty.metrics.roi)}</div>
              </div>
              <div style={styles.detailCard}>
                <div style={styles.detailHeading}>Strategy</div>
                <div>{selectedProperty.strategy}</div>
                <div>{selectedProperty.notes || "No notes yet."}</div>
              </div>
            </div>
          </section>
        ) : null}

        {comparisonItems.length > 0 ? (
          <section style={styles.comparisonPanel}>
            <div style={styles.cardHeader}>
              <h3 style={styles.cardTitle}>COMPARISON TOOL</h3>
              <div style={styles.buttonGroup}>
                <button type="button" style={styles.secondaryButton} onClick={() => setComparisonIds([])}>CLEAR</button>
              </div>
            </div>
            <div style={styles.comparisonTable}>
              <div style={styles.comparisonHeader}>Metric</div>
              {comparisonItems.map((item) => (
                <div key={item.id} style={styles.comparisonHeader}>{item.propertyName}</div>
              ))}
              {[
                ["Current Value", (item) => formatCurrency(item.currentValue)],
                ["Equity", (item) => formatCurrency(item.metrics.equity)],
                ["Cash Flow", (item) => formatCurrency(item.metrics.cashFlow)],
                ["Cap Rate", (item) => formatPercent(item.metrics.capRate)],
                ["ROI", (item) => formatPercent(item.metrics.roi)],
                ["Status", (item) => item.status],
                ["Strategy", (item) => item.strategy],
              ].map(([label, renderValue]) => {
                const values = comparisonItems.map((item) => ({ item, value: renderValue(item) }));
                return (
                  <>
                    <div key={`${label}-label`} style={styles.comparisonCell}>{label}</div>
                    {values.map(({ item, value }) => <div key={`${item.id}-${label}`} style={styles.comparisonCell}>{value}</div>)}
                  </>
                );
              })}
            </div>
          </section>
        ) : null}
          </>
        ) : null}
      </main>
    </div>
  );
}

function SummaryCard({ label, value }) {
  return (
    <div style={styles.summaryCard}>
      <div style={styles.summaryLabel}>{label}</div>
      <div style={styles.summaryValue}>{value}</div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    background: "#0f0f0f",
    color: "#f6e3aa",
    display: "flex",
    fontFamily: "Arial, sans-serif",
  },
  sidebar: {
    width: 260,
    background: "linear-gradient(180deg, #111 0%, #1b1408 100%)",
    borderRight: "1px solid #8b6a20",
    padding: "24px 18px",
    display: "flex",
    flexDirection: "column",
    gap: 16,
  },
  logoArea: { display: "flex", justifyContent: "center", marginBottom: 8 },
  logo: { width: 140, height: "auto" },
  nav: { display: "flex", flexDirection: "column", gap: 8 },
  navButton: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    background: "transparent",
    border: "none",
    color: "#f6e3aa",
    padding: "10px 8px",
    textAlign: "left",
    borderRadius: 6,
    cursor: "pointer",
  },
  navIcon: { fontSize: 18 },
  navTab: { width: 4, height: 18, background: "#b68a1b", borderRadius: 4, marginLeft: "auto" },
  logout: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    background: "#b68a1b",
    border: "none",
    color: "#111",
    padding: "10px 8px",
    borderRadius: 6,
    fontWeight: 700,
    cursor: "pointer",
    marginTop: 8,
  },
  smallMark: { marginTop: "auto", textAlign: "center", fontSize: 24, color: "#b68a1b", letterSpacing: 3 },
  main: { flex: 1, padding: 24, display: "flex", flexDirection: "column", gap: 20 },
  topBar: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, borderBottom: "1px solid #8b6a20", paddingBottom: 12 },
  backButton: { background: "transparent", border: "1px solid #b68a1b", color: "#f6e3aa", padding: "8px 12px", borderRadius: 6, cursor: "pointer" },
  headingBlock: { flex: 1 },
  company: { margin: 0, fontSize: 26, color: "#fff0c7" },
  subtitle: { margin: "2px 0 0", color: "#b68a1b", fontSize: 14, letterSpacing: 1.5 },
  headerActions: { display: "flex", gap: 10, flexWrap: "wrap" },
  primaryButton: { background: "#b68a1b", border: "none", color: "#111", padding: "8px 12px", borderRadius: 6, cursor: "pointer", fontWeight: 700 },
  secondaryButton: { background: "transparent", border: "1px solid #b68a1b", color: "#f6e3aa", padding: "8px 12px", borderRadius: 6, cursor: "pointer" },
  summaryPanel: { background: "#16110a", border: "1px solid #8b6a20", borderRadius: 10, padding: 16 },
  summaryHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  panelTitle: { margin: 0, fontSize: 18 },
  panelCopy: { margin: "4px 0 0", color: "#c3aa66" },
  connectionBadge: { border: "1px solid #b68a1b", padding: "6px 10px", borderRadius: 999, fontSize: 12, color: "#f6e3aa" },
  summaryCards: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10 },
  summaryCard: { border: "1px solid #3b2b10", background: "#1d160d", borderRadius: 8, padding: 12 },
  summaryLabel: { color: "#c3aa66", fontSize: 12, textTransform: "uppercase" },
  summaryValue: { fontSize: 16, fontWeight: 700, marginTop: 4 },
  filtersSection: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 10, background: "#16110a", border: "1px solid #8b6a20", padding: 12, borderRadius: 10 },
  input: { background: "#0f0f0f", border: "1px solid #5b4424", color: "#f6e3aa", padding: "8px 10px", borderRadius: 6, width: "100%", boxSizing: "border-box" },
  select: { background: "#0f0f0f", border: "1px solid #5b4424", color: "#f6e3aa", padding: "8px 10px", borderRadius: 6, width: "100%" },
  checkbox: { width: 18, height: 18, accentColor: "#b68a1b" },
  contentGrid: { display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: 20 },
  formCard: { background: "#16110a", border: "1px solid #8b6a20", borderRadius: 10, padding: 16 },
  listSection: { background: "#16110a", border: "1px solid #8b6a20", borderRadius: 10, padding: 16, display: "flex", flexDirection: "column", gap: 12 },
  cardHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  cardTitle: { margin: 0, fontSize: 16, letterSpacing: 1.3 },
  buttonGroup: { display: "flex", gap: 8 },
  success: { background: "#183b24", color: "#a6f5c3", padding: "8px 10px", borderRadius: 6, marginBottom: 10 },
  error: { background: "#4b1712", color: "#ffd8d8", padding: "8px 10px", borderRadius: 6, marginBottom: 10 },
  formGrid: { display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10 },
  field: { display: "flex", flexDirection: "column", gap: 6 },
  fieldLabel: { color: "#c3aa66", fontSize: 12, textTransform: "uppercase" },
  emptyState: { border: "1px dashed #5b4424", borderRadius: 8, padding: 20, textAlign: "center", color: "#c3aa66" },
  emptyTitle: { fontSize: 16, fontWeight: 700, color: "#f6e3aa", marginBottom: 6 },
  emptyCopy: { marginBottom: 10 },
  tableList: { display: "flex", flexDirection: "column", gap: 10, maxHeight: 760, overflowY: "auto" },
  listItem: { border: "1px solid #3b2b10", borderRadius: 8, padding: 12, background: "#1d160d" },
  listHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  listTitleRow: { display: "flex", alignItems: "center", gap: 8 },
  listMeta: { color: "#c3aa66", fontSize: 12, marginTop: 2 },
  favoriteButton: { background: "transparent", border: "none", color: "#f4c542", fontSize: 20, cursor: "pointer" },
  ratingPill: { border: "1px solid #b68a1b", padding: "4px 8px", borderRadius: 999, fontSize: 12 },
  metricGrid: { display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 8, marginBottom: 8 },
  metricCell: { borderTop: "1px solid #3b2b10", paddingTop: 6, fontSize: 12 },
  metricLabel: { color: "#c3aa66", display: "block", marginBottom: 2 },
  actionRow: { display: "flex", gap: 8, flexWrap: "wrap" },
  detailPanel: { background: "#16110a", border: "1px solid #8b6a20", borderRadius: 10, padding: 16, display: "flex", flexDirection: "column", gap: 12 },
  detailGrid: { display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12 },
  detailCard: { border: "1px solid #3b2b10", borderRadius: 8, padding: 12, background: "#1d160d" },
  detailHeading: { fontWeight: 700, color: "#f6e3aa", marginBottom: 6 },
  comparisonPanel: { background: "#16110a", border: "1px solid #8b6a20", borderRadius: 10, padding: 16 },
  comparisonTable: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 8, marginTop: 10 },
  comparisonHeader: { fontWeight: 700, color: "#f6e3aa", borderBottom: "1px solid #3b2b10", paddingBottom: 6 },
  comparisonCell: { borderBottom: "1px solid #3b2b10", paddingBottom: 6, fontSize: 13 },
};
