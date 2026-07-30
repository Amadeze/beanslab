import { describe, expect, it } from "vitest";
import { summarizeLotInventory } from "./lot";

describe("summarizeLotInventory", () => {
  it("uses the ledger balance instead of the original lot quantity", () => {
    const summary = summarizeLotInventory({
      originalKg: 10,
      originalUnit: 0,
      ledgers: [
        { entryType: "IN", quantityKg: 10, quantityUnit: 0 },
        { entryType: "OUT", quantityKg: 4.25, quantityUnit: 0 },
      ],
      expiryDate: null,
      consumedAt: null,
    });

    expect(summary).toMatchObject({ remainingKg: 5.75, status: "ok" });
  });

  it("marks a zero-balance lot as consumed even when consumedAt is missing", () => {
    const summary = summarizeLotInventory({
      originalKg: 5,
      originalUnit: 0,
      ledgers: [
        { entryType: "IN", quantityKg: 5, quantityUnit: 0 },
        { entryType: "OUT", quantityKg: 5, quantityUnit: 0 },
      ],
      expiryDate: new Date("2026-07-28T00:00:00Z"),
      consumedAt: null,
      now: new Date("2026-07-27T00:00:00Z"),
    });

    expect(summary).toMatchObject({ remainingKg: 0, status: "consumed" });
  });

  it("falls back to the original quantity for legacy lots without ledger entries", () => {
    const summary = summarizeLotInventory({
      originalKg: 3,
      originalUnit: 0,
      ledgers: [],
      expiryDate: null,
      consumedAt: null,
    });

    expect(summary.remainingKg).toBe(3);
  });
});
