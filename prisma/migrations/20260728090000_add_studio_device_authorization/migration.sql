CREATE TYPE "StudioDeviceAuthorizationStatus" AS ENUM ('PENDING', 'APPROVED', 'CONSUMED', 'DENIED');

CREATE TABLE "studio_device_authorizations" (
    "id" TEXT NOT NULL,
    "deviceCodeHash" TEXT NOT NULL,
    "verificationCodeHash" TEXT NOT NULL,
    "installationId" TEXT NOT NULL,
    "computerName" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "appVersion" TEXT NOT NULL,
    "status" "StudioDeviceAuthorizationStatus" NOT NULL DEFAULT 'PENDING',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "approvedAt" TIMESTAMP(3),
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tenantId" TEXT,
    "machineId" TEXT,
    "approvedByUserId" TEXT,

    CONSTRAINT "studio_device_authorizations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "studio_device_authorizations_deviceCodeHash_key" ON "studio_device_authorizations"("deviceCodeHash");
CREATE UNIQUE INDEX "studio_device_authorizations_verificationCodeHash_key" ON "studio_device_authorizations"("verificationCodeHash");
CREATE INDEX "studio_device_authorizations_deviceCodeHash_idx" ON "studio_device_authorizations"("deviceCodeHash");
CREATE INDEX "studio_device_authorizations_verificationCodeHash_idx" ON "studio_device_authorizations"("verificationCodeHash");
CREATE INDEX "studio_device_authorizations_status_expiresAt_idx" ON "studio_device_authorizations"("status", "expiresAt");
CREATE INDEX "studio_device_authorizations_tenantId_idx" ON "studio_device_authorizations"("tenantId");
CREATE INDEX "studio_device_authorizations_machineId_idx" ON "studio_device_authorizations"("machineId");

ALTER TABLE "studio_device_authorizations" ADD CONSTRAINT "studio_device_authorizations_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "studio_device_authorizations" ADD CONSTRAINT "studio_device_authorizations_machineId_fkey" FOREIGN KEY ("machineId") REFERENCES "machines"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "studio_device_authorizations" ADD CONSTRAINT "studio_device_authorizations_approvedByUserId_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
