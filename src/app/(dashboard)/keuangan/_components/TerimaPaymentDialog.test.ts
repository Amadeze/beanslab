import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { TerimaPaymentSummary } from "./TerimaPaymentDialog";
import type { PiutangRow } from "../actions";

function row(overrides: Partial<PiutangRow> = {}): PiutangRow {
  return {
    id: "inv-1",
    code: "INV-001",
    customerName: "Customer Test",
    customerPhone: null,
    grandTotal: 1_000_000,
    paidAmount: 400_000,
    returnedAmount: 300_000,
    balance: 300_000,
    status: "PARTIAL",
    issuedAt: "2026-08-01T00:00:00.000Z",
    dueDate: null,
    agingBucket: "CURRENT",
    itemSummary: "Kopi x1",
    ...overrides,
  };
}

describe("TerimaPaymentSummary (sisa = total − retur − dibayar)", () => {
  it("menampilkan rincian Total Nota / Retur / Terbayar / Sisa Tagihan", () => {
    const html = renderToStaticMarkup(createElement(TerimaPaymentSummary, {
      invoice: row(),
    }));

    expect(html).toContain("Total Nota");
    expect(html).toContain("Retur");
    expect(html).toContain("Terbayar");
    expect(html).toContain("Sisa Tagihan");
    expect(html).toContain("300.000");
    expect(html).not.toContain("600.000");
  });

  it("menampilkan sisa tagihan 0 saat nota diretur penuh", () => {
    const html = renderToStaticMarkup(createElement(TerimaPaymentSummary, {
      invoice: row({ grandTotal: 500_000, paidAmount: 500_000, returnedAmount: 500_000, balance: 0 }),
    }));

    expect(html).toContain("Sisa Tagihan");
    expect(html).toContain("500.000");
    expect(html).toContain("0");
  });
});