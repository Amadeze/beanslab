"use client";

import { useState } from "react";
import { WalletCards, ShoppingBag, CreditCard, TrendingDown } from "lucide-react";
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

// Mock data - replace with real data fetching
const mockExpenses = [
  { id: "EXP-001", date: "2026-07-25", category: "Green Bean", description: "Pembelian Arabica Gayo 10kg", amount: 850000, status: "PAID" },
  { id: "EXP-002", date: "2026-07-25", category: "Operasional", description: "Listrik bulanan", amount: 450000, status: "PAID" },
  { id: "EXP-003", date: "2026-07-24", category: "Kemasan", description: "Kantong kopi 250gr x 200", amount: 320000, status: "PAID" },
  { id: "EXP-004", date: "2026-07-24", category: "Green Bean", description: "Pembelian Robusta 15kg", amount: 675000, status: "UNPAID" },
  { id: "EXP-005", date: "2026-07-23", category: "Gaji", description: "Gaji karyawan bulanan", amount: 4500000, status: "PAID" },
  { id: "EXP-006", date: "2026-07-23", category: "Operasional", description: "Air dan internet", amount: 280000, status: "PAID" },
  { id: "EXP-007", date: "2026-07-22", category: "Kemasan", description: "Label dan stiker", amount: 150000, status: "PAID" },
  { id: "EXP-008", date: "2026-07-22", category: "Maintenance", description: "Servis mesin roasting", amount: 750000, status: "UNPAID" },
];

const columns: ReportColumn<(typeof mockExpenses)[0]>[] = [
  { key: "date", label: "Tanggal", sortable: true },
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
          v === "PAID"
            ? "bg-emerald-100 text-emerald-700"
            : "bg-rose-100 text-rose-700"
        }`}
      >
        {v === "PAID" ? "Lunas" : "Belum Bayar"}
      </span>
    ),
  },
];

const mockData = {
  totalExpenses: 12500000,
  purchaseCosts: 8200000,
  outstandingPayable: 1425000,
  profit: 72500000,
  expenseTrend: -5.2,
  expenseChart: [
    { date: "Sen", value: 1800000 },
    { date: "Sel", value: 1200000 },
    { date: "Rab", value: 2100000 },
    { date: "Kam", value: 1650000 },
    { date: "Jum", value: 2400000 },
    { date: "Sab", value: 1950000 },
    { date: "Min", value: 1400000 },
  ],
  categoryBreakdown: [
    { name: "Green Bean", value: 5250000 },
    { name: "Operasional", value: 2730000 },
    { name: "Gaji", value: 4500000 },
    { name: "Kemasan", value: 1500000 },
    { name: "Maintenance", value: 1020000 },
  ],
};

export default function ExpenseReportClient() {
  const [dateRange, setDateRange] = useState<DateRange>({
    start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0],
    end: new Date().toISOString().split("T")[0],
  });

  return (
    <ReportLayout
      activeTab="expense"
      actions={
        <ReportExport
          title="Expense Report"
          filename="expense-report"
          columns={columns.map((c) => ({ header: c.label, key: c.key }))}
          data={mockExpenses}
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
            value={formatRupiah(mockData.totalExpenses)}
            trend={mockData.expenseTrend}
            icon={WalletCards}
            color="rose"
          />
          <ReportKpiCard
            label="Biaya Pembelian"
            value={formatRupiah(mockData.purchaseCosts)}
            subtitle="green bean & material"
            icon={ShoppingBag}
            color="amber"
          />
          <ReportKpiCard
            label="Hutang Tertunda"
            value={formatRupiah(mockData.outstandingPayable)}
            subtitle="belum dibayar"
            icon={CreditCard}
            color="purple"
          />
          <ReportKpiCard
            label="Profit"
            value={formatRupiah(mockData.profit)}
            trend={8.3}
            icon={TrendingDown}
            color="emerald"
          />
        </div>

        {/* Charts */}
        <div className="grid gap-4 lg:grid-cols-3">
          <ReportChart
            title="Expense Trend"
            type="area"
            data={mockData.expenseChart}
            xKey="date"
            yKey="value"
            className="lg:col-span-2"
          />
          <ReportChart
            title="Expense by Category"
            type="pie"
            data={mockData.categoryBreakdown}
            xKey="name"
            yKey="value"
          />
        </div>

        {/* Expense Table */}
        <ReportTable columns={columns} data={mockExpenses} pageSize={10} />
      </div>
    </ReportLayout>
  );
}
