// =============================================================================
// RESOLVER SECURITY TESTS — read-time hardening of stored theme configs
// =============================================================================

import { describe, it, expect } from "vitest";
import { resolveTenantPortalTheme } from "../resolver";
import { DEFAULT_PORTAL_THEME_CONFIG } from "../defaults/default-config";

function evilConfig() {
  const config = structuredClone(DEFAULT_PORTAL_THEME_CONFIG);
  config.globalSettings.typography.headingFont = "</style><script>alert(1)</script>";
  config.globalSettings.typography.bodyFont = "Inter\" onload=alert(1)";
  config.globalSettings.animations.globalEasing = "cubic-bezier(1.5, 1, 0.36, 1)";
  config.globalSettings.integrations = {
    customHead: "<script>alert(1)</script>",
    customFooter: '<iframe src="https://evil.example"></iframe>',
  };
  config.sections[0].customCSS = {
    css: "color: red; width: 100vw; </style><script>alert(1)</script>",
  };
  return config;
}

describe("resolveTenantPortalTheme — public mode (storefront)", () => {
  it("neutralizes legacy evil payloads at read time", () => {
    const evil = evilConfig();
    const resolved = resolveTenantPortalTheme({
      portalTheme: { draftConfig: evil, publishedConfig: evil },
      legacyTenantFields: {},
      mode: "public",
    });

    expect(resolved.globalSettings.typography.headingFont).toBe("DM Sans");
    expect(resolved.globalSettings.typography.bodyFont).toBe("DM Sans");
    expect(resolved.globalSettings.animations.globalEasing).toBe(
      "cubic-bezier(0.22, 1, 0.36, 1)",
    );
    expect(resolved.globalSettings.integrations.customHead).toBeUndefined();
    expect(resolved.globalSettings.integrations.customFooter).toBeUndefined();
    expect(resolved.sections[0].customCSS).toBeUndefined();
  });

  it("keeps valid fonts, easing, and custom CSS while normalizing them", () => {
    const config = structuredClone(DEFAULT_PORTAL_THEME_CONFIG);
    config.globalSettings.typography.headingFont = "Plus Jakarta Sans";
    config.globalSettings.animations.globalEasing = "cubic-bezier(0.34, 1.56, 0.64, 1)";
    config.sections[0].customCSS = { css: "color: red;   padding: 8px" };

    const resolved = resolveTenantPortalTheme({
      portalTheme: { draftConfig: config, publishedConfig: config },
      legacyTenantFields: {},
      mode: "public",
    });

    expect(resolved.globalSettings.typography.headingFont).toBe("Plus Jakarta Sans");
    expect(resolved.globalSettings.animations.globalEasing).toBe(
      "cubic-bezier(0.34, 1.56, 0.64, 1)",
    );
    expect(resolved.sections[0].customCSS?.css).toBe("color:red;padding:8px");
  });
});

describe("resolveTenantPortalTheme — customizer mode", () => {
  it("keeps customHead/customFooter so saves round-trip without data loss", () => {
    const evil = evilConfig();
    const resolved = resolveTenantPortalTheme({
      portalTheme: { draftConfig: evil, publishedConfig: null },
      legacyTenantFields: {},
      mode: "customizer",
    });

    expect(resolved.globalSettings.integrations.customHead).toBe(
      "<script>alert(1)</script>",
    );
    expect(resolved.globalSettings.integrations.customFooter).toBe(
      '<iframe src="https://evil.example"></iframe>',
    );
    // but custom CSS is still neutralized for the preview renderer
    expect(resolved.sections[0].customCSS).toBeUndefined();
  });

  it("still sanitizes fonts and easing for the preview renderer", () => {
    const evil = evilConfig();
    const resolved = resolveTenantPortalTheme({
      portalTheme: { draftConfig: evil, publishedConfig: null },
      legacyTenantFields: {},
      mode: "customizer",
    });

    expect(resolved.globalSettings.typography.headingFont).toBe("DM Sans");
    expect(resolved.globalSettings.animations.globalEasing).toBe(
      "cubic-bezier(0.22, 1, 0.36, 1)",
    );
  });
});

describe("resolveTenantPortalTheme — fallbacks", () => {
  it("falls back to the system default when no config exists", () => {
    const resolved = resolveTenantPortalTheme({
      portalTheme: null,
      legacyTenantFields: {},
      mode: "public",
    });
    expect(resolved.globalSettings.typography.headingFont).toBeTruthy();
    expect(Array.isArray(resolved.sections)).toBe(true);
  });

  it("does not crash on non-object config values", () => {
    const resolved = resolveTenantPortalTheme({
      portalTheme: {
        draftConfig: "not-an-object",
        publishedConfig: 42,
      },
      legacyTenantFields: {},
      mode: "public",
    });
    expect(resolved.globalSettings.typography.headingFont).toBeTruthy();
  });
});
