"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  CircleCheck,
  RefreshCw,
  TriangleAlert,
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
import { formatRupiah } from "@/lib/format";
import {
  buildDashboardWorkItems,
  type DashboardWorkItem,
} from "@/lib/dashboard-work-queue";
import type { ActivityItem, DashboardData, LowStockItem } from "../actions";
import { RoasteryCopilot } from "./RoasteryCopilot";
import { PageHeader } from "@/components/layout/PageHeader";
import { CoffeeFlowMini } from "./CoffeeFlowMini";
import { ControlTowerView } from "../../control-tower/_components/ControlTowerView";
import type { getControlTowerData } from "../../control-tower/actions";

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

export function WorkQueue({ items }: { items: DashboardWorkItem[] }) {
  const [showAll, setShowAll] = useState(false);
  const [snoozed, setSnoozed] = useState<Record<string, number>>({});
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    try {
      const stored = localStorage.getItem("ros_snoozed_tasks");
      if (stored) setSnoozed(JSON.parse(stored));
    } catch {}
  }, []);

  const handleSnooze = (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const newSnoozed = { ...snoozed, [id]: Date.now() + 86400000 }; // 24 hours
    setSnoozed(newSnoozed);
    try { localStorage.setItem("ros_snoozed_tasks", JSON.stringify(newSnoozed)); } catch {}
  };

  const activeItems = items.filter((item) => {
    if (!mounted) return true;
    const snoozeUntil = snoozed[item.id];
    return !(snoozeUntil && Date.now() < snoozeUntil);
  });

  const visibleItems = showAll ? activeItems : activeItems.slice(0, 5);
  const hiddenCount = activeItems.length - visibleItems.length;

  return (
    <section className="overflow-hidden rounded-[14px] border border-border bg-card" aria-labelledby="work-queue-title">
      <div className="flex min-h-16 items-center justify-between border-b border-stone-200 px-4 md:px-5">
        <div>
          <p className="font-mono text-[8px] font-bold uppercase tracking-[0.2em] text-primary">Hari ini</p>
          <h2 id="work-queue-title" className="mt-1 text-base font-black tracking-[-0.025em] text-stone-950">Pekerjaan berikutnya</h2>
        </div>
        <span className="inline-flex h-8 min-w-8 items-center justify-center rounded-[8px] bg-obsidian px-2 text-xs font-bold tabular-nums text-[var(--chrome-instrument-soft)]">
          {String(activeItems.length).padStart(2, "0")}
        </span>
      </div>

      {activeItems.length === 0 ? (
        <div className="flex min-h-[260px] flex-col items-center justify-center px-6 text-center">
          <CircleCheck size={30} className="text-emerald-600" />
          <p className="mt-3 text-sm font-semibold text-stone-900">Semua pekerjaan utama sudah beres</p>
          <p className="mt-1 max-w-sm text-xs leading-5 text-stone-500">
            Tidak ada pekerjaan operasional yang perlu ditindaklanjuti sekarang.
          </p>
        </div>
      ) : (
        <div className="flex flex-col">
          <ul className="divide-y divide-stone-100">
            {visibleItems.map((item, index) => (
              <li key={item.id} className="group relative flex">
                <Link
                  href={item.href}
                  className={cn(
                    "flex-1 grid grid-cols-[30px_minmax(0,1fr)_auto] items-center gap-3 px-4 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-stone-900 md:px-5",
                    index === 0 && !showAll ? "min-h-[88px] bg-[var(--surface)] hover:bg-[var(--surface-sunken)]" : "min-h-[66px] hover:bg-stone-50",
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
                  <span className="min-w-0 pr-10 md:pr-12">
                    <span className="mb-0.5 flex items-center gap-2 font-mono text-[8px] font-bold uppercase tracking-[0.16em] text-stone-400">
                      {item.domain}
                      <span
                        className={cn(
                          "rounded-full px-1.5 py-0.5 tracking-[0.08em]",
                          item.status === "BLOCKED"
                            ? "bg-red-50 text-red-700"
                            : item.status === "IN_PROGRESS"
                              ? "bg-sky-50 text-sky-700"
                              : "bg-emerald-50 text-emerald-700",
                        )}
                      >
                        {item.status === "BLOCKED" ? "Terhambat" : item.status === "IN_PROGRESS" ? "Berjalan" : "Siap"}
                      </span>
                    </span>
                    <span className={cn("block font-semibold text-stone-900", index === 0 && !showAll ? "text-sm leading-5" : "truncate text-xs")}>{item.title}</span>
                    <span className="mt-0.5 block truncate text-[11px] text-stone-500">{item.context}</span>
                  </span>
                  <span className="hidden items-center gap-1 text-xs font-bold text-stone-500 group-hover:text-stone-900 sm:inline-flex">
                    {item.actionLabel}
                    <ArrowRight size={13} className="transition-transform group-hover:translate-x-0.5" />
                  </span>
                </Link>
                <button
                  type="button"
                  onClick={(e) => handleSnooze(item.id, e)}
                  title="Tunda pekerjaan ini 24 jam"
                  className="absolute right-4 top-1/2 flex -translate-y-1/2 items-center justify-center rounded-lg p-2 text-stone-400 opacity-0 transition hover:bg-stone-200 hover:text-stone-700 group-hover:opacity-100 sm:right-1/4 md:right-[20%] xl:right-32"
                >
                  <span className="sr-only">Tunda 24 jam</span>
                  <span className="text-[10px] font-bold hidden sm:inline-block mr-1">Tunda</span>
                  <RefreshCw size={13} />
                </button>
              </li>
            ))}
          </ul>
          {hiddenCount > 0 && !showAll && (
            <div className="border-t border-stone-100 bg-stone-50/50 px-4 py-3 text-center">
              <button
                type="button"
                onClick={() => setShowAll(true)}
                className="text-xs font-semibold text-stone-600 hover:text-stone-900 transition-colors"
              >
                Lihat semua ({activeItems.length}) pekerjaan
              </button>
            </div>
          )}
          {showAll && activeItems.length > 5 && (
             <div className="border-t border-stone-100 bg-stone-50/50 px-4 py-3 text-center">
              <button
                type="button"
                onClick={() => setShowAll(false)}
                className="text-xs font-semibold text-stone-600 hover:text-stone-900 transition-colors"
              >
                Ringkas pekerjaan
              </button>
            </div>
          )}
        </div>
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
    <section className="instrument-grid-dark overflow-hidden rounded-[14px] border border-white/10 bg-[var(--chrome-panel)] text-white" aria-labelledby="shift-summary-title">
      <div className="border-b border-white/10 px-5 py-5">
        <p className="font-mono text-[8px] font-bold uppercase tracking-[0.2em] text-[var(--chrome-instrument-soft)]">Shift ledger</p>
        <div className="mt-2 flex items-end justify-between gap-4">
          <div>
            <h2 id="shift-summary-title" className="text-sm font-bold text-white/55">Penjualan hari ini</h2>
            <p className="mt-1 text-[clamp(1.65rem,3vw,2.35rem)] font-black leading-none tracking-[-0.055em] text-white">
              {formatRupiah(data.kpi.revenueToday)}
            </p>
          </div>
          <Link href="/penjualan" className="mb-0.5 text-xs font-bold text-[var(--chrome-instrument-soft)] hover:text-white">Buka</Link>
        </div>
        <div className="mt-5 flex items-center justify-between text-xs text-white/42">
          <span>Kas yang sudah diterima</span>
          <span className="font-bold tabular-nums">{cashRealization.toFixed(0)}%</span>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
          <div className="h-full rounded-full bg-[var(--stage-finance)]" style={{ width: `${cashRealization}%` }} />
        </div>
      </div>

      <dl className="grid grid-cols-2 border-b border-white/10">
        <Link href="/keuangan" className="border-r border-white/10 p-5 hover:bg-white/[0.04]">
          <dt className="font-mono text-[8px] uppercase tracking-[0.16em] text-white/35">Kas masuk</dt>
          <dd className="mt-2 text-sm font-black tabular-nums text-white">{formatRupiah(data.kpi.kasToday)}</dd>
        </Link>
        <Link href="/keuangan" className="p-5 hover:bg-white/[0.04]">
          <dt className="font-mono text-[8px] uppercase tracking-[0.16em] text-white/35">Piutang aktif</dt>
          <dd className="mt-2 text-sm font-black tabular-nums text-[var(--chrome-danger-soft)]">{formatRupiah(data.kpi.totalPiutang)}</dd>
          <dd className="mt-1 text-xs text-white/35">{data.kpi.piutangCount} nota</dd>
        </Link>
      </dl>

      <div className="grid grid-cols-2">
        <Link href="/roasting" className="group border-r border-white/10 p-5 hover:bg-white/[0.04]">
          <p className="text-xs text-white/35">Roasting terakhir</p>
          <p className="mt-1 text-sm font-bold text-white">{brief?.roasting.batchCount ?? 0} batch</p>
          <p className="mt-1 text-xs text-white/30">
            {brief && brief.roasting.inputKg > 0 ? `${brief.roasting.yieldPercent.toFixed(1)}% yield` : "belum ada output"}
          </p>
        </Link>
        <Link href="/produksi" className="group p-5 hover:bg-white/[0.04]">
          <p className="text-xs text-white/35">Produksi terakhir</p>
          <p className="mt-1 text-sm font-bold text-white">{brief?.production.unitsProduced ?? 0} unit</p>
          <p className="mt-1 text-xs text-white/30">{brief?.production.batchCount ?? 0} batch selesai</p>
        </Link>
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
          <p className="font-mono text-[9px] font-bold uppercase tracking-[0.24em] text-[var(--stage-sales)]">Arus penjualan</p>
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
                <stop offset="0%" stopColor="var(--stage-sales)" stopOpacity={0.24} />
                <stop offset="100%" stopColor="var(--stage-sales)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="var(--technical-line)" vertical={false} strokeDasharray="3 4" />
            <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "var(--ink-tertiary)" }} dy={8} />
            <RechartsTooltip
              content={({ active, payload, label }) => active && payload?.length ? (
                <div className="rounded-md border border-stone-200 bg-white px-3 py-2 shadow-lg">
                  <p className="text-xs text-stone-500">{label}</p>
                  <p className="mt-0.5 text-xs font-bold text-stone-900">{formatRupiah(Number(payload[0].value))}</p>
                </div>
              ) : null}
            />
            <Area type="monotone" dataKey="revenue" stroke="var(--stage-sales)" strokeWidth={2} fill="url(#workbenchRevenue)" isAnimationActive={false} />
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
          <p className="font-mono text-[9px] font-bold uppercase tracking-[0.24em] text-[var(--stage-neutral)]">Jejak operasi</p>
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
                <th className="px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-stone-500">Waktu</th>
                <th className="px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-stone-500">Area</th>
                <th className="px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-stone-500">Transaksi</th>
                <th className="px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-stone-500">Status</th>
                <th className="px-5 py-2.5 text-right text-xs font-bold uppercase tracking-wider text-stone-500">Nilai</th>
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
                    <span className="mt-0.5 block font-mono text-xs text-stone-400">{item.code}</span>
                  </td>
                  <td className="px-5 py-3">
                    <span className="inline-flex rounded-full bg-stone-100 px-2 py-1 text-xs font-semibold text-stone-700">{item.status}</span>
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
          <p className="font-mono text-[9px] font-bold uppercase tracking-[0.24em] text-[var(--destructive)]">Risiko pasokan</p>
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
                <p className="text-xs text-stone-500">Batas {item.threshold.toLocaleString("id-ID")} {item.unit}</p>
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

export function DashboardShell({
  data,
  insights,
  controlTower,
}: {
  data: DashboardData;
  insights?: import("@/lib/roastery-intelligence").CopilotInsight[];
  controlTower?: Awaited<ReturnType<typeof getControlTowerData>>;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const workItems = useMemo(() => buildDashboardWorkItems({
    signals: data.operationalQueue,
    lowStock: data.lowStock,
    dailyActions: data.dailyBrief?.actions,
  }), [data]);
  const asOfLabel = mounted
    ? new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(data.asOf))
    : "—";

  return (
    <div data-testid="operations-workbench" className="flex min-h-0 flex-1 flex-col bg-background">
      <PageHeader
        title="Hari ini"
        eyebrow={`Owner · Live ${asOfLabel}`}
        description="Ringkasan operasi roastery Anda hari ini — dari pasokan sampai kas."
        signal={{
          label: "Fokus sekarang",
          value: workItems[0]?.title ?? "Tidak ada hambatan",
          tone: workItems.some((i) => i.severity === "critical")
            ? ("critical" as const)
            : workItems.length > 0
              ? undefined
              : ("ready" as const),
        }}
        metrics={[
          { label: "Penjualan", value: formatRupiah(data.kpi.revenueToday) },
          { label: "Kas masuk", value: formatRupiah(data.kpi.kasToday) },
          { label: "Piutang", value: formatRupiah(data.kpi.totalPiutang) },
          { label: "Yield roast", value: `${data.kpi.averageRoastYield.toFixed(1)}%` },
        ]}
      />

      <main className="custom-scrollbar min-w-0 flex-1 overflow-y-auto" id="main-content">
        <div className="mx-auto w-full max-w-[1600px] space-y-5 p-4 md:p-6 lg:p-7">
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(340px,.55fr)]">
            <WorkQueue items={workItems} />
            <ShiftSummary data={data} />
          </div>

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(340px,.8fr)]">
            <CoffeeFlowMini beliKg={data.coffeeFlowMini.beliKg} diRoastKg={data.coffeeFlowMini.diRoastKg} susutKg={data.coffeeFlowMini.susutKg} />
            <StockWatchlist items={data.lowStock} />
          </div>

          <RevenuePanel data={data} />

          <RoasteryCopilot insights={insights ?? []} />

          {controlTower ? <ControlTowerView data={controlTower} /> : null}

          <ActivityTable items={data.activity} mounted={mounted} />
        </div>
      </main>
    </div>
  );
}
