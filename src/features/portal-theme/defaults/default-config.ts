import type { PortalThemeConfig } from "../types";

// A deliberately small starting point. Store facts come from tenant data;
// default copy never claims a score, certification, sourcing model, or cadence.
export const DEFAULT_PORTAL_THEME_CONFIG: PortalThemeConfig = {
  schemaVersion: 1,
  themeKey: "modern_catalog",
  globalSettings: {
    colors: {
      primary: "#B65331",
      secondary: "#15B8C6",
      accent: "#E9A17F",
      background: "#080B0C",
      surface: "#111617",
      surfaceAlt: "#1A1F24",
      text: "#F8FAFC",
      textMuted: "#8B95A5",
      textInverse: "#080B0C",
      border: "rgba(255,255,255,0.1)",
      borderSubtle: "rgba(255,255,255,0.06)",
      error: "#EF4444",
      success: "#22C55E",
      warning: "#F59E0B",
      info: "#38BDF8",
    },
    typography: {
      headingFont: "DM Sans",
      bodyFont: "DM Sans",
      baseFontSize: 16,
      scaleRatio: 1.25,
      lineHeight: 1.6,
      letterSpacing: -0.02,
      headingWeight: 800,
      bodyWeight: 400,
      textTransform: "none",
    },
    layout: { contentWidth: 1280, sectionGap: 80, pagePadding: 24, borderRadius: 12 },
    variants: [
      { id: "dark", name: "Dark", isDefault: true, autoSwitch: true, colors: {} },
      {
        id: "light",
        name: "Light",
        isDefault: false,
        autoSwitch: true,
        colors: {
          background: "#FAFAF8",
          surface: "#FFFFFF",
          surfaceAlt: "#F5F3EF",
          text: "#1A1A1A",
          textMuted: "#6B7280",
          textInverse: "#FFFFFF",
          border: "#E5E5E5",
          borderSubtle: "#F0F0F0",
        },
      },
    ],
    activeVariant: "dark",
    brandKit: { brandColors: [] },
    animations: {
      globalDuration: 500,
      globalEasing: "cubic-bezier(0.22, 1, 0.36, 1)",
      scrollAnimations: true,
      hoverEffects: true,
      reduceMotion: false,
    },
    seo: { lazyLoadImages: true, preloadCritical: true, structuredData: true },
    integrations: {},
  },
  sections: [
    {
      id: "sec_header_default",
      type: "header_nav",
      enabled: true,
      settings: {
        styleMode: "glass_pill",
        logoText: "Nama roastery",
        tickerText: "",
        ctaText: "Keranjang",
        navLinks: [
          { label: "Kopi", href: "#catalog" },
          { label: "Tentang", href: "#about" },
          { label: "FAQ", href: "#faq" },
        ],
      },
      blocks: [],
    },
    {
      id: "sec_hero_default",
      type: "hero_banner",
      enabled: true,
      settings: {
        styleMode: "catalog_split",
        title: "Kopi dari roastery Anda",
        subtitle: "Tampilkan pilihan kopi dan ceritakan pendekatan roastery Anda di sini.",
        buttonText: "Lihat katalog",
        buttonLink: "#catalog",
        imageUrl: "",
        overlay: 55,
        textAlignment: "left",
      },
      blocks: [],
    },
    {
      id: "sec_catalog_default",
      type: "catalog_grid",
      enabled: true,
      settings: {
        styleMode: "clean_grid",
        title: "Pilihan kopi",
        subtitle: "Produk, harga, stok, dan profil kopi mengikuti data tenant.",
        columns: 3,
      },
      blocks: [],
    },
    {
      id: "sec_cupping_archive_default",
      type: "cupping_archive",
      enabled: true,
      settings: {
        title: "Arsip Cupping & Skor Kualitas",
        subtitle: "Setiap batch disensori oleh tim QC. Skor SCA & catatan defect kami tampilkan terbuka.",
      },
      blocks: [],
    },
    {
      id: "sec_footer_default",
      type: "footer_nav",
      enabled: true,
      settings: { styleMode: "minimal_centered", copyrightText: "Hak cipta roastery Anda." },
      blocks: [],
    },
  ],
};

export const DEFAULT_SECTION_SPACING = {
  paddingTop: 64,
  paddingRight: 24,
  paddingBottom: 64,
  paddingLeft: 24,
  marginTop: 0,
  marginBottom: 0,
};

export const DEFAULT_SECTION_VISIBILITY = { desktop: true, tablet: true, mobile: true };

export const DEFAULT_SECTION_ANIMATION = {
  scrollTrigger: "fade-in" as const,
  duration: 500,
  delay: 0,
  easing: "cubic-bezier(0.22, 1, 0.36, 1)",
  hoverEffect: "none" as const,
};

export const DEFAULT_SECTION_LAYOUT = {
  width: "wide" as const,
  alignment: "center" as const,
  verticalAlign: "top" as const,
  columns: 1,
  columnGap: 24,
};

export const DEFAULT_SECTION_DECORATION = {
  borderRadius: 0,
  borderWidth: 0,
  borderColor: "#E5E5E5",
  borderStyle: "none" as const,
  shadow: "none" as const,
};
