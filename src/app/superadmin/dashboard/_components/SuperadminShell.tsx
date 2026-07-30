"use client";

import Link from "next/link";
import {
  Activity,
  ArrowUpRight,
  Banknote,
  Building2,
  CircleAlert,
  CreditCard,
  Radio,
  ServerCog,
  ShieldCheck,
  Users,
} from "lucide-react";

import { RecentTenants } from "./RecentTenants";
import { TenantGrowthChart } from "./TenantGrowthChart";

type AccessState = "ACTIVE" | "INACTIVE" | "SUBSCRIPTION_REQUIRED";

interface SuperadminData {
  totalTenants: number;
  activeTenants: number;
  newTenantsThisMonth: number;
  mrr: number;
  totalGmv: number;
  growthData: Array<{ name: string; tenants: number }>;
  recentTenants: Array<{
    id: string;
    name: string;
    subdomain: string | null;
    tier: string;
    status: string;
    createdAt: string;
    accessState: AccessState;
  }>;
  attentionTenants: Array<{
    id: string;
    name: string;
    code: string;
    reason: string;
    severity: "warning" | "critical";
  }>;
  planDistribution: Array<{ tier: string; count: number }>;
  connectorTotal: number;
  connectorOnline: number;
  connectorOffline: number;
  pendingPayments: number;
  failedImports24h: number;
  failedJobs24h: number;
  generatedAt: string;
}

function formatCompactIDR(value: number) {
  if (value >= 1_000_000_000) return `Rp ${(value / 1_000_000_000).toLocaleString("id-ID", { maximumFractionDigits: 1 })} M`;
  if (value >= 1_000_000) return `Rp ${(value / 1_000_000).toLocaleString("id-ID", { maximumFractionDigits: 1 })} jt`;
  if (value >= 1_000) return `Rp ${(value / 1_000).toLocaleString("id-ID", { maximumFractionDigits: 0 })} rb`;
  return `Rp ${value.toLocaleString("id-ID")}`;
}

function Metric({
  label,
  value,
  note,
  icon,
  href,
}: {
  label: string;
  value: string;
  note: string;
  icon: React.ReactNode;
  href?: string;
}) {
  const content = (
    <>
      <div className="flex items-center justify-between gap-3">
        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">{label}</span>
        <span className="text-muted-foreground transition-colors group-hover:text-primary">{icon}</span>
      </div>
      <p className="mt-4 whitespace-nowrap text-[clamp(1.6rem,2.2vw,2.15rem)] font-black leading-none tracking-[-0.055em] tabular-nums lg:mt-6">{value}</p>
      <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{note}</p>
    </>
  );
  const className = "group border-t border-border px-5 py-5 first:border-t-0 md:px-6 lg:border-l lg:border-t-0 lg:first:border-l-0";
  return href ? <Link href={href} className={`${className} transition-colors hover:bg-muted/50`}>{content}</Link> : <div className={className}>{content}</div>;
}

function PlatformPulse({ data }: { data: SuperadminData }) {
  const incidentCount = data.failedImports24h + data.failedJobs24h;
  const status = data.failedJobs24h > 0
    ? "Pekerjaan sistem perlu diperiksa"
    : data.failedImports24h > 0
      ? "Ada sinkronisasi yang gagal"
      : "Operasional normal";

  return (
    <section
      className="relative overflow-hidden bg-[#080B0C] text-white"
      style={{
        backgroundImage: "linear-gradient(rgba(255,255,255,.035) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.035) 1px, transparent 1px)",
        backgroundSize: "44px 44px",
      }}
    >
      <div className="absolute inset-y-0 left-0 w-1 bg-[#B65331]" />
      <div className="relative grid gap-8 p-6 md:p-8 xl:grid-cols-[1.35fr_1fr] xl:items-end">
        <div>
          <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.24em] text-white/45">
            <Radio size={13} className={incidentCount > 0 ? "text-amber-400" : "text-[#67D8C8]"} />
            Platform pulse
          </div>
          <p className="mt-5 max-w-3xl text-3xl font-black leading-[1.05] tracking-[-0.05em] md:text-5xl">
            {status}
          </p>
          <p className="mt-4 max-w-xl text-sm leading-6 text-white/55">
            Ringkasan nyata dari subscription, konektor Studio, import roasting, dan pekerjaan otomatis—bukan status dekoratif.
          </p>
        </div>

        <div className="grid grid-cols-3 border border-white/10 bg-black/20">
          <PulseReading label="Studio" value={`${data.connectorOnline}/${data.connectorTotal}`} tone={data.connectorOffline > 0 ? "warn" : "good"} href="/superadmin/studio" />
          <PulseReading label="Import · 24j" value={String(data.failedImports24h)} tone={data.failedImports24h > 0 ? "bad" : "good"} href="/superadmin/incidents" />
          <PulseReading label="Job · 24j" value={String(data.failedJobs24h)} tone={data.failedJobs24h > 0 ? "bad" : "good"} href="/superadmin/incidents" />
        </div>
      </div>
    </section>
  );
}

function PulseReading({ label, value, tone, href }: { label: string; value: string; tone: "good" | "warn" | "bad"; href: string }) {
  const dot = tone === "good" ? "bg-[#67D8C8]" : tone === "warn" ? "bg-amber-400" : "bg-red-400";
  return (
    <Link href={href} className="min-w-0 border-l border-white/10 p-4 transition-colors first:border-l-0 hover:bg-white/5">
      <div className="flex items-center gap-2">
        <span className={`size-1.5 shrink-0 rounded-full ${dot}`} />
        <span className="truncate text-[9px] font-bold uppercase tracking-[0.14em] text-white/40">{label}</span>
      </div>
      <p className="mt-3 font-mono text-xl font-bold tabular-nums text-white">{value}</p>
    </Link>
  );
}

export function SuperadminShell({ data }: { data: SuperadminData }) {
  const generatedAt = new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(data.generatedAt));
  const maxPlanCount = Math.max(1, ...data.planDistribution.map((plan) => plan.count));

  return (
    <div className="min-h-full bg-background text-foreground">
      <header className="border-b border-border bg-card px-5 py-6 md:px-8">
        <div className="mx-auto flex max-w-[1480px] flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <p className="mb-3 text-[10px] font-black uppercase tracking-[0.24em] text-domain-roasting">Roastd control room</p>
            <h1 className="text-3xl font-black tracking-[-0.05em] md:text-4xl">Kendalikan platform, bukan tabel.</h1>
            <p className="mt-2 text-sm text-muted-foreground">Prioritas tenant, pendapatan, dan kesehatan integrasi dalam satu pandangan.</p>
          </div>
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Diperbarui {generatedAt}</p>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-[1480px] flex-col gap-6 p-5 md:p-8">
        <PlatformPulse data={data} />

        <section className="grid border border-border bg-card lg:grid-cols-4">
          <Metric label="MRR terukur" value={formatCompactIDR(data.mrr)} note="Dari paket aktif berharga tetap" icon={<Banknote size={17} />} />
          <Metric label="GMV jaringan" value={formatCompactIDR(data.totalGmv)} note="Invoice issued, partial, dan paid" icon={<Activity size={17} />} />
          <Metric label="Tenant aktif" value={`${data.activeTenants}/${data.totalTenants}`} note={`${data.newTenantsThisMonth} baru bulan ini`} icon={<Building2 size={17} />} />
          <Metric label="Pembayaran tertahan" value={String(data.pendingPayments)} note="Subscription menunggu penyelesaian" icon={<CreditCard size={17} />} href="/superadmin/subscriptions" />
        </section>

        <div className="grid gap-6 xl:grid-cols-[1.55fr_.85fr]">
          <section className="border border-border bg-card p-5 md:p-7">
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <p className="text-[9px] font-black uppercase tracking-[0.22em] text-domain-inventory">Network trajectory</p>
                <h2 className="mt-2 text-xl font-black tracking-[-0.035em]">Pertumbuhan roastery</h2>
                <p className="mt-1 text-xs text-muted-foreground">Basis tenant kumulatif selama enam bulan.</p>
              </div>
              <Users size={20} className="text-domain-inventory" />
            </div>
            <div className="h-72 md:h-80">
              <TenantGrowthChart data={data.growthData} />
            </div>
          </section>

          <section className="flex flex-col border border-border bg-card">
            <div className="flex items-start justify-between border-b border-border p-5 md:p-6">
              <div>
                <p className="text-[9px] font-black uppercase tracking-[0.22em] text-domain-production">Action queue</p>
                <h2 className="mt-2 text-xl font-black tracking-[-0.035em]">Perlu tindakan</h2>
              </div>
              <span className="flex size-9 items-center justify-center bg-domain-production/10 text-domain-production">
                <CircleAlert size={18} />
              </span>
            </div>
            <div className="flex-1 divide-y divide-border">
              {data.attentionTenants.map((tenant) => (
                <div key={tenant.id} className="flex items-center gap-3 p-4 md:px-6">
                  <span className={`h-8 w-1 shrink-0 ${tenant.severity === "critical" ? "bg-red-500" : "bg-amber-400"}`} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold">{tenant.name}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{tenant.reason}</p>
                  </div>
                  <span className="font-mono text-[10px] text-muted-foreground">{tenant.code}</span>
                </div>
              ))}
              {data.attentionTenants.length === 0 && (
                <div className="flex min-h-44 flex-col items-center justify-center p-6 text-center">
                  <ShieldCheck size={25} className="text-domain-inventory" />
                  <p className="mt-3 text-sm font-bold">Tidak ada tenant tertahan</p>
                  <p className="mt-1 text-xs text-muted-foreground">Subscription dan akses tenant dalam kondisi normal.</p>
                </div>
              )}
            </div>
            <Link href="/superadmin/tenants" className="flex items-center justify-between border-t border-border px-5 py-4 text-xs font-bold transition-colors hover:bg-muted/60">
              Buka roastery network <ArrowUpRight size={15} />
            </Link>
          </section>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.2fr_.8fr]">
          <section className="border border-border bg-card p-5 md:p-6">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-[9px] font-black uppercase tracking-[0.22em] text-domain-roasting">Latest intake</p>
                <h2 className="mt-2 text-lg font-black">Roastery terbaru</h2>
              </div>
              <Link href="/superadmin/tenants" aria-label="Lihat semua tenant" className="flex size-9 items-center justify-center text-muted-foreground hover:bg-muted hover:text-primary">
                <ArrowUpRight size={16} />
              </Link>
            </div>
            <RecentTenants tenants={data.recentTenants} />
          </section>

          <section className="border border-border bg-card p-5 md:p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[9px] font-black uppercase tracking-[0.22em] text-domain-sales">Commercial mix</p>
                <h2 className="mt-2 text-lg font-black">Distribusi paket</h2>
              </div>
              <ServerCog size={19} className="text-domain-sales" />
            </div>
            <div className="mt-7 space-y-5">
              {data.planDistribution.map((plan) => (
                <div key={plan.tier}>
                  <div className="mb-2 flex items-center justify-between text-xs">
                    <span className="font-black uppercase tracking-[0.12em]">{plan.tier}</span>
                    <span className="font-mono text-muted-foreground">{plan.count}</span>
                  </div>
                  <div className="h-1.5 bg-muted">
                    <div className="h-full bg-domain-sales" style={{ width: `${(plan.count / maxPlanCount) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
