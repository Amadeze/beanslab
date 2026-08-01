import { describe, expect, it } from "vitest";

import { assertSafeTestDatabase } from "../../test/setup/assert-safe-test-db";

describe("assertSafeTestDatabase", () => {
  it("rejects a remote database even when running in CI", () => {
    expect(() => assertSafeTestDatabase({
      DATABASE_URL: "postgresql://user:pass@production.example.com:5432/ros",
      CI: "true",
    })).toThrow(/Refusing integration\/E2E tests/);
  });

  it("allows an explicitly approved remote test database", () => {
    expect(() => assertSafeTestDatabase({
      DATABASE_URL: "postgresql://user:pass@test-db.example.com:5432/ros_test",
      ALLOW_TEST_AGAINST_REMOTE_DB: "true",
    })).not.toThrow();
  });
});
