"use client";

import { useState } from "react";
import { Package, AlertTriangle, ArrowUpDown, BarChart3 } from "lucide-react";
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
} from "../../../_shared";
import { getInventoryValuationReport, type InventoryValuationReport } from "../../../actions";
import { formatRupiah, formatKg } from "@/lib/format";
import { dateToLocalRange } from "@/lib/date-utils";

export default function StockReportClient() {
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
  // Nilai stok dihitung "per tanggal akhir" (as-of, sampai akhir hari WIB).
  const { end: asOfEnd } = dateToLocalRange(dateRange.end);
  const { data, error, loading, retry } = useReportData(
    () => getInventoryValuationReport(asOfEnd),
    [asOfEnd.toISOString()],
  );

  const columns: ReportColumn<InventoryValuationReport["items"][0]>[] = [
    { key: "code", label: "Kode", sortable: true },
    { key: "name", label: "Nama Item", sortable: true },
    { key: "category", label: "Kategori", sortable: true },
    {
      key: "stock",
      label: "Stok",
      sortable: true,
      format: (v, row) => (
        <span className={v <= row.lowStockThreshold ? "font-semibold text-red-600" : ""}>
          {row.unit === "kg" ? formatKg(v) : `${v.toLocaleString()} ${row.unit}`}
        </span>
      ),
      className: "text-right",
    },
    {
      key: "unitCost",
      label: "Harga Satuan",
      sortable: true,
      format: (v) => formatRupiah(v),
      className: "text-right",
    },
    {
      key: "totalValue",
      label: "Total Nilai",
      sortable: true,
      format: (v) => formatRupiah(v),
      className: "text-right",
    },
  ];

  if (error) {
    return (
      <ReportLayout activeTab="inventory/stock">
        <ReportError message={error} onRetry={retry} />
      </ReportLayout>
    );
  }

  if (loading || !data) {
    return (
      <ReportLayout activeTab="inventory/stock">
        <ReportSkeleton />
      </ReportLayout>
    );
  }

  // Calculate stock by category
  const stockByCategory = [
    { name: "Green Bean", value: data.totalGreenBeanValue },
    { name: "Roasted Bean", value: data.totalRoastedBeanValue },
    { name: "Produk Jadi", value: data.totalFinishedGoodsValue },
    { name: "Kemasan", value: data.totalPackagingValue },
    { name: "Non-Kopi", value: data.totalSupplyValue },
  ].filter((item) => item.value > 0);

  // Count low stock items (stock ≤ ambang per item: safety stock atau default per satuan)
  const lowStockItems = data.items.filter((item) => item.stock <= item.lowStockThreshold).length;

  return (
    <ReportLayout
      activeTab="inventory/stock"
      actions={
        <ReportExport
          title="Laporan Stok"
          filename="stock-report"
          columns={columns.map((c) => ({ header: c.label, key: c.key }))}
          data={data.items}
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
            label="Total Nilai Stok"
            value={formatRupiah(data.grandTotalValue)}
            icon={BarChart3}
            color="emerald"
          />
          <ReportKpiCard
            label="Jumlah Item"
            value={data.items.length}
            subtitle="item"
            icon={Package}
            color="blue"
          />
          <ReportKpiCard
            label="Stok Menipis"
            value={lowStockItems}
            subtitle="≤ ambang per item"
            icon={AlertTriangle}
            color="rose"
            inverse
            help="Jumlah item dengan stok di bawah/ sama ambangnya (safety stock jika diaktifkan, default 10 kg / 20 pcs)."
          />
          <ReportKpiCard
            label="Zero Cost"
            value={data.zeroCostItemCount}
            subtitle="item"
            icon={AlertTriangle}
            color="amber"
            inverse
          />
        </div>

        {/* Charts */}
        <div className="grid gap-4 lg:grid-cols-3">
          <ReportChart
            title="Stok per Kategori"
            type="bar"
            data={stockByCategory}
            xKey="name"
            yKey="value"
            yFormatter={(v) => formatRupiah(v)}
          />
          <ReportChart
            title="Komposisi Stok"
            type="pie"
            data={stockByCategory}
            xKey="name"
            yKey="value"
            className="lg:col-span-2"
          />
        </div>

        {/* Stock Table */}
        <ReportTable
          columns={columns}
          data={data.items}
          pageSize={10}
        />
      </div>
    </ReportLayout>
  );
}
