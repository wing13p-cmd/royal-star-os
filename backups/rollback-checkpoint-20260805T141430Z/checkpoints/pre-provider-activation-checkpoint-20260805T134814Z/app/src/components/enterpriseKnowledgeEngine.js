function safeNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function safeString(value, fallback = 'Insufficient Data') {
  if (value === null || value === undefined || value === '') return fallback;
  return typeof value === 'string' ? value : String(value);
}

function normalizeArray(value) {
  return Array.isArray(value) ? value : [];
}

function formatCurrency(value) {
  const parsed = safeNumber(value, 0);
  return `$${parsed.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
}

export function buildEnterpriseDataAndKnowledgeEngine(payload = {}) {
  const historicalDeals = normalizeArray(payload.historicalDeals);
  const rehabOutcomes = normalizeArray(payload.rehabOutcomes);
  const contractorPerformanceHistory = normalizeArray(payload.contractorPerformanceHistory).length
    ? normalizeArray(payload.contractorPerformanceHistory)
    : normalizeArray(payload.contractors).map((entry, index) => ({
        id: entry.id || `contractor-${index + 1}`,
        contractorName: safeString(entry.contractorName || entry.companyName || entry.name, 'Contractor'),
        performanceScore: safeNumber(entry.performanceScore ?? entry.score ?? entry.rating),
        notes: safeString(entry.notes || 'Live contractor record', 'Live contractor record'),
      }));
  const materialSelections = normalizeArray(payload.materialSelections).length
    ? normalizeArray(payload.materialSelections)
    : normalizeArray(payload.materials).map((entry, index) => ({
        id: entry.id || `material-${index + 1}`,
        materialName: safeString(entry.materialName || entry.name || entry.material, 'Material'),
        recommendationScore: safeNumber(entry.recommendationScore ?? entry.score),
      }));
  const arvAccuracyHistory = normalizeArray(payload.arvAccuracyHistory).length
    ? normalizeArray(payload.arvAccuracyHistory)
    : normalizeArray(payload.comps).map((entry, index) => ({
        id: entry.id || `comp-${index + 1}`,
        source: safeString(entry.compName || entry.address || entry.source, 'Comp Source'),
        accuracyScore: safeNumber(entry.accuracyScore ?? entry.score ?? entry.confidenceScore),
      }));
  const offerHistory = normalizeArray(payload.offerHistory).length
    ? normalizeArray(payload.offerHistory)
    : normalizeArray(payload.deals).map((entry, index) => ({
        id: entry.id || `deal-${index + 1}`,
        offerAmount: safeNumber(entry.offerAmount ?? entry.purchasePrice ?? entry.askingPrice),
        outcome: safeString(entry.status || 'Pending', 'Pending'),
      }));
  const lenderPerformance = normalizeArray(payload.lenderPerformance).length
    ? normalizeArray(payload.lenderPerformance)
    : normalizeArray(payload.lenders).map((entry, index) => ({
        id: entry.id || `lender-${index + 1}`,
        lenderName: safeString(entry.lenderName || entry.loanProgramName || entry.name, 'Lender'),
        score: safeNumber(entry.score ?? entry.performanceScore ?? entry.rating),
      }));
  const appraisalHistory = normalizeArray(payload.appraisalHistory).length
    ? normalizeArray(payload.appraisalHistory)
    : normalizeArray(payload.appraisalPackets).map((entry, index) => ({
        id: entry.id || `appraisal-${index + 1}`,
        source: safeString(entry.source || entry.appraiser || entry.name, 'Appraiser'),
        value: safeNumber(entry.supportedARV ?? entry.value ?? entry.requestedARV),
      }));
  const portfolioPerformance = normalizeArray(payload.portfolioPerformance).length
    ? normalizeArray(payload.portfolioPerformance)
    : normalizeArray(payload.portfolioEntries).map((entry, index) => ({
        id: entry.id || `portfolio-${index + 1}`,
        period: safeString(entry.period || entry.label || `Period ${index + 1}`, `Period ${index + 1}`),
        roi: safeNumber(entry.roi ?? entry.returnOnInvestment),
      }));
  const knowledgeRecords = normalizeArray(payload.knowledgeRecords).length
    ? normalizeArray(payload.knowledgeRecords)
    : normalizeArray(payload.knowledgeBase || payload.knowledgeEntries).map((entry, index) => ({
        id: entry.id || `knowledge-${index + 1}`,
        title: safeString(entry.title || entry.lesson || entry.topic, 'Knowledge Record'),
        topic: safeString(entry.topic || entry.category || 'knowledge', 'knowledge'),
      }));
  const deal = payload.deal && typeof payload.deal === 'object' ? payload.deal : {};
  const analysis = payload.analysis && typeof payload.analysis === 'object' ? payload.analysis : {};

  const learningEngine = {
    completedProjects: historicalDeals.map((entry, index) => ({
      id: entry.id || `history-${index + 1}`,
      propertyAddress: safeString(entry.propertyAddress || entry.address || entry.propertyName, 'Unnamed Project'),
      estimatedVsActual: {
        purchasePrice: safeNumber(entry.purchasePrice) - safeNumber(entry.actualPurchasePrice ?? entry.purchasePrice),
        rehabBudget: safeNumber(entry.rehabBudget) - safeNumber(entry.actualRehabCost ?? entry.rehabBudget),
        estimatedArv: safeNumber(entry.estimatedArv) - safeNumber(entry.actualSalePrice ?? entry.estimatedArv),
        roi: safeNumber(entry.roi),
        profit: safeNumber(entry.profit),
      },
      purchasePrice: safeNumber(entry.purchasePrice),
      rehabBudget: safeNumber(entry.rehabBudget),
      actualRehabCost: safeNumber(entry.actualRehabCost ?? entry.rehabBudget),
      estimatedArv: safeNumber(entry.estimatedArv),
      actualSalePrice: safeNumber(entry.actualSalePrice ?? entry.estimatedArv),
      daysOnMarket: safeNumber(entry.daysOnMarket),
      cashReturned: safeNumber(entry.cashReturned),
      roi: safeNumber(entry.roi),
      profit: safeNumber(entry.profit),
      variance: safeNumber(entry.variance ?? entry.profit ?? 0),
    })),
    summary: {
      projectsTracked: historicalDeals.length,
      averageRoi: historicalDeals.length ? historicalDeals.reduce((sum, entry) => sum + safeNumber(entry.roi), 0) / historicalDeals.length : 0,
      averageProfit: historicalDeals.length ? historicalDeals.reduce((sum, entry) => sum + safeNumber(entry.profit), 0) / historicalDeals.length : 0,
    },
  };

  const smartRecommendations = {
    offerRecommendations: offerHistory.length ? offerHistory.slice(0, 3).map((entry) => ({
      recommendation: safeString(entry.outcome, 'Monitor'),
      amount: safeNumber(entry.offerAmount),
      rationale: 'Use recent offer acceptance patterns to guide the next negotiation.',
    })) : [{
      recommendation: 'Monitor',
      amount: safeNumber(analysis.recommendedOffer ?? deal.recommendedOffer ?? 0),
      rationale: 'No offer history is available yet, so the recommendation remains conservative.',
    }],
    rehabBudgets: rehabOutcomes.length ? rehabOutcomes.map((entry) => ({
      propertyAddress: safeString(entry.propertyAddress || entry.address || entry.projectName, 'Unnamed Project'),
      recommendedBudget: safeNumber(entry.actualCostVariance ?? entry.recommendedBudget ?? 0),
      rationale: safeString(entry.outcome || entry.reason || 'Use actuals to calibrate the next scope.', 'Use actuals to calibrate the next scope.'),
    })) : [],
    contractorSelections: contractorPerformanceHistory.slice(0, 3).map((entry) => ({
      contractorName: safeString(entry.contractorName || entry.name || entry.companyName, 'Contractor'),
      score: safeNumber(entry.performanceScore ?? entry.score),
      recommendation: safeNumber(entry.performanceScore ?? entry.score) >= 80 ? 'Preferred' : 'Monitor',
    })),
    materialRecommendations: materialSelections.slice(0, 3).map((entry) => ({
      materialName: safeString(entry.materialName || entry.name, 'Material'),
      score: safeNumber(entry.recommendationScore ?? entry.score),
      recommendation: safeNumber(entry.recommendationScore ?? entry.score) >= 80 ? 'Prioritize' : 'Evaluate',
    })),
    riskScoring: [{
      factor: 'Budget variance',
      score: rehabOutcomes.length ? Math.min(100, rehabOutcomes.reduce((sum, entry) => sum + safeNumber(entry.actualCostVariance), 0) / Math.max(rehabOutcomes.length, 1)) : 0,
    }],
    timelineEstimates: [{
      label: 'Expected rehab duration',
      days: historicalDeals.length ? Math.round(historicalDeals.reduce((sum, entry) => sum + safeNumber(entry.daysOnMarket), 0) / historicalDeals.length) : 30,
    }],
    capitalAllocation: [{
      focus: 'Reserve coverage',
      amount: safeNumber(analysis.cashRequired ?? deal.cashRequired ?? 0),
    }],
  };

  const knowledgeBase = {
    historicalDeals: historicalDeals.slice(0, 5),
    rehabOutcomes: rehabOutcomes.slice(0, 5),
    contractorPerformanceHistory: contractorPerformanceHistory.slice(0, 5),
    materialSelections: materialSelections.slice(0, 5),
    arvAccuracyHistory: arvAccuracyHistory.slice(0, 5),
    offerHistory: offerHistory.slice(0, 5),
    lenderPerformance: lenderPerformance.slice(0, 5),
    appraisalHistory: appraisalHistory.slice(0, 5),
    portfolioPerformance: portfolioPerformance.slice(0, 5),
    knowledgeRecords: knowledgeRecords.slice(0, 5),
    summary: {
      totalRecords: historicalDeals.length + rehabOutcomes.length + contractorPerformanceHistory.length + materialSelections.length + arvAccuracyHistory.length + offerHistory.length + lenderPerformance.length + appraisalHistory.length + portfolioPerformance.length + knowledgeRecords.length,
      mostActiveStrategy: historicalDeals[0]?.strategy || deal.strategy || 'Flip',
      latestNote: knowledgeRecords[0]?.title || 'Knowledge base is active',
    },
  };

  const query = safeString(payload.query || '', '').trim().toLowerCase();
  const searchEngine = {
    query,
    results: [
      ...historicalDeals.filter((entry) => {
        const haystack = [entry.propertyAddress, entry.address, entry.propertyName, entry.strategy, entry.city, entry.state].join(' ').toLowerCase();
        return !query || haystack.includes(query);
      }).slice(0, 3).map((entry) => ({ label: safeString(entry.propertyAddress || entry.address || entry.propertyName, 'Deal'), module: 'Deal Intelligence' })),
      ...contractorPerformanceHistory.filter((entry) => {
        const haystack = [entry.contractorName, entry.companyName, entry.name].join(' ').toLowerCase();
        return !query || haystack.includes(query);
      }).slice(0, 2).map((entry) => ({ label: safeString(entry.contractorName || entry.name || entry.companyName, 'Contractor'), module: 'Contractor Hub' })),
      ...knowledgeRecords.filter((entry) => {
        const haystack = [entry.title, entry.topic, entry.category].join(' ').toLowerCase();
        return !query || haystack.includes(query);
      }).slice(0, 2).map((entry) => ({ label: safeString(entry.title || entry.topic, 'Knowledge Record'), module: 'Knowledge Base' })),
      ...lenderPerformance.filter((entry) => {
        const haystack = [entry.lenderName, entry.loanProgramName, entry.name].join(' ').toLowerCase();
        return !query || haystack.includes(query);
      }).slice(0, 2).map((entry) => ({ label: safeString(entry.lenderName || entry.loanProgramName || entry.name, 'Lender'), module: 'Lender Dashboard' })),
    ],
    totalResults: 0,
    recommendedModule: 'Knowledge Base',
  };

  const executiveInsights = {
    topPerformingContractors: contractorPerformanceHistory.slice().sort((left, right) => safeNumber(right.performanceScore ?? right.score) - safeNumber(left.performanceScore ?? left.score)).slice(0, 3).map((entry) => ({
      name: safeString(entry.contractorName || entry.name || entry.companyName, 'Contractor'),
      score: safeNumber(entry.performanceScore ?? entry.score),
      note: safeString(entry.notes || 'Performance history available', 'Performance history available'),
    })),
    mostProfitableZipCodes: historicalDeals.slice().sort((left, right) => safeNumber(right.profit) - safeNumber(left.profit)).slice(0, 3).map((entry) => ({
      zipCode: safeString(entry.zipCode || entry.zip, 'Unknown'),
      profit: safeNumber(entry.profit),
      strategy: safeString(entry.strategy || 'Flip', 'Flip'),
    })),
    bestRehabTypes: rehabOutcomes.slice(0, 3).map((entry) => ({
      type: safeString(entry.rehabType || entry.type || 'Rehab', 'Rehab'),
      outcome: safeString(entry.outcome || 'Stable', 'Stable'),
    })),
    highestRoiStrategies: historicalDeals.slice().sort((left, right) => safeNumber(right.roi) - safeNumber(left.roi)).slice(0, 3).map((entry) => ({
      strategy: safeString(entry.strategy || 'Flip', 'Flip'),
      roi: safeNumber(entry.roi),
      profit: safeNumber(entry.profit),
    })),
    mostAccurateArvSources: arvAccuracyHistory.slice().sort((left, right) => safeNumber(right.accuracyScore ?? right.score) - safeNumber(left.accuracyScore ?? left.score)).slice(0, 3).map((entry) => ({
      source: safeString(entry.source || entry.name || 'Source', 'Source'),
      accuracyScore: safeNumber(entry.accuracyScore ?? entry.score),
    })),
    recurringBudgetIssues: rehabOutcomes.filter((entry) => safeNumber(entry.actualCostVariance) > 0).slice(0, 3).map((entry) => ({
      propertyAddress: safeString(entry.propertyAddress || entry.address || entry.projectName, 'Unnamed Project'),
      variance: safeNumber(entry.actualCostVariance),
      note: 'Actual rehab costs exceeded the base budget assumption.',
    })),
    capitalEfficiencyTrends: portfolioPerformance.slice(0, 3).map((entry) => ({
      period: safeString(entry.period || entry.label || 'Period', 'Period'),
      roi: safeNumber(entry.roi),
      capitalEfficiency: safeNumber(entry.capitalEfficiency ?? entry.roi),
    })),
  };

  return {
    knowledgeBase,
    learningEngine,
    smartRecommendations,
    searchEngine,
    executiveInsights,
    summary: {
      headline: `Knowledge engine is tracking ${knowledgeBase.summary.totalRecords} records and ${learningEngine.completedProjects.length} completed projects.`,
      recommendedAction: smartRecommendations.offerRecommendations[0]?.recommendation || 'Monitor',
      portfolioHealth: formatCurrency(safeNumber(analysis.cashRequired ?? deal.cashRequired ?? 0)),
    },
  };
}
