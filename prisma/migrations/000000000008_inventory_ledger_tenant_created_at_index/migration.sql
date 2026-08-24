-- Migration: inventory_ledger_tenant_created_at_index
-- Adds a (tenantId, createdAt) index to inventory_ledger.
-- Serves date-range queries that span products (mutation history, period reports)
-- which previously had to scan every ledger row of a tenant.

CREATE INDEX IF NOT EXISTS "inventory_ledger_tenantId_createdAt_idx"
  ON "inventory_ledger" ("tenantId", "createdAt");
