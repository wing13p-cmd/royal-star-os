import test from 'node:test';
import assert from 'node:assert/strict';
import { buildAiDecisionEngine } from './aiDecisionEngine.js';

test('buildAiDecisionEngine returns safe defaults for empty input', () => {
  const result = buildAiDecisionEngine({});
  assert.equal(result.dealDecision.recommendedAction, 'REQUEST MORE DATA');
  assert.equal(result.dealDecision.confidenceLabel, 'INSUFFICIENT DATA');
  assert.equal(result.executiveSummary.summaryStatus, 'INSUFFICIENT DATA');
  assert.equal(result.redTeam.survivesRedTeam, false);
});

test('buildAiDecisionEngine recommends proceed for a strong supported deal', () => {
  const deal = {
    id: 'deal-1',
    propertyAddress: '123 Main St',
    purchasePrice: 180000,
    rehabBudget: 40000,
    estimatedArv: 320000,
    estimatedRent: 3200,
    cashOnHand: 100000,
    status: 'active',
    strategy: 'Flip',
  };
  const analysis = {
    dealScore: 90,
    financingScore: 85,
    overallRisk: 18,
    buyBoxResult: 'PASS',
    arvConfidence: 'High',
    supportedBaseArv: 320000,
    recommendedOffer: 170000,
    maximumAllowableOffer: 175000,
    walkAwayPrice: 165000,
    estimatedFlipProfit: 90000,
    roi: 0.2,
    dscr: 1.4,
    monthlyCashFlow: 1200,
    cashRequired: 20000,
    warnings: [],
  };

  const result = buildAiDecisionEngine({ deal, analysis, deals: [deal], rehabProjects: [], contractors: [], lenders: [], portfolioIntelligence: { summary: { healthScore: 88, reserveShortfallValue: 0 } } });

  assert.equal(result.dealDecision.recommendedAction, 'PROCEED');
  assert.equal(result.dealDecision.confidenceLabel, 'HIGH');
  assert.equal(result.redTeam.survivesRedTeam, true);
  assert.equal(result.negotiationIntelligence.initialOfferRecommendation, 170000);
  assert.equal(result.capitalAllocation.recommendedAction, 'PROCEED');
  assert.equal(result.executiveDecisionEngine.primaryRecommendation, 'Buy');
  assert.ok(result.executiveDecisionEngine.confidenceScore >= 70);
  assert.ok(result.executiveDecisionEngine.reasoning.length > 0);
  assert.ok(result.knowledgeIntelligence.entries.length > 0);
  assert.ok(result.reportingIntelligence.executiveSummary.length > 0);
  assert.ok(result.documentAutomation.documents.length > 0);
  assert.ok(result.aiCommandRouting.route.length > 0);
});

test('pure Flip decision is not rejected solely by rental DSCR or cash flow', () => {
  const deal = { propertyAddress: '123 Main', purchasePrice: 135000, rehabBudget: 60000, estimatedArv: 285000, estimatedRent: 1800, strategy: 'Flip' };
  const analysis = { dealScore: 90, financingScore: 85, overallRisk: 18, buyBoxResult: 'PASS', arvConfidence: 'High', supportedBaseArv: 283000, estimatedFlipProfit: 40000, roi: 0.15, dscr: 0, monthlyCashFlow: -1000, cashRequired: 30000, warnings: [], financingWarnings: [] };
  const result = buildAiDecisionEngine({ deal, analysis, deals: [deal], rehabProjects: [], contractors: [], lenders: [], portfolioIntelligence: { summary: {} } });
  assert.notEqual(result.dealDecision.recommendedAction, 'PAUSE');
  assert.equal(result.dealDecision.reasonsNotToProceed.some((reason) => /cash.flow|DSCR/i.test(reason)), false);
});

test('buildAiDecisionEngine requests more data for an incomplete deal', () => {
  const deal = {
    id: 'deal-2',
    propertyAddress: '999 Oak Ave',
    purchasePrice: 120000,
    rehabBudget: 30000,
    status: 'under review',
  };

  const result = buildAiDecisionEngine({ deal, analysis: {}, deals: [deal], rehabProjects: [], contractors: [], lenders: [], portfolioIntelligence: { summary: { healthScore: 70, reserveShortfallValue: 20000 } } });

  assert.equal(result.dealDecision.recommendedAction, 'REQUEST MORE DATA');
  assert.equal(result.dealDecision.confidenceLabel, 'INSUFFICIENT DATA');
  assert.ok(result.dealDecision.missingInformation.length > 0);
  assert.equal(result.executiveAlerts.length > 0, true);
});

test('buildAiDecisionEngine exposes decision recommendations, scenario analysis, market signals, and an executive decision queue', () => {
  const result = buildAiDecisionEngine({
    deal: {
      id: 'deal-3',
      propertyAddress: '555 River Rd',
      purchasePrice: 210000,
      rehabBudget: 45000,
      estimatedArv: 330000,
      estimatedRent: 2800,
      cashOnHand: 90000,
      status: 'active',
      strategy: 'Flip',
    },
    analysis: {
      dealScore: 82,
      overallRisk: 24,
      estimatedFlipProfit: 85000,
      roi: 0.18,
      monthlyCashFlow: 1400,
      cashRequired: 24000,
      supportedBaseArv: 330000,
      buyBoxResult: 'PASS',
      arvConfidence: 'High',
    },
    deals: [
      { id: 'deal-3', propertyAddress: '555 River Rd', purchasePrice: 210000, rehabBudget: 45000, estimatedArv: 330000, estimatedRent: 2800, cashOnHand: 90000, status: 'active', strategy: 'Flip' },
      { id: 'deal-4', propertyAddress: '777 Cedar Ln', purchasePrice: 260000, rehabBudget: 60000, estimatedArv: 360000, estimatedRent: 2500, cashOnHand: 40000, status: 'active', strategy: 'BRRRR' },
    ],
    properties: [
      { id: 'prop-3', propertyName: '555 River Rd', currentValue: 330000, currentLoanBalance: 180000, monthlyCashFlow: 1400, strategy: 'Flip' },
      { id: 'prop-4', propertyName: '777 Cedar Ln', currentValue: 360000, currentLoanBalance: 220000, monthlyCashFlow: 2200, strategy: 'BRRRR' },
    ],
    rehabProjects: [],
    contractors: [],
    lenders: [],
    portfolioIntelligence: { summary: { healthScore: 82, reserveShortfallValue: 0 } },
  });

  assert.ok(result.propertyRecommendations.length >= 2);
  assert.ok(result.propertyRecommendations.every((entry) => ['Buy', 'Pass', 'Hold', 'Refinance', 'Sell', 'Flip', 'BRRRR', 'Wholesale', 'Watch'].includes(entry.recommendation)));
  assert.ok(result.scenarioAnalysis.currentPlan);
  assert.ok(result.scenarioAnalysis.bestFlip);
  assert.ok(result.scenarioAnalysis.bestBrrrr);
  assert.ok(['Buy Signal', 'Neutral', 'Watch', 'Sell Signal'].includes(result.marketSignals.signal));
  assert.ok(result.executiveDecisionQueue.topOpportunities.length > 0);
  assert.ok(result.executiveDecisionQueue.topRisks.length >= 0);
  assert.ok(result.executiveDecisionQueue.nextBestDeal);
  assert.ok(result.enterpriseDecisionEngine);
  assert.equal(result.enterpriseDecisionEngine.advisoryOnly, true);
  assert.equal(result.enterpriseDecisionEngine.approvalState, 'PENDING_USER_APPROVAL');
  assert.ok(result.enterpriseDecisionEngine.predictiveIntelligence);
  assert.equal(result.enterpriseDecisionEngine.predictiveIntelligence.advisoryOnly, true);
  assert.ok(result.enterpriseDecisionEngine.predictiveIntelligence.executiveSummary);
  assert.ok(result.enterpriseDecisionEngine.enterpriseIntelligenceLayer);
  assert.equal(result.enterpriseDecisionEngine.enterpriseIntelligenceLayer.advisoryOnly, true);
  assert.equal(result.enterpriseDecisionEngine.enterpriseIntelligenceLayer.approvalState, 'PENDING_USER_APPROVAL');
  assert.ok(['STRONG BUY', 'BUY', 'NEGOTIATE', 'WAIT', 'PASS'].includes(result.enterpriseDecisionEngine.enterpriseIntelligenceLayer.masterRecommendation.recommendation));
});
