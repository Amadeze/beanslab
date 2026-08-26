/**
 * RANTAI JEJAK — jahitan traceability Lot → Batch → Cupping → Produksi.
 *
 * Semua fungsi READ-ONLY dan mengembalikan "chip" siap-render:
 *   { label, sub?, href, muted? }
 * muted = entri sudah habis/berakhir (aturan #8: terlacak tapi tak berisik).
 *
 * Sambungan data (sudah ada di skema):
 *   Lot ──(ledger ROASTING_GB_OUT: lotId + refId=batch.id)──▶ ParentRoastingBatch
 *   ParentRoastingBatch ◀── CuppingSession.batchId / .lotId
 *   ParentRoastingBatch ◀── ProductionBatch.parentRoastBatchId
 *   ParentRoastingBatch ◀── GrindingBatch.parentRoastBatchId
 */

import { prisma } from "@/lib/prisma";

export type LineageChip = {
  label: string;
  sub?: string;
  href: string;
  muted?: boolean;
};

export type LineageChain = {
  hulu: LineageChip[];
  sesi: LineageChip[];
  hilir: LineageChip[];
};

const EMPTY_CHAIN: LineageChain = { hulu: [], sesi: [], hilir: [] };

function fmtKg(kg: number): string {
  return `${kg.toLocaleString("id-ID", { maximumFractionDigits: 1 })} kg`;
}

/** Rantai untuk satu BATCH roasting. Null bila batch tidak ditemukan. */
export async function getBatchLineage(
  tenantId: string,
  batchId: string,
): Promise<LineageChain | null> {
  const batch = await prisma.parentRoastingBatch.findFirst({
    where: { id: batchId, tenantId },
    select: { id: true },
  });
  if (!batch) return null;

  // HULU: lot yang dikonsumsi batch ini (ledger OUT membawa lotId).
  const consumed = await prisma.inventoryLedger.findMany({
    where: { tenantId, refType: "ROASTING_GB_OUT", refId: batchId, entryType: "OUT" },
    select: {
      quantityKg: true,
      lotId: true,
      lot: { select: { batchCode: true, expiryDate: true, consumedAt: true } },
    },
  });

  const perLot = new Map<string, { kg: number; code: string; expiryDate: Date | null; consumedAt: Date | null }>();
  for (const row of consumed) {
    if (!row.lotId || !row.lot) continue;
    const qty = Number(row.quantityKg ?? 0);
    const prev = perLot.get(row.lotId);
    if (prev) prev.kg += qty;
    else
      perLot.set(row.lotId, {
        kg: qty,
        code: row.lot.batchCode,
        expiryDate: row.lot.expiryDate,
        consumedAt: row.lot.consumedAt,
      });
  }

  const hulu: LineageChip[] = [...perLot.entries()].map(([lotId, info]) => ({
    label: `Lot ${info.code}`,
    sub:
      info.consumedAt
        ? `${fmtKg(info.kg)} · habis`
        : `${fmtKg(info.kg)}`,
    href: `/inventory/lots/${lotId}`,
    muted: Boolean(info.consumedAt),
  }));

  // SESAI: sesi cupping untuk batch ini (rata-rata skor dari lembar score).
  const cuppings = await prisma.cuppingSession.findMany({
    where: { tenantId, batchId },
    select: {
      id: true,
      code: true,
      createdAt: true,
      scores: { select: { score: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 6,
  });

  const sesi: LineageChip[] = cuppings.map((c) => {
    const values = c.scores.map((s) => Number(s.score)).filter((v) => Number.isFinite(v));
    const avg = values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : null;
    return {
      label: avg !== null ? `Cupping ${avg.toFixed(2).replace(".", ",")}` : `Cupping ${c.code}`,
      sub: `QC ${new Date(c.createdAt).toLocaleDateString("id-ID")}`,
      href: "/cupping",
      muted: false,
    };
  });

  // HILIR: produksi & grinding bersumber dari batch ini.
  const [productions, grindings] = await Promise.all([
    prisma.productionBatch.findMany({
      where: { tenantId, parentRoastBatchId: batchId },
      select: { id: true, code: true, status: true },
      orderBy: { createdAt: "desc" },
      take: 6,
    }),
    prisma.grindingBatch.findMany({
      where: { tenantId, parentRoastBatchId: batchId },
      select: { id: true, code: true },
      orderBy: { createdAt: "desc" },
      take: 4,
    }),
  ]);

  const hilir: LineageChip[] = [
    ...productions.map((p) => ({
      label: `Produksi ${p.code}`,
      sub: p.status === "COMPLETED" ? "selesai" : p.status.toLocaleLowerCase("id-ID"),
      href: `/produksi/batch/${p.id}`,
      muted: false,
    })),
    ...grindings.map((g) => ({
      label: `Grinding ${g.code}`,
      href: "/grinding",
      muted: false,
    })),
  ];

  return { hulu, sesi, hilir };
}

/** Rantai untuk satu LOT green bean. */
export async function getLotLineage(
  tenantId: string,
  lotId: string,
): Promise<LineageChain | null> {
  const lot = await prisma.lot.findFirst({
    where: { id: lotId, tenantId },
    select: {
      id: true,
      batchCode: true,
      consumedAt: true,
      purchase: { select: { code: true, supplier: { select: { name: true } } } },
    },
  });
  if (!lot) return null;

  const hulu: LineageChip[] =
    lot.purchase && lot.purchase.supplier
      ? [
          {
            label: lot.purchase.supplier.name,
            sub: `Pembelian ${lot.purchase.code}`,
            href: "/inventory",
            muted: false,
          },
        ]
      : [];

  // HILIR: batch yang mengonsumsi lot ini (kumpulkan refId unik → query batch).
  const roastedRows = await prisma.inventoryLedger.findMany({
    where: { tenantId, refType: "ROASTING_GB_OUT", entryType: "OUT", lotId },
    select: { quantityKg: true, refId: true },
    take: 24,
  });

  const batchIds = [...new Set(roastedRows.map((r) => r.refId).filter((v): v is string => Boolean(v)))];
  const batches =
    batchIds.length > 0
      ? await prisma.parentRoastingBatch.findMany({
          where: { tenantId, id: { in: batchIds } },
          select: { id: true, code: true },
        })
      : [];
  const codeById = new Map(batches.map((b) => [b.id, b.code]));

  const kgByBatch = new Map<string, number>();
  for (const r of roastedRows) {
    if (!r.refId || !codeById.has(r.refId)) continue;
    kgByBatch.set(r.refId, (kgByBatch.get(r.refId) ?? 0) + Number(r.quantityKg ?? 0));
  }

  const hilir: LineageChip[] = batchIds
    .filter((id) => codeById.has(id))
    .map((id) => ({
      label: `Batch ${codeById.get(id)}`,
      sub: fmtKg(kgByBatch.get(id) ?? 0),
      href: `/roasting/batch/${id}`,
      muted: Boolean(lot.consumedAt),
    }));

  const cuppings = await prisma.cuppingSession.findMany({
    where: { tenantId, lotId },
    select: { id: true, code: true },
    take: 6,
  });
  const sesi: LineageChip[] = cuppings.map((c) => ({
    label: `Cupping ${c.code}`,
    href: "/cupping",
    muted: false,
  }));

  return { hulu, sesi, hilir };
}

/** Rantai untuk satu sesi CUPPING: batch dan/atau lot yang dinilai. */
export async function getCuppingLineage(
  tenantId: string,
  sessionId: string,
): Promise<LineageChain | null> {
  const session = await prisma.cuppingSession.findFirst({
    where: { id: sessionId, tenantId },
    select: {
      id: true,
      batchId: true,
      lotId: true,
      batch: { select: { id: true, code: true } },
      lot: { select: { id: true, batchCode: true, consumedAt: true } },
    },
  });
  if (!session) return null;

  const hulu: LineageChip[] = [];
  if (session.batch)
    hulu.push({
      label: `Batch ${session.batch.code}`,
      href: `/roasting/batch/${session.batch.id}`,
      muted: false,
    });
  if (session.lot)
    hulu.push({
      label: `Lot ${session.lot.batchCode}`,
      href: `/inventory/lots/${session.lot.id}`,
      muted: Boolean(session.lot.consumedAt),
    });

  return { ...EMPTY_CHAIN, hulu };
}

/** Rantai untuk satu PRODUKSI: hulu roast batch-nya (+cupping ikut rantai itu). */
export async function getProductionLineage(
  tenantId: string,
  productionBatchId: string,
): Promise<LineageChain | null> {
  const pb = await prisma.productionBatch.findFirst({
    where: { id: productionBatchId, tenantId },
    select: {
      id: true,
      parentRoastBatchId: true,
      parentRoastBatch: { select: { id: true, code: true } },
      outputProduct: { select: { name: true } },
    },
  });
  if (!pb) return null;

  const hulu: LineageChip[] = pb.parentRoastBatch
    ? [
        {
          label: `Batch ${pb.parentRoastBatch.code}`,
          sub: "sumber roasted bean",
          href: `/roasting/batch/${pb.parentRoastBatch.id}`,
          muted: false,
        },
      ]
    : [];

  let sesi: LineageChip[] = [];
  if (pb.parentRoastBatchId) {
    const cuppings = await prisma.cuppingSession.findMany({
      where: { tenantId, batchId: pb.parentRoastBatchId },
      select: { id: true, code: true, scores: { select: { score: true } } },
      orderBy: { createdAt: "desc" },
      take: 3,
    });
    sesi = cuppings.map((c) => {
      const values = c.scores.map((s) => Number(s.score)).filter((v) => Number.isFinite(v));
      const avg = values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : null;
      return {
        label: avg !== null ? `Cupping ${avg.toFixed(2).replace(".", ",")}` : `Cupping ${c.code}`,
        href: "/cupping",
        muted: false,
      };
    });
  }

  return { hulu, sesi, hilir: [] };
}
