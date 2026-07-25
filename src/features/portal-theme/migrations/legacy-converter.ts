// =============================================================================
// LEGACY CONVERTER — Maps old Tenant fields to PortalThemeConfig
// =============================================================================

import type { PortalThemeConfig } from "../types";
import { DEFAULT_PORTAL_THEME_CONFIG } from "../defaults/default-config";

interface LegacyTenantFields {
  themeColor?: string | null;
  heroImageUrl?: string | null;
  heroText?: string | null;
  backgroundImageUrl?: string | null;
  aboutText?: string | null;
  catalogTitle?: string | null;
  catalogSubtitle?: string | null;
  footerText?: string | null;
  logoUrl?: string | null;
  layoutStyle?: string | null;
  fontFamily?: string | null;
  themeMode?: string | null;
  borderRadius?: string | null;
  animationStyle?: string | null;
  animationDirection?: string | null;
  iconStyle?: string | null;
  themeConfig?: unknown;
  problemStatement?: string | null;
  solutionStatement?: string | null;
  uspText?: string | null;
  features?: unknown;
  testimonials?: unknown;
  faqs?: unknown;
  whatsappNumber?: string | null;
  contactEmail?: string | null;
  instagramHandle?: string | null;
  name?: string;
}

const THEME_COLOR_MAP: Record<string, string> = {
  amber: "#B65331",
  blue: "#426C7A",
  emerald: "#2B7567",
  rose: "#8C2F39",
  violet: "#6F4A6A",
  zinc: "#4B5152",
};

const FONT_MAP: Record<string, { heading: string; body: string }> = {
  sans: { heading: "Inter", body: "Inter" },
  serif: { heading: "Playfair Display", body: "Playfair Display" },
  mono: { heading: "JetBrains Mono", body: "JetBrains Mono" },
};

const BORDER_RADIUS_MAP: Record<string, number> = {
  none: 0,
  sm: 4,
  md: 8,
  xl: 12,
  full: 999,
};

export function convertLegacyTenantToThemeConfig(
  tenant: LegacyTenantFields,
): PortalThemeConfig {
  const base = structuredClone(DEFAULT_PORTAL_THEME_CONFIG);

  // ── Colors ──────────────────────────────────────────────────────────────
  if (tenant.themeColor && THEME_COLOR_MAP[tenant.themeColor]) {
    base.globalSettings.colors.primary = THEME_COLOR_MAP[tenant.themeColor];
    base.globalSettings.colors.accent = THEME_COLOR_MAP[tenant.themeColor];
  }

  if (tenant.themeMode === "dark") {
    base.globalSettings.activeVariant = "dark";
  }

  // ── Typography ──────────────────────────────────────────────────────────
  if (tenant.fontFamily && FONT_MAP[tenant.fontFamily]) {
    base.globalSettings.typography.headingFont =
      FONT_MAP[tenant.fontFamily].heading;
    base.globalSettings.typography.bodyFont =
      FONT_MAP[tenant.fontFamily].body;
  }

  // ── Layout ──────────────────────────────────────────────────────────────
  if (tenant.borderRadius && BORDER_RADIUS_MAP[tenant.borderRadius] !== undefined) {
    base.globalSettings.layout.borderRadius =
      BORDER_RADIUS_MAP[tenant.borderRadius];
  }

  // ── Brand Kit ───────────────────────────────────────────────────────────
  if (tenant.logoUrl) {
    base.globalSettings.brandKit.logoLight = tenant.logoUrl;
  }

  // ── Hero Banner Section ─────────────────────────────────────────────────
  const heroSection = base.sections.find((s) => s.type === "hero_banner");
  if (heroSection) {
    if (tenant.heroText) heroSection.settings.title = tenant.heroText;
    if (tenant.heroImageUrl) heroSection.settings.imageUrl = tenant.heroImageUrl;
    if (tenant.backgroundImageUrl) {
      heroSection.settings.imageUrl =
        heroSection.settings.imageUrl || tenant.backgroundImageUrl;
    }
  }

  // ── Catalog Grid Section ────────────────────────────────────────────────
  const catalogSection = base.sections.find((s) => s.type === "catalog_grid");
  if (catalogSection) {
    if (tenant.catalogTitle) catalogSection.settings.title = tenant.catalogTitle;
    if (tenant.catalogSubtitle) catalogSection.settings.subtitle = tenant.catalogSubtitle;
  }

  // ── Rich Text Section (About) ───────────────────────────────────────────
  if (tenant.aboutText) {
    base.sections.splice(1, 0, {
      id: `sec_about_legacy`,
      type: "rich_text",
      enabled: true,
      settings: {
        title: "About Us",
        content: tenant.aboutText,
        alignment: "left",
        columns: 1,
      },
      blocks: [],
    });
  }

  // ── Benefits Section (from features) ────────────────────────────────────
  if (Array.isArray(tenant.features) && tenant.features.length > 0) {
    const benefitBlocks = tenant.features
      .filter((f: any) => f.title?.trim())
      .map((f: any, i: number) => ({
        id: `blk_feat_${i}`,
        type: "benefit",
        settings: {
          icon: f.iconName || "Star",
          title: f.title,
          description: f.desc || "",
        },
        visible: true,
      }));

    if (benefitBlocks.length > 0) {
      base.sections.push({
        id: "sec_benefits_legacy",
        type: "benefits",
        enabled: true,
        settings: { columns: 3, iconStyle: "outline" },
        blocks: benefitBlocks,
      });
    }
  }

  // ── Testimonials Section ────────────────────────────────────────────────
  if (Array.isArray(tenant.testimonials) && tenant.testimonials.length > 0) {
    const testimonialBlocks = tenant.testimonials
      .filter((t: any) => t.name?.trim() && t.text?.trim())
      .map((t: any, i: number) => ({
        id: `blk_test_${i}`,
        type: "testimonial",
        settings: {
          name: t.name,
          role: t.role || "",
          text: t.text,
          rating: t.rating || 5,
          avatar: null,
        },
        visible: true,
      }));

    if (testimonialBlocks.length > 0) {
      base.sections.push({
        id: "sec_testimonials_legacy",
        type: "testimonials",
        enabled: true,
        settings: { layout: "carousel", columns: 3, showRating: true },
        blocks: testimonialBlocks,
      });
    }
  }

  // ── FAQ Section ─────────────────────────────────────────────────────────
  if (Array.isArray(tenant.faqs) && tenant.faqs.length > 0) {
    const faqBlocks = tenant.faqs
      .filter((f: any) => f.question?.trim() && f.answer?.trim())
      .map((f: any, i: number) => ({
        id: `blk_faq_${i}`,
        type: "question",
        settings: { question: f.question, answer: f.answer },
        visible: true,
      }));

    if (faqBlocks.length > 0) {
      base.sections.push({
        id: "sec_faq_legacy",
        type: "faq",
        enabled: true,
        settings: { title: "Frequently Asked Questions", layout: "accordion", allowSearch: false },
        blocks: faqBlocks,
      });
    }
  }

  // ── Contact CTA Section ─────────────────────────────────────────────────
  if (tenant.whatsappNumber || tenant.contactEmail || tenant.instagramHandle) {
    base.sections.push({
      id: "sec_contact_legacy",
      type: "contact_cta",
      enabled: true,
      settings: {
        title: "Get in Touch",
        text: "Ready to place an order? Contact us directly.",
        buttonText: "Contact Us",
        buttonLink: "",
        showPhone: !!tenant.whatsappNumber,
        showEmail: !!tenant.contactEmail,
        showWhatsApp: !!tenant.whatsappNumber,
      },
      blocks: [],
    });
  }

  // ── Apply themeConfig overrides if present ──────────────────────────────
  if (tenant.themeConfig && typeof tenant.themeConfig === "object") {
    try {
      const overrides = tenant.themeConfig as Record<string, unknown>;
      if (overrides.colors && typeof overrides.colors === "object") {
        Object.assign(base.globalSettings.colors, overrides.colors);
      }
      if (overrides.typography && typeof overrides.typography === "object") {
        Object.assign(base.globalSettings.typography, overrides.typography);
      }
    } catch {
      // Ignore malformed themeConfig overrides
    }
  }

  return base;
}
