"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Package,
  AlertTriangle,
  BarChart3,
  ArrowRight,
  Flame,
  Factory,
  TrendingUp,
} from "lucide-react";
import {
  ReportLayout,
  ReportKpiCard,
  ReportChart,
  ReportFilters,
  ReportSkeleton,
  type DateRange,
} from "../../_shared";
import {
  getInventoryValuationReport,
  type InventoryValuationReport,
} from "../../actions";
import { formatRupiah } from "@/lib/format";

export default function InventoryOverviewClient() {
  const [dateRange, setDateRange] = useState<DateRange>({
    start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0],
    end: new Date().toISOString().split("T")[0],
  });
  const [data, setData] = useState<InventoryValuationReport | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      try {
        const result = await getInventoryValuationReport(new Date(dateRange.end));
        setData(result);
      } catch (error) {
        console.error("Failed to fetch inventory overview:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [dateRange]);

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
  ].filter((item) => item.value > 0);

  // Low stock items count
  const lowStockItems = data.items.filter((item) => item.stock < 100).length;

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
            subtitle="< 100 unit"
            icon={AlertTriangle}
            color="rose"
            inverse
          />
          <ReportKpiCard
            label="Sample Write-Off"
            value={data.totalSampleWriteOff}
            subtitle="item"
            icon={TrendingUp}
            color="amber"
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
          </div>
        </div>
      </div>
    </ReportLayout>
  );
}
