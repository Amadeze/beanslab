"use client";

import { useState } from "react";
import Link from "next/link";
import {
  TrendingUp,
  TrendingDown,
  WalletCards,
  Banknote,
  ArrowRight,
  ReceiptText,
  FileText,
  Scale,
  Wallet,
} from "lucide-react";
import {
  ReportLayout,
  ReportKpiCard,
  ReportChart,
  ReportFilters,
  ReportExport,
  ReportSkeleton,
  ReportError,
  useReportData,
  type DateRange,
  type KeuanganOverviewData,
} from "../../_shared";
import { KpiRibbon } from "@/components/layout/KpiCards";
import { getKeuanganOverview } from "../../actions";
import { formatRupiah } from "@/lib/format";

export default function KeuanganOverviewClient() {
  // Use local timezone for initial date (browser timezone, matches user expectation)
  const getLocalDateString = (daysOffset = 0) => {
    const d = new Date();
    d.setDate(d.getDate() + daysOffset);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };
  const [dateRange, setDateRange] = useState<DateRange>({
    start: getLocalDateString(-30),
    end: getLocalDateString(),
  });
  const { data, error, loading, retry } = useReportData(
    () => getKeuanganOverview(dateRange.start, dateRange.end),
    [dateRange.start, dateRange.end],
  );

  if (error) {
    return (
      <ReportLayout activeTab="keuangan">
        <ReportError message={error} onRetry={retry} />
      </ReportLayout>
    );
  }

  if (loading || !data) {
    return (
      <ReportLayout activeTab="keuangan">
        <ReportSkeleton />
      </ReportLayout>
    );
  }

  const dateRangeLabel = `${new Date(dateRange.start).toLocaleDateString("id-ID", { day: "numeric", month: "short" })} - ${new Date(dateRange.end).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}`;

  return (
    <ReportLayout
      activeTab="keuangan"
      actions={
        <ReportExport
          title="Keuangan Overview"
          filename="keuangan-overview"
          columns={[
            { header: "Metrik", key: "metric" },
            { header: "Nilai", key: "value" },
          ]}
          data={[
            { metric: "Total Pendapatan", value: data.totalRevenue },
            { metric: "Total Beban", value: data.totalExpenses },
            { metric: "Laba Operasional", value: data.netProfit },
            { metric: "Arus Kas", value: data.cashFlow },
          ]}
        />
      }
    >
      <div className="space-y-3">
        <ReportFilters
          dateRange={dateRange}
          onDateRangeChange={setDateRange}
        />

        {/* KPI Cards — grid 2 kolom di mobile */}
        <KpiRibbon>
          <ReportKpiCard
            label="Total Pendapatan"
            value={formatRupiah(data.totalRevenue)}
            trend={data.revenueTrend}
            icon={TrendingUp}
            color="emerald"
            help="Basis pendapatan: invoice diserahkan (deliveredAt), sudah dikurangi nilai retur."
          />
          <ReportKpiCard
            label="Total Beban"
            value={formatRupiah(data.totalExpenses)}
            trend={data.expensesTrend}
            icon={WalletCards}
            color="rose"
            inverse
            help="Total beban operasional kas periode ini (tanpa pembelian bahan)."
          />
          <ReportKpiCard
            label="Laba Operasional"
            value={formatRupiah(data.netProfit)}
            trend={data.profitTrend}
            icon={data.netProfit > 0 ? TrendingUp : TrendingDown}
            color={data.netProfit > 0 ? "emerald" : "rose"}
            help="Laba operasional = Pendapatan − Beban − Biaya Pembelian. Laporan Laba Rugi (GL) tetap memakai istilah 'Laba Bersih' dari pembukuan akuntansi."
          />
          <ReportKpiCard
            label="Arus Kas"
            value={formatRupiah(data.cashFlow)}
            trend={data.cashFlowTrend}
            icon={Banknote}
            color="blue"
            help="Arus kas = pergerakan kas aktual di buku besar (akun 1-1000), bukan Pendapatan − Beban."
          />
        </KpiRibbon>

        {/* Charts */}
        <div className="grid gap-3 lg:grid-cols-3">
          <ReportChart
            title={`Pendapatan vs Beban (${dateRangeLabel})`}
            type="area"
            data={data.revenueVsExpensesChart}
            xKey="date"
            yKeys={["revenue", "expenses"]}
            colors={["var(--instrument)", "var(--stage-roasting)"]}
            showLegend
            className="lg:col-span-2"
          />
          <ReportChart
            title="Beban per Kategori"
            type="pie"
            data={data.expenseByCategory}
            xKey="name"
            yKey="value"
          />
        </div>

        {/* Quick Links */}
        <div className="rounded-xl border border-stone-200 bg-white p-3">
          <p className="mb-2.5 text-[11px] font-bold uppercase tracking-wider text-stone-500">
            Lihat Detail
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            <Link
              href="/laporan/keuangan/sales"
              className="flex items-center justify-between rounded-lg border border-stone-200 p-3 transition-colors hover:border-[var(--instrument)] hover:bg-[var(--instrument)]/5"
            >
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-emerald-50 p-2">
                  <ReceiptText size={16} className="text-emerald-600" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-stone-900">
                    Detail Penjualan
                  </p>
                  <p className="text-[11px] text-stone-500">
                    Laporan penjualan lengkap
                  </p>
                </div>
              </div>
              <ArrowRight size={16} className="text-stone-400" />
            </Link>
            <Link
              href="/laporan/keuangan/expenses"
              className="flex items-center justify-between rounded-lg border border-stone-200 p-3 transition-colors hover:border-[var(--instrument)] hover:bg-[var(--instrument)]/5"
            >
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-rose-50 p-2">
                  <WalletCards size={16} className="text-rose-600" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-stone-900">
                    Detail Pengeluaran
                  </p>
                  <p className="text-[11px] text-stone-500">
                    Laporan pengeluaran lengkap
                  </p>
                </div>
              </div>
              <ArrowRight size={16} className="text-stone-400" />
            </Link>
            <Link
              href="/laporan/analisa/laba-rugi"
              className="flex items-center justify-between rounded-lg border border-stone-200 p-3 transition-colors hover:border-[var(--instrument)] hover:bg-[var(--instrument)]/5"
            >
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-indigo-50 p-2">
                  <FileText size={16} className="text-indigo-600" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-stone-900">
                    Laba Rugi
                  </p>
                  <p className="text-[11px] text-stone-500">
                    Pendapatan, HPP, dan beban per bulan
                  </p>
                </div>
              </div>
              <ArrowRight size={16} className="text-stone-400" />
            </Link>
            <Link
              href="/laporan/analisa/neraca"
              className="flex items-center justify-between rounded-lg border border-stone-200 p-3 transition-colors hover:border-[var(--instrument)] hover:bg-[var(--instrument)]/5"
            >
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-blue-50 p-2">
                  <Scale size={16} className="text-blue-600" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-stone-900">
                    Neraca
                  </p>
                  <p className="text-[11px] text-stone-500">
                    Posisi aset, kewajiban, dan ekuitas
                  </p>
                </div>
              </div>
              <ArrowRight size={16} className="text-stone-400" />
            </Link>
            <Link
              href="/laporan/akuntansi/arus-kas"
              className="flex items-center justify-between rounded-lg border border-stone-200 p-3 transition-colors hover:border-[var(--instrument)] hover:bg-[var(--instrument)]/5"
            >
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-teal-50 p-2">
                  <Wallet size={16} className="text-teal-600" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-stone-900">
                    Arus Kas
                  </p>
                  <p className="text-[11px] text-stone-500">
                    Pergerakan kas dari buku besar
                  </p>
                </div>
              </div>
              <ArrowRight size={16} className="text-stone-400" />
            </Link>
          </div>
        </div>
      </div>
    </ReportLayout>
  );
}
