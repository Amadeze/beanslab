export function validateRoastingWeights(input: {
  mode: "ARTISAN" | "MANUAL";
  targetWeightKg: number;
  actualOutputKg?: number;
}) {
  if (!Number.isFinite(input.targetWeightKg) || input.targetWeightKg <= 0) {
    return "Berat target harus lebih dari 0.";
  }
  if (input.mode === "ARTISAN") return null;
  if (!Number.isFinite(input.actualOutputKg) || Number(input.actualOutputKg) <= 0) {
    return "Berat hasil wajib diisi untuk mode manual.";
  }
  if (Number(input.actualOutputKg) >= input.targetWeightKg) {
    return "Berat keluar tidak boleh >= berat masuk. Roasting selalu menghasilkan susut.";
  }
  return null;
}

export function normalizeProductionComponents(
  components: Array<{ productId: string; actualGrams: number }>,
) {
  const totals = new Map<string, number>();
  for (const component of components) {
    if (
      !component.productId ||
      !Number.isFinite(component.actualGrams) ||
      component.actualGrams <= 0
    ) {
      throw new Error("Komponen produksi tidak valid.");
    }
    totals.set(
      component.productId,
      (totals.get(component.productId) ?? 0) + component.actualGrams,
    );
  }
  return Array.from(totals, ([productId, actualGrams]) => ({
    productId,
    actualGrams,
  }));
}
