import Link from "next/link";
import { ArrowUpRight, Cable, CircleOff, MonitorCog, Radio, ShieldX, UploadCloud } from "lucide-react";

import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const dateTime = new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

function versionParts(version: string) {
  return version.replace(/^v/i, "").split(".").map((part) => Number.parseInt(part, 10) || 0);
}

function compareVersion(a: string, b: string) {
  const aa = versionParts(a);
  const bb = versionParts(b);
  for (let index = 0; index < Math.max(aa.length, bb.length); index += 1) {
    const delta = (aa[index] || 0) - (bb[index] || 0);
    if (delta !== 0) return delta;
  }
  return 0;
}

export default async function StudioFleetPage() {
  await requireRole("SUPERADMIN");
  const currentRelease = process.env.STUDIO_LATEST_VERSION?.trim() || "0.10.2";
  const connectors = await prisma.artisanConnector.findMany({
    orderBy: [{ status: "asc" }, { lastSeenAt: "desc" }],
    include: {
      tenant: { select: { id: true, code: true, name: true } },
      machine: { select: { id: true, name: true } },
      imports: { orderBy: { uploadedAt: "desc" }, take: 1, select: { uploadedAt: true, status: true } },
      _count: { select: { imports: true } },
    },
  });

  const active = connectors.filter((connector) => connector.status !== "REVOKED");
  const online = active.filter((connector) => connector.status === "ONLINE").length;
  const offline = active.filter((connector) => connector.status === "OFFLINE").length;
  const versionCounts = [...new Set(active.map((connector) => connector.appVersion))]
    .sort((a, b) => a === currentRelease ? -1 : b === currentRelease ? 1 : compareVersion(b, a))
    .map((version) => ({ version, count: active.filter((connector) => connector.appVersion === version).length }));
  const needsReview = active.filter((connector) => connector.appVersion !== currentRelease).length;

  return (
    <div className="mx-auto flex max-w-[1480px] flex-col gap-6 p-5 md:p-8">
      <header className="flex flex-col justify-between gap-4 border-b border-border pb-6 md:flex-row md:items-end">
        <div><p className="text-xs font-black uppercase tracking-[0.24em] text-[#078C9A]">Roasting edge network</p><h1 className="mt-3 text-3xl font-black tracking-[-0.05em] md:text-4xl">Studio fleet</h1><p className="mt-2 text-sm text-muted-foreground">Komputer, versi aplikasi, mesin, dan jalur upload seluruh tenant—tanpa membuka isi profil roasting.</p></div>
        <div className="flex items-center gap-2 border border-border bg-card px-4 py-3 text-xs"><Radio size={15} className="text-[#078C9A]" /><b>Release saat ini:</b><span className="font-mono">v{currentRelease}</span></div>
      </header>

      <section className="grid overflow-hidden bg-[#080B0C] text-white md:grid-cols-4">
        <FleetMetric label="Konektor aktif" value={active.length} icon={<Cable size={17} />} />
        <FleetMetric label="Online" value={online} icon={<Radio size={17} />} tone="good" />
        <FleetMetric label="Offline" value={offline} icon={<CircleOff size={17} />} tone={offline > 0 ? "warn" : "good"} />
        <FleetMetric label="Perlu update / cek" value={needsReview} icon={<ShieldX size={17} />} tone={needsReview > 0 ? "warn" : "good"} />
      </section>

      <div className="grid gap-6 xl:grid-cols-[1.25fr_.45fr]">
        <section className="overflow-hidden border border-border bg-card">
          <div className="flex items-start justify-between border-b border-border p-5 md:p-6"><div><p className="text-[9px] font-black uppercase tracking-[0.2em] text-domain-inventory">Connector registry</p><h2 className="mt-2 text-xl font-black">Perangkat terhubung</h2></div><MonitorCog size={20} className="text-domain-inventory" /></div>
          <div className="divide-y divide-border">
            {connectors.map((connector) => (
              <article key={connector.id} className="grid gap-4 p-5 transition-colors hover:bg-muted/35 md:grid-cols-[3rem_1.1fr_1fr_8rem_7rem] md:items-center md:px-6">
                <span className={`flex size-10 items-center justify-center ${connector.status === "ONLINE" ? "bg-domain-inventory/10 text-domain-inventory" : connector.status === "REVOKED" ? "bg-red-500/10 text-red-600" : "bg-amber-500/10 text-amber-700"}`}><MonitorCog size={18} /></span>
                <div className="min-w-0"><p className="truncate text-sm font-bold">{connector.machine.name}</p><p className="mt-1 truncate font-mono text-xs text-muted-foreground">{connector.computerName} · {connector.platform}</p></div>
                <div className="min-w-0"><Link href={`/superadmin/tenants/${connector.tenant.id}`} className="truncate text-xs font-bold hover:text-primary hover:underline">{connector.tenant.name}</Link><p className="mt-1 font-mono text-xs text-muted-foreground">{connector.tenant.code}</p></div>
                <div><p className="font-mono text-xs font-bold">v{connector.appVersion}</p><p className="mt-1 text-xs text-muted-foreground">{connector._count.imports} upload</p></div>
                <div className="flex items-center justify-between gap-3 md:block md:text-right"><Status value={connector.status} /><p className="mt-1 font-mono text-[9px] text-muted-foreground">{connector.lastSeenAt ? dateTime.format(connector.lastSeenAt) : "belum terlihat"}</p></div>
              </article>
            ))}
            {connectors.length === 0 && <div className="p-14 text-center"><Cable size={26} className="mx-auto text-muted-foreground" /><p className="mt-4 text-sm font-bold">Belum ada Roastd Studio terdaftar</p><p className="mt-1 text-xs text-muted-foreground">Konektor akan muncul setelah tenant menyelesaikan login perangkat.</p></div>}
          </div>
        </section>

        <section className="border border-border bg-card p-5 md:p-6">
          <div className="flex items-start justify-between"><div><p className="text-[9px] font-black uppercase tracking-[0.2em] text-domain-sales">Release adoption</p><h2 className="mt-2 text-xl font-black">Versi terpasang</h2></div><UploadCloud size={20} className="text-domain-sales" /></div>
          <div className="mt-7 space-y-5">
            {versionCounts.map((entry) => (
              <div key={entry.version}><div className="mb-2 flex items-center justify-between text-xs"><span className="font-mono font-bold">v{entry.version}</span><span className={entry.version === currentRelease ? "text-domain-inventory" : "text-amber-700"}>{entry.count} perangkat · {entry.version === currentRelease ? "terkini" : "perlu cek"}</span></div><div className="h-1.5 bg-muted"><div className={`h-full ${entry.version === currentRelease ? "bg-domain-inventory" : "bg-amber-500"}`} style={{ width: `${(entry.count / Math.max(1, active.length)) * 100}%` }} /></div></div>
            ))}
            {versionCounts.length === 0 && <p className="text-xs text-muted-foreground">Belum ada versi aktif untuk dibandingkan.</p>}
          </div>
          <Link href="/superadmin/incidents" className="mt-8 flex items-center justify-between border-t border-border pt-5 text-xs font-bold hover:text-primary">Lihat kegagalan sinkronisasi <ArrowUpRight size={15} /></Link>
        </section>
      </div>
    </div>
  );
}

function FleetMetric({ label, value, icon, tone = "neutral" }: { label: string; value: number; icon: React.ReactNode; tone?: "good" | "warn" | "bad" | "neutral" }) {
  const color = tone === "good" ? "text-[#67D8C8]" : tone === "warn" ? "text-amber-400" : tone === "bad" ? "text-red-400" : "text-white/55";
  return <div className="border-b border-white/10 p-5 last:border-b-0 md:border-b-0 md:border-r md:last:border-r-0"><div className={`flex items-center justify-between ${color}`}><p className="text-[9px] font-black uppercase tracking-[0.18em]">{label}</p>{icon}</div><p className="mt-4 text-3xl font-black tabular-nums">{value}</p></div>;
}

function Status({ value }: { value: string }) {
  const color = value === "ONLINE" ? "text-domain-inventory" : value === "REVOKED" ? "text-red-600" : "text-amber-700";
  return <span className={`text-[9px] font-black uppercase tracking-[0.12em] ${color}`}>{value}</span>;
}
