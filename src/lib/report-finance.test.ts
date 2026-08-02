import { describe, expect, it } from "vitest";
import {
  computeRevenue,
  computeNetProfit,
  computeCashFlow,
  computePeriodMetrics,
  computeTrend,
  computeAverageInvoice,
} from "./report-finance";

describe("computeRevenue", () => {
  it("sums PAID invoice grandTotal minus returnedAmount", () => {
    expect(
      computeRevenue([
        { grandTotal: 1_000_000, returnedAmount: 0 },
        { grandTotal: 500_000, returnedAmount: 50_000 },
      ]),
    ).toBe(1_450_000);
  });

  it("treats null/string/bigint inputs safely", () => {
    expect(
      computeRevenue([
        { grandTotal: "100000", returnedAmount: null },
        { grandTotal: 200n, returnedAmount: "50" },
        { grandTotal: undefined, returnedAmount: undefined },
      ]),
    ).toBe(100_000 + 150);
  });

  it("returns 0 for empty list", () => {
    expect(computeRevenue([])).toBe(0);
  });
});

describe("computeNetProfit & computeCashFlow", () => {
  const totals = { revenue: 10_000_000, expenses: 3_000_000, purchases: 2_000_000 };

  it("net profit subtracts purchase plus expenses", () => {
    expect(computeNetProfit(totals)).toBe(5_000_000);
  });

  it("cash flow is revenue minus expenses only (differs from net profit)", () => {
    expect(computeCashFlow(totals)).toBe(7_000_000);
  });

  it("computePeriodMetrics returns both consistently", () => {
    expect(computePeriodMetrics(totals)).toEqual({ netProfit: 5_000_000, cashFlow: 7_000_000 });
  });
});

describe("computeTrend", () => {
  it("computes percentage growth", () => {
    expect(computeTrend(12_000_000, 10_000_000)).toBe(20);
  });

  it("returns 0 when previous is zero or unknown", () => {
    expect(computeTrend(5, 0)).toBe(0);
    expect(computeTrend(5, -5)).toBe(0);
  });
});

describe("computeAverageInvoice", () => {
  it("divides revenue by paid count", () => {
    expect(computeAverageInvoice(10_000_000, 20)).toBe(500_000);
  });

  it("returns 0 when no paid invoice", () => {
    expect(computeAverageInvoice(10_000_000, 0)).toBe(0);
  });
});