-- =============================================================================
-- Migration: Add Lot / FEFO Traceability Module
-- =============================================================================

-- Create lots table
CREATE TABLE "lots" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "productId" TEXT,
    "packagingId" TEXT,
    "supplierId" TEXT,
    "batchCode" TEXT NOT NULL,
    "purchaseId" TEXT,
    "quantityKg" DECIMAL(12, 2) NOT NULL DEFAULT 0,
    "quantityUnit" DECIMAL(12, 2) NOT NULL DEFAULT 0,
    "expiryDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "consumedAt" TIMESTAMP(3),
    "notes" TEXT,
    CONSTRAINT "lots_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE,
    CONSTRAINT "lots_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE SET NULL,
    CONSTRAINT "lots_packagingId_fkey" FOREIGN KEY ("packagingId") REFERENCES "packagings"("id") ON DELETE SET NULL,
    CONSTRAINT "lots_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE SET NULL,
    CONSTRAINT "lots_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES "purchases"("id") ON DELETE SET NULL,
    CONSTRAINT "lots_tenantId_batchCode_unique" UNIQUE ("tenantId", "batchCode")
);

CREATE INDEX "lots_tenantId_idx" ON "lots"("tenantId");
CREATE INDEX "lots_batchCode_idx" ON "lots"("tenantId", "batchCode");
CREATE INDEX "lots_productId_idx" ON "lots"("tenantId", "productId");
CREATE INDEX "lots_packagingId_idx" ON "lots"("tenantId", "packagingId");
CREATE INDEX "lots_supplierId_idx" ON "lots"("tenantId", "supplierId");
CREATE INDEX "lots_purchaseId_idx" ON "lots"("tenantId", "purchaseId");
CREATE INDEX "lots_expiryDate_idx" ON "lots"("tenantId", "expiryDate");

-- Add lotId to inventory_ledger
ALTER TABLE "inventory_ledger" ADD COLUMN "lotId" TEXT;

ALTER TABLE "inventory_ledger" ADD CONSTRAINT "inventory_ledger_lotId_fkey"
    FOREIGN KEY ("lotId") REFERENCES "lots"("id") ON DELETE SET NULL;
CREATE INDEX "inventory_ledger_lotId_idx" ON "inventory_ledger"("lotId");
