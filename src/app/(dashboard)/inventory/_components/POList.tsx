"use client";

import { useState, useEffect, useMemo } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatusBadge } from "@/components/ui/status-badge";
import { NextAction } from "@/components/ui/next-action";
import { formatRupiah, formatDate as formatDateUtil } from "@/lib/format";
import { getPOList } from "../po-actions";
import { EmptyState } from "@/components/shared/EmptyState";
import type { POStatus } from "@prisma/client";

type POListItem = {
  id: string;
  code: string;
  status: POStatus;
  supplierName: string;
  expectedDate: string | null;
  totalEstimate: number;
  sentAt: string | null;
  receivedAt: string | null;
  createdAt: string;
  itemCount: number;
  items: Array<{
    productName: string | null;
    packagingName: string | null;
    quantity: number;
  }>;
};

interface POListProps {
  onSelectPO: (poId: string) => void;
  refreshKey?: number;
  metricFilter?: string | null;
}

export function POList({ onSelectPO, refreshKey, metricFilter }: POListProps) {
  const [items, setItems] = useState<POListItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Map metric filter to PO status
  const filter: POStatus | "ALL" = useMemo(() => {
    if (metricFilter === "active") return "ALL";
    if (metricFilter === "waiting") return "SENT";
    if (metricFilter === "partial") return "PARTIAL";
    return "ALL";
  }, [metricFilter]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const listData = await getPOList(filter === "ALL" ? {} : { status: filter });
        if (!cancelled) setItems(listData.items);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [refreshKey, filter]);

  const formatDate = (date: string | null) => {
    if (!date) return "-";
    return formatDateUtil(date);
  };

  return (
    <div className="space-y-3">
      {/* Desktop Table */}
      <div className="hidden md:block overflow-hidden rounded-lg border border-border/60 bg-card/50">
        <Table>
          <TableHeader>
            <TableRow className="border-b border-border">
              <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-ink-tertiary">Kode</TableHead>
              <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-ink-tertiary">Supplier</TableHead>
              <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-ink-tertiary">Produk/Kemasan</TableHead>
              <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-ink-tertiary">Status</TableHead>
              <TableHead className="text-right text-[11px] font-semibold uppercase tracking-wider text-ink-tertiary">Total</TableHead>
              <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-ink-tertiary">Tanggal</TableHead>
              <TableHead className="text-right text-[11px] font-semibold uppercase tracking-wider text-ink-tertiary">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="py-6 text-center text-sm text-ink-tertiary">
                  Memuat data...
                </TableCell>
              </TableRow>
            ) : items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-8">
                  <EmptyState.TableEmptyState
                    label="Purchase Order"
                    isFiltered={false}
                    filteredLabel="Belum ada Purchase Order"
                    filteredDescription="Buat PO baru untuk memulai pengadaan."
                    colSpan={6}
                  />
                </TableCell>
              </TableRow>
            ) : (
              items.map((po) => (
                <TableRow
                  key={po.id}
                  className="hover:bg-surface-sunken/50 cursor-pointer transition-colors"
                  onClick={() => onSelectPO(po.id)}
                >
                  <TableCell className="font-medium text-sm text-ink">{po.code}</TableCell>
                  <TableCell className="text-sm text-ink">{po.supplierName}</TableCell>
                  <TableCell className="text-xs text-ink">
                    {po.items.length > 0 ? (
                      <div className="flex flex-col gap-0.5">
                        {po.items.slice(0, 2).map((item, idx) => (
                          <span key={idx} className="truncate max-w-[180px]">
                            {item.productName || item.packagingName || "-"}
                          </span>
                        ))}
                        {po.items.length > 2 && (
                          <span className="text-ink-tertiary">+{po.items.length - 2} lainnya</span>
                        )}
                      </div>
                    ) : (
                      <span className="text-ink-tertiary">-</span>
                    )}
                  </TableCell>
                  <TableCell><StatusBadge status={po.status} /></TableCell>
                  <TableCell className="text-sm font-semibold text-ink tabular-nums text-right">{formatRupiah(po.totalEstimate)}</TableCell>
                  <TableCell className="text-xs text-ink-tertiary">{formatDate(po.expectedDate)}</TableCell>
                  <TableCell className="text-right">
                    {(po.status === "SENT" || po.status === "PARTIAL") && (
                      <NextAction label="Terima" tone="inventory" onClick={() => onSelectPO(po.id)} size="sm" className="h-7 px-2" />
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Mobile Order Cards */}
      <div className="md:hidden flex flex-col gap-1.5">
        {loading ? (
          <div className="py-8 text-center rounded-lg border border-border/60 bg-card/50">
            <p className="text-sm text-ink-tertiary">Memuat data...</p>
          </div>
        ) : items.length === 0 ? (
          <div className="py-8 text-center rounded-lg border border-border/60 bg-card/50" style={{ maxWidth: 280, margin: "0 auto" }}>
            <EmptyState.CardEmptyState
                label="Purchase Order"
              />
          </div>
        ) : (
          items.map((po) => (
            <div
              key={po.id}
              onClick={() => onSelectPO(po.id)}
              className="rounded-lg border border-border/60 bg-card/50 px-3 py-2.5 cursor-pointer hover:bg-surface-sunken/50 transition-colors"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium text-ink">{po.code}</span>
                <StatusBadge status={po.status} />
              </div>
              <div className="mt-1 text-xs text-ink-tertiary">
                <span>{po.supplierName}</span>
                {po.items.length > 0 && (
                  <span className="ml-1 text-ink-tertiary">
                    ┬╖ {po.items[0].productName || po.items[0].packagingName}
                    {po.items.length > 1 && ` +${po.items.length - 1}`}
                  </span>
                )}
              </div>
              <div className="flex items-center justify-between mt-0.5 text-xs">
                <span className="text-ink-tertiary">{formatDate(po.expectedDate)}</span>
                <span className="flex items-center gap-1.5">
                  <span className="font-semibold text-ink tabular-nums">{formatRupiah(po.totalEstimate)}</span>
                  {(po.status === "SENT" || po.status === "PARTIAL") && (
                    <NextAction label="Terima" tone="inventory" onClick={() => onSelectPO(po.id)} size="sm" className="h-7 px-2" />
                  )}
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

