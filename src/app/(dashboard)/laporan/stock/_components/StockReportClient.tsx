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
  type DateRange,
  type ReportColumn,
} from "../../_shared";
import { formatRupiah, formatKg } from "@/lib/format";

// Mock data - replace with real data fetching
const mockStockItems = [
  { code: "GB-001", name: "Green Bean Arabica Aceh", category: "Green Bean", stock: 1250, unit: "kg", unitCost: 85000 },
  { code: "GB-002", name: "Green Bean Robusta Lampung", category: "Green Bean", stock: 890, unit: "kg", unitCost: 65000 },
  { code: "GB-003", name: "Green Bean Toraja", category: "Green Bean", stock: 2100, unit: "kg", unitCost: 95000 },
  { code: "RB-001", name: "Roasted Bean Blend House", category: "Roasted Bean", stock: 450, unit: "kg", unitCost: 120000 },
  { code: "RB-002", name: "Roasted Bean Single Origin", category: "Roasted Bean", stock: 320, unit: "kg", unitCost: 145000 },
  { code: "PKG-001", name: "Kopi Drip Bag 10g", category: "Packaging", stock: 5000, unit: "pcs", unitCost: 2500 },
  { code: "PKG-002", name: "Standing Pouch 250g", category: "Packaging", stock: 3200, unit: "pcs", unitCost: 1800 },
  { code: "PRD-001", name: "Kopi Tubruk 100g", category: "Produk Jadi", stock: 180, unit: "pcs", unitCost: 35000 },
  { code: "PRD-002", name: "Kopi Bubuk 250g", category: "Produk Jadi", stock: 95, unit: "pcs", unitCost: 65000 },
  { code: "PRD-003", name: "Espresso Blend 1kg", category: "Produk Jadi", stock: 42, unit: "pcs", unitCost: 180000 },
];

const columns: ReportColumn<(typeof mockStockItems)[0]>[] = [
  { key: "code", label: "Kode", sortable: true },
  { key: "name", label: "Nama Item", sortable: true },
  { key: "category", label: "Kategori", sortable: true },
  {
    key: "stock",
    label: "Stok",
    sortable: true,
    format: (v, row) => (
      <span className={v < 100 ? "font-semibold text-red-600" : ""}>
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
    key: "stock",
    label: "Total Nilai",
    sortable: false,
    format: (_v, row) => formatRupiah(row.stock * row.unitCost),
    className: "text-right",
  },
];

const mockData = {
  totalStockValue: 352500000,
  itemCount: 10,
  lowStockItems: 2,
  recentMovements: 8,
  stockValueTrend: -3.2,
  stockByCategory: [
    { name: "Green Bean", value: 312500000 },
    { name: "Roasted Bean", value: 100400000 },
    { name: "Packaging", value: 18100000 },
    { name: "Produk Jadi", value: 21450000 },
  ],
  movementTrend: [
    { date: "Sen", in: 450, out: 320 },
    { date: "Sel", in: 280, out: 410 },
    { date: "Rab", in: 620, out: 350 },
    { date: "Kam", in: 180, out: 520 },
    { date: "Jum", in: 390, out: 280 },
    { date: "Sab", in: 210, out: 190 },
    { date: "Min", in: 50, out: 30 },
  ],
};

export default function StockReportClient() {
  const [dateRange, setDateRange] = useState<DateRange>({
    start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
    end: new Date().toISOString().split("T")[0],
  });

  return (
    <ReportLayout
      activeTab="stock"
      actions={
        <ReportExport
          title="Stock Report"
          filename="stock-report"
          columns={columns.map((c) => ({ header: c.label, key: c.key }))}
          data={mockStockItems}
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
            value={formatRupiah(mockData.totalStockValue)}
            trend={mockData.stockValueTrend}
            icon={BarChart3}
            color="emerald"
          />
          <ReportKpiCard
            label="Jumlah Item"
            value={mockData.itemCount}
            subtitle="item"
            icon={Package}
            color="blue"
          />
          <ReportKpiCard
            label="Stok Menipis"
            value={mockData.lowStockItems}
            subtitle="< 100 unit"
            icon={AlertTriangle}
            color="rose"
          />
          <ReportKpiCard
            label="Pergerakan"
            value={mockData.recentMovements}
            subtitle="7 hari terakhir"
            icon={ArrowUpDown}
            color="purple"
          />
        </div>

        {/* Charts */}
        <div className="grid gap-4 lg:grid-cols-3">
          <ReportChart
            title="Stok per Kategori"
            type="bar"
            data={mockData.stockByCategory}
            xKey="name"
            yKey="value"
          />
          <ReportChart
            title="Tren Pergerakan Stok"
            type="area"
            data={mockData.movementTrend}
            xKey="date"
            yKey="in"
            className="lg:col-span-2"
          />
        </div>

        {/* Stock Table */}
        <ReportTable
          columns={columns}
          data={mockStockItems}
          pageSize={10}
        />
      </div>
    </ReportLayout>
  );
}
