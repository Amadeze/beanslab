// Safety gate for destructive Prisma CLI commands (migrate dev/deploy/reset,
// db push). It replicates prisma.config.ts URL resolution exactly
// (DIRECT_URL wins over DATABASE_URL; .env.local fills what the shell did not
// set) so the gate cannot be bypassed by only overriding DATABASE_URL in the
// shell. It refuses to proceed when the resolved target is not a local host
// unless ALLOW_REMOTE_MIGRATIONS=true is set explicitly.
import { readFileSync } from "node:fs";
import { join } from "node:path";

const SAFE_HOSTS = new Set(["localhost", "127.0.0.1", "0.0.0.0", "host.docker.internal"]);

function parseEnvFile(path) {
  const result = {};
  try {
    for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Z_]+)\s*=\s*(.*?)\s*$/);
      if (!match) continue;
      const value = match[2].replace(/^"(.*)"$/, "$1").replace(/^'(.*)'$/, "$1");
      if (value.length > 0) result[match[1]] = value;
    }
  } catch {
    // .env.local may be absent; process.env values are used below.
  }
  return result;
}

const fromEnvFile = parseEnvFile(join(process.cwd(), ".env.local"));
const resolved =
  process.env.DIRECT_URL ||
  fromEnvFile.DIRECT_URL ||
  process.env.DATABASE_URL ||
  fromEnvFile.DATABASE_URL;

if (!resolved) {
  console.error("[guard-prisma-target] No DIRECT_URL/DATABASE_URL found. Refusing to run.");
  process.exit(1);
}

let host;
try {
  host = new URL(resolved).hostname;
} catch {
  console.error("[guard-prisma-target] DIRECT_URL/DATABASE_URL is not a valid URL. Refusing to run.");
  process.exit(1);
}

const isLocal = SAFE_HOSTS.has(host) || host.endsWith(".local");
if (!isLocal && process.env.ALLOW_REMOTE_MIGRATIONS !== "true") {
  console.error(
    "[guard-prisma-target] Refusing to run: the Prisma CLI would target a NON-LOCAL database " +
      `(host ${host}). Set ALLOW_REMOTE_MIGRATIONS=true explicitly to allow it; ` +
      "otherwise target a local instance (localhost/127.0.0.1/host.docker.internal/*.local) via DIRECT_URL.",
  );
  process.exit(1);
}
if (!isLocal) {
  console.warn("[guard-prisma-target] ALLOW_REMOTE_MIGRATIONS=true — proceeding against a non-local host.");
}
