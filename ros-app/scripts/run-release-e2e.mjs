import { spawnSync } from "node:child_process";
import path from "node:path";

const command = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
const result = spawnSync(command, ["exec", "playwright", "test"], {
  env: {
    ...process.env,
    PLAYWRIGHT_USE_PRODUCTION_SERVER: "true",
    PLAYWRIGHT_PORT: process.env.PLAYWRIGHT_PORT || "3100",
    ROASTD_E2E_LOCAL_STORAGE_ROOT:
      process.env.ROASTD_E2E_LOCAL_STORAGE_ROOT || path.join(process.cwd(), ".data"),
  },
  shell: process.platform === "win32",
  stdio: "inherit",
});

if (result.error) {
  console.error("Failed to start Playwright release tests:", result.error);
}

process.exit(result.status ?? 1);
