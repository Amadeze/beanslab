import { assertSafeTestDatabase } from "./assert-safe-test-db";
import { resolveTestDatabaseUrl } from "./test-database-guard";

// Vitest global setup. Integration tests are opt-in via RUN_INTEGRATION=true;
// when opted-in, refuse to run against a production database. Default
// `pnpm test` (unit tests only, RUN_INTEGRATION unset) skips this guard so the
// gate stays green.
export default async function testDbGuard(): Promise<void> {
  if (process.env.RUN_INTEGRATION !== "true") return;
  resolveTestDatabaseUrl();
  // The shared @/lib/prisma singleton reads DATABASE_URL directly; it must
  // never be allowed to point at a remote database during integration tests.
  assertSafeTestDatabase();
}