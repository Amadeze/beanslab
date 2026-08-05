import crypto from "node:crypto";
import { Prisma, type RoastLevel } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { appendFefoLedgerOut } from "@/lib/stock";
import { recordAudit } from "@/lib/audit";
import { getCurrentDate } from "@/lib/date-utils";
import { roastedBeanName } from "@/lib/roast-product";

const ROAST_LEVELS = new Set<RoastLevel>(["LIGHT", "MEDIUM", "MEDIUM_DARK", "DARK"]);

function batchCode() {
  const now = getCurrentDate();
  return `RST-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
}

function roastedBeanCode(name: string) {
  const slug = name
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 12);
  return `RB-${slug || "BARU"}-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
}

export type CreateStudioRoastingBatchInput = {
  tenantId: string;
  userId: string;
  machineId: string;
  operationKey: string;
  inputProductId: string;
  targetWeightKg: number;
  roastLevel: RoastLevel;
};

export type CreatedStudioRoastingBatch = {
  id: string;
  code: string;
  childCount: number;
  targetChargeWeightGrams: number;
  referenceProfileId: string | null;
};

export async function createStudioRoastingBatch(
  input: CreateStudioRoastingBatchInput,
): Promise<CreatedStudioRoastingBatch> {
  if (!ROAST_LEVELS.has(input.roastLevel)) throw new Error("Level roasting tidak valid.");
  if (!Number.isFinite(input.targetWeightKg) || input.targetWeightKg <= 0) {
    throw new Error("Target roasting harus lebih dari 0 kg.");
  }

  try {
    return await prisma.$transaction(async (tx) => {
      const previous = await tx.parentRoastingBatch.findFirst({
        where: { tenantId: input.tenantId, operationKey: input.operationKey },
        select: {
          id: true,
          code: true,
          targetWeightKg: true,
          referenceRoastId: true,
          childBatches: { select: { id: true } },
        },
      });
      if (previous) {
        const childCount = Math.max(1, previous.childBatches.length);
        return {
          id: previous.id,
          code: previous.code,
          childCount,
          targetChargeWeightGrams: Math.round((Number(previous.targetWeightKg) / childCount) * 1000),
          referenceProfileId: previous.referenceRoastId,
        };
      }

      const [machine, greenBean] = await Promise.all([
        tx.machine.findFirst({
          where: { id: input.machineId, tenantId: input.tenantId, isActive: true },
          select: { id: true, name: true, capacityKg: true },
        }),
        tx.product.findFirst({
          where: {
            id: input.inputProductId,
            tenantId: input.tenantId,
            type: "GREEN_BEAN",
            isActive: true,
          },
          select: {
            id: true,
            name: true,
            category: true,
            origin: true,
            description: true,
            imageUrl: true,
            stockKg: true,
          },
        }),
      ]);
      if (!machine) throw new Error("Mesin Studio tidak aktif atau tidak ditemukan.");
      if (!greenBean) throw new Error("Green bean tidak aktif atau tidak ditemukan.");
      if (Number(greenBean.stockKg) < input.targetWeightKg) {
        throw new Error(`Stok ${greenBean.name} hanya ${Number(greenBean.stockKg).toFixed(2)} kg.`);
      }

      // Studio cannot choose a reference. It only inherits the most recent
      // web-managed reference for this bean, machine, and roast level.
      const historical = await tx.parentRoastingBatch.findFirst({
        where: {
          tenantId: input.tenantId,
          machineId: input.machineId,
          inputProductId: input.inputProductId,
          outputProduct: { roastLevel: input.roastLevel },
          referenceRoastId: { not: null },
        },
        orderBy: { createdAt: "desc" },
        select: { referenceRoastId: true },
      });
      const referenceRoastId = historical?.referenceRoastId ?? null;

      const outputName = roastedBeanName(greenBean.name, input.roastLevel);
      const outputProduct = await tx.product.upsert({
        where: {
          tenantId_sourceGreenBeanId_roastLevel: {
            tenantId: input.tenantId,
            sourceGreenBeanId: greenBean.id,
            roastLevel: input.roastLevel,
          },
        },
        update: { isActive: true },
        create: {
          tenantId: input.tenantId,
          code: roastedBeanCode(outputName),
          name: outputName,
          type: "ROASTED_BEAN",
          category: greenBean.category,
          origin: greenBean.origin,
          roastLevel: input.roastLevel,
          sourceGreenBeanId: greenBean.id,
          description: greenBean.description,
          imageUrl: greenBean.imageUrl,
        },
        select: { id: true },
      });

      const capacityKg = Number(machine.capacityKg ?? 0);
      const childCount = capacityKg > 0
        ? Math.max(1, Math.ceil(input.targetWeightKg / capacityKg))
        : 1;
      const chargeWeightKg = input.targetWeightKg / childCount;
      const code = batchCode();
      const batch = await tx.parentRoastingBatch.create({
        data: {
          tenantId: input.tenantId,
          code,
          operationKey: input.operationKey,
          inputProductId: greenBean.id,
          targetWeightKg: input.targetWeightKg,
          outputProductId: outputProduct.id,
          status: "PENDING",
          notes: `[Studio: ${childCount} batch @ ${chargeWeightKg.toFixed(2)} kg dari ${machine.name}]`,
          createdById: input.userId,
          machineId: machine.id,
          referenceRoastId,
          childBatches: {
            create: Array.from({ length: childCount }, () => ({
              tenantId: input.tenantId,
              recordedAt: getCurrentDate(),
            })),
          },
        },
        select: { id: true, code: true },
      });

      await appendFefoLedgerOut(tx, {
        tenantId: input.tenantId,
        productId: greenBean.id,
        refType: "ROASTING_GB_OUT",
        refId: batch.id,
        quantityKg: input.targetWeightKg,
        notes: `Roasting: ${batch.code}`,
        createdById: input.userId,
      });

      await recordAudit(tx, {
        tenantId: input.tenantId,
        userId: input.userId,
        action: "CREATE",
        entityType: "ParentRoastingBatch",
        entityId: batch.id,
        after: {
          code: batch.code,
          source: "ROASTD_STUDIO",
          status: "PENDING",
          targetWeightKg: input.targetWeightKg,
          roastLevel: input.roastLevel,
          childCount,
          referenceRoastId,
        },
        metadata: { connectorMachineId: machine.id, operationKey: input.operationKey },
      });

      return {
        id: batch.id,
        code: batch.code,
        childCount,
        targetChargeWeightGrams: Math.round(chargeWeightKg * 1000),
        referenceProfileId: referenceRoastId,
      };
    }, { isolationLevel: "Serializable" });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const previous = await prisma.parentRoastingBatch.findFirst({
        where: { tenantId: input.tenantId, operationKey: input.operationKey },
        select: {
          id: true,
          code: true,
          targetWeightKg: true,
          referenceRoastId: true,
          childBatches: { select: { id: true } },
        },
      });
      if (previous) {
        const childCount = Math.max(1, previous.childBatches.length);
        return {
          id: previous.id,
          code: previous.code,
          childCount,
          targetChargeWeightGrams: Math.round((Number(previous.targetWeightKg) / childCount) * 1000),
          referenceProfileId: previous.referenceRoastId,
        };
      }
    }
    throw error;
  }
}
