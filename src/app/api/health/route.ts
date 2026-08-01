import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import {
  decryptCredential,
  isEncryptedCredential,
} from "@/lib/credentials";
import { getRequestId, logServerError, logWarn } from "@/lib/api-observability";
import { getCurrentDate } from "@/lib/date-utils";

export const dynamic = "force-dynamic";

type CredentialHealth = {
  credentialDecryptFailures: number;
  plaintextCredentials: number;
};

const CREDENTIAL_HEALTH_TTL_MS = 5 * 60 * 1_000;
let credentialHealthCache: (CredentialHealth & { expiresAt: number }) | null = null;
let credentialHealthInFlight: Promise<CredentialHealth> | null = null;

async function inspectCredentialHealth(): Promise<CredentialHealth> {
  if (credentialHealthCache && credentialHealthCache.expiresAt > Date.now()) {
    return credentialHealthCache;
  }
  if (credentialHealthInFlight) return credentialHealthInFlight;

  credentialHealthInFlight = prisma.tenant.findMany({
    where: { midtransServerKey: { not: null } },
    select: { midtransServerKey: true },
  }).then((encryptedCredentials) => {
    let credentialDecryptFailures = 0;
    let plaintextCredentials = 0;
    for (const tenant of encryptedCredentials) {
      if (!tenant.midtransServerKey) continue;
      if (!isEncryptedCredential(tenant.midtransServerKey)) {
        plaintextCredentials += 1;
        continue;
      }
      try {
        decryptCredential(tenant.midtransServerKey);
      } catch {
        credentialDecryptFailures += 1;
      }
    }
    const result = { credentialDecryptFailures, plaintextCredentials };
    credentialHealthCache = {
      ...result,
      expiresAt: Date.now() + CREDENTIAL_HEALTH_TTL_MS,
    };
    return result;
  }).finally(() => {
    credentialHealthInFlight = null;
  });

  return credentialHealthInFlight;
}

export async function GET(req: Request) {
  const requestId = getRequestId(req.headers);
  const startedAt = performance.now();
  const missingConfiguration =
    process.env.NODE_ENV === "production"
      ? [
          "SESSION_SECRET",
          "CREDENTIAL_ENCRYPTION_KEY",
          "APP_URL",
          "CRON_SECRET",
          "SUPABASE_URL",
          "SUPABASE_SERVICE_ROLE_KEY",
          "SUPABASE_STORAGE_BUCKET",
          "SUPABASE_PRIVATE_STORAGE_BUCKET",
        ].filter((name) => !process.env[name])
      : [];

  try {
    // Both operations prove DB reachability; a separate SELECT 1 only adds a
    // round trip. Credential inspection is cached because decrypting every
    // tenant on every health probe grows linearly with tenant count.
    const [credentialHealth, recentJobRuns] = await Promise.all([
      inspectCredentialHealth(),
      prisma.jobRun.findMany({
        where: { jobName: { in: ["subscriptions", "overdue-reminders", "daily-brief", "payment-submissions"] } },
        orderBy: { startedAt: "desc" },
        take: 30,
        select: { jobName: true, status: true, startedAt: true, finishedAt: true },
      }),
    ]);
    const { credentialDecryptFailures, plaintextCredentials } = credentialHealth;
    const hasMissingConfig = missingConfiguration.length > 0;
    const hasCredentialFailures = process.env.NODE_ENV === "production" && (
      credentialDecryptFailures > 0 || plaintextCredentials > 0
    );
    const ready = !hasMissingConfig && !hasCredentialFailures;

    // Safe diagnostics: log counts only (never env var names or secret values)
    // so ops can distinguish the three readiness-incomplete causes from logs.
    if (!ready && process.env.NODE_ENV === "production") {
      if (hasMissingConfig) logWarn("health.readiness", "configuration:incomplete missing-environment", { missingCount: missingConfiguration.length });
      if (credentialDecryptFailures > 0) logWarn("health.readiness", "configuration:incomplete credential-decrypt-failures", { decryptFailures: credentialDecryptFailures });
      if (plaintextCredentials > 0) logWarn("health.readiness", "configuration:incomplete plaintext-credentials", { plaintextCredentials });
    }
    const now = getCurrentDate();
    const freshnessThreshold = new Date(now.getTime() - 36 * 60 * 60 * 1_000);
    const operationalJobs = ["subscriptions", "overdue-reminders", "daily-brief", "payment-submissions"].map((jobName) => {
      const latest = recentJobRuns.find((run) => run.jobName === jobName);
      return {
        jobName,
        status: !latest
          ? "not_observed"
          : latest.status === "FAILED"
            ? "failed"
            : latest.startedAt < freshnessThreshold
              ? "stale"
              : "fresh",
        lastStartedAt: latest?.startedAt.toISOString() ?? null,
        lastFinishedAt: latest?.finishedAt?.toISOString() ?? null,
      };
    });
    
    return NextResponse.json(
      {
        status: ready ? "ok" : "degraded",
        database: "reachable",
        configuration: ready ? "ready" : "incomplete",
        timestamp: getCurrentDate().toISOString(),
        latencyMs: Math.round(performance.now() - startedAt),
        version: process.env.npm_package_version || "unknown",
        release: process.env.VERCEL_GIT_COMMIT_SHA || process.env.GIT_COMMIT_SHA || null,
        operationalJobs,
      },
      {
        status: ready ? 200 : 503,
        headers: {
          "Cache-Control": "no-store",
          "X-Request-Id": requestId,
        },
      },
    );
  } catch (error) {
    logServerError("health.readiness", error, { requestId });
    return NextResponse.json(
      {
        status: "degraded",
        database: "unreachable",
        timestamp: getCurrentDate().toISOString(),
        requestId,
      },
      {
        status: 503,
        headers: {
          "Cache-Control": "no-store",
          "X-Request-Id": requestId,
        },
      },
    );
  }
}
