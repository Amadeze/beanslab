import React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import {
  operatingStages,
  operatingStageTones,
  titleStages,
  type OperatingStage,
} from "@/components/layout/operating-stages";

interface PageHeaderBreadcrumb {
  label: string;
  href?: string;
}

export interface PageHeaderMetric {
  label: string;
  value: React.ReactNode;
  onClick?: () => void;
  active?: boolean;
}

export interface PageHeaderSignal {
  label: string;
  value: React.ReactNode;
  tone?: "critical" | "ready" | "neutral";
  onClick?: () => void;
  active?: boolean;
}

interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  mobileActions?: React.ReactNode;
  stage?: OperatingStage;
  eyebrow?: string;
  breadcrumbs?: PageHeaderBreadcrumb[];
  /** Sinyal status modul (opsional). */
  signal?: PageHeaderSignal;
  /** Metrik ringkas di baris bawah judul. */
  metrics?: PageHeaderMetric[];
  /** Tautan tahap berikutnya. */
  next?: { label: string; href: string };
}

/**
 * CanvasHeader â€” header halaman pada KANVAS TERANG.
 * Hierarki: eyebrow mono copper â†’ judul tinta besar â†’ deskripsi.
 * Tahap ditampilkan sebagai deretan titik kecil yang tenang, bukan bar gelap.
 */
export function PageHeader({
  title,
  description,
  actions,
  mobileActions,
  stage,
  eyebrow,
  breadcrumbs,
  signal,
  metrics,
  next,
}: PageHeaderProps) {
  const activeStage = stage ?? titleStages[title];
  const activeIndex = operatingStages.findIndex((item) => item.id === activeStage);
  const headerTone = activeStage ? operatingStageTones[activeStage] : undefined;

  return (
    <header data-testid="page-header" className="shrink-0">
      {breadcrumbs && breadcrumbs.length > 0 ? (
        <nav aria-label="Breadcrumb" className="pb-2">
          <div className="flex items-center gap-1.5 text-[11px] font-medium text-ink-tertiary">
            {breadcrumbs.map((crumb, index) => {
              const isLast = index === breadcrumbs.length - 1;
              return (
                <span key={crumb.label} className="flex items-center gap-1.5">
                  {crumb.href && !isLast ? (
                    <Link href={crumb.href} className="transition-colors hover:text-foreground">
                      {crumb.label}
                    </Link>
                  ) : (
                    <span
                      className={isLast ? "font-semibold text-ink-secondary" : undefined}
                      aria-current={isLast ? "page" : undefined}
                    >
                      {crumb.label}
                    </span>
                  )}
                  {!isLast && <span aria-hidden className="text-ink-tertiary/50">/</span>}
                </span>
              );
            })}
          </div>
        </nav>
      ) : null}

      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3 pb-4 pt-1">
        <div className="min-w-0">
          <p
            className={cn(
              "mb-1.5 flex items-center gap-2 font-mono text-[9px] font-bold uppercase tracking-[0.2em]",
              headerTone?.eyebrow ?? "text-copper",
            )}
          >
            {activeIndex >= 0 ? (
              <span className="inline-flex items-center gap-[3px]" aria-hidden>
                {operatingStages.map((s, i) => (
                  <span
                    key={s.id}
                    title={`${s.number} ${s.label}`}
                    className={cn(
                      "rounded-full",
                      i === activeIndex
                        ? "size-2 bg-current"
                        : i < activeIndex
                          ? "size-1.5 bg-ink-tertiary"
                          : "size-1.5 border border-border-strong",
                    )}
                  />
                ))}
                <span className="ml-1.5">TAHAP {activeIndex + 1}</span>
              </span>
            ) : null}
            {eyebrow ?? (activeStage ? "Roastery flow" : "Workspace")}
          </p>
          <h1 className="truncate font-heading text-[clamp(1.65rem,2.6vw,2.15rem)] font-bold leading-none tracking-[-0.04em] text-foreground">
            {title}
          </h1>
          {description ? (
            <p className="mt-2 max-w-2xl text-sm leading-5 text-ink-secondary">{description}</p>
          ) : null}
        </div>

        {(actions || mobileActions) && (
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {actions ? (
              <div className="hidden items-center gap-2 md:flex">{actions}</div>
            ) : null}
            {mobileActions ? <div className="flex items-center gap-2 md:hidden">{mobileActions}</div> : null}
            {actions && !mobileActions ? <div className="flex items-center gap-2 md:hidden">{actions}</div> : null}
          </div>
        )}
      </div>

      {(signal || (metrics && metrics.length > 0) || next) && (
        <div className="mb-4 hidden flex-wrap items-center gap-x-5 gap-y-2 rounded-card border border-border/70 bg-card px-4 py-2.5 shadow-elevation-soft md:flex">
          {signal ? (
            <button
              type="button"
              onClick={signal.onClick}
              className={cn(
                "flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1 transition-colors sm:w-auto sm:justify-start",
                signal.onClick && "cursor-pointer hover:bg-surface-sunken",
                signal.active && "bg-surface-sunken ring-1 ring-border",
              )}
            >
              <span className="font-mono text-[8px] font-bold uppercase tracking-[0.16em] text-ink-tertiary">
                {signal.label}
              </span>
              <span
                className={cn(
                  "font-heading text-sm font-bold",
                  signal.tone === "critical"
                    ? "text-[var(--status-danger)]"
                    : signal.tone === "ready"
                      ? headerTone?.signal ?? "text-foreground"
                      : "text-foreground",
                )}
              >
                {signal.value}
              </span>
            </button>
          ) : null}

          {metrics && metrics.length > 0 ? (
            <>
              <span className="hidden h-4 w-px bg-border sm:block" aria-hidden />
              <div className="grid w-full min-w-0 grid-cols-4 gap-2 sm:flex sm:w-auto sm:items-center sm:gap-4">
                {metrics.map((metric) => {
                  const metricContent = (
                    <>
                      <span className="truncate font-mono text-[7px] font-bold uppercase tracking-[0.12em] text-ink-tertiary sm:text-[8px]">
                        {metric.label}
                      </span>
                      <span className="max-w-full truncate font-heading text-xs font-bold tabular-nums text-foreground">
                        {metric.value}
                      </span>
                    </>
                  );
                  if (metric.onClick) {
                    return (
                      <button
                        type="button"
                        key={metric.label}
                        onClick={metric.onClick}
                        aria-pressed={metric.active ?? false}
                        className={cn(
                          "-mx-1 flex min-w-0 cursor-pointer flex-col gap-0.5 rounded-lg px-1 py-0.5 text-left transition-colors sm:flex-row sm:items-center sm:gap-1.5",
                          metric.active ? "bg-surface-sunken ring-1 ring-border" : "hover:bg-surface-sunken",
                        )}
                      >
                        {metricContent}
                      </button>
                    );
                  }
                  return (
                    <div key={metric.label} className="flex min-w-0 flex-col gap-0.5 sm:flex-row sm:items-center sm:gap-1.5">
                      {metricContent}
                    </div>
                  );
                })}
              </div>
            </>
          ) : null}

          {next ? (
            <>
              <span className="hidden h-4 w-px bg-border sm:block" aria-hidden />
              <Link
                href={next.href}
                className={cn(
                  "ml-auto inline-flex items-center gap-1 text-xs font-bold transition-all hover:gap-2",
                  headerTone?.signal ?? "text-primary",
                )}
              >
                {next.label} â†’
              </Link>
            </>
          ) : null}
        </div>
      )}
    </header>
  );
}

export function PageHeaderSkeleton({ stage = false }: { stage?: boolean }) {
  return (
    <div className="shrink-0" aria-hidden>
      <div className="space-y-2 pb-4 pt-1">
        <div className="h-1.5 w-28 animate-pulse rounded-full bg-border" />
        <div className="h-8 w-56 max-w-[60vw] animate-pulse rounded-lg bg-border" />
        <div className="h-2 w-64 max-w-[55vw] animate-pulse rounded-full bg-border/70" />
      </div>
      {stage ? (
        <div className="mb-4 grid grid-cols-6 gap-2" aria-hidden>
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="h-10 animate-pulse rounded-lg bg-border/50" />
          ))}
        </div>
      ) : null}
    </div>
  );
}
