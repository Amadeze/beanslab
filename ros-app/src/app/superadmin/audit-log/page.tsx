import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function SuperadminAuditLogPage() {
  await requireRole("SUPERADMIN");

  const logs = await prisma.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      action: true,
      entityType: true,
      entityId: true,
      createdAt: true,
      metadata: true,
      user: {
        select: {
          name: true,
          email: true,
          role: true,
        },
      },
      tenant: {
        select: {
          code: true,
          name: true,
        },
      },
    },
  });

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-7 p-5 md:p-8">
      <div>
        <p className="mb-3 text-xs font-black uppercase tracking-[0.24em] text-domain-roasting">System observability</p>
        <h2 className="text-3xl font-black tracking-[-0.045em]">Audit log viewer</h2>
        <p className="mt-2 text-sm text-muted-foreground">Aktivitas lintas tenant yang tercatat di sistem.</p>
      </div>

      <div className="overflow-hidden border border-border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="border-b border-border bg-muted/60 text-muted-foreground">
              <tr>
                <th className="px-6 py-4 font-semibold uppercase tracking-wider text-xs">Waktu</th>
                <th className="px-6 py-4 font-semibold uppercase tracking-wider text-xs">Tenant</th>
                <th className="px-6 py-4 font-semibold uppercase tracking-wider text-xs">User</th>
                <th className="px-6 py-4 font-semibold uppercase tracking-wider text-xs">Aksi</th>
                <th className="px-6 py-4 font-semibold uppercase tracking-wider text-xs">Entity</th>
                <th className="px-6 py-4 font-semibold uppercase tracking-wider text-xs">Metadata</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {logs.map((log) => (
                <tr key={log.id} className="transition-colors hover:bg-muted/50">
                  <td className="px-6 py-4">
                    <span className="font-mono text-xs text-muted-foreground">
                      {new Date(log.createdAt).toLocaleString("id-ID")}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div>
                      <p className="font-medium text-foreground">{log.tenant?.name ?? "-"}</p>
                      <p className="font-mono text-xs text-muted-foreground">{log.tenant?.code ?? "-"}</p>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div>
                      <p className="font-medium text-foreground">{log.user?.name ?? "-"}</p>
                      <p className="text-xs text-muted-foreground">{log.user?.email ?? "-"}</p>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="inline-flex border border-domain-roasting/20 bg-domain-roasting/8 px-2 py-1 text-xs font-bold uppercase tracking-wider text-domain-roasting">
                      {log.action}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="font-mono text-xs text-muted-foreground">
                      {log.entityType}:{log.entityId?.slice(0, 8)}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="font-mono text-xs text-muted-foreground">
                      {log.metadata ? JSON.stringify(log.metadata).slice(0, 50) : "-"}
                    </span>
                  </td>
                </tr>
              ))}

              {logs.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-muted-foreground">
                    Belum ada record audit.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
