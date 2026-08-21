-- Phase 2H Batch 3 — Storefront shipping checkout integration.
-- Forward-only migration appended after 000000000002_tenant_shipping_rajaongkir.
-- No unrelated drops, no reset, safe defaults for existing tenants.

-- AddColumns (Invoice shipping snapshot for national courier)
ALTER TABLE "invoices" ADD COLUMN "shippingCourierCode" TEXT;
ALTER TABLE "invoices" ADD COLUMN "shippingServiceCode" TEXT;
ALTER TABLE "invoices" ADD COLUMN "shippingServiceName" TEXT;
ALTER TABLE "invoices" ADD COLUMN "shippingEtd" TEXT;
ALTER TABLE "invoices" ADD COLUMN "shipmentWeightGrams" INTEGER;
ALTER TABLE "invoices" ADD COLUMN "shippingSnapshot" JSONB;
ALTER TABLE "invoices" ADD COLUMN "cartFingerprint" TEXT;
ALTER TABLE "invoices" ADD COLUMN "destinationProviderId" TEXT;
ALTER TABLE "invoices" ADD COLUMN "destinationSnapshot" JSONB;