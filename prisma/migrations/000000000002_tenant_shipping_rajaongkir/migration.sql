-- Phase 2H Batch 2 — Tenant shipping origin + global RajaOngkir platform integration.
-- Forward-only migration appended after 000000000001_preserve_domain_invariants.
-- No unrelated drops, no reset, safe defaults for existing tenants.

-- CreateTable
CREATE TABLE "platform_integrations" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "encryptedApiKey" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "lastTestedAt" TIMESTAMP(3),
    "connectionStatus" TEXT,
    "lastConnectionError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "platform_integrations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "platform_integrations_provider_key" ON "platform_integrations"("provider");

-- AddColumns (Tenant shipping / RajaOngkir)
ALTER TABLE "tenants" ADD COLUMN "nationalCourierEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "tenants" ADD COLUMN "rajaOngkirOriginId" TEXT;
ALTER TABLE "tenants" ADD COLUMN "rajaOngkirOriginLabel" TEXT;
ALTER TABLE "tenants" ADD COLUMN "rajaOngkirOriginProvince" TEXT;
ALTER TABLE "tenants" ADD COLUMN "rajaOngkirOriginCity" TEXT;
ALTER TABLE "tenants" ADD COLUMN "rajaOngkirOriginDistrict" TEXT;
ALTER TABLE "tenants" ADD COLUMN "rajaOngkirOriginSubdistrict" TEXT;
ALTER TABLE "tenants" ADD COLUMN "rajaOngkirOriginPostalCode" TEXT;
ALTER TABLE "tenants" ADD COLUMN "rajaOngkirOriginStreet" TEXT;
ALTER TABLE "tenants" ADD COLUMN "rajaOngkirCourierCodes" JSONB;
ALTER TABLE "tenants" ADD COLUMN "rajaOngkirTareGrams" INTEGER NOT NULL DEFAULT 0;
