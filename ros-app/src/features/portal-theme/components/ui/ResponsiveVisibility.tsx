// =============================================================================
// RESPONSIVE VISIBILITY — Toggle section visibility per breakpoint
// =============================================================================

"use client";

import { Monitor, Tablet, Smartphone } from "lucide-react";
import type { ResponsiveVisibility } from "../../types";

interface ResponsiveVisibilityProps {
  value: ResponsiveVisibility | undefined;
  onChange: (visibility: ResponsiveVisibility) => void;
}

export function ResponsiveVisibilityControl({ value, onChange }: ResponsiveVisibilityProps) {
  const visibility: ResponsiveVisibility = value || { desktop: true, tablet: true, mobile: true };

  const breakpoints = [
    { key: "desktop" as const, icon: Monitor, label: "Desktop" },
    { key: "tablet" as const, icon: Tablet, label: "Tablet" },
    { key: "mobile" as const, icon: Smartphone, label: "Mobile" },
  ];

  return (
    <div className="space-y-2">
      <label className="block text-xs font-semibold text-gray-500">Visible On</label>
      <div className="flex gap-2">
        {breakpoints.map(({ key, icon: Icon, label }) => (
          <button
            key={key}
            onClick={() => onChange({ ...visibility, [key]: !visibility[key] })}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg border py-2 text-xs font-medium transition-colors ${
              visibility[key]
                ? "border-green-300 bg-green-50 text-green-700"
                : "border-gray-200 bg-gray-50 text-gray-400"
            }`}
            title={`${visibility[key] ? "Hide" : "Show"} on ${label}`}
          >
            <Icon size={14} />
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
