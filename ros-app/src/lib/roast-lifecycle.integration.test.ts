import { randomUUID } from "node:crypto";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { resolveTestDatabaseUrl } from "../../test/setup/test-database-guard";
import {
  abortRoastInTx,
  cancelRoastInTx,
  chargeRoastMaterialsInTx,
  completeRoastInTx,
  reserveRoastMaterialsInTx,
} from "./roast-lifecycle";

const integrationEnabled = process.env.RUN_INTEGRATION === "true";
const suite = integrationEnabled ? describe : describe.skip;

type Fixture = {
  tenantId: string;
  userId: string;
  inputProductId: string;
  outputProductId: string;
  warehouseId: string;
  sourceLocationId: string;
  batchId: string;
  lotIds: string[];
};

suite("roast lifecycle — real PostgreSQL (TEST_DATABASE_URL)", () => {
  let client: PrismaClient;
  let pool: Pool;
  const tenantIds: string[] = [];

  beforeAll(async () => {
    pool = new Pool({ connectionString: resolveTestDatabaseUrl(), max: 10 });
    client = new PrismaClient({ adapter: new PrismaPg(pool) });
    await client.$connect();
  });

  afterAll(async () => {
    if (!client) return;
    for (const tenantId of tenantIds) {
      await client.$transaction(async (tx) => {
        await tx.journalLine.deleteMany({ where: { journalEntry: { tenantId } } });
        await tx.journalEntry.deleteMany({ where: { tenantId } });
        await tx.auditLog.deleteMany({ where: { tenantId } });
        await tx.roastMaterialReservation.deleteMany({ where: { tenantId } });
        await tx.locationTransfer.deleteMany({ where: { tenantId } });
        await tx.childRoastingBatch.deleteMany({ where: { tenantId } });
        await tx.parentRoastingBatch.deleteMany({ where: { tenantId } });
        await tx.lotPlacement.deleteMany({ where: { tenantId } });
        await tx.inventoryLedger.deleteMany({ where: { tenantId } });
        await tx.lot.deleteMany({ where: { tenantId } });
        await tx.location.deleteMany({ where: { tenantId } });
        await tx.warehouse.deleteMany({ where: { tenantId } });
        await tx.account.deleteMany({ where: { tenantId } });
        await tx.product.deleteMany({ where: { tenantId } });
        await tx.user.deleteMany({ where: { tenantId } });
        await tx.tenant.deleteMany({ where: { id: tenantId } });
      });
    }
    await client.$disconnect();
    await pool.end();
  });

  async function createBatch(
    tx: any,
    fixture: Omit<Fixture, "batchId" | "lotIds">,
    targetWeightKg: number,
  ) {
    return tx.parentRoastingBatch.create({
      data: {
        tenantId: fixture.tenantId,
        code: `RST-${randomUUID()}`,
        operationKey: randomUUID(),
        inputProductId: fixture.inputProductId,
        outputProductId: fixture.outputProductId,
        targetWeightKg,
        status: "PENDING",
        lifecycleStatus: "PLANNED",
        createdById: fixture.userId,
      },
    });
  }

  async function seedFixture(lotWeights: number[], targetWeightKg: number): Promise<Fixture> {
    const suffix = randomUUID();
    const tenantId = `roast-life-${suffix}`;
    const userId = `roast-user-${suffix}`;
    tenantIds.push(tenantId);

    return client.$transaction(async (tx) => {
      await tx.tenant.create({
        data: { id: tenantId, code: `RL-${suffix}`, name: `Roast Lifecycle ${suffix}` },
      });
      await tx.user.create({
        data: {
          id: userId,
          tenantId,
          name: "Roast Lifecycle Tester",
          email: `${suffix}@test.local`,
          password: "hashed-test-password",
        },
      });
      const input = await tx.product.create({
        data: {
          tenantId,
          code: `GB-${suffix}`,
          name: "Test Green Bean",
          type: "GREEN_BEAN",
          stockKg: lotWeights.reduce((sum, value) => sum + value, 0),
          avgCostPerKg: 100_000,
        },
      });
      const output = await tx.product.create({
        data: {
          tenantId,
          code: `RB-${suffix}`,
          name: "Test Roasted Bean",
          type: "ROASTED_BEAN",
          stockKg: 0,
          sourceGreenBeanId: input.id,
          roastLevel: "MEDIUM",
        },
      });
      const warehouse = await tx.warehouse.create({
        data: { tenantId, code: "WH-01", name: "Test Warehouse", isDefault: true },
      });
      const source = await tx.location.create({
        data: {
          tenantId,
          warehouseId: warehouse.id,
          code: "GB-A01",
          name: "Green Bean A01",
          isDefault: true,
        },
      });
      const lotIds: string[] = [];
      for (let index = 0; index < lotWeights.length; index += 1) {
        const lot = await tx.lot.create({
          data: {
            tenantId,
            productId: input.id,
            batchCode: `GB-LOT-${index}-${suffix}`,
            quantityKg: lotWeights[index],
            receivedAt: new Date(Date.UTC(2026, 0, index + 1)),
            expiryDate: new Date(Date.UTC(2026, index + 1, 1)),
          },
        });
        lotIds.push(lot.id);
        await tx.lotPlacement.create({
          data: {
            tenantId,
            lotId: lot.id,
            locationId: source.id,
            quantityKg: lotWeights[index],
          },
        });
      }
      const base = {
        tenantId,
        userId,
        inputProductId: input.id,
        outputProductId: output.id,
        warehouseId: warehouse.id,
        sourceLocationId: source.id,
      };
      const batch = await createBatch(tx, base, targetWeightKg);
      return { ...base, batchId: batch.id, lotIds };
    });
  }

  const lifecycleInput = (fixture: Fixture, batchId = fixture.batchId) => ({
    tenantId: fixture.tenantId,
    userId: fixture.userId,
    batchId,
  });

  it("reserves by FEFO and charges placement to warehouse-local WIP without canonical mutation", async () => {
    const fixture = await seedFixture([4, 4], 6);

    await client.$transaction(
      (tx) => reserveRoastMaterialsInTx(tx, lifecycleInput(fixture)),
      { isolationLevel: "Serializable" },
    );
    const [productAfterReserve, reservations, placementsAfterReserve, ledgerAfterReserve] = await Promise.all([
      client.product.findUnique({ where: { id: fixture.inputProductId } }),
      client.roastMaterialReservation.findMany({
        where: { parentBatchId: fixture.batchId },
        orderBy: { createdAt: "asc" },
      }),
      client.lotPlacement.findMany({ where: { tenantId: fixture.tenantId, lotId: { in: fixture.lotIds } } }),
      client.inventoryLedger.count({ where: { tenantId: fixture.tenantId, refId: fixture.batchId } }),
    ]);
    expect(Number(productAfterReserve?.stockKg)).toBe(8);
    expect(reservations.map((row) => [row.lotId, Number(row.quantityKg)])).toEqual([
      [fixture.lotIds[0], 4],
      [fixture.lotIds[1], 2],
    ]);
    expect(placementsAfterReserve.reduce((sum, row) => sum + Number(row.quantityKg), 0)).toBe(8);
    expect(ledgerAfterReserve).toBe(0);

    await client.$transaction(
      (tx) => chargeRoastMaterialsInTx(tx, lifecycleInput(fixture)),
      { isolationLevel: "Serializable" },
    );
    const [productAfterCharge, batch, wip, transfers, ledgerAfterCharge] = await Promise.all([
      client.product.findUnique({ where: { id: fixture.inputProductId } }),
      client.parentRoastingBatch.findUnique({ where: { id: fixture.batchId } }),
      client.location.findFirst({
        where: {
          tenantId: fixture.tenantId,
          warehouseId: fixture.warehouseId,
          systemPurpose: "ROASTING_WIP",
          isSystem: true,
        },
      }),
      client.locationTransfer.findMany({ where: { tenantId: fixture.tenantId } }),
      client.inventoryLedger.count({ where: { tenantId: fixture.tenantId, refId: fixture.batchId } }),
    ]);
    expect(Number(productAfterCharge?.stockKg)).toBe(8);
    expect(batch?.lifecycleStatus).toBe("CHARGED");
    expect(wip?.warehouseId).toBe(fixture.warehouseId);
    expect(transfers).toHaveLength(2);
    expect(ledgerAfterCharge).toBe(0);
  });

  it("allows only one of two concurrent jobs to reserve the same physical Green Bean", async () => {
    const fixture = await seedFixture([5], 5);
    const second = await client.$transaction((tx) => createBatch(tx, fixture, 5));
    const attempts = await Promise.allSettled([
      client.$transaction(
        (tx) => reserveRoastMaterialsInTx(tx, lifecycleInput(fixture)),
        { isolationLevel: "Serializable" },
      ),
      client.$transaction(
        (tx) => reserveRoastMaterialsInTx(tx, lifecycleInput(fixture, second.id)),
        { isolationLevel: "Serializable" },
      ),
    ]);
    expect(attempts.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(attempts.filter((result) => result.status === "rejected")).toHaveLength(1);
    const active = await client.roastMaterialReservation.aggregate({
      where: { tenantId: fixture.tenantId, status: "ACTIVE" },
      _sum: { quantityKg: true },
    });
    expect(Number(active._sum.quantityKg)).toBe(5);
  });

  it("completes from WIP exactly once and places the Roasted Bean output", async () => {
    const fixture = await seedFixture([10], 10);
    await client.$transaction(async (tx) => {
      await reserveRoastMaterialsInTx(tx, lifecycleInput(fixture));
      await chargeRoastMaterialsInTx(tx, lifecycleInput(fixture));
    }, { isolationLevel: "Serializable" });

    const first = await client.$transaction(
      (tx) => completeRoastInTx(tx, {
        ...lifecycleInput(fixture),
        actualOutputKg: 8.5,
        source: "INTEGRATION_TEST",
      }),
      { isolationLevel: "Serializable" },
    );
    expect(first.alreadyCompleted).toBe(false);

    const beforeRetry = await Promise.all([
      client.inventoryLedger.count({ where: { tenantId: fixture.tenantId, refId: fixture.batchId } }),
      client.lot.count({ where: { tenantId: fixture.tenantId, batchCode: { endsWith: "-RB" } } }),
      client.journalEntry.count({ where: { tenantId: fixture.tenantId, refType: "ROASTING", reference: fixture.batchId } }),
    ]);
    const retry = await client.$transaction(
      (tx) => completeRoastInTx(tx, {
        ...lifecycleInput(fixture),
        actualOutputKg: 8.5,
        source: "INTEGRATION_TEST_RETRY",
      }),
      { isolationLevel: "Serializable" },
    );
    const afterRetry = await Promise.all([
      client.inventoryLedger.count({ where: { tenantId: fixture.tenantId, refId: fixture.batchId } }),
      client.lot.count({ where: { tenantId: fixture.tenantId, batchCode: { endsWith: "-RB" } } }),
      client.journalEntry.count({ where: { tenantId: fixture.tenantId, refType: "ROASTING", reference: fixture.batchId } }),
    ]);
    expect(retry.alreadyCompleted).toBe(true);
    expect(afterRetry).toEqual(beforeRetry);

    const [input, output, batch, outputLot, reservations, wipPlacements] = await Promise.all([
      client.product.findUnique({ where: { id: fixture.inputProductId } }),
      client.product.findUnique({ where: { id: fixture.outputProductId } }),
      client.parentRoastingBatch.findUnique({ where: { id: fixture.batchId } }),
      client.lot.findFirst({
        where: { tenantId: fixture.tenantId, productId: fixture.outputProductId, batchCode: { endsWith: "-RB" } },
        include: { placements: true },
      }),
      client.roastMaterialReservation.findMany({ where: { parentBatchId: fixture.batchId } }),
      client.lotPlacement.findMany({
        where: { tenantId: fixture.tenantId, location: { systemPurpose: "ROASTING_WIP" } },
      }),
    ]);
    expect(Number(input?.stockKg)).toBe(0);
    expect(Number(output?.stockKg)).toBe(8.5);
    expect(batch?.lifecycleStatus).toBe("COMPLETED");
    expect(outputLot?.placements).toHaveLength(1);
    expect(Number(outputLot?.placements[0]?.quantityKg)).toBe(8.5);
    expect(reservations.every((row) => row.status === "CONSUMED")).toBe(true);
    expect(wipPlacements.reduce((sum, row) => sum + Number(row.quantityKg), 0)).toBe(0);
  });

  it("releases cancel/recoverable abort without ledger and records scrap as a canonical loss", async () => {
    const cancelFixture = await seedFixture([5], 5);
    await client.$transaction(
      (tx) => reserveRoastMaterialsInTx(tx, lifecycleInput(cancelFixture)),
      { isolationLevel: "Serializable" },
    );
    await client.$transaction(
      (tx) => cancelRoastInTx(tx, { ...lifecycleInput(cancelFixture), reason: "Rencana berubah" }),
      { isolationLevel: "Serializable" },
    );
    expect(await client.inventoryLedger.count({ where: { tenantId: cancelFixture.tenantId } })).toBe(0);
    expect((await client.parentRoastingBatch.findUnique({ where: { id: cancelFixture.batchId } }))?.lifecycleStatus).toBe("CANCELLED");

    const recoverable = await seedFixture([5], 5);
    await client.$transaction(async (tx) => {
      await reserveRoastMaterialsInTx(tx, lifecycleInput(recoverable));
      await chargeRoastMaterialsInTx(tx, lifecycleInput(recoverable));
      await abortRoastInTx(tx, {
        ...lifecycleInput(recoverable),
        reason: "Mesin berhenti sebelum roast",
        mode: "RECOVERABLE",
      });
    }, { isolationLevel: "Serializable" });
    const returned = await client.lotPlacement.findFirst({
      where: { tenantId: recoverable.tenantId, lotId: recoverable.lotIds[0], locationId: recoverable.sourceLocationId },
    });
    expect(Number(returned?.quantityKg)).toBe(5);
    expect(await client.inventoryLedger.count({ where: { tenantId: recoverable.tenantId } })).toBe(0);

    const scrap = await seedFixture([5], 5);
    await client.$transaction(async (tx) => {
      await reserveRoastMaterialsInTx(tx, lifecycleInput(scrap));
      await chargeRoastMaterialsInTx(tx, lifecycleInput(scrap));
      await abortRoastInTx(tx, {
        ...lifecycleInput(scrap),
        reason: "Green Bean terbakar",
        mode: "SCRAP",
      });
    }, { isolationLevel: "Serializable" });
    const [scrapProduct, scrapLedger, scrapJournal, scrapBatch] = await Promise.all([
      client.product.findUnique({ where: { id: scrap.inputProductId } }),
      client.inventoryLedger.findMany({ where: { tenantId: scrap.tenantId, refType: "ADJUSTMENT_OUT", refId: scrap.batchId } }),
      client.journalEntry.findFirst({ where: { tenantId: scrap.tenantId, refType: "ADJUSTMENT", reference: scrap.batchId } }),
      client.parentRoastingBatch.findUnique({ where: { id: scrap.batchId } }),
    ]);
    expect(Number(scrapProduct?.stockKg)).toBe(0);
    expect(scrapLedger).toHaveLength(1);
    expect(scrapJournal).not.toBeNull();
    expect(scrapBatch?.lifecycleStatus).toBe("ABORTED");
  });
});
