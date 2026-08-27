// =============================================================================
// SECTION REGISTRY — Single source of truth for all section types
// Used by: renderer, add-section menu, settings forms, defaults, validation
// =============================================================================

import type {
  PortalSection,
  PortalSectionArea,
  PortalSectionDefinition,
} from "../types";

export const SECTION_REGISTRY: PortalSectionDefinition[] = [
  // ── Content ─────────────────────────────────────────────────────────────
  {
    type: "hero_banner",
    label: "Hero Banner",
    description: "Full-width hero with title, subtitle, image, and CTA button",
    icon: "Image",
    category: "content",
    area: "beranda",
    status: "core",
    addable: true,
    defaultSettings: {
      styleMode: "catalog_split",
      title: "Kopi dari roastery Anda",
      subtitle: "",
      imageUrl: null,
      buttonText: "Lihat katalog",
      buttonLink: "#catalog",
      overlay: 40,
      textAlignment: "center",
    },
  },
  {
    type: "rich_text",
    label: "Rich Text",
    description: "Text content with customizable typography and alignment",
    icon: "Type",
    category: "content",
    area: "konten",
    status: "optional",
    addable: true,
    defaultSettings: {
      title: "",
      content: "",
      alignment: "left",
    },
  },
  {
    type: "image_with_text",
    label: "Image with Text",
    description: "Side-by-side image and text content",
    icon: "AlignLeft",
    category: "content",
    area: "konten",
    status: "optional",
    addable: true,
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
    area: "konten",
    status: "optional",
    addable: true,
    defaultSettings: {
      columns: 3,
      aspectRatio: "1/1",
    },
    blockTypes: [
      {
        type: "image",
        label: "Image",
        defaultSettings: {
          imageUrl: null,
          caption: "",
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
    area: "konten",
    status: "optional",
    addable: true,
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
    area: "katalog",
    status: "core",
    addable: true,
    requires: ["storefront_products"],
    defaultSettings: {
      styleMode: "clean_grid",
      title: "Pilihan kopi",
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
    area: "katalog",
    status: "optional",
    addable: true,
    requires: ["storefront_products"],
    defaultSettings: {
      title: "Featured Products",
      subtitle: "",
      productIds: [],
      columns: 4,
    },
  },
  {
    type: "product_highlight",
    label: "Product Highlight",
    description: " spotlight a single product with full details",
    icon: "Sparkles",
    category: "commerce",
    area: "katalog",
    status: "optional",
    addable: true,
    requires: ["storefront_products"],
    defaultSettings: {
      productId: null,
      showPrice: true,
      showDescription: true,
    },
  },

  // ── Marketing ───────────────────────────────────────────────────────────
  {
    type: "benefits",
    label: "Benefits / Features",
    description: "Showcase key benefits with icons",
    icon: "CheckCircle",
    category: "marketing",
    area: "konten",
    status: "optional",
    addable: true,
    defaultSettings: {
      title: "Keunggulan roastery",
      subtitle: "",
      columns: 3,
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
    area: "konten",
    status: "optional",
    addable: true,
    defaultSettings: {
      title: "Testimoni pelanggan",
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
    area: "beranda",
    status: "optional",
    addable: true,
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
    area: "konten",
    status: "optional",
    addable: true,
    defaultSettings: {},
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
    area: "konten",
    status: "legacy",
    addable: false,
    requires: ["newsletter_subscriber_backend"],
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
    area: "konten",
    status: "optional",
    addable: true,
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
    area: "konten",
    status: "optional",
    addable: true,
    defaultSettings: {
      title: "Frequently Asked Questions",
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
    area: "beranda",
    status: "optional",
    addable: true,
    defaultSettings: {
      title: "Sorotan roastery",
      subtitle: "",
      columns: 4,
      gapStyle: "normal",
    },
    blockTypes: [
      {
        type: "bento_card",
        label: "Bento Card",
        defaultSettings: {
          title: "",
          subtitle: "",
          content: "",
          badge: "",
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
    area: "katalog",
    status: "legacy",
    addable: false,
    requires: ["product_flavor_metadata"],
    defaultSettings: {
      title: "Profil rasa",
      subtitle: "",
    },
  },
  {
    type: "cupping_archive",
    label: "Arsip Cupping & Skor Kualitas",
    description: "Public, read-only archive of cupping results (SCA score, defect, linked lot) for buyer transparency",
    icon: "Coffee",
    category: "commerce",
    area: "katalog",
    status: "optional",
    addable: true,
    defaultSettings: {
      title: "Arsip Cupping & Skor Kualitas",
      subtitle: "",
    },
  },
  {
    type: "sticky_narrative",
    label: "Sticky Narrative Split",
    description: "Editorial split-screen storytelling with sticky pinned visual column",
    icon: "Columns",
    category: "content",
    area: "beranda",
    status: "optional",
    addable: true,
    defaultSettings: {
      title: "Cerita roastery",
      subtitle: "",
      pinnedTitle: "Proses kami",
      pinnedSubtitle: "",
    },
    blockTypes: [
      {
        type: "narrative_step",
        label: "Narrative Step",
        defaultSettings: {
          title: "",
          subtitle: "",
          content: "",
          imageUrl: null,
          icon: "CheckCircle2",
          tag: "",
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
    area: "katalog",
    status: "legacy",
    addable: false,
    aliases: ["wholesale_radar"],
    requires: ["wholesale_pricing_profiles"],
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
    area: "beranda",
    status: "optional",
    addable: true,
    aliases: ["kinetic_marquee"],
    defaultSettings: {
      title: "",
      speed: 30,
      styleMode: "outline",
      direction: "left",
    },
    blockTypes: [
      {
        type: "ticker_item",
        label: "Ticker Text",
        defaultSettings: {
          text: "",
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
    area: "header",
    status: "core",
    addable: true,
    defaultSettings: {
      styleMode: "glass_pill",
      logoText: "Nama roastery",
      tickerText: "",
      ctaText: "Keranjang",
    },
  },
  {
    type: "footer_nav",
    label: "Footer & System Info",
    description: "Multi-style footer with 4 layout shapes, navigation, copyright, and operational SLA",
    icon: "LayoutBottom",
    category: "layout",
    area: "footer",
    status: "core",
    addable: true,
    defaultSettings: {
      styleMode: "editorial_grid",
      logoText: "Nama roastery",
      bioText: "",
      copyrightText: "Hak cipta roastery Anda.",
    },
  },
  // ── Roastery Storytelling Sections ─────────────────────────────────────────
  {
    type: "awards_strip",
    label: "Awards Strip",
    description: "Horizontal strip showcasing awards, certifications, and badges with icons",
    icon: "Award",
    category: "marketing",
    area: "konten",
    status: "optional",
    addable: true,
    defaultSettings: {
      title: "Penghargaan & Sertifikasi",
      subtitle: "Diakui global, bangga lokal",
      columns: 5,
      showIcons: true,
    },
    blockTypes: [
      {
        type: "award",
        label: "Award",
        defaultSettings: {
          title: "",
          year: "",
          icon: "Award",
          description: "",
          color: "#D4A574",
        },
      },
    ],
  },
  {
    type: "brand_timeline",
    label: "Brand Timeline",
    description: "Vertical or horizontal timeline of brand milestones with narrative steps",
    icon: "Timeline",
    category: "marketing",
    area: "konten",
    status: "optional",
    addable: true,
    defaultSettings: {
      title: "Perjalanan Kami",
      subtitle: "Dari satu mimpi ke realitas",
      layout: "vertical",
      showYears: true,
    },
    blockTypes: [
      {
        type: "narrative_step",
        label: "Timeline Step",
        defaultSettings: {
          title: "",
          subtitle: "",
          content: "",
          imageUrl: null,
          icon: "CheckCircle2",
          tag: "",
          year: "",
          location: "",
        },
      },
    ],
  },
  {
    type: "sustainability",
    label: "Sustainability",
    description: "Grid of sustainability practices with icons and metrics",
    icon: "Leaf",
    category: "marketing",
    area: "konten",
    status: "optional",
    addable: true,
    defaultSettings: {
      title: "Berkelanjutan",
      subtitle: "Praktik bertanggung jawab dari petani ke fincan",
      layout: "grid",
      columns: 3,
    },
    blockTypes: [
      {
        type: "stat",
        label: "Sustainability Metric",
        defaultSettings: {
          value: "",
          label: "",
          icon: "Leaf",
          color: "#4B6B3C",
        },
      },
    ],
  },
];

// ── Registry Lookup ─────────────────────────────────────────────────────────

// Persisted tenant configs may still use these first-generation names. Keep the
// aliases at the compatibility boundary, while newly-authored config uses the
// canonical registry type.
export const LEGACY_SECTION_TYPE_ALIASES = SECTION_REGISTRY.reduce<Record<string, string>>(
  (aliases, definition) => {
    for (const alias of definition.aliases ?? []) aliases[alias] = definition.type;
    return aliases;
  },
  {},
);

export function resolveSectionType(type: string): string {
  return LEGACY_SECTION_TYPE_ALIASES[
    type as keyof typeof LEGACY_SECTION_TYPE_ALIASES
  ] ?? type;
}

const SECTION_AREAS: readonly PortalSectionArea[] = [
  "header",
  "beranda",
  "katalog",
  "konten",
  "footer",
];

export const PUBLIC_SECTION_REGISTRY = SECTION_REGISTRY.filter(
  (section) => section.addable,
);
export const PUBLIC_SECTION_TYPES = PUBLIC_SECTION_REGISTRY.map(
  (section) => section.type,
);
const PUBLIC_SECTION_TYPE_SET = new Set(PUBLIC_SECTION_TYPES);

function groupSectionTypesByArea(addableOnly: boolean) {
  return Object.fromEntries(
    SECTION_AREAS.map((area) => [
      area,
      SECTION_REGISTRY
        .filter((section) => section.area === area && (!addableOnly || section.addable))
        .map((section) => section.type),
    ]),
  ) as Record<PortalSectionArea, string[]>;
}

// Compatibility exports for existing consumers. Both are generated from the
// registry metadata; neither is an independently maintained taxonomy.
export const PUBLIC_SECTION_TYPE_GROUPS = groupSectionTypesByArea(true);
export const EDITOR_SECTION_TYPE_GROUPS = groupSectionTypesByArea(false);

export type PortalCustomizerSectionGroup = PortalSectionArea;

export function isSectionArea(value: string): value is PortalSectionArea {
  return SECTION_AREAS.includes(value as PortalSectionArea);
}

export function getSectionsForArea(
  area: PortalSectionArea,
  options: { addableOnly?: boolean } = {},
): PortalSectionDefinition[] {
  return SECTION_REGISTRY.filter(
    (section) => section.area === area && (!options.addableOnly || section.addable),
  );
}

export function sectionTypeMatchesArea(
  type: string,
  area: PortalSectionArea,
): boolean {
  const definition = getSectionDefinition(type);
  // Keep unknown persisted sections reachable from the content editor while
  // the live renderer presents its graceful fallback.
  return definition ? definition.area === area : area === "konten";
}

export function sectionTypeMatchesGroup(
  type: string,
  allowedTypes: readonly string[],
): boolean {
  return allowedTypes.includes(resolveSectionType(type));
}

export function isPublicSectionType(type: string): boolean {
  return PUBLIC_SECTION_TYPE_SET.has(type);
}

// Use only for newly-authored/template config. Persisted tenant config must pass
// through untouched so hidden legacy sections keep rendering.
export function curatePublicSections(
  sections: readonly PortalSection[],
): PortalSection[] {
  return sections
    .map((section) => ({ ...section, type: resolveSectionType(section.type) }))
    .filter((section) => isPublicSectionType(section.type));
}

export function getSectionDefinition(
  type: string,
): PortalSectionDefinition | undefined {
  const canonicalType = resolveSectionType(type);
  return SECTION_REGISTRY.find((s) => s.type === canonicalType);
}

export function getSectionsByCategory(
  category: PortalSectionDefinition["category"],
): PortalSectionDefinition[] {
  return SECTION_REGISTRY.filter((s) => s.category === category);
}

export function getSectionCategories(): PortalSectionDefinition["category"][] {
  return Array.from(new Set(PUBLIC_SECTION_REGISTRY.map((section) => section.category)));
}

export function isValidSectionType(type: string): boolean {
  return SECTION_REGISTRY.some((s) => s.type === resolveSectionType(type));
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
