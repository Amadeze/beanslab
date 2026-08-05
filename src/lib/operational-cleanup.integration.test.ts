import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { cleanupOperationalData } from "@/lib/operational-cleanup";
import { runTrackedJob } from "@/lib/job-runner";

const integrationEnabled = process.env.RUN_INTEGRATION === "true";
const suite = integrationEnabled ? describe : describe.skip;

const TENANT = "tenant-cleanup-ops";
const USER = "user-cleanup-ops";
const PREFIX = "clnops:";
const NOW = new Date("2026-08-05T00:00:00Z");
const RUN_KEY = `operational-cleanup:${NOW.toISOString().slice(0, 10)}`;
const day = 24 * 60 * 60 * 1000;
const hour = 60 * 60 * 1000;

suite("operational data cleanup (integration)", () => {
  let machineId = "";
  let sessionMachines: string[] = [];
  let customerId = "";
  let buckets: string[] = [];
  let wOldProcessed = "";
  let wOldFailed = "";
  let wOldPending = "";
  let wRecentProcessed = "";
  let jOldSucceeded = "";
  let jOldFailed = "";
  let jOldRunning = "";
  let jRecentRunning = "";
  let tExpired = "";
  let tUsed = "";
  let tFresh = "";
  let pExpired = "";
  let pUsed = "";
  let pFresh = "";
  let sStaleActive = "";
  let sFreshActive = "";
  let sOldCompleted = "";

  beforeAll(async () => {
    await prisma.rateLimitBucket.deleteMany({ where: { key: { startsWith: PREFIX } } });
    await prisma.webhookEvent.deleteMany({ where: { eventId: { startsWith: PREFIX } } });
    await prisma.jobRun.deleteMany({ where: { runKey: { startsWith: PREFIX } } });
    await prisma.jobRun.deleteMany({ where: { runKey: RUN_KEY } });
    await prisma.passwordResetToken.deleteMany({ where: { tokenHash: { startsWith: PREFIX } } });
    await prisma.artisanPairingCode.deleteMany({ where: { codeHash: { startsWith: PREFIX } } });
    await prisma.liveSession.deleteMany({ where: { sessionId: { startsWith: PREFIX } } });
    await prisma.customer.deleteMany({ where: { code: { startsWith: "CST-CLN" } } });
    await prisma.machine.deleteMany({ where: { name: { startsWith: "Machine Cleanup" } } });
    await prisma.user.deleteMany({ where: { id: USER } });
    await prisma.tenant.deleteMany({ where: { id: TENANT } });

    await prisma.tenant.create({
      data: { id: TENANT, code: "CLNOP", name: "Cleanup Ops Tenant", subdomain: "cleanup-ops", isActive: true },
    });
    await prisma.user.create({
      data: { id: USER, email: "cleanup-ops@example.com", name: "Cleanup Ops", tenantId: TENANT, role: "OWNER" },
    });
    const machineA = await prisma.machine.create({
      data: { tenantId: TENANT, name: "Machine Cleanup A" },
    });
    const machineB = await prisma.machine.create({
      data: { tenantId: TENANT, name: "Machine Cleanup B" },
    });
    const machineC = await prisma.machine.create({
      data: { tenantId: TENANT, name: "Machine Cleanup C" },
    });
    machineId = machineA.id;
    sessionMachines = [machineA.id, machineB.id, machineC.id];
    const customer = await prisma.customer.create({
      data: { tenantId: TENANT, code: "CST-CLN-001", name: "Business Customer" },
    });
    customerId = customer.id;

    buckets = ["b-expired-1", "b-expired-2", "b-expired-3"].map((s) => PREFIX + s);
    await prisma.rateLimitBucket.createMany({
      data: [
        { key: buckets[0], windowStart: new Date(NOW.getTime() - 30 * day), expiresAt: new Date(NOW.getTime() - 30 * day + 1000) },
        { key: buckets[1], windowStart: new Date(NOW.getTime() - 10 * day), expiresAt: new Date(NOW.getTime() - 10 * day + 1000) },
        { key: buckets[2], windowStart: new Date(NOW.getTime() - 2 * day), expiresAt: new Date(NOW.getTime() - 2 * day + 1000) },
        { key: `${PREFIX}b-fresh-1`, windowStart: NOW, expiresAt: new Date(NOW.getTime() + hour) },
        { key: `${PREFIX}b-fresh-2`, windowStart: NOW, expiresAt: new Date(NOW.getTime() + 2 * day) },
      ],
    });

    const webhookSeeds = [
      ["old-processed", "PROCESSED", 100],
      ["old-failed", "FAILED", 100],
      ["old-pending", "RECEIVED", 100],
      ["recent-processed", "PROCESSED", 2],
    ] as const;
    const webhookRows = await prisma.webhookEvent.createManyAndReturn({
      data: webhookSeeds.map(([label, status, daysAgo]) => ({
        tenantId: TENANT,
        provider: "midtrans",
        eventId: `${PREFIX}${label}`,
        eventType: "notification",
        status,
        payload: {},
        receivedAt: new Date(NOW.getTime() - daysAgo * day),
      })),
    });
    [wOldProcessed, wOldFailed, wOldPending, wRecentProcessed] = webhookRows.map((r) => r.id);

    const jobSeeds = [
      ["old-succeeded", "SUCCEEDED", 100, null],
      ["old-failed", "FAILED", 100, null],
      ["old-running", "RUNNING", 100, null],
      ["recent-running", "RUNNING", 0, "0"],
    ] as const;
    const jobRows = await prisma.jobRun.createManyAndReturn({
      data: jobSeeds.map(([label, status, daysAgo]) => ({
        jobName: "test-cleanup",
        runKey: `${PREFIX}${label}`,
        status,
        startedAt: new Date(NOW.getTime() - daysAgo * day),
      })),
    });
    [jOldSucceeded, jOldFailed, jOldRunning, jRecentRunning] = jobRows.map((r) => r.id);

    const tokenSeeds = [
      ["expired", new Date(NOW.getTime() - 100 * day), null],
      ["used", new Date(NOW.getTime() + day), new Date(NOW.getTime() - 2 * day)],
      ["fresh", new Date(NOW.getTime() + day), null],
    ] as const;
    const tokenRows = await prisma.passwordResetToken.createManyAndReturn({
      data: tokenSeeds.map(([label, expiresAt, usedAt]) => ({
        userId: USER,
        tokenHash: `${PREFIX}token-${label}`,
        expiresAt,
        usedAt,
      })),
    });
    [tExpired, tUsed, tFresh] = tokenRows.map((r) => r.id);

    const pairingSeeds = [
      ["expired", new Date(NOW.getTime() - 100 * day), null],
      ["used", new Date(NOW.getTime() + hour), new Date(NOW.getTime() - day)],
      ["fresh", new Date(NOW.getTime() + hour), null],
    ] as const;
    const pairingRows = await prisma.artisanPairingCode.createManyAndReturn({
      data: pairingSeeds.map(([label, expiresAt, usedAt]) => ({
        tenantId: TENANT,
        machineId,
        createdByUserId: USER,
        codeHash: `${PREFIX}code-${label}`,
        expiresAt,
        usedAt,
      })),
    });
    [pExpired, pUsed, pFresh] = pairingRows.map((r) => r.id);

    const sessionSeeds = [
      ["stale-active", "ACTIVE", 2],
      ["fresh-active", "ACTIVE", 0],
      ["old-completed", "COMPLETED", 100],
    ] as const;
    const sessionRows = await prisma.liveSession.createManyAndReturn({
      data: sessionSeeds.map(([label, status, hoursAgo], index) => ({
        tenantId: TENANT,
        machineId: sessionMachines[index],
        sessionId: `${PREFIX}session-${label}`,
        status,
        startedAt: new Date(NOW.getTime() - (hoursAgo + 1) * hour),
        lastUpdateAt: new Date(NOW.getTime() - hoursAgo * hour),
      })),
    });
    [sStaleActive, sFreshActive, sOldCompleted] = sessionRows.map((r) => r.id);
  });

  afterAll(async () => {
    await prisma.webhookEvent.deleteMany({ where: { tenantId: TENANT } });
    await prisma.jobRun.deleteMany({ where: { runKey: { startsWith: PREFIX } } });
    await prisma.jobRun.deleteMany({ where: { runKey: RUN_KEY } });
    await prisma.passwordResetToken.deleteMany({ where: { userId: USER } });
    await prisma.artisanPairingCode.deleteMany({ where: { tenantId: TENANT } });
    await prisma.liveSession.deleteMany({ where: { tenantId: TENANT } });
    await prisma.rateLimitBucket.deleteMany({ where: { key: { startsWith: PREFIX } } });
    await prisma.customer.deleteMany({ where: { tenantId: TENANT } });
    await prisma.machine.deleteMany({ where: { tenantId: TENANT } });
    await prisma.user.deleteMany({ where: { id: USER } });
    await prisma.tenant.deleteMany({ where: { id: TENANT } });
  });

  it("deletes expired/old operational rows while keeping active, pending, and business data", async () => {
    const report = await cleanupOperationalData(prisma, NOW);

    expect(report.rateLimitBuckets).toBeGreaterThanOrEqual(3);
    expect(report.webhookEvents).toBeGreaterThanOrEqual(1);
    expect(report.jobRuns).toBeGreaterThanOrEqual(3);
    expect(report.passwordResetTokens).toBeGreaterThanOrEqual(2);
    expect(report.pairingCodes).toBeGreaterThanOrEqual(2);
    expect(report.liveSessions).toBeGreaterThanOrEqual(1);

    expect(await prisma.rateLimitBucket.findMany({ where: { key: { in: buckets } } })).toHaveLength(0);
    expect(await prisma.rateLimitBucket.count({ where: { key: { in: [`${PREFIX}b-fresh-1`, `${PREFIX}b-fresh-2`] } } })).toBe(2);

    const remainingWebhooks = await prisma.webhookEvent.findMany({
      where: { id: { in: [wOldProcessed, wOldFailed, wOldPending, wRecentProcessed] } },
      select: { id: true },
    });
    expect(remainingWebhooks.map((r) => r.id).sort()).toEqual([wOldFailed, wOldPending, wRecentProcessed].sort());

    const remainingJobRuns = await prisma.jobRun.findMany({
      where: { id: { in: [jOldSucceeded, jOldFailed, jOldRunning, jRecentRunning] } },
      select: { id: true },
    });
    expect(remainingJobRuns.map((r) => r.id)).toEqual([jRecentRunning]);

    const remainingTokens = await prisma.passwordResetToken.findMany({
      where: { id: { in: [tExpired, tUsed, tFresh] } },
      select: { id: true },
    });
    expect(remainingTokens.map((r) => r.id)).toEqual([tFresh]);

    const remainingPairing = await prisma.artisanPairingCode.findMany({
      where: { id: { in: [pExpired, pUsed, pFresh] } },
      select: { id: true },
    });
    expect(remainingPairing.map((r) => r.id)).toEqual([pFresh]);

    const staleSession = await prisma.liveSession.findUniqueOrThrow({ where: { id: sStaleActive } });
    expect(staleSession.status).toBe("COMPLETED");
    const freshSession = await prisma.liveSession.findUniqueOrThrow({ where: { id: sFreshActive } });
    expect(freshSession.status).toBe("ACTIVE");
    const oldSession = await prisma.liveSession.findUniqueOrThrow({ where: { id: sOldCompleted } });
    expect(oldSession.status).toBe("COMPLETED");

    const businessCustomer = await prisma.customer.findUnique({ where: { id: customerId } });
    expect(businessCustomer).not.toBeNull();
  });

  it("is idempotent: a second run deletes nothing and matches the first report", async () => {
    const first = await cleanupOperationalData(prisma, NOW);
    const second = await cleanupOperationalData(prisma, NOW);

    expect(second).toEqual(first);
    expect(second.rateLimitBuckets).toBe(0);
    expect(second.webhookEvents).toBe(0);
    expect(second.jobRuns).toBe(0);
    expect(second.passwordResetTokens).toBe(0);
    expect(second.pairingCodes).toBe(0);
    expect(second.liveSessions).toBe(0);
  });

  it("cleans more than one batch (1200 rows) in bounded batches of 500", async () => {
    await prisma.rateLimitBucket.createMany({
      data: Array.from({ length: 1200 }, (_, i) => ({
        key: `${PREFIX}b-mass-${i}`,
        windowStart: new Date(NOW.getTime() - 5 * day),
        expiresAt: new Date(NOW.getTime() - 5 * day + 1000),
      })),
    });

    const report = await cleanupOperationalData(prisma, NOW);

    expect(report.rateLimitBuckets).toBe(1200);
    expect(await prisma.rateLimitBucket.count({ where: { key: { startsWith: `${PREFIX}b-mass-` } } })).toBe(0);
  });

  it("never runs two parallel cron executions against the same run key", async () => {
    const seeded = await prisma.rateLimitBucket.createMany({
      data: [
        { key: `${PREFIX}b-race-1`, windowStart: new Date(NOW.getTime() - 3 * day), expiresAt: new Date(NOW.getTime() - 3 * day + 1000) },
        { key: `${PREFIX}b-race-2`, windowStart: new Date(NOW.getTime() - 3 * day), expiresAt: new Date(NOW.getTime() - 3 * day + 1000) },
      ],
    });
    expect(seeded.count).toBe(2);

    const runKey = RUN_KEY;
    const results = await Promise.all([
      runTrackedJob(prisma, { jobName: "operational-cleanup", runKey }, () => cleanupOperationalData(prisma, NOW)),
      runTrackedJob(prisma, { jobName: "operational-cleanup", runKey }, () => cleanupOperationalData(prisma, NOW)),
    ]);

    const executed = results.filter((r) => !r.skipped);
    const skipped = results.filter((r) => r.skipped);
    expect(executed).toHaveLength(1);
    expect(skipped).toHaveLength(1);
    expect(executed[0].result?.rateLimitBuckets).toBeGreaterThanOrEqual(2);
    expect(await prisma.rateLimitBucket.count({ where: { key: { startsWith: `${PREFIX}b-race-` } } })).toBe(0);
  });
});
