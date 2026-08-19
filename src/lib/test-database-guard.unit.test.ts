import { describe, expect, it, afterEach } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseEnvFile, resolveTestDatabaseUrl } from "../../test/setup/test-database-guard";

const LOCAL_TEST_URL =
  "postgresql://postgres:test@127.0.0.1:5432/ros_test?schema=guard_unit";

function withEnvFile(lines: string[], fn: (envFilePath: string) => void): void {
  const dir = mkdtempSync(join(tmpdir(), "ros-guard-"));
  const envFilePath = join(dir, ".env.local");
  writeFileSync(envFilePath, lines.join("\n"), "utf8");
  try {
    fn(envFilePath);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

describe("test-database-guard: TEST_DATABASE_URL vs DATABASE_URL/DIRECT_URL", () => {
  afterEach(() => {
    delete process.env.TEST_DATABASE_URL;
    delete process.env.DATABASE_URL;
    delete process.env.DIRECT_URL;
  });

  it("rejects when TEST_DATABASE_URL is missing", () => {
    expect(() =>
      resolveTestDatabaseUrl({ RUN_INTEGRATION: "true" }, "C:/nope/.env.local"),
    ).toThrow(/TEST_DATABASE_URL is required/);
  });

  it("rejects when env-file DATABASE_URL equals TEST_DATABASE_URL", () => {
    withEnvFile([`DATABASE_URL=${LOCAL_TEST_URL}`], (envFilePath) => {
      expect(() =>
        resolveTestDatabaseUrl({ TEST_DATABASE_URL: LOCAL_TEST_URL }, envFilePath),
      ).toThrow(/must not equal DATABASE_URL/);
    });
  });

  it("rejects when env-file DIRECT_URL equals TEST_DATABASE_URL", () => {
    withEnvFile([`DIRECT_URL=${LOCAL_TEST_URL}`], (envFilePath) => {
      expect(() =>
        resolveTestDatabaseUrl({ TEST_DATABASE_URL: LOCAL_TEST_URL }, envFilePath),
      ).toThrow(/must not equal DIRECT_URL/);
    });
  });

  it("rejects when env-file DATABASE_URL equals TEST_DATABASE_URL even if process env differs", () => {
    withEnvFile([`DATABASE_URL=${LOCAL_TEST_URL}`], (envFilePath) => {
      expect(() =>
        resolveTestDatabaseUrl(
          { TEST_DATABASE_URL: LOCAL_TEST_URL, DATABASE_URL: "postgresql://other@127.0.0.1:5432/other" },
          envFilePath,
        ),
      ).toThrow(/must not equal DATABASE_URL/);
    });
  });

  it("rejects when env-file DIRECT_URL equals TEST_DATABASE_URL even if process env differs", () => {
    withEnvFile([`DIRECT_URL=${LOCAL_TEST_URL}`], (envFilePath) => {
      expect(() =>
        resolveTestDatabaseUrl(
          { TEST_DATABASE_URL: LOCAL_TEST_URL, DIRECT_URL: "postgresql://other@127.0.0.1:5432/other" },
          envFilePath,
        ),
      ).toThrow(/must not equal DIRECT_URL/);
    });
  });

  it("accepts TEST_DATABASE_URL equal to a local process-env DATABASE_URL (local singleton convention)", () => {
    withEnvFile(["DATABASE_URL=postgresql://other@127.0.0.1:5432/other"], (envFilePath) => {
      expect(
        resolveTestDatabaseUrl(
          { TEST_DATABASE_URL: LOCAL_TEST_URL, DATABASE_URL: LOCAL_TEST_URL },
          envFilePath,
        ),
      ).toBe(LOCAL_TEST_URL);
    });
  });

  it("accepts TEST_DATABASE_URL equal to a local process-env DIRECT_URL (local singleton convention)", () => {
    withEnvFile(["DIRECT_URL=postgresql://other@127.0.0.1:5432/other"], (envFilePath) => {
      expect(
        resolveTestDatabaseUrl(
          { TEST_DATABASE_URL: LOCAL_TEST_URL, DIRECT_URL: LOCAL_TEST_URL },
          envFilePath,
        ),
      ).toBe(LOCAL_TEST_URL);
    });
  });

  it("rejects a remote TEST_DATABASE_URL even without any conflict", () => {
    withEnvFile(["DATABASE_URL=postgresql://other@127.0.0.1:5432/other"], (envFilePath) => {
      expect(() =>
        resolveTestDatabaseUrl(
          {
            TEST_DATABASE_URL:
              "postgresql://postgres:secret@db.supabase.co:5432/ros?schema=public",
          },
          envFilePath,
        ),
      ).toThrow(/not a local\/test host/);
    });
  });

  it("accepts a distinct local TEST_DATABASE_URL", () => {
    withEnvFile(["DATABASE_URL=postgresql://other@127.0.0.1:5432/other"], (envFilePath) => {
      expect(resolveTestDatabaseUrl({ TEST_DATABASE_URL: LOCAL_TEST_URL }, envFilePath)).toBe(
        LOCAL_TEST_URL,
      );
    });
  });

  it("parseEnvFile strips quotes and skips comments/blank lines", () => {
    withEnvFile(
      [
        "# comment",
        'DATABASE_URL="postgresql://a@127.0.0.1:5432/a"',
        "DIRECT_URL='postgresql://b@127.0.0.1:5432/b'",
        "",
        "UNQUOTED=postgresql://c@127.0.0.1:5432/c",
      ],
      (envFilePath) => {
        const parsed = parseEnvFile(envFilePath);
        expect(parsed.DATABASE_URL).toBe("postgresql://a@127.0.0.1:5432/a");
        expect(parsed.DIRECT_URL).toBe("postgresql://b@127.0.0.1:5432/b");
        expect(parsed.UNQUOTED).toBe("postgresql://c@127.0.0.1:5432/c");
        expect(parsed.COMMENT).toBeUndefined();
      },
    );
  });
});