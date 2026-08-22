import { describe, expect, it } from "vitest";
import { DEFAULT_PORTAL_THEME_CONFIG } from "../defaults/default-config";
import { CURATED_THEME_FAMILIES } from "../defaults/curated-families";
import { applyCuratedTheme } from "../defaults/theme-blueprints";
import { resolveSectionType } from "../registry";
import { useCustomizerStore } from "../client/store";

describe("curated structural themes", () => {
  it("gives every family a distinct hero and catalog treatment", () => {
    const signatures = CURATED_THEME_FAMILIES.map((family) => {
      const config = applyCuratedTheme(DEFAULT_PORTAL_THEME_CONFIG, family.id, "style-and-layout", (type) => `new-${type}`);
      const hero = config.sections.find((section) => resolveSectionType(section.type) === "hero_banner");
      const catalog = config.sections.find((section) => resolveSectionType(section.type) === "catalog_grid");
      return `${hero?.settings.styleMode}:${catalog?.settings.styleMode}`;
    });
    expect(new Set(signatures).size).toBe(CURATED_THEME_FAMILIES.length);
  });

  it("style-only changes presentation without replacing tenant sections", () => {
    const current = structuredClone(DEFAULT_PORTAL_THEME_CONFIG);
    current.sections.splice(2, 0, {
      id: "tenant-story",
      type: "rich_text",
      enabled: true,
      settings: { title: "Cerita tenant", content: "Konten yang sudah ditulis." },
      blocks: [],
    });
    const result = applyCuratedTheme(current, "editorial_journal", "style");
    expect(result.sections.map((section) => section.id)).toEqual(current.sections.map((section) => section.id));
    expect(result.sections.find((section) => section.id === "tenant-story")?.settings.content).toBe("Konten yang sudah ditulis.");
    expect(result.sections.find((section) => section.id === "tenant-story")?.settings.title).toBe("Cerita tenant");
  });

  it("layout application reorders but never deletes tenant or legacy sections", () => {
    const current = structuredClone(DEFAULT_PORTAL_THEME_CONFIG);
    current.sections.push({
      id: "legacy-radar",
      type: "wholesale_radar",
      enabled: true,
      settings: { title: "Persisted tenant radar" },
      blocks: [],
    });
    current.sections.push({
      id: "tenant-story",
      type: "rich_text",
      enabled: true,
      settings: { title: "Cerita tenant" },
      blocks: [],
    });
    const result = applyCuratedTheme(current, "reserve_microlot", "style-and-layout", (type) => `new-${type}`);
    expect(result.sections.map((section) => section.id)).toEqual(expect.arrayContaining(["legacy-radar", "tenant-story"]));
    expect(result.sections.find((section) => section.id === "legacy-radar")?.type).toBe("wholesale_radar");
    expect(result.sections.at(-1)?.type).toBe("footer_nav");
  });

  it("theme application is one undoable dirty change", () => {
    const initial = structuredClone(DEFAULT_PORTAL_THEME_CONFIG);
    const next = applyCuratedTheme(initial, "community_roastery", "style-and-layout", (type) => `new-${type}`);
    useCustomizerStore.getState().initialize(initial);
    useCustomizerStore.getState().applyThemeConfig(next);
    expect(useCustomizerStore.getState().isDirty).toBe(true);
    expect(useCustomizerStore.getState().undoStack).toHaveLength(1);
    expect(useCustomizerStore.getState().workingDraft.themeKey).toBe("community_roastery");
    useCustomizerStore.getState().undo();
    expect(useCustomizerStore.getState().workingDraft).toEqual(initial);
  });
});
