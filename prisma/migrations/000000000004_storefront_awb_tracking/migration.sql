-- Phase 2H Batch 4 — AWB / shipment tracking for COURIER storefront orders.
-- Additive-only: creates invoice_tracking table, no existing tables modified.

-- CreateTable
CREATE TABLE "invoice_tracking" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "awb" TEXT NOT NULL,
    "courierCode" TEXT NOT NULL,
    "providerStatus" TEXT,
    "providerDelivered" BOOLEAN,
    "events" JSONB,
    "lastRefreshedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "invoice_tracking_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "invoice_tracking_invoiceId_key" ON "invoice_tracking"("invoiceId");

-- CreateIndex
CREATE INDEX "invoice_tracking_tenantId_invoiceId_idx" ON "invoice_tracking"("tenantId", "invoiceId");

-- AddForeignKey
ALTER TABLE "invoice_tracking" ADD CONSTRAINT "invoice_tracking_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_tracking" ADD CONSTRAINT "invoice_tracking_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;
