import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildUnifiedUnderwritingIntelligence } from '../app/src/components/intelligenceUpgradeEngine.js';
import { normalizeUnderwritingInputs } from '../app/src/components/underwritingInputNormalizer.js';
import { deriveUnifiedUnderwritingIntelligence } from './valuationOfferBuyBoxService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// Respect RSOS_DATA_DIR so intelligence state persists on Railway volumes.
const dataDir = process.env.RSOS_DATA_DIR
  ? path.resolve(process.env.RSOS_DATA_DIR)
  : path.join(__dirname, 'data');
const dealsFile = path.join(dataDir, 'deals.json');
const compsFile = path.join(dataDir, 'comps.json');
const neighborhoodsFile = path.join(dataDir, 'neighborhoods.json');
const dealIntelligenceFile = path.join(dataDir, 'deal-intelligence.json');

function safeNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function safeString(value, fallback = '') {
  return value === null || value === undefined || value === '' ? fallback : String(value);
}

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function buildUpload2Overlay(baseDeal, snapshot) {
  if (!snapshot || snapshot.ok === false) return {};

  const approvedArv = safeNumber(snapshot.valuationGovernance?.approvedArv);
  const recommendedArv = safeNumber(snapshot.valuationGovernance?.recommendedArv || snapshot.valuation?.supportedArv);
  const effectiveArv = approvedArv > 0 ? approvedArv : recommendedArv;
  const offer = snapshot.offer || {};
  const buyBox = snapshot.buyBox || {};

  const valuationWarnings = safeArray(snapshot.valuation?.warnings);
  const contradictionWarnings = safeArray(snapshot.contradictoryRecommendations);
  const requiredFollowUpItems = [
    ...valuationWarnings,
    ...contradictionWarnings,
    ...(snapshot.reviewRequired ? ['Review required before automation approval.'] : []),
  ];

  return {
    recommendedArv: recommendedArv || null,
    approvedArv: approvedArv || null,
    supportedARV: effectiveArv || 0,
    projectedARV: effectiveArv || 0,
    arvConfidence: snapshot.valuation?.confidence?.label || 'Low',
    arvConfidenceScore: safeNumber(snapshot.valuation?.confidence?.score),
    valuationReviewStatus: snapshot.valuation?.valuationReviewStatus || 'REVIEW_REQUIRED',
    appraisalReviewStatus: snapshot.valuation?.valuationReviewStatus || 'REVIEW_REQUIRED',
    lowBaseHighRange: {
      low: snapshot.valuation?.lowRange ?? null,
      base: snapshot.valuation?.baseRange ?? null,
      high: snapshot.valuation?.highRange ?? null,
    },
    recommendedOffer: safeNumber(offer.targetOffer),
    maximumAllowableOffer: safeNumber(offer.maximumAllowableOffer),
    walkAwayPrice: safeNumber(offer.walkAwayPrice),
    offerConfidenceScore: safeNumber(offer.confidence?.score),
    offerConfidenceLabel: safeString(offer.confidence?.label, 'LOW'),
    offerStatus: safeString(offer.offerStatus, 'PRELIMINARY_REVIEW_REQUIRED'),
    valuationSource: safeString(offer.valuationSource, 'RECOMMENDED_ARV_PRELIMINARY'),
    buyBoxResult: safeString(buyBox.result, 'REVIEW REQUIRED'),
    buyBoxConfidenceScore: safeNumber(buyBox.confidenceScore),
    buyBoxRecommendation: safeString(buyBox.recommendation, ''),
    buyBoxWarnings: safeArray(buyBox.warnings),
    buyBoxBlockers: safeArray(buyBox.blockers),
    contradictoryRecommendations: contradictionWarnings,
    decisionConfidence: safeNumber(snapshot.decisionConfidence),
    investmentDecision: {
      recommendation: safeString(snapshot.investmentDecision, 'REVIEW_REQUIRED'),
      confidence: safeNumber(snapshot.decisionConfidence),
      confidenceLabel: safeNumber(snapshot.decisionConfidence) >= 75 ? 'High' : safeNumber(snapshot.decisionConfidence) >= 55 ? 'Moderate' : 'Low',
      primaryFactors: [
        approvedArv > 0 ? 'Approved ARV exists' : 'Using recommended ARV pending approval',
        safeString(buyBox.result, 'REVIEW REQUIRED'),
      ],
      dealScore: safeNumber(snapshot.decisionConfidence),
      overallRisk: safeNumber(snapshot.reviewRequired ? 65 : 30),
      buyBoxResult: safeString(buyBox.result, 'REVIEW REQUIRED'),
      arvConfidence: safeString(snapshot.valuation?.confidence?.label, 'Low'),
      estimatedProfit: safeNumber(offer.expectedProfit),
      roi: safeNumber(offer.roi),
      monthlyCashFlow: safeNumber(offer.monthlyCashFlow),
      cashRequired: safeNumber(offer.requiredCash),
      qualificationStatus: snapshot.reviewRequired ? 'Review Required' : 'Qualified',
      recommendedNextActions: requiredFollowUpItems.length ? requiredFollowUpItems : ['Confirm final underwriting assumptions'],
    },
    requiredFollowUpItems: requiredFollowUpItems.length ? requiredFollowUpItems : ['Confirm final underwriting assumptions'],
    majorRiskFlags: requiredFollowUpItems,
    warnings: requiredFollowUpItems,
    reviewRequired: Boolean(snapshot.reviewRequired),
    underwritingStatus: snapshot.reviewRequired ? 'Preliminary - Review Required' : 'Ready',
    appraisalPacketSupport: snapshot.appraisalPacketSupport || null,
    valuationGovernance: snapshot.valuationGovernance || null,
    upload2GeneratedAt: new Date().toISOString(),
  };
}

function buildDealIntelligenceFromDeals(deals = [], overlaysByDealId = {}) {
  return (Array.isArray(deals) ? deals : []).map((deal, index) => {
    const upload2Overlay = buildUpload2Overlay(deal, overlaysByDealId?.[deal.id] || null);
    const normalizedInputs = normalizeUnderwritingInputs(deal);
    const underwriting = buildUnifiedUnderwritingIntelligence(deal, [], []);
    const purchasePrice = safeNumber(underwriting.normalizedDeal?.purchasePrice ?? deal.purchasePrice ?? deal.askingPrice ?? deal.listPrice ?? normalizedInputs.purchasePrice ?? 0);
    const rehabBudget = safeNumber(underwriting.normalizedDeal?.rehabBudget ?? deal.rehabBudget ?? deal.repairBudget ?? deal.renovationBudget ?? normalizedInputs.rehabBudget ?? 0);
    const overlayArv = safeNumber(upload2Overlay.supportedARV);
    const estimatedArv = overlayArv || safeNumber(underwriting.arvAnalysis?.supportedBaseArv ?? deal.estimatedArv ?? deal.arv ?? deal.projectedARV ?? deal.supportedARV ?? normalizedInputs.arv ?? 0);
    const estimatedRent = safeNumber(underwriting.normalizedDeal?.estimatedRent ?? deal.estimatedRent ?? deal.marketRent ?? deal.projectedRent ?? deal.monthlyRent ?? 0);
    const holdingMonths = safeNumber(underwriting.normalizedDeal?.holdingMonths ?? deal.holdingMonths ?? normalizedInputs.holdingMonths ?? 6);
    const taxes = safeNumber(underwriting.normalizedDeal?.taxes ?? deal.taxes ?? normalizedInputs.annualTaxes ?? 0);
    const insurance = safeNumber(underwriting.normalizedDeal?.insurance ?? deal.insurance ?? normalizedInputs.annualInsurance ?? 0);
    const financingCosts = safeNumber(underwriting.financingAnalysis?.financingCosts ?? deal.financingCosts ?? deal.financingCost ?? normalizedInputs.manualFinancingCosts ?? 0);
    const closingCosts = safeNumber(underwriting.flipAnalysis?.closingCosts ?? deal.closingCosts ?? normalizedInputs.acquisitionClosingCosts ?? 0);
    const projectedProfit = safeNumber(underwriting.flipAnalysis?.netProfit ?? 0);
    const projectedROI = safeNumber(underwriting.flipAnalysis?.returnOnCost ?? 0);
    const cashRequired = safeNumber(underwriting.financingAnalysis?.totalCashInvested ?? purchasePrice + rehabBudget);
    const loanAmount = safeNumber(underwriting.financingAnalysis?.actualLoanAmount ?? normalizedInputs.actualLoanAmount ?? deal.actualLoanAmount ?? deal.loanAmount ?? 0);
    const monthlyCarry = safeNumber(underwriting.financingAnalysis?.monthlyCarry ?? 0);
    const initialCashInvested = safeNumber(underwriting.financingAnalysis?.initialCashInvested ?? normalizedInputs.totalInitialCashInvested ?? deal.totalInitialCashInvested ?? 0);
    const constructionHoldback = safeNumber(underwriting.financingAnalysis?.constructionHoldback ?? normalizedInputs.constructionHoldback ?? deal.constructionHoldback ?? 0);
    const totalProjectCost = safeNumber(underwriting.flipAnalysis?.totalProjectCost ?? purchasePrice + rehabBudget + financingCosts + closingCosts + (taxes + insurance) * (holdingMonths / 12));
    const grossSpread = safeNumber(underwriting.flipAnalysis?.grossProfit ?? estimatedArv - totalProjectCost);
    const roi = totalProjectCost > 0 ? grossSpread / totalProjectCost : 0;
    const dealScore = Math.round(Math.max(0, Math.min(100, 40 + grossSpread / Math.max(estimatedArv, 1) * 40 + (estimatedRent > 0 ? 10 : 0) + (roi > 0 ? 10 : 0))));
    const rawDecision = (upload2Overlay.investmentDecision?.recommendation || underwriting.decisionConsistency?.recommendation || underwriting.recommendation?.action || 'REJECT').toString().trim().toUpperCase();
    const recommendation = rawDecision === 'BUY' ? 'Buy' : rawDecision === 'CONDITIONAL BUY' ? 'Conditional Buy' : rawDecision === 'REJECT' ? 'Do Not Purchase' : rawDecision === 'CONTINUE PROJECT' ? 'Continue Project' : rawDecision === 'CONTINUE REHAB' ? 'Continue Rehab' : rawDecision === 'HOLD' ? 'Hold' : 'Hold';
    const buyBoxResult = safeString(underwriting.buyBox?.status || underwriting.buyBox?.result || upload2Overlay.buyBoxResult || 'REVIEW', 'REVIEW').toUpperCase();
    const normalizedBuyBoxResult = buyBoxResult === 'CONDITIONAL' || buyBoxResult === 'CONDITIONAL PASS' || buyBoxResult === 'REVIEW REQUIRED' ? 'REVIEW' : buyBoxResult;
    const recommendedOffer = safeNumber(upload2Overlay.recommendedOffer) || Math.max(0, Math.min(purchasePrice + rehabBudget, estimatedArv * 0.86));
    const maximumAllowableOffer = safeNumber(upload2Overlay.maximumAllowableOffer) || Math.max(recommendedOffer, Math.min(purchasePrice + rehabBudget, estimatedArv * 0.9));
    const riskFlags = [];
    if (estimatedArv <= 0) riskFlags.push('Missing ARV support');
    if (rehabBudget > estimatedArv * 0.35) riskFlags.push('Rehab budget is aggressive');
    if (estimatedRent <= 0) riskFlags.push('Rental income is not yet supported');
    if (totalProjectCost > estimatedArv * 0.95) riskFlags.push('Project cost is near ARV');
    if (projectedProfit <= 0) riskFlags.push('Projected profit is weak');
    const investmentDecision = {
      recommendation,
      confidence: Math.max(55, Math.min(95, dealScore + 10)),
      confidenceLabel: recommendation === 'Buy' ? 'High' : recommendation === 'Conditional Buy' ? 'Moderate' : 'Low',
      primaryFactors: [estimatedArv > 0 ? 'ARV support exists' : 'ARV support is missing', rehabBudget > 0 ? 'Rehab scope is present' : 'Rehab scope is missing'],
      dealScore,
      overallRisk: dealScore < 60 ? 60 : 25,
      buyBoxResult,
      arvConfidence: estimatedArv > 0 ? 'Moderate' : 'Insufficient Data',
      estimatedProfit: projectedProfit,
      roi: projectedROI,
      monthlyCashFlow: monthlyCarry,
      cashRequired,
      qualificationStatus: 'Qualified',
      recommendedNextActions: upload2Overlay.requiredFollowUpItems || ['Confirm final underwriting assumptions'],
    };
    const exitStrategy = {
      recommendedStrategy: underwriting.exitStrategy?.recommendedStrategy || (dealScore >= 70 ? 'Flip' : estimatedRent > 0 ? 'BRRRR' : 'Wholesale'),
      rankedStrategies: [
        { strategy: 'Flip', score: dealScore >= 70 ? 0.86 : 0.42 },
        { strategy: 'BRRRR', score: estimatedRent > 0 ? 0.74 : 0.2 },
        { strategy: 'Rental', score: estimatedRent > 0 ? 0.68 : 0.18 },
      ],
      strategyScores: [
        { strategy: 'Flip', score: dealScore >= 70 ? 0.86 : 0.42 },
        { strategy: 'BRRRR', score: estimatedRent > 0 ? 0.74 : 0.2 },
        { strategy: 'Rental', score: estimatedRent > 0 ? 0.68 : 0.18 },
      ],
      summary: 'Strategy ranking generated from projected return and cash-flow support.',
    };
    const riskProfile = {
      overallRiskScore: Math.max(0, Math.min(100, Math.round((dealScore < 60 ? 70 : 30) + (estimatedRent <= 0 ? 15 : 0) + (rehabBudget > estimatedArv * 0.35 ? 12 : 0)))),
      overallRiskLabel: dealScore < 60 ? 'High' : 'Moderate',
      breakdown: [
        { category: 'Rehab', score: rehabBudget > estimatedArv * 0.35 ? 58 : 30, explanation: 'Rehab scope and contingency level determine execution risk.' },
        { category: 'Market', score: estimatedArv > 0 ? 26 : 65, explanation: 'Market support is implied by the current ARV assumptions.' },
        { category: 'Financing', score: financingCosts > 0 ? 28 : 20, explanation: 'Financing structure matters for total capital and carry.' },
      ],
      recommendedNextActions: riskFlags.length ? riskFlags : ['Confirm final underwriting assumptions'],
    };

    return {
      id: deal.id || `deal-intelligence-${index + 1}`,
      analysisName: `Deal Intelligence Review ${index + 1}`,
      analysisStatus: 'Ready',
      propertyId: deal.id || '',
      propertyName: safeString(deal.propertyAddress || deal.address || deal.propertyName, 'Unnamed Deal'),
      address: safeString(deal.propertyAddress || deal.address, ''),
      city: safeString(deal.city, ''),
      state: safeString(deal.state, ''),
      zipCode: safeString(deal.zipCode || deal.zip, ''),
      propertyType: safeString(deal.propertyType, 'Single Family'),
      strategy: safeString(deal.strategy, 'Hold'),
      bedrooms: safeNumber(deal.bedrooms),
      bathrooms: safeNumber(deal.bathrooms),
      squareFeet: safeNumber(deal.squareFeet),
      yearBuilt: safeNumber(deal.yearBuilt),
      askingPrice: purchasePrice,
      purchasePrice,
      rehabBudget,
      projectedARV: estimatedArv,
      supportedARV: estimatedArv,
      recommendedArv: upload2Overlay.recommendedArv ?? null,
      approvedArv: upload2Overlay.approvedArv ?? null,
      arvConfidence: upload2Overlay.arvConfidence || (estimatedArv > 0 ? 'Moderate' : 'Insufficient Data'),
      arvConfidenceScore: upload2Overlay.arvConfidenceScore || (estimatedArv > 0 ? 65 : 0),
      valuationReviewStatus: upload2Overlay.valuationReviewStatus || 'PRELIMINARY',
      appraisalReviewStatus: upload2Overlay.appraisalReviewStatus || upload2Overlay.valuationReviewStatus || 'PRELIMINARY',
      lowBaseHighRange: upload2Overlay.lowBaseHighRange || { low: null, base: null, high: null },
      dealScore,
      grade: dealScore >= 85 ? 'A' : dealScore >= 70 ? 'B' : dealScore >= 55 ? 'C' : dealScore >= 40 ? 'D' : 'F',
      recommendation,
      recommendationReason: 'Generated from normalized underwriting inputs.',
      requiredNextActions: estimatedArv > 0 ? ['Verify comp support', 'Confirm rehab assumptions'] : ['Input ARV support'],
      warnings: riskFlags,
      projectedProfit,
      projectedROI,
      projectedRent: estimatedRent,
      estimatedCashRequired: cashRequired,
      cashRequired,
      buyBoxResult: normalizedBuyBoxResult,
      buyBoxReason: underwriting.buyBox?.reasons?.[0] || 'Buy Box evaluation requires review.',
      overallRisk: dealScore < 60 ? 60 : 25,
      recommendedOffer,
      maximumAllowableOffer,
      walkAwayPrice: safeNumber(upload2Overlay.walkAwayPrice) || Math.max(0, recommendedOffer * 0.95),
      offerConfidenceScore: upload2Overlay.offerConfidenceScore || 0,
      offerConfidenceLabel: upload2Overlay.offerConfidenceLabel || 'LOW',
      offerStatus: upload2Overlay.offerStatus || 'PRELIMINARY_REVIEW_REQUIRED',
      valuationSource: upload2Overlay.valuationSource || 'RECOMMENDED_ARV_PRELIMINARY',
      underwritingSummary: `ARV ${estimatedArv > 0 ? `$${estimatedArv.toLocaleString()}` : 'Insufficient Data'} · Rehab ${rehabBudget > 0 ? `$${rehabBudget.toLocaleString()}` : 'Insufficient Data'} · Rent ${estimatedRent > 0 ? `$${estimatedRent.toLocaleString()}` : 'Insufficient Data'}`,
      offerGuidance: `Offer range ${recommendedOffer > 0 ? `$${recommendedOffer.toLocaleString()}` : 'Insufficient Data'} to ${maximumAllowableOffer > 0 ? `$${maximumAllowableOffer.toLocaleString()}` : 'Insufficient Data'}`,
      majorRiskFlags: upload2Overlay.majorRiskFlags || riskFlags,
      requiredFollowUpItems: upload2Overlay.requiredFollowUpItems || (riskFlags.length ? riskFlags : ['Confirm final underwriting assumptions']),
      investmentDecision: upload2Overlay.investmentDecision || investmentDecision,
      reviewRequired: upload2Overlay.reviewRequired || false,
      contradictoryRecommendations: upload2Overlay.contradictoryRecommendations || [],
      appraisalPacketSupport: upload2Overlay.appraisalPacketSupport || null,
      valuationGovernance: upload2Overlay.valuationGovernance || null,
      exitStrategy,
      riskProfile,
      actualLoanAmount: loanAmount,
      monthlyCarry,
      fourMonthInterest: safeNumber(underwriting.financingAnalysis?.totalInterest ?? 0),
      initialCashInvested,
      constructionHoldback,
      totalInitialCashInvested: initialCashInvested,
      createdAt: deal.createdAt || new Date().toISOString(),
      updatedAt: deal.updatedAt || new Date().toISOString(),
    };
  });
}

async function ensureDataFile(filePath, fallbackData) {
  await fs.mkdir(dataDir, { recursive: true });
  try {
    await fs.access(filePath);
  } catch {
    await fs.writeFile(filePath, `${JSON.stringify(fallbackData, null, 2)}\n`, 'utf8');
  }
}

async function readJsonArrayFile(filePath, fallbackData, label = 'data') {
  await ensureDataFile(filePath, fallbackData);
  try {
    const content = await fs.readFile(filePath, 'utf8');
    if (!content.trim()) return fallbackData;
    const parsed = JSON.parse(content);
    return Array.isArray(parsed) ? parsed : fallbackData;
  } catch {
    return fallbackData;
  }
}

async function readDealsFile() {
  return readJsonArrayFile(dealsFile, [], 'deals');
}

async function readCompsFile() {
  return readJsonArrayFile(compsFile, [], 'comps');
}

async function readNeighborhoodsFile() {
  return readJsonArrayFile(neighborhoodsFile, [], 'neighborhoods');
}

async function writeJsonFile(filePath, payload) {
  await fs.writeFile(filePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}

async function writeDealIntelligenceFile(analyses) {
  await writeJsonFile(dealIntelligenceFile, analyses);
}

async function buildUpload2OverlaysForDeals(deals = []) {
  const [comps, neighborhoods] = await Promise.all([readCompsFile(), readNeighborhoodsFile()]);
  const overlaysByDealId = {};
  for (const deal of safeArray(deals)) {
    const snapshot = deriveUnifiedUnderwritingIntelligence(deal, safeArray(comps), safeArray(neighborhoods), {});
    overlaysByDealId[deal.id] = {
      ok: true,
      reviewRequired: snapshot.reviewRequired,
      valuation: snapshot.valuation,
      valuationGovernance: snapshot.governance,
      offer: snapshot.offer,
      buyBox: snapshot.buyBox,
      appraisalPacketSupport: snapshot.appraisalPacketSupport,
      contradictoryRecommendations: snapshot.contradictoryRecommendations,
      decisionConfidence: snapshot.decisionConfidence,
      investmentDecision: snapshot.investmentDecision,
    };
  }
  return overlaysByDealId;
}

async function syncDealIntelligenceFromDeals(deals = []) {
  const overlaysByDealId = await buildUpload2OverlaysForDeals(deals);
  const generated = buildDealIntelligenceFromDeals(deals, overlaysByDealId);
  await writeDealIntelligenceFile(generated);
  return generated;
}

async function syncDealIntelligenceStore() {
  const deals = await readDealsFile();
  return syncDealIntelligenceFromDeals(deals);
}

async function getStoredOrGeneratedDealIntelligence(storedIntelligence, deals = []) {
  if (Array.isArray(storedIntelligence) && storedIntelligence.length > 0) {
    return storedIntelligence;
  }

  if (Array.isArray(storedIntelligence) && storedIntelligence.length === 0) {
    const normalizedDeals = Array.isArray(deals) ? deals : [];
    if (!normalizedDeals.length) {
      return [];
    }
    return syncDealIntelligenceFromDeals(normalizedDeals);
  }

  const normalizedDeals = Array.isArray(deals) ? deals : [];
  if (!normalizedDeals.length) {
    return [];
  }

  return syncDealIntelligenceFromDeals(normalizedDeals);
}

export { buildDealIntelligenceFromDeals, getStoredOrGeneratedDealIntelligence, syncDealIntelligenceStore };
