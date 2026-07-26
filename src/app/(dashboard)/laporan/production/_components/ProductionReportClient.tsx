"use client";

import { useState, useEffect } from "react";
import { Factory, TrendingUp, Package, CheckCircle } from "lucide-react";
import {
  ReportLayout,
  ReportKpiCard,
  ReportChart,
  ReportTable,
  ReportFilters,
  ReportExport,
  type DateRange,
  type ReportColumn,
  type ProductionReportData,
} from "../../_shared";
import { getProductionReport } from "../../actions";
import { formatKg } from "@/lib/format";

export default function ProductionReportClient() {
  const [dateRange, setDateRange] = useState<DateRange>({
    start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
    end: new Date().toISOString().split("T")[0],
  });
  const [data, setData] = useState<ProductionReportData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      try {
        const result = await getProductionReport(dateRange.start, dateRange.end);
        setData(result);
      } catch (error) {
        console.error("Failed to fetch production report:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [dateRange]);

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
          className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${
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

  if (loading || !data) {
    return (
      <ReportLayout activeTab="production">
        <div className="flex items-center justify-center py-20">
          <div className="text-sm text-stone-500">Memuat data...</div>
        </div>
      </ReportLayout>
    );
  }

  return (
    <ReportLayout
      activeTab="production"
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
