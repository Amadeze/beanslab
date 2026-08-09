-- CreateEnum
CREATE TYPE "LocationTransferStatus" AS ENUM ('PENDING', 'COMPLETED', 'VOID');

-- CreateTable
CREATE TABLE "location_transfers" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "lotId" TEXT NOT NULL,
    "sourceLocationId" TEXT NOT NULL,
    "destinationLocationId" TEXT NOT NULL,
    "quantityKg" DECIMAL(12,3),
    "quantityUnit" INTEGER,
    "supplyQty" DECIMAL(12,3),
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "completedAt" TIMESTAMP(3),
    "voidAt" TIMESTAMP(3),
    "voidReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "location_transfers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "location_transfers_tenantId_status_idx" ON "location_transfers"("tenantId", "status");

-- CreateIndex
CREATE INDEX "location_transfers_tenantId_lotId_idx" ON "location_transfers"("tenantId", "lotId");

-- CreateIndex
CREATE INDEX "location_transfers_tenantId_sourceLocationId_idx" ON "location_transfers"("tenantId", "sourceLocationId");

-- CreateIndex
CREATE INDEX "location_transfers_tenantId_destinationLocationId_idx" ON "location_transfers"("tenantId", "destinationLocationId");

-- AddForeignKey
ALTER TABLE "location_transfers" ADD CONSTRAINT "location_transfers_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "location_transfers" ADD CONSTRAINT "location_transfers_lotId_fkey" FOREIGN KEY ("lotId") REFERENCES "lots"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "location_transfers" ADD CONSTRAINT "location_transfers_sourceLocationId_fkey" FOREIGN KEY ("sourceLocationId") REFERENCES "locations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "location_transfers" ADD CONSTRAINT "location_transfers_destinationLocationId_fkey" FOREIGN KEY ("destinationLocationId") REFERENCES "locations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "location_transfers" ADD CONSTRAINT "location_transfers_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
