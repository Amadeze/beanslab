import { describe, expect, it } from "vitest";
import {
  assessDaysOnHand,
  computeDaysRoastedOnHand,
  computeFefoRisk,
  computeGreenTurnover,
} from "./roastery-kpis";

const NOW = new Date("2026-08-26T00:00:00Z");
const daysFromNow = (d: number) => new Date(NOW.getTime() + d * 86_400_000).toISOString();

describe("computeFefoRisk", () => {
  it("sums at-risk kg within the horizon and finds nearest expiry", () => {
    const result = computeFefoRisk(
      [
        { kg: 40, expiryDate: daysFromNow(5) },
        { kg: 25, expiryDate: daysFromNow(45) },
        { kg: 10, expiryDate: daysFromNow(-2) }, // sudah lewat
        { kg: 20, expiryDate: null },
      ],
      30,
      NOW,
    );
    expect(result.totalKg).toBe(95);
    expect(result.atRiskKg).toBe(50); // 40 (5hr) + 10 (lewat)
    expect(result.riskPct).toBeCloseTo(52.63, 1);
    expect(result.minDaysToExpiry).toBe(-2);
  });

  it("ignores zero-kg lots and returns null pct on empty stock", () => {
    const result = computeFefoRisk(
      [{ kg: 0, expiryDate: daysFromNow(3) }],
      30,
      NOW,
    );
    expect(result.totalKg).toBe(0);
    expect(result.riskPct).toBeNull();
    // Lot nol tetap terbaca untuk min-days? Tidak — hanya lot bermassa.
    expect(result.minDaysToExpiry).toBeNull();
  });

  it("respects a custom horizon", () => {
    const result = computeFefoRisk(
      [{ kg: 100, expiryDate: daysFromNow(14) }],
      7,
      NOW,
    );
    expect(result.atRiskKg).toBe(0);
    expect(result.riskPct).toBe(0);
  });
});

describe("computeGreenTurnover", () => {
  it("annualizes consumption against current stock", () => {
    // Bakar 90 kg / 90 hari = 1 kg/hari → 365 kg/tahun; stok 100 kg → 3.65×
    const result = computeGreenTurnover({
      consumedKgInWindow: 90,
      windowDays: 90,
      currentStockKg: 100,
    });
    expect(result.turnoverAnnualized).toBeCloseTo(3.65, 1);
    expect(result.daysOfSupply).toBe(100);
  });

  it("returns nulls when there is no consumption or no stock", () => {
    expect(computeGreenTurnover({ consumedKgInWindow: 0, windowDays: 90, currentStockKg: 100 }).turnoverAnnualized).toBeNull();
    expect(computeGreenTurnover({ consumedKgInWindow: 90, windowDays: 90, currentStockKg: 0 }).turnoverAnnualized).toBeNull();
    expect(computeGreenTurnover({ consumedKgInWindow: 90, windowDays: 90, currentStockKg: 0 }).daysOfSupply).toBe(0);
  });
});

describe("computeDaysRoastedOnHand", () => {
  it("divides RB stock by daily FG sold", () => {
    // Jual 60 kg / 30 hari = 2 kg/hari; stok RB 20 kg → 10 hari
    expect(computeDaysRoastedOnHand({ rbStockKg: 20, fgSoldKgInWindow: 60 })).toBe(10);
  });

  it("returns null when nothing is selling", () => {
    expect(computeDaysRoastedOnHand({ rbStockKg: 50, fgSoldKgInWindow: 0 })).toBeNull();
  });
});

describe("assessDaysOnHand vs industry band 7-14", () => {
  it("classifies low/healthy/high/unknown", () => {
    expect(assessDaysOnHand(4)).toBe("low");
    expect(assessDaysOnHand(10)).toBe("healthy");
    expect(assessDaysOnHand(21)).toBe("high");
    expect(assessDaysOnHand(null)).toBe("unknown");
  });
});
