import { buildCapitalAllocationEngine } from './capitalAllocationEngine.js';
import { buildPortfolioIntelligence } from './portfolioIntelligence.js';
import { buildRedTeamReview } from './redTeamReview.js';
import { buildExecutiveIntelligence } from './executiveIntelligence.js';
import { buildExecutivePortfolioPrioritizationEngine } from './executivePortfolioPrioritizationEngine.js';
import { buildExecutiveRecommendationEngine } from './executiveRecommendationEngine.js';
import { buildExecutiveDecisionExecutionEngine } from './executiveDecisionExecutionEngine.js';
import { buildExecutiveStrategyOptimizationEngine } from './executiveStrategyOptimizationEngine.js';
import { buildEnterpriseDataAndKnowledgeEngine } from './enterpriseKnowledgeEngine.js';
import { buildEnterpriseAiDecisionEngine } from './enterpriseAiDecisionEngine.js';
import {
  buildUnifiedUnderwritingIntelligence,
  buildPredictiveMarketIntelligence,
  buildOpportunityDetectionEngine,
  buildExecutiveMarketSummaryEngine,
  buildForecastConfidenceEngine,
  buildKnowledgeIntelligence,
  buildSearchIntelligence,
  buildReportingIntelligence,
  buildDocumentAutomationIntelligence,
  buildAiCommandRouting,
} from './intelligenceUpgradeEngine.js';

function safeNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function safeString(value, fallback = 'Insufficient Data') {
  if (value === null || value === undefined || value === '') return fallback;
  return typeof value === 'string' ? value : String(value);
}

function formatCurrency(value) {
  const parsed = safeNumber(value);
  if (!Number.isFinite(parsed)) return 'Insufficient Data';
  return `$${parsed.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
}

function normalizeDeal(deal) {
  return deal && typeof deal === 'object' && !Array.isArray(deal) ? deal : {};
}

function normalizeAnalysis(analysis) {
  return analysis && typeof analysis === 'object' && !Array.isArray(analysis) ? analysis : {};
}

function normalizeArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function buildEvidenceModel(deal, analysis) {
  const purchasePrice = safeNumber(deal.purchasePrice ?? deal.askingPrice);
  const rehabBudget = safeNumber(deal.rehabBudget);
  const arv = safeNumber(deal.estimatedArv ?? deal.arv ?? deal.projectedARV ?? deal.currentValue);
  const estimatedRent = safeNumber(deal.estimatedRent ?? deal.marketRent ?? deal.projectedRent);
  const supportedBaseArv = safeNumber(analysis.supportedBaseArv ?? deal.supportedBaseArv);
  const dealScore = safeNumber(analysis.dealScore);
  const cashRequired = safeNumber(analysis.cashRequired);
  const warnings = normalizeArray(analysis.warnings);
  const financingWarnings = normalizeArray(analysis.financingWarnings);

  const supportingFactors = [
    purchasePrice > 0,
    rehabBudget > 0,
    arv > 0,
    estimatedRent > 0,
    dealScore > 0,
    supportedBaseArv > 0,
    cashRequired > 0,
  ].filter(Boolean).length;

  const contradictoryFactors = warnings.length + financingWarnings.length + (purchasePrice > 0 && rehabBudget > 0 && arv > 0 && purchasePrice + rehabBudget > arv ? 1 : 0);
  const missingCriticalFields = [];
  if (purchasePrice <= 0) missingCriticalFields.push('Purchase price');
  if (rehabBudget <= 0) missingCriticalFields.push('Rehab budget');
  if (arv <= 0) missingCriticalFields.push('ARV');
  const rentalStrategy = /brrrr|rental|hold/i.test(String(deal.strategy || deal.exitStrategy || '')) || deal.evaluateRentalBackup === true;
  if (rentalStrategy && estimatedRent <= 0) missingCriticalFields.push('Rent support');
  if (supportedBaseArv <= 0) missingCriticalFields.push('Supported ARV');

  const dataCompleteness = clamp(Math.round((supportingFactors / 7) * 100), 0, 100);
  const evidenceStrength = clamp(dataCompleteness + (dealScore > 0 ? 5 : 0) - contradictoryFactors * 4, 0, 100);
  let confidenceScore = evidenceStrength;
  if (missingCriticalFields.length > 2) confidenceScore -= 20;
  if (warnings.length > 2 || financingWarnings.length > 2) confidenceScore -= 10;
  confidenceScore = clamp(confidenceScore, 0, 100);

  let confidenceLabel = 'INSUFFICIENT DATA';
  if (confidenceScore >= 85) confidenceLabel = 'HIGH';
  else if (confidenceScore >= 65) confidenceLabel = 'MODERATE';
  else if (confidenceScore >= 45) confidenceLabel = 'LOW';

  return {
    evidenceStrength,
    confidenceScore,
    confidenceLabel,
    dataCompleteness,
    supportingFactors,
    contradictoryFactors,
    missingCriticalFields,
    primaryUncertaintyDrivers: [
      supportedBaseArv <= 0 ? 'Valuation support is not yet established' : null,
      warnings[0] || null,
      financingWarnings[0] || null,
      missingCriticalFields[0] || null,
    ].filter(Boolean),
  };
}

function buildDealDecision(deal, analysis, evidenceModel) {
  const purchasePrice = safeNumber(deal.purchasePrice ?? deal.askingPrice);
  const projectedProfit = safeNumber(analysis.estimatedFlipProfit ?? analysis.projectedProfit ?? deal.projectedProfit ?? deal.profit);
  const roi = safeNumber(analysis.roi);
  const dscr = safeNumber(analysis.dscr);
  const monthlyCashFlow = safeNumber(analysis.monthlyCashFlow);
  const cashRequired = safeNumber(analysis.cashRequired);
  const cashOnHand = safeNumber(deal.cashOnHand);
  const warnings = normalizeArray(analysis.warnings);
  const financingWarnings = normalizeArray(analysis.financingWarnings);
  const buyBoxResult = safeString(analysis.buyBoxResult || deal.buyBoxResult, 'Insufficient Data');
  const maxOffer = safeNumber(analysis.maximumAllowableOffer ?? analysis.maxAllowableOffer ?? deal.maximumAllowableOffer);
  const recommendedOffer = safeNumber(analysis.recommendedOffer ?? deal.recommendedOffer);
  const risk = safeNumber(analysis.overallRisk);
  const rentalDecisionCritical = /brrrr|rental|hold/i.test(String(deal.strategy || deal.exitStrategy || '')) || deal.evaluateRentalBackup === true;

  const missingInformation = evidenceModel.missingCriticalFields.slice();
  if (buyBoxResult !== 'PASS' && buyBoxResult !== 'CONDITIONAL PASS') missingInformation.push('Buy-box fit');
  if (cashRequired > cashOnHand && cashOnHand > 0) missingInformation.push('Liquidity confirmation');
  if (warnings.length === 0 && financingWarnings.length === 0 && evidenceModel.confidenceLabel === 'HIGH' && projectedProfit > 0 && roi > 0.08 && (!rentalDecisionCritical || (dscr >= 1.2 && monthlyCashFlow >= 0)) && buyBoxResult === 'PASS') {
    return {
      recommendedAction: 'PROCEED',
      confidenceLabel: 'HIGH',
      confidenceScore: evidenceModel.confidenceScore,
      evidenceStrength: evidenceModel.evidenceStrength,
      dataCompleteness: evidenceModel.dataCompleteness,
      supportingFactors: evidenceModel.supportingFactors,
      contradictoryFactors: evidenceModel.contradictoryFactors,
      missingInformation: [],
      reasonsToProceed: [
        'The deal clears the core underwriting thresholds.',
        'Projected profit and ROI remain positive.',
        'The current financing and cash-flow profile are workable.',
      ],
      reasonsNotToProceed: [],
      requiredConditions: [
        'Confirm the final lender terms.',
        'Maintain reserve coverage through close.',
      ],
      suggestedNextAction: 'Move the deal to final offer review.',
      urgency: 'Medium',
      dealKillerConditions: [
        'A material ARV downgrade',
        'A large rehab cost overrun',
        'A financing shortfall or lender pullback',
      ],
      reUnderwritingTriggers: [
        'ARV changes materially',
        'Rehab budget increases materially',
        'Interest rate or loan terms move materially',
      ],
    };
  }

  if (purchasePrice > 0 && maxOffer > 0 && recommendedOffer > maxOffer) {
    return {
      recommendedAction: 'RENEGOTIATE',
      confidenceLabel: evidenceModel.confidenceLabel,
      confidenceScore: evidenceModel.confidenceScore,
      evidenceStrength: evidenceModel.evidenceStrength,
      dataCompleteness: evidenceModel.dataCompleteness,
      supportingFactors: evidenceModel.supportingFactors,
      contradictoryFactors: evidenceModel.contradictoryFactors,
      missingInformation,
      reasonsToProceed: [
        'There is still value if the seller is willing to reprice the deal.',
      ],
      reasonsNotToProceed: [
        'The recommended offer exceeds the current MAO or buy-box threshold.',
      ],
      requiredConditions: [
        'Lower the price to preserve underwriting.',
        'Verify the basis for the current valuation.',
      ],
      suggestedNextAction: 'Prepare a revised offer and seller counter strategy.',
      urgency: 'High',
      dealKillerConditions: [
        'The seller will not adjust pricing.',
        'The ARV support remains weak.',
      ],
      reUnderwritingTriggers: [
        'Offer price changes materially',
        'Comp support changes materially',
      ],
    };
  }

  if (evidenceModel.confidenceLabel === 'INSUFFICIENT DATA' || missingInformation.length > 2) {
    return {
      recommendedAction: 'REQUEST MORE DATA',
      confidenceLabel: 'INSUFFICIENT DATA',
      confidenceScore: evidenceModel.confidenceScore,
      evidenceStrength: evidenceModel.evidenceStrength,
      dataCompleteness: evidenceModel.dataCompleteness,
      supportingFactors: evidenceModel.supportingFactors,
      contradictoryFactors: evidenceModel.contradictoryFactors,
      missingInformation,
      reasonsToProceed: [],
      reasonsNotToProceed: [
        'Critical underwriting inputs are missing.',
        'The recommendation cannot be supported with current evidence.',
      ],
      requiredConditions: [
        'Gather comps and an appraisal update.',
        'Verify the rehab scope and cash-to-close figures.',
      ],
      suggestedNextAction: 'Request the missing data sets before advancing the deal.',
      urgency: 'High',
      dealKillerConditions: [
        'The deal remains unsupported after data collection.',
      ],
      reUnderwritingTriggers: [
        'A new appraisal is received',
        'A lender term sheet arrives',
      ],
    };
  }

  if (projectedProfit <= 0 || roi <= 0 || (rentalDecisionCritical && (monthlyCashFlow < 0 || dscr < 1)) || risk > 60 || warnings.some((warning) => warning.toLowerCase().includes('negative')) || financingWarnings.some((warning) => warning.toLowerCase().includes('critical')) || buyBoxResult !== 'PASS') {
    return {
      recommendedAction: 'PAUSE',
      confidenceLabel: evidenceModel.confidenceLabel,
      confidenceScore: evidenceModel.confidenceScore,
      evidenceStrength: evidenceModel.evidenceStrength,
      dataCompleteness: evidenceModel.dataCompleteness,
      supportingFactors: evidenceModel.supportingFactors,
      contradictoryFactors: evidenceModel.contradictoryFactors,
      missingInformation,
      reasonsToProceed: [],
      reasonsNotToProceed: [
        'The downside profile is weak or the financing is restrictive.',
        'The deal is not resilient enough to proceed confidently.',
      ],
      requiredConditions: [
        'Improve the downside assumptions.',
        'Recheck the purchase price and scope.',
      ],
      suggestedNextAction: 'Pause the deal and revisit underwriting.',
      urgency: 'High',
      dealKillerConditions: [
        'Profit cannot be achieved at the current price.',
        'The project cannot support the required reserve coverage.',
      ],
      reUnderwritingTriggers: [
        'The rehab budget changes materially',
        'The exit strategy changes',
      ],
    };
  }

  return {
    recommendedAction: 'PROCEED WITH CONDITIONS',
    confidenceLabel: evidenceModel.confidenceLabel,
    confidenceScore: evidenceModel.confidenceScore,
    evidenceStrength: evidenceModel.evidenceStrength,
    dataCompleteness: evidenceModel.dataCompleteness,
    supportingFactors: evidenceModel.supportingFactors,
    contradictoryFactors: evidenceModel.contradictoryFactors,
    missingInformation,
    reasonsToProceed: [
      'The deal has a positive economic profile.',
      'The current underwriting is sufficiently supported for conditional approval.',
    ],
    reasonsNotToProceed: [
      'The deal still relies on a few assumptions that need confirmation.',
    ],
    requiredConditions: [
      'Confirm comps and lender terms.',
      'Maintain contingency and reserve coverage.',
    ],
    suggestedNextAction: 'Advance to a formal offer with conditions.',
    urgency: 'Medium',
    dealKillerConditions: [
      'A major appraisal or comp shift',
      'A financing constraint or large change order',
    ],
    reUnderwritingTriggers: [
      'Any material variance in ARV, rent, or rehab cost',
      'A lender or contractor change',
    ],
  };
}

function buildRedTeamSummary(deal, analysis, redTeam) {
  const survivesRedTeam = redTeam?.summary?.survivalResult === 'Survives' || redTeam?.summary?.survivalResult === 'Survives with Conditions';
  return {
    survivesRedTeam,
    strongestArgumentAgainstDeal: redTeam?.strongestArgumentAgainstDeal || 'Insufficient Data',
    mostLikelyFailureScenario: redTeam?.largestFinancialRisk || 'Insufficient Data',
    highestImpactRisk: redTeam?.largestFinancingRisk || 'Insufficient Data',
    earliestWarningSign: redTeam?.requiredCorrectiveActions?.[0] || 'Insufficient Data',
    riskReductionAction: redTeam?.requiredCorrectiveActions?.[0] || 'Re-underwrite the deal',
  };
}

function buildOpportunityCost(deal, analysis, deals) {
  const dealList = normalizeArray(deals).filter((entry) => entry && entry.id !== deal.id);
  const projectedProfit = safeNumber(analysis.estimatedFlipProfit ?? analysis.projectedProfit);
  const baseAlternative = {
    option: 'Proceed now',
    expectedReturn: projectedProfit,
    cashRequired: safeNumber(analysis.cashRequired),
    risk: safeString(analysis.overallRisk > 40 ? 'High' : 'Moderate', 'Moderate'),
    timeline: 'Near-term',
    capitalLockup: safeNumber(analysis.cashRequired),
    downsideExposure: safeNumber(analysis.overallRisk),
    confidence: safeString(analysis.arvConfidence || 'Insufficient Data', 'Insufficient Data'),
    strategicFit: 'High',
  };

  const alternatives = [baseAlternative];
  if (dealList[0]) {
    const altDeal = dealList[0];
    alternatives.push({
      option: 'Reallocate capital to another deal',
      expectedReturn: safeNumber(altDeal.projectedProfit || altDeal.estimatedFlipProfit || 0),
      cashRequired: safeNumber(altDeal.rehabBudget || altDeal.purchasePrice || 0),
      risk: 'Moderate',
      timeline: 'Medium-term',
      capitalLockup: safeNumber(altDeal.rehabBudget || altDeal.purchasePrice || 0),
      downsideExposure: 45,
      confidence: 'Moderate',
      strategicFit: 'Moderate',
    });
  }
  alternatives.push({
    option: 'Take no action',
    expectedReturn: 0,
    cashRequired: 0,
    risk: 'Low',
    timeline: 'Immediate',
    capitalLockup: 0,
    downsideExposure: 0,
    confidence: 'High',
    strategicFit: 'High',
  });

  return { alternatives, preferredOption: alternatives[0].option };
}

function buildNegotiationIntelligence(deal, analysis) {
  const purchasePrice = safeNumber(deal.purchasePrice ?? deal.askingPrice);
  const maxOffer = safeNumber(analysis.maximumAllowableOffer ?? analysis.maxAllowableOffer ?? deal.maximumAllowableOffer);
  const recommendedOffer = safeNumber(analysis.recommendedOffer ?? deal.recommendedOffer ?? purchasePrice * 0.95);
  const walkAwayPrice = safeNumber(analysis.walkAwayPrice ?? deal.walkAwayPrice ?? Math.min(maxOffer || purchasePrice * 0.9, purchasePrice * 0.9));

  const initialOfferRecommendation = maxOffer > 0 ? Math.min(recommendedOffer, maxOffer) : Math.min(recommendedOffer, purchasePrice);
  const targetPrice = Math.min(initialOfferRecommendation, purchasePrice);
  const effectiveWalkAway = maxOffer > 0 ? Math.min(walkAwayPrice, maxOffer) : walkAwayPrice;
  const requiredPriceReduction = purchasePrice > targetPrice ? purchasePrice - targetPrice : 0;

  return {
    initialOfferRecommendation,
    targetPrice,
    walkAwayPrice: effectiveWalkAway,
    requiredPriceReduction,
    concessionStrategy: maxOffer > 0 && initialOfferRecommendation < purchasePrice ? 'Request a seller credit or repair credit rather than moving above MAO.' : 'Keep the deal disciplined around the current offer basis.',
    suggestedInspectionConditions: 'Require inspection, title, and repair-documentation review before moving to contract.',
    suggestedDueDiligenceConditions: 'Request current permits, utility records, and property-condition disclosures.',
    suggestedSellerCreditRequest: purchasePrice > targetPrice ? 'Request a seller credit for repairs or closing costs.' : 'No seller credit required at this time.',
    suggestedTimingStrategy: 'Keep the negotiation pace aligned with current comps and lender timing.',
    keyNegotiationLeverage: purchasePrice > targetPrice ? 'The seller is negotiating against a current price that exceeds the supported offer basis.' : 'The deal has a supported basis, so leverage remains with disciplined pricing.',
    negotiationRisks: purchasePrice > targetPrice ? ['The seller may hold out for a higher price.'] : ['The price may need to be adjusted if the valuation changes.'],
    informationToObtainBeforeIncreasingTheOffer: [
      'Updated comp support',
      'Repair scope and contingency detail',
      'A signed lender term sheet',
    ],
  };
}

function buildCounterofferAnalysis(deal, analysis, counterofferAmount) {
  const purchasePrice = safeNumber(deal.purchasePrice ?? deal.askingPrice);
  const target = safeNumber(analysis.recommendedOffer ?? deal.recommendedOffer ?? purchasePrice * 0.95);
  const mao = safeNumber(analysis.maximumAllowableOffer ?? analysis.maxAllowableOffer ?? deal.maximumAllowableOffer);
  const proposedAmount = safeNumber(counterofferAmount ?? target);
  const differenceFromTarget = proposedAmount - target;
  const differenceFromMao = proposedAmount - mao;
  const revisedProjectedProfit = safeNumber(analysis.estimatedFlipProfit) - Math.max(0, differenceFromTarget);
  const revisedCashRequired = safeNumber(analysis.cashRequired) + Math.max(0, differenceFromTarget * 0.1);
  const revisedMargin = safeNumber(analysis.roi) - (differenceFromTarget > 0 ? 0.01 : 0);
  const revisedDownsideResult = revisedProjectedProfit <= 0 ? 'Weak' : 'Managed';

  let recommendedResponse = 'HOLD';
  if (proposedAmount <= target && proposedAmount <= mao) recommendedResponse = 'ACCEPT WITH CONDITIONS';
  else if (proposedAmount > mao) recommendedResponse = 'WALK AWAY';
  else if (proposedAmount > target) recommendedResponse = 'COUNTER';

  return {
    counterofferAmount: proposedAmount,
    differenceFromTarget,
    differenceFromMao,
    revisedProjectedProfit,
    revisedCashRequired,
    revisedMargin,
    revisedBrRrrCashLeftInDeal: safeNumber(analysis.monthlyCashFlow),
    revisedDownsideResult,
    requiredConcessionToJustifyAcceptance: Math.max(0, target - proposedAmount),
    recommendedResponse,
  };
}

function buildRehabScopeIntelligence(deal, analysis, rehabProjects = []) {
  const rehabBudget = safeNumber(deal.rehabBudget);
  const arv = safeNumber(deal.estimatedArv ?? deal.arv ?? deal.projectedARV ?? deal.currentValue);
  const scopeRiskLevel = rehabBudget > 0 && arv > 0 && rehabBudget / arv > 0.35 ? 'High' : rehabBudget > 0 ? 'Moderate' : 'Insufficient Data';
  const projectList = normalizeArray(rehabProjects);
  const highestPriorityMissingItems = [];
  if (rehabBudget > 0 && !deal.rehabScopeSummary) highestPriorityMissingItems.push('Rehab scope breakdown');
  if (projectList.length === 0) highestPriorityMissingItems.push('Project milestone and draw plan');
  if (rehabBudget > 0 && rehabBudget > 50000) highestPriorityMissingItems.push('Contingency reserve');

  return {
    scopeRiskLevel,
    highestPriorityMissingItems: highestPriorityMissingItems.slice(0, 3),
    recommendedScopeReductions: rehabBudget > 50000 ? ['Remove non-essential cosmetic upgrades until the budget is confirmed.'] : [],
    recommendedValueAddAdditions: arv > 0 && rehabBudget > 0 ? ['Prioritize the most visible and code-critical improvements that support appraisal value.'] : [],
    budgetReallocationSuggestions: rehabBudget > 50000 ? ['Reallocate contingency to structural and mechanical scope before finish selections.'] : [],
    contingencyRecommendation: rehabBudget > 0 ? Math.max(5000, rehabBudget * 0.1) : 0,
    reUnderwritingTrigger: rehabBudget > 0 && rehabBudget / Math.max(arv, 1) > 0.25 ? 'Re-underwrite the rehab budget if the scope expands.' : 'No immediate trigger',
    expectedEffectOnArvOrRent: rehabBudget > 0 && rehabBudget / Math.max(arv, 1) > 0.2 ? 'Value-add scope should be confirmed against comparable sales and rental support.' : 'Limited effect until supporting data is confirmed.',
  };
}

function buildRehabSequenceGuidance(rehabProjects = []) {
  const projectList = normalizeArray(rehabProjects);
  const activeProject = projectList[0] || {};
  const phase = safeString(activeProject.currentPhase || activeProject.projectStatus || 'Not Started', 'Not Started');
  return {
    recommendedNextPhase: phase === 'Not Started' ? 'Site prep and permit verification' : 'Complete the current phase and collect inspection documentation',
    workThatMustBeCompletedFirst: ['Verify permits and inspections', 'Confirm materials and contractor availability'],
    tasksThatCanRunConcurrently: ['Order long-lead materials', 'Prepare draw documentation'],
    tasksThatShouldNotBeginYet: ['Final payment release', 'Cosmetic finish work before inspection'],
    documentationRequiredBeforePayment: ['Lien waivers', 'Invoice support', 'Inspection sign-off'],
    inspectionOrDrawReadiness: phase === 'In Progress' ? 'Ready for draw review if inspection proof is available' : 'Awaiting baseline documentation',
    scheduleRecoveryAction: 'Use the approved Royal Star sequence and close any missing prerequisites before advancing.',
  };
}

function buildContractorIntelligence(contractors = []) {
  const contractorList = normalizeArray(contractors);
  if (contractorList.length === 0) {
    return {
      recommendedContractor: 'Insufficient Data',
      alternativeContractor: 'Insufficient Data',
      confidence: 'INSUFFICIENT DATA',
      supportingPerformanceFactors: [],
      risks: ['No contractor data is available.'],
      conditionsBeforeAward: ['Confirm insurance and licensing.'],
      suggestedContractControls: ['Hold a fixed-scope agreement and require change-order approval.'],
      suggestedPaymentControls: ['Use draw milestones and lien-waiver documentation.'],
      suggestedDocumentationRequirements: ['Insurance certificate', 'Scope summary', 'Invoice backup'],
      escalationOrReplacementRecommendation: 'No award until contractor data is verified.',
    };
  }

  const ranked = contractorList
    .map((contractor) => ({
      contractor,
      score: safeNumber(contractor.performanceScore ?? contractor.qualityScore ?? contractor.rating),
    }))
    .sort((left, right) => right.score - left.score);
  const recommended = ranked[0]?.contractor || contractorList[0];
  const alternative = ranked[1]?.contractor || contractorList[1] || null;
  return {
    recommendedContractor: safeString(recommended?.contractorName || recommended?.companyName, 'Insufficient Data'),
    alternativeContractor: safeString(alternative?.contractorName || alternative?.companyName, 'Insufficient Data'),
    confidence: ranked[0]?.score >= 80 ? 'HIGH' : ranked[0]?.score >= 60 ? 'MODERATE' : 'LOW',
    supportingPerformanceFactors: [
      recommended?.performanceScore ? `Performance score ${recommended.performanceScore}` : null,
      recommended?.onTime ? `On-time delivery ${recommended.onTime}` : null,
      recommended?.documentationReady ? 'Document-ready workflow' : null,
    ].filter(Boolean),
    risks: recommended?.insuranceStatus === 'Expired' || recommended?.licenseStatus === 'Expired' ? ['Insurance or licensing issue.'] : ['Performance data remains incomplete.'],
    conditionsBeforeAward: ['Confirm insurance and licensing', 'Verify scope and contingency assumptions'],
    suggestedContractControls: ['Use a change-order approval threshold', 'Require milestone-based draws'],
    suggestedPaymentControls: ['Require lien waivers before payment', 'Match payment to documented progress'],
    suggestedDocumentationRequirements: ['Scope detail', 'Insurance certificate', 'Inspection sign-off'],
    escalationOrReplacementRecommendation: ranked[0]?.score < 60 ? 'Consider an alternate contractor if the preferred option is below the minimum threshold.' : 'No escalation required at this time.',
  };
}

function buildContractorBidComparison(bids = []) {
  const bidList = normalizeArray(bids);
  if (bidList.length === 0) {
    return {
      lowestQualifiedBid: 'Insufficient Data',
      bestValueBid: 'Insufficient Data',
      highestRiskBid: 'Insufficient Data',
      missingScopeWarnings: [],
      normalizedBidComparison: [],
      recommendedAwardDecision: 'REQUEST MORE DATA',
    };
  }

  const normalized = bidList.map((bid) => ({
    bidder: safeString(bid.bidder || bid.contractorName || bid.companyName, 'Unnamed Bidder'),
    totalBid: safeNumber(bid.totalBid || bid.amount),
    scopeCompleteness: safeString(bid.scopeCompleteness || 'Insufficient Data', 'Insufficient Data'),
    exclusions: safeString(bid.exclusions || 'Insufficient Data', 'Insufficient Data'),
  }));

  const ranked = normalized.slice().sort((left, right) => left.totalBid - right.totalBid);
  return {
    lowestQualifiedBid: ranked[0]?.bidder || 'Insufficient Data',
    bestValueBid: ranked.find((entry) => entry.scopeCompleteness !== 'Insufficient Data')?.bidder || ranked[0]?.bidder || 'Insufficient Data',
    highestRiskBid: normalized[normalized.length - 1]?.bidder || 'Insufficient Data',
    missingScopeWarnings: normalized.filter((entry) => entry.scopeCompleteness === 'Insufficient Data').map((entry) => `${entry.bidder} is missing scope detail.`),
    normalizedBidComparison: normalized,
    recommendedAwardDecision: 'REVIEW BEFORE AWARD',
  };
}

function buildLenderIntelligence(deal, analysis, lenders = []) {
  const lenderList = normalizeArray(lenders);
  if (lenderList.length === 0) {
    return {
      recommendedLender: 'Insufficient Data',
      lowestCostLender: 'Insufficient Data',
      lowestCashLender: 'Insufficient Data',
      lowestRiskLender: 'Insufficient Data',
      fastestFundingLender: 'Insufficient Data',
      keyTradeoffs: ['No lender data is available.'],
      conditions: [],
      maturityRisk: 'Insufficient Data',
      drawRisk: 'Insufficient Data',
      refinanceDependency: 'Insufficient Data',
      suggestedNegotiationItems: ['Confirm the interest rate and draw schedule.'],
    };
  }

  const ranked = lenderList
    .map((lender) => ({
      lender,
      score: safeNumber(lender.score ?? lender.financingScore) + (safeNumber(lender.interestRate) > 0 ? -10 : 0),
    }))
    .sort((left, right) => right.score - left.score);

  const recommended = ranked[0]?.lender || lenderList[0];
  return {
    recommendedLender: safeString(recommended?.lenderName || recommended?.loanProgramName || recommended?.name, 'Insufficient Data'),
    lowestCostLender: safeString(ranked[0]?.lender?.lenderName || ranked[0]?.lender?.loanProgramName || 'Insufficient Data', 'Insufficient Data'),
    lowestCashLender: safeString(ranked[0]?.lender?.lenderName || ranked[0]?.lender?.loanProgramName || 'Insufficient Data', 'Insufficient Data'),
    lowestRiskLender: safeString(ranked[0]?.lender?.lenderName || ranked[0]?.lender?.loanProgramName || 'Insufficient Data', 'Insufficient Data'),
    fastestFundingLender: safeString(ranked.find((entry) => safeNumber(entry.lender?.drawTurnaroundDays) <= 7)?.lender?.lenderName || 'Insufficient Data', 'Insufficient Data'),
    keyTradeoffs: [safeString(recommended?.notes || 'Terms remain to be confirmed.', 'Insufficient Data')],
    conditions: ['Confirm the final rate and fees', 'Verify the draw and refinance assumptions'],
    maturityRisk: safeNumber(analysis.cashRequired) > 0 ? 'Moderate' : 'Insufficient Data',
    drawRisk: safeNumber(analysis.cashRequired) > 0 ? 'Moderate' : 'Insufficient Data',
    refinanceDependency: safeNumber(analysis.cashRequired) > 0 ? 'High' : 'Insufficient Data',
    suggestedNegotiationItems: ['Reduce origination fees', 'Accelerate draw timing'],
  };
}

function buildPipelinePrioritization(deals = [], analysis = {}) {
  const dealList = normalizeArray(deals);
  const ranked = dealList.map((deal) => {
    const score = safeNumber(deal.dealScore ?? analysis.dealScore ?? 0);
    const risk = safeNumber(deal.riskScore ?? analysis.overallRisk ?? 0);
    return { deal, score: score - risk * 0.2 };
  }).sort((left, right) => right.score - left.score);

  return ranked.map((entry, index) => ({
    rank: index + 1,
    propertyName: safeString(entry.deal.propertyAddress || entry.deal.propertyName || 'Unnamed Deal', 'Unnamed Deal'),
    recommendedNextAction: entry.score > 60 ? 'Advance to offer review' : 'Collect more data',
    urgency: entry.score > 80 ? 'High' : 'Medium',
    confidence: entry.score > 80 ? 'HIGH' : entry.score > 60 ? 'MODERATE' : 'LOW',
    blockingInformation: entry.score > 60 ? 'None' : 'Comp and lender terms remain incomplete',
    reasonForRank: entry.score > 60 ? 'Supports the current underwriting basis' : 'Needs more data before a strong ranking is possible',
  }));
}

function buildPortfolioIntelligenceSummary(portfolioIntelligence = {}) {
  const portfolio = portfolioIntelligence && typeof portfolioIntelligence === 'object' ? portfolioIntelligence : {};
  return {
    portfolioHealthAssessment: safeString(portfolio.summary?.healthStatus || portfolio.health?.status || 'Insufficient Data', 'Insufficient Data'),
    primaryPortfolioRisk: portfolio.summary?.reserveShortfallValue > 0 ? 'Reserve shortfall' : 'Insufficient Data',
    primaryPortfolioOpportunity: portfolio.summary?.healthScore >= 80 ? 'Strong recurring cash-flow capacity' : 'Insufficient Data',
    recommendedAssetLevelActions: ['Protect reserve coverage', 'Confirm lender terms'],
    recommendedCapitalActions: ['Preserve liquidity', 'Prioritize rehab and refinance needs'],
    reUnderwritingRecommendations: ['Re-underwrite any deal with a material assumption change'],
    monitoringPriorities: ['Reserve coverage', 'Lender maturity dates', 'Rehab progress'],
  };
}

function buildExitStrategyOptimization(deal, analysis) {
  const projectedProfit = safeNumber(analysis.estimatedFlipProfit ?? analysis.projectedProfit);
  const monthlyCashFlow = safeNumber(analysis.monthlyCashFlow);
  if (projectedProfit > 0 && monthlyCashFlow > 0) {
    return {
      recommendedExit: 'Flip',
      alternativeExit: 'BRRRR',
      conditionsThatWouldChangeRecommendation: ['A material ARV downgrade', 'A cash-flow shortfall'],
      breakEvenTrigger: 'Projected profit falls below zero',
      marketOrFinancingTrigger: 'Lender terms tighten or sale velocity slows',
      reUnderwritingTrigger: 'The exit strategy changes or the hold period extends',
    };
  }
  if (monthlyCashFlow > 0) {
    return {
      recommendedExit: 'BRRRR',
      alternativeExit: 'Hold',
      conditionsThatWouldChangeRecommendation: ['The rent support weakens', 'The refinance terms tighten'],
      breakEvenTrigger: 'Cash flow turns negative',
      marketOrFinancingTrigger: 'Refinance terms become restrictive',
      reUnderwritingTrigger: 'The refinance assumption changes materially',
    };
  }
  return {
    recommendedExit: 'Hold',
    alternativeExit: 'Delay',
    conditionsThatWouldChangeRecommendation: ['Supportive comp and lender data arrive'],
    breakEvenTrigger: 'The projected return becomes positive',
    marketOrFinancingTrigger: 'Market liquidity improves',
    reUnderwritingTrigger: 'A new appraisal or lender term sheet arrives',
  };
}

function buildExecutiveSummary(deal, analysis, evidenceModel, dealDecision, portfolioIntelligence) {
  const healthScore = safeNumber(portfolioIntelligence?.summary?.healthScore);
  const summaryStatus = healthScore >= 80 ? 'Strong' : healthScore >= 60 ? 'Watch' : 'INSUFFICIENT DATA';
  return {
    summaryStatus,
    overallBusinessStatus: summaryStatus,
    portfolioHealth: safeString(portfolioIntelligence?.summary?.healthStatus || 'INSUFFICIENT DATA', 'INSUFFICIENT DATA'),
    capitalStatus: safeString(portfolioIntelligence?.summary?.reserveShortfallValue > 0 ? 'Capital Shortfall' : 'Capital Available', 'INSUFFICIENT DATA'),
    highestPriorityOpportunity: safeString(deal.propertyAddress || deal.propertyName || 'Insufficient Data', 'Insufficient Data'),
    highestPriorityRisk: dealDecision.recommendedAction === 'REQUEST MORE DATA' ? 'Critical underwriting data is missing' : 'The current downside profile requires disciplined review',
    activeDealCount: 'Insufficient Data',
    activeRehabCount: 'Insufficient Data',
    cashDeployed: formatCurrency(portfolioIntelligence?.summary?.totalCashDeployed || 0),
    requiredReserve: formatCurrency(portfolioIntelligence?.summary?.recommendedReserve || 0),
    pipelineValue: 'Insufficient Data',
    expectedActiveFlipProfit: formatCurrency(analysis.estimatedFlipProfit ?? analysis.projectedProfit ?? 0),
    upcomingMaturity: 'Insufficient Data',
    recommendedExecutiveActions: [
      dealDecision.recommendedAction === 'PROCEED' ? 'Advance the best-supported deal' : 'Protect reserve coverage and re-underwrite',
      'Confirm the next underwriting data gap',
    ],
    missingCriticalInformation: evidenceModel.missingCriticalFields.slice(0, 3),
    confidenceLevel: evidenceModel.confidenceLabel,
  };
}

function buildCognitiveBiasChecks(deal, analysis, dealDecision) {
  const checks = [];
  if (safeNumber(deal.askingPrice ?? deal.purchasePrice) > 0 && safeNumber(analysis.maximumAllowableOffer ?? analysis.maxAllowableOffer) > 0 && safeNumber(deal.askingPrice ?? deal.purchasePrice) > safeNumber(analysis.maximumAllowableOffer ?? analysis.maxAllowableOffer)) {
    checks.push({
      biasDetected: 'Anchoring to asking price',
      evidence: 'The asking price exceeds the supported offer basis.',
      decisionAffected: dealDecision.recommendedAction,
      correctiveAction: 'Use the supported offer basis to reset the negotiation stance.',
      reUnderwritingRecommended: true,
    });
  }
  if (dealDecision.recommendedAction === 'PROCEED' && safeNumber(analysis.overallRisk) > 35) {
    checks.push({
      biasDetected: 'Optimism bias',
      evidence: 'The deal is moving forward despite a moderate downside risk score.',
      decisionAffected: dealDecision.recommendedAction,
      correctiveAction: 'Add a red-team review before finalizing the decision.',
      reUnderwritingRecommended: true,
    });
  }
  return checks;
}

function buildReUnderwritingTriggers(deal, analysis) {
  const triggers = [];
  if (safeNumber(analysis.arvConfidence) <= 0) triggers.push('ARV confidence changes materially');
  if (safeNumber(deal.rehabBudget) > 0 && safeNumber(analysis.estimatedFlipProfit ?? analysis.projectedProfit) <= 0) triggers.push('Projected profit falls below zero');
  if (safeNumber(analysis.cashRequired) > 0) triggers.push('Cash-to-close changes materially');
  if (safeNumber(analysis.overallRisk) > 50) triggers.push('Overall risk rises materially');
  return triggers.slice(0, 4);
}

function buildKnowledgeBaseLessons(deal, analysis) {
  return [
    {
      lesson: 'Use verified valuation support before advancing a deal above the target offer basis.',
      evidence: safeNumber(analysis.supportedBaseArv) > 0 ? 'Supported ARV available' : 'Supported ARV missing',
      confidence: 'Moderate',
    },
  ];
}

function buildEstimateVersusActualReview(rehabProjects = []) {
  const projectList = normalizeArray(rehabProjects);
  return projectList.map((project) => ({
    propertyName: safeString(project.propertyName || project.projectName, 'Unnamed Project'),
    variance: project.actualCost && project.estimatedCost ? safeNumber(project.actualCost) - safeNumber(project.estimatedCost) : 0,
    reason: project.reason || 'Insufficient Data',
    lesson: 'Revisit the scope assumptions when the variance is material.',
    recommendedUnderwritingStandardUpdate: 'Review the contingency assumption before the next deal.',
    confidence: 'Moderate',
  }));
}

function buildAppraiserPacketIntelligence(deal, comps = []) {
  const compList = normalizeArray(comps);
  const strongestComps = compList.slice(0, 3).map((comp) => safeString(comp.compAddress || comp.address || comp.compName, 'Unnamed Comp'));
  return {
    strongestSupportingComps: strongestComps,
    weakCompsToExclude: compList.filter((comp) => safeNumber(comp.distanceMiles) > 10).slice(0, 2).map((comp) => safeString(comp.compAddress || comp.address || comp.compName, 'Unnamed Comp')),
    scopeItemsMostRelevantToValue: ['Kitchen and bath modernization', 'Exterior curb appeal', 'Mechanical and roof condition'],
    missingDocumentation: [deal.appraisedValue ? null : 'Appraisal support', 'Repair scope summary'].filter(Boolean),
    beforeAfterEvidenceNeeded: ['Before photos', 'Scope photos', 'Permits and invoices'],
    arvSupportSummary: safeNumber(deal.estimatedArv ?? deal.arv ?? deal.projectedARV) > 0 ? 'Current valuation is supported by the available evidence.' : 'Valuation evidence remains incomplete.',
    confidence: safeString(deal.estimatedArv ? 'Moderate' : 'Insufficient Data', 'Insufficient Data'),
  };
}

function buildAuditHistory(deal, dealDecision, redTeam) {
  return [
    {
      timestamp: new Date().toISOString(),
      affectedRecord: safeString(deal.propertyAddress || deal.propertyName || deal.id || 'Unnamed Deal', 'Unnamed Deal'),
      action: 'Recommendation generated',
      priorRecommendation: 'Insufficient Data',
      revisedRecommendation: dealDecision.recommendedAction,
    },
    {
      timestamp: new Date().toISOString(),
      affectedRecord: safeString(deal.propertyAddress || deal.propertyName || deal.id || 'Unnamed Deal', 'Unnamed Deal'),
      action: 'Red-team result updated',
      priorRecommendation: 'Insufficient Data',
      revisedRecommendation: redTeam.survivesRedTeam ? 'Survives red team' : 'Needs re-underwriting',
    },
  ];
}

function buildExecutiveDecisionEngine(deal, analysis, evidenceModel, dealDecision, portfolioIntelligence, redTeam, comps = [], neighborhoods = []) {
  const underwriting = buildUnifiedUnderwritingIntelligence(deal, comps, neighborhoods);
  const market = buildPredictiveMarketIntelligence(deal, neighborhoods, comps);
  const opportunity = buildOpportunityDetectionEngine(
    deal,
    {
      confidenceLevel: underwriting.arvAnalysis?.confidenceLevel || analysis.arvConfidence || 'Insufficient Data',
      comparableConfidence: {
        overallConfidenceScore: underwriting.arvAnalysis?.comparableConfidence?.overallConfidenceScore ?? 0,
        averageRankScore: underwriting.arvAnalysis?.comparableConfidence?.averageRankScore ?? 0,
      },
      supportedBaseArv: underwriting.arvAnalysis?.supportedBaseArv ?? 0,
    },
    market,
    { result: underwriting.buyBox?.result || analysis.buyBoxResult },
    {
      cashOnCashReturn: safeNumber(underwriting.brrrrAnalysis?.cashOnCashReturn),
      equityCreated: safeNumber(underwriting.brrrrAnalysis?.equityCreated),
      dealScore: safeNumber(analysis.dealScore),
    },
    {
      cashOnCashReturn: safeNumber(underwriting.brrrrAnalysis?.cashOnCashReturn),
      cashLeftInDeal: safeNumber(underwriting.brrrrAnalysis?.cashLeftInDeal),
      debtServiceCoverageRatio: safeNumber(underwriting.brrrrAnalysis?.debtServiceCoverageRatio),
      monthlyCashFlow: safeNumber(underwriting.brrrrAnalysis?.monthlyCashFlow),
    },
    {
      profitMargin: safeNumber(underwriting.flipAnalysis?.profitMargin),
      netProfit: safeNumber(underwriting.flipAnalysis?.netProfit),
      returnOnCost: safeNumber(underwriting.flipAnalysis?.returnOnCost),
    },
    {
      monthlyCashFlow: safeNumber(underwriting.brrrrAnalysis?.monthlyCashFlow),
      netOperatingIncome: safeNumber(underwriting.brrrrAnalysis?.netOperatingIncome),
      cashOnCashReturn: safeNumber(underwriting.brrrrAnalysis?.cashOnCashReturn),
    },
  );
  const forecast = buildForecastConfidenceEngine(
    deal,
    {
      confidenceLevel: underwriting.arvAnalysis?.confidenceLevel || analysis.arvConfidence || 'Insufficient Data',
      compEvaluations: underwriting.arvAnalysis?.compEvaluations || [],
      compSpread: underwriting.arvAnalysis?.compSpread || 0,
      comparableConfidence: underwriting.arvAnalysis?.comparableConfidence,
    },
    market,
    { opportunityAnalysis: opportunity },
  );
  const marketSummary = buildExecutiveMarketSummaryEngine(deal, underwriting.arvAnalysis, market, opportunity, forecast, { action: dealDecision.recommendedAction });

  let primaryRecommendation = 'Hold';
  if (dealDecision.recommendedAction === 'PROCEED') primaryRecommendation = 'Buy';
  else if (dealDecision.recommendedAction === 'PROCEED WITH CONDITIONS') primaryRecommendation = 'Buy with Conditions';
  else if (dealDecision.recommendedAction === 'RENEGOTIATE') primaryRecommendation = 'Renegotiate';
  else if (dealDecision.recommendedAction === 'REQUEST MORE DATA' || dealDecision.recommendedAction === 'PAUSE') primaryRecommendation = safeNumber(analysis.estimatedFlipProfit ?? analysis.projectedProfit) <= 0 || safeNumber(analysis.overallRisk) > 50 ? 'Reject' : 'Hold';
  else if (dealDecision.recommendedAction === 'REJECT') primaryRecommendation = 'Reject';

  const confidenceScore = clamp(Math.round((safeNumber(evidenceModel.confidenceScore) * 0.45) + (safeNumber(forecast.forecastConfidence) * 0.35) + (safeNumber(analysis.dealScore) * 0.2)), 0, 100);
  let confidenceLabel = 'INSUFFICIENT DATA';
  if (confidenceScore >= 85) confidenceLabel = 'HIGH';
  else if (confidenceScore >= 65) confidenceLabel = 'MODERATE';
  else if (confidenceScore >= 45) confidenceLabel = 'LOW';

  const reasoning = [];
  if (safeNumber(analysis.estimatedFlipProfit ?? analysis.projectedProfit) > 0) reasoning.push('Projected profitability remains positive.');
  if (safeString(analysis.buyBoxResult || underwriting.buyBox?.result || 'Insufficient Data') === 'PASS') reasoning.push('The deal remains aligned to the current buy-box criteria.');
  if (safeNumber(analysis.monthlyCashFlow) > 0 || safeNumber(underwriting.brrrrAnalysis?.monthlyCashFlow) > 0) reasoning.push('The cash-flow profile is supportive under the current assumptions.');
  if (safeNumber(portfolioIntelligence?.summary?.healthScore) >= 60) reasoning.push('Portfolio health supports a disciplined deployment of capital.');
  if (redTeam?.survivesRedTeam) reasoning.push('The red-team review remains constructive.');
  if (reasoning.length === 0) reasoning.push('The current evidence supports a conservative next step until more data arrives.');

  const watchItems = [];
  if (safeNumber(analysis.cashRequired) > safeNumber(deal.cashOnHand) && safeNumber(deal.cashOnHand) > 0) watchItems.push('Cash-to-close still exceeds available liquidity.');
  if (safeNumber(analysis.supportedBaseArv) <= 0) watchItems.push('Valuation support still needs confirmation.');
  if (safeString(analysis.buyBoxResult || underwriting.buyBox?.result || 'Insufficient Data') !== 'PASS') watchItems.push('Buy-box fit requires further review.');
  if (watchItems.length === 0) watchItems.push('No immediate watch items are visible.');

  return {
    primaryRecommendation,
    recommendedStrategy: safeString(analysis.recommendationStrategy || analysis.strategy || underwriting.flipAnalysis?.netProfit > 0 ? 'Flip' : 'Hold', 'Hold'),
    confidenceScore,
    confidenceLabel,
    reasoning: reasoning.slice(0, 4),
    supportingSignals: [
      marketSummary?.executiveSummary?.overallMarketRating || 'Insufficient Data',
      marketSummary?.executiveRecommendation?.label || 'Insufficient Data',
      safeString(analysis.buyBoxResult || underwriting.buyBox?.result || 'Insufficient Data', 'Insufficient Data'),
    ],
    watchItems: watchItems.slice(0, 3),
    marketSummary,
    underwriting,
    recommendedAction: dealDecision.recommendedAction,
  };
}

function buildPropertyRecommendationEntry(deal, analysis, index = 0) {
  const dealProfit = safeNumber(analysis?.estimatedFlipProfit ?? analysis?.projectedProfit ?? deal?.projectedProfit ?? deal?.profit);
  const dealRoi = safeNumber(analysis?.roi ?? deal?.roi);
  const risk = safeNumber(analysis?.overallRisk ?? deal?.riskScore ?? 0);
  const projectedCashFlow = safeNumber(analysis?.monthlyCashFlow ?? deal?.monthlyCashFlow);
  const capitalRequirement = safeNumber(analysis?.cashRequired ?? deal?.cashRequired);
  const propertyName = safeString(deal?.propertyAddress || deal?.propertyName || deal?.address || `Deal ${index + 1}`, `Deal ${index + 1}`);

  let recommendation = 'Watch';
  if (dealProfit > 0 && dealRoi >= 0.12 && risk <= 25) recommendation = 'Buy';
  else if (dealProfit > 0 && projectedCashFlow > 0) recommendation = 'BRRRR';
  else if (dealProfit > 0) recommendation = 'Flip';
  else if (capitalRequirement > 0 && risk <= 40) recommendation = 'Hold';
  else if (risk > 50) recommendation = 'Pass';
  else if (dealRoi > 0.08) recommendation = 'Refinance';

  return {
    propertyName,
    recommendation,
    confidence: risk <= 20 ? 'High' : risk <= 35 ? 'Moderate' : 'Low',
    roi: dealRoi,
    risk,
    timeHorizon: dealProfit > 0 ? 'Near-term' : 'Watchlist',
    capitalRequirement,
    recommendedExitStrategy: dealProfit > 0 ? 'Flip' : 'Hold',
    nextAction: dealProfit > 0 ? 'Advance underwriting and confirm lender terms' : 'Collect comps and valuation support',
  };
}

function buildScenarioAnalysisModel(deal, analysis) {
  const projectedProfit = safeNumber(analysis?.estimatedFlipProfit ?? analysis?.projectedProfit ?? deal?.projectedProfit ?? deal?.profit);
  const monthlyCashFlow = safeNumber(analysis?.monthlyCashFlow ?? deal?.monthlyCashFlow);
  const roi = safeNumber(analysis?.roi ?? deal?.roi);
  const risk = safeNumber(analysis?.overallRisk ?? deal?.riskScore ?? 0);

  return {
    currentPlan: {
      scenario: 'Current Plan',
      recommendation: projectedProfit > 0 ? 'Proceed' : 'Hold',
      projectedProfit,
      roi,
      risk,
      rationale: projectedProfit > 0 ? 'The current basis supports a disciplined offer.' : 'The current basis remains conservative until more data arrives.',
    },
    bestFlip: {
      scenario: 'Best Flip',
      recommendation: 'Flip',
      projectedProfit: projectedProfit + 20000,
      roi: Math.max(roi, 0.16),
      risk: Math.max(0, risk - 8),
      rationale: 'A tighter scope and faster resale improves upside.',
    },
    bestBrrrr: {
      scenario: 'Best BRRRR',
      recommendation: 'BRRRR',
      projectedProfit: Math.max(projectedProfit, monthlyCashFlow * 12),
      roi: Math.max(roi, 0.14),
      risk: Math.max(0, risk - 6),
      rationale: 'Rental support and debt service coverage improve the hold strategy.',
    },
    bestHold: {
      scenario: 'Best Hold',
      recommendation: 'Hold',
      projectedProfit: Math.max(projectedProfit, monthlyCashFlow * 6),
      roi: Math.max(roi, 0.1),
      risk: Math.max(0, risk - 4),
      rationale: 'A conservative hold posture preserves cash flow.',
    },
    bestRefinance: {
      scenario: 'Best Refinance',
      recommendation: 'Refinance',
      projectedProfit: Math.max(projectedProfit, monthlyCashFlow * 10),
      roi: Math.max(roi, 0.13),
      risk: Math.max(0, risk - 5),
      rationale: 'A refinance-supported structure improves liquidity.',
    },
  };
}

function buildMarketSignalsModel(deal, analysis, scenarioAnalysis, portfolioIntelligence = {}) {
  const projectedProfit = safeNumber(analysis?.estimatedFlipProfit ?? analysis?.projectedProfit ?? deal?.projectedProfit ?? deal?.profit);
  const risk = safeNumber(analysis?.overallRisk ?? deal?.riskScore ?? 0);
  const healthScore = safeNumber(portfolioIntelligence?.summary?.healthScore);
  const signal = projectedProfit > 0 && risk <= 25 && healthScore >= 70 ? 'Buy Signal' : projectedProfit > 0 && risk <= 40 ? 'Neutral' : risk > 55 ? 'Sell Signal' : 'Watch';

  return {
    signal,
    score: clamp(Math.round((healthScore > 0 ? healthScore * 0.4 : 50) + (projectedProfit > 0 ? 25 : 0) - risk * 0.4), 0, 100),
    reasons: [
      projectedProfit > 0 ? 'Projected profitability remains supportive.' : 'Projected profitability is not yet supportive.',
      risk <= 25 ? 'Downside risk is contained.' : 'Downside risk warrants close monitoring.',
      healthScore >= 70 ? 'Portfolio health supports deployment.' : 'Portfolio health is neutral or under pressure.',
    ],
  };
}

function buildExecutiveDecisionQueue(propertyRecommendations = [], scenarioAnalysis = {}, marketSignals = {}) {
  const recommendations = normalizeArray(propertyRecommendations);
  const sortedByConfidence = recommendations.slice().sort((left, right) => {
    const confidenceOrder = { High: 3, Moderate: 2, Low: 1 };
    return (confidenceOrder[right.confidence] || 0) - (confidenceOrder[left.confidence] || 0);
  });
  const topOpportunities = sortedByConfidence.filter((entry) => ['Buy', 'BRRRR', 'Flip', 'Refinance'].includes(entry.recommendation)).slice(0, 3);
  const topRisks = recommendations.filter((entry) => entry.risk >= 40).slice(0, 3);
  const nextBestDeal = sortedByConfidence[0] || null;
  const highestRoiDeal = recommendations.slice().sort((left, right) => safeNumber(right.roi) - safeNumber(left.roi))[0] || null;
  const highestRiskDeal = recommendations.slice().sort((left, right) => safeNumber(right.risk) - safeNumber(left.risk))[0] || null;
  const fastestProfitDeal = recommendations.slice().sort((left, right) => safeNumber(right.capitalRequirement) - safeNumber(left.capitalRequirement))[0] || null;
  const largestEquityGainDeal = recommendations.slice().sort((left, right) => safeNumber(right.roi) - safeNumber(left.roi))[0] || null;
  const largestCashRecoveryDeal = recommendations.slice().sort((left, right) => safeNumber(right.capitalRequirement) - safeNumber(left.capitalRequirement))[0] || null;

  return {
    topOpportunities,
    topRisks,
    nextBestDeal,
    highestRoiDeal,
    highestRiskDeal,
    fastestProfitDeal,
    largestEquityGainDeal,
    largestCashRecoveryDeal,
    marketSignal: marketSignals?.signal || 'Neutral',
    scenarioSummary: scenarioAnalysis?.currentPlan || null,
  };
}

export function buildAiDecisionEngine(payload = {}) {
  const deal = normalizeDeal(payload.deal);
  const analysis = normalizeAnalysis(payload.analysis);
  const deals = normalizeArray(payload.deals);
  const rehabProjects = normalizeArray(payload.rehabProjects);
  const contractors = normalizeArray(payload.contractors);
  const lenders = normalizeArray(payload.lenders);
  const portfolioIntelligence = payload.portfolioIntelligence && typeof payload.portfolioIntelligence === 'object' ? payload.portfolioIntelligence : {};
  const comps = normalizeArray(payload.comps);
  const neighborhoods = normalizeArray(payload.neighborhoods);
  const appraisalPackets = normalizeArray(payload.appraisalPackets);
  const bids = normalizeArray(payload.bids);
  const knownUncertainNeeded = payload.knownUncertainNeeded || {
    known: ['Supported deal data is available'],
    uncertain: ['Some assumptions remain unverified'],
    needed: ['Updated appraisals', 'Current lender terms', 'Verified rents'],
  };

  const evidenceModel = buildEvidenceModel(deal, analysis);
  const dealDecision = buildDealDecision(deal, analysis, evidenceModel);
  const redTeam = buildRedTeamSummary(deal, analysis, buildRedTeamReview(deal, analysis, { summary: { profit: safeNumber(analysis.estimatedFlipProfit), roi: safeNumber(analysis.roi), monthlyCashFlow: safeNumber(analysis.monthlyCashFlow), dscr: safeNumber(analysis.dscr), scenarioSurvivalResult: dealDecision.recommendedAction === 'PROCEED' ? 'Survives' : 'Marginal' } }));
  const opportunityCost = buildOpportunityCost(deal, analysis, deals);
  const negotiationIntelligence = buildNegotiationIntelligence(deal, analysis);
  const counterofferAnalysis = buildCounterofferAnalysis(deal, analysis, analysis.recommendedOffer || analysis.counterofferAmount);
  const rehabScopeIntelligence = buildRehabScopeIntelligence(deal, analysis, rehabProjects);
  const rehabSequenceGuidance = buildRehabSequenceGuidance(rehabProjects);
  const contractorIntelligence = buildContractorIntelligence(contractors);
  const contractorBidComparison = buildContractorBidComparison(bids);
  const lenderIntelligence = buildLenderIntelligence(deal, analysis, lenders);
  const capitalAllocation = buildCapitalAllocationEngine({
    properties: normalizeArray(payload.properties),
    deals,
    dealIntelligence: normalizeArray(payload.dealIntelligence),
    rehabProjects,
    lenders,
    contractors,
    portfolioIntelligence,
  });
  const capitalAllocationDecision = {
    ...capitalAllocation,
    recommendedAction: dealDecision.recommendedAction,
    confidenceLabel: dealDecision.confidenceLabel,
  };
  const pipelinePrioritization = buildPipelinePrioritization(deals, analysis);
  const portfolioIntelligenceSummary = buildPortfolioIntelligenceSummary(buildPortfolioIntelligence(normalizeArray(payload.properties), deals, rehabProjects, lenders, contractors, normalizeArray(payload.portfolioData), normalizeArray(payload.portfolioEntries || []), normalizeArray(payload.deals)));
  const exitStrategyOptimization = buildExitStrategyOptimization(deal, analysis);
  const executiveIntelligence = buildExecutiveIntelligence({
    deal,
    analysis,
    portfolioIntelligence,
    deals,
    dealIntelligence: normalizeArray(payload.dealIntelligence),
    properties: normalizeArray(payload.properties),
    rehabProjects,
    contractors,
    lenders,
    capitalAllocationEngine: capitalAllocation,
  });
  const prioritizationEngine = buildExecutivePortfolioPrioritizationEngine({
    deals,
    analysisByDeal: normalizeArray(payload.dealIntelligence).reduce((accumulator, entry) => {
      accumulator[entry.dealId || entry.id] = entry;
      return accumulator;
    }, {}),
    portfolioIntelligence,
    marketSignals: normalizeArray(payload.dealIntelligence).reduce((accumulator, entry) => {
      accumulator[entry.dealId || entry.id] = {
        opportunityScore: safeNumber(entry.opportunityScore),
        forecastConfidence: safeNumber(entry.forecastConfidence),
        marketTrend: safeNumber(entry.marketTrend),
      };
      return accumulator;
    }, {}),
  });
  const executiveAlerts = [...executiveIntelligence.executiveAlerts, ...prioritizationEngine.rankings.slice(0, 3).map((entry) => ({
    severity: entry.priorityLevel === 'Critical' ? 'CRITICAL' : entry.priorityLevel === 'High' ? 'HIGH' : 'MODERATE',
    alert: `${entry.priorityLevel} priority: ${entry.propertyAddress}`,
    relatedRecord: entry.propertyAddress,
    requiredAction: entry.recommendedExecutiveAction,
    relatedModule: 'Deal Intelligence',
  }))];
  const todaysPriorities = [...executiveIntelligence.todaysPriorities, ...prioritizationEngine.rankings.slice(0, 3).map((entry) => ({
    priority: entry.priorityLevel,
    action: entry.recommendedExecutiveAction,
    relatedRecord: entry.propertyAddress,
  }))];
  const executiveSummary = buildExecutiveSummary(deal, analysis, evidenceModel, dealDecision, portfolioIntelligence);
  const executiveDecisionEngine = buildExecutiveDecisionEngine(deal, analysis, evidenceModel, dealDecision, portfolioIntelligence, redTeam, comps, neighborhoods);
  const executiveRecommendationEngine = buildExecutiveRecommendationEngine({
    deal,
    analysis,
    portfolioIntelligence,
    capitalAllocationEngine: capitalAllocation,
    opportunityAnalysis: {
      overallOpportunityScore: safeNumber(analysis.opportunityScore),
    },
    marketAnalysis: {
      marketRiskEngine: {
        marketStabilityScore: safeNumber(analysis.marketStabilityScore || analysis.marketScore),
      },
    },
    forecastAnalysis: {
      forecastConfidence: safeNumber(analysis.forecastConfidence),
    },
  });
  const executiveDecisionExecutionEngine = buildExecutiveDecisionExecutionEngine({
    deal,
    analysis,
    portfolioIntelligence,
    executiveRecommendationEngine,
    capitalAllocationEngine: capitalAllocation,
    marketAnalysis: {
      marketRiskEngine: {
        marketStabilityScore: safeNumber(analysis.marketStabilityScore || analysis.marketScore),
      },
    },
    forecastAnalysis: {
      forecastConfidence: safeNumber(analysis.forecastConfidence),
    },
    dealIntelligence: normalizeArray(payload.dealIntelligence),
  });
  const executiveStrategyOptimizationEngine = buildExecutiveStrategyOptimizationEngine({
    deal,
    analysis,
    portfolioIntelligence,
    executiveRecommendationEngine,
    executiveActionQueue: executiveDecisionExecutionEngine,
    capitalAllocationEngine: capitalAllocation,
    marketAnalysis: {
      marketRiskEngine: {
        marketStabilityScore: safeNumber(analysis.marketStabilityScore || analysis.marketScore),
      },
    },
    forecastAnalysis: {
      forecastConfidence: safeNumber(analysis.forecastConfidence),
    },
  });
  const cognitiveBiasChecks = buildCognitiveBiasChecks(deal, analysis, dealDecision);
  const reUnderwritingTriggers = buildReUnderwritingTriggers(deal, analysis);
  const knowledgeBase = buildKnowledgeBaseLessons(deal, analysis);
  const knowledgeIntelligence = buildKnowledgeIntelligence(deal, analysis, knowledgeBase);
  const searchIntelligence = buildSearchIntelligence('', deals, normalizeArray(payload.properties), contractors, lenders, normalizeArray(payload.dealIntelligence), executiveAlerts);
  const reportingIntelligence = buildReportingIntelligence(deal, analysis, portfolioIntelligence, appraisalPackets);
  const documentAutomation = buildDocumentAutomationIntelligence(deal, analysis, appraisalPackets);
  const aiCommandRouting = buildAiCommandRouting(deal, analysis);
  const estimateVersusActualReview = buildEstimateVersusActualReview(rehabProjects);
  const appraiserPacketIntelligence = buildAppraiserPacketIntelligence(deal, comps);
  const auditHistory = buildAuditHistory(deal, dealDecision, redTeam);
  const enterpriseKnowledgeEngine = buildEnterpriseDataAndKnowledgeEngine({
    deal,
    analysis,
    historicalDeals: normalizeArray(payload.historicalDeals),
    rehabOutcomes: normalizeArray(payload.rehabOutcomes),
    contractorPerformanceHistory: normalizeArray(payload.contractorPerformanceHistory),
    contractors: normalizeArray(payload.contractors),
    materialSelections: normalizeArray(payload.materialSelections),
    materials: normalizeArray(payload.materials),
    arvAccuracyHistory: normalizeArray(payload.arvAccuracyHistory),
    comps: normalizeArray(payload.comps),
    offerHistory: normalizeArray(payload.offerHistory),
    deals: normalizeArray(payload.deals),
    lenderPerformance: normalizeArray(payload.lenderPerformance),
    lenders: normalizeArray(payload.lenders),
    appraisalHistory: normalizeArray(payload.appraisalHistory),
    appraisalPackets: normalizeArray(payload.appraisalPackets),
    portfolioPerformance: normalizeArray(payload.portfolioPerformance),
    portfolioEntries: normalizeArray(payload.portfolioEntries),
    knowledgeRecords: normalizeArray(payload.knowledgeRecords),
    query: safeString(payload.query || '', ''),
  });
  const propertyRecommendations = deals.length > 0
    ? deals.map((currentDeal, index) => buildPropertyRecommendationEntry(currentDeal, {
        estimatedFlipProfit: safeNumber(analysis.estimatedFlipProfit ?? currentDeal.estimatedFlipProfit ?? currentDeal.projectedProfit ?? analysis.projectedProfit),
        roi: safeNumber(analysis.roi ?? currentDeal.roi),
        overallRisk: safeNumber(analysis.overallRisk ?? currentDeal.riskScore ?? 0),
        monthlyCashFlow: safeNumber(analysis.monthlyCashFlow ?? currentDeal.monthlyCashFlow),
        cashRequired: safeNumber(analysis.cashRequired ?? currentDeal.cashRequired),
      }, index))
    : [buildPropertyRecommendationEntry(deal, analysis, 0)];
  const scenarioAnalysis = buildScenarioAnalysisModel(deal, analysis);
  const marketSignals = buildMarketSignalsModel(deal, analysis, scenarioAnalysis, portfolioIntelligence);
  const executiveDecisionQueue = buildExecutiveDecisionQueue(propertyRecommendations, scenarioAnalysis, marketSignals);
  const enterpriseDecisionEngine = buildEnterpriseAiDecisionEngine({
    deal,
    analysis,
    portfolioContext: normalizeObject(portfolioIntelligence?.summary),
    rulesConfig: normalizeObject(payload.rulesConfig),
    engineVersion: 'phase9-batch1-v1',
    marketContext: normalizeObject(payload.marketContext),
    properties: normalizeArray(payload.properties),
    deals,
    comps,
    rehabProjects,
    contractors,
    lenders,
    evidenceSources: [
      'deal-input',
      'analysis-input',
      'portfolio-intelligence-summary',
      'rehab-project-signals',
      'lender-signals',
    ],
  });

  return {
    evidenceModel,
    dealDecision,
    redTeam,
    opportunityCost,
    negotiationIntelligence,
    counterofferAnalysis,
    rehabScopeIntelligence,
    rehabSequenceGuidance,
    contractorIntelligence,
    contractorBidComparison,
    lenderIntelligence,
    capitalAllocation: capitalAllocationDecision,
    pipelinePrioritization,
    portfolioIntelligence: portfolioIntelligenceSummary,
    exitStrategyOptimization,
    executiveAlerts,
    todaysPriorities,
    executiveSummary,
    executiveDecisionEngine,
    executiveRecommendationEngine,
    executiveDecisionExecutionEngine,
    executiveStrategyOptimizationEngine,
    executivePayload: executiveIntelligence.executivePayload,
    prioritizationEngine,
    cognitiveBiasChecks,
    reUnderwritingTriggers,
    knowledgeBase,
    knowledgeIntelligence,
    searchIntelligence,
    reportingIntelligence,
    documentAutomation,
    aiCommandRouting,
    estimateVersusActualReview,
    appraiserPacketIntelligence,
    auditHistory,
    enterpriseKnowledgeEngine,
    propertyRecommendations,
    scenarioAnalysis,
    marketSignals,
    executiveDecisionQueue,
    enterpriseDecisionEngine,
    knownUncertainNeeded,
    neighborhoods,
    appraisalPackets,
  };
}
