import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(__dirname, "../../.env.local") });

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL ?? "" });
const prisma = new PrismaClient({ adapter });

async function generateJournalCode(
  tenantId: string,
  date: Date,
): Promise<string> {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const prefix = `JE-${year}-${month}-`;
  const last = await prisma.journalEntry.findFirst({
    where: { tenantId, code: { startsWith: prefix } },
    orderBy: { code: "desc" },
    select: { code: true },
  });
  const seq = last ? (parseInt(last.code.split("-").pop() ?? "0", 10) + 1) : 1;
  return `${prefix}${String(seq).padStart(3, "0")}`;
}

async function getAccountId(tenantId: string, code: string) {
  const acct = await prisma.account.findUnique({
    where: { tenantId_code: { tenantId, code } },
    select: { id: true },
  });
  return acct?.id ?? null;
}

async function main() {
  console.log("Backfilling journal entries for existing transactions...\n");

  const tenants = await prisma.tenant.findMany({ select: { id: true, code: true } });
  let totalPosted = 0;

  for (const tenant of tenants) {
    console.log(`\n── ${tenant.code} ──`);

    // ── 1. Invoices (sales) ──
    const invoices = await prisma.invoice.findMany({
      where: {
        tenantId: tenant.id,
        voidAt: null,
        status: { in: ["ISSUED", "PAID", "PARTIAL"] },
      },
      include: { customer: { select: { name: true } } },
    });

    for (const inv of invoices) {
      const existing = await prisma.journalEntry.findFirst({
        where: { tenantId: tenant.id, reference: inv.id, refType: "INVOICE" },
      });
      if (existing) continue;

      const grandTotal = Number(inv.grandTotal);
      const paidAmount = Number(inv.paidAmount);
      if (grandTotal <= 0) continue;

      const remaining = grandTotal - paidAmount;
      const lines: { accountCode: string; debit: number; credit: number }[] = [];
      if (paidAmount > 0) lines.push({ accountCode: "1-1000", debit: paidAmount, credit: 0 });
      if (remaining > 0) lines.push({ accountCode: "1-1100", debit: remaining, credit: 0 });
      lines.push({ accountCode: "4-1000", debit: 0, credit: grandTotal });

      const accountIds = await Promise.all(lines.map((l) => getAccountId(tenant.id, l.accountCode)));
      if (accountIds.some((id) => !id)) {
        console.log(`  ⚠  Invoice ${inv.code}: akun tidak ditemukan, skip`);
        continue;
      }

      const code = await generateJournalCode(tenant.id, inv.issuedAt);
      await prisma.journalEntry.create({
        data: {
          code,
          date: inv.issuedAt,
          description: `Penjualan ke ${inv.customer?.name ?? "Customer"} (${inv.code})`,
          reference: inv.id,
          refType: "INVOICE",
          tenantId: tenant.id,
          createdById: inv.createdById,
          lines: {
            create: lines.map((l, i) => ({
              sideId: i,
              debit: l.debit,
              credit: l.credit,
              accountId: accountIds[i]!,
            })),
          },
        },
      });
      console.log(`  ✅ INV ${inv.code}: ${code}`);
      totalPosted++;
    }

    // ── 2. Customer Payments ──
    const payments = await prisma.payment.findMany({
      where: { voidAt: null, tenantId: tenant.id },
      include: { invoice: { include: { customer: { select: { name: true } } } } },
    });

    for (const pay of payments) {
      const existing = await prisma.journalEntry.findFirst({
        where: { tenantId: tenant.id, reference: pay.id, refType: "PAYMENT" },
      });
      if (existing) continue;

      const cashId = await getAccountId(tenant.id, "1-1000");
      const receivId = await getAccountId(tenant.id, "1-1100");
      if (!cashId || !receivId) {
        console.log(`  ⚠  Payment ${pay.code}: akun tidak ditemukan, skip`);
        continue;
      }

      const code = await generateJournalCode(tenant.id, pay.paidAt);
      await prisma.journalEntry.create({
        data: {
          code,
          date: pay.paidAt,
          description: `Pembayaran dari ${pay.invoice?.customer?.name ?? "Customer"} — ${pay.invoice?.code}`,
          reference: pay.id,
          refType: "PAYMENT",
          tenantId: tenant.id,
          createdById: pay.createdById,
          lines: {
            create: [
              { sideId: 0, debit: Number(pay.amount), credit: 0, accountId: cashId },
              { sideId: 1, debit: 0, credit: Number(pay.amount), accountId: receivId },
            ],
          },
        },
      });
      console.log(`  ✅ PAY ${pay.code}: ${code}`);
      totalPosted++;
    }

    // ── 3. Expenses ──
    const expenseAccountMap: Record<string, string> = {
      GAJI: "5-2000", UTILITAS: "5-2020", OPERASIONAL: "5-2030",
      SEWA: "5-2010", PEMASARAN: "5-2050", LAINNYA: "5-2060",
    };

    const expenses = await prisma.expense.findMany({
      where: { voidAt: null, tenantId: tenant.id },
    });

    for (const exp of expenses) {
      const existing = await prisma.journalEntry.findFirst({
        where: { tenantId: tenant.id, reference: exp.id, refType: "EXPENSE" },
      });
      if (existing) continue;

      const amount = Number(exp.amount);
      if (amount <= 0) continue;

      const expenseAcctCode = expenseAccountMap[exp.category] ?? "5-2060";
      const expenseAcctId = await getAccountId(tenant.id, expenseAcctCode);
      const cashId = await getAccountId(tenant.id, "1-1000");

      if (!expenseAcctId || !cashId) {
        console.log(`  ⚠  Expense ${exp.id}: akun tidak ditemukan, skip`);
        continue;
      }

      const code = await generateJournalCode(tenant.id, exp.date);
      await prisma.journalEntry.create({
        data: {
          code,
          date: exp.date,
          description: `Beban: ${exp.description ?? exp.category}`,
          reference: exp.id,
          refType: "EXPENSE",
          tenantId: tenant.id,
          createdById: exp.createdById,
          lines: {
            create: [
              { sideId: 0, debit: amount, credit: 0, accountId: expenseAcctId },
              { sideId: 1, debit: 0, credit: amount, accountId: cashId },
            ],
          },
        },
      });
      console.log(`  ✅ EXP ${exp.id.slice(0, 8)}: ${code}`);
      totalPosted++;
    }

    // ── 4. Supplier Payments ──
    const supplierPayments = await prisma.supplierPayment.findMany({
      where: { voidAt: null, tenantId: tenant.id },
      include: { purchase: { include: { supplier: { select: { name: true } } } } },
    });

    for (const sp of supplierPayments) {
      const existing = await prisma.journalEntry.findFirst({
        where: { tenantId: tenant.id, reference: sp.id, refType: "SUPPLIER_PAYMENT" },
      });
      if (existing) continue;

      const payableId = await getAccountId(tenant.id, "2-1000");
      const cashId = await getAccountId(tenant.id, "1-1000");
      if (!payableId || !cashId) {
        console.log(`  ⚠  SupplierPayment ${sp.code}: akun tidak ditemukan, skip`);
        continue;
      }

      const code = await generateJournalCode(tenant.id, sp.paidAt);
      await prisma.journalEntry.create({
        data: {
          code,
          date: sp.paidAt,
          description: `Pembayaran ke ${sp.purchase?.supplier?.name ?? "Supplier"} — ${sp.purchase?.code}`,
          reference: sp.id,
          refType: "SUPPLIER_PAYMENT",
          tenantId: tenant.id,
          createdById: sp.createdById,
          lines: {
            create: [
              { sideId: 0, debit: Number(sp.amount), credit: 0, accountId: payableId },
              { sideId: 1, debit: 0, credit: Number(sp.amount), accountId: cashId },
            ],
          },
        },
      });
      console.log(`  ✅ SPAY ${sp.code}: ${code}`);
      totalPosted++;
    }

    // ── 5. Purchases ──
    const purchases = await prisma.purchase.findMany({
      where: { voidAt: null, tenantId: tenant.id, status: "COMPLETED" },
      include: { supplier: { select: { name: true } } },
    });

    for (const pur of purchases) {
      const existing = await prisma.journalEntry.findFirst({
        where: { tenantId: tenant.id, reference: pur.id, refType: "PURCHASE" },
      });
      if (existing) continue;

      const totalCost = Number(pur.totalCost);
      const paidAmount = Number(pur.paidAmount);
      if (totalCost <= 0) continue;

      const inventoryAccount =
        pur.type === "GREEN_BEAN" ? "1-1200" : pur.type === "PACKAGING" ? "1-1230" : null;
      if (!inventoryAccount) {
        console.log(`  ⚠  Purchase ${pur.code}: tipe tidak dikenali, skip`);
        continue;
      }

      const lines: { accountCode: string; debit: number; credit: number }[] = [
        { accountCode: inventoryAccount, debit: totalCost, credit: 0 },
      ];
      if (paidAmount > 0) {
        lines.push({ accountCode: "1-1000", debit: 0, credit: paidAmount });
      }
      const remaining = totalCost - paidAmount;
      if (remaining > 0.01) {
        lines.push({ accountCode: "2-1000", debit: 0, credit: remaining });
      }

      const accountIds = await Promise.all(lines.map((l) => getAccountId(tenant.id, l.accountCode)));
      if (accountIds.some((id) => !id)) {
        console.log(`  ⚠  Purchase ${pur.code}: akun tidak ditemukan, skip`);
        continue;
      }

      const code = await generateJournalCode(tenant.id, pur.receivedAt ?? pur.createdAt);
      await prisma.journalEntry.create({
        data: {
          code,
          date: pur.receivedAt ?? pur.createdAt,
          description: `Pembelian ${pur.type === "GREEN_BEAN" ? "Green Bean" : "Kemasan"} dari ${pur.supplier?.name ?? "Supplier"} — ${pur.code}`,
          reference: pur.id,
          refType: "PURCHASE",
          tenantId: tenant.id,
          createdById: pur.createdById,
          lines: {
            create: lines.map((l, i) => ({
              sideId: i,
              debit: l.debit,
              credit: l.credit,
              accountId: accountIds[i]!,
            })),
          },
        },
      });
      console.log(`  ✅ PUR ${pur.code}: ${code}`);
      totalPosted++;
    }

    // ── 6. Stock Adjustments ──
    const adjustments = await prisma.inventoryLedger.findMany({
      where: {
        tenantId: tenant.id,
        refType: { in: ["ADJUSTMENT_IN", "ADJUSTMENT_OUT"] },
      },
      select: {
        id: true,
        refType: true,
        refId: true,
        entryType: true,
        quantityKg: true,
        quantityUnit: true,
        productId: true,
        packagingId: true,
        createdAt: true,
        createdById: true,
      },
    });

    const adjustmentAccountMap: Record<string, string> = {
      GREEN_BEAN: "1-1200",
      ROASTED_BEAN: "1-1210",
      FINISHED_GOODS: "1-1220",
      PACKAGING: "1-1230",
    };

    for (const adj of adjustments) {
      const existing = await prisma.journalEntry.findFirst({
        where: { tenantId: tenant.id, reference: adj.refId, refType: "ADJUSTMENT" },
      });
      if (existing) continue;

      const qty = (adj.quantityKg ?? adj.quantityUnit ?? 0) as number;
      if (qty <= 0) continue;

      let productType: keyof typeof adjustmentAccountMap = "PACKAGING";
      let unitCost = 0;

      if (adj.productId) {
        const product = await prisma.product.findUnique({
          where: { id: adj.productId },
          select: { type: true, avgCostPerKg: true },
        });
        if (product) {
          productType = product.type as keyof typeof adjustmentAccountMap;
          unitCost = Number(product.avgCostPerKg ?? 0);
        }
      } else if (adj.packagingId) {
        const packaging = await prisma.packaging.findUnique({
          where: { id: adj.packagingId },
          select: { avgCostPerUnit: true },
        });
        unitCost = Number(packaging?.avgCostPerUnit ?? 0);
      }

      if (unitCost <= 0) continue;

      const inventoryAccount = adjustmentAccountMap[productType] ?? "1-1230";
      const value = qty * unitCost;

      const lines: { accountCode: string; debit: number; credit: number }[] = [];
      if (adj.entryType === "IN") {
        lines.push({ accountCode: inventoryAccount, debit: value, credit: 0 });
        lines.push({ accountCode: "5-1040", debit: 0, credit: value });
      } else {
        lines.push({ accountCode: "5-1040", debit: value, credit: 0 });
        lines.push({ accountCode: inventoryAccount, debit: 0, credit: value });
      }

      const accountIds = await Promise.all(lines.map((l) => getAccountId(tenant.id, l.accountCode)));
      if (accountIds.some((id) => !id)) {
        console.log(`  ⚠  Adjustment ${adj.refId}: akun tidak ditemukan, skip`);
        continue;
      }

      const code = await generateJournalCode(tenant.id, adj.createdAt);
      await prisma.journalEntry.create({
        data: {
          code,
          date: adj.createdAt,
          description: `Penyesuaian stok ${productType} — ${adj.refId}`,
          reference: adj.refId,
          refType: "ADJUSTMENT",
          tenantId: tenant.id,
          createdById: adj.createdById,
          lines: {
            create: lines.map((l, i) => ({
              sideId: i,
              debit: l.debit,
              credit: l.credit,
              accountId: accountIds[i]!,
            })),
          },
        },
      });
      console.log(`  ✅ ADJ ${adj.refId}: ${code}`);
      totalPosted++;
    }

    // ── 7. Sample Usages ──
    const samples = await prisma.sampleUsage.findMany({
      where: { voidAt: null, tenantId: tenant.id, status: "COMPLETED" },
      include: {
        components: true,
      },
    });

    for (const sample of samples) {
      const existing = await prisma.journalEntry.findFirst({
        where: { tenantId: tenant.id, reference: sample.code, refType: "SAMPLE_USAGE" },
      });
      if (existing) continue;

      const totalCost = Number(sample.totalCost);
      if (totalCost <= 0) continue;

      const distribution: Record<string, number> = {};
      for (const comp of sample.components) {
        let account = "1-1230";
        if (comp.productId) {
          const product = await prisma.product.findUnique({
            where: { id: comp.productId },
            select: { type: true },
          });
          if (product) {
            account =
              product.type === "GREEN_BEAN"
                ? "1-1200"
                : product.type === "ROASTED_BEAN"
                  ? "1-1210"
                  : product.type === "FINISHED_GOODS"
                    ? "1-1220"
                    : "1-1230";
          }
        }
        const compCost = Number(comp.totalCost);
        distribution[account] = (distribution[account] || 0) + compCost;
      }

      const lines: { accountCode: string; debit: number; credit: number }[] = [
        { accountCode: "5-2050", debit: totalCost, credit: 0 },
      ];
      for (const [account, amount] of Object.entries(distribution)) {
        lines.push({ accountCode: account, debit: 0, credit: amount });
      }

      const accountIds = await Promise.all(lines.map((l) => getAccountId(tenant.id, l.accountCode)));
      if (accountIds.some((id) => !id)) {
        console.log(`  ⚠  Sample ${sample.code}: akun tidak ditemukan, skip`);
        continue;
      }

      const code = await generateJournalCode(tenant.id, sample.givenAt);
      await prisma.journalEntry.create({
        data: {
          code,
          date: sample.givenAt,
          description: `Sample / Promosi — ${sample.code}`,
          reference: sample.code,
          refType: "SAMPLE_USAGE",
          tenantId: tenant.id,
          createdById: sample.createdById,
          lines: {
            create: lines.map((l, i) => ({
              sideId: i,
              debit: l.debit,
              credit: l.credit,
              accountId: accountIds[i]!,
            })),
          },
        },
      });
      console.log(`  ✅ SMP ${sample.code}: ${code}`);
      totalPosted++;
    }
  }

  console.log(`\n✅ Backfill selesai: ${totalPosted} jurnal diposting`);
}

main()
  .catch((e) => {
    console.error("Gagal backfill:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
