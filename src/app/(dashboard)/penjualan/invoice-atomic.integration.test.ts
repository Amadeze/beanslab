import { describe, expect, it, vi, beforeAll, afterAll } from "vitest";
import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { resolveTestDatabaseUrl } from "../../../../test/setup/test-database-guard";
import { createInvoice } from "./actions";

const integrationEnabled = process.env.RUN_INTEGRATION === "true";
const suite = integrationEnabled ? describe : describe.skip;
let prisma: PrismaClient;

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/auth", async (importOriginal) => {
  const actual = await importOriginal<any>();
  return {
    ...actual,
    getCurrentTenantId: vi.fn().mockResolvedValue("test-tenant-atomic"),
    getSystemUserId: vi.fn().mockResolvedValue("test-user-atomic"),
    requireRole: vi.fn(),
    requireFeature: vi.fn(),
    requireTenantPrisma: vi.fn(async () => prisma),
  };
});

suite("Invoice Atomic Serializable", () => {
  let customerId = "";
  let productId = "";

  beforeAll(async () => {
    const pool = new Pool({ connectionString: resolveTestDatabaseUrl(), max: 3 });
    prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
    await prisma.stockReservation.deleteMany({ where: { tenantId: "test-tenant-atomic" } });
    await prisma.fulfillmentTask.deleteMany({ where: { tenantId: "test-tenant-atomic" } });
    await prisma.invoiceItem.deleteMany({ where: { invoice: { tenantId: "test-tenant-atomic" } } });
    await prisma.payment.deleteMany({ where: { tenantId: "test-tenant-atomic" } });
    await prisma.invoice.deleteMany({ where: { tenantId: "test-tenant-atomic" } });
    await prisma.journalLine.deleteMany({ where: { journalEntry: { tenantId: "test-tenant-atomic" } } });
    await prisma.journalEntry.deleteMany({ where: { tenantId: "test-tenant-atomic" } });
    await prisma.auditLog.deleteMany({ where: { tenantId: "test-tenant-atomic" } });
    await prisma.inventoryLedger.deleteMany({ where: { tenantId: "test-tenant-atomic" } });
    await prisma.product.deleteMany({ where: { tenantId: "test-tenant-atomic" } });
    await prisma.customer.deleteMany({ where: { tenantId: "test-tenant-atomic" } });
    await prisma.user.deleteMany({ where: { id: "test-user-atomic" } });
    await prisma.tenant.deleteMany({ where: { id: "test-tenant-atomic" } });

    await prisma.tenant.create({
      data: { id: "test-tenant-atomic", code: "TEST-ATOM", name: "Atomic Test Tenant", subdomain: "test-atom" },
    });
    await prisma.user.create({
      data: { id: "test-user-atomic", email: "atomic@example.com", name: "Atomic User", tenantId: "test-tenant-atomic", role: "OWNER" },
    });
    const customer = await prisma.customer.create({
      data: { tenantId: "test-tenant-atomic", code: "CUST-ATOM-1", name: "Atomic Customer" },
    });
    customerId = customer.id;
    const product = await prisma.product.create({
      data: { tenantId: "test-tenant-atomic", code: "PROD-ATOM-1", name: "Atomic FG", type: "FINISHED_GOODS", price: 100000, stockUnit: 10, isActive: true },
    });
    productId = product.id;
  });

  afterAll(async () => {
    await prisma.stockReservation.deleteMany({ where: { tenantId: "test-tenant-atomic" } });
    await prisma.fulfillmentTask.deleteMany({ where: { tenantId: "test-tenant-atomic" } });
    await prisma.invoiceItem.deleteMany({ where: { invoice: { tenantId: "test-tenant-atomic" } } });
    await prisma.payment.deleteMany({ where: { tenantId: "test-tenant-atomic" } });
    await prisma.invoice.deleteMany({ where: { tenantId: "test-tenant-atomic" } });
    await prisma.journalLine.deleteMany({ where: { journalEntry: { tenantId: "test-tenant-atomic" } } });
    await prisma.journalEntry.deleteMany({ where: { tenantId: "test-tenant-atomic" } });
    await prisma.auditLog.deleteMany({ where: { tenantId: "test-tenant-atomic" } });
    await prisma.inventoryLedger.deleteMany({ where: { tenantId: "test-tenant-atomic" } });
    await prisma.product.deleteMany({ where: { tenantId: "test-tenant-atomic" } });
    await prisma.customer.deleteMany({ where: { tenantId: "test-tenant-atomic" } });
    await prisma.user.deleteMany({ where: { id: "test-user-atomic" } });
    await prisma.tenant.deleteMany({ where: { id: "test-tenant-atomic" } });
    await prisma.$disconnect();
  });

  it("rolls back invoice + items + reservation + journal when payment posting fails", async () => {
    // Force postCustomerPrepayment to throw inside the transaction
    const posting = await import("@/lib/posting");
    const spy = vi.spyOn(posting, "postCustomerPrepayment").mockRejectedValueOnce(new Error("simulated journal failure"));

    const result = await createInvoice({
      operationKey: "00000000-0000-4000-a000-000000000001",
      customerId,
      items: [{ productId, quantity: 2, discount: 0 }],
      invoiceDiscount: 0,
      tax: 0,
      taxType: "NONE",
      status: "PAID",
      paymentMethod: "CASH",
    });

    expect(result.success).toBe(false);
    expect((result as any).error).toMatch(/simulated journal failure/);

    // Verify NOTHING was committed: no invoice, no items, no reservation, no journal, no payment
    const invoice = await prisma.invoice.findFirst({
      where: { tenantId: "test-tenant-atomic", operationKey: "00000000-0000-4000-a000-000000000001" },
    });
    expect(invoice).toBeNull();

    const items = await prisma.invoiceItem.count({ where: { invoice: { tenantId: "test-tenant-atomic" } } });
    expect(items).toBe(0);

    const reservations = await prisma.stockReservation.count({ where: { tenantId: "test-tenant-atomic" } });
    expect(reservations).toBe(0);

    const payments = await prisma.payment.count({ where: { tenantId: "test-tenant-atomic" } });
    expect(payments).toBe(0);

    const journals = await prisma.journalEntry.count({ where: { tenantId: "test-tenant-atomic", refType: "PAYMENT" } });
    expect(journals).toBe(0);

    spy.mockRestore();
  });

  it("replays idempotent operationKey without creating duplicate invoice", async () => {
    const opKey = "00000000-0000-4000-a000-000000000002";
    const first = await createInvoice({
      operationKey: opKey,
      customerId,
      items: [{ productId, quantity: 1, discount: 0 }],
      invoiceDiscount: 0,
      tax: 0,
      taxType: "NONE",
      status: "ISSUED",
    });
    expect(first.success).toBe(true);
    if (!first.success) throw new Error((first as any).error);

    const second = await createInvoice({
      operationKey: opKey,
      customerId,
      items: [{ productId, quantity: 1, discount: 0 }],
      invoiceDiscount: 0,
      tax: 0,
      taxType: "NONE",
      status: "ISSUED",
    });
    expect(second.success).toBe(true);
    if (!second.success) throw new Error((second as any).error);
    expect(second.invoiceId).toBe(first.invoiceId);

    const count = await prisma.invoice.count({ where: { tenantId: "test-tenant-atomic", operationKey: opKey } });
    expect(count).toBe(1);
  });
});
