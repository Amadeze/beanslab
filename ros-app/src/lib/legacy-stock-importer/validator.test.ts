import { describe, expect, it } from "vitest";

import { validateLegacyStockRows } from "./validator";
import type { LegacyStockNormalizedRow } from "./types";

function validSupplyRow(overrides: Partial<LegacyStockNormalizedRow> = {}): LegacyStockNormalizedRow {
  return {
    type: "SUPPLY",
    code: "SUP-001",
    name: "Test Supply",
    quantity: 100,
    unitCost: 500,
    category: "PACKAGING",
    baseUnit: "KG",
    rowNumber: 2,
    ...overrides,
  };
}

function validGreenBeanRow(overrides: Partial<LegacyStockNormalizedRow> = {}): LegacyStockNormalizedRow {
  return {
    type: "GREEN_BEAN",
    code: "GB-001",
    name: "Arabica Beans",
    quantity: 25,
    unitCost: 12000,
    rowNumber: 2,
    ...overrides,
  };
}

function validFinishedGoodsRow(overrides: Partial<LegacyStockNormalizedRow> = {}): LegacyStockNormalizedRow {
  return {
    type: "FINISHED_GOODS",
    code: "FG-001",
    name: "Ready Coffee",
    quantity: 10,
    unitCost: 30000,
    netWeightGrams: 250,
    rowNumber: 2,
    ...overrides,
  };
}

describe("validateLegacyStockRows", () => {
  it("validates SUPPLY row as valid with category and baseUnit", () => {
    const results = validateLegacyStockRows([validSupplyRow()]);
    expect(results[0].isValid).toBe(true);
    expect(results[0].errors).toHaveLength(0);
  });

  it("validates GREEN_BEAN row as valid", () => {
    const results = validateLegacyStockRows([validGreenBeanRow()]);
    expect(results[0].isValid).toBe(true);
  });

  it("validates FINISHED_GOODS row as valid with netWeightGrams", () => {
    const results = validateLegacyStockRows([validFinishedGoodsRow()]);
    expect(results[0].isValid).toBe(true);
  });

  it("rejects SUPPLY row without category", () => {
    const results = validateLegacyStockRows([validSupplyRow({ category: undefined })]);
    expect(results[0].isValid).toBe(false);
    expect(results[0].errors.some((e) => e.field === "category")).toBe(true);
  });

  it("rejects SUPPLY row without baseUnit", () => {
    const results = validateLegacyStockRows([validSupplyRow({ baseUnit: undefined })]);
    expect(results[0].isValid).toBe(false);
    expect(results[0].errors.some((e) => e.field === "baseUnit")).toBe(true);
  });

  it("rejects row with invalid type defaulting to SUPPLY", () => {
    const results = validateLegacyStockRows([
      validSupplyRow({ type: "INVALID" as never }),
    ]);
    expect(results[0].isValid).toBe(false);
    expect(results[0].errors.some((e) => e.field === "type")).toBe(true);
  });

  it("rejects row with empty code", () => {
    const results = validateLegacyStockRows([validSupplyRow({ code: "" })]);
    expect(results[0].isValid).toBe(false);
    expect(results[0].errors.some((e) => e.field === "code" && e.message === "Code is required.")).toBe(true);
  });

  it("rejects row with negative quantity", () => {
    const results = validateLegacyStockRows([validSupplyRow({ quantity: -5 })]);
    expect(results[0].isValid).toBe(false);
    expect(results[0].errors.some((e) => e.field === "quantity" && e.message === "Quantity must be > 0.")).toBe(true);
  });

  it("rejects row with negative unitCost", () => {
    const results = validateLegacyStockRows([validSupplyRow({ unitCost: -100 })]);
    expect(results[0].isValid).toBe(false);
    expect(results[0].errors.some((e) => e.field === "unitCost" && e.message === "Unit cost must be ≥ 0.")).toBe(true);
  });

  it("detects duplicate codes without lotNumber in the same file", () => {
    const row1 = validSupplyRow({ code: "DUP-001", rowNumber: 2 });
    const row2 = validSupplyRow({ code: "DUP-001", rowNumber: 3 });
    const results = validateLegacyStockRows([row1, row2]);
    expect(results[0].isValid).toBe(false);
    expect(results[1].isValid).toBe(false);
    expect(results[0].errors.some((e) => e.field === "code" && e.message?.includes("Duplicate"))).toBe(true);
  });

  it("allows same code with different lotNumber (multiple lots per SKU)", () => {
    const row1 = validSupplyRow({ code: "MULTI-001", lotNumber: "LOT-A", rowNumber: 2 });
    const row2 = validSupplyRow({ code: "MULTI-001", lotNumber: "LOT-B", rowNumber: 3 });
    const results = validateLegacyStockRows([row1, row2]);
    expect(results[0].isValid).toBe(true);
    expect(results[1].isValid).toBe(true);
  });

  it("detects empty (blank) rows — name too long", () => {
    const longName = "x".repeat(121);
    const results = validateLegacyStockRows([validSupplyRow({ name: longName })]);
    expect(results[0].isValid).toBe(false);
    expect(results[0].errors.some((e) => e.field === "name" && e.message === "Name must be ≤ 120 characters.")).toBe(true);
  });

  it("warns when GREEN_BEAN has category set", () => {
    const results = validateLegacyStockRows([
      validGreenBeanRow({ category: "INGREDIENT" }),
    ]);
    expect(results[0].isValid).toBe(true);
    expect(results[0].warnings.some((w) => w.field === "category")).toBe(true);
  });

  it("warns when ROASTED_BEAN has no roastLevel", () => {
    const row: LegacyStockNormalizedRow = {
      ...validGreenBeanRow({ type: "ROASTED_BEAN" }),
      roastLevel: undefined,
    };
    const results = validateLegacyStockRows([row]);
    expect(results[0].warnings.some((w) => w.field === "roastLevel")).toBe(true);
  });

  it("warns when unitCost is 0", () => {
    const results = validateLegacyStockRows([validSupplyRow({ unitCost: 0 })]);
    expect(results[0].warnings.some((w) => w.field === "unitCost")).toBe(true);
  });
});
