// Six storefront directions. The legacy preset registry remains untouched so
// previously persisted preset IDs and theme JSON stay compatible.

import { THEME_PRESETS } from "./theme-presets";

export interface ThemeSectionRecipe {
  type: string;
  settings?: Record<string, unknown>;
  optional?: boolean;
}

export interface CuratedThemeFamily {
  id: string;
  name: string;
  tagline: string;
  signature: string;
  preview: string;
  presetIds: string[];
  primaryPresetId: string;
  sectionRecipe: ThemeSectionRecipe[];
}

export const CURATED_THEME_FAMILIES: CuratedThemeFamily[] = [
  {
    id: "modern_catalog",
    name: "Modern Catalog",
    tagline: "Belanja cepat dengan produk sebagai fokus utama",
    signature: "Hero terbagi + indeks produk yang rapi",
    preview: "MC",
    presetIds: ["neomodern", "roastr_official"],
    primaryPresetId: "neomodern",
    sectionRecipe: [
      { type: "header_nav", settings: { styleMode: "glass_pill" } },
      { type: "hero_banner", settings: { styleMode: "catalog_split", textAlignment: "left" } },
      { type: "catalog_grid", settings: { styleMode: "clean_grid", columns: 3 } },
      { type: "featured_collection", optional: true },
      { type: "faq", optional: true },
      { type: "contact_cta", optional: true },
      { type: "footer_nav", settings: { styleMode: "minimal_centered" } },
    ],
  },
  {
    id: "editorial_journal",
    name: "Editorial Journal",
    tagline: "Cerita roastery terasa seperti jurnal independen",
    signature: "Masthead besar + katalog bergaya daftar",
    preview: "EJ",
    presetIds: ["editorial", "liquid_sensory"],
    primaryPresetId: "editorial",
    sectionRecipe: [
      { type: "header_nav", settings: { styleMode: "luxury_editorial" } },
      { type: "hero_banner", settings: { styleMode: "editorial_masthead", textAlignment: "left" } },
      { type: "image_with_text", optional: true },
      { type: "rich_text", optional: true },
      { type: "catalog_grid", settings: { styleMode: "editorial_list", columns: 2 } },
      { type: "testimonials", optional: true },
      { type: "footer_nav", settings: { styleMode: "editorial_grid" } },
    ],
  },
  {
    id: "origin_field_notes",
    name: "Origin Field Notes",
    tagline: "Asal, proses, dan profil kopi mudah dipindai",
    signature: "Catatan lapangan + kartu traceability",
    preview: "OF",
    presetIds: ["nordic_botanical", "botanical"],
    primaryPresetId: "nordic_botanical",
    sectionRecipe: [
      { type: "header_nav", settings: { styleMode: "glass_pill" } },
      { type: "hero_banner", settings: { styleMode: "field_notes", textAlignment: "left" } },
      { type: "image_with_text", optional: true },
      { type: "gallery", optional: true },
      { type: "catalog_grid", settings: { styleMode: "field_cards", columns: 3 } },
      { type: "faq", optional: true },
      { type: "footer_nav", settings: { styleMode: "minimal_centered" } },
    ],
  },
  {
    id: "tactile_brutalist",
    name: "Tactile Brutalist",
    tagline: "Tegas, fisik, dan berkarakter untuk roastery eksperimental",
    signature: "Poster hero + grid berbingkai keras",
    preview: "TB",
    presetIds: ["tactile_brutalist", "industrial"],
    primaryPresetId: "tactile_brutalist",
    sectionRecipe: [
      { type: "header_nav", settings: { styleMode: "industrial_ticker" } },
      { type: "hero_banner", settings: { styleMode: "brutalist_poster", textAlignment: "left" } },
      { type: "marquee_kinetic", optional: true },
      { type: "catalog_grid", settings: { styleMode: "brutalist_grid", columns: 3 } },
      { type: "bento_showcase", optional: true },
      { type: "contact_cta", optional: true },
      { type: "footer_nav", settings: { styleMode: "brutalist_mono" } },
    ],
  },
  {
    id: "reserve_microlot",
    name: "Reserve Microlot",
    tagline: "Tenang dan premium untuk rilis kopi terbatas",
    signature: "Hero berbingkai + galeri rilis terpilih",
    preview: "RM",
    presetIds: ["luxury", "heritage_reserve"],
    primaryPresetId: "luxury",
    sectionRecipe: [
      { type: "header_nav", settings: { styleMode: "luxury_editorial" } },
      { type: "hero_banner", settings: { styleMode: "reserve_frame", textAlignment: "center" } },
      { type: "product_highlight", optional: true },
      { type: "featured_collection", optional: true },
      { type: "catalog_grid", settings: { styleMode: "reserve_gallery", columns: 2 } },
      { type: "rich_text", optional: true },
      { type: "footer_nav", settings: { styleMode: "editorial_grid" } },
    ],
  },
  {
    id: "community_roastery",
    name: "Community Roastery",
    tagline: "Hangat, sosial, dan mudah didekati pelanggan lokal",
    signature: "Papan komunitas + kartu modular yang ramah",
    preview: "CR",
    presetIds: ["club", "playful"],
    primaryPresetId: "club",
    sectionRecipe: [
      { type: "header_nav", settings: { styleMode: "glass_pill" } },
      { type: "hero_banner", settings: { styleMode: "community_board", textAlignment: "left" } },
      { type: "bento_showcase", optional: true },
      { type: "catalog_grid", settings: { styleMode: "community_cards", columns: 3 } },
      { type: "gallery", optional: true },
      { type: "testimonials", optional: true },
      { type: "contact_cta", optional: true },
      { type: "footer_nav", settings: { styleMode: "minimal_centered" } },
    ],
  },
];

export function getAllPresetIds(): string[] {
  return THEME_PRESETS.map((preset) => preset.id);
}

export function getPresetById(presetId: string) {
  return THEME_PRESETS.find((preset) => preset.id === presetId);
}

export function getCuratedFamilyById(familyId: string) {
  return CURATED_THEME_FAMILIES.find((family) => family.id === familyId);
}

export function getPrimaryPresetForFamily(familyId: string) {
  const family = getCuratedFamilyById(familyId);
  return family ? getPresetById(family.primaryPresetId) ?? null : null;
}

export function validateCuratedFamilies(): { valid: boolean; errors: string[] } {
  const presetIds = new Set(getAllPresetIds());
  const errors: string[] = [];
  for (const family of CURATED_THEME_FAMILIES) {
    if (!presetIds.has(family.primaryPresetId)) errors.push(`Family "${family.id}" references unknown primary preset "${family.primaryPresetId}"`);
    for (const presetId of family.presetIds) {
      if (!presetIds.has(presetId)) errors.push(`Family "${family.id}" references unknown preset "${presetId}"`);
    }
  }
  return { valid: errors.length === 0, errors };
}
