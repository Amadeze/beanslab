-- The unique constraint on (tenantId, batchCode) already provides this index.
DROP INDEX IF EXISTS "lots_batchCode_idx";
