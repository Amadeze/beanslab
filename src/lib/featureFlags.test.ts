import { describe, expect, it, beforeEach } from "vitest";
import {
  FEATURE_FLAGS,
  isFlagEnabled,
  isFlagEnabledFromSnapshot,
  flagSnapshot,
  flagRequestHeaderValue,
  parseFlagRequestHeader,
} from "./featureFlags";

describe("featureFlags", () => {
  beforeEach(() => {
    for (const flag of FEATURE_FLAGS) {
      const envKey = `FLAG_${flag.replace(/-/g, "_").toUpperCase()}`;
      delete process.env[envKey];
    }
  });

  it("treats missing env as disabled", () => {
    for (const flag of FEATURE_FLAGS) {
      expect(isFlagEnabled(flag)).toBe(false);
    }
  });

  it("accepts boolean-like values", () => {
    process.env["FLAG_PUBLIC_PRICING"] = "true";
    process.env["FLAG_CROPSTER_KILLER"] = "1";
    process.env["FLAG_ARTISAN_MIGRANT"] = "on";
    process.env["FLAG_PUBLIC_STATUS_PAGE"] = "yes";
    expect(isFlagEnabled("public-pricing")).toBe(true);
    expect(isFlagEnabled("cropster-killer")).toBe(true);
    expect(isFlagEnabled("artisan-migrant")).toBe(true);
    expect(isFlagEnabled("public-status-page")).toBe(true);
    expect(isFlagEnabled("roasttime-bridge")).toBe(false);
  });

  it("produces a complete snapshot", () => {
    process.env["FLAG_CAPACITY_ONLY_GATES"] = "true";
    const snapshot = flagSnapshot();
    for (const flag of FEATURE_FLAGS) {
      expect(typeof snapshot[flag]).toBe("boolean");
    }
    expect(snapshot["capacity-only-gates"]).toBe(true);
    expect(snapshot["public-pricing"]).toBe(false);
  });

  it("encodes and parses request headers round-trip", () => {
    process.env["FLAG_PUBLIC_PRICING"] = "true";
    process.env["FLAG_CROPSTER_KILLER"] = "true";
    const headerValue = flagRequestHeaderValue();
    expect(headerValue.split(",").sort()).toEqual(
      ["cropster-killer", "public-pricing"].sort(),
    );
    const parsed = parseFlagRequestHeader(headerValue);
    expect(parsed["public-pricing"]).toBe(true);
    expect(parsed["cropster-killer"]).toBe(true);
    expect(parsed["capacity-only-gates"]).toBe(false);
  });

  it("parses empty header as all-disabled", () => {
    const parsed = parseFlagRequestHeader(null);
    for (const flag of FEATURE_FLAGS) {
      expect(parsed[flag]).toBe(false);
    }
  });

  it("ignores unknown flag names in header", () => {
    const parsed = parseFlagRequestHeader("public-pricing,nope");
    expect(parsed["public-pricing"]).toBe(true);
    expect((parsed as Record<string, boolean>)["nope"]).toBeUndefined();
  });

  it("snapshots do not expose mutable internals (compile-time check)", () => {
    const snapshot: Record<string, unknown> = flagSnapshot();
    expect(typeof snapshot["public-pricing"]).toBe("boolean");
    expect(isFlagEnabledFromSnapshot(snapshot as never, "public-pricing")).toBe(false);
  });
});