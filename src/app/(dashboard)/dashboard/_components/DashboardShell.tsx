"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  Banknote,
  Boxes,
  CircleCheck,
  Factory,
  Flame,
  PackagePlus,
  ReceiptText,
  RefreshCw,
  TriangleAlert,
  WalletCards,
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
} from "recharts";
import { cn } from "@/lib/utils";
import { formatKg, formatRupiah } from "@/lib/format";
import type { ActivityItem, DashboardData, LowStockItem } from "../actions";

function formatTimeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days = Math.floor(diff / 86_400_000);
  if (mins < 1) return "baru saja";
  if (mins < 60) return `${mins} menit lalu`;
  if (hours < 24) return `${hours} jam lalu`;
  return `${days} hari lalu`;
}

const ACTIVITY_LABEL: Record<ActivityItem["type"], string> = {
  PURCHASE: "Pembelian",
  ROASTING: "Roasting",
  PRODUCTION: "Produksi",
  SALE: "Penjualan",
};

const ACTIVITY_HREF: Record<ActivityItem["type"], string> = {
  PURCHASE: "/inventory",
  ROASTING: "/roasting",
  PRODUCTION: "/produksi",
  SALE: "/penjualan",
};

type WorkItem = {
  id: string;
  title: string;
  context: string;
  href: string;
  severity: "critical" | "warning";
};

const QUICK_ACTIONS = [
  {
    label: "Terima barang",
    mobileLabel: "Terima",
    href: "/inventory?view=receiving",
    icon: PackagePlus,
    accent: false,
  },
  {
    label: "Mulai roasting",
    mobileLabel: "Roast",
    href: "/roasting",
    icon: Flame,
    accent: false,
  },
  {
    label: "Buka kasir",
    mobileLabel: "Kasir",
    href: "/kasir",
    icon: ReceiptText,
    accent: true,
  },
] as const;

function QuickActions({
  mobile = false,
  onDark = false,
  onSignal = false,
}: {
  mobile?: boolean;
  onDark?: boolean;
  onSignal?: boolean;
}) {
  return (
    <nav
      className={cn(
        mobile ? "grid grid-cols-3 gap-2" : "flex items-center gap-2",
      )}
      aria-label="Aksi cepat operasional"
    >
      {QUICK_ACTIONS.map((action) => {
        const Icon = action.icon;
        return (
          <Link
            key={action.href}
            href={action.href}
            className={cn(
              "group inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border px-3 text-xs font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
              mobile && "min-w-0 flex-col gap-1 px-2 py-2",
              onSignal
                ? action.accent
                  ? "border-[#080B0C] bg-[#080B0C] text-[#FFF7EF] hover:bg-[#111617]"
                  : "border-white/20 bg-white/10 text-white hover:bg-white/16"
                : action.accent
                ? onDark
                  ? "border-primary bg-primary text-primary-foreground hover:bg-primary/90"
                  : "border-primary bg-primary text-primary-foreground hover:bg-primary/90"
                : onDark
                  ? "border-white/15 bg-white/[0.07] text-white hover:border-white/30 hover:bg-white/[0.12]"
                  : "border-stone-200 bg-white text-stone-700 hover:border-stone-300 hover:bg-stone-50",
            )}
          >
            <span
              className={cn(
                "flex items-center justify-center rounded-[8px]",
                mobile ? "h-7 w-7" : "h-6 w-6",
                onDark && !action.accent && "bg-white/[0.08]",
                action.accent && onDark && "bg-[#0A2138]/10",
              )}
            >
              <Icon size={mobile ? 15 : 13} strokeWidth={2.1} />
            </span>
            <span className={mobile ? "truncate" : undefined}>
              {mobile ? action.mobileLabel : action.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}

function buildWorkItems(data: DashboardData): WorkItem[] {
  const actions = (data.dailyBrief?.actions ?? [])
    .filter((action) => action.severity !== "INFO")
    .map((action, index): WorkItem => ({
      id: `brief-${index}`,
      title: action.label,
      context: action.href === "/inventory"
        ? "Persediaan"
        : action.href === "/keuangan"
          ? "Keuangan"
          : action.href === "/audit"
            ? "Integrasi"
            : "Operasi",
      href: action.href,
      severity: action.severity === "CRITICAL" ? "critical" : "warning",
    }));

  if (!actions.some((item) => item.href === "/inventory")) {
    actions.push(
      ...data.lowStock.slice(0, 3).map((item): WorkItem => ({
        id: `stock-${item.id}`,
        title: `${item.name} berada di bawah batas aman`,
        context: `${item.stock.toLocaleString("id-ID")} ${item.unit} tersisa · batas ${item.threshold.toLocaleString("id-ID")} ${item.unit}`,
        href: "/inventory",
        severity: item.stock <= 0 ? "critical" : "warning",
      })),
    );
  }

  if (data.kpi.piutangCount > 0 && !actions.some((item) => item.href === "/keuangan")) {
    actions.push({
      id: "receivables",
      title: `${data.kpi.piutangCount} nota belum selesai dibayar`,
      context: `${formatRupiah(data.kpi.totalPiutang)} masih berada di piutang`,
      href: "/keuangan",
      severity: "warning",
    });
  }

  return actions.slice(0, 6);
}

function CompactDashboardHeader({
  data,
  items,
  asOfLabel,
}: {
  data: DashboardData;
  items: WorkItem[];
  asOfLabel: string;
}) {
  const criticalCount = items.filter((item) => item.severity === "critical").length;
  const signal = data.lowStock.length > 0
    ? `${data.lowStock.length} stok perlu dipulihkan`
    : data.kpi.piutangCount > 0
      ? `${data.kpi.piutangCount} nota belum menjadi kas`
      : "Tidak ada hambatan";

  const brief = data.dailyBrief;
  const stages = [
    {
      number: "01",
      label: "Pasokan",
      status: data.lowStock.length > 0 ? `${data.lowStock.length} item` : "OK",
      href: "/inventory",
      icon: Boxes,
      attention: data.lowStock.length > 0,
      tone: "border-[#2B7567]/60 bg-[#2B7567]/16 text-[#87CDBC]",
      line: "bg-[#2B7567]",
    },
    {
      number: "02",
      label: "Roasting",
      status: `${brief?.roasting.batchCount ?? 0} batch`,
      href: "/roasting",
      icon: Flame,
      attention: false,
      tone: "border-[#B65331]/60 bg-[#B65331]/16 text-[#E9A17F]",
      line: "bg-[#B65331]",
    },
    {
      number: "03",
      label: "Produksi",
      status: `${brief?.production.unitsProduced ?? 0} unit`,
      href: "/produksi",
      icon: Factory,
      attention: false,
      tone: "border-[#A66F12]/60 bg-[#A66F12]/16 text-[#E0BC67]",
      line: "bg-[#A66F12]",
    },
    {
      number: "04",
      label: "Penjualan",
      status: formatRupiah(data.kpi.revenueToday),
      href: "/penjualan",
      icon: ReceiptText,
      attention: false,
      tone: "border-[#6F4A6A]/60 bg-[#6F4A6A]/16 text-[#C7A8C4]",
      line: "bg-[#6F4A6A]",
    },
    {
      number: "05",
      label: "Kas",
      status: formatRupiah(data.kpi.kasToday),
      href: "/keuangan",
      icon: WalletCards,
      attention: data.kpi.piutangCount > 0,
      tone: "border-[#4B6B3C]/60 bg-[#4B6B3C]/16 text-[#A8C390]",
      line: "bg-[#4B6B3C]",
    },
  ];

  return (
    <header
      data-testid="compact-dashboard-header"
      className="instrument-grid-dark relative shrink-0 border-b border-white/10 bg-[#05090D] text-white"
    >
      {/* Top bar: Eyebrow + KPIs */}
      <div className="mx-auto flex w-full max-w-[1600px] flex-wrap items-center justify-between gap-3 px-4 py-2 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-center gap-3">
          <span className="font-mono text-[9px] font-bold uppercase tracking-[0.24em] text-[#69E8F3]">
            Owner control room
          </span>
          <span className="h-px w-8 bg-[#00C8DF]" aria-hidden />
          <span className="inline-flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-[0.16em] text-white/38">
            <span className="h-1.5 w-1.5 rounded-full bg-[#00C8DF] shadow-[0_0_10px_rgba(0,200,223,.55)]" />
            Live · {asOfLabel}
          </span>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span className="font-mono text-[8px] uppercase tracking-[0.12em] text-white/30">Penjualan</span>
            <span className="text-xs font-bold tabular-nums text-white/80">{formatRupiah(data.kpi.revenueToday)}</span>
          </div>
          <div className="hidden h-3 w-px bg-white/10 sm:block" />
          <div className="hidden items-center gap-1.5 sm:flex">
            <span className="font-mono text-[8px] uppercase tracking-[0.12em] text-white/30">Kas</span>
            <span className="text-xs font-bold tabular-nums text-white/80">{formatRupiah(data.kpi.kasToday)}</span>
          </div>
          <div className="hidden h-3 w-px bg-white/10 sm:block" />
          <div className="hidden items-center gap-1.5 sm:flex">
            <span className="font-mono text-[8px] uppercase tracking-[0.12em] text-white/30">Yield</span>
            <span className="text-xs font-bold tabular-nums text-white/80">{data.kpi.averageRoastYield.toFixed(1)}%</span>
          </div>
        </div>
      </div>

      {/* Signal bar */}
      <div className="border-t border-white/[0.06] bg-[#0B141B]/60">
        <div className="mx-auto flex w-full max-w-[1600px] items-center gap-4 px-4 py-2 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2">
            <span className={cn(
              "h-2 w-2 rounded-full",
              criticalCount > 0 ? "bg-[#FF8C88] shadow-[0_0_8px_rgba(255,140,136,.5)]" : "bg-[#22C55E]",
            )} />
            <span className={cn(
              "text-sm font-bold",
              criticalCount > 0 ? "text-[#FF8C88]" : "text-[#22C55E]",
            )}>
              {signal}
            </span>
          </div>
          {criticalCount > 0 && (
            <span className="rounded-[6px] border border-[#FF8C88]/30 bg-[#4C0302] px-2 py-0.5 font-mono text-[8px] uppercase tracking-[0.14em] text-[#FFB0AD]">
              {criticalCount} kritis
            </span>
          )}
        </div>
      </div>

      {/* 5-stage pipeline */}
      <div className="border-t border-white/[0.06]">
        <div className="mx-auto grid w-full max-w-[1600px] grid-cols-5">
          {stages.map(({ number, label, status, href, icon: Icon, attention, tone, line }, index) => (
            <Link
              key={label}
              href={href}
              className="group relative min-w-0 border-r border-white/10 px-2 py-3 last:border-r-0 hover:bg-white/[0.045] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#00C8DF] sm:px-4 sm:py-4"
            >
              {index > 0 && (
                <span
                  className={cn(
                    "absolute -left-px top-[18px] h-px w-3 -translate-x-1/2 sm:w-5",
                    attention ? "bg-[#8C2F39]" : line,
                  )}
                  aria-hidden
                />
              )}
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    "relative z-10 flex h-6 w-6 items-center justify-center rounded-[6px] border sm:h-7 sm:w-7",
                    attention
                      ? "border-[#FF8C88]/30 bg-[#4C0302] text-[#FFB0AD]"
                      : tone,
                  )}
                  aria-label={`Tahap ${number}: ${label}`}
                >
                  <Icon size={11} strokeWidth={2.1} />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-[8px] font-bold text-white/55 sm:text-[10px]">
                    {label}
                  </p>
                  <p
                    className={cn(
                      "mt-0.5 truncate text-[9px] font-bold tabular-nums sm:text-xs",
                      attention ? "text-[#FF8C88]" : "text-white",
                    )}
                  >
                    {status}
                  </p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </header>
  );
}

function WorkQueue({ items }: { items: WorkItem[] }) {
  return (
    <section className="overflow-hidden rounded-[14px] border border-border bg-card" aria-labelledby="work-queue-title">
      <div className="flex min-h-16 items-center justify-between border-b border-stone-200 px-4 md:px-5">
        <div>
          <p className="font-mono text-[8px] font-bold uppercase tracking-[0.2em] text-primary">Decision queue</p>
          <h2 id="work-queue-title" className="mt-1 text-base font-black tracking-[-0.025em] text-stone-950">Yang perlu diputuskan</h2>
        </div>
        <span className="inline-flex h-8 min-w-8 items-center justify-center rounded-[8px] bg-[#05090D] px-2 text-xs font-bold tabular-nums text-[#8EF3FC]">
          {String(items.length).padStart(2, "0")}
        </span>
      </div>

      {items.length === 0 ? (
        <div className="flex min-h-[260px] flex-col items-center justify-center px-6 text-center">
          <CircleCheck size={30} className="text-emerald-600" />
          <p className="mt-3 text-sm font-semibold text-stone-900">Tidak ada pengecualian aktif</p>
          <p className="mt-1 max-w-sm text-xs leading-5 text-stone-500">
            Stok, piutang, dan integrasi tidak memerlukan tindakan segera.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-stone-100">
          {items.map((item, index) => (
            <li key={item.id}>
              <Link
                href={item.href}
                className={cn(
                  "group grid grid-cols-[30px_minmax(0,1fr)_auto] items-center gap-3 px-4 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-stone-900 md:px-5",
                  index === 0 ? "min-h-[88px] bg-[#f3f9fa] hover:bg-[#e9f5f7]" : "min-h-[66px] hover:bg-stone-50",
                )}
              >
                <span
                  className={cn(
                    "flex h-7 w-7 items-center justify-center rounded-full",
                    item.severity === "critical"
                      ? "bg-red-50 text-red-700"
                      : "bg-amber-50 text-amber-700",
                  )}
                >
                  {item.severity === "critical" ? <TriangleAlert size={15} /> : <AlertTriangle size={15} />}
                </span>
                <span className="min-w-0">
                  <span className={cn("block font-semibold text-stone-900", index === 0 ? "text-sm leading-5" : "truncate text-xs")}>{item.title}</span>
                  <span className="mt-0.5 block truncate text-[11px] text-stone-500">{item.context}</span>
                </span>
                <ArrowRight size={14} className="text-stone-300 transition-transform group-hover:translate-x-0.5 group-hover:text-stone-700" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function ShiftSummary({ data }: { data: DashboardData }) {
  const brief = data.dailyBrief;
  const cashRealization = data.kpi.revenueToday > 0
    ? Math.min(100, (data.kpi.kasToday / data.kpi.revenueToday) * 100)
    : data.kpi.kasToday > 0 ? 100 : 0;

  return (
    <section className="instrument-grid-dark overflow-hidden rounded-[14px] border border-white/10 bg-[#0B141B] text-white" aria-labelledby="shift-summary-title">
      <div className="border-b border-white/10 px-5 py-5">
        <p className="font-mono text-[8px] font-bold uppercase tracking-[0.2em] text-[#69E8F3]">Shift ledger</p>
        <div className="mt-2 flex items-end justify-between gap-4">
          <div>
            <h2 id="shift-summary-title" className="text-sm font-bold text-white/55">Penjualan hari ini</h2>
            <p className="mt-1 text-[clamp(1.65rem,3vw,2.35rem)] font-black leading-none tracking-[-0.055em] text-white">
              {formatRupiah(data.kpi.revenueToday)}
            </p>
          </div>
          <Link href="/penjualan" className="mb-0.5 text-xs font-bold text-[#69E8F3] hover:text-white">Buka</Link>
        </div>
        <div className="mt-5 flex items-center justify-between text-[10px] text-white/42">
          <span>Kas yang sudah diterima</span>
          <span className="font-bold tabular-nums">{cashRealization.toFixed(0)}%</span>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
          <div className="h-full rounded-full bg-[#4B6B3C]" style={{ width: `${cashRealization}%` }} />
        </div>
      </div>

      <dl className="grid grid-cols-2 border-b border-white/10">
        <Link href="/keuangan" className="border-r border-white/10 p-5 hover:bg-white/[0.04]">
          <dt className="font-mono text-[8px] uppercase tracking-[0.16em] text-white/35">Kas masuk</dt>
          <dd className="mt-2 text-sm font-black tabular-nums text-white">{formatRupiah(data.kpi.kasToday)}</dd>
        </Link>
        <Link href="/keuangan" className="p-5 hover:bg-white/[0.04]">
          <dt className="font-mono text-[8px] uppercase tracking-[0.16em] text-white/35">Piutang aktif</dt>
          <dd className="mt-2 text-sm font-black tabular-nums text-[#FF8C88]">{formatRupiah(data.kpi.totalPiutang)}</dd>
          <dd className="mt-1 text-[10px] text-white/35">{data.kpi.piutangCount} nota</dd>
        </Link>
      </dl>

      <div className="grid grid-cols-2">
        <Link href="/roasting" className="group border-r border-white/10 p-5 hover:bg-white/[0.04]">
          <p className="text-[10px] text-white/35">Roasting terakhir</p>
          <p className="mt-1 text-sm font-bold text-white">{brief?.roasting.batchCount ?? 0} batch</p>
          <p className="mt-1 text-[10px] text-white/30">
            {brief && brief.roasting.inputKg > 0 ? `${brief.roasting.yieldPercent.toFixed(1)}% yield` : "belum ada output"}
          </p>
        </Link>
        <Link href="/produksi" className="group p-5 hover:bg-white/[0.04]">
          <p className="text-[10px] text-white/35">Produksi terakhir</p>
          <p className="mt-1 text-sm font-bold text-white">{brief?.production.unitsProduced ?? 0} unit</p>
          <p className="mt-1 text-[10px] text-white/30">{brief?.production.batchCount ?? 0} batch selesai</p>
        </Link>
      </div>
    </section>
  );
}

function OperationalStatus({ data }: { data: DashboardData }) {
  const brief = data.dailyBrief;
  const stages = [
    {
      number: "01",
      label: "Pasokan",
      status: data.lowStock.length > 0 ? "Perlu tindakan" : "Terkendali",
      detail: data.lowStock.length > 0 ? `${data.lowStock.length} item di bawah batas` : "Tidak ada stok kritis",
      href: "/inventory",
      icon: Boxes,
      attention: data.lowStock.length > 0,
      tone: "border-[#2B7567]/60 bg-[#2B7567]/16 text-[#87CDBC]",
      line: "bg-[#2B7567]",
    },
    {
      number: "02",
      label: "Roasting",
      status: `${brief?.roasting.batchCount ?? 0} batch`,
      detail: brief && brief.roasting.inputKg > 0 ? `${brief.roasting.yieldPercent.toFixed(1)}% yield` : "Belum ada batch kemarin",
      href: "/roasting",
      icon: Flame,
      attention: false,
      tone: "border-[#B65331]/60 bg-[#B65331]/16 text-[#E9A17F]",
      line: "bg-[#B65331]",
    },
    {
      number: "03",
      label: "Produksi",
      status: `${brief?.production.unitsProduced ?? 0} unit`,
      detail: `${brief?.production.batchCount ?? 0} batch selesai`,
      href: "/produksi",
      icon: Factory,
      attention: false,
      tone: "border-[#A66F12]/60 bg-[#A66F12]/16 text-[#E0BC67]",
      line: "bg-[#A66F12]",
    },
    {
      number: "04",
      label: "Penjualan",
      status: formatRupiah(data.kpi.revenueToday),
      detail: "Nilai nota hari ini",
      href: "/penjualan",
      icon: ReceiptText,
      attention: false,
      tone: "border-[#6F4A6A]/60 bg-[#6F4A6A]/16 text-[#C7A8C4]",
      line: "bg-[#6F4A6A]",
    },
    {
      number: "05",
      label: "Kas",
      status: formatRupiah(data.kpi.kasToday),
      detail: data.kpi.piutangCount > 0 ? `${data.kpi.piutangCount} nota belum lunas` : "Piutang bersih",
      href: "/keuangan",
      icon: WalletCards,
      attention: data.kpi.piutangCount > 0,
      tone: "border-[#4B6B3C]/60 bg-[#4B6B3C]/16 text-[#A8C390]",
      line: "bg-[#4B6B3C]",
    },
  ];

  return (
    <section className="instrument-grid-dark overflow-hidden rounded-[14px] border border-white/10 bg-[#0B141B] text-white" aria-labelledby="operations-status-title">
      <div className="flex min-h-16 items-center justify-between border-b border-white/10 px-4 md:px-5">
        <div>
          <p className="font-mono text-[8px] font-bold uppercase tracking-[0.2em] text-[#69E8F3]">Live roastery flow</p>
          <h2 id="operations-status-title" className="mt-1 text-base font-black tracking-[-0.025em] text-white">
            Bahan bergerak sampai menjadi kas
          </h2>
        </div>
        <Link href="/laporan" className="hidden text-xs font-semibold text-white/42 hover:text-[#69E8F3] sm:inline">
          Buka laporan
        </Link>
      </div>
      <div className="grid grid-cols-5">
        {stages.map(({ number, label, status, detail, href, icon: Icon, attention, tone, line }, index) => (
          <Link
            key={label}
            href={href}
            className="group relative min-w-0 border-r border-white/10 px-2 py-5 last:border-r-0 hover:bg-white/[0.045] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#00C8DF] sm:px-4 sm:py-6"
          >
            {index > 0 && (
              <span
                className={cn(
                  "absolute -left-px top-[34px] h-px w-4 -translate-x-1/2 sm:w-7",
                  attention ? "bg-[#8C2F39]" : line,
                )}
                aria-hidden
              />
            )}
            <div className="flex items-center justify-between gap-1">
              <span
                className={cn(
                  "relative z-10 flex h-8 w-8 items-center justify-center rounded-[8px] border sm:h-9 sm:w-9",
                  attention
                    ? "border-[#FF8C88]/30 bg-[#4C0302] text-[#FFB0AD]"
                    : tone,
                )}
                aria-label={`Tahap ${number}: ${label}`}
              >
                <Icon size={14} strokeWidth={2.1} />
              </span>
              <ArrowRight size={13} className="hidden text-white/20 transition-transform group-hover:translate-x-0.5 group-hover:text-[#69E8F3] sm:block" />
            </div>
            <div className="mt-3 min-w-0">
              <p className="truncate text-[9px] font-bold text-white/55 sm:text-xs">
                {label}
              </p>
              <p
                className={cn(
                  "mt-1 truncate text-[8px] font-bold tabular-nums sm:text-sm",
                  attention ? "text-[#FF8C88]" : "text-white",
                )}
              >
                {status}
              </p>
              <p className="mt-1 hidden truncate text-[10px] text-white/30 lg:block">{detail}</p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

function RevenuePanel({ data }: { data: DashboardData }) {
  const total = data.revenueTrend.reduce((sum, item) => sum + item.revenue, 0);
  return (
    <section className="rounded-[14px] border border-border bg-card p-4 md:p-5" aria-labelledby="revenue-title">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-mono text-[9px] font-bold uppercase tracking-[0.24em] text-[#6F4A6A]">Arus penjualan</p>
          <h2 id="revenue-title" className="text-sm font-bold text-stone-900">Pendapatan 7 hari</h2>
          <p className="mt-1 text-xl font-bold tabular-nums tracking-tight text-stone-900">{formatRupiah(total)}</p>
        </div>
        <Link href="/laporan" className="inline-flex min-h-9 items-center rounded-md px-2.5 text-xs font-semibold text-stone-600 hover:bg-stone-100">
          Detail
        </Link>
      </div>
      <div className="mt-4 h-40">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data.revenueTrend} margin={{ top: 8, right: 4, left: 4, bottom: 0 }}>
            <defs>
              <linearGradient id="workbenchRevenue" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#6F4A6A" stopOpacity={0.24} />
                <stop offset="100%" stopColor="#6F4A6A" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="#e7e5e4" vertical={false} strokeDasharray="3 4" />
            <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "#78716c" }} dy={8} />
            <RechartsTooltip
              content={({ active, payload, label }) => active && payload?.length ? (
                <div className="rounded-md border border-stone-200 bg-white px-3 py-2 shadow-lg">
                  <p className="text-[10px] text-stone-500">{label}</p>
                  <p className="mt-0.5 text-xs font-bold text-stone-900">{formatRupiah(Number(payload[0].value))}</p>
                </div>
              ) : null}
            />
            <Area type="monotone" dataKey="revenue" stroke="#6F4A6A" strokeWidth={2} fill="url(#workbenchRevenue)" isAnimationActive={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}

function ActivityTable({ items, mounted }: { items: ActivityItem[]; mounted: boolean }) {
  return (
    <section className="overflow-hidden rounded-[14px] border border-border bg-card" aria-labelledby="activity-title">
      <div className="flex min-h-14 items-center justify-between border-b border-stone-200 px-4 md:px-5">
        <div>
          <p className="font-mono text-[9px] font-bold uppercase tracking-[0.24em] text-[#426C7A]">Jejak operasi</p>
          <h2 id="activity-title" className="text-sm font-bold text-stone-900">Aktivitas terbaru</h2>
          <p className="text-xs text-stone-500">Transaksi lintas area kerja</p>
        </div>
        <Link href="/audit" className="text-xs font-semibold text-stone-600 hover:text-stone-900">Lihat audit</Link>
      </div>
      {items.length === 0 ? (
        <div className="flex min-h-48 items-center justify-center text-xs text-stone-500">Belum ada aktivitas.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse text-left">
            <thead>
              <tr className="border-b border-stone-100 bg-stone-50/70">
                <th className="px-5 py-2.5 text-[10px] font-bold uppercase tracking-wider text-stone-500">Waktu</th>
                <th className="px-5 py-2.5 text-[10px] font-bold uppercase tracking-wider text-stone-500">Area</th>
                <th className="px-5 py-2.5 text-[10px] font-bold uppercase tracking-wider text-stone-500">Transaksi</th>
                <th className="px-5 py-2.5 text-[10px] font-bold uppercase tracking-wider text-stone-500">Status</th>
                <th className="px-5 py-2.5 text-right text-[10px] font-bold uppercase tracking-wider text-stone-500">Nilai</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {items.slice(0, 8).map((item) => (
                <tr key={`${item.type}-${item.id}`} className="hover:bg-stone-50/80">
                  <td className="whitespace-nowrap px-5 py-3 text-[11px] text-stone-500">{mounted ? formatTimeAgo(item.timestamp) : "—"}</td>
                  <td className="px-5 py-3">
                    <Link href={ACTIVITY_HREF[item.type]} className="text-xs font-semibold text-stone-700 hover:text-stone-950">
                      {ACTIVITY_LABEL[item.type]}
                    </Link>
                  </td>
                  <td className="px-5 py-3">
                    <span className="block text-xs font-medium text-stone-900">{item.description}</span>
                    <span className="mt-0.5 block font-mono text-[10px] text-stone-400">{item.code}</span>
                  </td>
                  <td className="px-5 py-3">
                    <span className="inline-flex rounded-full bg-stone-100 px-2 py-1 text-[10px] font-semibold text-stone-700">{item.status}</span>
                  </td>
                  <td className="whitespace-nowrap px-5 py-3 text-right text-xs font-semibold tabular-nums text-stone-900">
                    {item.amount === null ? "—" : formatRupiah(item.amount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function StockWatchlist({ items }: { items: LowStockItem[] }) {
  return (
    <section className="overflow-hidden rounded-[14px] border border-border bg-card" aria-labelledby="stock-watch-title">
      <div className="flex min-h-14 items-center justify-between border-b border-stone-200 px-4 md:px-5">
        <div>
          <p className="font-mono text-[9px] font-bold uppercase tracking-[0.24em] text-[#4C0302]">Risiko pasokan</p>
          <h2 id="stock-watch-title" className="text-sm font-bold text-stone-900">Pantauan stok</h2>
          <p className="text-xs text-stone-500">Item di bawah batas aman</p>
        </div>
        <Link href="/inventory" className="text-xs font-semibold text-stone-600 hover:text-stone-900">Buka stok</Link>
      </div>
      {items.length === 0 ? (
        <div className="flex min-h-[210px] flex-col items-center justify-center px-6 text-center">
          <CircleCheck size={26} className="text-emerald-600" />
          <p className="mt-2 text-xs font-semibold text-stone-900">Stok dalam batas aman</p>
        </div>
      ) : (
        <ul className="divide-y divide-stone-100">
          {items.slice(0, 5).map((item) => (
            <li key={item.id} className="grid min-h-[52px] grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-4 md:px-5">
              <div className="min-w-0">
                <p className="truncate text-xs font-semibold text-stone-900">{item.name}</p>
                <p className="text-[10px] text-stone-500">Batas {item.threshold.toLocaleString("id-ID")} {item.unit}</p>
              </div>
              <span className={cn("text-xs font-bold tabular-nums", item.stock <= 0 ? "text-red-700" : "text-amber-700")}>
                {item.stock.toLocaleString("id-ID")} {item.unit}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function DashboardShell({ data }: { data: DashboardData }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const workItems = useMemo(() => buildWorkItems(data), [data]);
  const asOfLabel = mounted
    ? new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(data.asOf))
    : "—";

  return (
    <div data-testid="operations-workbench" className="flex min-h-0 flex-1 flex-col bg-background">
      <CompactDashboardHeader data={data} items={workItems} asOfLabel={asOfLabel} />

      <main className="custom-scrollbar min-w-0 flex-1 overflow-y-auto" id="main-content">
        <div className="mx-auto w-full max-w-[1600px] space-y-5 p-4 md:p-6 lg:p-7">
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(340px,.55fr)]">
            <WorkQueue items={workItems} />
            <ShiftSummary data={data} />
          </div>

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(320px,.75fr)]">
            <RevenuePanel data={data} />
            <StockWatchlist items={data.lowStock} />
          </div>

          <ActivityTable items={data.activity} mounted={mounted} />

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-stone-200 pt-1 text-[11px] text-stone-500">
            <span className="inline-flex items-center gap-1.5">
              <RefreshCw size={12} />
              Data dashboard disusun dari transaksi tenant aktif.
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Banknote size={12} />
              Piutang aktif {formatRupiah(data.kpi.totalPiutang)} · kopi terjual {formatKg(data.kpi.totalKopiTerjual)}
            </span>
          </div>
        </div>
      </main>
    </div>
  );
}
