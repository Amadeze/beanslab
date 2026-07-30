-- Repair authentication columns from a previously recorded but incomplete deploy.
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "failedLoginAttempts" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "lockedUntil" TIMESTAMP(3);

CREATE TABLE "contracts" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "contractNumber" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "terms" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "contracts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "contract_prices" (
    "id" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "tierName" TEXT NOT NULL,
    "minOrderQty" DECIMAL(12,2) NOT NULL,
    "pricePerKg" DECIMAL(14,2),
    "pricePerUnit" DECIMAL(14,2),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "tenantId" TEXT NOT NULL,
    CONSTRAINT "contract_prices_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "contract_prices_quantity_check" CHECK ("minOrderQty" >= 0),
    CONSTRAINT "contract_prices_value_check" CHECK (
        ("pricePerKg" IS NOT NULL AND "pricePerKg" >= 0)
        OR ("pricePerUnit" IS NOT NULL AND "pricePerUnit" >= 0)
    )
);

CREATE INDEX "contracts_tenantId_idx" ON "contracts"("tenantId");
CREATE INDEX "contracts_customerId_idx" ON "contracts"("customerId");
CREATE UNIQUE INDEX "contracts_tenantId_customerId_contractNumber_key"
    ON "contracts"("tenantId", "customerId", "contractNumber");
CREATE INDEX "contract_prices_contractId_idx" ON "contract_prices"("contractId");
CREATE INDEX "contract_prices_productId_idx" ON "contract_prices"("productId");
CREATE INDEX "contract_prices_tenantId_idx" ON "contract_prices"("tenantId");
CREATE UNIQUE INDEX "contract_prices_tenantId_contractId_productId_tierName_minOrderQty_key"
    ON "contract_prices"("tenantId", "contractId", "productId", "tierName", "minOrderQty");

ALTER TABLE "contracts" ADD CONSTRAINT "contracts_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_customerId_fkey"
    FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "contract_prices" ADD CONSTRAINT "contract_prices_contractId_fkey"
    FOREIGN KEY ("contractId") REFERENCES "contracts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "contract_prices" ADD CONSTRAINT "contract_prices_productId_fkey"
    FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "contract_prices" ADD CONSTRAINT "contract_prices_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
