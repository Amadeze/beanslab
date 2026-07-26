"use client";

import { useState } from "react";
import { Flame, TrendingUp, Package, AlertTriangle } from "lucide-react";
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
import { formatRupiah, formatKg } from "@/lib/format";

// Mock data - replace with real data fetching
const mockBatches = [
  { id: "RB-001", date: "2026-07-25", gbInput: 50, rbOutput: 42, yield: 84, machine: "Artisan 1", profile: "Medium" },
  { id: "RB-002", date: "2026-07-25", gbInput: 30, rbOutput: 25.5, yield: 85, machine: "Artisan 2", profile: "Dark" },
  { id: "RB-003", date: "2026-07-24", gbInput: 45, rbOutput: 37.8, yield: 84, machine: "Artisan 1", profile: "Light" },
  { id: "RB-004", date: "2026-07-24", gbInput: 60, rbOutput: 50.4, yield: 84, machine: "Artisan 3", profile: "Medium" },
  { id: "RB-005", date: "2026-07-23", gbInput: 25, rbOutput: 21, yield: 84, machine: "Artisan 2", profile: "Dark" },
];

const columns: ReportColumn<typeof mockBatches[0]>[] = [
  { key: "id", label: "Batch", sortable: true },
  { key: "date", label: "Tanggal", sortable: true },
  {
    key: "gbInput",
    label: "GB Input",
    sortable: true,
    format: (v) => formatKg(v),
    className: "text-right",
  },
  {
    key: "rbOutput",
    label: "RB Output",
    sortable: true,
    format: (v) => formatKg(v),
    className: "text-right",
  },
  {
    key: "yield",
    label: "Yield",
    sortable: true,
    format: (v) => (
      <span className={`font-semibold ${v >= 85 ? "text-emerald-600" : "text-amber-600"}`}>
        {v}%
      </span>
    ),
  },
  { key: "machine", label: "Mesin", sortable: true },
  { key: "profile", label: "Profil", sortable: true },
];

const mockData = {
  totalBatches: 45,
  totalGbUsed: 2100,
  totalRbProduced: 1764,
  avgYield: 84.2,
  lossPercent: 15.8,
  yieldTrend: 2.1,
  yieldChart: [
    { date: "Sen", yield: 83.5 },
    { date: "Sel", yield: 84.2 },
    { date: "Rab", yield: 85.1 },
    { date: "Kam", yield: 83.8 },
    { date: "Jum", yield: 84.5 },
    { date: "Sab", yield: 85.3 },
    { date: "Min", yield: 84.0 },
  ],
  batchesByMachine: [
    { name: "Artisan 1", value: 18 },
    { name: "Artisan 2", value: 15 },
    { name: "Artisan 3", value: 12 },
  ],
};

export default function RoastingReportClient() {
  const [dateRange, setDateRange] = useState<DateRange>({
    start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
    end: new Date().toISOString().split("T")[0],
  });

  return (
    <ReportLayout
      activeTab="roasting"
      actions={
        <ReportExport
          title="Roasting Report"
          filename="roasting-report"
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
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
          <ReportKpiCard
            label="Total Batch"
            value={mockData.totalBatches}
            subtitle="batch"
            icon={Flame}
            color="amber"
          />
          <ReportKpiCard
            label="GB Used"
            value={formatKg(mockData.totalGbUsed)}
            icon={Package}
            color="emerald"
          />
          <ReportKpiCard
            label="RB Produced"
            value={formatKg(mockData.totalRbProduced)}
            icon={Package}
            color="blue"
          />
          <ReportKpiCard
            label="Avg Yield"
            value={`${mockData.avgYield}%`}
            trend={mockData.yieldTrend}
            icon={TrendingUp}
            color="emerald"
          />
          <ReportKpiCard
            label="Loss"
            value={`${mockData.lossPercent}%`}
            icon={AlertTriangle}
            color="rose"
          />
        </div>

        {/* Charts */}
        <div className="grid gap-4 lg:grid-cols-3">
          <ReportChart
            title="Yield Trend"
            type="line"
            data={mockData.yieldChart}
            xKey="date"
            yKey="yield"
            className="lg:col-span-2"
          />
          <ReportChart
            title="Batches by Machine"
            type="pie"
            data={mockData.batchesByMachine}
            xKey="name"
            yKey="value"
          />
        </div>

        {/* Batch Table */}
        <ReportTable
          columns={columns}
          data={mockBatches}
          pageSize={10}
        />
      </div>
    </ReportLayout>
  );
}
