"use client";

import { cn } from "@/lib/utils";

export type CategoryId = "gb" | "rb" | "fg" | "pkg" | "supply";

interface CategoryTab {
  id: CategoryId;
  label: string;
  count: number;
  hasIssues?: boolean;
}

interface CategoryTabsProps {
  tabs: CategoryTab[];
  active: CategoryId;
  onChange: (id: CategoryId) => void;
}

export function CategoryTabs({ tabs, active, onChange }: CategoryTabsProps) {
  return (
    <div className="flex items-center gap-1 overflow-x-auto border-b border-border pb-px [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          className={cn(
            "relative flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full border px-3 py-2 text-[11px] font-semibold leading-none transition-colors min-h-9",
            active === tab.id
              ? "border-copper bg-copper text-white shadow-sm"
              : "border-border bg-card text-ink-secondary hover:border-border-strong hover:text-ink"
          )}
        >
          <span>{tab.label}</span>
          <span className={cn(
            "rounded-full px-1 py-px text-[10px] font-bold tabular-nums",
            active === tab.id ? "bg-white/20 text-white" : "bg-surface-sunken text-ink-tertiary"
          )}>
            {tab.count}
          </span>
          {tab.hasIssues && active !== tab.id && (
            <span className="absolute -right-0.5 -top-0.5 size-1.5 rounded-full border border-card bg-[var(--status-warning)]" />
          )}
        </button>
      ))}
    </div>
  );
}
