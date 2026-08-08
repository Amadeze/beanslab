-- AlterEnum
ALTER TYPE "LedgerRefType" ADD VALUE 'EXPERIMENTAL_COMPONENT_OUT';
ALTER TYPE "LedgerRefType" ADD VALUE 'EXPERIMENTAL_FG_IN';

-- CreateTable
CREATE TABLE "experimental_productions" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "code" TEXT NOT NULL,
    "operationKey" TEXT,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "TransactionStatus" NOT NULL DEFAULT 'COMPLETED',
    "outputProductId" TEXT NOT NULL,
    "inputKg" DECIMAL(10,3) NOT NULL,
    "outputKg" DECIMAL(10,3) NOT NULL,
    "lossKg" DECIMAL(10,3) NOT NULL,
    "hppPerUnit" DECIMAL(12,2) NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT NOT NULL,

    CONSTRAINT "experimental_productions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "experimental_production_components" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "experimentalProductionId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "componentType" TEXT NOT NULL,
    "productId" TEXT,
    "supplyItemId" TEXT,
    "quantityKg" DECIMAL(10,3),
    "quantityUnit" DECIMAL(10,0),
    "supplyQuantity" DECIMAL(12,3),
    "unitCostSnapshot" DECIMAL(12,2) NOT NULL,
    "totalCostSnapshot" DECIMAL(14,2) NOT NULL,
    "lotId" TEXT,
    "lotNumber" TEXT,
    "notes" TEXT,

    CONSTRAINT "experimental_production_components_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "experimental_productions_tenantId_code_key" ON "experimental_productions"("tenantId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "experimental_productions_tenantId_operationKey_key" ON "experimental_productions"("tenantId", "operationKey");

-- CreateIndex
CREATE INDEX "experimental_productions_tenantId_createdAt_idx" ON "experimental_productions"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "experimental_production_components_tenantId_idx" ON "experimental_production_components"("tenantId");

-- CreateIndex
CREATE INDEX "experimental_production_components_experimentalProductionId_idx" ON "experimental_production_components"("experimentalProductionId");

-- AddForeignKey
ALTER TABLE "experimental_productions" ADD CONSTRAINT "experimental_productions_outputProductId_fkey" FOREIGN KEY ("outputProductId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "experimental_productions" ADD CONSTRAINT "experimental_productions_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "experimental_productions" ADD CONSTRAINT "experimental_productions_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "experimental_production_components" ADD CONSTRAINT "experimental_production_components_experimentalProductionId_fkey" FOREIGN KEY ("experimentalProductionId") REFERENCES "experimental_productions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "experimental_production_components" ADD CONSTRAINT "experimental_production_components_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "experimental_production_components" ADD CONSTRAINT "experimental_production_components_supplyItemId_fkey" FOREIGN KEY ("supplyItemId") REFERENCES "inventory_supply_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "experimental_production_components" ADD CONSTRAINT "experimental_production_components_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
