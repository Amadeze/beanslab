import { describe, it, expect } from "vitest";
import { fgHppFromRecipe, getFgHppPrioritizingCache, roastedBeanCostFromBatches, roastedBeanCostWAC, getRbCostPrioritizingCache } from "./costing";

describe("fgHppFromRecipe", () => {
  const rbCostMap = new Map([["rb-1", 100000]]); // per kg
  const packagingCostMap = new Map([["pkg-1", 500]]);
  const supplyCostMap = new Map([["supply-1", 1000], ["supply-2", 200]]);

  it("menghitung RB + packaging + supply items per unit", () => {
    const cost = fgHppFromRecipe(
      [{ productId: "rb-1", gramsPerUnit: 1000 }],
      "pkg-1",
      rbCostMap,
      packagingCostMap,
      0,
      undefined,
      [
        { supplyItemId: "supply-1", quantityPerUnit: 1 },
        { supplyItemId: "supply-2", quantityPerUnit: 2 },
      ],
      supplyCostMap,
    );
    // 100000 * (1000/1000) + 500 + (1000*1 + 200*2) = 101900
    expect(cost).toBe(101900);
  });

  it("tidak menghitung dua kali packaging yang juga ada di recipeSupplyItems", () => {
    const cost = fgHppFromRecipe(
      [{ productId: "rb-1", gramsPerUnit: 500 }],
      "pkg-1",
      rbCostMap,
      packagingCostMap,
      0,
      undefined,
      [
        { supplyItemId: "supply-1", quantityPerUnit: 1 }, // packaging canonical
        { supplyItemId: "supply-2", quantityPerUnit: 1 },
      ],
      supplyCostMap,
      "supply-1", // packagingSupplyItemId → skip di supply loop
    );
    // 100000 * 0.5 + 500 (packaging) + (supply-2: 200*1) = 50700
    expect(cost).toBe(50700);
  });

  it("menambahkan labor & overhead bila diberikan", () => {
    const cost = fgHppFromRecipe([], null, new Map(), new Map(), 0, 250, [], new Map(), undefined);
    expect(cost).toBe(250);
  });
});

describe("getFgHppPrioritizingCache", () => {
  it("memakai lastHpp bila valid", () => {
    const cost = getFgHppPrioritizingCache(9000, 8000, [], null, new Map(), new Map(), 0);
    expect(cost).toBe(9000);
  });

  it("memakai production batch HPP bila lastHpp kosong", () => {
    const cost = getFgHppPrioritizingCache(null, 8000, [], null, new Map(), new Map(), 0);
    expect(cost).toBe(8000);
  });

  it("fallback ke resep termasuk supply items", () => {
    const supplyCostMap = new Map([["supply-1", 500]]);
    const cost = getFgHppPrioritizingCache(
      null,
      null,
      [{ productId: "rb-1", gramsPerUnit: 1000 }],
      "pkg-1",
      new Map([["rb-1", 100000]]),
      new Map([["pkg-1", 500]]),
      0,
      undefined,
      [{ supplyItemId: "supply-1", quantityPerUnit: 1 }],
      supplyCostMap,
      undefined,
    );
    expect(cost).toBe(101000);
  });
});

describe("roasted bean costing", () => {
  const batches = [
    { inputProductId: "gb-1", targetWeightKg: 20, actualOutputKg: 18 },
    { inputProductId: "gb-2", targetWeightKg: 10, actualOutputKg: 9 },
  ];
  const gbPriceMap = new Map([["gb-1", 100000], ["gb-2", 120000]]);

  it("roastedBeanCostFromBatches menghitung biaya per kg output", () => {
    const cost = roastedBeanCostFromBatches(batches, gbPriceMap);
    // (20*100000 + 10*120000) / (18+9) = 3200000/27
    expect(cost).toBeCloseTo(3200000 / 27, 4);
  });

  it("roastedBeanCostWAC memakai weighted average layer", () => {
    const cost = roastedBeanCostWAC(batches, gbPriceMap);
    // layers: qty18 total2000000, qty9 total1200000 → (3200000)/(27)
    expect(cost).toBeCloseTo(3200000 / 27, 4);
  });

  it("getRbCostPrioritizingCache memprioritaskan avgCostPerKg dari cache", () => {
    const cost = getRbCostPrioritizingCache(130000, batches, gbPriceMap);
    expect(cost).toBe(130000);
  });

  it("getRbCostPrioritizingCache fallback ke WAC saat cache 0", () => {
    const cost = getRbCostPrioritizingCache(0, batches, gbPriceMap);
    expect(cost).toBeCloseTo(3200000 / 27, 4);
  });
});
