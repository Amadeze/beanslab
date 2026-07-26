"use client";

import { useState, useEffect } from "react";
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
  type RoastingReportData,
} from "../../../_shared";
import { getRoastingReport } from "../../../actions";
import { formatKg } from "@/lib/format";

export default function RoastingReportClient() {
  const [dateRange, setDateRange] = useState<DateRange>({
    start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
    end: new Date().toISOString().split("T")[0],
  });
  const [data, setData] = useState<RoastingReportData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      try {
        const result = await getRoastingReport(dateRange.start, dateRange.end);
        setData(result);
      } catch (error) {
        console.error("Failed to fetch roasting report:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [dateRange]);

  const columns: ReportColumn<RoastingReportData["batches"][0]>[] = [
    { key: "id", label: "Batch", sortable: true },
    {
      key: "date",
      label: "Tanggal",
      sortable: true,
      format: (v) => new Date(v).toLocaleDateString("id-ID"),
    },
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
          {v.toFixed(1)}%
        </span>
      ),
    },
    { key: "machine", label: "Mesin", sortable: true },
  ];

  if (loading || !data) {
    return (
      <ReportLayout activeTab="inventory/roasting">
        <div className="flex items-center justify-center py-20">
          <div className="text-sm text-stone-500">Memuat data...</div>
        </div>
      </ReportLayout>
    );
  }

  return (
    <ReportLayout
      activeTab="inventory/roasting"
      actions={
        <ReportExport
          title="Roasting Report"
          filename="roasting-report"
          columns={columns.map((c) => ({ header: c.label, key: c.key }))}
          data={data.batches}
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
            value={data.totalBatches}
            subtitle="batch"
            icon={Flame}
            color="amber"
          />
          <ReportKpiCard
            label="GB Used"
            value={formatKg(data.totalGbUsed)}
            icon={Package}
            color="emerald"
          />
          <ReportKpiCard
            label="RB Produced"
            value={formatKg(data.totalRbProduced)}
            icon={Package}
            color="blue"
          />
          <ReportKpiCard
            label="Avg Yield"
            value={`${data.avgYield.toFixed(1)}%`}
            icon={TrendingUp}
            color="emerald"
          />
          <ReportKpiCard
            label="Loss"
            value={`${data.lossPercent.toFixed(1)}%`}
            icon={AlertTriangle}
            color="rose"
          />
        </div>

        {/* Charts */}
        <div className="grid gap-4 lg:grid-cols-2">
          <ReportChart
            title="Yield Trend (7 hari)"
            type="line"
            data={data.yieldTrend}
            xKey="date"
            yKey="yield"
          />
        </div>

        {/* Batch Table */}
        <ReportTable
          columns={columns}
          data={data.batches}
          pageSize={10}
        />
      </div>
    </ReportLayout>
  );
}
