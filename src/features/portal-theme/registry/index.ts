// =============================================================================
// SECTION REGISTRY — Single source of truth for all section types
// Used by: renderer, add-section menu, settings forms, defaults, validation
// =============================================================================

import type { PortalSectionDefinition } from "../types";

export const SECTION_REGISTRY: PortalSectionDefinition[] = [
  // ── Content ─────────────────────────────────────────────────────────────
  {
    type: "hero_banner",
    label: "Hero Banner",
    description: "Full-width hero with title, subtitle, image, and CTA button",
    icon: "Image",
    category: "content",
    defaultSettings: {
      title: "Premium Coffee Beans",
      subtitle: "Roasted to order for your business",
      imageUrl: null,
      buttonText: "View Catalog",
      buttonLink: "#catalog",
      overlay: 40,
      textAlignment: "center",
    },
    blockTypes: [
      {
        type: "slide",
        label: "Slide",
        defaultSettings: {
          title: "",
          subtitle: "",
          imageUrl: null,
          buttonText: "",
          buttonLink: "",
        },
      },
    ],
  },
  {
    type: "rich_text",
    label: "Rich Text",
    description: "Text content with customizable typography and alignment",
    icon: "Type",
    category: "content",
    defaultSettings: {
      title: "",
      content: "",
      alignment: "left",
      columns: 1,
    },
  },
  {
    type: "image_with_text",
    label: "Image with Text",
    description: "Side-by-side image and text content",
    icon: "AlignLeft",
    category: "content",
    defaultSettings: {
      imageUrl: null,
      title: "",
      text: "",
      alignment: "left",
      aspectRatio: "16/9",
    },
  },
  {
    type: "gallery",
    label: "Gallery",
    description: "Image grid with lightbox support",
    icon: "Grid3x3",
    category: "content",
    defaultSettings: {
      columns: 3,
      lightbox: true,
      aspectRatio: "1/1",
      spacing: 8,
    },
    blockTypes: [
      {
        type: "image",
        label: "Image",
        defaultSettings: {
          imageUrl: null,
          caption: "",
          link: "",
        },
      },
    ],
  },
  {
    type: "video_embed",
    label: "Video Embed",
    description: "Embed YouTube, Vimeo, or self-hosted video",
    icon: "Play",
    category: "content",
    defaultSettings: {
      videoUrl: "",
      posterUrl: "",
      autoplay: false,
      loop: false,
      muted: true,
      aspectRatio: "16/9",
    },
  },

  // ── Commerce ────────────────────────────────────────────────────────────
  {
    type: "catalog_grid",
    label: "Product Catalog",
    description: "Grid of products with filtering and sorting",
    icon: "ShoppingBag",
    category: "commerce",
    defaultSettings: {
      title: "The Collection",
      subtitle: "",
      columns: 3,
      productFilter: "all",
      sortBy: "name",
      showPrices: true,
      showStock: false,
    },
  },
  {
    type: "featured_collection",
    label: "Featured Collection",
    description: "Highlight specific products in a custom layout",
    icon: "Star",
    category: "commerce",
    defaultSettings: {
      title: "Featured Products",
      subtitle: "",
      productIds: [],
      layout: "grid",
      columns: 4,
    },
  },
  {
    type: "product_highlight",
    label: "Product Highlight",
    description: " spotlight a single product with full details",
    icon: "Sparkles",
    category: "commerce",
    defaultSettings: {
      productId: null,
      showPrice: true,
      showDescription: true,
      showVariants: false,
      layout: "image-left",
    },
  },

  // ── Marketing ───────────────────────────────────────────────────────────
  {
    type: "benefits",
    label: "Benefits / Features",
    description: "Showcase key benefits with icons",
    icon: "CheckCircle",
    category: "marketing",
    defaultSettings: {
      columns: 3,
      iconStyle: "outline",
    },
    blockTypes: [
      {
        type: "benefit",
        label: "Benefit",
        defaultSettings: {
          icon: "Star",
          title: "",
          description: "",
        },
      },
    ],
  },
  {
    type: "testimonials",
    label: "Testimonials",
    description: "Customer reviews and testimonials",
    icon: "Quote",
    category: "marketing",
    defaultSettings: {
      layout: "carousel",
      columns: 3,
      showRating: true,
    },
    blockTypes: [
      {
        type: "testimonial",
        label: "Testimonial",
        defaultSettings: {
          name: "",
          role: "",
          text: "",
          rating: 5,
          avatar: null,
        },
      },
    ],
  },
  {
    type: "countdown",
    label: "Countdown Timer",
    description: "Countdown to a specific date or event",
    icon: "Timer",
    category: "marketing",
    defaultSettings: {
      title: "Limited Time Offer",
      subtitle: "",
      targetDate: "",
      expiredText: "Offer has expired",
      style: "boxes",
    },
  },
  {
    type: "social_proof",
    label: "Social Proof",
    description: "Reviews, stats, or logo bar",
    icon: "TrendingUp",
    category: "marketing",
    defaultSettings: {
      type: "stats",
      layout: "row",
    },
    blockTypes: [
      {
        type: "stat",
        label: "Stat",
        defaultSettings: {
          value: "",
          label: "",
          icon: "TrendingUp",
        },
      },
    ],
  },
  {
    type: "newsletter",
    label: "Newsletter Signup",
    description: "Email capture form",
    icon: "Mail",
    category: "marketing",
    defaultSettings: {
      title: "Stay Updated",
      subtitle: "Get the latest news and offers",
      placeholder: "Enter your email",
      buttonText: "Subscribe",
      privacyText: "We respect your privacy. Unsubscribe at any time.",
    },
  },

  // ── Layout ──────────────────────────────────────────────────────────────
  {
    type: "contact_cta",
    label: "Contact CTA",
    description: "Call-to-action with contact information",
    icon: "Phone",
    category: "layout",
    defaultSettings: {
      title: "Get in Touch",
      text: "Ready to place an order? Contact us directly.",
      buttonText: "Contact Us",
      buttonLink: "",
      showPhone: true,
      showEmail: true,
      showWhatsApp: true,
    },
  },
  {
    type: "faq",
    label: "FAQ",
    description: "Frequently asked questions with accordion",
    icon: "HelpCircle",
    category: "layout",
    defaultSettings: {
      title: "Frequently Asked Questions",
      layout: "accordion",
      allowSearch: false,
    },
    blockTypes: [
      {
        type: "question",
        label: "Question",
        defaultSettings: {
          question: "",
          answer: "",
        },
      },
    ],
  },
  // ── Unlimited Creation Sections ──────────────────────────────────────────
  {
    type: "bento_showcase",
    label: "Bento Grid Showcase",
    description: "Modular bento mosaic canvas with custom tile spans and glassmorphism",
    icon: "LayoutGrid",
    category: "layout",
    defaultSettings: {
      title: "The Wholesale Bento Showcase",
      subtitle: "Engineered for excellence. Explore our roast profiles, cupping metrics, and origin traceability.",
      columns: 4,
      gapStyle: "normal",
    },
    blockTypes: [
      {
        type: "bento_card",
        label: "Bento Card",
        defaultSettings: {
          title: "Feature Title",
          subtitle: "Subtitle Note",
          content: "Detailed description of this feature or product specifications.",
          badge: "Highlight",
          icon: "Coffee",
          accentColor: "#D4A574",
          colSpan: 1,
          rowSpan: 1,
        },
      },
    ],
  },
  {
    type: "interactive_flavor",
    label: "Sensory Flavor Wheel",
    description: "Interactive sensory note filter with fluid layout transitions",
    icon: "Sliders",
    category: "commerce",
    defaultSettings: {
      title: "Sensory Flavor Explorer",
      subtitle: "Filter our wholesale green & roasted coffee catalog by sensory tasting profile.",
    },
  },
  {
    type: "sticky_narrative",
    label: "Sticky Narrative Split",
    description: "Editorial split-screen storytelling with sticky pinned visual column",
    icon: "Columns",
    category: "content",
    defaultSettings: {
      title: "The Craft & Alchemy Narrative",
      subtitle: "How we transform high-altitude cherry into world-class wholesale espresso profiles.",
      pinnedTitle: "Roastd.id Studio",
      pinnedSubtitle: "B2B Quality Protocol",
    },
    blockTypes: [
      {
        type: "step",
        label: "Narrative Step",
        defaultSettings: {
          title: "Step Title",
          subtitle: "Step Subtitle",
          content: "Detailed explanation of this step in the roasting or sourcing process.",
          imageUrl: null,
          icon: "CheckCircle2",
          tag: "Verified",
        },
      },
    ],
  },
  {
    type: "roast_matrix",
    label: "Wholesale Radar Matrix",
    description: "Visual sensory cupping comparison & volume tier pricing simulator",
    icon: "BarChart3",
    category: "commerce",
    defaultSettings: {
      title: "Wholesale Roast Profile Matrix & Tier Pricing",
      subtitle: "Analyze sensory cupping attributes and simulate volume-based contract discounts in real time.",
    },
    blockTypes: [
      {
        type: "profile",
        label: "Roast Profile",
        defaultSettings: {
          title: "Espresso Master Blend",
          subtitle: "Medium-Dark Roast",
          acidity: 50,
          body: 90,
          sweetness: 85,
          balance: 90,
          aftertaste: 85,
          basePrice: 16.50,
          content: "Designed for commercial espresso machines. Cuts through milk effortlessly.",
        },
      },
    ],
  },
  {
    type: "marquee_kinetic",
    label: "Kinetic Marquee Ticker",
    description: "Infinite loop scrolling text with hover speed controls and kinetic outline styles",
    icon: "MoveHorizontal",
    category: "marketing",
    defaultSettings: {
      speed: 30,
      styleMode: "outline",
      direction: "left",
    },
    blockTypes: [
      {
        type: "ticker_item",
        label: "Ticker Text",
        defaultSettings: {
          text: "100% DIRECT TRADE TRACEABILITY ★",
        },
      },
    ],
  },
  {
    type: "header_nav",
    label: "Header & Navigation Bar",
    description: "Responsive top navigation bar with 5 layout shapes, live cart counter, and mobile slide-out menu",
    icon: "Navigation",
    category: "layout",
    defaultSettings: {
      styleMode: "glass_pill",
      logoText: "ROASTD.ID",
      tickerText: "🚀 FREE NATIONWIDE SHIPPING ON ORDERS OVER 5KG • WEEKLY ROASTING SCHEDULE: TUE & THU",
      ctaText: "Wholesale Cart",
    },
  },
  {
    type: "footer_nav",
    label: "Footer & System Info",
    description: "Multi-style footer with 4 layout shapes, newsletter dispatch, copyright, and operational SLA",
    icon: "LayoutBottom",
    category: "layout",
    defaultSettings: {
      styleMode: "editorial_grid",
      logoText: "ROASTD.ID",
      bioText: "Empowering specialty coffee roasters and B2B cafe partners with precision telemetry, micro-batch profiling, and direct-trade sourcing.",
      copyrightText: "© 2026 ROASTD.ID • Roastery Operating System. All rights reserved.",
    },
  },
];

// ── Registry Lookup ─────────────────────────────────────────────────────────

export function getSectionDefinition(
  type: string,
): PortalSectionDefinition | undefined {
  return SECTION_REGISTRY.find((s) => s.type === type);
}

export function getSectionsByCategory(
  category: PortalSectionDefinition["category"],
): PortalSectionDefinition[] {
  return SECTION_REGISTRY.filter((s) => s.category === category);
}

export function getSectionCategories(): PortalSectionDefinition["category"][] {
  return ["content", "commerce", "marketing", "layout"];
}

export function isValidSectionType(type: string): boolean {
  return SECTION_REGISTRY.some((s) => s.type === type);
}

export function createSectionFromType(
  type: string,
  id: string,
): PortalSectionDefinition | null {
  const def = getSectionDefinition(type);
  if (!def) return null;
  return {
    ...def,
    defaultSettings: { ...def.defaultSettings },
  };
}
