"use client";

import { useState, useEffect } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatusBadge } from "@/components/ui/status-badge";
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

interface ReceivingListProps {
  onSelectPO: (poId: string) => void;
  refreshKey?: number;
}



export function ReceivingList({ onSelectPO, refreshKey }: ReceivingListProps) {
  const [items, setItems] = useState<POListItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [sentData, partialData] = await Promise.all([
          getPOList({ status: "SENT" }),
          getPOList({ status: "PARTIAL" }),
        ]);
        if (!cancelled) setItems([...sentData.items, ...partialData.items]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [refreshKey]);

  const formatDate = (date: string | null) => {
    if (!date) return "-";
    return formatDateUtil(date);
  };

  const isOverdue = (expectedDate: string | null) => {
    if (!expectedDate) return false;
    return new Date(expectedDate) < new Date();
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
              <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-ink-tertiary">Estimasi</TableHead>
              <TableHead className="text-right text-[11px] font-semibold uppercase tracking-wider text-ink-tertiary">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} className="py-6 text-center text-sm text-ink-tertiary">Memuat data...</TableCell>
              </TableRow>
            ) : items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-8">
                  <EmptyState.TableEmptyState
                  label="penerimaan menunggu"
                  isFiltered={false}
                  filteredLabel="Tidak ada penerimaan menunggu"
                  filteredDescription="Semua PO sudah diterima atau belum ada PO dikirim."
                  colSpan={7}
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
                  <TableCell>
                    <span className={`text-xs ${isOverdue(po.expectedDate) ? "text-[var(--status-danger)] font-semibold" : "text-ink-tertiary"}`}>
                      {formatDate(po.expectedDate)}
                      {isOverdue(po.expectedDate) && " (lewat)"}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <button
                      type="button"
                      onClick={(event) => { event.stopPropagation(); onSelectPO(po.id); }}
                      className="rounded-lg bg-primary px-3 py-1.5 text-[11px] font-bold text-primary-foreground hover:bg-primary/90"
                    >
                      Terima
                    </button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Mobile Cards */}
      <div className="md:hidden flex flex-col gap-1.5">
        {loading ? (
          <div className="py-8 text-center rounded-lg border border-border/60 bg-card/50">
            <p className="text-sm text-ink-tertiary">Memuat data...</p>
          </div>
        ) : items.length === 0 ? (
          <EmptyState.CardEmptyState
                label="penerimaan menunggu"
              />
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
                    · {po.items[0].productName || po.items[0].packagingName}
                    {po.items.length > 1 && ` +${po.items.length - 1}`}
                  </span>
                )}
              </div>
              <div className="flex items-center justify-between mt-0.5 text-xs">
                <span className={`tabular-nums ${isOverdue(po.expectedDate) ? "text-[var(--status-danger)] font-semibold" : "text-ink-tertiary"}`}>
                  {formatDate(po.expectedDate)}
                  {isOverdue(po.expectedDate) && " (lewat)"}
                </span>
                <span className="font-semibold text-ink tabular-nums">{formatRupiah(po.totalEstimate)}</span>
              </div>
              <p className="mt-1 text-xs font-bold text-primary">Ketuk untuk catat penerimaan →</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
