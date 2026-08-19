import { readFileSync } from "node:fs";
import { join } from "node:path";
import { assertSafeTestDatabase } from "./assert-safe-test-db";

/**
 * Single source of truth for resolving the integration-test database URL.
 *
 * Rules (fail fast, no fallback):
 * 1. TEST_DATABASE_URL must be set explicitly when RUN_INTEGRATION=true.
 * 2. It must NEVER equal DATABASE_URL/DIRECT_URL from .env.local — the
 *    development/production database pointer is never the test database.
 * 3. It must point at a local/test host (localhost, 127.0.0.1, 0.0.0.0,
 *    host.docker.internal, *.local). Supabase or any other remote host
 *    fails immediately; the ALLOW_TEST_AGAINST_REMOTE_DB escape hatch does
 *    not apply to TEST_DATABASE_URL.
 *
 * Note: a local DATABASE_URL in the process environment is the normal local
 * convention (the shared @/lib/prisma singleton reads it directly), so TEST
 * may legitimately equal it. test/setup/vitest.global.ts additionally
 * asserts that DATABASE_URL/DIRECT_URL are local before any suite runs.
 */
export function resolveTestDatabaseUrl(
  env: Record<string, string | undefined> = process.env,
  envFilePath = join(process.cwd(), ".env.local"),
): string {
  const url = env.TEST_DATABASE_URL;
  if (!url) {
    throw new Error(
      "[test-database-guard] TEST_DATABASE_URL is required when RUN_INTEGRATION=true.",
    );
  }
  const fromEnvFile = parseEnvFile(envFilePath);
  for (const key of ["DATABASE_URL", "DIRECT_URL"] as const) {
    if (fromEnvFile[key] && fromEnvFile[key] === url) {
      throw new Error(
        `[test-database-guard] TEST_DATABASE_URL must not equal ${key} from .env.local (development/production database).`,
      );
    }
  }
  assertSafeTestDatabase({ DATABASE_URL: url });
  return url;
}

export function parseEnvFile(path: string): Record<string, string> {
  const result: Record<string, string> = {};
  try {
    for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Z_]+)\s*=\s*(.*?)\s*$/);
      if (!match) continue;
      const value = match[2].replace(/^"(.*)"$/, "$1").replace(/^'(.*)'$/, "$1");
      if (value.length > 0) result[match[1]] = value;
    }
  } catch {
    // .env.local may be absent (e.g. CI); fall back to process.env above.
  }
  return result;
}
