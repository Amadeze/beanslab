"use client";

import { useState } from "react";
import { Calendar, ChevronDown, X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface DateRange {
  start: string;
  end: string;
}

export interface FilterOption {
  value: string;
  label: string;
}

export interface FilterConfig {
  key: string;
  label: string;
  options: FilterOption[];
}

interface ReportFiltersProps {
  dateRange: DateRange;
  onDateRangeChange: (range: DateRange) => void;
  filters?: FilterConfig[];
  activeFilters?: Record<string, string>;
  onFilterChange?: (key: string, value: string) => void;
  className?: string;
}

const DATE_PRESETS = [
  { label: "7 hari", days: 7 },
  { label: "30 hari", days: 30 },
  { label: "90 hari", days: 90 },
  { label: "Tahun ini", days: 365 },
];

export function ReportFilters({
  dateRange,
  onDateRangeChange,
  filters = [],
  activeFilters = {},
  onFilterChange,
  className,
}: ReportFiltersProps) {
  const [showFilters, setShowFilters] = useState(false);

  const handlePreset = (days: number) => {
    // Use local timezone dates (YYYY-MM-DD format) to match user's browser timezone
    const formatDate = (d: Date) => {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      return `${year}-${month}-${day}`;
    };
    const end = new Date();
    // Reset to start of day to avoid time-of-day issues
    end.setHours(23, 59, 59, 999);
    const start = new Date();
    start.setDate(start.getDate() - days);
    start.setHours(0, 0, 0, 0);
    onDateRangeChange({
      start: formatDate(start),
      end: formatDate(end),
    });
  };

  const activeFilterCount = Object.values(activeFilters).filter(Boolean).length;

  return (
    <div className={cn("space-y-2", className)}>
      {/* Main filters row — compact */}
      <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
        {/* Date range */}
        <div className="flex items-center gap-1">
          <Calendar size={13} className="hidden text-stone-400 sm:block" />
          <input
            type="date"
            value={dateRange.start}
            onChange={(e) => onDateRangeChange({ ...dateRange, start: e.target.value })}
            className="min-h-9 h-9 rounded-lg border border-stone-200 bg-card px-2 text-[11px] text-ink focus:border-[var(--instrument)] focus:outline-none focus:ring-1 focus:ring-[var(--instrument)] sm:px-2.5 sm:text-xs"
          />
          <span className="text-[11px] text-ink-secondary">–</span>
          <input
            type="date"
            value={dateRange.end}
            onChange={(e) => onDateRangeChange({ ...dateRange, end: e.target.value })}
            className="min-h-9 h-9 rounded-lg border border-stone-200 bg-card px-2 text-[11px] text-ink focus:border-[var(--instrument)] focus:outline-none focus:ring-1 focus:ring-[var(--instrument)] sm:px-2.5 sm:text-xs"
          />
        </div>

        {/* Date presets — pill chips hemat ruang, min 36px */}
        <div className="flex items-center gap-1">
          {DATE_PRESETS.map((preset) => (
            <button
              key={preset.days}
              onClick={() => handlePreset(preset.days)}
              className="inline-flex min-h-9 items-center rounded-full border border-border bg-card px-2.5 py-1.5 text-[11px] font-semibold leading-none text-ink-secondary transition-colors hover:border-[var(--instrument)]/30 hover:bg-[var(--instrument)]/5 hover:text-ink"
            >
              {preset.label}
            </button>
          ))}
        </div>

        {/* Filter toggle */}
        {filters.length > 0 && (
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={cn(
              "flex min-h-9 items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition-colors",
              showFilters || activeFilterCount > 0
                ? "border-[var(--instrument)] bg-[var(--instrument)]/5 text-[var(--instrument)]"
                : "border-border bg-card text-ink-secondary hover:bg-surface-sunken",
            )}
          >
            <span>Filter</span>
            {activeFilterCount > 0 && (
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[var(--instrument)] text-[8px] font-bold text-white">
                {activeFilterCount}
              </span>
            )}
            <ChevronDown
              size={12}
              className={cn("transition-transform", showFilters && "rotate-180")}
            />
          </button>
        )}
      </div>

      {/* Extended filters */}
      {showFilters && filters.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-stone-100 bg-stone-50/50 p-3">
          {filters.map((filter) => (
            <div key={filter.key} className="flex items-center gap-2">
              <label className="text-xs font-medium text-stone-500">
                {filter.label}
              </label>
              <select
                value={activeFilters[filter.key] || ""}
                onChange={(e) => onFilterChange?.(filter.key, e.target.value)}
                className="rounded-md border border-stone-200 px-2 py-1 text-xs text-stone-700 focus:border-[var(--instrument)] focus:outline-none"
              >
                <option value="">Semua</option>
                {filter.options.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          ))}
          {activeFilterCount > 0 && (
            <button
              onClick={() => {
                Object.keys(activeFilters).forEach((key) => onFilterChange?.(key, ""));
              }}
              className="flex items-center gap-1 text-xs text-stone-500 hover:text-stone-700"
            >
              <X size={12} />
              Reset
            </button>
          )}
        </div>
      )}
    </div>
  );
}
