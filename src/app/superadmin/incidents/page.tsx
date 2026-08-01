import Link from "next/link";
import { AlertTriangle, ArrowUpRight, BellRing, Cable, CheckCircle2, Clock3, ServerCrash, Webhook } from "lucide-react";

import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type Incident = {
  id: string;
  kind: "IMPORT" | "JOB" | "WEBHOOK" | "NOTIFICATION";
  title: string;
  detail: string;
  tenantId: string | null;
  tenantName: string;
  source: string;
  happenedAt: Date;
};

const dateTime = new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

export default async function IncidentCenterPage() {
  await requireRole("SUPERADMIN");
  const since = new Date(Date.now() - 7 * 86_400_000);
  const [imports, jobs, webhooks, notifications] = await Promise.all([
    prisma.artisanRoastImport.findMany({
      where: { status: "FAILED", uploadedAt: { gte: since } },
      orderBy: { uploadedAt: "desc" },
      take: 80,
      select: { id: true, originalFilename: true, errorCode: true, errorMessage: true, uploadedAt: true, tenantId: true, tenant: { select: { name: true } }, machine: { select: { name: true } } },
    }),
    prisma.jobRun.findMany({
      where: { status: "FAILED", startedAt: { gte: since } },
      orderBy: { startedAt: "desc" },
      take: 80,
      select: { id: true, jobName: true, error: true, attempt: true, startedAt: true, tenantId: true, tenant: { select: { name: true } } },
    }),
    prisma.webhookEvent.findMany({
      where: { receivedAt: { gte: since }, OR: [{ error: { not: null } }, { status: { in: ["FAILED", "ERROR"] } }] },
      orderBy: { receivedAt: "desc" },
      take: 80,
      select: { id: true, provider: true, eventType: true, status: true, error: true, receivedAt: true, tenantId: true, tenant: { select: { name: true } } },
    }),
    prisma.paymentNotificationDelivery.findMany({
      where: { status: "FAILED", createdAt: { gte: since } },
      orderBy: { createdAt: "desc" },
      take: 80,
      select: { id: true, event: true, channel: true, recipient: true, error: true, createdAt: true, tenantId: true, tenant: { select: { name: true } } },
    }),
  ]);

  const incidents: Incident[] = [
    ...imports.map((item) => ({ id: item.id, kind: "IMPORT" as const, title: `Import roast gagal · ${item.originalFilename}`, detail: item.errorMessage || item.errorCode || "Parser tidak memberikan detail.", tenantId: item.tenantId, tenantName: item.tenant.name, source: item.machine.name, happenedAt: item.uploadedAt })),
    ...jobs.map((item) => ({ id: item.id, kind: "JOB" as const, title: `Job ${item.jobName} gagal`, detail: item.error || `Gagal pada percobaan ${item.attempt}.`, tenantId: item.tenantId, tenantName: item.tenant?.name || "Platform", source: `attempt ${item.attempt}`, happenedAt: item.startedAt })),
    ...webhooks.map((item) => ({ id: item.id, kind: "WEBHOOK" as const, title: `${item.provider} · ${item.eventType}`, detail: item.error || `Webhook berstatus ${item.status}.`, tenantId: item.tenantId, tenantName: item.tenant.name, source: item.provider, happenedAt: item.receivedAt })),
    ...notifications.map((item) => ({ id: item.id, kind: "NOTIFICATION" as const, title: `${item.channel} · ${item.event}`, detail: item.error || `Pengiriman ke ${item.recipient} gagal.`, tenantId: item.tenantId, tenantName: item.tenant.name, source: item.channel, happenedAt: item.createdAt })),
  ].sort((a, b) => b.happenedAt.getTime() - a.happenedAt.getTime());

  const affectedTenants = new Set(incidents.flatMap((incident) => incident.tenantId ? [incident.tenantId] : [])).size;

  return (
    <div className="mx-auto flex max-w-[1480px] flex-col gap-6 p-5 md:p-8">
      <header className="flex flex-col justify-between gap-4 border-b border-border pb-6 md:flex-row md:items-end">
        <div><p className="text-xs font-black uppercase tracking-[0.24em] text-domain-production">System observability</p><h1 className="mt-3 text-3xl font-black tracking-[-0.05em] md:text-4xl">Incident center</h1><p className="mt-2 text-sm text-muted-foreground">Kegagalan operasional tujuh hari terakhir tanpa membuka payload atau data bisnis tenant.</p></div>
        <div className={`flex items-center gap-2 px-4 py-3 text-xs font-bold ${incidents.length ? "bg-amber-500/10 text-amber-700" : "bg-domain-inventory/10 text-domain-inventory"}`}>
          {incidents.length ? <AlertTriangle size={16} /> : <CheckCircle2 size={16} />}{incidents.length ? `${incidents.length} insiden ditemukan` : "Tidak ada insiden terbuka"}
        </div>
      </header>

      <section className="grid border border-border bg-card md:grid-cols-4">
        <Metric label="Total insiden" value={incidents.length} icon={<AlertTriangle size={17} />} />
        <Metric label="Tenant terdampak" value={affectedTenants} icon={<Cable size={17} />} />
        <Metric label="Import roast" value={imports.length} icon={<ServerCrash size={17} />} />
        <Metric label="Webhook & notifikasi" value={webhooks.length + notifications.length} icon={<Webhook size={17} />} />
      </section>

      <section className="overflow-hidden border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border p-5 md:p-6"><div><p className="text-[9px] font-black uppercase tracking-[0.2em] text-domain-roasting">Failure stream</p><h2 className="mt-2 text-xl font-black">Aktivitas yang gagal</h2></div><Clock3 size={19} className="text-muted-foreground" /></div>
        <div className="divide-y divide-border">
          {incidents.map((incident) => (
            <article key={`${incident.kind}-${incident.id}`} className="grid gap-4 p-5 hover:bg-muted/35 md:grid-cols-[3.5rem_1fr_12rem_8rem] md:items-center md:px-6">
              <IncidentIcon kind={incident.kind} />
              <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className="text-[9px] font-black uppercase tracking-[0.12em] text-muted-foreground">{incident.kind}</span><h3 className="truncate text-sm font-bold">{incident.title}</h3></div><p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">{incident.detail}</p></div>
              <div><p className="text-xs font-bold">{incident.tenantName}</p><p className="mt-1 font-mono text-xs text-muted-foreground">{incident.source}</p></div>
              <div className="flex items-center justify-between gap-3 md:block md:text-right"><time className="font-mono text-xs text-muted-foreground">{dateTime.format(incident.happenedAt)}</time>{incident.tenantId && <Link href={`/superadmin/tenants/${incident.tenantId}`} aria-label={`Buka ${incident.tenantName}`} className="ml-auto mt-2 flex size-8 items-center justify-center text-muted-foreground hover:bg-muted hover:text-primary"><ArrowUpRight size={14} /></Link>}</div>
            </article>
          ))}
          {incidents.length === 0 && <div className="p-14 text-center"><CheckCircle2 size={28} className="mx-auto text-domain-inventory" /><p className="mt-4 text-sm font-bold">Tidak ada kegagalan dalam tujuh hari terakhir</p><p className="mt-1 text-xs text-muted-foreground">Import, job, webhook, dan notifikasi berjalan tanpa insiden tercatat.</p></div>}
        </div>
      </section>
    </div>
  );
}

function Metric({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  return <div className="border-t border-border p-5 first:border-t-0 md:border-l md:border-t-0 md:first:border-l-0"><div className="flex items-center justify-between"><p className="text-[9px] font-black uppercase tracking-[0.18em] text-muted-foreground">{label}</p><span className="text-muted-foreground">{icon}</span></div><p className="mt-4 text-3xl font-black tabular-nums">{value}</p></div>;
}

function IncidentIcon({ kind }: { kind: Incident["kind"] }) {
  const icon = kind === "IMPORT" ? <ServerCrash size={18} /> : kind === "JOB" ? <Cable size={18} /> : kind === "WEBHOOK" ? <Webhook size={18} /> : <BellRing size={18} />;
  return <span className="flex size-10 items-center justify-center bg-red-500/8 text-red-600">{icon}</span>;
}
