import { describe, expect, it, vi, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { createInvoice } from "./actions";
import { recordPayment } from "../keuangan/actions";

// Gated integration test: only runs against an isolated test DB with RUN_INTEGRATION=true.
const integrationEnabled = process.env.RUN_INTEGRATION === "true";
const suite = integrationEnabled ? describe : describe.skip;

// revalidatePath is a Next.js cache-invalidation side effect that only works
// inside a RSC request scope. The business logic under test (invoice creation,
// payment posting, FEFO ledger + journal) must still run against the real DB,
// so the mock stays at the next/cache boundary and the assertions are unchanged.
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

// Mock auth so server actions can bypass session checks 
// but still use the real Prisma client pointing to the real DB.
vi.mock("@/lib/auth", async (importOriginal) => {
  const actual = await importOriginal<any>();
  return {
    ...actual,
    getCurrentTenantId: vi.fn().mockResolvedValue("test-tenant-integration"),
    getSystemUserId: vi.fn().mockResolvedValue("test-user-integration"),
    requireRole: vi.fn(),
    requireFeature: vi.fn(),
    requireTenantPrisma: vi.fn().mockResolvedValue(prisma),
  };
});

suite("Penjualan End-to-End Integration", () => {
  let customerId = "";
  let productId = "";
  
  beforeAll(async () => {
    // Setup test tenant and data
    await prisma.tenant.upsert({
      where: { id: "test-tenant-integration" },
      create: {
        id: "test-tenant-integration",
        code: "TEST-INT",
        name: "Integration Test Tenant",
        subdomain: "test-int",
      },
      update: {},
    });

    const user = await prisma.user.upsert({
      where: { id: "test-user-integration" },
      create: {
        id: "test-user-integration",
        email: "test-int@example.com",
        name: "Test User",
        tenantId: "test-tenant-integration",
        role: "OWNER",
      },
      update: {},
    });

    const customer = await prisma.customer.create({
      data: {
        tenantId: "test-tenant-integration",
        code: "CUST-INT-1",
        name: "Test Customer",
      }
    });
    customerId = customer.id;

    const product = await prisma.product.create({
      data: {
        tenantId: "test-tenant-integration",
        code: "PROD-INT-1",
        name: "Test Finished Good",
        type: "FINISHED_GOODS",
        price: 50000,
        stockUnit: 100, // Initial stock
        isActive: true,
      }
    });
    productId = product.id;
  });

  afterAll(async () => {
    // Cleanup in FK order: journal lines -> entries -> accounts -> audit log
    // before the user/tenant rows they reference are removed.
    await prisma.journalLine.deleteMany({ where: { journalEntry: { tenantId: "test-tenant-integration" } } });
    await prisma.journalEntry.deleteMany({ where: { tenantId: "test-tenant-integration" } });
    await prisma.account.deleteMany({ where: { tenantId: "test-tenant-integration" } });
    await prisma.auditLog.deleteMany({ where: { tenantId: "test-tenant-integration" } });
    await prisma.inventoryLedger.deleteMany({ where: { tenantId: "test-tenant-integration" }});
    await prisma.invoiceItem.deleteMany({ where: { invoice: { tenantId: "test-tenant-integration" } }});
    await prisma.payment.deleteMany({ where: { tenantId: "test-tenant-integration" }});
    await prisma.invoice.deleteMany({ where: { tenantId: "test-tenant-integration" }});
    await prisma.product.deleteMany({ where: { tenantId: "test-tenant-integration" }});
    await prisma.customer.deleteMany({ where: { tenantId: "test-tenant-integration" }});
    await prisma.user.deleteMany({ where: { id: "test-user-integration" }});
    await prisma.tenant.deleteMany({ where: { id: "test-tenant-integration" }});
  });

  it("should create invoice, process payment, and deduct inventory", async () => {
    // 1. Order (Create Invoice)
    const orderRes = await createInvoice({
      operationKey: "123e4567-e89b-12d3-a456-426614174000",
      customerId,
      items: [{ productId, quantity: 2, discount: 0 }], // 2 * 50000 = 100000
      invoiceDiscount: 0,
      tax: 0,
      taxType: "NONE",
      status: "ISSUED",
      salesChannel: "WALK_IN",
      paymentMethod: "CASH",
    });

    expect(orderRes.success).toBe(true);
    if (!orderRes.success) throw new Error("Failed to create invoice");
    const invoiceId = orderRes.invoiceId;

    // Check that invoice was created
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: { items: true }
    });
    expect(invoice).toBeDefined();
    expect(invoice?.grandTotal.toNumber()).toBe(100000);
    expect(invoice?.status).toBe("ISSUED");

    // 2. Payment
    const payRes = await recordPayment({ invoiceId, amount: 100000, method: "CASH", paidAt: "2026-07-31", reference: "LUNAS" });
    expect(payRes.success).toBe(true);

    // Verify invoice status updated
    const updatedInvoice = await prisma.invoice.findUnique({ where: { id: invoiceId } });
    expect(updatedInvoice?.status).toBe("PAID");
    expect(updatedInvoice?.paidAmount.toNumber()).toBe(100000);

    // 3. Inventory Deduction
    const ledgers = await prisma.inventoryLedger.findMany({
      where: {
        tenantId: "test-tenant-integration",
        productId: productId,
        refId: invoiceId,
        refType: "SALE_FG_OUT",
      }
    });

    expect(ledgers.length).toBe(1);
    expect(ledgers[0].entryType).toBe("OUT");
    expect(Number(ledgers[0].quantityUnit)).toBe(2);

    // Verify product stock was updated
    const updatedProduct = await prisma.product.findUnique({ where: { id: productId } });
    // Assuming initial was 100, and no ledger created it so base is 100
    // Wait, the action `appendFefoLedgerOut` / `appendLedger` actually decrements `stockUnit` using `decrement: 2`
    expect(Number(updatedProduct?.stockUnit)).toBe(98);
  });
});
