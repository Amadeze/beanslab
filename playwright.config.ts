import { defineConfig, devices } from "@playwright/test";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

// Keep browser tests self-contained while preserving compatibility with
// credentials encrypted before CREDENTIAL_ENCRYPTION_KEY became mandatory.
process.env.CREDENTIAL_ENCRYPTION_KEY ??=
  process.env.SESSION_SECRET ?? "e2e-only-credential-encryption-key-at-least-32-characters";
const playwrightPort = process.env.PLAYWRIGHT_PORT ?? "3000";
const playwrightBaseUrl = `http://localhost:${playwrightPort}`;
const playwrightServerCommand = process.env.PLAYWRIGHT_SERVER_COMMAND
  ?? (process.env.PLAYWRIGHT_USE_PRODUCTION_SERVER === "true"
    ? `node scripts/start-standalone.mjs ${playwrightPort}`
    : `pnpm exec next dev --port ${playwrightPort}`);

export default defineConfig({
  globalSetup: "./test/setup/playwright.global.ts",
  testDir: "./tests/e2e",
  fullyParallel: false,
  retries: 0,
  workers: 1,
  reporter: "list",
  use: {
    baseURL: playwrightBaseUrl,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: {
    command: playwrightServerCommand,
    url: `${playwrightBaseUrl}/login`,
    reuseExistingServer: true,
    timeout: Number(process.env.PLAYWRIGHT_SERVER_TIMEOUT_MS ?? 240_000),
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
