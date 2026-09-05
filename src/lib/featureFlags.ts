export const FEATURE_FLAGS = [
  "capacity-only-gates",
  "public-pricing",
  "cropster-killer",
  "artisan-migrant",
  "roastlog-refugee",
  "roasttime-bridge",
  "public-status-page",
  "roast-replay",
  "cupping-parity",
  "hpp-ledger-tile",
  "kasir-hardening",
  "mobile-first",
  "b2b-contract-lifecycle",
] as const;

export type FeatureFlagName = (typeof FEATURE_FLAGS)[number];

export type FeatureFlagSnapshot = Readonly<Record<FeatureFlagName, boolean>>;

const FLAG_PREFIX = "FLAG_";

function envFlagValue(name: FeatureFlagName): string | undefined {
  return process.env[`${FLAG_PREFIX}${name.replace(/-/g, "_").toUpperCase()}`];
}

export function isFlagEnabled(name: FeatureFlagName): boolean {
  const raw = envFlagValue(name);
  if (raw === undefined || raw === "") return false;
  const normalized = raw.trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "on" || normalized === "yes";
}

export function flagSnapshot(): FeatureFlagSnapshot {
  const snapshot = {} as Record<FeatureFlagName, boolean>;
  for (const flag of FEATURE_FLAGS) {
    snapshot[flag] = isFlagEnabled(flag);
  }
  return snapshot;
}

export const FLAG_REQUEST_HEADER = "x-roastd-flags";

export function flagRequestHeaderValue(): string {
  return FEATURE_FLAGS.filter(isFlagEnabled).join(",");
}

export function parseFlagRequestHeader(value: string | null | undefined): FeatureFlagSnapshot {
  const snapshot = {} as Record<FeatureFlagName, boolean>;
  for (const flag of FEATURE_FLAGS) snapshot[flag] = false;
  if (!value) return snapshot;
  const enabled = new Set(value.split(",").map((entry) => entry.trim()).filter(Boolean));
  for (const flag of enabled) {
    if ((FEATURE_FLAGS as readonly string[]).includes(flag)) {
      snapshot[flag as FeatureFlagName] = true;
    }
  }
  return snapshot;
}

export function isFlagEnabledFromSnapshot(snapshot: FeatureFlagSnapshot, name: FeatureFlagName): boolean {
  return snapshot[name] === true;
}