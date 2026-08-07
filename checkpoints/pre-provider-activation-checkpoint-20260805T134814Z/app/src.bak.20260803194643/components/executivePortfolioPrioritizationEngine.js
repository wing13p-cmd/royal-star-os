import { buildUnifiedUnderwritingIntelligence, normalizeDealForIntelligence } from './intelligenceUpgradeEngine.js';

function safeNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function safeDisplay(value, fallback = 'Insufficient Data') {
  if (value === null || value === undefined || value === '' || Number.isNaN(value)) return fallback;
  if (typeof value === 'number' && !Number.isFinite(value)) return fallback;
  if (typeof value === 'object') return fallback;
  return value;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function determinePriorityLevel(score, deal, analysis = {}) {
  const dealScore = safeNumber(analysis.dealScore || 0);
  const opportunityScore = safeNumber(analysis.opportunityScore || 0);
  const riskScore = safeNumber(analysis.overallRisk || 0);
  const forecastConfidence = safeNumber(analysis.forecastConfidence || 0);
  const buyBoxResult = String(analysis.buyBoxResult || '').toUpperCase();

  if (dealScore < 70 || opportunityScore < 65 || riskScore > 30 || forecastConfidence < 70 || buyBoxResult === 'CONDITIONAL PASS' || buyBoxResult === 'CONDITIONAL' || buyBoxResult === 'FAIL' || buyBoxResult === 'OUTSIDE BUY BOX') return 'Medium';
  if (score >= 85) return 'Critical';
  if (score >= 70) return 'High';
  if (score >= 50) return 'Medium';
  return 'Low';
}

function determineExecutiveAction(priorityLevel, deal, analysis) {
  if (priorityLevel === 'Critical') return 'Acquire Immediately';
  if (priorityLevel === 'High') return 'Submit Offer';
  if (priorityLevel === 'Medium') return safeNumber(analysis.estimatedFlipProfit ?? analysis.projectedProfit) > 0 ? 'Increase Offer' : 'Renegotiate';
  if (safeNumber(analysis.overallRisk) > 55 || safeNumber(analysis.cashRequired) > safeNumber(deal.cashOnHand) && safeNumber(deal.cashOnHand) > 0) return 'Delay';
  return 'Reject';
}

function buildDiversificationSignal(portfolioIntelligence = {}, deal = {}) {
  const summary = portfolioIntelligence?.summary || {};
  const totalProperties = safeNumber(summary.totalProperties || 0);
  const currentValue = safeNumber(summary.totalCurrentValue || 0);
  const valueAttribution = totalProperties > 0 && currentValue > 0 ? safeNumber(deal.purchasePrice || deal.askingPrice || 0) / currentValue : 0;
  if (totalProperties <= 0) return 50;
  if (valueAttribution > 0.25) return 25;
  if (valueAttribution > 0.15) return 40;
  return 70;
}

function buildCapitalEfficiencySignal(deal = {}, analysis = {}) {
  const projectedProfit = safeNumber(analysis.estimatedFlipProfit ?? analysis.projectedProfit ?? 0);
  const cashRequired = safeNumber(analysis.cashRequired || deal.rehabBudget || 0);
  const cashOnHand = safeNumber(deal.cashOnHand || 0);
  if (cashRequired <= 0) return 50;
  const efficiency = projectedProfit / Math.max(cashRequired, 1);
  if (efficiency >= 2) return 90;
  if (efficiency >= 1.2) return 75;
  if (efficiency >= 0.7) return 60;
  if (cashOnHand > 0 && cashRequired <= cashOnHand * 0.35) return 55;
  return 35;
}

function buildTimelineUrgencySignal(deal = {}, analysis = {}) {
  const risk = safeNumber(analysis.overallRisk || 0);
  const expectedProfit = safeNumber(analysis.estimatedFlipProfit ?? analysis.projectedProfit ?? 0);
  if (expectedProfit <= 0) return 20;
  if (risk <= 25) return 80;
  if (risk <= 40) return 60;
  return 40;
}

function buildManualOverrideSummary(deals = []) {
  const applied = deals.filter((deal) => safeNumber(deal.manualOfferAmount || deal.manualArv || deal.overrideOffer || deal.overrideArv) > 0);
  return {
    appliedCount: applied.length,
    protectedDeals: applied.map((deal) => deal.id || deal.propertyAddress || 'Unnamed Deal'),
  };
}

export function buildExecutivePortfolioPrioritizationEngine(payload = {}) {
  const deals = Array.isArray(payload.deals) ? payload.deals : [];
  const analysisByDeal = payload.analysisByDeal && typeof payload.analysisByDeal === 'object' ? payload.analysisByDeal : {};
  const portfolioIntelligence = payload.portfolioIntelligence && typeof payload.portfolioIntelligence === 'object' ? payload.portfolioIntelligence : {};
  const marketSignals = payload.marketSignals && typeof payload.marketSignals === 'object' ? payload.marketSignals : {};
  const normalizedDeals = deals.filter((deal) => String(deal?.status || '').toLowerCase() === 'active' || String(deal?.status || '').toLowerCase() === 'under review' || String(deal?.status || '').toLowerCase() === 'new');

  const rankings = normalizedDeals.map((deal) => {
    const normalizedDeal = normalizeDealForIntelligence(deal);
    const underwriting = buildUnifiedUnderwritingIntelligence(normalizedDeal, [], []);
    const analysis = analysisByDeal[deal.id] && typeof analysisByDeal[deal.id] === 'object' ? analysisByDeal[deal.id] : {};
    const marketSignal = marketSignals[deal.id] && typeof marketSignals[deal.id] === 'object' ? marketSignals[deal.id] : {};
    const dealScore = safeNumber(analysis.dealScore ?? underwriting.dealScore ?? underwriting.summary?.dealScore ?? 0);
    const opportunityScore = safeNumber(marketSignal.opportunityScore ?? analysis.opportunityScore ?? underwriting.opportunityAnalysis?.overallOpportunityScore ?? 0);
    const riskScore = safeNumber(analysis.overallRisk ?? underwriting.riskScore ?? underwriting.recommendation?.overallRisk ?? 0);
    const forecastConfidence = safeNumber(marketSignal.forecastConfidence ?? analysis.forecastConfidence ?? underwriting.forecastConfidence ?? 0);
    const marketTrend = safeNumber(marketSignal.marketTrend ?? underwriting.marketAnalysis?.marketTrendEngine?.appreciationTrend ?? 0);
    const diversification = buildDiversificationSignal(portfolioIntelligence, deal);
    const capitalEfficiency = buildCapitalEfficiencySignal(deal, analysis);
    const timelineUrgency = buildTimelineUrgencySignal(deal, analysis);

    const priorityScore = clamp(
      (dealScore * 0.22) + (opportunityScore * 0.2) + ((100 - riskScore) * 0.16) + (forecastConfidence * 0.14) + (marketTrend * 6) + (diversification * 0.08) + (capitalEfficiency * 0.08) + (timelineUrgency * 0.06),
      0,
      100,
    );

    const priorityLevel = determinePriorityLevel(priorityScore, deal, { ...analysis, opportunityScore, forecastConfidence, dealScore, overallRisk: riskScore, buyBoxResult: analysis.buyBoxResult });
    const manualOverrideProtected = safeNumber(deal.manualOfferAmount || deal.manualArv || deal.overrideOffer || deal.overrideArv) > 0;
    const recommendedExecutiveAction = determineExecutiveAction(priorityLevel, deal, analysis);

    return {
      id: deal.id || deal.propertyAddress || 'Unnamed Deal',
      propertyAddress: safeDisplay(deal.propertyAddress || deal.address || deal.propertyName || 'Unnamed Deal', 'Unnamed Deal'),
      strategy: safeDisplay(deal.strategy || 'Hold', 'Hold'),
      dealScore,
      opportunityScore,
      riskScore,
      forecastConfidence,
      marketTrend,
      diversification,
      capitalEfficiency,
      timelineUrgency,
      priorityScore: Math.round(priorityScore),
      priorityLevel,
      recommendedExecutiveAction,
      manualOverrideProtected,
      supportingSignals: [
        analysis.buyBoxResult || underwriting.buyBox?.result || 'Insufficient Data',
        analysis.recommendedOffer ? `Offer ${analysis.recommendedOffer}` : 'No explicit offer basis',
        safeDisplay(analysis.recommendedExit || deal.exitStrategy || 'Insufficient Data', 'Insufficient Data'),
      ],
    };
  }).sort((left, right) => right.priorityScore - left.priorityScore);

  const summary = {
    totalRankedDeals: rankings.length,
    priorityMix: {
      Critical: rankings.filter((entry) => entry.priorityLevel === 'Critical').length,
      High: rankings.filter((entry) => entry.priorityLevel === 'High').length,
      Medium: rankings.filter((entry) => entry.priorityLevel === 'Medium').length,
      Low: rankings.filter((entry) => entry.priorityLevel === 'Low').length,
    },
    highestPriority: rankings[0] || null,
    averagePriorityScore: rankings.length ? Math.round(rankings.reduce((sum, entry) => sum + entry.priorityScore, 0) / rankings.length) : 0,
  };

  return {
    rankings,
    summary,
    manualOverrideSummary: buildManualOverrideSummary(deals),
    portfolioSignal: {
      healthScore: safeNumber(portfolioIntelligence?.summary?.healthScore || 0),
      reserveShortfall: safeNumber(portfolioIntelligence?.summary?.reserveShortfallValue || 0),
    },
  };
}
