-- AlterTable
ALTER TABLE "coffee_offerings" ADD COLUMN     "lineageProductId" TEXT;

-- CreateIndex
CREATE INDEX "coffee_offerings_tenantId_lineageProductId_idx" ON "coffee_offerings"("tenantId", "lineageProductId");

-- AddForeignKey
ALTER TABLE "coffee_offerings" ADD CONSTRAINT "coffee_offerings_lineageProductId_fkey" FOREIGN KEY ("lineageProductId") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;
