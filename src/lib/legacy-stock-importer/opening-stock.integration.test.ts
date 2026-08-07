import { afterAll, afterEach, beforeAll, describe, expect, it, vi, type TestContext } from "vitest";
import { prisma } from "@/lib/prisma";

import { applyLegacyOpeningStock } from "./apply-legacy-opening-stock";
import type { LegacyStockRawRow } from "./types";

const integrationEnabled = process.env.RUN_INTEGRATION === "true";
const suite = integrationEnabled ? describe : describe.skip;

const TENANT_A = "tenant-open-a";
const TENANT_B = "tenant-open-b";
const USERS = [`${TENANT_A}-user`, `${TENANT_B}-user`];

const authState = vi.hoisted(() => ({ tenantId: "tenant-open-a" }));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

vi.mock("@/lib/auth", () => ({
  requireRole: vi.fn(async () => ({
    id: `user-${authState.tenantId}`,
    tenantId: authState.tenantId,
    role: "OWNER" as const,
  })),
  requireTenantPrisma: vi.fn(async () => prisma),
  getCurrentTenantId: vi.fn(async () => authState.tenantId),
  getSystemUserId: vi.fn(async () => `user-${authState.tenantId}`),
}));

async function createTestTenant(tenantId: string, code: string, subdomain: string) {
  await prisma.tenant.upsert({
    where: { id: tenantId },
    update: {},
    create: {
      id: tenantId,
      code,
      name: `Open Tenant ${code}`,
      subdomain,
      subscriptionTier: "TRIAL",
      subscriptionStatus: "ACTIVE",
      isActive: true,
    },
  });
  await prisma.user.upsert({
    where: { id: `${tenantId}-user` },
    update: {},
    create: {
      id: `${tenantId}-user`,
      name: `User ${tenantId}`,
      email: `${tenantId}@open-test.local`,
      password: "hashed",
      tenantId,
    },
  });
}

function greenBeanRow(code: string, overrides: Partial<LegacyStockRawRow> = {}): LegacyStockRawRow {
  return {
    type: "GREEN_BEAN",
    code,
    name: `GB ${code}`,
    quantity: "25",
    unitCost: "12000",
    ...overrides,
  };
}

function roastedBeanRow(code: string, overrides: Partial<LegacyStockRawRow> = {}): LegacyStockRawRow {
  return {
    type: "ROASTED_BEAN",
    code,
    name: `RB ${code}`,
    quantity: "20",
    unitCost: "18000",
    ...overrides,
  };
}

function finishedGoodsRow(code: string, overrides: Partial<LegacyStockRawRow> = {}): LegacyStockRawRow {
  return {
    type: "FINISHED_GOODS",
    code,
    name: `FG ${code}`,
    quantity: "10",
    unitCost: "30000",
    ...overrides,
  };
}

function supplyRow(code: string, overrides: Partial<LegacyStockRawRow> = {}): LegacyStockRawRow {
  return {
    type: "SUPPLY",
    code,
    name: `Supply ${code}`,
    quantity: "100",
    unitCost: "2000",
    category: "INGREDIENT",
    baseUnit: "KG",
    ...overrides,
  };
}

function packagingRow(code: string, overrides: Partial<LegacyStockRawRow> = {}): LegacyStockRawRow {
  return supplyRow(code, { category: "PACKAGING", baseUnit: "PCS", ...overrides });
}

suite("legacy opening stock import — integration", () => {
  beforeAll(async () => {
    await createTestTenant(TENANT_A, "OPENA", "open-a");
    await createTestTenant(TENANT_B, "OPENB", "open-b");
  });

  afterAll(async () => {
    await prisma.inventoryLedger.deleteMany({
      where: { tenantId: { in: [TENANT_A, TENANT_B] } },
    });
    await prisma.lot.deleteMany({
      where: { tenantId: { in: [TENANT_A, TENANT_B] } },
    });
    await prisma.packaging.deleteMany({
      where: { tenantId: { in: [TENANT_A, TENANT_B] } },
    });
    await prisma.inventorySupplyItem.deleteMany({
      where: { tenantId: { in: [TENANT_A, TENANT_B] } },
    });
    await prisma.product.deleteMany({
      where: { tenantId: { in: [TENANT_A, TENANT_B] } },
    });
    await prisma.auditLog.deleteMany({
      where: { tenantId: { in: [TENANT_A, TENANT_B] } },
    });
    await prisma.user.deleteMany({ where: { id: { in: USERS } } });
    await prisma.tenant.deleteMany({ where: { id: { in: [TENANT_A, TENANT_B] } } });
  });

  afterEach(async () => {
    await prisma.inventoryLedger.deleteMany({
      where: {
        tenantId: { in: [TENANT_A, TENANT_B] },
        refType: "ADJUSTMENT_IN",
        refId: { startsWith: "OPEN-" },
      },
    });
    await prisma.lot.deleteMany({
      where: {
        batchCode: { startsWith: "OPEN-" },
      },
    });
     await prisma.product.deleteMany({
      where: {
        tenantId: { in: [TENANT_A, TENANT_B] },
        code: { startsWith: "OPEN-" },
      },
    });
    await prisma.packaging.deleteMany({
      where: {
        tenantId: { in: [TENANT_A, TENANT_B] },
        code: { startsWith: "PKG-OPEN" },
      },
    });
    await prisma.inventorySupplyItem.deleteMany({
      where: {
        tenantId: { in: [TENANT_A, TENANT_B] },
        code: { startsWith: "OPEN-SUP" },
      },
    });
  });

  it("CREATE: Green Bean + opening stock creates product and ledger", async () => {
    authState.tenantId = TENANT_A;
    const result = await applyLegacyOpeningStock({
      operationKey: "OPEN-GB-CREATE",
      tenantId: TENANT_A,
      userId: `${TENANT_A}-user`,
      rawRows: [greenBeanRow("OPEN-GB-001")],
    });

    expect(result.errors).toHaveLength(0);
    expect(result.totalRows).toBe(1);
    expect(result.createdMasters).toBe(1);
    expect(result.matchedMasters).toBe(0);
    expect(result.ledgerEntriesCreated).toBe(1);

    const product = await prisma.product.findUnique({
      where: { tenantId_code: { tenantId: TENANT_A, code: "OPEN-GB-001" } },
    });
    expect(product).not.toBeNull();
    expect(product?.type).toBe("GREEN_BEAN");
    expect(Number(product?.stockKg)).toBe(25);

    const ledger = await prisma.inventoryLedger.findFirst({
      where: { tenantId: TENANT_A, refId: "OPEN-GB-CREATE", refType: "ADJUSTMENT_IN" },
    });
    expect(ledger).not.toBeNull();
    expect(Number(ledger?.quantityKg)).toBe(25);
  });

  it("MATCH: existing zero-stock GB gets opening stock", async () => {
    authState.tenantId = TENANT_A;
    await prisma.product.create({
      data: {
        tenantId: TENANT_A,
        code: "OPEN-GB-002",
        name: "Pre-existing GB",
        type: "GREEN_BEAN",
        isActive: true,
        stockKg: 0,
      },
    });

    const result = await applyLegacyOpeningStock({
      operationKey: "OPEN-GB-MATCH",
      tenantId: TENANT_A,
      userId: `${TENANT_A}-user`,
      rawRows: [greenBeanRow("OPEN-GB-002")],
    });

    expect(result.errors).toHaveLength(0);
    expect(result.matchedMasters).toBe(1);
    expect(result.createdMasters).toBe(0);

    const product = await prisma.product.findUnique({
      where: { tenantId_code: { tenantId: TENANT_A, code: "OPEN-GB-002" } },
    });
    expect(Number(product?.stockKg)).toBe(25);
  });

  it("CREATE: Roasted Bean opening stock", async () => {
    authState.tenantId = TENANT_A;
    const result = await applyLegacyOpeningStock({
      operationKey: "OPEN-RB-CREATE",
      tenantId: TENANT_A,
      userId: `${TENANT_A}-user`,
      rawRows: [roastedBeanRow("OPEN-RB-001", { roastLevel: "MEDIUM" })],
    });

    expect(result.errors).toHaveLength(0);
    expect(result.createdMasters).toBe(1);

    const product = await prisma.product.findUnique({
      where: { tenantId_code: { tenantId: TENANT_A, code: "OPEN-RB-001" } },
    });
    expect(product?.type).toBe("ROASTED_BEAN");
    expect(product?.roastLevel).toBe("MEDIUM");
    expect(Number(product?.stockKg)).toBe(20);

    const ledger = await prisma.inventoryLedger.findFirst({
      where: { tenantId: TENANT_A, refId: "OPEN-RB-CREATE", refType: "ADJUSTMENT_IN" },
    });
    expect(Number(ledger?.quantityKg)).toBe(20);
  });

  it("CREATE: Finished Goods opening stock writes quantityUnit", async () => {
    authState.tenantId = TENANT_A;
    const result = await applyLegacyOpeningStock({
      operationKey: "OPEN-FG-CREATE",
      tenantId: TENANT_A,
      userId: `${TENANT_A}-user`,
      rawRows: [finishedGoodsRow("OPEN-FG-001")],
    });

    expect(result.errors).toHaveLength(0);
    expect(result.createdMasters).toBe(1);

    const product = await prisma.product.findUnique({
      where: { tenantId_code: { tenantId: TENANT_A, code: "OPEN-FG-001" } },
    });
    expect(product?.type).toBe("FINISHED_GOODS");
    expect(Number(product?.stockUnit)).toBe(10);

    const ledger = await prisma.inventoryLedger.findFirst({
      where: { tenantId: TENANT_A, refId: "OPEN-FG-CREATE", refType: "ADJUSTMENT_IN" },
    });
    expect(Number(ledger?.quantityUnit)).toBe(10);
    expect(ledger?.quantityKg).toBeNull();
  });

  it("CREATE: Supply INGREDIENT opening stock", async () => {
    authState.tenantId = TENANT_A;
    const result = await applyLegacyOpeningStock({
      operationKey: "OPEN-SUP-ING",
      tenantId: TENANT_A,
      userId: `${TENANT_A}-user`,
      rawRows: [supplyRow("OPEN-SUP-001", { category: "INGREDIENT", baseUnit: "KG", quantity: "50", unitCost: "5000" })],
    });

    expect(result.errors).toHaveLength(0);
    expect(result.createdMasters).toBe(1);

    const supply = await prisma.inventorySupplyItem.findUnique({
      where: { tenantId_code: { tenantId: TENANT_A, code: "OPEN-SUP-001" } },
    });
    expect(supply).not.toBeNull();
    expect(supply?.category).toBe("INGREDIENT");
    expect(Number(supply?.stockQuantity)).toBe(50);
    expect(Number(supply?.avgCostPerUnit)).toBe(5000);

    const ledger = await prisma.inventoryLedger.findFirst({
      where: { tenantId: TENANT_A, refId: "OPEN-SUP-ING", refType: "ADJUSTMENT_IN" },
    });
    expect(ledger?.supplyItemId).toBe(supply?.id);
    expect(Number(ledger?.supplyQuantity)).toBe(50);
    expect(ledger?.productId).toBeNull();
  });

  it("CREATE: Supply PACKAGING writes supply ledger only (not Packaging.stockUnit)", async () => {
    authState.tenantId = TENANT_A;
    const result = await applyLegacyOpeningStock({
      operationKey: "OPEN-SUP-PKG",
      tenantId: TENANT_A,
      userId: `${TENANT_A}-user`,
      rawRows: [packagingRow("OPEN-PKG-001", { quantity: "200", unitCost: "3000", capacityGrams: "250", tareWeightGrams: "12" })],
    });

    expect(result.errors).toHaveLength(0);
    expect(result.createdMasters).toBe(1);

    const supply = await prisma.inventorySupplyItem.findUnique({
      where: { tenantId_code: { tenantId: TENANT_A, code: "OPEN-PKG-001" } },
      include: { packaging: true },
    });
    expect(supply).not.toBeNull();
    expect(supply?.category).toBe("PACKAGING");
    expect(supply?.packaging).not.toBeNull();
    expect(Number(supply?.stockQuantity)).toBe(200);

    // Packaging adapter should exist but stockUnit must NOT be incremented
    expect(Number(supply?.packaging?.stockUnit)).toBe(0);

    const ledger = await prisma.inventoryLedger.findFirst({
      where: { tenantId: TENANT_A, refId: "OPEN-SUP-PKG", refType: "ADJUSTMENT_IN" },
    });
    expect(ledger?.supplyItemId).toBe(supply?.id);
    expect(ledger?.packagingId).toBeNull();
    expect(Number(ledger?.supplyQuantity)).toBe(200);
  });

   it("tenant isolation: product in tenant A not visible to tenant B", async () => {
    authState.tenantId = TENANT_A;
    await prisma.product.create({
      data: {
        tenantId: TENANT_A,
        code: "OPEN-GB-003",
        name: "Tenant A GB",
        type: "GREEN_BEAN",
        isActive: true,
        stockKg: 0,
      },
    });

    authState.tenantId = TENANT_B;
    const resultB = await applyLegacyOpeningStock({
      operationKey: "OPEN-TENANT-B",
      tenantId: TENANT_B,
      userId: `${TENANT_B}-user`,
      rawRows: [greenBeanRow("OPEN-GB-003")],
    });

    expect(resultB.errors).toHaveLength(0);
    expect(resultB.createdMasters).toBe(1);

    const productB = await prisma.product.findUnique({
      where: { tenantId_code: { tenantId: TENANT_B, code: "OPEN-GB-003" } },
    });
    expect(productB).not.toBeNull();
    expect(Number(productB?.stockKg)).toBe(25);

    // Tenant A's product should not have stock from this import
    const productA = await prisma.product.findUnique({
      where: { tenantId_code: { tenantId: TENANT_A, code: "OPEN-GB-003" } },
    });
    // Still 0 (we only did a MATCH check, no import for tenant A in this test)
    // Actually, OPEN-GB-003 in tenant A has 0 stock (created in this test block)
    // The import was for tenant B only, so tenant A should be untouched
    expect(Number(productA?.stockKg ?? 0)).toBe(0);

    await prisma.product.deleteMany({
      where: { tenantId: TENANT_A, code: "OPEN-GB-003" },
    });
  });

  it("invalid row → no writes", async () => {
    authState.tenantId = TENANT_A;
    const result = await applyLegacyOpeningStock({
      operationKey: "OPEN-INVALID",
      tenantId: TENANT_A,
      userId: `${TENANT_A}-user`,
      rawRows: [
        { type: "SUPPLY", code: "BAD-SUP", name: "Bad", quantity: "-5", unitCost: "100", category: "", baseUnit: "KG" },
      ],
    });

    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.createdMasters).toBe(0);
    expect(result.ledgerEntriesCreated).toBe(0);

    // No ledger entries created
    const ledger = await prisma.inventoryLedger.findFirst({
      where: { tenantId: TENANT_A, refId: "OPEN-INVALID", refType: "ADJUSTMENT_IN" },
    });
    expect(ledger).toBeNull();
  });

  it("one row failure → full transaction rollback", async () => {
    authState.tenantId = TENANT_A;
    // Pre-create a product with non-zero stock to trigger the safety block
    await prisma.product.create({
      data: {
        tenantId: TENANT_A,
        code: "OPEN-GB-BLOCKED",
        name: "Blocked GB",
        type: "GREEN_BEAN",
        isActive: true,
        stockKg: 50,
      },
    });

    const result = await applyLegacyOpeningStock({
      operationKey: "OPEN-ROLLBACK",
      tenantId: TENANT_A,
      userId: `${TENANT_A}-user`,
      rawRows: [
        greenBeanRow("OPEN-GB-NEW", { code: "OPEN-GB-NEW" }),
        greenBeanRow("OPEN-GB-BLOCKED"),
      ],
    });

    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.createdMasters).toBe(0);
    expect(result.ledgerEntriesCreated).toBe(0);

    // The new product should NOT exist (rolled back)
    const newProduct = await prisma.product.findUnique({
      where: { tenantId_code: { tenantId: TENANT_A, code: "OPEN-GB-NEW" } },
    });
    expect(newProduct).toBeNull();

    // No ledger entries for this import
    const ledger = await prisma.inventoryLedger.findFirst({
      where: { tenantId: TENANT_A, refId: "OPEN-ROLLBACK", refType: "ADJUSTMENT_IN" },
    });
    expect(ledger).toBeNull();

    await prisma.product.deleteMany({
      where: { tenantId: TENANT_A, code: "OPEN-GB-BLOCKED" },
    });
  });

  it("same operationKey retry → no duplicate stock", async () => {
    authState.tenantId = TENANT_A;
    const input = {
      operationKey: "OPEN-RETRY",
      tenantId: TENANT_A,
      userId: `${TENANT_A}-user`,
      rawRows: [greenBeanRow("OPEN-GB-RETRY", { code: "OPEN-GB-RETRY", quantity: "10", unitCost: "5000" })],
    };

    const result1 = await applyLegacyOpeningStock(input);
    expect(result1.errors).toHaveLength(0);
    expect(result1.createdMasters).toBe(1);
    expect(result1.ledgerEntriesCreated).toBe(1);

    // Get stock after first import
    const product1 = await prisma.product.findUnique({
      where: { tenantId_code: { tenantId: TENANT_A, code: "OPEN-GB-RETRY" } },
    });
    const stockAfterFirst = Number(product1?.stockKg);

    // Retry with same operationKey
    const result2 = await applyLegacyOpeningStock(input);
    expect(result2.errors).toHaveLength(0);
    expect(result2.createdMasters).toBe(0);
    expect(result2.ledgerEntriesCreated).toBe(0);

    // Stock should not have increased
    const product2 = await prisma.product.findUnique({
      where: { tenantId_code: { tenantId: TENANT_A, code: "OPEN-GB-RETRY" } },
    });
    const stockAfterSecond = Number(product2?.stockKg);
    expect(stockAfterSecond).toBe(stockAfterFirst);
    expect(stockAfterSecond).toBe(10);

    // Only 1 ledger entry for this operationKey
    const ledgerCount = await prisma.inventoryLedger.count({
      where: { tenantId: TENANT_A, refId: "OPEN-RETRY", refType: "ADJUSTMENT_IN" },
    });
    expect(ledgerCount).toBe(1);

    // Cleanup
    await prisma.product.deleteMany({
      where: { tenantId: TENANT_A, code: "OPEN-GB-RETRY" },
    });
    await prisma.lot.deleteMany({
      where: { batchCode: { startsWith: "OPEN-RETRY" } },
    });
    await prisma.inventoryLedger.deleteMany({
      where: { tenantId: TENANT_A, refId: "OPEN-RETRY", refType: "ADJUSTMENT_IN" },
    });
  });

  it("concurrent same operationKey → no duplicate stock", async () => {
    authState.tenantId = TENANT_A;
    const input = {
      operationKey: "OPEN-CONCURRENT",
      tenantId: TENANT_A,
      userId: `${TENANT_A}-user`,
      rawRows: [greenBeanRow("OPEN-GB-CONC", { code: "OPEN-GB-CONC", quantity: "10", unitCost: "5000" })],
    };

    const [result1, result2] = await Promise.allSettled([
      applyLegacyOpeningStock(input),
      applyLegacyOpeningStock(input),
    ]);

    // Both should succeed (one might see the other's writes via idempotency)
    const r1 = result1.status === "fulfilled" ? result1.value : null;
    const r2 = result2.status === "fulfilled" ? result2.value : null;

    // At least one should succeed
    expect(r1 ?? r2).not.toBeNull();

    const product = await prisma.product.findUnique({
      where: { tenantId_code: { tenantId: TENANT_A, code: "OPEN-GB-CONC" } },
    });
    expect(Number(product?.stockKg)).toBe(10);

    // Only 1 ledger entry for this operationKey
    const ledgerCount = await prisma.inventoryLedger.count({
      where: { tenantId: TENANT_A, refId: "OPEN-CONCURRENT", refType: "ADJUSTMENT_IN" },
    });
    expect(ledgerCount).toBe(1);

    // Cleanup
    await prisma.product.deleteMany({
      where: { tenantId: TENANT_A, code: "OPEN-GB-CONC" },
    });
    await prisma.lot.deleteMany({
      where: { batchCode: { startsWith: "OPEN-CONCURRENT" } },
    });
    await prisma.inventoryLedger.deleteMany({
      where: { tenantId: TENANT_A, refId: "OPEN-CONCURRENT", refType: "ADJUSTMENT_IN" },
    });
  });

  it("existing non-zero stock → blocked", async () => {
    authState.tenantId = TENANT_A;
    await prisma.product.create({
      data: {
        tenantId: TENANT_A,
        code: "OPEN-GB-STOCKED",
        name: "Stocked GB",
        type: "GREEN_BEAN",
        isActive: true,
        stockKg: 10,
      },
    });

    const result = await applyLegacyOpeningStock({
      operationKey: "OPEN-GB-BLOCKED-STOCK",
      tenantId: TENANT_A,
      userId: `${TENANT_A}-user`,
      rawRows: [greenBeanRow("OPEN-GB-STOCKED")],
    });

    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.createdMasters).toBe(0);
    expect(result.ledgerEntriesCreated).toBe(0);

    // No new ledger entries
    const ledger = await prisma.inventoryLedger.findFirst({
      where: { tenantId: TENANT_A, refId: "OPEN-GB-BLOCKED-STOCK", refType: "ADJUSTMENT_IN" },
    });
    expect(ledger).toBeNull();

    // Existing stock unchanged
    const product = await prisma.product.findUnique({
      where: { tenantId_code: { tenantId: TENANT_A, code: "OPEN-GB-STOCKED" } },
    });
    expect(Number(product?.stockKg)).toBe(10);

    await prisma.product.deleteMany({
      where: { tenantId: TENANT_A, code: "OPEN-GB-STOCKED" },
    });
  });

  it("unitCost produces correct HPP/cache (avgCostPerKg)", async () => {
    authState.tenantId = TENANT_A;
    const result = await applyLegacyOpeningStock({
      operationKey: "OPEN-HPP",
      tenantId: TENANT_A,
      userId: `${TENANT_A}-user`,
      rawRows: [greenBeanRow("OPEN-GB-HPP", { code: "OPEN-GB-HPP", quantity: "100", unitCost: "12000" })],
    });

    expect(result.errors).toHaveLength(0);
    expect(result.totalOpeningValue).toBe(1200000);

    const product = await prisma.product.findUnique({
      where: { tenantId_code: { tenantId: TENANT_A, code: "OPEN-GB-HPP" } },
    });
    expect(Number(product?.avgCostPerKg)).toBe(12000);
    expect(Number(product?.stockKg)).toBe(100);

    await prisma.product.deleteMany({
      where: { tenantId: TENANT_A, code: "OPEN-GB-HPP" },
    });
    await prisma.lot.deleteMany({
      where: { batchCode: { startsWith: "OPEN-HPP" } },
    });
    await prisma.inventoryLedger.deleteMany({
      where: { tenantId: TENANT_A, refId: "OPEN-HPP", refType: "ADJUSTMENT_IN" },
    });
  });

  it("ledger subject XOR: only one of productId/packagingId/supplyItemId set", async () => {
    authState.tenantId = TENANT_A;
    await applyLegacyOpeningStock({
      operationKey: "OPEN-XOR",
      tenantId: TENANT_A,
      userId: `${TENANT_A}-user`,
      rawRows: [
        greenBeanRow("OPEN-GB-XOR", { code: "OPEN-GB-XOR", quantity: "10", unitCost: "5000" }),
        packagingRow("OPEN-PKG-XOR", { code: "OPEN-PKG-XOR", quantity: "50", unitCost: "1000" }),
      ],
    });

    const gbLedger = await prisma.inventoryLedger.findFirst({
      where: { tenantId: TENANT_A, refId: "OPEN-XOR", refType: "ADJUSTMENT_IN" },
      orderBy: { createdAt: "asc" },
    });
    expect(gbLedger?.supplyItemId).toBeFalsy();
    expect(gbLedger?.packagingId).toBeFalsy();
    expect(gbLedger?.productId).toBeTruthy();

    const supLedger = await prisma.inventoryLedger.findFirst({
      where: {
        tenantId: TENANT_A,
        refId: "OPEN-XOR",
        refType: "ADJUSTMENT_IN",
      },
      orderBy: { createdAt: "desc" },
    });
    expect(supLedger?.productId).toBeFalsy();
    expect(supLedger?.packagingId).toBeFalsy();
    expect(supLedger?.supplyItemId).toBeTruthy();
  });

  it("multiple lots same SKU with different lotNumber", async () => {
    authState.tenantId = TENANT_A;
    const result = await applyLegacyOpeningStock({
      operationKey: "OPEN-MULTI-LOT",
      tenantId: TENANT_A,
      userId: `${TENANT_A}-user`,
      rawRows: [
        greenBeanRow("OPEN-GB-MULTI", {
          code: "OPEN-GB-MULTI",
          lotNumber: "LOT-A",
          quantity: "10",
          unitCost: "10000",
        }),
        greenBeanRow("OPEN-GB-MULTI", {
          code: "OPEN-GB-MULTI",
          lotNumber: "LOT-B",
          quantity: "15",
          unitCost: "12000",
        }),
      ],
    });

    expect(result.errors).toHaveLength(0);
    expect(result.createdMasters).toBe(1); // single product master
    expect(result.ledgerEntriesCreated).toBe(2);
    expect(result.lotsCreated).toBe(2);

    // Two distinct lots with same product
    const lots = await prisma.lot.findMany({
      where: {
        tenantId: TENANT_A,
        product: { code: "OPEN-GB-MULTI" },
        batchCode: { startsWith: "OPEN-MULTI-LOT" },
      },
    });
    expect(lots.length).toBe(2);

    // Stock should be 25 total
    const product = await prisma.product.findUnique({
      where: { tenantId_code: { tenantId: TENANT_A, code: "OPEN-GB-MULTI" } },
    });
    expect(Number(product?.stockKg)).toBe(25);
  });

  it("lot + expiry created correctly", async () => {
    authState.tenantId = TENANT_A;
    const result = await applyLegacyOpeningStock({
      operationKey: "OPEN-LOT-EXPIRY",
      tenantId: TENANT_A,
      userId: `${TENANT_A}-user`,
      rawRows: [
        greenBeanRow("OPEN-GB-LE", {
          code: "OPEN-GB-LE",
          lotNumber: "LOT-2024-001",
          receivedAt: "2024-01-15",
          expiryDate: "2025-01-15",
          quantity: "30",
          unitCost: "11000",
        }),
      ],
    });

    expect(result.errors).toHaveLength(0);
    expect(result.lotsCreated).toBe(1);

    const lot = await prisma.lot.findFirst({
      where: {
        tenantId: TENANT_A,
        batchCode: { startsWith: "OPEN-LOT-EXPIRY" },
      },
    });
    expect(lot).not.toBeNull();
    expect(lot?.receivedAt).not.toBeNull();
    expect(lot?.expiryDate).not.toBeNull();
    expect(Number(lot?.quantityKg)).toBe(30);
  });
});
