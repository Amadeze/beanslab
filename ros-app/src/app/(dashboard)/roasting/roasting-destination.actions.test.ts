import { describe, expect, it, vi, beforeEach } from "vitest";

const TENANT_ID = "tenant-1";
const USER_ID = "user-1";

vi.mock("@/lib/auth", () => ({
  requireRole: vi.fn().mockResolvedValue({ tenantId: TENANT_ID, id: USER_ID }),
  requireTenantPrisma: vi.fn(),
  getCurrentTenantId: vi.fn().mockResolvedValue(TENANT_ID),
  getSystemUserId: vi.fn().mockResolvedValue(USER_ID),
}));

vi.mock("@/lib/audit", () => ({
  recordAudit: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/roast-lifecycle", () => ({
  reserveRoastMaterialsInTx: vi.fn().mockResolvedValue({}),
  chargeRoastMaterialsInTx: vi.fn().mockResolvedValue({}),
  completeRoastInTx: vi.fn().mockResolvedValue({
    alreadyCompleted: false,
    batchCode: "RST-TEST-1",
    actualOutputKg: 6.8,
    outcome: { status: "OK" },
  }),
  cancelRoastInTx: vi.fn(),
  abortRoastInTx: vi.fn(),
}));

vi.mock("@/lib/posting", () => ({
  postVoidReversal: vi.fn(),
}));

const { requireRole, requireTenantPrisma } = await import("@/lib/auth");
const { completeRoastInTx } = await import("@/lib/roast-lifecycle");
const {
  completeParentRoastingBatch,
  createParentRoastingBatch,
  fetchRoastingLocationOptions,
} = await import("./actions");

beforeEach(() => {
  vi.clearAllMocks();
  (requireRole as any).mockResolvedValue({ tenantId: TENANT_ID, id: USER_ID });
});

describe("ARTISAN completion passes the selected destination through", () => {
  it("forwards destinationLocationId to completeRoastInTx", async () => {
    (requireTenantPrisma as any).mockResolvedValue({
      $transaction: async (cb: (tx: any) => Promise<any>) => cb({}),
    });

    const result = await completeParentRoastingBatch("batch-1", 6.8, "loc-2");

    expect(result.success).toBe(true);
    expect(completeRoastInTx).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        tenantId: TENANT_ID,
        userId: USER_ID,
        batchId: "batch-1",
        actualOutputKg: 6.8,
        destinationLocationId: "loc-2",
        source: "WEB",
      }),
    );
  });

  it("forwards undefined when no destination was chosen", async () => {
    (requireTenantPrisma as any).mockResolvedValue({
      $transaction: async (cb: (tx: any) => Promise<any>) => cb({}),
    });

    await completeParentRoastingBatch("batch-1", 6.8, undefined);

    expect(completeRoastInTx).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        batchId: "batch-1",
        destinationLocationId: undefined,
      }),
    );
  });
});

describe("MANUAL creation/completion passes the selected destination through", () => {
  it("forwards destinationLocationId to completeRoastInTx during create", async () => {
    const gb = {
      id: "gb-1",
      name: "Gayo",
      type: "GREEN_BEAN",
      category: "ARABICA",
      origin: "Gayo",
      description: null,
      imageUrl: null,
      isActive: true,
      stockKg: 10,
      avgCostPerKg: 100_000,
      coffeeSourceId: null,
    };
    const rb = { id: "rb-1", name: "Gayo Medium", type: "ROASTED_BEAN" };
    const tx: any = {
      product: {
        findUnique: vi.fn(async ({ where }: any) =>
          where.id === "gb-1" ? gb : where.id === "rb-1" ? rb : null,
        ),
      },
      parentRoastingBatch: {
        create: vi.fn(async (args: any) => ({ id: "batch-1", code: args.data.code })),
        findMany: vi.fn().mockResolvedValue([]),
      },
      machine: { findUnique: vi.fn() },
    };
    const prisma: any = {
      parentRoastingBatch: {
        findFirst: vi.fn().mockResolvedValue(null),
      },
      $transaction: vi.fn(async (cb: (t: any) => Promise<any>) => cb(tx)),
    };
    (requireTenantPrisma as any).mockResolvedValue(prisma);

    const result = await createParentRoastingBatch({
      operationKey: "a1b2c3d4-5e6f-4789-8abc-1234567890ab",
      mode: "MANUAL",
      inputProductId: "gb-1",
      targetWeightKg: 10,
      outputMode: "existing",
      outputProductId: "rb-1",
      outputRoastLevel: "MEDIUM",
      actualOutputKg: 6.8,
      destinationLocationId: "loc-9",
    });

    expect(result.success).toBe(true);
    expect(completeRoastInTx).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        batchId: "batch-1",
        actualOutputKg: 6.8,
        destinationLocationId: "loc-9",
        source: "MANUAL",
      }),
    );
  });
});

describe("roasting location projection", () => {
  it("filters active non-system locations and orders like the server default", async () => {
    const findMany = vi.fn().mockResolvedValue([
      {
        id: "loc-1",
        code: "A-01",
        name: "Penyimpanan Utama",
        isDefault: true,
        warehouse: { name: "Gudang Utama" },
      },
      {
        id: "loc-2",
        code: "B-02",
        name: "Rak RB",
        isDefault: false,
        warehouse: { name: "Gudang Utama" },
      },
    ]);
    (requireTenantPrisma as any).mockResolvedValue({ location: { findMany } });

    const options = await fetchRoastingLocationOptions();

    expect(findMany).toHaveBeenCalledWith({
      where: { isActive: true, isSystem: false },
      select: {
        id: true,
        code: true,
        name: true,
        isDefault: true,
        warehouse: { select: { name: true } },
      },
      orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
    });
    expect(options).toEqual([
      {
        id: "loc-1",
        code: "A-01",
        name: "Penyimpanan Utama",
        warehouseName: "Gudang Utama",
        isDefault: true,
      },
      {
        id: "loc-2",
        code: "B-02",
        name: "Rak RB",
        warehouseName: "Gudang Utama",
        isDefault: false,
      },
    ]);
  });
});