CREATE TYPE "SalePriceSource" AS ENUM ('BASE', 'TIER', 'CONTRACT');

ALTER TABLE "invoice_items"
  ADD COLUMN "priceSource" "SalePriceSource" NOT NULL DEFAULT 'BASE',
  ADD COLUMN "contractPriceId" TEXT;

CREATE INDEX "invoice_items_contractPriceId_idx" ON "invoice_items"("contractPriceId");

ALTER TABLE "invoice_items"
  ADD CONSTRAINT "invoice_items_contractPriceId_fkey"
  FOREIGN KEY ("contractPriceId") REFERENCES "contract_prices"("id")
  ON DELETE SET NULL ON UPDATE NO ACTION;
