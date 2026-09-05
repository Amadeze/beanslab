import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL or DIRECT_URL is required.");
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

type Violation = { check: string; count: number };

try {
  const tenantRelationViolations = await prisma.$queryRaw<Violation[]>`
    SELECT 'purchase_supplier' AS check, COUNT(*)::int AS count
    FROM purchases x JOIN suppliers y ON y.id = x."supplierId"
    WHERE x."tenantId" <> y."tenantId"
    UNION ALL
    SELECT 'purchase_product', COUNT(*)::int
    FROM purchases x JOIN products y ON y.id = x."productId"
    WHERE x."tenantId" <> y."tenantId"
    UNION ALL
    SELECT 'purchase_packaging', COUNT(*)::int
    FROM purchases x JOIN packagings y ON y.id = x."packagingId"
    WHERE x."tenantId" <> y."tenantId"
    UNION ALL
    SELECT 'roasting_input_product', COUNT(*)::int
    FROM parent_roasting_batches x JOIN products y ON y.id = x."inputProductId"
    WHERE x."tenantId" <> y."tenantId"
    UNION ALL
    SELECT 'roasting_output_product', COUNT(*)::int
    FROM parent_roasting_batches x JOIN products y ON y.id = x."outputProductId"
    WHERE x."tenantId" <> y."tenantId"
    UNION ALL
    SELECT 'product_source_green_bean', COUNT(*)::int
    FROM products x JOIN products y ON y.id = x."sourceGreenBeanId"
    WHERE x."tenantId" <> y."tenantId"
    UNION ALL
    SELECT 'production_output_product', COUNT(*)::int
    FROM production_batches x JOIN products y ON y.id = x."outputProductId"
    WHERE x."tenantId" <> y."tenantId"
    UNION ALL
    SELECT 'production_packaging', COUNT(*)::int
    FROM production_batches x JOIN packagings y ON y.id = x."packagingId"
    WHERE x."tenantId" <> y."tenantId"
    UNION ALL
    SELECT 'invoice_customer', COUNT(*)::int
    FROM invoices x JOIN customers y ON y.id = x."customerId"
    WHERE x."tenantId" <> y."tenantId"
    UNION ALL
    SELECT 'invoice_item_product', COUNT(*)::int
    FROM invoice_items x
    JOIN invoices i ON i.id = x."invoiceId"
    JOIN products p ON p.id = x."productId"
    WHERE i."tenantId" <> p."tenantId"
    UNION ALL
    SELECT 'payment_invoice', COUNT(*)::int
    FROM payments x JOIN invoices y ON y.id = x."invoiceId"
    WHERE x."tenantId" <> y."tenantId"
    UNION ALL
    SELECT 'supplier_payment_purchase', COUNT(*)::int
    FROM supplier_payments x JOIN purchases y ON y.id = x."purchaseId"
    WHERE x."tenantId" <> y."tenantId"
    UNION ALL
    SELECT 'ledger_product', COUNT(*)::int
    FROM inventory_ledger x JOIN products y ON y.id = x."productId"
    WHERE x."tenantId" <> y."tenantId"
    UNION ALL
    SELECT 'ledger_packaging', COUNT(*)::int
    FROM inventory_ledger x JOIN packagings y ON y.id = x."packagingId"
    WHERE x."tenantId" <> y."tenantId"
    UNION ALL
    SELECT 'reminder_invoice', COUNT(*)::int
    FROM reminder_deliveries x JOIN invoices y ON y.id = x."invoiceId"
    WHERE x."tenantId" <> y."tenantId"
  `;

  const financialViolations = await prisma.$queryRaw<Violation[]>`
    SELECT 'invoice_subtotal_mismatch' AS check, COUNT(*)::int AS count
    FROM (
      SELECT i.id
      FROM invoices i
      LEFT JOIN invoice_items ii ON ii."invoiceId" = i.id
      GROUP BY i.id
      HAVING ABS(i.subtotal - COALESCE(SUM(ii.subtotal), 0)) > 0.01
    ) mismatches
    UNION ALL
    SELECT 'invoice_grand_total_mismatch', COUNT(*)::int
    FROM invoices
    WHERE ABS("grandTotal" - (subtotal - discount + tax + "shippingCost")) > 0.01
    UNION ALL
    SELECT 'invoice_paid_amount_mismatch', COUNT(*)::int
    FROM (
      SELECT i.id
      FROM invoices i
      LEFT JOIN payments p ON p."invoiceId" = i.id AND p."voidAt" IS NULL
      GROUP BY i.id
      HAVING ABS(i."paidAmount" - COALESCE(SUM(p.amount), 0)) > 0.01
    ) mismatches
    UNION ALL
    SELECT 'invoice_overpaid', COUNT(*)::int
    FROM invoices
    WHERE "paidAmount" > "grandTotal" + 0.01
    UNION ALL
    SELECT 'invoice_payment_status_mismatch', COUNT(*)::int
    FROM invoices
    WHERE
      (status = 'PAID' AND "paidAmount" < "grandTotal" - 0.01)
      OR (status = 'PARTIAL' AND ("paidAmount" <= 0 OR "paidAmount" >= "grandTotal" - 0.01))
      OR (status = 'ISSUED' AND "paidAmount" > 0.01)
    UNION ALL
    SELECT 'purchase_paid_amount_mismatch', COUNT(*)::int
    FROM (
      SELECT p.id
      FROM purchases p
      LEFT JOIN supplier_payments sp
        ON sp."purchaseId" = p.id AND sp."voidAt" IS NULL
      GROUP BY p.id
      HAVING ABS(p."paidAmount" - COALESCE(SUM(sp.amount), 0)) > 0.01
    ) mismatches
    UNION ALL
    SELECT 'purchase_overpaid', COUNT(*)::int
    FROM purchases
    WHERE "paidAmount" > "totalCost" + 0.01
    UNION ALL
    SELECT 'purchase_payment_status_mismatch', COUNT(*)::int
    FROM purchases
    WHERE status = 'COMPLETED' AND (
      ("paymentStatus" = 'PAID' AND "paidAmount" < "totalCost" - 0.01)
      OR ("paymentStatus" = 'PARTIAL' AND ("paidAmount" <= 0.01 OR "paidAmount" >= "totalCost" - 0.01))
      OR ("paymentStatus" = 'UNPAID' AND "paidAmount" > 0.01)
    )
    UNION ALL
    SELECT 'purchase_credit_missing_due_date', COUNT(*)::int
    FROM purchases
    WHERE status = 'COMPLETED'
      AND "paymentStatus" <> 'PAID'
      AND "dueDate" IS NULL
    UNION ALL
    SELECT 'duplicate_sent_reminder', COUNT(*)::int
    FROM (
      SELECT "tenantId", "invoiceId", channel, "reminderDate"
      FROM reminder_deliveries
      WHERE status = 'SENT'
      GROUP BY "tenantId", "invoiceId", channel, "reminderDate"
      HAVING COUNT(*) > 1
    ) duplicates
  `;

  const inventoryViolations = await prisma.$queryRaw<Violation[]>`
    SELECT 'negative_product_kg' AS check, COUNT(*)::int AS count
    FROM products WHERE "stockKg" < 0
    UNION ALL
    SELECT 'negative_product_unit', COUNT(*)::int
    FROM products WHERE "stockUnit" < 0
    UNION ALL
    SELECT 'negative_packaging_unit', COUNT(*)::int
    FROM packagings WHERE "stockUnit" < 0
    UNION ALL
    SELECT 'ledger_invalid_target', COUNT(*)::int
    FROM inventory_ledger
    WHERE ("productId" IS NULL) = ("packagingId" IS NULL)
    UNION ALL
    SELECT 'ledger_invalid_quantity', COUNT(*)::int
    FROM inventory_ledger
    WHERE
      COALESCE("quantityKg", 0) < 0
      OR COALESCE("quantityUnit", 0) < 0
      OR (COALESCE("quantityKg", 0) = 0 AND COALESCE("quantityUnit", 0) = 0)
    UNION ALL
    SELECT 'finished_goods_hpp_cache_mismatch', COUNT(*)::int
    FROM products p
    LEFT JOIN LATERAL (
      SELECT pb."hppPerUnit"
      FROM production_batches pb
      WHERE pb."outputProductId" = p.id AND pb.status = 'COMPLETED'
      ORDER BY pb."producedAt" DESC, pb."createdAt" DESC
      LIMIT 1
    ) latest ON TRUE
    WHERE p.type = 'FINISHED_GOODS'
      AND p."lastHpp" IS DISTINCT FROM latest."hppPerUnit"
  `;

  const operationalViolations = await prisma.$queryRaw<Violation[]>`
    SELECT 'roasted_product_invalid_source' AS check, COUNT(*)::int AS count
    FROM products rb
    JOIN products gb ON gb.id = rb."sourceGreenBeanId"
    WHERE rb.type <> 'ROASTED_BEAN'
      OR gb.type <> 'GREEN_BEAN'
      OR rb."roastLevel" IS NULL
    UNION ALL
    SELECT 'completed_purchase_ledger_mismatch', COUNT(*)::int
    FROM purchases p
    WHERE p.status = 'COMPLETED'
      AND (
        SELECT COUNT(*)
        FROM inventory_ledger il
        WHERE il."refId" = p.id
          AND il."entryType" = 'IN'
          AND il."refType" IN ('PURCHASE_GB', 'PURCHASE_PKG')
      ) <> 1
    UNION ALL
    SELECT 'completed_roasting_ledger_mismatch', COUNT(*)::int
    FROM parent_roasting_batches rb
    WHERE rb.status = 'COMPLETED'
      AND (
        ABS(COALESCE((
          SELECT SUM(il."quantityKg")
          FROM inventory_ledger il
          WHERE il."refId" = rb.id
            AND il."refType" = 'ROASTING_GB_OUT'
            AND il."entryType" = 'OUT'
            AND il."productId" = rb."inputProductId"
        ), 0) - rb."targetWeightKg") > 0.001
        OR
        ABS(COALESCE((
          SELECT SUM(il."quantityKg")
          FROM inventory_ledger il
          WHERE il."refId" = rb.id
            AND il."refType" = 'ROASTING_RB_IN'
            AND il."entryType" = 'IN'
            AND il."productId" = rb."outputProductId"
        ), 0) - rb."actualOutputKg") > 0.001
      )
    UNION ALL
    SELECT 'pending_roasting_ledger_mismatch', COUNT(*)::int
    FROM parent_roasting_batches rb
    WHERE rb.status = 'PENDING'
      AND (
        ABS(COALESCE((
          SELECT SUM(il."quantityKg")
          FROM inventory_ledger il
          WHERE il."refId" = rb.id
            AND il."refType" = 'ROASTING_GB_OUT'
            AND il."entryType" = 'OUT'
        ), 0) - rb."targetWeightKg") > 0.001
        OR EXISTS (
          SELECT 1
          FROM inventory_ledger il
          WHERE il."refId" = rb.id AND il."refType" = 'ROASTING_RB_IN'
        )
      )
    UNION ALL
    SELECT 'completed_production_ledger_mismatch', COUNT(*)::int
    FROM production_batches pb
    WHERE pb.status = 'COMPLETED'
      AND (
        ABS(COALESCE((
          SELECT SUM(il."quantityKg")
          FROM inventory_ledger il
          WHERE il."refId" = pb.id
            AND il."refType" = 'PRODUCTION_RB_OUT'
            AND il."entryType" = 'OUT'
        ), 0) - pb."totalRbUsedKg") > 0.001
        OR COALESCE((
          SELECT SUM(il."quantityUnit")
          FROM inventory_ledger il
          WHERE il."refId" = pb.id
            AND il."refType" = 'PRODUCTION_PKG_OUT'
            AND il."entryType" = 'OUT'
            AND il."packagingId" = pb."packagingId"
        ), 0) <> pb."unitsProduced"
        OR COALESCE((
          SELECT SUM(il."quantityUnit")
          FROM inventory_ledger il
          WHERE il."refId" = pb.id
            AND il."refType" = 'PRODUCTION_FG_IN'
            AND il."entryType" = 'IN'
            AND il."productId" = pb."outputProductId"
        ), 0) <> pb."unitsProduced"
      )
  `;

  const lotViolations = await prisma.$queryRaw<Violation[]>`
    SELECT 'lot_over_consumed' AS check, COUNT(*)::int AS count
    FROM (
      SELECT il."lotId",
        SUM(CASE WHEN il."entryType" = 'OUT' THEN COALESCE(il."quantityKg", 0) ELSE 0 END) AS outKg,
        SUM(CASE WHEN il."refType" = 'VOID_REVERSAL' AND il."entryType" = 'IN' THEN COALESCE(il."quantityKg", 0) ELSE 0 END) AS reversalKg,
        SUM(CASE WHEN il."entryType" = 'OUT' THEN COALESCE(il."quantityUnit", 0) ELSE 0 END) AS outUnit,
        SUM(CASE WHEN il."refType" = 'VOID_REVERSAL' AND il."entryType" = 'IN' THEN COALESCE(il."quantityUnit", 0) ELSE 0 END) AS reversalUnit
      FROM inventory_ledger il
      WHERE il."lotId" IS NOT NULL
      GROUP BY il."lotId"
    ) s
    JOIN lots l ON l.id = s."lotId"
    WHERE (s.outKg - s.reversalKg) - l."quantityKg" > 0.001
       OR (s.outUnit - s.reversalUnit) - l."quantityUnit" > 0.001
    UNION ALL
    SELECT 'lot_initial_in_mismatch', COUNT(*)::int
    FROM lots l
    LEFT JOIN (
      SELECT il."lotId",
        SUM(CASE WHEN il."refType" IN ('PURCHASE_GB', 'PURCHASE_PKG') AND il."entryType" = 'IN' THEN COALESCE(il."quantityKg", 0) ELSE 0 END) AS inKg,
        SUM(CASE WHEN il."refType" IN ('PURCHASE_GB', 'PURCHASE_PKG') AND il."entryType" = 'IN' THEN COALESCE(il."quantityUnit", 0) ELSE 0 END) AS inUnit
      FROM inventory_ledger il
      WHERE il."lotId" IS NOT NULL
      GROUP BY il."lotId"
    ) s ON s."lotId" = l.id
    WHERE l."purchaseId" IS NOT NULL
      AND (
        ABS(COALESCE(s.inKg, 0) - l."quantityKg") > 0.001
        OR ABS(COALESCE(s.inUnit, 0) - l."quantityUnit") > 0.001
      )
    UNION ALL
    SELECT il."refType"::text AS check, COUNT(*)::int
    FROM inventory_ledger il
    WHERE il."productId" IS NOT NULL
      AND il."lotId" IS NULL
      AND il."refType" IN (
        'PURCHASE_GB', 'PURCHASE_PKG',
        'ROASTING_GB_OUT', 'ROASTING_RB_IN',
        'PRODUCTION_RB_OUT', 'PRODUCTION_FG_IN',
        'SALE_FG_OUT', 'SAMPLE_RB_OUT', 'SAMPLE_FG_OUT'
      )
      AND EXISTS (
        SELECT 1 FROM lots lo
        WHERE lo."tenantId" = il."tenantId"
          AND lo."productId" = il."productId"
          AND lo."receivedAt" <= il."createdAt"
          AND lo."consumedAt" IS NULL
      )
    GROUP BY il."refType"
  `;

  const journalViolations = await prisma.$queryRaw<Violation[]>`
    SELECT 'journal_unbalanced' AS check, COUNT(*)::int AS count
    FROM (
      SELECT je.id
      FROM journal_entries je
      JOIN journal_lines jl ON jl."journalEntryId" = je.id
      GROUP BY je.id
      HAVING ABS(SUM(jl.debit) - SUM(jl.credit)) > 0.01
    ) unbalanced
    UNION ALL
    SELECT 'journal_line_account_tenant_isolation', COUNT(*)::int
    FROM journal_lines jl
    JOIN journal_entries je ON je.id = jl."journalEntryId"
    JOIN accounts a ON a.id = jl."accountId"
    WHERE je."tenantId" <> a."tenantId"
    UNION ALL
    SELECT 'journal_void_missing_reversal', COUNT(*)::int
    FROM journal_entries je
    WHERE je."voidAt" IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM journal_entries rev
        WHERE rev."tenantId" = je."tenantId"
          AND rev."refType" = 'VOID_REVERSAL'
          AND rev.reference = je.reference
      )
    UNION ALL
    SELECT 'invoice_missing_journal', COUNT(*)::int
    FROM invoices i
    WHERE i.status <> 'VOID'
      AND NOT EXISTS (
        SELECT 1 FROM journal_entries je
        WHERE je."tenantId" = i."tenantId"
          AND je.reference = i.id
          AND je."refType" = 'INVOICE'
          AND je."voidAt" IS NULL
      )
    UNION ALL
    SELECT 'invoice_tax_payable_mismatch', COUNT(*)::int
    FROM invoices i
    JOIN journal_entries je
      ON je."tenantId" = i."tenantId" AND je.reference = i.id
     AND je."refType" = 'INVOICE' AND je."voidAt" IS NULL
    JOIN journal_lines jl ON jl."journalEntryId" = je.id
    JOIN accounts a ON a.id = jl."accountId" AND a.code = '2-1100'
    WHERE i.tax > 0 AND i.status <> 'VOID'
    GROUP BY i.id
    HAVING ABS(SUM(jl.credit) - i.tax) > 0.01
    UNION ALL
    SELECT 'invoice_void_journal_live', COUNT(*)::int
    FROM invoices i
    JOIN journal_entries je
      ON je."tenantId" = i."tenantId" AND je.reference = i.id AND je."refType" = 'INVOICE'
    WHERE i.status = 'VOID' AND je."voidAt" IS NULL
    UNION ALL
    SELECT 'payment_missing_journal', COUNT(*)::int
    FROM payments p
    WHERE p."voidAt" IS NULL
      AND NOT EXISTS (
        SELECT 1 FROM journal_entries je
        WHERE je."tenantId" = p."tenantId" AND je.reference = p.id AND je."refType" = 'PAYMENT'
      )
    UNION ALL
    SELECT 'credit_note_missing_journal', COUNT(*)::int
    FROM credit_notes cn
    WHERE NOT EXISTS (
      SELECT 1 FROM journal_entries je
      WHERE je."tenantId" = cn."tenantId" AND je.reference = cn.id AND je."refType" = 'CREDIT_NOTE'
    )
    UNION ALL
    SELECT 'credit_note_refund_mismatch', COUNT(*)::int
    FROM (
      SELECT cn.id
      FROM credit_notes cn
      JOIN journal_entries je
        ON je."tenantId" = cn."tenantId" AND je.reference = cn.id AND je."refType" = 'CREDIT_NOTE'
      JOIN journal_lines jl ON jl."journalEntryId" = je.id
      JOIN accounts a ON a.id = jl."accountId" AND a.code IN ('1-1000', '1-1100')
      GROUP BY cn.id, cn.total
      HAVING ABS(SUM(jl.credit) - cn.total) > 0.01
    ) refund_mismatch
    UNION ALL
    SELECT 'expense_missing_journal', COUNT(*)::int
    FROM expenses e
    WHERE e."voidAt" IS NULL
      AND NOT EXISTS (
        SELECT 1 FROM journal_entries je
        WHERE je."tenantId" = e."tenantId" AND je.reference = e.id AND je."refType" = 'EXPENSE'
      )
    UNION ALL
    SELECT 'supplier_payment_missing_journal', COUNT(*)::int
    FROM supplier_payments sp
    WHERE sp."voidAt" IS NULL
      AND NOT EXISTS (
        SELECT 1 FROM journal_entries je
        WHERE je."tenantId" = sp."tenantId" AND je.reference = sp.id AND je."refType" = 'SUPPLIER_PAYMENT'
      )
    UNION ALL
    SELECT 'purchase_missing_journal', COUNT(*)::int
    FROM purchases p
    WHERE p.status = 'COMPLETED' AND p."voidAt" IS NULL
      AND NOT EXISTS (
        SELECT 1 FROM journal_entries je
        WHERE je."tenantId" = p."tenantId" AND je.reference = p.id AND je."refType" = 'PURCHASE'
      )
    UNION ALL
    SELECT 'purchase_void_journal_live', COUNT(*)::int
    FROM purchases p
    JOIN journal_entries je
      ON je."tenantId" = p."tenantId" AND je.reference = p.id AND je."refType" = 'PURCHASE'
    WHERE p.status = 'VOID' AND je."voidAt" IS NULL
    UNION ALL
    SELECT 'production_missing_journal', COUNT(*)::int
    FROM production_batches pb
    WHERE pb.status = 'COMPLETED' AND pb."voidAt" IS NULL
      AND NOT EXISTS (
        SELECT 1 FROM journal_entries je
        WHERE je."tenantId" = pb."tenantId" AND je.reference = pb.id AND je."refType" = 'PRODUCTION'
      )
    UNION ALL
    SELECT 'roasting_missing_journal', COUNT(*)::int
    FROM parent_roasting_batches rb
    WHERE rb.status = 'COMPLETED' AND rb."voidAt" IS NULL
      AND NOT EXISTS (
        SELECT 1 FROM journal_entries je
        WHERE je."tenantId" = rb."tenantId" AND je.reference = rb.id AND je."refType" = 'ROASTING'
      )
  `;

  const violations = [
    ...tenantRelationViolations,
    ...financialViolations,
    ...inventoryViolations,
    ...operationalViolations,
    ...lotViolations,
    ...journalViolations,
  ].filter((item) => item.count > 0);

  const now = new Date();

  const PLAN_LIMITS: Record<string, { maxUsers: number; maxMonthlyRoastBatches: number; maxMonthlyInvoices: number }> = {
    TRIAL: { maxUsers: 5, maxMonthlyRoastBatches: 200, maxMonthlyInvoices: 500 },
    BASIC: { maxUsers: 3, maxMonthlyRoastBatches: 80, maxMonthlyInvoices: 200 },
    PRO: { maxUsers: 15, maxMonthlyRoastBatches: 1000, maxMonthlyInvoices: 5000 },
    ENTERPRISE: { maxUsers: 100, maxMonthlyRoastBatches: 10000, maxMonthlyInvoices: 50000 },
  };

  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const tenants = await prisma.tenant.findMany({
    select: { id: true, code: true, subscriptionTier: true },
  });

  interface CapacityDrift {
    tenantId: string;
    tenantCode: string;
    tier: string;
    dimension: "users" | "monthly_roast_batches" | "monthly_invoices";
    used: number;
    limit: number;
  }
  const capacityDrift: CapacityDrift[] = [];

  for (const tenant of tenants) {
    const limits = PLAN_LIMITS[tenant.subscriptionTier];
    if (!limits) continue;
    const [activeUsers, monthlyRoastBatches, monthlyInvoices] = await Promise.all([
      prisma.user.count({ where: { tenantId: tenant.id, isActive: true } }),
      prisma.parentRoastingBatch.count({
        where: { tenantId: tenant.id, createdAt: { gte: monthStart, lt: monthEnd } },
      }),
      prisma.invoice.count({
        where: { tenantId: tenant.id, createdAt: { gte: monthStart, lt: monthEnd } },
      }),
    ]);
    if (activeUsers > limits.maxUsers) {
      capacityDrift.push({
        tenantId: tenant.id,
        tenantCode: tenant.code,
        tier: tenant.subscriptionTier,
        dimension: "users",
        used: activeUsers,
        limit: limits.maxUsers,
      });
    }
    if (monthlyRoastBatches > limits.maxMonthlyRoastBatches) {
      capacityDrift.push({
        tenantId: tenant.id,
        tenantCode: tenant.code,
        tier: tenant.subscriptionTier,
        dimension: "monthly_roast_batches",
        used: monthlyRoastBatches,
        limit: limits.maxMonthlyRoastBatches,
      });
    }
    if (monthlyInvoices > limits.maxMonthlyInvoices) {
      capacityDrift.push({
        tenantId: tenant.id,
        tenantCode: tenant.code,
        tier: tenant.subscriptionTier,
        dimension: "monthly_invoices",
        used: monthlyInvoices,
        limit: limits.maxMonthlyInvoices,
      });
    }
  }

  console.log(JSON.stringify({ violations, capacityDrift }, null, 2));
  if (violations.length > 0 || capacityDrift.length > 0) process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
