// =============================================================================
// SCHEMA TESTS — Validation of theme config schemas
// =============================================================================

import { describe, it, expect } from "vitest";
import {
  PortalThemeConfigSchema,
  ColorTokensSchema,
  SectionSchema,
  TypographySchema,
} from "../";
import { DEFAULT_PORTAL_THEME_CONFIG } from "../../defaults/default-config";

describe("ColorTokensSchema", () => {
  it("accepts valid hex colors", () => {
    const result = ColorTokensSchema.safeParse({
      primary: "#FF5733",
      secondary: "#426C7A",
      accent: "#D4A574",
      background: "#FAFAF8",
      surface: "#FFFFFF",
      surfaceAlt: "#F5F3EF",
      text: "#1A1A1A",
      textMuted: "#6B7280",
      textInverse: "#FFFFFF",
      border: "#E5E5E5",
      borderSubtle: "#F0F0F0",
      error: "#DC2626",
      success: "#16A34A",
      warning: "#D97706",
      info: "#2563EB",
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid hex colors", () => {
    const result = ColorTokensSchema.safeParse({
      primary: "not-a-color",
    });
    expect(result.success).toBe(false);
  });
});

describe("TypographySchema", () => {
  it("accepts valid typography config", () => {
    const result = TypographySchema.safeParse({
      headingFont: "Inter",
      bodyFont: "Inter",
      baseFontSize: 16,
      scaleRatio: 1.25,
      lineHeight: 1.6,
      letterSpacing: 0,
      headingWeight: 700,
      bodyWeight: 400,
      textTransform: "none",
    });
    expect(result.success).toBe(true);
  });

  it("rejects font size out of range", () => {
    const result = TypographySchema.safeParse({
      headingFont: "Inter",
      bodyFont: "Inter",
      baseFontSize: 5, // too small
      scaleRatio: 1.25,
      lineHeight: 1.6,
      letterSpacing: 0,
      headingWeight: 700,
      bodyWeight: 400,
      textTransform: "none",
    });
    expect(result.success).toBe(false);
  });
});

describe("SectionSchema", () => {
  it("accepts a valid hero_banner section", () => {
    const result = SectionSchema.safeParse({
      id: "sec_test",
      type: "hero_banner",
      enabled: true,
      settings: { title: "Hello" },
      blocks: [],
    });
    expect(result.success).toBe(true);
  });

  it("rejects section with too many blocks", () => {
    const blocks = Array.from({ length: 51 }, (_, i) => ({
      id: `blk_${i}`,
      type: "item",
      settings: {},
      visible: true,
    }));
    const result = SectionSchema.safeParse({
      id: "sec_test",
      type: "hero_banner",
      enabled: true,
      settings: {},
      blocks,
    });
    expect(result.success).toBe(false);
  });
});

describe("PortalThemeConfigSchema", () => {
  it("accepts the default config", () => {
    const result = PortalThemeConfigSchema.safeParse(DEFAULT_PORTAL_THEME_CONFIG);
    expect(result.success).toBe(true);
  });

  it("rejects config with schemaVersion 0", () => {
    const config = { ...DEFAULT_PORTAL_THEME_CONFIG, schemaVersion: 0 };
    const result = PortalThemeConfigSchema.safeParse(config);
    expect(result.success).toBe(false);
  });

  it("rejects config with more than 20 sections", () => {
    const sections = Array.from({ length: 21 }, (_, i) => ({
      id: `sec_${i}`,
      type: "rich_text",
      enabled: true,
      settings: {},
      blocks: [],
    }));
    const config = { ...DEFAULT_PORTAL_THEME_CONFIG, sections };
    const result = PortalThemeConfigSchema.safeParse(config);
    expect(result.success).toBe(false);
  });
});
