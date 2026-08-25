"use client";

import { formatDate, formatRupiah } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import type { ExpenseRow, VoidHistoryFilter } from "../actions";
import { Button } from "@/components/ui/button";
import { Trash2, Ban } from "lucide-react";
import { cn } from "@/lib/utils";

const CATEGORY_LABEL: Record<string, string> = {
  GAJI:        "Gaji & Tunjangan",
  UTILITAS:    "Utilitas",
  OPERASIONAL: "Operasional",
  LAINNYA:     "Lain-lain",
};

const CATEGORY_COLOR: Record<string, string> = {
  GAJI:        "bg-[var(--status-info)]/10 text-[var(--status-info)] border-[var(--status-info)]/30",
  UTILITAS:    "bg-[var(--status-warning)]/10 text-[var(--status-warning)] border-[var(--status-warning)]/30",
  OPERASIONAL: "bg-[var(--instrument)] text-[var(--instrument)] border-[var(--instrument)]/30",
  LAINNYA:     "bg-surface-sunken text-ink border-border",
};

interface ExpenseTableProps {
  rows: ExpenseRow[];
  onVoid: (row: ExpenseRow) => void;
  view?: VoidHistoryFilter;
}

export function ExpenseTable({ rows, onVoid, view = "ACTIVE" }: ExpenseTableProps) {
  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-16 text-center">
        <p className="text-sm font-medium text-ink-secondary">
          {view === "VOIDED"
            ? "Tidak ada pengeluaran yang dibatalkan."
            : "Belum ada pengeluaran tercatat."}
        </p>
        <p className="text-xs text-ink-secondary">
          {view === "ACTIVE"
            ? "Klik \"Catat Pengeluaran\" untuk mencatat OPEX."
            : "Riwayat pembatalan pengeluaran akan tampil di sini."}
        </p>
      </div>
    );
  }

  const total = rows.reduce((s, r) => s + r.amount, 0);

  return (
    <div className="space-y-3">
      {/* Summary */}
      <div className="flex items-center justify-between rounded-xl border border-white/60 bg-card/30 backdrop-blur-xl px-4 py-2.5 shadow-sm">
        <p className="text-xs text-ink-secondary">{rows.length} pengeluaran tercatat</p>
        <p className="font-mono text-sm font-bold text-[var(--status-danger)]">
          Total: {formatRupiah(total)}
        </p>
      </div>

      <div className="hidden md:block overflow-hidden rounded-[1.25rem] border border-white/60 bg-card/30 backdrop-blur-xl shadow-lg shadow-border/30">
        <Table>
          <TableHeader>
            <TableRow className="bg-card/40 border-b border-white/50 backdrop-blur-md hover:bg-card/40">
              <TableHead className="text-xs font-bold uppercase tracking-widest text-ink-secondary">Tanggal</TableHead>
              <TableHead className="text-xs font-bold uppercase tracking-widest text-ink-secondary">Kategori</TableHead>
              <TableHead className="text-xs font-bold uppercase tracking-widest text-ink-secondary">Keterangan</TableHead>
              <TableHead className="text-right text-xs font-bold uppercase tracking-widest text-ink-secondary">Nominal</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id} className={cn("transition-colors", row.voidedAt ? "bg-[var(--status-danger)]/10/40 hover:bg-[var(--status-danger)]/10/70" : "hover:bg-card/40")}>
                <TableCell className="text-sm text-ink">
                  {formatDate(row.date)}
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge
                      variant="outline"
                      className={`text-[11px] font-medium ${CATEGORY_COLOR[row.category] ?? "bg-surface-sunken text-ink-secondary"}`}
                    >
                      {CATEGORY_LABEL[row.category] ?? row.category}
                    </Badge>
                    {row.voidedAt && (
                      <Badge
                        variant="outline"
                        className="border-[var(--status-danger)]/30 bg-[var(--status-danger)]/10 text-[var(--status-danger)]"
                      >
                        <Ban size={10} className="mr-1" />
                        Dibatalkan
                      </Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-sm text-ink-secondary">
                  <span className={cn(row.voidedAt && "line-through opacity-60")}>
                    {row.description ?? <span className="italic text-ink-secondary">—</span>}
                  </span>
                  {row.voidedAt && (
                    <p className="mt-0.5 text-xs text-[var(--status-danger)]">
                      {row.voidReason ?? "Tanpa alasan"} · {formatDate(row.voidedAt)}
                      {row.voidedByName ? ` oleh ${row.voidedByName}` : ""}
                    </p>
                  )}
                </TableCell>
                <TableCell className={cn("text-right font-mono text-sm font-semibold", row.voidedAt ? "text-[var(--status-danger)] line-through" : "text-[var(--status-danger)]")}>
                  {formatRupiah(row.amount)}
                </TableCell>
                <TableCell>
                  {row.voidedAt ? null : (
                    <Button
                      type="button"
                      size="icon-sm"
                      variant="ghost"
                      title="Void pengeluaran"
                      aria-label={`Void pengeluaran ${row.id}`}
                      className="text-ink-secondary hover:bg-[var(--status-danger)]/10 hover:text-[var(--status-danger)]"
                      onClick={() => onVoid(row)}
                    >
                      <Trash2 size={14} />
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* MOBILE VIEW */}
      <div className="md:hidden flex flex-col gap-3">
        {rows.map((row) => (
          <div key={row.id} className={cn("p-4 rounded-xl border bg-card/30 backdrop-blur-md shadow-sm", row.voidedAt ? "border-[var(--status-danger)]/30" : "border-white/60")}>
            <div className="flex justify-between items-start mb-2">
              <div className="flex flex-wrap items-center gap-1.5">
                <Badge
                  variant="outline"
                  className={`text-xs font-bold ${CATEGORY_COLOR[row.category] ?? "bg-surface-sunken text-ink-secondary"}`}
                >
                  {CATEGORY_LABEL[row.category] ?? row.category}
                </Badge>
                {row.voidedAt && (
                  <Badge variant="outline" className="border-[var(--status-danger)]/30 bg-[var(--status-danger)]/10 text-[var(--status-danger)]">
                    <Ban size={10} className="mr-1" />
                    Dibatalkan
                  </Badge>
                )}
              </div>
              <span className="text-xs font-semibold text-ink-secondary">{formatDate(row.date)}</span>
            </div>
            <div className={cn("text-sm font-medium text-ink mb-1", row.voidedAt && "line-through opacity-60")}>
              {row.description ?? <span className="italic text-ink-secondary">Tanpa keterangan</span>}
            </div>
            {row.voidedAt && (
              <p className="mb-1 text-xs text-[var(--status-danger)]">
                {row.voidReason ?? "Tanpa alasan"} · {formatDate(row.voidedAt)}
                {row.voidedByName ? ` oleh ${row.voidedByName}` : ""}
              </p>
            )}
            <div className="text-right">
              <span className={cn("font-mono text-base font-bold", row.voidedAt ? "text-[var(--status-danger)] line-through" : "text-[var(--status-danger)]")}>
                {formatRupiah(row.amount)}
              </span>
            </div>
            {!row.voidedAt && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="mt-3 w-full gap-2 border-[var(--status-danger)]/30 text-[var(--status-danger)]"
                onClick={() => onVoid(row)}
              >
                <Trash2 size={14} />
                Void Pengeluaran
              </Button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}


