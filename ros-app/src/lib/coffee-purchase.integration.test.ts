import { randomUUID } from "node:crypto";
import { join } from "node:path";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { parseEnvFile, resolveTestDatabaseUrl } from "../../test/setup/test-database-guard";
import { createDraftPO, receivePO, sendPO } from "@/lib/po-lite";
import {
  createGreenBeanPurchase,
  createRoastedBeanPurchase,
} from "@/app/(dashboard)/inventory/actions";

// Gated integration test: only runs against an isolated test DB with RUN_INTEGRATION=true.
const integrationEnabled = process.env.RUN_INTEGRATION === "true";
const suite = integrationEnabled ? describe : describe.skip;

const TENANT_A = "coffee-purchase-tenant-a";
const TENANT_B = "coffee-purchase-tenant-b";

const authState = vi.hoisted(() => ({ tenantId: "coffee-purchase-tenant-a" }));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

vi.mock("@/lib/auth", async () => {
  const { withTenant } = await import("./prisma");
  return {
    requireRole: vi.fn(async () => ({
      id: `user-${authState.tenantId}`,
      tenantId: authState.tenantId,
      role: "OWNER" as const,
    })),
    requireTenantPrisma: vi.fn(async () =>
      withTenant(authState.tenantId, (globalThis as any).__cfpClient),
    ),
    getCurrentTenantId: vi.fn(async () => authState.tenantId),
    getSystemUserId: vi.fn(async () => `user-${authState.tenantId}`),
  };
});

function databaseNameFromUrl(url: string): string {
  try {
    return new URL(url).pathname.replace(/^\//, "");
  } catch {
    return "";
  }
}

suite("roasted bean procurement — real PostgreSQL (TEST_DATABASE_URL)", () => {
  let client: PrismaClient;
  let pool: Pool;
  let supplierA = "";
  let supplierB = "";

  beforeAll(async () => {
    pool = new Pool({ connectionString: resolveTestDatabaseUrl(), max: 10 });
    client = new PrismaClient({ adapter: new PrismaPg(pool) });
    (globalThis as any).__cfpClient = client;
    await client.$connect();

    for (const [id, code] of [
      [TENANT_A, "CFPA"],
      [TENANT_B, "CFPB"],
    ] as const) {
      await client.tenant.upsert({
        where: { id },
        create: { id, code, name: `Coffee Purchase ${code}`, subscriptionTier: "BASIC", subscriptionStatus: "ACTIVE", isActive: true },
        update: {},
      });
    }
    await client.user.upsert({
      where: { id: `user-${TENANT_A}` },
      create: { id: `user-${TENANT_A}`, email: "cfp-a@example.com", name: "CFP Owner A", tenantId: TENANT_A, role: "OWNER" },
      update: {},
    });
    await client.user.upsert({
      where: { id: `user-${TENANT_B}` },
      create: { id: `user-${TENANT_B}`, email: "cfp-b@example.com", name: "CFP Owner B", tenantId: TENANT_B, role: "OWNER" },
      update: {},
    });

    const supA = await client.supplier.create({
      data: { tenantId: TENANT_A, code: "SUP-CFPA-001", name: "Supplier Roasted A", isActive: true },
    });
    supplierA = supA.id;
    const supB = await client.supplier.create({
      data: { tenantId: TENANT_B, code: "SUP-CFPB-001", name: "Supplier Roasted B", isActive: true },
    });
    supplierB = supB.id;
  });

  afterAll(async () => {
    if (!client) return;
    for (const tenantId of [TENANT_A, TENANT_B]) {
      await client.auditLog.deleteMany({ where: { tenantId } });
      await client.journalLine.deleteMany({ where: { journalEntry: { tenantId } } });
      await client.journalEntry.deleteMany({ where: { tenantId } });
      await client.account.deleteMany({ where: { tenantId } });
      await client.inventoryLedger.deleteMany({ where: { tenantId } });
      await client.lotPlacement.deleteMany({ where: { tenantId } });
      await client.lot.deleteMany({ where: { tenantId } });
      await client.supplierPayment.deleteMany({ where: { tenantId } });
      await client.purchase.deleteMany({ where: { tenantId } });
      await client.purchaseOrderItem.deleteMany({ where: { tenantId } });
      await client.purchaseOrder.deleteMany({ where: { tenantId } });
      await client.product.deleteMany({ where: { tenantId } });
      await client.coffeeSource.deleteMany({ where: { tenantId } });
      await client.supplier.deleteMany({ where: { tenantId } });
    }
    await client.user.deleteMany({ where: { tenantId: { in: [TENANT_A, TENANT_B] } } });
    await client.tenant.deleteMany({ where: { id: { in: [TENANT_A, TENANT_B] } } });
    await client.$disconnect();
    await pool.end();
  });

  // ── Fix4: bukti isolasi — seluruh suite menulis hanya ke TEST_DATABASE_URL ──
  it("proves the suite writes only to TEST_DATABASE_URL", async () => {
    const testUrl = resolveTestDatabaseUrl();
    const fromEnvFile = parseEnvFile(join(process.cwd(), ".env.local"));
    // TEST_DATABASE_URL tdk pernah sama dengan dev/prod DB (guard sudah fail-fast),
    // dan koneksi pool benar-benar terhubung ke nama database di dalam URL tsb.
    expect(databaseNameFromUrl(testUrl)).not.toBe("");
    const current = await pool.query<{ database: string }>("SELECT current_database() AS database");
    expect(current.rows[0].database).toBe(databaseNameFromUrl(testUrl));
    for (const key of ["DATABASE_URL", "DIRECT_URL"] as const) {
      const value = fromEnvFile[key];
      if (!value) continue;
      expect(testUrl).not.toBe(value);
      expect(current.rows[0].database).not.toBe(databaseNameFromUrl(value));
    }
  });

  it("directly purchases a new roasted bean: product, coffee source, purchase, lot, ledger, costing, journal", async () => {
    authState.tenantId = TENANT_A;
    const result = await createRoastedBeanPurchase({
      operationKey: randomUUID(),
      supplierId: supplierA,
      receivedAt: "2026-08-11",
      productName: "Roasted Beli Jadi Gayo",
      productOrigin: "Gayo",
      productRoastLevel: "MEDIUM",
      coffeeSource: { name: "Sumber Gayo Atu Lintang", region: "Gayo" },
      weightKg: 10,
      totalCost: 1_200_000,
      shippingCost: 100_000,
      paidAmount: 500_000,
      paymentMethod: "TRANSFER",
      bestBeforeDate: "2026-11-11",
      lotNumber: "LOT-SUP-RB-01",
    });

    expect(result.success).toBe(true);

    // Sumber kopi dibuat atomik bersama produk; produk tidak boleh tanpa identitas.
    const rb = await client.product.findFirstOrThrow({
      where: { tenantId: TENANT_A, name: { equals: "Roasted Beli Jadi Gayo", mode: "insensitive" } },
    });
    expect(rb.type).toBe("ROASTED_BEAN");
    expect(rb.materialOrigin).toBe("PURCHASED_ROASTED");
    expect(rb.coffeeSourceId).not.toBeNull();
    expect(rb.sourceGreenBeanId).toBeNull();
    expect(rb.roastLevel).toBe("MEDIUM");
    expect(rb.origin).toBe("Gayo");
    expect(Number(rb.stockKg)).toBe(10);
    expect(Number(rb.avgCostPerKg)).toBe(120_000);

    const source = await client.coffeeSource.findUniqueOrThrow({
      where: { id: rb.coffeeSourceId as string },
    });
    expect(source.tenantId).toBe(TENANT_A);
    expect(source.name).toBe("Sumber Gayo Atu Lintang");
    expect(source.region).toBe("Gayo");
    expect(source.code).toMatch(/^CS-/);

    const purchase = await client.purchase.findFirstOrThrow({
      where: { code: result.success ? result.purchaseCode : "" },
    });
    expect(purchase.type).toBe("ROASTED_BEAN");
    expect(purchase.productId).toBe(rb.id);
    expect(purchase.paymentStatus).toBe("PARTIAL");
    expect(Number(purchase.totalCost)).toBe(1_200_000);
    expect(Number(purchase.pricePerUnit)).toBe(110_000);

    const payment = await client.supplierPayment.findFirstOrThrow({
      where: { purchaseId: purchase.id },
    });
    expect(Number(payment.amount)).toBe(500_000);
    expect(payment.method).toBe("TRANSFER");

    const lot = await client.lot.findFirstOrThrow({ where: { purchaseId: purchase.id } });
    expect(lot.productId).toBe(rb.id);
    expect(lot.batchCode).toBe(purchase.code);
    expect(Number(lot.quantityKg)).toBe(10);
    expect(lot.expiryDate).toEqual(new Date("2026-11-11T00:00:00"));
    expect(lot.notes).toBe("Lot supplier: LOT-SUP-RB-01");

    const placement = await client.lotPlacement.findFirstOrThrow({ where: { lotId: lot.id } });
    expect(Number(placement.quantityKg)).toBe(10);

    const ledger = await client.inventoryLedger.findFirstOrThrow({
      where: { refId: purchase.id, productId: rb.id },
    });
    expect(ledger.entryType).toBe("IN");
    expect(ledger.refType).toBe("PURCHASE_RB");
    expect(Number(ledger.quantityKg)).toBe(10);
    // Landed cost policy: WAC memasukkan ongkir (totalCost / kg), bukan harga
    // item saja. GL mendebit persediaan dengan totalCost — valuation stok dari
    // ledger harus rekonsiliasi dengan GL.
    expect(Number(ledger.incomingPrice)).toBe(120_000);

    const journal = await client.journalEntry.findFirstOrThrow({
      where: { refType: "PURCHASE", reference: purchase.id },
    });
    const lines = await client.journalLine.findMany({
      where: { journalEntryId: journal.id },
      include: { account: true },
    });
    const dr1210 = lines.find((l) => l.account.code === "1-1210");
    const crCash = lines.find((l) => l.account.code === "1-1000");
    const crAp = lines.find((l) => l.account.code === "2-1000");
    expect(Number(dr1210?.debit ?? 0)).toBe(1_200_000);
    expect(Number(crCash?.credit ?? 0)).toBe(500_000);
    expect(Number(crAp?.credit ?? 0)).toBe(700_000);
  });

  it("reuses the same product only when the user explicitly selects the same coffeeSourceId", async () => {
    authState.tenantId = TENANT_A;
    const first = await createRoastedBeanPurchase({
      operationKey: randomUUID(),
      supplierId: supplierA,
      receivedAt: "2026-08-12",
      productName: "Roasted Gayo Medium Reuse",
      productRoastLevel: "MEDIUM",
      coffeeSource: { name: "Sumber Gayo Reuse", region: "Gayo" },
      weightKg: 2,
      totalCost: 240_000,
      shippingCost: 0,
      paidAmount: 240_000,
      paymentMethod: "CASH",
    });
    expect(first.success).toBe(true);

    // Reuse hanya lewat coffeeSourceId eksplisit — bukan lewat kesamaan nama.
    const source = await client.coffeeSource.findFirstOrThrow({
      where: { tenantId: TENANT_A, name: "Sumber Gayo Reuse" },
    });
    const second = await createRoastedBeanPurchase({
      operationKey: randomUUID(),
      supplierId: supplierA,
      receivedAt: "2026-08-13",
      productName: "Roasted Gayo Medium Reuse",
      productRoastLevel: "MEDIUM",
      coffeeSourceId: source.id,
      weightKg: 3,
      totalCost: 360_000,
      shippingCost: 0,
      paidAmount: 360_000,
      paymentMethod: "CASH",
    });
    expect(second.success).toBe(true);

    const rows = await client.product.findMany({
      where: { tenantId: TENANT_A, name: { equals: "Roasted Gayo Medium Reuse", mode: "insensitive" } },
    });
    expect(rows).toHaveLength(1);
    expect(Number(rows[0].stockKg)).toBe(5);
    expect(rows[0].coffeeSourceId).toBe(source.id);
  });

  it("creates a NEW CoffeeSource for inline sources even when the name repeats (different process)", async () => {
    authState.tenantId = TENANT_A;
    const name = `Roasted Sumber Ganda ${randomUUID().slice(0, 6)}`;
    const one = await createRoastedBeanPurchase({
      operationKey: randomUUID(),
      supplierId: supplierA,
      receivedAt: "2026-08-14",
      productName: name,
      productRoastLevel: "MEDIUM",
      coffeeSource: { name: "Sumber Nama Sama", region: "Gayo", processMethod: "Natural" },
      weightKg: 2,
      totalCost: 240_000,
      shippingCost: 0,
      paidAmount: 240_000,
      paymentMethod: "CASH",
    });
    const two = await createRoastedBeanPurchase({
      operationKey: randomUUID(),
      supplierId: supplierA,
      receivedAt: "2026-08-15",
      productName: name,
      productRoastLevel: "MEDIUM",
      coffeeSource: { name: "Sumber Nama Sama", region: "Gayo", processMethod: "Washed" },
      weightKg: 2,
      totalCost: 240_000,
      shippingCost: 0,
      paidAmount: 240_000,
      paymentMethod: "CASH",
    });
    expect(one.success && two.success).toBe(true);

    const sources = await client.coffeeSource.findMany({
      where: { tenantId: TENANT_A, name: "Sumber Nama Sama" },
    });
    expect(sources).toHaveLength(2);
    expect(new Set(sources.map((s) => s.processMethod))).toEqual(new Set(["Natural", "Washed"]));
    // Sumber berbeda ⇒ produk pun tidak dicampur dalam satu Product.
    const products = await client.product.findMany({
      where: { tenantId: TENANT_A, name: { equals: name, mode: "insensitive" } },
    });
    expect(products).toHaveLength(2);
  });

  it("does NOT reuse across different roast levels even with the same name and source", async () => {
    authState.tenantId = TENANT_A;
    const source = await client.coffeeSource.create({
      data: {
        tenantId: TENANT_A,
        code: `CS-CFP-DIFF-${randomUUID().slice(0, 8)}`,
        name: "Sumber Satu Nama Dua Sangrai",
        isActive: true,
      },
    });
    const light = await createRoastedBeanPurchase({
      operationKey: randomUUID(),
      supplierId: supplierA,
      receivedAt: "2026-08-12",
      productName: "Roasted Satu Nama Dua Sangrai",
      productRoastLevel: "LIGHT",
      coffeeSourceId: source.id,
      weightKg: 2,
      totalCost: 220_000,
      shippingCost: 0,
      paidAmount: 220_000,
      paymentMethod: "CASH",
    });
    const dark = await createRoastedBeanPurchase({
      operationKey: randomUUID(),
      supplierId: supplierA,
      receivedAt: "2026-08-12",
      productName: "Roasted Satu Nama Dua Sangrai",
      productRoastLevel: "DARK",
      coffeeSourceId: source.id,
      weightKg: 2,
      totalCost: 220_000,
      shippingCost: 0,
      paidAmount: 220_000,
      paymentMethod: "CASH",
    });
    expect(light.success && dark.success).toBe(true);

    const rows = await client.product.findMany({
      where: { tenantId: TENANT_A, name: { equals: "Roasted Satu Nama Dua Sangrai", mode: "insensitive" } },
    });
    expect(rows).toHaveLength(2);
    expect(new Set(rows.map((r) => r.roastLevel))).toEqual(new Set(["LIGHT", "DARK"]));
    expect(rows.every((r) => r.coffeeSourceId === source.id)).toBe(true);
  });

  it("rejects a direct purchase into an internal-roast or unidentified RB product", async () => {
    authState.tenantId = TENANT_A;
    const internal = await client.product.create({
      data: {
        tenantId: TENANT_A,
        code: `RB-CFP-INTERNAL-${randomUUID().slice(0, 8)}`,
        name: "Roasted Hasil Sangrai Sendiri",
        type: "ROASTED_BEAN",
        roastLevel: "DARK",
        materialOrigin: "INTERNAL_ROAST",
        isActive: true,
      },
    });
    const result = await createRoastedBeanPurchase({
      operationKey: randomUUID(),
      supplierId: supplierA,
      receivedAt: "2026-08-11",
      productId: internal.id,
      productRoastLevel: "DARK",
      weightKg: 3,
      totalCost: 360_000,
      shippingCost: 0,
      paidAmount: 360_000,
      paymentMethod: "CASH",
    });
    expect(result.success).toBe(false);
    expect(result.success ? "" : result.error).toMatch(/harus berstatus beli jadi/);

    const untouched = await client.product.findUniqueOrThrow({ where: { id: internal.id } });
    expect(Number(untouched.stockKg)).toBe(0);
    expect(untouched.materialOrigin).toBe("INTERNAL_ROAST");

    const unidentified = await client.product.create({
      data: {
        tenantId: TENANT_A,
        code: `RB-CFP-NOSRC-${randomUUID().slice(0, 8)}`,
        name: "Roasted Tanpa Sumber",
        type: "ROASTED_BEAN",
        roastLevel: "MEDIUM",
        materialOrigin: "PURCHASED_ROASTED",
        isActive: true,
      },
    });
    const noSource = await createRoastedBeanPurchase({
      operationKey: randomUUID(),
      supplierId: supplierA,
      receivedAt: "2026-08-11",
      productId: unidentified.id,
      productRoastLevel: "MEDIUM",
      weightKg: 3,
      totalCost: 360_000,
      shippingCost: 0,
      paidAmount: 360_000,
      paymentMethod: "CASH",
    });
    expect(noSource.success).toBe(false);
    expect(noSource.success ? "" : noSource.error).toMatch(/harus berstatus beli jadi/);
  });

  it("accepts an existing purchased RB with a linked source and does not rewrite its origin", async () => {
    authState.tenantId = TENANT_A;
    const source = await client.coffeeSource.create({
      data: {
        tenantId: TENANT_A,
        code: `CS-CFP-EXIST-${randomUUID().slice(0, 8)}`,
        name: "Sumber Sudah Ada",
        isActive: true,
      },
    });
    const existing = await client.product.create({
      data: {
        tenantId: TENANT_A,
        code: `RB-CFP-EXIST-${randomUUID().slice(0, 8)}`,
        name: "Roasted Sudah Ada",
        type: "ROASTED_BEAN",
        roastLevel: "DARK",
        materialOrigin: "PURCHASED_ROASTED",
        coffeeSourceId: source.id,
        isActive: true,
      },
    });

    const result = await createRoastedBeanPurchase({
      operationKey: randomUUID(),
      supplierId: supplierA,
      receivedAt: "2026-08-11",
      productId: existing.id,
      productRoastLevel: "DARK",
      weightKg: 3,
      totalCost: 360_000,
      shippingCost: 0,
      paidAmount: 360_000,
      paymentMethod: "CASH",
    });
    expect(result.success).toBe(true);

    const refreshed = await client.product.findUniqueOrThrow({ where: { id: existing.id } });
    expect(refreshed.materialOrigin).toBe("PURCHASED_ROASTED");
    expect(refreshed.coffeeSourceId).toBe(source.id);
    expect(Number(refreshed.stockKg)).toBe(3);
    expect(Number(refreshed.avgCostPerKg)).toBe(120_000);
  });

  it("links a new green bean purchase to an atomically created CoffeeSource", async () => {
    authState.tenantId = TENANT_A;
    const name = `Green Bean Sumber Baru ${randomUUID().slice(0, 6)}`;
    const result = await createGreenBeanPurchase({
      operationKey: randomUUID(),
      supplierId: supplierA,
      receivedAt: "2026-08-12",
      productName: name,
      productOrigin: "Toraja",
      weightKg: 25,
      totalCost: 2_500_000,
      shippingCost: 0,
      paidAmount: 2_500_000,
      paymentMethod: "CASH",
    });
    expect(result.success).toBe(true);

    const gb = await client.product.findFirstOrThrow({
      where: { tenantId: TENANT_A, name: { equals: name, mode: "insensitive" } },
    });
    expect(gb.type).toBe("GREEN_BEAN");
    expect(gb.coffeeSourceId).not.toBeNull();
    expect(gb.origin).toBe("Toraja");

    // Sumber dibuat deterministik 1:1 dengan kode produk (sama seperti master data).
    const source = await client.coffeeSource.findUniqueOrThrow({
      where: { id: gb.coffeeSourceId as string },
    });
    expect(source.code).toBe(gb.code);
    expect(source.tenantId).toBe(TENANT_A);
  });

  it("does NOT merge green bean products by name — same name with different identity creates a new Product + CoffeeSource", async () => {
    authState.tenantId = TENANT_A;
    const name = `Green Bean Tanpa Gabung ${randomUUID().slice(0, 6)}`;
    const first = await createGreenBeanPurchase({
      operationKey: randomUUID(),
      supplierId: supplierA,
      receivedAt: "2026-08-12",
      productName: name,
      productOrigin: "Toraja",
      weightKg: 25,
      totalCost: 2_500_000,
      shippingCost: 0,
      paidAmount: 2_500_000,
      paymentMethod: "CASH",
    });
    const second = await createGreenBeanPurchase({
      operationKey: randomUUID(),
      supplierId: supplierA,
      receivedAt: "2026-08-13",
      productName: name,
      productOrigin: "Kintamani",
      weightKg: 25,
      totalCost: 2_500_000,
      shippingCost: 0,
      paidAmount: 2_500_000,
      paymentMethod: "CASH",
    });
    expect(first.success && second.success).toBe(true);

    const products = await client.product.findMany({
      where: { tenantId: TENANT_A, name: { equals: name, mode: "insensitive" }, type: "GREEN_BEAN" },
    });
    expect(products).toHaveLength(2);
    expect(new Set(products.map((p) => p.origin))).toEqual(new Set(["Toraja", "Kintamani"]));
    // Setiap GB punya sumber atomiknya sendiri (kode sumber == kode produk).
    const productCodes = products.map((p) => p.code);
    const sources = await client.coffeeSource.findMany({
      where: { tenantId: TENANT_A, code: { in: productCodes } },
    });
    expect(sources).toHaveLength(2);
  });

  it("is idempotent per operationKey (single purchase row)", async () => {
    authState.tenantId = TENANT_A;
    const operationKey = randomUUID();
    const first = await createRoastedBeanPurchase({
      operationKey,
      supplierId: supplierA,
      receivedAt: "2026-08-11",
      productName: "Roasted Idempotent Gayo",
      productRoastLevel: "LIGHT",
      coffeeSource: { name: "Sumber Idempotent Gayo", region: "Gayo" },
      weightKg: 2,
      totalCost: 200_000,
      shippingCost: 0,
      paidAmount: 200_000,
      paymentMethod: "CASH",
    });
    const second = await createRoastedBeanPurchase({
      operationKey,
      supplierId: supplierA,
      receivedAt: "2026-08-11",
      productName: "Roasted Idempotent Gayo",
      productRoastLevel: "LIGHT",
      coffeeSource: { name: "Sumber Idempotent Gayo", region: "Gayo" },
      weightKg: 99,
      totalCost: 999_999,
      shippingCost: 0,
      paidAmount: 999_999,
      paymentMethod: "CASH",
    });

    expect(first.success && second.success && first.purchaseCode).toBe(second.success ? second.purchaseCode : "");
    const rows = await client.purchase.count({ where: { operationKey } });
    expect(rows).toBe(1);
  });

  it("rejects invalid roast level and non-RB / wrong-tenant product selection", async () => {
    authState.tenantId = TENANT_A;
    const badLevel = await createRoastedBeanPurchase({
      operationKey: randomUUID(),
      supplierId: supplierA,
      receivedAt: "2026-08-11",
      productName: "Roasted Level Rusak",
      productRoastLevel: "EXTRA_LIGHT",
      weightKg: 1,
      totalCost: 100_000,
      shippingCost: 0,
      paidAmount: 100_000,
      paymentMethod: "CASH",
    });
    expect(badLevel.success).toBe(false);
    expect(badLevel.success ? "" : badLevel.error).toContain("Tingkat sangrai");

    const gb = await client.product.create({
      data: {
        tenantId: TENANT_A,
        code: `GB-CFP-MISUSE-${randomUUID().slice(0, 8)}`,
        name: "Green Bean Salah Alur",
        type: "GREEN_BEAN",
        isActive: true,
      },
    });
    const wrongProduct = await createRoastedBeanPurchase({
      operationKey: randomUUID(),
      supplierId: supplierA,
      receivedAt: "2026-08-11",
      productId: gb.id,
      productRoastLevel: "MEDIUM",
      weightKg: 1,
      totalCost: 100_000,
      shippingCost: 0,
      paidAmount: 100_000,
      paymentMethod: "CASH",
    });
    expect(wrongProduct.success).toBe(false);
    expect(wrongProduct.success ? "" : wrongProduct.error).toMatch(/bukan Green Bean aktif|harus berstatus beli jadi/);

    // ── Fix4: penolakan lintas tenant ──
    authState.tenantId = TENANT_B;
    const crossTenantProduct = await createRoastedBeanPurchase({
      operationKey: randomUUID(),
      supplierId: supplierB,
      receivedAt: "2026-08-11",
      productId: gb.id,
      productRoastLevel: "MEDIUM",
      weightKg: 1,
      totalCost: 100_000,
      shippingCost: 0,
      paidAmount: 100_000,
      paymentMethod: "CASH",
    });
    expect(crossTenantProduct.success).toBe(false);
    expect(crossTenantProduct.success ? "" : crossTenantProduct.error).toContain("bukan milik tenant");

    const crossTenantSupplier = await createRoastedBeanPurchase({
      operationKey: randomUUID(),
      supplierId: supplierA,
      receivedAt: "2026-08-11",
      productName: "Roasted Tenant B Coba",
      productRoastLevel: "MEDIUM",
      weightKg: 1,
      totalCost: 100_000,
      shippingCost: 0,
      paidAmount: 100_000,
      paymentMethod: "CASH",
    });
    expect(crossTenantSupplier.success).toBe(false);
    expect(crossTenantSupplier.success ? "" : crossTenantSupplier.error).toContain("Supplier tidak ditemukan");

    // Tenant B tetap bisa membeli untuk dirinya sendiri.
    authState.tenantId = TENANT_A;
  });

  it("stamps ROASTED_BEAN purchase + PURCHASE_RB ledger when a PO is received", async () => {
    authState.tenantId = TENANT_A;
    const source = await client.coffeeSource.create({
      data: {
        tenantId: TENANT_A,
        code: `CS-CFP-PO-${randomUUID().slice(0, 8)}`,
        name: "Sumber PO Gayo",
        isActive: true,
      },
    });
    const rb = await client.product.create({
      data: {
        tenantId: TENANT_A,
        code: `RB-CFP-PO-${randomUUID().slice(0, 8)}`,
        name: "Roasted PO Gayo",
        type: "ROASTED_BEAN",
        roastLevel: "MEDIUM_DARK",
        materialOrigin: "PURCHASED_ROASTED",
        coffeeSourceId: source.id,
        isActive: true,
      },
    });

    const po = await createDraftPO(
      client,
      { supplierId: supplierA, items: [{ productId: rb.id, quantity: 5, unitPrice: 150_000 }] },
      `user-${TENANT_A}`,
    );
    await sendPO(client, po.id);
    const poItem = await client.purchaseOrderItem.findFirstOrThrow({
      where: { purchaseOrderId: po.id },
      select: { id: true },
    });

    const received = await receivePO(
      client,
      po.id,
      {
        receivedAt: "2026-08-11",
        paymentMethod: "CREDIT",
        items: [{ poItemId: poItem.id, receivedQuantity: 5 }],
      },
      `user-${TENANT_A}`,
    );

    const purchase = await client.purchase.findFirstOrThrow({
      where: { code: received.purchaseCodes[0] },
    });
    expect(purchase.type).toBe("ROASTED_BEAN");
    expect(purchase.productId).toBe(rb.id);

    const ledger = await client.inventoryLedger.findFirstOrThrow({
      where: { refId: purchase.id, productId: rb.id },
    });
    expect(ledger.refType).toBe("PURCHASE_RB");
    expect(ledger.entryType).toBe("IN");
    expect(Number(ledger.quantityKg)).toBe(5);

    const journal = await client.journalEntry.findFirstOrThrow({
      where: { refType: "PURCHASE", reference: purchase.id },
    });
    const lines = await client.journalLine.findMany({
      where: { journalEntryId: journal.id },
      include: { account: true },
    });
    expect(Number(lines.find((l) => l.account.code === "1-1210")?.debit ?? 0)).toBe(750_000);
    expect(Number(lines.find((l) => l.account.code === "2-1000")?.credit ?? 0)).toBe(750_000);

    const refreshed = await client.product.findUniqueOrThrow({ where: { id: rb.id } });
    expect(Number(refreshed.stockKg)).toBe(5);
    expect(Number(refreshed.avgCostPerKg)).toBe(150_000);
  });
});
