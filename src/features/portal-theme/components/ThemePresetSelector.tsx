// =============================================================================
// THEME PRESET SELECTOR — Curated families (7) + compatibility layer (16 presets)
// =============================================================================

"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, Sparkles, ChevronRight, Grid, Sparkle } from "lucide-react";
import { THEME_PRESETS, getThemePresetById } from "../defaults/theme-presets";
import { CURATED_THEME_FAMILIES, getPrimaryPresetForFamily } from "../defaults/curated-families";
import { useCustomizerStore } from "../client/store";

const ease = [0.22, 1, 0.36, 1] as const;

export function ThemePresetSelector() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState<string | null>(null);
  const [showAllPresets, setShowAllPresets] = useState(false);
  const workingDraft = useCustomizerStore((s) => s.workingDraft);
  const updateGlobalColors = useCustomizerStore((s) => s.updateGlobalColors);
  const updateGlobalTypography = useCustomizerStore((s) => s.updateGlobalTypography);
  const updateGlobalLayout = useCustomizerStore((s) => s.updateGlobalLayout);
  const updateGlobalAnimations = useCustomizerStore((s) => s.updateGlobalAnimations);
  const initialize = useCustomizerStore((s) => s.initialize);

  function applyPreset(presetId: string) {
    const preset = getThemePresetById(presetId);
    if (!preset) return;

    updateGlobalColors(preset.colors);
    updateGlobalTypography(preset.typography);
    updateGlobalLayout(preset.layout);
    updateGlobalAnimations({ ...preset.animations, reduceMotion: false });

    let updatedSections = workingDraft.sections;
    if (preset.defaultSections && preset.defaultSections.length > 0) {
      updatedSections = preset.defaultSections.map((sec, idx) => ({
        ...sec,
        id: `${sec.type}_${Date.now().toString(36)}_${idx}`,
        blocks: sec.blocks ? sec.blocks.map((b: any, bIdx: number) => ({ ...b, id: `blk_${Date.now().toString(36)}_${idx}_${bIdx}` })) : [],
      }));
    } else {
      updatedSections = workingDraft.sections.map((section) => {
        const defaults = preset.sectionDefaults[section.type];
        if (defaults) {
          return { ...section, settings: { ...section.settings, ...defaults } };
        }
        return section;
      });
    }

    const newConfig = {
      ...workingDraft,
      globalSettings: {
        ...workingDraft.globalSettings,
        colors: preset.colors,
        typography: preset.typography,
        layout: preset.layout,
        animations: { ...preset.animations, reduceMotion: false },
        variants: preset.variants,
        activeVariant: preset.variants.find((v) => v.isDefault)?.id || preset.variants[0]?.id || "light",
      },
      sections: updatedSections,
    };

    initialize(newConfig);
    setShowConfirm(null);
  }

  const activePresets = showAllPresets ? THEME_PRESETS : CURATED_THEME_FAMILIES.map((f) => getPrimaryPresetForFamily(f.id)).filter(Boolean) as typeof THEME_PRESETS;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkle size={14} className="text-amber-500" />
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Theme Families</h3>
        </div>
        <button
          onClick={() => setShowAllPresets(!showAllPresets)}
          className="text-xs font-medium text-blue-500 hover:text-blue-700 flex items-center gap-1"
        >
          {showAllPresets ? <Sparkles size={12} /> : <Grid size={12} />}
          <span>{showAllPresets ? "Curated (7)" : "All Presets (16)"}</span>
        </button>
      </div>
      <p className="text-xs text-gray-400">
        {showAllPresets
          ? "All 16 preset identities (compatibility layer). Click to apply."
          : "7 curated visual families. Each maps to a primary preset with variants."}
      </p>

      <div className="space-y-2">
        {activePresets.map((preset, i) => {
          const isActive = showConfirm === preset.id;
          const family = CURATED_THEME_FAMILIES.find((f) => f.primaryPresetId === preset.id);
          return (
            <motion.div
              key={preset.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: i * 0.03, ease }}
            >
              <button
                onClick={() => setShowConfirm(isActive ? null : preset.id)}
                className="w-full text-left rounded-xl border border-gray-200 overflow-hidden hover:border-gray-300 hover:shadow-md transition-all group"
              >
                <div className="flex h-6">
                  {[preset.colors.primary, preset.colors.secondary, preset.colors.accent, preset.colors.background, preset.colors.surface, preset.colors.text].map((c, j) => (
                    <div key={j} className="flex-1 transition-all duration-200" style={{ backgroundColor: c }} />
                  ))}
                </div>

                <div className="p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{preset.preview}</span>
                      <div>
                        <div className="text-[11px] font-bold text-gray-800 group-hover:text-blue-700 transition-colors">
                          {preset.name}
                          {family && !showAllPresets && (
                            <span className="ml-1.5 rounded-full bg-amber-100 px-1.5 py-0.5 text-[8px] font-bold text-amber-800 border border-amber-300/60">
                              Curated
                            </span>
                          )}
                        </div>
                        <div className="text-[9px] text-gray-400">{preset.tagline}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 text-[9px] font-mono text-gray-300">
                      {preset.typography.headingFont}
                      {preset.variants.length > 1 && <ChevronRight size={10} />}
                    </div>
                  </div>

                  <div className="flex gap-3 mt-2 pt-2 border-t border-gray-100">
                    <span className="text-[8px] text-gray-400">
                      {preset.layout.borderRadius === 0 ? "Sharp" : preset.layout.borderRadius >= 20 ? "Rounded" : "Soft"} corners
                    </span>
                    <span className="text-[8px] text-gray-400">
                      {preset.animations.globalDuration}ms
                    </span>
                    <span className="text-[8px] text-gray-400">
                      {preset.variants.length} variant{preset.variants.length > 1 ? "s" : ""}
                    </span>
                  </div>
                </div>
              </button>

              <AnimatePresence>
                {isActive && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2, ease }}
                    className="overflow-hidden"
                  >
                    <div className="mt-1 rounded-xl border-2 border-blue-300 bg-blue-50 p-3 text-center">
                      <p className="text-xs text-blue-700 font-semibold mb-2">
                        Apply "{preset.name}" theme?
                      </p>
                      <p className="text-[9px] text-blue-500 mb-3">
                        This will update colors, typography, layout, and animations.
                      </p>
                      <div className="flex gap-2 justify-center">
                        <button
                          onClick={(e) => { e.stopPropagation(); setShowConfirm(null); }}
                          className="rounded-lg border border-gray-300 bg-white px-4 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-50"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); applyPreset(preset.id); }}
                          className="flex items-center gap-1 rounded-lg bg-blue-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"
                        >
                          <Check size={12} /> Apply Theme
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
