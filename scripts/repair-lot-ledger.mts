import { PrismaClient, type LedgerRefType } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL or DIRECT_URL is required.");
}

const apply = process.argv.includes("--apply");
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

type PhantomRow = {
  id: string;
  tenantId: string;
  refId: string;
  refType: string;
  entryType: string;
  productId: string | null;
  quantityKg: number | null;
  createdAt: Date;
};

type FlaggedEntry = {
  id: string;
  tenantId: string;
  productId: string;
  packagingId: string | null;
  refType: string;
  entryType: string;
  refId: string;
  quantityKg: number | null;
  quantityUnit: number | null;
  notes: string | null;
  createdById: string;
  createdAt: Date;
};

type LotRow = {
  id: string;
  tenantId: string;
  productId: string | null;
  packagingId: string | null;
  batchCode: string;
  quantityKg: number;
  quantityUnit: number;
  expiryDate: Date | null;
  receivedAt: Date;
  consumedAt: Date | null;
  consumedKg: number;
  consumedUnit: number;
};

const CONSUMPTION_REFTYPES = [
  "ROASTING_GB_OUT",
  "PRODUCTION_RB_OUT",
  "SALE_FG_OUT",
  "SAMPLE_RB_OUT",
  "SAMPLE_FG_OUT",
];

try {
  const phantomRows = await prisma.$queryRaw<PhantomRow[]>`
    SELECT il.id, il."tenantId", il."refId", il."refType"::text AS "refType",
           il."entryType"::text AS "entryType", il."productId",
           il."quantityKg"::float AS "quantityKg", il."createdAt"
    FROM inventory_ledger il
    WHERE il."lotId" IS NULL
      AND EXISTS (
        SELECT 1 FROM inventory_ledger twin
        WHERE twin."refId" = il."refId"
          AND twin."refType" = il."refType"
          AND twin."entryType" = il."entryType"
          AND twin."productId" = il."productId"
          AND twin."lotId" IS NOT NULL
          AND twin."id" <> il."id"
      )
  `;

  const purchases = await prisma.purchase.findMany({
    where: {
      status: "COMPLETED",
      lots: { none: {} },
    },
    select: {
      id: true,
      tenantId: true,
      code: true,
      type: true,
      supplierId: true,
      productId: true,
      packagingId: true,
      weightKg: true,
      quantityUnits: true,
      receivedAt: true,
    },
    orderBy: { receivedAt: "asc" },
  });

  const flaggedEntries = await prisma.$queryRaw<FlaggedEntry[]>`
    SELECT il.id, il."tenantId", il."productId", il."packagingId",
           il."refType"::text AS "refType", il."entryType"::text AS "entryType",
           il."refId", il."quantityKg"::float AS "quantityKg",
           il."quantityUnit"::int AS "quantityUnit", il."notes",
           il."createdById", il."createdAt"
    FROM inventory_ledger il
    WHERE il."productId" IS NOT NULL
      AND il."lotId" IS NULL
      AND il."refType" IN ('ROASTING_GB_OUT', 'PRODUCTION_RB_OUT', 'SALE_FG_OUT', 'SAMPLE_RB_OUT', 'SAMPLE_FG_OUT')
      AND EXISTS (
        SELECT 1 FROM lots lo
        WHERE lo."tenantId" = il."tenantId"
          AND lo."productId" = il."productId"
          AND lo."receivedAt" <= il."createdAt"
          AND lo."consumedAt" IS NULL
      )
    ORDER BY il."createdAt" ASC
  `;

  const flaggedProductIds = Array.from(new Set(flaggedEntries.map((e) => e.productId)));
  const lotRows = await prisma.$queryRaw<LotRow[]>`
    SELECT l.id, l."tenantId", l."productId", l."packagingId", l."batchCode",
           l."quantityKg"::float AS "quantityKg", l."quantityUnit"::float AS "quantityUnit",
           l."expiryDate", l."receivedAt", l."consumedAt",
      COALESCE((
        SELECT SUM(CASE
          WHEN il."entryType" = 'OUT' THEN COALESCE(il."quantityKg", 0)
          WHEN il."refType" = 'VOID_REVERSAL' THEN -COALESCE(il."quantityKg", 0)
          ELSE 0 END)
        FROM inventory_ledger il
        WHERE il."lotId" = l.id
      ), 0)::float AS "consumedKg",
      COALESCE((
        SELECT SUM(CASE
          WHEN il."entryType" = 'OUT' THEN COALESCE(il."quantityUnit", 0)
          WHEN il."refType" = 'VOID_REVERSAL' THEN -COALESCE(il."quantityUnit", 0)
          ELSE 0 END)
        FROM inventory_ledger il
        WHERE il."lotId" = l.id
      ), 0)::float AS "consumedUnit"
    FROM lots l
    WHERE l."productId" = ANY(${flaggedProductIds})
    ORDER BY l."receivedAt" ASC, l."createdAt" ASC
  `;

  const lotsByProduct = new Map<string, LotRow[]>();
  for (const lot of lotRows) {
    const key = lot.productId ?? "none";
    if (!lotsByProduct.has(key)) lotsByProduct.set(key, []);
    lotsByProduct.get(key)!.push(lot);
  }

  type Allocation = { entry: FlaggedEntry; lot: LotRow; takeKg: number; takeUnit: number; fullConsume: boolean };
  const allocations: Allocation[] = [];
  const skipped: { id: string; reason: string }[] = [];

  for (const entry of flaggedEntries) {
    const lots = lotsByProduct.get(entry.productId ?? "") ?? [];
    let remainingKg = entry.quantityKg ?? 0;
    let remainingUnit = entry.quantityUnit ?? 0;
    for (const lot of lots) {
      if (remainingKg <= 0 && remainingUnit <= 0) break;
      const lotRemainKg = lot.quantityKg - lot.consumedKg;
      const lotRemainUnit = lot.quantityUnit - lot.consumedUnit;
      const takeKg = Math.min(remainingKg, Math.max(0, lotRemainKg));
      const takeUnit = Math.min(remainingUnit, Math.max(0, lotRemainUnit));
      if (takeKg <= 0 && takeUnit <= 0) continue;
      lot.consumedKg += takeKg;
      lot.consumedUnit += takeUnit;
      remainingKg -= takeKg;
      remainingUnit -= takeUnit;
      allocations.push({
        entry,
        lot,
        takeKg,
        takeUnit,
        fullConsume: Math.abs(lot.consumedKg - lot.quantityKg) < 0.001 && Math.abs(lot.consumedUnit - lot.quantityUnit) < 0.001,
      });
    }
    if (remainingKg > 0.001 || remainingUnit > 0.001) {
      skipped.push({ id: entry.id, reason: `konsumsi melebihi lot tersedia (sisa ${remainingKg}kg / ${remainingUnit}u)` });
    }
  }

  console.log(JSON.stringify({
    mode: apply ? "apply" : "dry-run",
    phantomEntries: phantomRows.map(({ id, refId, refType, entryType, quantityKg, createdAt }) => ({
      id, refId, refType, entryType, quantityKg, createdAt,
    })),
    purchasesWithoutLot: purchases.map((p) => ({ id: p.id, code: p.code, type: p.type })),
    fefoAllocations: allocations.map(({ entry, lot, takeKg, takeUnit, fullConsume }) => ({
      entryId: entry.id,
      refType: entry.refType,
      createdAt: entry.createdAt.toISOString(),
      lot: lot.batchCode,
      takeKg,
      takeUnit,
      fullConsume,
    })),
    skipped,
  }, null, 2));

  if (!apply) {
    await prisma.$disconnect();
    process.exit(0);
  }

  await prisma.$transaction(async (tx) => {
    if (phantomRows.length > 0) {
      await tx.inventoryLedger.deleteMany({
        where: { id: { in: phantomRows.map((row) => row.id) } },
      });
    }

    for (const purchase of purchases) {
      const lot = await tx.lot.create({
        data: {
          tenantId: purchase.tenantId,
          productId: purchase.productId,
          packagingId: purchase.packagingId,
          supplierId: purchase.supplierId,
          purchaseId: purchase.id,
          batchCode: purchase.code,
          quantityKg: purchase.type === "GREEN_BEAN" ? purchase.weightKg ?? 0 : 0,
          quantityUnit: purchase.type === "PACKAGING" ? purchase.quantityUnits ?? 0 : 0,
          receivedAt: purchase.receivedAt,
          notes: "Backfill audit",
        },
      });

      const refTypes = purchase.type === "GREEN_BEAN" ? (["PURCHASE_GB"] as LedgerRefType[]) : (["PURCHASE_PKG"] as LedgerRefType[]);
      await tx.inventoryLedger.updateMany({
        where: {
          refId: purchase.id,
          refType: { in: refTypes },
          entryType: "IN",
          lotId: null,
        },
        data: {
          lotId: lot.id,
          lotNumber: lot.batchCode,
        },
      });
    }

    const allocationsByEntry = new Map<string, Allocation[]>();
    for (const allocation of allocations) {
      if (!allocationsByEntry.has(allocation.entry.id)) allocationsByEntry.set(allocation.entry.id, []);
      allocationsByEntry.get(allocation.entry.id)!.push(allocation);
    }

    for (const [entryId, entryAllocs] of allocationsByEntry) {
      const entry = entryAllocs[0].entry;
      if (entryAllocs.length === 1) {
        const a = entryAllocs[0];
        await tx.inventoryLedger.update({
          where: { id: entryId },
          data: {
            lotId: a.lot.id,
            lotNumber: a.lot.batchCode,
            expiryDate: a.lot.expiryDate,
          },
        });
      } else {
        const first = entryAllocs[0];
        await tx.inventoryLedger.update({
          where: { id: entryId },
          data: {
            quantityKg: first.takeKg > 0 ? first.takeKg : null,
            quantityUnit: first.takeUnit > 0 ? first.takeUnit : null,
            lotId: first.lot.id,
            lotNumber: first.lot.batchCode,
            expiryDate: first.lot.expiryDate,
            notes: entry.notes ? `${entry.notes} · FEFO backfill` : "FEFO backfill",
          },
        });
        for (const extra of entryAllocs.slice(1)) {
          await tx.inventoryLedger.create({
            data: {
              tenantId: entry.tenantId,
              productId: entry.productId,
              packagingId: entry.packagingId,
              entryType: entry.entryType as "IN" | "OUT",
              refType: entry.refType as LedgerRefType,
              refId: entry.refId,
              quantityKg: extra.takeKg > 0 ? extra.takeKg : null,
              quantityUnit: extra.takeUnit > 0 ? extra.takeUnit : null,
              lotId: extra.lot.id,
              lotNumber: extra.lot.batchCode,
              expiryDate: extra.lot.expiryDate,
              notes: entry.notes ? `${entry.notes} · FEFO backfill` : "FEFO backfill",
              createdById: entry.createdById,
              createdAt: entry.createdAt,
            },
          });
        }
      }
      for (const a of entryAllocs) {
        if (a.fullConsume && !a.lot.consumedAt) {
          await tx.lot.update({
            where: { id: a.lot.id },
            data: { consumedAt: a.entry.createdAt },
          });
          a.lot.consumedAt = a.entry.createdAt;
        }
      }
    }
  }, { isolationLevel: "Serializable" });

  console.log(JSON.stringify({
    applied: {
      phantomDeleted: phantomRows.length,
      lotsBackfilled: purchases.length,
      entriesLinked: new Set(allocations.map((a) => a.entry.id)).size,
      entriesSkipped: skipped.length,
    },
  }));
} finally {
  await prisma.$disconnect();
}
