import { describe, expect, it, vi, beforeEach } from "vitest";

const TENANT_ID = "tenant-1";

vi.mock("@/lib/auth", () => ({
  requireRole: vi.fn().mockResolvedValue({ tenantId: TENANT_ID, id: "user-1" }),
  requireTenantPrisma: vi.fn(),
}));

vi.mock("@/lib/audit", () => ({
  recordAudit: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

const { requireTenantPrisma } = await import("@/lib/auth");
const {
  createLocation,
  updateLocation,
  toggleLocationActive,
} = await import("./actions");

beforeEach(() => {
  vi.clearAllMocks();
});

function buildMockPrisma(overrides: {
  existing?: { tenantId: string; isSystem: boolean; code: string } | null;
} = {}) {
  const existing =
    overrides.existing ?? { tenantId: TENANT_ID, isSystem: false, code: "A-01" };

  const tx: any = {
    location: {
      create: vi.fn().mockResolvedValue({ id: "loc-1" }),
      update: vi.fn().mockResolvedValue({ id: "loc-1" }),
    },
  };

  const prisma: any = {
    location: {
      findUnique: vi.fn().mockResolvedValue(existing),
    },
    $transaction: vi.fn(async (cb: (t: any) => Promise<any>) => cb(tx)),
  };

  return { prisma, tx };
}

describe("updateLocation", () => {
  it("rejects updating a system location", async () => {
    const { prisma, tx } = buildMockPrisma({
      existing: { tenantId: TENANT_ID, isSystem: true, code: "SYS-ROASTING-WIP" },
    });
    (requireTenantPrisma as any).mockResolvedValue(prisma);

    const result = await updateLocation("loc-sys", {
      warehouseId: "wh-1",
      code: "SYS-ROASTING-WIP",
      name: "Renamed",
    });

    expect(result.success).toBe(false);
    expect((result as any).error).toContain("Lokasi sistem dikelola otomatis");
    expect(tx.location.update).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("rejects renaming a normal location to a reserved SYS- code", async () => {
    const { prisma, tx } = buildMockPrisma();
    (requireTenantPrisma as any).mockResolvedValue(prisma);

    const result = await updateLocation("loc-1", {
      warehouseId: "wh-1",
      code: "SYS-ROASTING-WIP",
      name: "Biasa",
    });

    expect(result.success).toBe(false);
    expect((result as any).error).toContain("dicadangkan");
    expect(tx.location.update).not.toHaveBeenCalled();
  });

  it("allows updating a normal location", async () => {
    const { prisma, tx } = buildMockPrisma();
    (requireTenantPrisma as any).mockResolvedValue(prisma);

    const result = await updateLocation("loc-1", {
      warehouseId: "wh-1",
      code: "A-01",
      name: "Rak A",
    });

    expect(result.success).toBe(true);
    expect(tx.location.update).toHaveBeenCalled();
  });

  it("rejects a location that does not belong to the tenant", async () => {
    const { prisma } = buildMockPrisma({
      existing: { tenantId: "tenant-other", isSystem: false, code: "A-01" },
    });
    (requireTenantPrisma as any).mockResolvedValue(prisma);

    const result = await updateLocation("loc-1", {
      warehouseId: "wh-1",
      code: "A-01",
      name: "Rak A",
    });

    expect(result.success).toBe(false);
    expect((result as any).error).toContain("Lokasi tidak ditemukan");
  });
});

describe("toggleLocationActive", () => {
  it("rejects deactivating a system location", async () => {
    const { prisma, tx } = buildMockPrisma({
      existing: { tenantId: TENANT_ID, isSystem: true, code: "SYS-ROASTING-WIP" },
    });
    (requireTenantPrisma as any).mockResolvedValue(prisma);

    const result = await toggleLocationActive("loc-sys", false);

    expect(result.success).toBe(false);
    expect((result as any).error).toContain("Lokasi sistem dikelola otomatis");
    expect(tx.location.update).not.toHaveBeenCalled();
  });

  it("rejects reactivating a system location", async () => {
    const { prisma, tx } = buildMockPrisma({
      existing: { tenantId: TENANT_ID, isSystem: true, code: "SYS-ROASTING-WIP" },
    });
    (requireTenantPrisma as any).mockResolvedValue(prisma);

    const result = await toggleLocationActive("loc-sys", true);

    expect(result.success).toBe(false);
    expect(tx.location.update).not.toHaveBeenCalled();
  });

  it("allows toggling a normal location", async () => {
    const { prisma, tx } = buildMockPrisma();
    (requireTenantPrisma as any).mockResolvedValue(prisma);

    const result = await toggleLocationActive("loc-1", false);

    expect(result.success).toBe(true);
    expect(tx.location.update).toHaveBeenCalledWith({
      where: { id: "loc-1" },
      data: { isActive: false },
    });
  });
});

describe("createLocation", () => {
  it("rejects creating a location with a reserved SYS- code", async () => {
    const { prisma, tx } = buildMockPrisma();
    (requireTenantPrisma as any).mockResolvedValue(prisma);

    const result = await createLocation({
      warehouseId: "wh-1",
      code: "SYS-ROASTING-WIP",
      name: "WIP Palsu",
    });

    expect(result.success).toBe(false);
    expect((result as any).error).toContain("dicadangkan");
    expect(tx.location.create).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("allows creating a normal location", async () => {
    const { prisma, tx } = buildMockPrisma();
    (requireTenantPrisma as any).mockResolvedValue(prisma);

    const result = await createLocation({
      warehouseId: "wh-1",
      code: "B-02",
      name: "Rak B",
    });

    expect(result.success).toBe(true);
    expect(tx.location.create).toHaveBeenCalled();
  });
});
