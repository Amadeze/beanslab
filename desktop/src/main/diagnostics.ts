import * as fs from "fs";
import * as path from "path";

const SECRET_KEY = /(token|secret|password|credential|api[_-]?key|serverkey|clientkey)/i;

export function sanitizeDiagnosticValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sanitizeDiagnosticValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, child]) => [
      key,
      SECRET_KEY.test(key) ? "[REDACTED]" : sanitizeDiagnosticValue(child),
    ]));
  }
  if (typeof value === "string") {
    return value
      .replace(/(bearer\s+)[a-z0-9._~-]+/gi, "$1[REDACTED]")
      .replace(/("(?:connectorToken|token|secret|password|apiKey|serverKey|clientKey)"\s*:\s*")[^"]+/gi, "$1[REDACTED]");
  }
  return value;
}

function recentLogLines(logDir: string, limit = 150): string[] {
  if (!fs.existsSync(logDir)) return [];
  const files = fs.readdirSync(logDir).filter((name) => name.endsWith(".log")).sort().reverse();
  const lines: string[] = [];
  for (const filename of files.slice(0, 3)) {
    const content = fs.readFileSync(path.join(logDir, filename), "utf8").split(/\r?\n/).filter(Boolean);
    lines.push(...content.slice(-limit));
    if (lines.length >= limit) break;
  }
  return lines.slice(-limit).map((line) => String(sanitizeDiagnosticValue(line)));
}

export function createDiagnosticReport(input: {
  outputDir: string; logDir: string; version: string; platform: string;
  status: string; queueSize: number; settings: unknown; bridgeState: unknown; devices: unknown[];
}) {
  fs.mkdirSync(input.outputDir, { recursive: true });
  const report = sanitizeDiagnosticValue({
    generatedAt: new Date().toISOString(),
    app: { name: "Roastd Studio", version: input.version, platform: input.platform },
    connection: { status: input.status, queueSize: input.queueSize },
    settings: input.settings,
    bridgeState: input.bridgeState,
    detectedDevices: input.devices,
    recentLogs: recentLogLines(input.logDir),
  });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const filePath = path.join(input.outputDir, `roastd-diagnostic-${stamp}.json`);
  fs.writeFileSync(filePath, JSON.stringify(report, null, 2), "utf8");
  return filePath;
}
