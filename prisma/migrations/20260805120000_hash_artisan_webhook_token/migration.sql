-- AlterTable
ALTER TABLE "tenants" ADD COLUMN "artisanWebhookTokenHash" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "tenants_artisanWebhookTokenHash_key" ON "tenants"("artisanWebhookTokenHash");