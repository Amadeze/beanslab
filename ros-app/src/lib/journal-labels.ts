/**
 * Pemetaan refType jurnal → label Bahasa untuk UI (2F.3).
 * Internal refType enum tetap dipakai di data model; hanya tampilan yang
 * menerjemahkan. URL sumber hanya dibuat untuk rute workspace yang stabil —
 * tidak ada rute detail per-entitas, jadi link mengarah ke daftar terkait.
 */

export const JOURNAL_REF_TYPE_LABELS: Record<string, string> = {
  INVOICE: "Nota Penjualan",
  PAYMENT: "Pembayaran Pelanggan",
  PURCHASE: "Pembelian",
  SUPPLIER_PAYMENT: "Pembayaran Supplier",
  EXPENSE: "Pengeluaran",
  CAPITAL: "Modal / Prive",
  CREDIT_NOTE: "Retur / Nota Kredit",
  VOID_REVERSAL: "Pembatalan / Reversal",
  ADJUSTMENT: "Penyesuaian Stok",
  ROASTING: "Roasting",
  PRODUCTION: "Produksi",
  GRINDING: "Grinding",
  EXPERIMENTAL: "Eksperimen",
  SAMPLE: "Sample / Promosi",
  SAMPLE_USAGE: "Sample / Promosi",
};

export function journalRefTypeLabel(refType: string | null): string | null {
  if (!refType) return null;
  return JOURNAL_REF_TYPE_LABELS[refType] ?? refType;
}

const SOURCE_HREFS: Record<string, string> = {
  INVOICE: "/penjualan",
  PAYMENT: "/keuangan?tab=pembayaran",
  PURCHASE: "/keuangan?tab=pembelian",
  SUPPLIER_PAYMENT: "/keuangan?tab=pembayaranSupplier",
  EXPENSE: "/keuangan?tab=pengeluaran",
  CAPITAL: "/keuangan?tab=modal",
  CREDIT_NOTE: "/penjualan",
};

/**
 * Rute workspace yang stabil untuk "Lihat transaksi".
 * RefType tanpa rute detail yang stabil mengembalikan null (jangan membuat
 * tautan rusak).
 */
export function journalSourceHref(refType: string | null): string | null {
  if (!refType) return null;
  if (refType === "VOID_REVERSAL") return null;
  return SOURCE_HREFS[refType] ?? null;
}