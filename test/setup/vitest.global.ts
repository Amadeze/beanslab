import { assertSafeTestDatabase } from "./assert-safe-test-db";

// Vitest global setup. Integration tests are opt-in via RUN_INTEGRATION=true;
// when opted-in, refuse to run against a production database. Default
// `pnpm test` (unit tests only, RUN_INTEGRATION unset) skips this guard so the
// gate stays green.
export default async function testDbGuard(): Promise<void> {
  if (process.env.RUN_INTEGRATION !== "true") return;
  assertSafeTestDatabase();
}
