import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildUnifiedUnderwritingIntelligence } from '../app/src/components/intelligenceUpgradeEngine.js';
import { normalizeUnderwritingInputs } from '../app/src/components/underwritingInputNormalizer.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dataDir = path.join(__dirname, 'data');
const dealsFile = path.join(dataDir, 'deals.json');
const dealIntelligenceFile = path.join(dataDir, 'deal-intelligence.json');

function safeNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function safeString(value, fallback = '') {
  return value === null || value === undefined || value === '' ? fallback : String(value);
}

function buildDealIntelligenceFromDeals(deals = []) {
  return (Array.isArray(deals) ? deals : []).map((deal, index) => {
    const normalizedInputs = normalizeUnderwritingInputs(deal);
    const underwriting = buildUnifiedUnderwritingIntelligence(deal, [], []);
    const purchasePrice = safeNumber(underwriting.normalizedDeal?.purchasePrice ?? deal.purchasePrice ?? deal.askingPrice ?? deal.listPrice ?? normalizedInputs.purchasePrice ?? 0);
    const rehabBudget = safeNumber(underwriting.normalizedDeal?.rehabBudget ?? deal.rehabBudget ?? deal.repairBudget ?? deal.renovationBudget ?? normalizedInputs.rehabBudget ?? 0);
    const estimatedArv = safeNumber(underwriting.arvAnalysis?.supportedBaseArv ?? deal.estimatedArv ?? deal.arv ?? deal.projectedARV ?? deal.supportedARV ?? normalizedInputs.arv ?? 0);
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
    const rawDecision = (underwriting.decisionConsistency?.recommendation || underwriting.recommendation?.action || 'REJECT').toString().trim().toUpperCase();
    const recommendation = rawDecision === 'BUY' ? 'Buy' : rawDecision === 'CONDITIONAL BUY' ? 'Conditional Buy' : rawDecision === 'REJECT' ? 'Do Not Purchase' : rawDecision === 'CONTINUE PROJECT' ? 'Continue Project' : rawDecision === 'CONTINUE REHAB' ? 'Continue Rehab' : rawDecision === 'HOLD' ? 'Hold' : 'Hold';
    const buyBoxResult = safeString(underwriting.buyBox?.result || 'PASS', 'PASS').toUpperCase();
    const normalizedBuyBoxResult = buyBoxResult === 'CONDITIONAL' && purchasePrice > 0 && rehabBudget > 0 && estimatedArv > 0 ? 'PASS' : buyBoxResult;
    const recommendedOffer = Math.max(0, Math.min(purchasePrice + rehabBudget, estimatedArv * 0.86));
    const maximumAllowableOffer = Math.max(recommendedOffer, Math.min(purchasePrice + rehabBudget, estimatedArv * 0.9));
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
      recommendedNextActions: ['Confirm final underwriting assumptions'],
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
      arvConfidence: estimatedArv > 0 ? 'Moderate' : 'Insufficient Data',
      arvConfidenceScore: estimatedArv > 0 ? 65 : 0,
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
      buyBoxReason: 'Base deal data is complete enough for review.',
      overallRisk: dealScore < 60 ? 60 : 25,
      recommendedOffer,
      maximumAllowableOffer,
      walkAwayPrice: Math.max(0, recommendedOffer * 0.95),
      underwritingSummary: `ARV ${estimatedArv > 0 ? `$${estimatedArv.toLocaleString()}` : 'Insufficient Data'} · Rehab ${rehabBudget > 0 ? `$${rehabBudget.toLocaleString()}` : 'Insufficient Data'} · Rent ${estimatedRent > 0 ? `$${estimatedRent.toLocaleString()}` : 'Insufficient Data'}`,
      offerGuidance: `Offer range ${recommendedOffer > 0 ? `$${recommendedOffer.toLocaleString()}` : 'Insufficient Data'} to ${maximumAllowableOffer > 0 ? `$${maximumAllowableOffer.toLocaleString()}` : 'Insufficient Data'}`,
      majorRiskFlags: riskFlags,
      requiredFollowUpItems: riskFlags.length ? riskFlags : ['Confirm final underwriting assumptions'],
      investmentDecision,
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

async function writeJsonFile(filePath, payload) {
  await fs.writeFile(filePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}

async function writeDealIntelligenceFile(analyses) {
  await writeJsonFile(dealIntelligenceFile, analyses);
}

async function syncDealIntelligenceStore() {
  const deals = await readDealsFile();
  const generated = buildDealIntelligenceFromDeals(deals);
  await writeDealIntelligenceFile(generated);
  return generated;
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
    const generated = buildDealIntelligenceFromDeals(normalizedDeals);
    await writeDealIntelligenceFile(generated);
    return generated;
  }

  const normalizedDeals = Array.isArray(deals) ? deals : [];
  if (!normalizedDeals.length) {
    return [];
  }

  const generated = buildDealIntelligenceFromDeals(normalizedDeals);
  await writeDealIntelligenceFile(generated);
  return generated;
}

export { buildDealIntelligenceFromDeals, getStoredOrGeneratedDealIntelligence, syncDealIntelligenceStore };
