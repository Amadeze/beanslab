// =============================================================================
// THEME RESOLVER — Resolves which config to use based on mode and availability
// =============================================================================

import type { PortalThemeConfig } from "./types";
import { DEFAULT_PORTAL_THEME_CONFIG } from "./defaults/default-config";
import { convertLegacyTenantToThemeConfig } from "./migrations/legacy-converter";
import { sanitizeCSS } from "./server/css-sanitizer";
import { TypographySchema } from "./schemas";

interface ResolverInput {
  portalTheme: {
    draftConfig: unknown;
    publishedConfig: unknown;
  } | null;
  legacyTenantFields: Record<string, unknown>;
  mode: "public" | "customizer";
}

function parseConfig(value: unknown): PortalThemeConfig | null {
  if (!value || typeof value !== "object") return null;
  try {
    return value as PortalThemeConfig;
  } catch {
    return null;
  }
}

function sanitizeConfig(config: PortalThemeConfig, mode: "public" | "customizer"): PortalThemeConfig {
  const result = structuredClone(config);
  
  if (result.globalSettings?.typography) {
    const typography = result.globalSettings.typography;
    if (typography.headingFont && !/^[a-zA-Z0-9\s\-_]+$/.test(typography.headingFont)) {
      typography.headingFont = "DM Sans";
    }
    if (typography.bodyFont && !/^[a-zA-Z0-9\s\-_]+$/.test(typography.bodyFont)) {
      typography.bodyFont = "DM Sans";
    }
  }
  
  if (result.globalSettings?.animations) {
    const anim = result.globalSettings.animations;
    if (anim.globalEasing && !/^(linear|ease|ease-in|ease-out|ease-in-out|steps\(\d+(?:\,\s*(?:start|end))?\)|cubic-bezier\(\s*(?:0|1|0?\.\d+)\s*,\s*-?\d+(?:\.\d+)?\s*,\s*(?:0|1|0?\.\d+)\s*,\s*-?\d+(?:\.\d+)?\s*\))$/.test(anim.globalEasing)) {
      anim.globalEasing = "cubic-bezier(0.22, 1, 0.36, 1)";
    }
  }
  
  if (mode === "public" && result.globalSettings?.integrations) {
    delete result.globalSettings.integrations.customHead;
    delete result.globalSettings.integrations.customFooter;
  }
  
  if (result.sections) {
    for (const section of result.sections) {
      if (section.customCSS?.css) {
        const sanitized = sanitizeCSS(section.customCSS.css);
        if (sanitized.ok) {
          section.customCSS.css = sanitized.css;
        } else {
          delete section.customCSS;
        }
      }
    }
  }
  
  return result;
}

/**
 * Resolves the portal theme config with fallback chain:
 *
 * Public mode:
 *   1. publishedConfig
 *   2. legacy conversion
 *   3. system default
 *
 * Customizer mode:
 *   1. draftConfig
 *   2. publishedConfig
 *   3. legacy conversion
 *   4. system default
 */
export function resolveTenantPortalTheme({
  portalTheme,
  legacyTenantFields,
  mode,
}: ResolverInput): PortalThemeConfig {
  if (mode === "customizer") {
    const draft = portalTheme ? parseConfig(portalTheme.draftConfig) : null;
    if (draft) return sanitizeConfig(draft, mode);
  }

  const published = portalTheme
    ? parseConfig(portalTheme.publishedConfig)
    : null;
  if (published) return sanitizeConfig(published, mode);

  const legacy = convertLegacyTenantToThemeConfig(legacyTenantFields);
  if (legacy.sections.length > 0) return sanitizeConfig(legacy, mode);

  return structuredClone(DEFAULT_PORTAL_THEME_CONFIG);
}
