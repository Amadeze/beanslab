// =============================================================================
// PORTAL THEME SCHEMAS — Zod validation for every level of config
// =============================================================================

import { z } from "zod";

// ── Helpers ─────────────────────────────────────────────────────────────────

const hexColor = z
  .string()
  .regex(
    /^(?:#[0-9A-Fa-f]{6}|rgba?\(\s*(?:\d{1,3}\s*,\s*){2}\d{1,3}(?:\s*,\s*(?:0|1|0?\.\d+))?\s*\))$/,
    "Must be a valid hex, rgb, or rgba color",
  );

const sanitizedUrl = z
  .string()
  .max(2048)
  .refine(
    (v) =>
      v === "" ||
      v.startsWith("/") ||
      (v.startsWith("http://") && !v.includes("javascript:")) ||
      (v.startsWith("https://") && !v.includes("javascript:")),
    "Invalid URL scheme",
  )
  .optional();

const safeText = (max: number) =>
  z.string().trim().max(max).optional();

const safeCss = z
  .string()
  .max(2000)
  .refine(
    (v) =>
      !v.includes("<script") &&
      !v.includes("javascript:") &&
      !v.includes("expression(") &&
      !v.includes("on" + "load") &&
      !v.includes("on" + "error"),
    "CSS contains unsafe patterns",
  )
  .optional()
  .default("");

const safeHtml = z
  .string()
  .max(5000)
  .refine(
    (v) =>
      !v.includes("<script") &&
      !v.includes("<iframe") &&
      !v.includes("javascript:"),
    "HTML contains unsafe elements",
  )
  .optional()
  .default("");

// ── Color Tokens ────────────────────────────────────────────────────────────

export const ColorTokensSchema = z.object({
  primary: hexColor,
  secondary: hexColor,
  accent: hexColor,
  background: hexColor,
  surface: hexColor,
  surfaceAlt: hexColor,
  text: hexColor,
  textMuted: hexColor,
  textInverse: hexColor,
  border: hexColor,
  borderSubtle: hexColor,
  error: hexColor,
  success: hexColor,
  warning: hexColor,
  info: hexColor,
});

// ── Gradient ────────────────────────────────────────────────────────────────

export const GradientSchema = z.object({
  type: z.enum(["linear", "radial", "conic"]),
  angle: z.number().min(0).max(360),
  stops: z
    .array(
      z.object({
        color: hexColor,
        position: z.number().min(0).max(100),
      }),
    )
    .min(2)
    .max(10),
});

// ── Typography ──────────────────────────────────────────────────────────────

export const TypographySchema = z.object({
  headingFont: z.string().min(1).max(60),
  bodyFont: z.string().min(1).max(60),
  baseFontSize: z.number().min(10).max(100),
  scaleRatio: z.number().min(0.8).max(2.0),
  lineHeight: z.number().min(0.8).max(3.0),
  letterSpacing: z.number().min(-0.1).max(0.5),
  headingWeight: z.number().min(100).max(900),
  bodyWeight: z.number().min(100).max(900),
  textTransform: z.enum(["none", "uppercase", "lowercase", "capitalize"]),
});

export const SectionTypographyOverrideSchema = z.object({
  font: z.string().max(60).optional(),
  fontSize: z.number().min(10).max(100).optional(),
  fontWeight: z.number().min(100).max(900).optional(),
  lineHeight: z.number().min(0.8).max(3.0).optional(),
  letterSpacing: z.number().min(-0.1).max(0.5).optional(),
  textTransform: z.enum(["none", "uppercase", "lowercase", "capitalize"]).optional(),
  color: hexColor.optional(),
});

// ── Spacing ─────────────────────────────────────────────────────────────────

export const SpacingSchema = z.object({
  paddingTop: z.number().min(0).max(500),
  paddingRight: z.number().min(0).max(500),
  paddingBottom: z.number().min(0).max(500),
  paddingLeft: z.number().min(0).max(500),
  marginTop: z.number().min(-200).max(500),
  marginBottom: z.number().min(-200).max(500),
});

// ── Background ──────────────────────────────────────────────────────────────

export const BackgroundSchema = z.object({
  type: z.enum(["color", "image", "gradient", "video"]),
  color: hexColor.optional(),
  imageUrl: sanitizedUrl,
  imagePosition: z.string().max(40).optional().default("center"),
  imageSize: z.enum(["cover", "contain", "auto"]).optional().default("cover"),
  imageRepeat: z.enum(["no-repeat", "repeat", "repeat-x", "repeat-y"]).optional().default("no-repeat"),
  gradient: GradientSchema.optional(),
  videoUrl: sanitizedUrl,
  opacity: z.number().min(0).max(100).optional().default(100),
  overlayColor: hexColor.optional(),
  overlayOpacity: z.number().min(0).max(100).optional().default(50),
  textureType: z.enum(["none", "grain", "mesh", "glass", "dots", "grid"]).optional().default("none"),
  textureOpacity: z.number().min(0).max(100).optional().default(10),
  backdropBlur: z.enum(["none", "sm", "md", "lg", "xl"]).optional().default("none"),
  borderGlow: z.boolean().optional().default(false),
});

// ── Decoration ──────────────────────────────────────────────────────────────

export const DecorationSchema = z.object({
  borderRadius: z.number().min(0).max(100),
  borderWidth: z.number().min(0).max(20),
  borderColor: hexColor,
  borderStyle: z.enum(["none", "solid", "dashed", "dotted"]),
  shadow: z.enum(["none", "sm", "md", "lg", "xl", "custom"]),
  customShadow: z.string().max(200).optional(),
});

// ── Responsive Visibility ───────────────────────────────────────────────────

export const ResponsiveVisibilitySchema = z.object({
  desktop: z.boolean(),
  tablet: z.boolean(),
  mobile: z.boolean(),
});

// ── Animation ───────────────────────────────────────────────────────────────

export const AnimationSchema = z.object({
  scrollTrigger: z.enum([
    "none", "fade-in", "slide-up", "slide-down",
    "slide-left", "slide-right", "scale-up", "blur-in",
    "parallax-slow", "parallax-fast", "kinetic-text",
  ]),
  duration: z.number().min(0).max(5000),
  delay: z.number().min(0).max(3000),
  easing: z.string().max(100),
  hoverEffect: z.enum(["none", "scale", "lift", "glow", "shrink", "border-beam", "liquid"]),
  kineticSpeed: z.number().min(0).max(10).optional().default(1),
});

// ── Layout ──────────────────────────────────────────────────────────────────

export const LayoutSchema = z.object({
  width: z.enum(["full", "wide", "normal", "narrow", "custom"]),
  customWidth: z.number().min(200).max(2000).optional(),
  maxWidth: z.number().min(400).max(2000).optional(),
  alignment: z.enum(["left", "center", "right"]),
  verticalAlign: z.enum(["top", "center", "bottom"]),
  columns: z.number().min(1).max(6),
  columnGap: z.number().min(0).max(100),
  layoutMode: z.enum(["grid", "bento", "masonry", "asymmetric", "split", "carousel"]).optional().default("grid"),
  bentoSpans: z.record(z.string(), z.object({ colSpan: z.number().min(1).max(4), rowSpan: z.number().min(1).max(4) })).optional(),
  gapStyle: z.enum(["none", "tight", "normal", "relaxed", "loose"]).optional().default("normal"),
});

// ── Block ───────────────────────────────────────────────────────────────────

export const BlockSchema = z.object({
  id: z.string().min(1),
  type: z.string().min(1).max(50),
  settings: z.record(z.string(), z.unknown()),
  visible: z.boolean(),
  colSpan: z.number().min(1).max(4).optional().default(1),
  rowSpan: z.number().min(1).max(4).optional().default(1),
  customCSS: z
    .object({ css: safeCss })
    .optional(),
});

// ── Conditional Display ─────────────────────────────────────────────────────

export const ConditionalDisplayRuleSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("device"),
    device: z.enum(["desktop", "tablet", "mobile"]),
  }),
  z.object({
    type: z.literal("time"),
    timeStart: z.string().regex(/^\d{2}:\d{2}$/),
    timeEnd: z.string().regex(/^\d{2}:\d{2}$/),
  }),
  z.object({
    type: z.literal("url_param"),
    paramName: z.string().min(1).max(50),
    paramValue: z.string().max(100),
  }),
  z.object({
    type: z.literal("customer_tag"),
    customerTag: z.string().min(1).max(50),
  }),
]);

export const ConditionalDisplaySchema = z.object({
  enabled: z.boolean(),
  rules: z.array(ConditionalDisplayRuleSchema).max(10),
});

// ── Section ─────────────────────────────────────────────────────────────────

export const SectionSchema = z.object({
  id: z.string().min(1),
  type: z.string().min(1).max(50),
  enabled: z.boolean(),
  settings: z.record(z.string(), z.unknown()),
  blocks: z.array(BlockSchema).max(50),
  typography: SectionTypographyOverrideSchema.optional(),
  spacing: SpacingSchema.optional(),
  background: BackgroundSchema.optional(),
  decoration: DecorationSchema.optional(),
  visibility: ResponsiveVisibilitySchema.optional(),
  animation: AnimationSchema.optional(),
  layout: LayoutSchema.optional(),
  customCSS: z
    .object({ css: safeCss })
    .optional(),
  conditionalDisplay: ConditionalDisplaySchema.optional(),
});

// ── Theme Variant ───────────────────────────────────────────────────────────

export const ThemeVariantSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(50),
  isDefault: z.boolean(),
  autoSwitch: z.boolean(),
  colors: ColorTokensSchema.partial(),
  typography: TypographySchema.partial().optional(),
});

// ── Brand Kit ───────────────────────────────────────────────────────────────

export const BrandKitSchema = z.object({
  logoLight: sanitizedUrl,
  logoDark: sanitizedUrl,
  logoMobile: sanitizedUrl,
  favicon: sanitizedUrl,
  socialImage: sanitizedUrl,
  brandColors: z.array(hexColor).max(10),
});

// ── Global Settings ─────────────────────────────────────────────────────────

export const GlobalSettingsSchema = z.object({
  colors: ColorTokensSchema,
  typography: TypographySchema,
  layout: z.object({
    contentWidth: z.number().min(400).max(2000),
    sectionGap: z.number().min(0).max(200),
    pagePadding: z.number().min(0).max(100),
    borderRadius: z.number().min(0).max(50),
  }),
  variants: z.array(ThemeVariantSchema).min(1).max(10),
  activeVariant: z.string().min(1),
  brandKit: BrandKitSchema,
  animations: z.object({
    globalDuration: z.number().min(0).max(3000),
    globalEasing: z.string().max(100),
    scrollAnimations: z.boolean(),
    hoverEffects: z.boolean(),
    reduceMotion: z.boolean(),
  }),
  seo: z.object({
    lazyLoadImages: z.boolean(),
    preloadCritical: z.boolean(),
    structuredData: z.boolean(),
  }),
  integrations: z.object({
    googleAnalyticsId: z.string().max(30).optional(),
    metaPixelId: z.string().max(30).optional(),
    customHead: safeHtml,
    customFooter: safeHtml,
  }),
});

// ── Full Theme Config ───────────────────────────────────────────────────────

export const PortalThemeConfigSchema = z.object({
  schemaVersion: z.number().min(1).max(10),
  themeKey: z.string().min(1).max(50),
  globalSettings: GlobalSettingsSchema,
  sections: z.array(SectionSchema).max(20),
});

// ── PostMessage Validation ──────────────────────────────────────────────────

export const PortalCustomizerMessageSchema = z.object({
  source: z.literal("portal-customizer"),
  version: z.literal(1),
  type: z.literal("THEME_PREVIEW_UPDATE"),
  tenantId: z.string().min(1),
  payload: z.object({
    config: PortalThemeConfigSchema,
  }),
});

export type PortalThemeConfigInput = z.infer<typeof PortalThemeConfigSchema>;
