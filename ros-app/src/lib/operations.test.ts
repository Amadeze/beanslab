import { describe, expect, it } from "vitest";
import {
  normalizeProductionComponents,
  validateRoastingWeights,
} from "./operations";

describe("validateRoastingWeights", () => {
  it("requires a positive manual output below target", () => {
    expect(validateRoastingWeights({ mode: "MANUAL", targetWeightKg: 10 })).toBeTruthy();
    expect(validateRoastingWeights({ mode: "MANUAL", targetWeightKg: 10, actualOutputKg: 0 })).toBeTruthy();
    expect(validateRoastingWeights({ mode: "MANUAL", targetWeightKg: 10, actualOutputKg: 10 })).toBeTruthy();
    expect(validateRoastingWeights({ mode: "MANUAL", targetWeightKg: 10, actualOutputKg: 8.4 })).toBeNull();
  });

  it("allows Artisan batches to wait for their output", () => {
    expect(validateRoastingWeights({ mode: "ARTISAN", targetWeightKg: 10 })).toBeNull();
  });
});

describe("normalizeProductionComponents", () => {
  it("merges duplicate ingredients before stock and cost calculations", () => {
    expect(normalizeProductionComponents([
      { productId: "rb-1", actualGrams: 100 },
      { productId: "rb-1", actualGrams: 150 },
      { productId: "rb-2", actualGrams: 50 },
    ])).toEqual([
      { productId: "rb-1", actualGrams: 250 },
      { productId: "rb-2", actualGrams: 50 },
    ]);
  });

  it("rejects zero or invalid component weights", () => {
    expect(() => normalizeProductionComponents([
      { productId: "rb-1", actualGrams: 0 },
    ])).toThrow("Komponen produksi tidak valid.");
  });
});
