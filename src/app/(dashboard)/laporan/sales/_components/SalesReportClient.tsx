"use client";

import { useState, useEffect } from "react";
import { TrendingUp, ReceiptText, Users, FileText } from "lucide-react";
import {
  ReportLayout,
  ReportKpiCard,
  ReportChart,
  ReportTable,
  ReportFilters,
  ReportExport,
  ReportSkeleton,
  type DateRange,
  type ReportColumn,
  type SalesReportData,
} from "../../_shared";
import { getSalesReport } from "../../actions";
import { formatRupiah } from "@/lib/format";

export default function SalesReportClient() {
  const [dateRange, setDateRange] = useState<DateRange>({
    start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
    end: new Date().toISOString().split("T")[0],
  });
  const [data, setData] = useState<SalesReportData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      try {
        const result = await getSalesReport(dateRange.start, dateRange.end);
        setData(result);
      } catch (error) {
        console.error("Failed to fetch sales report:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [dateRange]);

  const columns: ReportColumn<SalesReportData["invoices"][0]>[] = [
    { key: "code", label: "Invoice", sortable: true },
    {
      key: "date",
      label: "Tanggal",
      sortable: true,
      format: (v) => new Date(v).toLocaleDateString("id-ID"),
    },
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
              : v === "PARTIAL"
              ? "bg-amber-100 text-amber-700"
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
      <ReportLayout activeTab="sales">
        <ReportSkeleton />
      </ReportLayout>
    );
  }

  const dateRangeLabel = `${new Date(dateRange.start).toLocaleDateString("id-ID", { day: "numeric", month: "short" })} - ${new Date(dateRange.end).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}`;

  return (
    <ReportLayout
      activeTab="sales"
      actions={
        <ReportExport
          title="Sales Report"
          filename="sales-report"
          columns={columns.map((c) => ({ header: c.label, key: c.key }))}
          data={data.invoices}
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
            value={formatRupiah(data.totalRevenue)}
            icon={TrendingUp}
            color="emerald"
          />
          <ReportKpiCard
            label="Invoice"
            value={data.invoiceCount}
            subtitle="nota"
            icon={FileText}
            color="blue"
          />
          <ReportKpiCard
            label="Rata-rata"
            value={formatRupiah(data.avgInvoice)}
            subtitle="per invoice"
            icon={ReceiptText}
            color="purple"
          />
          <ReportKpiCard
            label="Top Customer"
            value={data.topCustomer}
            icon={Users}
            color="amber"
          />
        </div>

        {/* Charts */}
        <div className="grid gap-4 lg:grid-cols-3">
          <ReportChart
            title={`Revenue Trend (${dateRangeLabel})`}
            type="area"
            data={data.revenueTrend}
            xKey="date"
            yKey="revenue"
            yFormatter={(v) => formatRupiah(v)}
            className="lg:col-span-2"
          />
          <ReportChart
            title="Sales by Product"
            type="pie"
            data={data.salesByProduct}
            xKey="name"
            yKey="value"
          />
        </div>

        {/* Invoice Table */}
        <ReportTable
          columns={columns}
          data={data.invoices}
          pageSize={10}
        />
      </div>
    </ReportLayout>
  );
}
