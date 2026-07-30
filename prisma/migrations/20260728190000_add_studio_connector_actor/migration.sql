ALTER TABLE "artisan_connectors"
ADD COLUMN IF NOT EXISTS "authorizedByUserId" TEXT;

UPDATE "artisan_connectors" AS connector
SET "authorizedByUserId" = device_auth."approvedByUserId"
FROM "studio_device_authorizations" AS device_auth
WHERE device_auth."installationId" = connector."installationId"
  AND device_auth."approvedByUserId" IS NOT NULL
  AND connector."authorizedByUserId" IS NULL;

CREATE INDEX IF NOT EXISTS "artisan_connectors_authorizedByUserId_idx"
ON "artisan_connectors"("authorizedByUserId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'artisan_connectors_authorizedByUserId_fkey'
  ) THEN
    ALTER TABLE "artisan_connectors"
    ADD CONSTRAINT "artisan_connectors_authorizedByUserId_fkey"
    FOREIGN KEY ("authorizedByUserId") REFERENCES "users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
