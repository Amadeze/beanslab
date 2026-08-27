import { describe, expect, it } from "vitest";
import {
  calculatePackagingSuggestion,
  isPackagingOverCapacity,
} from "./production-packaging";

describe("production packaging arithmetic", () => {
  it("suggests 40 units for 10 kg in 250 g packs without mutating form state", () => {
    expect(calculatePackagingSuggestion({
      targetRbKg: 10,
      coffeeGramsPerUnit: 0,
      capacityGrams: 250,
    })).toEqual({ units: 40, gramsPerUnit: 250, remainderGrams: 0 });
  });

  it("uses the actual recipe grams instead of nominal capacity", () => {
    expect(calculatePackagingSuggestion({
      targetRbKg: 10,
      coffeeGramsPerUnit: 240,
      capacityGrams: 250,
    })).toEqual({ units: 41, gramsPerUnit: 240, remainderGrams: 160 });
  });

  it("warns only for overfill", () => {
    expect(isPackagingOverCapacity(251, 250)).toBe(true);
    expect(isPackagingOverCapacity(250, 250)).toBe(false);
    expect(isPackagingOverCapacity(200, 250)).toBe(false);
    expect(isPackagingOverCapacity(500, null)).toBe(false);
  });
});
