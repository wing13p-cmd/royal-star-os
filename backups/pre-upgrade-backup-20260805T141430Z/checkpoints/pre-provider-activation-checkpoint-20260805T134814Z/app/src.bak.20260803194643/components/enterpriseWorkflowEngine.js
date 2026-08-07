import { buildEnterpriseEventBus } from './enterpriseEventBus.js';
import { buildEnterpriseTaskScheduler } from './enterpriseTaskScheduler.js';
import { buildExecutiveIntelligence } from './executiveIntelligence.js';
import { buildPortfolioIntelligence } from './portfolioIntelligence.js';
import { buildPredictiveMarketIntelligence, buildOpportunityDetectionEngine, buildForecastConfidenceEngine } from './intelligenceUpgradeEngine.js';

function safeNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function safeString(value, fallback = 'Insufficient Data') {
  if (value === null || value === undefined || value === '') return fallback;
  return typeof value === 'string' ? value : String(value);
}

function normalizeObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function normalizeArray(value) {
  return Array.isArray(value) ? value : [];
}

function buildAutomationSummary(snapshot = {}) {
  const modules = [
    snapshot.automaticDealStageProgression,
    snapshot.rehabMilestoneTracking,
    snapshot.contractorTaskQueue,
    snapshot.followUpReminderEngine,
    snapshot.capitalDeploymentAutomation,
    snapshot.lenderChecklistAutomation,
    snapshot.appraisalPacketReadinessMonitor,
    snapshot.closingChecklistAutomation,
    snapshot.executiveNotifications,
    snapshot.systemHealthAutomation,
  ].filter(Boolean);
  const healthScore = modules.reduce((sum, module) => sum + safeNumber(module.healthScore), 0) / Math.max(1, modules.length);
  return {
    overallHealthScore: Math.round(healthScore),
    completedModuleCount: modules.length,
    completedModuleNames: modules.map((module) => module.name),
  };
}

function createStageRecord(stage) {
  return {
    id: stage.id || stage.name || 'stage',
    name: stage.name || stage.id || 'Stage',
    stage: stage.stage || stage.name || stage.id || 'Stage',
    status: 'Pending',
    runtime: 0,
    errors: [],
    retryCount: 0,
    sourceModule: stage.sourceModule || 'Enterprise Workflow Engine',
  };
}

function buildDefaultWorkflowDefinition() {
  return {
    stages: [
      { id: 'Trigger', name: 'Trigger', stage: 'Trigger', sourceModule: 'Enterprise Workflow Engine', run: async () => ({ status: 'Completed' }) },
      { id: 'Validate', name: 'Validate', stage: 'Validate', dependsOn: ['Trigger'], sourceModule: 'Enterprise Workflow Engine', run: async () => ({ status: 'Completed' }) },
      { id: 'Analyze', name: 'Analyze', stage: 'Analyze', dependsOn: ['Validate'], sourceModule: 'Enterprise Workflow Engine', run: async () => ({ status: 'Completed' }) },
      { id: 'Score', name: 'Score', stage: 'Score', dependsOn: ['Analyze'], sourceModule: 'Enterprise Workflow Engine', branching: [{ condition: { field: 'Portfolio Health', value: 70 }, target: 'Recommend' }], run: async () => ({ status: 'Completed' }) },
      { id: 'Recommend', name: 'Recommend', stage: 'Recommend', dependsOn: ['Score'], sourceModule: 'Enterprise Workflow Engine', run: async () => ({ status: 'Completed' }) },
      { id: 'Execute', name: 'Execute', stage: 'Execute', dependsOn: ['Recommend'], sourceModule: 'Enterprise Workflow Engine', run: async () => ({ status: 'Completed' }) },
      { id: 'Verify', name: 'Verify', stage: 'Verify', dependsOn: ['Execute'], sourceModule: 'Enterprise Workflow Engine', run: async () => ({ status: 'Completed' }) },
      { id: 'Complete', name: 'Complete', stage: 'Complete', dependsOn: ['Verify'], sourceModule: 'Enterprise Workflow Engine', run: async () => ({ status: 'Completed' }) },
    ],
  };
}

function evaluateBranchCondition(condition, context) {
  if (!condition) return true;
  if (typeof condition === 'function') {
    try {
      return Boolean(condition(context));
    } catch (error) {
      return false;
    }
  }

  const metrics = normalizeObject(context.metrics);
  const dealScore = safeNumber(metrics.dealScore ?? context.dealScore ?? context.analysis?.dealScore ?? context.deal?.dealScore);
  const riskScore = safeNumber(metrics.riskScore ?? context.riskScore ?? context.analysis?.overallRisk ?? context.analysis?.riskScore);
  const opportunityScore = safeNumber(metrics.opportunityScore ?? context.opportunityScore ?? context.opportunityDetection?.opportunityScore);
  const confidence = safeNumber(metrics.forecastConfidence ?? context.forecastConfidence ?? context.forecast?.confidenceLevel ?? context.forecastConfidenceScore);
  const portfolioHealth = safeNumber(metrics.portfolioHealth ?? context.portfolioHealth ?? context.portfolioIntelligence?.summary?.healthScore);

  const branchValue = safeNumber(condition.value ?? condition.threshold ?? 0);
  switch (condition.field) {
    case 'Deal Score':
      return dealScore >= branchValue;
    case 'Risk Score':
      return riskScore <= branchValue;
    case 'Opportunity Score':
      return opportunityScore >= branchValue;
    case 'Forecast Confidence':
      return confidence >= branchValue;
    case 'Portfolio Health':
      return portfolioHealth >= branchValue;
    default:
      return true;
  }
}

function buildBranchingPath(context, stage) {
  if (stage.branching && stage.branching.length) {
    const matchingBranch = stage.branching.find((branch) => evaluateBranchCondition(branch.condition, context));
    if (matchingBranch) {
      return matchingBranch.target;
    }
  }
  return null;
}

export function buildEnterpriseWorkflowEngine(options = {}) {
  const eventBus = buildEnterpriseEventBus({ retryLimit: 2 });
  const scheduler = buildEnterpriseTaskScheduler({ retryBaseMs: 20 });
  const auditTrail = [];
  let recoveryCount = 0;

  function buildAutomationSnapshot(input = {}) {
    const deal = normalizeObject(input.deal);
    const analysis = normalizeObject(input.analysis);
    const portfolioIntelligence = normalizeObject(input.portfolioIntelligence);
    const rehabProjects = normalizeArray(input.rehabProjects);
    const contractors = normalizeArray(input.contractors);
    const lenders = normalizeArray(input.lenders);
    const dealIntelligence = normalizeArray(input.dealIntelligence);
    const appraisalPackets = normalizeArray(input.appraisalPackets);
    const forecastAnalysis = normalizeObject(input.forecastAnalysis);
    const portfolioSummary = normalizeObject(portfolioIntelligence.summary);

    const automaticDealStageProgression = {
      name: 'Automatic Deal Stage Progression',
      status: safeString(deal.status || 'active', 'active').toLowerCase() === 'active' ? 'In Progress' : 'Pending',
      healthScore: safeNumber(analysis.dealScore || portfolioSummary.healthScore || 70),
      detail: safeString(deal.propertyAddress || 'Current deal', 'Current deal'),
    };

    const rehabMilestoneTracking = {
      name: 'Rehab Milestone Tracking',
      status: rehabProjects.length ? 'Tracked' : 'Pending',
      healthScore: rehabProjects.length ? 78 : 60,
      detail: rehabProjects[0]?.currentPhase || rehabProjects[0]?.projectStatus || 'No active rehab',
    };

    const contractorTaskQueue = {
      name: 'Contractor Task Queue',
      status: contractors.length ? 'Queued' : 'Pending',
      healthScore: contractors.length ? 72 : 55,
      detail: contractors[0]?.contractorName || 'No contractor assignments',
    };

    const followUpReminderEngine = {
      name: 'Follow-up Reminder Engine',
      status: dealIntelligence.length ? 'Scheduled' : 'Pending',
      healthScore: dealIntelligence.length ? 74 : 58,
      detail: dealIntelligence[0]?.requiredFollowUpItems?.[0] || 'Review next follow-up',
    };

    const capitalDeploymentAutomation = {
      name: 'Capital Deployment Automation',
      status: portfolioSummary.reserveShortfallValue > 0 ? 'Review Needed' : 'Ready',
      healthScore: portfolioSummary.availableLiquidity > 0 ? 80 : 64,
      detail: safeNumber(portfolioSummary.availableLiquidity, 0) > 0 ? `${safeNumber(portfolioSummary.availableLiquidity, 0).toLocaleString()} available` : 'Liquidity pending',
    };

    const lenderChecklistAutomation = {
      name: 'Lender Checklist Automation',
      status: lenders.length ? 'Ready' : 'Pending',
      healthScore: lenders.length ? 76 : 54,
      detail: lenders[0]?.lenderName || 'No lender packet',
    };

    const appraisalPacketReadinessMonitor = {
      name: 'Appraisal Packet Readiness Monitor',
      status: input.appraisalPackets?.length ? 'Ready' : 'Pending',
      healthScore: input.appraisalPackets?.length ? 82 : 60,
      detail: input.appraisalPackets?.[0]?.status || 'Awaiting packet',
    };

    const closingChecklistAutomation = {
      name: 'Closing Checklist Automation',
      status: analysis.cashRequired > 0 ? 'Prepared' : 'Pending',
      healthScore: analysis.cashRequired > 0 ? 75 : 56,
      detail: analysis.cashRequired > 0 ? `Cash required ${analysis.cashRequired}` : 'Awaiting closing inputs',
    };

    const executiveNotifications = {
      name: 'Executive Notifications',
      status: safeNumber(portfolioSummary.healthScore || analysis.dealScore || 0) >= 80 ? 'Active' : 'Queued',
      healthScore: safeNumber(portfolioSummary.healthScore || analysis.dealScore || 70),
      detail: forecastAnalysis.confidenceLevel ? `Forecast confidence ${Math.round(safeNumber(forecastAnalysis.confidenceLevel, 0) * 100)}%` : 'Monitor portfolio signals',
    };

    const systemHealthAutomation = {
      name: 'System Health Automation',
      status: 'Healthy',
      healthScore: 88,
      detail: 'Monitoring and recovery paths are active',
    };

    const summary = buildAutomationSummary({
      automaticDealStageProgression,
      rehabMilestoneTracking,
      contractorTaskQueue,
      followUpReminderEngine,
      capitalDeploymentAutomation,
      lenderChecklistAutomation,
      appraisalPacketReadinessMonitor,
      closingChecklistAutomation,
      executiveNotifications,
      systemHealthAutomation,
    });

    return {
      automaticDealStageProgression,
      rehabMilestoneTracking,
      contractorTaskQueue,
      followUpReminderEngine,
      capitalDeploymentAutomation,
      lenderChecklistAutomation,
      appraisalPacketReadinessMonitor,
      closingChecklistAutomation,
      executiveNotifications,
      systemHealthAutomation,
      summary,
    };
  }

  async function runStage(stageDefinition, context, state) {
    const stageRecord = createStageRecord(stageDefinition);
    stageRecord.workflowId = state.workflowId;
    stageRecord.status = 'Running';
    stageRecord.startedAt = new Date().toISOString();
    stageRecord.sourceModule = stageDefinition.sourceModule || 'Enterprise Workflow Engine';
    auditTrail.push(stageRecord);

    const startedAt = Date.now();
    try {
      const result = await (stageDefinition.run ? stageDefinition.run({
        context,
        eventBus,
        scheduler,
        workflowState: state,
      }) : { status: 'Completed', data: {} });

      const runtime = Date.now() - startedAt;
      stageRecord.status = result?.status || 'Completed';
      stageRecord.runtime = runtime;
      stageRecord.retryCount = stageRecord.retryCount || 0;
      stageRecord.result = result?.data || result || {};
      stageRecord.completedAt = new Date().toISOString();
      stageRecord.errors = [];
    } catch (error) {
      const runtime = Date.now() - startedAt;
      stageRecord.status = 'Failed';
      stageRecord.runtime = runtime;
      stageRecord.errors = [safeString(error && error.message ? error.message : String(error), 'Unknown error')];
      stageRecord.retryCount += 1;
      recoveryCount += 1;
      if (stageRecord.retryCount <= (stageDefinition.retryLimit || 1)) {
        stageRecord.status = 'Retrying';
        await new Promise((resolve) => setTimeout(resolve, 20));
        return runStage(stageDefinition, context, state);
      }
    }

    return stageRecord;
  }

  async function runWorkflow(input = {}) {
    const workflowDefinition = normalizeObject(input.workflowDefinition);
    const workflowConfig = workflowDefinition.stages && workflowDefinition.stages.length ? workflowDefinition : buildDefaultWorkflowDefinition();
    const workflowId = safeString(input.workflowId || `workflow-${Date.now()}`, 'workflow-unknown');
    const deal = normalizeObject(input.deal);
    const analysis = normalizeObject(input.analysis);
    const portfolioIntelligence = normalizeObject(input.portfolioIntelligence);
    const properties = normalizeArray(input.properties);
    const deals = normalizeArray(input.deals);
    const rehabProjects = normalizeArray(input.rehabProjects);
    const contractors = normalizeArray(input.contractors);
    const lenders = normalizeArray(input.lenders);
    const comps = normalizeArray(input.comps);
    const neighborhoods = normalizeArray(input.neighborhoods);

    const executiveIntelligence = buildExecutiveIntelligence({
      deal,
      analysis,
      portfolioIntelligence,
      deals,
      properties,
      rehabProjects,
      contractors,
      lenders,
      marketAnalysis: normalizeObject(input.marketAnalysis),
      forecastAnalysis: normalizeObject(input.forecastAnalysis),
      manualOverrideStrategy: input.manualOverrideStrategy,
    });
    const portfolioIntelligenceSummary = buildPortfolioIntelligence(properties, deals, rehabProjects, lenders, contractors, deals, comps, normalizeArray(input.portfolioNotes));
    const marketIntelligence = buildPredictiveMarketIntelligence(deal, neighborhoods, comps);
    const opportunityDetection = buildOpportunityDetectionEngine(deal, {}, marketIntelligence, {}, analysis, {}, {}, {});
    const forecastConfidence = buildForecastConfidenceEngine(deal, {}, marketIntelligence, opportunityDetection);

    const metrics = {
      dealScore: safeNumber(analysis.dealScore || executiveIntelligence.executivePayload?.confidenceScore || executiveIntelligence.executiveStrategyOptimizationEngine?.selectedStrategy?.confidenceScore),
      riskScore: safeNumber(analysis.overallRisk || (executiveIntelligence.portfolioRiskMonitor?.severity === 'CRITICAL' ? 100 : 0)),
      opportunityScore: safeNumber(input.opportunityDetection?.opportunityScore || opportunityDetection?.opportunityScore || executiveIntelligence.executivePayload?.executivePriorityScore),
      forecastConfidence: safeNumber(input.forecastConfidence?.confidenceLevel || forecastConfidence?.confidenceLevel || forecastConfidence?.confidenceScore || 0),
      portfolioHealth: safeNumber(portfolioIntelligenceSummary?.summary?.healthScore || portfolioIntelligence?.summary?.healthScore || 0),
    };

    const context = {
      deal,
      analysis,
      portfolioIntelligence,
      executiveIntelligence,
      portfolioIntelligenceSummary,
      marketIntelligence,
      opportunityDetection,
      forecastConfidence,
      metrics,
      branchingPath: [],
      manualOverrides: input.manualOverrideStrategy ? [input.manualOverrideStrategy] : [],
      recoveryCount: 0,
    };

    const state = { workflowId, completedStages: new Set(), stageResults: new Map() };
    const resolvedStages = workflowConfig.stages.map((stage) => ({ ...stage }));
    const stageMap = new Map(resolvedStages.map((stage) => [stage.id, stage]));

    while (state.completedStages.size < resolvedStages.length) {
      const readyStages = resolvedStages.filter((stage) => {
        if (state.completedStages.has(stage.id)) return false;
        const dependsOn = normalizeArray(stage.dependsOn);
        return dependsOn.every((dependency) => state.completedStages.has(dependency));
      });

      if (readyStages.length === 0) break;

      const stageBatch = readyStages.map((stage) => ({ ...stage }));
      const results = await Promise.all(stageBatch.map((stageDefinition) => runStage(stageDefinition, context, state)));

      results.forEach((result, index) => {
        const stageDefinition = stageBatch[index];
        state.completedStages.add(stageDefinition.id);
        state.stageResults.set(stageDefinition.id, result);
        if (result?.status === 'Completed' || result?.status === 'Retrying') {
          const branchTarget = buildBranchingPath(context, stageDefinition);
          if (branchTarget) {
            context.branchingPath.push(branchTarget);
            const branchStage = stageMap.get(branchTarget);
            if (branchStage && !state.completedStages.has(branchStage.id)) {
              branchStage.dependsOn = normalizeArray(branchStage.dependsOn).concat(stageDefinition.id);
            }
          }
        }
      });
    }

    const auditEntries = auditTrail.filter((entry) => entry.workflowId === workflowId).map((entry) => ({
      workflowId,
      stage: entry.stage,
      status: entry.status,
      runtime: entry.runtime,
      errors: entry.errors,
      retryCount: entry.retryCount,
      sourceModule: entry.sourceModule,
    }));

    const finalStatus = auditEntries.every((entry) => entry.status === 'Completed' || entry.status === 'Retrying') ? 'Completed' : 'Failed';
    return {
      workflowId,
      finalStatus,
      auditTrail: auditEntries,
      context: {
        ...context,
        branchingPath: context.branchingPath,
        recoveryCount,
      },
    };
  }

  return {
    runWorkflow,
    buildAutomationSnapshot,
    getAuditTrail: () => auditTrail,
    eventBus,
    scheduler,
  };
}
