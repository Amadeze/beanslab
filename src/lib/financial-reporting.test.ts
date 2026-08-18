import { describe, expect, it } from "vitest";
import { calculateSalesPerformance, weightedAverageCost } from "./financial-reporting";

describe("calculateSalesPerformance", () => {
  it("allocates header discounts and reconciles breakdowns to net sales", () => {
    const report = calculateSalesPerformance([
      {
        subtotal: 200_000,
        discount: 20_000,
        tax: 19_800,
        customerName: "Cafe Timur",
        items: [
          { productType: "FINISHED_GOODS", productName: "House Blend", quantity: 2, subtotal: 120_000, hpp: 30_000 },
          { productType: "FINISHED_GOODS", productName: "Filter", quantity: 1, subtotal: 80_000, hpp: 35_000 },
        ],
      },
    ]);

    expect(report.netSales).toBe(180_000);
    expect(report.revenueBreakdown.reduce((sum, row) => sum + row.amount, 0)).toBe(180_000);
    expect(report.cogs).toBe(95_000);
    expect(report.grossProfit).toBe(85_000);
    expect(report.tax).toBe(19_800);
    expect(report.topCustomers[0]).toMatchObject({ name: "Cafe Timur", revenue: 180_000 });
  });

  it("uses the same definitions for any reporting period", () => {
    const invoice = {
      subtotal: 100_000,
      discount: 10_000,
      tax: 0,
      customerName: "Umum",
      items: [
        { productType: "FINISHED_GOODS", productName: "Blend", quantity: 1, subtotal: 100_000, hpp: 40_000 },
      ],
    };
    expect(calculateSalesPerformance([invoice])).toEqual(calculateSalesPerformance([invoice]));
  });

  it("mengurangkan retur (returnedAmount) secara proporsional per baris", () => {
    const report = calculateSalesPerformance([
      {
        subtotal: 200_000,
        discount: 0,
        tax: 0,
        returnedAmount: 50_000,
        customerName: "Cafe Timur",
        items: [
          { productType: "FINISHED_GOODS", productName: "House Blend", quantity: 2, subtotal: 120_000, hpp: 30_000 },
          { productType: "FINISHED_GOODS", productName: "Filter", quantity: 1, subtotal: 80_000, hpp: 35_000 },
        ],
      },
    ]);

    // Net sales = 200.000 − 50.000 retur = 150.000; faktor pendapatan 0.75.
    expect(report.netSales).toBe(150_000);
    expect(report.revenueBreakdown.reduce((sum, row) => sum + row.amount, 0)).toBe(150_000);
    // COGS dinetkan faktor retur saja (0.75); diskon tidak mengubah biaya.
    expect(report.cogs).toBe(95_000 * 0.75);
    expect(report.topCustomers[0]).toMatchObject({ name: "Cafe Timur", revenue: 150_000 });
  });

  it("nota diretur penuh → net sales nol (tidak negatif)", () => {
    const report = calculateSalesPerformance([
      {
        subtotal: 100_000,
        discount: 0,
        tax: 0,
        returnedAmount: 100_000,
        customerName: "Umum",
        items: [
          { productType: "FINISHED_GOODS", productName: "Blend", quantity: 1, subtotal: 100_000, hpp: 40_000 },
        ],
      },
    ]);
    expect(report.netSales).toBe(0);
    expect(report.cogs).toBe(0);
  });
});

describe("weightedAverageCost", () => {
  it("weights cost by received or produced quantity", () => {
    expect(weightedAverageCost([
      { quantity: 10, totalCost: 1_000_000 },
      { quantity: 30, totalCost: 3_600_000 },
    ])).toBe(115_000);
  });

  it("ignores invalid zero-quantity layers", () => {
    expect(weightedAverageCost([
      { quantity: 0, totalCost: 999_999 },
      { quantity: 5, totalCost: 250_000 },
    ])).toBe(50_000);
  });
});
