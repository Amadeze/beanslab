import { assertSafeTestDatabase } from "./assert-safe-test-db";

// Playwright global setup always runs before E2E. E2E touches a database via
// the running Next server, so refuse to start the suite against production.
export default async function e2eDbGuard(): Promise<void> {
  assertSafeTestDatabase();
}
