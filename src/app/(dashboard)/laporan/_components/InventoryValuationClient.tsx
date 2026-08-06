"use client";

import { formatRupiah, formatDate } from "@/lib/format";
import { GlassPanel } from "@/components/ui/glass-panel";
import type { InventoryValuationReport } from "../actions";
import { Package, Download, Database, Boxes, Coffee, TrendingUp, FileText, FileSpreadsheet, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { PieChart, Pie, Cell, Tooltip as RechartsTooltip, ResponsiveContainer, Legend } from "recharts";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getCurrentDate } from "@/lib/date-utils";
import { PageHeader } from "@/components/layout/PageHeader";
import { useState } from "react";
import { exportToProfessionalPdf, exportToProfessionalExcel } from "@/lib/export-utils";

const CATEGORY_MAP: Record<string, { label: string, icon: React.ReactNode }> = {
  GREEN_BEAN: { label: "Green Bean", icon: <Database size={16} /> },
  ROASTED_BEAN: { label: "Roasted Bean", icon: <Coffee size={16} /> },
  FINISHED_GOODS: { label: "Produk Jadi", icon: <Package size={16} /> },
  PACKAGING: { label: "Kemasan", icon: <Boxes size={16} /> },
  SUPPLY: { label: "Non-Kopi", icon: <Database size={16} /> },
};

function getExportConfig(report: InventoryValuationReport) {
  type RowType = typeof report.items[0];
  return {
    title: "Laporan Valuasi Persediaan",
    filename: `Valuasi_Persediaan_${getCurrentDate().toISOString().slice(0,10)}`,
    sheetName: "Valuasi",
    columns: [
      { header: "Nama Aset", accessor: (row: RowType) => row.name, align: "left" as const },
      { header: "Kategori", accessor: (row: RowType) => CATEGORY_MAP[row.category]?.label || row.category, align: "left" as const },
      { header: "Stok", accessor: (row: RowType) => `${row.stock} ${row.unit}`, align: "right" as const },
      { header: "HPP / Unit", accessor: (row: RowType) => formatRupiah(row.unitCost), align: "right" as const },
      { header: "Total Nilai HPP", accessor: (row: RowType) => formatRupiah(row.totalValue), align: "right" as const }
    ],
    data: report.items,
    subtitle: `roastd.id - ${formatDate(report.asOf)}`,
    summary: [
      { label: "Metode Biaya", value: "Rata-rata tertimbang" },
      { label: "Total Green Bean", value: formatRupiah(report.totalGreenBeanValue) },
      { label: "Total Roasted Bean", value: formatRupiah(report.totalRoastedBeanValue) },
      { label: "Total Produk Jadi", value: formatRupiah(report.totalFinishedGoodsValue) },
      { label: "Total Kemasan", value: formatRupiah(report.totalPackagingValue) },
      { label: "Total Non-Kopi", value: formatRupiah(report.totalSupplyValue) },
      { label: "TOTAL VALUASI", value: formatRupiah(report.grandTotalValue) }
    ],
    generatedBy: "Roastd Studio",
    status: "DRAFT" as const,
  };
}

interface InventoryValuationClientProps {
  report: InventoryValuationReport;
  hideLayout?: boolean;
}

export function InventoryValuationClient({ report, hideLayout }: InventoryValuationClientProps) {
  const [exporting, setExporting] = useState<"pdf" | "excel" | null>(null);

  const doExportPdf = async () => {
    try {
      setExporting("pdf");
      await exportToProfessionalPdf(getExportConfig(report));
    } finally {
      setExporting(null);
    }
  };

  const doExportExcel = async () => {
    try {
      setExporting("excel");
      await exportToProfessionalExcel(getExportConfig(report));
    } finally {
      setExporting(null);
    }
  };

  const chartColors = ["#2B7567", "#A66F12", "#B65331", "#6F4A6A", "#7C6A9E"];
  const chartData = [
    { name: "Green Bean", value: report.totalGreenBeanValue },
    { name: "Roasted Bean", value: report.totalRoastedBeanValue },
    { name: "Produk Jadi", value: report.totalFinishedGoodsValue },
    { name: "Kemasan", value: report.totalPackagingValue },
    { name: "Non-Kopi", value: report.totalSupplyValue },
  ].filter(d => d.value > 0);

  const content = (
    <>
      <div className={`mb-4 rounded-2xl border px-4 py-3 text-xs ${report.zeroCostItemCount > 0 ? "border-amber-200 bg-amber-50 text-amber-800" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}>
        <strong>Basis laporan:</strong> ledger hingga {new Date(report.asOf).toLocaleString("id-ID")} · biaya rata-rata tertimbang.
        {report.zeroCostItemCount > 0 && ` ${report.zeroCostItemCount} item masih memiliki biaya nol dan perlu dilengkapi.`}
      </div>
      {/* KPI Cards */}
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-6">
        <div className="col-span-2 lg:col-span-1 rounded-2xl border border-white/60 bg-gradient-to-br from-indigo-50 to-blue-50 p-4 shadow-sm backdrop-blur-sm">
          <p className="text-xs font-medium text-indigo-500">Total Valuasi Aset</p>
          <p className="mt-1 font-mono text-xl font-black tabular-nums text-indigo-700">{formatRupiah(report.grandTotalValue)}</p>
        </div>
        <div className="col-span-2 lg:col-span-1 rounded-2xl border border-white/60 bg-gradient-to-br from-fuchsia-50 to-pink-50 p-4 shadow-sm backdrop-blur-sm relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-3 opacity-20 group-hover:opacity-30 transition-opacity"><TrendingUp size={48} className="text-fuchsia-600" /></div>
          <p className="text-xs font-medium text-fuchsia-600 relative z-10">Potensi Laba Kotor (Retail)</p>
          <p className="mt-1 font-mono text-lg font-black tabular-nums text-fuchsia-700 relative z-10">{report.totalMarginHealth.toFixed(1)}%</p>
          <p className="text-xs text-fuchsia-600 mt-1 relative z-10">dari {formatRupiah(report.totalPotentialRevenue)}</p>
        </div>
        <div className="rounded-2xl border border-white/60 bg-emerald-50 p-4 shadow-sm">
          <p className="text-xs font-medium text-emerald-600">Green Bean</p>
          <p className="mt-1 font-mono text-lg font-black tabular-nums text-emerald-700">{formatRupiah(report.totalGreenBeanValue)}</p>
        </div>
        <div className="rounded-2xl border border-white/60 bg-amber-50 p-4 shadow-sm">
          <p className="text-xs font-medium text-amber-600">Roasted Bean</p>
          <p className="mt-1 font-mono text-lg font-black tabular-nums text-amber-700">{formatRupiah(report.totalRoastedBeanValue)}</p>
        </div>
        <div className="rounded-2xl border border-white/60 bg-blue-50 p-4 shadow-sm">
          <p className="text-xs font-medium text-amber-800">Produk Jadi</p>
          <p className="mt-1 font-mono text-lg font-black tabular-nums text-amber-800">{formatRupiah(report.totalFinishedGoodsValue)}</p>
        </div>
        <div className="rounded-2xl border border-white/60 bg-violet-50 p-4 shadow-sm">
          <p className="text-xs font-medium text-violet-600">Kemasan</p>
          <p className="mt-1 font-mono text-lg font-black tabular-nums text-violet-700">{formatRupiah(report.totalPackagingValue)}</p>
        </div>
        <div className="rounded-2xl border border-white/60 bg-purple-50 p-4 shadow-sm">
          <p className="text-xs font-medium text-purple-600">Persediaan Non-Kopi</p>
          <p className="mt-1 font-mono text-lg font-black tabular-nums text-purple-700">{formatRupiah(report.totalSupplyValue)}</p>
        </div>
        {report.totalSampleWriteOff > 0 && (
          <div className="rounded-2xl border border-violet-200 bg-gradient-to-br from-violet-50 to-purple-50 p-4 shadow-sm">
            <p className="text-xs font-medium text-violet-600">Sample (Write-off)</p>
            <p className="mt-1 font-mono text-lg font-black tabular-nums text-violet-700">{formatRupiah(report.totalSampleWriteOff)}</p>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Pie Chart */}
        <div className="rounded-2xl border border-white/60 bg-white/40 p-5 shadow-sm backdrop-blur-md flex flex-col min-h-[300px]">
          <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wide mb-4">Distribusi Aset</h3>
          <div className="flex-1 min-h-0">
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={70}
                    outerRadius={90}
                    paddingAngle={3}
                  >
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={chartColors[index % chartColors.length]} />
                    ))}
                  </Pie>
                  <RechartsTooltip formatter={(value: any) => formatRupiah(Number(value))} />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: '12px' }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-400 text-sm">Belum ada aset persediaan</div>
            )}
          </div>
        </div>

        {/* Table */}
        <div className="col-span-1 lg:col-span-2 rounded-2xl border border-white/60 bg-white/60 shadow-sm backdrop-blur-xl overflow-hidden flex flex-col min-h-[300px]">
          <div className="border-b border-white/60 bg-white/40 px-5 py-3">
             <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wide">Rincian Persediaan</h3>
          </div>
          <div className="overflow-x-auto p-4 flex-1">
             <Table>
                <TableHeader>
                   <TableRow className="border-white/40 hover:bg-transparent">
                      <TableHead className="font-bold text-slate-500">Nama Aset</TableHead>
                      <TableHead className="font-bold text-slate-500">Kategori</TableHead>
                      <TableHead className="text-right font-bold text-slate-500">Stok</TableHead>
                      <TableHead className="text-right font-bold text-slate-500">HPP / Unit</TableHead>
                      <TableHead className="text-right font-bold text-slate-500">Total Nilai HPP</TableHead>
                      <TableHead className="text-right font-bold text-violet-600">Sample (Write-off)</TableHead>
                   </TableRow>
                </TableHeader>
                <TableBody>
                   {report.items.length === 0 ? (
                     <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-slate-400">Belum ada persediaan di gudang</TableCell>
                     </TableRow>
                   ) : (
                     report.items.map((item) => (
                       <TableRow key={item.id} className="border-white/40 hover:bg-white/40">
                          <TableCell className="font-semibold text-slate-700">{item.name}</TableCell>
                          <TableCell>
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider text-slate-600">
                               {CATEGORY_MAP[item.category]?.icon}
                               {CATEGORY_MAP[item.category]?.label || item.category}
                            </span>
                          </TableCell>
                          <TableCell className="text-right font-mono text-sm font-medium text-slate-600">
                            {item.stock} <span className="text-xs text-slate-400">{item.unit}</span>
                          </TableCell>
                          <TableCell className="text-right font-mono text-sm text-slate-600">
                            {formatRupiah(item.unitCost)}
                          </TableCell>
                          <TableCell className="text-right font-mono text-sm font-bold text-slate-800">
                            {formatRupiah(item.totalValue)}
                          </TableCell>
                          <TableCell className="text-right font-mono text-sm text-violet-600">
                            {item.sampleWriteOff > 0 ? formatRupiah(item.sampleWriteOff) : "\u2014"}
                          </TableCell>
                       </TableRow>
                     ))
                   )}
                </TableBody>
             </Table>
          </div>
        </div>
        
        {/* Finished Goods & Roasted Bean Analysis Table */}
        <div className="col-span-1 lg:col-span-3 mt-2 rounded-2xl border border-fuchsia-100/60 bg-gradient-to-br from-white/60 to-fuchsia-50/30 shadow-sm backdrop-blur-xl overflow-hidden flex flex-col">
          <div className="border-b border-fuchsia-100/60 bg-fuchsia-50/40 px-5 py-3 flex items-center gap-2">
             <TrendingUp size={16} className="text-fuchsia-600" />
             <h3 className="text-sm font-bold text-fuchsia-800 uppercase tracking-wide">Analisis Margin & Potensi Pendapatan (Roasted Bean & Produk Jadi)</h3>
          </div>
          <div className="overflow-x-auto p-4 flex-1">
             <Table>
                <TableHeader>
                   <TableRow className="border-fuchsia-100/40 hover:bg-transparent">
                      <TableHead className="font-bold text-fuchsia-900/70">Nama Produk</TableHead>
                      <TableHead className="text-right font-bold text-fuchsia-900/70">Stok Siap Jual</TableHead>
                      <TableHead className="text-right font-bold text-fuchsia-900/70">HPP / Unit</TableHead>
                      <TableHead className="text-right font-bold text-fuchsia-900/70">Harga Ritel</TableHead>
                      <TableHead className="text-right font-bold text-fuchsia-900/70">Estimasi Laba Kotor</TableHead>
                      <TableHead className="text-right font-bold text-fuchsia-900/70">Margin (%)</TableHead>
                      <TableHead className="text-right font-bold text-fuchsia-900/70 bg-fuchsia-100/50">Potensi Pendapatan</TableHead>
                   </TableRow>
                </TableHeader>
                <TableBody>
                   {report.items.filter(i => i.category === "FINISHED_GOODS" || i.category === "ROASTED_BEAN").length === 0 ? (
                     <TableRow>
                        <TableCell colSpan={7} className="text-center py-8 text-slate-400">Belum ada persediaan produk jadi / roasted bean di gudang</TableCell>
                     </TableRow>
                   ) : (
                     report.items.filter(i => i.category === "FINISHED_GOODS" || i.category === "ROASTED_BEAN").map((item) => {
                       const retail = item.retailPrice || 0;
                       const hasRetail = retail > 0;
                       const labaKotor = hasRetail ? retail - item.unitCost : null;
                       const margin = hasRetail ? (labaKotor! / retail) * 100 : null;
                       return (
                         <TableRow key={`fg-${item.id}`} className="border-fuchsia-100/40 hover:bg-white/40">
                            <TableCell className="font-semibold text-slate-700">{item.name}</TableCell>
                            <TableCell className="text-right font-mono text-sm font-medium text-slate-600">
                              {item.stock} <span className="text-xs text-slate-400">{item.unit}</span>
                            </TableCell>
                            <TableCell className="text-right font-mono text-sm text-slate-500">
                              {formatRupiah(item.unitCost)}
                            </TableCell>
                            <TableCell className="text-right font-mono text-sm text-slate-800">
                              {hasRetail ? formatRupiah(retail) : <span className="text-slate-300">–</span>}
                            </TableCell>
                            <TableCell className="text-right font-mono text-sm font-medium text-emerald-600">
                              {labaKotor !== null ? formatRupiah(labaKotor) : <span className="text-slate-300">–</span>}
                            </TableCell>
                            <TableCell className="text-right font-mono text-sm font-bold text-emerald-600">
                              {margin !== null ? `${margin.toFixed(1)}%` : <span className="text-slate-300">–</span>}
                            </TableCell>
                            <TableCell className="text-right font-mono text-sm font-bold text-fuchsia-700 bg-fuchsia-50/50">
                              {hasRetail ? formatRupiah(item.potentialRevenue || 0) : <span className="text-slate-300">–</span>}
                            </TableCell>
                         </TableRow>
                       );
                     })
                   )}
                </TableBody>
             </Table>
          </div>
        </div>
      </div>
    </>
  );

  if (hideLayout) return content;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PageHeader
        title="Valuasi Persediaan"
        eyebrow="Intelligence"
        description="Ringkasan nilai aset persediaan di gudang saat ini."
        actions={
          <div className="flex gap-2 print:hidden">
            <Button onClick={doExportPdf} disabled={exporting !== null} variant="outline" className="h-8 gap-1.5 border-white/60 bg-white/40 shadow-sm">
              {exporting === 'pdf' ? <Loader2 size={14} className="animate-spin" /> : <FileText size={14} />} Export PDF
            </Button>
            <Button onClick={doExportExcel} disabled={exporting !== null} variant="outline" className="h-8 gap-1.5 border-white/60 bg-white/40 shadow-sm">
              {exporting === 'excel' ? <Loader2 size={14} className="animate-spin" /> : <FileSpreadsheet size={14} />} Export Excel
            </Button>
          </div>
        }
        mobileActions={
          <div className="flex gap-2 print:hidden">
            <Button onClick={doExportPdf} disabled={exporting !== null} variant="outline" size="sm" className="gap-1.5">
              {exporting === 'pdf' ? <Loader2 size={14} className="animate-spin" /> : <FileText size={14} />} PDF
            </Button>
            <Button onClick={doExportExcel} disabled={exporting !== null} variant="outline" size="sm" className="gap-1.5">
              {exporting === 'excel' ? <Loader2 size={14} className="animate-spin" /> : <FileSpreadsheet size={14} />} Excel
            </Button>
          </div>
        }
      />

      <div className="custom-scrollbar flex-1 overflow-auto">
        <div className="mx-auto max-w-[1600px] p-4 md:p-6 lg:p-8">
          {content}
        </div>
      </div>
    </div>
  );
}
