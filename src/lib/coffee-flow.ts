/**
 * Helper murni laporan Arus Kopi (Coffee Flow) — 2G.
 *
 * Kebijakan kanonik (2F.2):
 * - pendapatan diakui saat DISERAHKAN (deliveredAt), exclude VOID
 * - pendapatan = nilai nota bersih retur (grandTotal − returnedAmount),
 *   dialokasikan proporsional ke baris via faktor neto
 * - COGS HISTORIS memakai snapshot InvoiceItem.hpp — BUKAN biaya resep saat ini
 */

export type CoffeeFlowInvoiceMeta = {
  deliveredAt: Date | string | null;
  status: string;
  voidAt: Date | string | null;
  subtotal: number;
  grandTotal: number;
  returnedAmount: number;
};

export type CoffeeFlowItem = {
  quantity: number;
  subtotal: number;
  /** Snapshot HPP per unit saat transaksi (historis). */
  hpp: number;
  invoice: CoffeeFlowInvoiceMeta;
};

export type CoffeeFlowSales = {
  revenue: number;
  cogs: number;
};

/**
 * Faktor pendapatan satu nota: proporsi nilai nota yang benar-benar menjadi
 * pendapatan setelah diskon header & retur. Basis: subtotal baris.
 * Faktor dipakai untuk mengalokasikan retur secara proporsional agar
 * margin historis tidak memakai biaya resep saat ini.
 */
export function resolveInvoiceRevenueFactor(invoice: CoffeeFlowInvoiceMeta): number {
  const subtotal = Math.max(0, invoice.subtotal);
  if (subtotal <= 0) return 0;
  return Math.max(0, Math.max(0, invoice.grandTotal) - Math.max(0, invoice.returnedAmount)) / subtotal;
}

/**
 * Faktor COGS satu nota: hanya retur mengurangi biaya (barang kembali ke
 * stok); diskon TIDAK mengubah biaya.
 */
export function resolveInvoiceCogsFactor(invoice: CoffeeFlowInvoiceMeta): number {
  const subtotal = Math.max(0, invoice.subtotal);
  if (subtotal <= 0) return 0;
  return Math.max(0, subtotal - Math.max(0, invoice.returnedAmount)) / subtotal;
}

/** Nota dihitung hanya bila sudah diserahkan dan tidak di-void. */
export function isRecognizedInvoice(invoice: CoffeeFlowInvoiceMeta): boolean {
  if (invoice.deliveredAt == null) return false;
  if (invoice.status === "VOID" || invoice.voidAt != null) return false;
  return true;
}

/**
 * Menghitung pendapatan & COGS historis dari baris invoice yang sudah
 * diserahkan (pemanggil sudah menyaring periode).
 * - Revenue = Σ subtotal baris × faktor pendapatan nota
 * - COGS    = Σ hpp(historis) × qty × faktor retur nota
 * Nota direktur penuh → faktor 0 → tidak berkontribusi (net sales nol).
 */
export function computeCoffeeFlowSales(items: CoffeeFlowItem[]): CoffeeFlowSales {
  let revenue = 0;
  let cogs = 0;
  for (const item of items) {
    if (!isRecognizedInvoice(item.invoice)) continue;
    revenue += Math.max(0, item.subtotal) * resolveInvoiceRevenueFactor(item.invoice);
    cogs += Math.max(0, item.hpp) * Math.max(0, item.quantity) * resolveInvoiceCogsFactor(item.invoice);
  }
  return { revenue, cogs };
}
