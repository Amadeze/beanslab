const baseUrl = process.env.LOAD_TEST_URL;
if (!baseUrl) {
  console.error("LOAD_TEST_URL is required, for example https://app.roastd.id");
  process.exit(1);
}

const path = process.env.LOAD_TEST_PATH || "/api/health";
const requestCount = positiveInteger("LOAD_TEST_REQUESTS", 500);
const concurrency = Math.min(200, positiveInteger("LOAD_TEST_CONCURRENCY", 25));
const timeoutMs = positiveInteger("LOAD_TEST_TIMEOUT_MS", 10_000);
const maxP95Ms = positiveInteger("LOAD_TEST_MAX_P95_MS", 1_500);
const maxErrorRate = Number(process.env.LOAD_TEST_MAX_ERROR_RATE || 0.01);
const cookie = process.env.LOAD_TEST_COOKIE;
const target = new URL(path, baseUrl).toString();

function positiveInteger(name, fallback) {
  const parsed = Number.parseInt(process.env[name] || "", 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function percentile(sorted, value) {
  if (sorted.length === 0) return 0;
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * value) - 1)];
}

let nextRequest = 0;
const results = [];

async function worker() {
  while (true) {
    const requestIndex = nextRequest++;
    if (requestIndex >= requestCount) return;
    const startedAt = performance.now();
    try {
      const response = await fetch(target, {
        method: "GET",
        headers: cookie ? { Cookie: cookie } : undefined,
        redirect: "manual",
        signal: AbortSignal.timeout(timeoutMs),
      });
      await response.arrayBuffer();
      results.push({
        ok: response.ok,
        status: response.status,
        latencyMs: performance.now() - startedAt,
      });
    } catch (error) {
      results.push({
        ok: false,
        status: 0,
        latencyMs: performance.now() - startedAt,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}

const wallStartedAt = performance.now();
await Promise.all(Array.from({ length: concurrency }, () => worker()));
const wallTimeMs = performance.now() - wallStartedAt;
const latencies = results.map((result) => result.latencyMs).sort((a, b) => a - b);
const failures = results.filter((result) => !result.ok);
const statuses = Object.fromEntries(
  [...new Set(results.map((result) => result.status))]
    .sort((a, b) => a - b)
    .map((status) => [status, results.filter((result) => result.status === status).length]),
);
const errorRate = failures.length / Math.max(1, results.length);
const summary = {
  target,
  requests: results.length,
  concurrency,
  wallTimeMs: Math.round(wallTimeMs),
  requestsPerSecond: Number((results.length / (wallTimeMs / 1_000)).toFixed(2)),
  latencyMs: {
    min: Math.round(latencies[0] || 0),
    p50: Math.round(percentile(latencies, 0.5)),
    p95: Math.round(percentile(latencies, 0.95)),
    p99: Math.round(percentile(latencies, 0.99)),
    max: Math.round(latencies.at(-1) || 0),
  },
  statuses,
  failures: failures.length,
  errorRate: Number(errorRate.toFixed(4)),
  thresholds: { maxP95Ms, maxErrorRate },
};

console.log(JSON.stringify(summary, null, 2));
if (summary.latencyMs.p95 > maxP95Ms || errorRate > maxErrorRate) process.exitCode = 1;
