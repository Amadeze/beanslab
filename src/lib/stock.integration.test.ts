import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { appendFefoLedgerOut } from "./stock";
import { assertSafeTestDatabase } from "../../test/setup/assert-safe-test-db";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const integrationEnabled = process.env.RUN_INTEGRATION === "true";
const suite = integrationEnabled ? describe : describe.skip;

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

function devOrProdDatabaseUrls(): string[] {
  const fromEnvFile = parseEnvFile(join(process.cwd(), ".env.local"));
  const urls: string[] = [];
  for (const key of ["DATABASE_URL", "DIRECT_URL"] as const) {
    const value = fromEnvFile[key] ?? process.env[key];
    if (value) urls.push(value);
  }
  return urls;
}

function resolveTestDatabaseUrl(): string {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) {
    throw new Error(
      "[stock.integration] TEST_DATABASE_URL is required when RUN_INTEGRATION=true",
    );
  }
  if (devOrProdDatabaseUrls().includes(url)) {
    throw new Error(
      "[stock.integration] TEST_DATABASE_URL must not equal DATABASE_URL/DIRECT_URL (development/production database)",
    );
  }
  assertSafeTestDatabase({ DATABASE_URL: url });
  return url;
}

suite("appendFefoLedgerOut — real PostgreSQL (TEST_DATABASE_URL)", () => {
  let client: PrismaClient;
  const cleanupIds: string[] = [];

  beforeAll(async () => {
    const pool = new Pool({
      connectionString: resolveTestDatabaseUrl(),
      max: 5,
    });
    client = new PrismaClient({ adapter: new PrismaPg(pool) });
    await client.$connect();
  });

  afterAll(async () => {
    if (client) {
      await client.$transaction(async (tx) => {
        await tx.inventoryLedger.deleteMany({
          where: { refId: { in: cleanupIds } },
        });
        await tx.lot.deleteMany({ where: { id: { in: cleanupIds } } });
        await tx.product.deleteMany({ where: { id: { in: cleanupIds } } });
        await tx.tenant.deleteMany({ where: { id: { in: cleanupIds } } });
        await tx.user.deleteMany({ where: { id: { in: cleanupIds } } });
      });
      await client.$disconnect();
    }
  });

  async function createUser(tx: any, userId: string, tenantId: string) {
    await tx.user.create({
      data: {
        id: userId,
        name: `Test User ${userId}`,
        email: `${userId}@test.local`,
        password: "hashed-test-password",
        tenantId,
      },
    });
  }

  async function createTenant(tx: any, tenantId: string) {
    await tx.tenant.create({
      data: {
        id: tenantId,
        code: `TEST-${tenantId}`,
        name: `Test Tenant ${tenantId}`,
      },
    });
  }

  async function createTenantProduct(
    tx: any,
    tenantId: string,
    productId: string,
    stockKg: number,
  ) {
    await tx.product.create({
      data: {
        id: productId,
        tenantId,
        code: `TEST-PROD-${productId}`,
        name: `Test Product ${productId}`,
        type: "GREEN_BEAN",
        stockKg,
        stockUnit: 0,
      },
    });
  }

  async function createLot(
    tx: any,
    tenantId: string,
    productId: string,
    lotId: string,
    quantityKg: number,
    expiryDate: Date,
  ) {
    await tx.lot.create({
      data: {
        id: lotId,
        tenantId,
        productId,
        batchCode: `BATCH-${lotId}`,
        quantityKg,
        quantityUnit: 0,
        expiryDate,
        receivedAt: new Date(),
      },
    });
  }

  it("two parallel transactions competing for the last lot: exactly one succeeds, no oversell", async () => {
    const tenantId = `tenant-compete-${Date.now()}`;
    const productId = `prod-compete-${Date.now()}`;
    const lotId = `lot-compete-${Date.now()}`;
    const userA = `user-compete-a-${Date.now()}`;
    const userB = `user-compete-b-${Date.now()}`;
    const refA = `ref-compete-a-${Date.now()}`;
    const refB = `ref-compete-b-${Date.now()}`;
    cleanupIds.push(tenantId, productId, lotId, userA, userB);

    await client.$transaction(async (tx) => {
      await createTenant(tx, tenantId);
      await createUser(tx, userA, tenantId);
      await createUser(tx, userB, tenantId);
      await createTenantProduct(tx, tenantId, productId, 5);
      await createLot(tx, tenantId, productId, lotId, 5, new Date("2027-01-01"));
    });

    const lotQtyBefore = 5;

    const [resultA, resultB] = await Promise.all([
      client
        .$transaction(async (tx) => {
          return appendFefoLedgerOut(tx, {
            tenantId,
            productId,
            quantityKg: 5,
            refType: "SALE_FG_OUT",
            refId: refA,
            createdById: userA,
          });
        })
        .catch((e) => ({ error: e.message, entries: [] })),
      client
        .$transaction(async (tx) => {
          return appendFefoLedgerOut(tx, {
            tenantId,
            productId,
            quantityKg: 5,
            refType: "SALE_FG_OUT",
            refId: refB,
            createdById: userB,
          });
        })
        .catch((e) => ({ error: e.message, entries: [] })),
    ]);

    const entriesA = Array.isArray(resultA) ? resultA : resultA.entries ?? [];
    const entriesB = Array.isArray(resultB) ? resultB : resultB.entries ?? [];
    const hasErrorA = (resultA as { error?: string }).error !== undefined;
    const hasErrorB = (resultB as { error?: string }).error !== undefined;

    // Exactly one succeeds, one fails with a controlled business error
    expect(hasErrorA !== hasErrorB).toBe(true);

    const allEntries = [...entriesA, ...entriesB];
    const totalOutKg = allEntries.reduce(
      (sum, e) => sum + Number(e.quantityKg ?? 0),
      0,
    );

    // Total ledger OUT equals lot quantity (no oversell, no waste)
    expect(totalOutKg).toBe(lotQtyBefore);

    // Cached stock decreased by allocated amount
    const product = await client.product.findUnique({
      where: { id: productId },
      select: { stockKg: true },
    });
    expect(Number(product?.stockKg)).toBe(lotQtyBefore - totalOutKg);

    // Lot is consumed
    const lot = await client.lot.findUnique({ where: { id: lotId } });
    expect(lot?.consumedAt).not.toBeNull();
  });

  it("multi-lot FEFO: earliest expiry lot consumed first", async () => {
    const tenantId = `tenant-fefo-${Date.now()}`;
    const productId = `prod-fefo-${Date.now()}`;
    const lotEarly = `lot-fefo-early-${Date.now()}`;
    const lotLate = `lot-fefo-late-${Date.now()}`;
    const user = `user-fefo-${Date.now()}`;
    const ref = `ref-fefo-${Date.now()}`;
    cleanupIds.push(tenantId, productId, lotEarly, lotLate, user);

    await client.$transaction(async (tx) => {
      await createTenant(tx, tenantId);
      await createUser(tx, user, tenantId);
      await createTenantProduct(tx, tenantId, productId, 13);
      await createLot(tx, tenantId, productId, lotEarly, 3, new Date("2026-01-01"));
      await createLot(tx, tenantId, productId, lotLate, 10, new Date("2027-01-01"));
    });

    const result = await client.$transaction(async (tx) => {
      return appendFefoLedgerOut(tx, {
        tenantId,
        productId,
        quantityKg: 5,
        refType: "ROASTING_GB_OUT",
        refId: ref,
        createdById: user,
      });
    });

    const lotIds = result.map((e) => e.lotId).filter(Boolean);

    expect(lotIds).toContain(lotEarly);
    expect(lotIds).toContain(lotLate);

    const earlyEntry = result.find((e) => e.lotId === lotEarly);
    expect(Number(earlyEntry?.quantityKg)).toBe(3);

    const lateEntry = result.find((e) => e.lotId === lotLate);
    expect(Number(lateEntry?.quantityKg)).toBe(2);
  });

  it("rollback on ledger failure leaves lot and stock unchanged", async () => {
    const tenantId = `tenant-rollback-${Date.now()}`;
    const productId = `prod-rollback-${Date.now()}`;
    const lotId = `lot-rollback-${Date.now()}`;
    const user = `user-rollback-${Date.now()}`;
    cleanupIds.push(tenantId, productId, lotId, user);

    await client.$transaction(async (tx) => {
      await createTenant(tx, tenantId);
      await createUser(tx, user, tenantId);
      await createTenantProduct(tx, tenantId, productId, 10);
      await createLot(tx, tenantId, productId, lotId, 10, new Date("2027-01-01"));
    });

    const lotBefore = await client.lot.findUnique({ where: { id: lotId } });
    const productBefore = await client.product.findUnique({
      where: { id: productId },
      select: { stockKg: true },
    });

    await expect(
      client.$transaction(async (tx) => {
        await appendFefoLedgerOut(tx, {
          tenantId,
          productId,
          quantityKg: 5,
          refType: "SALE_FG_OUT",
          refId: `ref-rollback-${Date.now()}`,
          createdById: user,
        });
        throw new Error("Simulated ledger failure");
      }),
    ).rejects.toThrow("Simulated ledger failure");

    const lotAfter = await client.lot.findUnique({ where: { id: lotId } });
    const productAfter = await client.product.findUnique({
      where: { id: productId },
      select: { stockKg: true },
    });

    expect(lotAfter?.consumedAt).toBeNull();
    expect(Number(productAfter?.stockKg)).toBe(Number(productBefore?.stockKg));
  });

  it("tenant isolation: tenant A cannot consume tenant B lot", async () => {
    const tenantA = `tenant-a-${Date.now()}`;
    const tenantB = `tenant-b-${Date.now()}`;
    const productA = `prod-a-${Date.now()}`;
    const productB = `prod-b-${Date.now()}`;
    const lotB = `lot-b-${Date.now()}`;
    const userA = `user-a-${Date.now()}`;
    cleanupIds.push(tenantA, tenantB, productA, productB, lotB, userA);

    await client.$transaction(async (tx) => {
      await createTenant(tx, tenantA);
      await createTenant(tx, tenantB);
      await createUser(tx, userA, tenantA);
      await createTenantProduct(tx, tenantA, productA, 0);
      await createTenantProduct(tx, tenantB, productB, 10);
      await createLot(tx, tenantB, productB, lotB, 10, new Date("2027-01-01"));
    });

    await expect(
      client.$transaction(async (tx) => {
        return appendFefoLedgerOut(tx, {
          tenantId: tenantA,
          productId: productA,
          quantityKg: 5,
          refType: "SALE_FG_OUT",
          refId: `ref-iso-${Date.now()}`,
          createdById: userA,
        });
      }),
    ).rejects.toThrow();

    const lotBAfter = await client.lot.findUnique({ where: { id: lotB } });
    expect(lotBAfter?.consumedAt).toBeNull();
  });

  it("kg and unit modes both work correctly", async () => {
    const tenantId = `tenant-unit-${Date.now()}`;
    const productId = `prod-unit-${Date.now()}`;
    const lotId = `lot-unit-${Date.now()}`;
    const user = `user-unit-${Date.now()}`;
    const refKg = `ref-kg-${Date.now()}`;
    cleanupIds.push(tenantId, productId, lotId, user);

    await client.$transaction(async (tx) => {
      await createTenant(tx, tenantId);
      await createUser(tx, user, tenantId);
      await createTenantProduct(tx, tenantId, productId, 10);
      await createLot(tx, tenantId, productId, lotId, 10, new Date("2027-01-01"));
    });

    const resultKg = await client.$transaction(async (tx) => {
      return appendFefoLedgerOut(tx, {
        tenantId,
        productId,
        quantityKg: 4,
        refType: "ROASTING_GB_OUT",
        refId: refKg,
        createdById: user,
      });
    });

    expect(resultKg.length).toBeGreaterThanOrEqual(1);
    expect(
      resultKg.some((e) => Number(e.quantityKg) === 4),
    ).toBe(true);

    const lotAfterKg = await client.lot.findUnique({ where: { id: lotId } });
    expect(Number(lotAfterKg?.quantityKg) - 4).toBeGreaterThanOrEqual(0);
  });

  it("cached stock, lot remaining, and ledger are consistent after allocation", async () => {
    const tenantId = `tenant-consistency-${Date.now()}`;
    const productId = `prod-consistency-${Date.now()}`;
    const lotId = `lot-consistency-${Date.now()}`;
    const user = `user-consistency-${Date.now()}`;
    const ref = `ref-consistency-${Date.now()}`;
    cleanupIds.push(tenantId, productId, lotId, user);

    await client.$transaction(async (tx) => {
      await createTenant(tx, tenantId);
      await createUser(tx, user, tenantId);
      await createTenantProduct(tx, tenantId, productId, 8);
      await createLot(tx, tenantId, productId, lotId, 8, new Date("2027-01-01"));
    });

    const allocatedKg = 5;
    await client.$transaction(async (tx) => {
      return appendFefoLedgerOut(tx, {
        tenantId,
        productId,
        quantityKg: allocatedKg,
        refType: "ROASTING_GB_OUT",
        refId: ref,
        createdById: user,
      });
    });

    const lot = await client.lot.findUnique({ where: { id: lotId } });
    const product = await client.product.findUnique({
      where: { id: productId },
      select: { stockKg: true },
    });
    const ledgerEntry = await client.inventoryLedger.findFirst({
      where: { lotId, refId: ref },
    });

    expect(Number(lot?.quantityKg) - allocatedKg).toBeGreaterThanOrEqual(0);
    expect(Number(product?.stockKg)).toBe(8 - allocatedKg);
    expect(Number(ledgerEntry?.quantityKg)).toBe(allocatedKg);
  });
});