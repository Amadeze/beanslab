import { describe, expect, it } from "vitest";
import { DeviceStreamHealth } from "../shared/device-stream-health";

describe("device stream accelerated soak", () => {
  it("tracks six hours of samples and explicit connection gaps", () => {
    const health = new DeviceStreamHealth();
    let now = Date.UTC(2026, 6, 29);
    for (let second = 0; second < 6 * 60 * 60; second += 1) {
      if (second === 3_600 || second === 10_800 || second === 18_000) now += 15_000;
      health.recordSample(now, 1_000);
      now += 1_000;
    }
    expect(health.snapshot()).toMatchObject({ sampleCount: 21_600, dataGapCount: 3 });
  });
});
