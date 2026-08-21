// =============================================================================
// CURATED THEME FAMILIES — 7 Strong Families Mapped to Existing 16 Presets
// Preserves all 16 preset IDs for compatibility; UI presents curated choices
// =============================================================================

import { THEME_PRESETS } from "./theme-presets";

export interface CuratedThemeFamily {
  id: string;
  name: string;
  tagline: string;
  preview: string;
  // Maps to existing preset IDs
  presetIds: string[];
  // The primary preset to use when applying this family
  primaryPresetId: string;
}

// 7 Curated families for tenant-facing choices
export const CURATED_THEME_FAMILIES: CuratedThemeFamily[] = [
  {
    id: "minimal",
    name: "Minimal",
    tagline: "Clean, spacious, content-first",
    preview: "◻️",
    presetIds: ["neomodern", "luxury"],
    primaryPresetId: "neomodern",
  },
  {
    id: "editorial",
    name: "Editorial",
    tagline: "Storytelling, magazine-like, literary",
    preview: "📖",
    presetIds: ["editorial", "liquid_sensory"],
    primaryPresetId: "editorial",
  },
  {
    id: "modern",
    name: "Modern",
    tagline: "Sleek, contemporary, bold statements",
    preview: "🎨",
    presetIds: ["roastr_official", "neo_tokyo_cyber", "tactile_brutalist"],
    primaryPresetId: "roastr_official",
  },
  {
    id: "heritage",
    name: "Heritage",
    tagline: "Traditional, warm, artisanal",
    preview: "🏺",
    presetIds: ["heritage", "heritage_reserve", "nordic_botanical"],
    primaryPresetId: "heritage",
  },
  {
    id: "bold",
    name: "Bold",
    tagline: "High-contrast, energetic, impactful",
    preview: "⚡",
    presetIds: ["industrial", "cyber", "playful"],
    primaryPresetId: "industrial",
  },
  {
    id: "dark",
    name: "Dark",
    tagline: "OLED-ready, sophisticated, premium",
    preview: "🌑",
    presetIds: ["luxury", "neo_tokyo_cyber", "liquid_sensory", "heritage_reserve"],
    primaryPresetId: "luxury",
  },
  {
    id: "boutique",
    name: "Boutique",
    tagline: "Inviting, community-focused, warm",
    preview: "☕",
    presetIds: ["club", "botanical", "liquid"],
    primaryPresetId: "club",
  },
];

// Helper: get all valid preset IDs from the registry
export function getAllPresetIds(): string[] {
  return THEME_PRESETS.map((p) => p.id);
}

// Helper: get preset by ID (for compatibility layer)
export function getPresetById(presetId: string) {
  return THEME_PRESETS.find((p) => p.id === presetId);
}

// Helper: get curated family by ID
export function getCuratedFamilyById(familyId: string): CuratedThemeFamily | undefined {
  return CURATED_THEME_FAMILIES.find((f) => f.id === familyId);
}

// Helper: get primary preset for a curated family
export function getPrimaryPresetForFamily(familyId: string) {
  const family = getCuratedFamilyById(familyId);
  if (!family) return null;
  return getPresetById(family.primaryPresetId);
}

// Verify all preset IDs in curated families exist in THEME_PRESETS
export function validateCuratedFamilies(): { valid: boolean; errors: string[] } {
  const allPresetIds = new Set(getAllPresetIds());
  const errors: string[] = [];

  for (const family of CURATED_THEME_FAMILIES) {
    if (!allPresetIds.has(family.primaryPresetId)) {
      errors.push(`Family "${family.id}" references unknown primary preset "${family.primaryPresetId}"`);
    }
    for (const presetId of family.presetIds) {
      if (!allPresetIds.has(presetId)) {
        errors.push(`Family "${family.id}" references unknown preset "${presetId}"`);
      }
    }
  }

  return { valid: errors.length === 0, errors };
}