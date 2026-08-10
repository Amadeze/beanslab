import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { POST } from "./route";

// Gated integration test: only runs against an isolated test DB with RUN_INTEGRATION=true.
const integrationEnabled = process.env.RUN_INTEGRATION === "true";
const suite = integrationEnabled ? describe : describe.skip;

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/notifications", () => ({
  sendInvoiceEmail: vi.fn().mockResolvedValue(undefined),
  sendInvoiceWhatsApp: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/rate-limit", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/rate-limit")>();
  return {
    ...actual,
    enforceRateLimit: vi.fn().mockResolvedValue(undefined),
  };
});

const TENANT_ID = "tenant-checkout-retry";
const TENANT_SUBDOMAIN = "checkout-retry";
const USER_ID = "user-checkout-retry";
const PRODUCT_ID = "product-checkout-retry";
const PACKAGING_ID = "packaging-checkout-retry";
const INVOICE_PREFIX = "INV-RETRY-";

function prismaError(code: string) {
  return Object.assign(new Error(`Prisma error ${code}`), { code });
}

async function cleanupTenantData() {
  await prisma.stockReservation.deleteMany({ where: { tenantId: TENANT_ID } });
  await prisma.invoiceItem.deleteMany({ where: { tenantId: TENANT_ID } });
  await prisma.inventoryLedger.deleteMany({ where: { tenantId: TENANT_ID } });
  await prisma.journalLine.deleteMany({
    where: { journalEntry: { tenantId: TENANT_ID } },
  });
  await prisma.journalEntry.deleteMany({ where: { tenantId: TENANT_ID } });
  await prisma.account.deleteMany({ where: { tenantId: TENANT_ID } });
  await prisma.auditLog.deleteMany({ where: { tenantId: TENANT_ID } });
  await prisma.paymentSubmission.deleteMany({ where: { tenantId: TENANT_ID } });
  await prisma.payment.deleteMany({ where: { tenantId: TENANT_ID } });
  await prisma.invoice.deleteMany({ where: { tenantId: TENANT_ID } });
  await prisma.customer.deleteMany({ where: { tenantId: TENANT_ID } });
  await prisma.recipe.deleteMany({ where: { tenantId: TENANT_ID } });
  await prisma.product.deleteMany({ where: { tenantId: TENANT_ID } });
  await prisma.packaging.deleteMany({ where: { tenantId: TENANT_ID } });
  await prisma.user.deleteMany({ where: { tenantId: TENANT_ID } });
  await prisma.tenant.deleteMany({ where: { id: TENANT_ID } });
}

suite("checkout Serializable retry (integration)", () => {
  const state: {
    failMode: "none" | "once" | "always" | "boom";
    calls: number;
    spy: ReturnType<typeof vi.spyOn> | null;
  } = {
    failMode: "none",
    calls: 0,
    spy: null,
  };

  beforeAll(async () => {
    await cleanupTenantData();
    await prisma.tenant.create({
      data: {
        id: TENANT_ID,
        code: "RETRY",
        name: "Checkout Retry Tenant",
        subdomain: TENANT_SUBDOMAIN,
        subscriptionTier: "BASIC",
        subscriptionStatus: "ACTIVE",
        isActive: true,
      },
    });
    await prisma.user.create({
      data: {
        id: USER_ID,
        email: "checkout-retry@example.com",
        name: "Checkout Retry Owner",
        tenantId: TENANT_ID,
        role: "OWNER",
      },
    });
    await prisma.product.create({
      data: {
        id: PRODUCT_ID,
        tenantId: TENANT_ID,
        code: "FG-RETRY-1",
        name: "Retry Finished Good",
        type: "FINISHED_GOODS",
        price: 10_000,
        stockUnit: 10,
        isActive: true,
      },
    });
    await prisma.packaging.create({
      data: {
        id: PACKAGING_ID,
        tenantId: TENANT_ID,
        code: "PKG-RETRY-1",
        name: "Retry Pouch",
        weightGrams: 10,
        costPerUnit: 1_000,
      },
    });
    await prisma.recipe.create({
      data: {
        tenantId: TENANT_ID,
        code: "RCP-RETRY-1",
        name: "Retry Recipe",
        productId: PRODUCT_ID,
        packagingId: PACKAGING_ID,
        outputGrams: 1_000,
        storefrontGrindOptions: ["WHOLE_BEAN", "ESPRESSO"],
      },
    });
  });

  beforeEach(() => {
    state.failMode = "none";
    state.calls = 0;
    const origTx = prisma.$transaction.bind(prisma);
    const spyTarget = prisma as unknown as {
      $transaction: (...args: unknown[]) => Promise<unknown>;
    };
    state.spy = vi.spyOn(spyTarget, "$transaction")
      .mockImplementation(async (...args: unknown[]) => {
        state.calls += 1;
        if (state.failMode === "once" && state.calls === 1) throw prismaError("P2034");
        if (state.failMode === "always") throw prismaError("P2034");
        if (state.failMode === "boom" && state.calls === 1) throw new Error("boom");
        return (origTx as (...txArgs: unknown[]) => Promise<unknown>)(...args);
      });
  });

  afterEach(() => {
    state.spy?.mockRestore();
    state.spy = null;
  });

  afterAll(async () => {
    await cleanupTenantData();
  });

  async function runCheckout(items: Array<Record<string, unknown>> = [{ productId: PRODUCT_ID, quantity: 1 }]) {
    const req = new NextRequest(
      `http://localhost/api/tenant/${TENANT_SUBDOMAIN}/checkout`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          customerName: "Retry Customer",
          customerPhone: "0812-0000-0001",
          customerEmail: "retry@example.com",
          customerAddress: "Jl. Test Retry 1",
          shippingMethod: "PICKUP",
          items,
        }),
      },
    );
    return POST(req, { params: Promise.resolve({ subdomain: TENANT_SUBDOMAIN }) });
  }

  async function invoiceCount(): Promise<number> {
    return prisma.invoice.count({
      where: { tenantId: TENANT_ID, code: { startsWith: INVOICE_PREFIX } },
    });
  }

  it("retries a P2034 once and still creates exactly one order", async () => {
    state.failMode = "once";

    const res = await runCheckout();
    expect(res.status).toBe(200);

    expect(state.calls).toBe(2);
    expect(await invoiceCount()).toBe(1);
    expect(
      await prisma.customer.count({ where: { tenantId: TENANT_ID } }),
    ).toBe(1);
    expect(
      await prisma.stockReservation.count({ where: { tenantId: TENANT_ID } }),
    ).toBe(1);
    expect(
      await prisma.journalEntry.count({ where: { tenantId: TENANT_ID } }),
    ).toBe(0);
    expect(
      await prisma.auditLog.count({
        where: { tenantId: TENANT_ID, action: "CREATE_PUBLIC" },
      }),
    ).toBe(1);
  });

  it("stops after the retry limit and creates nothing", async () => {
    const before = await invoiceCount();
    state.failMode = "always";

    const res = await runCheckout();
    expect(res.status).toBe(500);
    expect(state.calls).toBe(3);
    expect(await invoiceCount()).toBe(before);
  });

  it("stores preparation per line while reserving shared product stock once", async () => {
    const res = await runCheckout([
      { productId: PRODUCT_ID, quantity: 1, grindSize: "WHOLE_BEAN" },
      { productId: PRODUCT_ID, quantity: 2, grindSize: "ESPRESSO" },
    ]);
    expect(res.status).toBe(200);

    const invoice = await prisma.invoice.findFirstOrThrow({
      where: { tenantId: TENANT_ID },
      orderBy: { createdAt: "desc" },
      include: { items: { orderBy: { grindSize: "asc" } }, stockReservations: true },
    });
    expect(invoice.items.map((item) => [item.grindSize, item.quantity])).toEqual([
      ["WHOLE_BEAN", 1],
      ["ESPRESSO", 2],
    ]);
    expect(invoice.stockReservations).toHaveLength(1);
    expect(invoice.stockReservations[0]?.quantity).toBe(3);
  });

  it("does not retry non-P2034 errors", async () => {
    const before = await invoiceCount();
    state.failMode = "boom";

    const res = await runCheckout();
    expect(res.status).toBe(500);
    expect(state.calls).toBe(1);
    expect(await invoiceCount()).toBe(before);
  });
});
