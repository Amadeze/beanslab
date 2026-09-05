import { describe, expect, it } from "vitest";
import { renderPrintableInvoice, type PrintableInvoice } from "./print-templates";

const SAMPLE_INVOICE: PrintableInvoice = {
  code: "INV-2026-0001",
  date: new Date("2026-09-03T08:30:00Z"),
  customerName: "Kopi Senja",
  sellerName: "Beanslab Roastery",
  sellerAddress: "Jl. Sudirman 1, Jakarta",
  sellerPhone: "+62 21 555 0001",
  items: [
    { name: "Ethiopia Hambela 250g", quantity: 2, unit: "pack", unitPrice: 110_000, total: 220_000 },
    { name: "Espresso Blend 1kg", quantity: 1, unit: "pack", unitPrice: 240_000, total: 240_000 },
  ],
  subtotal: 460_000,
  tax: 0,
  grandTotal: 460_000,
  notes: "Terima kasih!",
  paymentMethod: "QRIS",
  cashierName: "Ani",
};

describe("renderPrintableInvoice", () => {
  it("produces a self-contained HTML doc for 58mm thermal", () => {
    const html = renderPrintableInvoice(SAMPLE_INVOICE, "thermal-58");
    expect(html).toContain("<!doctype html>");
    expect(html).toContain("58mm");
    expect(html).toContain("INV-2026-0001");
    expect(html).toContain("Ethiopia Hambela 250g");
    expect(html.replace(/\u00A0/g, " ")).toContain("Rp 460.000");
  });

  it("produces a self-contained HTML doc for 80mm thermal", () => {
    const html = renderPrintableInvoice(SAMPLE_INVOICE, "thermal-80");
    expect(html).toContain("80mm");
    expect(html).toContain("Item");
    expect(html.replace(/\u00A0/g, " ")).toContain("Rp 460.000");
  });

  it("produces an A4 invoice doc with the full address block", () => {
    const html = renderPrintableInvoice(SAMPLE_INVOICE, "a4-invoice");
    expect(html).toContain("A4");
    expect(html).toContain("Jl. Sudirman 1, Jakarta");
    expect(html).toContain("Catatan");
  });

  it("escapes HTML in user-supplied fields", () => {
    const evil: PrintableInvoice = {
      ...SAMPLE_INVOICE,
      customerName: "<script>alert(1)</script>",
      notes: "tom & jerry < 100",
    };
    const html = renderPrintableInvoice(evil, "thermal-58");
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(html).toContain("tom &amp; jerry &lt; 100");
  });

  it("omits the tax row when tax is zero", () => {
    const html = renderPrintableInvoice(SAMPLE_INVOICE, "thermal-80");
    expect(html).not.toContain("Pajak");
  });
});