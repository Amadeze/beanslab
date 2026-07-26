"use client";

import { useState } from "react";
import {
  TrendingUp,
  TrendingDown,
  Package,
  Flame,
  Factory,
  ReceiptText,
  WalletCards,
} from "lucide-react";
import {
  ReportLayout,
  ReportKpiCard,
  ReportChart,
  ReportFilters,
  ReportExport,
  type DateRange,
} from "../../_shared";
import { formatRupiah } from "@/lib/format";

// Mock data - replace with real data fetching
const mockData = {
  revenue: 150000000,
  expenses: 85000000,
  profit: 65000000,
  stockValue: 45000000,
  revenueTrend: 12.5,
  expensesTrend: -3.2,
  profitTrend: 18.7,
  stockTrend: 5.4,
  revenueChart: [
    { date: "Sen", value: 22000000 },
    { date: "Sel", value: 18000000 },
    { date: "Rab", value: 25000000 },
    { date: "Kam", value: 21000000 },
    { date: "Jum", value: 28000000 },
    { date: "Sab", value: 32000000 },
    { date: "Min", value: 14000000 },
  ],
  expensesByCategory: [
    { name: "Bahan Baku", value: 45000000 },
    { name: "Gaji", value: 20000000 },
    { name: "Operasional", value: 12000000 },
    { name: "Lainnya", value: 8000000 },
  ],
  pipeline: [
    { label: "Stok", value: "12 item", status: "ok" },
    { label: "Roasting", value: "5 batch", status: "ok" },
    { label: "Produksi", value: "3 batch", status: "ok" },
    { label: "Penjualan", value: formatRupiah(28000000), status: "ok" },
    { label: "Kas", value: formatRupiah(22000000), status: "ok" },
  ],
};

export default function SummaryReportClient() {
  const [dateRange, setDateRange] = useState<DateRange>({
    start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
    end: new Date().toISOString().split("T")[0],
  });

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
            { metric: "Revenue", value: mockData.revenue },
            { metric: "Expenses", value: mockData.expenses },
            { metric: "Profit", value: mockData.profit },
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
            value={formatRupiah(mockData.revenue)}
            trend={mockData.revenueTrend}
            icon={TrendingUp}
            color="emerald"
          />
          <ReportKpiCard
            label="Expenses"
            value={formatRupiah(mockData.expenses)}
            trend={mockData.expensesTrend}
            icon={WalletCards}
            color="rose"
          />
          <ReportKpiCard
            label="Profit"
            value={formatRupiah(mockData.profit)}
            trend={mockData.profitTrend}
            icon={TrendingUp}
            color="blue"
          />
          <ReportKpiCard
            label="Stock Value"
            value={formatRupiah(mockData.stockValue)}
            trend={mockData.stockTrend}
            icon={Package}
            color="amber"
          />
        </div>

        {/* Charts */}
        <div className="grid gap-4 lg:grid-cols-2">
          <ReportChart
            title="Revenue Trend"
            type="area"
            data={mockData.revenueChart}
            xKey="date"
            yKey="value"
          />
          <ReportChart
            title="Expenses by Category"
            type="pie"
            data={mockData.expensesByCategory}
            xKey="name"
            yKey="value"
          />
        </div>

        {/* Pipeline Status */}
        <div className="rounded-xl border border-stone-200 bg-white p-4">
          <p className="mb-4 text-xs font-bold uppercase tracking-wider text-stone-500">
            Pipeline Status
          </p>
          <div className="grid grid-cols-5 gap-4">
            {mockData.pipeline.map((item) => (
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
