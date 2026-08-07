export function safeNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function safeDisplay(value, fallback = "Insufficient Data") {
  if (value === null || value === undefined || value === "" || Number.isNaN(value)) return fallback;
  if (typeof value === "number" && !Number.isFinite(value)) return fallback;
  if (typeof value === "object") return fallback;
  return value;
}

function normalizeDeal(deal) {
  return deal && typeof deal === "object" && !Array.isArray(deal) ? deal : {};
}

function normalizeAnalysis(analysis) {
  return analysis && typeof analysis === "object" && !Array.isArray(analysis) ? analysis : {};
}

function normalizeScenarioData(scenarioData) {
  return scenarioData && typeof scenarioData === "object" && !Array.isArray(scenarioData) ? scenarioData : {};
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function hasMeaningfulData(deal, analysis, scenarioData) {
  const dealValues = [
    deal.purchasePrice,
    deal.askingPrice,
    deal.rehabBudget,
    deal.estimatedArv,
    deal.arv,
    deal.projectedARV,
    deal.currentValue,
    deal.estimatedRent,
    deal.marketRent,
    deal.projectedRent,
    deal.vacancyRate,
    deal.vacancy,
    deal.taxes,
    deal.insurance,
    deal.cashOnHand,
    deal.appraisedValue,
  ];
  const analysisValues = [
    analysis.dealScore,
    analysis.estimatedFlipProfit,
    analysis.roi,
    analysis.dscr,
    analysis.monthlyCashFlow,
    analysis.cashRequired,
    analysis.supportedBaseArv,
    analysis.marketScore,
    analysis.valuationScore,
  ];
  const scenarioValues = [
    scenarioData?.summary?.baseRecommendation,
    scenarioData?.summary?.scenarioSurvivalResult,
    scenarioData?.summary?.expectedProfit,
    scenarioData?.summary?.expectedRoi,
    scenarioData?.summary?.downsideMonthlyCashFlow,
  ];
  return [...dealValues, ...analysisValues, ...scenarioValues].some((value) => value !== null && value !== undefined && value !== "" && value !== 0);
}

function getScenarioSummaryValue(scenarioData, key) {
  const scenarios = asArray(scenarioData?.scenarios || []);
  const entry = scenarios.find((candidate) => candidate?.scenarioName === "Moderate Downside") || scenarios[0] || {};
  return entry?.summary?.[key];
}

function buildChallenge(title, baseAssumption, challengedAssumption, financialEffect, scoreEffect, riskEffect, recommendationEffect, supportingWarnings, requiredActions) {
  return {
    title,
    baseAssumption,
    challengedAssumption,
    financialEffect,
    scoreEffect,
    riskEffect,
    recommendationEffect,
    supportingWarnings: asArray(supportingWarnings),
    requiredActions: asArray(requiredActions),
  };
}

export function buildRedTeamReview(dealInput = {}, analysisInput = {}, scenarioInput = {}) {
  try {
    const deal = normalizeDeal(dealInput);
    const analysis = normalizeAnalysis(analysisInput);
    const scenarioData = normalizeScenarioData(scenarioInput);

    if (!hasMeaningfulData(deal, analysis, scenarioData)) {
      return {
        strongestArgumentAgainstDeal: "Insufficient Data",
        mostFragileAssumption: "Insufficient Data",
        mostImportantMissingInformation: "Insufficient Data",
        largestFinancialRisk: "Insufficient Data",
        largestExecutionRisk: "Insufficient Data",
        largestMarketRisk: "Insufficient Data",
        largestFinancingRisk: "Insufficient Data",
        largestExitRisk: "Insufficient Data",
        downsideRecommendation: "Insufficient Data",
        recommendationSurvivalResult: "Insufficient Data",
        recommendationConfidence: "Insufficient Data",
        confidenceReasons: ["Red-Team Review unavailable for this deal."],
        decisionBreakingAssumption: "Insufficient Data",
        requiredCorrectiveActions: [],
        challenges: [],
        summary: {
          survivalResult: "Insufficient Data",
          recommendationConfidence: "Insufficient Data",
          fragileAssumption: "Insufficient Data",
          decisionBreakingThreshold: "Insufficient Data",
          downsideRecommendation: "Insufficient Data",
          criticalRiskCount: 0,
          decisionBlockingActionCount: 0,
        },
        metadata: {},
      };
    }

    const purchasePrice = safeNumber(deal.purchasePrice ?? deal.askingPrice);
    const rehabBudget = safeNumber(deal.rehabBudget);
    const arv = safeNumber(deal.estimatedArv ?? deal.arv ?? deal.projectedARV ?? deal.currentValue);
    const supportedArv = safeNumber(analysis.supportedBaseArv ?? deal.supportedBaseArv ?? 0);
    const estimatedRent = safeNumber(deal.estimatedRent ?? deal.marketRent ?? deal.projectedRent);
    const vacancyRate = safeNumber(deal.vacancyRate ?? deal.vacancy ?? 0);
    const financingCosts = safeNumber(deal.financingCosts);
    const closingCosts = safeNumber(deal.closingCosts);
    const taxes = safeNumber(deal.taxes);
    const insurance = safeNumber(deal.insurance);
    const cashOnHand = safeNumber(deal.cashOnHand);
    const monthlyCashFlow = safeNumber(analysis.monthlyCashFlow ?? 0);
    const dscr = safeNumber(analysis.dscr ?? 0);
    const cashRequired = safeNumber(analysis.cashRequired ?? 0);
    const dealScore = safeNumber(analysis.dealScore ?? 0);
    const overallRisk = safeNumber(analysis.overallRisk ?? 0);
    const warnings = asArray(analysis.warnings || []);
    const financingWarnings = asArray(analysis.financingWarnings || []);
    const compCount = safeNumber(analysis.compCount ?? 0);
    const buyBoxResult = safeDisplay(analysis.buyBoxResult || deal.buyBoxResult, "Insufficient Data");
    const arvConfidence = safeDisplay(analysis.arvConfidence || deal.arvConfidence, "Insufficient Data");
    const marketScore = safeNumber(analysis.marketScore ?? 0);
    const recommendedExit = safeDisplay(analysis.recommendedExit || deal.recommendedExit, "Insufficient Data");
    const scenarioSummary = normalizeScenarioData(scenarioData?.summary || {});
    const scenarioSummaryProfit = safeNumber(getScenarioSummaryValue(scenarioData, "profit") ?? scenarioSummary.expectedProfit ?? 0);
    const scenarioSummaryRoi = safeNumber(getScenarioSummaryValue(scenarioData, "roi") ?? scenarioSummary.expectedRoi ?? 0);
    const scenarioSummaryMonthlyCashFlow = safeNumber(getScenarioSummaryValue(scenarioData, "monthlyCashFlow") ?? scenarioSummary.downsideMonthlyCashFlow ?? 0);
    const scenarioSurvivalResult = safeDisplay(scenarioData?.summary?.scenarioSurvivalResult || analysis.scenarioSurvivalResult, "Insufficient Data");

    const requiredCorrectiveActions = [];
    if (supportedArv <= 0 || compCount < 3) requiredCorrectiveActions.push("Order appraisal");
    if (rehabBudget > 0 && rehabBudget > 50000) requiredCorrectiveActions.push("Increase rehab contingency");
    if (cashRequired > cashOnHand) requiredCorrectiveActions.push("Increase available liquidity");
    if (estimatedRent <= 0) requiredCorrectiveActions.push("Verify achievable rent");
    if (financingWarnings.length) requiredCorrectiveActions.push("Request revised lender terms");
    if (buyBoxResult !== "PASS") requiredCorrectiveActions.push("Re-underwrite against the target buy box");
    if (!warnings.length) requiredCorrectiveActions.push("Confirm supporting comps");
    if (recommendedExit === "Hold" || recommendedExit === "Insufficient Data") requiredCorrectiveActions.push("Add a secondary exit strategy");

    const strongestArgumentAgainstDeal = (() => {
      if (recommendedExit === "Hold" || recommendedExit === "Insufficient Data") return "The deal relies on too many assumptions to support a confident recommendation.";
      if (supportedArv <= 0 || compCount < 3) return "The deal lacks sufficient comp and valuation support to justify the current ARV assumption.";
      if (monthlyCashFlow < 0 || dscr < 1) return "The deal produces weak or negative operating economics under current assumptions.";
      if (cashRequired > cashOnHand) return "The required cash contribution exceeds available liquidity and could break the deal.";
      if (warnings.length || financingWarnings.length) return "The current recommendation is vulnerable to unresolved underwriting and lender concerns.";
      return "The recommendation depends on one or more optimistic assumptions that are not yet fully supported.";
    })();

    const mostFragileAssumption = (() => {
      if (supportedArv <= 0 || compCount < 3) return "Supported ARV is not yet established.";
      if (rehabBudget > 0 && rehabBudget > 50000) return "Rehab budget may be understated relative to scope.";
      if (estimatedRent <= 0) return "Rental income assumption is not supported by market data.";
      if (cashRequired > cashOnHand) return "Required cash contribution may exceed available liquidity.";
      if (dscr < 1.2) return "DSCR is too weak to support the recommendation.";
      if (warnings.some((warning) => warning.toLowerCase().includes("buy box"))) return "The property may fall outside the buy box.";
      return "The recommendation depends on a single optimistic assumption.";
    })();

    const mostImportantMissingInformation = (() => {
      if (supportedArv <= 0 || compCount < 3) return "Independent ARV support from comps or appraisal";
      if (rehabBudget <= 0) return "Rehab scope and contingency detail";
      if (cashRequired > cashOnHand) return "Liquidity confirmation and cash-to-close detail";
      if (estimatedRent <= 0) return "Verified rent and operating assumptions";
      return "Lender terms and exit strategy support";
    })();

    const largestFinancialRisk = (() => {
      if (scenarioSummaryProfit < 0 || monthlyCashFlow < 0) return "Negative projected profit";
      if (scenarioSummaryMonthlyCashFlow < 0 || monthlyCashFlow < 0) return "Negative monthly cash flow";
      if (cashRequired > cashOnHand) return "Cash-to-close exceeds available liquidity";
      return "Weak downside margin";
    })();

    const largestExecutionRisk = (() => {
      if (rehabBudget > 50000) return "Rehab scope and contingency may be understated";
      if (warnings.some((warning) => warning.toLowerCase().includes("rehab"))) return "Rehab timing and contractor execution may deteriorate";
      return "Project execution may be slower and more costly than planned";
    })();

    const largestMarketRisk = (() => {
      if (marketScore < 60) return "Market support is weak";
      if (vacancyRate > 0.05) return "Vacancy assumptions may be understated";
      if (warnings.some((warning) => warning.toLowerCase().includes("buy box"))) return "The property may sit outside the target market";
      return "Market liquidity may be weaker than planned";
    })();

    const largestFinancingRisk = (() => {
      if (financingWarnings.length) return financingWarnings[0];
      if (cashRequired > cashOnHand) return "Liquidity requirement may exceed available cash";
      if (dscr < 1.2) return "DSCR is too weak for current lender terms";
      return "Financing terms may tighten under downside conditions";
    })();

    const largestExitRisk = (() => {
      if (recommendedExit === "Flip") return "Flip exit may be constrained by slow market liquidity";
      if (recommendedExit === "BRRRR") return "Refinance proceeds may not support the exit";
      return "Secondary exit support is weak or unavailable";
    })();

    const downsideRecommendation = (() => {
      if (scenarioSurvivalResult === "Fails" || scenarioSummaryProfit < 0 || monthlyCashFlow < 0 || dscr < 1) return "Reject";
      if (scenarioSurvivalResult === "Marginal" || scenarioSummaryRoi < 0.05 || scenarioSummaryMonthlyCashFlow < 0) return "Hold";
      if (scenarioSurvivalResult === "Survives with Conditions") return "Conditional Buy";
      return "Conditional Buy";
    })();

    let recommendationSurvivalResult = "Insufficient Data";
    if (scenarioSurvivalResult === "Fails") recommendationSurvivalResult = "Fails";
    else if (scenarioSurvivalResult === "Marginal") recommendationSurvivalResult = "Marginal";
    else if (scenarioSurvivalResult === "Survives with Conditions") recommendationSurvivalResult = "Survives with Conditions";
    else if (scenarioSurvivalResult === "Survives") recommendationSurvivalResult = "Survives";

    let recommendationConfidence = "Insufficient Data";
    let confidenceReasons = [];
    if (scenarioSurvivalResult === "Fails" || scenarioSummaryProfit < 0 || monthlyCashFlow < 0 || dscr < 1 || cashRequired > cashOnHand) {
      recommendationConfidence = "Very Low";
    } else if (scenarioSurvivalResult === "Marginal" || supportedArv <= 0 || compCount < 3 || buyBoxResult !== "PASS" || marketScore < 60 || financingWarnings.length > 0 || warnings.length > 0) {
      recommendationConfidence = "Low";
    } else if (scenarioSurvivalResult === "Survives with Conditions") {
      recommendationConfidence = "Moderate";
    } else if (scenarioSurvivalResult === "Survives") {
      recommendationConfidence = "High";
    }

    confidenceReasons = [
      `ARV confidence: ${safeDisplay(arvConfidence, "Insufficient Data")}`,
      `Comp quality: ${compCount >= 3 ? "Three or more valid comps" : "Insufficient comp support"}`,
      `Market support: ${marketScore >= 70 ? "Strong" : marketScore >= 50 ? "Moderate" : "Weak"}`,
      `Scenario survival: ${safeDisplay(scenarioSurvivalResult, "Insufficient Data")}`,
      `Documentation and lender support: ${financingWarnings.length === 0 ? "Reasonable" : "Needs attention"}`,
    ];

    const decisionBreakingAssumption = (() => {
      if (supportedArv <= 0 || compCount < 3) {
        const minimumProfitBuffer = Math.max(5000, Math.round((purchasePrice + rehabBudget) * 0.08));
        const decisionBreakingArv = purchasePrice + rehabBudget + financingCosts + closingCosts + taxes + insurance + minimumProfitBuffer;
        if (decisionBreakingArv <= 0) return "Insufficient Data";
        return `Supported ARV must remain above $${Math.round(decisionBreakingArv).toLocaleString()} to preserve a minimum profit buffer of $${minimumProfitBuffer.toLocaleString()}.`;
      }
      if (rehabBudget > 0 && rehabBudget > 50000) return `Rehab must remain below $${Math.max(0, rehabBudget).toLocaleString()} to preserve the recommendation.`;
      if (estimatedRent > 0) return `Monthly rent must remain above $${Math.round(estimatedRent).toLocaleString()} to preserve the recommendation.`;
      if (cashRequired > 0) return `Purchase price must remain below $${Math.round(purchasePrice).toLocaleString()} to preserve the recommendation.`;
      if (dscr > 0) return `DSCR must remain above ${dscr.toFixed(2)} to preserve the recommendation.`;
      return "Insufficient Data";
    })();

    const challenges = [
      buildChallenge(
        "Valuation Challenge",
        `Projected ARV ${formatCurrency(arv)}; Supported ARV ${formatCurrency(supportedArv)}`,
        `Projected ARV exceeds supported ARV or lacks support from comps/appraisal`,
        `Projected downside ARV impact: ${formatCurrency(Math.max(0, arv - supportedArv))}`,
        `Score effect: ${supportedArv <= 0 || compCount < 3 ? "Materially reduced" : "Moderate"}`,
        `Risk effect: ${supportedArv <= 0 || compCount < 3 ? "High" : "Moderate"}`,
        `Recommendation effect: ${supportedArv <= 0 || compCount < 3 ? "Weakens materially" : "Re-underwrite may be needed"}`,
        [supportedArv <= 0 || compCount < 3 ? "Insufficient comp support" : "ARV support is thin"],
        requiredCorrectiveActions.filter((action) => action.includes("appraisal") || action.includes("comps")),
      ),
      buildChallenge(
        "Rehab Challenge",
        `Rehab budget ${formatCurrency(rehabBudget)}`,
        `Rehab +10% / +20% / +30% and contingency exhaustion materially increase cost`,
        `Budget overrun impact: ${formatCurrency(rehabBudget * 0.3)}`,
        `Score effect: ${rehabBudget > 50000 ? "Materially reduced" : "Moderate"}`,
        `Risk effect: ${rehabBudget > 50000 ? "High" : "Moderate"}`,
        `Recommendation effect: ${rehabBudget > 50000 ? "Weakens materially" : "Needs review"}`,
        [rehabBudget > 50000 ? "Rehab budget may be understated" : "Rehab contingency not yet confirmed"],
        [rehabBudget > 50000 ? "Increase rehab contingency" : "Confirm rehab scope"],
      ),
      buildChallenge(
        "Financing Challenge",
        `Current financing requires ${formatCurrency(cashRequired)} cash and DSCR ${dscr.toFixed(2)}`,
        `Higher rate, fees, tighter LTC/LTARV, or lower DSCR pressure the deal`,
        `Monthly payment impact: ${formatCurrency(Math.max(0, cashRequired * 0.01))}`,
        `Score effect: ${financingWarnings.length ? "Materially reduced" : "Moderate"}`,
        `Risk effect: ${financingWarnings.length ? "High" : "Moderate"}`,
        `Recommendation effect: ${financingWarnings.length ? "Weakens materially" : "Needs lender review"}`,
        financingWarnings,
        requiredCorrectiveActions.filter((action) => action.includes("lender") || action.includes("liquidity")),
      ),
      buildChallenge(
        "Rental Challenge",
        `Current rent ${formatCurrency(estimatedRent)} and vacancy ${formatPercent(vacancyRate)}`,
        `Lower rent, higher vacancy, and higher operating expenses compress cash flow`,
        `Monthly cash flow impact: ${formatCurrency(Math.max(0, monthlyCashFlow * -1))}`,
        `Score effect: ${estimatedRent > 0 ? "Moderate" : "Materially reduced"}`,
        `Risk effect: ${estimatedRent > 0 ? "Moderate" : "High"}`,
        `Recommendation effect: ${estimatedRent > 0 ? "Weakens" : "Fails"}`,
        [estimatedRent <= 0 ? "Rent is unsupported" : "Rent sensitivity remains"],
        [estimatedRent <= 0 ? "Verify achievable rent" : "Re-check operating assumptions"],
      ),
      buildChallenge(
        "Market Challenge",
        `Buy box result ${buyBoxResult}; market score ${marketScore}`,
        `Outside buy box, weak rental demand, slow market, or weak liquidity pressure the value`,
        `Market support impact: ${marketScore < 60 ? "Material" : "Moderate"}`,
        `Score effect: ${marketScore < 60 ? "Materially reduced" : "Moderate"}`,
        `Risk effect: ${marketScore < 60 ? "High" : "Moderate"}`,
        `Recommendation effect: ${marketScore < 60 ? "Weakens materially" : "Needs market review"}`,
        warnings,
        requiredCorrectiveActions.filter((action) => action.includes("buy box") || action.includes("exit") || action.includes("strategy")),
      ),
      buildChallenge(
        "Exit Challenge",
        `Primary exit ${recommendedExit}`,
        `If the primary exit stalls, backup exit viability becomes the key concern`,
        `Exit viability impact: ${recommendedExit === "Insufficient Data" ? "High" : "Moderate"}`,
        `Score effect: ${recommendedExit === "Insufficient Data" ? "Materially reduced" : "Moderate"}`,
        `Risk effect: ${recommendedExit === "Insufficient Data" ? "High" : "Moderate"}`,
        `Recommendation effect: ${recommendedExit === "Insufficient Data" ? "Weakens materially" : "Needs backup plan"}`,
        [recommendedExit === "Hold" ? "No clear secondary exit" : "Exit still depends on market conditions"],
        [recommendedExit === "Hold" ? "Add a secondary exit strategy" : "Confirm backup exit"],
      ),
      buildChallenge(
        "Documentation Challenge",
        `Current warnings: ${warnings.length || 0}`,
        `Missing inspection, appraisal, title, insurance, lender, or scope documents can block the deal`,
        `Documentation impact: ${warnings.length ? "Material" : "Moderate"}`,
        `Score effect: ${warnings.length ? "Materially reduced" : "Moderate"}`,
        `Risk effect: ${warnings.length ? "High" : "Moderate"}`,
        `Recommendation effect: ${warnings.length ? "Weakens materially" : "Needs review"}`,
        warnings,
        requiredCorrectiveActions.filter((action) => action.includes("appraisal") || action.includes("review") || action.includes("scope")),
      ),
    ];

    return {
      strongestArgumentAgainstDeal,
      mostFragileAssumption,
      mostImportantMissingInformation,
      largestFinancialRisk,
      largestExecutionRisk,
      largestMarketRisk,
      largestFinancingRisk,
      largestExitRisk,
      downsideRecommendation,
      recommendationSurvivalResult,
      recommendationConfidence,
      confidenceReasons,
      decisionBreakingAssumption,
      requiredCorrectiveActions,
      challenges,
      summary: {
        survivalResult: recommendationSurvivalResult,
        recommendationConfidence,
        fragileAssumption: mostFragileAssumption,
        decisionBreakingThreshold: decisionBreakingAssumption,
        downsideRecommendation,
        criticalRiskCount: [largestFinancialRisk, largestExecutionRisk, largestMarketRisk, largestFinancingRisk, largestExitRisk].filter((entry) => entry && entry !== "Insufficient Data").length,
        decisionBlockingActionCount: requiredCorrectiveActions.filter((action) => action.includes("appraisal") || action.includes("lender") || action.includes("buy box") || action.includes("liquidity")).length,
      },
      metadata: {
        dealScore,
        overallRisk,
        buyBoxResult,
        arvConfidence,
        scenarioSurvivalResult,
      },
    };
  } catch {
    return {
      strongestArgumentAgainstDeal: "Insufficient Data",
      mostFragileAssumption: "Insufficient Data",
      mostImportantMissingInformation: "Insufficient Data",
      largestFinancialRisk: "Insufficient Data",
      largestExecutionRisk: "Insufficient Data",
      largestMarketRisk: "Insufficient Data",
      largestFinancingRisk: "Insufficient Data",
      largestExitRisk: "Insufficient Data",
      downsideRecommendation: "Insufficient Data",
      recommendationSurvivalResult: "Insufficient Data",
      recommendationConfidence: "Insufficient Data",
      confidenceReasons: ["Red-Team Review unavailable for this deal."],
      decisionBreakingAssumption: "Insufficient Data",
      requiredCorrectiveActions: [],
      challenges: [],
      summary: {
        survivalResult: "Insufficient Data",
        recommendationConfidence: "Insufficient Data",
        fragileAssumption: "Insufficient Data",
        decisionBreakingThreshold: "Insufficient Data",
        downsideRecommendation: "Insufficient Data",
        criticalRiskCount: 0,
        decisionBlockingActionCount: 0,
      },
      metadata: {},
    };
  }
}

function formatCurrency(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return "Insufficient Data";
  return `$${parsed.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

function formatPercent(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return "Insufficient Data";
  return `${(parsed * 100).toFixed(1)}%`;
}
