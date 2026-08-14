import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { InvoiceTable } from "./InvoiceTable";
import type { InvoiceRow } from "../actions";

function invoice(overrides: Partial<InvoiceRow>): InvoiceRow {
  return {
    id: "invoice-1",
    code: "INV-001",
    customerName: "Customer Test",
    itemCount: 1,
    grandTotal: 50000,
    paidAmount: 0,
    balance: 50000,
    status: "ISSUED",
    salesChannel: "WHATSAPP",
    fulfillmentStatus: "AWAITING_PAYMENT",
    issuedAt: "2026-08-14T00:00:00.000Z",
    dueDate: null,
    shippingMethod: null,
    shippingAddress: null,
    courierName: null,
    trackingNumber: null,
    shippingCost: 0,
    ...overrides,
  };
}

describe("InvoiceTable fulfillment actions", () => {
  it("offers fulfillment for a ready manual B2B order but not an unpaid waiting order", () => {
    const html = renderToStaticMarkup(createElement(InvoiceTable, {
      invoices: [
        invoice({
          id: "b2b-ready",
          code: "INV-B2B-READY",
          salesChannel: "B2B_DIRECT",
          fulfillmentStatus: "READY_TO_PACK",
        }),
        invoice({
          id: "waiting",
          code: "INV-WAITING",
          fulfillmentStatus: "AWAITING_PAYMENT",
        }),
      ],
    }));

    expect(html).toContain('aria-label="Fulfillment INV-B2B-READY"');
    expect(html).not.toContain('aria-label="Fulfillment INV-WAITING"');
    expect(html).toContain("Siap dikemas");
    expect(html).toContain("Menunggu bayar");
  });

  it("offers returns only after physical delivery", () => {
    const html = renderToStaticMarkup(createElement(InvoiceTable, {
      invoices: [
        invoice({
          id: "delivered",
          code: "INV-DELIVERED",
          status: "PAID",
          fulfillmentStatus: "DELIVERED",
        }),
        invoice({
          id: "ready",
          code: "INV-READY",
          status: "PAID",
          fulfillmentStatus: "READY_TO_PACK",
        }),
        invoice({
          id: "waiting",
          code: "INV-WAITING-RETURN",
          fulfillmentStatus: "AWAITING_PAYMENT",
        }),
      ],
    }));

    expect(html).toContain('aria-label="Retur INV-DELIVERED"');
    expect(html).not.toContain('aria-label="Retur INV-READY"');
    expect(html).not.toContain('aria-label="Retur INV-WAITING-RETURN"');
  });
});
