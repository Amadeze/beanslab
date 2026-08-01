"use client";

import { useState } from "react";
import { Factory, TrendingUp, Package, CheckCircle } from "lucide-react";
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
  type DateRange,
  type ReportColumn,
  type ProductionReportData,
} from "../../../_shared";
import { getProductionReport } from "../../../actions";
import { formatKg } from "@/lib/format";

export default function ProductionReportClient() {
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
    () => getProductionReport(dateRange.start, dateRange.end),
    [dateRange.start, dateRange.end],
  );

  const columns: ReportColumn<ProductionReportData["batches"][0]>[] = [
    { key: "id", label: "Batch", sortable: true },
    {
      key: "date",
      label: "Tanggal",
      sortable: true,
      format: (v) => new Date(v).toLocaleDateString("id-ID"),
    },
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
      format: (v) => `${v} unit`,
      className: "text-right",
    },
    { key: "recipe", label: "Recipe", sortable: true },
    {
      key: "status",
      label: "Status",
      format: (v) => (
        <span
          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${
            v === "COMPLETED"
              ? "bg-emerald-100 text-emerald-700"
              : "bg-stone-100 text-stone-700"
          }`}
        >
          {v}
        </span>
      ),
    },
  ];

  if (error) {
    return (
      <ReportLayout activeTab="inventory/production">
        <ReportError message={error} onRetry={retry} />
      </ReportLayout>
    );
  }

  if (loading || !data) {
    return (
      <ReportLayout activeTab="inventory/production">
        <ReportSkeleton />
      </ReportLayout>
    );
  }

  return (
    <ReportLayout
      activeTab="inventory/production"
      actions={
        <ReportExport
          title="Production Report"
          filename="production-report"
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
            icon={Factory}
            color="amber"
          />
          <ReportKpiCard
            label="RB Used"
            value={formatKg(data.totalRbUsed)}
            icon={Package}
            color="emerald"
          />
          <ReportKpiCard
            label="FG Produced"
            value={`${data.totalFgProduced} unit`}
            icon={Package}
            color="blue"
          />
          <ReportKpiCard
            label="Packaging"
            value={`${data.totalPackagingUsed} pcs`}
            icon={CheckCircle}
            color="purple"
          />
          <ReportKpiCard
            label="Efficiency"
            value={`${data.efficiency.toFixed(1)}%`}
            icon={TrendingUp}
            color="emerald"
          />
        </div>

        {/* Charts */}
        <div className="grid gap-4 lg:grid-cols-2">
          <ReportChart
            title="Production Trend (7 hari)"
            type="area"
            data={data.productionTrend}
            xKey="date"
            yKey="units"
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
