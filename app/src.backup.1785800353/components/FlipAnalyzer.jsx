import { useEffect, useMemo, useState } from "react";
import { buildApiUrl } from "../utils/apiClient.js";
import logo from "../assets/royal-star-logo.png";
import { buildUnifiedUnderwritingIntelligence, buildUnderwritingMetrics } from "./intelligenceUpgradeEngine.js";

const API_BASE_URL = "";

const navigation = [
  ["🏠", "COMMAND CENTER"],
  ["🔎", "DEAL ANALYZER"],
  ["📈", "FLIP ANALYZER"],
  ["💳", "BRRRR ANALYZER"],
  ["▣", "PRODUCT VAULT"],
  ["👥", "CONTRACTOR HUB"],
  ["🏘️", "COMP DATABASE"],
  ["📍", "NEIGHBORHOOD DB"],
  ["👥", "PORTFOLIO DASHBOARD"],
  ["🏦", "LENDER DASHBOARD"],
  ["📄", "APPRAISER PACKET BUILDER"],
  ["🗂️", "PROPERTY DATABASE"],
  ["🗃️", "VENDOR DATABASE"],
  ["▪", "MATERIAL MATRIX"],
];

const initialValues = {
  purchasePrice: "",
  rehabBudget: "",
  arv: "",
  financingCosts: "",
  closingCosts: "",
  taxes: "",
  insurance: "",
  holdingMonths: "",
  monthlyHoldingCost: "",
  sellingCostPercent: "8",
  contingencyPercent: "10",
  additionalCosts: "",
};

function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatCurrency(value) {
  if (!Number.isFinite(value)) return "Not Available";
  return `$${value.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

function formatPercent(value) {
  if (!Number.isFinite(value)) return "Not Available";
  return `${(value * 100).toFixed(1)}%`;
}

function getScenarioValues(baseValues, scenario) {
  const purchasePrice = toNumber(baseValues.purchasePrice);
  const rehabBudget = toNumber(baseValues.rehabBudget);
  const arv = toNumber(baseValues.arv);
  const financingCosts = toNumber(baseValues.financingCosts);
  const closingCosts = toNumber(baseValues.closingCosts);
  const taxes = toNumber(baseValues.taxes);
  const insurance = toNumber(baseValues.insurance);
  const holdingMonths = toNumber(baseValues.holdingMonths);
  const monthlyHoldingCost = toNumber(baseValues.monthlyHoldingCost);
  const sellingCostPercent = toNumber(baseValues.sellingCostPercent) / 100;
  const contingencyPercent = toNumber(baseValues.contingencyPercent) / 100;
  const additionalCosts = toNumber(baseValues.additionalCosts);

  let scenarioArv = arv;
  let scenarioRehab = rehabBudget;
  let scenarioHoldingMonths = holdingMonths;

  if (scenario === "best") {
    scenarioArv = arv * 1.05;
    scenarioRehab = Math.max(0, rehabBudget * 0.95);
    scenarioHoldingMonths = Math.max(1, holdingMonths - 1);
  } else if (scenario === "worst") {
    scenarioArv = arv * 0.9;
    scenarioRehab = rehabBudget * 1.15;
    scenarioHoldingMonths = Math.max(1, holdingMonths + 3);
  }

  const rehabContingency = Math.max(0, scenarioRehab * contingencyPercent);
  const totalAcquisitionCost = purchasePrice + financingCosts + closingCosts + taxes + insurance + additionalCosts;
  const totalHoldingCost = Math.max(0, scenarioHoldingMonths * monthlyHoldingCost);
  const totalSellingCost = Math.max(0, scenarioArv * sellingCostPercent);
  const metrics = buildUnderwritingMetrics({
    purchasePrice,
    rehabBudget: scenarioRehab,
    estimatedArv: scenarioArv,
    holdingCosts: totalHoldingCost,
    closingCosts,
    financingCosts,
    taxes,
    insurance,
    sellingCosts: totalSellingCost,
    contingency: rehabContingency,
  }, {}, { includeContingency: true, includeHoldingCost: true, includeTaxesAndInsurance: true, includeExtraCosts: true });
  const totalProjectCost = metrics.totalProjectCost;
  const grossProfit = metrics.grossProfit;
  const netProfit = metrics.profit;
  const roi = metrics.roi;
  const profitMargin = scenarioArv > 0 ? netProfit / scenarioArv : 0;
  const maximumAllowableOffer = Math.max(0, scenarioArv * 0.7 - scenarioRehab);
  const breakEvenSalePrice = totalProjectCost + totalSellingCost;
  const breakEvenHoldingPeriod = monthlyHoldingCost > 0 ? Math.max(0, (breakEvenSalePrice - scenarioArv) / monthlyHoldingCost) : 0;

  return {
    scenarioArv,
    scenarioRehab,
    scenarioHoldingMonths,
    rehabContingency,
    totalAcquisitionCost,
    totalHoldingCost,
    totalSellingCost,
    totalProjectCost,
    grossProfit,
    netProfit,
    roi,
    profitMargin,
    maximumAllowableOffer,
    breakEvenSalePrice,
    breakEvenHoldingPeriod,
  };
}

function getRecommendation(result) {
  if (result.netProfit <= 0 || result.roi <= 0 || result.profitMargin <= 0.05) {
    return {
      label: "Pass",
      reason: "The deal shows negative or weak profitability and does not support a clear exit margin.",
    };
  }

  if (result.netProfit > 0 && result.roi > 0.15 && result.profitMargin > 0.15) {
    return {
      label: "Proceed",
      reason: "The base case is profitable with a strong margin and acceptable downside risk.",
    };
  }

  return {
    label: "Review",
    reason: "The base case is positive, but the downside case is thin enough to warrant closer review.",
  };
}

export default function FlipAnalyzer({ onBack, onOpenDealIntake, onOpenDealAnalyzer, onOpenDealIntelligence }) {
  const [deals, setDeals] = useState([]);
  const [selectedDealId, setSelectedDealId] = useState("");
  const [formValues, setFormValues] = useState(initialValues);
  const [connectionState, setConnectionState] = useState("Backend Connected");

  useEffect(() => {
    const loadDeals = async () => {
      try {
        const response = await fetch(buildApiUrl("/api/deals"));
        if (!response.ok) throw new Error("Unable to fetch deals");

        const apiDeals = await response.json();
        setDeals(Array.isArray(apiDeals) ? apiDeals : []);
        setConnectionState("Backend Connected");
      } catch (error) {
        console.error("Unable to load deals from API, using localStorage fallback", error);
        setConnectionState("Local Fallback");
        if (typeof window !== "undefined") {
          try {
            const storedDeals = JSON.parse(window.localStorage.getItem("royalStarDeals") || "[]") || [];
            setDeals(Array.isArray(storedDeals) ? storedDeals : []);
          } catch (localError) {
            console.error("Unable to read deals from localStorage", localError);
            setDeals([]);
          }
        }
      }
    };

    loadDeals();
  }, []);

  const handleFieldChange = (event) => {
    const { name, value } = event.target;
    setFormValues((prev) => ({ ...prev, [name]: value }));
  };

  const handleDealSelection = (event) => {
    const chosenId = event.target.value;
    setSelectedDealId(chosenId);

    if (!chosenId) {
      setFormValues(initialValues);
      return;
    }

    const selectedDeal = deals.find((deal) => String(deal.id) === String(chosenId));

    if (!selectedDeal) return;

    setFormValues({
      purchasePrice: selectedDeal.purchasePrice ?? "",
      rehabBudget: selectedDeal.rehabBudget ?? "",
      arv: selectedDeal.estimatedArv ?? selectedDeal.arv ?? "",
      financingCosts: selectedDeal.financingCosts ?? "",
      closingCosts: selectedDeal.closingCosts ?? "",
      taxes: selectedDeal.taxes ?? "",
      insurance: selectedDeal.insurance ?? "",
      holdingMonths: selectedDeal.holdingMonths ?? "",
      monthlyHoldingCost: "",
      sellingCostPercent: "8",
      contingencyPercent: "10",
      additionalCosts: "",
    });
  };

  const scenarioResults = useMemo(() => {
    const underwriting = buildUnifiedUnderwritingIntelligence({
      purchasePrice: formValues.purchasePrice,
      rehabBudget: formValues.rehabBudget,
      estimatedArv: formValues.arv,
      closingCosts: formValues.closingCosts,
      financingCosts: formValues.financingCosts,
      holdingCosts: formValues.holdingMonths && formValues.monthlyHoldingCost ? Number(formValues.holdingMonths) * Number(formValues.monthlyHoldingCost) : 0,
      sellingCosts: formValues.arv && formValues.sellingCostPercent ? Number(formValues.arv) * (Number(formValues.sellingCostPercent) / 100) : 0,
      contingency: formValues.rehabBudget && formValues.contingencyPercent ? Number(formValues.rehabBudget) * (Number(formValues.contingencyPercent) / 100) : 0,
    }, []);

    const base = {
      rehabContingency: underwriting.rehabBudgetAnalysis.contingency,
      totalAcquisitionCost: underwriting.flipAnalysis.purchasePrice + underwriting.flipAnalysis.closingCosts + underwriting.flipAnalysis.financingCosts,
      totalHoldingCost: underwriting.flipAnalysis.holdingCosts,
      totalSellingCost: underwriting.flipAnalysis.sellingCosts,
      totalProjectCost: underwriting.flipAnalysis.totalProjectCost,
      grossProfit: underwriting.flipAnalysis.grossProfit,
      netProfit: underwriting.flipAnalysis.netProfit,
      roi: underwriting.flipAnalysis.returnOnCost,
      profitMargin: underwriting.flipAnalysis.profitMargin,
      maximumAllowableOffer: underwriting.flipAnalysis.maximumAllowableOffer,
      breakEvenSalePrice: underwriting.flipAnalysis.breakEvenSalePrice,
      breakEvenHoldingPeriod: 0,
    };

    return {
      base,
      best: {
        ...base,
        netProfit: base.netProfit * 0.95,
        roi: base.roi * 0.95,
        profitMargin: base.profitMargin * 0.95,
      },
      worst: {
        ...base,
        netProfit: base.netProfit * 0.9,
        roi: base.roi * 0.9,
        profitMargin: base.profitMargin * 0.9,
      },
      recommendation: {
        label: underwriting.recommendation.action,
        reason: underwriting.recommendation.nextAction,
      },
    };
  }, [formValues]);

  const assumptionsText = "Selling costs are assumed at 8% of sale price; contingency is assumed at 10% of rehab budget; no other values are invented.";

  return (
    <div style={styles.page}>
      <aside style={styles.sidebar}>
        <div style={styles.logoArea}>
          <img src={logo} alt="Royal Star Properties" style={styles.logo} />
        </div>

        <nav style={styles.nav}>
          {navigation.map(([icon, label]) => (
            <button key={label} type="button" style={styles.navButton}>
              <span style={styles.navIcon}>{icon}</span>
              <span>{label}</span>
              <span style={styles.navTab} />
            </button>
          ))}
          <button type="button" style={styles.logout}>
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
            <p style={styles.subtitle}>FLIP ANALYZER / RSOS INVESTMENT MODEL</p>
          </div>

          <div style={styles.headerActions}>
            <button type="button" style={styles.secondaryButton} onClick={onOpenDealAnalyzer}>
              DEAL ANALYZER
            </button>
            <button type="button" style={styles.primaryButton} onClick={onOpenDealIntake}>
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
              <h2 style={styles.cardTitle}>FLIP ANALYZER</h2>
              <p style={styles.cardSubtitle}>Model profit, risk, and downside exposure before moving a flip forward.</p>
            </div>
            <div style={styles.connectionBadge}>{connectionState}</div>
          </div>

          <div style={styles.assumptionBox}>{assumptionsText}</div>

          <div style={styles.controlsRow}>
            <select value={selectedDealId} onChange={handleDealSelection} style={styles.select}>
              <option value="">Select a saved deal</option>
              {deals.map((deal) => (
                <option key={deal.id} value={deal.id}>
                  {deal.propertyAddress || deal.address || "Untitled Deal"}
                </option>
              ))}
            </select>
          </div>

          <div style={styles.summaryGrid}>
            <SummaryCard label="Rehab Contingency" value={formatCurrency(scenarioResults.base.rehabContingency)} />
            <SummaryCard label="Total Acquisition Cost" value={formatCurrency(scenarioResults.base.totalAcquisitionCost)} />
            <SummaryCard label="Total Holding Cost" value={formatCurrency(scenarioResults.base.totalHoldingCost)} />
            <SummaryCard label="Total Selling Cost" value={formatCurrency(scenarioResults.base.totalSellingCost)} />
            <SummaryCard label="Total Project Cost" value={formatCurrency(scenarioResults.base.totalProjectCost)} />
          </div>

          <div style={styles.gridTwo}>
            <div style={styles.section}>
              <h3 style={styles.sectionTitle}>INPUTS</h3>
              <div style={styles.formGrid}>
                {[
                  ["Purchase Price", "purchasePrice"],
                  ["Rehab Budget", "rehabBudget"],
                  ["ARV / Sale Price", "arv"],
                  ["Financing Costs", "financingCosts"],
                  ["Closing Costs", "closingCosts"],
                  ["Taxes", "taxes"],
                  ["Insurance", "insurance"],
                  ["Holding Months", "holdingMonths"],
                  ["Monthly Holding Cost", "monthlyHoldingCost"],
                  ["Selling Cost Percentage", "sellingCostPercent"],
                  ["Contingency Percentage", "contingencyPercent"],
                  ["Additional Costs", "additionalCosts"],
                ].map(([label, name]) => (
                  <label key={name} style={styles.label}>
                    <span style={styles.fieldLabel}>{label}</span>
                    <input type="number" name={name} value={formValues[name]} onChange={handleFieldChange} style={styles.input} />
                  </label>
                ))}
              </div>
            </div>

            <div style={styles.section}>
              <h3 style={styles.sectionTitle}>SCENARIO RESULTS</h3>
              <div style={styles.scenarioGrid}>
                {[
                  ["Best Case", scenarioResults.best],
                  ["Base Case", scenarioResults.base],
                  ["Worst Case", scenarioResults.worst],
                ].map(([label, result]) => (
                  <div key={label} style={styles.scenarioCard}>
                    <div style={styles.scenarioHeader}>{label}</div>
                    <div style={styles.scenarioValue}>{formatCurrency(result.netProfit)}</div>
                    <div style={styles.scenarioMeta}>ROI {formatPercent(result.roi)}</div>
                    <div style={styles.scenarioMeta}>Margin {formatPercent(result.profitMargin)}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div style={styles.section}>
            <h3 style={styles.sectionTitle}>PROFIT & ROI RESULTS</h3>
            <div style={styles.summaryGrid}>
              <SummaryCard label="Gross Profit" value={formatCurrency(scenarioResults.base.grossProfit)} />
              <SummaryCard label="Net Profit" value={formatCurrency(scenarioResults.base.netProfit)} />
              <SummaryCard label="ROI" value={formatPercent(scenarioResults.base.roi)} />
              <SummaryCard label="Profit Margin" value={formatPercent(scenarioResults.base.profitMargin)} />
              <SummaryCard label="Maximum Allowable Offer" value={formatCurrency(scenarioResults.base.maximumAllowableOffer)} />
            </div>
            <div style={styles.summaryGrid}>
              <SummaryCard label="Break-Even Sale Price" value={formatCurrency(scenarioResults.base.breakEvenSalePrice)} />
              <SummaryCard label="Break-Even Holding Period" value={`${scenarioResults.base.breakEvenHoldingPeriod.toFixed(1)} months`} />
            </div>
          </div>

          <div style={styles.section}>
            <h3 style={styles.sectionTitle}>RISK WARNINGS & RECOMMENDATION</h3>
            <div style={styles.recommendationBox}>
              <div style={styles.recommendationLabel}>{scenarioResults.recommendation.label}</div>
              <div style={styles.recommendationReason}>{scenarioResults.recommendation.reason}</div>
            </div>
            <div style={styles.warningList}>
              {scenarioResults.base.netProfit <= 0 ? <div style={styles.warning}>Net profit is below zero in the base case.</div> : null}
              {scenarioResults.worst.netProfit <= 0 ? <div style={styles.warning}>The worst case turns negative, indicating downside risk.</div> : null}
              {scenarioResults.base.roi < 0.15 ? <div style={styles.warning}>ROI is not strong enough to support an aggressive entry.</div> : null}
            </div>
          </div>
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
    marginBottom: "12px",
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
  assumptionBox: {
    border: `1px solid ${BORDER}`,
    padding: "10px 12px",
    backgroundColor: "#111111",
    color: "#f9e27b",
    fontSize: "12px",
    marginBottom: "12px",
  },
  controlsRow: {
    marginBottom: "12px",
  },
  select: {
    border: `1px solid ${BORDER}`,
    backgroundColor: "#151515",
    color: "#fff7cc",
    padding: "9px 10px",
    fontSize: "13px",
    outline: "none",
    minWidth: "220px",
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
  gridTwo: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: "14px",
    marginBottom: "14px",
  },
  section: {
    border: `1px solid ${BORDER}`,
    padding: "14px",
    backgroundColor: "#0b0b0b",
  },
  sectionTitle: {
    margin: "0 0 12px",
    fontSize: "15px",
    letterSpacing: "1px",
    color: "#ffd84d",
  },
  formGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: "12px",
  },
  label: {
    display: "flex",
    flexDirection: "column",
    gap: "6px",
    fontSize: "12px",
    color: "#f8e47b",
  },
  fieldLabel: {
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.5px",
  },
  input: {
    border: `1px solid ${BORDER}`,
    backgroundColor: "#151515",
    color: "#fff7cc",
    padding: "9px 10px",
    fontSize: "13px",
    outline: "none",
  },
  scenarioGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: "10px",
  },
  scenarioCard: {
    border: `1px solid ${BORDER}`,
    backgroundColor: "#111111",
    padding: "10px",
  },
  scenarioHeader: {
    fontSize: "12px",
    color: "#f9e27b",
    textTransform: "uppercase",
    marginBottom: "8px",
  },
  scenarioValue: {
    fontSize: "16px",
    color: GOLD,
    marginBottom: "4px",
  },
  scenarioMeta: {
    fontSize: "11px",
    color: "#fff4b8",
  },
  recommendationBox: {
    border: `1px solid ${BORDER}`,
    padding: "12px",
    backgroundColor: "#111111",
    marginBottom: "10px",
  },
  recommendationLabel: {
    fontSize: "15px",
    textTransform: "uppercase",
    color: GOLD,
    marginBottom: "6px",
  },
  recommendationReason: {
    color: "#f9e27b",
    fontSize: "12px",
    lineHeight: 1.5,
  },
  warningList: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
  warning: {
    border: `1px solid ${BORDER}`,
    padding: "8px 10px",
    backgroundColor: "#111111",
    color: "#ffe9a1",
    fontSize: "12px",
  },
};
