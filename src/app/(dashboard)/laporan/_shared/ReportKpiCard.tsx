"use client";

import { TrendingUp, TrendingDown, Minus, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface ReportKpiCardProps {
  label: string;
  value: string | number;
  subtitle?: string;
  trend?: number;
  icon?: LucideIcon;
  color?: "emerald" | "amber" | "rose" | "blue" | "purple" | "default";
  inverse?: boolean; // For metrics where lower is better (e.g., expenses)
}

const colorMap = {
  emerald: {
    bg: "bg-emerald-50",
    icon: "text-emerald-600",
  },
  amber: {
    bg: "bg-amber-50",
    icon: "text-amber-600",
  },
  rose: {
    bg: "bg-rose-50",
    icon: "text-rose-600",
  },
  blue: {
    bg: "bg-blue-50",
    icon: "text-blue-600",
  },
  purple: {
    bg: "bg-purple-50",
    icon: "text-purple-600",
  },
  default: {
    bg: "bg-stone-50",
    icon: "text-stone-600",
  },
};

export function ReportKpiCard({
  label,
  value,
  subtitle,
  trend,
  icon: Icon,
  color = "default",
  inverse = false,
}: ReportKpiCardProps) {
  const colors = colorMap[color];

  // Calculate trend color based on direction
  const trendColor = (() => {
    if (trend === undefined || trend === 0) return "text-stone-500";
    // For inverse metrics (expenses, losses), negative is good
    if (inverse) {
      return trend < 0 ? "text-emerald-600" : "text-rose-600";
    }
    // For normal metrics (revenue, profit), positive is good
    return trend > 0 ? "text-emerald-600" : "text-rose-600";
  })();

  return (
    <div className="rounded-xl border border-stone-200 bg-white p-4">
      <div className="flex items-start justify-between">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold uppercase tracking-wider text-stone-500">
            {label}
          </p>
          <p className="mt-2 text-xl font-black tracking-tight text-stone-900" style={{ fontVariantNumeric: "tabular-nums" }}>
            {value}
          </p>
          {subtitle && (
            <p className="mt-1 text-[11px] text-stone-500">{subtitle}</p>
          )}
        </div>
        {Icon && (
          <div className={cn("rounded-lg p-2", colors.bg)}>
            <Icon size={16} className={colors.icon} />
          </div>
        )}
      </div>
      {trend !== undefined && (
        <div className="mt-3 flex items-center gap-1" role="status" aria-label={`Trend: ${trend > 0 ? "Naik" : trend < 0 ? "Turun" : "Tetap"} ${Math.abs(trend)}%`}>
          {trend > 0 ? (
            <TrendingUp size={12} className={trendColor} />
          ) : trend < 0 ? (
            <TrendingDown size={12} className={trendColor} />
          ) : (
            <Minus size={12} className={trendColor} />
          )}
          <span className={cn("text-xs font-semibold", trendColor)}>
            {trend > 0 ? "+" : ""}{trend.toFixed(1)}%
          </span>
          <span className="text-[10px] text-stone-400">vs period lalu</span>
        </div>
      )}
    </div>
  );
}
