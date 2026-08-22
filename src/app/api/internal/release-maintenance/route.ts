import "server-only";

import crypto from "node:crypto";
import { NextResponse } from "next/server";

import {
  decryptCredentialWithSecret,
  encryptCredentialWithSecret,
  isEncryptedCredential,
} from "@/lib/credentials";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const RELEASE_BRANCH = "wip/non-kopi-commit3";
const EXPECTED_MIGRATIONS = [
  "000000000000_baseline",
  "000000000001_preserve_domain_invariants",
  "000000000002_tenant_shipping_rajaongkir",
  "000000000003_storefront_shipping_checkout",
  "000000000004_storefront_awb_tracking",
  "000000000005_storefront_b2b_essentials",
] as const;

type CredentialState = "current" | "legacy" | "plaintext" | "unreadable";

function safeEqual(actual: string, expected: string) {
  const actualBuffer = Buffer.from(actual);
  const expectedBuffer = Buffer.from(expected);
  return (
    actualBuffer.length === expectedBuffer.length &&
    crypto.timingSafeEqual(actualBuffer, expectedBuffer)
  );
}

function isAuthorized(req: Request) {
  if (
    process.env.VERCEL_ENV !== "preview" ||
    process.env.VERCEL_GIT_COMMIT_REF !== RELEASE_BRANCH
  ) {
    return false;
  }

  const expected = process.env.PRODUCTION_MAINTENANCE_TOKEN;
  const authorization = req.headers.get("authorization");
  if (!expected || !authorization?.startsWith("Bearer ")) return false;
  return safeEqual(authorization.slice("Bearer ".length), expected);
}

function classifyCredential(
  value: string,
  currentSecret: string,
  legacySecret: string,
): { state: CredentialState; plaintext?: string } {
  if (!isEncryptedCredential(value)) {
    return { state: "plaintext", plaintext: value };
  }

  try {
    return {
      state: "current",
      plaintext: decryptCredentialWithSecret(value, currentSecret),
    };
  } catch {
    try {
      return {
        state: "legacy",
        plaintext: decryptCredentialWithSecret(value, legacySecret),
      };
    } catch {
      return { state: "unreadable" };
    }
  }
}

async function inspectBucket(name: string | undefined) {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!name || !supabaseUrl || !serviceRoleKey) {
    return { configured: false, reachable: false, status: null, public: null };
  }

  try {
    const response = await fetch(
      `${supabaseUrl}/storage/v1/bucket/${encodeURIComponent(name)}`,
      {
        headers: {
          apikey: serviceRoleKey,
          Authorization: `Bearer ${serviceRoleKey}`,
        },
        cache: "no-store",
        signal: AbortSignal.timeout(8_000),
      },
    );
    const payload = response.ok
      ? ((await response.json()) as { public?: boolean })
      : null;
    return {
      configured: true,
      reachable: response.ok,
      status: response.status,
      public: typeof payload?.public === "boolean" ? payload.public : null,
    };
  } catch {
    return { configured: true, reachable: false, status: null, public: null };
  }
}

async function inspectTarget() {
  const currentSecret = process.env.CREDENTIAL_ENCRYPTION_KEY;
  const legacySecret = process.env.SESSION_SECRET;
  if (!currentSecret || !legacySecret) {
    throw new Error("Required encryption secrets are unavailable.");
  }

  const [migrations, tenants, platformIntegrations, recentJobs, publicBucket, privateBucket] =
    await Promise.all([
      prisma.$queryRaw<
        Array<{
          migration_name: string;
          finished_at: Date | null;
          rolled_back_at: Date | null;
        }>
      >`SELECT migration_name, finished_at, rolled_back_at FROM "_prisma_migrations" ORDER BY started_at`,
      prisma.tenant.findMany({
        where: { midtransServerKey: { not: null } },
        select: { midtransServerKey: true },
      }),
      prisma.platformIntegration.findMany({
        where: { encryptedApiKey: { not: null } },
        select: {
          provider: true,
          encryptedApiKey: true,
          isActive: true,
          connectionStatus: true,
          lastTestedAt: true,
        },
      }),
      prisma.jobRun.findMany({
        where: {
          jobName: {
            in: [
              "subscriptions",
              "overdue-reminders",
              "daily-brief",
              "payment-submissions",
            ],
          },
        },
        orderBy: { startedAt: "desc" },
        take: 30,
        select: {
          jobName: true,
          status: true,
          startedAt: true,
          finishedAt: true,
        },
      }),
      inspectBucket(process.env.SUPABASE_STORAGE_BUCKET),
      inspectBucket(process.env.SUPABASE_PRIVATE_STORAGE_BUCKET),
    ]);

  const credentialStates: Record<CredentialState, number> = {
    current: 0,
    legacy: 0,
    plaintext: 0,
    unreadable: 0,
  };
  for (const value of [
    ...tenants.map((tenant) => tenant.midtransServerKey),
    ...platformIntegrations.map((integration) => integration.encryptedApiKey),
  ]) {
    if (!value) continue;
    credentialStates[classifyCredential(value, currentSecret, legacySecret).state] += 1;
  }

  const appliedMigrations = migrations
    .filter((migration) => migration.finished_at && !migration.rolled_back_at)
    .map((migration) => migration.migration_name);
  const appliedSet = new Set(appliedMigrations);

  return {
    migrations: {
      expected: EXPECTED_MIGRATIONS.length,
      applied: appliedMigrations.length,
      missing: EXPECTED_MIGRATIONS.filter((name) => !appliedSet.has(name)),
      failed: migrations.filter(
        (migration) => !migration.finished_at && !migration.rolled_back_at,
      ).length,
    },
    credentialStates,
    storage: {
      publicBucket,
      privateBucket,
      privateBucketIsPrivate:
        privateBucket.reachable && privateBucket.public === false,
    },
    integrations: {
      subscriptionMidtrans: Boolean(
        process.env.MIDTRANS_SERVER_KEY &&
          process.env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY,
      ),
      email: Boolean(process.env.RESEND_API_KEY),
      whatsapp: Boolean(process.env.FONNTE_TOKEN),
      rajaOngkir: platformIntegrations.map((integration) => ({
        provider: integration.provider,
        active: integration.isActive,
        connectionStatus: integration.connectionStatus,
        lastTestedAt: integration.lastTestedAt?.toISOString() ?? null,
      })),
    },
    recentJobs: [
      "subscriptions",
      "overdue-reminders",
      "daily-brief",
      "payment-submissions",
    ].map((jobName) => {
      const latest = recentJobs.find((job) => job.jobName === jobName);
      return {
        jobName,
        status: latest?.status ?? "NOT_OBSERVED",
        lastStartedAt: latest?.startedAt.toISOString() ?? null,
        lastFinishedAt: latest?.finishedAt?.toISOString() ?? null,
      };
    }),
  };
}

async function repairCredentials() {
  const currentSecret = process.env.CREDENTIAL_ENCRYPTION_KEY;
  const legacySecret = process.env.SESSION_SECRET;
  if (!currentSecret || !legacySecret || currentSecret === legacySecret) {
    throw new Error("Independent current and legacy encryption secrets are required.");
  }

  return prisma.$transaction(async (tx) => {
    const [tenants, platformIntegrations] = await Promise.all([
      tx.tenant.findMany({
        where: { midtransServerKey: { not: null } },
        select: { id: true, midtransServerKey: true },
      }),
      tx.platformIntegration.findMany({
        where: { encryptedApiKey: { not: null } },
        select: { id: true, encryptedApiKey: true },
      }),
    ]);

    let inspected = 0;
    let rotated = 0;
    let alreadyCurrent = 0;
    const tenantUpdates: Array<{ id: string; encrypted: string }> = [];
    const platformUpdates: Array<{ id: string; encrypted: string }> = [];

    const prepare = (value: string) => {
      inspected += 1;
      const classified = classifyCredential(value, currentSecret, legacySecret);
      if (classified.state === "unreadable" || classified.plaintext === undefined) {
        throw new Error("At least one encrypted credential is unreadable.");
      }
      if (classified.state === "current") {
        alreadyCurrent += 1;
        return null;
      }
      const encrypted = encryptCredentialWithSecret(
        classified.plaintext,
        currentSecret,
      );
      if (
        decryptCredentialWithSecret(encrypted, currentSecret) !==
        classified.plaintext
      ) {
        throw new Error("Credential rotation verification failed.");
      }
      rotated += 1;
      return encrypted;
    };

    for (const tenant of tenants) {
      if (!tenant.midtransServerKey) continue;
      const encrypted = prepare(tenant.midtransServerKey);
      if (encrypted) tenantUpdates.push({ id: tenant.id, encrypted });
    }
    for (const integration of platformIntegrations) {
      if (!integration.encryptedApiKey) continue;
      const encrypted = prepare(integration.encryptedApiKey);
      if (encrypted) platformUpdates.push({ id: integration.id, encrypted });
    }

    await Promise.all([
      ...tenantUpdates.map((update) =>
        tx.tenant.update({
          where: { id: update.id },
          data: { midtransServerKey: update.encrypted },
        }),
      ),
      ...platformUpdates.map((update) =>
        tx.platformIntegration.update({
          where: { id: update.id },
          data: { encryptedApiKey: update.encrypted },
        }),
      ),
    ]);

    return { inspected, rotated, alreadyCurrent, verified: true };
  });
}

async function quarantineUnreadableTenantMidtrans() {
  const currentSecret = process.env.CREDENTIAL_ENCRYPTION_KEY;
  const legacySecret = process.env.SESSION_SECRET;
  if (!currentSecret || !legacySecret) {
    throw new Error("Required encryption secrets are unavailable.");
  }

  return prisma.$transaction(async (tx) => {
    const tenants = await tx.tenant.findMany({
      where: { midtransServerKey: { not: null } },
      select: {
        id: true,
        midtransClientKey: true,
        midtransServerKey: true,
        midtransIsProduction: true,
      },
    });

    const unreadable = tenants.filter((tenant) => {
      if (!tenant.midtransServerKey) return false;
      return (
        classifyCredential(
          tenant.midtransServerKey,
          currentSecret,
          legacySecret,
        ).state === "unreadable"
      );
    });

    for (const tenant of unreadable) {
      await tx.auditLog.create({
        data: {
          tenantId: tenant.id,
          action: "QUARANTINE_UNREADABLE_CREDENTIAL",
          entityType: "TenantMidtransConfiguration",
          entityId: tenant.id,
          before: {
            midtransServerKeyCiphertext: tenant.midtransServerKey,
            midtransClientKeyConfigured: Boolean(tenant.midtransClientKey),
            midtransIsProduction: tenant.midtransIsProduction,
          },
          after: {
            midtransServerKeyConfigured: false,
            midtransClientKeyConfigured: false,
            midtransIsProduction: false,
          },
          metadata: {
            reason: "credential-key-unavailable-during-production-readiness",
            recoverableFromAuditCiphertext: true,
          },
        },
      });
      await tx.tenant.update({
        where: { id: tenant.id },
        data: {
          midtransClientKey: null,
          midtransServerKey: null,
          midtransIsProduction: false,
        },
      });
    }

    return {
      inspected: tenants.length,
      quarantined: unreadable.length,
      auditBackupsCreated: unreadable.length,
      tenantMidtransDisabled: unreadable.length,
    };
  });
}

export async function POST(req: Request) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const body = (await req.json()) as { action?: unknown };
    if (body.action === "inspect") {
      return NextResponse.json({ ok: true, target: await inspectTarget() });
    }
    if (body.action === "repair-credentials") {
      return NextResponse.json({ ok: true, result: await repairCredentials() });
    }
    if (body.action === "quarantine-unreadable-tenant-midtrans") {
      return NextResponse.json({
        ok: true,
        result: await quarantineUnreadableTenantMidtrans(),
      });
    }
    return NextResponse.json({ error: "Unsupported action" }, { status: 400 });
  } catch (error) {
    console.error("release-maintenance failed", {
      message: error instanceof Error ? error.message : "Unknown error",
    });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Maintenance failed" },
      { status: 500 },
    );
  }
}
