import { describe, expect, it } from "vitest";
import {
  computeCoffeeFlowSales,
  isRecognizedInvoice,
  resolveInvoiceRevenueFactor,
  resolveInvoiceCogsFactor,
} from "./coffee-flow";

function invoiceMeta(overrides: Partial<Parameters<typeof isRecognizedInvoice>[0]> = {}) {
  return {
    deliveredAt: new Date("2026-08-01T03:00:00.000Z"),
    status: "PAID",
    voidAt: null,
    subtotal: 200_000,
    grandTotal: 200_000,
    returnedAmount: 0,
    ...overrides,
  };
}

function item(overrides: Partial<Parameters<typeof computeCoffeeFlowSales>[0][number]> = {}) {
  return {
    quantity: 2,
    subtotal: 120_000,
    hpp: 30_000,
    invoice: invoiceMeta(),
    ...overrides,
  };
}

describe("isRecognizedInvoice", () => {
  it("hanya nota diserahkan dan tidak void yang dihitung", () => {
    expect(isRecognizedInvoice(invoiceMeta())).toBe(true);
    expect(isRecognizedInvoice(invoiceMeta({ deliveredAt: null }))).toBe(false);
    expect(isRecognizedInvoice(invoiceMeta({ status: "VOID" }))).toBe(false);
    expect(isRecognizedInvoice(invoiceMeta({ voidAt: new Date() }))).toBe(false);
  });
});

describe("resolveInvoiceRevenueFactor / CogsFactor", () => {
  it("faktor pendapatan = net (grandTotal − retur) / subtotal", () => {
    expect(resolveInvoiceRevenueFactor(invoiceMeta())).toBe(1);
    // grandTotal sudah net diskon; retur mengurangi sisa.
    expect(resolveInvoiceRevenueFactor(invoiceMeta({ grandTotal: 180_000, returnedAmount: 50_000 }))).toBe(0.65);
    expect(resolveInvoiceRevenueFactor(invoiceMeta({ subtotal: 0 }))).toBe(0);
  });

  it("faktor COGS hanya dipengaruhi retur, bukan diskon", () => {
    // Diskon 20k di header tidak mengubah biaya.
    expect(resolveInvoiceCogsFactor(invoiceMeta({ grandTotal: 180_000 }))).toBe(1);
    // Retur 50k: biaya ikut turun proporsional.
    expect(resolveInvoiceCogsFactor(invoiceMeta({ returnedAmount: 50_000 }))).toBe(150_000 / 200_000);
  });
});

describe("computeCoffeeFlowSales", () => {
  it("menghitung revenue dari subtotal baris × faktor pendapatan", () => {
    const { revenue } = computeCoffeeFlowSales([
      item({ subtotal: 120_000, hpp: 30_000, quantity: 2 }),
      item({ subtotal: 80_000, hpp: 35_000, quantity: 1, invoice: invoiceMeta({ returnedAmount: 50_000 }) }),
    ]);
    // Nota 1: 120.000 × 1.0 ; Nota 2: 80.000 × (200.000−50.000)/200.000 = 60.000
    expect(revenue).toBe(180_000);
  });

  it("COGS memakai snapshot InvoiceItem.hpp historis, bukan biaya resep saat ini", () => {
    const { cogs } = computeCoffeeFlowSales([
      item({ hpp: 30_000, quantity: 2 }),
      item({ hpp: 35_000, quantity: 1 }),
    ]);
    expect(cogs).toBe(95_000);
  });

  it("COGS hanya bergantung pada snapshot item.hpp — tidak ada input biaya resep saat ini", () => {
    // Fungsi tidak menerima parameter "biaya resep saat ini" sama sekali:
    // margin historis hanya dibentuk snapshot InvoiceItem.hpp per transaksi.
    const snapshot = item({ hpp: 30_000, quantity: 2 });
    expect(computeCoffeeFlowSales([snapshot])).toEqual(computeCoffeeFlowSales([snapshot]));
    expect(computeCoffeeFlowSales([snapshot]).cogs).toBe(60_000);
  });

  it("retur parsial mengurangi pendapatan DAN COGS secara proporsional", () => {
    const { revenue, cogs } = computeCoffeeFlowSales([
      item({ subtotal: 120_000, hpp: 30_000, quantity: 2, invoice: invoiceMeta({ returnedAmount: 50_000 }) }),
    ]);
    expect(revenue).toBe(120_000 * (150_000 / 200_000));
    expect(cogs).toBe(60_000 * (150_000 / 200_000));
  });

  it("nota diretur penuh → revenue & COGS nol (net sales nol)", () => {
    const { revenue, cogs } = computeCoffeeFlowSales([
      item({ invoice: invoiceMeta({ returnedAmount: 200_000 }) }),
    ]);
    expect(revenue).toBe(0);
    expect(cogs).toBe(0);
  });

  it("nota belum diserahkan diabaikan", () => {
    const { revenue, cogs } = computeCoffeeFlowSales([
      item({ invoice: invoiceMeta({ deliveredAt: null }) }),
    ]);
    expect(revenue).toBe(0);
    expect(cogs).toBe(0);
  });

  it("nota void diabaikan", () => {
    const { revenue } = computeCoffeeFlowSales([
      item({ invoice: invoiceMeta({ status: "VOID" }) }),
    ]);
    expect(revenue).toBe(0);
  });
});
