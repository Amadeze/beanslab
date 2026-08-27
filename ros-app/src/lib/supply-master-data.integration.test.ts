import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import {
  createSupplyItem,
  updateSupplyItem,
} from "@/app/(dashboard)/master-data/actions";

const integrationEnabled = process.env.RUN_INTEGRATION === "true";
const suite = integrationEnabled ? describe : describe.skip;

const TENANT_A = "tenant-sup-a";
const TENANT_B = "tenant-sup-b";

const authState = vi.hoisted(() => ({ tenantId: "tenant-sup-a" }));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

vi.mock("@/lib/auth", async () => {
  return {
    requireRole: vi.fn(async () => ({
      id: "user-" + authState.tenantId,
      tenantId: authState.tenantId,
      role: "OWNER" as const,
    })),
    requireTenantPrisma: vi.fn(async () => prisma),
    getCurrentTenantId: vi.fn(async () => authState.tenantId),
  };
});

async function createTestTenant(tenantId: string) {
  await prisma.tenant.upsert({
    where: { id: tenantId },
    update: {},
    create: { id: tenantId, code: tenantId, name: "Test Tenant " + tenantId },
  });
  await prisma.user.upsert({
    where: { id: "user-" + tenantId },
    update: {},
    create: { id: "user-" + tenantId, name: "User " + tenantId, email: tenantId + "@test.local", password: "hashed", tenantId },
  });
}

const baseInput = {
  category: "OTHER" as const,
  baseUnit: "PCS" as const,
  trackLot: true,
  shelfLifeDays: null as number | null,
  consumableInProduction: false,
  includeInProductHpp: false,
  capacityGrams: null as number | null,
  tareWeightGrams: null as number | null,
  isActive: true,
  reorderAlertEnabled: false,
  leadTimeDays: 7,
  safetyStockQuantity: 0,
  reorderLookbackDays: 30,
};

const tenantAUserId = "user-" + TENANT_A;
const tenantBUserId = "user-" + TENANT_B;
const tenantIds = [TENANT_A, TENANT_B];
const tenantUserIds = [tenantAUserId, tenantBUserId];

suite("supply item master data actions (integration)", () => {
  beforeAll(async () => {
    await createTestTenant(TENANT_A);
    await createTestTenant(TENANT_B);
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { id: { in: tenantUserIds } } });
    await prisma.tenant.deleteMany({ where: { id: { in: tenantIds } } });
  });

  afterEach(async () => {
    await prisma.packaging.deleteMany({
      where: { tenantId: { in: tenantIds }, code: { startsWith: "PKG-" } },
    });
    await prisma.inventorySupplyItem.deleteMany({
      where: { tenantId: { in: tenantIds } },
    });
  });

  it("creates a supply item with an auto SUP-### code and sane defaults", async () => {
    authState.tenantId = TENANT_A;
    const result = await createSupplyItem({
      ...baseInput,
      name: "Zipper Bag 250g",
      category: "PACKAGING",
      costPerUnit: 2000,
      includeInProductHpp: true,
      capacityGrams: 250,
      tareWeightGrams: 12,
      reorderAlertEnabled: true,
      safetyStockQuantity: 5,
    });

    expect(result.success).toBe(true);
    expect(result.success && result.code).toMatch(/^SUP-\d{3}$/);

    const row = await prisma.inventorySupplyItem.findUnique({
      where: {
        tenantId_code: {
          tenantId: TENANT_A,
          code: result.success ? result.code : "",
        },
      },
    });
    expect(row).not.toBeNull();
    expect(row?.name).toBe("Zipper Bag 250g");
    expect(row?.category).toBe("PACKAGING");
    expect(row?.stockQuantity.toNumber()).toBe(0);
    expect(row?.avgCostPerUnit?.toNumber()).toBe(0);

    const adapter = await prisma.packaging.findUnique({
      where: { supplyItemId: row!.id },
    });
    expect(adapter).not.toBeNull();
    expect(adapter?.code).toMatch(/^PKG-\d{3}$/);
    expect(adapter?.name).toBe("Zipper Bag 250g");
    expect(adapter?.weightGrams.toNumber()).toBe(12);
    expect(adapter?.costPerUnit.toNumber()).toBe(2000);
    expect(adapter?.stockUnit).toBe(0);
  });

  it("does not create a Packaging adapter for non-PACKAGING categories", async () => {
    authState.tenantId = TENANT_A;
    const result = await createSupplyItem({
      ...baseInput,
      name: "Sirup Karamel",
      category: "INGREDIENT",
      costPerUnit: 40000,
    });
    expect(result.success).toBe(true);

    const row = await prisma.inventorySupplyItem.findUnique({
      where: {
        tenantId_code: {
          tenantId: TENANT_A,
          code: result.success ? result.code : "",
        },
      },
    });
    expect(row).not.toBeNull();
    const adapter = await prisma.packaging.findFirst({
      where: { supplyItemId: row!.id },
    });
    expect(adapter).toBeNull();
  });

  it("rejects duplicate names insensitive case", async () => {
    authState.tenantId = TENANT_A;
    const first = await createSupplyItem({ ...baseInput, name: "Label 60x40", costPerUnit: 500 });
    expect(first.success).toBe(true);

    const second = await createSupplyItem({ ...baseInput, name: "label 60x40", costPerUnit: 500 });
    expect(second.success).toBe(false);
    expect(!second.success && second.error).toContain("sudah terdaftar");
  });

  it("updates behavior and reorder fields without changing code", async () => {
    authState.tenantId = TENANT_A;
    const created = await createSupplyItem({
      ...baseInput,
      name: "Sirup Vanilla",
      category: "INGREDIENT",
      baseUnit: "LITER",
      shelfLifeDays: 180,
      consumableInProduction: true,
      includeInProductHpp: true,
      costPerUnit: 45000,
    });
    expect(created.success).toBe(true);
    const code = created.success ? created.code : "";

    const row = await prisma.inventorySupplyItem.findFirst({
      where: { code, tenantId: TENANT_A },
      select: { id: true },
    });
    expect(row).not.toBeNull();

    const updated = await updateSupplyItem({
      id: row!.id,
      ...baseInput,
      name: "Sirup Vanilla 60ml",
      category: "INGREDIENT",
      consumableInProduction: true,
      includeInProductHpp: true,
      costPerUnit: 47000,
      reorderAlertEnabled: true,
      leadTimeDays: 14,
      safetyStockQuantity: 3,
      reorderLookbackDays: 60,
    });
    expect(updated.success).toBe(true);
    expect(updated.success && updated.code).toBe(code);

    const after = await prisma.inventorySupplyItem.findFirst({
      where: { code, tenantId: TENANT_A },
    });
    expect(after?.name).toBe("Sirup Vanilla 60ml");
    expect(after?.baseUnit).toBe("PCS");
    expect(after?.trackLot).toBe(true);
    expect(after?.shelfLifeDays).toBeNull();
    expect(after?.reorderAlertEnabled).toBe(true);
    expect(after?.leadTimeDays).toBe(14);
    expect(after?.reorderLookbackDays).toBe(60);
  });

  it("syncs the linked Packaging adapter on update without touching stock", async () => {
    authState.tenantId = TENANT_A;
    const created = await createSupplyItem({
      ...baseInput,
      name: "Kraft Box 1kg",
      category: "PACKAGING",
      costPerUnit: 3000,
      tareWeightGrams: 45,
      capacityGrams: 1000,
    });
    expect(created.success).toBe(true);

    const supply = await prisma.inventorySupplyItem.findFirst({
      where: { tenantId: TENANT_A, name: "Kraft Box 1kg" },
      select: { id: true },
    });
    expect(supply).not.toBeNull();
    const adapterBefore = await prisma.packaging.findUnique({ where: { supplyItemId: supply!.id } });
    expect(adapterBefore).not.toBeNull();

    const updated = await updateSupplyItem({
      id: supply!.id,
      ...baseInput,
      name: "Kraft Box 1kg Premium",
      category: "PACKAGING",
      costPerUnit: 3500,
      tareWeightGrams: 50,
      capacityGrams: 1000,
      isActive: false,
    });
    expect(updated.success).toBe(true);

    const adapter = await prisma.packaging.findUnique({ where: { supplyItemId: supply!.id } });
    expect(adapter).not.toBeNull();
    expect(adapter?.id).toBe(adapterBefore?.id);
    expect(adapter?.name).toBe("Kraft Box 1kg Premium");
    expect(adapter?.weightGrams.toNumber()).toBe(50);
    expect(adapter?.costPerUnit.toNumber()).toBe(3500);
    expect(adapter?.isActive).toBe(false);
    expect(adapter?.stockUnit).toBe(0);
  });

  it("allocates per-tenant numeric sequences without cross-tenant collision", async () => {
    authState.tenantId = TENANT_A;
    const a1 = await createSupplyItem({ ...baseInput, name: "Tenant A Item", costPerUnit: 100 });
    expect(a1.success && a1.code).toMatch(/^SUP-\d{3}$/);
    const a1Code = a1.success ? a1.code : "";

    authState.tenantId = TENANT_B;
    const b1 = await createSupplyItem({ ...baseInput, name: "Tenant B Item A", costPerUnit: 100 });
    expect(b1.success && b1.code).toMatch(/^SUP-\d{3}$/);
    const b1Code = b1.success ? b1.code : "";

    const b2 = await createSupplyItem({ ...baseInput, name: "Tenant B Item B", costPerUnit: 100 });
    expect(b2.success && b2.code).toMatch(/^SUP-\d{3}$/);

    const codes = [a1, b1, b2].map((r) => (r.success ? r.code : ""));
    const rows = await prisma.inventorySupplyItem.findMany({
      where: { code: { in: codes }, tenantId: { in: tenantIds } },
      select: { code: true, tenantId: true },
    });
    expect(rows).toHaveLength(3);
    expect(new Set(rows.map((r) => r.tenantId + ":" + r.code)).size).toBe(3);
    // Different tenants can have same code numbers (per-tenant sequence)
    expect(a1Code.startsWith("SUP-")).toBe(true);
    expect(b1Code.startsWith("SUP-")).toBe(true);
  });
});