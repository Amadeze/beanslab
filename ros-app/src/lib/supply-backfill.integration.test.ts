import { describe, expect, it, beforeAll, afterEach, afterAll } from "vitest";
import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import {
  SupplyBackfillCutoverBlockedError,
  backfillSupplyItems,
  runSupplyBackfillCutover,
  validateSupplyBackfill,
} from "./supply-backfill";
import { resolveTestDatabaseUrl } from "../../test/setup/test-database-guard";

const integrationEnabled = process.env.RUN_INTEGRATION === "true";
const suite = integrationEnabled ? describe : describe.skip;

const TEST_DATABASE_URL = integrationEnabled ? resolveTestDatabaseUrl() : "";

suite("supply backfill + validation — real PostgreSQL (TEST_DATABASE_URL)", () => {
  let client: PrismaClient;
  const cleanupIds: string[] = [];
  const log = () => {};

  beforeAll(async () => {
    const pool = new Pool({
      connectionString: TEST_DATABASE_URL,
      max: 5,
    });
    client = new PrismaClient({ adapter: new PrismaPg(pool) });
    await client.$connect();
  });

  async function cleanupTestData(ids: string[]) {
    if (!client || ids.length === 0) return;
    await client.$transaction(async (tx) => {
      await tx.recipeSupplyItem.deleteMany({
        where: {
          OR: [
            { recipeId: { in: ids } },
            { supplyItemId: { in: ids } },
          ],
        },
      });
      await tx.inventoryLedger.deleteMany({
        where: {
          OR: [
            { refId: { in: ids } },
            { createdById: { in: ids } },
            { packagingId: { in: ids } },
            { supplyItemId: { in: ids } },
            { lotId: { in: ids } },
          ],
        },
      });
      await tx.lot.deleteMany({
        where: {
          OR: [
            { id: { in: ids } },
            { packagingId: { in: ids } },
            { supplyItemId: { in: ids } },
          ],
        },
      });
      await tx.recipe.deleteMany({
        where: {
          OR: [
            { id: { in: ids } },
            { productId: { in: ids } },
            { packagingId: { in: ids } },
          ],
        },
      });
      await tx.packaging.deleteMany({
        where: {
          OR: [
            { id: { in: ids } },
            { supplyItemId: { in: ids } },
          ],
        },
      });
      await tx.inventorySupplyItem.deleteMany({
        where: {
          OR: [
            { id: { in: ids } },
            { tenantId: { in: ids } },
          ],
        },
      });
      await tx.product.deleteMany({
        where: {
          OR: [
            { id: { in: ids } },
            { tenantId: { in: ids } },
          ],
        },
      });
      await tx.user.deleteMany({
        where: {
          OR: [
            { id: { in: ids } },
            { tenantId: { in: ids } },
          ],
        },
      });
      await tx.tenant.deleteMany({ where: { id: { in: ids } } });
    });
  }

  afterEach(async () => {
    const ids = cleanupIds.splice(0);
    await cleanupTestData(ids);
  });

  afterAll(async () => {
    if (client) {
      try {
        await cleanupTestData(cleanupIds.splice(0));
      } finally {
        await client.$disconnect();
      }
    }
  });

  async function createTenant(tx: any, tenantId: string) {
    await tx.tenant.create({
      data: {
        id: tenantId,
        code: `SUPPLY-${tenantId}`,
        name: `Supply Tenant ${tenantId}`,
      },
    });
  }

  async function createUser(tx: any, userId: string, tenantId: string) {
    await tx.user.create({
      data: {
        id: userId,
        name: `Supply User ${userId}`,
        email: `${userId}@test.local`,
        password: "hashed-test-password",
        tenantId,
      },
    });
  }

  async function createProduct(
    tx: any,
    tenantId: string,
    productId: string,
  ) {
    await tx.product.create({
      data: {
        id: productId,
        tenantId,
        code: `FG-${productId}`,
        name: `FG ${productId}`,
        type: "FINISHED_GOODS",
      },
    });
  }

  async function createPackaging(
    tx: any,
    tenantId: string,
    packagingId: string,
    opts: { stockUnit?: number; code?: string } = {},
  ) {
    await tx.packaging.create({
      data: {
        id: packagingId,
        tenantId,
        code: opts.code ?? `PKG-${packagingId}`,
        name: `Packaging ${packagingId}`,
        weightGrams: 8.5,
        costPerUnit: 1250,
        avgCostPerUnit: 1200,
        stockUnit: opts.stockUnit ?? 0,
      },
    });
  }

  async function createPackagingLedger(
    tx: any,
    tenantId: string,
    packagingId: string,
    entryType: "IN" | "OUT",
    quantityUnit: number,
    refId: string,
    createdById: string,
  ) {
    await tx.inventoryLedger.create({
      data: {
        tenantId,
        packagingId,
        entryType,
        refType:
          entryType === "IN" ? ("PURCHASE_PKG" as const) : ("PRODUCTION_PKG_OUT" as const),
        refId,
        quantityKg: null,
        quantityUnit,
        supplyQuantity: null,
        createdById,
      },
    });
  }

  async function createRecipe(
    tx: any,
    tenantId: string,
    recipeId: string,
    productId: string,
    packagingId: string,
  ) {
    await tx.recipe.create({
      data: {
        id: recipeId,
        tenantId,
        code: `RCP-${recipeId}`,
        name: `Recipe ${recipeId}`,
        productId,
        packagingId,
        outputGrams: 250,
      },
    });
  }

  it("zero-loss: every packaging mapped, supply item mirrors data, cached stockUnit untouched", async () => {
    const tenantId = `tenant-zeroloss-${Date.now()}`;
    const userId = `user-zeroloss-${Date.now()}`;
    const packagingId = `pkg-zeroloss-${Date.now()}`;
    cleanupIds.push(tenantId, userId, packagingId);

    await client.$transaction(async (tx) => {
      await createTenant(tx, tenantId);
      await createUser(tx, userId, tenantId);
      await createPackaging(tx, tenantId, packagingId, { stockUnit: 7 });
      await createPackagingLedger(tx, tenantId, packagingId, "IN", 4, `ref-in1-${Date.now()}`, userId);
      await createPackagingLedger(tx, tenantId, packagingId, "IN", 3, `ref-in2-${Date.now()}`, userId);
      await createPackagingLedger(tx, tenantId, packagingId, "IN", 2, `ref-in3-${Date.now()}`, userId);
      await createPackagingLedger(tx, tenantId, packagingId, "OUT", 2, `ref-out-${Date.now()}`, userId);
    });

    const summary = await backfillSupplyItems(client, log);
    expect(summary.supplyItemsCreated).toBe(1);

    const packaging = await client.packaging.findUnique({
      where: { id: packagingId },
      include: { supplyItem: true },
    });
    expect(packaging?.supplyItemId).not.toBeNull();
    expect(packaging?.supplyItem).not.toBeNull();

    const supplyItem = packaging!.supplyItem!;
    expect(supplyItem.tenantId).toBe(tenantId);
    expect(supplyItem.category).toBe("PACKAGING");
    expect(supplyItem.baseUnit).toBe("PCS");
    expect(Number(supplyItem.tareWeightGrams)).toBe(8.5);
    expect(supplyItem.capacityGrams).toBeNull();
    expect(Number(supplyItem.costPerUnit)).toBe(1250);
    expect(Number(supplyItem.avgCostPerUnit)).toBe(1200);
    expect(Number(supplyItem.stockQuantity)).toBe(7);

    expect(Number(packaging!.stockUnit)).toBe(7);

    const validation = await validateSupplyBackfill(client, log);
    expect(validation.ok).toBe(true);
    expect(validation.issues).toEqual([]);
  });

  it("stockQuantity derives from ledger (not copied from Packaging.stockUnit)", async () => {
    const tenantId = `tenant-ledgerqty-${Date.now()}`;
    const userId = `user-ledgerqty-${Date.now()}`;
    const packagingId = `pkg-ledgerqty-${Date.now()}`;
    cleanupIds.push(tenantId, userId, packagingId);

    await client.$transaction(async (tx) => {
      await createTenant(tx, tenantId);
      await createUser(tx, userId, tenantId);
      await createPackaging(tx, tenantId, packagingId, { stockUnit: 99 });
      await createPackagingLedger(tx, tenantId, packagingId, "IN", 3, `ref-a-${Date.now()}`, userId);
      await createPackagingLedger(tx, tenantId, packagingId, "IN", 2, `ref-b-${Date.now()}`, userId);
      await createPackagingLedger(tx, tenantId, packagingId, "OUT", 1, `ref-c-${Date.now()}`, userId);
    });

    await backfillSupplyItems(client, log);

    const packaging = await client.packaging.findUnique({
      where: { id: packagingId },
      include: { supplyItem: true },
    });
    const supplyItem = packaging!.supplyItem!;
    expect(Number(supplyItem.stockQuantity)).toBe(4);
    expect(Number(supplyItem.stockQuantity)).not.toBe(99);
    expect(Number(packaging!.stockUnit)).toBe(99);
  });

  it("idempotent rerun: second run creates nothing and adds no duplicates", async () => {
    const tenantId = `tenant-idep-${Date.now()}`;
    const userId = `user-idep-${Date.now()}`;
    const packagingId = `pkg-idep-${Date.now()}`;
    cleanupIds.push(tenantId, userId, packagingId);

    await client.$transaction(async (tx) => {
      await createTenant(tx, tenantId);
      await createUser(tx, userId, tenantId);
      await createPackaging(tx, tenantId, packagingId, { stockUnit: 2 });
      await createPackagingLedger(tx, tenantId, packagingId, "IN", 2, `ref-idep-${Date.now()}`, userId);
    });

    const first = await backfillSupplyItems(client, log);
    const second = await backfillSupplyItems(client, log);

    expect(first.supplyItemsCreated).toBe(1);
    expect(second.supplyItemsCreated).toBe(0);
    expect(second.recipeLinksCreated).toBe(0);

    const supplyItems = await client.inventorySupplyItem.findMany({
      where: { tenantId, category: "PACKAGING" },
    });
    expect(supplyItems.length).toBe(1);

    const validation = await validateSupplyBackfill(client, log);
    expect(validation.ok).toBe(true);
  });

  it("tenant isolation: identical packaging codes across tenants produce no cross-tenant mapping", async () => {
    const tenantA = `tenant-iso-a-${Date.now()}`;
    const tenantB = `tenant-iso-b-${Date.now()}`;
    const userIdA = `user-iso-a-${Date.now()}`;
    const userIdB = `user-iso-b-${Date.now()}`;
    const pkgA = `pkg-iso-a-${Date.now()}`;
    const pkgB = `pkg-iso-b-${Date.now()}`;
    cleanupIds.push(tenantA, tenantB, userIdA, userIdB, pkgA, pkgB);

    await client.$transaction(async (tx) => {
      await createTenant(tx, tenantA);
      await createTenant(tx, tenantB);
      await createUser(tx, userIdA, tenantA);
      await createUser(tx, userIdB, tenantB);
      await createPackaging(tx, tenantA, pkgA, { code: "SHARED-CODE" });
      await createPackaging(tx, tenantB, pkgB, { code: "SHARED-CODE" });
    });

    await backfillSupplyItems(client, log);

    const supplyA = await client.packaging.findUnique({
      where: { id: pkgA },
      include: { supplyItem: true },
    });
    const supplyB = await client.packaging.findUnique({
      where: { id: pkgB },
      include: { supplyItem: true },
    });

    expect(supplyA?.supplyItem?.tenantId).toBe(tenantA);
    expect(supplyB?.supplyItem?.tenantId).toBe(tenantB);
    expect(supplyA?.supplyItem?.id).not.toBe(supplyB?.supplyItem?.id);

    const validation = await validateSupplyBackfill(client, log);
    expect(validation.ok).toBe(true);
  });

  it("cache mismatch blocks cutover with a per-item report", async () => {
    const tenantId = `tenant-block-${Date.now()}`;
    const userId = `user-block-${Date.now()}`;
    const packagingId = `pkg-block-${Date.now()}`;
    cleanupIds.push(tenantId, userId, packagingId);

    await client.$transaction(async (tx) => {
      await createTenant(tx, tenantId);
      await createUser(tx, userId, tenantId);
      await createPackaging(tx, tenantId, packagingId, { stockUnit: 50 });
      await createPackagingLedger(tx, tenantId, packagingId, "IN", 3, `ref-block-${Date.now()}`, userId);
    });

    await expect(
      runSupplyBackfillCutover(client, log),
    ).rejects.toBeInstanceOf(SupplyBackfillCutoverBlockedError);

    const validation = await validateSupplyBackfill(client, log);
    expect(validation.ok).toBe(false);
    const mismatch = validation.issues.find((i) => i.code === "LEDGER_CACHE_MISMATCH");
    expect(mismatch).toBeDefined();
    expect(mismatch!.itemCode).toBe(`PKG-${packagingId}`);
    expect(mismatch!.message).toContain("50");
    expect(mismatch!.message).toContain("3");
  });

  it("historical ledger untouched: no row mutated, no row gains supplyItemId", async () => {
    const tenantId = `tenant-ledger-${Date.now()}`;
    const userId = `user-ledger-${Date.now()}`;
    const packagingId = `pkg-ledger-${Date.now()}`;
    const refIds = [
      `ref-hist-1-${Date.now()}`,
      `ref-hist-2-${Date.now()}`,
      `ref-hist-3-${Date.now()}`,
    ];
    cleanupIds.push(tenantId, userId, packagingId, ...refIds);

    await client.$transaction(async (tx) => {
      await createTenant(tx, tenantId);
      await createUser(tx, userId, tenantId);
      await createPackaging(tx, tenantId, packagingId, { stockUnit: 2 });
      await createPackagingLedger(tx, tenantId, packagingId, "IN", 3, refIds[0], userId);
      await createPackagingLedger(tx, tenantId, packagingId, "IN", 1, refIds[1], userId);
      await createPackagingLedger(tx, tenantId, packagingId, "OUT", 2, refIds[2], userId);
    });

    const before = await client.inventoryLedger.findMany({
      where: { packagingId },
      orderBy: { refId: "asc" },
    });

    await backfillSupplyItems(client, log);

    const after = await client.inventoryLedger.findMany({
      where: { packagingId },
      orderBy: { refId: "asc" },
    });

    expect(after.length).toBe(before.length);
    for (let i = 0; i < before.length; i++) {
      expect(after[i]!.id).toBe(before[i]!.id);
      expect(after[i]!.quantityUnit).toBe(before[i]!.quantityUnit);
      expect(after[i]!.entryType).toBe(before[i]!.entryType);
      expect(after[i]!.supplyItemId).toBeNull();
      expect(after[i]!.packagingId).toBe(packagingId);
    }

    const validation = await validateSupplyBackfill(client, log);
    expect(validation.ok).toBe(true);
    expect(validation.issues.some((i) => i.code === "XOR_VIOLATION")).toBe(false);
  });

  it("recipe legacy packaging backfills exactly one RecipeSupplyItem, no duplicates on rerun", async () => {
    const tenantId = `tenant-recipe-${Date.now()}`;
    const userId = `user-recipe-${Date.now()}`;
    const packagingId = `pkg-recipe-${Date.now()}`;
    const productId = `prod-recipe-${Date.now()}`;
    const recipeId = `rcp-recipe-${Date.now()}`;
    cleanupIds.push(tenantId, userId, packagingId, productId, recipeId);

    await client.$transaction(async (tx) => {
      await createTenant(tx, tenantId);
      await createUser(tx, userId, tenantId);
      await createProduct(tx, tenantId, productId);
      await createPackaging(tx, tenantId, packagingId);
      await createRecipe(tx, tenantId, recipeId, productId, packagingId);
    });

    await backfillSupplyItems(client, log);
    await backfillSupplyItems(client, log);

    const packaging = await client.packaging.findUnique({
      where: { id: packagingId },
      select: { supplyItemId: true },
    });
    const supplyItemId = packaging!.supplyItemId;

    const links = await client.recipeSupplyItem.findMany({
      where: { recipeId, supplyItemId: supplyItemId! },
    });
    expect(links.length).toBe(1);
    expect(Number(links[0]!.quantityPerUnit)).toBe(1);

    const validation = await validateSupplyBackfill(client, log);
    expect(validation.ok).toBe(true);
  });
});