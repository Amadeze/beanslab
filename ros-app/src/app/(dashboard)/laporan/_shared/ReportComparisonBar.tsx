"use client";

import { ArrowUpRight, ArrowDownRight, Minus, ArrowLeftRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface ComparisonItem {
  label: string;
  current: number;
  previous: number;
  formatter?: (value: number) => string;
  inverse?: boolean; // true if lower is better (e.g., expenses)
}

interface ReportComparisonBarProps {
  title?: string;
  items: ComparisonItem[];
  className?: string;
}

export function ReportComparisonBar({
  title = "Perbandingan Periode",
  items,
  className,
}: ReportComparisonBarProps) {
  const formatValue = (value: number, formatter?: (v: number) => string) => {
    if (formatter) return formatter(value);
    return new Intl.NumberFormat("id-ID").format(value);
  };

  const getChangePercent = (current: number, previous: number): number | null => {
    if (previous === 0) return null; // periode sebelumnya kosong — tidak terbandingkan
    return ((current - previous) / Math.abs(previous)) * 100;
  };

  const getChangeColor = (percent: number | null, inverse: boolean) => {
    if (percent === null || percent === 0) return "text-stone-500";
    const isPositive = percent > 0;
    if (inverse) {
      return isPositive ? "text-rose-600" : "text-emerald-600";
    }
    return isPositive ? "text-emerald-600" : "text-rose-600";
  };

  const getChangeBg = (percent: number | null, inverse: boolean) => {
    if (percent === null || percent === 0) return "bg-stone-50";
    const isPositive = percent > 0;
    if (inverse) {
      return isPositive ? "bg-rose-50" : "bg-emerald-50";
    }
    return isPositive ? "bg-emerald-50" : "bg-rose-50";
  };

  return (
    <div className={cn("rounded-xl border border-stone-200 bg-white p-4", className)}>
      <div className="mb-3 flex items-center gap-2">
        <ArrowLeftRight size={14} className="text-stone-400" />
        <p className="text-xs font-bold uppercase tracking-wider text-stone-500">
          {title}
        </p>
      </div>
      <div className="space-y-2">
        {items.map((item, index) => {
          const changePercent = getChangePercent(item.current, item.previous);
          const changeColor = getChangeColor(changePercent, item.inverse ?? false);
          const changeBg = getChangeBg(changePercent, item.inverse ?? false);

          return (
            <div
              key={index}
              className="flex items-center justify-between rounded-lg bg-stone-50/50 px-3 py-2"
            >
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-stone-700">{item.label}</p>
                <div className="mt-0.5 flex items-baseline gap-2">
                  <span className="text-sm font-bold text-stone-900 tabular-nums">
                    {formatValue(item.current, item.formatter)}
                  </span>
                  <span className="text-xs text-stone-400">
                    vs {formatValue(item.previous, item.formatter)}
                  </span>
                </div>
              </div>
              <div
                className={cn(
                  "flex items-center gap-1 rounded-full px-2 py-0.5",
                  changeBg
                )}
              >
                {changePercent === null ? (
                  <>
                    <Minus size={10} className={changeColor} />
                    <span className={cn("text-xs font-semibold tabular-nums", changeColor)}>—</span>
                  </>
                ) : changePercent > 0 ? (
                  <ArrowUpRight size={10} className={changeColor} />
                ) : changePercent < 0 ? (
                  <ArrowDownRight size={10} className={changeColor} />
                ) : (
                  <Minus size={10} className={changeColor} />
                )}
                {changePercent !== null && (
                  <span className={cn("text-xs font-semibold tabular-nums", changeColor)}>
                    {changePercent > 0 ? "+" : ""}
                    {changePercent.toFixed(1)}%
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
