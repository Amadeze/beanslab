// =============================================================================
// GRADIENT BUILDER — Visual gradient editor with live preview
// =============================================================================

"use client";

import type { PortalGradient } from "../../types";

interface GradientBuilderProps {
  value: PortalGradient | undefined;
  onChange: (gradient: PortalGradient) => void;
}

const PRESETS: Array<{ name: string; gradient: PortalGradient }> = [
  { name: "Sunset", gradient: { type: "linear", angle: 135, stops: [{ color: "#B65331", position: 0 }, { color: "#D4A574", position: 100 }] } },
  { name: "Ocean", gradient: { type: "linear", angle: 135, stops: [{ color: "#426C7A", position: 0 }, { color: "#2B7567", position: 100 }] } },
  { name: "Forest", gradient: { type: "linear", angle: 180, stops: [{ color: "#1a472a", position: 0 }, { color: "#2d8a4e", position: 100 }] } },
  { name: "Dark Roast", gradient: { type: "linear", angle: 135, stops: [{ color: "#1a1a1a", position: 0 }, { color: "#3d2b1f", position: 100 }] } },
  { name: "Rose Gold", gradient: { type: "linear", angle: 135, stops: [{ color: "#b76e79", position: 0 }, { color: "#ecc5c0", position: 100 }] } },
  { name: "Midnight", gradient: { type: "linear", angle: 180, stops: [{ color: "#0f0c29", position: 0 }, { color: "#302b63", position: 50 }, { color: "#24243e", position: 100 }] } },
];

export function GradientBuilder({ value, onChange }: GradientBuilderProps) {
  const gradient: PortalGradient = value || PRESETS[0].gradient;

  function updateStop(index: number, field: "color" | "position", val: string | number) {
    const stops = [...gradient.stops];
    stops[index] = { ...stops[index], [field]: val };
    onChange({ ...gradient, stops });
  }

  function addStop() {
    if (gradient.stops.length >= 10) return;
    const lastPos = gradient.stops[gradient.stops.length - 1]?.position || 50;
    onChange({
      ...gradient,
      stops: [...gradient.stops, { color: "#000000", position: Math.min(lastPos + 20, 100) }],
    });
  }

  function removeStop(index: number) {
    if (gradient.stops.length <= 2) return;
    onChange({ ...gradient, stops: gradient.stops.filter((_, i) => i !== index) });
  }

  const cssGradient = (() => {
    const stops = gradient.stops.map((s) => `${s.color} ${s.position}%`).join(", ");
    return `${gradient.type}-gradient(${gradient.angle}deg, ${stops})`;
  })();

  return (
    <div className="space-y-3">
      {/* Live Preview */}
      <div className="relative h-20 w-full rounded-xl overflow-hidden border border-gray-200 shadow-inner">
        <div className="absolute inset-0" style={{ background: cssGradient }} />
        <div className="absolute bottom-2 left-2 right-2 flex gap-1">
          {gradient.stops.map((stop, i) => (
            <div
              key={i}
              className="h-3 w-3 rounded-full border-2 border-white shadow-sm"
              style={{ backgroundColor: stop.color, marginLeft: `${stop.position}%` }}
            />
          ))}
        </div>
      </div>

      {/* Preset gradients */}
      <div>
        <label className="block text-[10px] font-semibold text-gray-500 mb-1">Presets</label>
        <div className="grid grid-cols-3 gap-1.5">
          {PRESETS.map((preset) => {
            const stops = preset.gradient.stops.map((s) => `${s.color} ${s.position}%`).join(", ");
            const bg = `${preset.gradient.type}-gradient(${preset.gradient.angle}deg, ${stops})`;
            const isActive = JSON.stringify(gradient.stops) === JSON.stringify(preset.gradient.stops);
            return (
              <button
                key={preset.name}
                onClick={() => onChange(preset.gradient)}
                className={`h-8 rounded-lg border transition-all ${isActive ? "border-blue-400 ring-2 ring-blue-200" : "border-gray-200 hover:border-gray-300"}`}
                style={{ background: bg }}
                title={preset.name}
              />
            );
          })}
        </div>
      </div>

      {/* Type & Angle */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-[10px] font-semibold text-gray-500 mb-1">Type</label>
          <div className="flex gap-1">
            {(["linear", "radial", "conic"] as const).map((t) => (
              <button
                key={t}
                onClick={() => onChange({ ...gradient, type: t })}
                className={`flex-1 rounded-md border px-1.5 py-1.5 text-[9px] font-medium capitalize transition-colors ${
                  gradient.type === t
                    ? "border-blue-500 bg-blue-50 text-blue-700"
                    : "border-gray-200 text-gray-500 hover:border-gray-300"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="block text-[10px] font-semibold text-gray-500 mb-1">Angle ({gradient.angle}°)</label>
          <div className="flex items-center gap-2">
            <input
              type="range"
              min={0}
              max={360}
              value={gradient.angle}
              onChange={(e) => onChange({ ...gradient, angle: Number(e.target.value) })}
              className="flex-1"
            />
            <span className="text-[9px] font-mono text-gray-400 w-6 text-right">{gradient.angle}°</span>
          </div>
        </div>
      </div>

      {/* Color Stops */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label className="block text-[10px] font-semibold text-gray-500">Color Stops</label>
          {gradient.stops.length < 10 && (
            <button onClick={addStop} className="text-[9px] text-blue-500 hover:text-blue-700 font-medium">+ Add</button>
          )}
        </div>
        {gradient.stops.map((stop, i) => (
          <div key={i} className="flex items-center gap-2 rounded-lg bg-gray-50 px-2 py-1.5">
            <div className="relative shrink-0">
              <input
                type="color"
                value={stop.color}
                onChange={(e) => updateStop(i, "color", e.target.value)}
                className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
              />
              <div className="h-6 w-6 rounded-md border border-gray-200 shadow-sm cursor-pointer" style={{ backgroundColor: stop.color }} />
            </div>
            <input
              type="number"
              value={stop.position}
              min={0}
              max={100}
              onChange={(e) => updateStop(i, "position", Number(e.target.value))}
              className="w-14 rounded border border-gray-200 px-1.5 py-1 text-[10px] text-center font-mono"
            />
            <span className="text-[9px] text-gray-400">%</span>
            <div className="flex-1 h-1.5 rounded-full" style={{ background: `linear-gradient(to right, ${stop.color} 0%, transparent 100%)` }} />
            {gradient.stops.length > 2 && (
              <button onClick={() => removeStop(i)} className="text-gray-300 hover:text-red-500 text-sm">×</button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
