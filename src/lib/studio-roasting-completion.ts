import type { Prisma } from "@prisma/client";

import { recordAudit } from "@/lib/audit";
import { getCurrentDate } from "@/lib/date-utils";
import { postRoastingBatch } from "@/lib/posting";
import { prisma } from "@/lib/prisma";
import { analyzeRoastOutcome, type RoastOutcome } from "@/lib/roast-intent";
import { appendLedger } from "@/lib/stock";

export type StudioBatchCompletion =
  | { status: "WAITING_FOR_CHILDREN"; remainingChildren: number }
  | { status: "WAITING_FOR_OUTPUT_WEIGHT"; missingChildren: number }
  | { status: "REVIEW_REQUIRED"; message: string }
  | { status: "ALREADY_COMPLETED"; batchCode: string; actualOutputKg: number }
  | { status: "COMPLETED"; batchCode: string; actualOutputKg: number; outcome: RoastOutcome };

type ChildOutput = {
  roastId: string | null;
  roast: { roastedWeightGrams: number | null } | null;
};

export function summarizeStudioBatchOutput(children: ChildOutput[]) {
  const remainingChildren = children.filter((child) => !child.roastId).length;
  if (remainingChildren > 0) {
    return { status: "WAITING_FOR_CHILDREN" as const, remainingChildren };
  }

  const missingChildren = children.filter(
    (child) => !child.roast || !Number.isFinite(child.roast.roastedWeightGrams) || Number(child.roast.roastedWeightGrams) <= 0,
  ).length;
  if (children.length === 0 || missingChildren > 0) {
    return { status: "WAITING_FOR_OUTPUT_WEIGHT" as const, missingChildren: Math.max(1, missingChildren) };
  }

  const totalGrams = children.reduce(
    (total, child) => total + Number(child.roast?.roastedWeightGrams ?? 0),
    0,
  );
  return {
    status: "READY" as const,
    actualOutputKg: Math.round(totalGrams) / 1000,
  };
}

async function completeOnce(
  tenantId: string,
  batchId: string,
): Promise<StudioBatchCompletion> {
  return prisma.$transaction(async (tx) => {
    const batch = await tx.parentRoastingBatch.findFirst({
      where: { id: batchId, tenantId },
      select: {
        id: true,
        code: true,
        status: true,
        createdById: true,
        inputProductId: true,
        outputProductId: true,
        targetWeightKg: true,
        actualOutputKg: true,
        inputProduct: { select: { avgCostPerKg: true, name: true } },
        outputProduct: { select: { name: true } },
        childBatches: {
          select: {
            roastId: true,
            roast: { select: { roastedWeightGrams: true } },
          },
        },
      },
    });
    if (!batch) throw new Error("Batch roasting Studio tidak ditemukan.");

    if (batch.status === "COMPLETED" && batch.actualOutputKg != null) {
      return {
        status: "ALREADY_COMPLETED",
        batchCode: batch.code,
        actualOutputKg: Number(batch.actualOutputKg),
      };
    }
    if (batch.status !== "PENDING") {
      return { status: "REVIEW_REQUIRED", message: "Batch bukan lagi berstatus proses." };
    }

    const summary = summarizeStudioBatchOutput(batch.childBatches);
    if (summary.status !== "READY") return summary;

    const inputKg = Number(batch.targetWeightKg);
    if (summary.actualOutputKg >= inputKg) {
      return {
        status: "REVIEW_REQUIRED",
        message: "Total berat hasil harus lebih kecil dari Green Bean yang dipakai.",
      };
    }

    const recentComparable = await tx.parentRoastingBatch.findMany({
      where: {
        tenantId,
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
      inputKg,
      summary.actualOutputKg,
      recentComparable.map((item) => Number(item.totalShrinkagePercent)),
    );

    const claimed = await tx.parentRoastingBatch.updateMany({
      where: { id: batch.id, tenantId, status: "PENDING" },
      data: {
        actualOutputKg: summary.actualOutputKg,
        totalShrinkagePercent: outcome.lossPercent,
        status: "COMPLETED",
        completedAt: getCurrentDate(),
      },
    });
    if (claimed.count !== 1) {
      const completed = await tx.parentRoastingBatch.findFirst({
        where: { id: batch.id, tenantId, status: "COMPLETED" },
        select: { code: true, actualOutputKg: true },
      });
      if (completed?.actualOutputKg != null) {
        return {
          status: "ALREADY_COMPLETED",
          batchCode: completed.code,
          actualOutputKg: Number(completed.actualOutputKg),
        };
      }
      throw new Error("Batch berubah saat diselesaikan. Sinkronkan ulang.");
    }

    const outputLot = await tx.lot.create({
      data: {
        tenantId,
        productId: batch.outputProductId,
        batchCode: `${batch.code}-RB`,
        quantityKg: summary.actualOutputKg,
        receivedAt: getCurrentDate(),
        notes: `Hasil Roastd Studio ${batch.code}`,
      },
    });
    const inputCost = Number(batch.inputProduct.avgCostPerKg ?? 0) * inputKg;

    await appendLedger(tx, {
      data: {
        tenantId,
        productId: batch.outputProductId,
        entryType: "IN",
        refType: "ROASTING_RB_IN",
        refId: batch.id,
        quantityKg: summary.actualOutputKg,
        incomingPrice: inputCost / summary.actualOutputKg,
        lotId: outputLot.id,
        lotNumber: outputLot.batchCode,
        notes: `Roastd Studio: ${batch.code}`,
        createdById: batch.createdById,
      },
    });

    await postRoastingBatch(
      batch.id,
      inputCost,
      inputKg,
      summary.actualOutputKg,
      batch.inputProduct.name,
      batch.outputProduct.name,
      { tx, tenantId, userId: batch.createdById },
    );

    await recordAudit(tx, {
      tenantId,
      userId: batch.createdById,
      action: "COMPLETE",
      entityType: "ParentRoastingBatch",
      entityId: batch.id,
      before: { status: batch.status },
      after: {
        status: "COMPLETED",
        actualOutputKg: summary.actualOutputKg,
        totalShrinkagePercent: outcome.lossPercent,
        outcomeStatus: outcome.status,
      },
      metadata: { source: "ROASTD_STUDIO", childCount: batch.childBatches.length },
    });

    return {
      status: "COMPLETED",
      batchCode: batch.code,
      actualOutputKg: summary.actualOutputKg,
      outcome,
    };
  }, { isolationLevel: "Serializable" as Prisma.TransactionIsolationLevel });
}

export async function completeStudioRoastingBatchIfReady(input: {
  tenantId: string;
  batchId: string;
}): Promise<StudioBatchCompletion> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await completeOnce(input.tenantId, input.batchId);
    } catch (error) {
      const code = typeof error === "object" && error && "code" in error
        ? String((error as { code?: unknown }).code ?? "")
        : "";
      if (code !== "P2034" || attempt === 2) throw error;
    }
  }
  throw new Error("Batch gagal diselesaikan setelah percobaan ulang.");
}
