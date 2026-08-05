import { type PrismaClient } from "@prisma/client";

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const BATCH_SIZE = 500;
const MAX_ROWS_PER_RUN = 5000;

export const OPERATIONAL_CLEANUP = {
  WEBHOOK_RETENTION_DAYS: 90,
  JOB_RUN_RETENTION_DAYS: 90,
  PASSWORD_RESET_GRACE_MS: 24 * 60 * 60 * 1000,
  STALE_SESSION_MS: 60 * 60 * 1000,
} as const;

export type OperationalCleanupReport = {
  rateLimitBuckets: number;
  webhookEvents: number;
  jobRuns: number;
  passwordResetTokens: number;
  pairingCodes: number;
  liveSessions: number;
};

const EMPTY_REPORT: OperationalCleanupReport = {
  rateLimitBuckets: 0,
  webhookEvents: 0,
  jobRuns: 0,
  passwordResetTokens: 0,
  pairingCodes: 0,
  liveSessions: 0,
};

async function sweep(
  find: () => Promise<string[]>,
  remove: (ids: string[]) => Promise<{ count: number }>,
  budget: number,
): Promise<number> {
  let removed = 0;
  if (budget <= 0) return 0;
  for (;;) {
    const ids = await find();
    if (ids.length === 0) break;
    const result = await remove(ids);
    removed += result.count;
    if (ids.length < BATCH_SIZE) break;
    if (removed >= budget) break;
  }
  return removed;
}

/**
 * Bounded sweep of operational data that accumulates without limit:
 * expired rate-limit buckets, terminal webhook events, finished job runs,
 * consumed/expired password reset and pairing tokens, and stale live sessions.
 * Operates in small batches with a hard cap per execution so it is safe to run
 * repeatedly and never issues an unbounded deleteMany.
 */
export async function cleanupOperationalData(
  prisma: PrismaClient,
  now: Date,
): Promise<OperationalCleanupReport> {
  const webhookCutoff = new Date(now.getTime() - OPERATIONAL_CLEANUP.WEBHOOK_RETENTION_DAYS * MS_PER_DAY);
  const jobRunCutoff = new Date(now.getTime() - OPERATIONAL_CLEANUP.JOB_RUN_RETENTION_DAYS * MS_PER_DAY);
  const tokenGrace = new Date(now.getTime() - OPERATIONAL_CLEANUP.PASSWORD_RESET_GRACE_MS);
  const sessionCutoff = new Date(now.getTime() - OPERATIONAL_CLEANUP.STALE_SESSION_MS);

  const report: OperationalCleanupReport = { ...EMPTY_REPORT };
  let budget = MAX_ROWS_PER_RUN;

  report.rateLimitBuckets = await sweep(
    () =>
      prisma.rateLimitBucket
        .findMany({
          where: { expiresAt: { lt: now } },
          select: { key: true },
          take: BATCH_SIZE,
        })
        .then((rows) => rows.map((row) => row.key)),
    (keys) => prisma.rateLimitBucket.deleteMany({ where: { key: { in: keys } } }),
    budget,
  );
  budget -= report.rateLimitBuckets;

  report.webhookEvents = await sweep(
    () =>
      prisma.webhookEvent
        .findMany({
          where: { status: { in: ["PROCESSED", "IGNORED"] }, receivedAt: { lt: webhookCutoff } },
          select: { id: true },
          take: BATCH_SIZE,
        })
        .then((rows) => rows.map((row) => row.id)),
    (ids) => prisma.webhookEvent.deleteMany({ where: { id: { in: ids } } }),
    budget,
  );
  budget -= report.webhookEvents;

  report.jobRuns = await sweep(
    () =>
      prisma.jobRun
        .findMany({
          where: { status: { in: ["SUCCEEDED", "FAILED", "RUNNING"] }, startedAt: { lt: jobRunCutoff } },
          select: { id: true },
          take: BATCH_SIZE,
        })
        .then((rows) => rows.map((row) => row.id)),
    (ids) => prisma.jobRun.deleteMany({ where: { id: { in: ids } } }),
    budget,
  );
  budget -= report.jobRuns;

  report.passwordResetTokens = await sweep(
    () =>
      prisma.passwordResetToken
        .findMany({
          where: {
            OR: [{ expiresAt: { lt: tokenGrace } }, { usedAt: { lt: tokenGrace } }],
          },
          select: { id: true },
          take: BATCH_SIZE,
        })
        .then((rows) => rows.map((row) => row.id)),
    (ids) => prisma.passwordResetToken.deleteMany({ where: { id: { in: ids } } }),
    budget,
  );
  budget -= report.passwordResetTokens;

  report.pairingCodes = await sweep(
    () =>
      prisma.artisanPairingCode
        .findMany({
          where: { OR: [{ expiresAt: { lt: now } }, { usedAt: { not: null } }] },
          select: { id: true },
          take: BATCH_SIZE,
        })
        .then((rows) => rows.map((row) => row.id)),
    (ids) => prisma.artisanPairingCode.deleteMany({ where: { id: { in: ids } } }),
    budget,
  );
  budget -= report.pairingCodes;

  report.liveSessions = await sweep(
    () =>
      prisma.liveSession
        .findMany({
          where: { status: "ACTIVE", lastUpdateAt: { lt: sessionCutoff } },
          select: { id: true },
          take: BATCH_SIZE,
        })
        .then((rows) => rows.map((row) => row.id)),
    (ids) => prisma.liveSession.updateMany({ where: { id: { in: ids } }, data: { status: "COMPLETED" } }),
    budget,
  );

  return report;
}

export function summarizeCleanup(report: OperationalCleanupReport): string {
  return `rateLimitBuckets=${report.rateLimitBuckets} webhookEvents=${report.webhookEvents} jobRuns=${report.jobRuns} passwordResetTokens=${report.passwordResetTokens} pairingCodes=${report.pairingCodes} liveSessions=${report.liveSessions}`;
}