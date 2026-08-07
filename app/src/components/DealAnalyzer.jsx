import { useEffect, useMemo, useState } from "react";
import logo from "../assets/royal-star-logo.png";
import { buildAiDecisionEngine } from "./aiDecisionEngine.js";
import { buildUnifiedUnderwritingIntelligence, normalizeDealForIntelligence, buildUnderwritingMetrics, buildDealScore } from "./intelligenceUpgradeEngine.js";
import { buildApiUrl } from "../utils/apiClient.js";
import { DEAL_STATUS_OPTIONS } from "../utils/dealWorkflowRegistry.js";
import { getSidebarNavigation } from "../utils/navigationModel.js";
import { useLogoutControl } from "../hooks/useLogoutControl.js";


const navigation = getSidebarNavigation();

function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function safeNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatCurrency(value) {
  if (!Number.isFinite(value)) return "Not Available";
  return `$${value.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

function formatDate(dateValue) {
  if (!dateValue) return "Not Available";
  try {
    return new Date(dateValue).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return dateValue;
  }
}

function normalizeDeal(deal) {
  const rawFinancingCosts = toNumber(deal.financingCosts);
  const effectiveFinancingCosts = toNumber(
    deal.financials?.effectiveFinancingCosts
    ?? deal.effectiveFinancingCost
    ?? deal.financials?.calculatedFinancingCosts
    ?? deal.calculatedFinancingCost
    ?? deal.financingCost
    ?? 0
  );
  const financingCosts = rawFinancingCosts > 0 ? rawFinancingCosts : (effectiveFinancingCosts > 0 ? effectiveFinancingCosts : "");
  const normalized = {
    id: deal.id || `${Date.now()}-${Math.random()}`,
    propertyAddress: deal.propertyAddress || deal.address || "",
    address: deal.address || deal.propertyAddress || "",
    city: deal.city || "",
    state: deal.state || "",
    zipCode: deal.zipCode || deal.zip || "",
    zip: deal.zip || deal.zipCode || "",
    propertyType: deal.propertyType || "",
    bedrooms: deal.bedrooms ?? "",
    bathrooms: deal.bathrooms ?? "",
    squareFeet: deal.squareFeet ?? "",
    yearBuilt: deal.yearBuilt ?? "",
    askingPrice: deal.askingPrice ?? "",
    purchasePrice: deal.purchasePrice ?? "",
    rehabBudget: deal.rehabBudget ?? "",
    estimatedArv: deal.estimatedArv ?? deal.arv ?? "",
    arv: deal.arv ?? deal.estimatedArv ?? "",
    estimatedRent: deal.estimatedRent ?? "",
    taxes: deal.taxes ?? "",
    insurance: deal.insurance ?? "",
    financingCosts,
    closingCosts: deal.closingCosts ?? "",
    holdingMonths: deal.holdingMonths ?? "",
    leadSource: deal.leadSource || "",
    strategy: deal.strategy || deal.exitStrategy || "",
    exitStrategy: deal.exitStrategy || deal.strategy || "",
    notes: deal.notes || "",
    status: deal.status || "active",
    createdAt: deal.createdAt || "",
    updatedAt: deal.updatedAt || "",
    source: deal.source || "web",
    financials: deal.financials ? {
      rawFinancingCostInput: toNumber(deal.financials.rawFinancingCostInput ?? deal.rawFinancingCostInput ?? deal.financingCosts ?? 0),
      calculatedFinancingCosts: toNumber(deal.financials.calculatedFinancingCosts ?? deal.calculatedFinancingCost ?? deal.financials?.effectiveFinancingCosts ?? 0),
      effectiveFinancingCosts: effectiveFinancingCosts || toNumber(deal.financials.effectiveFinancingCosts ?? deal.effectiveFinancingCost ?? 0),
      financingCostSource: deal.financials.financingCostSource || deal.financingCostSource || "calculated",
    } : undefined,
    recommendation: deal.recommendation || "",
    overallRisk: deal.overallRisk ?? "",
    projectedProfit: deal.projectedProfit ?? "",
  };

  return normalized;
}

export default function DealAnalyzer({ onBack, onOpenDealIntake, onOpenDealIntelligence, onEditDeal, currentView = "dealAnalyzer", onNavigate }) {
  const [deals, setDeals] = useState([]);
  const [connectionState, setConnectionState] = useState("Backend Connected");
  const [searchText, setSearchText] = useState("");
  const [strategyFilter, setStrategyFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [sortOption, setSortOption] = useState("newest");
  const [selectedDeal, setSelectedDeal] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const { logoutEnabled, loggingOut, handleLogout, title: logoutTitle } = useLogoutControl(onBack);

  const handleSidebarNavigate = (viewKey) => {
    if (!onNavigate) return;
    if (String(viewKey) === String(currentView)) return;
    onNavigate(viewKey);
  };

  const loadDeals = async () => {
    try {
      const response = await fetch(buildApiUrl("/api/deals"));
      if (!response.ok) {
        throw new Error("Unable to fetch deals");
      }

      const apiDeals = await response.json();
      const normalizedDeals = (Array.isArray(apiDeals) ? apiDeals : []).map(normalizeDeal);
      setDeals(normalizedDeals);
      setConnectionState("Backend Connected");
    } catch (error) {
      console.error("Unable to read deals from API, using localStorage fallback", error);
      setConnectionState("Local Fallback");

      if (typeof window !== "undefined") {
        try {
          const localDeals = JSON.parse(window.localStorage.getItem("royalStarDeals") || "[]") || [];
          setDeals((Array.isArray(localDeals) ? localDeals : []).map(normalizeDeal));
        } catch (localError) {
          console.error("Unable to read deals from localStorage", localError);
          setDeals([]);
        }
      }
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadDeals();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [refreshKey]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const refresh = () => setRefreshKey((value) => value + 1);
    window.addEventListener("royalStarDealsUpdated", refresh);
    window.addEventListener("royalStarDataSynchronized", refresh);
    return () => {
      window.removeEventListener("royalStarDealsUpdated", refresh);
      window.removeEventListener("royalStarDataSynchronized", refresh);
    };
  }, []);

  const statusFilterOptions = useMemo(() => {
    const existing = deals.map((deal) => String(deal.status || "").trim()).filter(Boolean);
    return ["ALL", ...Array.from(new Set([...DEAL_STATUS_OPTIONS, ...existing]))];
  }, [deals]);

  const filteredDeals = useMemo(() => {
    const query = searchText.trim().toLowerCase();

    let result = deals.filter((deal) => {
      const searchFields = [
        deal.propertyAddress,
        deal.address,
        deal.city,
        deal.zipCode,
        deal.zip,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const matchesSearch = !query || searchFields.includes(query);

      const matchesStrategy = strategyFilter === "ALL" || deal.strategy === strategyFilter;
      const matchesStatus = statusFilter === "ALL" || deal.status === statusFilter;

      return matchesSearch && matchesStrategy && matchesStatus;
    });

    result.sort((a, b) => {
      switch (sortOption) {
        case "purchase":
          return toNumber(b.purchasePrice) - toNumber(a.purchasePrice);
        case "arv":
          return toNumber(b.arv) - toNumber(a.arv);
        case "spread": {
          const spreadA = toNumber(a.arv) - toNumber(a.purchasePrice) - toNumber(a.rehabBudget);
          const spreadB = toNumber(b.arv) - toNumber(b.purchasePrice) - toNumber(b.rehabBudget);
          return spreadB - spreadA;
        }
        case "newest":
        default: {
          const dateA = a.createdAt || a.updatedAt || "";
          const dateB = b.createdAt || b.updatedAt || "";
          return dateB.localeCompare(dateA);
        }
      }
    });

    return result;
  }, [deals, searchText, strategyFilter, statusFilter, sortOption]);

  const underwritingSummaries = useMemo(() => {
    return deals.map((deal) => {
      const normalizedDeal = normalizeDealForIntelligence(deal);
      const underwriting = buildUnifiedUnderwritingIntelligence(normalizedDeal, [], []);
      const metrics = buildUnderwritingMetrics(normalizedDeal, {}, { includeContingency: false, includeHoldingCost: false, includeTaxesAndInsurance: false, includeExtraCosts: false });
      return {
        deal,
        normalizedDeal,
        underwriting,
        metrics,
        spread: metrics.arv - metrics.purchasePrice - metrics.rehabCost,
      };
    });
  }, [deals]);

  const summary = useMemo(() => {
    const totalPurchaseCost = underwritingSummaries.reduce((sum, entry) => sum + entry.metrics.purchasePrice, 0);
    const totalRehabBudget = underwritingSummaries.reduce((sum, entry) => sum + entry.metrics.rehabCost, 0);
    const totalArv = underwritingSummaries.reduce((sum, entry) => sum + entry.metrics.arv, 0);
    const averageSpread = underwritingSummaries.length
      ? underwritingSummaries.reduce((sum, entry) => sum + entry.spread, 0) / underwritingSummaries.length
      : 0;

    return {
      totalDeals: deals.length,
      totalPurchaseCost,
      totalRehabBudget,
      totalArv,
      averageSpread,
    };
  }, [deals.length, underwritingSummaries]);

  const handleView = (deal) => {
    setSelectedDeal(deal);
  };

  const selectedDealMetrics = useMemo(() => {
    if (!selectedDeal) return null;

    const normalized = normalizeDealForIntelligence(selectedDeal);
    const underwriting = buildUnifiedUnderwritingIntelligence(normalized, [], []);
    const sharedDecision = underwriting?.sharedDecision || {};
    const projectedProfit = safeNumber(sharedDecision.projectedProfit ?? underwriting?.financingAnalysis?.projectedProfit ?? underwriting?.flipAnalysis?.netProfit ?? 0);
    const dealScore = safeNumber(underwriting?.sharedDecision?.dealScore ?? underwriting?.decisionConsistency?.dealScore ?? buildDealScore(normalized, underwriting?.arvAnalysis || {}, underwriting?.financingAnalysis || {}));
    const overallRisk = safeNumber(sharedDecision.overallRiskScore ?? underwriting?.riskProfile?.overallRiskScore ?? underwriting?.sharedDecision?.overallRiskScore ?? 0);

    return {
      normalized,
      underwriting,
      projectedProfit,
      dealScore,
      overallRisk,
      recommendation: sharedDecision.baseRecommendation || underwriting?.recommendation?.action || "Insufficient Data",
    };
  }, [selectedDeal]);

  const aiDecisionInsight = useMemo(() => {
    if (!selectedDealMetrics) return null;

    const normalized = selectedDealMetrics.normalized;
    const underwriting = selectedDealMetrics.underwriting;
    const analysis = {
      dealScore: selectedDealMetrics.dealScore,
      financingScore: 72,
      overallRisk: selectedDealMetrics.overallRisk,
      buyBoxResult: underwriting.buyBox.decision === "Strong Pass" || underwriting.buyBox.decision === "Pass" ? "PASS" : "CONDITIONAL PASS",
      arvConfidence: underwriting.arvAnalysis.confidenceLabel.toLowerCase(),
      supportedBaseArv: underwriting.arvAnalysis.supportedBaseArv,
      recommendedOffer: underwriting.mao.targetOffer,
      maximumAllowableOffer: underwriting.mao.maximumOffer,
      walkAwayPrice: underwriting.mao.walkAwayPrice,
      estimatedFlipProfit: selectedDealMetrics.projectedProfit,
      roi: underwriting.flipAnalysis.returnOnCost,
      dscr: underwriting.brrrrAnalysis.debtServiceCoverageRatio,
      monthlyCashFlow: underwriting.brrrrAnalysis.monthlyCashFlow,
      cashRequired: underwriting.brrrrAnalysis.cashInvested,
      warnings: underwriting.recommendation.primaryRisks || [],
    };

    return buildAiDecisionEngine({
      deal: normalized,
      analysis,
      deals: [normalized],
      rehabProjects: [],
      contractors: [],
      lenders: [],
      portfolioIntelligence: { summary: { healthScore: 70, reserveShortfallValue: 0 } },
    });
  }, [selectedDealMetrics]);

  const handleDelete = async (deal) => {
    const confirmed = window.confirm(`Delete ${deal.propertyAddress || deal.address || "this deal"}?`);
    if (!confirmed) return;

    try {
      const response = await fetch(buildApiUrl(`/api/deals/${deal.id}`), { method: "DELETE" });
      if (!response.ok) {
        throw new Error("Unable to delete deal");
      }

      setSelectedDeal(null);
      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("royalStarDealsUpdated"));
      }
      setRefreshKey((value) => value + 1);
    } catch (error) {
      console.error("Unable to delete deal from API, using localStorage fallback", error);
      if (typeof window !== "undefined") {
        try {
          const storedDeals = JSON.parse(window.localStorage.getItem("royalStarDeals") || "[]") || [];
          const updatedDeals = storedDeals.filter((entry) => String(entry.id) !== String(deal.id));
          window.localStorage.setItem("royalStarDeals", JSON.stringify(updatedDeals));
          if (typeof window !== "undefined") {
            window.dispatchEvent(new Event("royalStarDealsUpdated"));
          }
          setSelectedDeal(null);
          setRefreshKey((value) => value + 1);
        } catch (localError) {
          console.error("Unable to delete deal from localStorage", localError);
        }
      }
    }
  };

  return (
    <div style={styles.page}>
      <aside style={styles.sidebar}>
        <div style={styles.logoArea}>
          <img src={logo} alt="Royal Star Properties" style={styles.logo} />
        </div>

        <nav style={styles.nav}>
          {navigation.map((item) => (
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
          ))}

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
        <section style={styles.topBar}>
          <button type="button" style={styles.backButton} onClick={onBack}>
            ◀ COMMAND CENTER
          </button>

          <div style={styles.headingBlock}>
            <h1 style={styles.company}>ROYAL STAR PROPERTIES, LLC</h1>
            <p style={styles.subtitle}>DEAL ANALYZER / RSOS OPERATIONS</p>
          </div>

          <div style={styles.headerActions}>
            <button type="button" style={styles.secondaryButton} onClick={onOpenDealIntake}>
              ADD NEW DEAL
            </button>
            <button type="button" style={styles.primaryButton} onClick={onOpenDealIntelligence}>
              DEAL INTELLIGENCE
            </button>
          </div>
        </section>

        <section style={styles.card}>
          <div style={styles.cardHeader}>
            <div>
              <h2 style={styles.cardTitle}>DEAL ANALYZER</h2>
              <p style={styles.cardSubtitle}>Review every deal, filter opportunities, and manage the pipeline.</p>
            </div>
            <div style={styles.connectionBadge}>{connectionState}</div>
          </div>

          <div style={styles.summaryGrid}>
            <SummaryCard label="Total Deals" value={summary.totalDeals} />
            <SummaryCard label="Total Purchase Cost" value={formatCurrency(summary.totalPurchaseCost)} />
            <SummaryCard label="Total Rehab Budget" value={formatCurrency(summary.totalRehabBudget)} />
            <SummaryCard label="Total ARV" value={formatCurrency(summary.totalArv)} />
            <SummaryCard label="Average Deal Spread" value={formatCurrency(summary.averageSpread)} />
          </div>

          <div style={styles.controlsRow}>
            <input
              type="text"
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
              placeholder="Search by address, city, or ZIP"
              style={styles.input}
            />

            <select value={strategyFilter} onChange={(event) => setStrategyFilter(event.target.value)} style={styles.select}>
              <option value="ALL">All Strategies</option>
              <option value="Flip">Flip</option>
              <option value="BRRRR">BRRRR</option>
              <option value="Hold">Hold</option>
              <option value="Pass">Pass</option>
            </select>

            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} style={styles.select}>
              {statusFilterOptions.map((statusOption) => (
                <option key={statusOption} value={statusOption}>{statusOption === "ALL" ? "All Status" : statusOption}</option>
              ))}
            </select>

            <select value={sortOption} onChange={(event) => setSortOption(event.target.value)} style={styles.select}>
              <option value="newest">Newest</option>
              <option value="purchase">Purchase Price</option>
              <option value="arv">ARV</option>
              <option value="spread">Projected Spread</option>
            </select>
          </div>

          {filteredDeals.length === 0 ? (
            <div style={styles.emptyState}>
              <div>No saved deals available</div>
              <button type="button" style={styles.primaryButton} onClick={onOpenDealIntake}>
                ADD NEW DEAL
              </button>
            </div>
          ) : (
            <>
              <div style={styles.tableWrap}>
                <table style={styles.table}>
                  <thead>
                    <tr>
                      <th style={styles.th}>Address</th>
                      <th style={styles.th}>City</th>
                      <th style={styles.th}>State</th>
                      <th style={styles.th}>Purchase Price</th>
                      <th style={styles.th}>Rehab Budget</th>
                      <th style={styles.th}>ARV</th>
                      <th style={styles.th}>Estimated Rent</th>
                      <th style={styles.th}>Strategy</th>
                      <th style={styles.th}>Status</th>
                      <th style={styles.th}>Created</th>
                      <th style={styles.th}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredDeals.map((deal) => (
                      <tr key={deal.id} style={styles.tr}>
                        <td style={styles.td}>{deal.propertyAddress || deal.address || "Untitled Deal"}</td>
                        <td style={styles.td}>{deal.city || "—"}</td>
                        <td style={styles.td}>{deal.state || "—"}</td>
                        <td style={styles.td}>{formatCurrency(toNumber(deal.purchasePrice))}</td>
                        <td style={styles.td}>{formatCurrency(toNumber(deal.rehabBudget))}</td>
                        <td style={styles.td}>{formatCurrency(toNumber(deal.estimatedArv ?? deal.arv))}</td>
                        <td style={styles.td}>{formatCurrency(toNumber(deal.estimatedRent))}</td>
                        <td style={styles.td}>{deal.strategy || deal.exitStrategy || "—"}</td>
                        <td style={styles.td}>{deal.status || "active"}</td>
                        <td style={styles.td}>{formatDate(deal.createdAt)}</td>
                        <td style={styles.td}>
                          <div style={styles.actionsCell}>
                            <button type="button" style={styles.tableAction} onClick={() => handleView(deal)}>
                              View
                            </button>
                            <button type="button" style={styles.tableAction} onClick={() => onEditDeal(deal)}>
                              Edit
                            </button>
                            <button type="button" style={styles.tableAction} onClick={() => handleDelete(deal)}>
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {selectedDeal ? (
                <div style={styles.detailPanel}>
                  <h3 style={styles.detailTitle}>Deal Details</h3>
                  {aiDecisionInsight ? (
                    <div style={styles.aiInsightCard}>
                      <div style={styles.detailLabel}>AI Decision</div>
                      <div style={styles.detailValue}>{aiDecisionInsight.dealDecision?.recommendedAction || "Insufficient Data"}</div>
                      <div style={styles.detailLabel}>AI Confidence</div>
                      <div style={styles.detailValue}>{aiDecisionInsight.dealDecision?.confidenceLabel || "Insufficient Data"}</div>
                    </div>
                  ) : null}
                  <div style={styles.detailGrid}>
                    {Object.entries({
                      Address: selectedDeal.propertyAddress || selectedDeal.address || "",
                      City: selectedDeal.city || "",
                      State: selectedDeal.state || "",
                      ZIP: selectedDeal.zipCode || selectedDeal.zip || "",
                      PropertyType: selectedDeal.propertyType || "",
                      Bedrooms: selectedDeal.bedrooms || "",
                      Bathrooms: selectedDeal.bathrooms || "",
                      SquareFeet: selectedDeal.squareFeet || "",
                      YearBuilt: selectedDeal.yearBuilt || "",
                      AskingPrice: formatCurrency(toNumber(selectedDeal.askingPrice)),
                      PurchasePrice: formatCurrency(toNumber(selectedDeal.purchasePrice)),
                      RehabBudget: formatCurrency(toNumber(selectedDeal.rehabBudget)),
                      ARV: formatCurrency(toNumber(selectedDeal.estimatedArv ?? selectedDeal.arv)),
                      EstimatedRent: formatCurrency(toNumber(selectedDeal.estimatedRent)),
                      Taxes: formatCurrency(toNumber(selectedDeal.taxes)),
                      Insurance: formatCurrency(toNumber(selectedDeal.insurance)),
                      FinancingCosts: formatCurrency(toNumber(selectedDeal.financingCosts)),
                      ClosingCosts: formatCurrency(toNumber(selectedDeal.closingCosts)),
                      DealScore: `${selectedDealMetrics?.dealScore ? Math.round(selectedDealMetrics.dealScore).toFixed(0) : 0}/100`,
                      ProjectedProfit: formatCurrency(selectedDealMetrics?.projectedProfit ?? 0),
                      MAO: formatCurrency(toNumber(buildUnifiedUnderwritingIntelligence(normalizeDealForIntelligence(selectedDeal), [], []).mao?.maximumOffer || 0)),
                      HoldingMonths: selectedDeal.holdingMonths || "",
                      LeadSource: selectedDeal.leadSource || "",
                      Strategy: selectedDeal.strategy || selectedDeal.exitStrategy || "",
                      Status: selectedDeal.status || "active",
                      Notes: selectedDeal.notes || "",
                    }).map(([label, value]) => (
                      <div key={label} style={styles.detailItem}>
                        <div style={styles.detailLabel}>{label}</div>
                        <div style={styles.detailValue}>{value || "—"}</div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </>
          )}
        </section>
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
    border: `1px solid ${BORDER}`,
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
    border: `1px solid ${BORDER}`,
    boxSizing: "border-box",
  },
  logout: {
    width: "100%",
    minHeight: "34px",
    padding: "7px 10px",
    border: `1px solid ${BORDER}`,
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
    padding: "20px 20px 18px",
    boxSizing: "border-box",
    backgroundColor: BLACK,
  },
  topBar: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "12px",
    marginBottom: "16px",
  },
  backButton: {
    border: `1px solid ${BORDER}`,
    background: "linear-gradient(90deg, #f7d339 0%, #eab90c 100%)",
    color: "#17120a",
    padding: "10px 14px",
    fontWeight: 700,
    cursor: "pointer",
  },
  headingBlock: {
    flex: 1,
    textAlign: "center",
  },
  company: {
    margin: 0,
    fontSize: "22px",
    letterSpacing: "1px",
  },
  subtitle: {
    margin: "4px 0 0",
    fontSize: "12px",
    letterSpacing: "1.4px",
    color: "#f9e27b",
  },
  headerActions: {
    display: "flex",
    gap: "8px",
  },
  primaryButton: {
    border: `1px solid ${BORDER}`,
    background: "linear-gradient(90deg, #f7d339 0%, #eab90c 100%)",
    color: "#17120a",
    padding: "10px 14px",
    fontWeight: 700,
    cursor: "pointer",
  },
  secondaryButton: {
    border: `1px solid ${BORDER}`,
    backgroundColor: "#111111",
    color: GOLD,
    padding: "10px 14px",
    fontWeight: 700,
    cursor: "pointer",
  },
  card: {
    border: `1px solid ${BORDER}`,
    background: "linear-gradient(180deg, #0f0f0f 0%, #171717 100%)",
    padding: "18px",
    boxShadow: `0 0 0 1px ${BORDER} inset`,
  },
  cardHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "12px",
    marginBottom: "16px",
  },
  cardTitle: {
    margin: 0,
    fontSize: "20px",
    letterSpacing: "1px",
  },
  cardSubtitle: {
    margin: "6px 0 0",
    fontSize: "13px",
    color: "#f9e27b",
  },
  connectionBadge: {
    border: `1px solid ${BORDER}`,
    padding: "5px 8px",
    backgroundColor: "#111111",
    color: GOLD,
    fontSize: "11px",
    letterSpacing: "0.8px",
  },
  summaryGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
    gap: "10px",
    marginBottom: "14px",
  },
  summaryCard: {
    border: `1px solid ${BORDER}`,
    backgroundColor: "#111111",
    padding: "10px",
  },
  summaryLabel: {
    fontSize: "11px",
    color: "#f9e27b",
    textTransform: "uppercase",
    letterSpacing: "0.8px",
    marginBottom: "6px",
  },
  summaryValue: {
    fontSize: "14px",
    color: GOLD,
  },
  controlsRow: {
    display: "flex",
    gap: "10px",
    marginBottom: "14px",
    flexWrap: "wrap",
  },
  input: {
    border: `1px solid ${BORDER}`,
    backgroundColor: "#151515",
    color: "#fff7cc",
    padding: "9px 10px",
    fontSize: "13px",
    outline: "none",
    flex: "1 1 220px",
  },
  select: {
    border: `1px solid ${BORDER}`,
    backgroundColor: "#151515",
    color: "#fff7cc",
    padding: "9px 10px",
    fontSize: "13px",
    outline: "none",
    minWidth: "140px",
  },
  emptyState: {
    border: `1px solid ${BORDER}`,
    backgroundColor: "#121212",
    padding: "24px",
    display: "flex",
    flexDirection: "column",
    gap: "12px",
    alignItems: "flex-start",
    color: "#f9e27b",
  },
  tableWrap: {
    overflowX: "auto",
    border: `1px solid ${BORDER}`,
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    backgroundColor: "#0d0d0d",
  },
  th: {
    textAlign: "left",
    padding: "10px 8px",
    borderBottom: `1px solid ${BORDER}`,
    color: GOLD,
    fontSize: "11px",
    textTransform: "uppercase",
    letterSpacing: "0.8px",
  },
  tr: {
    borderBottom: `1px solid #222222`,
  },
  td: {
    padding: "10px 8px",
    borderBottom: `1px solid #222222`,
    fontSize: "12px",
    color: "#f5e68d",
    verticalAlign: "top",
  },
  actionsCell: {
    display: "flex",
    gap: "6px",
    flexWrap: "wrap",
  },
  tableAction: {
    border: `1px solid ${BORDER}`,
    backgroundColor: "#111111",
    color: GOLD,
    padding: "4px 8px",
    fontSize: "10px",
    cursor: "pointer",
  },
  detailPanel: {
    marginTop: "14px",
    border: `1px solid ${BORDER}`,
    backgroundColor: "#121212",
    padding: "14px",
  },
  detailTitle: {
    margin: "0 0 10px",
    fontSize: "16px",
    color: GOLD,
  },
  detailGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: "10px",
  },
  detailItem: {
    border: `1px solid ${BORDER}`,
    backgroundColor: "#0d0d0d",
    padding: "8px",
  },
  detailLabel: {
    fontSize: "10px",
    textTransform: "uppercase",
    color: "#f9e27b",
    marginBottom: "4px",
  },
  detailValue: {
    fontSize: "12px",
    color: "#fff4b8",
  },
};
