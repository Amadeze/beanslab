import { describe, expect, it } from "vitest";
import {
  assessDefectRisk,
  buildReorderDraftLine,
  predictRoastYieldFromMoisture,
} from "./lot-intelligence";

describe("predictRoastYieldFromMoisture", () => {
  it("baseline 12% ketika moisture belum dicatat", () => {
    const result = predictRoastYieldFromMoisture(null);
    expect(result.confidence).toBe("NONE");
    expect(result.expectedYieldPercent).toBeCloseTo(83.8, 1);
    expect(result.expectedLossPercent).toBeCloseTo(16.2, 1);
  });

  it("moisture specialty (9–13) → confidence HIGH", () => {
    const result = predictRoastYieldFromMoisture(11);
    expect(result.confidence).toBe("HIGH");
    // loss = 11 + 4.2 = 15.2 → yield 84.8
    expect(result.expectedLossPercent).toBe(15.2);
    expect(result.expectedYieldPercent).toBe(84.8);
    expect(result.note).toContain("rentang specialty");
  });

  it("moisture di luar rentang → confidence MEDIUM dengan peringatan", () => {
    const low = predictRoastYieldFromMoisture(7.5);
    expect(low.confidence).toBe("MEDIUM");
    expect(low.note).toContain("di luar rentang");

    const high = predictRoastYieldFromMoisture(18);
    expect(high.confidence).toBe("MEDIUM");
    expect(high.expectedYieldPercent).toBe(Math.round((100 - 18 - 4.2) * 10) / 10);
  });

  it("konsisten: yield = 100 − loss", () => {
    for (const m of [0, 9, 12, 13, 25]) {
      const r = predictRoastYieldFromMoisture(m);
      expect(r.expectedYieldPercent + r.expectedLossPercent).toBeCloseTo(100, 6);
    }
  });
});

describe("assessDefectRisk", () => {
  it("belum dicatat → LOW tanpa penalti", () => {
    expect(assessDefectRisk(null)).toMatchObject({ severity: "LOW", qualityPenaltyPercent: 0 });
    expect(assessDefectRisk(undefined)).toMatchObject({ severity: "LOW" });
  });

  it("<5 per 300g tetap specialty grade", () => {
    expect(assessDefectRisk(3)).toMatchObject({ severity: "LOW", qualityPenaltyPercent: 0 });
    expect(assessDefectRisk(4).note).toContain("specialty");
  });

  it("5–8 → ELEVATED dengan penalti proporsional", () => {
    const risk = assessDefectRisk(6);
    expect(risk.severity).toBe("ELEVATED");
    expect(risk.qualityPenaltyPercent).toBe(1.5); // (6-4)*0.75
  });

  it(">8 → HIGH dan saran karantina/klaim", () => {
    const risk = assessDefectRisk(12);
    expect(risk.severity).toBe("HIGH");
    expect(risk.qualityPenaltyPercent).toBe(10); // (12-4)*1.25
    expect(risk.note).toContain("karantina");
  });
});

describe("buildReorderDraftLine", () => {
  const base = {
    subjectKind: "PRODUCT" as const,
    subjectId: "p1",
    name: "Gayo AA",
    unitLabel: "kg",
  };

  it("null bila stok masih menutup lead time + safety", () => {
    const line = buildReorderDraftLine({
      ...base,
      avgDailyUsage: 2,
      leadTimeDays: 3,
      safetyStockQuantity: 5,
      currentStock: 20,
    });
    expect(line).toBeNull(); // target max(6+5, 5)=11 < stok 20
  });

  it("menghitung kekurangan menuju target lead demand + safety stock", () => {
    const line = buildReorderDraftLine({
      ...base,
      avgDailyUsage: 4,
      leadTimeDays: 3,
      safetyStockQuantity: 5,
      currentStock: 8,
    });
    // target = 12+5=17; kekurangan = 9
    expect(line?.suggestedQuantity).toBe(9);
  });

  it("minimum 20% dari kebutuhan lead time agar PO tidak mikro", () => {
    const line = buildReorderDraftLine({
      ...base,
      avgDailyUsage: 50,
      leadTimeDays: 7,
      safetyStockQuantity: 0,
      currentStock: 349, // target 350 → kekurangan 1 → dinaikkan ke ceil(350*0.2)=70
    });
    expect(line?.suggestedQuantity).toBe(70);
  });

  it("supply kind dipertahankan", () => {
    const line = buildReorderDraftLine({
      ...base,
      subjectKind: "SUPPLY",
      name: "Paper cup 8oz",
      unitLabel: "pcs",
      avgDailyUsage: 30,
      leadTimeDays: 5,
      safetyStockQuantity: 200,
      currentStock: 100,
    });
    expect(line?.subjectKind).toBe("SUPPLY");
    expect(line?.suggestedQuantity).toBe(250);
  });
});
