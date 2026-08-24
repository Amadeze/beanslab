-- Migration: lot_intake_qc
-- Per-lot green-coffee intake quality attributes + QC hold lifecycle.
-- Existing lots default to RELEASED so FEFO behavior is unchanged.

CREATE TYPE "LotQcStatus" AS ENUM ('PENDING', 'RELEASED', 'HOLD');

ALTER TABLE "lots"
  ADD COLUMN IF NOT EXISTS "qcStatus"          "LotQcStatus" NOT NULL DEFAULT 'RELEASED',
  ADD COLUMN IF NOT EXISTS "supplierLotNumber" TEXT,
  ADD COLUMN IF NOT EXISTS "moisturePct"       DECIMAL(5,2),
  ADD COLUMN IF NOT EXISTS "humidityPct"       DECIMAL(5,2),
  ADD COLUMN IF NOT EXISTS "harvestDate"       TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "defectCount"       INTEGER;

CREATE INDEX IF NOT EXISTS "lots_tenantId_qcStatus_idx"
  ON "lots" ("tenantId", "qcStatus");
