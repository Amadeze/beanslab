-- CreateEnum
CREATE TYPE "OfferingSourceMode" AS ENUM ('INTERNAL_ROAST', 'PURCHASED_ROASTED');
-- AlterTable
ALTER TABLE "stock_reservations" ADD COLUMN     "quantityKg" DECIMAL(10,3);
-- AlterTable
ALTER TABLE "invoice_items" ADD COLUMN     "netWeightGrams" DECIMAL(8,2),
ADD COLUMN     "offeringId" TEXT,
ADD COLUMN     "offeringName" TEXT,
ADD COLUMN     "packageName" TEXT,
ADD COLUMN     "roastLevel" TEXT;
-- CreateTable
CREATE TABLE "coffee_offerings" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "imageUrl" TEXT,
    "coffeeSourceId" TEXT NOT NULL,
    "sourceMode" "OfferingSourceMode" NOT NULL,
    "roastLevel" TEXT,
    "grindOptions" "GrindSize"[] DEFAULT ARRAY['WHOLE_BEAN']::"GrindSize"[],
    "allowCustomGrind" BOOLEAN NOT NULL DEFAULT true,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "tenantId" TEXT NOT NULL,
    CONSTRAINT "coffee_offerings_pkey" PRIMARY KEY ("id")
);
-- CreateTable
CREATE TABLE "offering_variants" (
    "id" TEXT NOT NULL,
    "offeringId" TEXT NOT NULL,
    "supplyItemId" TEXT,
    "packageName" TEXT NOT NULL,
    "netWeightGrams" DECIMAL(8,2) NOT NULL,
    "unitPrice" DECIMAL(12,2) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "tenantId" TEXT NOT NULL,
    CONSTRAINT "offering_variants_pkey" PRIMARY KEY ("id")
);
-- CreateIndex
CREATE INDEX "coffee_offerings_tenantId_isActive_sortOrder_idx" ON "coffee_offerings"("tenantId", "isActive", "sortOrder");
-- CreateIndex
CREATE INDEX "coffee_offerings_tenantId_coffeeSourceId_idx" ON "coffee_offerings"("tenantId", "coffeeSourceId");
-- CreateIndex
CREATE UNIQUE INDEX "coffee_offerings_tenantId_code_key" ON "coffee_offerings"("tenantId", "code");
-- CreateIndex
CREATE INDEX "offering_variants_tenantId_offeringId_isActive_idx" ON "offering_variants"("tenantId", "offeringId", "isActive");
-- CreateIndex
CREATE UNIQUE INDEX "offering_variants_offeringId_supplyItemId_key" ON "offering_variants"("offeringId", "supplyItemId");
-- CreateIndex
CREATE INDEX "invoice_items_offeringId_idx" ON "invoice_items"("offeringId");
-- AddForeignKey
ALTER TABLE "coffee_offerings" ADD CONSTRAINT "coffee_offerings_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "coffee_offerings" ADD CONSTRAINT "coffee_offerings_coffeeSourceId_fkey" FOREIGN KEY ("coffeeSourceId") REFERENCES "coffee_sources"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "offering_variants" ADD CONSTRAINT "offering_variants_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "offering_variants" ADD CONSTRAINT "offering_variants_offeringId_fkey" FOREIGN KEY ("offeringId") REFERENCES "coffee_offerings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "offering_variants" ADD CONSTRAINT "offering_variants_supplyItemId_fkey" FOREIGN KEY ("supplyItemId") REFERENCES "inventory_supply_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "invoice_items" ADD CONSTRAINT "invoice_items_offeringId_fkey" FOREIGN KEY ("offeringId") REFERENCES "coffee_offerings"("id") ON DELETE SET NULL ON UPDATE CASCADE;
