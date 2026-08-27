"use server";

import { requireTenantPrisma, getCurrentTenantId } from "@/lib/auth";
import type { TaxConfig } from "@/lib/tax";

export async function getTenantTaxConfig(): Promise<TaxConfig> {
  const tenantId = await getCurrentTenantId();
  const tp = await requireTenantPrisma();
  const tenant = await tp.tenant.findUnique({
    where: { id: tenantId },
    select: { taxEnabled: true, defaultTaxRate: true },
  });
  return {
    enabled: tenant?.taxEnabled ?? false,
    rate: Number(tenant?.defaultTaxRate ?? 11),
  };
}
