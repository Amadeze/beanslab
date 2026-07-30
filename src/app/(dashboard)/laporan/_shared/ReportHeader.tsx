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
    <div className={cn("page-surface px-5 py-4", className)}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2.5">
            <div className="rounded-lg bg-amber-50 p-1.5">
              <FileText size={14} className="text-amber-700" />
            </div>
            <h2 className="text-sm font-bold text-stone-800">{title}</h2>
            {status && (
              <span className={cn(
                "inline-flex rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider",
                status === "FINAL"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : "border-amber-200 bg-amber-50 text-amber-700",
              )}>
                {status}
              </span>
            )}
          </div>
          {subtitle && <p className="text-xs text-stone-500">{subtitle}</p>}
          <div className="flex flex-wrap items-center gap-3 text-[11px] text-stone-400">
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
