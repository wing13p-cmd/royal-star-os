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

function gradeForScore(score) {
  if (score >= 85) return "A";
  if (score >= 70) return "B";
  if (score >= 55) return "C";
  if (score >= 40) return "D";
  return "F";
}

function normalizeObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function mapDecisionStatus(recommendation, scenarioResult, redTeamResult) {
  const recommendationText = safeDisplay(recommendation, "Insufficient Data").toLowerCase();
  if (recommendationText.includes("conditional")) return "READY WITH CONDITIONS";
  if (recommendationText.includes("strong buy") || recommendationText.includes("buy")) return "READY TO OFFER";
  if (recommendationText.includes("re-underwrite")) return "RE-UNDERWRITE REQUIRED";
  if (recommendationText.includes("renegotiate")) return "RENEGOTIATION REQUIRED";
  if (recommendationText.includes("hold")) return "HOLD FOR INFORMATION";
  if (recommendationText.includes("pass")) return "PASS";
  if (recommendationText.includes("reject")) return "REJECT";
  if (scenarioResult === "Fails" || redTeamResult === "Fails") return "REJECT";
  return "INSUFFICIENT DATA";
}

function buildStrategyOption(name, metrics, deal, analysis, scenarioAnalysis) {
  const profit = safeNumber(metrics.profit ?? deal.estimatedFlipProfit ?? 0);
  const roi = safeNumber(metrics.roi ?? analysis.roi ?? 0);
  const monthlyCashFlow = safeNumber(metrics.monthlyCashFlow ?? analysis.monthlyCashFlow ?? 0);
  const cashRequired = safeNumber(metrics.cashRequired ?? analysis.cashRequired ?? 0);
  const cashLeft = safeNumber(metrics.cashLeftInDeal ?? analysis.cashLeftInDeal ?? 0);
  const dscr = safeNumber(metrics.dscr ?? analysis.dscr ?? 0);
  const risk = safeDisplay(metrics.risk ?? (profit <= 0 ? "High" : roi <= 0.05 ? "Moderate" : "Low"), "Insufficient Data");
  const viable = metrics.viable;

  const advantage = viable === false ? "Insufficient Data" : name === "Flip" ? "Strong upside potential" : name === "BRRRR" ? "Cash-flow support" : name === "Long-Term Rental" ? "Stable cash flow" : name === "Hold" ? "Preserves optionality" : name === "Wholesale" ? "Fast path to exit" : "Insufficient Data";
  const weakness = viable === false ? "Missing support data" : name === "Flip" ? "Requires strong exit timing" : name === "BRRRR" ? "Refi sensitivity" : name === "Long-Term Rental" ? "Needs rent support" : name === "Hold" ? "Limited upside" : name === "Wholesale" ? "Thin margin" : "Insufficient Data";

  return {
    strategyName: name,
    viability: viable === false ? "No" : viable === true ? "Yes" : "Insufficient Data",
    projectedProfit: formatCurrency(profit),
    projectedRoi: formatPercent(roi),
    monthlyCashFlow: formatCurrency(monthlyCashFlow),
    cashRequired: formatCurrency(cashRequired),
    cashLeftInDeal: formatCurrency(cashLeft),
    dscr: safeDisplay(dscr === 0 ? "Insufficient Data" : dscr, "Insufficient Data"),
    risk,
    scenarioSurvival: safeDisplay(scenarioAnalysis?.summary?.scenarioSurvivalResult || "Insufficient Data", "Insufficient Data"),
    keyAdvantage: advantage,
    keyWeakness: weakness,
  };
}

function collectStrengths(deal, analysis, scenarioAnalysis, redTeamReview) {
  const strengths = [];
  if (safeNumber(analysis.estimatedFlipProfit) > 0) strengths.push("Strong projected profit");
  if (safeNumber(analysis.roi) > 0.1) strengths.push("Strong ROI");
  if (safeNumber(analysis.marketScore) >= 70) strengths.push("High market score");
  if (safeDisplay(analysis.arvConfidence, "Insufficient Data") === "High" || safeDisplay(analysis.arvConfidence, "Insufficient Data") === "Very High") strengths.push("High ARV confidence");
  if (safeDisplay(analysis.qualificationStatus, "Insufficient Data") === "Qualified") strengths.push("Qualified financing");
  if (safeDisplay(scenarioAnalysis?.summary?.scenarioSurvivalResult, "Insufficient Data") === "Survives") strengths.push("Scenario survival is strong");
  if (safeDisplay(redTeamReview?.recommendationConfidence, "Insufficient Data") === "High" || safeDisplay(redTeamReview?.recommendationConfidence, "Insufficient Data") === "Very High") strengths.push("Red-Team confidence is strong");
  if (safeNumber(analysis.dealScore) >= 60) strengths.push("Overall deal score is supportive");
  return strengths.slice(0, 5);
}

function collectRisks(deal, analysis, scenarioAnalysis, redTeamReview) {
  const risks = [];
  if (safeDisplay(analysis.arvConfidence, "Insufficient Data") === "Very Low" || safeDisplay(analysis.arvConfidence, "Insufficient Data") === "Low") risks.push("Unsupported ARV");
  if (safeNumber(analysis.cashRequired) > safeNumber(deal.cashOnHand)) risks.push("Excessive cash required");
  if (safeNumber(scenarioAnalysis?.summary?.failingScenarioCount || 0) > 0) risks.push("Scenario failure");
  if (safeDisplay(redTeamReview?.recommendationSurvivalResult, "Insufficient Data") === "Fails") risks.push("Red-Team recommendation failure");
  if (safeNumber(analysis.dscr) < 1.2) risks.push("Low DSCR");
  if (safeNumber(analysis.estimatedFlipProfit) <= 0) risks.push("Negative projected profit");
  if (safeNumber(analysis.monthlyCashFlow) < 0) risks.push("Negative monthly cash flow");
  if (safeDisplay(analysis.buyBoxResult, "Insufficient Data") !== "PASS") risks.push("Outside buy box");
  if (safeDisplay(analysis.recommendedExit, "Insufficient Data") === "Insufficient Data") risks.push("No clear exit strategy");
  return risks.slice(0, 5);
}

function collectBlockingItems(deal, analysis, scenarioAnalysis) {
  const items = [];
  if (safeDisplay(analysis.arvConfidence, "Insufficient Data") === "Very Low" || safeDisplay(analysis.arvConfidence, "Insufficient Data") === "Low") {
    items.push({ item: "No supported ARV", reason: "The deal lacks confident valuation support.", owner: "Appraiser Packet Builder", priority: "Decision Blocking", dueStatus: "Pending", resolutionNeeded: "Obtain appraisal or stronger comps." });
  }
  if (safeNumber(analysis.cashRequired) > safeNumber(deal.cashOnHand)) {
    items.push({ item: "Liquidity gap", reason: "Cash-to-close exceeds available liquidity.", owner: "Lender Dashboard", priority: "Financial", dueStatus: "Pending", resolutionNeeded: "Increase liquidity or revise financing." });
  }
  if (safeDisplay(analysis.qualificationStatus, "Insufficient Data") !== "Qualified") {
    items.push({ item: "No lender approval", reason: "The financing path is not yet qualified.", owner: "Lender Dashboard", priority: "Financing", dueStatus: "Pending", resolutionNeeded: "Secure lender terms." });
  }
  if (safeDisplay(scenarioAnalysis?.summary?.scenarioSurvivalResult, "Insufficient Data") === "Fails") {
    items.push({ item: "Severe downside failure", reason: "The downside scenarios no longer support the recommendation.", owner: "Deal Analyzer", priority: "Decision Blocking", dueStatus: "Pending", resolutionNeeded: "Re-underwrite the deal." });
  }
  return items.slice(0, 5);
}

function collectNextActions(deal, analysis, scenarioAnalysis) {
  const actions = [];
  if (safeDisplay(analysis.arvConfidence, "Insufficient Data") === "Very Low" || safeDisplay(analysis.arvConfidence, "Insufficient Data") === "Low") {
    actions.push({ priority: "Decision Blocking", action: "Order appraisal and refresh comps", reason: "ARV support is weak.", relatedModule: "Comp Database", completionStatus: "Pending" });
  }
  if (safeNumber(analysis.cashRequired) > safeNumber(deal.cashOnHand)) {
    actions.push({ priority: "Financial", action: "Increase liquidity or lower the offer", reason: "Cash requirement exceeds available liquidity.", relatedModule: "Lender Dashboard", completionStatus: "Pending" });
  }
  if (safeNumber(analysis.rehabBudget) > 0 && safeNumber(analysis.rehabBudget) > 50000) {
    actions.push({ priority: "Rehab", action: "Validate rehab scope and contingency", reason: "Rehab costs may be understated.", relatedModule: "Rehab Project Tracker", completionStatus: "Pending" });
  }
  if (safeNumber(analysis.dscr) < 1.2) {
    actions.push({ priority: "Financing", action: "Request revised lender terms", reason: "DSCR is too weak for the current terms.", relatedModule: "Lender Dashboard", completionStatus: "Pending" });
  }
  if (safeDisplay(scenarioAnalysis?.summary?.scenarioSurvivalResult, "Insufficient Data") !== "Survives") {
    actions.push({ priority: "Valuation", action: "Re-underwrite with downside assumptions", reason: "The scenario survival result is weak.", relatedModule: "Deal Analyzer", completionStatus: "Pending" });
  }
  return actions.slice(0, 6);
}

function buildDecisionMatrix(deal, analysis, scenarioAnalysis, redTeamReview) {
  const categories = [
    {
      category: "Buy Box",
      score: safeNumber(analysis.dealScore),
      grade: gradeForScore(safeNumber(analysis.dealScore)),
      risk: safeDisplay(analysis.buyBoxResult === "PASS" ? "Low" : "High", "Insufficient Data"),
      status: safeDisplay(analysis.buyBoxResult === "PASS" ? "Pass" : analysis.buyBoxResult === "CONDITIONAL PASS" ? "Conditional" : "Fail", "Insufficient Data"),
      strength: analysis.buyBoxResult === "PASS" ? "Meets the default buy-box criteria" : "Insufficient Data",
      concern: analysis.buyBoxResult === "PASS" ? "None" : "The deal appears outside the target buy box",
      action: analysis.buyBoxResult === "PASS" ? "Monitor" : "Re-underwrite against the buy box",
    },
    {
      category: "Acquisition",
      score: safeNumber(analysis.dealScore),
      grade: gradeForScore(safeNumber(analysis.dealScore)),
      risk: safeDisplay(safeNumber(analysis.purchasePrice) > safeNumber(scenarioAnalysis?.baseScenario?.results?.recommendedOffer) ? "High" : "Moderate", "Insufficient Data"),
      status: safeDisplay(safeNumber(analysis.purchasePrice) <= safeNumber(scenarioAnalysis?.baseScenario?.results?.recommendedOffer) ? "Pass" : "Conditional", "Insufficient Data"),
      strength: safeNumber(analysis.purchasePrice) <= safeNumber(scenarioAnalysis?.baseScenario?.results?.recommendedOffer) ? "Purchase price is within the recommended range" : "Insufficient Data",
      concern: safeNumber(analysis.purchasePrice) > safeNumber(scenarioAnalysis?.baseScenario?.results?.recommendedOffer) ? "Purchase price exceeds the recommended offer" : "None",
      action: safeNumber(analysis.purchasePrice) > safeNumber(scenarioAnalysis?.baseScenario?.results?.recommendedOffer) ? "Negotiate down" : "Monitor",
    },
    {
      category: "Valuation",
      score: safeNumber(analysis.valuationScore),
      grade: gradeForScore(safeNumber(analysis.valuationScore)),
      risk: safeDisplay(analysis.arvConfidence === "Very Low" || analysis.arvConfidence === "Low" ? "High" : "Moderate", "Insufficient Data"),
      status: safeDisplay(analysis.arvConfidence === "High" || analysis.arvConfidence === "Very High" ? "Pass" : analysis.arvConfidence === "Moderate" ? "Conditional" : "Fail", "Insufficient Data"),
      strength: safeDisplay(analysis.arvConfidence === "High" || analysis.arvConfidence === "Very High" ? "ARV confidence is strong" : "Insufficient Data", "Insufficient Data"),
      concern: safeDisplay(analysis.arvConfidence === "Very Low" || analysis.arvConfidence === "Low" ? "ARV support is weak" : "None", "Insufficient Data"),
      action: safeDisplay(analysis.arvConfidence === "Very Low" || analysis.arvConfidence === "Low" ? "Obtain appraisal or stronger comps" : "Monitor", "Insufficient Data"),
    },
    {
      category: "Rehab",
      score: safeNumber(analysis.rehabScore),
      grade: gradeForScore(safeNumber(analysis.rehabScore)),
      risk: safeDisplay(safeNumber(analysis.rehabBudget) > 50000 ? "High" : "Moderate", "Insufficient Data"),
      status: safeDisplay(safeNumber(analysis.rehabBudget) <= 50000 ? "Pass" : "Conditional", "Insufficient Data"),
      strength: safeDisplay(safeNumber(analysis.rehabBudget) <= 50000 ? "Rehab cost remains manageable" : "Insufficient Data", "Insufficient Data"),
      concern: safeDisplay(safeNumber(analysis.rehabBudget) > 50000 ? "Rehab budget is large" : "None", "Insufficient Data"),
      action: safeDisplay(safeNumber(analysis.rehabBudget) > 50000 ? "Validate rehab contingency" : "Monitor", "Insufficient Data"),
    },
    {
      category: "Financing",
      score: safeNumber(analysis.financingScore),
      grade: gradeForScore(safeNumber(analysis.financingScore)),
      risk: safeDisplay(analysis.financingWarnings && analysis.financingWarnings.length ? "High" : "Moderate", "Insufficient Data"),
      status: safeDisplay(analysis.qualificationStatus === "Qualified" ? "Pass" : analysis.qualificationStatus ? "Conditional" : "Insufficient Data", "Insufficient Data"),
      strength: safeDisplay(analysis.qualificationStatus === "Qualified" ? "Financing is qualified" : "Insufficient Data", "Insufficient Data"),
      concern: safeDisplay(analysis.qualificationStatus !== "Qualified" ? "Financing still needs confirmation" : "None", "Insufficient Data"),
      action: safeDisplay(analysis.qualificationStatus !== "Qualified" ? "Request lender approval" : "Monitor", "Insufficient Data"),
    },
    {
      category: "Market",
      score: safeNumber(analysis.marketScore),
      grade: gradeForScore(safeNumber(analysis.marketScore)),
      risk: safeDisplay(safeNumber(analysis.marketScore) < 60 ? "High" : "Moderate", "Insufficient Data"),
      status: safeDisplay(safeNumber(analysis.marketScore) >= 70 ? "Pass" : safeNumber(analysis.marketScore) >= 50 ? "Conditional" : "Fail", "Insufficient Data"),
      strength: safeDisplay(safeNumber(analysis.marketScore) >= 70 ? "Market support is strong" : "Insufficient Data", "Insufficient Data"),
      concern: safeDisplay(safeNumber(analysis.marketScore) < 60 ? "Market support is weak" : "None", "Insufficient Data"),
      action: safeDisplay(safeNumber(analysis.marketScore) < 60 ? "Re-check market fundamentals" : "Monitor", "Insufficient Data"),
    },
    {
      category: "Rental",
      score: safeNumber(analysis.marketScore),
      grade: gradeForScore(safeNumber(analysis.marketScore)),
      risk: safeDisplay(safeNumber(analysis.monthlyCashFlow) < 0 ? "High" : "Moderate", "Insufficient Data"),
      status: safeDisplay(safeNumber(analysis.monthlyCashFlow) >= 0 ? "Pass" : "Conditional", "Insufficient Data"),
      strength: safeDisplay(safeNumber(analysis.monthlyCashFlow) >= 0 ? "Cash flow is positive" : "Insufficient Data", "Insufficient Data"),
      concern: safeDisplay(safeNumber(analysis.monthlyCashFlow) < 0 ? "Current rent assumptions are not supporting cash flow" : "None", "Insufficient Data"),
      action: safeDisplay(safeNumber(analysis.monthlyCashFlow) < 0 ? "Verify rent and expenses" : "Monitor", "Insufficient Data"),
    },
    {
      category: "Exit",
      score: safeNumber(analysis.dealScore),
      grade: gradeForScore(safeNumber(analysis.dealScore)),
      risk: safeDisplay(safeDisplay(analysis.recommendedExit, "Insufficient Data") === "Insufficient Data" ? "High" : "Moderate", "Insufficient Data"),
      status: safeDisplay(safeDisplay(analysis.recommendedExit, "Insufficient Data") === "Insufficient Data" ? "Fail" : "Conditional", "Insufficient Data"),
      strength: safeDisplay(analysis.recommendedExit !== "Insufficient Data" ? "An exit path is identified" : "Insufficient Data", "Insufficient Data"),
      concern: safeDisplay(analysis.recommendedExit === "Insufficient Data" ? "No clear exit path" : "None", "Insufficient Data"),
      action: safeDisplay(analysis.recommendedExit === "Insufficient Data" ? "Define a backup exit" : "Monitor", "Insufficient Data"),
    },
    {
      category: "Documentation",
      score: 50,
      grade: "C",
      risk: safeDisplay(safeNumber(analysis.warnings && analysis.warnings.length ? 1 : 0) > 0 ? "High" : "Moderate", "Insufficient Data"),
      status: safeDisplay(safeNumber(analysis.warnings && analysis.warnings.length ? 1 : 0) > 0 ? "Conditional" : "Pass", "Insufficient Data"),
      strength: safeDisplay(safeNumber(analysis.warnings && analysis.warnings.length ? 1 : 0) === 0 ? "Documentation appears complete" : "Insufficient Data", "Insufficient Data"),
      concern: safeDisplay(safeNumber(analysis.warnings && analysis.warnings.length ? 1 : 0) > 0 ? "Key documents or underwriting support are still missing" : "None", "Insufficient Data"),
      action: safeDisplay(safeNumber(analysis.warnings && analysis.warnings.length ? 1 : 0) > 0 ? "Gather missing documents" : "Monitor", "Insufficient Data"),
    },
    {
      category: "Scenario Survival",
      score: 50,
      grade: "C",
      risk: safeDisplay(scenarioAnalysis?.summary?.scenarioSurvivalResult === "Fails" ? "High" : scenarioAnalysis?.summary?.scenarioSurvivalResult === "Marginal" ? "Moderate" : "Low", "Insufficient Data"),
      status: safeDisplay(scenarioAnalysis?.summary?.scenarioSurvivalResult === "Survives" ? "Pass" : scenarioAnalysis?.summary?.scenarioSurvivalResult === "Survives with Conditions" ? "Conditional" : scenarioAnalysis?.summary?.scenarioSurvivalResult === "Marginal" ? "Conditional" : "Fail", "Insufficient Data"),
      strength: safeDisplay(scenarioAnalysis?.summary?.scenarioSurvivalResult === "Survives" ? "Base recommendation survives the base scenarios" : "Insufficient Data", "Insufficient Data"),
      concern: safeDisplay(scenarioAnalysis?.summary?.scenarioSurvivalResult === "Fails" ? "The base recommendation fails the downside scenarios" : "None", "Insufficient Data"),
      action: safeDisplay(scenarioAnalysis?.summary?.scenarioSurvivalResult === "Fails" ? "Re-underwrite the deal" : "Monitor", "Insufficient Data"),
    },
    {
      category: "Red-Team Review",
      score: 50,
      grade: "C",
      risk: safeDisplay(redTeamReview?.recommendationSurvivalResult === "Fails" ? "High" : redTeamReview?.recommendationSurvivalResult === "Marginal" ? "Moderate" : "Low", "Insufficient Data"),
      status: safeDisplay(redTeamReview?.recommendationSurvivalResult === "Fails" ? "Fail" : redTeamReview?.recommendationSurvivalResult === "Marginal" ? "Conditional" : redTeamReview?.recommendationSurvivalResult === "Survives" ? "Pass" : "Insufficient Data", "Insufficient Data"),
      strength: safeDisplay(redTeamReview?.recommendationSurvivalResult === "Survives" ? "The recommendation survives Red-Team challenge" : "Insufficient Data", "Insufficient Data"),
      concern: safeDisplay(redTeamReview?.recommendationSurvivalResult === "Fails" ? "The recommendation is not robust" : "None", "Insufficient Data"),
      action: safeDisplay(redTeamReview?.recommendationSurvivalResult === "Fails" ? "Revisit assumptions" : "Monitor", "Insufficient Data"),
    },
  ];

  return categories;
}

function buildKnownUncertainNeeded(deal, analysis, scenarioAnalysis) {
  const known = [];
  if (safeNumber(analysis.purchasePrice) > 0) known.push(`Purchase price: ${formatCurrency(analysis.purchasePrice)}`);
  if (safeNumber(analysis.estimatedFlipProfit) !== 0) known.push(`Projected profit: ${formatCurrency(analysis.estimatedFlipProfit)}`);
  if (safeNumber(analysis.estimatedFlipProfit) !== 0) known.push(`Projected ROI: ${formatPercent(analysis.roi)}`);
  if (safeNumber(analysis.cashRequired) !== 0) known.push(`Cash required: ${formatCurrency(analysis.cashRequired)}`);
  if (safeDisplay(scenarioAnalysis?.summary?.scenarioSurvivalResult, "Insufficient Data") !== "Insufficient Data") known.push(`Scenario survival: ${safeDisplay(scenarioAnalysis?.summary?.scenarioSurvivalResult, "Insufficient Data")}`);
  const uncertain = [];
  if (safeDisplay(analysis.arvConfidence, "Insufficient Data") === "Very Low" || safeDisplay(analysis.arvConfidence, "Insufficient Data") === "Low") uncertain.push("ARV confidence is weak");
  if (safeNumber(analysis.rehabBudget) <= 0) uncertain.push("Rehab budget is not confirmed");
  if (safeNumber(analysis.monthlyCashFlow) === 0) uncertain.push("Rental support remains uncertain");
  if (safeDisplay(analysis.qualificationStatus, "Insufficient Data") !== "Qualified") uncertain.push("Lender qualification remains uncertain");
  const needed = [];
  if (safeDisplay(analysis.arvConfidence, "Insufficient Data") === "Very Low" || safeDisplay(analysis.arvConfidence, "Insufficient Data") === "Low") needed.push("Appraisal");
  if (safeNumber(analysis.rehabBudget) <= 0) needed.push("Contractor bids");
  if (safeNumber(analysis.monthlyCashFlow) === 0) needed.push("Verified rent");
  if (safeDisplay(analysis.qualificationStatus, "Insufficient Data") !== "Qualified") needed.push("Lender term sheet");
  return { known: known.slice(0, 5), uncertain: uncertain.slice(0, 5), needed: needed.slice(0, 5) };
}

function buildScenarioSummary(scenarioAnalysis) {
  const summaries = [];
  const scenarios = Array.isArray(scenarioAnalysis?.scenarios) ? scenarioAnalysis.scenarios : [];
  const labels = ["Best Case", "Expected Case", "Moderate Downside", "Severe Downside", "Delayed Exit", "Refinance Stress", "Rental Stress"];
  for (let index = 0; index < labels.length; index += 1) {
    const entry = scenarios[index] || {};
    summaries.push({
      name: labels[index],
      profit: formatCurrency(entry?.summary?.profit ?? 0),
      roi: formatPercent(entry?.summary?.roi ?? 0),
      cashRequired: formatCurrency(entry?.summary?.cashRequired ?? 0),
      monthlyCashFlow: formatCurrency(entry?.summary?.monthlyCashFlow ?? 0),
      dscr: safeDisplay(entry?.summary?.dscr, "Insufficient Data"),
      recommendation: safeDisplay(entry?.summary?.recommendation || entry?.results?.recommendation, "Insufficient Data"),
      survivalResult: safeDisplay(entry?.summary?.survival || entry?.results?.survival, "Insufficient Data"),
    });
  }
  return summaries;
}

function buildRanking(allDealRecords, allDeals) {
  const ranking = [];
  for (let index = 0; index < allDealRecords.length; index += 1) {
    const record = allDealRecords[index] || {};
    const deal = allDeals[index] || {};
    ranking.push({
      id: deal.id || record.id || `deal-${index}`,
      property: safeDisplay(record.propertyAddress || record.address || deal.propertyAddress || deal.address || `Deal ${index + 1}`, "Untitled Deal"),
      recommendation: safeDisplay(record.recommendationDecision || record.recommendation?.primaryRecommendation, "Insufficient Data"),
      strategy: safeDisplay(record.recommendationStrategy || record.recommendation?.strategyRecommendation, "Insufficient Data"),
      score: safeNumber(record.dealScore),
      risk: safeNumber(record.riskScore),
      profit: safeNumber(record.estimatedFlipProfit),
      roi: safeNumber(record.roi),
      cashRequired: safeNumber(record.cashRequired),
      survivalResult: safeDisplay(record.scenarioSurvivalResult || record.recommendation?.survivalResult, "Insufficient Data"),
      redTeamConfidence: safeDisplay(record.redTeamConfidence || record.redTeamReview?.recommendationConfidence, "Insufficient Data"),
      buyBoxResult: safeDisplay(record.buyBoxResult, "Insufficient Data"),
    });
  }
  ranking.sort((a, b) => b.score - a.score);
  return ranking.slice(0, 8);
}

export function buildExecutiveDecisionDashboard(primaryDealAnalysis = {}, primaryDeal = {}, scenarioAnalysis = {}, redTeamReview = {}, allDealRecords = [], allDeals = []) {
  try {
    const analysis = primaryDealAnalysis && typeof primaryDealAnalysis === "object" && !Array.isArray(primaryDealAnalysis) ? primaryDealAnalysis : {};
    const deal = primaryDeal && typeof primaryDeal === "object" && !Array.isArray(primaryDeal) ? primaryDeal : {};
    const scenario = scenarioAnalysis && typeof scenarioAnalysis === "object" && !Array.isArray(scenarioAnalysis) ? scenarioAnalysis : {};
    const redTeam = redTeamReview && typeof redTeamReview === "object" && !Array.isArray(redTeamReview) ? redTeamReview : {};

    const purchasePrice = safeNumber(deal.purchasePrice ?? analysis.purchasePrice ?? deal.askingPrice ?? analysis.askingPrice);
    const askingPrice = safeNumber(deal.askingPrice ?? analysis.askingPrice ?? purchasePrice);
    const explicitMao = safeNumber(scenario?.baseScenario?.results?.mao ?? analysis.maximumAllowableOffer ?? analysis.mao ?? 0);
    const explicitRecommendedOffer = safeNumber(scenario?.baseScenario?.results?.recommendedOffer ?? analysis.recommendedOffer ?? analysis.recommendation?.executiveSummary?.recommendedOffer ?? 0);
    const explicitWalkAwayPrice = safeNumber(scenario?.baseScenario?.results?.walkAwayPrice ?? analysis.walkAwayPrice ?? 0);
    const derivedOfferMultiplier = safeNumber(analysis.dealScore) >= 80 ? 1.04 : safeNumber(analysis.dealScore) >= 70 ? 1.03 : safeNumber(analysis.dealScore) >= 60 ? 1.02 : 1.0;
    const mao = explicitMao > 0 ? explicitMao : purchasePrice > 0 ? purchasePrice * (safeNumber(analysis.dealScore) >= 70 ? 1.05 : 1.03) : 0;
    const recommendedOffer = explicitRecommendedOffer > 0 ? explicitRecommendedOffer : purchasePrice > 0 ? purchasePrice * derivedOfferMultiplier : 0;
    const walkAwayPrice = explicitWalkAwayPrice > 0 ? explicitWalkAwayPrice : purchasePrice > 0 ? purchasePrice * 0.97 : 0;
    const priceReductionNeeded = purchasePrice > recommendedOffer ? purchasePrice - recommendedOffer : 0;
    const riskBuffer = safeNumber(analysis.riskScore) > 60 ? recommendedOffer * 0.1 : safeNumber(analysis.riskScore) > 40 ? recommendedOffer * 0.05 : recommendedOffer * 0.03;
    const lowOffer = Math.max(0, recommendedOffer - riskBuffer);
    const highOffer = recommendedOffer;
    const overallRecommendation = safeDisplay(analysis.recommendationDecision || analysis.recommendation?.primaryRecommendation || analysis.recommendation?.executiveSummary?.overallRecommendation, "Insufficient Data");
    const recommendedStrategy = safeDisplay(analysis.recommendationStrategy || analysis.recommendation?.strategyRecommendation, "Insufficient Data");
    const secondaryStrategy = safeDisplay(analysis.secondaryStrategy || (recommendedStrategy === "Flip" ? "BRRRR" : recommendedStrategy === "BRRRR" ? "Hold" : recommendedStrategy === "Hold" ? "Flip" : "Insufficient Data"), "Insufficient Data");
    const dealScore = safeNumber(analysis.dealScore);
    const grade = gradeForScore(dealScore);
    const overallRisk = safeNumber(analysis.riskScore ?? analysis.overallRisk);
    const recommendationConfidence = safeDisplay(redTeam?.recommendationConfidence || analysis.recommendationConfidence, "Insufficient Data");
    const survivalResult = safeDisplay(scenario?.summary?.scenarioSurvivalResult || redTeam?.recommendationSurvivalResult || analysis.scenarioSurvivalResult, "Insufficient Data");
    const buyBoxResult = safeDisplay(analysis.buyBoxResult, "Insufficient Data");
    const backendStatus = safeDisplay(analysis.backendStatus || "Backend Connected", "Backend Connected");
    const decisionStatus = mapDecisionStatus(overallRecommendation, survivalResult, safeDisplay(redTeam?.recommendationSurvivalResult, "Insufficient Data"));
    const hasMeaningfulData = Boolean(
      purchasePrice || askingPrice || mao || recommendedOffer || walkAwayPrice || dealScore || overallRisk || safeDisplay(analysis.arvConfidence, "Insufficient Data") !== "Insufficient Data" || safeDisplay(analysis.recommendationDecision, "Insufficient Data") !== "Insufficient Data" || safeDisplay(analysis.recommendationStrategy, "Insufficient Data") !== "Insufficient Data"
    );

    let offerStatus = "Insufficient Data";
    if (recommendedOffer > 0) {
      if (purchasePrice > recommendedOffer) offerStatus = "Above Recommended Offer";
      else if (purchasePrice < recommendedOffer) offerStatus = "Below Recommended Offer";
      else if (purchasePrice > mao && mao > 0) offerStatus = "Above MAO";
      else if (purchasePrice > walkAwayPrice && walkAwayPrice > 0) offerStatus = "Above Walk-Away Price";
      else offerStatus = "Within Recommended Range";
    }

    const strategyOptions = [
      buildStrategyOption("Flip", { profit: safeNumber(analysis.estimatedFlipProfit), roi: safeNumber(analysis.roi), monthlyCashFlow: safeNumber(analysis.monthlyCashFlow), cashRequired: safeNumber(analysis.cashRequired), cashLeftInDeal: safeNumber(analysis.cashLeftInDeal), dscr: safeNumber(analysis.dscr), viable: safeNumber(analysis.estimatedFlipProfit) > 0 && safeNumber(analysis.roi) > 0 }, deal, analysis, scenario),
      buildStrategyOption("BRRRR", { profit: safeNumber(analysis.estimatedFlipProfit), roi: safeNumber(analysis.roi), monthlyCashFlow: safeNumber(analysis.monthlyCashFlow), cashRequired: safeNumber(analysis.cashRequired), cashLeftInDeal: safeNumber(analysis.cashLeftInDeal), dscr: safeNumber(analysis.dscr), viable: safeNumber(analysis.monthlyCashFlow) > 0 && safeNumber(analysis.dscr) >= 1.2 }, deal, analysis, scenario),
      buildStrategyOption("Long-Term Rental", { profit: safeNumber(analysis.estimatedFlipProfit), roi: safeNumber(analysis.roi), monthlyCashFlow: safeNumber(analysis.monthlyCashFlow), cashRequired: safeNumber(analysis.cashRequired), cashLeftInDeal: safeNumber(analysis.cashLeftInDeal), dscr: safeNumber(analysis.dscr), viable: safeNumber(analysis.monthlyCashFlow) > 0 }, deal, analysis, scenario),
      buildStrategyOption("Hold", { profit: safeNumber(analysis.estimatedFlipProfit), roi: safeNumber(analysis.roi), monthlyCashFlow: safeNumber(analysis.monthlyCashFlow), cashRequired: safeNumber(analysis.cashRequired), cashLeftInDeal: safeNumber(analysis.cashLeftInDeal), dscr: safeNumber(analysis.dscr), viable: safeNumber(analysis.dealScore) >= 40 }, deal, analysis, scenario),
      buildStrategyOption("Wholesale", { profit: safeNumber(analysis.estimatedFlipProfit), roi: safeNumber(analysis.roi), monthlyCashFlow: safeNumber(analysis.monthlyCashFlow), cashRequired: safeNumber(analysis.cashRequired), cashLeftInDeal: safeNumber(analysis.cashLeftInDeal), dscr: safeNumber(analysis.dscr), viable: safeNumber(analysis.dealScore) >= 55 && safeNumber(analysis.estimatedFlipProfit) > 0 }, deal, analysis, scenario),
      buildStrategyOption("Do Not Purchase", { profit: safeNumber(analysis.estimatedFlipProfit), roi: safeNumber(analysis.roi), monthlyCashFlow: safeNumber(analysis.monthlyCashFlow), cashRequired: safeNumber(analysis.cashRequired), cashLeftInDeal: safeNumber(analysis.cashLeftInDeal), dscr: safeNumber(analysis.dscr), viable: false }, deal, analysis, scenario),
    ];

    const explicitPrimaryStrategy = safeDisplay(analysis.recommendationStrategy || analysis.recommendation?.strategyRecommendation, "Insufficient Data");
    const primaryStrategy = strategyOptions.find((entry) => entry.strategyName === explicitPrimaryStrategy) || strategyOptions.find((entry) => entry.viability === "Yes") || strategyOptions[0] || {};
    const secondaryStrategyOption = strategyOptions.find((entry) => entry.viability === "Yes" && entry.strategyName !== primaryStrategy.strategyName) || strategyOptions[1] || {};
    const strategyToAvoid = strategyOptions.find((entry) => entry.viability === "No") || strategyOptions[strategyOptions.length - 1] || {};
    const explanation = safeDisplay(primaryStrategy?.strategyName ? `The ${primaryStrategy.strategyName} strategy is the best supported path based on current profitability, cash flow, and downside support.` : "Insufficient Data", "Insufficient Data");

    const strengths = collectStrengths(deal, analysis, scenario, redTeam);
    const risks = collectRisks(deal, analysis, scenario, redTeam);
    const blockingItems = collectBlockingItems(deal, analysis, scenario);
    const nextActions = collectNextActions(deal, analysis, scenario);
    const decisionMatrix = buildDecisionMatrix(deal, analysis, scenario, redTeam);
    const knownUncertainNeeded = buildKnownUncertainNeeded(deal, analysis, scenario);
    const scenarioSummary = buildScenarioSummary(scenario);
    const ranking = buildRanking(allDealRecords, allDeals);

    const executiveRecommendationEngine = analysis.executiveRecommendationEngine || {};
    const executiveDecisionExecutionEngine = analysis.executiveDecisionExecutionEngine || {};
    const executiveStrategyOptimizationEngine = analysis.executiveStrategyOptimizationEngine || {};
    const sharedExecutivePayload = normalizeObject(analysis.executivePayload);

    const executiveSummary = {
      finalDecision: decisionStatus,
      why: safeDisplay(strengths[0] || risks[0] || "Insufficient Data", "Insufficient Data"),
      recommendedStrategy: safeDisplay(sharedExecutivePayload.recommendedStrategy || recommendedStrategy, "Insufficient Data"),
      recommendedOffer: formatCurrency(recommendedOffer),
      maximumAllowableOffer: formatCurrency(mao),
      walkAwayPrice: formatCurrency(walkAwayPrice),
      expectedProfit: formatCurrency(safeNumber(analysis.estimatedFlipProfit)),
      expectedRoi: formatPercent(safeNumber(analysis.roi)),
      requiredCash: formatCurrency(safeNumber(analysis.cashRequired)),
      largestRisk: risks[0] || "Insufficient Data",
      strongestOpportunity: strengths[0] || "Insufficient Data",
      mostImportantMissingInformation: redTeam?.mostImportantMissingInformation || "Insufficient Data",
      requiredNextStep: nextActions[0]?.action || "Insufficient Data",
    };

    const primaryCards = hasMeaningfulData ? [
      { label: "Recommendation", value: overallRecommendation },
      { label: "Recommended Strategy", value: recommendedStrategy },
      { label: "Overall Deal Score", value: dealScore },
      { label: "Overall Risk", value: overallRisk },
      { label: "ARV Confidence", value: safeDisplay(analysis.arvConfidence, "Insufficient Data") },
      { label: "Maximum Allowable Offer", value: formatCurrency(mao) },
      { label: "Recommended Offer", value: formatCurrency(recommendedOffer) },
      { label: "Walk-Away Price", value: formatCurrency(walkAwayPrice) },
      { label: "Purchase Price", value: formatCurrency(purchasePrice) },
      { label: "Price Reduction Needed", value: formatCurrency(priceReductionNeeded) },
      { label: "Projected Profit", value: formatCurrency(safeNumber(analysis.estimatedFlipProfit)) },
      { label: "Projected ROI", value: formatPercent(safeNumber(analysis.roi)) },
      { label: "Cash Required", value: formatCurrency(safeNumber(analysis.cashRequired)) },
      { label: "Monthly Cash Flow", value: formatCurrency(safeNumber(analysis.monthlyCashFlow)) },
      { label: "DSCR", value: safeDisplay(safeNumber(analysis.dscr) === 0 ? "Insufficient Data" : analysis.dscr, "Insufficient Data") },
      { label: "Scenario Survival", value: survivalResult },
      { label: "Red-Team Confidence", value: recommendationConfidence },
      { label: "Critical Warning Count", value: safeNumber(analysis.warnings && analysis.warnings.length ? analysis.warnings.length : 0) },
      { label: "Missing Data Count", value: safeNumber((analysis.warnings && analysis.warnings.length ? 1 : 0) + (safeDisplay(analysis.arvConfidence, "Insufficient Data") === "Very Low" || safeDisplay(analysis.arvConfidence, "Insufficient Data") === "Low" ? 1 : 0)) },
    ] : [];

    return {
      executiveRecommendationEngine,
      executiveDecisionExecutionEngine,
      executiveStrategyOptimizationEngine,
      sharedExecutivePayload,
      header: {
        propertyAddress: safeDisplay(deal.propertyAddress || deal.address || analysis.propertyAddress || analysis.address || "Untitled Deal", "Untitled Deal"),
        analysisStatus: safeDisplay(backendStatus, "Backend Connected"),
        overallRecommendation: overallRecommendation,
        recommendedStrategy,
        secondaryStrategy,
        overallDealScore: dealScore,
        scoreGrade: grade,
        overallRisk,
        recommendationConfidence,
        recommendationSurvivalResult: survivalResult,
        buyBoxResult,
        backendStatus,
      },
      primaryCards,
      decisionStatus,
      offerDecision: {
        askingPrice: formatCurrency(askingPrice),
        currentPurchasePrice: formatCurrency(purchasePrice),
        maximumAllowableOffer: formatCurrency(mao),
        recommendedOffer: formatCurrency(recommendedOffer),
        walkAwayPrice: formatCurrency(walkAwayPrice),
        priceReductionNeeded: formatCurrency(priceReductionNeeded),
        estimatedSellerDiscountRequired: formatCurrency(Math.max(0, purchasePrice - recommendedOffer)),
        offerRange: { lowOffer: formatCurrency(lowOffer), highOffer: formatCurrency(highOffer) },
        offerStatus,
      },
      strategyDecision: {
        primaryStrategy: primaryStrategy.strategyName || "Insufficient Data",
        secondaryStrategy: secondaryStrategyOption.strategyName || "Insufficient Data",
        strategyToAvoid: strategyToAvoid.strategyName || "Insufficient Data",
        explanation,
        options: strategyOptions,
      },
      decisionMatrix,
      topStrengths: strengths,
      topRisks: risks,
      decisionBlockingItems: blockingItems,
      nextActionPlan: nextActions,
      executiveSummary,
      known: knownUncertainNeeded.known,
      uncertain: knownUncertainNeeded.uncertain,
      neededToImproveDecision: knownUncertainNeeded.needed,
      scenarioSummary,
      redTeamSummary: {
        strongestArgumentAgainstDeal: redTeam?.strongestArgumentAgainstDeal || "Insufficient Data",
        mostFragileAssumption: redTeam?.mostFragileAssumption || "Insufficient Data",
        decisionBreakingThreshold: redTeam?.decisionBreakingAssumption || "Insufficient Data",
        downsideRecommendation: redTeam?.downsideRecommendation || "Insufficient Data",
        recommendationConfidence: redTeam?.recommendationConfidence || "Insufficient Data",
        survivalResult: redTeam?.recommendationSurvivalResult || "Insufficient Data",
        requiredCorrectiveActions: redTeam?.requiredCorrectiveActions || [],
      },
      ranking,
    };
  } catch {
    return {
      header: {
        propertyAddress: "Insufficient Data",
        analysisStatus: "Insufficient Data",
        overallRecommendation: "Insufficient Data",
        recommendedStrategy: "Insufficient Data",
        secondaryStrategy: "Insufficient Data",
        overallDealScore: 0,
        scoreGrade: "F",
        overallRisk: 0,
        recommendationConfidence: "Insufficient Data",
        recommendationSurvivalResult: "Insufficient Data",
        buyBoxResult: "Insufficient Data",
        backendStatus: "Insufficient Data",
      },
      primaryCards: [],
      decisionStatus: "INSUFFICIENT DATA",
      offerDecision: {},
      strategyDecision: {},
      decisionMatrix: [],
      topStrengths: [],
      topRisks: [],
      decisionBlockingItems: [],
      nextActionPlan: [],
      executiveSummary: {
        finalDecision: "INSUFFICIENT DATA",
        why: "Executive Decision Dashboard unavailable for this deal.",
      },
      known: [],
      uncertain: [],
      neededToImproveDecision: [],
      scenarioSummary: [],
      redTeamSummary: {},
      ranking: [],
    };
  }
}
