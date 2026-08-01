const SAFE_HOSTS = new Set(["localhost", "127.0.0.1", "0.0.0.0", "host.docker.internal"]);

export function assertSafeTestDatabase(
  env: Record<string, string | undefined> = process.env,
): void {
  const url = env.DATABASE_URL || env.DIRECT_URL;
  if (!url) {
    throw new Error(
      "[test-db-guard] DATABASE_URL/DIRECT_URL is not set. Set a local test database before running integration/E2E tests.",
    );
  }
  let host: string;
  try {
    host = new URL(url).hostname;
  } catch {
    throw new Error("[test-db-guard] DATABASE_URL/DIRECT_URL is not a valid URL.");
  }
  const isSafe =
    SAFE_HOSTS.has(host) ||
    host.endsWith(".local") ||
    env.ALLOW_TEST_AGAINST_REMOTE_DB === "true";
  if (!isSafe) {
    throw new Error(
      `[test-db-guard] Refusing integration/E2E tests: DATABASE_URL host "${host}" is not a local/test host. Use a local database, or set ALLOW_TEST_AGAINST_REMOTE_DB=true only for an explicit NON-production test database.`,
    );
  }
}
