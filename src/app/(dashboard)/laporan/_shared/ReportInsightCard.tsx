"use client";

import { TrendingUp, TrendingDown, AlertTriangle, Info, CheckCircle, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type InsightType = "positive" | "negative" | "warning" | "info";

interface Insight {
  type: InsightType;
  text: string;
  value?: string;
}

interface ReportInsightCardProps {
  insights: Insight[];
  title?: string;
  className?: string;
  maxDisplay?: number;
}

const insightConfig: Record<InsightType, { icon: LucideIcon; bg: string; text: string; border: string }> = {
  positive: {
    icon: CheckCircle,
    bg: "bg-emerald-50",
    text: "text-emerald-700",
    border: "border-emerald-200",
  },
  negative: {
    icon: TrendingDown,
    bg: "bg-rose-50",
    text: "text-rose-700",
    border: "border-rose-200",
  },
  warning: {
    icon: AlertTriangle,
    bg: "bg-amber-50",
    text: "text-amber-700",
    border: "border-amber-200",
  },
  info: {
    icon: Info,
    bg: "bg-blue-50",
    text: "text-blue-700",
    border: "border-blue-200",
  },
};

export function ReportInsightCard({
  insights,
  title = "Wawasan Otomatis",
  className,
  maxDisplay = 5,
}: ReportInsightCardProps) {
  if (!insights || insights.length === 0) return null;

  const displayed = insights.slice(0, maxDisplay);
  const remaining = insights.length - maxDisplay;

  return (
    <div className={cn("rounded-xl border border-stone-200 bg-white p-4", className)}>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-[10px] font-bold uppercase tracking-wider text-stone-500">
          {title}
        </p>
        <span className="rounded-full bg-stone-100 px-2 py-0.5 text-[10px] font-medium text-stone-500">
          {insights.length} insight
        </span>
      </div>
      <div className="space-y-2">
        {displayed.map((insight, index) => {
          const config = insightConfig[insight.type];
          const Icon = config.icon;
          return (
            <div
              key={index}
              className={cn(
                "flex items-start gap-2.5 rounded-lg border p-3",
                config.bg,
                config.border
              )}
            >
              <Icon size={14} className={cn("mt-0.5 shrink-0", config.text)} />
              <div className="min-w-0 flex-1">
                <p className={cn("text-xs font-semibold", config.text)}>
                  {insight.text}
                </p>
                {insight.value && (
                  <p className={cn("mt-0.5 text-[11px] font-bold tabular-nums", config.text)}>
                    {insight.value}
                  </p>
                )}
              </div>
            </div>
          );
        })}
        {remaining > 0 && (
          <p className="text-center text-[11px] text-stone-400">
            +{remaining} insight lainnya
          </p>
        )}
      </div>
    </div>
  );
}
