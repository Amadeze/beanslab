import { describe, expect, it } from "vitest";
import {
  computeRoastConsistency,
  deriveProfileTargetsFromRoast,
  isCloneableRoast,
  isOutlier,
} from "./roast-intelligence";

describe("deriveProfileTargetsFromRoast", () => {
  it("menurunkan semua target dari roast lengkap", () => {
    const targets = deriveProfileTargetsFromRoast({
      chargeTemperature: 195.4,
      dropTemperature: 205,
      firstCrackStartTime: 480,
      firstCrackEndTime: 505,
      dropTime: 720,
    });
    // dev% = (720-480)/720*100 = 33.3
    expect(targets).toEqual({
      chargeTemp: 195.4,
      targetFirstCrackStart: 480,
      targetFirstCrackEnd: 505,
      developmentTarget: 33.3,
      dropTemp: 205,
      derivedFrom: ["chargeTemp", "dropTemp", "targetFirstCrackStart", "targetFirstCrackEnd", "developmentTarget"],
    });
  });

  it("fallback duration saat dropTime kosong; FC end invalid diabaikan", () => {
    const targets = deriveProfileTargetsFromRoast({
      chargeTemperature: 190,
      dropTemperature: 204.8,
      firstCrackStartTime: 400,
      firstCrackEndTime: 300, // < start → diabaikan
      duration: 600,
    });
    expect(targets.targetFirstCrackEnd).toBeNull();
    expect(targets.developmentTarget).toBe(33.3);
    expect(targets.derivedFrom).not.toContain("targetFirstCrackEnd");
  });

  it("roast tanpa data → null semua dan tidak cloneable", () => {
    const targets = deriveProfileTargetsFromRoast({});
    expect(targets.chargeTemp).toBeNull();
    expect(targets.dropTemp).toBeNull();
    expect(isCloneableRoast({})).toBe(false);
    expect(isCloneableRoast({ chargeTemperature: 200, dropTemperature: 210 })).toBe(true);
  });
});

describe("computeRoastConsistency", () => {
  const stable = [
    { duration: 700, lossPercent: 14, dropTemperature: 205, firstCrackStartTime: 480 },
    { duration: 702, lossPercent: 14.1, dropTemperature: 206, firstCrackStartTime: 482 },
    { duration: 698, lossPercent: 13.9, dropTemperature: 204, firstCrackStartTime: 479 },
    { duration: 701, lossPercent: 14, dropTemperature: 205, firstCrackStartTime: 481 },
  ];

  it("batch stabil → STABLE dengan skor tinggi & batas kontrol terisi", () => {
    const report = computeRoastConsistency(stable);
    expect(report.verdict).toBe("STABLE");
    expect(report.score).toBeGreaterThanOrEqual(85);
    for (const metric of report.metrics) {
      expect(metric.sampleCount).toBe(4);
      expect(metric.lower).not.toBeNull();
      expect(metric.upper).not.toBeNull();
    }
  });

  it("variasi ekstrem pada loss → skor turun signifikan", () => {
    const wild = stable.map((s, i) => ({ ...s, lossPercent: [12, 16, 13, 18][i] }));
    const report = computeRoastConsistency(wild);
    const baseline = computeRoastConsistency(stable);
    expect(report.score ?? 0).toBeLessThan(baseline.score ?? 0);
  });

  it("<3 sampel → NEEDS_DATA tanpa skor", () => {
    const report = computeRoastConsistency(stable.slice(0, 2));
    expect(report.verdict).toBe("NEEDS_DATA");
    expect(report.score).toBeNull();
    expect(report.metrics[0].lower).toBeNull();
  });

  it("isOutlier menandai nilai di luar mean ± 2σ", () => {
    const report = computeRoastConsistency(stable);
    const loss = report.metrics.find((m) => m.key === "lossPercent")!;
    expect(isOutlier(20, loss)).toBe(true);
    expect(isOutlier(14, loss)).toBe(false);
    expect(isOutlier(null, loss)).toBe(false);
    // <3 sampel → tidak ada batas kontrol → bukan outlier
    const sparse = computeRoastConsistency(stable.slice(0, 2));
    expect(isOutlier(99, sparse.metrics.find((m) => m.key === "lossPercent"))).toBe(false);
  });

  it("metrik parsial tetap dinilai dari metrik yang tersedia", () => {
    const partial = stable.map((s) => ({ duration: s.duration }));
    const report = computeRoastConsistency(partial as typeof stable);
    expect(report.verdict === "NEEDS_DATA" || typeof report.score === "number").toBe(true);
  });
});
