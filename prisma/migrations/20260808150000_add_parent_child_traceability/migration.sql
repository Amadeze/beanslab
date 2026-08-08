-- AlterTable
ALTER TABLE "production_batches" ADD COLUMN "parentRoastBatchId" TEXT;

-- AlterTable
ALTER TABLE "grinding_batches" ADD COLUMN "parentRoastBatchId" TEXT;

-- AlterTable
ALTER TABLE "experimental_productions" ADD COLUMN "parentRoastBatchId" TEXT;

-- AddForeignKey
ALTER TABLE "production_batches" ADD CONSTRAINT "production_batches_parentRoastBatchId_fkey" FOREIGN KEY ("parentRoastBatchId") REFERENCES "parent_roasting_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grinding_batches" ADD CONSTRAINT "grinding_batches_parentRoastBatchId_fkey" FOREIGN KEY ("parentRoastBatchId") REFERENCES "parent_roasting_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "experimental_productions" ADD CONSTRAINT "experimental_productions_parentRoastBatchId_fkey" FOREIGN KEY ("parentRoastBatchId") REFERENCES "parent_roasting_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;
