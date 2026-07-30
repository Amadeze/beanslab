"use client";

import { useState } from "react";
import {
  ChevronUp, ChevronDown, ChevronLeft, ChevronRight,
  Settings2, ChevronsLeft, ChevronsRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface ReportColumn<T> {
  key: string;
  label: string;
  format?: (value: any, row: T) => React.ReactNode;
  sortable?: boolean;
  className?: string;
  hideable?: boolean;
}

interface ReportTableProps<T> {
  columns: ReportColumn<T>[];
  data: T[];
  pageSize?: number;
  pageSizeOptions?: number[];
  emptyMessage?: string;
  className?: string;
  showColumnToggle?: boolean;
}

export function ReportTable<T extends Record<string, any>>({
  columns, data, pageSize = 10, pageSizeOptions = [10, 25, 50, 100],
  emptyMessage = "Tidak ada data", className, showColumnToggle = true,
}: ReportTableProps<T>) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(0);
  const [currentPageSize, setCurrentPageSize] = useState(pageSize);
  const [hiddenColumns, setHiddenColumns] = useState<Set<string>>(new Set());
  const [showColumnSettings, setShowColumnSettings] = useState(false);

  const visibleColumns = columns.filter((col) => !hiddenColumns.has(col.key));

  const handleSort = (key: string) => {
    if (sortKey === key) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("asc"); }
  };

  const toggleColumn = (key: string) => {
    setHiddenColumns((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else if (visibleColumns.length > 1) next.add(key);
      return next;
    });
  };

  const sorted = [...data].sort((a, b) => {
    if (!sortKey) return 0;
    const aV = a[sortKey], bV = b[sortKey];
    if (aV === bV) return 0;
    if (aV == null) return 1; if (bV == null) return -1;
    return (aV < bV ? -1 : 1) * (sortDir === "asc" ? 1 : -1);
  });

  const totalPages = Math.ceil(sorted.length / currentPageSize);
  const paged = sorted.slice(page * currentPageSize, (page + 1) * currentPageSize);

  return (
    <div className={cn("page-surface overflow-hidden", className)}>
      {showColumnToggle && columns.some((c) => c.hideable !== false) && (
        <div className="flex items-center justify-between border-b border-border bg-muted/55 px-4 py-2">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-medium text-stone-500">{data.length} baris</span>
            <span className="text-[10px] text-stone-400">|</span>
            <span className="text-[10px] text-stone-400">{visibleColumns.length} kolom</span>
          </div>
          <div className="relative">
            <button onClick={() => setShowColumnSettings(!showColumnSettings)}
              className="flex items-center gap-1 rounded-[7px] border border-border bg-card px-2 py-1 text-[10px] font-bold text-muted-foreground hover:bg-accent">
              <Settings2 size={10} /> Kolom
            </button>
            {showColumnSettings && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowColumnSettings(false)} />
                <div className="absolute right-0 top-full z-20 mt-1 w-48 rounded-[10px] border border-border bg-card py-1 shadow-[0_18px_48px_-24px_rgba(5,9,13,.45)]">
                  {columns.map((col) => (
                    <label key={col.key} className="flex cursor-pointer items-center gap-2 px-3 py-1.5 hover:bg-accent/50">
                      <input type="checkbox" checked={!hiddenColumns.has(col.key)}
                        onChange={() => toggleColumn(col.key)} disabled={col.hideable === false}
                        className="h-3 w-3 rounded border-stone-300" />
                      <span className="text-xs text-stone-700">{col.label}</span>
                    </label>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="instrument-grid-dark border-b border-white/10 bg-[#0B141B]">
              {visibleColumns.map((col) => (
                <th key={col.key}
                  className={cn("sticky top-0 z-5 bg-[#0B141B] px-4 py-3 font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-white/62",
                    col.sortable && "cursor-pointer select-none hover:text-stone-700", col.className)}
                  onClick={() => col.sortable && handleSort(col.key)}>
                  <span className="flex items-center gap-1">
                    {col.label}
                    {col.sortable && sortKey === col.key && (sortDir === "asc" ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {paged.length === 0 ? (
              <tr><td colSpan={visibleColumns.length} className="px-4 py-12 text-center text-sm text-stone-500">{emptyMessage}</td></tr>
            ) : paged.map((row, i) => (
              <tr key={i} className={cn("border-b border-border/70 hover:bg-accent/45", i % 2 === 1 && "bg-muted/24")}>
                {visibleColumns.map((col) => (
                  <td key={col.key} className={cn("px-4 py-3 text-sm text-stone-700", col.className)}>
                    {col.format ? col.format(row[col.key], row) : (row[col.key] ?? "—")}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-stone-100 px-4 py-3">
          <span className="text-[11px] text-stone-500">
            {page * currentPageSize + 1}–{Math.min((page + 1) * currentPageSize, sorted.length)} dari {sorted.length}
          </span>
          <div className="flex items-center gap-1">
            <button onClick={() => setPage(0)} disabled={page === 0} className="rounded p-1 text-stone-400 hover:bg-stone-100 disabled:opacity-30"><ChevronsLeft size={14} /></button>
            <button onClick={() => setPage(Math.max(0, page - 1))} disabled={page === 0} className="rounded p-1 text-stone-400 hover:bg-stone-100 disabled:opacity-30"><ChevronLeft size={16} /></button>
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              const pn = page < 3 ? i : page - 2 + i;
              if (pn < 0 || pn >= totalPages) return null;
              return (
                <button key={pn} onClick={() => setPage(pn)}
                  className={cn("h-7 w-7 rounded text-xs font-medium",
                    pn === page ? "bg-amber-700 text-white" : "text-stone-600 hover:bg-stone-100")}>
                  {pn + 1}
                </button>
              );
            })}
            <button onClick={() => setPage(Math.min(totalPages - 1, page + 1))} disabled={page === totalPages - 1} className="rounded p-1 text-stone-400 hover:bg-stone-100 disabled:opacity-30"><ChevronRight size={16} /></button>
            <button onClick={() => setPage(totalPages - 1)} disabled={page === totalPages - 1} className="rounded p-1 text-stone-400 hover:bg-stone-100 disabled:opacity-30"><ChevronsRight size={14} /></button>
          </div>
        </div>
      )}
    </div>
  );
}
