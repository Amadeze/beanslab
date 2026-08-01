import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL or DIRECT_URL is required.");
}

const apply = process.argv.includes("--apply");
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

async function generateJournalCode(tenantId: string, date: Date): Promise<string> {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const prefix = `JE-${year}-${month}-`;
  const last = await prisma.$queryRaw<{ code: string }[]>`
    SELECT code FROM journal_entries
    WHERE "tenantId" = ${tenantId} AND code LIKE ${prefix + "%"}
      AND code ~ '^JE-[0-9]{4}-[0-9]{2}-[0-9]+$'
    ORDER BY code DESC
    LIMIT 1
  `;
  const seq = last.length > 0 ? parseInt(last[0].code.split("-").pop() ?? "0", 10) + 1 : 1;
  return `${prefix}${String(seq).padStart(3, "0")}`;
}

async function getAccountId(tenantId: string, code: string) {
  const acct = await prisma.account.findUnique({
    where: { tenantId_code: { tenantId, code } },
    select: { id: true },
  });
  return acct?.id ?? null;
}

const tenantFallbackUserId = new Map<string, string | null>();
async function fallbackUserId(tenantId: string): Promise<string | null> {
  if (tenantFallbackUserId.has(tenantId)) return tenantFallbackUserId.get(tenantId) ?? null;
  const user = await prisma.user.findFirst({
    where: { tenantId },
    select: { id: true },
  });
  tenantFallbackUserId.set(tenantId, user?.id ?? null);
  return user?.id ?? null;
}

type Line = { accountCode: string; debit: number; credit: number };

async function ensureJournal(
  tenantId: string,
  reference: string,
  refType: string,
  date: Date,
  description: string,
  createdById: string | null,
  lines: Line[],
  log: (msg: string) => void,
): Promise<boolean> {
  const existing = await prisma.journalEntry.findFirst({
    where: { tenantId, reference, refType: refType as any },
  });
  if (existing) return false;

  const filtered = lines.filter((l) => Math.abs(l.debit) > 0.005 || Math.abs(l.credit) > 0.005);
  if (filtered.length === 0) return false;

  const accountIds = await Promise.all(filtered.map((l) => getAccountId(tenantId, l.accountCode)));
  if (accountIds.some((id) => !id)) {
    log(`  ⚠  Akun tidak lengkap untuk ${refType}/${reference}, skip`);
    return false;
  }

  if (!apply) {
    log(`  · [dry-run] siap posting ${refType} ${reference}`);
    return true;
  }

  const code = await generateJournalCode(tenantId, date);
  const effectiveUserId = createdById ?? (await fallbackUserId(tenantId));
  if (!effectiveUserId) {
    log(`  ⚠  Tidak ada user untuk ${refType}/${reference}, skip`);
    return false;
  }
  await prisma.journalEntry.create({
    data: {
      code,
      date,
      description,
      reference,
      refType: refType as any,
      tenantId,
      createdById: effectiveUserId,
      lines: {
        create: filtered.map((l, i) => ({
          sideId: i,
          debit: l.debit,
          credit: l.credit,
          accountId: accountIds[i]!,
        })),
      },
    },
  });
  log(`  ✅ ${refType} ${reference}: ${code}`);
  return true;
}

function getInventoryAccountCode(items: Array<{ productType?: string }>): string {
  const hasPackaging = items.some((item) => item.productType === "PACKAGING");
  const hasGreenBean = items.some((item) => item.productType === "GREEN_BEAN");
  const hasRoastedBean = items.some((item) => item.productType === "ROASTED_BEAN");
  const hasFinishedGoods = items.some((item) => item.productType === "FINISHED_GOODS");

  if (hasPackaging && !hasGreenBean && !hasRoastedBean && !hasFinishedGoods) return "1-1230";
  if (hasGreenBean && !hasRoastedBean && !hasFinishedGoods) return "1-1200";
  if (hasRoastedBean && !hasFinishedGoods) return "1-1210";
  if (hasFinishedGoods) return "1-1220";
  return "1-1220";
}

function getCogsAccountCode(items: Array<{ productType?: string }>): string {
  const hasPackaging = items.some((item) => item.productType === "PACKAGING");
  const hasGreenBean = items.some((item) => item.productType === "GREEN_BEAN");
  const hasRoastedBean = items.some((item) => item.productType === "ROASTED_BEAN");
  const hasFinishedGoods = items.some((item) => item.productType === "FINISHED_GOODS");

  if (hasPackaging && !hasGreenBean && !hasRoastedBean && !hasFinishedGoods) return "5-1020";
  if (hasGreenBean && !hasRoastedBean && !hasFinishedGoods) return "5-1000";
  if (hasRoastedBean && !hasFinishedGoods) return "5-1010";
  if (hasFinishedGoods) return "5-1030";
  return "5-1030";
}

const EXPENSE_ACCOUNT_MAP: Record<string, string> = {
  GAJI: "5-2000",
  UTILITAS: "5-2020",
  OPERASIONAL: "5-2030",
  SEWA: "5-2010",
  PEMASARAN: "5-2050",
  LAINNYA: "5-2060",
};

async function main() {
  console.log(`Repair missing journals (${apply ? "APPLY" : "DRY-RUN — tambahkan --apply untuk menulis"})\n`);
  const tenants = await prisma.tenant.findMany({ select: { id: true, code: true } });
  let posted = 0;

  for (const tenant of tenants) {
    const log = (msg: string) => console.log(msg);
    const tid = tenant.id;

    const existingRefs = async (refType: string) => {
      const rows = await prisma.journalEntry.findMany({
        where: { tenantId: tid, refType: refType as any },
        select: { reference: true },
      });
      return new Set(rows.map((r) => r.reference));
    };

    // ── 1. Invoices (status <> VOID) tanpa jurnal INVOICE ──
    const invoiceRefs = await existingRefs("INVOICE");
    const invoices = await prisma.$queryRaw<{
      id: string; code: string; "customerId": string | null; "grandTotal": number; "paidAmount": number;
      tax: number; "issuedAt": Date; "createdById": string | null; status: string;
      "customerName": string | null;
    }[]>`
      SELECT i.id, i.code, i."customerId", i."grandTotal", i."paidAmount", i.tax, i."issuedAt",
             i."createdById", i.status, c.name AS "customerName"
      FROM invoices i
      LEFT JOIN customers c ON c.id = i."customerId"
      WHERE i."tenantId" = ${tid} AND i.status <> 'VOID'
    `;
    const invoicesToFix = invoices.filter((inv) => !invoiceRefs.has(inv.id));
    for (const inv of invoicesToFix) {
      const grandTotal = Number(inv.grandTotal);
      if (grandTotal <= 0) continue;
      const paidAmount = Number(inv.paidAmount);
      const remaining = grandTotal - paidAmount;
      const tax = Number(inv.tax);
      const lines: Line[] = [];
      if (paidAmount > 0) lines.push({ accountCode: "1-1000", debit: paidAmount, credit: 0 });
      if (remaining > 0) lines.push({ accountCode: "1-1100", debit: remaining, credit: 0 });
      lines.push({ accountCode: "4-1000", debit: 0, credit: grandTotal - tax });
      if (tax > 0) lines.push({ accountCode: "2-1100", debit: 0, credit: tax });
      const ok = await ensureJournal(
        tid, inv.id, "INVOICE", inv.issuedAt,
        `Penjualan ke ${inv.customerName ?? "Customer"} (${inv.code})`,
        inv.createdById, lines, log,
      );
      if (ok) posted++;
    }

    // ── 2. Customer payments ──
    const paymentRefs = await existingRefs("PAYMENT");
    const payments = await prisma.$queryRaw<{
      id: string; amount: number; "paidAt": Date; "createdById": string | null;
      "invoiceId": string | null; code: string | null; "customerName": string | null;
    }[]>`
      SELECT p.id, p.amount, p."paidAt", p."createdById", p."invoiceId",
             i.code, c.name AS "customerName"
      FROM payments p
      LEFT JOIN invoices i ON i.id = p."invoiceId"
      LEFT JOIN customers c ON c.id = i."customerId"
      WHERE p."tenantId" = ${tid} AND p."voidAt" IS NULL
    `;
    const paymentsToFix = payments.filter((pay) => !paymentRefs.has(pay.id));
    for (const pay of paymentsToFix) {
      const ok = await ensureJournal(
        tid, pay.id, "PAYMENT", pay.paidAt,
        `Pembayaran dari ${pay.customerName ?? "Customer"} — ${pay.code ?? ""}`,
        pay.createdById,
        [
          { accountCode: "1-1000", debit: Number(pay.amount), credit: 0 },
          { accountCode: "1-1100", debit: 0, credit: Number(pay.amount) },
        ],
        log,
      );
      if (ok) posted++;
    }

    // ── 3. Credit notes ──
    const creditNoteRefs = await existingRefs("CREDIT_NOTE");
    const creditNotes = await prisma.$queryRaw<{
      id: string; total: number; "createdAt": Date;
      "invoiceId": string | null;
    }[]>`
      SELECT cn.id, cn.total, cn."createdAt", cn."invoiceId"
      FROM credit_notes cn
      WHERE cn."tenantId" = ${tid}
    `;
    const creditNotesToFix = creditNotes.filter((cn) => !creditNoteRefs.has(cn.id));

    const cnInvoiceRows = await prisma.$queryRaw<{
      id: string; code: string; status: string; tax: number; "grandTotal": number;
      "paidAmount": number; "returnedAmount": number;
    }[]>`SELECT id, code, status, tax, "grandTotal", "paidAmount", "returnedAmount"
        FROM invoices WHERE "tenantId" = ${tid}`;
    const cnInvoiceMap = new Map(cnInvoiceRows.map((r) => [r.id, r]));

    const cnItemRows = await prisma.$queryRaw<{
      "creditNoteId": string; productId: string; quantity: number;
      hpp: number; "productType": string | null;
    }[]>`
      SELECT cni."creditNoteId", cni."productId", cni.quantity,
             COALESCE(ii.hpp, 0) AS hpp, p.type AS "productType"
      FROM credit_note_items cni
      JOIN credit_notes cn ON cn.id = cni."creditNoteId"
      JOIN invoice_items ii ON ii."invoiceId" = cn."invoiceId" AND ii."productId" = cni."productId"
      JOIN products p ON p.id = cni."productId"
      WHERE cn."tenantId" = ${tid}
    `;

    for (const cn of creditNotesToFix) {
      const totalReturned = Number(cn.total);
      if (totalReturned <= 0) continue;
      const inv = cnInvoiceMap.get(cn.invoiceId ?? "");
      if (!inv) continue;
      const taxRatio =
        Number(inv.tax) > 0 && Number(inv.grandTotal) > 0
          ? Number(inv.tax) / Number(inv.grandTotal)
          : 0;
      const taxPortion = totalReturned * taxRatio;
      const refundToCash =
        inv.status === "PAID" &&
        Number(inv.paidAmount) >= Number(inv.grandTotal) - Number(inv.returnedAmount);

      const lines: Line[] = [
        { accountCode: "4-1000", debit: totalReturned - taxPortion, credit: 0 },
      ];
      if (taxPortion > 0) lines.push({ accountCode: "2-1100", debit: taxPortion, credit: 0 });
      lines.push({
        accountCode: refundToCash ? "1-1000" : "1-1100",
        debit: 0,
        credit: totalReturned,
      });

      const items = cnItemRows
        .filter((item) => item.creditNoteId === cn.id)
        .map((item) => ({
          productType: item.productType ?? "FINISHED_GOODS",
          hpp: Number(item.hpp),
          quantity: item.quantity,
        }));
      const totalCogs = items.reduce((s, item) => s + item.hpp * item.quantity, 0);
      if (totalCogs > 0) {
        lines.push({ accountCode: getInventoryAccountCode(items), debit: totalCogs, credit: 0 });
        lines.push({ accountCode: getCogsAccountCode(items), debit: 0, credit: totalCogs });
      }

      const ok = await ensureJournal(
        tid, cn.id, "CREDIT_NOTE", cn.createdAt,
        `Retur penjualan — ${inv.code}`,
        null, lines, log,
      );
      if (ok) posted++;
    }

    // ── 4. Expenses ──
    const expenseRefs = await existingRefs("EXPENSE");
    const expenses = await prisma.$queryRaw<{
      id: string; amount: number; date: Date; category: string | null;
      description: string | null; "createdById": string | null;
    }[]>`
      SELECT e.id, e.amount, e.date, e.category, e.description, e."createdById"
      FROM expenses e
      WHERE e."tenantId" = ${tid} AND e."voidAt" IS NULL
    `;
    const expensesToFix = expenses.filter((exp) => !expenseRefs.has(exp.id));
    for (const exp of expensesToFix) {
      const amount = Number(exp.amount);
      if (amount <= 0) continue;
      const expenseAccount = EXPENSE_ACCOUNT_MAP[exp.category ?? "LAINNYA"] ?? "5-2060";
      const ok = await ensureJournal(
        tid, exp.id, "EXPENSE", exp.date,
        `Beban: ${exp.description ?? exp.category}`,
        exp.createdById,
        [
          { accountCode: expenseAccount, debit: amount, credit: 0 },
          { accountCode: "1-1000", debit: 0, credit: amount },
        ],
        log,
      );
      if (ok) posted++;
    }

    // ── 5. Supplier payments ──
    const supplierPaymentRefs = await existingRefs("SUPPLIER_PAYMENT");
    const supplierPayments = await prisma.$queryRaw<{
      id: string; amount: number; "paidAt": Date; "createdById": string | null;
      "purchaseId": string | null; code: string | null; "supplierName": string | null;
    }[]>`
      SELECT sp.id, sp.amount, sp."paidAt", sp."createdById", sp."purchaseId",
             p.code, s.name AS "supplierName"
      FROM supplier_payments sp
      LEFT JOIN purchases p ON p.id = sp."purchaseId"
      LEFT JOIN suppliers s ON s.id = p."supplierId"
      WHERE sp."tenantId" = ${tid} AND sp."voidAt" IS NULL
    `;
    const supplierPaymentsToFix = supplierPayments.filter((sp) => !supplierPaymentRefs.has(sp.id));
    for (const sp of supplierPaymentsToFix) {
      const ok = await ensureJournal(
        tid, sp.id, "SUPPLIER_PAYMENT", sp.paidAt,
        `Pembayaran ke ${sp.supplierName ?? "Supplier"} — ${sp.code ?? ""}`,
        sp.createdById,
        [
          { accountCode: "2-1000", debit: Number(sp.amount), credit: 0 },
          { accountCode: "1-1000", debit: 0, credit: Number(sp.amount) },
        ],
        log,
      );
      if (ok) posted++;
    }

    // ── 6. Purchases COMPLETED ──
    const purchaseRefs = await existingRefs("PURCHASE");
    const purchases = await prisma.$queryRaw<{
      id: string; code: string; "totalCost": number; "paidAmount": number;
      "receivedAt": Date | null; "createdAt": Date; "createdById": string | null;
      "packagingId": string | null; "supplierName": string | null;
    }[]>`
      SELECT p.id, p.code, p."totalCost", p."paidAmount", p."receivedAt", p."createdAt",
             p."createdById", p."packagingId", s.name AS "supplierName"
      FROM purchases p
      LEFT JOIN suppliers s ON s.id = p."supplierId"
      WHERE p."tenantId" = ${tid} AND p.status = 'COMPLETED' AND p."voidAt" IS NULL
    `;
    const purchasesToFix = purchases.filter((pur) => !purchaseRefs.has(pur.id));
    for (const pur of purchasesToFix) {
      const totalCost = Number(pur.totalCost);
      if (totalCost <= 0) continue;
      const paidAmount = Number(pur.paidAmount);
      const remaining = totalCost - paidAmount;
      const inventoryAccount = pur.packagingId ? "1-1230" : "1-1200";
      const lines: Line[] = [{ accountCode: inventoryAccount, debit: totalCost, credit: 0 }];
      if (paidAmount > 0) lines.push({ accountCode: "1-1000", debit: 0, credit: paidAmount });
      if (remaining > 0.01) lines.push({ accountCode: "2-1000", debit: 0, credit: remaining });
      const ok = await ensureJournal(
        tid, pur.id, "PURCHASE", pur.receivedAt ?? pur.createdAt,
        `Pembelian dari ${pur.supplierName ?? "Supplier"} — ${pur.code}`,
        pur.createdById, lines, log,
      );
      if (ok) posted++;
    }

    // ── 7. Production COMPLETED ──
    const productionRefs = await existingRefs("PRODUCTION");
    const productionBatches = await prisma.$queryRaw<{
      id: string; "unitsProduced": number; "laborCost": number | null;
      "overheadAllocated": number | null; "producedAt": Date; "createdById": string | null;
      "outputProductId": string; "packagingId": string;
    }[]>`
      SELECT pb.id, pb."unitsProduced", pb."laborCost", pb."overheadAllocated",
             pb."producedAt", pb."createdById", pb."outputProductId", pb."packagingId"
      FROM production_batches pb
      WHERE pb."tenantId" = ${tid} AND pb.status = 'COMPLETED' AND pb."voidAt" IS NULL
    `;
    const productionBatchesToFix = productionBatches.filter((pb) => !productionRefs.has(pb.id));

    const productionNames = await prisma.$queryRaw<{
      "outputProductId": string; "outputName": string; "pkgCostPerUnit": number;
      "rbCostPerKg": number; "rbUsedKg": number;
    }[]>`
      SELECT pb."outputProductId",
             op.name AS "outputName",
             COALESCE(pkg."avgCostPerUnit", pkg."costPerUnit", 0) AS "pkgCostPerUnit",
             COALESCE(rbTotal."rbCostPerKg", 0) AS "rbCostPerKg",
             COALESCE(rbTotal."rbUsedKg", 0) AS "rbUsedKg"
      FROM production_batches pb
      JOIN products op ON op.id = pb."outputProductId"
      JOIN packagings pkg ON pkg.id = pb."packagingId"
      LEFT JOIN (
        SELECT il."refId",
               AVG(p."avgCostPerKg") AS "rbCostPerKg",
               SUM(il."quantityKg") AS "rbUsedKg"
        FROM inventory_ledger il
        JOIN products p ON p.id = il."productId"
        WHERE il."refType" = 'PRODUCTION_RB_OUT' AND il."entryType" = 'OUT'
        GROUP BY il."refId"
      ) rbTotal ON rbTotal."refId" = pb.id
      WHERE pb."tenantId" = ${tid} AND pb.status = 'COMPLETED' AND pb."voidAt" IS NULL
    `;
    const productionNameMap = new Map(productionNames.map((r) => [r.outputProductId, r]));

    for (const pb of productionBatchesToFix) {
      const info = productionNameMap.get(pb.outputProductId);
      const rbCostPerKg = Number(info?.rbCostPerKg ?? 0);
      const rbUsedKg = Number(info?.rbUsedKg ?? 0);
      const totalRbCost = rbCostPerKg * rbUsedKg;
      const pkgCost = Number(info?.pkgCostPerUnit ?? 0) * pb.unitsProduced;
      const laborCost = Number(pb.laborCost ?? 0);
      const overheadCost = Number(pb.overheadAllocated ?? 0);
      const totalCost = totalRbCost + pkgCost + laborCost + overheadCost;
      if (totalCost <= 0) continue;

      const lines: Line[] = [
        { accountCode: "1-1220", debit: totalCost, credit: 0 },
        { accountCode: "1-1210", debit: 0, credit: totalRbCost },
        { accountCode: "1-1230", debit: 0, credit: pkgCost },
      ];
      if (laborCost > 0) lines.push({ accountCode: "5-1010", debit: 0, credit: laborCost });
      if (overheadCost > 0) lines.push({ accountCode: "5-1020", debit: 0, credit: overheadCost });
      const ok = await ensureJournal(
        tid, pb.id, "PRODUCTION", pb.producedAt,
        `Produksi: ${info?.outputName ?? "Produk"}`,
        pb.createdById, lines, log,
      );
      if (ok) posted++;
    }

    // ── 8. Roasting COMPLETED ──
    const roastingRefs = await existingRefs("ROASTING");
    const roastingBatches = await prisma.$queryRaw<{
      id: string; "targetWeightKg": number; "actualOutputKg": number | null;
      "completedAt": Date | null; "createdAt": Date; "createdById": string | null;
      "inputName": string; "outputName": string; "inputCostPerKg": number;
    }[]>`
      SELECT rb.id, rb."targetWeightKg", rb."actualOutputKg", rb."completedAt",
             rb."createdAt", rb."createdById",
             ip.name AS "inputName", op.name AS "outputName",
             COALESCE(ip."avgCostPerKg", 0) AS "inputCostPerKg"
      FROM parent_roasting_batches rb
      JOIN products ip ON ip.id = rb."inputProductId"
      JOIN products op ON op.id = rb."outputProductId"
      WHERE rb."tenantId" = ${tid} AND rb.status = 'COMPLETED' AND rb."voidAt" IS NULL
    `;
    const roastingBatchesToFix = roastingBatches.filter((rb) => !roastingRefs.has(rb.id));
    for (const rb of roastingBatchesToFix) {
      const inputKg = Number(rb.targetWeightKg);
      const outputKg = Number(rb.actualOutputKg ?? 0);
      const inputCost = inputKg * Number(rb.inputCostPerKg ?? 0);
      if (inputCost <= 0 || inputKg <= 0) continue;
      const lines: Line[] = [
        outputKg > 0
          ? { accountCode: "1-1210", debit: inputCost, credit: 0 }
          : { accountCode: "5-1000", debit: inputCost, credit: 0 },
        { accountCode: "1-1200", debit: 0, credit: inputCost },
      ];
      const ok = await ensureJournal(
        tid, rb.id, "ROASTING", rb.completedAt ?? rb.createdAt,
        `Roasting: ${rb.inputName} → ${rb.outputName}`,
        rb.createdById, lines, log,
      );
      if (ok) posted++;
    }
  }

  console.log(JSON.stringify({
    mode: apply ? "APPLY" : "DRY-RUN",
    totalPosted: apply ? posted : null,
    totalPlanned: apply ? null : posted,
    hint: apply ? "Periksa ulang dengan audit:integrity" : "Jalankan dengan --apply untuk menulis jurnal",
  }, null, 2));

  if (!apply && posted > 0) process.exitCode = 2;
}

try {
  await main();
} finally {
  await prisma.$disconnect();
}
