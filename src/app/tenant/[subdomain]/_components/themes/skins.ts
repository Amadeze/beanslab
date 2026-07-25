// =============================================================================
// THEME SKINS — 10 Coffee World Visual Configurations
// =============================================================================
// Each skin defines Tailwind classes for UI components.
// Skins are resolved from the tenant's layoutStyle setting.
// =============================================================================

import React from "react";
import { ThemeSkin } from "./ThemeSkin";
import { THEME_PRESET_ALIASES } from "./ThemeConfig";

export const THEME_SKINS: Record<string, ThemeSkin> = {

  // ─── 1. HERITAGE — Vintage Coffee House ──────────────────────────────
  heritage: {
    containerClass: "bg-[#F5EDE0] text-[#3E2723] font-serif",
    cardClass: "bg-[#FDF8F0] border-2 border-[#D4C4B0] shadow-sm rounded-md",
    buttonPrimaryClass: "bg-[#5C3D2E] text-[#F5EDE0] hover:bg-[#5C3D2E]/90 rounded-md font-bold py-3 px-6 transition-all",
    buttonSecondaryClass: "border-2 border-[#5C3D2E] text-[#5C3D2E] hover:bg-[#5C3D2E]/5 transition-all rounded-md",
    heroImageClass: "rounded-lg shadow-md",
    overlay: React.createElement("div", {
      className: "pointer-events-none fixed inset-0 z-50 opacity-[0.04]",
      style: {
        backgroundImage: "repeating-linear-gradient(13deg, currentColor 0, currentColor 1px, transparent 1px, transparent 7px), repeating-linear-gradient(103deg, currentColor 0, currentColor 1px, transparent 1px, transparent 11px)",
        backgroundSize: "47px 53px, 61px 43px",
      }
    }),
    inputClass: "bg-[#FDF8F0] border-2 border-[#D4C4B0] text-[#3E2723] placeholder:text-[#3E2723]/30 rounded-md focus:border-[#5C3D2E]/50",
    badgeClass: "bg-[#5C3D2E]/10 text-[#5C3D2E] border border-[#5C3D2E]/20 rounded-full text-xs",
    dividerClass: "border-[#D4C4B0]",
    priceClass: "text-[#5C3D2E] font-serif font-bold text-lg",
    accentClass: "text-[#C17817]",
  },

  // ─── 2. ARTISAN — Modern Craft Roastery (Dark Premium) ───────────────
  artisan: {
    containerClass: "bg-[#080B0C] text-[#F8FAFC] font-sans",
    cardClass: "bg-[#111617] border border-white/10 shadow-lg rounded-2xl",
    buttonPrimaryClass: "bg-[#B65331] text-white hover:bg-[#984024] rounded-none font-black py-3 px-6 transition-all",
    buttonSecondaryClass: "border border-white/20 text-white/62 hover:border-white/40 hover:text-white transition-all rounded-none",
    heroImageClass: "rounded-2xl shadow-2xl",
    inputClass: "bg-[#111617] border border-white/10 text-[#F8FAFC] placeholder:text-[#8B95A5] rounded-xl focus:border-[#B65331]",
    badgeClass: "bg-[#B65331]/15 text-[#E9A17F] border border-[#B65331]/30 rounded-full text-xs",
    dividerClass: "border-white/10",
    priceClass: "text-[#B65331] font-sans font-bold text-lg",
    accentClass: "text-[#15B8C6]",
  },

  // ─── 3. NOIR — Dark Roast Sophistication ─────────────────────────────
  noir: {
    containerClass: "bg-[#1A1612] text-[#E8D5B7] font-sans",
    cardClass: "bg-[#231F1B] border border-[#3D352D] shadow-lg rounded-xl",
    buttonPrimaryClass: "bg-[#D4A574] text-[#1A1612] hover:bg-[#D4A574]/90 rounded-full font-bold py-3 px-6 transition-all",
    buttonSecondaryClass: "border border-[#D4A574]/40 text-[#D4A574] hover:bg-[#D4A574]/10 transition-all rounded-full",
    heroImageClass: "rounded-xl shadow-2xl",
    inputClass: "bg-[#231F1B] border border-[#3D352D] text-[#E8D5B7] placeholder:text-[#9A8B7A] rounded-xl focus:border-[#D4A574]/50",
    badgeClass: "bg-[#D4A574]/10 text-[#D4A574] border border-[#D4A574]/20 rounded-full text-xs",
    dividerClass: "border-[#3D352D]",
    priceClass: "text-[#D4A574] font-sans font-bold text-lg",
    accentClass: "text-[#D4A574]",
  },

  // ─── 4. BOTANICAL — Green Coffee Origins ─────────────────────────────
  botanical: {
    containerClass: "bg-[#F2F5EF] text-[#2D3B28] font-sans",
    cardClass: "bg-white border border-[#C8D4BC] shadow-sm rounded-2xl",
    buttonPrimaryClass: "bg-[#4A6741] text-white hover:bg-[#4A6741]/90 rounded-full font-bold py-3 px-6 transition-all",
    buttonSecondaryClass: "border border-[#4A6741] text-[#4A6741] hover:bg-[#4A6741]/5 transition-all rounded-full",
    heroImageClass: "rounded-3xl shadow-md",
    inputClass: "bg-white border border-[#C8D4BC] text-[#2D3B28] placeholder:text-[#6B7D63] rounded-full focus:border-[#4A6741]",
    badgeClass: "bg-[#4A6741]/10 text-[#4A6741] border border-[#4A6741]/15 rounded-full text-xs",
    dividerClass: "border-[#C8D4BC]",
    priceClass: "text-[#4A6741] font-sans font-bold text-lg",
    accentClass: "text-[#8B6F47]",
  },

  // ─── 5. KINFOLK — Editorial Minimalism ───────────────────────────────
  kinfolk: {
    containerClass: "bg-[#FEFEFE] text-[#1A1A1A] font-serif",
    cardClass: "bg-white border border-[#EAEAEA] shadow-none rounded-sm",
    buttonPrimaryClass: "bg-[#1A1A1A] text-white hover:bg-[#1A1A1A]/90 rounded-none uppercase tracking-widest text-xs font-bold py-3 px-6 transition-all",
    buttonSecondaryClass: "border border-[#1A1A1A] text-[#1A1A1A] hover:bg-[#1A1A1A]/5 transition-all rounded-none uppercase tracking-widest text-xs",
    heroImageClass: "rounded-sm",
    inputClass: "bg-white border border-[#EAEAEA] text-[#1A1A1A] placeholder:text-[#999] rounded-none focus:border-[#1A1A1A]",
    badgeClass: "bg-[#1A1A1A]/5 text-[#1A1A1A] border border-[#1A1A1A]/10 rounded-none text-xs uppercase tracking-wider",
    dividerClass: "border-[#EAEAEA]",
    priceClass: "text-[#1A1A1A] font-serif font-bold text-lg",
    accentClass: "text-[#B8956A]",
  },

  // ─── 6. CERAMIC — Coffee Cup Aesthetics ──────────────────────────────
  ceramic: {
    containerClass: "bg-[#F7F2EC] text-[#4A3728] font-sans",
    cardClass: "bg-white border border-[#DDD0C2] shadow-sm rounded-3xl",
    buttonPrimaryClass: "bg-[#9C6B3A] text-white hover:bg-[#9C6B3A]/90 rounded-full font-bold py-3 px-6 transition-all",
    buttonSecondaryClass: "border border-[#9C6B3A] text-[#9C6B3A] hover:bg-[#9C6B3A]/5 transition-all rounded-full",
    heroImageClass: "rounded-3xl shadow-md",
    inputClass: "bg-white border border-[#DDD0C2] text-[#4A3728] placeholder:text-[#8C7A6B] rounded-2xl focus:border-[#9C6B3A]",
    badgeClass: "bg-[#9C6B3A]/10 text-[#9C6B3A] border border-[#9C6B3A]/15 rounded-full text-xs",
    dividerClass: "border-[#DDD0C2]",
    priceClass: "text-[#9C6B3A] font-sans font-bold text-lg",
    accentClass: "text-[#B85C38]",
  },

  // ─── 7. ORIGIN — Terroir & Geography ─────────────────────────────────
  origin: {
    containerClass: "bg-[#F0EBE3] text-[#3D2E24] font-sans",
    cardClass: "bg-[#FAF7F2] border-2 border-[#D4C8B8] shadow-sm rounded-lg",
    buttonPrimaryClass: "bg-[#6B4E3D] text-white hover:bg-[#6B4E3D]/90 rounded-lg font-bold py-3 px-6 transition-all",
    buttonSecondaryClass: "border-2 border-[#6B4E3D] text-[#6B4E3D] hover:bg-[#6B4E3D]/5 transition-all rounded-lg",
    heroImageClass: "rounded-lg shadow-md",
    inputClass: "bg-white border-2 border-[#D4C8B8] text-[#3D2E24] placeholder:text-[#7A6B5C] rounded-lg focus:border-[#6B4E3D]",
    badgeClass: "bg-[#6B4E3D]/10 text-[#6B4E3D] border border-[#6B4E3D]/20 rounded-md text-xs uppercase tracking-wider",
    dividerClass: "border-[#D4C8B8]",
    priceClass: "text-[#6B4E3D] font-sans font-bold text-lg",
    accentClass: "text-[#C75B39]",
  },

  // ─── 8. ROASTERY — Industrial Craft ──────────────────────────────────
  roastery: {
    containerClass: "bg-[#1E1B18] text-[#E8DDD0] font-mono",
    cardClass: "bg-[#2A2520] border border-[#3D352C] shadow-none rounded-sm",
    buttonPrimaryClass: "bg-[#D4944A] text-[#1E1B18] hover:bg-[#D4944A]/90 rounded-none uppercase tracking-widest text-xs font-bold py-3 px-6 transition-all",
    buttonSecondaryClass: "border border-[#D4944A]/40 text-[#D4944A] hover:bg-[#D4944A]/10 transition-all rounded-none uppercase tracking-widest text-xs",
    heroImageClass: "rounded-none",
    inputClass: "bg-[#2A2520] border border-[#3D352C] text-[#E8DDD0] placeholder:text-[#9A8B78] rounded-none focus:border-[#D4944A]/50",
    badgeClass: "bg-[#D4944A]/10 text-[#D4944A] border border-[#D4944A]/20 rounded-none text-xs uppercase tracking-widest",
    dividerClass: "border-[#3D352C]",
    priceClass: "text-[#D4944A] font-mono font-bold text-lg",
    accentClass: "text-[#D4944A]",
  },

  // ─── 9. CUPPING — Professional Tasting Room ──────────────────────────
  cupping: {
    containerClass: "bg-[#FAFAFA] text-[#2A2A2A] font-sans",
    cardClass: "bg-white border border-[#E5E5E5] shadow-sm rounded-xl",
    buttonPrimaryClass: "bg-[#4A4A4A] text-white hover:bg-[#4A4A4A]/90 rounded-lg font-bold py-3 px-6 transition-all",
    buttonSecondaryClass: "border border-[#4A4A4A] text-[#4A4A4A] hover:bg-[#4A4A4A]/5 transition-all rounded-lg",
    heroImageClass: "rounded-xl shadow-sm",
    inputClass: "bg-white border border-[#E5E5E5] text-[#2A2A2A] placeholder:text-[#8A8A8A] rounded-lg focus:border-[#4A4A4A]",
    badgeClass: "bg-[#4A4A4A]/10 text-[#4A4A4A] border border-[#4A4A4A]/15 rounded-full text-xs",
    dividerClass: "border-[#E5E5E5]",
    priceClass: "text-[#4A4A4A] font-sans font-bold text-lg",
    accentClass: "text-[#A67C52]",
  },

  // ─── 10. SPECIALTY — Premium Single-Origin ───────────────────────────
  specialty: {
    containerClass: "bg-[#0F0E0C] text-[#F5F0E8] font-serif selection:bg-[#D4AF37]/20",
    cardClass: "bg-[#1A1815] border border-[#2D2820] shadow-lg rounded-sm",
    buttonPrimaryClass: "bg-[#D4AF37] text-[#0F0E0C] hover:bg-[#D4AF37]/90 rounded-none uppercase tracking-[0.15em] text-xs font-bold py-3 px-6 transition-all",
    buttonSecondaryClass: "border border-[#D4AF37]/30 text-[#D4AF37] hover:bg-[#D4AF37]/10 transition-all rounded-none uppercase tracking-[0.15em] text-xs",
    heroImageClass: "rounded-sm shadow-2xl",
    inputClass: "bg-[#1A1815] border border-[#2D2820] text-[#F5F0E8] placeholder:text-[#A09880] rounded-none focus:border-[#D4AF37]/50",
    badgeClass: "bg-[#D4AF37]/10 text-[#D4AF37] border border-[#D4AF37]/20 rounded-none text-xs uppercase tracking-widest",
    dividerClass: "border-[#2D2820]",
    priceClass: "text-[#D4AF37] font-serif font-bold text-lg",
    accentClass: "text-[#D4AF37]",
  },
};

/**
 * Resolve a skin from layoutStyle with artisan fallback.
 */
export function resolveSkin(layoutStyle?: string | null): ThemeSkin {
  const requested = layoutStyle?.toLowerCase() || "artisan";
  const key = THEME_PRESET_ALIASES[requested] || requested;
  return THEME_SKINS[key] || THEME_SKINS.artisan;
}
