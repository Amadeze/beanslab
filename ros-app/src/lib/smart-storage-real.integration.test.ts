import { describe, expect, it, beforeAll, afterAll, beforeEach, vi } from "vitest";
import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { assertSafeTestDatabase } from "../../test/setup/assert-safe-test-db";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";

const integrationEnabled = process.env.RUN_INTEGRATION === "true";
const suite = integrationEnabled ? describe : describe.skip;

const testDbUrl = process.env.TEST_DATABASE_URL ?? "";

// Point the app's global prisma client at the TEST database. This file does not
// statically import any app module, so the override runs before the dynamic
// imports inside each test resolve @/lib/prisma. The pg Pool is lazy; nothing
// is ever queried against a non-test URL.
if (integrationEnabled) {
  process.env.DATABASE_URL = testDbUrl;
  process.env.DIRECT_URL = testDbUrl;
}

const hoisted = vi.hoisted(() => {
  const state = { tenantId: "tenant-a", userId: "user-a" };
  return {
    setState: (tenantId: string, userId: string) => {
      state.tenantId = tenantId;
      state.userId = userId;
    },
    requireRole: vi.fn(async () => ({ id: state.userId })),
    getCurrentTenantId: vi.fn(async () => state.tenantId),
    getSystemUserId: vi.fn(async () => state.userId),
    requireTenantPrisma: vi.fn(async () => (globalThis as any).__testClient),
  };
});

vi.mock("@/lib/auth", () => ({
  requireRole: hoisted.requireRole,
  getCurrentTenantId: hoisted.getCurrentTenantId,
  getSystemUserId: hoisted.getSystemUserId,
  requireTenantPrisma: hoisted.requireTenantPrisma,
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));

let TENANT_ID = "tenant-a";
let USER_ID = "user-a";

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
    throw new Error(
      "[smart-storage.integration] TEST_DATABASE_URL is required when RUN_INTEGRATION=true",
    );
  }
  const fromEnvFile = parseEnvFile(join(process.cwd(), ".env.local"));
  for (const key of ["DATABASE_URL", "DIRECT_URL"] as const) {
    const value = fromEnvFile[key] ?? process.env[key];
    if (value && value === url) {
      throw new Error(
        `[smart-storage.integration] TEST_DATABASE_URL must not equal ${key} (development/production database)`,
      );
    }
  }
  assertSafeTestDatabase({ DATABASE_URL: url });
  return url;
}

suite("Smart Storage — real PostgreSQL (TEST_DATABASE_URL)", () => {
  let client: PrismaClient;
  let loc: { a01: string; a02: string };

  async function wipeTestData(tx: any) {
    await tx.locationOpname.deleteMany({ where: { tenantId: TENANT_ID } });
    await tx.locationTransfer.deleteMany({ where: { tenantId: TENANT_ID } });
    await tx.lotPlacement.deleteMany({ where: { tenantId: TENANT_ID } });
    await tx.location.deleteMany({ where: { tenantId: TENANT_ID } });
    await tx.warehouse.deleteMany({ where: { tenantId: TENANT_ID } });
    await tx.inventoryLedger.deleteMany({ where: { tenantId: TENANT_ID } });
    await tx.auditLog.deleteMany({ where: { tenantId: TENANT_ID } });
    await tx.journalLine.deleteMany({ where: { journalEntry: { tenantId: TENANT_ID } } });
    await tx.journalEntry.deleteMany({ where: { tenantId: TENANT_ID } });
    await tx.lot.deleteMany({ where: { tenantId: TENANT_ID } });
    await tx.product.deleteMany({ where: { tenantId: TENANT_ID } });
    await tx.packaging.deleteMany({ where: { tenantId: TENANT_ID } });
    await tx.inventorySupplyItem.deleteMany({ where: { tenantId: TENANT_ID } });
    await tx.account.deleteMany({ where: { tenantId: TENANT_ID } });
    await tx.user.deleteMany({ where: { tenantId: TENANT_ID } });
    await tx.user.deleteMany({ where: { id: USER_ID } });
    await tx.tenant.deleteMany({ where: { id: TENANT_ID } });
  }

  async function seedBase(tx: any) {
    await tx.tenant.create({
      data: { id: TENANT_ID, code: TENANT_ID, name: "Test Tenant" },
    });
    await tx.user.create({
      data: {
        id: USER_ID,
        name: "System",
        email: `${USER_ID}@test.local`,
        password: "hashed",
        tenantId: TENANT_ID,
      },
    });
    const w = await tx.warehouse.create({
      data: { tenantId: TENANT_ID, code: "WH-01", name: "Gudang Utama", isDefault: true },
    });
    const a01 = await tx.location.create({
      data: { tenantId: TENANT_ID, warehouseId: w.id, code: "A-01", name: "Rak A-01" },
    });
    const a02 = await tx.location.create({
      data: { tenantId: TENANT_ID, warehouseId: w.id, code: "A-02", name: "Rak A-02" },
    });
    loc = { a01: a01.id, a02: a02.id };
  }

  async function seedLot(
    tx: any,
    opts: {
      kg?: number;
      unit?: number;
      supplyQty?: number;
      productId?: string | null;
      packagingId?: string | null;
      supplyItemId?: string | null;
    } = {},
  ) {
    return tx.lot.create({
      data: {
        tenantId: TENANT_ID,
        productId: opts.productId ?? null,
        packagingId: opts.packagingId ?? null,
        supplyItemId: opts.supplyItemId ?? null,
        batchCode: `BATCH-${randomUUID()}`,
        quantityKg: opts.kg ?? 0,
        quantityUnit: opts.unit ?? 0,
        supplyQuantity: opts.supplyQty ?? 0,
      },
    });
  }

  async function seedProduct(tx: any, kg = 100, unit = 0) {
    return tx.product.create({
      data: {
        tenantId: TENANT_ID,
        code: `PROD-${randomUUID()}`,
        name: "Green Bean Test",
        type: "GREEN_BEAN",
        stockKg: kg,
        stockUnit: unit,
        isActive: true,
      },
    });
  }

  // Canonical lot balance = the product's cached stock (single source of truth
  // maintained via InventoryLedger appends — including lotId-less opname rows).
  async function canonicalSummary(tx: any, productId: string): Promise<number> {
    const p = await tx.product.findUnique({ where: { id: productId } });
    return Number(p?.stockKg ?? 0);
  }

  async function placement(clientOrTx: any, lotId: string, locationId: string) {
    return clientOrTx.lotPlacement.findFirst({
      where: { tenantId: TENANT_ID, lotId, locationId },
    });
  }

  async function placementsSum(clientOrTx: any, lotId: string, field: string): Promise<number> {
    const rows = await clientOrTx.lotPlacement.findMany({
      where: { tenantId: TENANT_ID, lotId },
      select: { [field]: true },
    });
    return rows.reduce((s: number, r: any) => s + Number(r[field] ?? 0), 0);
  }

  beforeAll(async () => {
    const pool = new Pool({ connectionString: resolveTestDatabaseUrl(), max: 5 });
    client = new PrismaClient({ adapter: new PrismaPg(pool) });
    await client.$connect();
    (globalThis as any).__testClient = client;
    TENANT_ID = `t-${randomUUID().slice(0, 8)}`;
    USER_ID = `u-${randomUUID().slice(0, 8)}`;
    hoisted.setState(TENANT_ID, USER_ID);
  });

  beforeEach(async () => {
    await client.$transaction(async (tx) => {
      await wipeTestData(tx);
      await seedBase(tx);
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

  describe("A. Warehouse / Location tenant isolation", () => {
    it("warehouses and locations are scoped per tenant; duplicate code allowed across tenants", async () => {
      const otherId = `t-other-${randomUUID()}`;
      await client.tenant.create({ data: { id: otherId, code: otherId, name: "Other" } });
      const wOther = await client.warehouse.create({
        data: { tenantId: otherId, code: "WH-01", name: "Other WH" },
      });
      await client.location.create({
        data: { tenantId: otherId, warehouseId: wOther.id, code: "A-01", name: "Other A-01" },
      });

      const myW = await client.warehouse.findMany({ where: { tenantId: TENANT_ID } });
      const myL = await client.location.findMany({ where: { tenantId: TENANT_ID } });
      expect(myW).toHaveLength(1);
      expect(myL).toHaveLength(2);

      const otherL = await client.location.findMany({ where: { tenantId: otherId } });
      expect(otherL).toHaveLength(1);

      await client.$transaction(async (tx: any) => {
        await tx.location.deleteMany({ where: { tenantId: otherId } });
        await tx.warehouse.deleteMany({ where: { tenantId: otherId } });
        await tx.tenant.deleteMany({ where: { id: otherId } });
      });
    });

    it("duplicate warehouse code within a tenant is rejected by unique constraint", async () => {
      await expect(
        client.warehouse.create({
          data: { tenantId: TENANT_ID, code: "WH-01", name: "Dup" },
        }),
      ).rejects.toThrow();
    });
  });

  describe("B. LotPlacement", () => {
    it("placement and split placement; sum(placements) <= canonical stock", async () => {
      const p = await seedProduct(client as any, 100);
      const lot = await seedLot(client as any, { productId: p.id, kg: 100 });
      const { placeLot } = await import("./lot-placement");

      const r1 = await placeLot({ lotId: lot.id, locationId: loc.a01, quantityKg: 30 });
      expect(r1.success).toBe(true);
      const r2 = await placeLot({ lotId: lot.id, locationId: loc.a02, quantityKg: 40 });
      expect(r2.success).toBe(true);

      const sum = await placementsSum(client as any, lot.id, "quantityKg");
      expect(sum).toBe(70);
      const canonical = await canonicalSummary(client as any, p.id);
      expect(canonical).toBe(100);
      expect(sum).toBeLessThanOrEqual(canonical);

      // over-placement rejected (would total 110 > 100)
      const r3 = await placeLot({ lotId: lot.id, locationId: loc.a02, quantityKg: 80 });
      expect(r3.success).toBe(false);
    });

    it("unplaced = canonical - placed", async () => {
      const p = await seedProduct(client as any, 100);
      const lot = await seedLot(client as any, { productId: p.id, kg: 100 });
      const { placeLot } = await import("./lot-placement");
      await placeLot({ lotId: lot.id, locationId: loc.a01, quantityKg: 30 });
      const placed = await placementsSum(client as any, lot.id, "quantityKg");
      const canonical = await canonicalSummary(client as any, p.id);
      expect(canonical - placed).toBe(70);
    });
  });

  describe("C. LocationTransfer", () => {
    async function setup(kg = 40, placedKg = 30) {
      const p = await seedProduct(client as any, kg);
      const lot = await seedLot(client as any, { productId: p.id, kg });
      const { placeLot } = await import("./lot-placement");
      await placeLot({ lotId: lot.id, locationId: loc.a01, quantityKg: placedKg });
      const { transferLot } = await import("./lot-transfer");
      return { p, lot, transferLot };
    }

    it("source decreases, destination increases, canonical total unchanged", async () => {
      const { p, lot, transferLot } = await setup();
      const r = await transferLot({
        lotId: lot.id,
        sourceLocationId: loc.a01,
        destinationLocationId: loc.a02,
        quantityKg: 10,
      });
      expect(r.success).toBe(true);
      const src = await placement(client as any, lot.id, loc.a01);
      const dst = await placement(client as any, lot.id, loc.a02);
      expect(Number(src?.quantityKg ?? 0)).toBe(20);
      expect(Number(dst?.quantityKg ?? 0)).toBe(10);
      const sum = await placementsSum(client as any, lot.id, "quantityKg");
      expect(sum).toBe(30);
      const canonical = await canonicalSummary(client as any, p.id);
      expect(canonical).toBe(40);
      const tr = await client.locationTransfer.count({ where: { tenantId: TENANT_ID } });
      expect(tr).toBe(1);
    });

    it("insufficient source rejected atomically — no mutation, no transfer row", async () => {
      const { lot, transferLot } = await setup(40, 30);
      const r = await transferLot({
        lotId: lot.id,
        sourceLocationId: loc.a01,
        destinationLocationId: loc.a02,
        quantityKg: 100,
      });
      expect(r.success).toBe(false);
      const src = await placement(client as any, lot.id, loc.a01);
      expect(Number(src?.quantityKg ?? 0)).toBe(30);
      const dst = await placement(client as any, lot.id, loc.a02);
      expect(dst).toBeNull();
      const tr = await client.locationTransfer.count({ where: { tenantId: TENANT_ID } });
      expect(tr).toBe(0);
    });

    it("cross-tenant source rejected (no placement in own tenant)", async () => {
      const otherId = `t-xsrc-${randomUUID()}`;
      await client.tenant.create({ data: { id: otherId, code: otherId, name: "Other" } });
      const wOther = await client.warehouse.create({
        data: { tenantId: otherId, code: "WH-X", name: "Other WH" },
      });
      const locOther = await client.location.create({
        data: { tenantId: otherId, warehouseId: wOther.id, code: "X-01", name: "X-01" },
      });
      const p = await seedProduct(client as any, 40);
      const lot = await seedLot(client as any, { productId: p.id, kg: 40 });
      // placement belongs to OTHER tenant; our tenant has none
      await client.lotPlacement.create({
        data: {
          tenantId: otherId,
          lotId: lot.id,
          locationId: locOther.id,
          quantityKg: 30,
        },
      });
      const { transferLot } = await import("./lot-transfer");
      const r = await transferLot({
        lotId: lot.id,
        sourceLocationId: locOther.id,
        destinationLocationId: loc.a01,
        quantityKg: 5,
      });
      expect(r.success).toBe(false);
      const tr = await client.locationTransfer.count({ where: { tenantId: TENANT_ID } });
      expect(tr).toBe(0);
      await client.$transaction(async (tx: any) => {
        await tx.lotPlacement.deleteMany({ where: { tenantId: otherId } });
        await tx.location.deleteMany({ where: { tenantId: otherId } });
        await tx.warehouse.deleteMany({ where: { tenantId: otherId } });
        await tx.tenant.deleteMany({ where: { id: otherId } });
      });
    });
  });

  describe("D-G. destination placement via createLotPlacementInTx (receiving/roasting/grinding/production)", () => {
    it("creates a placement in the selected destination inside a transaction", async () => {
      const { createLotPlacementInTx } = await import("./storage-location");
      const p = await seedProduct(client as any, 50);
      const lot = await seedLot(client as any, { productId: p.id, kg: 50 });
      await client.$transaction(async (tx: any) => {
        await createLotPlacementInTx(tx, TENANT_ID, lot.id, {
          destinationLocationId: loc.a01,
          quantityKg: 20,
        });
      });
      const hit = await placement(client as any, lot.id, loc.a01);
      expect(Number(hit?.quantityKg ?? 0)).toBe(20);
    });
  });

  describe("H. Location Opname", () => {
    async function seedWithPlacement(canonicalKg: number, placedKg: number) {
      const p = await seedProduct(client as any, canonicalKg);
      const lot = await seedLot(client as any, { productId: p.id, kg: canonicalKg });
      const { placeLot } = await import("./lot-placement");
      await placeLot({ lotId: lot.id, locationId: loc.a01, quantityKg: placedKg });
      return { p, lot };
    }

    it("1. canonical 100, A01=30 counted 29 -> placement 29, canonical 99, ledger OUT 1", async () => {
      const { p, lot } = await seedWithPlacement(100, 30);
      const { createLocationOpname, confirmLocationOpname } = await import("./lot-opname");
      const d = await createLocationOpname({ lotId: lot.id, locationId: loc.a01, countedQuantityKg: 29 });
      expect(d.success).toBe(true);
      const c = await confirmLocationOpname(d.id!);
      expect(c.success).toBe(true);
      const pl = await placement(client as any, lot.id, loc.a01);
      expect(Number(pl?.quantityKg ?? 0)).toBe(29);
      const canonical = await canonicalSummary(client as any, p.id);
      expect(canonical).toBe(99);
      const ledger = await client.inventoryLedger.findMany({
        where: { tenantId: TENANT_ID, refType: "LOCATION_OPNAME_OUT", refId: d.id },
      });
      expect(ledger).toHaveLength(1);
      expect(Number(ledger[0]!.quantityKg)).toBe(1);
    });

    it("2. placed 10 counted 0 -> placement 0, canonical OUT 10", async () => {
      const { p, lot } = await seedWithPlacement(50, 10);
      const { createLocationOpname, confirmLocationOpname } = await import("./lot-opname");
      const d = await createLocationOpname({ lotId: lot.id, locationId: loc.a01, countedQuantityKg: 0 });
      const c = await confirmLocationOpname(d.id!);
      expect(c.success).toBe(true);
      const pl = await placement(client as any, lot.id, loc.a01);
      expect(Number(pl?.quantityKg ?? 0)).toBe(0);
      const canonical = await canonicalSummary(client as any, p.id);
      expect(canonical).toBe(40);
    });

    it("3. placed 10 counted 10 -> no ledger mutation", async () => {
      const { lot } = await seedWithPlacement(50, 10);
      const { createLocationOpname, confirmLocationOpname } = await import("./lot-opname");
      const d = await createLocationOpname({ lotId: lot.id, locationId: loc.a01, countedQuantityKg: 10 });
      const c = await confirmLocationOpname(d.id!);
      expect(c.success).toBe(true);
      const ledgerCount = await client.inventoryLedger.count({
        where: {
          tenantId: TENANT_ID,
          refId: d.id,
          refType: { in: ["LOCATION_OPNAME_IN", "LOCATION_OPNAME_OUT"] },
        },
      });
      expect(ledgerCount).toBe(0);
    });

    it("4. placed 10 counted 11 -> canonical IN +1", async () => {
      const { p, lot } = await seedWithPlacement(50, 10);
      const { createLocationOpname, confirmLocationOpname } = await import("./lot-opname");
      const d = await createLocationOpname({ lotId: lot.id, locationId: loc.a01, countedQuantityKg: 11 });
      const c = await confirmLocationOpname(d.id!);
      expect(c.success).toBe(true);
      const ledger = await client.inventoryLedger.findMany({
        where: { tenantId: TENANT_ID, refType: "LOCATION_OPNAME_IN", refId: d.id },
      });
      expect(ledger).toHaveLength(1);
      expect(Number(ledger[0]!.quantityKg)).toBe(1);
      const canonical = await canonicalSummary(client as any, p.id);
      expect(canonical).toBe(51);
    });

    it("5. unit subject -> zero", async () => {
      const pkg = await client.packaging.create({
        data: {
          tenantId: TENANT_ID,
          code: `PKG-${randomUUID()}`,
          name: "Pouch 250g",
          weightGrams: 5,
          costPerUnit: 1000,
          stockUnit: 10,
        },
      });
      const lot = await seedLot(client as any, { packagingId: pkg.id, unit: 10 });
      const { placeLot } = await import("./lot-placement");
      await placeLot({ lotId: lot.id, locationId: loc.a01, quantityUnit: 10 });
      const { createLocationOpname, confirmLocationOpname } = await import("./lot-opname");
      const d = await createLocationOpname({ lotId: lot.id, locationId: loc.a01, countedQuantityUnit: 0 });
      const c = await confirmLocationOpname(d.id!);
      expect(c.success).toBe(true);
      const pl = await placement(client as any, lot.id, loc.a01);
      expect(pl?.quantityUnit ?? 0).toBe(0);
      const ledger = await client.inventoryLedger.findMany({
        where: { tenantId: TENANT_ID, refId: d.id, packagingId: pkg.id },
      });
      expect(ledger).toHaveLength(1);
      expect(ledger[0]!.quantityUnit).toBe(10);
    });

    it("6. supply subject -> zero", async () => {
      const sup = await client.inventorySupplyItem.create({
        data: {
          tenantId: TENANT_ID,
          code: `SUP-${randomUUID()}`,
          name: "Kemasan",
          category: "PACKAGING",
          baseUnit: "PCS",
          costPerUnit: 500,
          stockQuantity: 5,
        },
      });
      const lot = await seedLot(client as any, { supplyItemId: sup.id, supplyQty: 5 });
      // Supply placements enter via createLotPlacementInTx (receiving flow),
      // not placeLot — mirror the real wiring.
      const { createLotPlacementInTx } = await import("./storage-location");
      await client.$transaction(async (tx: any) => {
        await createLotPlacementInTx(tx, TENANT_ID, lot.id, {
          destinationLocationId: loc.a01,
          supplyQty: 5,
        });
      });
      const { createLocationOpname, confirmLocationOpname } = await import("./lot-opname");
      const d = await createLocationOpname({ lotId: lot.id, locationId: loc.a01, countedSupplyQty: 0 });
      const c = await confirmLocationOpname(d.id!);
      expect(c.success).toBe(true);
      const pl = await placement(client as any, lot.id, loc.a01);
      expect(Number(pl?.supplyQty ?? 0)).toBe(0);
      const ledger = await client.inventoryLedger.findMany({
        where: { tenantId: TENANT_ID, refId: d.id, supplyItemId: sup.id },
      });
      expect(ledger).toHaveLength(1);
      expect(Number(ledger[0]?.supplyQuantity ?? 0)).toBe(5);
    });

    it("7. double confirm posts exactly one adjustment", async () => {
      const { lot } = await seedWithPlacement(100, 30);
      const { createLocationOpname, confirmLocationOpname } = await import("./lot-opname");
      const d = await createLocationOpname({ lotId: lot.id, locationId: loc.a01, countedQuantityKg: 29 });
      const c1 = await confirmLocationOpname(d.id!);
      expect(c1.success).toBe(true);
      const c2 = await confirmLocationOpname(d.id!);
      expect(c2.success).toBe(false);
      const ledgerCount = await client.inventoryLedger.count({
        where: { tenantId: TENANT_ID, refId: d.id },
      });
      expect(ledgerCount).toBe(1);
    });

    it("8. concurrent confirm commits exactly once", async () => {
      const { lot } = await seedWithPlacement(100, 30);
      const { createLocationOpname, confirmLocationOpname } = await import("./lot-opname");
      const d = await createLocationOpname({ lotId: lot.id, locationId: loc.a01, countedQuantityKg: 29 });
      const [c1, c2] = await Promise.all([
        confirmLocationOpname(d.id!),
        confirmLocationOpname(d.id!),
      ]);
      expect([c1.success, c2.success].filter(Boolean)).toHaveLength(1);
      const ledgerCount = await client.inventoryLedger.count({
        where: { tenantId: TENANT_ID, refId: d.id },
      });
      expect(ledgerCount).toBe(1);
      const pl = await placement(client as any, lot.id, loc.a01);
      expect(Number(pl?.quantityKg ?? 0)).toBe(29);
    });
  });

  describe("STALE DRAFT mandatory scenario", () => {
    it("placement changed between draft and confirm must not silently overwrite newer state", async () => {
      const p = await seedProduct(client as any, 100);
      const lot = await seedLot(client as any, { productId: p.id, kg: 100 });
      const { placeLot } = await import("./lot-placement");
      await placeLot({ lotId: lot.id, locationId: loc.a01, quantityKg: 30 });
      const { createLocationOpname, confirmLocationOpname } = await import("./lot-opname");
      const { transferLot } = await import("./lot-transfer");

      const canonicalBefore = await canonicalSummary(client as any, p.id);
      const draft = await createLocationOpname({
        lotId: lot.id,
        locationId: loc.a01,
        countedQuantityKg: 29,
      });
      expect(draft.success).toBe(true);

      // legitimate transfer BEFORE confirm => A01 becomes 25, A02 becomes 5
      const t = await transferLot({
        lotId: lot.id,
        sourceLocationId: loc.a01,
        destinationLocationId: loc.a02,
        quantityKg: 5,
      });
      expect(t.success).toBe(true);
      const a01Before = await placement(client as any, lot.id, loc.a01);
      expect(Number(a01Before?.quantityKg ?? 0)).toBe(25);

      const confirm = await confirmLocationOpname(draft.id!);
      const canonicalAfter = await canonicalSummary(client as any, p.id);
      const a01After = await placement(client as any, lot.id, loc.a01);
      const a02After = await placement(client as any, lot.id, loc.a02);
      const sumAfter = await placementsSum(client as any, lot.id, "quantityKg");
      const ledgerRows = await client.inventoryLedger.findMany({
        where: { tenantId: TENANT_ID, refId: draft.id },
      });
      const ledgerDelta = ledgerRows.reduce(
        (s: number, r: any) => s + (r.entryType === "IN" ? 1 : -1) * Number(r.quantityKg ?? 0),
        0,
      );

      // Reject stale drafts instead of resurrecting quantities:
      // after the transfer, A01 is 25 and A02 is 5 (sum 30). Confirming a draft
      // snapshot of 30/count 29 against stale data would set A01 to 29 (phantom
      // +4) while canonical only moves -1 — sum(placements) would exceed the
      // physically present stock and the transferred 5kg would be double-counted.
      const staleRejected = confirm.success === false;
      const sumOk = sumAfter <= canonicalAfter + 0.001;

      console.log(
        JSON.stringify({
          staleDraft: { accepted: confirm.success, rejected: staleRejected },
          canonicalBefore,
          canonicalAfter,
          a01BeforeKg: Number(a01Before?.quantityKg ?? 0),
          a01AfterKg: Number(a01After?.quantityKg ?? 0),
          a02AfterKg: Number(a02After?.quantityKg ?? 0),
          sumPlacements: sumAfter,
          ledgerDelta,
          sumOk,
        }),
      );

      expect(staleRejected).toBe(true);
      expect(sumOk).toBe(true);
    });
  });
});
