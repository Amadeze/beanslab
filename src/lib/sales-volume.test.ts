import { describe, expect, it } from "vitest";
import { netSoldKg } from "./sales-volume";

describe("netSoldKg", () => {
  it("menghitung kg terjual = (SALE_OUT − RETURN_IN) × gram per unit", () => {
    const result = netSoldKg([
      { entryType: "OUT", quantityUnit: 10, outputGrams: 200 },
      { entryType: "OUT", quantityUnit: 5, outputGrams: 1000 },
      { entryType: "IN", quantityUnit: 2, outputGrams: 200 }, // retur
    ]);
    expect(result.kg).toBe(10 * 0.2 - 2 * 0.2 + 5 * 1);
  });

  it("produk tanpa resep tetap dihitung unitnya (unitsWithoutWeight)", () => {
    const result = netSoldKg([
      { entryType: "OUT", quantityUnit: 7, outputGrams: null },
      { entryType: "OUT", quantityUnit: 3, outputGrams: 0 },
    ]);
    expect(result.kg).toBe(0);
    expect(result.unitsWithoutWeight).toBe(10);
  });

  it("campuran produk ber-resep dan tanpa resep", () => {
    const result = netSoldKg([
      { entryType: "OUT", quantityUnit: 4, outputGrams: 250 },
      { entryType: "OUT", quantityUnit: 2, outputGrams: null },
    ]);
    expect(result.kg).toBe(1);
    expect(result.unitsWithoutWeight).toBe(2);
  });

  it("entri kosong → nol", () => {
    expect(netSoldKg([])).toEqual({ kg: 0, unitsWithoutWeight: 0 });
  });
});
