-- CreateEnum
CREATE TYPE "GrindSize" AS ENUM ('WHOLE_BEAN', 'COARSE', 'MEDIUM_COARSE', 'MEDIUM', 'MEDIUM_FINE', 'FINE', 'ESPRESSO', 'CUSTOM');

-- AlterEnum
ALTER TYPE "LedgerRefType" ADD VALUE 'GRINDING_RB_OUT';

-- AlterEnum
ALTER TYPE "LedgerRefType" ADD VALUE 'GRINDING_FG_IN';

-- CreateTable
CREATE TABLE "grinding_batches" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "code" TEXT NOT NULL,
    "operationKey" TEXT,
    "tenantId" TEXT NOT NULL,
    "sourceProductId" TEXT NOT NULL,
    "outputProductId" TEXT NOT NULL,
    "grindSize" "GrindSize" NOT NULL,
    "customGrindLabel" TEXT,
    "grinderId" TEXT,
    "operatorId" TEXT NOT NULL,
    "inputKg" DECIMAL(10,3) NOT NULL,
    "outputKg" DECIMAL(10,3) NOT NULL,
    "lossKg" DECIMAL(10,3) NOT NULL,
    "grindingCost" DECIMAL(14,2) DEFAULT 0,
    "batchReference" TEXT,
    "notes" TEXT,
    "status" "TransactionStatus" NOT NULL DEFAULT 'COMPLETED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "grinding_batches_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "grinding_batches_tenantId_code_key" ON "grinding_batches"("tenantId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "grinding_batches_tenantId_operationKey_key" ON "grinding_batches"("tenantId", "operationKey");

-- CreateIndex
CREATE INDEX "grinding_batches_tenantId_createdAt_idx" ON "grinding_batches"("tenantId", "createdAt");

-- AddForeignKey
ALTER TABLE "grinding_batches" ADD CONSTRAINT "grinding_batches_sourceProductId_fkey" FOREIGN KEY ("sourceProductId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grinding_batches" ADD CONSTRAINT "grinding_batches_outputProductId_fkey" FOREIGN KEY ("outputProductId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grinding_batches" ADD CONSTRAINT "grinding_batches_grinderId_fkey" FOREIGN KEY ("grinderId") REFERENCES "machines"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grinding_batches" ADD CONSTRAINT "grinding_batches_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grinding_batches" ADD CONSTRAINT "grinding_batches_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
