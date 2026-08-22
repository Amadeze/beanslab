import { describe, expect, it } from "vitest";

import {
  buildInvalidConfigurationPreflightReport,
  buildUnavailablePreflightReport,
  findPlaceholderProductionEnvironment,
} from "./production-preflight-report";

describe("production preflight failure report", () => {
  it("rejects the documented example configuration before network checks", () => {
    const env = {
      DATABASE_URL: "postgresql://user:PASSWORD@host:6543/database?pgbouncer=true",
      DIRECT_URL: "postgresql://user:PASSWORD@host:5432/database",
      SESSION_SECRET: "change-me-to-a-random-string-at-least-32-chars",
      CREDENTIAL_ENCRYPTION_KEY: "independent-random-secret-at-least-32-chars",
      CRON_SECRET: "independent-random-secret-at-least-32-chars",
      APP_URL: "https://app.example.com",
      SUPABASE_URL: "https://project.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
      SUPABASE_STORAGE_BUCKET: "roastery-assets",
      SUPABASE_PRIVATE_STORAGE_BUCKET: "roastery-private",
    };
    const invalidEnvironment = findPlaceholderProductionEnvironment(env);

    expect(invalidEnvironment).toEqual(expect.arrayContaining([
      "DATABASE_URL still uses the example database connection.",
      "DIRECT_URL still uses the example database connection.",
      "SESSION_SECRET still uses the example value.",
      "CREDENTIAL_ENCRYPTION_KEY still uses the example value.",
      "CRON_SECRET still uses the example value.",
      "APP_URL still uses the example hostname.",
      "SUPABASE_URL still uses the example project hostname.",
      "SUPABASE_SERVICE_ROLE_KEY still uses the example value.",
    ]));

    const report = buildInvalidConfigurationPreflightReport({
      env,
      missingEnvironment: [],
      invalidEnvironment,
      warnings: [],
    });
    expect(report).toMatchObject({
      ready: false,
      database: "not_checked",
      integrations: { privateStorageCheck: "not_configured" },
    });
    expect(JSON.stringify(report)).not.toContain("PASSWORD");
    expect(JSON.stringify(report)).not.toContain("service-role-key");
  });

  it("accepts production-shaped URLs and independent secrets", () => {
    expect(findPlaceholderProductionEnvironment({
      DATABASE_URL: "postgresql://app:secret@db.internal/roastd",
      DIRECT_URL: "postgresql://app:secret@db.internal/roastd",
      SESSION_SECRET: "a-unique-session-secret-that-is-long-enough",
      CREDENTIAL_ENCRYPTION_KEY: "a-different-encryption-key-that-is-long-enough",
      CRON_SECRET: "a-third-independent-secret-that-is-long-enough",
      APP_URL: "https://app.roastd.id",
      SUPABASE_URL: "https://real-project.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "real-service-role-key",
    })).toEqual([]);
  });

  it("returns a structured non-ready result without serializing credentials", () => {
    const report = buildUnavailablePreflightReport({
      env: {
        DATABASE_URL: "postgresql://user:super-secret@db.example.test/app",
        SUPABASE_URL: "https://storage.example.test",
        SUPABASE_SERVICE_ROLE_KEY: "private-storage-secret",
        SUPABASE_STORAGE_BUCKET: "public-assets",
        SUPABASE_PRIVATE_STORAGE_BUCKET: "payment-proofs",
        XENDIT_ENABLED: "true",
        XENDIT_SECRET_KEY: "xnd-secret",
        XENDIT_WEBHOOK_TOKEN: "webhook-secret",
      },
      missingEnvironment: [],
      invalidEnvironment: ["Private storage verification failed."],
      warnings: ["Email delivery is disabled."],
      privateStorageCheck: "failed",
    });

    expect(report).toMatchObject({
      ready: false,
      database: "unreachable",
      databaseError: "Database connection or readiness query failed.",
      integrations: {
        objectStorage: true,
        privateStorageCheck: "failed",
        xenditPlatform: true,
      },
    });
    const serialized = JSON.stringify(report);
    expect(serialized).not.toContain("super-secret");
    expect(serialized).not.toContain("private-storage-secret");
    expect(serialized).not.toContain("xnd-secret");
    expect(serialized).not.toContain("webhook-secret");
  });
});
