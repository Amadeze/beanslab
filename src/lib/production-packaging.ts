export function calculatePackagingSuggestion({
  targetRbKg,
  coffeeGramsPerUnit,
  capacityGrams,
}: {
  targetRbKg: number;
  coffeeGramsPerUnit: number;
  capacityGrams: number | null;
}): { units: number; gramsPerUnit: number; remainderGrams: number } | null {
  if (!Number.isFinite(targetRbKg) || targetRbKg <= 0) return null;
  const gramsPerUnit = coffeeGramsPerUnit > 0
    ? coffeeGramsPerUnit
    : Number(capacityGrams ?? 0);
  if (!Number.isFinite(gramsPerUnit) || gramsPerUnit <= 0) return null;

  const targetGrams = targetRbKg * 1000;
  const units = Math.floor(targetGrams / gramsPerUnit);
  if (units < 1) return null;

  return {
    units,
    gramsPerUnit,
    remainderGrams: Math.max(0, targetGrams - units * gramsPerUnit),
  };
}

export function isPackagingOverCapacity(
  coffeeGramsPerUnit: number,
  capacityGrams: number | null,
): boolean {
  return Boolean(
    capacityGrams &&
    capacityGrams > 0 &&
    coffeeGramsPerUnit > capacityGrams,
  );
}
