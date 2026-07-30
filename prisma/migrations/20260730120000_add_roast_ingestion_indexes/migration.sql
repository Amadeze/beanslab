-- Tenant dashboards list imports chronologically and inspect failures by status.
DROP INDEX IF EXISTS "artisan_roast_imports_tenantId_idx";
CREATE INDEX "artisan_roast_imports_tenantId_uploadedAt_idx"
  ON "artisan_roast_imports"("tenantId", "uploadedAt");
CREATE INDEX "artisan_roast_imports_tenantId_status_uploadedAt_idx"
  ON "artisan_roast_imports"("tenantId", "status", "uploadedAt");

-- Roast history is tenant-scoped and ordered/filtered by roast date.
DROP INDEX IF EXISTS "roasts_tenantId_idx";
CREATE INDEX "roasts_tenantId_roastDate_idx"
  ON "roasts"("tenantId", "roastDate");
