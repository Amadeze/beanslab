import { describe, expect, it, vi, beforeEach } from "vitest";

const TENANT_ID = "tenant-1";

vi.mock("@/lib/auth", () => ({
  requireRole: vi.fn(),
  requireTenantPrisma: vi.fn(),
  getCurrentTenantId: vi.fn().mockResolvedValue("tenant-1"),
  getSystemUserId: vi.fn().mockResolvedValue("user-1"),
}));

vi.mock("@/lib/audit", () => ({
  recordAudit: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

const { requireTenantPrisma } = await import("@/lib/auth");
const { placeLot, removePlacement } = await import("./lot-placement");

beforeEach(() => {
  vi.clearAllMocks();
});

function buildMockPrisma(overrides: {
  destinationIsSystem?: boolean;
  noDestination?: boolean;
  lot?: any;
  existingPlacement?: any;
  placements?: any[];
} = {}) {
  const tx: any = {
    lot: {
      findUnique: vi.fn().mockResolvedValue(overrides.lot ?? {
        id: "lot-1",
        tenantId: TENANT_ID,
        quantityKg: 100,
        quantityUnit: 0,
        supplyQuantity: 0,
        productId: "prod-1",
        packagingId: null,
        supplyItemId: null,
        consumedAt: null,
        expiryDate: null,
        inventoryLedgers: [],
      }),
    },
    location: {
      findFirst: vi.fn().mockResolvedValue(
        overrides.noDestination
          ? null
          : { isSystem: overrides.destinationIsSystem === true },
      ),
    },
    lotPlacement: {
      findFirst: vi.fn().mockResolvedValue(overrides.existingPlacement ?? {
        quantityKg: 0,
        quantityUnit: 0,
        supplyQty: 0,
      }),
      findMany: vi.fn().mockResolvedValue(overrides.placements ?? []),
      upsert: vi.fn().mockResolvedValue({}),
      deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
  };

  const prisma: any = {
    $transaction: vi.fn(async (cb: (t: any) => Promise<any>) => cb(tx)),
  };

  return { prisma, tx };
}

describe("placeLot", () => {
  it("rejects placing stock into a system location", async () => {
    const { prisma, tx } = buildMockPrisma({ destinationIsSystem: true });
    (requireTenantPrisma as any).mockResolvedValue(prisma);

    const result = await placeLot({
      lotId: "lot-1",
      locationId: "loc-sys",
      quantityKg: 10,
    });

    expect(result.success).toBe(false);
    expect((result as any).error).toContain("Lokasi sistem dikelola otomatis");
    expect(tx.lotPlacement.upsert).not.toHaveBeenCalled();
  });

  it("allows placing stock into a normal location", async () => {
    const { prisma, tx } = buildMockPrisma();
    (requireTenantPrisma as any).mockResolvedValue(prisma);

    const result = await placeLot({
      lotId: "lot-1",
      locationId: "loc-1",
      quantityKg: 10,
    });

    expect(result.success).toBe(true);
    expect(tx.lotPlacement.upsert).toHaveBeenCalled();
  });
});

describe("placeLot — supply lots", () => {
  // Supply lot memakai supplyQuantity (bukan quantityUnit). Sisa tersedia:
  // 50 (IN) - 20 (OUT) = 30.
  function buildSupplyLot() {
    return {
      id: "lot-sup",
      tenantId: TENANT_ID,
      quantityKg: 0,
      quantityUnit: 0,
      supplyQuantity: 50,
      productId: null,
      packagingId: null,
      supplyItemId: "sup-1",
      consumedAt: null,
      expiryDate: null,
      inventoryLedgers: [
        { entryType: "IN", quantityKg: 0, quantityUnit: 0, supplyQuantity: 50 },
        { entryType: "OUT", quantityKg: 0, quantityUnit: 0, supplyQuantity: 20 },
      ],
    };
  }

  it("places supply stock against the supply-specific remaining quantity", async () => {
    const { prisma, tx } = buildMockPrisma({ lot: buildSupplyLot() });
    (requireTenantPrisma as any).mockResolvedValue(prisma);

    const result = await placeLot({
      lotId: "lot-sup",
      locationId: "loc-1",
      supplyQty: 30,
    });

    expect(result.success).toBe(true);
    expect(tx.lotPlacement.upsert).toHaveBeenCalled();
  });

  it("allows partially placing and re-placing supply stock within the remaining balance", async () => {
    const { prisma, tx } = buildMockPrisma({
      lot: buildSupplyLot(),
      existingPlacement: { quantityKg: 0, quantityUnit: 0, supplyQty: 10 },
      placements: [{ quantityKg: 0, quantityUnit: 0, supplyQty: 10 }],
    });
    (requireTenantPrisma as any).mockResolvedValue(prisma);

    const result = await placeLot({
      lotId: "lot-sup",
      locationId: "loc-1",
      supplyQty: 25,
    });

    expect(result.success).toBe(true);
    const upsertCall = tx.lotPlacement.upsert.mock.calls[0][0];
    expect(upsertCall.update.supplyQty).toBe(25);
  });

  it("rejects placing more than the remaining supply stock", async () => {
    const { prisma, tx } = buildMockPrisma({ lot: buildSupplyLot() });
    (requireTenantPrisma as any).mockResolvedValue(prisma);

    const result = await placeLot({
      lotId: "lot-sup",
      locationId: "loc-1",
      supplyQty: 31,
    });

    expect(result.success).toBe(false);
    expect((result as any).error).toContain("melebihi");
    expect(tx.lotPlacement.upsert).not.toHaveBeenCalled();
  });

  it("rejects relocation that would push total placements past the remaining balance", async () => {
    const { prisma } = buildMockPrisma({
      lot: buildSupplyLot(),
      placements: [
        { quantityKg: 0, quantityUnit: 0, supplyQty: 20 }, // lokasi lain
      ],
    });
    (requireTenantPrisma as any).mockResolvedValue(prisma);

    const result = await placeLot({
      lotId: "lot-sup",
      locationId: "loc-2",
      supplyQty: 15, // total 35 > sisa 30
    });

    expect(result.success).toBe(false);
    expect((result as any).error).toContain("melebihi");
  });
});

describe("removePlacement", () => {
  it("rejects removing a placement at a system location", async () => {
    const { prisma, tx } = buildMockPrisma({ destinationIsSystem: true });
    (requireTenantPrisma as any).mockResolvedValue(prisma);

    const result = await removePlacement("lot-1", "loc-sys");

    expect(result.success).toBe(false);
    expect((result as any).error).toContain("Lokasi sistem dikelola otomatis");
    expect(tx.lotPlacement.deleteMany).not.toHaveBeenCalled();
  });

  it("allows removing a placement at a normal location", async () => {
    const { prisma, tx } = buildMockPrisma();
    (requireTenantPrisma as any).mockResolvedValue(prisma);

    const result = await removePlacement("lot-1", "loc-1");

    expect(result.success).toBe(true);
    expect(tx.lotPlacement.deleteMany).toHaveBeenCalled();
  });
});
