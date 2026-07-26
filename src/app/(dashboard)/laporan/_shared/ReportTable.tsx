"use client";

import { useState } from "react";
import { ChevronUp, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ReportColumn<T> {
  key: string;
  label: string;
  format?: (value: any, row: T) => React.ReactNode;
  sortable?: boolean;
  className?: string;
}

interface ReportTableProps<T> {
  columns: ReportColumn<T>[];
  data: T[];
  pageSize?: number;
  emptyMessage?: string;
  className?: string;
}

export function ReportTable<T extends Record<string, any>>({
  columns,
  data,
  pageSize = 10,
  emptyMessage = "Tidak ada data",
  className,
}: ReportTableProps<T>) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(0);

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const sorted = [...data].sort((a, b) => {
    if (!sortKey) return 0;
    const aVal = a[sortKey];
    const bVal = b[sortKey];
    if (aVal === bVal) return 0;
    if (aVal === null || aVal === undefined) return 1;
    if (bVal === null || bVal === undefined) return -1;
    const compare = aVal < bVal ? -1 : 1;
    return sortDir === "asc" ? compare : -compare;
  });

  const totalPages = Math.ceil(sorted.length / pageSize);
  const paged = sorted.slice(page * pageSize, (page + 1) * pageSize);

  return (
    <div className={cn("overflow-hidden rounded-xl border border-stone-200 bg-white", className)}>
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-stone-100 bg-stone-50/70">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={cn(
                    "px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-stone-500",
                    col.sortable && "cursor-pointer select-none hover:text-stone-700",
                    col.className,
                  )}
                  onClick={() => col.sortable && handleSort(col.key)}
                >
                  <span className="flex items-center gap-1">
                    {col.label}
                    {col.sortable && sortKey === col.key && (
                      sortDir === "asc" ? <ChevronUp size={12} /> : <ChevronDown size={12} />
                    )}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {paged.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-4 py-12 text-center text-sm text-stone-500"
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              paged.map((row, rowIndex) => (
                <tr key={rowIndex} className="hover:bg-stone-50/50">
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={cn("px-4 py-3 text-sm text-stone-700", col.className)}
                    >
                      {col.format
                        ? col.format(row[col.key], row)
                        : row[col.key] ?? "—"}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-stone-100 px-4 py-3">
          <p className="text-[11px] text-stone-500">
            {page * pageSize + 1}–{Math.min((page + 1) * pageSize, sorted.length)} dari {sorted.length}
          </p>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage(Math.max(0, page - 1))}
              disabled={page === 0}
              className="rounded p-1 text-stone-400 hover:bg-stone-100 disabled:opacity-30"
            >
              <ChevronLeft size={16} />
            </button>
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              const pageNum = page < 3 ? i : page - 2 + i;
              if (pageNum < 0 || pageNum >= totalPages) return null;
              return (
                <button
                  key={pageNum}
                  onClick={() => setPage(pageNum)}
                  className={cn(
                    "h-7 w-7 rounded text-xs font-medium",
                    pageNum === page
                      ? "bg-stone-900 text-white"
                      : "text-stone-600 hover:bg-stone-100",
                  )}
                >
                  {pageNum + 1}
                </button>
              );
            })}
            <button
              onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
              disabled={page === totalPages - 1}
              className="rounded p-1 text-stone-400 hover:bg-stone-100 disabled:opacity-30"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
