"use client";

import React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import {
  operatingStages,
  operatingStageTones,
  titleStages,
  type OperatingStage,
} from "@/components/layout/operating-stages";

export interface HeaderAction {
  label: string;
  onClick: () => void;
  variant?: "primary" | "secondary" | "ghost";
  icon?: React.ReactNode;
  mobileOnly?: boolean;
  desktopOnly?: boolean;
}

export interface HeaderSignal {
  label: string;
  value: string | number;
  tone?: "critical" | "ready" | "neutral";
  onClick?: () => void;
}

export interface HeaderMetric {
  label: string;
  value: string | number;
}

export interface Breadcrumb {
  label: string;
  href?: string;
}

// Backward compatible types
export type PageHeaderSignal = HeaderSignal;
export type PageHeaderMetric = HeaderMetric;

interface PageHeaderProps {
  title: string;
  description?: string;
  stage?: OperatingStage;
  showStage?: boolean;
  eyebrow?: string;
  signal?: HeaderSignal;
  metric?: HeaderMetric;
  actions?: HeaderAction[] | React.ReactNode;
  mobileActions?: React.ReactNode;
  metrics?: HeaderMetric[];
  breadcrumbs?: Breadcrumb[];
  /** Compact mode: tighter spacing, smaller text */
  compact?: boolean;
  /** Next step link (backward compat) */
  next?: { label: string; href: string };
}

export function PageHeader({
  title,
  description,
  stage,
  showStage = true,
  eyebrow,
  signal,
  metric,
  actions,
  mobileActions,
  metrics,
  breadcrumbs,
  compact = false,
}: PageHeaderProps) {
  const activeStage = stage ?? titleStages[title];
  const activeIndex = operatingStages.findIndex((item) => item.id === activeStage);
  const headerTone = activeStage ? operatingStageTones[activeStage] : undefined;

  // Handle both old (ReactNode) and new (HeaderAction[]) actions format
  const actionsArray = Array.isArray(actions) ? actions : [];
  const desktopActions = actionsArray.filter((a) => !a.mobileOnly);
  const mobileActionsFromArray = actionsArray.filter((a) => !a.desktopOnly);

  // Backward compat: support old metrics array
  const metricToUse = metric || (metrics && metrics[0]);

  // Backward compat: support old signal format
  const signalToUse = signal;

  // Check if mobileActions (ReactNode) is provided for backward compat
  const hasMobileActions = mobileActions !== undefined && mobileActions !== null;

  return (
    <header data-testid="page-header" className="shrink-0">
      <div className={cn(
        "flex items-center justify-between gap-2 flex-wrap",
        compact ? "px-2 py-1.5 md:px-3 md:py-2" : "px-3 py-2 md:px-4 md:py-2.5"
      )}>
        {/* Left: Breadcrumbs + Title + Signal */}
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {breadcrumbs && breadcrumbs.length > 0 && !compact && (
            <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-[11px] font-medium text-ink-secondary flex-shrink-0">
              {breadcrumbs.slice(0, 2).map((crumb, index) => {
                const isLast = index === breadcrumbs.length - 1 || index === 1;
                return (
                  <span key={crumb.label} className="flex items-center gap-1.5 truncate">
                    {crumb.href && !isLast ? (
                      <Link href={crumb.href} className="transition-colors hover:text-foreground truncate max-w-[80px]">
                        {crumb.label}
                      </Link>
                    ) : (
                      <span
                        className={isLast ? "font-semibold text-ink-secondary truncate max-w-[100px]" : "truncate max-w-[60px]"}
                        aria-current={isLast ? "page" : undefined}
                      >
                        {crumb.label}
                      </span>
                    )}
                    {!isLast && <span aria-hidden className="text-ink-secondary/50">/</span>}
                  </span>
                );
              })}
              {breadcrumbs.length > 2 && (
                <span className="text-ink-tertiary">…</span>
              )}
            </nav>
          )}

          {/* Stage badge */}
          {showStage && activeIndex >= 0 && (
            <span className={cn(
              "inline-flex items-center gap-1 font-mono text-[8px] font-bold uppercase tracking-[0.2em] rounded-full px-1.5 py-0.5 shrink-0",
              headerTone?.eyebrow ?? "text-copper bg-copper-soft"
            )}>
              {operatingStages.slice(0, activeIndex + 1).map((s, i) => (
                <span
                  key={s.id}
                  className={cn("rounded-full", i === activeIndex
                    ? "size-1.5 bg-current"
                    : "size-1.5 bg-ink-tertiary")}
                />
              ))}
              <span className="ml-0.5">T{activeIndex + 1}</span>
            </span>
          )}

          {/* Eyebrow (backward compat) */}
          {eyebrow && (
            <span className="font-mono text-[8px] font-bold uppercase tracking-[0.2em] text-copper">
              {eyebrow}
            </span>
          )}

          <h1 className="truncate font-heading text-[clamp(1.25rem,4vw,1.75rem)] font-bold leading-none tracking-[-0.03em] text-foreground">
            {title}
          </h1>

          {/* Signal badge next to title */}
          {signalToUse && (
            <span className={cn(
              "shrink-0 inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-[0.1em]",
              signalToUse.tone === "critical" ? "bg-[var(--status-danger)]/10 text-[var(--status-danger)] border border-[var(--status-danger)]/30" :
              signalToUse.tone === "ready" ? "bg-[var(--status-success)]/10 text-[var(--status-success)] border border-[var(--status-success)]/30" :
              "bg-surface-sunken text-ink-secondary border border-border"
            )}>
              {signalToUse.label} {signalToUse.value}
            </span>
          )}

          {/* Description as subtitle */}
          {description && (
            <p className="hidden md:block truncate text-[11px] leading-4 text-ink-secondary max-w-[300px]" title={description}>
              {description}
            </p>
          )}
        </div>

        {/* Right: Metric + Actions */}
        <div className="flex items-center gap-1.5 shrink-0">
          {metricToUse && (
            <span className="hidden sm:inline-flex items-center gap-1 rounded-full border border-border bg-card px-2 py-1 text-[10px] font-semibold leading-none">
              <span className="text-ink-secondary">{metricToUse.label}</span>
              <span className="font-heading font-bold tabular-nums text-foreground">{metricToUse.value}</span>
            </span>
          )}

          {/* Desktop actions */}
          <div className="hidden md:flex items-center gap-1">
            {desktopActions.map((action, i) => (
              <button
                key={action.label}
                type="button"
                onClick={action.onClick}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-semibold leading-none transition-colors min-h-9",
                  action.variant === "primary" ? "bg-primary text-primary-foreground hover:bg-primary/90" :
                  action.variant === "secondary" ? "bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20" :
                  "bg-card text-ink-secondary border border-border hover:bg-surface-sunken"
                )}
              >
                {action.icon}
                <span>{action.label}</span>
              </button>
            ))}
          </div>

          {/* Mobile: overflow menu button */}
          <div className="md:hidden">
            {hasMobileActions ? (
              mobileActions
            ) : mobileActionsFromArray.length > 0 ? (
              <button
                type="button"
                className="flex min-h-9 items-center justify-center rounded-full border border-border bg-card px-3 text-ink-secondary shadow-sm"
              >
                <span className="text-[11px] font-medium">Aksi</span>
              </button>
            ) : null}
          </div>
        </div>
      </div>

      {/* Mobile description line */}
      {description && compact && (
        <p className="md:hidden mt-1 truncate text-[11px] leading-4 text-ink-secondary" title={description}>
          {description}
        </p>
      )}
    </header>
  );
}

export interface HeaderAction {
  label: string;
  onClick: () => void;
  variant?: "primary" | "secondary" | "ghost";
  icon?: React.ReactNode;
  mobileOnly?: boolean;
  desktopOnly?: boolean;
}

export interface HeaderSignal {
  label: string;
  value: string | number;
  tone?: "critical" | "ready" | "neutral";
  onClick?: () => void;
}

export interface HeaderMetric {
  label: string;
  value: string | number;
}

export interface Breadcrumb {
  label: string;
  href?: string;
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