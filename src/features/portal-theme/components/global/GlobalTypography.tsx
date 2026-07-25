// =============================================================================
// GLOBAL TYPOGRAPHY PANEL — Visual font picker with live preview
// =============================================================================

"use client";

import { useCustomizerStore } from "../../client/store";

const FONT_PRESETS = [
  { heading: "Inter", body: "Inter", label: "Modern Clean", style: "sans-serif" },
  { heading: "Playfair Display", body: "Inter", label: "Elegant Serif", style: "serif" },
  { heading: "Poppins", body: "Poppins", label: "Geometric", style: "sans-serif" },
  { heading: "Lora", body: "Source Sans 3", label: "Editorial", style: "serif" },
  { heading: "Montserrat", body: "Open Sans", label: "Professional", style: "sans-serif" },
  { heading: "Raleway", body: "Roboto", label: "Refined", style: "sans-serif" },
];

export function GlobalTypographyPanel() {
  const typography = useCustomizerStore((s) => s.workingDraft.globalSettings.typography);
  const updateGlobalTypography = useCustomizerStore((s) => s.updateGlobalTypography);

  return (
    <div className="space-y-5">
      <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Typography</h3>

      {/* Live Preview */}
      <div className="rounded-xl border border-gray-200 overflow-hidden">
        <div className="p-4 bg-white">
          <h4
            className="text-xl font-bold mb-1"
            style={{ fontFamily: `'${typography.headingFont}', sans-serif`, fontWeight: typography.headingWeight }}
          >
            The quick brown fox
          </h4>
          <p
            className="text-sm leading-relaxed"
            style={{
              fontFamily: `'${typography.bodyFont}', sans-serif`,
              fontSize: `${typography.baseFontSize}px`,
              fontWeight: typography.bodyWeight,
              lineHeight: typography.lineHeight,
            }}
          >
            jumps over the lazy dog. Every letter tells a story.
          </p>
        </div>
        <div className="flex items-center justify-between px-3 py-1.5 bg-gray-50 border-t">
          <span className="text-[9px] text-gray-400">Live Preview</span>
          <span className="text-[9px] font-mono text-gray-400">{typography.baseFontSize}px / {typography.lineHeight}</span>
        </div>
      </div>

      {/* Font Presets */}
      <div>
        <label className="block text-[10px] font-semibold text-gray-500 mb-1.5">Font Pairing</label>
        <div className="grid grid-cols-2 gap-1.5">
          {FONT_PRESETS.map((preset) => {
            const isActive = typography.headingFont === preset.heading && typography.bodyFont === preset.body;
            return (
              <button
                key={preset.label}
                onClick={() => updateGlobalTypography({ headingFont: preset.heading, bodyFont: preset.body })}
                className={`rounded-lg border p-2.5 text-left transition-all ${
                  isActive
                    ? "border-blue-400 bg-blue-50 shadow-sm"
                    : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                }`}
              >
                <div className="text-[10px] font-bold truncate" style={{ fontFamily: `'${preset.heading}', ${preset.style}` }}>
                  Aa
                </div>
                <div className="text-[8px] text-gray-500 mt-1 truncate">{preset.label}</div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Custom Font Selects */}
      <div className="space-y-2">
        <div>
          <label className="block text-[10px] font-semibold text-gray-500 mb-1">Heading Font</label>
          <select
            value={typography.headingFont}
            onChange={(e) => updateGlobalTypography({ headingFont: e.target.value })}
            className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs focus:border-blue-500 focus:outline-none"
          >
            {["Inter", "Playfair Display", "Poppins", "Lora", "Montserrat", "Raleway", "Merriweather", "DM Serif Display", "Space Grotesk"].map((f) => (
              <option key={f} value={f}>{f}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-[10px] font-semibold text-gray-500 mb-1">Body Font</label>
          <select
            value={typography.bodyFont}
            onChange={(e) => updateGlobalTypography({ bodyFont: e.target.value })}
            className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs focus:border-blue-500 focus:outline-none"
          >
            {["Inter", "Source Sans 3", "Open Sans", "Roboto", "Nunito", "DM Sans", "Work Sans", "Lato"].map((f) => (
              <option key={f} value={f}>{f}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Size & Scale */}
      <div className="space-y-3">
        <label className="block text-[10px] font-semibold text-gray-500">Scale & Spacing</label>
        <SliderField label="Base Size" value={typography.baseFontSize} min={12} max={24} unit="px" onChange={(v) => updateGlobalTypography({ baseFontSize: v })} />
        <SliderField label="Scale Ratio" value={typography.scaleRatio} min={1.0} max={1.6} step={0.05} unit="×" onChange={(v) => updateGlobalTypography({ scaleRatio: v })} />
        <SliderField label="Line Height" value={typography.lineHeight} min={1.0} max={2.2} step={0.05} unit="" onChange={(v) => updateGlobalTypography({ lineHeight: v })} />
        <SliderField label="Letter Spacing" value={typography.letterSpacing} min={-0.05} max={0.2} step={0.01} unit="em" onChange={(v) => updateGlobalTypography({ letterSpacing: v })} />
      </div>

      {/* Weights */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-[10px] font-semibold text-gray-500 mb-1">Heading Weight</label>
          <select value={typography.headingWeight} onChange={(e) => updateGlobalTypography({ headingWeight: Number(e.target.value) })} className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs">
            {[400, 500, 600, 700, 800, 900].map((w) => <option key={w} value={w}>{w}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-[10px] font-semibold text-gray-500 mb-1">Body Weight</label>
          <select value={typography.bodyWeight} onChange={(e) => updateGlobalTypography({ bodyWeight: Number(e.target.value) })} className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs">
            {[300, 400, 500, 600].map((w) => <option key={w} value={w}>{w}</option>)}
          </select>
        </div>
      </div>

      {/* Transform */}
      <div>
        <label className="block text-[10px] font-semibold text-gray-500 mb-1">Heading Transform</label>
        <div className="flex gap-1">
          {(["none", "uppercase", "capitalize"] as const).map((t) => (
            <button
              key={t}
              onClick={() => updateGlobalTypography({ textTransform: t })}
              className={`flex-1 rounded-md border px-2 py-1.5 text-[10px] font-medium capitalize transition-colors ${
                typography.textTransform === t
                  ? "border-blue-500 bg-blue-50 text-blue-700"
                  : "border-gray-200 text-gray-500 hover:border-gray-300"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Slider with label ───────────────────────────────────────────────────────

function SliderField({ label, value, min, max, step = 1, unit, onChange }: {
  label: string; value: number; min: number; max: number; step?: number; unit: string; onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] text-gray-500">{label}</span>
        <span className="text-[10px] font-mono text-gray-400">{Number.isInteger(value) ? value : value.toFixed(2)}{unit}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-1.5 rounded-full appearance-none bg-gray-200 accent-blue-500"
      />
    </div>
  );
}
