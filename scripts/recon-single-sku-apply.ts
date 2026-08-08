// =============================================================================
// RECON SINGLE SKU RECONCILIATION — bounded maintenance tool (one-time)
// =============================================================================
// Corrects historical demo-data stock drift for tenant KIMA ONLY:
//   PKG-OMNI    : packaging ledger -25  -> +120 (ADJUSTMENT_IN)  -> 95, cache=95
//   OMNI-FG-001 : product ledger   10  -> +93 (ADJUSTMENT_IN)    -> 103, cache=103
//   RB-GAYO     : ledger 4 kg valid   -> cache sync only (4) — no ledger write
//   GB-GAYO     : ledger 2238.75      -> -2135 (ADJUSTMENT_OUT)  -> 103.75, cache=103.75
//
// Bounded safety:
//   - tenant whitelist KIMA ONLY + SKU whitelist
//   - DRY-RUN by default; `--apply` required to write
//   - deterministic operationId stored as ledger refId -> idempotent & retry-safe
//   - existence check inside Serializable transaction
//   - fail closed when current ledger/cache != verified baseline
//   - XOR invariant: exactly one of productId | packagingId | supplyItemId
//   - audit log per operation, NO journals created (accounting deferred)
//   - NO purchase/roast rows deleted or rewritten (GB-GAYO kept)
//   - cache writes derived from plan target and verified from ledger afterwards
//
// Usage:
//   npx tsx scripts/recon-single-sku-apply.ts                     # dry-run all
//   npx tsx scripts/recon-single-sku-apply.ts --sku PKG-OMNI --apply
// =============================================================================

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, Prisma } from "@prisma/client";

const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;
if (!connectionString) {
  console.error("NO_DB_URL (set DIRECT_URL/DATABASE_URL)");
  process.exit(2);
}
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

const TENANT_CODE = "KIMAISE";
type AnyClient = PrismaClient | Prisma.TransactionClient;

type LedgerKind = "product" | "packaging" | "supply";

type Plan = {
  code: string;
  kind: "product" | "packaging";
  baseLedgerKg: number | null;
  baseLedgerUnit: number | null;
  baseCacheKg: number | null;
  baseCacheUnit: number | null;
  delta: { entryType: "IN" | "OUT"; qtyKg?: number; qtyUnit?: number } | null;
  targetCacheKg: number | null;
  targetCacheUnit: number | null;
  operationId: string;
  note: string;
};

const PLANS: Plan[] = [
  {
    code: "PKG-OMNI",
    kind: "packaging",
    baseLedgerKg: null,
    baseLedgerUnit: -25,
    baseCacheKg: null,
    baseCacheUnit: 95,
    delta: { entryType: "IN", qtyUnit: 120 },
    targetCacheKg: null,
    targetCacheUnit: 95,
    operationId: "RECON-KIMAISE-PKG-OMNI-OPENING-V1",
    note: "historical opening +120 (pre-cutover legacy packaging ledger)",
  },
  {
    code: "OMNI-FG-001",
    kind: "product",
    baseLedgerKg: null,
    baseLedgerUnit: 10,
    baseCacheKg: null,
    baseCacheUnit: 103,
    delta: { entryType: "IN", qtyUnit: 93 },
    targetCacheKg: null,
    targetCacheUnit: 103,
    operationId: "RECON-KIMAISE-OMNI-FG-001-OPENING-V1",
    note: "historical opening +93",
  },
  {
    code: "RB-GAYO",
    kind: "product",
    baseLedgerKg: 4,
    baseLedgerUnit: null,
    baseCacheKg: 0,
    baseCacheUnit: null,
    delta: null,
    targetCacheKg: 4,
    targetCacheUnit: null,
    operationId: "RECON-KIMAISE-RB-GAYO-SYNC-V1",
    note: "ledger valid (4 kg) — cache sync only, no ledger write",
  },
  {
    code: "GB-GAYO",
    kind: "product",
    baseLedgerKg: 2238.75,
    baseLedgerUnit: null,
    baseCacheKg: 103.75,
    baseCacheUnit: null,
    delta: { entryType: "OUT", qtyKg: 2135 },
    targetCacheKg: 103.75,
    targetCacheUnit: null,
    operationId: "RECON-KIMAISE-GB-GAYO-ADJUST-OUT-V1",
    note: "demo/legacy reconciliation: 2238.75 kg demo data -> 103.75 kg (ADJUSTMENT_OUT 2135); purchases retained (approved business decision)",
  },
];

const EPS = { kg: 0.0001, unit: 0.0001 };
const ALLOWED_CODES = new Set(PLANS.map((p) => p.code));

async function ledgerSums(
  client: AnyClient,
  tenantId: string,
  entityId: string,
  kind: LedgerKind,
): Promise<{ kg: number; unit: number }> {
  const col =
    kind === "packaging" ? '"packagingId"' : kind === "supply" ? '"supplyItemId"' : '"productId"';
  const rows = await client.$queryRawUnsafe<Array<{ kg: string | number; unit: string | number }>>(
    `SELECT
       COALESCE(SUM(CASE WHEN "entryType"='IN' THEN COALESCE("quantityKg",0)
                         ELSE -COALESCE("quantityKg",0) END),0) AS kg,
       COALESCE(SUM(CASE WHEN "entryType"='IN' THEN COALESCE("quantityUnit",0)
                         ELSE -COALESCE("quantityUnit",0) END),0) AS unit
     FROM inventory_ledger WHERE "tenantId"=$1 AND ${col}=$2`,
    tenantId,
    entityId,
  );
  const row = rows[0];
  return { kg: Number(row?.kg ?? 0), unit: Number(row?.unit ?? 0) };
}

async function entityOf(
  client: AnyClient,
  tenantId: string,
  plan: Plan,
): Promise<{ id: string; kg: number; unit: number }> {
  if (plan.kind === "packaging") {
    const p = await client.packaging.findFirst({ where: { tenantId, code: plan.code } });
    if (!p) throw new Error(`packaging ${plan.code} not found in tenant`);
    return { id: p.id, kg: 0, unit: Number(p.stockUnit ?? 0) };
  }
  const pr = await client.product.findFirst({ where: { tenantId, code: plan.code } });
  if (!pr) throw new Error(`product ${plan.code} not found in tenant`);
  return { id: pr.id, kg: Number(pr.stockKg ?? 0), unit: Number(pr.stockUnit ?? 0) };
}

/** Fail-closed: current ledger + cache must equal the verified baseline. */
async function assertBaseline(
  client: AnyClient,
  tenantId: string,
  plan: Plan,
): Promise<{ entity: { id: string; kg: number; unit: number }; ledger: { kg: number; unit: number } }> {
  const entity = await entityOf(client, tenantId, plan);
  const ledger = await ledgerSums(client, tenantId, entity.id, plan.kind);
  const issues: string[] = [];
  if (plan.baseLedgerKg != null && Math.abs(ledger.kg - plan.baseLedgerKg) > EPS.kg)
    issues.push(`ledger kg ${ledger.kg} != baseline ${plan.baseLedgerKg}`);
  if (plan.baseLedgerUnit != null && Math.abs(ledger.unit - plan.baseLedgerUnit) > EPS.unit)
    issues.push(`ledger unit ${ledger.unit} != baseline ${plan.baseLedgerUnit}`);
  if (plan.baseCacheKg != null && Math.abs(entity.kg - plan.baseCacheKg) > EPS.kg)
    issues.push(`cache kg ${entity.kg} != baseline ${plan.baseCacheKg}`);
  if (plan.baseCacheUnit != null && Math.abs(entity.unit - plan.baseCacheUnit) > EPS.unit)
    issues.push(`cache unit ${entity.unit} != baseline ${plan.baseCacheUnit}`);
  if (issues.length > 0) {
    throw new Error(`BASELINE_MISMATCH ${plan.code}: ${issues.join("; ")}`);
  }
  return { entity, ledger };
}

/**
 * Supply-item cache mirror: stockQuantity must equal packLedgerSum + supplyLedgerSum
 * (supply-backfill invariant). Runs even on the ALREADY path so a pre-mirror apply
 * gets its supply cache derived on retry. No supply ledger row (would double-count).
 */
async function ensureSupplyMirror(
  tx: Prisma.TransactionClient,
  plan: Plan,
  entity: { id: string; kg: number; unit: number },
  tenantId: string,
  userId: string,
): Promise<void> {
  if (plan.kind !== "packaging") return;
  const packaging = await tx.packaging.findFirst({
    where: { id: entity.id },
    select: { supplyItemId: true },
  });
  if (!packaging?.supplyItemId) return;
  const op = `${plan.operationId}-SUPPLY`;
  const marker = await tx.auditLog.findMany({
    where: {
      tenantId,
      action: "RECON_SYNC",
      entityType: "SupplyStock",
      entityId: packaging.supplyItemId,
      metadata: { path: ["op"], equals: op },
    },
    select: { id: true },
  });
  if (marker.length > 0) return;
  const packSum = (await ledgerSums(tx, tenantId, entity.id, "packaging")).unit;
  const supplySum = (await ledgerSums(tx, tenantId, packaging.supplyItemId, "supply")).unit;
  const target = packSum + supplySum;
  await tx.inventorySupplyItem.update({
    where: { id: packaging.supplyItemId },
    data: { stockQuantity: target },
  });
  await tx.auditLog.create({
    data: {
      tenantId,
      userId,
      action: "RECON_SYNC",
      entityType: "SupplyStock",
      entityId: packaging.supplyItemId,
      metadata: {
        op,
        sku: plan.code,
        targetStockQuantity: target,
        note: plan.note,
      },
    },
  });
  console.log(`  ${plan.code}: supply mirror SUP->${target}`);
}

async function applyPlan(
  plan: Plan,
  tenantId: string,
  userId: string,
): Promise<"APPLIED" | "ALREADY"> {
  return prisma.$transaction(
    async (tx) => {
      const { entity } = await assertBaseline(tx, tenantId, plan);

      // Idempotency inside the tx (Serializable): deterministic refId
      const existing = await tx.inventoryLedger.findFirst({
        where: { tenantId, refId: plan.operationId },
        select: { id: true },
      });
      if (existing) {
        await ensureSupplyMirror(tx, plan, entity, tenantId, userId);
        return "ALREADY";
      }

      if (plan.delta) {
        const refType = plan.delta.entryType === "IN" ? "ADJUSTMENT_IN" : "ADJUSTMENT_OUT";
        await tx.inventoryLedger.create({
          data: {
            tenantId,
            entryType: plan.delta.entryType,
            refType,
            refId: plan.operationId,
            quantityKg: plan.delta.qtyKg ?? null,
            quantityUnit: plan.delta.qtyUnit ?? null,
            supplyQuantity: null,
            lotId: null,
            lotNumber: null,
            notes: plan.note,
            createdById: userId,
            productId: plan.kind === "product" ? entity.id : null,
            packagingId: plan.kind === "packaging" ? entity.id : null,
            supplyItemId: null,
          },
        });
      } else {
        // cache-sync only: idempotency via audit marker (no ledger row)
        const marker = await tx.auditLog.findMany({
          where: {
            tenantId,
            action: "RECON_SYNC",
            entityId: entity.id,
            metadata: { path: ["op"], equals: plan.operationId },
          },
          select: { id: true },
        });
        if (marker.length > 0) return "ALREADY";
      }

      // Cache derived (target explicitly from plan; baseline above guarantees source)
      if (plan.kind === "packaging") {
        await tx.packaging.update({
          where: { id: entity.id },
          data: { stockUnit: plan.targetCacheUnit ?? entity.unit },
        });
      } else {
        await tx.product.update({
          where: { id: entity.id },
          data: {
            stockKg: plan.targetCacheKg ?? entity.kg,
            stockUnit: plan.targetCacheUnit ?? entity.unit,
          },
        });
      }

      await tx.auditLog.create({
        data: {
          tenantId,
          userId,
          action: plan.delta ? "RECON_ADJUST" : "RECON_SYNC",
          entityType: plan.kind === "packaging" ? "PackagingStock" : "ProductStock",
          entityId: entity.id,
          metadata: {
            op: plan.operationId,
            sku: plan.code,
            entryType: plan.delta?.entryType ?? null,
            qtyKg: plan.delta?.qtyKg ?? null,
            qtyUnit: plan.delta?.qtyUnit ?? null,
            targetCacheKg: plan.targetCacheKg ?? null,
            targetCacheUnit: plan.targetCacheUnit ?? null,
            note: plan.note,
          },
        },
      });

      await ensureSupplyMirror(tx, plan, entity, tenantId, userId);

      return "APPLIED";
    },
    { isolationLevel: "Serializable", maxWait: 15000, timeout: 60000 },
  );
}

async function verifyPlan(plan: Plan, tenantId: string): Promise<boolean> {
  const entity = await entityOf(prisma, tenantId, plan);
  const ledger = await ledgerSums(prisma, tenantId, entity.id, plan.kind);
  console.log(
    `  VERIFY ${plan.code} (${plan.kind}): ledger kg=${ledger.kg} unit=${ledger.unit} | cache kg=${entity.kg} unit=${entity.unit}`,
  );
  const ok =
    (plan.baseLedgerKg != null
      ? Math.abs(ledger.kg - (plan.targetCacheKg ?? 0)) <= EPS.kg
      : true) &&
    (plan.baseLedgerUnit != null
      ? Math.abs(ledger.unit - (plan.targetCacheUnit ?? 0)) <= EPS.unit
      : true) &&
    (plan.targetCacheKg == null || Math.abs(entity.kg - plan.targetCacheKg) <= EPS.kg) &&
    (plan.targetCacheUnit == null || Math.abs(entity.unit - plan.targetCacheUnit) <= EPS.unit);
  return ok;
}

/** Post-state the plan is expected to produce (used for idempotent rerun detection). */
function expectState(plan: Plan): { kg: number | null; unit: number | null } {
  return {
    kg:
      plan.delta?.qtyKg != null
        ? plan.baseLedgerKg! + (plan.delta.entryType === "IN" ? plan.delta.qtyKg : -plan.delta.qtyKg)
        : plan.baseLedgerKg,
    unit:
      plan.delta?.qtyUnit != null
        ? plan.baseLedgerUnit! + (plan.delta.entryType === "IN" ? plan.delta.qtyUnit : -plan.delta.qtyUnit)
        : plan.baseLedgerUnit,
  };
}

async function stateMatchesTarget(plan: Plan, tenantId: string): Promise<boolean> {
  const entity = await entityOf(prisma, tenantId, plan);
  const ledger = await ledgerSums(prisma, tenantId, entity.id, plan.kind);
  const exp = expectState(plan);
  return (
    (exp.kg == null || Math.abs(ledger.kg - exp.kg) <= EPS.kg) &&
    (exp.unit == null || Math.abs(ledger.unit - exp.unit) <= EPS.unit) &&
    (plan.targetCacheKg == null || Math.abs(entity.kg - plan.targetCacheKg) <= EPS.kg) &&
    (plan.targetCacheUnit == null || Math.abs(entity.unit - plan.targetCacheUnit) <= EPS.unit)
  );
}

async function run(): Promise<void> {
  const argv = process.argv.slice(2);
  const wantApply = argv.includes("--apply");
  const skuFilter = argv.find((a) => a.startsWith("--sku="))?.split("=")[1] ?? null;
  if (skuFilter && !ALLOWED_CODES.has(skuFilter)) {
    console.error(`SKU "${skuFilter}" not in whitelist (${Array.from(ALLOWED_CODES).join(", ")})`);
    process.exit(2);
  }
  const plans = skuFilter ? PLANS.filter((p) => p.code === skuFilter) : PLANS;

  const tenant = await prisma.tenant.findUnique({ where: { code: TENANT_CODE } });
  if (!tenant) {
    console.error(`tenant "${TENANT_CODE}" not found — abort`);
    process.exit(2);
  }
  const tenantId = tenant.id;
  const runUser = await prisma.user.findFirst({
    where: { tenantId, role: "SUPERADMIN" },
    select: { id: true },
  });
  if (!runUser) {
    console.error("no SUPERADMIN user in tenant — cannot create ledger createdById");
    process.exit(2);
  }
  const userId = runUser.id;

  console.log(`\n== RECON ${wantApply ? "APPLY" : "DRY-RUN"} | tenant=${TENANT_CODE} | sku=${skuFilter ?? "all"} ==`);

  let fail = false;
  const results: string[] = [];
  for (const plan of plans) {
    try {
      const pre = await assertBaseline(prisma, tenantId, plan);
      if (!wantApply) {
        const afterKg =
          plan.delta?.qtyKg != null
            ? pre.ledger.kg + (plan.delta.entryType === "IN" ? plan.delta.qtyKg : -plan.delta.qtyKg)
            : pre.ledger.kg;
        const afterUnit =
          plan.delta?.qtyUnit != null
            ? pre.ledger.unit + (plan.delta.entryType === "IN" ? plan.delta.qtyUnit : -plan.delta.qtyUnit)
            : pre.ledger.unit;
        console.log(
          `\n${plan.code} (${plan.kind}) — op=${plan.operationId}\n` +
            `  before : ledger kg=${pre.ledger.kg} unit=${pre.ledger.unit} | cache kg=${pre.entity.kg} unit=${pre.entity.unit}\n` +
            `  delta  : ${plan.delta ? `${plan.delta.entryType} kg=${plan.delta.qtyKg ?? 0} unit=${plan.delta.qtyUnit ?? 0}` : "none (cache sync)"}\n` +
            `  after  : ledger kg=${afterKg} unit=${afterUnit} | cache kg=${plan.targetCacheKg ?? pre.entity.kg} unit=${plan.targetCacheUnit ?? pre.entity.unit}`,
        );
        results.push("PLAN_OK");
        continue;
      }
      results.push(await applyPlan(plan, tenantId, userId));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`  ${plan.code}: ${msg}`);
      if (msg.startsWith("BASELINE_MISMATCH")) {
        if (await stateMatchesTarget(plan, tenantId)) {
          const userId = runUser.id;
          await prisma.$transaction(
            async (tx) => {
              const entity = await entityOf(tx, tenantId, plan);
              await ensureSupplyMirror(tx, plan, entity, tenantId, userId);
            },
            { isolationLevel: "Serializable", maxWait: 15000, timeout: 60000 },
          );
          console.log(`    -> already at target (idempotent rerun) — OK`);
          results.push("ALREADY_AT_TARGET");
          continue;
        }
        console.error(`    -> fail-closed: no write for ${plan.code}`);
      }
      results.push("ERROR");
      fail = true;
    }
  }

  console.log(`\nsummary (${plans.length} sku): ${results.join(" | ")}`);
  if (!wantApply) {
    console.log("== dry-run — nothing written; rerun with --apply to commit ==");
  } else {
    console.log("\n== VERIFY (recompute from ledger) ==");
    for (const plan of plans) {
      try {
        const ok = await verifyPlan(plan, tenantId);
        console.log(`  ${plan.code}: ${ok ? "OK" : "FAIL"}`);
        if (!ok) fail = true;
      } catch (err) {
        console.error(`  ${plan.code}: VERIFY ERROR ${err instanceof Error ? err.message : err}`);
        fail = true;
      }
    }
  }

  process.exit(fail ? 1 : 0);
}

run().catch((e) => {
  console.error("PROBE ERROR:", e);
  process.exit(1);
});