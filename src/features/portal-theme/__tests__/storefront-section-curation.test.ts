import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PortalThemeRenderer } from "../components/PortalThemeRenderer";
import { AddSectionDialog } from "../components/AddSectionDialog";
import { DEFAULT_PORTAL_THEME_CONFIG } from "../defaults/default-config";
import { QUICK_FILL_PRESETS } from "../defaults/quick-fill-presets";
import { THEME_PRESETS } from "../defaults/theme-presets";
import {
  EDITOR_SECTION_TYPE_GROUPS,
  LEGACY_SECTION_TYPE_ALIASES,
  PUBLIC_SECTION_REGISTRY,
  PUBLIC_SECTION_TYPES,
  PUBLIC_SECTION_TYPE_GROUPS,
  SECTION_REGISTRY,
  curatePublicSections,
  getSectionsForArea,
  getSectionDefinition,
  isPublicSectionType,
  isValidSectionType,
  resolveSectionType,
  sectionTypeMatchesGroup,
} from "../registry";
import { resolveTenantPortalTheme } from "../resolver";
import type { PortalSection, PortalThemeConfig } from "../types";

const HIDDEN_LEGACY_TYPES = [
  "newsletter",
  "interactive_flavor",
  "roast_matrix",
] as const;

function section(type: string, index: number): PortalSection {
  return {
    id: `compat-section-${index}`,
    type,
    enabled: true,
    settings: {},
    blocks: [],
  };
}

function configWithTypes(types: readonly string[]): PortalThemeConfig {
  const config = structuredClone(DEFAULT_PORTAL_THEME_CONFIG);
  config.sections = types.map(section);
  return config;
}

describe("storefront section curation", () => {
  it("derives the addable catalog and every area from registry metadata", () => {
    const groupedTypes = Object.values(PUBLIC_SECTION_TYPE_GROUPS).flat();

    expect(PUBLIC_SECTION_TYPES).toHaveLength(19);
    expect(PUBLIC_SECTION_REGISTRY).toHaveLength(19);
    expect(new Set(groupedTypes)).toEqual(new Set(PUBLIC_SECTION_TYPES));
    expect(PUBLIC_SECTION_REGISTRY.every((definition) =>
      isPublicSectionType(definition.type),
    )).toBe(true);

    for (const type of HIDDEN_LEGACY_TYPES) {
      expect(isPublicSectionType(type)).toBe(false);
      expect(PUBLIC_SECTION_REGISTRY.some((definition) => definition.type === type)).toBe(false);
    }

    for (const area of ["header", "beranda", "katalog", "konten", "footer"] as const) {
      const expected = getSectionsForArea(area, { addableOnly: true }).map(
        (definition) => definition.type,
      );
      const html = renderToStaticMarkup(createElement(AddSectionDialog, {
        open: true,
        onClose: () => undefined,
        area,
      }));
      const rendered = Array.from(
        html.matchAll(/data-section-type="([^"]+)"/g),
        (match) => match[1],
      );
      expect(rendered).toEqual(expected);
      expect(rendered.every((type) =>
        SECTION_REGISTRY.find((definition) => definition.type === type)?.addable === true,
      )).toBe(true);
    }
  });

  it("does not show a subscriber form without a backend workflow", () => {
    const footerOnly = configWithTypes(["footer_nav"]);
    const html = renderToStaticMarkup(createElement(PortalThemeRenderer, {
      config: footerOnly,
      isPreview: false,
    }));

    expect(html).not.toContain("cafe@domain.com");
    expect(html).not.toContain("Subscribed to Weekly Dispatch");
    expect(html).not.toContain('type="email"');
  });

  it("keeps new defaults and applied preset layouts inside the public catalog", () => {
    expect(DEFAULT_PORTAL_THEME_CONFIG.sections.every((item) =>
      isPublicSectionType(item.type),
    )).toBe(true);

    for (const preset of THEME_PRESETS) {
      if (!preset.defaultSections) continue;
      const curated = curatePublicSections(preset.defaultSections);
      expect(curated.every((item) => isPublicSectionType(item.type))).toBe(true);
      expect(curated).not.toContainEqual(expect.objectContaining({
        type: "interactive_flavor",
      }));
    }
  });

  it("keeps hidden and aliased persisted sections manageable in the editor", () => {
    for (const type of HIDDEN_LEGACY_TYPES) {
      const editorTypes = Object.values(EDITOR_SECTION_TYPE_GROUPS).flat();
      expect(sectionTypeMatchesGroup(type, editorTypes)).toBe(true);
    }

    expect(sectionTypeMatchesGroup(
      "wholesale_radar",
      EDITOR_SECTION_TYPE_GROUPS.katalog,
    )).toBe(true);
    expect(sectionTypeMatchesGroup(
      "kinetic_marquee",
      EDITOR_SECTION_TYPE_GROUPS.beranda,
    )).toBe(true);
  });

  it("classifies every section by implemented capability", () => {
    expect(SECTION_REGISTRY.filter((definition) => definition.status === "core").map((definition) => definition.type))
      .toEqual(["hero_banner", "catalog_grid", "header_nav", "footer_nav"]);
    expect(SECTION_REGISTRY.filter((definition) => definition.status === "legacy").map((definition) => definition.type))
      .toEqual([...HIDDEN_LEGACY_TYPES]);
    expect(SECTION_REGISTRY.every((definition) =>
      definition.status !== "legacy" || definition.addable === false,
    )).toBe(true);
  });
});

describe("legacy section compatibility", () => {
  it("resolves deprecated aliases without registering duplicate public types", () => {
    expect(LEGACY_SECTION_TYPE_ALIASES).toEqual({
      wholesale_radar: "roast_matrix",
      kinetic_marquee: "marquee_kinetic",
    });
    expect(resolveSectionType("wholesale_radar")).toBe("roast_matrix");
    expect(resolveSectionType("kinetic_marquee")).toBe("marquee_kinetic");
    expect(getSectionDefinition("wholesale_radar")?.type).toBe("roast_matrix");
    expect(getSectionDefinition("kinetic_marquee")?.type).toBe("marquee_kinetic");
    expect(isValidSectionType("wholesale_radar")).toBe(true);
    expect(isValidSectionType("kinetic_marquee")).toBe(true);
    expect(isPublicSectionType("wholesale_radar")).toBe(false);
    expect(isPublicSectionType("kinetic_marquee")).toBe(false);
    expect(SECTION_REGISTRY.some((definition) =>
      Object.hasOwn(LEGACY_SECTION_TYPE_ALIASES, definition.type),
    )).toBe(false);
  });

  it("renders every hidden legacy type and both aliases from persisted JSON", () => {
    const persistedTypes = [
      ...HIDDEN_LEGACY_TYPES,
      "wholesale_radar",
      "kinetic_marquee",
    ];
    const persistedConfig = configWithTypes(persistedTypes);
    const resolved = resolveTenantPortalTheme({
      portalTheme: {
        draftConfig: structuredClone(persistedConfig),
        publishedConfig: structuredClone(persistedConfig),
      },
      legacyTenantFields: {},
      mode: "public",
    });

    expect(resolved.sections.map((item) => item.type)).toEqual(persistedTypes);

    const html = renderToStaticMarkup(createElement(PortalThemeRenderer, {
      config: resolved,
      isPreview: false,
    }));

    expect(html).not.toContain("Jenis bagian tidak dikenali");
    expect(html).toContain('data-section-type="roast_matrix"');
    expect(html).toContain('data-section-type="marquee_kinetic"');
    for (let index = 0; index < persistedTypes.length; index += 1) {
      expect(html).toContain(`id="compat-section-${index}"`);
    }
  });

  it("keeps checked-in defaults and theme presets on canonical type names", () => {
    const deprecatedNames = new Set(Object.keys(LEGACY_SECTION_TYPE_ALIASES));
    const authoredTypes = [
      ...DEFAULT_PORTAL_THEME_CONFIG.sections.map((item) => item.type),
      ...THEME_PRESETS.flatMap((preset) => [
        ...Object.keys(preset.sectionDefaults),
        ...(preset.defaultSections?.map((item) => item.type) ?? []),
      ]),
      ...Object.keys(QUICK_FILL_PRESETS),
    ];

    expect(authoredTypes.some((type) => deprecatedNames.has(type))).toBe(false);
    expect(authoredTypes.every((type) => isValidSectionType(type))).toBe(true);
  });

  it("renders unknown persisted sections with a graceful fallback", () => {
    const html = renderToStaticMarkup(createElement(PortalThemeRenderer, {
      config: configWithTypes(["unknown_persisted_section"]),
    }));

    expect(html).toContain("Jenis bagian tidak dikenali: unknown_persisted_section");
  });

  it("maps marquee controls to visible renderer output", () => {
    const config = configWithTypes(["marquee_kinetic"]);
    config.sections[0].settings = {
      title: "Jadwal sangrai Jumat",
      speed: 17,
      direction: "right",
      styleMode: "solid",
    };
    const html = renderToStaticMarkup(createElement(PortalThemeRenderer, { config }));

    expect(html).toContain("Jadwal sangrai Jumat");
    expect(html).toMatch(/animation:\s*marquee-right 17s linear infinite/);
  });

  it("keeps the system default canonical and free of demo merchant content", () => {
    const serialized = JSON.stringify(DEFAULT_PORTAL_THEME_CONFIG);
    const staleAliases = Object.keys(LEGACY_SECTION_TYPE_ALIASES);

    expect(DEFAULT_PORTAL_THEME_CONFIG.sections.every((item) =>
      !staleAliases.includes(item.type),
    )).toBe(true);
    expect(serialized).not.toMatch(/unsplash|roastd\.id|85\+|direct trade|sample pack/i);
  });
});
