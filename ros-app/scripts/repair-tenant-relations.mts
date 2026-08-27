import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL or DIRECT_URL is required.");
}

const apply = process.argv.includes("--apply");
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

function consensusTenant(values: Array<string | null | undefined>) {
  const unique = [...new Set(values.filter((value): value is string => Boolean(value)))];
  return unique.length === 1 ? unique[0] : null;
}

async function referenceTenant(
  refType: string,
  refId: string,
  plannedTargets: Map<string, string>,
) {
  if (refType.startsWith("PURCHASE_")) {
    const planned = plannedTargets.get(`Purchase:${refId}`);
    if (planned) return planned;
    return (
      await prisma.purchase.findUnique({
        where: { id: refId },
        select: { tenantId: true },
      })
    )?.tenantId;
  }
  if (refType.startsWith("ROASTING_")) {
    return (
      await prisma.parentRoastingBatch.findUnique({
        where: { id: refId },
        select: { tenantId: true },
      })
    )?.tenantId;
  }
  if (refType.startsWith("PRODUCTION_")) {
    return (
      await prisma.productionBatch.findUnique({
        where: { id: refId },
        select: { tenantId: true },
      })
    )?.tenantId;
  }
  if (refType === "SALE_FG_OUT") {
    return (
      await prisma.invoice.findUnique({
        where: { id: refId },
        select: { tenantId: true },
      })
    )?.tenantId;
  }
  return null;
}

try {
  const repairs: Array<{
    model: string;
    id: string;
    fromTenantId: string;
    toTenantId: string;
  }> = [];

  const purchases = await prisma.purchase.findMany({
    include: {
      supplier: { select: { tenantId: true } },
      product: { select: { tenantId: true } },
      packaging: { select: { tenantId: true } },
      createdBy: { select: { tenantId: true } },
    },
  });
  for (const purchase of purchases) {
    const target = consensusTenant([
      purchase.supplier.tenantId,
      purchase.product?.tenantId,
      purchase.packaging?.tenantId,
      purchase.createdBy.tenantId,
    ]);
    if (target && target !== purchase.tenantId) {
      repairs.push({
        model: "Purchase",
        id: purchase.id,
        fromTenantId: purchase.tenantId,
        toTenantId: target,
      });
    }
  }

  const payments = await prisma.payment.findMany({
    include: {
      invoice: { select: { tenantId: true } },
      createdBy: { select: { tenantId: true } },
    },
  });
  for (const payment of payments) {
    const target = consensusTenant([
      payment.invoice.tenantId,
      payment.createdBy.tenantId,
    ]);
    if (target && target !== payment.tenantId) {
      repairs.push({
        model: "Payment",
        id: payment.id,
        fromTenantId: payment.tenantId,
        toTenantId: target,
      });
    }
  }

  const plannedTargets = new Map(
    repairs.map((repair) => [
      `${repair.model}:${repair.id}`,
      repair.toTenantId,
    ]),
  );

  const ledgers = await prisma.inventoryLedger.findMany({
    include: {
      product: { select: { tenantId: true } },
      packaging: { select: { tenantId: true } },
      createdBy: { select: { tenantId: true } },
    },
  });
  for (const ledger of ledgers) {
    const target = consensusTenant([
      ledger.product?.tenantId,
      ledger.packaging?.tenantId,
      ledger.createdBy.tenantId,
      await referenceTenant(ledger.refType, ledger.refId, plannedTargets),
    ]);
    if (target && target !== ledger.tenantId) {
      repairs.push({
        model: "InventoryLedger",
        id: ledger.id,
        fromTenantId: ledger.tenantId,
        toTenantId: target,
      });
    }
  }

  console.log(JSON.stringify({ apply, repairs }, null, 2));
  if (!apply || repairs.length === 0) process.exit(0);

  await prisma.$transaction(async (tx) => {
    for (const repair of repairs) {
      if (repair.model === "Purchase") {
        await tx.purchase.update({
          where: { id: repair.id },
          data: { tenantId: repair.toTenantId },
        });
      } else if (repair.model === "Payment") {
        await tx.payment.update({
          where: { id: repair.id },
          data: { tenantId: repair.toTenantId },
        });
      } else {
        await tx.inventoryLedger.update({
          where: { id: repair.id },
          data: { tenantId: repair.toTenantId },
        });
      }

      await tx.auditLog.create({
        data: {
          tenantId: repair.toTenantId,
          action: "REPAIR_TENANT_RELATION",
          entityType: repair.model,
          entityId: repair.id,
          before: { tenantId: repair.fromTenantId },
          after: { tenantId: repair.toTenantId },
        },
      });
    }
  });

  console.log(JSON.stringify({ repaired: repairs.length }));
} finally {
  await prisma.$disconnect();
}
