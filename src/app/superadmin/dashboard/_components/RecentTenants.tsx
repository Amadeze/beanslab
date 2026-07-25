"use client";

import { motion } from "framer-motion";
import { Coffee, ExternalLink } from "lucide-react";

export function RecentTenants({ tenants }: { tenants: any[] }) {
  if (tenants.length === 0) {
    return <p className="text-sm text-muted-foreground">Belum ada roastery.</p>;
  }

  return (
    <div className="flex flex-col">
      {tenants.map((tenant, idx) => (
        <motion.div 
          key={tenant.id}
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: idx * 0.1 }}
          className="flex items-center justify-between border-b border-border px-1 py-4 transition-colors last:border-b-0 hover:bg-muted/60"
        >
          <div className="flex items-center gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center border border-domain-inventory/20 bg-domain-inventory/8">
              <Coffee size={16} className="text-domain-inventory" />
            </div>
            <div>
              <p className="text-sm font-bold text-foreground">{tenant.name}</p>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="bg-domain-production/10 px-1.5 text-[10px] font-bold uppercase tracking-wider text-domain-production">
                  {tenant.tier}
                </span>
                <span className="font-mono text-xs text-muted-foreground">{tenant.subdomain}</span>
              </div>
            </div>
          </div>
          <a 
            href={`${process.env.NEXT_PUBLIC_APP_URL || window.location.origin}/tenant/${tenant.subdomain}`} 
            target="_blank" rel="noreferrer"
            className="flex size-10 items-center justify-center text-muted-foreground transition-colors hover:bg-muted hover:text-primary"
          >
            <ExternalLink size={14} />
          </a>
        </motion.div>
      ))}
    </div>
  );
}
