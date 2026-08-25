import * as React from "react";
import { ArrowDownRight, ArrowUpRight, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Eyebrow } from "./eyebrow";
import { Card } from "./card";

type DeltaTone = "positive" | "negative" | "neutral";

const deltaToneClass: Record<DeltaTone, string> = {
  positive: "text-[var(--status-success)]",
  negative: "text-[var(--status-danger)]",
  neutral: "text-ink-tertiary",
};

/**
 * Stat — the elegant KPI tile. Big display number, eyebrow label, optional
 * delta (vs periode lalu) and optional icon. Use inside a Card or KpiRibbon.
 */
export function Stat({
  label,
  value,
  sub,
  delta,
  deltaTone = "neutral",
  icon: Icon,
  className,
}: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  /** Persen vs periode lalu, mis. 12.5 → "+12.5%". */
  delta?: number | null;
  deltaTone?: DeltaTone;
  icon?: LucideIcon;
  className?: string;
}) {
  return (
    <Card variant="default" className={cn("p-5", className)}>
      <div className="flex items-start justify-between gap-3">
        <Eyebrow tone="muted">{label}</Eyebrow>
        {Icon && (
          <div className="flex size-8 items-center justify-center rounded-[9px] bg-copper-soft text-copper ring-1 ring-copper/15">
            <Icon size={15} />
          </div>
        )}
      </div>
      <p className="mt-2 font-heading text-2xl font-bold tracking-[-0.04em] text-ink sm:text-3xl">
        {value}
      </p>
      {sub && <p className="mt-0.5 text-xs text-ink-secondary">{sub}</p>}
      {delta !== undefined && delta !== null && (
        <p className={cn("mt-2 flex items-center gap-1 text-xs font-semibold tabular-nums", deltaToneClass[deltaTone])}>
          {delta > 0 ? <ArrowUpRight size={13} /> : delta < 0 ? <ArrowDownRight size={13} /> : null}
          {delta > 0 ? "+" : ""}
          {delta.toFixed(1)}%
          <span className="font-normal text-ink-tertiary">vs periode lalu</span>
        </p>
      )}
    </Card>
  );
}
