"use client";

import { useState } from "react";
import { FileText, FileSpreadsheet, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { BalanceSheetReport } from "../actions";
import { ReportHeader } from "../_shared";
import { formatRupiah } from "@/lib/format";
import { exportToProfessionalPdf, exportToProfessionalExcel } from "@/lib/export-utils";

interface BalanceSheetClientProps {
  report: BalanceSheetReport;
}

type BSRow = { kat: string; jml: string; ket: string };

async function doExportPdf(report: BalanceSheetReport) {
  const { assets, liabilities, equity } = report;
  const asOf = new Date(report.asOf).toLocaleDateString("id-ID", {
    day: "numeric", month: "long", year: "numeric",
  });
  const fmt = (v: number) => formatRupiah(v);
  const brand = report.businessName || "Laporan Keuangan";

  const asetRows: BSRow[] = [
    { kat: "Kas & Bank",             jml: fmt(assets.cashAndBank),          ket: "Aset Lancar" },
    { kat: "Piutang Usaha",           jml: fmt(assets.accountsReceivable),   ket: "Aset Lancar" },
    { kat: "Persediaan",  jml: fmt(assets.inventory),            ket: "Aset Lancar" },
    { kat: "TOTAL ASET",             jml: fmt(assets.totalAssets),          ket: "" },
  ];

  const pasivaRows: BSRow[] = [
    { kat: "Hutang Usaha",            jml: fmt(liabilities.accountsPayable),  ket: "Kewajiban" },
    { kat: "Total Kewajiban",         jml: fmt(liabilities.totalLiabilities), ket: "" },
    { kat: "Modal Disetor",           jml: fmt(equity.contributedCapital),    ket: "Ekuitas" },
    { kat: "Laba Ditahan",            jml: fmt(equity.retainedEarnings),      ket: "Ekuitas" },
    ...(equity.withdrawals > 0 ? [{ kat: "Prive (Penarikan)", jml: fmt(equity.withdrawals), ket: "Ekuitas" }] : []),
    ...(equity.distributedProfit > 0 ? [{ kat: "Bagi Hasil", jml: fmt(equity.distributedProfit), ket: "Ekuitas" }] : []),
    { kat: "Total Ekuitas",           jml: fmt(equity.totalEquity),           ket: "" },
    { kat: "TOTAL KEWAJIBAN & EKUITAS", jml: fmt(liabilities.totalLiabilities + equity.totalEquity), ket: "" },
  ];

  const cols = [
    { header: "Keterangan",   accessor: (r: BSRow) => r.kat },
    { header: "Jumlah (IDR)", accessor: (r: BSRow) => r.jml, align: "right" as const },
    { header: "Klasifikasi",  accessor: (r: BSRow) => r.ket },
  ];

  const summary = [
    { label: "Total Aset",       value: fmt(assets.totalAssets) },
    { label: "Total Kewajiban",  value: fmt(liabilities.totalLiabilities) },
    { label: "Total Ekuitas",    value: fmt(equity.totalEquity) },
    { label: "Hutang Usaha",     value: fmt(liabilities.accountsPayable) },
    { label: "Laba Ditahan",     value: fmt(equity.retainedEarnings) },
    {
      label: "Neraca Seimbang",
      value: Math.abs(assets.totalAssets - (liabilities.totalLiabilities + equity.totalEquity)) < 1 ? "✓ Ya" : "⚠ Selisih",
    },
  ];

  await exportToProfessionalPdf({
    title: "Neraca (Balance Sheet)",
    subtitle: `${brand} · Posisi Keuangan`,
    filename: `Neraca_${new Date(report.asOf).toISOString().slice(0, 10)}`,
    sheetName: "Neraca",
    columns: cols,
    data: [...asetRows, { kat: "─────────────", jml: "", ket: "" }, ...pasivaRows],
    summary,
    period: `Per ${asOf}`,
    status: "DRAFT",
    sections: [
      { title: "AKTIVA (Aset)", columns: cols as Parameters<typeof exportToProfessionalPdf>[0]["columns"], data: asetRows },
      { title: "PASIVA (Kewajiban & Ekuitas)", columns: cols as Parameters<typeof exportToProfessionalPdf>[0]["columns"], data: pasivaRows },
    ],
    generatedBy: brand,
  });
}

async function doExportExcel(report: BalanceSheetReport) {
  const { assets, liabilities, equity } = report;
  const asOf = new Date(report.asOf).toLocaleDateString("id-ID", {
    day: "numeric", month: "long", year: "numeric",
  });
  const fmt = (v: number) => formatRupiah(v);
  const brand = report.businessName || "Laporan Keuangan";

  const allRows: BSRow[] = [
    { kat: "=== AKTIVA ===",              jml: "",                                        ket: "" },
    { kat: "Kas & Bank",                  jml: fmt(assets.cashAndBank),                  ket: "Aset Lancar" },
    { kat: "Piutang Usaha",               jml: fmt(assets.accountsReceivable),           ket: "Aset Lancar" },
    { kat: "Persediaan",      jml: fmt(assets.inventory),                    ket: "Aset Lancar" },
    { kat: "TOTAL ASET",                  jml: fmt(assets.totalAssets),                  ket: "" },
    { kat: "",                            jml: "",                                        ket: "" },
    { kat: "=== PASIVA ===",              jml: "",                                        ket: "" },
    { kat: "Hutang Usaha",                jml: fmt(liabilities.accountsPayable),         ket: "Kewajiban" },
    { kat: "Total Kewajiban",             jml: fmt(liabilities.totalLiabilities),        ket: "" },
    { kat: "Modal Disetor",               jml: fmt(equity.contributedCapital),           ket: "Ekuitas" },
    { kat: "Laba Ditahan",                jml: fmt(equity.retainedEarnings),             ket: "Ekuitas" },
    { kat: "Total Ekuitas",               jml: fmt(equity.totalEquity),                  ket: "" },
    { kat: "TOTAL KEWAJIBAN & EKUITAS",   jml: fmt(liabilities.totalLiabilities + equity.totalEquity), ket: "" },
  ];

  await exportToProfessionalExcel({
    title: "Neraca (Balance Sheet)",
    subtitle: `${brand} · Posisi Keuangan`,
    filename: `Neraca_${new Date(report.asOf).toISOString().slice(0, 10)}`,
    sheetName: "Neraca",
    columns: [
      { header: "Keterangan",   accessor: (r: BSRow) => r.kat },
      { header: "Jumlah (IDR)", accessor: (r: BSRow) => r.jml, align: "right" as const },
      { header: "Klasifikasi",  accessor: (r: BSRow) => r.ket },
    ],
    data: allRows,
    summary: [
      { label: "Total Aset",      value: fmt(assets.totalAssets) },
      { label: "Total Kewajiban", value: fmt(liabilities.totalLiabilities) },
      { label: "Total Ekuitas",   value: fmt(equity.totalEquity) },
      { label: "Hutang Usaha",    value: fmt(liabilities.accountsPayable) },
      { label: "Laba Ditahan",    value: fmt(equity.retainedEarnings) },
    ],
    period: `Per ${asOf}`,
    status: "DRAFT",
    generatedBy: brand,
  });
}

function Line({
  label, value, bold, positive, negative,
}: {
  label: string; value: string; bold?: boolean; positive?: boolean; negative?: boolean;
}) {
  return (
    <div className="flex justify-between items-center py-2.5 px-5 border-b border-stone-100 last:border-0">
      <span className={bold ? "text-sm font-bold text-stone-800" : "text-sm text-stone-600"}>{label}</span>
      <span
        className={`font-mono text-sm tabular-nums ${bold ? "font-bold" : "font-medium"} ${
          positive ? "text-emerald-600" : negative ? "text-red-500" : "text-stone-800"
        }`}
      >
        {value}
      </span>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="border-b border-stone-200 bg-stone-50 px-5 py-2 font-bold text-xs uppercase tracking-widest text-stone-500">
      {children}
    </div>
  );
}

export function BalanceSheetClient({ report }: BalanceSheetClientProps) {
  const [exporting, setExporting] = useState<"pdf" | "excel" | null>(null);
  const handlePdf   = async () => { setExporting("pdf");   try { await doExportPdf(report);   } finally { setExporting(null); } };
  const handleExcel = async () => { setExporting("excel"); try { await doExportExcel(report); } finally { setExporting(null); } };

  const { assets, liabilities, equity } = report;
  const totalPasiva = liabilities.totalLiabilities + equity.totalEquity;
  const diff = Math.abs(assets.totalAssets - totalPasiva);
  const fmt = (v: number) => formatRupiah(v);

  return (
    <div className="space-y-6">
      <ReportHeader
        title="Neraca (Balance Sheet)"
        subtitle="Posisi Keuangan"
        period={new Date(report.asOf).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}
        status="DRAFT"
        generatedAt={new Date()}
        actions={
          <div className="flex items-center gap-1.5">
            <Button onClick={handlePdf} disabled={exporting !== null} variant="outline" className="h-8 gap-1.5">
              {exporting === "pdf" ? <Loader2 size={14} className="animate-spin" /> : <FileText size={14} />} PDF
            </Button>
            <Button onClick={handleExcel} disabled={exporting !== null} variant="outline" className="h-8 gap-1.5">
              {exporting === "excel" ? <Loader2 size={14} className="animate-spin" /> : <FileSpreadsheet size={14} />} Excel
            </Button>
          </div>
        }
      />

      {/* Warnings */}
      {report.warnings.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50/80 px-5 py-4 text-xs text-amber-900">
          <p className="font-bold mb-1">Neraca Draft · Posisi {new Date(report.asOf).toLocaleString("id-ID")}</p>
          <ul className="list-disc space-y-0.5 pl-5">
            {report.warnings.map((w, i) => <li key={i}>{w}</li>)}
          </ul>
          {diff > 0.01 && (
            <p className="mt-2 font-semibold text-red-600">⚠ Selisih Aktiva vs Pasiva: {fmt(diff)}</p>
          )}
        </div>
      )}

      {/* Two-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ASET */}
        <div className="rounded-xl border border-stone-200 bg-white overflow-hidden">
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50/50 px-5 py-3 border-b border-stone-200">
            <h3 className="text-sm font-bold text-blue-800">AKTIVA (Aset)</h3>
          </div>
          <SectionTitle>Aset Lancar</SectionTitle>
          <Line label="Kas & Bank" value={fmt(assets.cashAndBank)} bold />
          <Line label="Piutang Usaha" value={fmt(assets.accountsReceivable)} />
          <Line label="Persediaan" value={fmt(assets.inventory)} />
          <div className="border-t-2 border-double border-stone-300 bg-blue-50/30">
            <Line label="Total Aset" value={fmt(assets.totalAssets)} bold positive />
          </div>
        </div>

        {/* PASIVA */}
        <div className="rounded-xl border border-stone-200 bg-white overflow-hidden">
          <div className="bg-gradient-to-r from-rose-50 to-orange-50/50 px-5 py-3 border-b border-stone-200">
            <h3 className="text-sm font-bold text-rose-800">PASIVA (Kewajiban &amp; Ekuitas)</h3>
          </div>

          <SectionTitle>Kewajiban</SectionTitle>
          <Line label="Hutang Usaha" value={fmt(liabilities.accountsPayable)} negative={liabilities.accountsPayable > 0} />
          {liabilities.accountsPayable > 0 && (
            <div className="px-5 pb-2 space-y-1 text-xs">
              <div className="flex justify-between text-stone-400"><span>Belum jatuh tempo</span><span>{fmt(liabilities.aging.current)}</span></div>
              <div className="flex justify-between text-amber-600"><span>Lewat 1-30 hari</span><span>{fmt(liabilities.aging.overdue1To30)}</span></div>
              <div className="flex justify-between text-orange-600"><span>Lewat 31-60 hari</span><span>{fmt(liabilities.aging.overdue31To60)}</span></div>
              <div className="flex justify-between text-red-600"><span>Lewat &gt;60 hari</span><span>{fmt(liabilities.aging.overdue61Plus)}</span></div>
            </div>
          )}
          <Line label="Total Kewajiban" value={fmt(liabilities.totalLiabilities)} bold negative={liabilities.totalLiabilities > 0} />

          <div className="border-t border-stone-200 mt-2">
            <SectionTitle>Ekuitas</SectionTitle>
            <Line label="Modal Disetor" value={fmt(equity.contributedCapital)} bold positive={equity.contributedCapital > 0} />
            {equity.withdrawals > 0 && <Line label="Prive (Penarikan Pemilik)" value={fmt(equity.withdrawals)} negative />}
            <Line label="Laba Ditahan" value={fmt(equity.retainedEarnings)} positive={equity.retainedEarnings > 0} negative={equity.retainedEarnings < 0} />
            {equity.distributedProfit > 0 && <Line label="Bagi Hasil" value={fmt(equity.distributedProfit)} negative />}
            <div className="border-t border-stone-200 bg-emerald-50/30">
              <Line label="Total Ekuitas" value={fmt(equity.totalEquity)} bold positive={equity.totalEquity > 0} />
            </div>
          </div>

          {/* Grand Total */}
          <div className="border-t-2 border-double border-stone-300 bg-indigo-50/30">
            <Line label="Total Kewajiban & Ekuitas" value={fmt(totalPasiva)} bold positive />
          </div>
        </div>
      </div>

      {/* Tracking Note */}
      {liabilities.trackingNote && (
        <div className="text-[11px] text-stone-400 italic">{liabilities.trackingNote}</div>
      )}
    </div>
  );
}
