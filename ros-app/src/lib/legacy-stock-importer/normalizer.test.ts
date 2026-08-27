import { describe, expect, it } from "vitest";

import { normalizeLegacyStockRows } from "./normalizer";
import type { LegacyStockRawRow } from "./types";

function baseRawRow(overrides: Partial<LegacyStockRawRow> = {}): LegacyStockRawRow {
  return {
    type: "SUPPLY",
    code: "SUP-001",
    name: "Test Supply",
    quantity: "100",
    unitCost: "500",
    ...overrides,
  };
}

describe("normalizeLegacyStockRows", () => {
  it("converts string quantity and unitCost to numbers", () => {
    const rows = normalizeLegacyStockRows([baseRawRow({ quantity: "1,500.50", unitCost: "12.99" })]);
    expect(rows[0].quantity).toBe(1500.5);
    expect(rows[0].unitCost).toBe(12.99);
  });

  it("uppercases code and trims whitespace from name", () => {
    const rows = normalizeLegacyStockRows([baseRawRow({ code: " sup-001 ", name: "  Test Supply  " })]);
    expect(rows[0].code).toBe("SUP-001");
    expect(rows[0].name).toBe("Test Supply");
  });

  it("uppercases type and supply category/baseUnit", () => {
    const rows = normalizeLegacyStockRows([
      baseRawRow({
        type: "supply",
        category: "packaging",
        baseUnit: "kg",
      }),
    ]);
    expect(rows[0].type).toBe("SUPPLY");
    expect(rows[0].category).toBe("PACKAGING");
    expect(rows[0].baseUnit).toBe("KG");
  });

  it("parses ISO date strings to Date objects", () => {
    const rows = normalizeLegacyStockRows([
      baseRawRow({ receivedAt: "2024-01-15", expiryDate: "2024-06-30" }),
    ]);
    expect(rows[0].receivedAt).toBeInstanceOf(Date);
    expect(rows[0].expiryDate).toBeInstanceOf(Date);
    expect(rows[0].receivedAt?.toISOString()).toMatch(/2024-01-15/);
  });

  it("parses DD/MM/YYYY date format", () => {
    const rows = normalizeLegacyStockRows([baseRawRow({ receivedAt: "15/01/2024" })]);
    expect(rows[0].receivedAt).toBeInstanceOf(Date);
    expect(rows[0].receivedAt?.getFullYear()).toBe(2024);
    expect(rows[0].receivedAt?.getMonth()).toBe(0);
    expect(rows[0].receivedAt?.getDate()).toBe(15);
  });

  it("assigns rowNumber starting from 2 (header = row 1)", () => {
    const rows = normalizeLegacyStockRows([baseRawRow(), baseRawRow({ code: "SUP-002" })]);
    expect(rows[0].rowNumber).toBe(2);
    expect(rows[1].rowNumber).toBe(3);
  });

  it("handles empty raw rows gracefully", () => {
    const rows = normalizeLegacyStockRows([]);
    expect(rows).toHaveLength(0);
  });
});
