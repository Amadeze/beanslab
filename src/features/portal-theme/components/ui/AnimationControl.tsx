// =============================================================================
// ANIMATION CONTROL — Per-section scroll/hover animation settings
// =============================================================================

"use client";

import type { SectionAnimation } from "../../types";

interface AnimationControlProps {
  value: SectionAnimation | undefined;
  onChange: (animation: SectionAnimation) => void;
}

const SCROLL_TRIGGERS = [
  { value: "none", label: "None" },
  { value: "fade-in", label: "Fade In" },
  { value: "slide-up", label: "Slide Up" },
  { value: "slide-down", label: "Slide Down" },
  { value: "slide-left", label: "Slide Left" },
  { value: "slide-right", label: "Slide Right" },
  { value: "scale-up", label: "Scale Up" },
  { value: "blur-in", label: "Blur In" },
];

const HOVER_EFFECTS = [
  { value: "none", label: "None" },
  { value: "scale", label: "Scale" },
  { value: "lift", label: "Lift" },
  { value: "glow", label: "Glow" },
  { value: "shrink", label: "Shrink" },
];

const EASINGS = [
  { value: "cubic-bezier(0.16, 1, 0.3, 1)", label: "Smooth" },
  { value: "cubic-bezier(0.22, 1, 0.36, 1)", label: "Ease Out" },
  { value: "cubic-bezier(0.65, 0, 0.35, 1)", label: "Ease In-Out" },
  { value: "cubic-bezier(0.33, 1, 0.68, 1)", label: "Ease Out Cubic" },
  { value: "linear", label: "Linear" },
  { value: "cubic-bezier(0.34, 1.56, 0.64, 1)", label: "Bounce" },
];

export function AnimationControl({ value, onChange }: AnimationControlProps) {
  const animation: SectionAnimation = value || {
    scrollTrigger: "fade-in",
    duration: 600,
    delay: 0,
    easing: "cubic-bezier(0.16, 1, 0.3, 1)",
    hoverEffect: "none",
  };

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-[10px] font-semibold text-gray-500 mb-1">Scroll Animation</label>
        <div className="grid grid-cols-2 gap-1">
          {SCROLL_TRIGGERS.map(({ value: v, label }) => (
            <button
              key={v}
              onClick={() => onChange({ ...animation, scrollTrigger: v as SectionAnimation["scrollTrigger"] })}
              className={`rounded-md border px-2 py-1.5 text-[10px] font-medium transition-colors ${
                animation.scrollTrigger === v
                  ? "border-blue-500 bg-blue-50 text-blue-700"
                  : "border-gray-200 text-gray-500 hover:border-gray-300"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-[10px] font-semibold text-gray-500 mb-1">
            Duration ({animation.duration}ms)
          </label>
          <input
            type="range"
            min={0}
            max={3000}
            step={100}
            value={animation.duration}
            onChange={(e) => onChange({ ...animation, duration: Number(e.target.value) })}
            className="w-full"
          />
        </div>
        <div>
          <label className="block text-[10px] font-semibold text-gray-500 mb-1">
            Delay ({animation.delay}ms)
          </label>
          <input
            type="range"
            min={0}
            max={2000}
            step={100}
            value={animation.delay}
            onChange={(e) => onChange({ ...animation, delay: Number(e.target.value) })}
            className="w-full"
          />
        </div>
      </div>

      <div>
        <label className="block text-[10px] font-semibold text-gray-500 mb-1">Easing</label>
        <select
          value={animation.easing}
          onChange={(e) => onChange({ ...animation, easing: e.target.value })}
          className="w-full rounded border border-gray-200 px-2 py-1.5 text-xs"
        >
          {EASINGS.map(({ value: v, label }) => (
            <option key={v} value={v}>{label}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-[10px] font-semibold text-gray-500 mb-1">Hover Effect</label>
        <div className="flex flex-wrap gap-1">
          {HOVER_EFFECTS.map(({ value: v, label }) => (
            <button
              key={v}
              onClick={() => onChange({ ...animation, hoverEffect: v as SectionAnimation["hoverEffect"] })}
              className={`rounded-md border px-2.5 py-1 text-[10px] font-medium transition-colors ${
                animation.hoverEffect === v
                  ? "border-blue-500 bg-blue-50 text-blue-700"
                  : "border-gray-200 text-gray-500 hover:border-gray-300"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
