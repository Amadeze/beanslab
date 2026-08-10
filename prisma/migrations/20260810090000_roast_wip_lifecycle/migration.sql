CREATE TYPE "RoastLifecycleStatus" AS ENUM ('PLANNED', 'RESERVED', 'CHARGED', 'COMPLETED', 'ABORTED', 'CANCELLED');
CREATE TYPE "RoastMaterialReservationStatus" AS ENUM ('ACTIVE', 'CHARGED', 'RELEASED', 'CONSUMED');

ALTER TABLE "parent_roasting_batches"
  ADD COLUMN "lifecycleStatus" "RoastLifecycleStatus" NOT NULL DEFAULT 'PLANNED';

ALTER TABLE "locations"
  ADD COLUMN "isSystem" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "systemPurpose" TEXT;

CREATE TABLE "roast_material_reservations" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "parentBatchId" TEXT NOT NULL,
  "lotId" TEXT NOT NULL,
  "sourceLocationId" TEXT NOT NULL,
  "quantityKg" DECIMAL(12,3) NOT NULL,
  "status" "RoastMaterialReservationStatus" NOT NULL DEFAULT 'ACTIVE',
  "chargeTransferId" TEXT,
  "releasedAt" TIMESTAMP(3),
  "consumedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "roast_material_reservations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "roast_material_reservations_parentBatchId_lotId_sourceLocationId_key" ON "roast_material_reservations"("parentBatchId", "lotId", "sourceLocationId");
CREATE INDEX "roast_material_reservations_tenantId_status_idx" ON "roast_material_reservations"("tenantId", "status");
CREATE INDEX "roast_material_reservations_tenantId_lotId_status_idx" ON "roast_material_reservations"("tenantId", "lotId", "status");
ALTER TABLE "roast_material_reservations" ADD CONSTRAINT "roast_material_reservations_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "roast_material_reservations" ADD CONSTRAINT "roast_material_reservations_parentBatchId_fkey" FOREIGN KEY ("parentBatchId") REFERENCES "parent_roasting_batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "roast_material_reservations" ADD CONSTRAINT "roast_material_reservations_lotId_fkey" FOREIGN KEY ("lotId") REFERENCES "lots"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "roast_material_reservations" ADD CONSTRAINT "roast_material_reservations_sourceLocationId_fkey" FOREIGN KEY ("sourceLocationId") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
