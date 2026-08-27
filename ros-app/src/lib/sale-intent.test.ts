import { describe, expect, it } from "vitest";
import {
  defaultDueDate,
  findDuplicateSaleProductIds,
  resolveContractUnitPrice,
  resolveCustomerUnitPrice,
  resolveSalePrice,
} from "./sale-intent";

describe("sale intent", () => {
  const prices = { price: 100_000, priceSilver: 90_000, priceGold: 80_000 };

  it("derives the price from the customer instead of trusting manual input", () => {
    expect(resolveSalePrice(prices, "RETAIL")).toBe(100_000);
    expect(resolveSalePrice(prices, "WHOLESALE_SILVER")).toBe(90_000);
    expect(resolveSalePrice(prices, "WHOLESALE_GOLD")).toBe(80_000);
  });

  it("falls back to retail when a wholesale price is not configured", () => {
    expect(resolveSalePrice({ ...prices, priceGold: 0 }, "WHOLESALE_GOLD")).toBe(100_000);
  });

  it("uses the highest eligible contract quantity tier for the customer tier", () => {
    const result = resolveContractUnitPrice([
      { id: "silver-10", tierName: "SILVER", minOrderQty: 10, pricePerUnit: 85_000 },
      { id: "silver-50", tierName: "SILVER", minOrderQty: 50, pricePerUnit: 78_000 },
      { id: "gold-10", tierName: "GOLD", minOrderQty: 10, pricePerUnit: 70_000 },
    ], "WHOLESALE_SILVER", 60);

    expect(result?.id).toBe("silver-50");
  });

  it("uses one resolver for server totals and client previews", () => {
    const belowMinimum = resolveCustomerUnitPrice(prices, "WHOLESALE_SILVER", 9, [
      { id: "silver-10", tierName: "SILVER", minOrderQty: 10, pricePerUnit: 85_000 },
    ]);
    const contract = resolveCustomerUnitPrice(prices, "WHOLESALE_SILVER", 10, [
      { id: "silver-10", tierName: "SILVER", minOrderQty: 10, pricePerUnit: 85_000 },
    ]);

    expect(belowMinimum).toMatchObject({ unitPrice: 90_000, priceSource: "TIER" });
    expect(contract).toMatchObject({
      unitPrice: 85_000,
      contractPriceId: "silver-10",
      priceSource: "CONTRACT",
    });
  });

  it("identifies duplicate products before committing a sale", () => {
    expect(findDuplicateSaleProductIds([
      { productId: "coffee-a" },
      { productId: "coffee-b" },
      { productId: "coffee-a" },
    ])).toEqual(["coffee-a"]);
  });

  it("provides a realistic default due date", () => {
    expect(defaultDueDate(new Date(2026, 6, 19), 14)).toBe("2026-08-02");
  });
});
