"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { GlassPanel } from "@/components/ui/glass-panel";
import { formatRupiah, formatDateLong } from "@/lib/format";
import type { PnLReport } from "../../keuangan/actions";
import { TrendingUp, TrendingDown, Minus, ChevronLeft, ChevronRight, FileText, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { PieChart, Pie, Cell, Tooltip as RechartsTooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend } from "recharts";
import { getCurrentDate } from "@/lib/date-utils";
import { PageHeader } from "@/components/layout/PageHeader";

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Helpers
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const MONTHS = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

const CATEGORY_LABELS: Record<string, string> = {
  GAJI:        "Gaji & Tunjangan",
  UTILITAS:    "Utilitas",
  OPERASIONAL: "Operasional",
  LAINNYA:     "Lain-lain",
  FINISHED_GOODS: "Produk Jadi",
  ROASTED_BEAN: "Biji Kopi Sangrai",
  GREEN_BEAN: "Biji Kopi Mentah",
  PACKAGING:   "Kemasan",
  BIAYA_SAMPLE_PROMOSI: "Biaya Sample & Promosi",
  BIAYA_SAMPLE_RB: "Sample Roasted Bean",
  BIAYA_SAMPLE_FG: "Sample Produk Jadi",
  BIAYA_SAMPLE_PKG: "Sample Kemasan",
  KERUGIAN_MATERIAL: "Kerugian Material",
};

function pct(part: number, total: number): string {
  if (total === 0) return "–";
  return `${((part / total) * 100).toFixed(1)}%`;
}

function getPnLRows(report: PnLReport) {
  const { month, year } = report;
  return [
    ["Laporan Laba Rugi", `roastd.id - ${MONTHS[month-1]} ${year}`],
    [],
    ["Kategori", "Jumlah (IDR)"],
    ["Total Pendapatan", report.revenue],
    ["HPP (COGS)", report.cogs],
    ["Laba Kotor", report.grossProfit],
    ["Total OPEX", report.opex],
    ["Laba Bersih", report.netProfit],
    [],
    ["Rincian OPEX", "Jumlah (IDR)"],
    ...report.opexBreakdown.map(o => [CATEGORY_LABELS[o.category] || o.category, o.amount])
  ];
}

async function exportToPdf(report: PnLReport) {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);
  const doc = new jsPDF();
  const period = `${MONTHS[report.month - 1]} ${report.year}`;

  doc.setFontSize(14);
  doc.text("Laporan Laba Rugi", 14, 16);
  doc.setFontSize(10);
  doc.text(`Periode: ${period}`, 14, 23);

  autoTable(doc, {
    startY: 30,
    head: [["Kategori", "Jumlah (IDR)"]],
    body: [
      ["Total Pendapatan", report.revenue],
      ["HPP (COGS)", report.cogs],
      ["Laba Kotor", report.grossProfit],
      ["Total OPEX", report.opex],
      ["Laba Bersih", report.netProfit],
    ].map(([label, value]) => [label, formatRupiah(Number(value))]),
    styles: { fontSize: 9 },
    headStyles: { fillColor: [37, 99, 235] },
  });

  autoTable(doc, {
    startY: ((doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 62) + 8,
    head: [["Rincian OPEX", "Jumlah (IDR)"]],
    body: report.opexBreakdown.map((item) => [
      CATEGORY_LABELS[item.category] || item.category,
      formatRupiah(item.amount),
    ]),
    styles: { fontSize: 9 },
    headStyles: { fillColor: [82, 82, 91] },
  });

  doc.save(`Laba_Rugi_${MONTHS[report.month - 1]}_${report.year}.pdf`);
}

async function exportToExcel(report: PnLReport) {
  const { default: writeXlsxFile } = await import("write-excel-file/browser");
  await writeXlsxFile(getPnLRows(report), {
    sheet: "Laba Rugi",
  }).toFile(`Laba_Rugi_${MONTHS[report.month - 1]}_${report.year}.xlsx`);
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// P&L Line Row
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

interface LineRowProps {
  label: string;
  value: number;
  indent?: 0 | 1 | 2;
  bold?: boolean;
  highlight?: "positive" | "negative" | "neutral";
  separator?: "top" | "double";
  percentage?: string;
  showSign?: boolean;
}

function LineRow({
  label, value, indent = 0, bold = false,
  highlight, separator, percentage, showSign = false,
}: LineRowProps) {
  const indentCls = ["pl-4", "pl-8", "pl-12"][indent];

  const valueCls = cn(
    "tabular-nums font-mono",
    bold ? "font-bold" : "font-medium",
    highlight === "positive" && "text-emerald-700",
    highlight === "negative" && "text-red-600",
    highlight === "neutral"  && "text-zinc-600",
    !highlight && "text-zinc-800",
  );

  const rowCls = cn(
    "grid grid-cols-[1fr_auto_auto] items-center gap-x-2 sm:gap-x-6 px-4 sm:px-5 py-2.5",
    separator === "double" && "border-t-2 border-double border-zinc-300 mt-1",
    separator === "top"    && "border-t border-zinc-200",
    bold ? "bg-zinc-50/70" : "hover:bg-zinc-50/50",
  );

  return (
    <div className={rowCls}>
      <span className={cn("text-sm", indentCls, bold ? "font-semibold text-zinc-800" : "text-zinc-600")}>
        {label}
      </span>
      <span className="text-xs text-zinc-400 text-right min-w-[40px] sm:min-w-[48px]">
        {percentage ?? ""}
      </span>
      <span className={cn("text-sm text-right min-w-[100px] sm:min-w-[160px]", valueCls)}>
        {showSign && value > 0 ? "+" : ""}
        {value < 0 ? `(${formatRupiah(Math.abs(value))})` : formatRupiah(value)}
      </span>
    </div>
  );
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Section Header
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function SectionHeader({ label }: { label: string }) {
  return (
    <div className="bg-zinc-100/80 px-5 py-2 mt-3">
      <span className="text-[11px] font-bold uppercase tracking-widest text-zinc-500">
        {label}
      </span>
    </div>
  );
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Month Navigator
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function MonthNavigator({ month, year }: { month: number; year: number }) {
  const router    = useRouter();
  const pathname  = usePathname();
  const sp        = useSearchParams();

  const navigate = (m: number, y: number) => {
    const params = new URLSearchParams(sp.toString());
    params.set("month", String(m));
    params.set("year",  String(y));
    router.push(`${pathname}?${params.toString()}`);
  };

  const prev = () => {
    if (month === 1) navigate(12, year - 1);
    else navigate(month - 1, year);
  };

  const next = () => {
    const now = getCurrentDate();
    const isCurrentMonth = month === now.getMonth() + 1 && year === now.getFullYear();
    if (isCurrentMonth) return;
    if (month === 12) navigate(1, year + 1);
    else navigate(month + 1, year);
  };

  const now = getCurrentDate();
  const isCurrentMonth = month === now.getMonth() + 1 && year === now.getFullYear();

  return (
    <div className="flex items-center gap-2">
      <Button variant="outline" size="icon" className="h-8 w-8" onClick={prev}>
        <ChevronLeft size={14} />
      </Button>
      <span className="min-w-[100px] sm:min-w-[130px] text-center text-sm font-semibold text-zinc-800">
        {MONTHS[month - 1]} {year}
      </span>
      <Button
        variant="outline"
        size="icon"
        className="h-8 w-8"
        onClick={next}
        disabled={isCurrentMonth}
      >
        <ChevronRight size={14} />
      </Button>
    </div>
  );
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// KPI Summary Cards
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

interface KpiCardProps {
  label: string;
  value: number;
  subtitle?: React.ReactNode;
  variant: "emerald" | "rose" | "blue" | "violet";
  icon: React.ReactNode;
}

function KpiCard({ label, value, subtitle, variant, icon }: KpiCardProps) {
  const colors = {
    emerald: { text: "text-emerald-700", icon: "bg-emerald-50 text-emerald-700" },
    rose: { text: "text-rose-700", icon: "bg-rose-50 text-rose-700" },
    blue: { text: "text-stone-900", icon: "bg-sky-50 text-sky-700" },
    violet: { text: "text-violet-700", icon: "bg-violet-50 text-violet-700" },
  }[variant];

  return (
    <div className="rounded-xl border border-stone-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-zinc-500">{label}</p>
          <p className={cn("mt-1 font-mono text-lg font-black tabular-nums", colors.text)}>
            {value < 0 ? `(${formatRupiah(Math.abs(value))})` : formatRupiah(value)}
          </p>
          {subtitle && <p className="mt-0.5 text-[11px] text-zinc-400">{subtitle}</p>}
        </div>
        <div className={cn("shrink-0 rounded-xl p-2", colors.icon)}>
          {icon}
        </div>
      </div>
    </div>
  );
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Main Client
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

interface PnLReportClientProps {
  report: PnLReport;
  hideLayout?: boolean;
}

export function PnLReportClient({ report, hideLayout }: PnLReportClientProps) {
  const { month, year, revenue, cogs, grossProfit, opex, netProfit, opexBreakdown, revenueBreakdown, cogsBreakdown, salesVolumeUnits, topProducts, topCustomers } = report;

  const grossMargin = pct(grossProfit, revenue);
  const netMargin   = pct(netProfit, revenue);
  const cogsRatio   = pct(cogs, revenue);
  const opexRatio   = pct(opex, revenue);

  const getMomText = (current: number, prev: number | undefined) => {
    if (prev === undefined || prev === 0) return null;
    const growth = ((current - prev) / Math.abs(prev)) * 100;
    const isPositive = growth > 0;
    const color = isPositive ? "text-emerald-500" : "text-rose-500";
    const icon = isPositive ? "↑" : "↓";
    return <span className={cn("font-bold ml-1", color)}>{icon} {Math.abs(growth).toFixed(1)}% vs bln lalu</span>;
  };

  const chartColors = ["#6F4A6A", "#B65331", "#2B7567", "#A66F12", "#4B6B3C", "#64748b"];
  
  const content = (
    <>
      <div className={`mb-4 rounded-2xl border px-4 py-3 text-xs ${Math.abs(report.reconciliationDifference) <= 0.01 ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-red-200 bg-red-50 text-red-700"}`}>
        <strong>{Math.abs(report.reconciliationDifference) <= 0.01 ? "Terekonsiliasi" : "Perlu pemeriksaan"}:</strong>{" "}
        rincian pendapatan terhadap total berbeda {formatRupiah(report.reconciliationDifference)} · periode dihitung dalam {report.timezone}.
      </div>
      {/* â”€â”€ KPI Summary Row â”€â”€ */}
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <KpiCard
          label="Total Pendapatan"
          value={revenue}
          subtitle={<>Revenue {getMomText(revenue, report.previousMonthRevenue)}</>}
          variant="blue"
          icon={<TrendingUp size={16} />}
        />
        <div className="flex flex-col justify-center rounded-xl border border-stone-200 bg-white p-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="rounded-lg bg-amber-50 p-1.5 text-amber-700"><TrendingUp size={16} /></span>
            <h3 className="text-sm font-semibold text-slate-600">Volume Terjual</h3>
          </div>
          <p className="text-2xl font-black text-amber-700 tracking-tight">{salesVolumeUnits.toLocaleString("id-ID")} <span className="text-sm font-normal">Pcs</span></p>
        </div>
        <KpiCard
          label="Laba Kotor"
          value={grossProfit}
          subtitle={<>Margin: {grossMargin} {getMomText(grossProfit, report.previousMonthGrossProfit)}</>}
          variant="emerald"
          icon={<TrendingUp size={16} />}
        />
        <KpiCard
          label="Total Beban (OPEX)"
          value={opex}
          subtitle={<>{opexRatio} revenue {getMomText(opex, report.previousMonthOpex)}</>}
          variant="rose"
          icon={<TrendingDown size={16} />}
        />
        <KpiCard
          label="Laba Bersih"
          value={netProfit}
          subtitle={<>Margin: {netMargin} {getMomText(netProfit, report.previousMonthNetProfit)}</>}
          variant={netProfit >= 0 ? "violet" : "rose"}
          icon={netProfit >= 0 ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
        />
      </div>

      {/* â”€â”€ Charts Row â”€â”€ */}
      <div className="mb-6 grid grid-cols-1 lg:grid-cols-2 gap-4 print:hidden">
        <div className="flex h-[280px] flex-col rounded-xl border border-stone-200 bg-white p-4">
          <h3 className="text-xs font-bold text-slate-700 mb-4 uppercase tracking-wider">Distribusi Pendapatan</h3>
          <div className="flex-1 min-h-0">
            {revenue > 0 ? (() => {
              const chartData = [
                { name: "HPP (Modal Kopi)", amount: cogs, fill: "#7A8790" },
                { name: "Beban Operasional", amount: opex, fill: "#ef4444" },
                { name: "Laba Bersih", amount: Math.max(0, netProfit), fill: "#4B6B3C" }
              ].filter(d => d.amount > 0);

              return (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={chartData}
                      dataKey="amount"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={2}
                    >
                      {chartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Pie>
                    <RechartsTooltip formatter={(value: any) => formatRupiah(Number(value))} />
                    <Legend iconType="circle" wrapperStyle={{ fontSize: '11px' }} />
                  </PieChart>
                </ResponsiveContainer>
              );
            })() : (
              <div className="h-full flex items-center justify-center text-sm text-slate-400">Belum ada pendapatan</div>
            )}
          </div>
        </div>
        
        <div className="flex h-[280px] flex-col rounded-xl border border-stone-200 bg-white p-4">
          <h3 className="text-xs font-bold text-slate-700 mb-4 uppercase tracking-wider">Bulan Lalu vs Bulan Ini</h3>
          <div className="flex-1 min-h-0">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={[
                  { name: "Bulan Lalu", Revenue: report.previousMonthRevenue || 0, Expenses: (report.previousMonthCogs || 0) + (report.previousMonthOpex || 0) },
                  { name: "Bulan Ini", Revenue: revenue, Expenses: cogs + opex }
                ]}
                margin={{ top: 10, right: 10, left: 10, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={(val) => `Rp${val / 1000000}M`} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} width={50} />
                <RechartsTooltip formatter={(value: any) => formatRupiah(Number(value))} cursor={{ fill: 'transparent' }} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '11px' }} />
                <Bar dataKey="Revenue" fill="#3b82f6" radius={[4, 4, 0, 0]} maxBarSize={40} />
                <Bar dataKey="Expenses" fill="#f43f5e" radius={[4, 4, 0, 0]} maxBarSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* â”€â”€ P&L Statement â”€â”€ */}
      <div className="rounded-3xl border border-white/60 bg-white/80 backdrop-blur-md shadow-lg shadow-slate-200/40 overflow-hidden">
        {/* Statement Header */}
        <div className="border-b border-zinc-100 bg-gradient-to-r from-zinc-50 to-white px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-zinc-100 p-2">
              <FileText size={16} className="text-zinc-600" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-zinc-800">
                Laporan Laba Rugi
              </h2>
              <p className="text-xs text-zinc-400">
                Periode: 1 {MONTHS[month - 1]} – {new Date(year, month, 0).getDate()} {MONTHS[month - 1]} {year}
              </p>
            </div>
            <div className="ml-auto text-right">
              <p className="text-[11px] text-zinc-400 uppercase tracking-wide">roastd.id</p>
              <p className="text-[11px] text-zinc-400">Dalam Rupiah (IDR)</p>
            </div>
          </div>
        </div>

        {/* â”€â”€ PENDAPATAN â”€â”€ */}
        <SectionHeader label="I. Pendapatan (Revenue)" />
        {revenueBreakdown && revenueBreakdown.length > 0 ? (
          revenueBreakdown.map(item => (
            <LineRow
              key={item.category}
              label={`Penjualan ${CATEGORY_LABELS[item.category] ?? item.category}`}
              value={item.amount}
              indent={1}
              percentage={pct(item.amount, revenue)}
            />
          ))
        ) : (
          <LineRow label="Penjualan Produk" value={revenue} indent={1} percentage={pct(revenue, revenue)} />
        )}
        <LineRow
          label="Total Pendapatan"
          value={revenue}
          bold
          separator="top"
          percentage="100%"
        />

        {/* â”€â”€ HPP / COGS â”€â”€ */}
        <SectionHeader label="II. Harga Pokok Penjualan (HPP / COGS)" />
        {cogsBreakdown && cogsBreakdown.length > 0 ? (
          cogsBreakdown.map(item => (
            <LineRow
              key={item.category}
              label={`HPP ${CATEGORY_LABELS[item.category] ?? item.category}`}
              value={item.amount}
              indent={1}
              percentage={pct(item.amount, revenue)}
            />
          ))
        ) : (
          <LineRow label="HPP Produk Terjual" value={cogs} indent={1} percentage={cogsRatio} />
        )}
        <LineRow
          label="Total HPP"
          value={cogs}
          bold
          separator="top"
          percentage={cogsRatio}
        />

        {/* â”€â”€ LABA KOTOR â”€â”€ */}
        <div className="bg-emerald-50/50 border-y border-emerald-100/80">
          <LineRow
            label="LABA KOTOR (Gross Profit)"
            value={grossProfit}
            bold
            highlight={grossProfit >= 0 ? "positive" : "negative"}
            percentage={grossMargin}
          />
        </div>

        {/* â”€â”€ BEBAN OPERASIONAL â”€â”€ */}
        <SectionHeader label="III. Beban Operasional (OPEX)" />
        {opexBreakdown.length === 0 ? (
          <div className="px-5 py-3">
            <span className="text-sm italic text-zinc-400">
              Tidak ada pengeluaran tercatat bulan ini.
            </span>
          </div>
        ) : (
          opexBreakdown.map((item) => (
            <LineRow
              key={item.category}
              label={CATEGORY_LABELS[item.category] ?? item.category}
              value={item.amount}
              indent={1}
              percentage={pct(item.amount, revenue)}
            />
          ))
        )}
        <LineRow
          label="Total Beban Operasional"
          value={opex}
          bold
          separator="top"
          percentage={opexRatio}
          highlight="negative"
        />

        {/* â”€â”€ LABA BERSIH â”€â”€ */}
        <div className={cn(
          "border-y",
          netProfit >= 0 ? "bg-violet-50/50 border-violet-100/80" : "bg-red-50/50 border-red-100/80"
        )}>
          <LineRow
            label="LABA BERSIH (Net Profit)"
            value={netProfit}
            bold
            separator="double"
            highlight={netProfit >= 0 ? "positive" : "negative"}
            percentage={netMargin}
          />
        </div>

        {/* Statement Footer */}
        <div className="border-t border-zinc-100 bg-zinc-50/60 px-5 py-3">
          <div className="flex items-center justify-between text-[11px] text-zinc-400">
            <span>
              Laporan ini dibuat otomatis oleh roastd.id
            </span>
            <span className="tabular-nums">
              Dicetak: {formatDateLong(getCurrentDate())}
            </span>
          </div>
        </div>
      </div>

      {/* â”€â”€ OPEX Breakdown Visual â”€â”€ */}
      {opexBreakdown.length > 0 && (
        <div className="mt-4 rounded-3xl border border-white/60 bg-white/80 backdrop-blur-md shadow-sm overflow-hidden">
          <div className="border-b border-zinc-100 px-5 py-3">
            <h3 className="text-sm font-semibold text-zinc-700">
              Rincian Beban Operasional
            </h3>
          </div>
          <div className="divide-y divide-zinc-100">
            {opexBreakdown.map((item) => {
              const ratio = opex > 0 ? (item.amount / opex) * 100 : 0;
              return (
                <div key={item.category} className="flex items-center gap-4 px-5 py-3">
                  <div className="min-w-[100px] sm:min-w-[160px] text-sm font-medium text-zinc-700">
                    {CATEGORY_LABELS[item.category] ?? item.category}
                  </div>
                  <div className="flex-1">
                    <div className="h-2 rounded-full bg-zinc-100 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-rose-400 transition-all"
                        style={{ width: `${Math.max(ratio, 2)}%` }}
                      />
                    </div>
                  </div>
                  <div className="text-right min-w-[80px] tabular-nums text-xs font-mono text-zinc-500">
                    {ratio.toFixed(1)}%
                  </div>
                  <div className="text-right min-w-[100px] sm:min-w-[140px] tabular-nums text-sm font-semibold text-zinc-800 font-mono">
                    {formatRupiah(item.amount)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* â”€â”€ Wawasan Bisnis â”€â”€ */}
      <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-4 print:hidden">
        {/* Top Products */}
        <div className="rounded-3xl border border-white/60 bg-gradient-to-br from-white/80 to-blue-50/50 backdrop-blur-md shadow-sm overflow-hidden flex flex-col min-h-[250px]">
          <div className="border-b border-zinc-100/50 px-5 py-3 bg-white/40 flex items-center gap-2">
            <span className="text-blue-500">🏆</span>
            <h3 className="text-sm font-semibold text-slate-700">Top 5 Produk Terlaris</h3>
          </div>
          <div className="p-0 overflow-x-auto">
             <Table>
                <TableHeader>
                   <TableRow className="border-white/40 hover:bg-transparent">
                      <TableHead className="font-bold text-slate-500">Produk</TableHead>
                      <TableHead className="text-right font-bold text-slate-500">Terjual</TableHead>
                      <TableHead className="text-right font-bold text-slate-500">Revenue</TableHead>
                   </TableRow>
                </TableHeader>
                <TableBody>
                   {topProducts && topProducts.length > 0 ? (
                     topProducts.map((p, idx) => (
                       <TableRow key={idx} className="border-white/40 hover:bg-white/60 transition-colors">
                          <TableCell className="font-medium text-slate-700">{p.name}</TableCell>
                          <TableCell className="text-right font-mono text-sm text-slate-600">{p.quantity} <span className="text-[10px] text-slate-400">pcs</span></TableCell>
                          <TableCell className="text-right font-mono text-sm font-semibold text-amber-800">{formatRupiah(p.revenue)}</TableCell>
                       </TableRow>
                     ))
                   ) : (
                     <TableRow>
                        <TableCell colSpan={3} className="text-center py-6 text-sm text-slate-400">Belum ada data penjualan produk</TableCell>
                     </TableRow>
                   )}
                </TableBody>
             </Table>
          </div>
        </div>
        
        {/* Top Customers */}
        <div className="rounded-3xl border border-white/60 bg-gradient-to-br from-white/80 to-amber-50/50 backdrop-blur-md shadow-sm overflow-hidden flex flex-col min-h-[250px]">
          <div className="border-b border-zinc-100/50 px-5 py-3 bg-white/40 flex items-center gap-2">
            <span className="text-amber-500">👑</span>
            <h3 className="text-sm font-semibold text-slate-700">Top 5 Pelanggan Setia</h3>
          </div>
          <div className="p-0 overflow-x-auto">
             <Table>
                <TableHeader>
                   <TableRow className="border-white/40 hover:bg-transparent">
                      <TableHead className="font-bold text-slate-500">Pelanggan</TableHead>
                      <TableHead className="text-center font-bold text-slate-500">Faktur</TableHead>
                      <TableHead className="text-right font-bold text-slate-500">Total Belanja</TableHead>
                   </TableRow>
                </TableHeader>
                <TableBody>
                   {topCustomers && topCustomers.length > 0 ? (
                     topCustomers.map((c, idx) => (
                       <TableRow key={idx} className="border-white/40 hover:bg-white/60 transition-colors">
                          <TableCell className="font-medium text-slate-700">{c.name}</TableCell>
                          <TableCell className="text-center font-mono text-sm text-slate-600">{c.count} <span className="text-[10px] text-slate-400">x</span></TableCell>
                          <TableCell className="text-right font-mono text-sm font-semibold text-amber-700">{formatRupiah(c.revenue)}</TableCell>
                       </TableRow>
                     ))
                   ) : (
                     <TableRow>
                        <TableCell colSpan={3} className="text-center py-6 text-sm text-slate-400">Belum ada data pelanggan grosir/terdaftar</TableCell>
                     </TableRow>
                   )}
                </TableBody>
             </Table>
          </div>
        </div>
      </div>

      {/* â”€â”€ Net Profit Summary â”€â”€ */}
      <div className={cn(
        "mt-4 rounded-3xl border p-5 flex items-center justify-between",
        netProfit >= 0
          ? "border-emerald-200/60 bg-emerald-50/60"
          : "border-red-200/60 bg-red-50/60"
      )}>
        <div className="flex items-center gap-3">
          <div className={cn(
            "rounded-xl p-2.5",
            netProfit >= 0 ? "bg-emerald-100 text-emerald-600" : "bg-red-100 text-red-600"
          )}>
            {netProfit >= 0 ? <TrendingUp size={20} /> : <TrendingDown size={20} />}
          </div>
          <div>
            <p className="text-xs font-medium text-zinc-500">
              Laba Bersih · {MONTHS[month - 1]} {year}
            </p>
            <p className={cn(
              "text-xl font-black font-mono tabular-nums",
              netProfit >= 0 ? "text-emerald-700" : "text-red-600"
            )}>
              {netProfit < 0
                ? `(${formatRupiah(Math.abs(netProfit))})`
                : formatRupiah(netProfit)}
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-xs text-zinc-400">Net Profit Margin</p>
          <p className={cn(
            "text-2xl font-black tabular-nums",
            netProfit >= 0 ? "text-emerald-600" : "text-red-500"
          )}>
            {netMargin}
          </p>
        </div>
      </div>
    </>
  );

  if (hideLayout) return (
    <>
      <div className="mb-4 flex items-center gap-2 print:hidden">
        <Button onClick={() => void exportToExcel(report)} variant="outline" className="h-8 gap-1.5 border-stone-200 bg-white shadow-sm">
          <Download size={14} /> Export Excel
        </Button>
        <Button onClick={() => void exportToPdf(report)} variant="outline" className="h-8 gap-1.5 border-stone-200 bg-white shadow-sm">
          <Download size={14} /> Export PDF
        </Button>
        <Button onClick={() => window.print()} variant="outline" className="h-8 gap-1.5 border-stone-200 bg-white shadow-sm">
          <FileText size={14} /> Cetak
        </Button>
      </div>
      {content}
    </>
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PageHeader
        title="Laporan Laba Rugi"
        eyebrow="Intelligence"
        description={`Profit & Loss Statement · ${MONTHS[month - 1]} ${year}`}
        actions={
          <>
            <MonthNavigator month={month} year={year} />
            <Button onClick={() => void exportToExcel(report)} variant="outline" className="h-8 gap-1.5 border-white/60 bg-white/40 shadow-sm print:hidden">
              <Download size={14} /> Export Excel
            </Button>
            <Button onClick={() => void exportToPdf(report)} variant="outline" className="h-8 gap-1.5 border-white/60 bg-white/40 shadow-sm print:hidden">
              <Download size={14} /> Export PDF
            </Button>
            <Button onClick={() => window.print()} variant="outline" className="h-8 gap-1.5 border-white/60 bg-white/40 shadow-sm print:hidden">
              <FileText size={14} /> Cetak
            </Button>
          </>
        }
        mobileActions={
          <Button onClick={() => void exportToPdf(report)} variant="outline" size="sm" className="gap-1.5 print:hidden">
            <Download size={14} /> PDF
          </Button>
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


