"use client";

import { Scale, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { BalanceSheetReport } from "../actions";
import { ReportHeader } from "../_shared";
import { formatRupiah } from "@/lib/format";

interface BalanceSheetClientProps {
  report: BalanceSheetReport;
}

function exportCSV(report: BalanceSheetReport) {
  const { assets, liabilities, equity } = report;
  const rows = [
    ["Neraca (Balance Sheet)"],
    [""],
    ["ASET", ""],
    ["Kas & Bank", String(assets.cashAndBank)],
    ["Piutang Usaha", String(assets.accountsReceivable)],
    ["Persediaan", String(assets.inventory)],
    ["Total Aset", String(assets.totalAssets)],
    [""],
    ["LIABILITAS & EKUITAS", ""],
    ["Hutang Usaha", String(liabilities.accountsPayable)],
    ["Total Liabilitas", String(liabilities.totalLiabilities)],
    [""],
    ["Modal Disetor", String(equity.contributedCapital)],
    ["Prive", String(equity.withdrawals)],
    ["Laba Ditahan", String(equity.retainedEarnings)],
    ["Bagi Hasil", String(equity.distributedProfit)],
    ["Total Ekuitas", String(equity.totalEquity)],
    ["Total Kewajiban & Ekuitas", String(liabilities.totalLiabilities + equity.totalEquity)],
  ];
  const csv = "data:text/csv;charset=utf-8," + rows.map(r => r.join(",")).join("\n");
  const link = document.createElement("a");
  link.setAttribute("href", encodeURI(csv));
  link.setAttribute("download", `Neraca_${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function Line({ label, value, bold, positive, negative }: { label: string; value: string; bold?: boolean; positive?: boolean; negative?: boolean }) {
  return (
    <div className="flex justify-between items-center py-2.5 px-5 border-b border-stone-100 last:border-0">
      <span className={bold ? "text-sm font-bold text-stone-800" : "text-sm text-stone-600"}>{label}</span>
      <span className={`font-mono text-sm tabular-nums ${bold ? "font-bold" : "font-medium"} ${
        positive ? "text-emerald-600" : negative ? "text-red-500" : "text-stone-800"
      }`}>{value}</span>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <div className="border-b border-stone-200 bg-stone-50 px-5 py-2 font-bold text-xs uppercase tracking-widest text-stone-500">{children}</div>;
}

export function BalanceSheetClient({ report }: BalanceSheetClientProps) {
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
          <Button onClick={() => exportCSV(report)} variant="outline" className="h-8 gap-1.5">
            <Download size={14} /> Export CSV
          </Button>
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
          <Line label="Persediaan (Inventory)" value={fmt(assets.inventory)} />
          <div className="border-t-2 border-double border-stone-300 bg-blue-50/30">
            <Line label="Total Aset" value={fmt(assets.totalAssets)} bold positive />
          </div>
        </div>

        {/* PASIVA */}
        <div className="rounded-xl border border-stone-200 bg-white overflow-hidden">
          <div className="bg-gradient-to-r from-rose-50 to-orange-50/50 px-5 py-3 border-b border-stone-200">
            <h3 className="text-sm font-bold text-rose-800">PASIVA (Kewajiban & Ekuitas)</h3>
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
