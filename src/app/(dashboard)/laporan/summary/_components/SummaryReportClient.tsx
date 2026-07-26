"use client";

import { useState, useEffect } from "react";
import {
  TrendingUp,
  TrendingDown,
  Package,
  WalletCards,
} from "lucide-react";
import {
  ReportLayout,
  ReportKpiCard,
  ReportChart,
  ReportFilters,
  ReportExport,
  ReportSkeleton,
  type DateRange,
  type SummaryReportData,
} from "../../_shared";
import { getSummaryReport } from "../../actions";
import { formatRupiah } from "@/lib/format";

export default function SummaryReportClient() {
  const [dateRange, setDateRange] = useState<DateRange>({
    start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
    end: new Date().toISOString().split("T")[0],
  });
  const [data, setData] = useState<SummaryReportData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      try {
        const result = await getSummaryReport(dateRange.start, dateRange.end);
        setData(result);
      } catch (error) {
        console.error("Failed to fetch summary report:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [dateRange]);

  if (loading || !data) {
    return (
      <ReportLayout activeTab="summary">
        <ReportSkeleton />
      </ReportLayout>
    );
  }

  // Calculate date range label
  const dateRangeLabel = `${new Date(dateRange.start).toLocaleDateString("id-ID", { day: "numeric", month: "short" })} - ${new Date(dateRange.end).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}`;

  return (
    <ReportLayout
      activeTab="summary"
      actions={
        <ReportExport
          title="Summary Report"
          filename="summary-report"
          columns={[
            { header: "Metrik", key: "metric" },
            { header: "Nilai", key: "value" },
          ]}
          data={[
            { metric: "Revenue", value: data.revenue },
            { metric: "Expenses", value: data.expenses },
            { metric: "Profit", value: data.profit },
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
            label="Revenue"
            value={formatRupiah(data.revenue)}
            trend={data.revenueTrend}
            icon={TrendingUp}
            color="emerald"
          />
          <ReportKpiCard
            label="Expenses"
            value={formatRupiah(data.expenses)}
            trend={data.expensesTrend}
            icon={WalletCards}
            color="rose"
          />
          <ReportKpiCard
            label="Profit"
            value={formatRupiah(data.profit)}
            trend={data.profitTrend}
            icon={data.profit > 0 ? TrendingUp : TrendingDown}
            color="blue"
          />
          <ReportKpiCard
            label="Stock Value"
            value={formatRupiah(data.stockValue)}
            icon={Package}
            color="amber"
          />
        </div>

        {/* Charts */}
        <div className="grid gap-4 lg:grid-cols-2">
          <ReportChart
            title={`Revenue Trend (${dateRangeLabel})`}
            type="area"
            data={data.revenueChart}
            xKey="date"
            yKey="value"
          />
        </div>

        {/* Pipeline Status */}
        <div className="rounded-xl border border-stone-200 bg-white p-4">
          <p className="mb-4 text-xs font-bold uppercase tracking-wider text-stone-500">
            Pipeline Status
          </p>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {data.pipeline.map((item) => (
              <div key={item.label} className="text-center">
                <p className="text-[10px] font-medium text-stone-500">{item.label}</p>
                <p className="mt-1 text-sm font-bold text-stone-900">{item.value}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </ReportLayout>
  );
}
