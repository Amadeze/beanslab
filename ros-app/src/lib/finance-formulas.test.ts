import { describe, expect, it } from "vitest";
import { computeReceivable, computePayable } from "./finance-formulas";

describe("computeReceivable (AR kanonik 2F.2)", () => {
  it("sisa = grand − paid − returned", () => {
    expect(computeReceivable(1_000_000, 400_000, 300_000)).toBe(300_000);
  });

  it("nota diretur penuh → tidak ada yang dapat ditagih (0)", () => {
    expect(computeReceivable(500_000, 500_000, 500_000)).toBe(0);
  });

  it("retur melebihi tagihan tidak menghasilkan piutang negatif", () => {
    expect(computeReceivable(100_000, 0, 150_000)).toBe(0);
  });

  it("pembulatan dua desimal", () => {
    expect(computeReceivable(10_000, 3_333.333, 3_333.334)).toBe(3333.33);
  });
});

describe("computePayable (AP kanonik)", () => {
  it("hutang = totalCost − paid", () => {
    expect(computePayable(2_000_000, 500_000)).toBe(1_500_000);
  });

  it("tidak pernah negatif", () => {
    expect(computePayable(100_000, 250_000)).toBe(0);
  });
});