"use client";

import React, { useId } from "react";
import { AreaChart, Area, ResponsiveContainer } from "recharts";
import { cn } from "@/lib/utils";

export function KpiRibbon({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className="mx-auto w-full max-w-[1600px] px-4 py-3 sm:px-6 lg:px-8">
      <div className={cn("grid overflow-hidden rounded-[14px] border border-border bg-card shadow-[0_1px_0_rgba(5,9,13,.04)] sm:grid-cols-2 lg:grid-cols-4", className)}>
        {children}
      </div>
    </div>
  );
}

interface KpiCardProps {
  label: string;
  value: string | number;
  sub?: React.ReactNode;
  trend?: number[];
  color?: string;
  icon?: React.ReactNode;
  onClick?: () => void;
  active?: boolean;
  signal?: {
    label: string;
    value: React.ReactNode;
    tone?: "critical" | "ready" | "neutral";
  };
}

export function KpiCard({ label, value, sub, trend, color = "var(--copper)", icon, onClick, active, signal }: KpiCardProps) {
  const trendData = trend ? trend.map(v => ({ v })) : [];
  const uid = useId();
  const gradientId = `sparkline-gradient-${uid.replace(/:/g, "")}`;

  const signalColor = signal?.tone === "critical"
    ? "text-[var(--status-danger)]"
    : signal?.tone === "ready"
      ? "text-[var(--status-success)]"
      : "text-[var(--ink-tertiary)]";

  return (
    <div
      onClick={onClick}
      className={cn(
        "group relative flex min-h-[86px] flex-col overflow-hidden border-b border-border p-3.5 transition-colors sm:border-r lg:border-b-0 lg:p-4 [&:nth-child(2n)]:sm:border-r-0 [&:nth-child(4n)]:lg:border-r-0",
        onClick && "cursor-pointer hover:bg-accent/45",
        active && "bg-accent shadow-[inset_0_-3px_0_var(--primary)]"
      )}
    >
      <div className="relative z-10 mb-auto flex items-start justify-between">
        <p className="font-mono text-[9px] font-bold uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
        {icon && (
          <div
            className="flex h-7 w-7 items-center justify-center rounded-[8px] border"
            style={{
              color,
              borderColor: `color-mix(in srgb, ${color} 32%, transparent)`,
              backgroundColor: `color-mix(in srgb, ${color} 12%, white)`,
            }}
          >
            {icon}
          </div>
        )}
      </div>
      <div className="relative z-10 mt-2">
        <h3 className="font-heading text-lg font-bold leading-none tracking-[-0.04em] text-foreground lg:text-xl">{value}</h3>
        {sub && <p className="mt-1.5 text-xs text-muted-foreground">{sub}</p>}
      </div>
      {/* Signal indicator */}
      {signal && (
        <div className={cn("mt-2 flex items-center gap-1.5 text-xs font-semibold", signalColor)}>
          <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />
          <span>{signal.label}</span>
          <span className="font-bold">{signal.value}</span>
        </div>
      )}
      
      {trendData.length > 0 && (
        <div className="pointer-events-none absolute bottom-0 right-0 h-14 w-[48%] opacity-25 transition-opacity group-hover:opacity-50">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={trendData} margin={{ top: 5, right: 0, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={color} stopOpacity={0.8}/>
                  <stop offset="95%" stopColor={color} stopOpacity={0}/>
                </linearGradient>
              </defs>
              <Area 
                type="monotone" 
                dataKey="v" 
                stroke={color} 
                strokeWidth={2}
                fillOpacity={1} 
                fill={`url(#${gradientId})`} 
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
