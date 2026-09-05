import { describe, expect, it } from "vitest";
import { computeRoRSeries } from "./roastCurveReplayMath";

describe("computeRoRSeries", () => {
  it("returns empty array for empty input", () => {
    expect(computeRoRSeries([])).toEqual([]);
  });

  it("emits nulls at endpoints that lack neighbours within the window", () => {
    const series = [
      { second: 0, value: 100 },
      { second: 5, value: 101 },
    ];
    const result = computeRoRSeries(series, 10);
    expect(result.length).toBe(2);
    expect(result[0].value).toBeNull();
    expect(result[1].value).toBeNull();
  });

  it("computes rate of rise in °C per minute for a linear ramp", () => {
    const series = Array.from({ length: 11 }, (_, index) => ({
      second: index * 10,
      value: 100 + index,
    }));
    const result = computeRoRSeries(series, 10);
    const middle = result[5];
    expect(middle.second).toBe(50);
    expect(middle.value).not.toBeNull();
    expect(middle.value as number).toBeCloseTo(6, 1);
  });

  it("tolerates unordered input by sorting by second", () => {
    const series = [
      { second: 20, value: 102 },
      { second: 0, value: 100 },
      { second: 10, value: 101 },
    ];
    const result = computeRoRSeries(series, 10);
    expect(result.map((point) => point.second)).toEqual([0, 10, 20]);
  });
});