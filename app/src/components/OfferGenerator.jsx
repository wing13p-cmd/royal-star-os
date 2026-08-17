import { useEffect, useMemo, useState } from "react";
import logo from "../assets/royal-star-logo.png";
import { buildApiUrl } from "../utils/apiClient.js";
import { getSidebarNavigation } from "../utils/navigationModel.js";
import { useLogoutControl } from "../hooks/useLogoutControl.js";
import { buildUnifiedUnderwritingIntelligence, normalizeDealForIntelligence } from "./intelligenceUpgradeEngine.js";

const navigation = getSidebarNavigation();

function formatCurrency(value) {
  if (!Number.isFinite(value)) return "Insufficient Data";
  return `$${value.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

function formatPercent(value) {
  if (!Number.isFinite(value)) return "Insufficient Data";
  return `${(value * 100).toFixed(1)}%`;
}

function dealLabel(deal = {}) {
  return deal.propertyAddress || deal.address || deal.propertyName || "Untitled Deal";
}

export default function OfferGenerator({ onBackToDealAnalyzer, currentView = "offerGenerator", onNavigate }) {
  const [deals, setDeals] = useState([]);
  const [selectedDealId, setSelectedDealId] = useState("");
  const [connectionState, setConnectionState] = useState("Backend Connected");
  const { logoutEnabled, loggingOut, handleLogout, title: logoutTitle } = useLogoutControl(onBackToDealAnalyzer);

  useEffect(() => {
    let cancelled = false;

    const loadDeals = async () => {
      try {
        const response = await fetch(buildApiUrl("/api/deals"));
        if (!response.ok) throw new Error("Unable to fetch deals");
        const payload = await response.json();
        const loadedDeals = Array.isArray(payload) ? payload : [];
        if (!cancelled) {
          setDeals(loadedDeals);
          setSelectedDealId((previous) => previous || String(loadedDeals[0]?.id ?? ""));
          setConnectionState("Backend Connected");
        }
      } catch (error) {
        console.error("Unable to load Offer Generator deals from API, using localStorage fallback", error);
        if (cancelled || typeof window === "undefined") return;
        try {
          const storedDeals = JSON.parse(window.localStorage.getItem("royalStarDeals") || "[]") || [];
          const loadedDeals = Array.isArray(storedDeals) ? storedDeals : [];
          setDeals(loadedDeals);
          setSelectedDealId((previous) => previous || String(loadedDeals[0]?.id ?? ""));
          setConnectionState("Local Fallback");
        } catch (localError) {
          console.error("Unable to read Offer Generator deals from localStorage", localError);
          setDeals([]);
          setConnectionState("Local Fallback");
        }
      }
    };

    void loadDeals();
    return () => {
      cancelled = true;
    };
  }, []);

  const selectedDeal = useMemo(
    () => deals.find((deal) => String(deal.id) === String(selectedDealId)) || deals[0] || null,
    [deals, selectedDealId],
  );

  const underwriting = useMemo(
    () => selectedDeal ? buildUnifiedUnderwritingIntelligence(normalizeDealForIntelligence(selectedDeal), [], []) : null,
    [selectedDeal],
  );
  const offer = underwriting?.mao || null;
  const assumptions = offer?.assumptions || {};
  const sensitivity = offer?.sensitivity || {};
  const strategy = offer?.strategyOffer?.type || selectedDeal?.strategy || selectedDeal?.exitStrategy || "Insufficient Data";
  const isBrrrr = String(strategy).toLowerCase() === "brrrr";
  const warnings = [
    ...(offer?.missingInformation || []),
    ...(offer?.hardStopReasons || []),
    ...(offer?.reviewReasons || []),
  ];

  const handleSidebarNavigate = (viewKey) => {
    if (!onNavigate || String(viewKey) === String(currentView)) return;
    onNavigate(viewKey);
  };

  return (
    <div style={styles.page}>
      <aside style={styles.sidebar}>
        <div style={styles.logoArea}>
          <img src={logo} alt="Royal Star Properties" style={styles.logo} />
        </div>
        <nav style={styles.nav}>
          {navigation.map((item) => (
            <button key={item.id} type="button" style={styles.navButton} onClick={() => handleSidebarNavigate(item.viewKey)}>
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
          >
            <span style={styles.navIcon}>↪</span>
            <span>LOG OUT</span>
          </button>
        </nav>
        <div style={styles.smallMark}>RS★</div>
      </aside>

      <main style={styles.main}>
        <section style={styles.topBar}>
          <button type="button" style={styles.backButton} onClick={onBackToDealAnalyzer}>
            ◀ DEAL ANALYZER
          </button>
          <div style={styles.headingBlock}>
            <h1 style={styles.company}>ROYAL STAR PROPERTIES, LLC</h1>
            <p style={styles.subtitle}>OFFER GENERATOR / UNDERWRITING OFFER RANGE</p>
          </div>
          <div style={styles.connectionBadge}>{connectionState}</div>
        </section>

        <section style={styles.card}>
          <div style={styles.cardHeader}>
            <div>
              <h2 style={styles.cardTitle}>OFFER GENERATOR</h2>
              <p style={styles.cardSubtitle}>Offer guidance calculated from the selected saved deal and shared Royal Star underwriting engine.</p>
            </div>
          </div>

          <select value={selectedDealId} onChange={(event) => setSelectedDealId(event.target.value)} style={styles.select}>
            <option value="">Select a saved deal</option>
            {deals.map((deal) => <option key={deal.id} value={deal.id}>{dealLabel(deal)}</option>)}
          </select>

          {!selectedDeal || !offer ? (
            <div style={styles.emptyState}>Select or save a deal in Deal Intake to generate an underwriting-driven offer range.</div>
          ) : (
            <>
              <div style={styles.summaryGrid}>
                <SummaryCard label="Strategy" value={String(strategy).toUpperCase()} />
                <SummaryCard label="Current Purchase / Asking Price" value={formatCurrency(offer.currentPurchasePrice)} />
                <SummaryCard label="Maximum Allowable Offer" value={formatCurrency(offer.maximumOffer)} />
                <SummaryCard label="Target Offer" value={formatCurrency(offer.targetOffer)} />
                <SummaryCard label="Opening Offer" value={formatCurrency(offer.initialOffer)} />
                <SummaryCard label="Walk-Away Price" value={formatCurrency(offer.walkAwayPrice)} />
                <SummaryCard label="Difference to Target" value={formatCurrency(offer.differenceToTarget)} />
                <SummaryCard label="Difference to Walk-Away" value={formatCurrency(offer.differenceToWalkAway)} />
                <SummaryCard label="Buy Box" value={offer.buyBoxStatus || "Insufficient Data"} />
                <SummaryCard label="Recommendation" value={offer.recommendation || "Insufficient Data"} />
              </div>

              <div style={styles.gridTwo}>
                <section style={styles.section}>
                  <h3 style={styles.sectionTitle}>UNDERWRITING INPUTS</h3>
                  <Detail label="ARV" value={formatCurrency(sensitivity.base?.arv)} />
                  <Detail label="Rehab Budget" value={formatCurrency(Number(selectedDeal.rehabBudget))} />
                  <Detail label="Closing Costs" value={formatCurrency(Number(selectedDeal.closingCosts || 0))} />
                  <Detail label="Financing Costs" value={formatCurrency(Number(selectedDeal.financingCosts || 0))} />
                  <Detail label="Holding Months" value={String(assumptions.holdingMonths ?? 0)} />
                  <Detail label="Explicit Holding Costs" value={formatCurrency(assumptions.explicitHoldingCosts)} />
                  {assumptions.holdingCostSource === "none" ? <div style={styles.info}>Holding months are informational; no holding cost is added without entered cost data.</div> : null}
                  {!isBrrrr ? <Detail label="Selling Costs" value={formatCurrency(assumptions.sellingCosts)} /> : null}
                  {!isBrrrr ? <Detail label="Required Profit" value={formatCurrency(assumptions.requiredProfitDollars)} /> : null}
                  {isBrrrr ? <Detail label="Refinance LTV" value={formatPercent(assumptions.refinanceLtv)} /> : null}
                  {isBrrrr ? <Detail label="Target Cash Left in Deal" value={formatCurrency(assumptions.targetCashLeftInDeal)} /> : null}
                </section>

                <section style={styles.section}>
                  <h3 style={styles.sectionTitle}>ARV SENSITIVITY</h3>
                  <Detail label="Best / Upside ARV" value={`${formatCurrency(sensitivity.best?.arv)} / MAO ${formatCurrency(sensitivity.best?.maximumAllowableOffer)}`} />
                  <Detail label="Base ARV" value={`${formatCurrency(sensitivity.base?.arv)} / MAO ${formatCurrency(sensitivity.base?.maximumAllowableOffer)}`} />
                  <Detail label="Downside ARV" value={`${formatCurrency(sensitivity.worst?.arv)} / MAO ${formatCurrency(sensitivity.worst?.maximumAllowableOffer)}`} />
                  {warnings.length ? warnings.map((warning) => <div key={warning} style={styles.warning}>{warning}</div>) : <div style={styles.good}>No active offer guard warnings.</div>}
                </section>
              </div>

              <section style={styles.section}>
                <h3 style={styles.sectionTitle}>CALCULATION EXPLANATION</h3>
                <div style={styles.breakdownGrid}>
                  {(offer.calculationBreakdown || []).map((entry) => (
                    <Detail key={entry.label} label={entry.label} value={formatCurrency(entry.amount)} />
                  ))}
                </div>
                <div style={styles.reason}>{offer.offerDecision?.controllingReason || "Insufficient Data"}</div>
              </section>
            </>
          )}
        </section>
      </main>
    </div>
  );
}

function SummaryCard({ label, value }) {
  return <div style={styles.summaryCard}><div style={styles.summaryLabel}>{label}</div><div style={styles.summaryValue}>{value}</div></div>;
}

function Detail({ label, value }) {
  return <div style={styles.detail}><span style={styles.detailLabel}>{label}</span><span>{value}</span></div>;
}

const GOLD = "#f2c500";
const BLACK = "#050505";
const BORDER = "#c89f00";

const styles = {
  page: { minHeight: "100vh", width: "100%", display: "flex", overflow: "hidden", backgroundColor: BLACK, color: GOLD, fontFamily: "Arial, Helvetica, sans-serif", fontWeight: 700 },
  sidebar: { flex: "0 0 178px", minHeight: "100vh", padding: "18px 0 10px", boxSizing: "border-box", backgroundColor: BLACK, display: "flex", flexDirection: "column", position: "relative" },
  logoArea: { display: "flex", justifyContent: "center", padding: "0 12px 18px" },
  logo: { width: "142px", maxWidth: "100%", display: "block" },
  nav: { display: "flex", flexDirection: "column", gap: "4px", paddingBottom: "66px" },
  navButton: { position: "relative", display: "grid", gridTemplateColumns: "25px 1fr", alignItems: "center", gap: "8px", width: "100%", minHeight: "36px", border: "none", backgroundColor: "transparent", color: GOLD, padding: "7px 18px", textAlign: "left", fontSize: "11px", fontWeight: 700, cursor: "pointer" },
  navIcon: { fontSize: "14px", textAlign: "center" },
  navTab: { position: "absolute", right: 0, width: "3px", height: "100%", backgroundColor: GOLD, opacity: 0.65 },
  logout: { display: "grid", gridTemplateColumns: "25px 1fr", alignItems: "center", gap: "8px", border: "none", backgroundColor: "transparent", color: GOLD, padding: "12px 18px", textAlign: "left", fontSize: "11px", fontWeight: 700, cursor: "pointer" },
  logoutDisabled: { cursor: "not-allowed", opacity: 0.45 },
  smallMark: { position: "absolute", bottom: "15px", left: "18px", border: `1px solid ${BORDER}`, padding: "5px 8px", fontSize: "10px" },
  main: { flex: 1, minWidth: 0, padding: "22px", overflowY: "auto", background: "radial-gradient(circle at top, #171717 0%, #080808 45%, #020202 100%)" },
  topBar: { display: "flex", alignItems: "center", gap: "16px", borderBottom: `1px solid ${BORDER}`, paddingBottom: "14px", marginBottom: "16px" },
  backButton: { border: `1px solid ${BORDER}`, background: "linear-gradient(90deg, #f7d339 0%, #eab90c 100%)", color: "#17120a", padding: "10px 14px", fontWeight: 700, cursor: "pointer" },
  headingBlock: { flex: 1, textAlign: "center" },
  company: { margin: 0, fontSize: "22px", letterSpacing: "1px" },
  subtitle: { margin: "4px 0 0", fontSize: "12px", letterSpacing: "1.4px", color: "#f9e27b" },
  connectionBadge: { border: `1px solid ${BORDER}`, padding: "5px 8px", backgroundColor: "#111111", color: GOLD, fontSize: "11px" },
  card: { border: `1px solid ${BORDER}`, background: "linear-gradient(180deg, #0f0f0f 0%, #171717 100%)", padding: "18px", boxShadow: `0 0 0 1px ${BORDER} inset` },
  cardHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" },
  cardTitle: { margin: 0, fontSize: "20px", letterSpacing: "1px" },
  cardSubtitle: { margin: "6px 0 0", fontSize: "13px", color: "#f9e27b" },
  select: { width: "100%", maxWidth: "520px", border: `1px solid ${BORDER}`, backgroundColor: "#050505", color: GOLD, padding: "10px", marginBottom: "16px", fontWeight: 700 },
  emptyState: { border: `1px solid ${BORDER}`, padding: "24px", textAlign: "center", color: "#f9e27b" },
  info: { marginTop: "8px", color: "#f9e27b", fontSize: "11px", lineHeight: 1.4 },
  summaryGrid: { display: "grid", gridTemplateColumns: "repeat(5, minmax(0, 1fr))", gap: "10px", marginBottom: "16px" },
  summaryCard: { border: `1px solid ${BORDER}`, backgroundColor: "#111111", padding: "10px", minHeight: "58px" },
  summaryLabel: { fontSize: "10px", color: "#f9e27b", textTransform: "uppercase", marginBottom: "8px" },
  summaryValue: { fontSize: "16px" },
  gridTwo: { display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "14px" },
  section: { border: `1px solid ${BORDER}`, backgroundColor: "#0b0b0b", padding: "14px", marginBottom: "14px" },
  sectionTitle: { margin: "0 0 12px", fontSize: "14px", letterSpacing: "1px" },
  detail: { display: "flex", justifyContent: "space-between", gap: "14px", padding: "8px 0", borderBottom: "1px solid rgba(200, 159, 0, 0.28)" },
  detailLabel: { color: "#f9e27b", fontSize: "11px", textTransform: "uppercase" },
  breakdownGrid: { display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "0 18px" },
  warning: { color: "#ffb347", padding: "7px 0", fontSize: "12px" },
  good: { color: "#f9e27b", padding: "7px 0", fontSize: "12px" },
  reason: { marginTop: "12px", color: "#f9e27b", fontSize: "12px" },
};
