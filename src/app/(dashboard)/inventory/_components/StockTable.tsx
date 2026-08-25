"use client";

import { useState, useEffect, useMemo, useCallback, Fragment } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Search, ArrowUpDown, ChevronDown, ChevronRight, MapPin } from "lucide-react";
import { formatKg, formatRupiah, formatUnit } from "@/lib/format";
import type { ProductStockRow, FGStockRow, ProductLotRow, SupplyLotRow, SupplyStockRow, LotPlacementRow } from "../types";
import { SUPPLY_CATEGORY_LABEL } from "../types";
import type { ReorderSummary } from "@/lib/reorder";
import { CategoryTabs, type CategoryId } from "./CategoryTabs";
import { InventoryStatusBadge } from "./InventoryStatusBadge";
import { EmptyState } from "@/components/shared/EmptyState";
import {
  getDisplayStatus,
  calcInventoryValue,
  formatInventoryValue,
  type DisplayStatus,
} from "@/lib/inventory-utils";
import type { LotOperationalStatus } from "@/lib/lot";

// ─── Unified row type ───

type UnifiedRow = {
  id: string;
  code: string;
  name: string;
  _type: "GREEN_BEAN" | "ROASTED_BEAN" | "FINISHED_GOODS" | "PACKAGING" | "SUPPLY";
  _unit: "kg" | "unit";
  _supplyUnit: string | null;
  _stockValue: number;
  _hpp: number | null;
  _meta: string | null;
  _reorderPoint?: number | null;
  _status: DisplayStatus;
};

// ─── Sort ───

type SortKey = "name" | "stock" | "hpp" | "value" | "status";

const STATUS_ORDER: Record<DisplayStatus, number> = {
  habis: 0,
  rendah: 1,
  belum_dikonfigurasi: 2,
  aman: 3,
};

// ─── Props ───

interface StockTableProps {
  gbStocks: ProductStockRow[];
  rbStocks: ProductStockRow[];
  fgStocks: FGStockRow[];
  supplyStocks: SupplyStockRow[];
  productReorderSummaries?: ReorderSummary[];
  supplyReorderSummaries?: ReorderSummary[];
  metricFilter?: string | null;
  lotsByProduct?: Record<string, ProductLotRow[]>;
  supplyLotsByItem?: Record<string, SupplyLotRow[]>;
  onEmptyAction?: () => void;
}

const LOT_STATUS_META: Record<LotOperationalStatus, { label: string; className: string }> = {
  ok: { label: "Aktif", className: "bg-[var(--status-success)]/10 text-[var(--status-success)] border-[var(--status-success)]/30" },
  expiring_soon: { label: "Segera Kadaluarsa", className: "bg-[var(--status-warning)]/10 text-[var(--status-warning)] border-[var(--status-warning)]/30" },
  expired: { label: "Kadaluarsa", className: "bg-[var(--status-danger)]/10 text-[var(--status-danger)] border-[var(--status-danger)]/30" },
  consumed: { label: "Habis", className: "bg-surface-sunken text-ink-tertiary border-border" },
};

type LotPlacementDisplay = {
  key: string;
  label: string;
  qtyText: string;
};

type LotDisplayRow = {
  id: string;
  batchCode: string;
  expiryDate: string | null;
  supplierName: string | null;
  remainingText: string;
  status: LotOperationalStatus;
  placements: LotPlacementDisplay[];
};

function formatProductPlacement(p: LotPlacementRow, unitIsKg: boolean): string {
  if (unitIsKg) return formatKg(p.quantityKg);
  return `${p.quantityUnit.toLocaleString("id-ID")} unit`;
}

function formatSupplyPlacement(p: LotPlacementRow, supplyUnit: string | null): string {
  if (p.supplyQty > 0) {
    return `${p.supplyQty.toLocaleString("id-ID", { maximumFractionDigits: 2 })} ${supplyUnit ?? "pcs"}`;
  }
  return `${p.quantityUnit.toLocaleString("id-ID")} unit`;
}

function toPlacementDisplays(placements: LotPlacementRow[], formatQty: (p: LotPlacementRow) => string): LotPlacementDisplay[] {
  return placements.map((p) => ({
    key: `${p.warehouseName}·${p.locationName}`,
    label: `${p.warehouseName} · ${p.locationName}`,
    qtyText: formatQty(p),
  }));
}

function toLotDisplayRows(
  row: UnifiedRow,
  lotsByProduct?: Record<string, ProductLotRow[]>,
  supplyLotsByItem?: Record<string, SupplyLotRow[]>,
): LotDisplayRow[] {
  if (row._type === "PACKAGING" || row._type === "SUPPLY") {
    return (supplyLotsByItem?.[row.id] ?? []).map((lot) => ({
      id: lot.id,
      batchCode: lot.batchCode,
      expiryDate: lot.expiryDate,
      supplierName: lot.supplierName,
      remainingText: `${lot.remainingQty.toLocaleString("id-ID", { maximumFractionDigits: 2 })} ${row._supplyUnit ?? "unit"}`,
      status: lot.status,
      placements: toPlacementDisplays(lot.placements, (p) => formatSupplyPlacement(p, row._supplyUnit)),
    }));
  }
  return (lotsByProduct?.[row.id] ?? []).map((lot) => ({
    id: lot.id,
    batchCode: lot.batchCode,
    expiryDate: lot.expiryDate,
    supplierName: lot.supplierName,
    remainingText: row._unit === "kg" ? formatKg(lot.remainingKg) : formatUnit(lot.remainingUnit),
    status: lot.status,
    placements: toPlacementDisplays(lot.placements, (p) => formatProductPlacement(p, row._unit === "kg")),
  }));
}

function LotStatusBadge({ status }: { status: LotOperationalStatus }) {
  const meta = LOT_STATUS_META[status];
  return (
    <span className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium", meta.className)}>
      {meta.label}
    </span>
  );
}

function LotBreakdown({ lots, unit }: { lots: LotDisplayRow[]; unit: string | null }) {
  if (lots.length === 0) {
    return <p className="pl-6 text-xs text-ink-secondary">Tidak ada lot aktif untuk item ini.</p>;
  }
  const locationCount = new Set(lots.flatMap((l) => l.placements.map((p) => p.key))).size;
  return (
    <div className="pl-6">
      <div className="grid grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_auto_auto] items-center gap-3 border-b border-border pb-1 text-[11px] font-semibold uppercase tracking-wider text-ink-tertiary">
        <span>Kode Lot</span>
        <span>Supplier</span>
        <span className="pr-2">Kedaluwarsa</span>
        <span className="text-right w-24">Sisa</span>
      </div>
      {locationCount > 0 && (
        <p className="pb-1 pt-1.5 text-[11px] font-medium text-ink-tertiary">
          {lots.length} lot · {locationCount} lokasi
        </p>
      )}
      {lots.map((lot) => (
        <div key={lot.id} className="border-b border-border py-1.5 last:border-0">
          <div className="grid grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_auto_auto] items-center gap-3">
            <span className="flex items-center gap-2 truncate text-xs font-medium text-ink">
              <Link
                href={`/inventory/lots/${lot.id}`}
                className="truncate underline-offset-2 transition hover:text-copper hover:underline"
                title="Buka detail & atur lokasi lot"
              >
                {lot.batchCode}
              </Link>
              <LotStatusBadge status={lot.status} />
            </span>
            <span className="truncate text-xs text-ink-secondary">{lot.supplierName ?? "—"}</span>
            <span className="pr-2 text-xs tabular-nums text-ink-secondary">
              {lot.expiryDate ? new Date(lot.expiryDate).toLocaleDateString("id-ID") : "—"}
            </span>
            <span className="w-24 text-right text-xs font-semibold tabular-nums text-ink">
              {lot.remainingText}
            </span>
          </div>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {lot.placements.length === 0 ? (
              <span className="text-[11px] text-ink-tertiary">Belum ditempatkan</span>
            ) : (
              lot.placements.map((p) => (
                <span
                  key={p.key}
                  className="inline-flex items-center gap-1 rounded-md border border-border bg-surface-sunken px-1.5 py-0.5 text-[11px] text-ink-secondary"
                >
                  <MapPin size={10} className="text-ink-tertiary" />
                  {p.label} · {p.qtyText}
                </span>
              ))
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Main component ───

export function StockTable({
  gbStocks,
  rbStocks,
  fgStocks,
  supplyStocks,
  productReorderSummaries,
  supplyReorderSummaries,
  metricFilter,
  lotsByProduct,
  supplyLotsByItem,
  onEmptyAction,
}: StockTableProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Read initial state from URL
  const categoryParam = searchParams.get("category");
  const statusParam = searchParams.get("status");
  const initialTab: CategoryId =
    categoryParam === "rb" || categoryParam === "fg" || categoryParam === "pkg" || categoryParam === "supply" ? categoryParam : "gb";
  const initialStatus: "all" | DisplayStatus =
    statusParam === "aman" || statusParam === "rendah" || statusParam === "habis" || statusParam === "belum_dikonfigurasi"
      ? statusParam : "all";

  const [activeTab, setActiveTab] = useState<CategoryId>(initialTab);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | DisplayStatus>(initialStatus);
  const [sortKey, setSortKey] = useState<SortKey>("status");
  const [sortAsc, setSortAsc] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Sync URL → state on param change (e.g. browser back/forward)
  useEffect(() => {
    const cat = searchParams.get("category");
    if (cat === "gb" || cat === "rb" || cat === "fg" || cat === "pkg" || cat === "supply") setActiveTab(cat);
    const st = searchParams.get("status");
    if (st === "aman" || st === "rendah" || st === "habis" || st === "belum_dikonfigurasi") setStatusFilter(st);
    else if (!st) setStatusFilter("all");
    setExpandedId(null);
  }, [searchParams]);

  const updateUrl = useCallback((updates: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(updates)) {
      if (value === null) params.delete(key);
      else params.set(key, value);
    }
    router.push(`?${params.toString()}`, { scroll: false });
  }, [router, searchParams]);

  const productReorderMap = useMemo(() => {
    const map = new Map<string, ReorderSummary>();
    for (const s of productReorderSummaries ?? []) map.set(s.skuId, s);
    return map;
  }, [productReorderSummaries]);

  const supplyReorderMap = useMemo(() => {
    const map = new Map<string, ReorderSummary>();
    for (const s of supplyReorderSummaries ?? []) map.set(s.skuId, s);
    return map;
  }, [supplyReorderSummaries]);

  const packagingSupplyItems = useMemo(
    () => supplyStocks.filter((s) => s.category === "PACKAGING"),
    [supplyStocks],
  );
  const nonPackagingSupplyItems = useMemo(
    () => supplyStocks.filter((s) => s.category !== "PACKAGING"),
    [supplyStocks],
  );

  // Build unified rows with status — uses shared getDisplayStatus
  const allRows = useMemo(() => {
    const reorderMap = activeTab === "pkg" || activeTab === "supply" ? supplyReorderMap : productReorderMap;
    const rows: UnifiedRow[] = [];

    function makeRow(
      id: string, code: string, name: string,
      _type: UnifiedRow["_type"], _unit: UnifiedRow["_unit"],
      _stockValue: number, _hpp: number | null, _meta: string | null, _supplyUnit: string | null = null
    ): UnifiedRow {
      const summary = reorderMap.get(id);
      const status = getDisplayStatus(_stockValue, _type, summary);
      return { id, code, name, _type, _unit, _supplyUnit, _stockValue, _hpp, _meta, _status: status, _reorderPoint: summary?.reorderPoint };
    }

    if (activeTab === "gb") {
      for (const s of gbStocks) rows.push(makeRow(s.id, s.code, s.name, "GREEN_BEAN", "kg", Number(s.stockKg), s.latestHppPerKg, s.origin));
    } else if (activeTab === "rb") {
      for (const s of rbStocks) rows.push(makeRow(s.id, s.code, s.name, "ROASTED_BEAN", "kg", Number(s.stockKg), s.latestHppPerKg, s.roastLevel?.replace("_", " ") ?? null));
    } else if (activeTab === "fg") {
      for (const s of fgStocks) rows.push(makeRow(s.id, s.code, s.name, "FINISHED_GOODS", "unit", Number(s.stockUnit), s.latestHppPerUnit, null));
    } else if (activeTab === "pkg") {
      for (const s of packagingSupplyItems) {
        rows.push(makeRow(s.id, s.code, s.name, "PACKAGING", "unit", s.stockUnit, s.costPerUnit, s.weightGrams != null ? `${s.weightGrams}g` : null, s.baseUnit));
      }
    } else {
      for (const s of nonPackagingSupplyItems) {
        rows.push(makeRow(s.id, s.code, s.name, "SUPPLY", "unit", s.stockUnit, s.costPerUnit, SUPPLY_CATEGORY_LABEL[s.category], s.baseUnit));
      }
    }

    return rows;
  }, [activeTab, gbStocks, rbStocks, fgStocks, packagingSupplyItems, nonPackagingSupplyItems, productReorderMap, supplyReorderMap]);

  // Filter + sort
  const rows = useMemo(() => {
    let result = allRows;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter((r) =>
        r.name.toLowerCase().includes(q) ||
        r.code.toLowerCase().includes(q) ||
        (r._meta && r._meta.toLowerCase().includes(q))
      );
    }

    if (statusFilter !== "all") {
      result = result.filter((r) => r._status === statusFilter);
    }

    // Metric card filter
    if (metricFilter === "out-of-stock") {
      result = result.filter((r) => r._status === "habis");
    } else if (metricFilter === "needs-reorder") {
      result = result.filter((r) => r._status === "rendah");
    } else if (metricFilter === "not-configured") {
      result = result.filter((r) => r._status === "belum_dikonfigurasi");
    }

    result = [...result].sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "name": cmp = a.name.localeCompare(b.name); break;
        case "stock": cmp = a._stockValue - b._stockValue; break;
        case "hpp": cmp = (a._hpp ?? 0) - (b._hpp ?? 0); break;
        case "value": cmp = (calcInventoryValue(a._stockValue, a._hpp) ?? 0) - (calcInventoryValue(b._stockValue, b._hpp) ?? 0); break;
        case "status": cmp = STATUS_ORDER[a._status] - STATUS_ORDER[b._status]; break;
      }
      return sortAsc ? cmp : -cmp;
    });

    return result;
  }, [allRows, searchQuery, statusFilter, metricFilter, sortKey, sortAsc]);

  // Category tabs — uses same getDisplayStatus as table rows
  const categoryTabs = useMemo(() => {
    const hasIssue = (status: DisplayStatus) => status === "habis" || status === "rendah";
    return [
      { id: "gb" as const, label: "Green Bean", count: gbStocks.length, hasIssues: gbStocks.some((s) => hasIssue(getDisplayStatus(Number(s.stockKg), s.type, productReorderMap.get(s.id)))) },
      { id: "rb" as const, label: "Roasted Bean", count: rbStocks.length, hasIssues: rbStocks.some((s) => hasIssue(getDisplayStatus(Number(s.stockKg), s.type, productReorderMap.get(s.id)))) },
      { id: "fg" as const, label: "Produk Jadi", count: fgStocks.length, hasIssues: fgStocks.some((s) => hasIssue(getDisplayStatus(Number(s.stockUnit), s.type, productReorderMap.get(s.id)))) },
      { id: "pkg" as const, label: "Kemasan", count: packagingSupplyItems.length, hasIssues: packagingSupplyItems.some((s) => hasIssue(getDisplayStatus(s.stockUnit, "PACKAGING", supplyReorderMap.get(s.id)))) },
      { id: "supply" as const, label: "Non-Kopi", count: nonPackagingSupplyItems.length, hasIssues: nonPackagingSupplyItems.some((s) => hasIssue(getDisplayStatus(s.stockUnit, "SUPPLY", supplyReorderMap.get(s.id)))) },
    ];
  }, [gbStocks, rbStocks, fgStocks, packagingSupplyItems, nonPackagingSupplyItems, productReorderMap, supplyReorderMap]);

  const isKg = activeTab === "gb" || activeTab === "rb";

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortAsc(!sortAsc);
    } else {
      setSortKey(key);
      setSortAsc(true);
    }
  };

  const hasActiveFilters = searchQuery.trim().length > 0 || statusFilter !== "all" || !!metricFilter;

  const clearFilters = () => {
    setSearchQuery("");
    setStatusFilter("all");
    setExpandedId(null);
    updateUrl({ status: null, metric: null });
  };

  const emptyAction = hasActiveFilters ? (
    <button
      type="button"
      onClick={clearFilters}
      className="rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-semibold text-ink-secondary transition-colors hover:bg-surface-sunken"
    >
      Bersihkan filter
    </button>
  ) : onEmptyAction ? (
    <button
      type="button"
      onClick={onEmptyAction}
      className="rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground transition-colors hover:bg-primary/90"
    >
      Barang Datang
    </button>
  ) : undefined;

  return (
    <div className="space-y-0">
      {/* Category Tabs */}
      <CategoryTabs tabs={categoryTabs} active={activeTab} onChange={(tab) => { setActiveTab(tab); setSearchQuery(""); setStatusFilter("all"); setExpandedId(null); updateUrl({ category: tab, status: null }); }} />

      {/* Toolbar */}
      <div className="flex items-center gap-2 py-3">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-tertiary" size={14} />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari item..."
            className="h-8 pl-8 text-xs bg-card border-border"
          />
        </div>
        <div className="relative">
          <select
            value={statusFilter}
            onChange={(e) => { const v = e.target.value as typeof statusFilter; setStatusFilter(v); updateUrl({ status: v === "all" ? null : v }); }}
            className="h-8 appearance-none rounded-lg border border-border bg-card pl-2.5 pr-7 text-xs font-medium text-ink-secondary outline-none focus:border-copper"
          >
            <option value="all">Semua Status</option>
            <option value="aman">Aman</option>
            <option value="rendah">Menipis</option>
            <option value="habis">Habis</option>
            <option value="belum_dikonfigurasi">Belum Diatur</option>
          </select>
          <ChevronDown size={12} className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-ink-tertiary" />
        </div>
      </div>

      {/* Desktop Table */}
      <div className="hidden md:block overflow-hidden rounded-card border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow className="border-b border-border">
              <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-ink-tertiary">
                <button onClick={() => toggleSort("name")} className="flex items-center gap-1 hover:text-ink">
                  Item <ArrowUpDown size={10} />
                </button>
              </TableHead>
              <TableHead className="text-right text-[11px] font-semibold uppercase tracking-wider text-ink-tertiary">
                <button onClick={() => toggleSort("stock")} className="flex items-center gap-1 hover:text-ink ml-auto">
                  Stok <ArrowUpDown size={10} />
                </button>
              </TableHead>
              <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-ink-tertiary">
                <button onClick={() => toggleSort("status")} className="flex items-center gap-1 hover:text-ink">
                  Status <ArrowUpDown size={10} />
                </button>
              </TableHead>
              <TableHead className="text-right text-[11px] font-semibold uppercase tracking-wider text-ink-tertiary">
                <button onClick={() => toggleSort("hpp")} className="flex items-center gap-1 hover:text-ink ml-auto">
                  HPP <ArrowUpDown size={10} />
                </button>
              </TableHead>
              <TableHead className="text-right text-[11px] font-semibold uppercase tracking-wider text-ink-tertiary">
                <button onClick={() => toggleSort("value")} className="flex items-center gap-1 hover:text-ink ml-auto">
                  Nilai <ArrowUpDown size={10} />
                </button>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-8">
                  <EmptyState.TableEmptyState
                      label="item"
                      isFiltered={hasActiveFilters}
                      filteredLabel="Tidak ada item yang cocok"
                      filteredDescription="Coba ubah filter atau pencarian."
                      actionLabel={emptyAction?.props?.children as string | undefined}
                      onAction={emptyAction?.props?.onClick}
                      colSpan={5}
                    />
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => {
                const valueInfo = formatInventoryValue(row._stockValue, row._hpp);
                const lotList = toLotDisplayRows(row, lotsByProduct, supplyLotsByItem);
                const expanded = expandedId === row.id;
                return (
                  <Fragment key={row.id}>
                    <TableRow
                      className={cn(
                        "transition-colors cursor-pointer",
                        lotList.length > 0 ? "hover:bg-surface-sunken" : "hover:bg-transparent"
                      )}
                      onClick={() => {
                        if (lotList.length === 0) return;
                        setExpandedId(expanded ? null : row.id);
                      }}
                    >
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          {lotList.length > 0 && (
                            <ChevronRight
                              size={13}
                              className={cn("shrink-0 text-ink-tertiary transition-transform", expanded && "rotate-90")}
                            />
                          )}
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-ink">{row.name}</p>
                            <p className="truncate text-xs text-ink-secondary">
                              <span className="font-mono text-[11px]">{row.code}</span>
                              {row._meta ? (
                                <>
                                  <span className="px-1 text-ink-tertiary">·</span>
                                  {row._meta}
                                </>
                              ) : null}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <span className={cn("text-sm font-semibold tabular-nums", row._stockValue <= 0 ? "text-ink-tertiary" : "text-ink")}>
                          {row._supplyUnit ? `${row._stockValue.toLocaleString("id-ID", { maximumFractionDigits: 2 })} ${row._supplyUnit}` : (isKg ? formatKg(row._stockValue) : formatUnit(row._stockValue))}
                        </span>
                      </TableCell>
                      <TableCell>
                        <InventoryStatusBadge status={row._status} />
                      </TableCell>
                      <TableCell className="text-right text-xs text-ink-secondary tabular-nums">
                        {row._hpp != null ? formatRupiah(row._hpp) : <span className="text-ink-tertiary" title="HPP belum tersedia">—</span>}
                      </TableCell>
                      <TableCell className="text-right text-xs font-semibold text-ink tabular-nums">
                        <span title={valueInfo.unavailable ? "HPP belum tersedia" : undefined}>
                          {valueInfo.text}
                        </span>
                      </TableCell>
                    </TableRow>
                    {expanded && (
                      <TableRow className="bg-surface-sunken">
                        <TableCell colSpan={5} className="px-4 py-3">
                          <LotBreakdown lots={lotList} unit={row._supplyUnit} />
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Mobile Cards */}
      <div className="md:hidden flex flex-col gap-1.5">
        {rows.length === 0 ? (
          <EmptyState.CardEmptyState
            label={hasActiveFilters ? "Tidak ada item yang cocok" : "Belum ada data"}
            description="Coba ubah filter atau pencarian."
            actionLabel={emptyAction?.props?.children as string | undefined}
            onAction={emptyAction?.props?.onClick}
          />
        ) : (
          rows.map((row) => {
            const valueInfo = formatInventoryValue(row._stockValue, row._hpp);
            const lotList = toLotDisplayRows(row, lotsByProduct, supplyLotsByItem);
            const expanded = expandedId === row.id;
            return (
              <div
                key={row.id}
                className={cn(
                  "rounded-card border border-border bg-card overflow-hidden",
                  lotList.length > 0 && "cursor-pointer"
                )}
                onClick={() => {
                  if (lotList.length === 0) return;
                  setExpandedId(expanded ? null : row.id);
                }}
              >
                <div className="flex justify-between items-center px-3 py-2.5">
                  <div className="min-w-0 flex-1 mr-3">
                    <p className="text-sm font-medium text-ink truncate">{row.name}</p>
                    <p className="truncate text-xs text-ink-secondary">
                      <span className="font-mono text-[11px]">{row.code}</span>
                      {row._meta ? (
                        <>
                          <span className="px-1 text-ink-tertiary">·</span>
                          {row._meta}
                        </>
                      ) : null}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <InventoryStatusBadge status={row._status} />
                      <span className="text-xs text-ink-secondary tabular-nums" title={valueInfo.unavailable ? "HPP belum tersedia" : undefined}>
                        {valueInfo.text}
                      </span>
                    </div>
                  </div>
                  <span className={cn("text-sm font-semibold tabular-nums shrink-0", row._stockValue <= 0 ? "text-ink-tertiary" : "text-ink")}>
                    {row._supplyUnit ? `${row._stockValue.toLocaleString("id-ID", { maximumFractionDigits: 2 })} ${row._supplyUnit}` : (isKg ? formatKg(row._stockValue) : formatUnit(row._stockValue))}
                  </span>
                  {lotList.length > 0 && (
                    <ChevronRight
                      size={14}
                      className={cn("ml-1 shrink-0 text-ink-tertiary transition-transform", expanded && "rotate-90")}
                    />
                  )}
                </div>
                {expanded && (
                  <div className="space-y-1.5 px-3 pb-2.5">
                    {lotList.length === 0 ? (
                      <p className="text-xs text-ink-secondary">Tidak ada lot aktif.</p>
                    ) : (
                      lotList.map((lot) => (
                        <div
                          key={lot.id}
                          className="flex items-center justify-between rounded-md border border-border bg-surface-sunken px-2.5 py-2"
                        >
                          <div className="min-w-0 pr-2">
                            <Link
                              href={`/inventory/lots/${lot.id}`}
                              onClick={(e) => e.stopPropagation()}
                              className="block truncate py-0.5 text-xs font-medium text-ink underline-offset-2 transition hover:text-copper hover:underline"
                              title="Buka detail & atur lokasi lot"
                            >
                              {lot.batchCode}
                            </Link>
                            <p className="text-[11px] text-ink-secondary">
                              {lot.supplierName ?? "—"} ·{" "}
                              {lot.expiryDate ? new Date(lot.expiryDate).toLocaleDateString("id-ID") : "tanpa kedaluwarsa"}
                            </p>
                            {lot.placements.length === 0 ? (
                              <p className="text-[11px] text-ink-tertiary">Belum ditempatkan</p>
                            ) : (
                              <div className="mt-0.5 flex flex-wrap gap-1">
                                {lot.placements.map((p) => (
                                  <span
                                    key={p.key}
                                    className="inline-flex items-center gap-0.5 rounded border border-border bg-card px-1 py-0.5 text-[10px] text-ink-secondary"
                                  >
                                    <MapPin size={9} className="text-ink-tertiary" />
                                    {p.label} · {p.qtyText}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                          <div className="flex shrink-0 items-center gap-2">
                            <LotStatusBadge status={lot.status} />
                            <span className="text-xs font-semibold tabular-nums text-ink">
                              {lot.remainingText}
                            </span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
