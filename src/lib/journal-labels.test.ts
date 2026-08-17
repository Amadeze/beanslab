import { describe, expect, it } from "vitest";
import {
  journalRefTypeLabel,
  journalSourceHref,
  JOURNAL_REF_TYPE_LABELS,
} from "./journal-labels";

describe("journalRefTypeLabel", () => {
  it("menerjemahkan refType ke Bahasa", () => {
    expect(journalRefTypeLabel("INVOICE")).toBe("Nota Penjualan");
    expect(journalRefTypeLabel("PAYMENT")).toBe("Pembayaran Pelanggan");
    expect(journalRefTypeLabel("PURCHASE")).toBe("Pembelian");
    expect(journalRefTypeLabel("SUPPLIER_PAYMENT")).toBe("Pembayaran Supplier");
    expect(journalRefTypeLabel("EXPENSE")).toBe("Pengeluaran");
    expect(journalRefTypeLabel("CAPITAL")).toBe("Modal / Prive");
    expect(journalRefTypeLabel("CREDIT_NOTE")).toBe("Retur / Nota Kredit");
    expect(journalRefTypeLabel("VOID_REVERSAL")).toBe("Pembatalan / Reversal");
    expect(journalRefTypeLabel("ADJUSTMENT")).toBe("Penyesuaian Stok");
    expect(journalRefTypeLabel("ROASTING")).toBe("Roasting");
    expect(journalRefTypeLabel("PRODUCTION")).toBe("Produksi");
    expect(journalRefTypeLabel("GRINDING")).toBe("Grinding");
    expect(journalRefTypeLabel("EXPERIMENTAL")).toBe("Eksperimen");
    expect(journalRefTypeLabel("SAMPLE")).toBe("Sample / Promosi");
  });

  it("null dan refType tak dikenal tidak crash", () => {
    expect(journalRefTypeLabel(null)).toBeNull();
    expect(journalRefTypeLabel("UNKNOWN_TYPE")).toBe("UNKNOWN_TYPE");
  });
});

describe("journalSourceHref", () => {
  it("menyediakan link hanya untuk rute workspace yang stabil", () => {
    expect(journalSourceHref("INVOICE")).toBe("/penjualan");
    expect(journalSourceHref("PAYMENT")).toBe("/keuangan?tab=pembayaran");
    expect(journalSourceHref("PURCHASE")).toBe("/keuangan?tab=pembelian");
    expect(journalSourceHref("SUPPLIER_PAYMENT")).toBe("/keuangan?tab=pembayaranSupplier");
    expect(journalSourceHref("EXPENSE")).toBe("/keuangan?tab=pengeluaran");
    expect(journalSourceHref("CAPITAL")).toBe("/keuangan?tab=modal");
    expect(journalSourceHref("CREDIT_NOTE")).toBe("/penjualan");
  });

  it("tidak membuat link untuk refType tanpa rute detail yang stabil", () => {
    expect(journalSourceHref("VOID_REVERSAL")).toBeNull();
    expect(journalSourceHref("ROASTING")).toBeNull();
    expect(journalSourceHref("PRODUCTION")).toBeNull();
    expect(journalSourceHref("GRINDING")).toBeNull();
    expect(journalSourceHref("EXPERIMENTAL")).toBeNull();
    expect(journalSourceHref("SAMPLE")).toBeNull();
    expect(journalSourceHref("ADJUSTMENT")).toBeNull();
    expect(journalSourceHref(null)).toBeNull();
  });
});

describe("JOURNAL_REF_TYPE_LABELS", () => {
  it("mencakup seluruh refType yang dipakai sistem", () => {
    expect(JOURNAL_REF_TYPE_LABELS.INVOICE).toBeDefined();
    expect(JOURNAL_REF_TYPE_LABELS.PAYMENT).toBeDefined();
    expect(JOURNAL_REF_TYPE_LABELS.PURCHASE).toBeDefined();
    expect(JOURNAL_REF_TYPE_LABELS.SUPPLIER_PAYMENT).toBeDefined();
    expect(JOURNAL_REF_TYPE_LABELS.EXPENSE).toBeDefined();
    expect(JOURNAL_REF_TYPE_LABELS.CAPITAL).toBeDefined();
    expect(JOURNAL_REF_TYPE_LABELS.CREDIT_NOTE).toBeDefined();
    expect(JOURNAL_REF_TYPE_LABELS.VOID_REVERSAL).toBeDefined();
    expect(JOURNAL_REF_TYPE_LABELS.ADJUSTMENT).toBeDefined();
    expect(JOURNAL_REF_TYPE_LABELS.ROASTING).toBeDefined();
    expect(JOURNAL_REF_TYPE_LABELS.PRODUCTION).toBeDefined();
    expect(JOURNAL_REF_TYPE_LABELS.GRINDING).toBeDefined();
    expect(JOURNAL_REF_TYPE_LABELS.EXPERIMENTAL).toBeDefined();
    expect(JOURNAL_REF_TYPE_LABELS.SAMPLE).toBeDefined();
  });
});