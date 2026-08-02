/**
 * =============================================================================
 * Single source of truth untuk definisi metrik keuangan laporan (Report Center).
 *
 * Semua laporan harus memakai definisi di sini agar angka yang tampil konsisten
 * antar halaman. Tolong JANGAN menghitung "profit", "cash flow", atau "revenue"
 * secara manual di action/halaman report.
 *
 * Ringkasan definisi (basis KAS / operasional harian roastery):
 *  - REVENUE   : total invoice berstatus PAID, sudah dikurangi nilai retur.
 *                (invoice ISSUED/PARTIAL BELUM dihitung sebagai pendapatan).
 *  - EXPENSES  : total beban operasional kas (tabel `expenses`), tanpa pembelian.
 *  - PURCHASES : biaya pembelian bahan baku (biji, kemasan) pada periode tsb.
 *  - NET PROFIT = Revenue - Expenses - Purchases.
 *  - CASH FLOW  = Revenue - Expenses (kas masuk dari penjualan vs kas keluar
 *    operasional; belum termasuk pos pembelanjaan yang bukan kas keluar saat ini).
 * =============================================================================
 */

export type RevenueBasis = "PAID" | "ALL";

/** Ringkasan takaran keuangan satu periode. */
export interface PeriodTotals {
  revenue: number; // pendapatan (basis PAID, setelah retur)
  expenses: number; // beban operasional kas
  purchases: number; // biaya pembelian bahan
  paidCount: number; // jumlah invoice lunas (untuk rata-rata nota)
}

export interface InvoiceRevenueInput {
  grandTotal?: unknown;
  returnedAmount?: unknown;
}

export interface InputTotals {
  revenue: number;
  expenses: number;
  purchases: number;
}

const toNumber = (value?: unknown): number => {
  if (value == null) return 0;
  let n: number;
  try {
    n = typeof value === "number" ? value : Number(String(value));
  } catch {
    return 0;
  }
  return Number.isFinite(n) ? n : 0;
};

/**
 * Menghitung pendapatan dari daftar invoice PAID.
 * Basis: `grandTotal` dikurangi `returnedAmount` (retur/refund).
 * Inilah SATU-SATUNYA definisi "pendapatan" yang dipakai semua laporan.
 */
export function computeRevenue(invoices: InvoiceRevenueInput[]): number {
  return invoices.reduce(
    (sum, inv) => sum + toNumber(inv.grandTotal) - toNumber(inv.returnedAmount),
    0,
  );
}

/** Net Profit = Revenue - Expenses - Purchases. */
export function computeNetProfit(totals: InputTotals): number {
  return totals.revenue - totals.expenses - totals.purchases;
}

/** Cash Flow = Revenue - Expenses. Beda dengan Net Profit (belum dikurangi pembelian). */
export function computeCashFlow(totals: InputTotals): number {
  return totals.revenue - totals.expenses;
}

/** Merge range metrics sekaligus (profit + cash flow) dari satu input. */
export function computePeriodMetrics(totals: InputTotals): {
  netProfit: number;
  cashFlow: number;
} {
  return {
    netProfit: computeNetProfit(totals),
    cashFlow: computeCashFlow(totals),
  };
}

/**
 * Persentase perubahan antara periode berjalan vs periode sebelumnya.
 * Mengembalikan 0 bila periode sebelumnya 0 atau tidak diketahui (avoid division by zero).
 */
export function computeTrend(current: number, previous: number): number {
  if (!Number.isFinite(previous) || previous <= 0) return 0;
  return ((current - previous) / previous) * 100;
}

/** Rata-rata nilai per nota lunas. 0 bila belum ada invoice lunas. */
export function computeAverageInvoice(revenue: number, paidCount: number): number {
  return paidCount > 0 ? revenue / paidCount : 0;
}