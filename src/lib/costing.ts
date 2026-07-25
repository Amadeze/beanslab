import { weightedAverageCost } from "./financial-reporting";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DecimalLike = any;
type RoastingBatchInput = {
  inputProductId: string;
  targetWeightKg: DecimalLike;
  actualOutputKg: DecimalLike | null;
};

/**
 * Hitung cost per kg roasted bean dari roasting batches (simple aggregate).
 * Sama seperti logic lama di getCoffeeFlowReport.
 */
export function roastedBeanCostFromBatches(
  batches: RoastingBatchInput[],
  gbPriceMap: Map<string, number>,
): number {
  let totalInputCost = 0;
  let totalOutputKg = 0;
  for (const b of batches) {
    const inW = Number(b.targetWeightKg);
    const outW = Number(b.actualOutputKg ?? 0);
    const gbPrice = gbPriceMap.get(b.inputProductId) ?? 0;
    totalInputCost += inW * gbPrice;
    totalOutputKg += outW;
  }
  return totalOutputKg > 0 ? totalInputCost / totalOutputKg : 0;
}

/**
 * Hitung cost per kg roasted bean dari roasting batches (layer-based WAC).
 * Sama seperti logic lama di getInventoryValuationReport.
 */
export function roastedBeanCostWAC(
  batches: RoastingBatchInput[],
  gbPriceMap: Map<string, number>,
): number {
  const layers = batches.map((b) => ({
    quantity: Number(b.actualOutputKg ?? 0),
    totalCost: Number(b.targetWeightKg) * (gbPriceMap.get(b.inputProductId) ?? 0),
  }));
  return weightedAverageCost(layers);
}

/**
 * Hitung RB cost dengan memprioritaskan cache avgCostPerKg dari database.
 * 1. Gunakan avgCostPerKgFallback jika valid (> 0)
 * 2. Kalau 0 atau tidak ada, fallback ke kalkulasi roasting batch (WAC)
 */
export function getRbCostPrioritizingCache(
  avgCostPerKg: number,
  batches: RoastingBatchInput[],
  gbPriceMap: Map<string, number>,
): number {
  if (avgCostPerKg > 0) return avgCostPerKg;
  return roastedBeanCostWAC(batches, gbPriceMap);
}

/**
 * Hitung HPP per unit Finished Goods dengan memprioritaskan snapshot HPP (lastHpp atau production batch)
 * 1. Gunakan lastHpp jika valid (> 0)
 * 2. Kalau tidak ada, fallback ke HPP produksi terakhir (productionBatchHpp)
 * 3. Kalau masih tidak ada, rekonstruksi dari Recipe.
 */
export function getFgHppPrioritizingCache(
  lastHpp: number | null | undefined,
  productionBatchHpp: number | null | undefined,
  recipeItems: RecipeItem[],
  recipePackagingId: string | null | undefined,
  rbCostMap: Map<string, number>,
  packagingCostMap: Map<string, number>,
  packagingMasterCost: number,
): number {
  if (lastHpp && lastHpp > 0) return Number(lastHpp);
  if (productionBatchHpp && productionBatchHpp > 0) return Number(productionBatchHpp);
  return fgHppFromRecipe(recipeItems, recipePackagingId, rbCostMap, packagingCostMap, packagingMasterCost);
}

type RecipeItem = { productId: string; gramsPerUnit: DecimalLike };

/**
 * Hitung HPP per unit finished goods dari recipe + RB cost + packaging cost.
 * Dipakai bersama oleh Valuasi Aset dan Coffee Flow.
 */
export function fgHppFromRecipe(
  items: RecipeItem[],
  packagingId: string | null | undefined,
  rbCostMap: Map<string, number>,
  packagingCostMap: Map<string, number>,
  packagingMasterCost: number,
): number {
  let cost = 0;
  for (const item of items) {
    const rbCost = rbCostMap.get(item.productId) ?? 0;
    cost += rbCost * (Number(item.gramsPerUnit) / 1000);
  }
  if (packagingId) {
    cost += packagingCostMap.get(packagingId) ?? packagingMasterCost;
  }
  return cost;
}
