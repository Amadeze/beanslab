-- Migration: cupping_sca_composite
-- Adds SCA composite scoring + green-lot traceability to cupping sessions.
-- totalScore is computed server-side on write; existing rows stay null until
-- recomputed (UI falls back to the raw /110 total when null).

ALTER TABLE "cupping_sessions"
  ADD COLUMN IF NOT EXISTS "lotId"       TEXT,
  ADD COLUMN IF NOT EXISTS "defectCount" INTEGER,
  ADD COLUMN IF NOT EXISTS "totalScore"  DOUBLE PRECISION;

CREATE INDEX IF NOT EXISTS "cupping_sessions_lotId_idx" ON "cupping_sessions" ("lotId");

-- FK (guarded for re-runs)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'cupping_sessions_lotId_fkey'
  ) THEN
    ALTER TABLE "cupping_sessions"
      ADD CONSTRAINT "cupping_sessions_lotId_fkey"
      FOREIGN KEY ("lotId") REFERENCES "lots"("id")
      ON DELETE SET NULL ON UPDATE NO ACTION;
  END IF;
END $$;
