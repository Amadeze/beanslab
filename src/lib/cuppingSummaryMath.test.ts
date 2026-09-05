import { describe, expect, it } from "vitest";
import { computeConsensusFromScores, type CuppingScoreInput } from "./cuppingSummaryMath";
import { scaGrade } from "./cupping-intelligence";

const ALL_HIGH: CuppingScoreInput[] = [
  { FRAGRANCE: 9, AROMA: 9, FLAVOR: 9, AFTERTASTE: 9, ACIDITY: 9, BODY: 9, BALANCE: 9, UNIFORMITY: 10, CLEAN_CUP: 10, SWEETNESS: 10, OVERALL: 9 },
  { FRAGRANCE: 8.5, AROMA: 8.5, FLAVOR: 8.5, AFTERTASTE: 8.5, ACIDITY: 8.5, BODY: 8.5, BALANCE: 8.5, UNIFORMITY: 10, CLEAN_CUP: 10, SWEETNESS: 10, OVERALL: 8.5 },
];

describe("computeConsensusFromScores", () => {
  it("returns an empty consensus for no sessions", () => {
    const result = computeConsensusFromScores([]);
    expect(result.sessionCount).toBe(0);
    expect(result.meanTotal).toBeNull();
    expect(result.minTotal).toBeNull();
    expect(result.maxTotal).toBeNull();
    expect(result.agreementPercent).toBeNull();
  });

  it("computes mean/min/max for two sessions", () => {
    const result = computeConsensusFromScores(ALL_HIGH, 0);
    expect(result.sessionCount).toBe(2);
    expect(result.meanTotal).not.toBeNull();
    expect(result.minTotal).not.toBeNull();
    expect(result.maxTotal).not.toBeNull();
    expect(result.minTotal as number).toBeLessThanOrEqual(result.meanTotal as number);
    expect(result.meanTotal as number).toBeLessThanOrEqual(result.maxTotal as number);
  });

  it("agreement is 100 when min equals max", () => {
    const same: CuppingScoreInput[] = [
      ALL_HIGH[0],
      ALL_HIGH[0],
    ];
    const result = computeConsensusFromScores(same, 0);
    expect(result.agreementPercent).toBe(100);
  });

  it("composite maps to OUTSTANDING or EXCELLENT for high scores", () => {
    const result = computeConsensusFromScores(ALL_HIGH, 0);
    expect(["OUTSTANDING", "EXCELLENT"]).toContain(scaGrade(result.meanTotal as number));
  });

  it("penalty reduces the composite as expected", () => {
    const noDefect = computeConsensusFromScores(ALL_HIGH, 0);
    const withTwoDefects = computeConsensusFromScores(ALL_HIGH, 2);
    expect(withTwoDefects.meanTotal as number).toBeLessThan(noDefect.meanTotal as number);
  });
});