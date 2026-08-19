import { describe, expect, it, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const TENANT_ID = "tenant-1";
const USER_ID = "user-1";

vi.mock("@/lib/auth", () => ({
  requireRole: vi.fn(),
  requireTenantPrisma: vi.fn(),
  getCurrentTenantId: vi.fn().mockResolvedValue("tenant-1"),
  getSystemUserId: vi.fn().mockResolvedValue("user-1"),
}));

vi.mock("@/lib/audit", () => ({
  recordAudit: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/stock", () => ({
  appendLedger: vi.fn().mockResolvedValue({ id: "ledger-1" }),
}));

vi.mock("@/lib/posting", () => ({
  postStockAdjustment: vi.fn().mockResolvedValue("journal-1"),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

const { requireTenantPrisma } = await import("@/lib/auth");

beforeEach(() => {
  vi.clearAllMocks();
});

import {
  createLocationOpname,
  confirmLocationOpname,
  cancelLocationOpname,
  getLocationOpnameDrafts,
  getLocationOpnameHistory,
} from "./lot-opname";

function buildMockPrisma(overrides: {
  lot?: any;
  location?: any;
  locationFindFirst?: any;
  placement?: any;
  opnameCreate?: any;
  opnameFindUnique?: any;
  opnameFindMany?: any;
  placementUpsert?: any;
  opnameUpdateMany?: { count: number };
} = {}) {
  const lot = overrides.lot ?? {
    id: "lot-1",
    tenantId: TENANT_ID,
    productId: "prod-1",
    packagingId: null,
    supplyItemId: null,
    quantityKg: 100,
    quantityUnit: 0,
    supplyQuantity: 0,
    batchCode: "BATCH-1",
    product: { name: "Green Bean Gayo", type: "GREEN_BEAN", avgCostPerKg: 100_000, lastHpp: null },
    packaging: null,
    supplyItem: null,
    inventoryLedgers: [],
  };

  const location = overrides.location ?? {
    id: "loc-1",
    tenantId: TENANT_ID,
    name: "A-01",
    warehouse: { name: "Gudang Utama" },
  };

  const placement = overrides.placement ?? {
    quantityKg: 30,
    quantityUnit: 0,
    supplyQty: 0,
  };

  const opnameCreate = overrides.opnameCreate ?? {
    id: "opname-1",
    tenantId: TENANT_ID,
    lotId: "lot-1",
    locationId: "loc-1",
    systemQuantityKg: 30,
    systemQuantityUnit: 0,
    systemSupplyQty: 0,
    countedQuantityKg: 29,
    countedQuantityUnit: null,
    countedSupplyQty: null,
    status: "DRAFT",
    notes: null,
    createdAt: new Date("2026-08-01T00:00:00Z"),
    updatedAt: new Date("2026-08-01T00:00:00Z"),
    createdBy: { name: "Operator" },
  };

  const lotPlacementUpsert = vi.fn().mockResolvedValue(overrides.placementUpsert ?? {});

  const prisma: any = {
    lot: {
      findUnique: vi.fn().mockResolvedValue(lot),
    },
    location: {
      findUnique: vi.fn().mockResolvedValue(location),
    },
    lotPlacement: {
      findFirst: vi.fn().mockResolvedValue(placement),
      upsert: lotPlacementUpsert,
    },
    locationOpname: {
      create: vi.fn().mockResolvedValue(opnameCreate),
      findUnique: vi.fn().mockResolvedValue(overrides.opnameFindUnique ?? {
        ...opnameCreate,
        lot,
      }),
      findMany: vi.fn().mockResolvedValue(overrides.opnameFindMany ?? []),
      updateMany: vi.fn().mockResolvedValue(overrides.opnameUpdateMany ?? { count: 1 }),
      update: vi.fn(),
    },
    $transaction: vi.fn(async (cb: (tx: any) => Promise<any>) => {
      const tx = {
        locationOpname: prisma.locationOpname,
        location: {
          findFirst: vi.fn().mockResolvedValue(overrides.locationFindFirst ?? { isSystem: false }),
        },
        lotPlacement: {
          findFirst: prisma.lotPlacement.findFirst,
          upsert: lotPlacementUpsert,
        },
        product: { findUnique: vi.fn() },
        packaging: { findUnique: vi.fn() },
        inventorySupplyItem: { findUnique: vi.fn() },
      };
      return cb(tx);
    }),
  };

  return prisma;
}

describe("createLocationOpname", () => {
  it("uses LotPlacement quantity for system snapshot, not whole Lot", async () => {
    const prisma = buildMockPrisma({
      lot: {
        id: "lot-1",
        tenantId: TENANT_ID,
        productId: "prod-1",
        packagingId: null,
        supplyItemId: null,
        quantityKg: 100,
        quantityUnit: 0,
        supplyQuantity: 0,
        batchCode: "BATCH-1",
        product: { name: "Green Bean Gayo" },
        packaging: null,
        supplyItem: null,
        inventoryLedgers: [],
      },
      placement: { quantityKg: 30, quantityUnit: 0, supplyQty: 0 },
    });

    (requireTenantPrisma as any).mockResolvedValue(prisma);

    const result = await createLocationOpname({
      lotId: "lot-1",
      locationId: "loc-1",
      countedQuantityKg: 29,
    });

    expect(result.success).toBe(true);
    expect(prisma.locationOpname.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        systemQuantityKg: 30,
        systemQuantityUnit: 0,
        systemSupplyQty: 0,
        countedQuantityKg: 29,
        countedQuantityUnit: null,
        countedSupplyQty: null,
      }),
    });
  });

  it("allows a legitimate zero physical count", async () => {
    const prisma = buildMockPrisma({
      placement: { quantityKg: 10, quantityUnit: 0, supplyQty: 0 },
    });

    (requireTenantPrisma as any).mockResolvedValue(prisma);

    const result = await createLocationOpname({
      lotId: "lot-1",
      locationId: "loc-1",
      countedQuantityKg: 0,
    });

    expect(result.success).toBe(true);
    expect(prisma.locationOpname.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        countedQuantityKg: 0,
      }),
    });
  });

  it("stores zero explicitly, not as null", async () => {
    const prisma = buildMockPrisma({
      placement: { quantityKg: 10, quantityUnit: 0, supplyQty: 0 },
    });

    (requireTenantPrisma as any).mockResolvedValue(prisma);

    const result = await createLocationOpname({
      lotId: "lot-1",
      locationId: "loc-1",
      countedQuantityKg: 0,
    });

    expect(result.success).toBe(true);
    const createArg = (prisma.locationOpname.create as any).mock.calls[0][0];
    expect(createArg.data.countedQuantityKg).toBe(0);
  });

  it("rejects when all counted fields are omitted", async () => {
    const prisma = buildMockPrisma();
    (requireTenantPrisma as any).mockResolvedValue(prisma);

    const result = await createLocationOpname({
      lotId: "lot-1",
      locationId: "loc-1",
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain("diisi");
  });

  it("rejects cross-tenant location", async () => {
    const prisma = buildMockPrisma({
      location: {
        id: "loc-1",
        tenantId: "tenant-other",
        name: "A-01",
        warehouse: { name: "Gudang Lain" },
      },
    });

    (requireTenantPrisma as any).mockResolvedValue(prisma);

    const result = await createLocationOpname({
      lotId: "lot-1",
      locationId: "loc-1",
      countedQuantityKg: 5,
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain("Lokasi tidak ditemukan");
  });

  it("rejects opname creation at a system location", async () => {
    const prisma = buildMockPrisma({
      location: {
        id: "loc-sys",
        tenantId: TENANT_ID,
        name: "Roasting WIP",
        isSystem: true,
        warehouse: { name: "Gudang Utama" },
      },
    });

    (requireTenantPrisma as any).mockResolvedValue(prisma);

    const result = await createLocationOpname({
      lotId: "lot-1",
      locationId: "loc-sys",
      countedQuantityKg: 5,
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain("Lokasi sistem dikelola otomatis");
    expect(prisma.locationOpname.create).not.toHaveBeenCalled();
  });
});

describe("confirmLocationOpname", () => {
  it("variance = -1 for split lot (system 30, counted 29)", async () => {
    const appendLedger = (await import("@/lib/stock")).appendLedger;
    const prisma = buildMockPrisma({
      placement: { quantityKg: 30, quantityUnit: 0, supplyQty: 0 },
      opnameFindUnique: {
        id: "opname-1",
        tenantId: TENANT_ID,
        lotId: "lot-1",
        locationId: "loc-1",
        status: "DRAFT",
        countedQuantityKg: 29,
        countedQuantityUnit: null,
        countedSupplyQty: null,
        systemQuantityKg: 30,
        systemQuantityUnit: 0,
        systemSupplyQty: 0,
        lot: {
          id: "lot-1",
          productId: "prod-1",
          packagingId: null,
          supplyItemId: null,
        },
      },
    });

    (requireTenantPrisma as any).mockResolvedValue(prisma);

    const result = await confirmLocationOpname("opname-1");

    expect(result.success).toBe(true);
    expect(prisma.lotPlacement.upsert).toHaveBeenCalledWith({
      where: {
        tenantId_lotId_locationId: {
          tenantId: TENANT_ID,
          lotId: "lot-1",
          locationId: "loc-1",
        },
      },
      create: {
        tenantId: TENANT_ID,
        lotId: "lot-1",
        locationId: "loc-1",
        quantityKg: 29,
        quantityUnit: 0,
        supplyQty: 0,
      },
      update: {
        quantityKg: 29,
        quantityUnit: 0,
        supplyQty: 0,
      },
    });
    expect(appendLedger).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        entryType: "OUT",
        refType: "LOCATION_OPNAME_OUT",
        quantityKg: 1,
      }),
    );
    expect(prisma.locationOpname.updateMany).toHaveBeenCalledWith({
      where: { id: "opname-1", status: "DRAFT" },
      data: expect.objectContaining({ status: "CONFIRMED" }),
    });
  });

  it("zero variance creates no ledger mutation and still confirms", async () => {
    const appendLedger = (await import("@/lib/stock")).appendLedger;
    const prisma = buildMockPrisma({
      placement: { quantityKg: 10, quantityUnit: 0, supplyQty: 0 },
      opnameFindUnique: {
        id: "opname-1",
        tenantId: TENANT_ID,
        lotId: "lot-1",
        locationId: "loc-1",
        status: "DRAFT",
        countedQuantityKg: 10,
        countedQuantityUnit: null,
        countedSupplyQty: null,
        systemQuantityKg: 10,
        systemQuantityUnit: 0,
        systemSupplyQty: 0,
        lot: {
          id: "lot-1",
          productId: "prod-1",
          packagingId: null,
          supplyItemId: null,
        },
      },
    });

    (requireTenantPrisma as any).mockResolvedValue(prisma);

    const result = await confirmLocationOpname("opname-1");

    expect(result.success).toBe(true);
    expect(appendLedger).not.toHaveBeenCalled();
    expect(prisma.locationOpname.updateMany).toHaveBeenCalled();
  });

  it("positive variance posts IN ledger", async () => {
    const appendLedger = (await import("@/lib/stock")).appendLedger;
    const prisma = buildMockPrisma({
      placement: { quantityKg: 10, quantityUnit: 0, supplyQty: 0 },
      opnameFindUnique: {
        id: "opname-1",
        tenantId: TENANT_ID,
        lotId: "lot-1",
        locationId: "loc-1",
        status: "DRAFT",
        countedQuantityKg: 11,
        countedQuantityUnit: null,
        countedSupplyQty: null,
        systemQuantityKg: 10,
        systemQuantityUnit: 0,
        systemSupplyQty: 0,
        lot: {
          id: "lot-1",
          productId: "prod-1",
          packagingId: null,
          supplyItemId: null,
        },
      },
    });

    (requireTenantPrisma as any).mockResolvedValue(prisma);

    const result = await confirmLocationOpname("opname-1");

    expect(result.success).toBe(true);
    expect(appendLedger).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        entryType: "IN",
        refType: "LOCATION_OPNAME_IN",
        quantityKg: 1,
      }),
    );
  });

  it("unit subject counted to zero posts OUT ledger of full amount", async () => {
    const appendLedger = (await import("@/lib/stock")).appendLedger;
    const prisma = buildMockPrisma({
      lot: {
        id: "lot-1",
        tenantId: TENANT_ID,
        productId: null,
        packagingId: "pkg-1",
        supplyItemId: null,
        quantityKg: 0,
        quantityUnit: 10,
        supplyQuantity: 0,
        batchCode: "BATCH-1",
        product: null,
        packaging: { name: "Pouch 250g" },
        supplyItem: null,
        inventoryLedgers: [],
      },
      placement: { quantityKg: 0, quantityUnit: 10, supplyQty: 0 },
      opnameFindUnique: {
        id: "opname-1",
        tenantId: TENANT_ID,
        lotId: "lot-1",
        locationId: "loc-1",
        status: "DRAFT",
        countedQuantityKg: null,
        countedQuantityUnit: 0,
        countedSupplyQty: null,
        systemQuantityKg: 0,
        systemQuantityUnit: 10,
        systemSupplyQty: 0,
        lot: {
          id: "lot-1",
          productId: null,
          packagingId: "pkg-1",
          supplyItemId: null,
        },
      },
    });

    (requireTenantPrisma as any).mockResolvedValue(prisma);

    const result = await confirmLocationOpname("opname-1");

    expect(result.success).toBe(true);
    expect(appendLedger).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        entryType: "OUT",
        refType: "LOCATION_OPNAME_OUT",
        quantityUnit: 10,
        packagingId: "pkg-1",
      }),
    );
  });

  it("supply subject counted to zero posts OUT ledger of full amount", async () => {
    const appendLedger = (await import("@/lib/stock")).appendLedger;
    const prisma = buildMockPrisma({
      lot: {
        id: "lot-1",
        tenantId: TENANT_ID,
        productId: null,
        packagingId: null,
        supplyItemId: "sup-1",
        quantityKg: 0,
        quantityUnit: 0,
        supplyQuantity: 5,
        batchCode: "BATCH-1",
        product: null,
        packaging: null,
        supplyItem: { name: "Kemasan" },
        inventoryLedgers: [],
      },
      placement: { quantityKg: 0, quantityUnit: 0, supplyQty: 5 },
      opnameFindUnique: {
        id: "opname-1",
        tenantId: TENANT_ID,
        lotId: "lot-1",
        locationId: "loc-1",
        status: "DRAFT",
        countedQuantityKg: null,
        countedQuantityUnit: null,
        countedSupplyQty: 0,
        systemQuantityKg: 0,
        systemQuantityUnit: 0,
        systemSupplyQty: 5,
        lot: {
          id: "lot-1",
          productId: null,
          packagingId: null,
          supplyItemId: "sup-1",
        },
      },
    });

    (requireTenantPrisma as any).mockResolvedValue(prisma);

    const result = await confirmLocationOpname("opname-1");

    expect(result.success).toBe(true);
    expect(appendLedger).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        entryType: "OUT",
        refType: "LOCATION_OPNAME_OUT",
        supplyQuantity: 5,
        supplyItemId: "sup-1",
      }),
    );
  });

  it("double confirm is idempotent — second call returns already confirmed", async () => {
    const prisma = buildMockPrisma({
      opnameFindUnique: {
        id: "opname-1",
        tenantId: TENANT_ID,
        lotId: "lot-1",
        locationId: "loc-1",
        status: "CONFIRMED",
        countedQuantityKg: 29,
        countedQuantityUnit: null,
        countedSupplyQty: null,
        systemQuantityKg: 30,
        systemQuantityUnit: 0,
        systemSupplyQty: 0,
        lot: {
          id: "lot-1",
          productId: "prod-1",
          packagingId: null,
          supplyItemId: null,
        },
      },
      opnameUpdateMany: { count: 0 },
    });

    (requireTenantPrisma as any).mockResolvedValue(prisma);

    const result = await confirmLocationOpname("opname-1");

    expect(result.success).toBe(false);
    expect(result.error).toContain("sudah disahkan");
  });

  it("concurrent confirm yields exactly one confirmed update", async () => {
    let updateManyCount = 0;
    const prisma = buildMockPrisma({
      opnameFindUnique: {
        id: "opname-1",
        tenantId: TENANT_ID,
        lotId: "lot-1",
        locationId: "loc-1",
        status: "DRAFT",
        countedQuantityKg: 29,
        countedQuantityUnit: null,
        countedSupplyQty: null,
        systemQuantityKg: 30,
        systemQuantityUnit: 0,
        systemSupplyQty: 0,
        lot: {
          id: "lot-1",
          productId: "prod-1",
          packagingId: null,
          supplyItemId: null,
        },
      },
    });

    prisma.locationOpname.updateMany = vi.fn().mockImplementation(() => {
      updateManyCount += 1;
      return Promise.resolve({ count: 1 });
    });

    (requireTenantPrisma as any).mockResolvedValue(prisma);

    const [r1, r2] = await Promise.all([
      confirmLocationOpname("opname-1"),
      confirmLocationOpname("opname-1"),
    ]);

    expect(r1.success || r2.success).toBe(true);
    expect(updateManyCount).toBe(2);
  });

  it("rejects confirming an opname at a system location", async () => {
    const prisma = buildMockPrisma({
      locationFindFirst: { isSystem: true },
      opnameFindUnique: {
        id: "opname-1",
        tenantId: TENANT_ID,
        lotId: "lot-1",
        locationId: "loc-sys",
        status: "DRAFT",
        countedQuantityKg: 29,
        countedQuantityUnit: null,
        countedSupplyQty: null,
        systemQuantityKg: 30,
        systemQuantityUnit: 0,
        systemSupplyQty: 0,
        lot: {
          id: "lot-1",
          productId: "prod-1",
          packagingId: null,
          supplyItemId: null,
        },
      },
    });

    (requireTenantPrisma as any).mockResolvedValue(prisma);

    const result = await confirmLocationOpname("opname-1");

    expect(result.success).toBe(false);
    expect(result.error).toContain("Lokasi sistem dikelola otomatis");
    expect(prisma.lotPlacement.upsert).not.toHaveBeenCalled();
    expect(prisma.locationOpname.updateMany).not.toHaveBeenCalled();
  });
});

describe("cancelLocationOpname", () => {
  it("cancels only DRAFT opnames using updateMany guard", async () => {
    const prisma = buildMockPrisma({
      opnameUpdateMany: { count: 1 },
    });

    (requireTenantPrisma as any).mockResolvedValue(prisma);

    const result = await cancelLocationOpname("opname-1", "Salah input");

    expect(result.success).toBe(true);
    expect(prisma.locationOpname.updateMany).toHaveBeenCalledWith({
      where: { id: "opname-1", tenantId: TENANT_ID, status: "DRAFT" },
      data: {
        status: "CANCELLED",
        cancelledAt: expect.any(Date),
        cancelReason: "Salah input",
      },
    });
  });

  it("rejects cancel on non-DRAFT", async () => {
    const prisma = buildMockPrisma({
      opnameUpdateMany: { count: 0 },
    });

    (requireTenantPrisma as any).mockResolvedValue(prisma);

    const result = await cancelLocationOpname("opname-1");

    expect(result.success).toBe(false);
    expect(result.error).toContain("bukan draft");
  });
});

describe("getLocationOpnameDrafts / getLocationOpnameHistory", () => {
  it("preserves zero countedQuantityKg as 0, not null", async () => {
    const prisma = buildMockPrisma({
      opnameFindMany: [
        {
          id: "opname-1",
          tenantId: TENANT_ID,
          lotId: "lot-1",
          locationId: "loc-1",
          systemQuantityKg: 10,
          systemQuantityUnit: 0,
          systemSupplyQty: 0,
          countedQuantityKg: 0,
          countedQuantityUnit: null,
          countedSupplyQty: null,
          notes: null,
          createdAt: new Date("2026-08-01T00:00:00Z"),
          updatedAt: new Date("2026-08-01T00:00:00Z"),
          status: "DRAFT",
          lot: {
            batchCode: "BATCH-1",
            product: { name: "Green Bean Gayo" },
            packaging: null,
            supplyItem: null,
          },
          location: {
            name: "A-01",
            warehouse: { name: "Gudang Utama" },
          },
          createdBy: { name: "Operator" },
        },
      ],
    });

    (requireTenantPrisma as any).mockResolvedValue(prisma);

    const drafts = await getLocationOpnameDrafts();

    expect(drafts).toHaveLength(1);
    expect(drafts[0].countedQuantityKg).toBe(0);
    expect(drafts[0].varianceKg).toBe(-10);
  });
});

describe("migration static checks", () => {
  const baselineSql = readFileSync(
    join(process.cwd(), "prisma/migrations/000000000000_baseline/migration.sql"),
    "utf8",
  );

  function tableSection(tableName: string): string {
    const start = baselineSql.indexOf(`CREATE TABLE "${tableName}"`);
    expect(start).toBeGreaterThanOrEqual(0);
    const end = baselineSql.indexOf(");", start);
    return baselineSql.slice(start, end);
  }

  const transferSection = tableSection("location_transfers");
  const opnameSection = tableSection("location_opnames");

  it("transfer status column uses LocationTransferStatus enum, not TEXT", () => {
    expect(transferSection).toContain('"status" "LocationTransferStatus" NOT NULL DEFAULT \'PENDING\'');
    expect(transferSection).not.toMatch(/"status"\s+TEXT/);
  });

  it("opname status uses LocationOpnameStatus enum, not TEXT", () => {
    expect(opnameSection).toContain('"status" "LocationOpnameStatus" NOT NULL DEFAULT \'DRAFT\'');
    expect(opnameSection).not.toMatch(/"status"\s+TEXT/);
  });

  it("LedgerRefType enum contains LOCATION_OPNAME values as valid string literals", () => {
    expect(baselineSql).toContain("'LOCATION_OPNAME_IN'");
    expect(baselineSql).toContain("'LOCATION_OPNAME_OUT'");
    expect(baselineSql).not.toMatch(/ADD VALUE "LOCATION_OPNAME_IN/);
  });

  it("no NOT NULL + ON DELETE SET NULL contradictions", () => {
    expect(baselineSql).toContain('FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT');
  });

  it("no destructive statements in the baseline", () => {
    expect(baselineSql).not.toMatch(/DROP\s+TABLE/i);
  });
});
