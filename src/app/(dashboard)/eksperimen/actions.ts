"use server";

import { revalidatePath } from "next/cache";
import { appendFefoLedgerOut, appendLedger } from "@/lib/stock";
import { getCurrentTenantId, getSystemUserId, requireRole, requireTenantPrisma } from "@/lib/auth";
import { recordAudit } from "@/lib/audit";
import { randomBytes } from "crypto";
import { getCurrentDate } from "@/lib/date-utils";
import { postExperimentalProduction, postVoidReversal } from "@/lib/posting";
import { Prisma } from "@prisma/client";
import { z } from "zod";

// =============================================================================
// TYPES
// =============================================================================

export type RBStockOption = {
  id: string;
  name: string;
  stockKg: number;
  avgCostPerKg: number;
};

export type SupplyOption = {
  id: string;
  code: string;
  name: string;
  baseUnit: string;
  costPerUnit: number;
  stockQuantity: number;
};

export type FGProductOption = {
  id: string;
  name: string;
  type: string;
};

export type ExperimentalComponentInput = {
  componentType: "GREEN_BEAN" | "ROASTED_BEAN" | "SUPPLY" | "PACKAGING";
  productId?: string;
  supplyItemId?: string;
  quantity: number;
  lotId?: string;
  lotNumber?: string;
  notes?: string;
};

export type ExperimentalProductionRow = {
  id: string;
  code: string;
  name: string;
  outputProductName: string;
  inputKg: number;
  outputKg: number;
  lossKg: number;
  hppPerUnit: number;
  status: string;
  createdAt: string;
  notes: string | null;
  componentCount: number;
};

export type ExperimentalPageData = {
  batches: ExperimentalProductionRow[];
  rbOptions: RBStockOption[];
  supplyOptions: SupplyOption[];
  fgOptions: FGProductOption[];
};

export type CreateExperimentalProductionInput = {
  operationKey: string;
  name: string;
  components: ExperimentalComponentInput[];
  outputKg: number;
  grindingCost?: number;
  notes?: string;
};

const CreateExperimentalProductionSchema = z.object({
  operationKey: z.string().uuid(),
  name: z.string().min(2, "Nama minimal 2 karakter"),
  components: z.array(z.object({
    componentType: z.enum(["GREEN_BEAN", "ROASTED_BEAN", "SUPPLY", "PACKAGING"]),
    productId: z.string().optional(),
    supplyItemId: z.string().optional(),
    quantity: z.number().positive("Quantity harus lebih dari 0"),
    lotId: z.string().optional(),
    lotNumber: z.string().optional(),
    notes: z.string().optional(),
  })).min(1, "Minimal satu komponen diperlukan"),
  outputKg: z.number().positive("Berat hasil harus lebih dari 0"),
  grindingCost: z.number().nonnegative().optional(),
  notes: z.string().optional(),
}).superRefine((data, ctx) => {
  for (let i = 0; i < data.components.length; i++) {
    const comp = data.components[i];
    if ((comp.componentType === "GREEN_BEAN" || comp.componentType === "ROASTED_BEAN") && !comp.productId) {
      ctx.addIssue({
        code: "custom",
        path: [`components.${i}.productId`],
        message: "productId wajib untuk GREEN_BEAN dan ROASTED_BEAN",
      });
    }
    if ((comp.componentType === "SUPPLY" || comp.componentType === "PACKAGING") && !comp.supplyItemId) {
      ctx.addIssue({
        code: "custom",
        path: [`components.${i}.supplyItemId`],
        message: "supplyItemId wajib untuk SUPPLY dan PACKAGING",
      });
    }
  }
});

export type ExperimentalActionResult =
  | { success: true; batchCode: string }
  | { success: false; error: string };

// =============================================================================
// HELPERS
// =============================================================================

async function generateBatchCode(): Promise<string> {
  const now = getCurrentDate();
  const prefix = `EXP-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}`;
  const randStr = randomBytes(4).toString("hex").toUpperCase();
  return `${prefix}-${randStr}`;
}

// =============================================================================
// QUERIES
// =============================================================================

async function fetchRBOptions(): Promise<RBStockOption[]> {
  const products = await (await requireTenantPrisma()).product.findMany({
    where: { type: { in: ["ROASTED_BEAN", "GREEN_BEAN"] }, isActive: true },
    select: { id: true, name: true, stockKg: true, avgCostPerKg: true },
    orderBy: { name: "asc" },
  });
  return products
    .map((p) => ({
      id: p.id,
      name: p.name,
      stockKg: Number(p.stockKg),
      avgCostPerKg: Number(p.avgCostPerKg ?? 0),
    }))
    .filter((p) => p.stockKg > 0);
}

async function fetchSupplyOptions(): Promise<SupplyOption[]> {
  const items = await (await requireTenantPrisma()).inventorySupplyItem.findMany({
    where: { isActive: true, consumableInProduction: true },
    select: { id: true, code: true, name: true, baseUnit: true, costPerUnit: true, avgCostPerUnit: true, stockQuantity: true },
    orderBy: { name: "asc" },
  });
  return items
    .filter((item) => Number(item.stockQuantity) > 0)
    .map((item) => ({
      id: item.id,
      code: item.code,
      name: item.name,
      baseUnit: item.baseUnit,
      costPerUnit: Number(item.avgCostPerUnit ?? item.costPerUnit),
      stockQuantity: Number(item.stockQuantity),
    }));
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

async function fetchBatchHistory(): Promise<ExperimentalProductionRow[]> {
  const batches = await (await requireTenantPrisma()).experimentalProduction.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      outputProduct: { select: { name: true } },
      components: true,
    },
  });

  return batches.map((b) => ({
    id: b.id,
    code: b.code,
    name: b.name,
    outputProductName: b.outputProduct.name,
    inputKg: Number(b.inputKg),
    outputKg: Number(b.outputKg),
    lossKg: Number(b.lossKg),
    hppPerUnit: Number(b.hppPerUnit),
    status: b.status,
    createdAt: b.createdAt.toISOString(),
    notes: b.notes,
    componentCount: b.components.length,
  }));
}

// =============================================================================
// PUBLIC SERVER ACTIONS
// =============================================================================

export async function getExperimentalPageData(): Promise<ExperimentalPageData> {
  await requireRole("OWNER", "MANAGER", "OPERATOR");
  const [batches, rbOptions, supplyOptions, fgOptions] = await Promise.all([
    fetchBatchHistory(),
    fetchRBOptions(),
    fetchSupplyOptions(),
    fetchFGOptions(),
  ]);
  return { batches, rbOptions, supplyOptions, fgOptions };
}

export async function createExperimentalProduction(
  input: CreateExperimentalProductionInput
): Promise<ExperimentalActionResult> {
  try {
    await requireRole("OWNER", "MANAGER", "OPERATOR");
    const parsed = CreateExperimentalProductionSchema.parse(input);
    const userId = await getSystemUserId();
    const tenantId = await getCurrentTenantId();
    const tenantPrisma = await requireTenantPrisma();

    const previousAttempt = await tenantPrisma.experimentalProduction.findFirst({
      where: { operationKey: parsed.operationKey },
      select: { code: true },
    });
    if (previousAttempt) {
      return { success: true, batchCode: previousAttempt.code };
    }

    const batchCode = await generateBatchCode();

    return await tenantPrisma.$transaction(async (tx) => {
      const outputProduct = await tx.product.create({
        data: {
          tenantId,
          code: `${batchCode}-OUT`,
          name: `Experimental: ${parsed.name}`,
          type: "FINISHED_GOODS",
          stockKg: 0,
          stockUnit: 0,
          isActive: true,
        },
      });

      let totalInputKg = 0;
      let totalCost = 0;
      const componentDetails: Array<{
        componentType: string;
        productId?: string;
        supplyItemId?: string;
        quantity: number;
        quantityKg?: number;
        quantityUnit?: number;
        supplyQuantity?: number;
        unitCostSnapshot: number;
        totalCostSnapshot: number;
        lotId?: string;
        lotNumber?: string;
        notes?: string;
      }> = [];

      for (const comp of parsed.components) {
        if (comp.componentType === "GREEN_BEAN" || comp.componentType === "ROASTED_BEAN") {
          const product = await tx.product.findUnique({
            where: { id: comp.productId! },
            select: { id: true, name: true, type: true, isActive: true, stockKg: true, avgCostPerKg: true },
          });
          if (!product || !product.isActive) {
            throw new Error(`Produk ${comp.componentType} tidak valid atau sudah nonaktif.`);
          }
          if (comp.componentType === "GREEN_BEAN" && product.type !== "GREEN_BEAN") {
            throw new Error("Produk harus berupa Green Bean.");
          }
          if (comp.componentType === "ROASTED_BEAN" && product.type !== "ROASTED_BEAN") {
            throw new Error("Produk harus berupa Roasted Bean.");
          }

          const currentStock = Number(product.stockKg);
          const quantityKg = comp.quantity;
          if (currentStock < quantityKg) {
            throw new Error(
              `Stok "${product.name}" tidak cukup. Tersedia: ${currentStock.toFixed(3)} kg, dibutuhkan: ${quantityKg.toFixed(3)} kg.`,
            );
          }

          const unitCost = Number(product.avgCostPerKg ?? 0);
          if (unitCost <= 0) {
            throw new Error(`Biaya "${product.name}" belum tercatat.`);
          }

          totalInputKg += quantityKg;
          totalCost += unitCost * quantityKg;
          componentDetails.push({
            componentType: comp.componentType,
            productId: comp.productId,
            quantity: comp.quantity,
            quantityKg,
            unitCostSnapshot: unitCost,
            totalCostSnapshot: unitCost * quantityKg,
            lotId: comp.lotId,
            lotNumber: comp.lotNumber,
            notes: comp.notes,
          });
        } else {
          const supplyItem = await tx.inventorySupplyItem.findUnique({
            where: { id: comp.supplyItemId! },
            select: { id: true, name: true, isActive: true, consumableInProduction: true, avgCostPerUnit: true, stockQuantity: true, baseUnit: true, trackLot: true },
          });
          if (!supplyItem || !supplyItem.isActive) {
            throw new Error(`Supply item tidak valid atau sudah nonaktif.`);
          }
          if (!supplyItem.consumableInProduction) {
            throw new Error(`Item "${supplyItem.name}" tidak diizinkan untuk produksi.`);
          }

          const currentStock = Number(supplyItem.stockQuantity ?? 0);
          if (currentStock < comp.quantity) {
            throw new Error(
              `Stok "${supplyItem.name}" tidak cukup. Tersedia: ${currentStock.toFixed(3)}, dibutuhkan: ${comp.quantity.toFixed(3)}.`,
            );
          }

          const unitCost = Number(supplyItem.avgCostPerUnit ?? 0);
          if (unitCost <= 0) {
            throw new Error(`Biaya "${supplyItem.name}" belum tercatat.`);
          }

          totalCost += unitCost * comp.quantity;
          componentDetails.push({
            componentType: comp.componentType,
            supplyItemId: comp.supplyItemId,
            quantity: comp.quantity,
            supplyQuantity: comp.quantity,
            unitCostSnapshot: unitCost,
            totalCostSnapshot: unitCost * comp.quantity,
            lotId: comp.lotId,
            lotNumber: comp.lotNumber,
            notes: comp.notes,
          });
        }
      }

      const lossKg = totalInputKg - parsed.outputKg;
      const grindingCost = Number(parsed.grindingCost ?? 0);
      const totalCostWithGrinding = totalCost + grindingCost;
      const hppPerUnit = totalCostWithGrinding / parsed.outputKg;

      const batch = await tx.experimentalProduction.create({
        data: {
          tenantId,
          code: batchCode,
          operationKey: parsed.operationKey,
          name: parsed.name,
          outputProductId: outputProduct.id,
          inputKg: totalInputKg,
          outputKg: parsed.outputKg,
          lossKg,
          hppPerUnit,
          notes: parsed.notes?.trim() || null,
          createdById: userId,
          status: "COMPLETED",
        },
      });

      for (const detail of componentDetails) {
        await tx.experimentalProductionComponent.create({
          data: {
            tenantId,
            experimentalProductionId: batch.id,
            componentType: detail.componentType,
            productId: detail.productId,
            supplyItemId: detail.supplyItemId,
            quantityKg: detail.quantityKg,
            quantityUnit: detail.quantityUnit,
            supplyQuantity: detail.supplyQuantity,
            unitCostSnapshot: detail.unitCostSnapshot,
            totalCostSnapshot: detail.totalCostSnapshot,
            lotId: detail.lotId,
            lotNumber: detail.lotNumber,
            notes: detail.notes,
          },
        });

        if (detail.componentType === "GREEN_BEAN" || detail.componentType === "ROASTED_BEAN") {
          await appendFefoLedgerOut(tx, {
            tenantId,
            productId: detail.productId!,
            refType: "EXPERIMENTAL_COMPONENT_OUT",
            refId: batch.id,
            quantityKg: detail.quantityKg!,
            notes: `Experimental: ${batchCode}`,
            createdById: userId,
          });
        } else {
          await appendFefoLedgerOut(tx, {
            tenantId,
            supplyItemId: detail.supplyItemId!,
            refType: "EXPERIMENTAL_COMPONENT_OUT",
            refId: batch.id,
            supplyQuantity: detail.supplyQuantity!,
            notes: `Experimental: ${batchCode}`,
            createdById: userId,
          });
        }
      }

      const outputLot = await tx.lot.create({
        data: {
          tenantId,
          productId: outputProduct.id,
          batchCode: `${batchCode}-OUT`,
          quantityKg: parsed.outputKg,
          receivedAt: getCurrentDate(),
          notes: `Hasil experimental ${batchCode}`,
        },
      });

      await appendLedger(tx, {
        data: {
          tenantId,
          productId: outputProduct.id,
          entryType: "IN",
          refType: "EXPERIMENTAL_FG_IN",
          refId: batch.id,
          quantityKg: parsed.outputKg,
          incomingPrice: hppPerUnit,
          lotId: outputLot.id,
          lotNumber: outputLot.batchCode,
          notes: `Experimental: ${batchCode}`,
          createdById: userId,
        },
      });

      await postExperimentalProduction(
        batch.id,
        totalCost,
        grindingCost,
        outputProduct.name ?? batchCode,
        { tx, tenantId, userId },
      );

      await recordAudit(tx, {
        tenantId,
        userId,
        action: "CREATE",
        entityType: "ExperimentalProduction",
        entityId: batch.id,
        after: {
          code: batch.code,
          name: batch.name,
          inputKg: Number(batch.inputKg),
          outputKg: Number(batch.outputKg),
          lossKg: Number(batch.lossKg),
          hppPerUnit: Number(batch.hppPerUnit),
        },
        metadata: { operationKey: input.operationKey, componentCount: componentDetails.length },
      });

      return { success: true, batchCode: batch.code };
    }, { isolationLevel: "Serializable", maxWait: 15000, timeout: 60000 });

    revalidatePath("/eksperimen");
    revalidatePath("/produksi");
    revalidatePath("/inventory");
    return { success: true, batchCode: batchCode };
  } catch (err) {
    console.error("[createExperimentalProduction]", err);
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002" && input.operationKey) {
      const existing = await (await requireTenantPrisma()).experimentalProduction.findFirst({
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

export async function voidExperimentalProduction(
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
      const batch = await tx.experimentalProduction.findUnique({
        where: { id: batchId },
        select: { id: true, code: true, status: true, notes: true },
      });
      if (!batch) throw new Error("Batch eksperimental tidak ditemukan.");
      if (batch.status === "VOID") throw new Error("Batch sudah divoid.");

      const sourceEntries = await tx.inventoryLedger.findMany({
        where: {
          refId: batchId,
          refType: { in: ["EXPERIMENTAL_COMPONENT_OUT", "EXPERIMENTAL_FG_IN"] },
        },
      });
      if (sourceEntries.length === 0) {
        throw new Error("Ledger eksperimental tidak ditemukan; void dibatalkan.");
      }

      const outputLotIds = sourceEntries
        .filter((entry) => entry.refType === "EXPERIMENTAL_FG_IN" && entry.lotId)
        .map((entry) => entry.lotId!);
      if (outputLotIds.length > 0) {
        const downstreamCount = await tx.inventoryLedger.count({
          where: { lotId: { in: outputLotIds }, entryType: "OUT", refType: { not: "VOID_REVERSAL" } },
        });
        if (downstreamCount > 0) {
          throw new Error("Hasil eksperimental sudah dipakai di proses berikutnya. Batalkan proses turunannya terlebih dahulu.");
        }
      }

      for (const entry of sourceEntries) {
        await appendLedger(tx, {
          data: {
            tenantId,
            productId: entry.productId,
            supplyItemId: entry.supplyItemId,
            entryType: entry.entryType === "IN" ? "OUT" : "IN",
            refType: "VOID_REVERSAL",
            refId: batchId,
            quantityKg: entry.quantityKg,
            quantityUnit: entry.quantityUnit,
            supplyQuantity: entry.supplyQuantity,
            lotId: entry.lotId,
            lotNumber: entry.lotNumber,
            expiryDate: entry.expiryDate,
            notes: `Reversal Experimental: ${batch.code}`,
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

      await tx.experimentalProduction.update({
        where: { id: batchId },
        data: { status: "VOID", notes: `${batch.notes ?? ""}\n[VOID: ${reason.trim()}]`.trim() },
      });

      await postVoidReversal("EXPERIMENTAL", batch.id, reason, { tx, tenantId, userId });

      await recordAudit(tx, {
        tenantId,
        userId,
        action: "VOID",
        entityType: "ExperimentalProduction",
        entityId: batch.id,
        before: { status: batch.status },
        after: { status: "VOID", reason: reason.trim() },
      });
    }, { isolationLevel: "Serializable" });

    revalidatePath("/eksperimen");
    revalidatePath("/produksi");
    revalidatePath("/inventory");
    return { success: true };
  } catch (err) {
    console.error("[voidExperimentalProduction]", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Gagal membatalkan batch eksperimental.",
    };
  }
}
