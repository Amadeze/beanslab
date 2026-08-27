"use server";

import { getCurrentTenantId } from "@/lib/auth";
import { getBatchLineage } from "@/lib/lineage";

/** Ambil rantai jejak satu batch roasting untuk panel konteks. */
export async function fetchBatchLineageAction(
  batchId: string,
): Promise<Awaited<ReturnType<typeof getBatchLineage>>> {
  const tenantId = await getCurrentTenantId();
  return getBatchLineage(tenantId, batchId);
}
