-- Phase 2F.1B — Finance idempotency & concurrency hardening.
-- Semua kolom NULLABLE → backward-compatible, tanpa backfill
-- (PostgreSQL unique index mengizinkan banyak NULL).
-- Pre-check duplikat reversalOfLedgerId telah dilakukan (0 duplikat).

-- Expense: idempotency key untuk createExpense
ALTER TABLE "expenses" ADD COLUMN "operationKey" TEXT;
CREATE UNIQUE INDEX "expenses_tenantId_operationKey_key"
  ON "expenses"("tenantId", "operationKey");

-- SupplierPayment: idempotency key untuk recordSupplierPayment
ALTER TABLE "supplier_payments" ADD COLUMN "operationKey" TEXT;
CREATE UNIQUE INDEX "supplier_payments_tenantId_operationKey_key"
  ON "supplier_payments"("tenantId", "operationKey");

-- CreditNote: idempotency key untuk createCreditNote
ALTER TABLE "credit_notes" ADD COLUMN "operationKey" TEXT;
CREATE UNIQUE INDEX "credit_notes_tenantId_operationKey_key"
  ON "credit_notes"("tenantId", "operationKey");

-- CapitalTransaction: idempotency key untuk recordOwnerWithdrawal / recordCapitalInjection
ALTER TABLE "capital_transactions" ADD COLUMN "operationKey" TEXT;
CREATE UNIQUE INDEX "capital_transactions_tenantId_operationKey_key"
  ON "capital_transactions"("tenantId", "operationKey");

-- Hard guard anti double-restore: satu reversal per baris sumber
-- (melindungi voidInvoice & payment-expiry dari race double stock restore).
CREATE UNIQUE INDEX "inventory_ledger_tenantId_reversalOfLedgerId_key"
  ON "inventory_ledger"("tenantId", "reversalOfLedgerId");