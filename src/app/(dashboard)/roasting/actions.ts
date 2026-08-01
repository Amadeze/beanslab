"use server";

import { revalidatePath } from "next/cache";
import { appendFefoLedgerOut, appendLedger } from "@/lib/stock";
import { getCurrentTenantId, getSystemUserId, requireRole, requireTenantPrisma } from "@/lib/auth";
import { recordAudit } from "@/lib/audit";
import { randomBytes } from "crypto";
import { validateRoastingWeights } from "@/lib/operations";
import { getCurrentDate } from "@/lib/date-utils";
import { Prisma } from "@prisma/client";
import { analyzeRoastOutcome, type RoastOutcome } from "@/lib/roast-intent";
import { greenBeanIdentity, roastedBeanName, type RoastLevelValue } from "@/lib/roast-product";
import { postRoastingBatch, postVoidReversal } from "@/lib/posting";
import { z } from "zod";

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
  machineId: string | null;
  machineName: string | null;
  referenceProfile: { id: string; title: string } | null;
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

export type RoastReferenceOption = {
  id: string;
  title: string;
  machineId: string;
  machineName: string;
  roastDate: string | null;
  duration: number | null;
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

const CreateParentRoastingBatchSchema = z.object({
  operationKey: z.string().uuid(),
  mode: z.enum(["ARTISAN", "MANUAL"]),
  inputProductId: z.string().min(1),
  targetWeightKg: z.number().positive(),
  outputMode: z.enum(["auto", "existing", "new"]),
  outputProductId: z.string().optional(),
  outputProductName: z.string().optional(),
  outputProductOrigin: z.string().optional(),
  outputRoastLevel: z.string().optional(),
  actualOutputKg: z.number().nonnegative().optional(),
  notes: z.string().optional(),
  lotNumber: z.string().optional(),
  machineId: z.string().optional(),
});

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
      machine: { select: { id: true, name: true } },
      referenceRoast: { select: { id: true, title: true } },
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
    machineId:         b.machine?.id ?? null,
    machineName:       b.machine?.name ?? null,
    referenceProfile: b.referenceRoast
      ? { id: b.referenceRoast.id, title: b.referenceRoast.title || "Profil tanpa nama" }
      : null,
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

const roastReferenceSearchSchema = z.string().trim().max(80);
const setBatchReferenceSchema = z.object({
  batchId: z.string().min(1),
  referenceRoastId: z.string().min(1).nullable(),
});

export async function searchRoastReferenceProfiles(
  query: string,
): Promise<{ success: true; data: RoastReferenceOption[] } | { success: false; error: string }> {
  try {
    await requireRole("OWNER", "MANAGER", "OPERATOR");
    const parsed = roastReferenceSearchSchema.safeParse(query);
    if (!parsed.success) return { success: false, error: "Pencarian profil tidak valid." };

    const roasts = await (await requireTenantPrisma()).roast.findMany({
      where: parsed.data
        ? { title: { contains: parsed.data, mode: "insensitive" } }
        : undefined,
      select: {
        id: true,
        title: true,
        machineId: true,
        machine: { select: { name: true } },
        roastDate: true,
        duration: true,
      },
      orderBy: [{ roastDate: "desc" }, { createdAt: "desc" }],
      take: 30,
    });

    return {
      success: true,
      data: roasts.map((roast) => ({
        id: roast.id,
        title: roast.title || "Profil tanpa nama",
        machineId: roast.machineId,
        machineName: roast.machine.name,
        roastDate: roast.roastDate?.toISOString() ?? null,
        duration: roast.duration,
      })),
    };
  } catch (error) {
    console.error("[searchRoastReferenceProfiles]", error);
    return { success: false, error: "Profil acuan gagal dimuat." };
  }
}

export async function setBatchReferenceProfile(input: {
  batchId: string;
  referenceRoastId: string | null;
}): Promise<{ success: true; data: { title: string | null } } | { success: false; error: string }> {
  try {
    const user = await requireRole("OWNER", "MANAGER", "OPERATOR");
    const parsed = setBatchReferenceSchema.safeParse(input);
    if (!parsed.success) return { success: false, error: "Batch atau profil acuan tidak valid." };

    const tenantId = user.tenantId;
    const tenantPrisma = await requireTenantPrisma();
    const result = await tenantPrisma.$transaction(async (tx) => {
      const batch = await tx.parentRoastingBatch.findFirst({
        where: { id: parsed.data.batchId, tenantId, status: "PENDING" },
        select: { id: true, code: true, machineId: true, referenceRoastId: true },
      });
      if (!batch) throw new Error("Hanya batch yang masih proses yang dapat diubah acuannya.");

      if (!parsed.data.referenceRoastId) {
        await tx.parentRoastingBatch.update({
          where: { id: batch.id },
          data: { referenceRoastId: null },
        });
        await recordAudit(tx, {
          tenantId,
          userId: user.id,
          action: "UPDATE",
          entityType: "ParentRoastingBatch",
          entityId: batch.id,
          before: { referenceRoastId: batch.referenceRoastId },
          after: { referenceRoastId: null },
          metadata: { source: "WEB_PROFILE_REFERENCE" },
        });
        return { title: null };
      }

      const reference = await tx.roast.findFirst({
        where: { id: parsed.data.referenceRoastId, tenantId },
        select: {
          id: true,
          title: true,
          machineId: true,
          beanTemperatureSeries: true,
        },
      });
      if (!reference) throw new Error("Profil acuan tidak ditemukan.");
      if (!Array.isArray(reference.beanTemperatureSeries) || reference.beanTemperatureSeries.length < 2) {
        throw new Error("Profil acuan belum memiliki kurva Bean Temperature yang dapat dibandingkan.");
      }
      if (batch.machineId && batch.machineId !== reference.machineId) {
        throw new Error("Profil acuan berasal dari mesin yang berbeda dengan batch ini.");
      }

      await tx.parentRoastingBatch.update({
        where: { id: batch.id },
        data: {
          referenceRoastId: reference.id,
          machineId: batch.machineId ?? reference.machineId,
        },
      });
      await recordAudit(tx, {
        tenantId,
        userId: user.id,
        action: "UPDATE",
        entityType: "ParentRoastingBatch",
        entityId: batch.id,
        before: { referenceRoastId: batch.referenceRoastId, machineId: batch.machineId },
        after: { referenceRoastId: reference.id, machineId: batch.machineId ?? reference.machineId },
        metadata: { source: "WEB_PROFILE_REFERENCE" },
      });
      return { title: reference.title || "Profil tanpa nama" };
    });

    revalidatePath("/roasting");
    revalidatePath(`/roasting/batch/${parsed.data.batchId}`);
    return { success: true, data: result };
  } catch (error) {
    console.error("[setBatchReferenceProfile]", error);
    return { success: false, error: error instanceof Error ? error.message : "Profil acuan gagal disimpan." };
  }
}

export async function createParentRoastingBatch(
  input: CreateParentRoastingBatchInput
): Promise<RoastingActionResult> {
  try {
    await requireRole("OWNER", "MANAGER", "OPERATOR");
    const parsed = CreateParentRoastingBatchSchema.parse(input);
    const userId = await getSystemUserId();
    const tenantId = await getCurrentTenantId();
    const weightError = validateRoastingWeights(parsed);
    if (weightError) return { success: false, error: weightError };

    const tenantPrisma = await requireTenantPrisma();
    const previousAttempt = await tenantPrisma.parentRoastingBatch.findFirst({
      where: { operationKey: parsed.operationKey },
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
      parsed.outputRoastLevel as (typeof roastLevels)[number],
    )
      ? (parsed.outputRoastLevel as (typeof roastLevels)[number])
      : null;
    if (!requestedRoastLevel) {
      return { success: false, error: "Pilih level roasting: Light, Medium, Medium Dark, atau Dark." };
    }
    const batchCode = await generateBatchCode();
    const result = await tenantPrisma.$transaction(async (tx) => {
      const inputProduct = await tx.product.findUnique({
        where: { id: parsed.inputProductId },
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
      if (currentStock < parsed.targetWeightKg) {
        throw new Error(
          `Stok Green Bean tidak cukup. Tersedia: ${currentStock.toFixed(3)} kg, dibutuhkan: ${parsed.targetWeightKg.toFixed(3)} kg.`,
        );
      }

      let outputProduct: any;
      if (parsed.outputMode === "existing" && parsed.outputProductId) {
        outputProduct = await tx.product.findUnique({ where: { id: parsed.outputProductId } });
        if (!outputProduct) throw new Error("Roasted Bean tujuan tidak valid.");
      } else if (parsed.outputMode === "new") {
        if (!parsed.outputProductName) throw new Error("Nama produk baru harus diisi.");
        const newCode = generateRBCode(parsed.outputProductName);
        outputProduct = await tx.product.create({
          data: {
            tenantId,
            code: newCode,
            name: parsed.outputProductName,
            type: "ROASTED_BEAN",
            category: inputProduct.category,
            origin: parsed.outputProductOrigin || inputProduct.origin,
            roastLevel: requestedRoastLevel,
            sourceGreenBeanId: inputProduct.id,
            description: inputProduct.description,
            imageUrl: inputProduct.imageUrl,
          },
        });
      } else {
        const automaticName = roastedBeanName(
          inputProduct.name,
          requestedRoastLevel as RoastLevelValue,
        );
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
            tenantId,
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

      let outcome: RoastOutcome | undefined;
      if (parsed.mode === "MANUAL") {
        const comparableBatches = await tx.parentRoastingBatch.findMany({
          where: {
            inputProductId: parsed.inputProductId,
            outputProductId: outputProduct.id,
            status: "COMPLETED",
            totalShrinkagePercent: { not: null },
          },
          orderBy: { completedAt: "desc" },
          take: 10,
          select: { totalShrinkagePercent: true },
        });
        outcome = analyzeRoastOutcome(
          parsed.targetWeightKg,
          Number(parsed.actualOutputKg),
          comparableBatches.map((batch) => Number(batch.totalShrinkagePercent)),
        );
      }

      const batch = await tx.parentRoastingBatch.create({
        data: {
          tenantId,
          code: batchCode,
          operationKey: parsed.operationKey,
          inputProductId:   parsed.inputProductId,
          targetWeightKg:   parsed.targetWeightKg,
          outputProductId:  outputProduct.id,
          actualOutputKg:   parsed.mode === "MANUAL" ? Number(parsed.actualOutputKg) : null,
          totalShrinkagePercent: outcome?.lossPercent ?? null,
          status:           parsed.mode === "MANUAL" ? "COMPLETED" : "PENDING",
          notes:            parsed.notes?.trim() || null,
          completedAt:      parsed.mode === "MANUAL" ? getCurrentDate() : null,
          createdById:      userId,
          machineId:        parsed.machineId || null,
        },
      });

      // Auto-split: check if targetWeightKg exceeds machine capacity
      let splits = 0;
      if (parsed.machineId && parsed.mode === "ARTISAN") {
        const machine = await tx.machine.findUnique({
          where: { id: parsed.machineId },
          select: { capacityKg: true, name: true },
        });
        if (machine?.capacityKg && Number(machine.capacityKg) > 0) {
          const capacity = Number(machine.capacityKg);
          if (parsed.targetWeightKg > capacity) {
            // Calculate splits
            splits = Math.ceil(parsed.targetWeightKg / capacity);
            const weightPerSplit = parsed.targetWeightKg / splits;

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
                notes: `${parsed.notes?.trim() || ""}\n[Auto-split: ${splits} batch @ ${weightPerSplit.toFixed(2)} kg dari ${machine.name}]`.trim(),
              },
            });
          }
        }
      }

      // Always deduct GB immediately
      await appendFefoLedgerOut(tx, {
          tenantId,
          productId:   parsed.inputProductId,
          refType:     "ROASTING_GB_OUT",
          refId:       batch.id,
          quantityKg:  parsed.targetWeightKg,
          notes:       `Roasting: ${batch.code}`,
          createdById: userId,
      });

      // If MANUAL, also add RB immediately
      if (parsed.mode === "MANUAL") {
        const outputLot = await tx.lot.create({
          data: {
            tenantId,
            productId: outputProduct.id,
            batchCode: `${batch.code}-RB`,
            quantityKg: Number(parsed.actualOutputKg),
            receivedAt: batch.completedAt ?? getCurrentDate(),
            notes: `Hasil roasting ${batch.code}`,
          },
        });
        await appendLedger(tx, {
          data: {
            tenantId,
            productId:   outputProduct.id,
            entryType:   "IN",
            refType:     "ROASTING_RB_IN",
            refId:       batch.id,
            quantityKg:  Number(input.actualOutputKg),
            incomingPrice: (Number(inputProduct.avgCostPerKg ?? 0) * input.targetWeightKg) / Number(input.actualOutputKg),
            lotId:        outputLot.id,
            lotNumber:    outputLot.batchCode,
            notes:       `Roasting: ${batch.code}`,
            createdById: userId,
          },
        });

        await postRoastingBatch(
          batch.id,
          Number(inputProduct.avgCostPerKg ?? 0) * input.targetWeightKg,
          input.targetWeightKg,
          Number(input.actualOutputKg),
          inputProduct.name,
          outputProduct.name,
          { tx, tenantId, userId },
        );
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
        include: {
          inputProduct: { select: { avgCostPerKg: true, name: true } },
          outputProduct: { select: { name: true } },
        }
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

      const outputLot = await tx.lot.create({
        data: {
          tenantId,
          productId: batch.outputProductId,
          batchCode: `${batch.code}-RB`,
          quantityKg: actualOutputKg,
          receivedAt: getCurrentDate(),
          notes: `Hasil roasting ${batch.code}`,
        },
      });

      await appendLedger(tx, {
        data: {
          tenantId,
          productId:   batch.outputProductId,
          entryType:   "IN",
          refType:     "ROASTING_RB_IN",
          refId:       batch.id,
          quantityKg:  actualOutputKg,
          incomingPrice: (Number(batch.inputProduct.avgCostPerKg ?? 0) * Number(batch.targetWeightKg)) / actualOutputKg,
          lotId:        outputLot.id,
          lotNumber:    outputLot.batchCode,
          notes:       `Roasting: ${batch.code}`,
          createdById: userId,
        },
      });

      await postRoastingBatch(
        batch.id,
        Number(batch.inputProduct.avgCostPerKg ?? 0) * Number(batch.targetWeightKg),
        Number(batch.targetWeightKg),
        actualOutputKg,
        batch.inputProduct.name ?? "Green Bean",
        batch.outputProduct.name ?? "Roasted Bean",
        { tx, tenantId, userId },
      );

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
      if (batch.status === "COMPLETED") {
        await postVoidReversal("ROASTING", batch.id, reason, { tx, tenantId, userId });
      }

      const sourceEntries = await tx.inventoryLedger.findMany({
        where: {
          refId: batch.id,
          refType: { in: ["ROASTING_GB_OUT", "ROASTING_RB_IN"] },
        },
      });
      if (sourceEntries.length === 0) {
        throw new Error("Ledger roasting tidak ditemukan; void dibatalkan.");
      }
      const outputLotIds = sourceEntries
        .filter((entry) => entry.refType === "ROASTING_RB_IN" && entry.lotId)
        .map((entry) => entry.lotId!);
      if (outputLotIds.length > 0) {
        const downstreamCount = await tx.inventoryLedger.count({
          where: { lotId: { in: outputLotIds }, entryType: "OUT", refType: { not: "VOID_REVERSAL" } },
        });
        if (downstreamCount > 0) {
          throw new Error("Hasil roasting sudah dipakai di proses berikutnya. Batalkan proses turunannya terlebih dahulu.");
        }
      }

      for (const entry of sourceEntries) {
        await appendLedger(tx, {
          data: {
            tenantId,
            productId: entry.productId,
            packagingId: entry.packagingId,
            entryType: entry.entryType === "IN" ? "OUT" : "IN",
            refType: "VOID_REVERSAL",
            refId: batch.id,
            quantityKg: entry.quantityKg,
            quantityUnit: entry.quantityUnit,
            lotId: entry.lotId,
            lotNumber: entry.lotNumber,
            expiryDate: entry.expiryDate,
            notes: `Reversal Roasting: ${batch.code}`,
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
