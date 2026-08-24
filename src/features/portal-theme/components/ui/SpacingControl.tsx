// =============================================================================
// SPACING CONTROL — Visual 4-sided spacing editor with live diagram
// =============================================================================

"use client";

import type { SectionSpacing } from "../../types";

interface SpacingControlProps {
  value: SectionSpacing | undefined;
  onChange: (spacing: SectionSpacing) => void;
}

const PRESETS = [
  { label: "None", pt: 0, pb: 0 },
  { label: "S", pt: 24, pb: 24 },
  { label: "M", pt: 48, pb: 48 },
  { label: "L", pt: 64, pb: 64 },
  { label: "XL", pt: 96, pb: 96 },
  { label: "2XL", pt: 128, pb: 128 },
];

export function SpacingControl({ value, onChange }: SpacingControlProps) {
  const s: SectionSpacing = value || { paddingTop: 64, paddingRight: 24, paddingBottom: 64, paddingLeft: 24, marginTop: 0, marginBottom: 0 };

  return (
    <div className="space-y-4">
      {/* Visual Diagram */}
      <div className="relative mx-auto w-full">
        <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
          {/* Margin outer */}
          <div className="relative rounded-lg border-2 border-dashed border-blue-200 bg-blue-50/30 p-2">
            {/* Margin labels */}
            {s.marginTop !== 0 && (
              <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-blue-100 rounded px-1.5 py-0.5 text-[8px] font-mono text-blue-600">
                m:{s.marginTop}
              </div>
            )}
            {s.marginBottom !== 0 && (
              <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 bg-blue-100 rounded px-1.5 py-0.5 text-[8px] font-mono text-blue-600">
                m:{s.marginBottom}
              </div>
            )}

            {/* Padding inner */}
            <div
              className="relative rounded-lg border-2 border-amber-300 bg-amber-50/40"
              style={{ padding: `${Math.min(s.paddingTop * 0.15, 30)}px ${Math.min(s.paddingRight * 0.15, 30)}px ${Math.min(s.paddingBottom * 0.15, 30)}px ${Math.min(s.paddingLeft * 0.15, 30)}px` }}
            >
              {/* Padding labels */}
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-amber-100 rounded px-1.5 py-0.5 text-[8px] font-mono text-amber-700">{s.paddingTop}</div>
              <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 bg-amber-100 rounded px-1.5 py-0.5 text-[8px] font-mono text-amber-700">{s.paddingBottom}</div>
              <div className="absolute top-1/2 -left-3 -translate-y-1/2 bg-amber-100 rounded px-1.5 py-0.5 text-[8px] font-mono text-amber-700">{s.paddingLeft}</div>
              <div className="absolute top-1/2 -right-3 -translate-y-1/2 bg-amber-100 rounded px-1.5 py-0.5 text-[8px] font-mono text-amber-700">{s.paddingRight}</div>

              {/* Content */}
              <div className="rounded-md bg-white border border-gray-200 px-4 py-3 text-center">
                <div className="text-[9px] font-medium text-gray-400 uppercase tracking-wider">Section Content</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Presets */}
      <div>
        <label className="block text-xs font-semibold text-gray-500 mb-1.5">Quick Presets</label>
        <div className="flex gap-1">
          {PRESETS.map((p) => (
            <button
              key={p.label}
              onClick={() => onChange({ ...s, paddingTop: p.pt, paddingBottom: p.pb })}
              className={`flex-1 rounded-lg border py-2 text-xs font-semibold transition-all ${
                s.paddingTop === p.pt && s.paddingBottom === p.pb
                  ? "border-blue-400 bg-blue-50 text-blue-700 shadow-sm"
                  : "border-gray-200 text-gray-500 hover:border-gray-300 hover:bg-gray-50"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Individual Controls */}
      <div className="space-y-2">
        <label className="block text-xs font-semibold text-gray-500">Custom Values</label>
        <div className="grid grid-cols-2 gap-2">
          {([
            { field: "paddingTop" as const, label: "Pad Top", color: "amber" },
            { field: "paddingBottom" as const, label: "Pad Bottom", color: "amber" },
            { field: "paddingLeft" as const, label: "Pad Left", color: "amber" },
            { field: "paddingRight" as const, label: "Pad Right", color: "amber" },
            { field: "marginTop" as const, label: "Margin Top", color: "blue" },
            { field: "marginBottom" as const, label: "Margin Bottom", color: "blue" },
          ]).map(({ field, label }) => (
            <div key={field}>
              <label className="block text-[9px] font-semibold text-gray-400 mb-0.5">{label}</label>
              <input
                type="number"
                value={s[field] ?? 0}
                min={field.startsWith("margin") ? -200 : 0}
                max={500}
                onChange={(e) => onChange({ ...s, [field]: Number(e.target.value) })}
                className="w-full rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-mono text-gray-900 focus:border-blue-500 focus:outline-none"
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
