import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SupplierPaymentTable } from "./SupplierPaymentTable";
import type { SupplierPaymentRow } from "../actions";

function payment(overrides: Partial<SupplierPaymentRow>): SupplierPaymentRow {
  return {
    id: "sp-1",
    code: "SPAY-202608-ABC1",
    purchaseCode: "PO-001",
    supplierName: "Supplier Test",
    amount: 500_000,
    method: "TRANSFER",
    paidAt: "2026-08-10T00:00:00.000Z",
    reference: null,
    isEmbedded: false,
    notes: null,
    voidedAt: null,
    voidReason: null,
    voidedByName: null,
    ...overrides,
  };
}

describe("SupplierPaymentTable (pembayaran awal embedded)", () => {
  it("pembayaran awal (operationKey null) tidak punya tombol Void dan diberi label", () => {
    const html = renderToStaticMarkup(createElement(SupplierPaymentTable, {
      rows: [payment({ id: "embedded", code: "SPAY-EMBED", isEmbedded: true })],
      onVoid: () => {},
    }));

    expect(html).toContain("Pembayaran Awal");
    expect(html).not.toContain('aria-label="Void SPAY-EMBED"');
    expect(html).toContain("koreksi melalui void pembelian terkait");
  });

  it("pembayaran berikutnya (independen) tetap punya tombol Void", () => {
    const html = renderToStaticMarkup(createElement(SupplierPaymentTable, {
      rows: [payment({ id: "independent", code: "SPAY-IND", isEmbedded: false })],
      onVoid: () => {},
    }));

    expect(html).toContain('aria-label="Void SPAY-IND"');
    expect(html).not.toContain("Pembayaran Awal");
  });

  it("baris dibatalkan menampilkan alasan dan tidak dapat di-void lagi", () => {
    const html = renderToStaticMarkup(createElement(SupplierPaymentTable, {
      rows: [
        payment({
          id: "voided",
          code: "SPAY-VOIDED",
          voidedAt: "2026-08-12T00:00:00.000Z",
          voidReason: "Salah nominal",
          voidedByName: "Budi",
        }),
      ],
      onVoid: () => {},
    }));

    expect(html).toContain("Dibatalkan");
    expect(html).toContain("Salah nominal");
    expect(html).toContain("oleh Budi");
    expect(html).not.toContain('aria-label="Void SPAY-VOIDED"');
  });
});