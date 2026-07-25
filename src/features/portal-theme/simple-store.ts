"use client";

// =============================================================================
// SIMPLE STORE — Full section editing, not just colors
// =============================================================================

import { create } from "zustand";

export interface Section {
  id: string;
  type: string;
  enabled: boolean;
  settings: Record<string, any>;
}

interface SimpleState {
  colors: Record<string, string>;
  headingFont: string;
  bodyFont: string;
  fontSize: number;
  sections: Section[];
  selectedSectionId: string | null;

  setColor: (key: string, value: string) => void;
  setHeadingFont: (font: string) => void;
  setBodyFont: (font: string) => void;
  setFontSize: (size: number) => void;
  selectSection: (id: string | null) => void;
  addSection: (type: string) => void;
  removeSection: (id: string) => void;
  toggleSection: (id: string) => void;
  updateSection: (id: string, settings: Record<string, any>) => void;
  moveSection: (fromIndex: number, toIndex: number) => void;
  duplicateSection: (id: string) => void;
}

const uid = () => `s_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

const SECTION_DEFAULTS: Record<string, Record<string, any>> = {
  hero: { title: "Premium Coffee Beans", subtitle: "Roasted to order for your business", buttonText: "View Catalog", buttonLink: "#catalog", imageUrl: "" },
  benefits: { items: [{ icon: "★", title: "Traceable Origin", desc: "Every bean sourced with care" }, { icon: "⚡", title: "Fresh Roasted", desc: "Roasted within 48 hours" }, { icon: "🛡", title: "Quality Guaranteed", desc: "Satisfaction guaranteed" }] },
  text: { title: "About Us", content: "Welcome to our official wholesale portal. We provide specialty coffee beans roasted fresh for your business." },
  faq: { title: "Frequently Asked Questions", items: [{ q: "How do I place an order?", a: "Browse our catalog and contact us via WhatsApp." }, { q: "What are the minimum order quantities?", a: "MOQ varies by product. Contact us for details." }] },
  contact: { title: "Get in Touch", text: "Ready to order? We're here to help.", buttonText: "Contact Us", buttonLink: "#" },
  catalog: { title: "The Collection", subtitle: "Meticulously profiled and roasted for consistency", columns: 3 },
  testimonials: { title: "What Partners Say", items: [{ name: "Cafe Owner", role: "Premium Cafe", text: "Outstanding quality and consistency. Our customers love it.", rating: 5 }] },
  newsletter: { title: "Stay Updated", subtitle: "Get the latest news and offers", placeholder: "Enter your email", buttonText: "Subscribe" },
  gallery: { title: "Our Space", columns: 3, items: [] },
  video: { title: "Watch Our Story", videoUrl: "" },
  countdown: { title: "Limited Time Offer", targetDate: "", expiredText: "Offer has expired" },
  marquee: { text: "★ Fresh Roasted ★ Traceable Origin ★ Specialty Grade ★ Roasted to Order ★", speed: 20 },
  divider: { style: "line", color: "primary", spacing: "md" },
  spacer: { height: 80 },
};

const DEFAULT_SECTIONS: Section[] = [
  { id: "s1", type: "hero", enabled: true, settings: { ...SECTION_DEFAULTS.hero } },
  { id: "s2", type: "benefits", enabled: true, settings: { ...SECTION_DEFAULTS.benefits, items: [...SECTION_DEFAULTS.benefits.items] } },
  { id: "s3", type: "text", enabled: true, settings: { ...SECTION_DEFAULTS.text } },
  { id: "s4", type: "faq", enabled: true, settings: { ...SECTION_DEFAULTS.faq, items: [...SECTION_DEFAULTS.faq.items] } },
  { id: "s5", type: "contact", enabled: true, settings: { ...SECTION_DEFAULTS.contact } },
];

export const SECTION_TYPES = [
  { type: "hero", label: "Hero Banner", icon: "🎯", desc: "Full-width hero with title, subtitle, image" },
  { type: "text", label: "Rich Text", icon: "📝", desc: "Text content block" },
  { type: "benefits", label: "Benefits", icon: "✨", desc: "Feature cards with icons" },
  { type: "faq", label: "FAQ", icon: "❓", desc: "Accordion questions" },
  { type: "contact", label: "Contact CTA", icon: "📞", desc: "Call-to-action with contact" },
  { type: "catalog", label: "Product Grid", icon: "🛍", desc: "Product catalog grid" },
  { type: "testimonials", label: "Testimonials", icon: "💬", desc: "Customer reviews" },
  { type: "newsletter", label: "Newsletter", icon: "📧", desc: "Email signup form" },
  { type: "gallery", label: "Gallery", icon: "🖼", desc: "Image grid" },
  { type: "video", label: "Video", icon: "🎬", desc: "Embedded video" },
  { type: "countdown", label: "Countdown", icon: "⏰", desc: "Timer countdown" },
  { type: "marquee", label: "Marquee", icon: "📢", desc: "Scrolling text ticker" },
  { type: "divider", label: "Divider", icon: "➖", desc: "Visual separator" },
  { type: "spacer", label: "Spacer", icon: "↕️", desc: "Empty space" },
];

const PRESETS: Record<string, Record<string, string>> = {
  "Heritage Craft": { primary: "#8B4513", secondary: "#A0522D", accent: "#D4A574", bg: "#FDF8F0", surface: "#FFFFFF", surfaceAlt: "#F5EDE0", text: "#2C1810", textMuted: "#8B7355", textInverse: "#FDF8F0", border: "#E8D5B7", borderSubtle: "#F0E6D3" },
  "Neo-Modern": { primary: "#1A1A1A", secondary: "#404040", accent: "#FF6B35", bg: "#FAFAFA", surface: "#FFFFFF", surfaceAlt: "#F0F0F0", text: "#0A0A0A", textMuted: "#737373", textInverse: "#FAFAFA", border: "#E5E5E5", borderSubtle: "#F0F0F0" },
  "Cyber Barista": { primary: "#00F0FF", secondary: "#7B2FFF", accent: "#FF006E", bg: "#0A0A0F", surface: "#12121A", surfaceAlt: "#1A1A25", text: "#E0E0FF", textMuted: "#6B6B8A", textInverse: "#0A0A0F", border: "#2A2A3A", borderSubtle: "#1E1E2A" },
  "Botanical": { primary: "#2D6A4F", secondary: "#40916C", accent: "#95D5B2", bg: "#F7FBF7", surface: "#FFFFFF", surfaceAlt: "#EDF5ED", text: "#1B4332", textMuted: "#52796F", textInverse: "#F7FBF7", border: "#B7E4C7", borderSubtle: "#D8F3DC" },
  "Editorial": { primary: "#1A1A1A", secondary: "#C9A87C", accent: "#D4756B", bg: "#FFFEF9", surface: "#FFFFFF", surfaceAlt: "#F8F6F0", text: "#1A1A1A", textMuted: "#6B6560", textInverse: "#FFFEF9", border: "#E8E4DA", borderSubtle: "#F0ECE3" },
  "Liquid": { primary: "#5B4A8A", secondary: "#8B6FB0", accent: "#E8B4B8", bg: "#F8F5FA", surface: "#FFFFFF", surfaceAlt: "#F0ECF5", text: "#1A1528", textMuted: "#7B6F8A", textInverse: "#F8F5FA", border: "#DDD5E8", borderSubtle: "#EDE8F5" },
  "Industrial": { primary: "#D97706", secondary: "#92400E", accent: "#FCD34D", bg: "#1C1917", surface: "#292524", surfaceAlt: "#3A3533", text: "#F5F5F4", textMuted: "#A8A29E", textInverse: "#1C1917", border: "#44403C", borderSubtle: "#292524" },
  "Coffee Club": { primary: "#B45309", secondary: "#92400E", accent: "#F59E0B", bg: "#FFFBEB", surface: "#FFFFFF", surfaceAlt: "#FEF3C7", text: "#1C1917", textMuted: "#78716C", textInverse: "#FFFBEB", border: "#FDE68A", borderSubtle: "#FEF3C7" },
  "Luxury": { primary: "#1A1A1A", secondary: "#333333", accent: "#C9A96E", bg: "#FAFAF8", surface: "#FFFFFF", surfaceAlt: "#F5F4F0", text: "#0A0A0A", textMuted: "#6B6B6B", textInverse: "#FAFAF8", border: "#E5E4E0", borderSubtle: "#F0EFEB" },
  "Playful": { primary: "#E11D48", secondary: "#7C3AED", accent: "#FBBF24", bg: "#FFF1F2", surface: "#FFFFFF", surfaceAlt: "#FFF1F2", text: "#1F1235", textMuted: "#6B7280", textInverse: "#FFF1F2", border: "#FECDD3", borderSubtle: "#FFE4E6" },
};

export const useSimpleStore = create<SimpleState>((set) => ({
  colors: { primary: "#B65331", secondary: "#426C7A", accent: "#D4A574", bg: "#FAFAF8", surface: "#FFFFFF", surfaceAlt: "#F5F3EF", text: "#1A1A1A", textMuted: "#6B7280", textInverse: "#FFFFFF", border: "#E5E5E5", borderSubtle: "#F0F0F0" },
  headingFont: "Playfair Display",
  bodyFont: "Inter",
  fontSize: 16,
  sections: DEFAULT_SECTIONS.map((s) => ({ ...s, settings: { ...s.settings } })),
  selectedSectionId: null,

  setColor: (key, value) => set((s) => ({ colors: { ...s.colors, [key]: value } })),
  setHeadingFont: (font) => set({ headingFont: font }),
  setBodyFont: (font) => set({ bodyFont: font }),
  setFontSize: (size) => set({ fontSize: size }),
  selectSection: (id) => set({ selectedSectionId: id }),

  addSection: (type) => set((s) => {
    const defaults = SECTION_DEFAULTS[type] || {};
    const newSection: Section = { id: uid(), type, enabled: true, settings: JSON.parse(JSON.stringify(defaults)) };
    const selectedIdx = s.sections.findIndex((sec) => sec.id === s.selectedSectionId);
    const insertAt = selectedIdx >= 0 ? selectedIdx + 1 : s.sections.length;
    const sections = [...s.sections];
    sections.splice(insertAt, 0, newSection);
    return { sections, selectedSectionId: newSection.id };
  }),

  removeSection: (id) => set((s) => ({
    sections: s.sections.filter((sec) => sec.id !== id),
    selectedSectionId: s.selectedSectionId === id ? null : s.selectedSectionId,
  })),

  toggleSection: (id) => set((s) => ({
    sections: s.sections.map((sec) => sec.id === id ? { ...sec, enabled: !sec.enabled } : sec),
  })),

  updateSection: (id, settings) => set((s) => ({
    sections: s.sections.map((sec) => sec.id === id ? { ...sec, settings: { ...sec.settings, ...settings } } : sec),
  })),

  moveSection: (from, to) => set((s) => {
    const sections = [...s.sections];
    const [moved] = sections.splice(from, 1);
    sections.splice(to, 0, moved);
    return { sections };
  }),

  duplicateSection: (id) => set((s) => {
    const idx = s.sections.findIndex((sec) => sec.id === id);
    if (idx < 0) return s;
    const original = s.sections[idx];
    const dup: Section = { ...original, id: uid(), settings: JSON.parse(JSON.stringify(original.settings)) };
    const sections = [...s.sections];
    sections.splice(idx + 1, 0, dup);
    return { sections, selectedSectionId: dup.id };
  }),
}));

export function applyPreset(name: string) {
  const preset = PRESETS[name];
  if (!preset) return;
  const store = useSimpleStore.getState();
  Object.entries(preset).forEach(([key, value]) => store.setColor(key, value));
}

export function getPresetNames() { return Object.keys(PRESETS); }
export function getPresets() { return PRESETS; }
