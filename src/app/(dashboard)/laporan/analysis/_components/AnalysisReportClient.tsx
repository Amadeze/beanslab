"use client";

import { useState, useEffect } from "react";
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Scale,
  Activity,
  ArrowRight,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import {
  ReportLayout,
  ReportKpiCard,
  ReportChart,
  ReportFilters,
  ReportExport,
  ReportSkeleton,
  type DateRange,
} from "../../_shared";
import { getPnLReport, type PnLReport } from "@/app/(dashboard)/keuangan/actions";
import {
  getBalanceSheetReport,
  getCoffeeFlowReport,
  getInventoryValuationReport,
  type BalanceSheetReport,
  type CoffeeFlowReport,
  type InventoryValuationReport,
} from "../../actions";
import { formatRupiah, formatKg } from "@/lib/format";
import { cn } from "@/lib/utils";

// P&L Section Component
function PnLSection({ data }: { data: PnLReport }) {
  const [expanded, setExpanded] = useState(true);

  return (
    <div className="rounded-xl border border-stone-200 bg-white">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between p-4 text-left"
      >
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-emerald-50 p-2">
            <DollarSign size={16} className="text-emerald-600" />
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-stone-500">
              Laba Rugi (P&L)
            </p>
            <p className="text-sm font-semibold text-stone-900">
              {data.month}/{data.year}
            </p>
          </div>
        </div>
        {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>

      {expanded && (
        <div className="border-t border-stone-100 p-4">
          {/* Revenue Section */}
          <div className="mb-6">
            <p className="mb-3 text-[10px] font-bold uppercase tracking-wider text-stone-400">
              Pendapatan
            </p>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-stone-600">Penjualan Bruto</span>
                <span className="font-medium">{formatRupiah(data.grossSales)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-stone-600">Diskon</span>
                <span className="text-red-600">-{formatRupiah(data.invoiceDiscount)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-stone-600">Pajak</span>
                <span className="text-red-600">-{formatRupiah(data.tax)}</span>
              </div>
              <div className="flex justify-between border-t border-stone-100 pt-2 text-sm font-semibold">
                <span>Pendapatan Bersih</span>
                <span>{formatRupiah(data.netSales)}</span>
              </div>
            </div>
          </div>

          {/* COGS Section */}
          <div className="mb-6">
            <p className="mb-3 text-[10px] font-bold uppercase tracking-wider text-stone-400">
              Harga Pokok Penjualan (COGS)
            </p>
            <div className="space-y-2">
              {data.cogsBreakdown.map((item) => (
                <div key={item.category} className="flex justify-between text-sm">
                  <span className="text-stone-600">{item.category}</span>
                  <span>{formatRupiah(item.amount)}</span>
                </div>
              ))}
              <div className="flex justify-between border-t border-stone-100 pt-2 text-sm font-semibold">
                <span>Total COGS</span>
                <span>{formatRupiah(data.cogs)}</span>
              </div>
            </div>
          </div>

          {/* Gross Profit */}
          <div className="mb-6 rounded-lg bg-emerald-50 p-3">
            <div className="flex justify-between text-sm font-semibold">
              <span className="text-emerald-800">Laba Kotor</span>
              <span className="text-emerald-700">{formatRupiah(data.grossProfit)}</span>
            </div>
            <p className="mt-1 text-[10px] text-emerald-600">
              Margin: {data.netSales > 0 ? ((data.grossProfit / data.netSales) * 100).toFixed(1) : 0}%
            </p>
          </div>

          {/* OPEX Section */}
          <div className="mb-6">
            <p className="mb-3 text-[10px] font-bold uppercase tracking-wider text-stone-400">
              Operasional (OPEX)
            </p>
            <div className="space-y-2">
              {data.opexBreakdown.map((item) => (
                <div key={item.category} className="flex justify-between text-sm">
                  <span className="text-stone-600">{item.category}</span>
                  <span>{formatRupiah(item.amount)}</span>
                </div>
              ))}
              <div className="flex justify-between border-t border-stone-100 pt-2 text-sm font-semibold">
                <span>Total OPEX</span>
                <span>{formatRupiah(data.opex)}</span>
              </div>
            </div>
          </div>

          {/* Net Profit */}
          <div className="rounded-lg bg-blue-50 p-3">
            <div className="flex justify-between text-sm font-semibold">
              <span className="text-blue-800">Laba Bersih</span>
              <span className="text-blue-700">{formatRupiah(data.netProfit)}</span>
            </div>
            <p className="mt-1 text-[10px] text-blue-600">
              Margin: {data.netSales > 0 ? ((data.netProfit / data.netSales) * 100).toFixed(1) : 0}%
            </p>
          </div>

          {/* Top Products & Customers */}
          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            <div>
              <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-stone-400">
                Top 5 Produk
              </p>
              <div className="space-y-1">
                {data.topProducts.slice(0, 5).map((item, i) => (
                  <div key={i} className="flex justify-between text-xs">
                    <span className="text-stone-600">{item.name}</span>
                    <span>{formatRupiah(item.revenue)}</span>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-stone-400">
                Top 5 Pelanggan
              </p>
              <div className="space-y-1">
                {data.topCustomers.slice(0, 5).map((item, i) => (
                  <div key={i} className="flex justify-between text-xs">
                    <span className="text-stone-600">{item.name}</span>
                    <span>{formatRupiah(item.revenue)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Balance Sheet Section Component
function BalanceSheetSection({ data }: { data: BalanceSheetReport }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-xl border border-stone-200 bg-white">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between p-4 text-left"
      >
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-blue-50 p-2">
            <Scale size={16} className="text-blue-600" />
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-stone-500">
              Neraca (Balance Sheet)
            </p>
            <p className="text-sm font-semibold text-stone-900">
              {new Date(data.asOf).toLocaleDateString("id-ID")}
            </p>
          </div>
        </div>
        {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>

      {expanded && (
        <div className="border-t border-stone-100 p-4">
          {/* Assets */}
          <div className="mb-6">
            <p className="mb-3 text-[10px] font-bold uppercase tracking-wider text-stone-400">
              Aset
            </p>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-stone-600">Kas & Bank</span>
                <span>{formatRupiah(data.assets.cashAndBank)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-stone-600">Piutang Usaha</span>
                <span>{formatRupiah(data.assets.accountsReceivable)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-stone-600">Persediaan</span>
                <span>{formatRupiah(data.assets.inventory)}</span>
              </div>
              <div className="flex justify-between border-t border-stone-100 pt-2 text-sm font-semibold">
                <span>Total Aset</span>
                <span>{formatRupiah(data.assets.totalAssets)}</span>
              </div>
            </div>
          </div>

          {/* Liabilities */}
          <div className="mb-6">
            <p className="mb-3 text-[10px] font-bold uppercase tracking-wider text-stone-400">
              Liabilitas
            </p>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-stone-600">Hutang Usaha</span>
                <span>{formatRupiah(data.liabilities.accountsPayable)}</span>
              </div>
              {/* Aging Buckets */}
              <div className="ml-4 space-y-1">
                <div className="flex justify-between text-xs text-stone-500">
                  <span>Current</span>
                  <span>{formatRupiah(data.liabilities.aging.current)}</span>
                </div>
                <div className="flex justify-between text-xs text-amber-600">
                  <span>Lewat 1-30 hari</span>
                  <span>{formatRupiah(data.liabilities.aging.overdue1To30)}</span>
                </div>
                <div className="flex justify-between text-xs text-orange-600">
                  <span>Lewat 31-60 hari</span>
                  <span>{formatRupiah(data.liabilities.aging.overdue31To60)}</span>
                </div>
                <div className="flex justify-between text-xs text-red-600">
                  <span>Lewat 60+ hari</span>
                  <span>{formatRupiah(data.liabilities.aging.overdue61Plus)}</span>
                </div>
              </div>
              <div className="flex justify-between border-t border-stone-100 pt-2 text-sm font-semibold">
                <span>Total Liabilitas</span>
                <span>{formatRupiah(data.liabilities.totalLiabilities)}</span>
              </div>
            </div>
          </div>

          {/* Equity */}
          <div>
            <p className="mb-3 text-[10px] font-bold uppercase tracking-wider text-stone-400">
              Ekuitas
            </p>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-stone-600">Modal Disetor</span>
                <span>{formatRupiah(data.equity.contributedCapital)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-stone-600">Laba Ditahan</span>
                <span>{formatRupiah(data.equity.retainedEarnings)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-stone-600">Laba Dibagikan</span>
                <span>{formatRupiah(data.equity.distributedProfit)}</span>
              </div>
              <div className="flex justify-between border-t border-stone-100 pt-2 text-sm font-semibold">
                <span>Total Ekuitas</span>
                <span>{formatRupiah(data.equity.totalEquity)}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Coffee Flow Section Component
function CoffeeFlowSection({ data }: { data: CoffeeFlowReport }) {
  const [expanded, setExpanded] = useState(false);

  // Aggregate data from arrays
  const totalGbBought = data.greenBeans.reduce((sum, gb) => sum + gb.boughtKg, 0);
  const totalGbRoasted = data.greenBeans.reduce((sum, gb) => sum + gb.roastedKg, 0);
  const totalGbStock = data.greenBeans.reduce((sum, gb) => sum + gb.currentStockKg, 0);

  const totalRbProduced = data.roastedBeans.reduce((sum, rb) => sum + rb.producedKg, 0);
  const totalRbLoss = data.roastedBeans.reduce((sum, rb) => sum + rb.roastLossKg, 0);
  const totalRbPackaged = data.roastedBeans.reduce((sum, rb) => sum + rb.packagedKg, 0);
  const totalRbSample = data.roastedBeans.reduce((sum, rb) => sum + rb.sampleOutKg, 0);
  const totalRbStock = data.roastedBeans.reduce((sum, rb) => sum + rb.currentStockKg, 0);

  const totalFgProduced = data.finishedGoods.reduce((sum, fg) => sum + fg.producedUnits, 0);
  const totalFgSold = data.finishedGoods.reduce((sum, fg) => sum + fg.soldUnits, 0);
  const totalFgSample = data.finishedGoods.reduce((sum, fg) => sum + fg.sampleOutUnits, 0);
  const totalFgStock = data.finishedGoods.reduce((sum, fg) => sum + fg.currentStockUnits, 0);
  const totalFgRevenue = data.finishedGoods.reduce((sum, fg) => sum + fg.salesRevenue, 0);
  const totalFgCogs = data.finishedGoods.reduce((sum, fg) => sum + fg.cogs, 0);

  return (
    <div className="rounded-xl border border-stone-200 bg-white">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between p-4 text-left"
      >
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-amber-50 p-2">
            <Activity size={16} className="text-amber-600" />
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-stone-500">
              Alur Kopi (Coffee Flow)
            </p>
            <p className="text-sm font-semibold text-stone-900">
              {data.periodStart || "Awal"} - {data.periodEnd}
            </p>
          </div>
        </div>
        {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>

      {expanded && (
        <div className="border-t border-stone-100 p-4">
          {/* Green Bean Flow */}
          <div className="mb-6">
            <p className="mb-3 text-[10px] font-bold uppercase tracking-wider text-stone-400">
              Green Bean
            </p>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-stone-600">Dibeli</span>
                <span>{formatKg(totalGbBought)} kg</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-stone-600">Di-roasting</span>
                <span>{formatKg(totalGbRoasted)} kg</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-stone-600">Stok Saat Ini</span>
                <span className="font-medium">{formatKg(totalGbStock)} kg</span>
              </div>
            </div>
          </div>

          {/* Roasted Bean Flow */}
          <div className="mb-6">
            <p className="mb-3 text-[10px] font-bold uppercase tracking-wider text-stone-400">
              Roasted Bean
            </p>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-stone-600">Dihasilkan</span>
                <span>{formatKg(totalRbProduced)} kg</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-stone-600">Roast Loss</span>
                <span className="text-amber-600">{formatKg(totalRbLoss)} kg</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-stone-600">Di-packaging</span>
                <span>{formatKg(totalRbPackaged)} kg</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-stone-600">Sample</span>
                <span>{formatKg(totalRbSample)} kg</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-stone-600">Stok Saat Ini</span>
                <span className="font-medium">{formatKg(totalRbStock)} kg</span>
              </div>
            </div>
          </div>

          {/* Finished Goods Flow */}
          <div>
            <p className="mb-3 text-[10px] font-bold uppercase tracking-wider text-stone-400">
              Produk Jadi
            </p>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-stone-600">Diproduksi</span>
                <span>{totalFgProduced} unit</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-stone-600">Terjual</span>
                <span>{totalFgSold} unit</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-stone-600">Sample</span>
                <span>{totalFgSample} unit</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-stone-600">Stok Saat Ini</span>
                <span className="font-medium">{totalFgStock} unit</span>
              </div>
              <div className="flex justify-between border-t border-stone-100 pt-2 text-sm font-semibold">
                <span>Revenue</span>
                <span>{formatRupiah(totalFgRevenue)}</span>
              </div>
              <div className="flex justify-between text-sm font-semibold">
                <span>COGS</span>
                <span>{formatRupiah(totalFgCogs)}</span>
              </div>
              <div className="flex justify-between text-sm font-semibold text-emerald-600">
                <span>Gross Profit</span>
                <span>{formatRupiah(totalFgRevenue - totalFgCogs)}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AnalysisReportClient() {
  const [dateRange, setDateRange] = useState<DateRange>({
    start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
    end: new Date().toISOString().split("T")[0],
  });
  const [pnlData, setPnlData] = useState<PnLReport | null>(null);
  const [balanceData, setBalanceData] = useState<BalanceSheetReport | null>(null);
  const [flowData, setFlowData] = useState<CoffeeFlowReport | null>(null);
  const [inventoryData, setInventoryData] = useState<InventoryValuationReport | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      try {
        const now = new Date();
        const startDate = new Date(dateRange.start);
        const endDate = new Date(dateRange.end);

        const [pnl, inventory] = await Promise.all([
          getPnLReport(now.getMonth() + 1, now.getFullYear()),
          getInventoryValuationReport(),
        ]);

        // Get balance sheet with inventory value
        const balance = await getBalanceSheetReport(inventory.grandTotalValue);

        // Get coffee flow
        const flow = await getCoffeeFlowReport(startDate, endDate);

        setPnlData(pnl);
        setBalanceData(balance);
        setFlowData(flow);
        setInventoryData(inventory);
      } catch (error) {
        console.error("Failed to fetch analysis data:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [dateRange]);

  if (loading || !pnlData || !balanceData || !flowData || !inventoryData) {
    return (
      <ReportLayout activeTab="analysis">
        <ReportSkeleton />
      </ReportLayout>
    );
  }

  return (
    <ReportLayout
      activeTab="analysis"
      actions={
        <ReportExport
          title="Analisis Mendalam"
          filename="analysis-report"
          columns={[
            { header: "Metrik", key: "metric" },
            { header: "Nilai", key: "value" },
          ]}
          data={[
            { metric: "Pendapatan Bersih", value: pnlData.netSales },
            { metric: "Laba Bersih", value: pnlData.netProfit },
            { metric: "Total Aset", value: balanceData.assets.totalAssets },
            { metric: "Total Liabilitas", value: balanceData.liabilities.totalLiabilities },
          ]}
        />
      }
    >
      <div className="space-y-6">
        <ReportFilters
          dateRange={dateRange}
          onDateRangeChange={setDateRange}
        />

        {/* Summary KPIs */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <ReportKpiCard
            label="Pendapatan Bersih"
            value={formatRupiah(pnlData.netSales)}
            icon={TrendingUp}
            color="emerald"
          />
          <ReportKpiCard
            label="Laba Bersih"
            value={formatRupiah(pnlData.netProfit)}
            icon={pnlData.netProfit > 0 ? TrendingUp : TrendingDown}
            color={pnlData.netProfit > 0 ? "emerald" : "rose"}
          />
          <ReportKpiCard
            label="Total Aset"
            value={formatRupiah(balanceData.assets.totalAssets)}
            icon={Scale}
            color="blue"
          />
          <ReportKpiCard
            label="Stok Value"
            value={formatRupiah(inventoryData.grandTotalValue)}
            icon={Activity}
            color="amber"
          />
        </div>

        {/* Charts */}
        <div className="grid gap-4 lg:grid-cols-2">
          <ReportChart
            title="Revenue Breakdown"
            type="pie"
            data={pnlData.revenueBreakdown.map((item) => ({
              name: item.category,
              value: item.amount,
            }))}
            xKey="name"
            yKey="value"
          />
          <ReportChart
            title="COGS Breakdown"
            type="pie"
            data={pnlData.cogsBreakdown.map((item) => ({
              name: item.category,
              value: item.amount,
            }))}
            xKey="name"
            yKey="value"
          />
        </div>

        {/* Detailed Sections */}
        <div className="space-y-4">
          <PnLSection data={pnlData} />
          <BalanceSheetSection data={balanceData} />
          <CoffeeFlowSection data={flowData} />
        </div>
      </div>
    </ReportLayout>
  );
}
