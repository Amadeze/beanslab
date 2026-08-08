-- CreateTable
CREATE TABLE "lot_placements" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "lotId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "quantityKg" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "quantityUnit" INTEGER NOT NULL DEFAULT 0,
    "supplyQty" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lot_placements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "lot_placements_tenantId_lotId_locationId_key" ON "lot_placements"("tenantId", "lotId", "locationId");

-- CreateIndex
CREATE INDEX "lot_placements_tenantId_locationId_idx" ON "lot_placements"("tenantId", "locationId");

-- CreateIndex
CREATE INDEX "lot_placements_tenantId_lotId_idx" ON "lot_placements"("tenantId", "lotId");

-- AddForeignKey
ALTER TABLE "lot_placements" ADD CONSTRAINT "lot_placements_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lot_placements" ADD CONSTRAINT "lot_placements_lotId_fkey" FOREIGN KEY ("lotId") REFERENCES "lots"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lot_placements" ADD CONSTRAINT "lot_placements_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "locations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
