import { describe, expect, it, vi, beforeAll, afterAll, beforeEach } from "vitest";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { resolveTestDatabaseUrl } from "../../test/setup/test-database-guard";
import { createSupplyPurchase } from "@/lib/supply-purchase";
import {
  voidPurchase,
  voidSupplierPayment,
  recordSupplierPayment,
  recordPayment,
  createExpense,
  voidExpense,
  recordOwnerWithdrawal,
  recordCapitalInjection,
  getCapitalSummary,
} from "@/app/(dashboard)/keuangan/actions";
import {
  createInvoice,
  createCreditNote,
  updateInvoiceShipping,
  voidInvoice,
} from "@/app/(dashboard)/penjualan/actions";

const TENANT = "test-tenant-2f1b";
const USER = "test-user-2f1b";

// gated integration test: only runs against isolated test DB with RUN_INTEGRATION=true
const integrationEnabled = process.env.RUN_INTEGRATION === "true";
const suite = integrationEnabled ? describe : describe.skip;
let prisma: PrismaClient;

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

// vi.mock factories are hoisted above top-level consts, so TENANT/USER cannot
// be referenced here — use literal values (kept in sync with the consts below).
vi.mock("@/lib/auth", async (importOriginal) => {
  const actual = await importOriginal<any>();
  return {
    ...actual,
    getCurrentTenantId: vi.fn().mockResolvedValue("test-tenant-2f1b"),
    getSystemUserId: vi.fn().mockResolvedValue("test-user-2f1b"),
    requireRole: vi.fn(),
    requireFeature: vi.fn(),
    requireTenantPrisma: vi.fn(async () => prisma),
  };
});

const round = (n: number) => Math.round(n * 100) / 100;

async function accountBalance(code: string): Promise<number> {
  const lines = await prisma.journalLine.findMany({
    where: { account: { tenantId: TENANT, code }, journalEntry: { voidAt: null } },
    select: { debit: true, credit: true },
  });
  return round(lines.reduce((s, l) => s + Number(l.debit) - Number(l.credit), 0));
}

async function journalCount(refType: string, reference: string): Promise<number> {
  return prisma.journalEntry.count({ where: { tenantId: TENANT, refType: refType as any, reference, voidAt: null } });
}

async function cleanup() {
  await prisma.journalLine.deleteMany({ where: { journalEntry: { tenantId: TENANT } } });
  await prisma.journalEntry.deleteMany({ where: { tenantId: TENANT } });
  await prisma.account.deleteMany({ where: { tenantId: TENANT } });
  await prisma.auditLog.deleteMany({ where: { tenantId: TENANT } });
  await prisma.inventoryLedger.deleteMany({ where: { tenantId: TENANT } });
  await prisma.lotPlacement.deleteMany({ where: { tenantId: TENANT } });
  await prisma.lot.deleteMany({ where: { tenantId: TENANT } });
  await prisma.stockReservation.deleteMany({ where: { tenantId: TENANT } });
  await prisma.fulfillmentTask.deleteMany({ where: { tenantId: TENANT } });
  await prisma.creditNoteItem.deleteMany({ where: { tenantId: TENANT } });
  await prisma.creditNote.deleteMany({ where: { tenantId: TENANT } });
  await prisma.invoiceItem.deleteMany({ where: { invoice: { tenantId: TENANT } } });
  await prisma.payment.deleteMany({ where: { tenantId: TENANT } });
  await prisma.invoice.deleteMany({ where: { tenantId: TENANT } });
  await prisma.supplierPayment.deleteMany({ where: { tenantId: TENANT } });
  await prisma.expense.deleteMany({ where: { tenantId: TENANT } });
  await prisma.purchase.deleteMany({ where: { tenantId: TENANT } });
  await prisma.inventorySupplyItem.deleteMany({ where: { tenantId: TENANT } });
  await prisma.supplier.deleteMany({ where: { tenantId: TENANT } });
  await prisma.product.deleteMany({ where: { tenantId: TENANT } });
  await prisma.capitalTransaction.deleteMany({ where: { tenantId: TENANT } });
  await prisma.customer.deleteMany({ where: { tenantId: TENANT } });
  await prisma.user.deleteMany({ where: { id: USER } });
  await prisma.tenant.deleteMany({ where: { id: TENANT } });
}

suite("Phase 2F.1B — Finance Idempotency & Concurrency", () => {
  let customerId = "";
  let supplierId = "";
  let supplyItemId = "";
  let fgProduct = "";
  let fgProduct2 = "";

  beforeAll(async () => {
    const pool = new Pool({ connectionString: resolveTestDatabaseUrl(), max: 3 });
    prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
    await prisma.$connect();
  });

  beforeEach(async () => {
    await cleanup();

    await prisma.tenant.upsert({
      where: { id: TENANT },
      create: { id: TENANT, code: "T2F1B", name: "2F1B Tenant", subdomain: "t2f1b" },
      update: {},
    });
    await prisma.user.upsert({
      where: { id: USER },
      create: { id: USER, email: "t2f1b@example.com", name: "2F1B User", tenantId: TENANT, role: "OWNER" },
      update: {},
    });
    const customer = await prisma.customer.create({ data: { tenantId: TENANT, code: "CUST-2F1B", name: "Buyer" } });
    customerId = customer.id;

    const fg = await prisma.product.create({
      data: { tenantId: TENANT, code: "PROD-FGB", name: "FG", type: "FINISHED_GOODS", price: 700_000, stockUnit: 100, lastHpp: 30000, isActive: true },
    });
    fgProduct = fg.id;
    const fg2 = await prisma.product.create({
      data: { tenantId: TENANT, code: "PROD-FGB2", name: "FG2", type: "FINISHED_GOODS", price: 300_000, stockUnit: 100, lastHpp: 10000, isActive: true },
    });
    fgProduct2 = fg2.id;

    const supplier = await prisma.supplier.create({ data: { tenantId: TENANT, code: "SUP-2F1B", name: "Supplier" } });
    supplierId = supplier.id;
    const supplyItem = await prisma.inventorySupplyItem.create({
      data: { tenantId: TENANT, code: "SI-2F1B", name: "Beans", category: "PACKAGING", baseUnit: "KG", costPerUnit: 1000, isActive: true },
    });
    supplyItemId = supplyItem.id;
  });

  afterAll(async () => {
    await cleanup();
    await prisma.$disconnect();
  });

  // ------------------------------------------------- SupplierPayment
  describe("SupplierPayment idempotency & concurrency", () => {
    async function createPurchase(paidAmount: number): Promise<string> {
      const res = await createSupplyPurchase(prisma, TENANT, USER, {
        operationKey: randomUUID(),
        supplierId,
        supplyItemId,
        supplyQuantity: 100,
        totalCost: 10_000_000,
        shippingCost: 0,
        paidAmount,
        paymentMethod: "CASH",
        receivedAt: "2026-08-14",
      });
      expect(res.success).toBe(true);
      const p = await prisma.purchase.findFirst({ where: { tenantId: TENANT }, orderBy: { createdAt: "desc" } });
      return p!.id;
    }

    it("1. same operationKey submitted twice → single payment & journal", async () => {
      const id = await createPurchase(0);
      const key = randomUUID();
      const first = await recordSupplierPayment({ purchaseId: id, amount: 2_000_000, method: "CASH", paidAt: "2026-08-15", operationKey: key });
      expect(first.success).toBe(true);
      const second = await recordSupplierPayment({ purchaseId: id, amount: 2_000_000, method: "CASH", paidAt: "2026-08-15", operationKey: key });
      expect(second.success).toBe(true);

      const payments = await prisma.supplierPayment.findMany({ where: { tenantId: TENANT, voidAt: null } });
      expect(payments).toHaveLength(1);
      expect(await journalCount("SUPPLIER_PAYMENT", payments[0].id)).toBe(1);
      const purchase = await prisma.purchase.findUnique({ where: { id } });
      expect(Number(purchase!.paidAmount)).toBe(2_000_000);
      expect(round(await accountBalance("1-1000"))).toBe(-2_000_000);
      expect(round(await accountBalance("2-1000"))).toBe(-8_000_000);
    });

    it("2. concurrent same-key submission → single payment", async () => {
      const id = await createPurchase(0);
      const key = randomUUID();
      const results = await Promise.allSettled([
        recordSupplierPayment({ purchaseId: id, amount: 3_000_000, method: "CASH", paidAt: "2026-08-15", operationKey: key }),
        recordSupplierPayment({ purchaseId: id, amount: 3_000_000, method: "CASH", paidAt: "2026-08-15", operationKey: key }),
      ]);
      const successes = results.filter((r) => r.status === "fulfilled" && r.value.success === true).length;
      expect(successes).toBe(2);

      const payments = await prisma.supplierPayment.findMany({ where: { tenantId: TENANT, voidAt: null } });
      expect(payments).toHaveLength(1);
      const purchase = await prisma.purchase.findUnique({ where: { id } });
      expect(Number(purchase!.paidAmount)).toBe(3_000_000);
    });

    it("3. two different valid payments → both recorded", async () => {
      const id = await createPurchase(0);
      const a = await recordSupplierPayment({ purchaseId: id, amount: 4_000_000, method: "CASH", paidAt: "2026-08-15", operationKey: randomUUID() });
      const b = await recordSupplierPayment({ purchaseId: id, amount: 6_000_000, method: "TRANSFER", paidAt: "2026-08-16", operationKey: randomUUID() });
      expect(a.success).toBe(true);
      expect(b.success).toBe(true);

      const payments = await prisma.supplierPayment.findMany({ where: { tenantId: TENANT, voidAt: null } });
      expect(payments).toHaveLength(2);
      const purchase = await prisma.purchase.findUnique({ where: { id } });
      expect(purchase!.paymentStatus).toBe("PAID");
      expect(Number(purchase!.paidAmount)).toBe(10_000_000);
      expect(round(await accountBalance("1-1000"))).toBe(-10_000_000);
      expect(round(await accountBalance("2-1000"))).toBe(0);
    });

    it("4. concurrent different payments never exceed payable", async () => {
      const id = await createPurchase(0);
      const results = await Promise.allSettled([
        recordSupplierPayment({ purchaseId: id, amount: 6_000_000, method: "CASH", paidAt: "2026-08-15", operationKey: randomUUID() }),
        recordSupplierPayment({ purchaseId: id, amount: 6_000_000, method: "CASH", paidAt: "2026-08-15", operationKey: randomUUID() }),
      ]);
      const fulfilled = results.map((r) => (r.status === "fulfilled" ? r.value : { success: false } as any));
      const ok = fulfilled.filter((r) => r.success === true).length;
      const rejected = fulfilled.filter((r) => r.success === false).length;
      expect(ok + rejected).toBe(2);
      expect(ok).toBe(1);

      const purchase = await prisma.purchase.findUnique({ where: { id } });
      expect(Number(purchase!.paidAmount)).toBeLessThanOrEqual(10_000_000);
      expect(Number(purchase!.paidAmount)).toBe(6_000_000);
      const payments = await prisma.supplierPayment.findMany({ where: { tenantId: TENANT, voidAt: null } });
      expect(payments).toHaveLength(1);
      expect(Math.abs(await accountBalance("2-1000")) + Math.abs(await accountBalance("1-1000"))).toBeGreaterThan(0);
      expect(Number(purchase!.paidAmount) + Number((await accountBalance("2-1000")))).toBeGreaterThanOrEqual(0);
    });

    it("5. void retry → no double reversal", async () => {
      const id = await createPurchase(0);
      const pay = await recordSupplierPayment({ purchaseId: id, amount: 2_000_000, method: "CASH", paidAt: "2026-08-15", operationKey: randomUUID() });
      expect(pay.success).toBe(true);
      const payment = await prisma.supplierPayment.findFirst({ where: { tenantId: TENANT, voidAt: null } });

      const first = await voidSupplierPayment(payment!.id, "salah input");
      expect(first.success).toBe(true);
      const second = await voidSupplierPayment(payment!.id, "salah input");
      expect(second.success).toBe(false);

      const reversals = await prisma.journalEntry.findMany({
        where: { tenantId: TENANT, refType: "VOID_REVERSAL", reference: { startsWith: `${payment!.id}:` } },
      });
      expect(reversals).toHaveLength(1);
      const purchase = await prisma.purchase.findUnique({ where: { id } });
      expect(Number(purchase!.paidAmount)).toBe(0);
      expect(round(await accountBalance("1-1000"))).toBe(0);
      expect(round(await accountBalance("2-1000"))).toBe(-10_000_000);
    });

    it("6. embedded receipt-time SupplierPayment keeps 2F.1A semantics (no journal, soft-void via Purchase void)", async () => {
      const id = await createPurchase(4_000_000);
      const embedded = await prisma.supplierPayment.findFirst({ where: { purchaseId: id } });
      expect(embedded).toBeTruthy();
      expect(embedded!.operationKey).toBeNull();
      expect(await journalCount("SUPPLIER_PAYMENT", embedded!.id)).toBe(0);
      expect(round(await accountBalance("1-1230"))).toBe(10_000_000);

      const vp = await voidPurchase(id, "salah terima");
      expect(vp.success).toBe(true);
      const after = await prisma.supplierPayment.findUnique({ where: { id: embedded!.id } });
      expect(after!.voidAt).not.toBeNull();
      expect(Math.abs(await accountBalance("1-1230"))).toBeLessThan(0.01);
      expect(Math.abs(await accountBalance("1-1000"))).toBeLessThan(0.01);
      expect(Math.abs(await accountBalance("2-1000"))).toBeLessThan(0.01);
    });
  });

  // ------------------------------------------------------------- Expense
  describe("Expense idempotency & void", () => {
    it("7. same operationKey twice → one expense & journal", async () => {
      const key = randomUUID();
      const a = await createExpense({ operationKey: key, date: "2026-08-15", category: "OPERASIONAL", amount: 500_000, description: "Listrik" });
      if (!a.success) throw new Error("expense a gagal");
      const b = await createExpense({ operationKey: key, date: "2026-08-15", category: "OPERASIONAL", amount: 500_000, description: "Listrik" });
      if (!b.success) throw new Error("expense b gagal");
      expect(b.id).toBe(a.id);

      const expenses = await prisma.expense.findMany({ where: { tenantId: TENANT } });
      expect(expenses).toHaveLength(1);
      expect(await journalCount("EXPENSE", a.id)).toBe(1);
      expect(round(await accountBalance("1-1000"))).toBe(-500_000);
      expect(round(await accountBalance("5-2030"))).toBe(500_000);
    });

    it("8. concurrent same-key → one expense", async () => {
      const key = randomUUID();
      const results = await Promise.allSettled([
        createExpense({ operationKey: key, date: "2026-08-15", category: "UTILITAS", amount: 300_000 }),
        createExpense({ operationKey: key, date: "2026-08-15", category: "UTILITAS", amount: 300_000 }),
      ]);
      const ok = results.filter((r) => r.status === "fulfilled" && r.value.success === true);
      expect(ok.length).toBe(2);
      const expenses = await prisma.expense.findMany({ where: { tenantId: TENANT } });
      expect(expenses).toHaveLength(1);
    });

    it("9. different operationKeys → two valid expenses", async () => {
      const a = await createExpense({ operationKey: randomUUID(), date: "2026-08-15", category: "OPERASIONAL", amount: 100_000 });
      const b = await createExpense({ operationKey: randomUUID(), date: "2026-08-16", category: "LAINNYA", amount: 200_000 });
      if (!a.success) throw new Error("expense a gagal");
      if (!b.success) throw new Error("expense b gagal");
      expect(a.id).not.toBe(b.id);
      const expenses = await prisma.expense.findMany({ where: { tenantId: TENANT } });
      expect(expenses).toHaveLength(2);
      expect(round(await accountBalance("1-1000"))).toBe(-300_000);
    });

    it("10. void retry is safe (single reversal)", async () => {
      const created = await createExpense({ operationKey: randomUUID(), date: "2026-08-15", category: "OPERASIONAL", amount: 400_000 });
      if (!created.success) throw new Error("expense gagal");
      const first = await voidExpense(created.id, "salah nominal");
      expect(first.success).toBe(true);
      const second = await voidExpense(created.id, "salah nominal");
      expect(second.success).toBe(false);

      const reversals = await prisma.journalEntry.findMany({
        where: { tenantId: TENANT, refType: "VOID_REVERSAL", reference: { startsWith: `${created.id}:` } },
      });
      expect(reversals).toHaveLength(1);
      expect(Math.abs(await accountBalance("5-2030"))).toBeLessThan(0.01);
      expect(Math.abs(await accountBalance("1-1000"))).toBeLessThan(0.01);
    });
  });

  // ---------------------------------------------------------- CreditNote
  describe("CreditNote idempotency & concurrent returns", () => {
    async function walkInSale(items: Array<{ productId: string; quantity: number }>): Promise<string> {
      const res = await createInvoice({
        operationKey: randomUUID(),
        customerId,
        items: items.map((item) => ({ productId: item.productId, quantity: item.quantity, discount: 0 })),
        invoiceDiscount: 0,
        tax: 0,
        taxType: "NONE",
        status: "PAID",
        paymentMethod: "CASH",
        salesChannel: "WALK_IN",
      });
      if (!res.success) throw new Error(res.error);
      return res.invoiceId;
    }

    it("11. same operationKey twice → one CreditNote (partial return retry)", async () => {
      const id = await walkInSale([{ productId: fgProduct, quantity: 2 }]);
      const key = randomUUID();
      const a = await createCreditNote({ invoiceId: id, reason: "retur satu unit", items: [{ productId: fgProduct, quantity: 1, unitDiscount: 0 }], operationKey: key });
      expect(a.success).toBe(true);
      const b = await createCreditNote({ invoiceId: id, reason: "retur satu unit", items: [{ productId: fgProduct, quantity: 1, unitDiscount: 0 }], operationKey: key });
      expect(b.success).toBe(true);
      expect(b.creditNoteCode).toBe(a.creditNoteCode);

      const creditNotes = await prisma.creditNote.findMany({ where: { tenantId: TENANT } });
      expect(creditNotes).toHaveLength(1);
      expect(await journalCount("CREDIT_NOTE", creditNotes[0].id)).toBe(1);
      const inv = await prisma.invoice.findUnique({ where: { id } });
      expect(Number(inv!.returnedAmount)).toBe(700_000);
      expect(round(await accountBalance("1-1000"))).toBe(1_400_000);
      expect(round(await accountBalance("2-1400"))).toBe(-700_000);
    });

    it("12. concurrent same-key → one return", async () => {
      const id = await walkInSale([{ productId: fgProduct, quantity: 2 }]);
      const key = randomUUID();
      const results = await Promise.allSettled([
        createCreditNote({ invoiceId: id, reason: "retur satu unit", items: [{ productId: fgProduct, quantity: 1, unitDiscount: 0 }], operationKey: key }),
        createCreditNote({ invoiceId: id, reason: "retur satu unit", items: [{ productId: fgProduct, quantity: 1, unitDiscount: 0 }], operationKey: key }),
      ]);
      const ok = results.filter((r) => r.status === "fulfilled" && r.value.success === true);
      expect(ok.length).toBe(2);
      const creditNotes = await prisma.creditNote.findMany({ where: { tenantId: TENANT } });
      expect(creditNotes).toHaveLength(1);
      const inv = await prisma.invoice.findUnique({ where: { id } });
      expect(Number(inv!.returnedAmount)).toBe(700_000);
    });

    it("13. concurrent different returns respect remaining returnable qty", async () => {
      const id = await walkInSale([{ productId: fgProduct, quantity: 2 }]);
      const results = await Promise.allSettled([
        createCreditNote({ invoiceId: id, reason: "retur satu", items: [{ productId: fgProduct, quantity: 1, unitDiscount: 0 }], operationKey: randomUUID() }),
        createCreditNote({ invoiceId: id, reason: "retur dua", items: [{ productId: fgProduct, quantity: 2, unitDiscount: 0 }], operationKey: randomUUID() }),
      ]);
      const ok = results.filter((r): r is PromiseFulfilledResult<{ success: true; creditNoteCode: string }> => r.status === "fulfilled" && r.value.success === true);
      const fail = results.filter((r): r is PromiseFulfilledResult<{ success: false; error: string }> => r.status === "fulfilled" && r.value.success === false);
      expect(ok.length).toBe(1);
      expect(fail.length).toBe(1);
      expect(fail[0].value.error).toContain("melebihi sisa");

      const creditNotes = await prisma.creditNote.findMany({ where: { tenantId: TENANT } });
      expect(creditNotes).toHaveLength(1);
      const inv = await prisma.invoice.findUnique({ where: { id } });
      // order-independent: either the qty-1 or the qty-2 return wins first
      expect([700_000, 1_400_000]).toContain(Number(inv!.returnedAmount));
    });

    it("14. refund payable / AR results stay correct after concurrent partial returns", async () => {
      const res = await createInvoice({
        operationKey: randomUUID(),
        customerId,
        items: [
          { productId: fgProduct, quantity: 1, discount: 0 },
          { productId: fgProduct2, quantity: 1, discount: 0 },
        ],
        invoiceDiscount: 0,
        tax: 0,
        taxType: "NONE",
        status: "ISSUED",
        paymentMethod: "CREDIT",
        salesChannel: "B2B_DIRECT",
      });
      expect(res.success).toBe(true);
      if (!res.success) return;
      const ship = await updateInvoiceShipping(res.invoiceId, { fulfillmentStatus: "DELIVERED" });
      expect(ship.success).toBe(true);
      const rp = await recordPayment({ invoiceId: res.invoiceId, amount: 400_000, method: "CASH", paidAt: "2026-08-14" });
      expect(rp.success).toBe(true);

      const results = await Promise.allSettled([
        createCreditNote({ invoiceId: res.invoiceId, reason: "retur fg2", items: [{ productId: fgProduct2, quantity: 1, unitDiscount: 0 }], operationKey: randomUUID() }),
        createCreditNote({ invoiceId: res.invoiceId, reason: "retur fg", items: [{ productId: fgProduct, quantity: 1, unitDiscount: 0 }], operationKey: randomUUID() }),
      ]);
      const ok = results.filter((r) => r.status === "fulfilled" && r.value.success === true);
      expect(ok.length).toBe(2);

      // 1m invoice, 400k paid → AR 600k. Full return → AR 0, Refund Payable 400k, cash unchanged.
      expect(round(await accountBalance("1-1100"))).toBe(0);
      expect(round(await accountBalance("2-1400"))).toBe(-400_000);
      expect(round(await accountBalance("1-1000"))).toBe(400_000);
      const creditNotes = await prisma.creditNote.findMany({ where: { tenantId: TENANT } });
      expect(creditNotes).toHaveLength(2);
    });
  });

  // -------------------------------------------------- Owner withdrawal
  describe("Owner withdrawal concurrency (TOCTOU)", () => {
    async function seedCapital(initial: number): Promise<void> {
      await prisma.capitalTransaction.create({
        data: { tenantId: TENANT, type: "INITIAL", amount: initial, transactionDate: new Date("2026-08-01T00:00:00"), createdById: USER },
      });
    }

    it("15. concurrent 7m + 7m against 10m → at most one succeeds", async () => {
      await seedCapital(10_000_000);
      const results = await Promise.allSettled([
        recordOwnerWithdrawal({ type: "WITHDRAWAL", amount: 7_000_000, transactionDate: "2026-08-15", operationKey: randomUUID() }),
        recordOwnerWithdrawal({ type: "WITHDRAWAL", amount: 7_000_000, transactionDate: "2026-08-15", operationKey: randomUUID() }),
      ]);
      const ok = results.filter((r): r is PromiseFulfilledResult<{ success: true }> => r.status === "fulfilled" && r.value.success === true);
      const fail = results.filter((r): r is PromiseFulfilledResult<{ success: false; error: string }> => r.status === "fulfilled" && r.value.success === false);
      expect(ok.length).toBe(1);
      expect(fail.length).toBe(1);
      expect(fail[0].value.error).toContain("tidak cukup untuk prive");

      const withdrawals = await prisma.capitalTransaction.findMany({ where: { tenantId: TENANT, type: "WITHDRAWAL" } });
      expect(withdrawals).toHaveLength(1);
      expect(Number(withdrawals[0].amount)).toBe(7_000_000);
      const summary = await getCapitalSummary();
      expect(summary.netCapital).toBe(3_000_000);
    });

    it("16. journal stays balanced after concurrent withdrawals", async () => {
      await seedCapital(10_000_000);
      await Promise.allSettled([
        recordOwnerWithdrawal({ type: "WITHDRAWAL", amount: 7_000_000, transactionDate: "2026-08-15", operationKey: randomUUID() }),
        recordOwnerWithdrawal({ type: "WITHDRAWAL", amount: 7_000_000, transactionDate: "2026-08-15", operationKey: randomUUID() }),
      ]);
      const journals = await prisma.journalEntry.findMany({
        where: { tenantId: TENANT, refType: "CAPITAL" },
        include: { lines: true },
      });
      expect(journals).toHaveLength(1);
      for (const je of journals) {
        const debit = je.lines.reduce((s, l) => s + Number(l.debit), 0);
        const credit = je.lines.reduce((s, l) => s + Number(l.credit), 0);
        expect(debit).toBe(credit);
        expect(debit).toBe(7_000_000);
      }
      expect(round(await accountBalance("3-1010"))).toBe(7_000_000);
      expect(round(await accountBalance("1-1000"))).toBe(-7_000_000);
    });

    it("17. same operationKey retry does not duplicate withdrawal", async () => {
      await seedCapital(10_000_000);
      const key = randomUUID();
      const a = await recordOwnerWithdrawal({ type: "WITHDRAWAL", amount: 2_000_000, transactionDate: "2026-08-15", operationKey: key });
      const b = await recordOwnerWithdrawal({ type: "WITHDRAWAL", amount: 2_000_000, transactionDate: "2026-08-15", operationKey: key });
      expect(a.success).toBe(true);
      expect(b.success).toBe(true);
      const withdrawals = await prisma.capitalTransaction.findMany({ where: { tenantId: TENANT, type: "WITHDRAWAL" } });
      expect(withdrawals).toHaveLength(1);
      expect(await journalCount("CAPITAL", withdrawals[0].id)).toBe(1);
      expect((await getCapitalSummary()).netCapital).toBe(8_000_000);
    });

    it("17b. injection dedupe: same operationKey → one injection", async () => {
      const key = randomUUID();
      const a = await recordCapitalInjection({ type: "INJECTION", amount: 5_000_000, transactionDate: "2026-08-15", operationKey: key });
      const b = await recordCapitalInjection({ type: "INJECTION", amount: 5_000_000, transactionDate: "2026-08-15", operationKey: key });
      expect(a.success).toBe(true);
      expect(b.success).toBe(true);
      const injections = await prisma.capitalTransaction.findMany({ where: { tenantId: TENANT, type: "INJECTION" } });
      expect(injections).toHaveLength(1);
      expect((await getCapitalSummary()).netCapital).toBe(5_000_000);
    });
  });

  // ------------------------------------------------------- voidInvoice
  describe("voidInvoice concurrent double-restore race", () => {
    it("18. two simultaneous voidInvoice calls → stock restored exactly once", async () => {
      const res = await createInvoice({
        operationKey: randomUUID(),
        customerId,
        items: [{ productId: fgProduct, quantity: 2, discount: 0 }],
        invoiceDiscount: 0,
        tax: 0,
        taxType: "NONE",
        status: "ISSUED",
        paymentMethod: "CREDIT",
        salesChannel: "B2B_DIRECT",
      });
      expect(res.success).toBe(true);
      if (!res.success) return;
      const ship = await updateInvoiceShipping(res.invoiceId, { fulfillmentStatus: "DELIVERED" });
      expect(ship.success).toBe(true);

      const inv = await prisma.invoice.findUnique({ where: { id: res.invoiceId } });
      expect(inv!.fulfillmentStatus).toBe("DELIVERED");
      expect(Number(inv!.paidAmount)).toBe(0);
      expect(await journalCount("INVOICE", res.invoiceId)).toBe(1);
      expect((await prisma.product.findUnique({ where: { id: fgProduct } }))!.stockUnit).toBe(98);

      const results = await Promise.allSettled([
        voidInvoice(res.invoiceId, "salah order"),
        voidInvoice(res.invoiceId, "salah order"),
      ]);
      const ok = results.filter((r) => r.status === "fulfilled" && r.value.success === true);
      const fail = results.filter((r) => r.status === "fulfilled" && r.value.success === false);
      expect(ok.length).toBe(1);
      expect(fail.length).toBe(1);

      // exactly ONE effective InventoryLedger reversal per source row
      const reversals = await prisma.inventoryLedger.findMany({
        where: { tenantId: TENANT, refType: "VOID_REVERSAL", refId: res.invoiceId, entryType: "IN" },
      });
      expect(reversals).toHaveLength(1);
      expect(Number(reversals[0].quantityUnit)).toBe(2);

      // stock restored exactly once
      expect((await prisma.product.findUnique({ where: { id: fgProduct } }))!.stockUnit).toBe(100);

      // no duplicate GL reversal
      const reversalJournals = await prisma.journalEntry.findMany({
        where: { tenantId: TENANT, refType: "VOID_REVERSAL", reference: { startsWith: `${res.invoiceId}:` } },
      });
      expect(reversalJournals).toHaveLength(1);
      expect(await journalCount("INVOICE", res.invoiceId)).toBe(1);

      // final invoice VOID
      const after = await prisma.invoice.findUnique({ where: { id: res.invoiceId } });
      expect(after!.status).toBe("VOID");
      expect(after!.fulfillmentStatus).toBe("CANCELLED");
    });
  });
});