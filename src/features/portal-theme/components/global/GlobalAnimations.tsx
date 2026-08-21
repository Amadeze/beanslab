// =============================================================================
// GLOBAL ANIMATIONS PANEL — Global animation settings
// =============================================================================

"use client";

import { useCustomizerStore } from "../../client/store";

const EASINGS = [
  { value: "linear", label: "Linear" },
  { value: "ease", label: "Ease" },
  { value: "ease-in", label: "Ease In" },
  { value: "ease-out", label: "Ease Out" },
  { value: "ease-in-out", label: "Ease In Out" },
  { value: "cubic-bezier(0.22, 1, 0.36, 1)", label: "Smooth (Default)" },
  { value: "cubic-bezier(0.34, 1.56, 0.64, 1)", label: "Spring" },
  { value: "cubic-bezier(0.77, 0, 0.175, 1)", label: "Sharp" },
  { value: "cubic-bezier(0.16, 1, 0.3, 1)", label: "Gentle" },
  { value: "steps(4, end)", label: "Steps (4)" },
] as const;

export function GlobalAnimationsPanel() {
  const animations = useCustomizerStore((s) => s.workingDraft.globalSettings.animations);
  const updateGlobalAnimations = useCustomizerStore((s) => s.updateGlobalAnimations);

  return (
    <div className="space-y-5">
      <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Global Animations</h3>

      <div className="space-y-3">
        <label className="block text-xs font-semibold text-gray-500 mb-1">Global Duration</label>
        <input
          type="range"
          min={100}
          max={2000}
          step={50}
          value={animations.globalDuration || 600}
          onChange={(e) => updateGlobalAnimations({ globalDuration: Number(e.target.value) })}
          className="w-full h-1.5 rounded-full appearance-none bg-gray-200 accent-blue-500"
        />
        <div className="flex justify-between text-[9px] text-gray-400">
          <span>100ms</span>
          <span className="font-mono">{animations.globalDuration || 600}ms</span>
          <span>2000ms</span>
        </div>
      </div>

      <div className="space-y-3">
        <label className="block text-xs font-semibold text-gray-500 mb-1">Global Easing</label>
        <select
          value={animations.globalEasing || "cubic-bezier(0.22, 1, 0.36, 1)"}
          onChange={(e) => updateGlobalAnimations({ globalEasing: e.target.value })}
          className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs focus:border-blue-500 focus:outline-none"
        >
          {EASINGS.map((e) => <option key={e.value} value={e.value}>{e.label}</option>)}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <label className="flex items-center gap-2 rounded-lg border border-gray-200 p-2 hover:bg-gray-50 transition-colors cursor-pointer">
          <input
            type="checkbox"
            checked={animations.scrollAnimations ?? true}
            onChange={(e) => updateGlobalAnimations({ scrollAnimations: e.target.checked })}
            className="w-4 h-4 rounded border-gray-300 text-blue-500 focus:ring-blue-400"
          />
          <span className="text-xs text-gray-600">Scroll Animations</span>
        </label>
        <label className="flex items-center gap-2 rounded-lg border border-gray-200 p-2 hover:bg-gray-50 transition-colors cursor-pointer">
          <input
            type="checkbox"
            checked={animations.hoverEffects ?? true}
            onChange={(e) => updateGlobalAnimations({ hoverEffects: e.target.checked })}
            className="w-4 h-4 rounded border-gray-300 text-blue-500 focus:ring-blue-400"
          />
          <span className="text-xs text-gray-600">Hover Effects</span>
        </label>
        <label className="flex items-center gap-2 rounded-lg border border-gray-200 p-2 hover:bg-gray-50 transition-colors cursor-pointer">
          <input
            type="checkbox"
            checked={animations.reduceMotion ?? false}
            onChange={(e) => updateGlobalAnimations({ reduceMotion: e.target.checked })}
            className="w-4 h-4 rounded border-gray-300 text-blue-500 focus:ring-blue-400"
          />
          <span className="text-xs text-gray-600">Respect Reduce Motion</span>
        </label>
      </div>

      <div className="pt-3 border-t border-gray-200">
        <p className="text-[10px] text-gray-400 mb-2">
          Scroll triggers & hover effects are configured per-section in the section settings.
        </p>
      </div>
    </div>
  );
}