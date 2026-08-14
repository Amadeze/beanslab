import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { createExperimentalProduction } from "@/app/(dashboard)/eksperimen/actions";
import { assertSafeTestDatabase } from "../../../../test/setup/assert-safe-test-db";

const integrationEnabled = process.env.RUN_INTEGRATION === "true";
const suite = integrationEnabled ? describe : describe.skip;
const TENANT_ID = "test-experimental-trace";
const USER_ID = "test-experimental-trace-user";

declare global {
  var __experimentalTracePrisma: PrismaClient | undefined;
}

vi.mock("@/lib/auth", async () => {
  const actual = await vi.importActual<typeof import("@/lib/auth")>("@/lib/auth");
  return {
    ...actual,
    requireRole: vi.fn(async () => {}),
    getSystemUserId: vi.fn(async () => USER_ID),
    getCurrentTenantId: vi.fn(async () => TENANT_ID),
    requireTenantPrisma: vi.fn(async () => global.__experimentalTracePrisma),
  };
});

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

function testDatabaseUrl(): string {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) throw new Error("[experimental-traceability.integration] TEST_DATABASE_URL is required");
  assertSafeTestDatabase({ DATABASE_URL: url });
  return url;
}

suite("createExperimentalProduction â€” parentRoastBatchId traceability (Phase 2D.1)", () => {
  let client: PrismaClient;

  async function cleanup(tx: any) {
    await tx.journalLine.deleteMany({ where: { journalEntry: { tenantId: TENANT_ID } } });
    await tx.journalEntry.deleteMany({ where: { tenantId: TENANT_ID } });
    await tx.account.deleteMany({ where: { tenantId: TENANT_ID } });
    await tx.auditLog.deleteMany({ where: { tenantId: TENANT_ID } });
    await tx.inventoryLedger.deleteMany({ where: { tenantId: TENANT_ID } });
    await tx.lot.deleteMany({ where: { tenantId: TENANT_ID } });
    await tx.experimentalProductionComponent.deleteMany({ where: { tenantId: TENANT_ID } });
    await tx.experimentalProduction.deleteMany({ where: { tenantId: TENANT_ID } });
    await tx.roastMaterialReservation.deleteMany({ where: { tenantId: TENANT_ID } });
    await tx.childRoastingBatch.deleteMany({ where: { tenantId: TENANT_ID } });
    await tx.parentRoastingBatch.deleteMany({ where: { OR: [{ tenantId: TENANT_ID }, { createdById: USER_ID }] } });
    await tx.recipeSupplyItem.deleteMany({ where: { tenantId: TENANT_ID } });
    await tx.recipeItem.deleteMany({ where: { tenantId: TENANT_ID } });
    await tx.recipe.deleteMany({ where: { tenantId: TENANT_ID } });
    await tx.product.deleteMany({ where: { tenantId: TENANT_ID } });
    await tx.packaging.deleteMany({ where: { tenantId: TENANT_ID } });
    await tx.inventorySupplyItem.deleteMany({ where: { tenantId: TENANT_ID } });
    await tx.user.deleteMany({ where: { tenantId: TENANT_ID } });
    await tx.tenant.deleteMany({ where: { id: TENANT_ID } });
  }

  beforeAll(async () => {
    const pool = new Pool({ connectionString: testDatabaseUrl(), max: 3 });
    client = new PrismaClient({ adapter: new PrismaPg(pool) });
    await client.$connect();
    global.__experimentalTracePrisma = client;
  });

  beforeEach(async () => {
    await client.$transaction(async (tx) => {
      await cleanup(tx);
      await tx.tenant.create({ data: { id: TENANT_ID, code: TENANT_ID, name: "Experimental Trace" } });
      await tx.user.create({ data: { id: USER_ID, tenantId: TENANT_ID, name: "System", email: "trace@test.local", password: "hashed" } });
    });
  });

  afterAll(async () => {
    if (!client) return;
    await client.$transaction(async (tx) => cleanup(tx));
    await client.$disconnect();
  });

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
        createdById: USER_ID,
        actualOutputKg: 8.5,
      },
    });
  }

  it("persists parentRoastBatchId when the experiment reuses the roast output", async () => {
    const gbId = `gb-trace-exp-${Date.now()}`;
    const rbId = `rb-trace-exp-${Date.now()}`;
    const roastId = `roast-trace-exp-${Date.now()}`;

    await client.$transaction(async (tx) => {
      await tx.product.createMany({ data: [
        { id: gbId, tenantId: TENANT_ID, code: gbId, name: `GB ${gbId}`, type: "GREEN_BEAN", stockKg: 10, avgCostPerKg: 40_000, isActive: true },
        { id: rbId, tenantId: TENANT_ID, code: rbId, name: `RB ${rbId}`, type: "ROASTED_BEAN", stockKg: 10, avgCostPerKg: 50_000, isActive: true },
      ] });
      await createRoastBatch(tx, roastId, TENANT_ID, gbId, rbId);
    });

    const result = await createExperimentalProduction({
      operationKey: randomUUID(),
      name: "Trace Experiment",
      components: [{ componentType: "ROASTED_BEAN", productId: rbId, quantity: 1 }],
      outputKg: 0.9,
      grindingCost: 5_000,
      parentRoastBatchId: roastId,
    });

    if (!result.success) {
      throw new Error(`experiment traceability happy path failed: ${result.error}`);
    }
    const batch = await client.experimentalProduction.findFirstOrThrow({
      where: { tenantId: TENANT_ID, code: result.batchCode },
    });
    expect(batch.parentRoastBatchId).toBe(roastId);
  });

  it("rejects a roast batch from another tenant", async () => {
    const otherTenant = `tenant-other-exp-${Date.now()}`;
    const otherUser = `user-other-exp-${Date.now()}`;
    const gbId = `gb-x-exp-${Date.now()}`;
    const rbOtherTenant = `rb-x-exp-${Date.now()}`;
    const rbLocal = `rb-local-exp-${Date.now()}`;
    const roastId = `roast-x-exp-${Date.now()}`;

    await client.$transaction(async (tx) => {
      await tx.tenant.create({ data: { id: otherTenant, code: otherTenant, name: "Other Tenant" } });
      await tx.user.create({ data: { id: otherUser, tenantId: otherTenant, name: "Other", email: `${otherUser}@test.local`, password: "hashed" } });
      await tx.product.createMany({ data: [
        { id: gbId, tenantId: otherTenant, code: gbId, name: `GB ${gbId}`, type: "GREEN_BEAN", stockKg: 10, avgCostPerKg: 40_000, isActive: true },
        { id: rbOtherTenant, tenantId: otherTenant, code: rbOtherTenant, name: `RB ${rbOtherTenant}`, type: "ROASTED_BEAN", stockKg: 10, avgCostPerKg: 50_000, isActive: true },
        { id: rbLocal, tenantId: TENANT_ID, code: rbLocal, name: `RB ${rbLocal}`, type: "ROASTED_BEAN", stockKg: 10, avgCostPerKg: 50_000, isActive: true },
      ] });
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
      const result = await createExperimentalProduction({
        operationKey: randomUUID(),
        name: "Cross Tenant Experiment",
        components: [{ componentType: "ROASTED_BEAN", productId: rbLocal, quantity: 1 }],
        outputKg: 0.9,
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

  it("rejects a roast batch that is not yet COMPLETED", async () => {
    const gbId = `gb-pending-exp-${Date.now()}`;
    const rbId = `rb-pending-exp-${Date.now()}`;
    const roastId = `roast-pending-exp-${Date.now()}`;

    await client.$transaction(async (tx) => {
      await tx.product.createMany({ data: [
        { id: gbId, tenantId: TENANT_ID, code: gbId, name: `GB ${gbId}`, type: "GREEN_BEAN", stockKg: 10, avgCostPerKg: 40_000, isActive: true },
        { id: rbId, tenantId: TENANT_ID, code: rbId, name: `RB ${rbId}`, type: "ROASTED_BEAN", stockKg: 10, avgCostPerKg: 50_000, isActive: true },
      ] });
      await createRoastBatch(tx, roastId, TENANT_ID, gbId, rbId, { status: "PENDING" });
    });

    const result = await createExperimentalProduction({
      operationKey: randomUUID(),
      name: "Pending Parent Experiment",
      components: [{ componentType: "ROASTED_BEAN", productId: rbId, quantity: 1 }],
      outputKg: 0.9,
      parentRoastBatchId: roastId,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toMatch(/belum selesai/);
    }
  });
});
