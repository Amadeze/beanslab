// =============================================================================
// RENDER INTEGRATION TESTS — resolve → sanitize → render (no database)
//
// Every case builds a theme config with dangerous and/or valid CSS payloads,
// passes it through the read-time resolver, renders the storefront renderer
// with react-dom/server, and asserts on the resulting markup. When
// RENDER_FIXTURES_OUT is set, each case is also written to disk so the
// Playwright browser test (scripts/portal-render-browser-test.mjs) can assert
// on real computed styles without a database or an app server.
// =============================================================================

import { describe, it, expect, afterAll } from "vitest";
import { writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { resolveTenantPortalTheme } from "../resolver";
import type { PortalThemeConfig } from "../types";
import { PortalThemeRenderer } from "../components/PortalThemeRenderer";

// ── Fixture config ──────────────────────────────────────────────────────────

const COLORS = {
  primary: "#0f172a",
  secondary: "#64748b",
  accent: "#d97706",
  background: "#ffffff",
  surface: "#f8fafc",
  surfaceAlt: "#f1f5f9",
  text: "#1e293b",
  textMuted: "#64748b",
  textInverse: "#ffffff",
  border: "#e2e8f0",
  borderSubtle: "#f1f5f9",
  error: "#dc2626",
  success: "#16a34a",
  warning: "#d97706",
  info: "#2563eb",
};

function buildConfig(opts: {
  customCSS?: string;
  headingFont?: string;
  bodyFont?: string;
  globalEasing?: string;
  customHead?: string;
  customFooter?: string;
  withSpacing?: boolean;
}): PortalThemeConfig {
  const config = {
    schemaVersion: 1,
    themeKey: "render-test",
    globalSettings: {
      colors: { ...COLORS },
      typography: {
        headingFont: opts.headingFont ?? "Inter",
        bodyFont: opts.bodyFont ?? "Inter",
        baseFontSize: 16,
        scaleRatio: 1.25,
        lineHeight: 1.6,
        letterSpacing: 0,
        headingWeight: 700,
        bodyWeight: 400,
        textTransform: "none",
      },
      layout: { contentWidth: 1200, sectionGap: 48, pagePadding: 24, borderRadius: 12 },
      variants: [{ id: "v1", name: "default", isDefault: true, autoSwitch: false, colors: {} }],
      activeVariant: "v1",
      brandKit: { brandColors: [] },
      animations: {
        globalDuration: 600,
        globalEasing: opts.globalEasing ?? "cubic-bezier(0.22, 1, 0.36, 1)",
        scrollAnimations: false,
        hoverEffects: true,
        reduceMotion: false,
      },
      seo: { lazyLoadImages: false, preloadCritical: false, structuredData: false },
      integrations: {
        googleAnalyticsId: undefined,
        metaPixelId: undefined,
        customHead: opts.customHead ?? "",
        customFooter: opts.customFooter ?? "",
      },
    },
    sections: [
      {
        id: "hero-section",
        type: "hero_banner",
        enabled: true,
        settings: {},
        blocks: [],
        spacing: opts.withSpacing !== false
          ? { paddingTop: 40, paddingRight: 20, paddingBottom: 40, paddingLeft: 20, marginTop: 0, marginBottom: 0 }
          : undefined,
        background: { type: "color", color: "#123456", opacity: 100 },
        decoration: { borderRadius: 8, borderWidth: 1, borderColor: "#dddddd", borderStyle: "solid", shadow: "none" },
        visibility: { desktop: true, tablet: true, mobile: true },
        animation: { scrollTrigger: "none", duration: 0, delay: 0, easing: "linear", hoverEffect: "none" },
        layout: { width: "normal", alignment: "center", columns: 1, columnGap: 24, verticalAlign: "center" },
        customCSS: opts.customCSS ? { css: opts.customCSS } : undefined,
      },
    ],
  } as PortalThemeConfig;
  return config;
}

interface Case {
  name: string;
  config: PortalThemeConfig;
  htmlAssertions: (html: string) => void;
}

function ssrHtml(config: PortalThemeConfig): string {
  const resolved = resolveTenantPortalTheme({
    portalTheme: { draftConfig: structuredClone(config), publishedConfig: structuredClone(config) },
    legacyTenantFields: {},
    mode: "public",
  });
  return renderToStaticMarkup(
    createElement(PortalThemeRenderer, { config: resolved, isPreview: false }),
  );
}

const NO_EXECUTABLE_MARKUP = (html: string) => {
  expect(html).not.toMatch(/<script/i);
  expect(html).not.toMatch(/javascript:/i);
  expect(html).not.toMatch(/\son\w+\s*=/i);
  expect(html).not.toMatch(/url\s*\(/i);
};

const cases: Case[] = [
  {
    name: "valid-styles",
    config: buildConfig({
      customCSS:
        "color: #ff0000; background-image: linear-gradient(180deg, #ff0000, #0000ff); " +
        "box-shadow: 0 4px 8px rgba(0,0,0,0.2); transform: rotate(2deg); filter: blur(0.5px); " +
        "transition: transform 0.3s ease; grid-template-columns: repeat(2, 1fr); display: flex; gap: 8px;",
    }),
    htmlAssertions: (html) => {
      expect(html).toMatch(/color:#ff0000/);
      expect(html).toMatch(/background-image:linear-gradient\(180deg,#ff0000,#0000ff\)/);
      expect(html).toMatch(/box-shadow:0 4px 8px rgba\(0,0,0,0\.2\)/);
      expect(html).toMatch(/grid-template-columns:repeat\(2,1fr\)/);
      expect(html).toMatch(/transition:/);
      NO_EXECUTABLE_MARKUP(html);
    },
  },
  {
    name: "builtin-precedence",
    config: buildConfig({ customCSS: "padding-top: 10px; background-color: #ff0000" }),
    htmlAssertions: (html) => {
      expect(html).toMatch(/padding-top:40px/);
      expect(html).toMatch(/background-color:#123456/);
      NO_EXECUTABLE_MARKUP(html);
    },
  },
  {
    name: "duplicate-last-wins",
    config: buildConfig({ customCSS: "color: red; color: blue" }),
    htmlAssertions: (html) => {
      expect(html).toMatch(/color:red;color:blue/);
      NO_EXECUTABLE_MARKUP(html);
    },
  },
  {
    name: "important-rejected",
    config: buildConfig({ customCSS: "color: red !important; padding-top: 8px" }),
    htmlAssertions: (html) => {
      expect(html).not.toMatch(/!important/);
      expect(html).not.toMatch(/padding-top:8px/);
      expect(html).toMatch(/padding-top:40px/);
      NO_EXECUTABLE_MARKUP(html);
    },
  },
  {
    name: "vendor-prefixed-rejected",
    config: buildConfig({ customCSS: "-webkit-transform: rotate(1deg)" }),
    htmlAssertions: (html) => {
      expect(html).not.toMatch(/webkit-transform/);
      expect(html).not.toMatch(/rotate\(1deg\)/);
      NO_EXECUTABLE_MARKUP(html);
    },
  },
  {
    name: "malformed-does-not-crash",
    config: buildConfig({
      customCSS: "color: ; width: 100vw; @import url(https://evil.example/x.css); .a { color: red }",
    }),
    htmlAssertions: (html) => {
      expect(html).toMatch(/hero-section/);
      expect(html).toMatch(/padding-top:40px/);
      expect(html).not.toMatch(/100vw/);
      NO_EXECUTABLE_MARKUP(html);
    },
  },
  {
    name: "breakout-xss",
    config: buildConfig({
      customCSS: "color: red; </style><script>alert(1)</script>",
      headingFont: "</style><script>alert(1)</script>",
      bodyFont: "Inter\" onload=alert(1)",
      globalEasing: "cubic-bezier(1.5, 1, 0.36, 1)",
      customHead: "<script>alert(1)</script>",
      customFooter: '<img src=x onerror=alert(1)>',
    }),
    htmlAssertions: (html) => {
      expect(html).not.toMatch(/alert\(1\)/);
      expect(html).toMatch(/padding-top:40px/);
      NO_EXECUTABLE_MARKUP(html);
    },
  },
  {
    name: "entity-encoded",
    config: buildConfig({ customCSS: "color: &lt;script&gt;alert(1)&lt;/script&gt;" }),
    htmlAssertions: (html) => {
      expect(html).toMatch(/hero-section/);
      expect(html).not.toMatch(/alert\(1\)/);
      NO_EXECUTABLE_MARKUP(html);
    },
  },
  {
    name: "url-javascript",
    config: buildConfig({ customCSS: "background: url(javascript:alert(1))" }),
    htmlAssertions: (html) => {
      expect(html).not.toMatch(/javascript:/);
      NO_EXECUTABLE_MARKUP(html);
    },
  },
  {
    name: "data-url-html",
    config: buildConfig({ customCSS: "background-image: url(data:text/html,<script>alert(1)</script>)" }),
    htmlAssertions: (html) => {
      expect(html).not.toMatch(/data:text\/html/);
      NO_EXECUTABLE_MARKUP(html);
    },
  },
  {
    name: "thousands-of-tokens",
    config: buildConfig({
      customCSS:
        "color: red; " +
        Array.from({ length: 60 }, (_, i) => `padding-left: ${i + 1}px`).join("; ") +
        "; " +
        "box-shadow: 0 0 0 1px #000".repeat(400),
    }),
    htmlAssertions: (html) => {
      expect(html).not.toMatch(/padding-left:60px/);
      expect(html).toMatch(/padding-top:40px/);
      NO_EXECUTABLE_MARKUP(html);
    },
  },
  {
    name: "global-keyframe-reference",
    config: buildConfig({ customCSS: "animation: spin 2s linear infinite" }),
    htmlAssertions: (html) => {
      expect(html).toMatch(/animation:/);
      NO_EXECUTABLE_MARKUP(html);
    },
  },
  {
    name: "valid-font-and-easing",
    config: buildConfig({
      headingFont: "Plus Jakarta Sans",
      bodyFont: "Space Grotesk",
      globalEasing: "cubic-bezier(0.34, 1.56, 0.64, 1)",
    }),
    htmlAssertions: (html) => {
      expect(html).toMatch(/Plus Jakarta Sans/);
      expect(html).toMatch(/Space Grotesk/);
      expect(html).toMatch(/cubic-bezier\(0\.34, 1\.56, 0\.64, 1\)/);
      NO_EXECUTABLE_MARKUP(html);
    },
  },
  {
    name: "hide-section-styles",
    config: buildConfig({ customCSS: "display: none; opacity: 0; height: 0" }),
    htmlAssertions: (html) => {
      expect(html).toMatch(/display:none/);
      expect(html).toMatch(/opacity:0/);
      NO_EXECUTABLE_MARKUP(html);
    },
  },
];

describe("PortalThemeRenderer — resolve → render (SSR, no database)", () => {
  for (const c of cases) {
    it(`renders case "${c.name}" without executable markup and without crashing`, () => {
      const html = ssrHtml(c.config);
      c.htmlAssertions(html);
    });
  }

  it("customHead/customFooter are never rendered in public mode", () => {
    const html = ssrHtml(
      buildConfig({
        customHead: "<script>alert(1)</script>",
        customFooter: '<iframe src="https://evil.example"></iframe>',
      }),
    );
    expect(html).not.toMatch(/alert\(1\)/);
    expect(html).not.toMatch(/evil\.example/);
    expect(html).not.toMatch(/<iframe/i);
    NO_EXECUTABLE_MARKUP(html);
  });

  it("renders the default theme without crashing", () => {
    const html = renderToStaticMarkup(
      createElement(PortalThemeRenderer, {
        config: resolveTenantPortalTheme({
          portalTheme: null,
          legacyTenantFields: {},
          mode: "public",
        }),
      }),
    );
    expect(html.length).toBeGreaterThan(0);
    expect(html).not.toMatch(/<script/i);
    // App-authored inline <style> IS expected here: the kinetic_marquee
    // section ships @keyframes marquee as a style element. That style tag is
    // authored by the application (never by tenant custom CSS, which cannot
    // express selectors/at-rules after sanitization).
    expect(html).toMatch(/@keyframes marquee/);
    expect(html).not.toMatch(/<style[\s>][^>]*@import/i);
    expect(html).not.toMatch(/<style[\s>][^>]*url\(/i);
  });
});

// ── Fixture export for the browser computed-style test ──────────────────────

const fixtureDir = process.env.RENDER_FIXTURES_OUT;

afterAll(() => {
  if (!fixtureDir) return;
  mkdirSync(fixtureDir, { recursive: true });
  for (const c of cases) {
    const html = ssrHtml(c.config);
    writeFileSync(
      resolve(fixtureDir, `${c.name}.html`),
      `<!doctype html><html><head><meta charset="utf-8"></head><body>${html}</body></html>`,
      "utf8",
    );
  }
  if (process.env.DEBUG_RENDER === "1") {
    const html = renderToStaticMarkup(
      createElement(PortalThemeRenderer, {
        config: resolveTenantPortalTheme({
          portalTheme: null,
          legacyTenantFields: {},
          mode: "public",
        }),
      }),
    );
    writeFileSync(
      resolve(fixtureDir, "default-theme.html"),
      `<!doctype html><html><head><meta charset="utf-8"></head><body>${html}</body></html>`,
      "utf8",
    );
  }
});
