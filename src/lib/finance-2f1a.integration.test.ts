import { describe, expect, it, vi, beforeAll, afterAll, beforeEach } from "vitest";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { resolveTestDatabaseUrl } from "../../test/setup/test-database-guard";
import { createSupplyPurchase } from "@/lib/supply-purchase";
import { voidPurchase, voidSupplierPayment, recordSupplierPayment, recordPayment } from "@/app/(dashboard)/keuangan/actions";
import {
  createInvoice,
  createCreditNote,
  updateInvoiceShipping,
} from "@/app/(dashboard)/penjualan/actions";

const TENANT = "test-tenant-2f1a";
const USER = "test-user-2f1a";

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
    getCurrentTenantId: vi.fn().mockResolvedValue("test-tenant-2f1a"),
    getSystemUserId: vi.fn().mockResolvedValue("test-user-2f1a"),
    requireRole: vi.fn(),
    requireFeature: vi.fn(),
    requireTenantPrisma: vi.fn(async () => prisma),
  };
});

const round = (n: number) => Math.round(n * 100) / 100;

// Same convention as the production balance sheet (getBalanceSheetReport):
// journals with voidAt IS NULL count; a void keeps BOTH original + VOID_REVERSAL,
// so net balances are zero after a void (GL void model A).
async function accountBalance(code: string): Promise<number> {
  const lines = await prisma.journalLine.findMany({
    where: { account: { tenantId: TENANT, code }, journalEntry: { voidAt: null } },
    select: { debit: true, credit: true },
  });
  return round(lines.reduce((s, l) => s + Number(l.debit) - Number(l.credit), 0));
}

async function journalLines(refType: string, reference: string): Promise<any[]> {
  const je = await prisma.journalEntry.findFirst({
    where: { tenantId: TENANT, refType: refType as any, reference, voidAt: null },
    include: { lines: { include: { account: true } } },
  });
  return (je as any)?.lines ?? [];
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
  await prisma.purchase.deleteMany({ where: { tenantId: TENANT } });
  await prisma.inventorySupplyItem.deleteMany({ where: { tenantId: TENANT } });
  await prisma.supplier.deleteMany({ where: { tenantId: TENANT } });
  await prisma.product.deleteMany({ where: { tenantId: TENANT } });
  await prisma.customer.deleteMany({ where: { tenantId: TENANT } });
  await prisma.user.deleteMany({ where: { id: USER } });
  await prisma.tenant.deleteMany({ where: { id: TENANT } });
}

suite("Phase 2F.1A — Finance Core Accounting Correctness", () => {
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
      create: { id: TENANT, code: "T2F1A", name: "2F1A Tenant", subdomain: "t2f1a" },
      update: {},
    });
    await prisma.user.upsert({
      where: { id: USER },
      create: { id: USER, email: "t2f1a@example.com", name: "2F1A User", tenantId: TENANT, role: "OWNER" },
      update: {},
    });
    const customer = await prisma.customer.create({ data: { tenantId: TENANT, code: "CUST-2F1A", name: "Buyer" } });
    customerId = customer.id;

    const fg = await prisma.product.create({
      data: { tenantId: TENANT, code: "PROD-FG", name: "FG", type: "FINISHED_GOODS", price: 700_000, stockUnit: 100, lastHpp: 30000, isActive: true },
    });
    fgProduct = fg.id;
    const fg2 = await prisma.product.create({
      data: { tenantId: TENANT, code: "PROD-FG2", name: "FG2", type: "FINISHED_GOODS", price: 300_000, stockUnit: 100, lastHpp: 10000, isActive: true },
    });
    fgProduct2 = fg2.id;

    const supplier = await prisma.supplier.create({ data: { tenantId: TENANT, code: "SUP-2F1A", name: "Supplier" } });
    supplierId = supplier.id;
    const supplyItem = await prisma.inventorySupplyItem.create({
      data: { tenantId: TENANT, code: "SI-2F1A", name: "Beans", category: "PACKAGING", baseUnit: "KG", costPerUnit: 1000, isActive: true },
    });
    supplyItemId = supplyItem.id;
  });

  afterAll(async () => {
    await cleanup();
    await prisma.$disconnect();
  });

  // ---------------------------------------------------------------- F1
  describe("F1 — embedded receipt-time SupplierPayment", () => {
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

    async function embeddedOf(purchaseId: string) {
      return prisma.supplierPayment.findFirst({ where: { purchaseId } });
    }

    it("1. Purchase 10m / initial paid 4m posts Inventory +10m, Cash -4m, AP +6m", async () => {
      const id = await createPurchase(4_000_000);
      expect(round(await accountBalance("1-1230"))).toBe(10_000_000);
      expect(round(await accountBalance("1-1000"))).toBe(-4_000_000);
      expect(round(await accountBalance("2-1000"))).toBe(-6_000_000);
      expect(await journalCount("PURCHASE", id)).toBe(1);
    });

    it("2. Purchase void reverses all balances exactly", async () => {
      const id = await createPurchase(4_000_000);
      const vp = await voidPurchase(id, "salah terima");
      expect(vp.success).toBe(true);
      expect(Math.abs(await accountBalance("1-1230"))).toBeLessThan(0.01);
      expect(Math.abs(await accountBalance("1-1000"))).toBeLessThan(0.01);
      expect(Math.abs(await accountBalance("2-1000"))).toBeLessThan(0.01);
    });

    it("3. Embedded SupplierPayment is soft-voided as part of Purchase void", async () => {
      const id = await createPurchase(4_000_000);
      await voidPurchase(id, "salah terima");
      const embedded = await embeddedOf(id);
      expect(embedded).toBeTruthy();
      expect(embedded!.voidAt).not.toBeNull();
      expect(await journalCount("SUPPLIER_PAYMENT", embedded!.id)).toBe(0);
    });

    it("4. Standalone void of embedded SupplierPayment is rejected", async () => {
      const id = await createPurchase(4_000_000);
      const embedded = await embeddedOf(id);
      const res = await voidSupplierPayment(embedded!.id, "coba mandiri");
      expect(res.success).toBe(false);
      expect(res.error).toContain("tidak dapat dibatalkan secara mandiri");
    });

    it("5. Normal later SupplierPayment still posts and voids correctly", async () => {
      const id = await createPurchase(4_000_000);
      const rp = await recordSupplierPayment({ purchaseId: id, amount: 2_000_000, method: "TRANSFER", paidAt: "2026-08-15" });
      expect(rp.success).toBe(true);
      expect(round(await accountBalance("1-1000"))).toBe(-6_000_000);
      expect(round(await accountBalance("2-1000"))).toBe(-4_000_000);

      const later = await prisma.supplierPayment.findFirst({ where: { purchaseId: id, voidAt: null }, orderBy: { createdAt: "desc" } });
      const vrp = await voidSupplierPayment(later!.id, "batalkan bayar");
      expect(vrp.success).toBe(true);
      expect(round(await accountBalance("1-1000"))).toBe(-4_000_000);
      expect(round(await accountBalance("2-1000"))).toBe(-6_000_000);
      expect(await journalCount("SUPPLIER_PAYMENT", later!.id)).toBe(1);
    });

    it("6. No duplicate Cash/AP posting for purchase (embedded has no journal)", async () => {
      const id = await createPurchase(4_000_000);
      expect(await journalCount("PURCHASE", id)).toBe(1);
      const embedded = await embeddedOf(id);
      expect(await journalCount("SUPPLIER_PAYMENT", embedded!.id)).toBe(0);
    });
  });

  // ---------------------------------------------------------------- R1
  describe("R1 — return uses the sale's booked accounts & historical HPP", () => {
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

    async function returnLines(invoiceId: string, items: Array<{ productId: string; quantity: number }>) {
      return createCreditNote({
        invoiceId,
        reason: "retur barang",
        items: items.map((item) => ({ productId: item.productId, quantity: item.quantity, unitDiscount: 0 })),
      });
    }

    it("7. FG cash sale posts INVOICE journal and is delivered immediately", async () => {
      const id = await walkInSale([{ productId: fgProduct, quantity: 1 }]);
      const inv = await prisma.invoice.findUnique({ where: { id } });
      expect(inv!.fulfillmentStatus).toBe("DELIVERED");
      expect(await journalCount("INVOICE", id)).toBe(1);
    });

    it("8. Return mirrors the sale's booked COGS/inventory accounts with historical HPP", async () => {
      const id = await walkInSale([{ productId: fgProduct, quantity: 1 }]);
      // Mutate current product cost AFTER the sale — the return must still use
      // the immutable invoice HPP snapshot, never the mutable current cost.
      await prisma.product.update({ where: { id: fgProduct }, data: { lastHpp: 999_999 } });

      const cn = await returnLines(id, [{ productId: fgProduct, quantity: 1 }]);
      expect(cn.success).toBe(true);
      if (!cn.success) return;

      const creditNote = await prisma.creditNote.findFirst({ where: { invoiceId: id }, orderBy: { createdAt: "desc" } });
      const saleLines = await journalLines("INVOICE", id);
      const cnLines = await journalLines("CREDIT_NOTE", creditNote!.id);

      const saleCogs = saleLines.find((l) => l.account.type === "EXPENSE" && l.account.code.startsWith("5-1"))!.account.code;
      const saleInv = saleLines.find((l) => l.account.type === "ASSET" && l.account.code.startsWith("1-12"))!.account.code;
      const cnCogs = cnLines.find((l) => l.account.type === "EXPENSE" && l.account.code.startsWith("5-1"))!.account.code;
      const cnInv = cnLines.find((l) => l.account.type === "ASSET" && l.account.code.startsWith("1-12"))!.account.code;
      expect(saleCogs).toBe("5-1000");
      expect(saleInv).toBe("1-1220");
      expect(cnCogs).toBe(saleCogs);
      expect(cnInv).toBe(saleInv);
      // historical HPP snapshot (30,000) — not the mutated 999,999
      expect(Number(cnLines.find((l) => l.account.code === "5-1000")!.credit)).toBe(30_000);
      expect(Number(cnLines.find((l) => l.account.code === "1-1220")!.debit)).toBe(30_000);
    });

    it("9. Return of one line of a multi-line FG invoice mirrors the sale accounts", async () => {
      const id = await walkInSale([
        { productId: fgProduct, quantity: 1 },
        { productId: fgProduct2, quantity: 1 },
      ]);
      const cn = await returnLines(id, [{ productId: fgProduct2, quantity: 1 }]);
      expect(cn.success).toBe(true);
      if (!cn.success) return;

      const creditNote = await prisma.creditNote.findFirst({ where: { invoiceId: id }, orderBy: { createdAt: "desc" } });
      const saleLines = await journalLines("INVOICE", id);
      const cnLines = await journalLines("CREDIT_NOTE", creditNote!.id);
      const saleCogs = saleLines.find((l) => l.account.type === "EXPENSE" && l.account.code.startsWith("5-1"))!.account.code;
      const saleInv = saleLines.find((l) => l.account.type === "ASSET" && l.account.code.startsWith("1-12"))!.account.code;
      const cnCogs = cnLines.find((l) => l.account.type === "EXPENSE" && l.account.code.startsWith("5-1"))!.account.code;
      const cnInv = cnLines.find((l) => l.account.type === "ASSET" && l.account.code.startsWith("1-12"))!.account.code;
      expect(cnCogs).toBe(saleCogs);
      expect(cnInv).toBe(saleInv);
      expect(cnCogs).toBe("5-1000");
      expect(cnInv).toBe("1-1220");
      // only the returned line's historical HPP is reversed (10,000)
      expect(Number(cnLines.find((l) => l.account.code === "5-1000")!.credit)).toBe(10_000);
    });

    it("10. Return of all lines of a multi-line FG invoice mirrors the sale accounts", async () => {
      const id = await walkInSale([
        { productId: fgProduct, quantity: 1 },
        { productId: fgProduct2, quantity: 2 },
      ]);
      const cn = await returnLines(id, [
        { productId: fgProduct, quantity: 1 },
        { productId: fgProduct2, quantity: 2 },
      ]);
      expect(cn.success).toBe(true);
      if (!cn.success) return;

      const creditNote = await prisma.creditNote.findFirst({ where: { invoiceId: id }, orderBy: { createdAt: "desc" } });
      const saleLines = await journalLines("INVOICE", id);
      const cnLines = await journalLines("CREDIT_NOTE", creditNote!.id);
      const saleCogs = saleLines.find((l) => l.account.type === "EXPENSE" && l.account.code.startsWith("5-1"))!.account.code;
      const saleInv = saleLines.find((l) => l.account.type === "ASSET" && l.account.code.startsWith("1-12"))!.account.code;
      const cnCogs = cnLines.find((l) => l.account.type === "EXPENSE" && l.account.code.startsWith("5-1"))!.account.code;
      const cnInv = cnLines.find((l) => l.account.type === "ASSET" && l.account.code.startsWith("1-12"))!.account.code;
      expect(cnCogs).toBe(saleCogs);
      expect(cnInv).toBe(saleInv);
      // both lines' historical HPP reversed: 30,000 + 2 × 10,000 = 50,000
      expect(Number(cnLines.find((l) => l.account.code === "5-1000")!.credit)).toBe(50_000);
    });

    it("11. Return restores inventory via RETURN_FG_IN ledger at invoice HPP, stock stays unplaced", async () => {
      const id = await walkInSale([{ productId: fgProduct, quantity: 1 }]);
      const cn = await returnLines(id, [{ productId: fgProduct, quantity: 1 }]);
      expect(cn.success).toBe(true);
      if (!cn.success) return;

      const creditNote = await prisma.creditNote.findFirst({ where: { invoiceId: id }, orderBy: { createdAt: "desc" } });
      const ledger = await prisma.inventoryLedger.findFirst({
        where: { tenantId: TENANT, refId: creditNote!.id, refType: "RETURN_FG_IN", entryType: "IN" },
      });
      expect(ledger).toBeTruthy();
      expect(Number(ledger!.incomingPrice)).toBe(30_000);
      expect(Number(ledger!.quantityUnit)).toBe(1);
      // returned stock remains UNPLACED per accepted policy
      const placements = await prisma.lotPlacement.count({ where: { tenantId: TENANT } });
      expect(placements).toBe(0);
    });
  });

  // ---------------------------------------------------------------- R3
  describe("R3 — partial-paid return accounting (B2B credit, legitimately delivered)", () => {
    // Invoice total = 1,000,000 = fgProduct (700k) + fgProduct2 (300k).
    async function b2bCreditInvoice(): Promise<string> {
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
      if (!res.success) throw new Error(res.error);
      const ship = await updateInvoiceShipping(res.invoiceId, { fulfillmentStatus: "DELIVERED" });
      if (!ship.success) throw new Error(ship.error);
      return res.invoiceId;
    }

    async function returnFull(invoiceId: string) {
      return createCreditNote({
        invoiceId,
        reason: "retur penuh",
        items: [
          { productId: fgProduct, quantity: 1, unitDiscount: 0 },
          { productId: fgProduct2, quantity: 1, unitDiscount: 0 },
        ],
      });
    }

    it("12. Invoice 1m, paid 400k, full return → AR 0, Refund Payable 400k, cash unchanged", async () => {
      const id = await b2bCreditInvoice();
      const pay = await recordPayment({ invoiceId: id, amount: 400_000, method: "CASH", paidAt: "2026-08-14" });
      expect(pay.success).toBe(true);
      expect(round(await accountBalance("1-1100"))).toBe(600_000);
      expect(round(await accountBalance("1-1000"))).toBe(400_000);

      const r = await returnFull(id);
      expect(r.success).toBe(true);
      if (!r.success) return;
      expect(round(await accountBalance("1-1100"))).toBe(0);
      expect(round(await accountBalance("2-1400"))).toBe(-400_000);
      expect(round(await accountBalance("1-1000"))).toBe(400_000);
    });

    it("13. Return 300k (paid 400k) → AR 300k remaining, Refund Payable 0", async () => {
      const id = await b2bCreditInvoice();
      await recordPayment({ invoiceId: id, amount: 400_000, method: "CASH", paidAt: "2026-08-14" });
      const r = await createCreditNote({
        invoiceId: id,
        reason: "retur 300",
        items: [{ productId: fgProduct2, quantity: 1, unitDiscount: 0 }],
      });
      expect(r.success).toBe(true);
      if (!r.success) return;
      expect(round(await accountBalance("1-1100"))).toBe(300_000);
      expect(round(await accountBalance("2-1400"))).toBe(0);
      expect(round(await accountBalance("1-1000"))).toBe(400_000);
    });

    it("14. Return 700k (paid 400k) → AR 0, Refund Payable 100k", async () => {
      const id = await b2bCreditInvoice();
      await recordPayment({ invoiceId: id, amount: 400_000, method: "CASH", paidAt: "2026-08-14" });
      const r = await createCreditNote({
        invoiceId: id,
        reason: "retur 700",
        items: [{ productId: fgProduct, quantity: 1, unitDiscount: 0 }],
      });
      expect(r.success).toBe(true);
      if (!r.success) return;
      expect(round(await accountBalance("1-1100"))).toBe(0);
      expect(round(await accountBalance("2-1400"))).toBe(-100_000);
      expect(round(await accountBalance("1-1000"))).toBe(400_000);
    });

    it("15. Fully unpaid but delivered → AR reduction only, no Refund Payable", async () => {
      const id = await b2bCreditInvoice();
      expect(round(await accountBalance("1-1100"))).toBe(1_000_000);
      const r = await returnFull(id);
      expect(r.success).toBe(true);
      if (!r.success) return;
      expect(round(await accountBalance("1-1100"))).toBe(0);
      expect(round(await accountBalance("2-1400"))).toBe(0);
      expect(round(await accountBalance("1-1000"))).toBe(0);
    });

    it("16. Fully paid + full return → AR never negative, Refund Payable full, cash stays received", async () => {
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
        status: "PAID",
        paymentMethod: "CASH",
        salesChannel: "WALK_IN",
      });
      expect(res.success).toBe(true);
      if (!res.success) return;
      const inv = await prisma.invoice.findUnique({ where: { id: res.invoiceId } });
      expect(inv!.fulfillmentStatus).toBe("DELIVERED");
      expect(round(await accountBalance("1-1100"))).toBe(0);
      expect(round(await accountBalance("1-1000"))).toBe(1_000_000);

      const r = await returnFull(res.invoiceId);
      expect(r.success).toBe(true);
      if (!r.success) return;
      expect(round(await accountBalance("1-1100"))).toBe(0);
      expect(round(await accountBalance("2-1400"))).toBe(-1_000_000);
      // cash received at sale stays in the business; the return does not move cash
      expect(round(await accountBalance("1-1000"))).toBe(1_000_000);
    });

    it("17. Revenue reversal + historical COGS reversal on return", async () => {
      const id = await b2bCreditInvoice();
      await recordPayment({ invoiceId: id, amount: 400_000, method: "CASH", paidAt: "2026-08-14" });
      await prisma.product.update({ where: { id: fgProduct }, data: { lastHpp: 777_777 } });

      const r = await createCreditNote({
        invoiceId: id,
        reason: "retur fg",
        items: [{ productId: fgProduct, quantity: 1, unitDiscount: 0 }],
      });
      expect(r.success).toBe(true);
      if (!r.success) return;

      const creditNote = await prisma.creditNote.findFirst({ where: { invoiceId: id }, orderBy: { createdAt: "desc" } });
      const cnLines = await journalLines("CREDIT_NOTE", creditNote!.id);
      const revenueLine = cnLines.find((l) => l.account.code === "4-1000")!;
      const invLine = cnLines.find((l) => l.account.type === "ASSET" && l.account.code.startsWith("1-12"))!;
      const cogsLine = cnLines.find((l) => l.account.type === "EXPENSE" && l.account.code.startsWith("5-1"))!;
      expect(Number(revenueLine.debit)).toBe(700_000);
      expect(invLine.account.code).toBe("1-1220");
      expect(cogsLine.account.code).toBe("5-1000");
      // historical FG HPP snapshot (30,000), not the mutated 777,777
      expect(Number(invLine.debit)).toBe(30_000);
      expect(Number(cogsLine.credit)).toBe(30_000);
    });
  });
});