-- Manual web uploads have no Artisan/Studio connector; the hardcoded
-- connectorId "manual-upload" previously required a hidden roastd_studios
-- row. Make the column optional instead.
-- AlterTable
ALTER TABLE "artisan_roast_imports" ALTER COLUMN "connectorId" DROP NOT NULL;
