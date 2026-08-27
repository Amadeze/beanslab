"use server";

import { requireFeature, getCurrentTenantId, getTenantTimezone } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { LineageChip } from "@/lib/lineage";

/**
 * Papan Peta Jejak — snapshot rantai aktif untuk papan alur 4 kolom.
 * Cakupan sengaja dibatasi (aturan #8): lot hidup, batch/QC/output terbaru.
 */

export type JejakLot = {
  id: string;
  code: string;
  kg: number;
  supplier: string | null;
};

export type JejakBatch = {
  id: string;
  code: string;
  inputName: string | null;
  outputName: string | null;
  status: string;
  lotIds: string[];
};

export type JejakCupping = {
  id: string;
  batchId: string | null;
  label: string;
  score: number | null;
};

export type JejakOutput = {
  id: string;
  kind: "PRODUKSI" | "GRINDING";
  code: string;
  batchId: string | null;
};

export type JejakBoard = {
  lots: JejakLot[];
  batches: JejakBatch[];
  cuppings: JejakCupping[];
  outputs: JejakOutput[];
};

function scoreLabel(avg: number | null, code: string): string {
  return avg !== null ? `${avg.toFixed(2).replace(".", ",")}` : code;
}

export async function getJejakBoard(): Promise<JejakBoard> {
  await requireFeature("ADVANCED_REPORTS");
  const tenantId = await getCurrentTenantId();

  const [lots, batches, cuppings, productions, grindings] = await Promise.all([
    prisma.lot.findMany({
      where: { tenantId, consumedAt: null },
      select: {
        id: true,
        batchCode: true,
        quantityKg: true,
        purchase: { select: { supplier: { select: { name: true } } } },
      },
      orderBy: { createdAt: "desc" },
      take: 60,
    }),
    prisma.parentRoastingBatch.findMany({
      where: { tenantId },
      select: {
        id: true,
        code: true,
        status: true,
        inputProduct: { select: { name: true } },
        outputProduct: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 40,
    }),
    prisma.cuppingSession.findMany({
      where: { tenantId, batchId: { not: null } },
      select: {
        id: true,
        code: true,
        batchId: true,
        scores: { select: { score: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 30,
    }),
    prisma.productionBatch.findMany({
      where: { tenantId, parentRoastBatchId: { not: null } },
      select: { id: true, code: true, parentRoastBatchId: true },
      orderBy: { createdAt: "desc" },
      take: 30,
    }),
    prisma.grindingBatch.findMany({
      where: { tenantId, parentRoastBatchId: { not: null } },
      select: { id: true, code: true, parentRoastBatchId: true },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
  ]);

  // Hubungkan batch → lot dalam SATU query ledger (hindari N+1).
  const batchIds = batches.map((b) => b.id);
  const ledgerRows =
    batchIds.length > 0
      ? await prisma.inventoryLedger.findMany({
          where: {
            tenantId,
            refType: "ROASTING_GB_OUT",
            entryType: "OUT",
            refId: { in: batchIds },
            lotId: { not: null },
          },
          select: { refId: true, lotId: true },
        })
      : [];

  const lotsByBatch = new Map<string, Set<string>>();
  const batchByLot = new Map<string, Set<string>>();
  for (const row of ledgerRows) {
    if (!row.lotId || !row.refId) continue;
    if (!lotsByBatch.has(row.refId)) lotsByBatch.set(row.refId, new Set());
    lotsByBatch.get(row.refId)!.add(row.lotId);
    if (!batchByLot.has(row.lotId)) batchByLot.set(row.lotId, new Set());
    batchByLot.get(row.lotId)!.add(row.refId);
  }

  const cuppingRows = cuppings.map((c) => {
    const values = c.scores.map((s) => Number(s.score)).filter((v) => Number.isFinite(v));
    const avg = values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : null;
    const chipLike: LineageChip = { label: scoreLabel(avg, c.code), href: "/cupping" };
    void chipLike;
    return {
      id: c.id,
      batchId: c.batchId,
      label: scoreLabel(avg, c.code),
      score: avg,
    };
  });

  return {
    lots: lots.map((l) => ({
      id: l.id,
      code: l.batchCode,
      kg: Number(l.quantityKg ?? 0),
      supplier: l.purchase?.supplier?.name ?? null,
    })),
    batches: batches.map((b) => ({
      id: b.id,
      code: b.code,
      inputName: b.inputProduct?.name ?? null,
      outputName: b.outputProduct?.name ?? null,
      status: b.status,
      lotIds: [...(lotsByBatch.get(b.id) ?? [])],
    })),
    cuppings: cuppingRows,
    outputs: [
      ...productions.map((p) => ({ id: p.id, kind: "PRODUKSI" as const, code: p.code, batchId: p.parentRoastBatchId })),
      ...grindings.map((g) => ({ id: g.id, kind: "GRINDING" as const, code: g.code, batchId: g.parentRoastBatchId })),
    ],
  };
}
