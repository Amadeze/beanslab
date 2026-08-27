export type SampleRatioInput = {
  productId: string;
  ratioPercent: number;
};

export type ResolvedSampleRatio = SampleRatioInput & {
  grams: number;
  quantityKg: number;
};

export function resolveSampleRatios(
  totalGrams: number,
  components: SampleRatioInput[],
): ResolvedSampleRatio[] {
  if (!Number.isInteger(totalGrams) || totalGrams <= 0 || totalGrams > 1_000_000) {
    throw new Error("Total gram sample tidak valid.");
  }
  if (components.length === 0 || components.length > 10) {
    throw new Error("Komponen sample wajib diisi.");
  }

  const productIds = new Set<string>();
  let ratioTotal = 0;
  for (const component of components) {
    if (!component.productId || productIds.has(component.productId)) {
      throw new Error("Roasted bean yang sama tidak boleh ditambahkan dua kali.");
    }
    if (!Number.isFinite(component.ratioPercent) || component.ratioPercent <= 0 || component.ratioPercent > 100) {
      throw new Error("Persentase komponen sample tidak valid.");
    }
    productIds.add(component.productId);
    ratioTotal += component.ratioPercent;
  }
  if (Math.abs(ratioTotal - 100) > 0.01) {
    throw new Error("Total komposisi custom blend harus tepat 100%.");
  }

  let allocatedGrams = 0;
  return components.map((component, index) => {
    const grams = index === components.length - 1
      ? totalGrams - allocatedGrams
      : Math.round((totalGrams * component.ratioPercent) / 100);
    allocatedGrams += grams;
    return {
      ...component,
      grams,
      quantityKg: grams / 1000,
    };
  });
}

export function summarizeSampleUsage(
  rows: Array<{ packCount: number; totalGrams: number; totalCost: number }>,
): { transactionCount: number; packCount: number; totalGrams: number; totalCost: number } {
  return rows.reduce<{ transactionCount: number; packCount: number; totalGrams: number; totalCost: number }>(
    (summary, row) => ({
      transactionCount: summary.transactionCount + 1,
      packCount: summary.packCount + row.packCount,
      totalGrams: summary.totalGrams + row.totalGrams,
      totalCost: summary.totalCost + row.totalCost,
    }),
    { transactionCount: 0, packCount: 0, totalGrams: 0, totalCost: 0 },
  );
}
