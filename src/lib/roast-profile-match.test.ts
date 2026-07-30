import { describe, expect, it } from "vitest";
import { calculateRoastProfileMatch } from "./roast-profile-match";

const target = {
  duration: 600,
  beanTemperatureSeries: [
    { second: 0, value: 30 },
    { second: 60, value: 90 },
    { second: 300, value: 160 },
    { second: 480, value: 190 },
    { second: 600, value: 205 },
  ],
  events: [
    { type: "DRY_END", second: 300 },
    { type: "FCs", second: 480 },
    { type: "DROP", second: 600 },
  ],
};

describe("server roast profile matching", () => {
  it("recomputes a perfect score from persisted roast curves", () => {
    const result = calculateRoastProfileMatch(target, target);
    expect(result).toMatchObject({ status: "ON_TRACK", score: 100, btRmse: 0, rorRmse: 0 });
  });

  it("does not trust incomplete curve data", () => {
    const result = calculateRoastProfileMatch({ duration: null, beanTemperatureSeries: [], events: [] }, target);
    expect(result).toMatchObject({ status: "INVALID", score: null });
  });

  it("marks a materially hotter roast as divergent", () => {
    const hotter = {
      ...target,
      beanTemperatureSeries: target.beanTemperatureSeries.map((point) => ({ ...point, value: point.value + 10 })),
    };
    const result = calculateRoastProfileMatch(hotter, target);
    expect(result.status).toBe("DIVERGED");
    expect(result.score).toBeLessThan(70);
  });

  it("aligns profiles by CHARGE when recording starts at different times", () => {
    const shifted = {
      ...target,
      beanTemperatureSeries: target.beanTemperatureSeries.map((point) => ({ ...point, second: point.second + 45 })),
      events: [
        { type: "CHARGE", second: 45 },
        ...target.events.map((event) => ({ ...event, second: event.second + 45 })),
      ],
    };
    const actual = {
      ...target,
      events: [{ type: "CHARGE", second: 0 }, ...target.events],
    };
    const result = calculateRoastProfileMatch(actual, shifted);

    expect(result.score).toBe(100);
    expect(result.durationDeltaSeconds).toBe(0);
  });
});
