-- =============================================================================
-- Coffee identity foundation: CoffeeSource + Product.materialOrigin
--
-- 1. CoffeeSource = identitas kopi akar (green coffee master). Bukan inventori.
-- 2. Product.coffeeSourceId menghubungkan GB/RB (dan lot) ke identitas.
-- 3. Product.materialOrigin membedakan RB sangrai internal vs beli jadi.
--
-- Backfill deterministik (tidak menebak nama/proses):
--   • Satu CoffeeSource dibuat dari setiap produk GREEN_BEAN yang sudah ada,
--     dengan id = id produk GB tersebut (mapping 1:1 eksak, tanpa join).
--   • Produk GB dihubungkan ke sumbernya sendiri.
--   • Produk ROASTED_BEAN dengan sourceGreenBeanId dihubungkan ke sumber
--     Green Bean-nya (sourceGreenBeanId == id CoffeeSource karena mapping 1:1).
--   • Ambigu (RB tanpa sourceGreenBeanId) dibiarkan NULL untuk pemetaan manual.
--   • materialOrigin ROASTED_BEAN yang ada = INTERNAL_ROAST (belum ada jalur
--     beli jadi saat ini, sehingga nilai ini eksak dan aman).
--   • Tidak ada perubahan InventoryLedger / stock cache (stockUnit/stockKg).
-- =============================================================================

-- CreateEnum
CREATE TYPE "MaterialOrigin" AS ENUM ('INTERNAL_ROAST', 'PURCHASED_ROASTED');

-- CreateTable
CREATE TABLE "coffee_sources" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "country" TEXT,
    "region" TEXT,
    "farm" TEXT,
    "species" TEXT,
    "varietal" TEXT,
    "processMethod" TEXT,
    "fermentationMethod" TEXT,
    "elevation" TEXT,
    "cropYear" TEXT,
    "certifications" TEXT[],
    "tastingNotes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "tenantId" TEXT NOT NULL,

    CONSTRAINT "coffee_sources_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "coffee_sources_tenantId_code_key" ON "coffee_sources"("tenantId", "code");

-- CreateIndex
CREATE INDEX "coffee_sources_tenantId_isActive_idx" ON "coffee_sources"("tenantId", "isActive");

-- AlterTable (kosongkan dulu: kolom diisi oleh backfill di bawah)
ALTER TABLE "products" ADD COLUMN "coffeeSourceId" TEXT;
ALTER TABLE "products" ADD COLUMN "materialOrigin" "MaterialOrigin";

-- =============================================================================
-- Backfill identitas (deterministik, tanpa inferensi nama/proses)
-- =============================================================================

-- 1. Satu CoffeeSource per produk GREEN_BEAN; id sumber = id produk GB.
INSERT INTO "coffee_sources" ("id", "tenantId", "code", "name", "country", "region", "species", "isActive", "createdAt", "updatedAt")
SELECT gb."id", gb."tenantId", gb."code", gb."name", NULL, gb."origin", gb."coffeeSpecies", true, gb."createdAt", gb."createdAt"
FROM "products" gb
WHERE gb."type" = 'GREEN_BEAN'
ORDER BY gb."createdAt", gb."id";

-- 2. Produk Green Bean dihubungkan ke identitasnya sendiri.
UPDATE "products" gb
SET "coffeeSourceId" = gb."id"
WHERE gb."type" = 'GREEN_BEAN';

-- 3. Roasted Bean dihubungkan ke identitas Green Bean sumbernya.
--    (sourceGreenBeanId == id CoffeeSource karena mapping 1:1 di atas.)
UPDATE "products" rb
SET "coffeeSourceId" = rb."sourceGreenBeanId"
WHERE rb."type" = 'ROASTED_BEAN'
  AND rb."sourceGreenBeanId" IS NOT NULL;

-- 4. materialOrigin: seluruh RB yang ada berasal dari sangrai internal.
UPDATE "products" rb
SET "materialOrigin" = 'INTERNAL_ROAST'
WHERE rb."type" = 'ROASTED_BEAN';

-- =============================================================================
-- Constraints & indexes
-- =============================================================================

-- CreateIndex
CREATE INDEX "products_tenantId_coffeeSourceId_idx" ON "products"("tenantId", "coffeeSourceId");

-- AddForeignKey
ALTER TABLE "coffee_sources"
ADD CONSTRAINT "coffee_sources_tenantId_fkey"
FOREIGN KEY ("tenantId") REFERENCES "tenants"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products"
ADD CONSTRAINT "products_coffeeSourceId_fkey"
FOREIGN KEY ("coffeeSourceId") REFERENCES "coffee_sources"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
