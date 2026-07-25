// =============================================================================
// THEME RESOLVER — Resolves which config to use based on mode and availability
// =============================================================================

import type { PortalThemeConfig } from "./types";
import { DEFAULT_PORTAL_THEME_CONFIG } from "./defaults/default-config";
import { convertLegacyTenantToThemeConfig } from "./migrations/legacy-converter";

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
    if (draft) return draft;
  }

  const published = portalTheme
    ? parseConfig(portalTheme.publishedConfig)
    : null;
  if (published) return published;

  const legacy = convertLegacyTenantToThemeConfig(legacyTenantFields);
  if (legacy.sections.length > 0) return legacy;

  return structuredClone(DEFAULT_PORTAL_THEME_CONFIG);
}
