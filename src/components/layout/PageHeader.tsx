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
  /** Sinyal status modul (opsional, baris kedua). */
  signal?: PageHeaderSignal;
  /** Metrik ringkas di baris kedua. */
  metrics?: PageHeaderMetric[];
  /** Tautan tahap berikutnya di baris kedua. */
  next?: { label: string; href: string };
}

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
  const activeIndex = operatingStages.findIndex(
    (item) => item.id === activeStage,
  );
  const headerTone = activeStage ? operatingStageTones[activeStage] : undefined;

  return (
    <header
      data-testid="page-header"
      className="instrument-grid-dark relative z-20 shrink-0 border-b border-white/10 bg-[#05090D] text-white"
    >
      {breadcrumbs && breadcrumbs.length > 0 && (
        <nav
          aria-label="Breadcrumb"
          className="border-b border-white/[0.06] bg-[#0B141B]/40"
        >
          <div className="mx-auto flex w-full max-w-[1600px] items-center gap-1.5 px-4 py-1.5 text-[10px] font-semibold text-white/40 sm:px-6 lg:px-8">
            {breadcrumbs.map((crumb, index) => {
              const isLast = index === breadcrumbs.length - 1;
              return (
                <span key={crumb.label} className="flex items-center gap-1.5">
                  {crumb.href && !isLast ? (
                    <Link
                      href={crumb.href}
                      className="transition-colors hover:text-white/80"
                    >
                      {crumb.label}
                    </Link>
                  ) : (
                    <span
                      className={isLast ? "text-white/75" : undefined}
                      aria-current={isLast ? "page" : undefined}
                    >
                      {crumb.label}
                    </span>
                  )}
                  {!isLast && (
                    <span aria-hidden className="text-white/20">
                      /
                    </span>
                  )}
                </span>
              );
            })}
          </div>
        </nav>
      )}
      <div
        className={cn(
          "mx-auto grid min-h-[56px] w-full max-w-[1600px] grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-2 sm:px-6 lg:px-8",
          activeStage &&
            "xl:grid-cols-[minmax(230px,0.72fr)_minmax(480px,1.4fr)_auto]",
        )}
      >
        <div className="min-w-0">
          <p
              className={cn(
                "mb-1.5 flex items-center gap-2 font-mono text-[8px] font-bold uppercase tracking-[0.2em]",
                headerTone?.eyebrow ?? "text-[var(--stage-system-soft)]",
              )}
          >
            <span
              className={cn(
                "size-1.5 rounded-full shadow-[0_0_12px_currentColor]",
                headerTone?.active
                  .split(" ")
                  .find((value) => value.startsWith("bg-")) ?? "bg-[var(--instrument)]",
              )}
              aria-hidden
            />
            {eyebrow ?? (activeStage ? "Roastery flow" : "Workspace")}
          </p>
          <div className="flex items-center gap-3">
            <h1 className="truncate font-heading text-[clamp(1.3rem,2.1vw,1.8rem)] font-bold leading-none tracking-[-0.045em] text-white">
              {title}
            </h1>
            {activeIndex >= 0 && (
              <span className="hidden font-mono text-[9px] font-bold tracking-[0.16em] text-white/30 sm:inline">
                SYS 0{activeIndex + 1} / {String(operatingStages.length).padStart(2, "0")}
              </span>
            )}
          </div>
          {description && (
            <p className="mt-1.5 max-w-2xl truncate text-[11px] leading-4 text-white/45">
              {description}
            </p>
          )}
        </div>
        {activeStage && (
          <nav
            data-testid="operating-stage-rail"
            aria-label="Alur operasional roastery"
            className="hidden min-w-0 xl:block"
          >
            <div className="grid h-12 w-full grid-cols-6">
              {operatingStages.map((item, index) => {
                const isActive = item.id === activeStage;
                const isComplete = activeIndex > index;
                const Icon = item.icon;
                const tone = operatingStageTones[item.id];

                return (
                  <Link
                    key={item.id}
                    href={item.href}
                    aria-current={isActive ? "step" : undefined}
                    className="group relative flex min-w-0 flex-col items-center justify-center gap-1 text-center"
                  >
                    {index > 0 && (
                      <span
                        aria-hidden
                        className={`absolute right-1/2 top-[16px] h-px w-full ${
                          index <= activeIndex ? tone.line : "bg-white/10"
                        }`}
                      />
                    )}
                    <span
                      className={cn(
                        "relative z-10 flex size-7 items-center justify-center rounded-[7px] border transition-colors",
                        isActive
                          ? tone.active
                          : isComplete
                            ? tone.complete
                            : "border-white/10 bg-white/[0.035] text-white/30 group-hover:border-white/25 group-hover:text-white/60",
                      )}
                      aria-label={`Tahap ${item.number}`}
                    >
                      <Icon size={12} strokeWidth={isActive ? 2.2 : 1.8} />
                    </span>
                    <span
                      className={cn(
                        "relative z-10 truncate text-[9px] font-semibold",
                        isActive ? tone.label : "text-white/32",
                      )}
                    >
                      {item.label}
                    </span>
                  </Link>
                );
              })}
            </div>
          </nav>
        )}
        {(actions || mobileActions) && (
          <div className="flex shrink-0 flex-wrap items-center gap-2 rounded-[11px] border border-white/8 bg-white/[0.035] p-1">
            {actions && (
              <div className="hidden items-center gap-2 md:flex">{actions}</div>
            )}
            {mobileActions && (
              <div className="flex items-center gap-2 md:hidden">
                {mobileActions}
              </div>
            )}
            {actions && !mobileActions && (
              <div className="flex items-center gap-2 md:hidden">{actions}</div>
            )}
          </div>
        )}
      </div>
      {(signal || (metrics && metrics.length > 0) || next) && (
        <div className="border-t border-white/[0.06] bg-[#0B141B]/60">
          <div className="mx-auto flex w-full max-w-[1600px] flex-wrap items-center gap-x-6 gap-y-2 px-4 py-2 sm:px-6 lg:px-8">
            {signal && (
              <button
                type="button"
                onClick={signal.onClick}
                className={cn(
                  "flex w-full items-center justify-between gap-2 rounded-lg px-3 py-1.5 transition-all sm:w-auto sm:justify-start",
                  signal.onClick && "cursor-pointer hover:bg-white/5",
                  signal.active && "bg-white/10 ring-1 ring-white/20",
                )}
              >
                <span className="font-mono text-[8px] font-bold uppercase tracking-[0.16em] text-white/35">
                  {signal.label}
                </span>
                <span
                  className={cn(
                    "font-heading text-sm font-bold",
                    signal.tone === "critical"
                      ? "text-[var(--chrome-danger-soft)]"
                      : signal.tone === "ready"
                        ? headerTone?.signal ?? "text-white"
                        : "text-white",
                  )}
                >
                  {signal.value}
                </span>
              </button>
            )}

            {metrics && metrics.length > 0 ? (
              <>
                <span className="hidden h-4 w-px bg-white/10 sm:block" aria-hidden />
                <div className="grid w-full min-w-0 grid-cols-4 gap-2 sm:flex sm:w-auto sm:items-center sm:gap-4">
                  {metrics.map((metric) => {
                    const metricContent = (
                      <>
                        <span className="truncate font-mono text-[7px] font-bold uppercase tracking-[0.1em] text-white/30 sm:text-[8px] sm:tracking-[0.12em]">
                          {metric.label}
                        </span>
                        <span className="max-w-full truncate font-heading text-xs font-bold tabular-nums text-white/80">
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
                            metric.active
                              ? "bg-white/10 ring-1 ring-white/20"
                              : "hover:bg-white/5",
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
                <span className="hidden h-4 w-px bg-white/10 sm:block" aria-hidden />
                <Link
                  href={next.href}
                  className={cn(
                    "ml-auto text-xs font-bold transition-[color,gap] hover:gap-2",
                    headerTone?.signal ?? "text-[var(--chrome-instrument-soft)]",
                  )}
                >
                  {next.label} →
                </Link>
              </>
            ) : null}
          </div>
        </div>
      )}
      {activeStage && (
        <nav
          data-testid="operating-stage-rail-mobile"
          aria-label="Alur operasional roastery"
          className="border-t border-white/[0.08] bg-[#0B141B]/95 xl:hidden"
        >
          <div className="mx-auto grid h-[44px] w-full max-w-[1600px] grid-cols-6 px-2 sm:px-6 lg:px-8">
            {operatingStages.map((item, index) => {
              const isActive = item.id === activeStage;
              const isComplete = activeIndex > index;
              const Icon = item.icon;
              const tone = operatingStageTones[item.id];

              return (
                <Link
                  key={item.id}
                  href={item.href}
                  aria-current={isActive ? "step" : undefined}
                  className="group relative flex min-w-0 flex-col items-center justify-center gap-1 text-center"
                >
                  {index > 0 && (
                    <span
                      aria-hidden
                      className={`absolute right-1/2 top-[17px] h-px w-full ${
                        index <= activeIndex ? tone.line : "bg-white/10"
                      }`}
                    />
                  )}
                  <span
                    className={cn(
                      "relative z-10 flex size-6 items-center justify-center rounded-[6px] border transition-colors",
                      isActive
                        ? tone.active
                        : isComplete
                          ? tone.complete
                          : "border-white/10 bg-white/[0.035] text-white/30 group-hover:border-white/25 group-hover:text-white/60",
                    )}
                    aria-label={`Tahap ${item.number}`}
                  >
                    <Icon size={10} strokeWidth={isActive ? 2.2 : 1.8} />
                  </span>
                  <span
                    className={cn(
                      "relative z-10 truncate text-[7px] font-semibold sm:text-[8px]",
                      isActive ? tone.label : "text-white/32",
                    )}
                  >
                    <span className="sm:hidden">{item.shortLabel}</span>
                    <span className="hidden sm:inline">{item.label}</span>
                  </span>
                </Link>
              );
            })}
          </div>
        </nav>
      )}
    </header>
  );
}

export function PageHeaderSkeleton({ stage = false }: { stage?: boolean }) {
  return (
    <div className="shrink-0 border-b border-white/10 bg-[#05090D]" aria-hidden>
      <div className="mx-auto flex min-h-[56px] w-full max-w-[1600px] items-center justify-between gap-3 px-4 py-2 sm:px-6 lg:px-8">
        <div className="space-y-1.5">
          <div className="h-1.5 w-20 animate-pulse rounded-full bg-white/20" />
          <div className="h-5 w-44 animate-pulse rounded-md bg-white/15" />
          <div className="h-2 w-48 max-w-[55vw] animate-pulse rounded-full bg-white/10" />
        </div>
        <div className="h-8 w-24 animate-pulse rounded-lg bg-white/10" />
      </div>
      {stage && (
        <div className="grid h-[44px] grid-cols-6 border-t border-white/10 bg-[#0B141B] px-6 xl:hidden">
          {Array.from({ length: 6 }).map((_, index) => (
            <div
              key={index}
              className="flex flex-col items-center justify-center gap-1.5"
            >
              <div className="h-6 w-6 animate-pulse rounded-[6px] bg-white/10" />
              <div className="h-1.5 w-10 animate-pulse rounded-full bg-white/10" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
