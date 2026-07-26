"use client";

import { useState } from "react";
import {
  Factory,
  PackageCheck,
  Package,
  Zap,
  CheckCircle2,
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
import { formatKg } from "@/lib/format";

// Mock data - replace with real data fetching
const mockBatches = [
  { id: "BTH-001", date: "2026-07-25", sku: "RB Arabica 1kg", rbUsed: 12, fgOutput: 11.2, recipe: "Full City", status: "DONE" },
  { id: "BTH-002", date: "2026-07-25", sku: "RB Robusta 1kg", rbUsed: 15, fgOutput: 13.8, recipe: "Medium", status: "DONE" },
  { id: "BTH-003", date: "2026-07-24", sku: "RB Blend 500g", rbUsed: 8, fgOutput: 7.4, recipe: "Espresso Blend", status: "DONE" },
  { id: "BTH-004", date: "2026-07-24", sku: "RB Arabica 1kg", rbUsed: 10, fgOutput: 9.3, recipe: "Light", status: "DONE" },
  { id: "BTH-005", date: "2026-07-23", sku: "RB Robusta 500g", rbUsed: 6, fgOutput: 5.4, recipe: "Dark", status: "IN_PROGRESS" },
];

const columns: ReportColumn<(typeof mockBatches)[0]>[] = [
  { key: "date", label: "Tanggal", sortable: true },
  { key: "sku", label: "SKU", sortable: true },
  {
    key: "rbUsed",
    label: "RB Used",
    sortable: true,
    format: (v) => formatKg(v),
    className: "text-right",
  },
  {
    key: "fgOutput",
    label: "FG Output",
    sortable: true,
    format: (v) => formatKg(v),
    className: "text-right",
  },
  { key: "recipe", label: "Recipe", sortable: true },
  {
    key: "status",
    label: "Status",
    format: (v) => (
      <span
        className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${
          v === "DONE"
            ? "bg-emerald-100 text-emerald-700"
            : "bg-amber-100 text-amber-700"
        }`}
      >
        {v}
      </span>
    ),
  },
];

const mockData = {
  totalBatches: 45,
  rbUsed: 520,
  fgProduced: 482,
  packagingUsed: 482,
  efficiency: 92.7,
  productionTrend: [
    { date: "Sen", value: 65 },
    { date: "Sel", value: 72 },
    { date: "Rab", value: 58 },
    { date: "Kam", value: 80 },
    { date: "Jum", value: 75 },
    { date: "Sab", value: 90 },
    { date: "Min", value: 45 },
  ],
};

export default function ProductionReportClient() {
  const [dateRange, setDateRange] = useState<DateRange>({
    start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0],
    end: new Date().toISOString().split("T")[0],
  });

  return (
    <ReportLayout
      activeTab="production"
      actions={
        <ReportExport
          title="Production Report"
          filename="production-report"
          columns={columns.map((c) => ({ header: c.label, key: c.key }))}
          data={mockBatches}
        />
      }
    >
      <div className="space-y-6">
        <ReportFilters
          dateRange={dateRange}
          onDateRangeChange={setDateRange}
        />

        {/* KPI Cards */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-5">
          <ReportKpiCard
            label="Total Batches"
            value={mockData.totalBatches}
            subtitle="batch"
            icon={Factory}
            color="blue"
          />
          <ReportKpiCard
            label="RB Used"
            value={formatKg(mockData.rbUsed)}
            icon={Package}
            color="amber"
          />
          <ReportKpiCard
            label="FG Produced"
            value={formatKg(mockData.fgProduced)}
            icon={PackageCheck}
            color="emerald"
          />
          <ReportKpiCard
            label="Packaging Used"
            value={mockData.packagingUsed}
            subtitle="units"
            icon={CheckCircle2}
            color="purple"
          />
          <ReportKpiCard
            label="Efficiency"
            value={`${mockData.efficiency}%`}
            icon={Zap}
            color="emerald"
          />
        </div>

        {/* Production Trend Chart */}
        <ReportChart
          title="Production Trend"
          type="area"
          data={mockData.productionTrend}
          xKey="date"
          yKey="value"
        />

        {/* Batch List Table */}
        <ReportTable columns={columns} data={mockBatches} pageSize={10} />
      </div>
    </ReportLayout>
  );
}
