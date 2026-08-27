import type { PrismaClient } from "@prisma/client";
import { getStartOfTodayWIB } from "./date-utils";
import { withTenant } from "@/lib/prisma";

// =============================================================================
// CONSUMPTION REF TYPES — mutations that count toward averageDailyUsage
// =============================================================================

const CONSUMPTION_REF_TYPES_KG = [
  "ROASTING_GB_OUT",
  "PRODUCTION_RB_OUT",
] as const;

const CONSUMPTION_REF_TYPES_UNIT = [
  "PRODUCTION_PKG_OUT",
  "SALE_FG_OUT",
] as const;

// Ref types that reduce InventorySupplyItem stock in the lookback window.
// SUPPLY_PRODUCTION_OUT is the primary consumption (production batch writes
// one SUPPLY entry per supply component); SUPPLY_ADJUSTMENT_OUT covers losses.
const SUPPLY_CONSUMPTION_REF_TYPES = [
  "SUPPLY_PRODUCTION_OUT",
  "SUPPLY_ADJUSTMENT_OUT",
] as const;

// =============================================================================
// TYPES
// =============================================================================

export type ReorderStatus =
  | "habis"
  | "perlu_pesan"
  | "aman"
  | "belum_dikonfigurasi"
  | "data_belum_cukup";

export interface ReorderSummary {
  skuId: string;
  skuCode: string;
  skuName: string;
  skuType: "GREEN_BEAN" | "ROASTED_BEAN" | "FINISHED_GOODS" | "PACKAGING" | "SUPPLY";
  currentStock: number;
  averageDailyUsage: number;
  leadTimeDays: number;
  safetyStockQuantity: number;
  reorderPoint: number;
  status: ReorderStatus;
  lookbackDays: number;
  hasEnoughData: boolean;
  reason?: string;
}

// =============================================================================
// PURE FUNCTIONS
// =============================================================================

/**
 * Calculate average daily usage from total usage and lookback period.
 * Returns 0 if lookbackDays <= 0.
 */
export function calculateAverageDailyUsage(
  lookbackDays: number,
  totalUsage: number,
): number {
  if (lookbackDays <= 0) return 0;
  return totalUsage / lookbackDays;
}

/**
 * Calculate reorder point.
 * reorderPoint = averageDailyUsage × leadTimeDays + safetyStockQuantity
 */
export function calculateReorderPoint(
  averageDailyUsage: number,
  leadTimeDays: number,
  safetyStockQuantity: number,
): number {
  return averageDailyUsage * leadTimeDays + safetyStockQuantity;
}

/**
 * Determine reorder status based on current stock, reorder point, and config.
 */
export function getReorderStatus(params: {
  currentStock: number;
  reorderPoint: number;
  alertEnabled: boolean;
  hasEnoughData: boolean;
}): { status: ReorderStatus; reason?: string } {
  const { currentStock, reorderPoint, alertEnabled, hasEnoughData } = params;

  if (currentStock <= 0) {
    return { status: "habis", reason: "Stok habis" };
  }

  if (!alertEnabled) {
    return { status: "belum_dikonfigurasi" };
  }

  if (!hasEnoughData) {
    return {
      status: "data_belum_cukup",
      reason: "Belum ada data penggunaan dalam periode analisis",
    };
  }

  if (currentStock <= reorderPoint) {
    return { status: "perlu_pesan" };
  }

  return { status: "aman" };
}

// =============================================================================
// DB FUNCTIONS
// =============================================================================

function getSinceDate(lookbackDays: number): Date {
  const since = getStartOfTodayWIB();
  since.setDate(since.getDate() - lookbackDays);
  return since;
}

/**
 * Aggregate total consumption (kg) for a product within the lookback window.
 * Uses existing index: [tenantId, productId, createdAt].
 */
export async function getProductUsageAggregate(
  prisma: PrismaClient,
  productId: string,
  lookbackDays: number,
): Promise<{ totalUsage: number; transactionCount: number }> {
  const since = getSinceDate(lookbackDays);

  const result = await prisma.inventoryLedger.aggregate({
    _sum: { quantityKg: true },
    _count: true,
    where: {
      productId,
      createdAt: { gte: since },
      refType: { in: [...CONSUMPTION_REF_TYPES_KG] },
      entryType: "OUT",
    },
  });

  return {
    totalUsage: Number(result._sum.quantityKg ?? 0),
    transactionCount: result._count,
  };
}

/**
 * Aggregate total consumption (unit) for a product (FG) within the lookback window.
 * Uses existing index: [tenantId, productId, createdAt].
 */
export async function getFGUsageAggregate(
  prisma: PrismaClient,
  productId: string,
  lookbackDays: number,
): Promise<{ totalUsage: number; transactionCount: number }> {
  const since = getSinceDate(lookbackDays);

  const result = await prisma.inventoryLedger.aggregate({
    _sum: { quantityUnit: true },
    _count: true,
    where: {
      productId,
      createdAt: { gte: since },
      refType: { in: [...CONSUMPTION_REF_TYPES_UNIT] },
      entryType: "OUT",
    },
  });

  return {
    totalUsage: Number(result._sum.quantityUnit ?? 0),
    transactionCount: result._count,
  };
}

/**
 * Aggregate total consumption (unit) for packaging within the lookback window.
 * Uses existing index: [tenantId, packagingId, createdAt].
 */
export async function getPackagingUsageAggregate(
  prisma: PrismaClient,
  packagingId: string,
  lookbackDays: number,
): Promise<{ totalUsage: number; transactionCount: number }> {
  const since = getSinceDate(lookbackDays);

  const result = await prisma.inventoryLedger.aggregate({
    _sum: { quantityUnit: true },
    _count: true,
    where: {
      packagingId,
      createdAt: { gte: since },
      refType: { in: [...CONSUMPTION_REF_TYPES_UNIT] },
      entryType: "OUT",
    },
  });

  return {
    totalUsage: Number(result._sum.quantityUnit ?? 0),
    transactionCount: result._count,
  };
}

/**
 * Aggregate total consumption (baseUnit item) for a supply item within the
 * lookback window. Uses existing index: [tenantId, supplyItemId, createdAt].
 */
export async function getSupplyUsageAggregate(
  prisma: PrismaClient,
  supplyItemId: string,
  lookbackDays: number,
): Promise<{ totalUsage: number; transactionCount: number }> {
  const since = getSinceDate(lookbackDays);

  const result = await prisma.inventoryLedger.aggregate({
    _sum: { supplyQuantity: true },
    _count: true,
    where: {
      supplyItemId,
      createdAt: { gte: since },
      refType: { in: [...SUPPLY_CONSUMPTION_REF_TYPES] },
      entryType: "OUT",
    },
  });

  return {
    totalUsage: Number(result._sum.supplyQuantity ?? 0),
    transactionCount: result._count,
  };
}

/**
 * Batch-fetch reorder summaries for all active SKUs.
 * Uses 4 groupBy queries (kg products, unit products, unit packaging,
 * unit supply) — no N+1.
 *
 * Dual-read rule: a legacy Packaging linked to an InventorySupplyItem
 * (Packaging.supplyItemId) is reported ONLY as a SUPPLY summary. Production
 * writes both PRODUCTION_PKG_OUT (legacy) and SUPPLY_PRODUCTION_OUT (canonical)
 * for the same batch, so usage is merged per refId — the same transaction is
 * never counted twice.
 */
export async function getBatchReorderSummaries(
  prisma: ReturnType<typeof withTenant>,
): Promise<{
  productSummaries: ReorderSummary[];
  packagingSummaries: ReorderSummary[];
  supplySummaries: ReorderSummary[];
  needsOrderCount: number;
}> {
  // 1. Fetch all active products with reorder config
  const products = await prisma.product.findMany({
    where: { isActive: true },
    select: {
      id: true,
      code: true,
      name: true,
      type: true,
      stockKg: true,
      stockUnit: true,
      reorderAlertEnabled: true,
      leadTimeDays: true,
      safetyStockQuantity: true,
      reorderLookbackDays: true,
    },
    orderBy: { name: "asc" },
  });

  // 2. Fetch all active packagings with reorder config
  const packagings = await prisma.packaging.findMany({
    where: { isActive: true },
    select: {
      id: true,
      code: true,
      name: true,
      stockUnit: true,
      reorderAlertEnabled: true,
      leadTimeDays: true,
      safetyStockQuantity: true,
      reorderLookbackDays: true,
    },
    orderBy: { name: "asc" },
  });

  // 2b. Fetch all active supply items with their legacy packaging mapping
  const supplyItems = await prisma.inventorySupplyItem.findMany({
    where: { isActive: true },
    select: {
      id: true,
      code: true,
      name: true,
      baseUnit: true,
      stockQuantity: true,
      reorderAlertEnabled: true,
      leadTimeDays: true,
      safetyStockQuantity: true,
      reorderLookbackDays: true,
      packaging: { select: { id: true } },
    },
    orderBy: { name: "asc" },
  });

  const supplyLinkedPackagingIds = new Set(
    supplyItems.map((item) => item.packaging?.id).filter((id): id is string => !!id),
  );

  // 3. Compute the maximum lookback window
  const maxProductLookback = products.length
    ? Math.max(...products.map((p) => p.reorderLookbackDays))
    : 30;
  const maxPkgLookback = packagings.length
    ? Math.max(...packagings.map((p) => p.reorderLookbackDays))
    : 30;
  const maxSupplyLookback = supplyItems.length
    ? Math.max(...supplyItems.map((s) => s.reorderLookbackDays))
    : 30;
  const maxLookback = Math.max(maxProductLookback, maxPkgLookback, maxSupplyLookback, 30);
  const since = getSinceDate(maxLookback);

  // 4. Batch ledger queries. Packaging & supply are grouped by refId so the
  // dual-write streams of the same transaction can be deduplicated.
  const [productKgUsage, productUnitUsage, packagingUsage, supplyUsage] = await Promise.all([
    prisma.inventoryLedger.groupBy({
      by: ["productId"],
      _sum: { quantityKg: true },
      _count: true,
      where: {
        productId: { not: null },
        createdAt: { gte: since },
        refType: { in: [...CONSUMPTION_REF_TYPES_KG] },
        entryType: "OUT",
      },
    }),
    prisma.inventoryLedger.groupBy({
      by: ["productId"],
      _sum: { quantityUnit: true },
      _count: true,
      where: {
        productId: { not: null },
        createdAt: { gte: since },
        refType: { in: [...CONSUMPTION_REF_TYPES_UNIT] },
        entryType: "OUT",
      },
    }),
    prisma.inventoryLedger.groupBy({
      by: ["packagingId", "refId"],
      _sum: { quantityUnit: true },
      _count: true,
      where: {
        packagingId: { not: null },
        createdAt: { gte: since },
        refType: { in: [...CONSUMPTION_REF_TYPES_UNIT] },
        entryType: "OUT",
      },
    }),
    prisma.inventoryLedger.groupBy({
      by: ["supplyItemId", "refId"],
      _sum: { supplyQuantity: true },
      _count: true,
      where: {
        supplyItemId: { not: null },
        createdAt: { gte: since },
        refType: { in: [...SUPPLY_CONSUMPTION_REF_TYPES] },
        entryType: "OUT",
      },
    }),
  ]);

  // 5. Build lookup maps
  const kgUsageMap = new Map<string, { total: number; count: number }>();
  for (const row of productKgUsage) {
    if (row.productId) {
      kgUsageMap.set(row.productId, {
        total: Number(row._sum.quantityKg ?? 0),
        count: row._count,
      });
    }
  }

  const unitUsageMap = new Map<string, { total: number; count: number }>();
  for (const row of productUnitUsage) {
    if (row.productId) {
      unitUsageMap.set(row.productId, {
        total: Number(row._sum.quantityUnit ?? 0),
        count: row._count,
      });
    }
  }

  interface UsageEntry { total: number; count: number }

  const pkgUsageByRef = new Map<string, Map<string, UsageEntry>>();
  for (const row of packagingUsage) {
    if (row.packagingId && row.refId) {
      let byRef = pkgUsageByRef.get(row.packagingId);
      if (!byRef) {
        byRef = new Map();
        pkgUsageByRef.set(row.packagingId, byRef);
      }
      byRef.set(row.refId, {
        total: Number(row._sum.quantityUnit ?? 0),
        count: row._count,
      });
    }
  }

  const supplyUsageByRef = new Map<string, Map<string, UsageEntry>>();
  for (const row of supplyUsage) {
    if (row.supplyItemId && row.refId) {
      let byRef = supplyUsageByRef.get(row.supplyItemId);
      if (!byRef) {
        byRef = new Map();
        supplyUsageByRef.set(row.supplyItemId, byRef);
      }
      byRef.set(row.refId, {
        total: Number(row._sum.supplyQuantity ?? 0),
        count: row._count,
      });
    }
  }

  // 5b. Usage aggregation helpers
  function sumUsage(byRef: Map<string, UsageEntry> | undefined): UsageEntry {
    if (!byRef) return { total: 0, count: 0 };
    let total = 0;
    let count = 0;
    for (const entry of byRef.values()) {
      total += entry.total;
      count += entry.count;
    }
    return { total, count };
  }

  /**
   * Merge the canonical supply stream with the legacy packaging stream.
   * The same refId in both streams = the SAME transaction (a production batch
   * writes PRODUCTION_PKG_OUT + SUPPLY_PRODUCTION_OUT together), so the
   * canonical entry wins and the legacy one is dropped — never added.
   */
  function mergeSupplyUsage(
    primary: Map<string, UsageEntry> | undefined,
    fallback: Map<string, UsageEntry> | undefined,
  ): UsageEntry {
    const merged = new Map<string, UsageEntry>();
    for (const [refId, entry] of fallback ?? []) merged.set(refId, entry);
    for (const [refId, entry] of primary ?? []) merged.set(refId, entry);
    return sumUsage(merged);
  }

  // 6. Compute product summaries
  const productSummaries: ReorderSummary[] = products.map((product) => {
    const isKg = product.type === "GREEN_BEAN" || product.type === "ROASTED_BEAN";
    const currentStock = isKg ? Number(product.stockKg) : product.stockUnit;
    const safetyStock = Number(product.safetyStockQuantity);

    if (!product.reorderAlertEnabled) {
      return {
        skuId: product.id,
        skuCode: product.code,
        skuName: product.name,
        skuType: product.type as ReorderSummary["skuType"],
        currentStock,
        averageDailyUsage: 0,
        leadTimeDays: product.leadTimeDays,
        safetyStockQuantity: safetyStock,
        reorderPoint: 0,
        status: "belum_dikonfigurasi" as ReorderStatus,
        lookbackDays: product.reorderLookbackDays,
        hasEnoughData: false,
      };
    }

    const usageData = isKg
      ? kgUsageMap.get(product.id) ?? { total: 0, count: 0 }
      : unitUsageMap.get(product.id) ?? { total: 0, count: 0 };

    const hasEnoughData = usageData.count > 0;
    const avgDailyUsage = calculateAverageDailyUsage(
      product.reorderLookbackDays,
      usageData.total,
    );
    const reorderPoint = calculateReorderPoint(
      avgDailyUsage,
      product.leadTimeDays,
      safetyStock,
    );
    const { status, reason } = getReorderStatus({
      currentStock,
      reorderPoint,
      alertEnabled: true,
      hasEnoughData,
    });

    return {
      skuId: product.id,
      skuCode: product.code,
      skuName: product.name,
      skuType: product.type as ReorderSummary["skuType"],
      currentStock,
      averageDailyUsage: avgDailyUsage,
      leadTimeDays: product.leadTimeDays,
      safetyStockQuantity: safetyStock,
      reorderPoint,
      status,
      lookbackDays: product.reorderLookbackDays,
      hasEnoughData,
      reason,
    };
  });

  // 7. Compute packaging summaries.
  // Dual-read: a Packaging linked to a supply item is reported via the supply
  // item only (canonical). Legacy-only packagings keep the packaging summary.
  const packagingSummaries: ReorderSummary[] = packagings
    .filter((pkg) => !supplyLinkedPackagingIds.has(pkg.id))
    .map((pkg) => {
      const currentStock = pkg.stockUnit;
      const safetyStock = pkg.safetyStockQuantity;

      if (!pkg.reorderAlertEnabled) {
        return {
          skuId: pkg.id,
          skuCode: pkg.code,
          skuName: pkg.name,
          skuType: "PACKAGING" as const,
          currentStock,
          averageDailyUsage: 0,
          leadTimeDays: pkg.leadTimeDays,
          safetyStockQuantity: safetyStock,
          reorderPoint: 0,
          status: "belum_dikonfigurasi" as ReorderStatus,
          lookbackDays: pkg.reorderLookbackDays,
          hasEnoughData: false,
        };
      }

      const usageData = sumUsage(pkgUsageByRef.get(pkg.id));
      const hasEnoughData = usageData.count > 0;
      const avgDailyUsage = calculateAverageDailyUsage(
        pkg.reorderLookbackDays,
        usageData.total,
      );
      const reorderPoint = calculateReorderPoint(
        avgDailyUsage,
        pkg.leadTimeDays,
        safetyStock,
      );
      const { status, reason } = getReorderStatus({
        currentStock,
        reorderPoint,
        alertEnabled: true,
        hasEnoughData,
      });

      return {
        skuId: pkg.id,
        skuCode: pkg.code,
        skuName: pkg.name,
        skuType: "PACKAGING" as const,
        currentStock,
        averageDailyUsage: avgDailyUsage,
        leadTimeDays: pkg.leadTimeDays,
        safetyStockQuantity: safetyStock,
        reorderPoint,
        status,
        lookbackDays: pkg.reorderLookbackDays,
        hasEnoughData,
        reason,
      };
    });

  // 7b. Compute supply summaries (canonical for PACKAGING + other categories)
  const supplySummaries: ReorderSummary[] = supplyItems.map((item) => {
    const currentStock = Number(item.stockQuantity);
    const safetyStock = Number(item.safetyStockQuantity);

    if (!item.reorderAlertEnabled) {
      return {
        skuId: item.id,
        skuCode: item.code,
        skuName: item.name,
        skuType: "SUPPLY" as const,
        currentStock,
        averageDailyUsage: 0,
        leadTimeDays: item.leadTimeDays,
        safetyStockQuantity: safetyStock,
        reorderPoint: 0,
        status: "belum_dikonfigurasi" as ReorderStatus,
        lookbackDays: item.reorderLookbackDays,
        hasEnoughData: false,
      };
    }

    const usageData = mergeSupplyUsage(
      supplyUsageByRef.get(item.id),
      item.packaging?.id ? pkgUsageByRef.get(item.packaging.id) : undefined,
    );
    const hasEnoughData = usageData.count > 0;
    const avgDailyUsage = calculateAverageDailyUsage(
      item.reorderLookbackDays,
      usageData.total,
    );
    const reorderPoint = calculateReorderPoint(
      avgDailyUsage,
      item.leadTimeDays,
      safetyStock,
    );
    const { status, reason } = getReorderStatus({
      currentStock,
      reorderPoint,
      alertEnabled: true,
      hasEnoughData,
    });

    return {
      skuId: item.id,
      skuCode: item.code,
      skuName: item.name,
      skuType: "SUPPLY" as const,
      currentStock,
      averageDailyUsage: avgDailyUsage,
      leadTimeDays: item.leadTimeDays,
      safetyStockQuantity: safetyStock,
      reorderPoint,
      status,
      lookbackDays: item.reorderLookbackDays,
      hasEnoughData,
      reason,
    };
  });

  // 8. Count needs order
  const needsOrderCount =
    productSummaries.filter(
      (s) => s.status === "perlu_pesan" || s.status === "habis",
    ).length +
    packagingSummaries.filter(
      (s) => s.status === "perlu_pesan" || s.status === "habis",
    ).length +
    supplySummaries.filter(
      (s) => s.status === "perlu_pesan" || s.status === "habis",
    ).length;

  return { productSummaries, packagingSummaries, supplySummaries, needsOrderCount };
}
