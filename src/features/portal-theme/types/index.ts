// =============================================================================
// PORTAL THEME TYPES — Block-Based Theme Customizer
// Beyond Shopify: 12+ color tokens, per-section styling, gradient builder,
// theme variants, custom CSS, conditional display, block-based content.
// =============================================================================

// ── Color System (12+ tokens) ───────────────────────────────────────────────
export interface PortalColorTokens {
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  surface: string;
  surfaceAlt: string;
  text: string;
  textMuted: string;
  textInverse: string;
  border: string;
  borderSubtle: string;
  error: string;
  success: string;
  warning: string;
  info: string;
}

// ── Gradient Builder ────────────────────────────────────────────────────────
export interface PortalGradient {
  type: "linear" | "radial" | "conic";
  angle: number;
  stops: Array<{ color: string; position: number }>;
}

// ── Typography (global, overridable per-section) ────────────────────────────
export interface PortalTypography {
  headingFont: string;
  bodyFont: string;
  baseFontSize: number;
  scaleRatio: number;
  lineHeight: number;
  letterSpacing: number;
  headingWeight: number;
  bodyWeight: number;
  textTransform: "none" | "uppercase" | "lowercase" | "capitalize";
}

// ── Per-Section Typography Override ─────────────────────────────────────────
export interface SectionTypographyOverride {
  font?: string;
  fontSize?: number;
  fontWeight?: number;
  lineHeight?: number;
  letterSpacing?: number;
  textTransform?: "none" | "uppercase" | "lowercase" | "capitalize";
  color?: string;
}

// ── Per-Section Spacing ─────────────────────────────────────────────────────
export interface SectionSpacing {
  paddingTop: number;
  paddingRight: number;
  paddingBottom: number;
  paddingLeft: number;
  marginTop: number;
  marginBottom: number;
}

// ── Per-Section Background ──────────────────────────────────────────────────
export interface SectionBackground {
  type: "color" | "image" | "gradient" | "video";
  color?: string;
  imageUrl?: string;
  imagePosition?: string;
  imageSize?: string;
  imageRepeat?: string;
  gradient?: PortalGradient;
  videoUrl?: string;
  opacity?: number;
  overlayColor?: string;
  overlayOpacity?: number;
  // Texture Alchemy & Surface properties
  textureType?: "none" | "grain" | "mesh" | "glass" | "dots" | "grid";
  textureOpacity?: number;
  backdropBlur?: "none" | "sm" | "md" | "lg" | "xl";
  borderGlow?: boolean;
}

// ── Per-Section Border & Shadow ─────────────────────────────────────────────
export interface SectionDecoration {
  borderRadius: number;
  borderWidth: number;
  borderColor: string;
  borderStyle: "none" | "solid" | "dashed" | "dotted";
  shadow: "none" | "sm" | "md" | "lg" | "xl" | "custom";
  customShadow?: string;
}

// ── Responsive Visibility ───────────────────────────────────────────────────
export interface ResponsiveVisibility {
  desktop: boolean;
  tablet: boolean;
  mobile: boolean;
}

// ── Per-Section Animation ───────────────────────────────────────────────────
export interface SectionAnimation {
  scrollTrigger:
    | "none"
    | "fade-in"
    | "slide-up"
    | "slide-down"
    | "slide-left"
    | "slide-right"
    | "scale-up"
    | "blur-in"
    | "parallax-slow"
    | "parallax-fast"
    | "kinetic-text";
  duration: number;
  delay: number;
  easing: string;
  hoverEffect: "none" | "scale" | "lift" | "glow" | "shrink" | "border-beam" | "liquid";
  kineticSpeed?: number;
}

// ── Section Layout ──────────────────────────────────────────────────────────
export interface SectionLayout {
  width: "full" | "wide" | "normal" | "narrow" | "custom";
  customWidth?: number;
  maxWidth?: number;
  alignment: "left" | "center" | "right";
  verticalAlign: "top" | "center" | "bottom";
  columns: number;
  columnGap: number;
  // Bento Grid & Asymmetrical Layout properties
  layoutMode?: "grid" | "bento" | "masonry" | "asymmetric" | "split" | "carousel";
  bentoSpans?: Record<string, { colSpan: number; rowSpan: number }>;
  gapStyle?: "none" | "tight" | "normal" | "relaxed" | "loose";
}

// ── Custom CSS (sandboxed) ──────────────────────────────────────────────────
export interface SectionCustomCSS {
  css: string;
}

// ── Conditional Display ─────────────────────────────────────────────────────
export interface ConditionalDisplayRule {
  type: "device" | "time" | "url_param" | "customer_tag";
  device?: "desktop" | "tablet" | "mobile";
  timeStart?: string;
  timeEnd?: string;
  paramName?: string;
  paramValue?: string;
  customerTag?: string;
}

export interface ConditionalDisplay {
  enabled: boolean;
  rules: ConditionalDisplayRule[];
}

// ── Block (child content within a section) ──────────────────────────────────
export interface PortalBlock {
  id: string;
  type: string;
  settings: Record<string, unknown>;
  visible: boolean;
  colSpan?: number;
  rowSpan?: number;
  customCSS?: SectionCustomCSS;
}

// ── Full Section ────────────────────────────────────────────────────────────
export interface PortalSection {
  id: string;
  type: string;
  enabled: boolean;
  settings: Record<string, unknown>;
  blocks: PortalBlock[];
  typography?: SectionTypographyOverride;
  spacing?: SectionSpacing;
  background?: SectionBackground;
  decoration?: SectionDecoration;
  visibility?: ResponsiveVisibility;
  animation?: SectionAnimation;
  layout?: SectionLayout;
  customCSS?: SectionCustomCSS;
  conditionalDisplay?: ConditionalDisplay;
}

// ── Theme Variant ───────────────────────────────────────────────────────────
export interface ThemeVariant {
  id: string;
  name: string;
  isDefault: boolean;
  autoSwitch: boolean;
  colors: Partial<PortalColorTokens>;
  typography?: Partial<PortalTypography>;
}

// ── Brand Kit ───────────────────────────────────────────────────────────────
export interface BrandKit {
  logoLight?: string;
  logoDark?: string;
  logoMobile?: string;
  favicon?: string;
  socialImage?: string;
  brandColors: string[];
  instagramHandle?: string;
}

// ── Global Settings ─────────────────────────────────────────────────────────
export interface PortalGlobalSettings {
  colors: PortalColorTokens;
  typography: PortalTypography;
  layout: {
    contentWidth: number;
    sectionGap: number;
    pagePadding: number;
    borderRadius: number;
  };
  variants: ThemeVariant[];
  activeVariant: string;
  brandKit: BrandKit;
  animations: {
    globalDuration: number;
    globalEasing: string;
    scrollAnimations: boolean;
    hoverEffects: boolean;
    reduceMotion: boolean;
  };
  seo: {
    lazyLoadImages: boolean;
    preloadCritical: boolean;
    structuredData: boolean;
  };
  integrations: {
    googleAnalyticsId?: string;
    metaPixelId?: string;
    customHead?: string;
    customFooter?: string;
  };
}

// ── Full Theme Config ───────────────────────────────────────────────────────
export interface PortalThemeConfig {
  schemaVersion: number;
  themeKey: string;
  globalSettings: PortalGlobalSettings;
  sections: PortalSection[];
}

// ── postMessage Envelope ────────────────────────────────────────────────────
export interface PortalCustomizerMessage {
  source: "portal-customizer";
  version: 1;
  type: "THEME_PREVIEW_UPDATE";
  tenantId: string;
  payload: { config: PortalThemeConfig };
}

// ── Section Registry Definition ─────────────────────────────────────────────
export interface PortalSectionDefinition {
  type: string;
  label: string;
  description: string;
  icon: string;
  category: "content" | "commerce" | "marketing" | "layout";
  area: PortalSectionArea;
  status: "core" | "optional" | "legacy";
  addable: boolean;
  aliases?: readonly string[];
  requires?: readonly PortalSectionCapability[];
  defaultSettings: Record<string, unknown>;
  blockTypes?: Array<{
    type: string;
    label: string;
    defaultSettings: Record<string, unknown>;
  }>;
}

export type PortalSectionArea =
  | "header"
  | "beranda"
  | "katalog"
  | "konten"
  | "footer";

export type PortalSectionCapability =
  | "storefront_products"
  | "newsletter_subscriber_backend"
  | "product_flavor_metadata"
  | "wholesale_pricing_profiles";

// ── Section Type Union ──────────────────────────────────────────────────────
export type PortalSectionType =
  | "hero_banner"
  | "rich_text"
  | "image_with_text"
  | "gallery"
  | "video_embed"
  | "catalog_grid"
  | "featured_collection"
  | "product_highlight"
  | "benefits"
  | "testimonials"
  | "countdown"
  | "social_proof"
  | "newsletter"
  | "contact_cta"
  | "faq"
  // Unlimited Creation Sections
  | "bento_showcase"
  | "interactive_flavor"
  | "sticky_narrative"
  | "roast_matrix"
  | "marquee_kinetic"
  | "header_nav"
  | "footer_nav"
  // New sections for roastery storytelling
  | "awards_strip"
  | "brand_timeline"
  | "sustainability";
