"use client";

import { useState, useEffect } from "react";
import { TrendingUp, TrendingDown, WalletCards, ReceiptText } from "lucide-react";
import {
  ReportLayout,
  ReportKpiCard,
  ReportChart,
  ReportTable,
  ReportFilters,
  ReportExport,
  type DateRange,
  type ReportColumn,
  type ExpenseReportData,
} from "../../../_shared";
import { getExpenseReport } from "../../../actions";
import { formatRupiah } from "@/lib/format";

export default function ExpenseReportClient() {
  const [dateRange, setDateRange] = useState<DateRange>({
    start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
    end: new Date().toISOString().split("T")[0],
  });
  const [data, setData] = useState<ExpenseReportData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      try {
        const result = await getExpenseReport(dateRange.start, dateRange.end);
        setData(result);
      } catch (error) {
        console.error("Failed to fetch expense report:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [dateRange]);

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
          className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${
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

  if (loading || !data) {
    return (
      <ReportLayout activeTab="keuangan/expenses">
        <div className="flex items-center justify-center py-20">
          <div className="text-sm text-stone-500">Memuat data...</div>
        </div>
      </ReportLayout>
    );
  }

  return (
    <ReportLayout
      activeTab="keuangan/expenses"
      actions={
        <ReportExport
          title="Expense Report"
          filename="expense-report"
          columns={columns.map((c) => ({ header: c.label, key: c.key }))}
          data={data.expenses}
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
            label="Total Pengeluaran"
            value={formatRupiah(data.totalExpenses)}
            icon={WalletCards}
            color="rose"
            inverse
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

        {/* Charts */}
        <div className="grid gap-4 lg:grid-cols-3">
          <ReportChart
            title="Expense Trend (7 hari)"
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
