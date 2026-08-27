/**
 * =============================================================================
 * Single source of truth untuk definisi metrik keuangan laporan (Report Center).
 *
 * Semua laporan harus memakai definisi di sini agar angka yang tampil konsisten
 * antar halaman. Tolong JANGAN menghitung "profit", "cash flow", atau "revenue"
 * secara manual di action/halaman report.
 *
 * Ringkasan definisi (fase 2F.2 — pendapatan berbasis PENYERAHAN):
 *  - REVENUE   : total invoice yang SUDAH DISERAHKAN (deliveredAt dalam periode,
 *                belum di-void), dikurangi nilai retur. Invoice ISSUED yang
 *                belum diserahkan BELUM dihitung sebagai pendapatan.
 *  - EXPENSES  : total beban operasional kas (tabel `expenses`), tanpa pembelian.
 *  - PURCHASES : biaya pembelian bahan baku (biji, kemasan) pada periode tsb.
 *  - NET PROFIT = Revenue - Expenses - Purchases.
 *  - ARUS KAS  : BUKAN revenue - expenses. Arus kas dihitung dari pergerakan
 *    nyata kas pada akun 1-1000 di buku besar (lihat src/lib/gl-cash-flow.ts).
 * =============================================================================
 */

export type RevenueBasis = "PAID" | "ALL";

/** Ringkasan takaran keuangan satu periode. */
export interface PeriodTotals {
  revenue: number; // pendapatan (basis penyerahan, setelah retur)
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
 * Menghitung pendapatan dari daftar invoice yang SUDAH DISERAHKAN.
 * Basis: `grandTotal` dikurangi `returnedAmount` (retur/refund).
 * Inilah definisi "pendapatan" yang dipakai semua laporan.
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

/**
 * Persentase perubahan antara periode berjalan vs periode sebelumnya.
 * Mengembalikan `null` bila periode sebelumnya 0 atau tidak diketahui
 * (tidak terbandingkan) — UI wajib menampilkan "—" / "Periode baru",
 * BUKAN "0.0% vs periode lalu" yang menyesatkan.
 */
export function computeTrend(current: number, previous: number): number | null {
  if (!Number.isFinite(previous) || previous <= 0) return null;
  return ((current - previous) / previous) * 100;
}

/**
 * Rata-rata nilai per nota dari himpunan yang sama dengan `revenue`
 * (himpunan pendapatan diakui: basis diserahkan, net retur). 0 bila kosong.
 */
export function computeAverageInvoice(revenue: number, count: number): number {
  return count > 0 ? revenue / count : 0;
}