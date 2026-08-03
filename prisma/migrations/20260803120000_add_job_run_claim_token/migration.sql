-- Job runner lease: a worker that claims a run writes a per-claim token so
-- completion is guarded by runKey + claimToken and a stale worker can never
-- overwrite the result of the worker that currently holds the lease.
ALTER TABLE "job_runs"
ADD COLUMN "claimToken" TEXT;
