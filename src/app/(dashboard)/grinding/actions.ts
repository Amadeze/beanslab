"use server";

import { revalidatePath } from "next/cache";
import { appendFefoLedgerOut, appendLedger } from "@/lib/stock";
import { getCurrentTenantId, getSystemUserId, requireRole, requireTenantPrisma } from "@/lib/auth";
import { recordAudit } from "@/lib/audit";
import { randomBytes } from "crypto";
import { getCurrentDate } from "@/lib/date-utils";
import { postGrindingBatch, postVoidReversal } from "@/lib/posting";
import { createLotPlacementInTx } from "@/lib/storage-location";
import { Prisma } from "@prisma/client";
import { z } from "zod";

// =============================================================================
// TYPES
// =============================================================================

export type RBStockOption = {
  id: string;
  name: string;
  origin: string | null;
  roastLevel: string | null;
  stockKg: number;
  avgCostPerKg: number;
};

export type FGProductOption = {
  id: string;
  name: string;
  type: string;
};

export type GrinderOption = {
  id: string;
  name: string;
  capacityKg: number | null;
};

export type GrindingBatchRow = {
  id: string;
  code: string;
  sourceProductName: string;
  outputProductName: string;
  grindSize: string;
  customGrindLabel: string | null;
  grinderName: string | null;
  operatorName: string;
  inputKg: number;
  outputKg: number;
  lossKg: number;
  grindingCost: number;
  status: string;
  createdAt: string;
  notes: string | null;
  batchReference: string | null;
  parentRoastBatchId: string | null;
  parentRoastBatchCode: string | null;
};

export type GrindingPageData = {
  batches: GrindingBatchRow[];
  rbOptions: RBStockOption[];
  fgOptions: FGProductOption[];
  grinderOptions: GrinderOption[];
};

export type CreateGrindingBatchInput = {
  operationKey: string;
  sourceProductId: string;
  outputProductId: string;
  grindSize: string;
  customGrindLabel?: string;
  grinderId?: string;
  inputKg: number;
  outputKg: number;
  grindingCost?: number;
  batchReference?: string;
  notes?: string;
  destinationLocationId?: string | null;
};

const CreateGrindingBatchSchema = z.object({
  operationKey: z.string().uuid(),
  sourceProductId: z.string().min(1),
  outputProductId: z.string().min(1),
  grindSize: z.enum(["WHOLE_BEAN", "COARSE", "MEDIUM_COARSE", "MEDIUM", "MEDIUM_FINE", "FINE", "ESPRESSO", "CUSTOM"]),
  customGrindLabel: z.string().optional(),
  grinderId: z.string().optional(),
  inputKg: z.number().positive("Berat masuk harus lebih dari 0"),
  outputKg: z.number().positive("Berat hasil harus lebih dari 0"),
  grindingCost: z.number().nonnegative().optional(),
  batchReference: z.string().optional(),
  notes: z.string().optional(),
  destinationLocationId: z.string().optional().nullable(),
});

export type GrindingActionResult =
  | { success: true; batchCode: string }
  | { success: false; error: string };

// =============================================================================
// HELPERS
// =============================================================================

async function generateBatchCode(): Promise<string> {
  const now = getCurrentDate();
  const prefix = `GRD-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}`;
  const randStr = randomBytes(4).toString("hex").toUpperCase();
  return `${prefix}-${randStr}`;
}

const GRIND_SIZE_LABELS: Record<string, string> = {
  WHOLE_BEAN: "Whole Bean",
  COARSE: "Coarse",
  MEDIUM_COARSE: "Medium Coarse",
  MEDIUM: "Medium",
  MEDIUM_FINE: "Medium Fine",
  FINE: "Fine",
  ESPRESSO: "Espresso",
  CUSTOM: "Custom",
};

// =============================================================================
// QUERIES
// =============================================================================

async function fetchRBOptions(): Promise<RBStockOption[]> {
  const products = await (await requireTenantPrisma()).product.findMany({
    where: { type: "ROASTED_BEAN", isActive: true },
    select: { id: true, name: true, origin: true, roastLevel: true, stockKg: true, avgCostPerKg: true },
    orderBy: { name: "asc" },
  });
  return products
    .map((p) => ({
      id: p.id,
      name: p.name,
      origin: p.origin,
      roastLevel: p.roastLevel,
      stockKg: Number(p.stockKg),
      avgCostPerKg: Number(p.avgCostPerKg ?? 0),
    }))
    .filter((p) => p.stockKg > 0);
}

async function fetchFGOptions(): Promise<FGProductOption[]> {
  const products = await (await requireTenantPrisma()).product.findMany({
    where: { type: "FINISHED_GOODS", isActive: true },
    select: { id: true, name: true, type: true },
    orderBy: { name: "asc" },
  });
  return products.map((p) => ({
    id: p.id,
    name: p.name,
    type: p.type,
  }));
}

async function fetchGrinderOptions(): Promise<GrinderOption[]> {
  const machines = await (await requireTenantPrisma()).machine.findMany({
    where: { isActive: true },
    select: { id: true, name: true, capacityKg: true },
    orderBy: { name: "asc" },
  });
  return machines.map((m) => ({
    id: m.id,
    name: m.name,
    capacityKg: m.capacityKg ? Number(m.capacityKg) : null,
  }));
}

async function fetchBatchHistory(): Promise<GrindingBatchRow[]> {
  const batches = await (await requireTenantPrisma()).grindingBatch.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      sourceProduct: { select: { name: true } },
      outputProduct: { select: { name: true } },
      grinder: { select: { name: true } },
      operator: { select: { name: true } },
      parentRoastBatch: { select: { id: true, code: true } },
    },
  });

  return batches.map((b) => ({
    id: b.id,
    code: b.code,
    sourceProductName: b.sourceProduct.name,
    outputProductName: b.outputProduct.name,
    grindSize: b.grindSize,
    customGrindLabel: b.customGrindLabel,
    grinderName: b.grinder?.name ?? null,
    operatorName: b.operator.name,
    inputKg: Number(b.inputKg),
    outputKg: Number(b.outputKg),
    lossKg: Number(b.lossKg),
    grindingCost: Number(b.grindingCost ?? 0),
    status: b.status,
    createdAt: b.createdAt.toISOString(),
    notes: b.notes,
    batchReference: b.batchReference,
    parentRoastBatchId: b.parentRoastBatch?.id ?? null,
    parentRoastBatchCode: b.parentRoastBatch?.code ?? null,
  }));
}

// =============================================================================
// PUBLIC SERVER ACTIONS
// =============================================================================

export async function getGrindingPageData(): Promise<GrindingPageData> {
  await requireRole("OWNER", "MANAGER", "OPERATOR");
  const [batches, rbOptions, fgOptions, grinderOptions] = await Promise.all([
    fetchBatchHistory(),
    fetchRBOptions(),
    fetchFGOptions(),
    fetchGrinderOptions(),
  ]);
  return { batches, rbOptions, fgOptions, grinderOptions };
}

export async function createGrindingBatch(
  input: CreateGrindingBatchInput
): Promise<GrindingActionResult> {
  try {
    await requireRole("OWNER", "MANAGER", "OPERATOR");
    const parsed = CreateGrindingBatchSchema.parse(input);
    const userId = await getSystemUserId();
    const tenantId = await getCurrentTenantId();
    const tenantPrisma = await requireTenantPrisma();

    const previousAttempt = await tenantPrisma.grindingBatch.findFirst({
      where: { operationKey: parsed.operationKey },
      select: { code: true },
    });
    if (previousAttempt) {
      return { success: true, batchCode: previousAttempt.code };
    }

    const batchCode = await generateBatchCode();

    return await tenantPrisma.$transaction(async (tx) => {
      const sourceProduct = await tx.product.findUnique({
        where: { id: parsed.sourceProductId },
        select: { id: true, name: true, type: true, isActive: true, stockKg: true, avgCostPerKg: true },
      });
      if (!sourceProduct || !sourceProduct.isActive || sourceProduct.type !== "ROASTED_BEAN") {
        throw new Error("Produk sumber harus Roasted Bean aktif.");
      }

      const outputProduct = await tx.product.findUnique({
        where: { id: parsed.outputProductId },
        select: { id: true, name: true, type: true, isActive: true },
      });
      if (!outputProduct || !outputProduct.isActive || outputProduct.type !== "FINISHED_GOODS") {
        throw new Error("Produk output harus Finished Goods aktif.");
      }

      const currentStock = Number(sourceProduct.stockKg);
      if (currentStock < parsed.inputKg) {
        throw new Error(
          `Stok Roasted Bean tidak cukup. Tersedia: ${currentStock.toFixed(3)} kg, dibutuhkan: ${parsed.inputKg.toFixed(3)} kg.`,
        );
      }

      if (parsed.outputKg >= parsed.inputKg) {
        throw new Error("Berat hasil harus lebih kecil dari berat masuk (ada susut saat grinding).");
      }

      const lossKg = parsed.inputKg - parsed.outputKg;
      const rbCostPerKg = Number(sourceProduct.avgCostPerKg ?? 0);
      const totalRbCost = rbCostPerKg * parsed.inputKg;
      const grindingCost = Number(parsed.grindingCost ?? 0);
      const totalCost = totalRbCost + grindingCost;
      const hppPerKg = totalCost / parsed.outputKg;

      const batch = await tx.grindingBatch.create({
        data: {
          tenantId,
          code: batchCode,
          operationKey: parsed.operationKey,
          sourceProductId: parsed.sourceProductId,
          outputProductId: parsed.outputProductId,
          grindSize: parsed.grindSize,
          customGrindLabel: parsed.grindSize === "CUSTOM" ? parsed.customGrindLabel?.trim() || null : null,
          grinderId: parsed.grinderId || null,
          operatorId: userId,
          inputKg: parsed.inputKg,
          outputKg: parsed.outputKg,
          lossKg,
          grindingCost,
          batchReference: parsed.batchReference?.trim() || null,
          notes: parsed.notes?.trim() || null,
          status: "COMPLETED",
        },
      });

      await appendFefoLedgerOut(tx, {
        tenantId,
        productId: parsed.sourceProductId,
        refType: "GRINDING_RB_OUT",
        refId: batch.id,
        quantityKg: parsed.inputKg,
        notes: `Grinding: ${batchCode}`,
        createdById: userId,
      });

      const outputLot = await tx.lot.create({
        data: {
          tenantId,
          productId: parsed.outputProductId,
          batchCode: `${batchCode}-GR`,
          quantityKg: parsed.outputKg,
          receivedAt: getCurrentDate(),
          notes: `Hasil grinding ${batchCode}`,
        },
      });

      await createLotPlacementInTx(tx, tenantId, outputLot.id, {
        destinationLocationId: parsed.destinationLocationId,
        quantityKg: parsed.outputKg,
      });

      await appendLedger(tx, {
        data: {
          tenantId,
          productId: parsed.outputProductId,
          entryType: "IN",
          refType: "GRINDING_FG_IN",
          refId: batch.id,
          quantityKg: parsed.outputKg,
          incomingPrice: hppPerKg,
          lotId: outputLot.id,
          lotNumber: outputLot.batchCode,
          notes: `Grinding: ${batchCode}`,
          createdById: userId,
        },
      });

      await postGrindingBatch(
        batch.id,
        totalRbCost,
        grindingCost,
        outputProduct.name ?? batchCode,
        { tx, tenantId, userId },
      );

      await recordAudit(tx, {
        tenantId,
        userId,
        action: "CREATE",
        entityType: "GrindingBatch",
        entityId: batch.id,
        after: {
          code: batch.code,
          grindSize: batch.grindSize,
          inputKg: Number(batch.inputKg),
          outputKg: Number(batch.outputKg),
          lossKg: Number(batch.lossKg),
        },
        metadata: { operationKey: input.operationKey },
      });

      return { success: true, batchCode: batch.code };
    }, { isolationLevel: "Serializable", maxWait: 15000, timeout: 60000 });

    revalidatePath("/produksi");
    revalidatePath("/inventory");
    revalidatePath("/roasting");
    return { success: true, batchCode: batchCode };
  } catch (err) {
    console.error("[createGrindingBatch]", err);
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002" && input.operationKey) {
      const existing = await (await requireTenantPrisma()).grindingBatch.findFirst({
        where: { operationKey: input.operationKey },
        select: { code: true },
      });
      if (existing) return { success: true, batchCode: existing.code };
    }
    return {
      success: false,
      error: err instanceof Error ? err.message : "Terjadi kesalahan sistem.",
    };
  }
}

export type VoidResult =
  | { success: true }
  | { success: false; error: string };

export async function voidGrindingBatch(
  batchId: string,
  reason: string
): Promise<VoidResult> {
  try {
    await requireRole("OWNER", "MANAGER");
    if (!reason.trim()) {
      return { success: false, error: "Alasan void wajib diisi." };
    }
    const userId = await getSystemUserId();
    const tenantId = await getCurrentTenantId();

    await (await requireTenantPrisma()).$transaction(async (tx) => {
      const batch = await tx.grindingBatch.findUnique({
        where: { id: batchId },
        select: { id: true, code: true, status: true, notes: true },
      });
      if (!batch) throw new Error("Batch grinding tidak ditemukan.");
      if (batch.status === "VOID") throw new Error("Batch sudah divoid.");

      const sourceEntries = await tx.inventoryLedger.findMany({
        where: {
          refId: batchId,
          refType: { in: ["GRINDING_RB_OUT", "GRINDING_FG_IN"] },
        },
      });
      if (sourceEntries.length === 0) {
        throw new Error("Ledger grinding tidak ditemukan; void dibatalkan.");
      }

      const outputLotIds = sourceEntries
        .filter((entry) => entry.refType === "GRINDING_FG_IN" && entry.lotId)
        .map((entry) => entry.lotId!);
      if (outputLotIds.length > 0) {
        const downstreamCount = await tx.inventoryLedger.count({
          where: { lotId: { in: outputLotIds }, entryType: "OUT", refType: { not: "VOID_REVERSAL" } },
        });
        if (downstreamCount > 0) {
          throw new Error("Hasil grinding sudah dipakai di proses berikutnya. Batalkan proses turunannya terlebih dahulu.");
        }
      }

      for (const entry of sourceEntries) {
        await appendLedger(tx, {
          data: {
            tenantId,
            productId: entry.productId,
            entryType: entry.entryType === "IN" ? "OUT" : "IN",
            refType: "VOID_REVERSAL",
            refId: batchId,
            quantityKg: entry.quantityKg,
            lotId: entry.lotId,
            lotNumber: entry.lotNumber,
            expiryDate: entry.expiryDate,
            notes: `Reversal Grinding: ${batch.code}`,
            createdById: userId,
          },
        });
        if (entry.lotId) {
          await tx.lot.update({
            where: { id: entry.lotId },
            data: { consumedAt: entry.entryType === "OUT" ? null : getCurrentDate() },
          });
        }
      }

      await tx.grindingBatch.update({
        where: { id: batchId },
        data: { status: "VOID", notes: `${batch.notes ?? ""}\n[VOID: ${reason.trim()}]`.trim() },
      });

      await postVoidReversal("GRINDING", batch.id, reason, { tx, tenantId, userId });

      await recordAudit(tx, {
        tenantId,
        userId,
        action: "VOID",
        entityType: "GrindingBatch",
        entityId: batch.id,
        before: { status: batch.status },
        after: { status: "VOID", reason: reason.trim() },
      });
    }, { isolationLevel: "Serializable" });

    revalidatePath("/produksi");
    revalidatePath("/inventory");
    revalidatePath("/roasting");
    return { success: true };
  } catch (err) {
    console.error("[voidGrindingBatch]", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Gagal membatalkan batch grinding.",
    };
  }
}
