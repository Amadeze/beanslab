"use client";

import { FileText, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

interface ReportHeaderProps {
  title: string;
  subtitle?: string;
  period?: string;
  status?: "DRAFT" | "FINAL";
  generatedAt?: Date;
  className?: string;
  actions?: React.ReactNode;
}

export function ReportHeader({
  title, subtitle, period, status = "DRAFT", generatedAt, className, actions,
}: ReportHeaderProps) {
  const formattedDate = generatedAt
    ? new Intl.DateTimeFormat("id-ID", {
        day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit",
      }).format(generatedAt)
    : null;

  return (
    <div className={cn("rounded-card border border-border bg-card px-5 py-4 shadow-elevation-soft", className)}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2.5">
            <div className="flex size-8 items-center justify-center rounded-[9px] bg-moss-soft text-moss ring-1 ring-moss/15">
              <FileText size={14} />
            </div>
            <h2 className="font-heading text-base font-bold tracking-[-0.02em] text-ink">{title}</h2>
            {status && (
              <span className={cn(
                "inline-flex rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider",
                status === "FINAL"
                  ? "border-[var(--status-success)]/30 bg-[var(--status-success)]/10 text-[var(--status-success)]"
                  : "border-border-strong bg-surface-sunken text-ink-secondary",
              )}>
                {status}
              </span>
            )}
          </div>
          {subtitle && <p className="text-xs text-ink-secondary">{subtitle}</p>}
          <div className="flex flex-wrap items-center gap-3 text-[11px] text-ink-tertiary">
            {period && <span>Periode: {period}</span>}
            {formattedDate && (
              <span className="flex items-center gap-1">
                <Clock size={10} /> Dibuat: {formattedDate}
              </span>
            )}
          </div>
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}
