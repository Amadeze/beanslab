import { readdir } from "node:fs/promises";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import {
  decryptCredential,
  isEncryptedCredential,
} from "../src/lib/credentials";
import {
  buildUnavailablePreflightReport,
  type PrivateStorageCheck,
} from "../src/lib/production-preflight-report";

const requiredEnvironment = [
  "DATABASE_URL",
  "DIRECT_URL",
  "SESSION_SECRET",
  "CREDENTIAL_ENCRYPTION_KEY",
  "APP_URL",
  "CRON_SECRET",
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_STORAGE_BUCKET",
  "SUPABASE_PRIVATE_STORAGE_BUCKET",
] as const;

const missingEnvironment = requiredEnvironment.filter((name) => !process.env[name]);
const warnings: string[] = [];
const invalidEnvironment: string[] = [];
let privateStorageCheck: PrivateStorageCheck = "not_configured";
if (process.env.APP_URL && !process.env.APP_URL.startsWith("https://")) {
  invalidEnvironment.push("APP_URL must use HTTPS in production.");
}
if (process.env.SESSION_SECRET && process.env.SESSION_SECRET.length < 32) {
  invalidEnvironment.push("SESSION_SECRET must contain at least 32 characters.");
}
if (process.env.CREDENTIAL_ENCRYPTION_KEY && process.env.CREDENTIAL_ENCRYPTION_KEY.length < 32) {
  invalidEnvironment.push("CREDENTIAL_ENCRYPTION_KEY must contain at least 32 characters.");
}
if (process.env.CRON_SECRET && process.env.CRON_SECRET.length < 32) {
  invalidEnvironment.push("CRON_SECRET must contain at least 32 characters.");
}
if (process.env.DATABASE_POOL_MAX) {
  const databasePoolMax = Number(process.env.DATABASE_POOL_MAX);
  if (!Number.isInteger(databasePoolMax) || databasePoolMax < 1 || databasePoolMax > 20) {
    invalidEnvironment.push("DATABASE_POOL_MAX must be an integer between 1 and 20.");
  }
}
if (process.env.VERCEL && Number(process.env.DATABASE_POOL_MAX || 5) > 5) {
  warnings.push("DATABASE_POOL_MAX above 5 can exhaust database connections across Vercel instances.");
}
if (process.env.SESSION_SECRET && process.env.SESSION_SECRET === process.env.CREDENTIAL_ENCRYPTION_KEY) {
  invalidEnvironment.push("SESSION_SECRET and CREDENTIAL_ENCRYPTION_KEY must be different secrets.");
}
if (!process.env.RESEND_API_KEY) warnings.push("Email delivery is disabled.");
if (!process.env.MIDTRANS_SERVER_KEY) warnings.push("SaaS subscription checkout is disabled.");
if (!process.env.WA_API_KEY) warnings.push("WhatsApp delivery is disabled.");
if (process.env.XENDIT_ENABLED === "true" && !process.env.XENDIT_SECRET_KEY) {
  invalidEnvironment.push("XENDIT_ENABLED=true requires XENDIT_SECRET_KEY.");
}
if (process.env.XENDIT_ENABLED === "true" && !process.env.XENDIT_WEBHOOK_TOKEN) {
  invalidEnvironment.push("XENDIT_ENABLED=true requires XENDIT_WEBHOOK_TOKEN.");
}
if (process.env.XENDIT_ENABLED !== "true") warnings.push("Xendit xenPlatform checkout is disabled; tenant manual payment remains active.");

const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;
if (!connectionString) {
  console.error(JSON.stringify({ ready: false, missingEnvironment, warnings }, null, 2));
  process.exit(1);
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

try {
  if (
    process.env.SUPABASE_URL &&
    process.env.SUPABASE_SERVICE_ROLE_KEY &&
    process.env.SUPABASE_PRIVATE_STORAGE_BUCKET
  ) {
    try {
      const bucketResponse = await fetch(
        `${process.env.SUPABASE_URL}/storage/v1/bucket/${process.env.SUPABASE_PRIVATE_STORAGE_BUCKET}`,
        {
          headers: {
            apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
            Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
          },
        },
      );
      if (!bucketResponse.ok) {
        invalidEnvironment.push("SUPABASE_PRIVATE_STORAGE_BUCKET is not reachable.");
        privateStorageCheck = "failed";
      } else {
        const bucket = await bucketResponse.json() as { public?: boolean };
        if (bucket.public) {
          invalidEnvironment.push("SUPABASE_PRIVATE_STORAGE_BUCKET must not be public.");
          privateStorageCheck = "failed";
        } else {
          privateStorageCheck = "reachable_private";
        }
      }
    } catch {
      invalidEnvironment.push("SUPABASE_PRIVATE_STORAGE_BUCKET verification failed.");
      privateStorageCheck = "failed";
    }
  }

  await prisma.$queryRaw`SELECT 1`;
  const migrationDirectories = (await readdir(path.join(process.cwd(), "prisma", "migrations"), {
    withFileTypes: true,
  }))
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
  const applied = await prisma.$queryRaw<Array<{
    migration_name: string;
    finished_at: Date | null;
    rolled_back_at: Date | null;
  }>>`
    SELECT migration_name, finished_at, rolled_back_at
    FROM "_prisma_migrations"
  `;
  const completed = new Set(
    applied
      .filter((migration) => migration.finished_at && !migration.rolled_back_at)
      .map((migration) => migration.migration_name),
  );
  const unappliedMigrations = migrationDirectories.filter((name) => !completed.has(name));
  const failedMigrations = applied
    .filter((migration) => !migration.finished_at && !migration.rolled_back_at)
    .map((migration) => migration.migration_name);
  const configuredTenantCredentials = await prisma.tenant.findMany({
    where: { midtransServerKey: { not: null } },
    select: { midtransServerKey: true },
  });
  let credentialDecryptFailures = 0;
  let plaintextCredentials = 0;
  let credentialDecryptSkipped = 0;
  const canDecryptCredentials = Boolean(
    process.env.CREDENTIAL_ENCRYPTION_KEY &&
    process.env.CREDENTIAL_ENCRYPTION_KEY.length >= 32,
  );
  for (const tenant of configuredTenantCredentials) {
    if (!tenant.midtransServerKey) continue;
    if (!isEncryptedCredential(tenant.midtransServerKey)) {
      plaintextCredentials += 1;
      continue;
    }
    if (!canDecryptCredentials) {
      credentialDecryptSkipped += 1;
      continue;
    }
    try {
      decryptCredential(tenant.midtransServerKey);
    } catch {
      credentialDecryptFailures += 1;
    }
  }
  const ready =
    missingEnvironment.length === 0 &&
    invalidEnvironment.length === 0 &&
    unappliedMigrations.length === 0 &&
    failedMigrations.length === 0 &&
    credentialDecryptFailures === 0 &&
    plaintextCredentials === 0;

  console.log(JSON.stringify({
    ready,
    database: "reachable",
    migrationCount: migrationDirectories.length,
    unappliedMigrations,
    failedMigrations,
    encryptedCredentialCheck: {
      inspected: configuredTenantCredentials.length,
      failures: credentialDecryptFailures,
      skipped: credentialDecryptSkipped,
      skippedReason: credentialDecryptSkipped > 0
        ? "CREDENTIAL_ENCRYPTION_KEY is missing or invalid."
        : null,
      plaintextCredentials,
    },
    missingEnvironment,
    invalidEnvironment,
    integrations: {
      email: Boolean(process.env.RESEND_API_KEY),
      subscriptionMidtrans: Boolean(process.env.MIDTRANS_SERVER_KEY),
      whatsapp: Boolean(process.env.WA_API_KEY),
      xenditPlatform: process.env.XENDIT_ENABLED === "true" && Boolean(process.env.XENDIT_SECRET_KEY && process.env.XENDIT_WEBHOOK_TOKEN),
      objectStorage: Boolean(
        process.env.SUPABASE_URL &&
        process.env.SUPABASE_SERVICE_ROLE_KEY &&
        process.env.SUPABASE_STORAGE_BUCKET
        && process.env.SUPABASE_PRIVATE_STORAGE_BUCKET
      ),
      privateStorageCheck,
    },
    warnings,
  }, null, 2));

  if (!ready) process.exitCode = 1;
} catch {
  console.error(JSON.stringify(buildUnavailablePreflightReport({
    env: process.env,
    missingEnvironment,
    invalidEnvironment,
    warnings,
    privateStorageCheck,
  }), null, 2));
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
