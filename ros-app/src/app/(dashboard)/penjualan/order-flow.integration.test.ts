import { describe, expect, it, vi, beforeAll, afterAll } from "vitest";
import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { resolveTestDatabaseUrl } from "../../../../test/setup/test-database-guard";
import {
  createCreditNote,
  createInvoice,
  getCashierPageData,
  getInvoiceForReturn,
  getSalesPageData,
  updateInvoiceShipping,
  voidInvoice,
} from "./actions";
import { recordPayment, voidPayment } from "../keuangan/actions";
import { expireUnpaidStorefrontOrders } from "@/lib/payment-submission-expiry";

// Gated integration test: only runs against an isolated test DB with RUN_INTEGRATION=true.
const integrationEnabled = process.env.RUN_INTEGRATION === "true";
const suite = integrationEnabled ? describe : describe.skip;
let prisma: PrismaClient;

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
    requireTenantPrisma: vi.fn(async () => prisma),
  };
});

suite("Penjualan End-to-End Integration", () => {
  let customerId = "";
  let productId = "";
  
  beforeAll(async () => {
    const pool = new Pool({ connectionString: resolveTestDatabaseUrl(), max: 3 });
    prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
    // Recover cleanly if a previous red-phase assertion stopped before afterAll.
    await prisma.journalLine.deleteMany({ where: { journalEntry: { tenantId: "test-tenant-integration" } } });
    await prisma.journalEntry.deleteMany({ where: { tenantId: "test-tenant-integration" } });
    await prisma.account.deleteMany({ where: { tenantId: "test-tenant-integration" } });
    await prisma.auditLog.deleteMany({ where: { tenantId: "test-tenant-integration" } });
    await prisma.inventoryLedger.deleteMany({ where: { tenantId: "test-tenant-integration" } });
    await prisma.stockReservation.deleteMany({ where: { tenantId: "test-tenant-integration" } });
    await prisma.fulfillmentTask.deleteMany({ where: { tenantId: "test-tenant-integration" } });
    await prisma.creditNoteItem.deleteMany({ where: { tenantId: "test-tenant-integration" } });
    await prisma.creditNote.deleteMany({ where: { tenantId: "test-tenant-integration" } });
    await prisma.invoiceItem.deleteMany({ where: { invoice: { tenantId: "test-tenant-integration" } } });
    await prisma.payment.deleteMany({ where: { tenantId: "test-tenant-integration" } });
    await prisma.invoice.deleteMany({ where: { tenantId: "test-tenant-integration" } });
    await prisma.product.deleteMany({ where: { tenantId: "test-tenant-integration" } });
    await prisma.customer.deleteMany({ where: { tenantId: "test-tenant-integration" } });
    await prisma.user.deleteMany({ where: { id: "test-user-integration" } });
    await prisma.tenant.deleteMany({ where: { id: "test-tenant-integration" } });
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
    await prisma.stockReservation.deleteMany({ where: { tenantId: "test-tenant-integration" } });
    await prisma.fulfillmentTask.deleteMany({ where: { tenantId: "test-tenant-integration" } });
    await prisma.creditNoteItem.deleteMany({ where: { tenantId: "test-tenant-integration" } });
    await prisma.creditNote.deleteMany({ where: { tenantId: "test-tenant-integration" } });
    await prisma.invoiceItem.deleteMany({ where: { invoice: { tenantId: "test-tenant-integration" } }});
    await prisma.payment.deleteMany({ where: { tenantId: "test-tenant-integration" }});
    await prisma.invoice.deleteMany({ where: { tenantId: "test-tenant-integration" }});
    await prisma.product.deleteMany({ where: { tenantId: "test-tenant-integration" }});
    await prisma.customer.deleteMany({ where: { tenantId: "test-tenant-integration" }});
    await prisma.user.deleteMany({ where: { id: "test-user-integration" }});
    await prisma.tenant.deleteMany({ where: { id: "test-tenant-integration" }});
    await prisma.$disconnect();
  });

  it("hands over a paid Cashier sale immediately when the channel is omitted", async () => {
    const cashierProduct = await prisma.product.create({
      data: {
        tenantId: "test-tenant-integration",
        code: "PROD-CASHIER-DEFAULT",
        name: "Cashier Default Channel Product",
        type: "FINISHED_GOODS",
        price: 25000,
        stockUnit: 3,
        isActive: true,
      },
    });

    const result = await createInvoice({
      operationKey: "123e4567-e89b-12d3-a456-426614174010",
      customerId,
      items: [{ productId: cashierProduct.id, quantity: 1, discount: 0 }],
      invoiceDiscount: 0,
      tax: 0,
      taxType: "NONE",
      status: "PAID",
      paymentMethod: "CASH",
    });

    expect(result.success).toBe(true);
    if (!result.success) throw new Error(result.error);

    const [invoice, product, saleEntries, activeReservations] = await Promise.all([
      prisma.invoice.findUnique({ where: { id: result.invoiceId } }),
      prisma.product.findUnique({ where: { id: cashierProduct.id } }),
      prisma.inventoryLedger.findMany({
        where: { refId: result.invoiceId, refType: "SALE_FG_OUT", entryType: "OUT" },
      }),
      prisma.stockReservation.count({
        where: { invoiceId: result.invoiceId, status: "ACTIVE" },
      }),
    ]);

    expect(invoice?.salesChannel).toBe("WALK_IN");
    expect(invoice?.fulfillmentStatus).toBe("DELIVERED");
    expect(Number(product?.stockUnit)).toBe(2);
    expect(saleEntries).toHaveLength(1);
    expect(Number(saleEntries[0].quantityUnit)).toBe(1);
    expect(activeReservations).toBe(0);
  });

  it("refuses a paid Cashier sale that would consume stock reserved for another order", async () => {
    const reservedProduct = await prisma.product.create({
      data: {
        tenantId: "test-tenant-integration",
        code: "PROD-CASHIER-RESERVED",
        name: "Cashier Reserved Product",
        type: "FINISHED_GOODS",
        price: 30000,
        stockUnit: 3,
        isActive: true,
      },
    });

    const reservedOrder = await createInvoice({
      operationKey: "123e4567-e89b-12d3-a456-426614174011",
      customerId,
      items: [{ productId: reservedProduct.id, quantity: 2, discount: 0 }],
      invoiceDiscount: 0,
      tax: 0,
      taxType: "NONE",
      status: "ISSUED",
      salesChannel: "WHATSAPP",
    });
    expect(reservedOrder.success).toBe(true);

    const cashierSale = await createInvoice({
      operationKey: "123e4567-e89b-12d3-a456-426614174012",
      customerId,
      items: [{ productId: reservedProduct.id, quantity: 2, discount: 0 }],
      invoiceDiscount: 0,
      tax: 0,
      taxType: "NONE",
      status: "PAID",
      paymentMethod: "CASH",
    });

    const [product, activeReservation, failedInvoice] = await Promise.all([
      prisma.product.findUnique({ where: { id: reservedProduct.id } }),
      prisma.stockReservation.findFirst({
        where: { productId: reservedProduct.id, status: "ACTIVE" },
      }),
      prisma.invoice.findUnique({
        where: {
          tenantId_operationKey: {
            tenantId: "test-tenant-integration",
            operationKey: "123e4567-e89b-12d3-a456-426614174012",
          },
        },
      }),
    ]);
    if (reservedOrder.success) {
      await voidInvoice(reservedOrder.invoiceId, "Cleanup test reservasi kasir");
    }

    expect(cashierSale).toEqual({
      success: false,
      error: "Stok tersedia untuk kasir tidak cukup. 2 unit sedang dicadangkan untuk pesanan lain.",
    });
    expect(Number(product?.stockUnit)).toBe(3);
    expect(activeReservation?.quantity).toBe(2);
    expect(failedInvoice).toBeNull();
  });

  it("shows Cashier stock as physical units minus active order reservations", async () => {
    const projectedProduct = await prisma.product.create({
      data: {
        tenantId: "test-tenant-integration",
        code: "PROD-CASHIER-ATP",
        name: "Cashier Available To Promise Product",
        type: "FINISHED_GOODS",
        price: 35000,
        stockUnit: 5,
        isActive: true,
      },
    });
    const reservedOrder = await createInvoice({
      operationKey: "123e4567-e89b-12d3-a456-426614174013",
      customerId,
      items: [{ productId: projectedProduct.id, quantity: 3, discount: 0 }],
      invoiceDiscount: 0,
      tax: 0,
      taxType: "NONE",
      status: "ISSUED",
      salesChannel: "WHATSAPP",
    });
    expect(reservedOrder.success).toBe(true);
    if (!reservedOrder.success) throw new Error(reservedOrder.error);

    const cashierData = await getCashierPageData();
    const availableProduct = cashierData.fgOptions.find((product) => product.id === projectedProduct.id);
    await voidInvoice(reservedOrder.invoiceId, "Cleanup test proyeksi stok kasir");

    expect(availableProduct?.stockUnit).toBe(2);
  });

  it("holds paid orders as customer advances until physical handover", async () => {
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

    // 3. Payment does not issue inventory before handover.
    const ledgers = await prisma.inventoryLedger.findMany({
      where: {
        tenantId: "test-tenant-integration",
        productId: productId,
        refId: invoiceId,
        refType: "SALE_FG_OUT",
      }
    });

    expect(ledgers).toHaveLength(0);
    const heldProduct = await prisma.product.findUnique({ where: { id: productId } });
    expect(Number(heldProduct?.stockUnit)).toBe(100);

    // 4. Handover atomically consumes the reservation, issues stock, and recognizes sales.
    const handover = await updateInvoiceShipping(invoiceId, { fulfillmentStatus: "DELIVERED" });
    expect(handover.success).toBe(true);
    const deliveredLedgers = await prisma.inventoryLedger.findMany({
      where: {
        tenantId: "test-tenant-integration", productId, refId: invoiceId, refType: "SALE_FG_OUT",
      },
    });
    expect(deliveredLedgers).toHaveLength(1);
    expect(deliveredLedgers[0].entryType).toBe("OUT");
    expect(Number(deliveredLedgers[0].quantityUnit)).toBe(2);

    const journals = await prisma.journalEntry.findMany({
      where: { tenantId: "test-tenant-integration", reference: invoiceId },
      include: { lines: { include: { account: { select: { code: true } } } } },
    });
    expect(journals).toHaveLength(1);
    expect(journals[0].lines.some((line) => line.account.code === "2-1300" && Number(line.debit) === 100000)).toBe(true);

    // Verify product stock was updated only at handover.
    const updatedProduct = await prisma.product.findUnique({ where: { id: productId } });
    expect(Number(updatedProduct?.stockUnit)).toBe(98);
  });

  it("voids an order before handover by releasing its reservation without moving stock", async () => {
    const orderRes = await createInvoice({
      operationKey: "123e4567-e89b-12d3-a456-426614174001",
      customerId,
      items: [{ productId, quantity: 1, discount: 0 }],
      invoiceDiscount: 0,
      tax: 0,
      taxType: "NONE",
      status: "ISSUED",
      salesChannel: "WHATSAPP",
    });
    expect(orderRes.success).toBe(true);
    if (!orderRes.success) throw new Error("Failed to create invoice");

    const cancelled = await voidInvoice(orderRes.invoiceId, "Pesanan dibatalkan pelanggan");
    expect(cancelled.success).toBe(true);

    const invoice = await prisma.invoice.findUnique({ where: { id: orderRes.invoiceId } });
    expect(invoice?.status).toBe("VOID");
    expect(invoice?.fulfillmentStatus).toBe("CANCELLED");
    const reservation = await prisma.stockReservation.findFirst({ where: { invoiceId: orderRes.invoiceId } });
    expect(reservation?.status).toBe("RELEASED");
    const salesLedger = await prisma.inventoryLedger.count({
      where: { tenantId: "test-tenant-integration", refId: orderRes.invoiceId, refType: "SALE_FG_OUT" },
    });
    expect(salesLedger).toBe(0);
  });

  it("allows an approved B2B credit order to be fulfilled before payment", async () => {
    const creditProduct = await prisma.product.create({
      data: {
        tenantId: "test-tenant-integration",
        code: "PROD-B2B-CREDIT",
        name: "B2B Credit Product",
        type: "FINISHED_GOODS",
        price: 45000,
        stockUnit: 2,
        isActive: true,
      },
    });
    const orderRes = await createInvoice({
      operationKey: "123e4567-e89b-12d3-a456-426614174015",
      customerId,
      items: [{ productId: creditProduct.id, quantity: 1, discount: 0 }],
      invoiceDiscount: 0,
      tax: 0,
      taxType: "NONE",
      status: "ISSUED",
      salesChannel: "B2B_DIRECT",
      paymentMethod: "CREDIT",
      dueDate: "2030-01-31",
    });
    expect(orderRes.success).toBe(true);
    if (!orderRes.success) throw new Error(orderRes.error);

    const readyInvoice = await prisma.invoice.findUnique({ where: { id: orderRes.invoiceId } });
    expect(readyInvoice?.status).toBe("ISSUED");
    expect(readyInvoice?.fulfillmentStatus).toBe("READY_TO_PACK");
    const salesData = await getSalesPageData();
    const salesRow = salesData.invoices.find((invoice) => invoice.id === orderRes.invoiceId);
    expect(salesRow?.salesChannel).toBe("B2B_DIRECT");
    expect(salesRow?.fulfillmentStatus).toBe("READY_TO_PACK");

    const handover = await updateInvoiceShipping(orderRes.invoiceId, { fulfillmentStatus: "DELIVERED" });
    expect(handover.success).toBe(true);

    const [deliveredInvoice, product, saleEntries] = await Promise.all([
      prisma.invoice.findUnique({ where: { id: orderRes.invoiceId } }),
      prisma.product.findUnique({ where: { id: creditProduct.id } }),
      prisma.inventoryLedger.findMany({
        where: { refId: orderRes.invoiceId, refType: "SALE_FG_OUT", entryType: "OUT" },
      }),
    ]);
    expect(deliveredInvoice?.status).toBe("ISSUED");
    expect(deliveredInvoice?.fulfillmentStatus).toBe("DELIVERED");
    expect(Number(product?.stockUnit)).toBe(1);
    expect(saleEntries).toHaveLength(1);
  });

  it("refuses to move fulfillment backward after an order is packed", async () => {
    const transitionProduct = await prisma.product.create({
      data: {
        tenantId: "test-tenant-integration",
        code: "PROD-FULFILLMENT-TRANSITION",
        name: "Fulfillment Transition Product",
        type: "FINISHED_GOODS",
        price: 50000,
        stockUnit: 2,
        isActive: true,
      },
    });
    const orderRes = await createInvoice({
      operationKey: "123e4567-e89b-12d3-a456-426614174016",
      customerId,
      items: [{ productId: transitionProduct.id, quantity: 1, discount: 0 }],
      invoiceDiscount: 0,
      tax: 0,
      taxType: "NONE",
      status: "PAID",
      paymentMethod: "TRANSFER",
      salesChannel: "WHATSAPP",
    });
    expect(orderRes.success).toBe(true);
    if (!orderRes.success) throw new Error(orderRes.error);

    const packed = await updateInvoiceShipping(orderRes.invoiceId, { fulfillmentStatus: "PACKED" });
    expect(packed.success).toBe(true);
    const regressed = await updateInvoiceShipping(orderRes.invoiceId, { fulfillmentStatus: "READY_TO_PACK" });
    const invoice = await prisma.invoice.findUnique({ where: { id: orderRes.invoiceId } });

    expect(regressed).toEqual({
      success: false,
      error: "Gagal update data pengiriman: Status fulfillment tidak dapat diubah dari PACKED ke READY_TO_PACK.",
    });
    expect(invoice?.fulfillmentStatus).toBe("PACKED");
  });

  it("rejects a return before the order has been physically delivered", async () => {
    const returnProduct = await prisma.product.create({
      data: {
        tenantId: "test-tenant-integration",
        code: "PROD-RETURN-NOT-DELIVERED",
        name: "Return Not Delivered Product",
        type: "FINISHED_GOODS",
        price: 60000,
        stockUnit: 2,
        lastHpp: 20000,
        isActive: true,
      },
    });
    const orderRes = await createInvoice({
      operationKey: "123e4567-e89b-12d3-a456-426614174017",
      customerId,
      items: [{ productId: returnProduct.id, quantity: 1, discount: 0 }],
      invoiceDiscount: 0,
      tax: 0,
      taxType: "NONE",
      status: "PAID",
      paymentMethod: "TRANSFER",
      salesChannel: "WHATSAPP",
    });
    expect(orderRes.success).toBe(true);
    if (!orderRes.success) throw new Error(orderRes.error);

    const returned = await createCreditNote({
      invoiceId: orderRes.invoiceId,
      reason: "Barang belum pernah diserahkan",
      items: [{ productId: returnProduct.id, quantity: 1, unitDiscount: 0 }],
    });
    const [product, creditNotes, reservation, returnProjection] = await Promise.all([
      prisma.product.findUnique({ where: { id: returnProduct.id } }),
      prisma.creditNote.count({ where: { invoiceId: orderRes.invoiceId } }),
      prisma.stockReservation.findFirst({ where: { invoiceId: orderRes.invoiceId } }),
      getInvoiceForReturn(orderRes.invoiceId),
    ]);

    expect(returned).toEqual({
      success: false,
      error: "Retur hanya dapat dibuat setelah pesanan diserahkan.",
    });
    expect(Number(product?.stockUnit)).toBe(2);
    expect(creditNotes).toBe(0);
    expect(reservation?.status).toBe("ACTIVE");
    expect(returnProjection).toBeNull();
  });

  it("rejects a delivered return request without any items", async () => {
    const returnProduct = await prisma.product.create({
      data: {
        tenantId: "test-tenant-integration",
        code: "PROD-RETURN-EMPTY",
        name: "Return Empty Product",
        type: "FINISHED_GOODS",
        price: 65000,
        stockUnit: 2,
        lastHpp: 25000,
        isActive: true,
      },
    });
    const orderRes = await createInvoice({
      operationKey: "123e4567-e89b-12d3-a456-426614174018",
      customerId,
      items: [{ productId: returnProduct.id, quantity: 1, discount: 0 }],
      invoiceDiscount: 0,
      tax: 0,
      taxType: "NONE",
      status: "PAID",
      paymentMethod: "CASH",
    });
    expect(orderRes.success).toBe(true);
    if (!orderRes.success) throw new Error(orderRes.error);

    const invalidReason = await createCreditNote({
      invoiceId: orderRes.invoiceId,
      reason: "  x  ",
      items: [{ productId: returnProduct.id, quantity: 1 }],
    });
    const returned = await createCreditNote({
      invoiceId: orderRes.invoiceId,
      reason: "Tidak ada item",
      items: [],
    });
    const [product, creditNotes] = await Promise.all([
      prisma.product.findUnique({ where: { id: returnProduct.id } }),
      prisma.creditNote.count({ where: { invoiceId: orderRes.invoiceId } }),
    ]);

    expect(returned).toEqual({
      success: false,
      error: "Pilih minimal satu item untuk diretur.",
    });
    expect(invalidReason).toEqual({
      success: false,
      error: "Alasan retur harus terdiri dari 3-500 karakter.",
    });
    expect(Number(product?.stockUnit)).toBe(1);
    expect(creditNotes).toBe(0);
  });

  it("rejects zero and negative return quantities before creating a credit note", async () => {
    const returnProduct = await prisma.product.create({
      data: {
        tenantId: "test-tenant-integration",
        code: "PROD-RETURN-NONPOSITIVE",
        name: "Return Nonpositive Product",
        type: "FINISHED_GOODS",
        price: 70000,
        stockUnit: 2,
        lastHpp: 30000,
        isActive: true,
      },
    });
    const orderRes = await createInvoice({
      operationKey: "123e4567-e89b-12d3-a456-426614174019",
      customerId,
      items: [{ productId: returnProduct.id, quantity: 1, discount: 0 }],
      invoiceDiscount: 0,
      tax: 0,
      taxType: "NONE",
      status: "PAID",
      paymentMethod: "CASH",
    });
    expect(orderRes.success).toBe(true);
    if (!orderRes.success) throw new Error(orderRes.error);

    const zero = await createCreditNote({
      invoiceId: orderRes.invoiceId,
      reason: "Jumlah nol",
      items: [{ productId: returnProduct.id, quantity: 0, unitDiscount: 0 }],
    });
    const negative = await createCreditNote({
      invoiceId: orderRes.invoiceId,
      reason: "Jumlah negatif",
      items: [{ productId: returnProduct.id, quantity: -1, unitDiscount: 0 }],
    });
    const creditNotes = await prisma.creditNote.count({ where: { invoiceId: orderRes.invoiceId } });

    expect(zero).toEqual({
      success: false,
      error: "Jumlah retur harus bilangan bulat lebih dari nol.",
    });
    expect(negative).toEqual({
      success: false,
      error: "Jumlah retur harus bilangan bulat lebih dari nol.",
    });
    expect(creditNotes).toBe(0);
  });

  it("rejects duplicate product lines that would over-return one sold unit", async () => {
    const returnProduct = await prisma.product.create({
      data: {
        tenantId: "test-tenant-integration",
        code: "PROD-RETURN-DUPLICATE",
        name: "Return Duplicate Product",
        type: "FINISHED_GOODS",
        price: 75000,
        stockUnit: 2,
        lastHpp: 32000,
        isActive: true,
      },
    });
    const orderRes = await createInvoice({
      operationKey: "123e4567-e89b-12d3-a456-426614174020",
      customerId,
      items: [{ productId: returnProduct.id, quantity: 1, discount: 0 }],
      invoiceDiscount: 0,
      tax: 0,
      taxType: "NONE",
      status: "PAID",
      paymentMethod: "CASH",
    });
    expect(orderRes.success).toBe(true);
    if (!orderRes.success) throw new Error(orderRes.error);

    const returned = await createCreditNote({
      invoiceId: orderRes.invoiceId,
      reason: "SKU duplikat",
      items: [
        { productId: returnProduct.id, quantity: 1, unitDiscount: 0 },
        { productId: returnProduct.id, quantity: 1, unitDiscount: 0 },
      ],
    });
    const [product, creditNotes] = await Promise.all([
      prisma.product.findUnique({ where: { id: returnProduct.id } }),
      prisma.creditNote.count({ where: { invoiceId: orderRes.invoiceId } }),
    ]);

    expect(returned).toEqual({
      success: false,
      error: "Produk retur tidak boleh duplikat.",
    });
    expect(Number(product?.stockUnit)).toBe(1);
    expect(creditNotes).toBe(0);
  });

  it("allows only one of two concurrent returns for the same sold unit", async () => {
    const returnProduct = await prisma.product.create({
      data: {
        tenantId: "test-tenant-integration",
        code: "PROD-RETURN-CONCURRENT",
        name: "Return Concurrent Product",
        type: "FINISHED_GOODS",
        price: 80000,
        stockUnit: 1,
        lastHpp: 40000,
        isActive: true,
      },
    });
    const orderRes = await createInvoice({
      operationKey: "123e4567-e89b-12d3-a456-426614174021",
      customerId,
      items: [{ productId: returnProduct.id, quantity: 1, discount: 0 }],
      invoiceDiscount: 0,
      tax: 0,
      taxType: "NONE",
      status: "PAID",
      paymentMethod: "CASH",
    });
    expect(orderRes.success).toBe(true);
    if (!orderRes.success) throw new Error(orderRes.error);

    const input = {
      invoiceId: orderRes.invoiceId,
      reason: "Retur paralel",
      items: [{ productId: returnProduct.id, quantity: 1, unitDiscount: 0 }],
    };
    const results = await Promise.all([
      createCreditNote(input),
      createCreditNote(input),
    ]);
    const [product, creditNotes] = await Promise.all([
      prisma.product.findUnique({ where: { id: returnProduct.id } }),
      prisma.creditNote.count({ where: { invoiceId: orderRes.invoiceId } }),
    ]);

    expect(results.filter((result) => result.success)).toHaveLength(1);
    expect(results.filter((result) => !result.success)).toHaveLength(1);
    expect(results.find((result) => !result.success)).toEqual({
      success: false,
      error: "Jumlah retur melebihi sisa yang dapat diretur.",
    });
    expect(Number(product?.stockUnit)).toBe(1);
    expect(creditNotes).toBe(1);
  });

  it("restores a finished-good return with its immutable invoice HPP", async () => {
    const returnProduct = await prisma.product.create({
      data: {
        tenantId: "test-tenant-integration",
        code: "PROD-RETURN-COST-UNIT",
        name: "Return Cost Unit Product",
        type: "FINISHED_GOODS",
        price: 80000,
        stockUnit: 1,
        lastHpp: 40000,
        isActive: true,
      },
    });
    const orderRes = await createInvoice({
      operationKey: "123e4567-e89b-12d3-a456-426614174022",
      customerId,
      items: [{ productId: returnProduct.id, quantity: 1, discount: 0 }],
      invoiceDiscount: 0,
      tax: 0,
      taxType: "NONE",
      status: "PAID",
      paymentMethod: "CASH",
    });
    expect(orderRes.success).toBe(true);
    if (!orderRes.success) throw new Error(orderRes.error);

    const returned = await createCreditNote({
      invoiceId: orderRes.invoiceId,
      reason: "Barang dikembalikan dalam kondisi baik",
      items: [{ productId: returnProduct.id, quantity: 1, unitDiscount: 99999 }],
    });
    const [product, returnLedger] = await Promise.all([
      prisma.product.findUnique({ where: { id: returnProduct.id } }),
      prisma.inventoryLedger.findFirst({
        where: {
          productId: returnProduct.id,
          refType: "RETURN_FG_IN",
          entryType: "IN",
        },
        orderBy: { createdAt: "desc" },
      }),
    ]);

    expect(returned.success).toBe(true);
    expect(Number(returnLedger?.quantityUnit)).toBe(1);
    expect(Number(returnLedger?.quantityKg ?? 0)).toBe(0);
    expect(Number(returnLedger?.incomingPrice)).toBe(40000);
    expect(Number(product?.stockUnit)).toBe(1);
    expect(Number(product?.lastHpp)).toBe(40000);

    const paymentAfterReturn = await recordPayment({
      invoiceId: orderRes.invoiceId,
      amount: 1,
      method: "CASH",
      paidAt: "2026-08-14",
    });
    expect(paymentAfterReturn).toEqual({
      success: false,
      error: "Nota yang sudah diretur penuh tidak dapat menerima pembayaran.",
    });
  });

  it("restores a roasted-bean package in kg with per-kg cost and RB accounting", async () => {
    const returnProduct = await prisma.product.create({
      data: {
        tenantId: "test-tenant-integration",
        code: "PROD-RETURN-COST-KG",
        name: "Return Cost Kg Product",
        type: "ROASTED_BEAN",
        price: 65000,
        stockKg: 0.75,
        stockUnit: 0,
        avgCostPerKg: 120000,
        isActive: true,
      },
    });
    const invoice = await prisma.invoice.create({
      data: {
        tenantId: "test-tenant-integration",
        code: "INV-RETURN-COST-KG",
        customerId,
        subtotal: 65000,
        grandTotal: 65000,
        paidAmount: 65000,
        status: "PAID",
        salesChannel: "WALK_IN",
        fulfillmentStatus: "DELIVERED",
        deliveredAt: new Date(),
        createdById: "test-user-integration",
        items: {
          create: {
            tenantId: "test-tenant-integration",
            productId: returnProduct.id,
            quantity: 1,
            unitPrice: 65000,
            discount: 0,
            subtotal: 65000,
            hpp: 30000,
            packageName: "Pouch 250 g",
            netWeightGrams: 250,
          },
        },
      },
    });

    const returned = await createCreditNote({
      invoiceId: invoice.id,
      reason: "Kemasan kopi dikembalikan",
      items: [{ productId: returnProduct.id, quantity: 1, unitDiscount: 0 }],
    });
    const [product, returnLedger, journal] = await Promise.all([
      prisma.product.findUnique({ where: { id: returnProduct.id } }),
      prisma.inventoryLedger.findFirst({
        where: { productId: returnProduct.id, refType: "RETURN_FG_IN", entryType: "IN" },
        orderBy: { createdAt: "desc" },
      }),
      prisma.journalEntry.findFirst({
        where: { tenantId: "test-tenant-integration", refType: "CREDIT_NOTE" },
        orderBy: { createdAt: "desc" },
        include: { lines: { include: { account: { select: { code: true } } } } },
      }),
    ]);

    expect(returned.success).toBe(true);
    expect(Number(returnLedger?.quantityUnit ?? 0)).toBe(0);
    expect(Number(returnLedger?.quantityKg)).toBe(0.25);
    expect(Number(returnLedger?.incomingPrice)).toBe(120000);
    expect(Number(product?.stockKg)).toBe(1);
    expect(Number(product?.stockUnit)).toBe(0);
    expect(Number(product?.avgCostPerKg)).toBe(120000);
    expect(journal?.lines).toEqual(expect.arrayContaining([
      expect.objectContaining({
        debit: expect.objectContaining({ toNumber: expect.any(Function) }),
        account: { code: "1-1210" },
      }),
    ]));
    const rbInventoryLine = journal?.lines.find((line) => line.account.code === "1-1210");
    expect(Number(rbInventoryLine?.debit)).toBe(30000);
    expect(journal?.lines.some((line) => line.account.code === "1-1220")).toBe(false);
  });

  it("serializes concurrent payments so they cannot overpay one invoice", async () => {
    const orderRes = await createInvoice({
      operationKey: "123e4567-e89b-12d3-a456-426614174023",
      customerId,
      items: [{ productId, quantity: 2, discount: 0 }],
      invoiceDiscount: 0,
      tax: 0,
      taxType: "NONE",
      status: "ISSUED",
      salesChannel: "B2B_DIRECT",
      paymentMethod: "CREDIT",
      dueDate: "2030-01-31",
    });
    expect(orderRes.success).toBe(true);
    if (!orderRes.success) throw new Error(orderRes.error);

    const results = await Promise.all([
      recordPayment({
        operationKey: "123e4567-e89b-12d3-a456-426614174024",
        invoiceId: orderRes.invoiceId,
        amount: 60000,
        method: "TRANSFER",
        paidAt: "2026-08-14",
      }),
      recordPayment({
        operationKey: "123e4567-e89b-12d3-a456-426614174025",
        invoiceId: orderRes.invoiceId,
        amount: 60000,
        method: "TRANSFER",
        paidAt: "2026-08-14",
      }),
    ]);
    const [invoice, payments] = await Promise.all([
      prisma.invoice.findUnique({ where: { id: orderRes.invoiceId } }),
      prisma.payment.findMany({ where: { invoiceId: orderRes.invoiceId, voidAt: null } }),
    ]);

    expect(results.filter((result) => result.success)).toHaveLength(1);
    expect(results.find((result) => !result.success)).toEqual({
      success: false,
      error: "Nominal melebihi sisa tagihan. Sisa: Rp 40.000",
    });
    expect(Number(invoice?.paidAmount)).toBe(60000);
    expect(invoice?.status).toBe("PARTIAL");
    expect(payments).toHaveLength(1);
  });

  it("returns an unpaid pre-handover order to awaiting payment when its payment is voided", async () => {
    const orderRes = await createInvoice({
      operationKey: "123e4567-e89b-12d3-a456-426614174026",
      customerId,
      items: [{ productId, quantity: 1, discount: 0 }],
      invoiceDiscount: 0,
      tax: 0,
      taxType: "NONE",
      status: "ISSUED",
      salesChannel: "WHATSAPP",
    });
    expect(orderRes.success).toBe(true);
    if (!orderRes.success) throw new Error(orderRes.error);

    const paymentResult = await recordPayment({
      operationKey: "123e4567-e89b-12d3-a456-426614174027",
      invoiceId: orderRes.invoiceId,
      amount: 50000,
      method: "TRANSFER",
      paidAt: "2026-08-14",
    });
    expect(paymentResult.success).toBe(true);
    const payment = await prisma.payment.findFirstOrThrow({
      where: { operationKey: "123e4567-e89b-12d3-a456-426614174027" },
    });
    const voided = await voidPayment(payment.id, "Pembayaran salah rekening");
    const invoice = await prisma.invoice.findUnique({ where: { id: orderRes.invoiceId } });

    expect(voided).toEqual({ success: true });
    expect(Number(invoice?.paidAmount)).toBe(0);
    expect(invoice?.status).toBe("ISSUED");
    expect(invoice?.fulfillmentStatus).toBe("AWAITING_PAYMENT");
  });

  it("replays one committed payment for concurrent requests with the same operation key", async () => {
    const orderRes = await createInvoice({
      operationKey: "123e4567-e89b-12d3-a456-426614174028",
      customerId,
      items: [{ productId, quantity: 1, discount: 0 }],
      invoiceDiscount: 0,
      tax: 0,
      taxType: "NONE",
      status: "ISSUED",
      salesChannel: "WHATSAPP",
    });
    expect(orderRes.success).toBe(true);
    if (!orderRes.success) throw new Error(orderRes.error);

    const input = {
      operationKey: "123e4567-e89b-12d3-a456-426614174029",
      invoiceId: orderRes.invoiceId,
      amount: 50000,
      method: "TRANSFER" as const,
      paidAt: "2026-08-14",
    };
    const results = await Promise.all([recordPayment(input), recordPayment(input)]);
    const payments = await prisma.payment.findMany({
      where: { invoiceId: orderRes.invoiceId, voidAt: null },
    });

    expect(results.every((result) => result.success)).toBe(true);
    expect(results).toEqual([
      expect.objectContaining({ success: true, newStatus: "PAID" }),
      expect.objectContaining({ success: true, newStatus: "PAID" }),
    ]);
    expect(new Set(results.map((result) => result.success ? result.paymentCode : null)).size).toBe(1);
    expect(payments).toHaveLength(1);
  });

  it("does not auto-void an overdue manual B2B credit reservation", async () => {
    const orderRes = await createInvoice({
      operationKey: "123e4567-e89b-12d3-a456-426614174014",
      customerId,
      items: [{ productId, quantity: 1, discount: 0 }],
      invoiceDiscount: 0,
      tax: 0,
      taxType: "NONE",
      status: "ISSUED",
      salesChannel: "B2B_DIRECT",
      paymentMethod: "CREDIT",
      dueDate: "2030-01-31",
    });
    expect(orderRes.success).toBe(true);
    if (!orderRes.success) throw new Error(orderRes.error);

    const expiry = await expireUnpaidStorefrontOrders(prisma, new Date("2030-01-01T00:00:00.000Z"));
    const [invoice, reservation] = await Promise.all([
      prisma.invoice.findUnique({ where: { id: orderRes.invoiceId } }),
      prisma.stockReservation.findFirst({ where: { invoiceId: orderRes.invoiceId } }),
    ]);
    if (invoice?.status !== "VOID") {
      await voidInvoice(orderRes.invoiceId, "Cleanup test B2B manual");
    }

    expect(expiry.voidedInvoices).toBe(0);
    expect(invoice?.status).toBe("ISSUED");
    expect(reservation?.status).toBe("ACTIVE");
  });

  it("expires an unpaid storefront reservation without requiring a sales journal", async () => {
    const orderRes = await createInvoice({
      operationKey: "123e4567-e89b-12d3-a456-426614174002",
      customerId,
      items: [{ productId, quantity: 1, discount: 0 }],
      invoiceDiscount: 0,
      tax: 0,
      taxType: "NONE",
      status: "ISSUED",
      salesChannel: "WHATSAPP",
    });
    expect(orderRes.success).toBe(true);
    if (!orderRes.success) throw new Error("Failed to create invoice");
    await prisma.invoice.update({
      where: { id: orderRes.invoiceId },
      data: { publicOrderToken: "order-flow-expiry-public-token" },
    });

    const result = await expireUnpaidStorefrontOrders(prisma, new Date("2030-01-01T00:00:00.000Z"));
    expect(result.voidedInvoices).toBe(1);
    const invoice = await prisma.invoice.findUnique({ where: { id: orderRes.invoiceId } });
    expect(invoice?.status).toBe("VOID");
  });
});
