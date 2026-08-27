import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { loadStorefrontCatalog } from "@/lib/storefront-catalog";
import { assertSafeTestDatabase } from "../../test/setup/assert-safe-test-db";

const integrationEnabled = process.env.RUN_INTEGRATION === "true";
const suite = integrationEnabled ? describe : describe.skip;
const TENANT_ID = "test-storefront-catalog";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

function testDatabaseUrl(): string {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) throw new Error("[storefront-catalog.integration] TEST_DATABASE_URL is required");
  assertSafeTestDatabase({ DATABASE_URL: url });
  return url;
}

suite("loadStorefrontCatalog — price > 0 gate (Phase 2D.1)", () => {
  let client: PrismaClient;

  async function cleanup(tx: any) {
    await tx.product.deleteMany({ where: { tenantId: TENANT_ID } });
    await tx.coffeeOffering.deleteMany({ where: { tenantId: TENANT_ID } });
    await tx.user.deleteMany({ where: { tenantId: TENANT_ID } });
    await tx.tenant.deleteMany({ where: { id: TENANT_ID } });
  }

  beforeAll(async () => {
    const pool = new Pool({ connectionString: testDatabaseUrl(), max: 3 });
    client = new PrismaClient({ adapter: new PrismaPg(pool) });
    await client.$connect();
  });

  beforeEach(async () => {
    await client.$transaction(async (tx) => {
      await cleanup(tx);
      await tx.tenant.create({ data: { id: TENANT_ID, code: TENANT_ID, name: "Storefront Catalog" } });
      await tx.user.create({ data: { id: `user-${TENANT_ID}`, tenantId: TENANT_ID, name: "System", email: "catalog@test.local", password: "hashed" } });
    });
  });

  afterAll(async () => {
    if (!client) return;
    await client.$transaction(async (tx) => cleanup(tx));
    await client.$disconnect();
  });

  async function createFg(tx: any, id: string, price: number | null) {
    await tx.product.create({
      data: {
        id,
        tenantId: TENANT_ID,
        code: id,
        name: `FG ${id}`,
        type: "FINISHED_GOODS",
        isActive: true,
        stockKg: 0,
        stockUnit: 10,
        price,
      },
    });
  }

  it("excludes finished goods without a retail price (experimental products)", async () => {
    await client.$transaction(async (tx) => {
      await createFg(tx, `fg-null-${Date.now()}`, null);
    });

    const catalog = await loadStorefrontCatalog(client, TENANT_ID);
    expect(catalog.products).toHaveLength(0);
  });

  it("excludes finished goods whose retail price is 0", async () => {
    await client.$transaction(async (tx) => {
      await createFg(tx, `fg-zero-${Date.now()}`, 0);
    });

    const catalog = await loadStorefrontCatalog(client, TENANT_ID);
    expect(catalog.products).toHaveLength(0);
  });

  it("includes finished goods with a positive retail price", async () => {
    const id = `fg-priced-${Date.now()}`;
    await client.$transaction(async (tx) => {
      await createFg(tx, id, 80_000);
    });

    const catalog = await loadStorefrontCatalog(client, TENANT_ID);
    expect(catalog.products).toHaveLength(1);
    expect(catalog.products[0]!.id).toBe(id);
    expect(catalog.products[0]!.price).toBe(80_000);
  });

  it("shows only priced products when both kinds exist", async () => {
    const pricedId = `fg-mix-priced-${Date.now()}`;
    const unpricedId = `fg-mix-unpriced-${Date.now()}`;
    await client.$transaction(async (tx) => {
      await createFg(tx, pricedId, 80_000);
      await createFg(tx, unpricedId, null);
    });

    const catalog = await loadStorefrontCatalog(client, TENANT_ID);
    expect(catalog.products).toHaveLength(1);
    expect(catalog.products[0]!.id).toBe(pricedId);
  });
});
