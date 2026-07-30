ALTER TABLE "cupping_sessions" ADD COLUMN "code" TEXT;

UPDATE "cupping_sessions"
SET "code" = 'CUPP-LEGACY-' || UPPER(SUBSTRING(MD5("id") FROM 1 FOR 10))
WHERE "code" IS NULL;

ALTER TABLE "cupping_sessions" ALTER COLUMN "code" SET NOT NULL;

CREATE UNIQUE INDEX "cupping_sessions_tenantId_code_key"
  ON "cupping_sessions"("tenantId", "code");
