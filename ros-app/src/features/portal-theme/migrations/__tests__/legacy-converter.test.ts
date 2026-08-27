// =============================================================================
// LEGACY CONVERTER TESTS
// =============================================================================

import { describe, it, expect } from "vitest";
import { convertLegacyTenantToThemeConfig } from "../legacy-converter";

describe("convertLegacyTenantToThemeConfig", () => {
  it("converts themeColor to primary color", () => {
    const result = convertLegacyTenantToThemeConfig({ themeColor: "blue" });
    expect(result.globalSettings.colors.primary).toBe("#426C7A");
  });

  it("converts fontFamily to typography", () => {
    const result = convertLegacyTenantToThemeConfig({ fontFamily: "serif" });
    expect(result.globalSettings.typography.headingFont).toBe("Playfair Display");
    expect(result.globalSettings.typography.bodyFont).toBe("Playfair Display");
  });

  it("converts heroText to hero_banner section", () => {
    const result = convertLegacyTenantToThemeConfig({ heroText: "Welcome" });
    const hero = result.sections.find((s) => s.type === "hero_banner");
    expect(hero?.settings.title).toBe("Welcome");
  });

  it("converts features to benefits section", () => {
    const result = convertLegacyTenantToThemeConfig({
      features: [
        { title: "Fast Shipping", desc: "Quick delivery", iconName: "Truck" },
        { title: "Quality", desc: "Premium beans", iconName: "Star" },
      ],
    });
    const benefits = result.sections.find((s) => s.type === "benefits");
    expect(benefits).toBeDefined();
    expect(benefits?.blocks.length).toBe(2);
    expect(benefits?.blocks[0].settings.title).toBe("Fast Shipping");
  });

  it("converts testimonials to testimonials section", () => {
    const result = convertLegacyTenantToThemeConfig({
      testimonials: [{ name: "John", text: "Great coffee!", rating: 5 }],
    });
    const testimonials = result.sections.find((s) => s.type === "testimonials");
    expect(testimonials).toBeDefined();
    expect(testimonials?.blocks.length).toBe(1);
  });

  it("converts faqs to faq section", () => {
    const result = convertLegacyTenantToThemeConfig({
      faqs: [{ question: "How to order?", answer: "Just call us" }],
    });
    const faq = result.sections.find((s) => s.type === "faq");
    expect(faq).toBeDefined();
    expect(faq?.blocks.length).toBe(1);
  });

  it("converts dark mode", () => {
    const result = convertLegacyTenantToThemeConfig({ themeMode: "dark" });
    expect(result.globalSettings.activeVariant).toBe("dark");
  });

  it("handles empty tenant gracefully", () => {
    const result = convertLegacyTenantToThemeConfig({});
    expect(result.sections.length).toBeGreaterThan(0);
    expect(result.globalSettings.colors.primary).toBeDefined();
  });
});
