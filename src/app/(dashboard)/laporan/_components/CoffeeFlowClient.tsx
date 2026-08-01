"use client";

import { useState, useMemo } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { CoffeeFlowReport } from "../actions";
import { Package, Coffee, Box, ArrowRight, Search, Download, ChevronDown, ChevronUp, TrendingUp, TrendingDown, Droplets, Store } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { cn } from "@/lib/utils";

// =============================================================================
// CSV Export (keep existing)
// =============================================================================

function exportCoffeeFlowCSV(report: CoffeeFlowReport) {
  const rows: string[][] = [
    ["Laporan Arus Kopi"],
    [`Periode: ${report.periodStart ? new Date(report.periodStart).toLocaleDateString("id-ID") : "Awal"} - ${report.periodEnd ? new Date(report.periodEnd).toLocaleDateString("id-ID") : "Sekarang"}`],
    [],
    ["GREEN BEAN", "Beli (kg)", "Di-roast (kg)", "Opname Out (kg)", "Stok (kg)", "HPP Avg/kg"],
    ...report.greenBeans.map(gb => [
      gb.name, String(gb.boughtKg), String(gb.roastedKg), String(gb.adjustmentOutKg), String(gb.currentStockKg), String(gb.avgPurchasePrice)
    ]),
    [],
    ["ROASTED BEAN", "Produksi (kg)", "Susut (kg)", "Packaged (kg)", "Sample (kg)", "Opname Out (kg)", "Stok (kg)", "Nilai Susut"],
    ...report.roastedBeans.map(rb => [
      rb.name, String(rb.producedKg), String(rb.roastLossKg), String(rb.packagedKg), String(rb.sampleOutKg), String(rb.adjustmentOutKg), String(rb.currentStockKg), String(rb.roastLossValue)
    ]),
    [],
    ["FINISHED GOODS", "Produksi (unit)", "Terjual (unit)", "Sample (unit)", "Opname Out (unit)", "Stok (unit)", "Pendapatan", "HPP", "Laba Kotor"],
    ...report.finishedGoods.map(fg => [
      fg.name, String(fg.producedUnits), String(fg.soldUnits), String(fg.sampleOutUnits), String(fg.adjustmentOutUnits), String(fg.currentStockUnits), String(fg.salesRevenue), String(fg.cogs), String(fg.grossProfit)
    ]),
  ];
  const csvContent = "data:text/csv;charset=utf-8," + rows.map(r => r.join(",")).join("\n");
  const link = document.createElement("a");
  link.setAttribute("href", encodeURI(csvContent));
  link.setAttribute("download", `Arus_Kopi_${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// =============================================================================
// Flow Pipeline — Horizontal visual
// =============================================================================

function FlowPipeline({ report, onStageClick }: { report: CoffeeFlowReport; onStageClick: (stage: string) => void }) {
  const totalGBBought = report.greenBeans.reduce((s, g) => s + g.boughtKg, 0);
  const totalGBRoasted = report.greenBeans.reduce((s, g) => s + g.roastedKg, 0);
  const totalRBProduced = report.roastedBeans.reduce((s, r) => s + r.producedKg, 0);
  const totalRBLoss = report.roastedBeans.reduce((s, r) => s + r.roastLossKg, 0);
  const totalFGProduced = report.finishedGoods.reduce((s, f) => s + f.producedUnits, 0);
  const totalFGSold = report.finishedGoods.reduce((s, f) => s + f.soldUnits, 0);
  const totalRevenue = report.finishedGoods.reduce((s, f) => s + f.salesRevenue, 0);
  const totalCOGS = report.finishedGoods.reduce((s, f) => s + f.cogs, 0);
  const totalGBStock = report.greenBeans.reduce((s, g) => s + g.currentStockKg, 0);
  const totalRBStock = report.roastedBeans.reduce((s, r) => s + r.currentStockKg, 0);
  const totalFGStock = report.finishedGoods.reduce((s, f) => s + f.currentStockUnits, 0);

  const rbYield = totalGBRoasted > 0 ? ((totalRBProduced / totalGBRoasted) * 100) : 0;
  const grossMargin = totalRevenue > 0 ? ((totalRevenue - totalCOGS) / totalRevenue * 100) : 0;

  const stages = [
    {
      id: "gb", label: "Green Bean", sub: "Kopi Mentah", icon: Package,
      color: "emerald", metric: `${totalGBBought.toLocaleString("id-ID")} kg`,
      subMetric: `Harga Rata-rata`, value: totalGBBought > 0 ? `Rp ${Math.round(report.greenBeans.reduce((s, g) => s + g.avgPurchasePrice * g.boughtKg, 0) / totalGBBought).toLocaleString("id-ID")}/kg` : "-",
      stock: `${totalGBStock.toLocaleString("id-ID")} kg di gudang`,
    },
    {
      id: "rb", label: "Roasted Bean", sub: "Kopi Sangrai", icon: Coffee,
      color: "amber", metric: `${totalRBProduced.toLocaleString("id-ID")} kg`,
      subMetric: `Yield ${rbYield.toFixed(0)}%`, value: `Susut ${totalRBLoss.toLocaleString("id-ID")} kg`,
      stock: `${totalRBStock.toLocaleString("id-ID")} kg di gudang`,
    },
    {
      id: "fg", label: "Produk Jadi", sub: "Finished Goods", icon: Box,
      color: "violet", metric: `${totalFGProduced.toLocaleString("id-ID")} unit`,
      subMetric: `Terjual ${totalFGSold.toLocaleString("id-ID")} unit`, value: `Revenue Rp ${totalRevenue.toLocaleString("id-ID")}`,
      stock: `${totalFGStock.toLocaleString("id-ID")} unit di gudang`,
    },
    {
      id: "sales", label: "Penjualan", sub: "Revenue", icon: Store,
      color: "blue", metric: `Rp ${totalRevenue.toLocaleString("id-ID")}`,
      subMetric: `Margin ${grossMargin.toFixed(1)}%`, value: `Laba Rp ${(totalRevenue - totalCOGS).toLocaleString("id-ID")}`,
      stock: `COGS Rp ${totalCOGS.toLocaleString("id-ID")}`,
    },
  ];

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-100">
        <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500">Alur Arus Kopi</h3>
      </div>
      <div className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          {stages.map((stage, i) => {
            const Icon = stage.icon;
            return (
              <div key={stage.id} className="flex items-stretch">
                <button
                  onClick={() => onStageClick(stage.id)}
                  className={cn(
                    "flex-1 text-left p-4 rounded-xl border-2 transition-all hover:shadow-md cursor-pointer group",
                    `border-${stage.color}-200 bg-${stage.color}-50/50 hover:bg-${stage.color}-50`,
                  )}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center", `bg-${stage.color}-100`)}>
                      <Icon size={16} className={`text-${stage.color}-600`} />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-800">{stage.label}</p>
                      <p className="text-xs text-slate-500">{stage.sub}</p>
                    </div>
                  </div>
                  <p className={cn("text-2xl font-black tabular-nums", `text-${stage.color}-700`)}>{stage.metric}</p>
                  <p className={cn("text-xs font-semibold mt-1", `text-${stage.color}-600`)}>{stage.subMetric}</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">{stage.value}</p>
                  <p className="text-xs text-slate-400 mt-2 border-t border-slate-200/50 pt-2">{stage.stock}</p>
                </button>
                {i < stages.length - 1 && (
                  <div className="hidden md:flex items-center px-1">
                    <div className="w-6 h-0.5 bg-gradient-to-r from-slate-300 to-slate-200" />
                    <ArrowRight size={14} className="text-slate-300 -ml-1" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// Conversion Funnel
// =============================================================================

function ConversionFunnel({ report }: { report: CoffeeFlowReport }) {
  const totalGBRoasted = report.greenBeans.reduce((s, g) => s + g.roastedKg, 0);
  const totalRB = report.roastedBeans.reduce((s, r) => s + r.producedKg, 0);
  const totalSold = report.finishedGoods.reduce((s, f) => s + f.soldEquivalentKg, 0);
  const totalRevenue = report.finishedGoods.reduce((s, f) => s + f.salesRevenue, 0);
  const totalCOGS = report.finishedGoods.reduce((s, f) => s + f.cogs, 0);

  const rbPct = totalGBRoasted > 0 ? (totalRB / totalGBRoasted) * 100 : 0;
  const soldPct = totalRB > 0 ? (totalSold / totalRB) * 100 : 0;
  const marginPct = totalRevenue > 0 ? ((totalRevenue - totalCOGS) / totalRevenue) * 100 : 0;

  const steps = [
    { label: "Green Bean di-roast", kg: totalGBRoasted, pct: 100, color: "bg-emerald-500" },
    { label: "Jadi Roasted Bean", kg: totalRB, pct: rbPct, color: "bg-amber-500" },
    { label: "Terjual ke Pelanggan", kg: totalSold, pct: soldPct, color: "bg-violet-500" },
  ];

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
        <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500">Konversi & Margin</h3>
        <span className={cn("text-xs font-bold px-2 py-0.5 rounded-full", marginPct >= 30 ? "bg-emerald-100 text-emerald-700" : marginPct >= 10 ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700")}>
          Margin {marginPct.toFixed(1)}%
        </span>
      </div>
      <div className="p-6 space-y-4">
        {steps.map((step, i) => (
          <div key={i} className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-700">{step.label}</span>
              <span className="font-bold text-slate-800">{step.kg.toLocaleString("id-ID", { maximumFractionDigits: 1 })} kg ({step.pct.toFixed(0)}%)</span>
            </div>
            <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
              <div className={cn("h-full rounded-full transition-all duration-700", step.color)} style={{ width: `${Math.min(step.pct, 100)}%` }} />
            </div>
          </div>
        ))}
        <div className="pt-3 border-t border-slate-100 grid grid-cols-3 gap-4 text-center">
          <div>
            <p className="text-xs font-bold uppercase text-slate-400">Revenue</p>
            <p className="text-sm font-black text-slate-800">Rp {totalRevenue.toLocaleString("id-ID")}</p>
          </div>
          <div>
            <p className="text-xs font-bold uppercase text-slate-400">COGS</p>
            <p className="text-sm font-black text-slate-800">Rp {totalCOGS.toLocaleString("id-ID")}</p>
          </div>
          <div>
            <p className="text-xs font-bold uppercase text-slate-400">Laba Kotor</p>
            <p className={cn("text-sm font-black", totalRevenue - totalCOGS >= 0 ? "text-emerald-600" : "text-red-600")}>
              Rp {(totalRevenue - totalCOGS).toLocaleString("id-ID")}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// Stage Detail Card (expandable)
// =============================================================================

function StageDetailCard({ title, icon: Icon, color, children, defaultOpen = false }: {
  title: string; icon: React.ElementType; color: string; children: React.ReactNode; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={cn("rounded-2xl border shadow-sm overflow-hidden bg-white", `border-${color}-200`)}>
      <button onClick={() => setOpen(!open)} className={cn("w-full flex items-center justify-between p-4 transition-colors", `bg-${color}-50/50 hover:bg-${color}-50`)}>
        <div className="flex items-center gap-3">
          <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", `bg-${color}-100`)}>
            <Icon size={20} className={`text-${color}-600`} />
          </div>
          <h3 className={cn("text-base font-bold", `text-${color}-900`)}>{title}</h3>
        </div>
        {open ? <ChevronUp size={18} className="text-slate-400" /> : <ChevronDown size={18} className="text-slate-400" />}
      </button>
      {open && <div className="p-0">{children}</div>}
    </div>
  );
}

// =============================================================================
// GB Chart
// =============================================================================

function GBChart({ data }: { data: { name: string; value: number }[] }) {
  if (data.length === 0) return null;
  return (
    <ResponsiveContainer width="100%" height={120}>
      <BarChart data={data} layout="vertical" margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
        <XAxis type="number" hide />
        <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 11, fill: "#64748b" }} />
        <Tooltip formatter={(v) => `${Number(v).toLocaleString("id-ID")} kg`} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
        <Bar dataKey="value" radius={[0, 4, 4, 0]}>
          {data.map((_, i) => <Cell key={i} fill={i % 2 === 0 ? "#2B7567" : "#B65331"} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

// =============================================================================
// Main Component
// =============================================================================

export function CoffeeFlowClient({ report }: { report: CoffeeFlowReport }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeStage, setActiveStage] = useState<string | null>(null);

  const filteredGB = useMemo(() => report.greenBeans.filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase())), [report.greenBeans, searchQuery]);
  const filteredRB = useMemo(() => report.roastedBeans.filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase())), [report.roastedBeans, searchQuery]);
  const filteredFG = useMemo(() => report.finishedGoods.filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase())), [report.finishedGoods, searchQuery]);

  const gbChartData = useMemo(() => report.greenBeans.filter(g => g.boughtKg > 0).map(g => ({ name: g.name.length > 20 ? g.name.slice(0, 20) + "…" : g.name, value: g.boughtKg })), [report.greenBeans]);

  return (
    <div className="space-y-6">

      {/* SEARCH & EXPORT */}
      <div className="flex flex-col md:flex-row gap-3 justify-between items-start md:items-center">
        <div className="relative w-full md:w-72">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            className="w-full pl-10 pr-3 py-2 border border-slate-200 rounded-xl bg-white text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all"
            placeholder="Cari nama kopi..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <Button onClick={() => exportCoffeeFlowCSV(report)} variant="outline" className="h-9 gap-1.5">
          <Download size={14} /> Export CSV
        </Button>
      </div>

      {/* FLOW PIPELINE */}
      <FlowPipeline report={report} onStageClick={(id) => setActiveStage(activeStage === id ? null : id)} />

      {/* CONVERSION FUNNEL */}
      <ConversionFunnel report={report} />

      {/* STAGE DETAILS */}
      <div className="space-y-4">
        {/* GREEN BEAN TABLE */}
        <StageDetailCard title="Detail Green Bean" icon={Package} color="emerald" defaultOpen={activeStage === "gb"}>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-0">
            <div className="lg:col-span-2 overflow-x-auto">
              <Table>
                <TableHeader className="bg-emerald-50/30">
                  <TableRow>
                    <TableHead className="font-semibold text-emerald-900">Produk</TableHead>
                    <TableHead className="text-right font-semibold text-emerald-900">Dibeli</TableHead>
                    <TableHead className="text-right font-semibold text-emerald-900">Harga/kg</TableHead>
                    <TableHead className="text-right font-semibold text-emerald-900">Di-roast</TableHead>
                    <TableHead className="text-right font-semibold text-emerald-900">Opname</TableHead>
                    <TableHead className="text-right font-semibold text-emerald-900 bg-emerald-50/50">Stok</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredGB.length === 0 && (
                    <TableRow><TableCell colSpan={6} className="text-center text-slate-400 py-8">Belum ada data</TableCell></TableRow>
                  )}
                  {filteredGB.map(gb => (
                    <TableRow key={gb.id} className="hover:bg-emerald-50/20">
                      <TableCell className="font-medium text-slate-700">{gb.name}</TableCell>
                      <TableCell className="text-right text-emerald-700 font-medium">+{gb.boughtKg.toLocaleString("id-ID")} kg</TableCell>
                      <TableCell className="text-right text-slate-600 text-xs">{gb.avgPurchasePrice > 0 ? `Rp ${gb.avgPurchasePrice.toLocaleString("id-ID")}` : "-"}</TableCell>
                      <TableCell className="text-right text-orange-600">-{gb.roastedKg.toLocaleString("id-ID")} kg</TableCell>
                      <TableCell className="text-right text-red-500">{gb.adjustmentOutKg > 0 ? `-${gb.adjustmentOutKg.toLocaleString("id-ID")} kg` : "-"}</TableCell>
                      <TableCell className="text-right font-bold text-slate-800 bg-emerald-50/30">{gb.currentStockKg.toLocaleString("id-ID")} kg</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <div className="border-l border-slate-100 p-4">
              <p className="text-xs font-bold uppercase text-slate-400 mb-2">Top GB Dibeli</p>
              <GBChart data={gbChartData} />
            </div>
          </div>
        </StageDetailCard>

        {/* ROASTED BEAN TABLE */}
        <StageDetailCard title="Detail Roasted Bean" icon={Coffee} color="amber" defaultOpen={activeStage === "rb"}>
          <Table>
            <TableHeader className="bg-amber-50/30">
              <TableRow>
                <TableHead className="font-semibold text-amber-900">Produk</TableHead>
                <TableHead className="text-right font-semibold text-amber-900">Hasil Roasting</TableHead>
                <TableHead className="text-right font-semibold text-amber-900">Susut (Loss)</TableHead>
                <TableHead className="text-right font-semibold text-amber-900">Rugi Susut</TableHead>
                <TableHead className="text-right font-semibold text-amber-900">Masuk Produksi</TableHead>
                <TableHead className="text-right font-semibold text-amber-900">Sample</TableHead>
                <TableHead className="text-right font-semibold text-amber-900">Opname</TableHead>
                <TableHead className="text-right font-semibold text-amber-900 bg-amber-50/50">Stok</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRB.length === 0 && (
                <TableRow><TableCell colSpan={8} className="text-center text-slate-400 py-8">Belum ada data</TableCell></TableRow>
              )}
              {filteredRB.map(rb => {
                const inputKg = rb.producedKg + rb.roastLossKg;
                const lossPct = inputKg > 0 ? (rb.roastLossKg / inputKg) * 100 : 0;
                return (
                  <TableRow key={rb.id} className="hover:bg-amber-50/20">
                    <TableCell className="font-medium text-slate-700">{rb.name}</TableCell>
                    <TableCell className="text-right text-emerald-700 font-medium">+{rb.producedKg.toLocaleString("id-ID", { maximumFractionDigits: 2 })} kg</TableCell>
                    <TableCell className="text-right text-red-500">
                      {rb.roastLossKg > 0 ? (
                        <span>-{rb.roastLossKg.toLocaleString("id-ID", { maximumFractionDigits: 2 })} kg <span className="text-xs opacity-70">({lossPct.toFixed(1)}%)</span></span>
                      ) : "-"}
                    </TableCell>
                    <TableCell className="text-right text-red-600 text-xs font-medium">
                      {rb.roastLossValue > 0 ? `-Rp ${rb.roastLossValue.toLocaleString("id-ID", { maximumFractionDigits: 0 })}` : "-"}
                    </TableCell>
                    <TableCell className="text-right text-orange-600">-{rb.packagedKg.toLocaleString("id-ID", { maximumFractionDigits: 2 })} kg</TableCell>
                    <TableCell className="text-right text-domain-sales">{rb.sampleOutKg > 0 ? `-${rb.sampleOutKg.toLocaleString("id-ID", { maximumFractionDigits: 3 })} kg` : "-"}</TableCell>
                    <TableCell className="text-right text-red-500">{rb.adjustmentOutKg > 0 ? `-${rb.adjustmentOutKg.toLocaleString("id-ID")} kg` : "-"}</TableCell>
                    <TableCell className="text-right font-bold text-slate-800 bg-amber-50/30">{rb.currentStockKg.toLocaleString("id-ID", { maximumFractionDigits: 2 })} kg</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </StageDetailCard>

        {/* FINISHED GOODS TABLE */}
        <StageDetailCard title="Detail Produk Jadi" icon={Box} color="violet" defaultOpen={activeStage === "fg" || activeStage === "sales"}>
          <Table>
            <TableHeader className="bg-violet-50/30">
              <TableRow>
                <TableHead className="font-semibold text-violet-900">Produk</TableHead>
                <TableHead className="text-right font-semibold text-violet-900">Diproduksi</TableHead>
                <TableHead className="text-right font-semibold text-violet-900">Terjual</TableHead>
                <TableHead className="text-right font-semibold text-violet-900">Sample</TableHead>
                <TableHead className="text-right font-semibold text-violet-900">Revenue</TableHead>
                <TableHead className="text-right font-semibold text-violet-900">Laba Kotor</TableHead>
                <TableHead className="text-right font-semibold text-violet-900">Opname</TableHead>
                <TableHead className="text-right font-semibold text-violet-900 bg-violet-50/50">Stok</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredFG.length === 0 && (
                <TableRow><TableCell colSpan={8} className="text-center text-slate-400 py-8">Belum ada data</TableCell></TableRow>
              )}
              {filteredFG.map(fg => (
                <TableRow key={fg.id} className="hover:bg-violet-50/20">
                  <TableCell className="font-medium text-slate-700">
                    <div>{fg.name}</div>
                    <div className="text-xs text-slate-400">{fg.weightPerUnitGrams}g/unit</div>
                  </TableCell>
                  <TableCell className="text-right text-emerald-700 font-medium">+{fg.producedUnits.toLocaleString("id-ID")}</TableCell>
                  <TableCell className="text-right text-indigo-700 font-medium">-{fg.soldUnits.toLocaleString("id-ID")}</TableCell>
                  <TableCell className="text-right text-domain-sales">{fg.sampleOutUnits > 0 ? `-${fg.sampleOutUnits}` : "-"}</TableCell>
                  <TableCell className="text-right text-slate-700 text-xs font-medium">Rp {fg.salesRevenue.toLocaleString("id-ID")}</TableCell>
                  <TableCell className="text-right">
                    <span className={cn("text-xs font-bold", fg.grossProfit >= 0 ? "text-emerald-600" : "text-red-600")}>
                      {fg.grossProfit >= 0 ? "+" : "-"}Rp {Math.abs(fg.grossProfit).toLocaleString("id-ID", { maximumFractionDigits: 0 })}
                    </span>
                  </TableCell>
                  <TableCell className="text-right text-red-500">{fg.adjustmentOutUnits > 0 ? `-${fg.adjustmentOutUnits}` : "-"}</TableCell>
                  <TableCell className="text-right font-bold text-slate-800 bg-violet-50/30">{fg.currentStockUnits.toLocaleString("id-ID")} unit</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </StageDetailCard>
      </div>
    </div>
  );
}
