"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Package,
  AlertTriangle,
  BarChart3,
  ArrowRight,
  Flame,
  Factory,
  TrendingUp,
  Database,
  Activity,
} from "lucide-react";
import {
  ReportLayout,
  ReportKpiCard,
  ReportChart,
  ReportFilters,
  ReportSkeleton,
  ReportError,
  useReportData,
  type DateRange,
} from "../../_shared";
import {
  getInventoryValuationReport,
  type InventoryValuationReport,
} from "../../actions";
import { formatRupiah } from "@/lib/format";
import { dateToLocalRange } from "@/lib/date-utils";

export default function InventoryOverviewClient() {
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

  if (error) {
    return (
      <ReportLayout activeTab="inventory">
        <ReportError message={error} onRetry={retry} />
      </ReportLayout>
    );
  }

  if (loading || !data) {
    return (
      <ReportLayout activeTab="inventory">
        <ReportSkeleton />
      </ReportLayout>
    );
  }

  // Stock by category
  const stockByCategory = [
    { name: "Green Bean", value: data.totalGreenBeanValue },
    { name: "Roasted Bean", value: data.totalRoastedBeanValue },
    { name: "Produk Jadi", value: data.totalFinishedGoodsValue },
    { name: "Kemasan", value: data.totalPackagingValue },
    { name: "Non-Kopi", value: data.totalSupplyValue },
  ].filter((item) => item.value > 0);

  // Low stock items (stock ≤ ambang per item: safety stock atau default per satuan)
  const lowStockItems = data.items.filter((item) => item.stock <= item.lowStockThreshold).length;

  return (
    <ReportLayout activeTab="inventory">
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
            help="Penilaian persediaan per tanggal akhir (metode rata-rata tertimbang / weighted average)."
          />
          <ReportKpiCard
            label="Jumlah Item"
            value={data.items.length}
            subtitle="item aktif"
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
            help="Item dengan stok lebih kecil/ sama dengan ambangnya (pakai safety stock jika diaktifkan, selain itu default: 10 &nbsp;untuk kg, 20 pcs)."
          />
          <ReportKpiCard
            label="Sample Write-Off"
            value={formatRupiah(data.totalSampleWriteOff)}
            subtitle="nilai"
            icon={TrendingUp}
            color="amber"
            inverse
            help="Nilai barang yang dipakai untuk sampel (cupping/uji coba) pada periode laporan."
          />
        </div>

        {/* Charts */}
        <div className="grid gap-4 lg:grid-cols-2">
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
          />
        </div>

        {/* Quick Links */}
        <div className="rounded-xl border border-stone-200 bg-white p-5">
          <p className="mb-4 text-xs font-bold uppercase tracking-wider text-stone-500">
            Laporan Detail
          </p>
          <div className="grid gap-3 sm:grid-cols-3">
            <Link
              href="/laporan/inventory/stock"
              className="group flex items-center justify-between rounded-lg border border-stone-200 p-4 transition-colors hover:border-[#00C8DF]/30 hover:bg-[#00C8DF]/[0.03]"
            >
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-blue-50 p-2">
                  <Package size={16} className="text-blue-600" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-stone-900">Stok Detail</p>
                  <p className="text-[11px] text-stone-500">
                    {data.items.length} item &middot; {formatRupiah(data.grandTotalValue)}
                  </p>
                </div>
              </div>
              <ArrowRight
                size={14}
                className="text-stone-300 transition-colors group-hover:text-[#00C8DF]"
              />
            </Link>

            <Link
              href="/laporan/inventory/roasting"
              className="group flex items-center justify-between rounded-lg border border-stone-200 p-4 transition-colors hover:border-[#00C8DF]/30 hover:bg-[#00C8DF]/[0.03]"
            >
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-amber-50 p-2">
                  <Flame size={16} className="text-amber-600" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-stone-900">Roasting Detail</p>
                  <p className="text-[11px] text-stone-500">
                    {formatRupiah(data.totalRoastedBeanValue)}
                  </p>
                </div>
              </div>
              <ArrowRight
                size={14}
                className="text-stone-300 transition-colors group-hover:text-[#00C8DF]"
              />
            </Link>

            <Link
              href="/laporan/inventory/production"
              className="group flex items-center justify-between rounded-lg border border-stone-200 p-4 transition-colors hover:border-[#00C8DF]/30 hover:bg-[#00C8DF]/[0.03]"
            >
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-emerald-50 p-2">
                  <Factory size={16} className="text-emerald-600" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-stone-900">Produksi Detail</p>
                  <p className="text-[11px] text-stone-500">
                    {formatRupiah(data.totalFinishedGoodsValue)}
                  </p>
                </div>
              </div>
              <ArrowRight
                size={14}
                className="text-stone-300 transition-colors group-hover:text-[#00C8DF]"
              />
            </Link>

            <Link
              href="/laporan/analisa/nilai-stok"
              className="group flex items-center justify-between rounded-lg border border-stone-200 p-4 transition-colors hover:border-[#00C8DF]/30 hover:bg-[#00C8DF]/[0.03]"
            >
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-indigo-50 p-2">
                  <Database size={16} className="text-indigo-600" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-stone-900">Nilai Stok</p>
                  <p className="text-[11px] text-stone-500">
                    Valuasi aset persediaan lengkap
                  </p>
                </div>
              </div>
              <ArrowRight
                size={14}
                className="text-stone-300 transition-colors group-hover:text-[#00C8DF]"
              />
            </Link>

            <Link
              href="/laporan/analisa/alur-kopi"
              className="group flex items-center justify-between rounded-lg border border-stone-200 p-4 transition-colors hover:border-[#00C8DF]/30 hover:bg-[#00C8DF]/[0.03]"
            >
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-neutral-50 p-2">
                  <Activity size={16} className="text-neutral-600" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-stone-900">Alur Kopi</p>
                  <p className="text-[11px] text-stone-500">
                    Dari bahan sampai produk jadi
                  </p>
                </div>
              </div>
              <ArrowRight
                size={14}
                className="text-stone-300 transition-colors group-hover:text-[#00C8DF]"
              />
            </Link>
          </div>
        </div>
      </div>
    </ReportLayout>
  );
}
