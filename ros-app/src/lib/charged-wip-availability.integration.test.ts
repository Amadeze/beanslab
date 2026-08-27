import { randomUUID } from "node:crypto";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { appendFefoLedgerOut } from "./stock";
import { resolveTestDatabaseUrl } from "../../test/setup/test-database-guard";
import {
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
  lotId: string;
};

/**
 * Invariant: quantity committed to a CHARGED roast (SYS-ROASTING-WIP) must
 * NOT be consumable by ordinary user-driven flows. Canonical stockKg stays
 * unchanged at charge, so availability for ordinary flows is
 * stockKg minus active/charged roast reservations.
 */
suite("charged WIP availability — real PostgreSQL (TEST_DATABASE_URL)", () => {
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

  async function seedFixture(): Promise<Fixture> {
    const suffix = randomUUID();
    const tenantId = `wip-avail-${suffix}`;
    const userId = `wip-user-${suffix}`;
    tenantIds.push(tenantId);

    return client.$transaction(async (tx) => {
      await tx.tenant.create({
        data: { id: tenantId, code: `WA-${suffix}`, name: `WIP Availability ${suffix}` },
      });
      await tx.user.create({
        data: {
          id: userId,
          tenantId,
          name: "WIP Availability Tester",
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
          stockKg: 10,
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
      const lot = await tx.lot.create({
        data: {
          tenantId,
          productId: input.id,
          batchCode: `GB-LOT-${suffix}`,
          quantityKg: 10,
          receivedAt: new Date(Date.UTC(2026, 0, 1)),
          expiryDate: new Date(Date.UTC(2026, 1, 1)),
        },
      });
      await tx.lotPlacement.create({
        data: {
          tenantId,
          lotId: lot.id,
          locationId: source.id,
          quantityKg: 10,
        },
      });
      const batch = await tx.parentRoastingBatch.create({
        data: {
          tenantId,
          code: `RST-${suffix}`,
          operationKey: randomUUID(),
          inputProductId: input.id,
          outputProductId: output.id,
          targetWeightKg: 8,
          status: "PENDING",
          lifecycleStatus: "PLANNED",
          createdById: userId,
        },
      });
      return {
        tenantId,
        userId,
        inputProductId: input.id,
        outputProductId: output.id,
        warehouseId: warehouse.id,
        sourceLocationId: source.id,
        batchId: batch.id,
        lotId: lot.id,
      };
    });
  }

  async function charge(fixture: Fixture) {
    await client.$transaction(async (tx) => {
      await reserveRoastMaterialsInTx(tx, {
        tenantId: fixture.tenantId,
        userId: fixture.userId,
        batchId: fixture.batchId,
      });
      await chargeRoastMaterialsInTx(tx, {
        tenantId: fixture.tenantId,
        userId: fixture.userId,
        batchId: fixture.batchId,
      });
    }, { isolationLevel: "Serializable" });
  }

  async function wipKg(fixture: Fixture): Promise<number> {
    const rows = await client.lotPlacement.findMany({
      where: {
        tenantId: fixture.tenantId,
        lotId: fixture.lotId,
        location: { systemPurpose: "ROASTING_WIP" },
      },
    });
    return rows.reduce((sum, row) => sum + Number(row.quantityKg), 0);
  }

  async function normalKg(fixture: Fixture): Promise<number> {
    const row = await client.lotPlacement.findFirst({
      where: {
        tenantId: fixture.tenantId,
        lotId: fixture.lotId,
        locationId: fixture.sourceLocationId,
      },
    });
    return Number(row?.quantityKg ?? 0);
  }

  async function ledgerOutCount(fixture: Fixture): Promise<number> {
    return client.inventoryLedger.count({
      where: { tenantId: fixture.tenantId, entryType: "OUT" },
    });
  }

  it("blocks ordinary consumption of quantity committed to a CHARGED roast (10 → charge 8 → consume 5)", async () => {
    const fixture = await seedFixture();
    await charge(fixture);

    expect(Number((await client.product.findUnique({ where: { id: fixture.inputProductId } }))?.stockKg)).toBe(10);
    expect(await normalKg(fixture)).toBe(2);
    expect(await wipKg(fixture)).toBe(8);
    expect(await ledgerOutCount(fixture)).toBe(0);

    const attempt = await client.$transaction(
      (tx) => appendFefoLedgerOut(tx, {
        tenantId: fixture.tenantId,
        productId: fixture.inputProductId,
        refType: "EXPERIMENTAL_COMPONENT_OUT",
        refId: randomUUID(),
        quantityKg: 5,
        notes: "Consumsi eksperimen",
        createdById: fixture.userId,
      }),
      { isolationLevel: "Serializable" },
    ).then(
      () => ({ rejected: false as const }),
      (err: unknown) => ({ rejected: true as const, message: err instanceof Error ? err.message : String(err) }),
    );

    expect(attempt.rejected).toBe(true);

    const [stock, placements, outCount] = await Promise.all([
      client.product.findUnique({ where: { id: fixture.inputProductId } }),
      client.lotPlacement.findMany({
        where: { tenantId: fixture.tenantId, lotId: fixture.lotId },
        select: { locationId: true, quantityKg: true },
      }),
      ledgerOutCount(fixture),
    ]);
    expect(Number(stock?.stockKg)).toBe(10);
    expect(outCount).toBe(0);
    expect(placements.reduce((sum, row) => sum + Number(row.quantityKg), 0)).toBe(10);
    expect(await wipKg(fixture)).toBe(8);
    expect(await normalKg(fixture)).toBe(2);
  });

  it("allows ordinary consumption up to the non-WIP remainder, then completes cleanly (10 → charge 8 → consume 2 → complete)", async () => {
    const fixture = await seedFixture();
    await charge(fixture);

    await client.$transaction(
      (tx) => appendFefoLedgerOut(tx, {
        tenantId: fixture.tenantId,
        productId: fixture.inputProductId,
        refType: "EXPERIMENTAL_COMPONENT_OUT",
        refId: randomUUID(),
        quantityKg: 2,
        notes: "Konsumsi eksperimen",
        createdById: fixture.userId,
      }),
      { isolationLevel: "Serializable" },
    );

    expect(Number((await client.product.findUnique({ where: { id: fixture.inputProductId } }))?.stockKg)).toBe(8);
    expect(await normalKg(fixture)).toBe(0);
    expect(await wipKg(fixture)).toBe(8);

    await client.$transaction(
      (tx) => completeRoastInTx(tx, {
        tenantId: fixture.tenantId,
        userId: fixture.userId,
        batchId: fixture.batchId,
        actualOutputKg: 6.8,
        source: "INTEGRATION_TEST",
      }),
      { isolationLevel: "Serializable" },
    );

    const [input, output, batch, reservations] = await Promise.all([
      client.product.findUnique({ where: { id: fixture.inputProductId } }),
      client.product.findUnique({ where: { id: fixture.outputProductId } }),
      client.parentRoastingBatch.findUnique({ where: { id: fixture.batchId } }),
      client.roastMaterialReservation.findMany({ where: { parentBatchId: fixture.batchId } }),
    ]);
    expect(Number(input?.stockKg)).toBe(0);
    expect(Number(output?.stockKg)).toBe(6.8);
    expect(batch?.lifecycleStatus).toBe("COMPLETED");
    expect(reservations.every((row) => row.status === "CONSUMED")).toBe(true);
    expect(await wipKg(fixture)).toBe(0);
    expect(await normalKg(fixture)).toBe(0);
  });
});
