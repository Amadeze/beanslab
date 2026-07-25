"use client";

import { motion } from "framer-motion";
import { Users, DollarSign, TrendingUp, Building2, ShieldCheck, Activity } from "lucide-react";
import { TenantGrowthChart } from "./TenantGrowthChart";
import { RecentTenants } from "./RecentTenants";

interface SuperadminData {
  totalTenants: number;
  activeTenants: number;
  newTenantsThisMonth: number;
  mrr: number;
  totalGmv: number;
  growthData: any[];
  recentTenants: any[];
}

const tones = {
  copper: {
    shell: "border-domain-roasting/25 bg-domain-roasting/7",
    icon: "border-domain-roasting/20 bg-domain-roasting/10 text-domain-roasting",
    value: "text-domain-roasting",
  },
  verdigris: {
    shell: "border-domain-inventory/25 bg-domain-inventory/7",
    icon: "border-domain-inventory/20 bg-domain-inventory/10 text-domain-inventory",
    value: "text-domain-inventory",
  },
  plum: {
    shell: "border-domain-sales/25 bg-domain-sales/7",
    icon: "border-domain-sales/20 bg-domain-sales/10 text-domain-sales",
    value: "text-domain-sales",
  },
  brass: {
    shell: "border-domain-production/25 bg-domain-production/7",
    icon: "border-domain-production/20 bg-domain-production/10 text-domain-production",
    value: "text-domain-production",
  },
};

function KpiCard({
  label,
  value,
  sub,
  icon,
  tone,
}: {
  label: string;
  value: string;
  sub: string;
  icon: React.ReactNode;
  tone: keyof typeof tones;
}) {
  const style = tones[tone];
  return (
    <motion.div 
      variants={{ hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0, transition: { duration: 0.35 } } }} 
      className={`relative flex min-h-44 flex-col justify-between overflow-hidden border p-5 ${style.shell}`}
    >
      <div className="relative z-10 flex items-start justify-between">
        <p className="max-w-40 text-[10px] font-bold uppercase leading-relaxed tracking-[0.18em] text-muted-foreground">
          {label}
        </p>
        <span className={`flex size-10 items-center justify-center border ${style.icon}`}>
          {icon}
        </span>
      </div>
      <div className="relative z-10">
        <p className={`text-3xl font-black tabular-nums leading-none tracking-[-0.04em] ${style.value}`}>
          {value}
        </p>
        <div className="mt-2 text-xs leading-relaxed text-muted-foreground">{sub}</div>
      </div>
    </motion.div>
  );
}

export function SuperadminShell({ data }: { data: SuperadminData }) {
  return (
    <div className="flex min-h-full flex-col text-foreground">
      <header className="border-b border-border bg-card px-5 py-7 md:px-8">
        <div className="mx-auto flex max-w-7xl items-end justify-between gap-4">
          <div>
            <p className="mb-3 text-[10px] font-black uppercase tracking-[0.24em] text-primary">Platform intelligence</p>
            <h1 className="text-3xl font-black tracking-[-0.045em] md:text-4xl">System overview</h1>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">Kesehatan jaringan roastery, pendapatan platform, dan pertumbuhan tenant dalam satu meja kontrol.</p>
          </div>
          <span className="hidden items-center gap-2 border border-[#15B8C6]/20 bg-[#15B8C6]/8 px-3 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-[#00668E] sm:flex">
            <span className="size-1.5 rounded-full bg-[#15B8C6]" />
            Live telemetry
          </span>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-7 p-5 md:p-8">
        <motion.div 
          initial="hidden" 
          animate="show" 
          variants={{ show: { transition: { staggerChildren: 0.1 } } }} 
          className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"
        >
          <KpiCard
            label="Monthly recurring revenue"
            value={`$${data.mrr.toLocaleString()}`}
            sub="Estimasi dari subscription aktif"
            icon={<DollarSign size={20} />}
            tone="copper"
          />
          <KpiCard
            label="Gross merchandise value"
            value={`Rp ${(data.totalGmv / 1000000).toFixed(1)}M`}
            sub="Akumulasi transaksi seluruh tenant"
            icon={<TrendingUp size={20} />}
            tone="plum"
          />
          <KpiCard
            label="Active roasteries"
            value={`${data.activeTenants} / ${data.totalTenants}`}
            sub="Tenant yang sedang beroperasi"
            icon={<ShieldCheck size={20} />}
            tone="verdigris"
          />
          <KpiCard
            label="New this month"
            value={`+${data.newTenantsThisMonth}`}
            sub="Roastery baru dalam bulan berjalan"
            icon={<Users size={20} />}
            tone="brass"
          />
        </motion.div>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <div className="flex h-full flex-col border border-border bg-card p-5 md:p-6">
              <div className="mb-6">
                <p className="mb-2 text-[9px] font-black uppercase tracking-[0.22em] text-domain-inventory">Network signal</p>
                <h3 className="flex items-center gap-2 text-lg font-black text-foreground">
                  <Activity size={18} className="text-domain-inventory" /> Pertumbuhan tenant
                </h3>
                <p className="mt-1 text-xs text-muted-foreground">Jumlah roastery terdaftar dalam enam bulan terakhir.</p>
              </div>
              <div className="min-h-72 flex-1">
                <TenantGrowthChart data={data.growthData} />
              </div>
            </div>
          </div>
          
          <div className="lg:col-span-1">
            <div className="flex h-full flex-col border border-border bg-card p-5 md:p-6">
              <div className="mb-6">
                <p className="mb-2 text-[9px] font-black uppercase tracking-[0.22em] text-domain-roasting">Latest intake</p>
                <h3 className="flex items-center gap-2 text-lg font-black text-foreground">
                  <Building2 size={18} className="text-domain-roasting" /> Roastery terbaru
                </h3>
                <p className="mt-1 text-xs text-muted-foreground">Tenant terakhir yang masuk ke jaringan.</p>
              </div>
              <div className="flex-1">
                <RecentTenants tenants={data.recentTenants} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
