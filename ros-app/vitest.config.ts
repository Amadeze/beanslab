import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";

config({ path: ".env.local" });

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    globalSetup: ["./test/setup/vitest.global.ts"],
    include: ["src/**/*.test.ts"],
    exclude: ["tests/e2e/**"],
    env: {
      SESSION_SECRET: "ros-test-session-secret-that-is-long-enough",
    },
  },
});
