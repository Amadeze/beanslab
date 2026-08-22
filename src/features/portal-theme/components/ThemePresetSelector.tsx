"use client";

import { useState } from "react";
import { Check, Grid2X2, Layers3, Palette, Shapes } from "lucide-react";
import { THEME_PRESETS } from "../defaults/theme-presets";
import { CURATED_THEME_FAMILIES } from "../defaults/curated-families";
import { applyCuratedTheme, type ThemeApplyMode } from "../defaults/theme-blueprints";
import { useCustomizerStore } from "../client/store";

const LAYOUT_MARKS: Record<string, string[]> = {
  modern_catalog: ["col-span-2 h-5", "h-5", "h-3", "h-3", "h-3"],
  editorial_journal: ["col-span-3 h-4", "col-span-2 h-7", "h-7", "col-span-3 h-2"],
  origin_field_notes: ["col-span-2 h-6", "h-6", "h-4", "h-4", "h-4"],
  tactile_brutalist: ["col-span-3 h-7", "h-5", "h-5", "h-5"],
  reserve_microlot: ["col-span-3 h-6", "col-span-2 h-8", "h-8", "col-span-3 h-2"],
  community_roastery: ["col-span-2 h-6", "h-6", "h-3", "h-5", "h-3"],
};

export function ThemePresetSelector() {
  const [selectedFamilyId, setSelectedFamilyId] = useState<string | null>(null);
  const [showLegacy, setShowLegacy] = useState(false);
  const workingDraft = useCustomizerStore((state) => state.workingDraft);
  const applyThemeConfig = useCustomizerStore((state) => state.applyThemeConfig);

  const applyFamily = (familyId: string, mode: ThemeApplyMode) => {
    applyThemeConfig(applyCuratedTheme(workingDraft, familyId, mode));
    setSelectedFamilyId(null);
  };

  const applyLegacyStyle = (presetId: string) => {
    const preset = THEME_PRESETS.find((item) => item.id === presetId);
    if (!preset) return;
    applyThemeConfig({
      ...workingDraft,
      themeKey: preset.id,
      globalSettings: {
        ...workingDraft.globalSettings,
        colors: { ...preset.colors },
        typography: { ...preset.typography },
        layout: { ...preset.layout },
        animations: { ...preset.animations, reduceMotion: workingDraft.globalSettings.animations.reduceMotion },
        variants: structuredClone(preset.variants),
        activeVariant: preset.variants.find((variant) => variant.isDefault)?.id ?? preset.variants[0]?.id ?? "light",
      },
    });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Shapes size={14} className="text-amber-500" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500">Arah storefront</h3>
          </div>
          <p className="mt-1 text-[11px] leading-4 text-gray-400">Enam susunan yang benar-benar berbeda. Semua section tetap bisa diedit setelah diterapkan.</p>
        </div>
        <button type="button" onClick={() => setShowLegacy((value) => !value)} className="shrink-0 text-[10px] font-semibold text-blue-600 hover:text-blue-800">
          {showLegacy ? "Kembali" : "Gaya lama"}
        </button>
      </div>

      {showLegacy ? (
        <div className="grid grid-cols-2 gap-2">
          {THEME_PRESETS.map((preset) => (
            <button key={preset.id} type="button" onClick={() => applyLegacyStyle(preset.id)} className="rounded-xl border border-gray-200 p-2 text-left hover:border-blue-300">
              <div className="mb-2 flex h-2 overflow-hidden rounded-full">
                {[preset.colors.primary, preset.colors.accent, preset.colors.background].map((color) => <span key={color} className="flex-1" style={{ backgroundColor: color }} />)}
              </div>
              <span className="block text-[10px] font-bold text-gray-700">{preset.name}</span>
              <span className="text-[9px] text-gray-400">Gaya saja</span>
            </button>
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {CURATED_THEME_FAMILIES.map((family) => {
            const preset = THEME_PRESETS.find((item) => item.id === family.primaryPresetId);
            const expanded = selectedFamilyId === family.id;
            return (
              <div key={family.id} className={`overflow-hidden rounded-xl border bg-white transition ${expanded ? "border-blue-300 shadow-sm" : "border-gray-200 hover:border-gray-300"}`}>
                <button type="button" onClick={() => setSelectedFamilyId(expanded ? null : family.id)} className="w-full p-3 text-left">
                  <div className="flex gap-3">
                    <div className="w-20 shrink-0 rounded-lg border border-gray-200 bg-gray-50 p-2">
                      <div className="grid grid-cols-3 items-end gap-1" aria-hidden="true">
                        {(LAYOUT_MARKS[family.id] ?? []).map((mark, index) => (
                          <span key={index} className={`rounded-[2px] ${mark}`} style={{ backgroundColor: index === 0 ? preset?.colors.primary : index === 1 ? preset?.colors.accent : preset?.colors.surfaceAlt }} />
                        ))}
                      </div>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] font-bold text-gray-800">{family.name}</span>
                        <span className="rounded border border-gray-200 px-1.5 py-0.5 font-mono text-[8px] text-gray-400">{family.preview}</span>
                      </div>
                      <p className="mt-0.5 text-[9px] leading-3.5 text-gray-500">{family.tagline}</p>
                      <p className="mt-1 text-[8px] font-semibold uppercase tracking-wide text-amber-700">{family.signature}</p>
                    </div>
                  </div>
                </button>
                {expanded ? (
                  <div className="border-t border-gray-100 bg-gray-50 p-3">
                    <p className="mb-2 text-[9px] leading-4 text-gray-500">Konten tenant tidak dihapus. Pilih seberapa jauh tema diterapkan.</p>
                    <div className="grid grid-cols-2 gap-2">
                      <button type="button" onClick={() => applyFamily(family.id, "style")} className="flex items-center justify-center gap-1.5 rounded-lg border border-gray-300 bg-white px-2 py-2 text-[10px] font-bold text-gray-700 hover:border-blue-400">
                        <Palette size={12} /> Gaya saja
                      </button>
                      <button type="button" onClick={() => applyFamily(family.id, "style-and-layout")} className="flex items-center justify-center gap-1.5 rounded-lg bg-blue-600 px-2 py-2 text-[10px] font-bold text-white hover:bg-blue-700">
                        <Layers3 size={12} /> Gaya + susunan <Check size={11} />
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}

      <div className="flex items-start gap-2 rounded-lg bg-amber-50 p-2 text-[9px] leading-4 text-amber-900">
        <Grid2X2 size={12} className="mt-0.5 shrink-0" />
        Tema mengatur presentasi. Origin, proses, varietas, tasting notes, harga, dan stok tetap mengikuti data tenant.
      </div>
    </div>
  );
}
