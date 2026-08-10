import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { prisma } from "@/lib/prisma";
import { createDraftPO, receivePO, sendPO } from "@/lib/po-lite";
import {
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
  const { prisma } = await import("@/lib/prisma");
  return {
    requireRole: vi.fn(async () => ({
      id: `user-${authState.tenantId}`,
      tenantId: authState.tenantId,
      role: "OWNER" as const,
    })),
    requireTenantPrisma: vi.fn(async () => prisma),
    getCurrentTenantId: vi.fn(async () => authState.tenantId),
    getSystemUserId: vi.fn(async () => `user-${authState.tenantId}`),
  };
});

suite("roasted bean procurement — real PostgreSQL (TEST_DATABASE_URL)", () => {
  let supplierA = "";
  let supplierB = "";

  beforeAll(async () => {
    for (const [id, code] of [
      [TENANT_A, "CFPA"],
      [TENANT_B, "CFPB"],
    ] as const) {
      await prisma.tenant.upsert({
        where: { id },
        create: { id, code, name: `Coffee Purchase ${code}`, subscriptionTier: "BASIC", subscriptionStatus: "ACTIVE", isActive: true },
        update: {},
      });
    }
    await prisma.user.upsert({
      where: { id: `user-${TENANT_A}` },
      create: { id: `user-${TENANT_A}`, email: "cfp-a@example.com", name: "CFP Owner A", tenantId: TENANT_A, role: "OWNER" },
      update: {},
    });
    await prisma.user.upsert({
      where: { id: `user-${TENANT_B}` },
      create: { id: `user-${TENANT_B}`, email: "cfp-b@example.com", name: "CFP Owner B", tenantId: TENANT_B, role: "OWNER" },
      update: {},
    });

    const supA = await prisma.supplier.create({
      data: { tenantId: TENANT_A, code: "SUP-CFPA-001", name: "Supplier Roasted A", isActive: true },
    });
    supplierA = supA.id;
    const supB = await prisma.supplier.create({
      data: { tenantId: TENANT_B, code: "SUP-CFPB-001", name: "Supplier Roasted B", isActive: true },
    });
    supplierB = supB.id;
  });

  afterAll(async () => {
    for (const tenantId of [TENANT_A, TENANT_B]) {
      await prisma.auditLog.deleteMany({ where: { tenantId } });
      await prisma.journalLine.deleteMany({ where: { journalEntry: { tenantId } } });
      await prisma.journalEntry.deleteMany({ where: { tenantId } });
      await prisma.account.deleteMany({ where: { tenantId } });
      await prisma.inventoryLedger.deleteMany({ where: { tenantId } });
      await prisma.lotPlacement.deleteMany({ where: { tenantId } });
      await prisma.lot.deleteMany({ where: { tenantId } });
      await prisma.supplierPayment.deleteMany({ where: { tenantId } });
      await prisma.purchase.deleteMany({ where: { tenantId } });
      await prisma.purchaseOrderItem.deleteMany({ where: { tenantId } });
      await prisma.purchaseOrder.deleteMany({ where: { tenantId } });
      await prisma.product.deleteMany({ where: { tenantId } });
      await prisma.supplier.deleteMany({ where: { tenantId } });
    }
    await prisma.user.deleteMany({ where: { tenantId: { in: [TENANT_A, TENANT_B] } } });
    await prisma.tenant.deleteMany({ where: { id: { in: [TENANT_A, TENANT_B] } } });
  });

  it("directly purchases a new roasted bean: product, purchase, lot, ledger, costing, journal", async () => {
    authState.tenantId = TENANT_A;
    const result = await createRoastedBeanPurchase({
      operationKey: randomUUID(),
      supplierId: supplierA,
      receivedAt: "2026-08-11",
      productName: "Roasted Beli Jadi Gayo",
      productOrigin: "Gayo",
      productRoastLevel: "MEDIUM",
      weightKg: 10,
      totalCost: 1_200_000,
      shippingCost: 100_000,
      paidAmount: 500_000,
      paymentMethod: "TRANSFER",
      bestBeforeDate: "2026-11-11",
      lotNumber: "LOT-SUP-RB-01",
    });

    expect(result.success).toBe(true);

    // Find-or-create mengklasifikasi RB beli jadi dengan identitas jujur.
    const rb = await prisma.product.findFirstOrThrow({
      where: { tenantId: TENANT_A, name: { equals: "Roasted Beli Jadi Gayo", mode: "insensitive" } },
    });
    expect(rb.type).toBe("ROASTED_BEAN");
    expect(rb.materialOrigin).toBe("PURCHASED_ROASTED");
    expect(rb.coffeeSourceId).toBeNull();
    expect(rb.sourceGreenBeanId).toBeNull();
    expect(rb.roastLevel).toBe("MEDIUM");
    expect(rb.origin).toBe("Gayo");
    expect(Number(rb.stockKg)).toBe(10);
    expect(Number(rb.avgCostPerKg)).toBe(120_000);

    const purchase = await prisma.purchase.findFirstOrThrow({
      where: { code: result.success ? result.purchaseCode : "" },
    });
    expect(purchase.type).toBe("ROASTED_BEAN");
    expect(purchase.productId).toBe(rb.id);
    expect(purchase.paymentStatus).toBe("PARTIAL");
    expect(Number(purchase.totalCost)).toBe(1_200_000);
    expect(Number(purchase.pricePerUnit)).toBe(110_000);

    const payment = await prisma.supplierPayment.findFirstOrThrow({
      where: { purchaseId: purchase.id },
    });
    expect(Number(payment.amount)).toBe(500_000);
    expect(payment.method).toBe("TRANSFER");

    const lot = await prisma.lot.findFirstOrThrow({ where: { purchaseId: purchase.id } });
    expect(lot.productId).toBe(rb.id);
    expect(lot.batchCode).toBe(purchase.code);
    expect(Number(lot.quantityKg)).toBe(10);
    expect(lot.expiryDate).toEqual(new Date("2026-11-11T00:00:00"));
    expect(lot.notes).toBe("Lot supplier: LOT-SUP-RB-01");

    const placement = await prisma.lotPlacement.findFirstOrThrow({ where: { lotId: lot.id } });
    expect(Number(placement.quantityKg)).toBe(10);

    const ledger = await prisma.inventoryLedger.findFirstOrThrow({
      where: { refId: purchase.id, productId: rb.id },
    });
    expect(ledger.entryType).toBe("IN");
    expect(ledger.refType).toBe("PURCHASE_RB");
    expect(Number(ledger.quantityKg)).toBe(10);

    const journal = await prisma.journalEntry.findFirstOrThrow({
      where: { refType: "PURCHASE", reference: purchase.id },
    });
    const lines = await prisma.journalLine.findMany({
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

  it("reuses an existing RB product without rewriting its material origin", async () => {
    authState.tenantId = TENANT_A;
    const existing = await prisma.product.create({
      data: {
        tenantId: TENANT_A,
        code: `RB-CFP-EXIST-${randomUUID().slice(0, 8)}`,
        name: "Roasted Sudah Ada",
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
      productId: existing.id,
      productRoastLevel: "DARK",
      weightKg: 3,
      totalCost: 360_000,
      shippingCost: 0,
      paidAmount: 360_000,
      paymentMethod: "CASH",
    });
    expect(result.success).toBe(true);

    const refreshed = await prisma.product.findUniqueOrThrow({ where: { id: existing.id } });
    expect(refreshed.materialOrigin).toBe("INTERNAL_ROAST"); // tidak ditulis ulang
    expect(Number(refreshed.stockKg)).toBe(3);
    expect(Number(refreshed.avgCostPerKg)).toBe(120_000);
  });

  it("is idempotent per operationKey", async () => {
    authState.tenantId = TENANT_A;
    const operationKey = randomUUID();
    const first = await createRoastedBeanPurchase({
      operationKey,
      supplierId: supplierA,
      receivedAt: "2026-08-11",
      productName: "Roasted Idempotent Gayo",
      productRoastLevel: "LIGHT",
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
      weightKg: 99,
      totalCost: 999_999,
      shippingCost: 0,
      paidAmount: 999_999,
      paymentMethod: "CASH",
    });

    expect(first.success && second.success && first.purchaseCode).toBe(second.success ? second.purchaseCode : "");
    const rows = await prisma.purchase.count({ where: { operationKey } });
    expect(rows).toBe(1);
  });

  it("rejects invalid roast level and non-RB product selection", async () => {
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

    const gb = await prisma.product.create({
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
    expect(wrongProduct.success ? "" : wrongProduct.error).toContain("bukan Roasted Bean aktif");
  });

  it("stamps ROASTED_BEAN purchase + PURCHASE_RB ledger when a PO is received", async () => {
    authState.tenantId = TENANT_A;
    const rb = await prisma.product.create({
      data: {
        tenantId: TENANT_A,
        code: `RB-CFP-PO-${randomUUID().slice(0, 8)}`,
        name: "Roasted PO Gayo",
        type: "ROASTED_BEAN",
        roastLevel: "MEDIUM_DARK",
        materialOrigin: "PURCHASED_ROASTED",
        isActive: true,
      },
    });

    const po = await createDraftPO(
      prisma,
      { supplierId: supplierA, items: [{ productId: rb.id, quantity: 5, unitPrice: 150_000 }] },
      `user-${TENANT_A}`,
    );
    await sendPO(prisma, po.id);
    const poItem = await prisma.purchaseOrderItem.findFirstOrThrow({
      where: { purchaseOrderId: po.id },
      select: { id: true },
    });

    const received = await receivePO(
      prisma,
      po.id,
      {
        receivedAt: "2026-08-11",
        paymentMethod: "CREDIT",
        items: [{ poItemId: poItem.id, receivedQuantity: 5 }],
      },
      `user-${TENANT_A}`,
    );

    const purchase = await prisma.purchase.findFirstOrThrow({
      where: { code: received.purchaseCodes[0] },
    });
    expect(purchase.type).toBe("ROASTED_BEAN");
    expect(purchase.productId).toBe(rb.id);

    const ledger = await prisma.inventoryLedger.findFirstOrThrow({
      where: { refId: purchase.id, productId: rb.id },
    });
    expect(ledger.refType).toBe("PURCHASE_RB");
    expect(ledger.entryType).toBe("IN");
    expect(Number(ledger.quantityKg)).toBe(5);

    const journal = await prisma.journalEntry.findFirstOrThrow({
      where: { refType: "PURCHASE", reference: purchase.id },
    });
    const lines = await prisma.journalLine.findMany({
      where: { journalEntryId: journal.id },
      include: { account: true },
    });
    expect(Number(lines.find((l) => l.account.code === "1-1210")?.debit ?? 0)).toBe(750_000);
    expect(Number(lines.find((l) => l.account.code === "2-1000")?.credit ?? 0)).toBe(750_000);

    const refreshed = await prisma.product.findUniqueOrThrow({ where: { id: rb.id } });
    expect(Number(refreshed.stockKg)).toBe(5);
    expect(Number(refreshed.avgCostPerKg)).toBe(150_000);
  });
});