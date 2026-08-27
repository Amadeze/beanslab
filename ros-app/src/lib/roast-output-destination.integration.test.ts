import { randomUUID } from "node:crypto";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

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
  defaultLocationId: string;
  secondaryLocationId: string;
  batchId: string;
  lotIds: string[];
};

suite("roast output destination — real PostgreSQL (TEST_DATABASE_URL)", () => {
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
    const tenantId = `roast-dest-${suffix}`;
    const userId = `roast-dest-user-${suffix}`;
    tenantIds.push(tenantId);

    return client.$transaction(async (tx) => {
      await tx.tenant.create({
        data: { id: tenantId, code: `RD-${suffix}`, name: `Roast Destination ${suffix}` },
      });
      await tx.user.create({
        data: {
          id: userId,
          tenantId,
          name: "Roast Destination Tester",
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
        data: { tenantId, code: "WH-01", name: "Gudang Utama", isDefault: true },
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
      const secondary = await tx.location.create({
        data: {
          tenantId,
          warehouseId: warehouse.id,
          code: "RB-B02",
          name: "Rak Roasted Bean",
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
        defaultLocationId: source.id,
        secondaryLocationId: secondary.id,
      };
      const batch = await createBatch(tx, base, targetWeightKg);
      return { ...base, batchId: batch.id, lotIds };
    });
  }

  const lifecycleInput = (fixture: Fixture) => ({
    tenantId: fixture.tenantId,
    userId: fixture.userId,
    batchId: fixture.batchId,
  });

  async function chargeBatch(fixture: Fixture) {
    await client.$transaction(async (tx) => {
      await reserveRoastMaterialsInTx(tx, lifecycleInput(fixture));
      await chargeRoastMaterialsInTx(tx, lifecycleInput(fixture));
    }, { isolationLevel: "Serializable" });
  }

  async function outputPlacement(fixture: Fixture) {
    return client.lotPlacement.findMany({
      where: {
        tenantId: fixture.tenantId,
        lot: {
          productId: fixture.outputProductId,
          batchCode: { endsWith: "-RB" },
        },
      },
      include: {
        lot: { select: { batchCode: true } },
        location: { select: { name: true, warehouse: { select: { name: true } } } },
      },
    });
  }

  it("places the Roasted Bean at an explicit normal destination", async () => {
    const fixture = await seedFixture([10], 10);
    await chargeBatch(fixture);

    await client.$transaction(
      (tx) => completeRoastInTx(tx, {
        ...lifecycleInput(fixture),
        actualOutputKg: 8.5,
        destinationLocationId: fixture.secondaryLocationId,
        source: "INTEGRATION_TEST",
      }),
      { isolationLevel: "Serializable" },
    );

    const placements = await outputPlacement(fixture);
    expect(placements).toHaveLength(1);
    expect(placements[0]?.locationId).toBe(fixture.secondaryLocationId);
    expect(Number(placements[0]?.quantityKg)).toBe(8.5);
    // Recap-style read: the persisted placement carries the warehouse label.
    expect(placements[0]?.lot.batchCode.endsWith("-RB")).toBe(true);
    expect(placements[0]?.location.name).toBe("Rak Roasted Bean");
    expect(placements[0]?.location.warehouse.name).toBe("Gudang Utama");
  });

  it("falls back to the default location when no destination is provided", async () => {
    const fixture = await seedFixture([10], 10);
    await chargeBatch(fixture);

    await client.$transaction(
      (tx) => completeRoastInTx(tx, {
        ...lifecycleInput(fixture),
        actualOutputKg: 8.5,
        source: "INTEGRATION_TEST",
      }),
      { isolationLevel: "Serializable" },
    );

    const placements = await outputPlacement(fixture);
    expect(placements).toHaveLength(1);
    expect(placements[0]?.locationId).toBe(fixture.defaultLocationId);
    expect(Number(placements[0]?.quantityKg)).toBe(8.5);
  });

  it("rejects a system destination and leaves no output inventory", async () => {
    const fixture = await seedFixture([10], 10);
    await chargeBatch(fixture);
    const system = await client.location.create({
      data: {
        tenantId: fixture.tenantId,
        warehouseId: fixture.warehouseId,
        code: "SYS-TEST-WIP",
        name: "Roasting WIP Test",
        isSystem: true,
      },
    });
    tenantIds.push(fixture.tenantId);

    await expect(
      client.$transaction(
        (tx) => completeRoastInTx(tx, {
          ...lifecycleInput(fixture),
          actualOutputKg: 8.5,
          destinationLocationId: system.id,
          source: "INTEGRATION_TEST",
        }),
        { isolationLevel: "Serializable" },
      ),
    ).rejects.toThrow("Lokasi tujuan Roasted Bean tidak valid untuk tenant ini.");

    expect(await outputPlacement(fixture)).toHaveLength(0);
  });

  it("rejects inactive and cross-tenant destinations", async () => {
    const fixture = await seedFixture([10], 10);
    await chargeBatch(fixture);

    const inactive = await client.location.create({
      data: {
        tenantId: fixture.tenantId,
        warehouseId: fixture.warehouseId,
        code: "RB-INACTIVE",
        name: "Rak Nonaktif",
        isActive: false,
      },
    });

    const otherTenantId = `roast-dest-other-${randomUUID()}`;
    tenantIds.push(otherTenantId);
    const other = await client.$transaction(async (tx) => {
      await tx.tenant.create({
        data: { id: otherTenantId, code: `RO-${randomUUID()}`, name: "Other Tenant" },
      });
      const warehouse = await tx.warehouse.create({
        data: { tenantId: otherTenantId, code: "WH-01", name: "Gudang Lain" },
      });
      return tx.location.create({
        data: {
          tenantId: otherTenantId,
          warehouseId: warehouse.id,
          code: "A-01",
          name: "Lokasi Tenant Lain",
        },
      });
    });

    for (const invalidId of [inactive.id, other.id]) {
      await expect(
        client.$transaction(
          (tx) => completeRoastInTx(tx, {
            ...lifecycleInput(fixture),
            actualOutputKg: 8.5,
            destinationLocationId: invalidId,
            source: "INTEGRATION_TEST",
          }),
          { isolationLevel: "Serializable" },
        ),
      ).rejects.toThrow("Lokasi tujuan Roasted Bean tidak valid untuk tenant ini.");
    }

    expect(await outputPlacement(fixture)).toHaveLength(0);
  });
});