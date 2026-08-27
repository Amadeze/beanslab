-- Phase 2H Batch 8 — B2B storefront essentials.
-- Additive-only: structured contract credit policy and customer PO snapshot.

ALTER TABLE "contracts"
  ADD COLUMN "allowCredit" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "paymentTermsDays" INTEGER;

ALTER TABLE "invoices"
  ADD COLUMN "purchaseOrderReference" TEXT;

ALTER TABLE "contracts"
  ADD CONSTRAINT "contracts_paymentTermsDays_check"
  CHECK ("paymentTermsDays" IS NULL OR ("paymentTermsDays" >= 1 AND "paymentTermsDays" <= 365));
