-- Single active LiveSession per (tenantId, machineId).
--
-- A partial unique index enforces the invariant at the database level:
-- at most one row whose status = 'ACTIVE' may exist per (tenantId, machineId).
-- Sessions in any other status (COMPLETED, RECONCILED) may accumulate freely,
-- so session history is not limited to a single row.
--
-- Prisma schema cannot express partial unique indexes, so this is applied via
-- raw SQL in the migration. Do NOT add @@unique([tenantId, machineId, status])
-- to prisma/schema.prisma: that constraint would wrongly limit COMPLETED /
-- RECONCILED history to one row per machine.
--
-- Note: on machines where `prisma migrate dev` works, the shadow database is
-- built from this migration history, so the index is preserved; only a diff
-- against prisma/schema.prisma may list it as unexpected (it is additive and
-- must not be dropped).
--
-- Fail-fast preflight: refuse to create the index while duplicate ACTIVE
-- sessions exist for the same (tenantId, machineId). Read-only check; it never
-- repairs or removes rows, it only aborts the migration so the problem can be
-- handled explicitly before the index is added.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "live_sessions"
    WHERE "status" = 'ACTIVE'
    GROUP BY "tenantId", "machineId"
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION
      'Cannot create live_sessions_active_unique: duplicate ACTIVE sessions exist';
  END IF;
END
$$;

-- Rollback: DROP INDEX "live_sessions_active_unique";
CREATE UNIQUE INDEX "live_sessions_active_unique"
  ON "live_sessions" ("tenantId", "machineId")
  WHERE "status" = 'ACTIVE';