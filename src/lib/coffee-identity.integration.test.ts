import { randomUUID } from "node:crypto";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { withTenant } from "./prisma";
import { resolveTestDatabaseUrl } from "../../test/setup/test-database-guard";
import { coffeeSourceCreateDataFromProduct, normalizeCoffeeIdentity } from "./coffee-identity";

const integrationEnabled = process.env.RUN_INTEGRATION === "true";
const suite = integrationEnabled ? describe : describe.skip;

type Fixture = {
  tenantId: string;
  userId: string;
};

suite("coffee identity — real PostgreSQL (TEST_DATABASE_URL)", () => {
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
        await tx.auditLog.deleteMany({ where: { tenantId } });
        await tx.inventoryLedger.deleteMany({ where: { tenantId } });
        await tx.lot.deleteMany({ where: { tenantId } });
        await tx.product.deleteMany({ where: { tenantId } });
        await tx.coffeeSource.deleteMany({ where: { tenantId } });
        await tx.user.deleteMany({ where: { tenantId } });
        await tx.tenant.deleteMany({ where: { id: tenantId } });
      });
    }
    await client.$disconnect();
    await pool.end();
  });

  async function seedTenant(label: string): Promise<Fixture> {
    const suffix = randomUUID();
    const tenantId = `coffee-id-${suffix}`;
    const userId = `coffee-user-${suffix}`;
    tenantIds.push(tenantId);
    await client.tenant.create({
      data: { id: tenantId, code: `CI-${suffix}`, name: `Coffee Identity ${label}` },
    });
    await client.user.create({
      data: {
        id: userId,
        tenantId,
        name: "Coffee Identity Tester",
        email: `${suffix}@test.local`,
        password: "hashed-test-password",
      },
    });
    return { tenantId, userId };
  }

  async function createIdentityLinkedGb(
    tenantId: string,
    product: { code: string; name: string; species?: string | null; origin?: string | null },
    identity: Parameters<typeof normalizeCoffeeIdentity>[0],
  ) {
    const normalized = normalizeCoffeeIdentity({
      ...identity,
      name: product.name,
      species: product.species ?? identity.species,
      region: product.origin ?? identity.region,
    });
    const base = coffeeSourceCreateDataFromProduct(product);
    const source = await client.coffeeSource.create({
      data: {
        tenantId,
        code: base.code,
        name: normalized.name,
        country: normalized.country,
        region: normalized.region,
        farm: normalized.farm,
        species: normalized.species,
        varietal: normalized.varietal,
        processMethod: normalized.processMethod,
        fermentationMethod: normalized.fermentationMethod,
        elevation: normalized.elevation,
        cropYear: normalized.cropYear,
        certifications: normalized.certifications,
        tastingNotes: normalized.tastingNotes,
      },
    });
    const gb = await client.product.create({
      data: {
        tenantId,
        code: product.code,
        name: product.name,
        type: "GREEN_BEAN",
        coffeeSpecies: product.species ?? null,
        origin: product.origin ?? null,
        coffeeSourceId: source.id,
        stockKg: 25,
      },
    });
    return { source, gb };
  }

  it("keeps GB, RB, and downstream products under one identity", async () => {
    const fixture = await seedTenant("one-identity");
    const { source, gb } = await createIdentityLinkedGb(fixture.tenantId, {
      code: "GB-GAYO-FW-001",
      name: "Gayo Fully Washed",
      species: "ARABICA",
      origin: "Gayo, Aceh Tengah",
    }, {
      country: "Indonesia",
      farm: "Koperasi Atu Lintang",
      processMethod: "Full Washed",
      varietal: "Gayo 1",
      cropYear: "2025",
    });

    const rb = await client.product.create({
      data: {
        tenantId: fixture.tenantId,
        code: "RB-GAYO-FW-MED",
        name: "Gayo Fully Washed · Medium",
        type: "ROASTED_BEAN",
        roastLevel: "MEDIUM",
        sourceGreenBeanId: gb.id,
        coffeeSourceId: source.id,
        materialOrigin: "INTERNAL_ROAST",
      },
    });
    const fg = await client.product.create({
      data: {
        tenantId: fixture.tenantId,
        code: "FG-GAYO-FW-250",
        name: "Gayo Fully Washed 250g",
        type: "FINISHED_GOODS",
        category: "SPECIALTY",
      },
    });

    const linked = await client.coffeeSource.findUnique({
      where: { id: source.id },
      include: { products: { select: { id: true, type: true, coffeeSourceId: true, materialOrigin: true } } },
    });
    expect(linked?.products.map((p) => p.id).sort()).toEqual([gb.id, rb.id].sort());

    const rbRow = await client.product.findUnique({ where: { id: rb.id } });
    expect(rbRow?.coffeeSourceId).toBe(source.id);
    expect(rbRow?.materialOrigin).toBe("INTERNAL_ROAST");
    expect(rbRow?.sourceGreenBeanId).toBe(gb.id);

    const sourceRow = await client.coffeeSource.findUnique({ where: { id: source.id } });
    expect(sourceRow?.processMethod).toBe("Full Washed");
    expect(sourceRow?.farm).toBe("Koperasi Atu Lintang");
    // FG has no identity link — its material identity comes from the recipe.
    expect(fg.id).toBeTruthy();
  });

  it("keeps different processing methods as distinct identities", async () => {
    const fixture = await seedTenant("distinct-methods");
    const washed = await createIdentityLinkedGb(fixture.tenantId, {
      code: "GB-GAYO-WASHED",
      name: "Gayo Fully Washed",
      origin: "Gayo",
    }, { processMethod: "Full Washed" });
    const anaerobic = await createIdentityLinkedGb(fixture.tenantId, {
      code: "GB-GAYO-ANAEROBIC",
      name: "Gayo Anaerobic Natural",
      origin: "Gayo",
    }, { processMethod: "Anaerobic Natural" });

    expect(washed.source.id).not.toBe(anaerobic.source.id);
    expect(washed.source.code).not.toBe(anaerobic.source.code);
    const sources = await client.coffeeSource.findMany({
      where: { tenantId: fixture.tenantId },
      orderBy: { code: "asc" },
    });
    expect(sources).toHaveLength(2);
    expect(sources.map((s) => s.processMethod)).toEqual(["Anaerobic Natural", "Full Washed"]);
  });

  it("rejects cross-tenant product → coffeeSource links", async () => {
    const tenantA = await seedTenant("tenant-a");
    const tenantB = await seedTenant("tenant-b");
    const { source } = await createIdentityLinkedGb(tenantB.tenantId, {
      code: "GB-TENANT-B",
      name: "Tenant B Coffee",
    }, {});

    await expect(
      withTenant(tenantA.tenantId, client).product.create({
        data: {
          tenantId: tenantA.tenantId,
          code: "GB-TENANT-A",
          name: "Tenant A Coffee",
          type: "GREEN_BEAN",
          coffeeSourceId: source.id,
        },
      }),
    ).rejects.toThrow(/Cross-tenant Product\.coffeeSourceId write rejected/);
  });

  it("creates no inventory quantity or value changes during identity linkage", async () => {
    const fixture = await seedTenant("inventory-invariant");
    const { gb } = await createIdentityLinkedGb(fixture.tenantId, {
      code: "GB-INVARIANT",
      name: "Invariant Green Bean",
      species: "ROBUSTA",
      origin: "Toraja",
    }, {
      country: "Indonesia",
      tastingNotes: "Herbal, cokelat",
    });

    const row = await client.product.findUnique({
      where: { id: gb.id },
      select: { stockKg: true, stockUnit: true, lastHpp: true, avgCostPerKg: true },
    });
    expect(Number(row?.stockKg)).toBe(25);
    expect(row?.stockUnit).toBe(0);
    expect(Number(row?.avgCostPerKg ?? 0)).toBe(0);
    expect(Number(row?.lastHpp ?? 0)).toBe(0);

    const ledgerCount = await client.inventoryLedger.count({ where: { tenantId: fixture.tenantId } });
    expect(ledgerCount).toBe(0);
  });
});