"use client";

import Link from "next/link";
import { ChevronRight, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Interactive stage cards — SATU tempat untuk status + navigasi tahap.
 * Menggantikan StageStrip + duplikasi hitungan "Perlu tindakan".
 * Seluruh kartu bisa diklik; angka besar = hal yang butuh perhatian.
 */

export type StageCardData = {
  number: string;
  label: string;
  href: string;
  icon: LucideIcon;
  /** Nilai utama kartu — angka/rupiah yang penting hari ini. */
  value: string;
  /** Konteks singkat di bawah nilai. */
  sub: string;
  attention: boolean;
};

export function StageCards({ stages }: { stages: StageCardData[] }) {
  return (
    <section aria-label="Status tahap operasional" className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
      {stages.map(({ number, label, href, icon: Icon, value, sub, attention }) => (
        <Link
          key={number}
          href={href}
          className={cn(
            "group relative flex min-w-0 scroll-mt-20 flex-col gap-2 rounded-card border bg-card p-4 shadow-elevation-soft transition-[border-color,box-shadow,transform] hover:-translate-y-0.5 hover:shadow-elevation-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] motion-reduce:hover:transform-none",
            attention ? "border-[color-mix(in_srgb,var(--status-danger)_45%,transparent)]" : "border-border hover:border-primary/50",
          )}
        >
          {attention ? (
            <span className="absolute right-3 top-3 flex size-2 rounded-full bg-[var(--status-danger)]" aria-label="Perlu perhatian" />
          ) : null}

          <span className="flex items-center justify-between">
            <span className="flex size-7 items-center justify-center rounded-[8px] bg-surface-sunken text-ink-secondary transition-colors group-hover:text-primary">
              <Icon size={14} aria-hidden />
            </span>
            <ChevronRight
              size={15}
              aria-hidden
              className="-translate-x-1 text-ink-tertiary opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100 motion-reduce:transition-none"
            />
          </span>

          <span className="truncate font-mono text-[9px] font-bold uppercase tracking-[0.16em] text-ink-tertiary">
            <span className="mr-1">{number}</span>
            {label}
          </span>

          {/* Nilai utama — hero kartu */}
          <span
            className={cn(
              "truncate font-heading text-[1.45rem] font-bold leading-none tracking-[-0.03em] tabular-nums",
              attention ? "text-[var(--status-danger)]" : "text-foreground",
            )}
          >
            {value}
          </span>
          <span className="truncate text-xs leading-4 text-ink-secondary">{sub}</span>
        </Link>
      ))}
    </section>
  );
}
