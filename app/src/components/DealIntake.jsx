import { useEffect, useState } from "react";
import { buildApiUrl } from "../utils/apiClient.js";
import { buildSessionAuthHeaders } from "../utils/sessionAuth.js";
import { buildFinancingCostState, getDisplayedFinancingCostValue } from "../utils/financingCostSchema.js";
import { buildUnifiedUnderwritingIntelligence, normalizeDealForIntelligence } from "./intelligenceUpgradeEngine.js";
import { buildStatusOptionsWithCurrent, getDealPipelineStageOptions, resolveDealStatusValue } from "../utils/dealWorkflowRegistry.js";
import { hydrateDealIntakeFormData, toNumberOrBlank, validateDealIntakeFormData } from "./dealIntakeFormUtils.js";
import { buildDealIntakePayload } from "./dealIntakeFieldContract.js";
import logo from "../assets/royal-star-logo.png";
import { getSidebarNavigation, shouldConfirmNavigation } from "../utils/navigationModel.js";
import { useLogoutControl } from "../hooks/useLogoutControl.js";


const initialFormState = {
  address: "",
  city: "",
  state: "",
  zip: "",
  propertyType: "",
  bedrooms: "",
  bathrooms: "",
  squareFeet: "",
  yearBuilt: "",
  askingPrice: "",
  purchasePrice: "",
  rehabBudget: "",
  arv: "",
  estimatedRent: "",
  taxes: "",
  insurance: "",
  financingCosts: "",
  closingCosts: "",
  actualLoanAmount: "",
  annualInterestRate: "",
  cashToClose: "",
  earnestMoney: "",
  totalInitialCashInvested: "",
  constructionHoldback: "",
  originationFee: "",
  underwritingFee: "",
  servicingFee: "",
  lenderLegalFee: "",
  monitoringFee: "",
  otherLenderFees: "",
  fundedRehab: "",
  paymentType: "",
  holdingMonths: "",
  holdingCosts: "",
  monthlyHoldingCost: "",
  leadSource: "",
  exitStrategy: "",
  status: "Lead",
  pipelineStage: "New Lead",
  notes: "",
};

export const DEAL_INTAKE_MONEY_FIELDS = Object.freeze([
  "askingPrice", "purchasePrice", "rehabBudget", "arv", "estimatedRent", "taxes", "insurance",
  "financingCosts", "closingCosts", "actualLoanAmount", "cashToClose", "earnestMoney",
  "totalInitialCashInvested", "constructionHoldback", "originationFee", "underwritingFee",
  "servicingFee", "lenderLegalFee", "monitoringFee", "otherLenderFees", "fundedRehab", "holdingCosts",
]);
const MONEY_FIELD_SET = new Set(DEAL_INTAKE_MONEY_FIELDS);

const pipelineStageOptions = getDealPipelineStageOptions();

const navigation = getSidebarNavigation();

export default function DealIntake({ onBack, dealToEdit, currentView = "dealIntake", onNavigate }) {
  const [formData, setFormData] = useState(initialFormState);
  const [initialSnapshot, setInitialSnapshot] = useState(initialFormState);
  const [activeDeal, setActiveDeal] = useState(dealToEdit || null);
  const [formMode, setFormMode] = useState(dealToEdit?.id ? "edit" : "new");
  const [isSaving, setIsSaving] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const [statusMessage, setStatusMessage] = useState("");
  const [connectionState, setConnectionState] = useState("Backend Connected");
  const [financingCostDisplay, setFinancingCostDisplay] = useState({
    effectiveFinancingCosts: 0,
    financingCostSource: "calculated",
    rawFinancingCostInput: 0,
    calculatedFinancingCosts: 0,
  });
  const {
    logoutEnabled,
    loggingOut,
    logoutTitle,
    handleLogout,
  } = useLogoutControl();

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (!dealToEdit?.id) {
        if (formMode === "new") {
          setActiveDeal(null);
          setFieldErrors({});
          setStatusMessage("");
          setFinancingCostDisplay({
            effectiveFinancingCosts: 0,
            financingCostSource: "calculated",
            rawFinancingCostInput: 0,
            calculatedFinancingCosts: 0,
          });
          setFormData(initialFormState);
          setInitialSnapshot(initialFormState);
        }
        return;
      }

      setActiveDeal(dealToEdit);
      setFormMode("edit");
      setFieldErrors({});
      setStatusMessage("");

      const underwritingResult = buildUnifiedUnderwritingIntelligence(normalizeDealForIntelligence(dealToEdit), [], []);
      const financingCostState = buildFinancingCostState(dealToEdit, underwritingResult);

      setFinancingCostDisplay({
        effectiveFinancingCosts: financingCostState.effectiveFinancingCosts,
        financingCostSource: financingCostState.financingCostSource,
        rawFinancingCostInput: financingCostState.rawFinancingCostInput,
        calculatedFinancingCosts: financingCostState.calculatedFinancingCosts,
      });

      const hydratedValues = hydrateDealIntakeFormData(dealToEdit, financingCostState);
      setFormData(hydratedValues);
      setInitialSnapshot(hydratedValues);
    }, 0);

    return () => window.clearTimeout(timer);
  }, [dealToEdit, formMode]);

  const focusFirstInvalidField = (fieldName) => {
    if (typeof document === "undefined" || !fieldName) return;
    const field = document.querySelector(`[name="${fieldName}"]`);
    if (field && typeof field.focus === "function") {
      field.focus();
    }
  };

  const hydrateSavedDeal = (savedDealRecord, message) => {
    const underwritingResult = buildUnifiedUnderwritingIntelligence(normalizeDealForIntelligence(savedDealRecord), [], []);
    const financingCostState = buildFinancingCostState(savedDealRecord, underwritingResult);
    setFinancingCostDisplay({
      effectiveFinancingCosts: financingCostState.effectiveFinancingCosts,
      financingCostSource: financingCostState.financingCostSource,
      rawFinancingCostInput: financingCostState.rawFinancingCostInput,
      calculatedFinancingCosts: financingCostState.calculatedFinancingCosts,
    });
    const hydratedValues = hydrateDealIntakeFormData(savedDealRecord, financingCostState);
    setActiveDeal(savedDealRecord);
    setFormMode("edit");
    setFieldErrors({});
    setStatusMessage(message);
    setFormData(hydratedValues);
    setInitialSnapshot(hydratedValues);
  };

  const fetchCanonicalDealById = async (dealId) => {
    if (!dealId) return null;
    const response = await fetch(buildApiUrl(`/api/deals/${dealId}`));
    if (!response.ok) return null;
    return response.json();
  };

  const handleChange = (event) => {
    const { name, value } = event.target;
    if (fieldErrors[name]) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next[name];
        return next;
      });
    }
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const displayedFinancingCostValue = getDisplayedFinancingCostValue(formData.financingCosts, financingCostDisplay);
  const shouldShowCalculatedFinancingLabel = financingCostDisplay.financingCostSource === "calculated" && Number(formData.financingCosts || 0) <= 0;
  const financingCostDebug = {
    renderedValue: displayedFinancingCostValue,
    stateValue: formData.financingCosts,
    hydratedValue: financingCostDisplay.rawFinancingCostInput,
    repositoryValue: dealToEdit?.financingCosts ?? dealToEdit?.financials?.rawFinancingCostInput ?? 0,
    effectiveFinancingCost: financingCostDisplay.effectiveFinancingCosts,
    financingCostSource: financingCostDisplay.financingCostSource,
  };

  console.log("[DealIntake financing binding]", financingCostDebug);

  const handleClear = () => {
    if (formMode === "edit" && activeDeal) {
      const underwritingResult = buildUnifiedUnderwritingIntelligence(normalizeDealForIntelligence(activeDeal), [], []);
      const financingCostState = buildFinancingCostState(activeDeal, underwritingResult);
      const hydratedValues = hydrateDealIntakeFormData(activeDeal, financingCostState);
      setFormData(hydratedValues);
      setInitialSnapshot(hydratedValues);
      setFieldErrors({});
      setStatusMessage("Form reset to saved deal values.");
      return;
    }

    setFieldErrors({});
    setStatusMessage("Form cleared.");
    setFormMode("new");
    setActiveDeal(null);
    setStatusMessage("Form cleared.");
    setFormData(initialFormState);
    setInitialSnapshot(initialFormState);
  };

  const hasUnsavedChanges = JSON.stringify(formData) !== JSON.stringify(initialSnapshot);

  const confirmBeforeNavigate = (targetViewKey, fallbackAction) => {
    const mustConfirm = shouldConfirmNavigation({
      hasUnsavedChanges,
      targetViewKey,
      currentViewKey: currentView,
    });

    if (mustConfirm) {
      const proceed = typeof window !== "undefined"
        ? window.confirm("You have unsaved changes. Continue and discard these changes?")
        : true;
      if (!proceed) return;
    }

    if (typeof onNavigate === "function" && targetViewKey) {
      onNavigate(targetViewKey);
      return;
    }

    if (typeof fallbackAction === "function") {
      fallbackAction();
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (isSaving) return;

    const validation = validateDealIntakeFormData(formData);
    if (!validation.isValid) {
      setFieldErrors(validation.fieldErrors);
      setStatusMessage("Please correct the highlighted fields before saving.");
      focusFirstInvalidField(validation.firstInvalidField);
      return;
    }

    const currentDeal = activeDeal || dealToEdit || null;
    const isEditMode = formMode === "edit" && Boolean(currentDeal?.id);
    if (formMode === "edit" && !currentDeal?.id) {
      setStatusMessage("Unable to save: missing deal ID for Edit Deal mode.");
      return;
    }

    setIsSaving(true);
    setFieldErrors({});

    const payload = buildDealIntakePayload(formData, currentDeal);

    try {
      const endpoint = isEditMode ? buildApiUrl(`/api/deals/${currentDeal.id}`) : buildApiUrl("/api/deals");
      const method = isEditMode ? "PUT" : "POST";
      const response = await fetch(endpoint, {
        method,
        headers: buildSessionAuthHeaders({
          "Content-Type": "application/json",
        }),
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const message = errorData.errors?.join(" ") || errorData.error || "Validation failed.";
        setConnectionState("Backend Connected");
        setStatusMessage(`Unable to save deal: ${message}`);
        setIsSaving(false);
        return;
      }

      const savedDeal = await response.json();
      const canonicalSavedDeal = await fetchCanonicalDealById(savedDeal.id).catch(() => null);
      const finalSavedDeal = canonicalSavedDeal || { ...currentDeal, ...savedDeal };
      setConnectionState("Backend Connected");
      hydrateSavedDeal(finalSavedDeal, isEditMode ? "Deal updated successfully." : `Deal saved successfully. ID: ${savedDeal.id}`);
      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("royalStarDealsUpdated"));
        window.dispatchEvent(new Event("royalStarPropertiesUpdated"));
        window.dispatchEvent(new Event("royalStarDataSynchronized"));
      }
    } catch (error) {
      console.error("Unable to save deal:", error);
      setConnectionState("Local Fallback");

      try {
        const existingDeals = JSON.parse(
          window.localStorage.getItem("royalStarDeals") || "[]"
        );

        const dealToSave = {
          ...payload,
          id: currentDeal?.id || Date.now(),
          address: formData.address,
          zip: formData.zip,
          arv: toNumberOrBlank(formData.arv),
          projectedARV: toNumberOrBlank(formData.arv),
          createdAt: currentDeal?.createdAt || new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        const updatedDeals = isEditMode
          ? existingDeals.map((entry) => (String(entry.id) === String(currentDeal.id) ? dealToSave : entry))
          : [...existingDeals, dealToSave];

        window.localStorage.setItem("royalStarDeals", JSON.stringify(updatedDeals));
        if (typeof window !== "undefined") {
          window.dispatchEvent(new Event("royalStarDealsUpdated"));
          window.dispatchEvent(new Event("royalStarPropertiesUpdated"));
          window.dispatchEvent(new Event("royalStarDataSynchronized"));
        }
        hydrateSavedDeal(dealToSave, isEditMode ? "Deal updated successfully." : `Deal saved locally. Total deals: ${updatedDeals.length}.`);
      } catch (fallbackError) {
        console.error("Unable to save deal locally:", fallbackError);
        setStatusMessage("Unable to save deal. Please try again.");
      }
    } finally {
      setIsSaving(false);
    }
  };

  const modeLabel = formMode === "edit" ? "Edit Deal" : "New Deal";
  const modeDealId = formMode === "edit" ? (activeDeal?.id || dealToEdit?.id || "") : "";

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
              onClick={() => confirmBeforeNavigate(item.viewKey)}
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
          <button type="button" style={styles.backButton} onClick={() => confirmBeforeNavigate("dashboard", onBack)}>
            ◀ COMMAND CENTER
          </button>

          <div style={styles.headingBlock}>
            <h1 style={styles.company}>ROYAL STAR PROPERTIES, LLC</h1>
            <p style={styles.subtitle}>DEAL INTAKE / OPPORTUNITY ENTRY</p>
          </div>

          <div style={styles.adminBadge}>👤 BRANDON STERLING</div>
        </section>

        <section style={styles.card}>
          <div style={styles.cardHeader}>
            <div>
              <h2 style={styles.cardTitle}>{formMode === "edit" ? "EDIT DEAL" : "NEW DEAL INTAKE"}</h2>
              <p style={styles.cardSubtitle}>
                Capture the property details, numbers, and strategy for every opportunity.
              </p>
            </div>
            <div style={styles.statusBox}>
              <div style={styles.modeLabel}>{modeLabel}{modeDealId ? ` · ${modeDealId}` : ""}</div>
              <div>{statusMessage || "Ready to capture a new deal."}</div>
              <div style={styles.connectionBadge}>{connectionState}</div>
            </div>
          </div>

          <form onSubmit={handleSubmit} style={styles.form}>
            <Section title="PROPERTY INFORMATION">
              <div style={styles.gridTwo}>
                <Field label="Address" name="address" value={formData.address} onChange={handleChange} errors={fieldErrors} />
                <Field label="City" name="city" value={formData.city} onChange={handleChange} errors={fieldErrors} />
                <Field label="State" name="state" value={formData.state} onChange={handleChange} errors={fieldErrors} />
                <Field label="ZIP" name="zip" value={formData.zip} onChange={handleChange} errors={fieldErrors} />
                <Field label="Property Type" name="propertyType" value={formData.propertyType} onChange={handleChange} errors={fieldErrors} />
                <Field label="Bedrooms" name="bedrooms" value={formData.bedrooms} onChange={handleChange} type="number" step="1" errors={fieldErrors} />
                <Field label="Bathrooms" name="bathrooms" value={formData.bathrooms} onChange={handleChange} type="number" step="0.5" errors={fieldErrors} />
                <Field label="Square Feet" name="squareFeet" value={formData.squareFeet} onChange={handleChange} type="number" step="1" errors={fieldErrors} />
                <Field label="Year Built" name="yearBuilt" value={formData.yearBuilt} onChange={handleChange} type="number" step="1" errors={fieldErrors} />
              </div>
            </Section>

            <Section title="DEAL NUMBERS">
              <div style={styles.gridTwo}>
                <Field label="Asking Price" name="askingPrice" value={formData.askingPrice} onChange={handleChange} type="number" errors={fieldErrors} />
                <Field label="Purchase Price" name="purchasePrice" value={formData.purchasePrice} onChange={handleChange} type="number" errors={fieldErrors} />
                <Field label="Rehab Budget" name="rehabBudget" value={formData.rehabBudget} onChange={handleChange} type="number" errors={fieldErrors} />
                <Field label="ARV" name="arv" value={formData.arv} onChange={handleChange} type="number" errors={fieldErrors} />
                <Field label="Estimated Rent" name="estimatedRent" value={formData.estimatedRent} onChange={handleChange} type="number" errors={fieldErrors} />
                <Field label="Taxes" name="taxes" value={formData.taxes} onChange={handleChange} type="number" errors={fieldErrors} />
                <Field label="Insurance" name="insurance" value={formData.insurance} onChange={handleChange} type="number" errors={fieldErrors} />
                <div>
                  <Field
                    label={shouldShowCalculatedFinancingLabel ? "Calculated Financing Costs" : "Financing Costs"}
                    name="financingCosts"
                    value={displayedFinancingCostValue}
                    onChange={handleChange}
                    type="number"
                    errors={fieldErrors}
                  />
                  <div style={styles.helperText}>
                    {financingCostDisplay.financingCostSource === "calculated"
                      ? "Showing the effective financing cost. Enter a manual override to replace it."
                      : "Enter a manual override to replace the calculated financing cost."}
                  </div>
                  {financingCostDisplay.effectiveFinancingCosts > 0 && (
                    <div style={styles.helperTextSecondary}>
                      Effective Financing Costs: ${Number(financingCostDisplay.effectiveFinancingCosts).toLocaleString("en-US", { maximumFractionDigits: 2 })}
                    </div>
                  )}
                </div>
                <Field label="Closing Costs" name="closingCosts" value={formData.closingCosts} onChange={handleChange} type="number" errors={fieldErrors} />
                <Field label="Actual Loan Amount" name="actualLoanAmount" value={formData.actualLoanAmount} onChange={handleChange} type="number" errors={fieldErrors} />
                <Field label="Annual Interest Rate" name="annualInterestRate" value={formData.annualInterestRate} onChange={handleChange} type="number" step="0.01" errors={fieldErrors} />
                <Field label="Cash to Close" name="cashToClose" value={formData.cashToClose} onChange={handleChange} type="number" errors={fieldErrors} />
                <Field label="Earnest Money" name="earnestMoney" value={formData.earnestMoney} onChange={handleChange} type="number" errors={fieldErrors} />
                <Field label="Total Initial Cash Invested" name="totalInitialCashInvested" value={formData.totalInitialCashInvested} onChange={handleChange} type="number" errors={fieldErrors} />
                <Field label="Construction Holdback" name="constructionHoldback" value={formData.constructionHoldback} onChange={handleChange} type="number" errors={fieldErrors} />
                <Field label="Origination Fee" name="originationFee" value={formData.originationFee} onChange={handleChange} type="number" errors={fieldErrors} />
                <Field label="Underwriting Fee" name="underwritingFee" value={formData.underwritingFee} onChange={handleChange} type="number" errors={fieldErrors} />
                <Field label="Servicing Fee" name="servicingFee" value={formData.servicingFee} onChange={handleChange} type="number" errors={fieldErrors} />
                <Field label="Lender Legal Fee" name="lenderLegalFee" value={formData.lenderLegalFee} onChange={handleChange} type="number" errors={fieldErrors} />
                <Field label="Monitoring Fee" name="monitoringFee" value={formData.monitoringFee} onChange={handleChange} type="number" errors={fieldErrors} />
                <Field label="Other Lender Fees" name="otherLenderFees" value={formData.otherLenderFees} onChange={handleChange} type="number" errors={fieldErrors} />
                <Field label="Funded Rehab" name="fundedRehab" value={formData.fundedRehab} onChange={handleChange} type="number" errors={fieldErrors} />
                <Field label="Payment Type" name="paymentType" value={formData.paymentType} onChange={handleChange} errors={fieldErrors} />
                <Field label="Holding Months" name="holdingMonths" value={formData.holdingMonths} onChange={handleChange} type="number" step="1" errors={fieldErrors} />
                <Field label="TOTAL HOLDING COSTS" name="holdingCosts" value={formData.holdingCosts} onChange={handleChange} type="number" min={0} errors={fieldErrors} />
              </div>
            </Section>

            <Section title="STRATEGY">
              <div style={styles.gridTwo}>
                <Field label="Lead Source" name="leadSource" value={formData.leadSource} onChange={handleChange} errors={fieldErrors} />
                <Field label="Exit Strategy" name="exitStrategy" value={formData.exitStrategy} onChange={handleChange} errors={fieldErrors} />
                <label style={styles.label}>
                  <span style={styles.fieldLabel}>Status</span>
                  <select name="status" value={formData.status} onChange={handleChange} style={styles.input}>
                    {buildStatusOptionsWithCurrent(formData.status).map((statusOption) => (
                      <option key={statusOption} value={statusOption}>{statusOption}</option>
                    ))}
                  </select>
                  {fieldErrors.status ? <span style={styles.errorText}>{fieldErrors.status}</span> : null}
                </label>
                <label style={styles.label}>
                  <span style={styles.fieldLabel}>Pipeline Stage</span>
                  <select name="pipelineStage" value={formData.pipelineStage} onChange={handleChange} style={styles.input}>
                    {pipelineStageOptions.map((stageOption) => (
                      <option key={stageOption} value={stageOption}>{stageOption}</option>
                    ))}
                  </select>
                  {fieldErrors.pipelineStage ? <span style={styles.errorText}>{fieldErrors.pipelineStage}</span> : null}
                </label>
              </div>
            </Section>

            <Section title="NOTES">
              <label style={styles.label}>
                <span style={styles.fieldLabel}>Notes</span>
                <textarea
                  name="notes"
                  value={formData.notes}
                  onChange={handleChange}
                  rows={5}
                  style={styles.textarea}
                  placeholder="Add deal notes, observations, or next steps..."
                />
                {fieldErrors.notes ? <span style={styles.errorText}>{fieldErrors.notes}</span> : null}
              </label>
            </Section>

            <div style={styles.buttonRow}>
              <button type="submit" style={styles.primaryButton} disabled={isSaving}>
                {isSaving ? "SAVING..." : "SAVE DEAL"}
              </button>
              <button type="button" style={styles.secondaryButton} onClick={handleClear} disabled={isSaving}>
                CLEAR FORM
              </button>
            </div>
          </form>
        </section>
      </main>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div style={styles.section}>
      <h3 style={styles.sectionTitle}>{title}</h3>
      {children}
    </div>
  );
}

function Field({ label, name, value, onChange, type = "text", min, step, errors = {} }) {
  const error = errors[name];
  return (
    <label style={styles.label}>
      <span style={styles.fieldLabel}>{label}</span>
      <input
        type={type}
        name={name}
        value={value}
        onChange={onChange}
        min={min}
        step={step ?? (type === "number" && MONEY_FIELD_SET.has(name) ? "0.01" : undefined)}
        style={error ? { ...styles.input, ...styles.inputError } : styles.input}
      />
      {error ? <span style={styles.errorText}>{error}</span> : null}
    </label>
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
  adminBadge: {
    border: `1px solid ${BORDER}`,
    padding: "8px 12px",
    fontSize: "12px",
    color: GOLD,
    backgroundColor: "#111111",
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
    marginBottom: "18px",
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
  statusBox: {
    border: `1px solid ${BORDER}`,
    backgroundColor: "#111111",
    padding: "10px 12px",
    fontSize: "12px",
    maxWidth: "280px",
    color: "#f8e47b",
    display: "flex",
    flexDirection: "column",
    gap: "6px",
  },
  modeLabel: {
    fontSize: "11px",
    letterSpacing: "0.4px",
    color: "#ffe48e",
  },
  connectionBadge: {
    alignSelf: "flex-start",
    border: `1px solid ${BORDER}`,
    padding: "3px 7px",
    backgroundColor: "#060606",
    color: GOLD,
    fontSize: "10px",
    letterSpacing: "0.8px",
  },
  form: {
    display: "flex",
    flexDirection: "column",
    gap: "14px",
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
  gridTwo: {
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
  inputError: {
    border: "1px solid #ff7a7a",
  },
  textarea: {
    border: `1px solid ${BORDER}`,
    backgroundColor: "#151515",
    color: "#fff7cc",
    padding: "9px 10px",
    fontSize: "13px",
    outline: "none",
    resize: "vertical",
  },
  helperText: {
    marginTop: "4px",
    fontSize: "11px",
    color: "#f1d46b",
    letterSpacing: "0.3px",
  },
  helperTextSecondary: {
    marginTop: "2px",
    fontSize: "10px",
    color: "#fff2a8",
    letterSpacing: "0.3px",
  },
  errorText: {
    marginTop: "2px",
    fontSize: "11px",
    color: "#ff9b9b",
    letterSpacing: "0.2px",
  },
  buttonRow: {
    display: "flex",
    gap: "12px",
    justifyContent: "flex-end",
    marginTop: "6px",
  },
  primaryButton: {
    border: `1px solid ${BORDER}`,
    background: "linear-gradient(90deg, #f7d339 0%, #eab90c 100%)",
    color: "#17120a",
    padding: "10px 16px",
    fontWeight: 700,
    cursor: "pointer",
  },
  secondaryButton: {
    border: `1px solid ${BORDER}`,
    backgroundColor: "#111111",
    color: GOLD,
    padding: "10px 16px",
    fontWeight: 700,
    cursor: "pointer",
  },
  disabledButton: {
    opacity: 0.6,
    cursor: "not-allowed",
  },
};
