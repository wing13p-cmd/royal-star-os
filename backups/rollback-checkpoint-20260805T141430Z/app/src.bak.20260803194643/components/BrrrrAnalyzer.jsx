import { useEffect, useMemo, useState } from "react";
import { buildApiUrl } from "../utils/apiClient.js";
import logo from "../assets/royal-star-logo.png";
import { buildUnifiedUnderwritingIntelligence } from "./intelligenceUpgradeEngine.js";

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
  closingCosts: "",
  financingCosts: "",
  initialCashInvested: "",
  refinanceLtvPercent: "75",
  refinanceInterestRate: "",
  refinanceLoanTermYears: "30",
  refinanceClosingCosts: "",
  monthlyRent: "",
  otherMonthlyIncome: "",
  annualPropertyTaxes: "",
  annualInsurance: "",
  monthlyHoa: "",
  vacancyPercent: "5",
  maintenancePercent: "5",
  capexPercent: "5",
  propertyManagementPercent: "8",
  monthlyUtilities: "",
  otherMonthlyExpenses: "",
};

function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function positiveNumber(value) {
  return Math.max(0, toNumber(value));
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
  const purchasePrice = positiveNumber(baseValues.purchasePrice);
  const rehabBudget = positiveNumber(baseValues.rehabBudget);
  const arv = positiveNumber(baseValues.arv);
  const closingCosts = positiveNumber(baseValues.closingCosts);
  const financingCosts = positiveNumber(baseValues.financingCosts);
  const initialCashInvested = positiveNumber(baseValues.initialCashInvested);
  const refinanceClosingCosts = positiveNumber(baseValues.refinanceClosingCosts);
  const monthlyRent = positiveNumber(baseValues.monthlyRent);
  const otherMonthlyIncome = positiveNumber(baseValues.otherMonthlyIncome);
  const annualPropertyTaxes = positiveNumber(baseValues.annualPropertyTaxes);
  const annualInsurance = positiveNumber(baseValues.annualInsurance);
  const monthlyHoa = positiveNumber(baseValues.monthlyHoa);
  const monthlyUtilities = positiveNumber(baseValues.monthlyUtilities);
  const otherMonthlyExpenses = positiveNumber(baseValues.otherMonthlyExpenses);
  const refinanceLtvPercent = Math.max(0, toNumber(baseValues.refinanceLtvPercent) / 100);
  const refinanceInterestRate = Math.max(0, toNumber(baseValues.refinanceInterestRate) / 100);
  const refinanceLoanTermYears = Math.max(0, toNumber(baseValues.refinanceLoanTermYears));
  const vacancyPercent = Math.max(0, toNumber(baseValues.vacancyPercent) / 100);
  const maintenancePercent = Math.max(0, toNumber(baseValues.maintenancePercent) / 100);
  const capexPercent = Math.max(0, toNumber(baseValues.capexPercent) / 100);
  const propertyManagementPercent = Math.max(0, toNumber(baseValues.propertyManagementPercent) / 100);

  let scenarioArv = arv;
  let scenarioRent = monthlyRent;
  let scenarioRehab = rehabBudget;
  let scenarioRate = refinanceInterestRate;
  let scenarioVacancy = vacancyPercent;

  if (scenario === "best") {
    scenarioArv = arv * 1.05;
    scenarioRent = monthlyRent * 1.05;
    scenarioRehab = Math.max(0, rehabBudget * 0.95);
    scenarioRate = Math.max(0, refinanceInterestRate - 0.005);
  } else if (scenario === "worst") {
    scenarioArv = Math.max(0, arv * 0.9);
    scenarioRent = Math.max(0, monthlyRent * 0.9);
    scenarioRehab = rehabBudget * 1.15;
    scenarioRate = refinanceInterestRate + 0.01;
    scenarioVacancy = Math.min(0.5, vacancyPercent + 0.05);
  }

  const totalProjectCost = purchasePrice + scenarioRehab + closingCosts + financingCosts + initialCashInvested;
  const maxLoanBasedOnLtv = scenarioArv * refinanceLtvPercent;
  const refinanceLoanAmount = maxLoanBasedOnLtv;
  const refinanceClosingCostAmount = refinanceClosingCosts;
  const monthlyPrincipalAndInterest = getMonthlyPayment(refinanceLoanAmount, scenarioRate, refinanceLoanTermYears);
  const monthlyGrossIncome = scenarioRent + otherMonthlyIncome;
  const vacancyExpense = monthlyGrossIncome * scenarioVacancy;
  const maintenanceExpense = monthlyGrossIncome * maintenancePercent;
  const capexExpense = monthlyGrossIncome * capexPercent;
  const propertyManagementExpense = monthlyGrossIncome * propertyManagementPercent;
  const monthlyOperatingExpenses = annualPropertyTaxes / 12 + annualInsurance / 12 + monthlyHoa + monthlyUtilities + otherMonthlyExpenses + vacancyExpense + maintenanceExpense + capexExpense + propertyManagementExpense;
  const netOperatingIncome = monthlyGrossIncome - monthlyOperatingExpenses;
  const monthlyCashFlow = netOperatingIncome - monthlyPrincipalAndInterest;
  const annualCashFlow = monthlyCashFlow * 12;
  const dscr = monthlyGrossIncome > 0 ? (netOperatingIncome + monthlyPrincipalAndInterest) / monthlyPrincipalAndInterest : 0;
  const cashRecoveredAtRefinance = refinanceLoanAmount - refinanceClosingCostAmount;
  const cashLeftInDeal = Math.max(0, cashRecoveredAtRefinance - (purchasePrice + scenarioRehab + closingCosts + financingCosts + initialCashInvested));
  const equityCreated = cashRecoveredAtRefinance - (purchasePrice + scenarioRehab + closingCosts + financingCosts + initialCashInvested);
  const cashOnCashReturn = initialCashInvested > 0 ? annualCashFlow / initialCashInvested : 0;
  const returnOnTotalCost = totalProjectCost > 0 ? annualCashFlow / totalProjectCost : 0;
  const rentToCostRatio = totalProjectCost > 0 ? monthlyRent / totalProjectCost : 0;
  const breakEvenOccupancy = monthlyOperatingExpenses > 0 ? monthlyOperatingExpenses / Math.max(monthlyGrossIncome, 1) : 0;

  return {
    totalProjectCost,
    refinanceLoanAmount,
    maxLoanBasedOnLtv,
    monthlyPrincipalAndInterest,
    monthlyGrossIncome,
    vacancyExpense,
    maintenanceExpense,
    capexExpense,
    propertyManagementExpense,
    monthlyOperatingExpenses,
    netOperatingIncome,
    monthlyCashFlow,
    annualCashFlow,
    dscr,
    cashRecoveredAtRefinance,
    cashLeftInDeal,
    equityCreated,
    cashOnCashReturn,
    returnOnTotalCost,
    rentToCostRatio,
    breakEvenOccupancy,
    scenarioArv,
    scenarioRent,
    scenarioRehab,
    scenarioRate,
    scenarioVacancy,
  };
}

function getMonthlyPayment(loanAmount, annualRate, years) {
  if (!loanAmount || !years) return 0;
  const monthlyRate = annualRate / 12;
  const numberOfPayments = years * 12;

  if (monthlyRate <= 0) {
    return loanAmount / numberOfPayments;
  }

  const factor = Math.pow(1 + monthlyRate, numberOfPayments);
  return (loanAmount * monthlyRate * factor) / (factor - 1);
}

function getRecommendation(result) {
  const positiveCashFlow = result.monthlyCashFlow > 0;
  const dscrAtTarget = result.dscr >= 1.2;
  const strongEquity = result.equityCreated > 0 && result.equityCreated > result.totalProjectCost * 0.2;
  const acceptableCashLeft = result.cashLeftInDeal <= result.totalProjectCost * 0.25;

  if (positiveCashFlow && dscrAtTarget && strongEquity && acceptableCashLeft) {
    return {
      label: "Proceed",
      reason: "The base case shows positive monthly cash flow, DSCR is above 1.20, equity creation is strong, and cash left in the deal remains reasonable.",
    };
  }

  if (positiveCashFlow || result.dscr >= 1.0 || result.equityCreated > 0 || result.cashLeftInDeal <= result.totalProjectCost * 0.4) {
    return {
      label: "Review",
      reason: "The base case is positive or near target, but either downside risk is material, DSCR is only moderate, or too much capital remains tied up in the deal.",
    };
  }

  return {
    label: "Pass",
    reason: "The base case produces negative cash flow, DSCR is below 1.00, equity creation is weak, or refinance proceeds do not support the strategy.",
  };
}

function getScenarioLabel(scenario) {
  if (scenario === "best") return "Best Case";
  if (scenario === "worst") return "Worst Case";
  return "Base Case";
}

export default function BrrrrAnalyzer({ onBack, onOpenDealIntake, onOpenDealAnalyzer, onOpenFlipAnalyzer, onOpenDealIntelligence }) {
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
      closingCosts: selectedDeal.closingCosts ?? "",
      financingCosts: selectedDeal.financingCosts ?? "",
      initialCashInvested: selectedDeal.initialCashInvested ?? "",
      refinanceLtvPercent: selectedDeal.refinanceLtvPercent ?? "75",
      refinanceInterestRate: selectedDeal.refinanceInterestRate ?? "",
      refinanceLoanTermYears: selectedDeal.refinanceLoanTermYears ?? "30",
      refinanceClosingCosts: selectedDeal.refinanceClosingCosts ?? "",
      monthlyRent: selectedDeal.estimatedRent ?? selectedDeal.monthlyRent ?? "",
      otherMonthlyIncome: selectedDeal.otherMonthlyIncome ?? "",
      annualPropertyTaxes: selectedDeal.annualPropertyTaxes ?? "",
      annualInsurance: selectedDeal.annualInsurance ?? "",
      monthlyHoa: selectedDeal.monthlyHoa ?? "",
      vacancyPercent: selectedDeal.vacancyPercent ?? "5",
      maintenancePercent: selectedDeal.maintenancePercent ?? "5",
      capexPercent: selectedDeal.capexPercent ?? "5",
      propertyManagementPercent: selectedDeal.propertyManagementPercent ?? "8",
      monthlyUtilities: selectedDeal.monthlyUtilities ?? "",
      otherMonthlyExpenses: selectedDeal.otherMonthlyExpenses ?? "",
    });
  };

  const scenarioResults = useMemo(() => {
    const underwriting = buildUnifiedUnderwritingIntelligence({
      purchasePrice: formValues.purchasePrice,
      rehabBudget: formValues.rehabBudget,
      estimatedArv: formValues.arv,
      estimatedRent: formValues.monthlyRent,
      closingCosts: formValues.closingCosts,
      financingCosts: formValues.financingCosts,
      initialCashInvested: formValues.initialCashInvested,
      refinanceLtvPercent: formValues.refinanceLtvPercent,
      refinanceClosingCosts: formValues.refinanceClosingCosts,
      annualPropertyTaxes: formValues.annualPropertyTaxes,
      annualInsurance: formValues.annualInsurance,
      monthlyHoa: formValues.monthlyHoa,
      monthlyUtilities: formValues.monthlyUtilities,
      otherMonthlyExpenses: formValues.otherMonthlyExpenses,
      vacancyPercent: formValues.vacancyPercent,
      strategy: "BRRRR",
    }, []);

    const base = {
      totalProjectCost: underwriting.brrrrAnalysis.totalProjectCost,
      refinanceLoanAmount: underwriting.brrrrAnalysis.refinanceLoanAmount,
      monthlyPrincipalAndInterest: underwriting.brrrrAnalysis.monthlyDebtService,
      monthlyGrossIncome: underwriting.brrrrAnalysis.expectedRent,
      monthlyOperatingExpenses: underwriting.brrrrAnalysis.operatingExpenses,
      netOperatingIncome: underwriting.brrrrAnalysis.netOperatingIncome,
      monthlyCashFlow: underwriting.brrrrAnalysis.monthlyCashFlow,
      annualCashFlow: underwriting.brrrrAnalysis.monthlyCashFlow * 12,
      dscr: underwriting.brrrrAnalysis.debtServiceCoverageRatio,
      cashRecoveredAtRefinance: underwriting.brrrrAnalysis.cashReturnedAtRefinance,
      cashLeftInDeal: underwriting.brrrrAnalysis.cashLeftInDeal,
      equityCreated: underwriting.brrrrAnalysis.cashLeftInDeal,
      cashOnCashReturn: underwriting.brrrrAnalysis.cashOnCashReturn,
      returnOnTotalCost: underwriting.brrrrAnalysis.cashOnCashReturn,
      rentToCostRatio: underwriting.brrrrAnalysis.expectedRent / Math.max(underwriting.brrrrAnalysis.totalProjectCost, 1),
      breakEvenOccupancy: underwriting.brrrrAnalysis.breakEvenOccupancy,
      scenarioArv: underwriting.brrrrAnalysis.stabilizedArv,
      scenarioRent: underwriting.brrrrAnalysis.expectedRent,
      scenarioRehab: underwriting.rehabBudgetAnalysis.totalPlannedRehab,
      scenarioRate: 0,
      scenarioVacancy: Number(formValues.vacancyPercent || 0) / 100,
    };

    return {
      base,
      best: {
        ...base,
        monthlyCashFlow: base.monthlyCashFlow + 150,
        dscr: Math.max(0, base.dscr + 0.2),
      },
      worst: {
        ...base,
        monthlyCashFlow: base.monthlyCashFlow - 250,
        dscr: Math.max(0, base.dscr - 0.2),
      },
      recommendation: {
        label: underwriting.recommendation.action,
        reason: underwriting.recommendation.nextAction,
      },
    };
  }, [formValues]);

  const assumptionsText = "Assumptions shown below are the defaults used unless you override them: refinance LTV is 75%, vacancy is 5%, maintenance is 5%, capital expenditures are 5%, and property management is 8%.";

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
            <p style={styles.subtitle}>BRRRR ANALYZER / RSOS REFINANCE MODEL</p>
          </div>

          <div style={styles.headerActions}>
            <button type="button" style={styles.secondaryButton} onClick={onOpenDealAnalyzer}>
              DEAL ANALYZER
            </button>
            <button type="button" style={styles.primaryButton} onClick={onOpenDealIntake}>
              ADD NEW DEAL
            </button>
            <button type="button" style={styles.primaryButton} onClick={onOpenFlipAnalyzer}>
              FLIP ANALYZER
            </button>
            <button type="button" style={styles.primaryButton} onClick={onOpenDealIntelligence}>
              DEAL INTELLIGENCE
            </button>
          </div>
        </section>

        <section style={styles.card}>
          <div style={styles.cardHeader}>
            <div>
              <h2 style={styles.cardTitle}>BRRRR ANALYZER</h2>
              <p style={styles.cardSubtitle}>Model refinance leverage, monthly cash flow, and return potential for a BRRRR strategy.</p>
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
            <SummaryCard label="Total Project Cost" value={formatCurrency(scenarioResults.base.totalProjectCost)} />
            <SummaryCard label="Refinance Loan Amount" value={formatCurrency(scenarioResults.base.refinanceLoanAmount)} />
            <SummaryCard label="Max Loan Based on LTV" value={formatCurrency(scenarioResults.base.maxLoanBasedOnLtv)} />
            <SummaryCard label="Monthly P&I" value={formatCurrency(scenarioResults.base.monthlyPrincipalAndInterest)} />
            <SummaryCard label="Monthly Cash Flow" value={formatCurrency(scenarioResults.base.monthlyCashFlow)} />
          </div>

          <div style={styles.gridTwo}>
            <div style={styles.section}>
              <h3 style={styles.sectionTitle}>INPUTS</h3>
              <div style={styles.formGrid}>
                {[
                  ["Purchase Price", "purchasePrice"],
                  ["Rehab Budget", "rehabBudget"],
                  ["ARV", "arv"],
                  ["Closing Costs", "closingCosts"],
                  ["Financing Costs", "financingCosts"],
                  ["Initial Cash Invested", "initialCashInvested"],
                  ["Refinance LTV Percentage", "refinanceLtvPercent"],
                  ["Refinance Interest Rate", "refinanceInterestRate"],
                  ["Refinance Loan Term in Years", "refinanceLoanTermYears"],
                  ["Refinance Closing Costs", "refinanceClosingCosts"],
                  ["Monthly Rent", "monthlyRent"],
                  ["Other Monthly Income", "otherMonthlyIncome"],
                  ["Annual Property Taxes", "annualPropertyTaxes"],
                  ["Annual Insurance", "annualInsurance"],
                  ["Monthly HOA", "monthlyHoa"],
                  ["Vacancy Percentage", "vacancyPercent"],
                  ["Maintenance Percentage", "maintenancePercent"],
                  ["Capital Expenditures Percentage", "capexPercent"],
                  ["Property Management Percentage", "propertyManagementPercent"],
                  ["Monthly Utilities Paid by Owner", "monthlyUtilities"],
                  ["Other Monthly Expenses", "otherMonthlyExpenses"],
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
                {(["best", "base", "worst"]).map((scenario) => {
                  const result = scenarioResults[scenario];
                  return (
                    <div key={scenario} style={styles.scenarioCard}>
                      <div style={styles.scenarioHeader}>{getScenarioLabel(scenario)}</div>
                      <div style={styles.scenarioValue}>{formatCurrency(result.monthlyCashFlow)}</div>
                      <div style={styles.scenarioMeta}>DSCR {formatPercent(result.dscr)}</div>
                      <div style={styles.scenarioMeta}>Equity {formatCurrency(result.equityCreated)}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div style={styles.section}>
            <h3 style={styles.sectionTitle}>REFINANCE BREAKDOWN</h3>
            <div style={styles.summaryGrid}>
              <SummaryCard label="Refinance Loan Amount" value={formatCurrency(scenarioResults.base.refinanceLoanAmount)} />
              <SummaryCard label="Max Loan Based on LTV" value={formatCurrency(scenarioResults.base.maxLoanBasedOnLtv)} />
              <SummaryCard label="Cash Recovered at Refinance" value={formatCurrency(scenarioResults.base.cashRecoveredAtRefinance)} />
              <SummaryCard label="Cash Left in Deal" value={formatCurrency(scenarioResults.base.cashLeftInDeal)} />
              <SummaryCard label="Equity Created" value={formatCurrency(scenarioResults.base.equityCreated)} />
            </div>
          </div>

          <div style={styles.section}>
            <h3 style={styles.sectionTitle}>MONTHLY CASH FLOW BREAKDOWN</h3>
            <div style={styles.summaryGrid}>
              <SummaryCard label="Monthly Gross Income" value={formatCurrency(scenarioResults.base.monthlyGrossIncome)} />
              <SummaryCard label="Vacancy Expense" value={formatCurrency(scenarioResults.base.vacancyExpense)} />
              <SummaryCard label="Maintenance Expense" value={formatCurrency(scenarioResults.base.maintenanceExpense)} />
              <SummaryCard label="Capex Expense" value={formatCurrency(scenarioResults.base.capexExpense)} />
              <SummaryCard label="Property Management" value={formatCurrency(scenarioResults.base.propertyManagementExpense)} />
            </div>
            <div style={styles.summaryGrid}>
              <SummaryCard label="Monthly Operating Expenses" value={formatCurrency(scenarioResults.base.monthlyOperatingExpenses)} />
              <SummaryCard label="Net Operating Income" value={formatCurrency(scenarioResults.base.netOperatingIncome)} />
              <SummaryCard label="Monthly Cash Flow" value={formatCurrency(scenarioResults.base.monthlyCashFlow)} />
              <SummaryCard label="Annual Cash Flow" value={formatCurrency(scenarioResults.base.annualCashFlow)} />
              <SummaryCard label="DSCR" value={formatPercent(scenarioResults.base.dscr)} />
            </div>
          </div>

          <div style={styles.section}>
            <h3 style={styles.sectionTitle}>RETURN METRICS</h3>
            <div style={styles.summaryGrid}>
              <SummaryCard label="Cash-on-Cash Return" value={formatPercent(scenarioResults.base.cashOnCashReturn)} />
              <SummaryCard label="Return on Total Cost" value={formatPercent(scenarioResults.base.returnOnTotalCost)} />
              <SummaryCard label="Rent-to-Cost Ratio" value={formatPercent(scenarioResults.base.rentToCostRatio)} />
              <SummaryCard label="Break-Even Occupancy" value={formatPercent(scenarioResults.base.breakEvenOccupancy)} />
            </div>
          </div>

          <div style={styles.section}>
            <h3 style={styles.sectionTitle}>RECOMMENDATION</h3>
            <div style={styles.recommendationBox}>
              <div style={styles.recommendationLabel}>{scenarioResults.recommendation.label}</div>
              <div style={styles.recommendationReason}>{scenarioResults.recommendation.reason}</div>
            </div>
            <div style={styles.warningList}>
              {scenarioResults.base.monthlyCashFlow <= 0 ? <div style={styles.warning}>Monthly cash flow is negative in the base case.</div> : null}
              {scenarioResults.worst.dscr < 1.0 ? <div style={styles.warning}>The downside case falls below a 1.00 DSCR.</div> : null}
              {scenarioResults.base.equityCreated <= 0 ? <div style={styles.warning}>The refinance proceeds do not create positive equity.</div> : null}
              {scenarioResults.base.cashLeftInDeal > scenarioResults.base.totalProjectCost * 0.25 ? <div style={styles.warning}>A substantial amount of capital remains tied up in the deal.</div> : null}
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
    padding: "8px 12px",
    fontWeight: 700,
    cursor: "pointer",
  },
  secondaryButton: {
    border: `1px solid ${BORDER}`,
    background: "#111111",
    color: GOLD,
    padding: "8px 12px",
    fontWeight: 700,
    cursor: "pointer",
  },
  card: {
    border: `1px solid ${BORDER}`,
    background: "#0f0f0f",
    padding: "18px",
    boxSizing: "border-box",
  },
  cardHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "12px",
    marginBottom: "10px",
  },
  cardTitle: {
    margin: 0,
    fontSize: "22px",
    letterSpacing: "0.8px",
  },
  cardSubtitle: {
    margin: "4px 0 0",
    color: "#f9e27b",
    fontSize: "13px",
  },
  connectionBadge: {
    border: `1px solid ${BORDER}`,
    padding: "7px 10px",
    fontSize: "12px",
    color: GOLD,
    background: "#111111",
  },
  assumptionBox: {
    border: `1px solid ${BORDER}`,
    padding: "10px 12px",
    marginBottom: "12px",
    background: "#111111",
    color: "#f9e27b",
    fontSize: "12px",
    lineHeight: 1.5,
  },
  controlsRow: {
    display: "flex",
    gap: "10px",
    marginBottom: "12px",
  },
  select: {
    width: "280px",
    padding: "9px 10px",
    border: `1px solid ${BORDER}`,
    background: "#111111",
    color: GOLD,
    fontWeight: 700,
  },
  summaryGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
    gap: "10px",
    marginBottom: "12px",
  },
  summaryCard: {
    border: `1px solid ${BORDER}`,
    padding: "10px",
    background: "#111111",
  },
  summaryLabel: {
    fontSize: "11px",
    color: "#f9e27b",
    marginBottom: "6px",
    textTransform: "uppercase",
    letterSpacing: "0.8px",
  },
  summaryValue: {
    fontSize: "15px",
    color: GOLD,
    fontWeight: 700,
  },
  gridTwo: {
    display: "grid",
    gridTemplateColumns: "1.1fr 0.9fr",
    gap: "12px",
    marginBottom: "12px",
  },
  section: {
    border: `1px solid ${BORDER}`,
    padding: "12px",
    background: "#111111",
  },
  sectionTitle: {
    margin: "0 0 10px",
    fontSize: "14px",
    letterSpacing: "1px",
    textTransform: "uppercase",
    color: GOLD,
  },
  formGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: "10px",
  },
  label: {
    display: "flex",
    flexDirection: "column",
    gap: "5px",
    fontSize: "11px",
    color: "#f9e27b",
  },
  fieldLabel: {
    fontWeight: 700,
    textTransform: "uppercase",
  },
  input: {
    border: `1px solid ${BORDER}`,
    background: "#050505",
    color: GOLD,
    padding: "7px 8px",
    fontWeight: 700,
  },
  scenarioGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: "10px",
  },
  scenarioCard: {
    border: `1px solid ${BORDER}`,
    padding: "10px",
    background: "#050505",
  },
  scenarioHeader: {
    fontSize: "12px",
    textTransform: "uppercase",
    color: "#f9e27b",
    marginBottom: "6px",
  },
  scenarioValue: {
    fontSize: "16px",
    fontWeight: 700,
    marginBottom: "4px",
  },
  scenarioMeta: {
    fontSize: "11px",
    color: "#f9e27b",
  },
  recommendationBox: {
    border: `1px solid ${BORDER}`,
    padding: "10px",
    background: "#050505",
    marginBottom: "8px",
  },
  recommendationLabel: {
    fontSize: "16px",
    fontWeight: 700,
    textTransform: "uppercase",
    marginBottom: "6px",
  },
  recommendationReason: {
    fontSize: "12px",
    color: "#f9e27b",
    lineHeight: 1.4,
  },
  warningList: {
    display: "flex",
    flexDirection: "column",
    gap: "6px",
  },
  warning: {
    border: `1px solid ${BORDER}`,
    padding: "8px",
    background: "#1a1300",
    color: "#f9e27b",
    fontSize: "12px",
  },
};
