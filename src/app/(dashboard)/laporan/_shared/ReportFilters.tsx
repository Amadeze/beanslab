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
    <div className={cn("space-y-3", className)}>
      {/* Main filters row */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Date range */}
        <div className="flex items-center gap-2">
          <Calendar size={14} className="text-stone-400" />
          <input
            type="date"
            value={dateRange.start}
            onChange={(e) => onDateRangeChange({ ...dateRange, start: e.target.value })}
            className="rounded-lg border border-stone-200 px-3 py-1.5 text-xs text-stone-700 focus:border-[#00C8DF] focus:outline-none focus:ring-1 focus:ring-[#00C8DF]"
          />
          <span className="text-xs text-stone-400">–</span>
          <input
            type="date"
            value={dateRange.end}
            onChange={(e) => onDateRangeChange({ ...dateRange, end: e.target.value })}
            className="rounded-lg border border-stone-200 px-3 py-1.5 text-xs text-stone-700 focus:border-[#00C8DF] focus:outline-none focus:ring-1 focus:ring-[#00C8DF]"
          />
        </div>

        {/* Date presets */}
        <div className="flex items-center gap-1">
          {DATE_PRESETS.map((preset) => (
            <button
              key={preset.days}
              onClick={() => handlePreset(preset.days)}
              className="rounded-md px-2 py-1 text-xs font-medium text-stone-500 hover:bg-stone-100 hover:text-stone-700"
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
              "flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors",
              showFilters || activeFilterCount > 0
                ? "border-[#00C8DF] bg-[#00C8DF]/5 text-[#00C8DF]"
                : "border-stone-200 text-stone-600 hover:bg-stone-50",
            )}
          >
            <span>Filter</span>
            {activeFilterCount > 0 && (
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[#00C8DF] text-[8px] font-bold text-white">
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
                className="rounded-md border border-stone-200 px-2 py-1 text-xs text-stone-700 focus:border-[#00C8DF] focus:outline-none"
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
