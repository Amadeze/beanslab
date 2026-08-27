import { describe, expect, it } from "vitest";
import { resolveSampleRatios, summarizeSampleUsage } from "./sample-usage";

describe("resolveSampleRatios", () => {
  it("allocates a blend without losing grams", () => {
    const result = resolveSampleRatios(200, [
      { productId: "gayo", ratioPercent: 70 },
      { productId: "robusta", ratioPercent: 30 },
    ]);
    expect(result).toEqual([
      { productId: "gayo", ratioPercent: 70, grams: 140, quantityKg: 0.14 },
      { productId: "robusta", ratioPercent: 30, grams: 60, quantityKg: 0.06 },
    ]);
  });

  it("assigns rounding remainder to the final component", () => {
    const result = resolveSampleRatios(100, [
      { productId: "a", ratioPercent: 33.33 },
      { productId: "b", ratioPercent: 66.67 },
    ]);
    expect(result.map((item) => item.grams)).toEqual([33, 67]);
  });

  it("rejects duplicate products and invalid totals", () => {
    expect(() => resolveSampleRatios(100, [
      { productId: "a", ratioPercent: 50 },
      { productId: "a", ratioPercent: 50 },
    ])).toThrow("tidak boleh ditambahkan dua kali");
    expect(() => resolveSampleRatios(100, [
      { productId: "a", ratioPercent: 60 },
      { productId: "b", ratioPercent: 30 },
    ])).toThrow("tepat 100%");
  });
});

describe("summarizeSampleUsage", () => {
  it("summarizes closing totals", () => {
    expect(summarizeSampleUsage([
      { packCount: 3, totalGrams: 300, totalCost: 27_500 },
      { packCount: 2, totalGrams: 200, totalCost: 18_000 },
    ])).toEqual({
      transactionCount: 2,
      packCount: 5,
      totalGrams: 500,
      totalCost: 45_500,
    });
  });
});
