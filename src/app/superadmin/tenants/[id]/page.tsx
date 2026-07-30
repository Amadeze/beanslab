import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  ArrowUpRight,
  Boxes,
  Coffee,
  CreditCard,
  ExternalLink,
  MonitorCog,
  Radio,
  ReceiptText,
  ScrollText,
  ShieldCheck,
  Users,
} from "lucide-react";

import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getTenantAccessState } from "@/lib/subscription";
import { tenantStorefrontUrl } from "@/lib/tenant-host";
import { EditTenantDialog } from "../_components/EditTenantDialog";
import { TrialExtension } from "../_components/TrialExtension";

export const dynamic = "force-dynamic";

const idr = new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 });
const date = new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "short", year: "numeric" });
const dateTime = new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

export default async function TenantDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireRole("SUPERADMIN");
  const { id } = await params;

  const [tenant, gmv, roasts30d] = await Promise.all([
    prisma.tenant.findFirst({
      where: { id, NOT: { id: "default" } },
      include: {
        users: {
          orderBy: [{ role: "asc" }, { createdAt: "asc" }],
          select: { id: true, name: true, email: true, role: true, isActive: true, lockedUntil: true, createdAt: true },
        },
        artisanConnectors: {
          orderBy: { lastSeenAt: "desc" },
          take: 8,
          select: {
            id: true,
            computerName: true,
            appVersion: true,
            platform: true,
            status: true,
            lastSeenAt: true,
            machine: { select: { name: true } },
            _count: { select: { imports: true } },
          },
        },
        subscriptionPayments: {
          orderBy: { createdAt: "desc" },
          take: 8,
          select: { id: true, amount: true, status: true, tier: true, createdAt: true, midtransOrderId: true },
        },
        auditLogs: {
          orderBy: { createdAt: "desc" },
          take: 10,
          select: { id: true, action: true, entityType: true, createdAt: true, user: { select: { name: true } } },
        },
        _count: { select: { users: true, machines: true, roasts: true, invoices: true, products: true, artisanConnectors: true } },
      },
    }),
    prisma.invoice.aggregate({ where: { tenantId: id, status: { in: ["ISSUED", "PARTIAL", "PAID"] } }, _sum: { grandTotal: true } }),
    prisma.roast.count({ where: { tenantId: id, createdAt: { gte: new Date(Date.now() - 30 * 86_400_000) } } }),
  ]);

  if (!tenant) notFound();
  const accessState = getTenantAccessState(tenant);
  const owner = tenant.users.find((user) => user.role === "OWNER");
  const onlineConnectors = tenant.artisanConnectors.filter((connector) => connector.status === "ONLINE").length;

  return (
    <div className="mx-auto flex max-w-[1480px] flex-col gap-6 p-5 md:p-8">
      <div className="flex flex-col gap-5 border-b border-border pb-6 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <Link href="/superadmin/tenants" className="mb-5 inline-flex items-center gap-2 text-xs font-bold text-muted-foreground hover:text-foreground">
            <ArrowLeft size={14} /> Jaringan roastery
          </Link>
          <div className="flex items-center gap-4">
            <div className="flex size-14 items-center justify-center bg-[#080B0C] text-white">
              <Coffee size={24} />
            </div>
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-domain-roasting">{tenant.code}</p>
              <h1 className="mt-1 text-3xl font-black tracking-[-0.045em] md:text-4xl">{tenant.name}</h1>
            </div>
          </div>
          <p className="mt-3 text-sm text-muted-foreground">Owner {owner?.name || "belum tersedia"} · dibuat {date.format(tenant.createdAt)}</p>
        </div>
        <div className="flex items-center gap-2">
          {tenant.subdomain && (
            <a href={tenantStorefrontUrl(tenant.subdomain)} target="_blank" rel="noreferrer" className="flex min-h-11 items-center gap-2 border border-border px-4 text-sm font-bold hover:bg-muted">
              Storefront <ExternalLink size={15} />
            </a>
          )}
          <EditTenantDialog tenant={tenant} />
        </div>
      </div>

      <section className="grid overflow-hidden bg-[#080B0C] text-white md:grid-cols-[1.2fr_repeat(3,.8fr)]">
        <div className="border-b border-white/10 p-6 md:border-b-0 md:border-r">
          <p className="text-[9px] font-black uppercase tracking-[0.22em] text-white/40">Access state</p>
          <div className="mt-4 flex items-center gap-3">
            <span className={`size-2 rounded-full ${accessState === "ACTIVE" ? "bg-[#67D8C8]" : "bg-amber-400"}`} />
            <p className="text-2xl font-black">{accessState === "ACTIVE" ? "Operasional" : "Perlu tindakan"}</p>
          </div>
        </div>
        <Pulse label="Paket" value={tenant.subscriptionTier} note={tenant.subscriptionStatus} />
        <Pulse label="Studio" value={`${onlineConnectors}/${tenant._count.artisanConnectors}`} note="konektor online" />
        <Pulse label="Aktivitas" value={roasts30d.toString()} note="roast dalam 30 hari" />
      </section>

      <section className="grid border border-border bg-card lg:grid-cols-4">
        <Metric icon={<Users size={17} />} label="Pengguna" value={tenant._count.users.toString()} note={`${tenant.users.filter((user) => user.isActive).length} aktif`} />
        <Metric icon={<MonitorCog size={17} />} label="Mesin" value={tenant._count.machines.toString()} note={`${tenant._count.artisanConnectors} Studio terdaftar`} />
        <Metric icon={<Boxes size={17} />} label="Produk" value={tenant._count.products.toString()} note={`${tenant._count.roasts} roast tersimpan`} />
        <Metric icon={<ReceiptText size={17} />} label="GMV tenant" value={idr.format(Number(gmv._sum.grandTotal ?? 0))} note={`${tenant._count.invoices} invoice`} />
      </section>

      <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <Panel eyebrow="Account & access" title="Tim tenant" icon={<Users size={18} className="text-domain-inventory" />}>
          <div className="divide-y divide-border">
            {tenant.users.map((user) => (
              <div key={user.id} className="flex items-center justify-between gap-4 py-4">
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold">{user.name}</p>
                  <p className="truncate text-xs text-muted-foreground">{user.email}</p>
                </div>
                <div className="text-right">
                  <p className="font-mono text-[10px] font-bold">{user.role}</p>
                  <p className={`mt-1 text-[10px] ${user.lockedUntil && user.lockedUntil > new Date() ? "text-red-600" : user.isActive ? "text-domain-inventory" : "text-muted-foreground"}`}>
                    {user.lockedUntil && user.lockedUntil > new Date() ? "TERKUNCI" : user.isActive ? "AKTIF" : "NONAKTIF"}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </Panel>

        <Panel eyebrow="Studio fleet" title="Konektor roasting" icon={<Radio size={18} className="text-[#15B8C6]" />} actionHref="/superadmin/studio">
          <div className="divide-y divide-border">
            {tenant.artisanConnectors.map((connector) => (
              <div key={connector.id} className="flex items-center justify-between gap-4 py-4">
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold">{connector.machine.name}</p>
                  <p className="truncate font-mono text-[10px] text-muted-foreground">{connector.computerName} · v{connector.appVersion}</p>
                </div>
                <div className="text-right">
                  <p className={`text-[10px] font-black ${connector.status === "ONLINE" ? "text-domain-inventory" : connector.status === "REVOKED" ? "text-red-600" : "text-amber-600"}`}>{connector.status}</p>
                  <p className="mt-1 text-[10px] text-muted-foreground">{connector.lastSeenAt ? dateTime.format(connector.lastSeenAt) : "belum terhubung"}</p>
                </div>
              </div>
            ))}
            {tenant.artisanConnectors.length === 0 && <Empty text="Belum ada Roastd Studio yang dihubungkan." />}
          </div>
        </Panel>
      </div>

      <div className="grid gap-6 xl:grid-cols-[.9fr_1.1fr]">
        <Panel eyebrow="Subscription" title="Siklus akses" icon={<CreditCard size={18} className="text-domain-sales" />} actionHref="/superadmin/subscriptions">
          <dl className="grid grid-cols-2 gap-4 text-sm">
            <Info label="Status" value={tenant.subscriptionStatus} />
            <Info label="Paket" value={tenant.subscriptionTier} />
            <Info label="Trial berakhir" value={tenant.trialEndsAt ? date.format(tenant.trialEndsAt) : "—"} />
            <Info label="Tagihan berikutnya" value={tenant.nextBillingDate ? date.format(tenant.nextBillingDate) : "—"} />
          </dl>
          {tenant.subscriptionTier === "TRIAL" && (
            <div className="mt-5 border-t border-border pt-5">
              <TrialExtension tenantId={tenant.id} />
            </div>
          )}
          <div className="mt-5 divide-y divide-border border-t border-border">
            {tenant.subscriptionPayments.slice(0, 4).map((payment) => (
              <div key={payment.id} className="flex items-center justify-between py-3 text-xs">
                <span className="font-mono text-muted-foreground">{payment.midtransOrderId}</span>
                <span className="font-bold">{idr.format(Number(payment.amount))} · {payment.status}</span>
              </div>
            ))}
          </div>
        </Panel>

        <Panel eyebrow="Audit trail" title="Aktivitas terakhir" icon={<ScrollText size={18} className="text-domain-production" />} actionHref="/superadmin/audit-log">
          <div className="divide-y divide-border">
            {tenant.auditLogs.map((log) => (
              <div key={log.id} className="grid gap-1 py-3 sm:grid-cols-[8rem_1fr_auto] sm:items-center sm:gap-4">
                <span className="font-mono text-[10px] text-muted-foreground">{dateTime.format(log.createdAt)}</span>
                <span className="text-xs"><b>{log.action}</b> · {log.entityType}</span>
                <span className="text-[10px] text-muted-foreground">{log.user?.name || "Sistem"}</span>
              </div>
            ))}
            {tenant.auditLogs.length === 0 && <Empty text="Belum ada aktivitas audit tenant ini." />}
          </div>
        </Panel>
      </div>
    </div>
  );
}

function Pulse({ label, value, note }: { label: string; value: string; note: string }) {
  return <div className="border-b border-white/10 p-5 last:border-b-0 md:border-b-0 md:border-r md:last:border-r-0"><p className="text-[9px] font-black uppercase tracking-[0.2em] text-white/40">{label}</p><p className="mt-3 text-xl font-black">{value}</p><p className="mt-1 text-[10px] text-white/45">{note}</p></div>;
}

function Metric({ icon, label, value, note }: { icon: React.ReactNode; label: string; value: string; note: string }) {
  return <div className="border-t border-border p-5 first:border-t-0 lg:border-l lg:border-t-0 lg:first:border-l-0"><div className="flex items-center justify-between"><p className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground">{label}</p><span className="text-muted-foreground">{icon}</span></div><p className="mt-4 truncate text-2xl font-black tracking-[-0.04em]">{value}</p><p className="mt-1 text-xs text-muted-foreground">{note}</p></div>;
}

function Panel({ eyebrow, title, icon, actionHref, children }: { eyebrow: string; title: string; icon: React.ReactNode; actionHref?: string; children: React.ReactNode }) {
  return <section className="border border-border bg-card p-5 md:p-6"><div className="mb-5 flex items-start justify-between"><div><p className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground">{eyebrow}</p><h2 className="mt-2 text-lg font-black tracking-[-0.03em]">{title}</h2></div>{actionHref ? <Link href={actionHref} aria-label={`Buka ${title}`} className="flex size-9 items-center justify-center text-muted-foreground hover:bg-muted hover:text-primary"><ArrowUpRight size={16} /></Link> : icon}</div>{children}</section>;
}

function Info({ label, value }: { label: string; value: string }) {
  return <div className="border-l-2 border-border pl-3"><dt className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">{label}</dt><dd className="mt-1 font-bold">{value}</dd></div>;
}

function Empty({ text }: { text: string }) {
  return <div className="py-8 text-center text-xs text-muted-foreground"><ShieldCheck size={20} className="mx-auto mb-2 opacity-50" />{text}</div>;
}
