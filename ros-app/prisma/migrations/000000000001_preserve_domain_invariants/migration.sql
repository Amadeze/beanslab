-- =============================================================================
-- PRESERVED DOMAIN INVARIANTS
-- =============================================================================
-- Recovery of custom database invariants that are NOT representable in
-- prisma/schema.prisma (Prisma cannot express CHECK constraints or partial
-- unique indexes). Source of truth: the pre-baseline migration history
-- (see docs/migration-history-recovery.md and
-- scripts/migration-recovery/invariant-manifest.json — 18 CHECK constraints,
-- 1 partial index, 1 data precheck).
--
-- OBSOLETE invariants from the old history that are NOT preserved (each was
-- verified against the current schema.prisma and the canonical database):
--   * profit_distribution_values_valid      — table profit_distributions was
--     intentionally removed (finance refactor; ProfitDistribution folded into
--     CapitalTransaction); the table no longer exists.
--   * withdrawal_requires_partner            — column partnerId was removed
--     from capital_transactions.
--   * capital_transaction_amount_positive   — amount is now signed:
--     positive for INITIAL/INJECTION, NEGATIVE for WITHDRAWAL/DIVIDEND
--     (documented in schema.prisma); amount > 0 would reject withdrawals.
--   * inventory_ledger_exactly_one_target   — the SUPPLY cutover added
--     supplyItemId; supply entries legitimately have BOTH productId and
--     packagingId NULL, which the old "exactly one" check rejects.
--   * inventory_ledger_exactly_one_positive_quantity — supply entries use
--     supplyQuantity with quantityKg/quantityUnit both NULL, which the old
--     check rejects.
--
-- On FRESH databases this migration runs immediately after the baseline.
-- On EXISTING databases (baseline resolved as applied) this migration still
-- executes, so the invariant set converges instead of being silently skipped.
--
-- Safety rules implemented here:
--   * No data mutation of any kind.
--   * Each CHECK is created only if absent (catalog guard). Postgres
--     validates existing rows when the constraint is added — a violation
--     fails this migration with a precise error (fail-fast, no repair).
--   * A same-named existing constraint is NEVER blindly accepted: its
--     definition is compared with the expected one and any difference aborts.
--     The comparison is canonical: the expected expression is applied to a
--     throwaway TEMP table (LIKE the target) inside the same transaction and
--     both definitions are rendered by pg_get_constraintdef, so Postgres'
--     own normalization (numeric/enum casts, IN-list expansion, paren
--     layout) is applied to both sides.
--   * The partial unique index is created only after the duplicate-ACTIVE
--     preflight passes; an existing index with a different predicate aborts.
--   * journal_entries idempotency: the unique index itself is emitted by the
--     baseline (@@unique in schema.prisma). This block only fail-fast-checks
--     that no duplicate source references exist when the index is absent
--     (relevant for existing databases during adoption).
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. CHECK constraints (18, verbatim expressions from the old migration SQL)
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'products_stock_nonnegative' AND conrelid = 'products'::regclass) THEN
    EXECUTE $q$ALTER TABLE "products" ADD CONSTRAINT "products_stock_nonnegative" CHECK ("stockKg" >= 0 AND "stockUnit" >= 0)$q$;
  ELSE
    CREATE TEMP TABLE "_inv_verify_products_stock_nonnegative" (LIKE "products") ON COMMIT DROP;
    ALTER TABLE "_inv_verify_products_stock_nonnegative" ADD CONSTRAINT "_inv_verify_chk" CHECK ("stockKg" >= 0 AND "stockUnit" >= 0);
    IF NOT EXISTS (
      SELECT 1
      FROM pg_constraint c
      JOIN pg_constraint d ON d.conrelid = '_inv_verify_products_stock_nonnegative'::regclass AND d.conname = '_inv_verify_chk'
      WHERE c.conname = 'products_stock_nonnegative' AND c.conrelid = 'products'::regclass
        AND replace(pg_get_constraintdef(c.oid), ' ', '') = replace(pg_get_constraintdef(d.oid), ' ', '')
    ) THEN
      RAISE EXCEPTION 'products_stock_nonnegative: constraint exists with a DIFFERENT definition; manual review required';
    END IF;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'packagings_stock_nonnegative' AND conrelid = 'packagings'::regclass) THEN
    EXECUTE $q$ALTER TABLE "packagings" ADD CONSTRAINT "packagings_stock_nonnegative" CHECK ("stockUnit" >= 0)$q$;
  ELSE
    CREATE TEMP TABLE "_inv_verify_packagings_stock_nonnegative" (LIKE "packagings") ON COMMIT DROP;
    ALTER TABLE "_inv_verify_packagings_stock_nonnegative" ADD CONSTRAINT "_inv_verify_chk" CHECK ("stockUnit" >= 0);
    IF NOT EXISTS (
      SELECT 1
      FROM pg_constraint c
      JOIN pg_constraint d ON d.conrelid = '_inv_verify_packagings_stock_nonnegative'::regclass AND d.conname = '_inv_verify_chk'
      WHERE c.conname = 'packagings_stock_nonnegative' AND c.conrelid = 'packagings'::regclass
        AND replace(pg_get_constraintdef(c.oid), ' ', '') = replace(pg_get_constraintdef(d.oid), ' ', '')
    ) THEN
      RAISE EXCEPTION 'packagings_stock_nonnegative: constraint exists with a DIFFERENT definition; manual review required';
    END IF;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'roasting_target_positive' AND conrelid = 'parent_roasting_batches'::regclass) THEN
    EXECUTE $q$ALTER TABLE "parent_roasting_batches" ADD CONSTRAINT "roasting_target_positive" CHECK ("targetWeightKg" > 0)$q$;
  ELSE
    CREATE TEMP TABLE "_inv_verify_roasting_target_positive" (LIKE "parent_roasting_batches") ON COMMIT DROP;
    ALTER TABLE "_inv_verify_roasting_target_positive" ADD CONSTRAINT "_inv_verify_chk" CHECK ("targetWeightKg" > 0);
    IF NOT EXISTS (
      SELECT 1
      FROM pg_constraint c
      JOIN pg_constraint d ON d.conrelid = '_inv_verify_roasting_target_positive'::regclass AND d.conname = '_inv_verify_chk'
      WHERE c.conname = 'roasting_target_positive' AND c.conrelid = 'parent_roasting_batches'::regclass
        AND replace(pg_get_constraintdef(c.oid), ' ', '') = replace(pg_get_constraintdef(d.oid), ' ', '')
    ) THEN
      RAISE EXCEPTION 'roasting_target_positive: constraint exists with a DIFFERENT definition; manual review required';
    END IF;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'roasting_output_valid' AND conrelid = 'parent_roasting_batches'::regclass) THEN
    EXECUTE $q$ALTER TABLE "parent_roasting_batches" ADD CONSTRAINT "roasting_output_valid" CHECK ("actualOutputKg" IS NULL OR ("actualOutputKg" > 0 AND "actualOutputKg" < "targetWeightKg"))$q$;
  ELSE
    CREATE TEMP TABLE "_inv_verify_roasting_output_valid" (LIKE "parent_roasting_batches") ON COMMIT DROP;
    ALTER TABLE "_inv_verify_roasting_output_valid" ADD CONSTRAINT "_inv_verify_chk" CHECK ("actualOutputKg" IS NULL OR ("actualOutputKg" > 0 AND "actualOutputKg" < "targetWeightKg"));
    IF NOT EXISTS (
      SELECT 1
      FROM pg_constraint c
      JOIN pg_constraint d ON d.conrelid = '_inv_verify_roasting_output_valid'::regclass AND d.conname = '_inv_verify_chk'
      WHERE c.conname = 'roasting_output_valid' AND c.conrelid = 'parent_roasting_batches'::regclass
        AND replace(pg_get_constraintdef(c.oid), ' ', '') = replace(pg_get_constraintdef(d.oid), ' ', '')
    ) THEN
      RAISE EXCEPTION 'roasting_output_valid: constraint exists with a DIFFERENT definition; manual review required';
    END IF;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'roasting_completed_has_output' AND conrelid = 'parent_roasting_batches'::regclass) THEN
    EXECUTE $q$ALTER TABLE "parent_roasting_batches" ADD CONSTRAINT "roasting_completed_has_output" CHECK (status <> 'COMPLETED' OR "actualOutputKg" IS NOT NULL)$q$;
  ELSE
    CREATE TEMP TABLE "_inv_verify_roasting_completed_has_output" (LIKE "parent_roasting_batches") ON COMMIT DROP;
    ALTER TABLE "_inv_verify_roasting_completed_has_output" ADD CONSTRAINT "_inv_verify_chk" CHECK (status <> 'COMPLETED' OR "actualOutputKg" IS NOT NULL);
    IF NOT EXISTS (
      SELECT 1
      FROM pg_constraint c
      JOIN pg_constraint d ON d.conrelid = '_inv_verify_roasting_completed_has_output'::regclass AND d.conname = '_inv_verify_chk'
      WHERE c.conname = 'roasting_completed_has_output' AND c.conrelid = 'parent_roasting_batches'::regclass
        AND replace(pg_get_constraintdef(c.oid), ' ', '') = replace(pg_get_constraintdef(d.oid), ' ', '')
    ) THEN
      RAISE EXCEPTION 'roasting_completed_has_output: constraint exists with a DIFFERENT definition; manual review required';
    END IF;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'production_values_positive' AND conrelid = 'production_batches'::regclass) THEN
    EXECUTE $q$ALTER TABLE "production_batches" ADD CONSTRAINT "production_values_positive" CHECK ("unitsProduced" > 0 AND "totalRbUsedKg" > 0 AND "hppPerUnit" >= 0)$q$;
  ELSE
    CREATE TEMP TABLE "_inv_verify_production_values_positive" (LIKE "production_batches") ON COMMIT DROP;
    ALTER TABLE "_inv_verify_production_values_positive" ADD CONSTRAINT "_inv_verify_chk" CHECK ("unitsProduced" > 0 AND "totalRbUsedKg" > 0 AND "hppPerUnit" >= 0);
    IF NOT EXISTS (
      SELECT 1
      FROM pg_constraint c
      JOIN pg_constraint d ON d.conrelid = '_inv_verify_production_values_positive'::regclass AND d.conname = '_inv_verify_chk'
      WHERE c.conname = 'production_values_positive' AND c.conrelid = 'production_batches'::regclass
        AND replace(pg_get_constraintdef(c.oid), ' ', '') = replace(pg_get_constraintdef(d.oid), ' ', '')
    ) THEN
      RAISE EXCEPTION 'production_values_positive: constraint exists with a DIFFERENT definition; manual review required';
    END IF;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'invoice_item_values_valid' AND conrelid = 'invoice_items'::regclass) THEN
    EXECUTE $q$ALTER TABLE "invoice_items" ADD CONSTRAINT "invoice_item_values_valid" CHECK (quantity > 0 AND "unitPrice" >= 0 AND discount >= 0 AND discount <= "unitPrice" AND subtotal >= 0 AND hpp >= 0)$q$;
  ELSE
    CREATE TEMP TABLE "_inv_verify_invoice_item_values_valid" (LIKE "invoice_items") ON COMMIT DROP;
    ALTER TABLE "_inv_verify_invoice_item_values_valid" ADD CONSTRAINT "_inv_verify_chk" CHECK (quantity > 0 AND "unitPrice" >= 0 AND discount >= 0 AND discount <= "unitPrice" AND subtotal >= 0 AND hpp >= 0);
    IF NOT EXISTS (
      SELECT 1
      FROM pg_constraint c
      JOIN pg_constraint d ON d.conrelid = '_inv_verify_invoice_item_values_valid'::regclass AND d.conname = '_inv_verify_chk'
      WHERE c.conname = 'invoice_item_values_valid' AND c.conrelid = 'invoice_items'::regclass
        AND replace(pg_get_constraintdef(c.oid), ' ', '') = replace(pg_get_constraintdef(d.oid), ' ', '')
    ) THEN
      RAISE EXCEPTION 'invoice_item_values_valid: constraint exists with a DIFFERENT definition; manual review required';
    END IF;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'invoice_values_valid' AND conrelid = 'invoices'::regclass) THEN
    EXECUTE $q$ALTER TABLE "invoices" ADD CONSTRAINT "invoice_values_valid" CHECK (subtotal >= 0 AND discount >= 0 AND tax >= 0 AND "shippingCost" >= 0 AND "grandTotal" >= 0 AND "paidAmount" >= 0 AND "paidAmount" <= "grandTotal" + 0.01)$q$;
  ELSE
    CREATE TEMP TABLE "_inv_verify_invoice_values_valid" (LIKE "invoices") ON COMMIT DROP;
    ALTER TABLE "_inv_verify_invoice_values_valid" ADD CONSTRAINT "_inv_verify_chk" CHECK (subtotal >= 0 AND discount >= 0 AND tax >= 0 AND "shippingCost" >= 0 AND "grandTotal" >= 0 AND "paidAmount" >= 0 AND "paidAmount" <= "grandTotal" + 0.01);
    IF NOT EXISTS (
      SELECT 1
      FROM pg_constraint c
      JOIN pg_constraint d ON d.conrelid = '_inv_verify_invoice_values_valid'::regclass AND d.conname = '_inv_verify_chk'
      WHERE c.conname = 'invoice_values_valid' AND c.conrelid = 'invoices'::regclass
        AND replace(pg_get_constraintdef(c.oid), ' ', '') = replace(pg_get_constraintdef(d.oid), ' ', '')
    ) THEN
      RAISE EXCEPTION 'invoice_values_valid: constraint exists with a DIFFERENT definition; manual review required';
    END IF;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'expense_amount_positive' AND conrelid = 'expenses'::regclass) THEN
    EXECUTE $q$ALTER TABLE "expenses" ADD CONSTRAINT "expense_amount_positive" CHECK (amount > 0)$q$;
  ELSE
    CREATE TEMP TABLE "_inv_verify_expense_amount_positive" (LIKE "expenses") ON COMMIT DROP;
    ALTER TABLE "_inv_verify_expense_amount_positive" ADD CONSTRAINT "_inv_verify_chk" CHECK (amount > 0);
    IF NOT EXISTS (
      SELECT 1
      FROM pg_constraint c
      JOIN pg_constraint d ON d.conrelid = '_inv_verify_expense_amount_positive'::regclass AND d.conname = '_inv_verify_chk'
      WHERE c.conname = 'expense_amount_positive' AND c.conrelid = 'expenses'::regclass
        AND replace(pg_get_constraintdef(c.oid), ' ', '') = replace(pg_get_constraintdef(d.oid), ' ', '')
    ) THEN
      RAISE EXCEPTION 'expense_amount_positive: constraint exists with a DIFFERENT definition; manual review required';
    END IF;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'payment_amount_positive' AND conrelid = 'payments'::regclass) THEN
    EXECUTE $q$ALTER TABLE "payments" ADD CONSTRAINT "payment_amount_positive" CHECK (amount > 0)$q$;
  ELSE
    CREATE TEMP TABLE "_inv_verify_payment_amount_positive" (LIKE "payments") ON COMMIT DROP;
    ALTER TABLE "_inv_verify_payment_amount_positive" ADD CONSTRAINT "_inv_verify_chk" CHECK (amount > 0);
    IF NOT EXISTS (
      SELECT 1
      FROM pg_constraint c
      JOIN pg_constraint d ON d.conrelid = '_inv_verify_payment_amount_positive'::regclass AND d.conname = '_inv_verify_chk'
      WHERE c.conname = 'payment_amount_positive' AND c.conrelid = 'payments'::regclass
        AND replace(pg_get_constraintdef(c.oid), ' ', '') = replace(pg_get_constraintdef(d.oid), ' ', '')
    ) THEN
      RAISE EXCEPTION 'payment_amount_positive: constraint exists with a DIFFERENT definition; manual review required';
    END IF;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'supplier_payment_amount_positive' AND conrelid = 'supplier_payments'::regclass) THEN
    EXECUTE $q$ALTER TABLE "supplier_payments" ADD CONSTRAINT "supplier_payment_amount_positive" CHECK (amount > 0)$q$;
  ELSE
    CREATE TEMP TABLE "_inv_verify_supplier_payment_amount_positive" (LIKE "supplier_payments") ON COMMIT DROP;
    ALTER TABLE "_inv_verify_supplier_payment_amount_positive" ADD CONSTRAINT "_inv_verify_chk" CHECK (amount > 0);
    IF NOT EXISTS (
      SELECT 1
      FROM pg_constraint c
      JOIN pg_constraint d ON d.conrelid = '_inv_verify_supplier_payment_amount_positive'::regclass AND d.conname = '_inv_verify_chk'
      WHERE c.conname = 'supplier_payment_amount_positive' AND c.conrelid = 'supplier_payments'::regclass
        AND replace(pg_get_constraintdef(c.oid), ' ', '') = replace(pg_get_constraintdef(d.oid), ' ', '')
    ) THEN
      RAISE EXCEPTION 'supplier_payment_amount_positive: constraint exists with a DIFFERENT definition; manual review required';
    END IF;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'purchase_payment_values_valid' AND conrelid = 'purchases'::regclass) THEN
    EXECUTE $q$ALTER TABLE "purchases" ADD CONSTRAINT "purchase_payment_values_valid" CHECK ("paidAmount" >= 0 AND "paidAmount" <= "totalCost" + 0.01 AND (status <> 'COMPLETED' OR ("paymentStatus" = 'UNPAID' AND "paidAmount" <= 0.01) OR ("paymentStatus" = 'PARTIAL' AND "paidAmount" > 0.01 AND "paidAmount" < "totalCost" - 0.01) OR ("paymentStatus" = 'PAID' AND "paidAmount" >= "totalCost" - 0.01)))$q$;
  ELSE
    CREATE TEMP TABLE "_inv_verify_purchase_payment_values_valid" (LIKE "purchases") ON COMMIT DROP;
    ALTER TABLE "_inv_verify_purchase_payment_values_valid" ADD CONSTRAINT "_inv_verify_chk" CHECK ("paidAmount" >= 0 AND "paidAmount" <= "totalCost" + 0.01 AND (status <> 'COMPLETED' OR ("paymentStatus" = 'UNPAID' AND "paidAmount" <= 0.01) OR ("paymentStatus" = 'PARTIAL' AND "paidAmount" > 0.01 AND "paidAmount" < "totalCost" - 0.01) OR ("paymentStatus" = 'PAID' AND "paidAmount" >= "totalCost" - 0.01)));
    IF NOT EXISTS (
      SELECT 1
      FROM pg_constraint c
      JOIN pg_constraint d ON d.conrelid = '_inv_verify_purchase_payment_values_valid'::regclass AND d.conname = '_inv_verify_chk'
      WHERE c.conname = 'purchase_payment_values_valid' AND c.conrelid = 'purchases'::regclass
        AND replace(pg_get_constraintdef(c.oid), ' ', '') = replace(pg_get_constraintdef(d.oid), ' ', '')
    ) THEN
      RAISE EXCEPTION 'purchase_payment_values_valid: constraint exists with a DIFFERENT definition; manual review required';
    END IF;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'purchase_credit_requires_due_date' AND conrelid = 'purchases'::regclass) THEN
    EXECUTE $q$ALTER TABLE "purchases" ADD CONSTRAINT "purchase_credit_requires_due_date" CHECK (status <> 'COMPLETED' OR "paymentStatus" = 'PAID' OR "dueDate" IS NOT NULL)$q$;
  ELSE
    CREATE TEMP TABLE "_inv_verify_purchase_credit_requires_due_date" (LIKE "purchases") ON COMMIT DROP;
    ALTER TABLE "_inv_verify_purchase_credit_requires_due_date" ADD CONSTRAINT "_inv_verify_chk" CHECK (status <> 'COMPLETED' OR "paymentStatus" = 'PAID' OR "dueDate" IS NOT NULL);
    IF NOT EXISTS (
      SELECT 1
      FROM pg_constraint c
      JOIN pg_constraint d ON d.conrelid = '_inv_verify_purchase_credit_requires_due_date'::regclass AND d.conname = '_inv_verify_chk'
      WHERE c.conname = 'purchase_credit_requires_due_date' AND c.conrelid = 'purchases'::regclass
        AND replace(pg_get_constraintdef(c.oid), ' ', '') = replace(pg_get_constraintdef(d.oid), ' ', '')
    ) THEN
      RAISE EXCEPTION 'purchase_credit_requires_due_date: constraint exists with a DIFFERENT definition; manual review required';
    END IF;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'void_purchase_has_no_payment_balance' AND conrelid = 'purchases'::regclass) THEN
    EXECUTE $q$ALTER TABLE "purchases" ADD CONSTRAINT "void_purchase_has_no_payment_balance" CHECK (status <> 'VOID' OR "paidAmount" <= 0.01)$q$;
  ELSE
    CREATE TEMP TABLE "_inv_verify_void_purchase_has_no_payment_balance" (LIKE "purchases") ON COMMIT DROP;
    ALTER TABLE "_inv_verify_void_purchase_has_no_payment_balance" ADD CONSTRAINT "_inv_verify_chk" CHECK (status <> 'VOID' OR "paidAmount" <= 0.01);
    IF NOT EXISTS (
      SELECT 1
      FROM pg_constraint c
      JOIN pg_constraint d ON d.conrelid = '_inv_verify_void_purchase_has_no_payment_balance'::regclass AND d.conname = '_inv_verify_chk'
      WHERE c.conname = 'void_purchase_has_no_payment_balance' AND c.conrelid = 'purchases'::regclass
        AND replace(pg_get_constraintdef(c.oid), ' ', '') = replace(pg_get_constraintdef(d.oid), ' ', '')
    ) THEN
      RAISE EXCEPTION 'void_purchase_has_no_payment_balance: constraint exists with a DIFFERENT definition; manual review required';
    END IF;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cupping_scores_range_check' AND conrelid = 'cupping_scores'::regclass) THEN
    EXECUTE $q$ALTER TABLE "cupping_scores" ADD CONSTRAINT "cupping_scores_range_check" CHECK ("score" >= 0 AND "maxScore" > 0 AND "score" <= "maxScore")$q$;
  ELSE
    CREATE TEMP TABLE "_inv_verify_cupping_scores_range_check" (LIKE "cupping_scores") ON COMMIT DROP;
    ALTER TABLE "_inv_verify_cupping_scores_range_check" ADD CONSTRAINT "_inv_verify_chk" CHECK ("score" >= 0 AND "maxScore" > 0 AND "score" <= "maxScore");
    IF NOT EXISTS (
      SELECT 1
      FROM pg_constraint c
      JOIN pg_constraint d ON d.conrelid = '_inv_verify_cupping_scores_range_check'::regclass AND d.conname = '_inv_verify_chk'
      WHERE c.conname = 'cupping_scores_range_check' AND c.conrelid = 'cupping_scores'::regclass
        AND replace(pg_get_constraintdef(c.oid), ' ', '') = replace(pg_get_constraintdef(d.oid), ' ', '')
    ) THEN
      RAISE EXCEPTION 'cupping_scores_range_check: constraint exists with a DIFFERENT definition; manual review required';
    END IF;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'contract_prices_quantity_check' AND conrelid = 'contract_prices'::regclass) THEN
    EXECUTE $q$ALTER TABLE "contract_prices" ADD CONSTRAINT "contract_prices_quantity_check" CHECK ("minOrderQty" >= 0)$q$;
  ELSE
    CREATE TEMP TABLE "_inv_verify_contract_prices_quantity_check" (LIKE "contract_prices") ON COMMIT DROP;
    ALTER TABLE "_inv_verify_contract_prices_quantity_check" ADD CONSTRAINT "_inv_verify_chk" CHECK ("minOrderQty" >= 0);
    IF NOT EXISTS (
      SELECT 1
      FROM pg_constraint c
      JOIN pg_constraint d ON d.conrelid = '_inv_verify_contract_prices_quantity_check'::regclass AND d.conname = '_inv_verify_chk'
      WHERE c.conname = 'contract_prices_quantity_check' AND c.conrelid = 'contract_prices'::regclass
        AND replace(pg_get_constraintdef(c.oid), ' ', '') = replace(pg_get_constraintdef(d.oid), ' ', '')
    ) THEN
      RAISE EXCEPTION 'contract_prices_quantity_check: constraint exists with a DIFFERENT definition; manual review required';
    END IF;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'contract_prices_value_check' AND conrelid = 'contract_prices'::regclass) THEN
    EXECUTE $q$ALTER TABLE "contract_prices" ADD CONSTRAINT "contract_prices_value_check" CHECK (("pricePerKg" IS NOT NULL AND "pricePerKg" >= 0) OR ("pricePerUnit" IS NOT NULL AND "pricePerUnit" >= 0))$q$;
  ELSE
    CREATE TEMP TABLE "_inv_verify_contract_prices_value_check" (LIKE "contract_prices") ON COMMIT DROP;
    ALTER TABLE "_inv_verify_contract_prices_value_check" ADD CONSTRAINT "_inv_verify_chk" CHECK (("pricePerKg" IS NOT NULL AND "pricePerKg" >= 0) OR ("pricePerUnit" IS NOT NULL AND "pricePerUnit" >= 0));
    IF NOT EXISTS (
      SELECT 1
      FROM pg_constraint c
      JOIN pg_constraint d ON d.conrelid = '_inv_verify_contract_prices_value_check'::regclass AND d.conname = '_inv_verify_chk'
      WHERE c.conname = 'contract_prices_value_check' AND c.conrelid = 'contract_prices'::regclass
        AND replace(pg_get_constraintdef(c.oid), ' ', '') = replace(pg_get_constraintdef(d.oid), ' ', '')
    ) THEN
      RAISE EXCEPTION 'contract_prices_value_check: constraint exists with a DIFFERENT definition; manual review required';
    END IF;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tenant_payment_methods_manual_shape_check' AND conrelid = 'tenant_payment_methods'::regclass) THEN
    EXECUTE $q$ALTER TABLE "tenant_payment_methods" ADD CONSTRAINT "tenant_payment_methods_manual_shape_check" CHECK (("method" = 'TRANSFER' AND "bankName" IS NOT NULL AND "accountNumber" IS NOT NULL AND "accountHolder" IS NOT NULL) OR ("method" = 'QRIS' AND "qrisImageUrl" IS NOT NULL) OR ("method" IN ('CASH', 'CREDIT')))$q$;
  ELSE
    CREATE TEMP TABLE "_inv_verify_tenant_payment_methods_manual_shape_check" (LIKE "tenant_payment_methods") ON COMMIT DROP;
    ALTER TABLE "_inv_verify_tenant_payment_methods_manual_shape_check" ADD CONSTRAINT "_inv_verify_chk" CHECK (("method" = 'TRANSFER' AND "bankName" IS NOT NULL AND "accountNumber" IS NOT NULL AND "accountHolder" IS NOT NULL) OR ("method" = 'QRIS' AND "qrisImageUrl" IS NOT NULL) OR ("method" IN ('CASH', 'CREDIT')));
    IF NOT EXISTS (
      SELECT 1
      FROM pg_constraint c
      JOIN pg_constraint d ON d.conrelid = '_inv_verify_tenant_payment_methods_manual_shape_check'::regclass AND d.conname = '_inv_verify_chk'
      WHERE c.conname = 'tenant_payment_methods_manual_shape_check' AND c.conrelid = 'tenant_payment_methods'::regclass
        AND replace(pg_get_constraintdef(c.oid), ' ', '') = replace(pg_get_constraintdef(d.oid), ' ', '')
    ) THEN
      RAISE EXCEPTION 'tenant_payment_methods_manual_shape_check: constraint exists with a DIFFERENT definition; manual review required';
    END IF;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 2. Partial unique index: live_sessions_active_unique
--    (schema.prisma cannot express WHERE clauses on indexes)
-- ---------------------------------------------------------------------------

DO $$
DECLARE
  v_dup BIGINT;
  v_def TEXT;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = current_schema() AND indexname = 'live_sessions_active_unique') THEN
    SELECT count(*) INTO v_dup
    FROM "live_sessions"
    WHERE "status" = 'ACTIVE'
    GROUP BY "tenantId", "machineId"
    HAVING count(*) > 1;
    IF v_dup > 0 THEN
      RAISE EXCEPTION 'live_sessions_active_unique: % row group(s) have duplicate ACTIVE sessions; reconcile before adoption', v_dup;
    END IF;
    EXECUTE $q$CREATE UNIQUE INDEX "live_sessions_active_unique" ON "live_sessions" ("tenantId", "machineId") WHERE "status" = 'ACTIVE'$q$;
  ELSE
    SELECT replace(regexp_replace(indexdef, E'ON [A-Za-z0-9_]+\\.live_sessions', 'ON live_sessions', 'g'), ' ', '') INTO v_def
    FROM pg_indexes
    WHERE schemaname = current_schema() AND indexname = 'live_sessions_active_unique';
    IF v_def <> replace($q$CREATE UNIQUE INDEX live_sessions_active_unique ON live_sessions USING btree ("tenantId", "machineId") WHERE (status = 'ACTIVE'::"LiveSessionStatus")$q$, ' ', '')
       AND v_def <> replace($q$CREATE UNIQUE INDEX live_sessions_active_unique ON live_sessions USING btree ("tenantId", "machineId") WHERE ("status" = 'ACTIVE'::"LiveSessionStatus")$q$, ' ', '') THEN
      RAISE EXCEPTION 'live_sessions_active_unique: index exists with a DIFFERENT definition; manual review required';
    END IF;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 3. journal_entries idempotency preflight (data check only)
--    The unique index itself is emitted by the baseline
--    (journal_entries_tenantId_refType_reference_key, @@unique in
--    schema.prisma). On existing databases during adoption the index may not
--    exist yet — this block makes adoption fail-fast instead of allowing the
--    baseline's index creation to trip over duplicates.
-- ---------------------------------------------------------------------------

DO $$
DECLARE
  v_dup BIGINT;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = current_schema() AND indexname = 'journal_entries_tenantId_refType_reference_key') THEN
    SELECT count(*) INTO v_dup
    FROM (
      SELECT 1
      FROM "journal_entries"
      WHERE "refType" IS NOT NULL AND "reference" IS NOT NULL
      GROUP BY "tenantId", "refType", "reference"
      HAVING count(*) > 1
    ) d;
    IF v_dup > 0 THEN
      RAISE EXCEPTION 'journal_entries: % duplicate (tenantId, refType, reference) rows exist; reconcile before adoption', v_dup;
    END IF;
  END IF;
END $$;

-- =============================================================================
-- End of preserved domain invariants.
-- =============================================================================
