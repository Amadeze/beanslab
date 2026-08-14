import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { promoteExperimentalToCatalog } from "@/app/(dashboard)/eksperimen/promote-actions";
import { loadStorefrontCatalog } from "@/lib/storefront-catalog";
import { assertSafeTestDatabase } from "../../../../test/setup/assert-safe-test-db";

const integrationEnabled = process.env.RUN_INTEGRATION === "true";
const suite = integrationEnabled ? describe : describe.skip;
const TENANT_ID = "test-experimental-promotion";
const USER_ID = "test-experimental-promotion-user";

declare global {
  var __experimentalPromotionPrisma: PrismaClient | undefined;
}

vi.mock("@/lib/auth", async () => {
  const actual = await vi.importActual<typeof import("@/lib/auth")>("@/lib/auth");
  return {
    ...actual,
    requireRole: vi.fn(async () => {}),
    getSystemUserId: vi.fn(async () => USER_ID),
    getCurrentTenantId: vi.fn(async () => TENANT_ID),
    requireTenantPrisma: vi.fn(async () => global.__experimentalPromotionPrisma),
  };
});

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

function testDatabaseUrl(): string {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) throw new Error("[experimental-promotion.integration] TEST_DATABASE_URL is required");
  assertSafeTestDatabase({ DATABASE_URL: url });
  return url;
}

suite("promoteExperimentalToCatalog", () => {
  let client: PrismaClient;

  async function cleanup(tx: any) {
    await tx.journalLine.deleteMany({ where: { journalEntry: { tenantId: TENANT_ID } } });
    await tx.journalEntry.deleteMany({ where: { tenantId: TENANT_ID } });
    await tx.account.deleteMany({ where: { tenantId: TENANT_ID } });
    await tx.auditLog.deleteMany({ where: { tenantId: TENANT_ID } });
    await tx.inventoryLedger.deleteMany({ where: { tenantId: TENANT_ID } });
    await tx.recipeSupplyItem.deleteMany({ where: { tenantId: TENANT_ID } });
    await tx.recipeItem.deleteMany({ where: { tenantId: TENANT_ID } });
    await tx.recipe.deleteMany({ where: { tenantId: TENANT_ID } });
    await tx.experimentalProductionComponent.deleteMany({ where: { tenantId: TENANT_ID } });
    await tx.experimentalProduction.deleteMany({ where: { tenantId: TENANT_ID } });
    await tx.lot.deleteMany({ where: { tenantId: TENANT_ID } });
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
    global.__experimentalPromotionPrisma = client;
  });

  beforeEach(async () => {
    await client.$transaction(async (tx) => {
      await cleanup(tx);
      await tx.tenant.create({ data: { id: TENANT_ID, code: TENANT_ID, name: "Experimental Promotion" } });
      await tx.user.create({ data: { id: USER_ID, tenantId: TENANT_ID, name: "System", email: "promotion@test.local", password: "hashed" } });
    });
  });

  afterAll(async () => {
    if (!client) return;
    await client.$transaction(async (tx) => cleanup(tx));
    await client.$disconnect();
  });

  it("converts prototype kilograms into packaged catalog units, a recipe, and a default placement", async () => {
    const ids = { output: "promo-output", component: "promo-rb", supply: "promo-pouch", packaging: "promo-packaging", batch: "promo-batch" };
    await client.$transaction(async (tx) => {
      await tx.product.createMany({ data: [
        { id: ids.output, tenantId: TENANT_ID, code: "EXP-OUT", name: "Experimental Output", type: "FINISHED_GOODS", stockKg: 1, avgCostPerKg: 50_000 },
        { id: ids.component, tenantId: TENANT_ID, code: "RB-COMP", name: "Roasted Component", type: "ROASTED_BEAN", stockKg: 10, avgCostPerKg: 50_000 },
      ] });
      await tx.inventorySupplyItem.create({ data: { id: ids.supply, tenantId: TENANT_ID, code: "SUP-POUCH", name: "Pouch 250g", category: "PACKAGING", baseUnit: "PCS", consumableInProduction: true, includeInProductHpp: true, costPerUnit: 100, avgCostPerUnit: 100, stockQuantity: 4 } });
      await tx.packaging.create({ data: { id: ids.packaging, tenantId: TENANT_ID, code: "PKG-250", name: "Pouch 250g", weightGrams: 10, costPerUnit: 100, avgCostPerUnit: 100, supplyItemId: ids.supply } });
      const outputLot = await tx.lot.create({ data: { tenantId: TENANT_ID, productId: ids.output, batchCode: "EXP-LOT", quantityKg: 1 } });
      const supplyLot = await tx.lot.create({ data: { tenantId: TENANT_ID, supplyItemId: ids.supply, batchCode: "POUCH-LOT", supplyQuantity: 4 } });
      await tx.inventoryLedger.createMany({ data: [
        { tenantId: TENANT_ID, productId: ids.output, entryType: "IN", refType: "EXPERIMENTAL_FG_IN", refId: ids.batch, quantityKg: 1, lotId: outputLot.id, lotNumber: outputLot.batchCode, createdById: USER_ID },
        { tenantId: TENANT_ID, supplyItemId: ids.supply, entryType: "IN", refType: "SUPPLY_PURCHASE_IN", refId: ids.batch, supplyQuantity: 4, lotId: supplyLot.id, lotNumber: supplyLot.batchCode, createdById: USER_ID },
      ] });
      await tx.experimentalProduction.create({ data: { id: ids.batch, tenantId: TENANT_ID, code: "EXP-001", name: "Prototype", outputProductId: ids.output, inputKg: 1, outputKg: 1, lossKg: 0, hppPerUnit: 50_000, createdById: USER_ID } });
      await tx.experimentalProductionComponent.create({ data: { tenantId: TENANT_ID, experimentalProductionId: ids.batch, componentType: "ROASTED_BEAN", productId: ids.component, quantityKg: 1, unitCostSnapshot: 50_000, totalCostSnapshot: 50_000 } });
    });

    // Fase 2D.1: sebelum dipromosikan, produk eksperimen TIDAK tampil di storefront
    // (belum ada harga retail).
    const beforeCatalog = await loadStorefrontCatalog(client, TENANT_ID);
    expect(beforeCatalog.products.some((p) => p.id === ids.output)).toBe(false);

    const result = await promoteExperimentalToCatalog({ experimentalProductionId: ids.batch, code: "FG-PROMO-250", name: "Promotion 250g", price: 50_000, netWeightGrams: 250, packagingSupplyItemId: ids.supply });
    expect(result).toEqual({ success: true, productCode: "FG-PROMO-250" });

    const product = await client.product.findUniqueOrThrow({ where: { id: ids.output } });
    expect(product.code).toBe("FG-PROMO-250");
    expect(Number(product.stockKg)).toBe(0);
    expect(product.stockUnit).toBe(4);
    expect(Number(product.lastHpp)).toBe(12_600);

    const recipe = await client.recipe.findFirstOrThrow({ where: { tenantId: TENANT_ID, productId: ids.output }, include: { items: true, supplyItems: true } });
    expect(Number(recipe.outputGrams)).toBe(250);
    expect(recipe.items).toHaveLength(1);
    expect(recipe.supplyItems).toEqual(expect.arrayContaining([expect.objectContaining({ supplyItemId: ids.supply })]));

    const fgLot = await client.lot.findFirstOrThrow({ where: { tenantId: TENANT_ID, productId: ids.output, batchCode: "EXP-001-CAT" }, include: { placements: true } });
    expect(Number(fgLot.quantityUnit)).toBe(4);
    expect(fgLot.placements).toHaveLength(1);
    expect(fgLot.placements[0]!.quantityUnit).toBe(4);

    // Fase 2D.1: setelah dipromosikan (harga retail ditetapkan), produk tampil
    // di katalog publik.
    const afterCatalog = await loadStorefrontCatalog(client, TENANT_ID);
    const promoted = afterCatalog.products.find((p) => p.id === ids.output);
    expect(promoted).toBeTruthy();
    expect(promoted!.code).toBe("FG-PROMO-250");
    expect(promoted!.price).toBe(50_000);
  });

  it("Phase 2D.1: rejects promotion without a retail price", async () => {
    const ids = { output: `promo-out-noprice-${Date.now()}`, component: `promo-rb-noprice-${Date.now()}`, supply: `promo-sup-noprice-${Date.now()}`, batch: `promo-batch-noprice-${Date.now()}` };
    await client.$transaction(async (tx) => {
      await tx.product.createMany({ data: [
        { id: ids.output, tenantId: TENANT_ID, code: "EXP-NOPRICE", name: "No Price Output", type: "FINISHED_GOODS", stockKg: 1, avgCostPerKg: 50_000 },
        { id: ids.component, tenantId: TENANT_ID, code: "RB-NOPRICE", name: "Roasted Component", type: "ROASTED_BEAN", stockKg: 10, avgCostPerKg: 50_000 },
      ] });
      await tx.inventorySupplyItem.create({ data: { id: ids.supply, tenantId: TENANT_ID, code: "SUP-NOPRICE", name: "Pouch 250g", category: "PACKAGING", baseUnit: "PCS", consumableInProduction: true, includeInProductHpp: true, costPerUnit: 100, avgCostPerUnit: 100, stockQuantity: 4 } });
      const outputLot = await tx.lot.create({ data: { tenantId: TENANT_ID, productId: ids.output, batchCode: "EXP-NOPRICE-LOT", quantityKg: 1 } });
      await tx.inventoryLedger.create({ data: { tenantId: TENANT_ID, productId: ids.output, entryType: "IN", refType: "EXPERIMENTAL_FG_IN", refId: ids.batch, quantityKg: 1, lotId: outputLot.id, lotNumber: outputLot.batchCode, createdById: USER_ID } });
      await tx.experimentalProduction.create({ data: { id: ids.batch, tenantId: TENANT_ID, code: "EXP-NOPRICE", name: "No Price", outputProductId: ids.output, inputKg: 1, outputKg: 1, lossKg: 0, hppPerUnit: 50_000, createdById: USER_ID } });
      await tx.experimentalProductionComponent.create({ data: { tenantId: TENANT_ID, experimentalProductionId: ids.batch, componentType: "ROASTED_BEAN", productId: ids.component, quantityKg: 1, unitCostSnapshot: 50_000, totalCostSnapshot: 50_000 } });
    });

    const result = await promoteExperimentalToCatalog({ experimentalProductionId: ids.batch, code: "FG-NOPRICE", name: "No Price", packagingSupplyItemId: ids.supply });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toMatch(/Harga retail wajib/);
    }

    // Produk eksperimen tetap tersembunyi dari storefront.
    const catalog = await loadStorefrontCatalog(client, TENANT_ID);
    expect(catalog.products.some((p) => p.id === ids.output)).toBe(false);
  });
});
