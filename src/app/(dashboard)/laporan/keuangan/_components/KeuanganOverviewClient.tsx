"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  TrendingUp,
  TrendingDown,
  WalletCards,
  Banknote,
  ArrowRight,
  ReceiptText,
} from "lucide-react";
import {
  ReportLayout,
  ReportKpiCard,
  ReportChart,
  ReportFilters,
  ReportExport,
  type DateRange,
  type KeuanganOverviewData,
} from "../../_shared";
import { getKeuanganOverview } from "../../actions";
import { formatRupiah } from "@/lib/format";

export default function KeuanganOverviewClient() {
  const [dateRange, setDateRange] = useState<DateRange>({
    start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0],
    end: new Date().toISOString().split("T")[0],
  });
  const [data, setData] = useState<KeuanganOverviewData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      try {
        const result = await getKeuanganOverview(
          dateRange.start,
          dateRange.end,
        );
        setData(result);
      } catch (error) {
        console.error("Failed to fetch keuangan overview:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [dateRange]);

  if (loading || !data) {
    return (
      <ReportLayout activeTab="keuangan">
        <div className="flex items-center justify-center py-20">
          <div className="text-sm text-stone-500">Memuat data...</div>
        </div>
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
            { metric: "Total Revenue", value: data.totalRevenue },
            { metric: "Total Expenses", value: data.totalExpenses },
            { metric: "Net Profit", value: data.netProfit },
            { metric: "Cash Flow", value: data.cashFlow },
          ]}
        />
      }
    >
      <div className="space-y-6">
        <ReportFilters
          dateRange={dateRange}
          onDateRangeChange={setDateRange}
        />

        {/* KPI Cards */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <ReportKpiCard
            label="Total Revenue"
            value={formatRupiah(data.totalRevenue)}
            trend={data.revenueTrend}
            icon={TrendingUp}
            color="emerald"
          />
          <ReportKpiCard
            label="Total Expenses"
            value={formatRupiah(data.totalExpenses)}
            trend={data.expensesTrend}
            icon={WalletCards}
            color="rose"
            inverse
          />
          <ReportKpiCard
            label="Net Profit"
            value={formatRupiah(data.netProfit)}
            trend={data.profitTrend}
            icon={data.netProfit > 0 ? TrendingUp : TrendingDown}
            color={data.netProfit > 0 ? "emerald" : "rose"}
          />
          <ReportKpiCard
            label="Cash Flow"
            value={formatRupiah(data.cashFlow)}
            trend={data.cashFlowTrend}
            icon={Banknote}
            color="blue"
          />
        </div>

        {/* Charts */}
        <div className="grid gap-4 lg:grid-cols-3">
          <ReportChart
            title={`Revenue vs Expenses (${dateRangeLabel})`}
            type="area"
            data={data.revenueVsExpensesChart}
            xKey="date"
            yKeys={["revenue", "expenses"]}
            colors={["#00C8DF", "#B65331"]}
            showLegend
            className="lg:col-span-2"
          />
          <ReportChart
            title="Expense by Category"
            type="pie"
            data={data.expenseByCategory}
            xKey="name"
            yKey="value"
          />
        </div>

        {/* Quick Links */}
        <div className="rounded-xl border border-stone-200 bg-white p-4">
          <p className="mb-4 text-xs font-bold uppercase tracking-wider text-stone-500">
            Lihat Detail
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Link
              href="/laporan/sales"
              className="flex items-center justify-between rounded-lg border border-stone-200 p-3 transition-colors hover:border-[#00C8DF] hover:bg-[#00C8DF]/5"
            >
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-emerald-50 p-2">
                  <ReceiptText size={16} className="text-emerald-600" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-stone-900">
                    Sales Detail
                  </p>
                  <p className="text-[11px] text-stone-500">
                    Laporan penjualan lengkap
                  </p>
                </div>
              </div>
              <ArrowRight size={16} className="text-stone-400" />
            </Link>
            <Link
              href="/laporan/expense"
              className="flex items-center justify-between rounded-lg border border-stone-200 p-3 transition-colors hover:border-[#00C8DF] hover:bg-[#00C8DF]/5"
            >
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-rose-50 p-2">
                  <WalletCards size={16} className="text-rose-600" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-stone-900">
                    Expenses Detail
                  </p>
                  <p className="text-[11px] text-stone-500">
                    Laporan pengeluaran lengkap
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
