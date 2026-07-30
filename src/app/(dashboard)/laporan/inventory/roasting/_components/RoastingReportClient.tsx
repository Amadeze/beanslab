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
  ReportSkeleton,
  ReportHeader,
  ReportInsightCard,
  type DateRange,
  type ReportColumn,
  type RoastingReportData,
} from "../../../_shared";
import { getRoastingReport } from "../../../actions";
import { formatKg } from "@/lib/format";
import { generateRoastingInsights } from "@/lib/report-insights";

export default function RoastingReportClient() {
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
        <ReportSkeleton />
      </ReportLayout>
    );
  }

  const dateRangeLabel = `${new Date(dateRange.start).toLocaleDateString("id-ID", { day: "numeric", month: "short" })} - ${new Date(dateRange.end).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}`;

  const insights = generateRoastingInsights(data).map((i) => ({
    type: i.severity as "positive" | "negative" | "warning" | "info",
    text: i.message,
    value: i.value,
  }));

  return (
    <ReportLayout
      activeTab="inventory/roasting"
      actions={
        <ReportExport
          title="Laporan Roasting"
          filename="roasting-report"
          columns={columns.map((c) => ({ header: c.label, key: c.key }))}
          data={data.batches}
          subtitle="Batch roasting, yield, dan analisa produksi"
          period={dateRangeLabel}
          status="DRAFT"
          summary={[
            { label: "Total Batch", value: `${data.totalBatches} batch` },
            { label: "GB Used", value: `${data.totalGbUsed.toFixed(1)} kg` },
            { label: "RB Produced", value: `${data.totalRbProduced.toFixed(1)} kg` },
            { label: "Avg Yield", value: `${data.avgYield.toFixed(1)}%` },
          ]}
        />
      }
    >
      <div className="space-y-6">
        <ReportHeader
          title="Laporan Roasting"
          subtitle="Batch roasting, yield, dan analisa produksi"
          period={dateRangeLabel}
          generatedAt={new Date()}
        />

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
            sparkline={data.yieldTrend.slice(-7).map((y) => y.yield)}
          />
          <ReportKpiCard
            label="Loss"
            value={`${data.lossPercent.toFixed(1)}%`}
            icon={AlertTriangle}
            color="rose"
          />
        </div>

        {/* Insights */}
        {insights.length > 0 && (
          <ReportInsightCard insights={insights} />
        )}

        {/* Charts */}
        <div className="grid gap-4 lg:grid-cols-2">
          <ReportChart
            title={`Yield Trend (${dateRangeLabel})`}
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
