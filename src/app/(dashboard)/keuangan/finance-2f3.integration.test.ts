import { describe, expect, it, vi, beforeAll, afterAll } from "vitest";
import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { resolveTestDatabaseUrl } from "../../../../test/setup/test-database-guard";
import {
  createExpense,
  getExpenseHistory,
  getKeuanganPageData,
  getPaymentHistory,
  getPurchaseHistory,
  getSupplierPaymentHistory,
  recordPayment,
  recordSupplierPayment,
  voidExpense,
  voidPayment,
  voidSupplierPayment,
} from "./actions";
import { EXPENSE_CATEGORIES } from "@/lib/expense-categories";
import { getSalesPageData } from "../penjualan/actions";
import { postJournalEntry } from "@/lib/posting";

// Gated integration test: only runs against an isolated test DB with RUN_INTEGRATION=true.
const integrationEnabled = process.env.RUN_INTEGRATION === "true";
const suite = integrationEnabled ? describe : describe.skip;
let prisma: PrismaClient;

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

vi.mock("@/lib/auth", async (importOriginal) => {
  const actual = await importOriginal<any>();
  return {
    ...actual,
    getCurrentTenantId: vi.fn().mockResolvedValue("test-tenant-2f3"),
    getSystemUserId: vi.fn().mockResolvedValue("test-user-2f3"),
    requireRole: vi.fn(),
    requireFeature: vi.fn(),
    requireTenantPrisma: vi.fn(async () => prisma),
  };
});

suite("Finance UX 2F.3 Integration", () => {
  beforeAll(async () => {
    const pool = new Pool({ connectionString: resolveTestDatabaseUrl(), max: 3 });
    prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
    const T = "test-tenant-2f3";
    const U = "test-user-2f3";
    await prisma.journalLine.deleteMany({ where: { journalEntry: { tenantId: T } } });
    await prisma.journalEntry.deleteMany({ where: { tenantId: T } });
    await prisma.account.deleteMany({ where: { tenantId: T } });
    await prisma.auditLog.deleteMany({ where: { tenantId: T } });
    await prisma.inventoryLedger.deleteMany({ where: { tenantId: T } });
    await prisma.expense.deleteMany({ where: { tenantId: T } });
    await prisma.creditNoteItem.deleteMany({ where: { creditNote: { tenantId: T } } });
    await prisma.creditNote.deleteMany({ where: { tenantId: T } });
    await prisma.invoiceItem.deleteMany({ where: { invoice: { tenantId: T } } });
    await prisma.payment.deleteMany({ where: { tenantId: T } });
    await prisma.invoice.deleteMany({ where: { tenantId: T } });
    await prisma.supplierPayment.deleteMany({ where: { tenantId: T } });
    await prisma.purchase.deleteMany({ where: { tenantId: T } });
    await prisma.supplier.deleteMany({ where: { tenantId: T } });
    await prisma.customer.deleteMany({ where: { tenantId: T } });
    await prisma.product.deleteMany({ where: { tenantId: T } });
    await prisma.user.deleteMany({ where: { id: U } });
    await prisma.tenant.deleteMany({ where: { id: T } });
    await prisma.tenant.create({
      data: {
        id: T,
        code: "TEST-2F3",
        name: "Tenant 2F3",
        subdomain: "test-2f3",
      },
    });
    await prisma.user.create({
      data: {
        id: U,
        email: "2f3@example.com",
        name: "Test User 2F3",
        tenantId: T,
        role: "OWNER",
      },
    });
  });

  afterAll(async () => {
    const T = "test-tenant-2f3";
    const U = "test-user-2f3";
    await prisma.journalLine.deleteMany({ where: { journalEntry: { tenantId: T } } });
    await prisma.journalEntry.deleteMany({ where: { tenantId: T } });
    await prisma.account.deleteMany({ where: { tenantId: T } });
    await prisma.auditLog.deleteMany({ where: { tenantId: T } });
    await prisma.inventoryLedger.deleteMany({ where: { tenantId: T } });
    await prisma.expense.deleteMany({ where: { tenantId: T } });
    await prisma.creditNoteItem.deleteMany({ where: { creditNote: { tenantId: T } } });
    await prisma.creditNote.deleteMany({ where: { tenantId: T } });
    await prisma.invoiceItem.deleteMany({ where: { invoice: { tenantId: T } } });
    await prisma.payment.deleteMany({ where: { tenantId: T } });
    await prisma.invoice.deleteMany({ where: { tenantId: T } });
    await prisma.supplierPayment.deleteMany({ where: { tenantId: T } });
    await prisma.purchase.deleteMany({ where: { tenantId: T } });
    await prisma.supplier.deleteMany({ where: { tenantId: T } });
    await prisma.customer.deleteMany({ where: { tenantId: T } });
    await prisma.product.deleteMany({ where: { tenantId: T } });
    await prisma.user.deleteMany({ where: { id: U } });
    await prisma.tenant.deleteMany({ where: { id: T } });
    await prisma.$disconnect();
  });

  it("EXPENSE_CATEGORIES memuat GAJI dan kategori lama tetap ada", () => {
    expect(EXPENSE_CATEGORIES).toContain("GAJI");
    expect(EXPENSE_CATEGORIES).toEqual(
      expect.arrayContaining(["UTILITAS", "OPERASIONAL", "LAINNYA"]),
    );
  });

  it("createExpense menerima GAJI dan membukukannya ke akun 5-2000", async () => {
    const result = await createExpense({
      operationKey: crypto.randomUUID(),
      date: "2026-08-10",
      category: "GAJI",
      amount: 2_000_000,
      description: "Gaji karyawan Agustus",
    });
    expect(result.success).toBe(true);

    const entries = await prisma.journalEntry.findMany({
      where: { tenantId: "test-tenant-2f3", refType: "EXPENSE" },
      include: { lines: { include: { account: { select: { code: true } } } } },
    });
    const gajiEntry = entries.find((e) => e.reference === (result as { id: string }).id);
    expect(gajiEntry).toBeDefined();
    const gajiLine = gajiEntry!.lines.find((l) => Number(l.debit) > 0);
    expect(gajiLine?.account.code).toBe("5-2000");

    const history = await getExpenseHistory("ACTIVE");
    expect(history.some((e) => e.category === "GAJI" && e.amount === 2_000_000)).toBe(true);
  });

  it("kategori lama (UTILITAS) tetap bisa dicatat", async () => {
    const result = await createExpense({
      operationKey: crypto.randomUUID(),
      date: "2026-08-10",
      category: "UTILITAS",
      amount: 150_000,
      description: "Listrik",
    });
    expect(result.success).toBe(true);
    const history = await getExpenseHistory("ACTIVE");
    expect(history.some((e) => e.category === "UTILITAS")).toBe(true);
  });

  it("expense di-void hanya muncul di filter Dibatalkan/Semua dengan pelaku", async () => {
    const result = await createExpense({
      operationKey: crypto.randomUUID(),
      date: "2026-08-11",
      category: "OPERASIONAL",
      amount: 75_000,
      description: "Akan di-void",
    });
    const id = (result as { id: string }).id;

    const voidResult = await voidExpense(id, "Salah catat");
    expect(voidResult.success).toBe(true);

    const active = await getExpenseHistory("ACTIVE");
    expect(active.some((e) => e.id === id)).toBe(false);

    const voided = await getExpenseHistory("VOIDED");
    const row = voided.find((e) => e.id === id);
    expect(row).toBeDefined();
    expect(row!.voidReason).toBe("Salah catat");
    expect(row!.voidedByName).toBe("Test User 2F3");
    expect(row!.voidedAt).not.toBeNull();

    const all = await getExpenseHistory("ALL");
    expect(all.some((e) => e.id === id)).toBe(true);
  });

  it("pembayaran awal (embedded, tanpa jurnal sendiri) menolak void mandiri", async () => {
    const supplier = await prisma.supplier.create({
      data: { tenantId: "test-tenant-2f3", code: "SUP-2F3-1", name: "Supplier 2F3" },
    });
    const purchase = await prisma.purchase.create({
      data: {
        tenantId: "test-tenant-2f3",
        code: "PUR-2F3-001",
        type: "GREEN_BEAN",
        supplierId: supplier.id,
        createdById: "test-user-2f3",
        pricePerUnit: 1_000_000,
        totalCost: 1_000_000,
        status: "COMPLETED",
        paymentStatus: "PARTIAL",
        paidAmount: 400_000,
        receivedAt: new Date("2026-08-01T00:00:00.000Z"),
      },
    });
    const embedded = await prisma.supplierPayment.create({
      data: {
        tenantId: "test-tenant-2f3",
        code: "SPAY-2F3-EMBED",
        purchaseId: purchase.id,
        amount: 400_000,
        method: "CASH",
        paidAt: new Date("2026-08-01T00:00:00.000Z"),
        operationKey: null,
        createdById: "test-user-2f3",
      },
    });
    // Jurnal PURCHASE (pembayaran awal sudah dibukukan di dalamnya).
    await postJournalEntry({
      date: new Date("2026-08-01T00:00:00.000Z"),
      description: "Pembelian: Green Bean",
      reference: purchase.id,
      refType: "PURCHASE",
      lines: [
        { accountCode: "1-1200", debit: 1_000_000, credit: 0 },
        { accountCode: "1-1000", debit: 0, credit: 400_000 },
        { accountCode: "2-1000", debit: 0, credit: 600_000 },
      ],
    }, { tenantId: "test-tenant-2f3", userId: "test-user-2f3" });

    const voidResult = await voidSupplierPayment(embedded.id, "Coba void");
    expect(voidResult.success).toBe(false);
    expect(voidResult.error).toContain("tidak dapat dibatalkan secara mandiri");

    const spHistory = await getSupplierPaymentHistory("ACTIVE");
    const spRow = spHistory.find((p) => p.id === embedded.id);
    expect(spRow?.isEmbedded).toBe(true);
  });

  it("pembayaran supplier independen tetap bisa di-void dan tampil di filter", async () => {
    const purchase = await prisma.purchase.create({
      data: {
        tenantId: "test-tenant-2f3",
        code: "PUR-2F3-002",
        type: "GREEN_BEAN",
        supplierId: (await prisma.supplier.findFirst({ where: { tenantId: "test-tenant-2f3" } }))!.id,
        createdById: "test-user-2f3",
        pricePerUnit: 2_000_000,
        totalCost: 2_000_000,
        status: "COMPLETED",
        paymentStatus: "UNPAID",
        paidAmount: 0,
        receivedAt: new Date("2026-08-02T00:00:00.000Z"),
      },
    });

    const payResult = await recordSupplierPayment({
      operationKey: crypto.randomUUID(),
      purchaseId: purchase.id,
      amount: 500_000,
      method: "TRANSFER",
      paidAt: "2026-08-05",
    });
    expect(payResult.success).toBe(true);

    const payments = await getSupplierPaymentHistory("ACTIVE");
    const row = payments.find((p) => p.purchaseCode === "PUR-2F3-002");
    expect(row).toBeDefined();
    expect(row!.isEmbedded).toBe(false);

    const voidResult = await voidSupplierPayment(row!.id, "Transfer salah");
    expect(voidResult.success).toBe(true);

    const voided = await getSupplierPaymentHistory("VOIDED");
    const voidedRow = voided.find((p) => p.id === row!.id);
    expect(voidedRow?.voidReason).toBe("Transfer salah");
  });

  it("server menolak pembayaran melebihi sisa tagihan yang sudah dikurangi retur", async () => {
    const customer = await prisma.customer.create({
      data: { tenantId: "test-tenant-2f3", code: "CUST-2F3-1", name: "Customer 2F3" },
    });
    const invoice = await prisma.invoice.create({
      data: {
        tenantId: "test-tenant-2f3",
        code: "INV-2F3-001",
        customerId: customer.id,
        createdById: "test-user-2f3",
        status: "PARTIAL",
        subtotal: 1_000_000,
        discount: 0,
        tax: 0,
        grandTotal: 1_000_000,
        paidAmount: 400_000,
        returnedAmount: 300_000,
        issuedAt: new Date("2026-08-01T00:00:00.000Z"),
      },
    });

    const over = await recordPayment({
      invoiceId: invoice.id,
      amount: 400_000,
      method: "CASH",
      paidAt: "2026-08-15",
    });
    if (over.success) throw new Error("harusnya ditolak server");
    expect(over.error).toContain("melebihi sisa tagihan");

    const ok = await recordPayment({
      invoiceId: invoice.id,
      amount: 300_000,
      method: "CASH",
      paidAt: "2026-08-15",
    });
    expect(ok.success).toBe(true);
  });

  it("getSalesPageData menampilkan sisa = grand − paid − returned", async () => {
    const data = await getSalesPageData();
    const row = data.invoices.find((i) => i.code === "INV-2F3-001");
    expect(row).toBeDefined();
    expect(row!.returnedAmount).toBe(300_000);
    const inv = await prisma.invoice.findUnique({ where: { id: row!.id } });
    const expected = Math.max(
      0,
      Number(inv!.grandTotal) - Number(inv!.paidAmount) - Number(inv!.returnedAmount),
    );
    expect(row!.balance).toBe(expected);
  });

  it("command center: kas & bank, hutang supplier, arus kas sesuai GL", async () => {
    const T = "test-tenant-2f3";
    const data = await getKeuanganPageData();

    // Kas & Bank = net seluruh jurnal pada akun 1-1000 (sama dengan Neraca).
    const allKasLines = await prisma.journalLine.findMany({
      where: { journalEntry: { tenantId: T }, account: { code: "1-1000" } },
      select: { debit: true, credit: true },
    });
    const expectedKas = allKasLines.reduce(
      (s, l) => s + Number(l.debit) - Number(l.credit),
      0,
    );
    expect(data.kpi.kasAndBank).toBe(expectedKas);

    // Arus Kas Bulan Ini = pergerakan 1-1000 pada bulan berjalan (2F.2).
    const now = new Date();
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
    const monthKasLines = await prisma.journalLine.findMany({
      where: {
        journalEntry: { tenantId: T, date: { gte: start, lt: end } },
        account: { code: "1-1000" },
      },
      select: { debit: true, credit: true },
    });
    const expectedMonthKas = monthKasLines.reduce(
      (s, l) => s + Number(l.debit) - Number(l.credit),
      0,
    );
    expect(data.kpi.arusKasBulanIni).toBe(expectedMonthKas);

    // Hutang Supplier = Σ max(0, totalCost − paidAmount) pembelian COMPLETED.
    const purchases = await prisma.purchase.findMany({
      where: { tenantId: T, status: "COMPLETED" },
      select: { totalCost: true, paidAmount: true },
    });
    const expectedHutang = purchases.reduce(
      (s, p) => s + Math.max(0, Number(p.totalCost) - Number(p.paidAmount)),
      0,
    );
    expect(data.kpi.hutangSupplier).toBe(expectedHutang);
  });

  it("pembayaran pelanggan di-void tampil di filter Dibatalkan", async () => {
    const data = await getPaymentHistory("ALL");
    const payments = data.filter((p) => p.amount === 300_000);
    expect(payments.length).toBeGreaterThan(0);
    const payId = payments[0].id;
    const voidResult = await voidPayment(payId, "Salah nominal");
    expect(voidResult.success).toBe(true);
    const voided = await getPaymentHistory("VOIDED");
    const row = voided.find((p) => p.id === payId);
    expect(row?.voidReason).toBe("Salah nominal");
    expect(row?.voidedByName).toBe("Test User 2F3");
  });

  it("getPurchaseHistory menghitung initialPaidAmount dari pembayaran tanpa operationKey", async () => {
    const rows = await getPurchaseHistory();
    const row = rows.find((p) => p.code === "PUR-2F3-001");
    expect(row?.initialPaidAmount).toBe(400_000);
  });
});