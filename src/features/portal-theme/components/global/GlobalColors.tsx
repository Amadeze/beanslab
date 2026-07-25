// =============================================================================
// GLOBAL COLORS PANEL — Visual, creative color editor with palette presets
// =============================================================================

"use client";

import { useState } from "react";
import { useCustomizerStore } from "../../client/store";
import type { PortalColorTokens } from "../../types";

const PRESET_PALETTES: Array<{ name: string; colors: Partial<PortalColorTokens> }> = [
  {
    name: "Roast Copper",
    colors: { primary: "#B65331", secondary: "#426C7A", accent: "#D4A574", background: "#FAFAF8", surface: "#FFFFFF", text: "#1A1A1A" },
  },
  {
    name: "Midnight Espresso",
    colors: { primary: "#8B5E3C", secondary: "#2D2D2D", accent: "#C9A87C", background: "#0F0F0F", surface: "#1A1A1A", text: "#F5F0EB", textMuted: "#9A9490", textInverse: "#1A1A1A" },
  },
  {
    name: "Forest Roast",
    colors: { primary: "#2B7567", secondary: "#4A6741", accent: "#8FB996", background: "#F7F9F7", surface: "#FFFFFF", text: "#1C2E1C" },
  },
  {
    name: "Burgundy Reserve",
    colors: { primary: "#8C2F39", secondary: "#5C1A24", accent: "#D4756B", background: "#FBF8F8", surface: "#FFFFFF", text: "#2A1215" },
  },
  {
    name: "Slate Minimal",
    colors: { primary: "#4B5152", secondary: "#6B7280", accent: "#9CA3AF", background: "#FFFFFF", surface: "#F9FAFB", text: "#111827" },
  },
  {
    name: "Warm Luxe",
    colors: { primary: "#92400E", secondary: "#78350F", accent: "#F59E0B", background: "#FFFBEB", surface: "#FFFFFF", text: "#1C1917" },
  },
];

const COLOR_GROUPS = [
  {
    label: "Brand",
    colors: [
      { key: "primary" as const, label: "Primary", desc: "Main brand color" },
      { key: "secondary" as const, label: "Secondary", desc: "Supporting color" },
      { key: "accent" as const, label: "Accent", desc: "Highlights & emphasis" },
    ],
  },
  {
    label: "Surface",
    colors: [
      { key: "background" as const, label: "Background", desc: "Page background" },
      { key: "surface" as const, label: "Surface", desc: "Cards & panels" },
      { key: "surfaceAlt" as const, label: "Surface Alt", desc: "Alternating sections" },
    ],
  },
  {
    label: "Text",
    colors: [
      { key: "text" as const, label: "Text", desc: "Primary text" },
      { key: "textMuted" as const, label: "Muted", desc: "Secondary text" },
      { key: "textInverse" as const, label: "Inverse", desc: "Text on dark bg" },
    ],
  },
  {
    label: "Border",
    colors: [
      { key: "border" as const, label: "Border", desc: "Default borders" },
      { key: "borderSubtle" as const, label: "Subtle", desc: "Light dividers" },
    ],
  },
  {
    label: "Status",
    colors: [
      { key: "error" as const, label: "Error", desc: "Errors & destructive" },
      { key: "success" as const, label: "Success", desc: "Positive actions" },
      { key: "warning" as const, label: "Warning", desc: "Caution states" },
      { key: "info" as const, label: "Info", desc: "Informational" },
    ],
  },
];

export function GlobalColorsPanel() {
  const colors = useCustomizerStore((s) => s.workingDraft.globalSettings.colors);
  const updateGlobalColors = useCustomizerStore((s) => s.updateGlobalColors);
  const [expandedGroup, setExpandedGroup] = useState<string | null>("Brand");
  const [showPresets, setShowPresets] = useState(false);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Colors</h3>
        <button
          onClick={() => setShowPresets(!showPresets)}
          className="text-[10px] font-medium text-blue-500 hover:text-blue-700"
        >
          {showPresets ? "Custom" : "Presets"}
        </button>
      </div>

      {/* Palette Preview */}
      <div className="rounded-xl overflow-hidden border border-gray-200">
        <div className="flex h-8">
          {["primary", "secondary", "accent", "background", "surface", "text"].map((key) => (
            <div
              key={key}
              className="flex-1 transition-colors duration-200"
              style={{ backgroundColor: colors[key as keyof PortalColorTokens] }}
              title={key}
            />
          ))}
        </div>
        <div className="flex items-center justify-between px-3 py-2 bg-gray-50">
          <span className="text-[9px] text-gray-400 font-mono">Live Palette</span>
          <div className="flex gap-1">
            {["primary", "secondary", "accent"].map((key) => (
              <span key={key} className="text-[9px] font-mono" style={{ color: colors[key as keyof PortalColorTokens] }}>
                {colors[key as keyof PortalColorTokens]}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Preset Palettes */}
      {showPresets && (
        <div className="space-y-2">
          <p className="text-[9px] text-gray-400">Click a preset to apply</p>
          {PRESET_PALETTES.map((preset) => (
            <button
              key={preset.name}
              onClick={() => updateGlobalColors(preset.colors)}
              className="w-full rounded-lg border border-gray-200 p-2.5 text-left hover:border-blue-300 hover:bg-blue-50/50 transition-all group"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-6 w-16 rounded-md overflow-hidden shrink-0">
                  {["primary", "secondary", "accent", "background", "surface"].map((k) => (
                    <div
                      key={k}
                      className="flex-1"
                      style={{ backgroundColor: (preset.colors as any)[k] || "#ccc" }}
                    />
                  ))}
                </div>
                <span className="text-[10px] font-semibold text-gray-600 group-hover:text-blue-700">{preset.name}</span>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Color Groups */}
      {!showPresets && (
        <div className="space-y-1">
          {COLOR_GROUPS.map((group) => {
            const isExpanded = expandedGroup === group.label;
            return (
              <div key={group.label}>
                <button
                  onClick={() => setExpandedGroup(isExpanded ? null : group.label)}
                  className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-[10px] font-semibold text-gray-500 hover:bg-gray-50 transition-colors"
                >
                  {group.label}
                  <span className="text-gray-300">{isExpanded ? "−" : "+"}</span>
                </button>
                {isExpanded && (
                  <div className="space-y-1 pb-2">
                    {group.colors.map(({ key, label, desc }) => (
                      <div key={key} className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-gray-50 transition-colors group">
                        {/* Color swatch with picker */}
                        <div className="relative shrink-0">
                          <input
                            type="color"
                            value={colors[key]}
                            onChange={(e) => updateGlobalColors({ [key]: e.target.value })}
                            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                          />
                          <div
                            className="h-8 w-8 rounded-lg border border-gray-200 shadow-sm group-hover:shadow-md transition-shadow cursor-pointer"
                            style={{ backgroundColor: colors[key] }}
                          />
                        </div>
                        {/* Label */}
                        <div className="min-w-0 flex-1">
                          <div className="text-[11px] font-medium text-gray-700">{label}</div>
                          <div className="text-[9px] text-gray-400">{desc}</div>
                        </div>
                        {/* Hex value */}
                        <span className="text-[9px] font-mono text-gray-400 shrink-0">{colors[key]}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
