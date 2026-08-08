import { prisma } from "@/lib/prisma";
import Link from "next/link";
import Image from "next/image";
import { TenantForm } from "./_components/TenantForm";
import { EditTenantDialog } from "./_components/EditTenantDialog";
import { Coffee, ExternalLink } from "lucide-react";
import { tenantStorefrontUrl } from "@/lib/tenant-host";

export const dynamic = "force-dynamic";

export default async function TenantsPage() {
  const tenants = await prisma.tenant.findMany({
    where: { id: { not: "default" } },
    include: {
      users: {
        where: { role: "OWNER" },
        take: 1
      },
      invoices: {
        select: { id: true }
      }
    },
    orderBy: { createdAt: "desc" }
  });

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-7 p-5 md:p-8">
      <div className="flex flex-col items-start justify-between gap-5 sm:flex-row sm:items-end">
        <div>
          <p className="mb-3 text-xs font-black uppercase tracking-[0.24em] text-domain-roasting">Roastery network</p>
          <h2 className="text-3xl font-black tracking-[-0.045em]">Tenant registry</h2>
          <p className="mt-2 text-sm text-muted-foreground">Kelola identitas, akses, domain, dan subscription seluruh roastery.</p>
        </div>
        <TenantForm />
      </div>

      <div className="hidden overflow-hidden border border-border bg-card md:block">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="border-b border-border bg-muted/60 text-muted-foreground">
              <tr>
                <th className="px-6 py-4 font-semibold uppercase tracking-wider text-xs">Outlet Info</th>
                <th className="px-6 py-4 font-semibold uppercase tracking-wider text-xs">Admin Contact</th>
                <th className="px-6 py-4 font-semibold uppercase tracking-wider text-xs">Subdomain</th>
                <th className="px-6 py-4 font-semibold uppercase tracking-wider text-xs">Subscription</th>
                <th className="px-6 py-4 font-semibold uppercase tracking-wider text-xs">Status</th>
                <th className="px-6 py-4 font-semibold uppercase tracking-wider text-xs text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {tenants.map((t) => (
                <tr key={t.id} className="transition-colors hover:bg-muted/50">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="flex size-10 shrink-0 items-center justify-center border border-domain-inventory/20 bg-domain-inventory/8">
                        {t.logoUrl ? (
                          <Image src={t.logoUrl} alt="" width={24} height={24} unoptimized className="size-6 object-contain" />
                        ) : (
                          <Coffee size={18} className="text-domain-inventory" />
                        )}
                      </div>
                      <div>
                        <Link href={`/superadmin/tenants/${t.id}`} className="font-bold text-foreground hover:text-primary hover:underline">{t.name}</Link>
                        <p className="font-mono text-xs text-muted-foreground">{t.code}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <p className="font-medium text-foreground">{t.users[0]?.name || "N/A"}</p>
                    <p className="text-xs text-muted-foreground">{t.users[0]?.email || "N/A"}</p>
                  </td>
                  <td className="px-6 py-4">
                    <a 
                      href={t.subdomain ? tenantStorefrontUrl(t.subdomain) : "#"}
                      target="_blank" rel="noreferrer"
                      className="inline-flex items-center gap-1.5 border border-domain-roasting/20 bg-domain-roasting/8 px-2.5 py-1 font-mono text-xs text-domain-roasting transition-colors hover:bg-domain-roasting/15"
                    >
                      {t.subdomain}
                      <ExternalLink size={12} />
                    </a>
                  </td>
                  <td className="px-6 py-4">
                    <p className="font-medium text-foreground">{t.subscriptionTier}</p>
                    <p className={`text-xs ${t.subscriptionStatus === 'ACTIVE' ? 'text-domain-inventory' : 'text-domain-production'}`}>
                      {t.subscriptionStatus}
                    </p>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex border px-2 py-1 text-xs font-bold uppercase tracking-wider ${
                      t.isActive 
                        ? "border-domain-inventory/20 bg-domain-inventory/8 text-domain-inventory" 
                        : "border-destructive/20 bg-destructive/8 text-destructive"
                    }`}>
                      {t.isActive ? "ACTIVE" : "INACTIVE"}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <EditTenantDialog 
                      tenant={{
                        id: t.id,
                        name: t.name,
                        code: t.code,
                        isActive: t.isActive,
                        subscriptionTier: t.subscriptionTier,
                        subscriptionStatus: t.subscriptionStatus
                      }}
                    />
                  </td>
                </tr>
              ))}
              
              {tenants.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-muted-foreground">
                    Belum ada outlet terdaftar.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid gap-3 md:hidden">
        {tenants.map((t) => (
          <article key={t.id} className="border border-border bg-card p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex size-10 shrink-0 items-center justify-center border border-domain-inventory/20 bg-domain-inventory/8">
                  <Coffee size={18} className="text-domain-inventory" />
                </div>
                <div className="min-w-0">
                  <Link href={`/superadmin/tenants/${t.id}`} className="block truncate font-bold hover:text-primary hover:underline">{t.name}</Link>
                  <p className="font-mono text-xs text-muted-foreground">{t.code}</p>
                </div>
              </div>
              <EditTenantDialog
                tenant={{
                  id: t.id,
                  name: t.name,
                  code: t.code,
                  isActive: t.isActive,
                  subscriptionTier: t.subscriptionTier,
                  subscriptionStatus: t.subscriptionStatus
                }}
              />
            </div>
            <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-border pt-4 text-xs">
              <div>
                <dt className="text-muted-foreground">Owner</dt>
                <dd className="mt-1 truncate font-semibold">{t.users[0]?.name || "N/A"}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Subscription</dt>
                <dd className="mt-1 font-semibold">{t.subscriptionTier}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Domain</dt>
                <dd className="mt-1 truncate font-mono text-domain-roasting">{t.subdomain}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Status</dt>
                <dd className={`mt-1 font-bold ${t.isActive ? "text-domain-inventory" : "text-destructive"}`}>
                  {t.isActive ? "ACTIVE" : "INACTIVE"}
                </dd>
              </div>
            </dl>
          </article>
        ))}
        {tenants.length === 0 && (
          <div className="border border-dashed border-border bg-card p-10 text-center text-sm text-muted-foreground">
            Belum ada outlet terdaftar.
          </div>
        )}
      </div>
    </div>
  );
}
