"use client";

import { TrendingUp, TrendingDown, Minus, Info, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Eyebrow } from "@/components/ui/eyebrow";

interface ReportKpiCardProps {
  label: string;
  value: string | number;
  subtitle?: string;
  /** Persen vs periode lalu; `null` = periode sebelumnya kosong ("—"). */
  trend?: number | null;
  icon?: LucideIcon;
  color?: "emerald" | "moss" | "amber" | "rose" | "blue" | "purple" | "stone";
  inverse?: boolean;
  sparkline?: number[];
  target?: string;
  /** Definisi/sumber metrik. Ditampilkan sebagai tooltip kecil di sebelah label. */
  help?: string;
}

const colorMap = {
  emerald: { bg: "bg-emerald-50", icon: "text-emerald-700", ring: "ring-emerald-200/50", bar: "bg-emerald-500" },
  moss: { bg: "bg-moss-soft", icon: "text-moss", ring: "ring-moss/15", bar: "bg-moss" },
  amber: { bg: "bg-amber-50", icon: "text-amber-700", ring: "ring-amber-200/50", bar: "bg-amber-500" },
  rose: { bg: "bg-rose-50", icon: "text-rose-700", ring: "ring-rose-200/50", bar: "bg-rose-500" },
  blue: { bg: "bg-sky-50", icon: "text-sky-700", ring: "ring-sky-200/50", bar: "bg-sky-500" },
  purple: { bg: "bg-violet-50", icon: "text-violet-700", ring: "ring-violet-200/50", bar: "bg-violet-500" },
  stone: { bg: "bg-surface-sunken", icon: "text-ink-tertiary", ring: "ring-border", bar: "bg-ink-tertiary" },
};

function MiniSparkline({ data, color }: { data: number[]; color: { bar: string } }) {
  if (!data || data.length < 2) return null;
  const max = Math.max(...data) || 1;
  return (
    <div className="flex items-end gap-[2px] h-7">
      {data.map((v, i) => (
        <div
          key={i}
          className={cn("w-1.5 rounded-t transition-all", color.bar)}
          style={{ height: `${(v / max) * 100}%`, opacity: 0.3 + (i / data.length) * 0.7 }}
        />
      ))}
    </div>
  );
}

export function ReportKpiCard({
  label, value, subtitle, trend, icon: Icon, color = "stone", inverse = false, sparkline, target, help,
}: ReportKpiCardProps) {
  const c = colorMap[color];
  const trendColor = (() => {
    if (trend === undefined || trend === null || trend === 0) return "text-ink-tertiary";
    if (inverse) return trend < 0 ? "text-[var(--status-success)]" : "text-[var(--status-danger)]";
    return trend > 0 ? "text-[var(--status-success)]" : "text-[var(--status-danger)]";
  })();

  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <Eyebrow tone="muted" className="flex items-center gap-1.5">
            {label}
            {help && (
              <span
                className="inline-flex cursor-help align-middle text-ink-tertiary hover:text-ink-secondary"
                title={help}
                aria-label={help}
              >
                <Info size={12} />
              </span>
            )}
          </Eyebrow>
          <p className="mt-2 font-heading text-2xl font-bold tracking-[-0.04em] text-ink tabular-nums">{value}</p>
          {subtitle && <p className="mt-0.5 text-xs text-ink-secondary">{subtitle}</p>}
          {target && <p className="mt-0.5 text-xs text-ink-tertiary">Target: {target}</p>}
        </div>
        <div className="flex flex-col items-end gap-1.5">
          {Icon && (
            <div className={cn("flex size-9 items-center justify-center rounded-[9px] ring-1", c.bg, c.icon, c.ring)}>
              <Icon size={16} />
            </div>
          )}
          {sparkline && <MiniSparkline data={sparkline} color={c} />}
        </div>
      </div>
      {trend !== undefined && trend !== null && (
        <div className="mt-3 flex items-center gap-1.5 border-t border-border/70 pt-2.5">
          {trend > 0 ? <TrendingUp size={12} className={trendColor} />
            : trend < 0 ? <TrendingDown size={12} className={trendColor} />
            : <Minus size={12} className={trendColor} />}
          <span className={cn("text-xs font-semibold tabular-nums", trendColor)}>
            {trend > 0 ? "+" : ""}{trend.toFixed(1)}%
          </span>
          <span className="text-xs text-ink-tertiary">vs periode lalu</span>
        </div>
      )}
      {trend === null && (
        <div className="mt-3 flex items-center gap-1.5 border-t border-border/70 pt-2.5">
          <Minus size={12} className="text-ink-tertiary" />
          <span className="text-xs font-semibold tabular-nums text-ink-tertiary">—</span>
          <span className="text-xs text-ink-tertiary">Periode baru</span>
        </div>
      )}
    </Card>
  );
}
