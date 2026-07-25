import Link from "next/link";
import { BellRing, ScrollText, Webhook } from "lucide-react";

import { requireRole, requireTenantPrisma } from "@/lib/auth";
import { SettingsNav } from "@/app/(dashboard)/settings/_components/SettingsNav";
import { PageHeader } from "@/components/layout/PageHeader";

export const dynamic = "force-dynamic";

function dateTime(value: Date) {
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(value);
}

function statusClass(status: string) {
  if (status === "PROCESSED" || status === "SENT") return "bg-emerald-100 text-emerald-700";
  if (status === "FAILED") return "bg-red-100 text-red-700";
  if (status === "IGNORED") return "bg-slate-100 text-slate-600";
  return "bg-amber-100 text-amber-700";
}

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const user = await requireRole("OWNER", "MANAGER");
  const db = await requireTenantPrisma();
  const { view } = await searchParams;
  const activeView =
    view === "webhooks" ? "webhooks" : view === "reminders" ? "reminders" : "audit";

  const auditLogs = await db.auditLog.findMany({
    take: 100,
    orderBy: { createdAt: "desc" },
    include: { user: { select: { name: true, email: true } } },
  });

  const webhookEvents = await db.webhookEvent.findMany({
    take: 100,
    orderBy: { receivedAt: "desc" },
  });

  const reminderDeliveries = await db.reminderDelivery.findMany({
    take: 100,
    orderBy: { createdAt: "desc" },
    include: {
      invoice: {
        select: { code: true, customer: { select: { name: true } } },
      },
    },
  });

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PageHeader
        title="Audit & Integrasi"
        eyebrow="Pengaturan"
        description="Jejak perubahan penting dan status event integrasi tenant."
      />
      <SettingsNav userRole={user.role} />

      <div className="custom-scrollbar flex-1 overflow-auto">
        <div className="mx-auto max-w-[1600px] p-4 md:p-6 lg:p-8">

          {/* Tabs */}
          <div className="mb-4 flex border-b border-[var(--glass-border)]">
            <Link href="/audit?view=audit"
              className={`flex items-center gap-2 border-b-2 px-4 py-3 text-xs font-semibold ${
                activeView === "audit" ? "border-[var(--amber-deep)] text-[var(--text-primary)]" : "border-transparent text-[var(--text-tertiary)]"
              }`}>
              <ScrollText size={15} />
              Aktivitas ({auditLogs.length})
            </Link>
            <Link href="/audit?view=webhooks"
              className={`flex items-center gap-2 border-b-2 px-4 py-3 text-xs font-semibold ${
                activeView === "webhooks" ? "border-[var(--amber-deep)] text-[var(--text-primary)]" : "border-transparent text-[var(--text-tertiary)]"
              }`}>
              <Webhook size={15} />
              Webhook ({webhookEvents.length})
            </Link>
            <Link href="/audit?view=reminders"
              className={`flex items-center gap-2 border-b-2 px-4 py-3 text-xs font-semibold ${
                activeView === "reminders" ? "border-[var(--amber-deep)] text-[var(--text-primary)]" : "border-transparent text-[var(--text-tertiary)]"
              }`}>
              <BellRing size={15} />
              Reminder ({reminderDeliveries.length})
            </Link>
          </div>

          {/* Audit Logs */}
          {activeView === "audit" ? (
            <div className="overflow-x-auto glass-card p-0">
              <table className="w-full min-w-[760px] text-sm">
                <thead className="border-b border-[var(--glass-border)] bg-[var(--glass-bg)] text-left text-[10px] font-bold uppercase tracking-widest text-[var(--text-tertiary)]">
                  <tr>
                    <th className="px-4 py-3">Waktu</th>
                    <th className="px-4 py-3">Pengguna</th>
                    <th className="px-4 py-3">Aksi</th>
                    <th className="px-4 py-3">Entitas</th>
                    <th className="px-4 py-3">Referensi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--glass-border)]">
                  {auditLogs.map((log) => (
                    <tr key={log.id} className="text-[var(--text-primary)] hover:bg-[var(--glass-bg-hover)] transition-colors">
                      <td className="whitespace-nowrap px-4 py-3 text-xs">{dateTime(log.createdAt)}</td>
                      <td className="px-4 py-3">
                        <div className="text-sm font-medium">{log.user?.name || "System"}</div>
                        <div className="text-xs text-[var(--text-tertiary)]">{log.user?.email || "Automated event"}</div>
                      </td>
                      <td className="px-4 py-3 text-sm font-semibold">{log.action}</td>
                      <td className="px-4 py-3 text-sm">{log.entityType}</td>
                      <td className="px-4 py-3 font-mono text-xs">{log.entityId || "-"}</td>
                    </tr>
                  ))}
                  {auditLogs.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-12 text-center text-[var(--text-tertiary)]">Belum ada aktivitas yang tercatat.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          ) : activeView === "webhooks" ? (
            <div className="overflow-x-auto glass-card p-0">
              <table className="w-full min-w-[840px] text-sm">
                <thead className="border-b border-[var(--glass-border)] bg-[var(--glass-bg)] text-left text-[10px] font-bold uppercase tracking-widest text-[var(--text-tertiary)]">
                  <tr>
                    <th className="px-4 py-3">Diterima</th>
                    <th className="px-4 py-3">Provider</th>
                    <th className="px-4 py-3">Event</th>
                    <th className="px-4 py-3">ID</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Keterangan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--glass-border)]">
                  {webhookEvents.map((event) => (
                    <tr key={event.id} className="text-[var(--text-primary)] hover:bg-[var(--glass-bg-hover)] transition-colors">
                      <td className="whitespace-nowrap px-4 py-3 text-xs">{dateTime(event.receivedAt)}</td>
                      <td className="px-4 py-3 text-sm font-semibold">{event.provider}</td>
                      <td className="px-4 py-3 text-sm">{event.eventType}</td>
                      <td className="max-w-64 truncate px-4 py-3 font-mono text-xs">{event.eventId}</td>
                      <td className="px-4 py-3"><span className={`inline-flex rounded-md px-2 py-1 text-[10px] font-bold ${statusClass(event.status)}`}>{event.status}</span></td>
                      <td className="max-w-72 truncate px-4 py-3 text-xs text-[var(--text-tertiary)]">{event.error || "-"}</td>
                    </tr>
                  ))}
                  {webhookEvents.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-4 py-12 text-center text-[var(--text-tertiary)]">Belum ada webhook yang diterima.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            <div data-testid="reminder-deliveries" className="overflow-x-auto glass-card p-0">
              <table className="w-full min-w-[760px] text-sm">
                <thead className="border-b border-[var(--glass-border)] bg-[var(--glass-bg)] text-left text-[10px] font-bold uppercase tracking-widest text-[var(--text-tertiary)]">
                  <tr>
                    <th className="px-4 py-3">Tanggal</th>
                    <th className="px-4 py-3">Invoice</th>
                    <th className="px-4 py-3">Customer</th>
                    <th className="px-4 py-3">Channel</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Keterangan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--glass-border)]">
                  {reminderDeliveries.map((delivery) => (
                    <tr key={delivery.id} className="text-[var(--text-primary)] hover:bg-[var(--glass-bg-hover)] transition-colors">
                      <td className="whitespace-nowrap px-4 py-3 text-xs">{dateTime(delivery.createdAt)}</td>
                      <td className="px-4 py-3 text-sm font-semibold">{delivery.invoice.code}</td>
                      <td className="px-4 py-3 text-sm">{delivery.invoice.customer.name}</td>
                      <td className="px-4 py-3 text-sm">{delivery.channel}</td>
                      <td className="px-4 py-3"><span className={`inline-flex rounded-md px-2 py-1 text-[10px] font-bold ${statusClass(delivery.status)}`}>{delivery.status}</span></td>
                      <td className="max-w-72 truncate px-4 py-3 text-xs text-[var(--text-tertiary)]">{delivery.error || "-"}</td>
                    </tr>
                  ))}
                  {reminderDeliveries.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-4 py-12 text-center text-[var(--text-tertiary)]">Belum ada reminder yang dikirim.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
