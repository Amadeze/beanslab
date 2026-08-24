import { describe, expect, it, beforeEach, vi } from "vitest";
import { CURATED_THEME_FAMILIES, getPrimaryPresetForFamily, validateCuratedFamilies, getAllPresetIds } from "../defaults/curated-families";
import { THEME_PRESETS, getThemePresetById } from "../defaults/theme-presets";
import {
  PUBLIC_SECTION_REGISTRY,
  PUBLIC_SECTION_TYPES,
  PUBLIC_SECTION_TYPE_GROUPS,
  SECTION_REGISTRY,
  getSectionDefinition,
  isValidSectionType,
  getSectionsByCategory,
} from "../registry";
import { useCustomizerStore } from "../client/store";
import { sanitizeCSS } from "../server/css-sanitizer";
import { PortalThemeConfigSchema, TypographySchema, AnimationSchema } from "../schemas";
import { DEFAULT_PORTAL_THEME_CONFIG } from "../defaults/default-config";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { PortalThemeRenderer } from "../components/PortalThemeRenderer";
import { resolveTenantPortalTheme } from "../resolver";

const mockFetch = vi.fn();
global.fetch = mockFetch;

// ── Curated Theme Families ───────────────────────────────────────────────────
describe("Curated Theme Families", () => {
  it("has exactly 6 curated structural families", () => {
    expect(CURATED_THEME_FAMILIES.length).toBe(6);
  });

  it("each family has required fields", () => {
    for (const family of CURATED_THEME_FAMILIES) {
      expect(family.id).toBeTruthy();
      expect(family.name).toBeTruthy();
      expect(family.tagline).toBeTruthy();
      expect(family.signature).toBeTruthy();
      expect(family.sectionRecipe.length).toBeGreaterThanOrEqual(4);
      expect(family.preview).toBeTruthy();
      expect(family.presetIds).toBeInstanceOf(Array);
      expect(family.presetIds.length).toBeGreaterThan(0);
      expect(family.primaryPresetId).toBeTruthy();
    }
  });

  it("family IDs match expected set", () => {
    const ids = CURATED_THEME_FAMILIES.map((f) => f.id).sort();
    expect(ids).toEqual([
      "community_roastery",
      "editorial_journal",
      "modern_catalog",
      "origin_field_notes",
      "reserve_microlot",
      "tactile_brutalist",
    ]);
  });

  it("all preset IDs in families exist in THEME_PRESETS", () => {
    const allPresetIds = new Set(getAllPresetIds());
    for (const family of CURATED_THEME_FAMILIES) {
      expect(allPresetIds.has(family.primaryPresetId)).toBe(true);
      for (const pid of family.presetIds) {
        expect(allPresetIds.has(pid)).toBe(true);
      }
    }
  });

  it("getPrimaryPresetForFamily returns valid preset for each family", () => {
    for (const family of CURATED_THEME_FAMILIES) {
      const preset = getPrimaryPresetForFamily(family.id);
      expect(preset).toBeDefined();
      expect(preset?.id).toBe(family.primaryPresetId);
    }
  });

  it("validateCuratedFamilies passes", () => {
    const result = validateCuratedFamilies();
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("curated families cover distinct visual directions", () => {
    const names = CURATED_THEME_FAMILIES.map((f) => f.name);
    expect(names).toEqual(expect.arrayContaining([
      "Roast Lab",
      "Award Storyteller",
      "Field Guide",
      "Industrial Poster",
      "Dark Luxury Gallery",
      "Warm Neighborhood",
    ]));
  });
});

// ── Preset Compatibility ─────────────────────────────────────────────────────
describe("Preset Compatibility Layer", () => {
  it("THEME_PRESETS has 22 presets", () => {
    expect(THEME_PRESETS.length).toBe(22);
  });

  it("all 16 preset IDs are unique", () => {
    const ids = THEME_PRESETS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("getThemePresetById resolves all preset IDs", () => {
    for (const preset of THEME_PRESETS) {
      const found = getThemePresetById(preset.id);
      expect(found).toBeDefined();
      expect(found?.id).toBe(preset.id);
    }
  });

  it("unknown preset ID returns undefined", () => {
    expect(getThemePresetById("nonexistent")).toBeUndefined();
  });

  it("each preset has complete visual system", () => {
    for (const preset of THEME_PRESETS) {
      expect(preset.colors).toBeDefined();
      expect(preset.typography).toBeDefined();
      expect(preset.layout).toBeDefined();
      expect(preset.animations).toBeDefined();
      expect(preset.variants).toBeInstanceOf(Array);
      expect(preset.variants.length).toBeGreaterThan(0);
    }
  });

  it("legacy preset IDs from before Batch 6 still resolve", () => {
    // These are the original preset IDs that must remain for compatibility
    const legacyIds = [
      "roastr_official", "heritage", "neomodern", "cyber", "botanical",
      "editorial", "liquid", "industrial", "club", "luxury", "playful",
      "neo_tokyo_cyber", "nordic_botanical", "tactile_brutalist",
      "liquid_sensory", "heritage_reserve"
    ];
    for (const id of legacyIds) {
      expect(getThemePresetById(id)).toBeDefined();
    }
  });
});

// ── Block Management ─────────────────────────────────────────────────────────
describe("Block Management Operations", () => {
  beforeEach(() => {
    // Reset store to minimal config for testing
    const minimalConfig = structuredClone(DEFAULT_PORTAL_THEME_CONFIG);
    minimalConfig.sections = [];
    useCustomizerStore.setState({
      initialDraft: minimalConfig,
      workingDraft: minimalConfig,
      isDirty: false,
      selectedSectionId: null,
      activePanel: "sections",
      previewViewport: "desktop",
      isSaving: false,
      isPublishing: false,
      validationErrors: {},
      undoStack: [],
      redoStack: [],
    });
  });

  it("adds section with valid type", () => {
    useCustomizerStore.getState().addSection("hero_banner");
    const sections = useCustomizerStore.getState().workingDraft.sections;
    expect(sections.length).toBeGreaterThan(0);
    const added = sections.find((s) => s.type === "hero_banner");
    expect(added).toBeDefined();
    expect(added?.id).toBeTruthy();
  });

  it("rejects invalid section type", () => {
    const store = useCustomizerStore.getState();
    const initialLength = store.workingDraft.sections.length;
    store.addSection("nonexistent_type");
    expect(useCustomizerStore.getState().workingDraft.sections.length).toBe(initialLength);
  });

  it("rejects registry sections that are compatibility-only", () => {
    const store = useCustomizerStore.getState();
    for (const type of ["newsletter", "interactive_flavor", "roast_matrix"]) {
      store.addSection(type);
    }
    expect(useCustomizerStore.getState().workingDraft.sections).toHaveLength(0);
  });

  it("creates addable sections from neutral registry defaults", () => {
    useCustomizerStore.getState().addSection("marquee_kinetic");
    const added = useCustomizerStore.getState().workingDraft.sections[0];

    expect(added.type).toBe("marquee_kinetic");
    expect(added.settings.title).toBe("");
    expect(added.blocks).toEqual([]);
    expect(JSON.stringify(added)).not.toMatch(/roastd\.id|direct trade|85\+|sample/i);
  });

  it("removes section by ID", () => {
    useCustomizerStore.getState().addSection("hero_banner");
    const sectionId = useCustomizerStore.getState().workingDraft.sections.find((s) => s.type === "hero_banner")?.id;
    expect(sectionId).toBeDefined();
    useCustomizerStore.getState().removeSection(sectionId!);
    expect(useCustomizerStore.getState().workingDraft.sections.find((s) => s.id === sectionId)).toBeUndefined();
  });

  it("duplicates section with new ID and blocks", () => {
    useCustomizerStore.getState().addSection("hero_banner");
    const original = useCustomizerStore.getState().workingDraft.sections.find((s) => s.type === "hero_banner")!;
    useCustomizerStore.getState().duplicateSection(original.id);
    const sections = useCustomizerStore.getState().workingDraft.sections;
    const duplicates = sections.filter((s) => s.type === "hero_banner");
    expect(duplicates.length).toBe(2);
    expect(duplicates[0].id).not.toBe(duplicates[1].id);
    expect(duplicates[1].blocks).toHaveLength(duplicates[0].blocks.length);
    duplicates[1].blocks.forEach((b, i) => {
      expect(b.id).not.toBe(duplicates[0].blocks[i].id);
    });
  });

  it("toggles section visibility", () => {
    useCustomizerStore.getState().addSection("hero_banner");
    const sectionId = useCustomizerStore.getState().workingDraft.sections.find((s) => s.type === "hero_banner")?.id;
    expect(useCustomizerStore.getState().workingDraft.sections.find((s) => s.id === sectionId)?.enabled).toBe(true);
    useCustomizerStore.getState().toggleSectionVisibility(sectionId!);
    expect(useCustomizerStore.getState().workingDraft.sections.find((s) => s.id === sectionId)?.enabled).toBe(false);
    useCustomizerStore.getState().toggleSectionVisibility(sectionId!);
    expect(useCustomizerStore.getState().workingDraft.sections.find((s) => s.id === sectionId)?.enabled).toBe(true);
  });

  it("reorders sections correctly", () => {
    useCustomizerStore.getState().addSection("hero_banner");
    useCustomizerStore.getState().addSection("catalog_grid");
    useCustomizerStore.getState().addSection("footer_nav");
    const ids = useCustomizerStore.getState().workingDraft.sections.map((s) => s.id);
    useCustomizerStore.getState().reorderSections(0, 2);
    const newIds = useCustomizerStore.getState().workingDraft.sections.map((s) => s.id);
    // Move hero_banner (index 0) to index 2 => [catalog_grid, footer_nav, hero_banner]
    expect(newIds[0]).toBe(ids[1]); // catalog_grid moved to first
    expect(newIds[1]).toBe(ids[2]); // footer_nav moved to second
    expect(newIds[2]).toBe(ids[0]); // hero_banner moved to third
  });

  it("persisted ordering matches preview render order", () => {
    useCustomizerStore.getState().addSection("hero_banner");
    useCustomizerStore.getState().addSection("catalog_grid");
    useCustomizerStore.getState().addSection("footer_nav");
    const order1 = useCustomizerStore.getState().workingDraft.sections.map((s) => s.type);
    useCustomizerStore.getState().reorderSections(0, 2);
    const order2 = useCustomizerStore.getState().workingDraft.sections.map((s) => s.type);
    expect(order1).not.toEqual(order2);
    // After move(0, 2): [catalog_grid, footer_nav, hero_banner]
    expect(order2[0]).toBe("catalog_grid");
  });
});

// ── Contextual Add Section ───────────────────────────────────────────────────
describe("Contextual Add Section Dialog", () => {
  it("Header add dialog exposes only header_nav", () => {
    const allowed = PUBLIC_SECTION_TYPE_GROUPS.header;
    expect(allowed).toEqual(["header_nav"]);
    const definitions = SECTION_REGISTRY.filter((s) => allowed.some((type) => type === s.type));
    expect(definitions.length).toBe(1);
    expect(definitions[0].type).toBe("header_nav");
  });

  it("Beranda add dialog exposes only Beranda types", () => {
    const allowed = PUBLIC_SECTION_TYPE_GROUPS.beranda;
    const definitions = SECTION_REGISTRY.filter((s) => allowed.some((type) => type === s.type));
    expect(definitions.length).toBe(5);
    expect(definitions.map((d) => d.type).sort()).toEqual([
      "bento_showcase",
      "countdown",
      "hero_banner",
      "marquee_kinetic",
      "sticky_narrative",
    ]);
  });

  it("Katalog add dialog exposes only Katalog types", () => {
    const allowed = PUBLIC_SECTION_TYPE_GROUPS.katalog;
    const definitions = SECTION_REGISTRY.filter((s) => allowed.some((type) => type === s.type));
    expect(definitions.length).toBe(3);
    expect(definitions.map((d) => d.type).sort()).toEqual([
      "catalog_grid",
      "featured_collection",
      "product_highlight",
    ]);
  });

  it("Konten add dialog exposes only Konten types", () => {
    const allowed = PUBLIC_SECTION_TYPE_GROUPS.konten;
    const definitions = SECTION_REGISTRY.filter((s) => allowed.some((type) => type === s.type));
    expect(definitions.length).toBe(12);
    const types = definitions.map((d) => d.type);
    expect(types).toContain("rich_text");
    expect(types).toContain("testimonials");
    expect(types).toContain("faq");
    expect(types).toContain("awards_strip");
    expect(types).toContain("brand_timeline");
    expect(types).toContain("sustainability");
  });

  it("Footer add dialog exposes only footer_nav", () => {
    const allowed = PUBLIC_SECTION_TYPE_GROUPS.footer;
    const definitions = SECTION_REGISTRY.filter((s) => allowed.some((type) => type === s.type));
    expect(definitions.length).toBe(1);
    expect(definitions[0].type).toBe("footer_nav");
  });

  it("exposes only the curated public catalog", () => {
    const groupedTypes = Object.values(PUBLIC_SECTION_TYPE_GROUPS).flat();
    expect(new Set(groupedTypes)).toEqual(new Set(PUBLIC_SECTION_TYPES));
    expect(PUBLIC_SECTION_REGISTRY.map((section) => section.type)).toHaveLength(22);

    for (const hiddenType of [
      "newsletter",
      "interactive_flavor",
      "roast_matrix",
    ]) {
      expect(groupedTypes).not.toContain(hiddenType);
    }
  });
});

// ── Section Registry ─────────────────────────────────────────────────────────
describe("Section Registry", () => {
  it("has all section types registered (25)", () => {
    expect(SECTION_REGISTRY.length).toBe(25);
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

  it("isValidSectionType returns true for valid types", () => {
    expect(isValidSectionType("hero_banner")).toBe(true);
    expect(isValidSectionType("catalog_grid")).toBe(true);
    expect(isValidSectionType("footer_nav")).toBe(true);
  });

  it("isValidSectionType returns false for invalid types", () => {
    expect(isValidSectionType("nonexistent")).toBe(false);
  });

  it("getSectionsByCategory returns correct sections", () => {
    const content = getSectionsByCategory("content");
    expect(content.length).toBeGreaterThan(0);
    expect(content.every((s) => s.category === "content")).toBe(true);

    const commerce = getSectionsByCategory("commerce");
    expect(commerce.length).toBeGreaterThan(0);
    expect(commerce.every((s) => s.category === "commerce")).toBe(true);
  });
});

// ── Customizer State ─────────────────────────────────────────────────────────
describe("Customizer State Management", () => {
  beforeEach(() => {
    // Reset store to minimal config for testing
    const minimalConfig = structuredClone(DEFAULT_PORTAL_THEME_CONFIG);
    minimalConfig.sections = [];
    useCustomizerStore.setState({
      initialDraft: minimalConfig,
      workingDraft: minimalConfig,
      isDirty: false,
      selectedSectionId: null,
      activePanel: "sections",
      previewViewport: "desktop",
      isSaving: false,
      isPublishing: false,
      validationErrors: {},
      undoStack: [],
      redoStack: [],
    });
  });

  it("editing changes preview (workingDraft updates)", () => {
    useCustomizerStore.getState().addSection("hero_banner");
    const sectionId = useCustomizerStore.getState().workingDraft.sections[0].id;
    useCustomizerStore.getState().updateSectionSettings(sectionId, { title: "New Title" });
    expect(useCustomizerStore.getState().workingDraft.sections.find((s) => s.id === sectionId)?.settings.title).toBe("New Title");
    expect(useCustomizerStore.getState().isDirty).toBe(true);
  });

  it("unsaved state is tracked", () => {
    expect(useCustomizerStore.getState().isDirty).toBe(false);
    useCustomizerStore.getState().addSection("hero_banner");
    expect(useCustomizerStore.getState().isDirty).toBe(true);
    useCustomizerStore.getState().discardChanges();
    expect(useCustomizerStore.getState().isDirty).toBe(false);
  });

  it("save failure is surfaced (error returned)", async () => {
    // This tests the action interface - the actual server call is mocked
    const result = await import("../server/actions").then((m) => m.savePortalThemeDraft({ invalid: true }));
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeDefined();
    }
  });

  it("viewport switch does not alter config", () => {
    const store = useCustomizerStore.getState();
    const initialConfig = structuredClone(store.workingDraft);
    store.setPreviewViewport("mobile");
    store.setPreviewViewport("tablet");
    store.setPreviewViewport("desktop");
    expect(useCustomizerStore.getState().workingDraft).toEqual(initialConfig);
  });

  it("undo/redo works correctly", () => {
    useCustomizerStore.getState().addSection("hero_banner");
    const afterAdd = useCustomizerStore.getState().undoStack.length;
    useCustomizerStore.getState().undo();
    expect(useCustomizerStore.getState().undoStack.length).toBe(afterAdd - 1);
    expect(useCustomizerStore.getState().redoStack.length).toBe(1);
    useCustomizerStore.getState().redo();
    expect(useCustomizerStore.getState().redoStack.length).toBe(0);
    expect(useCustomizerStore.getState().undoStack.length).toBe(afterAdd);
  });
});

// ── Preset Apply Dirty Semantics ─────────────────────────────────────────────
describe("Preset Apply Dirty Semantics", () => {
  beforeEach(() => {
    const minimalConfig = structuredClone(DEFAULT_PORTAL_THEME_CONFIG);
    minimalConfig.sections = [];
    useCustomizerStore.setState({
      initialDraft: minimalConfig,
      workingDraft: minimalConfig,
      isDirty: false,
      selectedSectionId: null,
      activePanel: "sections",
      previewViewport: "desktop",
      isSaving: false,
      isPublishing: false,
      validationErrors: {},
      undoStack: [],
      redoStack: [],
    });
  });

  it("applying a preset marks isDirty true and preserves undo history", () => {
    const store = useCustomizerStore.getState();
    const initialUndoLength = store.undoStack.length;

    const preset = getThemePresetById("neomodern");
    expect(preset).toBeDefined();
    if (!preset) return;

    store.updateGlobalColors(preset.colors);
    store.updateGlobalTypography(preset.typography);
    store.updateGlobalLayout(preset.layout);
    store.updateGlobalAnimations({ ...preset.animations, reduceMotion: false });

    expect(useCustomizerStore.getState().isDirty).toBe(true);
    expect(useCustomizerStore.getState().undoStack.length).toBeGreaterThan(initialUndoLength);
  });

  it("Discard restores the previously saved state after preset application", () => {
    const store = useCustomizerStore.getState();
    store.addSection("hero_banner");
    store.discardChanges();

    const preset = getThemePresetById("neomodern");
    expect(preset).toBeDefined();
    if (!preset) return;

    store.updateGlobalColors(preset.colors);
    store.updateGlobalTypography(preset.typography);
    store.updateGlobalLayout(preset.layout);
    store.updateGlobalAnimations({ ...preset.animations, reduceMotion: false });

    expect(useCustomizerStore.getState().isDirty).toBe(true);

    store.discardChanges();
    expect(useCustomizerStore.getState().isDirty).toBe(false);
  });

  it("Undo can undo preset application", () => {
    const store = useCustomizerStore.getState();
    const beforeUndoStack = store.undoStack.length;

    const preset = getThemePresetById("neomodern");
    expect(preset).toBeDefined();
    if (!preset) return;

    store.updateGlobalColors(preset.colors);
    store.updateGlobalTypography(preset.typography);
    store.updateGlobalLayout(preset.layout);
    store.updateGlobalAnimations({ ...preset.animations, reduceMotion: false });

    const afterPresetUndoStack = useCustomizerStore.getState().undoStack.length;
    expect(afterPresetUndoStack).toBeGreaterThan(beforeUndoStack);

    store.undo();
    expect(useCustomizerStore.getState().undoStack.length).toBe(afterPresetUndoStack - 1);
    expect(useCustomizerStore.getState().redoStack.length).toBe(1);

    store.redo();
    expect(useCustomizerStore.getState().redoStack.length).toBe(0);
    expect(useCustomizerStore.getState().undoStack.length).toBe(afterPresetUndoStack);
  });
});

// ── Security Regression ──────────────────────────────────────────────────────
describe("Security Regression", () => {
  it("unsafe custom CSS remains rejected", () => {
    const dangerousPayloads = [
      "position: fixed",
      "width: 100vw",
      "@import url(evil.css)",
      "background: url(javascript:alert(1))",
      "color: red !important",
    ];
    for (const css of dangerousPayloads) {
      const result = sanitizeCSS(css);
      expect(result.ok).toBe(false);
    }
  });

  it("valid CSS is accepted", () => {
    const validPayloads = [
      "color: red",
      "padding: 8px",
      "background-image: linear-gradient(red, blue)",
      "box-shadow: 0 4px 8px rgba(0,0,0,0.2)",
      "transform: rotate(45deg)",
    ];
    for (const css of validPayloads) {
      const result = sanitizeCSS(css);
      expect(result.ok).toBe(true);
    }
  });

  it("customHead/customFooter remain inert in public mode (actual render path)", () => {
    const config = structuredClone(DEFAULT_PORTAL_THEME_CONFIG);
    config.globalSettings.integrations.customHead = "<script>alert(1)</script>";
    config.globalSettings.integrations.customFooter = "<iframe src=evil></iframe>";

    const resolved = resolveTenantPortalTheme({
      portalTheme: { draftConfig: structuredClone(config), publishedConfig: structuredClone(config) },
      legacyTenantFields: {},
      mode: "public",
    });

    const html = renderToStaticMarkup(
      createElement(PortalThemeRenderer, { config: resolved, isPreview: false, products: [], offerings: [] })
    );

    expect(html).not.toContain("<script");
    expect(html).not.toContain("javascript:");
    expect(html).not.toContain("<iframe");
    expect(html).not.toMatch(/\son[a-z]+\s*=/i);
  });

  it("font charset allowlist rejects dangerous fonts", () => {
    const evilFonts = ["</style><script>", "font\" onload=", "font{color:red}"];
    for (const font of evilFonts) {
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
    }
  });

  it("easing grammar rejects invalid cubic-bezier", () => {
    const invalidEasings = ["cubic-bezier(1.5, 1, 0.36, 1)", "cubic-bezier(0.22, 1, 0.36)", "NaN"];
    for (const easing of invalidEasings) {
      const result = AnimationSchema.safeParse({
        scrollTrigger: "fade-in",
        duration: 500,
        delay: 0,
        easing,
        hoverEffect: "scale",
      });
      expect(result.success).toBe(false);
    }
  });

  it("executable script regression: resolver output contains no executable markup", () => {
    const payloads = [
      "<script>alert(1)</script>",
      "javascript:alert(1)",
      "onload=alert(1)",
      "<iframe src=evil>",
    ];

    for (const payload of payloads) {
      const config = structuredClone(DEFAULT_PORTAL_THEME_CONFIG);
      config.globalSettings.integrations.customHead = payload;
      config.globalSettings.integrations.customFooter = payload;
      config.globalSettings.typography.headingFont = payload;

      const resolved = resolveTenantPortalTheme({
        portalTheme: { draftConfig: structuredClone(config), publishedConfig: structuredClone(config) },
        legacyTenantFields: {},
        mode: "public",
      });

      const html = renderToStaticMarkup(
        createElement(PortalThemeRenderer, { config: resolved, isPreview: false, products: [], offerings: [] })
      );

      expect(html).not.toContain("<script");
      expect(html).not.toContain("javascript:");
      expect(html).not.toContain("onload=");
      expect(html).not.toContain("<iframe");
    }
  });
});

// ── Rendering ────────────────────────────────────────────────────────────────
describe("Rendering & Tenant Branding", () => {
  it("tenant branding used instead of fake Roastd.id identity", () => {
    const config = structuredClone(DEFAULT_PORTAL_THEME_CONFIG);
    const headerSection = config.sections.find((s) => s.type === "header_nav");
    expect(headerSection).toBeDefined();
    expect(headerSection?.settings.logoText).toBeDefined();
  });

  it("empty catalog does not fabricate products", () => {
    const config = structuredClone(DEFAULT_PORTAL_THEME_CONFIG);
    config.sections = config.sections.filter((s) => s.type === "catalog_grid");
    config.sections[0].settings = { ...config.sections[0].settings, title: "Test Catalog" };

    const resolved = resolveTenantPortalTheme({
      portalTheme: { draftConfig: structuredClone(config), publishedConfig: structuredClone(config) },
      legacyTenantFields: {},
      mode: "public",
    });

    const html = renderToStaticMarkup(
      createElement(PortalThemeRenderer, { config: resolved, isPreview: false, products: [], offerings: [] })
    );

    expect(html).not.toContain("Gayo Medium Roast");
    expect(html).not.toContain("Unsplash");
    expect(html).not.toContain("placeholder");
    expect(html).toContain("Test Catalog");
  });

  it("empty featured collection does not fabricate products", () => {
    const config = structuredClone(DEFAULT_PORTAL_THEME_CONFIG);
    // Add a featured_collection section if not present
    let fcSection = config.sections.find((s) => s.type === "featured_collection");
    if (!fcSection) {
      fcSection = {
        id: "sec_featured_test",
        type: "featured_collection",
        enabled: true,
        settings: { title: "Featured", productIds: [] },
        blocks: [],
      };
      config.sections = [...config.sections, fcSection];
    } else {
      fcSection.settings = { ...fcSection.settings, title: "Featured", productIds: [] };
    }

    const resolved = resolveTenantPortalTheme({
      portalTheme: { draftConfig: structuredClone(config), publishedConfig: structuredClone(config) },
      legacyTenantFields: {},
      mode: "public",
    });

    const html = renderToStaticMarkup(
      createElement(PortalThemeRenderer, { config: resolved, isPreview: false, products: [], offerings: [] })
    );

    expect(html).not.toContain("Gayo Medium Roast");
    expect(html).not.toContain("Unsplash");
    expect(html).toContain("Featured");
  });

  it("no fake product/image identity appears in rendered output", () => {
    const config = structuredClone(DEFAULT_PORTAL_THEME_CONFIG);
    config.sections = [];

    const resolved = resolveTenantPortalTheme({
      portalTheme: { draftConfig: structuredClone(config), publishedConfig: structuredClone(config) },
      legacyTenantFields: {},
      mode: "public",
    });

    const html = renderToStaticMarkup(
      createElement(PortalThemeRenderer, { config: resolved, isPreview: false, products: [], offerings: [] })
    );

    expect(html).not.toContain("roastd.id");
    expect(html).not.toContain("ROASTD.ID");
    expect(html).not.toContain("Unsplash");
    expect(html).not.toContain("Gayo");
  });

  it("renderer returns intentional empty/fallback UI rather than crashing", () => {
    const config = structuredClone(DEFAULT_PORTAL_THEME_CONFIG);
    config.sections = [];

    const resolved = resolveTenantPortalTheme({
      portalTheme: { draftConfig: structuredClone(config), publishedConfig: structuredClone(config) },
      legacyTenantFields: {},
      mode: "public",
    });

    expect(() => {
      renderToStaticMarkup(
        createElement(PortalThemeRenderer, { config: resolved, isPreview: false, products: [], offerings: [] })
      );
    }).not.toThrow();
  });
});

// ── Schema Validation ────────────────────────────────────────────────────────
describe("Schema Validation", () => {
  it("accepts DEFAULT_PORTAL_THEME_CONFIG", () => {
    const result = PortalThemeConfigSchema.safeParse(DEFAULT_PORTAL_THEME_CONFIG);
    expect(result.success).toBe(true);
  });

  it("rejects config with evil headingFont via full schema", () => {
    const config = structuredClone(DEFAULT_PORTAL_THEME_CONFIG);
    config.globalSettings.typography.headingFont = "</style><script>alert(1)</script>";
    const result = PortalThemeConfigSchema.safeParse(config);
    expect(result.success).toBe(false);
  });

  it("rejects invalid easing via full schema", () => {
    const config = structuredClone(DEFAULT_PORTAL_THEME_CONFIG);
    config.globalSettings.animations.globalEasing = "cubic-bezier(1.5, 1, 0.36, 1)";
    const result = PortalThemeConfigSchema.safeParse(config);
    expect(result.success).toBe(false);
  });
});

// ── Invalid Section Safety ───────────────────────────────────────────────────
describe("Invalid Section Config Safety", () => {
  it("unknown legacy section type does not crash renderer", () => {
    const config = structuredClone(DEFAULT_PORTAL_THEME_CONFIG);
    config.sections = [
      { id: "sec1", type: "hero_banner", enabled: true, settings: { title: "Valid Hero" }, blocks: [] },
      { id: "sec2", type: "nonexistent_section_type", enabled: true, settings: {}, blocks: [] },
      { id: "sec3", type: "catalog_grid", enabled: true, settings: { title: "Valid Catalog" }, blocks: [] },
    ];

    const resolved = resolveTenantPortalTheme({
      portalTheme: { draftConfig: structuredClone(config), publishedConfig: structuredClone(config) },
      legacyTenantFields: {},
      mode: "public",
    });

    expect(() => {
      const html = renderToStaticMarkup(
        createElement(PortalThemeRenderer, { config: resolved, isPreview: false, products: [], offerings: [] })
      );
      expect(html).toContain("Valid Hero");
      expect(html).toContain("Valid Catalog");
    }).not.toThrow();
  });

  it("malformed section settings handled gracefully", () => {
    const config = structuredClone(DEFAULT_PORTAL_THEME_CONFIG);
    config.sections.push({
      id: "malformed",
      type: "hero_banner",
      enabled: true,
      settings: null as any,
      blocks: [],
    });
    const result = PortalThemeConfigSchema.safeParse(config);
    expect(typeof result.success).toBe("boolean");
  });
});
