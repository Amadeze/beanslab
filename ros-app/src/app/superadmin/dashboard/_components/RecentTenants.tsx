"use client";

import { Coffee, ExternalLink } from "lucide-react";

import { tenantStorefrontUrl } from "@/lib/tenant-host";

type RecentTenant = {
  id: string;
  name: string;
  subdomain: string | null;
  tier: string;
  status: string;
  createdAt: string;
  accessState: "ACTIVE" | "INACTIVE" | "SUBSCRIPTION_REQUIRED";
};

export function RecentTenants({ tenants }: { tenants: RecentTenant[] }) {
  if (tenants.length === 0) {
    return <p className="py-10 text-center text-sm text-muted-foreground">Belum ada roastery.</p>;
  }

  return (
    <div className="flex flex-col">
      {tenants.map((tenant) => (
        <div
          key={tenant.id}
          className="flex items-center justify-between border-b border-border px-1 py-4 transition-colors last:border-b-0 hover:bg-muted/60"
        >
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center border border-domain-inventory/20 bg-domain-inventory/8">
              <Coffee size={16} className="text-domain-inventory" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-foreground">{tenant.name}</p>
              <div className="mt-1 flex items-center gap-2">
                <span className="bg-domain-production/10 px-1.5 text-[9px] font-bold uppercase tracking-wider text-domain-production">
                  {tenant.tier}
                </span>
                <span className={`size-1.5 rounded-full ${tenant.accessState === "ACTIVE" ? "bg-domain-inventory" : "bg-red-500"}`} />
                <span className="truncate font-mono text-xs text-muted-foreground">{tenant.subdomain || "domain belum diatur"}</span>
              </div>
            </div>
          </div>
          {tenant.subdomain && (
            <a
              href={tenantStorefrontUrl(tenant.subdomain)}
              target="_blank"
              rel="noreferrer"
              aria-label={`Buka storefront ${tenant.name}`}
              className="flex size-10 shrink-0 items-center justify-center text-muted-foreground transition-colors hover:bg-muted hover:text-primary"
            >
              <ExternalLink size={14} />
            </a>
          )}
        </div>
      ))}
    </div>
  );
}
