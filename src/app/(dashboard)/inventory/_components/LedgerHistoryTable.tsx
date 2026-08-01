"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { InventoryEmptyState } from "./InventoryEmptyState";
import type { LedgerHistoryRow } from "../actions";

const PAGE_SIZE = 25;

const SAMPLE_REF_TYPES = new Set(["SAMPLE_RB_OUT", "SAMPLE_FG_OUT", "SAMPLE_PKG_OUT"]);

const REF_TYPE_LABELS: Record<string, string> = {
  PURCHASE_GB: "Pembelian GB",
  PURCHASE_PKG: "Pembelian PKG",
  ROASTING_GB_OUT: "Roasting GB",
  ROASTING_RB_IN: "Roasting RB",
  PRODUCTION_RB_OUT: "Produksi RB",
  PRODUCTION_PKG_OUT: "Produksi PKG",
  PRODUCTION_FG_IN: "Produksi FG",
  SALE_FG_OUT: "Penjualan",
  SAMPLE_RB_OUT: "Sample RB",
  SAMPLE_FG_OUT: "Sample FG",
  SAMPLE_PKG_OUT: "Sample PKG",
  ADJUSTMENT_IN: "Opname Masuk",
  ADJUSTMENT_OUT: "Opname Keluar",
  VOID_REVERSAL: "Pembatalan",
};

/**
 * Parse a YYYY-MM-DD date string as start-of-day in WIB (Asia/Jakarta, UTC+7).
 * Returns a Date object in UTC that corresponds to 00:00:00 WIB on that date.
 */
function parseDateAsWIBStart(dateStr: string): Date {
  // Create date at 00:00:00 UTC, then subtract 7 hours to get WIB midnight in UTC
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, 0, 0, 0) - 7 * 60 * 60 * 1000);
}

/**
 * Parse a YYYY-MM-DD date string as end-of-day in WIB.
 * Returns a Date object in UTC that corresponds to 23:59:59.999 WIB on that date.
 */
function parseDateAsWIBEnd(dateStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, 23, 59, 59, 999) - 7 * 60 * 60 * 1000);
}

export function LedgerHistoryTable({
  entries,
  onFilteredEntriesChange,
}: {
  entries: LedgerHistoryRow[];
  onFilteredEntriesChange: (entries: LedgerHistoryRow[]) => void;
}) {
  const [query, setQuery] = useState("");
  const [direction, setDirection] = useState<"ALL" | "IN" | "OUT">("ALL");
  const [filterType, setFilterType] = useState<"ALL" | "SAMPLE" | "OTHER">("ALL");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return entries.filter((entry) => {
      const matchesDirection = direction === "ALL" || entry.entryType === direction;
      const isSample = SAMPLE_REF_TYPES.has(entry.refType);
      const matchesFilterType =
        filterType === "ALL" || (filterType === "SAMPLE" && isSample) || (filterType === "OTHER" && !isSample);
      const matchesQuery =
        !normalizedQuery ||
        [
          entry.itemCode,
          entry.itemName,
          REF_TYPE_LABELS[entry.refType] ?? entry.refType,
          entry.refType,
          entry.refId,
          entry.notes ?? "",
          entry.createdByName,
        ].some((value) => value.toLowerCase().includes(normalizedQuery));
      const entryDate = new Date(entry.createdAt);
      const matchesFrom = !dateFrom || entryDate >= parseDateAsWIBStart(dateFrom);
      const matchesTo = !dateTo || entryDate <= parseDateAsWIBEnd(dateTo);
      return matchesDirection && matchesFilterType && matchesQuery && matchesFrom && matchesTo;
    });
  }, [direction, filterType, entries, query, dateFrom, dateTo]);

  useEffect(() => {
    setPage(1);
    onFilteredEntriesChange(filtered);
  }, [filtered, onFilteredEntriesChange]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const visibleEntries = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const hasFilters = query || direction !== "ALL" || filterType !== "ALL" || dateFrom || dateTo;

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex flex-col gap-2 md:flex-row md:items-center">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cari item, referensi, atau operator..."
            className="h-8 pl-8 text-xs bg-white/60 border-slate-200"
          />
        </div>
        <div className="flex items-center gap-2">
          <Input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="h-8 text-xs bg-white/60 border-slate-200 w-[130px]"
            aria-label="Dari tanggal"
          />
          <span className="text-xs text-slate-400">—</span>
          <Input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="h-8 text-xs bg-white/60 border-slate-200 w-[130px]"
            aria-label="Sampai tanggal"
          />
        </div>
        <div className="inline-flex rounded-lg border border-slate-200/60 bg-white/50 p-0.5">
          {(["ALL", "IN", "OUT"] as const).map((value) => (
            <Button
              key={value}
              type="button"
              size="sm"
              variant={direction === value ? "default" : "ghost"}
              className="h-7 min-w-12 rounded-md text-[11px] font-medium"
              onClick={() => setDirection(value)}
            >
              {value === "ALL" ? "Semua" : value === "IN" ? "Masuk" : "Keluar"}
            </Button>
          ))}
        </div>
        <div className="inline-flex rounded-lg border border-slate-200/60 bg-white/50 p-0.5">
          {(["ALL", "SAMPLE", "OTHER"] as const).map((value) => (
            <Button
              key={value}
              type="button"
              size="sm"
              variant={filterType === value ? "default" : "ghost"}
              className="h-7 min-w-12 rounded-md text-[11px] font-medium"
              onClick={() => setFilterType(value)}
            >
              {value === "ALL" ? "Semua" : value === "SAMPLE" ? "Sample" : "Non-Sample"}
            </Button>
          ))}
        </div>
      </div>

      {/* Desktop Table */}
      <div className="hidden md:block overflow-x-auto rounded-lg border border-slate-200/60 bg-white/50">
        <Table>
          <TableHeader>
            <TableRow className="border-b border-slate-100">
              <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Waktu</TableHead>
              <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Item</TableHead>
              <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Aktivitas</TableHead>
              <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Operator</TableHead>
              <TableHead className="text-right text-[11px] font-semibold uppercase tracking-wider text-slate-500">Jumlah</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visibleEntries.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-8">
                  <InventoryEmptyState
                    label="Tidak ada mutasi"
                    description={hasFilters ? "Tidak ada mutasi yang sesuai filter." : "Belum ada riwayat mutasi stok."}
                  />
                </TableCell>
              </TableRow>
            ) : (
              visibleEntries.map((entry) => (
                <TableRow key={entry.id} className="hover:bg-slate-50/50 transition-colors">
                  <TableCell className="whitespace-nowrap text-xs text-slate-500 tabular-nums">
                    {new Date(entry.createdAt).toLocaleString("id-ID", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                  </TableCell>
                  <TableCell>
                    <div className="text-sm font-medium text-slate-800">{entry.itemName}</div>
                    <div className="text-xs text-slate-400">{entry.itemCode}</div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      <Badge
                        variant="outline"
                        className={`text-xs font-medium ${
                          SAMPLE_REF_TYPES.has(entry.refType)
                            ? "border-violet-200 bg-violet-50 text-violet-700"
                            : entry.entryType === "IN"
                              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                              : "border-red-200 bg-red-50 text-red-600"
                        }`}
                      >
                        {REF_TYPE_LABELS[entry.refType] ?? entry.refType}
                      </Badge>
                    </div>
                    {entry.notes && (
                      <div className="max-w-48 truncate text-xs text-slate-400 mt-0.5" title={entry.notes}>
                        {entry.notes}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-xs text-slate-600">{entry.createdByName}</TableCell>
                  <TableCell className="text-right">
                    <span className={`text-sm font-semibold tabular-nums ${entry.entryType === "IN" ? "text-emerald-700" : "text-red-600"}`}>
                      {entry.entryType === "IN" ? "+" : "-"}{entry.quantity.toLocaleString("id-ID")} {entry.unit}
                    </span>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Mobile Activity List */}
      <div className="md:hidden flex flex-col gap-1.5">
        {visibleEntries.length === 0 ? (
          <div className="py-8 text-center rounded-lg border border-slate-200/60 bg-white/50">
            <InventoryEmptyState
              label="Tidak ada mutasi"
              description={hasFilters ? "Tidak ada mutasi yang sesuai filter." : "Belum ada riwayat mutasi stok."}
            />
          </div>
        ) : (
          visibleEntries.map((entry) => (
            <div
              key={entry.id}
              className="flex items-start gap-3 rounded-lg border border-slate-200/60 bg-white/50 px-3 py-2.5"
            >
              {/* Direction indicator */}
              <div className={`mt-0.5 h-2 w-2 shrink-0 rounded-full ${entry.entryType === "IN" ? "bg-emerald-500" : "bg-red-500"}`} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium text-slate-800 truncate">{entry.itemName}</span>
                  <span className={`text-xs font-semibold tabular-nums shrink-0 ${entry.entryType === "IN" ? "text-emerald-700" : "text-red-600"}`}>
                    {entry.entryType === "IN" ? "+" : "-"}{entry.quantity.toLocaleString("id-ID")} {entry.unit}
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-500">
                  <span>{REF_TYPE_LABELS[entry.refType] ?? entry.refType}</span>
                  <span>·</span>
                  <span>{entry.createdByName}</span>
                  <span>·</span>
                  <span className="tabular-nums">{new Date(entry.createdAt).toLocaleString("id-ID", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between text-xs text-slate-500">
        <span className="tabular-nums">{filtered.length} mutasi</span>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            size="icon-sm"
            variant="outline"
            aria-label="Halaman sebelumnya"
            disabled={page <= 1}
            onClick={() => setPage((c) => Math.max(1, c - 1))}
          >
            <ChevronLeft size={14} />
          </Button>
          <span className="tabular-nums">{page}/{totalPages}</span>
          <Button
            type="button"
            size="icon-sm"
            variant="outline"
            aria-label="Halaman berikutnya"
            disabled={page >= totalPages}
            onClick={() => setPage((c) => Math.min(totalPages, c + 1))}
          >
            <ChevronRight size={14} />
          </Button>
        </div>
      </div>
    </div>
  );
}
