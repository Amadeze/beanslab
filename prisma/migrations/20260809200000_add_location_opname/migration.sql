-- CreateEnum
CREATE TYPE "LocationOpnameStatus" AS ENUM ('DRAFT', 'CONFIRMED', 'CANCELLED');

-- Add LOCATION_OPNAME refTypes to LedgerRefType enum (additive)
ALTER TYPE "LedgerRefType" ADD VALUE "LOCATION_OPNAME_IN";
ALTER TYPE "LedgerRefType" ADD VALUE "LOCATION_OPNAME_OUT";

-- CreateTable
CREATE TABLE "location_opnames" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "lotId" TEXT NOT NULL,
    "systemQuantityKg" DECIMAL(12,3),
    "systemQuantityUnit" INTEGER,
    "systemSupplyQty" DECIMAL(12,3),
    "countedQuantityKg" DECIMAL(12,3),
    "countedQuantityUnit" INTEGER,
    "countedSupplyQty" DECIMAL(12,3),
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "confirmedAt" TIMESTAMP(3),
    "confirmedById" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "cancelReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT NOT NULL,

    CONSTRAINT "location_opnames_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "location_opnames_tenantId_status_idx" ON "location_opnames"("tenantId", "status");

-- CreateIndex
CREATE INDEX "location_opnames_tenantId_locationId_idx" ON "location_opnames"("tenantId", "locationId");

-- CreateIndex
CREATE INDEX "location_opnames_tenantId_lotId_idx" ON "location_opnames"("tenantId", "lotId");

-- AddForeignKey
ALTER TABLE "location_opnames" ADD CONSTRAINT "location_opnames_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "location_opnames" ADD CONSTRAINT "location_opnames_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "locations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "location_opnames" ADD CONSTRAINT "location_opnames_lotId_fkey" FOREIGN KEY ("lotId") REFERENCES "lots"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "location_opnames" ADD CONSTRAINT "location_opnames_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "location_opnames" ADD CONSTRAINT "location_opnames_confirmedById_fkey" FOREIGN KEY ("confirmedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
