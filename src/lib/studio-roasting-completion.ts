import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import type { RoastOutcome } from "@/lib/roast-intent";
import { completeRoastInTx } from "@/lib/roast-lifecycle";

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

    const completed = await completeRoastInTx(tx, {
      tenantId,
      userId: batch.createdById,
      batchId: batch.id,
      actualOutputKg: summary.actualOutputKg,
      source: "ROASTD_STUDIO",
    });
    return completed.alreadyCompleted
      ? {
          status: "ALREADY_COMPLETED",
          batchCode: completed.batchCode,
          actualOutputKg: completed.actualOutputKg,
        }
      : {
          status: "COMPLETED",
          batchCode: completed.batchCode,
          actualOutputKg: completed.actualOutputKg,
          outcome: completed.outcome,
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
