import { describe, expect, it, beforeAll, afterAll, vi, beforeEach } from "vitest";
import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { createGrindingBatch, voidGrindingBatch } from "@/app/(dashboard)/grinding/actions";
import { createExperimentalProduction, voidExperimentalProduction } from "@/app/(dashboard)/eksperimen/actions";
import { createProductionBatch, voidProductionBatch } from "@/app/(dashboard)/produksi/actions";
import { appendLedger } from "@/lib/stock";
import { voidPurchaseCore } from "@/lib/purchase-void";
import { postPurchase } from "@/lib/posting";
import { placeLot } from "@/lib/lot-placement";
import { transferLot } from "@/lib/lot-transfer";
import { createLocationOpname, getLocationOpnameDrafts } from "@/lib/lot-opname";
import { getVisualWarehouseMap } from "@/app/(dashboard)/gudang/visual/actions";
import { assertSafeTestDatabase } from "../../test/setup/assert-safe-test-db";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";

const integrationEnabled = process.env.RUN_INTEGRATION === "true";
const suite = integrationEnabled ? describe : describe.skip;

const TEST_TENANT_ID = "test-tenant";
const TEST_USER_ID = "test-system-user";

declare global {
  var __testPrismaClient: PrismaClient | undefined;
}

vi.mock("@/lib/auth", async () => {
  const actual = await vi.importActual<typeof import("@/lib/auth")>("@/lib/auth");
  return {
    ...actual,
    requireRole: vi.fn(async () => {}),
    getSystemUserId: vi.fn(async () => TEST_USER_ID),
    getCurrentTenantId: vi.fn(async () => TEST_TENANT_ID),
    requireTenantPrisma: vi.fn(async () => global.__testPrismaClient),
  };
});

vi.mock("@/lib/prisma", () => ({
  get prisma() {
    return global.__testPrismaClient;
  },
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));

function parseEnvFile(path: string): Record<string, string> {
  const result: Record<string, string> = {};
  try {
    for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Z_]+)\s*=\s*(.*?)\s*$/);
      if (!match) continue;
      const value = match[2].replace(/^"(.*)"$/, "$1").replace(/^'(.*)'$/, "$1");
      if (value.length > 0) result[match[1]] = value;
    }
  } catch {
    // .env.local may be absent
  }
  return result;
}

function resolveTestDatabaseUrl(): string {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) {
    throw new Error("[phase-2d2a.integration] TEST_DATABASE_URL is required when RUN_INTEGRATION=true");
  }
  const fromEnvFile = parseEnvFile(join(process.cwd(), ".env.local"));
  for (const key of ["DATABASE_URL", "DIRECT_URL"] as const) {
    const value = fromEnvFile[key] ?? process.env[key];
    if (value && value === url) {
      throw new Error(`[phase-2d2a.integration] TEST_DATABASE_URL must not equal ${key}`);
    }
  }
  assertSafeTestDatabase({ DATABASE_URL: url });
  return url;
}

suite("Phase 2D.2A — void cost + placement correctness", () => {
  let client: PrismaClient;

  async function wipeTestData(tx: any) {
    await tx.journalLine.deleteMany({
      where: {
        journalEntry: {
          OR: [{ tenantId: TEST_TENANT_ID }, { createdById: TEST_USER_ID }],
        },
      },
    });
    await tx.journalEntry.deleteMany({
      where: { OR: [{ tenantId: TEST_TENANT_ID }, { createdById: TEST_USER_ID }] },
    });
    await tx.account.deleteMany({ where: { tenantId: TEST_TENANT_ID } });
    await tx.auditLog.deleteMany({ where: { tenantId: TEST_TENANT_ID } });
    await tx.inventoryLedger.deleteMany({ where: { tenantId: TEST_TENANT_ID } });
    await tx.lotPlacement.deleteMany({ where: { tenantId: TEST_TENANT_ID } });
    await tx.locationTransfer.deleteMany({ where: { tenantId: TEST_TENANT_ID } });
    await tx.locationOpname.deleteMany({ where: { tenantId: TEST_TENANT_ID } });
    await tx.lot.deleteMany({ where: { tenantId: TEST_TENANT_ID } });
    await tx.location.deleteMany({ where: { tenantId: TEST_TENANT_ID } });
    await tx.warehouse.deleteMany({ where: { tenantId: TEST_TENANT_ID } });
    await tx.grindingBatch.deleteMany({ where: { tenantId: TEST_TENANT_ID } });
    await tx.productionBatch.deleteMany({ where: { tenantId: TEST_TENANT_ID } });
    await tx.productionSupplyUsage.deleteMany({ where: { tenantId: TEST_TENANT_ID } });
    await tx.experimentalProduction.deleteMany({ where: { tenantId: TEST_TENANT_ID } });
    await tx.experimentalProductionComponent.deleteMany({ where: { tenantId: TEST_TENANT_ID } });
    await tx.sampleUsageComponent.deleteMany({ where: { tenantId: TEST_TENANT_ID } });
    await tx.sampleUsage.deleteMany({ where: { tenantId: TEST_TENANT_ID } });
    await tx.stockReservation.deleteMany({ where: { tenantId: TEST_TENANT_ID } });
    await tx.fulfillmentTask.deleteMany({ where: { tenantId: TEST_TENANT_ID } });
    await tx.invoiceItem.deleteMany({ where: { tenantId: TEST_TENANT_ID } });
    await tx.invoice.deleteMany({ where: { tenantId: TEST_TENANT_ID } });
    await tx.supplierPayment.deleteMany({ where: { tenantId: TEST_TENANT_ID } });
    await tx.purchase.deleteMany({ where: { tenantId: TEST_TENANT_ID } });
    await tx.supplier.deleteMany({ where: { tenantId: TEST_TENANT_ID } });
    await tx.roastMaterialReservation.deleteMany({ where: { tenantId: TEST_TENANT_ID } });
    await tx.childRoastingBatch.deleteMany({ where: { tenantId: TEST_TENANT_ID } });
    await tx.parentRoastingBatch.deleteMany({ where: { tenantId: TEST_TENANT_ID } });
    await tx.recipeSupplyItem.deleteMany({ where: { tenantId: TEST_TENANT_ID } });
    await tx.recipeItem.deleteMany({ where: { tenantId: TEST_TENANT_ID } });
    await tx.recipe.deleteMany({ where: { tenantId: TEST_TENANT_ID } });
    await tx.product.deleteMany({ where: { tenantId: TEST_TENANT_ID } });
    await tx.packaging.deleteMany({ where: { tenantId: TEST_TENANT_ID } });
    await tx.inventorySupplyItem.deleteMany({ where: { tenantId: TEST_TENANT_ID } });
    await tx.machine.deleteMany({ where: { tenantId: TEST_TENANT_ID } });
    await tx.user.deleteMany({ where: { tenantId: TEST_TENANT_ID } });
    await tx.user.deleteMany({ where: { id: TEST_USER_ID } });
    await tx.tenant.deleteMany({ where: { id: TEST_TENANT_ID } });
  }

  beforeAll(async () => {
    const pool = new Pool({ connectionString: resolveTestDatabaseUrl(), max: 5 });
    client = new PrismaClient({ adapter: new PrismaPg(pool) });
    await client.$connect();
    global.__testPrismaClient = client;
  });

  beforeEach(async () => {
    await client.$transaction(async (tx) => {
      await wipeTestData(tx);
      await tx.tenant.create({ data: { id: TEST_TENANT_ID, code: TEST_TENANT_ID, name: "Test Tenant" } });
      await tx.user.create({ data: { id: TEST_USER_ID, name: "System", email: "system@test.local", password: "hashed", tenantId: TEST_TENANT_ID } });
    });
  });

  afterAll(async () => {
    if (client) {
      await client.$transaction(async (tx) => {
        await wipeTestData(tx);
      });
      await client.$disconnect();
    }
  });

  async function createProduct(tx: any, productId: string, type: string, stockKg: number = 0, avgCostPerKg: number = 0) {
    await tx.product.create({
      data: {
        id: productId,
        tenantId: TEST_TENANT_ID,
        code: productId,
        name: `Product ${productId}`,
        type: type as any,
        stockKg,
        stockUnit: 0,
        avgCostPerKg,
        isActive: true,
      },
    });
  }

  async function seedKgBasis(tx: any, productId: string, refId: string, quantityKg: number, incomingPrice: number, lotId?: string) {
    if (lotId) {
      await tx.lot.create({
        data: {
          id: lotId,
          tenantId: TEST_TENANT_ID,
          productId,
          batchCode: `LOT-${lotId.slice(-6)}`,
          quantityKg,
          receivedAt: new Date(),
        },
      });
    }
    await appendLedger(tx, {
      data: {
        tenantId: TEST_TENANT_ID,
        productId,
        entryType: "IN",
        refType: "PURCHASE_GB",
        refId,
        quantityKg,
        incomingPrice,
        lotId: lotId ?? null,
        lotNumber: lotId ? `LOT-${lotId.slice(-6)}` : null,
        createdById: TEST_USER_ID,
      },
    });
  }

  async function createMachine(tx: any, machineId: string) {
    await tx.machine.create({
      data: { id: machineId, tenantId: TEST_TENANT_ID, name: `Grinder ${machineId}`, isActive: true },
    });
  }

  async function createSupplier(tx: any, supplierId: string) {
    await tx.supplier.create({
      data: { id: supplierId, tenantId: TEST_TENANT_ID, code: supplierId, name: `Supplier ${supplierId}` },
    });
  }

  async function createPurchase(tx: any, purchaseId: string, supplierId: string, productId: string, weightKg: number, pricePerUnit: number) {
    await tx.purchase.create({
      data: {
        id: purchaseId,
        tenantId: TEST_TENANT_ID,
        code: `PUR-${purchaseId}`,
        type: "GREEN_BEAN",
        supplierId,
        productId,
        weightKg,
        pricePerUnit,
        totalCost: weightKg * pricePerUnit,
        status: "COMPLETED",
        paymentStatus: "PAID",
        paidAmount: weightKg * pricePerUnit,
        receivedAt: new Date(),
        createdById: TEST_USER_ID,
      },
    });
  }

  async function createPackaging(tx: any, packagingId: string) {
    await tx.packaging.create({
      data: {
        id: packagingId,
        tenantId: TEST_TENANT_ID,
        code: packagingId,
        name: `Packaging ${packagingId}`,
        weightGrams: 250,
        costPerUnit: 500,
        stockUnit: 100,
        isActive: true,
      },
    });
  }

  async function createSupplyItem(tx: any, supplyItemId: string, avgCostPerUnit: number = 1000) {
    await tx.inventorySupplyItem.create({
      data: {
        id: supplyItemId,
        tenantId: TEST_TENANT_ID,
        code: supplyItemId,
        name: `Supply ${supplyItemId}`,
        category: "PACKAGING",
        baseUnit: "PCS",
        trackLot: true,
        consumableInProduction: true,
        includeInProductHpp: true,
        costPerUnit: avgCostPerUnit,
        avgCostPerUnit,
        stockQuantity: 1000,
        isActive: true,
      },
    });
  }

  async function createRecipe(tx: any, recipeId: string, productId: string, packagingId: string, supplyItemId: string) {
    await tx.recipe.create({
      data: {
        id: recipeId,
        tenantId: TEST_TENANT_ID,
        code: recipeId,
        name: `Recipe ${recipeId}`,
        productId,
        packagingId,
        outputGrams: 1000,
        isActive: true,
      },
    });
    await tx.recipeSupplyItem.create({
      data: {
        id: `rsi-${recipeId}`,
        tenantId: TEST_TENANT_ID,
        recipeId,
        supplyItemId,
        quantityPerUnit: 1,
      },
    });
  }

  it("grinding void: WAC pulih eksak + placement output dinolkan + pasangan reversal", async () => {
    const rbId = `rb-2d2a-${Date.now()}`;
    const groundId = `ground-2d2a-${Date.now()}`;
    const machineId = `machine-2d2a-${Date.now()}`;

    await client.$transaction(async (tx) => {
      await createProduct(tx, rbId, "ROASTED_BEAN");
      await createProduct(tx, groundId, "ROASTED_BEAN");
      await createMachine(tx, machineId);
      await seedKgBasis(tx, rbId, `purchase-a-${Date.now()}`, 100, 60000, `lot-a-${Date.now()}`);
    });

    const g1 = await createGrindingBatch({
      operationKey: randomUUID(),
      sourceProductId: rbId,
      outputProductId: groundId,
      grindSize: "MEDIUM",
      inputKg: 20,
      outputKg: 18,
      grindingCost: 0,
    });
    expect(g1.success).toBe(true);

    await client.$transaction(async (tx) => {
      await seedKgBasis(tx, rbId, `purchase-b-${Date.now()}`, 100, 100000, `lot-b-${Date.now()}`);
    });

    const g2 = await createGrindingBatch({
      operationKey: randomUUID(),
      sourceProductId: rbId,
      outputProductId: groundId,
      grindSize: "MEDIUM",
      inputKg: 30,
      outputKg: 27,
      grindingCost: 0,
    });
    expect(g2.success).toBe(true);

    const before = await client.product.findUnique({ where: { id: groundId } });
    const hppG1 = (20 * 60000) / 18;
    const sourceWacBeforeG2 = (80 * 60000 + 100 * 100000) / 180;
    const hppG2 = (30 * sourceWacBeforeG2) / 27;
    const expectedBeforeWac = (18 * hppG1 + 27 * hppG2) / 45;
    expect(Number(before!.avgCostPerKg)).toBeCloseTo(expectedBeforeWac, 2);
    expect(Number(before!.stockKg)).toBeCloseTo(45, 6);

    if (!g2.success) return;
    const g2Batch = await client.grindingBatch.findFirst({
      where: { tenantId: TEST_TENANT_ID, code: g2.batchCode },
    });
    expect(g2Batch).toBeTruthy();

    const voidResult = await voidGrindingBatch(g2Batch!.id, "Test void 2D.2A");
    expect(voidResult.success).toBe(true);

    const after = await client.product.findUnique({ where: { id: groundId } });
    expect(Number(after!.avgCostPerKg)).toBeCloseTo(hppG1, 2);
    expect(Number(after!.stockKg)).toBeCloseTo(18, 6);

    const rbAfter = await client.product.findUnique({ where: { id: rbId } });
    expect(Number(rbAfter!.avgCostPerKg)).toBeCloseTo(sourceWacBeforeG2, 2);
    expect(Number(rbAfter!.stockKg)).toBeCloseTo(180, 6);

    const originals = await client.inventoryLedger.findMany({
      where: { tenantId: TEST_TENANT_ID, refId: g2Batch!.id, refType: { not: "VOID_REVERSAL" } },
    });
    const reversals = await client.inventoryLedger.findMany({
      where: { tenantId: TEST_TENANT_ID, refId: g2Batch!.id, refType: "VOID_REVERSAL" },
    });
    expect(reversals.length).toBe(originals.length);
    const reversalIds = reversals.map((r) => r.reversalOfLedgerId).sort();
    const originalIds = originals.map((o) => o.id).sort();
    expect(reversalIds).toEqual(originalIds);

    const fgIn = originals.find((e) => e.refType === "GRINDING_FG_IN");
    expect(Number(fgIn!.incomingPrice)).toBeCloseTo(hppG2, 2);

    const outputPlacements = await client.lotPlacement.findMany({
      where: { tenantId: TEST_TENANT_ID, lotId: fgIn!.lotId! },
    });
    expect(outputPlacements.length).toBeGreaterThan(0);
    for (const p of outputPlacements) {
      expect(Number(p.quantityKg)).toBe(0);
      expect(p.quantityUnit).toBe(0);
    }
  });

  it("eksperimen void: avg dinolkan + placement output dinolkan", async () => {
    const rbId = `rb-exp-2d2a-${Date.now()}`;
    await client.$transaction(async (tx) => {
      await createProduct(tx, rbId, "ROASTED_BEAN");
      await seedKgBasis(tx, rbId, `purchase-exp-${Date.now()}`, 100, 60000, `lot-exp-${Date.now()}`);
    });

    const createResult = await createExperimentalProduction({
      operationKey: randomUUID(),
      name: `Eksperimen 2D.2A ${Date.now()}`,
      components: [
        { componentType: "ROASTED_BEAN", productId: rbId, quantity: 50 },
      ],
      outputKg: 45,
      grindingCost: 0,
    });
    expect(createResult.success).toBe(true);
    if (!createResult.success) return;

    const batch = await client.experimentalProduction.findFirst({
      where: { tenantId: TEST_TENANT_ID, code: createResult.batchCode },
    });
    expect(batch).toBeTruthy();

    const before = await client.product.findUnique({ where: { id: batch!.outputProductId } });
    // hpp = 50*60000/45; produk baru (basis tunggal) → avg = hpp
    expect(Number(before!.avgCostPerKg)).toBeCloseTo((50 * 60000) / 45, 2);
    expect(Number(before!.stockKg)).toBeCloseTo(45, 6);

    const voidResult = await voidExperimentalProduction(batch!.id, "Test void 2D.2A");
    expect(voidResult.success).toBe(true);

    const after = await client.product.findUnique({ where: { id: batch!.outputProductId } });
    expect(Number(after!.avgCostPerKg)).toBe(0);
    expect(Number(after!.stockKg)).toBe(0);

    const fgIn = await client.inventoryLedger.findFirst({
      where: { tenantId: TEST_TENANT_ID, refId: batch!.id, refType: "EXPERIMENTAL_FG_IN" },
    });
    const placements = await client.lotPlacement.findMany({
      where: { tenantId: TEST_TENANT_ID, lotId: fgIn!.lotId! },
    });
    for (const p of placements) {
      expect(Number(p.quantityKg)).toBe(0);
    }
  });

  it("produksi: void batch A → lastHpp = WAC sisa (bukan hpp batch terakhir)", async () => {
    const tenantId = TEST_TENANT_ID;
    const productId = `fg-prod-2d2a-${Date.now()}`;
    const packagingId = `pkg-prod-2d2a-${Date.now()}`;
    const recipeId = `recipe-prod-2d2a-${Date.now()}`;
    const supplyId = `sup-prod-2d2a-${Date.now()}`;
    const rbProductId = `rb-prod-2d2a-${Date.now()}`;

    await client.$transaction(async (tx) => {
      await createProduct(tx, productId, "FINISHED_GOODS");
      await createPackaging(tx, packagingId);
      await createProduct(tx, rbProductId, "ROASTED_BEAN", 10, 10000);
      await createSupplyItem(tx, supplyId);
      await createRecipe(tx, recipeId, productId, packagingId, supplyId);
    });

    const mk = async (supplyQty: number) => {
      const result = await createProductionBatch({
        operationKey: randomUUID(),
        outputProductId: productId,
        packagingId,
        unitsProduced: 10,
        rbComponents: [{ productId: rbProductId, productName: "Test RB", actualGrams: 1000 }],
        supplyComponents: [{ supplyItemId: supplyId, quantity: supplyQty }],
      });
      expect(result.success).toBe(true);
      if (!result.success) throw new Error(result.error);
      const batch = await client.productionBatch.findFirst({ where: { code: result.batchCode } });
      return batch!;
    };

    const batchA = await mk(10);
    const batchB = await mk(20);
    const batchC = await mk(30);

    const hppA = Number(batchA.hppPerUnit);
    const hppB = Number(batchB.hppPerUnit);
    const hppC = Number(batchC.hppPerUnit);
    expect(hppB).not.toBeCloseTo(hppA, 0);
    expect(hppC).not.toBeCloseTo(hppB, 0);

    const afterC = await client.product.findUnique({ where: { id: productId } });
    // WAC completion = (10*hppA + 10*hppB + 10*hppC)/30
    expect(Number(afterC!.lastHpp)).toBeCloseTo((10 * hppA + 10 * hppB + 10 * hppC) / 30, 2);
    expect(Number(afterC!.stockUnit)).toBe(30);

    const voidResult = await voidProductionBatch(batchA.id, "Test void 2D.2A");
    expect(voidResult.success).toBe(true);
    if (!voidResult.success) return;

    const afterVoid = await client.product.findUnique({ where: { id: productId } });
    // Replay: sisa = B (10@hppB) + C (10@hppC) → WAC = (hppB + hppC)/2; NAIVE lama = hppC
    const expectedWac = (10 * hppB + 10 * hppC) / 20;
    expect(Number(afterVoid!.lastHpp)).toBeCloseTo(expectedWac, 2);
    expect(Number(afterVoid!.lastHpp)).not.toBeCloseTo(hppC, 0);
    expect(Number(afterVoid!.stockUnit)).toBe(20);

    const fgInA = await client.inventoryLedger.findFirst({
      where: { tenantId, refId: batchA.id, refType: "PRODUCTION_FG_IN" },
    });
    expect(Number(fgInA!.incomingPrice)).toBeCloseTo(hppA, 2);
    const placements = await client.lotPlacement.findMany({
      where: { tenantId, lotId: fgInA!.lotId! },
    });
    for (const p of placements) {
      expect(p.quantityUnit).toBe(0);
    }
  });

  it("purchase void: WAC kembali ke nilai sebelum pembelian", async () => {
    const gbId = `gb-purch-2d2a-${Date.now()}`;
    await client.$transaction(async (tx) => {
      await createProduct(tx, gbId, "GREEN_BEAN");
      const supA = `sup-a-${Date.now()}`;
      const supB = `sup-b-${Date.now()}`;
      await createSupplier(tx, supA);
      await createSupplier(tx, supB);
      const purchaseA = `pa-${Date.now()}`;
      const purchaseB = `pb-${Date.now()}`;
      const lotA = `lot-${purchaseA}`;
      const lotB = `lot-${purchaseB}`;
      const batchCodeA = `LOT-${purchaseA}`;
      const batchCodeB = `LOT-${purchaseB}`;
      await createPurchase(tx, purchaseA, supA, gbId, 100, 60000);
      await createPurchase(tx, purchaseB, supB, gbId, 100, 100000);
      await postPurchase(purchaseA, "GREEN_BEAN", 6_000_000, 6_000_000, `Supplier ${supA}`, {
        tx,
        tenantId: TEST_TENANT_ID,
        userId: TEST_USER_ID,
      });
      await postPurchase(purchaseB, "GREEN_BEAN", 10_000_000, 10_000_000, `Supplier ${supB}`, {
        tx,
        tenantId: TEST_TENANT_ID,
        userId: TEST_USER_ID,
      });
      await tx.lot.create({
        data: {
          id: lotA,
          tenantId: TEST_TENANT_ID,
          productId: gbId,
          supplierId: supA,
          purchaseId: purchaseA,
          batchCode: batchCodeA,
          quantityKg: 100,
          receivedAt: new Date(),
        },
      });
      await tx.lot.create({
        data: {
          id: lotB,
          tenantId: TEST_TENANT_ID,
          productId: gbId,
          supplierId: supB,
          purchaseId: purchaseB,
          batchCode: batchCodeB,
          quantityKg: 100,
          receivedAt: new Date(),
        },
      });
      await appendLedger(tx, {
        data: {
          tenantId: TEST_TENANT_ID,
          productId: gbId,
          entryType: "IN",
          refType: "PURCHASE_GB",
          refId: purchaseA,
          quantityKg: 100,
          incomingPrice: 60000,
          lotId: lotA,
          lotNumber: batchCodeA,
          createdById: TEST_USER_ID,
        },
      });
      await appendLedger(tx, {
        data: {
          tenantId: TEST_TENANT_ID,
          productId: gbId,
          entryType: "IN",
          refType: "PURCHASE_GB",
          refId: purchaseB,
          quantityKg: 100,
          incomingPrice: 100000,
          lotId: lotB,
          lotNumber: batchCodeB,
          createdById: TEST_USER_ID,
        },
      });
    });

    const before = await client.product.findUnique({ where: { id: gbId } });
    expect(Number(before!.avgCostPerKg)).toBeCloseTo(80000, 2);

    const purchaseB = await client.purchase.findFirst({
      where: { tenantId: TEST_TENANT_ID, pricePerUnit: 100000 },
    });
    expect(purchaseB).toBeTruthy();

    await voidPurchaseCore(client, TEST_TENANT_ID, TEST_USER_ID, purchaseB!.id, "Test void 2D.2A");

    const after = await client.product.findUnique({ where: { id: gbId } });
    expect(Number(after!.avgCostPerKg)).toBeCloseTo(60000, 2);
    expect(Number(after!.stockKg)).toBeCloseTo(100, 6);

    const reversal = await client.inventoryLedger.findFirst({
      where: { tenantId: TEST_TENANT_ID, refId: purchaseB!.id, refType: "VOID_REVERSAL" },
    });
    expect(reversal).toBeTruthy();
    const original = await client.inventoryLedger.findFirst({
      where: { tenantId: TEST_TENANT_ID, refId: purchaseB!.id, refType: "PURCHASE_GB" },
    });
    expect(reversal!.reversalOfLedgerId).toBe(original!.id);

    const lot = await client.lot.findFirst({
      where: { tenantId: TEST_TENANT_ID, purchaseId: purchaseB!.id },
    });
    expect(lot!.consumedAt).not.toBeNull();
  });

  it("konsumed lot: placement/transfer/opname ditolak dan daftar menyaring", async () => {
    const lotId = `lot-consumed-${Date.now()}`;
    const productId = `prod-consumed-${Date.now()}`;
    const locationId = `loc-consumed-${Date.now()}`;
    const locationId2 = `loc-consumed-2-${Date.now()}`;
    const warehouseId = `wh-consumed-${Date.now()}`;

    await client.$transaction(async (tx) => {
      await tx.warehouse.create({
        data: { id: warehouseId, tenantId: TEST_TENANT_ID, code: warehouseId, name: `WH ${warehouseId}`, isActive: true },
      });
      await tx.location.create({
        data: {
          id: locationId,
          tenantId: TEST_TENANT_ID,
          warehouseId,
          code: locationId,
          name: `Rak ${locationId}`,
          isActive: true,
          isSystem: false,
        },
      });
      await tx.location.create({
        data: {
          id: locationId2,
          tenantId: TEST_TENANT_ID,
          warehouseId,
          code: locationId2,
          name: `Rak ${locationId2}`,
          isActive: true,
          isSystem: false,
        },
      });
      await createProduct(tx, productId, "ROASTED_BEAN", 10, 50000);
      await tx.lot.create({
        data: {
          id: lotId,
          tenantId: TEST_TENANT_ID,
          productId,
          batchCode: `LOT-${lotId.slice(-6)}`,
          quantityKg: 10,
          receivedAt: new Date(),
          consumedAt: new Date(),
        },
      });
      await tx.lotPlacement.create({
        data: { tenantId: TEST_TENANT_ID, lotId, locationId, quantityKg: 10, quantityUnit: 0, supplyQty: 0 },
      });
    });

    const place = await placeLot({ lotId, locationId, quantityKg: 5 });
    expect(place.success).toBe(false);
    if (!place.success) expect(place.error).toContain("terkonsumsi");

    const transfer = await transferLot({ lotId, sourceLocationId: locationId, destinationLocationId: locationId2, quantityKg: 2 });
    expect(transfer.success).toBe(false);
    if (!transfer.success) expect(transfer.error).toContain("terkonsumsi");

    const opname = await createLocationOpname({ lotId, locationId, countedQuantityKg: 10 });
    expect(opname.success).toBe(false);
    if (!opname.success) expect(opname.error).toContain("terkonsumsi");

    const drafts = await getLocationOpnameDrafts();
    expect(drafts.some((d) => d.lotId === lotId)).toBe(false);

    const map = await getVisualWarehouseMap();
    const placementsVisible = map.warehouses.flatMap((w) =>
      Object.values(w.rackGroups).flat().flatMap((l: any) => l.placements ?? []),
    );
    expect(placementsVisible.some((p: any) => p.lotId === lotId)).toBe(false);
  });

  it("double void tidak menggandakan reversal", async () => {
    const rbId = `rb-double-${Date.now()}`;
    const groundId = `ground-double-${Date.now()}`;
    await client.$transaction(async (tx) => {
      await createProduct(tx, rbId, "ROASTED_BEAN");
      await createProduct(tx, groundId, "ROASTED_BEAN");
      await seedKgBasis(tx, rbId, `purchase-d-${Date.now()}`, 100, 60000, `lot-d-${Date.now()}`);
    });

    const createResult = await createGrindingBatch({
      operationKey: randomUUID(),
      sourceProductId: rbId,
      outputProductId: groundId,
      grindSize: "MEDIUM",
      inputKg: 10,
      outputKg: 9,
      grindingCost: 0,
    });
    expect(createResult.success).toBe(true);
    if (!createResult.success) return;

    const batch = await client.grindingBatch.findFirst({
      where: { tenantId: TEST_TENANT_ID, code: createResult.batchCode },
    });

    const first = await voidGrindingBatch(batch!.id, "Void pertama");
    expect(first.success).toBe(true);
    const second = await voidGrindingBatch(batch!.id, "Void kedua");
    expect(second.success).toBe(false);

    const reversals = await client.inventoryLedger.count({
      where: { tenantId: TEST_TENANT_ID, refId: batch!.id, refType: "VOID_REVERSAL" },
    });
    expect(reversals).toBe(2);
  });
});
