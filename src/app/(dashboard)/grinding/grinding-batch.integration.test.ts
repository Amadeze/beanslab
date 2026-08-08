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

vi.mock("next/navigation", () => ({
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
    await tx.product.deleteMany({ where: { tenantId: TEST_TENANT_ID } });
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

  async function createFG(tx: any, productId: string) {
    await tx.product.create({
      data: {
        id: productId,
        tenantId: TEST_TENANT_ID,
        code: productId,
        name: `FG ${productId}`,
        type: "FINISHED_GOODS",
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

  it("creates grinding batch and updates ledger", async () => {
    const rbId = `rb-grind-${Date.now()}`;
    const fgId = `fg-grind-${Date.now()}`;
    const machineId = `machine-grind-${Date.now()}`;
    const operationKey = randomUUID();

    await client.$transaction(async (tx) => {
      await createRB(tx, rbId, 10, 50000);
      await createFG(tx, fgId);
      await createMachine(tx, machineId);
    });

    const result = await createGrindingBatch({
      operationKey,
      sourceProductId: rbId,
      outputProductId: fgId,
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
    expect(batch!.inputKg).toBe(5);
    expect(batch!.outputKg).toBe(4.5);
    expect(batch!.lossKg).toBe(0.5);
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
      await createFG(tx, fgId);
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
      await createFG(tx, fgId);
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
      await createFG(tx, fgId);
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
    expect(data.fgOptions).toBeDefined();
    expect(Array.isArray(data.fgOptions)).toBe(true);
    expect(data.grinderOptions).toBeDefined();
    expect(Array.isArray(data.grinderOptions)).toBe(true);
  });
});
