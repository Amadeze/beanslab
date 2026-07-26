"use client";

import { useState } from "react";
import {
  DollarSign,
  Wallet,
  ShoppingCart,
  Flame,
  Clock,
  Factory,
  Truck,
  Coffee,
} from "lucide-react";
import {
  ReportLayout,
  ReportKpiCard,
  ReportChart,
  ReportTable,
  ReportFilters,
  ReportExport,
  type DateRange,
  type ReportColumn,
} from "../../_shared";
import { formatRupiah } from "@/lib/format";

const mockActivities = [
  { id: 1, time: "06:00", area: "Roasting", activity: "Roast batch #42 — Toraja", amount: 0 },
  { id: 2, time: "07:15", area: "Gudang", activity: "Green bean intake — 50kg Flores", amount: 3750000 },
  { id: 3, time: "08:30", area: "Sales", activity: "INV-101 — Toko Kopi Senja", amount: 2500000 },
  { id: 4, time: "09:00", area: "Sales", activity: "INV-102 — Kedai Robusta", amount: 1800000 },
  { id: 5, time: "09:45", area: "Produksi", activity: "Grind & pack — 25kg Robusta", amount: 0 },
  { id: 6, time: "10:30", area: "Roasting", activity: "Roast batch #43 — Gayo", amount: 0 },
  { id: 7, time: "11:00", area: "Sales", activity: "INV-103 — Cafe Latte", amount: 3200000 },
  { id: 8, time: "11:30", area: "Gudang", activity: "Packaging supplies restock", amount: 450000 },
  { id: 9, time: "12:00", area: "Sales", activity: "INV-104 — Warung Kopi", amount: 950000 },
  { id: 10, time: "13:30", area: "Roasting", activity: "Roast batch #44 — Mandheling", amount: 0 },
  { id: 11, time: "14:00", area: "Sales", activity: "INV-105 — Espresso House", amount: 4100000 },
  { id: 12, time: "15:00", area: "Gudang", activity: "Outgoing shipment — 100kg roasted", amount: 0 },
];

const activityColumns: ReportColumn<(typeof mockActivities)[0]>[] = [
  { key: "time", label: "Waktu", sortable: true },
  {
    key: "area",
    label: "Area",
    sortable: true,
    format: (v: string) => {
      const colorMap: Record<string, string> = {
        Roasting: "bg-orange-100 text-orange-700",
        Gudang: "bg-blue-100 text-blue-700",
        Sales: "bg-emerald-100 text-emerald-700",
        Produksi: "bg-purple-100 text-purple-700",
      };
      return (
        <span
          className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${colorMap[v] ?? "bg-stone-100 text-stone-700"}`}
        >
          {v}
        </span>
      );
    },
  },
  { key: "activity", label: "Aktivitas", sortable: false },
  {
    key: "amount",
    label: "Nilai",
    sortable: true,
    format: (v: number) => (v > 0 ? formatRupiah(v) : "—"),
    className: "text-right",
  },
];

const mockData = {
  todayRevenue: 12550000,
  todayExpenses: 4200000,
  transactions: 4,
  batchesCompleted: 3,
  revenueTrend: 8.3,
  expensesTrend: -5.2,
  revenueVsExpenses: [
    { date: "06:00", revenue: 0, expenses: 0 },
    { date: "08:00", revenue: 2500000, expenses: 0 },
    { date: "09:00", revenue: 4300000, expenses: 450000 },
    { date: "10:00", revenue: 4300000, expenses: 450000 },
    { date: "11:00", revenue: 7500000, expenses: 450000 },
    { date: "12:00", revenue: 8450000, expenses: 450000 },
    { date: "13:00", revenue: 8450000, expenses: 4200000 },
    { date: "14:00", revenue: 12550000, expenses: 4200000 },
  ],
};

export default function DailyReportClient() {
  const [dateRange, setDateRange] = useState<DateRange>({
    start: new Date().toISOString().split("T")[0],
    end: new Date().toISOString().split("T")[0],
  });

  return (
    <ReportLayout
      activeTab="daily"
      actions={
        <ReportExport
          title="Daily Report"
          filename="daily-report"
          columns={activityColumns.map((c) => ({ header: c.label, key: c.key }))}
          data={mockActivities}
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
            label="Revenue Hari Ini"
            value={formatRupiah(mockData.todayRevenue)}
            trend={mockData.revenueTrend}
            icon={DollarSign}
            color="emerald"
          />
          <ReportKpiCard
            label="Pengeluaran"
            value={formatRupiah(mockData.todayExpenses)}
            trend={mockData.expensesTrend}
            icon={Wallet}
            color="rose"
          />
          <ReportKpiCard
            label="Transaksi"
            value={mockData.transactions}
            subtitle="nota hari ini"
            icon={ShoppingCart}
            color="blue"
          />
          <ReportKpiCard
            label="Batch Selesai"
            value={mockData.batchesCompleted}
            subtitle="roasting"
            icon={Flame}
            color="purple"
          />
        </div>

        {/* Revenue vs Expenses Chart */}
        <ReportChart
          title="Revenue vs Expenses (Harian)"
          type="bar"
          data={mockData.revenueVsExpenses}
          xKey="date"
          yKeys={["revenue", "expenses"]}
          colors={["#00C8DF", "#B65331"]}
          height={280}
        />

        {/* Activity Timeline */}
        <ReportTable
          columns={activityColumns}
          data={mockActivities}
          pageSize={12}
        />
      </div>
    </ReportLayout>
  );
}
