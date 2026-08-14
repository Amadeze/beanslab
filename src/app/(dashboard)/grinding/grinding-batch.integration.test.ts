import { describe, expect, it, beforeAll, afterAll, vi, beforeEach } from "vitest";
import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { createGrindingBatch, voidGrindingBatch, getGrindingPageData } from "@/app/(dashboard)/grinding/actions";
import { assertSafeTestDatabase } from "../../../../test/setup/assert-safe-test-db";
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
    throw new Error("[grinding.integration] TEST_DATABASE_URL is required when RUN_INTEGRATION=true");
  }
  const fromEnvFile = parseEnvFile(join(process.cwd(), ".env.local"));
  for (const key of ["DATABASE_URL", "DIRECT_URL"] as const) {
    const value = fromEnvFile[key] ?? process.env[key];
    if (value && value === url) {
      throw new Error(`[grinding.integration] TEST_DATABASE_URL must not equal ${key}`);
    }
  }
  assertSafeTestDatabase({ DATABASE_URL: url });
  return url;
}

suite("createGrindingBatch", () => {
  let client: PrismaClient;
  const cleanupIds: string[] = [];

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
    await tx.lot.deleteMany({ where: { tenantId: TEST_TENANT_ID } });
    await tx.grindingBatch.deleteMany({ where: { tenantId: TEST_TENANT_ID } });
    await tx.roastMaterialReservation.deleteMany({ where: { tenantId: TEST_TENANT_ID } });
    await tx.childRoastingBatch.deleteMany({ where: { tenantId: TEST_TENANT_ID } });
    await tx.parentRoastingBatch.deleteMany({ where: { tenantId: TEST_TENANT_ID } });
    await tx.productionBatch.deleteMany({ where: { tenantId: TEST_TENANT_ID } });
    await tx.productionSupplyUsage.deleteMany({ where: { tenantId: TEST_TENANT_ID } });
    await tx.experimentalProduction.deleteMany({ where: { tenantId: TEST_TENANT_ID } });
    await tx.experimentalProductionComponent.deleteMany({ where: { tenantId: TEST_TENANT_ID } });
    await tx.sampleUsageComponent.deleteMany({ where: { tenantId: TEST_TENANT_ID } });
    await tx.stockReservation.deleteMany({ where: { tenantId: TEST_TENANT_ID } });
    await tx.fulfillmentTask.deleteMany({ where: { tenantId: TEST_TENANT_ID } });
    await tx.invoiceItem.deleteMany({ where: { tenantId: TEST_TENANT_ID } });
    await tx.contractPrice.deleteMany({ where: { tenantId: TEST_TENANT_ID } });
    await tx.purchaseOrderItem.deleteMany({ where: { tenantId: TEST_TENANT_ID } });
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
    cleanupIds.length = 0;
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

  async function createRB(tx: any, productId: string, stockKg: number = 10, avgCostPerKg: number = 50000) {
    await tx.product.create({
      data: {
        id: productId,
        tenantId: TEST_TENANT_ID,
        code: productId,
        name: `RB ${productId}`,
        type: "ROASTED_BEAN",
        stockKg,
        avgCostPerKg,
        isActive: true,
      },
    });
  }

  async function createGroundCoffeeSku(tx: any, productId: string) {
    await tx.product.create({
      data: {
        id: productId,
        tenantId: TEST_TENANT_ID,
        code: productId,
        name: `Ground ${productId}`,
        // Grinding output remains kg-tracked so the packaging workflow can
        // consume it as a coffee component.
        type: "ROASTED_BEAN",
        stockKg: 0,
        stockUnit: 0,
        isActive: true,
      },
    });
  }

  async function createMachine(tx: any, machineId: string) {
    await tx.machine.create({
      data: {
        id: machineId,
        tenantId: TEST_TENANT_ID,
        name: `Grinder ${machineId}`,
        isActive: true,
      },
    });
  }

  async function createRoastBatch(tx: any, roastId: string, tenantId: string, gbId: string, outputRbId: string, opts: { status?: string } = {}) {
    const status = opts.status ?? "COMPLETED";
    await tx.parentRoastingBatch.create({
      data: {
        id: roastId,
        code: `PRST-${roastId.slice(-8)}`,
        tenantId,
        inputProductId: gbId,
        outputProductId: outputRbId,
        targetWeightKg: 10,
        status,
        lifecycleStatus: status === "COMPLETED" ? "COMPLETED" : "PLANNED",
        createdById: TEST_USER_ID,
        actualOutputKg: 8.5,
      },
    });
  }

  it("creates grinding batch and updates ledger", async () => {
    const rbId = `rb-grind-${Date.now()}`;
    const groundCoffeeId = `ground-grind-${Date.now()}`;
    const machineId = `machine-grind-${Date.now()}`;
    const operationKey = randomUUID();

    await client.$transaction(async (tx) => {
      await createRB(tx, rbId, 10, 50000);
      await createGroundCoffeeSku(tx, groundCoffeeId);
      await createMachine(tx, machineId);
    });

    const result = await createGrindingBatch({
      operationKey,
      sourceProductId: rbId,
      outputProductId: groundCoffeeId,
      grindSize: "MEDIUM",
      inputKg: 5,
      outputKg: 4.5,
      grindingCost: 5000,
      batchReference: "RST-001",
      notes: "Test grinding",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.batchCode).toBeTruthy();
    }

    const batch = await client.grindingBatch.findFirst({
      where: { tenantId: TEST_TENANT_ID, operationKey },
    });
    expect(batch).toBeTruthy();
    expect(Number(batch!.inputKg)).toBe(5);
    expect(Number(batch!.outputKg)).toBe(4.5);
    expect(Number(batch!.lossKg)).toBe(0.5);
    expect(batch!.grindSize).toBe("MEDIUM");

    const ledgerEntries = await client.inventoryLedger.findMany({
      where: { tenantId: TEST_TENANT_ID, refId: batch!.id },
    });
    expect(ledgerEntries).toHaveLength(2);
    const rbOut = ledgerEntries.find((e) => e.refType === "GRINDING_RB_OUT");
    const fgIn = ledgerEntries.find((e) => e.refType === "GRINDING_FG_IN");
    expect(rbOut).toBeTruthy();
    expect(fgIn).toBeTruthy();
    expect(Number(rbOut!.quantityKg)).toBe(5);
    expect(Number(fgIn!.quantityKg)).toBe(4.5);
  });

  it("is idempotent via operationKey", async () => {
    const rbId = `rb-grind-idem-${Date.now()}`;
    const fgId = `fg-grind-idem-${Date.now()}`;
    const operationKey = randomUUID();

    await client.$transaction(async (tx) => {
      await createRB(tx, rbId, 10, 50000);
      await createGroundCoffeeSku(tx, fgId);
    });

    const result1 = await createGrindingBatch({
      operationKey,
      sourceProductId: rbId,
      outputProductId: fgId,
      grindSize: "COARSE",
      inputKg: 3,
      outputKg: 2.8,
    });
    expect(result1.success).toBe(true);

    const result2 = await createGrindingBatch({
      operationKey,
      sourceProductId: rbId,
      outputProductId: fgId,
      grindSize: "COARSE",
      inputKg: 3,
      outputKg: 2.8,
    });
    expect(result2.success).toBe(true);
    if (result2.success && result1.success) {
      expect(result2.batchCode).toBe(result1.batchCode);
    }
  });

  it("blocks insufficient stock", async () => {
    const rbId = `rb-grind-stock-${Date.now()}`;
    const fgId = `fg-grind-stock-${Date.now()}`;

    await client.$transaction(async (tx) => {
      await createRB(tx, rbId, 1, 50000);
      await createGroundCoffeeSku(tx, fgId);
    });

    const result = await createGrindingBatch({
      operationKey: randomUUID(),
      sourceProductId: rbId,
      outputProductId: fgId,
      grindSize: "FINE",
      inputKg: 5,
      outputKg: 4,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("tidak cukup");
    }
  });

  it("voids batch and reverses ledger", async () => {
    const rbId = `rb-grind-void-${Date.now()}`;
    const fgId = `fg-grind-void-${Date.now()}`;
    const operationKey = randomUUID();

    await client.$transaction(async (tx) => {
      await createRB(tx, rbId, 10, 50000);
      await createGroundCoffeeSku(tx, fgId);
    });

    const createResult = await createGrindingBatch({
      operationKey,
      sourceProductId: rbId,
      outputProductId: fgId,
      grindSize: "ESPRESSO",
      inputKg: 2,
      outputKg: 1.8,
    });
    expect(createResult.success).toBe(true);
    if (!createResult.success) return;

    const batch = await client.grindingBatch.findFirst({
      where: { tenantId: TEST_TENANT_ID, operationKey },
    });
    expect(batch).toBeTruthy();

    const voidResult = await voidGrindingBatch(batch!.id, "Test void");
    expect(voidResult.success).toBe(true);

    const updatedBatch = await client.grindingBatch.findUnique({
      where: { id: batch!.id },
    });
    expect(updatedBatch!.status).toBe("VOID");

    const voidEntries = await client.inventoryLedger.findMany({
      where: { tenantId: TEST_TENANT_ID, refId: batch!.id, refType: "VOID_REVERSAL" },
    });
    expect(voidEntries.length).toBeGreaterThanOrEqual(2);
  });

  it("returns page data with correct shape", async () => {
    const data = await getGrindingPageData();
    expect(data.batches).toBeDefined();
    expect(Array.isArray(data.batches)).toBe(true);
    expect(data.rbOptions).toBeDefined();
    expect(Array.isArray(data.rbOptions)).toBe(true);
    expect(data.groundCoffeeOptions).toBeDefined();
    expect(Array.isArray(data.groundCoffeeOptions)).toBe(true);
    expect(data.grinderOptions).toBeDefined();
    expect(Array.isArray(data.grinderOptions)).toBe(true);
  });

  it("Phase 2D.1: parentRoastBatchId terekam saat grinding diluncurkan dari rekap roasting", async () => {
    const gbId = `gb-trace-grind-${Date.now()}`;
    const rbId = `rb-trace-grind-${Date.now()}`;
    const groundCoffeeId = `ground-trace-grind-${Date.now()}`;
    const roastId = `roast-trace-grind-${Date.now()}`;

    await client.$transaction(async (tx) => {
      await tx.product.create({ data: { id: gbId, tenantId: TEST_TENANT_ID, code: gbId, name: `GB ${gbId}`, type: "GREEN_BEAN", stockKg: 10, isActive: true } });
      await createRB(tx, rbId, 10, 50000);
      await createGroundCoffeeSku(tx, groundCoffeeId);
      await createRoastBatch(tx, roastId, TEST_TENANT_ID, gbId, rbId);
    });

    const result = await createGrindingBatch({
      operationKey: randomUUID(),
      sourceProductId: rbId,
      outputProductId: groundCoffeeId,
      grindSize: "MEDIUM",
      inputKg: 5,
      outputKg: 4.5,
      grindingCost: 5000,
      parentRoastBatchId: roastId,
    });

    if (!result.success) {
      throw new Error(`grinding traceability happy path failed: ${result.error}`);
    }
    const traced = await client.grindingBatch.findFirst({ where: { tenantId: TEST_TENANT_ID }, orderBy: { createdAt: "desc" } });
    expect(traced!.parentRoastBatchId).toBe(roastId);
  });

  it("Phase 2D.1: sumber bukan hasil batch roasting tersebut ditolak", async () => {
    const gbId = `gb-incompat-grind-${Date.now()}`;
    const rbRoastOutput = `rb-roast-grind-${Date.now()}`;
    const rbOther = `rb-other-grind-${Date.now()}`;
    const groundCoffeeId = `ground-incompat-grind-${Date.now()}`;
    const roastId = `roast-incompat-grind-${Date.now()}`;

    await client.$transaction(async (tx) => {
      await tx.product.create({ data: { id: gbId, tenantId: TEST_TENANT_ID, code: gbId, name: `GB ${gbId}`, type: "GREEN_BEAN", stockKg: 10, isActive: true } });
      await createRB(tx, rbRoastOutput, 10, 50000);
      await createRB(tx, rbOther, 10, 50000);
      await createGroundCoffeeSku(tx, groundCoffeeId);
      await createRoastBatch(tx, roastId, TEST_TENANT_ID, gbId, rbRoastOutput);
    });

    const result = await createGrindingBatch({
      operationKey: randomUUID(),
      sourceProductId: rbOther,
      outputProductId: groundCoffeeId,
      grindSize: "COARSE",
      inputKg: 3,
      outputKg: 2.8,
      parentRoastBatchId: roastId,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toMatch(/harus merupakan hasil dari batch roasting tersebut/);
    }
  });

  it("Phase 2D.1: batch roasting dari tenant lain ditolak", async () => {
    const otherTenant = `tenant-other-grind-${Date.now()}`;
    const otherUser = `user-other-grind-${Date.now()}`;
    const gbId = `gb-x-grind-${Date.now()}`;
    const rbOtherTenant = `rb-x-grind-${Date.now()}`;
    const rbLocal = `rb-local-grind-${Date.now()}`;
    const groundCoffeeId = `ground-x-grind-${Date.now()}`;
    const roastId = `roast-x-grind-${Date.now()}`;

    await client.$transaction(async (tx) => {
      await tx.tenant.create({ data: { id: otherTenant, code: otherTenant, name: "Other Tenant" } });
      await tx.user.create({ data: { id: otherUser, name: "Other", email: `${otherUser}@test.local`, password: "hashed", tenantId: otherTenant } });
      await tx.product.create({ data: { id: gbId, tenantId: otherTenant, code: gbId, name: `GB ${gbId}`, type: "GREEN_BEAN", stockKg: 10, isActive: true } });
      await createRB(tx, rbOtherTenant, 10, 50000);
      await createRB(tx, rbLocal, 10, 50000);
      await createGroundCoffeeSku(tx, groundCoffeeId);
      await tx.parentRoastingBatch.create({
        data: {
          id: roastId,
          code: `PRST-${roastId.slice(-8)}`,
          tenantId: otherTenant,
          inputProductId: gbId,
          outputProductId: rbOtherTenant,
          targetWeightKg: 10,
          status: "COMPLETED",
          lifecycleStatus: "COMPLETED",
          createdById: otherUser,
          actualOutputKg: 8.5,
        },
      });
    });

    try {
      const result = await createGrindingBatch({
        operationKey: randomUUID(),
        sourceProductId: rbLocal,
        outputProductId: groundCoffeeId,
        grindSize: "COARSE",
        inputKg: 3,
        outputKg: 2.8,
        parentRoastBatchId: roastId,
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toMatch(/Batch roasting sumber tidak ditemukan/);
      }
    } finally {
      await client.$transaction(async (tx) => {
        await tx.parentRoastingBatch.deleteMany({ where: { id: roastId } });
        await tx.product.deleteMany({ where: { id: { in: [gbId, rbOtherTenant] } } });
        await tx.user.deleteMany({ where: { id: otherUser } });
        await tx.tenant.deleteMany({ where: { id: otherTenant } });
      });
    }
  });
});
