import { describe, expect, it } from "vitest";
import {
  aggregateStorefrontStock,
  normalizeStorefrontGrind,
  storefrontLineId,
} from "./storefront-grind";

describe("storefront grind selection", () => {
  it("keeps different preparations as separate cart lines but one stock demand", () => {
    const wholeBean = storefrontLineId("espresso-a-1kg", "WHOLE_BEAN", null);
    const espresso = storefrontLineId("espresso-a-1kg", "ESPRESSO", null);

    expect(wholeBean).not.toBe(espresso);
    expect(aggregateStorefrontStock([
      { productId: "espresso-a-1kg", quantity: 1 },
      { productId: "espresso-a-1kg", quantity: 2 },
    ])).toEqual([{ productId: "espresso-a-1kg", quantity: 3 }]);
  });

  it("accepts only a configured preparation and requires a custom label", () => {
    expect(normalizeStorefrontGrind("ESPRESSO", undefined, ["WHOLE_BEAN", "ESPRESSO"]))
      .toEqual({ grindSize: "ESPRESSO", customGrindLabel: null });
    expect(() => normalizeStorefrontGrind("FINE", undefined, ["WHOLE_BEAN", "ESPRESSO"]))
      .toThrow("Pilihan gilingan tidak tersedia");
    expect(() => normalizeStorefrontGrind("CUSTOM", " ", ["CUSTOM"]))
      .toThrow("Catatan gilingan custom wajib diisi");
  });
});
