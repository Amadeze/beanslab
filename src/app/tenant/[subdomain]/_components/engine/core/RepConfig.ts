// =============================================================================
// REP (Roastery Experience Platform) - Core Configuration Schema
// =============================================================================
// This is the absolute core of the $10k Architecture.
// It defines the comprehensive Design Token Schema for all Micro-Engines.
// =============================================================================

export interface FontToken {
  family: string;
  weight: number;
  letterSpacing: string; // in em or px
  lineHeight: number;
  textTransform: "none" | "uppercase" | "lowercase" | "capitalize";
}

export interface RepTokens {
  colors: {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    surface: string;
    border: string;
    text: string;
    textMuted: string;
    success: string;
    warning: string;
    danger: string;
  };
  radius: "0" | "4" | "8" | "12" | "16" | "20" | "24" | "32" | "full";
  shadow: "xs" | "sm" | "md" | "lg" | "xl" | "glass" | "luxury" | "industrial";
  typography: {
    baseSize: number; // base size in px (e.g. 16)
    display: FontToken;
    heading: FontToken;
    title: FontToken;
    body: FontToken;
    caption: FontToken;
    button: FontToken;
  };
  motion: "slow" | "normal" | "fast" | "luxury" | "playful" | "cyber" | "organic";
}

export interface SectionConfig {
  id: string;
  type: string; // e.g. "HeroSplit", "CoffeeCards", "Newsletter"
  isHidden: boolean;
  isLocked: boolean;
  props: Record<string, any>; // Component specific props
}

export interface RepConfig {
  version: "1.0.0";
  themeName: string;
  tokens: RepTokens;
  layout: {
    gridType: "1-col" | "2-col" | "bento" | "magazine" | "asymmetric";
    sections: SectionConfig[];
  };
}

// =============================================================================
// FALLBACK DEFAULT CONFIGURATION
// =============================================================================
export const DEFAULT_REP_CONFIG: RepConfig = {
  version: "1.0.0",
  themeName: "Luxury Reserve",
  tokens: {
    colors: {
      primary: "#1A1A1A",
      secondary: "#F5F5F5",
      accent: "#C6A87C",
      background: "#FAFAFA",
      surface: "#FFFFFF",
      border: "#EAEAEA",
      text: "#111111",
      textMuted: "#666666",
      success: "#2E7D32",
      warning: "#ED6C02",
      danger: "#D32F2F",
    },
    radius: "8",
    shadow: "luxury",
    typography: {
      baseSize: 16,
      display: { family: "Playfair Display", weight: 600, letterSpacing: "-0.02em", lineHeight: 1.1, textTransform: "none" },
      heading: { family: "Playfair Display", weight: 500, letterSpacing: "-0.01em", lineHeight: 1.2, textTransform: "none" },
      title: { family: "Inter", weight: 600, letterSpacing: "0em", lineHeight: 1.3, textTransform: "none" },
      body: { family: "Inter", weight: 400, letterSpacing: "0em", lineHeight: 1.6, textTransform: "none" },
      caption: { family: "Inter", weight: 400, letterSpacing: "0.02em", lineHeight: 1.4, textTransform: "uppercase" },
      button: { family: "Inter", weight: 500, letterSpacing: "0.05em", lineHeight: 1, textTransform: "uppercase" },
    },
    motion: "luxury",
  },
  layout: {
    gridType: "1-col",
    sections: [
      { id: "hero-1", type: "HeroCenter", isHidden: false, isLocked: false, props: {} },
      { id: "catalog-1", type: "CoffeeCards", isHidden: false, isLocked: false, props: {} },
      { id: "visuals-1", type: "FlavorWheel", isHidden: false, isLocked: false, props: {} },
      { id: "about-1", type: "AwardsTimeline", isHidden: false, isLocked: false, props: {} },
      { id: "social-1", type: "TestimonialSlider", isHidden: false, isLocked: false, props: {} },
      { id: "content-1", type: "JournalGrid", isHidden: false, isLocked: false, props: {} },
      { id: "marketing-1", type: "NewsletterBar", isHidden: false, isLocked: false, props: {} },
    ]
  }
};

// =============================================================================
// BENTO PRESET CONFIGURATION
// =============================================================================
export const BENTO_PRESET_CONFIG: RepConfig = {
  ...DEFAULT_REP_CONFIG,
  themeName: "Modern Bento",
  tokens: {
    ...DEFAULT_REP_CONFIG.tokens,
    radius: "16", // Rounded corners for bento aesthetic
    shadow: "sm",
  },
  layout: {
    gridType: "bento",
    sections: [
      { id: "bento-hero", type: "HeroSplit", isHidden: false, isLocked: false, props: { bentoSpan: "md:col-span-2 md:row-span-2 col-span-1 row-span-2" } },
      { id: "bento-catalog", type: "CoffeeCards", isHidden: false, isLocked: false, props: { bentoSpan: "md:col-span-2 md:row-span-1 col-span-1 row-span-1" } },
      { id: "bento-visuals", type: "FlavorWheel", isHidden: false, isLocked: false, props: { bentoSpan: "md:col-span-1 md:row-span-1 col-span-1 row-span-1" } },
      { id: "bento-newsletter", type: "NewsletterBar", isHidden: false, isLocked: false, props: { bentoSpan: "md:col-span-1 md:row-span-1 col-span-1 row-span-1" } },
      { id: "bento-social", type: "TestimonialSlider", isHidden: false, isLocked: false, props: { bentoSpan: "md:col-span-4 md:row-span-1 col-span-1 row-span-1" } },
    ]
  }
};

