"use client";

import { TrendingUp, TrendingDown, Minus, Info, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface ReportKpiCardProps {
  label: string;
  value: string | number;
  subtitle?: string;
  trend?: number;
  icon?: LucideIcon;
  color?: "emerald" | "amber" | "rose" | "blue" | "purple" | "stone";
  inverse?: boolean;
  sparkline?: number[];
  target?: string;
  /** Definisi/sumber metrik. Ditampilkan sebagai tooltip kecil di sebelah label. */
  help?: string;
}

const colorMap = {
  emerald: { bg: "bg-emerald-50", icon: "text-emerald-600", ring: "ring-emerald-200/50", bar: "bg-emerald-500" },
  amber: { bg: "bg-amber-50", icon: "text-amber-600", ring: "ring-amber-200/50", bar: "bg-amber-500" },
  rose: { bg: "bg-rose-50", icon: "text-rose-600", ring: "ring-rose-200/50", bar: "bg-rose-500" },
  blue: { bg: "bg-blue-50", icon: "text-blue-600", ring: "ring-blue-200/50", bar: "bg-blue-500" },
  purple: { bg: "bg-purple-50", icon: "text-purple-600", ring: "ring-purple-200/50", bar: "bg-purple-500" },
  stone: { bg: "bg-stone-100", icon: "text-stone-600", ring: "ring-stone-200/50", bar: "bg-stone-500" },
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
    if (trend === undefined || trend === 0) return "text-stone-500";
    if (inverse) return trend < 0 ? "text-emerald-600" : "text-rose-600";
    return trend > 0 ? "text-emerald-600" : "text-rose-600";
  })();

  return (
    <div className="group relative rounded-xl border border-stone-200 bg-white p-4 transition-all hover:shadow-md hover:border-stone-300">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold uppercase tracking-wider text-stone-500">
            {label}
            {help && (
              <span
                className="ml-1.5 inline-flex cursor-help align-middle text-stone-400 hover:text-stone-600"
                title={help}
                aria-label={help}
              >
                <Info size={12} />
              </span>
            )}
          </p>
          <p className="mt-1.5 text-xl font-black tracking-tight text-stone-900 tabular-nums">{value}</p>
          {subtitle && <p className="mt-0.5 text-[11px] text-stone-500">{subtitle}</p>}
          {target && <p className="mt-0.5 text-xs text-stone-400">Target: {target}</p>}
        </div>
        <div className="flex flex-col items-end gap-1.5">
          {Icon && (
            <div className={cn("rounded-lg p-2 ring-1", c.bg, c.icon, c.ring)}>
              <Icon size={16} />
            </div>
          )}
          {sparkline && <MiniSparkline data={sparkline} color={c} />}
        </div>
      </div>
      {trend !== undefined && (
        <div className="mt-3 flex items-center gap-1.5 border-t border-stone-100 pt-2.5">
          {trend > 0 ? <TrendingUp size={12} className={trendColor} />
            : trend < 0 ? <TrendingDown size={12} className={trendColor} />
            : <Minus size={12} className={trendColor} />}
          <span className={cn("text-xs font-semibold tabular-nums", trendColor)}>
            {trend > 0 ? "+" : ""}{trend.toFixed(1)}%
          </span>
          <span className="text-xs text-stone-400">vs periode lalu</span>
        </div>
      )}
    </div>
  );
}
