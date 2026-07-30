ALTER TABLE "purchase_orders"
ADD COLUMN "estimatedShippingCost" DECIMAL(12,2) NOT NULL DEFAULT 0;
