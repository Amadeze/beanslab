import { AlertTriangle, Clock, CheckCircle2, Plus } from "lucide-react";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatDate, formatRupiah } from "@/lib/format";
import type { PiutangRow } from "../actions";
import { EmptyState } from "@/components/shared/EmptyState";

function OverdueBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-[var(--status-danger)]/10 px-1.5 py-0.5 text-xs font-semibold text-[var(--status-danger)]">
      <AlertTriangle size={9} />
      Lewat jatuh tempo
    </span>
  );
}

interface PiutangTableProps {
  rows: PiutangRow[];
  onTerimaPayment: (row: PiutangRow) => void;
}

export function PiutangTable({ rows, onTerimaPayment }: PiutangTableProps) {
  return (
    <>
    <div className="hidden md:block overflow-hidden rounded-[1.25rem] border border-white/60 bg-card/30 backdrop-blur-xl shadow-lg shadow-border/30">
      <Table>
        <TableHeader>
          <TableRow className="bg-card/40 border-b border-white/50 backdrop-blur-md hover:bg-card/40">
            <TableHead className="w-36 text-xs font-bold uppercase tracking-widest text-ink-secondary">No. Nota</TableHead>
            <TableHead className="text-xs font-bold uppercase tracking-widest text-ink-secondary">Customer</TableHead>
            <TableHead className=" text-xs font-bold uppercase tracking-widest text-ink-secondary">Item</TableHead>
            <TableHead className="text-right text-xs font-bold uppercase tracking-widest text-ink-secondary">Total</TableHead>
            <TableHead className=" text-right text-xs font-bold uppercase tracking-widest text-ink-secondary">Terbayar</TableHead>
            <TableHead className=" text-right text-xs font-bold uppercase tracking-widest text-ink-secondary">Sisa Tagihan</TableHead>
            <TableHead className=" text-xs font-bold uppercase tracking-widest text-ink-secondary">Jatuh Tempo</TableHead>
            <TableHead className="w-24 text-center text-xs font-bold uppercase tracking-widest text-ink-secondary">Status</TableHead>
            <TableHead className="w-36 text-center text-xs font-bold uppercase tracking-widest text-ink-secondary">Aksi</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <EmptyState.TableEmptyState
  label="piutang"
  isFiltered={false}
  filteredLabel="Semua nota sudah lunas"
  filteredDescription="Tidak ada piutang yang perlu ditagih saat ini."
  colSpan={9}
/>
          ) : (
            rows.map((row) => (
              <TableRow
                key={row.id}
                className={cn(
                  "transition-colors",
                  (row.agingBucket !== "CURRENT") ? "bg-[var(--status-danger)]/10/30 hover:bg-[var(--status-danger)]/10/50" : "hover:bg-card/40"
                )}
              >
                <TableCell>
                  <p className="font-mono text-xs font-semibold text-ink">{row.code}</p>
                  <p className="text-xs text-ink-secondary">{formatDate(row.issuedAt)}</p>
                </TableCell>
                <TableCell>
                  <p className="text-sm font-medium text-ink">{row.customerName}</p>
                  {row.customerPhone && (
                    <p className="text-[11px] text-ink-secondary">{row.customerPhone}</p>
                  )}
                </TableCell>
                <TableCell  className="max-w-[180px]">
                  <p className="truncate text-xs text-ink-secondary">{row.itemSummary}</p>
                </TableCell>
                <TableCell  className="text-right font-mono text-sm text-ink">
                  {formatRupiah(row.grandTotal)}
                </TableCell>
                <TableCell  className="text-right font-mono text-sm text-[var(--status-success)]">
                  {row.paidAmount > 0 ? formatRupiah(row.paidAmount) : <span className="text-ink-secondary">—</span>}
                </TableCell>
                <TableCell  className="text-right">
                  <p className="font-mono text-sm font-bold text-ink">
                    {formatRupiah(row.balance)}
                  </p>
                </TableCell>
                <TableCell>
                  {row.dueDate ? (
                    <div className="flex flex-col gap-0.5">
                      <p className={`text-xs ${(row.agingBucket !== "CURRENT") ? "text-[var(--status-danger)] font-medium" : "text-ink-secondary"}`}>
                        {formatDate(row.dueDate)}
                      </p>
                      {(row.agingBucket !== "CURRENT") && (
                        <p className="text-xs font-semibold text-[var(--status-danger)]">
                          {Math.floor((Date.now() - new Date(row.dueDate).getTime()) / 86_400_000)} hari terlambat
                        </p>
                      )}
                    </div>
                  ) : (
                    <span className="text-xs text-ink-secondary">—</span>
                  )}
                </TableCell>
                <TableCell className="text-center">
                  <StatusBadge status={row.status} icon={row.status === "PARTIAL" ? undefined : <Clock size={9} />} />
                </TableCell>
                <TableCell className="text-center">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onTerimaPayment(row)}
                    className="h-7 border-border px-3 text-xs font-medium text-ink hover:border-border hover:bg-surface-sunken"
                  >
                    Terima Pembayaran
                  </Button>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>

    <div className="md:hidden flex flex-col gap-3">
      {rows.length === 0 ? (
        <div className="py-12 text-center rounded-[1.25rem] border border-white/60 bg-card/30 backdrop-blur-xl">
           <p className="text-sm font-medium text-ink-secondary">Semua nota sudah lunas</p>
           <p className="mt-1 text-xs text-ink-secondary">Tidak ada piutang yang perlu ditagih saat ini.</p>
        </div>
      ) : (
        rows.map((row) => (
          <div key={row.id} className={`flex flex-col gap-2 rounded-[1.25rem] border border-white/60 bg-card/30 p-4 shadow-sm backdrop-blur-xl transition-colors ${(row.agingBucket !== "CURRENT") ? 'bg-[var(--status-danger)]/10/40' : ''}`}>
            <div className="flex justify-between items-start">
              <div>
                <p className="font-bold text-ink">{row.customerName}</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="font-mono text-xs font-semibold text-ink">{row.code}</span>
                  {row.customerPhone && (
                    <>
                      <span className="text-xs text-ink-secondary">•</span>
                      <span className="text-xs text-ink-secondary">{row.customerPhone}</span>
                    </>
                  )}
                </div>
              </div>
              <div className="text-right">
                <p className="font-mono text-sm font-black text-ink">{formatRupiah(row.balance)}</p>
                <p className="font-mono text-xs font-bold text-[var(--status-success)] mt-0.5">Terbayar: {formatRupiah(row.paidAmount)}</p>
              </div>
            </div>
            
            <div className="flex justify-between items-end mt-2 pt-2 border-t border-white/40">
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-1.5">
                  <StatusBadge status={row.status} icon={row.status === "PARTIAL" ? undefined : <Clock size={9} />} />
                  {(row.agingBucket !== "CURRENT") && <OverdueBadge />}
                </div>
                {row.dueDate ? (
                  <span className={`text-xs font-semibold ${(row.agingBucket !== "CURRENT") ? 'text-[var(--status-danger)]' : 'text-ink-secondary'}`}>
                    Tempo: {formatDate(row.dueDate)}
                  </span>
                ) : (
                  <span className="text-xs text-ink-secondary">Tanpa tempo</span>
                )}
              </div>
              <Button size="sm" onClick={() => onTerimaPayment(row)} className="h-7 px-2.5 text-[11px] font-bold uppercase bg-card/50 border border-border text-ink hover:bg-surface-sunken shadow-sm">
                Terima Pembayaran
              </Button>
            </div>
          </div>
        ))
      )}
    </div>
    </>
  );
}



