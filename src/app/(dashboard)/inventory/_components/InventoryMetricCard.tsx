"use client";

import type { LucideIcon } from "lucide-react";

interface InventoryMetricCardProps {
  label: string;
  value: number | string;
  unit?: string;
  icon: LucideIcon;
  tone: "green" | "blue" | "red" | "orange" | "neutral";
  helperText?: string;
  onClick?: () => void;
  active?: boolean;
}

const TONE_MAP = {
  green: {
    value: "text-emerald-700",
    icon: "bg-emerald-50 text-emerald-700",
    activeBorder: "border-emerald-500 ring-1 ring-emerald-500",
  },
  blue: {
    value: "text-[var(--text-primary)]",
    icon: "bg-sky-50 text-sky-700",
    activeBorder: "border-sky-500 ring-1 ring-sky-500",
  },
  red: {
    value: "text-red-700",
    icon: "bg-red-50 text-red-700",
    activeBorder: "border-red-500 ring-1 ring-red-500",
  },
  orange: {
    value: "text-[var(--amber-warm)]",
    icon: "bg-amber-50 text-amber-700",
    activeBorder: "border-[var(--amber-deep)] ring-1 ring-[var(--amber-deep)]",
  },
  neutral: {
    value: "text-[var(--text-secondary)]",
    icon: "bg-stone-100 text-stone-600",
    activeBorder: "border-stone-500 ring-1 ring-stone-500",
  },
};

export function InventoryMetricCard({
  label,
  value,
  unit,
  icon: Icon,
  tone,
  helperText,
  onClick,
  active = false,
}: InventoryMetricCardProps) {
  const t = TONE_MAP[tone];

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={`
        relative min-w-0 glass-card p-4 text-left
        ${onClick ? "cursor-pointer" : "cursor-default"}
        ${active ? t.activeBorder : ""}
      `}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-medium leading-4 text-[var(--text-secondary)]">{label}</p>
        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${t.icon}`}>
          <Icon size={17} aria-hidden="true" />
        </span>
      </div>
      <p className={`mt-2 whitespace-nowrap font-mono text-sm font-bold tabular-nums sm:text-xl ${t.value}`}>
        {typeof value === "number" ? value.toLocaleString("id-ID") : value}
        {unit && <span className="ml-0.5 text-sm font-semibold">{unit}</span>}
      </p>
      {helperText && <p className="mt-2 text-xs leading-4 text-[var(--text-tertiary)]">{helperText}</p>}
    </button>
  );
}
