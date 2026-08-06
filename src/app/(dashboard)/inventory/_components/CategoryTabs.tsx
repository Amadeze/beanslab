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
    <div className="flex gap-0 border-b border-slate-200/60">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          className={cn(
            "relative flex items-center gap-1.5 whitespace-nowrap px-3 py-2 text-xs font-semibold transition-colors",
            active === tab.id
              ? "text-amber-800"
              : "text-slate-500 hover:text-slate-700"
          )}
        >
          <span>{tab.label}</span>
          <span className={cn(
            "rounded-full px-1.5 py-px text-xs font-bold tabular-nums",
            active === tab.id ? "bg-blue-100 text-amber-800" : "bg-slate-100 text-slate-500"
          )}>
            {tab.count}
          </span>
          {tab.hasIssues && active !== tab.id && (
            <span className="absolute right-0 top-1.5 h-1.5 w-1.5 rounded-full bg-amber-500" />
          )}
          {active === tab.id && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-amber-700 rounded-t" />
          )}
        </button>
      ))}
    </div>
  );
}
