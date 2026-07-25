// =============================================================================
// THEME CONFIG — Coffee World Theme System
// =============================================================================
// Each preset represents a different expression of coffee culture.
// All rooted in warm, artisanal aesthetics with distinct personalities.
// =============================================================================

export interface ThemeColors {
  primary: string;
  secondary: string;
  background: string;
  surface: string;
  text: string;
  textMuted: string;
  border: string;
  accent: string;
}

export interface ThemeTypography {
  fontFamily: string;
  displayFont: string;
  baseFontSize: number;
  bodyWeight: number;
  headingWeight: number;
  headingTracking: number;
  bodyLineHeight: number;
  headingTransform: 'none' | 'uppercase' | 'capitalize';
}

export interface ThemeShadows {
  type: 'none' | 'soft' | 'sharp' | 'deep3d' | 'glow' | 'brutalist';
  color: string;
  intensity: number;
}

export interface ThemeAnimations {
  level: 'none' | 'subtle' | 'moderate' | 'high-tech' | 'cinematic';
  easing: string | number[];
  durationScale: number;
  scrollTrigger: boolean;
  hoverEffects: boolean;
}

export interface ThemeLayout {
  borderRadius: number;
  borderWidth: number;
  maxWidth: number;
  spacingScale: number;
  cardStyle: 'flat' | 'elevated' | 'outlined' | 'glass';
  headerStyle: 'fixed' | 'static' | 'floating';
}

export interface ThemeConfig {
  colors: ThemeColors;
  typography: ThemeTypography;
  shadows: ThemeShadows;
  animations: ThemeAnimations;
  layout: ThemeLayout;
}

// =============================================================================
// THEME PRESET ALIASES
// =============================================================================

export const THEME_PRESET_ALIASES: Record<string, string> = {
  // Legacy aliases -> new names
  vintage: 'heritage',
  neomodern: 'artisan',
  cyber: 'noir',
  botanical: 'botanical',
  editorial: 'kinfolk',
  liquid: 'ceramic',
  industrial: 'roastery',
  club: 'origin',
  luxury: 'specialty',
  playful: 'cupping',
  classic: 'heritage',
  futuristic: 'noir',
  minimalist: 'kinfolk',
  modern: 'artisan',
  bento: 'artisan',
  glass: 'ceramic',
  cinematic: 'noir',
  zen: 'kinfolk',
  neobrutalism: 'cupping',
  heritage: 'heritage',
  artisan: 'artisan',
  noir: 'noir',
  kinfolk: 'kinfolk',
  ceramic: 'ceramic',
  origin: 'origin',
  roastery: 'roastery',
  cupping: 'cupping',
  specialty: 'specialty',
};

// =============================================================================
// 10 COFFEE WORLD PRESETS
// =============================================================================

export const THEME_PRESETS: Record<string, ThemeConfig> = {

  // ─── 1. HERITAGE — Vintage Coffee House ──────────────────────────────
  // Old-world charm, aged paper, hand-drawn typography
  // Like a 1920s European café
  heritage: {
    colors: {
      primary: '#5C3D2E',
      secondary: '#8B6F47',
      background: '#F5EDE0',
      surface: '#FDF8F0',
      text: '#3E2723',
      textMuted: '#7D6B5D',
      border: '#D4C4B0',
      accent: '#C17817',
    },
    typography: {
      fontFamily: 'EB Garamond',
      displayFont: 'Playfair Display',
      baseFontSize: 18,
      bodyWeight: 400,
      headingWeight: 700,
      headingTracking: 0.06,
      bodyLineHeight: 1.8,
      headingTransform: 'none',
    },
    shadows: { type: 'soft', color: 'rgba(62,39,35,0.12)', intensity: 35 },
    animations: { level: 'subtle', easing: [0.25, 0.1, 0.25, 1], durationScale: 1.4, scrollTrigger: true, hoverEffects: true },
    layout: { borderRadius: 4, borderWidth: 2, maxWidth: 1100, spacingScale: 1.3, cardStyle: 'outlined', headerStyle: 'static' },
  },

  // ─── 2. ARTISAN — Modern Craft Roastery ──────────────────────────────
  // Dark premium, copper + cyan accents, matching landing page DNA
  artisan: {
    colors: {
      primary: '#B65331',
      secondary: '#15B8C6',
      background: '#080B0C',
      surface: '#111617',
      text: '#F8FAFC',
      textMuted: '#8B95A5',
      border: 'rgba(255,255,255,0.1)',
      accent: '#E9A17F',
    },
    typography: {
      fontFamily: 'DM Sans',
      displayFont: 'DM Sans',
      baseFontSize: 16,
      bodyWeight: 400,
      headingWeight: 800,
      headingTracking: -0.058,
      bodyLineHeight: 1.75,
      headingTransform: 'none',
    },
    shadows: { type: 'soft', color: 'rgba(0,0,0,0.4)', intensity: 40 },
    animations: { level: 'moderate', easing: [0.22, 1, 0.36, 1], durationScale: 1.0, scrollTrigger: true, hoverEffects: true },
    layout: { borderRadius: 12, borderWidth: 1, maxWidth: 1500, spacingScale: 1.1, cardStyle: 'elevated', headerStyle: 'floating' },
  },

  // ─── 3. NOIR — Dark Roast Sophistication ─────────────────────────────
  // Moody, deep, intense like a double espresso
  // Dark backgrounds with warm amber highlights
  noir: {
    colors: {
      primary: '#E8D5B7',
      secondary: '#A89279',
      background: '#1A1612',
      surface: '#231F1B',
      text: '#E8D5B7',
      textMuted: '#9A8B7A',
      border: '#3D352D',
      accent: '#D4A574',
    },
    typography: {
      fontFamily: 'Inter',
      displayFont: 'Source Serif 4',
      baseFontSize: 16,
      bodyWeight: 300,
      headingWeight: 600,
      headingTracking: -0.03,
      bodyLineHeight: 1.7,
      headingTransform: 'none',
    },
    shadows: { type: 'soft', color: 'rgba(0,0,0,0.4)', intensity: 60 },
    animations: { level: 'subtle', easing: [0.16, 1, 0.3, 1], durationScale: 1.2, scrollTrigger: true, hoverEffects: true },
    layout: { borderRadius: 8, borderWidth: 1, maxWidth: 1200, spacingScale: 1.2, cardStyle: 'elevated', headerStyle: 'fixed' },
  },

  // ─── 4. BOTANICAL — Green Coffee Origins ─────────────────────────────
  // Earthy, organic, like a coffee farm at dawn
  // Green tones with warm soil browns
  botanical: {
    colors: {
      primary: '#4A6741',
      secondary: '#7D9B6D',
      background: '#F2F5EF',
      surface: '#FAFCF8',
      text: '#2D3B28',
      textMuted: '#6B7D63',
      border: '#C8D4BC',
      accent: '#8B6F47',
    },
    typography: {
      fontFamily: 'Nunito',
      displayFont: 'Source Serif 4',
      baseFontSize: 17,
      bodyWeight: 400,
      headingWeight: 700,
      headingTracking: -0.01,
      bodyLineHeight: 1.75,
      headingTransform: 'none',
    },
    shadows: { type: 'soft', color: 'rgba(74,103,65,0.1)', intensity: 30 },
    animations: { level: 'moderate', easing: [0.34, 1.56, 0.64, 1], durationScale: 1.1, scrollTrigger: true, hoverEffects: true },
    layout: { borderRadius: 20, borderWidth: 2, maxWidth: 1200, spacingScale: 1.15, cardStyle: 'elevated', headerStyle: 'floating' },
  },

  // ─── 5. KINFOLK — Editorial Minimalism ───────────────────────────────
  // Clean, lots of whitespace, serif typography
  // Like Kinfolk magazine or Cereal magazine
  kinfolk: {
    colors: {
      primary: '#1A1A1A',
      secondary: '#6B6B6B',
      background: '#FEFEFE',
      surface: '#FFFFFF',
      text: '#1A1A1A',
      textMuted: '#999999',
      border: '#EAEAEA',
      accent: '#B8956A',
    },
    typography: {
      fontFamily: 'Source Serif 4',
      displayFont: 'Playfair Display',
      baseFontSize: 18,
      bodyWeight: 400,
      headingWeight: 600,
      headingTracking: -0.02,
      bodyLineHeight: 1.85,
      headingTransform: 'none',
    },
    shadows: { type: 'none', color: 'transparent', intensity: 0 },
    animations: { level: 'subtle', easing: [0.22, 1, 0.36, 1], durationScale: 1.3, scrollTrigger: true, hoverEffects: false },
    layout: { borderRadius: 0, borderWidth: 1, maxWidth: 1000, spacingScale: 1.5, cardStyle: 'flat', headerStyle: 'static' },
  },

  // ─── 6. CERAMIC — Coffee Cup Aesthetics ──────────────────────────────
  // Warm clay tones, handcrafted feel, like pottery
  // Inspired by handmade ceramic cups
  ceramic: {
    colors: {
      primary: '#9C6B3A',
      secondary: '#C4956A',
      background: '#F7F2EC',
      surface: '#FFFDF9',
      text: '#4A3728',
      textMuted: '#8C7A6B',
      border: '#DDD0C2',
      accent: '#B85C38',
    },
    typography: {
      fontFamily: 'DM Sans',
      displayFont: 'EB Garamond',
      baseFontSize: 17,
      bodyWeight: 400,
      headingWeight: 600,
      headingTracking: 0.01,
      bodyLineHeight: 1.75,
      headingTransform: 'none',
    },
    shadows: { type: 'soft', color: 'rgba(156,107,58,0.1)', intensity: 30 },
    animations: { level: 'subtle', easing: [0.25, 0.1, 0.25, 1], durationScale: 1.2, scrollTrigger: true, hoverEffects: true },
    layout: { borderRadius: 24, borderWidth: 2, maxWidth: 1100, spacingScale: 1.2, cardStyle: 'elevated', headerStyle: 'floating' },
  },

  // ─── 7. ORIGIN — Terroir & Geography ─────────────────────────────────
  // Warm earth tones, maps and exploration vibes
  // Like a coffee origin catalog
  origin: {
    colors: {
      primary: '#6B4E3D',
      secondary: '#A0845C',
      background: '#F0EBE3',
      surface: '#FAF7F2',
      text: '#3D2E24',
      textMuted: '#7A6B5C',
      border: '#D4C8B8',
      accent: '#C75B39',
    },
    typography: {
      fontFamily: 'Space Grotesk',
      displayFont: 'Source Serif 4',
      baseFontSize: 16,
      bodyWeight: 400,
      headingWeight: 700,
      headingTracking: 0.02,
      bodyLineHeight: 1.7,
      headingTransform: 'uppercase',
    },
    shadows: { type: 'soft', color: 'rgba(107,78,61,0.12)', intensity: 35 },
    animations: { level: 'moderate', easing: [0.16, 1, 0.3, 1], durationScale: 1.0, scrollTrigger: true, hoverEffects: true },
    layout: { borderRadius: 8, borderWidth: 2, maxWidth: 1300, spacingScale: 1.1, cardStyle: 'outlined', headerStyle: 'fixed' },
  },

  // ─── 8. ROASTERY — Industrial Craft ──────────────────────────────────
  // Exposed elements, warm metals, workshop feel
  // Like a roastery floor with copper and steel
  roastery: {
    colors: {
      primary: '#C8A882',
      secondary: '#8B7355',
      background: '#1E1B18',
      surface: '#2A2520',
      text: '#E8DDD0',
      textMuted: '#9A8B78',
      border: '#3D352C',
      accent: '#D4944A',
    },
    typography: {
      fontFamily: 'Space Mono',
      displayFont: 'Space Grotesk',
      baseFontSize: 15,
      bodyWeight: 400,
      headingWeight: 700,
      headingTracking: 0.04,
      bodyLineHeight: 1.65,
      headingTransform: 'uppercase',
    },
    shadows: { type: 'none', color: 'transparent', intensity: 0 },
    animations: { level: 'moderate', easing: [0.16, 1, 0.3, 1], durationScale: 0.8, scrollTrigger: true, hoverEffects: true },
    layout: { borderRadius: 4, borderWidth: 1, maxWidth: 1400, spacingScale: 1.0, cardStyle: 'outlined', headerStyle: 'fixed' },
  },

  // ─── 9. CUPPING — Professional Tasting Room ──────────────────────────
  // Clean, precise, neutral like a cupping lab
  // White, gray, with subtle warm accents
  cupping: {
    colors: {
      primary: '#4A4A4A',
      secondary: '#7A7A7A',
      background: '#FAFAFA',
      surface: '#FFFFFF',
      text: '#2A2A2A',
      textMuted: '#8A8A8A',
      border: '#E5E5E5',
      accent: '#A67C52',
    },
    typography: {
      fontFamily: 'Inter',
      displayFont: 'Inter',
      baseFontSize: 15,
      bodyWeight: 400,
      headingWeight: 600,
      headingTracking: -0.02,
      bodyLineHeight: 1.65,
      headingTransform: 'none',
    },
    shadows: { type: 'soft', color: 'rgba(0,0,0,0.06)', intensity: 20 },
    animations: { level: 'subtle', easing: [0.22, 1, 0.36, 1], durationScale: 1.0, scrollTrigger: true, hoverEffects: true },
    layout: { borderRadius: 8, borderWidth: 1, maxWidth: 1200, spacingScale: 1.1, cardStyle: 'elevated', headerStyle: 'static' },
  },

  // ─── 10. SPECIALTY — Premium Single-Origin ───────────────────────────
  // Elegant, refined, like a high-end coffee subscription
  // Dark with gold accents, luxurious feel
  specialty: {
    colors: {
      primary: '#D4AF37',
      secondary: '#B8972E',
      background: '#0F0E0C',
      surface: '#1A1815',
      text: '#F5F0E8',
      textMuted: '#A09880',
      border: '#2D2820',
      accent: '#D4AF37',
    },
    typography: {
      fontFamily: 'Playfair Display',
      displayFont: 'Playfair Display',
      baseFontSize: 17,
      bodyWeight: 400,
      headingWeight: 700,
      headingTracking: 0.03,
      bodyLineHeight: 1.75,
      headingTransform: 'none',
    },
    shadows: { type: 'soft', color: 'rgba(212,175,55,0.1)', intensity: 40 },
    animations: { level: 'cinematic', easing: [0.16, 1, 0.3, 1], durationScale: 1.5, scrollTrigger: true, hoverEffects: true },
    layout: { borderRadius: 2, borderWidth: 1, maxWidth: 1200, spacingScale: 1.4, cardStyle: 'elevated', headerStyle: 'static' },
  },
};

// =============================================================================
// DEFAULT CONFIG
// =============================================================================

export const DEFAULT_THEME_CONFIG: ThemeConfig = THEME_PRESETS.artisan;

export function getThemePreset(layoutStyle?: string | null): ThemeConfig {
  const normalized = layoutStyle?.toLowerCase() || 'artisan';
  const presetId = THEME_PRESET_ALIASES[normalized] || normalized;
  return THEME_PRESETS[presetId] || THEME_PRESETS.artisan;
}
