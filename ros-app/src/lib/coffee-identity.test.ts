import { describe, expect, it } from "vitest";

import {
  coffeeSourceCreateDataFromProduct,
  normalizeCoffeeIdentity,
} from "./coffee-identity";

describe("normalizeCoffeeIdentity", () => {
  it("trims and nullifies empty strings", () => {
    const result = normalizeCoffeeIdentity({
      name: "  Gayo Fully Washed  ",
      country: "",
      region: "  ",
      varietal: "  Gayo 1 ",
    });
    expect(result.name).toBe("Gayo Fully Washed");
    expect(result.country).toBeNull();
    expect(result.region).toBeNull();
    expect(result.varietal).toBe("Gayo 1");
  });

  it("preserves distinct processing methods as separate identities", () => {
    const washed = normalizeCoffeeIdentity({ name: "Gayo Fully Washed", processMethod: "washed" });
    const anaerobic = normalizeCoffeeIdentity({ name: "Gayo Anaerobic Natural", processMethod: "anaerobic natural" });
    expect(washed.processMethod).toBe("washed");
    expect(anaerobic.processMethod).toBe("anaerobic natural");
    expect(washed.name).not.toBe(anaerobic.name);
  });

  it("deduplicates certifications case-insensitively and drops empties", () => {
    const result = normalizeCoffeeIdentity({
      name: "Toraja",
      certifications: ["Fair Trade", " fair trade ", "", "  "],
    });
    expect(result.certifications).toEqual(["Fair Trade"]);
  });

  it("caps overlong fields instead of failing", () => {
    const result = normalizeCoffeeIdentity({ name: "x".repeat(500), tastingNotes: "y".repeat(2000) });
    expect(result.name).toHaveLength(200);
    expect(result.tastingNotes).toHaveLength(1000);
  });
});

describe("coffeeSourceCreateDataFromProduct", () => {
  it("maps a green bean product deterministically without name inference", () => {
    const data = coffeeSourceCreateDataFromProduct({
      code: "GB-GAYO-001",
      name: "Gayo Fully Washed",
      coffeeSpecies: "ARABICA",
      origin: "Gayo, Aceh Tengah",
    });
    expect(data.code).toBe("GB-GAYO-001");
    expect(data.name).toBe("Gayo Fully Washed");
    expect(data.species).toBe("ARABICA");
    expect(data.region).toBe("Gayo, Aceh Tengah");
    // Identity fields that were never captured stay null — no inference.
    expect(data.country).toBeNull();
    expect(data.processMethod).toBeNull();
    expect(data.varietal).toBeNull();
    expect(data.farm).toBeNull();
  });

  it("keeps code 1:1 with the product code so linking stays exact", () => {
    const first = coffeeSourceCreateDataFromProduct({ code: "GB-A", name: "A" });
    const second = coffeeSourceCreateDataFromProduct({ code: "GB-B", name: "A" });
    expect(first.code).toBe("GB-A");
    expect(second.code).toBe("GB-B");
    expect(first.code).not.toBe(second.code);
  });
});