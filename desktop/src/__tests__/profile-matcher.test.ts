import { describe, expect, it } from "vitest";
import { matchRoastProfile } from "../main/profile-matcher";
import type { RoastReferenceProfile, RoastStudioPoint } from "../shared/types";

function reference(): RoastReferenceProfile {
  return {
    id: "roast-reference",
    title: "Gayo Medium v3",
    machineId: "machine-1",
    durationSeconds: 600,
    greenWeightGrams: 5000,
    points: [
      { second: 0, bt: 30, et: 180, ror: null },
      { second: 60, bt: 90, et: 190, ror: 15 },
      { second: 300, bt: 160, et: 205, ror: 10 },
      { second: 480, bt: 190, et: 215, ror: 7 },
      { second: 600, bt: 205, et: 220, ror: 5 },
    ],
    events: [
      { type: "CHARGE", second: 0, bt: 30 },
      { type: "DRY_END", second: 300, bt: 160 },
      { type: "FCs", second: 480, bt: 190 },
      { type: "DROP", second: 600, bt: 205 },
    ],
  };
}

describe("roast profile matching", () => {
  it("scores an identical finished roast as a perfect match", () => {
    const target = reference();
    const result = matchRoastProfile(target.points, target.events, target, true);

    expect(result?.status).toBe("ON_TRACK");
    expect(result?.message).toContain("Tahan pola");
    expect(result?.score).toBe(100);
    expect(result?.btRmse).toBe(0);
    expect(result?.rorRmse).toBe(0);
    expect(result?.durationDeltaSeconds).toBe(0);
  });

  it("interpolates a sparse target and reports actionable live deviation", () => {
    const actual: RoastStudioPoint[] = [
      { second: 0, bt: 30, et: 180, ror: null },
      { second: 30, bt: 66, et: 186, ror: 19 },
    ];
    const result = matchRoastProfile(actual, [{ type: "CHARGE", second: 0, bt: 30 }], reference());

    expect(result?.latestBtDelta).toBe(6);
    expect(result?.status).toBe("WATCH");
    expect(result?.score).toBeNull();
    expect(result?.message).toContain("Pantau RoR");
  });

  it("flags a materially divergent curve", () => {
    const target = reference();
    const actual = target.points.map((point) => ({
      ...point,
      bt: point.bt == null ? null : point.bt + 10,
      ror: point.ror == null ? null : point.ror + 6,
    }));
    const result = matchRoastProfile(actual, target.events, target, true);

    expect(result?.status).toBe("DIVERGED");
    expect(result?.score).toBeLessThan(70);
    expect(result?.message).toContain("terlalu cepat");
  });

  it("rejects an empty target instead of producing a misleading score", () => {
    const target = { ...reference(), points: [] };
    const result = matchRoastProfile([], [], target, true);

    expect(result?.status).toBe("INVALID");
    expect(result?.score).toBeNull();
  });

  it("aligns curves by CHARGE instead of recorder start time", () => {
    const target = reference();
    const shifted = {
      ...target,
      points: target.points.map((point) => ({ ...point, second: point.second + 30 })),
      events: target.events.map((event) => ({ ...event, second: event.second + 30 })),
    };
    const result = matchRoastProfile(target.points, target.events, shifted, true);

    expect(result?.score).toBe(100);
    expect(result?.durationDeltaSeconds).toBe(0);
  });
});
