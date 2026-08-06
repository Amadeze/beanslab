export type ValuationRow = {
  id: string;
  code: string;
  name: string;
  category: "GREEN_BEAN" | "ROASTED_BEAN" | "FINISHED_GOODS" | "PACKAGING" | "SUPPLY";
  stock: number;
  unit: string;
  unitCost: number;
  totalValue: number;
  retailPrice?: number;
  potentialRevenue?: number;
  sampleWriteOff: number;
};

export function computeValuationMetrics(items: ValuationRow[]) {
  const totalGreenBeanValue = items.filter((i) => i.category === "GREEN_BEAN").reduce((s, i) => s + i.totalValue, 0);
  const totalRoastedBeanValue = items.filter((i) => i.category === "ROASTED_BEAN").reduce((s, i) => s + i.totalValue, 0);
  const totalFinishedGoodsValue = items.filter((i) => i.category === "FINISHED_GOODS").reduce((s, i) => s + i.totalValue, 0);
  const totalPackagingValue = items.filter((i) => i.category === "PACKAGING").reduce((s, i) => s + i.totalValue, 0);
  const totalSupplyValue = items.filter((i) => i.category === "SUPPLY").reduce((s, i) => s + i.totalValue, 0);
  const grandTotalValue = totalGreenBeanValue + totalRoastedBeanValue + totalFinishedGoodsValue + totalPackagingValue + totalSupplyValue;

  const retailFgItems = items.filter((i) => i.category === "FINISHED_GOODS" && i.potentialRevenue && i.potentialRevenue > 0);
  const totalFinishedGoodsPotentialRevenue = retailFgItems.reduce((s, i) => s + (i.potentialRevenue || 0), 0);
  const retailFgValue = retailFgItems.reduce((s, i) => s + i.totalValue, 0);

  const fgGrossMargin = totalFinishedGoodsPotentialRevenue - retailFgValue;
  const totalFinishedGoodsMarginHealth = totalFinishedGoodsPotentialRevenue > 0 ? (fgGrossMargin / totalFinishedGoodsPotentialRevenue) * 100 : 0;

  const retailItems = items.filter((i) => i.potentialRevenue && i.potentialRevenue > 0);
  const totalPotentialRevenue = retailItems.reduce((s, i) => s + (i.potentialRevenue || 0), 0);

  const retailRbValue = retailItems.filter((i) => i.category === "ROASTED_BEAN").reduce((s, i) => s + i.totalValue, 0);

  const totalGrossMargin = totalPotentialRevenue - (retailFgValue + retailRbValue);
  const totalMarginHealth = totalPotentialRevenue > 0 ? (totalGrossMargin / totalPotentialRevenue) * 100 : 0;
  const totalSampleWriteOff = items.reduce((s, i) => s + i.sampleWriteOff, 0);

  return {
    totalGreenBeanValue,
    totalRoastedBeanValue,
    totalFinishedGoodsValue,
    totalPackagingValue,
    totalSupplyValue,
    grandTotalValue,
    totalFinishedGoodsPotentialRevenue,
    totalFinishedGoodsMarginHealth,
    totalPotentialRevenue,
    totalMarginHealth,
    totalSampleWriteOff,
    zeroCostItemCount: items.filter((item) => item.unitCost <= 0).length,
  };
}
