import type { PortalSection, PortalThemeConfig } from "../types";
import { getSectionDefinition, resolveSectionType } from "../registry";
import { getCuratedFamilyById, getPrimaryPresetForFamily } from "./curated-families";

export type ThemeApplyMode = "style" | "style-and-layout";

const PRESENTATION_SETTING_KEYS = new Set([
  "styleMode",
  "variant",
  "overlay",
  "textAlignment",
  "alignment",
  "columns",
  "gapStyle",
  "aspectRatio",
  "imagePosition",
  "imageSize",
  "showPrices",
  "sticky",
]);

function presentationSettings(settings: Record<string, unknown> | undefined) {
  return Object.fromEntries(
    Object.entries(settings ?? {}).filter(([key]) => PRESENTATION_SETTING_KEYS.has(key)),
  );
}

function nextId(type: string) {
  return `${type}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

function withPreset(config: PortalThemeConfig, familyId: string): PortalThemeConfig | null {
  const preset = getPrimaryPresetForFamily(familyId);
  if (!preset) return null;
  return {
    ...config,
    themeKey: familyId,
    globalSettings: {
      ...config.globalSettings,
      colors: { ...preset.colors },
      typography: { ...preset.typography },
      layout: { ...preset.layout },
      animations: { ...preset.animations, reduceMotion: config.globalSettings.animations.reduceMotion },
      variants: structuredClone(preset.variants),
      activeVariant: preset.variants.find((variant) => variant.isDefault)?.id ?? preset.variants[0]?.id ?? "light",
    },
    sections: config.sections.map((section) => {
      const defaults = presentationSettings(preset.sectionDefaults[resolveSectionType(section.type)]);
      return Object.keys(defaults).length > 0
        ? { ...section, settings: { ...section.settings, ...defaults } }
        : section;
    }),
  };
}

export function applyCuratedTheme(
  current: PortalThemeConfig,
  familyId: string,
  mode: ThemeApplyMode,
  idFactory: (type: string) => string = nextId,
): PortalThemeConfig {
  const styled = withPreset(structuredClone(current), familyId);
  const family = getCuratedFamilyById(familyId);
  if (!styled || !family || mode === "style") return styled ?? structuredClone(current);

  const remaining = styled.sections.map((section) => ({ section, used: false }));
  const arranged: PortalSection[] = [];

  for (const recipe of family.sectionRecipe) {
    const match = remaining.find((entry) => !entry.used && resolveSectionType(entry.section.type) === recipe.type);
    if (match) {
      match.used = true;
      arranged.push({
        ...match.section,
        settings: { ...match.section.settings, ...recipe.settings },
      });
      continue;
    }

    if (recipe.optional) continue;
    const definition = getSectionDefinition(recipe.type);
    if (!definition) continue;
    arranged.push({
      id: idFactory(recipe.type),
      type: recipe.type,
      enabled: true,
      settings: { ...definition.defaultSettings, ...recipe.settings },
      blocks: [],
    });
  }

  // A layout change never deletes tenant-authored or legacy sections. Content
  // outside the chosen recipe is retained just before the footer.
  const extras = remaining.filter((entry) => !entry.used).map((entry) => entry.section);
  const footerIndex = arranged.findIndex((section) => resolveSectionType(section.type) === "footer_nav");
  if (footerIndex === -1) arranged.push(...extras);
  else arranged.splice(footerIndex, 0, ...extras);

  return { ...styled, sections: arranged };
}
