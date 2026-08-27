"use client";

import { cn } from "@/lib/utils";
import { type LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Eyebrow } from "@/components/ui/eyebrow";

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
    value: "text-[var(--status-success)]",
    icon: "bg-[var(--status-success)]/10 text-[var(--status-success)]",
    activeBorder: "border-[var(--status-success)] ring-1 ring-[var(--status-success)]/40",
  },
  blue: {
    value: "text-ink",
    icon: "bg-copper-soft text-copper",
    activeBorder: "border-copper/40 ring-1 ring-copper/30",
  },
  red: {
    value: "text-[var(--status-danger)]",
    icon: "bg-[var(--status-danger)]/10 text-[var(--status-danger)]",
    activeBorder: "border-[var(--status-danger)] ring-1 ring-[var(--status-danger)]/40",
  },
  orange: {
    value: "text-copper",
    icon: "bg-copper-soft text-copper",
    activeBorder: "border-copper/50 ring-1 ring-copper/40",
  },
  neutral: {
    value: "text-ink-secondary",
    icon: "bg-surface-sunken text-ink-tertiary",
    activeBorder: "border-copper/40 ring-1 ring-copper/30",
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
    <Card
      variant={onClick ? "interactive" : "default"}
      onClick={onClick}
      className={cn(
        "p-4 text-left",
        onClick ? "cursor-pointer" : "cursor-default",
        active ? t.activeBorder : "border-border",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <Eyebrow tone="muted">{label}</Eyebrow>
        <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-lg", t.icon)}>
          <Icon size={17} aria-hidden="true" />
        </span>
      </div>
      <p className={cn("mt-2 whitespace-nowrap font-heading text-2xl font-bold tracking-[-0.03em] tabular-nums sm:text-3xl", t.value)}>
        {typeof value === "number" ? value.toLocaleString("id-ID") : value}
        {unit && <span className="ml-0.5 text-base font-semibold sm:text-lg">{unit}</span>}
      </p>
      {helperText && <p className="mt-1 text-xs leading-4 text-ink-tertiary">{helperText}</p>}
    </Card>
  );
}
