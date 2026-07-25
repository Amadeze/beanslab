"use server";

import { revalidatePath } from "next/cache";
import { appendLedger } from "@/lib/stock";
import { getCurrentTenantId, getSystemUserId, requireRole, requireTenantPrisma } from "@/lib/auth";
import { recordAudit } from "@/lib/audit";
import { randomBytes } from "crypto";
import { validateRoastingWeights } from "@/lib/operations";
import { getCurrentDate } from "@/lib/date-utils";
import { Prisma } from "@prisma/client";
import { analyzeRoastOutcome, type RoastOutcome } from "@/lib/roast-intent";
import { greenBeanIdentity, roastedBeanName, type RoastLevelValue } from "@/lib/roast-product";

// =============================================================================
// TYPES
// =============================================================================

export type GBStockOption = {
  id: string;
  name: string;
  origin: string | null;
  stockKg: number;
  lots: { lotNumber: string; expiryDate: string | null; remainingKg: number }[];
};

export type RBProductOption = {
  id: string;
  name: string;
  origin: string | null;
  roastLevel: string | null;
  sourceGreenBeanId: string | null;
};

export type ChildBatchRow = {
  id: string;
  roastId: string | null;
  roastDuration: number | null;
  dropTemp: number | null;
  roastTitle: string | null;
  roastedWeightGrams: number | null;
};

export type ParentRoastingBatchRow = {
  id: string;
  code: string;
  inputProductId: string;
  outputProductId: string;
  inputProductName: string;
  outputProductName: string;
  targetWeightKg: number;
  actualOutputKg: number | null;
  totalShrinkagePercent: number | null;
  status: string;
  createdAt: string;
  notes: string | null;
  childBatches: ChildBatchRow[];
};

export type MachineOption = {
  id: string;
  name: string;
  capacityKg: number | null;
};

export type RoastingPageData = {
  batches: ParentRoastingBatchRow[];
  gbOptions: GBStockOption[];
  rbOptions: RBProductOption[];
  machineOptions: MachineOption[];
};

export type RoastProfileRow = {
  id: string;
  title: string | null;
  roastDate: string | null;
  duration: number | null;
  chargeTemperature: number | null;
  dropTemperature: number | null;
  firstCrackStartTime: number | null;
  firstCrackEndTime: number | null;
  greenWeightGrams: number | null;
  roastedWeightGrams: number | null;
  lossPercent: number | null;
  metadata: Record<string, unknown> | null;
  beanTemperatureSeries: Array<{ second: number; value: number }> | null;
  environmentalTemperatureSeries: Array<{ second: number; value: number }> | null;
  events: Array<{ second: number; type: string; value?: string | number; label?: string }> | null;
  machine: { name: string };
  createdAt: string;
};

export type CreateParentRoastingBatchInput = {
  operationKey: string;
  mode: "ARTISAN" | "MANUAL";
  inputProductId: string;
  targetWeightKg: number;
  outputMode: "auto" | "existing" | "new";
  outputProductId?: string;
  outputProductName?: string;
  outputProductOrigin?: string;
  outputRoastLevel?: string;
  actualOutputKg?: number;
  notes?: string;
  lotNumber?: string;
  machineId?: string;
};

export type RoastingActionResult =
  | { success: true; batchCode: string; outcome?: RoastOutcome; splits?: number }
  | { success: false; error: string };

// =============================================================================
// HELPERS
// =============================================================================

async function generateBatchCode(): Promise<string> {
  const now = getCurrentDate();
  const prefix = `RST-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}`;
  const randStr = randomBytes(4).toString("hex").toUpperCase();
  return `${prefix}-${randStr}`;
}

function generateRBCode(name: string): string {
  const slug = name
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 12);
  return `RB-${slug || "BARU"}-${randomBytes(2).toString("hex").toUpperCase()}`;
}

// =============================================================================
// QUERIES
// =============================================================================

async function fetchGBOptions(): Promise<GBStockOption[]> {
  const tp = await requireTenantPrisma();
  const products = await tp.product.findMany({
    where: { type: "GREEN_BEAN", isActive: true },
    select: { id: true, name: true, origin: true, stockKg: true },
    orderBy: { name: "asc" },
  });

  const productIds = products.map((p) => p.id);
  
  const ledgerEntries = await tp.inventoryLedger.findMany({
    where: { productId: { in: productIds }, lotNumber: { not: null } },
    select: { productId: true, entryType: true, quantityKg: true, lotNumber: true, expiryDate: true },
  });

  const lotsByProduct: Record<string, Record<string, { lotNumber: string, expiryDate: string | null, remainingKg: number }>> = {};
  
  for (const entry of ledgerEntries) {
    if (!entry.productId || !entry.lotNumber) continue;
    if (!lotsByProduct[entry.productId]) lotsByProduct[entry.productId] = {};
    if (!lotsByProduct[entry.productId][entry.lotNumber]) {
      lotsByProduct[entry.productId][entry.lotNumber] = {
        lotNumber: entry.lotNumber,
        expiryDate: entry.expiryDate ? entry.expiryDate.toISOString() : null,
        remainingKg: 0,
      };
    }
    const qty = Number(entry.quantityKg || 0);
    if (entry.entryType === "IN") {
      lotsByProduct[entry.productId][entry.lotNumber].remainingKg += qty;
    } else {
      lotsByProduct[entry.productId][entry.lotNumber].remainingKg -= qty;
    }
  }

  return products
    .map((p) => {
      const pLotsObj = lotsByProduct[p.id] || {};
      const lots = Object.values(pLotsObj)
        .filter((l) => l.remainingKg > 0.001) // handle floating point issues
        .sort((a, b) => {
           if (!a.expiryDate) return 1;
           if (!b.expiryDate) return -1;
           return new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime();
        });
      
      return {
        id: p.id,
        name: p.name,
        origin: p.origin,
        stockKg: Number(p.stockKg),
        lots,
      };
    })
    .filter((p) => p.stockKg > 0);
}

async function fetchRBOptions(): Promise<RBProductOption[]> {
  return (await requireTenantPrisma()).product.findMany({
    where: { type: "ROASTED_BEAN", isActive: true },
    select: { id: true, name: true, origin: true, roastLevel: true, sourceGreenBeanId: true },
    orderBy: { name: "asc" },
  });
}

async function fetchBatchHistory(): Promise<ParentRoastingBatchRow[]> {
  const batches = await (await requireTenantPrisma()).parentRoastingBatch.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      inputProduct:  { select: { name: true } },
      outputProduct: { select: { name: true } },
      childBatches: {
        select: {
          id: true,
          roastId: true,
          roastDuration: true,
          dropTemp: true,
        },
      },
    },
  });

  // Fetch linked roast data for child batches with roastId
  const childRoastIds = batches
    .flatMap((b) => b.childBatches)
    .filter((c) => c.roastId)
    .map((c) => c.roastId!);
  const childRoasts = childRoastIds.length > 0
    ? await (await requireTenantPrisma()).roast.findMany({
        where: { id: { in: childRoastIds } },
        select: { id: true, title: true, roastedWeightGrams: true, duration: true },
      })
    : [];
  const childRoastMap = new Map(childRoasts.map((r) => [r.id, r]));

  return batches.map((b) => ({
    id: b.id,
    code: b.code,
    inputProductId: b.inputProductId,
    outputProductId: b.outputProductId,
    inputProductName:  b.inputProduct.name,
    outputProductName: b.outputProduct.name,
    targetWeightKg:     Number(b.targetWeightKg),
    actualOutputKg:    b.actualOutputKg ? Number(b.actualOutputKg) : null,
    totalShrinkagePercent: b.totalShrinkagePercent ? Number(b.totalShrinkagePercent) : null,
    status:            b.status,
    notes:             b.notes,
    createdAt:         b.createdAt.toISOString(),
    childBatches: b.childBatches.map((c) => ({
      id: c.id,
      roastId: c.roastId,
      roastDuration: c.roastDuration,
      dropTemp: c.dropTemp ? Number(c.dropTemp) : null,
      roastTitle: c.roastId ? childRoastMap.get(c.roastId)?.title ?? null : null,
      roastedWeightGrams: c.roastId ? childRoastMap.get(c.roastId)?.roastedWeightGrams ? Number(childRoastMap.get(c.roastId)!.roastedWeightGrams) : null : null,
    })),
  }));
}

async function fetchMachineOptions(): Promise<MachineOption[]> {
  const tp = await requireTenantPrisma();
  const machines = await tp.machine.findMany({
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

// =============================================================================
// PUBLIC SERVER ACTIONS
// =============================================================================

export async function getRoastingPageData(): Promise<RoastingPageData> {
  await requireRole("OWNER", "MANAGER", "OPERATOR");
  const [batches, gbOptions, rbOptions, machineOptions] = await Promise.all([
    fetchBatchHistory(),
    fetchGBOptions(),
    fetchRBOptions(),
    fetchMachineOptions(),
  ]);
  return { batches, gbOptions, rbOptions, machineOptions };
}

export async function getRoastProfiles(): Promise<RoastProfileRow[]> {
  await requireRole("OWNER", "MANAGER", "OPERATOR");
  const tp = await requireTenantPrisma();
  const roasts = await tp.roast.findMany({
    select: {
      id: true,
      title: true,
      roastDate: true,
      duration: true,
      chargeTemperature: true,
      dropTemperature: true,
      firstCrackStartTime: true,
      firstCrackEndTime: true,
      greenWeightGrams: true,
      roastedWeightGrams: true,
      lossPercent: true,
      metadata: true,
      beanTemperatureSeries: true,
      environmentalTemperatureSeries: true,
      events: true,
      machine: { select: { name: true } },
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return roasts.map((roast) => ({
    ...roast,
    roastDate: roast.roastDate?.toISOString() ?? null,
    createdAt: roast.createdAt.toISOString(),
    metadata: roast.metadata as Record<string, unknown> | null,
    beanTemperatureSeries: roast.beanTemperatureSeries as RoastProfileRow["beanTemperatureSeries"],
    environmentalTemperatureSeries:
      roast.environmentalTemperatureSeries as RoastProfileRow["environmentalTemperatureSeries"],
    events: roast.events as RoastProfileRow["events"],
  }));
}

export async function createParentRoastingBatch(
  input: CreateParentRoastingBatchInput
): Promise<RoastingActionResult> {
  try {
    await requireRole("OWNER", "MANAGER", "OPERATOR");
    if (!input.operationKey || !/^[0-9a-f-]{36}$/i.test(input.operationKey)) {
      return { success: false, error: "Identitas transaksi tidak valid. Buka ulang form lalu coba lagi." };
    }
    if (!(["ARTISAN", "MANUAL"] as const).includes(input.mode)) {
      return { success: false, error: "Metode pencatatan roasting tidak valid." };
    }
    const userId = await getSystemUserId();
    const tenantId = await getCurrentTenantId();
    const weightError = validateRoastingWeights(input);
    if (weightError) return { success: false, error: weightError };

    const tenantPrisma = await requireTenantPrisma();
    const previousAttempt = await tenantPrisma.parentRoastingBatch.findFirst({
      where: { operationKey: input.operationKey },
      select: { code: true, targetWeightKg: true, actualOutputKg: true },
    });
    if (previousAttempt) {
      return {
        success: true,
        batchCode: previousAttempt.code,
        outcome: previousAttempt.actualOutputKg
          ? analyzeRoastOutcome(
              Number(previousAttempt.targetWeightKg),
              Number(previousAttempt.actualOutputKg),
            )
          : undefined,
      };
    }

    const roastLevels = ["LIGHT", "MEDIUM", "MEDIUM_DARK", "DARK"] as const;
    const requestedRoastLevel = roastLevels.includes(
      input.outputRoastLevel as (typeof roastLevels)[number],
    )
      ? (input.outputRoastLevel as (typeof roastLevels)[number])
      : null;
    if (!requestedRoastLevel) {
      return { success: false, error: "Pilih level roasting: Light, Medium, Medium Dark, atau Dark." };
    }
    const batchCode = await generateBatchCode();
    const result = await tenantPrisma.$transaction(async (tx) => {
      const inputProduct = await tx.product.findUnique({
        where: { id: input.inputProductId },
        select: {
          id: true,
          name: true,
          type: true,
          category: true,
          origin: true,
          description: true,
          imageUrl: true,
          isActive: true,
          stockKg: true,
          avgCostPerKg: true,
        },
      });
      if (!inputProduct || !inputProduct.isActive || inputProduct.type !== "GREEN_BEAN") {
        throw new Error("Produk input harus Green Bean aktif.");
      }
      const currentStock = Number(inputProduct.stockKg);
      if (currentStock < input.targetWeightKg) {
        throw new Error(
          `Stok Green Bean tidak cukup. Tersedia: ${currentStock.toFixed(3)} kg, dibutuhkan: ${input.targetWeightKg.toFixed(3)} kg.`,
        );
      }

      const automaticName = roastedBeanName(
        inputProduct.name,
        requestedRoastLevel as RoastLevelValue,
      );
      let outputProduct = input.outputMode === "existing" && input.outputProductId
        ? await tx.product.findUnique({ where: { id: input.outputProductId } })
        : null;
      if (outputProduct && (outputProduct.type !== "ROASTED_BEAN" || !outputProduct.isActive)) {
        throw new Error("Produk output harus Roasted Bean aktif.");
      }

      if (outputProduct) {
        if (outputProduct.roastLevel !== requestedRoastLevel) {
          throw new Error("Level roasting tidak cocok dengan produk Roasted Bean yang dipilih.");
        }
        if (outputProduct.sourceGreenBeanId && outputProduct.sourceGreenBeanId !== inputProduct.id) {
          throw new Error("Roasted Bean tersebut berasal dari Green Bean yang berbeda.");
        }
        if (!outputProduct.sourceGreenBeanId) {
          const sameIdentity = outputProduct.name
            .toLocaleLowerCase("id-ID")
            .includes(greenBeanIdentity(inputProduct.name).toLocaleLowerCase("id-ID"));
          const sameOrigin = !inputProduct.origin
            || outputProduct.origin?.toLocaleLowerCase("id-ID") === inputProduct.origin.toLocaleLowerCase("id-ID");
          if (!sameIdentity || !sameOrigin) {
            throw new Error("Produk output tidak cocok dengan identitas Green Bean yang dipilih.");
          }
          outputProduct = await tx.product.update({
            where: { id: outputProduct.id },
            data: { sourceGreenBeanId: inputProduct.id },
          });
        }
      }

      if (!outputProduct) {
        outputProduct = await tx.product.findFirst({
          where: {
            type: "ROASTED_BEAN",
            roastLevel: requestedRoastLevel,
            sourceGreenBeanId: inputProduct.id,
          },
        });
        if (!outputProduct) {
          outputProduct = await tx.product.findFirst({
            where: {
              type: "ROASTED_BEAN",
              roastLevel: requestedRoastLevel,
              sourceGreenBeanId: null,
              name: { equals: automaticName, mode: "insensitive" },
              origin: inputProduct.origin,
            },
          });
        }
        if (outputProduct) {
          outputProduct = await tx.product.update({
            where: { id: outputProduct.id },
            data: { sourceGreenBeanId: inputProduct.id, isActive: true },
          });
        } else {
          outputProduct = await tx.product.upsert({
            where: {
              tenantId_sourceGreenBeanId_roastLevel: {
                tenantId,
                sourceGreenBeanId: inputProduct.id,
                roastLevel: requestedRoastLevel,
              },
            },
            update: { isActive: true },
            create: {
              code: generateRBCode(automaticName),
              name: automaticName,
              type: "ROASTED_BEAN",
              category: inputProduct.category,
              origin: inputProduct.origin,
              roastLevel: requestedRoastLevel,
              sourceGreenBeanId: inputProduct.id,
              description: inputProduct.description,
              imageUrl: inputProduct.imageUrl,
            },
          });
        }
      }

      let outcome: RoastOutcome | undefined;
      if (input.mode === "MANUAL") {
        const comparableBatches = await tx.parentRoastingBatch.findMany({
          where: {
            inputProductId: input.inputProductId,
            outputProductId: outputProduct.id,
            status: "COMPLETED",
            totalShrinkagePercent: { not: null },
          },
          orderBy: { completedAt: "desc" },
          take: 10,
          select: { totalShrinkagePercent: true },
        });
        outcome = analyzeRoastOutcome(
          input.targetWeightKg,
          Number(input.actualOutputKg),
          comparableBatches.map((batch) => Number(batch.totalShrinkagePercent)),
        );
      }

      const batch = await tx.parentRoastingBatch.create({
        data: {
          code: batchCode,
          operationKey: input.operationKey,
          inputProductId:   input.inputProductId,
          targetWeightKg:   input.targetWeightKg,
          outputProductId:  outputProduct.id,
          actualOutputKg:   input.mode === "MANUAL" ? Number(input.actualOutputKg) : null,
          totalShrinkagePercent: outcome?.lossPercent ?? null,
          status:           input.mode === "MANUAL" ? "COMPLETED" : "PENDING",
          notes:            input.notes?.trim() || null,
          completedAt:      input.mode === "MANUAL" ? getCurrentDate() : null,
          createdById:      userId,
          machineId:        input.machineId || null,
        },
      });

      // Auto-split: check if targetWeightKg exceeds machine capacity
      let splits = 0;
      if (input.machineId && input.mode === "ARTISAN") {
        const machine = await tx.machine.findUnique({
          where: { id: input.machineId },
          select: { capacityKg: true, name: true },
        });
        if (machine?.capacityKg && Number(machine.capacityKg) > 0) {
          const capacity = Number(machine.capacityKg);
          if (input.targetWeightKg > capacity) {
            // Calculate splits
            splits = Math.ceil(input.targetWeightKg / capacity);
            const weightPerSplit = input.targetWeightKg / splits;

            // Create ChildRoastingBatches for each split
            for (let i = 0; i < splits; i++) {
              await tx.childRoastingBatch.create({
                data: {
                  parentId: batch.id,
                  tenantId,
                  roastDuration: null,
                  dropTemp: null,
                  recordedAt: new Date(),
                },
              });
            }

            // Update batch notes with split info
            await tx.parentRoastingBatch.update({
              where: { id: batch.id },
              data: {
                notes: `${input.notes?.trim() || ""}\n[Auto-split: ${splits} batch @ ${weightPerSplit.toFixed(2)} kg dari ${machine.name}]`.trim(),
              },
            });
          }
        }
      }

      // Always deduct GB immediately
      await appendLedger(tx, {
        data: {
          productId:   input.inputProductId,
          entryType:   "OUT",
          refType:     "ROASTING_GB_OUT",
          refId:       batch.id,
          quantityKg:  input.targetWeightKg,
          lotNumber:   input.lotNumber || null,
          notes:       `Roasting: ${batch.code}`,
          createdById: userId,
        },
      });

      // If MANUAL, also add RB immediately
      if (input.mode === "MANUAL") {
        await appendLedger(tx, {
          data: {
            productId:   outputProduct.id,
            entryType:   "IN",
            refType:     "ROASTING_RB_IN",
            refId:       batch.id,
            quantityKg:  Number(input.actualOutputKg),
            incomingPrice: (Number(inputProduct.avgCostPerKg ?? 0) * input.targetWeightKg) / Number(input.actualOutputKg),
            notes:       `Roasting: ${batch.code}`,
            createdById: userId,
          },
        });
      }

      await recordAudit(tx, {
        tenantId,
        userId,
        action: "CREATE",
        entityType: "ParentRoastingBatch",
        entityId: batch.id,
        after: {
          code: batch.code,
          mode: input.mode,
          status: batch.status,
          targetWeightKg: Number(batch.targetWeightKg),
          actualOutputKg: batch.actualOutputKg
            ? Number(batch.actualOutputKg)
            : null,
        },
        metadata: {
          operationKey: input.operationKey,
          outcomeStatus: outcome?.status ?? null,
          expectedLossPercent: outcome?.expectedLossPercent ?? null,
          expectedRange: outcome
            ? [outcome.expectedMinPercent, outcome.expectedMaxPercent]
            : null,
          historySampleCount: outcome?.historySampleCount ?? 0,
        },
      });
      return { batchCode: batch.code, outcome, splits };
    }, { isolationLevel: "Serializable" });

    revalidatePath("/roasting");
    revalidatePath("/inventory");
    revalidatePath("/dashboard");
    revalidatePath("/laporan");
    revalidatePath("/produksi");
    return { success: true, ...result };
  } catch (err) {
    console.error("[createParentRoastingBatch]", err);
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002" && input.operationKey) {
      const existing = await (await requireTenantPrisma()).parentRoastingBatch.findFirst({
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

export async function completeParentRoastingBatch(
  batchId: string,
  actualOutputKg: number
): Promise<RoastingActionResult> {
  try {
    await requireRole("OWNER", "MANAGER", "OPERATOR");
    if (!Number.isFinite(actualOutputKg) || actualOutputKg <= 0) {
      return { success: false, error: "Berat hasil harus lebih dari 0." };
    }
    const userId = await getSystemUserId();
    const tenantId = await getCurrentTenantId();
    const tenantPrisma = await requireTenantPrisma();

    const result = await tenantPrisma.$transaction(async (tx) => {
      const batch = await tx.parentRoastingBatch.findUnique({ 
        where: { id: batchId },
        include: { inputProduct: { select: { avgCostPerKg: true } } }
      });
      if (!batch) {
        throw new Error("Batch roasting tidak ditemukan.");
      }
      if (batch.status === "COMPLETED" && batch.actualOutputKg) {
        const recordedOutputKg = Number(batch.actualOutputKg);
        if (Math.abs(recordedOutputKg - actualOutputKg) < 0.0001) {
          return {
            batchCode: batch.code,
            outcome: analyzeRoastOutcome(Number(batch.targetWeightKg), recordedOutputKg),
          };
        }
        throw new Error("Batch sudah selesai dengan berat hasil yang berbeda.");
      }
      if (batch.status !== "PENDING") {
        throw new Error("Batch tidak dapat diselesaikan karena statusnya bukan proses.");
      }

      const recentComparable = await tx.parentRoastingBatch.findMany({
        where: {
          id: { not: batch.id },
          inputProductId: batch.inputProductId,
          outputProductId: batch.outputProductId,
          status: "COMPLETED",
          totalShrinkagePercent: { not: null },
        },
        orderBy: { completedAt: "desc" },
        take: 10,
        select: { totalShrinkagePercent: true },
      });
      const outcome = analyzeRoastOutcome(
        Number(batch.targetWeightKg),
        actualOutputKg,
        recentComparable.map((item) => Number(item.totalShrinkagePercent)),
      );
      const claimed = await tx.parentRoastingBatch.updateMany({
        where: { id: batchId, status: "PENDING" },
        data: {
          actualOutputKg,
          totalShrinkagePercent: outcome.lossPercent,
          status: "COMPLETED",
          completedAt: getCurrentDate(),
        },
      });
      if (claimed.count !== 1) {
        throw new Error("Batch sudah diselesaikan oleh proses lain.");
      }

      await appendLedger(tx, {
        data: {
          productId:   batch.outputProductId,
          entryType:   "IN",
          refType:     "ROASTING_RB_IN",
          refId:       batch.id,
          quantityKg:  actualOutputKg,
          incomingPrice: (Number(batch.inputProduct.avgCostPerKg ?? 0) * Number(batch.targetWeightKg)) / actualOutputKg,
          notes:       `Roasting: ${batch.code}`,
          createdById: userId,
        },
      });

      await recordAudit(tx, {
        tenantId,
        userId,
        action: "COMPLETE",
        entityType: "ParentRoastingBatch",
        entityId: batch.id,
        before: { status: batch.status },
        after: {
          status: "COMPLETED",
          actualOutputKg,
          totalShrinkagePercent: outcome.lossPercent,
          outcomeStatus: outcome.status,
          expectedLossPercent: outcome.expectedLossPercent,
          expectedLossRange: [outcome.expectedMinPercent, outcome.expectedMaxPercent],
        },
      });
      return { batchCode: batch.code, outcome };
    }, { isolationLevel: "Serializable" });

    revalidatePath("/roasting");
    revalidatePath("/inventory");
    revalidatePath("/dashboard");
    revalidatePath("/laporan");
    revalidatePath("/produksi");
    return { success: true, ...result };
  } catch (err) {
    console.error("[completeParentRoastingBatch]", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Terjadi kesalahan sistem.",
    };
  }
}

export type VoidResult =
  | { success: true }
  | { success: false; error: string };

export async function voidParentRoastingBatch(
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
      const batch = await tx.parentRoastingBatch.findUnique({
        where: { id: batchId },
      });
      if (!batch) throw new Error("Batch tidak ditemukan.");
      if (batch.status === "VOID") throw new Error("Batch sudah divoid.");

      await tx.parentRoastingBatch.update({
        where: { id: batchId },
        data: {
          status: "VOID",
          voidReason: reason.trim(),
          voidAt: getCurrentDate(),
        },
      });

      // Return GB (Always) — restore WAC by passing current avg cost
      const gbProduct = await tx.product.findUnique({
        where: { id: batch.inputProductId },
        select: { avgCostPerKg: true },
      });
      await appendLedger(tx, {
        data: {
          productId:      batch.inputProductId,
          entryType:      "IN",
          refType:        "VOID_REVERSAL",
          refId:          batch.id,
          quantityKg:     batch.targetWeightKg,
          incomingPrice:  Number(gbProduct?.avgCostPerKg ?? 0),
          notes:          `Reversal Roasting: ${batch.code}`,
          createdById:    userId,
        },
      });

      // Return RB only if it was COMPLETED (RB was added)
      if (batch.status === "COMPLETED" && batch.actualOutputKg) {
        await appendLedger(tx, {
          data: {
            productId:   batch.outputProductId,
            entryType:   "OUT",
            refType:     "VOID_REVERSAL",
            refId:       batch.id,
            quantityKg:  batch.actualOutputKg,
            notes:       `Reversal Roasting: ${batch.code}`,
            createdById: userId,
          },
        });
      }

      await recordAudit(tx, {
        tenantId,
        userId,
        action: "VOID",
        entityType: "ParentRoastingBatch",
        entityId: batch.id,
        before: { status: batch.status },
        after: { status: "VOID", reason: reason.trim() },
      });
    }, { isolationLevel: "Serializable" });

    revalidatePath("/roasting");
    revalidatePath("/inventory");
    revalidatePath("/dashboard");
    revalidatePath("/laporan");
    revalidatePath("/produksi");
    return { success: true };
  } catch (err) {
    console.error("[voidParentRoastingBatch]", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Gagal membatalkan batch.",
    };
  }
}

// =============================================================================
// LINK ROAST TO BATCH
// =============================================================================

export async function linkRoastToBatch(
  batchId: string,
  roastId: string,
): Promise<RoastingActionResult> {
  try {
    const user = await requireRole("OWNER", "MANAGER");
    const tenantPrisma = await requireTenantPrisma();
    const tenantId = user.tenantId;

    // Verify batch exists and is PENDING
    const batch = await tenantPrisma.parentRoastingBatch.findFirst({
      where: { id: batchId, tenantId, status: "PENDING" },
      select: { id: true, code: true },
    });
    if (!batch) {
      return { success: false, error: "Batch tidak ditemukan atau sudah selesai." };
    }

    // Verify roast exists and belongs to tenant
    const roast = await tenantPrisma.roast.findFirst({
      where: { id: roastId, tenantId },
      select: { id: true, title: true, duration: true, dropTemperature: true },
    });
    if (!roast) {
      return { success: false, error: "Roast profile tidak ditemukan." };
    }

    // Link roast to batch — create a new ChildRoastingBatch for this roast
    await tenantPrisma.$transaction(async (tx) => {
      // Create a ChildRoastingBatch for this roast session
      await tx.childRoastingBatch.create({
        data: {
          parentId: batchId,
          tenantId,
          roastId: roastId,
          roastDuration: roast.duration,
          dropTemp: roast.dropTemperature,
          recordedAt: new Date(),
        },
      });

      await recordAudit(tx, {
        tenantId,
        userId: user.id,
        action: "LINK",
        entityType: "ParentRoastingBatch",
        entityId: batchId,
        metadata: {
          roastId: roastId,
          roastTitle: roast.title,
        },
      });
    });

    revalidatePath("/roasting");
    return { success: true, batchCode: batch.code };
  } catch (err) {
    console.error("[linkRoastToBatch]", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Gagal menghubungkan roast.",
    };
  }
}

// =============================================================================
// SPLIT BATCH BY MACHINE CAPACITY
// =============================================================================

export async function splitBatchByCapacity(
  batchId: string,
  machineId: string,
): Promise<RoastingActionResult> {
  try {
    const user = await requireRole("OWNER", "MANAGER");
    const tenantPrisma = await requireTenantPrisma();
    const tenantId = user.tenantId;

    // Verify batch exists and is PENDING
    const batch = await tenantPrisma.parentRoastingBatch.findFirst({
      where: { id: batchId, tenantId, status: "PENDING" },
      select: { id: true, code: true, targetWeightKg: true, notes: true },
    });
    if (!batch) {
      return { success: false, error: "Batch tidak ditemukan atau sudah selesai." };
    }

    // Verify machine exists and has capacity
    const machine = await tenantPrisma.machine.findFirst({
      where: { id: machineId, tenantId, isActive: true },
      select: { id: true, name: true, capacityKg: true },
    });
    if (!machine) {
      return { success: false, error: "Mesin tidak ditemukan." };
    }
    if (!machine.capacityKg || Number(machine.capacityKg) <= 0) {
      return { success: false, error: "Mesin tidak memiliki kapasitas yang valid." };
    }

    const capacity = Number(machine.capacityKg);
    const targetWeight = Number(batch.targetWeightKg);

    if (targetWeight <= capacity) {
      return { success: false, error: "Berat batch tidak melebihi kapasitas mesin." };
    }

    // Calculate splits
    const splits = Math.ceil(targetWeight / capacity);
    const weightPerSplit = targetWeight / splits;

    await tenantPrisma.$transaction(async (tx) => {
      // Check existing child batches
      const existingChildren = await tx.childRoastingBatch.count({
        where: { parentId: batchId },
      });

      // Create new child batches
      for (let i = 0; i < splits - existingChildren; i++) {
        await tx.childRoastingBatch.create({
          data: {
            parentId: batchId,
            tenantId,
            roastDuration: null,
            dropTemp: null,
            recordedAt: new Date(),
          },
        });
      }

      // Update batch notes with split info
      const splitNote = `[Auto-split: ${splits} batch @ ${weightPerSplit.toFixed(2)} kg dari ${machine.name}]`;
      const existingNotes = batch.notes || "";
      const newNotes = existingNotes.includes("[Auto-split:")
        ? existingNotes.replace(/\[Auto-split:.*?\]/, splitNote)
        : `${existingNotes}\n${splitNote}`.trim();

      await tx.parentRoastingBatch.update({
        where: { id: batchId },
        data: { notes: newNotes },
      });

      await recordAudit(tx, {
        tenantId,
        userId: user.id,
        action: "SPLIT",
        entityType: "ParentRoastingBatch",
        entityId: batchId,
        metadata: {
          machineId,
          machineName: machine.name,
          splits,
          weightPerSplit,
          targetWeight,
        },
      });
    });

    revalidatePath("/roasting");
    return { success: true, batchCode: batch.code, splits };
  } catch (err) {
    console.error("[splitBatchByCapacity]", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Gagal split batch.",
    };
  }
}
