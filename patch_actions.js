const fs = require('fs');

const path = "F:/Roastery Operating System/ros-app/src/app/(dashboard)/laporan/actions.ts";
let content = fs.readFileSync(path, 'utf8');

// 1. Add imports
content = content.replace(
  'import { weightedAverageCost } from "@/lib/financial-reporting";',
  'import { weightedAverageCost } from "@/lib/financial-reporting";\nimport { getRbCostPrioritizingCache, getFgHppPrioritizingCache, fgHppFromRecipe } from "@/lib/costing";'
);

// 2. Add lastHpp to select in getInventoryValuationReport
content = content.replace(
  'select: { id: true, code: true, name: true, type: true, price: true, avgCostPerKg: true },',
  'select: { id: true, code: true, name: true, type: true, price: true, avgCostPerKg: true, lastHpp: true },'
);

// 3. Replace roastedBeanCost map building
const oldRbCost = `  const roastedBeanCost = new Map<string, number>();
  for (const product of products.filter((row) => row.type === "ROASTED_BEAN")) {
    const layers = roasts
      .filter((roast) => roast.outputProductId === product.id)
      .map((roast) => ({
        quantity: Number(roast.actualOutputKg ?? 0),
        totalCost: Number(roast.targetWeightKg) * (greenBeanCost.get(roast.inputProductId) ?? 0),
      }));
    roastedBeanCost.set(product.id, weightedAverageCost(layers));
  }`;

const newRbCost = `  const roastedBeanCost = new Map<string, number>();
  for (const product of products.filter((row) => row.type === "ROASTED_BEAN")) {
    const batches = roasts
      .filter((roast) => roast.outputProductId === product.id)
      .map((roast) => ({
        inputProductId: roast.inputProductId,
        targetWeightKg: roast.targetWeightKg,
        actualOutputKg: roast.actualOutputKg,
      }));
    
    roastedBeanCost.set(product.id, getRbCostPrioritizingCache(Number(product.avgCostPerKg ?? 0), batches, greenBeanCost));
  }`;
content = content.replace(oldRbCost, newRbCost);

// 4. Replace recipeHppMap
const oldFgHpp = `  // Calculate recipe-based HPP for FINISHED_GOODS
  const recipeHppMap = new Map<string, number>();
  for (const product of products.filter((row) => row.type === "FINISHED_GOODS")) {
    const recipe = product.recipes?.[0];
    if (recipe) {
      let cost = 0;
      for (const item of recipe.items) {
        const rbCost = roastedBeanCost.get(item.productId) ?? 0;
        cost += rbCost * (Number(item.gramsPerUnit) / 1000);
      }
      if (recipe.packagingId) {
        cost += packagingMap.get(recipe.packagingId) ?? 0;
      }
      if (cost > 0) {
        recipeHppMap.set(product.id, cost);
      }
    }
  }`;

const newFgHpp = `  // Calculate HPP for FINISHED_GOODS prioritizing cache (lastHpp > prod batch > recipe)
  const recipeHppMap = new Map<string, number>();
  for (const product of products.filter((row) => row.type === "FINISHED_GOODS")) {
    const recipe = product.recipes?.[0];
    const lastProdBatch = product.productionBatches.length > 0 
      ? product.productionBatches[product.productionBatches.length - 1] 
      : null;
      
    if (recipe) {
      const cost = getFgHppPrioritizingCache(
        product.lastHpp ? Number(product.lastHpp) : null,
        lastProdBatch ? Number(lastProdBatch.hppPerUnit) : null,
        recipe.items,
        recipe.packagingId,
        roastedBeanCost,
        packagingMap,
        0
      );
      if (cost > 0) {
        recipeHppMap.set(product.id, cost);
      }
    } else {
      // Fallback if no recipe but has lastHpp
      if (product.lastHpp && Number(product.lastHpp) > 0) {
        recipeHppMap.set(product.id, Number(product.lastHpp));
      }
    }
  }`;
content = content.replace(oldFgHpp, newFgHpp);

fs.writeFileSync(path, content, 'utf8');
console.log("Successfully patched laporan/actions.ts part 1");
