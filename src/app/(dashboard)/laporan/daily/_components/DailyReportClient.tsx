"use client";

import { useState, useEffect } from "react";
import { Calendar, TrendingUp, TrendingDown, ReceiptText, WalletCards } from "lucide-react";
import {
  ReportLayout,
  ReportKpiCard,
  ReportChart,
  ReportTable,
  ReportExport,
  type ReportColumn,
} from "../../_shared";
import { formatRupiah } from "@/lib/format";

interface DailyActivity {
  time: string;
  area: string;
  activity: string;
  amount: number | null;
}

export default function DailyReportClient() {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split("T")[0]);
  const [data, setData] = useState<{
    revenue: number;
    expenses: number;
    transactions: number;
    batches: number;
    activities: DailyActivity[];
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      try {
        // Fetch daily data from multiple sources
        const [salesResult, expenseResult] = await Promise.all([
          import("../../actions").then((m) => m.getSalesReport(selectedDate, selectedDate)),
          import("../../actions").then((m) => m.getExpenseReport(selectedDate, selectedDate)),
        ]);

        const revenue = salesResult.totalRevenue;
        const expenses = expenseResult.totalExpenses;
        const transactions = salesResult.invoiceCount;
        const batches = 0; // Would need roasting data

        // Combine activities from sales and expenses
        const activities: DailyActivity[] = [
          ...salesResult.invoices.map((inv) => ({
            time: new Date(inv.date).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }),
            area: "Penjualan",
            activity: `Invoice ${inv.code} - ${inv.customer}`,
            amount: inv.amount,
          })),
          ...expenseResult.expenses.map((exp) => ({
            time: new Date(exp.date).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }),
            area: "Pengeluaran",
            activity: exp.description,
            amount: exp.amount,
          })),
        ].sort((a, b) => a.time.localeCompare(b.time));

        setData({ revenue, expenses, transactions, batches, activities });
      } catch (error) {
        console.error("Failed to fetch daily report:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [selectedDate]);

  const columns: ReportColumn<DailyActivity>[] = [
    { key: "time", label: "Waktu", sortable: true },
    { key: "area", label: "Area", sortable: true },
    { key: "activity", label: "Aktivitas", sortable: true },
    {
      key: "amount",
      label: "Nilai",
      sortable: true,
      format: (v) => v ? formatRupiah(v) : "-",
      className: "text-right",
    },
  ];

  if (loading || !data) {
    return (
      <ReportLayout activeTab="daily">
        <div className="flex items-center justify-center py-20">
          <div className="text-sm text-stone-500">Memuat data...</div>
        </div>
      </ReportLayout>
    );
  }

  return (
    <ReportLayout
      activeTab="daily"
      actions={
        <ReportExport
          title={`Daily Report - ${selectedDate}`}
          filename={`daily-report-${selectedDate}`}
          columns={columns.map((c) => ({ header: c.label, key: c.key }))}
          data={data.activities}
        />
      }
    >
      <div className="space-y-6">
        {/* Date selector */}
        <div className="flex items-center gap-3">
          <Calendar size={16} className="text-stone-400" />
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="rounded-lg border border-stone-200 px-3 py-2 text-sm text-stone-700 focus:border-[#00C8DF] focus:outline-none focus:ring-1 focus:ring-[#00C8DF]"
          />
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <ReportKpiCard
            label="Revenue Hari Ini"
            value={formatRupiah(data.revenue)}
            icon={TrendingUp}
            color="emerald"
          />
          <ReportKpiCard
            label="Pengeluaran"
            value={formatRupiah(data.expenses)}
            icon={WalletCards}
            color="rose"
          />
          <ReportKpiCard
            label="Transaksi"
            value={data.transactions}
            subtitle="invoice"
            icon={ReceiptText}
            color="blue"
          />
          <ReportKpiCard
            label="Net Cash Flow"
            value={formatRupiah(data.revenue - data.expenses)}
            icon={data.revenue > data.expenses ? TrendingUp : TrendingDown}
            color={data.revenue > data.expenses ? "emerald" : "rose"}
          />
        </div>

        {/* Chart */}
        <div className="grid gap-4 lg:grid-cols-2">
          <ReportChart
            title="Revenue vs Expenses"
            type="bar"
            data={[
              { name: "Revenue", value: data.revenue },
              { name: "Expenses", value: data.expenses },
            ]}
            xKey="name"
            yKey="value"
          />
        </div>

        {/* Activity Table */}
        <ReportTable
          columns={columns}
          data={data.activities}
          pageSize={15}
          emptyMessage="Tidak ada aktivitas hari ini"
        />
      </div>
    </ReportLayout>
  );
}
