const fs = require('fs');

const path = "F:/Roastery Operating System/ros-app/src/app/(dashboard)/laporan/actions.ts";
let content = fs.readFileSync(path, 'utf8');

// 1. We need allRoastingBatches and gbPriceMap
const oldSetup = `  const greenBeans: GreenBeanFlow[] = [];
  const roastedBeans: RoastedBeanFlow[] = [];
  const finishedGoods: FinishedGoodsFlow[] = [];
  const inPeriod = (date: Date) => !periodStart || date >= periodStart;

  // Build roasted bean cost map (weighted average from purchases)
  const roastedBeanCostMap = new Map<string, number>();
  for (const p of products) {
    if (p.type === "ROASTED_BEAN") {
      const totalKg = p.purchases.reduce((sum, pur) => sum + Number(pur.weightKg), 0);
      const totalCost = p.purchases.reduce((sum, pur) => sum + Number(pur.totalCost), 0);
      roastedBeanCostMap.set(p.id, totalKg > 0 ? totalCost / totalKg : 0);
    }
  }

  // Build recipe-based HPP map for FINISHED_GOODS
  const recipeHppMap = new Map<string, number>();
  for (const p of products) {
    if (p.type === "FINISHED_GOODS" && p.recipes.length > 0) {
      const recipe = p.recipes[0];
      let cost = 0;
      for (const item of (recipe as any).items ?? []) {
        const rbCost = roastedBeanCostMap.get(item.productId) ?? 0;
        cost += rbCost * (Number(item.gramsPerUnit) / 1000);
      }
      if (cost > 0) recipeHppMap.set(p.id, cost);
    }
  }`;

const newSetup = `  const greenBeans: GreenBeanFlow[] = [];
  const roastedBeans: RoastedBeanFlow[] = [];
  const finishedGoods: FinishedGoodsFlow[] = [];
  const inPeriod = (date: Date) => !periodStart || date >= periodStart;

  const gbPriceMap = new Map<string, number>();
  for (const p of products.filter(p => p.type === "GREEN_BEAN")) {
    const totalPurCost = p.purchases.reduce((s, pur) => s + Number(pur.totalCost), 0);
    const totalPurKg = p.purchases.reduce((s, pur) => s + Number(pur.weightKg), 0);
    gbPriceMap.set(p.id, totalPurKg > 0 ? totalPurCost / totalPurKg : 0);
  }

  const allRoastingBatches = await tp.parentRoastingBatch.findMany({
    where: { status: "COMPLETED" },
    select: { outputProductId: true, inputProductId: true, targetWeightKg: true, actualOutputKg: true, createdAt: true },
  });

  const roastedBeanCostMap = new Map<string, number>();
  for (const p of products.filter(p => p.type === "ROASTED_BEAN")) {
    const batches = allRoastingBatches.filter(b => b.outputProductId === p.id);
    const cost = getRbCostPrioritizingCache(Number(p.avgCostPerKg ?? 0), batches, gbPriceMap);
    roastedBeanCostMap.set(p.id, cost);
  }

  const packagingCostMap = new Map<string, number>();
  // We'll just pass empty map and 0 for packaging master cost here if we don't fetch it, 
  // but to be perfectly accurate we'd fetch packaging. For now, CoffeeFlowReport historically ignored packaging!
  // Let's keep it ignoring packaging for fgHppFromRecipe by passing 0.

  const recipeHppMap = new Map<string, number>();
  for (const p of products.filter(p => p.type === "FINISHED_GOODS")) {
    const recipe = p.recipes.length > 0 ? p.recipes[0] : null;
    const lastProdBatch = p.productionBatches.length > 0 
      ? p.productionBatches[p.productionBatches.length - 1] 
      : null;
      
    if (recipe) {
      const cost = getFgHppPrioritizingCache(
        p.lastHpp ? Number(p.lastHpp) : null,
        lastProdBatch ? Number(lastProdBatch.hppPerUnit) : null,
        (recipe as any).items ?? [],
        (recipe as any).packagingId,
        roastedBeanCostMap,
        packagingCostMap,
        0
      );
      if (cost > 0) {
        recipeHppMap.set(p.id, cost);
      }
    } else {
      if (p.lastHpp && Number(p.lastHpp) > 0) {
        recipeHppMap.set(p.id, Number(p.lastHpp));
      }
    }
  }
  
  // We need periodInvoices fetched separately because we need their details efficiently without giant includes
  const periodInvoices = await tp.invoiceItem.findMany({
    where: { invoice: { issuedAt: { lt: periodEnd }, status: { in: ["PAID", "PARTIAL", "ISSUED"] } } },
    select: { productId: true, subtotal: true, quantity: true, invoice: { select: { status: true, issuedAt: true } } }
  });
`;

content = content.replace(oldSetup, newSetup);

fs.writeFileSync(path, content, 'utf8');
console.log("Successfully patched laporan/actions.ts part 2 setup");
