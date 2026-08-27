// =============================================================================
// SCHEMA SECURITY TESTS — font charset, easing grammar, deprecated fields
// =============================================================================

import { describe, it, expect } from "vitest";
import {
  PortalThemeConfigSchema,
  TypographySchema,
  AnimationSchema,
  GlobalSettingsSchema,
  safeHtml,
} from "../index";
import { DEFAULT_PORTAL_THEME_CONFIG } from "../../defaults/default-config";

describe("TypographySchema — font charset allowlist", () => {
  const validFonts = [
    "Inter",
    "Plus Jakarta Sans",
    "DM Serif Display",
    "Oswald",
    "Space Grotesk 2",
    "Font-Name_X",
  ];

  for (const font of validFonts) {
    it(`accepts font: ${font}`, () => {
      const result = TypographySchema.safeParse({
        headingFont: font,
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
  }

  const invalidFonts = [
    "</style><script>alert(1)</script>",
    "Inter\" onload=alert(1)",
    "Inter\\3c /style\\3e",
    "Font{color:red}",
    "Font(1)",
    "Font,",
    "Font;",
    "font/",
    "font`",
    "font@",
    "font#",
    "font$",
    "font%",
    "font^",
    "font&",
    "font*",
    "font+",
    "font=",
    "font[",
    "font]",
    "font|",
    "font~",
    "font?",
    "font:",
    "font!",
    "font\\",
    "a".repeat(61),
  ];

  for (const font of invalidFonts) {
    it(`rejects font: ${JSON.stringify(font)}`, () => {
      const result = TypographySchema.safeParse({
        headingFont: font,
        bodyFont: "Inter",
        baseFontSize: 16,
        scaleRatio: 1.25,
        lineHeight: 1.6,
        letterSpacing: 0,
        headingWeight: 700,
        bodyWeight: 400,
        textTransform: "none",
      });
      expect(result.success).toBe(false);
    });
  }
});

describe("AnimationSchema — easing grammar", () => {
  const validEasings = [
    "linear",
    "ease-in-out",
    "cubic-bezier(0.22, 1, 0.36, 1)",
    "cubic-bezier(0.34, 1.56, 0.64, 1)",
    "steps(4, end)",
    "steps(2)",
  ];

  for (const easing of validEasings) {
    it(`accepts easing: ${easing}`, () => {
      const result = AnimationSchema.safeParse({
        scrollTrigger: "fade-in",
        duration: 500,
        delay: 0,
        easing,
        hoverEffect: "scale",
      });
      expect(result.success).toBe(true);
    });
  }

  const invalidEasings = [
    "cubic-bezier(1.5, 1, 0.36, 1)",
    "cubic-bezier(0.22, 1, 0.36)",
    "cubic-bezier(0.22, 1, 0.36, 1) extra",
    "1e5",
    "NaN",
    "Infinity",
    "steps(0)",
    "steps(4, middle)",
  ];

  for (const easing of invalidEasings) {
    it(`rejects easing: ${easing}`, () => {
      const result = AnimationSchema.safeParse({
        scrollTrigger: "fade-in",
        duration: 500,
        delay: 0,
        easing,
        hoverEffect: "scale",
      });
      expect(result.success).toBe(false);
    });
  }
});

describe("GlobalSettingsSchema — deprecated customHead/customFooter", () => {
  it("accepts empty legacy values (backward compatible)", () => {
    const config = structuredClone(DEFAULT_PORTAL_THEME_CONFIG);
    config.globalSettings.integrations = {
      customHead: "",
      customFooter: "",
    };
    const result = GlobalSettingsSchema.safeParse(config.globalSettings);
    expect(result.success).toBe(true);
  });

  it("passes non-empty values through the schema (rejection is enforced in the save action against stored data)", () => {
    const config = structuredClone(DEFAULT_PORTAL_THEME_CONFIG);
    config.globalSettings.integrations = {
      customHead: "<script>alert(1)</script>",
      customFooter: "<script>alert(1)</script>",
    };
    const result = GlobalSettingsSchema.safeParse(config.globalSettings);
    expect(result.success).toBe(true);
  });

  it("accepts the full default config", () => {
    const result = PortalThemeConfigSchema.safeParse(DEFAULT_PORTAL_THEME_CONFIG);
    expect(result.success).toBe(true);
  });

  it("rejects a stored-style payload with an evil font via the full config schema", () => {
    const config = structuredClone(DEFAULT_PORTAL_THEME_CONFIG);
    config.globalSettings.typography.headingFont = "</style><script>alert(1)</script>";
    const result = PortalThemeConfigSchema.safeParse(config);
    expect(result.success).toBe(false);
  });
});

describe("safeHtml — general validator regression guard", () => {
  it("still rejects script, iframe and javascript: tokens (never weakened)", () => {
    const evilPayloads = [
      "<script>alert(1)</script>",
      "<script src=//evil.example/x.js>",
      "<iframe srcdoc=...></iframe>",
      "<a href=javascript:alert(1)>x</a>",
      "</script><script>alert(1)</script>",
      "javascript:alert(1)",
      "<script",
    ];
    for (const payload of evilPayloads) {
      const result = safeHtml.safeParse(payload);
      expect(result.success).toBe(false);
    }
  });

  it("still accepts benign content", () => {
    expect(safeHtml.safeParse("").success).toBe(true);
    expect(safeHtml.safeParse("<div class=hero>Hello</div>").success).toBe(true);
    expect(safeHtml.safeParse("<meta name=description content=x>").success).toBe(true);
  });

  it("still enforces the 5000 char cap", () => {
    expect(safeHtml.safeParse("a".repeat(5001)).success).toBe(false);
  });
});

describe("schema refactor — only customHead/customFooter are permissive", () => {
  it("caps non-deprecated integration fields as before (googleAnalyticsId/metaPixelId max 30)", () => {
    const config = structuredClone(DEFAULT_PORTAL_THEME_CONFIG);
    config.globalSettings.integrations = {
      googleAnalyticsId: "G-" + "x".repeat(28),
      metaPixelId: "p".repeat(31),
    };
    const result = GlobalSettingsSchema.safeParse(config.globalSettings);
    expect(result.success).toBe(false);
  });

  it("deprecated fields still enforce the 5000 char cap", () => {
    const config = structuredClone(DEFAULT_PORTAL_THEME_CONFIG);
    config.globalSettings.integrations = {
      customHead: "a".repeat(5001),
    };
    const result = GlobalSettingsSchema.safeParse(config.globalSettings);
    expect(result.success).toBe(false);
  });

  it("the only GlobalSettingsSchema fields that carry arbitrary HTML are customHead/customFooter", () => {
    const integrations = GlobalSettingsSchema.shape.integrations.shape;
    const keys = Object.keys(integrations);
    expect(keys.sort()).toEqual(["customFooter", "customHead", "googleAnalyticsId", "metaPixelId"]);
    const payload = "<script>alert(1)</script><script>"; // 33 chars: > max(30), < max(5000)
    const fields = integrations as Record<string, import("zod").ZodTypeAny>;
    for (const key of keys) {
      const acceptsRawHtml = fields[key].safeParse(payload).success;
      if (key === "customHead" || key === "customFooter") {
        expect(acceptsRawHtml).toBe(true);
      } else {
        expect(acceptsRawHtml).toBe(false);
      }
    }
  });
});
