import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  addMonthsClamped,
  formatLocal,
  getCurrentDate,
  getZonedDayRange,
  getZonedMonthRange,
  getStartOfNextDayWIB,
  getStartOfTodayWIB,
  getTodayString,
  isTodayWIB,
} from "./date-utils";

describe("WIB date helpers", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-19T17:30:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("keeps the current Date as the true instant", () => {
    expect(getCurrentDate().toISOString()).toBe("2026-07-19T17:30:00.000Z");
  });

  it("formats calendar values in Asia/Jakarta", () => {
    expect(getTodayString()).toBe("2026-07-20");
    expect(formatLocal(getCurrentDate(), "yyyy-MM-dd HH:mm")).toBe("2026-07-20 00:30");
  });

  it("returns UTC instants for Jakarta day boundaries", () => {
    expect(getStartOfTodayWIB().toISOString()).toBe("2026-07-19T17:00:00.000Z");
    expect(getStartOfNextDayWIB().toISOString()).toBe("2026-07-20T17:00:00.000Z");
    expect(isTodayWIB(new Date("2026-07-20T10:00:00.000Z"))).toBe(true);
    expect(isTodayWIB(new Date("2026-07-20T17:00:00.000Z"))).toBe(false);
  });
});

describe("tenant reporting periods", () => {
  it("creates an exclusive Jakarta calendar-day range", () => {
    const range = getZonedDayRange(new Date("2026-07-19T12:00:00.000Z"), "Asia/Jakarta");
    expect(range.start.toISOString()).toBe("2026-07-18T17:00:00.000Z");
    expect(range.end.toISOString()).toBe("2026-07-19T17:00:00.000Z");
    expect(range.dateKey).toBe("2026-07-19");
  });

  it("supports tenant timezones and month boundaries", () => {
    const range = getZonedMonthRange(2026, 7, "Asia/Jayapura");
    expect(range.start.toISOString()).toBe("2026-06-30T15:00:00.000Z");
    expect(range.end.toISOString()).toBe("2026-07-31T15:00:00.000Z");
  });
});

describe("addMonthsClamped (billing cycle month-add)", () => {
  it.each([
    // [label, input ISO, months, expected ISO]
    ["Jan 31 + 1M clamps to Feb 28 (non-leap)", "2026-01-31T09:00:00.000Z", 1, "2026-02-28T09:00:00.000Z"],
    ["Jan 31 + 1M clamps to Feb 29 (leap year)", "2028-01-31T09:00:00.000Z", 1, "2028-02-29T09:00:00.000Z"],
    ["Feb 28 + 1M stays Mar 28", "2026-02-28T09:00:00.000Z", 1, "2026-03-28T09:00:00.000Z"],
    ["Feb 29 + 1M keeps day 29 in March (leap year)", "2028-02-29T09:00:00.000Z", 1, "2028-03-29T09:00:00.000Z"],
    ["Mar 31 + 1M clamps to Apr 30", "2026-03-31T09:00:00.000Z", 1, "2026-04-30T09:00:00.000Z"],
    ["May 31 + 1M clamps to Jun 30", "2026-05-31T09:00:00.000Z", 1, "2026-06-30T09:00:00.000Z"],
    ["mid-month date is unchanged", "2026-07-15T09:00:00.000Z", 1, "2026-08-15T09:00:00.000Z"],
    ["Dec 31 + 1M lands on Jan 31 next year", "2026-12-31T09:00:00.000Z", 1, "2027-01-31T09:00:00.000Z"],
    ["Apr 30 - 1M clamps to Mar 31? no — keeps day 30", "2026-04-30T09:00:00.000Z", -1, "2026-03-30T09:00:00.000Z"],
    ["Mar 31 - 1M clamps to Feb 28", "2026-03-31T09:00:00.000Z", -1, "2026-02-28T09:00:00.000Z"],
  ])("%s", (_label, input, months, expected) => {
    const result = addMonthsClamped(new Date(input), months);
    expect(result.toISOString()).toBe(expected);
  });

  it("does not mutate the input date", () => {
    const input = new Date("2026-01-31T09:00:00.000Z");
    addMonthsClamped(input, 1);
    expect(input.toISOString()).toBe("2026-01-31T09:00:00.000Z");
  });

  it("preserves sub-day components across the clamp", () => {
    const result = addMonthsClamped(new Date(2026, 0, 31, 13, 45, 12, 250), 1);
    expect(result.getHours()).toBe(13);
    expect(result.getMinutes()).toBe(45);
    expect(result.getSeconds()).toBe(12);
    expect(result.getMilliseconds()).toBe(250);
  });
});
