import { describe, expect, it } from "vitest";
import type { CuppingCategory } from "@prisma/client";
import { computeScaTotal, scaGrade } from "./cupping-intelligence";

const full = (over: Partial<Record<string, number>> = {}) => ({
  FRAGRANCE: 8,
  AROMA: 8,
  FLAVOR: 8,
  AFTERTASTE: 8,
  ACIDITY: 8,
  BODY: 8,
  BALANCE: 8,
  UNIFORMITY: 10,
  CLEAN_CUP: 10,
  SWEETNESS: 10,
  OVERALL: 8,
  ...over,
}) as Partial<Record<CuppingCategory, number>>;

describe("computeScaTotal", () => {
  it("menggabungkan Fragrance+Aroma jadi satu item SCA", () => {
    // FA = (7+9)/2 = 8; semua item 8 kecuali UNIFORMITY/CLEAN/SWEETNESS 10
    const total = computeScaTotal(full({ FRAGRANCE: 7, AROMA: 9 }));
    // sum = 8*7 + 10*3 = 86
    expect(total).toBe(86);
  });

  it("penalti defect 2 poin per defect, maksimum 10", () => {
    expect(computeScaTotal(full(), 2)).toBe(82); // 86-4
    expect(computeScaTotal(full(), 5)).toBe(76); // 86-10
    expect(computeScaTotal(full(), 50)).toBe(76); // clamp
  });

  it("tidak pernah negatif dan dibulatkan ke kuartal", () => {
    const low = full({ FLAVOR: 0.1 });
    const total = computeScaTotal(low, 5);
    expect(total).toBeGreaterThanOrEqual(0);
    expect(total * 4).toBeCloseTo(Math.round(total * 4), 6);
  });

  it("skor sempurna tanpa defect = 100", () => {
    const perfect = full({
      FRAGRANCE: 10, AROMA: 10, FLAVOR: 10, AFTERTASTE: 10, ACIDITY: 10,
      BODY: 10, BALANCE: 10, UNIFORMITY: 10, CLEAN_CUP: 10, SWEETNESS: 10, OVERALL: 10,
    });
    expect(computeScaTotal(perfect)).toBe(100);
  });
});

describe("scaGrade", () => {
  it("ambang industri", () => {
    expect(scaGrade(88)).toBe("OUTSTANDING");
    expect(scaGrade(85)).toBe("EXCELLENT");
    expect(scaGrade(80)).toBe("SPECIALTY");
    expect(scaGrade(79.75)).toBe("BELOW_SPECIALTY");
  });
});

