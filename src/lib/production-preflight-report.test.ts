import { describe, expect, it } from "vitest";

import { buildUnavailablePreflightReport } from "./production-preflight-report";

describe("production preflight failure report", () => {
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
