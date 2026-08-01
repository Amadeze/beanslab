"use client";

import { formatRupiah } from "@/lib/format";
import type { SampleReport } from "../actions";
import { Beaker, Users, Package, TrendingUp, Download } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Legend } from "recharts";
import { Button } from "@/components/ui/button";

const SOURCE_TYPE_LABELS: Record<string, string> = {
  FINISHED_GOODS: "Produk Jadi",
  RECIPE: "Resep Blend",
  CUSTOM_BLEND: "Custom Blend",
};

interface SampleReportClientProps {
  report: SampleReport;
}


function exportSampleCSV(report: SampleReport) {
  const rows: string[][] = [
    ["Laporan Sample"],
    [""],
    ["Total Sample", String(report.totalSamples)],
    ["Total Biaya", String(report.totalCost)],
    ["Total Gram", String(report.totalGrams)],
    [""],
    ["Sumber", "Pack", "Gram", "Biaya"],
    ...report.bySourceType.map(s => [s.source, String(s.count), String(s.grams), String(s.cost)]),
    [""],
    ["Produk", "Kg", "Unit", "Biaya"],
    ...report.byProduct.map(p => [p.productName, String(p.quantityKg), String(p.quantityUnit), String(p.cost)]),
    [""],
    ["Penerima", "Kali", "Total Biaya"],
    ...report.topRecipients.map(r => [r.recipient, String(r.count), String(r.cost)]),
  ];
  const csvContent = "data:text/csv;charset=utf-8," + rows.map(r => r.join(",")).join("\n");
  const link = document.createElement("a");
  link.setAttribute("href", encodeURI(csvContent));
  link.setAttribute("download", "Laporan_Sample_" + new Date().toISOString().slice(0, 10) + ".csv");
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function SampleReportClient({ report }: SampleReportClientProps) {
  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="rounded-2xl border border-violet-200 bg-gradient-to-br from-violet-50 to-purple-50 p-4 shadow-sm">
          <p className="text-xs font-medium text-violet-600">Total Sample</p>
          <p className="mt-1 font-mono text-xl font-black tabular-nums text-violet-700">{report.totalSamples}</p>
          <p className="text-xs text-violet-500">transaksi selesai</p>
        </div>
        <div className="rounded-2xl border border-violet-200 bg-violet-50 p-4 shadow-sm">
          <p className="text-xs font-medium text-violet-600">Total Biaya Sample</p>
          <p className="mt-1 font-mono text-lg font-black tabular-nums text-violet-700">{formatRupiah(report.totalCost)}</p>
        </div>
        <div className="rounded-2xl border border-violet-200 bg-violet-50 p-4 shadow-sm">
          <p className="text-xs font-medium text-violet-600">Total Berat</p>
          <p className="mt-1 font-mono text-lg font-black tabular-nums text-violet-700">{report.totalGrams.toLocaleString("id-ID")} g</p>
        </div>
        <div className="rounded-2xl border border-violet-200 bg-violet-50 p-4 shadow-sm">
          <p className="text-xs font-medium text-violet-600">Rata-rata per Pack</p>
          <p className="mt-1 font-mono text-lg font-black tabular-nums text-violet-700">
            {report.totalSamples > 0 ? formatRupiah(report.totalCost / report.totalSamples) : "\u2014"}
          </p>
        </div>
        <div className="flex items-end">
          <Button onClick={() => exportSampleCSV(report)} variant="outline" className="h-9 gap-1.5">
            <Download size={14} /> Export CSV
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Monthly Trend Chart */}
        <div className="rounded-2xl border border-white/60 bg-white/40 p-5 shadow-sm backdrop-blur-md">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp size={16} className="text-violet-600" />
            <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wide">Tren Sample (6 Bulan)</h3>
          </div>
          <div className="h-[250px]">
            {report.monthlyTrend.some((m) => m.count > 0) ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={report.monthlyTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis yAxisId="left" tick={{ fontSize: 11 }} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                  <RechartsTooltip formatter={(value: any, name: any) => name === "Biaya" ? formatRupiah(Number(value)) : value} />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: "11px" }} />
                  <Bar yAxisId="left" dataKey="count" name="Jumlah Pack" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                  <Bar yAxisId="right" dataKey="cost" name="Biaya" fill="#c4b5fd" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-400 text-sm">Belum ada data sample</div>
            )}
          </div>
        </div>

        {/* By Source Type */}
        <div className="rounded-2xl border border-white/60 bg-white/40 p-5 shadow-sm backdrop-blur-md">
          <div className="flex items-center gap-2 mb-4">
            <Package size={16} className="text-violet-600" />
            <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wide">Berdasarkan Sumber</h3>
          </div>
          {report.bySourceType.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow className="border-white/40">
                  <TableHead className="text-[11px] font-bold text-slate-500">Sumber</TableHead>
                  <TableHead className="text-right text-[11px] font-bold text-slate-500">Pack</TableHead>
                  <TableHead className="text-right text-[11px] font-bold text-slate-500">Gram</TableHead>
                  <TableHead className="text-right text-[11px] font-bold text-slate-500">Biaya</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {report.bySourceType.map((row) => (
                  <TableRow key={row.source} className="border-white/40">
                    <TableCell className="font-medium text-sm text-slate-700">
                      {SOURCE_TYPE_LABELS[row.source] ?? row.source}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">{row.count}</TableCell>
                    <TableCell className="text-right font-mono text-sm">{row.grams.toLocaleString("id-ID")} g</TableCell>
                    <TableCell className="text-right font-mono text-sm font-semibold">{formatRupiah(row.cost)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-sm text-slate-400 text-center py-4">Belum ada data</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* By Product */}
        <div className="rounded-2xl border border-white/60 bg-white/40 p-5 shadow-sm backdrop-blur-md">
          <div className="flex items-center gap-2 mb-4">
            <Beaker size={16} className="text-violet-600" />
            <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wide">Produk yang Digunakan</h3>
          </div>
          {report.byProduct.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow className="border-white/40">
                  <TableHead className="text-[11px] font-bold text-slate-500">Produk</TableHead>
                  <TableHead className="text-right text-[11px] font-bold text-slate-500">Kg</TableHead>
                  <TableHead className="text-right text-[11px] font-bold text-slate-500">Unit</TableHead>
                  <TableHead className="text-right text-[11px] font-bold text-slate-500">Biaya</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {report.byProduct.map((row) => (
                  <TableRow key={row.productName} className="border-white/40">
                    <TableCell className="font-medium text-sm text-slate-700">{row.productName}</TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {row.quantityKg > 0 ? `${row.quantityKg.toLocaleString("id-ID", { maximumFractionDigits: 2 })}` : "\u2014"}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {row.quantityUnit > 0 ? row.quantityUnit.toLocaleString("id-ID") : "\u2014"}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm font-semibold">{formatRupiah(row.cost)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-sm text-slate-400 text-center py-4">Belum ada data</p>
          )}
        </div>

        {/* Top Recipients */}
        <div className="rounded-2xl border border-white/60 bg-white/40 p-5 shadow-sm backdrop-blur-md">
          <div className="flex items-center gap-2 mb-4">
            <Users size={16} className="text-violet-600" />
            <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wide">Penerima Sample Teratas</h3>
          </div>
          {report.topRecipients.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow className="border-white/40">
                  <TableHead className="text-[11px] font-bold text-slate-500">Penerima</TableHead>
                  <TableHead className="text-right text-[11px] font-bold text-slate-500">Kali</TableHead>
                  <TableHead className="text-right text-[11px] font-bold text-slate-500">Total Biaya</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {report.topRecipients.map((row) => (
                  <TableRow key={row.recipient} className="border-white/40">
                    <TableCell className="font-medium text-sm text-slate-700">{row.recipient}</TableCell>
                    <TableCell className="text-right font-mono text-sm">{row.count}</TableCell>
                    <TableCell className="text-right font-mono text-sm font-semibold">{formatRupiah(row.cost)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-sm text-slate-400 text-center py-4">Belum ada data</p>
          )}
        </div>
      </div>
    </div>
  );
}
