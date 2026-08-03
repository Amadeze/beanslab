import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { runTrackedJob } from "./job-runner";
import { resolveTestDatabaseUrl } from "../../test/setup/test-database-guard";

// Gated integration test: only runs against an isolated PostgreSQL test
// database with RUN_INTEGRATION=true + TEST_DATABASE_URL set. The suite builds
// its own Prisma client from TEST_DATABASE_URL; it NEVER reads
// DATABASE_URL/DIRECT_URL (the development/production databases) and refuses
// to run when the test URL aliases either of them or targets a non-local host.
const integrationEnabled = process.env.RUN_INTEGRATION === "true";
const suite = integrationEnabled ? describe : describe.skip;

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

suite("runTrackedJob — real PostgreSQL (TEST_DATABASE_URL)", () => {
  let client: PrismaClient;
  const runKeys: string[] = [];
  const trackRunKey = (label: string) => {
    const key = `${label}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;
    runKeys.push(key);
    return key;
  };

  beforeAll(async () => {
    const pool = new Pool({ connectionString: resolveTestDatabaseUrl(), max: 5 });
    client = new PrismaClient({ adapter: new PrismaPg(pool) });
    await client.$connect();
  });

  afterAll(async () => {
    if (client) {
      await client.jobRun.deleteMany({ where: { runKey: { in: runKeys } } });
      await client.$disconnect();
    }
  });

  it("claims a fresh runKey and SUCCEEDED is final for that runKey", async () => {
    const runKey = trackRunKey("job-runner:final");
    let workCalls = 0;

    const first = await runTrackedJob(client, { jobName: "it", runKey }, async () => {
      workCalls += 1;
      return { value: "first" };
    });
    expect(first.skipped).toBe(false);
    expect(first.result).toEqual({ value: "first" });

    const second = await runTrackedJob(client, { jobName: "it", runKey }, async () => {
      workCalls += 1;
      return { value: "second" };
    });
    expect(second.skipped).toBe(true);
    expect(second.result).toEqual({ value: "first" });
    expect(workCalls).toBe(1);

    const row = await client.jobRun.findUnique({ where: { runKey } });
    expect(row?.status).toBe("SUCCEEDED");
    expect(row?.attempt).toBe(1);
    expect(row?.claimToken).not.toBeNull();
  });

  it("runs exactly one callback for five parallel callers on the same runKey", async () => {
    const runKey = trackRunKey("job-runner:parallel-same");
    let workCalls = 0;

    const results = await Promise.all(
      Array.from({ length: 5 }, () =>
        runTrackedJob(
          client,
          { jobName: "it", runKey, leaseMs: 30_000 },
          async () => {
            workCalls += 1;
            await delay(150);
            return { value: "winner" };
          },
        ),
      ),
    );

    expect(workCalls).toBe(1);
    expect(results.filter((r) => !r.skipped)).toHaveLength(1);
    expect(results.filter((r) => r.skipped).every((r) => r.result === null)).toBe(true);

    const row = await client.jobRun.findUnique({ where: { runKey } });
    expect(row?.status).toBe("SUCCEEDED");
    expect(row?.attempt).toBe(1);
  });

  it("runs two different runKeys in parallel", async () => {
    const runKeyA = trackRunKey("job-runner:parallel-a");
    const runKeyB = trackRunKey("job-runner:parallel-b");
    let started = 0;
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const timeout = delay(3_000).then(() => release());

    const [resultA, resultB] = await Promise.all([
      runTrackedJob(client, { jobName: "it", runKey: runKeyA, leaseMs: 30_000 }, async () => {
        started += 1;
        if (started === 2) release();
        await gate;
        return "a";
      }),
      runTrackedJob(client, { jobName: "it", runKey: runKeyB, leaseMs: 30_000 }, async () => {
        started += 1;
        if (started === 2) release();
        await gate;
        return "b";
      }),
    ]);
    void timeout;

    expect(started).toBe(2);
    expect(resultA.skipped).toBe(false);
    expect(resultA.result).toBe("a");
    expect(resultB.skipped).toBe(false);
    expect(resultB.result).toBe("b");
  });

  it("reclaims a FAILED run (retry) and increments the attempt", async () => {
    const runKey = trackRunKey("job-runner:retry");
    let workCalls = 0;

    await expect(
      runTrackedJob(client, { jobName: "it", runKey }, async () => {
        workCalls += 1;
        throw new Error("first attempt failed");
      }),
    ).rejects.toThrow("first attempt failed");

    let failed = await client.jobRun.findUnique({ where: { runKey } });
    expect(failed?.status).toBe("FAILED");
    expect(failed?.attempt).toBe(1);

    const retry = await runTrackedJob(client, { jobName: "it", runKey }, async () => {
      workCalls += 1;
      return { value: "recovered" };
    });
    expect(retry.skipped).toBe(false);
    expect(retry.result).toEqual({ value: "recovered" });
    expect(workCalls).toBe(2);

    failed = await client.jobRun.findUnique({ where: { runKey } });
    expect(failed?.status).toBe("SUCCEEDED");
    expect(failed?.attempt).toBe(2);
    expect(failed?.claimToken).not.toBeNull();
  });

  it("skips while another worker holds an active lease", async () => {
    const runKey = trackRunKey("job-runner:active-lease");
    await client.jobRun.create({
      data: { jobName: "it", runKey, status: "RUNNING", startedAt: new Date(), claimToken: "manual-token" },
    });
    let workCalls = 0;

    const result = await runTrackedJob(
      client,
      { jobName: "it", runKey, leaseMs: 60_000 },
      async () => {
        workCalls += 1;
        return "should-not-run";
      },
    );

    expect(result).toEqual({ skipped: true, result: null });
    expect(workCalls).toBe(0);
  });

  it("takes over a RUNNING run whose lease expired", async () => {
    const runKey = trackRunKey("job-runner:expired-lease");
    await client.jobRun.create({
      data: {
        jobName: "it",
        runKey,
        status: "RUNNING",
        startedAt: new Date(Date.now() - 120_000),
        claimToken: "stale-token",
      },
    });
    let workCalls = 0;

    const result = await runTrackedJob(
      client,
      { jobName: "it", runKey, leaseMs: 60_000 },
      async () => {
        workCalls += 1;
        return { value: "took-over" };
      },
    );

    expect(result.skipped).toBe(false);
    expect(result.result).toEqual({ value: "took-over" });
    expect(workCalls).toBe(1);
    const row = await client.jobRun.findUnique({ where: { runKey } });
    expect(row?.status).toBe("SUCCEEDED");
    expect(row?.attempt).toBe(2);
    expect(row?.claimToken).not.toBe("stale-token");
  });

  it("stale worker cannot overwrite the worker that reclaimed the lease", async () => {
    const runKey = trackRunKey("job-runner:stale-worker");

    const first = runTrackedJob(
      client,
      { jobName: "it", runKey, leaseMs: 150 },
      async () => {
        await delay(400);
        return { value: "stale" };
      },
    );

    await delay(200); // first worker's lease has now expired

    const second = await runTrackedJob(
      client,
      { jobName: "it", runKey, leaseMs: 150 },
      async () => {
        await delay(50);
        return { value: "owner" };
      },
    );
    expect(second.skipped).toBe(false);
    expect(second.result).toEqual({ value: "owner" });

    const firstOutcome = await first;
    expect(firstOutcome.skipped).toBe(true);
    expect(firstOutcome.result).toBeNull();

    const row = await client.jobRun.findUnique({ where: { runKey } });
    expect(row?.status).toBe("SUCCEEDED");
    expect(row?.summary).toEqual({ value: "owner" });
    expect(row?.attempt).toBe(2);
  });
});
