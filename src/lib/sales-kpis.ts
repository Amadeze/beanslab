/**
 * KPI Penjualan (2F.3) — basis pendapatan terkunci 2F.2:
 * - pengakuan pendapatan = DELIVERED (barang diserahkan)
 * - exclude VOID
 * - kurangi retur / CreditNote (returnedAmount)
 * - invoice RETURNED penuh tidak dihitung sebagai pendapatan kotor
 *
 * Angka ini adalah KPI operasional penjualan; P&L tetap basis GL (jangan
 * mengganti P&L dengan matematika operasional).
 */

export interface SalesKpiInvoice {
  status: string;
  fulfillmentStatus: string;
  deliveredAt: string | null;
  grandTotal: number;
  returnedAmount: number;
}

export interface SalesKpis {
  /** Pendapatan (basis diserahkan, net retur) untuk nota yang tidak di-void. */
  totalRevenue: number;
  paidCount: number;
  unpaidCount: number;
  totalInvoices: number;
  /** Rata-rata per nota dari himpunan yang sama dengan totalRevenue (hanya nota diserahkan). */
  avgInvoice: number;
}

export function isDelivered(invoice: SalesKpiInvoice): boolean {
  return invoice.fulfillmentStatus === "DELIVERED" || invoice.deliveredAt !== null;
}

export function computeSalesKpis(invoices: SalesKpiInvoice[]): SalesKpis {
  const valid = invoices.filter((i) => i.status !== "VOID");
  const recognized = valid.filter(isDelivered);

  const totalRevenue = recognized.reduce(
    (sum, i) => sum + i.grandTotal - i.returnedAmount,
    0,
  );
  const paidCount = valid.filter((i) => i.status === "PAID").length;
  const unpaidCount = valid.filter(
    (i) => i.status === "ISSUED" || i.status === "PARTIAL",
  ).length;
  const totalInvoices = valid.length;
  const avgInvoice =
    recognized.length > 0 ? Math.round(totalRevenue / recognized.length) : 0;

  return { totalRevenue, paidCount, unpaidCount, totalInvoices, avgInvoice };
}