import { describe, expect, it, vi } from "vitest";
import { cleanupOperationalData, summarizeCleanup, OPERATIONAL_CLEANUP } from "./operational-cleanup";

function makeStore(initialCount: number) {
  const model = {
    rows: Array.from({ length: initialCount }, (_, i) => `id-${i}`),
    findManyArgs: [] as any[],
    deleteManyArgs: [] as any[],
    updateManyArgs: [] as any[],
    findMany: vi.fn(),
    deleteMany: vi.fn(),
    updateMany: vi.fn(),
  };
  model.findMany.mockImplementation(async (args: any) => {
    model.findManyArgs.push(args);
    const take = args.take ?? initialCount;
    const batch = model.rows.slice(0, take);
    model.rows = model.rows.slice(batch.length);
    return batch.map((id) => ({ id, key: id }));
  });
  model.deleteMany.mockImplementation(async (args: any) => {
    model.deleteManyArgs.push(args);
    return { count: args.where.id?.in?.length ?? args.where.key?.in?.length ?? 0 };
  });
  model.updateMany.mockImplementation(async (args: any) => {
    model.updateManyArgs.push(args);
    return { count: args.where.id.in.length };
  });
  return model;
}

function buildPrisma(opts: {
  buckets?: number;
  webhooks?: number;
  jobRuns?: number;
  tokens?: number;
  pairing?: number;
  sessions?: number;
} = {}) {
  return {
    rateLimitBucket: makeStore(opts.buckets ?? 0),
    webhookEvent: makeStore(opts.webhooks ?? 0),
    jobRun: makeStore(opts.jobRuns ?? 0),
    passwordResetToken: makeStore(opts.tokens ?? 0),
    artisanPairingCode: makeStore(opts.pairing ?? 0),
    liveSession: makeStore(opts.sessions ?? 0),
  } as any;
}

const NOW = new Date("2026-08-05T00:00:00Z");

describe("cleanupOperationalData", () => {
  it("deletes expired rate-limit buckets", async () => {
    const prisma = buildPrisma({ buckets: 3 });
    const report = await cleanupOperationalData(prisma, NOW);

    expect(report.rateLimitBuckets).toBe(3);
    expect(prisma.rateLimitBucket.findManyArgs[0].where).toEqual({ expiresAt: { lt: NOW } });
    expect(prisma.rateLimitBucket.deleteManyArgs).toHaveLength(1);
  });

  it("only targets terminal webhook events and never pending/failed ones", async () => {
    const prisma = buildPrisma({ webhooks: 2 });
    const report = await cleanupOperationalData(prisma, NOW);

    expect(report.webhookEvents).toBe(2);
    const where = prisma.webhookEvent.findManyArgs[0].where;
    expect(where.status.in).toEqual(["PROCESSED", "IGNORED"]);
    expect(where.receivedAt.lt).toBeInstanceOf(Date);
  });

  it("only targets finished or long-stale job runs behind the retention cutoff", async () => {
    const prisma = buildPrisma({ jobRuns: 2 });
    const report = await cleanupOperationalData(prisma, NOW);

    expect(report.jobRuns).toBe(2);
    const where = prisma.jobRun.findManyArgs[0].where;
    expect(where.status.in).toEqual(["SUCCEEDED", "FAILED", "RUNNING"]);
    expect(where.startedAt.lt).toBeInstanceOf(Date);
  });

  it("keeps active live sessions and flips only stale ones to COMPLETED", async () => {
    const prisma = buildPrisma({ sessions: 2 });
    const report = await cleanupOperationalData(prisma, NOW);

    expect(report.liveSessions).toBe(2);
    const where = prisma.liveSession.findManyArgs[0].where;
    expect(where.status).toBe("ACTIVE");
    expect(where.lastUpdateAt.lt).toBeInstanceOf(Date);
    expect(prisma.liveSession.updateManyArgs).toHaveLength(1);
    expect(prisma.liveSession.updateManyArgs[0].data).toEqual({ status: "COMPLETED" });
  });

  it("stops deleting once the per-run row budget is exhausted", async () => {
    const prisma = buildPrisma({ buckets: 100_000 });
    const report = await cleanupOperationalData(prisma, NOW);

    expect(report.rateLimitBuckets).toBe(5000);
    const calls = prisma.rateLimitBucket.findManyArgs;
    expect(calls).toHaveLength(10);
    for (const call of calls) {
      expect(call.take).toBe(500);
    }
    expect(report.webhookEvents).toBe(0);
    expect(prisma.webhookEvent.findMany).not.toHaveBeenCalled();
  });

  it("is idempotent: a second run deletes nothing when there is nothing to delete", async () => {
    const prisma = buildPrisma({});
    const first = await cleanupOperationalData(prisma, NOW);
    const second = await cleanupOperationalData(prisma, NOW);

    expect(first).toEqual({
      rateLimitBuckets: 0,
      webhookEvents: 0,
      jobRuns: 0,
      passwordResetTokens: 0,
      pairingCodes: 0,
      liveSessions: 0,
    });
    expect(second).toEqual(first);
  });

  it("respects the configured retention constants", () => {
    expect(OPERATIONAL_CLEANUP.WEBHOOK_RETENTION_DAYS).toBeGreaterThanOrEqual(30);
    expect(OPERATIONAL_CLEANUP.WEBHOOK_RETENTION_DAYS).toBeLessThanOrEqual(90);
    expect(OPERATIONAL_CLEANUP.JOB_RUN_RETENTION_DAYS).toBeGreaterThanOrEqual(30);
    expect(OPERATIONAL_CLEANUP.JOB_RUN_RETENTION_DAYS).toBeLessThanOrEqual(90);
    expect(OPERATIONAL_CLEANUP.PASSWORD_RESET_GRACE_MS).toBeGreaterThan(0);
    expect(OPERATIONAL_CLEANUP.STALE_SESSION_MS).toBeGreaterThan(0);
  });

  it("reports only numeric counts and never tokens, emails, or PII", async () => {
    const prisma = buildPrisma({ buckets: 2, webhooks: 1, sessions: 1 });
    const report = await cleanupOperationalData(prisma, NOW);
    const summary = summarizeCleanup(report);

    for (const [key, value] of Object.entries(report)) {
      expect(typeof value, key).toBe("number");
    }
    expect(summary).toMatch(/^rateLimitBuckets=\d+ webhookEvents=\d+ jobRuns=\d+ passwordResetTokens=\d+ pairingCodes=\d+ liveSessions=\d+$/);
    expect(summary).not.toMatch(/@|\.com|bearer/i);
  });
});