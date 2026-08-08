"use server";

import { revalidatePath } from "next/cache";
import { getCurrentTenantId, getSystemUserId, requireRole, requireTenantPrisma } from "@/lib/auth";
import { recordAudit } from "@/lib/audit";
import { getCurrentDate } from "@/lib/date-utils";
import { Prisma } from "@prisma/client";
import { z } from "zod";

// =============================================================================
// TYPES
// =============================================================================

export type ExperimentalProductionRow = {
  id: string;
  code: string;
  name: string;
  outputProductId: string;
  outputProductName: string;
  inputKg: number;
  outputKg: number;
  hppPerUnit: number;
  status: string;
  createdAt: string;
  notes: string | null;
};

export type PromoteToCatalogInput = {
  experimentalProductionId: string;
  code: string;
  name: string;
  category?: string;
  price?: number;
  priceSilver?: number;
  priceGold?: number;
  netWeightGrams?: number;
  notes?: string;
};

const PromoteToCatalogSchema = z.object({
  experimentalProductionId: z.string().min(1),
  code: z.string().min(1, "SKU wajib diisi"),
  name: z.string().min(2, "Nama minimal 2 karakter"),
  category: z.string().optional(),
  price: z.number().nonnegative().optional(),
  priceSilver: z.number().nonnegative().optional(),
  priceGold: z.number().nonnegative().optional(),
  netWeightGrams: z.number().nonnegative().optional(),
  notes: z.string().optional(),
});

export type PromoteActionResult =
  | { success: true; productCode: string }
  | { success: false; error: string };

// =============================================================================
// PUBLIC SERVER ACTIONS
// =============================================================================

export async function promoteExperimentalToCatalog(
  input: PromoteToCatalogInput
): Promise<PromoteActionResult> {
  try {
    await requireRole("OWNER", "MANAGER");
    const parsed = PromoteToCatalogSchema.parse(input);
    const userId = await getSystemUserId();
    const tenantId = await getCurrentTenantId();
    const tenantPrisma = await requireTenantPrisma();

    const batch = await tenantPrisma.experimentalProduction.findFirst({
      where: { id: parsed.experimentalProductionId, tenantId },
      select: { id: true, code: true, name: true, outputProductId: true, status: true },
    });
    if (!batch) {
      return { success: false, error: "Batch eksperimental tidak ditemukan." };
    }
    if (batch.status === "VOID") {
      return { success: false, error: "Batch yang sudah dibatalkan tidak dapat dipromosikan." };
    }

    const existingProduct = await tenantPrisma.product.findFirst({
      where: { id: batch.outputProductId, tenantId },
      select: { id: true, code: true, isActive: true },
    });
    if (!existingProduct) {
      return { success: false, error: "Produk output tidak ditemukan." };
    }

    const codeExists = await tenantPrisma.product.findFirst({
      where: { tenantId, code: parsed.code, id: { not: existingProduct.id } },
    });
    if (codeExists) {
      return { success: false, error: `Kode/SKU "${parsed.code}" sudah digunakan oleh produk lain.` };
    }

    await tenantPrisma.product.update({
      where: { id: existingProduct.id },
      data: {
        code: parsed.code,
        name: parsed.name,
        category: parsed.category ?? null,
        price: parsed.price ?? 0,
        priceSilver: parsed.priceSilver ?? 0,
        priceGold: parsed.priceGold ?? 0,
        netWeightGrams: parsed.netWeightGrams ?? null,
        isActive: true,
      },
    });

    await recordAudit(tenantPrisma, {
      tenantId,
      userId,
      action: "PROMOTE",
      entityType: "ExperimentalProduction",
      entityId: batch.id,
      before: { productCode: existingProduct.code, productName: existingProduct.code },
      after: {
        productCode: parsed.code,
        productName: parsed.name,
        category: parsed.category,
        price: parsed.price,
      },
      metadata: { promotedFrom: "experimental" },
    });

    revalidatePath("/eksperimen");
    revalidatePath("/katalog");
    revalidatePath("/produksi");
    return { success: true, productCode: parsed.code };
  } catch (err) {
    console.error("[promoteExperimentalToCatalog]", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Gagal mempromosikan produk.",
    };
  }
}
