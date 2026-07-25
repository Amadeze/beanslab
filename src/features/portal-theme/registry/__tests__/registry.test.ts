// =============================================================================
// REGISTRY TESTS — All sections have required fields
// =============================================================================

import { describe, it, expect } from "vitest";
import { SECTION_REGISTRY, getSectionDefinition, isValidSectionType } from "../";

describe("SECTION_REGISTRY", () => {
  it("has at least 15 section types", () => {
    expect(SECTION_REGISTRY.length).toBeGreaterThanOrEqual(15);
  });

  it("every section has required fields", () => {
    for (const section of SECTION_REGISTRY) {
      expect(section.type).toBeTruthy();
      expect(section.label).toBeTruthy();
      expect(section.description).toBeTruthy();
      expect(section.icon).toBeTruthy();
      expect(section.category).toBeTruthy();
      expect(section.defaultSettings).toBeDefined();
    }
  });

  it("every section type is unique", () => {
    const types = SECTION_REGISTRY.map((s) => s.type);
    expect(new Set(types).size).toBe(types.length);
  });

  it("every section has a valid category", () => {
    const validCategories = ["content", "commerce", "marketing", "layout"];
    for (const section of SECTION_REGISTRY) {
      expect(validCategories).toContain(section.category);
    }
  });
});

describe("getSectionDefinition", () => {
  it("returns definition for valid type", () => {
    const def = getSectionDefinition("hero_banner");
    expect(def).toBeDefined();
    expect(def?.label).toBe("Hero Banner");
  });

  it("returns undefined for unknown type", () => {
    const def = getSectionDefinition("nonexistent");
    expect(def).toBeUndefined();
  });
});

describe("isValidSectionType", () => {
  it("returns true for valid types", () => {
    expect(isValidSectionType("hero_banner")).toBe(true);
    expect(isValidSectionType("faq")).toBe(true);
  });

  it("returns false for invalid types", () => {
    expect(isValidSectionType("invalid")).toBe(false);
  });
});
