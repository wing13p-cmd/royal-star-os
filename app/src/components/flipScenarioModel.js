import { buildUnderwritingMetrics } from './intelligenceUpgradeEngine.js';
import { normalizePercent } from '../utils/percentageNormalization.js';

function toOptionalNumber(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string' && value.trim() === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function toKnownNumber(value, fallback = 0) {
  return Number.isFinite(value) ? value : fallback;
}

function computeScenario(baseValues, scenario) {
  const purchasePrice = toOptionalNumber(baseValues.purchasePrice);
  const rehabBudget = toOptionalNumber(baseValues.rehabBudget);
  const arv = toOptionalNumber(baseValues.arv);
  const financingCosts = toKnownNumber(toOptionalNumber(baseValues.financingCosts), 0);
  const closingCosts = toKnownNumber(toOptionalNumber(baseValues.closingCosts), 0);
  const taxes = toKnownNumber(toOptionalNumber(baseValues.taxes), 0);
  const insurance = toKnownNumber(toOptionalNumber(baseValues.insurance), 0);
  const holdingMonths = toKnownNumber(toOptionalNumber(baseValues.holdingMonths), 0);
  const monthlyHoldingCost = toKnownNumber(toOptionalNumber(baseValues.monthlyHoldingCost), 0);
  const additionalCosts = toKnownNumber(toOptionalNumber(baseValues.additionalCosts), 0);

  const sellingCostPercentMeta = normalizePercent(baseValues.sellingCostPercent ?? 8, { min: 0, max: 1 });
  const contingencyPercentMeta = normalizePercent(baseValues.contingencyPercent ?? 10, { min: 0, max: 1 });

  const missingCoreInputs = [];
  if (!(purchasePrice > 0)) missingCoreInputs.push('Purchase Price');
  if (!(rehabBudget > 0)) missingCoreInputs.push('Rehab Budget');
  if (!(arv > 0)) missingCoreInputs.push('ARV / Sale Price');
  if (sellingCostPercentMeta.status !== 'ok') missingCoreInputs.push('Selling Cost Percentage');
  if (contingencyPercentMeta.status !== 'ok') missingCoreInputs.push('Contingency Percentage');

  if (missingCoreInputs.length > 0) {
    return {
      missingCoreInputs,
      totalProjectCost: null,
      grossProfit: null,
      netProfit: null,
      roi: null,
      profitMargin: null,
      maximumAllowableOffer: null,
      breakEvenSalePrice: null,
      breakEvenHoldingPeriod: null,
      scenarioArv: null,
      scenarioRehab: null,
      scenarioHoldingMonths: null,
      rehabContingency: null,
      totalAcquisitionCost: null,
      totalHoldingCost: null,
      totalSellingCost: null,
    };
  }

  let scenarioArv = arv;
  let scenarioRehab = rehabBudget;
  let scenarioHoldingMonths = holdingMonths;
  let scenarioMonthlyHoldingCost = monthlyHoldingCost;
  let scenarioSellingCostRate = sellingCostPercentMeta.value;

  if (scenario === 'best') {
    scenarioArv = arv * 1.05;
    scenarioRehab = Math.max(0, rehabBudget * 0.95);
    scenarioHoldingMonths = Math.max(0, holdingMonths - 1);
    scenarioMonthlyHoldingCost = Math.max(0, monthlyHoldingCost * 0.9);
    scenarioSellingCostRate = Math.max(0, sellingCostPercentMeta.value - 0.005);
  } else if (scenario === 'worst') {
    scenarioArv = Math.max(0, arv * 0.95);
    scenarioRehab = rehabBudget * 1.1;
    scenarioHoldingMonths = holdingMonths + 1;
    scenarioMonthlyHoldingCost = monthlyHoldingCost * 1.1;
    scenarioSellingCostRate = sellingCostPercentMeta.value + 0.005;
  }

  const rehabContingency = Math.max(0, scenarioRehab * contingencyPercentMeta.value);
  const totalAcquisitionCost = purchasePrice + financingCosts + closingCosts + taxes + insurance + additionalCosts;
  const totalHoldingCost = Math.max(0, scenarioHoldingMonths * scenarioMonthlyHoldingCost);
  const totalSellingCost = Math.max(0, scenarioArv * scenarioSellingCostRate);

  const metrics = buildUnderwritingMetrics({
    purchasePrice,
    rehabBudget: scenarioRehab,
    estimatedArv: scenarioArv,
    holdingCosts: totalHoldingCost,
    closingCosts,
    financingCosts,
    taxes,
    insurance,
    sellingCosts: totalSellingCost,
    contingency: rehabContingency,
  }, {}, { includeContingency: true, includeHoldingCost: true, includeTaxesAndInsurance: true, includeExtraCosts: true });

  const totalProjectCost = metrics.totalProjectCost;
  const grossProfit = metrics.grossProfit;
  const netProfit = metrics.profit;
  const roi = metrics.roi;
  const profitMargin = scenarioArv > 0 ? netProfit / scenarioArv : null;
  const maximumAllowableOffer = Math.max(0, scenarioArv * 0.7 - scenarioRehab);
  const breakEvenSalePrice = Number.isFinite(totalProjectCost) ? totalProjectCost + totalSellingCost : null;
  const breakEvenHoldingPeriod = scenarioMonthlyHoldingCost > 0 && Number.isFinite(breakEvenSalePrice)
    ? Math.max(0, (breakEvenSalePrice - scenarioArv) / scenarioMonthlyHoldingCost)
    : null;

  return {
    missingCoreInputs,
    scenarioArv,
    scenarioRehab,
    scenarioHoldingMonths,
    rehabContingency,
    totalAcquisitionCost,
    totalHoldingCost,
    totalSellingCost,
    totalProjectCost,
    grossProfit,
    netProfit,
    roi,
    profitMargin,
    maximumAllowableOffer,
    breakEvenSalePrice,
    breakEvenHoldingPeriod,
  };
}

export function buildFlipScenarioSet(baseValues) {
  const base = computeScenario(baseValues, 'base');
  const best = computeScenario(baseValues, 'best');
  const worst = computeScenario(baseValues, 'worst');

  const missingCoreInputs = Array.from(new Set([
    ...(base.missingCoreInputs || []),
    ...(best.missingCoreInputs || []),
    ...(worst.missingCoreInputs || []),
  ]));

  return {
    base,
    best,
    worst,
    missingCoreInputs,
  };
}
