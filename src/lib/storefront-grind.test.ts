import { describe, expect, it } from "vitest";
import {
  aggregateStorefrontStock,
  buildOfferingSnapshot,
  isOfferingLineId,
  normalizeStorefrontGrind,
  offeringLineId,
  offeringReserveKg,
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

describe("coffee offering line ids", () => {
  it("namespaces offering lines so they never collide with product lines", () => {
    const offering = offeringLineId("off-1", "var-1", "WHOLE_BEAN", "FINE");
    const product = storefrontLineId("off-1", "WHOLE_BEAN", "FINE");
    const wholeBean = offeringLineId("off-1", "var-1", "WHOLE_BEAN", null);

    expect(offering).not.toBe(product);
    expect(offering).not.toBe(wholeBean);
    expect(isOfferingLineId(offering)).toBe(true);
    expect(isOfferingLineId(product)).toBe(false);
    expect(isOfferingLineId("")).toBe(false);
  });
});

describe("buildOfferingSnapshot", () => {
  it("normalizes a null roast level into the snapshot", () => {
    expect(buildOfferingSnapshot({
      offeringId: "off-1",
      offeringName: "Kopi Aceh Gayo",
      packageName: "250g Bungkus",
      netWeightGrams: 250,
      roastLevel: null,
    })).toEqual({
      offeringId: "off-1",
      offeringName: "Kopi Aceh Gayo",
      packageName: "250g Bungkus",
      netWeightGrams: 250,
      roastLevel: null,
    });
  });
});

describe("offeringReserveKg", () => {
  it("converts package count and net weight to an exact kg reserve", () => {
    expect(offeringReserveKg(3, 250)).toEqual({ quantityKg: 0.75, units: 1 });
    expect(offeringReserveKg(5, 250)).toEqual({ quantityKg: 1.25, units: 2 });
    expect(offeringReserveKg(1, 1000)).toEqual({ quantityKg: 1, units: 1 });
  });

  it("keeps 3 decimals of precision for fractional weights", () => {
    expect(offeringReserveKg(1, 333)).toEqual({ quantityKg: 0.333, units: 1 });
    expect(offeringReserveKg(2, 333)).toEqual({ quantityKg: 0.666, units: 1 });
  });
});
