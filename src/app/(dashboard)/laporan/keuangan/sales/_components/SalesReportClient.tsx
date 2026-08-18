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
          columns={[
            { header: "Invoice", key: "code" },
            { header: "Tanggal", key: "date", format: (v) => new Date(v as string).toLocaleDateString("id-ID") },
            { header: "Pelanggan", key: "customer" },
            { header: "Nilai", key: "amount", format: (v) => formatRupiah(Number(v)) },
            { header: "Status", key: "status" },
          ]}
          data={data.invoices}
          subtitle="Revenue, invoice, dan analisa penjualan"
          period={dateRangeLabel}
          status="DRAFT"
          summary={[
            { label: "Total Pendapatan", value: formatRupiah(data.totalRevenue) },
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
            help="Basis pendapatan: invoice yang DISERAHKAN (deliveredAt), tidak di-void, sudah dikurangi nilai retur."
          />
          <ReportKpiCard
            label="Invoice"
            value={data.invoiceCount}
            subtitle="nota diserahkan"
            icon={FileText}
            color="blue"
            help="Jumlah nota yang diserahkan pada periode ini (tanpa nota void)."
          />
          <ReportKpiCard
            label="Rata-rata"
            value={formatRupiah(data.avgInvoice)}
            subtitle="per nota diserahkan"
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

        {/* Profitabilitas Produk */}
        <div className="rounded-xl border border-stone-200 bg-white p-4">
          <p className="mb-1 text-xs font-bold uppercase tracking-wider text-stone-500">
            Profitabilitas per Produk
          </p>
          <p className="mb-3 text-xs text-stone-500">
            HPP historis dari snapshot nota (InvoiceItem.hpp), diskon &amp; retur dialokasikan proporsional per nota.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-stone-200 text-left text-xs uppercase tracking-wider text-stone-500">
                  <th className="py-2 pr-3 font-semibold">Produk</th>
                  <th className="py-2 pr-3 text-right font-semibold">Terjual</th>
                  <th className="py-2 pr-3 text-right font-semibold">Pendapatan</th>
                  <th className="py-2 pr-3 text-right font-semibold">HPP</th>
                  <th className="py-2 pr-3 text-right font-semibold">Laba Kotor</th>
                  <th className="py-2 text-right font-semibold">Margin</th>
                </tr>
              </thead>
              <tbody>
                {data.productProfitability.map((row) => (
                  <tr key={row.productId} className="border-b border-stone-100">
                    <td className="py-2 pr-3 font-medium text-stone-800">{row.name}</td>
                    <td className="py-2 pr-3 text-right tabular-nums text-stone-600">{row.quantity.toLocaleString("id-ID")}</td>
                    <td className="py-2 pr-3 text-right font-mono tabular-nums text-stone-800">{formatRupiah(row.revenue)}</td>
                    <td className="py-2 pr-3 text-right font-mono tabular-nums text-stone-600">{formatRupiah(row.cogs)}</td>
                    <td className="py-2 pr-3 text-right font-mono tabular-nums text-stone-800">{formatRupiah(row.grossProfit)}</td>
                    <td className="py-2 text-right font-semibold tabular-nums text-stone-700">{row.margin.toFixed(1)}%</td>
                  </tr>
                ))}
                {data.productProfitability.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-4 text-center text-stone-400">Tidak ada penjualan pada periode ini.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Analitik Retur */}
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-xl border border-stone-200 bg-white p-4">
            <p className="mb-3 text-xs font-bold uppercase tracking-wider text-stone-500">
              Retur Penjualan · {formatRupiah(data.returns.totalReturned)}{data.returns.returnedInvoiceCount > 0 ? ` · ${data.returns.returnedInvoiceCount} nota` : ""}
              <span className="ml-1 font-normal normal-case text-stone-400">
                ({data.returns.returnPercent.toFixed(1)}% dari pendapatan)
              </span>
            </p>
            <div className="space-y-3">
              {data.returns.topReasons.length > 0 && (
                <div>
                  <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-stone-400">Alasan Terbanyak</p>
                  <div className="space-y-1">
                    {data.returns.topReasons.map((r) => (
                      <div key={r.reason} className="flex items-center justify-between text-sm">
                        <span className="text-stone-700">{r.reason} <span className="text-stone-400">({r.count}×)</span></span>
                        <span className="font-mono text-xs tabular-nums text-stone-600">{formatRupiah(r.total)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {data.returns.topCustomers.length > 0 && (
                <div>
                  <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-stone-400">Pelanggan dengan Retur Terbesar</p>
                  <div className="space-y-1">
                    {data.returns.topCustomers.map((c) => (
                      <div key={c.name} className="flex items-center justify-between text-sm">
                        <span className="text-stone-700">{c.name} <span className="text-stone-400">({c.count}×)</span></span>
                        <span className="font-mono text-xs tabular-nums text-stone-600">{formatRupiah(c.total)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {data.returns.topReasons.length === 0 && data.returns.topCustomers.length === 0 && (
                <p className="text-sm text-stone-400">Tidak ada retur pada periode ini.</p>
              )}
            </div>
          </div>
          <div className="rounded-xl border border-stone-200 bg-white p-4">
            <p className="mb-3 text-xs font-bold uppercase tracking-wider text-stone-500">Produk Paling Sering Diretur</p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-stone-200 text-left text-xs uppercase tracking-wider text-stone-500">
                    <th className="py-2 pr-3 font-semibold">Produk</th>
                    <th className="py-2 pr-3 text-right font-semibold">Qty</th>
                    <th className="py-2 text-right font-semibold">Nilai</th>
                  </tr>
                </thead>
                <tbody>
                  {data.returns.topReturnedProducts.map((p) => (
                    <tr key={p.name} className="border-b border-stone-100">
                      <td className="py-2 pr-3 font-medium text-stone-800">{p.name}</td>
                      <td className="py-2 pr-3 text-right tabular-nums text-stone-600">{p.quantity.toLocaleString("id-ID")}</td>
                      <td className="py-2 text-right font-mono tabular-nums text-stone-700">{formatRupiah(p.value)}</td>
                    </tr>
                  ))}
                  {data.returns.topReturnedProducts.length === 0 && (
                    <tr>
                      <td colSpan={3} className="py-4 text-center text-stone-400">Tidak ada retur pada periode ini.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </ReportLayout>
  );
}
