import { describe, expect, it, vi, beforeAll, afterAll } from "vitest";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { resolveTestDatabaseUrl } from "../../test/setup/test-database-guard";
import { computeReceivable } from "@/lib/finance-formulas";
import { computeRevenue } from "@/lib/report-finance";

const TENANT_A = "test-tenant-iso-a";
const TENANT_B = "test-tenant-iso-b";

// gated integration test: only runs against isolated test DB with RUN_INTEGRATION=true
const integrationEnabled = process.env.RUN_INTEGRATION === "true";
const suite = integrationEnabled ? describe : describe.skip;
let prisma: PrismaClient;

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const round = (n: number) => Math.round(n * 100) / 100;

async function cleanup() {
  for (const tenantId of [TENANT_A, TENANT_B]) {
    await prisma.journalLine.deleteMany({ where: { journalEntry: { tenantId } } });
    await prisma.journalEntry.deleteMany({ where: { tenantId } });
    await prisma.account.deleteMany({ where: { tenantId } });
    await prisma.invoiceItem.deleteMany({ where: { invoice: { tenantId } } });
    await prisma.invoice.deleteMany({ where: { tenantId } });
    await prisma.product.deleteMany({ where: { tenantId } });
    await prisma.customer.deleteMany({ where: { tenantId } });
    await prisma.user.deleteMany({ where: { tenantId } });
    await prisma.tenant.deleteMany({ where: { id: tenantId } });
  }
}

suite("Phase 2G — Reporting Tenant Isolation (regression)", () => {
  beforeAll(async () => {
    const pool = new Pool({ connectionString: resolveTestDatabaseUrl(), max: 3 });
    prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
    await prisma.$connect();
    await cleanup();
  });

  afterAll(async () => {
    await cleanup();
    await prisma.$disconnect();
  });

  async function seedTenant(
    tenantId: string,
    now: Date,
  ): Promise<{ customerId: string; invoiceId: string; paidInvoiceId: string }> {
    await prisma.tenant.create({
      data: { id: tenantId, code: tenantId, name: tenantId, timezone: "Asia/Jakarta" },
    });
    const userId = `user-${tenantId}`;
    await prisma.user.create({
      data: { id: userId, email: `${tenantId}@example.com`, name: `User ${tenantId}`, tenantId, role: "OWNER" },
    });
    const customer = await prisma.customer.create({
      data: { tenantId, code: `CST-${tenantId}`, name: `Customer ${tenantId}` },
    });
    const product = await prisma.product.create({
      data: {
        tenantId,
        code: `FG-${tenantId}`,
        name: `Blend ${tenantId}`,
        type: "FINISHED_GOODS",
      },
    });
    const makeInvoice = (amount: number, delivered: boolean, returned = 0, voided = false) =>
      prisma.invoice.create({
        data: {
          tenantId,
          customerId: customer.id,
          createdById: userId,
          code: `INV-${tenantId}-${randomUUID().slice(0, 6)}`,
          status: delivered ? "PAID" : "ISSUED",
          fulfillmentStatus: delivered ? "DELIVERED" : "READY_TO_PACK",
          issuedAt: now,
          deliveredAt: delivered ? now : null,
          voidAt: voided ? now : null,
          subtotal: amount,
          grandTotal: amount,
          paidAmount: delivered ? amount : 0,
          returnedAmount: returned,
          items: {
            create: [
              { tenantId, productId: product.id, quantity: 1, unitPrice: amount, subtotal: amount, hpp: amount * 0.4 },
            ],
          },
        },
      });
    const activeInvoice = await makeInvoice(1_000_000, true);
    await makeInvoice(500_000, true, 200_000);
    const undeliveredInvoice = await makeInvoice(700_000, false);
    await makeInvoice(900_000, true, 0, true);

    // Jurnal dengan JournalLine TANPA kolom tenantId — garis uji audit 2G:
    // kueri GL wajib di-scope lewat account.tenantId / journalEntry.tenantId.
    const cashAccount = await prisma.account.create({
      data: { tenantId, code: "1-1000", name: `Kas ${tenantId}`, type: "ASSET" },
    });
    const revenueAccount = await prisma.account.create({
      data: { tenantId, code: "4-1000", name: `Pendapatan ${tenantId}`, type: "REVENUE" },
    });
    await prisma.journalEntry.create({
      data: {
        tenantId,
        code: `JE-${tenantId}`,
        date: now,
        description: "Pembayaran invoice uji isolasi",
        refType: "PAYMENT",
        reference: activeInvoice.id,
        createdById: userId,
        lines: {
          create: [
            { accountId: cashAccount.id, debit: 1_000_000, credit: 0 },
            { accountId: revenueAccount.id, debit: 0, credit: 1_000_000 },
          ],
        },
      },
    });

    return { customerId: customer.id, invoiceId: activeInvoice.id, paidInvoiceId: undeliveredInvoice.id };
  }

  it("laporan pendapatan tenant A tidak pernah menyentuh data tenant B", async () => {
    const now = new Date("2026-08-10T03:00:00.000Z");
    await seedTenant(TENANT_A, now);
    await seedTenant(TENANT_B, now);

    // — Pola kueri laporan penjualan (basis diserahkan + net retur + void gate) —
    const reportWhere = (tenantId: string, start: Date, end: Date) => ({
      tenantId,
      deliveredAt: { gte: start, lte: end },
      OR: [{ voidAt: null }, { voidAt: { gt: end } }],
    });
    const from = new Date("2026-08-01T00:00:00.000Z");
    const to = new Date("2026-08-31T23:59:59.999Z");

    const aggA = await prisma.invoice.aggregate({
      where: reportWhere(TENANT_A, from, to),
      _sum: { grandTotal: true, returnedAmount: true },
      _count: true,
    });
    const aggB = await prisma.invoice.aggregate({
      where: reportWhere(TENANT_B, from, to),
      _sum: { grandTotal: true, returnedAmount: true },
      _count: true,
    });

    // A: 1.000.000 + 500.000 (retur 200.000); nota void (voidAt 10-08 <= 31-08)
    // di-scope keluar oleh void gate → net revenue = 1.300.000; nota belum
    // diserahkan (700.000) tidak masuk karena tanpa deliveredAt.
    expect(computeRevenue([{ grandTotal: aggA._sum.grandTotal, returnedAmount: aggA._sum.returnedAmount }])).toBe(1_300_000);
    expect(aggA._count).toBe(2);

    // B identik polanya, terisolasi dari A.
    expect(computeRevenue([{ grandTotal: aggB._sum.grandTotal, returnedAmount: aggB._sum.returnedAmount }])).toBe(1_300_000);
    expect(aggB._count).toBe(2);

    // Piutang kolektibel (2F.2): hanya ISSUED/PARTIAL, net retur.
    const arA = await prisma.invoice.findMany({
      where: { tenantId: TENANT_A, status: { in: ["ISSUED", "PARTIAL"] } },
      select: { grandTotal: true, paidAmount: true, returnedAmount: true },
    });
    expect(arA.reduce((s, i) => s + computeReceivable(Number(i.grandTotal), Number(i.paidAmount), Number(i.returnedAmount)), 0))
      .toBe(700_000); // hanya nota belum diserahkan yang masih tertagih

    // — Pola kueri GL (getBalanceSheetReport): JournalLine tidak punya tenantId,
    //   wajib di-scope via account.tenantId / journalEntry.tenantId —
    const balA = await prisma.journalLine.findMany({
      where: { account: { tenantId: TENANT_A, code: "1-1000" }, journalEntry: { voidAt: null } },
      select: { debit: true, credit: true },
    });
    const balB = await prisma.journalLine.findMany({
      where: { account: { tenantId: TENANT_B, code: "1-1000" }, journalEntry: { voidAt: null } },
      select: { debit: true, credit: true },
    });
    expect(round(balA.reduce((s, l) => s + Number(l.debit) - Number(l.credit), 0))).toBe(1_000_000);
    expect(round(balB.reduce((s, l) => s + Number(l.debit) - Number(l.credit), 0))).toBe(1_000_000);
    // Saldo lintas tenant TIDAK bocor: akun A tidak memuat jurnal B.
    expect(prisma.journalLine.findMany({ where: { account: { tenantId: TENANT_A, code: "4-1000" } } })).resolves.toHaveLength(1);
  });
});