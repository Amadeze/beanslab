// Read-only backfill preflight for migration-history adoption.
//
// Verbatim invariants from prisma/migrations/000000000001_preserve_domain_invariants
// (source of truth: scripts/migration-recovery/invariant-manifest.json). The
// preserved migration validates existing rows when adding each CHECK; this
// script REPORTS whether the target database's rows would survive it.
//
// READ-ONLY: only SELECT statements are issued. Exit code 0 = all PASS,
// 1 = at least one NEEDS BACKFILL (adoption must STOP until reconciled).
//
// Usage:
//   node scripts/migration-recovery/backfill-preflight.mjs [schema] [url]
//   - schema defaults to "public"
//   - url defaults to process.env.DIRECT_URL || process.env.DATABASE_URL
import { Pool } from "pg";

const schema = process.argv[2] ?? "public";
const url =
  process.argv[3] ?? process.env.DIRECT_URL ?? process.env.DATABASE_URL;
if (!url) {
  console.error("backfill-preflight: no database URL (pass argv[3] or set DIRECT_URL/DATABASE_URL)");
  process.exit(2);
}

const CHECKS = [
  ["products_stock_nonnegative", "products", `"stockKg" >= 0 AND "stockUnit" >= 0`],
  ["packagings_stock_nonnegative", "packagings", `"stockUnit" >= 0`],
  ["roasting_target_positive", "parent_roasting_batches", `"targetWeightKg" > 0`],
  ["roasting_output_valid", "parent_roasting_batches", `"actualOutputKg" IS NULL OR ("actualOutputKg" > 0 AND "actualOutputKg" < "targetWeightKg")`],
  ["roasting_completed_has_output", "parent_roasting_batches", `status <> 'COMPLETED' OR "actualOutputKg" IS NOT NULL`],
  ["production_values_positive", "production_batches", `"unitsProduced" > 0 AND "totalRbUsedKg" > 0 AND "hppPerUnit" >= 0`],
  ["invoice_item_values_valid", "invoice_items", `quantity > 0 AND "unitPrice" >= 0 AND discount >= 0 AND discount <= "unitPrice" AND subtotal >= 0 AND hpp >= 0`],
  ["invoice_values_valid", "invoices", `subtotal >= 0 AND discount >= 0 AND tax >= 0 AND "shippingCost" >= 0 AND "grandTotal" >= 0 AND "paidAmount" >= 0 AND "paidAmount" <= "grandTotal" + 0.01`],
  ["expense_amount_positive", "expenses", `amount > 0`],
  ["payment_amount_positive", "payments", `amount > 0`],
  ["supplier_payment_amount_positive", "supplier_payments", `amount > 0`],
  ["purchase_payment_values_valid", "purchases", `"paidAmount" >= 0 AND "paidAmount" <= "totalCost" + 0.01 AND (status <> 'COMPLETED' OR ("paymentStatus" = 'UNPAID' AND "paidAmount" <= 0.01) OR ("paymentStatus" = 'PARTIAL' AND "paidAmount" > 0.01 AND "paidAmount" < "totalCost" - 0.01) OR ("paymentStatus" = 'PAID' AND "paidAmount" >= "totalCost" - 0.01))`],
  ["purchase_credit_requires_due_date", "purchases", `status <> 'COMPLETED' OR "paymentStatus" = 'PAID' OR "dueDate" IS NOT NULL`],
  ["void_purchase_has_no_payment_balance", "purchases", `status <> 'VOID' OR "paidAmount" <= 0.01`],
  ["cupping_scores_range_check", "cupping_scores", `"score" >= 0 AND "maxScore" > 0 AND "score" <= "maxScore"`],
  ["contract_prices_quantity_check", "contract_prices", `"minOrderQty" >= 0`],
  ["contract_prices_value_check", "contract_prices", `("pricePerKg" IS NOT NULL AND "pricePerKg" >= 0) OR ("pricePerUnit" IS NOT NULL AND "pricePerUnit" >= 0)`],
  ["tenant_payment_methods_manual_shape_check", "tenant_payment_methods", `("method" = 'TRANSFER' AND "bankName" IS NOT NULL AND "accountNumber" IS NOT NULL AND "accountHolder" IS NOT NULL) OR ("method" = 'QRIS' AND "qrisImageUrl" IS NOT NULL) OR ("method" IN ('CASH', 'CREDIT'))`],
];

const INDEX_CHECKS = [
  [
    "live_sessions_active_unique",
    `SELECT count(*) FROM "live_sessions" WHERE "status" = 'ACTIVE' GROUP BY "tenantId", "machineId" HAVING count(*) > 1`,
  ],
  [
    "journal_entries_tenantId_refType_reference_key",
    `SELECT count(*) FROM "journal_entries" WHERE "refType" IS NOT NULL AND "reference" IS NOT NULL GROUP BY "tenantId", "refType", "reference" HAVING count(*) > 1`,
  ],
];

// Historical one-time data backfills (absorbed into the baseline as schema;
// the DATA invariants they established must hold on the adopting database).
// Each entry: name, diagnostic SQL returning violating row count (or 0).
const BACKFILL_CHECKS = [
  [
    "supplier_payments_legacy (20260716223000_supplier_accounts_payable)",
    `SELECT count(*)::int AS n FROM "purchases" p
     WHERE p.status = 'COMPLETED' AND p."totalCost" > 0
       AND NOT EXISTS (SELECT 1 FROM "supplier_payments" sp WHERE sp."purchaseId" = p."id")`,
  ],
  [
    "source_green_bean_lineage (20260719152000_roasted_bean_source_identity)",
    `SELECT count(*)::int AS n FROM "products" rb
     WHERE rb."type" = 'ROASTED_BEAN' AND rb."sourceGreenBeanId" IS NOT NULL
       AND NOT EXISTS (
         SELECT 1 FROM "products" gb
         WHERE gb."id" = rb."sourceGreenBeanId"
           AND gb."type" = 'GREEN_BEAN'
           AND gb."tenantId" = rb."tenantId"
       )`,
  ],
  [
    "cupping_session_code (20260727150000_cupping_session_code)",
    `SELECT count(*)::int AS n FROM "cupping_sessions" WHERE "code" IS NULL OR "code" = ''`,
  ],
  [
    "coffee_identity (20260810160000_add_coffee_identity)",
    `SELECT count(*)::int AS n FROM "products" p
     WHERE (p."type" = 'GREEN_BEAN' AND p."coffeeSourceId" IS NULL)
        OR (p."type" = 'ROASTED_BEAN' AND p."sourceGreenBeanId" IS NOT NULL
            AND EXISTS (
              SELECT 1 FROM "products" gb
              WHERE gb."id" = p."sourceGreenBeanId"
                AND gb."type" = 'GREEN_BEAN'
                AND gb."tenantId" = p."tenantId"
                AND gb."coffeeSourceId" IS NOT NULL
            )
            AND (p."coffeeSourceId" IS NULL OR p."materialOrigin" <> 'INTERNAL_ROAST'))`,
  ],
  [
    "storefront_grind_options (20260810153000_storefront_grind_options)",
    `SELECT count(*)::int AS n FROM "recipes" WHERE "storefrontGrindOptions" IS NULL`,
  ],
  [
    "authorized_by_user_id (20260728190000_add_studio_connector_actor)",
    // OBSOLETE: the artisan_connectors table no longer exists in the schema
    // (ArtisanConnector model was removed long before the baseline).
    null,
  ],
];

const pool = new Pool({ connectionString: url, max: 3 });

async function run() {
  await pool.query("SELECT set_config('search_path', $1, false)", [schema]);
  let needsBackfill = 0;

  for (const [name, table, expr] of CHECKS) {
    try {
      const { rows } = await pool.query(
        `SELECT count(*)::int AS n FROM "${table}" WHERE NOT (${expr})`,
      );
      const n = rows[0].n;
      const ok = n === 0;
      if (!ok) needsBackfill += 1;
      console.log(`${ok ? "PASS" : "NEEDS BACKFILL"}  ${name}  (${table}): ${n} violating row(s)`);
    } catch (err) {
      console.log(`SKIP  ${name}: ${err.message}`);
    }
  }

  for (const [name, sql] of INDEX_CHECKS) {
    try {
      const { rows } = await pool.query(sql);
      const n = rows.length;
      const ok = n === 0;
      if (!ok) needsBackfill += 1;
      console.log(`${ok ? "PASS" : "NEEDS BACKFILL"}  ${name}: ${n} duplicate group(s)`);
    } catch (err) {
      console.log(`SKIP  ${name}: ${err.message}`);
    }
  }

  for (const [name, sql] of BACKFILL_CHECKS) {
    if (!sql) {
      console.log(`SKIP  ${name}: obsolete â€” table removed from current schema`);
      continue;
    }
    try {
      const { rows } = await pool.query(sql);
      const n = rows[0].n;
      const ok = n === 0;
      if (!ok) needsBackfill += 1;
      console.log(`${ok ? "PASS" : "NEEDS BACKFILL"}  ${name}: ${n} row(s)`);
    } catch (err) {
      console.log(`SKIP  ${name}: ${err.message}`);
    }
  }

  await pool.end();
  console.log(
    needsBackfill === 0
      ? `backfill-preflight: ALL PASS (schema ${schema})`
      : `backfill-preflight: ${needsBackfill} invariant(s) NEED BACKFILL â€” adoption must stop until reconciled (schema ${schema})`,
  );
  process.exit(needsBackfill === 0 ? 0 : 1);
}

run().catch(async (err) => {
  console.error("backfill-preflight failed:", err.message);
  await pool.end().catch(() => {});
  process.exit(2);
});
