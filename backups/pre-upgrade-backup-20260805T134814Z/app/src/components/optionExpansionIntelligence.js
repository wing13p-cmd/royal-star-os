export function buildProductVaultIntelligence({ products = [], selectedProductIds = [], taxPercent = 0, deal = {} }) {
  const approvedProducts = products.filter((product) => product.approved);
  const preferredProducts = products.filter((product) => product.preferred);
  const selectedProductIdsNormalized = selectedProductIds.filter(Boolean);
  let selectedProducts = products.filter((product) => {
    const explicitId = product.id || product.productId || product.key || product.sku || product.productName || product.name;
    return Boolean(explicitId) && selectedProductIdsNormalized.includes(explicitId);
  });

  if (selectedProducts.length === 0 && selectedProductIdsNormalized.length > 0) {
    selectedProducts = products.slice(0, Math.min(selectedProductIdsNormalized.length, products.length));
  }
  const subtotal = selectedProducts.reduce((sum, product) => sum + Number(product.currentPrice || 0), 0);
  const taxAmount = subtotal * (Number(taxPercent || 0) / 100);
  const total = subtotal + taxAmount;

  const approvedCount = approvedProducts.length;
  const preferredCount = preferredProducts.length;
  const selectionHealth = selectedProducts.length >= 2 ? "Balanced" : selectedProducts.length === 1 ? "Focused" : "Needs Selection";

  const recommendations = [
    approvedCount >= 2 ? "Approved products are strong enough to support a disciplined budget review." : "Add more approved products to strengthen the selection set.",
    preferredCount >= 1 ? "Preferred products remain aligned with the current buying posture." : "Consider surfacing preferred options to reduce procurement risk.",
    selectedProducts.length >= 2 ? "Selection breadth looks healthy for this deal." : "Expand the selected product set to confirm pricing elasticity.",
  ];

  return {
    summary: {
      approvedCount,
      preferredCount,
      subtotal,
      taxAmount,
      total,
      selectionHealth,
      selectedCount: selectedProducts.length,
      dealLabel: deal.propertyAddress || "Current deal",
    },
    recommendations,
  };
}

export function buildMaterialMatrixIntelligence({ materials = [], products = [], properties = [] }) {
  const totalBudget = materials.reduce((sum, material) => sum + Number(material.totalCost || 0), 0);
  const highPriorityCount = materials.filter((material) => material.priority === "High" || material.priority === "Critical").length;
  const budgetHealth = totalBudget > 1500 || highPriorityCount >= 2 ? "Watch" : totalBudget > 1000 ? "Stable" : "Lean";

  const recommendations = [
    highPriorityCount >= 2 ? "A few high-priority materials are driving budget pressure." : "Materials appear controlled for the current scope.",
    products.length > 0 ? "Approved products create a workable baseline for comparison." : "Add approved products to improve the cost benchmark.",
    properties.length > 0 ? "The property context is available for tighter scope alignment." : "Link more property context to refine the cost model.",
  ];

  return {
    summary: {
      totalBudget,
      highPriorityCount,
      budgetHealth,
      materialCount: materials.length,
    },
    recommendations,
  };
}

export function buildAppraisalPacketIntelligence({ packet = {}, comps = [] }) {
  const packetName = packet.packetName || "Current packet";
  const supportedARV = Number(packet.supportedARV || 0);
  const requestedARV = Number(packet.requestedARV || 0);
  const variance = requestedARV ? ((requestedARV - supportedARV) / supportedARV) * 100 : 0;
  const includedComps = comps.filter((comp) => comp.included !== false);
  const riskLevel = variance > 10 ? "High Risk" : variance > 5 ? "Moderate Risk" : "Low Risk";

  const nextSteps = [
    requestedARV > supportedARV ? "Consider narrowing the gap between supported and requested ARV before final review." : "The packet is well aligned to the supported valuation basis.",
    includedComps.length >= 3 ? "Comp coverage is sufficient for a confident packet review." : "Add more included comps to strengthen appraisal support.",
    packet.strategy ? `Strategy posture is set to ${packet.strategy}.` : "Confirm the intended strategy to sharpen packet positioning.",
  ];

  return {
    summary: `${packetName} is positioned with a ${riskLevel.toLowerCase()} profile.`,
    appraisal: {
      supportedARV,
      requestedARV,
      variance,
      riskLevel,
    },
    nextSteps,
  };
}
