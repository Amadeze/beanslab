import type { FinancialInvoice, SalesPerformance } from "./financial-reporting";
import type { Prisma } from "@prisma/client";

type Numeric = string | number | Prisma.Decimal;

export function computeSampleCostByType(components: Array<{
  unitCost: Numeric;
  quantityKg: Numeric | null;
  quantityUnit: number | null;
  product?: { type: string } | null;
  packagingId?: string | null;
}>) {
  const result: Record<string, number> = {};
  for (const comp of components) {
    const qty = comp.quantityKg ? Number(comp.quantityKg) : (comp.quantityUnit ?? 0);
    const cost = Number(comp.unitCost) * qty;
    if (comp.product?.type === "ROASTED_BEAN") {
      result.BIAYA_SAMPLE_RB = (result.BIAYA_SAMPLE_RB ?? 0) + cost;
    } else if (comp.product?.type === "FINISHED_GOODS") {
      result.BIAYA_SAMPLE_FG = (result.BIAYA_SAMPLE_FG ?? 0) + cost;
    } else if (comp.packagingId) {
      result.BIAYA_SAMPLE_PKG = (result.BIAYA_SAMPLE_PKG ?? 0) + cost;
    }
  }
  return result;
}

export function computeCogsComponentBreakdown(
  productionBatches: Array<{
    hppPerUnit: Numeric;
    unitsProduced: number;
    laborCost: Numeric | null;
    overheadAllocated: Numeric | null;
    totalRbUsedKg: Numeric | null;
    packaging: { costPerUnit: Numeric | null; avgCostPerUnit: Numeric | null };
  }>,
  cogs: number
) {
  let batchRawMaterial = 0, batchLabor = 0, batchOverhead = 0, batchPackaging = 0;
  for (const b of productionBatches) {
    const totalBatchCost = Number(b.hppPerUnit) * b.unitsProduced;
    const labor = Number(b.laborCost ?? 0);
    const overhead = Number(b.overheadAllocated ?? 0);
    const pkgUnitCost = Number(b.packaging.avgCostPerUnit || b.packaging.costPerUnit || 0);
    const packaging = pkgUnitCost * b.unitsProduced;
    const rawMaterial = totalBatchCost - labor - overhead - packaging;
    if (rawMaterial > 0) batchRawMaterial += rawMaterial;
    batchLabor += labor;
    batchOverhead += overhead;
    batchPackaging += packaging;
  }
  const totalBatchComponent = batchRawMaterial + batchLabor + batchOverhead + batchPackaging;
  
  if (totalBatchComponent > 0) {
    const rawMaterialCOGS = Math.round((batchRawMaterial / totalBatchComponent) * cogs);
    const laborCOGS = Math.round((batchLabor / totalBatchComponent) * cogs);
    const overheadCOGS = Math.round((batchOverhead / totalBatchComponent) * cogs);
    const packagingCOGS = cogs - rawMaterialCOGS - laborCOGS - overheadCOGS;
    return [
      { category: "BAHAN_BAKU", amount: rawMaterialCOGS },
      { category: "TENAGA_KERJA", amount: laborCOGS },
      { category: "OVERHEAD_PABRIK", amount: overheadCOGS },
      { category: "KEMASAN", amount: packagingCOGS },
    ].filter((c) => c.amount > 0);
  } else {
    return [
      { category: "BAHAN_BAKU", amount: Math.round(cogs * 0.75) },
      { category: "KEMASAN", amount: Math.round(cogs * 0.25) },
    ].filter((c) => c.amount > 0);
  }
}
