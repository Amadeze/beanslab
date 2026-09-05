import { describe, expect, it } from "vitest";
import { bucketAging } from "./contractAging";

const NOW = new Date("2026-09-03T00:00:00Z");

describe("bucketAging", () => {
  it("returns all-zero buckets for no invoices", () => {
    expect(bucketAging([], NOW)).toEqual({
      current: 0,
      d1to30: 0,
      d31to60: 0,
      d61to90: 0,
      over90: 0,
    });
  });

  it("buckets invoices by overdue days relative to dueDate", () => {
    const invoices = [
      { outstanding: 100, dueDate: new Date("2026-09-10T00:00:00Z") }, // not yet due
      { outstanding: 50, dueDate: new Date("2026-08-25T00:00:00Z") }, // 9 days overdue
      { outstanding: 30, dueDate: new Date("2026-07-15T00:00:00Z") }, // 50 days overdue
      { outstanding: 20, dueDate: new Date("2026-06-01T00:00:00Z") }, // 94 days overdue
      { outstanding: 10, dueDate: new Date("2026-01-01T00:00:00Z") }, // very overdue
    ];
    const result = bucketAging(invoices, NOW);
    expect(result.current).toBe(100);
    expect(result.d1to30).toBe(50);
    expect(result.d31to60).toBe(30);
    expect(result.d61to90).toBe(0);
    expect(result.over90).toBe(30); // 20 + 10
  });

  it("skips invoices with zero outstanding", () => {
    const result = bucketAging(
      [
        { outstanding: 0, dueDate: new Date("2026-01-01T00:00:00Z") },
        { outstanding: 100, dueDate: new Date("2026-10-01T00:00:00Z") },
      ],
      NOW,
    );
    expect(result.over90).toBe(0);
    expect(result.current).toBe(100);
  });

  it("treats null dueDate as 'current' (no overdue)", () => {
    const result = bucketAging(
      [{ outstanding: 100, dueDate: null }],
      NOW,
    );
    expect(result.current).toBe(100);
  });
});