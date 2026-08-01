"use client";

import { useState } from "react";
import { TrendingUp, TrendingDown, WalletCards, ReceiptText } from "lucide-react";
import {
  ReportLayout,
  ReportKpiCard,
  ReportChart,
  ReportTable,
  ReportFilters,
  ReportExport,
  ReportSkeleton,
  ReportError,
  useReportData,
  ReportHeader,
  ReportInsightCard,
  type DateRange,
  type ReportColumn,
  type ExpenseReportData,
} from "../../../_shared";
import { getExpenseReport } from "../../../actions";
import { formatRupiah } from "@/lib/format";
import { generateExpenseInsights } from "@/lib/report-insights";

export default function ExpenseReportClient() {
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
    () => getExpenseReport(dateRange.start, dateRange.end),
    [dateRange.start, dateRange.end],
  );

  const columns: ReportColumn<ExpenseReportData["expenses"][0]>[] = [
    {
      key: "date",
      label: "Tanggal",
      sortable: true,
      format: (v) => new Date(v).toLocaleDateString("id-ID"),
    },
    { key: "category", label: "Kategori", sortable: true },
    { key: "description", label: "Deskripsi", sortable: true },
    {
      key: "amount",
      label: "Jumlah",
      sortable: true,
      format: (v) => formatRupiah(v),
      className: "text-right",
    },
    {
      key: "status",
      label: "Status",
      format: (v) => (
        <span
          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${
            v === "Lunas"
              ? "bg-emerald-100 text-emerald-700"
              : "bg-amber-100 text-amber-700"
          }`}
        >
          {v}
        </span>
      ),
    },
  ];

  if (error) {
    return (
      <ReportLayout activeTab="keuangan/expenses">
        <ReportError message={error} onRetry={retry} />
      </ReportLayout>
    );
  }

  if (loading || !data) {
    return (
      <ReportLayout activeTab="keuangan/expenses">
        <ReportSkeleton />
      </ReportLayout>
    );
  }

  const dateRangeLabel = `${new Date(dateRange.start).toLocaleDateString("id-ID", { day: "numeric", month: "short" })} - ${new Date(dateRange.end).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}`;

  const insights = generateExpenseInsights(data).map((i) => ({
    type: i.severity as "positive" | "negative" | "warning" | "info",
    text: i.message,
    value: i.value,
  }));

  return (
    <ReportLayout
      activeTab="keuangan/expenses"
      actions={
        <ReportExport
          title="Laporan Pengeluaran"
          filename="expense-report"
          columns={columns.map((c) => ({ header: c.label, key: c.key }))}
          data={data.expenses}
          subtitle="Biaya operasional, pembelian, dan analisa pengeluaran"
          period={dateRangeLabel}
          status="DRAFT"
          summary={[
            { label: "Total Pengeluaran", value: formatRupiah(data.totalExpenses) },
            { label: "Biaya Pembelian", value: formatRupiah(data.totalPurchases) },
            { label: "Hutang Tertunda", value: formatRupiah(data.outstandingPayable) },
            { label: "Profit", value: formatRupiah(data.profit) },
          ]}
        />
      }
    >
      <div className="space-y-6">
        <ReportHeader
          title="Laporan Pengeluaran"
          subtitle="Biaya operasional, pembelian, dan analisa pengeluaran"
          period={dateRangeLabel}
          generatedAt={new Date()}
        />

        <ReportFilters
          dateRange={dateRange}
          onDateRangeChange={setDateRange}
        />

        {/* KPI Cards */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <ReportKpiCard
            label="Total Pengeluaran"
            value={formatRupiah(data.totalExpenses)}
            icon={WalletCards}
            color="rose"
            inverse
            sparkline={data.expenseTrend.slice(-7).map((e) => e.expenses)}
          />
          <ReportKpiCard
            label="Biaya Pembelian"
            value={formatRupiah(data.totalPurchases)}
            icon={ReceiptText}
            color="amber"
            inverse
          />
          <ReportKpiCard
            label="Hutang Tertunda"
            value={formatRupiah(data.outstandingPayable)}
            icon={TrendingDown}
            color="purple"
          />
          <ReportKpiCard
            label="Profit"
            value={formatRupiah(data.profit)}
            icon={data.profit > 0 ? TrendingUp : TrendingDown}
            color={data.profit > 0 ? "emerald" : "rose"}
          />
        </div>

        {/* Insights */}
        {insights.length > 0 && (
          <ReportInsightCard insights={insights} />
        )}

        {/* Charts */}
        <div className="grid gap-4 lg:grid-cols-3">
          <ReportChart
            title={`Expense Trend (${dateRangeLabel})`}
            type="area"
            data={data.expenseTrend}
            xKey="date"
            yKey="expenses"
            className="lg:col-span-2"
          />
          <ReportChart
            title="Expenses by Category"
            type="pie"
            data={data.expensesByCategory}
            xKey="name"
            yKey="value"
          />
        </div>

        {/* Expense Table */}
        <ReportTable
          columns={columns}
          data={data.expenses}
          pageSize={10}
        />
      </div>
    </ReportLayout>
  );
}
