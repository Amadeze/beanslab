import { describe, expect, it } from "vitest";
import { computeSalesKpis, isDelivered } from "./sales-kpis";

function invoice(overrides: Partial<Parameters<typeof computeSalesKpis>[0][number]> = {}) {
  return {
    status: "PAID",
    fulfillmentStatus: "DELIVERED",
    deliveredAt: "2026-08-01T00:00:00.000Z",
    grandTotal: 100_000,
    returnedAmount: 0,
    ...overrides,
  };
}

describe("computeSalesKpis (basis delivered 2F.2)", () => {
  it("pendapatan = Σ grandTotal − retur hanya untuk nota diserahkan", () => {
    const kpis = computeSalesKpis([
      invoice({ grandTotal: 1_000_000, returnedAmount: 200_000 }),
      invoice({ grandTotal: 500_000 }),
    ]);
    expect(kpis.totalRevenue).toBe(1_300_000);
    expect(kpis.totalInvoices).toBe(2);
  });

  it("nota VOID tidak dihitung", () => {
    const kpis = computeSalesKpis([
      invoice({ grandTotal: 500_000 }),
      invoice({ status: "VOID", grandTotal: 900_000 }),
    ]);
    expect(kpis.totalRevenue).toBe(500_000);
    expect(kpis.totalInvoices).toBe(1);
  });

  it("nota belum diserahkan tidak dihitung sebagai pendapatan", () => {
    const kpis = computeSalesKpis([
      invoice({ grandTotal: 500_000 }),
      invoice({ fulfillmentStatus: "READY_TO_PACK", deliveredAt: null, grandTotal: 700_000 }),
    ]);
    expect(kpis.totalRevenue).toBe(500_000);
    expect(kpis.avgInvoice).toBe(250_000);
  });

  it("nota diretur penuh tidak dihitung sebagai pendapatan kotor", () => {
    const kpis = computeSalesKpis([
      invoice({ grandTotal: 500_000, returnedAmount: 500_000 }),
    ]);
    expect(kpis.totalRevenue).toBe(0);
  });

  it("isDelivered: DELIVERED atau deliveredAt terisi", () => {
    expect(isDelivered(invoice())).toBe(true);
    expect(isDelivered(invoice({ fulfillmentStatus: "READY_TO_PACK", deliveredAt: null }))).toBe(false);
    expect(isDelivered(invoice({ fulfillmentStatus: "READY_TO_PACK" }))).toBe(true);
  });
});