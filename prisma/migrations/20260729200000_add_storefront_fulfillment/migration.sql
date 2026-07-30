CREATE TYPE "StockReservationStatus" AS ENUM ('ACTIVE', 'CONSUMED', 'RELEASED', 'EXPIRED');
CREATE TYPE "FulfillmentStatus" AS ENUM ('AWAITING_PAYMENT', 'PAID', 'NEEDS_PRODUCTION', 'READY_TO_PACK', 'PACKED', 'SHIPPED', 'DELIVERED', 'CANCELLED');
CREATE TYPE "FulfillmentTaskStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

ALTER TABLE "tenants"
  ADD COLUMN "storefrontPickupEnabled" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "storefrontDeliveryEnabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "storefrontFlatShippingRate" DECIMAL(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN "storefrontFreeShippingMinimum" DECIMAL(14,2),
  ADD COLUMN "storefrontTaxRate" DECIMAL(5,2) NOT NULL DEFAULT 0,
  ADD COLUMN "storefrontReservationMinutes" INTEGER NOT NULL DEFAULT 1440;

ALTER TABLE "invoices"
  ADD COLUMN "publicOrderToken" TEXT,
  ADD COLUMN "fulfillmentStatus" "FulfillmentStatus" NOT NULL DEFAULT 'AWAITING_PAYMENT',
  ADD COLUMN "reservationExpiresAt" TIMESTAMP(3),
  ADD COLUMN "paidAt" TIMESTAMP(3),
  ADD COLUMN "packedAt" TIMESTAMP(3),
  ADD COLUMN "shippedAt" TIMESTAMP(3),
  ADD COLUMN "deliveredAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "invoices_publicOrderToken_key" ON "invoices"("publicOrderToken");

CREATE TABLE "stock_reservations" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "invoiceId" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL,
  "status" "StockReservationStatus" NOT NULL DEFAULT 'ACTIVE',
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "consumedAt" TIMESTAMP(3),
  "releasedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "stock_reservations_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "stock_reservations_invoiceId_productId_key" ON "stock_reservations"("invoiceId", "productId");
CREATE INDEX "stock_reservations_tenantId_status_expiresAt_idx" ON "stock_reservations"("tenantId", "status", "expiresAt");
CREATE INDEX "stock_reservations_tenantId_productId_status_idx" ON "stock_reservations"("tenantId", "productId", "status");
ALTER TABLE "stock_reservations" ADD CONSTRAINT "stock_reservations_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "stock_reservations" ADD CONSTRAINT "stock_reservations_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "stock_reservations" ADD CONSTRAINT "stock_reservations_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "fulfillment_tasks" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "invoiceId" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "requestedQuantity" INTEGER NOT NULL,
  "reservedQuantity" INTEGER NOT NULL,
  "shortageQuantity" INTEGER NOT NULL,
  "status" "FulfillmentTaskStatus" NOT NULL DEFAULT 'OPEN',
  "notes" TEXT,
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "fulfillment_tasks_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "fulfillment_tasks_invoiceId_productId_key" ON "fulfillment_tasks"("invoiceId", "productId");
CREATE INDEX "fulfillment_tasks_tenantId_status_createdAt_idx" ON "fulfillment_tasks"("tenantId", "status", "createdAt");
CREATE INDEX "fulfillment_tasks_tenantId_productId_status_idx" ON "fulfillment_tasks"("tenantId", "productId", "status");
ALTER TABLE "fulfillment_tasks" ADD CONSTRAINT "fulfillment_tasks_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "fulfillment_tasks" ADD CONSTRAINT "fulfillment_tasks_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "fulfillment_tasks" ADD CONSTRAINT "fulfillment_tasks_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
