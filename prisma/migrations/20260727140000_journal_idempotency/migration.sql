-- A source transaction may produce at most one journal entry per tenant.
-- Fail safely when historical duplicates exist; reconcile them before retrying deploy.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "journal_entries"
    WHERE "refType" IS NOT NULL AND "reference" IS NOT NULL
    GROUP BY "tenantId", "refType", "reference"
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Duplicate journal source references exist; run reconciliation before applying journal idempotency';
  END IF;
END $$;

CREATE UNIQUE INDEX "journal_entries_tenantId_refType_reference_key"
  ON "journal_entries"("tenantId", "refType", "reference");
