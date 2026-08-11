import { randomUUID } from "node:crypto";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { resolveTestDatabaseUrl } from "../../test/setup/test-database-guard";
import { withTenant } from "./prisma";
import {
  allocateProducedStockToDemand,
  fulfillInvoiceAtHandover,
  reserveInvoiceStock,
} from "./storefront-commerce";

// Gated integration test: only runs against an isolated test DB with RUN_INTEGRATION=true.
const integrationEnabled = process.env.RUN_INTEGRATION === "true";
const suite = integrationEnabled ? describe : describe.skip;

const TENANT_A = "offering-tenant-a";
const TENANT_B = "offering-tenant-b";

const authState = vi.hoisted(() => ({ tenantId: "offering-tenant-a" }));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

vi.mock("@/lib/auth", async () => {
  const { withTenant: withTenantPrisma } = await import("./prisma");
  return {
    requireRole: vi.fn(async () => ({
      id: `user-${authState.tenantId}`,
      tenantId: authState.tenantId,
      role: "OWNER" as const,
    })),
    requireTenantPrisma: vi.fn(async () =>
      withTenantPrisma(authState.tenantId, (globalThis as any).__cfpClient),
    ),
    getCurrentTenantId: vi.fn(async () => authState.tenantId),
    getSystemUserId: vi.fn(async () => `user-${authState.tenantId}`),
  };
});

suite("coffee offerings — real PostgreSQL (TEST_DATABASE_URL)", () => {
  let client: PrismaClient;
  let pool: Pool;
  let rbProductA = "";
  let fgProductA = "";
  let csB = "";

  beforeAll(async () => {
    pool = new Pool({ connectionString: resolveTestDatabaseUrl(), max: 10 });
    client = new PrismaClient({ adapter: new PrismaPg(pool) });
    (globalThis as any).__cfpClient = client;
    await client.$connect();

    for (const [id, code] of [
      [TENANT_A, "OFFA"],
      [TENANT_B, "OFFB"],
    ] as const) {
      await client.tenant.upsert({
        where: { id },
        create: { id, code, name: `Offering Tenant ${code}`, subscriptionTier: "BASIC", subscriptionStatus: "ACTIVE", isActive: true },
        update: {},
      });
    }
    for (const tenantId of [TENANT_A, TENANT_B]) {
      await client.user.upsert({
        where: { id: `user-${tenantId}` },
        create: { id: `user-${tenantId}`, email: `owner-${tenantId}@example.com`, name: `Owner ${tenantId}`, tenantId, role: "OWNER" },
        update: {},
      });
    }

    const csA = await client.coffeeSource.create({
      data: { tenantId: TENANT_A, code: "CS-OFFA-001", name: "Gayo Purwasari", isActive: true },
    });
    csB = (await client.coffeeSource.create({
      data: { tenantId: TENANT_B, code: "CS-OFFB-001", name: "Toraja Sesean", isActive: true },
    })).id;

    const rbA = await client.product.create({
      data: {
        tenantId: TENANT_A,
        code: "RB-OFFA-001",
        name: "Gayo Purwasari Roasted",
        type: "ROASTED_BEAN",
        materialOrigin: "PURCHASED_ROASTED",
        coffeeSourceId: csA.id,
        roastLevel: "MEDIUM",
        isActive: true,
        stockUnit: 10,
        stockKg: 10,
        avgCostPerKg: 120_000,
      },
    });
    rbProductA = rbA.id;

    const fgA = await client.product.create({
      data: {
        tenantId: TENANT_A,
        code: "FG-OFFA-001",
        name: "Gayo Blend 250g",
        type: "FINISHED_GOODS",
        isActive: true,
        stockUnit: 5,
        price: 80_000,
      },
    });
    fgProductA = fgA.id;

    const offeringA = await client.coffeeOffering.create({
      data: {
        tenantId: TENANT_A,
        code: "OF-OFFA-001",
        name: "Gayo Purwasari Medium",
        sourceMode: "PURCHASED_ROASTED",
        coffeeSourceId: csA.id,
        roastLevel: "MEDIUM",
        grindOptions: ["WHOLE_BEAN", "ESPRESSO", "CUSTOM"],
        allowCustomGrind: true,
        isActive: true,
        sortOrder: 0,
      },
    });
    await client.offeringVariant.createMany({
      data: [
        { tenantId: TENANT_A, offeringId: offeringA.id, packageName: "Bungkus 250g", netWeightGrams: 250, unitPrice: 65_000, sortOrder: 0 },
        { tenantId: TENANT_A, offeringId: offeringA.id, packageName: "Cairan 1kg", netWeightGrams: 1000, unitPrice: 240_000, sortOrder: 1 },
      ],
    });
  });

  afterAll(async () => {
    if (!client) return;
    await client.inventoryLedger.deleteMany({ where: { tenantId: { in: [TENANT_A, TENANT_B] } } });
    await client.journalLine.deleteMany({ where: { journalEntry: { tenantId: { in: [TENANT_A, TENANT_B] } } } });
    await client.journalEntry.deleteMany({ where: { tenantId: { in: [TENANT_A, TENANT_B] } } });
    await client.account.deleteMany({ where: { tenantId: { in: [TENANT_A, TENANT_B] } } });
    await client.stockReservation.deleteMany({ where: { tenantId: { in: [TENANT_A, TENANT_B] } } });
    await client.fulfillmentTask.deleteMany({ where: { tenantId: { in: [TENANT_A, TENANT_B] } } });
    await client.invoiceItem.deleteMany({ where: { tenantId: { in: [TENANT_A, TENANT_B] } } });
    await client.invoice.deleteMany({ where: { tenantId: { in: [TENANT_A, TENANT_B] } } });
    await client.customer.deleteMany({ where: { tenantId: { in: [TENANT_A, TENANT_B] } } });
    await client.offeringVariant.deleteMany({ where: { tenantId: { in: [TENANT_A, TENANT_B] } } });
    await client.coffeeOffering.deleteMany({ where: { tenantId: { in: [TENANT_A, TENANT_B] } } });
    await client.product.deleteMany({ where: { tenantId: { in: [TENANT_A, TENANT_B] } } });
    await client.coffeeSource.deleteMany({ where: { tenantId: { in: [TENANT_A, TENANT_B] } } });
    await client.user.deleteMany({ where: { tenantId: { in: [TENANT_A, TENANT_B] } } });
    await client.tenant.deleteMany({ where: { id: { in: [TENANT_A, TENANT_B] } } });
    await client.$disconnect();
  });

  async function makeInvoice(
    tenantId: string,
    code: string,
    items: Array<Record<string, unknown>>,
    options: { status?: string; fulfillmentStatus?: string } = {},
  ) {
    const customer = await client.customer.create({
      data: { tenantId, code: `CST-${code}`, name: "Budi Storefront", isActive: true },
    });
    return client.invoice.create({
      data: {
        tenantId,
        code,
        customerId: customer.id,
        subtotal: 130_000,
        discount: 0,
        tax: 13_000,
        shippingCost: 0,
        grandTotal: 143_000,
        paidAmount: 143_000,
        status: (options.status ?? "ISSUED") as any,
        fulfillmentStatus: (options.fulfillmentStatus ?? "AWAITING_PAYMENT") as any,
        createdById: `user-${tenantId}`,
        reservationExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        items: { create: items as any },
      },
    });
  }

  it("rejects cross-tenant writes referencing another tenant's coffee source", async () => {
    const tpA = withTenant(TENANT_A, client);
    await expect(
      tpA.coffeeOffering.create({
        data: {
          tenantId: TENANT_A,
          code: "OF-OFFA-X",
          name: "Toraja (salah tenant)",
          sourceMode: "PURCHASED_ROASTED",
          coffeeSourceId: csB,
          grindOptions: ["WHOLE_BEAN"],
        },
      }),
    ).rejects.toThrow(/Cross-tenant/);
  });

  it("reserves offering stock in kg on the lineage roasted bean product", async () => {
    const invoice = await makeInvoice(TENANT_A, "OFFA-INV-001", [
      { tenantId: TENANT_A, productId: rbProductA, quantity: 2, unitPrice: 65_000, subtotal: 130_000, hpp: 30_000, grindSize: "ESPRESSO", offeringId: null },
    ]);
    const tpA = withTenant(TENANT_A, client);
    const result = await tpA.$transaction((tx) =>
      reserveInvoiceStock(tx, {
        tenantId: TENANT_A,
        invoiceId: invoice.id,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        items: [{ productId: rbProductA, quantity: 3, quantityKg: 1.5 }],
      }),
    );

    expect(result.hasShortage).toBe(false);
    const reservations = await client.stockReservation.findMany({
      where: { tenantId: TENANT_A, invoiceId: invoice.id },
    });
    expect(reservations).toHaveLength(1);
    expect(reservations[0].quantity).toBe(3);
    expect(Number(reservations[0].quantityKg)).toBe(1.5);
  });

  it("caps kg reservations at available stock and records a shortage task", async () => {
    const invoice = await makeInvoice(TENANT_A, "OFFA-INV-002", [
      { tenantId: TENANT_A, productId: rbProductA, quantity: 9, unitPrice: 65_000, subtotal: 585_000, hpp: 30_000, grindSize: "WHOLE_BEAN", offeringId: null },
    ]);
    const tpA = withTenant(TENANT_A, client);
    const result = await tpA.$transaction((tx) =>
      reserveInvoiceStock(tx, {
        tenantId: TENANT_A,
        invoiceId: invoice.id,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        items: [{ productId: rbProductA, quantity: 9, quantityKg: 2.25 }],
      }),
    );

    // 3 units are already reserved for the first invoice; 10 - 3 = 7 available.
    expect(result.hasShortage).toBe(true);
    const reservations = await client.stockReservation.findMany({
      where: { tenantId: TENANT_A, invoiceId: invoice.id },
    });
    expect(reservations).toHaveLength(1);
    expect(reservations[0].quantity).toBe(7);
    expect(Number(reservations[0].quantityKg)).toBe(2.25);
    const tasks = await client.fulfillmentTask.findMany({
      where: { tenantId: TENANT_A, invoiceId: invoice.id },
    });
    expect(tasks).toHaveLength(1);
    expect(tasks[0].requestedQuantity).toBe(9);
    expect(tasks[0].reservedQuantity).toBe(7);
    expect(tasks[0].shortageQuantity).toBe(2);
  });

  it("hands over an invoice with kg and unit reservations, posting ledger + journal", async () => {
    const invoice = await makeInvoice(TENANT_A, "OFFA-INV-003", [
      {
        tenantId: TENANT_A,
        productId: rbProductA,
        quantity: 2,
        unitPrice: 65_000,
        subtotal: 130_000,
        hpp: 30_000,
        grindSize: "ESPRESSO",
        netWeightGrams: 250,
        offeringId: null,
        offeringName: "Gayo Purwasari Medium",
        packageName: "Bungkus 250g",
        roastLevel: "MEDIUM",
      },
      {
        tenantId: TENANT_A,
        productId: fgProductA,
        quantity: 1,
        unitPrice: 80_000,
        subtotal: 80_000,
        hpp: 20_000,
        grindSize: null,
      },
    ]);
    const tpA = withTenant(TENANT_A, client);
    await client.stockReservation.createMany({
      data: [
        { tenantId: TENANT_A, invoiceId: invoice.id, productId: rbProductA, quantity: 2, quantityKg: 0.5, expiresAt: new Date(Date.now() + 1000) },
        { tenantId: TENANT_A, invoiceId: invoice.id, productId: fgProductA, quantity: 1, quantityKg: null, expiresAt: new Date(Date.now() + 1000) },
      ],
    });

    const result = await tpA.$transaction((tx) =>
      fulfillInvoiceAtHandover(tx, {
        tenantId: TENANT_A,
        invoiceId: invoice.id,
        createdById: `user-${TENANT_A}`,
      }),
    );

    expect(result.alreadyFulfilled).toBe(false);
    expect(result.fulfilledReservations).toBe(2);

    const after = await client.invoice.findUniqueOrThrow({ where: { id: invoice.id } });
    expect(after.fulfillmentStatus).toBe("DELIVERED");
    expect(after.deliveredAt).not.toBeNull();

    const active = await client.stockReservation.count({
      where: { tenantId: TENANT_A, invoiceId: invoice.id, status: "ACTIVE" },
    });
    expect(active).toBe(0);

    // Kg-mode reservation consumed the roasted bean in kg; unit-mode used units.
    const ledger = await client.inventoryLedger.findMany({
      where: { tenantId: TENANT_A, refType: "SALE_FG_OUT", refId: invoice.id },
    });
    expect(ledger).toHaveLength(2);
    const kgEntry = ledger.find((entry) => entry.productId === rbProductA);
    const unitEntry = ledger.find((entry) => entry.productId === fgProductA);
    expect(Number(kgEntry!.quantityKg)).toBe(0.5);
    expect(kgEntry!.quantityUnit).toBe(0);
    expect(unitEntry!.quantityUnit).toBe(1);
    expect(Number(unitEntry!.quantityKg)).toBe(0);

    const journal = await client.journalEntry.findFirst({
      where: { tenantId: TENANT_A, refType: "INVOICE", reference: invoice.id },
    });
    expect(journal).not.toBeNull();
  });

  it("refuses handover when the kg reservation is below the order weight", async () => {
    const invoice = await makeInvoice(TENANT_A, "OFFA-INV-004", [
      {
        tenantId: TENANT_A,
        productId: rbProductA,
        quantity: 2,
        unitPrice: 65_000,
        subtotal: 130_000,
        hpp: 30_000,
        grindSize: "WHOLE_BEAN",
        netWeightGrams: 250,
        offeringId: null,
        offeringName: "Gayo Purwasari Medium",
        packageName: "Bungkus 250g",
        roastLevel: "MEDIUM",
      },
    ]);
    await client.stockReservation.create({
      data: {
        tenantId: TENANT_A,
        invoiceId: invoice.id,
        productId: rbProductA,
        quantity: 2,
        quantityKg: 0.25,
        expiresAt: new Date(Date.now() + 1000),
      },
    });
    const tpA = withTenant(TENANT_A, client);

    await expect(
      tpA.$transaction((tx) =>
        fulfillInvoiceAtHandover(tx, {
          tenantId: TENANT_A,
          invoiceId: invoice.id,
          createdById: `user-${TENANT_A}`,
        }),
      ),
    ).rejects.toThrow("Stok pesanan belum seluruhnya dialokasikan.");

    const after = await client.invoice.findUniqueOrThrow({ where: { id: invoice.id } });
    expect(after.fulfillmentStatus).toBe("AWAITING_PAYMENT");
    const journal = await client.journalEntry.findFirst({
      where: { tenantId: TENANT_A, refType: "INVOICE", reference: invoice.id },
    });
    expect(journal).toBeNull();
  });

  it("allocates produced stock to shortages and records kg reservations on KG products", async () => {
    const skuA = await client.product.create({
      data: {
        tenantId: TENANT_A,
        code: `RB-OFFA-ALLOC-${randomUUID().slice(0, 6)}`,
        name: "Gayo Alokasi",
        type: "ROASTED_BEAN",
        materialOrigin: "PURCHASED_ROASTED",
        isActive: true,
        stockUnit: 10,
        stockKg: 10,
      },
    });
    const invoice = await makeInvoice(TENANT_A, `OFFA-ALLOC-${randomUUID().slice(0, 6)}`, [
      { tenantId: TENANT_A, productId: skuA.id, quantity: 3, unitPrice: 65_000, subtotal: 195_000, hpp: 30_000 },
    ], { status: "PAID" });
    await client.fulfillmentTask.create({
      data: {
        tenantId: TENANT_A,
        invoiceId: invoice.id,
        productId: skuA.id,
        requestedQuantity: 3,
        reservedQuantity: 0,
        shortageQuantity: 3,
        status: "OPEN",
      },
    });

    const tpA = withTenant(TENANT_A, client);
    const result = await tpA.$transaction((tx) =>
      allocateProducedStockToDemand(tx, {
        tenantId: TENANT_A,
        productId: skuA.id,
        createdById: `user-${TENANT_A}`,
      }),
    );

    expect(result).toEqual({ allocatedUnits: 3, completedTasks: 1 });
    const reservation = await client.stockReservation.findFirstOrThrow({
      where: { tenantId: TENANT_A, invoiceId: invoice.id, productId: skuA.id },
    });
    expect(reservation.quantity).toBe(3);
    expect(Number(reservation.quantityKg)).toBe(3);
    const task = await client.fulfillmentTask.findFirstOrThrow({
      where: { tenantId: TENANT_A, invoiceId: invoice.id },
    });
    expect(task.status).toBe("COMPLETED");
  });
});