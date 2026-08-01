-- Add tenant-level tax settings (PPN toggle + default rate).
-- Additive; safe to apply at deploy time. Existing tenants keep tax disabled
-- (taxEnabled = false) so historical behavior is preserved.

ALTER TABLE "tenants" ADD COLUMN "taxEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "tenants" ADD COLUMN "defaultTaxRate" DECIMAL(5,2) NOT NULL DEFAULT 11;
