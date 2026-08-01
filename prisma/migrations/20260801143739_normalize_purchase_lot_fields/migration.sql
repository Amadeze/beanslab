-- AlterTable
-- Single source of truth for lot/FEFO facts is now the `lots` table
-- (batchCode, expiryDate). No application code reads these columns.
ALTER TABLE "purchases" DROP COLUMN "lotNumber";
ALTER TABLE "purchases" DROP COLUMN "bestBeforeDate";
