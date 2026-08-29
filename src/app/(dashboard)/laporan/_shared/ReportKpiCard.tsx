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
    <Card className="p-2.5 sm:p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <Eyebrow tone="muted" className="flex items-center gap-1 text-[8px] sm:text-[9px]">
            <span className="truncate">{label}</span>
            {help && (
              <span
                className="hidden shrink-0 cursor-help align-middle text-ink-tertiary hover:text-ink-secondary sm:inline-flex"
                title={help}
                aria-label={help}
              >
                <Info size={11} />
              </span>
            )}
          </Eyebrow>
          <p className="mt-1 font-heading text-[15px] font-bold leading-none tracking-[-0.04em] text-ink tabular-nums sm:mt-1.5 sm:text-xl">{value}</p>
          {subtitle && <p className="mt-0.5 hidden text-xs text-ink-secondary sm:block">{subtitle}</p>}
          {target && <p className="mt-0.5 hidden text-xs text-ink-tertiary sm:block">Target: {target}</p>}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          {Icon && (
            <div className={cn("hidden size-7 items-center justify-center rounded-[8px] ring-1 sm:flex", c.bg, c.icon, c.ring)}>
              <Icon size={13} />
            </div>
          )}
          {sparkline && <span className="hidden sm:block"><MiniSparkline data={sparkline} color={c} /></span>}
        </div>
      </div>
      {trend !== undefined && trend !== null && (
        <div className="mt-2 flex items-center gap-1 border-t border-border/60 pt-1.5 sm:mt-3 sm:gap-1.5 sm:pt-2.5">
          {trend > 0 ? <TrendingUp size={11} className={trendColor} />
            : trend < 0 ? <TrendingDown size={11} className={trendColor} />
            : <Minus size={11} className={trendColor} />}
          <span className={cn("text-[11px] font-semibold tabular-nums sm:text-xs", trendColor)}>
            {trend > 0 ? "+" : ""}{trend.toFixed(1)}%
          </span>
          <span className="hidden text-[11px] text-ink-tertiary sm:inline sm:text-xs">vs periode lalu</span>
          <span className="text-[11px] text-ink-tertiary sm:hidden">vs lalu</span>
        </div>
      )}
      {trend === null && (
        <div className="mt-2 flex items-center gap-1 border-t border-border/60 pt-1.5 sm:mt-3 sm:gap-1.5 sm:pt-2.5">
          <Minus size={11} className="text-ink-tertiary" />
          <span className="text-[11px] font-semibold tabular-nums text-ink-tertiary sm:text-xs">—</span>
          <span className="hidden text-[11px] text-ink-tertiary sm:inline sm:text-xs">Periode baru</span>
          <span className="text-[11px] text-ink-tertiary sm:hidden">baru</span>
        </div>
      )}
    </Card>
  );
}
