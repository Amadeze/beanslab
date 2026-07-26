"use client";

import { useState } from "react";
import { TrendingUp, ReceiptText, Users, FileText } from "lucide-react";
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
const mockInvoices = [
  { id: "INV-001", date: "2026-07-25", customer: "Toko Kopi Senja", amount: 2500000, status: "PAID" },
  { id: "INV-002", date: "2026-07-25", customer: "Kedai Robusta", amount: 1800000, status: "PAID" },
  { id: "INV-003", date: "2026-07-24", customer: "Cafe Latte", amount: 3200000, status: "ISSUED" },
  { id: "INV-004", date: "2026-07-24", customer: "Warung Kopi", amount: 950000, status: "PAID" },
  { id: "INV-005", date: "2026-07-23", customer: "Espresso House", amount: 4100000, status: "PAID" },
];

const columns: ReportColumn<typeof mockInvoices[0]>[] = [
  { key: "id", label: "Invoice", sortable: true },
  { key: "date", label: "Tanggal", sortable: true },
  { key: "customer", label: "Pelanggan", sortable: true },
  {
    key: "amount",
    label: "Nilai",
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
            : "bg-amber-100 text-amber-700"
        }`}
      >
        {v}
      </span>
    ),
  },
];

const mockData = {
  totalRevenue: 85000000,
  invoiceCount: 45,
  avgInvoice: 1888889,
  topCustomer: "Toko Kopi Senja",
  revenueTrend: 12.5,
  revenueChart: [
    { date: "Sen", value: 12000000 },
    { date: "Sel", value: 8000000 },
    { date: "Rab", value: 15000000 },
    { date: "Kam", value: 11000000 },
    { date: "Jum", value: 18000000 },
    { date: "Sab", value: 14000000 },
    { date: "Min", value: 7000000 },
  ],
  salesByProduct: [
    { name: "Green Bean", value: 35000000 },
    { name: "Roasted Bean", value: 28000000 },
    { name: "Produk Jadi", value: 22000000 },
  ],
  salesByPayment: [
    { name: "Cash", value: 30000000 },
    { name: "Transfer", value: 40000000 },
    { name: "QRIS", value: 15000000 },
  ],
};

export default function SalesReportClient() {
  const [dateRange, setDateRange] = useState<DateRange>({
    start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
    end: new Date().toISOString().split("T")[0],
  });

  return (
    <ReportLayout
      activeTab="sales"
      actions={
        <ReportExport
          title="Sales Report"
          filename="sales-report"
          columns={columns.map((c) => ({ header: c.label, key: c.key }))}
          data={mockInvoices}
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
            label="Revenue"
            value={formatRupiah(mockData.totalRevenue)}
            trend={mockData.revenueTrend}
            icon={TrendingUp}
            color="emerald"
          />
          <ReportKpiCard
            label="Invoice"
            value={mockData.invoiceCount}
            subtitle="nota"
            icon={FileText}
            color="blue"
          />
          <ReportKpiCard
            label="Rata-rata"
            value={formatRupiah(mockData.avgInvoice)}
            subtitle="per invoice"
            icon={ReceiptText}
            color="purple"
          />
          <ReportKpiCard
            label="Top Customer"
            value={mockData.topCustomer}
            icon={Users}
            color="amber"
          />
        </div>

        {/* Charts */}
        <div className="grid gap-4 lg:grid-cols-3">
          <ReportChart
            title="Revenue Trend"
            type="area"
            data={mockData.revenueChart}
            xKey="date"
            yKey="value"
            className="lg:col-span-2"
          />
          <ReportChart
            title="Sales by Product"
            type="pie"
            data={mockData.salesByProduct}
            xKey="name"
            yKey="value"
          />
        </div>

        {/* Invoice Table */}
        <ReportTable
          columns={columns}
          data={mockInvoices}
          pageSize={10}
        />
      </div>
    </ReportLayout>
  );
}
