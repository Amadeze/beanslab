import * as React from "react";
import { Loader2, Inbox, TriangleAlert, SearchX } from "lucide-react";
import { cn } from "@/lib/utils";
import { Eyebrow } from "./eyebrow";
import { SharedEmptyState } from "@/components/shared/EmptyState";

/**
 * Empty state kanonik — delegasi ke SharedEmptyState (satu implementasi).
 * Props `title` dipetakan ke `label`.
 */
export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <SharedEmptyState
      label={title}
      description={description}
      icon={icon ?? <Inbox size={18} />}
      action={action}
      className={className}
    />
  );
}

/** Loading state with a real spinner (not just text). Use for async regions. */
export function LoadingState({
  label = "Memuat…",
  className,
  icon: Icon = Loader2,
}: {
  label?: string;
  className?: string;
  icon?: React.ComponentType<{ className?: string; size?: number }>;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-center gap-2.5 rounded-card px-6 py-10 text-sm text-ink-secondary",
        className,
      )}
      role="status"
      aria-live="polite"
    >
      <Icon className="size-4 animate-spin text-copper" />
      <span>{label}</span>
    </div>
  );
}

/** Error state with optional retry. */
export function ErrorState({
  title = "Terjadi kesalahan",
  description,
  action,
  className,
}: {
  title?: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-card border border-destructive/25 bg-destructive/5 px-6 py-12 text-center",
        className,
      )}
      role="alert"
    >
      <div className="flex size-11 items-center justify-center rounded-full bg-destructive/10 text-destructive ring-1 ring-destructive/20">
        <TriangleAlert size={18} />
      </div>
      <div className="space-y-1">
        <Eyebrow tone="muted" className="justify-center">
          {title}
        </Eyebrow>
        {description && (
          <p className="max-w-sm text-sm leading-relaxed text-ink-secondary">
            {description}
          </p>
        )}
      </div>
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}

/** Compact "no results" variant for filters/search. */
export function NoResults({
  label = "Tidak ada hasil",
  className,
}: {
  label?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-center gap-2 rounded-card px-6 py-8 text-sm text-ink-tertiary",
        className,
      )}
    >
      <SearchX size={16} />
      <span>{label}</span>
    </div>
  );
}
