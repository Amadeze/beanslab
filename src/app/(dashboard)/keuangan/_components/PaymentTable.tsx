"use client";

import { Trash2, Ban } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatDate, formatRupiah } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { PaymentRow, VoidHistoryFilter } from "../actions";

export function PaymentTable({
  rows,
  onVoid,
  view = "ACTIVE",
}: {
  rows: PaymentRow[];
  onVoid: (row: PaymentRow) => void;
  view?: VoidHistoryFilter;
}) {
  if (rows.length === 0) {
    return (
      <div data-testid="payment-history" className="py-16 text-center text-sm text-ink-secondary">
        {view === "VOIDED"
          ? "Tidak ada pembayaran yang dibatalkan."
          : "Belum ada pembayaran tercatat."}
      </div>
    );
  }

  return (
    <div data-testid="payment-history">
      {/* Desktop table */}
      <div className="hidden md:block overflow-x-auto rounded-xl border border-white/60 bg-card/40">
        <div className="grid grid-cols-[1fr_1fr_1fr_auto] gap-3 border-b border-white/60 px-4 py-3 text-xs font-bold uppercase text-ink-secondary">
          <span>Pembayaran</span>
          <span>Invoice / Customer</span>
          <span className="text-right">Nominal</span>
          <span className="w-8" />
        </div>
        {rows.map((row) => (
          <div key={row.id} className={cn("grid grid-cols-[1fr_1fr_1fr_auto] items-center gap-3 border-b border-white/40 px-4 py-3 text-sm last:border-0", row.voidedAt && "bg-[var(--status-danger)]/10/40")}>
            <div>
              <div className="flex flex-wrap items-center gap-1.5 font-semibold text-ink">
                <span className={cn(row.voidedAt && "line-through opacity-60")}>{row.code}</span>
                {row.voidedAt && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-[var(--status-danger)]/30 bg-[var(--status-danger)]/10 px-2 py-0.5 text-[10px] font-semibold text-[var(--status-danger)]">
                    <Ban size={10} />
                    Dibatalkan
                  </span>
                )}
              </div>
              <div className="text-xs text-ink-secondary">{formatDate(row.paidAt)} · {row.method}</div>
              {row.voidedAt && (
                <div className="mt-0.5 text-xs text-[var(--status-danger)]">
                  {row.voidReason ?? "Tanpa alasan"} · {formatDate(row.voidedAt)}
                  {row.voidedByName ? ` oleh ${row.voidedByName}` : ""}
                </div>
              )}
            </div>
            <div>
              <div className="font-medium text-ink">{row.invoiceCode}</div>
              <div className="text-xs text-ink-secondary">{row.customerName}</div>
            </div>
            <div className={cn("text-right font-mono font-bold", row.voidedAt ? "text-[var(--status-danger)] line-through" : "text-[var(--status-success)]")}>
              {formatRupiah(row.amount)}
            </div>
            {row.voidedAt ? <span /> : (
              <Button
                type="button"
                size="icon-sm"
                variant="ghost"
                aria-label={`Void ${row.code}`}
                title="Void pembayaran"
                className="text-ink-secondary hover:bg-[var(--status-danger)]/10 hover:text-[var(--status-danger)]"
                onClick={() => onVoid(row)}
              >
                <Trash2 size={14} />
              </Button>
            )}
          </div>
        ))}
      </div>

      {/* Mobile card view */}
      <div className="md:hidden flex flex-col gap-2">
        {rows.map((row) => (
          <div key={row.id} className={cn("rounded-xl border bg-card/40 p-4 backdrop-blur-md", row.voidedAt ? "border-[var(--status-danger)]/30" : "border-white/60")}>
            <div className="flex items-start justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-1.5 font-semibold text-ink">
                  <span className={cn(row.voidedAt && "line-through opacity-60")}>{row.code}</span>
                  {row.voidedAt && (
                    <span className="inline-flex items-center gap-1 rounded-full border border-[var(--status-danger)]/30 bg-[var(--status-danger)]/10 px-2 py-0.5 text-[10px] font-semibold text-[var(--status-danger)]">
                      <Ban size={10} />
                      Dibatalkan
                    </span>
                  )}
                </div>
                <div className="text-xs text-ink-secondary">{formatDate(row.paidAt)} · {row.method}</div>
              </div>
              {!row.voidedAt && (
                <Button
                  type="button"
                  size="icon-sm"
                  variant="ghost"
                  aria-label={`Void ${row.code}`}
                  title="Void pembayaran"
                  className="text-ink-secondary hover:bg-[var(--status-danger)]/10 hover:text-[var(--status-danger)]"
                  onClick={() => onVoid(row)}
                >
                  <Trash2 size={14} />
                </Button>
              )}
            </div>
            {row.voidedAt && (
              <div className="mt-1 text-xs text-[var(--status-danger)]">
                {row.voidReason ?? "Tanpa alasan"} · {formatDate(row.voidedAt)}
                {row.voidedByName ? ` oleh ${row.voidedByName}` : ""}
              </div>
            )}
            <div className="mt-2 flex items-center justify-between">
              <div>
                <div className="text-xs font-medium text-ink">{row.invoiceCode}</div>
                <div className="text-xs text-ink-secondary">{row.customerName}</div>
              </div>
              <div className={cn("font-mono text-sm font-bold", row.voidedAt ? "text-[var(--status-danger)] line-through" : "text-[var(--status-success)]")}>
                {formatRupiah(row.amount)}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
