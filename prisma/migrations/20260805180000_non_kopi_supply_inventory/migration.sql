-- =============================================================================
-- Migration: Non-Kopi Supply Inventory Foundation (Phase 1, additive only)
-- New objects/columns only. No DROP, no data backfill (backfill is a separate
-- patch script, not a migration).
-- =============================================================================

-- CreateEnum
CREATE TYPE "InventorySupplyCategory" AS ENUM ('PACKAGING', 'INGREDIENT', 'CONSUMABLE', 'MERCHANDISE', 'SPARE_PART', 'EQUIPMENT', 'OTHER');

-- CreateEnum
CREATE TYPE "SupplyBaseUnit" AS ENUM ('KG', 'GRAM', 'LITER', 'METER', 'ROLL', 'PCS', 'BOX', 'SET', 'OTHER');

-- AlterEnum (one statement per value: PG restriction on ADD VALUE usage)
ALTER TYPE "PurchaseType" ADD VALUE 'SUPPLY';
ALTER TYPE "LedgerRefType" ADD VALUE 'SUPPLY_PURCHASE_IN';
ALTER TYPE "LedgerRefType" ADD VALUE 'SUPPLY_PRODUCTION_OUT';
ALTER TYPE "LedgerRefType" ADD VALUE 'SUPPLY_ADJUSTMENT_IN';
ALTER TYPE "LedgerRefType" ADD VALUE 'SUPPLY_ADJUSTMENT_OUT';

-- AlterTable: products (net weight for catalog display)
ALTER TABLE "products" ADD COLUMN "netWeightGrams" DECIMAL(8,2);

-- AlterTable: packagings (1:1 mapping to InventorySupplyItem)
ALTER TABLE "packagings" ADD COLUMN "supplyItemId" TEXT;

-- AlterTable: purchases (SUPPLY branch)
ALTER TABLE "purchases" ADD COLUMN "supplyItemId" TEXT;
ALTER TABLE "purchases" ADD COLUMN "supplyQuantity" DECIMAL(12,3);

-- AlterTable: purchase_order_items (SUPPLY branch)
ALTER TABLE "purchase_order_items" ADD COLUMN "supplyItemId" TEXT;
ALTER TABLE "purchase_order_items" ADD COLUMN "supplyQuantity" DECIMAL(12,3);

-- AlterTable: lots (supply subject, fractional quantity in baseUnit)
ALTER TABLE "lots" ADD COLUMN "supplyItemId" TEXT;
ALTER TABLE "lots" ADD COLUMN "supplyQuantity" DECIMAL(12,3) NOT NULL DEFAULT 0;

-- AlterTable: inventory_ledger (supply subject, fractional quantity in baseUnit)
ALTER TABLE "inventory_ledger" ADD COLUMN "supplyItemId" TEXT;
ALTER TABLE "inventory_ledger" ADD COLUMN "supplyQuantity" DECIMAL(12,3);

-- CreateTable: inventory_supply_items
CREATE TABLE "inventory_supply_items" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" "InventorySupplyCategory" NOT NULL,
    "baseUnit" "SupplyBaseUnit" NOT NULL,
    "trackLot" BOOLEAN NOT NULL DEFAULT true,
    "shelfLifeDays" INTEGER,
    "consumableInProduction" BOOLEAN NOT NULL DEFAULT false,
    "includeInProductHpp" BOOLEAN NOT NULL DEFAULT false,
    "isSellable" BOOLEAN NOT NULL DEFAULT false,
    "capacityGrams" DECIMAL(8,2),
    "tareWeightGrams" DECIMAL(8,2),
    "costPerUnit" DECIMAL(12,2) NOT NULL,
    "avgCostPerUnit" DECIMAL(12,2) DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "stockQuantity" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "reorderAlertEnabled" BOOLEAN NOT NULL DEFAULT false,
    "leadTimeDays" INTEGER NOT NULL DEFAULT 7,
    "safetyStockQuantity" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "reorderLookbackDays" INTEGER NOT NULL DEFAULT 30,
    "tenantId" TEXT NOT NULL,
    CONSTRAINT "inventory_supply_items_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable: recipe_supply_items (multi-supply recipe components: pouch, valve, label, box, ingredients)
CREATE TABLE "recipe_supply_items" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "recipeId" TEXT NOT NULL,
    "supplyItemId" TEXT NOT NULL,
    "quantityPerUnit" DECIMAL(12,3) NOT NULL,
    "tenantId" TEXT NOT NULL,
    CONSTRAINT "recipe_supply_items_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "recipes"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "recipe_supply_items_supplyItemId_fkey" FOREIGN KEY ("supplyItemId") REFERENCES "inventory_supply_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "recipe_supply_items_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable: production_supply_usages (actual usage + cost snapshot per batch)
CREATE TABLE "production_supply_usages" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "productionBatchId" TEXT NOT NULL,
    "supplyItemId" TEXT NOT NULL,
    "quantity" DECIMAL(12,3) NOT NULL,
    "unitCostSnapshot" DECIMAL(12,2) NOT NULL,
    "totalCostSnapshot" DECIMAL(14,2) NOT NULL,
    "tenantId" TEXT NOT NULL,
    CONSTRAINT "production_supply_usages_productionBatchId_fkey" FOREIGN KEY ("productionBatchId") REFERENCES "production_batches"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "production_supply_usages_supplyItemId_fkey" FOREIGN KEY ("supplyItemId") REFERENCES "inventory_supply_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "production_supply_usages_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "packagings_supplyItemId_key" ON "packagings"("supplyItemId");
CREATE UNIQUE INDEX "inventory_supply_items_tenantId_code_key" ON "inventory_supply_items"("tenantId", "code");
CREATE INDEX "inventory_supply_items_tenantId_category_isActive_idx" ON "inventory_supply_items"("tenantId", "category", "isActive");
CREATE UNIQUE INDEX "recipe_supply_items_recipeId_supplyItemId_key" ON "recipe_supply_items"("recipeId", "supplyItemId");
CREATE INDEX "recipe_supply_items_tenantId_idx" ON "recipe_supply_items"("tenantId");
CREATE UNIQUE INDEX "production_supply_usages_productionBatchId_supplyItemId_key" ON "production_supply_usages"("productionBatchId", "supplyItemId");
CREATE INDEX "production_supply_usages_tenantId_idx" ON "production_supply_usages"("tenantId");
CREATE INDEX "production_supply_usages_supplyItemId_idx" ON "production_supply_usages"("supplyItemId");
CREATE INDEX "lots_supplyItemId_idx" ON "lots"("tenantId", "supplyItemId");
CREATE INDEX "inventory_ledger_tenantId_supplyItemId_createdAt_idx" ON "inventory_ledger"("tenantId", "supplyItemId", "createdAt");

-- AddForeignKey
ALTER TABLE "packagings" ADD CONSTRAINT "packagings_supplyItemId_fkey"
    FOREIGN KEY ("supplyItemId") REFERENCES "inventory_supply_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_supplyItemId_fkey"
    FOREIGN KEY ("supplyItemId") REFERENCES "inventory_supply_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "purchase_order_items" ADD CONSTRAINT "purchase_order_items_supplyItemId_fkey"
    FOREIGN KEY ("supplyItemId") REFERENCES "inventory_supply_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "lots" ADD CONSTRAINT "lots_supplyItemId_fkey"
    FOREIGN KEY ("supplyItemId") REFERENCES "inventory_supply_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "inventory_ledger" ADD CONSTRAINT "inventory_ledger_supplyItemId_fkey"
    FOREIGN KEY ("supplyItemId") REFERENCES "inventory_supply_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;
