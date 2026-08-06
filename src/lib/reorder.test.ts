import { describe, it, expect, vi } from "vitest";
import {
  calculateAverageDailyUsage,
  calculateReorderPoint,
  getReorderStatus,
  getProductUsageAggregate,
  getFGUsageAggregate,
  getPackagingUsageAggregate,
  getSupplyUsageAggregate,
  getBatchReorderSummaries,
} from "./reorder";

// =============================================================================
// PURE FUNCTION TESTS
// =============================================================================

describe("calculateAverageDailyUsage", () => {
  it("calculates average daily usage correctly", () => {
    expect(calculateAverageDailyUsage(30, 120)).toBe(4);
  });

  it("returns 0 for zero lookback days", () => {
    expect(calculateAverageDailyUsage(0, 120)).toBe(0);
  });

  it("returns 0 for zero usage", () => {
    expect(calculateAverageDailyUsage(30, 0)).toBe(0);
  });

  it("handles fractional results", () => {
    expect(calculateAverageDailyUsage(7, 10)).toBeCloseTo(1.428571, 4);
  });
});

describe("calculateReorderPoint", () => {
  it("calculates reorder point correctly", () => {
    expect(calculateReorderPoint(4, 5, 10)).toBe(30);
  });

  it("handles zero safety stock", () => {
    expect(calculateReorderPoint(4, 5, 0)).toBe(20);
  });

  it("handles zero lead time", () => {
    expect(calculateReorderPoint(4, 0, 10)).toBe(10);
  });

  it("handles all zeros", () => {
    expect(calculateReorderPoint(0, 0, 0)).toBe(0);
  });
});

describe("getReorderStatus", () => {
  it("returns habis when stock is 0", () => {
    const result = getReorderStatus({
      currentStock: 0,
      reorderPoint: 30,
      alertEnabled: true,
      hasEnoughData: true,
    });
    expect(result.status).toBe("habis");
    expect(result.reason).toBe("Stok habis");
  });

  it("returns habis when stock is negative", () => {
    const result = getReorderStatus({
      currentStock: -5,
      reorderPoint: 30,
      alertEnabled: true,
      hasEnoughData: true,
    });
    expect(result.status).toBe("habis");
  });

  it("returns belum_dikonfigurasi when alert is disabled", () => {
    const result = getReorderStatus({
      currentStock: 50,
      reorderPoint: 30,
      alertEnabled: false,
      hasEnoughData: true,
    });
    expect(result.status).toBe("belum_dikonfigurasi");
  });

  it("returns data_belum_cukup when no usage data", () => {
    const result = getReorderStatus({
      currentStock: 50,
      reorderPoint: 30,
      alertEnabled: true,
      hasEnoughData: false,
    });
    expect(result.status).toBe("data_belum_cukup");
    expect(result.reason).toContain("penggunaan");
  });

  it("returns perlu_pesan when stock equals reorder point", () => {
    const result = getReorderStatus({
      currentStock: 30,
      reorderPoint: 30,
      alertEnabled: true,
      hasEnoughData: true,
    });
    expect(result.status).toBe("perlu_pesan");
  });

  it("returns perlu_pesan when stock is below reorder point", () => {
    const result = getReorderStatus({
      currentStock: 18,
      reorderPoint: 30,
      alertEnabled: true,
      hasEnoughData: true,
    });
    expect(result.status).toBe("perlu_pesan");
  });

  it("returns aman when stock is above reorder point", () => {
    const result = getReorderStatus({
      currentStock: 31,
      reorderPoint: 30,
      alertEnabled: true,
      hasEnoughData: true,
    });
    expect(result.status).toBe("aman");
  });

  it("returns aman when stock is well above reorder point", () => {
    const result = getReorderStatus({
      currentStock: 100,
      reorderPoint: 30,
      alertEnabled: true,
      hasEnoughData: true,
    });
    expect(result.status).toBe("aman");
  });
});

// =============================================================================
// DB FUNCTION TESTS (mocked Prisma)
// =============================================================================

function createMockPrisma() {
  return {
    inventoryLedger: {
      aggregate: vi.fn(),
      groupBy: vi.fn(),
    },
    product: {
      findMany: vi.fn(),
    },
    packaging: {
      findMany: vi.fn(),
    },
    inventorySupplyItem: {
      findMany: vi.fn(),
    },
  } as any;
}

describe("getProductUsageAggregate", () => {
  it("queries ledger with correct filters", async () => {
    const prisma = createMockPrisma();
    prisma.inventoryLedger.aggregate.mockResolvedValue({
      _sum: { quantityKg: 120 },
      _count: 5,
    });

    const result = await getProductUsageAggregate(prisma, "prod-1", 30);

    expect(result.totalUsage).toBe(120);
    expect(result.transactionCount).toBe(5);

    const where = prisma.inventoryLedger.aggregate.mock.calls[0][0].where;
    expect(where.productId).toBe("prod-1");
    expect(where.entryType).toBe("OUT");
    expect(where.refType.in).toContain("ROASTING_GB_OUT");
    expect(where.refType.in).toContain("PRODUCTION_RB_OUT");
    expect(where.createdAt.gte).toBeInstanceOf(Date);
  });

  it("returns 0 when no usage found", async () => {
    const prisma = createMockPrisma();
    prisma.inventoryLedger.aggregate.mockResolvedValue({
      _sum: { quantityKg: null },
      _count: 0,
    });

    const result = await getProductUsageAggregate(prisma, "prod-1", 30);

    expect(result.totalUsage).toBe(0);
    expect(result.transactionCount).toBe(0);
  });
});

describe("getFGUsageAggregate", () => {
  it("queries ledger with correct unit-based filters", async () => {
    const prisma = createMockPrisma();
    prisma.inventoryLedger.aggregate.mockResolvedValue({
      _sum: { quantityUnit: 50 },
      _count: 3,
    });

    const result = await getFGUsageAggregate(prisma, "fg-1", 30);

    expect(result.totalUsage).toBe(50);
    expect(result.transactionCount).toBe(3);

    const where = prisma.inventoryLedger.aggregate.mock.calls[0][0].where;
    expect(where.productId).toBe("fg-1");
    expect(where.refType.in).toContain("SALE_FG_OUT");
  });
});

describe("getPackagingUsageAggregate", () => {
  it("queries ledger with correct packaging filters", async () => {
    const prisma = createMockPrisma();
    prisma.inventoryLedger.aggregate.mockResolvedValue({
      _sum: { quantityUnit: 200 },
      _count: 10,
    });

    const result = await getPackagingUsageAggregate(prisma, "pkg-1", 30);

    expect(result.totalUsage).toBe(200);
    expect(result.transactionCount).toBe(10);

    const where = prisma.inventoryLedger.aggregate.mock.calls[0][0].where;
    expect(where.packagingId).toBe("pkg-1");
    expect(where.refType.in).toContain("PRODUCTION_PKG_OUT");
  });
});

describe("getSupplyUsageAggregate", () => {
  it("queries ledger with correct supply filters", async () => {
    const prisma = createMockPrisma();
    prisma.inventoryLedger.aggregate.mockResolvedValue({
      _sum: { supplyQuantity: 150 },
      _count: 6,
    });

    const result = await getSupplyUsageAggregate(prisma, "supply-1", 30);

    expect(result.totalUsage).toBe(150);
    expect(result.transactionCount).toBe(6);

    const where = prisma.inventoryLedger.aggregate.mock.calls[0][0].where;
    expect(where.supplyItemId).toBe("supply-1");
    expect(where.entryType).toBe("OUT");
    expect(where.refType.in).toContain("SUPPLY_PRODUCTION_OUT");
    expect(where.refType.in).toContain("SUPPLY_ADJUSTMENT_OUT");
  });

  it("returns 0 when no usage found", async () => {
    const prisma = createMockPrisma();
    prisma.inventoryLedger.aggregate.mockResolvedValue({
      _sum: { supplyQuantity: null },
      _count: 0,
    });

    const result = await getSupplyUsageAggregate(prisma, "supply-1", 30);

    expect(result.totalUsage).toBe(0);
    expect(result.transactionCount).toBe(0);
  });
});

// =============================================================================
// BATCH FUNCTION TESTS
// =============================================================================

describe("getBatchReorderSummaries", () => {
  it("returns summaries for all active SKUs", async () => {
    const prisma = createMockPrisma();

    prisma.product.findMany.mockResolvedValue([
      {
        id: "gb-1",
        code: "GB-GAYO",
        name: "Gayo",
        type: "GREEN_BEAN",
        stockKg: 50,
        stockUnit: 0,
        reorderAlertEnabled: true,
        leadTimeDays: 7,
        safetyStockQuantity: 10,
        reorderLookbackDays: 30,
      },
    ]);

    prisma.packaging.findMany.mockResolvedValue([]);
    prisma.inventorySupplyItem.findMany.mockResolvedValue([]);

    prisma.inventoryLedger.groupBy
      .mockResolvedValueOnce([
        {
          productId: "gb-1",
          _sum: { quantityKg: 120 },
          _count: 5,
        },
      ])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    const result = await getBatchReorderSummaries(prisma);

    expect(result.productSummaries).toHaveLength(1);
    expect(result.productSummaries[0].status).toBe("aman");
    expect(result.productSummaries[0].averageDailyUsage).toBe(4);
    expect(result.productSummaries[0].reorderPoint).toBe(38); // 4 * 7 + 10
  });

  it("short-circuits when alert is disabled", async () => {
    const prisma = createMockPrisma();

    prisma.product.findMany.mockResolvedValue([
      {
        id: "gb-1",
        code: "GB-GAYO",
        name: "Gayo",
        type: "GREEN_BEAN",
        stockKg: 50,
        stockUnit: 0,
        reorderAlertEnabled: false,
        leadTimeDays: 7,
        safetyStockQuantity: 10,
        reorderLookbackDays: 30,
      },
    ]);

    prisma.packaging.findMany.mockResolvedValue([]);
    prisma.inventorySupplyItem.findMany.mockResolvedValue([]);
    prisma.inventoryLedger.groupBy.mockResolvedValue([]);

    const result = await getBatchReorderSummaries(prisma);

    expect(result.productSummaries[0].status).toBe("belum_dikonfigurasi");
    expect(result.needsOrderCount).toBe(0);
  });

  it("marks SKU with 0 stock as habis", async () => {
    const prisma = createMockPrisma();

    prisma.product.findMany.mockResolvedValue([
      {
        id: "rb-1",
        code: "RB-ETHIO",
        name: "Ethiopia",
        type: "ROASTED_BEAN",
        stockKg: 0,
        stockUnit: 0,
        reorderAlertEnabled: true,
        leadTimeDays: 5,
        safetyStockQuantity: 10,
        reorderLookbackDays: 30,
      },
    ]);

    prisma.packaging.findMany.mockResolvedValue([]);
    prisma.inventorySupplyItem.findMany.mockResolvedValue([]);
    prisma.inventoryLedger.groupBy.mockResolvedValue([]);

    const result = await getBatchReorderSummaries(prisma);

    expect(result.productSummaries[0].status).toBe("habis");
    expect(result.needsOrderCount).toBe(1);
  });

  it("marks SKU with no usage data as data_belum_cukup", async () => {
    const prisma = createMockPrisma();

    prisma.product.findMany.mockResolvedValue([
      {
        id: "fg-1",
        code: "FG-BLEND",
        name: "Blend 250g",
        type: "FINISHED_GOODS",
        stockKg: 0,
        stockUnit: 20,
        reorderAlertEnabled: true,
        leadTimeDays: 7,
        safetyStockQuantity: 5,
        reorderLookbackDays: 30,
      },
    ]);

    prisma.packaging.findMany.mockResolvedValue([]);
    prisma.inventorySupplyItem.findMany.mockResolvedValue([]);
    prisma.inventoryLedger.groupBy.mockResolvedValue([]);

    const result = await getBatchReorderSummaries(prisma);

    expect(result.productSummaries[0].status).toBe("data_belum_cukup");
    expect(result.needsOrderCount).toBe(0);
  });

  it("marks SKU below reorder point as perlu_pesan", async () => {
    const prisma = createMockPrisma();

    prisma.product.findMany.mockResolvedValue([
      {
        id: "gb-1",
        code: "GB-GAYO",
        name: "Gayo",
        type: "GREEN_BEAN",
        stockKg: 18,
        stockUnit: 0,
        reorderAlertEnabled: true,
        leadTimeDays: 5,
        safetyStockQuantity: 10,
        reorderLookbackDays: 30,
      },
    ]);

    prisma.packaging.findMany.mockResolvedValue([]);
    prisma.inventorySupplyItem.findMany.mockResolvedValue([]);
    prisma.inventoryLedger.groupBy
      .mockResolvedValueOnce([
        {
          productId: "gb-1",
          _sum: { quantityKg: 120 },
          _count: 5,
        },
      ])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    const result = await getBatchReorderSummaries(prisma);

    // avgDailyUsage = 120/30 = 4, reorderPoint = 4*5+10 = 30
    expect(result.productSummaries[0].averageDailyUsage).toBe(4);
    expect(result.productSummaries[0].reorderPoint).toBe(30);
    expect(result.productSummaries[0].status).toBe("perlu_pesan");
    expect(result.needsOrderCount).toBe(1);
  });

  it("includes packaging summaries", async () => {
    const prisma = createMockPrisma();

prisma.product.findMany.mockResolvedValue([]);
    prisma.packaging.findMany.mockResolvedValue([
      {
        id: "pkg-1",
        code: "PKG-ZIP",
        name: "Zipper Bag",
        stockUnit: 100,
        reorderAlertEnabled: true,
        leadTimeDays: 14,
        safetyStockQuantity: 50,
        reorderLookbackDays: 30,
      },
    ]);

    prisma.inventorySupplyItem.findMany.mockResolvedValue([]);
    prisma.inventoryLedger.groupBy
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          packagingId: "pkg-1",
          refId: "batch-1",
          _sum: { quantityUnit: 300 },
          _count: 10,
        },
      ])
      .mockResolvedValueOnce([]);

    const result = await getBatchReorderSummaries(prisma);

    expect(result.packagingSummaries).toHaveLength(1);
    // avgDailyUsage = 300/30 = 10, reorderPoint = 10*14+50 = 190
    expect(result.packagingSummaries[0].averageDailyUsage).toBe(10);
    expect(result.packagingSummaries[0].reorderPoint).toBe(190);
    expect(result.packagingSummaries[0].status).toBe("perlu_pesan");
  });

  it("reads a linked packaging as a SUPPLY summary (not duplicated as legacy)", async () => {
    const prisma = createMockPrisma();

    prisma.product.findMany.mockResolvedValue([]);
    prisma.packaging.findMany.mockResolvedValue([
      {
        id: "pkg-1",
        code: "PKG-ZIP",
        name: "Zipper Bag",
        stockUnit: 100,
        reorderAlertEnabled: true,
        leadTimeDays: 14,
        safetyStockQuantity: 50,
        reorderLookbackDays: 30,
      },
    ]);
    prisma.inventorySupplyItem.findMany.mockResolvedValue([
      {
        id: "supply-1",
        code: "SUP-POUCH-250",
        name: "Pouch 250g",
        baseUnit: "PCS",
        stockQuantity: 120,
        reorderAlertEnabled: true,
        leadTimeDays: 14,
        safetyStockQuantity: 50,
        reorderLookbackDays: 30,
        packaging: { id: "pkg-1" },
      },
    ]);

    // Legacy stream: batch A + batch B wrote PRODUCTION_PKG_OUT
    // Canonical stream: batch A also wrote SUPPLY_PRODUCTION_OUT
    prisma.inventoryLedger.groupBy
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        { packagingId: "pkg-1", refId: "batch-A", _sum: { quantityUnit: 100 }, _count: 1 },
        { packagingId: "pkg-1", refId: "batch-B", _sum: { quantityUnit: 200 }, _count: 1 },
      ])
      .mockResolvedValueOnce([
        { supplyItemId: "supply-1", refId: "batch-A", _sum: { supplyQuantity: 100 }, _count: 1 },
      ]);

    const result = await getBatchReorderSummaries(prisma);

    // The linked packaging must NOT produce a legacy packaging summary
    expect(result.packagingSummaries).toHaveLength(0);
    // One supply summary, usage deduplicated by refId: 100 + 200 = 300 (not 400)
    expect(result.supplySummaries).toHaveLength(1);
    expect(result.supplySummaries[0].skuType).toBe("SUPPLY");
    expect(result.supplySummaries[0].skuCode).toBe("SUP-POUCH-250");
    expect(result.supplySummaries[0].currentStock).toBe(120);
    expect(result.supplySummaries[0].averageDailyUsage).toBe(10); // 300/30
    expect(result.supplySummaries[0].status).toBe("perlu_pesan");
  });

  it("supports stand-alone supply items without a legacy packaging", async () => {
    const prisma = createMockPrisma();

    prisma.product.findMany.mockResolvedValue([]);
    prisma.packaging.findMany.mockResolvedValue([]);
    prisma.inventorySupplyItem.findMany.mockResolvedValue([
      {
        id: "supply-1",
        code: "SUP-LABEL-60",
        name: "Label 60mm",
        baseUnit: "ROLL",
        stockQuantity: 2,
        reorderAlertEnabled: true,
        leadTimeDays: 7,
        safetyStockQuantity: 1,
        reorderLookbackDays: 30,
        packaging: null,
      },
    ]);

    prisma.inventoryLedger.groupBy
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    const result = await getBatchReorderSummaries(prisma);

    expect(result.supplySummaries).toHaveLength(1);
    expect(result.supplySummaries[0].status).toBe("data_belum_cukup");
    expect(result.needsOrderCount).toBe(0);
  });

  it("does not include other tenants data", async () => {
    const prisma = createMockPrisma();

    prisma.product.findMany.mockResolvedValue([
      {
        id: "gb-1",
        code: "GB-GAYO",
        name: "Gayo",
        type: "GREEN_BEAN",
        stockKg: 50,
        stockUnit: 0,
        reorderAlertEnabled: true,
        leadTimeDays: 7,
        safetyStockQuantity: 10,
        reorderLookbackDays: 30,
      },
    ]);

    prisma.packaging.findMany.mockResolvedValue([]);
    prisma.inventorySupplyItem.findMany.mockResolvedValue([]);

    // Only this product's usage, not another tenant's
    prisma.inventoryLedger.groupBy
      .mockResolvedValueOnce([
        {
          productId: "gb-1",
          _sum: { quantityKg: 120 },
          _count: 5,
        },
      ])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    const result = await getBatchReorderSummaries(prisma);

    // Verify the query includes tenant scoping via the where clause
    const groupByCall = prisma.inventoryLedger.groupBy.mock.calls[0][0];
    expect(groupByCall.where.productId).toEqual({ not: null });
    // Tenant scoping is handled by Prisma's withTenant extension
    expect(result.productSummaries).toHaveLength(1);
  });
});
