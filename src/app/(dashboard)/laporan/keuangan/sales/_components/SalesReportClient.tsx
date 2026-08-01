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
  ReportSkeleton,
  ReportError,
  useReportData,
  ReportHeader,
  ReportInsightCard,
  type DateRange,
  type ReportColumn,
  type SalesReportData,
} from "../../../_shared";
import { getSalesReport } from "../../../actions";
import { formatRupiah } from "@/lib/format";
import { generateSalesInsights } from "@/lib/report-insights";

export default function SalesReportClient() {
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
    () => getSalesReport(dateRange.start, dateRange.end),
    [dateRange.start, dateRange.end],
  );

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
          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${
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

  if (error) {
    return (
      <ReportLayout activeTab="keuangan/sales">
        <ReportError message={error} onRetry={retry} />
      </ReportLayout>
    );
  }

  if (loading || !data) {
    return (
      <ReportLayout activeTab="keuangan/sales">
        <ReportSkeleton />
      </ReportLayout>
    );
  }

  const dateRangeLabel = `${new Date(dateRange.start).toLocaleDateString("id-ID", { day: "numeric", month: "short" })} - ${new Date(dateRange.end).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}`;

  const insights = generateSalesInsights(data).map((i) => ({
    type: i.severity as "positive" | "negative" | "warning" | "info",
    text: i.message,
    value: i.value,
  }));

  return (
    <ReportLayout
      activeTab="keuangan/sales"
      actions={
        <ReportExport
          title="Laporan Penjualan"
          filename="sales-report"
          columns={columns.map((c) => ({ header: c.label, key: c.key }))}
          data={data.invoices}
          subtitle="Revenue, invoice, dan analisa penjualan"
          period={dateRangeLabel}
          status="DRAFT"
          summary={[
            { label: "Total Revenue", value: formatRupiah(data.totalRevenue) },
            { label: "Jumlah Invoice", value: `${data.invoiceCount} nota` },
            { label: "Rata-rata Invoice", value: formatRupiah(data.avgInvoice) },
            { label: "Top Customer", value: data.topCustomer },
          ]}
        />
      }
    >
      <div className="space-y-6">
        <ReportHeader
          title="Laporan Penjualan"
          subtitle="Revenue, invoice, dan analisa penjualan"
          period={dateRangeLabel}
          generatedAt={new Date()}
        />

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
            sparkline={data.revenueTrend.slice(-7).map((r) => r.revenue)}
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

        {/* Insights */}
        {insights.length > 0 && (
          <ReportInsightCard insights={insights} />
        )}

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
        {data.detailTruncated && (
          <p className="text-sm text-amber-700">
            KPI mencakup seluruh {data.invoiceCount.toLocaleString("id-ID")} invoice. Tabel dan ekspor cepat menampilkan {data.detailLimit.toLocaleString("id-ID")} invoice terbaru agar laporan tetap responsif.
          </p>
        )}
        <ReportTable
          columns={columns}
          data={data.invoices}
          pageSize={10}
        />
      </div>
    </ReportLayout>
  );
}
