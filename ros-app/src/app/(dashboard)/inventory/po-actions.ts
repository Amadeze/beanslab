"use server";

import { requireRole, requireTenantPrisma, getSystemUserId } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import {
  createDraftPO,
  updateDraftPO,
  sendPO as sendPOService,
  receivePO as receivePOService,
  cancelPO as cancelPOService,
  getPOList as getPOListService,
  getPODetail as getPODetailService,
  getPOSummary as getPOSummaryService,
  type CreatePOInput,
  type UpdatePOInput,
  type ReceivePOInput,
  type POFilter,
} from "@/lib/po-lite";

// =============================================================================
// TYPES
// =============================================================================

export type ActionResult =
  | { success: true; id?: string; code?: string; purchaseCodes?: string[] }
  | { success: false; error: string };

// =============================================================================
// SERVER ACTIONS
// =============================================================================

/**
 * Create a new Draft PO
 */
export async function createPO(input: CreatePOInput): Promise<ActionResult> {
  try {
    await requireRole("OWNER", "MANAGER");
    const userId = await getSystemUserId();
    const tenantPrisma = await requireTenantPrisma();

    const result = await createDraftPO(tenantPrisma as any, input, userId);

    revalidatePath("/inventory");
    return { success: true, id: result.id, code: result.code };
  } catch (err) {
    console.error("[createPO]", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Gagal membuat PO.",
    };
  }
}

/**
 * Update an existing Draft PO
 */
export async function updatePO(input: UpdatePOInput): Promise<ActionResult> {
  try {
    await requireRole("OWNER", "MANAGER");
    const tenantPrisma = await requireTenantPrisma();

    await updateDraftPO(tenantPrisma as any, input);

    revalidatePath("/inventory");
    return { success: true };
  } catch (err) {
    console.error("[updatePO]", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Gagal mengupdate PO.",
    };
  }
}

/**
 * Send PO to supplier (DRAFT → SENT)
 */
export async function sendPOAction(poId: string): Promise<ActionResult> {
  try {
    await requireRole("OWNER", "MANAGER");
    const tenantPrisma = await requireTenantPrisma();

    await sendPOService(tenantPrisma as any, poId);

    revalidatePath("/inventory");
    return { success: true };
  } catch (err) {
    console.error("[sendPO]", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Gagal mengirim PO.",
    };
  }
}

/**
 * Receive PO items (creates Purchase + Ledger entries)
 */
export async function receivePOAction(
  poId: string,
  input: ReceivePOInput,
): Promise<ActionResult> {
  try {
    await requireRole("OWNER", "MANAGER", "OPERATOR");
    const userId = await getSystemUserId();
    const tenantPrisma = await requireTenantPrisma();

    const result = await receivePOService(
      tenantPrisma as any,
      poId,
      input,
      userId,
    );

    revalidatePath("/inventory");
    return { success: true, purchaseCodes: result.purchaseCodes };
  } catch (err) {
    console.error("[receivePO]", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Gagal menerima PO.",
    };
  }
}

/**
 * Cancel PO
 */
export async function cancelPOAction(poId: string): Promise<ActionResult> {
  try {
    await requireRole("OWNER", "MANAGER");
    const tenantPrisma = await requireTenantPrisma();

    await cancelPOService(tenantPrisma as any, poId);

    revalidatePath("/inventory");
    return { success: true };
  } catch (err) {
    console.error("[cancelPO]", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Gagal membatalkan PO.",
    };
  }
}

/**
 * Get PO list with filters
 */
export async function getPOList(
  filters?: POFilter,
): Promise<{ items: any[]; total: number }> {
  try {
    const tenantPrisma = await requireTenantPrisma();
    return await getPOListService(tenantPrisma as any, filters);
  } catch (err) {
    console.error("[getPOList]", err);
    return { items: [], total: 0 };
  }
}

/**
 * Get PO detail
 */
export async function getPODetail(poId: string): Promise<any | null> {
  try {
    const tenantPrisma = await requireTenantPrisma();
    return await getPODetailService(tenantPrisma as any, poId);
  } catch (err) {
    console.error("[getPODetail]", err);
    return null;
  }
}

/**
 * Get PO summary counts
 */
export async function getPOSummary(): Promise<{
  draft: number;
  sent: number;
  partial: number;
  received: number;
  cancelled: number;
  total: number;
}> {
  try {
    const tenantPrisma = await requireTenantPrisma();
    return await getPOSummaryService(tenantPrisma as any);
  } catch (err) {
    console.error("[getPOSummary]", err);
    return { draft: 0, sent: 0, partial: 0, received: 0, cancelled: 0, total: 0 };
  }
}
