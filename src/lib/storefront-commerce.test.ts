import { describe, expect, it } from "vitest";
import { calculateStorefrontTotals } from "./storefront-commerce";

const rules = {
  pickupEnabled: true,
  deliveryEnabled: true,
  flatShippingRate: 20_000,
  freeShippingMinimum: 300_000,
  taxRate: 11,
};

describe("calculateStorefrontTotals", () => {
  it("keeps pickup free and calculates tenant tax", () => {
    expect(calculateStorefrontTotals(100_000, "PICKUP", rules)).toEqual({
      subtotal: 100_000, tax: 11_000, shippingCost: 0, grandTotal: 111_000,
    });
  });

  it("applies flat shipping below the free-shipping minimum", () => {
    expect(calculateStorefrontTotals(100_000, "LOCAL_DELIVERY", rules).grandTotal).toBe(131_000);
  });

  it("waives shipping at the configured minimum", () => {
    expect(calculateStorefrontTotals(300_000, "COURIER", rules).shippingCost).toBe(0);
  });

  it("rejects a disabled delivery method", () => {
    expect(() => calculateStorefrontTotals(100_000, "COURIER", { ...rules, deliveryEnabled: false })).toThrow();
  });
});
