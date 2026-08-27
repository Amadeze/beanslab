import { describe, expect, it, vi } from "vitest";

import { resolveLegacyStockDryRun } from "./resolver";
import type { LegacyStockValidatedRow, ResolverContext } from "./types";

function makeContext(overrides: Partial<ResolverContext> = {}): ResolverContext {
  return {
    tenantId: "tenant-test-1",
    findProductByCode: overrides.findProductByCode ?? vi.fn().mockResolvedValue(null),
    findSupplyItemByCode: overrides.findSupplyItemByCode ?? vi.fn().mockResolvedValue(null),
    findSupplierByCode: overrides.findSupplierByCode ?? vi.fn().mockResolvedValue(null),
  };
}

function validRow(overrides: Partial<LegacyStockValidatedRow> = {}): LegacyStockValidatedRow {
  return {
    type: "SUPPLY",
    code: "SUP-001",
    name: "Test Supply",
    quantity: 100,
    unitCost: 500,
    category: "PACKAGING",
    baseUnit: "KG",
    rowNumber: 2,
    errors: [],
    warnings: [],
    isValid: true,
    ...overrides,
  };
}

describe("resolveLegacyStockDryRun", () => {
  it("assigns CREATE for a valid row with no existing match", async () => {
    const ctx = makeContext();
    const result = await resolveLegacyStockDryRun([validRow()], ctx);
    expect(result.summary.createCount).toBe(1);
    expect(result.summary.matchCount).toBe(0);
    expect(result.summary.errorCount).toBe(0);
    expect(result.rows[0].action).toBe("CREATE");
  });

  it("assigns MATCH for a valid row when product exists with correct type", async () => {
    const ctx = makeContext({
      findProductByCode: vi.fn().mockResolvedValue({ id: "prod-1", code: "GB-001", name: "Arabica", type: "GREEN_BEAN" }),
    });
    const row = validRow({
      type: "GREEN_BEAN",
      code: "GB-001",
      category: undefined,
      baseUnit: undefined,
    });
    const result = await resolveLegacyStockDryRun([row], ctx);
    expect(result.summary.matchCount).toBe(1);
    expect(result.rows[0].action).toBe("MATCH");
    expect(result.rows[0].matchedEntityType).toBe("PRODUCT");
    expect(result.rows[0].matchedEntityId).toBe("prod-1");
  });

  it("assigns MATCH for SUPPLY when supply item exists with correct category", async () => {
    const ctx = makeContext({
      findSupplyItemByCode: vi.fn().mockResolvedValue({ id: "sup-1", code: "SUP-001", name: "Bags", category: "PACKAGING" }),
    });
    const result = await resolveLegacyStockDryRun([validRow()], ctx);
    expect(result.summary.matchCount).toBe(1);
    expect(result.rows[0].action).toBe("MATCH");
    expect(result.rows[0].matchedEntityType).toBe("SUPPLY");
  });

  it("errors when existing product type conflicts", async () => {
    const ctx = makeContext({
      findProductByCode: vi.fn().mockResolvedValue({ id: "prod-1", code: "GB-001", name: "Arabica", type: "ROASTED_BEAN" }),
    });
    const row = validRow({
      type: "GREEN_BEAN",
      code: "GB-001",
      category: undefined,
      baseUnit: undefined,
    });
    const result = await resolveLegacyStockDryRun([row], ctx);
    expect(result.summary.errorCount).toBe(1);
    expect(result.rows[0].action).toBe("ERROR");
    expect(result.rows[0].errors.some((e) => e.field === "type" && e.message?.includes("not GREEN_BEAN"))).toBe(true);
  });

  it("errors when existing supply category conflicts", async () => {
    const ctx = makeContext({
      findSupplyItemByCode: vi.fn().mockResolvedValue({ id: "sup-1", code: "SUP-001", name: "Bags", category: "INGREDIENT" }),
    });
    const result = await resolveLegacyStockDryRun([validRow()], ctx);
    expect(result.summary.errorCount).toBe(1);
    expect(result.rows[0].action).toBe("ERROR");
    expect(result.rows[0].errors.some((e) => e.field === "category" && e.message?.includes("not PACKAGING"))).toBe(true);
  });

  it("errors for rows that failed validation", async () => {
    const ctx = makeContext();
    const invalidRow: LegacyStockValidatedRow = {
      ...validRow({ code: "" }),
      errors: [{ field: "code", message: "Code is required." }],
      isValid: false,
    };
    const result = await resolveLegacyStockDryRun([invalidRow], ctx);
    expect(result.summary.errorCount).toBe(1);
    expect(result.rows[0].action).toBe("ERROR");
    expect(ctx.findProductByCode).not.toHaveBeenCalled();
  });

  it("produces correct summary with mixed valid/invalid/match/create rows", async () => {
    const ctx = makeContext({
      findProductByCode: vi.fn().mockResolvedValue({ id: "p1", code: "GB-001", name: "A", type: "GREEN_BEAN" }),
      findSupplyItemByCode: vi
        .fn()
        .mockResolvedValueOnce({ id: "s1", code: "SUP-001", name: "B", category: "PACKAGING" })
        .mockResolvedValueOnce(null),
    });

    const rows: LegacyStockValidatedRow[] = [
      // MATCH - existing product
      validRow({ type: "GREEN_BEAN", code: "GB-001", category: undefined, baseUnit: undefined }),
      // MATCH - existing supply
      validRow({ code: "SUP-001" }),
      // CREATE - no existing supply
      validRow({ code: "SUP-002" }),
      // ERROR - invalid
      {
        ...validRow({ code: "SUP-003" }),
        errors: [{ field: "code", message: "bad" }],
        isValid: false,
      },
    ];

    const result = await resolveLegacyStockDryRun(rows, ctx);
    expect(result.summary.totalRows).toBe(4);
    expect(result.summary.validRows).toBe(3);
    expect(result.summary.matchCount).toBe(2);
    expect(result.summary.createCount).toBe(1);
    expect(result.summary.errorCount).toBe(1);
  });
});
